export const STUB_API_KEY = 'outr_live_golden_test_key';
export const FLAG_API_KEY = 'outr_live_flag_source_key';
export const ENV_API_KEY = 'outr_live_env_source_key';
export const CONFIG_API_KEY = 'outr_live_config_source_key';
export const STUB_BASE_URL = 'https://www.outrank.so';
export const FLAG_BASE_URL = 'https://flag-source.example.com';
export const ENV_BASE_URL = 'https://env-source.example.com';
export const CONFIG_BASE_URL = 'https://config-source.example.com';
export const DEFAULT_CONFIG = { apiKey: STUB_API_KEY, baseUrl: STUB_BASE_URL };

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
