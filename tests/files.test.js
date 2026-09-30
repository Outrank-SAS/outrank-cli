import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { MAX_IMAGE_UPLOAD_BYTES } from '../src/core/constants.js';
import { CliErrorCode } from '../src/core/errors.js';
import { readImageUpload, sniffImageMime } from '../src/core/files.js';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF_HEADER = Buffer.from('GIF89a');
const WEBP_HEADER = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from('WEBP')]);
const ONE_BYTE = 1;

let dir;

test.before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'outrank-cli-files-'));
});

test.after(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const write = async (name, buffer) => {
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, buffer);
  return filePath;
};

const rejectsUsage = (promise, messagePattern) =>
  assert.rejects(promise, (error) => {
    assert.equal(error.cliCode, CliErrorCode.INVALID_USAGE);
    assert.match(error.message, messagePattern);
    return true;
  });

const writeSized = async (name, header, size) => {
  const filePath = await write(name, header);
  await fs.truncate(filePath, size);
  return filePath;
};

test('a real image is returned as base64 with the mime type of its extension', async () => {
  const filePath = await write('hero.png', PNG_HEADER);
  const upload = await readImageUpload({ filePath });
  assert.deepEqual(upload, {
    file_base64: PNG_HEADER.toString('base64'),
    file_name: 'hero.png',
    file_type: 'image/png',
  });
});

test('an oversize image is rejected from its size alone, before any bytes are read', async () => {
  const oversize = await writeSized('big.png', PNG_HEADER, MAX_IMAGE_UPLOAD_BYTES + ONE_BYTE);
  await rejectsUsage(readImageUpload({ filePath: oversize }), /maximum upload size/);
  const limitPath = await writeSized('limit.png', PNG_HEADER, MAX_IMAGE_UPLOAD_BYTES);
  const atLimit = await readImageUpload({ filePath: limitPath });
  assert.equal(atLimit.file_type, 'image/png');
});

test('a text file renamed .png is rejected by the byte sniff', async () => {
  const filePath = await write('renamed.png', Buffer.from('this is not an image'));
  await rejectsUsage(readImageUpload({ filePath }), /does not look like image\/png/);
  const jpegAsPng = await write('wrong-extension.png', JPEG_HEADER);
  await rejectsUsage(readImageUpload({ filePath: jpegAsPng }), /detected image\/jpeg/);
});

test('a relative path, a missing file, a directory and an unknown extension are all usage errors', async () => {
  await rejectsUsage(readImageUpload({ filePath: 'relative.png' }), /must be absolute/);
  await rejectsUsage(readImageUpload({ filePath: path.join(dir, 'nope.png') }), /Failed to read file: ENOENT/);
  await rejectsUsage(readImageUpload({ filePath: dir }), /Not a file/);
  const text = await write('notes.txt', Buffer.from('hello'));
  await rejectsUsage(readImageUpload({ filePath: text }), /Unsupported image file extension: \.txt\./);
  await rejectsUsage(readImageUpload({ filePath: '' }), /Missing required option: --file <path>\./);
});

test('the allowed directory is enforced after resolving symlinks', async () => {
  const inside = await write('inside.gif', GIF_HEADER);
  const upload = await readImageUpload({ filePath: inside, allowedDir: dir });
  assert.equal(upload.file_type, 'image/gif');
  const otherDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outrank-cli-files-other-'));
  const outside = path.join(otherDir, 'outside.gif');
  await fs.writeFile(outside, GIF_HEADER);
  await rejectsUsage(readImageUpload({ filePath: outside, allowedDir: dir }), /must be inside/);
  await fs.rm(otherDir, { recursive: true, force: true });
});

test('the sniffer recognises every supported format and nothing else', () => {
  assert.equal(sniffImageMime(PNG_HEADER), 'image/png');
  assert.equal(sniffImageMime(JPEG_HEADER), 'image/jpeg');
  assert.equal(sniffImageMime(GIF_HEADER), 'image/gif');
  assert.equal(sniffImageMime(WEBP_HEADER), 'image/webp');
  assert.equal(sniffImageMime(Buffer.from('RIFF....WAVE')), undefined);
  assert.equal(sniffImageMime(Buffer.from('<svg/>')), undefined);
  assert.equal(sniffImageMime(Buffer.alloc(0)), undefined);
});
