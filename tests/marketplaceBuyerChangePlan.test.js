import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registry } from '../src/commands/index.js';
import { Surface, createCommandContext } from '../src/core/context.js';
import { CliErrorCode } from '../src/core/errors.js';

const CHANGE_PLAN_ID = 'marketplace.buyer.change-plan';
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SUBSCRIPTION_ID = 'sub_123';
const IMMEDIATE_CANCEL_ACTIONS = ['cancel_scheduled', 'cancel_subscription'];
const SAFE_ACTIONS = ['change_tier', 'restore_subscription'];
const RESOLVED = { apiKey: 'outr_live_change_plan_key', baseUrl: 'https://www.outrank.so', source: {}, profile: {} };

const spec = registry.byId.get(CHANGE_PLAN_ID);

const ctxFor = (surface) => createCommandContext({ resolved: RESOLVED, registry, surface, usageGuidance: 'usage' });

const throwsUsage = (fn, messagePattern, guidancePattern) =>
  assert.throws(fn, (error) => {
    assert.equal(error.cliCode, CliErrorCode.INVALID_USAGE);
    assert.match(error.message, messagePattern);
    assert.match(error.guidance, guidancePattern);
    return true;
  });

test('immediate cancel actions require the subscription id on the CLI surface, not only on MCP', () => {
  for (const action of IMMEDIATE_CANCEL_ACTIONS) {
    throwsUsage(
      () => spec.refine({ productId: PRODUCT_ID, action }, ctxFor(Surface.CLI)),
      new RegExp(`${action} requires --confirm-subscription-id`),
      /outrank-cli marketplace buyer subscription aaaaaaaa-0000-4000-8000-000000000001 .*--confirm-subscription-id/,
    );
    throwsUsage(
      () => spec.refine({ productId: PRODUCT_ID, action }, ctxFor(Surface.MCP)),
      new RegExp(`${action} requires confirm_subscription_id`),
      /marketplace_buyer_subscription \{"product_id":"aaaaaaaa-0000-4000-8000-000000000001"\}.*confirm_subscription_id/,
    );
    assert.equal(
      spec.refine({ productId: PRODUCT_ID, action, confirmSubscriptionId: SUBSCRIPTION_ID }, ctxFor(Surface.CLI)),
      undefined,
    );
  }
});

test('a whitespace-only confirmation id is treated as missing and a padded one is trimmed', () => {
  const blank = { productId: PRODUCT_ID, action: 'cancel_subscription', confirmSubscriptionId: '   ' };
  throwsUsage(
    () => spec.refine(blank, ctxFor(Surface.CLI)),
    /cancel_subscription requires --confirm-subscription-id/,
    /confirm the cancellation/,
  );
  assert.equal(blank.confirmSubscriptionId, undefined);
  const padded = {
    productId: PRODUCT_ID,
    action: 'cancel_subscription',
    confirmSubscriptionId: ` ${SUBSCRIPTION_ID} `,
  };
  assert.equal(spec.refine(padded, ctxFor(Surface.CLI)), undefined);
  assert.equal(padded.confirmSubscriptionId, SUBSCRIPTION_ID);
});

test('change_tier and restore_subscription never ask for a confirmation id', () => {
  for (const action of SAFE_ACTIONS) {
    assert.equal(spec.refine({ productId: PRODUCT_ID, action }, ctxFor(Surface.CLI)), undefined);
    assert.equal(spec.refine({ productId: PRODUCT_ID, action }, ctxFor(Surface.MCP)), undefined);
  }
});
