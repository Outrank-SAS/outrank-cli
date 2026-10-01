import { CommandKind, Toolset } from '../../commands/registry.js';
import {
  EntitlementMode,
  SelectionSource,
  TOOLSETS_ALL,
  TOOLSETS_AUTO,
  TOOLSETS_SEPARATOR,
} from './constants.js';

export const ALL_TOOLSETS = Object.freeze(Object.values(Toolset));
const READ_KINDS = Object.freeze([CommandKind.READ, CommandKind.LOCAL]);
const ENTITLEMENT_MODES = Object.freeze(Object.values(EntitlementMode));

export const OverrideKind = Object.freeze({ AUTO: 'auto', ALL: 'all', LIST: 'list' });

export const isReadKind = (spec) => READ_KINDS.includes(spec.kind);

const KEYWORDS = Object.freeze([TOOLSETS_AUTO, TOOLSETS_ALL]);

export const parseToolsetOverride = (value) => {
  const text = typeof value === 'string' ? value : '';
  const names = [...new Set(text.split(TOOLSETS_SEPARATOR).map((name) => name.trim()).filter(Boolean))];
  const unknown = names.filter((name) => !ALL_TOOLSETS.includes(name) && !KEYWORDS.includes(name));
  const mixesKeyword = names.length > 1 && names.some((name) => KEYWORDS.includes(name));
  if (names.length === 0 || (names.length === 1 && names[0] === TOOLSETS_AUTO)) {
    return { kind: OverrideKind.AUTO, toolsets: [], unknown, mixesKeyword };
  }
  if (names.length === 1 && names[0] === TOOLSETS_ALL) {
    return { kind: OverrideKind.ALL, toolsets: [...ALL_TOOLSETS], unknown, mixesKeyword };
  }
  const toolsets = names.filter((name) => ALL_TOOLSETS.includes(name));
  return { kind: OverrideKind.LIST, toolsets, unknown, mixesKeyword };
};

const fullModes = (toolsets) => new Map(toolsets.map((toolset) => [toolset, EntitlementMode.FULL]));

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const addModes = (modes, toolsets) => {
  for (const [toolset, mode] of Object.entries(toolsets)) {
    if (!ALL_TOOLSETS.includes(toolset) || modes.has(toolset)) continue;
    modes.set(toolset, ENTITLEMENT_MODES.includes(mode) ? mode : EntitlementMode.READ);
  }
};

const modesFromEntitlements = (entitlements) => {
  const modes = new Map();
  addModes(modes, entitlements.toolsets);
  if (isPlainObject(entitlements.unverified_toolsets)) addModes(modes, entitlements.unverified_toolsets);
  modes.set(Toolset.CORE, EntitlementMode.FULL);
  return modes;
};

const hasToolsetMap = (entitlements) => isPlainObject(entitlements) && isPlainObject(entitlements.toolsets);

const resolveModes = ({ entitlements, override }) => {
  if (override.kind === OverrideKind.ALL) return { source: SelectionSource.ALL, modes: fullModes(ALL_TOOLSETS) };
  if (override.kind === OverrideKind.LIST) {
    return { source: SelectionSource.OVERRIDE, modes: fullModes(override.toolsets) };
  }
  if (entitlements === null) return { source: SelectionSource.UNRESTRICTED, modes: fullModes(ALL_TOOLSETS) };
  if (hasToolsetMap(entitlements)) {
    return { source: SelectionSource.ENTITLEMENTS, modes: modesFromEntitlements(entitlements) };
  }
  return { source: SelectionSource.FALLBACK, modes: fullModes([Toolset.CORE]) };
};

const bestMode = (spec, modes) => {
  const found = spec.toolsets.map((toolset) => modes.get(toolset)).filter(Boolean);
  if (found.includes(EntitlementMode.FULL)) return EntitlementMode.FULL;
  return found.includes(EntitlementMode.READ) ? EntitlementMode.READ : undefined;
};

const AUTO_SOURCES = Object.freeze([
  SelectionSource.ENTITLEMENTS,
  SelectionSource.UNRESTRICTED,
  SelectionSource.FALLBACK,
]);

const isVisible = (spec, modes, source) => {
  const mode = bestMode(spec, modes);
  if (mode === EntitlementMode.FULL) return true;
  if (AUTO_SOURCES.includes(source) && spec.entryPoint) return true;
  return mode === EntitlementMode.READ && isReadKind(spec);
};

export const selectTools = ({ specs, entitlements, override = parseToolsetOverride(), readOnly = false }) => {
  const { source, modes } = resolveModes({ entitlements, override });
  const tools = specs
    .filter((spec) => spec.mcp !== false)
    .filter((spec) => isVisible(spec, modes, source))
    .filter((spec) => !readOnly || isReadKind(spec));
  return {
    tools,
    source,
    readOnly,
    enabled: Object.fromEntries(ALL_TOOLSETS.filter((toolset) => modes.has(toolset)).map((t) => [t, modes.get(t)])),
    disabledToolsets: ALL_TOOLSETS.filter((toolset) => !modes.has(toolset)),
  };
};

export const isBlockedByOperator = (spec, selection) => {
  if (selection.readOnly && !isReadKind(spec)) return true;
  if (selection.source !== SelectionSource.OVERRIDE) return false;
  return !spec.toolsets.some((toolset) => Object.hasOwn(selection.enabled, toolset));
};
