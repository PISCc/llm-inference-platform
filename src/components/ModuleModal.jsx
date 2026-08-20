import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, GitCommit, Hash, Folder, Sparkles, Lightbulb } from 'lucide-react';
import Badge from './Badge.jsx';
import ModuleIcon from './ModuleIcon.jsx';

function FlowArrow({ accent }) {
  const uid = useId().replace(/:/g, '');
  const clipId = `flow-arrow-clip-${uid}`;
  const beamId = `flow-arrow-beam-${uid}`;
  const palette = accent === 'violet'
    ? { base: '#7a5f8d', beam: '#d3c2d5' }
    : accent === 'emerald'
      ? { base: '#5c7f65', beam: '#bfd2c3' }
      : { base: '#46728a', beam: '#b5cbd6' };
  const arrowPath = 'M2 8.25H18V3.5L30 11L18 18.5V13.75H2Z';

  return (
    <span className="relative flex h-7 w-10 shrink-0 items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 32 22" className="h-6 w-9" focusable="false">
        <defs>
          <clipPath id={clipId}>
            <path d={arrowPath} />
          </clipPath>
          <linearGradient id={beamId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={palette.beam} stopOpacity="0" />
            <stop offset="48%" stopColor={palette.beam} stopOpacity="0.95" />
            <stop offset="100%" stopColor={palette.beam} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={arrowPath}
          fill={palette.base}
          fillOpacity="0.2"
          stroke={palette.base}
          strokeOpacity="0.72"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <g clipPath={`url(#${clipId})`}>
          <motion.rect
            x="-16"
            y="0"
            width="15"
            height="22"
            fill={`url(#${beamId})`}
            initial={{ x: -16 }}
            animate={{ x: 48 }}
            transition={{ repeat: Infinity, duration: 1.35, ease: 'linear', repeatDelay: 0.15 }}
          />
        </g>
      </svg>
    </span>
  );
}

function FlowSteps({ steps, accent }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span className="relative overflow-hidden whitespace-nowrap rounded-md border border-space-700 bg-space-800/60 px-3 py-1.5 text-xs text-space-200">
            {s}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </span>
          {i < steps.length - 1 && <FlowArrow accent={accent} />}
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

export default function ModuleModal({ module, accent = 'cyan', onClose, resolveRelated, onSelectRelated }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousActiveRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const isOpen = Boolean(module);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!module) return;
    previousActiveRef.current = document.activeElement;
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previousActiveRef.current?.focus?.();
      previousActiveRef.current = null;
    };
  }, [isOpen]);

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
            aria-hidden="true"
            className="absolute inset-0 bg-space-950/80 backdrop-blur-sm"
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
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
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="关闭模块详情"
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-space-700 bg-space-800 text-space-300 transition-colors hover:border-rose-500/50 hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
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
                  <h2 id={titleId} className={cn('text-2xl font-bold md:text-3xl', color)}>
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
                      {module.related.map((relatedLabel, i) => {
                        const relatedModule = resolveRelated?.(relatedLabel);
                        const relatedClassName = cn(
                          'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors',
                          border,
                          bg,
                          color
                        );
                        return relatedModule ? (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onSelectRelated?.(relatedModule)}
                            className={cn(relatedClassName, 'hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50')}
                            aria-label={`打开关联模块：${relatedLabel}`}
                          >
                            {relatedLabel}<ArrowRight size={11} />
                          </button>
                        ) : <span key={i} className={relatedClassName}>{relatedLabel}</span>;
                      })}
                    </div>
                  </DetailCard>
                )}
              </div>

              <div className="mt-6 rounded-xl border border-space-700/50 bg-gradient-to-br from-space-900/60 to-space-900/30 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-space-500">条目信息</h4>
                <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-space-500">编号</span>
                    <div className="mt-0.5 font-mono text-space-300">{module.id}</div>
                  </div>
                  <div>
                    <span className="text-space-500">分类</span>
                    <div className="mt-0.5 text-space-300">{module.categoryLabel || module.category}</div>
                  </div>
                </div>
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
