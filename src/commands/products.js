import { parseArgs, getRequiredPositional, readJsonInput, hasFlag, parseIntegerOption, getOption } from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

export const PRODUCTS_HELP = `Usage:
  outrank-cli products list [--status active|disabled] [--limit <n>] [--cursor <iso-timestamp>]
  outrank-cli products get <product-id>
  outrank-cli products create --json <object>
  outrank-cli products update <product-id> --json <object>
  outrank-cli products pause <product-id>
  outrank-cli products resume <product-id>
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

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Examples:
  outrank-cli products list --limit 20
  outrank-cli products create --json-file product.json
  outrank-cli products update 00000000-0000-0000-0000-000000000000 --json '{"daily_article_count":2}'
  outrank-cli products output-settings update 00000000-0000-0000-0000-000000000000 --json-file output-settings.json
  outrank-cli products target-audiences replace 00000000-0000-0000-0000-000000000000 --json-file target-audiences.json
  outrank-cli products competitors replace 00000000-0000-0000-0000-000000000000 --json-file competitors.json
  outrank-cli products gsc connect 00000000-0000-0000-0000-000000000000
  outrank-cli products gsc properties 00000000-0000-0000-0000-000000000000 --email owner@example.com
  outrank-cli products gsc performance 00000000-0000-0000-0000-000000000000 --months 3
  outrank-cli products gsc inspect-url 00000000-0000-0000-0000-000000000000 --url https://example.com/blog/post
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

const handleOutputSettings = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

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

export const handleProductsCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp = !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help';

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: PRODUCTS_HELP.trim(),
      },
      'Choose one of: list, get, create, update, pause, resume, output-settings, target-audiences, competitors, gsc.',
    );
  }

  if (subcommand === 'list') return handleProductsList(parsed);
  if (subcommand === 'get') return handleProductsGet(parsed);
  if (subcommand === 'create') return handleProductsCreate(parsed);
  if (subcommand === 'update') return handleProductsUpdate(parsed);
  if (subcommand === 'pause') return handleProductsPause(parsed);
  if (subcommand === 'resume') return handleProductsResume(parsed);
  if (subcommand === 'output-settings') return handleOutputSettings(argv.slice(1));
  if (subcommand === 'target-audiences') return handleTargetAudiences(argv.slice(1));
  if (subcommand === 'competitors') return handleCompetitors(argv.slice(1));
  if (subcommand === 'gsc') return handleGoogleSearchConsole(argv.slice(1));

  throw Object.assign(new Error(`Unknown products subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli products --help` to see available product commands.',
  });
};
