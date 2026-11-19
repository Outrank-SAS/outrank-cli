import { NETWORK_ERROR_RESPONSE, NOT_FOUND_RESPONSE } from './shared.js';

const DOMAIN = 'outrank.so';
const COMPETITOR = 'surferseo.com';
const KEYWORD = 'backlink checker';

export default [
  { name: 'help', argv: ['research', '--help'], config: null },
  { name: 'unknown-command', argv: ['research', 'nonsense'] },

  { name: 'domain-overview', argv: ['research', 'domain-overview', DOMAIN] },
  { name: 'domain-overview-region', argv: ['research', 'domain-overview', DOMAIN, '--region', 'uk', '--language', 'en'] },
  { name: 'domain-overview-missing-domain', argv: ['research', 'domain-overview'] },
  { name: 'domain-overview-no-key', argv: ['research', 'domain-overview', DOMAIN], config: null },
  { name: 'domain-overview-network-error', argv: ['research', 'domain-overview', DOMAIN], responses: [NETWORK_ERROR_RESPONSE] },

  {
    name: 'domain-keywords',
    argv: ['research', 'domain-keywords', DOMAIN, '--max-position', '10', '--min-volume', '100', '--limit', '50'],
  },
  { name: 'domain-keywords-sort', argv: ['research', 'domain-keywords', DOMAIN, '--sort', 'traffic', '--offset', '50'] },
  { name: 'domain-keywords-invalid-sort', argv: ['research', 'domain-keywords', DOMAIN, '--sort', 'random'] },
  { name: 'domain-keywords-limit-too-high', argv: ['research', 'domain-keywords', DOMAIN, '--limit', '101'] },

  { name: 'competitors', argv: ['research', 'competitors', DOMAIN, '--limit', '10'] },
  { name: 'competitors-limit-too-high', argv: ['research', 'competitors', DOMAIN, '--limit', '51'] },

  {
    name: 'keyword-gap',
    argv: ['research', 'keyword-gap', DOMAIN, '--competitor', COMPETITOR, '--max-competitor-position', '10'],
  },
  { name: 'keyword-gap-missing-competitor', argv: ['research', 'keyword-gap', DOMAIN] },

  { name: 'backlinks', argv: ['research', 'backlinks', DOMAIN] },
  { name: 'backlinks-flags', argv: ['research', 'backlinks', DOMAIN, '--dofollow-only', '--all-links', '--limit', '5'] },
  { name: 'backlinks-not-found', argv: ['research', 'backlinks', DOMAIN], responses: [NOT_FOUND_RESPONSE] },

  {
    name: 'keywords-overview',
    argv: ['research', 'keywords-overview', '--keyword', 'seo tools', '--keyword', 'loan calculator, uk', '--region', 'uk'],
  },
  { name: 'keywords-overview-missing-keyword', argv: ['research', 'keywords-overview'] },

  { name: 'serp', argv: ['research', 'serp', KEYWORD] },
  { name: 'serp-resolve-urls', argv: ['research', 'serp', KEYWORD, '--resolve-urls', '--depth', '20', '--region', 'fr'] },
  { name: 'serp-missing-keyword', argv: ['research', 'serp'] },
  { name: 'serp-depth-too-low', argv: ['research', 'serp', KEYWORD, '--depth', '5'] },
];
