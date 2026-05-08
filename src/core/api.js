import { cliError } from './errors.js';
import { resolveRuntimeConfig } from './config.js';

const API_BASE_PATH = '/api/agent/v1';

export const resolveApiContext = async (parsed, { requireAuth = true } = {}) => {
  const runtime = await resolveRuntimeConfig(parsed);
  if (requireAuth && !runtime.apiKey) {
    throw Object.assign(new Error('No Outrank API key is configured.'), {
      cliCode: 'CLI_AUTH_REQUIRED',
      guidance:
        'Run `outrank-cli auth login <api-key>` to store a key locally, or set OUTRANK_API_KEY in the environment before retrying.',
    });
  }
  return runtime;
};

const buildHeaders = ({ apiKey, idempotencyKey, hasJsonBody }) => {
  const headers = {
    Accept: 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (hasJsonBody) {
    headers['Content-Type'] = 'application/json';
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  return headers;
};

export const requestAgentApi = async (
  parsed,
  { method = 'GET', path, body, idempotencyKey, requireAuth = true } = {},
) => {
  const runtime = await resolveApiContext(parsed, { requireAuth });
  const url = new URL(`${API_BASE_PATH}${path}`, runtime.baseUrl);
  const response = await fetch(url, {
    method,
    headers: buildHeaders({
      apiKey: runtime.apiKey,
      idempotencyKey,
      hasJsonBody: body !== undefined,
    }),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }).catch((error) => {
    throw Object.assign(new Error(`Request failed: ${error.message}`), {
      cliCode: 'CLI_NETWORK_ERROR',
      guidance:
        `The CLI could not reach ${runtime.baseUrl}. Confirm OUTRANK_BASE_URL, the user's network, and the Outrank deployment, then retry.`,
    });
  });

  const contentType = response.headers.get('content-type') ?? '';
  let payload;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    const guidance =
      response.status === 404
        ? `The host ${runtime.baseUrl} responded, but ${url.pathname} is not deployed there. Point OUTRANK_BASE_URL or --base-url at the Outrank app deployment that serves the agent API, or deploy the /api/agent/v1 routes to this host.`
        : 'The CLI expects the agent API to return JSON. Check the base URL and server deployment.';
    payload = cliError(
      'CLI_NON_JSON_RESPONSE',
      `Outrank returned HTTP ${response.status} without a JSON body.`,
      guidance,
      { status: response.status, url: url.toString() },
    );
  }

  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    payload,
    runtime,
  };
};
