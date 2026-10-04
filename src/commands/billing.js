import { randomUUID } from 'node:crypto';

import {
  BILLING_MAX_ADDITIONAL_PRODUCTS,
  BILLING_MIN_ADDITIONAL_PRODUCTS,
  BILLING_MIN_CONFIRM_CHARGE_CENTS,
  HTTP_STATUS_CONFLICT,
  Surface,
} from '../core/constants.js';
import { cliSuccess } from '../core/errors.js';
import { int, string } from '../core/schema.js';
import { CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';

export const BILLING_HELP = `Usage:
  outrank-cli billing portal-url
  outrank-cli billing purchase-products quote --additional-products <n> [--idempotency-key <key>]
  outrank-cli billing purchase-products buy --additional-products <n> --confirm-charge-cents <n> --idempotency-key <key>

Notes:
  portal-url returns a Stripe customer-portal link for the human to open in a browser.
  quote requests pricing without authorizing the charge.
  quote auto-generates an idempotency key if you do not pass one.
  buy requires the server-quoted recurring total in cents and an explicit idempotency key.
`;

const PURCHASE_PRODUCTS_HELP =
  'Usage:\n' +
  '  outrank-cli billing purchase-products quote --additional-products <n> [--idempotency-key <key>]\n' +
  '  outrank-cli billing purchase-products buy --additional-products <n> --confirm-charge-cents <n> ' +
  '--idempotency-key <key>';

const PURCHASE_PRODUCTS_PATH = '/billing/purchase-products';
const QUOTE_GUIDANCE =
  'Quote received. Review the recurring total and, if the human approves, run the matching `buy` command with ' +
  '--confirm-charge-cents set to the quoted amount.';
const BUY_COMMAND_ID = 'billing.purchase-products.buy';
const quoteGuidance = (ctx, input, quotedTotalCents, idempotencyKey) => {
  if (ctx.surface !== Surface.MCP) return QUOTE_GUIDANCE;
  const buyReference = ctx.ref(BUY_COMMAND_ID, {
    additionalProducts: input.additionalProducts,
    confirmChargeCents: quotedTotalCents,
    idempotencyKey,
  });
  return `Quote received. Review the recurring total and, if the human approves, call ${buyReference}.`;
};
const buyKeyGuidance = () =>
  `Generate a stable unique key for this purchase, for example ${randomUUID()}, then retry with ` +
  '--idempotency-key <value>.';

const additionalProducts = () =>
  int({ min: BILLING_MIN_ADDITIONAL_PRODUCTS, max: BILLING_MAX_ADDITIONAL_PRODUCTS }).required();

const isQuote = (status, result) =>
  status === HTTP_STATUS_CONFLICT &&
  result.ok === false &&
  Number.isInteger(result.error?.details?.expected_recurring_total_cents);

const portalUrl = defineCommand({
  id: 'billing.portal-url',
  summary: 'Return a Stripe customer-portal link for the human to open in a browser.',
  kind: CommandKind.READ,
  toolsets: [Toolset.BILLING],
  entryPoint: true,
  run: (_input, ctx) => ctx.http({ method: 'GET', path: '/billing/portal-url' }),
});

const quote = defineCommand({
  id: 'billing.purchase-products.quote',
  summary: 'Request pricing for additional product slots without authorizing the charge.',
  kind: CommandKind.READ,
  toolsets: [Toolset.BILLING],
  entryPoint: true,
  input: { additionalProducts: additionalProducts(), idempotencyKey: string() },
  run: async (input, ctx) => {
    const idempotencyKey = input.idempotencyKey ?? randomUUID();
    const { result, status } = await ctx.request({
      method: 'POST',
      path: PURCHASE_PRODUCTS_PATH,
      body: { additional_products: input.additionalProducts },
      idempotencyKey,
    });
    if (isQuote(status, result)) {
      return cliSuccess(
        { quote: result.error.details, api_response: result, idempotency_key: idempotencyKey },
        quoteGuidance(ctx, input, result.error.details.expected_recurring_total_cents, idempotencyKey),
      );
    }
    if (result.ok && result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
      return { ...result, data: { ...result.data, idempotency_key: idempotencyKey } };
    }
    return result;
  },
});

const buy = defineCommand({
  id: 'billing.purchase-products.buy',
  summary: 'Buy additional product slots at the quoted recurring total.',
  kind: CommandKind.MONEY,
  toolsets: [Toolset.BILLING],
  input: {
    additionalProducts: additionalProducts(),
    confirmChargeCents: int({ min: BILLING_MIN_CONFIRM_CHARGE_CENTS }).required(),
    idempotencyKey: string().required({ guidance: buyKeyGuidance() }),
  },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: PURCHASE_PRODUCTS_PATH,
      body: { additional_products: input.additionalProducts, confirm_charge_cents: input.confirmChargeCents },
      idempotencyKey: input.idempotencyKey,
    }),
});

const purchaseProducts = defineGroup({
  id: 'billing.purchase-products',
  help: {
    usage: PURCHASE_PRODUCTS_HELP,
    guidance: 'Use `quote` first, then `buy` with the quoted recurring total and a stable idempotency key.',
  },
  unknown: (word) => ({
    message: `Unknown billing purchase-products subcommand: ${word}.`,
    guidance: 'Run `outrank-cli billing purchase-products --help` to see the available purchase-products commands.',
  }),
  children: [quote, buy],
});

export const billingGroup = defineGroup({
  id: 'billing',
  help: {
    usage: BILLING_HELP,
    guidance: 'Choose one of the currently available billing groups: `portal-url` or `purchase-products`.',
  },
  unknown: (word) => ({
    message: `Unknown billing subcommand: ${word}.`,
    guidance: 'Run `outrank-cli billing --help` to see available billing commands.',
  }),
  children: [portalUrl, purchaseProducts],
});
