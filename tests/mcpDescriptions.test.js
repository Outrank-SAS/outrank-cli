import assert from 'node:assert/strict';
import test from 'node:test';

import { describeTool, toolAnnotations } from '../src/adapters/mcp/descriptions.js';
import { CommandKind } from '../src/commands/registry.js';
import { registry } from '../src/commands/index.js';

const MODEL_DIRECTIVES =
  /\b(always call|never call|never guess|never invent|never repeat|confirm with|ask the user|tell the user|get the (user|human)|have the user|relay the|treat it as|start here|read it first|call only|do not call|check the site)\b/i;

const mcpSpecs = () => registry.commands.filter((spec) => spec.mcp);

test('tool descriptions describe the tool and do not instruct the model', () => {
  const offenders = mcpSpecs()
    .map((spec) => ({ id: spec.id, match: describeTool(spec).match(MODEL_DIRECTIVES)?.[0] }))
    .filter(({ match }) => match);
  assert.deepEqual(offenders, []);
});

test('destructive and paid tools keep the destructive annotation', () => {
  const guarded = mcpSpecs().filter(
    (spec) => spec.kind === CommandKind.DESTRUCTIVE || spec.kind === CommandKind.MONEY,
  );
  assert.ok(guarded.length > 0);
  for (const spec of guarded) assert.equal(toolAnnotations(spec).destructiveHint, true, spec.id);
});
