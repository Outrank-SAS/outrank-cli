import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

import { REPO_ROOT, STUB_API_KEY, readWhoamiFixture } from './helpers/mcpHarness.js';

const ENTRY = path.join(REPO_ROOT, 'src', 'index.js');
const PRELOAD_URL = pathToFileURL(path.join(REPO_ROOT, 'tests', 'helpers', 'preload.js')).href;
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const JSON_RPC_VERSION = '2.0';
const RESPONSE_TIMEOUT_MS = 20_000;
const EXIT_TIMEOUT_MS = 10_000;
const CORE_TOOL_COUNT = 16;
const LAST_REQUEST_ID = 4;
const PASSTHROUGH_ENV_NAMES = ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA'];

const MESSAGES = [
  {
    jsonrpc: JSON_RPC_VERSION,
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'outrank-cli-stdio-test', version: '0.0.0' },
    },
  },
  { jsonrpc: JSON_RPC_VERSION, method: 'notifications/initialized' },
  { jsonrpc: JSON_RPC_VERSION, id: 2, method: 'tools/list', params: {} },
  { jsonrpc: JSON_RPC_VERSION, id: 3, method: 'tools/call', params: { name: 'usage_stats', arguments: {} } },
  {
    jsonrpc: JSON_RPC_VERSION,
    id: LAST_REQUEST_ID,
    method: 'tools/call',
    params: { name: 'products_update', arguments: { product_id: PRODUCT_ID, body: { name: 'Acme CRM' } } },
  },
];

const passthroughEnv = () =>
  Object.fromEntries(
    PASSTHROUGH_ENV_NAMES.filter((name) => process.env[name]).map((name) => [name, process.env[name]]),
  );

const runServer = async ({ configDir, recordingFile }) => {
  const child = spawn(process.execPath, ['--import', PRELOAD_URL, ENTRY, 'mcp', '--toolsets', 'core'], {
    cwd: REPO_ROOT,
    env: {
      ...passthroughEnv(),
      OUTRANK_API_KEY: STUB_API_KEY,
      OUTRANK_CONFIG_DIR: configDir,
      OUTRANK_TEST_RECORDING_FILE: recordingFile,
      OUTRANK_TEST_RESPONSES: JSON.stringify([{ status: 200, body: readWhoamiFixture('mixed') }]),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const lastResponse = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no response to request ${LAST_REQUEST_ID}`)), RESPONSE_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes(`"id":${LAST_REQUEST_ID}`) && stdout.endsWith('\n')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('error', reject);
  });

  for (const message of MESSAGES) child.stdin.write(`${JSON.stringify(message)}\n`);
  await lastResponse;

  const exited = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('the server did not exit after stdin closed'));
    }, EXIT_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  child.stdin.end();
  const exitCode = await exited;
  return { stdout, stderr, exitCode };
};

test('the real server process speaks only JSON-RPC on stdout and exits when stdin closes', async () => {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outrank-mcp-stdio-'));
  const recordingFile = path.join(configDir, 'recording.json');
  try {
    const { stdout, stderr, exitCode } = await runServer({ configDir, recordingFile });
    const lines = stdout.split('\n').filter((line) => line !== '');
    const messages = lines.map((line) => JSON.parse(line));
    for (const message of messages) assert.equal(message.jsonrpc, JSON_RPC_VERSION);

    const responses = messages.filter((message) => message.id !== undefined);
    const byId = new Map(responses.map((message) => [message.id, message]));
    assert.deepEqual([...byId.keys()].sort(), [1, 2, 3, LAST_REQUEST_ID]);
    assert.equal(byId.get(1).result.serverInfo.name, 'outrank');
    assert.equal(byId.get(1).result.capabilities.tools.listChanged, true);
    assert.match(byId.get(1).result.instructions, /^Outrank MCP server/);
    assert.equal(byId.get(2).result.tools.length, CORE_TOOL_COUNT);
    assert.equal(byId.get(3).result.structuredContent.ok, true);
    assert.deepEqual(byId.get(LAST_REQUEST_ID).result.structuredContent.data, { stub: true });

    assert.equal(stderr, '');
    assert.equal(exitCode, 0);

    const recording = JSON.parse(await fs.readFile(recordingFile, 'utf8'));
    assert.deepEqual(
      recording.requests.map((request) => `${request.method} ${new URL(request.url).pathname}`),
      [
        'GET /api/agent/v1/auth/whoami',
        'GET /api/agent/v1/usage/stats',
        `PATCH /api/agent/v1/products/${PRODUCT_ID}`,
      ],
    );
    assert.deepEqual(recording.requests[2].body, { name: 'Acme CRM' });
    assert.deepEqual(recording.harnessErrors, []);
  } finally {
    await fs.rm(configDir, { recursive: true, force: true });
  }
});
