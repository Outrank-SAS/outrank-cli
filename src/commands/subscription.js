import { CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';

export const SUBSCRIPTION_HELP = `Usage:
  outrank-cli subscription status

Commands:
  status    Return the current subscription, plan, trial, quota, and add-on status.
`;

export const subscriptionGroup = defineGroup({
  id: 'subscription',
  help: {
    usage: SUBSCRIPTION_HELP,
    guidance: 'Use `status` to inspect the current plan, quota, trial, and add-on state.',
  },
  unknown: (word) => ({
    message: `Unknown subscription subcommand: ${word}.`,
    guidance: 'Run `outrank-cli subscription --help` to see available subscription commands.',
  }),
  children: [
    defineCommand({
      id: 'subscription.status',
      summary: 'Return the current subscription, plan, trial, quota, and add-on status.',
      kind: CommandKind.READ,
      toolsets: [Toolset.CORE],
      run: (_input, ctx) => ctx.http({ method: 'GET', path: '/subscription/status' }),
    }),
  ],
});
