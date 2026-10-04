import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findRouteMentions } from '../src/adapters/mcp/routes.js';
import { API_BASE_PATH } from '../src/core/constants.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SURFACE_FIXTURE_PATH = path.resolve(HERE, '..', 'tests', 'fixtures', 'agentApiSurface.json');
const ROUTES_DIR = path.join('app', 'api', 'agent', 'v1');
const GUIDANCE_DIRS = [
  path.join('app', 'api', 'agent'),
  path.join('utils', 'helpers'),
  path.join('utils', 'constants'),
];
const ROUTE_FILE = 'route.ts';
const SOURCE_EXTENSIONS = ['.ts', '.tsx'];
const HTTP_METHODS = 'GET|POST|PUT|PATCH|DELETE';
const DECLARED_HANDLER_PATTERN = new RegExp(`^export (?:const|async function|function) (${HTTP_METHODS})\\b`, 'gm');
const EXPORT_LIST_PATTERN = /^export \{([^}]*)\}/gm;
const EXPORTED_METHOD_PATTERN = new RegExp(`(?:^|[\\s,])(?:\\w+ as )?(${HTTP_METHODS})(?=\\s*(?:,|$))`, 'g');
const INTERPOLATION_PATTERN = /\$\{[^}]*\}/g;
const INTERPOLATION_PLACEHOLDER = '<interpolated>';
const PATH_CONSTANT_PATTERN = /^\s*const (\w+) = `(\/api\/agent\/v1\/[^`]*)`;?\s*$/gm;
const NEXT_PARAM_PATTERN = /\[([^\]]+)\]/g;
const EXIT_FAILURE = 1;
const JSON_INDENT = 2;
const CHECK_FLAG = '--check';
const MENTION_WITHOUT_ROUTE = '(no route)';
const USAGE = 'Usage: node scripts/extractAgentApiSurface.js [--check] <path-to-outrank-repo>';
export const SERVER_DIR_ENV = 'OUTRANK_SERVER_DIR';
const DIRTY_SOURCE_NOTE = ' plus uncommitted changes; extract again after they are committed';

const walk = async (dir, matches) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full, matches)));
    else if (matches(entry.name)) found.push(full);
  }
  return found;
};

const toPosix = (relativePath) => relativePath.split(path.sep).join('/');

const routeTemplate = (repoRoot, file) => {
  const relativeDir = path.relative(path.join(repoRoot, ROUTES_DIR), path.dirname(file));
  return `/${toPosix(relativeDir)}`.replace(NEXT_PARAM_PATTERN, '{$1}');
};

const extractRoutes = async (repoRoot) => {
  const files = await walk(path.join(repoRoot, ROUTES_DIR), (name) => name === ROUTE_FILE);
  const routes = [];
  for (const file of files.sort()) {
    const source = await fs.readFile(file, 'utf8');
    const template = routeTemplate(repoRoot, file);
    for (const [, method] of source.matchAll(DECLARED_HANDLER_PATTERN)) routes.push({ method, path: template });
    for (const [, exportList] of source.matchAll(EXPORT_LIST_PATTERN)) {
      for (const [, method] of exportList.matchAll(EXPORTED_METHOD_PATTERN)) routes.push({ method, path: template });
    }
  }
  return routes;
};

const isRouteFile = (repoRoot, file) =>
  file.startsWith(path.join(repoRoot, ROUTES_DIR)) && path.basename(file) === ROUTE_FILE;

const expandPathConstants = (source) => {
  const constants = new Map([...source.matchAll(PATH_CONSTANT_PATTERN)].map(([, name, value]) => [name, value]));
  const withoutDeclarations = source.replace(PATH_CONSTANT_PATTERN, '');
  return [...constants].reduce(
    (text, [name, value]) => text.replaceAll(`\${${name}}`, value),
    withoutDeclarations,
  );
};

const extractGuidanceMentions = async (repoRoot) => {
  const mentions = new Map();
  for (const dir of GUIDANCE_DIRS) {
    const files = await walk(path.join(repoRoot, dir), (name) => SOURCE_EXTENSIONS.includes(path.extname(name)));
    for (const file of files.sort()) {
      const source = expandPathConstants(await fs.readFile(file, 'utf8')).replace(
        INTERPOLATION_PATTERN,
        INTERPOLATION_PLACEHOLDER,
      );
      const route = isRouteFile(repoRoot, file) ? routeTemplate(repoRoot, file) : null;
      for (const { text } of findRouteMentions(source)) {
        const key = `${route ?? ''} ${text}`;
        if (!mentions.has(key)) mentions.set(key, { text, route });
      }
    }
  }
  return [...mentions.values()];
};

const runGit = (repoRoot, args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });

export const describeSource = (repoRoot, git = runGit) => {
  try {
    const sourceCommit = git(repoRoot, ['rev-parse', 'HEAD']).trim();
    const changes = git(repoRoot, ['status', '--porcelain', '--', ...GUIDANCE_DIRS.map(toPosix)]);
    return { sourceCommit, sourceDirty: changes.trim() !== '' };
  } catch {
    return { sourceCommit: null, sourceDirty: null };
  }
};

export const missingServerRoutesMessage = (repoRoot) =>
  `The outrank server checkout was not found: ${path.join(repoRoot, ROUTES_DIR)} does not exist. Pass the ` +
  `repository root as the script argument, or set ${SERVER_DIR_ENV} to it for the test.`;

export class ServerCheckoutNotFoundError extends Error {
  constructor(repoRoot) {
    super(missingServerRoutesMessage(repoRoot));
    this.name = 'ServerCheckoutNotFoundError';
  }
}

const isDirectory = async (dir) => {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
};

const assertServerCheckout = async (repoRoot) => {
  if (!(await isDirectory(path.join(repoRoot, ROUTES_DIR)))) throw new ServerCheckoutNotFoundError(repoRoot);
};

export const extractAgentApiSurface = async (repoRoot) => {
  await assertServerCheckout(repoRoot);
  return {
    apiBasePath: API_BASE_PATH,
    ...describeSource(repoRoot),
    routes: await extractRoutes(repoRoot),
    guidanceMentions: await extractGuidanceMentions(repoRoot),
  };
};

const routeEntry = ({ method, path: template }) => `${method} ${template}`;
const mentionEntry = ({ text, route }) => `${route ?? MENTION_WITHOUT_ROUTE} :: ${text}`;

const onlyIn = (source, other) => {
  const known = new Set(other);
  return [...new Set(source)].filter((entry) => !known.has(entry)).sort();
};

export const surfaceDrift = (recorded, current) => {
  const recordedRoutes = recorded.routes.map(routeEntry);
  const currentRoutes = current.routes.map(routeEntry);
  const recordedMentions = recorded.guidanceMentions.map(mentionEntry);
  const currentMentions = current.guidanceMentions.map(mentionEntry);
  return {
    routesMissingFromFixture: onlyIn(currentRoutes, recordedRoutes),
    routesGoneFromServer: onlyIn(recordedRoutes, currentRoutes),
    mentionsMissingFromFixture: onlyIn(currentMentions, recordedMentions),
    mentionsGoneFromServer: onlyIn(recordedMentions, currentMentions),
  };
};

export const hasSurfaceDrift = (drift) => Object.values(drift).some((entries) => entries.length > 0);

const checkFixture = async (repoRoot) => {
  const recorded = JSON.parse(await fs.readFile(SURFACE_FIXTURE_PATH, 'utf8'));
  const drift = surfaceDrift(recorded, await extractAgentApiSurface(repoRoot));
  if (!hasSurfaceDrift(drift)) {
    console.log(`The surface fixture matches ${repoRoot}.`);
    return;
  }
  console.error(`The surface fixture is stale against ${repoRoot}:\n${JSON.stringify(drift, null, JSON_INDENT)}`);
  process.exit(EXIT_FAILURE);
};

const main = async () => {
  const argv = process.argv.slice(2);
  const [repoRoot] = argv.filter((argument) => argument !== CHECK_FLAG);
  if (!repoRoot) {
    console.error(USAGE);
    process.exit(EXIT_FAILURE);
  }
  if (argv.includes(CHECK_FLAG)) {
    await checkFixture(path.resolve(repoRoot));
    return;
  }
  const surface = await extractAgentApiSurface(path.resolve(repoRoot));
  await fs.writeFile(SURFACE_FIXTURE_PATH, `${JSON.stringify(surface, null, JSON_INDENT)}\n`);
  const source = `${surface.sourceCommit ?? 'unknown commit'}${surface.sourceDirty ? DIRTY_SOURCE_NOTE : ''}`;
  console.log(
    `Wrote ${surface.routes.length} routes and ${surface.guidanceMentions.length} guidance mentions ` +
      `(${source}) to ${path.relative(process.cwd(), SURFACE_FIXTURE_PATH)}`,
  );
};

const runMain = async () => {
  try {
    await main();
  } catch (error) {
    if (!(error instanceof ServerCheckoutNotFoundError)) throw error;
    console.error(error.message);
    process.exit(EXIT_FAILURE);
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runMain();
}
