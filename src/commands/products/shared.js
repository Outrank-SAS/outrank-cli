import { string, uuid } from '../../core/schema.js';

export const PRODUCT_CLI = { positionals: ['productId'] };

export const productInput = () => ({ productId: uuid().required() });
export const productParams = (input) => ({ productId: input.productId });

export const withProduct = (extraPositionals) => ({ positionals: ['productId', ...extraPositionals] });
export const productParamsWith = (input, name) => ({ productId: input.productId, [name]: input[name] });

export const ATTEMPT_ID_PLACEHOLDERS = { attemptId: '<attempt-id>' };
export const attemptIdInput = (guidance) => ({ attemptId: string().required({ guidance }) });
export const attemptIdQuery = (input) => ({ attempt_id: input.attemptId });
