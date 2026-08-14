import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Cpu, Network, FlaskConical, Scale, Search, Bot,
  ArrowRight, Zap, Eye, MessageCircle, BarChart3, Layers
} from 'lucide-react';
import GlowCard from '../components/GlowCard.jsx';
import Badge from '../components/Badge.jsx';
import { cn } from '../utils/cn.js';

const MODULES = [
  {
    to: '/panorama',
    title: '互动全景图',
    desc: '60 个核心模块，三栏总览推理架构、模型结构与硬件系统',
    icon: Network,
    accent: 'cyan',
    tags: ['60 模块', '可点击'],
  },
  {
    to: '/pipeline',
    title: '推理流水线模拟器',
    desc: '输入一句话，观看 Prefill → KV Cache → Decode 的完整推理动画',
    icon: Cpu,
    accent: 'violet',
    tags: ['核心亮点', '动画'],
  },
  {
    to: '/lab',
    title: '参数实验室',
    desc: '拖动参数，实时复算 KV Cache、权重容量与 Attention 缓存结构',
    icon: FlaskConical,
    accent: 'emerald',
    tags: ['可交互', '图表'],
  },
  {
    to: '/compare',
    title: '方案对比台',
    desc: 'MHA / GQA / MLA、Dense / MoE、量化精度并排对比',
    icon: Scale,
    accent: 'amber',
    tags: ['3 组对比'],
  },
  {
    to: '/detective',
    title: '推理侦探',
    desc: '从症状出发，点击定位推理链路瓶颈，获得因果链解释',
    icon: Search,
    accent: 'cyan',
    tags: ['诊断'],
  },
  {
    to: '/agent',
    title: 'AI 讲解智能体',
    desc: '向 AI 提问，基于知识库获得通俗解释并跳转到对应模块',
    icon: Bot,
    accent: 'violet',
    tags: ['RAG'],
  },
];

const HIGHLIGHTS = [
  { icon: Eye, label: '看得见', desc: '把抽象推理过程变成可点击、可动画的交互' },
  { icon: Zap, label: '可尝试', desc: '拖动参数、切换方案，即时看到效果' },
  { icon: MessageCircle, label: '可提问', desc: '用自然语言提问，AI 用知识库回答' },
  { icon: BarChart3, label: '可对比', desc: '同目标多方案并排，看清技术取舍' },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  return (
    <div className="space-y-16 pb-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-space-700/50 bg-gradient-to-br from-space-900/90 via-space-950 to-space-900/80 p-8 md:p-14">
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl animate-pulse-slow" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl animate-pulse-slow" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />

        <div className="relative mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="cyan" className="mb-4">大模型推理可视化平台</Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-space-50 md:text-6xl">
              看得见的大模型
              <span className="text-gradient"> 推理</span>
            </h1>
           <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-space-400 md:text-lg">
             系统化呈现大模型推理全链路：
             <span className="text-space-200">架构调度、模型结构、生成流程、缓存优化、并行策略与硬件选型</span>，
             通过全景图、流水线模拟、参数实验、方案对比与智能问答，把抽象技术变成可交互、可探索的知识平台。
           </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/panorama"
                className="group inline-flex items-center gap-2 rounded-lg bg-cyan-500/15 px-5 py-2.5 text-sm font-medium text-cyan-300 ring-1 ring-cyan-500/30 transition-all hover:bg-cyan-500/25 hover:shadow-[0_0_24px_rgba(34,211,238,0.25)]"
              >
                进入全景图
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/pipeline"
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-space-300 ring-1 ring-space-700/60 transition-all hover:bg-space-800/60 hover:text-space-100"
              >
                观看推理动画
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-10 grid grid-cols-3 gap-4 border-t border-space-700/50 pt-8"
          >
            {[
             { value: '60+', label: '知识模块' },
             { value: '6', label: '互动模块' },
              { value: '∞', label: '探索路径' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-space-100 md:text-3xl">{s.value}</div>
                <div className="mt-1 text-xs text-space-500">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Modules */}
      <section>
        <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-space-100">六大互动模块</h2>
          <p className="mt-1 text-sm text-space-400">六大模块覆盖推理系统核心环节</p>
        </div>
        </div>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <motion.div key={m.to} variants={item}>
                <Link to={m.to} className="block h-full">
                  <GlowCard accent={m.accent} interactive className="h-full p-5">
                    <div className="flex items-start justify-between">
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', iconBg(m.accent))}>
                        <Icon size={20} className={iconColor(m.accent)} />
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {m.tags.map((t) => (
                          <Badge key={t} variant="slate">{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-space-100">{m.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-space-400">{m.desc}</p>
                  </GlowCard>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Highlights */}
      <section className="relative overflow-hidden rounded-2xl border border-space-700/50 bg-space-900/40 p-6 md:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/5 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <Layers size={20} className="text-cyan-400" />
          <h2 className="text-xl font-bold text-space-100">平台特色</h2>
        </div>
        <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => {
            const Icon = h.icon;
            return (
              <motion.div
                key={h.label}
                whileHover={{ y: -3 }}
                className="rounded-xl border border-space-700/40 bg-space-900/60 p-4 transition-shadow hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]"
              >
                <Icon size={20} className="text-cyan-400" />
                <div className="mt-3 font-semibold text-space-200">{h.label}</div>
                <div className="mt-1 text-xs leading-relaxed text-space-500">{h.desc}</div>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function iconBg(accent) {
  const map = {
    cyan: 'bg-cyan-500/10 text-cyan-400',
    violet: 'bg-violet-500/10 text-violet-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };
  return map[accent];
}

function iconColor(accent) {
  const map = {
    cyan: 'text-cyan-400',
    violet: 'text-violet-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
  };
  return map[accent];
}
