import { parseArgs, getRequiredPositional, readJsonInput, hasFlag, parseIntegerOption, getOption, getOptions } from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

export const MARKETPLACE_HELP = `Usage:
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
  outrank-cli marketplace seller content-history <product-id> [--status <status>] [--limit <n>] [--offset <n>]
  outrank-cli marketplace notifications list <product-id> --role seller|buyer [--type <type>] [--sort oldest] [--page <n>] [--page-size <n>]
  outrank-cli marketplace notifications mark-read <product-id> --role seller|buyer [--ids <id1,id2,...>]

  outrank-cli marketplace buyer status <product-id>
  outrank-cli marketplace buyer billing-status <product-id>
  outrank-cli marketplace buyer subscription <product-id>
  outrank-cli marketplace buyer subscribe-quote <product-id>
  outrank-cli marketplace buyer checkout <product-id> --tier <tier>
  outrank-cli marketplace buyer change-plan <product-id> --action change_tier|cancel_scheduled|cancel_subscription|restore_subscription [--tier <tier>]
  outrank-cli marketplace buyer target-pages list <product-id>
  outrank-cli marketplace buyer target-pages add <product-id> --urls <url1,url2,...> [--source manual|discovered]
  outrank-cli marketplace buyer target-pages discover <product-id> [--source sitemap|root_url|integration] [--source-url <url>]
  outrank-cli marketplace buyer target-pages pause <target-page-id>
  outrank-cli marketplace buyer target-pages activate <target-page-id>
  outrank-cli marketplace buyer target-pages delete <target-page-id>
  outrank-cli marketplace buyer participation on <product-id>
  outrank-cli marketplace buyer participation off <product-id>
  outrank-cli marketplace buyer placements list <product-id> [--status all|live|in_progress|lost|rejected] [--search <text>] [--page <n>] [--page-size <n>]
  outrank-cli marketplace buyer placements regenerate <placement-id>
  outrank-cli marketplace buyer placements revalidate <placement-id>
  outrank-cli marketplace buyer article get <placement-id>
  outrank-cli marketplace buyer article edit <placement-id> --json '<object>'
  outrank-cli marketplace buyer credits history <product-id> [--kind all|charge|refund] [--page <n>] [--page-size <n>]

Notes:
  Seller onboarding wizard order: Blog (content details + Google Search Console) -> Articles (article settings + publishing schedule) -> Integration (marketplace CMS) -> Payouts (Stripe Express).
  \`seller onboard\` reports every remaining step, auto-adopts an existing reusable CMS without asking, and creates the Stripe Express account when the earlier steps are done and --country is provided.
  Admin-only commands (need an API key created by an org admin who still holds that role): settings update, all integrations writes, all stripe commands, complete-onboarding, placements decline, and buyer checkout/change-plan/participation. Buyer target-page writes are open to every org member.
  The mandatory buyer sequence: Enterprise backlink plan (subscribe-quote -> a human org admin completes checkout) -> add target pages -> participation on.
  Purchasing the Enterprise backlink plan is admin-only and happens through interactive Stripe checkout — surface subscription_management_url to the human.

Examples:
  outrank-cli marketplace seller status 00000000-0000-0000-0000-000000000000
  outrank-cli marketplace seller onboard 00000000-0000-0000-0000-000000000000 --country US
  outrank-cli marketplace seller settings update 00000000-0000-0000-0000-000000000000 --json '{"dailyArticleLimit":2,"publishingDays":[1,3,5]}'
  outrank-cli marketplace seller placements list 00000000-0000-0000-0000-000000000000 --status needs_approval
  outrank-cli marketplace seller placements approve 00000000-0000-0000-0000-000000000000
  outrank-cli marketplace notifications list 00000000-0000-0000-0000-000000000000 --role seller
  outrank-cli marketplace buyer status 00000000-0000-0000-0000-000000000000
  outrank-cli marketplace buyer target-pages add 00000000-0000-0000-0000-000000000000 --urls https://example.com/pricing,https://example.com/features
`;

const buildQueryPath = (basePath, searchParams) => {
  const url = new URL(`https://local${basePath}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
};

const invalidUsage = (message, guidance) =>
  Object.assign(new Error(message), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: guidance || 'Run `outrank-cli marketplace --help` to see the available marketplace commands.',
  });

const requireOption = (parsed, name, label) => {
  const value = getOption(parsed, name);
  if (!value) {
    throw invalidUsage(`Missing required option: --${name} ${label || ''}`.trim() + '.');
  }
  return value;
};

const splitList = (values) =>
  values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

const handleSellerStatus = async (parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const path = buildQueryPath(`/products/${productId}/marketplace/seller/status`, {
    refresh_stripe: hasFlag(parsed, 'refresh-stripe') ? 'true' : undefined,
  });
  const response = await requestAgentApi(parsed, { method: 'GET', path });
  return response.payload;
};

const handleSellerOnboard = async (parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const country = getOption(parsed, 'country');

  const statusResponse = await requestAgentApi(parsed, {
    method: 'GET',
    path: `/products/${productId}/marketplace/seller/status`,
  });
  if (!statusResponse.ok) return statusResponse.payload;

  const status = statusResponse.payload?.data ?? {};
  const actions = [];

  if (status.enrollment?.completed) {
    return cliSuccess(
      { status, actions },
      `Seller onboarding is already complete for this product. ${statusResponse.payload?.agent_guidance ?? ''}`.trim(),
    );
  }

  let cmsConnected = Boolean(status.onboarding?.cms?.connected);
  const gscConnected = Boolean(status.onboarding?.gsc?.connected);
  let stripeAccountConnected = Boolean(status.onboarding?.stripe?.accountConnected);
  let stripeOnboardingUrl = null;
  let adoptFailureMessage = null;

  if (!cmsConnected && status.onboarding?.cms?.existing) {
    const adoptResponse = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/integrations/adopt`,
    });
    actions.push({
      action: 'adopt-existing-integration',
      ok: Boolean(adoptResponse.payload?.ok),
      result: adoptResponse.payload?.ok ? adoptResponse.payload.data : adoptResponse.payload?.error,
    });
    if (adoptResponse.payload?.ok) {
      cmsConnected = true;
    } else {
      adoptFailureMessage = adoptResponse.payload?.error?.message ?? 'the existing integration could not be reused';
    }
  }

  if (!stripeAccountConnected && gscConnected && cmsConnected && country) {
    const stripeResponse = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/stripe-connect/onboard`,
      body: { country },
    });
    actions.push({
      action: 'stripe-express-onboard',
      ok: Boolean(stripeResponse.payload?.ok),
      result: stripeResponse.payload?.ok ? stripeResponse.payload.data : stripeResponse.payload?.error,
    });
    if (stripeResponse.payload?.ok) {
      stripeAccountConnected = true;
      stripeOnboardingUrl = stripeResponse.payload.data?.onboardingUrl ?? null;
    }
  }

  const eligibilityResponse = await requestAgentApi(parsed, {
    method: 'GET',
    path: buildQueryPath(`/products/${productId}/marketplace/seller/eligibility`, { refresh: 'true' }),
  });
  const eligibility = eligibilityResponse.payload?.ok ? eligibilityResponse.payload.data : null;

  const remaining = [];
  if (!gscConnected) {
    remaining.push(
      `Blog step: collect the product's content details from the human (outrank-cli products get/update ${productId}) and connect Google Search Console (outrank-cli products gsc connect ${productId}, then gsc poll and gsc set-property) — required before anything else`,
    );
  }
  remaining.push(
    `Articles step: review article settings (outrank-cli products output-settings get/update ${productId}) and set the publishing schedule (outrank-cli marketplace seller settings update ${productId} --json '{"dailyArticleLimit":<1-3>,"publishingDays":[...]}')`,
  );
  if (!cmsConnected) {
    remaining.push(
      adoptFailureMessage
        ? `Integration step: adopting the existing CMS failed (${adoptFailureMessage}) — run outrank-cli marketplace seller integrations status ${productId}, connect a new supported platform via the products integrations commands, then claim it for the marketplace`
        : `Integration step: no reusable CMS was found — run outrank-cli marketplace seller integrations status ${productId}, connect a supported platform via the products integrations commands, then claim it for the marketplace`,
    );
  }
  if (!stripeAccountConnected) {
    remaining.push(
      country
        ? `Payouts step: Stripe Express could not be created yet — finish the earlier steps, then run outrank-cli marketplace seller stripe onboard ${productId} --country ${country}`
        : `Payouts step: ask the human for the two-letter country of their payout bank account, then run outrank-cli marketplace seller stripe onboard ${productId} --country <ISO2> (or re-run this command with --country)`,
    );
  } else if (stripeOnboardingUrl) {
    remaining.push(
      `Payouts step: the Stripe Express account is ready — the human must open ${stripeOnboardingUrl} in a browser and finish identity and bank details`,
    );
  } else if (!status.onboarding?.stripe?.payoutsEnabled) {
    remaining.push(
      `Payouts step: Stripe onboarding looks unfinished — get a fresh link with outrank-cli marketplace seller stripe onboard ${productId}${country ? ` --country ${country}` : ''} and have the human complete it`,
    );
  }
  remaining.push(
    `Finish with outrank-cli marketplace seller complete-onboarding ${productId}, then re-check outrank-cli marketplace seller status ${productId}`,
  );

  const eligibilityNote = eligibilityResponse.payload?.agent_guidance
    ? ` Eligibility: ${eligibilityResponse.payload.agent_guidance}`
    : '';

  return cliSuccess(
    { status, actions, eligibility },
    `Seller onboarding in progress (wizard order: Blog -> Articles -> Integration -> Payouts). ${actions.length > 0 ? `Automatic actions taken: ${actions.map((entry) => `${entry.action} (${entry.ok ? 'ok' : 'failed'})`).join(', ')}. ` : ''}Steps to complete with the human: ${remaining.join('; ')}.${eligibilityNote} Always report the eligibility check results to the human.`,
  );
};

const handleSellerEligibility = async (argv) => {
  if (argv[0] === 'recheck') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/eligibility/recheck`,
    });
    return response.payload;
  }

  const parsed = parseArgs(argv);
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const path = buildQueryPath(`/products/${productId}/marketplace/seller/eligibility`, {
    refresh: hasFlag(parsed, 'refresh') ? 'true' : undefined,
  });
  const response = await requestAgentApi(parsed, { method: 'GET', path });
  return response.payload;
};

const handleSellerSettings = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));

  if (subcommand === 'get') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/marketplace/seller/settings`,
    });
    return response.payload;
  }

  if (subcommand === 'update') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/products/${productId}/marketplace/seller/settings`,
      body,
    });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace seller settings subcommand: ${subcommand}.`);
};

const handleSellerIntegrations = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));

  if (subcommand === 'status') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/marketplace/seller/integrations`,
    });
    return response.payload;
  }

  if (subcommand === 'adopt') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/integrations/adopt`,
    });
    return response.payload;
  }

  if (subcommand === 'claim') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/integrations/claim`,
      body: {
        integrationId: requireOption(parsed, 'integration', '<integration-id>'),
        integrationType: requireOption(parsed, 'type', '<platform>'),
      },
    });
    return response.payload;
  }

  if (subcommand === 'set-activation') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const integrationId = requireOption(parsed, 'integration', '<integration-id>');
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/products/${productId}/marketplace/seller/integrations/${integrationId}`,
      body: {
        integrationType: requireOption(parsed, 'type', '<platform>'),
        activationStatus: requireOption(parsed, 'status', 'active|disabled'),
      },
    });
    return response.payload;
  }

  if (subcommand === 'delete') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const integrationId = requireOption(parsed, 'integration', '<integration-id>');
    const path = buildQueryPath(`/products/${productId}/marketplace/seller/integrations/${integrationId}`, {
      integration_type: requireOption(parsed, 'type', '<platform>'),
    });
    const response = await requestAgentApi(parsed, { method: 'DELETE', path });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace seller integrations subcommand: ${subcommand}.`);
};

const handleSellerStripe = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const productId = getRequiredPositional(parsed, 0, '<product-id>');

  if (subcommand === 'onboard') {
    const country = getOption(parsed, 'country');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/stripe-connect/onboard`,
      body: country ? { country } : {},
    });
    return response.payload;
  }

  if (subcommand === 'manage') {
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/stripe-connect/manage`,
    });
    return response.payload;
  }

  if (subcommand === 'reset') {
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/stripe-connect/reset`,
    });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace seller stripe subcommand: ${subcommand}.`);
};

const SELLER_PLACEMENT_ACTIONS = new Set(['approve', 'decline', 'publish', 'regenerate']);

const handleSellerPlacements = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));

  if (subcommand === 'list') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const path = buildQueryPath(`/products/${productId}/marketplace/seller/placements`, {
      status: getOption(parsed, 'status'),
      search: getOption(parsed, 'search'),
      page: parseIntegerOption(parsed, 'page', { min: 1 }),
      page_size: parseIntegerOption(parsed, 'page-size', { min: 1, max: 100 }),
    });
    const response = await requestAgentApi(parsed, { method: 'GET', path });
    return response.payload;
  }

  if (SELLER_PLACEMENT_ACTIONS.has(subcommand)) {
    const placementId = getRequiredPositional(parsed, 0, '<placement-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/marketplace/placements/${placementId}/${subcommand}`,
    });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace seller placements subcommand: ${subcommand}.`);
};

const handleSellerContentHistory = async (parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const path = buildQueryPath('/articles', {
    product_id: productId,
    track_scope: 'marketplace',
    status: getOption(parsed, 'status'),
    limit: parseIntegerOption(parsed, 'limit', { min: 1, max: 100 }),
    offset: parseIntegerOption(parsed, 'offset', { min: 0 }),
  });
  const response = await requestAgentApi(parsed, { method: 'GET', path });
  return response.payload;
};

const groupHelp = (guidance) =>
  cliSuccess(
    {
      usage: MARKETPLACE_HELP.trim(),
    },
    guidance,
  );

const handleSellerCommand = async (argv) => {
  const subcommand = argv[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
    return groupHelp(
      'Choose a seller subcommand: status, onboard, eligibility, settings, integrations, stripe, complete-onboarding, placements, earnings, content-history.',
    );
  }

  if (subcommand === 'status') return handleSellerStatus(parseArgs(argv.slice(1)));
  if (subcommand === 'onboard') return handleSellerOnboard(parseArgs(argv.slice(1)));
  if (subcommand === 'eligibility') return handleSellerEligibility(argv.slice(1));
  if (subcommand === 'settings') return handleSellerSettings(argv.slice(1));
  if (subcommand === 'integrations') return handleSellerIntegrations(argv.slice(1));
  if (subcommand === 'stripe') return handleSellerStripe(argv.slice(1));
  if (subcommand === 'placements') return handleSellerPlacements(argv.slice(1));
  if (subcommand === 'earnings') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/marketplace/seller/earnings`,
    });
    return response.payload;
  }
  if (subcommand === 'complete-onboarding') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/seller/complete-onboarding`,
    });
    return response.payload;
  }
  if (subcommand === 'content-history') return handleSellerContentHistory(parseArgs(argv.slice(1)));

  throw invalidUsage(`Unknown marketplace seller subcommand: ${subcommand}.`);
};

const handleNotifications = async (argv) => {
  const subcommand = argv[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
    return groupHelp('Choose a notifications subcommand: list or mark-read (both take --role seller|buyer).');
  }

  const parsed = parseArgs(argv.slice(1));

  if (subcommand === 'list') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const path = buildQueryPath(`/products/${productId}/marketplace/notifications`, {
      role: requireOption(parsed, 'role', 'seller|buyer'),
      type: getOption(parsed, 'type'),
      sort: getOption(parsed, 'sort'),
      page: parseIntegerOption(parsed, 'page', { min: 1 }),
      page_size: parseIntegerOption(parsed, 'page-size', { min: 1, max: 100 }),
    });
    const response = await requestAgentApi(parsed, { method: 'GET', path });
    return response.payload;
  }

  if (subcommand === 'mark-read') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const ids = splitList(getOptions(parsed, 'ids'));
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/products/${productId}/marketplace/notifications`,
      body: {
        role: requireOption(parsed, 'role', 'seller|buyer'),
        ...(ids.length > 0 ? { ids } : {}),
      },
    });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace notifications subcommand: ${subcommand}.`);
};

const handleBuyerTargetPages = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));

  if (subcommand === 'list') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/marketplace/buyer/target-pages`,
    });
    return response.payload;
  }

  if (subcommand === 'add') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const urls = splitList(getOptions(parsed, 'urls'));
    if (urls.length === 0) {
      throw invalidUsage('Missing required option: --urls <url1,url2,...>.');
    }
    const source = getOption(parsed, 'source');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/buyer/target-pages`,
      body: { urls, ...(source ? { source } : {}) },
    });
    return response.payload;
  }

  if (subcommand === 'discover') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const path = buildQueryPath(`/products/${productId}/marketplace/buyer/target-pages/discover`, {
      source_type: getOption(parsed, 'source'),
      source_url: getOption(parsed, 'source-url'),
    });
    const response = await requestAgentApi(parsed, { method: 'GET', path });
    return response.payload;
  }

  if (subcommand === 'pause' || subcommand === 'activate') {
    const targetPageId = getRequiredPositional(parsed, 0, '<target-page-id>');
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/marketplace/target-pages/${targetPageId}`,
      body: { status: subcommand === 'pause' ? 'paused' : 'active' },
    });
    return response.payload;
  }

  if (subcommand === 'delete') {
    const targetPageId = getRequiredPositional(parsed, 0, '<target-page-id>');
    const response = await requestAgentApi(parsed, {
      method: 'DELETE',
      path: `/marketplace/target-pages/${targetPageId}`,
    });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace buyer target-pages subcommand: ${subcommand}.`);
};

const handleBuyerPlacements = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));

  if (subcommand === 'list') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const path = buildQueryPath(`/products/${productId}/marketplace/buyer/placements`, {
      status: getOption(parsed, 'status'),
      search: getOption(parsed, 'search'),
      page: parseIntegerOption(parsed, 'page', { min: 1 }),
      page_size: parseIntegerOption(parsed, 'page-size', { min: 1, max: 100 }),
    });
    const response = await requestAgentApi(parsed, { method: 'GET', path });
    return response.payload;
  }

  if (subcommand === 'regenerate' || subcommand === 'revalidate') {
    const placementId = getRequiredPositional(parsed, 0, '<placement-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/marketplace/buyer-placements/${placementId}/${subcommand}`,
    });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace buyer placements subcommand: ${subcommand}.`);
};

const handleBuyerArticle = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const placementId = getRequiredPositional(parsed, 0, '<placement-id>');

  if (subcommand === 'get') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/marketplace/buyer-placements/${placementId}/article`,
    });
    return response.payload;
  }

  if (subcommand === 'edit') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/marketplace/buyer-placements/${placementId}/article`,
      body,
    });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace buyer article subcommand: ${subcommand}.`);
};

const handleBuyerCredits = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));

  if (subcommand === 'history') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const path = buildQueryPath(`/products/${productId}/marketplace/buyer/credits/history`, {
      kind: getOption(parsed, 'kind'),
      page: parseIntegerOption(parsed, 'page', { min: 1 }),
      page_size: parseIntegerOption(parsed, 'page-size', { min: 1, max: 100 }),
    });
    const response = await requestAgentApi(parsed, { method: 'GET', path });
    return response.payload;
  }

  throw invalidUsage(`Unknown marketplace buyer credits subcommand: ${subcommand}.`);
};

const handleBuyerCommand = async (argv) => {
  const subcommand = argv[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help') {
    return groupHelp(
      'Choose a buyer subcommand: status, billing-status, subscription, subscribe-quote, checkout, change-plan, target-pages, participation, placements, article, credits. Start with `marketplace buyer status <productId>` — its guidance drives the setup sequence.',
    );
  }

  if (subcommand === 'status') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/marketplace/buyer/status`,
    });
    return response.payload;
  }

  if (subcommand === 'billing-status') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/marketplace/buyer/billing-status`,
    });
    return response.payload;
  }

  if (subcommand === 'subscription') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/marketplace/buyer/subscription`,
    });
    return response.payload;
  }

  if (subcommand === 'subscribe-quote') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const path = buildQueryPath(`/products/${productId}/backlinks/subscribe-quote`, { plan: 'enterprise' });
    const response = await requestAgentApi(parsed, { method: 'GET', path });
    return response.payload;
  }

  if (subcommand === 'checkout') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/buyer/checkout`,
      body: { tier: requireOption(parsed, 'tier', '<tier>') },
    });
    return response.payload;
  }

  if (subcommand === 'change-plan') {
    const parsed = parseArgs(argv.slice(1));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const tier = getOption(parsed, 'tier');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/buyer/change-plan`,
      body: {
        action: requireOption(parsed, 'action', 'change_tier|cancel_scheduled|cancel_subscription|restore_subscription'),
        ...(tier ? { tier } : {}),
      },
    });
    return response.payload;
  }

  if (subcommand === 'participation') {
    const mode = argv[1];
    if (mode !== 'on' && mode !== 'off') {
      throw invalidUsage('marketplace buyer participation requires `on` or `off`.');
    }
    const parsed = parseArgs(argv.slice(2));
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/marketplace/buyer/participation`,
      body: { enabled: mode === 'on' },
    });
    return response.payload;
  }

  if (subcommand === 'target-pages') return handleBuyerTargetPages(argv.slice(1));
  if (subcommand === 'placements') return handleBuyerPlacements(argv.slice(1));
  if (subcommand === 'article') return handleBuyerArticle(argv.slice(1));
  if (subcommand === 'credits') return handleBuyerCredits(argv.slice(1));

  throw invalidUsage(`Unknown marketplace buyer subcommand: ${subcommand}.`);
};

export const handleMarketplaceCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: MARKETPLACE_HELP.trim(),
      },
      'Choose `seller`, `buyer`, or `notifications`. Sellers earn by hosting marketplace backlinks in their articles; buyers spend backlink credits to place links on high-authority articles. Start buyers with `marketplace buyer status` and sellers with `marketplace seller status`.',
    );
  }

  if (subcommand === 'seller') return handleSellerCommand(argv.slice(1));
  if (subcommand === 'buyer') return handleBuyerCommand(argv.slice(1));
  if (subcommand === 'notifications') return handleNotifications(argv.slice(1));

  throw invalidUsage(`Unknown marketplace subcommand: ${subcommand}.`);
};
