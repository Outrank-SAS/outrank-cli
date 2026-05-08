import { randomUUID } from 'node:crypto';

import { parseArgs, hasFlag, parseIntegerOption, getOption } from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

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

const handlePurchaseProducts = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage:
          'Usage:\n  outrank-cli billing purchase-products quote --additional-products <n> [--idempotency-key <key>]\n  outrank-cli billing purchase-products buy --additional-products <n> --confirm-charge-cents <n> --idempotency-key <key>',
      },
      'Use `quote` first, then `buy` with the quoted recurring total and a stable idempotency key.',
    );
  }

  const additionalProducts = parseIntegerOption(parsed, 'additional-products', {
    required: true,
    min: 1,
    max: 30,
  });

  if (subcommand === 'quote') {
    const idempotencyKey = getOption(parsed, 'idempotency-key') || randomUUID();
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: '/billing/purchase-products',
      body: {
        additional_products: additionalProducts,
      },
      idempotencyKey,
    });

    if (!response.ok && response.status === 409) {
      return cliSuccess(
        {
          quote: response.payload.error?.details ?? null,
          api_response: response.payload,
          idempotency_key: idempotencyKey,
        },
        'Quote received. Review the recurring total and, if the human approves, run the matching `buy` command with --confirm-charge-cents set to the quoted amount.',
      );
    }

    return response.payload;
  }

  if (subcommand === 'buy') {
    const confirmChargeCents = parseIntegerOption(parsed, 'confirm-charge-cents', {
      required: true,
      min: 0,
    });
    const idempotencyKey = getOption(parsed, 'idempotency-key');
    if (!idempotencyKey) {
      throw Object.assign(new Error('Missing required option: --idempotency-key.'), {
        cliCode: 'CLI_INVALID_USAGE',
        guidance:
          `Generate a stable unique key for this purchase, for example ${randomUUID()}, then retry with --idempotency-key <value>.`,
      });
    }

    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: '/billing/purchase-products',
      body: {
        additional_products: additionalProducts,
        confirm_charge_cents: confirmChargeCents,
      },
      idempotencyKey,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown billing purchase-products subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance:
      'Run `outrank-cli billing purchase-products --help` to see the available purchase-products commands.',
  });
};

export const handleBillingCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp = !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help';

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: BILLING_HELP.trim(),
      },
      'Choose one of the currently available billing groups: `portal-url` or `purchase-products`.',
    );
  }

  if (subcommand === 'portal-url') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: '/billing/portal-url',
    });
    return response.payload;
  }

  if (subcommand === 'purchase-products') {
    return handlePurchaseProducts(argv.slice(1));
  }

  throw Object.assign(new Error(`Unknown billing subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli billing --help` to see available billing commands.',
  });
};
