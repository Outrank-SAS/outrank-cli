import { SENSITIVE_BODY_FIELDS } from './constants.js';

const REDACTED = '<redacted>';
const API_KEY_PATTERN = /outr_(?:live|test)_[A-Za-z0-9_]+/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._~+/=-]+/g;
const SENSITIVE_FIELD_SET = new Set(SENSITIVE_BODY_FIELDS.map((name) => name.toLowerCase()));

export const redactSecrets = (text) =>
  text.replace(API_KEY_PATTERN, REDACTED).replace(BEARER_PATTERN, `Bearer ${REDACTED}`);

export const redactBody = (value) => {
  if (Array.isArray(value)) return value.map(redactBody);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_FIELD_SET.has(key.toLowerCase()) ? REDACTED : redactBody(entry),
      ]),
    );
  }
  if (typeof value === 'string') return redactSecrets(value);
  return value;
};
