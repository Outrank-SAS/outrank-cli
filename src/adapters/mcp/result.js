const CONFIG_PATH_DETAIL = 'config_path';
const DETAILS_FIELD = 'details';
const TEXT_CONTENT_TYPE = 'text';
export const UNTRUSTED_TEXT_FIELD = 'untrusted_counterparty_text';
const PATH_SEPARATOR = '.';
const EACH_ELEMENT_SUFFIX = '[]';

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const wrapText = (value) => {
  if (typeof value === 'string') return { [UNTRUSTED_TEXT_FIELD]: value };
  if (Array.isArray(value)) return value.map(wrapText);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, wrapText(entry)]));
};

const transformAtPath = (value, segments, transform) => {
  if (segments.length === 0) return transform(value);
  const [head, ...rest] = segments;
  const eachElement = head.endsWith(EACH_ELEMENT_SUFFIX);
  const key = eachElement ? head.slice(0, -EACH_ELEMENT_SUFFIX.length) : head;
  if (!isPlainObject(value) || !Object.hasOwn(value, key)) return value;
  const child = value[key];
  if (eachElement) {
    if (!Array.isArray(child)) return value;
    return { ...value, [key]: child.map((element) => transformAtPath(element, rest, transform)) };
  }
  return { ...value, [key]: transformAtPath(child, rest, transform) };
};

const segmentsOf = (fieldPath) => (fieldPath ? fieldPath.split(PATH_SEPARATOR) : []);

const wrapPaths = (data, paths) =>
  paths.reduce((current, fieldPath) => transformAtPath(current, segmentsOf(fieldPath), wrapText), data);

const wrapFlaggedRecords = (data, paths, { record, flag }) => {
  const prefixLength = record ? record.length + PATH_SEPARATOR.length : 0;
  const recordPaths = paths.map((fieldPath) => fieldPath.slice(prefixLength));
  return transformAtPath(data, segmentsOf(record), (entry) =>
    !isPlainObject(entry) || entry[flag] === false ? entry : wrapPaths(entry, recordPaths),
  );
};

export const wrapUntrustedFields = (data, paths, when = null) =>
  when ? wrapFlaggedRecords(data, paths, when) : wrapPaths(data, paths);

const untrustedFields = (spec) =>
  isPlainObject(spec?.mcp) && Array.isArray(spec.mcp.untrustedFields) ? spec.mcp.untrustedFields : [];

const untrustedWhen = (spec) =>
  isPlainObject(spec?.mcp) && isPlainObject(spec.mcp.untrustedWhen) ? spec.mcp.untrustedWhen : null;

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
  const visible = omitKeys(envelope.data, hidden);
  return { ...envelope, data: wrapUntrustedFields(visible, untrustedFields(spec), untrustedWhen(spec)) };
};

export const toToolResult = (envelope, { spec, organization } = {}) => {
  const payload = { ...sanitizeEnvelope(envelope, spec), organization: organization ?? null };
  return {
    content: [{ type: TEXT_CONTENT_TYPE, text: JSON.stringify(payload) }],
    structuredContent: payload,
    ...(payload.ok === false ? { isError: true } : {}),
  };
};
