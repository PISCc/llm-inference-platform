export const AGENT_PROTOCOL_VERSION = '1.0';

export function sourceModes({ pageContext = {}, sources = [], modelUsed = false } = {}) {
  return [
    ...(pageContext.pageId ? ['current-page'] : []),
    ...(sources.length ? ['project-knowledge'] : []),
    ...(modelUsed ? ['model-supplement'] : []),
  ];
}

export function publicSources(sources = []) {
  return sources.map(({ id, title, category, summary, sourceFile, score }) => ({
    id,
    title,
    category,
    summary,
    sourceFile,
    score,
  }));
}

export function createAgentEnvelope({
  requestId,
  mode,
  answer = '',
  pageContext = {},
  sources = [],
  relatedActions = [],
  model = null,
  usage = null,
  warning = null,
} = {}) {
  return {
    protocolVersion: AGENT_PROTOCOL_VERSION,
    requestId,
    mode,
    answer,
    sourceModes: sourceModes({ pageContext, sources, modelUsed: mode === 'model' }),
    sources: publicSources(sources),
    relatedActions,
    suggestedQuestions: (pageContext.suggestedQuestions || []).slice(0, 5),
    boundaries: pageContext.boundaries || [],
    model: model ? { provider: model.provider, model: model.model } : null,
    usage,
    warning,
    createdAt: new Date().toISOString(),
  };
}

export function encodeSse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

