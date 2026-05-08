import { hasFlag, parseArgs } from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

export const USAGE_HELP = `Usage:
  outrank-cli usage stats

Commands:
  stats    Return current usage and quota metrics for articles, backlinks, free tools, and product slots.
`;

export const handleUsageCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: USAGE_HELP.trim(),
      },
      'Use `stats` to inspect current quota consumption and activity.',
    );
  }

  if (subcommand === 'stats') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: '/usage/stats',
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown usage subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli usage --help` to see available usage commands.',
  });
};
