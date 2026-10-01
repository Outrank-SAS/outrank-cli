import { test } from 'node:test';
import assert from 'node:assert/strict';

import { API_BASE_PATH, HTTP_REQUEST_TIMEOUT_MS, ProfileSource } from '../src/core/constants.js';
import { CliErrorCode } from '../src/core/errors.js';
import { buildRequestUrl, requestAgentApi } from '../src/core/http.js';

const BASE_URL = 'https://www.outrank.so';
const CTX = { apiKey: 'outr_live_test_key', baseUrl: BASE_URL };
const JSON_HEADERS = { 'content-type': 'application/json' };
const SHORT_TIMEOUT_MS = 30;

const jsonResponse = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });

const withFetch = async (handler, run) => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: input.toString(), init });
    return handler(input, init, calls.length);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = original;
  }
};

const rejectsWithCode = async (promise, code, messagePattern) => {
  await assert.rejects(promise, (error) => {
    assert.equal(error.cliCode, code);
    if (messagePattern) assert.match(error.message, messagePattern);
    return true;
  });
};

test('502 with a non-envelope JSON body is ok:false CLI_UPSTREAM_ERROR, never a success', async () => {
  await withFetch(
    () => jsonResponse(502, { message: 'upstream exploded' }),
    async () => {
      const { result, status } = await requestAgentApi(CTX, { method: 'GET', path: '/usage/stats' });
      assert.equal(status, 502);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, CliErrorCode.UPSTREAM_ERROR);
      assert.equal(result.error.details.status, 502);
      assert.equal(result.error.details.body, '{"message":"upstream exploded"}');
    },
  );
});

test('502 with a well-formed error envelope passes the envelope through unchanged', async () => {
  const envelope = { ok: false, error: { code: 'INTERNAL_ERROR', message: 'boom' }, agent_guidance: 'retry later' };
  await withFetch(
    () => jsonResponse(502, envelope),
    async () => {
      const { result } = await requestAgentApi(CTX, { path: '/usage/stats' });
      assert.deepEqual(result, envelope);
    },
  );
});

test('200 with an ok:true envelope that claims ok on a 4xx is not trusted', async () => {
  await withFetch(
    () => jsonResponse(403, { ok: true, data: { sneaky: true } }),
    async () => {
      const { result } = await requestAgentApi(CTX, { path: '/usage/stats' });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, CliErrorCode.UPSTREAM_ERROR);
    },
  );
});

test('204 on a DELETE is ok:true with data null, not CLI_NON_JSON_RESPONSE', async () => {
  await withFetch(
    () => new Response(null, { status: 204 }),
    async () => {
      const request = { method: 'DELETE', path: '/keywords/{id}', pathParams: { id: 'k1' } };
      const { result, status } = await requestAgentApi(CTX, request);
      assert.equal(status, 204);
      assert.deepEqual(result, { ok: true, data: null, agent_guidance: undefined });
    },
  );
});

test('200 with an empty body is CLI_NON_JSON_RESPONSE, never a silent ok:true', async () => {
  await withFetch(
    () => new Response('', { status: 200, headers: JSON_HEADERS }),
    async () => {
      const request = { method: 'DELETE', path: '/articles/{id}', pathParams: { id: 'a1' } };
      const { result } = await requestAgentApi(CTX, request);
      assert.equal(result.ok, false);
      assert.equal(result.error.code, CliErrorCode.NON_JSON_RESPONSE);
      assert.equal(result.error.details.status, 200);
    },
  );
});

test('application/json with a malformed body is CLI_NON_JSON_RESPONSE, never a raw SyntaxError', async () => {
  await withFetch(
    () => new Response('{"stub":', { status: 200, headers: JSON_HEADERS }),
    async () => {
      const { result } = await requestAgentApi(CTX, { path: '/usage/stats' });
      assert.equal(result.ok, false);
      assert.equal(result.error.code, CliErrorCode.NON_JSON_RESPONSE);
      assert.match(result.error.message, /malformed JSON body/);
      assert.equal(result.error.details.status, 200);
    },
  );
});

test('a non-JSON 404 keeps the deployment guidance the CLI prints today', async () => {
  await withFetch(
    () => new Response('<html>not here</html>', { status: 404, headers: { 'content-type': 'text/html' } }),
    async () => {
      const { result } = await requestAgentApi(CTX, { path: '/usage/stats' });
      assert.equal(result.error.code, CliErrorCode.UPSTREAM_ERROR);
      assert.equal(result.error.details.status, 404);
      assert.match(result.agent_guidance, /is not deployed there/);
      assert.equal(result.error.details.body, '<html>not here</html>');
    },
  );
});

test('a 200 with a non-JSON body keeps the CLI_NON_JSON_RESPONSE wording', async () => {
  await withFetch(
    () => new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }),
    async () => {
      const { result } = await requestAgentApi(CTX, { path: '/usage/stats' });
      assert.equal(result.error.code, CliErrorCode.NON_JSON_RESPONSE);
      assert.equal(result.error.message, 'Outrank returned HTTP 200 without a JSON body.');
      assert.deepEqual(result.error.details, { status: 200, url: `${BASE_URL}${API_BASE_PATH}/usage/stats` });
    },
  );
});

test('a request that never responds aborts at the request timeout with timeout guidance', async () => {
  const hang = (_, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  await withFetch(hang, async () => {
    const started = Date.now();
    await rejectsWithCode(
      requestAgentApi({ ...CTX, requestTimeoutMs: SHORT_TIMEOUT_MS }, { path: '/usage/stats' }),
      CliErrorCode.NETWORK_ERROR,
      new RegExp(`timed out after ${SHORT_TIMEOUT_MS} ms`),
    );
    assert.ok(Date.now() - started < HTTP_REQUEST_TIMEOUT_MS);
  });
});

test('a long-running request uses the long-running timeout and its guidance says to poll, not retry', async () => {
  const hang = (_, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  await withFetch(hang, async () => {
    await assert.rejects(
      requestAgentApi({ ...CTX, longRunningTimeoutMs: SHORT_TIMEOUT_MS }, { path: '/x/analyze', longRunning: true }),
      (error) => {
        assert.equal(error.cliCode, CliErrorCode.NETWORK_ERROR);
        assert.match(error.guidance, /may still be running/);
        return true;
      },
    );
  });
});

test('an external abort signal cancels the request as CLI_NETWORK_ERROR without the timeout wording', async () => {
  const controller = new AbortController();
  const hang = (_, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  await withFetch(hang, async () => {
    const pending = requestAgentApi({ ...CTX, signal: controller.signal }, { path: '/usage/stats' });
    controller.abort();
    await rejectsWithCode(pending, CliErrorCode.NETWORK_ERROR, /Request failed: aborted/);
  });
});

test('a network failure keeps the message and guidance the CLI prints today', async () => {
  await withFetch(
    () => {
      throw new TypeError('fetch failed');
    },
    async () => {
      await assert.rejects(requestAgentApi(CTX, { path: '/usage/stats' }), (error) => {
        assert.equal(error.cliCode, CliErrorCode.NETWORK_ERROR);
        assert.equal(error.message, 'Request failed: fetch failed');
        assert.match(error.guidance, new RegExp(`could not reach ${BASE_URL}`));
        return true;
      });
    },
  );
});

test('429 carries Retry-After and both X-RateLimit-Remaining values in error.details', async () => {
  const envelope = { ok: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'slow down' }, agent_guidance: 'wait' };
  const headers = {
    'retry-after': '17',
    'x-ratelimit-limit-minute': '120',
    'x-ratelimit-remaining-minute': '0',
    'x-ratelimit-limit-day': '5000',
    'x-ratelimit-remaining-day': '4312',
  };
  await withFetch(
    () => jsonResponse(429, envelope, headers),
    async () => {
      const { result } = await requestAgentApi(CTX, { path: '/usage/stats' });
      assert.equal(result.error.code, 'RATE_LIMIT_EXCEEDED');
      assert.equal(result.error.details.retry_after, '17');
      assert.equal(result.error.details.rate_limit.remaining_minute, '0');
      assert.equal(result.error.details.rate_limit.remaining_day, '4312');
      assert.equal(result.error.details.rate_limit.limit_minute, '120');
      assert.equal(result.agent_guidance, 'wait');
    },
  );
});

test('a 429 without rate-limit headers passes the envelope through untouched', async () => {
  const envelope = { ok: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'slow down' }, agent_guidance: 'wait' };
  await withFetch(
    () => jsonResponse(429, envelope),
    async () => {
      const { result } = await requestAgentApi(CTX, { path: '/usage/stats' });
      assert.deepEqual(result, envelope);
    },
  );
});

test('path parameters are encoded so an id cannot change the route', () => {
  const traversal = buildRequestUrl({ baseUrl: BASE_URL, path: '/articles/{id}', pathParams: { id: '../articles/x' } });
  assert.equal(traversal.pathname, `${API_BASE_PATH}/articles/..%2Farticles%2Fx`);
  const question = buildRequestUrl({ baseUrl: BASE_URL, path: '/articles/{id}', pathParams: { id: 'a?b' } });
  assert.equal(question.pathname, `${API_BASE_PATH}/articles/a%3Fb`);
  assert.equal(question.search, '');
  const withQuery = buildRequestUrl({
    baseUrl: BASE_URL,
    path: '/products/{id}/keywords',
    pathParams: { id: 'p 1' },
    query: { limit: 5, status: undefined, search: 'a&b' },
  });
  assert.equal(withQuery.pathname, `${API_BASE_PATH}/products/p%201/keywords`);
  assert.equal(withQuery.search, '?limit=5&search=a%26b');
});

test('a path template that leaves the agent API prefix is rejected before any request', () => {
  assert.throws(() => buildRequestUrl({ baseUrl: BASE_URL, path: '/../../admin' }), (error) => {
    assert.equal(error.cliCode, CliErrorCode.UNEXPECTED_ERROR);
    assert.match(error.message, /left \/api\/agent\/v1/);
    return true;
  });
  assert.throws(() => buildRequestUrl({ baseUrl: BASE_URL, path: '/articles/{id}', pathParams: {} }), (error) => {
    assert.equal(error.cliCode, CliErrorCode.UNEXPECTED_ERROR);
    assert.match(error.message, /Missing path parameter: id/);
    return true;
  });
});

test('headers carry the bearer key, JSON content type only with a body, and the idempotency key', async () => {
  await withFetch(
    () => jsonResponse(200, { ok: true, data: {} }),
    async (calls) => {
      await requestAgentApi(CTX, { method: 'POST', path: '/billing/quote', body: { n: 1 }, idempotencyKey: 'idem-1' });
      await requestAgentApi(CTX, { method: 'GET', path: '/usage/stats' });
      assert.deepEqual(calls[0].init.headers, {
        Accept: 'application/json',
        Authorization: 'Bearer outr_live_test_key',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'idem-1',
      });
      assert.equal(calls[0].init.body, '{"n":1}');
      assert.deepEqual(calls[1].init.headers, {
        Accept: 'application/json',
        Authorization: 'Bearer outr_live_test_key',
      });
      assert.equal('body' in calls[1].init, false);
    },
  );
});

test('a missing key is CLI_AUTH_REQUIRED before any request, unless the call opts out', async () => {
  await withFetch(
    () => jsonResponse(200, { ok: true, data: {} }),
    async (calls) => {
      const withoutKey = requestAgentApi({ baseUrl: BASE_URL }, { path: '/usage/stats' });
      await rejectsWithCode(withoutKey, CliErrorCode.AUTH_REQUIRED);
      assert.equal(calls.length, 0);
      const { result } = await requestAgentApi({ baseUrl: BASE_URL }, { path: '/auth/whoami', requireAuth: false });
      assert.equal(result.ok, true);
      assert.equal('Authorization' in calls[0].init.headers, false);
    },
  );
});

test('a missing key names the resolved profile: selected, stored default, or nothing at all', async () => {
  const explicit = { baseUrl: BASE_URL, profile: { name: 'staging', explicit: true, known: true } };
  await rejectsWithCode(
    requestAgentApi(explicit, { path: '/usage/stats' }),
    CliErrorCode.AUTH_REQUIRED,
    /Profile staging has no API key stored/,
  );
  const storedDefault = { baseUrl: BASE_URL, profile: { name: 'acme', explicit: false, known: true } };
  await assert.rejects(requestAgentApi(storedDefault, { path: '/usage/stats' }), (error) => {
    assert.equal(error.cliCode, CliErrorCode.AUTH_REQUIRED);
    assert.equal(error.message, 'The default profile acme has no API key stored.');
    assert.match(error.guidance, /--profile <name>/);
    return true;
  });
  const nothing = { baseUrl: BASE_URL, profile: { name: 'default', explicit: false, known: false } };
  await rejectsWithCode(
    requestAgentApi(nothing, { path: '/usage/stats' }),
    CliErrorCode.AUTH_REQUIRED,
    /No Outrank API key is configured/,
  );
});

test('a key with whitespace or control characters is rejected before any request and never echoed', async () => {
  const badKey = 'outr_live_SECRET\nKEY1234';
  await withFetch(
    () => jsonResponse(200, { ok: true, data: {} }),
    async (calls) => {
      const badKeyCtx = { apiKey: badKey, baseUrl: BASE_URL };
      await assert.rejects(requestAgentApi(badKeyCtx, { path: '/usage/stats' }), (error) => {
        assert.equal(error.cliCode, CliErrorCode.INVALID_USAGE);
        assert.doesNotMatch(error.message, /SECRET/);
        assert.doesNotMatch(error.guidance, /SECRET/);
        return true;
      });
      assert.equal(calls.length, 0);
      await assert.rejects(
        requestAgentApi({ apiKey: 'outr_live_SECRET KEY', baseUrl: BASE_URL }, { path: '/usage/stats' }),
        (error) => error.cliCode === CliErrorCode.INVALID_USAGE,
      );
      assert.equal(calls.length, 0);
    },
  );
});

test('a transport error message is redacted before it reaches the envelope', async () => {
  await withFetch(
    () => {
      throw new Error('boom Bearer outr_live_leaked_in_message');
    },
    async () => {
      await assert.rejects(requestAgentApi(CTX, { path: '/usage/stats' }), (error) => {
        assert.equal(error.cliCode, CliErrorCode.NETWORK_ERROR);
        assert.doesNotMatch(error.message, /outr_live_leaked_in_message/);
        assert.match(error.message, /Request failed: boom/);
        return true;
      });
    },
  );
});

test('an abort with a non-Error reason is still CLI_NETWORK_ERROR, never a raw TypeError', async () => {
  const controller = new AbortController();
  await withFetch(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
      }),
    async () => {
      const pending = requestAgentApi({ ...CTX, signal: controller.signal }, { path: '/usage/stats' });
      controller.abort('user cancelled');
      await rejectsWithCode(pending, CliErrorCode.NETWORK_ERROR, /Request failed: user cancelled/);
    },
  );
});

test('a keyless profile selected through OUTRANK_PROFILE tells the user how to unselect it', async () => {
  const fromEnv = {
    baseUrl: BASE_URL,
    profile: { name: 'staging', source: ProfileSource.ENV, explicit: true, known: true },
  };
  await assert.rejects(requestAgentApi(fromEnv, { path: '/usage/stats' }), (error) => {
    assert.equal(error.cliCode, CliErrorCode.AUTH_REQUIRED);
    assert.match(error.guidance, /selected by OUTRANK_PROFILE; unset it/);
    return true;
  });
  const fromFlag = {
    baseUrl: BASE_URL,
    profile: { name: 'staging', source: ProfileSource.FLAG, explicit: true, known: true },
  };
  await assert.rejects(requestAgentApi(fromFlag, { path: '/usage/stats' }), (error) => {
    assert.doesNotMatch(error.guidance, /unset it/);
    return true;
  });
});

test('a transport failure names its cause, and a redirect gets its own guidance', async () => {
  const dnsFailure = new TypeError('fetch failed', {
    cause: Object.assign(new Error('getaddrinfo ENOTFOUND www.outrank.so'), { code: 'ENOTFOUND' }),
  });
  await withFetch(
    () => {
      throw dnsFailure;
    },
    async () => {
      await assert.rejects(requestAgentApi(CTX, { path: '/usage/stats' }), (error) => {
        assert.equal(error.cliCode, CliErrorCode.NETWORK_ERROR);
        assert.equal(error.message, 'Request failed: fetch failed (ENOTFOUND: getaddrinfo ENOTFOUND www.outrank.so)');
        assert.doesNotMatch(error.guidance, /redirect/);
        return true;
      });
    },
  );
  const redirectFailure = new TypeError('fetch failed', { cause: new Error('unexpected redirect') });
  await withFetch(
    () => {
      throw redirectFailure;
    },
    async () => {
      await assert.rejects(requestAgentApi(CTX, { path: '/usage/stats' }), (error) => {
        assert.equal(error.message, 'Request failed: fetch failed (unexpected redirect)');
        assert.match(error.guidance, /never follows redirects/);
        return true;
      });
    },
  );
});

test('a null-prototype or empty abort reason still produces a coded network error', async () => {
  for (const reason of [Object.create(null), '']) {
    const controller = new AbortController();
    await withFetch(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
        }),
      async () => {
        const pending = requestAgentApi({ ...CTX, signal: controller.signal }, { path: '/usage/stats' });
        controller.abort(reason);
        await rejectsWithCode(pending, CliErrorCode.NETWORK_ERROR, /Request failed: unknown transport error/);
      },
    );
  }
});

test('a key typed into a query value is redacted from details.url', async () => {
  await withFetch(
    () => new Response('<html>oops</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    async () => {
      const { result } = await requestAgentApi(CTX, {
        path: '/keywords',
        query: { search: 'outr_live_typed_into_search' },
      });
      assert.equal(result.ok, false);
      assert.doesNotMatch(result.error.details.url, /typed_into_search/);
      assert.match(result.error.details.url, /search=<redacted>/);
    },
  );
});
