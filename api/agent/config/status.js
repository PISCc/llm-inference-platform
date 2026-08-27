import { agentCorsHeaders, handleAgentConfigRequest } from '../config.js';

export async function handleAgentConfigStatusRequest(request, env = process.env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: agentCorsHeaders(request, env) });
  if (request.method !== 'GET') {
    return Response.json(
      { error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 GET 请求。' } },
      { status: 405, headers: agentCorsHeaders(request, env) },
    );
  }
  return handleAgentConfigRequest(request, env);
}

export default { fetch: (request) => handleAgentConfigStatusRequest(request, process.env) };
