import { LIST_MAX_LIMIT, LIST_MIN_LIMIT } from '../../core/constants.js';
import { bool, int, oneOf, string, uuid } from '../../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import { PRODUCT_CLI, productInput, productParams, withProduct } from './shared.js';

const BACKLINKS_USAGE = `Usage:
  outrank-cli products backlinks get <product-id>
  outrank-cli products backlinks update <product-id> --json <object>
  outrank-cli products backlinks credits <product-id>
  outrank-cli products backlinks earned <product-id> [--limit <n>] [--cursor <iso>] [--status <status>] [--sort-by created_at|status|credits_applied] [--sort-order desc] [--include-article] [--include-summary]
  outrank-cli products backlinks unverified <product-id> [--limit <n>] [--cursor <iso>] [--status <status>] [--sort-by created_at|verification_error_reason] [--sort-order desc]
  outrank-cli products backlinks check-removal <product-id> <backlink-id>
  outrank-cli products backlinks reverify <product-id> <backlink-id>
  outrank-cli products backlinks subscription <product-id>
  outrank-cli products backlinks subscribe-quote <product-id> --plan premium|enterprise`;

const TOOLSETS = [Toolset.BACKLINKS];
const BACKLINKS_PATH = '/products/{productId}/backlinks';
const BACKLINK_PATH = `${BACKLINKS_PATH}/{backlinkId}`;
const BACKLINK_CLI = withProduct(['backlinkId']);
const BACKLINK_PLANS = Object.freeze(['premium', 'enterprise']);
const PLAN_PLACEHOLDERS = { plan: BACKLINK_PLANS.join('|') };
const PLAN_REQUIRED = {
  guidance:
    'Run `outrank-cli products backlinks subscribe-quote <product-id> --plan premium|enterprise` to inspect the ' +
    'dashboard-equivalent quote.',
};

const backlinkInput = () => ({ ...productInput(), backlinkId: uuid().required() });
const backlinkParams = (input) => ({ productId: input.productId, backlinkId: input.backlinkId });

const listInput = () => ({
  ...productInput(),
  limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
  cursor: string(),
  status: string(),
  sortBy: string(),
  sortOrder: string(),
});
const listQuery = (input) => ({
  limit: input.limit,
  cursor: input.cursor,
  status: input.status,
  sort_by: input.sortBy,
  sort_order: input.sortOrder,
});

const get = defineCommand({
  id: 'products.backlinks.get',
  summary: 'Get the backlink exchange settings of a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) => ctx.http({ method: 'GET', path: BACKLINKS_PATH, pathParams: productParams(input) }),
});

const update = defineCommand({
  id: 'products.backlinks.update',
  summary: 'Update the backlink exchange settings of a product from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  body: BodyMode.JSON,
  run: (input, ctx) =>
    ctx.http({ method: 'PATCH', path: BACKLINKS_PATH, pathParams: productParams(input), body: input.body }),
});

const credits = defineCommand({
  id: 'products.backlinks.credits',
  summary: 'Show the backlink credit balance of a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) => ctx.http({ method: 'GET', path: `${BACKLINKS_PATH}/credits`, pathParams: productParams(input) }),
});

const earned = defineCommand({
  id: 'products.backlinks.earned',
  summary: 'List earned backlinks with optional article and summary details.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...listInput(), includeArticle: bool(), includeSummary: bool() },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BACKLINKS_PATH}/earned`,
      pathParams: productParams(input),
      query: {
        ...listQuery(input),
        include_article: input.includeArticle ? true : undefined,
        include_summary: input.includeSummary ? true : undefined,
      },
    }),
});

const unverified = defineCommand({
  id: 'products.backlinks.unverified',
  summary: 'List backlinks that failed verification.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: listInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BACKLINKS_PATH}/unverified`,
      pathParams: productParams(input),
      query: listQuery(input),
    }),
});

const backlinkAction = ({ id, summary, suffix }) =>
  defineCommand({
    id: `products.backlinks.${id}`,
    summary,
    kind: CommandKind.WRITE,
    toolsets: TOOLSETS,
    input: backlinkInput(),
    cli: BACKLINK_CLI,
    run: (input, ctx) =>
      ctx.http({ method: 'POST', path: `${BACKLINK_PATH}/${suffix}`, pathParams: backlinkParams(input) }),
  });

const checkRemoval = backlinkAction({
  id: 'check-removal',
  summary: 'Check whether an earned backlink was removed.',
  suffix: 'check-removal',
});
const reverify = backlinkAction({
  id: 'reverify',
  summary: 'Re-run verification for one backlink.',
  suffix: 'reverify',
});

const subscription = defineCommand({
  id: 'products.backlinks.subscription',
  summary: 'Show the backlink plan subscription of a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  entryPoint: true,
  run: (input, ctx) =>
    ctx.http({ method: 'GET', path: `${BACKLINKS_PATH}/subscription`, pathParams: productParams(input) }),
});

const subscribeQuote = defineCommand({
  id: 'products.backlinks.subscribe-quote',
  summary: 'Quote a backlink plan subscription for a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...productInput(), plan: oneOf(BACKLINK_PLANS).required(PLAN_REQUIRED) },
  cli: { ...PRODUCT_CLI, placeholders: PLAN_PLACEHOLDERS },
  entryPoint: true,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BACKLINKS_PATH}/subscribe-quote`,
      pathParams: productParams(input),
      query: { plan: input.plan },
    }),
});

export const backlinksGroup = defineGroup({
  id: 'products.backlinks',
  help: {
    usage: BACKLINKS_USAGE,
    guidance:
      'Use `get` and `update` for product backlink settings, `credits` and `subscription` for status, `earned` and ' +
      '`unverified` for review queues, and the action commands for verification follow-up.',
  },
  unknown: (word) => ({
    message: `Unknown products backlinks subcommand: ${word}.`,
    guidance: 'Run `outrank-cli products backlinks --help` to see the available backlink commands.',
  }),
  children: [get, update, credits, earned, unverified, checkRemoval, reverify, subscription, subscribeQuote],
});
