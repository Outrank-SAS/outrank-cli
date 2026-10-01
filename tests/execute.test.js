import { test } from 'node:test';
import assert from 'node:assert/strict';

import { BodyMode, CommandKind, Toolset, defineCommand } from '../src/commands/registry.js';
import { LONG_RUNNING_GATEWAY_STATUSES } from '../src/core/constants.js';
import {
  CliErrorCode,
  MCP_USAGE_GUIDANCE,
  USAGE_GUIDANCE,
  cliError,
  codedError,
  usageError,
} from '../src/core/errors.js';
import { executeCommand } from '../src/core/execute.js';
import { int, object, string, uuid } from '../src/core/schema.js';

const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const POLL_TOOL = 'x.status';
const SERVER_ERROR_STATUS = 500;
const LIMIT_MAX = 10;

const labels = {
  labelOf: (field) => `<${field}>`,
  missingOf: (field) => `Missing ${field}.`,
};

const makeCtx = (overrides = {}) => ({
  surface: 'cli',
  usageGuidance: USAGE_GUIDANCE,
  longRunning: undefined,
  ref: (id, args = {}) => `ref:${id}:${JSON.stringify(args)}`,
  ...overrides,
});

const echo = (input, ctx) => ({ ok: true, data: { input, longRunning: ctx.longRunning }, agent_guidance: 'echo' });

const command = (overrides = {}) =>
  defineCommand({
    id: 'x.run',
    summary: 'Run.',
    kind: CommandKind.READ,
    toolsets: [Toolset.CORE],
    input: { productId: uuid().required(), limit: int({ min: 1, max: LIMIT_MAX }) },
    run: echo,
    ...overrides,
  });

const execute = (spec, raw, extra = {}) => executeCommand({ spec, raw, labels, ctx: makeCtx(), ...extra });

test('validation failures are CLI_INVALID_USAGE envelopes with the adapter labels and surface guidance', async () => {
  const missing = await execute(command(), {});
  assert.deepEqual(missing, {
    ok: false,
    error: { code: CliErrorCode.INVALID_USAGE, message: 'Missing productId.' },
    agent_guidance: USAGE_GUIDANCE,
  });
  const invalid = await execute(command(), { productId: 'nope' });
  assert.equal(invalid.error.message, '<productId> must be a UUID.');
  const mcp = await executeCommand({
    spec: command(),
    raw: {},
    labels,
    ctx: makeCtx({ surface: 'mcp', usageGuidance: MCP_USAGE_GUIDANCE }),
  });
  assert.equal(mcp.agent_guidance, MCP_USAGE_GUIDANCE);
});

test('the run handler receives validated, typed input and the validated input never leaks unknown keys', async () => {
  const result = await execute(command(), { productId: PRODUCT_ID, limit: '5', stray: 'x' });
  assert.deepEqual(result.data.input, { productId: PRODUCT_ID, limit: 5 });
});

test('refine runs after validation with the typed input and its usage error is the envelope', async () => {
  let seen;
  const spec = command({
    refine: (input, ctx) => {
      seen = { input, surface: ctx.surface };
      if (input.limit === LIMIT_MAX) throw usageError('limit is at the max.', 'lower it');
    },
  });
  const ok = await execute(spec, { productId: PRODUCT_ID, limit: '1' });
  assert.equal(ok.ok, true);
  assert.deepEqual(seen, { input: { productId: PRODUCT_ID, limit: 1 }, surface: 'cli' });
  const rejected = await execute(spec, { productId: PRODUCT_ID, limit: String(LIMIT_MAX) });
  assert.deepEqual(rejected, {
    ok: false,
    error: { code: CliErrorCode.INVALID_USAGE, message: 'limit is at the max.' },
    agent_guidance: 'lower it',
  });
  const notValidated = await execute(spec, { productId: 'bad' });
  assert.equal(notValidated.error.message, '<productId> must be a UUID.');
});

test('body modes: JSON requires a body, OPTIONAL_JSON omits it, OR_EMPTY_OBJECT and EMPTY_OBJECT send {}', async () => {
  const bodyOf = async (body, loadBody) => {
    const result = await execute(command({ input: {}, body }), {}, { loadBody });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.data.input;
  };
  const missing = await execute(command({ input: {}, body: BodyMode.JSON }), {});
  assert.equal(missing.error.message, 'Missing body.');
  assert.deepEqual(await bodyOf(BodyMode.JSON, async () => ({ a: 1 })), { body: { a: 1 } });
  assert.deepEqual(await bodyOf(BodyMode.OPTIONAL_JSON, async () => undefined), {});
  assert.deepEqual(await bodyOf(BodyMode.OPTIONAL_JSON, async () => ({ a: 1 })), { body: { a: 1 } });
  assert.deepEqual(await bodyOf(BodyMode.OPTIONAL_JSON_OR_EMPTY_OBJECT, async () => undefined), { body: {} });
  assert.deepEqual(await bodyOf(BodyMode.EMPTY_OBJECT), { body: {} });
  assert.deepEqual(await bodyOf(BodyMode.NONE), {});
  assert.deepEqual(await bodyOf({ fixed: true }), { body: { fixed: true } });
});

test('a JSON body that is not an object is rejected for object-typed bodies and accepted for json bodies', async () => {
  const objectBody = command({ input: {}, bodyField: object(), body: BodyMode.JSON });
  const rejected = await execute(objectBody, {}, { loadBody: async () => [1] });
  assert.equal(rejected.error.message, '<body> must be a JSON object.');
  const jsonBody = command({ input: {}, body: BodyMode.JSON });
  const accepted = await execute(jsonBody, {}, { loadBody: async () => [1] });
  assert.deepEqual(accepted.data.input, { body: [1] });
});

test('bodyMerge copies typed inputs into the body and the explicit input wins over the body key', async () => {
  const spec = command({
    input: { productId: uuid().required() },
    bodyField: object(),
    body: BodyMode.JSON,
    bodyMerge: { product_id: 'productId' },
  });
  const loadBody = async () => ({ product_id: 'old', k: 1 });
  const result = await execute(spec, { productId: PRODUCT_ID }, { loadBody });
  assert.deepEqual(result.data.input.body, { product_id: PRODUCT_ID, k: 1 });
});

test('loadBody errors are returned as envelopes, never thrown', async () => {
  const spec = command({ input: {}, body: BodyMode.JSON });
  const result = await execute(spec, {}, { loadBody: async () => { throw usageError('Invalid JSON in --json: x'); } });
  assert.equal(result.error.code, CliErrorCode.INVALID_USAGE);
  assert.equal(result.error.message, 'Invalid JSON in --json: x');
});

test('ctx.longRunning follows the spec, so only long-running commands get the long HTTP timeout', async () => {
  const short = await execute(command(), { productId: PRODUCT_ID });
  assert.equal(short.data.longRunning, false);
  const long = await execute(command({ longRunning: { pollTool: POLL_TOOL } }), { productId: PRODUCT_ID });
  assert.equal(long.data.longRunning, true);
});

test('a gateway 502/504 without an envelope on a long-running command may still be running', async () => {
  for (const status of LONG_RUNNING_GATEWAY_STATUSES) {
    const upstream = cliError(CliErrorCode.UPSTREAM_ERROR, `HTTP ${status}`, 'g', { status, url: 'u', body: 'b' });
    const spec = command({ longRunning: { pollTool: POLL_TOOL }, run: async () => upstream });
    const result = await execute(spec, { productId: PRODUCT_ID });
    assert.equal(result.error.code, CliErrorCode.OPERATION_MAY_STILL_BE_RUNNING);
    assert.equal(result.error.message, `HTTP ${status}`);
    assert.deepEqual(result.error.details, { status, url: 'u', body: 'b' });
    assert.match(result.agent_guidance, /Do not retry; poll ref:x\.status:\{\}/);
  }
  const serverError = cliError(CliErrorCode.UPSTREAM_ERROR, 'HTTP 500', 'g', { status: SERVER_ERROR_STATUS });
  const stays = await execute(
    command({ longRunning: { pollTool: POLL_TOOL }, run: async () => serverError }),
    { productId: PRODUCT_ID },
  );
  assert.equal(stays.error.code, CliErrorCode.UPSTREAM_ERROR);
  const [gatewayStatus] = LONG_RUNNING_GATEWAY_STATUSES;
  const notLongRunning = cliError(CliErrorCode.UPSTREAM_ERROR, 'HTTP 502', 'g', { status: gatewayStatus });
  const plain = await execute(command({ run: async () => notLongRunning }), { productId: PRODUCT_ID });
  assert.equal(plain.error.code, CliErrorCode.UPSTREAM_ERROR);
});

test('a timeout on a long-running command may still be running, any other network error is not', async () => {
  const timeoutDetails = { timed_out: true, long_running: true };
  const timeout = codedError(CliErrorCode.NETWORK_ERROR, 'timed out', 'g', timeoutDetails);
  const mapped = await execute(
    command({ longRunning: { pollTool: POLL_TOOL }, run: async () => { throw timeout; } }),
    { productId: PRODUCT_ID },
  );
  assert.equal(mapped.error.code, CliErrorCode.OPERATION_MAY_STILL_BE_RUNNING);
  assert.deepEqual(mapped.error.details, { timed_out: true, long_running: true });
  const refused = codedError(CliErrorCode.NETWORK_ERROR, 'refused', 'g', { timed_out: false });
  const kept = await execute(
    command({ longRunning: { pollTool: POLL_TOOL }, run: async () => { throw refused; } }),
    { productId: PRODUCT_ID },
  );
  assert.equal(kept.error.code, CliErrorCode.NETWORK_ERROR);
  const shortTimeout = await execute(command({ run: async () => { throw timeout; } }), { productId: PRODUCT_ID });
  assert.equal(shortTimeout.error.code, CliErrorCode.NETWORK_ERROR);
});

test('a handler that returns no envelope or throws a plain error is CLI_UNEXPECTED_ERROR', async () => {
  const nothing = await execute(command({ run: async () => undefined }), { productId: PRODUCT_ID });
  assert.equal(nothing.error.code, CliErrorCode.UNEXPECTED_ERROR);
  assert.match(nothing.error.message, /x\.run returned no result envelope/);
  const thrown = await execute(command({ run: async () => { throw new Error('boom'); } }), { productId: PRODUCT_ID });
  assert.equal(thrown.error.code, CliErrorCode.UNEXPECTED_ERROR);
  assert.equal(typeof thrown.agent_guidance, 'string');
  const coded = codedError(CliErrorCode.AUTH_REQUIRED, 'no key', 'login', { source: 'env' });
  const withDetails = await execute(command({ run: async () => { throw coded; } }), { productId: PRODUCT_ID });
  assert.deepEqual(withDetails, {
    ok: false,
    error: { code: CliErrorCode.AUTH_REQUIRED, message: 'no key', details: { source: 'env' } },
    agent_guidance: 'login',
  });
});

test('an empty required string reaches the schema untouched and is reported as a missing value', async () => {
  const spec = command({ input: { name: string().required() } });
  const result = await execute(spec, { name: '' });
  assert.equal(result.error.message, '<name> requires a value.');
});
