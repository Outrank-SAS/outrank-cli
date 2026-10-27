import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describeTool } from '../src/adapters/mcp/descriptions.js';
import { TOOL_NOTES } from '../src/adapters/mcp/toolNotes.js';
import { registry } from '../src/commands/index.js';
import { BODY_INPUT_NAME, CommandKind } from '../src/commands/registry.js';
import { MAX_IMAGE_UPLOAD_BYTES } from '../src/core/constants.js';
import { CliErrorCode } from '../src/core/errors.js';
import { bool, int, list, object, oneOf, string, toZodSchema, uuid, validateInput } from '../src/core/schema.js';
import { withMcp } from './helpers/mcpHarness.js';

const TOOL_NOTE_KEYS = ['note', 'fields', 'body', 'moneyWarning'];
const TOP_UP_CONSENT_CONFIRM_ID = 'ai-cited-lists.top-up-consent.confirm';
const GENERIC_MONEY_WARNING_MARK = 'exact plan and amount';

const VALID_UUID = 'aaaaaaaa-0000-4000-8000-000000000001';
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_BYTES = Buffer.from([...PNG_HEADER, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const OVERSIZE_BYTES = MAX_IMAGE_UPLOAD_BYTES + 1;
const ALL_TOOLSETS = ['--toolsets', 'all'];
const UNC_PATH = ['', '', 'localhost', 'no-such-share', 'a.png'].join(path.win32.sep);

const FIELD_CASES = [
  { field: string().required(), accept: ['text'], reject: ['', 5, true, ['a'], {}] },
  { field: uuid().required(), accept: [VALID_UUID], reject: ['../articles/x', 'not-a-uuid', '', 7] },
  {
    field: int({ min: MIN_LIMIT, max: MAX_LIMIT }).required(),
    accept: [MIN_LIMIT, MAX_LIMIT],
    reject: [MIN_LIMIT - 1, MAX_LIMIT + 1, 5.5, true, {}],
  },
  { field: bool().required(), accept: [true, false], reject: ['yes', 1, {}] },
  { field: oneOf(['premium', 'enterprise']).required(), accept: ['premium', 'enterprise'], reject: ['basic', '', 3] },
  { field: list().required(), accept: [['a'], ['a', 'b']], reject: [[], [5], [{}]] },
  { field: object().required(), accept: [{}, { name: 'x' }], reject: ['{}', 5, ['a'], true] },
];

const accepts = (run) => {
  try {
    run();
    return true;
  } catch {
    return false;
  }
};

test('the CLI validator and the generated zod schema accept and reject the same typed values', async () => {
  for (const { field, accept, reject } of FIELD_CASES) {
    const fields = { value: field };
    const schema = await toZodSchema(fields);
    for (const value of accept) {
      assert.equal(accepts(() => validateInput(fields, { value }, { splitLists: false })), true, `validator: ${value}`);
      assert.equal(schema.safeParse({ value }).success, true, `zod ${field.kind}: ${JSON.stringify(value)}`);
    }
    for (const value of reject) {
      assert.equal(
        accepts(() => validateInput(fields, { value }, { splitLists: false })),
        false,
        `validator ${field.kind}: ${JSON.stringify(value)}`,
      );
      assert.equal(schema.safeParse({ value }).success, false, `zod ${field.kind}: ${JSON.stringify(value)}`);
    }
  }
});

test('both validators treat a missing required value as an error and a missing optional value as fine', async () => {
  const required = { value: string().required() };
  const optional = { value: string() };
  assert.equal(accepts(() => validateInput(required, {})), false);
  assert.equal((await toZodSchema(required)).safeParse({}).success, false);
  assert.equal(accepts(() => validateInput(optional, {})), true);
  assert.equal((await toZodSchema(optional)).safeParse({}).success, true);
});

test('argv text forms are a CLI convenience that the MCP schema does not accept', async () => {
  const fields = { limit: int({ min: MIN_LIMIT, max: MAX_LIMIT }), flag: bool() };
  const schema = await toZodSchema(fields);
  assert.deepEqual(validateInput(fields, { limit: '25', flag: 'true' }), { limit: 25, flag: true });
  assert.equal(schema.safeParse({ limit: '25' }).success, false);
  assert.equal(schema.safeParse({ flag: 'true' }).success, false);
});

test('every tool note points at a real tool, a real argument and a real body', () => {
  for (const [id, note] of Object.entries(TOOL_NOTES)) {
    const spec = registry.byId.get(id);
    assert.ok(spec, `tool note for unknown command ${id}`);
    assert.notEqual(spec.mcp, false, `tool note for a CLI-only command ${id}`);
    for (const key of Object.keys(note)) assert.ok(TOOL_NOTE_KEYS.includes(key), `${id}: unknown tool note key ${key}`);
    if (note.moneyWarning !== undefined) {
      assert.equal(spec.kind, CommandKind.MONEY, `${id}: moneyWarning on a tool that is not a money tool`);
    }
    for (const fieldName of Object.keys(note.fields ?? {})) {
      assert.ok(Object.hasOwn(spec.input, fieldName), `${id}: note for unknown argument ${fieldName}`);
      assert.notEqual(fieldName, BODY_INPUT_NAME, `${id}: describe the body with the body note`);
    }
    if (note.body !== undefined) {
      assert.ok(Object.hasOwn(spec.input, BODY_INPUT_NAME), `${id}: body note on a tool without a body`);
    }
  }
});

test('a money tool with its own warning describes that warning instead of the generic one', () => {
  const spec = registry.byId.get(TOP_UP_CONSENT_CONFIRM_ID);
  const description = describeTool(spec);
  assert.equal(spec.kind, CommandKind.MONEY);
  assert.ok(description.includes(TOOL_NOTES[TOP_UP_CONSENT_CONFIRM_ID].moneyWarning));
  assert.equal(description.includes(GENERIC_MONEY_WARNING_MARK), false);
});

test('every tool that takes a body says which fields it accepts', () => {
  const undocumented = registry.commands
    .filter((spec) => spec.mcp !== false && Object.hasOwn(spec.input, BODY_INPUT_NAME))
    .filter((spec) => !TOOL_NOTES[spec.id]?.body)
    .map((spec) => spec.id);
  assert.deepEqual(undocumented, []);
});

test('the generated input schema is a strict JSON object schema with typed, described arguments', async () => {
  await withMcp({ argv: ALL_TOOLSETS }, async ({ client }) => {
    const { tools } = await client.listTools();
    const schemaOf = (name) => tools.find((tool) => tool.name === name).inputSchema;
    const list = schemaOf('keywords_list');
    assert.deepEqual(list.required, ['product_id']);
    assert.deepEqual(list.properties.product_id, {
      type: 'string',
      format: 'uuid',
      description: 'Product id (UUID) from products_list.',
    });
    assert.deepEqual(list.properties.limit, { type: 'integer', minimum: 1, maximum: 100, description: 'Page size.' });
    assert.deepEqual(list.properties.search_volume_min, { type: 'integer', minimum: 0 });
    const quote = schemaOf('products_backlinks_subscribe_quote');
    assert.deepEqual(quote.properties.plan.enum, ['premium', 'enterprise']);
    const add = schemaOf('marketplace_buyer_target_pages_add');
    assert.equal(add.properties.urls.type, 'array');
    assert.equal(add.properties.urls.minItems, 1);
    const update = schemaOf('products_update');
    assert.equal(update.properties.body.type, 'object');
    assert.deepEqual(update.required, ['product_id', 'body']);
    const push = schemaOf('improvements_executions_push');
    assert.deepEqual(push.required, ['execution_id']);
  });
});

const withUploadDir = async (run) => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'outrank-mcp-upload-')));
  const uploadDir = path.join(root, 'uploads');
  const outsideDir = path.join(root, 'outside');
  await fs.mkdir(uploadDir);
  await fs.mkdir(outsideDir);
  try {
    return await run({ uploadDir, outsideDir });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
};

const uploadCall = (call, args) => call('articles_upload_featured_image', { article_id: VALID_UUID, ...args });

test('an image inside the upload directory is uploaded as base64 with its sniffed type', async () => {
  await withUploadDir(async ({ uploadDir }) => {
    const filePath = path.join(uploadDir, 'hero.png');
    await fs.writeFile(filePath, PNG_BYTES);
    await withMcp({ argv: [...ALL_TOOLSETS, '--upload-dir', uploadDir] }, async ({ call, calls }) => {
      const { envelope } = await uploadCall(call, { file_path: filePath });
      assert.equal(envelope.ok, true);
      assert.deepEqual(calls.at(-1).body, {
        file_base64: PNG_BYTES.toString('base64'),
        file_name: 'hero.png',
        file_type: 'image/png',
      });
      const inline = await uploadCall(call, { file_base64: PNG_BYTES.toString('base64'), file_name: 'inline.png' });
      assert.equal(inline.envelope.ok, true);
      assert.equal(calls.at(-1).body.file_name, 'inline.png');
    });
  });
});

test('uploads outside the directory, oversize, mistyped or relative are refused before any request', async () => {
  await withUploadDir(async ({ uploadDir, outsideDir }) => {
    const outside = path.join(outsideDir, 'secret.png');
    const oversize = path.join(uploadDir, 'big.png');
    const renamed = path.join(uploadDir, 'notes.png');
    await fs.writeFile(outside, PNG_BYTES);
    await fs.writeFile(oversize, Buffer.concat([PNG_BYTES, Buffer.alloc(OVERSIZE_BYTES - PNG_BYTES.length)]));
    await fs.writeFile(renamed, 'API_KEY=not-an-image');
    await withMcp({ argv: [...ALL_TOOLSETS, '--upload-dir', uploadDir] }, async ({ call, calls }) => {
      const before = calls.length;
      const cases = [
        [{ file_path: outside }, /must be inside/],
        [{ file_path: path.join(uploadDir, '..', 'outside', 'secret.png') }, /must be inside/],
        [{ file_path: oversize }, /maximum upload size/],
        [{ file_path: renamed }, /does not look like image\/png/],
        [{ file_path: 'hero.png' }, /file_path must be an absolute path/],
        [{ file_path: path.join(uploadDir, 'missing.png') }, /Failed to read file/],
        [{}, /Missing required argument: file_path, or file_base64 with file_name\./],
        [{ file_base64: PNG_BYTES.toString('base64') }, /must be passed together/],
        [{ file_path: renamed, file_base64: 'AAAA', file_name: 'a.png' }, /not both/],
        [{ file_base64: Buffer.from('plain text').toString('base64'), file_name: 'a.png' }, /does not look like/],
      ];
      for (const [args, pattern] of cases) {
        const { result, envelope } = await uploadCall(call, args);
        assert.equal(result.isError, true, JSON.stringify(args));
        assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE, JSON.stringify(args));
        assert.match(envelope.error.message, pattern);
      }
      assert.equal(calls.length, before);
    });
  });
});

test('a symlink that points outside the upload directory is refused', async (t) => {
  await withUploadDir(async ({ uploadDir, outsideDir }) => {
    const target = path.join(outsideDir, 'secret.png');
    const link = path.join(uploadDir, 'link.png');
    await fs.writeFile(target, PNG_BYTES);
    try {
      await fs.symlink(target, link);
    } catch {
      t.skip('symlinks are not available on this machine');
      return;
    }
    await withMcp({ argv: [...ALL_TOOLSETS, '--upload-dir', uploadDir] }, async ({ call, calls }) => {
      const before = calls.length;
      const { envelope } = await uploadCall(call, { file_path: link });
      assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE);
      assert.match(envelope.error.message, /must be inside/);
      assert.equal(calls.length, before);
    });
  });
});

test('a missing upload directory is reported as a configuration problem, not a crash', async () => {
  await withUploadDir(async ({ uploadDir }) => {
    const missingDir = path.join(uploadDir, 'not-created');
    const filePath = path.join(uploadDir, 'hero.png');
    await fs.writeFile(filePath, PNG_BYTES);
    await withMcp({ argv: [...ALL_TOOLSETS, '--upload-dir', missingDir] }, async ({ call }) => {
      const { envelope } = await uploadCall(call, { file_path: filePath });
      assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE);
      assert.match(envelope.error.message, /upload directory .* is not accessible/);
    });
  });
});

test('a path outside the upload directory gets one answer whether or not the file exists', async () => {
  await withUploadDir(async ({ uploadDir, outsideDir }) => {
    const existing = path.join(outsideDir, 'secret.png');
    const oversize = path.join(outsideDir, 'big.png');
    await fs.writeFile(existing, PNG_BYTES);
    await fs.writeFile(oversize, Buffer.alloc(OVERSIZE_BYTES));
    const outsidePaths = [
      existing,
      oversize,
      path.join(outsideDir, 'missing.png'),
      path.join(outsideDir, 'notes.txt'),
      outsideDir,
      uploadDir,
      ...(process.platform === 'win32' ? [UNC_PATH] : []),
    ];
    await withMcp({ argv: [...ALL_TOOLSETS, '--upload-dir', uploadDir] }, async ({ call, calls }) => {
      const before = calls.length;
      for (const filePath of outsidePaths) {
        const { envelope } = await uploadCall(call, { file_path: filePath });
        assert.equal(envelope.error.message, `The file must be inside ${uploadDir}.`, filePath);
      }
      assert.equal(calls.length, before);
    });
  });
});

test('a file whose name starts with two dots inside the upload directory is accepted', async () => {
  await withUploadDir(async ({ uploadDir }) => {
    const filePath = path.join(uploadDir, '..dots.png');
    await fs.writeFile(filePath, PNG_BYTES);
    await withMcp({ argv: [...ALL_TOOLSETS, '--upload-dir', uploadDir] }, async ({ call, calls }) => {
      const { envelope } = await uploadCall(call, { file_path: filePath });
      assert.equal(envelope.ok, true);
      assert.equal(calls.at(-1).body.file_name, '..dots.png');
    });
  });
});

test('the dkim-selector choice error names MCP arguments, not CLI flags', async () => {
  await withMcp({ argv: ALL_TOOLSETS }, async ({ call, calls }) => {
    const before = calls.length;
    const { envelope } = await call('ai_cited_lists_mailbox_dkim_selector', { product_id: VALID_UUID });
    assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.equal(envelope.error.message, 'Pass exactly one of selector or reset.');
    assert.equal(envelope.agent_guidance.includes('--'), false);
    assert.equal(calls.length, before);
  });
});

test('an image name with control characters is refused', async () => {
  await withMcp({ argv: ALL_TOOLSETS }, async ({ call, calls }) => {
    const before = calls.length;
    const { envelope } = await uploadCall(call, {
      file_base64: PNG_BYTES.toString('base64'),
      file_name: 'hero\r\nX-Injected: 1.png',
    });
    assert.equal(envelope.error.code, CliErrorCode.INVALID_USAGE);
    assert.match(envelope.error.message, /file name is too long or contains control characters/);
    assert.equal(calls.length, before);
  });
});

test('path uploads are switched off when the upload directory is a filesystem root', async () => {
  const root = path.parse(os.tmpdir()).root;
  await withMcp({ argv: [...ALL_TOOLSETS, '--upload-dir', root] }, async ({ call, calls, client }) => {
    const { tools } = await client.listTools();
    const schema = tools.find((tool) => tool.name === 'articles_upload_featured_image').inputSchema;
    const description = schema.properties.file_path.description;
    assert.match(description, /^Disabled on this server: the upload directory is too broad/);
    const before = calls.length;
    const refused = await uploadCall(call, { file_path: path.join(root, 'any.png') });
    assert.match(refused.envelope.error.message, /disabled because the upload directory is too broad/);
    assert.equal(calls.length, before);
    const inline = await uploadCall(call, { file_base64: PNG_BYTES.toString('base64'), file_name: 'inline.png' });
    assert.equal(inline.envelope.ok, true);
  });
});
