import {
  parseArgs,
  getRequiredPositional,
  readJsonInput,
  hasFlag,
  parseIntegerOption,
  getOption,
} from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

export const KEYWORDS_HELP = `Usage:
  outrank-cli keywords list --product <product-id> [--scope scheduled|stored|all] [--status published|scheduled|generating_article|pregenerated|disabled] [--q <text>] [--article-type <value>] [--article-subtype <value>] [--scheduled-from <date>] [--scheduled-to <date>] [--search-volume-min <n>] [--search-volume-max <n>] [--difficulty-min <n>] [--difficulty-max <n>] [--limit <n>] [--offset <n>]
  outrank-cli keywords get <keyword-id> [--kind scheduled|stored]
  outrank-cli keywords export --product <product-id>
  outrank-cli keywords generation-status --product <product-id>
  outrank-cli keywords add --product <product-id> --json <object>
  outrank-cli keywords suggest --product <product-id> (--keyword <text> | --theme <text>) [--keyword-region <code>] [--limit <n>]
  outrank-cli keywords generate --product <product-id> [--theme <text>] [--country <country-or-code>] [--count <n>]
  outrank-cli keywords reschedule <keyword-id> --scheduled-for <date>
  outrank-cli keywords bulk-reschedule --json <object>
  outrank-cli keywords delete <keyword-id>
  outrank-cli keywords bulk-delete --json <object>

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Examples:
  outrank-cli keywords list --product 00000000-0000-0000-0000-000000000000 --scope all
  outrank-cli keywords export --product 00000000-0000-0000-0000-000000000000
  outrank-cli keywords generation-status --product 00000000-0000-0000-0000-000000000000
  outrank-cli keywords add --product 00000000-0000-0000-0000-000000000000 --json-file keywords.json
  outrank-cli keywords suggest --product 00000000-0000-0000-0000-000000000000 --theme "email marketing" --limit 8
  outrank-cli keywords generate --product 00000000-0000-0000-0000-000000000000 --theme "lead generation" --count 5
  outrank-cli keywords reschedule 00000000-0000-0000-0000-000000000000 --scheduled-for 2026-05-20
  outrank-cli keywords bulk-reschedule --json-file keyword-reschedule.json
  outrank-cli keywords delete 00000000-0000-0000-0000-000000000000
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

const getRequiredProductOption = (parsed) => {
  const productId = getOption(parsed, 'product');
  if (!productId) {
    throw Object.assign(new Error('Missing required option: --product <product-id>.'), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance: 'Pass the target product UUID with `--product <product-id>`. Use `outrank-cli products list` if you need to look it up first.',
    });
  }
  return productId;
};

const handleKeywordsList = async (parsed) => {
  const path = buildQueryPath('/keywords', {
    product_id: getRequiredProductOption(parsed),
    scope: getOption(parsed, 'scope'),
    status: getOption(parsed, 'status'),
    q: getOption(parsed, 'q'),
    article_type: getOption(parsed, 'article-type'),
    article_subtype: getOption(parsed, 'article-subtype'),
    scheduled_from: getOption(parsed, 'scheduled-from'),
    scheduled_to: getOption(parsed, 'scheduled-to'),
    search_volume_min: parseIntegerOption(parsed, 'search-volume-min', { min: 0 }),
    search_volume_max: parseIntegerOption(parsed, 'search-volume-max', { min: 0 }),
    difficulty_min: parseIntegerOption(parsed, 'difficulty-min', { min: 0, max: 100 }),
    difficulty_max: parseIntegerOption(parsed, 'difficulty-max', { min: 0, max: 100 }),
    limit: parseIntegerOption(parsed, 'limit', { min: 1, max: 100 }),
    offset: parseIntegerOption(parsed, 'offset', { min: 0 }),
  });
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path,
  });
  return response.payload;
};

const handleKeywordsGet = async (parsed) => {
  const keywordId = getRequiredPositional(parsed, 0, '<keyword-id>');
  const path = buildQueryPath(`/keywords/${keywordId}`, {
    kind: getOption(parsed, 'kind'),
  });
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path,
  });
  return response.payload;
};

const handleKeywordsExport = async (parsed) => {
  const path = buildQueryPath('/keywords/export', {
    product_id: getRequiredProductOption(parsed),
  });
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path,
  });
  return response.payload;
};

const handleKeywordsGenerationStatus = async (parsed) => {
  const path = buildQueryPath('/keywords/generation-status', {
    product_id: getRequiredProductOption(parsed),
  });
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path,
  });
  return response.payload;
};

const handleKeywordsAdd = async (parsed) => {
  const body = await readJsonInput(parsed);
  body.product_id = getRequiredProductOption(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/keywords',
    body,
  });
  return response.payload;
};

const handleKeywordsSuggest = async (parsed) => {
  const keyword = getOption(parsed, 'keyword');
  const theme = getOption(parsed, 'theme');
  if (!keyword && !theme) {
    throw Object.assign(new Error('Missing required option: --keyword <text> or --theme <text>.'), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance: 'Pass either `--keyword <text>` or `--theme <text>` when requesting keyword suggestions.',
    });
  }

  const body = {
    product_id: getRequiredProductOption(parsed),
    ...(keyword ? { keyword } : {}),
    ...(theme ? { theme } : {}),
    ...(getOption(parsed, 'keyword-region') ? { keyword_region: getOption(parsed, 'keyword-region') } : {}),
    ...(parseIntegerOption(parsed, 'limit', { min: 1, max: 20 }) !== undefined
      ? { limit: parseIntegerOption(parsed, 'limit', { min: 1, max: 20 }) }
      : {}),
  };

  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/keywords/suggest',
    body,
  });
  return response.payload;
};

const handleKeywordsGenerate = async (parsed) => {
  const body = {
    product_id: getRequiredProductOption(parsed),
    ...(getOption(parsed, 'theme') ? { keyword_theme: getOption(parsed, 'theme') } : {}),
    ...(getOption(parsed, 'country') ? { country: getOption(parsed, 'country') } : {}),
    ...(parseIntegerOption(parsed, 'count', { min: 1, max: 10 }) !== undefined
      ? { count: parseIntegerOption(parsed, 'count', { min: 1, max: 10 }) }
      : {}),
  };

  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/keywords/generate',
    body,
  });
  return response.payload;
};

const handleKeywordsReschedule = async (parsed) => {
  const keywordId = getRequiredPositional(parsed, 0, '<keyword-id>');
  const scheduledFor = getOption(parsed, 'scheduled-for');
  if (!scheduledFor) {
    throw Object.assign(new Error('Missing required option: --scheduled-for <date>.'), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance: 'Pass the target schedule date with `--scheduled-for YYYY-MM-DD` or an ISO timestamp.',
    });
  }

  const response = await requestAgentApi(parsed, {
    method: 'PATCH',
    path: `/keywords/${keywordId}`,
    body: {
      scheduled_for: scheduledFor,
    },
  });
  return response.payload;
};

const handleKeywordsBulkReschedule = async (parsed) => {
  const body = await readJsonInput(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/keywords/bulk-reschedule',
    body,
  });
  return response.payload;
};

const handleKeywordsDelete = async (parsed) => {
  const keywordId = getRequiredPositional(parsed, 0, '<keyword-id>');
  const response = await requestAgentApi(parsed, {
    method: 'DELETE',
    path: `/keywords/${keywordId}`,
  });
  return response.payload;
};

const handleKeywordsBulkDelete = async (parsed) => {
  const body = await readJsonInput(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/keywords/bulk-delete',
    body,
  });
  return response.payload;
};

export const handleKeywordsCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp = !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: KEYWORDS_HELP.trim(),
      },
      'Choose one of: list, get, export, generation-status, add, suggest, generate, reschedule, bulk-reschedule, delete, bulk-delete.',
    );
  }

  if (subcommand === 'list') return handleKeywordsList(parsed);
  if (subcommand === 'get') return handleKeywordsGet(parsed);
  if (subcommand === 'export') return handleKeywordsExport(parsed);
  if (subcommand === 'generation-status') return handleKeywordsGenerationStatus(parsed);
  if (subcommand === 'add') return handleKeywordsAdd(parsed);
  if (subcommand === 'suggest') return handleKeywordsSuggest(parsed);
  if (subcommand === 'generate') return handleKeywordsGenerate(parsed);
  if (subcommand === 'reschedule') return handleKeywordsReschedule(parsed);
  if (subcommand === 'bulk-reschedule') return handleKeywordsBulkReschedule(parsed);
  if (subcommand === 'delete') return handleKeywordsDelete(parsed);
  if (subcommand === 'bulk-delete') return handleKeywordsBulkDelete(parsed);

  throw Object.assign(new Error(`Unknown keywords subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli keywords --help` to see available keyword commands.',
  });
};
