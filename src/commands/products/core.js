import { LIST_MAX_LIMIT, LIST_MIN_LIMIT } from '../../core/constants.js';
import { int, string } from '../../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import { PRODUCT_CLI, productInput, productParams } from './shared.js';

const TOOLSETS = [Toolset.CORE];
const PRODUCT_PATH = '/products/{productId}';

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

const settingsPair = ({ id, noun, resource, getSummary, replaceSummary, replaceMethod, replaceKind, guidance }) =>
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
