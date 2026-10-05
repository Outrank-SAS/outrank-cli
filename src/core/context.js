import {
  ALLOWED_BASE_URL_HOSTS,
  ALLOW_CUSTOM_BASE_URL_ENV,
  API_KEY_ENV,
  BASE_URL_ENV,
  DEFAULT_BASE_URL,
  LOOPBACK_HOSTNAMES,
  PROFILE_ENV,
  ProfileSource,
  Surface,
} from './constants.js';
import { CliErrorCode, codedError } from './errors.js';
import {
  describeUntrustedValue,
  getConfigPath,
  isSet,
  isValidProfileName,
  loadConfig,
  readProfiles,
} from './config.js';
import { requestAgentApi } from './http.js';
import { profileSelectedByEnvHint } from './profileSelection.js';

export { ProfileSource, Surface };

export const ContextSource = Object.freeze({
  FLAG: 'flag',
  ENV: 'env',
  PROFILE: 'profile',
  DEFAULT: 'default',
  MISSING: 'missing',
});

const TRUTHY_ENV_VALUES = new Set(['1', 'true', 'yes']);
const HTTPS_PROTOCOL = 'https:';
const HTTP_PROTOCOL = 'http:';
const CLI_BINARY = 'outrank-cli';
const PROFILE_FLAG = '--profile';

const pickFirst = (candidates) => candidates.find(([, value]) => isSet(value)) ?? [ContextSource.MISSING, undefined];

const baseUrlGuidance =
  'Pass a full https origin such as https://www.outrank.so via --base-url or OUTRANK_BASE_URL, or remove the ' +
  'override to use the default.';

const allowlistGuidance = (host) =>
  `Only ${ALLOWED_BASE_URL_HOSTS.join(', ')} are accepted by default. If ${host} is a deployment you control, set ` +
  `${ALLOW_CUSTOM_BASE_URL_ENV}=1 or pass --allow-custom-base-url. Never point a real API key at an unknown host.`;

const cleartextGuidance =
  'The API key travels in the Authorization header, so only https is accepted. Plain http is allowed only for ' +
  `loopback hosts (${LOOPBACK_HOSTNAMES.join(', ')}) together with ${ALLOW_CUSTOM_BASE_URL_ENV}=1.`;

const storedProfileOnlyGuidance = (host) =>
  `This server sends the API key to ${ALLOWED_BASE_URL_HOSTS.join(' or ')} only, unless both the key and the base ` +
  `URL come from the same stored profile. If ${host} is a deployment you control, run ` +
  '`outrank-cli auth login <api-key> --profile <name> --base-url <url> --allow-custom-base-url` in a terminal, ' +
  'then start the server with `--profile <name>`. Environment variables cannot unlock a custom host here.';

const profileNameGuidance =
  'Profile names start with a letter or digit and may contain letters, digits, dots, dashes and underscores.';

const describeProfileSource = (source) => (source === ProfileSource.ENV ? PROFILE_ENV : PROFILE_FLAG);

const HIDDEN_PROFILES_NOTE = 'Run `outrank-cli auth profiles` in a terminal to see the stored profiles.';

const describeStoredProfiles = (profiles, revealLocalDetails) => {
  if (!revealLocalDetails) return HIDDEN_PROFILES_NOTE;
  const names = Object.keys(profiles).sort();
  return names.length === 0
    ? 'No profiles are stored yet.'
    : `Stored profiles: ${names.join(', ')}. Run \`outrank-cli auth profiles\` to inspect them.`;
};

const unknownProfileGuidance = (profiles, source, revealLocalDetails) => {
  const stored = describeStoredProfiles(profiles, revealLocalDetails);
  return (
    `${stored} Run \`outrank-cli auth login <api-key> --profile <name>\` to create a new one.` +
    profileSelectedByEnvHint(source)
  );
};

const configFileReference = (revealLocalDetails) =>
  revealLocalDetails
    ? 'the config file at details.config_path'
    : 'the outrank-cli config file (run `outrank-cli auth status` in a terminal to see its path)';

const storedBaseUrlGuidance = (profile, revealLocalDetails) =>
  `Edit the baseUrl of profile ${profile} in ${configFileReference(revealLocalDetails)}, run ` +
  `\`outrank-cli auth login <api-key> --profile ${profile} --base-url <url>\` to replace it, or pass --base-url ` +
  'for this call. `auth status`, `auth profiles` and `auth logout` keep working with the broken value.';

const emptyFlagError = (flag) =>
  codedError(
    CliErrorCode.INVALID_USAGE,
    `${flag} was given without a value.`,
    `Pass a value after ${flag}, or drop the option to fall back to the environment or the stored config.`,
  );

const invalidBaseUrlError = (shown) =>
  codedError(CliErrorCode.INVALID_USAGE, `Invalid base URL: ${shown}`, baseUrlGuidance);

export const normalizeBaseUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw invalidBaseUrlError(describeUntrustedValue(value));
  }
  if (url.protocol !== HTTPS_PROTOCOL && url.protocol !== HTTP_PROTOCOL) {
    throw invalidBaseUrlError(JSON.stringify(`${url.protocol}//${url.host}`));
  }
  return url.origin;
};

const assertAllowedBaseUrl = (baseUrl, allowCustomBaseUrl, guidanceFor = allowlistGuidance) => {
  const url = new URL(baseUrl);
  const loopback = LOOPBACK_HOSTNAMES.includes(url.hostname) || LOOPBACK_HOSTNAMES.includes(`[${url.hostname}]`);
  if (url.protocol === HTTP_PROTOCOL && !(loopback && allowCustomBaseUrl)) {
    throw codedError(CliErrorCode.INVALID_USAGE, `Base URL ${baseUrl} is not https.`, cleartextGuidance);
  }
  if (allowCustomBaseUrl || ALLOWED_BASE_URL_HOSTS.includes(url.host)) return;
  throw codedError(
    CliErrorCode.INVALID_USAGE,
    `Base URL host ${url.host} is not allowed.`,
    guidanceFor(url.host),
  );
};

const assertFlagsHaveValues = (flags) => {
  if (flags.apiKey === '') throw emptyFlagError('--api-key');
  if (flags.baseUrl === '') throw emptyFlagError('--base-url');
  if (flags.profile === '') throw emptyFlagError('--profile');
};

const selectProfile = ({ flags, env, state, allowUnknownProfile, revealLocalDetails }) => {
  const [source, name] = pickFirst([
    [ProfileSource.FLAG, flags.profile],
    [ProfileSource.ENV, env[PROFILE_ENV]],
    [ProfileSource.DEFAULT, state.defaultProfile],
  ]);
  if (!isValidProfileName(name)) {
    throw codedError(
      CliErrorCode.INVALID_USAGE,
      `Invalid profile name ${describeUntrustedValue(name)} (from ${describeProfileSource(source)}).`,
      profileNameGuidance,
    );
  }
  const explicit = source !== ProfileSource.DEFAULT;
  const known = Object.hasOwn(state.profiles, name);
  if (explicit && !known && !allowUnknownProfile) {
    throw codedError(
      CliErrorCode.INVALID_USAGE,
      `Unknown profile: ${name} (from ${describeProfileSource(source)}).`,
      unknownProfileGuidance(state.profiles, source, revealLocalDetails),
    );
  }
  return { name, source, explicit, known, values: known ? state.profiles[name] : {} };
};

const normalizeResolvedBaseUrl = ({ value, source, profileName, tolerateStored, revealLocalDetails }) => {
  try {
    return normalizeBaseUrl(value);
  } catch (error) {
    if (source !== ContextSource.PROFILE) throw error;
    if (tolerateStored) return null;
    throw codedError(
      CliErrorCode.INVALID_USAGE,
      `Invalid base URL stored in profile ${profileName}.`,
      storedBaseUrlGuidance(profileName, revealLocalDetails),
      { config_path: getConfigPath() },
    );
  }
};

export const resolveContext = ({
  flags = {},
  env = {},
  config = {},
  enforceAllowlist = true,
  allowUnknownProfile = false,
  customBaseUrlFromStoredProfileOnly = false,
  revealLocalDetails = true,
} = {}) => {
  assertFlagsHaveValues(flags);
  const profile = selectProfile({
    flags,
    env,
    state: readProfiles(config),
    allowUnknownProfile,
    revealLocalDetails,
  });
  const envApiKey = profile.explicit ? undefined : env[API_KEY_ENV];
  const envBaseUrl = profile.explicit ? undefined : env[BASE_URL_ENV];
  const [apiKeySource, apiKey] = pickFirst([
    [ContextSource.FLAG, flags.apiKey],
    [ContextSource.ENV, envApiKey],
    [ContextSource.PROFILE, profile.values.apiKey],
  ]);
  const [baseUrlSource, rawBaseUrl] = pickFirst([
    [ContextSource.FLAG, flags.baseUrl],
    [ContextSource.ENV, envBaseUrl],
    [ContextSource.PROFILE, profile.values.baseUrl],
    [ContextSource.DEFAULT, DEFAULT_BASE_URL],
  ]);
  const storedPair = apiKeySource === ContextSource.PROFILE && baseUrlSource === ContextSource.PROFILE;
  const requestedCustomBaseUrl =
    typeof flags.allowCustomBaseUrl === 'boolean'
      ? flags.allowCustomBaseUrl
      : TRUTHY_ENV_VALUES.has(env[ALLOW_CUSTOM_BASE_URL_ENV]);
  const allowCustomBaseUrl = customBaseUrlFromStoredProfileOnly ? storedPair : requestedCustomBaseUrl;
  const baseUrl = normalizeResolvedBaseUrl({
    value: rawBaseUrl,
    source: baseUrlSource,
    profileName: profile.name,
    tolerateStored: !enforceAllowlist,
    revealLocalDetails,
  });
  if (enforceAllowlist && baseUrlSource !== ContextSource.DEFAULT) {
    const guidanceFor = customBaseUrlFromStoredProfileOnly ? storedProfileOnlyGuidance : allowlistGuidance;
    assertAllowedBaseUrl(baseUrl, allowCustomBaseUrl, guidanceFor);
  }

  return {
    apiKey,
    baseUrl,
    storedBaseUrl: profile.values.baseUrl,
    profile: { name: profile.name, source: profile.source, explicit: profile.explicit, known: profile.known },
    source: {
      apiKey: apiKeySource,
      baseUrl: baseUrlSource,
      envIgnored: apiKeySource !== ContextSource.ENV && isSet(env[API_KEY_ENV]),
      baseUrlEnvIgnored: baseUrlSource !== ContextSource.ENV && isSet(env[BASE_URL_ENV]),
    },
  };
};

export const loadContext = async (
  flags = {},
  { enforceAllowlist = true, allowUnknownProfile = false, customBaseUrlFromStoredProfileOnly = false } = {},
) =>
  resolveContext({
    flags,
    env: process.env,
    config: await loadConfig(),
    enforceAllowlist,
    allowUnknownProfile,
    customBaseUrlFromStoredProfileOnly,
  });

const renderCliReference = (spec, args) => {
  const words = spec.id.split('.');
  const positionals = (spec.cli?.positionals ?? []).map((field) => args[field]).filter((value) => value !== undefined);
  const optionNames = Object.fromEntries(
    Object.entries(spec.cli?.options ?? {}).map(([option, entry]) => [
      typeof entry === 'string' ? entry : entry.field,
      option,
    ]),
  );
  const options = Object.entries(args)
    .filter(([field, value]) => value !== undefined && !(spec.cli?.positionals ?? []).includes(field))
    .map(([field, value]) => {
      const option = optionNames[field] ?? field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      return value === true ? `--${option}` : `--${option} ${value}`;
    });
  return [CLI_BINARY, ...words, ...positionals, ...options].join(' ');
};

const toSnakeCase = (name) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const renderMcpReference = (spec, args) => {
  const toolName = spec.id.replaceAll('.', '_').replaceAll('-', '_');
  const entries = Object.entries(args).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return toolName;
  const toolArgs = Object.fromEntries(entries.map(([field, value]) => [toSnakeCase(field), value]));
  return `${toolName} ${JSON.stringify(toolArgs)}`;
};

export const createCommandContext = ({
  resolved,
  registry,
  surface,
  signal,
  cwd,
  uploadDir,
  usageGuidance,
  timeouts = {},
}) => {
  const ctx = {
    surface,
    apiKey: resolved.apiKey,
    baseUrl: resolved.baseUrl,
    storedBaseUrl: resolved.storedBaseUrl,
    profile: resolved.profile,
    source: resolved.source,
    signal,
    cwd,
    uploadDir,
    usageGuidance,
    longRunning: false,
    ...timeouts,
    request: (request) => requestAgentApi(ctx, request),
    http: async (request) => (await requestAgentApi(ctx, request)).result,
    ref: (id, args = {}) => {
      const spec = registry.byId.get(id);
      if (!spec) throw new Error(`ctx.ref: unknown command id ${id}`);
      return surface === Surface.MCP ? renderMcpReference(spec, args) : renderCliReference(spec, args);
    },
  };
  return ctx;
};
