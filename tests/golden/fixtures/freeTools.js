import {
  GATEWAY_TIMEOUT_RESPONSE,
  NETWORK_ERROR_RESPONSE,
  NON_JSON_RESPONSE,
  NOT_FOUND_RESPONSE,
  PRODUCT_ID,
  SECOND_ID,
  THIRD_ID,
} from './shared.js';

const PAYLOADS_DIR = 'tests/golden/fixtures/payloads';
const TINY_PNG_PATH = `${PAYLOADS_DIR}/tiny.png`;
const NOT_AN_IMAGE_PATH = `${PAYLOADS_DIR}/not-an-image.txt`;
const TOOL_ID = SECOND_ID;
const KEYWORD_ID = THIRD_ID;
const ATTACHMENT_ID = THIRD_ID;
const KEYWORD = 'mortgage calculator';
const KEYWORD_WITH_COMMA = 'loan calculator, uk';
const PROMPT = 'Add a copy-to-clipboard button for the results';

export default [
  { name: 'help', argv: ['free-tools', '--help'], config: null },
  { name: 'unknown-command', argv: ['free-tools', 'nonsense'] },
  { name: 'keywords-unknown-action', argv: ['free-tools', 'keywords', 'nonsense', PRODUCT_ID] },
  { name: 'keywords-help', argv: ['free-tools', 'keywords', '--help'], config: null },
  { name: 'attachments-help', argv: ['free-tools', 'attachments', '--help'], config: null },

  { name: 'status', argv: ['free-tools', 'status', PRODUCT_ID] },
  { name: 'status-missing-id', argv: ['free-tools', 'status'] },
  { name: 'status-no-key', argv: ['free-tools', 'status', PRODUCT_ID], config: null },
  { name: 'status-not-found', argv: ['free-tools', 'status', PRODUCT_ID], responses: [NOT_FOUND_RESPONSE] },
  { name: 'status-non-json', argv: ['free-tools', 'status', PRODUCT_ID], responses: [NON_JSON_RESPONSE] },
  { name: 'status-network-error', argv: ['free-tools', 'status', PRODUCT_ID], responses: [NETWORK_ERROR_RESPONSE] },

  { name: 'keywords-list', argv: ['free-tools', 'keywords', 'list', PRODUCT_ID] },
  { name: 'keywords-list-view-all', argv: ['free-tools', 'keywords', 'list', PRODUCT_ID, '--view', 'all'] },
  { name: 'keywords-list-view-invalid', argv: ['free-tools', 'keywords', 'list', PRODUCT_ID, '--view', 'past'] },

  { name: 'keywords-add', argv: ['free-tools', 'keywords', 'add', PRODUCT_ID, '--keyword', KEYWORD] },
  {
    name: 'keywords-add-repeated-with-comma',
    argv: ['free-tools', 'keywords', 'add', PRODUCT_ID, '--keyword', KEYWORD, '--keyword', KEYWORD_WITH_COMMA],
  },
  { name: 'keywords-add-missing-keyword', argv: ['free-tools', 'keywords', 'add', PRODUCT_ID] },

  {
    name: 'keywords-generate',
    argv: ['free-tools', 'keywords', 'generate', PRODUCT_ID, '--count', '10', '--source', 'competitors'],
  },
  { name: 'keywords-generate-default-source', argv: ['free-tools', 'keywords', 'generate', PRODUCT_ID, '--count', '5'] },
  { name: 'keywords-generate-missing-count', argv: ['free-tools', 'keywords', 'generate', PRODUCT_ID] },
  {
    name: 'keywords-generate-count-too-high',
    argv: ['free-tools', 'keywords', 'generate', PRODUCT_ID, '--count', '25'],
  },
  {
    name: 'keywords-generate-invalid-source',
    argv: ['free-tools', 'keywords', 'generate', PRODUCT_ID, '--count', '5', '--source', 'gsc'],
  },
  {
    name: 'keywords-generate-gateway-timeout',
    argv: ['free-tools', 'keywords', 'generate', PRODUCT_ID, '--count', '5'],
    responses: [GATEWAY_TIMEOUT_RESPONSE],
  },

  {
    name: 'keywords-delete',
    argv: ['free-tools', 'keywords', 'delete', PRODUCT_ID, '--keyword-ids', `${SECOND_ID},${THIRD_ID}`],
  },
  { name: 'keywords-delete-missing-ids', argv: ['free-tools', 'keywords', 'delete', PRODUCT_ID] },
  {
    name: 'keywords-delete-invalid-id',
    argv: ['free-tools', 'keywords', 'delete', PRODUCT_ID, '--keyword-ids', 'not-a-uuid'],
  },

  { name: 'create', argv: ['free-tools', 'create', PRODUCT_ID, KEYWORD_ID] },
  { name: 'create-missing-keyword-id', argv: ['free-tools', 'create', PRODUCT_ID] },
  { name: 'create-gateway-502', argv: ['free-tools', 'create', PRODUCT_ID, KEYWORD_ID], responses: [NON_JSON_RESPONSE] },

  { name: 'list', argv: ['free-tools', 'list', PRODUCT_ID] },
  { name: 'list-paged', argv: ['free-tools', 'list', PRODUCT_ID, '--limit', '20', '--offset', '20'] },
  { name: 'list-limit-too-high', argv: ['free-tools', 'list', PRODUCT_ID, '--limit', '101'] },

  { name: 'get', argv: ['free-tools', 'get', PRODUCT_ID, TOOL_ID] },
  { name: 'get-missing-tool-id', argv: ['free-tools', 'get', PRODUCT_ID] },
  { name: 'get-invalid-tool-id', argv: ['free-tools', 'get', PRODUCT_ID, 'not-a-uuid'] },
  { name: 'get-not-found', argv: ['free-tools', 'get', PRODUCT_ID, TOOL_ID], responses: [NOT_FOUND_RESPONSE] },

  { name: 'history', argv: ['free-tools', 'history', PRODUCT_ID, TOOL_ID] },

  { name: 'edit', argv: ['free-tools', 'edit', PRODUCT_ID, TOOL_ID, '--prompt', PROMPT] },
  {
    name: 'edit-with-attachments',
    argv: [
      'free-tools',
      'edit',
      PRODUCT_ID,
      TOOL_ID,
      '--prompt',
      PROMPT,
      '--attachment-ids',
      `${THIRD_ID},${SECOND_ID}`,
    ],
  },
  { name: 'edit-missing-prompt', argv: ['free-tools', 'edit', PRODUCT_ID, TOOL_ID] },
  {
    name: 'edit-invalid-attachment-id',
    argv: ['free-tools', 'edit', PRODUCT_ID, TOOL_ID, '--prompt', PROMPT, '--attachment-ids', 'not-a-uuid'],
  },
  {
    name: 'edit-gateway-timeout',
    argv: ['free-tools', 'edit', PRODUCT_ID, TOOL_ID, '--prompt', PROMPT],
    responses: [GATEWAY_TIMEOUT_RESPONSE],
  },

  { name: 'preview', argv: ['free-tools', 'preview', PRODUCT_ID, TOOL_ID] },
  { name: 'preview-wake', argv: ['free-tools', 'preview', PRODUCT_ID, TOOL_ID, '--wake'] },

  { name: 'publish', argv: ['free-tools', 'publish', PRODUCT_ID, TOOL_ID] },
  { name: 'publish-missing-tool-id', argv: ['free-tools', 'publish', PRODUCT_ID] },
  { name: 'discard', argv: ['free-tools', 'discard', PRODUCT_ID, TOOL_ID] },
  { name: 'rollback', argv: ['free-tools', 'rollback', PRODUCT_ID, TOOL_ID] },

  { name: 'attachments-add', argv: ['free-tools', 'attachments', 'add', PRODUCT_ID, TOOL_ID, '--file', TINY_PNG_PATH] },
  { name: 'attachments-add-missing-file', argv: ['free-tools', 'attachments', 'add', PRODUCT_ID, TOOL_ID] },
  {
    name: 'attachments-add-not-an-image',
    argv: ['free-tools', 'attachments', 'add', PRODUCT_ID, TOOL_ID, '--file', NOT_AN_IMAGE_PATH],
  },
  { name: 'attachments-remove', argv: ['free-tools', 'attachments', 'remove', PRODUCT_ID, TOOL_ID, ATTACHMENT_ID] },
  {
    name: 'attachments-remove-missing-attachment-id',
    argv: ['free-tools', 'attachments', 'remove', PRODUCT_ID, TOOL_ID],
  },
];
