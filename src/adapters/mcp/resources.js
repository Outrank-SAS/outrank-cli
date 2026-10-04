import { CliErrorCode, codedError } from '../../core/errors.js';
import { EntitlementMode, IdentityStatus } from './constants.js';

export const WHOAMI_RESOURCE_URI = 'outrank://whoami';
const WHOAMI_RESOURCE_NAME = 'whoami';
const JSON_MIME_TYPE = 'application/json';
const JSON_INDENT = 2;
const MAX_URI_CHARS = 200;
const WHOAMI_RESOURCE_DESCRIPTION =
  'The organization this server works on, what the server knows about its entitlements, and which toolsets are ' +
  'listed. Read it instead of calling auth_whoami when the question is only "who am I connected as".';

const toolsetsIn = (selection, mode) =>
  Object.entries(selection.enabled)
    .filter(([, toolsetMode]) => toolsetMode === mode)
    .map(([toolset]) => toolset);

const MAX_ERROR_TEXT_CHARS = 500;

const boundedError = (error) => {
  if (!error || typeof error !== 'object') return null;
  const code = typeof error.code === 'string' ? error.code.slice(0, MAX_ERROR_TEXT_CHARS) : null;
  const message = typeof error.message === 'string' ? error.message.slice(0, MAX_ERROR_TEXT_CHARS) : null;
  return { code, message };
};

export const buildWhoamiResource = (session) => {
  const identity = session.identity();
  const selection = session.selection();
  const failure = session.failure();
  return {
    organization: session.organization(),
    identity: {
      status: identity.status,
      ...(identity.status === IdentityStatus.OK ? { entitlements: identity.entitlements ?? null } : {}),
      ...(identity.status === IdentityStatus.FAILED ? { error: boundedError(identity.error) } : {}),
    },
    configuration_error: failure ? boundedError(failure.error) : null,
    toolsets: {
      source: selection.source,
      fallback_reason: session.fallbackReason(),
      read_only: selection.readOnly,
      full: toolsetsIn(selection, EntitlementMode.FULL),
      read: toolsetsIn(selection, EntitlementMode.READ),
      off: selection.disabledToolsets,
    },
    tool_count: selection.tools.length,
  };
};

export const listResources = () => [
  {
    uri: WHOAMI_RESOURCE_URI,
    name: WHOAMI_RESOURCE_NAME,
    description: WHOAMI_RESOURCE_DESCRIPTION,
    mimeType: JSON_MIME_TYPE,
  },
];

const UNKNOWN_RESOURCE_GUIDANCE = `The only resource is ${WHOAMI_RESOURCE_URI}.`;

export const readResource = (session, uri) => {
  if (uri !== WHOAMI_RESOURCE_URI) {
    const shown = String(uri).slice(0, MAX_URI_CHARS);
    throw codedError(CliErrorCode.INVALID_USAGE, `Unknown resource: ${shown}.`, UNKNOWN_RESOURCE_GUIDANCE);
  }
  const text = JSON.stringify(buildWhoamiResource(session), null, JSON_INDENT);
  return { contents: [{ uri: WHOAMI_RESOURCE_URI, mimeType: JSON_MIME_TYPE, text }] };
};
