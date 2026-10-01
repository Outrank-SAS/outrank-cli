import {
  PRODUCT_ID,
  SECOND_ID,
  THIRD_ID,
  NOT_FOUND_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
  NO_CONTENT_RESPONSE,
  GATEWAY_TIMEOUT_RESPONSE,
} from './shared.js';

const PAYLOADS_DIR = 'tests/golden/fixtures/payloads';
const SETTINGS_UPDATE_PAYLOAD_PATH = `${PAYLOADS_DIR}/improvements-settings-update.json`;
const CANDIDATES_EDIT_BRIEF_PAYLOAD_PATH = `${PAYLOADS_DIR}/improvements-candidates-edit-brief.json`;
const EXECUTIONS_DECISIONS_PAYLOAD_PATH = `${PAYLOADS_DIR}/improvements-executions-decisions.json`;

export default [
  { name: 'help', argv: ['improvements', '--help'], config: null },
  { name: 'settings-help-not-supported', argv: ['improvements', 'settings', '--help'] },
  { name: 'candidates-help-not-supported', argv: ['improvements', 'candidates', '--help'] },
  { name: 'tasks-help-not-supported', argv: ['improvements', 'tasks', '--help'] },
  { name: 'executions-help-not-supported', argv: ['improvements', 'executions', '--help'] },
  { name: 'analyze-help-runs-anyway', argv: ['improvements', 'analyze', PRODUCT_ID, '--help'] },

  { name: 'settings-get', argv: ['improvements', 'settings', 'get', PRODUCT_ID] },
  { name: 'settings-get-missing-id', argv: ['improvements', 'settings', 'get'] },
  { name: 'settings-get-no-key', argv: ['improvements', 'settings', 'get', PRODUCT_ID], config: null },
  {
    name: 'settings-get-not-found',
    argv: ['improvements', 'settings', 'get', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },
  {
    name: 'settings-get-non-json',
    argv: ['improvements', 'settings', 'get', PRODUCT_ID],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'settings-get-network-error',
    argv: ['improvements', 'settings', 'get', PRODUCT_ID],
    responses: [NETWORK_ERROR_RESPONSE],
  },

  {
    name: 'settings-update-inline',
    argv: [
      'improvements', 'settings', 'update', PRODUCT_ID,
      '--json', '{"enabled":true,"auto_push":false,"publishing_days":["Mon","Thu"]}',
    ],
  },
  {
    name: 'settings-update-json-file',
    argv: ['improvements', 'settings', 'update', PRODUCT_ID, '--json-file', SETTINGS_UPDATE_PAYLOAD_PATH],
  },
  { name: 'settings-update-no-json-source', argv: ['improvements', 'settings', 'update', PRODUCT_ID] },

  { name: 'analyze', argv: ['improvements', 'analyze', PRODUCT_ID] },
  { name: 'analyze-missing-id', argv: ['improvements', 'analyze'] },

  {
    name: 'candidates-list-type-outsider',
    argv: ['improvements', 'candidates', 'list', PRODUCT_ID, '--type', 'outsider'],
  },
  {
    name: 'candidates-list-type-ctr-gap',
    argv: ['improvements', 'candidates', 'list', PRODUCT_ID, '--type', 'ctr_gap', '--limit', '20', '--offset', '5'],
  },
  {
    name: 'candidates-list-type-declining',
    argv: ['improvements', 'candidates', 'list', PRODUCT_ID, '--type', 'declining'],
  },
  {
    name: 'candidates-list-type-content-gap',
    argv: ['improvements', 'candidates', 'list', PRODUCT_ID, '--type', 'content_gap'],
  },
  {
    name: 'candidates-list-type-thin-content',
    argv: ['improvements', 'candidates', 'list', PRODUCT_ID, '--type', 'thin_content'],
  },
  { name: 'candidates-list-no-filters', argv: ['improvements', 'candidates', 'list', PRODUCT_ID] },
  {
    name: 'candidates-list-limit-out-of-range',
    argv: ['improvements', 'candidates', 'list', PRODUCT_ID, '--limit', '51'],
  },
  { name: 'candidates-list-missing-id', argv: ['improvements', 'candidates', 'list'] },

  { name: 'candidates-brief', argv: ['improvements', 'candidates', 'brief', SECOND_ID] },
  {
    name: 'candidates-brief-with-task',
    argv: ['improvements', 'candidates', 'brief', SECOND_ID, '--task', THIRD_ID],
  },
  { name: 'candidates-brief-missing-id', argv: ['improvements', 'candidates', 'brief'] },

  {
    name: 'candidates-edit-brief-inline',
    argv: [
      'improvements', 'candidates', 'edit-brief', SECOND_ID,
      '--json', '{"brief":"Focus on updated statistics."}',
    ],
  },
  {
    name: 'candidates-edit-brief-json-file',
    argv: ['improvements', 'candidates', 'edit-brief', SECOND_ID, '--json-file', CANDIDATES_EDIT_BRIEF_PAYLOAD_PATH],
  },
  {
    name: 'candidates-edit-brief-two-sources',
    argv: [
      'improvements', 'candidates', 'edit-brief', SECOND_ID,
      '--json', '{"brief":"Focus on updated statistics."}',
      '--json-file', CANDIDATES_EDIT_BRIEF_PAYLOAD_PATH,
    ],
  },

  {
    name: 'candidates-schedule',
    argv: ['improvements', 'candidates', 'schedule', SECOND_ID, '--scheduled-for', '2026-06-01'],
  },
  {
    name: 'candidates-schedule-missing-scheduled-for',
    argv: ['improvements', 'candidates', 'schedule', SECOND_ID],
  },

  { name: 'tasks-list', argv: ['improvements', 'tasks', 'list', PRODUCT_ID] },
  { name: 'tasks-list-missing-id', argv: ['improvements', 'tasks', 'list'] },

  {
    name: 'tasks-reschedule',
    argv: ['improvements', 'tasks', 'reschedule', SECOND_ID, '--scheduled-for', '2026-07-01'],
  },
  {
    name: 'tasks-reschedule-missing-scheduled-for',
    argv: ['improvements', 'tasks', 'reschedule', SECOND_ID],
  },

  {
    name: 'tasks-cancel-204-non-json',
    argv: ['improvements', 'tasks', 'cancel', SECOND_ID],
    responses: [NO_CONTENT_RESPONSE],
  },
  { name: 'tasks-cancel', argv: ['improvements', 'tasks', 'cancel', SECOND_ID] },
  { name: 'tasks-cancel-missing-id', argv: ['improvements', 'tasks', 'cancel'] },

  {
    name: 'tasks-edit-brief-inline',
    argv: [
      'improvements', 'tasks', 'edit-brief', SECOND_ID,
      '--json', '{"brief":"Emphasize the new pricing tiers."}',
    ],
  },
  {
    name: 'tasks-edit-brief-json-stdin',
    argv: ['improvements', 'tasks', 'edit-brief', SECOND_ID, '--json-stdin'],
    stdin: '{"brief":"Emphasize the new pricing tiers."}',
  },

  {
    name: 'tasks-execute-improve-images-true',
    argv: ['improvements', 'tasks', 'execute', SECOND_ID, '--improve-images', 'true'],
  },
  {
    name: 'tasks-execute-improve-images-false',
    argv: ['improvements', 'tasks', 'execute', SECOND_ID, '--improve-images', 'false'],
  },
  {
    name: 'tasks-execute-improve-images-invalid',
    argv: ['improvements', 'tasks', 'execute', SECOND_ID, '--improve-images', 'maybe'],
  },
  { name: 'tasks-execute-no-flag', argv: ['improvements', 'tasks', 'execute', SECOND_ID] },

  {
    name: 'executions-list-review-status-awaiting-review',
    argv: ['improvements', 'executions', 'list', PRODUCT_ID, '--review-status', 'awaiting_review'],
  },
  {
    name: 'executions-list-review-status-pushed',
    argv: ['improvements', 'executions', 'list', PRODUCT_ID, '--review-status', 'pushed'],
  },
  {
    name: 'executions-list-review-status-auto-pushed',
    argv: ['improvements', 'executions', 'list', PRODUCT_ID, '--review-status', 'auto_pushed'],
  },
  {
    name: 'executions-list-review-status-rejected',
    argv: ['improvements', 'executions', 'list', PRODUCT_ID, '--review-status', 'rejected'],
  },
  {
    name: 'executions-list-review-status-all',
    argv: [
      'improvements', 'executions', 'list', PRODUCT_ID,
      '--review-status', 'all',
      '--limit', '10',
      '--offset', '5',
    ],
  },
  { name: 'executions-list-no-filters', argv: ['improvements', 'executions', 'list', PRODUCT_ID] },
  { name: 'executions-list-missing-id', argv: ['improvements', 'executions', 'list'] },

  { name: 'executions-get', argv: ['improvements', 'executions', 'get', SECOND_ID] },
  { name: 'executions-get-missing-id', argv: ['improvements', 'executions', 'get'] },

  {
    name: 'executions-decisions-inline',
    argv: [
      'improvements', 'executions', 'decisions', SECOND_ID,
      '--json', '{"decisions":{"para-3":"approved"}}',
    ],
  },
  {
    name: 'executions-decisions-json-file',
    argv: ['improvements', 'executions', 'decisions', SECOND_ID, '--json-file', EXECUTIONS_DECISIONS_PAYLOAD_PATH],
  },
  { name: 'executions-decisions-no-source', argv: ['improvements', 'executions', 'decisions', SECOND_ID] },

  {
    name: 'executions-push-with-json',
    argv: [
      'improvements', 'executions', 'push', SECOND_ID,
      '--json', '{"decisions":{"para-3":"rejected"}}',
    ],
  },
  { name: 'executions-push-no-json', argv: ['improvements', 'executions', 'push', SECOND_ID] },

  { name: 'unknown-subgroup', argv: ['improvements', 'nonsense'] },
  { name: 'analyze-gateway-502', argv: ['improvements', 'analyze', PRODUCT_ID], responses: [NON_JSON_RESPONSE] },
  { name: 'analyze-gateway-504', argv: ['improvements', 'analyze', PRODUCT_ID], responses: [GATEWAY_TIMEOUT_RESPONSE] },
  {
    name: 'candidates-brief-gateway-502',
    argv: ['improvements', 'candidates', 'brief', SECOND_ID],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'tasks-execute-gateway-502',
    argv: ['improvements', 'tasks', 'execute', THIRD_ID],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'executions-push-gateway-502',
    argv: ['improvements', 'executions', 'push', SECOND_ID],
    responses: [NON_JSON_RESPONSE],
  },
];
