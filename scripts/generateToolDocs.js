import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registry } from '../src/commands/index.js';
import { cliWords, toolName } from '../src/commands/registry.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const README_PATH = path.resolve(HERE, '..', 'README.md');
export const START_MARKER = '<!-- mcp-tools:start -->';
export const END_MARKER = '<!-- mcp-tools:end -->';
const ENTRY_POINT_MARK = ' ★';
const CHECK_FLAG = '--check';
const EXIT_FAILURE = 1;
const LF = '\n';
const CRLF = '\r\n';

const escapeCell = (text) => text.replaceAll('|', '\\|');

const toRow = (spec) =>
  `| \`${toolName(spec.id)}\`${spec.entryPoint ? ENTRY_POINT_MARK : ''} | \`${cliWords(spec.id).join(' ')}\` | ` +
  `${spec.kind} | ${spec.toolsets.join(', ')} | ${escapeCell(spec.summary)} |`;

export const renderToolTable = (eol = LF) => {
  const tools = registry.commands.filter((spec) => spec.mcp !== false);
  return [
    `${tools.length} tools.`,
    '',
    '| Tool | CLI command | Kind | Toolset | What it does |',
    '| --- | --- | --- | --- | --- |',
    ...tools.map(toRow),
  ].join(eol);
};

export const replaceToolTable = (readme) => {
  const start = readme.indexOf(START_MARKER);
  const end = readme.indexOf(END_MARKER);
  if (start < 0 || end < start) throw new Error(`README.md must contain ${START_MARKER} and ${END_MARKER}`);
  const eol = readme.includes(CRLF) ? CRLF : LF;
  return `${readme.slice(0, start + START_MARKER.length)}${eol}${renderToolTable(eol)}${eol}${readme.slice(end)}`;
};

const main = async () => {
  const current = await fs.readFile(README_PATH, 'utf8');
  const next = replaceToolTable(current);
  if (process.argv.includes(CHECK_FLAG)) {
    if (next !== current) {
      console.error('README.md tool list is out of date. Run `npm run docs:tools`.');
      process.exitCode = EXIT_FAILURE;
    }
    return;
  }
  await fs.writeFile(README_PATH, next, 'utf8');
  console.log('README.md tool list updated.');
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
