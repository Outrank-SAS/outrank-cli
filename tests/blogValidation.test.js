import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CliErrorCode } from '../src/core/errors.js';
import { withMcp } from './helpers/mcpHarness.js';

const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const TARGET_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const REDIRECTS_PATHNAME = `/api/agent/v1/products/${PRODUCT_ID}/blog/redirects`;
const GONE_STATUS = 410;
const UNSUPPORTED_STATUS = 307;
const PREVIEW_PATHNAME = `/api/agent/v1/products/${PRODUCT_ID}/blog/preview-token`;

test('a post or page preview without target_id is refused before any request', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    for (const scope of ['post', 'page']) {
      const { envelope } = await call('products_blog_preview', { product_id: PRODUCT_ID, scope });
      assert.equal(envelope.ok, false);
      assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE);
      assert.match(envelope.error.message, /target_id/);
    }
    assert.equal(nonWhoamiRequests().length, 0);
  });
});

test('a design preview with target_id is refused, and valid previews send the scope and target', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const refused = await call('products_blog_preview', { product_id: PRODUCT_ID, scope: 'design', target_id: TARGET_ID });
    assert.equal(refused.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(nonWhoamiRequests().length, 0);

    await call('products_blog_preview', { product_id: PRODUCT_ID, scope: 'design' });
    await call('products_blog_preview', { product_id: PRODUCT_ID, scope: 'post', target_id: TARGET_ID });
    const sent = nonWhoamiRequests();
    assert.deepEqual(
      sent.map((request) => [request.pathname, request.body]),
      [
        [PREVIEW_PATHNAME, { scope: 'design' }],
        [PREVIEW_PATHNAME, { scope: 'post', targetId: TARGET_ID }],
      ],
    );
  });
});

test('a redirect without toPath is refused unless it is a 410, and only 301, 302 and 410 are accepted', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const missing = await call('products_blog_redirects_create', { product_id: PRODUCT_ID, body: { fromPath: '/old' } });
    assert.equal(missing.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.match(missing.envelope.error.message, /toPath/);
    const unsupported = await call('products_blog_redirects_create', {
      product_id: PRODUCT_ID,
      body: { fromPath: '/old', toPath: '/new', statusCode: UNSUPPORTED_STATUS },
    });
    assert.equal(unsupported.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(nonWhoamiRequests().length, 0);

    await call('products_blog_redirects_create', { product_id: PRODUCT_ID, body: { fromPath: '/gone', statusCode: GONE_STATUS } });
    await call('products_blog_redirects_create', { product_id: PRODUCT_ID, body: { fromPath: '/old', toPath: '/new' } });
    assert.deepEqual(
      nonWhoamiRequests().map((request) => [request.pathname, request.body]),
      [
        [REDIRECTS_PATHNAME, { fromPath: '/gone', statusCode: GONE_STATUS }],
        [REDIRECTS_PATHNAME, { fromPath: '/old', toPath: '/new' }],
      ],
    );
  });
});

test('reorder needs a position for every item, within the server limits, each id once', async () => {
  const { BLOG_MAX_POSITIONS_PER_REQUEST, BLOG_POSITION_MAX } = await import('../src/core/constants.js');
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const refused = [
      { items: [{ id: TARGET_ID }] },
      { items: [{ id: TARGET_ID, position: BLOG_POSITION_MAX + 1 }] },
      { items: [{ id: TARGET_ID, position: 0 }, { id: TARGET_ID, position: 1 }] },
      {
        items: Array.from({ length: BLOG_MAX_POSITIONS_PER_REQUEST + 1 }, (_, index) => ({
          id: `bbbbbbbb-0000-4000-8000-${String(index).padStart(12, '0')}`,
          position: index,
        })),
      },
    ];
    for (const body of refused) {
      const { envelope } = await call('products_blog_pages_reorder', { product_id: PRODUCT_ID, body });
      assert.equal(envelope.ok, false, JSON.stringify(body).slice(0, 80));
    }
    assert.equal(nonWhoamiRequests().length, 0);
    await call('products_blog_pages_reorder', {
      product_id: PRODUCT_ID,
      body: { items: [{ id: TARGET_ID, position: BLOG_POSITION_MAX }] },
    });
    assert.equal(nonWhoamiRequests().length, 1);
  });
});

test('a webhook with an empty events list is refused before any request', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const created = await call('products_blog_webhooks_create', {
      product_id: PRODUCT_ID,
      body: { url: 'https://hooks.example.com/x', events: [] },
    });
    const updated = await call('products_blog_webhooks_update', {
      product_id: PRODUCT_ID,
      webhook_id: TARGET_ID,
      body: { events: [] },
    });
    assert.equal(created.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(updated.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(nonWhoamiRequests().length, 0);
  });
});

test('cta and html snippets need content; a newsletter snippet may omit it', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    for (const kind of ['cta', 'html']) {
      const { envelope } = await call('products_blog_snippets_create', { product_id: PRODUCT_ID, body: { name: 'X', kind } });
      assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE);
      assert.match(envelope.error.message, /content/);
    }
    assert.equal(nonWhoamiRequests().length, 0);
    await call('products_blog_snippets_create', { product_id: PRODUCT_ID, body: { name: 'News', kind: 'newsletter' } });
    assert.equal(nonWhoamiRequests().length, 1);
  });
});

test('irreversible blog tools are flagged destructive so MCP clients ask first', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ client }) => {
    const { tools } = await client.listTools();
    const destructive = tools
      .filter((tool) => tool.name.startsWith('products_blog_') && tool.annotations?.destructiveHint === true)
      .map((tool) => tool.name)
      .sort();
    assert.deepEqual(destructive, [
      'products_blog_authors_delete',
      'products_blog_categories_delete',
      'products_blog_delete',
      'products_blog_design_discard',
      'products_blog_domain_remove',
      'products_blog_pages_delete',
      'products_blog_posts_delete',
      'products_blog_redirects_delete',
      'products_blog_snippets_delete',
      'products_blog_subscribers_delete',
      'products_blog_webhooks_delete',
      'products_blog_webhooks_update',
    ]);
  });
});

test('a post content update needs a title or a body', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const empty = await call('products_blog_posts_update_content', { product_id: PRODUCT_ID, article_id: TARGET_ID, body: {} });
    assert.equal(empty.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(nonWhoamiRequests().length, 0);
    await call('products_blog_posts_update_content', { product_id: PRODUCT_ID, article_id: TARGET_ID, body: { title: 'T' } });
    assert.equal(nonWhoamiRequests().length, 1);
  });
});

const POSTS_PATHNAME = `/api/agent/v1/products/${PRODUCT_ID}/blog/posts`;
const POST_PATHNAME = `${POSTS_PATHNAME}/${TARGET_ID}`;
const DESIGN_PATHNAME = `/api/agent/v1/products/${PRODUCT_ID}/blog/design`;
const SCHEDULED_FOR = '2026-11-01T09:00:00Z';

test('a one-call post create merges the title and status arguments into the body it sends', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const { envelope } = await call('products_blog_posts_create', {
      product_id: PRODUCT_ID,
      title: 'Why Acme',
      status: 'published',
      body: { content: '## Why\n\nBecause.', tags: ['news'] },
    });
    assert.equal(envelope.ok, true, JSON.stringify(envelope));
    const [sent] = nonWhoamiRequests();
    assert.equal(sent.method, 'POST');
    assert.equal(sent.pathname, POSTS_PATHNAME);
    assert.deepEqual(sent.body, { content: '## Why\n\nBecause.', tags: ['news'], title: 'Why Acme', status: 'published' });
  });
});

test('a post write with two bodies or a schedule without a date is refused before any request', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const both = await call('products_blog_posts_create', {
      product_id: PRODUCT_ID,
      body: { title: 'T', content: 'x', contentHtml: '<p>x</p>' },
    });
    assert.equal(both.envelope.error.code, CliErrorCode.INVALID_USAGE);
    const undated = await call('products_blog_posts_update', {
      product_id: PRODUCT_ID,
      article_id: TARGET_ID,
      status: 'scheduled',
    });
    assert.equal(undated.envelope.error.code, CliErrorCode.INVALID_USAGE);
    const dateOnly = await call('products_blog_posts_update', {
      product_id: PRODUCT_ID,
      article_id: TARGET_ID,
      body: { scheduledFor: SCHEDULED_FOR },
    });
    assert.equal(dateOnly.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(nonWhoamiRequests().length, 0);
  });
});

test('a post update needs at least one change and sends exactly the changed fields', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const empty = await call('products_blog_posts_update', { product_id: PRODUCT_ID, article_id: TARGET_ID });
    assert.equal(empty.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(nonWhoamiRequests().length, 0);
    await call('products_blog_posts_update', {
      product_id: PRODUCT_ID,
      article_id: TARGET_ID,
      status: 'scheduled',
      scheduled_for: SCHEDULED_FOR,
    });
    const [sent] = nonWhoamiRequests();
    assert.equal(sent.method, 'PATCH');
    assert.equal(sent.pathname, POST_PATHNAME);
    assert.deepEqual(sent.body, { status: 'scheduled', scheduledFor: SCHEDULED_FOR });
  });
});

test('a post delete sends DELETE to the post', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    await call('products_blog_posts_delete', { product_id: PRODUCT_ID, article_id: TARGET_ID });
    const [sent] = nonWhoamiRequests();
    assert.equal(sent.method, 'DELETE');
    assert.equal(sent.pathname, POST_PATHNAME);
  });
});

test('a design patch needs a config object and merges the publish argument', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const missing = await call('products_blog_design_patch', { product_id: PRODUCT_ID, body: { publish: true } });
    assert.equal(missing.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(nonWhoamiRequests().length, 0);
    const config = { theme: { colors: { accent: '#2563EB' } } };
    await call('products_blog_design_patch', { product_id: PRODUCT_ID, publish: true, body: { config } });
    const [sent] = nonWhoamiRequests();
    assert.equal(sent.method, 'PATCH');
    assert.equal(sent.pathname, DESIGN_PATHNAME);
    assert.deepEqual(sent.body, { config, publish: true });
  });
});

test('the markdown file option stays CLI-only: MCP tools take the body inline', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ client, call }) => {
    const { tools } = await client.listTools();
    for (const name of ['products_blog_posts_create', 'products_blog_posts_update', 'articles_create']) {
      const properties = Object.keys(tools.find((tool) => tool.name === name).inputSchema.properties);
      assert.equal(properties.includes('content_file'), false, name);
    }
    const refused = await call('products_blog_posts_create', { product_id: PRODUCT_ID, content_file: '/etc/hosts' });
    assert.equal(refused.envelope.error.code, CliErrorCode.INVALID_USAGE);
  });
});
