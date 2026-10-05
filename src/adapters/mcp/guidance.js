import { CliErrorCode } from '../../core/errors.js';
import { buildRouteIndex, rewriteRouteMentions } from './routes.js';

export const CLI_HELP_HINT = 'Run `outrank-cli --help` to see available command groups.';

export const CLI_PHRASES = Object.freeze([
  [CLI_HELP_HINT, ''],
  ['pass --product when running per-product commands', 'pass product_id to per-product tools'],
  ['Available command groups:', 'Available toolsets:'],
  ['treat every command group as available', 'treat every toolset as available'],
  ['review billing commands', 'review the billing tools'],
  ['checkout via the billing commands', 'checkout via the billing tools'],
  ['the seller marketplace commands already work', 'the seller marketplace tools already work'],
  ['switch to a bulk command (most groups have one)', 'switch to a bulk tool (most toolsets have one)'],
  ['via the products integrations commands', 'via the products_integrations tools'],
  ['with the products integrations commands', 'with the products_integrations tools'],
  ['article commands for it may be rejected', 'article tools for it may be rejected'],
  ['continue with the relevant agent command', 'continue with the relevant tool'],
]);

const CLI_ERROR_CODES = new Set(Object.values(CliErrorCode));
const HINT_WITH_LEADING_SPACE = ` ${CLI_HELP_HINT}`;

const isServerEnvelope = (envelope) => envelope.ok === true || !CLI_ERROR_CODES.has(envelope.error?.code);

const replacePhrases = (text) =>
  CLI_PHRASES.reduce(
    (current, [phrase, replacement]) => current.replaceAll(phrase, replacement),
    text.replaceAll(HINT_WITH_LEADING_SPACE, ''),
  ).trimEnd();

export const rewriteGuidanceText = (index, text, { toolsets } = {}) =>
  replacePhrases(rewriteRouteMentions(index, text, { toolsets }));

export const createGuidanceRewriter = async (registry) => {
  const index = await buildRouteIndex(registry);
  const rewrite = (envelope, spec) => {
    if (typeof envelope?.agent_guidance !== 'string' || !isServerEnvelope(envelope)) return envelope;
    const agentGuidance = rewriteGuidanceText(index, envelope.agent_guidance, { toolsets: spec?.toolsets });
    return { ...envelope, agent_guidance: agentGuidance };
  };
  return { index, rewrite };
};
