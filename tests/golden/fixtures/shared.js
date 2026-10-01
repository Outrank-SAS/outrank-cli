export const STUB_API_KEY = 'outr_live_golden_test_key';
export const FLAG_API_KEY = 'outr_live_flag_source_key';
export const ENV_API_KEY = 'outr_live_env_source_key';
export const CONFIG_API_KEY = 'outr_live_config_source_key';
export const STUB_BASE_URL = 'https://www.outrank.so';
export const FLAG_BASE_URL = 'https://flag-source.example.com';
export const ENV_BASE_URL = 'https://env-source.example.com';
export const CONFIG_BASE_URL = 'https://config-source.example.com';
export const DEFAULT_CONFIG = { apiKey: STUB_API_KEY, baseUrl: STUB_BASE_URL };
export const ACME_API_KEY = 'outr_live_acme_profile_key';
export const ACME_BASE_URL = 'https://outrank.so';
export const ACME_PROFILE = 'acme';
export const KEYLESS_PROFILE = 'staging';
export const PROFILES_CONFIG = {
  apiKey: STUB_API_KEY,
  baseUrl: STUB_BASE_URL,
  defaultProfile: 'default',
  profiles: {
    default: { apiKey: STUB_API_KEY, baseUrl: STUB_BASE_URL },
    [ACME_PROFILE]: { apiKey: ACME_API_KEY, baseUrl: ACME_BASE_URL },
    [KEYLESS_PROFILE]: { baseUrl: STUB_BASE_URL },
  },
};
export const KEYLESS_DEFAULT_CONFIG = {
  baseUrl: STUB_BASE_URL,
  defaultProfile: 'default',
  profiles: { default: { baseUrl: STUB_BASE_URL }, [ACME_PROFILE]: { apiKey: ACME_API_KEY } },
};
export const BROKEN_PROFILE = 'broken';
export const BROKEN_CONFIG = {
  defaultProfile: 'default',
  profiles: { default: { apiKey: STUB_API_KEY }, [BROKEN_PROFILE]: { apiKey: ACME_API_KEY, baseUrl: 'not a url' } },
};
export const INVALID_PROFILE_NAME_CONFIG_TEXT = JSON.stringify({
  defaultProfile: 'default',
  profiles: { default: { apiKey: STUB_API_KEY }, 'my acme': { apiKey: ACME_API_KEY } },
});

export const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
export const SECOND_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
export const THIRD_ID = 'cccccccc-0000-4000-8000-000000000003';

export const OK_RESPONSE = { status: 200, body: { ok: true, data: { stub: true }, agent_guidance: 'stub' } };
export const NOT_FOUND_RESPONSE = {
  status: 404,
  body: { ok: false, error: { code: 'NOT_FOUND', message: 'Not found.' }, agent_guidance: 'stub guidance' },
};
export const NO_CONTENT_RESPONSE = { status: 204, contentType: null, rawBody: '' };
export const NON_JSON_RESPONSE = { status: 502, contentType: 'text/html', rawBody: '<html>Bad gateway</html>' };
export const MALFORMED_JSON_RESPONSE = { status: 200, rawBody: '{"stub":' };
export const INVALID_JSON_TEXT = '{not valid json';
export const INVALID_JSON_STDIN = '[1,';
export const CORRUPT_CONFIG_TEXT = '{corrupt';
export const INVALID_JSON_FILE = 'tests/golden/fixtures/payloads/invalid.json';
export const MISSING_JSON_FILE = 'tests/golden/fixtures/payloads/does-not-exist.json';
export const NETWORK_ERROR_RESPONSE = { networkError: 'fetch failed' };
export const EMPTY_200_RESPONSE = { status: 200, rawBody: '' };
export const GATEWAY_TIMEOUT_RESPONSE = {
  status: 504,
  contentType: 'text/html',
  rawBody: '<html>Gateway timeout</html>',
};
export const RATE_LIMITED_BODY = {
  ok: false,
  error: { code: 'RATE_LIMITED', message: 'Slow down.' },
  agent_guidance: 'Wait.',
};
export const RATE_LIMITED_RESPONSE = {
  status: 429,
  headers: {
    'retry-after': '30',
    'x-ratelimit-limit-minute': '60',
    'x-ratelimit-remaining-minute': '0',
    'x-ratelimit-limit-day': '5000',
    'x-ratelimit-remaining-day': '4210',
  },
  body: RATE_LIMITED_BODY,
};
export const RATE_LIMITED_INVALID_HEADERS_RESPONSE = {
  status: 429,
  headers: {
    'retry-after': `Wed, 21 Oct 2026 07:28:00 GMT ${'x'.repeat(40)}`,
    'x-ratelimit-limit-minute': '12345678901',
    'x-ratelimit-remaining-minute': '-1',
    'x-ratelimit-limit-day': '5000',
  },
  body: RATE_LIMITED_BODY,
};
export const SANITIZED_UPSTREAM_BODY_RESPONSE = {
  status: 502,
  contentType: 'text/html',
  rawBody: `Authorization: Bearer outr_live_leaked_upstream_token\u0007\u001b[31mred ${'x'.repeat(520)}`,
};
