import { NOT_FOUND_RESPONSE, NON_JSON_RESPONSE, NETWORK_ERROR_RESPONSE } from './shared.js';

const QUOTE_409_WITH_DETAILS = {
  status: 409,
  body: {
    ok: false,
    error: {
      code: 'QUOTE_REQUIRED',
      message: 'Review the quoted recurring total before confirming.',
      details: { additional_products: 2, recurring_total_cents: 19800, currency: 'usd' },
    },
    agent_guidance: 'stub guidance',
  },
};

const QUOTE_409_WITHOUT_DETAILS = {
  status: 409,
  body: {
    ok: false,
    error: { code: 'CONFLICT', message: 'Conflict.' },
    agent_guidance: 'stub guidance',
  },
};

export default [
  { name: 'help', argv: ['billing', '--help'], config: null },
  { name: 'purchase-products-help', argv: ['billing', 'purchase-products', '--help'] },
  { name: 'portal-url', argv: ['billing', 'portal-url'] },
  { name: 'portal-url-no-key', argv: ['billing', 'portal-url'], config: null },
  { name: 'portal-url-not-found', argv: ['billing', 'portal-url'], responses: [NOT_FOUND_RESPONSE] },
  { name: 'portal-url-non-json', argv: ['billing', 'portal-url'], responses: [NON_JSON_RESPONSE] },
  { name: 'portal-url-network-error', argv: ['billing', 'portal-url'], responses: [NETWORK_ERROR_RESPONSE] },
  {
    name: 'quote-missing-additional-products',
    argv: ['billing', 'purchase-products', 'quote'],
  },
  {
    name: 'quote-with-idempotency-key',
    argv: [
      'billing', 'purchase-products', 'quote',
      '--additional-products', '2',
      '--idempotency-key', 'quote-key-1',
    ],
    responses: [QUOTE_409_WITH_DETAILS],
  },
  {
    name: 'quote-without-idempotency-key',
    argv: ['billing', 'purchase-products', 'quote', '--additional-products', '2'],
    responses: [QUOTE_409_WITH_DETAILS],
  },
  {
    name: 'quote-409-without-details',
    argv: [
      'billing', 'purchase-products', 'quote',
      '--additional-products', '2',
      '--idempotency-key', 'quote-key-2',
    ],
    responses: [QUOTE_409_WITHOUT_DETAILS],
  },
  {
    name: 'quote-200',
    argv: [
      'billing', 'purchase-products', 'quote',
      '--additional-products', '2',
      '--idempotency-key', 'quote-key-3',
    ],
  },
  {
    name: 'buy-happy',
    argv: [
      'billing', 'purchase-products', 'buy',
      '--additional-products', '2',
      '--confirm-charge-cents', '19800',
      '--idempotency-key', 'buy-key-1',
    ],
  },
  {
    name: 'buy-missing-idempotency-key',
    argv: [
      'billing', 'purchase-products', 'buy',
      '--additional-products', '2',
      '--confirm-charge-cents', '19800',
    ],
  },
  {
    name: 'buy-confirm-charge-cents-zero',
    argv: [
      'billing', 'purchase-products', 'buy',
      '--additional-products', '1',
      '--confirm-charge-cents', '0',
      '--idempotency-key', 'buy-key-2',
    ],
  },
  {
    name: 'buy-confirm-charge-cents-empty',
    argv: [
      'billing', 'purchase-products', 'buy',
      '--additional-products', '1',
      '--confirm-charge-cents=',
      '--idempotency-key', 'buy-key-3',
    ],
  },
  {
    name: 'buy-additional-products-zero',
    argv: ['billing', 'purchase-products', 'buy', '--additional-products', '0'],
  },
  {
    name: 'buy-additional-products-31',
    argv: ['billing', 'purchase-products', 'buy', '--additional-products', '31'],
  },
  { name: 'purchase-products-unknown-subcommand', argv: ['billing', 'purchase-products', 'nonsense'] },
  { name: 'unknown-subcommand', argv: ['billing', 'nonsense'] },
];
