import auth from './auth.js';
import usage from './usage.js';
import subscription from './subscription.js';
import billing from './billing.js';
import keywords from './keywords.js';
import articles from './articles.js';
import improvements from './improvements.js';
import products from './products.js';
import productsIntegrations from './productsIntegrations.js';
import productsGsc from './productsGsc.js';
import productsLinking from './productsLinking.js';
import productsBacklinks from './productsBacklinks.js';
import productsBlog from './productsBlog.js';
import marketplaceSeller from './marketplaceSeller.js';
import marketplaceNotifications from './marketplaceNotifications.js';
import marketplaceBuyer from './marketplaceBuyer.js';
import aiCitedLists from './aiCitedLists.js';
import root from './root.js';
import { DEFAULT_CONFIG, OK_RESPONSE } from './shared.js';

export const FIXTURE_GROUPS = {
  root,
  auth,
  usage,
  subscription,
  billing,
  keywords,
  articles,
  improvements,
  products,
  productsIntegrations,
  productsGsc,
  productsLinking,
  productsBacklinks,
  productsBlog,
  marketplaceSeller,
  marketplaceNotifications,
  marketplaceBuyer,
  aiCitedLists,
};

export * from './shared.js';

const hasOwnConfig = (fixture) => fixture.rawConfig !== undefined || fixture.config !== undefined;

export const resolveFixtureOptions = (fixture) => ({
  config: hasOwnConfig(fixture) ? fixture.config : DEFAULT_CONFIG,
  rawConfig: fixture.rawConfig,
  responses: fixture.responses ?? [OK_RESPONSE],
  stdin: fixture.stdin,
  env: fixture.env ?? {},
});

export const listFixtures = () =>
  Object.entries(FIXTURE_GROUPS).flatMap(([group, fixtures]) =>
    fixtures.map((fixture) => ({ ...fixture, group, id: `${group}/${fixture.name}` })),
  );
