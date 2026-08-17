import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Boxes, Binary, ArrowRight, ArrowUpRight, CheckCircle2,
  AlertTriangle, Database, Gauge, Layers3, Network, Route, Rows3, Workflow
} from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import { ARCHITECTURES, PRECISIONS, SliderControl, calcKVCache, getArchitectureKVHeads } from '../modules/lab/common.jsx';

const TABS = [
  { id: 'attention', label: 'Attention 架构', icon: Network, accent: 'violet' },
  { id: 'scheduling', label: '调度与组批', icon: Layers3, accent: 'cyan' },
  { id: 'moe', label: 'Dense 与 MoE', icon: Boxes, accent: 'violet' },
  { id: 'quant', label: '权重量化', icon: Binary, accent: 'amber' },
];

const SCHEDULING_STRATEGIES = [
  {
    id: 'static',
    name: '静态批处理',
    english: 'Static Batching',
    color: 'cyan',
    summary: '先组成固定批次，再按统一轮次完成整批请求。',
    workflow: ['收集请求', '组成固定批', '整批执行', '批次结束'],
    advantage: '实现简单、批次边界清晰，便于控制离线任务的输入规模。',
    limitation: '需要等待成批；批内长请求会延长其他请求的完成时间。',
    fit: '离线批量任务、请求长度接近、端到端延迟要求宽松。',
    admission: '批次开始后不再加入新请求。',
    prefill: '长 Prefill 会占用整批执行窗口。',
    panoramaId: 'scheduler',
  },
  {
    id: 'continuous',
    name: 'Continuous Batching',
    english: 'Iteration-Level Scheduling',
    color: 'violet',
    summary: '在迭代边界动态重组批次，已完成请求及时退出。',
    workflow: ['请求入队', '按迭代重组', '执行一个迭代', '完成即退出'],
    advantage: '请求可动态进入和退出批次，减少已完成槽位继续空转。',
    limitation: '队列、公平性、抢占与 KV Cache 管理更复杂，依赖成熟运行时。',
    fit: '在线服务、请求长度差异较大、需要持续处理动态流量。',
    admission: '在迭代边界加入或移除请求。',
    prefill: 'Prefill 与 Decode 按迭代粒度共同参与调度。',
    panoramaId: 'cb',
  },
  {
    id: 'chunked',
    name: 'Chunked Prefill',
    english: 'Prefill Budgeting',
    color: 'amber',
    summary: '将长 Prefill 划分为多个块，与 Decode 交错执行。',
    workflow: ['拆分长 Prefill', '分配本轮预算', '交错执行', '继续下一块'],
    advantage: '限制长 Prefill 的单轮占用，使 Decode 请求更容易获得执行机会。',
    limitation: '分块大小和预算需要调参；分块过细会增加调度与切换开销。',
    fit: '长上下文与 Decode 混合流量、需要控制迭代延迟或尾延迟。',
    admission: '可在分块边界插入新请求。',
    prefill: '限制单轮 Prefill Token 数，降低对 Decode 的连续占用。',
    panoramaId: 'chunked',
  },
];

const MODEL_ORGANIZATION_DETAILS = [
  {
    id: 'dense',
    name: 'Dense',
    color: 'cyan',
    title: '固定激活全部参数',
    advantage: '计算路径固定，不需要 Token 路由与专家间 All-to-All，执行与部署边界更直接。',
    limitation: '每个 Token 都激活全部参数；模型扩大时，计算量与权重容量同步增加。',
    fit: '模型规模可控、硬件拓扑较简单，优先稳定性、兼容性与可预测执行路径。',
    validation: '核对模型是否能在目标显存与并行配置下容纳，并实测目标批次和序列长度。',
    panoramaId: 'dense',
  },
  {
    id: 'moe',
    name: 'MoE',
    color: 'violet',
    title: '按路由稀疏激活专家',
    advantage: '总参数可以大于单 Token 激活参数，在扩大专家容量时保留稀疏激活路径。',
    limitation: '引入 Router、负载均衡、专家放置和跨设备通信，热点专家可能成为瓶颈。',
    fit: '模型本身采用 MoE，且部署环境具备专家并行、通信优化和负载监控能力。',
    validation: '核对专家负载分布、All-to-All 占比、跨卡拓扑以及目标流量下的尾延迟。',
    panoramaId: 'moe',
  },
];

const MODEL_EXAMPLES = {
  dense: [
    {
      name: 'Llama 3.1 70B',
      scale: '70B 总参数 · 全量激活',
      tag: '通用大模型',
      reason: '每个 Token 经过同一组完整参数，计算路径固定，便于使用成熟的张量并行与推理框架获得稳定表现。',
      tradeoff: '部署逻辑相对直接，但每个 Token 都承担完整的 70B 参数计算与权重访问成本。',
    },
    {
      name: 'Qwen3-8B',
      scale: '约 8B 总参数 · 全量激活',
      tag: '本地与单机',
      reason: '中小规模 Dense 模型不需要专家路由，适合本地设备、单机服务和强调兼容性的部署环境。',
      tradeoff: '推理路径简单、延迟更容易预测，但模型容量与单 Token 计算量会同步增长。',
    },
    {
      name: 'Qwen3-32B',
      scale: '约 32B 总参数 · 全量激活',
      tag: '稳定多卡部署',
      reason: '以完整参数参与每次前向，避免专家负载不均和 All-to-All 通信，适合优先保证稳定执行路径的多卡部署。',
      tradeoff: '能力容量直接对应计算开销，对显存、带宽和并行切分要求更高。',
    },
  ],
  moe: [
    {
      name: 'Qwen3-30B-A3B',
      scale: '约 30B 总参数 · 约 3B 激活',
      tag: '低激活计算',
      reason: '通过稀疏激活扩大总参数容量，同时把单 Token 激活参数控制在约 3B，适合追求容量与计算效率平衡的场景。',
      tradeoff: '需要 Router、专家放置和负载均衡支持，实际速度仍取决于推理引擎与硬件拓扑。',
    },
    {
      name: 'DeepSeek-V3',
      scale: '671B 总参数 · 37B 激活',
      tag: '超大规模容量',
      reason: '以较小的单 Token 激活参数承载超大总参数容量，使模型规模扩展不必等比例增加每次前向计算量。',
      tradeoff: '对专家并行、跨卡通信、路由均衡和高并发运行时提出更高要求。',
    },
    {
      name: 'Mixtral 8×7B',
      scale: '8 个专家 · 每 Token 选择 2 个',
      tag: '经典稀疏专家',
      reason: '每个 Token 只进入部分专家，以接近较小 Dense 模型的活跃计算获得更大的专家参数容量。',
      tradeoff: '总权重仍需加载到设备，低并发或通信受限时不一定比同级 Dense 模型更快。',
    },
  ],
};
const PRECISION_DETAILS = {
  fp16: {
    color: 'cyan',
    bits: 16,
    name: 'FP16',
    storage: '2 字节/参数',
    advantage: '算子与框架支持通常更完整，适合作为容量、精度和性能验证基线。',
    limitation: '纯权重容量最高，对显存余量和跨卡分片的要求更高。',
    fit: '显存充足、优先兼容性与基线复现，或量化收益尚未完成验证。',
    requirement: '通常可直接承载半精度权重，仍需匹配硬件和推理引擎。',
    risk: '作为容量基线；不代表模型的训练原始精度。',
  },
  int8: {
    color: 'violet',
    bits: 8,
    name: 'INT8',
    storage: '1 字节/参数',
    advantage: '纯权重理论容量为 FP16 的一半，容量压缩与实现复杂度相对均衡。',
    limitation: '需要量化尺度和适配计算核；精度与速度收益依赖具体量化方案和硬件。',
    fit: '希望降低权重容量，同时保留较充分精度验证空间的生产部署。',
    requirement: '需要量化尺度、受支持的计算核，以及与目标硬件匹配的实现。',
    risk: '精度影响必须在目标任务和量化方案下评测。',
  },
  int4: {
    color: 'amber',
    bits: 4,
    name: 'INT4',
    storage: '0.5 字节/参数',
    advantage: '纯权重理论容量为 FP16 的四分之一，更适合显存约束明显的部署。',
    limitation: '元数据、校准、算子支持和目标任务精度风险更突出。',
    fit: '显存是主要约束，并且具备目标任务评测、校准数据与量化算子支持。',
    requirement: '通常包含分组、尺度或零点等元数据，实际文件会高于纯权重下界。',
    risk: '压缩更强，精度、校准和算子支持风险也更需要单独验证。',
  },
};

const TRADEOFF_ITEMS = [
  { key: 'advantage', label: '核心优势', icon: CheckCircle2, border: 'border-emerald-500/20', bg: 'bg-emerald-500/[0.055]', text: 'text-emerald-300' },
  { key: 'limitation', label: '主要局限', icon: AlertTriangle, border: 'border-amber-500/20', bg: 'bg-amber-500/[0.055]', text: 'text-amber-300' },
  { key: 'fit', label: '适用场景', icon: Route, border: 'border-cyan-500/20', bg: 'bg-cyan-500/[0.055]', text: 'text-cyan-300' },
];

function formatGiB(value) {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function TradeoffSummary({ advantage, limitation, fit, compact = false }) {
  const content = { advantage, limitation, fit };
  return (
    <div className={`grid gap-2 ${compact ? '' : 'md:grid-cols-3'}`}>
      {TRADEOFF_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.key} className={`rounded-xl border ${item.border} ${item.bg} ${compact ? 'p-3' : 'p-4'}`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-semibold tracking-wide ${item.text}`}>
              <Icon size={compact ? 13 : 14} />{item.label}
            </div>
            <p className={`mt-2 leading-relaxed text-space-300 ${compact ? 'text-[11px]' : 'text-sm'}`}>{content[item.key]}</p>
          </div>
        );
      })}
    </div>
  );
}

function ComparisonTable({ title, description, columns, rows, accent = 'cyan', badge = '完整对照' }) {
  const iconClass = accent === 'violet' ? 'text-violet-400' : accent === 'amber' ? 'text-amber-400' : 'text-cyan-400';
  return (
    <div className="rounded-2xl border border-space-700/50 bg-space-900/45 p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-space-100"><Rows3 size={17} className={iconClass} />{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-space-500">{description}</p>
        </div>
        <Badge variant="slate">{badge}</Badge>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-space-700/45">
        <table className="w-full min-w-[760px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-space-700/45 bg-space-950/45">
              <th className="w-32 px-3 py-3 font-medium text-space-500">判断维度</th>
              {columns.map((column) => <th key={column.id} className="px-3 py-3 font-medium text-space-200">{column.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const labelClass = row.key === 'advantage' ? 'text-emerald-300' : row.key === 'limitation' ? 'text-amber-300' : row.key === 'fit' ? 'text-cyan-300' : 'text-space-500';
              return (
                <tr key={row.key} className="border-b border-space-800/70 last:border-0">
                  <th className={`px-3 py-3 align-top font-medium ${labelClass}`}>{row.label}</th>
                  {columns.map((column) => <td key={column.id} className="px-3 py-3 align-top leading-relaxed text-space-400">{column[row.key]}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <>
      <ProductHeader
        title="技术方案对比台"
        subtitle="围绕同一推理目标，直接比较不同方案的核心优势、主要局限与适用场景，并保留机制、公式和验证边界。"
        accent="amber"
        badges={[{ label: '优势 · 局限 · 适用场景', variant: 'amber' }, { label: '机制与验证边界' }]}
      />
      <div className="grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-4">
        {[
          ['4', '注意力架构'], ['3', '调度策略'], ['2', '模型组织方式'], ['3', '权重精度'],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border border-space-700/50 bg-space-950/40 px-3 py-2.5">
            <div className="font-mono text-lg font-bold text-amber-300">{value}</div>
            <div className="mt-0.5 text-space-500">{label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function SectionTabs({ activeTab, setActiveTab }) {
  return (
    <div className="flex justify-center overflow-x-auto pb-1">
      <div className="inline-flex min-w-max rounded-xl border border-space-700/60 bg-space-900/60 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          const activeColor = tab.accent === 'cyan'
            ? 'border-cyan-500/30 text-cyan-300'
            : tab.accent === 'violet'
              ? 'border-violet-500/30 text-violet-300'
              : 'border-amber-500/30 text-amber-300';
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${active ? `${activeColor} bg-space-800/85` : 'border-transparent text-space-500 hover:text-space-200'}`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StrategyFlow({ strategy }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {strategy.workflow.map((label, index) => (
        <div key={label} className="relative">
          <div className={'min-h-[76px] rounded-xl border p-3 ' + (strategy.color === 'cyan' ? 'border-cyan-500/25 bg-cyan-500/[0.06]' : strategy.color === 'violet' ? 'border-violet-500/25 bg-violet-500/[0.06]' : 'border-amber-500/25 bg-amber-500/[0.06]')}>
            <span className="font-mono text-[10px] text-space-600">STEP {String(index + 1).padStart(2, '0')}</span>
            <div className="mt-3 text-sm font-semibold text-space-200">{label}</div>
          </div>
          {index < strategy.workflow.length - 1 && <ArrowRight size={14} className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-space-600 md:block" />}
        </div>
      ))}
    </div>
  );
}

function SchedulingComparison({ navigate }) {
  const [selected, setSelected] = useState('continuous');
  const strategy = SCHEDULING_STRATEGIES.find((item) => item.id === selected) || SCHEDULING_STRATEGIES[1];

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 className="font-semibold text-space-100">先看方案权衡</h2><p className="mt-1 text-xs text-space-500">点击方案查看机制依据；优势、局限和适用场景始终作为一级信息展示。</p></div>
          <Badge variant="cyan">直接选型</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {SCHEDULING_STRATEGIES.map((item) => {
            const active = selected === item.id;
            const activeClass = item.color === 'cyan' ? 'border-cyan-400/45 bg-cyan-500/[0.09]' : item.color === 'violet' ? 'border-violet-400/45 bg-violet-500/[0.09]' : 'border-amber-400/45 bg-amber-500/[0.09]';
            return (
              <button key={item.id} type="button" aria-pressed={active} onClick={() => setSelected(item.id)} className={`rounded-2xl border p-4 text-left transition-all ${active ? `${activeClass} shadow-[0_0_24px_rgba(34,211,238,0.06)]` : 'border-space-700/50 bg-space-900/45 hover:border-space-600 hover:bg-space-900/70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><span className="font-mono text-[10px] uppercase tracking-wider text-space-600">{item.english}</span><h3 className="mt-1.5 text-sm font-semibold text-space-100">{item.name}</h3></div>
                  <span className={`mt-1 rounded-full border px-2 py-0.5 text-[10px] ${active ? 'border-space-500/60 text-space-200' : 'border-space-700 text-space-600'}`}>{active ? '当前方案' : '点击切换'}</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-space-500">{item.summary}</p>
                <div className="mt-4"><TradeoffSummary advantage={item.advantage} limitation={item.limitation} fit={item.fit} compact /></div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-space-700/50 bg-space-900/50 p-5 md:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><Badge variant={strategy.color}>{strategy.name}</Badge><span className="font-mono text-[10px] uppercase tracking-wider text-space-600">机制依据</span></div><h2 className="mt-3 text-xl font-bold text-space-100">{strategy.summary}</h2></div>
          <Workflow size={30} className={strategy.color === 'cyan' ? 'text-cyan-400/60' : strategy.color === 'violet' ? 'text-violet-400/60' : 'text-amber-400/60'} />
        </div>
        <div className="mt-5"><StrategyFlow strategy={strategy} /></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-space-700/45 bg-space-950/35 p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-cyan-400/75"><Route size={14} />新请求准入</div><p className="mt-2 text-sm leading-relaxed text-space-300">{strategy.admission}</p></div>
          <div className="rounded-xl border border-space-700/45 bg-space-950/35 p-4"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-violet-400/75"><Layers3 size={14} />Prefill 处理</div><p className="mt-2 text-sm leading-relaxed text-space-300">{strategy.prefill}</p></div>
        </div>
      </div>

      <ComparisonTable
        title="调度策略完整对照"
        description="先比较选型结论，再用准入方式和 Prefill 处理解释差异；机制差异不直接等同于固定性能提升。"
        columns={SCHEDULING_STRATEGIES}
        rows={[
          { label: '核心优势', key: 'advantage' },
          { label: '主要局限', key: 'limitation' },
          { label: '适用场景', key: 'fit' },
          { label: '新请求准入', key: 'admission' },
          { label: 'Prefill 处理', key: 'prefill' },
        ]}
      />

      <div className="flex flex-col gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-relaxed text-space-300">最终选择应结合请求长度分布、TTFT/SLO、最大批大小、Prefill 预算、显存余量与调度开销，在目标模型和硬件上验证。</p>
        <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => navigate('/panorama', { state: { moduleId: strategy.panoramaId } })} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300">查看对应条目 <ArrowUpRight size={14} /></button><button type="button" onClick={() => navigate('/diagnosis')} className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 bg-space-800/60 px-3 py-2 text-sm text-space-300">进入链路诊断 <ArrowRight size={14} /></button></div>
      </div>
    </div>
  );
}

function RoutingDiagram({ expertCount, topK, pattern }) {
  const visibleExperts = Math.min(expertCount, 12);
  const tokens = ['请求', '模型', '缓存', '延迟', '并行', '量化', '吞吐', '显存'];
  const routes = tokens.map((token, tokenIndex) => {
    const primary = pattern === 'skewed' ? tokenIndex % Math.min(3, visibleExperts) : tokenIndex % visibleExperts;
    return { token, experts: Array.from({ length: topK }, (_, k) => (primary + k * 3) % visibleExperts) };
  });
  const loads = Array.from({ length: visibleExperts }, (_, expert) => routes.reduce((sum, route) => sum + (route.experts.includes(expert) ? 1 : 0), 0));
  const maxLoad = Math.max(...loads, 1);

  return (
    <div className="rounded-2xl border border-space-700/50 bg-space-900/50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-space-100">Token 路由负载示意</h3><p className="mt-1 text-xs text-space-500">用于观察负载形态，不代表真实 Router 输出或固定性能结果。</p></div><Badge variant={pattern === 'balanced' ? 'emerald' : 'amber'}>{pattern === 'balanced' ? '相对均衡' : '局部集中'}</Badge></div>
      <div className="flex flex-wrap gap-2">
        {routes.map((route) => <div key={route.token} className="rounded-lg border border-violet-500/25 bg-violet-500/[0.07] px-2.5 py-2 text-xs"><span className="text-space-200">{route.token}</span><span className="ml-2 font-mono text-violet-300">→ {route.experts.map((expert) => `E${expert + 1}`).join(' / ')}</span></div>)}
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {loads.map((load, index) => <div key={index} className="relative overflow-hidden rounded-lg border border-space-700/50 bg-space-950/45 p-2 text-center"><div className="relative z-10 font-mono text-xs text-space-300">E{index + 1}</div><div className="relative z-10 mt-1 text-[10px] text-space-600">{load} Token</div><div className="absolute inset-x-0 bottom-0 bg-violet-500/15" style={{ height: `${(load / maxLoad) * 100}%` }} /></div>)}
      </div>
      {expertCount > visibleExperts && <p className="mt-3 text-center text-[11px] text-space-600">为保持图形可读，仅显示前 {visibleExperts} 个专家；公式仍按 {expertCount} 个专家计算。</p>}
    </div>
  );
}

function ModelExamples() {
  return (
    <section className="rounded-2xl border border-space-700/50 bg-space-950/30 p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-semibold text-space-100">代表模型案例</h2>
          <p className="mt-1 text-xs text-space-500">结合真实模型观察两种结构的典型使用方式；结构不同不直接代表能力高低。</p>
        </div>
        <Badge variant="violet">3 个 Dense · 3 个 MoE</Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {[
          ['dense', 'Dense 模型', '全部参数参与每个 Token 的前向计算', Layers3, 'cyan'],
          ['moe', 'MoE 模型', '通过 Router 为每个 Token 选择少量专家', Boxes, 'violet'],
        ].map(([type, title, description, Icon, color]) => (
          <div key={type} className={`rounded-2xl border p-4 ${type === 'dense' ? 'border-cyan-500/25 bg-cyan-500/[0.035]' : 'border-violet-500/25 bg-violet-500/[0.035]'}`}>
            <div className="flex items-center gap-3 border-b border-space-700/45 pb-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${type === 'dense' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300' : 'border-violet-500/30 bg-violet-500/10 text-violet-300'}`}>
                <Icon size={18} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-space-100">{title}</h3>
                <p className="mt-0.5 text-[11px] text-space-500">{description}</p>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {MODEL_EXAMPLES[type].map((model) => (
                <article key={model.name} className="rounded-xl border border-space-700/50 bg-space-950/45 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-space-100">{model.name}</h4>
                      <p className={`mt-1 font-mono text-[10px] ${type === 'dense' ? 'text-cyan-300' : 'text-violet-300'}`}>{model.scale}</p>
                    </div>
                    <Badge variant={color}>{model.tag}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                      <div className="text-[10px] font-semibold text-emerald-300">为什么适合这种结构</div>
                      <p className="mt-1.5 text-[11px] leading-5 text-space-400">{model.reason}</p>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3">
                      <div className="text-[10px] font-semibold text-amber-300">部署时要注意</div>
                      <p className="mt-1.5 text-[11px] leading-5 text-space-400">{model.tradeoff}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-space-700/50 bg-space-900/45 p-4">
        <div className="text-xs font-semibold text-space-300">如何理解这些案例</div>
        <p className="mt-2 text-xs leading-6 text-space-500">同一模型家族也可以同时提供 Dense 与 MoE 版本。中小规模、低并发或拓扑简单时，Dense 往往更容易部署；希望扩大总参数容量且具备专家并行与通信优化能力时，MoE 更有吸引力。</p>
      </div>
    </section>
  );
}
function MoeComparison({ navigate }) {
  const [baseParams, setBaseParams] = useState(8);
  const [expertSize, setExpertSize] = useState(4);
  const [expertCount, setExpertCount] = useState(8);
  const [topK, setTopK] = useState(2);
  const [pattern, setPattern] = useState('balanced');
  const safeTopK = Math.min(topK, expertCount);
  const totalParams = baseParams + expertSize * expertCount;
  const activeParams = baseParams + expertSize * safeTopK;
  const activeRatio = activeParams / totalParams;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-semibold text-space-100">Dense 与 MoE 选型结论</h2><p className="mt-1 text-xs text-space-500">模型组织方式决定激活路径，也改变部署、通信和运维边界。</p></div><Badge variant="violet">并排比较</Badge></div>
        <div className="grid gap-3 md:grid-cols-2">
          {MODEL_ORGANIZATION_DETAILS.map((item) => (
            <div key={item.id} className={`rounded-2xl border p-5 ${item.color === 'cyan' ? 'border-cyan-500/30 bg-cyan-500/[0.055]' : 'border-violet-500/30 bg-violet-500/[0.055]'}`}>
              <div className="flex items-start justify-between gap-3"><div><Badge variant={item.color}>{item.name}</Badge><h3 className="mt-3 text-xl font-bold text-space-100">{item.title}</h3></div>{item.id === 'dense' ? <Layers3 size={30} className="text-cyan-400/65" /> : <Boxes size={30} className="text-violet-400/65" />}</div>
              <div className="mt-4"><TradeoffSummary advantage={item.advantage} limitation={item.limitation} fit={item.fit} compact /></div>
              <div className="mt-3 rounded-xl border border-space-700/45 bg-space-950/35 p-3"><div className="text-[10px] font-semibold tracking-wide text-space-500">关键验证</div><p className="mt-1.5 text-[11px] leading-relaxed text-space-400">{item.validation}</p></div>
              <button type="button" onClick={() => navigate('/panorama', { state: { moduleId: item.panoramaId } })} className={`mt-4 inline-flex items-center gap-1.5 text-xs ${item.color === 'cyan' ? 'text-cyan-300' : 'text-violet-300'}`}>查看对应条目 <ArrowUpRight size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      <ComparisonTable
        title="Dense 与 MoE 选型对照"
        description="稀疏激活是结构差异，不应脱离模型实现、专家布局和通信拓扑直接推导端到端收益。"
        columns={MODEL_ORGANIZATION_DETAILS}
        rows={[
          { label: '核心优势', key: 'advantage' },
          { label: '主要局限', key: 'limitation' },
          { label: '适用场景', key: 'fit' },
          { label: '关键验证', key: 'validation' },
        ]}
        accent="violet"
        badge="选型边界"
      />

      <ModelExamples />

      <div className="rounded-2xl border border-space-700/50 bg-space-950/30 p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h2 className="flex items-center gap-2 font-semibold text-space-100"><Gauge size={17} className="text-violet-400" />结构与路由验证工具</h2><p className="mt-1 text-xs text-space-500">公式和负载示意只用于核对结构边界，是选型结论的辅助证据。</p></div><Badge variant="slate">辅助证据</Badge></div>
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-3 rounded-2xl border border-space-700/50 bg-space-900/55 p-4">
            <SliderControl label="共享与非专家参数" value={baseParams} min={2} max={40} step={2} unit="B" accent="violet" onChange={setBaseParams} />
            <SliderControl label="单个专家参数" value={expertSize} min={1} max={16} step={1} unit="B" accent="violet" onChange={setExpertSize} />
            <SliderControl label="专家数量" value={expertCount} min={4} max={32} step={4} accent="violet" onChange={(value) => { setExpertCount(value); setTopK((current) => Math.min(current, value)); }} />
            <SliderControl label="Top-K" value={safeTopK} min={1} max={Math.min(8, expertCount)} step={1} accent="violet" onChange={setTopK} />
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPattern('balanced')} className={`rounded-lg border px-2 py-2 text-xs ${pattern === 'balanced' ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300' : 'border-space-700/50 text-space-500'}`}>相对均衡</button><button type="button" onClick={() => setPattern('skewed')} className={`rounded-lg border px-2 py-2 text-xs ${pattern === 'skewed' ? 'border-amber-500/35 bg-amber-500/10 text-amber-300' : 'border-space-700/50 text-space-500'}`}>局部集中</button></div>
          </div>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.05] p-5"><div className="flex items-center justify-between"><Badge variant="cyan">Dense 基线</Badge><Layers3 size={25} className="text-cyan-400/65" /></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-space-700/45 bg-space-950/40 p-3"><div className="text-[10px] text-space-600">总参数</div><div className="mt-1 font-mono text-2xl font-bold text-cyan-300">{totalParams}B</div></div><div className="rounded-xl border border-space-700/45 bg-space-950/40 p-3"><div className="text-[10px] text-space-600">单 Token 激活</div><div className="mt-1 font-mono text-2xl font-bold text-cyan-300">{totalParams}B</div></div></div><p className="mt-3 text-xs leading-relaxed text-space-500">同总参数预算下，Dense 的全部参数参与每次前向。</p></div>
              <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.05] p-5"><div className="flex items-center justify-between"><Badge variant="violet">MoE 结构</Badge><Boxes size={25} className="text-violet-400/65" /></div><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-space-700/45 bg-space-950/40 p-3"><div className="text-[10px] text-space-600">总参数</div><div className="mt-1 font-mono text-2xl font-bold text-violet-300">{totalParams}B</div></div><div className="rounded-xl border border-space-700/45 bg-space-950/40 p-3"><div className="text-[10px] text-space-600">单 Token 激活</div><div className="mt-1 font-mono text-2xl font-bold text-emerald-300">{activeParams}B</div></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-space-800"><motion.div animate={{ width: `${activeRatio * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-400" /></div><p className="mt-2 text-xs text-space-500">激活比例：({baseParams} + {expertSize} × {safeTopK}) ÷ ({baseParams} + {expertSize} × {expertCount}) = {(activeRatio * 100).toFixed(1)}%</p></div>
            </div>
            <RoutingDiagram expertCount={expertCount} topK={safeTopK} pattern={pattern} />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuantComparison({ navigate }) {
  const [parameterCount, setParameterCount] = useState(70);
  const [gpuMemory, setGpuMemory] = useState(80);
  const [selected, setSelected] = useState('int8');
  const values = Object.entries(PRECISION_DETAILS).map(([key, detail]) => {
    const bytes = PRECISIONS[key].bytes;
    const gib = parameterCount * 1e9 * bytes / (1024 ** 3);
    return { id: key, key, ...detail, bytes, gib, shards: Math.ceil(gib / gpuMemory) };
  });
  const selectedValue = values.find((value) => value.key === selected) || values[1];
  const fp16GiB = values[0].gib;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-semibold text-space-100">量化方案选型结论</h2><p className="mt-1 text-xs text-space-500">点击精度方案直接比较容量优势、实现局限与适用部署条件。</p></div><Badge variant="amber">容量只是证据</Badge></div>
        <div className="grid gap-3 md:grid-cols-3">
          {values.map((value) => {
            const active = selected === value.key;
            const activeClass = value.key === 'fp16' ? 'border-cyan-500/45 bg-cyan-500/[0.08]' : value.key === 'int8' ? 'border-violet-500/45 bg-violet-500/[0.08]' : 'border-amber-500/45 bg-amber-500/[0.08]';
            return (
              <button key={value.key} type="button" aria-pressed={active} onClick={() => setSelected(value.key)} className={`rounded-2xl border p-4 text-left transition-all ${active ? activeClass : 'border-space-700/50 bg-space-900/50 hover:border-space-600'}`}>
                <div className="flex items-center justify-between"><Badge variant={value.color}>{value.name}</Badge><span className="font-mono text-xs text-space-500">{value.bits} bit</span></div>
                <div className="mt-4 flex items-end justify-between gap-3"><div><div className="text-[10px] text-space-600">纯权重理论容量</div><div className="mt-1 font-mono text-2xl font-bold text-space-100">{formatGiB(value.gib)} <span className="text-xs font-normal text-space-500">GiB</span></div></div><span className="text-[10px] text-space-600">{active ? '当前方案' : '点击切换'}</span></div>
                <div className="mt-4"><TradeoffSummary advantage={value.advantage} limitation={value.limitation} fit={value.fit} compact /></div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-space-700/50 bg-space-900/50 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2"><Badge variant={selectedValue.color}>{selectedValue.name}</Badge><span className="text-[10px] uppercase tracking-wider text-space-600">实施与验证边界</span></div><h2 className="mt-3 text-lg font-bold text-space-100">容量降低不能直接推导精度保持或端到端加速</h2></div><Binary size={28} className={selectedValue.color === 'cyan' ? 'text-cyan-400/60' : selectedValue.color === 'violet' ? 'text-violet-400/60' : 'text-amber-400/60'} /></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.05] p-4"><div className="text-[10px] font-semibold text-violet-300">实现条件</div><p className="mt-2 text-sm leading-relaxed text-space-300">{selectedValue.requirement}</p></div><div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4"><div className="text-[10px] font-semibold text-amber-300">必须验证</div><p className="mt-2 text-sm leading-relaxed text-space-300">{selectedValue.risk} 容量降低也不等于获得同等比例的端到端加速。</p></div></div>
      </div>

      <ComparisonTable
        title="量化方案选型对照"
        description="理论容量用于判断能否装入显存；生产选型还必须验证量化方法、计算核、精度和真实负载。"
        columns={values}
        rows={[
          { label: '核心优势', key: 'advantage' },
          { label: '主要局限', key: 'limitation' },
          { label: '适用场景', key: 'fit' },
          { label: '实现条件', key: 'requirement' },
        ]}
        accent="amber"
        badge="精度与容量权衡"
      />

      <div className="rounded-2xl border border-space-700/50 bg-space-950/30 p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><h2 className="flex items-center gap-2 font-semibold text-space-100"><Database size={17} className="text-amber-400" />权重容量验证工具</h2><p className="mt-1 text-xs text-space-500">结果是纯权重理论下界，不包含量化尺度、零点、分组元数据、KV Cache 与运行时工作区。</p></div><Badge variant="slate">辅助证据</Badge></div>
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-3 rounded-2xl border border-space-700/50 bg-space-900/55 p-4"><SliderControl label="模型参数量" value={parameterCount} min={1} max={405} step={1} unit="B" accent="violet" onChange={setParameterCount} /><SliderControl label="单卡显存输入" value={gpuMemory} min={8} max={192} step={8} unit=" GiB" accent="violet" onChange={setGpuMemory} /><div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs leading-relaxed text-space-400">计算式：参数量 × 每参数字节数；分片数仅按权重容量下界向上取整。</div></div>
          <div className="grid gap-3 md:grid-cols-3">
            {values.map((value) => <div key={value.key} className={`rounded-2xl border p-4 ${value.key === selected ? (value.key === 'fp16' ? 'border-cyan-500/40 bg-cyan-500/[0.06]' : value.key === 'int8' ? 'border-violet-500/40 bg-violet-500/[0.06]' : 'border-amber-500/40 bg-amber-500/[0.06]') : 'border-space-700/50 bg-space-900/45'}`}><div className="flex items-center justify-between"><Badge variant={value.color}>{value.name}</Badge><span className="text-[10px] text-space-600">相对 FP16 {(value.gib / fp16GiB * 100).toFixed(0)}%</span></div><div className="mt-5 font-mono text-3xl font-bold text-space-100">{formatGiB(value.gib)} <span className="text-sm font-normal text-space-500">GiB</span></div><div className="mt-1 text-xs text-space-500">{value.storage}</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-space-800"><motion.div initial={{ width: 0 }} animate={{ width: `${value.gib / fp16GiB * 100}%` }} className={`h-full rounded-full ${value.key === 'fp16' ? 'bg-cyan-400' : value.key === 'int8' ? 'bg-violet-400' : 'bg-amber-400'}`} /></div><div className="mt-4 rounded-lg border border-space-700/45 bg-space-950/35 p-2.5"><div className="text-[10px] text-space-600">权重容量下界分片</div><div className="mt-1 font-mono text-lg font-bold text-space-200">≥ {value.shards} × {gpuMemory} GiB</div></div></div>)}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 md:flex-row md:items-center md:justify-between"><p className="text-sm leading-relaxed text-space-300">量化方案还需要结合 GPTQ、AWQ、PTQ/QAT、校准数据、目标模型层分布和硬件算子支持评估。</p><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => navigate('/panorama', { state: { moduleId: 'quant' } })} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">查看量化条目 <ArrowUpRight size={14} /></button><button type="button" onClick={() => navigate('/lab', { state: { tab: 'kv' } })} className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 bg-space-800/60 px-3 py-2 text-sm text-space-300">进入容量实验室 <ArrowRight size={14} /></button></div></div>
    </div>
  );
}

const ATTENTION_DETAILS = [
  {
    id: 'MHA', name: 'MHA', label: 'Multi-Head Attention', color: 'cyan',
    summary: '每个 Query 头各配一组 K/V 头，KV Cache 与 Q 头数 1:1。',
    advantage: '结构直接、与标准公式一一对应，多数框架与算子的默认路径兼容性最好。',
    limitation: 'K/V 头数最多，同等序列与批次下持久 KV Cache 容量最大，长上下文时显存压力更高。',
    fit: '显存预算充足、优先兼容性与可预测性、头数规模适中的部署。',
    choice: '当容量不是主要约束、希望执行路径最标准时选择。',
    mechanism: 'Q 头与 K/V 头一一对应，缓存所有头的 K/V。',
    kvHeads: '与 Query 头数相同',
    kvSize: '最大：容量随 K/V 头数线性增长',
  },
  {
    id: 'GQA', name: 'GQA', label: 'Grouped-Query Attention', color: 'violet',
    summary: '多组 Query 头共享较少的 K/V 头，组数由模型配置决定。',
    advantage: '在接近 MHA 表达能力的同时降低持久 KV Cache 容量，是当前多数大模型默认选择。',
    limitation: '共享组数与权重设计需按模型核对，不能简单取 Q 头数 1/4 当作任意模型事实。',
    fit: '在线服务与长上下文为主、需要在容量与质量间折中的场景。',
    choice: '需要降低 KV 容量且模型本身采用 GQA 配置时选择。',
    mechanism: '把 Query 头分成若干组，每组共享一组 K/V 头。',
    kvHeads: '少于 Query 头数（如 Llama 3 70B 为 8）',
    kvSize: '低于 MHA：容量随实际 K/V 头数下降',
  },
  {
    id: 'MQA', name: 'MQA', label: 'Multi-Query Attention', color: 'amber',
    summary: '全部 Query 头共享同一组 K/V 头。',
    advantage: 'KV Cache 容量在所有共享方案中最低，实现简单。',
    limitation: '共享程度最高，质量与训练稳定性通常不如 GQA/MLA，现代新模型已较少单独采用。',
    fit: '容量极端受限、对单头表达能力要求不高的场景。',
    choice: '只在容量约束极强且验证质量可接受时选择。',
    mechanism: '所有 Query 头共享 1 组 K/V 头。',
    kvHeads: '1 组',
    kvSize: '远低于 MHA：与 Q 头数无关',
  },
  {
    id: 'MLA', name: 'MLA', label: 'Multi-head Latent Attention', color: 'emerald',
    summary: '缓存低秩潜变量与解耦 RoPE 分量，用较小缓存保持表达能力。',
    advantage: '持久缓存维度由公开潜变量配置决定，可明显低于同等 Q 头数的 MHA。',
    limitation: '依赖支持 MLA 的推理栈与公开配置（如 DeepSeek-V2），结构比标准 Attention 复杂。',
    fit: '推理栈已支持 MLA、且追求长上下文缓存效率的场景。',
    choice: '目标模型为 MLA 且运行时支持该结构时选择。',
    mechanism: '缓存低秩潜变量（kv_lora_rank）与解耦 RoPE 分量（qk_rope_head_dim）。',
    kvHeads: '按公开潜变量维度（如 DeepSeek-V2: 512+64）',
    kvSize: '通常低于同等 Q 头数的 MHA，与潜变量维度相关',
  },
];

function AttentionComparison({ navigate }) {
  const [seqLen, setSeqLen] = useState(8192);
  const [numHeads, setNumHeads] = useState(32);
  const base = { hiddenSize: 4096, numLayers: 32, seqLen, batchSize: 1, precision: 'fp16' };
  const bars = ATTENTION_DETAILS.map((item) => {
    const calc = calcKVCache({
      ...base,
      numHeads,
      architecture: item.id,
      numKVHeads: getArchitectureKVHeads(item.id, numHeads),
    });
    return {
      ...item,
      kvGiB: calc.kvCacheGB,
      structure: calc.isLatent ? `${calc.latentWidth} 维潜变量/层/Token` : `${calc.effectiveKVHeads} 个 K/V 头`,
    };
  });
  const maxGiB = Math.max(...bars.map((b) => b.kvGiB), 1e-4);
  const headDim = (4096 / numHeads).toFixed(0);

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-semibold text-space-100">Attention 架构选型结论</h2>
            <p className="mt-1 text-xs text-space-500">K/V 共享方式决定持久 KV Cache 容量，也改变实现与部署边界；容量按公式计算，非实测。</p>
          </div>
          <Badge variant="violet">并排比较</Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {ATTENTION_DETAILS.map((item) => (
            <div key={item.id} className={`rounded-2xl border p-5 ${item.color === 'cyan' ? 'border-cyan-500/30 bg-cyan-500/[0.055]' : item.color === 'violet' ? 'border-violet-500/30 bg-violet-500/[0.055]' : item.color === 'amber' ? 'border-amber-500/30 bg-amber-500/[0.055]' : 'border-emerald-500/30 bg-emerald-500/[0.055]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant={item.color}>{item.name}</Badge>
                  <h3 className="mt-3 text-xl font-bold text-space-100">{item.label}</h3>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-space-400">{item.summary}</p>
              <div className="mt-4"><TradeoffSummary advantage={item.advantage} limitation={item.limitation} fit={item.fit} compact /></div>
            </div>
          ))}
        </div>
      </div>

      <ComparisonTable
        title="Attention 架构完整对照"
        description="先比较选型结论，再按结构差异判断 KV Cache 容量与实现条件；共享方式不直接等同于固定质量差异。"
        columns={ATTENTION_DETAILS}
        rows={[
          { label: '核心机制', key: 'mechanism' },
          { label: 'K/V 头数', key: 'kvHeads' },
          { label: 'KV Cache 容量关系', key: 'kvSize' },
          { label: '主要局限', key: 'limitation' },
          { label: '适用场景', key: 'fit' },
          { label: '选择条件', key: 'choice' },
        ]}
        accent="violet"
        badge="结构与容量对照"
      />

      <div className="rounded-2xl border border-space-700/50 bg-space-950/30 p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold text-space-100"><Database size={17} className="text-violet-400" />KV Cache 容量对比</h2>
            <p className="mt-1 text-xs text-space-500">按公式计算同一输入下的持久 KV Cache 容量；不输出延迟、吞吐或显存峰值。</p>
          </div>
          <Badge variant="slate">公式结果</Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="space-y-3 rounded-2xl border border-space-700/50 bg-space-900/55 p-4">
            <div className="rounded-xl border border-space-700/40 bg-space-950/30 p-3">
              <div className="mb-2 text-sm font-medium text-space-200">注意力头数</div>
              <div className="flex flex-wrap gap-2">
                {[8, 16, 32, 64, 128].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setNumHeads(h)}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-all ${numHeads === h ? 'border-violet-400/45 bg-violet-500/15 text-violet-300' : 'border-space-700/50 bg-space-950/35 text-space-400 hover:border-space-600 hover:text-space-200'}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-space-600">Head 维度 = 4096 / {numHeads} = {headDim}</p>
            </div>
            <SliderControl label="序列长度" value={seqLen} min={1024} max={32768} step={1024} unit=" Token" accent="violet" onChange={setSeqLen} />
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-3 text-[11px] leading-relaxed text-space-400">
              计算式：KV = 2 × L × H_kv × d_h × S × B × bytes；这里固定 L=32、d=4096、Batch=1、FP16，便于横向比较架构差异。
            </div>
          </div>
          <div className="space-y-3">
            {bars.map((b) => (
              <div key={b.id} className="rounded-xl border border-space-700/50 bg-space-900/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={b.color}>{b.name}</Badge>
                    <span className="text-xs text-space-500">{b.structure}</span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-space-200">{b.kvGiB.toFixed(2)} GiB</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-space-800">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(b.kvGiB / maxGiB) * 100}%` }}
                    className={`h-full rounded-full ${b.color === 'cyan' ? 'bg-cyan-400' : b.color === 'violet' ? 'bg-violet-400' : b.color === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] leading-relaxed text-space-600">GQA/MQA 的容量按实际 K/V 头数计算；MLA 按公开潜变量维度计算。M4 只复用 M3 的同一套公式，不重复维护第二套口径。</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-relaxed text-space-300">完整调参与 FlashAttention 对比请进入参数实验室；容量与质量权衡需结合目标模型的公开配置验证。</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/lab', { state: { tab: 'attn' } })} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">进入实验室调参 <ArrowRight size={14} /></button>
          <button type="button" onClick={() => navigate('/panorama', { state: { moduleId: 'attn' } })} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-300">查看注意力条目 <ArrowUpRight size={14} /></button>
          <button type="button" onClick={() => navigate('/panorama', { state: { moduleId: 'kv' } })} className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 bg-space-800/60 px-3 py-2 text-sm text-space-300">查看 KV 机制 <ArrowUpRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}


export default function Compare() {
  const [activeTab, setActiveTab] = useState('scheduling');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const requestedTab = location.state?.tab;
    if (requestedTab) {
      const normalizedTab = requestedTab;
      setActiveTab(TABS.some((tab) => tab.id === normalizedTab) ? normalizedTab : 'scheduling');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader />
      <SectionTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      <div key={activeTab}>
        {activeTab === 'attention' && <AttentionComparison navigate={navigate} />}
        {activeTab === 'scheduling' && <SchedulingComparison navigate={navigate} />}
        {activeTab === 'moe' && <MoeComparison navigate={navigate} />}
        {activeTab === 'quant' && <QuantComparison navigate={navigate} />}
      </div>
    </div>
  );
}