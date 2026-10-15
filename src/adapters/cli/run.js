import path from 'node:path';

import {
  BODY_INPUT_NAME,
  JSON_BODY_MODES,
  NodeType,
  findChild,
  optionField,
  toKebabCase,
} from '../../commands/registry.js';
import { Surface, createCommandContext, loadContext } from '../../core/context.js';
import { USAGE_GUIDANCE, cliSuccess, toErrorEnvelope, usageError } from '../../core/errors.js';
import { executeCommand } from '../../core/execute.js';
import { readImageUpload, readTextFile } from '../../core/files.js';
import { FieldKind } from '../../core/schema.js';
import { readJsonBody } from './jsonInput.js';
import { OPTION_PREFIX, isHelpToken, parseCommandArgv } from './parse.js';

const EXIT_OK = 0;
const EXIT_FAILURE = 1;
const JSON_BODY_LABEL = '--json';
const JSON_BODY_MISSING = 'Provide one of: --json, --json-file, or --json-stdin.';

const helpEnvelope = (node) => cliSuccess({ usage: node.help.usage.trim() }, node.help.guidance);

const nearestHelp = (trail) => [...trail].reverse().find((node) => node.help);

const unknownWordError = (group, word) => {
  const { message, guidance } = group.unknown(word);
  return usageError(message, guidance);
};

const resolveNode = (registry, argv) => {
  const trail = [];
  let node = registry.groups.find((group) => group.id === argv[0]);
  if (!node) return null;
  trail.push(node);
  let index = 1;
  while (node.type === NodeType.GROUP) {
    const word = argv[index];
    if (word === undefined || word.startsWith(OPTION_PREFIX) || isHelpToken(word)) break;
    const child = findChild(node, word);
    if (!child) break;
    trail.push(child);
    node = child;
    index += 1;
  }
  return { node, trail, rest: argv.slice(index) };
};

const buildLabels = (spec) => {
  const positionals = new Set(spec.cli.positionals ?? []);
  const placeholders = spec.cli.placeholders ?? {};
  const optionNames = {};
  for (const [option, entry] of Object.entries(spec.cli.options ?? {})) {
    const field = optionField(entry);
    if (!(field in optionNames)) optionNames[field] = option;
  }
  const optionOf = (field) => optionNames[field] ?? toKebabCase(field);
  const positionalLabel = (field) => placeholders[field] ?? `<${toKebabCase(field)}>`;
  const optionLabel = (field) => `--${optionOf(field)}${placeholders[field] ? ` ${placeholders[field]}` : ''}`;
  return {
    labelOf: (field) => {
      if (field === BODY_INPUT_NAME) return JSON_BODY_LABEL;
      return positionals.has(field) ? positionalLabel(field) : `--${optionOf(field)}`;
    },
    missingOf: (field) => {
      if (field === BODY_INPUT_NAME) return JSON_BODY_MISSING;
      if (positionals.has(field)) return `Missing required argument: ${positionalLabel(field)}.`;
      return `Missing required option: ${optionLabel(field)}.`;
    },
  };
};

const collectRawInput = (spec, parsed) => {
  const positionals = spec.cli.positionals ?? [];
  if (parsed.positionals.length > positionals.length) {
    const extra = parsed.positionals[positionals.length];
    throw usageError(`Unexpected argument: ${extra}.`, USAGE_GUIDANCE);
  }
  const raw = { ...parsed.values };
  positionals.forEach((field, index) => {
    if (parsed.positionals[index] !== undefined) raw[field] = parsed.positionals[index];
  });
  return raw;
};

const FILE_FIELD_KINDS = Object.freeze([FieldKind.IMAGE, FieldKind.TEXT_FILE]);

const readFileInput = (field, name, filePath) =>
  field.kind === FieldKind.IMAGE
    ? readImageUpload({ filePath })
    : readTextFile({ filePath, option: `${OPTION_PREFIX}${toKebabCase(name)}` });

const resolveFileInputs = async (spec, raw, cwd) => {
  const resolved = { ...raw };
  for (const [name, field] of Object.entries(spec.input)) {
    if (!FILE_FIELD_KINDS.includes(field.kind) || typeof raw[name] !== 'string' || raw[name] === '') continue;
    resolved[name] = await readFileInput(field, name, path.resolve(cwd, raw[name]));
  }
  return resolved;
};

const hasJsonSource = ({ json, jsonFile, jsonStdin }) =>
  json !== undefined || jsonFile !== undefined || jsonStdin !== undefined;

const runCommand = async (registry, spec, rest) => {
  const jsonBody = JSON_BODY_MODES.includes(spec.body);
  const parsed = parseCommandArgv(rest, spec, { jsonBody });
  if (parsed.helpRequested) return null;
  const cwd = process.cwd();
  const raw = await resolveFileInputs(spec, collectRawInput(spec, parsed), cwd);
  const resolved = await loadContext(parsed.globals, {
    enforceAllowlist: !spec.offline,
    allowUnknownProfile: spec.allowUnknownProfile,
  });
  const ctx = createCommandContext({ resolved, registry, surface: Surface.CLI, cwd, usageGuidance: USAGE_GUIDANCE });
  const loadBody = async () => (hasJsonSource(parsed.jsonSources) ? readJsonBody(parsed.jsonSources) : undefined);
  return executeCommand({ spec, raw, loadBody, ctx, labels: buildLabels(spec) });
};

export const dispatch = async (registry, argv) => {
  const resolved = resolveNode(registry, argv);
  if (!resolved) return null;
  const { node, trail, rest } = resolved;
  const helpNode = nearestHelp(trail);

  if (node.type === NodeType.GROUP && !node.run) {
    const word = rest[0];
    if (word === undefined || rest.some(isHelpToken)) return helpEnvelope(helpNode);
    throw unknownWordError(node, word);
  }

  const result = await runCommand(registry, node, rest);
  return result ?? helpEnvelope(helpNode);
};

export const runRegistryCommand = async (registry, argv) => {
  try {
    const envelope = await dispatch(registry, argv);
    if (envelope === null) return null;
    return { envelope, exitCode: envelope.ok === false ? EXIT_FAILURE : EXIT_OK };
  } catch (error) {
    return { envelope: toErrorEnvelope(error), exitCode: EXIT_FAILURE };
  }
};
