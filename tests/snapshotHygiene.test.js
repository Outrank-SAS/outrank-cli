import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { HELP_EXAMPLE_API_KEY, createApiKeyPattern } from './helpers/runCli.js';
import { FIXTURE_GROUPS, listFixtures } from './golden/fixtures/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = path.join(HERE, 'golden', 'snapshots');
const DELIBERATE_DIFFS_PATH = path.join(HERE, 'golden', 'deliberate-diffs.json');
const SNAPSHOT_EXTENSION = '.json';
const PLACEHOLDER_WITH_BACKSLASH_PATTERN = /<(?:CONFIG_DIR|REPO_ROOT|HOME)>\\/;
const UNKNOWN_API_KEY_PATTERN = /<UNKNOWN_API_KEY-\d+>/;
const HARNESS_ERROR_PATTERN = /HARNESS ERROR/;
const RAW_KEYS_ALLOWED_IN_OUTPUT = new Set([HELP_EXAMPLE_API_KEY]);

const listSnapshotGroups = async () => {
  const entries = await fs.readdir(SNAPSHOT_DIR);
  return entries
    .filter((entry) => entry.endsWith(SNAPSHOT_EXTENSION))
    .map((entry) => path.basename(entry, SNAPSHOT_EXTENSION));
};

const loadSnapshot = async (group) =>
  JSON.parse(await fs.readFile(path.join(SNAPSHOT_DIR, `${group}${SNAPSHOT_EXTENSION}`), 'utf8'));

const loadOptionalJson = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

const assertOutputIsClean = (id, entry) => {
  assert.equal(entry.stderr, '', `${id}: the CLI never writes to stderr; non-empty stderr is a crash or a warning`);
  const output = JSON.stringify({ stdout: entry.stdout, stderr: entry.stderr, requests: entry.requests });
  const rawKeys = [...output.matchAll(createApiKeyPattern())].map(([match]) => match);
  const foreignKeys = rawKeys.filter((key) => !RAW_KEYS_ALLOWED_IN_OUTPUT.has(key));
  assert.deepEqual(foreignKeys, [], `${id}: raw API key material in stdout or requests`);
  assert.doesNotMatch(output, UNKNOWN_API_KEY_PATTERN, `${id}: the CLI sent or printed a key no fixture supplied`);
  assert.doesNotMatch(output, PLACEHOLDER_WITH_BACKSLASH_PATTERN, `${id}: Windows path separator after a placeholder`);
  assert.doesNotMatch(output, HARNESS_ERROR_PATTERN, `${id}: a harness failure was recorded as CLI output`);
  assert.notEqual(entry.stdout, '', `${id}: empty stdout was recorded`);
  assert.notEqual(entry.exitCode, null, `${id}: a killed run was recorded`);
};

test('every fixture group has a snapshot and every snapshot has a fixture group', async () => {
  const snapshotGroups = await listSnapshotGroups();
  assert.deepEqual(snapshotGroups.sort(), Object.keys(FIXTURE_GROUPS).sort());
});

test('no fixture group is empty and no fixture name repeats within a group', () => {
  for (const [group, fixtures] of Object.entries(FIXTURE_GROUPS)) {
    assert.ok(fixtures.length > 0, `${group} has no fixtures`);
    const names = fixtures.map((fixture) => fixture.name);
    assert.equal(new Set(names).size, names.length, `${group} has duplicate fixture names`);
  }
});

test('every snapshot entry has clean stdout and requests', async () => {
  for (const group of await listSnapshotGroups()) {
    const snapshot = await loadSnapshot(group);
    for (const [name, entry] of Object.entries(snapshot)) {
      assertOutputIsClean(`${group}/${name}`, entry);
    }
  }
});

test('deliberate-diffs.json entries name existing fixtures, differ from the snapshot and are clean', async () => {
  const deliberateDiffs = await loadOptionalJson(DELIBERATE_DIFFS_PATH);
  if (deliberateDiffs === null) return;
  const fixtureIds = new Set(listFixtures().map((fixture) => fixture.id));
  for (const [key, entry] of Object.entries(deliberateDiffs)) {
    assert.ok(fixtureIds.has(key), `deliberate diff "${key}" names a fixture that does not exist`);
    assert.equal(typeof entry.reason, 'string', `deliberate diff "${key}" has no reason`);
    assert.ok(entry.reason.trim().length > 0, `deliberate diff "${key}" has an empty reason`);
    assert.ok(entry.expected && typeof entry.expected === 'object', `deliberate diff "${key}" has no expected result`);
    const [group, name] = key.split('/');
    const snapshot = await loadSnapshot(group);
    assert.ok(
      !isDeepStrictEqual(entry.expected, snapshot[name]),
      `deliberate diff "${key}" equals the snapshot; delete the entry`,
    );
    assertOutputIsClean(`deliberate-diffs ${key}`, entry.expected);
  }
});
