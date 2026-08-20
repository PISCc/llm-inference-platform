import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { useModelConfig } from '../context/ModelConfigContext.jsx';

const DEFAULTS = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
  temperature: '0.2',
  maxTokens: '1200',
  timeoutMs: '60000',
};

export default function ModelConfigDialog() {
  const { status, isOpen, close, busy, error, setError, saveAndTest, clear } = useModelConfig();
  const [form, setForm] = useState(DEFAULTS);
  const [notice, setNotice] = useState('');
  const usingFreeDefault = status.source === 'environment' && status.isFreeDefault;

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      ...DEFAULTS,
      provider: status.provider || DEFAULTS.provider,
      baseUrl: status.baseUrl || DEFAULTS.baseUrl,
      model: status.model || '',
      temperature: String(status.temperature ?? DEFAULTS.temperature),
      maxTokens: String(status.maxTokens ?? DEFAULTS.maxTokens),
      timeoutMs: String(status.timeoutMs ?? DEFAULTS.timeoutMs),
      apiKey: '',
    });
    setNotice('');
    setError('');
  }, [isOpen, setError, status.baseUrl, status.maxTokens, status.model, status.provider, status.temperature, status.timeoutMs]);

  if (!isOpen) return null;

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const updateProvider = (event) => {
    const provider = event.target.value;
    setForm((current) => ({
      ...current,
      provider,
      ...(provider === 'groq' ? {
        baseUrl: 'https://api.groq.com/openai/v1',
        model: 'qwen/qwen3.6-27b',
      } : {}),
    }));
  };
  const submit = async (event) => {
    event.preventDefault();
    setNotice('');
    try {
      const payload = {
        ...form,
        temperature: Number(form.temperature),
        maxTokens: Number(form.maxTokens),
        timeoutMs: Number(form.timeoutMs),
      };
      if (!payload.apiKey && status.source === 'session' && status.apiKeyConfigured) delete payload.apiKey;
      const result = await saveAndTest(payload);
      setNotice(result?.config?.online === false ? '配置已保存，但连接测试未通过。' : '连接成功，后续问答将使用该模型。');
    } catch {
      // Error is rendered from context.
    }
  };
  const remove = async () => {
    try {
      await clear();
      setNotice('已清除当前会话的模型配置，将使用服务端默认配置或离线知识。');
    } catch {
      // Error is rendered from context.
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-space-50/20 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}
      >
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-label="模型服务配置"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-2xl border border-space-700 bg-space-900 shadow-[0_24px_90px_rgba(67,58,46,0.2)]"
        >
          <header className="flex items-start justify-between gap-4 border-b border-space-700/80 px-5 py-4 md:px-6">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-space-100"><ShieldCheck size={17} className="text-cyan-600" />模型服务配置</div>
              <p className="mt-1.5 max-w-xl text-xs leading-5 text-space-500">{usingFreeDefault ? '当前可直接使用免费默认模型，也可填写自己的 API。' : '填写你的 API Key、模型和服务地址。密钥只在服务端运行时使用。'}</p>
            </div>
            <button type="button" aria-label="关闭模型配置" onClick={close} disabled={busy} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-space-500 transition hover:bg-space-800 hover:text-space-200 disabled:opacity-40"><X size={16} /></button>
          </header>

          <form onSubmit={submit} className="space-y-5 p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs text-space-400">
                服务商
                <select value={form.provider} onChange={updateProvider} className="mt-2 w-full rounded-xl border border-space-700 bg-space-950 px-3 py-2.5 text-sm text-space-200 outline-none focus:border-cyan-500/50">
                  <option value="groq">Groq 免费接口</option>
                  <option value="openai-compatible">OpenAI 兼容接口</option>
                  <option value="vllm-local">本地 vLLM</option>
                  <option value="custom">其他兼容服务</option>
                </select>
              </label>
              <label className="block text-xs text-space-400">
                模型名称 <span className="text-rose-400">*</span>
                <input value={form.model} onChange={update('model')} required placeholder="例如：gpt-4o-mini / Qwen2.5-7B-Instruct" className="mt-2 w-full rounded-xl border border-space-700 bg-space-950 px-3 py-2.5 text-sm text-space-200 outline-none placeholder:text-space-600 focus:border-cyan-500/50" />
              </label>
            </div>

            <label className="block text-xs text-space-400">
              API Base URL / 模型服务地址 <span className="text-rose-400">*</span>
              <input value={form.baseUrl} onChange={update('baseUrl')} required placeholder="https://api.openai.com/v1" className="mt-2 w-full rounded-xl border border-space-700 bg-space-950 px-3 py-2.5 text-sm text-space-200 outline-none placeholder:text-space-600 focus:border-cyan-500/50" />
              <span className="mt-1.5 block text-[11px] text-space-600">OpenAI 兼容服务通常填写到 `/v1`；本地 vLLM 可填写 `http://127.0.0.1:8000/v1`。</span>
            </label>

            <label className="block text-xs text-space-400">
              API Key {status.source === 'session' && status.apiKeyConfigured && <span className="text-space-600">（留空则保留当前 Key）</span>}
              <input type="password" value={form.apiKey} onChange={update('apiKey')} placeholder={status.source === 'session' && status.apiKeyConfigured ? '已配置，留空保持不变' : '输入服务商 API Key'} autoComplete="off" className="mt-2 w-full rounded-xl border border-space-700 bg-space-950 px-3 py-2.5 text-sm text-space-200 outline-none placeholder:text-space-600 focus:border-cyan-500/50" />
              {status.source === 'environment' && status.apiKeyConfigured && (
                <span className="mt-1.5 block text-[11px] text-amber-500">部署默认 Key 不会复制到用户会话配置；创建新配置时请重新输入 Key。</span>
              )}
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-xs text-space-400">Temperature<input type="number" min="0" max="2" step="0.1" value={form.temperature} onChange={update('temperature')} className="mt-2 w-full rounded-xl border border-space-700 bg-space-950 px-3 py-2.5 text-sm text-space-200 outline-none focus:border-cyan-500/50" /></label>
              <label className="block text-xs text-space-400">Max Tokens<input type="number" min="128" max="4096" step="1" value={form.maxTokens} onChange={update('maxTokens')} className="mt-2 w-full rounded-xl border border-space-700 bg-space-950 px-3 py-2.5 text-sm text-space-200 outline-none focus:border-cyan-500/50" /></label>
              <label className="block text-xs text-space-400">Timeout (ms)<input type="number" min="5000" max="180000" step="1000" value={form.timeoutMs} onChange={update('timeoutMs')} className="mt-2 w-full rounded-xl border border-space-700 bg-space-950 px-3 py-2.5 text-sm text-space-200 outline-none focus:border-cyan-500/50" /></label>
            </div>

            <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/[0.05] p-3 text-[11px] leading-5 text-space-500">
              <div className="flex items-center gap-2 font-medium text-cyan-600"><ShieldCheck size={13} />密钥保护</div>
              <p className="mt-1">API Key 不会写入页面上下文、对话历史或浏览器存储。当前配置保存在服务端会话内存中，服务重启后需要重新输入。</p>
            </div>

            {(error || notice) && (
              <div className={`flex items-start gap-2 rounded-xl border p-3 text-xs leading-5 ${error ? 'border-rose-500/20 bg-rose-500/[0.06] text-rose-200' : 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-200'}`}>
                {error ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
                <span>{error || notice}</span>
              </div>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-space-700/70 pt-4">
              <button type="button" onClick={remove} disabled={busy || status.source !== 'session'} className="text-xs text-space-600 transition hover:text-rose-300 disabled:opacity-35">清除当前配置</button>
              <div className="flex gap-2">
                <button type="button" onClick={close} disabled={busy} className="rounded-xl border border-space-700 px-4 py-2.5 text-xs text-space-400 transition hover:bg-space-800 disabled:opacity-40">取消</button>
                <button type="submit" disabled={busy || !form.model.trim() || !form.baseUrl.trim()} className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-45">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}保存并测试连接</button>
              </div>
            </footer>
          </form>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
