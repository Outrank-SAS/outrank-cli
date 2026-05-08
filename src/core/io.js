import fs from 'node:fs/promises';
import path from 'node:path';

export const emitJson = (value) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

export const emitAndExit = (value, code = 0) => {
  emitJson(value);
  process.exitCode = code;
};

export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const readJsonFile = async (filePath) => {
  const content = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
};

export const ensureDirectory = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

export const resolvePath = (value) => path.resolve(process.cwd(), value);

export const readStdin = async () => {
  if (process.stdin.isTTY) return '';

  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
};
