import { LIST_MAX_LIMIT, LIST_MIN_LIMIT, MIN_OFFSET, Surface } from '../core/constants.js';
import { MCP_USAGE_GUIDANCE, usageError } from '../core/errors.js';
import { image, int, object, oneOf, string, uuid } from '../core/schema.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';

const ARTICLE_UPDATE_STATUSES = ['generated', 'approved', 'published'];
const ARTICLE_TYPES = ['guide', 'listicle'];
const ARTICLE_SUBTYPES = ['howTo', 'explainer', 'comparison', 'reference', 'roundup', 'resources', 'examples'];
const ARTICLE_EXPECTED_LENGTHS = ['auto', 'short', 'medium', 'long', 'comprehensive'];
const ARTICLE_TITLE_HINT = 'At most 300 characters.';
const META_DESCRIPTION_HINT = 'Trimmed to 160 characters.';
const IMAGE_URL_HINT = 'Absolute http(s) URL.';
const ARTICLE_STATUS_HINT = 'published publishes through the product integration for real.';
const ARTICLE_INSTRUCTIONS_HINT = 'Per-article instructions of the linked scheduled keyword.';
const ARTICLE_SUBTYPE_HINT =
  'guide: howTo | explainer | comparison | reference; listicle: roundup | resources | examples.';
const ARTICLE_UPDATE_BODY = object().shape({
  title: string().describe(ARTICLE_TITLE_HINT),
  meta_description: string().describe(META_DESCRIPTION_HINT),
  image_url: string().describe(IMAGE_URL_HINT),
  status: oneOf(ARTICLE_UPDATE_STATUSES).describe(ARTICLE_STATUS_HINT),
  instructions: string().nullable().describe(ARTICLE_INSTRUCTIONS_HINT),
  article_type: oneOf(ARTICLE_TYPES),
  article_subtype: oneOf(ARTICLE_SUBTYPES).describe(ARTICLE_SUBTYPE_HINT),
  expected_length: oneOf(ARTICLE_EXPECTED_LENGTHS),
});

export const ARTICLES_HELP = `Usage:
  outrank-cli articles list [--product <product-id>] [--status generated|approved|published|failed|deleted] [--title <text>] [--keyword <text>] [--content <text>] [--slug <text>] [--created-from <date>] [--created-to <date>] [--scheduled-from <date>] [--scheduled-to <date>] [--sort-by created_at|status|title] [--sort-order asc|desc] [--limit <n>] [--offset <n>]
  outrank-cli articles get <article-id>
  outrank-cli articles get-content <article-id> [--format markdown|html]
  outrank-cli articles update <article-id> --json <object>
  outrank-cli articles update-content <article-id> --json <object>
  outrank-cli articles replace <article-id> --json <object>
  outrank-cli articles bulk-replace --json <object>
  outrank-cli articles upload-image --file <path> [--article <article-id>] [--keyword <text>]
  outrank-cli articles upload-featured-image <article-id> --file <path>
  outrank-cli articles retry-publish <article-id>
  outrank-cli articles delete <article-id>
  outrank-cli articles precreate <keyword-id>  # eligible future scheduled keyword only
  outrank-cli articles generate <keyword-id>   # scheduled for today only

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Examples:
  outrank-cli articles list --product 00000000-0000-0000-0000-000000000000 --status published --limit 20
  outrank-cli articles get 00000000-0000-0000-0000-000000000000
  outrank-cli articles get-content 00000000-0000-0000-0000-000000000000 --format html
  outrank-cli articles update 00000000-0000-0000-0000-000000000000 --json '{"title":"New title"}'
  outrank-cli articles update 00000000-0000-0000-0000-000000000000 --json '{"image_url":"https://example.com/featured.jpg"}'
  outrank-cli articles update-content 00000000-0000-0000-0000-000000000000 --json-file article-content.json
  outrank-cli articles replace 00000000-0000-0000-0000-000000000000 --json '{"find":"Old brand","replace_with":"New brand","preview_only":true}'
  outrank-cli articles bulk-replace --json-file bulk-replace.json
  outrank-cli articles upload-image --file .\\diagram.png --article 00000000-0000-0000-0000-000000000000
  outrank-cli articles upload-featured-image 00000000-0000-0000-0000-000000000000 --file .\\hero.jpg
  outrank-cli articles retry-publish 00000000-0000-0000-0000-000000000000
  outrank-cli articles precreate 00000000-0000-0000-0000-000000000000
  outrank-cli articles generate 00000000-0000-0000-0000-000000000000
`;

const TOOLSETS = [Toolset.ARTICLES];
const ARTICLE_PATH = '/articles/{articleId}';
const ARTICLE_ID_CLI = { positionals: ['articleId'] };
const KEYWORD_ID_CLI = { positionals: ['keywordId'] };
const FILE_PLACEHOLDERS = { file: '<path>' };
const FILE_REQUIRED = { guidance: 'Pass a local image path with `--file <path>`.' };
const UPLOAD_TARGET_GUIDANCE =
  'Pass `--article <article-id>` for an existing article editor-style upload, or `--keyword <text>` when you ' +
  'want keyword-driven image metadata without an existing article.';

const MARKETPLACE_PLACEMENT_FLAG = 'is_marketplace_placement';
const HOSTED_ARTICLE_TEXT_FIELDS = Object.freeze([
  'title',
  'scheduled_keyword',
  'meta_description',
  'slug',
  'instructions',
  'publish_error',
  'image_url',
  '_human.summary',
]);
const HOSTED_ARTICLE_BODY_FIELDS = Object.freeze(['title', 'content']);
const HOSTED_ARTICLE_REPLACE_FIELDS = Object.freeze(['title', 'before_excerpt', 'after_excerpt']);
const LIST_RECORD = 'items[]';
const ROOT_RECORD = '';
const NESTED_ARTICLE_FIELDS = Object.freeze(HOSTED_ARTICLE_TEXT_FIELDS.map((field) => `article.${field}`));
const RETRY_PUBLISH_FIELDS = Object.freeze(['error', ...NESTED_ARTICLE_FIELDS]);
const UPLOADED_IMAGE_FIELDS = Object.freeze(['keyword', 'alt_text', 'filename', 'url']);
const UPLOADED_FEATURED_IMAGE_FIELDS = Object.freeze(['filename', 'image_url']);
const PRECREATED_KEYWORD_FIELDS = Object.freeze(['keyword']);
const ARTICLE_CONTENT_HINT = 'Required. The full article body as markdown.';
const ARTICLE_CONTENT_BODY = object().shape({ content: string().describe(ARTICLE_CONTENT_HINT) });

const hostedArticleMcp = (record, fields) => ({
  untrustedOutput: true,
  untrustedFields: fields.map((field) => (record ? `${record}.${field}` : field)),
  untrustedWhen: { record, flag: MARKETPLACE_PLACEMENT_FLAG },
});

const articleIdInput = () => ({ articleId: uuid().required() });
const articleIdParams = (input) => ({ articleId: input.articleId });

const listCommand = defineCommand({
  id: 'articles.list',
  summary: 'List articles with optional filters, sorting and pagination.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: hostedArticleMcp(LIST_RECORD, HOSTED_ARTICLE_TEXT_FIELDS),
  input: {
    productId: uuid(),
    status: string(),
    title: string(),
    keyword: string(),
    content: string(),
    slug: string(),
    createdFrom: string(),
    createdTo: string(),
    scheduledFrom: string(),
    scheduledTo: string(),
    sortBy: string(),
    sortOrder: string(),
    limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
    offset: int({ min: MIN_OFFSET }),
  },
  cli: { options: { product: 'productId' } },
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: '/articles',
      query: {
        product_id: input.productId,
        status: input.status,
        title: input.title,
        keyword: input.keyword,
        content: input.content,
        slug: input.slug,
        created_from: input.createdFrom,
        created_to: input.createdTo,
        scheduled_from: input.scheduledFrom,
        scheduled_to: input.scheduledTo,
        sort_by: input.sortBy,
        sort_order: input.sortOrder,
        limit: input.limit,
        offset: input.offset,
      },
    }),
});

const getCommand = defineCommand({
  id: 'articles.get',
  summary: 'Get article metadata by id.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: hostedArticleMcp(ROOT_RECORD, HOSTED_ARTICLE_TEXT_FIELDS),
  input: articleIdInput(),
  cli: ARTICLE_ID_CLI,
  run: (input, ctx) => ctx.http({ method: 'GET', path: ARTICLE_PATH, pathParams: articleIdParams(input) }),
});

const getContentCommand = defineCommand({
  id: 'articles.get-content',
  summary: 'Get the article body as markdown or HTML.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: hostedArticleMcp(ROOT_RECORD, HOSTED_ARTICLE_BODY_FIELDS),
  input: { ...articleIdInput(), format: string() },
  cli: ARTICLE_ID_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${ARTICLE_PATH}/content`,
      pathParams: articleIdParams(input),
      query: { format: input.format },
    }),
});

const bodyCommand = ({ id, summary, kind, method, pathSuffix, bodyField, mcp }) =>
  defineCommand({
    id,
    summary,
    kind,
    toolsets: TOOLSETS,
    mcp,
    input: articleIdInput(),
    cli: ARTICLE_ID_CLI,
    body: BodyMode.JSON,
    ...(bodyField ? { bodyField } : {}),
    run: (input, ctx) =>
      ctx.http({ method, path: `${ARTICLE_PATH}${pathSuffix}`, pathParams: articleIdParams(input), body: input.body }),
  });

const updateCommand = bodyCommand({
  id: 'articles.update',
  summary: 'Update article metadata from a JSON body.',
  kind: CommandKind.WRITE,
  method: 'PATCH',
  pathSuffix: '',
  bodyField: ARTICLE_UPDATE_BODY,
  mcp: hostedArticleMcp(ROOT_RECORD, HOSTED_ARTICLE_TEXT_FIELDS),
});

const updateContentCommand = bodyCommand({
  id: 'articles.update-content',
  summary: 'Replace the article body from a JSON body.',
  kind: CommandKind.WRITE,
  method: 'PUT',
  pathSuffix: '/content',
  bodyField: ARTICLE_CONTENT_BODY,
  mcp: hostedArticleMcp(ROOT_RECORD, HOSTED_ARTICLE_BODY_FIELDS),
});

const replaceCommand = bodyCommand({
  id: 'articles.replace',
  summary: 'Find and replace text inside one article.',
  kind: CommandKind.WRITE,
  method: 'POST',
  pathSuffix: '/replace',
  mcp: hostedArticleMcp(ROOT_RECORD, HOSTED_ARTICLE_REPLACE_FIELDS),
});

const bulkReplaceCommand = defineCommand({
  id: 'articles.bulk-replace',
  summary: 'Find and replace text across several articles from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  mcp: hostedArticleMcp(LIST_RECORD, HOSTED_ARTICLE_REPLACE_FIELDS),
  body: BodyMode.JSON,
  run: (input, ctx) => ctx.http({ method: 'POST', path: '/articles/bulk-replace', body: input.body }),
});

const uploadImageCommand = defineCommand({
  id: 'articles.upload-image',
  summary: 'Upload an image for an article or a keyword.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  mcp: hostedArticleMcp(ROOT_RECORD, UPLOADED_IMAGE_FIELDS),
  input: { file: image().required(FILE_REQUIRED), articleId: uuid(), keyword: string() },
  cli: { options: { article: 'articleId' }, placeholders: FILE_PLACEHOLDERS },
  refine: (input, ctx) => {
    if (input.articleId || input.keyword) return;
    if (ctx.surface === Surface.MCP) {
      throw usageError('Provide at least one of: article_id or keyword.', MCP_USAGE_GUIDANCE);
    }
    throw usageError('Provide at least one of: --article <article-id> or --keyword <text>.', UPLOAD_TARGET_GUIDANCE);
  },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: '/articles/images/upload',
      body: {
        ...input.file,
        ...(input.articleId ? { article_id: input.articleId } : {}),
        ...(input.keyword ? { keyword: input.keyword } : {}),
      },
    }),
});

const uploadFeaturedImageCommand = defineCommand({
  id: 'articles.upload-featured-image',
  summary: 'Upload the featured image of an article.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  mcp: hostedArticleMcp(ROOT_RECORD, UPLOADED_FEATURED_IMAGE_FIELDS),
  input: { ...articleIdInput(), file: image().required(FILE_REQUIRED) },
  cli: { ...ARTICLE_ID_CLI, placeholders: FILE_PLACEHOLDERS },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${ARTICLE_PATH}/featured-image/upload`,
      pathParams: articleIdParams(input),
      body: input.file,
    }),
});

const retryPublishCommand = defineCommand({
  id: 'articles.retry-publish',
  summary: 'Retry publishing an article to its integration.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  mcp: hostedArticleMcp(ROOT_RECORD, RETRY_PUBLISH_FIELDS),
  input: articleIdInput(),
  cli: ARTICLE_ID_CLI,
  longRunning: { pollTool: 'articles.get' },
  run: (input, ctx) =>
    ctx.http({ method: 'POST', path: `${ARTICLE_PATH}/retry-publish`, pathParams: articleIdParams(input) }),
});

const deleteCommand = defineCommand({
  id: 'articles.delete',
  summary: 'Delete an article.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  mcp: hostedArticleMcp(ROOT_RECORD, HOSTED_ARTICLE_TEXT_FIELDS),
  input: articleIdInput(),
  cli: ARTICLE_ID_CLI,
  run: (input, ctx) => ctx.http({ method: 'DELETE', path: ARTICLE_PATH, pathParams: articleIdParams(input) }),
});

const keywordActionCommand = ({ id, summary, actionPath, mcp }) =>
  defineCommand({
    id,
    summary,
    kind: CommandKind.WRITE,
    toolsets: TOOLSETS,
    mcp,
    input: { keywordId: uuid().required() },
    cli: KEYWORD_ID_CLI,
    longRunning: { pollTool: 'articles.list' },
    run: (input, ctx) => ctx.http({ method: 'POST', path: actionPath, body: { keyword_id: input.keywordId } }),
  });

const precreateCommand = keywordActionCommand({
  id: 'articles.precreate',
  summary: 'Pre-create the article for an eligible future scheduled keyword.',
  actionPath: '/articles/precreate',
  mcp: hostedArticleMcp(ROOT_RECORD, PRECREATED_KEYWORD_FIELDS),
});

const generateCommand = keywordActionCommand({
  id: 'articles.generate',
  summary: 'Generate the article for a keyword scheduled for today.',
  actionPath: '/articles/generate',
  mcp: hostedArticleMcp(ROOT_RECORD, NESTED_ARTICLE_FIELDS),
});

export const articlesGroup = defineGroup({
  id: 'articles',
  help: {
    usage: ARTICLES_HELP,
    guidance:
      'Choose one of: list, get, get-content, update, update-content, replace, bulk-replace, upload-image, ' +
      'upload-featured-image, retry-publish, delete, precreate, generate.',
  },
  unknown: (word) => ({
    message: `Unknown articles subcommand: ${word}.`,
    guidance: 'Run `outrank-cli articles --help` to see available article commands.',
  }),
  children: [
    listCommand,
    getCommand,
    getContentCommand,
    updateCommand,
    updateContentCommand,
    replaceCommand,
    bulkReplaceCommand,
    uploadImageCommand,
    uploadFeaturedImageCommand,
    retryPublishCommand,
    deleteCommand,
    precreateCommand,
    generateCommand,
  ],
});
