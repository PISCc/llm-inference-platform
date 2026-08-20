import { answerAgentRequest, streamAgentRequest } from '../../server/agent/agentService.js';
import { encodeSse } from '../../server/agent/responseProtocol.js';
import { getModelConfigForRequest } from '../../server/agent/modelConfigStore.js';
import { resolveModelConfig } from '../../server/agent/modelAdapter.js';
import { consumeSharedModelQuota, rateLimitHeaders } from '../../server/agent/rateLimit.js';

function corsHeaders(request, env = process.env) {
  const origin = request.headers.get('origin') || '';
  const configured = String(env.AGENT_ALLOWED_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
  const allowed = origin && (isLocal || configured.includes(origin));
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Config-Token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(payload, status, request, env) {
  return Response.json(payload, {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Cache-Control': 'no-store',
    },
  });
}

function sharedModelAccess(request, env) {
  const sessionConfig = getModelConfigForRequest(request, env);
  const environmentConfig = resolveModelConfig(env);
  const sharedDefault = !sessionConfig && environmentConfig.configured;
  return {
    modelConfig: sessionConfig,
    quota: sharedDefault ? consumeSharedModelQuota(request, env) : null,
  };
}

async function handle(request, env = process.env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 POST 请求。' } }, 405, request, env);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 96 * 1024) {
    return jsonResponse({ error: { code: 'REQUEST_TOO_LARGE', message: '请求内容过大。' } }, 413, request, env);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: { code: 'INVALID_JSON', message: '请求必须是有效的 JSON。' } }, 400, request, env);
  }

  try {
    const access = sharedModelAccess(request, env);
    const allowModel = !access.quota || access.quota.allowed;
    const requestOptions = {
      env,
      modelConfig: access.modelConfig,
      signal: request.signal,
      allowModel,
      modelDisabledReason: access.quota && !access.quota.allowed ? 'AGENT_RATE_LIMITED' : 'MODEL_NOT_CONFIGURED',
    };
    if (input.stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const item of streamAgentRequest(input, requestOptions)) {
              controller.enqueue(encoder.encode(encodeSse(item.event, item.data)));
            }
          } catch (error) {
            controller.enqueue(encoder.encode(encodeSse('error', {
              code: error.code || 'AGENT_STREAM_FAILED',
              message: error.status && error.status < 500 ? error.message : '智能体服务暂时不可用。',
            })));
          } finally {
            controller.close();
          }
        },
      });
      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders(request, env),
          ...rateLimitHeaders(access.quota),
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-store, no-transform',
          Connection: 'keep-alive',
        },
      });
    }

    const result = await answerAgentRequest(input, requestOptions);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        ...corsHeaders(request, env),
        ...rateLimitHeaders(access.quota),
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    return jsonResponse({
      error: {
        code: error.code || 'AGENT_REQUEST_FAILED',
        message: status < 500 ? error.message : '智能体服务暂时不可用。',
      },
    }, status, request, env);
  }
}

export default {
  fetch(request) {
    return handle(request, process.env);
  },
};

export { handle as handleAgentHttpRequest };
