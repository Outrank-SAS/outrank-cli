import { BODY_INPUT_NAME, BodyMode, JSON_BODY_MODES, assertEnvelope } from '../commands/registry.js';
import { LONG_RUNNING_GATEWAY_STATUSES, Surface } from './constants.js';
import { CliErrorCode, cliError, toErrorEnvelope } from './errors.js';
import { validateInput } from './schema.js';

const INTERRUPTED_DETAILS = Object.freeze(['timed_out', 'cancelled', 'outcome_unknown']);

const stillRunningGuidance = (ctx, spec) =>
  `The request did not complete, but the server may still be processing it. Do not retry; poll ${ctx.ref(
    spec.longRunning.pollTool,
  )} until the work shows up, then continue from there.`;

const mayStillBeRunning = (ctx, spec, message, details) =>
  cliError(CliErrorCode.OPERATION_MAY_STILL_BE_RUNNING, message, stillRunningGuidance(ctx, spec), details);

const mapLongRunningResult = (spec, result, ctx) => {
  if (!spec.longRunning || result.ok !== false) return result;
  const status = result.error?.details?.status;
  if (result.error?.code === CliErrorCode.UPSTREAM_ERROR && LONG_RUNNING_GATEWAY_STATUSES.includes(status)) {
    return mayStillBeRunning(ctx, spec, result.error.message, result.error.details);
  }
  return result;
};

const mapLongRunningError = (spec, error, ctx) => {
  const interrupted = INTERRUPTED_DETAILS.some((detail) => error?.details?.[detail] === true);
  if (!spec.longRunning || error?.cliCode !== CliErrorCode.NETWORK_ERROR || !interrupted) return null;
  return mayStillBeRunning(ctx, spec, error.message, error.details);
};

const splitBodyField = (fields) => {
  const { [BODY_INPUT_NAME]: bodyField, ...rest } = fields;
  return { bodyField, rest };
};

const resolveBody = async (spec, loadBody) => {
  if (spec.body === BodyMode.NONE) return undefined;
  if (spec.body === BodyMode.EMPTY_OBJECT) return {};
  if (JSON_BODY_MODES.includes(spec.body)) return loadBody();
  return spec.body;
};

const mergeBody = (spec, input, body) => {
  if (!spec.bodyMerge || body === undefined) return body;
  const merged = { ...body };
  for (const [bodyKey, field] of Object.entries(spec.bodyMerge)) {
    if (input[field] !== undefined) merged[bodyKey] = input[field];
  }
  return merged;
};

export const executeCommand = async ({ spec, raw, loadBody = async () => undefined, ctx, labels = {} }) => {
  const validation = { ...labels, splitLists: ctx.surface !== Surface.MCP };
  try {
    const { bodyField, rest } = splitBodyField(spec.input);
    const input = validateInput(rest, raw, validation);
    const rawBody = await resolveBody(spec, loadBody);
    if (bodyField) {
      const validated = validateInput({ [BODY_INPUT_NAME]: bodyField }, { [BODY_INPUT_NAME]: rawBody }, validation);
      if (BODY_INPUT_NAME in validated) input[BODY_INPUT_NAME] = mergeBody(spec, input, validated[BODY_INPUT_NAME]);
    } else if (rawBody !== undefined) {
      input[BODY_INPUT_NAME] = rawBody;
    }
    if (spec.refine) spec.refine(input, ctx);
    ctx.longRunning = Boolean(spec.longRunning);
    const result = assertEnvelope(spec, await spec.run(input, ctx));
    return mapLongRunningResult(spec, result, ctx);
  } catch (error) {
    return mapLongRunningError(spec, error, ctx) ?? toErrorEnvelope(error, { usageGuidance: ctx.usageGuidance });
  }
};
