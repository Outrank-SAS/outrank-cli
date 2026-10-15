import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CliErrorCode } from '../src/core/errors.js';
import { withMcp } from './helpers/mcpHarness.js';

const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const ARTICLE_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const ARTICLES_PATHNAME = '/api/agent/v1/articles';
const MARKDOWN = '## Start\n\nList the steps.';

test('articles_create sends the product, title and body, with publish when asked', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const { envelope } = await call('articles_create', {
      product_id: PRODUCT_ID,
      publish: true,
      body: { title: 'How to choose a CRM', content: MARKDOWN, meta_description: 'A CRM checklist.' },
    });
    assert.equal(envelope.ok, true, JSON.stringify(envelope));
    const [sent] = nonWhoamiRequests();
    assert.equal(sent.method, 'POST');
    assert.equal(sent.pathname, ARTICLES_PATHNAME);
    assert.deepEqual(sent.body, {
      title: 'How to choose a CRM',
      content: MARKDOWN,
      meta_description: 'A CRM checklist.',
      product_id: PRODUCT_ID,
      publish: true,
    });
  });
});

test('articles_create without a product, without a title or with two bodies is refused before any request', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    const bodies = [
      { title: 'T', content: MARKDOWN },
      { product_id: PRODUCT_ID, content: MARKDOWN },
      { product_id: PRODUCT_ID, title: 'T' },
      { product_id: PRODUCT_ID, title: 'T', content: MARKDOWN, content_html: '<p>x</p>' },
    ];
    for (const body of bodies) {
      const { envelope } = await call('articles_create', { body });
      assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE, JSON.stringify(body));
    }
    assert.equal(nonWhoamiRequests().length, 0);
  });
});

test('articles_publish and articles_sync post to their own routes without a body', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, nonWhoamiRequests }) => {
    await call('articles_publish', { article_id: ARTICLE_ID });
    await call('articles_sync', { article_id: ARTICLE_ID });
    assert.deepEqual(
      nonWhoamiRequests().map((request) => [request.method, request.pathname, request.body ?? null]),
      [
        ['POST', `${ARTICLES_PATHNAME}/${ARTICLE_ID}/publish`, null],
        ['POST', `${ARTICLES_PATHNAME}/${ARTICLE_ID}/sync`, null],
      ],
    );
  });
});
