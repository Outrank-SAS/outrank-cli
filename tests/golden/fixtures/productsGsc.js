import {
  PRODUCT_ID,
  NOT_FOUND_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
  NO_CONTENT_RESPONSE,
} from './shared.js';

const ATTEMPT_ID = 'attempt-123';
const OWNER_EMAIL = 'owner@example.com';
const SITE_URL = 'https://acme.example.com/';
const INSPECT_URL = 'https://acme.example.com/blog/post';

export default [
  { name: 'help', argv: ['products', 'gsc', '--help'], config: null },
  { name: 'unknown-subcommand', argv: ['products', 'gsc', 'nonsense', PRODUCT_ID] },
  { name: 'api-error', argv: ['products', 'gsc', 'status', PRODUCT_ID], responses: [NOT_FOUND_RESPONSE] },
  { name: 'non-json-response', argv: ['products', 'gsc', 'status', PRODUCT_ID], responses: [NON_JSON_RESPONSE] },
  { name: 'network-error', argv: ['products', 'gsc', 'status', PRODUCT_ID], responses: [NETWORK_ERROR_RESPONSE] },
  { name: 'no-key', argv: ['products', 'gsc', 'status', PRODUCT_ID], config: null },

  { name: 'status', argv: ['products', 'gsc', 'status', PRODUCT_ID] },
  { name: 'status-missing-id', argv: ['products', 'gsc', 'status'] },

  { name: 'connect', argv: ['products', 'gsc', 'connect', PRODUCT_ID] },
  { name: 'connect-missing-id', argv: ['products', 'gsc', 'connect'] },

  { name: 'poll', argv: ['products', 'gsc', 'poll', PRODUCT_ID, '--attempt-id', ATTEMPT_ID] },
  { name: 'poll-missing-attempt-id', argv: ['products', 'gsc', 'poll', PRODUCT_ID] },
  { name: 'poll-missing-id', argv: ['products', 'gsc', 'poll', '--attempt-id', ATTEMPT_ID] },

  { name: 'reconnect', argv: ['products', 'gsc', 'reconnect', PRODUCT_ID] },
  { name: 'reconnect-missing-id', argv: ['products', 'gsc', 'reconnect'] },

  { name: 'disconnect', argv: ['products', 'gsc', 'disconnect', PRODUCT_ID] },
  {
    name: 'disconnect-204-non-json',
    argv: ['products', 'gsc', 'disconnect', PRODUCT_ID],
    responses: [NO_CONTENT_RESPONSE],
  },
  { name: 'disconnect-missing-id', argv: ['products', 'gsc', 'disconnect'] },

  { name: 'accounts', argv: ['products', 'gsc', 'accounts', PRODUCT_ID] },
  { name: 'accounts-missing-id', argv: ['products', 'gsc', 'accounts'] },

  { name: 'properties', argv: ['products', 'gsc', 'properties', PRODUCT_ID, '--email', OWNER_EMAIL] },
  { name: 'properties-missing-email', argv: ['products', 'gsc', 'properties', PRODUCT_ID] },
  { name: 'properties-missing-id', argv: ['products', 'gsc', 'properties', '--email', OWNER_EMAIL] },

  {
    name: 'set-property',
    argv: ['products', 'gsc', 'set-property', PRODUCT_ID, '--email', OWNER_EMAIL, '--site-url', SITE_URL],
  },
  { name: 'set-property-missing-email', argv: ['products', 'gsc', 'set-property', PRODUCT_ID, '--site-url', SITE_URL] },
  {
    name: 'set-property-missing-site-url',
    argv: ['products', 'gsc', 'set-property', PRODUCT_ID, '--email', OWNER_EMAIL],
  },
  { name: 'set-property-missing-both', argv: ['products', 'gsc', 'set-property', PRODUCT_ID] },

  { name: 'performance', argv: ['products', 'gsc', 'performance', PRODUCT_ID] },
  { name: 'performance-months', argv: ['products', 'gsc', 'performance', PRODUCT_ID, '--months', '3'] },
  { name: 'performance-months-too-low', argv: ['products', 'gsc', 'performance', PRODUCT_ID, '--months', '0'] },
  { name: 'performance-months-too-high', argv: ['products', 'gsc', 'performance', PRODUCT_ID, '--months', '17'] },
  { name: 'performance-months-boundary-max', argv: ['products', 'gsc', 'performance', PRODUCT_ID, '--months', '16'] },
  { name: 'performance-missing-id', argv: ['products', 'gsc', 'performance'] },

  { name: 'search-analytics', argv: ['products', 'gsc', 'search-analytics', PRODUCT_ID] },
  {
    name: 'search-analytics-all-options',
    argv: [
      'products',
      'gsc',
      'search-analytics',
      PRODUCT_ID,
      '--dimensions',
      'query,page',
      '--limit',
      '50',
      '--months',
      '6',
      '--start-date',
      '2026-01-01',
      '--end-date',
      '2026-06-30',
      '--page',
      '/blog/post',
      '--query',
      'outrank seo',
      '--country',
      'usa',
      '--device',
      'mobile',
    ],
  },
  { name: 'search-analytics-limit-too-low', argv: ['products', 'gsc', 'search-analytics', PRODUCT_ID, '--limit', '0'] },
  {
    name: 'search-analytics-limit-too-high',
    argv: ['products', 'gsc', 'search-analytics', PRODUCT_ID, '--limit', '1001'],
  },
  {
    name: 'search-analytics-limit-boundary-max',
    argv: ['products', 'gsc', 'search-analytics', PRODUCT_ID, '--limit', '1000'],
  },
  {
    name: 'search-analytics-months-too-high',
    argv: ['products', 'gsc', 'search-analytics', PRODUCT_ID, '--months', '17'],
  },
  { name: 'search-analytics-missing-id', argv: ['products', 'gsc', 'search-analytics'] },

  { name: 'inspect-url', argv: ['products', 'gsc', 'inspect-url', PRODUCT_ID, '--url', INSPECT_URL] },
  {
    name: 'inspect-url-with-language-code',
    argv: ['products', 'gsc', 'inspect-url', PRODUCT_ID, '--url', INSPECT_URL, '--language-code', 'en'],
  },
  { name: 'inspect-url-missing-url', argv: ['products', 'gsc', 'inspect-url', PRODUCT_ID] },
  { name: 'inspect-url-missing-id', argv: ['products', 'gsc', 'inspect-url', '--url', INSPECT_URL] },

  { name: 'cannibalization', argv: ['products', 'gsc', 'cannibalization', PRODUCT_ID] },
  { name: 'cannibalization-missing-id', argv: ['products', 'gsc', 'cannibalization'] },
];
