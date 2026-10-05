import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { toolName } from '../../commands/registry.js';
import { describeUntrustedValue } from '../../core/config.js';
import { CliErrorCode, MCP_USAGE_GUIDANCE, cliError, toErrorEnvelope } from '../../core/errors.js';
import { executeCommand } from '../../core/execute.js';
import {
  ENTITLEMENT_CHANGING_COMMAND_IDS,
  MCP_PROGRESS_INTERVAL_MS,
  MCP_SERVER_NAME,
  MILLISECONDS_PER_SECOND,
  PROGRESS_NOTIFICATION_METHOD,
  WHOAMI_COMMAND_ID,
} from './constants.js';
import { describeField, describeTool, toolAnnotations } from './descriptions.js';
import { createGuidanceRewriter } from './guidance.js';
import { MCP_LABELS, buildToolInput, parseToolArguments, toRawInput } from './input.js';
import { buildInstructions } from './instructions.js';
import { createLogger, redactToolArguments } from './logger.js';
import { getPrompt, listPrompts } from './prompts.js';
import { unexpectedProbeFailures } from './routes.js';
import { listResources, readResource } from './resources.js';
import { toToolResult } from './result.js';
import { createSession } from './session.js';
import { isBlockedByOperator, isReadKind } from './toolsets.js';

const UNKNOWN_TOOL_GUIDANCE = 'List the available tools again and call one of them by its exact name.';
const READ_ONLY_GUIDANCE =
  'This server runs read-only. If the user wants this change, they must restart the server without --read-only.';

const toolsetGuidance = (spec) =>
  `This tool belongs to the ${spec.toolsets.join(' / ')} toolset, which the server configuration leaves out. If the ` +
  'user wants it, they must add that toolset to --toolsets (or use --toolsets all) and restart the server.';

const blockedEnvelope = (spec, selection) =>
  cliError(
    CliErrorCode.INVALID_USAGE,
    `${toolName(spec.id)} is not enabled on this server.`,
    selection.readOnly && !isReadKind(spec) ? READ_ONLY_GUIDANCE : toolsetGuidance(spec),
  );

const elapsedSeconds = (startedAt) => Math.round((Date.now() - startedAt) / MILLISECONDS_PER_SECOND);

export const buildToolDefinition = (spec, uploads) => {
  const input = buildToolInput({ z, spec, describeField, uploads });
  return {
    input,
    tool: {
      name: toolName(spec.id),
      description: describeTool(spec),
      inputSchema: input.inputSchema,
      annotations: toolAnnotations(spec),
    },
  };
};

export const createMcpServer = async ({
  registry,
  version,
  options,
  env,
  readConfig,
  timeouts = {},
  logger = createLogger(),
  throttle,
}) => {
  const progressIntervalMs = timeouts.progressIntervalMs ?? MCP_PROGRESS_INTERVAL_MS;
  const definitions = new Map();
  const uploads = { dir: options.uploadDir, problem: options.uploadDirProblem ?? null };
  let server = null;

  const definitionFor = (spec) => {
    if (!definitions.has(spec.id)) definitions.set(spec.id, buildToolDefinition(spec, uploads));
    return definitions.get(spec.id);
  };

  const notifyToolsChanged = () => {
    if (server === null) return;
    server.sendToolListChanged().catch((error) => {
      logger.debug('tool_list_changed_not_sent', { reason: String(error?.message ?? error) });
    });
    server.sendPromptListChanged().catch((error) => {
      logger.debug('prompt_list_changed_not_sent', { reason: String(error?.message ?? error) });
    });
  };

  const guidance = await createGuidanceRewriter(registry);
  for (const { id, reason } of unexpectedProbeFailures(guidance.index)) {
    logger.always('route_probe_failed', { command: id, reason });
  }
  const session = createSession({
    registry,
    options,
    env,
    readConfig,
    timeouts,
    onToolsChanged: notifyToolsChanged,
    ...(throttle ? { throttle } : {}),
  });
  await session.start();

  const withProgress = async (spec, extra, run) => {
    const progressToken = extra._meta?.progressToken;
    if (!spec.longRunning || progressToken === undefined) return run();
    const startedAt = Date.now();
    let progress = 0;
    const timer = setInterval(() => {
      progress += 1;
      const message = `Still running after ${elapsedSeconds(startedAt)} s.`;
      extra
        .sendNotification({ method: PROGRESS_NOTIFICATION_METHOD, params: { progressToken, progress, message } })
        .catch(() => {});
    }, progressIntervalMs);
    try {
      return await run();
    } finally {
      clearInterval(timer);
    }
  };

  const runTool = async (spec, name, args, extra) => {
    if (!spec) {
      return cliError(
        CliErrorCode.INVALID_USAGE,
        `Unknown tool: ${describeUntrustedValue(name)}.`,
        UNKNOWN_TOOL_GUIDANCE,
      );
    }
    try {
      await session.ensureReady();
      const failure = session.failure();
      if (failure) return failure;
      if (isBlockedByOperator(spec, session.selection())) return blockedEnvelope(spec, session.selection());
      const { input } = definitionFor(spec);
      const parsed = parseToolArguments(input, args);
      const { raw, body } = await toRawInput(input, parsed, uploads);
      const { ctx, release } = session.openContext({ signal: extra.signal });
      try {
        const envelope = await withProgress(spec, extra, () =>
          executeCommand({ spec, raw, loadBody: async () => body, ctx, labels: MCP_LABELS }),
        );
        if (spec.id === WHOAMI_COMMAND_ID) session.noteWhoami(envelope);
        session.noteResult(envelope);
        if (envelope.ok === true && ENTITLEMENT_CHANGING_COMMAND_IDS.includes(spec.id)) session.refreshIdentity();
        return envelope;
      } finally {
        release();
      }
    } catch (error) {
      return toErrorEnvelope(error, { usageGuidance: MCP_USAGE_GUIDANCE });
    }
  };

  const logToolCall = ({ spec, params, envelope, startedAt }) => {
    if (!logger.enabled) return;
    try {
      logger.debug('tool_call', {
        tool: spec ? params.name : describeUntrustedValue(params.name),
        ok: envelope.ok,
        code: envelope.error?.code,
        ms: Date.now() - startedAt,
        arguments: spec ? redactToolArguments(spec, params.arguments) : undefined,
      });
    } catch (error) {
      logger.debug('tool_call_not_logged', { reason: String(error?.message ?? error) });
    }
  };

  const callTool = async (params, extra) => {
    const startedAt = Date.now();
    const found = registry.byToolName.get(params.name);
    const spec = found && found.mcp !== false ? found : undefined;
    const envelope = await runTool(spec, params.name, params.arguments, extra);
    logToolCall({ spec, params, envelope, startedAt });
    return toToolResult(guidance.rewrite(envelope, spec), { spec, organization: session.organization() });
  };

  const asProtocolError = (run) => {
    try {
      return run();
    } catch (error) {
      if (error?.cliCode === CliErrorCode.INVALID_USAGE) throw new McpError(ErrorCode.InvalidParams, error.message);
      throw error;
    }
  };

  server = new Server(
    { name: MCP_SERVER_NAME, version },
    {
      capabilities: { tools: { listChanged: true }, prompts: { listChanged: true }, resources: {} },
      instructions: buildInstructions({ session, version }),
    },
  );
  server.onerror = (error) => {
    logger.debug('protocol_error', { reason: String(error?.message ?? error) });
  };
  server.onclose = () => {
    session.shutdown();
  };
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: session.selection().tools.map((spec) => definitionFor(spec).tool),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => callTool(request.params, extra));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: listPrompts(session.selection()) }));
  server.setRequestHandler(GetPromptRequestSchema, async (request) =>
    asProtocolError(() => getPrompt(session.selection(), request.params.name, request.params.arguments)),
  );
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listResources() }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
    asProtocolError(() => readResource(session, request.params.uri)),
  );

  return { server, session };
};
