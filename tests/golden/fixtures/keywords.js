import {
  PRODUCT_ID,
  SECOND_ID,
  THIRD_ID,
  NOT_FOUND_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
  NO_CONTENT_RESPONSE,
  EMPTY_200_RESPONSE,
} from './shared.js';

const KEYWORDS_ADD_PAYLOAD_PATH = 'tests/golden/fixtures/payloads/keywords-add.json';
const KEYWORDS_BULK_RESCHEDULE_PAYLOAD_PATH = 'tests/golden/fixtures/payloads/keywords-bulk-reschedule.json';

export default [
  { name: 'help', argv: ['keywords', '--help'], config: null },

  {
    name: 'list-all-filters',
    argv: [
      'keywords', 'list',
      '--product', PRODUCT_ID,
      '--scope', 'all',
      '--status', 'published',
      '--q', 'best seo tools',
      '--article-type', 'listicle',
      '--article-subtype', 'comparison',
      '--scheduled-from', '2026-01-01',
      '--scheduled-to', '2026-12-31',
      '--search-volume-min', '10',
      '--search-volume-max', '5000',
      '--difficulty-min', '0',
      '--difficulty-max', '100',
      '--limit', '25',
      '--offset', '5',
    ],
  },
  { name: 'list-minimal', argv: ['keywords', 'list', '--product', PRODUCT_ID] },
  { name: 'list-missing-product', argv: ['keywords', 'list'] },
  {
    name: 'list-search-volume-min-negative',
    argv: ['keywords', 'list', '--product', PRODUCT_ID, '--search-volume-min', '-5'],
  },
  {
    name: 'list-limit-out-of-range',
    argv: ['keywords', 'list', '--product', PRODUCT_ID, '--limit', '101'],
  },
  {
    name: 'list-not-found',
    argv: ['keywords', 'list', '--product', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },
  {
    name: 'list-non-json',
    argv: ['keywords', 'list', '--product', PRODUCT_ID],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'list-network-error',
    argv: ['keywords', 'list', '--product', PRODUCT_ID],
    responses: [NETWORK_ERROR_RESPONSE],
  },
  { name: 'list-no-key', argv: ['keywords', 'list', '--product', PRODUCT_ID], config: null },

  { name: 'get-scheduled', argv: ['keywords', 'get', SECOND_ID, '--kind', 'scheduled'] },
  { name: 'get-stored', argv: ['keywords', 'get', SECOND_ID, '--kind', 'stored'] },
  { name: 'get-missing-id', argv: ['keywords', 'get'] },

  { name: 'export', argv: ['keywords', 'export', '--product', PRODUCT_ID] },
  { name: 'export-missing-product', argv: ['keywords', 'export'] },

  { name: 'generation-status', argv: ['keywords', 'generation-status', '--product', PRODUCT_ID] },
  { name: 'generation-status-missing-product', argv: ['keywords', 'generation-status'] },

  {
    name: 'add-json-inline',
    argv: ['keywords', 'add', '--product', PRODUCT_ID, '--json', '{"keyword":"best crm software"}'],
  },
  {
    name: 'add-json-file',
    argv: ['keywords', 'add', '--product', PRODUCT_ID, '--json-file', KEYWORDS_ADD_PAYLOAD_PATH],
  },
  { name: 'add-no-json-source', argv: ['keywords', 'add', '--product', PRODUCT_ID] },
  {
    name: 'add-two-json-sources',
    argv: [
      'keywords', 'add', '--product', PRODUCT_ID,
      '--json', '{"keyword":"x"}',
      '--json-file', KEYWORDS_ADD_PAYLOAD_PATH,
    ],
  },
  {
    name: 'add-missing-product',
    argv: ['keywords', 'add', '--json', '{"keyword":"best crm software"}'],
  },

  {
    name: 'update-json-inline',
    argv: ['keywords', 'update', SECOND_ID, '--json', '{"instructions":"Write for beginners"}'],
  },
  {
    name: 'update-json-stdin',
    argv: ['keywords', 'update', SECOND_ID, '--json-stdin'],
    stdin: '{"scheduled_for":"2026-05-20"}',
  },
  { name: 'update-missing-id', argv: ['keywords', 'update'] },

  { name: 'suggest-keyword', argv: ['keywords', 'suggest', '--product', PRODUCT_ID, '--keyword', 'email marketing'] },
  {
    name: 'suggest-theme',
    argv: [
      'keywords', 'suggest', '--product', PRODUCT_ID,
      '--theme', 'email marketing',
      '--keyword-region', 'us',
      '--limit', '8',
    ],
  },
  { name: 'suggest-neither', argv: ['keywords', 'suggest', '--product', PRODUCT_ID] },
  {
    name: 'suggest-both',
    argv: [
      'keywords', 'suggest', '--product', PRODUCT_ID,
      '--keyword', 'email marketing',
      '--theme', 'lifecycle marketing',
    ],
  },
  {
    name: 'suggest-limit-out-of-range',
    argv: ['keywords', 'suggest', '--product', PRODUCT_ID, '--keyword', 'email marketing', '--limit', '21'],
  },

  { name: 'generate-count-4', argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--count', '4'] },
  { name: 'generate-count-5', argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--count', '5'] },
  { name: 'generate-count-30', argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--count', '30'] },
  { name: 'generate-count-31', argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--count', '31'] },
  {
    name: 'generate-source-competitors',
    argv: [
      'keywords', 'generate', '--product', PRODUCT_ID,
      '--count', '10',
      '--source', 'competitors',
      '--competitor', SECOND_ID,
      '--competitor', THIRD_ID,
    ],
  },
  {
    name: 'generate-source-audiences',
    argv: [
      'keywords', 'generate', '--product', PRODUCT_ID,
      '--count', '10',
      '--source', 'audiences',
      '--audience', 'small business owners',
      '--audience', 'freelancers',
    ],
  },
  {
    name: 'generate-source-both',
    argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--count', '10', '--source', 'both'],
  },
  {
    name: 'generate-source-invalid',
    argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--count', '10', '--source', 'nonsense'],
  },
  {
    name: 'generate-legacy-theme',
    argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--theme', 'email marketing'],
  },
  {
    name: 'generate-legacy-country',
    argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--country', 'US'],
  },
  { name: 'generate-missing-count', argv: ['keywords', 'generate', '--product', PRODUCT_ID] },

  {
    name: 'bulk-process-json-inline',
    argv: [
      'keywords', 'bulk-process', '--product', PRODUCT_ID,
      '--json', '{"keywords":["keyword one","keyword two"]}',
      '--keyword-region', 'us',
    ],
  },
  { name: 'bulk-process-missing-product', argv: ['keywords', 'bulk-process', '--json', '{"keywords":["a"]}'] },
  { name: 'bulk-process-no-json-source', argv: ['keywords', 'bulk-process', '--product', PRODUCT_ID] },

  {
    name: 'bulk-reschedule-json-file',
    argv: ['keywords', 'bulk-reschedule', '--json-file', KEYWORDS_BULK_RESCHEDULE_PAYLOAD_PATH],
  },
  { name: 'bulk-reschedule-no-json-source', argv: ['keywords', 'bulk-reschedule'] },

  { name: 'delete', argv: ['keywords', 'delete', SECOND_ID] },
  { name: 'delete-204-non-json', argv: ['keywords', 'delete', SECOND_ID], responses: [NO_CONTENT_RESPONSE] },
  { name: 'delete-missing-id', argv: ['keywords', 'delete'] },

  {
    name: 'bulk-delete-json-inline',
    argv: ['keywords', 'bulk-delete', '--json', `{"keyword_ids":["${SECOND_ID}","${THIRD_ID}"]}`],
  },
  { name: 'bulk-delete-no-json-source', argv: ['keywords', 'bulk-delete'] },

  { name: 'unknown-subcommand', argv: ['keywords', 'nonsense'] },
  { name: 'list-unknown-option', argv: ['keywords', 'list', '--product', PRODUCT_ID, '--limt', '5'] },
  { name: 'list-value-option-before-option', argv: ['keywords', 'list', '--product', PRODUCT_ID, '--q', '--limit', '5'] },
  { name: 'list-product-not-uuid', argv: ['keywords', 'list', '--product', 'not-a-uuid'] },
  { name: 'list-limit-not-integer', argv: ['keywords', 'list', '--product', PRODUCT_ID, '--limit', '5.5'] },
  { name: 'list-limit-with-whitespace', argv: ['keywords', 'list', '--product', PRODUCT_ID, '--limit', ' 5'] },
  { name: 'add-json-array-body', argv: ['keywords', 'add', '--product', PRODUCT_ID, '--json', '[1,2]'] },
  { name: 'add-json-empty-string', argv: ['keywords', 'add', '--product', PRODUCT_ID, '--json', ''] },
  { name: 'suggest-missing-product-and-term', argv: ['keywords', 'suggest'] },
  { name: 'suggest-keyword-named-help', argv: ['keywords', 'suggest', '--product', PRODUCT_ID, '--keyword', 'help'] },
  {
    name: 'generation-status-empty-200-body',
    argv: ['keywords', 'generation-status', '--product', PRODUCT_ID],
    responses: [EMPTY_200_RESPONSE],
  },
  {
    name: 'generate-gateway-502',
    argv: ['keywords', 'generate', '--product', PRODUCT_ID, '--count', '5'],
    responses: [NON_JSON_RESPONSE],
  },
  { name: 'add-json-file-empty', argv: ['keywords', 'add', '--product', PRODUCT_ID, '--json-file='] },
  { name: 'list-limit-repeated', argv: ['keywords', 'list', '--product', PRODUCT_ID, '--limit', '5', '--limit', '6'] },
  { name: 'list-product-repeated', argv: ['keywords', 'list', '--product', PRODUCT_ID, '--product', SECOND_ID] },
];
