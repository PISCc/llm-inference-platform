import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Layers, Cpu, HardDrive, Zap, ArrowRight } from 'lucide-react';
import GlowCard from '../components/GlowCard.jsx';
import ModuleModal from '../components/ModuleModal.jsx';
import ModuleIcon from '../components/ModuleIcon.jsx';
import Badge from '../components/Badge.jsx';
import panoramaData from '../data/panorama.json';

const COLUMNS = [
  {
    key: 'architecture',
    title: '推理架构',
    subtitle: 'Request → Schedule → Execute',
    icon: Layers,
    accent: 'cyan',
    groups: ['arch', 'memory', 'exec', 'gen', 'eval'],
  },
  {
    key: 'model',
    title: '模型与 MoE',
    subtitle: 'Token → Attention → Expert',
    icon: Cpu,
    accent: 'violet',
    groups: ['modelbase', 'attention', 'moe', 'attarch', 'compress'],
  },
  {
    key: 'hardware',
    title: '硬件与系统',
    subtitle: 'GPU → Interconnect → Parallel',
    icon: HardDrive,
    accent: 'emerald',
    groups: ['gpu', 'interconnect', 'parallel', 'hardware'],
  },
];

const RELATED_ALIASES = {
  '流式输出': 'stream', 'PD 分离': 'pd', Batching: 'cb', Prefill: 'prefill_decode', Decode: 'prefill_decode',
  'Block Table': 'paged', 'Attention 机制': 'attn', Attention: 'attn', 调度器: 'scheduler', Embedding: 'embed',
  RoPE: 'embed', 残差连接: 'block', SwiGLU: 'ffn', 多头注意力: 'mask', GQA: 'mha',
  'Expert Parallel': 'ep', GPTQ: 'awq', FP8: 'quant', 量化: 'quant', GPU算力: 'compute',
  性能指标: 'metrics', 可观测性: 'obs', GPU利用率: 'util', 并行策略: 'tp_pp_dp', NVSwitch: 'nvlink',
  PCIe: 'topo', TP: 'tp_pp_dp', PP: 'tp_pp_dp', CP: 'ep_cp_sp', 显存容量: 'vram', GPU型号: 'models',
  'Kernel 优化': 'kernel', 硬件选型: 'models', 输入处理: 'api', 负载均衡: 'balance', 拓扑: 'topo', 配型建议: 'sizing',
};

const normalizeModuleName = (value) => String(value || '').toLowerCase().replace(/[\s&/()（）·,_-]/g, '');

const GROUP_META = {
  arch: { label: 'Framework & Scheduling', labelZh: '推理框架与调度' },
  memory: { label: 'KV Cache & Memory', labelZh: '缓存与内存优化' },
  exec: { label: 'Execution & Compute', labelZh: '执行与计算优化' },
  gen: { label: 'Generation Acceleration', labelZh: '生成加速技术' },
  eval: { label: 'Benchmarking', labelZh: '评测与工程化' },
  modelbase: { label: 'Model Foundations', labelZh: '模型基础结构' },
  attention: { label: 'Attention Mechanisms', labelZh: '注意力机制' },
  moe: { label: 'Mixture of Experts', labelZh: '混合专家系统' },
  attarch: { label: 'Attention Architectures', labelZh: '注意力架构优化' },
  compress: { label: 'Compression', labelZh: '模型压缩技术' },
  gpu: { label: 'GPU Hardware', labelZh: 'GPU 硬件维度' },
  interconnect: { label: 'Interconnect', labelZh: '互联与拓扑' },
  parallel: { label: 'Parallelism', labelZh: '并行策略' },
  hardware: { label: 'Hardware Selection', labelZh: '机型与选型' },
};

const ACCENT_STYLES = {
  cyan: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
    glow: 'shadow-[0_0_24px_rgba(34,211,238,0.1)]',
    headerBg: 'bg-cyan-500/5',
    dot: 'bg-cyan-400',
    badge: 'cyan',
    icon: 'text-cyan-400 border-cyan-500/20',
  },
  violet: {
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/25',
    glow: 'shadow-[0_0_24px_rgba(167,139,250,0.1)]',
    headerBg: 'bg-violet-500/5',
    dot: 'bg-violet-400',
    badge: 'violet',
    icon: 'text-violet-400 border-violet-500/20',
  },
  emerald: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    glow: 'shadow-[0_0_24px_rgba(52,211,153,0.1)]',
    headerBg: 'bg-emerald-500/5',
    dot: 'bg-emerald-400',
    badge: 'emerald',
    icon: 'text-emerald-400 border-emerald-500/20',
  },
};

function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function Panorama() {
  const location = useLocation();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  // Auto-select module from navigation state
  useEffect(() => {
    const moduleId = location.state?.moduleId;
    if (moduleId) {
      const mod = panoramaData.modules.find(m => m.id === moduleId);
      if (mod) setSelected(mod);
      // Clear state so refresh doesn't re-open
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const groups = useMemo(() => {
    const byGroup = {};
    for (const m of panoramaData.modules) {
      if (!byGroup[m.category]) byGroup[m.category] = [];
      byGroup[m.category].push(m);
    }
    return byGroup;
  }, []);

  const moduleNameMap = useMemo(() => {
    const map = new Map();
    for (const module of panoramaData.modules) {
      for (const name of [module.id, module.title, module.englishTitle, ...(module.aliases || [])]) {
        if (name) map.set(normalizeModuleName(name), module);
      }
    }
    return map;
  }, []);

  const resolveRelated = (label) => {
    const aliasId = RELATED_ALIASES[label] || RELATED_ALIASES[String(label).replace(/\s+/g, '')];
    return (aliasId && panoramaData.modules.find((module) => module.id === aliasId))
      || moduleNameMap.get(normalizeModuleName(label))
      || null;
  };

  const filteredModules = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return panoramaData.modules.filter(
      (m) =>
        (m.englishTitle || '').toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        m.definition.toLowerCase().includes(q)
    );
  }, [query]);

  const selectedAccent = useMemo(() => {
    if (!selected) return 'cyan';
    const col = COLUMNS.find((c) => c.groups.includes(selected.category));
    return col?.accent || 'cyan';
  }, [selected]);

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-8">
      <Hero query={query} setQuery={setQuery} />

      {filteredModules ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-cyan-200"><Search size={15} />搜索结果</div>
            <Badge variant="cyan">找到 {filteredModules.length} 个模块</Badge>
          </div>
          {filteredModules.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {filteredModules.map((m) => <ModuleCard key={m.id} module={m} accent="cyan" onClick={() => setSelected(m)} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-space-700 bg-space-900/35 px-6 py-12 text-center text-sm text-space-500">没有匹配模块，请尝试英文术语、中文标题或关键词。</div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {COLUMNS.map((col) => (
            <SectionBlock
              key={col.key}
              col={col}
              groups={groups}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      <ModuleModal
        module={selected}
        accent={selectedAccent}
        onClose={() => setSelected(null)}
        resolveRelated={resolveRelated}
        onSelectRelated={setSelected}
      />
    </div>
  );
}

function Hero({ query, setQuery }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-space-700/50 bg-gradient-to-br from-space-900/90 via-space-950 to-space-900/80 p-6 md:p-8">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/8 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-violet-500/8 blur-3xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="cyan" className="mb-2">
            <Zap size={10} className="mr-1" />
            大模型推理全景图
          </Badge>
          <h1 className="text-2xl font-bold tracking-tight text-space-50 md:text-3xl">
            系统化拆解<span className="text-gradient"> 推理全链路</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-space-400">从请求调度、模型结构到多卡部署，按技术域检索并查看定义、工作步骤和关联模块。</p>
          <div className="mt-4 grid max-w-xl grid-cols-3 gap-2">
            <HeroStat value={panoramaData.meta.moduleCount} label="技术模块" />
            <HeroStat value={COLUMNS.length} label="技术域" />
            <HeroStat value="可检索" label="内容入口" />
          </div>
        </div>

        <div className="flex w-full items-center gap-3 md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-space-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索模块..."
              aria-label="搜索推理技术模块"
              className="w-full rounded-lg border border-space-700 bg-space-900/70 py-2 pl-9 pr-4 text-sm text-space-200 outline-none ring-cyan-500/30 transition-all placeholder:text-space-600 focus:border-cyan-500/50 focus:ring-2"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ value, label }) {
  return <div className="rounded-lg border border-space-700/50 bg-space-950/50 px-3 py-2"><div className="font-mono text-sm font-bold text-space-100">{value}</div><div className="mt-0.5 text-[10px] text-space-500">{label}</div></div>;
}

function SectionBlock({ col, groups, onSelect }) {
  const style = ACCENT_STYLES[col.accent];
  const Icon = col.icon;
  const moduleCount = col.groups.reduce((sum, group) => sum + (groups[group]?.length || 0), 0);

  return (
    <section>
      <div className={cn('mb-5 flex items-center justify-between gap-3 rounded-2xl border p-4', style.headerBg, style.border)}>
        <div className="flex items-center gap-3">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border', style.bg, style.border)}>
          <Icon size={22} className={style.text} />
        </div>
        <div>
          <h2 className={cn('text-xl font-bold md:text-2xl', style.text)}>{col.title}</h2>
          <p className="text-xs font-mono text-space-500">{col.subtitle}</p>
        </div>
        </div>
        <div className="hidden items-center gap-2 text-right sm:flex"><Badge variant={style.badge}>{moduleCount} 模块</Badge><span className="text-[10px] text-space-500">{col.subtitle}</span></div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {col.groups.map((g) => (
          <GroupBlock
            key={g}
            group={g}
            modules={groups[g] || []}
            columnAccent={col.accent}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

function GroupBlock({ group, modules, columnAccent, onSelect }) {
  const meta = GROUP_META[group] || { label: group, labelZh: group };
  const style = ACCENT_STYLES[columnAccent];

  return (
    <div className="space-y-2">
      <div className={cn(
        'flex items-center justify-between rounded-lg border px-4 py-2.5',
        style.headerBg,
        style.border
      )}>
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 rounded-full', style.dot)} />
          <div>
            <span className={cn('text-sm font-semibold', style.text)}>{meta.label}</span>
            <span className="ml-1.5 text-[10px] text-space-500">{meta.labelZh}</span>
          </div>
        </div>
        <Badge variant={style.badge}>{modules.length}</Badge>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {modules.map((m) => (
          <ModuleCard key={m.id} module={m} accent={columnAccent} onClick={() => onSelect(m)} />
        ))}
      </div>
    </div>
  );
}

function ModuleCard({ module, accent = 'cyan', onClick }) {
  const style = ACCENT_STYLES[accent];
  return (
    <GlowCard
      interactive
      accent={accent}
      onClick={onClick}
      className="module-card flex h-full flex-col p-3.5 text-left transition-transform"
    >
      <div className="mb-2 flex items-center gap-2">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border', style.icon)}>
          <ModuleIcon id={module.id} size={14} />
        </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-space-200">{module.englishTitle}</div>
            <div className="truncate text-[10px] text-space-500">{module.title}</div>
          </div>
      </div>
      <p className="line-clamp-2 text-xs leading-relaxed text-space-400">{module.summary}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[10px] text-space-600"><span>{module.categoryLabel || module.category}</span><ArrowRight size={12} className={style.text} /></div>
    </GlowCard>
  );
}
