export function buildCorsHeaders(request, env = process.env, {
  methods = 'POST, OPTIONS',
  exposeHeaders = '',
} = {}) {
  const origin = request?.headers?.get('origin') || '';
  const configured = String(env.AGENT_ALLOWED_ORIGIN || '').split(',').map((item) => item.trim()).filter(Boolean);
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
  const isHosted = Boolean(env.PORT || env.RENDER || env.VERCEL);
  const allowFileOrigin = env.AGENT_ALLOW_FILE_ORIGIN === 'true' || !isHosted;
  const allowed = origin && (
    isLocal
    || configured.includes(origin)
    || (origin === 'null' && allowFileOrigin)
  );
  return {
    ...(allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'Content-Type, X-Agent-Config-Token',
    'Access-Control-Allow-Methods': methods,
    ...(exposeHeaders ? { 'Access-Control-Expose-Headers': exposeHeaders } : {}),
  };
}
