import { parseArgs, getRequiredPositional, readJsonInput, hasFlag, parseIntegerOption, getOption } from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

const BACKLINK_LIST_LIMIT_RANGE = {
  min: 1,
  max: 100,
};

export const PRODUCTS_HELP = `Usage:
  outrank-cli products list [--status active|disabled] [--limit <n>] [--cursor <iso-timestamp>]
  outrank-cli products get <product-id>
  outrank-cli products create --json <object>
  outrank-cli products update <product-id> --json <object>
  outrank-cli products pause <product-id>
  outrank-cli products resume <product-id>
  outrank-cli products integrations providers
  outrank-cli products integrations prepare <provider> <product-id> [--json <object>]
  outrank-cli products integrations connect <provider> <product-id> [--json <object>]
  outrank-cli products integrations poll <provider> <product-id> --attempt-id <attempt-id>
  outrank-cli products integrations notion databases <product-id> <integration-id>
  outrank-cli products integrations notion schema <product-id> <integration-id> <database-id>
  outrank-cli products integrations framer collections --json <object>
  outrank-cli products integrations framer fields --json <object>
  outrank-cli products integrations webflow sites --json <object>
  outrank-cli products integrations webflow collections --json <object>
  outrank-cli products integrations webflow fields --json <object>
  outrank-cli products integrations webflow items --json <object>
  outrank-cli products integrations validate <provider> --json <object>
  outrank-cli products integrations list <product-id>
  outrank-cli products integrations create <product-id> --json <object>
  outrank-cli products integrations get <product-id> <integration-id>
  outrank-cli products integrations update <product-id> <integration-id> --json <object>
  outrank-cli products integrations test <product-id> <integration-id>
  outrank-cli products integrations delete <product-id> <integration-id>
  outrank-cli products output-settings get <product-id>
  outrank-cli products output-settings update <product-id> --json <object>
  outrank-cli products target-audiences list <product-id>
  outrank-cli products target-audiences replace <product-id> --json <object>
  outrank-cli products competitors list <product-id>
  outrank-cli products competitors replace <product-id> --json <object>
  outrank-cli products gsc status <product-id>
  outrank-cli products gsc connect <product-id>
  outrank-cli products gsc poll <product-id> --attempt-id <attempt-id>
  outrank-cli products gsc reconnect <product-id>
  outrank-cli products gsc disconnect <product-id>
  outrank-cli products gsc accounts <product-id>
  outrank-cli products gsc properties <product-id> --email <email>
  outrank-cli products gsc set-property <product-id> --email <email> --site-url <url>
  outrank-cli products gsc performance <product-id> [--months <n>]
  outrank-cli products gsc search-analytics <product-id> [--dimensions <csv>] [--limit <n>] [--months <n>] [--start-date <yyyy-mm-dd>] [--end-date <yyyy-mm-dd>] [--page <text>] [--query <text>] [--country <cc>] [--device <device>]
  outrank-cli products gsc inspect-url <product-id> --url <url> [--language-code <code>]
  outrank-cli products gsc cannibalization <product-id>
  outrank-cli products linking sources get <product-id>
  outrank-cli products linking sources update <product-id> --json <object>
  outrank-cli products linking detect <product-id>
  outrank-cli products linking target-config get <product-id>
  outrank-cli products linking target-config update <product-id> --json <object>
  outrank-cli products linking targets list <product-id>
  outrank-cli products linking targets add-manual <product-id> --json <object>
  outrank-cli products linking targets upsert <product-id> --json <object>
  outrank-cli products linking targets clear-customizations <product-id> <target-id>
  outrank-cli products linking targets delete <product-id> <target-id>
  outrank-cli products backlinks get <product-id>
  outrank-cli products backlinks update <product-id> --json <object>
  outrank-cli products backlinks credits <product-id>
  outrank-cli products backlinks earned <product-id> [--limit <n>] [--cursor <iso>] [--status <status>] [--sort-by created_at|status|credits_applied] [--sort-order desc] [--include-article] [--include-summary]
  outrank-cli products backlinks unverified <product-id> [--limit <n>] [--cursor <iso>] [--status <status>] [--sort-by created_at|verification_error_reason] [--sort-order desc]
  outrank-cli products backlinks check-removal <product-id> <backlink-id>
  outrank-cli products backlinks reverify <product-id> <backlink-id>
  outrank-cli products backlinks subscription <product-id>
  outrank-cli products backlinks subscribe-quote <product-id> --plan premium|enterprise

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Examples:
  outrank-cli products list --limit 20
  outrank-cli products create --json-file product.json
  outrank-cli products update 00000000-0000-0000-0000-000000000000 --json '{"daily_article_count":2}'
  outrank-cli products integrations providers
  outrank-cli products integrations prepare wordpress-plugin 00000000-0000-0000-0000-000000000000
  outrank-cli products integrations connect wordpress-com 00000000-0000-0000-0000-000000000000 --json '{"name":"Main WordPress.com","publish_status":"publish"}'
  outrank-cli products integrations connect notion 00000000-0000-0000-0000-000000000000
  outrank-cli products integrations poll wordpress-com 00000000-0000-0000-0000-000000000000 --attempt-id <attempt-id>
  outrank-cli products integrations notion databases 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products integrations notion schema 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
  outrank-cli products integrations framer collections --json '{"project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key"}'
  outrank-cli products integrations framer fields --json '{"project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key","collection_id":"collection_id"}'
  outrank-cli products integrations webflow sites --json-file webflow-sites.json
  outrank-cli products integrations webflow collections --json '{"api_token":"wf_token","site_id":"site_id"}'
  outrank-cli products integrations webflow fields --json '{"api_token":"wf_token","collection_id":"collection_id"}'
  outrank-cli products integrations webflow items --json '{"api_token":"wf_token","collection_id":"collection_id"}'
  outrank-cli products integrations validate webhook --json '{"endpoint":"https://api.example.com/webhook","access_token":"secret"}'
  outrank-cli products integrations validate framer --json '{"project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key"}'
  outrank-cli products integrations validate webflow --json '{"api_token":"wf_token"}'
  outrank-cli products integrations validate shopify --json '{"access_token":"shpat_xxx"}'
  outrank-cli products integrations validate wix --json '{"site_id":"00000000-0000-0000-0000-000000000000","api_key":"wix_api_key"}'
  outrank-cli products integrations validate wordpress-plugin --json '{"domain":"https://example.com","api_key":"secret-token"}'
  outrank-cli products integrations list 00000000-0000-0000-0000-000000000000
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"webhook","name":"Main Webhook","endpoint":"https://api.example.com/webhook","access_token":"secret"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"framer","name":"Main Framer","project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key","author_name":"Outrank AI","publish_mode":"deploy","collection_setup_mode":"create"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"shopify","name":"Main Shopify","access_token":"shpat_xxx","blog_id":"123456789","author_name":"Outrank","publish_status":"publish"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"wix","name":"Main Wix","site_id":"00000000-0000-0000-0000-000000000000","api_key":"wix_api_key","publish_status":"publish"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json-file webflow-create.json
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"wordpress-plugin","domain":"https://example.com","api_key":"secret-token"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"nextjs-blog"}'
  outrank-cli products integrations get 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"endpoint":"https://api.example.com/webhook-v2"}'
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"blog_id":"987654321","author_name":"Editorial Team","publish_status":"draft"}'
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"publish_status":"draft"}'
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json-file webflow-update.json
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"domain":"https://example.com/blog","api_key":"new-secret-token"}'
  outrank-cli products integrations test 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products output-settings update 00000000-0000-0000-0000-000000000000 --json-file output-settings.json
  outrank-cli products target-audiences replace 00000000-0000-0000-0000-000000000000 --json-file target-audiences.json
  outrank-cli products competitors replace 00000000-0000-0000-0000-000000000000 --json-file competitors.json
  outrank-cli products gsc connect 00000000-0000-0000-0000-000000000000
  outrank-cli products gsc properties 00000000-0000-0000-0000-000000000000 --email owner@example.com
  outrank-cli products gsc performance 00000000-0000-0000-0000-000000000000 --months 3
  outrank-cli products gsc inspect-url 00000000-0000-0000-0000-000000000000 --url https://example.com/blog/post
  outrank-cli products linking sources get 00000000-0000-0000-0000-000000000000
  outrank-cli products linking sources update 00000000-0000-0000-0000-000000000000 --json-file linking-sources.json
  outrank-cli products linking detect 00000000-0000-0000-0000-000000000000
  outrank-cli products linking target-config update 00000000-0000-0000-0000-000000000000 --json '{"only_prioritized":true}'
  outrank-cli products linking targets add-manual 00000000-0000-0000-0000-000000000000 --json-file manual-target.json
  outrank-cli products linking targets clear-customizations 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products backlinks get 00000000-0000-0000-0000-000000000000
  outrank-cli products backlinks update 00000000-0000-0000-0000-000000000000 --json '{"enabled":true,"min_domain_rating":10}'
  outrank-cli products backlinks credits 00000000-0000-0000-0000-000000000000
  outrank-cli products backlinks earned 00000000-0000-0000-0000-000000000000 --limit 20 --include-article
  outrank-cli products backlinks unverified 00000000-0000-0000-0000-000000000000 --limit 20
  outrank-cli products backlinks check-removal 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products backlinks reverify 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products backlinks subscription 00000000-0000-0000-0000-000000000000
  outrank-cli products backlinks subscribe-quote 00000000-0000-0000-0000-000000000000 --plan premium
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

const handleProductsList = async (parsed) => {
  const path = buildQueryPath('/products', {
    status: getOption(parsed, 'status'),
    limit: parseIntegerOption(parsed, 'limit', { min: 1, max: 100 }),
    cursor: getOption(parsed, 'cursor'),
  });
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path,
  });
  return response.payload;
};

const handleProductsGet = async (parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path: `/products/${productId}`,
  });
  return response.payload;
};

const handleProductsCreate = async (parsed) => {
  const body = await readJsonInput(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/products',
    body,
  });
  return response.payload;
};

const handleProductsUpdate = async (parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const body = await readJsonInput(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'PATCH',
    path: `/products/${productId}`,
    body,
  });
  return response.payload;
};

const handleProductsPause = async (parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: `/products/${productId}/pause`,
  });
  return response.payload;
};

const handleProductsResume = async (parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: `/products/${productId}/resume`,
  });
  return response.payload;
};

const handleBacklinks = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: `Usage:
  outrank-cli products backlinks get <product-id>
  outrank-cli products backlinks update <product-id> --json <object>
  outrank-cli products backlinks credits <product-id>
  outrank-cli products backlinks earned <product-id> [--limit <n>] [--cursor <iso>] [--status <status>] [--sort-by created_at|status|credits_applied] [--sort-order desc] [--include-article] [--include-summary]
  outrank-cli products backlinks unverified <product-id> [--limit <n>] [--cursor <iso>] [--status <status>] [--sort-by created_at|verification_error_reason] [--sort-order desc]
  outrank-cli products backlinks check-removal <product-id> <backlink-id>
  outrank-cli products backlinks reverify <product-id> <backlink-id>
  outrank-cli products backlinks subscription <product-id>
  outrank-cli products backlinks subscribe-quote <product-id> --plan premium|enterprise`,
      },
      'Use `get` and `update` for product backlink settings, `credits` and `subscription` for status, `earned` and `unverified` for review queues, and the action commands for verification follow-up.',
    );
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const basePath = `/products/${productId}/backlinks`;

  if (subcommand === 'get') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: basePath,
    });
    return response.payload;
  }

  if (subcommand === 'update') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: basePath,
      body,
    });
    return response.payload;
  }

  if (subcommand === 'credits') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `${basePath}/credits`,
    });
    return response.payload;
  }

  if (subcommand === 'earned') {
    const path = buildQueryPath(`${basePath}/earned`, {
      limit: parseIntegerOption(parsed, 'limit', BACKLINK_LIST_LIMIT_RANGE),
      cursor: getOption(parsed, 'cursor'),
      status: getOption(parsed, 'status'),
      sort_by: getOption(parsed, 'sort-by'),
      sort_order: getOption(parsed, 'sort-order'),
      include_article: hasFlag(parsed, 'include-article') ? true : undefined,
      include_summary: hasFlag(parsed, 'include-summary') ? true : undefined,
    });
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path,
    });
    return response.payload;
  }

  if (subcommand === 'unverified') {
    const path = buildQueryPath(`${basePath}/unverified`, {
      limit: parseIntegerOption(parsed, 'limit', BACKLINK_LIST_LIMIT_RANGE),
      cursor: getOption(parsed, 'cursor'),
      status: getOption(parsed, 'status'),
      sort_by: getOption(parsed, 'sort-by'),
      sort_order: getOption(parsed, 'sort-order'),
    });
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path,
    });
    return response.payload;
  }

  if (subcommand === 'check-removal') {
    const backlinkId = getRequiredPositional(parsed, 1, '<backlink-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `${basePath}/${backlinkId}/check-removal`,
    });
    return response.payload;
  }

  if (subcommand === 'reverify') {
    const backlinkId = getRequiredPositional(parsed, 1, '<backlink-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `${basePath}/${backlinkId}/reverify`,
    });
    return response.payload;
  }

  if (subcommand === 'subscription') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `${basePath}/subscription`,
    });
    return response.payload;
  }

  if (subcommand === 'subscribe-quote') {
    const plan = getOption(parsed, 'plan');

    if (!plan) {
      throw Object.assign(new Error('Missing required option: --plan premium|enterprise.'), {
        cliCode: 'CLI_INVALID_USAGE',
        guidance:
          'Run `outrank-cli products backlinks subscribe-quote <product-id> --plan premium|enterprise` to inspect the dashboard-equivalent quote.',
      });
    }

    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: buildQueryPath(`${basePath}/subscribe-quote`, {
        plan,
      }),
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products backlinks subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli products backlinks --help` to see the available backlink commands.',
  });
};

const handleOutputSettings = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp = !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage:
          'Usage:\n  outrank-cli products output-settings get <product-id>\n  outrank-cli products output-settings update <product-id> --json <object>',
      },
      'Use `get` to inspect current article settings and `update` to patch them.',
    );
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');

  if (subcommand === 'get') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/output-settings`,
    });
    return response.payload;
  }

  if (subcommand === 'update') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/products/${productId}/output-settings`,
      body,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products output-settings subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance:
      'Run `outrank-cli products output-settings --help` to see the available output-settings commands.',
  });
};

const handleIntegrations = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand ||
    subcommand === '--help' ||
    subcommand === '-h' ||
    subcommand === 'help' ||
    ((subcommand !== 'notion' && subcommand !== 'webflow' && subcommand !== 'framer') && hasFlag(parsed, 'help'));

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: `Usage:
  outrank-cli products integrations providers
  outrank-cli products integrations prepare <provider> <product-id> [--json <object>]
  outrank-cli products integrations connect <provider> <product-id> [--json <object>]
  outrank-cli products integrations poll <provider> <product-id> --attempt-id <attempt-id>
  outrank-cli products integrations notion databases <product-id> <integration-id>
  outrank-cli products integrations notion schema <product-id> <integration-id> <database-id>
  outrank-cli products integrations framer collections --json <object>
  outrank-cli products integrations framer fields --json <object>
  outrank-cli products integrations webflow sites --json <object>
  outrank-cli products integrations webflow collections --json <object>
  outrank-cli products integrations webflow fields --json <object>
  outrank-cli products integrations webflow items --json <object>
  outrank-cli products integrations validate <provider> --json <object>
  outrank-cli products integrations list <product-id>
  outrank-cli products integrations create <product-id> --json <object>
  outrank-cli products integrations get <product-id> <integration-id>
  outrank-cli products integrations update <product-id> <integration-id> --json <object>
  outrank-cli products integrations test <product-id> <integration-id>
  outrank-cli products integrations delete <product-id> <integration-id>`,
      },
      'Use `providers` to inspect known provider availability, auth method, required connect/create fields, and provider notes. For WordPress Plugin, start with `prepare` to generate the integration token, then validate and create. For WordPress.com and Notion, use `connect`, have the human open the returned connect_url, then `poll` until the OAuth handoff completes. Notion exposes `notion databases` and `notion schema` discovery commands. Framer exposes `framer collections` and `framer fields` discovery for the newer Server API-based setup, not the older plugin flow. Webflow exposes `webflow sites`, `webflow collections`, `webflow fields`, and `webflow items` discovery before create or update. Shopify validation returns the resolved `shop_name` plus available blogs, so the human should only need to provide the access token before blog selection. Wix is a direct validate/create/update/test flow using `site_id`, `api_key`, and `publish_status`. Next.js Blog is a one-step create flow that returns a one-time API key in the response. V2 products are intended to keep one publishing integration; multiple rows usually indicate legacy cleanup work.',
    );
  }

  if (subcommand === 'providers') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: '/integration-providers',
    });
    return response.payload;
  }

  if (subcommand === 'prepare') {
    const provider = getRequiredPositional(parsed, 0, '<provider>');
    const productId = getRequiredPositional(parsed, 1, '<product-id>');
    const hasJsonInput =
      getOption(parsed, 'json') !== undefined ||
      getOption(parsed, 'json-file') !== undefined ||
      hasFlag(parsed, 'json-stdin');
    const body = hasJsonInput ? await readJsonInput(parsed) : undefined;
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/integrations/prepare/${provider}`,
      ...(body !== undefined ? { body } : {}),
    });
    return response.payload;
  }

  if (subcommand === 'connect') {
    const provider = getRequiredPositional(parsed, 0, '<provider>');
    const productId = getRequiredPositional(parsed, 1, '<product-id>');
    const hasJsonInput =
      getOption(parsed, 'json') !== undefined ||
      getOption(parsed, 'json-file') !== undefined ||
      hasFlag(parsed, 'json-stdin');
    const body = hasJsonInput ? await readJsonInput(parsed) : undefined;
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/integrations/connect/${provider}`,
      ...(body !== undefined ? { body } : {}),
    });
    return response.payload;
  }

  if (subcommand === 'poll') {
    const provider = getRequiredPositional(parsed, 0, '<provider>');
    const productId = getRequiredPositional(parsed, 1, '<product-id>');
    const attemptId = getOption(parsed, 'attempt-id');

    if (!attemptId) {
      throw Object.assign(new Error('Missing required option: --attempt-id <attempt-id>.'), {
        cliCode: 'CLI_INVALID_USAGE',
        guidance:
          'Run `outrank-cli products integrations poll <provider> <product-id> --attempt-id <attempt-id>` after connect starts.',
      });
    }

    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: buildQueryPath(`/products/${productId}/integrations/connect/${provider}`, {
        attempt_id: attemptId,
      }),
    });
    return response.payload;
  }

  if (subcommand === 'notion') {
    const notionSubcommand = argv[1];
    const notionParsed = parseArgs(argv.slice(2));

    if (!notionSubcommand || notionSubcommand === '--help' || notionSubcommand === '-h' || notionSubcommand === 'help') {
      return cliSuccess(
        {
          usage: `Usage:
  outrank-cli products integrations notion databases <product-id> <integration-id>
  outrank-cli products integrations notion schema <product-id> <integration-id> <database-id>`,
        },
        'Use `databases` after Notion OAuth completes to list accessible Notion databases, then use `schema` to inspect one database before PATCHing the saved integration row with name, database_id, and fields.',
      );
    }

    const productId = getRequiredPositional(notionParsed, 0, '<product-id>');
    const integrationId = getRequiredPositional(notionParsed, 1, '<integration-id>');

    if (notionSubcommand === 'databases') {
      const response = await requestAgentApi(notionParsed, {
        method: 'GET',
        path: `/products/${productId}/integrations/${integrationId}/notion/databases`,
      });
      return response.payload;
    }

    if (notionSubcommand === 'schema') {
      const databaseId = getRequiredPositional(notionParsed, 2, '<database-id>');
      const response = await requestAgentApi(notionParsed, {
        method: 'GET',
        path: `/products/${productId}/integrations/${integrationId}/notion/databases/${databaseId}/schema`,
      });
      return response.payload;
    }

    throw Object.assign(new Error(`Unknown products integrations notion subcommand: ${notionSubcommand}.`), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance:
        'Run `outrank-cli products integrations notion --help` to see the available Notion discovery commands.',
    });
  }

  if (subcommand === 'webflow') {
    const webflowSubcommand = argv[1];
    const webflowParsed = parseArgs(argv.slice(2));

    if (!webflowSubcommand || webflowSubcommand === '--help' || webflowSubcommand === '-h' || webflowSubcommand === 'help') {
      return cliSuccess(
        {
          usage: `Usage:
  outrank-cli products integrations webflow sites --json <object>
  outrank-cli products integrations webflow collections --json <object>
  outrank-cli products integrations webflow fields --json <object>
  outrank-cli products integrations webflow items --json <object>`,
        },
        'Use `sites` first to validate a Webflow token and list accessible sites, then `collections`, `fields`, and `items` to build the exact create or update payload for the chosen CMS collection.',
      );
    }

    const body = await readJsonInput(webflowParsed);
    const response = await requestAgentApi(webflowParsed, {
      method: 'POST',
      path: `/integration-providers/webflow/discover/${webflowSubcommand}`,
      body,
    });
    return response.payload;
  }

  if (subcommand === 'framer') {
    const framerSubcommand = argv[1];
    const framerParsed = parseArgs(argv.slice(2));

    if (!framerSubcommand || framerSubcommand === '--help' || framerSubcommand === '-h' || framerSubcommand === 'help') {
      return cliSuccess(
        {
          usage: `Usage:
  outrank-cli products integrations framer collections --json <object>
  outrank-cli products integrations framer fields --json <object>`,
        },
        'Use `collections` first with the Framer project URL and Server API key. Then use `fields` for one chosen collection if you want `collection_setup_mode: "existing"` instead of auto-creating a new collection.',
      );
    }

    const body = await readJsonInput(framerParsed);
    const response = await requestAgentApi(framerParsed, {
      method: 'POST',
      path: `/integration-providers/framer/discover/${framerSubcommand}`,
      body,
    });
    return response.payload;
  }

  if (subcommand === 'validate') {
    const provider = getRequiredPositional(parsed, 0, '<provider>');
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/integration-providers/${provider}/validate`,
      body,
    });
    return response.payload;
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');

  if (subcommand === 'list') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/integrations`,
    });
    return response.payload;
  }

  if (subcommand === 'create') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/integrations`,
      body,
    });
    return response.payload;
  }

  if (subcommand === 'get') {
    const integrationId = getRequiredPositional(parsed, 1, '<integration-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/integrations/${integrationId}`,
    });
    return response.payload;
  }

  if (subcommand === 'update') {
    const integrationId = getRequiredPositional(parsed, 1, '<integration-id>');
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/products/${productId}/integrations/${integrationId}`,
      body,
    });
    return response.payload;
  }

  if (subcommand === 'test') {
    const integrationId = getRequiredPositional(parsed, 1, '<integration-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/integrations/${integrationId}/test`,
    });
    return response.payload;
  }

  if (subcommand === 'delete') {
    const integrationId = getRequiredPositional(parsed, 1, '<integration-id>');
    const response = await requestAgentApi(parsed, {
      method: 'DELETE',
      path: `/products/${productId}/integrations/${integrationId}`,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products integrations subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance:
      'Run `outrank-cli products integrations --help` to see the available integration commands.',
  });
};

const handleCompetitors = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage:
          'Usage:\n  outrank-cli products competitors list <product-id>\n  outrank-cli products competitors replace <product-id> --json <object>',
      },
      'Use `list` to inspect the competitor list and `replace` to submit the full replacement set.',
    );
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');

  if (subcommand === 'list') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/competitors`,
    });
    return response.payload;
  }

  if (subcommand === 'replace') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PUT',
      path: `/products/${productId}/competitors`,
      body,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products competitors subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance:
      'Run `outrank-cli products competitors --help` to see the available competitor commands.',
  });
};

const handleTargetAudiences = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage:
          'Usage:\n  outrank-cli products target-audiences list <product-id>\n  outrank-cli products target-audiences replace <product-id> --json <object>',
      },
      'Use `list` to inspect the target-audience list and `replace` to submit the full replacement set.',
    );
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');

  if (subcommand === 'list') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/target-audiences`,
    });
    return response.payload;
  }

  if (subcommand === 'replace') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PUT',
      path: `/products/${productId}/target-audiences`,
      body,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products target-audiences subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance:
      'Run `outrank-cli products target-audiences --help` to see the available target-audience commands.',
  });
};

const handleGoogleSearchConsole = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: `Usage:
  outrank-cli products gsc status <product-id>
  outrank-cli products gsc connect <product-id>
  outrank-cli products gsc poll <product-id> --attempt-id <attempt-id>
  outrank-cli products gsc reconnect <product-id>
  outrank-cli products gsc disconnect <product-id>
  outrank-cli products gsc accounts <product-id>
  outrank-cli products gsc properties <product-id> --email <email>
  outrank-cli products gsc set-property <product-id> --email <email> --site-url <url>
  outrank-cli products gsc performance <product-id> [--months <n>]
  outrank-cli products gsc search-analytics <product-id> [--dimensions <csv>] [--limit <n>] [--months <n>] [--start-date <yyyy-mm-dd>] [--end-date <yyyy-mm-dd>] [--page <text>] [--query <text>] [--country <cc>] [--device <device>]
  outrank-cli products gsc inspect-url <product-id> --url <url> [--language-code <code>]
  outrank-cli products gsc cannibalization <product-id>`,
      },
      'Use connect plus poll for the OAuth handoff, then inspect accounts, properties, performance, indexing, and keyword data from the same subtree.',
    );
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const basePath = `/products/${productId}/gsc`;

  if (subcommand === 'status') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: basePath,
    });
    return response.payload;
  }

  if (subcommand === 'connect') {
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `${basePath}/connect`,
    });
    return response.payload;
  }

  if (subcommand === 'poll') {
    const attemptId = getOption(parsed, 'attempt-id');

    if (!attemptId) {
      throw Object.assign(new Error('Missing required option: --attempt-id <attempt-id>.'), {
        cliCode: 'CLI_INVALID_USAGE',
        guidance:
          'Run `outrank-cli products gsc poll <product-id> --attempt-id <attempt-id>` after connect starts.',
      });
    }

    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: buildQueryPath(`${basePath}/connect`, {
        attempt_id: attemptId,
      }),
    });
    return response.payload;
  }

  if (subcommand === 'reconnect') {
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `${basePath}/reconnect`,
    });
    return response.payload;
  }

  if (subcommand === 'disconnect') {
    const response = await requestAgentApi(parsed, {
      method: 'DELETE',
      path: basePath,
    });
    return response.payload;
  }

  if (subcommand === 'accounts') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `${basePath}/accounts`,
    });
    return response.payload;
  }

  if (subcommand === 'properties') {
    const email = getOption(parsed, 'email');

    if (!email) {
      throw Object.assign(new Error('Missing required option: --email <email>.'), {
        cliCode: 'CLI_INVALID_USAGE',
        guidance:
          'Run `outrank-cli products gsc properties <product-id> --email <email>` to list properties for a connected Google account.',
      });
    }

    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: buildQueryPath(`${basePath}/properties`, {
        email,
      }),
    });
    return response.payload;
  }

  if (subcommand === 'set-property') {
    const email = getOption(parsed, 'email');
    const siteUrl = getOption(parsed, 'site-url');

    if (!email || !siteUrl) {
      throw Object.assign(new Error('Missing required options: --email <email> and --site-url <url>.'), {
        cliCode: 'CLI_INVALID_USAGE',
        guidance:
          'Run `outrank-cli products gsc set-property <product-id> --email <email> --site-url <url>` to save the verified property.',
      });
    }

    const response = await requestAgentApi(parsed, {
      method: 'PUT',
      path: `${basePath}/property`,
      body: {
        email,
        site_url: siteUrl,
      },
    });
    return response.payload;
  }

  if (subcommand === 'performance') {
    const path = buildQueryPath(`${basePath}/performance`, {
      months: parseIntegerOption(parsed, 'months', { min: 1, max: 16 }),
    });
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path,
    });
    return response.payload;
  }

  if (subcommand === 'search-analytics') {
    const path = buildQueryPath(`${basePath}/search-analytics`, {
      dimensions: getOption(parsed, 'dimensions'),
      limit: parseIntegerOption(parsed, 'limit', { min: 1, max: 1000 }),
      months: parseIntegerOption(parsed, 'months', { min: 1, max: 16 }),
      start_date: getOption(parsed, 'start-date'),
      end_date: getOption(parsed, 'end-date'),
      page: getOption(parsed, 'page'),
      query: getOption(parsed, 'query'),
      country: getOption(parsed, 'country'),
      device: getOption(parsed, 'device'),
    });
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path,
    });
    return response.payload;
  }

  if (subcommand === 'inspect-url') {
    const url = getOption(parsed, 'url');

    if (!url) {
      throw Object.assign(new Error('Missing required option: --url <url>.'), {
        cliCode: 'CLI_INVALID_USAGE',
        guidance:
          'Run `outrank-cli products gsc inspect-url <product-id> --url <url>` to inspect indexing details for one page.',
      });
    }

    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `${basePath}/url-inspection`,
      body: {
        inspection_url: url,
        ...(getOption(parsed, 'language-code') ? { language_code: getOption(parsed, 'language-code') } : {}),
      },
    });
    return response.payload;
  }

  if (subcommand === 'cannibalization') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `${basePath}/cannibalization`,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products gsc subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance:
      'Run `outrank-cli products gsc --help` to see the available Google Search Console commands.',
  });
};

const handleLinkingSources = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage:
          'Usage:\n  outrank-cli products linking sources get <product-id>\n  outrank-cli products linking sources update <product-id> --json <object>',
      },
      'Use `get` to inspect current linking sources and `update` to change the primary or additional sources.',
    );
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');

  if (subcommand === 'get') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/linking/sources`,
    });
    return response.payload;
  }

  if (subcommand === 'update' || subcommand === 'set') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/products/${productId}/linking/sources`,
      body,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products linking sources subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli products linking sources --help` to see available linking-source commands.',
  });
};

const handleLinkingTargetConfig = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage:
          'Usage:\n  outrank-cli products linking target-config get <product-id>\n  outrank-cli products linking target-config update <product-id> --json <object>',
      },
      'Use `get` to inspect product-wide linking target behavior and `update` to change it.',
    );
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');

  if (subcommand === 'get') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/linking/target-config`,
    });
    return response.payload;
  }

  if (subcommand === 'update') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PUT',
      path: `/products/${productId}/linking/target-config`,
      body,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products linking target-config subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance:
      'Run `outrank-cli products linking target-config --help` to see available target-config commands.',
  });
};

const handleLinkingTargets = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: `Usage:
  outrank-cli products linking targets list <product-id>
  outrank-cli products linking targets add-manual <product-id> --json <object>
  outrank-cli products linking targets upsert <product-id> --json <object>
  outrank-cli products linking targets clear-customizations <product-id> <target-id>
  outrank-cli products linking targets delete <product-id> <target-id>`,
      },
      'Use `list` to inspect saved targets, `add-manual` or `upsert` to save URLs, and clear/delete for cleanup.',
    );
  }

  const productId = getRequiredPositional(parsed, 0, '<product-id>');

  if (subcommand === 'list') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/linking/targets`,
    });
    return response.payload;
  }

  if (subcommand === 'add-manual') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/linking/targets/manual`,
      body,
    });
    return response.payload;
  }

  if (subcommand === 'upsert') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/linking/targets/upsert`,
      body,
    });
    return response.payload;
  }

  if (subcommand === 'clear-customizations') {
    const targetId = getRequiredPositional(parsed, 1, '<target-id>');
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/products/${productId}/linking/targets/${targetId}`,
    });
    return response.payload;
  }

  if (subcommand === 'delete') {
    const targetId = getRequiredPositional(parsed, 1, '<target-id>');
    const response = await requestAgentApi(parsed, {
      method: 'DELETE',
      path: `/products/${productId}/linking/targets/${targetId}`,
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown products linking targets subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli products linking targets --help` to see available linking-target commands.',
  });
};

const handleLinking = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp = !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help';

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: `Usage:
  outrank-cli products linking sources get <product-id>
  outrank-cli products linking sources update <product-id> --json <object>
  outrank-cli products linking detect <product-id>
  outrank-cli products linking target-config get <product-id>
  outrank-cli products linking target-config update <product-id> --json <object>
  outrank-cli products linking targets list <product-id>
  outrank-cli products linking targets add-manual <product-id> --json <object>
  outrank-cli products linking targets upsert <product-id> --json <object>
  outrank-cli products linking targets clear-customizations <product-id> <target-id>
  outrank-cli products linking targets delete <product-id> <target-id>`,
      },
      'Use `sources` for source selection, `detect` for discovery, `targets` for saved URLs, and `target-config` for product-wide rules.',
    );
  }

  if (subcommand === 'sources') {
    return handleLinkingSources(argv.slice(1));
  }

  if (subcommand === 'detect') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/products/${productId}/linking/detect`,
    });
    return response.payload;
  }

  if (subcommand === 'target-config') {
    return handleLinkingTargetConfig(argv.slice(1));
  }

  if (subcommand === 'targets') {
    return handleLinkingTargets(argv.slice(1));
  }

  throw Object.assign(new Error(`Unknown products linking subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli products linking --help` to see available linking commands.',
  });
};

export const handleProductsCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp = !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help';

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: PRODUCTS_HELP.trim(),
      },
      'Choose one of: list, get, create, update, pause, resume, integrations, output-settings, target-audiences, competitors, gsc, linking, backlinks.',
    );
  }

  if (subcommand === 'list') return handleProductsList(parsed);
  if (subcommand === 'get') return handleProductsGet(parsed);
  if (subcommand === 'create') return handleProductsCreate(parsed);
  if (subcommand === 'update') return handleProductsUpdate(parsed);
  if (subcommand === 'pause') return handleProductsPause(parsed);
  if (subcommand === 'resume') return handleProductsResume(parsed);
  if (subcommand === 'integrations') return handleIntegrations(argv.slice(1));
  if (subcommand === 'output-settings') return handleOutputSettings(argv.slice(1));
  if (subcommand === 'target-audiences') return handleTargetAudiences(argv.slice(1));
  if (subcommand === 'competitors') return handleCompetitors(argv.slice(1));
  if (subcommand === 'gsc') return handleGoogleSearchConsole(argv.slice(1));
  if (subcommand === 'linking') return handleLinking(argv.slice(1));
  if (subcommand === 'backlinks') return handleBacklinks(argv.slice(1));

  throw Object.assign(new Error(`Unknown products subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli products --help` to see available product commands.',
  });
};
