import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CliErrorCode } from '../src/core/errors.js';
import {
  BoolSerialize,
  ListSerialize,
  bool,
  int,
  json,
  list,
  number,
  object,
  oneOf,
  serializeBool,
  serializeList,
  string,
  toZodSchema,
  uuid,
  validateInput,
} from '../src/core/schema.js';

const LIST_MIN_LIMIT = 1;
const LIST_MAX_LIMIT = 100;
const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const CLI_LABELS = { labelOf: (name) => `--${name}`, missingOf: (name) => `Missing required option: --${name}.` };

const throwsUsage = (fn, messagePattern) =>
  assert.throws(fn, (error) => {
    assert.equal(error.cliCode, CliErrorCode.INVALID_USAGE);
    assert.match(error.message, messagePattern);
    return true;
  });

test('integers accept numeric strings and numbers, enforce bounds at the limit and just past it', () => {
  const fields = { limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }) };
  assert.deepEqual(validateInput(fields, { limit: String(LIST_MAX_LIMIT) }, CLI_LABELS), { limit: LIST_MAX_LIMIT });
  assert.deepEqual(validateInput(fields, { limit: LIST_MIN_LIMIT }, CLI_LABELS), { limit: LIST_MIN_LIMIT });
  const pastMax = String(LIST_MAX_LIMIT + 1);
  throwsUsage(() => validateInput(fields, { limit: pastMax }, CLI_LABELS), /--limit must be <= 100\./);
  throwsUsage(() => validateInput(fields, { limit: LIST_MIN_LIMIT - 1 }, CLI_LABELS), /--limit must be >= 1\./);
  throwsUsage(() => validateInput(fields, { limit: '2.5' }, CLI_LABELS), /--limit must be an integer\./);
  throwsUsage(() => validateInput(fields, { limit: 'abc' }, CLI_LABELS), /--limit must be an integer\./);
  throwsUsage(() => validateInput(fields, { limit: true }, CLI_LABELS), /--limit must be an integer\./);
});

test('an empty string is a missing value for every typed field, never 0 or an empty list', () => {
  const cases = [
    [{ offset: int({ min: 0 }) }, 'offset'],
    [{ status: string() }, 'status'],
    [{ ids: list() }, 'ids'],
    [{ mode: oneOf(['on', 'off']) }, 'mode'],
  ];
  for (const [fields, name] of cases) {
    throwsUsage(() => validateInput(fields, { [name]: '' }, CLI_LABELS), new RegExp(`--${name} requires a value\\.`));
  }
});

test('required fields report the adapter-supplied missing message and optional ones take defaults', () => {
  throwsUsage(
    () => validateInput({ product: uuid().required() }, {}, CLI_LABELS),
    /Missing required option: --product\./,
  );
  const positional = { missingOf: () => 'Missing required argument: <product-id>.' };
  throwsUsage(() => validateInput({ productId: uuid().required() }, {}, positional), /<product-id>/);
  assert.deepEqual(validateInput({ limit: int().default(20) }, {}), { limit: 20 });
  assert.deepEqual(validateInput({ limit: int() }, {}), {});
});

test('uuid fields reject anything that is not a UUID, so an id cannot carry a path', () => {
  assert.deepEqual(validateInput({ id: uuid() }, { id: PRODUCT_ID }), { id: PRODUCT_ID });
  assert.deepEqual(validateInput({ id: uuid() }, { id: PRODUCT_ID.toUpperCase() }), { id: PRODUCT_ID.toUpperCase() });
  throwsUsage(() => validateInput({ id: uuid() }, { id: '../articles/x' }, CLI_LABELS), /--id must be a UUID\./);
  throwsUsage(() => validateInput({ id: uuid() }, { id: `${PRODUCT_ID}/extra` }, CLI_LABELS), /must be a UUID/);
});

test('booleans accept true/false text and real booleans and serialize per mode', () => {
  const fields = { improveImages: bool({ serialize: BoolSerialize.ALWAYS }) };
  assert.deepEqual(validateInput(fields, { improveImages: 'false' }), { improveImages: false });
  assert.deepEqual(validateInput(fields, { improveImages: true }), { improveImages: true });
  throwsUsage(() => validateInput(fields, { improveImages: 'yes' }, CLI_LABELS), /must be true or false\./);

  assert.equal(serializeBool(bool(), true), true);
  assert.equal(serializeBool(bool(), false), undefined);
  assert.equal(serializeBool(bool({ serialize: BoolSerialize.STRING }), true), 'true');
  assert.equal(serializeBool(bool({ serialize: BoolSerialize.STRING }), false), undefined);
  assert.equal(serializeBool(bool({ serialize: BoolSerialize.ALWAYS }), false), false);
});

test('enums list the accepted values in the error', () => {
  const fields = { role: oneOf(['seller', 'buyer']) };
  assert.deepEqual(validateInput(fields, { role: 'buyer' }), { role: 'buyer' });
  throwsUsage(() => validateInput(fields, { role: 'admin' }, CLI_LABELS), /--role must be one of: seller, buyer\./);
});

test('lists split on the separator when asked, keep raw items otherwise, and serialize as array or csv', () => {
  const split = { urls: list({ split: ',' }) };
  assert.deepEqual(validateInput(split, { urls: ['a,b', ' c '] }), { urls: ['a', 'b', 'c'] });
  assert.deepEqual(validateInput(split, { urls: 'a,,b' }), { urls: ['a', 'b'] });

  const raw = { competitor: list({ split: null }) };
  assert.deepEqual(validateInput(raw, { competitor: ['https://a.example.com,keep'] }), {
    competitor: ['https://a.example.com,keep'],
  });

  const typed = { ids: list({ item: uuid() }) };
  throwsUsage(() => validateInput(typed, { ids: `${PRODUCT_ID},nope` }, CLI_LABELS), /--ids must be a UUID\./);

  assert.deepEqual(serializeList(list(), ['a', 'b']), ['a', 'b']);
  assert.equal(serializeList(list({ serialize: ListSerialize.CSV }), ['a', 'b']), 'a,b');
});

test('object fields require a JSON object and json fields accept any JSON value', () => {
  throwsUsage(() => validateInput({ body: object() }, { body: [1] }, CLI_LABELS), /--body must be a JSON object\./);
  throwsUsage(() => validateInput({ body: object() }, { body: 'text' }, CLI_LABELS), /must be a JSON object/);
  assert.deepEqual(validateInput({ body: object() }, { body: { a: 1 } }), { body: { a: 1 } });
  assert.deepEqual(validateInput({ body: json() }, { body: [1, 2] }), { body: [1, 2] });
});

const SHAPED_BODY = object().shape({
  name: string().required({ guidance: 'Name it.' }),
  count: int({ min: 1, max: 3 }),
  score: number({ min: 0, max: 1 }),
  tags: list(),
  status: oneOf(['draft', 'live']),
  note: string().nullable(),
  owner: object().shape({ email: string().required() }),
});

const shaped = (body, labels) => validateInput({ body: SHAPED_BODY }, { body }, labels);

test('a shaped object checks the declared properties, keeps unknown ones and accepts empty or null text', () => {
  const body = { name: 'A', count: 3, score: 0.5, tags: ['x', ' y '], status: 'live', note: null, extra: { k: 1 } };
  assert.deepEqual(shaped(body, CLI_LABELS).body, { ...body, tags: ['x', 'y'] });
  assert.deepEqual(shaped({ name: '' }).body, { name: '' });
  throwsUsage(() => shaped({}, CLI_LABELS), /Missing required field: --body\.name\./);
  assert.throws(
    () => shaped({}),
    (error) => error.guidance === 'Name it.',
  );
  throwsUsage(() => shaped({ name: 'A', count: 4 }), /body\.count must be <= 3\./);
  throwsUsage(() => shaped({ name: 'A', score: '1' }), /body\.score must be a number\./);
  throwsUsage(() => shaped({ name: 'A', tags: 'x' }), /body\.tags must be an array\./);
  throwsUsage(() => shaped({ name: 'A', status: 'gone' }), /one of: draft, live/);
  throwsUsage(() => shaped({ name: 'A', owner: {} }), /body\.owner\.email/);
  throwsUsage(() => shaped({ name: 'A', note: 5 }), /body\.note must be a string/);
  throwsUsage(() => shaped({ name: 'A', count: null }), /body\.count must not be null\./);
  throwsUsage(() => shaped({ name: null }), /Missing required field: body\.name\./);
  const requiredList = { body: object().shape({ tags: list().required() }) };
  const missingTags = /Missing required field: body\.tags\./;
  throwsUsage(() => validateInput(requiredList, { body: { tags: [] } }), missingTags);
  throwsUsage(() => validateInput(requiredList, { body: { tags: [' '] } }), missingTags);
  assert.deepEqual(validateInput(requiredList, { body: { tags: ['a'] } }).body, { tags: ['a'] });
});

test('the zod schema of a shaped object declares its properties and allows extra keys and nulls', async (t) => {
  let schema;
  try {
    schema = await toZodSchema({ body: SHAPED_BODY });
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      t.skip('zod is not installed');
      return;
    }
    throw error;
  }
  const accepted = [
    { name: 'A' },
    { name: '', note: null, extra: 1 },
    { name: 'A', owner: { email: 'a@b.c' }, tags: [], score: 1 },
  ];
  const rejected = [
    {},
    { name: 'A', count: 0 },
    { name: 'A', tags: 'x' },
    { name: 'A', tags: [' '] },
    { name: 'A', owner: {} },
    { name: 'A', status: 'gone' },
  ];
  const requiredList = await toZodSchema({ body: object().shape({ tags: list().required() }) });
  assert.equal(requiredList.safeParse({ body: { tags: [''] } }).success, false);
  assert.equal(requiredList.safeParse({ body: { tags: ['a'] } }).success, true);
  for (const body of accepted) assert.equal(schema.safeParse({ body }).success, true, JSON.stringify(body));
  for (const body of rejected) assert.equal(schema.safeParse({ body }).success, false, JSON.stringify(body));
});

test('the zod schema mirrors the validator for accept and reject cases', async (t) => {
  let schema;
  try {
    schema = await toZodSchema({
      product: uuid().required(),
      limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
      role: oneOf(['seller', 'buyer']),
      urls: list(),
    });
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      t.skip('zod is not installed until Phase 4');
      return;
    }
    throw error;
  }
  const validator = { product: uuid().required(), limit: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }) };
  const cases = [
    [{ product: PRODUCT_ID, limit: LIST_MAX_LIMIT }, true],
    [{ product: PRODUCT_ID, limit: LIST_MAX_LIMIT + 1 }, false],
    [{ product: 'nope' }, false],
    [{ limit: 5 }, false],
  ];
  for (const [input, accepted] of cases) {
    assert.equal(schema.safeParse(input).success, accepted, JSON.stringify(input));
    const validatorAccepts = (() => {
      try {
        validateInput(validator, input);
        return true;
      } catch {
        return false;
      }
    })();
    assert.equal(validatorAccepts, accepted, JSON.stringify(input));
  }
});
