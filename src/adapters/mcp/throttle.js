import { HttpStatus, RATE_LIMIT_HEADERS } from '../../core/constants.js';
import { CliErrorCode, codedError } from '../../core/errors.js';
import {
  MCP_RATE_LIMIT_DEFAULT_RETRY_MS,
  MCP_RATE_LIMIT_MAX_WAIT_MS,
  MCP_RATE_LIMIT_PER_MINUTE,
  MCP_RATE_LIMIT_WINDOW_MS,
  MILLISECONDS_PER_SECOND,
} from './constants.js';

const INTEGER_PATTERN = /^\d{1,10}$/;
const HTTP_DATE_PATTERN = /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;
const ABORT_ERROR_NAME = 'AbortError';
const WAIT_TOO_LONG_GUIDANCE =
  'Outrank is rate limiting this API key. Wait for the number of seconds in details.retry_after_seconds, then ' +
  'call again; the request was not sent.';

const waitTooLongError = (delayMs) =>
  codedError(
    CliErrorCode.NETWORK_ERROR,
    `Rate limited: the next request could not be sent for another ${Math.ceil(delayMs / MILLISECONDS_PER_SECOND)} s.`,
    WAIT_TOO_LONG_GUIDANCE,
    { retry_after_seconds: Math.ceil(delayMs / MILLISECONDS_PER_SECOND), rate_limited: true },
  );

const abortError = (signal) =>
  signal?.reason instanceof Error ? signal.reason : new DOMException('The request was cancelled.', ABORT_ERROR_NAME);

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });

const headerInteger = (headers, name) => {
  const value = headers?.[name];
  return typeof value === 'string' && INTEGER_PATTERN.test(value) ? Number(value) : null;
};

const monotonicNow = () => performance.now();

const retryAfterMs = (headers, wallNow) => {
  const value = headers?.[RATE_LIMIT_HEADERS.retryAfter];
  if (typeof value !== 'string') return null;
  if (INTEGER_PATTERN.test(value)) return Number(value) * MILLISECONDS_PER_SECOND;
  const retryAt = HTTP_DATE_PATTERN.test(value) ? Date.parse(value) : Number.NaN;
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - wallNow());
};

export const createRequestThrottle = ({
  limitPerMinute = MCP_RATE_LIMIT_PER_MINUTE,
  windowMs = MCP_RATE_LIMIT_WINDOW_MS,
  defaultRetryMs = MCP_RATE_LIMIT_DEFAULT_RETRY_MS,
  maxWaitMs = MCP_RATE_LIMIT_MAX_WAIT_MS,
  now = monotonicNow,
  wallNow = Date.now,
  wait = sleep,
} = {}) => {
  const sentAt = [];
  let serverHint = null;
  let blockedUntil = 0;
  let queue = Promise.resolve();

  const prune = (time) => {
    while (sentAt.length > 0 && sentAt[0] <= time - windowMs) sentAt.shift();
  };

  const delayNeeded = (time) => {
    if (time < blockedUntil) return blockedUntil - time;
    prune(time);
    if (sentAt.length >= limitPerMinute) return sentAt[0] + windowMs - time;
    if (serverHint !== null && time >= serverHint.until) serverHint = null;
    if (serverHint !== null && serverHint.remaining <= 0) return serverHint.until - time;
    return 0;
  };

  const reserve = async (signal) => {
    for (;;) {
      if (signal?.aborted) throw abortError(signal);
      const time = now();
      const delay = delayNeeded(time);
      if (delay <= 0) {
        sentAt.push(time);
        if (serverHint !== null) serverHint.remaining -= 1;
        return;
      }
      if (delay > maxWaitMs) throw waitTooLongError(delay);
      await wait(delay, signal);
    }
  };

  const abortWhile = (signal, pending) => {
    if (!signal) return pending;
    return new Promise((resolve, reject) => {
      const onAbort = () => reject(abortError(signal));
      signal.addEventListener('abort', onAbort, { once: true });
      pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  };

  const acquire = (signal) => {
    if (signal?.aborted) return Promise.reject(abortError(signal));
    const turn = queue.then(() => reserve(signal));
    queue = turn.catch(() => {});
    return abortWhile(signal, turn);
  };

  const observe = ({ status, headers } = {}) => {
    const time = now();
    if (status !== HttpStatus.TOO_MANY_REQUESTS) {
      const remaining = headerInteger(headers, RATE_LIMIT_HEADERS.remainingMinute);
      if (remaining !== null) serverHint = { remaining, until: time + windowMs };
      return;
    }
    serverHint = null;
    blockedUntil = Math.max(blockedUntil, time + (retryAfterMs(headers, wallNow) ?? defaultRetryMs));
  };

  return { acquire, observe };
};
