import { PROFILE_ENV, ProfileSource } from './constants.js';

const SELECTED_BY_ENV_HINT =
  ` The profile was selected by ${PROFILE_ENV}; unset it (or remove it from the MCP host configuration) to use ` +
  'the default profile instead.';

export const profileSelectedByEnvHint = (source) => (source === ProfileSource.ENV ? SELECTED_BY_ENV_HINT : '');
