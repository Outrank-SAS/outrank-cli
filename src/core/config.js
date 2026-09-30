import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import {
  API_KEY_SUFFIX_LENGTH,
  CONFIG_DIR_MODE,
  CONFIG_FILE_MODE,
  CONFIG_TEMP_SUFFIX_BYTES,
  DEFAULT_PROFILE_NAME,
  MAX_CONFIG_SYMLINK_HOPS,
  MAX_PROFILE_NAME_LENGTH,
  MIN_API_KEY_LENGTH_FOR_SUFFIX,
  PROFILE_NAME_PATTERN,
} from './constants.js';
import { CliErrorCode, codedError } from './errors.js';

const CONFIG_DIR_ENV = 'OUTRANK_CONFIG_DIR';
const CONFIG_DIR_NAME = '.outrank';
const CONFIG_FILE_NAME = 'config.json';
const TEMP_FILE_EXTENSION = '.tmp';
const BYTE_ORDER_MARK = '﻿';
const PRINTABLE_ASCII_PATTERN = /^[\x20-\x7e]$/;
const TRUNCATION_MARK = '...';
export const API_KEY_FIELD = 'apiKey';
export const BASE_URL_FIELD = 'baseUrl';
const DEFAULT_PROFILE_FIELD = 'defaultProfile';
const PROFILES_FIELD = 'profiles';
const PROFILE_FIELDS = Object.freeze([API_KEY_FIELD, BASE_URL_FIELD]);
const MANAGED_TOP_LEVEL_KEYS = new Set([API_KEY_FIELD, BASE_URL_FIELD, DEFAULT_PROFILE_FIELD, PROFILES_FIELD]);
const MISSING_FILE_CODE = 'ENOENT';
const SYMLINK_LOOP_CODE = 'ELOOP';
const UNKNOWN_FS_ERROR_REASON = 'unknown filesystem error';
const INVALID_JSON_REASON = 'it is not valid JSON';
const NOT_AN_OBJECT_REASON = 'it is not a JSON object';
const CONFIG_UNREADABLE_GUIDANCE =
  'Fix or delete the file at details.config_path, or point OUTRANK_CONFIG_DIR at another directory, then retry. ' +
  '`auth login` and `auth logout` never overwrite a config file they cannot fully parse.';
const CONFIG_UNWRITABLE_GUIDANCE =
  'Nothing was saved. Check that details.config_path is writable and not locked by another program, or point ' +
  'OUTRANK_CONFIG_DIR at a writable directory, then run the command again.';

const getConfigDir = () => {
  const override = process.env[CONFIG_DIR_ENV];
  return override ? path.resolve(override) : path.join(os.homedir(), CONFIG_DIR_NAME);
};
export const getConfigPath = () => path.join(getConfigDir(), CONFIG_FILE_NAME);

export const isSet = (value) => typeof value === 'string' && value !== '';
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const isValidProfileName = (name) =>
  typeof name === 'string' && name.length <= MAX_PROFILE_NAME_LENGTH && PROFILE_NAME_PATTERN.test(name);

export const redactApiKey = (apiKey) =>
  typeof apiKey === 'string' && apiKey.length >= MIN_API_KEY_LENGTH_FOR_SUFFIX
    ? apiKey.slice(-API_KEY_SUFFIX_LENGTH)
    : null;

const ownEntry = (source, name) => (isPlainObject(source) && Object.hasOwn(source, name) ? source[name] : undefined);

const pickProfileFields = (source) =>
  Object.fromEntries(PROFILE_FIELDS.filter((field) => isSet(source?.[field])).map((field) => [field, source[field]]));

const preservedProfileFields = (source) =>
  Object.fromEntries(Object.entries(source ?? {}).filter(([key]) => !PROFILE_FIELDS.includes(key)));

const omitField = (source, field) => Object.fromEntries(Object.entries(source).filter(([key]) => key !== field));

const configUnreadableError = (reason) =>
  codedError(
    CliErrorCode.CONFIG_UNREADABLE,
    `The stored config file could not be read: ${reason}.`,
    CONFIG_UNREADABLE_GUIDANCE,
    { config_path: getConfigPath() },
  );

const configUnwritableError = (error) =>
  codedError(
    CliErrorCode.CONFIG_UNWRITABLE,
    `The config file could not be written: ${error.code ?? UNKNOWN_FS_ERROR_REASON}.`,
    CONFIG_UNWRITABLE_GUIDANCE,
    { config_path: getConfigPath(), fs_code: error.code ?? null },
  );

const isPrintableAscii = (character) => PRINTABLE_ASCII_PATTERN.test(character);

export const describeUntrustedValue = (value) => {
  if (typeof value !== 'string') return `a non-string value (${value === null ? 'null' : typeof value})`;
  const printable = [...value].filter(isPrintableAscii).join('');
  const excerpt = printable.slice(0, MAX_PROFILE_NAME_LENGTH);
  return JSON.stringify(excerpt.length < printable.length ? `${excerpt}${TRUNCATION_MARK}` : excerpt);
};

const fieldTypeProblem = (owner, entry) => {
  for (const field of PROFILE_FIELDS) {
    if (entry[field] !== undefined && typeof entry[field] !== 'string') return `${owner} has a non-string ${field}`;
  }
  return null;
};

const profilesShapeProblem = (profiles) => {
  if (profiles === undefined) return null;
  if (!isPlainObject(profiles)) return `${PROFILES_FIELD} is not a JSON object`;
  for (const [name, entry] of Object.entries(profiles)) {
    if (!isValidProfileName(name)) return `profile name ${describeUntrustedValue(name)} is invalid`;
    if (!isPlainObject(entry)) return `profile ${describeUntrustedValue(name)} is not a JSON object`;
    const problem = fieldTypeProblem(`profile ${describeUntrustedValue(name)}`, entry);
    if (problem) return problem;
  }
  return null;
};

const configShapeProblem = (raw) => {
  if (!isPlainObject(raw)) return null;
  const topLevelProblem = fieldTypeProblem('the config file', raw);
  if (topLevelProblem) return topLevelProblem;
  const defaultProfile = ownEntry(raw, DEFAULT_PROFILE_FIELD);
  if (defaultProfile !== undefined && !isValidProfileName(defaultProfile)) {
    return `${DEFAULT_PROFILE_FIELD} ${describeUntrustedValue(defaultProfile)} is not a valid profile name`;
  }
  return profilesShapeProblem(ownEntry(raw, PROFILES_FIELD));
};

export const readProfiles = (raw) => {
  const problem = configShapeProblem(raw);
  if (problem) throw configUnreadableError(problem);
  const mirror = pickProfileFields(raw);
  const defaultProfile = ownEntry(raw, DEFAULT_PROFILE_FIELD) ?? DEFAULT_PROFILE_NAME;
  const rawProfiles = ownEntry(raw, PROFILES_FIELD);
  if (rawProfiles === undefined) {
    const profiles = Object.keys(mirror).length > 0 ? { [defaultProfile]: mirror } : {};
    return { defaultProfile, profiles };
  }
  const profiles = Object.fromEntries(
    Object.entries(rawProfiles).map(([name, entry]) => [name, pickProfileFields(entry)]),
  );
  if (Object.keys(mirror).length > 0) profiles[defaultProfile] = mirror;
  return { defaultProfile, profiles };
};

export const serializeProfiles = (raw, { defaultProfile, profiles }) => {
  const rawProfiles = ownEntry(raw, PROFILES_FIELD) ?? {};
  const preserved = Object.fromEntries(
    Object.entries(isPlainObject(raw) ? raw : {}).filter(([key]) => !MANAGED_TOP_LEVEL_KEYS.has(key)),
  );
  const merged = Object.fromEntries(
    Object.entries(profiles).map(([name, entry]) => [
      name,
      { ...preservedProfileFields(ownEntry(rawProfiles, name)), ...entry },
    ]),
  );
  return { ...pickProfileFields(profiles[defaultProfile]), defaultProfile, profiles: merged, ...preserved };
};

export const loadConfig = async () => {
  let text;
  try {
    text = await fs.readFile(getConfigPath(), 'utf8');
  } catch (error) {
    if (error.code === MISSING_FILE_CODE) return {};
    throw configUnreadableError(error.code ?? UNKNOWN_FS_ERROR_REASON);
  }
  let config;
  try {
    config = JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text);
  } catch {
    throw configUnreadableError(INVALID_JSON_REASON);
  }
  if (!isPlainObject(config)) throw configUnreadableError(NOT_AN_OBJECT_REASON);
  const problem = configShapeProblem(config);
  if (problem) throw configUnreadableError(problem);
  return config;
};

export const loadProfiles = async () => readProfiles(await loadConfig());

const isSymbolicLink = async (filePath) => {
  try {
    return (await fs.lstat(filePath)).isSymbolicLink();
  } catch (error) {
    if (error.code === MISSING_FILE_CODE) return false;
    throw error;
  }
};

const resolveDanglingLink = async (filePath) => {
  let current = filePath;
  for (let hop = 0; hop < MAX_CONFIG_SYMLINK_HOPS; hop += 1) {
    if (!(await isSymbolicLink(current))) return current;
    const directory = await fs.realpath(path.dirname(current));
    current = path.resolve(directory, await fs.readlink(current));
  }
  throw Object.assign(new Error(`Too many symbolic links at ${filePath}`), { code: SYMLINK_LOOP_CODE });
};

const resolveWriteTarget = async (filePath) => {
  try {
    return await fs.realpath(filePath);
  } catch (error) {
    if (error.code === MISSING_FILE_CODE) return resolveDanglingLink(filePath);
    throw error;
  }
};

const removeQuietly = async (filePath) => {
  try {
    await fs.rm(filePath, { force: true });
  } catch {
    return;
  }
};

const writeFileAtomically = async (filePath, text) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: CONFIG_DIR_MODE });
  const target = await resolveWriteTarget(filePath);
  const suffix = randomBytes(CONFIG_TEMP_SUFFIX_BYTES).toString('hex');
  const tempPath = `${target}.${process.pid}.${suffix}${TEMP_FILE_EXTENSION}`;
  try {
    await fs.writeFile(tempPath, text, { encoding: 'utf8', mode: CONFIG_FILE_MODE, flag: 'wx' });
    await fs.chmod(tempPath, CONFIG_FILE_MODE);
    await fs.rename(tempPath, target);
  } catch (error) {
    await removeQuietly(tempPath);
    throw error;
  }
};

export const saveProfiles = async (raw, state) => {
  const serialized = serializeProfiles(raw, state);
  try {
    await writeFileAtomically(getConfigPath(), `${JSON.stringify(serialized, null, 2)}\n`);
  } catch (error) {
    throw configUnwritableError(error);
  }
  return serialized;
};

const hasStoredApiKey = (profiles) => Object.values(profiles).some((profile) => isSet(profile[API_KEY_FIELD]));

export const storeProfileAuth = async ({ profile, apiKey, baseUrl, makeDefault = false }) => {
  const raw = await loadConfig();
  const state = readProfiles(raw);
  const stored = { ...(ownEntry(state.profiles, profile) ?? {}), [API_KEY_FIELD]: apiKey };
  if (baseUrl) stored[BASE_URL_FIELD] = baseUrl;
  const profiles = { ...state.profiles, [profile]: stored };
  const defaultProfile = makeDefault || !hasStoredApiKey(state.profiles) ? profile : state.defaultProfile;
  await saveProfiles(raw, { defaultProfile, profiles });
  return { profile, isDefault: defaultProfile === profile, stored, defaultProfile, profiles };
};

export const clearProfileAuth = async ({ profile }) => {
  const raw = await loadConfig();
  const state = readProfiles(raw);
  const entry = ownEntry(state.profiles, profile);
  if (!entry || !isSet(entry[API_KEY_FIELD])) return { ...state, removed: false };
  const profiles = { ...state.profiles, [profile]: omitField(entry, API_KEY_FIELD) };
  await saveProfiles(raw, { defaultProfile: state.defaultProfile, profiles });
  return { defaultProfile: state.defaultProfile, profiles, removed: true };
};
