import { LIST_MAX_LIMIT, LIST_MIN_LIMIT } from '../../core/constants.js';
import { bool, int, list, object, string } from '../../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import { PRODUCT_CLI, productInput, productParams } from './shared.js';

const TOOLSETS = [Toolset.CORE];
const PRODUCT_PATH = '/products/{productId}';
const PRODUCT_NAME_HINT = '2-50 characters.';
const PRODUCT_DESCRIPTION_HINT = '50-8000 characters.';
const TARGET_AUDIENCES_HINT = '3-7 audience texts of at most 200 characters each; replaces the list.';
const HTTP_URL_HINT = 'http(s) URL.';
const SITEMAP_URL_HINT = 'http(s) URL ending in .xml.';
const EXAMPLE_ARTICLE_URLS_HINT = 'At most 3 http(s) URLs.';
const KEYWORD_REGION_HINT = 'Country code such as us, uk or global-us.';
const COMPETITORS_HINT = '3-7 competitors.';

const PRODUCT_CREATE_REQUIRED = {
  guidance:
    'Creating a product needs every field: name, url, description, target_audiences (3-7), language, ' +
    'keyword_region and competitors (3-7 of { name, link }). Agree them with the user, then call again.',
};
const COMPETITOR_REQUIRED = { guidance: 'Each competitor needs a name and a link.' };

const competitorShape = () =>
  object().shape({
    name: string().required(COMPETITOR_REQUIRED),
    link: string().required(COMPETITOR_REQUIRED).describe(HTTP_URL_HINT),
  });

const PRODUCT_CREATE_BODY = object().shape({
  name: string().required(PRODUCT_CREATE_REQUIRED).describe(PRODUCT_NAME_HINT),
  url: string().required(PRODUCT_CREATE_REQUIRED).describe(HTTP_URL_HINT),
  description: string().required(PRODUCT_CREATE_REQUIRED).describe(PRODUCT_DESCRIPTION_HINT),
  target_audiences: list().required(PRODUCT_CREATE_REQUIRED).describe(TARGET_AUDIENCES_HINT),
  language: string().required(PRODUCT_CREATE_REQUIRED),
  keyword_region: string().required(PRODUCT_CREATE_REQUIRED).describe(KEYWORD_REGION_HINT),
  competitors: list({ item: competitorShape() }).required(PRODUCT_CREATE_REQUIRED).describe(COMPETITORS_HINT),
});

const PRODUCT_UPDATE_BODY = object().shape({
  name: string().describe(PRODUCT_NAME_HINT),
  description: string().describe(PRODUCT_DESCRIPTION_HINT),
  target_audiences: list().describe(TARGET_AUDIENCES_HINT),
  sitemap_url: string().describe(SITEMAP_URL_HINT),
  blog_root_url: string().describe(HTTP_URL_HINT),
  example_article_urls: list().describe(EXAMPLE_ARTICLE_URLS_HINT),
  auto_keyword_generation_disabled: bool(),
});

const OUTPUT_SETTINGS_OPTION_HINT = 'Allowed values are in products_output_settings_get data._meta.';
const OUTPUT_SETTINGS_INTERNAL_LINKS_MIN = 0;
const OUTPUT_SETTINGS_INTERNAL_LINKS_MAX = 5;
const BRAND_COLOR_HINT = '6-digit hex color such as #1A2B3C.';
const GLOBAL_ARTICLE_PROMPT_HINT = 'At most 10000 characters; null clears it.';
const GLOBAL_KEYWORD_PROMPT_HINT = 'At most 2000 characters; null clears it.';

const OUTPUT_SETTINGS_UPDATE_BODY = object().shape({
  language: string(),
  keyword_region: string().describe(KEYWORD_REGION_HINT),
  tone_and_style: string().describe(OUTPUT_SETTINGS_OPTION_HINT),
  image_style: string().describe(OUTPUT_SETTINGS_OPTION_HINT),
  featured_image_style: string().describe(OUTPUT_SETTINGS_OPTION_HINT),
  global_article_prompt: string().nullable().describe(GLOBAL_ARTICLE_PROMPT_HINT),
  global_keyword_prompt: string().nullable().describe(GLOBAL_KEYWORD_PROMPT_HINT),
  outline: string().nullable(),
  outrank_prompt: string().nullable(),
  not_included_words: string().nullable(),
  internal_links: int({ min: OUTPUT_SETTINGS_INTERNAL_LINKS_MIN, max: OUTPUT_SETTINGS_INTERNAL_LINKS_MAX }),
  brand_color: string().describe(BRAND_COLOR_HINT),
  auto_publish: bool(),
  table_of_contents: bool(),
  is_cta_included: bool(),
  is_video_included: bool(),
  mention_similar_products: bool(),
  is_infographics_enabled: bool(),
  is_first_person_enabled: bool(),
  are_in_article_emojis_disabled: bool(),
  use_different_featured_style: bool(),
});

export const productsList = defineCommand({
  id: 'products.list',
  summary: 'List products with optional status filter and cursor pagination.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { status: string(), limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }), cursor: string() },
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: '/products',
      query: { status: input.status, limit: input.limit, cursor: input.cursor },
    }),
});

export const productsGet = defineCommand({
  id: 'products.get',
  summary: 'Get one product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) => ctx.http({ method: 'GET', path: PRODUCT_PATH, pathParams: productParams(input) }),
});

export const productsCreate = defineCommand({
  id: 'products.create',
  summary: 'Create a product from a JSON body. The server queues an initial keyword plan.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  body: BodyMode.JSON,
  bodyField: PRODUCT_CREATE_BODY,
  run: (input, ctx) => ctx.http({ method: 'POST', path: '/products', body: input.body }),
});

export const productsUpdate = defineCommand({
  id: 'products.update',
  summary: 'Update a product from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  body: BodyMode.JSON,
  bodyField: PRODUCT_UPDATE_BODY,
  run: (input, ctx) =>
    ctx.http({ method: 'PATCH', path: PRODUCT_PATH, pathParams: productParams(input), body: input.body }),
});

export const productsPause = defineCommand({
  id: 'products.pause',
  summary: 'Pause a product and free its slot.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) => ctx.http({ method: 'POST', path: `${PRODUCT_PATH}/pause`, pathParams: productParams(input) }),
});

export const productsResume = defineCommand({
  id: 'products.resume',
  summary: 'Resume a paused product.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({ method: 'POST', path: `${PRODUCT_PATH}/resume`, pathParams: productParams(input) }),
});

const settingsPair = ({
  id,
  noun,
  resource,
  getSummary,
  replaceSummary,
  replaceMethod,
  replaceKind,
  replaceBody,
  guidance,
}) =>
  defineGroup({
    id: `products.${id}`,
    help: {
      usage: `Usage:\n  outrank-cli products ${id} ${noun} <product-id>\n  outrank-cli products ${id} ${
        replaceMethod === 'PATCH' ? 'update' : 'replace'
      } <product-id> --json <object>`,
      guidance,
    },
    unknown: (word) => ({
      message: `Unknown products ${id} subcommand: ${word}.`,
      guidance: `Run \`outrank-cli products ${id} --help\` to see the available ${resource} commands.`,
    }),
    children: [
      defineCommand({
        id: `products.${id}.${noun}`,
        summary: getSummary,
        kind: CommandKind.READ,
        toolsets: TOOLSETS,
        input: productInput(),
        cli: PRODUCT_CLI,
        run: (input, ctx) =>
          ctx.http({ method: 'GET', path: `${PRODUCT_PATH}/${id}`, pathParams: productParams(input) }),
      }),
      defineCommand({
        id: `products.${id}.${replaceMethod === 'PATCH' ? 'update' : 'replace'}`,
        summary: replaceSummary,
        kind: replaceKind,
        toolsets: TOOLSETS,
        input: productInput(),
        cli: PRODUCT_CLI,
        body: BodyMode.JSON,
        ...(replaceBody ? { bodyField: replaceBody } : {}),
        run: (input, ctx) =>
          ctx.http({
            method: replaceMethod,
            path: `${PRODUCT_PATH}/${id}`,
            pathParams: productParams(input),
            body: input.body,
          }),
      }),
    ],
  });

export const outputSettingsGroup = settingsPair({
  id: 'output-settings',
  noun: 'get',
  resource: 'output-settings',
  getSummary: 'Get the article output settings of a product.',
  replaceSummary: 'Patch the article output settings of a product from a JSON body.',
  replaceMethod: 'PATCH',
  replaceKind: CommandKind.WRITE,
  replaceBody: OUTPUT_SETTINGS_UPDATE_BODY,
  guidance: 'Use `get` to inspect current article settings and `update` to patch them.',
});

export const targetAudiencesGroup = settingsPair({
  id: 'target-audiences',
  noun: 'list',
  resource: 'target-audience',
  getSummary: 'List the target audiences of a product.',
  replaceSummary: 'Replace the full target-audience list of a product from a JSON body.',
  replaceMethod: 'PUT',
  replaceKind: CommandKind.DESTRUCTIVE,
  guidance: 'Use `list` to inspect the target-audience list and `replace` to submit the full replacement set.',
});

export const competitorsGroup = settingsPair({
  id: 'competitors',
  noun: 'list',
  resource: 'competitor',
  getSummary: 'List the competitors of a product.',
  replaceSummary: 'Replace the full competitor list of a product from a JSON body (3-7 entries, server-enforced).',
  replaceMethod: 'PUT',
  replaceKind: CommandKind.DESTRUCTIVE,
  guidance: 'Use `list` to inspect the competitor list and `replace` to submit the full replacement set.',
});
