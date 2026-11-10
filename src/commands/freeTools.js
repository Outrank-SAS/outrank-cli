import {
  FREE_TOOLS_KEYWORDS_GENERATE_MAX_COUNT,
  FREE_TOOLS_KEYWORDS_GENERATE_MIN_COUNT,
  FREE_TOOLS_KEYWORD_SOURCES,
  FREE_TOOLS_KEYWORD_VIEWS,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  MIN_OFFSET,
} from '../core/constants.js';
import { BoolSerialize, bool, image, int, list, oneOf, string, uuid } from '../core/schema.js';
import { PRODUCT_CLI, productInput, productParams, productParamsWith, withProduct } from './products/shared.js';
import { CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';
import { subGroup } from './subGroup.js';

export const FREE_TOOLS_HELP = `Usage:
  outrank-cli free-tools status <product-id>
  outrank-cli free-tools keywords list <product-id> [--view upcoming|all]
  outrank-cli free-tools keywords add <product-id> --keyword "<text>" [--keyword "<text>" ...]
  outrank-cli free-tools keywords generate <product-id> --count <n> [--source competitors|audiences|both]
  outrank-cli free-tools keywords delete <product-id> --keyword-ids <id,id,...>
  outrank-cli free-tools create <product-id> <keyword-id>
  outrank-cli free-tools list <product-id> [--limit <n>] [--offset <n>]
  outrank-cli free-tools get <product-id> <tool-id>
  outrank-cli free-tools history <product-id> <tool-id>
  outrank-cli free-tools edit <product-id> <tool-id> --prompt "<text>" [--attachment-ids <id,id,...>]
  outrank-cli free-tools preview <product-id> <tool-id> [--wake]
  outrank-cli free-tools publish <product-id> <tool-id>
  outrank-cli free-tools discard <product-id> <tool-id>
  outrank-cli free-tools rollback <product-id> <tool-id>
  outrank-cli free-tools attachments add <product-id> <tool-id> --file <path>
  outrank-cli free-tools attachments remove <product-id> <tool-id> <attachment-id>

Notes:
  Free Tools Builder makes small interactive web pages (calculators, checkers, generators) for keywords and hosts
  them on the product's site. Each planned keyword gets its tool built on its scheduled day; create builds one now.
  edit sends a change request to the AI builder: the change lands in a draft that goes live only with publish,
  and discard throws the draft away. rollback puts the previous published version back live.
  create, keywords generate, edit, publish, discard, rollback and preview --wake can take minutes. When one of
  them reports that it is still running, follow it with keywords list or get instead of starting it again.
  Building, editing, publishing and rollback need the Generation plan; the Hosting plan keeps existing tools live.

Examples:
  outrank-cli free-tools status 00000000-0000-0000-0000-000000000000
  outrank-cli free-tools keywords add 00000000-0000-0000-0000-000000000000 --keyword "mortgage calculator"
  outrank-cli free-tools create 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli free-tools edit 00000000-0000-0000-0000-000000000000 22222222-2222-2222-2222-222222222222 --prompt "Add a copy-to-clipboard button for the results"
  outrank-cli free-tools preview 00000000-0000-0000-0000-000000000000 22222222-2222-2222-2222-222222222222 --wake
  outrank-cli free-tools publish 00000000-0000-0000-0000-000000000000 22222222-2222-2222-2222-222222222222
`;

const KEYWORDS_HELP = `Usage:
  outrank-cli free-tools keywords list <product-id> [--view upcoming|all]
  outrank-cli free-tools keywords add <product-id> --keyword "<text>" [--keyword "<text>" ...]
  outrank-cli free-tools keywords generate <product-id> --count <n> [--source competitors|audiences|both]
  outrank-cli free-tools keywords delete <product-id> --keyword-ids <id,id,...>
`;
const ATTACHMENTS_HELP = `Usage:
  outrank-cli free-tools attachments add <product-id> <tool-id> --file <path>
  outrank-cli free-tools attachments remove <product-id> <tool-id> <attachment-id>
`;

const TOOLSETS = [Toolset.FREE_TOOLS];
const GROUP_ID = 'free-tools';
const BASE_PATH = '/products/{productId}/free-tools';
const KEYWORDS_PATH = `${BASE_PATH}/keywords`;
const TOOL_PATH = `${BASE_PATH}/{toolId}`;
const TOOL_ID_INPUT = 'toolId';
const TOOL_CLI = withProduct([TOOL_ID_INPUT]);
const ATTACHMENT_CLI = withProduct([TOOL_ID_INPUT, 'attachmentId']);
const POLL_TOOL_GET = `${GROUP_ID}.get`;
const POLL_KEYWORDS_LIST = `${GROUP_ID}.keywords.list`;
const POLL_PREVIEW = `${GROUP_ID}.preview`;
const TRUE_TEXT = 'true';
const LIST_PLACEHOLDER = '<id,id,...>';
const TEXT_PLACEHOLDER = '<text>';

const KEYWORDS_REQUIRED = {
  guidance: 'Pass each keyword with --keyword, e.g. `--keyword "mortgage calculator"`; repeat it for more.',
};
const KEYWORD_IDS_REQUIRED = {
  guidance: 'Pass the planned keyword ids from `free-tools keywords list` with `--keyword-ids <id,id,...>`.',
};
const COUNT_REQUIRED = {
  guidance:
    `Pass how many keywords to generate with \`--count <n>\` (${FREE_TOOLS_KEYWORDS_GENERATE_MIN_COUNT}-` +
    `${FREE_TOOLS_KEYWORDS_GENERATE_MAX_COUNT}, within the free planner slots shown by \`free-tools status\`).`,
};
const PROMPT_REQUIRED = {
  guidance: 'Describe the change in plain words, e.g. `--prompt "Add a copy-to-clipboard button for the results"`.',
};
const FILE_REQUIRED = { guidance: 'Pass a local image path with `--file <path>`.' };

const toolInput = () => ({ ...productInput(), [TOOL_ID_INPUT]: uuid().required() });
const toolParams = (input) => productParamsWith(input, TOOL_ID_INPUT);
const toolParamsWith = (input, name) => ({ ...toolParams(input), [name]: input[name] });

const status = defineCommand({
  id: `${GROUP_ID}.status`,
  summary: 'Get the Free Tools Builder state of a product: plan, tool counts and keyword planner slots.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  entryPoint: true,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/status`,
      pathParams: productParams(input),
    }),
});

const keywordsList = defineCommand({
  id: `${GROUP_ID}.keywords.list`,
  summary: 'List the planned free tool keywords of a product with their schedule and tool state.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...productInput(), view: oneOf(FREE_TOOLS_KEYWORD_VIEWS) },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: KEYWORDS_PATH,
      pathParams: productParams(input),
      query: { view: input.view },
    }),
});

const keywordsAdd = defineCommand({
  id: `${GROUP_ID}.keywords.add`,
  summary: 'Add keywords to the free tools planner; each one gets a tool built on its scheduled day.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...productInput(), keywords: list({ split: null }).required(KEYWORDS_REQUIRED) },
  cli: { ...PRODUCT_CLI, options: { keyword: 'keywords' }, placeholders: { keywords: TEXT_PLACEHOLDER } },
  longRunning: { pollTool: POLL_KEYWORDS_LIST },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: KEYWORDS_PATH,
      pathParams: productParams(input),
      body: { keywords: input.keywords },
    }),
});

const keywordsGenerate = defineCommand({
  id: `${GROUP_ID}.keywords.generate`,
  summary: 'Research free tool keywords with AI and add them to the planner (multi-minute).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: {
    ...productInput(),
    count: int({
      min: FREE_TOOLS_KEYWORDS_GENERATE_MIN_COUNT,
      max: FREE_TOOLS_KEYWORDS_GENERATE_MAX_COUNT,
    }).required(COUNT_REQUIRED),
    source: oneOf(FREE_TOOLS_KEYWORD_SOURCES),
  },
  cli: { ...PRODUCT_CLI, placeholders: { count: '<n>' } },
  longRunning: { pollTool: POLL_KEYWORDS_LIST },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${KEYWORDS_PATH}/generate`,
      pathParams: productParams(input),
      body: { count: input.count, ...(input.source ? { source: input.source } : {}) },
    }),
});

const keywordsDelete = defineCommand({
  id: `${GROUP_ID}.keywords.delete`,
  summary: 'Delete planned free tool keywords that have no tool yet.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: { ...productInput(), keywordIds: list({ item: uuid() }).required(KEYWORD_IDS_REQUIRED) },
  cli: { ...PRODUCT_CLI, placeholders: { keywordIds: LIST_PLACEHOLDER } },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${KEYWORDS_PATH}/bulk-delete`,
      pathParams: productParams(input),
      body: { keyword_ids: input.keywordIds },
    }),
});

const create = defineCommand({
  id: `${GROUP_ID}.create`,
  summary: 'Build the free tool of a planned keyword now, or retry a failed first build (multi-minute).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...productInput(), keywordId: uuid().required() },
  cli: withProduct(['keywordId']),
  longRunning: { pollTool: POLL_KEYWORDS_LIST },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: BASE_PATH,
      pathParams: productParams(input),
      body: { keyword_id: input.keywordId },
    }),
});

const listTools = defineCommand({
  id: `${GROUP_ID}.list`,
  summary: 'List the free tools of a product with their state, live URL and draft status.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: {
    ...productInput(),
    limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
    offset: int({ min: MIN_OFFSET }),
  },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: BASE_PATH,
      pathParams: productParams(input),
      query: { limit: input.limit, offset: input.offset },
    }),
});

const get = defineCommand({
  id: `${GROUP_ID}.get`,
  summary: 'Get one free tool: state, live URL, versions and which builder actions apply.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: toolInput(),
  cli: TOOL_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: TOOL_PATH,
      pathParams: toolParams(input),
    }),
});

const history = defineCommand({
  id: `${GROUP_ID}.history`,
  summary: 'Read the AI builder conversation of a free tool: requests, replies and suggested next changes.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: toolInput(),
  cli: TOOL_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${TOOL_PATH}/messages`,
      pathParams: toolParams(input),
    }),
});

const edit = defineCommand({
  id: `${GROUP_ID}.edit`,
  summary: 'Ask the AI builder to change a free tool; the change lands in a draft (multi-minute).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: {
    ...toolInput(),
    prompt: string().required(PROMPT_REQUIRED),
    attachmentIds: list({ item: uuid() }),
  },
  cli: { ...TOOL_CLI, placeholders: { prompt: TEXT_PLACEHOLDER, attachmentIds: LIST_PLACEHOLDER } },
  longRunning: { pollTool: POLL_TOOL_GET },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${TOOL_PATH}/messages`,
      pathParams: toolParams(input),
      body: {
        prompt: input.prompt,
        ...(input.attachmentIds?.length ? { attachment_ids: input.attachmentIds } : {}),
      },
    }),
});

const preview = defineCommand({
  id: `${GROUP_ID}.preview`,
  summary: 'Get the preview link of the current draft of a free tool, waking its sandbox if asked.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...toolInput(), wake: bool({ serialize: BoolSerialize.STRING }) },
  cli: TOOL_CLI,
  longRunning: { pollTool: POLL_PREVIEW },
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${TOOL_PATH}/preview`,
      pathParams: toolParams(input),
      query: { wake: input.wake ? TRUE_TEXT : undefined },
    }),
});

const toolAction = ({ action, kind, summary }) =>
  defineCommand({
    id: `${GROUP_ID}.${action}`,
    summary,
    kind,
    toolsets: TOOLSETS,
    input: toolInput(),
    cli: TOOL_CLI,
    longRunning: { pollTool: POLL_TOOL_GET },
    run: (input, ctx) =>
      ctx.http({
        method: 'POST',
        path: `${TOOL_PATH}/${action}`,
        pathParams: toolParams(input),
      }),
  });

const publish = toolAction({
  action: 'publish',
  kind: CommandKind.WRITE,
  summary: 'Publish the draft of a free tool so it becomes the live version.',
});
const discard = toolAction({
  action: 'discard',
  kind: CommandKind.DESTRUCTIVE,
  summary: 'Throw away the unpublished changes of a free tool and go back to the live version.',
});
const rollback = toolAction({
  action: 'rollback',
  kind: CommandKind.DESTRUCTIVE,
  summary: 'Put the previous published version of a free tool back live.',
});

const attachmentsAdd = defineCommand({
  id: `${GROUP_ID}.attachments.add`,
  summary: 'Upload an image for the AI builder of a free tool, such as a screenshot or a mockup.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...toolInput(), file: image().required(FILE_REQUIRED) },
  cli: { ...TOOL_CLI, placeholders: { file: '<path>' } },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${TOOL_PATH}/attachments`,
      pathParams: toolParams(input),
      body: input.file,
    }),
});

const attachmentsRemove = defineCommand({
  id: `${GROUP_ID}.attachments.remove`,
  summary: 'Remove a builder attachment of a free tool that was not sent with a change yet.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: { ...toolInput(), attachmentId: uuid().required() },
  cli: ATTACHMENT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'DELETE',
      path: `${TOOL_PATH}/attachments/{attachmentId}`,
      pathParams: toolParamsWith(input, 'attachmentId'),
    }),
});

export const freeToolsGroup = defineGroup({
  id: GROUP_ID,
  help: {
    usage: FREE_TOOLS_HELP,
    guidance:
      'Start with status: it says whether the product has the Free Tools Builder plan and how many planner slots ' +
      'are free. Then keywords, create, list, get, history, edit, preview, publish, discard, rollback or attachments.',
  },
  unknown: (word) => ({
    message: `Unknown free-tools command: ${word}.`,
    guidance: 'Run `outrank-cli free-tools --help` to see the available Free Tools Builder commands.',
  }),
  children: [
    status,
    subGroup({
      id: `${GROUP_ID}.keywords`,
      usage: KEYWORDS_HELP,
      actions: 'list|add|generate|delete',
      children: [keywordsList, keywordsAdd, keywordsGenerate, keywordsDelete],
    }),
    create,
    listTools,
    get,
    history,
    edit,
    preview,
    publish,
    discard,
    rollback,
    subGroup({
      id: `${GROUP_ID}.attachments`,
      usage: ATTACHMENTS_HELP,
      actions: 'add|remove',
      children: [attachmentsAdd, attachmentsRemove],
    }),
  ],
});
