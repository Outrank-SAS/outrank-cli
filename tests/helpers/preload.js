import fs from 'node:fs';
import path from 'node:path';

const RECORDING_ENV = 'OUTRANK_TEST_RECORDING_FILE';
const RESPONSES_ENV = 'OUTRANK_TEST_RESPONSES';
const DEFAULT_STATUS = 200;
const MIN_RESPONSE_STATUS = 200;
const MAX_RESPONSE_STATUS = 599;
const DEFAULT_CONTENT_TYPE = 'application/json';
const NULL_BODY_STATUSES = new Set([204, 205, 304]);
const KNOWN_SPEC_KEYS = new Set(['status', 'body', 'rawBody', 'contentType', 'headers', 'networkError']);
const DEFAULT_RESPONSE = { status: DEFAULT_STATUS, body: { ok: true, data: { stub: true }, agent_guidance: 'stub' } };

const harnessError = (message) => Object.assign(new Error(`HARNESS ERROR: ${message}`), { harness: true });

const validateSpec = (spec, index) => {
  if (spec === null || typeof spec !== 'object') {
    throw harnessError(`response ${index} is not an object`);
  }
  const unknownKeys = Object.keys(spec).filter((key) => !KNOWN_SPEC_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw harnessError(`response ${index} has unknown keys: ${unknownKeys.join(', ')}`);
  }
  if (spec.networkError !== undefined && (typeof spec.networkError !== 'string' || spec.networkError === '')) {
    throw harnessError(`response ${index} has an empty or non-string networkError`);
  }
  if (spec.status !== undefined) {
    const isInteger = Number.isInteger(spec.status);
    const inRange = isInteger && spec.status >= MIN_RESPONSE_STATUS && spec.status <= MAX_RESPONSE_STATUS;
    if (!inRange) {
      const allowed = `${MIN_RESPONSE_STATUS}-${MAX_RESPONSE_STATUS}`;
      throw harnessError(`response ${index} has status ${spec.status}; use ${allowed}`);
    }
  }
};

const parseResponses = () => {
  const raw = process.env[RESPONSES_ENV];
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw harnessError(`${RESPONSES_ENV} must be a JSON array, got ${typeof parsed}`);
  }
  parsed.forEach(validateSpec);
  return parsed;
};

const responses = parseResponses();
const recorded = [];
const harnessErrors = [];

const pickResponse = (index) => responses[index] ?? DEFAULT_RESPONSE;

const buildHeaders = (spec) => {
  const headers = new Headers(spec.headers ?? {});
  if (spec.contentType !== null && !headers.has('content-type')) {
    headers.set('content-type', spec.contentType ?? DEFAULT_CONTENT_TYPE);
  }
  return headers;
};

const serializeBody = (spec) => {
  if (spec.rawBody !== undefined) return spec.rawBody;
  if (spec.body === undefined) return '';
  return JSON.stringify(spec.body);
};

const sortHeaders = (headers) => {
  const entries = Object.entries(headers ?? {});
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
};

const parseRequestBody = (body) => {
  if (body === undefined || body === null) return undefined;
  if (typeof body !== 'string') {
    const bodyType = body.constructor?.name ?? typeof body;
    throw harnessError(`only string request bodies are recorded, got ${bodyType}`);
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

const stubFetch = async (input, init = {}) => {
  const url = input instanceof URL ? input : new URL(String(input));
  const callIndex = recorded.length;
  recorded.push({
    method: init.method ?? 'GET',
    url: url.toString(),
    headers: sortHeaders(init.headers),
    body: parseRequestBody(init.body),
  });

  if (init.signal?.aborted) {
    throw Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
  }

  const spec = pickResponse(callIndex);
  if (spec.networkError !== undefined) {
    throw new TypeError(spec.networkError);
  }
  const status = spec.status ?? DEFAULT_STATUS;
  const body = NULL_BODY_STATUSES.has(status) ? null : serializeBody(spec);
  return new Response(body, { status, headers: buildHeaders(spec) });
};

globalThis.fetch = async (input, init) => {
  try {
    return await stubFetch(input, init);
  } catch (error) {
    if (error.harness) harnessErrors.push(error.message);
    throw error;
  }
};

const flushRecording = () => {
  const target = process.env[RECORDING_ENV];
  if (!target) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify({ requests: recorded, harnessErrors }), 'utf8');
};

process.on('exit', flushRecording);
