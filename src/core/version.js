import { readFileSync } from 'node:fs';

const UNKNOWN_VERSION = 'unknown';

export const getVersion = () => {
  try {
    const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    return packageJson.version || UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
};
