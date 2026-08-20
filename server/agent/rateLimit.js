const STORE_KEY = '__LLM_INFERENCE_AGENT_RATE_LIMITS__';

function store() {
  if (!globalThis[STORE_KEY]) globalThis[STORE_KEY] = new Map();
  return globalThis[STORE_KEY];
}

function numericEnv(env, key, fallback, min, max) {
  const value = Number(env?.[key]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clientId(request) {
  const forwarded = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
  const address = request?.headers?.get('cf-connecting-ip')
    || request?.headers?.get('x-real-ip')
    || forwarded
    || 'unknown';
  return String(address).slice(0, 120);
}

function consume(key, limit, windowMs, now) {
  const entries = store();
  const current = entries.get(key);
  if (!current || now >= current.resetAt) {
    const next = { count: 1, resetAt: now + windowMs };
    entries.set(key, next);
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: next.resetAt };
  }
  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }
  current.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

function purge(now) {
  for (const [key, value] of store()) {
    if (now >= value.resetAt) store().delete(key);
  }
}

export function consumeSharedModelQuota(request, env = process.env) {
  if (String(env?.AGENT_RATE_LIMIT_ENABLED ?? 'true').toLowerCase() === 'false') {
    return { allowed: true, remaining: null, resetAt: null, retryAfterSeconds: 0, scope: 'disabled' };
  }

  const now = Date.now();
  purge(now);
  const perClientLimit = numericEnv(env, 'AGENT_RATE_LIMIT_REQUESTS', 12, 1, 1000);
  const perClientWindowMs = numericEnv(env, 'AGENT_RATE_LIMIT_WINDOW_MS', 10 * 60 * 1000, 10 * 1000, 24 * 60 * 60 * 1000);
  const dailyLimit = numericEnv(env, 'AGENT_DEFAULT_DAILY_LIMIT', 700, 1, 100000);
  const dailyWindowMs = numericEnv(env, 'AGENT_DEFAULT_DAILY_WINDOW_MS', 24 * 60 * 60 * 1000, 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000);
  const client = consume(`client:${clientId(request)}`, perClientLimit, perClientWindowMs, now);
  if (!client.allowed) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: client.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((client.resetAt - now) / 1000)),
      scope: 'shared-default',
      reason: 'client',
    };
  }
  const daily = consume('shared-default', dailyLimit, dailyWindowMs, now);
  const allowed = daily.allowed;
  const resetAt = allowed ? Math.max(client.resetAt, daily.resetAt) : daily.resetAt;
  return {
    allowed,
    remaining: Math.min(client.remaining, daily.remaining),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    scope: 'shared-default',
    reason: !daily.allowed ? 'daily' : '',
  };
}

export function rateLimitHeaders(result) {
  if (!result || result.scope === 'disabled') return {};
  return {
    'X-Agent-RateLimit-Remaining': String(result.remaining),
    'X-Agent-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { 'Retry-After': String(result.retryAfterSeconds) }),
  };
}
