const CONFIG_PATH_DETAIL = 'config_path';
const DETAILS_FIELD = 'details';
const TEXT_CONTENT_TYPE = 'text';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const omitKeys = (value, keys) => {
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
};

const redactedFields = (spec) => (isPlainObject(spec?.mcp) && Array.isArray(spec.mcp.redact) ? spec.mcp.redact : []);

export const sanitizeEnvelope = (envelope, spec) => {
  const hidden = [...new Set([CONFIG_PATH_DETAIL, ...redactedFields(spec)])];
  if (envelope.ok === false) {
    const error = isPlainObject(envelope.error) ? envelope.error : {};
    const details = omitKeys(error.details, hidden);
    const hasDetails = isPlainObject(details) ? Object.keys(details).length > 0 : details !== undefined;
    const rest = omitKeys(error, [DETAILS_FIELD]);
    return { ...envelope, error: hasDetails ? { ...rest, details } : rest };
  }
  return { ...envelope, data: omitKeys(envelope.data, hidden) };
};

export const toToolResult = (envelope, { spec, organization } = {}) => {
  const payload = { ...sanitizeEnvelope(envelope, spec), organization: organization ?? null };
  return {
    content: [{ type: TEXT_CONTENT_TYPE, text: JSON.stringify(payload) }],
    structuredContent: payload,
    ...(payload.ok === false ? { isError: true } : {}),
  };
};
