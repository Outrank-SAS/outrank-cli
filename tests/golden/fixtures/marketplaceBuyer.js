import {
  PRODUCT_ID,
  SECOND_ID,
  THIRD_ID,
  NOT_FOUND_RESPONSE,
  NO_CONTENT_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
} from './shared.js';

const ADMIN_ROLE_REQUIRED_RESPONSE = {
  status: 403,
  body: {
    ok: false,
    error: { code: 'ADMIN_ROLE_REQUIRED', message: 'This action requires an organization admin API key.' },
    agent_guidance: 'Ask an organization admin to run this, or create a new API key while holding the admin role.',
  },
};

const BUYER_ARTICLE_PAYLOAD_FILE = 'tests/golden/fixtures/payloads/buyerArticleEdit.json';
const BUYER_ARTICLE_JSON_INLINE = '{"title":"Updated title","body":"<p>Updated body</p>"}';
const BUYER_ARTICLE_JSON_STDIN = '{"title":"Stdin title","body":"<p>Stdin body</p>"}';

export default [
  { name: 'help-buyer-group', argv: ['marketplace', 'buyer', '--help'], config: null },
  { name: 'help-buyer-target-pages-group', argv: ['marketplace', 'buyer', 'target-pages', '--help'], config: null },
  { name: 'help-buyer-placements-group', argv: ['marketplace', 'buyer', 'placements', '--help'], config: null },
  { name: 'help-buyer-participation-group', argv: ['marketplace', 'buyer', 'participation', '--help'], config: null },
  { name: 'help-buyer-article-group', argv: ['marketplace', 'buyer', 'article', '--help'], config: null },
  { name: 'help-buyer-credits-group', argv: ['marketplace', 'buyer', 'credits', '--help'], config: null },

  { name: 'status-basic', argv: ['marketplace', 'buyer', 'status', PRODUCT_ID] },
  { name: 'status-not-found', argv: ['marketplace', 'buyer', 'status', PRODUCT_ID], responses: [NOT_FOUND_RESPONSE] },
  {
    name: 'status-non-json-response',
    argv: ['marketplace', 'buyer', 'status', PRODUCT_ID],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'status-network-error',
    argv: ['marketplace', 'buyer', 'status', PRODUCT_ID],
    responses: [NETWORK_ERROR_RESPONSE],
  },
  { name: 'status-missing-product-id', argv: ['marketplace', 'buyer', 'status'] },
  { name: 'status-no-api-key', argv: ['marketplace', 'buyer', 'status', PRODUCT_ID], config: null },

  { name: 'billing-status-basic', argv: ['marketplace', 'buyer', 'billing-status', PRODUCT_ID] },
  {
    name: 'billing-status-not-found',
    argv: ['marketplace', 'buyer', 'billing-status', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },
  { name: 'billing-status-missing-product-id', argv: ['marketplace', 'buyer', 'billing-status'] },

  { name: 'subscription-basic', argv: ['marketplace', 'buyer', 'subscription', PRODUCT_ID] },
  { name: 'subscription-missing-product-id', argv: ['marketplace', 'buyer', 'subscription'] },

  { name: 'subscribe-quote-basic', argv: ['marketplace', 'buyer', 'subscribe-quote', PRODUCT_ID] },
  {
    name: 'subscribe-quote-not-found',
    argv: ['marketplace', 'buyer', 'subscribe-quote', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },

  { name: 'checkout-basic', argv: ['marketplace', 'buyer', 'checkout', PRODUCT_ID, '--tier', 'scale'] },
  { name: 'checkout-missing-tier', argv: ['marketplace', 'buyer', 'checkout', PRODUCT_ID] },
  {
    name: 'checkout-admin-role-required',
    argv: ['marketplace', 'buyer', 'checkout', PRODUCT_ID, '--tier', 'scale'],
    responses: [ADMIN_ROLE_REQUIRED_RESPONSE],
  },
  { name: 'checkout-missing-product-id', argv: ['marketplace', 'buyer', 'checkout', '--tier', 'scale'] },

  {
    name: 'change-plan-change-tier',
    argv: ['marketplace', 'buyer', 'change-plan', PRODUCT_ID, '--action', 'change_tier', '--tier', 'enterprise'],
  },
  {
    name: 'change-plan-cancel-scheduled',
    argv: ['marketplace', 'buyer', 'change-plan', PRODUCT_ID, '--action', 'cancel_scheduled'],
  },
  {
    name: 'change-plan-cancel-subscription',
    argv: ['marketplace', 'buyer', 'change-plan', PRODUCT_ID, '--action', 'cancel_subscription'],
  },
  {
    name: 'change-plan-restore-subscription',
    argv: ['marketplace', 'buyer', 'change-plan', PRODUCT_ID, '--action', 'restore_subscription'],
  },
  {
    name: 'change-plan-unknown-action-passthrough',
    argv: ['marketplace', 'buyer', 'change-plan', PRODUCT_ID, '--action', 'not_a_real_action'],
  },
  { name: 'change-plan-missing-action', argv: ['marketplace', 'buyer', 'change-plan', PRODUCT_ID] },

  { name: 'target-pages-list-basic', argv: ['marketplace', 'buyer', 'target-pages', 'list', PRODUCT_ID] },
  {
    name: 'target-pages-list-not-found',
    argv: ['marketplace', 'buyer', 'target-pages', 'list', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },

  {
    name: 'target-pages-add-basic',
    argv: ['marketplace', 'buyer', 'target-pages', 'add', PRODUCT_ID, '--urls', 'https://example.com/pricing'],
  },
  {
    name: 'target-pages-add-repeated-comma-urls',
    argv: [
      'marketplace',
      'buyer',
      'target-pages',
      'add',
      PRODUCT_ID,
      '--urls',
      'https://example.com/a,https://example.com/b',
      '--urls',
      'https://example.com/c',
    ],
  },
  {
    name: 'target-pages-add-with-source',
    argv: [
      'marketplace',
      'buyer',
      'target-pages',
      'add',
      PRODUCT_ID,
      '--urls',
      'https://example.com/features',
      '--source',
      'discovered',
    ],
  },
  { name: 'target-pages-add-missing-urls', argv: ['marketplace', 'buyer', 'target-pages', 'add', PRODUCT_ID] },

  {
    name: 'target-pages-discover-basic',
    argv: ['marketplace', 'buyer', 'target-pages', 'discover', PRODUCT_ID],
  },
  {
    name: 'target-pages-discover-with-source-and-url',
    argv: [
      'marketplace',
      'buyer',
      'target-pages',
      'discover',
      PRODUCT_ID,
      '--source',
      'sitemap',
      '--source-url',
      'https://example.com/sitemap.xml',
    ],
  },
  {
    name: 'target-pages-discover-root-url-source',
    argv: ['marketplace', 'buyer', 'target-pages', 'discover', PRODUCT_ID, '--source', 'root_url'],
  },

  { name: 'target-pages-pause-basic', argv: ['marketplace', 'buyer', 'target-pages', 'pause', THIRD_ID] },
  { name: 'target-pages-pause-missing-id', argv: ['marketplace', 'buyer', 'target-pages', 'pause'] },

  { name: 'target-pages-activate-basic', argv: ['marketplace', 'buyer', 'target-pages', 'activate', THIRD_ID] },

  { name: 'target-pages-delete-success', argv: ['marketplace', 'buyer', 'target-pages', 'delete', THIRD_ID] },
  {
    name: 'target-pages-delete-204-non-json',
    argv: ['marketplace', 'buyer', 'target-pages', 'delete', THIRD_ID],
    responses: [NO_CONTENT_RESPONSE],
  },
  { name: 'target-pages-delete', argv: ['marketplace', 'buyer', 'target-pages', 'delete', THIRD_ID] },
  { name: 'target-pages-delete-missing-id', argv: ['marketplace', 'buyer', 'target-pages', 'delete'] },

  { name: 'participation-on-basic', argv: ['marketplace', 'buyer', 'participation', 'on', PRODUCT_ID] },
  { name: 'participation-off-basic', argv: ['marketplace', 'buyer', 'participation', 'off', PRODUCT_ID] },
  {
    name: 'participation-invalid-mode',
    argv: ['marketplace', 'buyer', 'participation', 'toggle', PRODUCT_ID],
  },
  { name: 'participation-missing-mode', argv: ['marketplace', 'buyer', 'participation'] },

  { name: 'buyer-placements-list-basic', argv: ['marketplace', 'buyer', 'placements', 'list', PRODUCT_ID] },
  {
    name: 'buyer-placements-list-status-search',
    argv: ['marketplace', 'buyer', 'placements', 'list', PRODUCT_ID, '--status', 'live', '--search', 'guest post'],
  },
  {
    name: 'buyer-placements-list-page-page-size',
    argv: ['marketplace', 'buyer', 'placements', 'list', PRODUCT_ID, '--page', '3', '--page-size', '15'],
  },
  {
    name: 'buyer-placements-list-page-zero-error',
    argv: ['marketplace', 'buyer', 'placements', 'list', PRODUCT_ID, '--page', '0'],
  },
  {
    name: 'buyer-placements-list-page-size-over-max-error',
    argv: ['marketplace', 'buyer', 'placements', 'list', PRODUCT_ID, '--page-size', '101'],
  },

  { name: 'buyer-placements-regenerate-basic', argv: ['marketplace', 'buyer', 'placements', 'regenerate', SECOND_ID] },
  { name: 'buyer-placements-revalidate-basic', argv: ['marketplace', 'buyer', 'placements', 'revalidate', SECOND_ID] },
  {
    name: 'buyer-placements-unknown-subcommand',
    argv: ['marketplace', 'buyer', 'placements', 'frobnicate', SECOND_ID],
  },

  { name: 'article-get-basic', argv: ['marketplace', 'buyer', 'article', 'get', SECOND_ID] },
  {
    name: 'article-get-not-found',
    argv: ['marketplace', 'buyer', 'article', 'get', SECOND_ID],
    responses: [NOT_FOUND_RESPONSE],
  },

  {
    name: 'article-edit-json-inline',
    argv: ['marketplace', 'buyer', 'article', 'edit', SECOND_ID, '--json', BUYER_ARTICLE_JSON_INLINE],
  },
  {
    name: 'article-edit-json-file',
    argv: ['marketplace', 'buyer', 'article', 'edit', SECOND_ID, '--json-file', BUYER_ARTICLE_PAYLOAD_FILE],
  },
  {
    name: 'article-edit-json-stdin',
    argv: ['marketplace', 'buyer', 'article', 'edit', SECOND_ID, '--json-stdin'],
    stdin: BUYER_ARTICLE_JSON_STDIN,
  },
  { name: 'article-edit-no-source', argv: ['marketplace', 'buyer', 'article', 'edit', SECOND_ID] },
  {
    name: 'article-edit-two-sources',
    argv: [
      'marketplace',
      'buyer',
      'article',
      'edit',
      SECOND_ID,
      '--json',
      BUYER_ARTICLE_JSON_INLINE,
      '--json-file',
      BUYER_ARTICLE_PAYLOAD_FILE,
    ],
  },

  { name: 'credits-history-basic', argv: ['marketplace', 'buyer', 'credits', 'history', PRODUCT_ID] },
  {
    name: 'credits-history-kind-all',
    argv: ['marketplace', 'buyer', 'credits', 'history', PRODUCT_ID, '--kind', 'all'],
  },
  {
    name: 'credits-history-kind-charge',
    argv: ['marketplace', 'buyer', 'credits', 'history', PRODUCT_ID, '--kind', 'charge'],
  },
  {
    name: 'credits-history-kind-refund',
    argv: ['marketplace', 'buyer', 'credits', 'history', PRODUCT_ID, '--kind', 'refund'],
  },
  {
    name: 'credits-history-page-page-size',
    argv: ['marketplace', 'buyer', 'credits', 'history', PRODUCT_ID, '--page', '2', '--page-size', '25'],
  },
  {
    name: 'credits-history-page-zero-error',
    argv: ['marketplace', 'buyer', 'credits', 'history', PRODUCT_ID, '--page', '0'],
  },
  { name: 'credits-history-missing-product-id', argv: ['marketplace', 'buyer', 'credits', 'history'] },

  { name: 'buyer-unknown-subcommand', argv: ['marketplace', 'buyer', 'frobnicate', PRODUCT_ID] },
  { name: 'buyer-target-pages-bare-unknown-subcommand', argv: ['marketplace', 'buyer', 'target-pages'] },
  { name: 'buyer-placements-bare-unknown-subcommand', argv: ['marketplace', 'buyer', 'placements'] },
  { name: 'buyer-article-bare-missing-placement-id', argv: ['marketplace', 'buyer', 'article'] },
  { name: 'buyer-credits-bare-unknown-subcommand', argv: ['marketplace', 'buyer', 'credits'] },
];
