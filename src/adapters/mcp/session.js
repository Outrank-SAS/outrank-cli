import { loadConfig } from '../../core/config.js';
import { MCP_STARTUP_RESOLVE_TIMEOUT_MS, Surface } from '../../core/constants.js';
import { createCommandContext, resolveContext } from '../../core/context.js';
import { MCP_USAGE_GUIDANCE, cliError, toErrorEnvelope } from '../../core/errors.js';
import { RECEIVED_RESPONSE_PROPERTY } from '../../core/http.js';
import { UUID_PATTERN } from '../../core/schema.js';
import {
  FallbackReason,
  IdentityStatus,
  MAX_IDENTITY_TEXT_CHARS,
  MCP_IDENTITY_RETRY_INTERVAL_MS,
  SelectionSource,
} from './constants.js';
import { createRequestThrottle } from './throttle.js';
import { selectTools } from './toolsets.js';

const WHOAMI_PATH = '/auth/whoami';
const ENTITLEMENTS_FIELD = 'entitlements';
const KEY_REJECTED_CODES = Object.freeze([
  'AUTH_MISSING',
  'AUTH_INVALID_FORMAT',
  'AUTH_KEY_INVALID',
  'AUTH_KEY_REVOKED',
  'AUTH_KEY_EXPIRED',
]);
const PERMANENT_IDENTITY_ERROR_CODES = Object.freeze([
  ...KEY_REJECTED_CODES,
  'ACCESS_DENIED',
  'CLI_AUTH_REQUIRED',
  'CLI_INVALID_USAGE',
]);
const CONFIGURATION_NOTE =
  ' This is a problem with the MCP server configuration: tell the human, who must fix it outside this ' +
  'conversation. The server re-reads the outrank-cli config file on the next call; a change to its command line ' +
  'or environment needs a restart.';
const FIRST_PRINTABLE_CODE = 0x20;
const LAST_PRINTABLE_CODE = 0x7e;

const configurationFailure = (error) => {
  const envelope = toErrorEnvelope(error, { usageGuidance: MCP_USAGE_GUIDANCE });
  return cliError(
    envelope.error.code,
    envelope.error.message,
    `${envelope.agent_guidance}${CONFIGURATION_NOTE}`,
    envelope.error.details,
  );
};

const isPrintableAscii = (character) => {
  const code = character.codePointAt(0);
  return code >= FIRST_PRINTABLE_CODE && code <= LAST_PRINTABLE_CODE;
};

const boundedText = (value) => {
  if (typeof value !== 'string') return null;
  const text = [...value].filter(isPrintableAscii).join('').trim().slice(0, MAX_IDENTITY_TEXT_CHARS);
  return text === '' ? null : text;
};

const uuidOrNull = (value) => (typeof value === 'string' && UUID_PATTERN.test(value) ? value : null);

const withBudget = async (promise, budgetMs) => {
  let timer;
  const expired = new Promise((resolve) => {
    timer = setTimeout(resolve, budgetMs);
  });
  try {
    await Promise.race([promise, expired]);
  } finally {
    clearTimeout(timer);
  }
};

const toolNamesOf = (selection) => selection.tools.map((spec) => spec.id).join('\n');

const isKeyRejection = (envelope) => envelope?.ok === false && KEY_REJECTED_CODES.includes(envelope.error?.code);

export const createSession = ({
  registry,
  options,
  env = process.env,
  readConfig = loadConfig,
  timeouts = {},
  now = Date.now,
  onToolsChanged = () => {},
  throttle = createRequestThrottle(),
}) => {
  const startupBudgetMs = timeouts.startupResolveMs ?? MCP_STARTUP_RESOLVE_TIMEOUT_MS;
  const retryIntervalMs = timeouts.identityRetryIntervalMs ?? MCP_IDENTITY_RETRY_INTERVAL_MS;
  const activeRequests = new Set();
  const state = {
    resolved: null,
    contextError: null,
    identity: { status: IdentityStatus.IDLE },
    identityEpoch: 0,
    pending: null,
    selection: null,
    keyRejected: false,
    lastRetryAt: null,
    closed: false,
  };

  const failure = () => options.startupError ?? state.contextError;

  const knownEntitlements = () =>
    state.identity.status === IdentityStatus.OK && state.identity.hasEntitlements
      ? state.identity.entitlements
      : undefined;

  const refreshSelection = () => {
    const previous = state.selection === null ? null : toolNamesOf(state.selection);
    state.selection = selectTools({
      specs: registry.commands,
      entitlements: knownEntitlements(),
      override: options.override,
      readOnly: options.readOnly,
    });
    if (previous !== null && previous !== toolNamesOf(state.selection)) onToolsChanged();
  };

  const setIdentity = (identity) => {
    state.identity = identity;
    state.identityEpoch += 1;
    refreshSelection();
  };

  const resolve = async () => {
    const previousKey = state.resolved?.apiKey;
    try {
      state.resolved = resolveContext({
        flags: { profile: options.profile },
        env,
        config: await readConfig(),
        customBaseUrlFromStoredProfileOnly: true,
        revealLocalDetails: false,
      });
      state.contextError = null;
    } catch (error) {
      state.resolved = null;
      state.contextError = configurationFailure(error);
    }
    state.keyRejected = false;
    if (state.resolved?.apiKey !== previousKey) {
      state.pending = null;
      state.lastRetryAt = null;
      setIdentity({ status: IdentityStatus.IDLE });
    }
  };

  const openContext = ({ signal } = {}) => {
    const controller = new AbortController();
    const forward = () => controller.abort(signal.reason);
    if (state.closed) controller.abort();
    else if (signal?.aborted) forward();
    else if (signal) signal.addEventListener('abort', forward, { once: true });
    activeRequests.add(controller);
    const ctx = createCommandContext({
      resolved: state.resolved,
      registry,
      surface: Surface.MCP,
      signal: controller.signal,
      cwd: options.uploadDir,
      uploadDir: options.uploadDir,
      usageGuidance: MCP_USAGE_GUIDANCE,
      timeouts: {
        ...(timeouts.requestTimeoutMs !== undefined ? { requestTimeoutMs: timeouts.requestTimeoutMs } : {}),
        ...(timeouts.longRunningTimeoutMs !== undefined
          ? { longRunningTimeoutMs: timeouts.longRunningTimeoutMs }
          : {}),
      },
    });
    const unthrottledRequest = ctx.request;
    ctx.request = async (request) => {
      await throttle.acquire(controller.signal);
      let response;
      try {
        response = await unthrottledRequest(request);
      } catch (error) {
        if (error?.[RECEIVED_RESPONSE_PROPERTY]) throttle.observe(error[RECEIVED_RESPONSE_PROPERTY]);
        throw error;
      }
      throttle.observe(response);
      return response;
    };
    ctx.http = async (request) => (await ctx.request(request)).result;
    const release = () => {
      activeRequests.delete(controller);
      if (signal) signal.removeEventListener('abort', forward);
    };
    return { ctx, release };
  };

  const applyWhoami = (envelope) => {
    if (envelope?.ok !== true) {
      if (isKeyRejection(envelope)) state.keyRejected = true;
      const keepKnownIdentity = state.identity.status === IdentityStatus.OK && !isKeyRejection(envelope);
      if (!keepKnownIdentity) setIdentity({ status: IdentityStatus.FAILED, error: envelope?.error ?? {} });
      return;
    }
    const data = envelope.data && typeof envelope.data === 'object' ? envelope.data : {};
    setIdentity({
      status: IdentityStatus.OK,
      organizationId: uuidOrNull(data.organization?.id),
      userEmail: boundedText(data.user?.email),
      hasEntitlements: Object.hasOwn(data, ENTITLEMENTS_FIELD),
      entitlements: data[ENTITLEMENTS_FIELD],
    });
  };

  const requestIdentity = () => {
    if (state.pending) return state.pending;
    const startedEpoch = state.identityEpoch;
    const { ctx, release } = openContext();
    const applyIfCurrent = (envelope) => {
      if (state.identityEpoch === startedEpoch && !state.closed) applyWhoami(envelope);
    };
    const lookup = ctx
      .http({ method: 'GET', path: WHOAMI_PATH })
      .then(applyIfCurrent, (error) => applyIfCurrent(toErrorEnvelope(error)))
      .finally(() => {
        release();
        if (state.pending === lookup) state.pending = null;
      });
    state.pending = lookup;
    return lookup;
  };

  const canIdentify = () => failure() === null && Boolean(state.resolved?.apiKey);

  const refreshIdentity = () => {
    if (!canIdentify() || state.closed) return;
    if (state.pending === null) {
      requestIdentity();
      return;
    }
    state.pending.then(refreshIdentity).catch(() => {});
  };

  const identityIsFinal = () => {
    if (state.identity.status === IdentityStatus.OK) return true;
    if (state.identity.status !== IdentityStatus.FAILED || state.pending) return false;
    return PERMANENT_IDENTITY_ERROR_CODES.includes(state.identity.error?.code);
  };

  const needsResolve = () => state.resolved === null || !state.resolved.apiKey || state.keyRejected;

  const retryIsDue = () => state.lastRetryAt === null || now() - state.lastRetryAt >= retryIntervalMs;

  const start = async () => {
    if (!options.startupError) await resolve();
    refreshSelection();
    if (canIdentify()) await withBudget(requestIdentity(), startupBudgetMs);
  };

  const ensureReady = async () => {
    if (options.startupError) return;
    if (needsResolve()) await resolve();
    if (!canIdentify() || identityIsFinal()) return;
    if (!state.pending) {
      if (!retryIsDue()) return;
      state.lastRetryAt = now();
    }
    await withBudget(requestIdentity(), startupBudgetMs);
  };

  const fallbackReason = () => {
    if (state.selection?.source !== SelectionSource.FALLBACK) return null;
    if (failure()) return FallbackReason.CONFIGURATION;
    if (!state.resolved?.apiKey) return FallbackReason.NO_API_KEY;
    if (state.identity.status === IdentityStatus.OK) return FallbackReason.NO_ENTITLEMENTS;
    if (state.identity.status === IdentityStatus.FAILED) return FallbackReason.LOOKUP_FAILED;
    return FallbackReason.LOOKUP_PENDING;
  };

  return {
    start,
    ensureReady,
    openContext,
    noteWhoami: (envelope) => {
      if (envelope?.ok === true) applyWhoami(envelope);
    },
    noteResult: (envelope) => {
      if (isKeyRejection(envelope)) applyWhoami(envelope);
    },
    refreshIdentity,
    shutdown: () => {
      state.closed = true;
      for (const controller of activeRequests) controller.abort();
    },
    failure,
    selection: () => state.selection,
    identity: () => state.identity,
    fallbackReason,
    whenIdle: () => state.pending ?? Promise.resolve(),
    organization: () => ({
      id: state.identity.organizationId ?? null,
      user_email: state.identity.userEmail ?? null,
      profile: state.resolved?.profile.name ?? null,
      base_url: state.resolved?.baseUrl ?? null,
    }),
  };
};
