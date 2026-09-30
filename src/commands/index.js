import { articlesGroup } from './articles.js';
import { authGroup } from './auth.js';
import { billingGroup } from './billing.js';
import { improvementsGroup } from './improvements.js';
import { keywordsGroup } from './keywords.js';
import { marketplaceGroup } from './marketplace/index.js';
import { productsGroup } from './products/index.js';
import { createRegistry } from './registry.js';
import { subscriptionGroup } from './subscription.js';
import { usageGroup } from './usage.js';

export const registry = createRegistry([
  authGroup,
  usageGroup,
  subscriptionGroup,
  billingGroup,
  keywordsGroup,
  articlesGroup,
  improvementsGroup,
  productsGroup,
  marketplaceGroup,
]);
