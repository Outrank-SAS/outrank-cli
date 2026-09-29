import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCli } from './helpers/runCli.js';
import { FIXTURE_GROUPS, resolveFixtureOptions } from './golden/fixtures/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = path.join(HERE, 'golden', 'snapshots');
const DELIBERATE_DIFFS_PATH = path.join(HERE, 'golden', 'deliberate-diffs.json');
const GOLDEN_CONCURRENCY = 6;
const MISMATCH_KIND = 'golden mismatch';
const HARNESS_ERROR_KIND = 'HARNESS ERROR (do not re-capture)';

const loadJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};

const deliberateDiffs = await loadJson(DELIBERATE_DIFFS_PATH, {});

const runInLanes = async (items, worker) => {
  let next = 0;
  const lanes = Array.from({ length: Math.min(GOLDEN_CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(lanes);
};

const classifyFailure = (error) => (error instanceof assert.AssertionError ? MISMATCH_KIND : HARNESS_ERROR_KIND);

for (const [group, fixtures] of Object.entries(FIXTURE_GROUPS)) {
  test(`golden: ${group}`, async (t) => {
    const snapshot = await loadJson(path.join(SNAPSHOT_DIR, `${group}.json`), null);
    assert.ok(snapshot, `missing snapshot for ${group}; run npm run golden:capture ${group}`);

    const snapshotNames = Object.keys(snapshot);
    const fixtureNames = fixtures.map((fixture) => fixture.name);
    assert.deepEqual(fixtureNames.sort(), snapshotNames.sort(), `fixture list for ${group} changed; re-capture`);

    const failures = [];
    await runInLanes(fixtures, async (fixture) => {
      const diffKey = `${group}/${fixture.name}`;
      try {
        const actual = await runCli(fixture.argv, resolveFixtureOptions(fixture));
        if (actual.exitCode === null) {
          throw new Error(`the CLI was killed by a signal before exiting; stderr:\n${actual.stderr}`);
        }
        const observed = {
          argv: fixture.argv,
          exitCode: actual.exitCode,
          stdout: actual.stdout,
          stderr: actual.stderr,
          requests: actual.requests,
        };
        const accepted = deliberateDiffs[diffKey];
        if (accepted) {
          assert.deepEqual(observed, accepted.expected, `${diffKey}: deliberate diff no longer matches`);
          return;
        }
        assert.deepEqual(observed, snapshot[fixture.name]);
      } catch (error) {
        failures.push({ fixture: diffKey, kind: classifyFailure(error), message: error.message });
      }
    });

    for (const failure of failures) {
      t.diagnostic(`${failure.kind}: ${failure.fixture}\n${failure.message}`);
    }
    const summary = failures.map((failure) => `${failure.fixture} [${failure.kind}]`).join(', ');
    assert.equal(failures.length, 0, `${failures.length} failure(s) in ${group}: ${summary}`);
  });
}
