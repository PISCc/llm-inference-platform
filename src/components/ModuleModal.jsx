import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, GitCommit, Hash, Folder, Sparkles, Lightbulb, ShieldCheck, Link2 } from 'lucide-react';
import Badge from './Badge.jsx';
import ModuleIcon from './ModuleIcon.jsx';

function FlowSteps({ steps, accent }) {
  const viaColor = accent === 'violet' ? 'via-violet-400/60' : accent === 'emerald' ? 'via-emerald-400/60' : 'via-cyan-400/60';
  if (!steps || steps.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span className="relative overflow-hidden whitespace-nowrap rounded-md border border-space-700 bg-space-800/60 px-3 py-1.5 text-xs text-space-200">
            {s}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </span>
          {i < steps.length - 1 && (
            <span className="relative flex h-5 w-6 items-center justify-center overflow-hidden text-space-600">
              <ArrowRight size={14} />
              <motion.span
                className={cn('absolute inset-0 bg-gradient-to-r from-transparent to-transparent', viaColor)}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              />
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function DetailCard({ label, icon: Icon, children, accent }) {
  const color = accent === 'violet' ? 'text-violet-400' : accent === 'emerald' ? 'text-emerald-400' : 'text-cyan-400';
  return (
    <div className="group relative overflow-hidden rounded-xl border border-space-700/50 bg-space-800/30 p-4 transition-colors hover:border-space-600/60">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <h4 className={cn('mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider', color)}>
        <Icon size={12} />
        {label}
      </h4>
      <div className="relative text-sm leading-relaxed text-space-200">{children}</div>
    </div>
  );
}

function PlainCard({ children, accent }) {
  const bg = accent === 'violet' ? 'bg-violet-500/8 border-violet-500/25' : accent === 'emerald' ? 'bg-emerald-500/8 border-emerald-500/25' : 'bg-cyan-500/8 border-cyan-500/25';
  const text = accent === 'violet' ? 'text-violet-300' : accent === 'emerald' ? 'text-emerald-300' : 'text-cyan-300';
  return (
    <div className={cn('relative overflow-hidden rounded-xl border p-4', bg)}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
      <div className="relative">
        <div className={cn('mb-2 flex items-center gap-2 text-xs font-semibold', text)}>
          <Lightbulb size={14} />
          一句话解释
        </div>
        <div className="text-sm leading-relaxed text-space-100 whitespace-pre-line">{children}</div>
      </div>
    </div>
  );
}

function ImpactBadge({ text }) {
  if (text.includes('↑')) return <span className="rounded-md border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-1 text-xs font-medium text-emerald-300">{text}</span>;
  if (text.includes('↓')) return <span className="rounded-md border border-rose-500/25 bg-rose-500/8 px-2.5 py-1 text-xs font-medium text-rose-300">{text}</span>;
  return <span className="rounded-md border border-space-700 bg-space-900/60 px-2.5 py-1 text-xs font-medium text-space-200">{text}</span>;
}

export default function ModuleModal({ module, accent = 'cyan', onClose }) {
  useEffect(() => {
    if (!module) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [module, onClose]);

  const color = accent === 'violet' ? 'text-violet-400' : accent === 'emerald' ? 'text-emerald-400' : 'text-cyan-400';
  const border = accent === 'violet' ? 'border-violet-500/30' : accent === 'emerald' ? 'border-emerald-500/30' : 'border-cyan-500/30';
  const bg = accent === 'violet' ? 'bg-violet-500/10' : accent === 'emerald' ? 'bg-emerald-500/10' : 'bg-cyan-500/10';

  return (
    <AnimatePresence>
      {module && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-space-950/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={cn(
              'relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border bg-space-950/95 p-6 shadow-2xl backdrop-blur-xl md:p-8',
              border
            )}
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-space-700 bg-space-800 text-space-300 transition-colors hover:border-rose-500/50 hover:text-rose-400"
            >
              <X size={16} />
            </button>

            <div className="pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={accent === 'violet' ? 'violet' : accent === 'emerald' ? 'emerald' : 'cyan'}>
                  {module.categoryLabel || module.category}
                </Badge>
              </div>

              <div className="mt-4 flex items-start gap-3">
                <ModuleIcon id={module.id} className={cn(color, 'border-current/20')} />
                <div>
                  <h2 className={cn('text-2xl font-bold md:text-3xl', color)}>
                    {module.englishTitle || module.title}
                  </h2>
                  <div className="mt-0.5 text-sm text-space-400">{module.title}</div>
                </div>
              </div>

              {module.plainExplanation && (
                <div className="mt-5">
                  <PlainCard accent={accent}>
                    {module.plainExplanation}
                  </PlainCard>
                </div>
              )}

              <div className="mt-5 grid gap-3">
                <DetailCard label="定义" icon={Sparkles} accent={accent}>
                  <p>{module.definition}</p>
                </DetailCard>

                <DetailCard label="解决什么问题" icon={GitCommit} accent={accent}>
                  <p>{module.problem}</p>
                </DetailCard>

                {module.steps && module.steps.length > 0 && (
                  <DetailCard label="工作原理" icon={ArrowRight} accent={accent}>
                    <FlowSteps steps={module.steps} accent={accent} />
                  </DetailCard>
                )}

                {module.impact && module.impact.length > 0 && (
                  <DetailCard label="性能影响" icon={Hash} accent={accent}>
                    <div className="flex flex-wrap gap-2">
                      {module.impact.map((imp, i) => (
                        <ImpactBadge key={i} text={imp} />
                      ))}
                    </div>
                  </DetailCard>
                )}

                {module.related && module.related.length > 0 && (
                  <DetailCard label="关联模块" icon={Folder} accent={accent}>
                    <div className="flex flex-wrap gap-2">
                      {module.related.map((r, i) => (
                        <span
                          key={i}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs transition-colors',
                            border,
                            bg,
                            color
                          )}
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </DetailCard>
                )}
              </div>

              <div className="mt-6 rounded-xl border border-space-700/50 bg-gradient-to-br from-space-900/60 to-space-900/30 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-space-500">溯源与边界</h4>
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-space-500">编号</span>
                    <div className="mt-0.5 font-mono text-space-300">{module.id}</div>
                  </div>
                  <div>
                    <span className="text-space-500">分类</span>
                    <div className="mt-0.5 text-space-300">{module.categoryLabel || module.category}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="flex items-center gap-1 text-space-500"><Link2 size={11} />项目条目来源</span>
                    <div className="mt-0.5 break-all font-mono text-[10px] text-space-400">{module.source || '项目知识库内部整理'}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] leading-relaxed text-amber-200"><ShieldCheck size={14} className="mt-0.5 shrink-0" />条目由项目知识库整理；容量与结构关系按公开定义或公式表述。性能、延迟、吞吐及硬件规格必须结合具体版本与实测条件判断。</div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

