import { LIST_MAX_LIMIT, LIST_MIN_LIMIT } from '../../core/constants.js';
import { int, string, uuid } from '../../core/schema.js';

export const MARKETPLACE_UNKNOWN_GUIDANCE =
  'Run `outrank-cli marketplace --help` to see the available marketplace commands.';

export const PRODUCT_CLI = { positionals: ['productId'] };
export const PLACEMENT_CLI = { positionals: ['placementId'] };

export const productInput = () => ({ productId: uuid().required() });
export const placementInput = () => ({ placementId: uuid().required() });

export const pageInput = () => ({
  page: int({ min: LIST_MIN_LIMIT }),
  pageSize: int({ min: LIST_MIN_LIMIT, max: LIST_MAX_LIMIT }),
});
export const pageQuery = (input) => ({ page: input.page, page_size: input.pageSize });

export const REQUIRED_OPTION = Object.freeze({ guidance: MARKETPLACE_UNKNOWN_GUIDANCE });

export const listFilters = () => ({ status: string(), search: string(), ...pageInput() });
export const listFilterQuery = (input) => ({ status: input.status, search: input.search, ...pageQuery(input) });

export const unknownFor = (scope) => (word) => ({
  message: `Unknown marketplace ${scope} subcommand: ${word}.`,
  guidance: MARKETPLACE_UNKNOWN_GUIDANCE,
});
