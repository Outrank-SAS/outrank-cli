# Outrank CLI

Agent-first CLI for the Outrank agent API.

## Install

Requires Node.js 18+. Works on macOS, Linux, and Windows.

```bash
npm install -g outrank-cli
outrank-cli --help
```

Or run it from a clone without installing globally:

```bash
git clone https://github.com/Outrank-SAS/outrank-cli.git
cd outrank-cli
npm install
node ./src/index.js --help
```

## Get an API key

1. Sign in to your Outrank account at <https://www.outrank.so>.
2. Open **Settings → API keys**: <https://www.outrank.so/dashboard/settings/api-keys>.
3. Click **Create key**, give it a name, and copy the `outr_live_...` value. The key is shown only once — store it somewhere safe.
4. Revoke a key from the same page if it ever leaks. Generate a fresh one and re-run `auth login`.

You can also rotate keys at any time; each key is independent and can be revoked without affecting the others.

## Current scope

This repo currently targets the agent endpoints that already exist in `outrank`:

- `auth login|whoami|status|profiles|logout`
- `products list|get|create|update|pause|resume`
- `products integrations providers|prepare|connect|poll|validate|list|create|get|update|test|delete`
- `products integrations notion databases|schema`
- `products integrations framer collections|fields`
- `products integrations webflow sites|collections|fields|items`
- `products output-settings get|update` for product article settings
- `products target-audiences list|replace`
- `products competitors list|replace`
- `products gsc status|connect|poll|reconnect|disconnect|accounts|properties|set-property|performance|search-analytics|inspect-url|cannibalization`
- `products linking sources get|update`
- `products linking detect`
- `products linking target-config get|update`
- `products linking targets list|add-manual|upsert|clear-customizations|delete`
- `products backlinks get|update|credits|earned|unverified|check-removal|reverify|subscription|subscribe-quote`
- `keywords list|get|export|generation-status|add|update|suggest|generate|bulk-reschedule|delete|bulk-delete`
- `articles list|get|get-content|update|update-content|replace|bulk-replace|upload-image|upload-featured-image|retry-publish|delete|precreate|generate`
- `improvements settings get|update`
- `improvements analyze`
- `improvements candidates list|brief|edit-brief|schedule`
- `improvements tasks list|reschedule|cancel|edit-brief|execute`
- `improvements executions list|get|decisions|push`
- `marketplace seller status|onboard|eligibility|settings|integrations|stripe|complete-onboarding|placements|earnings|content-history`
- `marketplace notifications list|mark-read`
- `marketplace buyer status|billing-status|subscription|subscribe-quote|checkout|change-plan|target-pages|participation|placements|article|credits`
- `subscription status`
- `usage stats`
- `billing portal-url`
- `billing purchase-products quote|buy`

The broader roadmap from the internal implementation plan is larger than the live backend surface. This CLI is structured so new groups can be added cleanly as the server catches up.

## Auth

The CLI reads credentials in this order of precedence:

1. `--api-key <key>` and `--base-url <url>` on the command line (highest priority, per-call)
2. A profile selected with `--profile <name>` or `OUTRANK_PROFILE`. A selected profile is used as-is: `OUTRANK_API_KEY` and `OUTRANK_BASE_URL` are ignored, and a profile without a stored key fails with `CLI_AUTH_REQUIRED` instead of silently using another key
3. `OUTRANK_API_KEY` and `OUTRANK_BASE_URL` environment variables
4. The default profile in `~/.outrank/config.json`, populated by `outrank-cli auth login <api-key>` (lowest priority, persistent)

`auth status` shows which profile is active and where its key and base URL came from (`flag`, `env`, `profile`, or `profile (env ignored)` when an environment variable was set but a higher-priority source won).

Pick one. For interactive use on your own machine, `auth login` is simplest. For CI / ephemeral environments, prefer the env var.

```bash
# One-time persistent setup
outrank-cli auth login outr_live_xxx
outrank-cli auth status     # confirms the key is stored
outrank-cli auth whoami     # round-trips it against the server

# OR per-shell env var (no config file written)
export OUTRANK_API_KEY="outr_live_xxx"   # macOS / Linux (bash, zsh)
outrank-cli auth whoami

# OR per-call (useful in scripts)
outrank-cli auth whoami --api-key outr_live_xxx
```

On Windows PowerShell, set the env var with `$env:OUTRANK_API_KEY = "outr_live_xxx"`. On Windows `cmd.exe`, use `set OUTRANK_API_KEY=outr_live_xxx`.

Sign out / rotate:

```bash
outrank-cli auth logout     # clears apiKey from the default profile in ~/.outrank/config.json
```

### Profiles (one per organization)

API keys are scoped to one organization. Store one profile per organization and switch with `--profile`:

```bash
outrank-cli auth login outr_live_xxx --profile acme               # the first stored key becomes the default profile
outrank-cli auth login outr_live_yyy --profile globex             # a second profile; the default does not change
outrank-cli auth login outr_live_yyy --profile globex --default   # ...unless you ask for it
outrank-cli auth profiles                                         # lists profiles with redacted keys, marks the default
outrank-cli products list --profile globex                        # per call
export OUTRANK_PROFILE=globex                                     # per shell
outrank-cli auth logout --profile globex                          # clears only that profile's key
```

`auth login` and `auth logout` without `--profile` act on the default profile. `auth login` verifies against and stores the base URL it resolves with the same precedence as every other command: `--base-url`, else `OUTRANK_BASE_URL` (ignored when a profile is selected), else the profile's stored value, else the default. Re-running `auth login` for a stored profile therefore keeps that profile's base URL. The config file keeps the default profile mirrored in the top-level `apiKey` / `baseUrl` keys, so an older `outrank-cli` (0.5.x) on the same machine keeps working; it only ever sees the default profile. A config file that cannot be parsed, or that contains a profile name the CLI does not accept, fails every command with `CLI_CONFIG_UNREADABLE` (the path is in `error.details.config_path`), and `auth login` / `auth logout` never overwrite it. A failed save is `CLI_CONFIG_UNWRITABLE` and nothing is stored. `auth status` and `auth profiles` still work when the selected profile does not exist, so you can always inspect what is stored.

## Examples

```bash
outrank-cli auth login outr_live_xxx
outrank-cli auth status
outrank-cli auth whoami
outrank-cli products list --limit 20
outrank-cli keywords list --product 00000000-0000-0000-0000-000000000000 --scope all
outrank-cli keywords list --product 00000000-0000-0000-0000-000000000000 --scope scheduled --q "best seo tools"
outrank-cli keywords generation-status --product 00000000-0000-0000-0000-000000000000
outrank-cli articles list --product 00000000-0000-0000-0000-000000000000 --status published
outrank-cli articles get 00000000-0000-0000-0000-000000000000
outrank-cli articles get-content 00000000-0000-0000-0000-000000000000 --format html
outrank-cli articles update 00000000-0000-0000-0000-000000000000 --json '{"title":"New title"}'
outrank-cli articles update 00000000-0000-0000-0000-000000000000 --json '{"image_url":"https://example.com/featured.jpg"}'
outrank-cli articles upload-image --file ./diagram.png --article 00000000-0000-0000-0000-000000000000
outrank-cli articles upload-featured-image 00000000-0000-0000-0000-000000000000 --file ./hero.jpg
outrank-cli articles replace 00000000-0000-0000-0000-000000000000 --json '{"find":"Old brand","replace_with":"New brand","preview_only":true}'
outrank-cli articles retry-publish 00000000-0000-0000-0000-000000000000
outrank-cli articles precreate 00000000-0000-0000-0000-000000000000
outrank-cli articles generate 00000000-0000-0000-0000-000000000000
outrank-cli improvements settings get 00000000-0000-0000-0000-000000000000
outrank-cli improvements candidates list 00000000-0000-0000-0000-000000000000 --type ctr_gap --limit 20
outrank-cli improvements candidates schedule 00000000-0000-0000-0000-000000000000 --scheduled-for 2026-06-01
outrank-cli improvements tasks execute 00000000-0000-0000-0000-000000000000
outrank-cli improvements executions push 00000000-0000-0000-0000-000000000000
outrank-cli subscription status
outrank-cli usage stats
outrank-cli products get 00000000-0000-0000-0000-000000000000
outrank-cli products integrations providers
outrank-cli products integrations prepare wordpress-plugin 00000000-0000-0000-0000-000000000000
outrank-cli products integrations connect wordpress-com 00000000-0000-0000-0000-000000000000 --json '{"name":"Main WordPress.com","publish_status":"publish"}'
outrank-cli products integrations connect notion 00000000-0000-0000-0000-000000000000
outrank-cli products integrations poll wordpress-com 00000000-0000-0000-0000-000000000000 --attempt-id <attempt-id>
outrank-cli products integrations poll notion 00000000-0000-0000-0000-000000000000 --attempt-id <attempt-id>
outrank-cli products integrations notion databases 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
outrank-cli products integrations notion schema 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
outrank-cli products integrations framer collections --json '{"project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key"}'
outrank-cli products integrations framer fields --json '{"project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key","collection_id":"collection_id"}'
outrank-cli products integrations webflow sites --json-file webflow-sites.json
outrank-cli products integrations webflow collections --json '{"api_token":"wf_token","site_id":"site_id"}'
outrank-cli products integrations webflow fields --json '{"api_token":"wf_token","collection_id":"collection_id"}'
outrank-cli products integrations webflow items --json '{"api_token":"wf_token","collection_id":"collection_id"}'
outrank-cli products integrations validate webhook --json '{"endpoint":"https://api.example.com/webhook","access_token":"secret"}'
outrank-cli products integrations validate framer --json '{"project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key"}'
outrank-cli products integrations validate shopify --json '{"access_token":"shpat_xxx"}'
outrank-cli products integrations validate webflow --json '{"api_token":"wf_token"}'
outrank-cli products integrations validate wix --json '{"site_id":"00000000-0000-0000-0000-000000000000","api_key":"wix_api_key"}'
outrank-cli products integrations validate wordpress-plugin --json '{"domain":"https://example.com","api_key":"secret-token"}'
outrank-cli products integrations validate ghost --json '{"url":"https://example.ghost.io","api_key":"abcdef1234567890:abcdef1234567890abcdef1234567890"}'
outrank-cli products integrations list 00000000-0000-0000-0000-000000000000
outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"webhook","name":"Main Webhook","endpoint":"https://api.example.com/webhook","access_token":"secret"}'
outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"framer","name":"Main Framer","project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key","author_name":"Outrank AI","publish_mode":"deploy","collection_setup_mode":"create"}'
outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"shopify","name":"Main Shopify","access_token":"shpat_xxx","blog_id":"123456789","author_name":"Outrank","publish_status":"publish"}'
outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"wix","name":"Main Wix","site_id":"00000000-0000-0000-0000-000000000000","api_key":"wix_api_key","publish_status":"publish"}'
outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json-file webflow-create.json
outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"wordpress-plugin","domain":"https://example.com","api_key":"secret-token"}'
outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"ghost","name":"Main Ghost","url":"https://example.ghost.io","api_key":"abcdef1234567890:abcdef1234567890abcdef1234567890","publish_status":"draft"}'
outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"nextjs-blog"}'
outrank-cli products integrations get 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"endpoint":"https://api.example.com/webhook-v2"}'
outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"publish_status":"draft"}'
outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json-file webflow-update.json
outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"domain":"https://example.com/blog","api_key":"new-secret-token"}'
outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"publish_status":"published"}'
outrank-cli products integrations test 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
outrank-cli keywords suggest --product 00000000-0000-0000-0000-000000000000 --theme "email marketing"
outrank-cli keywords generate --product 00000000-0000-0000-0000-000000000000 --count 10 --source both
outrank-cli keywords add --product 00000000-0000-0000-0000-000000000000 --json-file ./keywords.json
outrank-cli keywords update 00000000-0000-0000-0000-000000000000 --json '{"instructions":"Write for beginners and include a step-by-step setup section"}'
outrank-cli keywords export --product 00000000-0000-0000-0000-000000000000
outrank-cli products create --json-file ./product.json
# products create auto-queues the initial ~30-day keyword plan; poll with keywords generation-status / keywords list
outrank-cli billing portal-url
outrank-cli products update 00000000-0000-0000-0000-000000000000 --json '{"daily_article_count":2}'
outrank-cli products output-settings update 00000000-0000-0000-0000-000000000000 --json-file ./output-settings.json
outrank-cli products target-audiences replace 00000000-0000-0000-0000-000000000000 --json-file ./target-audiences.json
outrank-cli products competitors replace 00000000-0000-0000-0000-000000000000 --json-file ./competitors.json
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
outrank-cli products linking sources get 00000000-0000-0000-0000-000000000000
outrank-cli products linking sources update 00000000-0000-0000-0000-000000000000 --json-file ./linking-sources.json
outrank-cli products linking detect 00000000-0000-0000-0000-000000000000
outrank-cli products linking target-config update 00000000-0000-0000-0000-000000000000 --json '{"only_prioritized":true}'
outrank-cli products linking targets list 00000000-0000-0000-0000-000000000000
outrank-cli products linking targets add-manual 00000000-0000-0000-0000-000000000000 --json-file ./manual-target.json
outrank-cli products linking targets upsert 00000000-0000-0000-0000-000000000000 --json-file ./target-upsert.json
outrank-cli products linking targets clear-customizations 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
outrank-cli products linking targets delete 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
outrank-cli products backlinks get 00000000-0000-0000-0000-000000000000
outrank-cli products backlinks update 00000000-0000-0000-0000-000000000000 --json '{"enabled":true,"min_domain_rating":10}'
outrank-cli products backlinks credits 00000000-0000-0000-0000-000000000000
outrank-cli products backlinks earned 00000000-0000-0000-0000-000000000000 --limit 10 --include-article
outrank-cli products backlinks unverified 00000000-0000-0000-0000-000000000000 --limit 10
outrank-cli products backlinks check-removal 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
outrank-cli products backlinks reverify 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
outrank-cli products backlinks subscription 00000000-0000-0000-0000-000000000000
outrank-cli products backlinks subscribe-quote 00000000-0000-0000-0000-000000000000 --plan premium
outrank-cli keywords update 00000000-0000-0000-0000-000000000000 --json '{"scheduled_for":"2026-05-20"}'
outrank-cli billing purchase-products quote --additional-products 2
outrank-cli marketplace seller status 00000000-0000-0000-0000-000000000000
outrank-cli marketplace seller onboard 00000000-0000-0000-0000-000000000000 --country US
outrank-cli marketplace seller placements list 00000000-0000-0000-0000-000000000000 --status needs_approval
outrank-cli marketplace seller earnings 00000000-0000-0000-0000-000000000000
outrank-cli marketplace buyer status 00000000-0000-0000-0000-000000000000
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

## Linking workflow

- Inspect current source selection with `outrank-cli products linking sources get <product-id>`.
- Update the primary or additional sources with `outrank-cli products linking sources update <product-id> --json-file linking-sources.json`.
- Re-run discovery with `outrank-cli products linking detect <product-id>`.
- List saved targets with `outrank-cli products linking targets list <product-id>`.
- Add a manual on-domain URL with `outrank-cli products linking targets add-manual <product-id> --json-file manual-target.json`.
- Create or update a saved target with `outrank-cli products linking targets upsert <product-id> --json-file target-upsert.json`.
- Inspect or update product-wide behavior with `outrank-cli products linking target-config get|update <product-id>`.
- Clear custom anchor text with `outrank-cli products linking targets clear-customizations <product-id> <target-id>`.
- Remove a stale target with `outrank-cli products linking targets delete <product-id> <target-id>`.

Example payloads:

```json
{
  "source_type": "sitemap",
  "source_url": "https://example.com/sitemap.xml",
  "additional_linking_sources": [
    {
      "id": "docs-root",
      "source_type": "root_url",
      "source_url": "https://docs.example.com/blog",
      "purpose": "linking"
    }
  ]
}
```

```json
{
  "url": "https://example.com/blog/best-page",
  "title": "Best Page",
  "is_prioritized": true,
  "anchor_texts": [
    "best page",
    "example guide"
  ]
}
```

## Backlinks workflow

- Inspect current backlink settings with `outrank-cli products backlinks get <product-id>`.
- Update backlink settings with `outrank-cli products backlinks update <product-id> --json-file backlinks.json`.
- Inspect current credits with `outrank-cli products backlinks credits <product-id>`.
- Review earned backlinks with `outrank-cli products backlinks earned <product-id> --limit 20`.
- Add `--include-article` or `--include-summary` when the human needs article context in the earned list.
- Review the unverified queue with `outrank-cli products backlinks unverified <product-id> --limit 20`.
- Trigger a live removal check with `outrank-cli products backlinks check-removal <product-id> <backlink-id>`.
- Trigger manual reverification with `outrank-cli products backlinks reverify <product-id> <backlink-id>`.
- Inspect the current backlink subscription state with `outrank-cli products backlinks subscription <product-id>`.
- Quote a dashboard-equivalent subscription plan with `outrank-cli products backlinks subscribe-quote <product-id> --plan premium`.

Example payload:

```json
{
  "enabled": true,
  "min_domain_rating": 10
}
```

## Marketplace workflow

Seller side (live):

- Start with `outrank-cli marketplace seller status <product-id>` — its guidance walks the onboarding wizard (Blog -> Articles -> Integration -> Payouts).
- `outrank-cli marketplace seller onboard <product-id> [--country <ISO2>]` orchestrates onboarding: it reports remaining steps, adopts an existing reusable CMS automatically (never ask the user to pick a platform when one is reusable), and creates the Stripe Express account once the earlier steps are done and a country is provided.
- Stripe identity/bank onboarding happens in a browser — surface the returned `onboardingUrl` to the human.
- Finish with `outrank-cli marketplace seller complete-onboarding <product-id>` and always report the eligibility check results (`marketplace seller eligibility`) to the human.
- Day-to-day: `placements list|approve|decline|publish|regenerate`, `earnings`, `settings get|update`, `stripe manage`, `content-history`, and `marketplace notifications list --role seller`.
- Admin-only (server-enforced against the key creator's current role): settings update, integrations writes, stripe commands, complete-onboarding, placements decline.

Buyer side:

- Start with `outrank-cli marketplace buyer status <product-id>` — its guidance drives the setup sequence.
- The mandatory sequence: Enterprise backlink plan (`buyer subscribe-quote`, a human org admin completes checkout — purchasing is admin-only) -> add target pages (`buyer target-pages discover|add`) -> `buyer participation on`.
- Then `buyer placements list|regenerate|revalidate`, `buyer article get|edit`, `buyer credits history`, and `marketplace notifications list --role buyer`.

## Keyword mutation rules

- Run `outrank-cli keywords generation-status --product <product-id>` before keyword writes when you are not sure the product is writable.
- `keywords generate` mirrors the dashboard Generate Keywords flow. Ask the human how many keywords to generate before calling it if they did not specify a count.
- The allowed generation count is 5-30, but the real upper bound depends on free scheduler slots. Check `keywords generation-status` first when you need the current capacity.
- Stored keywords are read-only inventory. They can be promoted into the plan with `keywords add`, but they cannot be deleted directly.
- Scheduled keywords with created or pre-created articles are read-only.
- Keywords in `generating_article` are read-only until generation finishes.
- Past keywords are read-only except past `scheduled` or `disabled` keywords without an article, which can still be rescheduled.
- If the main subscription is `past_due`, keyword mutations are blocked and reads still work.
- `keywords list` defaults to planner-first ordering for scheduled results, so page 1 prioritizes upcoming scheduled items before past ones.
- Use `keywords list --product <product-id> --scope scheduled --q "<keyword>"` when looking for one planner keyword by text. If `next_offset` is not `null`, keep paging before claiming the keyword is absent.
- Keyword records return top-level `article_type`, `article_subtype`, `expected_length`, and label fields. Read those from the keyword itself when answering article-type or expected-length questions; do not look in product output-settings for per-keyword length.
- Use `keywords update <keyword-id> --json '{"instructions":"..."}'` to add or change per-keyword instructions after creation. This matches the dashboard flow, which creates the keyword first and updates the brief afterward.
- Use `keywords update <keyword-id> --json '{"quality_questions":[{"id":"...","question":"...","answer":"..."}]}'` to answer or replace the keyword's quality questions through the same PATCH route.
- Use `keywords update <keyword-id> --json '{"scheduled_for":"YYYY-MM-DD","instructions":"..."}'` when you need to change the date and brief in one PATCH request.
- Use `keywords update <keyword-id> --json '{"scheduled_for":"YYYY-MM-DD"}'` for date-only rescheduling too; there is no separate reschedule command.
- `keywords get <keyword-id>` returns `article_type_options`, which lists the valid dropdown values for `article_type`, `article_subtype`, and `expected_length`.
- Use `keywords update --json '{"article_type":"guide","article_subtype":"explainer","expected_length":"long"}'` to mirror the scheduler card's "Article Type Settings" modal. The API rejects values outside the returned option lists.

## Article behavior notes

- Article content is markdown in the current app and agent API. `articles get-content` returns markdown by default; `--format html` returns rendered HTML.
- Featured image can be updated either by hosted URL through `articles update --json '{"image_url":"..."}'` or by local-file upload through `articles upload-featured-image`.
- In-content images can be uploaded from a local file with `articles upload-image`; the command returns the hosted URL plus generated alt text so the agent can insert or replace the markdown image reference.
- Per-article instructions are stored on the linked scheduled keyword, so `articles update --json '{"instructions":"..."}'` only works for articles that still have a linked planner keyword.
- `articles get <article-id>` returns `article_type_options`, which lists the valid dropdown values for `article_type`, `article_subtype`, and `expected_length`.
- Article records with a linked scheduled keyword also return top-level `article_type`, `article_subtype`, `expected_length`, and label fields for direct reads.
- Use `articles update --json '{"article_type":"guide","article_subtype":"comparison","expected_length":"long"}'` to mirror the dashboard's "Article Type Settings" modal. The API rejects values outside the returned option lists.
- `articles update --json '{"status":"published"}'` attempts a real publish through the product's active integration for eligible attached articles; it is not just a local status flip.
- Slug is returned for read-only reference but cannot be changed through the agent API.
- `articles generate <keyword-id>` is only valid for scheduled keywords due today; it mirrors the dashboard's create-and-publish action.
- `articles precreate <keyword-id>` is only valid for eligible future scheduled keywords, is unavailable on trial subscriptions, and should be polled through the keyword state afterward.
- `articles update --json '{"status":"published"}'` cannot be used to manually publish a future scheduled article before its due date.
- `articles retry-publish <article-id>` is only valid for generated articles with a publish error.

## Article improvements behavior notes

- Article improvements are a separate surface from generation: they rewrite an already-published post based on Search Console signals, then push the result to the CMS. They require the All-in-One plan. On Basic plan, `improvements candidates list` returns an empty list and write actions return `PLAN_UPGRADE_REQUIRED`.
- `improvements settings update --json '{"enabled":true}'` starts an unattended loop: weekly opportunity discovery, daily auto-scheduling on `publishing_days` (at most 2 weekday codes from Mon–Sun), and execution every ~15 minutes. Surface this to the human before enabling.
- `improvements settings update --json '{"auto_push":true}'` publishes every successful rewrite to the CMS without human review (still skipped automatically on a hard validation failure or an unverified backlink injection).
- `improvements settings get` returns `readiness`, which says whether the connected CMS can actually receive a pushed update (`ready`) or not (`not_connected`, `action_required`, `unsupported`). A push to an unsupported/disconnected CMS is reported as `skipped` with `requires_manual_publish`.
- `improvements analyze`, `improvements candidates brief`, and `improvements tasks execute` run in Firebase and can take minutes. If the call times out at the network edge, the work still completes server-side — re-list candidates or poll the execution rather than retrying.
- After `improvements candidates brief`, poll the candidate (via `improvements candidates list`) until its `brief_status` is `ready`. After `improvements tasks execute`, poll `improvements executions get <execution-id>` until `status` is `completed`, then read `review_status`.
- A candidate (or its underlying article) can have only one active scheduled task at a time, and an article can have only one active (pending/running) execution. Conflicts return `409`.
- `improvements executions get` returns `before`/`after`, paragraph-level `hunks` (each with an id), and `validation_issues`. Push with no JSON to accept all changes; send `{"decisions":{"<hunkId>":"rejected"},"edited_hunks":{"<hunkId>":"..."}}` to reject or edit specific hunks. `decisions` and `push` only work while `review_status` is `awaiting_review`.
- A push updates the article inside Outrank first, then dispatches to the CMS. `CMS_PUSH_FAILED` means the content was saved in Outrank but the CMS rejected it; inspect `error.details.cms_response` and retry.
- `improvements candidates list` and `improvements executions list` use offset pagination through `data.next_offset`.

## Linking behavior notes

- Linking writes are blocked unless the product has an active backlink subscription.
- `products linking sources update` accepts `source_type` values `sitemap`, `root_url`, or `integration`.
- When `source_type` is `sitemap` or `root_url`, `source_url` is required.
- `additional_linking_sources` is a full replacement list. Each item needs `id`, `source_type`, `source_url`, and `purpose`.
- `products linking detect` refreshes discovered article URLs from the saved primary source.
- `products linking targets add-manual` and `upsert` only accept URLs on the product's own domain.
- `products linking target-config update --json '{"only_prioritized":true}'` requires enough prioritized targets; if not, the API returns a conflict with guidance.

## Backlink behavior notes

- Use `products backlinks update`, not `products update`, for backlink exchange settings.
- Backlink writes are blocked when the product is hidden for inappropriate content, but reads still work.
- Setting `min_domain_rating` requires an active backlink subscription.
- `products backlinks subscribe-quote` is read-only. Purchasing or changing the add-on still requires the dashboard checkout flow.
- `products backlinks earned` uses cursor pagination through `data.next_cursor`.
- `products backlinks unverified` is the deduped article-level manual-review stream.

## Integrations workflow

- Inspect connected publishing integrations with `outrank-cli products integrations list <product-id>`.
- Inspect provider availability with `outrank-cli products integrations providers`.
- Webhook uses `endpoint` plus `access_token`. Outrank sends `Authorization: Bearer <access_token>` on each request. HMAC signing is not implemented in the current webhook integration.
- WordPress Plugin uses `domain` plus `api_key`. The Outrank plugin must already be installed and configured on the target site.
- Start WordPress Plugin setup with `outrank-cli products integrations prepare wordpress-plugin <product-id>`. That mirrors the dashboard flow by generating the integration token first, before validate/create.
- WordPress.com uses OAuth instead of direct credentials. Start with `outrank-cli products integrations connect wordpress-com <product-id> --json-file wordpress-com-connect.json`, have the human open the returned `connect_url`, then poll with `outrank-cli products integrations poll wordpress-com <product-id> --attempt-id <attempt-id>` until the handoff completes.
- Notion uses OAuth plus a second configuration step. Start with `outrank-cli products integrations connect notion <product-id>`, have the human open the returned `connect_url`, then poll with `outrank-cli products integrations poll notion <product-id> --attempt-id <attempt-id>`. After OAuth completes, use `outrank-cli products integrations notion databases <product-id> <integration-id>` and `... notion schema <product-id> <integration-id> <database-id>` before `update` to save `name`, `database_id`, and `fields`.
- Framer uses the newer Server API flow, not the older plugin flow. Start with `outrank-cli products integrations validate framer --json '{"project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key"}'`. If you want to publish into an existing user-owned collection, then use `framer collections` and `framer fields` before `create`; otherwise use `collection_setup_mode: "create"` and let Outrank create the collection automatically.
- Shopify uses a direct app access token. Start with `outrank-cli products integrations validate shopify --json '{"access_token":"shpat_xxx"}'`; the response returns `shop_name` and the available blogs you can use in the create payload, so the human does not need to provide the store name separately.
- Webflow uses a direct API token plus pre-save discovery. Start with `outrank-cli products integrations validate webflow --json-file webflow-sites.json`, then use `webflow sites`, `webflow collections`, `webflow fields`, and `webflow items` to build the exact create or update payload for the chosen CMS collection.
- Wix is a direct credential flow using `site_id`, `api_key`, and `publish_status`. Validate first, then create or update directly; there is no OAuth or prepare step.
- Next.js Blog is a one-step create flow. Run `outrank-cli products integrations create <product-id> --json '{"provider":"nextjs-blog"}'` and store the returned `data.secrets.api_key` immediately because it is not readable later.
- Validate unsaved webhook, Ghost, Framer, Shopify, Webflow, Wix, or WordPress Plugin credentials with `outrank-cli products integrations validate <provider> --json-file integration.json`.
- Create a webhook, Ghost, Framer, Shopify, Webflow, Wix, WordPress Plugin, or Next.js Blog integration with `outrank-cli products integrations create <product-id> --json-file integration-create.json`.
- Inspect one integration with `outrank-cli products integrations get <product-id> <integration-id>`.
- Update a saved webhook, Ghost, Shopify, Webflow, Wix, WordPress Plugin, or Notion integration with `outrank-cli products integrations update <product-id> <integration-id> --json-file integration-update.json`.
- Test a saved webhook, Ghost, Framer, Shopify, Webflow, Wix, WordPress Plugin, or Notion integration with `outrank-cli products integrations test <product-id> <integration-id>`.
- Delete a stale integration with `outrank-cli products integrations delete <product-id> <integration-id>`.

Current scope note:

- Webhook, Ghost, Shopify, Webflow, and Wix support direct validate/create/update/test. Framer supports validate, provider-specific discovery, create, and test for the newer Server API flow. WordPress Plugin supports prepare plus validate/create/update/test. Next.js Blog supports one-step create plus the shared list|get|delete surface, returning a one-time API key on create. WordPress.com supports OAuth connect plus poll, then the shared list|get|delete surface. Notion supports OAuth connect plus poll, provider-specific database/schema discovery, then update/test on the saved row.
- V2 products are intended to keep one publishing integration. If `list` returns multiple rows, that usually means legacy V1 residue and stale rows should be reviewed and deleted.
- Backlink exchange management covers configuration, status reads, earned/unverified review queues, and reverification actions. Purchasing or changing backlink add-ons still requires the dashboard checkout flow.
- Other providers are still mostly read/delete only while create, update, test, and provider-specific discovery are added one by one.

## Custom API target (advanced)

The CLI talks to `https://www.outrank.so` by default and you should not need to change that. The override below exists only for Outrank staff debugging against a staging deployment.

```bash
export OUTRANK_BASE_URL="https://staging.example"   # macOS / Linux
outrank-cli auth whoami
```

On Windows PowerShell, use `$env:OUTRANK_BASE_URL = "https://staging.example"`. On Windows `cmd.exe`, use `set OUTRANK_BASE_URL=https://staging.example`.

`--base-url <url>` is the per-command form and works on every platform.

The agent API expects product UUIDs, not numeric ids like `88`.

## Notes on `whoami`

`auth whoami` currently returns `organization.product_count` from the backend. In the current Outrank backend, that value behaves as the organization's purchased or available product-slot count, not necessarily the number of product rows returned by `products list`.

If you do not want a global link yet, you can run the CLI directly from this repo:

```bash
node ./src/index.js auth whoami --api-key outr_live_xxx
```

## JSON-first contract

Every command writes a single JSON object to stdout.

- Successful API calls pass through the server's `ok`, `data`, and `agent_guidance` shape.
- Local CLI-only commands (`auth login`, `auth logout`, usage help) emit the same envelope shape.
- Invalid usage and local runtime failures also emit JSON and exit non-zero.

This makes the CLI easier for AI agents to drive reliably.

## Using the agent skill (`SKILL.md`)

`SKILL.md` ships alongside this CLI as a Claude Code skill. It tells an AI agent how to drive `outrank-cli` end-to-end — when to inspect before writing, how to interpret `agent_guidance`, the new-product preflight, the GSC flow, the linking flow, keyword/article rules, and how to handle 401/402/403/409 errors.

You do not need it if you are using the CLI by hand from a terminal. You want it when you are letting an AI assistant operate the CLI for you.

### Claude Code

1. Install `outrank-cli` globally so the agent can call it: `npm install -g outrank-cli`.
2. Make `SKILL.md` available to Claude Code as a skill. Either:
   - **Project-scoped** — copy `SKILL.md` into `.claude/skills/outrank/SKILL.md` inside the project you want the agent to work in, or
   - **User-scoped** — copy it into `~/.claude/skills/outrank/SKILL.md` (Windows: `C:\Users\<you>\.claude\skills\outrank\SKILL.md`) so it is available in every Claude Code session.
3. Provide the API key once via env var or `outrank-cli auth login` (see [Auth](#auth)).
4. In Claude Code, ask the agent to do something Outrank-shaped (e.g. "list my products", "create a new product for example.com", "regenerate next week's keyword plan"). The skill's `description` triggers it automatically; Claude will run `outrank-cli` commands and follow the rules in `SKILL.md`.

### Other agents (Cursor, custom Anthropic SDK apps, etc.)

`SKILL.md` is plain Markdown — feed it as a system prompt, a tool description, or load it into the model's context however your runtime expects. The key contract is:

- Every command returns JSON with `ok`, `data`, and `agent_guidance`.
- The agent should always read `agent_guidance` before deciding the next step.
- Mutations should be preceded by an inspect call (`products get`, `keywords list`, `articles get`, etc.).

### Updating the skill

The CLI and `SKILL.md` are versioned together. When you upgrade `outrank-cli`, also refresh the copy of `SKILL.md` in your `.claude/skills/...` directory from the installed package (`<global node_modules>/outrank-cli/SKILL.md`) or from this repo.

