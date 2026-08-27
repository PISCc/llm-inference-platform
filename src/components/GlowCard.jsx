import { cn } from '../utils/cn.js';
import { motion } from 'framer-motion';

const accentMap = {
  cyan: 'hover:border-cyan-400/50 focus:border-cyan-400/60',
  violet: 'hover:border-violet-400/50 focus:border-violet-400/60',
  emerald: 'hover:border-emerald-400/50 focus:border-emerald-400/60',
  amber: 'hover:border-amber-400/50 focus:border-amber-400/60',
};

export default function GlowCard({ children, className, accent = 'cyan', as = 'div', interactive = false, ...props }) {
  const Comp = interactive ? motion.button : motion[as];
  return <Comp whileHover={interactive ? { y: -1 } : undefined} whileTap={interactive ? { scale: 0.995 } : undefined} className={cn('workbench-panel group relative overflow-hidden rounded-xl border border-space-700/70 bg-space-900/90 transition-all duration-200', accentMap[accent] || accentMap.cyan, interactive && 'cursor-pointer text-left', className)} {...props}><div className="relative h-full">{children}</div></Comp>;
}
