import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  collectJsonParseMessages,
  createJsonParseErrorNormalizer,
  normalizePathSeparators,
  parseJsonOutput,
  runCli,
} from './helpers/runCli.js';

const STUB_KEY = 'outr_live_test_key';
const OTHER_STUB_KEY = 'outr_live_other_key';
const CONFIG_WITH_KEY = { apiKey: STUB_KEY, baseUrl: 'https://www.outrank.so' };

test('runCli records the request, labels the Authorization key and returns the CLI envelope', async () => {
  const result = await runCli(['usage', 'stats'], { config: CONFIG_WITH_KEY });
  assert.equal(result.exitCode, 0);
  assert.equal(result.requests.length, 1);
  assert.equal(result.requests[0].method, 'GET');
  assert.equal(result.requests[0].url, 'https://www.outrank.so/api/agent/v1/usage/stats');
  assert.equal(result.requests[0].headers.Authorization, 'Bearer <API_KEY-1>');
  assert.deepEqual(parseJsonOutput(result.stdout), { ok: true, data: { stub: true }, agent_guidance: 'stub' });
});

test('the recorded Authorization header tells which of several known keys the CLI sent', async () => {
  const result = await runCli(['usage', 'stats'], {
    config: CONFIG_WITH_KEY,
    env: { OUTRANK_API_KEY: OTHER_STUB_KEY },
  });
  assert.equal(result.requests[0].headers.Authorization, 'Bearer <API_KEY-2>');
});

test('runCli isolates config: no key means CLI_AUTH_REQUIRED and no request', async () => {
  const result = await runCli(['usage', 'stats']);
  assert.equal(result.exitCode, 1);
  assert.equal(result.requests.length, 0);
  assert.equal(parseJsonOutput(result.stdout).error.code, 'CLI_AUTH_REQUIRED');
});

test('runCli normalizes the config path with POSIX separators and the version', async () => {
  const status = await runCli(['auth', 'status'], { config: CONFIG_WITH_KEY });
  assert.equal(parseJsonOutput(status.stdout).data.config_path, '<CONFIG_DIR>/config.json');
  const version = await runCli(['--version']);
  assert.equal(parseJsonOutput(version.stdout).data.version, '<VERSION>');
});

test('normalizePathSeparators rewrites Windows separators only after a path placeholder', () => {
  const windowsJson = '{"path": "<REPO_ROOT>\\\\tests\\\\golden\\\\a.png", "text": "keep \\\\n escapes"}';
  assert.equal(
    normalizePathSeparators(windowsJson),
    '{"path": "<REPO_ROOT>/tests/golden/a.png", "text": "keep \\\\n escapes"}',
  );
  assert.equal(normalizePathSeparators("open '<CONFIG_DIR>\\config.json'"), "open '<CONFIG_DIR>/config.json'");
  assert.equal(normalizePathSeparators('<CONFIG_DIR>/config.json'), '<CONFIG_DIR>/config.json');
});

test('normalizePathSeparators keeps JSON escapes that follow a placeholder path', () => {
  assert.equal(normalizePathSeparators('"<CONFIG_DIR>\\\\a.json\\nHint"'), '"<CONFIG_DIR>/a.json\\nHint"');
  assert.equal(normalizePathSeparators('"<CONFIG_DIR>/a.json\\tTab"'), '"<CONFIG_DIR>/a.json\\tTab"');
  assert.equal(normalizePathSeparators('"<CONFIG_DIR>\\\\node_modules\\\\x"'), '"<CONFIG_DIR>/node_modules/x"');
  assert.equal(normalizePathSeparators('"<CONFIG_DIR>\\\\"'), '"<CONFIG_DIR>/"');
  assert.equal(normalizePathSeparators('"<CONFIG_DIR>\\\\a\\u0041"'), '"<CONFIG_DIR>/a\\u0041"');
});

test('runCli fails loudly when the preload cannot record, instead of reporting zero requests', async () => {
  await assert.rejects(
    runCli(['usage', 'stats'], { config: CONFIG_WITH_KEY, env: { OUTRANK_TEST_RECORDING_FILE: '' } }),
    /HARNESS ERROR/,
  );
});

test('runCli rejects response specs the stub cannot serve, so the CLI never prints a fake network error', async () => {
  await assert.rejects(
    runCli(['usage', 'stats'], { config: CONFIG_WITH_KEY, responses: [{ status: 99 }] }),
    /HARNESS ERROR: response 0 has status 99/,
  );
  await assert.rejects(
    runCli(['usage', 'stats'], { config: CONFIG_WITH_KEY, responses: [{ networkError: '' }] }),
    /HARNESS ERROR: response 0 has an empty or non-string networkError/,
  );
  await assert.rejects(
    runCli(['usage', 'stats'], { config: CONFIG_WITH_KEY, responses: [{ statusCode: 200 }] }),
    /HARNESS ERROR: response 0 has unknown keys: statusCode/,
  );
});

test('only the exact JSON.parse wording of this Node for the fixture inputs is replaced', async () => {
  const invalid = '{"a":}';
  const engineMessage = (() => {
    try {
      JSON.parse(invalid);
      return null;
    } catch (error) {
      return error.message;
    }
  })();
  const messages = collectJsonParseMessages({
    argv: ['products', 'create', '--json', invalid],
    stdin: undefined,
    rawConfig: undefined,
    responses: [{ rawBody: '{not json' }, { contentType: 'text/html', rawBody: '<html>' }],
    jsonFileContents: [],
  });
  assert.ok(messages.includes(engineMessage));
  const positionalMessage = (() => {
    try {
      JSON.parse('create');
      return null;
    } catch (error) {
      return error.message;
    }
  })();
  const htmlMessage = (() => {
    try {
      JSON.parse('<html>');
      return null;
    } catch (error) {
      return error.message;
    }
  })();
  assert.equal(messages.includes(positionalMessage), false);
  assert.equal(messages.includes(htmlMessage), false);
  const headerTyped = collectJsonParseMessages({
    argv: [],
    stdin: undefined,
    rawConfig: undefined,
    responses: [{ headers: { 'Content-Type': 'text/html' }, rawBody: '<html>' }],
    jsonFileContents: [],
  });
  assert.deepEqual(headerTyped, []);
  assert.throws(
    () =>
      collectJsonParseMessages({
        argv: ['products', 'create', '--json', '{', '--json', '['],
        stdin: undefined,
        rawConfig: undefined,
        responses: [],
        jsonFileContents: [],
      }),
    /HARNESS ERROR: --json appears more than once/,
  );
  const normalize = createJsonParseErrorNormalizer(messages);
  const escaped = JSON.stringify(engineMessage).slice(1, -1);
  assert.equal(
    normalize(`"message": "Invalid JSON in --json: ${escaped}"`),
    '"message": "Invalid JSON in --json: <JSON_PARSE_ERROR>"',
  );
  assert.equal(normalize(`plain ${engineMessage}`), 'plain <JSON_PARSE_ERROR>');
  const fixedText = '"message": "Invalid JSON in --json: malformed input"';
  assert.equal(normalize(fixedText), fixedText);
  const emptyTail = '"message": "Invalid JSON in --json: "';
  assert.equal(normalize(emptyTail), emptyTail);
  assert.equal(
    normalize(`"message": "Invalid JSON in --json: ${escaped} (check your shell quoting)"`),
    '"message": "Invalid JSON in --json: <JSON_PARSE_ERROR> (check your shell quoting)"',
  );
});

test('invalid JSON from --json, stdin, a file and a response body all produce Node-independent output', async () => {
  const invalid = '{not valid json';
  const inline = await runCli(['products', 'create', '--json', invalid], { config: CONFIG_WITH_KEY });
  assert.equal(inline.exitCode, 1);
  assert.equal(parseJsonOutput(inline.stdout).error.message, 'Invalid JSON in --json: <JSON_PARSE_ERROR>');

  const stdin = await runCli(['products', 'create', '--json-stdin'], { config: CONFIG_WITH_KEY, stdin: invalid });
  assert.equal(parseJsonOutput(stdin.stdout).error.message, 'Invalid JSON from stdin: <JSON_PARSE_ERROR>');

  const file = await runCli(['products', 'create', '--json-file', 'tests/golden/fixtures/payloads/invalid.json'], {
    config: CONFIG_WITH_KEY,
  });
  assert.equal(
    parseJsonOutput(file.stdout).error.message,
    'Invalid JSON in <REPO_ROOT>/tests/golden/fixtures/payloads/invalid.json: <JSON_PARSE_ERROR>',
  );

  const body = await runCli(['usage', 'stats'], { config: CONFIG_WITH_KEY, responses: [{ rawBody: invalid }] });
  assert.equal(body.exitCode, 1);
  assert.equal(parseJsonOutput(body.stdout).error.message, '<JSON_PARSE_ERROR>');
});

test('stderr paths are normalized without treating backslash-letter pairs as JSON escapes', () => {
  assert.equal(
    normalizePathSeparators('<REPO_ROOT>\\tests\\node_modules', { preserveJsonEscapes: false }),
    '<REPO_ROOT>/tests/node_modules',
  );
});

test('generated UUIDs are normalized, UUIDs given as input are kept', async () => {
  const productId = '11111111-2222-4333-8444-555555555555';
  const result = await runCli(['billing', 'purchase-products', 'quote', '--additional-products', '1'], {
    config: CONFIG_WITH_KEY,
    responses: [{ status: 409, body: { ok: false, error: { code: 'CONFLICT', details: { x: 1 } } } }],
  });
  assert.equal(result.requests[0].headers['Idempotency-Key'], '<UUID-1>');
  assert.match(result.stdout, /<UUID-1>/);

  const known = await runCli(['products', 'get', productId], { config: CONFIG_WITH_KEY });
  assert.equal(known.requests[0].url, `https://www.outrank.so/api/agent/v1/products/${productId}`);
});
