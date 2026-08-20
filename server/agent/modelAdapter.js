export class ModelAdapterError extends Error {
  constructor(message, { code = 'MODEL_REQUEST_FAILED', status = 502 } = {}) {
    super(message);
    this.name = 'ModelAdapterError';
    this.code = code;
    this.status = status;
  }
}

function numberFromValue(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function chatCompletionUrl(baseUrl) {
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl;
  if (/\/v1$/i.test(baseUrl)) return `${baseUrl}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

function contentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((item) => typeof item === 'string' ? item : item?.text || '').join('');
  }
  return content?.text || '';
}

async function responseError(response) {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 800);
  } catch {
    detail = '';
  }
  return new ModelAdapterError(
    `模型服务返回 ${response.status}${detail ? `：${detail}` : ''}`,
    { code: 'MODEL_HTTP_ERROR', status: response.status >= 500 ? 502 : response.status },
  );
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs, externalSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  const onAbort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ModelAdapterError('模型请求超时或已取消。', { code: 'MODEL_TIMEOUT', status: 504 });
    }
    throw new ModelAdapterError(`无法连接模型服务：${error.message}`, { code: 'MODEL_UNREACHABLE', status: 502 });
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onAbort);
  }
}

export function resolveModelConfig(env = process.env, overrides = null) {
  const supplied = overrides && typeof overrides === 'object' ? overrides : {};
  const explicitBaseUrl = supplied.baseUrl ?? env.LLM_API_BASE_URL ?? env.OPENAI_BASE_URL ?? '';
  const apiKey = supplied.apiKey ?? env.LLM_API_KEY ?? env.OPENAI_API_KEY ?? '';
  const model = supplied.model ?? env.LLM_MODEL ?? env.OPENAI_MODEL ?? '';
  const baseUrl = normalizeBaseUrl(explicitBaseUrl || (apiKey ? 'https://api.openai.com/v1' : ''));
  const provider = supplied.provider ?? env.LLM_PROVIDER ?? (baseUrl.includes('127.0.0.1') || baseUrl.includes('localhost') ? 'vllm-local' : 'openai-compatible');
  return {
    provider: String(provider || 'openai-compatible').trim(),
    baseUrl,
    apiKey: String(apiKey || '').trim(),
    model: String(model || '').trim(),
    temperature: numberFromValue(supplied.temperature ?? env.LLM_TEMPERATURE, 0.2, 0, 2),
    maxTokens: Math.round(numberFromValue(supplied.maxTokens ?? env.LLM_MAX_TOKENS, 1200, 128, 4096)),
    timeoutMs: Math.round(numberFromValue(supplied.timeoutMs ?? env.LLM_TIMEOUT_MS, 60000, 5000, 180000)),
    configured: Boolean(baseUrl && model),
  };
}

export function createModelAdapter({ env = process.env, config: configOverride = null, fetchImpl = fetch } = {}) {
  const config = resolveModelConfig(env, configOverride);

  const headers = {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  };

  const requestBody = (messages, stream, overrides = {}) => ({
    model: config.model,
    messages,
    temperature: overrides.temperature ?? config.temperature,
    max_tokens: overrides.maxTokens ?? config.maxTokens,
    stream,
  });

  const requestCompletion = async ({ messages, stream = false, signal, overrides = {} } = {}) => {
    if (!config.configured) {
      throw new ModelAdapterError('尚未配置模型服务。', { code: 'MODEL_NOT_CONFIGURED', status: 503 });
    }
    const response = await fetchWithTimeout(fetchImpl, chatCompletionUrl(config.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody(messages, stream, overrides)),
    }, config.timeoutMs, signal);
    if (!response.ok) throw await responseError(response);
    return response;
  };

  return {
    config: {
      provider: config.provider,
      baseUrl: config.baseUrl,
      model: config.model,
      configured: config.configured,
      apiKeyConfigured: Boolean(config.apiKey),
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeoutMs: config.timeoutMs,
    },

    async generateAnswer({ messages, signal, overrides } = {}) {
      const response = await requestCompletion({ messages, signal, overrides });
      const payload = await response.json();
      const text = contentText(payload?.choices?.[0]?.message?.content).trim();
      if (!text) throw new ModelAdapterError('模型返回了空回答。', { code: 'MODEL_EMPTY_RESPONSE', status: 502 });
      return { text, usage: payload.usage || null, responseId: payload.id || null };
    },

    async testConnection({ signal } = {}) {
      const result = await this.generateAnswer({
        messages: [{ role: 'user', content: '请只回复 OK。' }],
        signal,
        overrides: { temperature: 0, maxTokens: 16 },
      });
      return { ok: true, responseId: result.responseId, usage: result.usage };
    },

    async *streamAnswer({ messages, signal } = {}) {
      const response = await requestCompletion({ messages, stream: true, signal });
      if (!response.body) throw new ModelAdapterError('模型服务没有返回流。', { code: 'MODEL_EMPTY_STREAM', status: 502 });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const events = buffer.split(/\r?\n\r?\n/);
          buffer = events.pop() || '';
          for (const event of events) {
            for (const line of event.split(/\r?\n/)) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (!data || data === '[DONE]') continue;
              let payload;
              try {
                payload = JSON.parse(data);
              } catch {
                continue;
              }
              const delta = contentText(payload?.choices?.[0]?.delta?.content);
              if (delta) yield delta;
            }
          }
          if (done) break;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}
