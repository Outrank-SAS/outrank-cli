import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ENTITLEMENT_CHANGING_COMMAND_IDS } from '../src/adapters/mcp/constants.js';
import { registry } from '../src/commands/index.js';
import { REPO_ROOT, STUB_API_KEY, WHOAMI_PATHNAME, withMcp } from './helpers/mcpHarness.js';

const SNAPSHOT_DIR = path.join(REPO_ROOT, 'tests', 'golden', 'snapshots');
const API_KEY_PLACEHOLDER = '<API_KEY-1>';
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SECOND_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const THIRD_ID = 'cccccccc-0000-4000-8000-000000000003';
const COMMAND_GROUP_COUNT = 15;

const CASES = [
  { fixture: 'auth/whoami', tool: 'auth_whoami', args: {} },
  { fixture: 'usage/stats', tool: 'usage_stats', args: {} },
  { fixture: 'subscription/status', tool: 'subscription_status', args: {} },
  {
    fixture: 'billing/buy-happy',
    tool: 'billing_purchase_products_buy',
    args: { additional_products: 2, confirm_charge_cents: 19800, idempotency_key: 'buy-key-1' },
  },
  {
    fixture: 'keywords/list-all-filters',
    tool: 'keywords_list',
    args: {
      product_id: PRODUCT_ID,
      scope: 'all',
      status: 'published',
      q: 'best seo tools',
      article_type: 'listicle',
      article_subtype: 'comparison',
      scheduled_from: '2026-01-01',
      scheduled_to: '2026-12-31',
      search_volume_min: 10,
      search_volume_max: 5000,
      difficulty_min: 0,
      difficulty_max: 100,
      limit: 25,
      offset: 5,
    },
  },
  {
    fixture: 'keywords/generate-source-competitors',
    tool: 'keywords_generate',
    args: { product_id: PRODUCT_ID, count: 10, source: 'competitors', competitors: [SECOND_ID, THIRD_ID] },
  },
  {
    fixture: 'keywords/add-json-inline',
    tool: 'keywords_add',
    args: { product_id: PRODUCT_ID, body: { keyword: 'best crm software' } },
  },
  {
    fixture: 'articles/update-json-inline',
    tool: 'articles_update',
    args: { article_id: SECOND_ID, body: { title: 'New title' } },
  },
  {
    fixture: 'improvements/tasks-execute-improve-images-false',
    tool: 'improvements_tasks_execute',
    args: { task_id: SECOND_ID, improve_images: false },
  },
  {
    fixture: 'improvements/executions-push-no-json',
    tool: 'improvements_executions_push',
    args: { execution_id: SECOND_ID },
  },
  {
    fixture: 'products/list-all-options',
    tool: 'products_list',
    args: { status: 'disabled', limit: 5, cursor: '2026-02-01T00:00:00.000Z' },
  },
  {
    fixture: 'productsIntegrations/poll',
    tool: 'products_integrations_poll',
    args: { provider: 'wordpress-com', product_id: PRODUCT_ID, attempt_id: 'attempt-123' },
  },
  {
    fixture: 'productsGsc/search-analytics-all-options',
    tool: 'products_gsc_search_analytics',
    args: {
      product_id: PRODUCT_ID,
      dimensions: 'query,page',
      limit: 50,
      months: 6,
      start_date: '2026-01-01',
      end_date: '2026-06-30',
      page: '/blog/post',
      query: 'outrank seo',
      country: 'usa',
      device: 'mobile',
    },
  },
  {
    fixture: 'productsLinking/targets-upsert-json-inline',
    tool: 'products_linking_targets_upsert',
    args: { product_id: PRODUCT_ID, body: { url: 'https://acme.example.com/features', priority: 1 } },
  },
  {
    fixture: 'productsBacklinks/earned-all-options',
    tool: 'products_backlinks_earned',
    args: {
      product_id: PRODUCT_ID,
      limit: 20,
      cursor: '2026-01-01T00:00:00.000Z',
      status: 'verified',
      sort_by: 'credits_applied',
      sort_order: 'desc',
      include_article: true,
      include_summary: true,
    },
  },
  {
    fixture: 'marketplaceSeller/integrations-claim-basic',
    tool: 'marketplace_seller_integrations_claim',
    args: { product_id: PRODUCT_ID, integration_id: SECOND_ID, integration_type: 'wordpress' },
  },
  {
    fixture: 'marketplaceNotifications/mark-read-ids-single-comma',
    tool: 'marketplace_notifications_mark_read',
    args: { product_id: PRODUCT_ID, role: 'seller', ids: ['id-1', 'id-2', 'id-3'] },
  },
  {
    fixture: 'marketplaceBuyer/target-pages-add-with-source',
    tool: 'marketplace_buyer_target_pages_add',
    args: { product_id: PRODUCT_ID, urls: ['https://example.com/features'], source: 'discovered' },
  },
  {
    fixture: 'marketplaceBuyer/change-plan-cancel-with-confirm-subscription-id',
    tool: 'marketplace_buyer_change_plan',
    args: { product_id: PRODUCT_ID, action: 'cancel_subscription', confirm_subscription_id: 'sub_123' },
  },
];

const readSnapshotRequests = (fixture) => {
  const [group, name] = fixture.split('/');
  const snapshot = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, `${group}.json`), 'utf8'));
  assert.ok(snapshot[name], `no golden snapshot for ${fixture}`);
  return snapshot[name].requests;
};

const sortKeys = (headers) => Object.fromEntries(Object.entries(headers).sort(([a], [b]) => a.localeCompare(b)));

const toRecordedShape = (request) => {
  const headers = sortKeys(request.headers);
  if (headers.Authorization) headers.Authorization = headers.Authorization.replace(STUB_API_KEY, API_KEY_PLACEHOLDER);
  return {
    method: request.method,
    url: request.url,
    headers,
    ...(request.body !== undefined ? { body: request.body } : {}),
  };
};

test('every command group is represented in the parity sample', () => {
  const groups = new Set(CASES.map((entry) => entry.fixture.split('/')[0]));
  assert.equal(groups.size, COMMAND_GROUP_COUNT);
});

test('an MCP tool call sends the same HTTP request as the equivalent CLI command', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, calls }) => {
    for (const { fixture, tool, args } of CASES) {
      const before = calls.length;
      const { envelope } = await call(tool, args);
      assert.equal(envelope.ok, true, `${tool}: ${JSON.stringify(envelope.error)}`);
      const recorded = calls.slice(before);
      const refreshesEntitlements = ENTITLEMENT_CHANGING_COMMAND_IDS.includes(registry.byToolName.get(tool).id);
      if (refreshesEntitlements) assert.equal(recorded.pop().pathname, WHOAMI_PATHNAME, `${tool} refresh`);
      assert.deepEqual(recorded.map(toRecordedShape), readSnapshotRequests(fixture), fixture);
    }
  });
});

test('a comma inside an MCP list item is kept, not split the way a CLI option value is', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, calls }) => {
    const url = 'https://example.com/a,b';
    await call('marketplace_buyer_target_pages_add', { product_id: PRODUCT_ID, urls: [url] });
    assert.deepEqual(calls.at(-1).body, { urls: [url] });
  });
});
