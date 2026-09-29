import { PRODUCT_ID, SECOND_ID, NOT_FOUND_RESPONSE, NON_JSON_RESPONSE, NETWORK_ERROR_RESPONSE } from './shared.js';

const BACKLINK_ID = SECOND_ID;
const UPDATE_JSON_FILE = 'tests/golden/fixtures/payloads/backlinks-update.json';
const UPDATE_JSON_INLINE = '{"enabled":true,"min_domain_rating":10}';
const UPDATE_STDIN = '{"enabled":false}';

export default [
  { name: 'help', argv: ['products', 'backlinks', '--help'], config: null },
  { name: 'unknown-subcommand', argv: ['products', 'backlinks', 'nonsense', PRODUCT_ID] },
  { name: 'api-error', argv: ['products', 'backlinks', 'get', PRODUCT_ID], responses: [NOT_FOUND_RESPONSE] },
  {
    name: 'non-json-response',
    argv: ['products', 'backlinks', 'get', PRODUCT_ID],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'network-error',
    argv: ['products', 'backlinks', 'get', PRODUCT_ID],
    responses: [NETWORK_ERROR_RESPONSE],
  },
  { name: 'no-key', argv: ['products', 'backlinks', 'get', PRODUCT_ID], config: null },

  { name: 'get', argv: ['products', 'backlinks', 'get', PRODUCT_ID] },
  { name: 'get-missing-id', argv: ['products', 'backlinks', 'get'] },

  {
    name: 'update-json-inline',
    argv: ['products', 'backlinks', 'update', PRODUCT_ID, '--json', UPDATE_JSON_INLINE],
  },
  {
    name: 'update-json-file',
    argv: ['products', 'backlinks', 'update', PRODUCT_ID, '--json-file', UPDATE_JSON_FILE],
  },
  {
    name: 'update-json-stdin',
    argv: ['products', 'backlinks', 'update', PRODUCT_ID, '--json-stdin'],
    stdin: UPDATE_STDIN,
  },
  { name: 'update-no-json-source', argv: ['products', 'backlinks', 'update', PRODUCT_ID] },
  {
    name: 'update-two-json-sources',
    argv: [
      'products',
      'backlinks',
      'update',
      PRODUCT_ID,
      '--json',
      UPDATE_JSON_INLINE,
      '--json-file',
      UPDATE_JSON_FILE,
    ],
  },

  { name: 'credits', argv: ['products', 'backlinks', 'credits', PRODUCT_ID] },
  { name: 'credits-missing-id', argv: ['products', 'backlinks', 'credits'] },

  { name: 'earned-default', argv: ['products', 'backlinks', 'earned', PRODUCT_ID] },
  {
    name: 'earned-all-options',
    argv: [
      'products',
      'backlinks',
      'earned',
      PRODUCT_ID,
      '--limit',
      '20',
      '--cursor',
      '2026-01-01T00:00:00.000Z',
      '--status',
      'verified',
      '--sort-by',
      'credits_applied',
      '--sort-order',
      'desc',
      '--include-article',
      '--include-summary',
    ],
  },
  { name: 'earned-limit-too-low', argv: ['products', 'backlinks', 'earned', PRODUCT_ID, '--limit', '0'] },
  { name: 'earned-limit-too-high', argv: ['products', 'backlinks', 'earned', PRODUCT_ID, '--limit', '101'] },
  { name: 'earned-missing-id', argv: ['products', 'backlinks', 'earned'] },

  { name: 'unverified-default', argv: ['products', 'backlinks', 'unverified', PRODUCT_ID] },
  {
    name: 'unverified-all-options',
    argv: [
      'products',
      'backlinks',
      'unverified',
      PRODUCT_ID,
      '--limit',
      '20',
      '--cursor',
      '2026-01-01T00:00:00.000Z',
      '--status',
      'pending',
      '--sort-by',
      'verification_error_reason',
      '--sort-order',
      'desc',
    ],
  },
  { name: 'unverified-limit-too-low', argv: ['products', 'backlinks', 'unverified', PRODUCT_ID, '--limit', '0'] },
  { name: 'unverified-limit-too-high', argv: ['products', 'backlinks', 'unverified', PRODUCT_ID, '--limit', '101'] },
  { name: 'unverified-missing-id', argv: ['products', 'backlinks', 'unverified'] },

  { name: 'check-removal', argv: ['products', 'backlinks', 'check-removal', PRODUCT_ID, BACKLINK_ID] },
  {
    name: 'check-removal-missing-backlink-id',
    argv: ['products', 'backlinks', 'check-removal', PRODUCT_ID],
  },

  { name: 'reverify', argv: ['products', 'backlinks', 'reverify', PRODUCT_ID, BACKLINK_ID] },
  { name: 'reverify-missing-backlink-id', argv: ['products', 'backlinks', 'reverify', PRODUCT_ID] },

  { name: 'subscription', argv: ['products', 'backlinks', 'subscription', PRODUCT_ID] },
  { name: 'subscription-missing-id', argv: ['products', 'backlinks', 'subscription'] },

  {
    name: 'subscribe-quote-premium',
    argv: ['products', 'backlinks', 'subscribe-quote', PRODUCT_ID, '--plan', 'premium'],
  },
  {
    name: 'subscribe-quote-enterprise',
    argv: ['products', 'backlinks', 'subscribe-quote', PRODUCT_ID, '--plan', 'enterprise'],
  },
  { name: 'subscribe-quote-missing-plan', argv: ['products', 'backlinks', 'subscribe-quote', PRODUCT_ID] },
  { name: 'subscribe-quote-missing-id', argv: ['products', 'backlinks', 'subscribe-quote', '--plan', 'premium'] },
];
