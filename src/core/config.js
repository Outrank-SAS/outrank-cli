import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { ensureDirectory, fileExists } from './io.js';

const DEFAULT_BASE_URL = 'https://outrank.so';

const getConfigDir = () => process.env.OUTRANK_CONFIG_DIR || path.join(os.homedir(), '.outrank');
export const getConfigPath = () => path.join(getConfigDir(), 'config.json');

export const loadConfig = async () => {
  const configPath = getConfigPath();
  if (!(await fileExists(configPath))) {
    return {};
  }

  const raw = await fs.readFile(configPath, 'utf8');
  try {
    const config = JSON.parse(raw);
    return config && typeof config === 'object' ? config : {};
  } catch {
    return {};
  }
};

export const saveConfig = async (config) => {
  const configPath = getConfigPath();
  await ensureDirectory(path.dirname(configPath));
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
};

export const clearStoredAuth = async () => {
  const configPath = getConfigPath();
  const current = await loadConfig();
  if (!(await fileExists(configPath))) {
    return current;
  }
  const next = { ...current };
  delete next.apiKey;
  await saveConfig(next);
  return next;
};

const normalizeBaseUrl = (value) => {
  const url = new URL(value || DEFAULT_BASE_URL);
  return url.origin.replace(/\/$/, '');
};

export const resolveRuntimeConfig = async (parsed) => {
  const config = await loadConfig();
  const apiKey =
    process.env.OUTRANK_API_KEY ||
    (parsed ? parsed.options.get('api-key')?.slice(-1)[0] : undefined) ||
    config.apiKey;
  const baseUrl =
    process.env.OUTRANK_BASE_URL ||
    (parsed ? parsed.options.get('base-url')?.slice(-1)[0] : undefined) ||
    config.baseUrl ||
    DEFAULT_BASE_URL;

  return {
    apiKey,
    baseUrl: normalizeBaseUrl(baseUrl),
    config,
  };
};

export const storeAuthConfig = async ({ apiKey, baseUrl }) => {
  const current = await loadConfig();
  const next = {
    ...current,
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl: normalizeBaseUrl(baseUrl) } : {}),
  };
  await saveConfig(next);
  return next;
};

export const getDefaultBaseUrl = () => DEFAULT_BASE_URL;
