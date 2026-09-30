import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { runCli } from '../tests/helpers/runCli.js';
import { FIXTURE_GROUPS, resolveFixtureOptions } from '../tests/golden/fixtures/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = path.resolve(HERE, '..', 'tests', 'golden', 'snapshots');
const CONCURRENCY = 6;

const ONLY_NEW_FLAG = '--only-new';
const ONLY_PREFIX = '--only=';
const cliArguments = process.argv.slice(2);
const onlyNew = cliArguments.includes(ONLY_NEW_FLAG);
const onlyNames = new Set(
  cliArguments
    .filter((argument) => argument.startsWith(ONLY_PREFIX))
    .flatMap((argument) => argument.slice(ONLY_PREFIX.length).split(',')),
);
const requestedGroups = cliArguments.filter((argument) => !argument.startsWith('--'));
const groups = requestedGroups.length > 0 ? requestedGroups : Object.keys(FIXTURE_GROUPS);
const partialCapture = onlyNew || onlyNames.size > 0;

const isCaptureTarget = (fixture, existing) => {
  if (onlyNames.size > 0) return onlyNames.has(fixture.name);
  if (onlyNew) return !(fixture.name in existing);
  return true;
};

const unknownGroups = groups.filter((group) => !FIXTURE_GROUPS[group]);
if (unknownGroups.length > 0) {
  throw new Error(`Unknown fixture group(s): ${unknownGroups.join(', ')}`);
}

const runWithConcurrency = async (items, worker) => {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(lanes);
  return results;
};

const assertFixtureNamesUnique = (group, fixtures) => {
  const names = new Set();
  for (const fixture of fixtures) {
    if (names.has(fixture.name)) throw new Error(`Duplicate fixture name in ${group}: ${fixture.name}`);
    names.add(fixture.name);
  }
};

const assertCaptureIsPlausible = (group, fixture, result, options) => {
  const id = `${group}/${fixture.name}`;
  if (result.exitCode === null) {
    throw new Error(`${id}: the CLI was killed before exiting; refusing to record it`);
  }
  if (result.stdout === '') {
    throw new Error(`${id}: the CLI printed nothing on stdout; refusing to record it. stderr:\n${result.stderr}`);
  }
  if (result.requests.length > options.responses.length) {
    throw new Error(
      `${id}: made ${result.requests.length} request(s) but the fixture stubs only ${options.responses.length}; ` +
        'add the missing responses instead of relying on the default stub',
    );
  }
};

const loadExistingSnapshot = async (group) => {
  try {
    return JSON.parse(await fs.readFile(path.join(SNAPSHOT_DIR, `${group}.json`), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
};

const captureGroup = async (group) => {
  const fixtures = FIXTURE_GROUPS[group];
  assertFixtureNamesUnique(group, fixtures);
  const existing = await loadExistingSnapshot(group);
  const targets = fixtures.filter((fixture) => isCaptureTarget(fixture, existing));

  const results = await runWithConcurrency(targets, async (fixture) => {
    const options = resolveFixtureOptions(fixture);
    const result = await runCli(fixture.argv, options);
    assertCaptureIsPlausible(group, fixture, result, options);
    const entry = {
      argv: fixture.argv,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      requests: result.requests,
    };
    return [fixture.name, entry];
  });

  const captured = Object.fromEntries(results);
  const snapshot = partialCapture
    ? Object.fromEntries(fixtures.map((fixture) => [fixture.name, captured[fixture.name] ?? existing[fixture.name]]))
    : captured;
  const changed = results.filter(([name, entry]) => !isDeepStrictEqual(existing[name], entry)).map(([name]) => name);
  const removed = Object.keys(existing).filter((name) => !(name in snapshot));

  await fs.mkdir(SNAPSHOT_DIR, { recursive: true });
  await fs.writeFile(path.join(SNAPSHOT_DIR, `${group}.json`), `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return { count: targets.length, changed, removed };
};

let total = 0;
for (const group of groups) {
  const { count, changed, removed } = await captureGroup(group);
  total += count;
  const changeSummary = changed.length > 0 ? `; changed: ${changed.join(', ')}` : '';
  const removeSummary = removed.length > 0 ? `; removed: ${removed.join(', ')}` : '';
  console.log(`${group}: ${count} fixtures captured${changeSummary}${removeSummary}`);
}
console.log(`total: ${total} fixtures`);
