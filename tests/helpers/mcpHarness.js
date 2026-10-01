import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { resolveMcpOptions } from '../../src/adapters/mcp/options.js';
import { createMcpServer } from '../../src/adapters/mcp/server.js';
import { registry } from '../../src/commands/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const STUB_API_KEY = 'outr_live_mcp_test_key';
export const STUB_VERSION = '0.0.0-test';
export const WHOAMI_PATHNAME = '/api/agent/v1/auth/whoami';
const JSON_HEADERS = { 'content-type': 'application/json' };
const CLIENT_INFO = { name: 'outrank-cli-tests', version: '0.0.0' };
const STUB_ENVELOPE = { ok: true, data: { stub: true }, agent_guidance: 'stub' };

export const readWhoamiFixture = (name) =>
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests', 'fixtures', `whoami-${name}.json`), 'utf8'));

export const jsonResponse = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });

export const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const parseBody = (body) => (typeof body === 'string' ? JSON.parse(body) : undefined);

export const respondWith =
  ({ whoami = readWhoamiFixture('mixed'), other = () => jsonResponse(200, STUB_ENVELOPE) } = {}) =>
  (request) =>
    request.pathname === WHOAMI_PATHNAME ? jsonResponse(200, whoami) : other(request);

export const startMcp = async ({
  argv = [],
  env = { OUTRANK_API_KEY: STUB_API_KEY },
  config = {},
  respond = respondWith(),
  timeouts,
  logger,
  cwd = REPO_ROOT,
} = {}) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input.toString());
    const request = {
      method: init.method ?? 'GET',
      url: url.toString(),
      pathname: url.pathname,
      headers: { ...(init.headers ?? {}) },
      body: parseBody(init.body),
      signal: init.signal,
      index: calls.length,
    };
    calls.push(request);
    return respond(request);
  };

  const options = resolveMcpOptions({ argv, env, cwd });
  const notifications = [];
  let client = null;
  try {
    const { server, session } = await createMcpServer({
      registry,
      version: STUB_VERSION,
      options,
      env,
      readConfig: async () => (typeof config === 'function' ? config() : config),
      timeouts,
      logger,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client(CLIENT_INFO);
    client.fallbackNotificationHandler = async (notification) => {
      notifications.push(notification);
    };
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return {
      client,
      session,
      calls,
      notifications,
      options,
      listToolNames: async () => (await client.listTools()).tools.map((tool) => tool.name),
      call: async (name, args = {}, callOptions) => {
        const result = await client.callTool({ name, arguments: args }, undefined, callOptions);
        return { result, envelope: result.structuredContent };
      },
      close: async () => {
        await client.close();
        globalThis.fetch = originalFetch;
      },
    };
  } catch (error) {
    globalThis.fetch = originalFetch;
    throw error;
  }
};

export const withMcp = async (settings, run) => {
  const harness = await startMcp(settings);
  try {
    return await run(harness);
  } finally {
    await harness.close();
  }
};
