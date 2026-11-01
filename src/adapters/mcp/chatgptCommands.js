import { registry } from '../../commands/index.js';
import { CommandKind, Toolset, createRegistry, defineCommand } from '../../commands/registry.js';
import { cliSuccess } from '../../core/errors.js';
import { int, uuid } from '../../core/schema.js';
import { MILLISECONDS_PER_SECOND } from './constants.js';

const ARTICLES_GROUP_ID = 'articles';
const TOOLSETS = [Toolset.ARTICLES];
const KEYWORD_ID_CLI = { positionals: ['keywordId'] };
const ARTICLE_PATH = '/articles/{articleId}';
const ARTICLE_LIST_DASHBOARD_PATH = '/dashboard/articles';
const ARTICLE_STATUS_MAX_WAIT_SECONDS = 40;
const ARTICLE_STATUS_POLL_MS = 5_000;
const SCHEDULED_KEYWORD_KIND = 'scheduled';
const MARKETPLACE_PLACEMENT_FLAG = 'is_marketplace_placement';
const ArticleKeywordStatus = Object.freeze({ GENERATING: 'generating_article' });
const ArticleProgress = Object.freeze({ QUEUED: 'queued', WRITING: 'writing', READY: 'ready' });

const dashboardUrl = (ctx, path) => `${ctx.baseUrl}${path}`;

const startCommand = defineCommand({
  id: 'articles.start',
  summary: 'Start writing the article of a scheduled keyword and return right away, without waiting for it.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { keywordId: uuid().required() },
  cli: KEYWORD_ID_CLI,
  run: async (input, ctx) => {
    const result = await ctx.http({ method: 'POST', path: '/articles/start', body: { keyword_id: input.keywordId } });
    if (result.ok !== true) return result;
    const startGuidance =
      `The article is being written and usually takes several minutes. Tell the user it appears at article_list_url. ` +
      `Follow it with ${ctx.ref('articles.status')}. Never start it again: that would use another article.`;
    return cliSuccess(
      { ...result.data, article_list_url: dashboardUrl(ctx, ARTICLE_LIST_DASHBOARD_PATH), nextStep: startGuidance },
      startGuidance,
    );
  },
});

const waitFor = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

const readArticleState = (keyword) => {
  if (keyword.article_id && keyword.status !== ArticleKeywordStatus.GENERATING) return ArticleProgress.READY;
  return keyword.status === ArticleKeywordStatus.GENERATING ? ArticleProgress.WRITING : ArticleProgress.QUEUED;
};

const pickArticleFields = (article) => ({
  id: article.id,
  title: article.title,
  meta_description: article.meta_description,
  image_url: article.image_url,
  display_status: article.display_status,
  status_label: article.status_label,
  publish_error: article.publish_error,
  editor_url: article.editor_url,
  is_marketplace_placement: article.is_marketplace_placement,
});

const statusCommand = defineCommand({
  id: 'articles.status',
  summary: 'Follow an article being written: waits for it, then reports its state and the finished article.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: {
    untrustedOutput: true,
    untrustedFields: ['article.title', 'article.meta_description'],
    untrustedWhen: { record: 'article', flag: MARKETPLACE_PLACEMENT_FLAG },
  },
  input: {
    keywordId: uuid().required(),
    waitSeconds: int({ min: 0, max: ARTICLE_STATUS_MAX_WAIT_SECONDS })
      .default(ARTICLE_STATUS_MAX_WAIT_SECONDS)
      .describe('How long to wait for the article before answering.'),
  },
  cli: KEYWORD_ID_CLI,
  run: async (input, ctx) => {
    const deadline = Date.now() + input.waitSeconds * MILLISECONDS_PER_SECOND;
    let keywordResult;
    let state;
    for (;;) {
      keywordResult = await ctx.http({
        method: 'GET',
        path: '/keywords/{keywordId}',
        pathParams: { keywordId: input.keywordId },
        query: { kind: SCHEDULED_KEYWORD_KIND },
      });
      if (keywordResult.ok !== true) return keywordResult;
      state = readArticleState(keywordResult.data);
      const remainingMs = deadline - Date.now();
      if (state === ArticleProgress.READY || !(remainingMs > 0) || ctx.signal?.aborted) break;
      await waitFor(Math.min(ARTICLE_STATUS_POLL_MS, remainingMs), ctx.signal);
    }
    const keyword = keywordResult.data;
    const base = {
      keyword_id: input.keywordId,
      keyword: keyword.keyword,
      state,
      article_list_url: dashboardUrl(ctx, ARTICLE_LIST_DASHBOARD_PATH),
    };
    if (state !== ArticleProgress.READY) {
      const waitGuidance =
        `Still ${state}. Call ${ctx.ref('articles.status')} again. Do not start the article again: that would use ` +
        'another article. If the user stops waiting, tell them it appears at article_list_url.';
      return cliSuccess({ ...base, nextStep: waitGuidance }, waitGuidance);
    }
    const articleResult = await ctx.http({
      method: 'GET',
      path: ARTICLE_PATH,
      pathParams: { articleId: keyword.article_id },
    });
    if (articleResult.ok !== true) return articleResult;
    const readyGuidance = `Done. Give the user the title and editor_url. ${ctx.ref('articles.get-content')} returns the full text.`;
    return cliSuccess({ ...base, article: pickArticleFields(articleResult.data), nextStep: readyGuidance }, readyGuidance);
  },
});

const withArticleProgress = (group) =>
  group.id === ARTICLES_GROUP_ID ? { ...group, children: [...group.children, startCommand, statusCommand] } : group;

export const chatGptRegistry = createRegistry(registry.groups.map(withArticleProgress));
