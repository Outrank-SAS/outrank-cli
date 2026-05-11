# Outrank CLI

Agent-first CLI for the Outrank agent API.

## Current scope

This repo currently targets the agent endpoints that already exist in `outrank`:

- `auth whoami`
- `products list|get|create|update|pause|resume`
- `products output-settings get|update` for product article settings
- `products target-audiences list|replace`
- `products competitors list|replace`
- `products gsc status|connect|poll|reconnect|disconnect|accounts|properties|set-property|performance|search-analytics|inspect-url|cannibalization`
- `keywords list|get|export|generation-status|add|suggest|generate|reschedule|bulk-reschedule|delete|bulk-delete`
- `articles list|get|get-content|update|update-content|replace|bulk-replace|upload-image|upload-featured-image|retry-publish|delete|precreate|generate`
- `subscription status`
- `usage stats`
- `billing portal-url`
- `billing purchase-products quote|buy`

The broader roadmap from the internal implementation plan is larger than the live backend surface. This CLI is structured so new groups can be added cleanly as the server catches up.

## Auth

The CLI can read credentials from either:

- `OUTRANK_API_KEY`
- `~/.outrank/config.json` after `outrank-cli auth login <api-key>`

Optional base URL overrides:

- `OUTRANK_BASE_URL`
- `--base-url <url>`

Optional config storage override:

- `OUTRANK_CONFIG_DIR`

## Examples

```powershell
outrank-cli auth login outr_live_xxx
outrank-cli auth status
outrank-cli auth whoami
outrank-cli products list --limit 20
outrank-cli keywords list --product 00000000-0000-0000-0000-000000000000 --scope all
outrank-cli keywords generation-status --product 00000000-0000-0000-0000-000000000000
outrank-cli articles list --product 00000000-0000-0000-0000-000000000000 --status published
outrank-cli articles get 00000000-0000-0000-0000-000000000000
outrank-cli articles get-content 00000000-0000-0000-0000-000000000000 --format html
outrank-cli articles update 00000000-0000-0000-0000-000000000000 --json '{"title":"New title"}'
outrank-cli articles update 00000000-0000-0000-0000-000000000000 --json '{"image_url":"https://example.com/featured.jpg"}'
outrank-cli articles upload-image --file .\diagram.png --article 00000000-0000-0000-0000-000000000000
outrank-cli articles upload-featured-image 00000000-0000-0000-0000-000000000000 --file .\hero.jpg
outrank-cli articles replace 00000000-0000-0000-0000-000000000000 --json '{"find":"Old brand","replace_with":"New brand","preview_only":true}'
outrank-cli articles retry-publish 00000000-0000-0000-0000-000000000000
outrank-cli articles precreate 00000000-0000-0000-0000-000000000000
outrank-cli articles generate 00000000-0000-0000-0000-000000000000
outrank-cli subscription status
outrank-cli usage stats
outrank-cli products get 00000000-0000-0000-0000-000000000000
outrank-cli keywords suggest --product 00000000-0000-0000-0000-000000000000 --theme "email marketing"
outrank-cli keywords generate --product 00000000-0000-0000-0000-000000000000 --count 10 --source both
outrank-cli keywords add --product 00000000-0000-0000-0000-000000000000 --json-file .\keywords.json
outrank-cli keywords export --product 00000000-0000-0000-0000-000000000000
outrank-cli products create --json-file .\product.json
# products create now auto-queues the initial ~30-day keyword plan; poll with keywords generation-status / keywords list
outrank-cli billing portal-url
outrank-cli products update 00000000-0000-0000-0000-000000000000 --json '{"daily_article_count":2}'
outrank-cli products output-settings update 00000000-0000-0000-0000-000000000000 --json-file .\output-settings.json
outrank-cli products target-audiences replace 00000000-0000-0000-0000-000000000000 --json-file .\target-audiences.json
outrank-cli products competitors replace 00000000-0000-0000-0000-000000000000 --json-file .\competitors.json
outrank-cli products gsc status 00000000-0000-0000-0000-000000000000
outrank-cli products gsc connect 00000000-0000-0000-0000-000000000000
outrank-cli products gsc poll 00000000-0000-0000-0000-000000000000 --attempt-id <attempt-id>
outrank-cli products gsc accounts 00000000-0000-0000-0000-000000000000
outrank-cli products gsc properties 00000000-0000-0000-0000-000000000000 --email owner@example.com
outrank-cli products gsc set-property 00000000-0000-0000-0000-000000000000 --email owner@example.com --site-url sc-domain:example.com
outrank-cli products gsc performance 00000000-0000-0000-0000-000000000000 --months 3
outrank-cli products gsc search-analytics 00000000-0000-0000-0000-000000000000 --dimensions query,page --limit 50 --query "brand"
outrank-cli products gsc inspect-url 00000000-0000-0000-0000-000000000000 --url https://example.com/blog/post
outrank-cli products gsc cannibalization 00000000-0000-0000-0000-000000000000
outrank-cli keywords reschedule 00000000-0000-0000-0000-000000000000 --scheduled-for 2026-05-20
outrank-cli billing purchase-products quote --additional-products 2
```

## Google Search Console workflow

- Start with `outrank-cli products gsc connect <product-id>`.
- Open the returned `connect_url` in a browser and complete the Google OAuth flow with a human.
- Poll with `outrank-cli products gsc poll <product-id> --attempt-id <attempt-id>` until the response reports completion.
- Inspect connected Google identities with `outrank-cli products gsc accounts <product-id>`.
- List Search Console properties for one account with `outrank-cli products gsc properties <product-id> --email owner@example.com`.
- Save the verified property with `outrank-cli products gsc set-property <product-id> --email owner@example.com --site-url <verified-site-url>`.
- Read performance summaries with `outrank-cli products gsc performance <product-id>`.
- Run custom keyword/page/device reports with `outrank-cli products gsc search-analytics <product-id>`.
- Inspect one page's indexing and canonical state with `outrank-cli products gsc inspect-url <product-id> --url <url>`.
- Analyze overlapping-query cannibalization with `outrank-cli products gsc cannibalization <product-id>`.
- Use `reconnect` when the token is expired and `disconnect` to remove the product connection.

## Keyword mutation rules

- Run `outrank-cli keywords generation-status --product <product-id>` before keyword writes when you are not sure the product is writable.
- `keywords generate` now mirrors the dashboard Generate Keywords flow. Ask the human how many keywords to generate before calling it if they did not specify a count.
- The allowed generation count is 5-30, but the real upper bound depends on free scheduler slots. Check `keywords generation-status` first when you need the current capacity.
- Stored keywords are read-only inventory. They can be promoted into the plan with `keywords add`, but they cannot be deleted directly.
- Scheduled keywords with created or pre-created articles are read-only.
- Keywords in `generating_article` are read-only until generation finishes.
- Past keywords are read-only except past `scheduled` or `disabled` keywords without an article, which can still be rescheduled.
- If the main subscription is `past_due`, keyword mutations are blocked and reads still work.

## Article behavior notes

- Article content is markdown in the current app and agent API. `articles get-content` returns markdown by default; `--format html` returns rendered HTML.
- Featured image can be updated either by hosted URL through `articles update --json '{"image_url":"..."}'` or by local-file upload through `articles upload-featured-image`.
- In-content images can be uploaded from a local file with `articles upload-image`; the command returns the hosted URL plus generated alt text so the agent can insert or replace the markdown image reference.
- Per-article instructions are stored on the linked scheduled keyword, so `articles update --json '{"instructions":"..."}'` only works for articles that still have a linked planner keyword.
- Slug is returned for read-only reference but cannot be changed through the agent API.
- `articles generate <keyword-id>` is only valid for scheduled keywords due today; it mirrors the dashboard's create-and-publish action.
- `articles precreate <keyword-id>` is only valid for eligible future scheduled keywords, is unavailable on trial subscriptions, and should be polled through the keyword state afterward.
- `articles update --json '{"status":"published"}'` cannot be used to manually publish a future scheduled article before its due date.
- `articles retry-publish <article-id>` is only valid for generated articles with a publish error.

## Custom API target

If your agent API is hosted somewhere other than the production default host, set `OUTRANK_BASE_URL` to that deployment:

```powershell
$env:OUTRANK_BASE_URL="https://outrank.so"
outrank-cli auth login outr_live_xxx --no-verify
outrank-cli auth status
outrank-cli auth whoami
```

Recommended workflow when targeting a non-default host:

```powershell
$env:OUTRANK_BASE_URL="https://outrank.so"
npm link
outrank-cli auth login outr_live_xxx
outrank-cli auth whoami
outrank-cli products list --limit 3
```

The current agent API expects product UUIDs, not numeric ids like `88`.

## Notes on `whoami`

`auth whoami` currently returns `organization.product_count` from the backend. In the current Outrank backend, that value behaves as the organization's purchased or available product-slot count, not necessarily the number of product rows returned by `products list`.

If you do not want a global link yet, you can run the CLI directly from this repo:

```powershell
$env:OUTRANK_BASE_URL="https://outrank.so"
node .\src\index.js auth whoami --api-key outr_live_xxx
```

## JSON-first contract

Every command writes a single JSON object to stdout.

- Successful API calls pass through the server's `ok`, `data`, and `agent_guidance` shape.
- Local CLI-only commands (`auth login`, `auth logout`, usage help) emit the same envelope shape.
- Invalid usage and local runtime failures also emit JSON and exit non-zero.

This makes the CLI easier for AI agents to drive reliably.

