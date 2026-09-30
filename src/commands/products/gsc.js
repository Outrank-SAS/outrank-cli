import {
  GSC_MAX_MONTHS,
  GSC_MIN_MONTHS,
  GSC_SEARCH_ANALYTICS_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../core/constants.js';
import { usageError } from '../../core/errors.js';
import { int, string } from '../../core/schema.js';
import { CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import { PRODUCT_CLI, productInput, productParams } from './shared.js';

const GSC_USAGE = `Usage:
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
  outrank-cli products gsc cannibalization <product-id>`;

const TOOLSETS = [Toolset.GSC];
const GSC_PATH = '/products/{productId}/gsc';
const ATTEMPT_ID_REQUIRED = {
  guidance: 'Run `outrank-cli products gsc poll <product-id> --attempt-id <attempt-id>` after connect starts.',
};
const EMAIL_REQUIRED = {
  guidance:
    'Run `outrank-cli products gsc properties <product-id> --email <email>` to list properties for a connected ' +
    'Google account.',
};
const SET_PROPERTY_GUIDANCE =
  'Run `outrank-cli products gsc set-property <product-id> --email <email> --site-url <url>` to save the ' +
  'verified property.';
const URL_REQUIRED = {
  guidance:
    'Run `outrank-cli products gsc inspect-url <product-id> --url <url>` to inspect indexing details for one page.',
};
const ATTEMPT_ID_PLACEHOLDERS = { attemptId: '<attempt-id>' };
const EMAIL_PLACEHOLDERS = { email: '<email>' };
const URL_PLACEHOLDERS = { url: '<url>' };

const simple = ({ id, summary, kind, method, suffix = '' }) =>
  defineCommand({
    id: `products.gsc.${id}`,
    summary,
    kind,
    toolsets: TOOLSETS,
    input: productInput(),
    cli: PRODUCT_CLI,
    run: (input, ctx) => ctx.http({ method, path: `${GSC_PATH}${suffix}`, pathParams: productParams(input) }),
  });

const status = simple({
  id: 'status',
  summary: 'Show the Google Search Console connection status of a product.',
  kind: CommandKind.READ,
  method: 'GET',
});
const connect = simple({
  id: 'connect',
  summary: 'Start the Google Search Console OAuth handoff and return the connect URL.',
  kind: CommandKind.WRITE,
  method: 'POST',
  suffix: '/connect',
});
const reconnect = simple({
  id: 'reconnect',
  summary: 'Restart the Google Search Console OAuth handoff for a product.',
  kind: CommandKind.WRITE,
  method: 'POST',
  suffix: '/reconnect',
});
const disconnect = simple({
  id: 'disconnect',
  summary: 'Disconnect Google Search Console from a product.',
  kind: CommandKind.DESTRUCTIVE,
  method: 'DELETE',
});
const accounts = simple({
  id: 'accounts',
  summary: 'List the connected Google accounts of a product.',
  kind: CommandKind.READ,
  method: 'GET',
  suffix: '/accounts',
});
const cannibalization = simple({
  id: 'cannibalization',
  summary: 'Report keyword cannibalization across the product pages.',
  kind: CommandKind.READ,
  method: 'GET',
  suffix: '/cannibalization',
});

const poll = defineCommand({
  id: 'products.gsc.poll',
  summary: 'Poll a Google Search Console connect attempt.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...productInput(), attemptId: string().required(ATTEMPT_ID_REQUIRED) },
  cli: { ...PRODUCT_CLI, placeholders: ATTEMPT_ID_PLACEHOLDERS },
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${GSC_PATH}/connect`,
      pathParams: productParams(input),
      query: { attempt_id: input.attemptId },
    }),
});

const properties = defineCommand({
  id: 'products.gsc.properties',
  summary: 'List the Search Console properties of a connected Google account.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...productInput(), email: string().required(EMAIL_REQUIRED) },
  cli: { ...PRODUCT_CLI, placeholders: EMAIL_PLACEHOLDERS },
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${GSC_PATH}/properties`,
      pathParams: productParams(input),
      query: { email: input.email },
    }),
});

const setProperty = defineCommand({
  id: 'products.gsc.set-property',
  summary: 'Save the verified Search Console property for a product.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...productInput(), email: string(), siteUrl: string() },
  cli: PRODUCT_CLI,
  refine: (input) => {
    if (!input.email || !input.siteUrl) {
      throw usageError('Missing required options: --email <email> and --site-url <url>.', SET_PROPERTY_GUIDANCE);
    }
  },
  run: (input, ctx) =>
    ctx.http({
      method: 'PUT',
      path: `${GSC_PATH}/property`,
      pathParams: productParams(input),
      body: { email: input.email, site_url: input.siteUrl },
    }),
});

const performance = defineCommand({
  id: 'products.gsc.performance',
  summary: 'Show Search Console performance for the last months.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...productInput(), months: int({ min: GSC_MIN_MONTHS, max: GSC_MAX_MONTHS }) },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${GSC_PATH}/performance`,
      pathParams: productParams(input),
      query: { months: input.months },
    }),
});

const searchAnalytics = defineCommand({
  id: 'products.gsc.search-analytics',
  summary: 'Query Search Console search analytics with dimensions and filters.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: {
    ...productInput(),
    dimensions: string(),
    limit: int({ min: LIST_MIN_LIMIT, max: GSC_SEARCH_ANALYTICS_MAX_LIMIT }),
    months: int({ min: GSC_MIN_MONTHS, max: GSC_MAX_MONTHS }),
    startDate: string(),
    endDate: string(),
    page: string(),
    query: string(),
    country: string(),
    device: string(),
  },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${GSC_PATH}/search-analytics`,
      pathParams: productParams(input),
      query: {
        dimensions: input.dimensions,
        limit: input.limit,
        months: input.months,
        start_date: input.startDate,
        end_date: input.endDate,
        page: input.page,
        query: input.query,
        country: input.country,
        device: input.device,
      },
    }),
});

const inspectUrl = defineCommand({
  id: 'products.gsc.inspect-url',
  summary: 'Inspect the indexing status of one URL.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...productInput(), url: string().required(URL_REQUIRED), languageCode: string() },
  cli: { ...PRODUCT_CLI, placeholders: URL_PLACEHOLDERS },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${GSC_PATH}/url-inspection`,
      pathParams: productParams(input),
      body: { inspection_url: input.url, ...(input.languageCode ? { language_code: input.languageCode } : {}) },
    }),
});

export const gscGroup = defineGroup({
  id: 'products.gsc',
  help: {
    usage: GSC_USAGE,
    guidance:
      'Use connect plus poll for the OAuth handoff, then inspect accounts, properties, performance, indexing, ' +
      'and keyword data from the same subtree.',
  },
  unknown: (word) => ({
    message: `Unknown products gsc subcommand: ${word}.`,
    guidance: 'Run `outrank-cli products gsc --help` to see the available Google Search Console commands.',
  }),
  children: [
    status,
    connect,
    poll,
    reconnect,
    disconnect,
    accounts,
    properties,
    setProperty,
    performance,
    searchAnalytics,
    inspectUrl,
    cannibalization,
  ],
});
