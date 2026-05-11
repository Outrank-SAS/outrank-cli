#!/usr/bin/env node

import { readFileSync } from 'node:fs';

import { parseArgs } from './core/args.js';
import { emitAndExit } from './core/io.js';
import { cliError, cliSuccess } from './core/errors.js';
import { handleAuthCommand } from './commands/auth.js';
import { handleProductsCommand } from './commands/products.js';
import { handleBillingCommand } from './commands/billing.js';
import { handleSubscriptionCommand } from './commands/subscription.js';
import { handleUsageCommand } from './commands/usage.js';
import { handleKeywordsCommand } from './commands/keywords.js';
import { handleArticlesCommand } from './commands/articles.js';

const getVersion = () => {
  try {
    const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
};

const ROOT_HELP = `Outrank CLI

Agent-first CLI for Outrank's public agent API.

Usage:
  outrank-cli <group> <command> [options]
  outrank-cli <group> --help

Groups:
  auth        Store or verify API-key authentication.
  products    List, create, inspect, and configure products, article settings, and Google Search Console.
  keywords    Inspect, check write status, add, reschedule, delete, suggest, generate, and export keyword plans.
  articles    Inspect article metadata and bodies, edit content, retry publish, precreate, and generate.
  subscription Inspect plan, trial, quota, and add-on status.
  usage       Inspect current usage and quota consumption.
  billing     Product-slot purchase flows.

Global Auth Options:
  --api-key <key>      Override the API key for this command only.
  --base-url <url>     Override the Outrank base URL for this command only.

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
  outrank-cli subscription status
  outrank-cli usage stats
  outrank-cli products create --json-file product.json
  outrank-cli billing portal-url
  outrank-cli products output-settings update <product-id> --json-file output-settings.json
  outrank-cli products target-audiences replace <product-id> --json-file target-audiences.json
  outrank-cli products gsc connect <product-id>
  outrank-cli products gsc performance <product-id>
  outrank-cli billing purchase-products quote --additional-products 2
`;

const main = async () => {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
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

  const group = argv[0];
  const rest = argv.slice(1);

  let result;
  if (group === 'auth') {
    result = await handleAuthCommand(rest);
  } else if (group === 'products') {
    result = await handleProductsCommand(rest);
  } else if (group === 'keywords') {
    result = await handleKeywordsCommand(rest);
  } else if (group === 'articles') {
    result = await handleArticlesCommand(rest);
  } else if (group === 'subscription') {
    result = await handleSubscriptionCommand(rest);
  } else if (group === 'usage') {
    result = await handleUsageCommand(rest);
  } else if (group === 'billing') {
    result = await handleBillingCommand(rest);
  } else {
    throw Object.assign(new Error(`Unknown command group: ${group}.`), {
      cliCode: 'CLI_INVALID_USAGE',
      guidance: 'Run `outrank-cli --help` to see the available top-level groups.',
    });
  }

  emitAndExit(result, result?.ok === false ? 1 : 0);
};

main().catch((error) => {
  const message = error?.message || 'Unexpected CLI failure.';
  const code = error?.cliCode || 'CLI_UNEXPECTED_ERROR';
  const guidance =
    error?.guidance ||
    'Retry with --help for usage details. If the command and inputs look correct, inspect the error details and try again.';

  emitAndExit(cliError(code, message, guidance), 1);
});
