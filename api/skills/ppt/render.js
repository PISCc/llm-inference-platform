import { renderPresentation } from '../../../server/skills/ppt/pptService.js';
import { buildCorsHeaders } from '../../../server/agent/cors.js';

const corsHeaders = (request, env) => buildCorsHeaders(request, env, {
  exposeHeaders: 'Content-Disposition, X-PPT-QA, X-PPT-Slides',
});

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
    console.error('[ppt-render]', error?.stack || error?.message || error);
    const status = Number(error.status) || 500;
    return Response.json({ error: { code: error.code || 'PPT_RENDER_FAILED', message: error.message } }, { status, headers: corsHeaders(request, env) });
  }
}

export default { fetch: (request) => handlePptRenderRequest(request, process.env) };
