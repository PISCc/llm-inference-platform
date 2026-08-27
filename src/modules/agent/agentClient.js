import { assertSerializablePageContext } from '../../context/pageContextContract.js';
import { modelConfigHeaders } from './modelConfigClient.js';
import { fileModeApiOrigin, isFileMode } from './apiEndpoint.js';

export class AgentClientError extends Error {
  constructor(message, { code = 'AGENT_CLIENT_ERROR', status = 0, offline = false } = {}) {
    super(message);
    this.name = 'AgentClientError';
    this.code = code;
    this.status = status;
    this.offline = offline;
  }
}

export function resolveAgentApiUrl() {
  const configured = String(import.meta.env.VITE_AGENT_API_URL || '').trim();
  if (configured) return configured;
  if (isFileMode()) return `${fileModeApiOrigin()}/api/agent/chat`;
  if (import.meta.env.DEV) return 'http://127.0.0.1:8787/api/agent/chat';
  return '/api/agent/chat';
}

function buildPayload({ query, pageContext = {}, conversation = [], stream = false } = {}) {
  return {
    query: String(query || '').trim(),
    pageContext: assertSerializablePageContext(pageContext),
    conversation: conversation
      .filter((message) => ['user', 'assistant'].includes(message?.role))
      .slice(-8)
      .map((message) => ({ role: message.role, content: String(message.content || '').slice(0, 2400) })),
    stream,
  };
}

async function responseError(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return new AgentClientError(payload?.error?.message || `智能体服务返回 ${response.status}。`, {
    code: payload?.error?.code || 'AGENT_HTTP_ERROR',
    status: response.status,
  });
}

export async function askAgent(input, { apiUrl = resolveAgentApiUrl(), signal, fetchImpl = fetch } = {}) {
  if (!apiUrl) {
    throw new AgentClientError('智能体服务地址未配置，当前使用本地知识问答。', { code: 'AGENT_API_NOT_CONFIGURED', offline: true });
  }
  let response;
  try {
    response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: modelConfigHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(buildPayload(input)),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (isFileMode()) {
      throw new AgentClientError(
        `无法连接本地智能体服务（${fileModeApiOrigin()}），请先在项目目录运行 npm start 启动服务端；当前使用本地知识回答。`,
        { code: 'AGENT_LOCAL_SERVER_UNREACHABLE', offline: true },
      );
    }
    throw new AgentClientError(`无法连接智能体服务：${error.message}`, { code: 'AGENT_UNREACHABLE', offline: true });
  }
  if (!response.ok) throw await responseError(response);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new AgentClientError('智能体接口没有返回 JSON。', { code: 'INVALID_AGENT_RESPONSE', offline: true });
  }
  return response.json();
}

function parseSseBlock(block) {
  let event = 'message';
  const data = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) };
  } catch {
    return null;
  }
}

export async function streamAgent(input, {
  apiUrl = resolveAgentApiUrl(),
  signal,
  fetchImpl = fetch,
  onEvent = () => {},
} = {}) {
  if (!apiUrl) {
    throw new AgentClientError('智能体服务地址未配置，当前使用本地知识问答。', { code: 'AGENT_API_NOT_CONFIGURED', offline: true });
  }
  let response;
  try {
    response = await fetchImpl(apiUrl, {
      method: 'POST',
      headers: modelConfigHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(buildPayload({ ...input, stream: true })),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (isFileMode()) {
      throw new AgentClientError(
        `无法连接本地智能体服务（${fileModeApiOrigin()}），请先在项目目录运行 npm start 启动服务端；当前使用本地知识回答。`,
        { code: 'AGENT_LOCAL_SERVER_UNREACHABLE', offline: true },
      );
    }
    throw new AgentClientError(`无法连接智能体服务：${error.message}`, { code: 'AGENT_UNREACHABLE', offline: true });
  }
  if (!response.ok) throw await responseError(response);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    throw new AgentClientError('智能体接口没有返回事件流。', { code: 'INVALID_AGENT_STREAM', offline: true });
  }
  if (!response.body) throw new AgentClientError('智能体服务没有返回数据流。', { code: 'EMPTY_AGENT_STREAM' });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      const parsed = parseSseBlock(block);
      if (!parsed) continue;
      events.push(parsed);
      onEvent(parsed);
    }
    if (done) break;
  }
  return events;
}
