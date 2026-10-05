import { test } from 'node:test';
import assert from 'node:assert/strict';

import { jsonResponse, respondWith, withMcp } from './helpers/mcpHarness.js';

const ADDITIONAL_PRODUCTS = 2;
const QUOTED_TOTAL_CENTS = 19800;
const IDEMPOTENCY_KEY = 'quote-key-0001';
const QUOTE_RESPONSE = {
  ok: false,
  error: {
    code: 'CONFLICT',
    message: 'Confirm the charge to continue.',
    details: { expected_recurring_total_cents: QUOTED_TOTAL_CENTS },
  },
  agent_guidance: 'Resubmit with confirm_charge_cents.',
};

test('the quote tool tells an MCP client which tool buys, with the quoted amount and the same key', async () => {
  const respond = respondWith({ other: () => jsonResponse(409, QUOTE_RESPONSE) });
  await withMcp({ respond, argv: ['--toolsets', 'all'] }, async ({ call }) => {
    const quoted = await call('billing_purchase_products_quote', {
      additional_products: ADDITIONAL_PRODUCTS,
      idempotency_key: IDEMPOTENCY_KEY,
    });
    assert.equal(quoted.envelope.ok, true);
    assert.equal(quoted.envelope.data.quote.expected_recurring_total_cents, QUOTED_TOTAL_CENTS);
    assert.equal(
      quoted.envelope.agent_guidance,
      'Quote received. Review the recurring total and, if the human approves, call ' +
        'billing_purchase_products_buy ' +
        `{"additional_products":${ADDITIONAL_PRODUCTS},"confirm_charge_cents":${QUOTED_TOTAL_CENTS},` +
        `"idempotency_key":"${IDEMPOTENCY_KEY}"}.`,
    );
  });
});
