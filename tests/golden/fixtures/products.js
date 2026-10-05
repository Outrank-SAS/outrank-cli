import {
  PRODUCT_ID,
  NOT_FOUND_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
  INVALID_JSON_TEXT,
  INVALID_JSON_STDIN,
  INVALID_JSON_FILE,
  MISSING_JSON_FILE,
  EMPTY_200_RESPONSE,
  SANITIZED_UPSTREAM_BODY_RESPONSE,
} from './shared.js';

const CREATE_JSON_FILE = 'tests/golden/fixtures/payloads/products-create.json';
const UPDATE_JSON_FILE = 'tests/golden/fixtures/payloads/products-update.json';
const OUTPUT_SETTINGS_JSON_FILE = 'tests/golden/fixtures/payloads/products-output-settings-update.json';
const TARGET_AUDIENCES_JSON_FILE = 'tests/golden/fixtures/payloads/products-target-audiences-replace.json';
const COMPETITORS_JSON_FILE = 'tests/golden/fixtures/payloads/products-competitors-replace.json';
const CREATE_COMPETITORS =
  '[{"name":"Alpha","link":"https://alpha.example.com"},{"name":"Beta","link":"https://beta.example.com"},' +
  '{"name":"Gamma","link":"https://gamma.example.com"}]';
const CREATE_DESCRIPTION = 'Acme sells project management software for small teams that plan work together.';
const CREATE_AUDIENCES = '["Small business owners","Project managers","Team leads"]';
const createBody = (name, url) =>
  `{"name":"${name}","url":"${url}","description":"${CREATE_DESCRIPTION}","target_audiences":${CREATE_AUDIENCES},` +
  `"language":"en","keyword_region":"us","competitors":${CREATE_COMPETITORS}}`;
const CREATE_JSON_INLINE = createBody('Acme Blog', 'https://acme.example.com');
const CREATE_JSON_MISSING_FIELD = '{"name":"Acme Blog","url":"https://acme.example.com","daily_article_count":1}';
const CREATE_JSON_WRONG_TYPE = createBody('Acme Blog', 'https://acme.example.com').replace(
  CREATE_AUDIENCES,
  '"Small business owners"',
);
const UPDATE_JSON_INLINE = '{"daily_article_count":2}';
const OUTPUT_SETTINGS_JSON_INLINE = '{"tone":"professional"}';
const TARGET_AUDIENCES_JSON_INLINE = '{"target_audiences":[{"name":"Small business owners"}]}';
const COMPETITORS_JSON_INLINE =
  '{"competitors":[{"url":"https://a.example.com"},{"url":"https://b.example.com"},{"url":"https://c.example.com"}]}';
const CREATE_STDIN = createBody('Stdin Product', 'https://stdin.example.com');
const UPDATE_STDIN = '{"daily_article_count":3}';

export default [
  { name: 'help', argv: ['products', '--help'], config: null },
  { name: 'unknown-subcommand', argv: ['products', 'nonsense'] },
  { name: 'api-error', argv: ['products', 'get', PRODUCT_ID], responses: [NOT_FOUND_RESPONSE] },
  { name: 'non-json-response', argv: ['products', 'list'], responses: [NON_JSON_RESPONSE] },
  { name: 'network-error', argv: ['products', 'list'], responses: [NETWORK_ERROR_RESPONSE] },
  { name: 'no-key', argv: ['products', 'list'], config: null },

  { name: 'list-default', argv: ['products', 'list'] },
  { name: 'list-status', argv: ['products', 'list', '--status', 'active'] },
  { name: 'list-limit', argv: ['products', 'list', '--limit', '20'] },
  { name: 'list-cursor', argv: ['products', 'list', '--cursor', '2026-01-01T00:00:00.000Z'] },
  {
    name: 'list-all-options',
    argv: ['products', 'list', '--status', 'disabled', '--limit', '5', '--cursor', '2026-02-01T00:00:00.000Z'],
  },
  { name: 'list-limit-too-low', argv: ['products', 'list', '--limit', '0'] },
  { name: 'list-limit-too-high', argv: ['products', 'list', '--limit', '101'] },
  { name: 'list-limit-not-integer', argv: ['products', 'list', '--limit', 'abc'] },

  { name: 'get', argv: ['products', 'get', PRODUCT_ID] },
  { name: 'get-missing-id', argv: ['products', 'get'] },

  { name: 'create-json-inline', argv: ['products', 'create', '--json', CREATE_JSON_INLINE] },
  { name: 'create-json-file', argv: ['products', 'create', '--json-file', CREATE_JSON_FILE] },
  { name: 'create-json-stdin', argv: ['products', 'create', '--json-stdin'], stdin: CREATE_STDIN },
  { name: 'create-missing-required-field', argv: ['products', 'create', '--json', CREATE_JSON_MISSING_FIELD] },
  { name: 'create-field-wrong-type', argv: ['products', 'create', '--json', CREATE_JSON_WRONG_TYPE] },
  { name: 'create-no-json-source', argv: ['products', 'create'] },
  {
    name: 'create-two-json-sources',
    argv: ['products', 'create', '--json', CREATE_JSON_INLINE, '--json-file', CREATE_JSON_FILE],
  },
  { name: 'create-invalid-json', argv: ['products', 'create', '--json', INVALID_JSON_TEXT] },
  { name: 'create-invalid-json-stdin', argv: ['products', 'create', '--json-stdin'], stdin: INVALID_JSON_STDIN },
  { name: 'create-invalid-json-file', argv: ['products', 'create', '--json-file', INVALID_JSON_FILE] },
  { name: 'create-json-file-missing', argv: ['products', 'create', '--json-file', MISSING_JSON_FILE] },

  { name: 'update-json-inline', argv: ['products', 'update', PRODUCT_ID, '--json', UPDATE_JSON_INLINE] },
  { name: 'update-json-file', argv: ['products', 'update', PRODUCT_ID, '--json-file', UPDATE_JSON_FILE] },
  { name: 'update-json-stdin', argv: ['products', 'update', PRODUCT_ID, '--json-stdin'], stdin: UPDATE_STDIN },
  { name: 'update-no-json-source', argv: ['products', 'update', PRODUCT_ID] },
  {
    name: 'update-two-json-sources',
    argv: ['products', 'update', PRODUCT_ID, '--json', UPDATE_JSON_INLINE, '--json-file', UPDATE_JSON_FILE],
  },
  { name: 'update-missing-id', argv: ['products', 'update', '--json', UPDATE_JSON_INLINE] },

  { name: 'pause', argv: ['products', 'pause', PRODUCT_ID] },
  { name: 'pause-missing-id', argv: ['products', 'pause'] },
  { name: 'pause-help-swallowed', argv: ['products', 'pause', PRODUCT_ID, '--help'] },

  { name: 'resume', argv: ['products', 'resume', PRODUCT_ID] },
  { name: 'resume-missing-id', argv: ['products', 'resume'] },

  { name: 'output-settings-help', argv: ['products', 'output-settings', '--help'], config: null },
  { name: 'output-settings-unknown-subcommand', argv: ['products', 'output-settings', 'nonsense', PRODUCT_ID] },
  { name: 'output-settings-get', argv: ['products', 'output-settings', 'get', PRODUCT_ID] },
  { name: 'output-settings-get-missing-id', argv: ['products', 'output-settings', 'get'] },
  {
    name: 'output-settings-update-json-inline',
    argv: ['products', 'output-settings', 'update', PRODUCT_ID, '--json', OUTPUT_SETTINGS_JSON_INLINE],
  },
  {
    name: 'output-settings-update-json-file',
    argv: ['products', 'output-settings', 'update', PRODUCT_ID, '--json-file', OUTPUT_SETTINGS_JSON_FILE],
  },
  {
    name: 'output-settings-update-json-stdin',
    argv: ['products', 'output-settings', 'update', PRODUCT_ID, '--json-stdin'],
    stdin: OUTPUT_SETTINGS_JSON_INLINE,
  },
  {
    name: 'output-settings-update-no-json-source',
    argv: ['products', 'output-settings', 'update', PRODUCT_ID],
  },
  {
    name: 'output-settings-update-two-json-sources',
    argv: [
      'products',
      'output-settings',
      'update',
      PRODUCT_ID,
      '--json',
      OUTPUT_SETTINGS_JSON_INLINE,
      '--json-file',
      OUTPUT_SETTINGS_JSON_FILE,
    ],
  },

  { name: 'target-audiences-help', argv: ['products', 'target-audiences', '--help'], config: null },
  { name: 'target-audiences-unknown-subcommand', argv: ['products', 'target-audiences', 'nonsense', PRODUCT_ID] },
  { name: 'target-audiences-list', argv: ['products', 'target-audiences', 'list', PRODUCT_ID] },
  { name: 'target-audiences-list-missing-id', argv: ['products', 'target-audiences', 'list'] },
  {
    name: 'target-audiences-replace-json-inline',
    argv: ['products', 'target-audiences', 'replace', PRODUCT_ID, '--json', TARGET_AUDIENCES_JSON_INLINE],
  },
  {
    name: 'target-audiences-replace-json-file',
    argv: ['products', 'target-audiences', 'replace', PRODUCT_ID, '--json-file', TARGET_AUDIENCES_JSON_FILE],
  },
  {
    name: 'target-audiences-replace-json-stdin',
    argv: ['products', 'target-audiences', 'replace', PRODUCT_ID, '--json-stdin'],
    stdin: TARGET_AUDIENCES_JSON_INLINE,
  },
  {
    name: 'target-audiences-replace-no-json-source',
    argv: ['products', 'target-audiences', 'replace', PRODUCT_ID],
  },
  {
    name: 'target-audiences-replace-two-json-sources',
    argv: [
      'products',
      'target-audiences',
      'replace',
      PRODUCT_ID,
      '--json',
      TARGET_AUDIENCES_JSON_INLINE,
      '--json-file',
      TARGET_AUDIENCES_JSON_FILE,
    ],
  },

  { name: 'competitors-help', argv: ['products', 'competitors', '--help'], config: null },
  { name: 'competitors-unknown-subcommand', argv: ['products', 'competitors', 'nonsense', PRODUCT_ID] },
  { name: 'competitors-list', argv: ['products', 'competitors', 'list', PRODUCT_ID] },
  { name: 'competitors-list-missing-id', argv: ['products', 'competitors', 'list'] },
  {
    name: 'competitors-replace-json-inline',
    argv: ['products', 'competitors', 'replace', PRODUCT_ID, '--json', COMPETITORS_JSON_INLINE],
  },
  {
    name: 'competitors-replace-json-file',
    argv: ['products', 'competitors', 'replace', PRODUCT_ID, '--json-file', COMPETITORS_JSON_FILE],
  },
  {
    name: 'competitors-replace-json-stdin',
    argv: ['products', 'competitors', 'replace', PRODUCT_ID, '--json-stdin'],
    stdin: COMPETITORS_JSON_INLINE,
  },
  {
    name: 'competitors-replace-no-json-source',
    argv: ['products', 'competitors', 'replace', PRODUCT_ID],
  },
  {
    name: 'competitors-replace-two-json-sources',
    argv: [
      'products',
      'competitors',
      'replace',
      PRODUCT_ID,
      '--json',
      COMPETITORS_JSON_INLINE,
      '--json-file',
      COMPETITORS_JSON_FILE,
    ],
  },
  { name: 'pause-surplus-positional', argv: ['products', 'pause', PRODUCT_ID, 'extra'] },
  { name: 'list-empty-200-body', argv: ['products', 'list'], responses: [EMPTY_200_RESPONSE] },
  { name: 'list-sanitized-upstream-body', argv: ['products', 'list'], responses: [SANITIZED_UPSTREAM_BODY_RESPONSE] },
  { name: 'list-global-option-repeated', argv: ['products', 'list', '--api-key', 'outr_live_a', '--api-key', 'outr_live_b'] },
];
