import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Expand,
  FileSliders,
  LoaderCircle,
  MessageSquareText,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { usePageContext } from '../context/PageContext.jsx';
import { useAgentSession } from '../context/AgentSessionContext.jsx';
import { usePptExport } from '../context/PptExportContext.jsx';
import { useModelConfig } from '../context/ModelConfigContext.jsx';
import AnswerContent from '../modules/agent/AnswerContent.jsx';

const STATUS_LABELS = {
  connecting: '正在连接',
  streaming: '正在回答',
  fallback: '本地知识',
  done: '回答完成',
  error: '需要重试',
  stopped: '已停止',
};

function uniqueBy(items = [], getKey) {
  const seen = new Set();
  return items.filter((item, index) => {
    const key = String(getKey(item, index) || `item-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function AssistantTurn({ turn, onAction, onExport }) {
  const busy = ['connecting', 'streaming'].includes(turn.status) && !turn.answer;
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-md bg-space-200 px-3.5 py-2.5 text-[13px] leading-5 text-space-900">
          {turn.query}
        </div>
      </div>
      <div className="max-w-[94%] rounded-2xl rounded-bl-md border border-space-700/80 bg-space-900 px-3.5 py-3 shadow-[0_8px_24px_rgba(67,58,46,0.05)]">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-space-500">
          <span className="inline-flex items-center gap-1 font-medium text-cyan-600">
            {busy ? <LoaderCircle size={11} className="animate-spin" /> : <Bot size={11} />}
            {STATUS_LABELS[turn.status] || 'AI 助手'}
          </span>
        </div>
        {busy ? (
          <div className="mt-3 flex items-center gap-2 text-xs text-space-500">
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((index) => <i key={index} className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" style={{ animationDelay: `${index * 120}ms` }} />)}
            </span>
            正在生成回答
          </div>
        ) : (
          <AnswerContent text={turn.answer} compact className="mt-2" />
        )}
        {turn.error && !turn.answer && (
          <div className="mt-2 rounded-lg bg-amber-500/[0.08] px-2.5 py-2 text-[11px] leading-5 text-amber-600">
            {turn.error}
          </div>
        )}
        {(turn.meta?.relatedActions || []).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {uniqueBy(turn.meta.relatedActions.slice(0, 3), (action) => `${action.path}-${action.label}`).map((action, index) => (
              <button
                key={`${action.path}-${action.label}-${index}`}
                type="button"
                onClick={() => onAction(action)}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.08] px-2 py-1.5 text-[10px] font-medium text-cyan-600 transition hover:bg-cyan-500/[0.14] focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                {action.label}<ArrowRight size={10} />
              </button>
            ))}
          </div>
        )}
        {turn.answer && !['connecting', 'streaming'].includes(turn.status) && (
          <button
            type="button"
            onClick={() => onExport(turn)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.08] px-2.5 py-1.5 text-[10px] font-medium text-violet-600 transition hover:bg-violet-500/[0.14] focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          >
            <FileSliders size={11} />生成 PPT
          </button>
        )}
      </div>
    </div>
  );
}

export default function GlobalAssistant() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { pageContext } = usePageContext();
  const { turns, isOpen, setIsOpen, ask, clearConversation } = useAgentSession();
  const { openPptExport } = usePptExport();
  const { open: openModelConfig, status: modelStatus } = useModelConfig();
  const [query, setQuery] = useState('');
  const transcriptRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = useMemo(() => {
    const provided = pageContext.suggestedQuestions || [];
    if (provided.length) return provided.slice(0, 3);
    if (pageContext.pageTitle) return [
      `解释当前${pageContext.activeSection || '页面'}的关键概念`,
      '当前结果应该如何理解？',
    ];
    return ['KV Cache 为什么会占用显存？', 'Prefill 和 Decode 有什么区别？'];
  }, [pageContext.activeSection, pageContext.pageTitle, pageContext.suggestedQuestions]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, turns]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setIsOpen]);

  if (pathname === '/agent') return null;

  const submit = (value = query) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    setQuery('');
    ask(normalized);
  };
  const openAction = (action) => {
    navigate(action.path, action.state ? { state: action.state } : undefined);
  };
  const openFullScreen = () => {
    setIsOpen(false);
    navigate('/agent', { state: { fromGlobalAssistant: true } });
  };

  return (
    <>
      <button
        type="button"
        aria-label="打开 AI 助手"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className={`fixed z-40 flex min-h-11 items-center gap-2 rounded-full border border-cyan-500/30 bg-space-900/95 px-3.5 py-2.5 text-xs font-semibold text-space-200 shadow-[0_12px_34px_rgba(67,58,46,0.14)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-500/45 hover:text-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 md:right-5 md:top-[4.75rem] ${isOpen ? 'pointer-events-none opacity-0' : 'bottom-4 right-4 opacity-100 md:bottom-auto'}`}
      >
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-white">
          <Bot size={14} />
          {turns.length > 0 && <i className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-space-900 bg-emerald-400" />}
        </span>
        问当前页
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.button
              type="button"
              aria-label="关闭 AI 助手"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-space-50/15 backdrop-blur-[1px] md:hidden"
            />
            <motion.section
              role="dialog"
              aria-modal="false"
              aria-label="AI 全局问答助手"
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col overflow-hidden rounded-t-[1.4rem] border border-space-700 bg-space-900 shadow-[0_-18px_60px_rgba(67,58,46,0.18)] md:inset-auto md:right-5 md:top-[4.75rem] md:h-[min(680px,calc(100vh-6rem))] md:w-[420px] md:max-h-none md:rounded-2xl md:shadow-[0_20px_70px_rgba(67,58,46,0.18)]"
            >
              <header className="border-b border-space-700/80 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/[0.1] text-cyan-600"><Bot size={17} /></span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-space-100">AI 助手</h2>
                      <p className="mt-0.5 truncate text-[10px] text-space-500">{pageContext.pageTitle || '大模型推理互动展示平台'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="配置模型服务"
                      title={modelStatus.configured ? `${modelStatus.source === 'session' ? '会话模型' : modelStatus.isFreeDefault ? '免费默认模型' : '部署默认'}：${modelStatus.model}` : '尚未配置在线模型'}
                      onClick={openModelConfig}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-space-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 ${modelStatus.configured ? 'text-emerald-500' : 'text-space-500 hover:text-cyan-600'}`}
                    >
                      <Settings2 size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="将当前页生成 PPT"
                      onClick={() => openPptExport({ title: pageContext.pageTitle || '大模型推理' })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-space-500 transition hover:bg-space-800 hover:text-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    >
                      <FileSliders size={14} />
                    </button>
                    {turns.length > 0 && (
                      <button type="button" aria-label="清空对话" onClick={clearConversation} className="flex h-8 w-8 items-center justify-center rounded-lg text-space-500 transition hover:bg-space-800 hover:text-space-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"><Trash2 size={14} /></button>
                    )}
                    <button type="button" aria-label="进入完整问答页" onClick={openFullScreen} className="flex h-8 w-8 items-center justify-center rounded-lg text-space-500 transition hover:bg-space-800 hover:text-space-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"><Expand size={14} /></button>
                    <button type="button" aria-label="关闭 AI 助手" onClick={() => setIsOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-space-500 transition hover:bg-space-800 hover:text-space-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"><X size={15} /></button>
                  </div>
                </div>
              </header>

              <div ref={transcriptRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4" aria-live="polite">
                {turns.length === 0 ? (
                  <div className="flex h-full min-h-56 flex-col justify-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-600"><Sparkles size={18} /></div>
                    <h3 className="mt-4 text-base font-semibold text-space-100">结合当前页面提问</h3>
                    <p className="mt-2 text-xs leading-6 text-space-500">直接提问当前页面中的概念、参数或结果。</p>
                    <div className="mt-4 space-y-2">
                      {suggestions.map((suggestion) => (
                        <button key={suggestion} type="button" onClick={() => submit(suggestion)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-space-700/80 bg-space-950/65 px-3 py-2.5 text-left text-xs leading-5 text-space-400 transition hover:border-cyan-500/30 hover:bg-space-950 hover:text-space-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20">
                          <span>{suggestion}</span><ArrowRight size={13} className="shrink-0 text-space-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : turns.map((turn) => (
                  <AssistantTurn
                    key={turn.id}
                    turn={turn}
                    onAction={openAction}
                    onExport={(selectedTurn) => openPptExport({
                      title: selectedTurn.query,
                      answer: selectedTurn.answer,
                      sources: selectedTurn.meta?.sources || [],
                    })}
                  />
                ))}
              </div>

              <footer className="border-t border-space-700/80 bg-space-950/55 p-3">
                {turns.length > 0 && suggestions.length > 0 && (
                  <div className="assistant-chip-scroll mb-2 flex gap-1.5 overflow-x-auto pb-1">
                    {suggestions.slice(0, 2).map((suggestion) => (
                      <button key={suggestion} type="button" onClick={() => submit(suggestion)} className="shrink-0 rounded-full border border-space-700 bg-space-900 px-2.5 py-1.5 text-[10px] text-space-500 transition hover:border-cyan-500/30 hover:text-cyan-600">{suggestion}</button>
                    ))}
                  </div>
                )}
                <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="relative">
                  <textarea
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        submit();
                      }
                    }}
                    rows={2}
                    maxLength={500}
                    aria-label="向 AI 助手提问"
                    placeholder="询问当前页面或任意推理概念…"
                    className="w-full resize-none rounded-xl border border-space-700 bg-space-900 px-3 py-2.5 pr-12 text-[13px] leading-5 text-space-200 outline-none transition placeholder:text-space-500 focus:border-cyan-500/45 focus:ring-2 focus:ring-cyan-500/10"
                  />
                  <button type="submit" aria-label="发送问题" disabled={!query.trim()} className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-35 focus:outline-none focus:ring-2 focus:ring-cyan-500/25"><Send size={14} /></button>
                </form>
                <div className="mt-1.5 flex items-center justify-between text-[9px] text-space-500">
                  <span>Enter 发送 · Shift+Enter 换行</span>
                  <button type="button" onClick={openFullScreen} className="inline-flex items-center gap-1 hover:text-cyan-600"><MessageSquareText size={10} />完整问答页</button>
                </div>
              </footer>
            </motion.section>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
