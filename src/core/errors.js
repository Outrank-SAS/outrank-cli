import { redactSecrets } from './redact.js';

export const CliErrorCode = Object.freeze({
  AUTH_REQUIRED: 'CLI_AUTH_REQUIRED',
  NETWORK_ERROR: 'CLI_NETWORK_ERROR',
  NON_JSON_RESPONSE: 'CLI_NON_JSON_RESPONSE',
  UPSTREAM_ERROR: 'CLI_UPSTREAM_ERROR',
  INVALID_USAGE: 'CLI_INVALID_USAGE',
  UNEXPECTED_ERROR: 'CLI_UNEXPECTED_ERROR',
  OPERATION_MAY_STILL_BE_RUNNING: 'CLI_OPERATION_MAY_STILL_BE_RUNNING',
  CONFIG_UNREADABLE: 'CLI_CONFIG_UNREADABLE',
  CONFIG_UNWRITABLE: 'CLI_CONFIG_UNWRITABLE',
});

export const USAGE_GUIDANCE =
  'Run the current command again with --help to see the required arguments and input format.';
export const MCP_USAGE_GUIDANCE = 'Check the tool description and input schema, then call the tool again.';
export const UNEXPECTED_ERROR_GUIDANCE =
  'Retry with --help for usage details. If the command and inputs look correct, inspect the error details and ' +
  'try again.';
export const UNEXPECTED_ERROR_MESSAGE = 'Unexpected CLI failure.';

export const cliError = (code, message, guidance, details) => ({
  ok: false,
  error: {
    code,
    message,
    ...(details ? { details } : {}),
  },
  agent_guidance: guidance,
});

export const cliSuccess = (data, guidance) => ({
  ok: true,
  data,
  agent_guidance: guidance,
});

export const codedError = (code, message, guidance, details) =>
  Object.assign(new Error(message), { cliCode: code, guidance, ...(details ? { details } : {}) });

export const usageError = (message, guidance = USAGE_GUIDANCE) =>
  codedError(CliErrorCode.INVALID_USAGE, message, guidance);

export const isEnvelope = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && typeof value.ok === 'boolean';

export const toErrorEnvelope = (error, { usageGuidance = USAGE_GUIDANCE } = {}) => {
  const message = error?.message || UNEXPECTED_ERROR_MESSAGE;
  const code = error?.cliCode || CliErrorCode.UNEXPECTED_ERROR;
  const rawGuidance = error?.guidance || UNEXPECTED_ERROR_GUIDANCE;
  const guidance = rawGuidance === USAGE_GUIDANCE ? usageGuidance : rawGuidance;
  return cliError(code, redactSecrets(message), redactSecrets(guidance), error?.details);
};
