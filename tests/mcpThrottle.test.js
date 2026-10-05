import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MCP_RATE_LIMIT_DEFAULT_RETRY_MS,
  MCP_RATE_LIMIT_PER_MINUTE,
  MCP_RATE_LIMIT_WINDOW_MS,
} from '../src/adapters/mcp/constants.js';
import { createRequestThrottle } from '../src/adapters/mcp/throttle.js';
import { HttpStatus } from '../src/core/constants.js';
import { CliErrorCode } from '../src/core/errors.js';
import { delay, jsonResponse, respondWith, withMcp } from './helpers/mcpHarness.js';

const LIMIT = 3;
const WINDOW_MS = 1_000;
const RETRY_AFTER_SECONDS = 7;
const HUGE_RETRY_AFTER = 9_999_999_999;
const MAX_WAIT_MS = 10_000;
const SECOND_MS = 1_000;
const HARNESS_WINDOW_MS = 150;
const HARNESS_LIMIT = 2;
const HARNESS_CALLS = 4;
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const REMAINING_HEADER = 'x-ratelimit-remaining-minute';
const WALL_NOW_MS = Date.UTC(2026, 9, 4, 12, 0, 0);
const MALFORMED_RETRY_AFTER_VALUES = Object.freeze(['soon', '-5', '1.5', '2026-10-04T12:00:07Z', '']);
const STEP_WINDOW_MS = 40;
const STEP_MAX_WAIT_MS = 1_000;
const CLOCK_STEP_BACK_MS = 3_600_000;
const BODY_READ_FAILURE = 'the connection dropped while the body was being read';

const fakeClock = () => {
  const state = { time: 0, waits: [] };
  return {
    now: () => state.time,
    wait: async (ms) => {
      state.waits.push(ms);
      state.time += ms;
    },
    waits: state.waits,
    advance: (ms) => {
      state.time += ms;
    },
  };
};

const throttleWith = (clock, overrides = {}) =>
  createRequestThrottle({ limitPerMinute: LIMIT, windowMs: WINDOW_MS, now: clock.now, wait: clock.wait, ...overrides });

test('the default budget matches the server limit: 120 requests per 60 seconds', () => {
  assert.equal(MCP_RATE_LIMIT_PER_MINUTE, 120);
  assert.equal(MCP_RATE_LIMIT_WINDOW_MS, 60_000);
});

test('requests past the window limit wait until the oldest one leaves the window', async () => {
  const clock = fakeClock();
  const throttle = throttleWith(clock);
  for (let index = 0; index < LIMIT; index += 1) {
    await throttle.acquire();
    clock.advance(100);
  }
  assert.deepEqual(clock.waits, []);
  await throttle.acquire();
  assert.deepEqual(clock.waits, [WINDOW_MS - LIMIT * 100]);
  clock.advance(WINDOW_MS);
  await throttle.acquire();
  assert.equal(clock.waits.length, 1);
});

test('the server remaining count lowers the budget until the window has passed', async () => {
  const clock = fakeClock();
  const throttle = throttleWith(clock);
  await throttle.acquire();
  throttle.observe({ status: 200, headers: { [REMAINING_HEADER]: '1' } });
  await throttle.acquire();
  assert.deepEqual(clock.waits, []);
  await throttle.acquire();
  assert.deepEqual(clock.waits, [WINDOW_MS]);
  throttle.observe({ status: 200, headers: { [REMAINING_HEADER]: 'not-a-number' } });
  clock.advance(WINDOW_MS);
  await throttle.acquire();
  assert.equal(clock.waits.length, 1);
});

test('a 429 blocks every request for Retry-After seconds, or the default pause without the header', async () => {
  const clock = fakeClock();
  const throttle = throttleWith(clock);
  throttle.observe({
    status: HttpStatus.TOO_MANY_REQUESTS,
    headers: { 'retry-after': String(RETRY_AFTER_SECONDS), [REMAINING_HEADER]: '0' },
  });
  await throttle.acquire();
  assert.deepEqual(clock.waits, [RETRY_AFTER_SECONDS * SECOND_MS]);
  const bare = throttleWith(clock, { windowMs: WINDOW_MS * 2 });
  bare.observe({ status: HttpStatus.TOO_MANY_REQUESTS, headers: {} });
  await bare.acquire();
  assert.deepEqual(clock.waits, [RETRY_AFTER_SECONDS * SECOND_MS, MCP_RATE_LIMIT_DEFAULT_RETRY_MS]);
});

test('Retry-After given as an HTTP date waits until that moment, and a date already past does not wait', async () => {
  const clock = fakeClock();
  const throttle = throttleWith(clock, { wallNow: () => WALL_NOW_MS });
  throttle.observe({
    status: HttpStatus.TOO_MANY_REQUESTS,
    headers: { 'retry-after': new Date(WALL_NOW_MS + RETRY_AFTER_SECONDS * SECOND_MS).toUTCString() },
  });
  await throttle.acquire();
  assert.deepEqual(clock.waits, [RETRY_AFTER_SECONDS * SECOND_MS]);
  const past = throttleWith(clock, { wallNow: () => WALL_NOW_MS });
  past.observe({
    status: HttpStatus.TOO_MANY_REQUESTS,
    headers: { 'retry-after': new Date(WALL_NOW_MS - SECOND_MS).toUTCString() },
  });
  await past.acquire();
  assert.deepEqual(clock.waits, [RETRY_AFTER_SECONDS * SECOND_MS]);
});

test('a Retry-After that is neither seconds nor an HTTP date falls back to the default pause', async () => {
  for (const value of MALFORMED_RETRY_AFTER_VALUES) {
    const clock = fakeClock();
    const throttle = throttleWith(clock, { windowMs: WINDOW_MS * 2, wallNow: () => WALL_NOW_MS });
    throttle.observe({ status: HttpStatus.TOO_MANY_REQUESTS, headers: { 'retry-after': value } });
    await throttle.acquire();
    assert.deepEqual(clock.waits, [MCP_RATE_LIMIT_DEFAULT_RETRY_MS], JSON.stringify(value));
  }
});

test('a wall clock that jumps back does not stretch the window into a rate-limit failure', async (t) => {
  const realNow = Date.now.bind(Date);
  let wallOffsetMs = 0;
  t.mock.method(Date, 'now', () => realNow() + wallOffsetMs);
  const throttle = createRequestThrottle({ limitPerMinute: 1, windowMs: STEP_WINDOW_MS, maxWaitMs: STEP_MAX_WAIT_MS });
  await throttle.acquire();
  wallOffsetMs = -CLOCK_STEP_BACK_MS;
  const startedAt = performance.now();
  await throttle.acquire();
  const waitedMs = performance.now() - startedAt;
  assert.ok(waitedMs < STEP_MAX_WAIT_MS, `${waitedMs} ms`);
});

test('a 429 clears the remaining-count hint, so the wait ends with Retry-After and not with the window', async () => {
  const clock = fakeClock();
  const throttle = throttleWith(clock, { windowMs: MCP_RATE_LIMIT_WINDOW_MS });
  throttle.observe({ status: 200, headers: { [REMAINING_HEADER]: '1' } });
  throttle.observe({
    status: HttpStatus.TOO_MANY_REQUESTS,
    headers: { 'retry-after': String(RETRY_AFTER_SECONDS), [REMAINING_HEADER]: '0' },
  });
  await throttle.acquire();
  assert.deepEqual(clock.waits, [RETRY_AFTER_SECONDS * SECOND_MS]);
  await throttle.acquire();
  assert.deepEqual(clock.waits, [RETRY_AFTER_SECONDS * SECOND_MS]);
});

test('a wait longer than the cap fails fast with the seconds to wait instead of sleeping', async () => {
  const clock = fakeClock();
  const throttle = throttleWith(clock, { maxWaitMs: MAX_WAIT_MS });
  throttle.observe({ status: HttpStatus.TOO_MANY_REQUESTS, headers: { 'retry-after': String(HUGE_RETRY_AFTER) } });
  await assert.rejects(throttle.acquire(), (error) => {
    assert.equal(error.cliCode, CliErrorCode.NETWORK_ERROR);
    assert.equal(error.details.retry_after_seconds, HUGE_RETRY_AFTER);
    return true;
  });
  assert.deepEqual(clock.waits, []);
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(throttle.acquire(cancelled.signal), { name: 'AbortError' });
});

test('waiting requests are served in order and a cancelled one does not hold the others', async () => {
  const clock = fakeClock();
  const order = [];
  const throttle = throttleWith(clock, {
    wait: async (ms) => {
      clock.waits.push(ms);
      clock.advance(ms);
    },
  });
  for (let index = 0; index < LIMIT; index += 1) await throttle.acquire();
  const cancelled = new AbortController();
  const first = throttle.acquire(cancelled.signal).then(() => order.push('first'));
  const second = throttle.acquire().then(() => order.push('second'));
  const third = throttle.acquire().then(() => order.push('third'));
  cancelled.abort();
  await assert.rejects(first, { name: 'AbortError' });
  await Promise.all([second, third]);
  assert.deepEqual(order, ['second', 'third']);
});

test('a request cancelled while queued behind a long wait rejects at once, not when its turn comes', async () => {
  const clock = fakeClock();
  let releaseWait;
  const throttle = throttleWith(clock, {
    wait: () => new Promise((resolve) => (releaseWait = resolve)),
  });
  for (let index = 0; index < LIMIT; index += 1) await throttle.acquire();
  const blocked = throttle.acquire();
  const cancelled = new AbortController();
  const queued = throttle.acquire(cancelled.signal);
  await delay(0);
  cancelled.abort();
  const settled = await Promise.race([queued.then(() => 'served', () => 'rejected'), delay(50).then(() => 'hung')]);
  assert.equal(settled, 'rejected');
  clock.advance(WINDOW_MS);
  releaseWait();
  await blocked;
});

test('a client that fans out calls gets them queued instead of rejected', async () => {
  const throttle = createRequestThrottle({ limitPerMinute: HARNESS_LIMIT, windowMs: HARNESS_WINDOW_MS });
  const stamps = [];
  const respond = respondWith({
    other: () => {
      stamps.push(Date.now());
      return jsonResponse(200, { ok: true, data: { id: PRODUCT_ID }, agent_guidance: 'ok' });
    },
  });
  await withMcp({ respond, throttle }, async ({ call }) => {
    await delay(HARNESS_WINDOW_MS);
    const startedAt = Date.now();
    const results = await Promise.all(
      Array.from({ length: HARNESS_CALLS }, () => call('products_get', { product_id: PRODUCT_ID })),
    );
    assert.ok(results.every(({ envelope }) => envelope.ok === true));
    assert.equal(stamps.length, HARNESS_CALLS);
    assert.ok(stamps[HARNESS_LIMIT] - startedAt >= HARNESS_WINDOW_MS - 1, `${stamps[HARNESS_LIMIT] - startedAt} ms`);
    assert.ok(stamps[HARNESS_LIMIT - 1] - startedAt < HARNESS_WINDOW_MS, `${stamps[HARNESS_LIMIT - 1] - startedAt}`);
  });
});

const unreadableBodyResponse = (status, headers) =>
  new Response(
    new ReadableStream({
      pull: (controller) => {
        controller.error(new Error(BODY_READ_FAILURE));
      },
    }),
    { status, headers },
  );

test('a 429 whose body cannot be read still blocks the next request for Retry-After seconds', async () => {
  const clock = fakeClock();
  const throttle = createRequestThrottle({ now: clock.now, wait: clock.wait });
  let unreadableSent = false;
  const respond = respondWith({
    other: () => {
      if (unreadableSent) return jsonResponse(200, { ok: true, data: { id: PRODUCT_ID }, agent_guidance: 'ok' });
      unreadableSent = true;
      return unreadableBodyResponse(HttpStatus.TOO_MANY_REQUESTS, { 'retry-after': String(RETRY_AFTER_SECONDS) });
    },
  });
  await withMcp({ respond, throttle }, async ({ call }) => {
    const failed = await call('products_get', { product_id: PRODUCT_ID });
    assert.equal(failed.envelope.ok, false);
    assert.equal(failed.envelope.error.code, CliErrorCode.NETWORK_ERROR);
    assert.equal(Object.hasOwn(failed.envelope.error, 'receivedResponse'), false);
    const waitsBefore = clock.waits.length;
    const retried = await call('products_get', { product_id: PRODUCT_ID });
    assert.equal(retried.envelope.ok, true, JSON.stringify(retried.envelope));
    assert.deepEqual(clock.waits.slice(waitsBefore), [RETRY_AFTER_SECONDS * SECOND_MS]);
  });
});
