---
name: outrank
description: Drive the Outrank agent API from the terminal via outrank-cli. Use when the user asks to list/create/update Outrank products, inspect or manage keyword plans, inspect or edit articles, manage article settings, target audiences, competitors, or quote/buy product slots. Requires outrank-cli on PATH and an Outrank API key (env OUTRANK_API_KEY or stored via auth login).
---

# Outrank Skill

Use `outrank-cli` to drive Outrank from the terminal. The CLI is JSON-first and every command returns `agent_guidance`, so read that field after each step and let it steer the next call.

In human-facing responses, call `products get` / `products update` the product's General settings. These cover the non-editorial product basics such as name, URL, description, sitemap URL, blog root URL, publishing cadence, backlink toggles, and similar core product fields.

In human-facing responses, call product `output-settings` article settings or article preferences. Use `output-settings` only when you are quoting the literal CLI command or API path.

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
- `outrank-cli keywords export --product <productId>`
- `outrank-cli products target-audiences list <productId>`
- `outrank-cli products competitors list <productId>`
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
- `outrank-cli keywords add --product <productId> --json-file keywords.json`
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

Business-critical settings that may matter even if the current CLI surface cannot set them yet:

- blog URL or publishing destination
- internal linking preferences
- image style or image-generation preferences
- article examples or brand-writing examples
- publishing workflow preferences such as draft-first vs direct publish

If the human has not provided those business-critical settings yet, say so clearly. Explain which of them are currently exposed by `outrank-cli` and which are not. For settings that are not yet supported by the current CLI surface, do not invent commands. Instead, ask the human whether to:

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

## Keyword workflow

Keyword plans now have two buckets:

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
- reschedule one: `outrank-cli keywords reschedule <keywordId> --scheduled-for YYYY-MM-DD`
- reschedule many: `outrank-cli keywords bulk-reschedule --json-file keyword-reschedule.json`

For article actions:

- `outrank-cli articles generate <keywordId>` is only for keywords scheduled for today
- `outrank-cli articles precreate <keywordId>` is only for eligible future scheduled keywords
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
- slug is readable for reference but read-only in the agent API
- `articles generate <keywordId>` mirrors the current create-and-publish flow for a scheduled keyword
- `articles precreate <keywordId>` mirrors the current pre-generation flow; after calling it, inspect the keyword state until it moves from `generating_article` to `pregenerated` or back to `scheduled`
- `articles retry-publish <articleId>` only works for generated articles with a publish error
- `articles bulk-replace` is preview-first; review the returned excerpts, then rerun with `"confirm": true` in the JSON payload to write changes

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

The implementation plan is broader than the current live API. Keywords and core article flows are now exposed in `outrank-cli`, but integrations, backlinks, and onboarding flows are still incomplete. If the user asks for something not present in `outrank-cli --help`, say that exact command surface is not shipped yet and do not invent unsupported commands.

