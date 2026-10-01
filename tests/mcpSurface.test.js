import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { describeBroadUploadDir, resolveMcpOptions } from '../src/adapters/mcp/options.js';
import { CommandKind, Toolset, defineCommand } from '../src/commands/registry.js';
import { Surface } from '../src/core/constants.js';
import { ContextSource, resolveContext } from '../src/core/context.js';
import { CliErrorCode, MCP_USAGE_GUIDANCE, codedError } from '../src/core/errors.js';
import { executeCommand } from '../src/core/execute.js';
import { requestAgentApi } from '../src/core/http.js';
import { list, uuid } from '../src/core/schema.js';

const ENV_KEY = 'outr_live_env_key';
const STORED_KEY = 'outr_live_stored_key';
const STAGING_URL = 'https://staging.example.com';
const LOOPBACK_URL = 'http://localhost:3334';
const EVIL_URL = 'https://evil.example';
const ALLOWED_URL = 'https://outrank.so';
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const POLL_TOOL = 'x.status';
const CWD = path.resolve('some', 'project');
const MCP_POLICY = { customBaseUrlFromStoredProfileOnly: true, revealLocalDetails: false };

const stagingConfig = (profile = { apiKey: STORED_KEY, baseUrl: STAGING_URL }) => ({
  profiles: { staging: profile, 'client-acme': { apiKey: STORED_KEY } },
});

const throwsUsage = (run, messagePattern, guidancePattern) =>
  assert.throws(run, (error) => {
    assert.equal(error.cliCode, CliErrorCode.INVALID_USAGE);
    assert.match(error.message, messagePattern);
    if (guidancePattern) assert.match(error.guidance, guidancePattern);
    return true;
  });

test('on the MCP surface the environment cannot unlock a custom host, even with the allow switch set', () => {
  const env = { OUTRANK_API_KEY: ENV_KEY, OUTRANK_BASE_URL: EVIL_URL, OUTRANK_ALLOW_CUSTOM_BASE_URL: '1' };
  throwsUsage(
    () => resolveContext({ env, ...MCP_POLICY }),
    /Base URL host evil\.example is not allowed\./,
    /same stored profile/,
  );
  assert.equal(resolveContext({ env }).baseUrl, EVIL_URL);
});

test('on the MCP surface a custom host is accepted when the key and the URL come from one stored profile', () => {
  const resolved = resolveContext({ flags: { profile: 'staging' }, config: stagingConfig(), ...MCP_POLICY });
  assert.equal(resolved.baseUrl, STAGING_URL);
  assert.equal(resolved.apiKey, STORED_KEY);
  assert.equal(resolved.source.apiKey, ContextSource.PROFILE);
  assert.equal(resolved.source.baseUrl, ContextSource.PROFILE);
  const loopback = stagingConfig({ apiKey: STORED_KEY, baseUrl: LOOPBACK_URL });
  const local = resolveContext({ flags: { profile: 'staging' }, config: loopback, ...MCP_POLICY });
  assert.equal(local.baseUrl, LOOPBACK_URL);
});

test('on the MCP surface a stored custom host is refused when the key comes from somewhere else', () => {
  const urlOnly = { defaultProfile: 'staging', profiles: { staging: { baseUrl: STAGING_URL } } };
  throwsUsage(
    () => resolveContext({ env: { OUTRANK_API_KEY: ENV_KEY }, config: urlOnly, ...MCP_POLICY }),
    /Base URL host staging\.example\.com is not allowed\./,
  );
  throwsUsage(
    () => resolveContext({ flags: { profile: 'staging', apiKey: ENV_KEY }, config: stagingConfig(), ...MCP_POLICY }),
    /Base URL host staging\.example\.com is not allowed\./,
  );
});

test('on the MCP surface an allow-listed host from the environment still works', () => {
  const env = { OUTRANK_API_KEY: ENV_KEY, OUTRANK_BASE_URL: ALLOWED_URL };
  assert.equal(resolveContext({ env, ...MCP_POLICY }).baseUrl, ALLOWED_URL);
});

test('an unknown profile on the MCP surface does not list the stored profile names', () => {
  assert.throws(
    () => resolveContext({ flags: { profile: 'nope' }, config: stagingConfig(), ...MCP_POLICY }),
    (error) => {
      assert.equal(error.message, 'Unknown profile: nope (from --profile).');
      assert.doesNotMatch(error.guidance, /client-acme/);
      assert.match(error.guidance, /outrank-cli auth profiles/);
      return true;
    },
  );
  assert.throws(
    () => resolveContext({ flags: { profile: 'nope' }, config: stagingConfig() }),
    (error) => {
      assert.match(error.guidance, /Stored profiles: client-acme, staging/);
      return true;
    },
  );
});

test('a missing key on the MCP surface points at the server configuration, never at pasting the key', async () => {
  const profile = { name: 'default', source: 'default', explicit: false, known: false };
  const base = { baseUrl: ALLOWED_URL, profile };
  await assert.rejects(requestAgentApi({ ...base, surface: Surface.MCP }, { path: '/usage/stats' }), (error) => {
    assert.equal(error.cliCode, CliErrorCode.AUTH_REQUIRED);
    assert.match(error.guidance, /MCP client configuration/);
    assert.match(error.guidance, /Never ask the human to paste the key/);
    return true;
  });
  const selected = { ...profile, name: 'acme', explicit: true, known: true };
  await assert.rejects(
    requestAgentApi({ ...base, profile: selected, surface: Surface.MCP }, { path: '/usage/stats' }),
    (error) => {
      assert.equal(error.message, 'Profile acme has no API key stored.');
      assert.match(error.guidance, /auth login <api-key> --profile acme/);
      return true;
    },
  );
  await assert.rejects(requestAgentApi({ ...base, surface: Surface.CLI }, { path: '/usage/stats' }), (error) => {
    assert.doesNotMatch(error.guidance, /MCP/);
    return true;
  });
});

test('a request cancelled by the caller carries a cancelled detail the long-running mapper can read', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    });
  try {
    const ctx = { apiKey: ENV_KEY, baseUrl: ALLOWED_URL, signal: controller.signal, longRunning: true };
    const pending = requestAgentApi(ctx, { method: 'POST', path: '/articles/generate' });
    controller.abort();
    await assert.rejects(pending, (error) => {
      assert.equal(error.cliCode, CliErrorCode.NETWORK_ERROR);
      assert.deepEqual(error.details, { cancelled: true, long_running: true });
      assert.match(error.guidance, /cancelled the request/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const cancelled = () =>
  codedError(CliErrorCode.NETWORK_ERROR, 'Request failed: aborted', 'g', { cancelled: true, long_running: true });

const makeCtx = (surface) => ({
  surface,
  usageGuidance: MCP_USAGE_GUIDANCE,
  ref: (id) => id.replaceAll('.', '_'),
});

const command = (overrides = {}) =>
  defineCommand({
    id: 'x.run',
    summary: 'Run.',
    kind: CommandKind.WRITE,
    toolsets: [Toolset.CORE],
    input: { productId: uuid().required() },
    run: async () => ({ ok: true, data: null, agent_guidance: 'done' }),
    ...overrides,
  });

test('a cancelled long-running command may still be running; an ordinary one is a network error', async () => {
  const failing = { run: async () => { throw cancelled(); } };
  const longRunning = await executeCommand({
    spec: command({ ...failing, longRunning: { pollTool: POLL_TOOL } }),
    raw: { productId: PRODUCT_ID },
    ctx: makeCtx(Surface.MCP),
  });
  assert.equal(longRunning.error.code, CliErrorCode.OPERATION_MAY_STILL_BE_RUNNING);
  assert.match(longRunning.agent_guidance, /Do not retry; poll x_status/);
  const ordinary = await executeCommand({
    spec: command(failing),
    raw: { productId: PRODUCT_ID },
    ctx: makeCtx(Surface.MCP),
  });
  assert.equal(ordinary.error.code, CliErrorCode.NETWORK_ERROR);
});

test('list values are split on commas for the CLI and kept whole for MCP', async () => {
  const spec = command({
    input: { urls: list().required() },
    run: async (input) => ({ ok: true, data: input.urls, agent_guidance: 'done' }),
  });
  const raw = { urls: ['https://example.com/a,b', 'https://example.com/c'] };
  const fromCli = await executeCommand({ spec, raw, ctx: makeCtx(Surface.CLI) });
  assert.deepEqual(fromCli.data, ['https://example.com/a', 'b', 'https://example.com/c']);
  const fromMcp = await executeCommand({ spec, raw, ctx: makeCtx(Surface.MCP) });
  assert.deepEqual(fromMcp.data, ['https://example.com/a,b', 'https://example.com/c']);
});

test('the mcp command line resolves toolsets, read-only, profile and upload directory, flags over environment', () => {
  const defaults = resolveMcpOptions({ argv: [], env: {}, cwd: CWD });
  assert.equal(defaults.startupError, null);
  assert.equal(defaults.readOnly, false);
  assert.equal(defaults.profile, undefined);
  assert.equal(defaults.uploadDir, CWD);
  assert.equal(defaults.override.kind, 'auto');

  const fromEnv = resolveMcpOptions({
    argv: [],
    env: { OUTRANK_MCP_TOOLSETS: 'keywords', OUTRANK_MCP_READ_ONLY: '1', OUTRANK_MCP_UPLOAD_DIR: 'uploads' },
    cwd: CWD,
  });
  assert.deepEqual(fromEnv.override.toolsets, ['keywords']);
  assert.equal(fromEnv.readOnly, true);
  assert.equal(fromEnv.uploadDir, path.join(CWD, 'uploads'));

  const fromFlags = resolveMcpOptions({
    argv: ['--toolsets=articles,gsc', '--read-only=false', '--profile', 'acme', '--upload-dir', 'images'],
    env: { OUTRANK_MCP_TOOLSETS: 'keywords', OUTRANK_MCP_READ_ONLY: '1', OUTRANK_MCP_UPLOAD_DIR: 'uploads' },
    cwd: CWD,
  });
  assert.deepEqual(fromFlags.override.toolsets, ['articles', 'gsc']);
  assert.equal(fromFlags.readOnly, false);
  assert.equal(fromFlags.profile, 'acme');
  assert.equal(fromFlags.uploadDir, path.join(CWD, 'images'));
});

test('an invalid mcp command line becomes a startup error instead of an exception', () => {
  const cases = [
    [['--api-key', ENV_KEY], /^--api-key is not accepted by the MCP server\.$/],
    [['--base-url', EVIL_URL], /^--base-url is not accepted by the MCP server\.$/],
    [['--allow-custom-base-url'], /^--allow-custom-base-url is not accepted by the MCP server\.$/],
    [['--toolset', 'all'], /^Unknown option: "--toolset"\.$/],
    [['serve'], /^Unexpected argument: "serve"\.$/],
    [['--profile'], /^Missing value for --profile\.$/],
    [['--toolsets', '--read-only'], /^Missing value for --toolsets\.$/],
    [['--toolsets='], /^Missing value for --toolsets\.$/],
    [['--read-only=yes'], /^--read-only accepts only true or false\.$/],
    [['--profile', 'a', '--profile', 'b'], /^--profile was given more than once\.$/],
  ];
  for (const [argv, pattern] of cases) {
    const { startupError } = resolveMcpOptions({ argv, env: {}, cwd: CWD });
    assert.equal(startupError.ok, false, argv.join(' '));
    assert.equal(startupError.error.code, CliErrorCode.INVALID_USAGE, argv.join(' '));
    assert.match(startupError.error.message, pattern);
  }
  const withKey = resolveMcpOptions({ argv: ['--api-key', ENV_KEY], env: {}, cwd: CWD });
  assert.equal(JSON.stringify(withKey.startupError).includes(ENV_KEY), false);
});

test('the home directory and filesystem roots are too broad to be an upload directory', () => {
  const home = path.resolve('home', 'someone');
  const root = path.parse(home).root;
  assert.equal(describeBroadUploadDir(home, home), 'it is the home directory');
  assert.equal(describeBroadUploadDir(root, home), 'it is a filesystem root');
  assert.equal(describeBroadUploadDir(path.join(home, 'project'), home), null);
  const options = resolveMcpOptions({ argv: [], env: {}, cwd: home, homeDir: home });
  assert.equal(options.uploadDirProblem, 'it is the home directory');
  const narrowed = resolveMcpOptions({ argv: ['--upload-dir', 'images'], env: {}, cwd: home, homeDir: home });
  assert.equal(narrowed.uploadDirProblem, null);
});

test('a mistyped toolset name in the flag or the environment is a startup error naming the valid toolsets', () => {
  for (const [argv, env] of [
    [['--toolsets', 'keywrds'], {}],
    [[], { OUTRANK_MCP_TOOLSETS: 'keywrds' }],
  ]) {
    const { startupError, override } = resolveMcpOptions({ argv, env, cwd: CWD });
    assert.equal(startupError.error.message, 'Unknown toolset: "keywrds".');
    assert.match(startupError.agent_guidance, /Toolsets are: core, integrations, gsc, linking, backlinks, keywords/);
    assert.equal(override.kind, 'auto');
  }
  const mixed = resolveMcpOptions({ argv: ['--toolsets', 'all,keywords'], env: {}, cwd: CWD });
  assert.equal(mixed.startupError.error.message, 'auto and all cannot be combined with other toolset names.');
});
