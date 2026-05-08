import { readJsonFile, readStdin, resolvePath } from './io.js';

const invalidUsageError = (message) =>
  Object.assign(new Error(message), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run the current command again with --help to see the required arguments and input format.',
  });

export const parseArgs = (argv) => {
  const positionals = [];
  const options = new Map();
  const flags = new Set();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (token === '-h') {
      flags.add('help');
      continue;
    }

    if (token === '-v') {
      flags.add('version');
      continue;
    }

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const eqIndex = token.indexOf('=');
    if (eqIndex >= 0) {
      const key = token.slice(2, eqIndex);
      const value = token.slice(eqIndex + 1);
      const current = options.get(key) ?? [];
      current.push(value);
      options.set(key, current);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      const current = options.get(key) ?? [];
      current.push(next);
      options.set(key, current);
      i += 1;
      continue;
    }

    flags.add(key);
  }

  return { positionals, options, flags };
};

export const hasFlag = (parsed, name) => parsed.flags.has(name);

export const getOption = (parsed, name) => {
  const values = parsed.options.get(name);
  return values ? values[values.length - 1] : undefined;
};

export const getOptions = (parsed, name) => parsed.options.get(name) ?? [];

export const getRequiredPositional = (parsed, index, label) => {
  const value = parsed.positionals[index];
  if (!value) {
    throw invalidUsageError(`Missing required argument: ${label}.`);
  }
  return value;
};

export const parseIntegerOption = (parsed, name, { required = false, min, max } = {}) => {
  const raw = getOption(parsed, name);
  if (raw === undefined) {
    if (required) {
      throw invalidUsageError(`Missing required option: --${name}.`);
    }
    return undefined;
  }

  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw invalidUsageError(`--${name} must be an integer.`);
  }
  if (min !== undefined && value < min) {
    throw invalidUsageError(`--${name} must be >= ${min}.`);
  }
  if (max !== undefined && value > max) {
    throw invalidUsageError(`--${name} must be <= ${max}.`);
  }
  return value;
};

export const readJsonInput = async (parsed) => {
  const inline = getOption(parsed, 'json');
  const file = getOption(parsed, 'json-file');
  const useStdin = hasFlag(parsed, 'json-stdin');

  const sources = [inline ? 'inline' : null, file ? 'file' : null, useStdin ? 'stdin' : null].filter(
    Boolean,
  );
  if (sources.length === 0) {
    throw invalidUsageError('Provide one of: --json, --json-file, or --json-stdin.');
  }
  if (sources.length > 1) {
    throw invalidUsageError(
      'Use only one JSON input source: --json, --json-file, or --json-stdin.',
    );
  }

  if (inline) {
    try {
      return JSON.parse(inline);
    } catch (error) {
      throw invalidUsageError(`Invalid JSON in --json: ${error.message}`);
    }
  }

  if (file) {
    try {
      return await readJsonFile(resolvePath(file));
    } catch (error) {
      throw invalidUsageError(error.message);
    }
  }

  const stdin = await readStdin();
  if (!stdin.trim()) {
    throw invalidUsageError('No JSON was received on stdin.');
  }
  try {
    return JSON.parse(stdin);
  } catch (error) {
    throw invalidUsageError(`Invalid JSON from stdin: ${error.message}`);
  }
};
