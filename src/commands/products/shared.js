import { uuid } from '../../core/schema.js';

export const PRODUCT_CLI = { positionals: ['productId'] };

export const productInput = () => ({ productId: uuid().required() });
export const productParams = (input) => ({ productId: input.productId });

export const withProduct = (extraPositionals) => ({ positionals: ['productId', ...extraPositionals] });
