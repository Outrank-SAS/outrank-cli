export const MULTI_REQUEST_COMMAND_IDS = Object.freeze(['marketplace.seller.onboard']);

export const SEQUENTIAL_ROUTE_KEYS = Object.freeze(['POST /billing/purchase-products']);

export const ROUTE_TOOL_OVERRIDES = Object.freeze({
  'POST /billing/purchase-products': ['billing.purchase-products.quote', 'billing.purchase-products.buy'],
  'GET /articles': ['articles.list'],
  'GET /products/{}/backlinks/subscribe-quote': ['products.backlinks.subscribe-quote'],
  'PATCH /marketplace/target-pages/{}': [
    'marketplace.buyer.target-pages.pause',
    'marketplace.buyer.target-pages.activate',
  ],
  'POST /products/{}/marketplace/buyer/participation': [
    'marketplace.buyer.participation.on',
    'marketplace.buyer.participation.off',
  ],
});
