import os from 'node:os';
import path from 'node:path';

import { API_KEY_ENV, PROFILE_ENV } from '../../core/constants.js';
import { describeUntrustedValue } from '../../core/config.js';
import { CliErrorCode, codedError, toErrorEnvelope } from '../../core/errors.js';
import { MCP_READ_ONLY_ENV, MCP_TOOLSETS_ENV, MCP_UPLOAD_DIR_ENV, TRUTHY_ENV_VALUES } from './constants.js';
import { ALL_TOOLSETS, parseToolsetOverride } from './toolsets.js';

const OPTION_PREFIX = '--';
const TRUE_TEXT = 'true';
const FALSE_TEXT = 'false';

const VALUE_OPTIONS = Object.freeze({ toolsets: 'toolsets', profile: 'profile', 'upload-dir': 'uploadDir' });
const FLAG_OPTIONS = Object.freeze({ 'read-only': 'readOnly' });
const CLI_ONLY_OPTIONS = Object.freeze(['api-key', 'base-url', 'allow-custom-base-url']);

const STARTUP_GUIDANCE =
  'The Outrank MCP server was started with an invalid command line. Tell the human to fix the server entry in ' +
  'their MCP client configuration (accepted options: --toolsets <names|all|auto>, --read-only, --profile <name>, ' +
  '--upload-dir <directory>) and restart the server.';
const CLI_ONLY_GUIDANCE =
  `The MCP server never takes credentials or a base URL on its command line. Set ${API_KEY_ENV} in the server's ` +
  `environment, or store a profile with \`outrank-cli auth login\` and select it with --profile or ${PROFILE_ENV}.`;

const startupError = (message, guidance = STARTUP_GUIDANCE) =>
  codedError(CliErrorCode.INVALID_USAGE, message, guidance);

const hasOwn = (table, key) => Object.hasOwn(table, key);

const parseFlagValue = (option, value) => {
  if (value === TRUE_TEXT) return true;
  if (value === FALSE_TEXT) return false;
  throw startupError(`--${option} accepts only true or false.`);
};

const parseArgv = (argv) => {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith(OPTION_PREFIX)) {
      throw startupError(`Unexpected argument: ${describeUntrustedValue(token)}.`);
    }
    const equalsIndex = token.indexOf('=');
    const option = token.slice(OPTION_PREFIX.length, equalsIndex >= 0 ? equalsIndex : token.length);
    const inlineValue = equalsIndex >= 0 ? token.slice(equalsIndex + 1) : undefined;
    if (CLI_ONLY_OPTIONS.includes(option)) {
      throw startupError(`--${option} is not accepted by the MCP server.`, CLI_ONLY_GUIDANCE);
    }
    if (hasOwn(FLAG_OPTIONS, option)) {
      values[FLAG_OPTIONS[option]] = inlineValue === undefined ? true : parseFlagValue(option, inlineValue);
      continue;
    }
    if (!hasOwn(VALUE_OPTIONS, option)) {
      throw startupError(`Unknown option: ${describeUntrustedValue(token)}.`);
    }
    const field = VALUE_OPTIONS[option];
    if (hasOwn(values, field)) throw startupError(`--${option} was given more than once.`);
    const next = inlineValue ?? argv[index + 1];
    if (next === undefined || next === '' || (inlineValue === undefined && next.startsWith(OPTION_PREFIX))) {
      throw startupError(`Missing value for --${option}.`);
    }
    values[field] = next;
    if (inlineValue === undefined) index += 1;
  }
  return values;
};

const isSet = (value) => typeof value === 'string' && value.trim() !== '';

const TOOLSETS_GUIDANCE =
  `Toolsets are: ${ALL_TOOLSETS.join(', ')}. Use a comma-separated list of them, or all, or auto on its own. ` +
  `Tell the human to fix --toolsets (or ${MCP_TOOLSETS_ENV}) in the server entry and restart the server.`;

const assertValidOverride = (override) => {
  if (override.unknown.length > 0) {
    const names = override.unknown.map(describeUntrustedValue).join(', ');
    throw startupError(`Unknown toolset: ${names}.`, TOOLSETS_GUIDANCE);
  }
  if (override.mixesKeyword) {
    throw startupError('auto and all cannot be combined with other toolset names.', TOOLSETS_GUIDANCE);
  }
};

const BROAD_UPLOAD_DIR_REASON = Object.freeze({
  ROOT: 'it is a filesystem root',
  HOME: 'it is the home directory',
});

export const describeBroadUploadDir = (uploadDir, homeDir = os.homedir()) => {
  if (path.parse(uploadDir).root === uploadDir) return BROAD_UPLOAD_DIR_REASON.ROOT;
  if (path.relative(path.resolve(homeDir), uploadDir) === '') return BROAD_UPLOAD_DIR_REASON.HOME;
  return null;
};

export const resolveMcpOptions = ({ argv = [], env = {}, cwd, homeDir }) => {
  let values = {};
  let failure = null;
  let override = parseToolsetOverride();
  try {
    values = parseArgv(argv);
    const requested = parseToolsetOverride(values.toolsets ?? env[MCP_TOOLSETS_ENV]);
    assertValidOverride(requested);
    override = requested;
  } catch (error) {
    failure = toErrorEnvelope(error);
  }
  const requestedDir = values.uploadDir ?? (isSet(env[MCP_UPLOAD_DIR_ENV]) ? env[MCP_UPLOAD_DIR_ENV] : cwd);
  const uploadDir = path.resolve(cwd, requestedDir);
  return {
    profile: values.profile,
    override,
    readOnly: values.readOnly ?? TRUTHY_ENV_VALUES.includes(env[MCP_READ_ONLY_ENV]),
    uploadDir,
    uploadDirProblem: describeBroadUploadDir(uploadDir, homeDir),
    startupError: failure,
  };
};
