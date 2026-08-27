import { apiEndpoint } from './apiEndpoint.js';

const TOKEN_KEY = 'llm-inference-agent-config-token-v1';

export function getModelConfigToken() {
  if (typeof window === 'undefined') return '';
  try { return window.sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}

function setModelConfigToken(token) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Session persistence is optional.
  }
}

export function modelConfigHeaders(extra = {}) {
  const token = getModelConfigToken();
  return { ...extra, ...(token ? { 'X-Agent-Config-Token': token } : {}) };
}

async function parseResponse(response, fallback) {
  let payload = null;
  try { payload = await response.json(); } catch { payload = null; }
  if (!response.ok) throw new Error(payload?.error?.message || fallback);
  return payload;
}

export async function fetchModelConfigStatus({ signal } = {}) {
  const url = apiEndpoint('/api/agent/config/status');
  if (!url && typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return { config: { configured: false, source: 'offline' } };
  }
  const response = await fetch(url, { method: 'GET', headers: modelConfigHeaders(), signal });
  return parseResponse(response, '无法读取模型配置状态。');
}

export async function saveModelConfig(input, { signal } = {}) {
  const url = apiEndpoint('/api/agent/config');
  if (!url && typeof window !== 'undefined' && window.location.protocol === 'file:') {
    throw new Error('离线单文件模式无法保存在线模型配置，请启动服务端后重试。');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: modelConfigHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
    signal,
  });
  const payload = await parseResponse(response, '模型配置保存失败。');
  if (payload.token) setModelConfigToken(payload.token);
  return payload;
}

export async function testModelConfig(input = {}, { signal } = {}) {
  const url = apiEndpoint('/api/agent/config/test');
  if (!url && typeof window !== 'undefined' && window.location.protocol === 'file:') {
    throw new Error('离线单文件模式无法测试在线模型，请启动服务端后重试。');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: modelConfigHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
    signal,
  });
  return parseResponse(response, '模型连接测试失败。');
}

export async function clearModelConfig({ signal } = {}) {
  const url = apiEndpoint('/api/agent/config');
  if (!url && typeof window !== 'undefined' && window.location.protocol === 'file:') {
    setModelConfigToken('');
    return { cleared: true };
  }
  const response = await fetch(url, { method: 'DELETE', headers: modelConfigHeaders(), signal });
  const payload = await parseResponse(response, '清除模型配置失败。');
  setModelConfigToken('');
  return payload;
}
