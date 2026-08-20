import { renderPresentation } from '../../../server/skills/ppt/pptService.js';

function corsHeaders(request, env = process.env) {
  const origin = request.headers.get('origin') || '';
  const configured = String(env.AGENT_ALLOWED_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
  const allowed = origin && (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin) || configured.includes(origin));
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Config-Token',
    'Access-Control-Expose-Headers': 'Content-Disposition, X-PPT-QA, X-PPT-Slides',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export async function handlePptRenderRequest(request, env = process.env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  if (request.method !== 'POST') return Response.json({ error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 POST 请求。' } }, { status: 405, headers: corsHeaders(request, env) });
  if (Number(request.headers.get('content-length') || 0) > 192 * 1024) {
    return Response.json({ error: { code: 'REQUEST_TOO_LARGE', message: 'PresentationSpec 过大。' } }, { status: 413, headers: corsHeaders(request, env) });
  }
  try {
    const body = await request.json();
    const result = await renderPresentation(body.spec, { env });
    return new Response(result.bytes, {
      status: 200,
      headers: {
        ...corsHeaders(request, env),
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(result.filename),
        'Cache-Control': 'no-store',
        'X-PPT-QA': result.qaStatus,
        'X-PPT-Slides': String(result.slideCount),
      },
    });
  } catch (error) {
    const status = Number(error.status) || 500;
    return Response.json({ error: { code: error.code || 'PPT_RENDER_FAILED', message: error.message } }, { status, headers: corsHeaders(request, env) });
  }
}

export default { fetch: (request) => handlePptRenderRequest(request, process.env) };

