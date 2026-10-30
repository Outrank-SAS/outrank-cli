import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ENTITLEMENT_CHANGING_COMMAND_IDS } from '../src/adapters/mcp/constants.js';
import { registry } from '../src/commands/index.js';
import { CommandKind } from '../src/commands/registry.js';
import { WHOAMI_PATHNAME, jsonResponse, readWhoamiFixture, respondWith, withMcp } from './helpers/mcpHarness.js';

const BRAND_NEW_TOOL_COUNT = 35;
const MIXED_TOOL_COUNT = 246;
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CREATE_BODY = {
  name: 'Example',
  url: 'https://example.com',
  description: 'Example sells project management software for small teams that plan work together.',
  target_audiences: ['Small business owners', 'Project managers', 'Team leads'],
  language: 'en',
  keyword_region: 'us',
  competitors: [
    { name: 'Alpha', link: 'https://alpha.example.com' },
    { name: 'Beta', link: 'https://beta.example.com' },
    { name: 'Gamma', link: 'https://gamma.example.com' },
  ],
};
const CREATED_ENVELOPE = { ok: true, data: { id: PRODUCT_ID }, agent_guidance: 'Created.' };
const FAILED_ENVELOPE = { ok: false, error: { code: 'INVALID_REQUEST', message: 'Bad.' }, agent_guidance: 'Fix.' };
const BAD_REQUEST_STATUS = 400;
const SERVER_ERROR_STATUS = 500;
const UNAUTHORIZED_STATUS = 401;
const failedEnvelope = (code, message, agentGuidance) => ({
  ok: false,
  error: { code, message },
  agent_guidance: agentGuidance,
});
const SERVER_ERROR_ENVELOPE = failedEnvelope('INTERNAL_ERROR', 'Down.', 'Retry.');
const KEY_REVOKED_ENVELOPE = failedEnvelope('AUTH_KEY_REVOKED', 'Revoked.', 'Stop.');

const sequencedWhoami = (fixtures) => {
  let whoamiCalls = 0;
  const respond = (request, other) => {
    if (request.pathname !== WHOAMI_PATHNAME) return other(request);
    const fixture = fixtures[Math.min(whoamiCalls, fixtures.length - 1)];
    whoamiCalls += 1;
    return jsonResponse(200, readWhoamiFixture(fixture));
  };
  return { respond, whoamiCalls: () => whoamiCalls };
};

test('the entitlement-changing list names registered MCP commands that write', () => {
  for (const id of ENTITLEMENT_CHANGING_COMMAND_IDS) {
    const spec = registry.byId.get(id);
    assert.ok(spec, `${id} is not a command`);
    assert.notEqual(spec.mcp, false, `${id} is not a tool`);
    assert.notEqual(spec.kind, CommandKind.LOCAL, `${id} makes no request`);
  }
});

test('a successful product creation re-reads the organization and announces the new tool list', async () => {
  const sequence = sequencedWhoami(['brand-new', 'mixed']);
  const other = () => jsonResponse(200, CREATED_ENVELOPE);
  await withMcp({ respond: (request) => sequence.respond(request, other) }, async (harness) => {
    assert.equal((await harness.listToolNames()).length, BRAND_NEW_TOOL_COUNT);
    const { envelope } = await harness.call('products_create', { body: CREATE_BODY });
    assert.equal(envelope.ok, true);
    assert.equal(sequence.whoamiCalls(), 2);
    await harness.session.whenIdle();
    assert.equal((await harness.listToolNames()).length, MIXED_TOOL_COUNT);
    assert.equal(harness.toolListChanges(), 1);
  });
});

test('a failed entitlement-changing call and an unrelated write leave the organization lookup alone', async () => {
  const sequence = sequencedWhoami(['brand-new', 'mixed']);
  const other = (request) =>
    request.method === 'POST' && request.pathname.endsWith('/products')
      ? jsonResponse(BAD_REQUEST_STATUS, FAILED_ENVELOPE)
      : jsonResponse(200, CREATED_ENVELOPE);
  await withMcp({ respond: (request) => sequence.respond(request, other) }, async (harness) => {
    const failed = await harness.call('products_create', { body: CREATE_BODY });
    assert.equal(failed.envelope.ok, false);
    const unrelated = await harness.call('products_update', { product_id: PRODUCT_ID, body: CREATE_BODY });
    assert.equal(unrelated.envelope.ok, true);
    await harness.session.whenIdle();
    assert.equal(sequence.whoamiCalls(), 1);
    assert.equal((await harness.listToolNames()).length, BRAND_NEW_TOOL_COUNT);
    assert.deepEqual(harness.notifications, []);
  });
});

test('a refresh that fails keeps the known tool list; a rejected key still drops it', async () => {
  let whoamiCalls = 0;
  const respond = (request, other) => {
    if (request.pathname !== WHOAMI_PATHNAME) return other(request);
    whoamiCalls += 1;
    if (whoamiCalls === 1) return jsonResponse(200, readWhoamiFixture('mixed'));
    return jsonResponse(SERVER_ERROR_STATUS, SERVER_ERROR_ENVELOPE);
  };
  await withMcp({ respond: (request) => respond(request, respondWith()) }, async (harness) => {
    assert.equal((await harness.listToolNames()).length, MIXED_TOOL_COUNT);
    const { envelope } = await harness.call('products_resume', { product_id: PRODUCT_ID });
    assert.equal(envelope.ok, true);
    await harness.session.whenIdle();
    assert.equal(whoamiCalls, 2);
    assert.equal(harness.session.identity().status, 'ok');
    assert.equal((await harness.listToolNames()).length, MIXED_TOOL_COUNT);
    assert.deepEqual(harness.notifications, []);
  });
  whoamiCalls = 0;
  const rejecting = (request, other) => {
    if (request.pathname !== WHOAMI_PATHNAME) return other(request);
    whoamiCalls += 1;
    if (whoamiCalls === 1) return jsonResponse(200, readWhoamiFixture('mixed'));
    return jsonResponse(UNAUTHORIZED_STATUS, KEY_REVOKED_ENVELOPE);
  };
  await withMcp({ respond: (request) => rejecting(request, respondWith()) }, async (harness) => {
    await harness.call('products_resume', { product_id: PRODUCT_ID });
    await harness.session.whenIdle();
    assert.equal(harness.session.identity().status, 'failed');
    assert.equal((await harness.listToolNames()).length, BRAND_NEW_TOOL_COUNT);
  });
});

test('a key rejection answered to a tool call drops the identity and the tool list at once', async () => {
  let whoamiCalls = 0;
  const respond = (request) => {
    if (request.pathname === WHOAMI_PATHNAME) {
      whoamiCalls += 1;
      return jsonResponse(200, readWhoamiFixture('mixed'));
    }
    return jsonResponse(UNAUTHORIZED_STATUS, KEY_REVOKED_ENVELOPE);
  };
  await withMcp({ respond }, async (harness) => {
    assert.equal((await harness.listToolNames()).length, MIXED_TOOL_COUNT);
    const { envelope } = await harness.call('products_get', { product_id: PRODUCT_ID });
    assert.equal(envelope.error.code, 'AUTH_KEY_REVOKED');
    assert.equal(harness.session.identity().status, 'failed');
    assert.equal((await harness.listToolNames()).length, BRAND_NEW_TOOL_COUNT);
    assert.equal(whoamiCalls, 1);
  });
});

test('a refresh that lands the same entitlements sends no notification', async () => {
  const sequence = sequencedWhoami(['mixed', 'mixed']);
  await withMcp({ respond: (request) => sequence.respond(request, respondWith()) }, async (harness) => {
    const { envelope } = await harness.call('products_resume', { product_id: PRODUCT_ID });
    assert.equal(envelope.ok, true);
    await harness.session.whenIdle();
    assert.equal(sequence.whoamiCalls(), 2);
    assert.deepEqual(harness.notifications, []);
  });
});
