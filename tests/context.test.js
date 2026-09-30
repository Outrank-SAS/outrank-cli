import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ALLOWED_BASE_URL_HOSTS, DEFAULT_BASE_URL, DEFAULT_PROFILE_NAME } from '../src/core/constants.js';
import { ContextSource, ProfileSource, normalizeBaseUrl, resolveContext } from '../src/core/context.js';
import { CliErrorCode } from '../src/core/errors.js';

const FLAG_KEY = 'outr_live_flag_key';
const ENV_KEY = 'outr_live_env_key';
const CONFIG_KEY = 'outr_live_config_key';
const ACME_KEY = 'outr_live_acme_key';
const ACME = 'acme';
const ACME_URL = 'https://outrank.so';
const CUSTOM_HOST_URL = 'https://staging.example.com';
const EVIL_HOST_URL = 'https://evil.example';
const LOOPBACK_HTTP_URL = 'http://localhost:3333';
const PROFILES_CONFIG = {
  apiKey: CONFIG_KEY,
  baseUrl: DEFAULT_BASE_URL,
  defaultProfile: DEFAULT_PROFILE_NAME,
  profiles: {
    default: { apiKey: CONFIG_KEY, baseUrl: DEFAULT_BASE_URL },
    acme: { apiKey: ACME_KEY, baseUrl: ACME_URL },
    staging: { baseUrl: DEFAULT_BASE_URL },
  },
};

const throwsUsage = (fn, messagePattern) =>
  assert.throws(fn, (error) => {
    assert.equal(error.cliCode, CliErrorCode.INVALID_USAGE);
    assert.match(error.message, messagePattern);
    assert.ok(error.guidance.length > 0);
    return true;
  });

test('the API key comes from the flag first, then the environment, then the default profile', () => {
  const all = resolveContext({
    flags: { apiKey: FLAG_KEY },
    env: { OUTRANK_API_KEY: ENV_KEY },
    config: { apiKey: CONFIG_KEY },
  });
  assert.equal(all.apiKey, FLAG_KEY);
  assert.equal(all.source.apiKey, ContextSource.FLAG);
  assert.equal(all.source.envIgnored, true);

  const envAndConfig = resolveContext({ env: { OUTRANK_API_KEY: ENV_KEY }, config: { apiKey: CONFIG_KEY } });
  assert.equal(envAndConfig.apiKey, ENV_KEY);
  assert.equal(envAndConfig.source.apiKey, ContextSource.ENV);
  assert.equal(envAndConfig.source.envIgnored, false);

  const configOnly = resolveContext({ config: { apiKey: CONFIG_KEY } });
  assert.equal(configOnly.apiKey, CONFIG_KEY);
  assert.equal(configOnly.source.apiKey, ContextSource.PROFILE);
  assert.deepEqual(configOnly.profile, {
    name: DEFAULT_PROFILE_NAME,
    source: ProfileSource.DEFAULT,
    explicit: false,
    known: true,
  });

  const nothing = resolveContext({});
  assert.equal(nothing.apiKey, undefined);
  assert.equal(nothing.source.apiKey, ContextSource.MISSING);
  assert.equal(nothing.profile.known, false);
});

test('an empty environment variable does not shadow the stored key', () => {
  const context = resolveContext({ env: { OUTRANK_API_KEY: '' }, config: { apiKey: CONFIG_KEY } });
  assert.equal(context.apiKey, CONFIG_KEY);
  assert.equal(context.source.apiKey, ContextSource.PROFILE);
});

test('the base URL follows the same order and falls back to the default origin', () => {
  const withFlag = resolveContext({
    flags: { baseUrl: 'https://outrank.so/' },
    env: { OUTRANK_BASE_URL: 'https://www.outrank.so' },
    config: { baseUrl: 'https://www.outrank.so' },
  });
  assert.equal(withFlag.baseUrl, 'https://outrank.so');
  assert.equal(withFlag.source.baseUrl, ContextSource.FLAG);
  assert.equal(withFlag.source.baseUrlEnvIgnored, true);

  const fromEnv = resolveContext({ env: { OUTRANK_BASE_URL: 'https://www.outrank.so/api/' } });
  assert.equal(fromEnv.baseUrl, 'https://www.outrank.so');
  assert.equal(fromEnv.source.baseUrl, ContextSource.ENV);
  assert.equal(fromEnv.source.baseUrlEnvIgnored, false);

  const fromConfig = resolveContext({ config: { baseUrl: 'https://outrank.so' } });
  assert.equal(fromConfig.source.baseUrl, ContextSource.PROFILE);
  assert.equal(fromConfig.storedBaseUrl, 'https://outrank.so');

  const fallback = resolveContext({});
  assert.equal(fallback.baseUrl, DEFAULT_BASE_URL);
  assert.equal(fallback.source.baseUrl, ContextSource.DEFAULT);
});

test('the default profile named in the config is used when no profile is selected', () => {
  const context = resolveContext({
    config: { ...PROFILES_CONFIG, apiKey: ACME_KEY, baseUrl: ACME_URL, defaultProfile: ACME },
  });
  assert.equal(context.profile.name, ACME);
  assert.equal(context.profile.source, ProfileSource.DEFAULT);
  assert.equal(context.apiKey, ACME_KEY);
  assert.equal(context.baseUrl, ACME_URL);
});

test('--profile beats OUTRANK_API_KEY and OUTRANK_BASE_URL, and reports that the environment was ignored', () => {
  const context = resolveContext({
    flags: { profile: ACME },
    env: { OUTRANK_API_KEY: ENV_KEY, OUTRANK_BASE_URL: CUSTOM_HOST_URL, OUTRANK_ALLOW_CUSTOM_BASE_URL: '1' },
    config: PROFILES_CONFIG,
  });
  assert.equal(context.apiKey, ACME_KEY);
  assert.equal(context.baseUrl, ACME_URL);
  assert.equal(context.source.apiKey, ContextSource.PROFILE);
  assert.equal(context.source.baseUrl, ContextSource.PROFILE);
  assert.equal(context.source.envIgnored, true);
  assert.equal(context.source.baseUrlEnvIgnored, true);
  assert.deepEqual(context.profile, { name: ACME, source: ProfileSource.FLAG, explicit: true, known: true });
});

test('OUTRANK_PROFILE selects a profile the same way, and --profile beats it', () => {
  const fromEnv = resolveContext({ env: { OUTRANK_PROFILE: ACME, OUTRANK_API_KEY: ENV_KEY }, config: PROFILES_CONFIG });
  assert.equal(fromEnv.apiKey, ACME_KEY);
  assert.equal(fromEnv.profile.source, ProfileSource.ENV);
  assert.equal(fromEnv.source.envIgnored, true);

  const flagWins = resolveContext({
    flags: { profile: DEFAULT_PROFILE_NAME },
    env: { OUTRANK_PROFILE: ACME },
    config: PROFILES_CONFIG,
  });
  assert.equal(flagWins.apiKey, CONFIG_KEY);
  assert.equal(flagWins.profile.source, ProfileSource.FLAG);
});

test('--api-key and --base-url still beat a selected profile', () => {
  const context = resolveContext({
    flags: { profile: ACME, apiKey: FLAG_KEY, baseUrl: DEFAULT_BASE_URL },
    config: PROFILES_CONFIG,
  });
  assert.equal(context.apiKey, FLAG_KEY);
  assert.equal(context.baseUrl, DEFAULT_BASE_URL);
  assert.equal(context.source.apiKey, ContextSource.FLAG);
  assert.equal(context.source.baseUrl, ContextSource.FLAG);
  assert.equal(context.profile.name, ACME);
});

test('a selected profile without a key never falls back to the environment key', () => {
  const context = resolveContext({
    flags: { profile: 'staging' },
    env: { OUTRANK_API_KEY: ENV_KEY },
    config: PROFILES_CONFIG,
  });
  assert.equal(context.apiKey, undefined);
  assert.equal(context.source.apiKey, ContextSource.MISSING);
  assert.equal(context.source.envIgnored, true);
  assert.equal(context.baseUrl, DEFAULT_BASE_URL);
  assert.equal(context.source.baseUrl, ContextSource.PROFILE);
});

test('an unknown selected profile is CLI_INVALID_USAGE naming its source and listing the stored profiles', () => {
  throwsUsage(
    () => resolveContext({ flags: { profile: 'nope' }, config: PROFILES_CONFIG }),
    /Unknown profile: nope \(from --profile\)/,
  );
  assert.throws(
    () => resolveContext({ env: { OUTRANK_PROFILE: 'nope' }, config: PROFILES_CONFIG }),
    (error) => {
      assert.match(error.message, /Unknown profile: nope \(from OUTRANK_PROFILE\)/);
      assert.match(error.guidance, /Stored profiles: acme, default, staging/);
      assert.match(error.guidance, /selected by OUTRANK_PROFILE; unset it/);
      return true;
    },
  );
  assert.throws(
    () => resolveContext({ flags: { profile: 'nope' } }),
    (error) => {
      assert.match(error.guidance, /No profiles are stored yet/);
      assert.doesNotMatch(error.guidance, /selected by OUTRANK_PROFILE/);
      return true;
    },
  );

  const allowed = resolveContext({ flags: { profile: 'nope' }, config: PROFILES_CONFIG, allowUnknownProfile: true });
  assert.deepEqual(allowed.profile, { name: 'nope', source: ProfileSource.FLAG, explicit: true, known: false });
  assert.equal(allowed.apiKey, undefined);
});

test('an invalid or empty profile name is CLI_INVALID_USAGE', () => {
  throwsUsage(
    () => resolveContext({ flags: { profile: '__proto__' }, config: PROFILES_CONFIG }),
    /Invalid profile name "__proto__" \(from --profile\)/,
  );
  throwsUsage(
    () => resolveContext({ env: { OUTRANK_PROFILE: 'bad name' } }),
    /Invalid profile name "bad name" \(from OUTRANK_PROFILE\)/,
  );
  throwsUsage(() => resolveContext({ flags: { profile: '' } }), /--profile was given without a value/);
  throwsUsage(() => resolveContext({ flags: { apiKey: '' } }), /--api-key was given without a value/);
});

test('a malformed base URL is CLI_INVALID_USAGE with guidance, not a raw TypeError', () => {
  throwsUsage(() => resolveContext({ flags: { baseUrl: 'not a url' } }), /Invalid base URL: "not a url"/);
  throwsUsage(() => resolveContext({ env: { OUTRANK_BASE_URL: 'ftp://outrank.so' } }), /Invalid base URL/);
  throwsUsage(() => normalizeBaseUrl('outrank.so'), /Invalid base URL/);
});

test('a malformed base URL is echoed bounded and without credentials', () => {
  assert.throws(
    () => normalizeBaseUrl('ftp://user:secret@h'),
    (error) => {
      assert.equal(error.message, 'Invalid base URL: "ftp://h"');
      return true;
    },
  );
  assert.throws(
    () => normalizeBaseUrl(`not a url\u0007 ${'x'.repeat(200)}`),
    (error) => {
      assert.equal(error.message.includes('\u0007'), false);
      assert.ok(error.message.length < 120);
      assert.match(error.message, /\.\.\."$/);
      return true;
    },
  );
});

test('a host outside the allowlist is rejected unless custom hosts are explicitly allowed', () => {
  const customHostPattern = /staging\.example\.com is not allowed/;
  throwsUsage(() => resolveContext({ env: { OUTRANK_BASE_URL: CUSTOM_HOST_URL } }), customHostPattern);
  throwsUsage(() => resolveContext({ flags: { baseUrl: CUSTOM_HOST_URL } }), /is not allowed/);
  throwsUsage(() => resolveContext({ config: { baseUrl: CUSTOM_HOST_URL } }), /is not allowed/);
  throwsUsage(() => resolveContext({ flags: { baseUrl: EVIL_HOST_URL } }), /evil\.example is not allowed/);

  const viaFlag = resolveContext({ flags: { baseUrl: CUSTOM_HOST_URL, allowCustomBaseUrl: true } });
  assert.equal(viaFlag.baseUrl, CUSTOM_HOST_URL);

  const viaEnv = resolveContext({
    env: { OUTRANK_BASE_URL: CUSTOM_HOST_URL, OUTRANK_ALLOW_CUSTOM_BASE_URL: '1' },
  });
  assert.equal(viaEnv.baseUrl, CUSTOM_HOST_URL);
  assert.equal(
    resolveContext({ env: { OUTRANK_BASE_URL: EVIL_HOST_URL, OUTRANK_ALLOW_CUSTOM_BASE_URL: '1' } }).baseUrl,
    EVIL_HOST_URL,
  );

  throwsUsage(
    () => resolveContext({ env: { OUTRANK_BASE_URL: CUSTOM_HOST_URL, OUTRANK_ALLOW_CUSTOM_BASE_URL: '0' } }),
    /is not allowed/,
  );
});

test('the custom-host flag must be the boolean true; the text false never turns the allowlist off', () => {
  throwsUsage(
    () => resolveContext({ flags: { baseUrl: EVIL_HOST_URL, allowCustomBaseUrl: 'false' } }),
    /evil\.example is not allowed/,
  );
  throwsUsage(
    () => resolveContext({ flags: { baseUrl: EVIL_HOST_URL, allowCustomBaseUrl: 'true' } }),
    /evil\.example is not allowed/,
  );
  throwsUsage(() => resolveContext({ flags: { baseUrl: EVIL_HOST_URL, allowCustomBaseUrl: 1 } }), /is not allowed/);
  assert.equal(resolveContext({ flags: { baseUrl: EVIL_HOST_URL, allowCustomBaseUrl: true } }).baseUrl, EVIL_HOST_URL);
});

test('an invalid base URL stored in a profile names the profile and never echoes the stored value', () => {
  const config = {
    ...PROFILES_CONFIG,
    profiles: { ...PROFILES_CONFIG.profiles, broken: { baseUrl: 'outr_live_pasted' } },
  };
  assert.throws(
    () => resolveContext({ flags: { profile: 'broken' }, config }),
    (error) => {
      assert.equal(error.cliCode, CliErrorCode.INVALID_USAGE);
      assert.equal(error.message, 'Invalid base URL stored in profile broken.');
      assert.match(error.guidance, /--profile broken --base-url <url>/);
      assert.doesNotMatch(error.guidance, /outr_live_pasted/);
      return true;
    },
  );
  assert.equal(
    resolveContext({ flags: { profile: 'broken', baseUrl: DEFAULT_BASE_URL }, config }).baseUrl,
    DEFAULT_BASE_URL,
  );
  assert.throws(
    () => resolveContext({ flags: { profile: 'broken' }, config }),
    (error) => {
      assert.equal(typeof error.details.config_path, 'string');
      assert.match(error.guidance, /details\.config_path/);
      return true;
    },
  );
  const offline = resolveContext({ flags: { profile: 'broken' }, config, enforceAllowlist: false });
  assert.equal(offline.baseUrl, null);
  assert.equal(offline.source.baseUrl, ContextSource.PROFILE);
  assert.equal(offline.storedBaseUrl, 'outr_live_pasted');
  throwsUsage(
    () => resolveContext({ flags: { baseUrl: 'not a url' }, config, enforceAllowlist: false }),
    /Invalid base URL: "not a url"/,
  );
});

test('an explicit boolean false on the custom-host flag overrides the environment allow switch', () => {
  const env = { OUTRANK_ALLOW_CUSTOM_BASE_URL: '1' };
  assert.equal(resolveContext({ flags: { baseUrl: EVIL_HOST_URL }, env }).baseUrl, EVIL_HOST_URL);
  throwsUsage(
    () => resolveContext({ flags: { baseUrl: EVIL_HOST_URL, allowCustomBaseUrl: false }, env }),
    /evil\.example is not allowed/,
  );
});

test('plain http is accepted for loopback hosts only together with the custom-host flag', () => {
  throwsUsage(() => resolveContext({ flags: { baseUrl: LOOPBACK_HTTP_URL } }), /is not https/);
  throwsUsage(
    () => resolveContext({ flags: { baseUrl: 'http://www.outrank.so', allowCustomBaseUrl: true } }),
    /is not https/,
  );
  assert.equal(
    resolveContext({ flags: { baseUrl: LOOPBACK_HTTP_URL, allowCustomBaseUrl: true } }).baseUrl,
    LOOPBACK_HTTP_URL,
  );
  assert.equal(
    resolveContext({ env: { OUTRANK_BASE_URL: LOOPBACK_HTTP_URL, OUTRANK_ALLOW_CUSTOM_BASE_URL: '1' } }).baseUrl,
    LOOPBACK_HTTP_URL,
  );
});

test('every allow-listed host is accepted from every source', () => {
  for (const host of ALLOWED_BASE_URL_HOSTS) {
    const url = `https://${host}`;
    assert.equal(resolveContext({ flags: { baseUrl: url } }).baseUrl, url);
    assert.equal(resolveContext({ env: { OUTRANK_BASE_URL: url } }).baseUrl, url);
    assert.equal(resolveContext({ config: { baseUrl: url } }).baseUrl, url);
  }
});
