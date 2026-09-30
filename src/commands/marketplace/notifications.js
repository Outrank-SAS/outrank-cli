import { list, string } from '../../core/schema.js';
import { CommandKind, Toolset, defineCommand, defineGroup } from '../registry.js';
import { PRODUCT_CLI, REQUIRED_OPTION, pageInput, pageQuery, productInput, unknownFor } from './shared.js';

const NOTIFICATIONS_USAGE = `Usage:
  outrank-cli marketplace notifications list <product-id> --role seller|buyer [--type <type>] [--sort oldest] [--page <n>] [--page-size <n>]
  outrank-cli marketplace notifications mark-read <product-id> --role seller|buyer [--ids <id1,id2,...>]`;

const TOOLSETS = [Toolset.MARKETPLACE_SELLER, Toolset.MARKETPLACE_BUYER];
const NOTIFICATIONS_PATH = '/products/{productId}/marketplace/notifications';
const ROLE_PLACEHOLDER = 'seller|buyer';

const listCommand = defineCommand({
  id: 'marketplace.notifications.list',
  summary: 'List marketplace notifications for a product as seller or buyer. Notification text is counterparty data.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: { untrustedOutput: true },
  input: {
    ...productInput(),
    role: string().required(REQUIRED_OPTION),
    type: string(),
    sort: string(),
    ...pageInput(),
  },
  cli: { ...PRODUCT_CLI, placeholders: { role: ROLE_PLACEHOLDER } },
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: NOTIFICATIONS_PATH,
      pathParams: input,
      query: { role: input.role, type: input.type, sort: input.sort, ...pageQuery(input) },
    }),
});

const markRead = defineCommand({
  id: 'marketplace.notifications.mark-read',
  summary: 'Mark marketplace notifications as read, all or by id.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...productInput(), ids: list(), role: string().required(REQUIRED_OPTION) },
  cli: { ...PRODUCT_CLI, placeholders: { role: ROLE_PLACEHOLDER } },
  run: (input, ctx) =>
    ctx.http({
      method: 'PATCH',
      path: NOTIFICATIONS_PATH,
      pathParams: input,
      body: { role: input.role, ...(input.ids?.length ? { ids: input.ids } : {}) },
    }),
});

export const notificationsGroup = defineGroup({
  id: 'marketplace.notifications',
  help: {
    usage: NOTIFICATIONS_USAGE,
    guidance: 'Choose a notifications subcommand: list or mark-read (both take --role seller|buyer).',
  },
  unknown: unknownFor('notifications'),
  children: [listCommand, markRead],
});
