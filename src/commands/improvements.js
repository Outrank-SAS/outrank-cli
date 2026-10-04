import { IMPROVEMENTS_CANDIDATES_MAX_LIMIT, LIST_MAX_LIMIT, LIST_MIN_LIMIT, MIN_OFFSET } from '../core/constants.js';
import { BoolSerialize, bool, int, list, object, oneOf, string, uuid } from '../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';

const WEEKDAY_CODES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ENABLED_HINT = 'true starts the unattended improvement loop.';
const AUTO_PUSH_HINT = 'true publishes each rewrite to the CMS without review.';
const PUBLISHING_DAYS_HINT = 'At most 2 weekday codes.';
const IMPROVEMENT_SETTINGS_BODY = object().shape({
  enabled: bool().describe(ENABLED_HINT),
  auto_push: bool().describe(AUTO_PUSH_HINT),
  publishing_days: list({ item: oneOf(WEEKDAY_CODES) }).describe(PUBLISHING_DAYS_HINT),
});

export const IMPROVEMENTS_HELP = `Usage:
  outrank-cli improvements settings get <product-id>
  outrank-cli improvements settings update <product-id> --json <object>
  outrank-cli improvements analyze <product-id>
  outrank-cli improvements candidates list <product-id> [--type outsider|ctr_gap|declining|content_gap|thin_content] [--limit <n>] [--offset <n>]
  outrank-cli improvements candidates brief <candidate-id> [--task <task-id>]
  outrank-cli improvements candidates edit-brief <candidate-id> --json <object>
  outrank-cli improvements candidates schedule <candidate-id> --scheduled-for <iso-date>
  outrank-cli improvements tasks list <product-id>
  outrank-cli improvements tasks reschedule <task-id> --scheduled-for <iso-date>
  outrank-cli improvements tasks cancel <task-id>
  outrank-cli improvements tasks edit-brief <task-id> --json <object>
  outrank-cli improvements tasks execute <task-id> [--improve-images true|false]
  outrank-cli improvements executions list <product-id> [--review-status awaiting_review|pushed|auto_pushed|rejected|all] [--limit <n>] [--offset <n>]
  outrank-cli improvements executions get <execution-id>
  outrank-cli improvements executions decisions <execution-id> --json <object>
  outrank-cli improvements executions push <execution-id> [--json <object>]

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Notes:
  Article improvements need the All-in-One plan. Turning settings on starts an unattended loop
  (weekly opportunity discovery, daily auto-scheduling on the configured publishing_days, and
  execution every ~15 minutes). With auto_push on, each successful rewrite is published to the CMS
  without review. analyze, candidates brief, and tasks execute are heavy multi-minute operations:
  if a call times out at the edge, the work continues server-side — re-list/poll instead of retrying.

Examples:
  outrank-cli improvements settings get 00000000-0000-0000-0000-000000000000
  outrank-cli improvements settings update 00000000-0000-0000-0000-000000000000 --json '{"enabled":true,"auto_push":false,"publishing_days":["Mon","Thu"]}'
  outrank-cli improvements analyze 00000000-0000-0000-0000-000000000000
  outrank-cli improvements candidates list 00000000-0000-0000-0000-000000000000 --type ctr_gap --limit 20
  outrank-cli improvements candidates brief 00000000-0000-0000-0000-000000000000
  outrank-cli improvements candidates edit-brief 00000000-0000-0000-0000-000000000000 --json-file brief.json
  outrank-cli improvements candidates schedule 00000000-0000-0000-0000-000000000000 --scheduled-for 2026-06-01
  outrank-cli improvements tasks list 00000000-0000-0000-0000-000000000000
  outrank-cli improvements tasks execute 00000000-0000-0000-0000-000000000000 --improve-images false
  outrank-cli improvements executions list 00000000-0000-0000-0000-000000000000 --review-status awaiting_review
  outrank-cli improvements executions get 00000000-0000-0000-0000-000000000000
  outrank-cli improvements executions push 00000000-0000-0000-0000-000000000000
  outrank-cli improvements executions push 00000000-0000-0000-0000-000000000000 --json '{"decisions":{"para-3":"rejected"}}'
`;

const SETTINGS_HELP = `Usage:
  outrank-cli improvements settings get <product-id>
  outrank-cli improvements settings update <product-id> --json <object>
`;
const CANDIDATES_HELP = `Usage:
  outrank-cli improvements candidates list <product-id> [--type outsider|ctr_gap|declining|content_gap|thin_content] [--limit <n>] [--offset <n>]
  outrank-cli improvements candidates brief <candidate-id> [--task <task-id>]
  outrank-cli improvements candidates edit-brief <candidate-id> --json <object>
  outrank-cli improvements candidates schedule <candidate-id> --scheduled-for <iso-date>
`;
const TASKS_HELP = `Usage:
  outrank-cli improvements tasks list <product-id>
  outrank-cli improvements tasks reschedule <task-id> --scheduled-for <iso-date>
  outrank-cli improvements tasks cancel <task-id>
  outrank-cli improvements tasks edit-brief <task-id> --json <object>
  outrank-cli improvements tasks execute <task-id> [--improve-images true|false]
`;
const EXECUTIONS_HELP = `Usage:
  outrank-cli improvements executions list <product-id> [--review-status awaiting_review|pushed|auto_pushed|rejected|all] [--limit <n>] [--offset <n>]
  outrank-cli improvements executions get <execution-id>
  outrank-cli improvements executions decisions <execution-id> --json <object>
  outrank-cli improvements executions push <execution-id> [--json <object>]
`;

const TOOLSETS = [Toolset.IMPROVEMENTS];
const PRODUCT_CLI = { positionals: ['productId'] };
const CANDIDATE_CLI = { positionals: ['candidateId'] };
const TASK_CLI = { positionals: ['taskId'] };
const EXECUTION_CLI = { positionals: ['executionId'] };
const SCHEDULED_FOR_PLACEHOLDERS = { scheduledFor: '<iso-date>' };
const PRODUCT_SETTINGS_PATH = '/products/{productId}/improvements/settings';
const CANDIDATE_BRIEF_PATH = '/improvements/candidates/{candidateId}/brief';
const TASK_PATH = '/improvements/tasks/{taskId}';
const EXECUTION_PATH = '/improvements/executions/{executionId}';
const POLL_EXECUTIONS_LIST = 'improvements.executions.list';
const POLL_CANDIDATES_LIST = 'improvements.candidates.list';
const POLL_EXECUTIONS_GET = 'improvements.executions.get';

const SCHEDULED_FOR_REQUIRED = { guidance: 'Pass a date or ISO timestamp, e.g. `--scheduled-for 2026-06-01`.' };
const IMPROVE_IMAGES_GUIDANCE =
  'Pass `--improve-images true` or `--improve-images false`, or omit it to use the default (images are regenerated).';

const productInput = () => ({ productId: uuid().required() });
const productParams = (input) => ({ productId: input.productId });

const settingsGet = defineCommand({
  id: 'improvements.settings.get',
  summary: 'Get the article improvement settings of a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) => ctx.http({ method: 'GET', path: PRODUCT_SETTINGS_PATH, pathParams: productParams(input) }),
});

const settingsUpdate = defineCommand({
  id: 'improvements.settings.update',
  summary: 'Update the article improvement settings of a product from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  body: BodyMode.JSON,
  bodyField: IMPROVEMENT_SETTINGS_BODY,
  run: (input, ctx) =>
    ctx.http({ method: 'PATCH', path: PRODUCT_SETTINGS_PATH, pathParams: productParams(input), body: input.body }),
});

const analyze = defineCommand({
  id: 'improvements.analyze',
  summary: 'Run improvement opportunity discovery for a product (multi-minute).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  longRunning: { pollTool: POLL_EXECUTIONS_LIST },
  run: (input, ctx) =>
    ctx.http({ method: 'POST', path: '/products/{productId}/improvements/analyze', pathParams: productParams(input) }),
});

const candidatesList = defineCommand({
  id: 'improvements.candidates.list',
  summary: 'List improvement candidates for a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: {
    ...productInput(),
    type: string(),
    limit: int({ min: LIST_MIN_LIMIT, max: IMPROVEMENTS_CANDIDATES_MAX_LIMIT }),
    offset: int({ min: MIN_OFFSET }),
  },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: '/products/{productId}/improvements/candidates',
      pathParams: productParams(input),
      query: { type: input.type, limit: input.limit, offset: input.offset },
    }),
});

const candidatesBrief = defineCommand({
  id: 'improvements.candidates.brief',
  summary: 'Generate the improvement brief for a candidate (multi-minute).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { candidateId: uuid().required(), taskId: uuid() },
  cli: { ...CANDIDATE_CLI, options: { task: 'taskId' } },
  longRunning: { pollTool: POLL_CANDIDATES_LIST },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: CANDIDATE_BRIEF_PATH,
      pathParams: { candidateId: input.candidateId },
      body: input.taskId ? { task_id: input.taskId } : {},
    }),
});

const candidatesEditBrief = defineCommand({
  id: 'improvements.candidates.edit-brief',
  summary: 'Edit the improvement brief of a candidate from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { candidateId: uuid().required() },
  cli: CANDIDATE_CLI,
  body: BodyMode.JSON,
  run: (input, ctx) =>
    ctx.http({
      method: 'PATCH',
      path: CANDIDATE_BRIEF_PATH,
      pathParams: { candidateId: input.candidateId },
      body: input.body,
    }),
});

const candidatesSchedule = defineCommand({
  id: 'improvements.candidates.schedule',
  summary: 'Schedule an improvement task for a candidate.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { candidateId: uuid().required(), scheduledFor: string().required(SCHEDULED_FOR_REQUIRED) },
  cli: { ...CANDIDATE_CLI, placeholders: SCHEDULED_FOR_PLACEHOLDERS },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: '/improvements/candidates/{candidateId}/schedule',
      pathParams: { candidateId: input.candidateId },
      body: { scheduled_for: input.scheduledFor },
    }),
});

const tasksList = defineCommand({
  id: 'improvements.tasks.list',
  summary: 'List scheduled improvement tasks for a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({ method: 'GET', path: '/products/{productId}/improvements/tasks', pathParams: productParams(input) }),
});

const tasksReschedule = defineCommand({
  id: 'improvements.tasks.reschedule',
  summary: 'Reschedule an improvement task.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { taskId: uuid().required(), scheduledFor: string().required(SCHEDULED_FOR_REQUIRED) },
  cli: { ...TASK_CLI, placeholders: SCHEDULED_FOR_PLACEHOLDERS },
  run: (input, ctx) =>
    ctx.http({
      method: 'PATCH',
      path: TASK_PATH,
      pathParams: { taskId: input.taskId },
      body: { scheduled_for: input.scheduledFor },
    }),
});

const tasksCancel = defineCommand({
  id: 'improvements.tasks.cancel',
  summary: 'Cancel an improvement task.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: { taskId: uuid().required() },
  cli: TASK_CLI,
  run: (input, ctx) => ctx.http({ method: 'DELETE', path: TASK_PATH, pathParams: { taskId: input.taskId } }),
});

const tasksEditBrief = defineCommand({
  id: 'improvements.tasks.edit-brief',
  summary: 'Edit the brief of an improvement task from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { taskId: uuid().required() },
  cli: TASK_CLI,
  body: BodyMode.JSON,
  run: (input, ctx) =>
    ctx.http({ method: 'PATCH', path: `${TASK_PATH}/brief`, pathParams: { taskId: input.taskId }, body: input.body }),
});

const tasksExecute = defineCommand({
  id: 'improvements.tasks.execute',
  summary: 'Execute an improvement task now (multi-minute).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: {
    taskId: uuid().required(),
    improveImages: bool({ serialize: BoolSerialize.ALWAYS }).guidance(IMPROVE_IMAGES_GUIDANCE),
  },
  cli: { ...TASK_CLI, options: { 'improve-images': { field: 'improveImages', takesValue: true } } },
  longRunning: { pollTool: POLL_EXECUTIONS_GET },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${TASK_PATH}/execute`,
      pathParams: { taskId: input.taskId },
      body: input.improveImages === undefined ? {} : { improve_images: input.improveImages },
    }),
});

const executionsList = defineCommand({
  id: 'improvements.executions.list',
  summary: 'List improvement executions for a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: {
    ...productInput(),
    reviewStatus: string(),
    limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
    offset: int({ min: MIN_OFFSET }),
  },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: '/products/{productId}/improvements/executions',
      pathParams: productParams(input),
      query: { review_status: input.reviewStatus, limit: input.limit, offset: input.offset },
    }),
});

const executionsGet = defineCommand({
  id: 'improvements.executions.get',
  summary: 'Get one improvement execution with its proposed changes.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { executionId: uuid().required() },
  cli: EXECUTION_CLI,
  run: (input, ctx) =>
    ctx.http({ method: 'GET', path: EXECUTION_PATH, pathParams: { executionId: input.executionId } }),
});

const executionsDecisions = defineCommand({
  id: 'improvements.executions.decisions',
  summary: 'Record review decisions for an execution from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { executionId: uuid().required() },
  cli: EXECUTION_CLI,
  body: BodyMode.JSON,
  run: (input, ctx) =>
    ctx.http({
      method: 'PATCH',
      path: `${EXECUTION_PATH}/decisions`,
      pathParams: { executionId: input.executionId },
      body: input.body,
    }),
});

const executionsPush = defineCommand({
  id: 'improvements.executions.push',
  summary: 'Push an execution to the CMS, optionally with decisions in a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { executionId: uuid().required() },
  cli: EXECUTION_CLI,
  body: BodyMode.OPTIONAL_JSON_OR_EMPTY_OBJECT,
  longRunning: { pollTool: POLL_EXECUTIONS_GET },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${EXECUTION_PATH}/push`,
      pathParams: { executionId: input.executionId },
      body: input.body,
    }),
});

const subGroup = ({ id, usage, actions, children }) =>
  defineGroup({
    id,
    help: { usage, guidance: `Use: improvements ${id.slice(id.indexOf('.') + 1)} ${actions}.` },
    unknown: (word) => ({
      message: `Unknown ${id.slice(id.indexOf('.') + 1)} action: ${word}.`,
      guidance: `Use: improvements ${id.slice(id.indexOf('.') + 1)} ${actions}.`,
    }),
    children,
  });

export const improvementsGroup = defineGroup({
  id: 'improvements',
  help: {
    usage: IMPROVEMENTS_HELP,
    guidance:
      'Choose a sub-noun: settings, analyze, candidates, tasks, or executions. The typical flow is analyze -> ' +
      'candidates brief -> candidates schedule -> tasks execute -> executions push.',
  },
  unknown: (word) => ({
    message: `Unknown improvements sub-noun: ${word}.`,
    guidance: 'Run `outrank-cli improvements --help` to see available improvement commands.',
  }),
  children: [
    subGroup({
      id: 'improvements.settings',
      usage: SETTINGS_HELP,
      actions: 'get|update <product-id>',
      children: [settingsGet, settingsUpdate],
    }),
    analyze,
    subGroup({
      id: 'improvements.candidates',
      usage: CANDIDATES_HELP,
      actions: 'list|brief|edit-brief|schedule',
      children: [candidatesList, candidatesBrief, candidatesEditBrief, candidatesSchedule],
    }),
    subGroup({
      id: 'improvements.tasks',
      usage: TASKS_HELP,
      actions: 'list|reschedule|cancel|edit-brief|execute',
      children: [tasksList, tasksReschedule, tasksCancel, tasksEditBrief, tasksExecute],
    }),
    subGroup({
      id: 'improvements.executions',
      usage: EXECUTIONS_HELP,
      actions: 'list|get|decisions|push',
      children: [executionsList, executionsGet, executionsDecisions, executionsPush],
    }),
  ],
});
