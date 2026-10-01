import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DistTag, resolveReleaseDistTag } from '../scripts/resolveReleaseDistTag.js';

const STABLE_VERSION = '0.6.0';
const RELEASE_CANDIDATE_VERSION = '0.6.0-rc.1';
const BETA_VERSION = '1.0.0-beta';
const MISMATCH_PATTERN = /does not match package\.json version/;
const NOT_A_RELEASE_PATTERN = /is not a release version/;

test('a stable version is published under latest', () => {
  assert.equal(resolveReleaseDistTag({ tag: `v${STABLE_VERSION}`, version: STABLE_VERSION }), DistTag.LATEST);
  assert.equal(DistTag.LATEST, 'latest');
});

test('a prerelease version is published under next, never latest', () => {
  assert.equal(
    resolveReleaseDistTag({ tag: `v${RELEASE_CANDIDATE_VERSION}`, version: RELEASE_CANDIDATE_VERSION }),
    DistTag.NEXT,
  );
  assert.equal(resolveReleaseDistTag({ tag: `v${BETA_VERSION}`, version: BETA_VERSION }), DistTag.NEXT);
  assert.equal(DistTag.NEXT, 'next');
});

test('a stable tag on a commit whose package.json still holds the release candidate is refused', () => {
  assert.throws(
    () => resolveReleaseDistTag({ tag: `v${STABLE_VERSION}`, version: RELEASE_CANDIDATE_VERSION }),
    MISMATCH_PATTERN,
  );
});

test('a release candidate tag on a commit whose package.json holds the stable version is refused', () => {
  assert.throws(
    () => resolveReleaseDistTag({ tag: `v${RELEASE_CANDIDATE_VERSION}`, version: STABLE_VERSION }),
    MISMATCH_PATTERN,
  );
});

test('a tag without the v prefix, a missing tag and a branch name are refused', () => {
  for (const tag of [STABLE_VERSION, undefined, '', 'main', `V${STABLE_VERSION}`, `v${STABLE_VERSION} `]) {
    assert.throws(() => resolveReleaseDistTag({ tag, version: STABLE_VERSION }), MISMATCH_PATTERN, String(tag));
  }
});

test('a package.json version that is not x.y.z or x.y.z-pre is refused before the tag is compared', () => {
  for (const version of ['0.6', '0.6.0-', '0.6.0+build.1', 'v0.6.0', '0.6.0-rc..1', '', undefined, null, 6]) {
    assert.throws(
      () => resolveReleaseDistTag({ tag: `v${version}`, version }),
      NOT_A_RELEASE_PATTERN,
      String(version),
    );
  }
});
