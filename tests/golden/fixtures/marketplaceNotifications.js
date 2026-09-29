import { PRODUCT_ID, NOT_FOUND_RESPONSE, NON_JSON_RESPONSE, NETWORK_ERROR_RESPONSE } from './shared.js';

const ADMIN_ROLE_REQUIRED_RESPONSE = {
  status: 403,
  body: {
    ok: false,
    error: { code: 'ADMIN_ROLE_REQUIRED', message: 'This action requires an organization admin API key.' },
    agent_guidance: 'Ask an organization admin to run this, or create a new API key while holding the admin role.',
  },
};

export default [
  { name: 'help-notifications-group', argv: ['marketplace', 'notifications', '--help'], config: null },

  { name: 'list-basic-seller', argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller'] },
  { name: 'list-basic-buyer', argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'buyer'] },
  {
    name: 'list-with-type',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller', '--type', 'placement_approved'],
  },
  {
    name: 'list-with-sort-oldest',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller', '--sort', 'oldest'],
  },
  {
    name: 'list-with-page-page-size',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller', '--page', '2', '--page-size', '10'],
  },
  {
    name: 'list-page-zero-error',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller', '--page', '0'],
  },
  {
    name: 'list-page-size-over-max-error',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller', '--page-size', '101'],
  },
  { name: 'list-missing-role', argv: ['marketplace', 'notifications', 'list', PRODUCT_ID] },
  {
    name: 'list-unknown-role-passthrough',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'notarole'],
  },
  { name: 'list-missing-product-id', argv: ['marketplace', 'notifications', 'list'] },
  {
    name: 'list-not-found',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller'],
    responses: [NOT_FOUND_RESPONSE],
  },
  {
    name: 'list-non-json-response',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller'],
    responses: [NON_JSON_RESPONSE],
  },
  {
    name: 'list-network-error',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller'],
    responses: [NETWORK_ERROR_RESPONSE],
  },
  {
    name: 'list-no-api-key',
    argv: ['marketplace', 'notifications', 'list', PRODUCT_ID, '--role', 'seller'],
    config: null,
  },

  {
    name: 'mark-read-basic-seller',
    argv: ['marketplace', 'notifications', 'mark-read', PRODUCT_ID, '--role', 'seller'],
  },
  { name: 'mark-read-basic-buyer', argv: ['marketplace', 'notifications', 'mark-read', PRODUCT_ID, '--role', 'buyer'] },
  {
    name: 'mark-read-ids-repeated',
    argv: [
      'marketplace',
      'notifications',
      'mark-read',
      PRODUCT_ID,
      '--role',
      'seller',
      '--ids',
      'id-1,id-2',
      '--ids',
      'id-3',
    ],
  },
  {
    name: 'mark-read-ids-single-comma',
    argv: ['marketplace', 'notifications', 'mark-read', PRODUCT_ID, '--role', 'seller', '--ids', 'id-1,id-2,id-3'],
  },
  { name: 'mark-read-missing-role', argv: ['marketplace', 'notifications', 'mark-read', PRODUCT_ID] },
  {
    name: 'mark-read-unknown-role-passthrough',
    argv: ['marketplace', 'notifications', 'mark-read', PRODUCT_ID, '--role', 'notarole'],
  },
  {
    name: 'mark-read-admin-role-required',
    argv: ['marketplace', 'notifications', 'mark-read', PRODUCT_ID, '--role', 'seller'],
    responses: [ADMIN_ROLE_REQUIRED_RESPONSE],
  },
  { name: 'mark-read-missing-product-id', argv: ['marketplace', 'notifications', 'mark-read'] },

  { name: 'notifications-unknown-subcommand', argv: ['marketplace', 'notifications', 'frobnicate', PRODUCT_ID] },
];
