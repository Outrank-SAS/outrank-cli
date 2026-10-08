import { PRODUCT_ID, SECOND_ID, NOT_FOUND_RESPONSE, NON_JSON_RESPONSE, NETWORK_ERROR_RESPONSE } from './shared.js';

const ITEM_ID = SECOND_ID;
const SUBDOMAIN = 'acme-journal';
const SCHEDULED_FOR = '2026-11-01T09:00:00Z';
const CREATE_JSON = '{"name":"Acme Journal","subdomain":"acme-journal","template":"editorial","accentColor":"#2563EB"}';
const SETTINGS_JSON = '{"description":"Notes from Acme","language":"en"}';
const DESIGN_JSON = '{"theme":{"template":"editorial"}}';
const DOMAIN_JSON = '{"mode":"subdomain","hostname":"blog.acme.example.com"}';
const POST_SETTINGS_JSON = '{"slug":"hello-world","excerpt":"Hello.","tags":["news"]}';
const POST_CONTENT_JSON = '{"title":"Hello world","content":"## Hello\\n\\nFirst post."}';
const PAGE_JSON = '{"title":"About","content":"About Acme.","status":"published","showInNav":true}';
const POSITIONS_JSON = `{"items":[{"id":"${ITEM_ID}","position":0}]}`;
const CATEGORY_JSON = '{"name":"Guides"}';
const AUTHOR_JSON = '{"name":"Ada Writer","isDefault":true}';
const REDIRECT_JSON = '{"fromPath":"/old","toPath":"/new","statusCode":301}';
const SNIPPET_JSON =
  '{"name":"Try Acme","kind":"cta","content":{"title":"Try Acme","button":"Start","href":"https://acme.example.com"}}';
const WEBHOOK_JSON = '{"url":"https://hooks.acme.example.com/outrank"}';
const WEBHOOK_UPDATE_JSON = '{"rotateSecret":true}';

const blog = (...words) => ['products', 'blog', ...words];
const collection = (group, { createJson, updateJson, itemRead = false, reorder = false, update = true }) => [
  { name: `${group}-help`, argv: blog(group, '--help'), config: null },
  { name: `${group}-list`, argv: blog(group, 'list', PRODUCT_ID) },
  ...(itemRead ? [{ name: `${group}-get`, argv: blog(group, 'get', PRODUCT_ID, ITEM_ID) }] : []),
  { name: `${group}-create`, argv: blog(group, 'create', PRODUCT_ID, '--json', createJson) },
  { name: `${group}-create-missing-json`, argv: blog(group, 'create', PRODUCT_ID) },
  ...(update ? [{ name: `${group}-update`, argv: blog(group, 'update', PRODUCT_ID, ITEM_ID, '--json', updateJson) }] : []),
  { name: `${group}-delete`, argv: blog(group, 'delete', PRODUCT_ID, ITEM_ID) },
  { name: `${group}-delete-missing-id`, argv: blog(group, 'delete', PRODUCT_ID) },
  ...(reorder ? [{ name: `${group}-reorder`, argv: blog(group, 'reorder', PRODUCT_ID, '--json', POSITIONS_JSON) }] : []),
];

export default [
  { name: 'help', argv: blog('--help'), config: null },
  { name: 'unknown-subcommand', argv: blog('nonsense', PRODUCT_ID) },
  { name: 'api-error', argv: blog('get', PRODUCT_ID), responses: [NOT_FOUND_RESPONSE] },
  { name: 'non-json-response', argv: blog('get', PRODUCT_ID), responses: [NON_JSON_RESPONSE] },
  { name: 'network-error', argv: blog('get', PRODUCT_ID), responses: [NETWORK_ERROR_RESPONSE] },
  { name: 'no-key', argv: blog('get', PRODUCT_ID), config: null },

  { name: 'get', argv: blog('get', PRODUCT_ID) },
  { name: 'get-missing-id', argv: blog('get') },
  { name: 'get-invalid-id', argv: blog('get', 'not-a-uuid') },
  { name: 'setup', argv: blog('setup', PRODUCT_ID) },
  { name: 'check-subdomain', argv: blog('check-subdomain', PRODUCT_ID, '--subdomain', SUBDOMAIN) },
  { name: 'check-subdomain-missing', argv: blog('check-subdomain', PRODUCT_ID) },
  { name: 'create', argv: blog('create', PRODUCT_ID, '--json', CREATE_JSON) },
  { name: 'create-no-body', argv: blog('create', PRODUCT_ID) },
  { name: 'create-invalid-template', argv: blog('create', PRODUCT_ID, '--json', '{"template":"neon"}') },
  { name: 'update-settings', argv: blog('update-settings', PRODUCT_ID, '--json', SETTINGS_JSON) },
  { name: 'update-settings-missing-json', argv: blog('update-settings', PRODUCT_ID) },
  { name: 'delete', argv: blog('delete', PRODUCT_ID, '--confirm', SUBDOMAIN) },
  { name: 'delete-missing-confirm', argv: blog('delete', PRODUCT_ID) },
  { name: 'usage', argv: blog('usage', PRODUCT_ID) },
  { name: 'analytics', argv: blog('analytics', PRODUCT_ID, '--range', '7d') },
  { name: 'analytics-invalid-range', argv: blog('analytics', PRODUCT_ID, '--range', '1y') },
  { name: 'starter-posts', argv: blog('starter-posts', PRODUCT_ID) },
  { name: 'preview-design', argv: blog('preview', PRODUCT_ID, '--scope', 'design') },
  { name: 'preview-post', argv: blog('preview', PRODUCT_ID, '--scope', 'post', '--target-id', ITEM_ID) },
  { name: 'preview-missing-scope', argv: blog('preview', PRODUCT_ID) },
  { name: 'preview-post-missing-target', argv: blog('preview', PRODUCT_ID, '--scope', 'post') },
  {
    name: 'preview-design-with-target',
    argv: blog('preview', PRODUCT_ID, '--scope', 'design', '--target-id', ITEM_ID),
  },

  { name: 'design-help', argv: blog('design', '--help'), config: null },
  { name: 'design-get', argv: blog('design', 'get', PRODUCT_ID) },
  { name: 'design-update', argv: blog('design', 'update', PRODUCT_ID, '--json', DESIGN_JSON) },
  { name: 'design-publish', argv: blog('design', 'publish', PRODUCT_ID) },
  { name: 'design-discard', argv: blog('design', 'discard', PRODUCT_ID) },

  { name: 'domain-help', argv: blog('domain', '--help'), config: null },
  { name: 'domain-get', argv: blog('domain', 'get', PRODUCT_ID) },
  { name: 'domain-connect', argv: blog('domain', 'connect', PRODUCT_ID, '--json', DOMAIN_JSON) },
  { name: 'domain-connect-missing-mode', argv: blog('domain', 'connect', PRODUCT_ID, '--json', '{"hostname":"a.b.com"}') },
  { name: 'domain-verify', argv: blog('domain', 'verify', PRODUCT_ID) },
  { name: 'domain-remove', argv: blog('domain', 'remove', PRODUCT_ID) },

  { name: 'posts-help', argv: blog('posts', '--help'), config: null },
  { name: 'posts-list', argv: blog('posts', 'list', PRODUCT_ID, '--status', 'published', '--search', 'pdf', '--page', '2') },
  { name: 'posts-list-invalid-status', argv: blog('posts', 'list', PRODUCT_ID, '--status', 'live') },
  { name: 'posts-create', argv: blog('posts', 'create', PRODUCT_ID, '--title', 'Hello world') },
  { name: 'posts-create-untitled', argv: blog('posts', 'create', PRODUCT_ID) },
  { name: 'posts-get', argv: blog('posts', 'get', PRODUCT_ID, ITEM_ID) },
  { name: 'posts-get-missing-article', argv: blog('posts', 'get', PRODUCT_ID) },
  { name: 'posts-update', argv: blog('posts', 'update', PRODUCT_ID, ITEM_ID, '--json', POST_SETTINGS_JSON) },
  { name: 'posts-get-content', argv: blog('posts', 'get-content', PRODUCT_ID, ITEM_ID) },
  { name: 'posts-update-content', argv: blog('posts', 'update-content', PRODUCT_ID, ITEM_ID, '--json', POST_CONTENT_JSON) },
  { name: 'posts-publish', argv: blog('posts', 'publish', PRODUCT_ID, ITEM_ID) },
  {
    name: 'posts-publish-scheduled',
    argv: blog('posts', 'publish', PRODUCT_ID, ITEM_ID, '--scheduled-for', SCHEDULED_FOR),
  },
  { name: 'posts-unpublish', argv: blog('posts', 'unpublish', PRODUCT_ID, ITEM_ID) },
  { name: 'posts-sync', argv: blog('posts', 'sync', PRODUCT_ID, ITEM_ID) },

  ...collection('pages', { createJson: PAGE_JSON, updateJson: '{"status":"draft"}', itemRead: true, reorder: true }),
  ...collection('categories', { createJson: CATEGORY_JSON, updateJson: '{"description":"How-to"}', reorder: true }),
  ...collection('authors', { createJson: AUTHOR_JSON, updateJson: '{"jobTitle":"Editor"}' }),
  ...collection('redirects', { createJson: REDIRECT_JSON, update: false }),
  ...collection('snippets', { createJson: SNIPPET_JSON, updateJson: '{"isActive":false}' }),
  ...collection('webhooks', { createJson: WEBHOOK_JSON, updateJson: WEBHOOK_UPDATE_JSON, itemRead: true }),
  { name: 'webhooks-test', argv: blog('webhooks', 'test', PRODUCT_ID, ITEM_ID) },

  { name: 'subscribers-help', argv: blog('subscribers', '--help'), config: null },
  { name: 'subscribers-list', argv: blog('subscribers', 'list', PRODUCT_ID, '--status', 'subscribed', '--page', '1') },
  { name: 'subscribers-delete', argv: blog('subscribers', 'delete', PRODUCT_ID, ITEM_ID) },
];
