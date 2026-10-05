import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import {
  SERVER_DIR_ENV,
  ServerCheckoutNotFoundError,
  describeSource,
  extractAgentApiSurface,
  hasSurfaceDrift,
  missingServerRoutesMessage,
  surfaceDrift,
} from '../scripts/extractAgentApiSurface.js';
import { describeField } from '../src/adapters/mcp/descriptions.js';
import { rewriteGuidanceText } from '../src/adapters/mcp/guidance.js';
import { buildToolInput } from '../src/adapters/mcp/input.js';
import { buildRouteIndex, findRouteMentions, resolveMention } from '../src/adapters/mcp/routes.js';
import { registry } from '../src/commands/index.js';
import { toSnakeCase } from '../src/commands/registry.js';
import { API_BASE_PATH } from '../src/core/constants.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SURFACE_FIXTURE_PATH = path.join(HERE, 'fixtures', 'agentApiSurface.json');
const PATH_SEPARATOR = '/';
const PARAM_SEGMENT_PATTERN = /^\{[^}]+\}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const PLACEHOLDER_PATTERN = /^(?:<[^>]+>|\{[^}]+\})$/;
const SERVER_ROUTES_WITHOUT_TOOL = Object.freeze([]);
const NO_UPLOADS = Object.freeze({ dir: null, problem: null });
const SERVER_CHECKOUT = '/server-checkout';
const STUB_COMMIT = '0123456789abcdef0123456789abcdef01234567';
const READ_PATHS = Object.freeze(['app/api/agent', 'utils/helpers', 'utils/constants']);
const MODIFIED_FILE_STATUS = ' M utils/helpers/agentArticles.ts\n';
const EXTRACT_SCRIPT_PATH = path.join(HERE, '..', 'scripts', 'extractAgentApiSurface.js');
const NOT_A_SERVER_CHECKOUT = path.join(HERE, 'fixtures');
const MISSING_ROUTES_DIR = path.join(NOT_A_SERVER_CHECKOUT, 'app', 'api', 'agent', 'v1');
const EXIT_FAILURE = 1;
const STALE_CHECK_SKIP_REASON = `set ${SERVER_DIR_ENV} to the server checkout to compare the fixture with it`;
const NO_SURFACE_DRIFT = Object.freeze({
  routesMissingFromFixture: [],
  routesGoneFromServer: [],
  mentionsMissingFromFixture: [],
  mentionsGoneFromServer: [],
});

const surface = JSON.parse(fs.readFileSync(SURFACE_FIXTURE_PATH, 'utf8'));
const index = await buildRouteIndex(registry);

const segmentsOf = (template) => template.split(PATH_SEPARATOR).slice(1);
const isParam = (segment) => PARAM_SEGMENT_PATTERN.test(segment);

const isInstanceOf = (concrete, general) => {
  const concreteSegments = segmentsOf(concrete);
  const generalSegments = segmentsOf(general);
  if (concreteSegments.length !== generalSegments.length) return false;
  return generalSegments.every(
    (segment, position) =>
      (isParam(segment) || segment === concreteSegments[position]) &&
      (!isParam(concreteSegments[position]) || isParam(segment)),
  );
};

const routeKey = ({ method, path: template }) => `${method} ${template}`;

const toolsetsServing = (serverTemplate) => [
  ...new Set(
    index.routes
      .filter((route) => isInstanceOf(route.template, serverTemplate))
      .flatMap((route) => route.specs.flatMap((spec) => spec.toolsets)),
  ),
];

test('the surface fixture names its server commit and says whether that tree had uncommitted changes', (t) => {
  assert.equal(surface.apiBasePath, API_BASE_PATH);
  assert.match(surface.sourceCommit, COMMIT_PATTERN);
  assert.equal(typeof surface.sourceDirty, 'boolean');
  assert.ok(surface.routes.length > 0);
  assert.ok(surface.guidanceMentions.length > 0);
  if (surface.sourceDirty) {
    t.diagnostic(
      `the fixture holds uncommitted server changes on top of ${surface.sourceCommit}; run surface:extract again ` +
        'once they are committed',
    );
  }
});

const gitStub = (statusOutput, calls = []) => (repoRoot, args) => {
  calls.push({ repoRoot, args });
  return args[0] === 'rev-parse' ? `${STUB_COMMIT}\n` : statusOutput;
};

test('the extract script records a clean tree as clean and a tree with uncommitted server changes as dirty', () => {
  const calls = [];
  assert.deepEqual(describeSource(SERVER_CHECKOUT, gitStub('', calls)), {
    sourceCommit: STUB_COMMIT,
    sourceDirty: false,
  });
  assert.deepEqual(calls, [
    { repoRoot: SERVER_CHECKOUT, args: ['rev-parse', 'HEAD'] },
    { repoRoot: SERVER_CHECKOUT, args: ['status', '--porcelain', '--', ...READ_PATHS] },
  ]);
  assert.deepEqual(describeSource(SERVER_CHECKOUT, gitStub(MODIFIED_FILE_STATUS)), {
    sourceCommit: STUB_COMMIT,
    sourceDirty: true,
  });
});

test('the extract script claims neither a commit nor a clean tree when git cannot answer', () => {
  const failingGit = () => {
    throw new Error('not a git repository');
  };
  assert.deepEqual(describeSource(SERVER_CHECKOUT, failingGit), { sourceCommit: null, sourceDirty: null });
});

test('the drift report lists what the server has that the fixture lacks, and the reverse', () => {
  const recorded = {
    routes: [
      { method: 'GET', path: '/products' },
      { method: 'POST', path: '/products' },
    ],
    guidanceMentions: [
      { text: 'GET /api/agent/v1/products', route: null },
      { text: 'GET /api/agent/v1/keywords', route: '/keywords' },
    ],
  };
  const current = {
    routes: [
      { method: 'GET', path: '/products' },
      { method: 'DELETE', path: '/products/{id}' },
    ],
    guidanceMentions: [
      { text: 'GET /api/agent/v1/products', route: null },
      { text: 'GET /api/agent/v1/keywords', route: '/articles' },
    ],
  };
  const drift = surfaceDrift(recorded, current);
  assert.deepEqual(drift, {
    routesMissingFromFixture: ['DELETE /products/{id}'],
    routesGoneFromServer: ['POST /products'],
    mentionsMissingFromFixture: ['/articles :: GET /api/agent/v1/keywords'],
    mentionsGoneFromServer: ['/keywords :: GET /api/agent/v1/keywords'],
  });
  assert.equal(hasSurfaceDrift(drift), true);
  assert.equal(hasSurfaceDrift(surfaceDrift(recorded, recorded)), false);
  assert.equal(hasSurfaceDrift(surfaceDrift(surface, surface)), false);
});

test(
  `the surface fixture matches the server checkout named by ${SERVER_DIR_ENV}`,
  { skip: process.env[SERVER_DIR_ENV] ? false : STALE_CHECK_SKIP_REASON },
  async () => {
    const current = await extractAgentApiSurface(path.resolve(process.env[SERVER_DIR_ENV]));
    assert.deepEqual(surfaceDrift(surface, current), NO_SURFACE_DRIFT);
  },
);

test('a directory that is not the server checkout is refused with the variable name and the missing path', async () => {
  assert.equal(SERVER_DIR_ENV, 'OUTRANK_SERVER_DIR');
  assert.equal(
    missingServerRoutesMessage(NOT_A_SERVER_CHECKOUT),
    `The outrank server checkout was not found: ${MISSING_ROUTES_DIR} does not exist. Pass the repository root as ` +
      'the script argument, or set OUTRANK_SERVER_DIR to it for the test.',
  );
  await assert.rejects(
    () => extractAgentApiSurface(NOT_A_SERVER_CHECKOUT),
    (error) =>
      error instanceof ServerCheckoutNotFoundError &&
      error.message === missingServerRoutesMessage(NOT_A_SERVER_CHECKOUT),
  );
});

test('the extract script prints that message and exits 1 for --check against such a directory', () => {
  const result = spawnSync(process.execPath, [EXTRACT_SCRIPT_PATH, '--check', NOT_A_SERVER_CHECKOUT], {
    encoding: 'utf8',
  });
  assert.equal(result.status, EXIT_FAILURE);
  assert.equal(result.stderr.trim(), missingServerRoutesMessage(NOT_A_SERVER_CHECKOUT));
  assert.equal(result.stdout, '');
});

test('every server route is served by a tool, except the listed exceptions', () => {
  const missing = surface.routes
    .filter((route) => !SERVER_ROUTES_WITHOUT_TOOL.includes(routeKey(route)))
    .filter(
      (route) =>
        !index.routes.some((tool) => tool.method === route.method && isInstanceOf(tool.template, route.path)),
    )
    .map(routeKey);
  assert.deepEqual(missing, []);
  const stale = SERVER_ROUTES_WITHOUT_TOOL.filter((key) => !surface.routes.some((route) => routeKey(route) === key));
  assert.deepEqual(stale, []);
});

test('every tool route exists on the server', () => {
  const unknown = index.routes
    .filter(
      (tool) =>
        !surface.routes.some((route) => route.method === tool.method && isInstanceOf(tool.template, route.path)),
    )
    .map((tool) => tool.key);
  assert.deepEqual(unknown, []);
});

test('every route mention in the server guidance resolves to a tool reference', () => {
  const unresolved = [];
  for (const { text, route } of surface.guidanceMentions) {
    const toolsets = route ? toolsetsServing(route) : [];
    const rewritten = rewriteGuidanceText(index, text, { toolsets });
    if (findRouteMentions(rewritten).length > 0) unresolved.push(`${route ?? '(helper)'}: ${text}`);
  }
  assert.deepEqual(unresolved, []);
});

const toolInputs = new Map();
const toolInputFor = (name) => {
  if (!toolInputs.has(name)) {
    const spec = registry.byToolName.get(name);
    toolInputs.set(name, buildToolInput({ z, spec, describeField, uploads: NO_UPLOADS }));
  }
  return toolInputs.get(name);
};

test('every argument the rewrite emits for the server guidance is accepted by the tool it names', () => {
  const rejected = [];
  let concreteArguments = 0;
  for (const { text, route } of surface.guidanceMentions) {
    const toolsets = route ? toolsetsServing(route) : [];
    for (const mention of findRouteMentions(text)) {
      for (const { name, args } of resolveMention(index, mention, toolsets) ?? []) {
        const { schema } = toolInputFor(name);
        for (const [input, value] of Object.entries(args)) {
          const field = schema.shape[toSnakeCase(input)];
          if (!field) {
            rejected.push(`${text}: ${name} has no argument ${toSnakeCase(input)}`);
            continue;
          }
          if (typeof value === 'string' && PLACEHOLDER_PATTERN.test(value)) continue;
          concreteArguments += 1;
          if (!field.safeParse(value).success) rejected.push(`${text}: ${name} rejects ${JSON.stringify(value)}`);
        }
      }
    }
  }
  assert.deepEqual(rejected, []);
  assert.ok(concreteArguments > 0);
});
