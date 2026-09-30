import { PROFILE_ENV } from '../core/constants.js';
import {
  API_KEY_FIELD,
  BASE_URL_FIELD,
  clearProfileAuth,
  getConfigPath,
  loadProfiles,
  redactApiKey,
  storeProfileAuth,
} from '../core/config.js';
import { ContextSource, Surface, normalizeBaseUrl } from '../core/context.js';
import { cliSuccess, usageError } from '../core/errors.js';
import { assertHeaderSafeApiKey, requestAgentApi } from '../core/http.js';
import { profileSelectedByEnvHint } from '../core/profileSelection.js';
import { bool, string } from '../core/schema.js';
import { CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';

export const AUTH_HELP = `Usage:
  outrank-cli auth login <api-key> [--profile <name>] [--default] [--base-url <url>] [--no-verify]
  outrank-cli auth whoami
  outrank-cli auth status
  outrank-cli auth profiles
  outrank-cli auth logout [--profile <name>]

Commands:
  login     Store an API key in a profile (the default profile unless --profile is given) and optionally verify it.
  whoami    Verify auth and return the current user and organization details.
  status    Show the resolved profile, where its key and base URL came from, and the config path.
  profiles  List stored profiles with redacted keys and mark the default one.
  logout    Remove the stored API key from a profile.

Notes:
  Precedence: --api-key and --base-url win; then a profile selected with --profile or OUTRANK_PROFILE
  (a selected profile ignores OUTRANK_API_KEY and OUTRANK_BASE_URL); then OUTRANK_API_KEY and
  OUTRANK_BASE_URL; then the default profile from local config.
  login verifies against and stores the resolved base URL: --base-url, else OUTRANK_BASE_URL (ignored when
  a profile is selected), else the profile's stored value, else the default.
  Optional config-dir override: OUTRANK_CONFIG_DIR
  Local config path: ~/.outrank/config.json
`;

const WHOAMI_PATH = '/auth/whoami';
const CONFIG_PATH_FIELD = 'config_path';
const ENV_IGNORED_SUFFIX = ' (env ignored)';
const LOGIN_MISSING_KEY_GUIDANCE = 'Run `outrank-cli auth login <api-key>` or pass `--api-key <api-key>`, then retry.';
const LOGIN_SAVED_GUIDANCE =
  'Credentials saved. Run `outrank-cli auth whoami` to confirm the active workspace at any time.';
const loginSavedToProfileGuidance = (profile) =>
  `Credentials saved to profile ${profile}, which is not the default. Pass --profile ${profile} or set ` +
  `${PROFILE_ENV}=${profile} to use it, or re-run login with --default to make it the default.`;
const STATUS_GUIDANCE =
  'Confirm this target before running live commands. If you use a non-default Outrank deployment, set ' +
  '`OUTRANK_BASE_URL` first.';
const STATUS_UNKNOWN_PROFILE_GUIDANCE =
  'The selected profile is not stored. Run `outrank-cli auth profiles` to see the stored profiles, or ' +
  '`outrank-cli auth login <api-key> --profile <name>` to create it.';
const STATUS_UNKNOWN_PROFILE_WITH_KEY_GUIDANCE =
  'The selected profile is not stored; the key in use comes from --api-key, not from a profile. Run ' +
  '`outrank-cli auth login <api-key> --profile <name>` to store it.';
const statusInvalidStoredBaseUrlGuidance = (profile) =>
  `The base URL stored in profile ${profile} is not a valid URL, so authenticated commands will fail. Edit it in ` +
  `the config file, or run \`outrank-cli auth login <api-key> --profile ${profile} --base-url <url>\` to replace it.`;
const LOGIN_BASE_URL_FROM_ENV_NOTE =
  ' The base URL came from OUTRANK_BASE_URL and is now stored in the profile; unset the variable if that was not ' +
  'intended and run login again with --base-url.';

const statusGuidance = (ctx) => {
  if (ctx.profile.explicit && !ctx.profile.known) {
    const base = ctx.apiKey ? STATUS_UNKNOWN_PROFILE_WITH_KEY_GUIDANCE : STATUS_UNKNOWN_PROFILE_GUIDANCE;
    return base + profileSelectedByEnvHint(ctx.profile.source);
  }
  if (ctx.baseUrl === null) {
    return statusInvalidStoredBaseUrlGuidance(ctx.profile.name) + profileSelectedByEnvHint(ctx.profile.source);
  }
  return STATUS_GUIDANCE;
};

const describeStoredBaseUrl = (value) => {
  if (value === undefined) return { base_url: null, base_url_valid: true };
  try {
    return { base_url: normalizeBaseUrl(value), base_url_valid: true };
  } catch {
    return { base_url: null, base_url_valid: false };
  }
};
const LOGOUT_GUIDANCE =
  'Stored API key removed. Any future authenticated call now requires OUTRANK_API_KEY or a fresh `auth login`.';
const logoutProfileGuidance = (profile) =>
  `Stored API key removed from profile ${profile}. Other profiles are untouched; run ` +
  `\`outrank-cli auth login <api-key> --profile ${profile}\` to store a new key.`;
const logoutNothingStoredGuidance = (profile) =>
  `Profile ${profile} had no stored API key, so nothing changed. Run \`outrank-cli auth profiles\` to see ` +
  'which profiles hold keys.';
const PROFILES_EMPTY_GUIDANCE =
  'No profiles are stored. Run `outrank-cli auth login <api-key>` (optionally with --profile <name>) to create one.';
const PROFILES_GUIDANCE =
  'Select a profile per call with --profile <name> or per shell with OUTRANK_PROFILE. A selected profile ignores ' +
  'OUTRANK_API_KEY and OUTRANK_BASE_URL; --api-key and --base-url still win.';

const configPathField = (ctx) => (ctx.surface === Surface.MCP ? {} : { [CONFIG_PATH_FIELD]: getConfigPath() });

const renderSource = (source, envIgnored) => (envIgnored ? `${source}${ENV_IGNORED_SUFFIX}` : source);

const login = defineCommand({
  id: 'auth.login',
  summary: 'Store an API key in a profile and optionally verify it immediately.',
  kind: CommandKind.LOCAL,
  toolsets: [Toolset.CORE],
  mcp: false,
  allowUnknownProfile: true,
  input: { apiKey: string(), noVerify: bool(), makeDefault: bool() },
  cli: {
    positionals: ['apiKey'],
    placeholders: { apiKey: '<api-key>' },
    options: { 'no-verify': 'noVerify', default: 'makeDefault' },
  },
  run: async (input, ctx) => {
    const apiKey = input.apiKey ?? (ctx.source.apiKey === ContextSource.FLAG ? ctx.apiKey : undefined);
    if (!apiKey) throw usageError('Missing API key.', LOGIN_MISSING_KEY_GUIDANCE);
    assertHeaderSafeApiKey(apiKey);
    if (!input.noVerify) {
      const { result } = await requestAgentApi({ ...ctx, apiKey }, { method: 'GET', path: WHOAMI_PATH });
      if (!result.ok) return result;
    }
    const saved = await storeProfileAuth({
      profile: ctx.profile.name,
      apiKey,
      baseUrl: ctx.baseUrl,
      makeDefault: input.makeDefault,
    });
    const envNote = ctx.source.baseUrl === ContextSource.ENV ? LOGIN_BASE_URL_FROM_ENV_NOTE : '';
    return cliSuccess(
      {
        stored: {
          profile: saved.profile,
          is_default: saved.isDefault,
          api_key: true,
          base_url: saved.stored[BASE_URL_FIELD],
          base_url_source: ctx.source.baseUrl,
          [CONFIG_PATH_FIELD]: getConfigPath(),
        },
      },
      (saved.isDefault ? LOGIN_SAVED_GUIDANCE : loginSavedToProfileGuidance(saved.profile)) + envNote,
    );
  },
});

const whoami = defineCommand({
  id: 'auth.whoami',
  summary: 'Verify auth and return the current user and organization details.',
  kind: CommandKind.READ,
  toolsets: [Toolset.CORE],
  run: (_input, ctx) => ctx.http({ method: 'GET', path: WHOAMI_PATH }),
});

const status = defineCommand({
  id: 'auth.status',
  summary: 'Show the resolved profile, auth source and base-url configuration (the key itself is never shown).',
  kind: CommandKind.LOCAL,
  toolsets: [Toolset.CORE],
  mcp: { redact: [CONFIG_PATH_FIELD] },
  offline: true,
  allowUnknownProfile: true,
  run: (_input, ctx) =>
    cliSuccess(
      {
        profile: ctx.profile.name,
        profile_source: ctx.profile.source,
        profile_stored: ctx.profile.known,
        base_url: ctx.baseUrl,
        base_url_valid: ctx.baseUrl !== null,
        api_key_present: Boolean(ctx.apiKey),
        api_key_source: renderSource(ctx.source.apiKey, ctx.source.envIgnored),
        base_url_source: renderSource(ctx.source.baseUrl, ctx.source.baseUrlEnvIgnored),
        ...configPathField(ctx),
      },
      statusGuidance(ctx),
    ),
});

const profiles = defineCommand({
  id: 'auth.profiles',
  summary: 'List stored profiles with redacted keys and mark the default one.',
  kind: CommandKind.LOCAL,
  toolsets: [Toolset.CORE],
  mcp: false,
  offline: true,
  allowUnknownProfile: true,
  run: async (_input, ctx) => {
    const state = await loadProfiles();
    const names = Object.keys(state.profiles).sort();
    return cliSuccess(
      {
        default_profile: state.defaultProfile,
        active_profile: ctx.profile.name,
        active_profile_stored: ctx.profile.known,
        profiles: names.map((name) => ({
          name,
          is_default: name === state.defaultProfile,
          api_key_present: Boolean(state.profiles[name][API_KEY_FIELD]),
          api_key_suffix: redactApiKey(state.profiles[name][API_KEY_FIELD]),
          ...describeStoredBaseUrl(state.profiles[name][BASE_URL_FIELD]),
        })),
        [CONFIG_PATH_FIELD]: getConfigPath(),
      },
      names.length === 0 ? PROFILES_EMPTY_GUIDANCE : PROFILES_GUIDANCE,
    );
  },
});

const logoutGuidance = (ctx, removed) => {
  if (!removed) return logoutNothingStoredGuidance(ctx.profile.name);
  return ctx.profile.explicit ? logoutProfileGuidance(ctx.profile.name) : LOGOUT_GUIDANCE;
};

const logout = defineCommand({
  id: 'auth.logout',
  summary: 'Remove the stored API key from a profile.',
  kind: CommandKind.LOCAL,
  toolsets: [Toolset.CORE],
  mcp: false,
  offline: true,
  run: async (_input, ctx) => {
    const { removed } = await clearProfileAuth({ profile: ctx.profile.name });
    return cliSuccess(
      {
        cleared: removed ? [API_KEY_FIELD] : [],
        profile: ctx.profile.name,
        [CONFIG_PATH_FIELD]: getConfigPath(),
        base_url_still_configured: Boolean(ctx.storedBaseUrl),
      },
      logoutGuidance(ctx, removed),
    );
  },
});

export const authGroup = defineGroup({
  id: 'auth',
  help: { usage: AUTH_HELP, guidance: 'Choose one of: login, whoami, status, profiles, logout.' },
  unknown: (word) => ({
    message: `Unknown auth subcommand: ${word}.`,
    guidance: 'Run `outrank-cli auth --help` to see available auth commands.',
  }),
  children: [login, whoami, status, profiles, logout],
});
