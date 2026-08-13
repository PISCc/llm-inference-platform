import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlowCard from './GlowCard.jsx';
import Badge from './Badge.jsx';

export default function ComingSoon({ title, desc, highlights, todo, icon: IconComp }) {
  const Icon = IconComp || Sparkles;
  return (
    <div className="mx-auto max-w-3xl py-10">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-space-500 transition-colors hover:text-space-300"
      >
        <ArrowLeft size={14} /> 返回首页
      </Link>

      <div className="text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.15)]"
        >
          <Icon size={28} />
        </motion.div>
        <h1 className="mt-5 text-3xl font-bold text-space-100">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-space-400">{desc}</p>
        <Badge variant="slate" className="mt-4">即将上线</Badge>
      </div>

      {highlights && (
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {highlights.map((h, i) => (
            <GlowCard key={i} accent={h.accent || 'cyan'} className="p-4">
              <div className="flex items-center gap-2">
                {h.icon && <h.icon size={16} className="text-space-400" />}
                <h3 className="font-semibold text-space-200">{h.title}</h3>
              </div>
              <p className="mt-1 text-xs text-space-500">{h.desc}</p>
            </GlowCard>
          ))}
        </div>
      )}

      {todo && (
        <div className="mt-8 rounded-xl border border-space-700/50 bg-space-900/40 p-5">
          <h3 className="text-sm font-semibold text-space-300">本模块待实现</h3>
          <ul className="mt-3 space-y-2">
            {todo.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-space-500">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500/60" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
