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

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Examples:
  outrank-cli products list --limit 20
  outrank-cli products create --json-file product.json
  outrank-cli products update 00000000-0000-0000-0000-000000000000 --json '{"daily_article_count":2}'
  outrank-cli products output-settings update 00000000-0000-0000-0000-000000000000 --json-file output-settings.json
  outrank-cli products target-audiences replace 00000000-0000-0000-0000-000000000000 --json-file target-audiences.json
  outrank-cli products competitors replace 00000000-0000-0000-0000-000000000000 --json-file competitors.json
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

export const handleProductsCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp = !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help';

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: PRODUCTS_HELP.trim(),
      },
      'Choose one of: list, get, create, update, pause, resume, output-settings, target-audiences, competitors.',
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

  throw Object.assign(new Error(`Unknown products subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli products --help` to see available product commands.',
  });
};
