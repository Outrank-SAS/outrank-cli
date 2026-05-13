# Outrank CLI

Agent-first CLI for the Outrank agent API.

## Install

Requires Node.js 18+.

```powershell
npm install -g outrank-cli
outrank-cli --help
```

Or run it from a clone without installing globally:

```powershell
git clone https://github.com/Outrank-SAS/outrank-cli.git
cd outrank-cli
npm install
node .\src\index.js --help
```

## Get an API key

1. Sign in to your Outrank account at <https://www.outrank.so>.
2. Open **Settings → API keys**: <https://www.outrank.so/dashboard/settings/api-keys>.
3. Click **Create key**, give it a name, and copy the `outr_live_...` value. The key is shown only once — store it somewhere safe.
4. Revoke a key from the same page if it ever leaks. Generate a fresh one and re-run `auth login`.

You can also rotate keys at any time; each key is independent and can be revoked without affecting the others.

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

The CLI reads credentials in this order of precedence:

1. `--api-key <key>` on the command line (highest priority, per-call)
2. `OUTRANK_API_KEY` environment variable
3. `~/.outrank/config.json`, populated by `outrank-cli auth login <api-key>` (lowest priority, persistent)

Pick one. For interactive use on your own machine, `auth login` is simplest. For CI / ephemeral environments, prefer the env var.

```powershell
# One-time persistent setup
outrank-cli auth login outr_live_xxx
outrank-cli auth status     # confirms the key is stored
outrank-cli auth whoami     # round-trips it against the server

# OR per-shell env var (no config file written)
$env:OUTRANK_API_KEY = "outr_live_xxx"
outrank-cli auth whoami

# OR per-call (useful in scripts)
outrank-cli auth whoami --api-key outr_live_xxx
```

Sign out / rotate:

```powershell
outrank-cli auth logout     # clears apiKey from ~/.outrank/config.json
```

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

## Custom API target (advanced)

The CLI talks to `https://www.outrank.so` by default and you should not need to change that. The override below exists only for Outrank staff debugging against a staging deployment.

```powershell
$env:OUTRANK_BASE_URL="https://staging.example"
outrank-cli auth whoami
```

`--base-url <url>` is the per-command form.

The agent API expects product UUIDs, not numeric ids like `88`.

## Notes on `whoami`

`auth whoami` currently returns `organization.product_count` from the backend. In the current Outrank backend, that value behaves as the organization's purchased or available product-slot count, not necessarily the number of product rows returned by `products list`.

If you do not want a global link yet, you can run the CLI directly from this repo:

```powershell
node .\src\index.js auth whoami --api-key outr_live_xxx
```

## JSON-first contract

Every command writes a single JSON object to stdout.

- Successful API calls pass through the server's `ok`, `data`, and `agent_guidance` shape.
- Local CLI-only commands (`auth login`, `auth logout`, usage help) emit the same envelope shape.
- Invalid usage and local runtime failures also emit JSON and exit non-zero.

This makes the CLI easier for AI agents to drive reliably.

## Using the agent skill (`SKILL.md`)

`SKILL.md` ships alongside this CLI as a Claude Code skill. It tells an AI agent how to drive `outrank-cli` end-to-end — when to inspect before writing, how to interpret `agent_guidance`, the new-product preflight, the GSC flow, keyword/article rules, and how to handle 401/402/403/409 errors.

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

