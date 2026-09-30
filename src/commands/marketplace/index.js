import { defineGroup } from '../registry.js';
import { buyerGroup } from './buyer.js';
import { notificationsGroup } from './notifications.js';
import { sellerGroup } from './seller.js';
import { MARKETPLACE_UNKNOWN_GUIDANCE } from './shared.js';

export const MARKETPLACE_HELP = `Usage:
  outrank-cli marketplace seller status <product-id> [--refresh-stripe]
  outrank-cli marketplace seller onboard <product-id> [--country <ISO2>]
  outrank-cli marketplace seller eligibility <product-id> [--refresh]
  outrank-cli marketplace seller eligibility recheck <product-id>
  outrank-cli marketplace seller settings get <product-id>
  outrank-cli marketplace seller settings update <product-id> --json '<object>'
  outrank-cli marketplace seller integrations status <product-id>
  outrank-cli marketplace seller integrations adopt <product-id>
  outrank-cli marketplace seller integrations claim <product-id> --integration <integration-id> --type <platform>
  outrank-cli marketplace seller integrations set-activation <product-id> --integration <integration-id> --type <platform> --status active|disabled
  outrank-cli marketplace seller integrations delete <product-id> --integration <integration-id> --type <platform>
  outrank-cli marketplace seller stripe onboard <product-id> --country <ISO2>
  outrank-cli marketplace seller stripe manage <product-id>
  outrank-cli marketplace seller stripe reset <product-id>
  outrank-cli marketplace seller complete-onboarding <product-id>
  outrank-cli marketplace seller placements list <product-id> [--status all|needs_approval|planned|live|link_not_found|lost] [--search <text>] [--page <n>] [--page-size <n>]
  outrank-cli marketplace seller placements approve <placement-id>
  outrank-cli marketplace seller placements decline <placement-id>
  outrank-cli marketplace seller placements publish <placement-id>
  outrank-cli marketplace seller placements regenerate <placement-id>
  outrank-cli marketplace seller earnings <product-id>
  outrank-cli marketplace seller content-history <product-id> [--status <status>] [--limit <n>] [--offset <n>]
  outrank-cli marketplace notifications list <product-id> --role seller|buyer [--type <type>] [--sort oldest] [--page <n>] [--page-size <n>]
  outrank-cli marketplace notifications mark-read <product-id> --role seller|buyer [--ids <id1,id2,...>]

  outrank-cli marketplace buyer status <product-id>
  outrank-cli marketplace buyer billing-status <product-id>
  outrank-cli marketplace buyer subscription <product-id>
  outrank-cli marketplace buyer subscribe-quote <product-id>
  outrank-cli marketplace buyer checkout <product-id> --tier <tier>
  outrank-cli marketplace buyer change-plan <product-id> --action change_tier|cancel_scheduled|cancel_subscription|restore_subscription [--tier <tier>]
  outrank-cli marketplace buyer target-pages list <product-id>
  outrank-cli marketplace buyer target-pages add <product-id> --urls <url1,url2,...> [--source manual|discovered]
  outrank-cli marketplace buyer target-pages discover <product-id> [--source sitemap|root_url|integration] [--source-url <url>]
  outrank-cli marketplace buyer target-pages pause <target-page-id>
  outrank-cli marketplace buyer target-pages activate <target-page-id>
  outrank-cli marketplace buyer target-pages delete <target-page-id>
  outrank-cli marketplace buyer participation on <product-id>
  outrank-cli marketplace buyer participation off <product-id>
  outrank-cli marketplace buyer placements list <product-id> [--status all|live|in_progress|lost|rejected] [--search <text>] [--page <n>] [--page-size <n>]
  outrank-cli marketplace buyer placements regenerate <placement-id>
  outrank-cli marketplace buyer placements revalidate <placement-id>
  outrank-cli marketplace buyer article get <placement-id>
  outrank-cli marketplace buyer article edit <placement-id> --json '<object>'
  outrank-cli marketplace buyer credits history <product-id> [--kind all|charge|refund] [--page <n>] [--page-size <n>]

Notes:
  Seller onboarding wizard order: Blog (content details + Google Search Console) -> Articles (article settings + publishing schedule) -> Integration (marketplace CMS) -> Payouts (Stripe Express).
  \`seller onboard\` reports every remaining step, auto-adopts an existing reusable CMS without asking, and creates the Stripe Express account when the earlier steps are done and --country is provided.
  Admin-only commands (need an API key created by an org admin who still holds that role): settings update, all integrations writes, all stripe commands, complete-onboarding, placements decline, and buyer checkout/change-plan/participation. Buyer target-page writes are open to every org member.
  The mandatory buyer sequence: Enterprise backlink plan (subscribe-quote -> a human org admin completes checkout) -> add target pages -> participation on.
  Purchasing the Enterprise backlink plan is admin-only and happens through interactive Stripe checkout — surface subscription_management_url to the human.

Examples:
  outrank-cli marketplace seller status 00000000-0000-0000-0000-000000000000
  outrank-cli marketplace seller onboard 00000000-0000-0000-0000-000000000000 --country US
  outrank-cli marketplace seller settings update 00000000-0000-0000-0000-000000000000 --json '{"dailyArticleLimit":2,"publishingDays":[1,3,5]}'
  outrank-cli marketplace seller placements list 00000000-0000-0000-0000-000000000000 --status needs_approval
  outrank-cli marketplace seller placements approve 00000000-0000-0000-0000-000000000000
  outrank-cli marketplace notifications list 00000000-0000-0000-0000-000000000000 --role seller
  outrank-cli marketplace buyer status 00000000-0000-0000-0000-000000000000
  outrank-cli marketplace buyer target-pages add 00000000-0000-0000-0000-000000000000 --urls https://example.com/pricing,https://example.com/features
`;

export const marketplaceGroup = defineGroup({
  id: 'marketplace',
  help: {
    usage: MARKETPLACE_HELP,
    guidance:
      'Choose `seller`, `buyer`, or `notifications`. Sellers earn by hosting marketplace backlinks in their ' +
      'articles; buyers spend backlink credits to place links on high-authority articles. Start buyers with ' +
      '`marketplace buyer status` and sellers with `marketplace seller status`.',
  },
  unknown: (word) => ({ message: `Unknown marketplace subcommand: ${word}.`, guidance: MARKETPLACE_UNKNOWN_GUIDANCE }),
  children: [sellerGroup, buyerGroup, notificationsGroup],
});
