import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';

import { CliErrorCode, codedError } from './errors.js';
import {
  API_KEY_FIELD,
  OAUTH_FIELD,
  getConfigPath,
  loadConfig,
  readRawProfile,
  storeProfileOauth,
} from './config.js';

const METADATA_PATH = '/api/oauth/metadata/authorization-server';
const MCP_RESOURCE_PATH = '/api/mcp';
const CLIENT_NAME = 'Outrank CLI';
const OAUTH_SCOPE = 'mcp';
const LOOPBACK_HOST = '127.0.0.1';
const CALLBACK_PATH = '/callback';
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const REFRESH_MARGIN_MS = 60 * 1000;
const MS_PER_SECOND = 1000;
const LOCK_SUFFIX = '.refresh.lock';
const LOCK_WAIT_MS = 10 * 1000;
const LOCK_POLL_MS = 100;
const LOCK_STALE_MS = 30 * 1000;
const RANDOM_BYTES = 32;
const CALLBACK_HTML =
  '<!doctype html><meta charset="utf-8"><title>Outrank</title><p>You can close this tab and go back to your assistant.</p>';
const OPEN_COMMANDS = Object.freeze({
  darwin: { command: 'open', args: [] },
  win32: { command: 'cmd', args: ['/c', 'start', '""'] },
});
const LINUX_OPEN_COMMAND = { command: 'xdg-open', args: [] };
const BROWSER_LOGIN_PROMPT = 'Open this link and approve access to Outrank. Waiting for your approval:';
const LOGIN_AGAIN_GUIDANCE = 'Run `outrank-cli auth login --browser` again and approve access in the browser.';

const loginError = (message) => codedError(CliErrorCode.BROWSER_LOGIN_FAILED, message, LOGIN_AGAIN_GUIDANCE);

const base64Url = (buffer) => buffer.toString('base64url');

const postJson = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw loginError(`Outrank refused the sign-in request (HTTP ${response.status}).`);
  return response.json();
};

const postForm = async (url, fields) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  });
  if (!response.ok) throw loginError(`Outrank refused the token request (HTTP ${response.status}).`);
  return response.json();
};

const fetchMetadata = async (baseUrl) => {
  const response = await fetch(`${baseUrl}${METADATA_PATH}`);
  if (!response.ok) throw loginError(`Outrank sign-in is not available at ${baseUrl}.`);
  return response.json();
};

const announceOnStderr = (url) => process.stderr.write(`${BROWSER_LOGIN_PROMPT}\n${url}\n`);

const openInBrowser = (url) => {
  const { command, args } = OPEN_COMMANDS[process.platform] ?? LINUX_OPEN_COMMAND;
  const child = spawn(command, [...args, url], { stdio: 'ignore', detached: true });
  child.on('error', () => undefined);
  child.unref();
};

const waitForCallback = (server, expectedState) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(loginError('Nobody approved access in the browser in time.')),
      LOGIN_TIMEOUT_MS,
    );
    server.on('request', (req, res) => {
      const url = new URL(req.url, `http://${LOOPBACK_HOST}`);
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(CALLBACK_HTML);
      clearTimeout(timer);
      if (url.searchParams.get('state') !== expectedState) {
        reject(loginError('The browser response did not match this sign-in.'));
        return;
      }
      const code = url.searchParams.get('code');
      if (!code) {
        reject(loginError('Access was not approved in the browser.'));
        return;
      }
      resolve(code);
    });
  });

const toStoredOauth = (tokens, clientId, tokenEndpoint, now) => ({
  clientId,
  tokenEndpoint,
  refreshToken: tokens.refresh_token,
  expiresAt: now + tokens.expires_in * MS_PER_SECOND,
});

export const runBrowserLogin = async ({
  baseUrl,
  announce = announceOnStderr,
  open = openInBrowser,
  now = Date.now,
}) => {
  const metadata = await fetchMetadata(baseUrl);
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, LOOPBACK_HOST, resolve));

  try {
    const redirectUri = `http://${LOOPBACK_HOST}:${server.address().port}${CALLBACK_PATH}`;
    const client = await postJson(metadata.registration_endpoint, {
      client_name: CLIENT_NAME,
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
    const verifier = base64Url(randomBytes(RANDOM_BYTES));
    const state = base64Url(randomBytes(RANDOM_BYTES));
    const resource = `${baseUrl}${MCP_RESOURCE_PATH}`;
    const authorizeUrl = new URL(metadata.authorization_endpoint);
    Object.entries({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      state,
      scope: OAUTH_SCOPE,
      resource,
      code_challenge: base64Url(createHash('sha256').update(verifier).digest()),
      code_challenge_method: 'S256',
    }).forEach(([key, value]) => authorizeUrl.searchParams.set(key, value));

    const callback = waitForCallback(server, state);
    announce(authorizeUrl.toString());
    open(authorizeUrl.toString());
    const code = await callback;

    const tokens = await postForm(metadata.token_endpoint, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: client.client_id,
      code_verifier: verifier,
      resource,
    });
    return {
      accessToken: tokens.access_token,
      oauth: toStoredOauth(tokens, client.client_id, metadata.token_endpoint, now()),
    };
  } finally {
    server.close();
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const acquireRefreshLock = async (lockPath) => {
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      await fs.mkdir(lockPath);
      return true;
    } catch {
      const stat = await fs.stat(lockPath).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        await fs.rmdir(lockPath).catch(() => undefined);
      } else {
        await sleep(LOCK_POLL_MS);
      }
    }
  }
  return false;
};

const isFresh = (oauth, now) => oauth.expiresAt - now > REFRESH_MARGIN_MS;

export const refreshProfileToken = async ({ profile, baseUrl, now = Date.now }) => {
  const entry = readRawProfile(await loadConfig(), profile);
  const oauth = entry?.[OAUTH_FIELD];
  if (!oauth) return null;
  if (isFresh(oauth, now())) return entry[API_KEY_FIELD];

  const lockPath = `${getConfigPath()}${LOCK_SUFFIX}`;
  if (!(await acquireRefreshLock(lockPath))) {
    throw loginError('Another Outrank command is refreshing the sign-in and did not finish.');
  }
  try {
    const latest = readRawProfile(await loadConfig(), profile);
    if (isFresh(latest[OAUTH_FIELD], now())) return latest[API_KEY_FIELD];

    const tokens = await postForm(latest[OAUTH_FIELD].tokenEndpoint, {
      grant_type: 'refresh_token',
      refresh_token: latest[OAUTH_FIELD].refreshToken,
      client_id: latest[OAUTH_FIELD].clientId,
      resource: `${baseUrl}${MCP_RESOURCE_PATH}`,
    });
    await storeProfileOauth({
      profile,
      accessToken: tokens.access_token,
      oauth: toStoredOauth(tokens, latest[OAUTH_FIELD].clientId, latest[OAUTH_FIELD].tokenEndpoint, now()),
    });
    return tokens.access_token;
  } finally {
    await fs.rmdir(lockPath).catch(() => undefined);
  }
};
