import { AI_CITATIONS_PERIOD_WEEKS, AI_CITED_LISTS_ENTRY_MODES, AI_CITED_LISTS_LIST_VIEWS } from '../core/constants.js';
import { Surface } from '../core/context.js';
import { usageError } from '../core/errors.js';
import { bool, list, object, oneOf, string, uuid } from '../core/schema.js';
import {
  ATTEMPT_ID_PLACEHOLDERS,
  PRODUCT_CLI,
  attemptIdInput,
  attemptIdQuery,
  productInput,
  productParams,
  productParamsWith,
  withProduct,
} from './products/shared.js';
import { BodyMode, CommandKind, Toolset, defineCommand, defineGroup } from './registry.js';
import { subGroup } from './subGroup.js';

const SENDER_NAME_HINT = 'Name that signs the outreach emails.';
const SENDER_TITLE_HINT = 'Job title under the signature.';
const POSTAL_ADDRESS_HINT = 'Company postal address printed in every email (required by anti-spam law).';
const OUTRANK_ANSWERS_HINT = "true lets Outrank answer owner replies from the customer's mailbox.";
const OUTREACH_PAUSED_HINT = 'true stops new offers; live spots and open offers stay.';
const ALLOW_SECOND_HINT = 'true also pitches the #2 spot (default); false asks for #1 only.';
const LISTING_BLURB_HINT = 'Short product description owners see on the offer page, or null to clear it.';
const BLOCKED_SITES_HINT = 'Hosts never to contact.';
const ENTRY_MODE_HINT = 'generated uses the entry Outrank wrote; custom uses custom_entry.';
const CUSTOM_ENTRY_HINT = 'Entry written by the customer; links may only point to the product site.';
const CUSTOM_ENTRY_MARKDOWN_HINT = 'The entry text as markdown.';

const SETTINGS_BODY = object().shape({
  sender_name: string().describe(SENDER_NAME_HINT),
  sender_title: string().describe(SENDER_TITLE_HINT),
  postal_address: string().describe(POSTAL_ADDRESS_HINT),
  outrank_answers_replies: bool().describe(OUTRANK_ANSWERS_HINT),
  outreach_paused: bool().describe(OUTREACH_PAUSED_HINT),
  allow_second_position: bool().describe(ALLOW_SECOND_HINT),
  listing_blurb: string().nullable().describe(LISTING_BLURB_HINT),
  blocked_sites: list().describe(BLOCKED_SITES_HINT),
  entry_mode: oneOf(AI_CITED_LISTS_ENTRY_MODES).describe(ENTRY_MODE_HINT),
  custom_entry: object()
    .shape({
      markdown: string().required().describe(CUSTOM_ENTRY_MARKDOWN_HINT),
    })
    .describe(CUSTOM_ENTRY_HINT),
});

export const AI_CITED_LISTS_HELP = `Usage:
  outrank-cli ai-cited-lists status <product-id>
  outrank-cli ai-cited-lists overview <product-id>
  outrank-cli ai-cited-lists lists list <product-id> [--view all|to_send|skipped]
  outrank-cli ai-cited-lists lists skip <product-id> <list-id>
  outrank-cli ai-cited-lists lists unskip <product-id> <list-id>
  outrank-cli ai-cited-lists outreach <product-id>
  outrank-cli ai-cited-lists offers get <product-id> <offer-id>
  outrank-cli ai-cited-lists offers withdraw <product-id> <offer-id>
  outrank-cli ai-cited-lists wins get <product-id> <offer-id>
  outrank-cli ai-cited-lists questions list <product-id>
  outrank-cli ai-cited-lists questions add <product-id> --question "<text>"
  outrank-cli ai-cited-lists questions edit <product-id> <question-id> --question "<text>"
  outrank-cli ai-cited-lists questions remove <product-id> <question-id>
  outrank-cli ai-cited-lists settings get <product-id>
  outrank-cli ai-cited-lists settings update <product-id> --json <object>
  outrank-cli ai-cited-lists mailbox get <product-id>
  outrank-cli ai-cited-lists mailbox connect <product-id> [--email <address>]
  outrank-cli ai-cited-lists mailbox poll <product-id> --attempt-id <attempt-id>
  outrank-cli ai-cited-lists mailbox domain-check <product-id>
  outrank-cli ai-cited-lists mailbox inbox-test <product-id>
  outrank-cli ai-cited-lists mailbox filter-test <product-id>
  outrank-cli ai-cited-lists mailbox dkim-selector <product-id> --selector <name> | --reset
  outrank-cli ai-cited-lists mailbox disconnect <product-id>
  outrank-cli ai-cited-lists top-up-consent get <product-id>
  outrank-cli ai-cited-lists top-up-consent confirm <product-id>
  outrank-cli ai-cited-lists entry generate <product-id>
  outrank-cli ai-cited-lists setup finish <product-id>
  outrank-cli ai-cited-lists citations summary <product-id> [--weeks 4|12]
  outrank-cli ai-cited-lists citations check <product-id>

JSON Input:
  Use one of: --json '<object>', --json-file payload.json, or --json-stdin

Notes:
  AI-Cited Lists is part of the Backlinks Enterprise plan: Outrank asks ChatGPT the product's buyer questions
  several times a week, finds the "best of" lists it cites, and emails each list's owner from the customer's own
  Google mailbox with a paid offer for the #1 or #2 spot. Credits are charged only once the owner has placed
  the product (top-up-consent get shows the prices); a short balance is covered by an automatic credit-pack
  purchase that an organization admin confirms once with top-up-consent confirm. Sending needs a connected
  mailbox with four green checks, the sender details and that consent: status lists what is still missing.
  mailbox connect returns a connect_url the human opens in a browser; entry generate takes a few minutes.

Examples:
  outrank-cli ai-cited-lists status 00000000-0000-0000-0000-000000000000
  outrank-cli ai-cited-lists lists list 00000000-0000-0000-0000-000000000000 --view to_send
  outrank-cli ai-cited-lists lists skip 00000000-0000-0000-0000-000000000000 00000000-0000-0000-0000-000000000000
  outrank-cli ai-cited-lists questions add 00000000-0000-0000-0000-000000000000 --question "What is the best privacy-friendly analytics tool?"
  outrank-cli ai-cited-lists settings update 00000000-0000-0000-0000-000000000000 --json '{"sender_name":"Ada Lovelace","sender_title":"Founder","postal_address":"1 Main St, Austin, TX 78701"}'
  outrank-cli ai-cited-lists mailbox connect 00000000-0000-0000-0000-000000000000 --email ada@acme.com
  outrank-cli ai-cited-lists mailbox poll 00000000-0000-0000-0000-000000000000 --attempt-id <attempt-id>
  outrank-cli ai-cited-lists top-up-consent confirm 00000000-0000-0000-0000-000000000000
  outrank-cli ai-cited-lists citations summary 00000000-0000-0000-0000-000000000000 --weeks 12
`;

const LISTS_HELP = `Usage:
  outrank-cli ai-cited-lists lists list <product-id> [--view all|to_send|skipped]
  outrank-cli ai-cited-lists lists skip <product-id> <list-id>
  outrank-cli ai-cited-lists lists unskip <product-id> <list-id>
`;
const OFFERS_HELP = `Usage:
  outrank-cli ai-cited-lists offers get <product-id> <offer-id>
  outrank-cli ai-cited-lists offers withdraw <product-id> <offer-id>
`;
const WINS_HELP = `Usage:
  outrank-cli ai-cited-lists wins get <product-id> <offer-id>
`;
const QUESTIONS_HELP = `Usage:
  outrank-cli ai-cited-lists questions list <product-id>
  outrank-cli ai-cited-lists questions add <product-id> --question "<text>"
  outrank-cli ai-cited-lists questions edit <product-id> <question-id> --question "<text>"
  outrank-cli ai-cited-lists questions remove <product-id> <question-id>
`;
const SETTINGS_HELP = `Usage:
  outrank-cli ai-cited-lists settings get <product-id>
  outrank-cli ai-cited-lists settings update <product-id> --json <object>
`;
const MAILBOX_HELP = `Usage:
  outrank-cli ai-cited-lists mailbox get <product-id>
  outrank-cli ai-cited-lists mailbox connect <product-id> [--email <address>]
  outrank-cli ai-cited-lists mailbox poll <product-id> --attempt-id <attempt-id>
  outrank-cli ai-cited-lists mailbox domain-check <product-id>
  outrank-cli ai-cited-lists mailbox inbox-test <product-id>
  outrank-cli ai-cited-lists mailbox filter-test <product-id>
  outrank-cli ai-cited-lists mailbox dkim-selector <product-id> --selector <name> | --reset
  outrank-cli ai-cited-lists mailbox disconnect <product-id>
`;
const TOP_UP_CONSENT_HELP = `Usage:
  outrank-cli ai-cited-lists top-up-consent get <product-id>
  outrank-cli ai-cited-lists top-up-consent confirm <product-id>
`;
const ENTRY_HELP = `Usage:
  outrank-cli ai-cited-lists entry generate <product-id>
`;
const SETUP_HELP = `Usage:
  outrank-cli ai-cited-lists setup finish <product-id>
`;
const CITATIONS_HELP = `Usage:
  outrank-cli ai-cited-lists citations summary <product-id> [--weeks 4|12]
  outrank-cli ai-cited-lists citations check <product-id>
`;

const TOOLSETS = [Toolset.AI_CITED_LISTS];
const GROUP_ID = 'ai-cited-lists';
const BASE_PATH = '/products/{productId}/ai-cited-lists';
const CITATIONS_PATH = '/products/{productId}/ai-citations';
const LIST_CLI = withProduct(['listId']);
const OFFER_CLI = withProduct(['offerId']);
const QUESTION_CLI = withProduct(['questionId']);
const POLL_SETTINGS_GET = 'ai-cited-lists.settings.get';
const QUESTION_REQUIRED = {
  guidance: 'Pass the buyer question as text, e.g. `--question "What is the best CRM?"`.',
};
const ATTEMPT_ID_GUIDANCE = 'Pass the attempt_id returned by `ai-cited-lists mailbox connect`.';
const DKIM_SELECTOR_WORDING = Object.freeze({
  [Surface.CLI]: {
    message: 'Pass exactly one of --selector or --reset.',
    guidance: 'Pass `--selector <name>` to set the Workspace DKIM selector, or `--reset` to go back to the default.',
  },
  [Surface.MCP]: {
    message: 'Pass exactly one of selector or reset.',
    guidance: 'Send selector: "<name>" to set the Workspace DKIM selector, or reset: true to go back to the default.',
  },
});
const EMPTY_SELECTOR = null;

const OVERVIEW_UNTRUSTED_FIELDS = [
  'wins[].title',
  'wins[].url',
  'wins[].host',
  'wins[].author_name',
  'latest_win.before',
  'latest_win.match',
  'latest_win.after',
  'latest_win.list_host',
];
const LISTS_UNTRUSTED_FIELDS = [
  'lists[].title',
  'lists[].url',
  'lists[].host',
  'lists[].top_entries[].name',
  'left_out[].example',
];
const OUTREACH_UNTRUSTED_FIELDS = [
  'offers[].title',
  'offers[].url',
  'offers[].host',
  'offers[].contact',
  'replies[].from',
  'replies[].excerpt',
];
const OFFER_UNTRUSTED_FIELDS = [
  'title',
  'url',
  'host',
  'contact',
  'top_entries[].name',
  'timeline[].quote',
  'first_email.subject',
  'first_email.body',
];
const WIN_UNTRUSTED_FIELDS = [
  'title',
  'url',
  'host',
  'author_name',
  'answers[].before',
  'answers[].match',
  'answers[].after',
  'answers[].sources',
  'owner_reply.text',
  'timeline[].quote',
];
const CITATIONS_UNTRUSTED_FIELDS = [
  'latest_named_answer.excerpt.before',
  'latest_named_answer.excerpt.match',
  'latest_named_answer.excerpt.after',
  'latest_named_answer.via.url',
  'latest_named_answer.via.domain',
  'pages[].url',
  'pages[].domain',
  'pages[].title',
];

const untrusted = (untrustedFields) => ({
  untrustedOutput: true,
  untrustedFields,
});

const status = defineCommand({
  id: `${GROUP_ID}.status`,
  summary: 'Get the AI-Cited Lists state of a product: counters, setup requirements and onboarding.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  entryPoint: true,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/status`,
      pathParams: productParams(input),
    }),
});

const overview = defineCommand({
  id: `${GROUP_ID}.overview`,
  summary: 'Get the AI-Cited Lists results of a product: won lists, credits used, open offers.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: untrusted(OVERVIEW_UNTRUSTED_FIELDS),
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/overview`,
      pathParams: productParams(input),
    }),
});

const listsList = defineCommand({
  id: `${GROUP_ID}.lists.list`,
  summary: "List this week's ChatGPT-cited lists and the position we would ask for on each.",
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: untrusted(LISTS_UNTRUSTED_FIELDS),
  input: { ...productInput(), view: oneOf(AI_CITED_LISTS_LIST_VIEWS) },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/lists`,
      pathParams: productParams(input),
      query: { view: input.view },
    }),
});

const listAction = (action, summary) =>
  defineCommand({
    id: `${GROUP_ID}.lists.${action}`,
    summary,
    kind: CommandKind.WRITE,
    toolsets: TOOLSETS,
    input: { ...productInput(), listId: uuid().required() },
    cli: LIST_CLI,
    run: (input, ctx) =>
      ctx.http({
        method: 'POST',
        path: `${BASE_PATH}/lists/{listId}/${action}`,
        pathParams: productParamsWith(input, 'listId'),
      }),
  });

const listsSkip = listAction('skip', 'Skip a cited list so no offer goes out for it.');
const listsUnskip = listAction('unskip', 'Put a skipped list back in the offer queue.');

const outreach = defineCommand({
  id: `${GROUP_ID}.outreach`,
  summary: 'List every offer of a product with its stage, the latest owner replies and the sending health.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: untrusted(OUTREACH_UNTRUSTED_FIELDS),
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/outreach`,
      pathParams: productParams(input),
    }),
});

const offerInput = () => ({ ...productInput(), offerId: uuid().required() });

const offersGet = defineCommand({
  id: `${GROUP_ID}.offers.get`,
  summary: 'Get one offer: stage, owner contact, email timeline and the entry we asked for.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: untrusted(OFFER_UNTRUSTED_FIELDS),
  input: offerInput(),
  cli: OFFER_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/offers/{offerId}`,
      pathParams: productParamsWith(input, 'offerId'),
    }),
});

const offersWithdraw = defineCommand({
  id: `${GROUP_ID}.offers.withdraw`,
  summary: 'Withdraw a draft or sent offer; the owner can no longer claim the spot.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: offerInput(),
  cli: OFFER_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${BASE_PATH}/offers/{offerId}/withdraw`,
      pathParams: productParamsWith(input, 'offerId'),
    }),
});

const winsGet = defineCommand({
  id: `${GROUP_ID}.wins.get`,
  summary: 'Get the proof page of a won list: ChatGPT answers naming the product and the daily checks.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: untrusted(WIN_UNTRUSTED_FIELDS),
  input: offerInput(),
  cli: OFFER_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/wins/{offerId}`,
      pathParams: productParamsWith(input, 'offerId'),
    }),
});

const questionsList = defineCommand({
  id: `${GROUP_ID}.questions.list`,
  summary: 'List the buyer questions asked to ChatGPT for a product.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/questions`,
      pathParams: productParams(input),
    }),
});

const questionsAdd = defineCommand({
  id: `${GROUP_ID}.questions.add`,
  summary: 'Add a buyer question to ask ChatGPT.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...productInput(), question: string().required(QUESTION_REQUIRED) },
  cli: { ...PRODUCT_CLI, placeholders: { question: '<text>' } },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${BASE_PATH}/questions`,
      pathParams: productParams(input),
      body: { question: input.question },
    }),
});

const questionsEdit = defineCommand({
  id: `${GROUP_ID}.questions.edit`,
  summary: 'Change the wording of a tracked buyer question.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: {
    ...productInput(),
    questionId: uuid().required(),
    question: string().required(QUESTION_REQUIRED),
  },
  cli: { ...QUESTION_CLI, placeholders: { question: '<text>' } },
  run: (input, ctx) =>
    ctx.http({
      method: 'PATCH',
      path: `${BASE_PATH}/questions/{questionId}`,
      pathParams: productParamsWith(input, 'questionId'),
      body: { question: input.question },
    }),
});

const questionsRemove = defineCommand({
  id: `${GROUP_ID}.questions.remove`,
  summary: 'Stop asking a buyer question.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: { ...productInput(), questionId: uuid().required() },
  cli: QUESTION_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'DELETE',
      path: `${BASE_PATH}/questions/{questionId}`,
      pathParams: productParamsWith(input, 'questionId'),
    }),
});

const settingsGet = defineCommand({
  id: `${GROUP_ID}.settings.get`,
  summary: 'Get the AI-Cited Lists settings of a product: sender details, positions, pause, entry.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/settings`,
      pathParams: productParams(input),
    }),
});

const settingsUpdate = defineCommand({
  id: `${GROUP_ID}.settings.update`,
  summary: 'Update the AI-Cited Lists settings of a product from a JSON body.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  body: BodyMode.JSON,
  bodyField: SETTINGS_BODY,
  run: (input, ctx) =>
    ctx.http({
      method: 'PATCH',
      path: `${BASE_PATH}/settings`,
      pathParams: productParams(input),
      body: input.body,
    }),
});

const mailboxGet = defineCommand({
  id: `${GROUP_ID}.mailbox.get`,
  summary: 'Get the connected Google mailbox and its four sending checks.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/mailbox`,
      pathParams: productParams(input),
    }),
});

const mailboxDisconnect = defineCommand({
  id: `${GROUP_ID}.mailbox.disconnect`,
  summary: 'Disconnect the Google mailbox and revoke its token.',
  kind: CommandKind.DESTRUCTIVE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'DELETE',
      path: `${BASE_PATH}/mailbox`,
      pathParams: productParams(input),
    }),
});

const mailboxConnect = defineCommand({
  id: `${GROUP_ID}.mailbox.connect`,
  summary: 'Start the Google mailbox connection: returns a connect_url for the human and an attempt_id to poll.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...productInput(), email: string() },
  cli: { ...PRODUCT_CLI, placeholders: { email: '<address>' } },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${BASE_PATH}/mailbox/connect`,
      pathParams: productParams(input),
      body: { email: input.email },
    }),
});

const mailboxPoll = defineCommand({
  id: `${GROUP_ID}.mailbox.poll`,
  summary: 'Poll a mailbox connection attempt until Google consent completed.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: { ...productInput(), ...attemptIdInput(ATTEMPT_ID_GUIDANCE) },
  cli: { ...PRODUCT_CLI, placeholders: ATTEMPT_ID_PLACEHOLDERS },
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/mailbox/connect`,
      pathParams: productParams(input),
      query: attemptIdQuery(input),
    }),
});

const mailboxAction = (action, summary) =>
  defineCommand({
    id: `${GROUP_ID}.mailbox.${action}`,
    summary,
    kind: CommandKind.WRITE,
    toolsets: TOOLSETS,
    input: productInput(),
    cli: PRODUCT_CLI,
    run: (input, ctx) =>
      ctx.http({
        method: 'POST',
        path: `${BASE_PATH}/mailbox/${action}`,
        pathParams: productParams(input),
      }),
  });

const mailboxDomainCheck = mailboxAction('domain-check', 'Re-run the SPF, DKIM and DMARC check of the mailbox domain.');
const mailboxInboxTest = mailboxAction(
  'inbox-test',
  'Send the seed-list inbox test from the mailbox (server rate-limited).',
);
const mailboxFilterTest = mailboxAction(
  'filter-test',
  'Send the reply-filter test email to confirm replies reach Outrank.',
);

const mailboxDkimSelector = defineCommand({
  id: `${GROUP_ID}.mailbox.dkim-selector`,
  summary: 'Set the Google Workspace DKIM selector of the mailbox domain, or reset it to the default.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: { ...productInput(), selector: string(), reset: bool() },
  cli: { ...PRODUCT_CLI, placeholders: { selector: '<name>' } },
  refine: (input, ctx) => {
    const hasSelector = input.selector !== undefined;
    if (hasSelector === Boolean(input.reset)) {
      const wording = DKIM_SELECTOR_WORDING[ctx.surface === Surface.MCP ? Surface.MCP : Surface.CLI];
      throw usageError(wording.message, wording.guidance);
    }
  },
  run: (input, ctx) =>
    ctx.http({
      method: 'PATCH',
      path: `${BASE_PATH}/mailbox/dkim-selector`,
      pathParams: productParams(input),
      body: { selector: input.reset ? EMPTY_SELECTOR : input.selector },
    }),
});

const topUpConsentGet = defineCommand({
  id: `${GROUP_ID}.top-up-consent.get`,
  summary: 'Read the automatic credit top-up terms and whether they were confirmed.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${BASE_PATH}/top-up-consent`,
      pathParams: productParams(input),
    }),
});

const topUpConsentConfirm = defineCommand({
  id: `${GROUP_ID}.top-up-consent.confirm`,
  summary: 'Confirm the automatic credit top-up: authorizes credit-pack purchases on the card on file.',
  kind: CommandKind.MONEY,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${BASE_PATH}/top-up-consent`,
      pathParams: productParams(input),
      body: { accepted: true },
    }),
});

const entryGenerate = defineCommand({
  id: `${GROUP_ID}.entry.generate`,
  summary: 'Write a fresh base entry for the product from its site (multi-minute).',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  longRunning: { pollTool: POLL_SETTINGS_GET },
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${BASE_PATH}/entry/base`,
      pathParams: productParams(input),
    }),
});

const setupFinish = defineCommand({
  id: `${GROUP_ID}.setup.finish`,
  summary: 'Mark the dashboard onboarding as finished so the human lands on the tabs.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${BASE_PATH}/setup/finish`,
      pathParams: productParams(input),
    }),
});

const citationsSummary = defineCommand({
  id: `${GROUP_ID}.citations.summary`,
  summary: 'Get the AI Citations summary: answers naming the product and the pages ChatGPT cited.',
  kind: CommandKind.READ,
  toolsets: TOOLSETS,
  mcp: untrusted(CITATIONS_UNTRUSTED_FIELDS),
  input: { ...productInput(), weeks: oneOf(AI_CITATIONS_PERIOD_WEEKS) },
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'GET',
      path: `${CITATIONS_PATH}/summary`,
      pathParams: productParams(input),
      query: { weeks: input.weeks },
    }),
});

const citationsCheck = defineCommand({
  id: `${GROUP_ID}.citations.check`,
  summary: 'Ask ChatGPT the buyer questions now, unless fresh data or a running check exists.',
  kind: CommandKind.WRITE,
  toolsets: TOOLSETS,
  input: productInput(),
  cli: PRODUCT_CLI,
  run: (input, ctx) =>
    ctx.http({
      method: 'POST',
      path: `${CITATIONS_PATH}/check`,
      pathParams: productParams(input),
    }),
});

export const aiCitedListsGroup = defineGroup({
  id: GROUP_ID,
  help: {
    usage: AI_CITED_LISTS_HELP,
    guidance:
      'Start with status: it says whether the product is on the Enterprise plan and what the outreach setup ' +
      'still needs (mailbox, sender details, top-up consent). Then overview, lists, outreach, offers, wins, ' +
      'questions, settings, mailbox, top-up-consent, entry, setup or citations.',
  },
  unknown: (word) => ({
    message: `Unknown ai-cited-lists sub-noun: ${word}.`,
    guidance: 'Run `outrank-cli ai-cited-lists --help` to see the available AI-Cited Lists commands.',
  }),
  children: [
    status,
    overview,
    subGroup({
      id: `${GROUP_ID}.lists`,
      usage: LISTS_HELP,
      actions: 'list|skip|unskip',
      children: [listsList, listsSkip, listsUnskip],
    }),
    outreach,
    subGroup({
      id: `${GROUP_ID}.offers`,
      usage: OFFERS_HELP,
      actions: 'get|withdraw',
      children: [offersGet, offersWithdraw],
    }),
    subGroup({
      id: `${GROUP_ID}.wins`,
      usage: WINS_HELP,
      actions: 'get',
      children: [winsGet],
    }),
    subGroup({
      id: `${GROUP_ID}.questions`,
      usage: QUESTIONS_HELP,
      actions: 'list|add|edit|remove',
      children: [questionsList, questionsAdd, questionsEdit, questionsRemove],
    }),
    subGroup({
      id: `${GROUP_ID}.settings`,
      usage: SETTINGS_HELP,
      actions: 'get|update',
      children: [settingsGet, settingsUpdate],
    }),
    subGroup({
      id: `${GROUP_ID}.mailbox`,
      usage: MAILBOX_HELP,
      actions: 'get|connect|poll|domain-check|inbox-test|filter-test|dkim-selector|disconnect',
      children: [
        mailboxGet,
        mailboxConnect,
        mailboxPoll,
        mailboxDomainCheck,
        mailboxInboxTest,
        mailboxFilterTest,
        mailboxDkimSelector,
        mailboxDisconnect,
      ],
    }),
    subGroup({
      id: `${GROUP_ID}.top-up-consent`,
      usage: TOP_UP_CONSENT_HELP,
      actions: 'get|confirm',
      children: [topUpConsentGet, topUpConsentConfirm],
    }),
    subGroup({
      id: `${GROUP_ID}.entry`,
      usage: ENTRY_HELP,
      actions: 'generate',
      children: [entryGenerate],
    }),
    subGroup({
      id: `${GROUP_ID}.setup`,
      usage: SETUP_HELP,
      actions: 'finish',
      children: [setupFinish],
    }),
    subGroup({
      id: `${GROUP_ID}.citations`,
      usage: CITATIONS_HELP,
      actions: 'summary|check',
      children: [citationsSummary, citationsCheck],
    }),
  ],
});
