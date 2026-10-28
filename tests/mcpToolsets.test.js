import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SelectionSource } from '../src/adapters/mcp/constants.js';
import { isBlockedByOperator, parseToolsetOverride, selectTools } from '../src/adapters/mcp/toolsets.js';
import { registry } from '../src/commands/index.js';
import { toolName } from '../src/commands/registry.js';
import { readWhoamiFixture } from './helpers/mcpHarness.js';

const ALL_TOOL_COUNT = 244;
const CORE_TOOL_COUNT = 16;
const ENTRY_POINT_COUNT = 17;
const BRAND_NEW_TOOL_COUNT = CORE_TOOL_COUNT + ENTRY_POINT_COUNT;
const SUBSCRIBED_NO_PRODUCT_TOOL_COUNT = 34;
const BUYER_ONLY_TOOL_COUNT = 57;
const SELLER_ONLY_TOOL_COUNT = 81;
const BASIC_PLAN_TOOL_COUNT = 110;
const READ_ONLY_ARTICLES_TOOL_COUNT = 75;
const SELLER_WITH_ARTICLES_TOOL_COUNT = 143;
const READ_ONLY_ALL_TOOL_COUNT = 104;
const KEYWORDS_AND_ARTICLES_TOOL_COUNT = 28;
const IMPROVEMENTS_PREFIX = 'improvements_';
const IMPROVEMENTS_TOOL_COUNT = 16;
const BLOG_PREFIX = 'products_blog_';
const BLOG_TOOL_COUNT = 59;
const BLOG_READ_TOOL_COUNT = 20;
const BLOG_ONLY_TOOL_COUNT = BRAND_NEW_TOOL_COUNT + BLOG_TOOL_COUNT;
const AI_CITED_LISTS_PREFIX = 'ai_cited_lists_';
const AI_CITED_LISTS_TOOL_COUNT = 28;
const AI_CITED_LISTS_READ_TOOL_COUNT = 11;
const AI_CITED_LISTS_ENTRY_POINT_COUNT = 1;
const AI_CITED_LISTS_ONLY_TOOL_COUNT =
  BRAND_NEW_TOOL_COUNT + AI_CITED_LISTS_TOOL_COUNT - AI_CITED_LISTS_ENTRY_POINT_COUNT;
const IMPROVEMENTS_READ_TOOLS = [
  'improvements_candidates_list',
  'improvements_executions_get',
  'improvements_executions_list',
  'improvements_settings_get',
  'improvements_tasks_list',
];
const ENTRY_POINT_TOOLS = [
  'ai_cited_lists_status',
  'billing_portal_url',
  'billing_purchase_products_quote',
  'marketplace_buyer_billing_status',
  'marketplace_buyer_checkout',
  'marketplace_buyer_status',
  'marketplace_buyer_subscribe_quote',
  'marketplace_buyer_subscription',
  'marketplace_seller_complete_onboarding',
  'marketplace_seller_eligibility',
  'marketplace_seller_eligibility_recheck',
  'marketplace_seller_integrations_status',
  'marketplace_seller_onboard',
  'marketplace_seller_status',
  'marketplace_seller_stripe_onboard',
  'products_backlinks_subscribe_quote',
  'products_backlinks_subscription',
];
const EXCLUDED_COMMAND_IDS = ['auth.login', 'auth.logout', 'auth.profiles'];

const entitlementsOf = (fixture) => readWhoamiFixture(fixture).data.entitlements;
const withToolsets = (toolsets) => ({ toolsets: { core: 'full', ...toolsets }, flows: {} });
const select = (settings) => selectTools({ specs: registry.commands, ...settings });
const namesOf = (selection) => selection.tools.map((spec) => toolName(spec.id)).sort();

test('with every toolset on, every command except the approved CLI-only ones is a tool', () => {
  const selection = select({ override: parseToolsetOverride('all') });
  const exposed = new Set(selection.tools.map((spec) => spec.id));
  const excluded = registry.commands.filter((spec) => !exposed.has(spec.id)).map((spec) => spec.id);
  assert.deepEqual(excluded.sort(), EXCLUDED_COMMAND_IDS);
  assert.equal(selection.tools.length, ALL_TOOL_COUNT);
  assert.equal(selection.source, SelectionSource.ALL);
});

test('a brand-new organization gets the core tools and every setup entry point, nothing else', () => {
  const selection = select({ entitlements: entitlementsOf('brand-new') });
  const names = namesOf(selection);
  assert.equal(names.length, BRAND_NEW_TOOL_COUNT);
  assert.deepEqual(
    names.filter((name) => ENTRY_POINT_TOOLS.includes(name)),
    ENTRY_POINT_TOOLS,
  );
  assert.equal(names.includes('keywords_list'), false);
  assert.deepEqual(selection.disabledToolsets, [
    'integrations',
    'gsc',
    'linking',
    'backlinks',
    'keywords',
    'articles',
    'improvements',
    'marketplace-seller',
    'marketplace-buyer',
    'billing',
    'blog',
    'ai-cited-lists',
  ]);
  assert.equal(names.some((name) => name.startsWith(BLOG_PREFIX)), false);
  assert.deepEqual(
    names.filter((name) => name.startsWith(AI_CITED_LISTS_PREFIX)),
    ['ai_cited_lists_status'],
  );
});

test('an Enterprise organization granted ai-cited-lists gets every AI-Cited Lists tool on top of core', () => {
  const names = namesOf(select({ entitlements: withToolsets({ 'ai-cited-lists': 'full' }) }));
  assert.equal(names.length, AI_CITED_LISTS_ONLY_TOOL_COUNT);
  assert.equal(names.filter((name) => name.startsWith(AI_CITED_LISTS_PREFIX)).length, AI_CITED_LISTS_TOOL_COUNT);
  assert.equal(names.includes('ai_cited_lists_status'), true);
  assert.equal(names.includes('ai_cited_lists_top_up_consent_confirm'), true);
  assert.equal(names.includes('articles_list'), false);
});

test('a read-only ai-cited-lists grant exposes only its reads', () => {
  const names = namesOf(select({ entitlements: withToolsets({ 'ai-cited-lists': 'read' }) }));
  assert.equal(names.filter((name) => name.startsWith(AI_CITED_LISTS_PREFIX)).length, AI_CITED_LISTS_READ_TOOL_COUNT);
  assert.equal(names.includes('ai_cited_lists_overview'), true);
  assert.equal(names.includes('ai_cited_lists_mailbox_get'), true);
  assert.equal(names.includes('ai_cited_lists_lists_skip'), false);
});

test('an organization granted the blog toolset gets every blog tool on top of core and the entry points', () => {
  const names = namesOf(select({ entitlements: withToolsets({ blog: 'full' }) }));
  assert.equal(names.length, BLOG_ONLY_TOOL_COUNT);
  assert.equal(names.filter((name) => name.startsWith(BLOG_PREFIX)).length, BLOG_TOOL_COUNT);
  assert.equal(names.includes('products_blog_create'), true);
  assert.equal(names.includes('articles_list'), false);
});

test('a read-only blog grant exposes only the blog reads', () => {
  const names = namesOf(select({ entitlements: withToolsets({ blog: 'read' }) }));
  assert.equal(names.filter((name) => name.startsWith(BLOG_PREFIX)).length, BLOG_READ_TOOL_COUNT);
  assert.equal(names.includes('products_blog_get'), true);
  assert.equal(names.includes('products_blog_posts_publish'), false);
});

test('a subscribed organization without a product yet also gets the billing tools', () => {
  const selection = select({ entitlements: entitlementsOf('subscribed-no-product') });
  const names = namesOf(selection);
  assert.equal(names.length, SUBSCRIBED_NO_PRODUCT_TOOL_COUNT);
  assert.equal(names.includes('billing_purchase_products_buy'), true);
  assert.equal(names.includes('products_create'), true);
  assert.equal(names.includes('keywords_list'), false);
  assert.deepEqual(selection.enabled, { core: 'full', billing: 'full' });
});

test('a buyer-only organization gets buyer and backlink tools but no article tools', () => {
  const selection = select({ entitlements: withToolsets({ 'marketplace-buyer': 'full', backlinks: 'full' }) });
  const names = namesOf(selection);
  assert.equal(names.length, BUYER_ONLY_TOOL_COUNT);
  assert.equal(names.includes('marketplace_buyer_target_pages_add'), true);
  assert.equal(names.includes('marketplace_notifications_list'), true);
  assert.equal(names.includes('products_backlinks_earned'), true);
  assert.equal(names.includes('articles_list'), false);
  assert.equal(names.includes('marketplace_seller_placements_list'), false);
  assert.equal(names.includes('marketplace_seller_status'), true);
});

test('an enrolled seller gets seller, integration and Search Console tools', () => {
  const selection = select({
    entitlements: withToolsets({ 'marketplace-seller': 'full', integrations: 'full', gsc: 'full' }),
  });
  const names = namesOf(selection);
  assert.equal(names.length, SELLER_ONLY_TOOL_COUNT);
  assert.equal(names.includes('marketplace_seller_placements_approve'), true);
  assert.equal(names.includes('products_integrations_create'), true);
  assert.equal(names.includes('products_gsc_connect'), true);
  assert.equal(names.includes('marketplace_buyer_placements_list'), false);
});

test('a seller that has not finished onboarding keeps the onboarding tools but not the seller toolset', () => {
  const selection = select({ entitlements: withToolsets({}) });
  const names = namesOf(selection);
  assert.equal(names.length, BRAND_NEW_TOOL_COUNT);
  assert.equal(names.includes('marketplace_seller_onboard'), true);
  assert.equal(names.includes('marketplace_seller_complete_onboarding'), true);
  assert.equal(names.includes('marketplace_seller_placements_list'), false);
  assert.equal(names.includes('marketplace_seller_earnings'), false);
});

test('an articles organization on the Basic plan gets no improvements tools', () => {
  const selection = select({
    entitlements: withToolsets({
      keywords: 'full',
      articles: 'full',
      integrations: 'full',
      gsc: 'full',
      linking: 'full',
      backlinks: 'full',
      billing: 'full',
    }),
  });
  const names = namesOf(selection);
  assert.equal(names.length, BASIC_PLAN_TOOL_COUNT);
  assert.deepEqual(
    names.filter((name) => name.startsWith(IMPROVEMENTS_PREFIX)),
    [],
  );
  assert.equal(names.includes('billing_purchase_products_buy'), true);
});

test('a toolset in read mode exposes only its read tools', () => {
  const selection = select({ entitlements: withToolsets({ improvements: 'read' }) });
  assert.deepEqual(
    namesOf(selection).filter((name) => name.startsWith(IMPROVEMENTS_PREFIX)),
    IMPROVEMENTS_READ_TOOLS,
  );
});

test('a toolset the server could not verify stays listed, in the mode the server reported', () => {
  const improvementsOf = (unverified) => {
    const entitlements = { ...withToolsets({ articles: 'full' }), unverified_toolsets: unverified };
    return namesOf(select({ entitlements })).filter((name) => name.startsWith(IMPROVEMENTS_PREFIX));
  };
  assert.equal(improvementsOf({ improvements: 'full' }).length, IMPROVEMENTS_TOOL_COUNT);
  assert.deepEqual(improvementsOf({ improvements: 'read' }), IMPROVEMENTS_READ_TOOLS);
  assert.deepEqual(improvementsOf({}), []);
  assert.deepEqual(improvementsOf(['improvements']), []);
  assert.deepEqual(improvementsOf({ 'future-toolset': 'full' }), []);
});

test('a verified mode wins over an unverified entry for the same toolset', () => {
  const selection = select({
    entitlements: { ...withToolsets({ improvements: 'read' }), unverified_toolsets: { improvements: 'full' } },
  });
  assert.equal(selection.enabled.improvements, 'read');
  assert.deepEqual(
    namesOf(selection).filter((name) => name.startsWith(IMPROVEMENTS_PREFIX)),
    IMPROVEMENTS_READ_TOOLS,
  );
});

test('the read-only articles fixture lists read tools for its toolsets and no writes', () => {
  const selection = select({ entitlements: entitlementsOf('readonly-articles') });
  const names = namesOf(selection);
  assert.equal(names.length, READ_ONLY_ARTICLES_TOOL_COUNT);
  assert.equal(names.includes('articles_get_content'), true);
  assert.equal(names.includes('articles_update'), false);
  assert.equal(names.includes('keywords_add'), false);
  assert.equal(names.includes('billing_purchase_products_buy'), false);
  assert.equal(names.includes('products_update'), true);
});

test('the mixed and seller fixtures give the union of their toolsets', () => {
  assert.equal(select({ entitlements: entitlementsOf('mixed') }).tools.length, ALL_TOOL_COUNT);
  const seller = namesOf(select({ entitlements: entitlementsOf('seller-tools') }));
  assert.equal(seller.length, SELLER_WITH_ARTICLES_TOOL_COUNT);
  assert.equal(seller.includes('marketplace_buyer_checkout'), true);
  assert.equal(seller.includes('marketplace_buyer_target_pages_add'), false);
});

test('entitlements null from the server means every toolset is listed', () => {
  const selection = select({ entitlements: null });
  assert.equal(selection.tools.length, ALL_TOOL_COUNT);
  assert.equal(selection.source, SelectionSource.UNRESTRICTED);
});

test('missing or malformed entitlements fall back to core plus entry points', () => {
  for (const entitlements of [undefined, 'full', { toolsets: ['core'] }, { flows: {} }]) {
    const selection = select({ entitlements });
    assert.equal(selection.source, SelectionSource.FALLBACK);
    assert.equal(selection.tools.length, BRAND_NEW_TOOL_COUNT);
  }
});

test('an unknown toolset name from the server is ignored and an unknown mode is treated as read', () => {
  const selection = select({
    entitlements: { toolsets: { core: 'read', keywords: 'admin', 'future-toolset': 'full', articles: 'full' } },
  });
  assert.deepEqual(selection.enabled, { core: 'full', keywords: 'read', articles: 'full' });
  const names = namesOf(selection);
  assert.equal(names.includes('keywords_list'), true);
  assert.equal(names.includes('keywords_add'), false);
});

test('an explicit toolset list wins over entitlements and adds no entry points', () => {
  const selection = select({
    entitlements: entitlementsOf('mixed'),
    override: parseToolsetOverride('keywords, articles'),
  });
  const names = namesOf(selection);
  assert.equal(names.length, KEYWORDS_AND_ARTICLES_TOOL_COUNT);
  assert.equal(names.includes('auth_whoami'), false);
  assert.equal(names.includes('marketplace_seller_status'), false);
  assert.equal(selection.source, SelectionSource.OVERRIDE);
});

test('read-only keeps only read and local tools, on top of any mode', () => {
  const all = select({ override: parseToolsetOverride('all'), readOnly: true });
  assert.equal(all.tools.length, READ_ONLY_ALL_TOOL_COUNT);
  assert.deepEqual([...new Set(all.tools.map((spec) => spec.kind))].sort(), ['local', 'read']);
  const brandNew = namesOf(select({ entitlements: entitlementsOf('brand-new'), readOnly: true }));
  assert.equal(brandNew.includes('marketplace_buyer_checkout'), false);
  assert.equal(brandNew.includes('marketplace_buyer_status'), true);
});

test('the toolset override parser separates known names, unknown names, all and auto', () => {
  const automatic = { kind: 'auto', toolsets: [], unknown: [], mixesKeyword: false };
  assert.deepEqual(parseToolsetOverride(undefined), automatic);
  assert.deepEqual(parseToolsetOverride(' auto '), automatic);
  assert.deepEqual(parseToolsetOverride(' , '), automatic);
  assert.equal(parseToolsetOverride('all').kind, 'all');
  assert.equal(parseToolsetOverride('all').mixesKeyword, false);
  assert.equal(parseToolsetOverride('keywords,all').mixesKeyword, true);
  assert.equal(parseToolsetOverride('auto,keywords').mixesKeyword, true);
  assert.deepEqual(parseToolsetOverride('keywords, bogus ,keywords,,gsc'), {
    kind: 'list',
    toolsets: ['keywords', 'gsc'],
    unknown: ['bogus'],
    mixesKeyword: false,
  });
});

test('operator restrictions block a call, the automatic filter does not', () => {
  const write = registry.byId.get('keywords.add');
  const read = registry.byId.get('keywords.list');
  const readOnly = select({ override: parseToolsetOverride('all'), readOnly: true });
  assert.equal(isBlockedByOperator(write, readOnly), true);
  assert.equal(isBlockedByOperator(read, readOnly), false);
  const articlesOnly = select({ override: parseToolsetOverride('articles') });
  assert.equal(isBlockedByOperator(read, articlesOnly), true);
  const automatic = select({ entitlements: entitlementsOf('brand-new') });
  assert.equal(isBlockedByOperator(write, automatic), false);
});
