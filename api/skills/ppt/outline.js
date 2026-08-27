import { createPresentationSpec } from '../../../server/skills/ppt/presentationSpec.js';
import { getModelConfigForRequest } from '../../../server/agent/modelConfigStore.js';
import { buildCorsHeaders } from '../../../server/agent/cors.js';

const corsHeaders = (request, env) => buildCorsHeaders(request, env);

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
