import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, GitCommit } from 'lucide-react';
import Badge from './Badge.jsx';

function FlowSteps({ steps }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          <span className="relative overflow-hidden rounded-md border border-space-700 bg-space-800/60 px-3 py-1.5 text-xs text-space-200">
            {s}
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          </span>
          {i < steps.length - 1 && (
            <span className="relative flex h-5 w-8 items-center justify-center overflow-hidden text-cyan-500/70">
              <ArrowRight size={14} />
              <motion.span
                className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent"
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

function DetailCard({ label, children }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-space-700/60 bg-space-800/40 p-4 transition-colors hover:border-cyan-500/30">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-500/[0.03] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-400">
        <GitCommit size={12} />
        {label}
      </h4>
      <div className="relative text-sm leading-relaxed text-space-200">{children}</div>
    </div>
  );
}

export default function ModuleSidebar({ module, onClose }) {
  return (
    <AnimatePresence>
      {module && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-space-950/70 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 z-50 h-screen w-full max-w-xl overflow-y-auto border-l border-space-700/60 bg-space-950/95 p-6 shadow-2xl backdrop-blur-xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-space-700 bg-space-800 text-space-300 transition-colors hover:border-rose-500/50 hover:text-rose-400"
            >
              <X size={16} />
            </button>

            <div className="pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="cyan">{module.categoryLabel || module.category}</Badge>
                <Badge variant="slate">{module.categoryLabel || module.category}</Badge>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-gradient-cyan">{module.title}</h2>
              <p className="mt-2 text-sm text-space-400">{module.summary}</p>

              <div className="mt-6 grid gap-3">
                <DetailCard label="一句话定义">
                  <p>{module.definition}</p>
                </DetailCard>

                <DetailCard label="解决什么问题">
                  <p>{module.problem}</p>
                </DetailCard>

                {module.steps && module.steps.length > 0 && (
                  <DetailCard label="工作原理">
                    <FlowSteps steps={module.steps} />
                  </DetailCard>
                )}

                {module.impact && module.impact.length > 0 && (
                  <DetailCard label="性能影响">
                    <div className="flex flex-wrap gap-2">
                      {module.impact.map((imp, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-space-700 bg-space-900/60 px-2.5 py-1 text-xs font-medium text-space-200"
                        >
                          {imp}
                        </span>
                      ))}
                    </div>
                  </DetailCard>
                )}

                {module.related && module.related.length > 0 && (
                  <DetailCard label="关联模块">
                    <div className="flex flex-wrap gap-2">
                      {module.related.map((r, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/20"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </DetailCard>
                )}
              </div>

              <div className="mt-8 rounded-xl border border-space-700/50 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-space-400">模块信息</h4>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

