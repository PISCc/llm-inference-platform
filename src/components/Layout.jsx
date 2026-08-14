import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cpu, Network, FlaskConical, Scale, Search, Bot, Home } from 'lucide-react';
import { cn } from '../utils/cn.js';
import TechBackground from './TechBackground.jsx';

const NAV = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/panorama', label: '全景图', icon: Network },
  { to: '/pipeline', label: '流水线', icon: Cpu },
  { to: '/lab', label: '实验室', icon: FlaskConical },
  { to: '/compare', label: '对比台', icon: Scale },
  { to: '/detective', label: '侦探', icon: Search },
  { to: '/agent', label: 'AI 讲解', icon: Bot },
];

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="relative flex min-h-screen flex-col bg-space-950 bg-grid">
      <TechBackground />
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.06),transparent_55%)]" />
      <header className="sticky top-0 z-30 border-b border-space-700/50 bg-space-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-shadow animate-glow">
              <Cpu size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight text-gradient">
              LLM 推理实验室
            </span>
          </NavLink>
          <nav className="hidden flex-wrap gap-1 text-sm md:flex">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all overflow-hidden',
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.15)]'
                        : 'text-space-400 hover:bg-space-800/60 hover:text-space-200'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="nav-glow"
                          className="absolute inset-0 rounded-lg border border-cyan-400/30"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                      <Icon size={14} className="relative z-10" />
                      <span className="relative z-10">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div key={pathname}>
          <Outlet />
        </div>
      </main>
      <footer className="relative z-10 border-t border-space-700/50 py-6 text-center text-xs text-space-500">
        大模型推理互动展示平台 · React + Vite
      </footer>
    </div>
  );
}
