import {
  PRODUCT_ID,
  SECOND_ID,
  NOT_FOUND_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
  NO_CONTENT_RESPONSE,
  GATEWAY_TIMEOUT_RESPONSE,
} from './shared.js';

const PAYLOADS_DIR = 'tests/golden/fixtures/payloads';
const ARTICLES_UPDATE_PAYLOAD_PATH = `${PAYLOADS_DIR}/articles-update.json`;
const ARTICLES_REPLACE_PAYLOAD_PATH = `${PAYLOADS_DIR}/articles-replace.json`;
const ARTICLES_BULK_REPLACE_PAYLOAD_PATH = `${PAYLOADS_DIR}/articles-bulk-replace.json`;
const TINY_PNG_PATH = `${PAYLOADS_DIR}/tiny.png`;
const TINY_JPG_PATH = `${PAYLOADS_DIR}/tiny.jpg`;
const TINY_WEBP_PATH = `${PAYLOADS_DIR}/tiny.webp`;
const TINY_GIF_PATH = `${PAYLOADS_DIR}/tiny.gif`;
const NOT_AN_IMAGE_PATH = `${PAYLOADS_DIR}/not-an-image.txt`;
const NONEXISTENT_IMAGE_PATH = `${PAYLOADS_DIR}/does-not-exist.png`;
const ARTICLE_MARKDOWN_PATH = `${PAYLOADS_DIR}/article.md`;
const ARTICLE_CREATE_JSON = `{"product_id":"${PRODUCT_ID}","title":"How to choose a CRM","content_html":"<h2>Start</h2><p>List the steps.</p>","meta_description":"A practical CRM checklist.","slug":"choose-a-crm"}`;
const ARTICLE_CREATE_TWO_BODIES_JSON = `{"product_id":"${PRODUCT_ID}","title":"x","content":"x","content_html":"<p>x</p>"}`;

export default [
  { name: 'help', argv: ['articles', '--help'], config: null },

  {
    name: 'list-all-filters',
    argv: [
      'articles', 'list',
      '--product', PRODUCT_ID,
      '--status', 'published',
      '--title', 'crm',
      '--keyword', 'email marketing',
      '--content', 'automation',
      '--slug', 'best-crm-software',
      '--created-from', '2026-01-01',
      '--created-to', '2026-12-31',
      '--scheduled-from', '2026-01-01',
      '--scheduled-to', '2026-12-31',
      '--sort-by', 'created_at',
      '--sort-order', 'desc',
      '--limit', '20',
      '--offset', '10',
    ],
  },
  { name: 'list-no-filters', argv: ['articles', 'list'] },
  { name: 'list-limit-out-of-range', argv: ['articles', 'list', '--limit', '101'] },
  { name: 'list-not-found', argv: ['articles', 'list'], responses: [NOT_FOUND_RESPONSE] },
  { name: 'list-non-json', argv: ['articles', 'list'], responses: [NON_JSON_RESPONSE] },
  { name: 'list-network-error', argv: ['articles', 'list'], responses: [NETWORK_ERROR_RESPONSE] },
  { name: 'list-no-key', argv: ['articles', 'list'], config: null },

  { name: 'get', argv: ['articles', 'get', SECOND_ID] },
  { name: 'get-missing-id', argv: ['articles', 'get'] },

  { name: 'get-content-markdown', argv: ['articles', 'get-content', SECOND_ID, '--format', 'markdown'] },
  { name: 'get-content-html', argv: ['articles', 'get-content', SECOND_ID, '--format', 'html'] },
  { name: 'get-content-no-format', argv: ['articles', 'get-content', SECOND_ID] },

  {
    name: 'update-json-inline',
    argv: ['articles', 'update', SECOND_ID, '--json', '{"title":"New title"}'],
  },
  {
    name: 'update-json-file',
    argv: ['articles', 'update', SECOND_ID, '--json-file', ARTICLES_UPDATE_PAYLOAD_PATH],
  },
  { name: 'update-no-json-source', argv: ['articles', 'update', SECOND_ID] },
  {
    name: 'update-two-json-sources',
    argv: ['articles', 'update', SECOND_ID, '--json', '{"title":"New title"}', '--json-stdin'],
  },
  { name: 'update-missing-id', argv: ['articles', 'update'] },

  {
    name: 'update-content-json-stdin',
    argv: ['articles', 'update-content', SECOND_ID, '--json-stdin'],
    stdin: '{"content_markdown":"# Updated\\n\\nBody text."}',
  },
  { name: 'update-content-missing-id', argv: ['articles', 'update-content'] },

  {
    name: 'replace-json-inline',
    argv: [
      'articles', 'replace', SECOND_ID,
      '--json', '{"find":"Old brand","replace_with":"New brand","preview_only":true}',
    ],
  },
  {
    name: 'replace-json-file',
    argv: ['articles', 'replace', SECOND_ID, '--json-file', ARTICLES_REPLACE_PAYLOAD_PATH],
  },

  {
    name: 'bulk-replace-json-inline',
    argv: [
      'articles', 'bulk-replace',
      '--json', '{"find":"Old brand","replace_with":"New brand","article_ids":["article-1"],"confirm":true}',
    ],
  },
  {
    name: 'bulk-replace-json-file',
    argv: ['articles', 'bulk-replace', '--json-file', ARTICLES_BULK_REPLACE_PAYLOAD_PATH],
  },
  { name: 'bulk-replace-no-json-source', argv: ['articles', 'bulk-replace'] },

  {
    name: 'upload-image-with-article',
    argv: ['articles', 'upload-image', '--file', TINY_PNG_PATH, '--article', SECOND_ID],
  },
  {
    name: 'upload-image-with-keyword',
    argv: ['articles', 'upload-image', '--file', TINY_JPG_PATH, '--keyword', 'email marketing'],
  },
  {
    name: 'upload-image-missing-both',
    argv: ['articles', 'upload-image', '--file', TINY_WEBP_PATH],
  },
  {
    name: 'upload-image-missing-file',
    argv: ['articles', 'upload-image', '--article', SECOND_ID],
  },
  {
    name: 'upload-image-unsupported-extension',
    argv: ['articles', 'upload-image', '--file', NOT_AN_IMAGE_PATH, '--article', SECOND_ID],
  },
  {
    name: 'upload-image-nonexistent-file',
    argv: ['articles', 'upload-image', '--file', NONEXISTENT_IMAGE_PATH, '--article', SECOND_ID],
  },

  {
    name: 'upload-featured-image-happy',
    argv: ['articles', 'upload-featured-image', SECOND_ID, '--file', TINY_GIF_PATH],
  },
  {
    name: 'upload-featured-image-missing-file',
    argv: ['articles', 'upload-featured-image', SECOND_ID],
  },
  {
    name: 'upload-featured-image-missing-id',
    argv: ['articles', 'upload-featured-image'],
  },

  {
    name: 'create-from-file-and-publish',
    argv: [
      'articles', 'create',
      '--product', PRODUCT_ID,
      '--title', 'How to choose a CRM',
      '--content-file', ARTICLE_MARKDOWN_PATH,
      '--publish',
    ],
  },
  { name: 'create-from-json', argv: ['articles', 'create', '--json', ARTICLE_CREATE_JSON] },
  {
    name: 'create-missing-product',
    argv: ['articles', 'create', '--title', 'How to choose a CRM', '--content-file', ARTICLE_MARKDOWN_PATH],
  },
  { name: 'create-two-bodies', argv: ['articles', 'create', '--json', ARTICLE_CREATE_TWO_BODIES_JSON] },
  { name: 'publish', argv: ['articles', 'publish', SECOND_ID] },
  { name: 'publish-missing-id', argv: ['articles', 'publish'] },
  { name: 'sync', argv: ['articles', 'sync', SECOND_ID] },
  { name: 'retry-publish', argv: ['articles', 'retry-publish', SECOND_ID] },
  { name: 'retry-publish-missing-id', argv: ['articles', 'retry-publish'] },

  { name: 'delete', argv: ['articles', 'delete', SECOND_ID] },
  { name: 'delete-204-non-json', argv: ['articles', 'delete', SECOND_ID], responses: [NO_CONTENT_RESPONSE] },
  { name: 'delete-missing-id', argv: ['articles', 'delete'] },

  { name: 'precreate', argv: ['articles', 'precreate', SECOND_ID] },
  { name: 'precreate-missing-id', argv: ['articles', 'precreate'] },

  { name: 'generate', argv: ['articles', 'generate', SECOND_ID] },
  { name: 'generate-missing-id', argv: ['articles', 'generate'] },

  { name: 'unknown-subcommand', argv: ['articles', 'nonsense'] },
  { name: 'generate-gateway-502', argv: ['articles', 'generate', SECOND_ID], responses: [NON_JSON_RESPONSE] },
  { name: 'precreate-gateway-504', argv: ['articles', 'precreate', SECOND_ID], responses: [GATEWAY_TIMEOUT_RESPONSE] },
  { name: 'get-gateway-502-not-long-running', argv: ['articles', 'get', SECOND_ID], responses: [NON_JSON_RESPONSE] },
  {
    name: 'retry-publish-gateway-504',
    argv: ['articles', 'retry-publish', SECOND_ID],
    responses: [GATEWAY_TIMEOUT_RESPONSE],
  },
  { name: 'upload-image-empty-file-flag', argv: ['articles', 'upload-image', '--file=', '--keyword', 'email'] },
];
