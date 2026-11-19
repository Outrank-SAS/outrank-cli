import {
  RESEARCH_COMPETITORS_MAX_LIMIT,
  RESEARCH_KEYWORD_SORTS,
  RESEARCH_KEYWORDS_OVERVIEW_MAX,
  RESEARCH_MAX_LIMIT,
  RESEARCH_MAX_OFFSET,
  RESEARCH_MAX_POSITION,
  RESEARCH_SERP_MAX_DEPTH,
  RESEARCH_SERP_MIN_DEPTH,
  LIST_MIN_LIMIT,
  MIN_OFFSET,
  MIN_SEARCH_VOLUME,
} from '../core/constants.js';
import { bool, int, list, oneOf, string } from '../core/schema.js';
import { CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';

const GROUP_ID = 'research';
const BASE_PATH = '/research';
const TOOLSETS = [Toolset.SEO_RESEARCH];

const DOMAIN_REQUIRED = {
  message: 'Missing required argument: <domain>.',
  guidance: 'Pass a domain such as example.com. A full URL also works; only its host is used.',
};
const COMPETITOR_REQUIRED = {
  message: 'Missing required option: --competitor <domain>.',
  guidance: 'Pass the competitor domain whose keywords you want to compare with <domain>.',
};
const KEYWORD_REQUIRED = {
  message: 'Missing required argument: <keyword>.',
  guidance: 'Pass the search query in quotes, for example "backlink checker".',
};
const KEYWORDS_REQUIRED = {
  message: 'Missing required option: --keyword <text>.',
  guidance: `Repeat --keyword for each keyword, up to ${RESEARCH_KEYWORDS_OVERVIEW_MAX}.`,
};

const DOMAIN_HINT = 'Domain such as example.com (a URL works; only the host is used).';
const REGION_HINT = 'Country code such as us, uk, de or fr. Default: us.';
const LANGUAGE_HINT = 'Two-letter language code. Default: the main language of the region.';
const SORT_HINT = 'volume (default), traffic (estimated visits from the keyword) or position.';
const DOFOLLOW_HINT = 'Only dofollow links.';
const ALL_LINKS_HINT = 'Every link instead of one per linking domain.';
const RESOLVE_URLS_HINT =
  'Ask the provider to resolve every result URL Google hides. Slower (about one minute); same cost.';
const DEPTH_HINT = `Number of results to read, ${RESEARCH_SERP_MIN_DEPTH} to ${RESEARCH_SERP_MAX_DEPTH}. Default: 10.`;

const DOMAIN_PLACEHOLDER = '<domain>';
const KEYWORD_PLACEHOLDER = '<keyword>';
const TEXT_PLACEHOLDER = '<text>';

export const RESEARCH_HELP = `Usage:
  outrank-cli research domain-overview <domain> [--region <code>] [--language <code>]
  outrank-cli research domain-keywords <domain> [--region <code>] [--language <code>] [--sort volume|traffic|position] [--min-volume <n>] [--max-position <n>] [--limit <n>] [--offset <n>]
  outrank-cli research competitors <domain> [--region <code>] [--language <code>] [--limit <n>]
  outrank-cli research keyword-gap <domain> --competitor <domain> [--region <code>] [--language <code>] [--min-volume <n>] [--max-competitor-position <n>] [--limit <n>] [--offset <n>]
  outrank-cli research backlinks <domain> [--dofollow-only] [--all-links] [--limit <n>] [--offset <n>]
  outrank-cli research keywords-overview --keyword "<text>" [--keyword "<text>" ...] [--region <code>] [--language <code>]
  outrank-cli research serp "<keyword>" [--region <code>] [--language <code>] [--depth <n>] [--resolve-urls]

Commands:
  domain-overview     Organic keywords, estimated traffic, position spread, domain rank and backlink totals of any domain.
  domain-keywords     The Google keywords a domain ranks for, with position, URL, volume, difficulty and traffic.
  competitors         The domains that rank for the most of the same keywords.
  keyword-gap         Keywords a competitor ranks for and the domain does not.
  backlinks           Backlinks of any domain, strongest linking domains first (one per domain by default).
  keywords-overview   Search volume, difficulty, CPC, intent and 12-month trend for up to ${RESEARCH_KEYWORDS_OVERVIEW_MAX} keywords.
  serp                Live Google organic results for a keyword, with the other SERP features on the page.

Research works on any domain or keyword, not only your products. It needs a paid Outrank plan or trial. Each
organization has a daily number of research calls; the same call repeated within 24 hours is served from cache
and does not count.

Examples:
  outrank-cli research domain-overview ahrefs.com
  outrank-cli research domain-keywords outrank.so --max-position 10 --limit 50
  outrank-cli research keyword-gap outrank.so --competitor surferseo.com --max-competitor-position 10
  outrank-cli research keywords-overview --keyword "seo tools" --keyword "keyword gap tool" --region uk
  outrank-cli research serp "backlink checker" --region us
`;

const localeInput = () => ({
  region: string().describe(REGION_HINT),
  language: string().describe(LANGUAGE_HINT),
});

const domainInput = () => ({ domain: string().required(DOMAIN_REQUIRED).describe(DOMAIN_HINT), ...localeInput() });

const pageInput = (maxLimit) => ({
  limit: int({ min: LIST_MIN_LIMIT, max: maxLimit }),
  offset: int({ min: MIN_OFFSET, max: RESEARCH_MAX_OFFSET }),
});

const DOMAIN_CLI = { positionals: ['domain'], placeholders: { domain: DOMAIN_PLACEHOLDER } };

const localeBody = (input) => ({ region: input.region, language: input.language });
const pageBody = (input) => ({ limit: input.limit, offset: input.offset });

const post = (ctx, path, body, options = {}) =>
  ctx.http({
    method: 'POST',
    path: `${BASE_PATH}/${path}`,
    body: Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)),
    ...options,
  });

const untrusted = (untrustedFields) => ({ untrustedOutput: true, untrustedFields });

const domainOverview = defineCommand({
  id: `${GROUP_ID}.domain-overview`,
  summary:
    'Get the SEO overview of any domain: ranking keywords, estimated organic traffic and its value, position ' +
    'spread, domain rank (0-100, like Ahrefs DR), backlinks and referring domains.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: domainInput(),
  cli: DOMAIN_CLI,
  run: (input, ctx) => post(ctx, 'domain-overview', { domain: input.domain, ...localeBody(input) }),
});

const domainKeywords = defineCommand({
  id: `${GROUP_ID}.domain-keywords`,
  summary:
    'List the Google keywords any domain ranks for, with position, ranking URL, search volume, difficulty, CPC, ' +
    'intent, trend and estimated traffic.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: {
    ...domainInput(),
    sort: oneOf(RESEARCH_KEYWORD_SORTS).describe(SORT_HINT),
    minVolume: int({ min: MIN_SEARCH_VOLUME }),
    maxPosition: int({ min: 1, max: RESEARCH_MAX_POSITION }),
    ...pageInput(RESEARCH_MAX_LIMIT),
  },
  cli: DOMAIN_CLI,
  run: (input, ctx) =>
    post(ctx, 'domain-keywords', {
      domain: input.domain,
      ...localeBody(input),
      sort: input.sort,
      min_volume: input.minVolume,
      max_position: input.maxPosition,
      ...pageBody(input),
    }),
});

const competitors = defineCommand({
  id: `${GROUP_ID}.competitors`,
  summary: 'Find the organic competitors of any domain: the domains ranking for the most of the same keywords.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...domainInput(), limit: int({ min: LIST_MIN_LIMIT, max: RESEARCH_COMPETITORS_MAX_LIMIT }) },
  cli: DOMAIN_CLI,
  run: (input, ctx) => post(ctx, 'competitors', { domain: input.domain, ...localeBody(input), limit: input.limit }),
});

const keywordGap = defineCommand({
  id: `${GROUP_ID}.keyword-gap`,
  summary:
    'List the keywords a competitor ranks for and the domain does not, with volume, difficulty and the ' +
    "competitor's position and URL.",
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: {
    ...domainInput(),
    competitor: string().required(COMPETITOR_REQUIRED).describe(DOMAIN_HINT),
    minVolume: int({ min: MIN_SEARCH_VOLUME }),
    maxCompetitorPosition: int({ min: 1, max: RESEARCH_MAX_POSITION }),
    ...pageInput(RESEARCH_MAX_LIMIT),
  },
  cli: { ...DOMAIN_CLI, placeholders: { ...DOMAIN_CLI.placeholders, competitor: DOMAIN_PLACEHOLDER } },
  run: (input, ctx) =>
    post(ctx, 'keyword-gap', {
      domain: input.domain,
      competitor: input.competitor,
      ...localeBody(input),
      min_volume: input.minVolume,
      max_competitor_position: input.maxCompetitorPosition,
      ...pageBody(input),
    }),
});

const backlinks = defineCommand({
  id: `${GROUP_ID}.backlinks`,
  summary:
    'List the backlinks of any domain, strongest linking domains first, with source URL, domain rank (0-100), ' +
    'anchor, dofollow and first seen date.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: untrusted(['backlinks[].anchor', 'backlinks[].source_title']),
  input: {
    domain: string().required(DOMAIN_REQUIRED).describe(DOMAIN_HINT),
    dofollowOnly: bool().describe(DOFOLLOW_HINT),
    allLinks: bool().describe(ALL_LINKS_HINT),
    ...pageInput(RESEARCH_MAX_LIMIT),
  },
  cli: DOMAIN_CLI,
  run: (input, ctx) =>
    post(ctx, 'backlinks', {
      domain: input.domain,
      dofollow_only: input.dofollowOnly ? true : undefined,
      one_per_domain: input.allLinks ? false : undefined,
      ...pageBody(input),
    }),
});

const keywordsOverview = defineCommand({
  id: `${GROUP_ID}.keywords-overview`,
  summary: `Get search volume, difficulty, CPC, intent and 12-month trend for up to ${RESEARCH_KEYWORDS_OVERVIEW_MAX} keywords at once.`,
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { keywords: list({ split: null }).required(KEYWORDS_REQUIRED), ...localeInput() },
  cli: { options: { keyword: 'keywords' }, placeholders: { keywords: TEXT_PLACEHOLDER } },
  run: (input, ctx) => post(ctx, 'keywords-overview', { keywords: input.keywords, ...localeBody(input) }),
});

const serp = defineCommand({
  id: `${GROUP_ID}.serp`,
  summary:
    'Get the live Google organic results for a keyword (position, title, URL, domain) and the other SERP ' +
    'features on the page, such as AI Overviews.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: untrusted(['results[].title', 'results[].description', 'results[].site_name']),
  input: {
    keyword: string().required(KEYWORD_REQUIRED),
    ...localeInput(),
    depth: int({ min: RESEARCH_SERP_MIN_DEPTH, max: RESEARCH_SERP_MAX_DEPTH }).describe(DEPTH_HINT),
    resolveUrls: bool().describe(RESOLVE_URLS_HINT),
  },
  cli: { positionals: ['keyword'], placeholders: { keyword: KEYWORD_PLACEHOLDER } },
  run: (input, ctx) =>
    post(
      ctx,
      'serp',
      {
        keyword: input.keyword,
        ...localeBody(input),
        depth: input.depth,
        resolve_urls: input.resolveUrls ? true : undefined,
      },
      { longRunning: Boolean(input.resolveUrls) },
    ),
});

export const researchGroup = defineGroup({
  id: GROUP_ID,
  help: {
    usage: RESEARCH_HELP,
    guidance:
      'Choose one of: domain-overview, domain-keywords, competitors, keyword-gap, backlinks, keywords-overview, ' +
      'serp. They work on any domain or keyword.',
  },
  unknown: (word) => ({
    message: `Unknown research command: ${word}.`,
    guidance: 'Run `outrank-cli research --help` to see the available SEO research commands.',
  }),
  children: [domainOverview, domainKeywords, competitors, keywordGap, backlinks, keywordsOverview, serp],
});
