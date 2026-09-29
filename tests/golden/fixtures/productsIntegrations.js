import {
  PRODUCT_ID,
  SECOND_ID,
  THIRD_ID,
  NOT_FOUND_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
  NO_CONTENT_RESPONSE,
} from './shared.js';

const INTEGRATION_ID = SECOND_ID;
const DATABASE_ID = THIRD_ID;
const ATTEMPT_ID = 'attempt-123';
const PREPARE_PROVIDER = 'wordpress-plugin';
const CONNECT_PROVIDER = 'wordpress-com';
const VALIDATE_PROVIDER = 'webhook';

const PAYLOADS_DIR = 'tests/golden/fixtures/payloads';
const PREPARE_JSON_FILE = `${PAYLOADS_DIR}/integrations-prepare.json`;
const CONNECT_JSON_FILE = `${PAYLOADS_DIR}/integrations-connect.json`;
const WEBFLOW_SITES_JSON_FILE = `${PAYLOADS_DIR}/webflow-sites.json`;
const WEBFLOW_COLLECTIONS_JSON_FILE = `${PAYLOADS_DIR}/webflow-collections.json`;
const WEBFLOW_FIELDS_JSON_FILE = `${PAYLOADS_DIR}/webflow-fields.json`;
const WEBFLOW_ITEMS_JSON_FILE = `${PAYLOADS_DIR}/webflow-items.json`;
const FRAMER_COLLECTIONS_JSON_FILE = `${PAYLOADS_DIR}/framer-collections.json`;
const FRAMER_FIELDS_JSON_FILE = `${PAYLOADS_DIR}/framer-fields.json`;
const VALIDATE_JSON_FILE = `${PAYLOADS_DIR}/integrations-validate-webhook.json`;
const CREATE_JSON_FILE = `${PAYLOADS_DIR}/integrations-create.json`;
const UPDATE_JSON_FILE = `${PAYLOADS_DIR}/integrations-update.json`;

const PREPARE_JSON_INLINE = '{"domain":"https://acme.example.com"}';
const CONNECT_JSON_INLINE = '{"name":"Main WordPress.com","publish_status":"publish"}';
const WEBFLOW_SITES_JSON_INLINE = '{"api_token":"wf_token"}';
const WEBFLOW_COLLECTIONS_JSON_INLINE = '{"api_token":"wf_token","site_id":"site_id"}';
const WEBFLOW_FIELDS_JSON_INLINE = '{"api_token":"wf_token","collection_id":"collection_id"}';
const WEBFLOW_ITEMS_JSON_INLINE = '{"api_token":"wf_token","collection_id":"collection_id"}';
const FRAMER_COLLECTIONS_JSON_INLINE =
  '{"project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key"}';
const FRAMER_FIELDS_JSON_INLINE = JSON.stringify({
  project_url: 'https://framer.com/projects/your-project',
  server_api_key: 'framer_server_key',
  collection_id: 'collection_id',
});
const VALIDATE_JSON_INLINE = '{"endpoint":"https://api.example.com/webhook","access_token":"secret"}';
const CREATE_JSON_INLINE =
  '{"provider":"webhook","name":"Main Webhook","endpoint":"https://api.example.com/webhook","access_token":"secret"}';
const UPDATE_JSON_INLINE = '{"endpoint":"https://api.example.com/webhook-v2"}';

const PREPARE_STDIN = '{"domain":"https://stdin.example.com"}';
const CONNECT_STDIN = '{"name":"Stdin WordPress.com"}';
const WEBFLOW_SITES_STDIN = '{"api_token":"wf_stdin_token"}';
const FRAMER_COLLECTIONS_STDIN =
  '{"project_url":"https://framer.com/projects/stdin-project","server_api_key":"framer_stdin_key"}';
const VALIDATE_STDIN = '{"endpoint":"https://api.example.com/webhook-stdin","access_token":"stdin-secret"}';
const CREATE_STDIN = '{"provider":"nextjs-blog"}';
const UPDATE_STDIN = '{"publish_status":"draft"}';

export default [
  { name: 'help', argv: ['products', 'integrations', '--help'], config: null },
  { name: 'notion-help', argv: ['products', 'integrations', 'notion', '--help'], config: null },
  { name: 'webflow-help', argv: ['products', 'integrations', 'webflow', '--help'], config: null },
  { name: 'framer-help', argv: ['products', 'integrations', 'framer', '--help'], config: null },
  { name: 'unknown-subcommand', argv: ['products', 'integrations', 'nonsense'] },
  {
    name: 'api-error',
    argv: ['products', 'integrations', 'get', PRODUCT_ID, INTEGRATION_ID],
    responses: [NOT_FOUND_RESPONSE],
  },
  {
    name: 'non-json-response',
    argv: ['products', 'integrations', 'list', PRODUCT_ID],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'network-error',
    argv: ['products', 'integrations', 'list', PRODUCT_ID],
    responses: [NETWORK_ERROR_RESPONSE],
  },
  { name: 'no-key', argv: ['products', 'integrations', 'providers'], config: null },

  { name: 'providers', argv: ['products', 'integrations', 'providers'] },

  { name: 'prepare-no-json', argv: ['products', 'integrations', 'prepare', PREPARE_PROVIDER, PRODUCT_ID] },
  {
    name: 'prepare-json-inline',
    argv: ['products', 'integrations', 'prepare', PREPARE_PROVIDER, PRODUCT_ID, '--json', PREPARE_JSON_INLINE],
  },
  {
    name: 'prepare-json-file',
    argv: ['products', 'integrations', 'prepare', PREPARE_PROVIDER, PRODUCT_ID, '--json-file', PREPARE_JSON_FILE],
  },
  {
    name: 'prepare-json-stdin',
    argv: ['products', 'integrations', 'prepare', PREPARE_PROVIDER, PRODUCT_ID, '--json-stdin'],
    stdin: PREPARE_STDIN,
  },
  {
    name: 'prepare-two-json-sources',
    argv: [
      'products',
      'integrations',
      'prepare',
      PREPARE_PROVIDER,
      PRODUCT_ID,
      '--json',
      PREPARE_JSON_INLINE,
      '--json-file',
      PREPARE_JSON_FILE,
    ],
  },
  { name: 'prepare-missing-provider', argv: ['products', 'integrations', 'prepare'] },
  { name: 'prepare-missing-product-id', argv: ['products', 'integrations', 'prepare', PREPARE_PROVIDER] },

  { name: 'connect-no-json', argv: ['products', 'integrations', 'connect', 'notion', PRODUCT_ID] },
  {
    name: 'connect-json-inline',
    argv: ['products', 'integrations', 'connect', CONNECT_PROVIDER, PRODUCT_ID, '--json', CONNECT_JSON_INLINE],
  },
  {
    name: 'connect-json-file',
    argv: ['products', 'integrations', 'connect', CONNECT_PROVIDER, PRODUCT_ID, '--json-file', CONNECT_JSON_FILE],
  },
  {
    name: 'connect-json-stdin',
    argv: ['products', 'integrations', 'connect', CONNECT_PROVIDER, PRODUCT_ID, '--json-stdin'],
    stdin: CONNECT_STDIN,
  },
  {
    name: 'connect-two-json-sources',
    argv: [
      'products',
      'integrations',
      'connect',
      CONNECT_PROVIDER,
      PRODUCT_ID,
      '--json',
      CONNECT_JSON_INLINE,
      '--json-file',
      CONNECT_JSON_FILE,
    ],
  },
  { name: 'connect-missing-product-id', argv: ['products', 'integrations', 'connect', CONNECT_PROVIDER] },

  {
    name: 'poll',
    argv: ['products', 'integrations', 'poll', CONNECT_PROVIDER, PRODUCT_ID, '--attempt-id', ATTEMPT_ID],
  },
  {
    name: 'poll-missing-attempt-id',
    argv: ['products', 'integrations', 'poll', CONNECT_PROVIDER, PRODUCT_ID],
  },
  {
    name: 'poll-missing-product-id',
    argv: ['products', 'integrations', 'poll', CONNECT_PROVIDER, '--attempt-id', ATTEMPT_ID],
  },

  {
    name: 'notion-databases',
    argv: ['products', 'integrations', 'notion', 'databases', PRODUCT_ID, INTEGRATION_ID],
  },
  {
    name: 'notion-databases-missing-integration-id',
    argv: ['products', 'integrations', 'notion', 'databases', PRODUCT_ID],
  },
  {
    name: 'notion-schema',
    argv: ['products', 'integrations', 'notion', 'schema', PRODUCT_ID, INTEGRATION_ID, DATABASE_ID],
  },
  {
    name: 'notion-schema-missing-database-id',
    argv: ['products', 'integrations', 'notion', 'schema', PRODUCT_ID, INTEGRATION_ID],
  },
  {
    name: 'notion-unknown-subcommand',
    argv: ['products', 'integrations', 'notion', 'bogus', PRODUCT_ID, INTEGRATION_ID],
  },

  {
    name: 'webflow-sites-json-inline',
    argv: ['products', 'integrations', 'webflow', 'sites', '--json', WEBFLOW_SITES_JSON_INLINE],
  },
  {
    name: 'webflow-sites-json-file',
    argv: ['products', 'integrations', 'webflow', 'sites', '--json-file', WEBFLOW_SITES_JSON_FILE],
  },
  {
    name: 'webflow-sites-json-stdin',
    argv: ['products', 'integrations', 'webflow', 'sites', '--json-stdin'],
    stdin: WEBFLOW_SITES_STDIN,
  },
  { name: 'webflow-sites-no-json-source', argv: ['products', 'integrations', 'webflow', 'sites'] },
  {
    name: 'webflow-sites-two-json-sources',
    argv: [
      'products',
      'integrations',
      'webflow',
      'sites',
      '--json',
      WEBFLOW_SITES_JSON_INLINE,
      '--json-file',
      WEBFLOW_SITES_JSON_FILE,
    ],
  },
  {
    name: 'webflow-arbitrary-subcommand',
    argv: ['products', 'integrations', 'webflow', 'bogus', '--json', WEBFLOW_SITES_JSON_INLINE],
  },

  {
    name: 'webflow-collections-json-inline',
    argv: ['products', 'integrations', 'webflow', 'collections', '--json', WEBFLOW_COLLECTIONS_JSON_INLINE],
  },
  {
    name: 'webflow-collections-json-file',
    argv: ['products', 'integrations', 'webflow', 'collections', '--json-file', WEBFLOW_COLLECTIONS_JSON_FILE],
  },
  {
    name: 'webflow-collections-no-json-source',
    argv: ['products', 'integrations', 'webflow', 'collections'],
  },

  {
    name: 'webflow-fields-json-inline',
    argv: ['products', 'integrations', 'webflow', 'fields', '--json', WEBFLOW_FIELDS_JSON_INLINE],
  },
  {
    name: 'webflow-fields-json-file',
    argv: ['products', 'integrations', 'webflow', 'fields', '--json-file', WEBFLOW_FIELDS_JSON_FILE],
  },
  {
    name: 'webflow-fields-two-json-sources',
    argv: [
      'products',
      'integrations',
      'webflow',
      'fields',
      '--json',
      WEBFLOW_FIELDS_JSON_INLINE,
      '--json-file',
      WEBFLOW_FIELDS_JSON_FILE,
    ],
  },

  {
    name: 'webflow-items-json-inline',
    argv: ['products', 'integrations', 'webflow', 'items', '--json', WEBFLOW_ITEMS_JSON_INLINE],
  },
  {
    name: 'webflow-items-json-file',
    argv: ['products', 'integrations', 'webflow', 'items', '--json-file', WEBFLOW_ITEMS_JSON_FILE],
  },
  { name: 'webflow-items-no-json-source', argv: ['products', 'integrations', 'webflow', 'items'] },

  {
    name: 'framer-collections-json-inline',
    argv: ['products', 'integrations', 'framer', 'collections', '--json', FRAMER_COLLECTIONS_JSON_INLINE],
  },
  {
    name: 'framer-collections-json-file',
    argv: ['products', 'integrations', 'framer', 'collections', '--json-file', FRAMER_COLLECTIONS_JSON_FILE],
  },
  {
    name: 'framer-collections-json-stdin',
    argv: ['products', 'integrations', 'framer', 'collections', '--json-stdin'],
    stdin: FRAMER_COLLECTIONS_STDIN,
  },
  { name: 'framer-collections-no-json-source', argv: ['products', 'integrations', 'framer', 'collections'] },
  {
    name: 'framer-collections-two-json-sources',
    argv: [
      'products',
      'integrations',
      'framer',
      'collections',
      '--json',
      FRAMER_COLLECTIONS_JSON_INLINE,
      '--json-file',
      FRAMER_COLLECTIONS_JSON_FILE,
    ],
  },

  {
    name: 'framer-fields-json-inline',
    argv: ['products', 'integrations', 'framer', 'fields', '--json', FRAMER_FIELDS_JSON_INLINE],
  },
  {
    name: 'framer-fields-json-file',
    argv: ['products', 'integrations', 'framer', 'fields', '--json-file', FRAMER_FIELDS_JSON_FILE],
  },
  { name: 'framer-fields-no-json-source', argv: ['products', 'integrations', 'framer', 'fields'] },

  {
    name: 'validate-json-inline',
    argv: ['products', 'integrations', 'validate', VALIDATE_PROVIDER, '--json', VALIDATE_JSON_INLINE],
  },
  {
    name: 'validate-json-file',
    argv: ['products', 'integrations', 'validate', VALIDATE_PROVIDER, '--json-file', VALIDATE_JSON_FILE],
  },
  {
    name: 'validate-json-stdin',
    argv: ['products', 'integrations', 'validate', VALIDATE_PROVIDER, '--json-stdin'],
    stdin: VALIDATE_STDIN,
  },
  { name: 'validate-no-json-source', argv: ['products', 'integrations', 'validate', VALIDATE_PROVIDER] },
  {
    name: 'validate-two-json-sources',
    argv: [
      'products',
      'integrations',
      'validate',
      VALIDATE_PROVIDER,
      '--json',
      VALIDATE_JSON_INLINE,
      '--json-file',
      VALIDATE_JSON_FILE,
    ],
  },
  { name: 'validate-missing-provider', argv: ['products', 'integrations', 'validate'] },

  { name: 'list', argv: ['products', 'integrations', 'list', PRODUCT_ID] },
  { name: 'list-missing-product-id', argv: ['products', 'integrations', 'list'] },

  {
    name: 'create-json-inline',
    argv: ['products', 'integrations', 'create', PRODUCT_ID, '--json', CREATE_JSON_INLINE],
  },
  {
    name: 'create-json-file',
    argv: ['products', 'integrations', 'create', PRODUCT_ID, '--json-file', CREATE_JSON_FILE],
  },
  {
    name: 'create-json-stdin',
    argv: ['products', 'integrations', 'create', PRODUCT_ID, '--json-stdin'],
    stdin: CREATE_STDIN,
  },
  { name: 'create-no-json-source', argv: ['products', 'integrations', 'create', PRODUCT_ID] },
  {
    name: 'create-two-json-sources',
    argv: [
      'products',
      'integrations',
      'create',
      PRODUCT_ID,
      '--json',
      CREATE_JSON_INLINE,
      '--json-file',
      CREATE_JSON_FILE,
    ],
  },

  { name: 'get', argv: ['products', 'integrations', 'get', PRODUCT_ID, INTEGRATION_ID] },
  { name: 'get-missing-integration-id', argv: ['products', 'integrations', 'get', PRODUCT_ID] },

  {
    name: 'update-json-inline',
    argv: ['products', 'integrations', 'update', PRODUCT_ID, INTEGRATION_ID, '--json', UPDATE_JSON_INLINE],
  },
  {
    name: 'update-json-file',
    argv: ['products', 'integrations', 'update', PRODUCT_ID, INTEGRATION_ID, '--json-file', UPDATE_JSON_FILE],
  },
  {
    name: 'update-json-stdin',
    argv: ['products', 'integrations', 'update', PRODUCT_ID, INTEGRATION_ID, '--json-stdin'],
    stdin: UPDATE_STDIN,
  },
  {
    name: 'update-no-json-source',
    argv: ['products', 'integrations', 'update', PRODUCT_ID, INTEGRATION_ID],
  },
  {
    name: 'update-two-json-sources',
    argv: [
      'products',
      'integrations',
      'update',
      PRODUCT_ID,
      INTEGRATION_ID,
      '--json',
      UPDATE_JSON_INLINE,
      '--json-file',
      UPDATE_JSON_FILE,
    ],
  },

  { name: 'test', argv: ['products', 'integrations', 'test', PRODUCT_ID, INTEGRATION_ID] },
  { name: 'test-missing-integration-id', argv: ['products', 'integrations', 'test', PRODUCT_ID] },

  { name: 'delete', argv: ['products', 'integrations', 'delete', PRODUCT_ID, INTEGRATION_ID] },
  {
    name: 'delete-204-non-json',
    argv: ['products', 'integrations', 'delete', PRODUCT_ID, INTEGRATION_ID],
    responses: [NO_CONTENT_RESPONSE],
  },
  { name: 'delete-missing-integration-id', argv: ['products', 'integrations', 'delete', PRODUCT_ID] },
];
