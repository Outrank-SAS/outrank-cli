import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PRELOAD_URL = pathToFileURL(path.join(HERE, 'preload.js')).href;
const ENTRY_PATH = path.join(REPO_ROOT, 'src', 'index.js');
const CONFIG_DIR_PLACEHOLDER = '<CONFIG_DIR>';
const REPO_ROOT_PLACEHOLDER = '<REPO_ROOT>';
const HOME_PLACEHOLDER = '<HOME>';
const VERSION_PLACEHOLDER = '<VERSION>';
const PATH_PLACEHOLDERS = [CONFIG_DIR_PLACEHOLDER, REPO_ROOT_PLACEHOLDER, HOME_PLACEHOLDER];
const KNOWN_API_KEY_LABEL = 'API_KEY';
const UNKNOWN_API_KEY_LABEL = 'UNKNOWN_API_KEY';
const DEFAULT_TIMEOUT_MS = 20_000;
const KILL_GRACE_MS = 2_000;
const CLEANUP_MAX_RETRIES = 5;
const CLEANUP_RETRY_DELAY_MS = 50;
const OUTRANK_ENV_PREFIX = 'OUTRANK_';

export const HELP_EXAMPLE_API_KEY = 'outr_live_xxx';
export const API_KEY_PATTERN_SOURCE = 'outr_(?:live|test)_[A-Za-z0-9_]+';
const UUID_PATTERN_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const createApiKeyPattern = () => new RegExp(API_KEY_PATTERN_SOURCE, 'g');
const createUuidPattern = () => new RegExp(UUID_PATTERN_SOURCE, 'gi');

const readPackageVersion = async () => {
  const packageJson = JSON.parse(await fs.readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  return packageJson.version;
};

const cleanEnv = (extraEnv) => {
  const base = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith(OUTRANK_ENV_PREFIX)),
  );
  return { ...base, ...extraEnv };
};

const toPosix = (value) => value.replaceAll('\\', '/');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceAllForms = (text, target, placeholder) => {
  const forms = new Set([target, toPosix(target), target.replaceAll('/', '\\'), JSON.stringify(target).slice(1, -1)]);
  let result = text;
  for (const form of forms) {
    if (form) result = result.replace(new RegExp(escapeRegExp(form), 'g'), placeholder);
  }
  return result;
};

const PLACEHOLDER_PATH_PATTERN = new RegExp(`(${PATH_PLACEHOLDERS.map(escapeRegExp).join('|')})([^\\s"']*)`, 'g');
const BACKSLASH_RUN_PATTERN = /\\\\|\\/g;
const JSON_ESCAPE_AFTER_BACKSLASH_PATTERN = /^(?:[nrtbf"\\/]|u[0-9a-fA-F]{4})/;

const toPosixSeparators = (rest, { preserveJsonEscapes }) =>
  rest.replace(BACKSLASH_RUN_PATTERN, (run, offset) => {
    if (run.length === 2 || !preserveJsonEscapes) return '/';
    return JSON_ESCAPE_AFTER_BACKSLASH_PATTERN.test(rest.slice(offset + 1)) ? run : '/';
  });

export const normalizePathSeparators = (text, { preserveJsonEscapes = true } = {}) =>
  text.replace(
    PLACEHOLDER_PATH_PATTERN,
    (_, placeholder, rest) => `${placeholder}${toPosixSeparators(rest, { preserveJsonEscapes })}`,
  );

const JSON_PARSE_ERROR_PLACEHOLDER = '<JSON_PARSE_ERROR>';
const JSON_OPTION = '--json';
const JSON_FILE_OPTION = '--json-file';
const JSON_CONTENT_TYPE = 'application/json';
const CONTENT_TYPE_HEADER = 'content-type';

const jsonParseMessage = (candidate) => {
  try {
    JSON.parse(candidate);
    return null;
  } catch (error) {
    return error.message;
  }
};

const optionValueAt = (argv, index, option) => {
  const value = argv[index];
  if (value === option) return argv[index + 1];
  if (value.startsWith(`${option}=`)) return value.slice(option.length + 1);
  return undefined;
};

const optionValues = (argv, option) =>
  argv.map((_, index) => optionValueAt(argv, index, option)).filter((value) => value !== undefined);

export const readJsonFileContents = async (argv) => {
  const contents = [];
  for (const filePath of optionValues(argv, JSON_FILE_OPTION)) {
    try {
      contents.push(await fs.readFile(path.resolve(REPO_ROOT, filePath), 'utf8'));
    } catch {
      continue;
    }
  }
  return contents;
};

const effectiveContentType = (spec) => {
  const headerEntry = Object.entries(spec.headers ?? {}).find(([name]) => name.toLowerCase() === CONTENT_TYPE_HEADER);
  if (headerEntry) return headerEntry[1];
  return spec.contentType;
};

const isJsonResponse = (spec) => {
  const contentType = effectiveContentType(spec);
  return contentType === undefined || Boolean(contentType?.includes(JSON_CONTENT_TYPE));
};

export const collectJsonParseMessages = ({ argv, stdin, rawConfig, responses, jsonFileContents }) => {
  const inlineJsonValues = optionValues(argv, JSON_OPTION);
  if (inlineJsonValues.length > 1) {
    throw new Error(`HARNESS ERROR: ${JSON_OPTION} appears more than once; the CLI keeps only the last value`);
  }
  const candidates = [
    ...inlineJsonValues,
    stdin,
    rawConfig,
    ...(responses ?? []).filter(isJsonResponse).map((spec) => spec.rawBody),
    ...jsonFileContents,
  ];
  const messages = new Set();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const message = jsonParseMessage(candidate);
    if (message) messages.add(message);
  }
  return [...messages].sort((a, b) => b.length - a.length);
};

export const createJsonParseErrorNormalizer = (messages) => (text) => {
  let result = text;
  for (const message of messages) {
    for (const form of new Set([message, JSON.stringify(message).slice(1, -1)])) {
      result = result.replaceAll(form, JSON_PARSE_ERROR_PLACEHOLDER);
    }
  }
  return result;
};

const matchAll = (sources, pattern) => {
  const text = sources.map((source) => (source === undefined ? '' : JSON.stringify(source))).join('\n');
  return [...text.matchAll(pattern)].map(([match]) => match);
};

export const createUuidNormalizer = (knownUuids) => {
  const known = new Set(knownUuids.map((value) => value.toLowerCase()));
  const generated = new Map();
  return (text) =>
    text.replace(createUuidPattern(), (match) => {
      const lower = match.toLowerCase();
      if (known.has(lower)) return match;
      if (!generated.has(lower)) generated.set(lower, `<UUID-${generated.size + 1}>`);
      return generated.get(lower);
    });
};

export const createApiKeyNormalizer = (knownKeys) => {
  const known = new Map();
  for (const key of knownKeys) {
    if (!known.has(key)) known.set(key, `<${KNOWN_API_KEY_LABEL}-${known.size + 1}>`);
  }
  const unknown = new Map();
  return (text) =>
    text.replace(createApiKeyPattern(), (match) => {
      if (match === HELP_EXAMPLE_API_KEY) return match;
      if (known.has(match)) return known.get(match);
      if (!unknown.has(match)) unknown.set(match, `<${UNKNOWN_API_KEY_LABEL}-${unknown.size + 1}>`);
      return unknown.get(match);
    });
};

export const normalizeOutput = (
  text,
  {
    configDir,
    version,
    normalizeUuid = (value) => value,
    normalizeApiKey = (value) => value,
    normalizeJsonParseError = (value) => value,
    preserveJsonEscapes = true,
  },
) => {
  let result = text;
  result = replaceAllForms(result, configDir, CONFIG_DIR_PLACEHOLDER);
  result = replaceAllForms(result, REPO_ROOT, REPO_ROOT_PLACEHOLDER);
  result = replaceAllForms(result, os.homedir(), HOME_PLACEHOLDER);
  result = normalizePathSeparators(result, { preserveJsonEscapes });
  result = normalizeJsonParseError(result);
  if (version) result = result.replaceAll(`"version": "${version}"`, `"version": "${VERSION_PLACEHOLDER}"`);
  return normalizeApiKey(normalizeUuid(result));
};

const spawnCli = (argv, { childEnv, stdin, timeoutMs }) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', PRELOAD_URL, ENTRY_PATH, ...argv], {
      cwd: REPO_ROOT,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timeoutError = null;
    let killTimer = null;
    const timer = setTimeout(() => {
      timeoutError = new Error(`CLI did not exit within ${timeoutMs} ms: ${argv.join(' ')}`);
      child.kill();
      killTimer = setTimeout(() => reject(timeoutError), KILL_GRACE_MS);
    }, timeoutMs);
    const clearTimers = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
    };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.stdin.on('error', () => {});
    child.on('error', (error) => {
      clearTimers();
      reject(error);
    });
    child.on('close', (code) => {
      clearTimers();
      if (timeoutError) {
        reject(timeoutError);
        return;
      }
      resolve({ stdout, stderr, exitCode: code });
    });
    if (stdin !== undefined) child.stdin.write(stdin);
    child.stdin.end();
  });

const readRecording = async (recordingFile, argv, stderr) => {
  let raw;
  try {
    raw = await fs.readFile(recordingFile, 'utf8');
  } catch (error) {
    throw new Error(
      `HARNESS ERROR: the preload wrote no recording for "${argv.join(' ')}" (${error.code ?? error.message}). ` +
        `The CLI child did not run under tests/helpers/preload.js. stderr:\n${stderr}`,
    );
  }
  let recording;
  try {
    recording = JSON.parse(raw);
  } catch (error) {
    throw new Error(`HARNESS ERROR: the recording for "${argv.join(' ')}" is not valid JSON: ${error.message}`);
  }
  if (!Array.isArray(recording?.requests) || !Array.isArray(recording?.harnessErrors)) {
    throw new Error(`HARNESS ERROR: the recording for "${argv.join(' ')}" has an unexpected shape`);
  }
  if (recording.harnessErrors.length > 0) {
    throw new Error(
      `HARNESS ERROR: the fetch stub failed while running "${argv.join(' ')}":\n${recording.harnessErrors.join('\n')}`,
    );
  }
  return recording.requests;
};

const removeConfigDir = async (configDir) => {
  try {
    await fs.rm(configDir, {
      recursive: true,
      force: true,
      maxRetries: CLEANUP_MAX_RETRIES,
      retryDelay: CLEANUP_RETRY_DELAY_MS,
    });
  } catch {
    return;
  }
};

export const runCli = async (
  argv,
  { config, rawConfig, responses, stdin, timeoutMs = DEFAULT_TIMEOUT_MS, env = {} } = {},
) => {
  if (rawConfig !== undefined && config !== undefined && config !== null) {
    throw new Error('HARNESS ERROR: a fixture may set either config or rawConfig, not both');
  }
  const jsonFileContents = await readJsonFileContents(argv);
  const knownInputs = [argv, config, rawConfig, responses, stdin, env, jsonFileContents];
  const normalizeUuid = createUuidNormalizer(matchAll(knownInputs, createUuidPattern()));
  const normalizeApiKey = createApiKeyNormalizer(matchAll(knownInputs, createApiKeyPattern()));
  const normalizeJsonParseError = createJsonParseErrorNormalizer(
    collectJsonParseMessages({ argv, stdin, rawConfig, responses, jsonFileContents }),
  );
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outrank-cli-test-'));
  const recordingFile = path.join(configDir, 'recording.json');

  try {
    if (rawConfig !== undefined) {
      await fs.writeFile(path.join(configDir, 'config.json'), rawConfig, 'utf8');
    } else if (config) {
      await fs.writeFile(path.join(configDir, 'config.json'), JSON.stringify(config), 'utf8');
    }

    const childEnv = cleanEnv({
      OUTRANK_CONFIG_DIR: configDir,
      OUTRANK_TEST_RECORDING_FILE: recordingFile,
      OUTRANK_TEST_RESPONSES: JSON.stringify(responses ?? []),
      ...env,
    });

    const result = await spawnCli(argv, { childEnv, stdin, timeoutMs });
    const requests = await readRecording(recordingFile, argv, result.stderr);

    const version = await readPackageVersion();
    const normalizeContext = { configDir, version, normalizeUuid, normalizeApiKey, normalizeJsonParseError };
    const normalizedRequests = JSON.parse(normalizeOutput(JSON.stringify(requests), normalizeContext));

    return {
      exitCode: result.exitCode,
      stdout: normalizeOutput(result.stdout, normalizeContext),
      stderr: normalizeOutput(result.stderr, { ...normalizeContext, preserveJsonEscapes: false }),
      requests: normalizedRequests,
    };
  } finally {
    await removeConfigDir(configDir);
  }
};

export const parseJsonOutput = (stdout) => {
  try {
    return JSON.parse(stdout);
  } catch {
    return undefined;
  }
};
