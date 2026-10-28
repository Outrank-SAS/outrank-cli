import { PRODUCT_ID, SECOND_ID, NOT_FOUND_RESPONSE, NON_JSON_RESPONSE, NETWORK_ERROR_RESPONSE } from './shared.js';

const PAYLOADS_DIR = 'tests/golden/fixtures/payloads';
const SETTINGS_UPDATE_PAYLOAD_PATH = `${PAYLOADS_DIR}/ai-cited-lists-settings-update.json`;
const QUESTION = 'What is the best CRM for startups?';
const ATTEMPT_ID = 'attempt-123';

export default [
  { name: 'help', argv: ['ai-cited-lists', '--help'], config: null },
  { name: 'unknown-subgroup', argv: ['ai-cited-lists', 'nonsense'] },
  { name: 'mailbox-unknown-action', argv: ['ai-cited-lists', 'mailbox', 'nonsense', PRODUCT_ID] },

  { name: 'status', argv: ['ai-cited-lists', 'status', PRODUCT_ID] },
  { name: 'status-missing-id', argv: ['ai-cited-lists', 'status'] },
  { name: 'status-no-key', argv: ['ai-cited-lists', 'status', PRODUCT_ID], config: null },
  { name: 'status-not-found', argv: ['ai-cited-lists', 'status', PRODUCT_ID], responses: [NOT_FOUND_RESPONSE] },
  { name: 'status-non-json', argv: ['ai-cited-lists', 'status', PRODUCT_ID], responses: [NON_JSON_RESPONSE] },
  { name: 'status-network-error', argv: ['ai-cited-lists', 'status', PRODUCT_ID], responses: [NETWORK_ERROR_RESPONSE] },

  { name: 'overview', argv: ['ai-cited-lists', 'overview', PRODUCT_ID] },

  { name: 'lists-list', argv: ['ai-cited-lists', 'lists', 'list', PRODUCT_ID] },
  { name: 'lists-list-view-to-send', argv: ['ai-cited-lists', 'lists', 'list', PRODUCT_ID, '--view', 'to_send'] },
  { name: 'lists-list-view-invalid', argv: ['ai-cited-lists', 'lists', 'list', PRODUCT_ID, '--view', 'later'] },
  { name: 'lists-skip', argv: ['ai-cited-lists', 'lists', 'skip', PRODUCT_ID, SECOND_ID] },
  { name: 'lists-skip-missing-list-id', argv: ['ai-cited-lists', 'lists', 'skip', PRODUCT_ID] },
  { name: 'lists-unskip', argv: ['ai-cited-lists', 'lists', 'unskip', PRODUCT_ID, SECOND_ID] },

  { name: 'outreach', argv: ['ai-cited-lists', 'outreach', PRODUCT_ID] },

  { name: 'offers-get', argv: ['ai-cited-lists', 'offers', 'get', PRODUCT_ID, SECOND_ID] },
  { name: 'offers-get-missing-offer-id', argv: ['ai-cited-lists', 'offers', 'get', PRODUCT_ID] },
  { name: 'offers-withdraw', argv: ['ai-cited-lists', 'offers', 'withdraw', PRODUCT_ID, SECOND_ID] },

  { name: 'wins-get', argv: ['ai-cited-lists', 'wins', 'get', PRODUCT_ID, SECOND_ID] },

  { name: 'questions-list', argv: ['ai-cited-lists', 'questions', 'list', PRODUCT_ID] },
  { name: 'questions-add', argv: ['ai-cited-lists', 'questions', 'add', PRODUCT_ID, '--question', QUESTION] },
  { name: 'questions-add-missing-question', argv: ['ai-cited-lists', 'questions', 'add', PRODUCT_ID] },
  {
    name: 'questions-edit',
    argv: ['ai-cited-lists', 'questions', 'edit', PRODUCT_ID, SECOND_ID, '--question', QUESTION],
  },
  { name: 'questions-remove', argv: ['ai-cited-lists', 'questions', 'remove', PRODUCT_ID, SECOND_ID] },

  { name: 'settings-get', argv: ['ai-cited-lists', 'settings', 'get', PRODUCT_ID] },
  {
    name: 'settings-update-inline',
    argv: [
      'ai-cited-lists',
      'settings',
      'update',
      PRODUCT_ID,
      '--json',
      '{"sender_name":"Ada Lovelace","sender_title":"Founder","allow_second_position":false}',
    ],
  },
  {
    name: 'settings-update-json-file',
    argv: ['ai-cited-lists', 'settings', 'update', PRODUCT_ID, '--json-file', SETTINGS_UPDATE_PAYLOAD_PATH],
  },
  { name: 'settings-update-no-json-source', argv: ['ai-cited-lists', 'settings', 'update', PRODUCT_ID] },
  {
    name: 'settings-update-invalid-entry-mode',
    argv: ['ai-cited-lists', 'settings', 'update', PRODUCT_ID, '--json', '{"entry_mode":"manual"}'],
  },
  {
    name: 'settings-update-blurb-null',
    argv: ['ai-cited-lists', 'settings', 'update', PRODUCT_ID, '--json', '{"listing_blurb":null}'],
  },

  { name: 'mailbox-get', argv: ['ai-cited-lists', 'mailbox', 'get', PRODUCT_ID] },
  {
    name: 'mailbox-connect',
    argv: ['ai-cited-lists', 'mailbox', 'connect', PRODUCT_ID, '--json-stdin'],
    stdin: '{"email":"ada@acme.example","app_password":"abcd efgh ijkl mnop"}',
  },
  { name: 'mailbox-connect-no-json-source', argv: ['ai-cited-lists', 'mailbox', 'connect', PRODUCT_ID] },
  {
    name: 'mailbox-connect-missing-app-password',
    argv: ['ai-cited-lists', 'mailbox', 'connect', PRODUCT_ID, '--json', '{"email":"ada@acme.example"}'],
  },
  { name: 'mailbox-poll-removed', argv: ['ai-cited-lists', 'mailbox', 'poll', PRODUCT_ID, '--attempt-id', ATTEMPT_ID] },
  { name: 'mailbox-domain-check', argv: ['ai-cited-lists', 'mailbox', 'domain-check', PRODUCT_ID] },
  { name: 'mailbox-inbox-test', argv: ['ai-cited-lists', 'mailbox', 'inbox-test', PRODUCT_ID] },
  { name: 'mailbox-filter-test', argv: ['ai-cited-lists', 'mailbox', 'filter-test', PRODUCT_ID] },
  {
    name: 'mailbox-dkim-selector',
    argv: ['ai-cited-lists', 'mailbox', 'dkim-selector', PRODUCT_ID, '--selector', 'google2026'],
  },
  { name: 'mailbox-dkim-selector-reset', argv: ['ai-cited-lists', 'mailbox', 'dkim-selector', PRODUCT_ID, '--reset'] },
  { name: 'mailbox-dkim-selector-missing-choice', argv: ['ai-cited-lists', 'mailbox', 'dkim-selector', PRODUCT_ID] },
  {
    name: 'mailbox-dkim-selector-both',
    argv: ['ai-cited-lists', 'mailbox', 'dkim-selector', PRODUCT_ID, '--selector', 'google2026', '--reset'],
  },
  { name: 'mailbox-disconnect', argv: ['ai-cited-lists', 'mailbox', 'disconnect', PRODUCT_ID] },

  { name: 'top-up-consent-get', argv: ['ai-cited-lists', 'top-up-consent', 'get', PRODUCT_ID] },
  { name: 'top-up-consent-confirm', argv: ['ai-cited-lists', 'top-up-consent', 'confirm', PRODUCT_ID] },

  { name: 'entry-generate', argv: ['ai-cited-lists', 'entry', 'generate', PRODUCT_ID] },
  {
    name: 'entry-generate-gateway-502',
    argv: ['ai-cited-lists', 'entry', 'generate', PRODUCT_ID],
    responses: [NON_JSON_RESPONSE],
  },

  { name: 'setup-finish', argv: ['ai-cited-lists', 'setup', 'finish', PRODUCT_ID] },

  { name: 'citations-summary', argv: ['ai-cited-lists', 'citations', 'summary', PRODUCT_ID] },
  {
    name: 'citations-summary-weeks-12',
    argv: ['ai-cited-lists', 'citations', 'summary', PRODUCT_ID, '--weeks', '12'],
  },
  {
    name: 'citations-summary-weeks-invalid',
    argv: ['ai-cited-lists', 'citations', 'summary', PRODUCT_ID, '--weeks', '8'],
  },
  { name: 'citations-check', argv: ['ai-cited-lists', 'citations', 'check', PRODUCT_ID] },
];
