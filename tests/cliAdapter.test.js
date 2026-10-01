import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runRegistryCommand } from '../src/adapters/cli/run.js';
import {
  BodyMode,
  CommandKind,
  Toolset,
  createRegistry,
  defineCommand,
  defineGroup,
} from '../src/commands/registry.js';
import { CliErrorCode } from '../src/core/errors.js';
import { bool, int, string, uuid } from '../src/core/schema.js';

const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const STUB_KEY = 'outr_live_adapter_test_key';
const LIST_MIN_LIMIT = 1;
const LIST_MAX_LIMIT = 100;
const HELP = { usage: 'Usage:\n  outrank-cli x list <product-id> [--limit <n>]\n', guidance: 'Choose list.' };

const echo = (input, ctx) => ({
  ok: true,
  data: { input, apiKeyPresent: Boolean(ctx.apiKey), baseUrl: ctx.baseUrl, profile: ctx.profile.name },
  agent_guidance: 'echo',
});

const registry = createRegistry([
  defineGroup({
    id: 'x',
    help: HELP,
    unknown: (word) => ({ message: `Unknown x subcommand: ${word}.`, guidance: 'Run x --help.' }),
    children: [
      defineCommand({
        id: 'x.list',
        summary: 'List.',
        kind: CommandKind.READ,
        toolsets: [Toolset.CORE],
        input: {
          productId: uuid().required(),
          limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
          offset: int({ min: 0 }),
          status: string().required(),
          refreshStripe: bool(),
        },
        cli: { positionals: ['productId'], options: { 'refresh-stripe': 'refreshStripe' } },
        run: echo,
      }),
      defineCommand({
        id: 'x.broken',
        summary: 'Returns nothing.',
        kind: CommandKind.READ,
        toolsets: [Toolset.CORE],
        run: async () => undefined,
      }),
      defineCommand({
        id: 'x.create',
        summary: 'Create with a JSON body.',
        kind: CommandKind.WRITE,
        toolsets: [Toolset.CORE],
        body: BodyMode.JSON,
        run: echo,
      }),
      defineGroup({
        id: 'x.eligibility',
        help: { usage: 'Usage: x eligibility <product-id>', guidance: 'eligibility' },
        unknown: (word) => ({ message: `Unknown eligibility action: ${word}.`, guidance: 'g' }),
        command: {
          summary: 'Eligibility.',
          kind: CommandKind.READ,
          toolsets: [Toolset.CORE],
          input: { productId: uuid().required() },
          cli: { positionals: ['productId'] },
          run: echo,
        },
        children: [
          defineCommand({
            id: 'x.eligibility.recheck',
            summary: 'Recheck.',
            kind: CommandKind.WRITE,
            toolsets: [Toolset.CORE],
            input: { productId: uuid().required() },
            cli: { positionals: ['productId'] },
            run: echo,
          }),
        ],
      }),
    ],
  }),
]);

let configDir;
const savedEnv = {};

test.before(async () => {
  configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outrank-cli-adapter-'));
  for (const name of Object.keys(process.env)) {
    if (name.startsWith('OUTRANK_')) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
  }
  process.env.OUTRANK_CONFIG_DIR = configDir;
  process.env.OUTRANK_API_KEY = STUB_KEY;
});

test.after(async () => {
  delete process.env.OUTRANK_CONFIG_DIR;
  delete process.env.OUTRANK_API_KEY;
  Object.assign(process.env, savedEnv);
  await fs.rm(configDir, { recursive: true, force: true });
});

const run = (argv) => runRegistryCommand(registry, argv);

const expectUsageError = async (argv, messagePattern) => {
  const outcome = await run(argv);
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.envelope.error.code, CliErrorCode.INVALID_USAGE);
  assert.match(outcome.envelope.error.message, messagePattern);
  return outcome;
};

test('an unknown group is not handled by the registry, so the legacy router can take it', async () => {
  assert.equal(await run(['nope', 'list']), null);
});

test('an unknown option is CLI_INVALID_USAGE naming the option instead of being ignored', async () => {
  await expectUsageError(['x', 'list', PRODUCT_ID, '--status', 'a', '--limt', '5'], /Unknown option: --limt\./);
});

test('a value option followed by another option is a missing value, not a silent flag', async () => {
  await expectUsageError(['x', 'list', PRODUCT_ID, '--status', '--limit', '5'], /Missing value for --status\./);
});

test('an empty --option= is a missing value error, never 0', async () => {
  await expectUsageError(['x', 'list', PRODUCT_ID, '--status', 'a', '--offset='], /--offset requires a value\./);
  await expectUsageError(['x', 'list', PRODUCT_ID, '--status', 'a', '--limit='], /--limit requires a value\./);
});

test('a flag does not swallow the positional that follows it', async () => {
  const outcome = await run(['x', 'list', '--refresh-stripe', PRODUCT_ID, '--status', 'a']);
  assert.equal(outcome.exitCode, 0);
  assert.deepEqual(outcome.envelope.data.input, { productId: PRODUCT_ID, status: 'a', refreshStripe: true });
});

test('validation order: a missing positional is reported before a missing required option', async () => {
  await expectUsageError(['x', 'list'], /Missing required argument: <product-id>\./);
  await expectUsageError(['x', 'list', PRODUCT_ID], /Missing required option: --status\./);
  await expectUsageError(['x', 'list', 'not-a-uuid', '--status', 'a'], /<product-id> must be a UUID\./);
});

test('integer bounds use the CLI option label at the limit and just past it', async () => {
  const atMax = await run(['x', 'list', PRODUCT_ID, '--status', 'a', '--limit', String(LIST_MAX_LIMIT)]);
  assert.equal(atMax.envelope.data.input.limit, LIST_MAX_LIMIT);
  await expectUsageError(
    ['x', 'list', PRODUCT_ID, '--status', 'a', '--limit', String(LIST_MAX_LIMIT + 1)],
    /--limit must be <= 100\./,
  );
});

test('help is answered before validation for the group, a leaf, and any position of the token', async () => {
  const expected = { ok: true, data: { usage: HELP.usage.trim() }, agent_guidance: HELP.guidance };
  assert.deepEqual((await run(['x'])).envelope, expected);
  assert.deepEqual((await run(['x', '--help'])).envelope, expected);
  assert.deepEqual((await run(['x', 'help'])).envelope, expected);
  assert.deepEqual((await run(['x', 'list', '--help'])).envelope, expected);
  assert.deepEqual((await run(['x', 'list', PRODUCT_ID, '-h'])).envelope, expected);
  assert.deepEqual((await run(['x', 'nonsense', '--help'])).envelope, expected);
});

test('an unknown subcommand uses the group wording', async () => {
  const outcome = await expectUsageError(['x', 'nonsense'], /Unknown x subcommand: nonsense\./);
  assert.equal(outcome.envelope.agent_guidance, 'Run x --help.');
});

test('a group-and-command node runs itself for a positional and dispatches to a child by word', async () => {
  const own = await run(['x', 'eligibility', PRODUCT_ID]);
  assert.deepEqual(own.envelope.data.input, { productId: PRODUCT_ID });
  const child = await run(['x', 'eligibility', 'recheck', PRODUCT_ID]);
  assert.deepEqual(child.envelope.data.input, { productId: PRODUCT_ID });
  await expectUsageError(['x', 'eligibility'], /Missing required argument: <product-id>\./);
});

test('a handler that returns nothing is CLI_UNEXPECTED_ERROR with exit 1, not "undefined" with exit 0', async () => {
  const outcome = await run(['x', 'broken']);
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.envelope.error.code, CliErrorCode.UNEXPECTED_ERROR);
  assert.match(outcome.envelope.error.message, /x\.broken returned no result envelope/);
});

test('global options reach the context and --api-key beats the environment key', async () => {
  const outcome = await run(['x', 'list', PRODUCT_ID, '--status', 'a', '--api-key', 'outr_live_flag_key']);
  assert.equal(outcome.envelope.data.apiKeyPresent, true);
  assert.equal(outcome.envelope.data.baseUrl, 'https://www.outrank.so');
  const badUrl = await run(['x', 'list', PRODUCT_ID, '--status', 'a', '--base-url', 'not a url']);
  assert.equal(badUrl.envelope.error.code, CliErrorCode.INVALID_USAGE);
  assert.match(badUrl.envelope.error.message, /Invalid base URL/);
});

test('JSON body commands require exactly one source and keep the wording for each failure', async () => {
  await expectUsageError(['x', 'create'], /Provide one of: --json, --json-file, or --json-stdin\./);
  await expectUsageError(['x', 'create', '--json', '{}', '--json-file', 'a.json'], /Use only one JSON input source/);
  await expectUsageError(['x', 'create', '--json', '{not json'], /Invalid JSON in --json: /);
  const outcome = await run(['x', 'create', '--json', '{"name":"n"}']);
  assert.deepEqual(outcome.envelope.data.input, { body: { name: 'n' } });
});

test('a single-value option given twice is CLI_INVALID_USAGE, a list option accumulates', async () => {
  await expectUsageError(
    ['x', 'list', PRODUCT_ID, '--status', 'a', '--status', 'b'],
    /--status was given more than once\./,
  );
  await expectUsageError(
    ['x', 'list', PRODUCT_ID, '--status', 'a', '--api-key', STUB_KEY, '--api-key', STUB_KEY],
    /--api-key was given more than once\./,
  );
});

test('an empty --json or --json-file value is a missing value, not a missing source', async () => {
  await expectUsageError(['x', 'create', '--json', ''], /--json requires a value\./);
  await expectUsageError(['x', 'create', '--json-file='], /--json-file requires a value\./);
});

test('help is not triggered by an option value that happens to be the word help', async () => {
  const outcome = await run(['x', 'list', PRODUCT_ID, '--status', 'help']);
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.envelope.data.input.status, 'help');
});

test('--profile selects a stored profile and its base URL even though OUTRANK_API_KEY is exported', async () => {
  const configPath = path.join(configDir, 'config.json');
  await fs.writeFile(
    configPath,
    JSON.stringify({
      defaultProfile: 'default',
      profiles: {
        default: { apiKey: STUB_KEY },
        acme: { apiKey: 'outr_live_acme_key', baseUrl: 'https://outrank.so' },
      },
    }),
    'utf8',
  );
  try {
    const outcome = await run(['x', 'list', PRODUCT_ID, '--status', 'a', '--profile', 'acme']);
    assert.equal(outcome.exitCode, 0);
    assert.equal(outcome.envelope.data.profile, 'acme');
    assert.equal(outcome.envelope.data.baseUrl, 'https://outrank.so');
    const unknown = await expectUsageError(
      ['x', 'list', PRODUCT_ID, '--status', 'a', '--profile', 'nope'],
      /Unknown profile: nope/,
    );
    assert.match(unknown.envelope.agent_guidance, /Stored profiles: acme, default/);
    await expectUsageError(
      ['x', 'list', PRODUCT_ID, '--status', 'a', '--profile='],
      /--profile was given without a value/,
    );
    await expectUsageError(
      ['x', 'list', PRODUCT_ID, '--status', 'a', '--profile', 'acme', '--profile', 'default'],
      /--profile was given more than once/,
    );
  } finally {
    await fs.rm(configPath, { force: true });
  }
});

test('a corrupt config file is CLI_CONFIG_UNREADABLE with the path in details, not a silent empty config', async () => {
  const configPath = path.join(configDir, 'config.json');
  await fs.writeFile(configPath, '{corrupt', 'utf8');
  try {
    const outcome = await run(['x', 'list', PRODUCT_ID, '--status', 'a']);
    assert.equal(outcome.exitCode, 1);
    assert.equal(outcome.envelope.error.code, CliErrorCode.CONFIG_UNREADABLE);
    assert.equal(outcome.envelope.error.details.config_path, configPath);
  } finally {
    await fs.rm(configPath, { force: true });
  }
});

test('--allow-custom-base-url=false keeps the allowlist on; only =true or the bare flag turn it off', async () => {
  const evil = ['x', 'list', PRODUCT_ID, '--status', 'a', '--base-url', 'https://evil.example'];
  await expectUsageError([...evil, '--allow-custom-base-url=false'], /evil\.example is not allowed/);
  await expectUsageError(evil, /evil\.example is not allowed/);
  const explicit = await run([...evil, '--allow-custom-base-url=true']);
  assert.equal(explicit.envelope.data.baseUrl, 'https://evil.example');
  const bare = await run([...evil, '--allow-custom-base-url']);
  assert.equal(bare.envelope.data.baseUrl, 'https://evil.example');
});

test('a key pasted where an argument or option value belongs is redacted from the error envelope', async () => {
  const pasted = 'outr_live_pasted_by_mistake';
  const surplus = await expectUsageError(['x', 'list', PRODUCT_ID, '--status', 'a', pasted], /Unexpected argument/);
  assert.equal(surplus.envelope.error.message, 'Unexpected argument: <redacted>.');
  const badUrl = await expectUsageError(
    ['x', 'list', PRODUCT_ID, '--status', 'a', '--base-url', pasted],
    /Invalid base URL/,
  );
  assert.doesNotMatch(JSON.stringify(badUrl.envelope), /pasted_by_mistake/);
});
