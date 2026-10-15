import fs from 'node:fs/promises';
import path from 'node:path';

import { MAX_IMAGE_UPLOAD_BYTES, MAX_TEXT_FILE_BYTES } from './constants.js';
import { usageError } from './errors.js';

const ImageMime = Object.freeze({
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
  GIF: 'image/gif',
});

export const IMAGE_MIME_BY_EXTENSION = Object.freeze({
  '.jpg': ImageMime.JPEG,
  '.jpeg': ImageMime.JPEG,
  '.png': ImageMime.PNG,
  '.webp': ImageMime.WEBP,
  '.gif': ImageMime.GIF,
});

const SUPPORTED_EXTENSIONS_TEXT = 'Use one of: .jpg, .jpeg, .png, .webp, .gif.';
const SNIFF_LENGTH = 12;
const WEBP_RIFF_OFFSET = 8;

const MAGIC_SIGNATURES = Object.freeze({
  [ImageMime.PNG]: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  [ImageMime.JPEG]: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  [ImageMime.GIF]: [
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
    { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  ],
  [ImageMime.WEBP]: [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46], then: { offset: WEBP_RIFF_OFFSET, bytes: [0x57, 0x45, 0x42, 0x50] } },
  ],
});

const matchesAt = (buffer, { offset, bytes }) =>
  buffer.length >= offset + bytes.length && bytes.every((byte, index) => buffer[offset + index] === byte);

const matchesSignature = (buffer, signature) =>
  matchesAt(buffer, signature) && (signature.then === undefined || matchesAt(buffer, signature.then));

export const sniffImageMime = (buffer) => {
  const head = buffer.subarray(0, SNIFF_LENGTH);
  for (const [mime, signatures] of Object.entries(MAGIC_SIGNATURES)) {
    if (signatures.some((signature) => matchesSignature(head, signature))) return mime;
  }
  return undefined;
};

const readGuidance = (absolutePath) => `Confirm that ${absolutePath} exists and is readable, then retry.`;
const OUTSIDE_GUIDANCE = 'Move or copy the image into the allowed upload directory, then pass its path again.';
const OVERSIZE_GUIDANCE = 'Resize or compress the image below the limit, then retry.';
const FILE_NAME_GUIDANCE = 'Rename the file using letters, digits, dots, dashes, underscores or spaces, then retry.';
const PARENT_SEGMENT = '..';
const MAX_FILE_NAME_LENGTH = 255;
const FIRST_PRINTABLE_CODE = 0x20;
const DELETE_CODE = 0x7f;

const isInside = (directory, target) => {
  const relative = path.relative(directory, target);
  if (relative === '' || relative === PARENT_SEGMENT || path.isAbsolute(relative)) return false;
  return !relative.startsWith(`${PARENT_SEGMENT}${path.sep}`);
};

const outsideError = (allowedDir) => usageError(`The file must be inside ${allowedDir}.`, OUTSIDE_GUIDANCE);

const oversizeError = (subject, size) =>
  usageError(
    `${subject} is ${size} bytes; the maximum upload size is ${MAX_IMAGE_UPLOAD_BYTES} bytes.`,
    OVERSIZE_GUIDANCE,
  );

const hasControlCharacter = (text) =>
  [...text].some((character) => {
    const code = character.codePointAt(0);
    return code < FIRST_PRINTABLE_CODE || code === DELETE_CODE;
  });

const assertSafeFileName = (fileName) => {
  if (fileName.length > MAX_FILE_NAME_LENGTH || hasControlCharacter(fileName)) {
    throw usageError('The image file name is too long or contains control characters.', FILE_NAME_GUIDANCE);
  }
};

const toUpload = (buffer, fileName) => {
  assertSafeFileName(fileName);
  const extension = path.extname(fileName).toLowerCase();
  const fileType = IMAGE_MIME_BY_EXTENSION[extension];
  if (!fileType) {
    throw usageError(`Unsupported image file extension: ${extension || '(none)'}.`, SUPPORTED_EXTENSIONS_TEXT);
  }
  const sniffed = sniffImageMime(buffer);
  if (sniffed !== fileType) {
    throw usageError(
      `The file content does not look like ${fileType}${sniffed ? ` (detected ${sniffed})` : ''}: ${fileName}`,
      'Make sure the file is a real image whose bytes match its extension, then retry.',
    );
  }
  return { file_base64: buffer.toString('base64'), file_name: fileName, file_type: fileType };
};

export const readImageUploadFromBase64 = ({ base64, fileName }) => {
  if (typeof base64 !== 'string' || base64 === '' || typeof fileName !== 'string' || fileName === '') {
    throw usageError('An image upload needs file_base64 and file_name.', 'Pass both fields, or a file path instead.');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.toString('base64').replace(/=+$/, '') !== base64.replace(/=+$/, '')) {
    throw usageError('file_base64 is not valid base64.', 'Encode the image bytes as standard base64, then retry.');
  }
  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) throw oversizeError('The image', buffer.length);
  return toUpload(buffer, path.basename(fileName));
};

const resolveAllowedDir = async (allowedDir) => {
  if (allowedDir === undefined) return undefined;
  return { lexical: path.resolve(allowedDir), real: await fs.realpath(allowedDir), shown: allowedDir };
};

const assertLexicallyInside = (filePath, allowed) => {
  if (allowed === undefined) return;
  const target = path.resolve(filePath);
  if (!isInside(allowed.lexical, target) && !isInside(allowed.real, target)) throw outsideError(allowed.shown);
};

const resolveReadPath = async (filePath, allowed) => {
  if (allowed === undefined) return filePath;
  const realFile = await fs.realpath(filePath);
  if (!isInside(allowed.real, realFile)) throw outsideError(allowed.shown);
  return realFile;
};

const readOpenedFile = async (readPath) => {
  const handle = await fs.open(readPath, 'r');
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw usageError(`Not a file: ${readPath}`, readGuidance(readPath));
    if (stats.size > MAX_IMAGE_UPLOAD_BYTES) throw oversizeError('The file', stats.size);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
};

export const readImageUpload = async ({ filePath, allowedDir }) => {
  if (typeof filePath !== 'string' || filePath === '') {
    throw usageError('Missing required option: --file <path>.', 'Pass a local image path with `--file <path>`.');
  }
  if (!path.isAbsolute(filePath)) {
    throw usageError(`The file path must be absolute: ${filePath}`, 'Resolve the path before passing it.');
  }
  const allowed = await resolveAllowedDir(allowedDir);
  assertLexicallyInside(filePath, allowed);

  let readPath;
  let stats;
  try {
    readPath = await resolveReadPath(filePath, allowed);
    stats = await fs.stat(readPath);
  } catch (error) {
    if (error?.cliCode) throw error;
    throw usageError(`Failed to read file: ${error.message}`, readGuidance(filePath));
  }
  if (!stats.isFile()) {
    throw usageError(`Not a file: ${filePath}`, readGuidance(filePath));
  }
  if (stats.size > MAX_IMAGE_UPLOAD_BYTES) throw oversizeError('The file', stats.size);

  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();
  if (!IMAGE_MIME_BY_EXTENSION[extension]) {
    throw usageError(`Unsupported image file extension: ${extension || '(none)'}.`, SUPPORTED_EXTENSIONS_TEXT);
  }

  let buffer;
  try {
    buffer = await readOpenedFile(readPath);
  } catch (error) {
    if (error?.cliCode) throw error;
    throw usageError(`Failed to read file: ${error.message}`, readGuidance(filePath));
  }
  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) throw oversizeError('The file', buffer.length);

  return toUpload(buffer, fileName);
};

const UTF8_ENCODING = 'utf-8';
const BYTE_ORDER_MARK = '\uFEFF';
const TEXT_OVERSIZE_GUIDANCE = 'Split the content or shorten it below the limit, then retry.';
const TEXT_ENCODING_GUIDANCE = 'Save the file as UTF-8 text, then retry.';

export const readTextFile = async ({ filePath, option }) => {
  if (typeof filePath !== 'string' || filePath === '') {
    throw usageError(`Missing required option: ${option} <path>.`, `Pass a local file path with \`${option} <path>\`.`);
  }
  let buffer;
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw usageError(`Not a file: ${filePath}`, readGuidance(filePath));
    if (stats.size > MAX_TEXT_FILE_BYTES) {
      throw usageError(
        `${filePath} is ${stats.size} bytes; the maximum is ${MAX_TEXT_FILE_BYTES} bytes.`,
        TEXT_OVERSIZE_GUIDANCE,
      );
    }
    buffer = await fs.readFile(filePath);
  } catch (error) {
    if (error?.cliCode) throw error;
    throw usageError(`Failed to read file: ${error.message}`, readGuidance(filePath));
  }
  let text;
  try {
    text = new TextDecoder(UTF8_ENCODING, { fatal: true }).decode(buffer);
  } catch {
    throw usageError(`${filePath} is not valid UTF-8 text.`, TEXT_ENCODING_GUIDANCE);
  }
  return text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text;
};
