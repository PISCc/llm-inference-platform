import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Download, FileSliders, LoaderCircle, Sparkles, X } from 'lucide-react';
import { useAgentSession } from '../context/AgentSessionContext.jsx';
import { usePageContext } from '../context/PageContext.jsx';
import { usePptExport } from '../context/PptExportContext.jsx';
import { createPptOutline, downloadPpt, renderPpt } from '../modules/agent/pptClient.js';

const THEMES = [
  ['platform-light', '平台浅色'],
  ['executive-dark', '深色汇报'],
  ['paper', '简洁纸张'],
];

function sourceType(pageId, scope) {
  if (pageId === 'compare') return 'comparison';
  if (pageId === 'diagnosis') return 'diagnosis';
  return scope === 'page' ? 'page' : 'answer';
}

export default function PptExportDialog() {
  const { request, closePptExport } = usePptExport();
  const { pageContext } = usePageContext();
  const { activeTurn } = useAgentSession();
  const [scope, setScope] = useState('answer');
  const [preferences, setPreferences] = useState({ audience: '技术同事', durationMinutes: 10, slideCount: 6, theme: 'platform-light' });
  const [phase, setPhase] = useState('configure');
  const [spec, setSpec] = useState(null);
  const [mode, setMode] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const abortRef = useRef(null);

  const canUseAnswer = Boolean((request?.answer || activeTurn?.answer || '').trim());
  const effectiveScope = canUseAnswer ? scope : 'page';
  const title = request?.title || pageContext.pageTitle || activeTurn?.query || '大模型推理';
  const source = useMemo(() => ({
    type: sourceType(pageContext.pageId, effectiveScope),
    label: effectiveScope === 'answer' ? (activeTurn?.query || title) : title,
    answer: effectiveScope === 'answer' ? (request?.answer || activeTurn?.answer || '') : '',
    pageContext,
    sources: request?.sources || activeTurn?.meta?.sources || [],
  }), [activeTurn, effectiveScope, pageContext, request, title]);

  useEffect(() => {
    if (!request) return;
    setScope(request.answer || activeTurn?.answer ? 'answer' : 'page');
    setPhase('configure');
    setSpec(null);
    setMode('');
    setError('');
    setResult(null);
    // 只在请求打开/切换时初始化；回答继续流式更新不应重置用户正在编辑的大纲。
  }, [request]);

  useEffect(() => {
    if (!request) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && phase !== 'rendering') closePptExport();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePptExport, phase, request]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const generateOutline = async () => {
    setError('');
    setPhase('outlining');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await createPptOutline({
        source,
        preferences: { ...preferences, title },
      }, { signal: controller.signal });
      setSpec(response.spec);
      setMode(response.mode);
      setPhase('outline');
    } catch (nextError) {
      setError(nextError.message);
      setPhase('configure');
    }
  };

  const updateSlide = (index, patch) => {
    setSpec((current) => ({
      ...current,
      slides: current.slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, ...patch } : slide),
    }));
  };

  const createDeck = async () => {
    setError('');
    setPhase('rendering');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const nextResult = await renderPpt(spec, { signal: controller.signal });
      downloadPpt(nextResult);
      setResult(nextResult);
      setPhase('complete');
    } catch (nextError) {
      setError(nextError.message);
      setPhase('outline');
    }
  };

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-space-950/35 p-0 backdrop-blur-sm md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label="生成 PowerPoint"
            initial={{ opacity: 0, y: 18, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl border border-space-700 bg-space-900 shadow-[0_28px_90px_rgba(67,58,46,0.22)] md:rounded-3xl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-space-700/80 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/[0.1] text-violet-600"><FileSliders size={18} /></span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-space-100">将内容生成 PPT</h2>
                  <p className="mt-0.5 truncate text-xs text-space-500">{title}</p>
                </div>
              </div>
              <button type="button" aria-label="关闭" disabled={phase === 'rendering'} onClick={closePptExport} className="flex h-9 w-9 items-center justify-center rounded-lg text-space-500 transition hover:bg-space-800 hover:text-space-200 disabled:opacity-30"><X size={16} /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
              {phase === 'configure' && (
                <div className="space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-space-300">内容范围</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <button type="button" disabled={!canUseAnswer} onClick={() => setScope('answer')} className={`rounded-xl border p-4 text-left transition ${effectiveScope === 'answer' ? 'border-violet-500/40 bg-violet-500/[0.08]' : 'border-space-700 bg-space-950/35'} disabled:cursor-not-allowed disabled:opacity-40`}>
                        <div className="text-sm font-semibold text-space-200">当前回答</div>
                        <p className="mt-1 text-xs leading-5 text-space-500">把最近一轮回答整理成演示文稿。</p>
                      </button>
                      <button type="button" onClick={() => setScope('page')} className={`rounded-xl border p-4 text-left transition ${effectiveScope === 'page' ? 'border-cyan-500/40 bg-cyan-500/[0.08]' : 'border-space-700 bg-space-950/35'}`}>
                        <div className="text-sm font-semibold text-space-200">当前页面</div>
                        <p className="mt-1 text-xs leading-5 text-space-500">使用当前页面内容生成对应结构。</p>
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-space-300">听众
                      <input value={preferences.audience} maxLength={60} onChange={(event) => setPreferences((current) => ({ ...current, audience: event.target.value }))} className="mt-2 w-full rounded-xl border border-space-700 bg-space-950/55 px-3 py-2.5 text-sm font-normal text-space-200 outline-none focus:border-violet-500/40" />
                    </label>
                    <label className="text-xs font-semibold text-space-300">主题
                      <select value={preferences.theme} onChange={(event) => setPreferences((current) => ({ ...current, theme: event.target.value }))} className="mt-2 w-full rounded-xl border border-space-700 bg-space-950/55 px-3 py-2.5 text-sm font-normal text-space-200 outline-none focus:border-violet-500/40">
                        {THEMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-space-300">讲解时长
                      <select value={preferences.durationMinutes} onChange={(event) => setPreferences((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} className="mt-2 w-full rounded-xl border border-space-700 bg-space-950/55 px-3 py-2.5 text-sm font-normal text-space-200 outline-none focus:border-violet-500/40">
                        {[5, 10, 15, 20].map((value) => <option key={value} value={value}>{value} 分钟</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-space-300">页数
                      <select value={preferences.slideCount} onChange={(event) => setPreferences((current) => ({ ...current, slideCount: Number(event.target.value) }))} className="mt-2 w-full rounded-xl border border-space-700 bg-space-950/55 px-3 py-2.5 text-sm font-normal text-space-200 outline-none focus:border-violet-500/40">
                        {[4, 6, 8, 10].map((value) => <option key={value} value={value}>{value} 页</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {phase === 'outlining' && (
                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                  <LoaderCircle size={28} className="animate-spin text-violet-500" />
                  <h3 className="mt-4 text-base font-semibold text-space-100">正在组织演示叙事</h3>
                  <p className="mt-2 text-xs text-space-500">正在生成可编辑演示文稿。</p>
                </div>
              )}

              {['outline', 'rendering'].includes(phase) && spec && (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-space-200">确认大纲</div>
                      <p className="mt-1 text-xs text-space-500">{spec.slides.length} 页 · {mode === 'model' ? '模型编排' : '确定性编排'} · 可修改标题、结论和要点</p>
                    </div>
                    <span className="rounded-full border border-space-700 bg-space-950 px-2.5 py-1 text-[10px] text-space-500">可编辑内容</span>
                  </div>
                  <div className="mt-5 space-y-3">
                    {spec.slides.map((slide, index) => (
                      <article key={slide.id} className="rounded-xl border border-space-700/80 bg-space-950/35 p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] font-semibold text-violet-500">{String(index + 1).padStart(2, '0')}</span>
                          <input value={slide.title} maxLength={52} disabled={phase === 'rendering'} onChange={(event) => updateSlide(index, { title: event.target.value })} className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-space-200 outline-none" />
                          <span className="text-[10px] text-space-600">{slide.type}</span>
                        </div>
                        <textarea value={slide.takeaway} maxLength={140} rows={2} disabled={phase === 'rendering'} onChange={(event) => updateSlide(index, { takeaway: event.target.value })} className="mt-3 w-full resize-none rounded-lg border border-space-700/70 bg-space-900/70 px-3 py-2 text-xs leading-5 text-space-400 outline-none focus:border-violet-500/35" />
                        <textarea value={slide.bullets.join('\n')} rows={Math.max(2, slide.bullets.length)} disabled={phase === 'rendering'} onChange={(event) => updateSlide(index, { bullets: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 5) })} className="mt-2 w-full resize-y rounded-lg border border-space-700/70 bg-space-900/70 px-3 py-2 text-xs leading-5 text-space-500 outline-none focus:border-violet-500/35" />
                      </article>
                    ))}
                  </div>
                  {phase === 'rendering' && (
                    <div className="mt-5 flex items-center gap-3 rounded-xl border border-violet-500/25 bg-violet-500/[0.07] p-4 text-xs text-space-400">
                      <LoaderCircle size={17} className="animate-spin text-violet-500" />
                      正在生成可编辑 PPTX，并逐页渲染检查版面…
                    </div>
                  )}
                </div>
              )}

              {phase === 'complete' && result && (
                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.1] text-emerald-600"><Check size={26} /></span>
                  <h3 className="mt-4 text-lg font-semibold text-space-100">PPTX 已生成并开始下载</h3>
                  <p className="mt-2 text-sm text-space-500">{result.filename} · {result.slideCount} 页</p>
                  <button type="button" onClick={() => downloadPpt(result)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"><Download size={16} />再次下载</button>
                </div>
              )}

              {error && <div className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-3 text-xs leading-6 text-amber-700">{error}</div>}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-space-700/80 bg-space-950/40 px-5 py-4">
              <div className="text-[10px] text-space-500">回答与页面数据会发送到平台服务端，不写入 PPT 运行时配置。</div>
              <div className="flex shrink-0 gap-2">
                {phase === 'configure' && <button type="button" onClick={generateOutline} disabled={!preferences.audience.trim()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"><Sparkles size={15} />生成大纲</button>}
                {phase === 'outline' && <>
                  <button type="button" onClick={() => setPhase('configure')} className="rounded-xl border border-space-700 px-3.5 py-2.5 text-sm text-space-400 transition hover:bg-space-800">返回设置</button>
                  <button type="button" onClick={createDeck} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"><FileSliders size={15} />生成 PPTX</button>
                </>}
                {phase === 'complete' && <button type="button" onClick={closePptExport} className="rounded-xl bg-space-200 px-4 py-2.5 text-sm font-semibold text-space-900">完成</button>}
              </div>
            </footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
