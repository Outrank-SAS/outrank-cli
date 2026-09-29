import { MALFORMED_JSON_RESPONSE, NOT_FOUND_RESPONSE } from './shared.js';

export default [
  { name: 'help', argv: ['usage', '--help'], config: null },
  { name: 'stats', argv: ['usage', 'stats'] },
  { name: 'stats-api-error', argv: ['usage', 'stats'], responses: [NOT_FOUND_RESPONSE] },
  { name: 'stats-malformed-json-body', argv: ['usage', 'stats'], responses: [MALFORMED_JSON_RESPONSE] },
  { name: 'stats-no-key', argv: ['usage', 'stats'], config: null },
  { name: 'unknown-subcommand', argv: ['usage', 'nonsense'] },
];
