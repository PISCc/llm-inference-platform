import { cn } from '../utils/cn.js';
import { motion } from 'framer-motion';

const accentMap = {
  cyan: 'hover:border-cyan-400/40 hover:shadow-[0_0_24px_rgba(34,211,238,0.12)] focus:border-cyan-400/50',
  violet: 'hover:border-violet-400/40 hover:shadow-[0_0_24px_rgba(167,139,250,0.12)] focus:border-violet-400/50',
  emerald: 'hover:border-emerald-400/40 hover:shadow-[0_0_24px_rgba(52,211,153,0.12)] focus:border-emerald-400/50',
  amber: 'hover:border-amber-400/40 hover:shadow-[0_0_24px_rgba(251,191,36,0.12)] focus:border-amber-400/50',
};

export default function GlowCard({
  children,
  className,
  accent = 'cyan',
  as = 'div',
  interactive = false,
  ...props
}) {
  const Comp = interactive ? motion.button : motion[as];
  return (
    <Comp
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.99 } : undefined}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-space-700/60 bg-space-900/70 backdrop-blur-md transition-all duration-300',
        accentMap[accent] || accentMap.cyan,
        interactive && 'cursor-pointer text-left',
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
      <div className="relative h-full">{children}</div>
    </Comp>
  );
}

