import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CLI_HELP_HINT, createGuidanceRewriter, rewriteGuidanceText } from '../src/adapters/mcp/guidance.js';
import { resolveMcpOptions } from '../src/adapters/mcp/options.js';
import { MULTI_REQUEST_COMMAND_IDS, ROUTE_TOOL_OVERRIDES } from '../src/adapters/mcp/routeOverrides.js';
import {
  buildRouteIndex,
  findRouteMentions,
  rewriteRouteMentions,
  unexpectedProbeFailures,
} from '../src/adapters/mcp/routes.js';
import { createMcpServer } from '../src/adapters/mcp/server.js';
import { registry } from '../src/commands/index.js';
import { CommandKind, Toolset, defineCommand } from '../src/commands/registry.js';
import { CliErrorCode, cliError, cliSuccess } from '../src/core/errors.js';
import {
  REPO_ROOT,
  STUB_VERSION,
  jsonResponse,
  readWhoamiFixture,
  respondWith,
  withMcp,
} from './helpers/mcpHarness.js';

const EXPECTED_ROUTE_COUNT = 204;
const ORCHESTRATOR_ID = 'marketplace.seller.onboard';
const BROKEN_COMMAND_ID = 'products.broken-probe';
const BROKEN_PROBE_REASON = 'run() threw: probe failure';
const PROBE_FAILED_EVENT = 'route_probe_failed';
const SUPERSEDED_IDS = ['marketplace.seller.content-history', 'marketplace.buyer.subscribe-quote'];
const PURCHASE_TOOLS_IN_ORDER = 'billing_purchase_products_quote, then billing_purchase_products_buy';
const PRODUCT_LIMIT_GUIDANCE =
  'Three options: (1) pause an existing product with POST /api/agent/v1/products/<id>/pause to free a slot; ' +
  '(2) purchase additional product slots with POST /api/agent/v1/billing/purchase-products (real money — call ' +
  'it without confirm_charge_cents first to get the quote, then confirm with the human before resubmitting); ' +
  '(3) ask the human to upgrade their plan via the dashboard.';
const REWRITTEN_PRODUCT_LIMIT_GUIDANCE =
  'Three options: (1) pause an existing product with products_pause {"product_id":"<id>"} to free a slot; ' +
  `(2) purchase additional product slots with ${PURCHASE_TOOLS_IN_ORDER} (real money — call ` +
  'it without confirm_charge_cents first to get the quote, then confirm with the human before resubmitting); ' +
  '(3) ask the human to upgrade their plan via the dashboard.';
const UNPARSED_TAIL_MENTIONS = Object.freeze([
  'Use GET /api/agent/v1/products/<id>/gsc/properties?email=a@b.com next.',
  'Use GET /api/agent/v1/articles?title=a+b next.',
  'Use GET /api/agent/v1/products?cursor= next.',
  'Use GET /api/agent/v1/keywords?q=%ZZ next.',
  'Use GET /api/agent/v1/products/../keywords next.',
  'Use GET /api/agent/v1/keywords?scheduled_from=10:30 next.',
  'Use GET /api/agent/v1/keywords?limit=5=6 next.',
]);
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const API_PREFIX = '/api/agent/v1';
const NOT_FOUND_STATUS = 404;
const SELLER_PLACEMENT_ACTIONS =
  'marketplace_seller_placements_approve or marketplace_seller_placements_decline or ' +
  'marketplace_seller_placements_publish or marketplace_seller_placements_regenerate';

const index = await buildRouteIndex(registry);
const rewrite = (text, toolsets) => rewriteRouteMentions(index, text, { toolsets });

const EXPECTED_MIXED_WHOAMI_GUIDANCE =
  'Authenticated as agent@example.com (admin) using API key "agent-key". 10000 of 10000 article credits remaining ' +
  'this period. 4 products configured — pass product_id to per-product tools. Available toolsets: core, keywords, ' +
  'articles, integrations, gsc, linking, backlinks, billing, improvements, marketplace-buyer, marketplace-seller. ' +
  'Common next steps: list products; inspect or update a product\'s General settings with products_get or ' +
  'products_update {"product_id":"<id>"}; inspect or update a product\'s Article settings with ' +
  'products_output_settings_get or products_output_settings_update {"product_id":"<id>"}; inspect the content ' +
  'plan with keywords_list {"product_id":"<id>"}; suggest or generate keyword candidates via keywords_suggest and ' +
  'keywords_generate; check marketplace seller status with marketplace_seller_status {"product_id":"<id>"}; check ' +
  'marketplace buyer status with marketplace_buyer_status {"product_id":"<id>"}; review the billing tools.';

test('the route index accounts for every MCP tool: mapped, superseded by an override, or the orchestrator', () => {
  assert.equal(index.routes.length, EXPECTED_ROUTE_COUNT);
  assert.deepEqual(index.unmapped, [{ id: ORCHESTRATOR_ID, reason: 'run() made 2 requests instead of one' }]);
  assert.deepEqual(index.superseded, SUPERSEDED_IDS);
  const mapped = new Map();
  for (const route of index.routes) {
    for (const spec of route.specs) mapped.set(spec.id, (mapped.get(spec.id) ?? 0) + 1);
  }
  assert.ok([...mapped.values()].every((count) => count === 1));
  const accounted = [...mapped.keys(), ...index.unmapped.map((entry) => entry.id), ...index.superseded].sort();
  const expected = registry.commands.filter((spec) => spec.mcp !== false && !spec.offline).map((spec) => spec.id);
  assert.deepEqual(accounted, expected.sort());
  assert.equal(new Set(index.routes.map((route) => route.key)).size, index.routes.length);
});

test('every override names an existing collision and only registered commands', () => {
  const keys = new Set(index.routes.map((route) => route.key));
  for (const [key, ids] of Object.entries(ROUTE_TOOL_OVERRIDES)) {
    assert.ok(keys.has(key), `${key} is not a route`);
    for (const id of ids) assert.ok(registry.byId.has(id), `${id} is not a command`);
    const route = index.routes.find((entry) => entry.key === key);
    assert.deepEqual(
      route.specs.map((spec) => spec.id),
      ids,
    );
  }
});

test('a METHOD/METHOD mention becomes the two tools with one argument object', () => {
  assert.equal(
    rewrite("inspect a product's General settings with GET/PATCH /api/agent/v1/products/<id>"),
    'inspect a product\'s General settings with products_get or products_update {"product_id":"<id>"}',
  );
});

test('query strings become tool arguments named after the tool inputs', () => {
  assert.equal(
    rewrite(`Review with GET /api/agent/v1/keywords?product_id=${PRODUCT_ID}&scope=all&q=<keyword>.`),
    `Review with keywords_list {"product_id":"${PRODUCT_ID}","scope":"all","q":"<keyword>"}.`,
  );
  assert.equal(
    rewrite('Check GET /api/agent/v1/keywords/generation-status?product_id=<productId> first.'),
    'Check keywords_generation_status {"product_id":"<productId>"} first.',
  );
});

test('percent-encoded query values are decoded into the argument', () => {
  const cursor = `2026-01-01T00:00:00.123456+00:00|${PRODUCT_ID}`;
  assert.equal(
    rewrite(`fetch the next page with GET /api/agent/v1/products?cursor=${encodeURIComponent(cursor)}.`),
    `fetch the next page with products_list {"cursor":"${cursor}"}.`,
  );
});

test('a placeholder matches the parameter route, not literal siblings, and expands only without one', () => {
  assert.equal(rewrite('GET /api/agent/v1/keywords/<id>'), 'keywords_get {"keyword_id":"<id>"}');
  assert.equal(
    rewrite('GET /api/agent/v1/keywords/<keywordId>?kind=stored'),
    'keywords_get {"keyword_id":"<keywordId>","kind":"stored"}',
  );
  assert.equal(rewrite('GET /api/agent/v1/articles/<id>'), 'articles_get {"article_id":"<id>"}');
  assert.equal(
    rewrite('POST /api/agent/v1/marketplace/placements/<placementId>/<action>'),
    `${SELLER_PLACEMENT_ACTIONS} {"placement_id":"<placementId>"}`,
  );
});

test('a mention made only of placeholders names no tool, and each alternative carries its own arguments', () => {
  const placeholderOnly = [
    '.../<id>',
    '/api/agent/v1/<anything>',
    'GET /api/agent/v1/<a>/<b>',
    '.../products/<id>/keywords',
  ];
  for (const text of placeholderOnly) {
    assert.equal(rewrite(text), text);
  }
  assert.equal(rewrite('GET/GET /api/agent/v1/products'), 'products_list');
  assert.equal(rewrite('.../<id>/approve'), 'marketplace_seller_placements_approve {"placement_id":"<id>"}');
});

test('a mention inside a URL or an identifier is left alone, and query keys cannot reach the prototype', () => {
  const url = 'see https://outrank.so/api/agent/v1/products/<id> now';
  assert.equal(rewrite(url), url);
  const prototypeKeys = 'GET /api/agent/v1/products?__proto__=x&constructor=y';
  assert.equal(rewrite(prototypeKeys), prototypeKeys);
  assert.equal({}.x, undefined);
});

test('numbers and booleans in a query string become typed arguments, named after the tool inputs', () => {
  assert.equal(
    rewrite('Use GET /api/agent/v1/keywords?limit=5&offset=2 next.'),
    'Use keywords_list {"limit":5,"offset":2} next.',
  );
  assert.equal(
    rewrite(`GET /api/agent/v1/products/${PRODUCT_ID}/marketplace/seller/status?refresh_stripe=true`),
    `marketplace_seller_status {"product_id":"${PRODUCT_ID}","refresh_stripe":true}`,
  );
  assert.equal(
    rewrite('GET /api/agent/v1/products/<id>/marketplace/seller/status?refresh_stripe=false'),
    'marketplace_seller_status {"product_id":"<id>","refresh_stripe":false}',
  );
  assert.equal(
    rewrite(`GET /api/agent/v1/products/${PRODUCT_ID}/marketplace/buyer/target-pages/discover?source_type=sitemap`),
    `marketplace_buyer_target_pages_discover {"product_id":"${PRODUCT_ID}","source":"sitemap"}`,
  );
  assert.equal(rewrite('GET /api/agent/v1/keywords?limit=<n>'), 'keywords_list {"limit":"<n>"}');
});

test('a mention whose values the tool would reject is left as it was written', () => {
  const unusable = [
    'GET /api/agent/v1/keywords?limit=abc',
    'GET /api/agent/v1/keywords?limit=5.5',
    'GET /api/agent/v1/keywords?no_such_filter=1',
    'GET /api/agent/v1/articles/not-a-uuid',
    'GET /api/agent/v1/products/<id>/marketplace/seller/status?refresh_stripe=maybe',
    'POST /api/agent/v1/integration-providers/nextjs-blog/validate',
    'POST /api/agent/v1/products/<id>/integrations/connect/webflow',
  ];
  for (const text of unusable) assert.equal(rewrite(text), text);
});

test('the provider of each provider tool is one its server route accepts', () => {
  assert.equal(
    rewrite('retry POST /api/agent/v1/integration-providers/ghost/validate.'),
    'retry products_integrations_validate {"provider":"ghost"}.',
  );
  assert.equal(
    rewrite('POST /api/agent/v1/products/<id>/integrations/prepare/wordpress-plugin'),
    'products_integrations_prepare {"product_id":"<id>","provider":"wordpress-plugin"}',
  );
  assert.equal(
    rewrite('POST /api/agent/v1/products/<id>/integrations/connect/notion'),
    'products_integrations_connect {"product_id":"<id>","provider":"notion"}',
  );
  const providersOf = (id) => registry.byId.get(id).input.provider.values;
  assert.deepEqual(providersOf('products.integrations.prepare'), ['wordpress-plugin']);
  assert.deepEqual(providersOf('products.integrations.connect'), ['wordpress-com', 'notion']);
  assert.deepEqual(providersOf('products.integrations.poll'), ['wordpress-com', 'notion']);
  assert.deepEqual(providersOf('products.integrations.validate'), [
    'webhook',
    'ghost',
    'shopify',
    'wix',
    'framer',
    'wordpress-plugin',
    'webflow',
  ]);
});

test('a parameter route called with a method no tool serves is not mapped to its literal siblings', () => {
  const unmappable = [
    'POST /api/agent/v1/articles/{id}',
    'POST /api/agent/v1/articles/<id>',
    'GET/POST /api/agent/v1/articles/{id}',
    'PUT /api/agent/v1/keywords/<id>',
  ];
  for (const text of unmappable) assert.equal(rewrite(text), text);
});

test('a trailing slash belongs to the mention, and a path the pattern cannot finish is left alone', () => {
  assert.equal(rewrite('Call GET /api/agent/v1/products/ now.'), 'Call products_list now.');
  assert.equal(rewrite('Call GET /api/agent/v1/products/.'), 'Call products_list.');
  assert.equal(rewrite('GET /api/agent/v1/products/?limit=5'), 'products_list {"limit":5}');
  const unfinished = 'Call GET /api/agent/v1/products/[id]/integrations now.';
  assert.equal(rewrite(unfinished), unfinished);
});

test('a command whose probe fails is reported, and the one orchestrator is the only expected exception', async () => {
  assert.deepEqual(MULTI_REQUEST_COMMAND_IDS, [ORCHESTRATOR_ID]);
  assert.deepEqual(unexpectedProbeFailures(index), []);
  const broken = defineCommand({
    id: BROKEN_COMMAND_ID,
    summary: 'Always fails its probe.',
    kind: CommandKind.READ,
    toolsets: [Toolset.CORE],
    run: () => {
      throw new Error('probe failure');
    },
  });
  const brokenRegistry = { ...registry, commands: [...registry.commands, broken] };
  const brokenIndex = await buildRouteIndex(brokenRegistry);
  assert.deepEqual(unexpectedProbeFailures(brokenIndex), [{ id: BROKEN_COMMAND_ID, reason: BROKEN_PROBE_REASON }]);

  const logged = [];
  const logger = { enabled: false, debug: () => {}, always: (event, fields) => logged.push({ event, ...fields }) };
  const serverSettings = {
    version: STUB_VERSION,
    options: resolveMcpOptions({ argv: [], env: {}, cwd: REPO_ROOT }),
    env: {},
    readConfig: async () => ({}),
    logger,
  };
  const failing = await createMcpServer({ ...serverSettings, registry: brokenRegistry });
  failing.session.shutdown();
  assert.deepEqual(
    logged.filter(({ event }) => event === PROBE_FAILED_EVENT),
    [{ event: PROBE_FAILED_EVENT, command: BROKEN_COMMAND_ID, reason: BROKEN_PROBE_REASON }],
  );
  logged.length = 0;
  const healthy = await createMcpServer({ ...serverSettings, registry });
  healthy.session.shutdown();
  assert.deepEqual(
    logged.filter(({ event }) => event === PROBE_FAILED_EVENT),
    [],
  );
});

test('a literal segment beats a parameter segment with the same shape', () => {
  assert.equal(
    rewrite(`GET /api/agent/v1/keywords/export?product_id=${PRODUCT_ID}`),
    `keywords_export {"product_id":"${PRODUCT_ID}"}`,
  );
  assert.equal(rewrite(`GET /api/agent/v1/keywords/${PRODUCT_ID}`), `keywords_get {"keyword_id":"${PRODUCT_ID}"}`);
});

test('a path without a method resolves when one method serves it, and prefers GET otherwise', () => {
  assert.equal(
    rewrite('via /api/agent/v1/keywords/suggest and /api/agent/v1/keywords/generate'),
    'via keywords_suggest and keywords_generate',
  );
  assert.equal(rewrite('see /api/agent/v1/products/<id>'), 'see products_get {"product_id":"<id>"}');
});

test('trailing punctuation and parentheses stay outside the tool reference', () => {
  assert.equal(
    rewrite('List resources first (e.g. GET /api/agent/v1/products) to confirm.'),
    'List resources first (e.g. products_list) to confirm.',
  );
  assert.equal(rewrite('Refresh with GET /api/agent/v1/products.'), 'Refresh with products_list.');
});

test('placeholder and alternative segments expand to every matching tool', () => {
  assert.equal(
    rewrite('POST /api/agent/v1/marketplace/placements/<placementId>/<action>; decline is admin-only'),
    `${SELLER_PLACEMENT_ACTIONS} {"placement_id":"<placementId>"}; decline is admin-only`,
  );
  assert.equal(
    rewrite('(POST /api/agent/v1/marketplace/buyer-placements/<placementId>/regenerate|revalidate)'),
    '(marketplace_buyer_placements_regenerate or marketplace_buyer_placements_revalidate ' +
      '{"placement_id":"<placementId>"})',
  );
});

test('a mention followed by text the pattern could not parse is left exactly as written', () => {
  for (const text of UNPARSED_TAIL_MENTIONS) assert.equal(rewrite(text), text);
  assert.equal(rewrite('Did you call GET /api/agent/v1/products?'), 'Did you call products_list?');
  assert.equal(rewrite('First GET /api/agent/v1/products: then pick one.'), 'First products_list: then pick one.');
  assert.equal(
    rewrite('Use GET /api/agent/v1/keywords?product_id=<id>&limit=5.'),
    'Use keywords_list {"product_id":"<id>","limit":5}.',
  );
});

test('an ellipsis after a mention is punctuation, while a dotted path or file name continues it', () => {
  assert.equal(rewrite('Start with GET /api/agent/v1/products...'), 'Start with products_list...');
  assert.equal(rewrite('GET /api/agent/v1/products... then pick one.'), 'products_list... then pick one.');
  for (const text of [
    'Use GET /api/agent/v1/products/../keywords next.',
    'Fetch GET /api/agent/v1/products.json next.',
    'Call GET /api/agent/v1/products.Next step follows.',
    'Use GET /api/agent/v1/products.../keywords next.',
  ]) {
    assert.equal(rewrite(text), text);
  }
});

test('the purchase route names the quote tool, then the buy tool, in that order', () => {
  assert.equal(rewrite(PRODUCT_LIMIT_GUIDANCE), REWRITTEN_PRODUCT_LIMIT_GUIDANCE);
  assert.equal(
    rewrite('purchase slots with POST /api/agent/v1/billing/purchase-products (real money)'),
    `purchase slots with ${PURCHASE_TOOLS_IN_ORDER} (real money)`,
  );
});

test('collisions resolve through the override table', () => {
  assert.equal(
    rewrite('pause/activate one with PATCH /api/agent/v1/marketplace/target-pages/<targetPageId> { status }'),
    'pause/activate one with marketplace_buyer_target_pages_pause or marketplace_buyer_target_pages_activate ' +
      '{"target_page_id":"<targetPageId>"} { status }',
  );
  assert.equal(
    rewrite('POST /api/agent/v1/products/<id>/marketplace/buyer/participation { "enabled": false }'),
    'marketplace_buyer_participation_on or marketplace_buyer_participation_off {"product_id":"<id>"} ' +
      '{ "enabled": false }',
  );
});

test('an abbreviated .../suffix path resolves by route suffix, using the calling toolset to break ties', () => {
  assert.equal(
    rewrite('list placements (GET .../marketplace/buyer/placements)', [Toolset.MARKETPLACE_BUYER]),
    'list placements (marketplace_buyer_placements_list)',
  );
  assert.equal(
    rewrite('retry with POST .../regenerate', [Toolset.MARKETPLACE_BUYER]),
    'retry with marketplace_buyer_placements_regenerate',
  );
  assert.equal(
    rewrite('retry with POST .../regenerate', [Toolset.MARKETPLACE_SELLER]),
    'retry with marketplace_seller_placements_regenerate',
  );
  assert.equal(rewrite('retry with POST .../regenerate'), 'retry with POST .../regenerate');
  assert.equal(rewrite('saved via .../decisions'), 'saved via improvements_executions_decisions');
});

test('literal provider segments map to the provider tools', () => {
  assert.equal(
    rewrite('retry POST /api/agent/v1/integration-providers/webflow/discover/sites.'),
    'retry products_integrations_webflow_sites.',
  );
  assert.equal(
    rewrite('POST /api/agent/v1/integration-providers/wordpress-plugin/validate'),
    'products_integrations_validate {"provider":"wordpress-plugin"}',
  );
});

test('unknown paths and bare prefixes are left untouched', () => {
  assert.equal(rewrite('GET /api/agent/v1/nothing/here'), 'GET /api/agent/v1/nothing/here');
  assert.equal(rewrite('deploy the /api/agent/v1 routes'), 'deploy the /api/agent/v1 routes');
  const unknownShape = 'GET /api/agent/v1/products/<id>/gsc/<interpolated>/deeper';
  assert.equal(rewrite(unknownShape), unknownShape);
});

test('the whoami guidance reads as MCP guidance after the rewrite', () => {
  const { agent_guidance: original } = readWhoamiFixture('mixed');
  assert.ok(original.endsWith(CLI_HELP_HINT));
  const rewritten = rewriteGuidanceText(index, original, { toolsets: [Toolset.CORE] });
  assert.equal(rewritten, EXPECTED_MIXED_WHOAMI_GUIDANCE);
  assert.equal(findRouteMentions(rewritten).length, 0);
  assert.ok(!rewritten.includes('outrank-cli'));
  assert.ok(!rewritten.includes('--'));
});

test('every whoami fixture loses its REST paths and CLI phrases', () => {
  for (const name of ['mixed', 'brand-new', 'readonly-articles', 'seller-tools', 'subscribed-no-product']) {
    const rewritten = rewriteGuidanceText(index, readWhoamiFixture(name).agent_guidance);
    assert.equal(findRouteMentions(rewritten).length, 0, name);
    assert.ok(!rewritten.includes('command'), name);
    assert.ok(!rewritten.includes('outrank-cli'), name);
  }
});

test('the rewriter touches server envelopes only', async () => {
  const { rewrite: rewriteEnvelope } = await createGuidanceRewriter(registry);
  const spec = registry.byId.get('products.get');
  const path = `GET ${API_PREFIX}/products`;
  const serverError = {
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Missing.' },
    agent_guidance: `List with ${path}.`,
  };
  assert.equal(rewriteEnvelope(serverError, spec).agent_guidance, 'List with products_list.');
  assert.equal(rewriteEnvelope(cliSuccess({}, `Use ${path}.`), spec).agent_guidance, 'Use products_list.');
  const cliFailure = cliError(CliErrorCode.UPSTREAM_ERROR, 'Not deployed.', `${path} is not deployed there.`);
  assert.equal(rewriteEnvelope(cliFailure, spec), cliFailure);
  const noGuidance = { ok: true, data: {} };
  assert.equal(rewriteEnvelope(noGuidance, spec), noGuidance);
});

test('tool results reaching the client carry the rewritten guidance', async () => {
  const notFound = {
    ok: false,
    error: { code: 'NOT_FOUND', message: 'Product not found.' },
    agent_guidance: `List available resources first (e.g. GET ${API_PREFIX}/products) to confirm valid ids.`,
  };
  const respond = respondWith({ other: () => jsonResponse(NOT_FOUND_STATUS, notFound) });
  await withMcp({ respond }, async ({ call }) => {
    const whoami = await call('auth_whoami');
    assert.equal(whoami.envelope.agent_guidance, EXPECTED_MIXED_WHOAMI_GUIDANCE);
    const product = await call('products_get', { product_id: PRODUCT_ID });
    assert.equal(product.envelope.ok, false);
    assert.equal(
      product.envelope.agent_guidance,
      'List available resources first (e.g. products_list) to confirm valid ids.',
    );
  });
});
