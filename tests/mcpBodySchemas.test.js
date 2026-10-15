import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registry } from '../src/commands/index.js';
import { BODY_INPUT_NAME, toolName } from '../src/commands/registry.js';
import { CliErrorCode } from '../src/core/errors.js';
import { FieldKind, json, list, zodField } from '../src/core/schema.js';
import { withMcp } from './helpers/mcpHarness.js';

const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const ARTICLE_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const POST_WRITE_PROPERTIES = Object.freeze([
  'title',
  'content',
  'contentHtml',
  'metaDescription',
  'status',
  'scheduledFor',
  'slug',
  'authorId',
  'categoryId',
  'newCategoryName',
  'tags',
  'featured',
  'excerpt',
  'seoTitle',
  'seoDescription',
  'ogImageUrl',
  'coverImageUrl',
  'coverAlt',
  'canonicalUrl',
  'noindex',
  'showToc',
]);
const SHAPED_BODIES = Object.freeze({
  products_create: {
    required: ['name', 'url', 'description', 'target_audiences', 'language', 'keyword_region', 'competitors'],
    properties: ['name', 'url', 'description', 'target_audiences', 'language', 'keyword_region', 'competitors'],
  },
  products_update: {
    required: [],
    properties: [
      'name',
      'description',
      'target_audiences',
      'sitemap_url',
      'blog_root_url',
      'example_article_urls',
      'auto_keyword_generation_disabled',
    ],
  },
  products_output_settings_update: {
    required: [],
    properties: [
      'language',
      'keyword_region',
      'tone_and_style',
      'image_style',
      'featured_image_style',
      'global_article_prompt',
      'global_keyword_prompt',
      'outline',
      'outrank_prompt',
      'not_included_words',
      'internal_links',
      'brand_color',
      'auto_publish',
      'table_of_contents',
      'is_cta_included',
      'is_video_included',
      'mention_similar_products',
      'is_infographics_enabled',
      'is_first_person_enabled',
      'are_in_article_emojis_disabled',
      'use_different_featured_style',
    ],
  },
  keywords_add: { required: [], properties: ['items', 'stored_keyword_ids'] },
  articles_update: {
    required: [],
    properties: [
      'title',
      'meta_description',
      'image_url',
      'status',
      'instructions',
      'article_type',
      'article_subtype',
      'expected_length',
    ],
  },
  articles_update_content: { required: [], properties: ['content'] },
  improvements_settings_update: { required: [], properties: ['enabled', 'auto_push', 'publishing_days'] },
  products_blog_create: { required: [], properties: ['name', 'subdomain', 'template', 'accentColor', 'publishReadyArticles', 'publishHere'] },
  products_blog_update_settings: { required: [], properties: ['name', 'description', 'language', 'platformSubdomain', 'isPlatformIndexable', 'badgeEnabled', 'analyticsSettings', 'codeInjection'] },
  products_blog_domain_connect: { required: ['mode', 'hostname'], properties: ['mode', 'hostname', 'basePath'] },
  products_blog_posts_create: { required: [], properties: POST_WRITE_PROPERTIES },
  products_blog_posts_update: { required: [], properties: POST_WRITE_PROPERTIES },
  products_blog_design_patch: { required: [], properties: ['config', 'publish'] },
  articles_create: {
    required: [],
    properties: ['product_id', 'title', 'content', 'content_html', 'meta_description', 'slug', 'image_url', 'tags', 'publish'],
  },
  products_blog_posts_update_content: { required: [], properties: ['title', 'content'] },
  products_blog_pages_create: { required: ['title'], properties: ['title', 'slug', 'content', 'seoTitle', 'seoDescription', 'status', 'showInNav', 'position', 'layout'] },
  products_blog_pages_update: { required: [], properties: ['title', 'slug', 'content', 'seoTitle', 'seoDescription', 'status', 'showInNav', 'position', 'layout'] },
  products_blog_pages_reorder: { required: ['items'], properties: ['items'] },
  products_blog_categories_create: { required: ['name'], properties: ['name', 'slug', 'description', 'seoTitle', 'seoDescription', 'position'] },
  products_blog_categories_update: { required: [], properties: ['name', 'slug', 'description', 'seoTitle', 'seoDescription', 'position'] },
  products_blog_categories_reorder: { required: ['items'], properties: ['items'] },
  products_blog_authors_create: { required: ['name'], properties: ['name', 'slug', 'avatarUrl', 'bio', 'jobTitle', 'websiteUrl', 'social', 'isDefault'] },
  products_blog_authors_update: { required: [], properties: ['name', 'slug', 'avatarUrl', 'bio', 'jobTitle', 'websiteUrl', 'social', 'isDefault'] },
  products_blog_redirects_create: { required: ['fromPath'], properties: ['fromPath', 'toPath', 'statusCode'] },
  products_blog_snippets_create: { required: ['name', 'kind'], properties: ['name', 'kind', 'content', 'placement', 'isActive'] },
  products_blog_snippets_update: { required: [], properties: ['name', 'kind', 'content', 'placement', 'isActive'] },
  products_blog_webhooks_create: { required: ['url'], properties: ['url', 'events'] },
  products_blog_webhooks_update: { required: [], properties: ['url', 'events', 'isActive', 'rotateSecret'] },
});
const UNTRUSTED_TEXT_FIELD = 'untrusted_counterparty_text';
const ARTICLE_MARKDOWN = '# Title\n\nBody.';
const ARTICLE_CONTENT_PATHNAME = `/api/agent/v1/articles/${ARTICLE_ID}/content`;

const bodySchemaOf = (tools, name) => tools.find((tool) => tool.name === name).inputSchema.properties.body;

const KEYWORD_TEXT = 'best seo tools';
const KEYWORD_OBJECT = Object.freeze({ keyword: 'seo checklist', search_volume: 1200 });
const KEYWORDS_PATHNAME = '/api/agent/v1/keywords';
const ANY_JSON_VALUES = Object.freeze(['text', 7, true, ['nested'], { nested: 1 }]);

const nestedJsonFields = (field, trail = []) => {
  if (field.kind === FieldKind.LIST) return nestedJsonFields(field.item, [...trail, 'items']);
  if (field.kind === FieldKind.JSON) return trail.length > 0 ? [trail] : [];
  if (field.kind !== FieldKind.OBJECT || !field.properties) return [];
  return Object.entries(field.properties).flatMap(([key, property]) =>
    nestedJsonFields(property, [...trail, 'properties', key]),
  );
};

const schemaAt = (schema, trail) => trail.reduce((current, key) => current[key], schema);

test('keywords_add accepts keyword texts, objects and a mix of both, and sends them unchanged', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, calls, client }) => {
    const { tools } = await client.listTools();
    const items = bodySchemaOf(tools, 'keywords_add').properties.items;
    assert.equal(items.type, 'array');
    assert.equal(Object.hasOwn(items.items, 'type'), false, JSON.stringify(items.items));
    const bodies = [
      { items: [KEYWORD_TEXT] },
      { items: [KEYWORD_OBJECT] },
      { items: [KEYWORD_TEXT, KEYWORD_OBJECT] },
    ];
    for (const body of bodies) {
      const { envelope } = await call('keywords_add', { product_id: PRODUCT_ID, body });
      assert.equal(envelope.ok, true, JSON.stringify(envelope));
      const sent = calls.at(-1);
      assert.equal(sent.pathname, KEYWORDS_PATHNAME);
      assert.deepEqual(sent.body.items, body.items);
    }
  });
});

test('a free-form JSON value inside a shaped body or a list is not narrowed to an object', async () => {
  const { z } = await import('zod');
  const shaped = registry.commands.filter((spec) => spec.input[BODY_INPUT_NAME]?.properties);
  assert.deepEqual(shaped.map((spec) => toolName(spec.id)).sort(), Object.keys(SHAPED_BODIES).sort());
  const nested = shaped.flatMap((spec) =>
    nestedJsonFields(spec.input[BODY_INPUT_NAME]).map((trail) => ({ spec, trail })),
  );
  assert.deepEqual(
    nested.map(({ spec, trail }) => `${toolName(spec.id)}:${trail.join('.')}`),
    [
      'keywords_add:properties.items.items',
      'products_blog_update_settings:properties.analyticsSettings',
      'products_blog_update_settings:properties.codeInjection',
      'products_blog_design_patch:properties.config',
      'products_blog_authors_create:properties.social',
      'products_blog_authors_update:properties.social',
      'products_blog_snippets_create:properties.content',
      'products_blog_snippets_create:properties.placement',
      'products_blog_snippets_update:properties.content',
      'products_blog_snippets_update:properties.placement',
    ],
  );
  for (const { spec, trail } of nested) {
    const body = zodField(z, spec.input[BODY_INPUT_NAME], { jsonAsObject: true });
    const published = schemaAt(z.toJSONSchema(body), trail);
    assert.equal(Object.hasOwn(published, 'type'), false, JSON.stringify(published));
  }
  const freeBody = zodField(z, json().required(), { jsonAsObject: true });
  assert.equal(freeBody.safeParse('text').success, false);
  assert.equal(freeBody.safeParse({ any: 'object' }).success, true);
  const freeList = zodField(z, list({ item: json() }).required(), { jsonAsObject: true });
  for (const value of ANY_JSON_VALUES) assert.equal(freeList.safeParse([value]).success, true, JSON.stringify(value));
});

test('articles_update_content names the content field when a wrapped value is sent back instead of the text', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, calls }) => {
    const before = calls.length;
    const wrapped = { content: { [UNTRUSTED_TEXT_FIELD]: ARTICLE_MARKDOWN } };
    const refused = await call('articles_update_content', { article_id: ARTICLE_ID, body: wrapped });
    assert.equal(refused.envelope.ok, false);
    assert.equal(refused.envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.match(refused.envelope.error.message, /body\.content/);
    assert.equal(calls.length, before);

    const accepted = await call('articles_update_content', {
      article_id: ARTICLE_ID,
      body: { content: ARTICLE_MARKDOWN },
    });
    assert.equal(accepted.envelope.ok, true, JSON.stringify(accepted.envelope));
    const sent = calls.at(-1);
    assert.equal(sent.pathname, ARTICLE_CONTENT_PATHNAME);
    assert.deepEqual(sent.body, { content: ARTICLE_MARKDOWN });
  });
});

test('the seven shaped tools publish their body fields and required keys in the input schema', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ client }) => {
    const { tools } = await client.listTools();
    for (const [name, expected] of Object.entries(SHAPED_BODIES)) {
      const body = bodySchemaOf(tools, name);
      assert.equal(body.type, 'object', name);
      assert.deepEqual(Object.keys(body.properties).sort(), [...expected.properties].sort(), name);
      assert.deepEqual([...(body.required ?? [])].sort(), [...expected.required].sort(), name);
      assert.notEqual(body.additionalProperties, false, name);
    }
    const status = bodySchemaOf(tools, 'articles_update').properties.status;
    assert.deepEqual(status.enum, ['generated', 'approved', 'published']);
    const days = bodySchemaOf(tools, 'improvements_settings_update').properties.publishing_days;
    assert.deepEqual(days.items.enum, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    const prompt = bodySchemaOf(tools, 'products_output_settings_update').properties.global_article_prompt;
    assert.ok(JSON.stringify(prompt).includes('null'), JSON.stringify(prompt));
  });
});

test('a body that breaks the shape is refused before any request, with the field named', async () => {
  await withMcp({ argv: ['--toolsets', 'all'] }, async ({ call, calls }) => {
    const before = calls.length;
    const cases = [
      ['products_create', { body: { name: 'Acme' } }, /description/],
      ['products_update', { product_id: PRODUCT_ID, body: { target_audiences: 'everyone' } }, /target_audiences/],
      ['articles_update', { article_id: ARTICLE_ID, body: { status: 'deleted' } }, /status/],
      [
        'improvements_settings_update',
        { product_id: PRODUCT_ID, body: { publishing_days: ['Monday'] } },
        /publishing_days/,
      ],
      ['products_output_settings_update', { product_id: PRODUCT_ID, body: { internal_links: 6 } }, /internal_links/],
    ];
    for (const [tool, args, pattern] of cases) {
      const { envelope } = await call(tool, args);
      assert.equal(envelope.ok, false, tool);
      assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE, tool);
      assert.match(envelope.error.message, pattern);
    }
    assert.equal(calls.length, before);
    const accepted = await call('products_update', {
      product_id: PRODUCT_ID,
      body: { description: 'A longer description of the product that is at least fifty characters.', extra_key: 1 },
    });
    assert.equal(accepted.envelope.ok, true);
    assert.deepEqual(calls.at(-1).body, {
      description: 'A longer description of the product that is at least fifty characters.',
      extra_key: 1,
    });
  });
});
