import { BODY_INPUT_NAME } from '../../commands/registry.js';
import { REDACTED, redactBody } from '../../core/redact.js';
import { MAX_LOGGED_DEPTH, MAX_LOGGED_STRING_CHARS, MCP_SERVER_NAME } from './constants.js';

const LOG_PREFIX = `[${MCP_SERVER_NAME}-mcp]`;

const writeToStderr = (line) => {
  process.stderr.write(line);
};

const hasSensitiveBody = (spec) =>
  Boolean(spec?.mcp) && typeof spec.mcp === 'object' && spec.mcp.sensitiveBody === true;

const clipStrings = (value) => {
  if (typeof value === 'string') {
    if (value.length <= MAX_LOGGED_STRING_CHARS) return value;
    return `${value.slice(0, MAX_LOGGED_STRING_CHARS)}… (${value.length} chars)`;
  }
  if (Array.isArray(value)) return value.map(clipStrings);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clipStrings(entry)]));
  }
  return value;
};

export const redactToolArguments = (spec, args) => {
  const redacted = clipStrings(redactBody(args ?? {}, MAX_LOGGED_DEPTH));
  if (hasSensitiveBody(spec) && Object.hasOwn(redacted, BODY_INPUT_NAME)) {
    return { ...redacted, [BODY_INPUT_NAME]: REDACTED };
  }
  return redacted;
};

export const createLogger = ({ enabled = false, write = writeToStderr } = {}) => {
  const emit = (event, fields) => {
    write(`${LOG_PREFIX} ${JSON.stringify({ event, ...fields })}\n`);
  };
  return {
    enabled,
    always: emit,
    debug: (event, fields) => {
      if (enabled) emit(event, fields);
    },
  };
};
