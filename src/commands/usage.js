import { CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';

export const USAGE_HELP = `Usage:
  outrank-cli usage stats

Commands:
  stats    Return current usage and quota metrics for articles, backlinks, free tools, and product slots.
`;

export const usageGroup = defineGroup({
  id: 'usage',
  help: { usage: USAGE_HELP, guidance: 'Use `stats` to inspect current quota consumption and activity.' },
  unknown: (word) => ({
    message: `Unknown usage subcommand: ${word}.`,
    guidance: 'Run `outrank-cli usage --help` to see available usage commands.',
  }),
  children: [
    defineCommand({
      id: 'usage.stats',
      summary: 'Return current usage and quota metrics for articles, backlinks, free tools, and product slots.',
      kind: CommandKind.READ,
      toolsets: [Toolset.CORE],
      run: (_input, ctx) => ctx.http({ method: 'GET', path: '/usage/stats' }),
    }),
  ],
});
