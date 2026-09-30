import { oneOf, string, uuid } from '../../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import { PRODUCT_CLI, productInput, productParams, withProduct } from './shared.js';

const INTEGRATIONS_USAGE = `Usage:
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
  outrank-cli products integrations delete <product-id> <integration-id>`;

const INTEGRATIONS_GUIDANCE =
  'Use `providers` to inspect known provider availability, auth method, required connect/create fields, and ' +
  'provider notes. For WordPress Plugin, start with `prepare` to generate the integration token, then validate ' +
  'and create. For WordPress.com and Notion, use `connect`, have the human open the returned connect_url, then ' +
  '`poll` until the OAuth handoff completes. Notion exposes `notion databases` and `notion schema` discovery ' +
  'commands. Framer exposes `framer collections` and `framer fields` discovery for the newer Server API-based ' +
  'setup, not the older plugin flow. Webflow exposes `webflow sites`, `webflow collections`, `webflow fields`, ' +
  'and `webflow items` discovery before create or update. Shopify validation returns the resolved `shop_name` ' +
  'plus available blogs, so the human should only need to provide the access token before blog selection. Wix ' +
  'is a direct validate/create/update/test flow using `site_id`, `api_key`, and `publish_status`. Next.js Blog ' +
  'is a one-step create flow that returns a one-time API key in the response. V2 products are intended to keep ' +
  'one publishing integration; multiple rows usually indicate legacy cleanup work.';

const NOTION_USAGE = `Usage:
  outrank-cli products integrations notion databases <product-id> <integration-id>
  outrank-cli products integrations notion schema <product-id> <integration-id> <database-id>`;
const NOTION_GUIDANCE =
  'Use `databases` after Notion OAuth completes to list accessible Notion databases, then use `schema` to ' +
  'inspect one database before PATCHing the saved integration row with name, database_id, and fields.';

const WEBFLOW_USAGE = `Usage:
  outrank-cli products integrations webflow sites --json <object>
  outrank-cli products integrations webflow collections --json <object>
  outrank-cli products integrations webflow fields --json <object>
  outrank-cli products integrations webflow items --json <object>`;
const WEBFLOW_GUIDANCE =
  'Use `sites` first to validate a Webflow token and list accessible sites, then `collections`, `fields`, and ' +
  '`items` to build the exact create or update payload for the chosen CMS collection.';

const FRAMER_USAGE = `Usage:
  outrank-cli products integrations framer collections --json <object>
  outrank-cli products integrations framer fields --json <object>`;
const FRAMER_GUIDANCE =
  'Use `collections` first with the Framer project URL and Server API key. Then use `fields` for one chosen ' +
  'collection if you want `collection_setup_mode: "existing"` instead of auto-creating a new collection.';

const TOOLSETS = [Toolset.INTEGRATIONS];
const PROVIDERS = Object.freeze([
  'wordpress-plugin',
  'wordpress-com',
  'notion',
  'framer',
  'webflow',
  'shopify',
  'wix',
  'webhook',
  'nextjs-blog',
]);
const WEBFLOW_RESOURCES = Object.freeze(['sites', 'collections', 'fields', 'items']);
const FRAMER_RESOURCES = Object.freeze(['collections', 'fields']);
const INTEGRATION_PATH = '/products/{productId}/integrations/{integrationId}';
const CONNECT_PATH = '/products/{productId}/integrations/connect/{provider}';
const PROVIDER_PRODUCT_CLI = { positionals: ['provider', 'productId'] };
const INTEGRATION_CLI = withProduct(['integrationId']);
const ATTEMPT_ID_PLACEHOLDERS = { attemptId: '<attempt-id>' };
const ATTEMPT_ID_REQUIRED = {
  guidance:
    'Run `outrank-cli products integrations poll <provider> <product-id> --attempt-id <attempt-id>` after ' +
    'connect starts.',
};
const SENSITIVE_BODY = { sensitiveBody: true };

const providerInput = () => ({ provider: oneOf(PROVIDERS).required(), ...productInput() });
const providerParams = (input) => ({ productId: input.productId, provider: input.provider });
const integrationInput = () => ({ ...productInput(), integrationId: uuid().required() });
const integrationParams = (input) => ({ productId: input.productId, integrationId: input.integrationId });

const providers = defineCommand({
  id: 'products.integrations.providers',
  summary: 'List known integration providers with their auth method and required fields.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  run: (_input, ctx) => ctx.http({ method: 'GET', path: '/integration-providers' }),
});

const prepare = defineCommand({
  id: 'products.integrations.prepare',
  summary: 'Prepare a provider integration for a product (e.g. generate the WordPress plugin token).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: providerInput(),
  cli: PROVIDER_PRODUCT_CLI,
  body: BodyMode.OPTIONAL_JSON,
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: '/products/{productId}/integrations/prepare/{provider}',
      pathParams: providerParams(input),
      body: input.body,
    }),
});

const connect = defineCommand({
  id: 'products.integrations.connect',
  summary: 'Start an OAuth connect flow for a provider and return the connect URL.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: providerInput(),
  cli: PROVIDER_PRODUCT_CLI,
  body: BodyMode.OPTIONAL_JSON,
  run: (input, ctx) =>
    ctx.http({ method: 'POST', path: CONNECT_PATH, pathParams: providerParams(input), body: input.body }),
});

const poll = defineCommand({
  id: 'products.integrations.poll',
  summary: 'Poll an OAuth connect attempt until the handoff completes.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...providerInput(), attemptId: string().required(ATTEMPT_ID_REQUIRED) },
  cli: { ...PROVIDER_PRODUCT_CLI, placeholders: ATTEMPT_ID_PLACEHOLDERS },
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: CONNECT_PATH,
      pathParams: providerParams(input),
      query: { attempt_id: input.attemptId },
    }),
});

const notionDatabases = defineCommand({
  id: 'products.integrations.notion.databases',
  summary: 'List the Notion databases accessible to a connected integration.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: integrationInput(),
  cli: INTEGRATION_CLI,
  run: (input, ctx) =>
    ctx.http({ method: 'GET', path: `${INTEGRATION_PATH}/notion/databases`, pathParams: integrationParams(input) }),
});

const notionSchema = defineCommand({
  id: 'products.integrations.notion.schema',
  summary: 'Inspect the schema of one Notion database.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...integrationInput(), databaseId: string().required() },
  cli: withProduct(['integrationId', 'databaseId']),
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${INTEGRATION_PATH}/notion/databases/{databaseId}/schema`,
      pathParams: { ...integrationParams(input), databaseId: input.databaseId },
    }),
});

const discoverCommand = (provider, resource) =>
  defineCommand({
    id: `products.integrations.${provider}.${resource}`,
    summary: `Discover ${provider} ${resource} with the credentials in the JSON body.`,
    kind: CommandKind.READ,
    toolsets: TOOLSETS,
    mcp: SENSITIVE_BODY,
    body: BodyMode.JSON,
    run: (input, ctx) =>
      ctx.http({
        method: 'POST',
        path: '/integration-providers/{provider}/discover/{resource}',
        pathParams: { provider, resource },
        body: input.body,
      }),
  });

const discoverGroup = ({ provider, usage, guidance, resources, label }) =>
  defineGroup({
    id: `products.integrations.${provider}`,
    help: { usage, guidance },
    unknown: (word) => ({
      message: `Unknown products integrations ${provider} subcommand: ${word}.`,
      guidance: `Run \`outrank-cli products integrations ${provider} --help\` to see the available ${label} commands.`,
    }),
    children: resources.map((resource) => discoverCommand(provider, resource)),
  });

const validate = defineCommand({
  id: 'products.integrations.validate',
  summary: 'Validate provider credentials from a JSON body without saving them.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { provider: oneOf(PROVIDERS).required() },
  cli: { positionals: ['provider'] },
  mcp: SENSITIVE_BODY,
  body: BodyMode.JSON,
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: '/integration-providers/{provider}/validate',
      pathParams: { provider: input.provider },
      body: input.body,
    }),
});

const list = defineCommand({
  id: 'products.integrations.list',
  summary: 'List the publishing integrations of a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({ method: 'GET', path: '/products/{productId}/integrations', pathParams: productParams(input) }),
});

const create = defineCommand({
  id: 'products.integrations.create',
  summary: 'Create a publishing integration for a product from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  body: BodyMode.JSON,
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: '/products/{productId}/integrations',
      pathParams: productParams(input),
      body: input.body,
    }),
});

const get = defineCommand({
  id: 'products.integrations.get',
  summary: 'Get one integration of a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: integrationInput(),
  cli: INTEGRATION_CLI,
  run: (input, ctx) => ctx.http({ method: 'GET', path: INTEGRATION_PATH, pathParams: integrationParams(input) }),
});

const update = defineCommand({
  id: 'products.integrations.update',
  summary: 'Update one integration of a product from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: integrationInput(),
  cli: INTEGRATION_CLI,
  body: BodyMode.JSON,
  run: (input, ctx) =>
    ctx.http({ method: 'PATCH', path: INTEGRATION_PATH, pathParams: integrationParams(input), body: input.body }),
});

const testCommand = defineCommand({
  id: 'products.integrations.test',
  summary: 'Test one integration of a product.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: integrationInput(),
  cli: INTEGRATION_CLI,
  run: (input, ctx) =>
    ctx.http({ method: 'POST', path: `${INTEGRATION_PATH}/test`, pathParams: integrationParams(input) }),
});

const remove = defineCommand({
  id: 'products.integrations.delete',
  summary: 'Delete one integration of a product.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: integrationInput(),
  cli: INTEGRATION_CLI,
  run: (input, ctx) => ctx.http({ method: 'DELETE', path: INTEGRATION_PATH, pathParams: integrationParams(input) }),
});

export const integrationsGroup = defineGroup({
  id: 'products.integrations',
  help: { usage: INTEGRATIONS_USAGE, guidance: INTEGRATIONS_GUIDANCE },
  unknown: (word) => ({
    message: `Unknown products integrations subcommand: ${word}.`,
    guidance: 'Run `outrank-cli products integrations --help` to see the available integration commands.',
  }),
  children: [
    providers,
    prepare,
    connect,
    poll,
    defineGroup({
      id: 'products.integrations.notion',
      help: { usage: NOTION_USAGE, guidance: NOTION_GUIDANCE },
      unknown: (word) => ({
        message: `Unknown products integrations notion subcommand: ${word}.`,
        guidance:
          'Run `outrank-cli products integrations notion --help` to see the available Notion discovery commands.',
      }),
      children: [notionDatabases, notionSchema],
    }),
    discoverGroup({
      provider: 'webflow',
      usage: WEBFLOW_USAGE,
      guidance: WEBFLOW_GUIDANCE,
      resources: WEBFLOW_RESOURCES,
      label: 'Webflow discovery',
    }),
    discoverGroup({
      provider: 'framer',
      usage: FRAMER_USAGE,
      guidance: FRAMER_GUIDANCE,
      resources: FRAMER_RESOURCES,
      label: 'Framer discovery',
    }),
    validate,
    list,
    create,
    get,
    update,
    testCommand,
    remove,
  ],
});
