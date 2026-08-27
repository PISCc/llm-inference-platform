import { modelConfigHeaders } from './modelConfigClient.js';
import { apiEndpoint } from './apiEndpoint.js';

async function errorFromResponse(response, fallback) {
  try {
    const payload = await response.json();
    return new Error(payload?.error?.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

async function fetchPptService(url, options, action) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error(`无法连接 PPT ${action}服务。请确认平台服务端已启动，然后重试。`);
  }
}

export async function createPptOutline(input, { signal } = {}) {
  const url = apiEndpoint('/api/skills/ppt/outline');
  if (!url && typeof window !== 'undefined' && window.location.protocol === 'file:') {
    throw new Error('离线单文件模式无法调用 PPT 服务，请启动服务端后重试。');
  }
  const response = await fetchPptService(url, {
    method: 'POST',
    headers: modelConfigHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input),
    signal,
  }, '大纲');
  if (!response.ok) throw await errorFromResponse(response, 'PPT 大纲生成失败。');
  return response.json();
}

export async function renderPpt(spec, { signal } = {}) {
  const url = apiEndpoint('/api/skills/ppt/render');
  if (!url && typeof window !== 'undefined' && window.location.protocol === 'file:') {
    throw new Error('离线单文件模式无法渲染 PPTX，请启动服务端后重试。');
  }
  const response = await fetchPptService(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spec }),
    signal,
  }, '渲染');
  if (!response.ok) throw await errorFromResponse(response, 'PPTX 渲染失败。');
  const disposition = response.headers.get('content-disposition') || '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  return {
    blob: await response.blob(),
    filename: encoded ? decodeURIComponent(encoded) : 'llm-inference-briefing.pptx',
    qaStatus: response.headers.get('x-ppt-qa') || 'rendered',
    slideCount: Number(response.headers.get('x-ppt-slides') || spec.slides.length),
  };
}

export function downloadPpt({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
