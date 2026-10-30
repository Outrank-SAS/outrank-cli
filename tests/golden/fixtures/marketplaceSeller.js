import {
  PRODUCT_ID,
  SECOND_ID,
  NOT_FOUND_RESPONSE,
  NO_CONTENT_RESPONSE,
  NON_JSON_RESPONSE,
  NETWORK_ERROR_RESPONSE,
} from './shared.js';

const ADMIN_ROLE_REQUIRED_RESPONSE = {
  status: 403,
  body: {
    ok: false,
    error: { code: 'ADMIN_ROLE_REQUIRED', message: 'This action requires an organization admin API key.' },
    agent_guidance: 'Ask an organization admin to run this, or create a new API key while holding the admin role.',
  },
};

const STATUS_ALREADY_ENROLLED_RESPONSE = {
  status: 200,
  body: {
    ok: true,
    data: { enrollment: { completed: true }, onboarding: {} },
    agent_guidance: 'Seller onboarding is complete.',
  },
};

const STATUS_NOT_ENROLLED_MINIMAL_RESPONSE = {
  status: 200,
  body: {
    ok: true,
    data: {
      enrollment: { completed: false },
      onboarding: {
        cms: { connected: false, existing: false },
        gsc: { connected: false },
        stripe: { accountConnected: false, payoutsEnabled: false },
      },
    },
    agent_guidance: 'Nothing connected yet.',
  },
};

const STATUS_REUSABLE_CMS_RESPONSE = {
  status: 200,
  body: {
    ok: true,
    data: {
      enrollment: { completed: false },
      onboarding: {
        cms: { connected: false, existing: true },
        gsc: { connected: false },
        stripe: { accountConnected: false, payoutsEnabled: false },
      },
    },
    agent_guidance: 'A reusable CMS integration was found.',
  },
};

const STATUS_GSC_CMS_READY_RESPONSE = {
  status: 200,
  body: {
    ok: true,
    data: {
      enrollment: { completed: false },
      onboarding: {
        cms: { connected: true, existing: false },
        gsc: { connected: true },
        stripe: { accountConnected: false, payoutsEnabled: false },
      },
    },
    agent_guidance: 'Blog and integration steps are done.',
  },
};

const ADOPT_SUCCESS_RESPONSE = {
  status: 200,
  body: {
    ok: true,
    data: { integrationId: SECOND_ID, integrationType: 'wordpress' },
    agent_guidance: 'Adopted the existing integration.',
  },
};

const ADOPT_FAILURE_RESPONSE = {
  status: 200,
  body: {
    ok: false,
    error: { code: 'ADOPT_FAILED', message: 'the existing integration is not reusable' },
    agent_guidance: 'stub',
  },
};

const STRIPE_ONBOARD_SUCCESS_RESPONSE = {
  status: 200,
  body: {
    ok: true,
    data: { onboardingUrl: 'https://connect.stripe.com/setup/e2e' },
    agent_guidance: 'Open the onboarding URL.',
  },
};

const STRIPE_ONBOARD_FAILURE_RESPONSE = {
  status: 400,
  body: { ok: false, error: { code: 'STRIPE_ERROR', message: 'country is not supported' }, agent_guidance: 'stub' },
};

const ELIGIBILITY_RESULT_RESPONSE = {
  status: 200,
  body: { ok: true, data: { eligible: false, reasons: ['payouts_incomplete'] }, agent_guidance: 'Not eligible yet.' },
};

const ACTIVATION_VALIDATION_ERROR_RESPONSE = {
  status: 400,
  body: {
    ok: false,
    error: { code: 'VALIDATION_ERROR', message: 'activationStatus must be one of: active, disabled.' },
    agent_guidance: 'stub',
  },
};

const SELLER_SETTINGS_PAYLOAD_FILE = 'tests/golden/fixtures/payloads/sellerSettingsUpdate.json';
const SELLER_SETTINGS_JSON_INLINE = '{"dailyArticleLimit":2,"publishingDays":[1,3,5]}';
const SELLER_SETTINGS_JSON_STDIN = '{"dailyArticleLimit":1,"publishingDays":[2,4]}';

export default [
  { name: 'help-marketplace', argv: ['marketplace', '--help'], config: null },
  { name: 'help-seller-group', argv: ['marketplace', 'seller', '--help'], config: null },
  { name: 'help-seller-integrations-group', argv: ['marketplace', 'seller', 'integrations', '--help'], config: null },
  { name: 'help-seller-stripe-group', argv: ['marketplace', 'seller', 'stripe', '--help'], config: null },
  { name: 'help-seller-placements-group', argv: ['marketplace', 'seller', 'placements', '--help'], config: null },
  { name: 'help-seller-eligibility-group', argv: ['marketplace', 'seller', 'eligibility', '--help'], config: null },

  { name: 'status-basic', argv: ['marketplace', 'seller', 'status', PRODUCT_ID] },
  { name: 'status-refresh-stripe', argv: ['marketplace', 'seller', 'status', PRODUCT_ID, '--refresh-stripe'] },
  { name: 'status-not-found', argv: ['marketplace', 'seller', 'status', PRODUCT_ID], responses: [NOT_FOUND_RESPONSE] },
  { name: 'status-missing-product-id', argv: ['marketplace', 'seller', 'status'] },
  { name: 'status-no-api-key', argv: ['marketplace', 'seller', 'status', PRODUCT_ID], config: null },

  {
    name: 'onboard-already-enrolled',
    argv: ['marketplace', 'seller', 'onboard', PRODUCT_ID],
    responses: [STATUS_ALREADY_ENROLLED_RESPONSE],
  },
  {
    name: 'onboard-not-enrolled-no-op',
    argv: ['marketplace', 'seller', 'onboard', PRODUCT_ID],
    responses: [STATUS_NOT_ENROLLED_MINIMAL_RESPONSE, ELIGIBILITY_RESULT_RESPONSE],
  },
  {
    name: 'onboard-adopt-success',
    argv: ['marketplace', 'seller', 'onboard', PRODUCT_ID],
    responses: [STATUS_REUSABLE_CMS_RESPONSE, ADOPT_SUCCESS_RESPONSE, ELIGIBILITY_RESULT_RESPONSE],
  },
  {
    name: 'onboard-adopt-fails',
    argv: ['marketplace', 'seller', 'onboard', PRODUCT_ID],
    responses: [STATUS_REUSABLE_CMS_RESPONSE, ADOPT_FAILURE_RESPONSE, ELIGIBILITY_RESULT_RESPONSE],
  },
  {
    name: 'onboard-stripe-success',
    argv: ['marketplace', 'seller', 'onboard', PRODUCT_ID, '--country', 'US'],
    responses: [STATUS_GSC_CMS_READY_RESPONSE, STRIPE_ONBOARD_SUCCESS_RESPONSE, ELIGIBILITY_RESULT_RESPONSE],
  },
  {
    name: 'onboard-stripe-fails',
    argv: ['marketplace', 'seller', 'onboard', PRODUCT_ID, '--country', 'US'],
    responses: [STATUS_GSC_CMS_READY_RESPONSE, STRIPE_ONBOARD_FAILURE_RESPONSE, ELIGIBILITY_RESULT_RESPONSE],
  },
  {
    name: 'onboard-no-country-skips-stripe',
    argv: ['marketplace', 'seller', 'onboard', PRODUCT_ID],
    responses: [STATUS_GSC_CMS_READY_RESPONSE, ELIGIBILITY_RESULT_RESPONSE],
  },
  {
    name: 'onboard-network-error-on-adopt',
    argv: ['marketplace', 'seller', 'onboard', PRODUCT_ID],
    responses: [STATUS_REUSABLE_CMS_RESPONSE, NETWORK_ERROR_RESPONSE],
  },
  { name: 'onboard-missing-product-id', argv: ['marketplace', 'seller', 'onboard'] },

  { name: 'eligibility-basic', argv: ['marketplace', 'seller', 'eligibility', PRODUCT_ID] },
  { name: 'eligibility-refresh', argv: ['marketplace', 'seller', 'eligibility', PRODUCT_ID, '--refresh'] },
  { name: 'eligibility-missing-product-id', argv: ['marketplace', 'seller', 'eligibility'] },

  { name: 'eligibility-recheck-basic', argv: ['marketplace', 'seller', 'eligibility', 'recheck', PRODUCT_ID] },
  { name: 'eligibility-recheck-missing-product-id', argv: ['marketplace', 'seller', 'eligibility', 'recheck'] },

  { name: 'settings-get-basic', argv: ['marketplace', 'seller', 'settings', 'get', PRODUCT_ID] },
  {
    name: 'settings-get-not-found',
    argv: ['marketplace', 'seller', 'settings', 'get', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },

  {
    name: 'settings-update-json-inline',
    argv: ['marketplace', 'seller', 'settings', 'update', PRODUCT_ID, '--json', SELLER_SETTINGS_JSON_INLINE],
  },
  {
    name: 'settings-update-json-file',
    argv: ['marketplace', 'seller', 'settings', 'update', PRODUCT_ID, '--json-file', SELLER_SETTINGS_PAYLOAD_FILE],
  },
  {
    name: 'settings-update-json-stdin',
    argv: ['marketplace', 'seller', 'settings', 'update', PRODUCT_ID, '--json-stdin'],
    stdin: SELLER_SETTINGS_JSON_STDIN,
  },
  { name: 'settings-update-no-source', argv: ['marketplace', 'seller', 'settings', 'update', PRODUCT_ID] },
  {
    name: 'settings-update-two-sources',
    argv: [
      'marketplace',
      'seller',
      'settings',
      'update',
      PRODUCT_ID,
      '--json',
      SELLER_SETTINGS_JSON_INLINE,
      '--json-file',
      SELLER_SETTINGS_PAYLOAD_FILE,
    ],
  },
  {
    name: 'settings-update-admin-role-required',
    argv: ['marketplace', 'seller', 'settings', 'update', PRODUCT_ID, '--json', SELLER_SETTINGS_JSON_INLINE],
    responses: [ADMIN_ROLE_REQUIRED_RESPONSE],
  },

  { name: 'integrations-status-basic', argv: ['marketplace', 'seller', 'integrations', 'status', PRODUCT_ID] },
  {
    name: 'integrations-status-not-found',
    argv: ['marketplace', 'seller', 'integrations', 'status', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },

  { name: 'integrations-adopt-basic', argv: ['marketplace', 'seller', 'integrations', 'adopt', PRODUCT_ID] },
  {
    name: 'integrations-adopt-not-found',
    argv: ['marketplace', 'seller', 'integrations', 'adopt', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },

  {
    name: 'integrations-claim-basic',
    argv: [
      'marketplace',
      'seller',
      'integrations',
      'claim',
      PRODUCT_ID,
      '--integration',
      SECOND_ID,
      '--type',
      'wordpress',
    ],
  },
  {
    name: 'integrations-claim-missing-integration',
    argv: ['marketplace', 'seller', 'integrations', 'claim', PRODUCT_ID, '--type', 'wordpress'],
  },
  {
    name: 'integrations-claim-missing-type',
    argv: ['marketplace', 'seller', 'integrations', 'claim', PRODUCT_ID, '--integration', SECOND_ID],
  },

  {
    name: 'integrations-set-activation-active',
    argv: [
      'marketplace',
      'seller',
      'integrations',
      'set-activation',
      PRODUCT_ID,
      '--integration',
      SECOND_ID,
      '--type',
      'wordpress',
      '--status',
      'active',
    ],
  },
  {
    name: 'integrations-set-activation-disabled',
    argv: [
      'marketplace',
      'seller',
      'integrations',
      'set-activation',
      PRODUCT_ID,
      '--integration',
      SECOND_ID,
      '--type',
      'wordpress',
      '--status',
      'disabled',
    ],
  },
  {
    name: 'integrations-set-activation-invalid-status',
    argv: [
      'marketplace',
      'seller',
      'integrations',
      'set-activation',
      PRODUCT_ID,
      '--integration',
      SECOND_ID,
      '--type',
      'wordpress',
      '--status',
      'invalid',
    ],
    responses: [ACTIVATION_VALIDATION_ERROR_RESPONSE],
  },
  {
    name: 'integrations-set-activation-missing-integration',
    argv: [
      'marketplace',
      'seller',
      'integrations',
      'set-activation',
      PRODUCT_ID,
      '--type',
      'wordpress',
      '--status',
      'active',
    ],
  },

  {
    name: 'integrations-delete-success',
    argv: [
      'marketplace',
      'seller',
      'integrations',
      'delete',
      PRODUCT_ID,
      '--integration',
      SECOND_ID,
      '--type',
      'wordpress',
    ],
  },
  {
    name: 'integrations-delete-204-non-json',
    argv: [
      'marketplace',
      'seller',
      'integrations',
      'delete',
      PRODUCT_ID,
      '--integration',
      SECOND_ID,
      '--type',
      'wordpress',
    ],
    responses: [NO_CONTENT_RESPONSE],
  },
  {
    name: 'integrations-delete-missing-type',
    argv: ['marketplace', 'seller', 'integrations', 'delete', PRODUCT_ID, '--integration', SECOND_ID],
  },

  {
    name: 'stripe-onboard-with-country',
    argv: ['marketplace', 'seller', 'stripe', 'onboard', PRODUCT_ID, '--country', 'FR'],
  },
  { name: 'stripe-onboard-no-country', argv: ['marketplace', 'seller', 'stripe', 'onboard', PRODUCT_ID] },
  {
    name: 'stripe-onboard-missing-product-id',
    argv: ['marketplace', 'seller', 'stripe', 'onboard', '--country', 'FR'],
  },

  { name: 'stripe-manage-basic', argv: ['marketplace', 'seller', 'stripe', 'manage', PRODUCT_ID] },
  {
    name: 'stripe-manage-not-found',
    argv: ['marketplace', 'seller', 'stripe', 'manage', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },

  { name: 'stripe-reset-basic', argv: ['marketplace', 'seller', 'stripe', 'reset', PRODUCT_ID] },
  {
    name: 'stripe-reset-not-found',
    argv: ['marketplace', 'seller', 'stripe', 'reset', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },

  { name: 'add-site-basic', argv: ['marketplace', 'seller', 'add-site', '--url', 'example.com'] },
  { name: 'add-site-missing-url', argv: ['marketplace', 'seller', 'add-site'] },
  { name: 'connect-blog-basic', argv: ['marketplace', 'seller', 'connect-blog', PRODUCT_ID] },
  { name: 'connect-blog-missing-product-id', argv: ['marketplace', 'seller', 'connect-blog'] },

  { name: 'complete-onboarding-basic', argv: ['marketplace', 'seller', 'complete-onboarding', PRODUCT_ID] },
  { name: 'complete-onboarding-missing-product-id', argv: ['marketplace', 'seller', 'complete-onboarding'] },

  { name: 'placements-list-basic', argv: ['marketplace', 'seller', 'placements', 'list', PRODUCT_ID] },
  {
    name: 'placements-list-status-search',
    argv: [
      'marketplace',
      'seller',
      'placements',
      'list',
      PRODUCT_ID,
      '--status',
      'needs_approval',
      '--search',
      'guest post',
    ],
  },
  {
    name: 'placements-list-page-page-size',
    argv: ['marketplace', 'seller', 'placements', 'list', PRODUCT_ID, '--page', '2', '--page-size', '20'],
  },
  {
    name: 'placements-list-page-zero-error',
    argv: ['marketplace', 'seller', 'placements', 'list', PRODUCT_ID, '--page', '0'],
  },
  {
    name: 'placements-list-page-size-over-max-error',
    argv: ['marketplace', 'seller', 'placements', 'list', PRODUCT_ID, '--page-size', '101'],
  },

  { name: 'placements-approve-basic', argv: ['marketplace', 'seller', 'placements', 'approve', SECOND_ID] },
  { name: 'placements-decline-basic', argv: ['marketplace', 'seller', 'placements', 'decline', SECOND_ID] },
  { name: 'placements-publish-basic', argv: ['marketplace', 'seller', 'placements', 'publish', SECOND_ID] },
  { name: 'placements-regenerate-basic', argv: ['marketplace', 'seller', 'placements', 'regenerate', SECOND_ID] },
  { name: 'placements-approve-missing-placement-id', argv: ['marketplace', 'seller', 'placements', 'approve'] },
  {
    name: 'placements-unknown-subcommand',
    argv: ['marketplace', 'seller', 'placements', 'frobnicate', SECOND_ID],
  },

  { name: 'earnings-basic', argv: ['marketplace', 'seller', 'earnings', PRODUCT_ID] },
  {
    name: 'earnings-not-found',
    argv: ['marketplace', 'seller', 'earnings', PRODUCT_ID],
    responses: [NOT_FOUND_RESPONSE],
  },
  {
    name: 'earnings-non-json-response',
    argv: ['marketplace', 'seller', 'earnings', PRODUCT_ID],
    responses: [NON_JSON_RESPONSE],
  },

  { name: 'content-history-basic', argv: ['marketplace', 'seller', 'content-history', PRODUCT_ID] },
  {
    name: 'content-history-filters',
    argv: [
      'marketplace',
      'seller',
      'content-history',
      PRODUCT_ID,
      '--status',
      'published',
      '--limit',
      '5',
      '--offset',
      '10',
    ],
  },
  { name: 'content-history-missing-product-id', argv: ['marketplace', 'seller', 'content-history'] },

  { name: 'seller-unknown-subcommand', argv: ['marketplace', 'seller', 'frobnicate', PRODUCT_ID] },
  { name: 'seller-settings-bare-unknown-subcommand', argv: ['marketplace', 'seller', 'settings'] },
  { name: 'seller-integrations-bare-unknown-subcommand', argv: ['marketplace', 'seller', 'integrations'] },
  { name: 'seller-stripe-bare-missing-product-id', argv: ['marketplace', 'seller', 'stripe'] },
  { name: 'seller-placements-bare-unknown-subcommand', argv: ['marketplace', 'seller', 'placements'] },
  {
    name: 'status-refresh-stripe-equals-false',
    argv: ['marketplace', 'seller', 'status', PRODUCT_ID, '--refresh-stripe=false'],
  },
  {
    name: 'status-refresh-stripe-equals-invalid',
    argv: ['marketplace', 'seller', 'status', PRODUCT_ID, '--refresh-stripe=yes'],
  },
  { name: 'eligibility-surplus-positional', argv: ['marketplace', 'seller', 'eligibility', PRODUCT_ID, 'extra'] },
];
