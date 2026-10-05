import { MAX_TOOL_NAME_LENGTH, RESERVED_OPTION_NAMES } from '../core/constants.js';
import { CliErrorCode, codedError, isEnvelope } from '../core/errors.js';
import { isField, json, object } from '../core/schema.js';

export const CommandKind = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  DESTRUCTIVE: 'destructive',
  MONEY: 'money',
  LOCAL: 'local',
});

export const Toolset = Object.freeze({
  CORE: 'core',
  INTEGRATIONS: 'integrations',
  GSC: 'gsc',
  LINKING: 'linking',
  BACKLINKS: 'backlinks',
  KEYWORDS: 'keywords',
  ARTICLES: 'articles',
  IMPROVEMENTS: 'improvements',
  MARKETPLACE_SELLER: 'marketplace-seller',
  MARKETPLACE_BUYER: 'marketplace-buyer',
  BILLING: 'billing',
});

export const BodyMode = Object.freeze({
  NONE: 'none',
  EMPTY_OBJECT: 'empty-object',
  JSON: 'json',
  OPTIONAL_JSON: 'optional-json',
  OPTIONAL_JSON_OR_EMPTY_OBJECT: 'optional-json-or-empty-object',
});

export const JSON_BODY_MODES = Object.freeze([
  BodyMode.JSON,
  BodyMode.OPTIONAL_JSON,
  BodyMode.OPTIONAL_JSON_OR_EMPTY_OBJECT,
]);

export const NodeType = Object.freeze({
  GROUP: 'group',
  COMMAND: 'command',
});

export const BODY_INPUT_NAME = 'body';
const MCP_FLAG_NAMES = Object.freeze(['sensitiveBody', 'untrustedOutput', 'untrustedFields', 'untrustedWhen', 'redact']);
const FIELD_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const FIELD_PATH_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*(?:\[\])?(?:\.[a-zA-Z_][a-zA-Z0-9_]*(?:\[\])?)*$/;
const ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;
const NO_RESULT_GUIDANCE = 'This is a CLI bug: the command finished without producing a result. Report the command.';

const registryError = (message) => new Error(`Command registry: ${message}`);

export const toKebabCase = (name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
export const toSnakeCase = (name) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
export const cliWords = (id) => id.split('.');
export const toolName = (id) => id.replaceAll('.', '_').replaceAll('-', '_');
export const lastSegment = (id) => id.slice(id.lastIndexOf('.') + 1);
export const optionField = (entry) => (typeof entry === 'string' ? entry : entry.field);

const bodyInputFor = (body, bodyField, bodyMerge) => {
  if (!JSON_BODY_MODES.includes(body)) return {};
  const base = bodyField ?? (bodyMerge ? object() : json());
  if (body === BodyMode.JSON) return { [BODY_INPUT_NAME]: base.required() };
  if (body === BodyMode.OPTIONAL_JSON_OR_EMPTY_OBJECT) return { [BODY_INPUT_NAME]: base.default({}) };
  return { [BODY_INPUT_NAME]: base };
};

const assertNoBodyInput = (id, input) => {
  if (Object.hasOwn(input, BODY_INPUT_NAME)) {
    throw registryError(`${id}: declare the request body with bodyField, not input.${BODY_INPUT_NAME}`);
  }
  return input;
};

const normalizeCommand = ({
  id,
  summary,
  description,
  input = {},
  cli = {},
  kind,
  toolsets,
  mcp = true,
  body = BodyMode.NONE,
  bodyField,
  bodyMerge,
  longRunning,
  entryPoint = false,
  offline = false,
  allowUnknownProfile = false,
  refine,
  help,
  run,
}) => ({
  type: NodeType.COMMAND,
  id,
  summary,
  description: description ?? summary,
  input: { ...assertNoBodyInput(id, input), ...bodyInputFor(body, bodyField, bodyMerge) },
  cli,
  kind,
  toolsets,
  mcp,
  body,
  bodyMerge,
  longRunning,
  entryPoint,
  offline,
  allowUnknownProfile,
  refine,
  help,
  run,
});

export const defineCommand = (definition) => normalizeCommand(definition);

export const defineGroup = ({ id, help, unknown, children, description, command }) => ({
  type: NodeType.GROUP,
  id,
  help,
  unknown,
  description,
  children,
  ...(command ? { ...normalizeCommand({ ...command, id }), type: NodeType.GROUP, help, children } : {}),
});

const assertUntrustedWhen = (node, paths) => {
  const when = node.mcp.untrustedWhen;
  if (when === undefined) return;
  const shapeOk =
    Boolean(when) &&
    typeof when === 'object' &&
    typeof when.record === 'string' &&
    (when.record === '' || FIELD_PATH_PATTERN.test(when.record)) &&
    typeof when.flag === 'string' &&
    FIELD_NAME_PATTERN.test(when.flag);
  if (!shapeOk) {
    throw registryError(`${node.id}: mcp.untrustedWhen must be { record: '<path or empty>', flag: '<field name>' }`);
  }
  const prefix = when.record ? `${when.record}.` : '';
  if (!paths.every((entry) => entry.startsWith(prefix) && entry.length > prefix.length)) {
    throw registryError(`${node.id}: every mcp.untrustedFields path must sit inside the untrustedWhen record`);
  }
};

const assertMcpShape = (node) => {
  if (node.mcp === true || node.mcp === false) return;
  if (!node.mcp || typeof node.mcp !== 'object') throw registryError(`${node.id}: mcp must be a boolean or an object`);
  for (const key of Object.keys(node.mcp)) {
    if (!MCP_FLAG_NAMES.includes(key)) throw registryError(`${node.id}: unknown mcp flag ${key}`);
  }
  if (node.mcp.redact !== undefined && !Array.isArray(node.mcp.redact)) {
    throw registryError(`${node.id}: mcp.redact must be an array of field names`);
  }
  if (node.mcp.untrustedFields === undefined) {
    if (node.mcp.untrustedWhen !== undefined) {
      throw registryError(`${node.id}: mcp.untrustedWhen requires mcp.untrustedFields`);
    }
    return;
  }
  const paths = node.mcp.untrustedFields;
  if (!Array.isArray(paths) || paths.length === 0 || !paths.every((entry) => FIELD_PATH_PATTERN.test(entry))) {
    throw registryError(`${node.id}: mcp.untrustedFields must be a non-empty array of field paths`);
  }
  if (node.mcp.untrustedOutput !== true) {
    throw registryError(`${node.id}: mcp.untrustedFields requires untrustedOutput: true`);
  }
  assertUntrustedWhen(node, paths);
};

const assertCliShape = (node) => {
  const inputNames = Object.keys(node.input);
  const positionals = node.cli.positionals ?? [];
  for (const positional of positionals) {
    if (!inputNames.includes(positional)) throw registryError(`${node.id}: positional ${positional} is not an input`);
  }
  const optionNames = new Set();
  for (const [option, entry] of Object.entries(node.cli.options ?? {})) {
    const field = optionField(entry);
    if (!inputNames.includes(field)) {
      throw registryError(`${node.id}: option --${option} maps to unknown input ${field}`);
    }
    if (RESERVED_OPTION_NAMES.includes(option)) throw registryError(`${node.id}: option --${option} is reserved`);
    optionNames.add(option);
  }
  for (const name of inputNames) {
    if (positionals.includes(name) || name === BODY_INPUT_NAME) continue;
    const declared = Object.values(node.cli.options ?? {}).some((entry) => optionField(entry) === name);
    const option = declared ? undefined : toKebabCase(name);
    if (option !== undefined) {
      if (RESERVED_OPTION_NAMES.includes(option)) throw registryError(`${node.id}: input ${name} shadows --${option}`);
      if (optionNames.has(option)) throw registryError(`${node.id}: option --${option} is declared twice`);
      optionNames.add(option);
    }
  }
  for (const placeholder of Object.keys(node.cli.placeholders ?? {})) {
    if (!inputNames.includes(placeholder)) {
      throw registryError(`${node.id}: placeholder ${placeholder} is not an input`);
    }
  }
  const snakeNames = inputNames.map(toSnakeCase);
  if (new Set(snakeNames).size !== snakeNames.length) throw registryError(`${node.id}: snake_case input names collide`);
};

const assertCommandShape = (node) => {
  if (!Object.values(CommandKind).includes(node.kind)) throw registryError(`${node.id}: unknown kind ${node.kind}`);
  if (!Array.isArray(node.toolsets) || node.toolsets.length === 0) {
    throw registryError(`${node.id}: toolsets must be a non-empty array`);
  }
  for (const toolset of node.toolsets) {
    if (!Object.values(Toolset).includes(toolset)) throw registryError(`${node.id}: unknown toolset ${toolset}`);
  }
  if (typeof node.run !== 'function') throw registryError(`${node.id}: run must be a function`);
  if (typeof node.summary !== 'string' || node.summary === '') throw registryError(`${node.id}: summary is required`);
  const bodyIsMode = Object.values(BodyMode).includes(node.body);
  const bodyIsFixed = Boolean(node.body) && typeof node.body === 'object';
  if (!bodyIsMode && !bodyIsFixed) throw registryError(`${node.id}: body must be a BodyMode or a fixed object`);
  if (node.bodyMerge !== undefined && (!JSON_BODY_MODES.includes(node.body) || typeof node.bodyMerge !== 'object')) {
    throw registryError(`${node.id}: bodyMerge requires body: json and an object mapping`);
  }
  for (const field of Object.values(node.bodyMerge ?? {})) {
    if (!(field in node.input)) throw registryError(`${node.id}: bodyMerge references unknown input ${field}`);
  }
  if (node.longRunning !== undefined && typeof node.longRunning?.pollTool !== 'string') {
    throw registryError(`${node.id}: longRunning needs a pollTool id`);
  }
  if (node.refine !== undefined && typeof node.refine !== 'function') {
    throw registryError(`${node.id}: refine must be a function`);
  }
  if (typeof node.offline !== 'boolean' || typeof node.allowUnknownProfile !== 'boolean') {
    throw registryError(`${node.id}: offline and allowUnknownProfile must be booleans`);
  }
  for (const [name, field] of Object.entries(node.input)) {
    if (!isField(field)) throw registryError(`${node.id}: input ${name} is not a field`);
  }
  assertMcpShape(node);
  assertCliShape(node);
  const name = toolName(node.id);
  if (name.length > MAX_TOOL_NAME_LENGTH) throw registryError(`${node.id}: tool name ${name} is too long`);
};

const assertGroupShape = (node) => {
  if (!node.help || typeof node.help.usage !== 'string') throw registryError(`${node.id}: group help is required`);
  if (typeof node.unknown !== 'function') throw registryError(`${node.id}: group unknown() is required`);
  const words = new Set();
  for (const child of node.children ?? []) {
    for (const word of [lastSegment(child.id), ...(child.cli?.aliases ?? [])]) {
      if (words.has(word)) throw registryError(`${node.id}: duplicate child word ${word}`);
      words.add(word);
    }
  }
};

const walk = (node, parentId, seen, commands) => {
  if (!ID_PATTERN.test(node.id)) throw registryError(`invalid id ${node.id}`);
  if (parentId !== null && !node.id.startsWith(`${parentId}.`)) {
    throw registryError(`${node.id} must be nested under ${parentId}`);
  }
  if (seen.has(node.id)) throw registryError(`duplicate id ${node.id}`);
  seen.add(node.id);
  if (node.type === NodeType.COMMAND) {
    assertCommandShape(node);
    commands.push(node);
    return;
  }
  assertGroupShape(node);
  if (node.run !== undefined) {
    assertCommandShape(node);
    commands.push(node);
  }
  for (const child of node.children ?? []) walk(child, node.id, seen, commands);
};

export const createRegistry = (groups) => {
  const seen = new Set();
  const commands = [];
  for (const group of groups) {
    if (group.type !== NodeType.GROUP) throw registryError(`${group.id} is not a group`);
    walk(group, null, seen, commands);
  }
  const byId = new Map(commands.map((command) => [command.id, command]));
  const byToolName = new Map();
  for (const command of commands) {
    const name = toolName(command.id);
    if (byToolName.has(name)) {
      throw registryError(`tool name ${name} is used by ${byToolName.get(name).id} and ${command.id}`);
    }
    byToolName.set(name, command);
    if (command.longRunning && !byId.has(command.longRunning.pollTool)) {
      throw registryError(`${command.id}: pollTool ${command.longRunning.pollTool} is not a command`);
    }
  }
  return Object.freeze({ groups, commands, byId, byToolName });
};

export const findChild = (group, word) =>
  (group.children ?? []).find((child) => lastSegment(child.id) === word || child.cli?.aliases?.includes(word));

export const assertEnvelope = (node, result) => {
  if (!isEnvelope(result)) {
    const message = `Command ${node.id} returned no result envelope.`;
    throw codedError(CliErrorCode.UNEXPECTED_ERROR, message, NO_RESULT_GUIDANCE);
  }
  return result;
};
