import { assembleMessages, normalizeConversation } from './contextAssembler.js';
import { buildOfflineAnswer, relatedActionsForSources, retrieveKnowledge } from './knowledgeRetriever.js';
import { createModelAdapter } from './modelAdapter.js';
import { createAgentEnvelope, publicSources, sourceModes } from './responseProtocol.js';
import { contextActionsForPage } from '../../src/modules/agent/contextInsights.js';

function requestId() {
  return globalThis.crypto?.randomUUID?.() || `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function validateAgentInput(input = {}) {
  const query = String(input.query || '').trim();
  if (!query) throw Object.assign(new Error('问题不能为空。'), { status: 400, code: 'EMPTY_QUERY' });
  if (query.length > 1200) throw Object.assign(new Error('问题不能超过 1200 个字符。'), { status: 400, code: 'QUERY_TOO_LONG' });
  const pageContext = input.pageContext && typeof input.pageContext === 'object' ? input.pageContext : {};
  const conversation = normalizeConversation(Array.isArray(input.conversation) ? input.conversation : []);
  return { query, pageContext, conversation, stream: Boolean(input.stream) };
}

export function prepareAgentRequest(input = {}) {
  const normalized = validateAgentInput(input);
  const sources = retrieveKnowledge({ query: normalized.query, pageContext: normalized.pageContext });
  const actionKeys = new Set();
  const relatedActions = [
    ...contextActionsForPage(normalized.pageContext),
    ...relatedActionsForSources(sources),
  ].filter((action) => {
    const key = `${action.path}:${JSON.stringify(action.state || {})}`;
    if (actionKeys.has(key)) return false;
    actionKeys.add(key);
    return true;
  }).slice(0, 5);
  const messages = assembleMessages({
    query: normalized.query,
    pageContext: normalized.pageContext,
    conversation: normalized.conversation,
    sources,
  });
  return { ...normalized, sources, relatedActions, messages };
}

export async function answerAgentRequest(input, { env = process.env, modelConfig = null, fetchImpl = fetch, signal, allowModel = true, modelDisabledReason = 'MODEL_NOT_CONFIGURED' } = {}) {
  const prepared = prepareAgentRequest(input);
  const id = requestId();
  const adapter = createModelAdapter({ env, config: modelConfig, fetchImpl });

  if (allowModel && adapter.config.configured) {
    try {
      const result = await adapter.generateAnswer({ messages: prepared.messages, signal });
      return createAgentEnvelope({
        requestId: id,
        mode: 'model',
        answer: result.text,
        pageContext: prepared.pageContext,
        sources: prepared.sources,
        relatedActions: prepared.relatedActions,
        model: adapter.config,
        usage: result.usage,
      });
    } catch (error) {
      const offline = buildOfflineAnswer(prepared);
      return createAgentEnvelope({
        requestId: id,
        mode: 'offline-fallback',
        answer: offline.text,
        pageContext: prepared.pageContext,
        sources: prepared.sources,
        relatedActions: prepared.relatedActions,
        model: adapter.config,
        warning: { code: error.code || 'MODEL_FAILED', message: '模型服务暂时不可用，已切换到本地知识回答。' },
      });
    }
  }

  const offline = buildOfflineAnswer(prepared);
  return createAgentEnvelope({
    requestId: id,
    mode: 'offline-fallback',
    answer: offline.text,
    pageContext: prepared.pageContext,
    sources: prepared.sources,
    relatedActions: prepared.relatedActions,
        warning: { code: modelDisabledReason, message: modelDisabledReason === 'AGENT_RATE_LIMITED' ? '共享模型额度已用尽，当前使用本地知识回答。' : '尚未配置模型服务，当前使用本地知识回答。' },
  });
}

export async function* streamAgentRequest(input, { env = process.env, modelConfig = null, fetchImpl = fetch, signal, allowModel = true, modelDisabledReason = 'MODEL_NOT_CONFIGURED' } = {}) {
  const prepared = prepareAgentRequest({ ...input, stream: true });
  const id = requestId();
  const adapter = createModelAdapter({ env, config: modelConfig, fetchImpl });
  const baseMeta = {
    protocolVersion: '1.0',
    requestId: id,
    sources: publicSources(prepared.sources),
    relatedActions: prepared.relatedActions,
    suggestedQuestions: (prepared.pageContext.suggestedQuestions || []).slice(0, 5),
    boundaries: prepared.pageContext.boundaries || [],
  };

  if (!allowModel || !adapter.config.configured) {
    const offline = buildOfflineAnswer(prepared);
    yield { event: 'context', data: { ...baseMeta, mode: 'offline-fallback', sourceModes: sourceModes({ pageContext: prepared.pageContext, sources: prepared.sources }), warning: { code: modelDisabledReason, message: modelDisabledReason === 'AGENT_RATE_LIMITED' ? '共享模型额度已用尽，当前使用本地知识回答。' : '尚未配置模型服务，当前使用本地知识回答。' } } };
    yield { event: 'delta', data: { requestId: id, text: offline.text } };
    yield { event: 'done', data: { requestId: id, mode: 'offline-fallback' } };
    return;
  }

  yield { event: 'context', data: { ...baseMeta, mode: 'model', sourceModes: sourceModes({ pageContext: prepared.pageContext, sources: prepared.sources, modelUsed: true }), model: { provider: adapter.config.provider, model: adapter.config.model } } };
  try {
    for await (const delta of adapter.streamAnswer({ messages: prepared.messages, signal })) {
      yield { event: 'delta', data: { requestId: id, text: delta } };
    }
    yield { event: 'done', data: { requestId: id, mode: 'model' } };
  } catch (error) {
    const offline = buildOfflineAnswer(prepared);
    yield { event: 'warning', data: { requestId: id, code: error.code || 'MODEL_FAILED', message: '模型流式回答失败，已补充本地知识回答。' } };
    yield { event: 'delta', data: { requestId: id, text: `\n\n${offline.text}` } };
    yield { event: 'done', data: { requestId: id, mode: 'offline-fallback' } };
  }
}
