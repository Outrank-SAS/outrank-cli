import path from 'node:path';

import { BODY_INPUT_NAME, toSnakeCase } from '../../commands/registry.js';
import { describeUntrustedValue } from '../../core/config.js';
import { MAX_IMAGE_UPLOAD_MEGABYTES } from '../../core/constants.js';
import { MCP_USAGE_GUIDANCE, usageError } from '../../core/errors.js';
import { readImageUpload, readImageUploadFromBase64 } from '../../core/files.js';
import { FieldKind, UUID_PATTERN, zodField } from '../../core/schema.js';

const IMAGE_PATH_SUFFIX = '_path';
const IMAGE_BASE64_SUFFIX = '_base64';
const IMAGE_NAME_SUFFIX = '_name';
const ROOT_ISSUE_PATH = 'arguments';
const ISSUE_SEPARATOR = '; ';
const UUID_FORMAT = 'uuid';
const SCHEMA_DIALECT_KEY = '$schema';
const BROAD_UPLOAD_DIR_GUIDANCE =
  'Ask the human to restart the server with --upload-dir <a directory that holds only the images to upload>, or ' +
  'pass the image as base64 with a file name instead.';
const REMOTE_UPLOAD_GUIDANCE = 'Pass the image as base64 with a file name instead.';
const UPLOAD_DIR_GUIDANCE =
  'Ask the human to create the upload directory or to restart the server with --upload-dir <existing directory>.';

const imageArgumentNames = (name) => {
  const base = toSnakeCase(name);
  return {
    filePath: `${base}${IMAGE_PATH_SUFFIX}`,
    base64: `${base}${IMAGE_BASE64_SUFFIX}`,
    fileName: `${base}${IMAGE_NAME_SUFFIX}`,
  };
};

const describeFilePath = (names, uploads) =>
  uploads.problem
    ? `Disabled on this server: the upload directory is too broad (${uploads.problem}). Use ${names.base64} with ` +
      `${names.fileName}, or ask the human to restart the server with --upload-dir <directory>.`
    : `Absolute path of a local jpg, png, webp or gif image (max ${MAX_IMAGE_UPLOAD_MEGABYTES} MB) inside the ` +
      `upload directory ${uploads.dir}. Use this or ${names.base64} with ${names.fileName}, not both.`;

const imageShape = (z, name, uploads) => {
  const names = imageArgumentNames(name);
  return {
    ...(uploads.dir === null
      ? {}
      : { [names.filePath]: z.string().min(1).describe(describeFilePath(names, uploads)).optional() }),
    [names.base64]: z
      .string()
      .min(1)
      .describe(
        `Image bytes as standard base64 (max ${MAX_IMAGE_UPLOAD_MEGABYTES} MB decoded). Requires ${names.fileName}.`,
      )
      .optional(),
    [names.fileName]: z
      .string()
      .min(1)
      .describe('File name with a .jpg, .jpeg, .png, .webp or .gif extension that matches the bytes.')
      .optional(),
  };
};

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const slimProperty = (property) => {
  const slim = { ...property };
  if (slim.maximum === Number.MAX_SAFE_INTEGER) delete slim.maximum;
  if (slim.minimum === Number.MIN_SAFE_INTEGER) delete slim.minimum;
  if (slim.pattern === UUID_PATTERN.source) {
    delete slim.pattern;
    slim.format = UUID_FORMAT;
  }
  if (isPlainObject(slim.items)) slim.items = slimProperty(slim.items);
  return slim;
};

const slimSchema = (jsonSchema) => {
  const slim = { ...jsonSchema };
  delete slim[SCHEMA_DIALECT_KEY];
  slim.properties = Object.fromEntries(
    Object.entries(jsonSchema.properties ?? {}).map(([name, property]) => [name, slimProperty(property)]),
  );
  return slim;
};

export const buildToolInput = ({ z, spec, describeField, uploads }) => {
  const shape = {};
  const fieldByArgument = {};
  const images = [];
  for (const [name, field] of Object.entries(spec.input)) {
    if (field.kind === FieldKind.TEXT_FILE) continue;
    if (field.kind === FieldKind.IMAGE) {
      Object.assign(shape, imageShape(z, name, uploads));
      images.push({ name, field, arguments: imageArgumentNames(name) });
      continue;
    }
    const argument = toSnakeCase(name);
    shape[argument] = zodField(z, field, { jsonAsObject: true, description: describeField(spec, name, field) });
    fieldByArgument[argument] = name;
  }
  const schema = z.object(shape).strict();
  return {
    schema,
    inputSchema: slimSchema(z.toJSONSchema(schema)),
    argumentNames: Object.keys(shape),
    fieldByArgument,
    images,
  };
};

const dropNulls = (args) => Object.fromEntries(Object.entries(args).filter(([, value]) => value !== null));

const describeIssue = (issue) => {
  const location = issue.path.length > 0 ? issue.path.join('.') : ROOT_ISSUE_PATH;
  return `${location}: ${issue.message}`;
};

export const parseToolArguments = (toolInput, args) => {
  const candidate = args === undefined || args === null ? {} : args;
  if (typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw usageError('Tool arguments must be a JSON object.', MCP_USAGE_GUIDANCE);
  }
  const unknown = Object.keys(candidate).filter((name) => !toolInput.argumentNames.includes(name));
  if (unknown.length > 0) {
    const names = unknown.map(describeUntrustedValue).join(', ');
    throw usageError(`Invalid tool arguments. Unrecognized argument: ${names}.`, MCP_USAGE_GUIDANCE);
  }
  const result = toolInput.schema.safeParse(dropNulls(candidate));
  if (!result.success) {
    const issues = result.error.issues.map(describeIssue).join(ISSUE_SEPARATOR);
    throw usageError(`Invalid tool arguments. ${issues}`, MCP_USAGE_GUIDANCE);
  }
  return result.data;
};

const readImageFromPath = async (filePath, uploads) => {
  if (uploads.dir === null) {
    throw usageError('Uploads from a file path are not available on the remote server.', REMOTE_UPLOAD_GUIDANCE);
  }
  if (uploads.problem) {
    throw usageError(
      `Uploads from a file path are disabled because the upload directory is too broad (${uploads.problem}).`,
      BROAD_UPLOAD_DIR_GUIDANCE,
    );
  }
  try {
    return await readImageUpload({ filePath, allowedDir: uploads.dir });
  } catch (error) {
    if (error?.cliCode) throw error;
    throw usageError(`The upload directory ${uploads.dir} is not accessible.`, UPLOAD_DIR_GUIDANCE);
  }
};

const resolveImage = async (image, parsed, uploads) => {
  const names = image.arguments;
  const filePath = parsed[names.filePath];
  const base64 = parsed[names.base64];
  const fileName = parsed[names.fileName];
  if (filePath !== undefined && (base64 !== undefined || fileName !== undefined)) {
    throw usageError(
      `Pass either ${names.filePath} or ${names.base64} with ${names.fileName}, not both.`,
      MCP_USAGE_GUIDANCE,
    );
  }
  if (filePath !== undefined) {
    if (!path.isAbsolute(filePath)) {
      throw usageError(
        `${names.filePath} must be an absolute path inside ${uploads.dir}.`,
        'Resolve the path against the upload directory before passing it.',
      );
    }
    return readImageFromPath(filePath, uploads);
  }
  if (base64 !== undefined || fileName !== undefined) {
    if (base64 === undefined || fileName === undefined) {
      throw usageError(`${names.base64} and ${names.fileName} must be passed together.`, MCP_USAGE_GUIDANCE);
    }
    return readImageUploadFromBase64({ base64, fileName });
  }
  if (image.field.isRequired) {
    throw usageError(
      `Missing required argument: ${names.filePath}, or ${names.base64} with ${names.fileName}.`,
      MCP_USAGE_GUIDANCE,
    );
  }
  return undefined;
};

export const toRawInput = async (toolInput, parsed, uploads) => {
  const raw = {};
  for (const [argument, name] of Object.entries(toolInput.fieldByArgument)) {
    if (name !== BODY_INPUT_NAME && parsed[argument] !== undefined) raw[name] = parsed[argument];
  }
  for (const image of toolInput.images) {
    const upload = await resolveImage(image, parsed, uploads);
    if (upload !== undefined) raw[image.name] = upload;
  }
  return { raw, body: parsed[BODY_INPUT_NAME] };
};

export const MCP_LABELS = Object.freeze({
  labelOf: (name) => toSnakeCase(name),
  missingOf: (name) => `Missing required argument: ${toSnakeCase(name)}.`,
});
