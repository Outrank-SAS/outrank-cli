const BYTES_PER_MB = 1024 * 1024;

export const API_BASE_PATH = '/api/agent/v1';
export const DEFAULT_BASE_URL = 'https://www.outrank.so';
export const ALLOWED_BASE_URL_HOSTS = Object.freeze(['www.outrank.so', 'outrank.so']);
export const LOOPBACK_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1', '[::1]']);
export const ALLOW_CUSTOM_BASE_URL_ENV = 'OUTRANK_ALLOW_CUSTOM_BASE_URL';
export const API_KEY_ENV = 'OUTRANK_API_KEY';
export const BASE_URL_ENV = 'OUTRANK_BASE_URL';
export const PROFILE_ENV = 'OUTRANK_PROFILE';
export const ProfileSource = Object.freeze({
  FLAG: 'flag',
  ENV: 'env',
  DEFAULT: 'default',
});
export const DEFAULT_PROFILE_NAME = 'default';
export const PROFILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const MAX_PROFILE_NAME_LENGTH = 64;
export const API_KEY_SUFFIX_LENGTH = 4;
export const MIN_API_KEY_LENGTH_FOR_SUFFIX = 8;
export const HEADER_SAFE_API_KEY_PATTERN = /^[\x21-\x7e]+$/;

export const HTTP_REQUEST_TIMEOUT_MS = 60_000;
export const HTTP_LONG_RUNNING_TIMEOUT_MS = 330_000;
export const MCP_STARTUP_RESOLVE_TIMEOUT_MS = 3_000;

export const MAX_IMAGE_UPLOAD_BYTES = 5 * BYTES_PER_MB;
export const MAX_UPSTREAM_ERROR_BODY_CHARS = 500;
export const MAX_RATE_LIMIT_HEADER_LENGTH = 64;
export const MAX_TOOL_NAME_LENGTH = 46;

export const LIST_MIN_LIMIT = 1;
export const LIST_MAX_LIMIT = 100;
export const MIN_OFFSET = 0;
export const MIN_SEARCH_VOLUME = 0;
export const MIN_DIFFICULTY = 0;
export const MAX_DIFFICULTY = 100;
export const KEYWORDS_SUGGEST_MAX_LIMIT = 20;
export const IMPROVEMENTS_CANDIDATES_MAX_LIMIT = 50;
export const GSC_MIN_MONTHS = 1;
export const GSC_MAX_MONTHS = 16;
export const GSC_SEARCH_ANALYTICS_MAX_LIMIT = 1000;
export const KEYWORDS_GENERATE_MIN_COUNT = 5;
export const KEYWORDS_GENERATE_MAX_COUNT = 30;

export const BILLING_MIN_ADDITIONAL_PRODUCTS = 1;
export const BILLING_MAX_ADDITIONAL_PRODUCTS = 30;
export const BILLING_MIN_CONFIRM_CHARGE_CENTS = 0;

export const HttpStatus = Object.freeze({
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  BAD_GATEWAY: 502,
  GATEWAY_TIMEOUT: 504,
});
export const HTTP_STATUS_CONFLICT = HttpStatus.CONFLICT;
export const NO_BODY_STATUSES = Object.freeze([HttpStatus.NO_CONTENT, HttpStatus.RESET_CONTENT]);
export const LONG_RUNNING_GATEWAY_STATUSES = Object.freeze([HttpStatus.BAD_GATEWAY, HttpStatus.GATEWAY_TIMEOUT]);

export const JSON_CONTENT_TYPE = 'application/json';
export const CONFIG_FILE_MODE = 0o600;
export const CONFIG_DIR_MODE = 0o700;
export const CONFIG_TEMP_SUFFIX_BYTES = 6;
export const MAX_CONFIG_SYMLINK_HOPS = 8;

export const RESERVED_OPTION_NAMES = Object.freeze([
  'api-key',
  'base-url',
  'allow-custom-base-url',
  'profile',
  'json',
  'json-file',
  'json-stdin',
  'help',
]);

export const RATE_LIMIT_HEADERS = Object.freeze({
  retryAfter: 'retry-after',
  limitMinute: 'x-ratelimit-limit-minute',
  remainingMinute: 'x-ratelimit-remaining-minute',
  limitDay: 'x-ratelimit-limit-day',
  remainingDay: 'x-ratelimit-remaining-day',
});

export const SENSITIVE_BODY_FIELDS = Object.freeze([
  'api_key',
  'apiKey',
  'api_token',
  'access_token',
  'refresh_token',
  'server_api_key',
  'secret',
  'password',
  'token',
  'authorization',
]);
