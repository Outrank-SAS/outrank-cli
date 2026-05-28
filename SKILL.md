---
name: outrank
description: Drive the Outrank agent API from the terminal via outrank-cli. Use when the user asks to list/create/update Outrank products, inspect or manage publishing integrations, inspect or manage keyword plans, inspect or edit articles, discover/schedule/run/review/publish article improvements for existing posts, manage article settings, target audiences, competitors, Google Search Console connections, internal linking configuration, or quote/buy product slots. Requires outrank-cli on PATH and an Outrank API key (env OUTRANK_API_KEY or stored via auth login).
---

# Outrank Skill

Use `outrank-cli` to drive Outrank from the terminal. The CLI is JSON-first and every command returns `agent_guidance`, so read that field after each step and let it steer the next call.

In human-facing responses, call `products get` / `products update` the product's General settings. These cover the non-editorial product basics such as name, URL, description, sitemap URL, blog root URL, publishing cadence, and similar core product fields.

In human-facing responses, call product `output-settings` article settings or article preferences. Use `output-settings` only when you are quoting the literal CLI command or API path.
Use `products backlinks ...` for backlink exchange settings, credits, review queues, and reverification actions.

Use `improvements ...` for article improvements: discovering, briefing, scheduling, running, reviewing, and publishing AI rewrites of **existing published articles** based on Search Console performance. This is a distinct area from article generation (`articles generate`/`precreate`) — offer it whenever the human wants to refresh, update, optimize, or improve existing/older posts, or act on GSC opportunities. It needs the All-in-One plan.

## Setup

1. If `OUTRANK_API_KEY` is not set, ask the human for an Outrank API key from `https://outrank.so/dashboard/settings/api-keys`.
2. Store it with `outrank-cli auth login <api-key>`.
3. Verify access with `outrank-cli auth whoami`.
4. If a command fails with auth errors, tell the human exactly how to refresh the key, then retry.
5. If the environment blocks writes to the default home directory, set `OUTRANK_CONFIG_DIR` to a writable folder before using `auth login`.
6. If the API is hosted on a non-default Outrank deployment, set `OUTRANK_BASE_URL=<deployment-url>`. Use `--base-url <deployment-url>` only as a per-command override when needed.

## Discovery

Run `outrank-cli --help` first if you need the command tree.

Run group help when needed:

- `outrank-cli auth --help`
- `outrank-cli products --help`
- `outrank-cli keywords --help`
- `outrank-cli articles --help`
- `outrank-cli improvements --help`
- `outrank-cli subscription --help`
- `outrank-cli usage --help`
- `outrank-cli billing --help`
- `outrank-cli auth status`

Prefer inspecting before mutating:

- `outrank-cli products list --limit 20`
- `outrank-cli products get <productId>` for General settings
- `outrank-cli products output-settings get <productId>`
- `outrank-cli keywords list --product <productId> --scope all`
- `outrank-cli articles list --product <productId>`
- `outrank-cli articles get <articleId>`
- `outrank-cli articles get-content <articleId>`
- `outrank-cli articles upload-image --file <path> --article <articleId>`
- `outrank-cli articles upload-featured-image <articleId> --file <path>`
- `outrank-cli improvements settings get <productId>`
- `outrank-cli improvements candidates list <productId>`
- `outrank-cli improvements tasks list <productId>`
- `outrank-cli improvements executions list <productId>`
- `outrank-cli keywords export --product <productId>`
- `outrank-cli products target-audiences list <productId>`
- `outrank-cli products competitors list <productId>`
- `outrank-cli products integrations providers`
- `outrank-cli products integrations list <productId>`
- `outrank-cli products integrations get <productId> <integrationId>`
- `outrank-cli products integrations prepare wordpress-plugin <productId>`
- `outrank-cli products integrations connect wordpress-com <productId> --json-file wordpress-com-connect.json`
- `outrank-cli products integrations connect notion <productId>`
- `outrank-cli products integrations poll wordpress-com <productId> --attempt-id <attempt-id>`
- `outrank-cli products integrations poll notion <productId> --attempt-id <attempt-id>`
- `outrank-cli products integrations notion databases <productId> <integrationId>`
- `outrank-cli products integrations notion schema <productId> <integrationId> <databaseId>`
- `outrank-cli products integrations webflow sites --json-file webflow-sites.json`
- `outrank-cli products integrations webflow collections --json-file webflow-collections.json`
- `outrank-cli products integrations webflow fields --json-file webflow-fields.json`
- `outrank-cli products integrations webflow items --json-file webflow-items.json`
- `outrank-cli products integrations framer collections --json-file framer-collections.json`
- `outrank-cli products integrations framer fields --json-file framer-fields.json`
- `outrank-cli products gsc status <productId>`
- `outrank-cli products gsc accounts <productId>`
- `outrank-cli products gsc performance <productId>`
- `outrank-cli products linking sources get <productId>`
- `outrank-cli products linking targets list <productId>`
- `outrank-cli products linking target-config get <productId>`
- `outrank-cli products backlinks get <productId>`
- `outrank-cli products backlinks credits <productId>`
- `outrank-cli products backlinks earned <productId>`
- `outrank-cli products backlinks unverified <productId>`
- `outrank-cli products backlinks subscription <productId>`
- `outrank-cli subscription status`
- `outrank-cli usage stats`

Interpret `auth whoami` carefully:

- `organization.product_count` may represent purchased product slots, not the literal number of rows returned by `products list`.

## Write pattern

For complex writes, prefer JSON via file or stdin over long shell escaping.

Accepted input forms:

- `--json '{...}'`
- `--json-file payload.json`
- `--json-stdin`

Write commands currently supported:

- `outrank-cli products create --json-file product.json`
  After create, the initial ~30-day keyword plan is queued automatically. Poll with `outrank-cli keywords generation-status --product <productId>` and then inspect `outrank-cli keywords list --product <productId>`. 
- `outrank-cli products update <productId> --json-file patch.json` for General settings
- `outrank-cli products output-settings update <productId> --json-file output-settings.json`
- `outrank-cli products target-audiences replace <productId> --json-file target-audiences.json`
- `outrank-cli products competitors replace <productId> --json-file competitors.json`
- `outrank-cli products integrations validate <provider> --json-file integration.json`
- `outrank-cli products integrations create <productId> --json-file integration-create.json`
- `outrank-cli products integrations update <productId> <integrationId> --json-file integration-update.json`
- `outrank-cli products integrations test <productId> <integrationId>`
- `outrank-cli products integrations delete <productId> <integrationId>`
- `outrank-cli products integrations connect wordpress-com <productId> --json-file wordpress-com-connect.json`
- `outrank-cli products integrations poll wordpress-com <productId> --attempt-id <attempt-id>`
- `outrank-cli products integrations connect notion <productId>`
- `outrank-cli products integrations poll notion <productId> --attempt-id <attempt-id>`
- `outrank-cli products integrations notion databases <productId> <integrationId>`
- `outrank-cli products integrations notion schema <productId> <integrationId> <databaseId>`
- `outrank-cli products integrations webflow sites --json-file webflow-sites.json`
- `outrank-cli products integrations webflow collections --json-file webflow-collections.json`
- `outrank-cli products integrations webflow fields --json-file webflow-fields.json`
- `outrank-cli products integrations webflow items --json-file webflow-items.json`
- `outrank-cli products integrations framer collections --json-file framer-collections.json`
- `outrank-cli products integrations framer fields --json-file framer-fields.json`
- `outrank-cli products gsc connect <productId>`
- `outrank-cli products gsc reconnect <productId>`
- `outrank-cli products gsc disconnect <productId>`
- `outrank-cli products gsc set-property <productId> --email owner@example.com --site-url <verified-site-url>`
- `outrank-cli products gsc search-analytics <productId> --dimensions query,page --limit 50`
- `outrank-cli products gsc inspect-url <productId> --url https://example.com/blog/post`
- `outrank-cli products gsc cannibalization <productId>`
- `outrank-cli products linking sources update <productId> --json-file linking-sources.json`
- `outrank-cli products linking detect <productId>`
- `outrank-cli products linking target-config update <productId> --json-file target-config.json`
- `outrank-cli products linking targets add-manual <productId> --json-file manual-target.json`
- `outrank-cli products linking targets upsert <productId> --json-file target-upsert.json`
- `outrank-cli products linking targets clear-customizations <productId> <targetId>`
- `outrank-cli products linking targets delete <productId> <targetId>`
- `outrank-cli products backlinks update <productId> --json-file backlinks.json`
- `outrank-cli products backlinks check-removal <productId> <backlinkId>`
- `outrank-cli products backlinks reverify <productId> <backlinkId>`
- `outrank-cli products backlinks subscribe-quote <productId> --plan premium|enterprise`
- `outrank-cli keywords add --product <productId> --json-file keywords.json`
- `outrank-cli keywords update <keywordId> --json-file keyword-update.json`
- `outrank-cli keywords bulk-reschedule --json-file keyword-reschedule.json`
- `outrank-cli keywords bulk-delete --json-file keyword-delete.json`
- `outrank-cli articles update <articleId> --json-file article-patch.json`
- `outrank-cli articles update-content <articleId> --json-file article-content.json`
- `outrank-cli articles replace <articleId> --json-file replace.json`
- `outrank-cli articles bulk-replace --json-file bulk-replace.json`
- `outrank-cli articles upload-image --file local-image.png --article <articleId>`
- `outrank-cli articles upload-featured-image <articleId> --file hero.jpg`

Billing-management helper:

- `outrank-cli billing portal-url`

## New-product preflight

When the human asks to create or add a new product, do not jump straight to `products create` or a billing purchase.

Treat product creation as blocked until you have either:

1. Collected the key product and article-settings inputs, or
2. Explicit human approval to keep the current defaults for anything they did not specify.

Ask for missing information explicitly. Do not silently rely on defaults for editorial behavior.
When the account already has products, inspect at least one existing product's article settings first so you can see the current backend's actual setting keys before you ask the human to configure a new one.

Use this inspection pattern before asking article-setting questions:

- `outrank-cli products list --limit 20`
- `outrank-cli products output-settings get <existingProductId>`

Use the returned `output-settings` object as the authoritative checklist of fields currently visible through the live API for that account. Do not rely on a hardcoded short list if the live object contains more agent-visible settings. Do not infer dashboard-only or internal generation fields that are intentionally hidden from the agent API, including `outline`, `outrank_prompt`, and `not_included_words`.

When the response includes `data._meta`:

- if `data._human` is present, use that as the default source for any human-facing summary
- use `data._meta.sections` to decide which settings to show humans and how to group them
- use `data._meta.fields.<field>.label` and `.description` instead of inventing meanings from snake_case names
- use `data._meta.fields.<field>.options` for enum choices and `constraints` for numeric/color limits before proposing or writing a new value
- treat `data._meta.hidden_from_human_summary_fields` as bookkeeping fields that usually should not be surfaced in prose
- if a field is missing from `data._meta.fields`, do not guess what it means; say the live API did not define that field's semantics clearly
- never mention database table names, raw API field names, raw enum keys, or internal ids in normal human-facing explanations unless the user explicitly asks for implementation details

Minimum product brief to collect before creation:

- product name
- canonical website URL
- product description
- target audiences
- competitor set
- language
- keyword region

Article settings to confirm before creation or immediately before the first write:

- tone and style
- whether to auto-publish
- whether to include a table of contents
- whether to mention similar products
- whether to include CTAs
- whether to include YouTube videos, if that field exists in the inspected article settings
- featured-image style, article-image style, or similar image fields, if those fields exist in the inspected article settings

The list above is a minimum reminder, not the full agent-visible schema. If the inspected live output-settings object includes additional visible fields, ask about those too. Do not ask the human to configure hidden internal fields that are absent from the live object.

For preset-backed fields, do not ask for free-form prose unless the backend clearly accepts arbitrary text. Many settings are select-style options. Examples may include tone, image style, or featured-image style.

If the live API or current repo context does not expose the full allowed option list for a preset-backed field:

- do not pretend the value is free-form
- ask the human for the exact option label they want as it appears in Outrank
- if helpful, show the current value from an existing product as a reference point
- say clearly when the CLI exposes the field's current value but not the full enum catalog

Business-critical settings that may matter before article generation:

- blog URL or publishing destination
- internal linking preferences
- image style or image-generation preferences
- article examples or brand-writing examples
- publishing workflow preferences such as draft-first vs direct publish

If the human has not provided those business-critical settings yet, say so clearly. Explain which of them are currently exposed by `outrank-cli` and which are not. Internal linking is exposed through the `products linking ...` subtree. For settings that are not yet supported by the current CLI surface, do not invent commands. Instead, ask the human whether to:

- proceed with existing/default Outrank settings for now, or
- stop product creation until those settings are provided and/or configured elsewhere

Before any billing or create step, present a short confirmation summary that includes:

- what will be created
- what competitors and audiences will be set
- which article settings will be written
- which fields were confirmed from the live output-settings schema versus inferred from docs/examples
- which important settings are still defaulting because they were not provided or are not yet exposed in the CLI
- whether a real billing charge approval is still required

## Product workflow

For a new product:

1. Gather the new-product preflight inputs above. If anything important is missing, ask the human before continuing.
2. If another paid product slot is needed, quote the billing change before creating anything.
3. After the human approves the plan, create it with `products create`.
4. Read the returned `agent_guidance`.
5. Tune article behavior with `products output-settings update`.
6. Replace the target-audience set with `products target-audiences replace`.
7. Replace the competitor set with `products competitors replace`.
8. Re-read the product, article settings, target audiences, and competitors to confirm the final state.

When you only need a small change, use `products update` rather than recreating the product.

## Google Search Console workflow

Use the product-scoped Google Search Console commands when the human needs to connect, inspect, select, reconnect, or remove a Search Console property.

Recommended flow:

1. Inspect current status with `outrank-cli products gsc status <productId>`.
2. Start OAuth with `outrank-cli products gsc connect <productId>`.
3. Tell the human to open the returned `connect_url` and finish the Google flow in a browser.
4. Poll with `outrank-cli products gsc poll <productId> --attempt-id <attempt-id>` until the response reports completion.
5. Inspect available connected Google identities with `outrank-cli products gsc accounts <productId>`.
6. List properties for one identity with `outrank-cli products gsc properties <productId> --email owner@example.com`.
7. Save the verified property with `outrank-cli products gsc set-property <productId> --email owner@example.com --site-url <verified-site-url>`.
8. Read live/cached search performance with `outrank-cli products gsc performance <productId>` or run custom reports with `outrank-cli products gsc search-analytics <productId>`.
9. Inspect one page's indexing details with `outrank-cli products gsc inspect-url <productId> --url <url>`.
10. Inspect overlapping-query issues with `outrank-cli products gsc cannibalization <productId>`.

Important behavior:

- `accounts` returns stored connected Google identities already known to Outrank for the organization. It does not query the browser or operating system for every Google account.
- `properties` requires an `--email` that matches one of those connected identities.
- `set-property` only succeeds for verified properties. If the property is unverified, keep the current selection unchanged and ask the human to verify access in Google Search Console first.
- `performance` is the fastest high-level read for clicks, impressions, CTR, position, trend lines, top pages, and top queries.
- `search-analytics` is the flexible raw report endpoint for keyword/page/country/device exploration.
- `inspect-url` is the indexing/debug endpoint for canonical, crawl, AMP, mobile, rich-result, sitemap, and referring-URL details on one page.
- `cannibalization` highlights queries where multiple pages from the same site compete against each other.
- Use `reconnect` when the status shows an expired token or refresh failure.
- Use `disconnect` to remove the product's Search Console connection.

## Linking workflow

Use the product-scoped linking commands when the human needs to define where Outrank should discover internal-link candidates, inspect detected URLs, save a priority list, or constrain linking behavior.

Recommended flow:

1. Inspect current source settings with `outrank-cli products linking sources get <productId>`.
2. Save or change the primary source with `outrank-cli products linking sources update <productId> --json-file linking-sources.json`.
3. Re-run discovery with `outrank-cli products linking detect <productId>`.
4. Review saved targets with `outrank-cli products linking targets list <productId>`.
5. Add missing on-domain URLs with `outrank-cli products linking targets add-manual <productId> --json-file manual-target.json`.
6. Prioritize or add anchor text with `outrank-cli products linking targets upsert <productId> --json-file target-upsert.json`.
7. Inspect product-wide behavior with `outrank-cli products linking target-config get <productId>`.
8. Enable or relax priority-only behavior with `outrank-cli products linking target-config update <productId> --json-file target-config.json`.
9. Clear stale anchor-text overrides with `outrank-cli products linking targets clear-customizations <productId> <targetId>`.
10. Delete stale targets with `outrank-cli products linking targets delete <productId> <targetId>`.

Important behavior:

- Linking writes are gated by the product's backlink subscription. If the API returns `subscription_management_url`, stop retrying and ask the human to manage that billing change in the dashboard.
- `source_type` is not free-form. Use the exact backend values: `sitemap`, `root_url`, or `integration`.
- `additional_linking_sources` is a replacement list, not a patch. Keep existing items you still want.
- Manual and upserted target URLs must stay on the product's own domain.
- `only_prioritized` may fail until enough prioritized targets exist. If the API returns a conflict, add or prioritize more URLs first.
- `clear-customizations` only clears custom anchor text. It does not delete the target.

## Backlinks workflow

Use the product-scoped backlink commands when the human needs to inspect or change backlink exchange participation, review earned placements, work through unverified items, or inspect subscription state.

Recommended flow:

1. Inspect current settings with `outrank-cli products backlinks get <productId>`.
2. Inspect credits with `outrank-cli products backlinks credits <productId>`.
3. Review earned backlinks with `outrank-cli products backlinks earned <productId> --limit 20`.
4. Add `--include-article` or `--include-summary` on the earned list when the human needs more article context.
5. Review the unverified queue with `outrank-cli products backlinks unverified <productId> --limit 20`.
6. Update settings with `outrank-cli products backlinks update <productId> --json-file backlinks.json`.
7. Trigger a removal check with `outrank-cli products backlinks check-removal <productId> <backlinkId>`.
8. Trigger a reverification with `outrank-cli products backlinks reverify <productId> <backlinkId>`.
9. Inspect the current backlink subscription with `outrank-cli products backlinks subscription <productId>`.
10. Quote a plan with `outrank-cli products backlinks subscribe-quote <productId> --plan premium|enterprise`.

Important behavior:

- Do not use `products update` for `backlinks_enabled` or `min_backlink_domain_rating`.
- Backlink writes are blocked when the product is hidden for inappropriate content, but reads still work.
- Setting `min_domain_rating` requires an active backlink subscription.
- `subscribe-quote` is read-only. Purchasing or changing the add-on still requires dashboard checkout.
- `earned` uses cursor pagination through `data.next_cursor`.
- `unverified` is the deduped article-level manual-review stream.

## Integrations workflow

Use the current integrations commands when the human needs to inspect connected publishing integrations, validate direct credentials, run the WordPress.com or Notion OAuth handoff, inspect discovery data for Notion, Webflow, or Framer, test a saved integration row, or remove a stale one.

Recommended flow:

1. Inspect connected integrations with `outrank-cli products integrations list <productId>`.
2. Inspect provider availability with `outrank-cli products integrations providers`.
3. For webhook, ask only for `endpoint` and `access_token`. Outrank sends `Authorization: Bearer <access_token>` on each request. Do not ask for an HMAC secret because the current webhook integration does not implement HMAC signing.
4. For WordPress Plugin, do not ask the human to invent or provide an `api_key`. Start with `outrank-cli products integrations prepare wordpress-plugin <productId>` to generate the integration token, then tell the human to paste that token into the installed plugin and save it in WordPress.
5. For WordPress.com, start with `outrank-cli products integrations connect wordpress-com <productId> --json-file wordpress-com-connect.json`, tell the human to open the returned `connect_url`, then poll with `outrank-cli products integrations poll wordpress-com <productId> --attempt-id <attempt-id>` until the handoff completes.
6. For Notion, start with `outrank-cli products integrations connect notion <productId>`, tell the human to open the returned `connect_url`, then poll with `outrank-cli products integrations poll notion <productId> --attempt-id <attempt-id>` until the handoff completes.
7. After Notion OAuth completes, list databases with `outrank-cli products integrations notion databases <productId> <integrationId>`, inspect one schema with `... notion schema <productId> <integrationId> <databaseId>`, then update the saved integration row with `name`, `database_id`, and `fields`.
8. For Shopify, start with `outrank-cli products integrations validate shopify --json '{"access_token":"shpat_xxx"}'`. The response returns `shop_name` and the available blogs, which the agent should use to build the create payload instead of guessing them or asking the human for the store name first.
9. For Webflow, start with `outrank-cli products integrations validate webflow --json-file webflow-sites.json`, then use `webflow sites`, `webflow collections`, `webflow fields`, and `webflow items` to build the exact create or update payload for the chosen CMS collection.
10. For Framer, use only the newer Server API flow. Start with `outrank-cli products integrations validate framer --json-file framer-validate.json`, then use `framer collections` and `framer fields` when the human wants to publish into an existing editable collection. Do not use or mention the older plugin-based setup.
11. For Next.js Blog, do not ask the human for credentials first. Run `outrank-cli products integrations create <productId> --json '{"provider":"nextjs-blog"}'` and treat the returned `data.secrets.api_key` as a one-time secret that must be saved immediately.
12. For Wix, use a direct credential flow with `site_id`, `api_key`, and `publish_status`. Validate first, then create or update directly; there is no OAuth or prepare step.
13. Validate webhook, Ghost, Shopify, Webflow, Wix, Framer, or WordPress Plugin credentials before saving with `outrank-cli products integrations validate <provider> --json-file integration.json`.
14. Create a webhook, Ghost, Shopify, Webflow, Wix, Framer, WordPress Plugin, or Next.js Blog integration with `outrank-cli products integrations create <productId> --json-file integration-create.json`.
14. Inspect one row with `outrank-cli products integrations get <productId> <integrationId>`.
15. Update a saved webhook, Ghost, Shopify, Webflow, Wix, WordPress Plugin, or Notion integration with `outrank-cli products integrations update <productId> <integrationId> --json-file integration-update.json`.
16. Test a saved webhook, Ghost, Shopify, Webflow, Wix, Framer, WordPress Plugin, or Notion integration with `outrank-cli products integrations test <productId> <integrationId>`.
17. If the integration is stale or wrong, remove it with `outrank-cli products integrations delete <productId> <integrationId>`.

Important behavior:

- V2 products are intended to keep exactly one publishing integration. If `list` returns multiple rows, treat the extras as likely legacy V1 leftovers and inspect before deleting.
- `create` currently supports `webhook`, `ghost`, `shopify`, `webflow`, `wix`, `wordpress-plugin`, and `nextjs-blog` first. Other providers may appear in `providers`, but if their create/update/test capabilities are absent there, do not invent those writes.
- `wordpress-plugin` should usually start with `prepare`, not with a question asking the human for an integration token. The prepare response includes the generated token plus suggested validate/create payloads.
- `wordpress-com` should use `connect` plus `poll`, not `create`. The connect payload mirrors the dashboard flow with `name` and `publish_status`, then the human completes browser OAuth.
- `notion` should use `connect` plus `poll`, not `create`. OAuth only stores the access token row. The agent still needs to list databases, inspect schema, and PATCH the saved row with `name`, `database_id`, and `fields` before the integration is publish-ready.
- `shopify` should start with validation. The agent should not ask the human to guess `shop_name` or `blog_id` before `validate` returns them.
- `webflow` should use validation plus discovery before create. The agent should not guess `site_id`, `collection_id`, or Webflow field mappings.
- `framer` should use the newer Server API flow only. The agent should not mention the older Framer plugin flow. Validate the project URL and Server API key first, then use `framer collections` and `framer fields` only when the human chooses an existing editable collection. There is no separate plugin-config step in the agent surface.
- `wix` uses direct validate/create/update/test with a site UUID plus API key. The agent should validate `site_id` and `api_key` before create or after credentials change.
- `nextjs-blog` create returns a one-time API key. The agent must surface and preserve it immediately because later reads only show that a hash exists, not the plain secret.
- deleting the current active integration clears the product integration fields automatically
- `validate` tests unsaved credentials without persisting a row, while `test` re-checks a saved integration row
- the current CLI surface still does not expose create, update, or test for some providers, and only WordPress.com and Notion currently expose an OAuth connect flow; if the human asks for unsupported operations, say they are not shipped in this CLI yet instead of inventing commands

## Keyword workflow

Keyword plans have two buckets:

- scheduled keywords: already on the content calendar
- stored keywords: unscheduled inventory waiting to be promoted into the plan

Inspect before mutating:

- `outrank-cli keywords list --product <productId> --scope scheduled`
- `outrank-cli keywords list --product <productId> --scope stored`
- `outrank-cli keywords list --product <productId> --scope all`
- `outrank-cli keywords export --product <productId>`
- `outrank-cli keywords generation-status --product <productId>`

Use the returned `data.scope`, `data.scheduled`, and `data.stored` structure literally. Do not invent a different keyword model.

When the user asks for keyword ideas:

- use `outrank-cli keywords suggest --product <productId> --theme "<theme>"` for related-keyword exploration around a theme or seed term
- use `outrank-cli keywords generate --product <productId> --count <n> --source competitors|audiences|both` for the dashboard-equivalent Generate Keywords flow

Treat `keywords suggest` as candidate-generation only. It does not change the content plan until you add keywords.
Treat `keywords generate` as the dashboard Generate Keywords action. It creates scheduled keywords through the same backend pipeline.

Before `keywords generate`:

- if the human did not specify how many keywords to generate, ask them
- the allowed range is 5-30, but the real maximum depends on free scheduler slots
- check `outrank-cli keywords generation-status --product <productId>` when you need the current slot capacity

To add keywords:

- for direct adds, use `outrank-cli keywords add --product <productId> --json-file keywords.json`
- for promoting existing stored keywords, include `stored_keyword_ids` in that JSON payload

Important behavior to remember:

- add is idempotent where possible; existing scheduled keywords come back as existing rather than being duplicated
- stored keywords are unscheduled inventory, not disabled scheduled keywords
- stored keywords are read-only inventory; they can be promoted into the plan but not deleted directly
- auto-scheduling respects the backend's real planner logic, including publish days and pending downgrade limits
- if keyword generation status says writes are blocked, treat both scheduled and stored keywords as read-only until the blocker clears
- if the main subscription is `past_due`, keyword mutations are blocked and only reads are allowed
- scheduled keywords with created or pre-created articles are read-only
- keywords in `generating_article` are read-only until generation finishes
- past keywords are read-only except past `scheduled` or `disabled` keywords without an article, which may still be rescheduled
- if the response reports skipped keywords, explain the actual skip reason to the human instead of pretending the add fully succeeded

For schedule changes:

- check writability first when there is any doubt: `outrank-cli keywords generation-status --product <productId>`
- `keywords list` uses planner-first ordering for scheduled results, so page 1 prioritizes upcoming scheduled items before past ones
- confirm keyword presence with `outrank-cli keywords list --product <productId> --scope scheduled --q "<keyword>"`; if `next_offset` is not `null`, keep paging before claiming it is missing
- keyword records return top-level `article_type`, `article_subtype`, `expected_length`, and label fields; use those directly for article-type or expected-length questions instead of checking product output-settings
- update one keyword's mutable fields: `outrank-cli keywords update <keywordId> --json '{"instructions":"..."}'`
- answer or replace the keyword's quality questions with `outrank-cli keywords update <keywordId> --json '{"quality_questions":[{"id":"...","question":"...","answer":"..."}]}'`
- `outrank-cli keywords get <keywordId>` returns `article_type_options`; use those values when patching `article_type`, `article_subtype`, or `expected_length`
- `outrank-cli keywords update <keywordId> --json '{"article_type":"guide","article_subtype":"explainer","expected_length":"long"}'` mirrors the scheduler card Article Type Settings modal and rejects values outside the allowed option lists
- reschedule one: `outrank-cli keywords update <keywordId> --json '{"scheduled_for":"YYYY-MM-DD"}'`
- reschedule many: `outrank-cli keywords bulk-reschedule --json-file keyword-reschedule.json`

For article actions:

- `outrank-cli articles generate <keywordId>` is only for keywords scheduled for today
- `outrank-cli articles precreate <keywordId>` is only for eligible future scheduled keywords
- article records with a linked scheduled keyword also return top-level `article_type`, `article_subtype`, `expected_length`, and label fields
- trial users cannot pre-create articles
- past-due subscriptions block article actions
- future scheduled articles cannot be manually published early through `articles update`

For deletion:

- delete one: `outrank-cli keywords delete <keywordId>`
- delete many: `outrank-cli keywords bulk-delete --json-file keyword-delete.json`

When answering humans, call the scheduled set the content plan or keyword plan. Call stored keywords unscheduled inventory or stored keywords. Do not talk about internal table names.

## Pause and resume

Use:

- `outrank-cli products pause <productId>`
- `outrank-cli products resume <productId>`

These affect billing-adjacent product state. Read the returned guidance carefully and relay any human-only step.

## Article workflow

Inspect before mutating:

- `outrank-cli articles list --product <productId>`
- `outrank-cli articles get <articleId>`
- `outrank-cli articles get-content <articleId>`

Important behavior to remember:

- article metadata and history mirror the current app behavior, including soft-delete instead of hard-delete
- article bodies are markdown in the backend; `--format html` is rendered output, not the source of truth
- featured image is separate from the markdown body and can be updated either through the normal article update payload via `image_url` or by local-file upload with `articles upload-featured-image`
- in-content images can be uploaded from local files with `articles upload-image`; the command returns a hosted URL and alt text for markdown insertion or replacement
- per-article instructions live on the linked scheduled keyword, so they are only editable while that planner relationship still exists and is writable
- `articles get <articleId>` returns `article_type_options`; use those values when patching `article_type`, `article_subtype`, or `expected_length`
- `articles update --json '{"article_type":"guide","article_subtype":"howTo","expected_length":"medium"}'` mirrors the dashboard Article Type Settings modal and rejects values outside the allowed option lists
- `articles update --json '{"status":"published"}'` attempts a real publish through the product's active integration for eligible attached articles; if the remote publish fails, inspect the returned error and the article's `publish_error`
- slug is readable for reference but read-only in the agent API
- `articles generate <keywordId>` mirrors the current create-and-publish flow for a scheduled keyword
- `articles precreate <keywordId>` mirrors the current pre-generation flow; after calling it, inspect the keyword state until it moves from `generating_article` to `pregenerated` or back to `scheduled`
- `articles retry-publish <articleId>` only works for generated articles with a publish error
- `articles bulk-replace` is preview-first; review the returned excerpts, then rerun with `"confirm": true` in the JSON payload to write changes

## Article improvements workflow

Article improvements take an already-published post, analyze its Search Console performance, draft a rewrite brief, run a multi-step rewrite, and push the improved version back to the CMS. This is a separate surface from article generation. It requires the All-in-One plan; on Basic plan candidate lists come back empty and write actions return `PLAN_UPGRADE_REQUIRED`.

Inspect before mutating:

- `outrank-cli improvements settings get <productId>` — shows `enabled`, `auto_push`, `publishing_days`, the CMS `readiness` (whether a push can actually land), and `activity` counts
- `outrank-cli improvements candidates list <productId> [--type <opportunity_type>]` — opportunities available to schedule
- `outrank-cli improvements tasks list <productId>` — scheduled tasks, each with its `latest_execution` for progress polling
- `outrank-cli improvements executions list <productId> --review-status awaiting_review` — the review inbox

Typical manual flow:

1. `outrank-cli improvements analyze <productId>` — discover/refresh opportunities (heavy, multi-minute; re-list candidates after)
2. `outrank-cli improvements candidates brief <candidateId>` — generate the rewrite brief (heavy; poll the candidate until `brief_status` is `ready`)
3. optionally `outrank-cli improvements candidates edit-brief <candidateId> --json-file brief.json` to refine it
4. `outrank-cli improvements candidates schedule <candidateId> --scheduled-for <iso-date>` — create the task
5. `outrank-cli improvements tasks execute <taskId>` — run the rewrite now (heavy; poll `improvements executions get <executionId>` until `status` is `completed`)
6. review and publish: `outrank-cli improvements executions get <executionId>`, then `outrank-cli improvements executions push <executionId>`

Important behavior to remember:

- turning settings `enabled` on starts an unattended loop — weekly opportunity discovery, daily auto-scheduling on `publishing_days` (max 2 weekdays), and execution every ~15 minutes. Always tell the human this before enabling.
- with `auto_push` on, each successful rewrite is published to the CMS with no human review (still skipped automatically on a hard validation failure or an unverified backlink). Only enable it via `settings update` after the human confirms.
- analyze, candidates brief, and tasks execute run in Firebase and can take minutes; if a call times out at the edge the work continues server-side, so re-list or poll the execution instead of retrying
- `executions get` returns `before`/`after`, paragraph-level `hunks` (each with an id), and `validation_issues`; to accept everything, `executions push` with no JSON; to reject or edit specific hunks, send `{"decisions":{"<hunkId>":"rejected"},"edited_hunks":{"<hunkId>":"..."}}` to `executions decisions` or directly in the push body
- decisions and push only work while `review_status` is `awaiting_review`
- a push always updates the article inside Outrank first; if `cms_response.status` is `skipped` the CMS is not connected/supported for auto-push (publish manually); a `CMS_PUSH_FAILED` error means the CMS rejected it — inspect `error.details.cms_response` and retry
- `tasks execute --improve-images false` skips image regeneration (default regenerates images)

## Buying more product slots

Always do this in two steps:

1. Quote the change: `outrank-cli billing purchase-products quote --additional-products <n>`
2. If the human approves, submit the purchase with the exact quoted recurring total:
   `outrank-cli billing purchase-products buy --additional-products <n> --confirm-charge-cents <quoted> --idempotency-key <stable-random-key>`

Never guess `confirm-charge-cents`. Use the server-quoted number.
Do not ask for billing approval until you have already clarified the intended product configuration and any defaulted article/publishing settings.

## Error handling

- If `ok` is `false`, read both `error.message` and `agent_guidance`.
- For `401`, help the human refresh `OUTRANK_API_KEY`.
- For `403` or `409`, the guidance usually tells you whether to inspect state, pause another product, or ask the human to approve a billing step.
- For `402`, stop retrying and ask the human to fix billing.

## Current limitation

The implementation plan is broader than the current live API. Keywords, core article flows, article improvements, linking, backlink exchange management, and the current integration-management flows are exposed in `outrank-cli`, including direct setup for webhook, Ghost, Shopify, Webflow, Wix, Framer, WordPress Plugin, and Next.js Blog, plus OAuth flows for WordPress.com and Notion. Purchasing or changing backlink add-ons and some onboarding flows still require the dashboard. If the user asks for something not present in `outrank-cli --help`, say that exact command surface is not shipped yet and do not invent unsupported commands.
