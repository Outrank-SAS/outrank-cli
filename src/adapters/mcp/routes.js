import { toSnakeCase, toolName } from '../../commands/registry.js';
import { API_BASE_PATH, Surface } from '../../core/constants.js';
import { renderMcpReference } from '../../core/context.js';
import { cliSuccess } from '../../core/errors.js';
import { parseFieldValue } from '../../core/schema.js';
import { MULTI_REQUEST_COMMAND_IDS, ROUTE_TOOL_OVERRIDES, SEQUENTIAL_ROUTE_KEYS } from './routeOverrides.js';

const PROBE_VALUE_PREFIX = '\u0000probe:';
const PROBE_VALUE_SUFFIX = '\u0000';
const PATH_PARAM_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;
const PATH_PARAM_SEGMENT_PATTERN = /^\{[a-zA-Z0-9_]+\}$/;
const PLACEHOLDER_SEGMENT_PATTERN = /^(?:<[^>]+>|\{[^}]+\})$/;
const PATH_SEPARATOR = '/';
const METHOD_PAIR_SEPARATOR = '/';
const ROUTE_KEY_SEPARATOR = ' ';
const TOOL_ALTERNATIVE_SEPARATOR = ' or ';
const TOOL_SEQUENCE_SEPARATOR = ', then ';
const ATTACHED_CONTINUATION_PATTERN = /^[@+%=~\w-]/;
const UNPARSED_QUERY_PATTERN = /^\?[A-Za-z0-9_%<{]/;
const TIME_LIKE_CONTINUATION_PATTERN = /^:\w/;
const PATH_DOT_CONTINUATION_PATTERN = /^\.(?!\.\.(?![./]))[./\w]/;
const PREFERRED_AMBIGUOUS_METHOD = 'GET';
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const SEGMENT_ALTERNATIVE_SEPARATOR = '|';
const LITERAL_SEGMENT = '[A-Za-z0-9_-]+(?:\\.[A-Za-z0-9_-]+)*';
const PLACEHOLDER_SEGMENT = '<[^>\\s/]+>|\\{[^}\\s/]+\\}';
const LITERAL_ALTERNATIVES = `${LITERAL_SEGMENT}(?:\\${SEGMENT_ALTERNATIVE_SEPARATOR}${LITERAL_SEGMENT})*`;
const PATH_SEGMENT = `(?:${LITERAL_ALTERNATIVES}|${PLACEHOLDER_SEGMENT})`;
const ENCODED_BYTE = '%[0-9A-Fa-f]{2}';
const QUERY_VALUE =
  `(?:(?:[A-Za-z0-9_.~-]|${ENCODED_BYTE})*(?:[A-Za-z0-9_~-]|${ENCODED_BYTE})|<[^>\\s&]+>|\\{[^}\\s&]+\\})`;
const QUERY_PAIR = `[A-Za-z0-9_]+=${QUERY_VALUE}`;
const MAX_METHOD_ALTERNATIVES = 2;
const METHOD_LIST =
  `(?:${HTTP_METHODS.join('|')})` +
  `(?:${METHOD_PAIR_SEPARATOR}(?:${HTTP_METHODS.join('|')})){0,${MAX_METHOD_ALTERNATIVES}}`;
const MAX_REWRITTEN_TEXT_CHARS = 20_000;
const MIN_LITERAL_MATCHES = 1;
const OFFSET_ARGUMENT_POSITION = -2;
const MENTION_BOUNDARY = '(?<![\\w./:-])';
const PATH_ELLIPSIS = '...';
const TRAILING_SEPARATOR = `(?:${PATH_SEPARATOR}(?=$|[\\s?.,;:)\\]'"\`]))?`;
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MENTION_PATTERN = new RegExp(
  `${MENTION_BOUNDARY}(?:(${METHOD_LIST}) )?(${escapeRegExp(API_BASE_PATH)}|${escapeRegExp(PATH_ELLIPSIS)})` +
    `((?:${PATH_SEPARATOR}${PATH_SEGMENT})+)${TRAILING_SEPARATOR}(\\?${QUERY_PAIR}(?:&${QUERY_PAIR})*)?`,
  'g',
);

const probeValue = (name) => `${PROBE_VALUE_PREFIX}${name}${PROBE_VALUE_SUFFIX}`;

const probedInputName = (value) =>
  typeof value === 'string' && value.startsWith(PROBE_VALUE_PREFIX) && value.endsWith(PROBE_VALUE_SUFFIX)
    ? value.slice(PROBE_VALUE_PREFIX.length, -PROBE_VALUE_SUFFIX.length)
    : null;

const probeInput = (spec) => Object.fromEntries(Object.keys(spec.input).map((name) => [name, probeValue(name)]));

const probeContext = (calls) => {
  const record = async (request) => {
    calls.push(request);
    return cliSuccess({}, '');
  };
  return {
    surface: Surface.MCP,
    longRunning: false,
    http: record,
    request: async (request) => ({ result: await record(request), status: 0 }),
    ref: () => '',
  };
};

const resolveTemplate = (path, pathParams = {}) => {
  const params = [];
  const template = path.replace(PATH_PARAM_PATTERN, (_, name) => {
    const value = pathParams[name];
    const input = probedInputName(value) ?? (value === undefined || value === null ? name : null);
    if (input === null) return encodeURIComponent(String(value));
    params.push({ name, input });
    return `{${name}}`;
  });
  return { template, params };
};

const resolveQuery = (query = {}) =>
  Object.fromEntries(
    Object.entries(query)
      .map(([key, value]) => [key, probedInputName(value)])
      .filter(([, input]) => input !== null),
  );

const segmentsOf = (pathname) => pathname.split(PATH_SEPARATOR).slice(1);

const ANY_PARAM_SEGMENT = '{}';
const routeKey = (method, template) =>
  `${method}${ROUTE_KEY_SEPARATOR}${template.replace(PATH_PARAM_PATTERN, ANY_PARAM_SEGMENT)}`;

const UNMAPPED_THREW = 'run() threw';
const UNMAPPED_NO_PATH = 'the request has no path';
const unmappedCallCount = (count) => `run() made ${count} requests instead of one`;

const probeRoute = async (spec) => {
  const calls = [];
  try {
    await spec.run(probeInput(spec), probeContext(calls));
  } catch (error) {
    return { reason: `${UNMAPPED_THREW}: ${String(error?.message ?? error)}` };
  }
  if (calls.length !== 1) return { reason: unmappedCallCount(calls.length) };
  const [{ method = PREFERRED_AMBIGUOUS_METHOD, path, pathParams, query }] = calls;
  if (typeof path !== 'string') return { reason: UNMAPPED_NO_PATH };
  const { template, params } = resolveTemplate(path, pathParams);
  return { method, template, segments: segmentsOf(template), params, query: resolveQuery(query), spec };
};

const isProbeCandidate = (spec) => spec.mcp !== false && spec.offline !== true;

const mergeCandidates = (key, candidates) => {
  const [first] = candidates;
  const chosen =
    candidates.length === 1
      ? candidates
      : (ROUTE_TOOL_OVERRIDES[key] ?? []).map((id) => candidates.find((route) => route.spec.id === id));
  if (chosen.length === 0 || chosen.includes(undefined)) return null;
  const { method, template, segments, params, query } = first;
  const specs = chosen.map((candidate) => candidate.spec);
  const dropped = candidates.filter((candidate) => !chosen.includes(candidate));
  const sequential = SEQUENTIAL_ROUTE_KEYS.includes(key);
  return {
    route: { key, method, template, segments, params, query, specs, sequential },
    superseded: dropped.map(toId),
  };
};

const toId = (candidate) => candidate.spec.id;

const describeCollision = (key, candidates) => `${key} is served by ${candidates.map(toId).join(', ')}`;

export const buildRouteIndex = async (registry) => {
  const grouped = new Map();
  const unmapped = [];
  for (const spec of registry.commands.filter(isProbeCandidate)) {
    const route = await probeRoute(spec);
    if (route.reason) {
      unmapped.push({ id: spec.id, reason: route.reason });
      continue;
    }
    const key = routeKey(route.method, route.template);
    grouped.set(key, [...(grouped.get(key) ?? []), route]);
  }
  const routes = [];
  const superseded = [];
  const collisions = [];
  for (const [key, candidates] of grouped) {
    const merged = mergeCandidates(key, candidates);
    if (merged === null) {
      collisions.push(describeCollision(key, candidates));
      continue;
    }
    routes.push(merged.route);
    superseded.push(...merged.superseded);
  }
  if (collisions.length > 0) {
    throw new Error(`MCP routes: add these to ROUTE_TOOL_OVERRIDES: ${collisions.join('; ')}`);
  }
  return Object.freeze({ routes, unmapped, superseded });
};

export const unexpectedProbeFailures = (index) =>
  index.unmapped.filter(({ id }) => !MULTI_REQUEST_COMMAND_IDS.includes(id));

const decodeQueryValue = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isPlaceholderSegment = (segment) => PLACEHOLDER_SEGMENT_PATTERN.test(segment);
const isOpenSegment = (segment) => isPlaceholderSegment(segment) || segment.includes(SEGMENT_ALTERNATIVE_SEPARATOR);

const alignedSegments = (route, mention) => {
  const count = mention.segments.length;
  if (mention.suffix) return route.segments.length >= count ? route.segments.slice(-count) : null;
  return route.segments.length === count ? route.segments : null;
};

const literalMatches = (route, mention, lenient) => {
  const aligned = alignedSegments(route, mention);
  if (aligned === null) return null;
  let matches = 0;
  for (const [position, templateSegment] of aligned.entries()) {
    const segment = mention.segments[position];
    if (PATH_PARAM_SEGMENT_PATTERN.test(templateSegment)) {
      if (segment.includes(SEGMENT_ALTERNATIVE_SEPARATOR)) return null;
      continue;
    }
    if (isPlaceholderSegment(segment)) {
      if (!lenient) return null;
      continue;
    }
    if (!segment.split(SEGMENT_ALTERNATIVE_SEPARATOR).includes(templateSegment)) return null;
    matches += 1;
  }
  return matches;
};

const scoreRoutes = (routes, mention, lenient) =>
  routes
    .map((route) => ({ route, matches: literalMatches(route, mention, lenient) }))
    .filter(({ matches }) => matches !== null && matches >= MIN_LITERAL_MATCHES);

const bestMatches = (scored) => {
  const best = Math.max(...scored.map(({ matches }) => matches));
  return scored.filter(({ matches }) => matches === best).map(({ route }) => route);
};

const preferMethod = (routes) => {
  const methods = new Set(routes.map((route) => route.method));
  if (methods.size === 1) return routes;
  return routes.filter((route) => route.method === PREFERRED_AMBIGUOUS_METHOD);
};

const sharesToolset = (route, toolsets) =>
  route.specs.some((spec) => spec.toolsets.some((toolset) => toolsets.includes(toolset)));

const preferToolsets = (routes, toolsets) => {
  const related = routes.filter((route) => sharesToolset(route, toolsets));
  return related.length > 0 ? related : routes;
};

const isParameterRouteOfAnotherMethod = (index, mention) => scoreRoutes(index.routes, mention, false).length > 0;

const matchRoutes = (index, method, mention, toolsets) => {
  const candidates = index.routes.filter((route) => method === undefined || route.method === method);
  const strict = scoreRoutes(candidates, mention, false);
  if (strict.length === 0 && isParameterRouteOfAnotherMethod(index, mention)) return null;
  const scored = strict.length > 0 ? strict : scoreRoutes(candidates, mention, true);
  if (scored.length === 0) return null;
  const byMethod = method === undefined ? preferMethod(bestMatches(scored)) : bestMatches(scored);
  const tied = byMethod.length > 1 ? preferToolsets(byMethod, toolsets) : byMethod;
  if (tied.length === 1 || (tied.length > 1 && mention.segments.some(isOpenSegment))) return tied;
  return null;
};

const mentionedValues = (route, mention) => {
  const values = [];
  for (const [position, templateSegment] of alignedSegments(route, mention).entries()) {
    const param = route.params.find((entry) => `{${entry.name}}` === templateSegment);
    if (param) values.push([param.input, mention.segments[position]]);
  }
  for (const [key, value] of mention.query) {
    values.push([Object.hasOwn(route.query, key) ? route.query[key] : key, decodeQueryValue(value)]);
  }
  return values;
};

const inputNamed = (spec, key) => Object.keys(spec.input).find((name) => name === key || toSnakeCase(name) === key);

const toArgumentValue = (field, value) => {
  if (isPlaceholderSegment(value)) return value;
  try {
    return parseFieldValue(field, value, '', { coerceEnumText: true });
  } catch {
    return undefined;
  }
};

const argumentsFor = (spec, values) => {
  const args = Object.create(null);
  for (const [key, value] of values) {
    const input = inputNamed(spec, key);
    if (input === undefined) return null;
    const argument = toArgumentValue(spec.input[input], value);
    if (argument === undefined) return null;
    args[input] = argument;
  }
  return args;
};

const toolReferences = (routes, mention) => {
  const seen = new Set();
  const references = [];
  for (const route of routes) {
    const values = mentionedValues(route, mention);
    for (const spec of route.specs) {
      const args = argumentsFor(spec, values);
      if (args === null) return null;
      const name = toolName(spec.id);
      const argumentText = renderMcpReference(spec, args).slice(name.length);
      const key = `${name}${argumentText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      references.push({ name, argumentText, args, sequential: route.sequential });
    }
  }
  return references;
};

export const resolveMention = (index, mention, toolsets = []) => {
  const matched = mention.methods.map((method) => matchRoutes(index, method, mention, toolsets));
  if (matched.some((routes) => routes === null)) return null;
  return toolReferences(matched.flat(), mention);
};

const renderMention = (index, mention, toolsets) => {
  const references = resolveMention(index, mention, toolsets);
  if (references === null) return null;
  const separator = references.every((reference) => reference.sequential)
    ? TOOL_SEQUENCE_SEPARATOR
    : TOOL_ALTERNATIVE_SEPARATOR;
  const argumentTexts = new Set(references.map((reference) => reference.argumentText));
  if (argumentTexts.size === 1) {
    const names = references.map((reference) => reference.name).join(separator);
    return `${names}${references[0].argumentText}`;
  }
  return references.map((reference) => `${reference.name}${reference.argumentText}`).join(separator);
};

const continuesAfterMention = (rest) =>
  rest.startsWith(PATH_SEPARATOR) ||
  ATTACHED_CONTINUATION_PATTERN.test(rest) ||
  UNPARSED_QUERY_PATTERN.test(rest) ||
  TIME_LIKE_CONTINUATION_PATTERN.test(rest) ||
  PATH_DOT_CONTINUATION_PATTERN.test(rest);

const parseMention = ([text, methodText, prefix, pathname, queryText]) => ({
  text,
  methods: methodText === undefined ? [undefined] : methodText.split(METHOD_PAIR_SEPARATOR),
  suffix: prefix === PATH_ELLIPSIS,
  segments: segmentsOf(pathname),
  query: queryText === undefined ? [] : queryText.slice(1).split('&').map((pair) => pair.split('=')),
});

export const rewriteRouteMentions = (index, text, { toolsets = [] } = {}) => {
  if (text.length > MAX_REWRITTEN_TEXT_CHARS) return text;
  return text.replace(MENTION_PATTERN, (...match) => {
    const mention = parseMention(match);
    const offset = match.at(OFFSET_ARGUMENT_POSITION);
    if (continuesAfterMention(text.slice(offset + mention.text.length))) return mention.text;
    return renderMention(index, mention, toolsets) ?? mention.text;
  });
};

export const findRouteMentions = (text) => [...text.matchAll(MENTION_PATTERN)].map(parseMention);
