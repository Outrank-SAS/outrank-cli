import {
  PRODUCT_ID,
  SECOND_ID,
  NOT_FOUND_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
  NO_CONTENT_RESPONSE,
} from './shared.js';

const TARGET_ID = SECOND_ID;
const PAYLOADS_DIR = 'tests/golden/fixtures/payloads';
const SOURCES_UPDATE_JSON_FILE = `${PAYLOADS_DIR}/linking-sources-update.json`;
const TARGET_CONFIG_UPDATE_JSON_FILE = `${PAYLOADS_DIR}/linking-target-config-update.json`;
const TARGETS_ADD_MANUAL_JSON_FILE = `${PAYLOADS_DIR}/linking-targets-add-manual.json`;
const TARGETS_UPSERT_JSON_FILE = `${PAYLOADS_DIR}/linking-targets-upsert.json`;

const SOURCES_UPDATE_JSON_INLINE = '{"primary_source":"sitemap","additional_sources":["manual"]}';
const TARGET_CONFIG_UPDATE_JSON_INLINE = '{"only_prioritized":true}';
const TARGETS_ADD_MANUAL_JSON_INLINE = '{"url":"https://acme.example.com/pricing","anchor_text":"pricing"}';
const TARGETS_UPSERT_JSON_INLINE = '{"url":"https://acme.example.com/features","priority":1}';

const SOURCES_UPDATE_STDIN = '{"primary_source":"manual"}';
const TARGET_CONFIG_UPDATE_STDIN = '{"only_prioritized":false}';
const TARGETS_ADD_MANUAL_STDIN = '{"url":"https://acme.example.com/stdin-page"}';
const TARGETS_UPSERT_STDIN = '{"url":"https://acme.example.com/stdin-upsert","priority":2}';

export default [
  { name: 'help', argv: ['products', 'linking', '--help'], config: null },
  { name: 'sources-help', argv: ['products', 'linking', 'sources', '--help'], config: null },
  { name: 'target-config-help', argv: ['products', 'linking', 'target-config', '--help'], config: null },
  { name: 'targets-help', argv: ['products', 'linking', 'targets', '--help'], config: null },
  { name: 'unknown-subcommand', argv: ['products', 'linking', 'nonsense', PRODUCT_ID] },
  { name: 'api-error', argv: ['products', 'linking', 'detect', PRODUCT_ID], responses: [NOT_FOUND_RESPONSE] },
  {
    name: 'non-json-response',
    argv: ['products', 'linking', 'detect', PRODUCT_ID],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'network-error',
    argv: ['products', 'linking', 'detect', PRODUCT_ID],
    responses: [NETWORK_ERROR_RESPONSE],
  },
  { name: 'no-key', argv: ['products', 'linking', 'detect', PRODUCT_ID], config: null },
  {
    name: 'detect-help-swallowed',
    argv: ['products', 'linking', 'detect', PRODUCT_ID, '--help'],
  },

  { name: 'sources-get', argv: ['products', 'linking', 'sources', 'get', PRODUCT_ID] },
  { name: 'sources-get-missing-id', argv: ['products', 'linking', 'sources', 'get'] },
  {
    name: 'sources-update-json-inline',
    argv: ['products', 'linking', 'sources', 'update', PRODUCT_ID, '--json', SOURCES_UPDATE_JSON_INLINE],
  },
  {
    name: 'sources-update-json-file',
    argv: ['products', 'linking', 'sources', 'update', PRODUCT_ID, '--json-file', SOURCES_UPDATE_JSON_FILE],
  },
  {
    name: 'sources-update-json-stdin',
    argv: ['products', 'linking', 'sources', 'update', PRODUCT_ID, '--json-stdin'],
    stdin: SOURCES_UPDATE_STDIN,
  },
  { name: 'sources-update-no-json-source', argv: ['products', 'linking', 'sources', 'update', PRODUCT_ID] },
  {
    name: 'sources-update-two-json-sources',
    argv: [
      'products',
      'linking',
      'sources',
      'update',
      PRODUCT_ID,
      '--json',
      SOURCES_UPDATE_JSON_INLINE,
      '--json-file',
      SOURCES_UPDATE_JSON_FILE,
    ],
  },
  {
    name: 'sources-set-alias',
    argv: ['products', 'linking', 'sources', 'set', PRODUCT_ID, '--json', SOURCES_UPDATE_JSON_INLINE],
  },
  { name: 'sources-unknown-subcommand', argv: ['products', 'linking', 'sources', 'nonsense', PRODUCT_ID] },

  { name: 'detect', argv: ['products', 'linking', 'detect', PRODUCT_ID] },
  { name: 'detect-missing-id', argv: ['products', 'linking', 'detect'] },

  { name: 'target-config-get', argv: ['products', 'linking', 'target-config', 'get', PRODUCT_ID] },
  { name: 'target-config-get-missing-id', argv: ['products', 'linking', 'target-config', 'get'] },
  {
    name: 'target-config-update-json-inline',
    argv: ['products', 'linking', 'target-config', 'update', PRODUCT_ID, '--json', TARGET_CONFIG_UPDATE_JSON_INLINE],
  },
  {
    name: 'target-config-update-json-file',
    argv: [
      'products',
      'linking',
      'target-config',
      'update',
      PRODUCT_ID,
      '--json-file',
      TARGET_CONFIG_UPDATE_JSON_FILE,
    ],
  },
  {
    name: 'target-config-update-json-stdin',
    argv: ['products', 'linking', 'target-config', 'update', PRODUCT_ID, '--json-stdin'],
    stdin: TARGET_CONFIG_UPDATE_STDIN,
  },
  {
    name: 'target-config-update-no-json-source',
    argv: ['products', 'linking', 'target-config', 'update', PRODUCT_ID],
  },
  {
    name: 'target-config-update-two-json-sources',
    argv: [
      'products',
      'linking',
      'target-config',
      'update',
      PRODUCT_ID,
      '--json',
      TARGET_CONFIG_UPDATE_JSON_INLINE,
      '--json-file',
      TARGET_CONFIG_UPDATE_JSON_FILE,
    ],
  },
  { name: 'target-config-unknown-subcommand', argv: ['products', 'linking', 'target-config', 'nonsense', PRODUCT_ID] },

  { name: 'targets-list', argv: ['products', 'linking', 'targets', 'list', PRODUCT_ID] },
  { name: 'targets-list-missing-id', argv: ['products', 'linking', 'targets', 'list'] },
  {
    name: 'targets-add-manual-json-inline',
    argv: ['products', 'linking', 'targets', 'add-manual', PRODUCT_ID, '--json', TARGETS_ADD_MANUAL_JSON_INLINE],
  },
  {
    name: 'targets-add-manual-json-file',
    argv: ['products', 'linking', 'targets', 'add-manual', PRODUCT_ID, '--json-file', TARGETS_ADD_MANUAL_JSON_FILE],
  },
  {
    name: 'targets-add-manual-json-stdin',
    argv: ['products', 'linking', 'targets', 'add-manual', PRODUCT_ID, '--json-stdin'],
    stdin: TARGETS_ADD_MANUAL_STDIN,
  },
  {
    name: 'targets-add-manual-no-json-source',
    argv: ['products', 'linking', 'targets', 'add-manual', PRODUCT_ID],
  },
  {
    name: 'targets-add-manual-two-json-sources',
    argv: [
      'products',
      'linking',
      'targets',
      'add-manual',
      PRODUCT_ID,
      '--json',
      TARGETS_ADD_MANUAL_JSON_INLINE,
      '--json-file',
      TARGETS_ADD_MANUAL_JSON_FILE,
    ],
  },
  {
    name: 'targets-upsert-json-inline',
    argv: ['products', 'linking', 'targets', 'upsert', PRODUCT_ID, '--json', TARGETS_UPSERT_JSON_INLINE],
  },
  {
    name: 'targets-upsert-json-file',
    argv: ['products', 'linking', 'targets', 'upsert', PRODUCT_ID, '--json-file', TARGETS_UPSERT_JSON_FILE],
  },
  {
    name: 'targets-upsert-json-stdin',
    argv: ['products', 'linking', 'targets', 'upsert', PRODUCT_ID, '--json-stdin'],
    stdin: TARGETS_UPSERT_STDIN,
  },
  { name: 'targets-upsert-no-json-source', argv: ['products', 'linking', 'targets', 'upsert', PRODUCT_ID] },
  {
    name: 'targets-upsert-two-json-sources',
    argv: [
      'products',
      'linking',
      'targets',
      'upsert',
      PRODUCT_ID,
      '--json',
      TARGETS_UPSERT_JSON_INLINE,
      '--json-file',
      TARGETS_UPSERT_JSON_FILE,
    ],
  },
  {
    name: 'targets-clear-customizations',
    argv: ['products', 'linking', 'targets', 'clear-customizations', PRODUCT_ID, TARGET_ID],
  },
  {
    name: 'targets-clear-customizations-missing-target-id',
    argv: ['products', 'linking', 'targets', 'clear-customizations', PRODUCT_ID],
  },
  { name: 'targets-delete', argv: ['products', 'linking', 'targets', 'delete', PRODUCT_ID, TARGET_ID] },
  {
    name: 'targets-delete-204-non-json',
    argv: ['products', 'linking', 'targets', 'delete', PRODUCT_ID, TARGET_ID],
    responses: [NO_CONTENT_RESPONSE],
  },
  {
    name: 'targets-delete-missing-target-id',
    argv: ['products', 'linking', 'targets', 'delete', PRODUCT_ID],
  },
  { name: 'targets-unknown-subcommand', argv: ['products', 'linking', 'targets', 'nonsense', PRODUCT_ID] },
];
