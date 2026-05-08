import { hasFlag, parseArgs } from '../core/args.js';
import { requestAgentApi } from '../core/api.js';
import { cliSuccess } from '../core/errors.js';

export const SUBSCRIPTION_HELP = `Usage:
  outrank-cli subscription status

Commands:
  status    Return the current subscription, plan, trial, quota, and add-on status.
`;

export const handleSubscriptionCommand = async (argv) => {
  const subcommand = argv[0];
  const parsed = parseArgs(argv.slice(1));
  const wantsHelp =
    !subcommand || subcommand === '--help' || subcommand === '-h' || subcommand === 'help' || hasFlag(parsed, 'help');

  if (wantsHelp) {
    return cliSuccess(
      {
        usage: SUBSCRIPTION_HELP.trim(),
      },
      'Use `status` to inspect the current plan, quota, trial, and add-on state.',
    );
  }

  if (subcommand === 'status') {
    const response = await requestAgentApi(parsed, {
      method: 'GET',
      path: '/subscription/status',
    });
    return response.payload;
  }

  throw Object.assign(new Error(`Unknown subscription subcommand: ${subcommand}.`), {
    cliCode: 'CLI_INVALID_USAGE',
    guidance: 'Run `outrank-cli subscription --help` to see available subscription commands.',
  });
};
