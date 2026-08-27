const DEV_API_ORIGIN = 'http://127.0.0.1:8787';
const FILE_MODE_ORIGIN_KEY = 'llm-inference-agent-api-origin-v1';

function configuredOrigin() {
  const configured = String(import.meta.env.VITE_AGENT_API_URL || '').trim();
  if (!configured) return '';
  try {
    return new URL(configured, typeof window !== 'undefined' ? window.location.href : undefined).origin;
  } catch {
    return '';
  }
}

function storedFileModeOrigin() {
  if (typeof window === 'undefined') return '';
  try {
    return String(window.localStorage.getItem(FILE_MODE_ORIGIN_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function isFileMode() {
  return typeof window !== 'undefined' && window.location.protocol === 'file:';
}

/**
 * API origin used when the single-file build is opened directly via file://.
 * Defaults to the local Node API; advanced users can override it by storing
 * the target origin in localStorage under llm-inference-agent-api-origin-v1.
 */
export function fileModeApiOrigin() {
  return storedFileModeOrigin() || DEV_API_ORIGIN;
}

/**
 * Resolve the base for auxiliary API calls (model config, PPT).
 * - file:// builds: local Node API (callers need `npm start` running).
 * - VITE_AGENT_API_URL set: use its origin so all API clients stay on one server.
 * - Vite dev server: local agent API.
 * - Otherwise: same-origin /api.
 */
export function apiBaseUrl() {
  if (isFileMode()) return fileModeApiOrigin();
  const configured = configuredOrigin();
  if (configured) return configured;
  if (import.meta.env.DEV) return DEV_API_ORIGIN;
  return '';
}

export function apiEndpoint(path) {
  const base = apiBaseUrl();
  return base ? base + path : path;
}
