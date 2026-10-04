import {
  KEYWORDS_GENERATE_MAX_COUNT,
  KEYWORDS_GENERATE_MIN_COUNT,
  KEYWORDS_SUGGEST_MAX_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY,
  MIN_OFFSET,
  MIN_SEARCH_VOLUME,
  Surface,
} from '../core/constants.js';
import { MCP_USAGE_GUIDANCE, usageError } from '../core/errors.js';
import { int, json, list, object, oneOf, string, uuid } from '../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';

const KEYWORD_ITEMS_HINT =
  'Keyword texts, or objects { keyword, scheduled_for?, search_volume?, difficulty?, article_type?, ' +
  'article_subtype?, quality_questions? }.';
const STORED_KEYWORD_IDS_HINT = 'Stored keyword ids to promote onto the plan.';
const KEYWORDS_ADD_BODY = object().shape({
  items: list({ item: json() }).describe(KEYWORD_ITEMS_HINT),
  stored_keyword_ids: list({ item: uuid() }).describe(STORED_KEYWORD_IDS_HINT),
});

export const KEYWORDS_HELP = `Usage:
  outrank-cli keywords list --product <product-id> [--scope scheduled|stored|all] [--status published|scheduled|generating_article|pregenerated|disabled] [--q <text>] [--article-type <value>] [--article-subtype <value>] [--scheduled-from <date>] [--scheduled-to <date>] [--search-volume-min <n>] [--search-volume-max <n>] [--difficulty-min <n>] [--difficulty-max <n>] [--limit <n>] [--offset <n>]
  outrank-cli keywords get <keyword-id> [--kind scheduled|stored]
  outrank-cli keywords export --product <product-id>
  outrank-cli keywords generation-status --product <product-id>
  outrank-cli keywords add --product <product-id> --json <object>
  outrank-cli keywords update <keyword-id> --json <object>
  outrank-cli keywords suggest --product <product-id> (--keyword <text> | --theme <text>) [--keyword-region <code>] [--limit <n>]
  outrank-cli keywords generate --product <product-id> --count <n> [--source competitors|audiences|both] [--competitor <competitor-id> ...] [--audience <text> ...]
  outrank-cli keywords bulk-process --product <product-id> --json <object> [--keyword-region <code>]
  outrank-cli keywords bulk-reschedule --json <object>
  outrank-cli keywords delete <keyword-id>
  outrank-cli keywords bulk-delete --json <object>

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Examples:
  outrank-cli keywords list --product 00000000-0000-0000-0000-000000000000 --scope all
  outrank-cli keywords list --product 00000000-0000-0000-0000-000000000000 --scope scheduled --q "best seo tools"
  outrank-cli keywords export --product 00000000-0000-0000-0000-000000000000
  outrank-cli keywords generation-status --product 00000000-0000-0000-0000-000000000000
  outrank-cli keywords add --product 00000000-0000-0000-0000-000000000000 --json-file keywords.json
  outrank-cli keywords update 00000000-0000-0000-0000-000000000000 --json '{"instructions":"Write for beginners and include a step-by-step setup section"}'
  outrank-cli keywords update 00000000-0000-0000-0000-000000000000 --json '{"scheduled_for":"2026-05-20"}'
  outrank-cli keywords suggest --product 00000000-0000-0000-0000-000000000000 --theme "email marketing" --limit 8
  outrank-cli keywords generate --product 00000000-0000-0000-0000-000000000000 --count 10 --source both
  outrank-cli keywords generate --product 00000000-0000-0000-0000-000000000000 --count 5 --source competitors --competitor 11111111-1111-1111-1111-111111111111
  outrank-cli keywords bulk-process --product 00000000-0000-0000-0000-000000000000 --json '{"keywords":["keyword one","keyword two"]}'
  outrank-cli keywords bulk-reschedule --json-file keyword-reschedule.json
  outrank-cli keywords delete 00000000-0000-0000-0000-000000000000
`;

const GenerateSource = Object.freeze({ COMPETITORS: 'competitors', AUDIENCES: 'audiences', BOTH: 'both' });
const GENERATE_SOURCES = Object.values(GenerateSource);
const KEYWORD_PATH = '/keywords/{keywordId}';
const KEYWORD_ID_CLI = { positionals: ['keywordId'] };
const TOOLSETS = [Toolset.KEYWORDS];

const PRODUCT_REQUIRED = {
  guidance:
    'Pass the target product UUID with `--product <product-id>`. Use `outrank-cli products list` if you need to ' +
    'look it up first.',
};
const COUNT_REQUIRED = {
  guidance:
    'Ask the human how many keywords to generate first. The dashboard-equivalent flow allows 5-30 keywords when ' +
    'enough scheduler slots are free. Use `outrank-cli keywords generation-status --product <product-id>` to ' +
    'inspect current slot capacity.',
};
const SOURCE_GUIDANCE =
  'Choose a dashboard generation source with `--source competitors`, `--source audiences`, or `--source both`.';
const LEGACY_GENERATE_OPTION = {
  message: 'The generate command no longer accepts --theme or --country.',
  guidance:
    'Use `--count`, `--source`, repeated `--competitor`, and repeated `--audience` to match the dashboard ' +
    'Generate Keywords flow.',
};
const SUGGEST_TERM_GUIDANCE = 'Pass either `--keyword <text>` or `--theme <text>` when requesting keyword suggestions.';

const productOption = () => uuid().required(PRODUCT_REQUIRED);
const productCli = { options: { product: 'productId' }, placeholders: { productId: '<product-id>' } };

const listCommand = defineCommand({
  id: 'keywords.list',
  summary: 'List keywords for a product with optional filters and pagination.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: {
    productId: productOption(),
    scope: string(),
    status: string(),
    q: string(),
    articleType: string(),
    articleSubtype: string(),
    scheduledFrom: string(),
    scheduledTo: string(),
    searchVolumeMin: int({ min: MIN_SEARCH_VOLUME }),
    searchVolumeMax: int({ min: MIN_SEARCH_VOLUME }),
    difficultyMin: int({ min: MIN_DIFFICULTY, max: MAX_DIFFICULTY }),
    difficultyMax: int({ min: MIN_DIFFICULTY, max: MAX_DIFFICULTY }),
    limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
    offset: int({ min: MIN_OFFSET }),
  },
  cli: productCli,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: '/keywords',
      query: {
        product_id: input.productId,
        scope: input.scope,
        status: input.status,
        q: input.q,
        article_type: input.articleType,
        article_subtype: input.articleSubtype,
        scheduled_from: input.scheduledFrom,
        scheduled_to: input.scheduledTo,
        search_volume_min: input.searchVolumeMin,
        search_volume_max: input.searchVolumeMax,
        difficulty_min: input.difficultyMin,
        difficulty_max: input.difficultyMax,
        limit: input.limit,
        offset: input.offset,
      },
    }),
});

const getCommand = defineCommand({
  id: 'keywords.get',
  summary: 'Get one keyword by id.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { keywordId: uuid().required(), kind: string() },
  cli: KEYWORD_ID_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: KEYWORD_PATH,
      pathParams: { keywordId: input.keywordId },
      query: { kind: input.kind },
    }),
});

const exportCommand = defineCommand({
  id: 'keywords.export',
  summary: 'Export the keyword plan for a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { productId: productOption() },
  cli: productCli,
  run: (input, ctx) => ctx.http({ method: 'GET', path: '/keywords/export', query: { product_id: input.productId } }),
});

const generationStatusCommand = defineCommand({
  id: 'keywords.generation-status',
  summary: 'Show keyword generation status and scheduler slot capacity for a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { productId: productOption() },
  cli: productCli,
  run: (input, ctx) =>
    ctx.http({ method: 'GET', path: '/keywords/generation-status', query: { product_id: input.productId } }),
});

const addCommand = defineCommand({
  id: 'keywords.add',
  summary: 'Add a keyword to a product from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { productId: productOption() },
  cli: productCli,
  body: BodyMode.JSON,
  bodyField: KEYWORDS_ADD_BODY,
  bodyMerge: { product_id: 'productId' },
  run: (input, ctx) => ctx.http({ method: 'POST', path: '/keywords', body: input.body }),
});

const updateCommand = defineCommand({
  id: 'keywords.update',
  summary: 'Update a keyword (instructions, schedule, quality questions) from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { keywordId: uuid().required() },
  cli: KEYWORD_ID_CLI,
  body: BodyMode.JSON,
  run: (input, ctx) =>
    ctx.http({ method: 'PATCH', path: KEYWORD_PATH, pathParams: { keywordId: input.keywordId }, body: input.body }),
});

const suggestCommand = defineCommand({
  id: 'keywords.suggest',
  summary: 'Suggest keywords for a product from a seed keyword or a theme.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: {
    keyword: string(),
    theme: string(),
    productId: productOption(),
    keywordRegion: string(),
    limit: int({ min: LIST_MIN_LIMIT, max: KEYWORDS_SUGGEST_MAX_LIMIT }),
  },
  cli: productCli,
  refine: (input, ctx) => {
    if (input.keyword || input.theme) return;
    if (ctx.surface === Surface.MCP) {
      throw usageError('Missing required argument: keyword or theme.', MCP_USAGE_GUIDANCE);
    }
    throw usageError('Missing required option: --keyword <text> or --theme <text>.', SUGGEST_TERM_GUIDANCE);
  },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: '/keywords/suggest',
      body: {
        product_id: input.productId,
        ...(input.keyword ? { keyword: input.keyword } : {}),
        ...(input.theme ? { theme: input.theme } : {}),
        ...(input.keywordRegion ? { keyword_region: input.keywordRegion } : {}),
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
      },
    }),
});

const generateCommand = defineCommand({
  id: 'keywords.generate',
  summary: 'Generate keywords for a product from competitors and/or target audiences.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: {
    source: oneOf(GENERATE_SOURCES).default(GenerateSource.BOTH).guidance(SOURCE_GUIDANCE),
    count: int({ min: KEYWORDS_GENERATE_MIN_COUNT, max: KEYWORDS_GENERATE_MAX_COUNT }).required(COUNT_REQUIRED),
    competitors: list({ split: null }),
    audiences: list({ split: null }),
    productId: productOption(),
  },
  cli: {
    options: { product: 'productId', competitor: 'competitors', audience: 'audiences' },
    placeholders: { productId: '<product-id>', count: '<n>' },
    rejectedOptions: { theme: LEGACY_GENERATE_OPTION, country: LEGACY_GENERATE_OPTION },
  },
  longRunning: { pollTool: 'keywords.generation-status' },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: '/keywords/generate',
      body: {
        product_id: input.productId,
        keywords_count: input.count,
        filters: {
          isGenerateByCompetitors: input.source !== GenerateSource.AUDIENCES,
          isGenerateByAudiences: input.source !== GenerateSource.COMPETITORS,
          ...(input.competitors?.length ? { competitors: input.competitors } : {}),
          ...(input.audiences?.length ? { target_audiences: input.audiences } : {}),
        },
      },
    }),
});

const bulkProcessCommand = defineCommand({
  id: 'keywords.bulk-process',
  summary: 'Bulk-process a list of keywords for a product from a JSON body.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { productId: productOption(), keywordRegion: string() },
  cli: productCli,
  body: BodyMode.JSON,
  bodyMerge: { product_id: 'productId', keyword_region: 'keywordRegion' },
  run: (input, ctx) => ctx.http({ method: 'POST', path: '/keywords/bulk-process', body: input.body }),
});

const bulkRescheduleCommand = defineCommand({
  id: 'keywords.bulk-reschedule',
  summary: 'Reschedule several keywords from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  body: BodyMode.JSON,
  run: (input, ctx) => ctx.http({ method: 'POST', path: '/keywords/bulk-reschedule', body: input.body }),
});

const deleteCommand = defineCommand({
  id: 'keywords.delete',
  summary: 'Delete one keyword.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: { keywordId: uuid().required() },
  cli: KEYWORD_ID_CLI,
  run: (input, ctx) => ctx.http({ method: 'DELETE', path: KEYWORD_PATH, pathParams: { keywordId: input.keywordId } }),
});

const bulkDeleteCommand = defineCommand({
  id: 'keywords.bulk-delete',
  summary: 'Delete several keywords from a JSON body of ids.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  body: BodyMode.JSON,
  run: (input, ctx) => ctx.http({ method: 'POST', path: '/keywords/bulk-delete', body: input.body }),
});

export const keywordsGroup = defineGroup({
  id: 'keywords',
  help: {
    usage: KEYWORDS_HELP,
    guidance:
      'Choose one of: list, get, export, generation-status, add, update, suggest, generate, bulk-process, ' +
      'bulk-reschedule, delete, bulk-delete.',
  },
  unknown: (word) => ({
    message: `Unknown keywords subcommand: ${word}.`,
    guidance: 'Run `outrank-cli keywords --help` to see available keyword commands.',
  }),
  children: [
    listCommand,
    getCommand,
    exportCommand,
    generationStatusCommand,
    addCommand,
    updateCommand,
    suggestCommand,
    generateCommand,
    bulkProcessCommand,
    bulkRescheduleCommand,
    deleteCommand,
    bulkDeleteCommand,
  ],
});
