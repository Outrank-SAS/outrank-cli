import { LIST_MAX_LIMIT, LIST_MIN_LIMIT, MIN_OFFSET } from '../../core/constants.js';
import { CliErrorCode, cliError, cliSuccess } from '../../core/errors.js';
import { BoolSerialize, bool, int, string, uuid } from '../../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import {
  MARKETPLACE_UNKNOWN_GUIDANCE,
  PLACEMENT_CLI,
  PRODUCT_CLI,
  REQUIRED_OPTION,
  listFilterQuery,
  listFilters,
  placementInput,
  productInput,
  unknownFor,
} from './shared.js';

const TOOLSETS = [Toolset.MARKETPLACE_SELLER];
const SELLER_PATH = '/products/{productId}/marketplace/seller';
const SELLER_INTEGRATION_PATH = `${SELLER_PATH}/integrations/{integrationId}`;
const STRIPE_PATH = `${SELLER_PATH}/stripe-connect`;
const PLACEMENT_ACTION_PATH = '/marketplace/placements/{placementId}/{action}';
const TRUE_TEXT = 'true';
const BUYER_AUTHORED_PLACEMENT_FIELDS = [
  'placements[].keyword',
  'placements[].anchorText',
  'placements[].targetUrl',
  'placements[].articleTitle',
  'placements[].publishError',
];
const BUYER_AUTHORED_ARTICLE_FIELDS = [
  'items[].title',
  'items[].image_url',
  'items[].scheduled_keyword',
  'items[].meta_description',
  'items[].slug',
  'items[].instructions',
  'items[].publish_error',
  'items[]._human.summary',
];
const MARKETPLACE_TRACK_SCOPE = 'marketplace';
const MAX_SERVER_MESSAGE_CHARS = 200;
const STRIPE_ONBOARDING_HOST = 'connect.stripe.com';
const HTTPS_PROTOCOL = 'https:';
const ADOPT_FALLBACK_MESSAGE = 'the existing integration could not be reused';
const STRIPE_FALLBACK_MESSAGE = 'the Stripe Express account could not be created';

const SELLER_USAGE = `Usage:
  outrank-cli marketplace seller status <product-id> [--refresh-stripe]
  outrank-cli marketplace seller onboard <product-id> [--country <ISO2>]
  outrank-cli marketplace seller eligibility <product-id> [--refresh]
  outrank-cli marketplace seller eligibility recheck <product-id>
  outrank-cli marketplace seller settings get <product-id>
  outrank-cli marketplace seller settings update <product-id> --json '<object>'
  outrank-cli marketplace seller integrations status <product-id>
  outrank-cli marketplace seller integrations adopt <product-id>
  outrank-cli marketplace seller integrations claim <product-id> --integration <integration-id> --type <platform>
  outrank-cli marketplace seller integrations set-activation <product-id> --integration <integration-id> --type <platform> --status active|disabled
  outrank-cli marketplace seller integrations delete <product-id> --integration <integration-id> --type <platform>
  outrank-cli marketplace seller stripe onboard <product-id> --country <ISO2>
  outrank-cli marketplace seller stripe manage <product-id>
  outrank-cli marketplace seller stripe reset <product-id>
  outrank-cli marketplace seller complete-onboarding <product-id>
  outrank-cli marketplace seller placements list <product-id> [--status all|needs_approval|planned|live|link_not_found|lost] [--search <text>] [--page <n>] [--page-size <n>]
  outrank-cli marketplace seller placements approve <placement-id>
  outrank-cli marketplace seller placements decline <placement-id>
  outrank-cli marketplace seller placements publish <placement-id>
  outrank-cli marketplace seller placements regenerate <placement-id>
  outrank-cli marketplace seller earnings <product-id>
  outrank-cli marketplace seller content-history <product-id> [--status <status>] [--limit <n>] [--offset <n>]`;

const ELIGIBILITY_USAGE = `Usage:
  outrank-cli marketplace seller eligibility <product-id> [--refresh]
  outrank-cli marketplace seller eligibility recheck <product-id>`;
const SETTINGS_USAGE = `Usage:
  outrank-cli marketplace seller settings get <product-id>
  outrank-cli marketplace seller settings update <product-id> --json '<object>'`;
const INTEGRATIONS_USAGE = `Usage:
  outrank-cli marketplace seller integrations status <product-id>
  outrank-cli marketplace seller integrations adopt <product-id>
  outrank-cli marketplace seller integrations claim <product-id> --integration <integration-id> --type <platform>
  outrank-cli marketplace seller integrations set-activation <product-id> --integration <integration-id> --type <platform> --status active|disabled
  outrank-cli marketplace seller integrations delete <product-id> --integration <integration-id> --type <platform>`;
const STRIPE_USAGE = `Usage:
  outrank-cli marketplace seller stripe onboard <product-id> --country <ISO2>
  outrank-cli marketplace seller stripe manage <product-id>
  outrank-cli marketplace seller stripe reset <product-id>`;
const PLACEMENTS_USAGE = `Usage:
  outrank-cli marketplace seller placements list <product-id> [--status all|needs_approval|planned|live|link_not_found|lost] [--search <text>] [--page <n>] [--page-size <n>]
  outrank-cli marketplace seller placements approve <placement-id>
  outrank-cli marketplace seller placements decline <placement-id>
  outrank-cli marketplace seller placements publish <placement-id>
  outrank-cli marketplace seller placements regenerate <placement-id>`;

const DECLINE_ACTION = 'decline';
const SELLER_GUIDANCE =
  'Choose a seller subcommand: status, onboard, eligibility, settings, integrations, stripe, complete-onboarding, ' +
  'placements, earnings, content-history.';

const INTEGRATION_PLACEHOLDERS = { integrationId: '<integration-id>', integrationType: '<platform>' };
const INTEGRATION_CLI = {
  ...PRODUCT_CLI,
  options: { integration: 'integrationId', type: 'integrationType' },
  placeholders: INTEGRATION_PLACEHOLDERS,
};
const integrationOptions = () => ({
  integrationId: uuid().required(REQUIRED_OPTION),
  integrationType: string().required(REQUIRED_OPTION),
});

const sellerGet = ({ id, summary, suffix, kind = CommandKind.READ, entryPoint = false, mcp = true }) =>
  defineCommand({
    id: `marketplace.seller.${id}`,
    summary,
    kind,
    toolsets: TOOLSETS,
    mcp,
    input: productInput(),
    cli: PRODUCT_CLI,
    entryPoint,
    run: (input, ctx) => ctx.http({ method: 'GET', path: `${SELLER_PATH}${suffix}`, pathParams: input }),
  });

const sellerPost = ({ id, summary, suffix, kind = CommandKind.WRITE, entryPoint = false, body }) =>
  defineCommand({
    id: `marketplace.seller.${id}`,
    summary,
    kind,
    toolsets: TOOLSETS,
    input: productInput(),
    cli: PRODUCT_CLI,
    entryPoint,
    run: (input, ctx) => ctx.http({ method: 'POST', path: `${SELLER_PATH}${suffix}`, pathParams: input, body }),
  });

const status = defineCommand({
  id: 'marketplace.seller.status',
  summary: 'Show the seller onboarding and enrollment status of a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...productInput(), refreshStripe: bool({ serialize: BoolSerialize.STRING }) },
  cli: { ...PRODUCT_CLI, options: { 'refresh-stripe': 'refreshStripe' } },
  entryPoint: true,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${SELLER_PATH}/status`,
      pathParams: input,
      query: { refresh_stripe: input.refreshStripe ? TRUE_TEXT : undefined },
    }),
});

const quoteServerText = (text, fallback) => {
  const value = typeof text === 'string' && text.trim() ? text.trim() : fallback;
  const clipped = value.length > MAX_SERVER_MESSAGE_CHARS ? `${value.slice(0, MAX_SERVER_MESSAGE_CHARS)}…` : value;
  return `server said: "${clipped.replaceAll('"', "'")}"`;
};

const safeOnboardingUrl = (value) => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === HTTPS_PROTOCOL && url.hostname === STRIPE_ONBOARDING_HOST ? url.toString() : null;
  } catch {
    return null;
  }
};

const stepFailure = (step, completedSteps, actions, error) =>
  cliError(
    error?.cliCode ?? CliErrorCode.UNEXPECTED_ERROR,
    error?.message ?? 'Unexpected CLI failure.',
    error?.guidance ?? `The ${step} call failed; the steps that already succeeded are listed in error.details.`,
    { step, completed_steps: completedSteps, actions, ...(error?.details ?? {}) },
  );

const describeRemainingSteps = ({ ctx, productId, country, flags }) => {
  const remaining = [];
  const ref = (id, args) => ctx.ref(id, args);
  const stripeOnboard = (extra = {}) => ref('marketplace.seller.stripe.onboard', { productId, ...extra });

  if (!flags.gscConnected) {
    remaining.push(
      `Blog step: collect the product's content details from the human (${ref('products.get', { productId })} / ` +
        `${ref('products.update', { productId })}) and connect Google Search Console (${ref('products.gsc.connect', {
          productId,
        })}, then ${ref('products.gsc.poll', { productId })} and ${ref('products.gsc.set-property', {
          productId,
        })}) — required before anything else`,
    );
  }
  remaining.push(
    `Articles step: review article settings (${ref('products.output-settings.get', { productId })} / ` +
      `${ref('products.output-settings.update', { productId })}) and set the publishing schedule ` +
      `(${ref('marketplace.seller.settings.update', { productId })} with dailyArticleLimit 1-3 and publishingDays)`,
  );
  if (!flags.cmsConnected) {
    const integrationsStatus = ref('marketplace.seller.integrations.status', { productId });
    remaining.push(
      flags.adoptFailureMessage
        ? `Integration step: adopting the existing CMS failed (${flags.adoptFailureMessage}) — run ` +
            `${integrationsStatus}, connect a new supported platform via the products integrations commands, then ` +
            'claim it for the marketplace'
        : `Integration step: no reusable CMS was found — run ${integrationsStatus}, connect a supported platform via ` +
            'the products integrations commands, then claim it for the marketplace',
    );
  }
  if (!flags.stripeAccountConnected) {
    if (flags.stripeFailureMessage) {
      remaining.push(
        `Payouts step: Stripe Express onboarding failed (${flags.stripeFailureMessage}) — resolve that, then run ` +
          stripeOnboard({ country }),
      );
    } else if (country) {
      remaining.push(
        `Payouts step: Stripe Express could not be created yet — finish the earlier steps, then run ${stripeOnboard({
          country,
        })}`,
      );
    } else {
      remaining.push(
        'Payouts step: ask the human for the two-letter country of their payout bank account, then run ' +
          `${stripeOnboard({ country: '<ISO2>' })} (or re-run this command with the country)`,
      );
    }
  } else if (flags.stripeOnboardingUrl) {
    remaining.push(
      `Payouts step: the Stripe Express account is ready — the human must open ${flags.stripeOnboardingUrl} in a ` +
        'browser and finish identity and bank details',
    );
  } else if (!flags.payoutsEnabled) {
    remaining.push(
      `Payouts step: Stripe onboarding looks unfinished — get a fresh link with ${stripeOnboard(
        country ? { country } : {},
      )} and have the human complete it`,
    );
  }
  remaining.push(
    `Finish with ${ref('marketplace.seller.complete-onboarding', { productId })}, then re-check ` +
      `${ref('marketplace.seller.status', { productId })}`,
  );
  return remaining;
};

const runOnboard = async (input, ctx) => {
  const { productId, country } = input;
  const completedSteps = [];
  const actions = [];
  const recordAction = (action, envelope) =>
    actions.push({ action, ok: Boolean(envelope.ok), result: envelope.ok ? envelope.data : envelope.error });
  const call = async (step, request) => {
    try {
      const { result } = await ctx.request(request);
      if (result.ok) completedSteps.push(step);
      return result;
    } catch (error) {
      return { failure: stepFailure(step, [...completedSteps], [...actions], error) };
    }
  };

  const statusResult = await call('status', {
    method: 'GET',
    path: `${SELLER_PATH}/status`,
    pathParams: { productId },
  });
  if (statusResult.failure) return statusResult.failure;
  if (!statusResult.ok) return statusResult;

  const sellerStatus = statusResult.data ?? {};
  if (sellerStatus.enrollment?.completed) {
    return cliSuccess(
      { status: sellerStatus, actions },
      `Seller onboarding is already complete for this product. ${statusResult.agent_guidance ?? ''}`.trim(),
    );
  }

  const flags = {
    cmsConnected: Boolean(sellerStatus.onboarding?.cms?.connected),
    gscConnected: Boolean(sellerStatus.onboarding?.gsc?.connected),
    stripeAccountConnected: Boolean(sellerStatus.onboarding?.stripe?.accountConnected),
    payoutsEnabled: Boolean(sellerStatus.onboarding?.stripe?.payoutsEnabled),
    stripeOnboardingUrl: null,
    adoptFailureMessage: null,
    stripeFailureMessage: null,
  };

  if (!flags.cmsConnected && sellerStatus.onboarding?.cms?.existing) {
    const adopt = await call('adopt-existing-integration', {
      method: 'POST',
      path: `${SELLER_PATH}/integrations/adopt`,
      pathParams: { productId },
    });
    if (adopt.failure) return adopt.failure;
    recordAction('adopt-existing-integration', adopt);
    if (adopt.ok) flags.cmsConnected = true;
    else flags.adoptFailureMessage = quoteServerText(adopt.error?.message, ADOPT_FALLBACK_MESSAGE);
  }

  if (!flags.stripeAccountConnected && flags.gscConnected && flags.cmsConnected && country) {
    const stripe = await call('stripe-express-onboard', {
      method: 'POST',
      path: `${STRIPE_PATH}/onboard`,
      pathParams: { productId },
      body: { country },
    });
    if (stripe.failure) return stripe.failure;
    recordAction('stripe-express-onboard', stripe);
    if (stripe.ok) {
      flags.stripeAccountConnected = true;
      flags.stripeOnboardingUrl = safeOnboardingUrl(stripe.data?.onboardingUrl);
    } else {
      flags.stripeFailureMessage = quoteServerText(stripe.error?.message, STRIPE_FALLBACK_MESSAGE);
    }
  }

  const eligibilityResult = await call('eligibility', {
    method: 'GET',
    path: `${SELLER_PATH}/eligibility`,
    pathParams: { productId },
    query: { refresh: TRUE_TEXT },
  });
  if (eligibilityResult.failure) return eligibilityResult.failure;
  const eligibility = eligibilityResult.ok ? eligibilityResult.data : null;
  const eligibilityNote = eligibilityResult.agent_guidance
    ? ` Eligibility (${quoteServerText(eligibilityResult.agent_guidance, '')}).`
    : '';

  const remaining = describeRemainingSteps({ ctx, productId, country, flags });
  const actionsNote =
    actions.length > 0
      ? `Automatic actions taken: ${actions
          .map((entry) => `${entry.action} (${entry.ok ? 'ok' : 'failed'})`)
          .join(', ')}. `
      : '';
  return cliSuccess(
    { status: sellerStatus, actions, eligibility },
    `Seller onboarding in progress (wizard order: Blog -> Articles -> Integration -> Payouts). ${actionsNote}` +
      `Steps to complete with the human: ${remaining.join('; ')}.${eligibilityNote} Always report the eligibility ` +
      'check results to the human.',
  );
};

const onboard = defineCommand({
  id: 'marketplace.seller.onboard',
  summary: 'Run the seller onboarding orchestrator: status, auto-adopt CMS, Stripe Express, eligibility.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...productInput(), country: string() },
  cli: PRODUCT_CLI,
  entryPoint: true,
  run: runOnboard,
});

const eligibilityGroup = defineGroup({
  id: 'marketplace.seller.eligibility',
  help: {
    usage: ELIGIBILITY_USAGE,
    guidance: 'Run without a subcommand to read eligibility, or `recheck` to recompute it.',
  },
  unknown: unknownFor('seller eligibility'),
  command: {
    summary: 'Read the marketplace seller eligibility of a product.',
    kind: CommandKind.READ,
    toolsets: TOOLSETS,
    entryPoint: true,
    input: { ...productInput(), refresh: bool({ serialize: BoolSerialize.STRING }) },
    cli: PRODUCT_CLI,
    run: (input, ctx) =>
      ctx.http({
        method: 'GET',
        path: `${SELLER_PATH}/eligibility`,
        pathParams: input,
        query: { refresh: input.refresh ? TRUE_TEXT : undefined },
      }),
  },
  children: [
    sellerPost({
      id: 'eligibility.recheck',
      summary: 'Recompute the marketplace seller eligibility of a product.',
      suffix: '/eligibility/recheck',
      entryPoint: true,
    }),
  ],
});

const settingsGroup = defineGroup({
  id: 'marketplace.seller.settings',
  help: { usage: SETTINGS_USAGE, guidance: 'Use `get` to read the seller settings and `update` to patch them.' },
  unknown: unknownFor('seller settings'),
  children: [
    sellerGet({
      id: 'settings.get',
      summary: 'Get the marketplace seller settings of a product.',
      suffix: '/settings',
    }),
    defineCommand({
      id: 'marketplace.seller.settings.update',
      summary: 'Update the marketplace seller settings of a product from a JSON body (admin only).',
      kind: CommandKind.WRITE,
      toolsets: TOOLSETS,
      input: productInput(),
      cli: PRODUCT_CLI,
      body: BodyMode.JSON,
      run: (input, ctx) =>
        ctx.http({ method: 'PATCH', path: `${SELLER_PATH}/settings`, pathParams: input, body: input.body }),
    }),
  ],
});

const integrationsGroup = defineGroup({
  id: 'marketplace.seller.integrations',
  help: {
    usage: INTEGRATIONS_USAGE,
    guidance:
      'Use `status` to see reusable CMS integrations, `adopt` or `claim` to attach one, and the writes are admin ' +
      'only.',
  },
  unknown: unknownFor('seller integrations'),
  children: [
    sellerGet({
      id: 'integrations.status',
      summary: 'Show the marketplace CMS integration status of a product.',
      suffix: '/integrations',
      entryPoint: true,
    }),
    sellerPost({
      id: 'integrations.adopt',
      summary: 'Adopt the existing reusable CMS integration for the marketplace (admin only).',
      suffix: '/integrations/adopt',
    }),
    defineCommand({
      id: 'marketplace.seller.integrations.claim',
      summary: 'Claim a publishing integration for the marketplace (admin only).',
      kind: CommandKind.WRITE,
      toolsets: TOOLSETS,
      input: { ...productInput(), ...integrationOptions() },
      cli: INTEGRATION_CLI,
      run: (input, ctx) =>
        ctx.http({
          method: 'POST',
          path: `${SELLER_PATH}/integrations/claim`,
          pathParams: input,
          body: { integrationId: input.integrationId, integrationType: input.integrationType },
        }),
    }),
    defineCommand({
      id: 'marketplace.seller.integrations.set-activation',
      summary: 'Activate or disable a marketplace CMS integration (admin only).',
      kind: CommandKind.WRITE,
      toolsets: TOOLSETS,
      input: { ...productInput(), ...integrationOptions(), activationStatus: string().required(REQUIRED_OPTION) },
      cli: {
        ...INTEGRATION_CLI,
        options: { ...INTEGRATION_CLI.options, status: 'activationStatus' },
        placeholders: { ...INTEGRATION_PLACEHOLDERS, activationStatus: 'active|disabled' },
      },
      run: (input, ctx) =>
        ctx.http({
          method: 'PATCH',
          path: SELLER_INTEGRATION_PATH,
          pathParams: input,
          body: { integrationType: input.integrationType, activationStatus: input.activationStatus },
        }),
    }),
    defineCommand({
      id: 'marketplace.seller.integrations.delete',
      summary: 'Remove a marketplace CMS integration (admin only).',
      kind: CommandKind.DESTRUCTIVE,
      toolsets: TOOLSETS,
      input: { ...productInput(), ...integrationOptions() },
      cli: INTEGRATION_CLI,
      run: (input, ctx) =>
        ctx.http({
          method: 'DELETE',
          path: SELLER_INTEGRATION_PATH,
          pathParams: input,
          query: { integration_type: input.integrationType },
        }),
    }),
  ],
});

const stripeGroup = defineGroup({
  id: 'marketplace.seller.stripe',
  help: {
    usage: STRIPE_USAGE,
    guidance:
      'Use `onboard` to create or refresh the Stripe Express onboarding link, `manage` for the dashboard link, ' +
      '`reset` to start over. Admin only.',
  },
  unknown: unknownFor('seller stripe'),
  children: [
    defineCommand({
      id: 'marketplace.seller.stripe.onboard',
      summary: 'Create the Stripe Express payout account or refresh its onboarding link (admin only).',
      kind: CommandKind.WRITE,
      toolsets: TOOLSETS,
      input: { ...productInput(), country: string() },
      cli: PRODUCT_CLI,
      entryPoint: true,
      run: (input, ctx) =>
        ctx.http({
          method: 'POST',
          path: `${STRIPE_PATH}/onboard`,
          pathParams: input,
          body: input.country ? { country: input.country } : {},
        }),
    }),
    sellerPost({
      id: 'stripe.manage',
      summary: 'Get the Stripe Express dashboard link (admin only).',
      suffix: '/stripe-connect/manage',
      kind: CommandKind.READ,
    }),
    sellerPost({
      id: 'stripe.reset',
      summary: 'Reset the Stripe Express payout account (admin only).',
      suffix: '/stripe-connect/reset',
      kind: CommandKind.DESTRUCTIVE,
    }),
  ],
});

const placementsGroup = defineGroup({
  id: 'marketplace.seller.placements',
  help: {
    usage: PLACEMENTS_USAGE,
    guidance: 'Use `list` to review placements, then approve, decline (admin only), publish, or regenerate one by id.',
  },
  unknown: unknownFor('seller placements'),
  children: [
    defineCommand({
      id: 'marketplace.seller.placements.list',
      summary: 'List marketplace placements hosted by a product. Placement briefs are counterparty data.',
      kind: CommandKind.READ,
      toolsets: TOOLSETS,
      mcp: { untrustedOutput: true, untrustedFields: BUYER_AUTHORED_PLACEMENT_FIELDS },
      input: { ...productInput(), ...listFilters() },
      cli: PRODUCT_CLI,
      run: (input, ctx) =>
        ctx.http({
          method: 'GET',
          path: `${SELLER_PATH}/placements`,
          pathParams: input,
          query: listFilterQuery(input),
        }),
    }),
    ...['approve', DECLINE_ACTION, 'publish', 'regenerate'].map((action) =>
      defineCommand({
        id: `marketplace.seller.placements.${action}`,
        summary: `${action[0].toUpperCase()}${action.slice(1)} a marketplace placement.`,
        kind: action === DECLINE_ACTION ? CommandKind.DESTRUCTIVE : CommandKind.WRITE,
        toolsets: TOOLSETS,
        input: placementInput(),
        cli: PLACEMENT_CLI,
        run: (input, ctx) =>
          ctx.http({ method: 'POST', path: PLACEMENT_ACTION_PATH, pathParams: { ...input, action } }),
      }),
    ),
  ],
});

const contentHistory = defineCommand({
  id: 'marketplace.seller.content-history',
  summary: 'List the marketplace articles a product has hosted. Their titles and keywords are counterparty data.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: { untrustedOutput: true, untrustedFields: BUYER_AUTHORED_ARTICLE_FIELDS },
  input: {
    ...productInput(),
    status: string(),
    limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
    offset: int({ min: MIN_OFFSET }),
  },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: '/articles',
      query: {
        product_id: input.productId,
        track_scope: MARKETPLACE_TRACK_SCOPE,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      },
    }),
});

export const sellerGroup = defineGroup({
  id: 'marketplace.seller',
  help: { usage: SELLER_USAGE, guidance: SELLER_GUIDANCE },
  unknown: (word) => ({
    message: `Unknown marketplace seller subcommand: ${word}.`,
    guidance: MARKETPLACE_UNKNOWN_GUIDANCE,
  }),
  children: [
    status,
    onboard,
    eligibilityGroup,
    settingsGroup,
    integrationsGroup,
    stripeGroup,
    sellerPost({
      id: 'complete-onboarding',
      summary: 'Mark seller onboarding as complete (admin only).',
      suffix: '/complete-onboarding',
      entryPoint: true,
    }),
    placementsGroup,
    sellerGet({ id: 'earnings', summary: 'Show marketplace earnings for a product.', suffix: '/earnings' }),
    contentHistory,
  ],
});
