import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  API_KEY_SUFFIX_LENGTH,
  CONFIG_FILE_MODE,
  DEFAULT_PROFILE_NAME,
  MAX_PROFILE_NAME_LENGTH,
  MIN_API_KEY_LENGTH_FOR_SUFFIX,
} from '../src/core/constants.js';
import {
  clearProfileAuth,
  describeUntrustedValue,
  getConfigPath,
  isValidProfileName,
  loadConfig,
  loadProfiles,
  readProfiles,
  redactApiKey,
  saveProfiles,
  serializeProfiles,
  storeProfileAuth,
} from '../src/core/config.js';
import { CliErrorCode } from '../src/core/errors.js';

const DEFAULT_KEY = 'outr_live_default_profile_key';
const ACME_KEY = 'outr_live_acme_profile_key';
const NEW_KEY = 'outr_live_new_key';
const DEFAULT_URL = 'https://www.outrank.so';
const ACME_URL = 'https://outrank.so';
const STAGING_URL = 'https://staging.example.com';
const ACME = 'acme';
const POSIX_MODE_MASK = 0o777;
const OUTRANK_ENV_PREFIX = 'OUTRANK_';
const CONFIG_DIR_ENV = 'OUTRANK_CONFIG_DIR';
const BYTE_ORDER_MARK = '﻿';
const WINDOWS = 'win32';

let configDir;
const savedEnv = {};

test.before(async () => {
  configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outrank-cli-config-'));
  for (const name of Object.keys(process.env)) {
    if (name.startsWith(OUTRANK_ENV_PREFIX)) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
  }
  process.env[CONFIG_DIR_ENV] = configDir;
});

test.after(async () => {
  delete process.env[CONFIG_DIR_ENV];
  Object.assign(process.env, savedEnv);
  await fs.rm(configDir, { recursive: true, force: true });
});

const resetConfigDir = async () => {
  await fs.rm(configDir, { recursive: true, force: true });
  await fs.mkdir(configDir, { recursive: true });
};

const writeRawConfig = async (value) => {
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(getConfigPath(), typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
};

const readRawText = async () => fs.readFile(getConfigPath(), 'utf8');

const readRawConfig = async () => JSON.parse(await readRawText());

const listConfigDir = async () => (await fs.readdir(configDir)).sort();

const legacyLoadConfig050 = async () => {
  const configPath = getConfigPath();
  try {
    await fs.access(configPath);
  } catch {
    return {};
  }
  const raw = await fs.readFile(configPath, 'utf8');
  try {
    const config = JSON.parse(raw);
    return config && typeof config === 'object' ? config : {};
  } catch {
    return {};
  }
};

const legacyStoreAuthConfig050 = async ({ apiKey, baseUrl }) => {
  const current = await legacyLoadConfig050();
  const next = { ...current, ...(apiKey ? { apiKey } : {}), ...(baseUrl ? { baseUrl } : {}) };
  await fs.writeFile(getConfigPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
};

const legacyClearStoredAuth050 = async () => {
  const next = { ...(await legacyLoadConfig050()) };
  delete next.apiKey;
  await fs.writeFile(getConfigPath(), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
};

const isConfigUnreadable = (reasonPattern) => (error) => {
  assert.equal(error.cliCode, CliErrorCode.CONFIG_UNREADABLE);
  assert.equal(error.details.config_path, getConfigPath());
  assert.doesNotMatch(error.message, /config\.json/);
  assert.match(error.guidance, /never overwrite/);
  if (reasonPattern) assert.match(error.message, reasonPattern);
  return true;
};

const rejectsConfigUnreadable = (promise, reasonPattern) => assert.rejects(promise, isConfigUnreadable(reasonPattern));

const throwsConfigUnreadable = (fn, reasonPattern) => assert.throws(fn, isConfigUnreadable(reasonPattern));

test('a legacy flat config is read as the default profile and an empty file has no profiles', () => {
  assert.deepEqual(readProfiles({ apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL }), {
    defaultProfile: DEFAULT_PROFILE_NAME,
    profiles: { [DEFAULT_PROFILE_NAME]: { apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL } },
  });
  assert.deepEqual(readProfiles({ baseUrl: DEFAULT_URL }), {
    defaultProfile: DEFAULT_PROFILE_NAME,
    profiles: { [DEFAULT_PROFILE_NAME]: { baseUrl: DEFAULT_URL } },
  });
  assert.deepEqual(readProfiles({}), { defaultProfile: DEFAULT_PROFILE_NAME, profiles: {} });
  assert.deepEqual(readProfiles(undefined), { defaultProfile: DEFAULT_PROFILE_NAME, profiles: {} });
  assert.deepEqual(readProfiles({ apiKey: '' }), { defaultProfile: DEFAULT_PROFILE_NAME, profiles: {} });
  assert.deepEqual(readProfiles({ defaultProfile: ACME, apiKey: ACME_KEY }), {
    defaultProfile: ACME,
    profiles: { acme: { apiKey: ACME_KEY } },
  });
});

test('a profiles config keeps every named profile and a non-empty mirror is the default profile', () => {
  const state = readProfiles({
    apiKey: NEW_KEY,
    baseUrl: DEFAULT_URL,
    defaultProfile: ACME,
    profiles: {
      default: { apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL },
      acme: { apiKey: ACME_KEY, baseUrl: ACME_URL },
      staging: { baseUrl: STAGING_URL, junk: true },
    },
  });
  assert.deepEqual(state, {
    defaultProfile: ACME,
    profiles: {
      default: { apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL },
      acme: { apiKey: NEW_KEY, baseUrl: DEFAULT_URL },
      staging: { baseUrl: STAGING_URL },
    },
  });
});

test('a mirror emptied of its key by an older CLI removes the key from the default profile', () => {
  const state = readProfiles({
    baseUrl: DEFAULT_URL,
    defaultProfile: DEFAULT_PROFILE_NAME,
    profiles: { default: { apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL }, acme: { apiKey: ACME_KEY } },
  });
  assert.deepEqual(state.profiles, { default: { baseUrl: DEFAULT_URL }, acme: { apiKey: ACME_KEY } });
});

test('a file with profiles but no mirror keeps the default profile exactly as written', () => {
  const state = readProfiles({
    defaultProfile: ACME,
    profiles: { default: { apiKey: DEFAULT_KEY }, acme: { apiKey: ACME_KEY, baseUrl: ACME_URL } },
  });
  assert.deepEqual(state, {
    defaultProfile: ACME,
    profiles: { default: { apiKey: DEFAULT_KEY }, acme: { apiKey: ACME_KEY, baseUrl: ACME_URL } },
  });
});

test('an invalid profile name, entry, field or defaultProfile is CLI_CONFIG_UNREADABLE, never dropped', () => {
  throwsConfigUnreadable(() => readProfiles({ profiles: { 'bad name': { apiKey: ACME_KEY } } }), /"bad name"/);
  throwsConfigUnreadable(() => readProfiles(JSON.parse('{"profiles":{"__proto__":{"apiKey":"k"}}}')), /"__proto__"/);
  throwsConfigUnreadable(() => readProfiles({ profiles: { acme: 'nope' } }), /"acme" is not a JSON object/);
  throwsConfigUnreadable(() => readProfiles({ profiles: { acme: [ACME_KEY] } }), /"acme" is not a JSON object/);
  throwsConfigUnreadable(() => readProfiles({ profiles: { acme: { apiKey: 123 } } }), /non-string apiKey/);
  throwsConfigUnreadable(() => readProfiles({ profiles: [] }), /profiles is not a JSON object/);
  throwsConfigUnreadable(() => readProfiles({ defaultProfile: 'my work', profiles: {} }), /"my work"/);
  throwsConfigUnreadable(
    () => readProfiles({ defaultProfile: 'x'.repeat(MAX_PROFILE_NAME_LENGTH + 1), profiles: {} }),
    /not a valid profile name/,
  );
  throwsConfigUnreadable(() => readProfiles({ defaultProfile: 'my work' }), /"my work"/);
  throwsConfigUnreadable(() => readProfiles({ defaultProfile: null }), /defaultProfile a non-string value \(null\)/);
  throwsConfigUnreadable(
    () => readProfiles({ defaultProfile: { a: 1 } }),
    /defaultProfile a non-string value \(object\)/,
  );
  throwsConfigUnreadable(() => readProfiles({ baseUrl: 7 }), /the config file has a non-string baseUrl/);
  throwsConfigUnreadable(() => readProfiles({ apiKey: ['k'] }), /the config file has a non-string apiKey/);
});

test('an invalid name echoed in the error is quoted, ASCII-only and cut at the name length limit', () => {
  const oversized = `bad ${'x'.repeat(MAX_PROFILE_NAME_LENGTH * 2)}`;
  assert.throws(
    () => readProfiles({ profiles: { [oversized]: {} } }),
    (error) => {
      const expected = JSON.stringify(`${oversized.slice(0, MAX_PROFILE_NAME_LENGTH)}...`);
      assert.equal(error.message, `The stored config file could not be read: profile name ${expected} is invalid.`);
      return true;
    },
  );
  assert.throws(
    () => readProfiles({ profiles: { 'bad\u0007\u001b[31m nameé': {} } }),
    (error) => {
      assert.match(error.message, /profile name "bad\[31m name" is invalid/);
      return true;
    },
  );
  const atLimit = 'x'.repeat(MAX_PROFILE_NAME_LENGTH);
  assert.equal(describeUntrustedValue(atLimit), JSON.stringify(atLimit));
  assert.equal(
    describeUntrustedValue('x'.repeat(MAX_PROFILE_NAME_LENGTH + 1)),
    JSON.stringify(`${'x'.repeat(MAX_PROFILE_NAME_LENGTH)}...`),
  );
});

test('profile names that exist on Object.prototype are ordinary profiles and never read inherited values', () => {
  const state = readProfiles({ profiles: { constructor: { apiKey: ACME_KEY }, toString: {} } });
  assert.deepEqual(state.profiles, { constructor: { apiKey: ACME_KEY }, toString: {} });
  assert.deepEqual(readProfiles({ profiles: {} }).profiles, {});
  const serialized = serializeProfiles({ profiles: {} }, { defaultProfile: 'valueOf', profiles: { valueOf: {} } });
  assert.deepEqual(serialized.profiles, { valueOf: {} });
});

test('profile names allow letters, digits, dots, dashes and underscores up to the length limit', () => {
  assert.equal(isValidProfileName('a'), true);
  assert.equal(isValidProfileName('Acme-2.prod_eu'), true);
  assert.equal(isValidProfileName('x'.repeat(MAX_PROFILE_NAME_LENGTH)), true);
  assert.equal(isValidProfileName('x'.repeat(MAX_PROFILE_NAME_LENGTH + 1)), false);
  assert.equal(isValidProfileName(''), false);
  assert.equal(isValidProfileName('-lead'), false);
  assert.equal(isValidProfileName('__proto__'), false);
  assert.equal(isValidProfileName('has space'), false);
  assert.equal(isValidProfileName(undefined), false);
});

test('a key suffix is shown only for keys long enough to stay secret', () => {
  const suffix = 't'.repeat(API_KEY_SUFFIX_LENGTH);
  const longEnough = 'k'.repeat(MIN_API_KEY_LENGTH_FOR_SUFFIX - API_KEY_SUFFIX_LENGTH) + suffix;
  assert.equal(redactApiKey(longEnough), suffix);
  assert.equal(redactApiKey(longEnough.slice(1)), null);
  assert.equal(redactApiKey('abc'), null);
  assert.equal(redactApiKey(undefined), null);
});

test('serializing mirrors the default profile, preserves unknown top-level and per-profile fields', () => {
  const serialized = serializeProfiles(
    { apiKey: 'stale', baseUrl: 'stale', profiles: { acme: { apiKey: 'stale', orgId: 'org_1' } }, telemetry: false },
    {
      defaultProfile: ACME,
      profiles: { default: { apiKey: DEFAULT_KEY }, acme: { apiKey: ACME_KEY, baseUrl: ACME_URL } },
    },
  );
  assert.deepEqual(serialized, {
    apiKey: ACME_KEY,
    baseUrl: ACME_URL,
    defaultProfile: ACME,
    profiles: { default: { apiKey: DEFAULT_KEY }, acme: { orgId: 'org_1', apiKey: ACME_KEY, baseUrl: ACME_URL } },
    telemetry: false,
  });
  assert.deepEqual(Object.keys(serialized), ['apiKey', 'baseUrl', 'defaultProfile', 'profiles', 'telemetry']);
});

test('a missing config file is empty, but a corrupt, non-object or malformed-profiles file is unreadable', async () => {
  await resetConfigDir();
  assert.deepEqual(await loadConfig(), {});
  await writeRawConfig('{corrupt');
  await rejectsConfigUnreadable(loadConfig(), /not valid JSON/);
  await rejectsConfigUnreadable(loadProfiles());
  await writeRawConfig('');
  await rejectsConfigUnreadable(loadConfig(), /not valid JSON/);
  await writeRawConfig('[]');
  await rejectsConfigUnreadable(loadConfig(), /not a JSON object/);
  await writeRawConfig({ profiles: { 'my acme': { apiKey: ACME_KEY } } });
  await rejectsConfigUnreadable(loadConfig(), /"my acme"/);
  await resetConfigDir();
  await fs.mkdir(getConfigPath());
  await rejectsConfigUnreadable(loadConfig(), /EISDIR/);
});

test('a UTF-8 byte order mark is tolerated', async () => {
  await resetConfigDir();
  await writeRawConfig(`${BYTE_ORDER_MARK}${JSON.stringify({ apiKey: DEFAULT_KEY })}`);
  assert.deepEqual(await loadConfig(), { apiKey: DEFAULT_KEY });
});

test('login and logout refuse to touch a config file they cannot fully parse', async () => {
  await resetConfigDir();
  for (const text of ['{corrupt', JSON.stringify({ profiles: { 'my acme': { apiKey: ACME_KEY } } })]) {
    await writeRawConfig(text);
    await rejectsConfigUnreadable(
      storeProfileAuth({ profile: DEFAULT_PROFILE_NAME, apiKey: NEW_KEY, baseUrl: DEFAULT_URL }),
    );
    await rejectsConfigUnreadable(clearProfileAuth({ profile: DEFAULT_PROFILE_NAME }));
    assert.equal(await readRawText(), text);
    assert.deepEqual(await listConfigDir(), ['config.json']);
  }
});

test('the first stored key becomes the default profile whatever its name; later ones do not', async () => {
  await resetConfigDir();
  const first = await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });
  assert.equal(first.isDefault, true);
  assert.deepEqual(await readRawConfig(), {
    apiKey: ACME_KEY,
    baseUrl: ACME_URL,
    defaultProfile: ACME,
    profiles: { acme: { apiKey: ACME_KEY, baseUrl: ACME_URL } },
  });

  const second = await storeProfileAuth({ profile: 'globex', apiKey: NEW_KEY, baseUrl: DEFAULT_URL });
  assert.equal(second.isDefault, false);
  const raw = await readRawConfig();
  assert.equal(raw.defaultProfile, ACME);
  assert.equal(raw.apiKey, ACME_KEY);
  assert.deepEqual(raw.profiles.globex, { apiKey: NEW_KEY, baseUrl: DEFAULT_URL });

  const promoted = await storeProfileAuth({
    profile: 'globex',
    apiKey: NEW_KEY,
    baseUrl: DEFAULT_URL,
    makeDefault: true,
  });
  assert.equal(promoted.isDefault, true);
  const promotedRaw = await readRawConfig();
  assert.equal(promotedRaw.defaultProfile, 'globex');
  assert.equal(promotedRaw.apiKey, NEW_KEY);
  assert.equal(promotedRaw.baseUrl, DEFAULT_URL);
});

test('a legacy flat file is upgraded in place and its key stays the default profile', async () => {
  await resetConfigDir();
  await writeRawConfig({ apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL });
  const saved = await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });
  assert.equal(saved.isDefault, false);
  assert.deepEqual(await readRawConfig(), {
    apiKey: DEFAULT_KEY,
    baseUrl: DEFAULT_URL,
    defaultProfile: DEFAULT_PROFILE_NAME,
    profiles: { default: { apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL }, acme: { apiKey: ACME_KEY, baseUrl: ACME_URL } },
  });
});

test('storing a key for a profile keeps fields this CLI does not manage', async () => {
  await resetConfigDir();
  await writeRawConfig({
    defaultProfile: ACME,
    profiles: { acme: { apiKey: ACME_KEY, baseUrl: ACME_URL, orgId: 'org_1' } },
  });
  await storeProfileAuth({ profile: ACME, apiKey: NEW_KEY });
  assert.deepEqual((await readRawConfig()).profiles.acme, { orgId: 'org_1', apiKey: NEW_KEY, baseUrl: ACME_URL });
});

test('logging out of one profile leaves the others intact and the mirror follows the default profile', async () => {
  await resetConfigDir();
  await storeProfileAuth({ profile: DEFAULT_PROFILE_NAME, apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL });
  await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });

  const acmeResult = await clearProfileAuth({ profile: ACME });
  assert.equal(acmeResult.removed, true);
  const afterAcme = await readRawConfig();
  assert.deepEqual(afterAcme.profiles, {
    default: { apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL },
    acme: { baseUrl: ACME_URL },
  });
  assert.equal(afterAcme.apiKey, DEFAULT_KEY);

  const defaultResult = await clearProfileAuth({ profile: DEFAULT_PROFILE_NAME });
  assert.equal(defaultResult.removed, true);
  const afterDefault = await readRawConfig();
  assert.equal(Object.hasOwn(afterDefault, 'apiKey'), false);
  assert.equal(afterDefault.baseUrl, DEFAULT_URL);
  assert.deepEqual(afterDefault.profiles.default, { baseUrl: DEFAULT_URL });
  assert.deepEqual(afterDefault.profiles.acme, { baseUrl: ACME_URL });
});

test('logout reports removed:false and writes nothing when there is no file, profile or stored key', async () => {
  await resetConfigDir();
  assert.deepEqual(await clearProfileAuth({ profile: DEFAULT_PROFILE_NAME }), {
    defaultProfile: DEFAULT_PROFILE_NAME,
    profiles: {},
    removed: false,
  });
  assert.deepEqual(await listConfigDir(), []);

  const legacyText = JSON.stringify({ apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL });
  await writeRawConfig(legacyText);
  assert.equal((await clearProfileAuth({ profile: ACME })).removed, false);
  assert.equal(await readRawText(), legacyText);

  const keylessText = JSON.stringify({ baseUrl: DEFAULT_URL });
  await writeRawConfig(keylessText);
  assert.equal((await clearProfileAuth({ profile: DEFAULT_PROFILE_NAME })).removed, false);
  assert.equal(await readRawText(), keylessText);
});

test('the config file is written atomically with owner-only permissions and no temp files left behind', async () => {
  await resetConfigDir();
  await storeProfileAuth({ profile: DEFAULT_PROFILE_NAME, apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL });
  assert.deepEqual(await listConfigDir(), ['config.json']);
  if (process.platform !== WINDOWS) {
    const { mode } = await fs.stat(getConfigPath());
    assert.equal(mode & POSIX_MODE_MASK, CONFIG_FILE_MODE);
  }
});

test('a write that fails is CLI_CONFIG_UNWRITABLE with the path in details and no temp file left behind', async () => {
  await resetConfigDir();
  await fs.mkdir(path.join(getConfigPath(), 'blocker'), { recursive: true });
  await assert.rejects(
    saveProfiles({}, { defaultProfile: DEFAULT_PROFILE_NAME, profiles: { default: { apiKey: DEFAULT_KEY } } }),
    (error) => {
      assert.equal(error.cliCode, CliErrorCode.CONFIG_UNWRITABLE);
      assert.equal(error.details.config_path, getConfigPath());
      assert.equal(typeof error.details.fs_code, 'string');
      assert.doesNotMatch(error.message, /config\.json/);
      assert.match(error.guidance, /Nothing was saved/);
      return true;
    },
  );
  assert.deepEqual(await listConfigDir(), ['config.json']);
  assert.deepEqual(await fs.readdir(getConfigPath()), ['blocker']);
});

test('a relative OUTRANK_CONFIG_DIR resolves to an absolute path', () => {
  process.env[CONFIG_DIR_ENV] = '.';
  try {
    assert.equal(getConfigPath(), path.resolve('.', 'config.json'));
    assert.equal(path.isAbsolute(getConfigPath()), true);
  } finally {
    process.env[CONFIG_DIR_ENV] = configDir;
  }
});

test('a symlinked config file is updated in place instead of being replaced by a regular file', async (t) => {
  if (process.platform === WINDOWS) {
    t.skip('symlinks need elevated rights on Windows');
    return;
  }
  await resetConfigDir();
  const realPath = path.join(configDir, 'real-config.json');
  await fs.writeFile(realPath, JSON.stringify({ apiKey: DEFAULT_KEY }), 'utf8');
  await fs.symlink(realPath, getConfigPath());
  await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });
  assert.equal((await fs.lstat(getConfigPath())).isSymbolicLink(), true);
  assert.deepEqual(JSON.parse(await fs.readFile(realPath, 'utf8')).profiles.acme, {
    apiKey: ACME_KEY,
    baseUrl: ACME_URL,
  });

  await resetConfigDir();
  const danglingTarget = path.join(configDir, 'missing-config.json');
  await fs.symlink(danglingTarget, getConfigPath());
  await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });
  assert.equal((await fs.lstat(getConfigPath())).isSymbolicLink(), true);
  assert.equal(JSON.parse(await fs.readFile(danglingTarget, 'utf8')).apiKey, ACME_KEY);
});

test('a dangling link is resolved against the real directory and through a chain of links', async (t) => {
  if (process.platform === WINDOWS) {
    t.skip('symlinks need elevated rights on Windows');
    return;
  }
  await resetConfigDir();
  const realDir = path.join(configDir, 'real');
  const sharedDir = path.join(configDir, 'shared');
  const linkedDir = path.join(configDir, 'linked');
  await fs.mkdir(realDir);
  await fs.mkdir(sharedDir);
  await fs.symlink(realDir, linkedDir);
  await fs.symlink(path.join('..', 'shared', 'cfg.json'), path.join(realDir, 'config.json'));
  process.env[CONFIG_DIR_ENV] = linkedDir;
  try {
    await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });
    assert.equal(JSON.parse(await fs.readFile(path.join(sharedDir, 'cfg.json'), 'utf8')).apiKey, ACME_KEY);
    assert.equal((await fs.lstat(path.join(realDir, 'config.json'))).isSymbolicLink(), true);
    assert.equal(JSON.parse(await fs.readFile(getConfigPath(), 'utf8')).apiKey, ACME_KEY);
  } finally {
    process.env[CONFIG_DIR_ENV] = configDir;
  }

  await resetConfigDir();
  const finalTarget = path.join(configDir, 'final.json');
  const middleLink = path.join(configDir, 'middle.json');
  await fs.symlink(finalTarget, middleLink);
  await fs.symlink(middleLink, getConfigPath());
  await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });
  assert.equal((await fs.lstat(getConfigPath())).isSymbolicLink(), true);
  assert.equal((await fs.lstat(middleLink)).isSymbolicLink(), true);
  assert.equal(JSON.parse(await fs.readFile(finalTarget, 'utf8')).apiKey, ACME_KEY);

  await resetConfigDir();
  await fs.symlink(getConfigPath(), getConfigPath());
  await rejectsConfigUnreadable(storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL }), /ELOOP/);
  await assert.rejects(saveProfiles({}, { defaultProfile: DEFAULT_PROFILE_NAME, profiles: {} }), (error) => {
    assert.equal(error.cliCode, CliErrorCode.CONFIG_UNWRITABLE);
    assert.equal(error.details.fs_code, 'ELOOP');
    return true;
  });
});

test('a file written with two profiles is read correctly by the frozen 0.5.0 loadConfig', async () => {
  await resetConfigDir();
  await storeProfileAuth({ profile: DEFAULT_PROFILE_NAME, apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL });
  await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });
  const legacy = await legacyLoadConfig050();
  assert.equal(legacy.apiKey, DEFAULT_KEY);
  assert.equal(legacy.baseUrl, DEFAULT_URL);

  await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL, makeDefault: true });
  const switched = await legacyLoadConfig050();
  assert.equal(switched.apiKey, ACME_KEY);
  assert.equal(switched.baseUrl, ACME_URL);
});

test('a key stored or cleared by the frozen 0.5.0 code is what the default profile resolves to', async () => {
  await resetConfigDir();
  await storeProfileAuth({ profile: DEFAULT_PROFILE_NAME, apiKey: DEFAULT_KEY, baseUrl: DEFAULT_URL });
  await storeProfileAuth({ profile: ACME, apiKey: ACME_KEY, baseUrl: ACME_URL });

  await legacyStoreAuthConfig050({ apiKey: NEW_KEY, baseUrl: DEFAULT_URL });
  const afterLegacyLogin = await loadProfiles();
  assert.deepEqual(afterLegacyLogin.profiles.default, { apiKey: NEW_KEY, baseUrl: DEFAULT_URL });
  assert.deepEqual(afterLegacyLogin.profiles.acme, { apiKey: ACME_KEY, baseUrl: ACME_URL });

  await legacyClearStoredAuth050();
  const afterLegacyLogout = await loadProfiles();
  assert.deepEqual(afterLegacyLogout.profiles.default, { baseUrl: DEFAULT_URL });
  assert.deepEqual(afterLegacyLogout.profiles.acme, { apiKey: ACME_KEY, baseUrl: ACME_URL });
});
