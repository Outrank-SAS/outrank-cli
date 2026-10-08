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
