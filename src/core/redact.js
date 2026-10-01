import { SENSITIVE_BODY_FIELDS } from './constants.js';

export const REDACTED = '<redacted>';
const TOO_DEEP = '<nested too deeply>';
const DEFAULT_MAX_DEPTH = 32;
const API_KEY_PATTERN = /outr_(?:live|test)_[A-Za-z0-9_]+/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;
const SENSITIVE_FIELD_SET = new Set(SENSITIVE_BODY_FIELDS.map((name) => name.toLowerCase()));
const SENSITIVE_KEY_PATTERN = /token|secret|password|passwd|api[_-]?key|authorization|credential|private[_-]?key/i;

const isSensitiveKey = (key) => SENSITIVE_FIELD_SET.has(key.toLowerCase()) || SENSITIVE_KEY_PATTERN.test(key);

export const redactSecrets = (text) =>
  text.replace(API_KEY_PATTERN, REDACTED).replace(BEARER_PATTERN, `Bearer ${REDACTED}`);

export const redactBody = (value, maxDepth = DEFAULT_MAX_DEPTH) => {
  if (typeof value === 'string') return redactSecrets(value);
  if (value === null || typeof value !== 'object') return value;
  if (maxDepth <= 0) return TOO_DEEP;
  if (Array.isArray(value)) return value.map((entry) => redactBody(entry, maxDepth - 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? REDACTED : redactBody(entry, maxDepth - 1),
    ]),
  );
};
