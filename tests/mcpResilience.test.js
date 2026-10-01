import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createLogger } from '../src/adapters/mcp/logger.js';
import { CliErrorCode } from '../src/core/errors.js';
import {
  STUB_API_KEY,
  WHOAMI_PATHNAME,
  delay,
  jsonResponse,
  readWhoamiFixture,
  respondWith,
  withMcp,
} from './helpers/mcpHarness.js';

const ALL_TOOL_COUNT = 154;
const FALLBACK_TOOL_COUNT = 32;
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SECOND_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const SHORT_TIMEOUT_MS = 40;
const SHORT_BUDGET_MS = 30;
const SLOW_LOOKUP_MS = 150;
const SETTLE_MS = 60;
const ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';
const ROTATED_KEY = 'outr_live_rotated_key';
const OLD_KEY = 'outr_live_old_key';
const DEEP_NESTING_LEVELS = 5_000;
const SHOPIFY_TOKEN = 'shpat_secret_value';
const ALL_TOOLSETS = ['--toolsets', 'all'];
const STUB_ENVELOPE = { ok: true, data: { stub: true }, agent_guidance: 'stub' };
const SHORT_TIMEOUTS = { requestTimeoutMs: SHORT_TIMEOUT_MS, longRunningTimeoutMs: SHORT_TIMEOUT_MS };

const hang = (request) =>
  new Promise((_resolve, reject) => {
    request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
  });

const transportFailure = (code, message) => () => {
  throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(message), { code }) });
};

const rejected = (code) => ({ ok: false, error: { code, message: 'rejected' }, agent_guidance: 'Create a new key.' });

test('a publishing call that times out says the post may be published and names what to check', async () => {
  const respond = respondWith({ other: hang });
  await withMcp({ argv: ALL_TOOLSETS, respond, timeouts: SHORT_TIMEOUTS }, async ({ call }) => {
    const retry = await call('articles_retry_publish', { article_id: SECOND_ID });
    assert.equal(retry.envelope.error.code, CliErrorCode.OPERATION_MAY_STILL_BE_RUNNING);
    assert.match(retry.envelope.agent_guidance, /Do not retry; poll articles_get/);
    const push = await call('improvements_executions_push', { execution_id: SECOND_ID });
    assert.equal(push.envelope.error.code, CliErrorCode.OPERATION_MAY_STILL_BE_RUNNING);
    assert.match(push.envelope.agent_guidance, /Do not retry; poll improvements_executions_get/);
  });
});

test('an ordinary write that times out reports an unknown outcome, never a plain retry', async () => {
  const respond = respondWith({ other: hang });
  await withMcp({ argv: ALL_TOOLSETS, respond, timeouts: SHORT_TIMEOUTS }, async ({ call }) => {
    const write = await call('products_update', { product_id: PRODUCT_ID, body: { name: 'Acme' } });
    assert.equal(write.envelope.error.code, CliErrorCode.NETWORK_ERROR);
    assert.match(write.envelope.agent_guidance, /outcome is unknown: the change may have been applied/);
    assert.doesNotMatch(write.envelope.agent_guidance, /then retry/);
    const cancel = await call('marketplace_buyer_change_plan', {
      product_id: PRODUCT_ID,
      action: 'cancel_subscription',
      confirm_subscription_id: 'sub_123',
    });
    assert.match(cancel.envelope.agent_guidance, /outcome is unknown/);
    const read = await call('usage_stats', {});
    assert.match(read.envelope.agent_guidance, /then retry\.$/);
  });
});

test('a connection dropped mid-request on a long-running tool may still be running', async () => {
  const respond = respondWith({ other: transportFailure('UND_ERR_SOCKET', 'other side closed') });
  await withMcp({ argv: ALL_TOOLSETS, respond }, async ({ call }) => {
    for (const [tool, args, poll] of [
      ['keywords_generate', { product_id: PRODUCT_ID, count: 5 }, 'keywords_generation_status'],
      ['improvements_analyze', { product_id: PRODUCT_ID }, 'improvements_executions_list'],
      ['articles_generate', { keyword_id: SECOND_ID }, 'articles_list'],
    ]) {
      const { envelope } = await call(tool, args);
      assert.equal(envelope.error.code, CliErrorCode.OPERATION_MAY_STILL_BE_RUNNING, tool);
      assert.match(envelope.agent_guidance, new RegExp(`Do not retry; poll ${poll}`), tool);
    }
    const write = await call('keywords_delete', { keyword_id: SECOND_ID });
    assert.equal(write.envelope.error.code, CliErrorCode.NETWORK_ERROR);
    assert.deepEqual(write.envelope.error.details, { outcome_unknown: true, long_running: false });
    const read = await call('usage_stats', {});
    assert.equal(read.envelope.error.details, undefined);
  });
});

test('a request that never left the machine is a plain network error, even for a long-running tool', async () => {
  for (const code of ['ECONNREFUSED', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT']) {
    const respond = respondWith({ other: transportFailure(code, 'connect failed') });
    await withMcp({ argv: ALL_TOOLSETS, respond }, async ({ call }) => {
      const { envelope } = await call('improvements_analyze', { product_id: PRODUCT_ID });
      assert.equal(envelope.error.code, CliErrorCode.NETWORK_ERROR, code);
      assert.equal(envelope.error.details, undefined, code);
      assert.match(envelope.agent_guidance, /then retry\.$/, code);
    });
  }
});

test('a slow startup lookup that fails later does not undo a newer successful lookup', async () => {
  let whoamiCalls = 0;
  const respond = async (request) => {
    if (request.pathname !== WHOAMI_PATHNAME) return jsonResponse(200, STUB_ENVELOPE);
    whoamiCalls += 1;
    if (whoamiCalls > 1) return jsonResponse(200, readWhoamiFixture('mixed'));
    await delay(SLOW_LOOKUP_MS);
    return new Response('bad gateway', { status: 502, headers: { 'content-type': 'text/plain' } });
  };
  const timeouts = { startupResolveMs: SHORT_BUDGET_MS };
  await withMcp({ respond, timeouts }, async ({ call, session, listToolNames, notifications }) => {
    const { envelope } = await call('auth_whoami', {});
    assert.equal(envelope.ok, true);
    assert.equal((await listToolNames()).length, ALL_TOOL_COUNT);
    await session.whenIdle();
    await delay(SETTLE_MS);
    assert.equal(session.identity().status, 'ok');
    assert.equal((await listToolNames()).length, ALL_TOOL_COUNT);
    assert.equal(notifications.length, 1);
    assert.equal(whoamiCalls, 2);
  });
});

test('a failing organization lookup is retried on the first call, then at most once per interval', async () => {
  let whoamiCalls = 0;
  const respond = (request) => {
    if (request.pathname !== WHOAMI_PATHNAME) return jsonResponse(200, STUB_ENVELOPE);
    whoamiCalls += 1;
    return jsonResponse(429, rejected('RATE_LIMIT_EXCEEDED'));
  };
  await withMcp({ respond }, async ({ call }) => {
    await call('usage_stats', {});
    await call('usage_stats', {});
    await call('usage_stats', {});
    assert.equal(whoamiCalls, 2);
  });
  whoamiCalls = 0;
  await withMcp({ respond, timeouts: { identityRetryIntervalMs: 0 } }, async ({ call }) => {
    await call('usage_stats', {});
    await call('usage_stats', {});
    assert.equal(whoamiCalls, 3);
  });
});

test('a key replaced with auth login after it was rejected is picked up without a restart', async () => {
  let storedKey = OLD_KEY;
  const respond = (request) => {
    const isOld = request.headers.Authorization === `Bearer ${OLD_KEY}`;
    if (isOld) return jsonResponse(401, rejected('AUTH_KEY_REVOKED'));
    return request.pathname === WHOAMI_PATHNAME
      ? jsonResponse(200, readWhoamiFixture('mixed'))
      : jsonResponse(200, STUB_ENVELOPE);
  };
  const config = () => ({ profiles: { default: { apiKey: storedKey } } });
  await withMcp({ env: {}, respond, config }, async ({ call, calls, listToolNames }) => {
    const refused = await call('usage_stats', {});
    assert.equal(refused.envelope.error.code, 'AUTH_KEY_REVOKED');
    assert.equal((await listToolNames()).length, FALLBACK_TOOL_COUNT);
    storedKey = ROTATED_KEY;
    const accepted = await call('usage_stats', {});
    assert.equal(accepted.envelope.ok, true);
    assert.equal(calls.at(-1).headers.Authorization, `Bearer ${ROTATED_KEY}`);
    assert.equal(accepted.envelope.organization.id, ORGANIZATION_ID);
    assert.equal((await listToolNames()).length, ALL_TOOL_COUNT);
  });
});

test('a working key is not swapped when the stored key changes underneath a running server', async () => {
  let storedKey = OLD_KEY;
  const config = () => ({ profiles: { default: { apiKey: storedKey } } });
  await withMcp({ env: {}, config }, async ({ call, calls }) => {
    await call('usage_stats', {});
    storedKey = ROTATED_KEY;
    await call('usage_stats', {});
    assert.equal(calls.at(-1).headers.Authorization, `Bearer ${OLD_KEY}`);
  });
});

test('shutting the session down aborts requests that are still in flight', async () => {
  const respond = respondWith({ other: hang });
  await withMcp({ argv: ALL_TOOLSETS, respond }, async ({ client, session, calls }) => {
    const pending = client.callTool({ name: 'improvements_analyze', arguments: { product_id: PRODUCT_ID } });
    await delay(SHORT_BUDGET_MS);
    assert.equal(calls.at(-1).signal.aborted, false);
    session.shutdown();
    const result = await pending;
    assert.equal(calls.at(-1).signal.aborted, true);
    assert.equal(result.structuredContent.error.code, CliErrorCode.OPERATION_MAY_STILL_BE_RUNNING);
  });
});

test('the debug log redacts any key that looks like a secret and survives absurdly deep arguments', async () => {
  const lines = [];
  const logger = createLogger({ enabled: true, write: (line) => lines.push(line) });
  let deep = { leaf: true };
  for (let level = 0; level < DEEP_NESTING_LEVELS; level += 1) deep = { next: deep };
  await withMcp({ argv: ALL_TOOLSETS, logger }, async ({ call }) => {
    await call('products_update', {
      product_id: PRODUCT_ID,
      body: { settings: { shopify_access_token: SHOPIFY_TOKEN, clientSecret: SHOPIFY_TOKEN, name: 'Acme' } },
    });
    const { result } = await call('products_update', { product_id: PRODUCT_ID, body: deep });
    assert.equal(typeof result.structuredContent.ok, 'boolean');
  });
  const output = lines.join('');
  assert.equal(output.includes(SHOPIFY_TOKEN), false);
  assert.equal(output.includes(STUB_API_KEY), false);
  assert.match(lines[0], /"shopify_access_token":"<redacted>","clientSecret":"<redacted>","name":"Acme"/);
  assert.match(lines[1], /<nested too deeply>/);
});
