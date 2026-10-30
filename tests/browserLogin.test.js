import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { refreshProfileToken, runBrowserLogin } from '../src/core/browserLogin.js';
import { loadConfig, readRawProfile, storeProfileAuth, storeProfileOauth } from '../src/core/config.js';

const CLIENT_ID = 'client_1';
const AUTH_CODE = 'code_1';
const PROFILE = 'default';
const EXPIRES_IN_SECONDS = 3600;
const NOW = 1_000_000;
const LONG_AGO = 0;

const startServer = async () => {
  const calls = { register: [], token: [] };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      const origin = `http://127.0.0.1:${server.address().port}`;
      const send = (body) => res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
      if (req.url === '/api/oauth/metadata/authorization-server') {
        send({
          registration_endpoint: `${origin}/register`,
          authorization_endpoint: `${origin}/authorize`,
          token_endpoint: `${origin}/token`,
        });
      } else if (req.url === '/register') {
        calls.register.push(JSON.parse(raw));
        send({ client_id: CLIENT_ID });
      } else {
        const fields = Object.fromEntries(new URLSearchParams(raw));
        calls.token.push(fields);
        send({
          access_token: `outr_oat_${calls.token.length}`,
          refresh_token: `refresh_${calls.token.length}`,
          expires_in: EXPIRES_IN_SECONDS,
        });
      }
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, calls, baseUrl: `http://127.0.0.1:${server.address().port}` };
};

const withTempConfig = async (run) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'outrank-browser-login-'));
  const previous = process.env.XDG_CONFIG_HOME;
  const previousDir = process.env.OUTRANK_CONFIG_DIR;
  process.env.XDG_CONFIG_HOME = dir;
  process.env.OUTRANK_CONFIG_DIR = dir;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
    if (previousDir === undefined) delete process.env.OUTRANK_CONFIG_DIR;
    else process.env.OUTRANK_CONFIG_DIR = previousDir;
    await fs.rm(dir, { recursive: true, force: true });
  }
};

const approveInBrowser = (url) => {
  const authorize = new URL(url);
  const callback = new URL(authorize.searchParams.get('redirect_uri'));
  callback.searchParams.set('code', AUTH_CODE);
  callback.searchParams.set('state', authorize.searchParams.get('state'));
  return fetch(callback);
};

test('browser login exchanges the approved code using PKCE and never asks for a key', async () => {
  const { server, calls, baseUrl } = await startServer();
  try {
    const login = await runBrowserLogin({
      baseUrl,
      announce: () => undefined,
      open: approveInBrowser,
      now: () => NOW,
    });
    assert.equal(login.accessToken, 'outr_oat_1');
    assert.equal(login.oauth.refreshToken, 'refresh_1');
    assert.equal(login.oauth.expiresAt, NOW + EXPIRES_IN_SECONDS * 1000);
    assert.equal(calls.register[0].token_endpoint_auth_method, 'none');
    assert.equal(calls.token[0].code, AUTH_CODE);
    assert.ok(calls.token[0].code_verifier);
  } finally {
    server.close();
  }
});

test('browser login rejects a callback with the wrong state', async () => {
  const { server, baseUrl } = await startServer();
  try {
    await assert.rejects(
      runBrowserLogin({
        baseUrl,
        announce: () => undefined,
        open: (url) => {
          const callback = new URL(new URL(url).searchParams.get('redirect_uri'));
          callback.searchParams.set('code', AUTH_CODE);
          callback.searchParams.set('state', 'forged');
          return fetch(callback);
        },
      }),
      /did not match/,
    );
  } finally {
    server.close();
  }
});

test('a fresh browser token is used as is, an expired one is refreshed once and saved', async () => {
  const { server, calls, baseUrl } = await startServer();
  try {
    await withTempConfig(async () => {
      const oauth = {
        clientId: CLIENT_ID,
        tokenEndpoint: `${baseUrl}/token`,
        refreshToken: 'refresh_old',
        expiresAt: NOW + EXPIRES_IN_SECONDS * 1000,
      };
      await storeProfileOauth({ profile: PROFILE, accessToken: 'outr_oat_old', oauth });

      assert.equal(await refreshProfileToken({ profile: PROFILE, baseUrl, now: () => NOW }), 'outr_oat_old');
      assert.equal(calls.token.length, 0);

      await storeProfileOauth({ profile: PROFILE, accessToken: 'outr_oat_old', oauth: { ...oauth, expiresAt: LONG_AGO } });
      const results = await Promise.all([
        refreshProfileToken({ profile: PROFILE, baseUrl, now: () => NOW }),
        refreshProfileToken({ profile: PROFILE, baseUrl, now: () => NOW }),
      ]);
      assert.deepEqual(results, ['outr_oat_1', 'outr_oat_1']);
      assert.equal(calls.token.length, 1);
      assert.equal(calls.token[0].refresh_token, 'refresh_old');
    });
  } finally {
    server.close();
  }
});

test('storing a pasted API key removes the browser sign-in so it cannot overwrite the key', async () => {
  const { server, baseUrl } = await startServer();
  try {
    await withTempConfig(async () => {
      await storeProfileOauth({
        profile: PROFILE,
        accessToken: 'outr_oat_old',
        oauth: { clientId: CLIENT_ID, tokenEndpoint: `${baseUrl}/token`, refreshToken: 'r', expiresAt: LONG_AGO },
      });
      await storeProfileAuth({ profile: PROFILE, apiKey: 'outr_live_pasted_key' });
      assert.equal(readRawProfile(await loadConfig(), PROFILE).oauth, undefined);
      assert.equal(await refreshProfileToken({ profile: PROFILE, baseUrl }), null);
    });
  } finally {
    server.close();
  }
});
