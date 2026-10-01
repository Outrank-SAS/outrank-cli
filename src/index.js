#!/usr/bin/env node

import { emitAndExit } from './core/io.js';
import { cliSuccess, toErrorEnvelope, usageError } from './core/errors.js';
import { runRegistryCommand } from './adapters/cli/run.js';
import { MCP_COMMAND } from './adapters/mcp/constants.js';
import { MCP_HELP, MCP_HELP_GUIDANCE } from './adapters/mcp/help.js';
import { registry } from './commands/index.js';
import { getVersion } from './core/version.js';

const EXIT_FAILURE = 1;
const HELP_TOKENS = ['--help', '-h', 'help'];

const ROOT_HELP = `Outrank CLI

Agent-first CLI for Outrank's public agent API.

Usage:
  outrank-cli <group> <command> [options]
  outrank-cli <group> --help

Groups:
  auth        Store or verify API-key authentication.
  products    List, create, inspect, and configure products, integrations, article settings, Google Search Console, linking, and backlinks.
  keywords    Inspect, check write status, add, reschedule, delete, suggest, generate, and export keyword plans.
  articles    Inspect article metadata and bodies, edit content, retry publish, precreate, and generate.
  improvements Discover, brief, schedule, run, review, and publish article improvements for existing posts.
  marketplace Seller onboarding, eligibility, placements, earnings, Stripe payouts, and buyer setup for the Outrank Marketplace.
  subscription Inspect plan, trial, quota, and add-on status.
  usage       Inspect current usage and quota consumption.
  billing     Product-slot purchase flows.

MCP Server:
  outrank-cli mcp      Start the Outrank MCP server on stdio (see outrank-cli mcp --help).

Global Auth Options:
  --api-key <key>      Override the API key for this command only.
  --base-url <url>     Override the Outrank base URL for this command only.
  --profile <name>     Use a stored profile for this command only (see auth --help).

JSON Input Conventions:
  Complex write commands accept one of:
  --json '<object>'
  --json-file payload.json
  --json-stdin

Examples:
  outrank-cli auth login outr_live_xxx
  outrank-cli auth whoami
  outrank-cli products list --limit 20
  outrank-cli keywords list --product 00000000-0000-0000-0000-000000000000 --scope all
  outrank-cli articles list --product 00000000-0000-0000-0000-000000000000 --status published
  outrank-cli improvements candidates list 00000000-0000-0000-0000-000000000000 --type ctr_gap
  outrank-cli improvements tasks execute 00000000-0000-0000-0000-000000000000
  outrank-cli subscription status
  outrank-cli usage stats
  outrank-cli products create --json-file product.json
  outrank-cli billing portal-url
  outrank-cli products integrations list 00000000-0000-0000-0000-000000000000
  outrank-cli products output-settings update <product-id> --json-file output-settings.json
  outrank-cli products target-audiences replace <product-id> --json-file target-audiences.json
  outrank-cli products gsc connect <product-id>
  outrank-cli products gsc performance <product-id>
  outrank-cli products linking sources get <product-id>
  outrank-cli products backlinks get <product-id>
  outrank-cli products backlinks earned <product-id> --limit 20 --include-article
  outrank-cli billing purchase-products quote --additional-products 2
  outrank-cli marketplace seller status <product-id>
  outrank-cli marketplace seller onboard <product-id> --country US
  outrank-cli marketplace seller placements list <product-id> --status needs_approval
`;

const main = async () => {
  const argv = process.argv.slice(2);
  const first = argv[0];

  if (argv.length === 0 || first === '--help' || first === '-h' || first === 'help') {
    emitAndExit(
      cliSuccess(
        {
          usage: ROOT_HELP.trim(),
        },
        'Choose a command group, then run that group with --help for detailed usage.',
      ),
    );
    return;
  }

  if (first === '--version' || first === '-v' || first === 'version') {
    emitAndExit(
      cliSuccess(
        {
          version: getVersion(),
        },
        'Version returned.',
      ),
    );
    return;
  }

  if (first === MCP_COMMAND) {
    if (argv.slice(1).some((token) => HELP_TOKENS.includes(token))) {
      emitAndExit(cliSuccess({ usage: MCP_HELP.trim() }, MCP_HELP_GUIDANCE));
      return;
    }
    const { runMcpServer } = await import('./adapters/mcp/main.js');
    await runMcpServer(argv.slice(1), { input: process.stdin });
    return;
  }

  const registryOutcome = await runRegistryCommand(registry, argv);
  if (!registryOutcome) {
    throw usageError(
      `Unknown command group: ${argv[0]}.`,
      'Run `outrank-cli --help` to see the available top-level groups.',
    );
  }
  emitAndExit(registryOutcome.envelope, registryOutcome.exitCode);
};

main().catch((error) => {
  emitAndExit(toErrorEnvelope(error), EXIT_FAILURE);
});
