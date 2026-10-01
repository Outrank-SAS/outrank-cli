import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BodyMode,
  CommandKind,
  Toolset,
  assertEnvelope,
  createRegistry,
  defineCommand,
  defineGroup,
  toolName,
} from '../src/commands/registry.js';
import { CliErrorCode } from '../src/core/errors.js';
import { uuid } from '../src/core/schema.js';

const OK = { ok: true, data: null, agent_guidance: 'done' };
const HELP = { usage: 'Usage: x', guidance: 'g' };
const UNKNOWN = (word) => ({ message: `Unknown x subcommand: ${word}.`, guidance: 'g' });

const command = (overrides = {}) =>
  defineCommand({
    id: 'x.run',
    summary: 'Run x.',
    kind: CommandKind.READ,
    toolsets: [Toolset.CORE],
    run: async () => OK,
    ...overrides,
  });

const group = (children, overrides = {}) =>
  defineGroup({ id: 'x', help: HELP, unknown: UNKNOWN, children, ...overrides });

const throwsRegistry = (groups, pattern) => assert.throws(() => createRegistry(groups), pattern);

test('a valid registry exposes commands by id and derives MCP tool names', () => {
  const registry = createRegistry([group([command()])]);
  assert.equal(registry.commands.length, 1);
  assert.equal(registry.byId.get('x.run').summary, 'Run x.');
  assert.equal(toolName('products.output-settings.update'), 'products_output_settings_update');
});

test('load-time validation rejects duplicate ids, foreign nesting, unknown kinds and toolsets', () => {
  throwsRegistry([group([command(), command()])], /duplicate/);
  throwsRegistry([group([command({ id: 'y.run' })])], /must be nested under x/);
  throwsRegistry([group([command({ kind: 'delete' })])], /unknown kind delete/);
  throwsRegistry([group([command({ toolsets: ['everything'] })])], /unknown toolset everything/);
  throwsRegistry([group([command({ toolsets: [] })])], /toolsets must be a non-empty array/);
});

test('every leaf needs a run function, a summary, a valid body mode and declared positionals', () => {
  throwsRegistry([group([command({ run: undefined })])], /run must be a function/);
  throwsRegistry([group([command({ summary: '' })])], /summary is required/);
  throwsRegistry([group([command({ body: 'form' })])], /body must be a BodyMode or a fixed object/);
  throwsRegistry([group([command({ cli: { positionals: ['productId'] } })])], /positional productId is not an input/);
  throwsRegistry([group([command({ input: { productId: 'uuid' } })])], /input productId is not a field/);
  throwsRegistry([group([command({ bodyMerge: { product_id: 'productId' } })])], /bodyMerge requires body: json/);
  throwsRegistry([group([command({ longRunning: {} })])], /longRunning needs a pollTool id/);
  throwsRegistry([group([command({ longRunning: { pollTool: 'x.status' } })])], /pollTool x.status is not a command/);
  throwsRegistry([group([command({ allowUnknownProfile: 'yes' })])], /offline and allowUnknownProfile must be booleans/);
  throwsRegistry([group([command({ offline: 1 })])], /offline and allowUnknownProfile must be booleans/);
  assert.equal(createRegistry([group([command()])]).commands[0].allowUnknownProfile, false);
  const valid = createRegistry([
    group([
      command({
        input: { productId: uuid().required() },
        cli: { positionals: ['productId'] },
        body: BodyMode.JSON,
        bodyMerge: { product_id: 'productId' },
        longRunning: { pollTool: 'x.status' },
      }),
      command({ id: 'x.status' }),
    ]),
  ]);
  assert.equal(valid.commands.length, 2);
});

test('a group needs help text and may carry its own command as a group-and-command node', () => {
  throwsRegistry([group([command()], { help: undefined })], /group help is required/);
  const registry = createRegistry([
    group([command()], {
      command: { summary: 'Group itself.', run: async () => OK, kind: CommandKind.READ, toolsets: [Toolset.CORE] },
    }),
  ]);
  assert.deepEqual(
    registry.commands.map((node) => node.id),
    ['x', 'x.run'],
  );
  assert.equal(registry.byId.get('x').summary, 'Group itself.');
});

test('a run result that is not an envelope is CLI_UNEXPECTED_ERROR, never printed as undefined', () => {
  const node = command();
  assert.throws(
    () => assertEnvelope(node, undefined),
    (error) => {
      assert.equal(error.cliCode, CliErrorCode.UNEXPECTED_ERROR);
      assert.match(error.message, /x\.run returned no result envelope/);
      return true;
    },
  );
  assert.throws(() => assertEnvelope(node, { data: 1 }), /returned no result envelope/);
  assert.deepEqual(assertEnvelope(node, OK), OK);
});
