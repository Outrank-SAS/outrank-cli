import fs from 'node:fs/promises';
import path from 'node:path';

import {
  parseArgs,
  getRequiredPositional,
  readJsonInput,
  hasFlag,
  parseIntegerOption,
  getOption,
} from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

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

const IMAGE_MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const buildQueryPath = (basePath, searchParams) => {
  const url = new URL(`https://local${basePath}`);
  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return `${url.pathname}${url.search}`;
};

const resolveImageUploadPayload = async (parsed) => {
  const filePath = getOption(parsed, 'file');
  if (!filePath) {
    throw Object.assign(new Error('Missing required option: --file <path>.'), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance: 'Pass a local image path with `--file <path>`.',
    });
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  const buffer = await fs.readFile(absolutePath).catch((error) => {
    throw Object.assign(new Error(`Failed to read file: ${error.message}`), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance: `Confirm that ${absolutePath} exists and is readable, then retry.`,
    });
  });

  const fileName = path.basename(absolutePath);
  const extension = path.extname(fileName).toLowerCase();
  const fileType = IMAGE_MIME_BY_EXTENSION[extension];

  if (!fileType) {
    throw Object.assign(new Error(`Unsupported image file extension: ${extension || '(none)'}.`), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance: 'Use one of: .jpg, .jpeg, .png, .webp, .gif.',
    });
  }

  return {
    file_base64: buffer.toString('base64'),
    file_name: fileName,
    file_type: fileType,
  };
};

const handleArticlesList = async (parsed) => {
  const path = buildQueryPath('/articles', {
    product_id: getOption(parsed, 'product'),
    status: getOption(parsed, 'status'),
    title: getOption(parsed, 'title'),
    keyword: getOption(parsed, 'keyword'),
    content: getOption(parsed, 'content'),
    slug: getOption(parsed, 'slug'),
    created_from: getOption(parsed, 'created-from'),
    created_to: getOption(parsed, 'created-to'),
    scheduled_from: getOption(parsed, 'scheduled-from'),
    scheduled_to: getOption(parsed, 'scheduled-to'),
    sort_by: getOption(parsed, 'sort-by'),
    sort_order: getOption(parsed, 'sort-order'),
    limit: parseIntegerOption(parsed, 'limit', { min: 1, max: 100 }),
    offset: parseIntegerOption(parsed, 'offset', { min: 0 }),
  });
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path,
  });
  return response.payload;
};

const handleArticlesGet = async (parsed) => {
  const articleId = getRequiredPositional(parsed, 0, '<article-id>');
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path: `/articles/${articleId}`,
  });
  return response.payload;
};

const handleArticlesGetContent = async (parsed) => {
  const articleId = getRequiredPositional(parsed, 0, '<article-id>');
  const path = buildQueryPath(`/articles/${articleId}/content`, {
    format: getOption(parsed, 'format'),
  });
  const response = await requestAgentApi(parsed, {
    method: 'GET',
    path,
  });
  return response.payload;
};

const handleArticlesUpdate = async (parsed) => {
  const articleId = getRequiredPositional(parsed, 0, '<article-id>');
  const body = await readJsonInput(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'PATCH',
    path: `/articles/${articleId}`,
    body,
  });
  return response.payload;
};

const handleArticlesUpdateContent = async (parsed) => {
  const articleId = getRequiredPositional(parsed, 0, '<article-id>');
  const body = await readJsonInput(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'PUT',
    path: `/articles/${articleId}/content`,
    body,
  });
  return response.payload;
};

const handleArticlesReplace = async (parsed) => {
  const articleId = getRequiredPositional(parsed, 0, '<article-id>');
  const body = await readJsonInput(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: `/articles/${articleId}/replace`,
    body,
  });
  return response.payload;
};

const handleArticlesBulkReplace = async (parsed) => {
  const body = await readJsonInput(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/articles/bulk-replace',
    body,
  });
  return response.payload;
};

const handleArticlesUploadImage = async (parsed) => {
  const imagePayload = await resolveImageUploadPayload(parsed);
  const articleId = getOption(parsed, 'article');
  const keyword = getOption(parsed, 'keyword');

  if (!articleId && !keyword) {
    throw Object.assign(new Error('Provide at least one of: --article <article-id> or --keyword <text>.'), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance:
        'Pass `--article <article-id>` for an existing article editor-style upload, or `--keyword <text>` when you want keyword-driven image metadata without an existing article.',
    });
  }

  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/articles/images/upload',
    body: {
      ...imagePayload,
      ...(articleId ? { article_id: articleId } : {}),
      ...(keyword ? { keyword } : {}),
    },
  });
  return response.payload;
};

const handleArticlesUploadFeaturedImage = async (parsed) => {
  const articleId = getRequiredPositional(parsed, 0, '<article-id>');
  const imagePayload = await resolveImageUploadPayload(parsed);
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: `/articles/${articleId}/featured-image/upload`,
    body: imagePayload,
  });
  return response.payload;
};

const handleArticlesRetryPublish = async (parsed) => {
  const articleId = getRequiredPositional(parsed, 0, '<article-id>');
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: `/articles/${articleId}/retry-publish`,
  });
  return response.payload;
};

const handleArticlesDelete = async (parsed) => {
  const articleId = getRequiredPositional(parsed, 0, '<article-id>');
  const response = await requestAgentApi(parsed, {
    method: 'DELETE',
    path: `/articles/${articleId}`,
  });
  return response.payload;
};

const handleArticlesPrecreate = async (parsed) => {
  const keywordId = getRequiredPositional(parsed, 0, '<keyword-id>');
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/articles/precreate',
    body: {
      keyword_id: keywordId,
    },
  });
  return response.payload;
};

const handleArticlesGenerate = async (parsed) => {
  const keywordId = getRequiredPositional(parsed, 0, '<keyword-id>');
  const response = await requestAgentApi(parsed, {
    method: 'POST',
    path: '/articles/generate',
    body: {
      keyword_id: keywordId,
    },
  });
  return response.payload;
};

export const handleArticlesCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp = !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: ARTICLES_HELP.trim(),
      },
      'Choose one of: list, get, get-content, update, update-content, replace, bulk-replace, upload-image, upload-featured-image, retry-publish, delete, precreate, generate.',
    );
  }

  if (subcommand === 'list') return handleArticlesList(parsed);
  if (subcommand === 'get') return handleArticlesGet(parsed);
  if (subcommand === 'get-content') return handleArticlesGetContent(parsed);
  if (subcommand === 'update') return handleArticlesUpdate(parsed);
  if (subcommand === 'update-content') return handleArticlesUpdateContent(parsed);
  if (subcommand === 'replace') return handleArticlesReplace(parsed);
  if (subcommand === 'bulk-replace') return handleArticlesBulkReplace(parsed);
  if (subcommand === 'upload-image') return handleArticlesUploadImage(parsed);
  if (subcommand === 'upload-featured-image') return handleArticlesUploadFeaturedImage(parsed);
  if (subcommand === 'retry-publish') return handleArticlesRetryPublish(parsed);
  if (subcommand === 'delete') return handleArticlesDelete(parsed);
  if (subcommand === 'precreate') return handleArticlesPrecreate(parsed);
  if (subcommand === 'generate') return handleArticlesGenerate(parsed);

  throw Object.assign(new Error(`Unknown articles subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli articles --help` to see available article commands.',
  });
};

