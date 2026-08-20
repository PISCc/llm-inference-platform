import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Cpu, Network, FlaskConical, Scale, ScanSearch, Bot, Home, Command } from 'lucide-react';
import { cn } from '../utils/cn.js';
import GlobalAssistant from './GlobalAssistant.jsx';
import PptExportDialog from './PptExportDialog.jsx';
import ModelConfigDialog from './ModelConfigDialog.jsx';

const PAGE_META = {
  '/': { title: '首页 · LLM 推理工作台', description: '系统化呈现大模型推理架构、模型结构、缓存、方案与链路诊断。' },
  '/panorama': { title: '推理技术全景图 · LLM 推理工作台', description: '检索并查看大模型推理架构、模型结构与硬件系统的核心技术模块。' },
  '/pipeline': { title: '推理流水线 · LLM 推理工作台', description: '逐步观察分词、Prefill、KV Cache 与 Decode 的推理数据流。' },
  '/lab': { title: '参数实验室 · LLM 推理工作台', description: '调整模型与部署参数，复算 KV Cache、权重容量和注意力结构。' },
  '/compare': { title: '技术方案对比 · LLM 推理工作台', description: '比较调度与组批、Dense / MoE 和权重量化方案。' },
  '/diagnosis': { title: '推理链路诊断 · LLM 推理工作台', description: '从 TTFT、TPOT、OOM 和吞吐现象定位问题。' },
  '/agent': { title: '上下文 AI 助手 · LLM 推理工作台', description: '结合当前页面回答大模型推理技术问题。' },
};

const NAV = [
  { to: '/', label: '首页', icon: Home, end: true },
  { to: '/panorama', label: '全景图', icon: Network },
  { to: '/pipeline', label: '推理流程', icon: Cpu },
  { to: '/lab', label: '参数实验室', icon: FlaskConical },
  { to: '/compare', label: '方案对比', icon: Scale },
  { to: '/diagnosis', label: '链路诊断', icon: ScanSearch },
  { to: '/agent', label: 'AI 助手', icon: Bot },
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
    <div className="workbench-app relative flex min-h-screen flex-col">
      <div className="workbench-backdrop" aria-hidden="true" />
      <header className="workbench-header sticky top-0 z-30">
        <div className="workbench-header__inner">
          <NavLink to="/" className="workbench-brand" aria-label="返回首页">
            <span className="workbench-brand__mark" aria-hidden="true"><Cpu size={15} strokeWidth={2.4} /></span>
            <span className="workbench-brand__name">LLM 推理工作台</span>
            <span className="workbench-brand__version">TECH / 01</span>
          </NavLink>
          <nav className="workbench-nav" aria-label="主导航">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn('workbench-nav__item', isActive && 'is-active')}>
                  <Icon size={14} strokeWidth={2} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
          <div className="workbench-header__tools">
            <span className="workbench-live"><i />本地可用</span>
            <NavLink to="/agent" className="workbench-command" title="打开 AI 助手"><Command size={14} /><span>问助手</span></NavLink>
          </div>
        </div>
      </header>
      <main className="workbench-main relative z-10 mx-auto w-full max-w-[1440px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div key={pathname} className="workbench-route"><Outlet /></div>
      </main>
      <footer className="workbench-footer relative z-10"><span>LLM 推理工作台</span><span>全景 · 实验 · 诊断</span><span>LOCAL / OFFLINE READY</span></footer>
      <GlobalAssistant />
      <PptExportDialog />
      <ModelConfigDialog />
    </div>
  );
}
