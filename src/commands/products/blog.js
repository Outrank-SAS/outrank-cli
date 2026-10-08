import {
  BLOG_ANALYTICS_RANGES,
  BLOG_DOMAIN_MODES,
  BLOG_LIST_MIN_PAGE,
  BLOG_MAX_POSITIONS_PER_REQUEST,
  BLOG_PAGE_LAYOUTS,
  BLOG_PAGE_STATUSES,
  BLOG_POSITION_MAX,
  BLOG_POST_LIST_STATUSES,
  BLOG_PREVIEW_DESIGN_SCOPE,
  BLOG_PREVIEW_SCOPES,
  BLOG_REDIRECT_GONE_STATUS_CODE,
  BLOG_REDIRECT_STATUS_CODES,
  BLOG_SNIPPET_KINDS,
  BLOG_SNIPPET_KINDS_WITH_REQUIRED_CONTENT,
  BLOG_SUBSCRIBER_STATUSES,
  BLOG_TEMPLATES,
  BLOG_WEBHOOK_EVENTS,
} from '../../core/constants.js';
import { Surface } from '../../core/constants.js';
import { MCP_USAGE_GUIDANCE, usageError } from '../../core/errors.js';
import { bool, int, json, list, object, oneOf, string, uuid } from '../../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import { productInput } from './shared.js';

const BLOG_USAGE = `Usage:
  outrank-cli products blog get <product-id>
  outrank-cli products blog setup <product-id>
  outrank-cli products blog check-subdomain <product-id> --subdomain <subdomain>
  outrank-cli products blog create <product-id> [--json <object>]
  outrank-cli products blog update-settings <product-id> --json <object>
  outrank-cli products blog delete <product-id> --confirm <subdomain>
  outrank-cli products blog usage <product-id>
  outrank-cli products blog analytics <product-id> [--range 7d|30d|90d]
  outrank-cli products blog starter-posts <product-id>
  outrank-cli products blog preview <product-id> --scope design|post|page [--target-id <id>]
  outrank-cli products blog design get|update|publish|discard <product-id> [--json <object>]
  outrank-cli products blog domain get|connect|verify|remove <product-id> [--json <object>]
  outrank-cli products blog posts list <product-id> [--status all|published|scheduled|draft] [--search <text>] [--page <n>]
  outrank-cli products blog posts create <product-id> [--title <title>]
  outrank-cli products blog posts get|get-content|unpublish|sync <product-id> <article-id>
  outrank-cli products blog posts update|update-content <product-id> <article-id> --json <object>
  outrank-cli products blog posts publish <product-id> <article-id> [--scheduled-for <iso-datetime>]
  outrank-cli products blog pages list|create|reorder <product-id> [--json <object>]
  outrank-cli products blog pages get|update|delete <product-id> <page-id> [--json <object>]
  outrank-cli products blog categories list|create|reorder <product-id> [--json <object>]
  outrank-cli products blog categories update|delete <product-id> <category-id> [--json <object>]
  outrank-cli products blog authors list|create <product-id> [--json <object>]
  outrank-cli products blog authors update|delete <product-id> <author-id> [--json <object>]
  outrank-cli products blog redirects list|create <product-id> [--json <object>]
  outrank-cli products blog redirects delete <product-id> <redirect-id>
  outrank-cli products blog snippets list|create <product-id> [--json <object>]
  outrank-cli products blog snippets update|delete <product-id> <snippet-id> [--json <object>]
  outrank-cli products blog subscribers list <product-id> [--status subscribed|unsubscribed] [--search <text>] [--page <n>]
  outrank-cli products blog subscribers delete <product-id> <subscriber-id>
  outrank-cli products blog webhooks list|create <product-id> [--json <object>]
  outrank-cli products blog webhooks get|update|delete|test <product-id> <webhook-id> [--json <object>]`;

const TOOLSETS = [Toolset.BLOG];
const BLOG_PATH = '/products/{productId}/blog';
const PRODUCT_ID = 'productId';
const CAMEL_CASE_NOTE = 'Blog fields use camelCase, like the blog dashboard.';
const HEX_COLOR_HINT = '6-digit hex color such as #2563EB.';
const HTTPS_URL_HINT = 'Full https:// URL.';
const SLUG_HINT = 'Lowercase letters, numbers and hyphens.';
const POSITION_HINT = 'Zero-based order in the list.';
const CONFIRM_REQUIRED = {
  guidance:
    'Deleting a blog takes it offline and turns its posts back into unpublished articles. Confirm with the human, ' +
    'then pass --confirm <subdomain> with the blog subdomain shown by `outrank-cli products blog get <product-id>`.',
};
const SUBDOMAIN_REQUIRED = {
  guidance: 'Pass the subdomain to check: `outrank-cli products blog check-subdomain <product-id> --subdomain <name>`.',
};
const SCOPE_REQUIRED = {
  guidance: 'Pass --scope design for the draft theme, or --scope post|page with --target-id <article-id|page-id>.',
};
const DOMAIN_REQUIRED = {
  guidance:
    'Connecting a domain needs mode (subdomain, apex or subfolder) and hostname; for subfolder, basePath sets ' +
    'the path (default /blog).',
};
const NAME_REQUIRED = { guidance: 'A name is required.' };
const TITLE_REQUIRED = { guidance: 'A page needs a title.' };
const FROM_PATH_REQUIRED = { guidance: 'A redirect needs fromPath, the old path such as /old-post.' };
const URL_REQUIRED = { guidance: 'A webhook needs an https:// url.' };
const SNIPPET_REQUIRED = {
  guidance: 'A snippet needs name and kind (cta, html or newsletter); cta and html snippets also need content.',
};
const ITEMS_REQUIRED = { guidance: 'Send {"items": [{"id": "<id>", "position": 0}, ...]} with each id once.' };

const BLOG_CREATE_BODY = object().shape({
  name: string().describe('Blog name; defaults to the product name.'),
  subdomain: string().describe('Subdomain on outrankblog.com; check it with products_blog_check_subdomain.'),
  template: oneOf(BLOG_TEMPLATES),
  accentColor: string().describe(HEX_COLOR_HINT),
  publishReadyArticles: bool().describe('Also publish the articles that are already ready.'),
  publishHere: bool().describe('Publish new articles to this blog even when another integration is connected.'),
});

const BLOG_SETTINGS_BODY = object().shape({
  name: string(),
  description: string().nullable(),
  language: string().describe('Language code such as en or en-US.'),
  platformSubdomain: string().describe('New outrankblog.com subdomain.'),
  isPlatformIndexable: bool().describe('Paid plans only.'),
  badgeEnabled: bool().describe('Turning the Outrank badge off needs a paid plan.'),
  analyticsSettings: json().describe('Partial object, for example {"ga4MeasurementId": "G-ABC123", "builtInAnalytics": true}.'),
  codeInjection: json().describe(
    'Slots to replace, each sent whole, for example {"head": {"html": "<script>...</script>", "strategy": "idle"}}.',
  ),
});

const DOMAIN_BODY = object().shape({
  mode: oneOf(BLOG_DOMAIN_MODES).required(DOMAIN_REQUIRED),
  hostname: string().required(DOMAIN_REQUIRED).describe('Hostname such as blog.example.com or example.com.'),
  basePath: string().describe('Subfolder mode only: the path the blog lives under. Default /blog.'),
});

const POST_SETTINGS_BODY = object().shape({
  slug: string().describe(SLUG_HINT),
  authorId: uuid().nullable(),
  categoryId: uuid().nullable(),
  newCategoryName: string().describe('Creates the category when it does not exist yet.'),
  tags: list(),
  featured: bool(),
  excerpt: string(),
  seoTitle: string(),
  seoDescription: string(),
  ogImageUrl: string().describe(HTTPS_URL_HINT),
  coverImageUrl: string().nullable().describe(HTTPS_URL_HINT),
  coverAlt: string(),
  canonicalUrl: string().describe(HTTPS_URL_HINT),
  noindex: bool(),
  showToc: bool(),
});

const POST_CONTENT_BODY = object().shape({
  title: string(),
  content: string().describe('Markdown body; replaces the whole body.'),
});

const pageShape = (titleRequired) =>
  object().shape({
    title: titleRequired ? string().required(TITLE_REQUIRED) : string(),
    slug: string().describe(SLUG_HINT),
    content: string().describe('Markdown body.'),
    seoTitle: string().nullable(),
    seoDescription: string().nullable(),
    status: oneOf(BLOG_PAGE_STATUSES),
    showInNav: bool(),
    position: int({ min: 0, max: BLOG_POSITION_MAX }).describe(POSITION_HINT),
    layout: oneOf(BLOG_PAGE_LAYOUTS),
  });

const categoryShape = (nameRequired) =>
  object().shape({
    name: nameRequired ? string().required(NAME_REQUIRED) : string(),
    slug: string().describe(SLUG_HINT),
    description: string().nullable(),
    seoTitle: string().nullable(),
    seoDescription: string().nullable(),
    position: int({ min: 0, max: BLOG_POSITION_MAX }).describe(POSITION_HINT),
  });

const authorShape = (nameRequired) =>
  object().shape({
    name: nameRequired ? string().required(NAME_REQUIRED) : string(),
    slug: string().describe(SLUG_HINT),
    avatarUrl: string().nullable().describe(HTTPS_URL_HINT),
    bio: string().nullable(),
    jobTitle: string().nullable(),
    websiteUrl: string().nullable().describe(HTTPS_URL_HINT),
    social: json().describe('Object of network to URL, for example {"x": "https://x.com/acme"}.'),
    isDefault: bool().describe('Use this author for new posts.'),
  });

const REDIRECT_BODY = object().shape({
  fromPath: string().required(FROM_PATH_REQUIRED),
  toPath: string().describe('Target path or URL; omit for status 410.'),
  statusCode: int().describe('301 (default), 302, or 410 for a removed page.'),
});

const snippetShape = (required) =>
  object().shape({
    name: required ? string().required(SNIPPET_REQUIRED) : string(),
    kind: required ? oneOf(BLOG_SNIPPET_KINDS).required(SNIPPET_REQUIRED) : oneOf(BLOG_SNIPPET_KINDS),
    content: json().describe('Required for cta and html snippets; newsletter snippets fall back to defaults.'),
    placement: json().describe('Where it shows in posts, for example {"position": "end", "categorySlugs": []}.'),
    isActive: bool(),
  });

const webhookShape = (required) =>
  object().shape({
    url: required ? string().required(URL_REQUIRED).describe(HTTPS_URL_HINT) : string().describe(HTTPS_URL_HINT),
    events: list({ item: oneOf(BLOG_WEBHOOK_EVENTS) }),
    ...(required ? {} : { isActive: bool(), rotateSecret: bool().describe('Returns a new signing secret.') }),
  });

const POSITIONS_BODY = object().shape({
  items: list({
    item: object().shape({
      id: uuid().required(ITEMS_REQUIRED),
      position: int({ min: 0, max: BLOG_POSITION_MAX }).required(ITEMS_REQUIRED),
    }),
  }).required(
    ITEMS_REQUIRED,
  ),
});

const PREVIEW_TARGET_MESSAGES = Object.freeze({
  [Surface.CLI]: {
    missing: 'Missing required option: --target-id <article-id|page-id> for --scope post or page.',
    unexpected: '--target-id only applies to --scope post or page; omit it for --scope design.',
  },
  [Surface.MCP]: {
    missing: 'Missing required argument: target_id (the article id for post, the page id for page).',
    unexpected: 'target_id only applies to scope post or page; omit it for scope design.',
  },
});

const refinePreviewTarget = (input, ctx) => {
  const needsTarget = input.scope !== BLOG_PREVIEW_DESIGN_SCOPE;
  if (needsTarget === Boolean(input.targetId)) return;
  const isMcp = ctx.surface === Surface.MCP;
  const messages = PREVIEW_TARGET_MESSAGES[isMcp ? Surface.MCP : Surface.CLI];
  throw usageError(needsTarget ? messages.missing : messages.unexpected, isMcp ? MCP_USAGE_GUIDANCE : SCOPE_REQUIRED.guidance);
};

const REDIRECT_GUIDANCE =
  'Send {"fromPath": "/old", "toPath": "/new"} for a redirect (statusCode 301 or 302), or ' +
  '{"fromPath": "/old", "statusCode": 410} to mark a page as gone.';

const refineRedirect = (input, ctx) => {
  const { statusCode, toPath } = input.body ?? {};
  const guidance = ctx.surface === Surface.MCP ? MCP_USAGE_GUIDANCE : REDIRECT_GUIDANCE;
  if (statusCode !== undefined && !BLOG_REDIRECT_STATUS_CODES.includes(statusCode)) {
    throw usageError(`statusCode must be one of ${BLOG_REDIRECT_STATUS_CODES.join(', ')}.`, guidance);
  }
  if (statusCode !== BLOG_REDIRECT_GONE_STATUS_CODE && !(typeof toPath === 'string' && toPath.trim())) {
    throw usageError('toPath is required unless statusCode is 410.', guidance);
  }
};

const VOWEL_START_PATTERN = /^[aeiou]/i;
const articleFor = (noun) => (VOWEL_START_PATTERN.test(noun) ? 'an' : 'a');

const bodyUsageError = (ctx, message, guidance) =>
  usageError(message, ctx.surface === Surface.MCP ? MCP_USAGE_GUIDANCE : guidance);

const refinePositions = (input, ctx) => {
  const items = input.body?.items ?? [];
  if (items.length > BLOG_MAX_POSITIONS_PER_REQUEST) {
    throw bodyUsageError(ctx, `items accepts at most ${BLOG_MAX_POSITIONS_PER_REQUEST} entries per request.`, ITEMS_REQUIRED.guidance);
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw bodyUsageError(ctx, 'Each id may appear only once in items.', ITEMS_REQUIRED.guidance);
  }
};

const refineSnippetContent = (input, ctx) => {
  const { kind, content } = input.body ?? {};
  const hasContent = Boolean(content) && typeof content === 'object' && !Array.isArray(content);
  if (BLOG_SNIPPET_KINDS_WITH_REQUIRED_CONTENT.includes(kind) && !hasContent) {
    throw bodyUsageError(ctx, `A ${kind} snippet needs a content object.`, SNIPPET_REQUIRED.guidance);
  }
};

const POST_CONTENT_GUIDANCE = 'Send {"title": "..."}, {"content": "<markdown>"} or both.';

const refinePostContent = (input, ctx) => {
  const { title, content } = input.body ?? {};
  if (title === undefined && content === undefined) {
    throw bodyUsageError(ctx, 'Send title, content or both.', POST_CONTENT_GUIDANCE);
  }
};

const refineWebhookEvents = (input, ctx) => {
  const events = input.body?.events;
  if (Array.isArray(events) && events.length === 0) {
    throw bodyUsageError(ctx, 'events needs at least one event; omit it to receive every event.', URL_REQUIRED.guidance);
  }
};

const pickParams = (input, names) => Object.fromEntries(names.map((name) => [name, input[name]]));

const blogCommand = ({
  id,
  summary,
  kind,
  method,
  suffix = '',
  ids = [],
  input = {},
  body,
  bodyField,
  bodyOf,
  query,
  mcp,
  refine,
  description,
}) =>
  defineCommand({
    id: `products.blog.${id}`,
    summary,
    description: description ?? (bodyField ? `${summary} ${CAMEL_CASE_NOTE}` : summary),
    kind,
    toolsets: TOOLSETS,
    input: { ...productInput(), ...Object.fromEntries(ids.map((name) => [name, uuid().required()])), ...input },
    cli: { positionals: [PRODUCT_ID, ...ids] },
    ...(body ? { body } : {}),
    ...(bodyField ? { bodyField } : {}),
    ...(mcp ? { mcp } : {}),
    ...(refine ? { refine } : {}),
    run: (values, ctx) =>
      ctx.http({
        method,
        path: `${BLOG_PATH}${suffix}`,
        pathParams: pickParams(values, [PRODUCT_ID, ...ids]),
        ...(query ? { query: query(values) } : {}),
        ...(bodyOf ? { body: bodyOf(values) } : {}),
        ...(body && !bodyOf ? { body: values.body } : {}),
      }),
  });

const group = ({ id, usage, guidance, children }) =>
  defineGroup({
    id: `products.blog.${id}`,
    help: { usage, guidance },
    unknown: (word) => ({
      message: `Unknown products blog ${id} subcommand: ${word}.`,
      guidance: `Run \`outrank-cli products blog ${id} --help\` to see the available ${id} commands.`,
    }),
    children,
  });

const usageFor = (lines) => `Usage:\n${lines.map((line) => `  outrank-cli products blog ${line}`).join('\n')}`;

const listQuery = (values) => ({ status: values.status, search: values.search, page: values.page });

const SUBSCRIBER_UNTRUSTED_FIELDS = [
  'items[].email',
  'items[].name',
  'items[].source_path',
  'items[].consent_text',
  'items[].form_key',
];
const WEBHOOK_TEST_UNTRUSTED_FIELDS = ['responseSnippet', 'error'];
const ANALYTICS_UNTRUSTED_FIELDS = ['topPages[].path', 'topPages[].url', 'referrers[].source'];

const designGroup = group({
  id: 'design',
  usage: usageFor([
    'design get <product-id>',
    'design update <product-id> --json <object>',
    'design publish <product-id>',
    'design discard <product-id>',
  ]),
  guidance:
    'Edit the draft theme with `update` (send the whole config, starting from the draft returned by `get`), ' +
    'preview it with `outrank-cli products blog preview <product-id> --scope design`, then `publish` it.',
  children: [
    blogCommand({
      id: 'design.get',
      summary: 'Show the live and draft theme config of the blog.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/design',
    }),
    blogCommand({
      id: 'design.update',
      summary: 'Save the draft theme config of the blog from a JSON body (the live blog is unchanged).',
      kind: CommandKind.WRITE,
      method: 'PUT',
      suffix: '/design',
      body: BodyMode.JSON,
    }),
    blogCommand({
      id: 'design.publish',
      summary: 'Publish the draft theme to the live blog.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: '/design/publish',
    }),
    blogCommand({
      id: 'design.discard',
      summary: 'Discard the draft theme and go back to the live one.',
      kind: CommandKind.DESTRUCTIVE,
      method: 'POST',
      suffix: '/design/discard',
    }),
  ],
});

const domainGroup = group({
  id: 'domain',
  usage: usageFor([
    'domain get <product-id>',
    'domain connect <product-id> --json <object>',
    'domain verify <product-id>',
    'domain remove <product-id>',
  ]),
  guidance:
    'Connect a custom domain, show the returned DNS records to the human, then `verify` once the records are in ' +
    'place. DNS can take a while, so check again later instead of changing the records.',
  children: [
    blogCommand({
      id: 'domain.get',
      summary: 'Show the custom domain of the blog and its DNS and verification state.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/domain',
    }),
    blogCommand({
      id: 'domain.connect',
      summary: 'Connect or replace the custom domain of the blog from a JSON body.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: '/domain',
      body: BodyMode.JSON,
      bodyField: DOMAIN_BODY,
    }),
    blogCommand({
      id: 'domain.verify',
      summary: 'Check the DNS of the custom domain and activate it once it is correct.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: '/domain/verify',
    }),
    blogCommand({
      id: 'domain.remove',
      summary: 'Remove the custom domain; the blog goes back to its outrankblog.com subdomain.',
      kind: CommandKind.DESTRUCTIVE,
      method: 'DELETE',
      suffix: '/domain',
    }),
  ],
});

const POST_ID = ['articleId'];
const POST_PATH = '/posts/{articleId}';

const postsGroup = group({
  id: 'posts',
  usage: usageFor([
    'posts list <product-id> [--status all|published|scheduled|draft] [--search <text>] [--page <n>]',
    'posts create <product-id> [--title <title>]',
    'posts get <product-id> <article-id>',
    'posts update <product-id> <article-id> --json <object>',
    'posts get-content <product-id> <article-id>',
    'posts update-content <product-id> <article-id> --json <object>',
    'posts publish <product-id> <article-id> [--scheduled-for <iso-datetime>]',
    'posts unpublish <product-id> <article-id>',
    'posts sync <product-id> <article-id>',
  ]),
  guidance:
    'Posts are keyed by their article id. `create` a draft, write it with `update-content`, set slug, SEO and ' +
    'category with `update`, then `publish` (now or with --scheduled-for). After editing a live post, run `sync`.',
  children: [
    blogCommand({
      id: 'posts.list',
      summary: 'List the posts of the blog with optional status, search and page filters.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/posts',
      input: { status: oneOf(BLOG_POST_LIST_STATUSES), search: string(), page: int({ min: BLOG_LIST_MIN_PAGE }) },
      query: listQuery,
    }),
    blogCommand({
      id: 'posts.create',
      summary: 'Create an empty draft post on the blog.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: '/posts',
      input: { title: string() },
      bodyOf: (values) => (values.title ? { title: values.title } : {}),
    }),
    blogCommand({
      id: 'posts.get',
      summary: 'Show the settings, status and live URL of one post.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: POST_PATH,
      ids: POST_ID,
    }),
    blogCommand({
      id: 'posts.update',
      summary: 'Change the slug, author, category, tags, excerpt, SEO or cover of one post from a JSON body.',
      kind: CommandKind.WRITE,
      method: 'PATCH',
      suffix: POST_PATH,
      ids: POST_ID,
      body: BodyMode.JSON,
      bodyField: POST_SETTINGS_BODY,
    }),
    blogCommand({
      id: 'posts.get-content',
      summary: 'Show the title and markdown body of one post.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: `${POST_PATH}/content`,
      ids: POST_ID,
    }),
    blogCommand({
      id: 'posts.update-content',
      summary: 'Replace the title and/or markdown body of one post from a JSON body.',
      kind: CommandKind.WRITE,
      method: 'PUT',
      suffix: `${POST_PATH}/content`,
      ids: POST_ID,
      body: BodyMode.JSON,
      bodyField: POST_CONTENT_BODY,
      refine: refinePostContent,
    }),
    blogCommand({
      id: 'posts.publish',
      summary: 'Publish one post now, or schedule it with --scheduled-for.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: `${POST_PATH}/publish`,
      ids: POST_ID,
      input: { scheduledFor: string().describe('ISO 8601 date-time with offset, at most 365 days ahead.') },
      bodyOf: (values) => (values.scheduledFor ? { scheduledFor: values.scheduledFor } : {}),
    }),
    blogCommand({
      id: 'posts.unpublish',
      summary: 'Take one post off the blog (or cancel its schedule); it becomes a draft.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: `${POST_PATH}/unpublish`,
      ids: POST_ID,
    }),
    blogCommand({
      id: 'posts.sync',
      summary: 'Push the latest body of a live post to the blog after editing it.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: `${POST_PATH}/sync`,
      ids: POST_ID,
    }),
  ],
});

const collectionGroup = ({
  id,
  noun,
  idName,
  idLabel,
  createBody,
  updateBody,
  itemRead = false,
  reorder = false,
  update = true,
  createRefine,
  updateRefine,
  updateKind = CommandKind.WRITE,
  extraChildren = [],
  extraUsage = [],
  guidance,
}) => {
  const itemPath = `/${id}/{${idName}}`;
  const ids = [idName];
  const lines = [
    `${id} list <product-id>`,
    ...(itemRead ? [`${id} get <product-id> <${idLabel}>`] : []),
    `${id} create <product-id> --json <object>`,
    ...(update ? [`${id} update <product-id> <${idLabel}> --json <object>`] : []),
    `${id} delete <product-id> <${idLabel}>`,
    ...(reorder ? [`${id} reorder <product-id> --json <object>`] : []),
    ...extraUsage,
  ];
  return group({
    id,
    usage: usageFor(lines),
    guidance,
    children: [
      blogCommand({
        id: `${id}.list`,
        summary: `List the ${id} of the blog.`,
        kind: CommandKind.READ,
        method: 'GET',
        suffix: `/${id}`,
      }),
      ...(itemRead
        ? [
            blogCommand({
              id: `${id}.get`,
              summary: `Show one ${noun} of the blog.`,
              kind: CommandKind.READ,
              method: 'GET',
              suffix: itemPath,
              ids,
            }),
          ]
        : []),
      blogCommand({
        id: `${id}.create`,
        summary: `Create ${articleFor(noun)} ${noun} on the blog from a JSON body.`,
        kind: CommandKind.WRITE,
        method: 'POST',
        suffix: `/${id}`,
        body: BodyMode.JSON,
        bodyField: createBody,
        refine: createRefine,
      }),
      ...(update
        ? [
            blogCommand({
              id: `${id}.update`,
              summary: `Change one ${noun} of the blog from a JSON body.`,
              kind: updateKind,
              method: 'PATCH',
              suffix: itemPath,
              ids,
              body: BodyMode.JSON,
              bodyField: updateBody,
              refine: updateRefine,
            }),
          ]
        : []),
      blogCommand({
        id: `${id}.delete`,
        summary: `Delete one ${noun} of the blog.`,
        kind: CommandKind.DESTRUCTIVE,
        method: 'DELETE',
        suffix: itemPath,
        ids,
      }),
      ...(reorder
        ? [
            blogCommand({
              id: `${id}.reorder`,
              summary: `Save the order of the ${id} from a JSON body of ids and positions.`,
              kind: CommandKind.WRITE,
              method: 'PATCH',
              suffix: `/${id}/positions`,
              body: BodyMode.JSON,
              bodyField: POSITIONS_BODY,
              refine: refinePositions,
            }),
          ]
        : []),
      ...extraChildren,
    ],
  });
};

const pagesGroup = collectionGroup({
  id: 'pages',
  noun: 'page',
  idName: 'pageId',
  idLabel: 'page-id',
  createBody: pageShape(true),
  updateBody: pageShape(false),
  itemRead: true,
  reorder: true,
  guidance:
    'Pages are static pages such as About or Contact. A draft page stays hidden until it is saved with ' +
    '"status": "published"; "showInNav" adds it to the blog navigation and `reorder` sets the order.',
});

const categoriesGroup = collectionGroup({
  id: 'categories',
  noun: 'category',
  idName: 'categoryId',
  idLabel: 'category-id',
  createBody: categoryShape(true),
  updateBody: categoryShape(false),
  reorder: true,
  guidance: 'Categories group posts. Assign one with `outrank-cli products blog posts update` and "categoryId".',
});

const authorsGroup = collectionGroup({
  id: 'authors',
  noun: 'author',
  idName: 'authorId',
  idLabel: 'author-id',
  createBody: authorShape(true),
  updateBody: authorShape(false),
  guidance:
    'Authors are shown on posts. "isDefault" makes an author the default for new posts; set a post author with ' +
    '`outrank-cli products blog posts update` and "authorId".',
});

const redirectsGroup = collectionGroup({
  id: 'redirects',
  noun: 'redirect',
  idName: 'redirectId',
  idLabel: 'redirect-id',
  createBody: REDIRECT_BODY,
  createRefine: refineRedirect,
  update: false,
  guidance: 'Redirects send an old path to a new one (301 or 302) or mark it gone (410).',
});

const snippetsGroup = collectionGroup({
  id: 'snippets',
  noun: 'snippet',
  idName: 'snippetId',
  idLabel: 'snippet-id',
  createBody: snippetShape(true),
  updateBody: snippetShape(false),
  createRefine: refineSnippetContent,
  guidance: 'Snippets are reusable call-to-action, newsletter or HTML blocks shown on the blog.',
});

const webhooksGroup = collectionGroup({
  id: 'webhooks',
  noun: 'webhook',
  idName: 'webhookId',
  idLabel: 'webhook-id',
  createBody: webhookShape(true),
  updateBody: webhookShape(false),
  createRefine: refineWebhookEvents,
  updateRefine: refineWebhookEvents,
  updateKind: CommandKind.DESTRUCTIVE,
  itemRead: true,
  extraUsage: ['webhooks test <product-id> <webhook-id>'],
  extraChildren: [
    blogCommand({
      id: 'webhooks.test',
      summary: 'Send a test event to one webhook and report the response status.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: '/webhooks/{webhookId}/test',
      ids: ['webhookId'],
      mcp: { untrustedOutput: true, untrustedFields: WEBHOOK_TEST_UNTRUSTED_FIELDS },
    }),
  ],
  guidance:
    'Webhooks call an https URL when a reader subscribes. The signing secret is returned once by `create` (and ' +
    'by `update` with "rotateSecret": true); give it to the human for their endpoint.',
});

const subscribersGroup = group({
  id: 'subscribers',
  usage: usageFor([
    'subscribers list <product-id> [--status subscribed|unsubscribed] [--search <text>] [--page <n>]',
    'subscribers delete <product-id> <subscriber-id>',
  ]),
  guidance: 'Subscribers are readers who joined the blog newsletter; their emails are personal data.',
  children: [
    blogCommand({
      id: 'subscribers.list',
      summary: 'List the newsletter subscribers of the blog.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/subscribers',
      input: { status: oneOf(BLOG_SUBSCRIBER_STATUSES), search: string(), page: int({ min: BLOG_LIST_MIN_PAGE }) },
      query: listQuery,
      mcp: { untrustedOutput: true, untrustedFields: SUBSCRIBER_UNTRUSTED_FIELDS },
    }),
    blogCommand({
      id: 'subscribers.delete',
      summary: 'Delete one newsletter subscriber of the blog.',
      kind: CommandKind.DESTRUCTIVE,
      method: 'DELETE',
      suffix: '/subscribers/{subscriberId}',
      ids: ['subscriberId'],
    }),
  ],
});

export const blogGroup = defineGroup({
  id: 'products.blog',
  help: {
    usage: BLOG_USAGE,
    guidance:
      'Start with `get` to see whether the product has a hosted Outrank Blog. Without one, read `setup` and run ' +
      '`create`. Then manage posts, design, pages, categories, authors, domain, redirects, snippets, subscribers ' +
      'and webhooks from this subtree. Request bodies use camelCase fields, like the blog dashboard.',
  },
  unknown: (word) => ({
    message: `Unknown products blog subcommand: ${word}.`,
    guidance: 'Run `outrank-cli products blog --help` to see the available blog commands.',
  }),
  children: [
    blogCommand({
      id: 'get',
      summary: 'Show the hosted Outrank Blog of a product with its domain, usage and post counts.',
      kind: CommandKind.READ,
      method: 'GET',
    }),
    blogCommand({
      id: 'setup',
      summary: 'Show the suggested name, subdomain and accent color for a new blog on a product.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/setup',
    }),
    blogCommand({
      id: 'check-subdomain',
      summary: 'Check whether an outrankblog.com subdomain is valid and free.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/subdomain-availability',
      input: { subdomain: string().required(SUBDOMAIN_REQUIRED) },
      query: (values) => ({ subdomain: values.subdomain }),
    }),
    blogCommand({
      id: 'create',
      summary: 'Create the hosted Outrank Blog of a product; every body field is optional.',
      kind: CommandKind.WRITE,
      method: 'POST',
      body: BodyMode.OPTIONAL_JSON_OR_EMPTY_OBJECT,
      bodyField: BLOG_CREATE_BODY,
    }),
    blogCommand({
      id: 'update-settings',
      summary: 'Change the blog name, description, language, subdomain, badge, analytics or code injection.',
      kind: CommandKind.WRITE,
      method: 'PATCH',
      suffix: '/settings',
      body: BodyMode.JSON,
      bodyField: BLOG_SETTINGS_BODY,
    }),
    blogCommand({
      id: 'delete',
      summary: 'Delete the blog of a product; its posts become unpublished articles again.',
      kind: CommandKind.DESTRUCTIVE,
      method: 'DELETE',
      input: { confirm: string().required(CONFIRM_REQUIRED).describe('The blog subdomain, to confirm.') },
      bodyOf: (values) => ({ confirm: values.confirm }),
    }),
    blogCommand({
      id: 'usage',
      summary: 'Show the plan limits and current usage of the blog.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/usage',
    }),
    blogCommand({
      id: 'analytics',
      summary: 'Show the built-in traffic analytics of the blog.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/analytics',
      input: { range: oneOf(BLOG_ANALYTICS_RANGES) },
      query: (values) => ({ range: values.range }),
      mcp: { untrustedOutput: true, untrustedFields: ANALYTICS_UNTRUSTED_FIELDS },
    }),
    blogCommand({
      id: 'starter-posts',
      summary: 'Show the free AI starter-post allowance and the starter posts being written.',
      kind: CommandKind.READ,
      method: 'GET',
      suffix: '/starter-posts',
    }),
    blogCommand({
      id: 'preview',
      summary: 'Create a short-lived private preview link for the draft design, a draft post or a draft page.',
      kind: CommandKind.WRITE,
      method: 'POST',
      suffix: '/preview-token',
      input: {
        scope: oneOf(BLOG_PREVIEW_SCOPES).required(SCOPE_REQUIRED),
        targetId: uuid().describe('Article id for a post, page id for a page; omit for design.'),
      },
      refine: refinePreviewTarget,
      bodyOf: (values) => ({ scope: values.scope, ...(values.targetId ? { targetId: values.targetId } : {}) }),
    }),
    designGroup,
    domainGroup,
    postsGroup,
    pagesGroup,
    categoriesGroup,
    authorsGroup,
    redirectsGroup,
    snippetsGroup,
    subscribersGroup,
    webhooksGroup,
  ],
});
