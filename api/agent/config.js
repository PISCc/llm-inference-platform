import { createModelAdapter, resolveModelConfig } from '../../server/agent/modelAdapter.js';
import {
  clearModelConfig,
  envModelConfigStatus,
  getConfigToken,
  getStoredModelConfig,
  publicModelConfig,
  normalizeModelConfig,
  upsertModelConfig,
} from '../../server/agent/modelConfigStore.js';
import { buildCorsHeaders } from '../../server/agent/cors.js';

const MAX_CONFIG_BODY_BYTES = 64 * 1024;
export const agentCorsHeaders = (request, env = process.env) => (
  buildCorsHeaders(request, env, { methods: 'GET, POST, DELETE, OPTIONS' })
);

function jsonResponse(payload, status, request, env) {
  return Response.json(payload, {
    status,
    headers: { ...agentCorsHeaders(request, env), 'Cache-Control': 'no-store' },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw Object.assign(new Error('请求必须是有效的 JSON。'), { status: 400, code: 'INVALID_JSON' });
  }
}

export async function handleAgentConfigRequest(request, env = process.env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: agentCorsHeaders(request, env) });
  const token = getConfigToken(request);

  if (request.method === 'GET') {
    const config = getStoredModelConfig(token, env);
    return jsonResponse({ config: config ? publicModelConfig(config, { source: 'session' }) : envModelConfigStatus(env) }, 200, request, env);
  }

  if (request.method === 'DELETE') {
    clearModelConfig(token);
    return jsonResponse({ config: envModelConfigStatus(env), cleared: true }, 200, request, env);
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 GET、POST、DELETE 请求。' } }, 405, request, env);
  }

  try {
    if (Number(request.headers.get('content-length') || 0) > MAX_CONFIG_BODY_BYTES) {
      return jsonResponse({ error: { code: 'REQUEST_TOO_LARGE', message: '请求内容过大。' } }, 413, request, env);
    }
    const input = await readJson(request);
    const result = upsertModelConfig(input, token, env);
    return jsonResponse({
      token: result.token,
      config: publicModelConfig(result.config, { source: 'session' }),
      ...(result.warning ? { warning: result.warning } : {}),
    }, 200, request, env);
  } catch (error) {
    return jsonResponse({ error: { code: error.code || 'MODEL_CONFIG_FAILED', message: error.message || '模型配置失败。' } }, Number(error.status) || 400, request, env);
  }
}

export async function handleAgentConfigTestRequest(request, env = process.env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: agentCorsHeaders(request, env) });
  if (request.method !== 'POST') return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 POST 请求。' } }, 405, request, env);
  try {
    if (Number(request.headers.get('content-length') || 0) > MAX_CONFIG_BODY_BYTES) {
      return jsonResponse({ error: { code: 'REQUEST_TOO_LARGE', message: '请求内容过大。' } }, 413, request, env);
    }
    const input = await readJson(request);
    const token = getConfigToken(request);
    const stored = getStoredModelConfig(token, env);
    const hasInput = Object.keys(input || {}).length > 0;
    const environment = resolveModelConfig(env);
    const config = stored || (hasInput ? normalizeModelConfig(input, { env }) : environment.configured ? environment : null);
    if (!config) return jsonResponse({ error: { code: 'MODEL_NOT_CONFIGURED', message: '请先填写并保存模型配置。' } }, 400, request, env);
    const source = stored ? 'session' : hasInput ? 'test' : 'environment';
    const adapter = createModelAdapter({ env, config });
    const result = await adapter.testConnection({ signal: request.signal });
    return jsonResponse({ ok: true, config: publicModelConfig(config, { source, testedAt: new Date().toISOString(), online: result.ok }) }, 200, request, env);
  } catch (error) {
    console.error(`[model-config-test] ${error.code || 'MODEL_TEST_FAILED'}: ${error.message}`);
    return jsonResponse({ error: { code: error.code || 'MODEL_TEST_FAILED', message: error.status && error.status >= 500 ? `模型连接测试失败（${error.code || 'MODEL_TEST_FAILED'}），请检查服务地址、Key 和模型名称。` : error.message } }, Number(error.status) || 502, request, env);
  }
}

export default { fetch: (request) => handleAgentConfigRequest(request, process.env) };
