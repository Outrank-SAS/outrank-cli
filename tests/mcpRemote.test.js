import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createRemoteMcpServer } from '../src/adapters/mcp/remote.js';
import { redactSecrets } from '../src/core/redact.js';
import { STUB_VERSION, WHOAMI_PATHNAME, jsonResponse, readWhoamiFixture } from './helpers/mcpHarness.js';

const OAUTH_TOKEN = 'outr_oat_remote-test_token';
const REMOTE_BASE_URL = 'https://preview-deployment.example.com/api/mcp';
const REMOTE_ORIGIN = 'https://preview-deployment.example.com';
const ARTICLE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const CLIENT_INFO = { name: 'outrank-remote-tests', version: '0.0.0' };
const STUB_ENVELOPE = { ok: true, data: { stub: true }, agent_guidance: 'stub' };

const withRemote = async ({ whoami }, run) => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input.toString());
    calls.push({ url, headers: { ...(init.headers ?? {}) }, body: init.body ? JSON.parse(init.body) : undefined });
    return url.pathname === WHOAMI_PATHNAME
      ? jsonResponse(200, readWhoamiFixture('mixed'))
      : jsonResponse(200, STUB_ENVELOPE);
  };
  const { server } = await createRemoteMcpServer({
    apiKey: OAUTH_TOKEN,
    baseUrl: REMOTE_BASE_URL,
    version: STUB_VERSION,
    whoami,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client(CLIENT_INFO);
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    return await run({ client, calls });
  } finally {
    await client.close();
    globalThis.fetch = originalFetch;
  }
};

test('a remote server seeded with whoami lists the entitled tools without asking Outrank again', async () => {
  await withRemote({ whoami: readWhoamiFixture('mixed') }, async ({ client, calls }) => {
    const { tools } = await client.listTools();
    assert.ok(tools.length > 0);
    assert.equal(calls.length, 0);
    for (const tool of tools) {
      assert.equal(typeof tool.title, 'string');
      assert.equal(tool.annotations.title, tool.title);
    }
    const instructions = client.getInstructions();
    assert.match(instructions, new RegExp(`remote server ${REMOTE_ORIGIN}`));
    assert.doesNotMatch(instructions, /--toolsets|restart/);
  });
});

test('a remote server sends tool calls to its own origin with the bearer token it was given', async () => {
  await withRemote({ whoami: readWhoamiFixture('mixed') }, async ({ client, calls }) => {
    const result = await client.callTool({ name: 'products_list', arguments: {} });
    assert.equal(result.structuredContent.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url.origin, REMOTE_ORIGIN);
    assert.equal(calls[0].headers.Authorization, `Bearer ${OAUTH_TOKEN}`);
  });
});

test('a remote server looks the organization up itself when it is not seeded', async () => {
  await withRemote({ whoami: undefined }, async ({ client, calls }) => {
    await client.listTools();
    assert.equal(calls[0].url.origin, REMOTE_ORIGIN);
    assert.equal(calls[0].url.pathname, WHOAMI_PATHNAME);
  });
});

test('a remote server takes images as base64 only and never reads a server file', async () => {
  await withRemote({ whoami: readWhoamiFixture('mixed') }, async ({ client, calls }) => {
    const { tools } = await client.listTools();
    const upload = tools.find((tool) => tool.name === 'articles_upload_featured_image');
    assert.ok(upload);
    assert.equal(Object.hasOwn(upload.inputSchema.properties, 'file_path'), false);
    assert.equal(Object.hasOwn(upload.inputSchema.properties, 'file_base64'), true);
    const viaPath = await client.callTool({
      name: 'articles_upload_featured_image',
      arguments: { article_id: ARTICLE_ID, file_path: '/etc/passwd' },
    });
    assert.equal(viaPath.structuredContent.ok, false);
    assert.equal(calls.length, 0);
    const inline = await client.callTool({
      name: 'articles_upload_featured_image',
      arguments: { article_id: ARTICLE_ID, file_base64: PNG_BASE64, file_name: 'pixel.png' },
    });
    assert.equal(inline.structuredContent.ok, true);
  });
});

test('OAuth access and refresh tokens are redacted like API keys', () => {
  assert.equal(redactSecrets(`token ${OAUTH_TOKEN} and outr_ort_abc-DEF_123`), 'token <redacted> and <redacted>');
});
