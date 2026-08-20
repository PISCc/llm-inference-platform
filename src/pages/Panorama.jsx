import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Crosshair, Filter, Focus, Layers, Network, RotateCcw, Search, X } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ModuleIcon from '../components/ModuleIcon.jsx';
import panoramaData from '../data/panorama.json';
import { usePageContextRegistration } from '../context/PageContext.jsx';

const COLUMNS = [
  { key: 'architecture', title: '推理架构', subtitle: 'Request → Schedule → Execute', groups: ['arch', 'memory', 'exec', 'gen', 'eval'], accent: 'blue' },
  { key: 'model', title: '模型与结构', subtitle: 'Token → Attention → Expert', groups: ['modelbase', 'attention', 'moe', 'attarch', 'compress'], accent: 'violet' },
  { key: 'hardware', title: '系统与硬件', subtitle: 'GPU → Interconnect → Parallel', groups: ['gpu', 'interconnect', 'parallel', 'hardware'], accent: 'green' },
];
const GROUP_META = {
  arch: ['推理框架与调度', 'Framework & Scheduling'], memory: ['缓存与内存优化', 'KV Cache & Memory'], exec: ['执行与计算优化', 'Execution & Compute'], gen: ['生成加速技术', 'Generation Acceleration'], eval: ['评测与工程化', 'Evaluation & Engineering'],
  modelbase: ['模型基础结构', 'Model Foundations'], attention: ['注意力机制', 'Attention Mechanisms'], moe: ['混合专家系统', 'Mixture of Experts'], attarch: ['注意力架构', 'Attention Architectures'], compress: ['压缩与适配', 'Compression & Adaptation'],
  gpu: ['GPU 硬件维度', 'GPU Hardware'], interconnect: ['互联与拓扑', 'Interconnect & Topology'], parallel: ['多卡并行与通信', 'Parallelism'], hardware: ['机型与选型', 'Hardware Selection'],
};
const RELATED_ALIASES = { '流式输出': 'stream', 'PD 分离': 'pd', Batching: 'cb', Prefill: 'prefill_decode', Decode: 'prefill_decode', 'Block Table': 'paged', 'Attention 机制': 'attn', Attention: 'attn', 调度器: 'scheduler', Embedding: 'embed', RoPE: 'embed', 残差连接: 'block', SwiGLU: 'ffn', 多头注意力: 'mask', GQA: 'mha', 'Expert Parallel': 'ep', GPTQ: 'awq', FP8: 'quant', 量化: 'quant', GPU算力: 'compute', 性能指标: 'metrics', 可观测性: 'obs', GPU利用率: 'util', 并行策略: 'tp_pp_dp', NVSwitch: 'nvlink', PCIe: 'topo', TP: 'tp_pp_dp', PP: 'tp_pp_dp', CP: 'ep_cp_sp', 显存容量: 'vram', GPU型号: 'models', 'Kernel 优化': 'kernel', 硬件选型: 'models', 输入处理: 'api', 负载均衡: 'balance', 拓扑: 'topo', 配型建议: 'sizing' };
const ACCENT = { blue: { line: '#4f7fa0', soft: '#edf5f8', text: '#2f6f95' }, violet: { line: '#8b70a2', soft: '#f5f0f7', text: '#76568d' }, green: { line: '#628a70', soft: '#eef6f0', text: '#4d795a' } };
const normalize = (value) => String(value || '').toLowerCase().replace(/[\s&/()（）·,_-]/g, '');
const cn = (...items) => items.filter(Boolean).join(' ');

export default function Panorama() {
  const location = useLocation();
  const viewportRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('all');
  const [selected, setSelected] = useState(null);
  const [mobilePanel, setMobilePanel] = useState(null);

  const groups = useMemo(() => panoramaData.modules.reduce((acc, module) => { (acc[module.category] ||= []).push(module); return acc; }, {}), []);
  const moduleMap = useMemo(() => new Map(panoramaData.modules.flatMap((module) => [module.id, module.title, module.englishTitle, ...(module.aliases || [])].filter(Boolean).map((name) => [normalize(name), module]))), []);
  const resolveRelated = (label) => panoramaData.modules.find((module) => module.id === RELATED_ALIASES[label]) || moduleMap.get(normalize(label)) || null;
  const filteredModules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return panoramaData.modules.filter((module) => (!q || [module.id, module.title, module.englishTitle, module.summary, module.definition].some((value) => String(value || '').toLowerCase().includes(q))) && (activeGroup === 'all' || module.category === activeGroup));
  }, [activeGroup, query]);
  const selectedAccent = useMemo(() => {
    const column = COLUMNS.find((item) => item.groups.includes(selected?.category));
    return column?.accent || 'blue';
  }, [selected]);
  const selectedRelated = useMemo(() => {
    const unique = new Map();
    (selected?.related || [])
      .map(resolveRelated)
      .filter((module) => module && module.id !== selected?.id)
      .forEach((module) => unique.set(module.id, module));
    return [...unique.values()];
  }, [selected]);

  const pageContext = useMemo(() => ({
    pageId: 'panorama', pageTitle: '推理技术全景图', pageType: 'knowledge-map', activeSection: selected ? 'module-detail' : 'overview',
    selection: { searchQuery: query, activeGroup, currentModule: selected ? { id: selected.id, title: selected.title, englishTitle: selected.englishTitle, category: selected.category, categoryLabel: selected.categoryLabel, summary: selected.summary, definition: selected.definition, problem: selected.problem, steps: selected.steps || [], impact: selected.impact || [], related: selected.related || [] } : null },
    parameters: { searchQuery: query.trim(), activeGroup }, result: { visibleModuleCount: filteredModules.length, selectedModule: selected?.title || null },
    visibleSummary: selected ? `当前聚焦“${selected.title}”，正在查看它的定义、工作步骤、影响与关联模块。` : '正在浏览大模型推理架构、模型结构、缓存优化、并行与硬件等技术模块。',
    suggestedQuestions: selected ? [`用一句话解释${selected.title}。`, `${selected.title}解决了什么问题？`, `${selected.title}与关联模块之间是什么关系？`] : ['全景图中的模块如何组成一次完整推理请求？', '应该从哪个模块开始查看？'],
    boundaries: [],
  }), [activeGroup, filteredModules.length, query, selected]);
  usePageContextRegistration('panorama-page', pageContext);

  useEffect(() => { const id = location.state?.moduleId; const module = id && panoramaData.modules.find((item) => item.id === id); if (module) { setSelected(module); setActiveGroup('all'); } }, [location.state]);
  function focusSelected() {
    if (!selected) return;
    const node = viewportRef.current?.querySelector(`[data-module-id="${selected.id}"]`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }
  function selectModule(module) { setSelected(module); setMobilePanel('detail'); }
  function reset() { setQuery(''); setActiveGroup('all'); setSelected(null); setMobilePanel(null); }

  const activeModules = filteredModules;
  const activeGroupLabel = activeGroup === 'all' ? '全部模块' : (GROUP_META[activeGroup]?.[0] || activeGroup);
  const hasActiveFilter = Boolean(query.trim()) || activeGroup !== 'all';
  return (
    <div className="wb-page panorama-page">
      <header className="workbench-page-head"><div><div className="workbench-page-head__eyebrow"><span className="workbench-page-head__rule" />TECHNICAL MAP / EXPLORATION</div><h1>大模型推理全景图</h1><p>浏览推理系统中的模型、调度、缓存、并行与硬件模块；点击一个节点，在当前工作区内查看完整信息。</p></div><div className="panorama-page-actions"><label className="wb-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模块、术语或 ID" aria-label="搜索模块、术语或 ID" /></label><button className="wb-button" onClick={() => setMobilePanel('filters')}><Filter size={14} />筛选</button><button className="wb-button" onClick={focusSelected}><Focus size={14} />聚焦当前</button><button className="wb-button" onClick={reset}><RotateCcw size={14} />恢复视图</button></div></header>
      <div className="panorama-filter-summary" role="status" aria-live="polite">
        <div><Filter size={14} /><span>当前显示</span><strong>{activeGroupLabel}</strong><em>{filteredModules.length} / {panoramaData.modules.length} 个模块</em>{query.trim() && <small>关键词“{query.trim()}”</small>}</div>
        {hasActiveFilter ? <button type="button" onClick={() => { setQuery(''); setActiveGroup('all'); }}><X size={13} />清除筛选</button> : <span className="panorama-filter-summary__hint">输入关键词或使用“筛选”缩小范围</span>}
      </div>
      {filteredModules.length === 0 && <div className="panorama-filter-empty"><Search size={15} /><span>没有匹配的模块，请调整关键词或清除筛选。</span><button type="button" onClick={() => { setQuery(''); setActiveGroup('all'); }}>查看全部模块</button></div>}
      <div className="panorama-workspace">
        <section className="panorama-canvas-pane" aria-label="推理技术地图"><div ref={viewportRef} className="panorama-canvas-viewport"><div className="panorama-map-stage"><div className="panorama-map-grid" />{COLUMNS.map((column) => <div key={column.key} className={cn('panorama-column', `is-${column.accent}`)}><div className={cn('panorama-column-title', `is-${column.accent}`)}><span>{column.title}</span><small>{column.subtitle}</small></div>{column.groups.map((group) => { const meta = GROUP_META[group]; const modules = groups[group] || []; return <div className="panorama-group" key={group}><div className="panorama-group-head"><span>{meta[0]}</span><small>{meta[1]}</small><em>{modules.length}</em></div>{modules.map((module) => { const visible = activeModules.some((item) => item.id === module.id); const isSelected = selected?.id === module.id; const isRelated = selectedRelated.some((item) => item.id === module.id); return <button key={module.id} data-module-id={module.id} className={cn('panorama-node', visible ? 'is-visible' : 'is-muted', isSelected && 'is-selected', isRelated && 'is-related')} onClick={() => selectModule(module)}><span className="panorama-node-icon"><ModuleIcon id={module.id} size={16} /></span><span className="panorama-node-copy"><b>{module.title}</b><small>{module.englishTitle || module.id}</small></span><ArrowRight size={13} /></button>; })}</div>; })}</div>)}</div></div><div className="panorama-canvas-tools"><Layers size={14} /><span>固定布局</span></div><div className="panorama-canvas-legend"><span><i className="is-line" />主题分组</span><span><i className="is-path" />当前选择</span><span><Network size={12} />滚动浏览全部模块</span></div></section>
        <aside className={cn('panorama-inspector', mobilePanel === 'detail' && 'is-mobile-open')}><div className="panorama-inspector-head"><div><div className="wb-pane-label">检查器</div><strong>{selected ? '模块详情' : '选择一个模块'}</strong></div><button className="panorama-close-mobile" onClick={() => setMobilePanel(null)} aria-label="关闭"><X size={16} /></button></div>{selected ? <ModuleInspector module={selected} accent={selectedAccent} related={selectedRelated} onSelect={selectModule} /> : <div className="panorama-empty"><Crosshair size={24} /><p>点击中央画布中的模块，详情会在此处展开。</p><span>固定布局支持搜索、筛选、聚焦当前和正常滚动浏览。</span></div>}</aside>
      </div>
      {mobilePanel && <div className={cn('panorama-mobile-backdrop', mobilePanel === 'detail' && 'is-detail-backdrop')} onClick={() => setMobilePanel(null)} />}
      <div className="panorama-mobile-actions"><button onClick={() => setMobilePanel('filters')}><Filter size={15} />筛选</button><button onClick={() => setMobilePanel('detail')}><Crosshair size={15} />详情</button></div>
      {mobilePanel === 'filters' && <div className="panorama-mobile-drawer"><div className="panorama-inspector-head"><div><div className="wb-pane-label">范围</div><strong>筛选技术主题</strong></div><button onClick={() => setMobilePanel(null)} aria-label="关闭"><X size={16} /></button></div><div className="panorama-mobile-filter-list"><button className={cn('panorama-filter', activeGroup === 'all' && 'is-active')} onClick={() => { setActiveGroup('all'); setMobilePanel(null); }}>全部模块 <strong>{panoramaData.modules.length}</strong></button>{Object.entries(GROUP_META).map(([key, [label]]) => <button key={key} className={cn('panorama-filter', activeGroup === key && 'is-active')} onClick={() => { setActiveGroup(key); setMobilePanel(null); }}>{label} <strong>{groups[key]?.length || 0}</strong></button>)}</div></div>}
    </div>
  );
}

function ModuleInspector({ module, accent, related, onSelect }) {
  const color = ACCENT[accent];
  return <div className="panorama-inspector-body"><div className="panorama-inspector-kicker" style={{ color: color.text }}><span className="panorama-node-icon"><ModuleIcon id={module.id} size={18} /></span><span>{module.categoryLabel || module.category}</span><Badge variant="slate">{module.id}</Badge></div><h2>{module.title}</h2><p className="panorama-inspector-english">{module.englishTitle}</p><p className="panorama-inspector-summary">{module.plainExplanation || module.summary}</p><div className="panorama-detail-section"><div className="wb-pane-label">定义</div><p>{module.definition}</p></div><div className="panorama-detail-section"><div className="wb-pane-label">解决的问题</div><p>{module.problem}</p></div>{module.steps?.length > 0 && <div className="panorama-detail-section"><div className="wb-pane-label">工作步骤</div><div className="panorama-step-flow">{module.steps.map((step, index) => <div className="panorama-step-flow-item" key={`${module.id}-${index}`}><div className="panorama-step-card"><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></div>{index < module.steps.length - 1 && <span className="panorama-step-arrow arrow-flow" aria-hidden="true"><ArrowRight size={20} /></span>}</div>)}</div></div>}{module.impact?.length > 0 && <div className="panorama-impact"><div className="wb-pane-label">影响方向</div><div>{module.impact.map((item) => <Badge key={item} variant={accent === 'green' ? 'emerald' : accent === 'violet' ? 'violet' : 'cyan'}>{item}</Badge>)}</div></div>}<div className="panorama-detail-section"><div className="wb-pane-label">关联模块</div><div className="panorama-related-list">{related.length ? related.map((item) => <button key={item.id} onClick={() => onSelect(item)}><span>{item.title}</span><ArrowRight size={13} /></button>) : <span className="panorama-muted">暂无可解析的关联模块</span>}</div></div></div>;
}
