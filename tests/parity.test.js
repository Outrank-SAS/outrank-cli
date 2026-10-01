import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registry } from '../src/commands/index.js';
import { NodeType, cliWords, toolName } from '../src/commands/registry.js';
import { listFixtures } from './golden/fixtures/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMMANDS_DIR = path.resolve(HERE, '..', 'src', 'commands');
const EXPECTED_COMMAND_COUNT = 157;
const MAX_TOOL_NAME_LENGTH = 46;
const FORBIDDEN_IN_COMMANDS = [/core\/args\.js/, /core\/api\.js/, /\bprocess\./, /\bconsole\./];

const listFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
};

const fixtureArgvs = listFixtures().map((fixture) => fixture.argv);

const wordsOf = (node) => (node.type === NodeType.GROUP ? cliWords(node.id) : cliWords(node.id));

const aliasesOf = (node) => node.cli?.aliases ?? [];

const hasFixture = (node) => {
  const words = wordsOf(node);
  const ownWord = words[words.length - 1];
  const alternatives = [ownWord, ...aliasesOf(node)];
  return fixtureArgvs.some((argv) => {
    if (argv.length < words.length) return false;
    const prefixMatches = words.slice(0, -1).every((word, index) => argv[index] === word);
    if (!prefixMatches || !alternatives.includes(argv[words.length - 1])) return false;
    if (node.type !== NodeType.GROUP) return true;
    const next = argv[words.length];
    const childWords = (node.children ?? []).map((child) => cliWords(child.id).at(-1));
    return next === undefined || next.startsWith('--') || !childWords.includes(next);
  });
};

test('the registry exposes exactly the commands the plan inventories', () => {
  assert.equal(registry.commands.length, EXPECTED_COMMAND_COUNT);
});

test('every command has at least one golden fixture that reaches it', () => {
  const uncovered = registry.commands.filter((node) => !hasFixture(node)).map((node) => node.id);
  assert.deepEqual(uncovered, []);
});

test('MCP tool names are unique, derived from ids and within the length limit', () => {
  const names = registry.commands.filter((node) => node.mcp !== false).map((node) => toolName(node.id));
  assert.equal(new Set(names).size, names.length);
  for (const name of names) {
    assert.match(name, /^[a-z][a-z0-9_]*$/);
    assert.ok(name.length <= MAX_TOOL_NAME_LENGTH, `${name} is longer than ${MAX_TOOL_NAME_LENGTH}`);
  }
});

test('command specs never touch argv, stdio or the legacy request helpers', async () => {
  const files = (await listFiles(COMMANDS_DIR)).filter((file) => file.endsWith('.js'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await fs.readFile(file, 'utf8');
    for (const pattern of FORBIDDEN_IN_COMMANDS) {
      assert.doesNotMatch(source, pattern, `${path.relative(COMMANDS_DIR, file)} matches ${pattern}`);
    }
  }
});

const SRC_DIR = path.resolve(HERE, '..', 'src');
const MCP_ADAPTER_DIR = path.join(SRC_DIR, 'adapters', 'mcp');
const MCP_ONLY_PACKAGES = [/from '@modelcontextprotocol\//, /from 'zod'/];
const STATIC_MCP_IMPORT = /^import .* from '\.\/adapters\/mcp\/([a-zA-Z]+)\.js';$/gm;
const DEPENDENCY_FREE_MCP_MODULES = ['constants', 'help'];

test('the plain CLI path never loads the MCP SDK or zod', async () => {
  const files = (await listFiles(SRC_DIR)).filter((file) => file.endsWith('.js'));
  for (const file of files.filter((entry) => !entry.startsWith(MCP_ADAPTER_DIR))) {
    const source = await fs.readFile(file, 'utf8');
    for (const pattern of MCP_ONLY_PACKAGES) {
      assert.doesNotMatch(source, pattern, `${path.relative(SRC_DIR, file)} imports an MCP-only package`);
    }
  }
  const entry = await fs.readFile(path.join(SRC_DIR, 'index.js'), 'utf8');
  const staticMcpModules = [...entry.matchAll(STATIC_MCP_IMPORT)].map((match) => match[1]);
  assert.deepEqual(staticMcpModules.sort(), DEPENDENCY_FREE_MCP_MODULES);
  for (const name of DEPENDENCY_FREE_MCP_MODULES) {
    const source = await fs.readFile(path.join(MCP_ADAPTER_DIR, `${name}.js`), 'utf8');
    assert.doesNotMatch(source, /^import /m, `${name}.js must stay import-free`);
  }
});

test('the README tool list is generated from the registry and up to date', async () => {
  const { replaceToolTable } = await import('../scripts/generateToolDocs.js');
  const readme = await fs.readFile(path.resolve(HERE, '..', 'README.md'), 'utf8');
  assert.equal(replaceToolTable(readme), readme, 'run `npm run docs:tools`');
});
