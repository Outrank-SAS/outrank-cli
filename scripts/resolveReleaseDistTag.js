import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_JSON_PATH = path.resolve(HERE, '..', 'package.json');
const TAG_PREFIX = 'v';
const PRERELEASE_SEPARATOR = '-';
const VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z]+(\.[0-9A-Za-z]+)*)?$/;
const TAG_ENV = 'GITHUB_REF_NAME';
const OUTPUT_ENV = 'GITHUB_OUTPUT';
const OUTPUT_KEY = 'dist_tag';

export const DistTag = Object.freeze({ LATEST: 'latest', NEXT: 'next' });

export const resolveReleaseDistTag = ({ tag, version }) => {
  if (typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
    throw new Error(`package.json version "${version}" is not a release version (x.y.z or x.y.z-rc.n).`);
  }
  const expectedTag = `${TAG_PREFIX}${version}`;
  if (tag !== expectedTag) {
    throw new Error(`Tag "${tag}" does not match package.json version "${version}". Expected tag "${expectedTag}".`);
  }
  return version.includes(PRERELEASE_SEPARATOR) ? DistTag.NEXT : DistTag.LATEST;
};

const main = async () => {
  const { version } = JSON.parse(await fs.readFile(PACKAGE_JSON_PATH, 'utf8'));
  const distTag = resolveReleaseDistTag({ tag: process.env[TAG_ENV], version });
  const outputPath = process.env[OUTPUT_ENV];
  if (outputPath) await fs.appendFile(outputPath, `${OUTPUT_KEY}=${distTag}\n`, 'utf8');
  console.log(`Publishing ${version} under the "${distTag}" dist-tag.`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
