import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Cpu, Network, FlaskConical, Scale, ScanSearch, Bot, Home } from 'lucide-react';
import { cn } from '../utils/cn.js';
import TechBackground from './TechBackground.jsx';

const PAGE_META = {
  '/': { title: '首页 · LLM 推理实验室', description: '系统化呈现大模型推理架构、模型结构、缓存、性能和硬件部署。' },
  '/panorama': { title: '推理技术全景图 · LLM 推理实验室', description: '检索并查看大模型推理架构、模型结构与硬件系统的核心技术模块。' },
  '/pipeline': { title: '推理流水线模拟器 · LLM 推理实验室', description: '逐步观察分词、Prefill、KV Cache 与 Decode 的推理数据流。' },
  '/lab': { title: '参数实验室 · LLM 推理实验室', description: '调整模型与部署参数，复算 KV Cache、权重容量和注意力结构。' },
  '/compare': { title: '技术方案对比台 · LLM 推理实验室', description: '比较调度、注意力架构、MoE 与量化方案的机制和适用边界。' },
  '/diagnosis': { title: '推理链路诊断台 · LLM 推理实验室', description: '根据 TTFT、TPOT、OOM 和吞吐现象形成证据驱动的诊断路径。' },
  '/agent': { title: '技术问答 · LLM 推理实验室', description: '基于本地知识库检索大模型推理技术概念并联动相关模块。' },
};

const NAV = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/panorama', label: '全景图', icon: Network },
  { to: '/pipeline', label: '流水线', icon: Cpu },
  { to: '/lab', label: '实验室', icon: FlaskConical },
  { to: '/compare', label: '对比台', icon: Scale },
  { to: '/diagnosis', label: '诊断台', icon: ScanSearch },
  { to: '/agent', label: 'AI 问答', icon: Bot },
];

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    const meta = PAGE_META[pathname] || PAGE_META['/'];
    document.title = meta.title;
    let description = document.querySelector('meta[name="description"]');
    if (!description) {
      description = document.createElement('meta');
      description.setAttribute('name', 'description');
      document.head.appendChild(description);
    }
    description.setAttribute('content', meta.description);
  }, [pathname]);

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
