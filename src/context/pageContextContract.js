export const PAGE_CONTEXT_VERSION = '1.0';

export const EMPTY_PAGE_CONTEXT = Object.freeze({
  version: PAGE_CONTEXT_VERSION,
  pageId: '',
  route: '',
  pageTitle: '',
  pageType: '',
  activeSection: '',
  selection: {},
  parameters: {},
  result: {},
  visibleSummary: '',
  suggestedQuestions: [],
  boundaries: [],
  metadata: {},
  updatedAt: '',
});

function toSerializable(value, seen = new WeakSet()) {
  if (value == null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'undefined') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => toSerializable(item, seen)).filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      const serialized = toSerializable(item, seen);
      if (serialized !== undefined) output[key] = serialized;
    }
    seen.delete(value);
    return output;
  }
  return String(value);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function mergeObjects(base, next) {
  return { ...(base || {}), ...(next || {}) };
}

export function normalizePageContext(input = {}) {
  const context = toSerializable(input) || {};
  return {
    ...EMPTY_PAGE_CONTEXT,
    ...context,
    version: PAGE_CONTEXT_VERSION,
    selection: context.selection || {},
    parameters: context.parameters || {},
    result: context.result || {},
    suggestedQuestions: uniqueStrings(context.suggestedQuestions || []),
    boundaries: uniqueStrings(context.boundaries || []),
    metadata: context.metadata || {},
    updatedAt: context.updatedAt || new Date().toISOString(),
  };
}

export function mergePageContexts(registrations = [], route = '') {
  const ordered = [...registrations].sort((a, b) => (
    (a.priority || 0) - (b.priority || 0)
    || String(a.sourceId || '').localeCompare(String(b.sourceId || ''))
  ));

  const merged = ordered.reduce((current, registration) => {
    const next = normalizePageContext(registration.context);
    return {
      ...current,
      ...next,
      pageId: next.pageId || current.pageId,
      route: next.route || current.route,
      pageTitle: next.pageTitle || current.pageTitle,
      pageType: next.pageType || current.pageType,
      activeSection: next.activeSection || current.activeSection,
      visibleSummary: next.visibleSummary || current.visibleSummary,
      selection: mergeObjects(current.selection, next.selection),
      parameters: mergeObjects(current.parameters, next.parameters),
      result: mergeObjects(current.result, next.result),
      metadata: mergeObjects(current.metadata, next.metadata),
      suggestedQuestions: uniqueStrings([
        ...(current.suggestedQuestions || []),
        ...(next.suggestedQuestions || []),
      ]),
      boundaries: uniqueStrings([
        ...(current.boundaries || []),
        ...(next.boundaries || []),
      ]),
    };
  }, { ...EMPTY_PAGE_CONTEXT, route });

  return normalizePageContext({
    ...merged,
    route: merged.route || route,
    metadata: {
      ...merged.metadata,
      contextSources: ordered.map(({ sourceId, priority = 0 }) => ({ sourceId, priority })),
    },
    updatedAt: new Date().toISOString(),
  });
}

export function assertSerializablePageContext(context) {
  const normalized = normalizePageContext(context);
  JSON.stringify(normalized);
  return normalized;
}
