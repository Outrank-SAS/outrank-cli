const ARTICLE_TYPE_FIELDS =
  'article_type (guide | listicle), article_subtype (guide: howTo | explainer | comparison | reference; listicle: ' +
  'roundup | resources | examples), expected_length (auto | short | medium | long | comprehensive)';
const REWRITE_BRIEF_BODY =
  'Fields: rewrite_brief { summary (required), weakSections [{ heading, reason, suggestedChange }], sectionsToAdd ' +
  '[{ heading, rationale }], sectionsToKeepAsIs [], keywordsToIncorporate [], titleSuggestion, ' +
  'metaDescriptionSuggestion, globalNotes [] }. The brief is replaced as a whole: send every part you want to keep.';
const REVIEW_BODY =
  'Fields: decisions { <hunkId>: kept | rejected }, edited_hunks { <hunkId>: replacement text }, edited_title, ' +
  'edited_meta_description. Hunk ids come from improvements_executions_get.';
const DATE_HINT = 'YYYY-MM-DD or ISO-8601.';
const ISO_HINT = 'ISO-8601 date or timestamp, for example 2026-06-01T09:00:00Z.';
const BACKLINK_STATUS_HINT = 'created | verified | not_verified | refunded | lost | recovering.';
const DESC_ONLY_HINT = 'Only desc is accepted.';
const COUNTRY_HINT = 'Two-letter country code of the payout bank account, for example US.';
const WEBFLOW_TOKEN_BODY = 'Fields: api_token (required)';
const FRAMER_BODY = 'Fields: project_url (https://framer.com/projects/<id>, required), server_api_key (required)';
const ADMIN_NOTE = 'Works only when the user who created the API key is an organization admin.';
const BACKLINK_SUBSCRIPTION_NOTE = 'Needs an active backlink subscription.';

export const TOOL_NOTES = Object.freeze({
  'auth.whoami': {
    note:
      'Returns the user, the organization (id, credits, product_count = purchased product slots) and entitlements ' +
      '(the toolsets this organization can use). Calling it also refreshes the tool list of this server.',
  },
  'auth.status': { note: 'Local check: makes no request and never shows the key.' },
  'billing.portal-url': { note: 'Give the returned link to the user; they manage billing in the browser.' },
  'billing.purchase-products.quote': {
    note: 'Always call this before billing_purchase_products_buy and show the quoted recurring total to the user.',
    fields: {
      additionalProducts: 'How many product slots to add.',
      idempotencyKey: 'Optional; one is generated and returned when omitted.',
    },
  },
  'billing.purchase-products.buy': {
    note:
      'Charges the stored card with no browser step. If the call times out or fails in transit, retry with exactly ' +
      'the same idempotency_key: a new key can charge the user twice.',
    fields: {
      additionalProducts: 'Same number that was quoted.',
      confirmChargeCents: 'The recurring total in cents from the quote. Never guess it.',
      idempotencyKey: 'A unique key you create once for this purchase and reuse on every retry.',
    },
  },
  'keywords.list': {
    note: 'Scheduled keywords are the content plan; stored keywords are unscheduled inventory.',
    fields: {
      scope: 'scheduled (default) | stored | all.',
      status: 'published | scheduled | generating_article | pregenerated | disabled.',
      q: 'Text search in the keyword.',
      scheduledFrom: DATE_HINT,
      scheduledTo: DATE_HINT,
    },
  },
  'keywords.get': { fields: { kind: 'scheduled | stored. Omit to look in both.' } },
  'keywords.export': { note: 'Returns the whole plan in one response, which can be large.' },
  'keywords.add': {
    note:
      'Keywords already on the plan come back under existing, and ones that could not be scheduled under skipped ' +
      'with a reason: report both.',
    body:
      'Fields: items [keyword text, or { keyword, scheduled_for?, search_volume?, difficulty?, article_type?, ' +
      'article_subtype?, quality_questions? }] and/or stored_keyword_ids [] to promote stored keywords. Items ' +
      'without scheduled_for take the next free slot. product_id is taken from the product_id argument and ' +
      'replaces the same key in the body.',
  },
  'keywords.update': {
    note: 'Only scheduled keywords without a created article can be changed.',
    body:
      `Fields (at least one): scheduled_for (${DATE_HINT} today or later, on a publish day), instructions, ` +
      `quality_questions [{ question, answer?, id? }] (replaces the list), ${ARTICLE_TYPE_FIELDS}.`,
  },
  'keywords.suggest': {
    note: 'Returns candidates only; nothing is added to the plan until keywords_add.',
    fields: {
      keyword: 'Seed keyword. Pass this or theme.',
      theme: 'Topic to explore. Pass this or keyword.',
      keywordRegion: 'Region code such as us or uk. Defaults to the product setting.',
    },
  },
  'keywords.generate': {
    note:
      'The same action as Generate Keywords in the dashboard: it writes scheduled keywords. Ask the user how many ' +
      'to generate, and check free slots with keywords_generation_status first.',
    fields: {
      count: 'How many keywords to generate.',
      source: 'competitors | audiences | both.',
      competitors: 'Competitor ids from products_competitors_list to limit the research to.',
      audiences: 'Target audience texts to limit the research to.',
    },
  },
  'keywords.bulk-process': {
    note: 'Looks up search volume and difficulty for a list of keywords. It adds nothing to the plan.',
    body:
      'Fields: keywords [] (required). Large lists are slow. product_id and keyword_region are taken from the ' +
      'arguments and replace the same keys in the body.',
    fields: { keywordRegion: 'Region code such as us or uk. Defaults to the product setting.' },
  },
  'keywords.bulk-reschedule': {
    body: 'Fields: items [{ id, scheduled_for }]. Failed items come back under skipped with a reason.',
  },
  'keywords.delete': { note: 'Deletes a scheduled keyword for good. Stored keywords cannot be deleted.' },
  'keywords.bulk-delete': {
    body: 'Fields: items [{ id, kind? (scheduled | stored) }]. Stored keywords are skipped, never deleted.',
  },
  'articles.list': {
    fields: {
      productId: 'Limit the list to one product.',
      status: 'generated | approved | published | deleted | failed.',
      sortBy: 'created_at (default) | status | title.',
      sortOrder: 'asc | desc (default).',
      createdFrom: DATE_HINT,
      createdTo: DATE_HINT,
      scheduledFrom: DATE_HINT,
      scheduledTo: DATE_HINT,
    },
  },
  'articles.get-content': {
    note: 'The body can be long. Markdown is the stored form; html is a rendering of it.',
    fields: { format: 'markdown (default) | html.' },
  },
  'articles.update': {
    note:
      'Setting status to published publishes through the product integration for real. The slug cannot be changed.',
    body:
      'Fields (at least one): title, meta_description, image_url, status (generated | approved | published), ' +
      `instructions, ${ARTICLE_TYPE_FIELDS}.`,
  },
  'articles.update-content': {
    note: 'Replaces the whole body, so read it with articles_get_content first.',
    body: 'Fields: content (markdown, required).',
  },
  'articles.replace': {
    note: 'Replaces every occurrence, case-sensitively, and saves at once unless preview_only is true.',
    body: 'Fields: find (required), replace_with (required, may be empty), preview_only (true to preview).',
  },
  'articles.bulk-replace': {
    note: 'Previews by default; show the preview to the user, then repeat with confirm true to write.',
    body:
      'Fields: product_id (required), find (required), replace_with (required), confirm (true to write), and the ' +
      'filters status, title, content. Only the 200 newest articles are scanned.',
  },
  'articles.upload-image': {
    note: 'Returns a hosted URL and alt text to place in the markdown body.',
    fields: { keyword: 'Keyword text for the image metadata when there is no article yet.' },
  },
  'articles.retry-publish': {
    note:
      'Only for a generated article with a publish error. Most integrations create a new post on every publish, so ' +
      'a repeated call can duplicate a post that did reach the site: check the site first.',
  },
  'articles.delete': { note: 'Soft delete: the article is hidden, not erased.' },
  'articles.precreate': {
    note: 'Generates the article of an eligible future scheduled keyword ahead of time. Uses a generation slot.',
  },
  'articles.generate': {
    note: 'Only for a keyword scheduled for today. Uses article quota and runs the normal create-and-publish flow.',
  },
  'improvements.settings.get': { note: 'Also shows whether the CMS can receive a push (readiness).' },
  'improvements.settings.update': {
    note:
      'Turning enabled on starts an unattended loop (weekly discovery, scheduling on publishing_days, execution ' +
      'about every 15 minutes), and auto_push publishes rewrites without review: get the user to agree first.',
    body: 'Fields (at least one): enabled, auto_push, publishing_days (at most 2 of Mon Tue Wed Thu Fri Sat Sun).',
  },
  'improvements.analyze': { note: 'Then list the results with improvements_candidates_list.' },
  'improvements.candidates.list': {
    fields: { type: 'outsider | ctr_gap | declining | content_gap | thin_content | all.' },
  },
  'improvements.candidates.edit-brief': { body: REWRITE_BRIEF_BODY },
  'improvements.candidates.schedule': { fields: { scheduledFor: ISO_HINT } },
  'improvements.tasks.reschedule': { fields: { scheduledFor: ISO_HINT } },
  'improvements.tasks.edit-brief': { note: 'Only for a task that is still scheduled.', body: REWRITE_BRIEF_BODY },
  'improvements.tasks.execute': {
    note: 'Then poll improvements_executions_get until status is completed.',
    fields: { improveImages: 'false keeps the current images. Default: images are regenerated.' },
  },
  'improvements.executions.list': {
    fields: { reviewStatus: 'awaiting_review | pushed | auto_pushed | rejected | all.' },
  },
  'improvements.executions.get': {
    note: 'Returns before and after, the changed hunks with ids, and validation issues.',
  },
  'improvements.executions.decisions': {
    note: 'Saves review decisions without publishing. Works only while review_status is awaiting_review.',
    body: `${REVIEW_BODY} Sent maps replace the saved ones.`,
  },
  'improvements.executions.push': {
    note:
      'Overwrites the article in Outrank and then publishes it to the CMS; this cannot be undone. Confirm with the ' +
      'user first. CMS_PUSH_FAILED means Outrank was updated but the CMS rejected the push.',
    body: `Omit it to accept every change. ${REVIEW_BODY}`,
  },
  'products.list': { fields: { status: 'active | disabled.' } },
  'products.get': { note: 'Returns the General settings and services [{ service, status }] of the product.' },
  'products.create': {
    note:
      'Agree the details with the user first, and quote a product slot with billing_purchase_products_quote when ' +
      'the limit is reached. Creation queues about 30 days of keywords: poll keywords_generation_status.',
    body:
      'All fields are required: name (2-50 chars), url, description (50-8000 chars), target_audiences (3-7 texts), ' +
      'language, keyword_region (for example us, uk, global-us), competitors (3-7 of { name, link }).',
  },
  'products.update': {
    note: 'General settings only. Backlink settings belong to products_backlinks_update.',
    body:
      'Fields (at least one, others are rejected): name, description, target_audiences (3-7, replaces the list), ' +
      'sitemap_url (.xml), blog_root_url, example_article_urls (max 3), auto_keyword_generation_disabled.',
  },
  'products.pause': { note: 'Affects billing-related product state: relay the returned guidance to the user.' },
  'products.resume': { note: 'Affects billing-related product state: relay the returned guidance to the user.' },
  'products.output-settings.get': {
    note: 'The Article settings. data._meta describes each field, its options and its limits: use it before writing.',
  },
  'products.output-settings.update': {
    body:
      'Fields (at least one, others are rejected): language, keyword_region, tone_and_style, image_style, ' +
      'featured_image_style, global_article_prompt, global_keyword_prompt, internal_links (0-5), brand_color ' +
      '(#RRGGBB) and the booleans auto_publish, table_of_contents, is_cta_included, is_video_included, ' +
      'mention_similar_products, is_infographics_enabled, is_first_person_enabled, are_in_article_emojis_disabled, ' +
      'use_different_featured_style. Allowed option values are in products_output_settings_get data._meta.',
  },
  'products.target-audiences.replace': {
    body: 'Fields: items (3-7 audience texts). The list replaces the current one.',
  },
  'products.competitors.replace': {
    body:
      'Fields: items (3-7 of { id?, name, link, favicon_url? }). Keep the id of a competitor to keep it; a ' +
      'competitor whose id is missing from items is deleted.',
  },
  'products.integrations.providers': { note: 'Shows which platforms support create, update, test and connect.' },
  'products.integrations.prepare': {
    note: 'WordPress plugin only: returns the token the user pastes into the plugin, plus ready create payloads.',
    fields: { provider: 'Must be wordpress-plugin.' },
    body: 'Fields: domain (defaults to the product URL).',
  },
  'products.integrations.connect': {
    note: 'Starts a browser sign-in. Give connect_url to the user, then poll products_integrations_poll.',
    fields: { provider: 'wordpress-com or notion.' },
    body: 'wordpress-com needs { name, publish_status (publish | draft) }. notion takes no body.',
  },
  'products.integrations.poll': { fields: { provider: 'wordpress-com or notion.' } },
  'products.integrations.notion.schema': { fields: { databaseId: 'Notion database id from the databases tool.' } },
  'products.integrations.webflow.sites': { body: `${WEBFLOW_TOKEN_BODY}.` },
  'products.integrations.webflow.collections': { body: `${WEBFLOW_TOKEN_BODY}, site_id (required).` },
  'products.integrations.webflow.fields': { body: `${WEBFLOW_TOKEN_BODY}, collection_id (required).` },
  'products.integrations.webflow.items': { body: `${WEBFLOW_TOKEN_BODY}, collection_id (required).` },
  'products.integrations.framer.collections': { body: `${FRAMER_BODY}.` },
  'products.integrations.framer.fields': { body: `${FRAMER_BODY}, collection_id (required).` },
  'products.integrations.validate': {
    note:
      'Tests credentials without saving them. A failed check is ok true with data.passed false. Shopify returns the ' +
      'shop name and blogs, Webflow the sites, Framer the collections.',
    fields: { provider: 'webhook, ghost, shopify, wix, framer, wordpress-plugin or webflow.' },
    body:
      'By provider: webhook { endpoint, access_token }; ghost { url, api_key }; shopify { access_token }; wix ' +
      '{ site_id, api_key }; framer { project_url, server_api_key }; wordpress-plugin { domain, api_key }; webflow ' +
      '{ api_token }.',
  },
  'products.integrations.create': {
    note:
      'A product keeps one publishing integration. Validate the credentials first. nextjs-blog returns a one-time ' +
      'secrets.api_key: show it to the user at once. Use connect for notion and wordpress-com.',
    body:
      'provider (required) plus: webhook { name, endpoint, access_token }; ghost { name, url, api_key, ' +
      'publish_status (draft | published) }; shopify { name, access_token, blog_id, author_name, publish_status ' +
      '(draft | publish) }; wix { name, site_id, api_key, publish_status (draft | publish) }; webflow { name, ' +
      'api_token, site_id, collection_id, fields }; framer { name, project_url, server_api_key }; wordpress-plugin ' +
      '{ domain, api_key }; nextjs-blog takes provider only.',
  },
  'products.integrations.update': {
    note: 'The integration decides which fields apply. framer, nextjs-blog and wordpress-com cannot be updated.',
    body:
      'Send only the fields to change, without provider. They are the create fields of that platform; notion ' +
      'takes { name, database_id, fields }.',
  },
  'products.integrations.test': { note: 'Runs a live check against the connected site.' },
  'products.integrations.delete': {
    note: 'Deleting the active integration also clears the integration fields of the product.',
  },
  'products.gsc.connect': { note: 'Give connect_url to the user, then poll products_gsc_poll.' },
  'products.gsc.accounts': { note: 'Lists the Google identities already connected to the organization.' },
  'products.gsc.properties': { fields: { email: 'A connected Google identity from products_gsc_accounts.' } },
  'products.gsc.set-property': {
    note: 'Only a verified property can be saved.',
    fields: { email: 'Required. The connected Google identity.', siteUrl: 'Required. The verified property URL.' },
  },
  'products.gsc.performance': { fields: { months: 'How many months back.' } },
  'products.gsc.search-analytics': {
    fields: {
      dimensions: 'Comma-separated: query, page, date, country, device, searchAppearance. Default: query.',
      months: 'How many months back. Use this or start_date with end_date.',
      startDate: 'YYYY-MM-DD, together with end_date.',
      endDate: 'YYYY-MM-DD, together with start_date.',
      page: 'Filter by page URL.',
      query: 'Filter by search query.',
      country: 'Filter by country code.',
      device: 'desktop | mobile | tablet.',
    },
  },
  'products.gsc.inspect-url': { fields: { url: 'Page URL to inspect.', languageCode: 'For example en-US.' } },
  'products.linking.sources.update': {
    body:
      'Fields: source_type (sitemap | root_url | integration), source_url (omit it for integration; a sitemap ' +
      'must end in .xml), additional_linking_sources (max 3 of { id, source_type, source_url, purpose (linking | ' +
      'validation_only) }; replaces the list).',
  },
  'products.linking.detect': { note: 'Runs discovery of internal link targets again.' },
  'products.linking.target-config.update': {
    note: BACKLINK_SUBSCRIPTION_NOTE,
    body: 'Fields (at least one): only_prioritized (needs 3 prioritized targets), apply_to_internal.',
  },
  'products.linking.targets.add-manual': {
    note: `${BACKLINK_SUBSCRIPTION_NOTE} An existing URL is left unchanged; use the upsert tool to change it.`,
    body: 'Fields: url (required, on the product domain), title, is_prioritized, anchor_texts (max 10).',
  },
  'products.linking.targets.upsert': {
    note: BACKLINK_SUBSCRIPTION_NOTE,
    body: 'Fields: url (required, on the product domain) and at least one of title, is_prioritized, anchor_texts.',
  },
  'products.linking.targets.clear-customizations': { note: 'Clears the custom anchor texts; the target stays.' },
  'products.backlinks.get': { note: 'Backlink exchange settings. Marketplace placements are under marketplace_*.' },
  'products.backlinks.update': {
    body: 'Fields (at least one): enabled, min_domain_rating (needs an active backlink subscription).',
  },
  'products.backlinks.earned': {
    fields: {
      status: BACKLINK_STATUS_HINT,
      sortBy: 'created_at (default) | status | credits_applied.',
      sortOrder: DESC_ONLY_HINT,
    },
  },
  'products.backlinks.unverified': {
    fields: {
      status: BACKLINK_STATUS_HINT,
      sortBy: 'created_at (default) | verification_error_reason.',
      sortOrder: DESC_ONLY_HINT,
    },
  },
  'products.backlinks.subscribe-quote': {
    note: 'Read-only quote. The user buys or changes the add-on in the dashboard.',
  },
  'marketplace.seller.status': {
    note: 'Start here for anything about selling: the guidance names the next onboarding step.',
    fields: { refreshStripe: 'true to re-read the payout account from Stripe.' },
  },
  'marketplace.seller.onboard': {
    note:
      'Makes up to four calls: reads the status, adopts a reusable CMS integration, creates the Stripe account when ' +
      'a country is given, and reads eligibility. Report the eligibility checks to the user.',
    fields: { country: COUNTRY_HINT },
  },
  'marketplace.seller.eligibility': { fields: { refresh: 'true to recompute before reading.' } },
  'marketplace.seller.settings.update': {
    body:
      'camelCase fields: isActive, approvalMode (true = approve each placement by hand), dailyArticleLimit (1-3), ' +
      'publishingDays (at least 3 weekday numbers, 0 = Sunday).',
  },
  'marketplace.seller.integrations.claim': {
    fields: { integrationType: 'Platform of the integration, for example wordpress-plugin, webflow, ghost.' },
  },
  'marketplace.seller.integrations.set-activation': {
    fields: {
      integrationType: 'Platform of the integration.',
      activationStatus: 'active | disabled.',
    },
  },
  'marketplace.seller.integrations.delete': { fields: { integrationType: 'Platform of the integration.' } },
  'marketplace.seller.stripe.onboard': {
    note: 'Returns onboardingUrl: the user finishes identity and bank details in the browser.',
    fields: { country: COUNTRY_HINT },
  },
  'marketplace.seller.stripe.manage': { note: 'Give the returned link to the user.' },
  'marketplace.seller.placements.list': {
    fields: {
      status: 'all (default) | needs_approval | planned | live | link_not_found | lost | rejected.',
      search: 'Text search.',
    },
  },
  'marketplace.seller.placements.approve': { note: 'Publishes at once when the scheduled date is due.' },
  'marketplace.seller.placements.decline': { note: `Refunds the buyer and removes the article. ${ADMIN_NOTE}` },
  'marketplace.seller.earnings': { note: 'Amounts are in cents.' },
  'marketplace.buyer.status': {
    note: 'Start here for anything about buying placements: the guidance names the next setup step.',
  },
  'marketplace.buyer.subscription': {
    note: 'Its subscription id is the confirm_subscription_id that a cancellation needs.',
  },
  'marketplace.buyer.checkout': {
    note: `Returns a Stripe Checkout link that the user completes in the browser. ${ADMIN_NOTE}`,
    fields: { tier: 'starter_1 | growth_3 | scale_8.' },
  },
  'marketplace.buyer.change-plan': {
    note:
      'cancel_scheduled and cancel_subscription take effect immediately: read the id with ' +
      'marketplace_buyer_subscription, have the user confirm the cancellation, then pass it as ' +
      `confirm_subscription_id. ${ADMIN_NOTE}`,
    fields: {
      action: 'change_tier | cancel_scheduled | cancel_subscription | restore_subscription.',
      tier: 'starter_1 | growth_3 | scale_8. Needed for change_tier.',
      confirmSubscriptionId: 'Required for the two cancel actions. Never invent it.',
    },
  },
  'marketplace.buyer.target-pages.add': {
    fields: { urls: 'Pages on the product domain (up to 50 per call).', source: 'manual (default) | discovered.' },
  },
  'marketplace.buyer.target-pages.discover': {
    fields: { source: 'sitemap (default) | root_url | integration.', sourceUrl: 'Where to look.' },
  },
  'marketplace.buyer.participation.on': { note: 'Needs the plan and at least one active target page.' },
  'marketplace.buyer.placements.list': {
    fields: { status: 'all (default) | live | in_progress | lost | rejected.', search: 'Text search.' },
  },
  'marketplace.buyer.article.edit': {
    note: 'Possible only before the article is published. Keep the placement backlink exactly as it is.',
    body: 'Fields: content (the full article markdown; only the section with the backlink may change).',
  },
  'marketplace.buyer.credits.history': { fields: { kind: 'all (default) | charge | refund.' } },
  'marketplace.notifications.list': {
    fields: { role: 'buyer | seller.', type: 'Notification type filter.', sort: 'oldest, or omit for newest first.' },
  },
  'marketplace.notifications.mark-read': {
    fields: { role: 'buyer | seller.', ids: 'Notification ids. Omit to mark every unread one as read.' },
  },
});
