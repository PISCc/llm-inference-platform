import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { isIP } from 'node:net';

const STORE_KEY = '__LLM_INFERENCE_AGENT_CONFIGS__';
const TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CONFIGS = 64;
const TOKEN_VERSION = 'v1';
const TOKEN_AAD = Buffer.from('llm-inference-platform:model-config:v1');

function store() {
  if (!globalThis[STORE_KEY]) globalThis[STORE_KEY] = new Map();
  return globalThis[STORE_KEY];
}

function tokenKey(env = process.env) {
  const secret = String(env.MODEL_CONFIG_SECRET || '').trim();
  return secret.length >= 32 ? createHash('sha256').update(secret).digest() : null;
}

function sealConfig(config, env = process.env) {
  const key = tokenKey(env);
  if (!key) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(TOKEN_AAD);
  const payload = Buffer.from(JSON.stringify({ config, expiresAt: Date.now() + TTL_MS }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [TOKEN_VERSION, iv.toString('base64url'), encrypted.toString('base64url'), tag.toString('base64url')].join('.');
}

function openConfig(token, env = process.env) {
  const key = tokenKey(env);
  if (!key || !token.startsWith(TOKEN_VERSION + '.')) return null;
  try {
    const [, ivValue, encryptedValue, tagValue] = token.split('.');
    if (!ivValue || !encryptedValue || !tagValue) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
    decipher.setAAD(TOKEN_AAD);
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]);
    const payload = JSON.parse(decrypted.toString('utf8'));
    if (!payload?.config || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
    return payload.config;
  } catch {
    return null;
  }
}

function clean(value, max = 512) {
  return String(value ?? '').trim().slice(0, max);
}

function numberValue(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw Object.assign(new Error('生成参数必须是数字。'), { status: 400, code: 'INVALID_MODEL_CONFIG' });
  return Math.min(max, Math.max(min, parsed));
}

function enabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return false;
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (/^(fc|fd)/.test(normalized) || /^fe[89ab]/.test(normalized)) return true;
  const mappedIpv4 = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

function isPrivateHostname(hostname) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized.endsWith('.internal')
    || normalized.endsWith('.lan')
    || normalized.endsWith('.home')) return true;
  const version = isIP(normalized);
  if (version === 4) return isPrivateIpv4(normalized);
  if (version === 6) return isPrivateIpv6(normalized);
  return false;
}

function normalizeBaseUrl(value, { apiKey = '', provider = '', env = process.env } = {}) {
  const raw = clean(value, 2048) || (apiKey && provider !== 'vllm-local' ? 'https://api.openai.com/v1' : '');
  if (!raw) return '';
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw Object.assign(new Error('API Base URL 必须是完整的 http(s) 地址。'), { status: 400, code: 'INVALID_MODEL_CONFIG' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('模型服务地址只支持 http 或 https。'), { status: 400, code: 'INVALID_MODEL_CONFIG' });
  }
  if (parsed.username || parsed.password) {
    throw Object.assign(new Error('请不要把认证信息写入模型服务地址。'), { status: 400, code: 'INVALID_MODEL_CONFIG' });
  }
  const blocked = ['169.254.169.254', 'metadata.google.internal', 'metadata.google.com'];
  const allowPrivate = enabled(env.ALLOW_PRIVATE_MODEL_ENDPOINTS);
  const allowInsecure = enabled(env.ALLOW_INSECURE_MODEL_ENDPOINTS) || allowPrivate;
  if (blocked.includes(parsed.hostname.toLowerCase()) || (!allowPrivate && isPrivateHostname(parsed.hostname))) {
    throw Object.assign(new Error('该模型服务地址不允许访问。'), { status: 400, code: 'INVALID_MODEL_CONFIG' });
  }
  if (parsed.protocol !== 'https:' && !allowInsecure) {
    throw Object.assign(new Error('公开环境中的模型服务地址必须使用 HTTPS。'), { status: 400, code: 'INVALID_MODEL_CONFIG' });
  }
  return raw.replace(/\/+$/, '');
}

function purgeExpired() {
  const entries = store();
  const now = Date.now();
  for (const [token, value] of entries) {
    if (now - value.updatedAt > TTL_MS) entries.delete(token);
  }
  while (entries.size > MAX_CONFIGS) {
    const oldest = [...entries.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
    if (!oldest) break;
    entries.delete(oldest[0]);
  }
}

export function normalizeModelConfig(input = {}, { existing = null, env = process.env } = {}) {
  const provider = clean(input.provider || existing?.provider || 'openai-compatible', 80) || 'openai-compatible';
  const apiKey = input.apiKey === undefined ? (existing?.apiKey || '') : clean(input.apiKey, 4096);
  const model = clean(input.model === undefined ? existing?.model : input.model, 256);
  const baseUrl = normalizeBaseUrl(input.baseUrl === undefined ? existing?.baseUrl : input.baseUrl, { apiKey, provider, env });
  if (!model) throw Object.assign(new Error('请填写模型名称。'), { status: 400, code: 'MODEL_CONFIG_INCOMPLETE' });
  if (!baseUrl) throw Object.assign(new Error('请填写 API Base URL 或模型服务地址。'), { status: 400, code: 'MODEL_CONFIG_INCOMPLETE' });
  return {
    provider,
    baseUrl,
    apiKey,
    model,
    temperature: numberValue(input.temperature, existing?.temperature ?? 0.2, 0, 2),
    maxTokens: Math.round(numberValue(input.maxTokens, existing?.maxTokens ?? 1200, 128, 4096)),
    timeoutMs: Math.round(numberValue(input.timeoutMs, existing?.timeoutMs ?? 60000, 5000, 180000)),
  };
}

export function getConfigToken(request) {
  return clean(request?.headers?.get('x-agent-config-token') || '', 12 * 1024);
}

export function getStoredModelConfig(token, env = process.env) {
  purgeExpired();
  if (!token) return null;
  const sealed = openConfig(token, env);
  if (sealed) return sealed;
  return store().get(token)?.config || null;
}

export function getModelConfigForRequest(request, env = process.env) {
  const configured = getStoredModelConfig(getConfigToken(request), env);
  return configured || null;
}

export function upsertModelConfig(input, token = '', env = process.env) {
  purgeExpired();
  const entries = store();
  const current = getStoredModelConfig(token, env);
  const config = normalizeModelConfig(input, { existing: current, env });
  const sealedToken = sealConfig(config, env);
  if (sealedToken) return { token: sealedToken, config };
  const nextToken = token && entries.has(token) ? token : randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  entries.set(nextToken, { config, updatedAt: Date.now() });
  purgeExpired();
  return { token: nextToken, config };
}

export function clearModelConfig(token) {
  if (!token) return false;
  if (token.startsWith(TOKEN_VERSION + '.')) return true;
  return store().delete(token);
}

function keyHint(apiKey) {
  if (!apiKey) return '';
  return apiKey.length > 4 ? `••••${apiKey.slice(-4)}` : '••••';
}

export function publicModelConfig(config, { source = 'session', testedAt = null, online = null } = {}) {
  if (!config) return { configured: false, source };
  return {
    configured: Boolean(config.baseUrl && config.model),
    source,
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKeyConfigured: Boolean(config.apiKey),
    keyHint: source === 'environment' ? '' : keyHint(config.apiKey),
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    ...(testedAt ? { testedAt } : {}),
    ...(online !== null ? { online } : {}),
  };
}

export function envModelConfigStatus(env = process.env) {
  const baseUrl = clean(env.LLM_API_BASE_URL || env.OPENAI_BASE_URL || '', 2048) || (env.LLM_API_KEY && env.LLM_MODEL ? 'https://api.openai.com/v1' : '');
  const model = clean(env.LLM_MODEL || env.OPENAI_MODEL || '', 256);
  const provider = clean(env.LLM_PROVIDER || 'openai-compatible', 80);
  const isFreeDefault = provider === 'groq' && model === 'qwen/qwen3.6-27b';
  return {
    configured: Boolean(baseUrl && model),
    source: 'environment',
    provider,
    baseUrl,
    model,
    apiKeyConfigured: Boolean(env.LLM_API_KEY || env.OPENAI_API_KEY),
    keyHint: '',
    temperature: Number(env.LLM_TEMPERATURE || 0.2),
    maxTokens: Number(env.LLM_MAX_TOKENS || 1200),
    timeoutMs: Number(env.LLM_TIMEOUT_MS || 60000),
    isFreeDefault,
    defaultLabel: isFreeDefault ? 'Groq 免费默认' : '部署默认',
  };
}
