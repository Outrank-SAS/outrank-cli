import { defineGroup } from '../registry.js';
import { backlinksGroup } from './backlinks.js';
import { blogGroup } from './blog.js';
import {
  competitorsGroup,
  outputSettingsGroup,
  productsCreate,
  productsGet,
  productsList,
  productsPause,
  productsResume,
  productsUpdate,
  targetAudiencesGroup,
} from './core.js';
import { gscGroup } from './gsc.js';
import { integrationsGroup } from './integrations.js';
import { linkingGroup } from './linking.js';

export const PRODUCTS_HELP = `Usage:
  outrank-cli products list [--status active|disabled] [--limit <n>] [--cursor <iso-timestamp>]
  outrank-cli products get <product-id>
  outrank-cli products create --json <object>
  outrank-cli products update <product-id> --json <object>
  outrank-cli products pause <product-id>
  outrank-cli products resume <product-id>
  outrank-cli products integrations providers
  outrank-cli products integrations prepare <provider> <product-id> [--json <object>]
  outrank-cli products integrations connect <provider> <product-id> [--json <object>]
  outrank-cli products integrations poll <provider> <product-id> --attempt-id <attempt-id>
  outrank-cli products integrations notion databases <product-id> <integration-id>
  outrank-cli products integrations notion schema <product-id> <integration-id> <database-id>
  outrank-cli products integrations framer collections --json <object>
  outrank-cli products integrations framer fields --json <object>
  outrank-cli products integrations webflow sites --json <object>
  outrank-cli products integrations webflow collections --json <object>
  outrank-cli products integrations webflow fields --json <object>
  outrank-cli products integrations webflow items --json <object>
  outrank-cli products integrations validate <provider> --json <object>
  outrank-cli products integrations list <product-id>
  outrank-cli products integrations create <product-id> --json <object>
  outrank-cli products integrations get <product-id> <integration-id>
  outrank-cli products integrations update <product-id> <integration-id> --json <object>
  outrank-cli products integrations test <product-id> <integration-id>
  outrank-cli products integrations delete <product-id> <integration-id>
  outrank-cli products output-settings get <product-id>
  outrank-cli products output-settings update <product-id> --json <object>
  outrank-cli products target-audiences list <product-id>
  outrank-cli products target-audiences replace <product-id> --json <object>
  outrank-cli products competitors list <product-id>
  outrank-cli products competitors replace <product-id> --json <object>
  outrank-cli products gsc status <product-id>
  outrank-cli products gsc connect <product-id>
  outrank-cli products gsc poll <product-id> --attempt-id <attempt-id>
  outrank-cli products gsc reconnect <product-id>
  outrank-cli products gsc disconnect <product-id>
  outrank-cli products gsc accounts <product-id>
  outrank-cli products gsc properties <product-id> --email <email>
  outrank-cli products gsc set-property <product-id> --email <email> --site-url <url>
  outrank-cli products gsc performance <product-id> [--months <n>]
  outrank-cli products gsc search-analytics <product-id> [--dimensions <csv>] [--limit <n>] [--months <n>] [--start-date <yyyy-mm-dd>] [--end-date <yyyy-mm-dd>] [--page <text>] [--query <text>] [--country <cc>] [--device <device>]
  outrank-cli products gsc inspect-url <product-id> --url <url> [--language-code <code>]
  outrank-cli products gsc cannibalization <product-id>
  outrank-cli products linking sources get <product-id>
  outrank-cli products linking sources update <product-id> --json <object>
  outrank-cli products linking detect <product-id>
  outrank-cli products linking target-config get <product-id>
  outrank-cli products linking target-config update <product-id> --json <object>
  outrank-cli products linking targets list <product-id>
  outrank-cli products linking targets add-manual <product-id> --json <object>
  outrank-cli products linking targets upsert <product-id> --json <object>
  outrank-cli products linking targets clear-customizations <product-id> <target-id>
  outrank-cli products linking targets delete <product-id> <target-id>
  outrank-cli products backlinks get <product-id>
  outrank-cli products backlinks update <product-id> --json <object>
  outrank-cli products backlinks credits <product-id>
  outrank-cli products backlinks earned <product-id> [--limit <n>] [--cursor <iso>] [--status <status>] [--sort-by created_at|status|credits_applied] [--sort-order desc] [--include-article] [--include-summary]
  outrank-cli products backlinks unverified <product-id> [--limit <n>] [--cursor <iso>] [--status <status>] [--sort-by created_at|verification_error_reason] [--sort-order desc]
  outrank-cli products backlinks check-removal <product-id> <backlink-id>
  outrank-cli products backlinks reverify <product-id> <backlink-id>
  outrank-cli products backlinks subscription <product-id>
  outrank-cli products backlinks subscribe-quote <product-id> --plan premium|enterprise
  outrank-cli products blog get <product-id>
  outrank-cli products blog create <product-id> [--json <object>]
  outrank-cli products blog posts list <product-id>
  outrank-cli products blog --help   (design, domain, posts, pages, categories, authors, redirects, snippets, subscribers, webhooks)

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Examples:
  outrank-cli products list --limit 20
  outrank-cli products create --json-file product.json
  outrank-cli products update 00000000-0000-0000-0000-000000000000 --json '{"daily_article_count":2}'
  outrank-cli products integrations providers
  outrank-cli products integrations prepare wordpress-plugin 00000000-0000-0000-0000-000000000000
  outrank-cli products integrations connect wordpress-com 00000000-0000-0000-0000-000000000000 --json '{"name":"Main WordPress.com","publish_status":"publish"}'
  outrank-cli products integrations connect notion 00000000-0000-0000-0000-000000000000
  outrank-cli products integrations poll wordpress-com 00000000-0000-0000-0000-000000000000 --attempt-id <attempt-id>
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
  outrank-cli products integrations validate webflow --json '{"api_token":"wf_token"}'
  outrank-cli products integrations validate shopify --json '{"access_token":"shpat_xxx"}'
  outrank-cli products integrations validate wix --json '{"site_id":"00000000-0000-0000-0000-000000000000","api_key":"wix_api_key"}'
  outrank-cli products integrations validate wordpress-plugin --json '{"domain":"https://example.com","api_key":"secret-token"}'
  outrank-cli products integrations list 00000000-0000-0000-0000-000000000000
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"webhook","name":"Main Webhook","endpoint":"https://api.example.com/webhook","access_token":"secret"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"framer","name":"Main Framer","project_url":"https://framer.com/projects/your-project","server_api_key":"framer_server_key","author_name":"Outrank AI","publish_mode":"deploy","collection_setup_mode":"create"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"shopify","name":"Main Shopify","access_token":"shpat_xxx","blog_id":"123456789","author_name":"Outrank","publish_status":"publish"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"wix","name":"Main Wix","site_id":"00000000-0000-0000-0000-000000000000","api_key":"wix_api_key","publish_status":"publish"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json-file webflow-create.json
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"wordpress-plugin","domain":"https://example.com","api_key":"secret-token"}'
  outrank-cli products integrations create 00000000-0000-0000-0000-000000000000 --json '{"provider":"nextjs-blog"}'
  outrank-cli products integrations get 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"endpoint":"https://api.example.com/webhook-v2"}'
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"blog_id":"987654321","author_name":"Editorial Team","publish_status":"draft"}'
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"publish_status":"draft"}'
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json-file webflow-update.json
  outrank-cli products integrations update 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json '{"domain":"https://example.com/blog","api_key":"new-secret-token"}'
  outrank-cli products integrations test 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products output-settings update 00000000-0000-0000-0000-000000000000 --json-file output-settings.json
  outrank-cli products target-audiences replace 00000000-0000-0000-0000-000000000000 --json-file target-audiences.json
  outrank-cli products competitors replace 00000000-0000-0000-0000-000000000000 --json-file competitors.json
  outrank-cli products gsc connect 00000000-0000-0000-0000-000000000000
  outrank-cli products gsc properties 00000000-0000-0000-0000-000000000000 --email owner@example.com
  outrank-cli products gsc performance 00000000-0000-0000-0000-000000000000 --months 3
  outrank-cli products gsc inspect-url 00000000-0000-0000-0000-000000000000 --url https://example.com/blog/post
  outrank-cli products linking sources get 00000000-0000-0000-0000-000000000000
  outrank-cli products linking sources update 00000000-0000-0000-0000-000000000000 --json-file linking-sources.json
  outrank-cli products linking detect 00000000-0000-0000-0000-000000000000
  outrank-cli products linking target-config update 00000000-0000-0000-0000-000000000000 --json '{"only_prioritized":true}'
  outrank-cli products linking targets add-manual 00000000-0000-0000-0000-000000000000 --json-file manual-target.json
  outrank-cli products linking targets clear-customizations 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products backlinks get 00000000-0000-0000-0000-000000000000
  outrank-cli products backlinks update 00000000-0000-0000-0000-000000000000 --json '{"enabled":true,"min_domain_rating":10}'
  outrank-cli products backlinks credits 00000000-0000-0000-0000-000000000000
  outrank-cli products backlinks earned 00000000-0000-0000-0000-000000000000 --limit 20 --include-article
  outrank-cli products backlinks unverified 00000000-0000-0000-0000-000000000000 --limit 20
  outrank-cli products backlinks check-removal 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products backlinks reverify 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111
  outrank-cli products backlinks subscription 00000000-0000-0000-0000-000000000000
  outrank-cli products backlinks subscribe-quote 00000000-0000-0000-0000-000000000000 --plan premium
  outrank-cli products blog create 00000000-0000-0000-0000-000000000000 --json '{"subdomain":"acme","template":"editorial","accentColor":"#2563EB"}'
  outrank-cli products blog posts update-content 00000000-0000-0000-0000-000000000000 11111111-1111-1111-1111-111111111111 --json-file post.json
`;

export const productsGroup = defineGroup({
  id: 'products',
  help: {
    usage: PRODUCTS_HELP,
    guidance:
      'Choose one of: list, get, create, update, pause, resume, integrations, output-settings, target-audiences, ' +
      'competitors, gsc, linking, backlinks, blog.',
  },
  unknown: (word) => ({
    message: `Unknown products subcommand: ${word}.`,
    guidance: 'Run `outrank-cli products --help` to see available product commands.',
  }),
  children: [
    productsList,
    productsGet,
    productsCreate,
    productsUpdate,
    productsPause,
    productsResume,
    integrationsGroup,
    outputSettingsGroup,
    targetAudiencesGroup,
    competitorsGroup,
    gscGroup,
    linkingGroup,
    backlinksGroup,
    blogGroup,
  ],
});
