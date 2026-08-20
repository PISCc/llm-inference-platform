import { createPresentationSpec } from '../../../server/skills/ppt/presentationSpec.js';
import { getModelConfigForRequest } from '../../../server/agent/modelConfigStore.js';

function corsHeaders(request, env = process.env) {
  const origin = request.headers.get('origin') || '';
  const configured = String(env.AGENT_ALLOWED_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
  const allowed = origin && (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin) || configured.includes(origin));
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Config-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export async function handlePptOutlineRequest(request, env = process.env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  if (request.method !== 'POST') return Response.json({ error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 POST 请求。' } }, { status: 405, headers: corsHeaders(request, env) });
  if (Number(request.headers.get('content-length') || 0) > 160 * 1024) {
    return Response.json({ error: { code: 'REQUEST_TOO_LARGE', message: 'PPT 内容范围过大。' } }, { status: 413, headers: corsHeaders(request, env) });
  }
  try {
    const input = await request.json();
    const result = await createPresentationSpec(input, { env, modelConfig: getModelConfigForRequest(request, env), signal: request.signal });
    return Response.json(result, { headers: { ...corsHeaders(request, env), 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = Number(error.status) || 400;
    return Response.json({ error: { code: error.code || 'PPT_OUTLINE_FAILED', message: error.message } }, { status, headers: corsHeaders(request, env) });
  }
}

export default { fetch: (request) => handlePptOutlineRequest(request, process.env) };

