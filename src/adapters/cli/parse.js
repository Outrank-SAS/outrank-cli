import { optionField, toKebabCase } from '../../commands/registry.js';
import { usageError } from '../../core/errors.js';
import { FieldKind } from '../../core/schema.js';

export const OptionScope = Object.freeze({ GLOBAL: 'global', JSON: 'json', COMMAND: 'command' });

export const GLOBAL_OPTIONS = Object.freeze({
  'api-key': { field: 'apiKey', takesValue: true, scope: OptionScope.GLOBAL },
  'base-url': { field: 'baseUrl', takesValue: true, scope: OptionScope.GLOBAL },
  'allow-custom-base-url': { field: 'allowCustomBaseUrl', takesValue: false, scope: OptionScope.GLOBAL },
  profile: { field: 'profile', takesValue: true, scope: OptionScope.GLOBAL },
});

export const JSON_INPUT_OPTIONS = Object.freeze({
  json: { field: 'json', takesValue: true, scope: OptionScope.JSON },
  'json-file': { field: 'jsonFile', takesValue: true, scope: OptionScope.JSON },
  'json-stdin': { field: 'jsonStdin', takesValue: false, scope: OptionScope.JSON },
});

const HELP_TOKENS = new Set(['--help', '-h', 'help']);
export const OPTION_PREFIX = '--';
const OPTION_TERMINATOR = '--';
const TRUE_TEXT = 'true';
const FALSE_TEXT = 'false';
const FLAG_TEXT_VALUES = new Set([TRUE_TEXT, FALSE_TEXT]);

export const isHelpToken = (token) => HELP_TOKENS.has(token);

export const commandOptionTable = (spec) => {
  const table = {};
  const positionals = new Set(spec.cli.positionals ?? []);
  const declared = spec.cli.options ?? {};
  const declaredFields = new Set(Object.values(declared).map(optionField));
  for (const [option, entry] of Object.entries(declared)) {
    const field = optionField(entry);
    const takesValue = typeof entry === 'string' ? spec.input[field]?.kind !== FieldKind.BOOL : entry.takesValue;
    table[option] = { field, takesValue, scope: OptionScope.COMMAND };
  }
  for (const [field, definition] of Object.entries(spec.input)) {
    if (positionals.has(field) || declaredFields.has(field) || field === 'body') continue;
    table[toKebabCase(field)] = { field, takesValue: definition.kind !== FieldKind.BOOL, scope: OptionScope.COMMAND };
  }
  return table;
};

const unknownOptionError = (option) =>
  usageError(`Unknown option: --${option}.`, 'Run the current command again with --help to see the accepted options.');

const missingValueError = (option) => usageError(`Missing value for --${option}.`);

const lookup = (table, option) => (Object.hasOwn(table, option) ? table[option] : undefined);

const repeatedOptionError = (option) =>
  usageError(`--${option} was given more than once.`, 'Pass each single-value option only once.');

const recordValue = (values, option, field, value, multiple) => {
  if (multiple) {
    values[field] = [...(values[field] ?? []), value];
    return;
  }
  if (Object.hasOwn(values, field)) throw repeatedOptionError(option);
  values[field] = value;
};

export const parseCommandArgv = (argv, spec, { jsonBody = false } = {}) => {
  const table = { ...GLOBAL_OPTIONS, ...(jsonBody ? JSON_INPUT_OPTIONS : {}), ...commandOptionTable(spec) };
  const positionals = [];
  const values = {};
  const globals = {};
  const jsonSources = {};
  let helpRequested = false;

  const bucketFor = (entry) => {
    if (entry.scope === OptionScope.GLOBAL) return globals;
    if (entry.scope === OptionScope.JSON) return jsonSources;
    return values;
  };

  const assign = (entry, option, value) => {
    const multiple = entry.scope === OptionScope.COMMAND && spec.input[entry.field]?.kind === FieldKind.LIST;
    recordValue(bucketFor(entry), option, entry.field, value, multiple);
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === OPTION_TERMINATOR) {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (isHelpToken(token)) {
      helpRequested = true;
      continue;
    }
    if (!token.startsWith(OPTION_PREFIX)) {
      positionals.push(token);
      continue;
    }
    const equalsIndex = token.indexOf('=');
    const optionEnd = equalsIndex >= 0 ? equalsIndex : token.length;
    const option = token.slice(OPTION_PREFIX.length, optionEnd);
    const rejected = lookup(spec.cli.rejectedOptions ?? {}, option);
    if (rejected) throw usageError(rejected.message, rejected.guidance);
    const entry = lookup(table, option);
    if (!entry) throw unknownOptionError(option);
    if (equalsIndex >= 0) {
      const value = token.slice(equalsIndex + 1);
      if (!entry.takesValue && !FLAG_TEXT_VALUES.has(value)) {
        throw usageError(`--${option} accepts only true or false.`);
      }
      assign(entry, option, entry.scope === OptionScope.GLOBAL && !entry.takesValue ? value === TRUE_TEXT : value);
      continue;
    }
    if (!entry.takesValue) {
      assign(entry, option, true);
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith(OPTION_PREFIX)) throw missingValueError(option);
    assign(entry, option, next);
    index += 1;
  }

  return { positionals, values, globals, jsonSources, helpRequested };
};
