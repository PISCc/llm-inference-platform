import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Boxes, Binary, ArrowRight, ArrowUpRight, CheckCircle2,
  AlertTriangle, Clock3, Database, Gauge, Info, Layers3, Pause, Play, RotateCcw, Route, Rows3, Workflow
} from 'lucide-react';
import Badge from '../components/Badge.jsx';
import GlowCard from '../components/GlowCard.jsx';
import {
  PRECISIONS, SliderControl
} from '../modules/lab/common.jsx';

const TABS = [
  { id: 'scheduling', label: '调度与组批', icon: Layers3, accent: 'cyan' },
  { id: 'moe', label: 'Dense 与 MoE', icon: Boxes, accent: 'violet' },
  { id: 'quant', label: '权重量化', icon: Binary, accent: 'amber' },
];

const SCHEDULING_STRATEGIES = [
  { id: 'static', name: '静态批处理', english: 'Static Batching', color: 'cyan', summary: '先凑齐固定批次，再以统一轮次执行请求。', workflow: ['收集请求', '组成固定批', '整批执行', '批次结束'], admission: '批次开始后不再加入新请求', prefill: '长 Prefill 会占用整批执行窗口', goal: '降低实现复杂度与动态调度开销', risk: '短请求可能等待，长请求可能拖慢同批请求', fit: '离线批量任务、请求长度接近、延迟要求宽松', panoramaId: 'scheduler' },
  { id: 'continuous', name: 'Continuous Batching', english: 'Iteration-Level Scheduling', color: 'violet', summary: '在迭代边界动态重组批次，完成的请求可以及时退出。', workflow: ['请求入队', '按迭代重组', '执行一个迭代', '完成即退出'], admission: '在迭代边界加入或移除请求', prefill: 'Prefill 与 Decode 按迭代粒度共同参与调度', goal: '减少批内完成差异造成的空转', risk: '队列、抢占、公平性与 KV Cache 管理更复杂', fit: '在线服务、请求长度差异大、需要持续吞吐', panoramaId: 'cb' },
  { id: 'chunked', name: 'Chunked Prefill', english: 'Prefill Budgeting', color: 'amber', summary: '将长 Prefill 切成多个块，与 Decode 交错执行。', workflow: ['拆分长 Prefill', '分配本轮预算', '交错执行', '继续下一块'], admission: '可在分块边界插入新请求', prefill: '限制单轮 Prefill Token 数，降低对 Decode 的连续占用', goal: '缓解长 Prefill 对正在 Decode 请求的阻塞', risk: '分块大小需要调参，过小会增加调度开销', fit: '长上下文与 Decode 混合流量、需要控制迭代延迟', panoramaId: 'chunked' },
];

const TRAFFIC_PROFILES = {
  short: { label: '短请求为主', requests: ['S1', 'S2', 'S3', 'S4'], note: '长度接近，批次更容易保持整齐。' },
  mixed: { label: '长短混合', requests: ['S1', 'L1', 'S2', 'S3'], note: '最能体现长请求对在线调度的影响。' },
  long: { label: '长上下文为主', requests: ['L1', 'L2', 'S1', 'S2'], note: 'Prefill 工作量更大，调度预算更重要。' },
};

const PRECISION_DETAILS = {
  fp16: {
    color: 'cyan',
    bits: 16,
    name: 'FP16',
    storage: '2 字节/参数',
    requirement: '通常可直接承载半精度权重，仍需匹配硬件和推理引擎。',
    risk: '作为容量基线；不代表模型的训练原始精度。',
  },
  int8: {
    color: 'violet',
    bits: 8,
    name: 'INT8',
    storage: '1 字节/参数',
    requirement: '需要量化尺度、受支持的计算核，以及与目标硬件匹配的实现。',
    risk: '精度影响必须在目标任务和量化方案下评测。',
  },
  int4: {
    color: 'amber',
    bits: 4,
    name: 'INT4',
    storage: '0.5 字节/参数',
    requirement: '通常包含分组、尺度或零点等元数据，实际文件会高于纯权重下界。',
    risk: '压缩更强，精度、校准和算子支持风险也更需要单独验证。',
  },
};

function formatGiB(value) {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function PageHeader() {
  return (
    <div className="panel-shell relative overflow-hidden rounded-2xl border border-space-700/50 px-5 py-7 md:px-8">
      <div className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="amber">方案决策</Badge>
            <Badge variant="slate">公式与结构对比</Badge>
          </div>
          <h1 className="text-2xl font-bold text-gradient md:text-3xl">技术方案对比台</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-space-400">
            围绕同一推理目标，并排比较调度与组批、Dense/MoE 与权重量化方案；机制演示与公式结果用于建立判断边界，性能与精度结论必须回到具体模型、硬件和测试条件验证。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ['3', '调度策略'], ['2', '模型组织方式'], ['3', '权重精度'],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl border border-space-700/50 bg-space-950/40 px-3 py-2.5">
              <div className="font-mono text-lg font-bold text-amber-300">{value}</div>
              <div className="mt-0.5 text-space-500">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
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
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                active ? `${activeColor} bg-space-800/85` : 'border-transparent text-space-500 hover:text-space-200'
              }`}
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

function SchedulingFlow({ strategy, step }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {strategy.workflow.map((label, index) => {
        const active = index === step;
        const passed = index < step;
        return (
          <div key={label} className="relative">
            <motion.div animate={{ opacity: active ? 1 : 0.72, y: active ? -2 : 0 }} className={'min-h-[74px] rounded-xl border p-3 transition-colors ' + (active ? strategy.color === 'cyan' ? 'border-cyan-400/55 bg-cyan-500/[0.12]' : strategy.color === 'violet' ? 'border-violet-400/55 bg-violet-500/[0.12]' : 'border-amber-400/55 bg-amber-500/[0.12]' : passed ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-space-700/45 bg-space-950/35')}>
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[10px] text-space-600">STEP {String(index + 1).padStart(2, '0')}</span>{active && <span className={'h-1.5 w-1.5 animate-pulse rounded-full ' + (strategy.color === 'cyan' ? 'bg-cyan-300' : strategy.color === 'violet' ? 'bg-violet-300' : 'bg-amber-300')} />}</div>
              <div className="mt-3 text-sm font-semibold text-space-200">{label}</div>
            </motion.div>
            {index < strategy.workflow.length - 1 && <ArrowRight size={14} className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-space-600 md:block" />}
          </div>
        );
      })}
    </div>
  );
}

function SchedulingComparison({ navigate }) {
  const [selected, setSelected] = useState('continuous');
  const [traffic, setTraffic] = useState('mixed');
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const strategy = SCHEDULING_STRATEGIES.find((item) => item.id === selected) || SCHEDULING_STRATEGIES[1];
  const profile = TRAFFIC_PROFILES[traffic];

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % strategy.workflow.length), 1100);
    return () => window.clearInterval(timer);
  }, [running, strategy.workflow.length]);

  useEffect(() => { setStep(0); }, [selected, traffic]);

  const activeRequest = profile.requests[step % profile.requests.length];
  const currentState = strategy.workflow[step];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {SCHEDULING_STRATEGIES.map((item) => {
          const active = selected === item.id;
          return (
            <button key={item.id} type="button" aria-pressed={active} onClick={() => setSelected(item.id)} className={'group rounded-2xl border p-4 text-left transition-all ' + (active ? item.color === 'cyan' ? 'border-cyan-400/45 bg-cyan-500/[0.09] shadow-[0_0_24px_rgba(34,211,238,0.07)]' : item.color === 'violet' ? 'border-violet-400/45 bg-violet-500/[0.09] shadow-[0_0_24px_rgba(167,139,250,0.07)]' : 'border-amber-400/45 bg-amber-500/[0.09] shadow-[0_0_24px_rgba(251,191,36,0.07)]' : 'border-space-700/50 bg-space-900/45 hover:border-space-600 hover:bg-space-900/70')}>
              <div className="flex items-start justify-between gap-3"><div><span className="font-mono text-[10px] uppercase tracking-wider text-space-600">{item.english}</span><h3 className="mt-1.5 text-sm font-semibold text-space-100">{item.name}</h3></div><span className={'mt-1 h-2 w-2 rounded-full ' + (active ? item.color === 'cyan' ? 'bg-cyan-300' : item.color === 'violet' ? 'bg-violet-300' : 'bg-amber-300' : 'bg-space-700')} /></div>
              <p className="mt-3 text-xs leading-relaxed text-space-500">{item.summary}</p>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4 rounded-2xl border border-space-700/50 bg-space-900/55 p-4">
          <div><h2 className="flex items-center gap-2 font-semibold text-space-100"><Workflow size={17} className="text-cyan-400" />演示条件</h2><p className="mt-1 text-xs leading-relaxed text-space-500">只改变调度策略，使用同一组请求流观察准入、执行与退出边界。</p></div>
          <div><div className="mb-2 text-[10px] uppercase tracking-wider text-space-600">请求流量</div><div className="grid gap-2">{Object.entries(TRAFFIC_PROFILES).map(([key, value]) => <button key={key} type="button" aria-pressed={traffic === key} onClick={() => setTraffic(key)} className={'rounded-lg border px-3 py-2 text-left transition ' + (traffic === key ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200' : 'border-space-700/45 bg-space-950/35 text-space-500 hover:border-space-600 hover:text-space-300')}><span className="block text-xs font-medium">{value.label}</span><span className="mt-1 block text-[10px] text-space-600">{value.requests.join(' · ')} · S=短 / L=长</span></button>)}</div></div>
          <div className="rounded-xl border border-space-700/45 bg-space-950/35 p-3"><div className="flex items-center justify-between gap-2 text-xs text-space-400"><span>当前阶段</span><span className="font-mono text-cyan-300">{currentState}</span></div><div className="mt-2 flex items-center justify-between gap-2 text-xs text-space-500"><span>活动请求</span><span className="font-mono text-space-200">{activeRequest}</span></div><p className="mt-2 text-[11px] leading-relaxed text-space-600">{profile.note}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => setRunning((value) => !value)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-500/20">{running ? <Pause size={13} /> : <Play size={13} />}{running ? '暂停演示' : '开始演示'}</button><button type="button" onClick={() => { setRunning(false); setStep(0); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-space-600 bg-space-800/60 px-3 py-2 text-xs text-space-300 transition hover:border-space-500"><RotateCcw size={13} />重置</button></div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3 text-[11px] leading-relaxed text-space-500"><Info size={13} className="mr-1 inline text-cyan-400" />动画仅展示机制边界，不代表真实 Scheduler、Router 或生产压测输出。</div>
        </div>

        <div className="space-y-4"><div className="flex flex-col gap-3 rounded-2xl border border-space-700/50 bg-space-900/50 p-5 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant={strategy.color}>{strategy.name}</Badge><span className="font-mono text-[10px] uppercase tracking-wider text-space-600">{strategy.english}</span></div><h2 className="mt-3 text-xl font-bold text-space-100">{strategy.summary}</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-space-400">调度器决定请求何时进入执行批次、何时让出资源，以及长 Prefill 如何与 Decode 竞争本轮预算。</p></div><Clock3 size={30} className={strategy.color === 'cyan' ? 'text-cyan-400/60' : strategy.color === 'violet' ? 'text-violet-400/60' : 'text-amber-400/60'} /></div><SchedulingFlow strategy={strategy} step={step} /><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-space-700/45 bg-space-900/45 p-4"><div className="text-[10px] uppercase tracking-wider text-space-600">本轮观察</div><div className="mt-2 text-sm font-semibold text-space-200">{activeRequest} · {currentState}</div><p className="mt-1 text-xs leading-relaxed text-space-500">请求在当前调度阶段的状态随演示步进变化。</p></div><div className="rounded-xl border border-space-700/45 bg-space-900/45 p-4"><div className="text-[10px] uppercase tracking-wider text-space-600">判断重点</div><div className="mt-2 text-sm font-semibold text-space-200">{strategy.goal}</div><p className="mt-1 text-xs leading-relaxed text-space-500">这是策略设计目标，不是固定的线上性能承诺。</p></div></div></div>
      </div>

      <div className="rounded-2xl border border-space-700/50 bg-space-900/45 p-4 md:p-5"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><h2 className="flex items-center gap-2 font-semibold text-space-100"><Rows3 size={17} className="text-cyan-400" />方案对照</h2><p className="mt-1 text-xs leading-relaxed text-space-500">同一请求目标下，比较三种调度边界；不把机制差异直接等同于固定吞吐或延迟提升。</p></div><Badge variant="slate">机制级比较</Badge></div><div className="mt-4 overflow-x-auto rounded-xl border border-space-700/45"><table className="min-w-[760px] w-full border-collapse text-left text-xs"><thead><tr className="border-b border-space-700/45 bg-space-950/45"><th className="w-32 px-3 py-3 font-medium text-space-500">判断维度</th>{SCHEDULING_STRATEGIES.map((item) => <th key={item.id} className="px-3 py-3 font-medium text-space-200">{item.name}</th>)}</tr></thead><tbody>{[['新请求准入', 'admission'], ['Prefill 处理', 'prefill'], ['主要目标', 'goal'], ['典型风险', 'risk'], ['适用条件', 'fit']].map(([label, key]) => <tr key={key} className="border-b border-space-800/70 last:border-0"><th className="px-3 py-3 align-top font-medium text-space-500">{label}</th>{SCHEDULING_STRATEGIES.map((item) => <td key={item.id} className="px-3 py-3 align-top leading-relaxed text-space-400">{item[key]}</td>)}</tr>)}</tbody></table></div></div>

      <div className="flex flex-col gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-start gap-3"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-cyan-400" /><p className="text-sm leading-relaxed text-space-300">选择策略时，应同时核对请求长度分布、TTFT/SLO 目标、最大批大小、Prefill 预算、显存余量与调度开销；最终结论需要在目标模型和硬件上实测。</p></div><div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => navigate('/panorama', { state: { moduleId: strategy.panoramaId } })} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-300 transition hover:bg-cyan-500/20">查看对应全景条目 <ArrowUpRight size={14} /></button><button type="button" onClick={() => navigate('/diagnosis')} className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 bg-space-800/60 px-3 py-2 text-sm text-space-300 transition hover:border-space-500">进入链路诊断 <ArrowRight size={14} /></button></div></div>
    </div>
  );
}

function RoutingDiagram({ expertCount, topK, pattern }) {
  const visibleExperts = Math.min(expertCount, 12);
  const tokens = ['请求', '模型', '缓存', '延迟', '并行', '量化', '吞吐', '显存'];
  const routes = tokens.map((token, tokenIndex) => {
    const primary = pattern === 'skewed' ? tokenIndex % Math.min(3, visibleExperts) : tokenIndex % visibleExperts;
    return {
      token,
      experts: Array.from({ length: topK }, (_, k) => (primary + k * 3) % visibleExperts),
    };
  });
  const loads = Array.from({ length: visibleExperts }, (_, expert) => routes.reduce((sum, route) => sum + (route.experts.includes(expert) ? 1 : 0), 0));
  const maxLoad = Math.max(...loads, 1);

  return (
    <div className="rounded-2xl border border-space-700/50 bg-space-900/50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold text-space-100">Token 路由演示</h3><p className="mt-1 text-xs text-space-500">演示分配用于观察负载形态，不代表真实 Router 输出。</p></div><Badge variant={pattern === 'balanced' ? 'emerald' : 'amber'}>{pattern === 'balanced' ? '相对均衡' : '局部集中'}</Badge></div>
      <div className="flex flex-wrap gap-2">
        {routes.map((route) => (
          <div key={route.token} className="rounded-lg border border-violet-500/25 bg-violet-500/[0.07] px-2.5 py-2 text-xs"><span className="text-space-200">{route.token}</span><span className="ml-2 font-mono text-violet-300">→ {route.experts.map(e => `E${e + 1}`).join(' / ')}</span></div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6">
        {loads.map((load, index) => (
          <div key={index} className="relative overflow-hidden rounded-lg border border-space-700/50 bg-space-950/45 p-2 text-center">
            <div className="relative z-10 font-mono text-xs text-space-300">E{index + 1}</div>
            <div className="relative z-10 mt-1 text-[10px] text-space-600">{load} Token</div>
            <div className="absolute inset-x-0 bottom-0 bg-violet-500/15" style={{ height: `${(load / maxLoad) * 100}%` }} />
          </div>
        ))}
      </div>
      {expertCount > visibleExperts && <p className="mt-3 text-center text-[11px] text-space-600">为保持图形可读，仅显示前 {visibleExperts} 个专家；公式仍按 {expertCount} 个专家计算。</p>}
    </div>
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
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3 rounded-2xl border border-space-700/50 bg-space-900/55 p-4">
          <div><h2 className="flex items-center gap-2 font-semibold text-space-100"><Route size={17} className="text-violet-400" />MoE 结构参数</h2><p className="mt-1 text-xs leading-relaxed text-space-500">用显式结构参数计算总参数和单 Token 激活参数。</p></div>
          <SliderControl label="共享与非专家参数" value={baseParams} min={2} max={40} step={2} unit="B" accent="violet" onChange={setBaseParams} />
          <SliderControl label="单个专家参数" value={expertSize} min={1} max={16} step={1} unit="B" accent="violet" onChange={setExpertSize} />
          <SliderControl label="专家数量" value={expertCount} min={4} max={32} step={4} accent="violet" onChange={(value) => { setExpertCount(value); setTopK(k => Math.min(k, value)); }} />
          <SliderControl label="Top-K" value={safeTopK} min={1} max={Math.min(8, expertCount)} step={1} accent="violet" onChange={setTopK} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPattern('balanced')} className={`rounded-lg border px-2 py-2 text-xs ${pattern === 'balanced' ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300' : 'border-space-700/50 text-space-500'}`}>相对均衡</button>
            <button type="button" onClick={() => setPattern('skewed')} className={`rounded-lg border px-2 py-2 text-xs ${pattern === 'skewed' ? 'border-amber-500/35 bg-amber-500/10 text-amber-300' : 'border-space-700/50 text-space-500'}`}>局部集中</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <GlowCard accent="cyan" className="p-5">
              <div className="flex items-center justify-between"><div><Badge variant="cyan">Dense</Badge><h3 className="mt-2 text-xl font-bold text-space-100">同总参数预算基线</h3></div><Layers3 size={30} className="text-cyan-400/70" /></div>
              <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl border border-space-700/45 bg-space-950/40 p-3"><div className="text-[10px] uppercase text-space-600">总参数</div><div className="mt-1 font-mono text-2xl font-bold text-cyan-300">{totalParams}B</div></div><div className="rounded-xl border border-space-700/45 bg-space-950/40 p-3"><div className="text-[10px] uppercase text-space-600">单 Token 激活</div><div className="mt-1 font-mono text-2xl font-bold text-cyan-300">{totalParams}B</div></div></div>
              <p className="mt-4 text-sm leading-relaxed text-space-400">为控制变量，这里令 Dense 与 MoE 具有相同总参数预算；Dense 的全部参数参与每次前向，因此总参数与单 Token 激活参数相同。</p>
              <button type="button" onClick={() => navigate('/panorama', { state: { moduleId: 'dense' } })} className="mt-4 inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200">查看稠密模型条目 <ArrowUpRight size={13} /></button>
            </GlowCard>

            <GlowCard accent="violet" className="p-5">
              <div className="flex items-center justify-between"><div><Badge variant="violet">MoE</Badge><h3 className="mt-2 text-xl font-bold text-space-100">按路由激活专家</h3></div><Boxes size={30} className="text-violet-400/70" /></div>
              <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl border border-space-700/45 bg-space-950/40 p-3"><div className="text-[10px] uppercase text-space-600">总参数</div><div className="mt-1 font-mono text-2xl font-bold text-violet-300">{totalParams}B</div></div><div className="rounded-xl border border-space-700/45 bg-space-950/40 p-3"><div className="text-[10px] uppercase text-space-600">单 Token 激活</div><div className="mt-1 font-mono text-2xl font-bold text-emerald-300">{activeParams}B</div></div></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-space-800"><motion.div animate={{ width: `${activeRatio * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-violet-400 to-emerald-400" /></div>
              <p className="mt-2 text-xs text-space-500">激活比例：({baseParams} + {expertSize} × {safeTopK}) ÷ ({baseParams} + {expertSize} × {expertCount}) = {(activeRatio * 100).toFixed(1)}%</p>
              <button type="button" onClick={() => navigate('/panorama', { state: { moduleId: 'moe' } })} className="mt-4 inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200">查看 MoE 条目 <ArrowUpRight size={13} /></button>
            </GlowCard>
          </div>
          <RoutingDiagram expertCount={expertCount} topK={safeTopK} pattern={pattern} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { icon: CheckCircle2, title: '参数效率', text: 'MoE 可以让总参数大于单 Token 激活参数，但激活量仍由共享部分、专家大小和 Top-K 决定。', color: 'text-emerald-400' },
          { icon: Route, title: '路由与负载', text: 'Token 分布不均会让热门专家排队，瓶颈卡可能限制整体吞吐。', color: 'text-violet-400' },
          { icon: AlertTriangle, title: '通信边界', text: '专家跨设备部署会引入 Dispatch、Combine 与 All-to-All 通信，增加 GPU 不一定更快。', color: 'text-amber-400' },
        ].map((item) => {
          const Icon = item.icon;
          return <div key={item.title} className="rounded-xl border border-space-700/45 bg-space-900/45 p-4"><Icon size={17} className={item.color} /><h4 className="mt-2 text-sm font-semibold text-space-200">{item.title}</h4><p className="mt-1 text-xs leading-relaxed text-space-500">{item.text}</p></div>;
        })}
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
    return { key, ...detail, bytes, gib, shards: Math.ceil(gib / gpuMemory) };
  });
  const fp16GiB = values[0].gib;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3 rounded-2xl border border-space-700/50 bg-space-900/55 p-4">
          <div><h2 className="flex items-center gap-2 font-semibold text-space-100"><Database size={17} className="text-amber-400" />权重容量输入</h2><p className="mt-1 text-xs leading-relaxed text-space-500">结果是纯权重理论下界，不包含量化元数据和运行时空间。</p></div>
          <SliderControl label="模型参数量" value={parameterCount} min={1} max={405} step={1} unit="B" accent="violet" onChange={setParameterCount} />
          <SliderControl label="单卡显存输入" value={gpuMemory} min={8} max={192} step={8} unit=" GiB" accent="violet" onChange={setGpuMemory} />
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs leading-relaxed text-amber-100/80"><strong>公式：</strong>参数量 × 每参数字节数 ÷ 1024³。分片数只表示权重容量下界，实际部署还需激活值、KV Cache、临时张量与框架空间。</div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {values.map((value) => {
            const active = selected === value.key;
            return (
              <button key={value.key} type="button" onClick={() => setSelected(value.key)} className={`rounded-2xl border p-4 text-left transition-all ${active ? value.key === 'fp16' ? 'border-cyan-500/45 bg-cyan-500/[0.08]' : value.key === 'int8' ? 'border-violet-500/45 bg-violet-500/[0.08]' : 'border-amber-500/45 bg-amber-500/[0.08]' : 'border-space-700/50 bg-space-900/50 hover:border-space-600'}`}>
                <div className="flex items-center justify-between"><Badge variant={value.color}>{value.name}</Badge><span className="font-mono text-xs text-space-500">{value.bits} bit</span></div>
                <div className="mt-5 font-mono text-3xl font-bold text-space-100">{formatGiB(value.gib)} <span className="text-sm font-normal text-space-500">GiB</span></div>
                <div className="mt-1 text-xs text-space-500">{value.storage} · 相对 FP16 {(value.gib / fp16GiB * 100).toFixed(0)}%</div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-space-800"><motion.div initial={{ width: 0 }} animate={{ width: `${value.gib / fp16GiB * 100}%` }} className={`h-full rounded-full ${value.key === 'fp16' ? 'bg-cyan-400' : value.key === 'int8' ? 'bg-violet-400' : 'bg-amber-400'}`} /></div>
                <div className="mt-4 rounded-lg border border-space-700/45 bg-space-950/35 p-2.5"><div className="text-[10px] uppercase text-space-600">权重容量下界分片</div><div className="mt-1 font-mono text-lg font-bold text-space-200">≥ {value.shards} × {gpuMemory} GiB</div></div>
              </button>
            );
          })}
        </div>
      </div>

      {values.filter(value => value.key === selected).map((value) => (
        <motion.div key={value.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-space-700/45 bg-space-900/45 p-4"><CheckCircle2 size={17} className="text-emerald-400" /><h3 className="mt-2 text-sm font-semibold text-space-200">可直接确认</h3><p className="mt-1 text-xs leading-relaxed text-space-500">在忽略元数据时，{value.name} 的纯权重理论容量为 {formatGiB(value.gib)} GiB。</p></div>
          <div className="rounded-xl border border-space-700/45 bg-space-900/45 p-4"><Gauge size={17} className="text-violet-400" /><h3 className="mt-2 text-sm font-semibold text-space-200">实现条件</h3><p className="mt-1 text-xs leading-relaxed text-space-500">{value.requirement}</p></div>
          <div className="rounded-xl border border-space-700/45 bg-space-900/45 p-4"><AlertTriangle size={17} className="text-amber-400" /><h3 className="mt-2 text-sm font-semibold text-space-200">必须实测</h3><p className="mt-1 text-xs leading-relaxed text-space-500">{value.risk} 容量降低也不等于获得同等比例的端到端加速。</p></div>
        </motion.div>
      ))}

      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-relaxed text-space-300">量化方案还需要结合 GPTQ、AWQ、PTQ/QAT、校准数据、目标模型层分布和硬件算子支持评估。</p>
        <div className="flex shrink-0 flex-wrap gap-2"><button type="button" onClick={() => navigate('/panorama', { state: { moduleId: 'quant' } })} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">查看量化条目 <ArrowUpRight size={14} /></button><button type="button" onClick={() => navigate('/lab', { state: { tab: 'kv' } })} className="inline-flex items-center gap-1.5 rounded-lg border border-space-600 bg-space-800/60 px-3 py-2 text-sm text-space-300">进入容量实验室 <ArrowRight size={14} /></button></div>
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
      const normalizedTab = requestedTab === 'attention' ? 'scheduling' : requestedTab;
      setActiveTab(TABS.some(tab => tab.id === normalizedTab) ? normalizedTab : 'scheduling');
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader />
      <SectionTabs activeTab={activeTab} setActiveTab={setActiveTab} />
      <div key={activeTab}>
        {activeTab === 'scheduling' && <SchedulingComparison navigate={navigate} />}
        {activeTab === 'moe' && <MoeComparison navigate={navigate} />}
        {activeTab === 'quant' && <QuantComparison navigate={navigate} />}
      </div>
    </div>
  );
}
