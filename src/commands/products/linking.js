import { uuid } from '../../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import { PRODUCT_CLI, productInput, productParams, withProduct } from './shared.js';

const LINKING_USAGE = `Usage:
  outrank-cli products linking sources get <product-id>
  outrank-cli products linking sources update <product-id> --json <object>
  outrank-cli products linking detect <product-id>
  outrank-cli products linking target-config get <product-id>
  outrank-cli products linking target-config update <product-id> --json <object>
  outrank-cli products linking targets list <product-id>
  outrank-cli products linking targets add-manual <product-id> --json <object>
  outrank-cli products linking targets upsert <product-id> --json <object>
  outrank-cli products linking targets clear-customizations <product-id> <target-id>
  outrank-cli products linking targets delete <product-id> <target-id>`;

const SOURCES_USAGE =
  'Usage:\n  outrank-cli products linking sources get <product-id>\n' +
  '  outrank-cli products linking sources update <product-id> --json <object>';
const TARGET_CONFIG_USAGE =
  'Usage:\n  outrank-cli products linking target-config get <product-id>\n' +
  '  outrank-cli products linking target-config update <product-id> --json <object>';
const TARGETS_USAGE = `Usage:
  outrank-cli products linking targets list <product-id>
  outrank-cli products linking targets add-manual <product-id> --json <object>
  outrank-cli products linking targets upsert <product-id> --json <object>
  outrank-cli products linking targets clear-customizations <product-id> <target-id>
  outrank-cli products linking targets delete <product-id> <target-id>`;

const TOOLSETS = [Toolset.LINKING];
const LINKING_PATH = '/products/{productId}/linking';
const TARGET_PATH = `${LINKING_PATH}/targets/{targetId}`;
const TARGET_CLI = withProduct(['targetId']);

const targetInput = () => ({ ...productInput(), targetId: uuid().required() });
const targetParams = (input) => ({ productId: input.productId, targetId: input.targetId });

const getAndSet = ({ id, resource, method, updateSummary, getSummary, usage, guidance, unknownNoun, aliases }) =>
  defineGroup({
    id: `products.linking.${id}`,
    help: { usage, guidance },
    unknown: (word) => ({
      message: `Unknown products linking ${id} subcommand: ${word}.`,
      guidance: `Run \`outrank-cli products linking ${id} --help\` to see available ${unknownNoun} commands.`,
    }),
    children: [
      defineCommand({
        id: `products.linking.${id}.get`,
        summary: getSummary,
        kind: CommandKind.READ,
        toolsets: TOOLSETS,
        input: productInput(),
        cli: PRODUCT_CLI,
        run: (input, ctx) =>
          ctx.http({ method: 'GET', path: `${LINKING_PATH}/${resource}`, pathParams: productParams(input) }),
      }),
      defineCommand({
        id: `products.linking.${id}.update`,
        summary: updateSummary,
        kind: CommandKind.WRITE,
        toolsets: TOOLSETS,
        input: productInput(),
        cli: { ...PRODUCT_CLI, aliases },
        body: BodyMode.JSON,
        run: (input, ctx) =>
          ctx.http({ method, path: `${LINKING_PATH}/${resource}`, pathParams: productParams(input), body: input.body }),
      }),
    ],
  });

const sourcesGroup = getAndSet({
  id: 'sources',
  resource: 'sources',
  method: 'PATCH',
  getSummary: 'Get the internal-linking sources of a product.',
  updateSummary: 'Change the primary or additional internal-linking sources from a JSON body.',
  usage: SOURCES_USAGE,
  guidance: 'Use `get` to inspect current linking sources and `update` to change the primary or additional sources.',
  unknownNoun: 'linking-source',
  aliases: ['set'],
});

const targetConfigGroup = getAndSet({
  id: 'target-config',
  resource: 'target-config',
  method: 'PUT',
  getSummary: 'Get the product-wide internal-linking target configuration.',
  updateSummary: 'Replace the product-wide internal-linking target configuration from a JSON body.',
  usage: TARGET_CONFIG_USAGE,
  guidance: 'Use `get` to inspect product-wide linking target behavior and `update` to change it.',
  unknownNoun: 'target-config',
  aliases: [],
});

const detect = defineCommand({
  id: 'products.linking.detect',
  summary: 'Detect internal-linking targets for a product (long-running).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  longRunning: { pollTool: 'products.linking.targets.list' },
  run: (input, ctx) => ctx.http({ method: 'POST', path: `${LINKING_PATH}/detect`, pathParams: productParams(input) }),
});

const targetsList = defineCommand({
  id: 'products.linking.targets.list',
  summary: 'List the saved internal-linking targets of a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) => ctx.http({ method: 'GET', path: `${LINKING_PATH}/targets`, pathParams: productParams(input) }),
});

const targetsBody = ({ id, summary, suffix }) =>
  defineCommand({
    id: `products.linking.targets.${id}`,
    summary,
    kind: CommandKind.WRITE,
    toolsets: TOOLSETS,
    input: productInput(),
    cli: PRODUCT_CLI,
    body: BodyMode.JSON,
    run: (input, ctx) =>
      ctx.http({
        method: 'POST',
        path: `${LINKING_PATH}/targets/${suffix}`,
        pathParams: productParams(input),
        body: input.body,
      }),
  });

const targetsAddManual = targetsBody({
  id: 'add-manual',
  summary: 'Add a manual internal-linking target from a JSON body.',
  suffix: 'manual',
});
const targetsUpsert = targetsBody({
  id: 'upsert',
  summary: 'Upsert an internal-linking target from a JSON body.',
  suffix: 'upsert',
});

const targetsClearCustomizations = defineCommand({
  id: 'products.linking.targets.clear-customizations',
  summary: 'Clear the manual customizations of one internal-linking target.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: targetInput(),
  cli: TARGET_CLI,
  run: (input, ctx) => ctx.http({ method: 'PATCH', path: TARGET_PATH, pathParams: targetParams(input) }),
});

const targetsDelete = defineCommand({
  id: 'products.linking.targets.delete',
  summary: 'Delete one internal-linking target.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: targetInput(),
  cli: TARGET_CLI,
  run: (input, ctx) => ctx.http({ method: 'DELETE', path: TARGET_PATH, pathParams: targetParams(input) }),
});

const targetsGroup = defineGroup({
  id: 'products.linking.targets',
  help: {
    usage: TARGETS_USAGE,
    guidance:
      'Use `list` to inspect saved targets, `add-manual` or `upsert` to save URLs, and clear/delete for cleanup.',
  },
  unknown: (word) => ({
    message: `Unknown products linking targets subcommand: ${word}.`,
    guidance: 'Run `outrank-cli products linking targets --help` to see available linking-target commands.',
  }),
  children: [targetsList, targetsAddManual, targetsUpsert, targetsClearCustomizations, targetsDelete],
});

export const linkingGroup = defineGroup({
  id: 'products.linking',
  help: {
    usage: LINKING_USAGE,
    guidance:
      'Use `sources` for source selection, `detect` for discovery, `targets` for saved URLs, and `target-config` ' +
      'for product-wide rules.',
  },
  unknown: (word) => ({
    message: `Unknown products linking subcommand: ${word}.`,
    guidance: 'Run `outrank-cli products linking --help` to see available linking commands.',
  }),
  children: [sourcesGroup, detect, targetConfigGroup, targetsGroup],
});
