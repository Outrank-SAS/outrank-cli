import {
  CONFIG_API_KEY,
  CONFIG_BASE_URL,
  ENV_API_KEY,
  ENV_BASE_URL,
  FLAG_API_KEY,
  FLAG_BASE_URL,
  STUB_API_KEY,
  STUB_BASE_URL,
  CORRUPT_CONFIG_TEXT,
} from './shared.js';

const WHOAMI_OK = {
  status: 200,
  body: { ok: true, data: { user: { email: 'golden@example.com' } }, agent_guidance: 'stub' },
};
const WHOAMI_INVALID = {
  status: 401,
  body: { ok: false, error: { code: 'AUTH_KEY_INVALID', message: 'Invalid key.' }, agent_guidance: 'stub' },
};
const CONFIG_WITH_OWN_KEY = { apiKey: CONFIG_API_KEY, baseUrl: STUB_BASE_URL };
const CONFIG_WITH_OWN_BASE_URL = { apiKey: STUB_API_KEY, baseUrl: CONFIG_BASE_URL };
const STAGING_BASE_URL = 'https://staging.example.com';

export default [
  { name: 'help', argv: ['auth', '--help'], config: null },
  { name: 'login-verifies-then-stores', argv: ['auth', 'login', STUB_API_KEY], config: null, responses: [WHOAMI_OK] },
  { name: 'login-no-verify', argv: ['auth', 'login', STUB_API_KEY, '--no-verify'], config: null },
  {
    name: 'login-with-base-url',
    argv: ['auth', 'login', STUB_API_KEY, '--base-url', STAGING_BASE_URL, '--no-verify'],
    config: null,
  },
  { name: 'login-invalid-key', argv: ['auth', 'login', STUB_API_KEY], config: null, responses: [WHOAMI_INVALID] },
  { name: 'login-missing-key', argv: ['auth', 'login'], config: null },
  { name: 'whoami', argv: ['auth', 'whoami'], responses: [WHOAMI_OK] },
  { name: 'whoami-no-key', argv: ['auth', 'whoami'], config: null },
  {
    name: 'whoami-env-key',
    argv: ['auth', 'whoami'],
    config: null,
    env: { OUTRANK_API_KEY: STUB_API_KEY },
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-flag-key',
    argv: ['auth', 'whoami', '--api-key', STUB_API_KEY],
    config: null,
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-flag-and-env-keys',
    argv: ['auth', 'whoami', '--api-key', FLAG_API_KEY],
    config: null,
    env: { OUTRANK_API_KEY: ENV_API_KEY },
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-flag-and-config-keys',
    argv: ['auth', 'whoami', '--api-key', FLAG_API_KEY],
    config: CONFIG_WITH_OWN_KEY,
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-env-and-config-keys',
    argv: ['auth', 'whoami'],
    config: CONFIG_WITH_OWN_KEY,
    env: { OUTRANK_API_KEY: ENV_API_KEY },
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-flag-env-and-config-keys',
    argv: ['auth', 'whoami', '--api-key', FLAG_API_KEY],
    config: CONFIG_WITH_OWN_KEY,
    env: { OUTRANK_API_KEY: ENV_API_KEY },
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-flag-and-env-base-urls',
    argv: ['auth', 'whoami', '--base-url', FLAG_BASE_URL],
    env: { OUTRANK_BASE_URL: ENV_BASE_URL },
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-flag-and-config-base-urls',
    argv: ['auth', 'whoami', '--base-url', FLAG_BASE_URL],
    config: CONFIG_WITH_OWN_BASE_URL,
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-env-and-config-base-urls',
    argv: ['auth', 'whoami'],
    config: CONFIG_WITH_OWN_BASE_URL,
    env: { OUTRANK_BASE_URL: ENV_BASE_URL },
    responses: [WHOAMI_OK],
  },
  {
    name: 'whoami-flag-env-and-config-base-urls',
    argv: ['auth', 'whoami', '--base-url', FLAG_BASE_URL],
    config: CONFIG_WITH_OWN_BASE_URL,
    env: { OUTRANK_BASE_URL: ENV_BASE_URL },
    responses: [WHOAMI_OK],
  },
  { name: 'status-config', argv: ['auth', 'status'] },
  {
    name: 'status-env',
    argv: ['auth', 'status'],
    config: null,
    env: { OUTRANK_API_KEY: STUB_API_KEY, OUTRANK_BASE_URL: STUB_BASE_URL },
  },
  {
    name: 'status-flag-env-and-config-keys',
    argv: ['auth', 'status', '--api-key', FLAG_API_KEY],
    config: CONFIG_WITH_OWN_KEY,
    env: { OUTRANK_API_KEY: ENV_API_KEY },
  },
  {
    name: 'status-flag-env-and-config-base-urls',
    argv: ['auth', 'status', '--base-url', FLAG_BASE_URL],
    config: CONFIG_WITH_OWN_BASE_URL,
    env: { OUTRANK_BASE_URL: ENV_BASE_URL },
  },
  { name: 'status-missing', argv: ['auth', 'status'], config: null },
  { name: 'status-corrupt-config', argv: ['auth', 'status'], rawConfig: CORRUPT_CONFIG_TEXT },
  { name: 'whoami-invalid-base-url', argv: ['auth', 'whoami', '--base-url', 'not a url'] },
  { name: 'logout', argv: ['auth', 'logout'] },
  { name: 'logout-nothing-stored', argv: ['auth', 'logout'], config: null },
  { name: 'unknown-subcommand', argv: ['auth', 'nonsense'], config: null },
];
