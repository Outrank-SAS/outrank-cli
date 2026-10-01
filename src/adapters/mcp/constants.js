export const MCP_SERVER_NAME = 'outrank';
export const MCP_COMMAND = 'mcp';

export const MCP_TOOLSETS_ENV = 'OUTRANK_MCP_TOOLSETS';
export const MCP_READ_ONLY_ENV = 'OUTRANK_MCP_READ_ONLY';
export const MCP_UPLOAD_DIR_ENV = 'OUTRANK_MCP_UPLOAD_DIR';
export const MCP_DEBUG_ENV = 'OUTRANK_MCP_DEBUG';
export const TRUTHY_ENV_VALUES = Object.freeze(['1', 'true', 'yes']);

export const MCP_PROGRESS_INTERVAL_MS = 10_000;
export const MAX_INSTRUCTIONS_CHARS = 2_000;
export const MAX_TOOL_DESCRIPTION_CHARS = 1_000;
export const MILLISECONDS_PER_SECOND = 1_000;
export const MAX_LOGGED_STRING_CHARS = 200;
export const MAX_LOGGED_DEPTH = 8;
export const MAX_IDENTITY_TEXT_CHARS = 100;
export const MCP_IDENTITY_RETRY_INTERVAL_MS = 30_000;

export const TOOLSETS_AUTO = 'auto';
export const TOOLSETS_ALL = 'all';
export const TOOLSETS_SEPARATOR = ',';

export const EntitlementMode = Object.freeze({ FULL: 'full', READ: 'read' });

export const SelectionSource = Object.freeze({
  OVERRIDE: 'override',
  ALL: 'all',
  ENTITLEMENTS: 'entitlements',
  UNRESTRICTED: 'unrestricted',
  FALLBACK: 'fallback',
});

export const IdentityStatus = Object.freeze({
  IDLE: 'idle',
  OK: 'ok',
  FAILED: 'failed',
});

export const FallbackReason = Object.freeze({
  CONFIGURATION: 'configuration',
  NO_API_KEY: 'no_api_key',
  LOOKUP_PENDING: 'lookup_pending',
  LOOKUP_FAILED: 'lookup_failed',
  NO_ENTITLEMENTS: 'no_entitlements',
});

export const PROGRESS_NOTIFICATION_METHOD = 'notifications/progress';
export const WHOAMI_COMMAND_ID = 'auth.whoami';
export const DASHBOARD_SUBSCRIPTION_PATH = '/dashboard/subscription';
