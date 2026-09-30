import fs from 'node:fs/promises';
import path from 'node:path';

import { MAX_IMAGE_UPLOAD_BYTES } from './constants.js';
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

const assertInsideAllowedDir = async (absolutePath, allowedDir) => {
  const [realFile, realDir] = await Promise.all([fs.realpath(absolutePath), fs.realpath(allowedDir)]);
  const relative = path.relative(realDir, realFile);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw usageError(
      `The file must be inside ${allowedDir}.`,
      'Move or copy the image into the allowed upload directory, then pass its path again.',
    );
  }
};

const toUpload = (buffer, fileName) => {
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
  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    throw usageError(
      `The image is ${buffer.length} bytes; the maximum upload size is ${MAX_IMAGE_UPLOAD_BYTES} bytes.`,
      'Resize or compress the image below the limit, then retry.',
    );
  }
  return toUpload(buffer, path.basename(fileName));
};

export const readImageUpload = async ({ filePath, allowedDir }) => {
  if (typeof filePath !== 'string' || filePath === '') {
    throw usageError('Missing required option: --file <path>.', 'Pass a local image path with `--file <path>`.');
  }
  if (!path.isAbsolute(filePath)) {
    throw usageError(`The file path must be absolute: ${filePath}`, 'Resolve the path before passing it.');
  }

  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (error) {
    throw usageError(`Failed to read file: ${error.message}`, readGuidance(filePath));
  }
  if (!stats.isFile()) {
    throw usageError(`Not a file: ${filePath}`, readGuidance(filePath));
  }
  if (stats.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw usageError(
      `The file is ${stats.size} bytes; the maximum upload size is ${MAX_IMAGE_UPLOAD_BYTES} bytes.`,
      'Resize or compress the image below the limit, then retry.',
    );
  }
  if (allowedDir !== undefined) await assertInsideAllowedDir(filePath, allowedDir);

  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();
  if (!IMAGE_MIME_BY_EXTENSION[extension]) {
    throw usageError(`Unsupported image file extension: ${extension || '(none)'}.`, SUPPORTED_EXTENSIONS_TEXT);
  }

  let buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (error) {
    throw usageError(`Failed to read file: ${error.message}`, readGuidance(filePath));
  }
  if (buffer.length > MAX_IMAGE_UPLOAD_BYTES) {
    throw usageError(
      `The file is ${buffer.length} bytes; the maximum upload size is ${MAX_IMAGE_UPLOAD_BYTES} bytes.`,
      'Resize or compress the image below the limit, then retry.',
    );
  }

  return toUpload(buffer, fileName);
};
