import { usageError } from './errors.js';

export const FieldKind = Object.freeze({
  STRING: 'string',
  UUID: 'uuid',
  INT: 'int',
  BOOL: 'bool',
  ENUM: 'enum',
  LIST: 'list',
  OBJECT: 'object',
  JSON: 'json',
  IMAGE: 'image',
});

export const BoolSerialize = Object.freeze({
  OMIT_FALSE: 'omit-false',
  STRING: 'string',
  ALWAYS: 'always',
});

export const ListSerialize = Object.freeze({
  ARRAY: 'array',
  CSV: 'csv',
});

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_MESSAGE = 'must be a UUID';
const INTEGER_TEXT_PATTERN = /^-?\d+$/;
const TRUE_TEXT = 'true';
const FALSE_TEXT = 'false';
const DEFAULT_LIST_SEPARATOR = ',';
const IMAGE_FIELDS = Object.freeze(['file_base64', 'file_name', 'file_type']);

const createField = (kind, options = {}) => {
  const field = {
    kind,
    isRequired: false,
    requiredError: undefined,
    invalidGuidance: undefined,
    description: undefined,
    defaultValue: undefined,
    ...options,
  };
  const derive = (changes) => createField(kind, { ...field, ...changes });
  field.required = (requiredError) => derive({ isRequired: true, requiredError });
  field.describe = (description) => derive({ description });
  field.default = (defaultValue) => derive({ defaultValue });
  field.guidance = (invalidGuidance) => derive({ invalidGuidance });
  return field;
};

export const string = () => createField(FieldKind.STRING);
export const uuid = () => createField(FieldKind.UUID);
export const int = ({ min, max } = {}) => createField(FieldKind.INT, { min, max });
export const bool = ({ serialize = BoolSerialize.OMIT_FALSE } = {}) => createField(FieldKind.BOOL, { serialize });
export const oneOf = (values) => createField(FieldKind.ENUM, { values: Object.freeze([...values]) });
export const list = ({ split = DEFAULT_LIST_SEPARATOR, serialize = ListSerialize.ARRAY, item = string() } = {}) =>
  createField(FieldKind.LIST, { split, serialize, item });
export const object = () => createField(FieldKind.OBJECT);
export const json = () => createField(FieldKind.JSON);
export const image = () => createField(FieldKind.IMAGE);

export const isField = (value) => Boolean(value) && Object.values(FieldKind).includes(value.kind);

const isBlank = (value) => value === undefined || value === null;

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseInteger = (value, label) => {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw usageError(`${label} must be an integer.`);
    return value;
  }
  if (typeof value !== 'string' || !INTEGER_TEXT_PATTERN.test(value.trim()) || value.trim() !== value) {
    throw usageError(`${label} must be an integer.`);
  }
  return Number(value);
};

const parseScalar = (field, value, label) => {
  if (field.kind === FieldKind.STRING) {
    if (typeof value !== 'string') throw usageError(`${label} must be a string.`);
    return value;
  }
  if (field.kind === FieldKind.UUID) {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw usageError(`${label} must be a UUID.`);
    return value;
  }
  if (field.kind === FieldKind.INT) {
    const number = parseInteger(value, label);
    if (field.min !== undefined && number < field.min) throw usageError(`${label} must be >= ${field.min}.`);
    if (field.max !== undefined && number > field.max) throw usageError(`${label} must be <= ${field.max}.`);
    return number;
  }
  if (field.kind === FieldKind.BOOL) {
    if (typeof value === 'boolean') return value;
    if (value === TRUE_TEXT) return true;
    if (value === FALSE_TEXT) return false;
    throw usageError(`${label} must be true or false.`);
  }
  if (field.kind === FieldKind.ENUM) {
    if (!field.values.includes(value)) throw usageError(`${label} must be one of: ${field.values.join(', ')}.`);
    return value;
  }
  if (field.kind === FieldKind.OBJECT) {
    if (!isPlainObject(value)) throw usageError(`${label} must be a JSON object.`);
    return value;
  }
  if (field.kind === FieldKind.JSON) {
    return value;
  }
  if (field.kind === FieldKind.IMAGE) {
    const valid = isPlainObject(value) && IMAGE_FIELDS.every((name) => typeof value[name] === 'string' && value[name]);
    if (!valid) throw usageError(`${label} must be an image upload (file_base64, file_name, file_type).`);
    return value;
  }
  throw new Error(`Unknown field kind: ${field.kind}`);
};

const splitListValues = (field, value, splitLists) => {
  const rawItems = Array.isArray(value) ? value : [value];
  if (!field.split || !splitLists) return rawItems;
  return rawItems.flatMap((item) => (typeof item === 'string' ? item.split(field.split) : [item]));
};

const parseList = (field, value, label, splitLists) => {
  const items = splitListValues(field, value, splitLists)
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter((item) => item !== '');
  return items.map((item) => parseScalar(field.item, item, label));
};

const withFieldGuidance = (field, run) => {
  try {
    return run();
  } catch (error) {
    if (field.invalidGuidance && error?.cliCode) {
      throw usageError(error.message, field.invalidGuidance);
    }
    throw error;
  }
};

export const parseFieldValue = (field, value, label, { splitLists = true } = {}) =>
  withFieldGuidance(field, () => {
    if (value === '') throw usageError(`${label} requires a value.`);
    if (field.kind === FieldKind.LIST) return parseList(field, value, label, splitLists);
    return parseScalar(field, value, label);
  });

const missingFieldError = (field, name, missingMessage) => {
  const message = field.requiredError?.message ?? missingMessage(name);
  return usageError(message, field.requiredError?.guidance);
};

const cloneDefault = (value) => (value !== null && typeof value === 'object' ? structuredClone(value) : value);

export const validateInput = (fields, raw, { labelOf = (name) => name, missingOf, splitLists = true } = {}) => {
  const missingMessage = missingOf ?? ((name) => `Missing required input: ${labelOf(name)}.`);
  const result = {};
  for (const [name, field] of Object.entries(fields)) {
    const value = raw[name];
    if (isBlank(value)) {
      if (field.isRequired) throw missingFieldError(field, name, missingMessage);
      if (field.defaultValue !== undefined) result[name] = cloneDefault(field.defaultValue);
      continue;
    }
    const parsed = parseFieldValue(field, value, labelOf(name), { splitLists });
    if (field.kind === FieldKind.LIST && field.isRequired && parsed.length === 0) {
      throw missingFieldError(field, name, missingMessage);
    }
    result[name] = parsed;
  }
  return result;
};

export const serializeBool = (field, value) => {
  if (field.serialize === BoolSerialize.STRING) return value ? TRUE_TEXT : undefined;
  if (field.serialize === BoolSerialize.ALWAYS) return value;
  return value ? true : undefined;
};

export const serializeList = (field, value) => {
  if (field.serialize === ListSerialize.CSV) return value.join(DEFAULT_LIST_SEPARATOR);
  return value;
};

const zodScalar = (z, field, { jsonAsObject = false } = {}) => {
  if (field.kind === FieldKind.STRING) return z.string().min(1);
  if (field.kind === FieldKind.UUID) return z.string().regex(UUID_PATTERN, UUID_MESSAGE);
  if (field.kind === FieldKind.INT) {
    let schema = z.number().int();
    if (field.min !== undefined) schema = schema.min(field.min);
    if (field.max !== undefined) schema = schema.max(field.max);
    return schema;
  }
  if (field.kind === FieldKind.BOOL) return z.boolean();
  if (field.kind === FieldKind.ENUM) return z.enum(field.values);
  if (field.kind === FieldKind.OBJECT) return z.object({}).passthrough();
  if (field.kind === FieldKind.JSON) return jsonAsObject ? z.object({}).passthrough() : z.unknown();
  if (field.kind === FieldKind.IMAGE) {
    return z.object({ file_base64: z.string().min(1), file_name: z.string().min(1), file_type: z.string().min(1) });
  }
  throw new Error(`Unknown field kind: ${field.kind}`);
};

export const zodField = (z, field, { jsonAsObject = false, description = field.description } = {}) => {
  const minItems = field.isRequired ? 1 : 0;
  const options = { jsonAsObject };
  let schema =
    field.kind === FieldKind.LIST
      ? z.array(zodScalar(z, field.item, options)).min(minItems)
      : zodScalar(z, field, options);
  if (description) schema = schema.describe(description);
  return field.isRequired ? schema : schema.optional();
};

export const toZodSchema = async (fields) => {
  const { z } = await import('zod');
  const shape = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, zodField(z, field)]));
  return z.object(shape).strict();
};
