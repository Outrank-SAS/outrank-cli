import { parseArgs, getRequiredPositional, readJsonInput, hasFlag, parseIntegerOption, getOption } from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

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

const invalidUsage = (message, guidance) =>
  Object.assign(new Error(message), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: guidance || 'Run `outrank-cli improvements --help` to see available improvement commands.',
  });

const buildQueryPath = (basePath, searchParams) => {
  const url = new URL(`https://local${basePath}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
};

const hasJsonSource = (parsed) =>
  Boolean(getOption(parsed, 'json') || getOption(parsed, 'json-file') || hasFlag(parsed, 'json-stdin'));

const parseImproveImages = (parsed) => {
  const raw = getOption(parsed, 'improve-images');
  if (raw === undefined) return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw invalidUsage('--improve-images must be true or false.', 'Pass `--improve-images true` or `--improve-images false`, or omit it to use the default (images are regenerated).');
};

const requireScheduledFor = (parsed) => {
  const value = getOption(parsed, 'scheduled-for');
  if (!value) {
    throw invalidUsage('Missing required option: --scheduled-for <iso-date>.', 'Pass a date or ISO timestamp, e.g. `--scheduled-for 2026-06-01`.');
  }
  return value;
};

const handleAnalyze = async (parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: `/products/${productId}/improvements/analyze`,
  });
  return response.payload;
};

const handleSettings = async (action, parsed) => {
  const productId = getRequiredPositional(parsed, 0, '<product-id>');
  if (action === 'get') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/improvements/settings`,
    });
    return response.payload;
  }
  if (action === 'update') {
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/products/${productId}/improvements/settings`,
      body,
    });
    return response.payload;
  }
  throw invalidUsage(`Unknown settings action: ${action ?? '(none)'}.`, 'Use: improvements settings get|update <product-id>.');
};

const handleCandidates = async (action, parsed) => {
  if (action === 'list') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const path = buildQueryPath(`/products/${productId}/improvements/candidates`, {
      type: getOption(parsed, 'type'),
      limit: parseIntegerOption(parsed, 'limit', { min: 1, max: 50 }),
      offset: parseIntegerOption(parsed, 'offset', { min: 0 }),
    });
    const response = await requestAgentApi(parsed, { method: 'GET', path });
    return response.payload;
  }
  if (action === 'brief') {
    const candidateId = getRequiredPositional(parsed, 0, '<candidate-id>');
    const taskId = getOption(parsed, 'task');
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/improvements/candidates/${candidateId}/brief`,
      body: taskId ? { task_id: taskId } : {},
    });
    return response.payload;
  }
  if (action === 'edit-brief') {
    const candidateId = getRequiredPositional(parsed, 0, '<candidate-id>');
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/improvements/candidates/${candidateId}/brief`,
      body,
    });
    return response.payload;
  }
  if (action === 'schedule') {
    const candidateId = getRequiredPositional(parsed, 0, '<candidate-id>');
    const scheduledFor = requireScheduledFor(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/improvements/candidates/${candidateId}/schedule`,
      body: { scheduled_for: scheduledFor },
    });
    return response.payload;
  }
  throw invalidUsage(`Unknown candidates action: ${action ?? '(none)'}.`, 'Use: improvements candidates list|brief|edit-brief|schedule.');
};

const handleTasks = async (action, parsed) => {
  if (action === 'list') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/products/${productId}/improvements/tasks`,
    });
    return response.payload;
  }
  if (action === 'reschedule') {
    const taskId = getRequiredPositional(parsed, 0, '<task-id>');
    const scheduledFor = requireScheduledFor(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/improvements/tasks/${taskId}`,
      body: { scheduled_for: scheduledFor },
    });
    return response.payload;
  }
  if (action === 'cancel') {
    const taskId = getRequiredPositional(parsed, 0, '<task-id>');
    const response = await requestAgentApi(parsed, {
      method: 'DELETE',
      path: `/improvements/tasks/${taskId}`,
    });
    return response.payload;
  }
  if (action === 'edit-brief') {
    const taskId = getRequiredPositional(parsed, 0, '<task-id>');
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/improvements/tasks/${taskId}/brief`,
      body,
    });
    return response.payload;
  }
  if (action === 'execute') {
    const taskId = getRequiredPositional(parsed, 0, '<task-id>');
    const improveImages = parseImproveImages(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/improvements/tasks/${taskId}/execute`,
      body: improveImages === undefined ? {} : { improve_images: improveImages },
    });
    return response.payload;
  }
  throw invalidUsage(`Unknown tasks action: ${action ?? '(none)'}.`, 'Use: improvements tasks list|reschedule|cancel|edit-brief|execute.');
};

const handleExecutions = async (action, parsed) => {
  if (action === 'list') {
    const productId = getRequiredPositional(parsed, 0, '<product-id>');
    const path = buildQueryPath(`/products/${productId}/improvements/executions`, {
      review_status: getOption(parsed, 'review-status'),
      limit: parseIntegerOption(parsed, 'limit', { min: 1, max: 100 }),
      offset: parseIntegerOption(parsed, 'offset', { min: 0 }),
    });
    const response = await requestAgentApi(parsed, { method: 'GET', path });
    return response.payload;
  }
  if (action === 'get') {
    const executionId = getRequiredPositional(parsed, 0, '<execution-id>');
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: `/improvements/executions/${executionId}`,
    });
    return response.payload;
  }
  if (action === 'decisions') {
    const executionId = getRequiredPositional(parsed, 0, '<execution-id>');
    const body = await readJsonInput(parsed);
    const response = await requestAgentApi(parsed, {
      method: 'PATCH',
      path: `/improvements/executions/${executionId}/decisions`,
      body,
    });
    return response.payload;
  }
  if (action === 'push') {
    const executionId = getRequiredPositional(parsed, 0, '<execution-id>');
    const body = hasJsonSource(parsed) ? await readJsonInput(parsed) : {};
    const response = await requestAgentApi(parsed, {
      method: 'POST',
      path: `/improvements/executions/${executionId}/push`,
      body,
    });
    return response.payload;
  }
  throw invalidUsage(`Unknown executions action: ${action ?? '(none)'}.`, 'Use: improvements executions list|get|decisions|push.');
};

export const handleImprovementsCommand = async (argv) => {
  const subgroup = argv[0];
  const wantsHelp =
    !subgroup || subgroup === '--help' || subgroup === '-h' || subgroup === 'help';

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: IMPROVEMENTS_HELP.trim(),
      },
      'Choose a sub-noun: settings, analyze, candidates, tasks, or executions. The typical flow is analyze -> candidates brief -> candidates schedule -> tasks execute -> executions push.',
    );
  }

  if (subgroup === 'analyze') {
    return handleAnalyze(parseArgs(argv.slice(1)));
  }

  const action = argv[1];
  const parsed = parseArgs(argv.slice(2));

  if (subgroup === 'settings') return handleSettings(action, parsed);
  if (subgroup === 'candidates') return handleCandidates(action, parsed);
  if (subgroup === 'tasks') return handleTasks(action, parsed);
  if (subgroup === 'executions') return handleExecutions(action, parsed);

  throw invalidUsage(`Unknown improvements sub-noun: ${subgroup}.`);
};
