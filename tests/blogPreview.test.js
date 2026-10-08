import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CliErrorCode } from '../src/core/errors.js';
import { withMcp } from './helpers/mcpHarness.js';

const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const TARGET_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
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
