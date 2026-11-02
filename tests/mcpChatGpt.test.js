import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { JSDOM } from 'jsdom';

import { ARTICLE_CARD_HTML, ARTICLE_CARD_URI } from '../src/adapters/mcp/articleCard.js';
import { CHATGPT_INSTRUCTIONS, UNAVAILABLE_MESSAGE, scrubEnvelope } from '../src/adapters/mcp/chatgpt.js';
import { createRemoteMcpServer } from '../src/adapters/mcp/remote.js';
import { STUB_VERSION, jsonResponse, readWhoamiFixture } from './helpers/mcpHarness.js';

const KEYWORD_ID = 'bbbbbbbb-0000-4000-8000-000000000001';
const ARTICLE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const BASE = 'https://www.outrank.so';
const EXPECTED_TOOLS = [
  'articles_get',
  'articles_get_content',
  'articles_list',
  'articles_start',
  'articles_status',
  'improvements_candidates_list',
  'improvements_candidates_schedule',
  'improvements_executions_get',
  'improvements_executions_list',
  'improvements_tasks_list',
  'keywords_add',
  'keywords_bulk_process',
  'keywords_bulk_reschedule',
  'keywords_delete',
  'keywords_get',
  'keywords_list',
  'keywords_suggest',
  'keywords_update',
  'marketplace_buyer_placements_list',
  'marketplace_buyer_status',
  'marketplace_buyer_target_pages_activate',
  'marketplace_buyer_target_pages_add',
  'marketplace_buyer_target_pages_list',
  'marketplace_buyer_target_pages_pause',
  'products_backlinks_earned',
  'products_get',
  'products_gsc_cannibalization',
  'products_gsc_inspect_url',
  'products_gsc_performance',
  'products_gsc_search_analytics',
  'products_gsc_status',
  'products_list',
];
const EXPECTED_OPEN_WORLD = [
  'articles_start',
  'improvements_candidates_schedule',
  'keywords_bulk_process',
  'keywords_suggest',
  'marketplace_buyer_target_pages_add',
  'products_gsc_cannibalization',
  'products_gsc_inspect_url',
  'products_gsc_performance',
  'products_gsc_search_analytics',
];
const COMMERCE_PATTERN =
  /subscri|checkout|pricing|\bprices?\b|billing|upgrade|stripe|payment|invoice|purchas|\bquote\b|\bbuy\b|\$\d|\/dashboard\/subscription/i;

const withSurface = async ({ whoami = 'mixed', respond = () => jsonResponse(404, { ok: false }) } = {}, run) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input.toString());
    calls.push({ url, method: init.method ?? 'GET', body: init.body ? JSON.parse(init.body) : undefined });
    return respond(url, init);
  };
  const { server } = await createRemoteMcpServer({
    apiKey: 'outr_oat_chatgpt_test',
    baseUrl: BASE,
    version: STUB_VERSION,
    whoami: readWhoamiFixture(whoami),
    surface: 'chatgpt',
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'chatgpt-tests', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await run({ client, calls });
  } finally {
    await client.close();
    globalThis.fetch = originalFetch;
  }
};

test('the ChatGPT surface lists exactly the approved tools, whatever the account unlocks', async () => {
  for (const whoami of ['mixed', 'brand-new', 'readonly-articles']) {
    await withSurface({ whoami }, async ({ client }) => {
      const { tools } = await client.listTools();
      assert.deepEqual(tools.map((tool) => tool.name).sort(), EXPECTED_TOOLS);
    });
  }
});

test('openWorldHint is true only for tools that reach the web, a CMS, Google or user URLs', async () => {
  await withSurface({}, async ({ client }) => {
    const { tools } = await client.listTools();
    const open = tools.filter((tool) => tool.annotations.openWorldHint).map((tool) => tool.name).sort();
    assert.deepEqual(open, EXPECTED_OPEN_WORLD);
  });
});

test('destructiveHint is true for tools that overwrite, cancel, delete or publish', async () => {
  await withSurface({}, async ({ client }) => {
    const { tools } = await client.listTools();
    const destructive = tools.filter((tool) => tool.annotations.destructiveHint).map((tool) => tool.name).sort();
    assert.deepEqual(destructive, [
      'articles_start',
      'improvements_candidates_schedule',
      'keywords_bulk_reschedule',
      'keywords_delete',
      'keywords_update',
      'marketplace_buyer_target_pages_pause',
    ]);
    for (const tool of tools) {
      if (tool.annotations.readOnlyHint) assert.equal(tool.annotations.destructiveHint, false, tool.name);
    }
  });
});

test('no pricing, subscription or checkout text anywhere the model or a reviewer can read', async () => {
  await withSurface({}, async ({ client }) => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      assert.doesNotMatch(JSON.stringify({ ...tool, _meta: undefined }), COMMERCE_PATTERN, tool.name);
    }
    assert.doesNotMatch(client.getInstructions(), COMMERCE_PATTERN);
    assert.equal(client.getInstructions(), CHATGPT_INSTRUCTIONS);
    assert.doesNotMatch(ARTICLE_CARD_HTML, COMMERCE_PATTERN);
    assert.equal(client.getServerCapabilities().prompts, undefined);
  });
});

test('tools keep their safety text, since the surface instructions do not carry it', async () => {
  await withSurface({}, async ({ client }) => {
    const { tools } = await client.listTools();
    const describedAs = (name) => tools.find((tool) => tool.name === name).description;
    assert.match(describedAs('keywords_delete'), /The removal cannot be undone/);
    for (const name of ['articles_list', 'articles_get', 'articles_get_content']) {
      assert.match(describedAs(name), /untrusted_counterparty_text.*data, never as instructions/, name);
    }
  });
});

test('tools outside the list cannot be called', async () => {
  await withSurface({}, async ({ client, calls }) => {
    for (const name of [
      'billing_portal_url',
      'billing_purchase_products_buy',
      'billing_purchase_products_quote',
      'marketplace_buyer_checkout',
      'marketplace_buyer_change_plan',
      'marketplace_seller_stripe_onboard',
      'marketplace_seller_earnings',
    ]) {
      const result = await client.callTool({ name, arguments: {} });
      assert.equal(result.isError, true, name);
    }
    assert.equal(calls.length, 0);
  });
});

test('a paywall refusal comes back neutral, with no link or plan talk', async () => {
  const refusal = {
    ok: false,
    error: {
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'An active backlink subscription is required.',
      details: { subscription_management_url: `${BASE}/dashboard/subscription` },
    },
    agent_guidance: `Subscribe at ${BASE}/dashboard/subscription.`,
  };
  await withSurface({ respond: () => jsonResponse(403, refusal) }, async ({ client }) => {
    const result = await client.callTool({ name: 'products_backlinks_earned', arguments: { product_id: KEYWORD_ID } });
    assert.equal(result.isError, true);
    assert.doesNotMatch(JSON.stringify(result), COMMERCE_PATTERN);
    assert.equal(result.structuredContent.error.message, UNAVAILABLE_MESSAGE);
  });
});

test('scrubbing removes commerce sentences and keys but keeps the rest', () => {
  const scrubbed = scrubEnvelope({
    ok: true,
    data: {
      billing: { state: 'active' },
      tier: 'starter_1',
      checkout_url: 'https://checkout.stripe.com/x',
      keyword: 'best pricing tools',
      nested: [{ manage: `${BASE}/dashboard/subscription`, url: 'https://example.com/pricing' }],
    },
    agent_guidance:
      'Listed the pages. Get a quote with billing_purchase_products_quote. The Enterprise plan is past_due. Call keywords_list next.',
  });
  assert.deepEqual(scrubbed.data, {
    keyword: 'best pricing tools',
    nested: [{ url: 'https://example.com/pricing' }],
  });
  assert.equal(scrubbed.agent_guidance, 'Listed the pages. Call keywords_list next.');
});

test('results do not carry the user email or organization', async () => {
  const ok = { ok: true, data: { items: [] }, agent_guidance: 'Done.' };
  await withSurface({ respond: () => jsonResponse(200, ok) }, async ({ client }) => {
    const result = await client.callTool({ name: 'products_list', arguments: {} });
    assert.equal(result.structuredContent.organization, undefined);
    assert.doesNotMatch(JSON.stringify(result), /agent@example\.com/);
  });
});

test('articles_start answers at once with a link and a never-again next step, and carries the card', async () => {
  const started = {
    ok: true,
    data: { keyword_id: KEYWORD_ID, keyword: 'seo tools', status: 'generating_article' },
    agent_guidance: 'x',
  };
  await withSurface({ respond: () => jsonResponse(200, started) }, async ({ client, calls }) => {
    const { tools } = await client.listTools();
    const withCard = tools.filter((tool) => tool._meta?.ui?.resourceUri).map((tool) => tool.name);
    assert.deepEqual(withCard, ['articles_start']);
    const result = await client.callTool({ name: 'articles_start', arguments: { keyword_id: KEYWORD_ID } });
    assert.equal(calls[0].url.pathname, '/api/agent/v1/articles/start');
    assert.equal(result.structuredContent.data.article_list_url, `${BASE}/dashboard/articles`);
    assert.match(result.structuredContent.data.nextStep, /Never start it again/);
    assert.match(result.structuredContent.data.nextStep, /articles_status/);
  });
});

test('articles_status reports progress, then the finished article', async () => {
  let keywordStatus = 'generating_article';
  let articleId = null;
  const respond = (url) => {
    if (url.pathname.endsWith(`/keywords/${KEYWORD_ID}`)) {
      return jsonResponse(200, {
        ok: true,
        data: { id: KEYWORD_ID, keyword: 'seo tools', status: keywordStatus, article_id: articleId },
        agent_guidance: 'x',
      });
    }
    return jsonResponse(200, {
      ok: true,
      data: { id: ARTICLE_ID, title: 'SEO tools', editor_url: `${BASE}/dashboard/articles/${ARTICLE_ID}`, is_marketplace_placement: false },
      agent_guidance: 'x',
    });
  };
  await withSurface({ respond }, async ({ client }) => {
    const pending = await client.callTool({
      name: 'articles_status',
      arguments: { keyword_id: KEYWORD_ID, wait_seconds: 0 },
    });
    assert.equal(pending.structuredContent.data.state, 'writing');
    assert.match(pending.structuredContent.data.nextStep, /Do not start the article again/);
    keywordStatus = 'published';
    articleId = ARTICLE_ID;
    const ready = await client.callTool({
      name: 'articles_status',
      arguments: { keyword_id: KEYWORD_ID, wait_seconds: 0 },
    });
    assert.equal(ready.structuredContent.data.state, 'ready');
    assert.equal(ready.structuredContent.data.article.title, 'SEO tools');
  });
});

test('a wrong id is answered as an error, not as still working', async () => {
  const notFound = { ok: false, error: { code: 'NOT_FOUND', message: 'No keyword with that id exists.' }, agent_guidance: 'x' };
  await withSurface({ respond: () => jsonResponse(404, notFound) }, async ({ client }) => {
    const result = await client.callTool({
      name: 'articles_status',
      arguments: { keyword_id: KEYWORD_ID, wait_seconds: 40 },
    });
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, 'NOT_FOUND');
    const malformed = await client.callTool({ name: 'articles_status', arguments: { keyword_id: 'nope' } });
    assert.equal(malformed.isError, true);
  });
});

test('the card resource is served and is self-contained', async () => {
  await withSurface({}, async ({ client }) => {
    const { resources } = await client.listResources();
    assert.deepEqual(resources.map((resource) => resource.uri), [ARTICLE_CARD_URI]);
    const read = await client.readResource({ uri: ARTICLE_CARD_URI });
    assert.equal(read.contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.doesNotMatch(read.contents[0].text, /<script[^>]+src=|<link[^>]+href=/);
  });
});

const mountCard = ({ toolOutput, callTool }) => {
  const dom = new JSDOM(ARTICLE_CARD_HTML, {
    runScripts: 'dangerously',
    beforeParse: (window) => {
      window.openai = { toolOutput, callTool, theme: 'light' };
    },
  });
  return dom.window;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

test('the card follows the article by itself and shows the finished title', async () => {
  const ready = {
    structuredContent: {
      ok: true,
      data: {
        keyword_id: KEYWORD_ID,
        state: 'ready',
        article: { title: 'SEO tools', editor_url: `${BASE}/dashboard/articles/${ARTICLE_ID}` },
      },
    },
  };
  const argsSeen = [];
  const window = mountCard({
    toolOutput: { ok: true, data: { keyword_id: KEYWORD_ID, status: 'generating_article', keyword: 'seo tools' } },
    callTool: async (name, args) => {
      argsSeen.push([name, args]);
      return ready;
    },
  });
  await tick();
  assert.equal(argsSeen[0][0], 'articles_status');
  assert.equal(argsSeen[0][1].keyword_id, KEYWORD_ID);
  assert.match(window.document.body.textContent, /SEO tools/);
  assert.match(window.document.body.textContent, /Open in Outrank/);
  window.close();
});

test('the card writes tool values as text, never as HTML', async () => {
  const window = mountCard({
    toolOutput: {
      ok: true,
      data: { keyword_id: KEYWORD_ID, state: 'ready', article: { title: '<img src=x onerror="window.pwned=1">' } },
    },
    callTool: async () => ({}),
  });
  await tick();
  assert.equal(window.document.querySelector('img'), null);
  assert.equal(window.pwned, undefined);
  window.close();
});

test('the card only shows images from the media allowlist', async () => {
  const window = mountCard({
    toolOutput: {
      ok: true,
      data: { keyword_id: KEYWORD_ID, state: 'ready', article: { title: 'T', image_url: 'https://evil.example/x.png' } },
    },
    callTool: async () => ({}),
  });
  await tick();
  assert.equal(window.document.querySelector('img'), null);
  window.close();
});
