import { CommandKind, toolName } from '../../commands/registry.js';
import { describeField, describeTool } from './descriptions.js';
import {
  ARTICLE_CARD_HTML,
  ARTICLE_CARD_MIME_TYPE,
  ARTICLE_CARD_RESOURCE_META,
  ARTICLE_CARD_START_TOOL_META,
  ARTICLE_CARD_STATUS_TOOL_META,
  ARTICLE_CARD_URI,
} from './articleCard.js';

export const CHATGPT_SURFACE_NAME = 'chatgpt';

export const CHATGPT_INSTRUCTIONS =
  'Outrank manages the organic search work of a website: Search Console data, the keyword plan, articles, article ' +
  'improvements and the pages that receive backlinks.';

const START_COMMAND_ID = 'articles.start';
const STATUS_COMMAND_ID = 'articles.status';

export const CHATGPT_TOOLS = Object.freeze({
  'products.list': { title: 'List products', openWorld: false },
  'products.get': { title: 'Get product', openWorld: false },
  'products.gsc.status': { title: 'Search Console connection status', openWorld: false },
  'products.gsc.performance': { title: 'Search Console performance', openWorld: true },
  'products.gsc.search-analytics': { title: 'Search Console queries and pages', openWorld: true },
  'products.gsc.inspect-url': { title: 'Inspect URL indexing', openWorld: true },
  'products.gsc.cannibalization': { title: 'Find competing pages', openWorld: true },
  'keywords.list': { title: 'List keyword plan', openWorld: false },
  'keywords.get': { title: 'Get keyword', openWorld: false },
  'keywords.suggest': { title: 'Suggest keywords', openWorld: true },
  'keywords.bulk-process': { title: 'Look up keyword metrics', openWorld: true },
  'keywords.add': { title: 'Add keywords to plan', openWorld: false },
  'keywords.update': { title: 'Update planned keyword', openWorld: false },
  'keywords.bulk-reschedule': { title: 'Reschedule keywords', openWorld: false },
  'keywords.delete': { title: 'Remove planned keyword', openWorld: false },
  'articles.list': { title: 'List articles', openWorld: false },
  'articles.get': { title: 'Get article', openWorld: false },
  'articles.get-content': { title: 'Read article text', openWorld: false },
  [START_COMMAND_ID]: {
    title: 'Start article',
    openWorld: true,
    description:
      'Starts writing the article of a keyword on the plan and returns at once. A keyword scheduled for today is ' +
      'also published to the connected CMS when it is done; a later one is prepared ahead of its date. Confirm with ' +
      'the user first. Follow it with articles_status. Never start the same keyword twice: that would use another ' +
      'article.',
  },
  [STATUS_COMMAND_ID]: {
    title: 'Article progress',
    openWorld: false,
    description:
      'Reports whether an article started with articles_start is queued, writing or ready. Each call waits up to 40 ' +
      'seconds, and a ready answer carries the article title and its link. Call it again while it is not ready.',
  },
  'improvements.candidates.list': { title: 'List articles to improve', openWorld: false },
  'improvements.candidates.schedule': { title: 'Schedule article improvement', openWorld: true },
  'improvements.tasks.list': { title: 'List scheduled improvements', openWorld: false },
  'improvements.executions.list': { title: 'List finished improvements', openWorld: false },
  'improvements.executions.get': { title: 'Get improvement result', openWorld: false },
  'products.backlinks.earned': { title: 'List earned backlinks', openWorld: false },
  'marketplace.buyer.status': {
    title: 'Backlink setup status',
    openWorld: false,
    description: 'Shows how backlink placement is set up for a product: its target pages and whether it is on.',
  },
  'marketplace.buyer.target-pages.list': { title: 'List backlink target pages', openWorld: false },
  'marketplace.buyer.target-pages.add': {
    title: 'Add backlink target pages',
    openWorld: true,
    description: 'Adds pages of the product website as backlink targets, so new placements can point to them.',
  },
  'marketplace.buyer.target-pages.pause': {
    title: 'Pause backlink target page',
    openWorld: false,
    description: 'Stops directing new backlinks to a target page. The page stays on the list.',
  },
  'marketplace.buyer.target-pages.activate': {
    title: 'Resume backlink target page',
    openWorld: false,
    description: 'Directs new backlinks to a paused target page again.',
  },
  'marketplace.buyer.placements.list': {
    title: 'List backlink placements',
    openWorld: false,
    description: 'Lists the backlinks placed or in progress for a product and the pages they point to.',
  },
});

const COMMERCE_TEXT_PATTERN =
  /subscri|checkout|pricing|\bprices?\b|billing|upgrade|stripe|payment|invoice|purchas|past[_ ]due|\bquote\b|\b(?:enterprise|backlink|paid|free|trial)\s+(?:plan|tier)\b|\btrial\b|\$\d/i;
const COMMERCE_KEY_PATTERN =
  /subscription|checkout|billing|stripe|pricing|price|invoice|payment|upgrade|portal_url|quote|tier/i;
const COMMERCE_URL_PATTERN = /stripe\.com|\/dashboard\/subscription|\/dashboard\/invoices/i;
const TOOL_MENTION_PATTERN =
  /\b(?:auth|usage|subscription|billing|keywords|articles|improvements|products|marketplace|ai_cited_lists)_[a-z_]+\b/g;
const ROUTE_MENTION_PATTERN = /\/api\/agent\/|outrank-cli|--[a-z]/;
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+/;
const SENTENCE_JOINER = ' ';

const COMMERCE_ERROR_CODES = Object.freeze([
  'SUBSCRIPTION_REQUIRED',
  'ARTICLES_SUBSCRIPTION_REQUIRED',
  'LIMIT_REACHED',
  'PAYMENT_REQUIRED',
  'PLAN_UPGRADE_REQUIRED',
  'MARKETPLACE_BUYER_UNAVAILABLE',
  'TOP_UP_CONSENT_REQUIRED',
]);
export const UNAVAILABLE_MESSAGE = 'This is not available on this Outrank account right now.';
export const UNAVAILABLE_GUIDANCE =
  'Tell the user this is not active on their Outrank account and that they can review their account at outrank.so. ' +
  'Do not retry.';
const FALLBACK_ERROR_MESSAGE = 'Outrank could not complete this request.';
const FALLBACK_GUIDANCE = 'Tell the user what happened in plain words.';
const DEFAULT_SUCCESS_GUIDANCE = 'Report the result to the user.';

const specExposed = (spec) => Object.hasOwn(CHATGPT_TOOLS, spec.id);

const exposedToolNames = new Set(Object.keys(CHATGPT_TOOLS).map(toolName));

const mentionsHiddenTool = (sentence) =>
  (sentence.match(TOOL_MENTION_PATTERN) ?? []).some((name) => !exposedToolNames.has(name));

const keepSentence = (sentence) =>
  !COMMERCE_TEXT_PATTERN.test(sentence) &&
  !COMMERCE_URL_PATTERN.test(sentence) &&
  !ROUTE_MENTION_PATTERN.test(sentence) &&
  !mentionsHiddenTool(sentence);

export const scrubText = (text) =>
  typeof text === 'string' ? text.split(SENTENCE_BOUNDARY).filter(keepSentence).join(SENTENCE_JOINER) : '';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isCommerceValue = (key, value) =>
  COMMERCE_KEY_PATTERN.test(key) || (typeof value === 'string' && value.length < 2048 && COMMERCE_URL_PATTERN.test(value));

export const scrubData = (value) => {
  if (Array.isArray(value)) return value.map(scrubData);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => !isCommerceValue(key, entry))
      .map(([key, entry]) => [key, scrubData(entry)]),
  );
};

export const scrubEnvelope = (envelope) => {
  if (envelope.ok === true) {
    return {
      ...envelope,
      data: scrubData(envelope.data),
      agent_guidance: scrubText(envelope.agent_guidance) || DEFAULT_SUCCESS_GUIDANCE,
    };
  }
  const code = envelope.error?.code;
  if (COMMERCE_ERROR_CODES.includes(code)) {
    return {
      ok: false,
      error: { code: 'NOT_AVAILABLE', message: UNAVAILABLE_MESSAGE },
      agent_guidance: UNAVAILABLE_GUIDANCE,
    };
  }
  const scrubbedMessage = scrubText(envelope.error?.message);
  const details = scrubData(envelope.error?.details);
  return {
    ok: false,
    error: {
      code,
      message: scrubbedMessage || (envelope.error?.message ? UNAVAILABLE_MESSAGE : FALLBACK_ERROR_MESSAGE),
      ...(details ? { details } : {}),
    },
    agent_guidance: scrubText(envelope.agent_guidance) || FALLBACK_GUIDANCE,
  };
};

const isReadOnly = (spec) => spec.kind === CommandKind.READ || spec.kind === CommandKind.LOCAL;

const toolAnnotations = (spec) => ({
  title: CHATGPT_TOOLS[spec.id].title,
  readOnlyHint: isReadOnly(spec),
  destructiveHint: spec.kind === CommandKind.DESTRUCTIVE || spec.kind === CommandKind.MONEY,
  idempotentHint: isReadOnly(spec),
  openWorldHint: CHATGPT_TOOLS[spec.id].openWorld,
});

const toolMeta = (spec) => {
  if (spec.id === START_COMMAND_ID) return ARTICLE_CARD_START_TOOL_META;
  if (spec.id === STATUS_COMMAND_ID) return ARTICLE_CARD_STATUS_TOOL_META;
  return undefined;
};

const articleCardResource = () => ({
  uri: ARTICLE_CARD_URI,
  name: 'article-card',
  title: 'Outrank article',
  mimeType: ARTICLE_CARD_MIME_TYPE,
  _meta: ARTICLE_CARD_RESOURCE_META,
});

const readResource = (uri) => {
  if (uri !== ARTICLE_CARD_URI) throw Object.assign(new Error(`Unknown resource: ${String(uri).slice(0, 200)}`), {});
  return {
    contents: [
      { uri, mimeType: ARTICLE_CARD_MIME_TYPE, text: ARTICLE_CARD_HTML, _meta: ARTICLE_CARD_RESOURCE_META },
    ],
  };
};

export const chatGptSurface = Object.freeze({
  name: CHATGPT_SURFACE_NAME,
  instructions: CHATGPT_INSTRUCTIONS,
  exposes: specExposed,
  toolTitle: (spec) => CHATGPT_TOOLS[spec.id].title,
  describeTool: (spec) => CHATGPT_TOOLS[spec.id].description ?? describeTool(spec),
  describeField,
  toolAnnotations,
  toolMeta,
  sanitizeEnvelope: scrubEnvelope,
  listResources: () => [articleCardResource()],
  readResource,
});
