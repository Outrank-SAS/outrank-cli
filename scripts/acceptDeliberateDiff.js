import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { runCli } from '../tests/helpers/runCli.js';
import { FIXTURE_GROUPS, resolveFixtureOptions } from '../tests/golden/fixtures/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.resolve(HERE, '..', 'tests', 'golden');
const DELIBERATE_DIFFS_PATH = path.join(GOLDEN_DIR, 'deliberate-diffs.json');
const SNAPSHOT_DIR = path.join(GOLDEN_DIR, 'snapshots');
const USAGE = 'Usage: node scripts/acceptDeliberateDiff.js <group/fixture> "<reason: plan task id and why>"';

const [fixtureId, reason] = process.argv.slice(2);
if (!fixtureId || !reason) throw new Error(USAGE);
const [group, name] = fixtureId.split('/');
const fixture = (FIXTURE_GROUPS[group] ?? []).find((entry) => entry.name === name);
if (!fixture) throw new Error(`Unknown fixture: ${fixtureId}`);

const loadJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};

const snapshot = await loadJson(path.join(SNAPSHOT_DIR, `${group}.json`), {});
const actual = await runCli(fixture.argv, resolveFixtureOptions(fixture));
const expected = {
  argv: fixture.argv,
  exitCode: actual.exitCode,
  stdout: actual.stdout,
  stderr: actual.stderr,
  requests: actual.requests,
};
if (isDeepStrictEqual(expected, snapshot[name])) {
  throw new Error(`${fixtureId}: the current output equals the snapshot; nothing to accept`);
}

const diffs = await loadJson(DELIBERATE_DIFFS_PATH, {});
diffs[fixtureId] = { reason, expected };
await fs.writeFile(DELIBERATE_DIFFS_PATH, `${JSON.stringify(diffs, null, 2)}\n`, 'utf8');
console.log(`${fixtureId}: accepted (exit ${expected.exitCode}); snapshot entry kept for comparison`);
console.log(expected.stdout);
