import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, Crosshair, Filter, Globe2, Layers, LockKeyhole, Network, X } from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ModuleIcon from '../components/ModuleIcon.jsx';
import panoramaData from '../data/panorama.json';
import panoramaV5Content from '../data/panorama-v5-content.js';
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
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  const groups = useMemo(() => panoramaData.modules.reduce((acc, module) => { (acc[module.category] ||= []).push(module); return acc; }, {}), []);
  const moduleMap = useMemo(() => new Map(panoramaData.modules.flatMap((module) => [module.id, module.title, module.englishTitle, ...(module.aliases || [])].filter(Boolean).map((name) => [normalize(name), module]))), []);
  const resolveRelated = (label) => panoramaData.modules.find((module) => module.id === RELATED_ALIASES[label]) || moduleMap.get(normalize(label)) || null;
  const searchResults = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return panoramaData.modules
      .map((module) => {
        const fields = [module.id, module.title, module.englishTitle, ...(module.aliases || []), module.summary, module.definition, ...(panoramaV5Content[module.id]?.observations || [])];
        const hits = fields.filter((value) => normalize(value).includes(q));
        if (!hits.length) return null;
        const id = normalize(module.id);
        const title = normalize(module.title);
        const english = normalize(module.englishTitle || '');
        const score = id === q || title === q ? 100 : id.startsWith(q) || title.startsWith(q) ? 60 : english.startsWith(q) ? 50 : hits.includes(module.id) || hits.includes(module.title) ? 40 : 20;
        return { module, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.module.title.localeCompare(b.module.title, 'zh-CN'))
      .slice(0, 8);
  }, [query]);
  const selectedAccent = useMemo(() => {
    const column = COLUMNS.find((item) => item.groups.includes(selected?.category));
    return column?.accent || 'blue';
  }, [selected]);
  const selectedRelated = useMemo(() => {
    const unique = new Map();
    (selected?.related || []).map(resolveRelated).filter((module) => module && module.id !== selected?.id).forEach((module) => unique.set(module.id, module));
    return [...unique.values()];
  }, [selected]);

  const pageContext = useMemo(() => {
    const selectedContent = selected ? { ...selected, ...(panoramaV5Content[selected.id] || {}) } : null;
    return {
      // v5 keeps the existing assistant contract while exposing its own page title.
      pageId: 'panorama', pageTitle: '推理技术全景图 v5', pageType: 'knowledge-map', activeSection: selected ? 'module-detail' : 'overview',
      selection: { searchQuery: query, activeGroup: 'all', currentModule: selectedContent ? { id: selectedContent.id, title: selectedContent.title, englishTitle: selectedContent.englishTitle, category: selectedContent.category, categoryLabel: selectedContent.categoryLabel, summary: selectedContent.summary, definition: selectedContent.definition, problem: selectedContent.problem, steps: selectedContent.steps || [], impact: selectedContent.impact || [], related: selectedContent.related || [], observations: selectedContent.observations || [], guardrail: selectedContent.guardrail || null, stepNotes: selectedContent.stepNotes || [] } : null },
      parameters: { searchQuery: query.trim(), activeGroup: 'all', version: 'v5' }, result: { visibleModuleCount: query.trim() ? searchResults.length : panoramaData.modules.length, selectedModule: selected?.title || null },
      visibleSummary: selected ? `当前聚焦“${selected.title}”，正在查看它的定义、工作步骤、工程观察、边界与关联模块。` : '正在浏览大模型推理架构、模型结构、缓存优化、并行与硬件等技术模块。',
      suggestedQuestions: selected ? [`用一句话解释${selected.title}。`, `${selected.title}解决了什么问题？`, `${selected.title}应该观察哪些工程信号？`] : ['全景图中的模块如何组成一次完整推理请求？', '应该从哪个模块开始查看？'],
      boundaries: [],
    };
  }, [query, searchResults.length, selected]);
  usePageContextRegistration('panorama-v5-page', pageContext);

  useEffect(() => { const id = location.state?.moduleId; const module = id && panoramaData.modules.find((item) => item.id === id); if (module) setSelected(module); }, [location.state]);
  useEffect(() => { if (!searchOpen) return; requestAnimationFrame(() => searchInputRef.current?.focus()); }, [searchOpen]);
  function selectModule(module) { setSelected(module); setMobilePanel('detail'); }
  const closeSearch = () => setSearchOpen(false);
  const activateSearch = () => setSearchOpen(true);
  const selectSearchResult = (module) => {
    selectModule(module);
    setQuery('');
    setSearchOpen(false);
    requestAnimationFrame(() => {
      const element = document.querySelector(`[data-module-id="${module.id}"]`);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - window.innerHeight * .28), behavior: 'smooth' });
    });
  };
  const onSearchKeyDown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); if (searchResults[0]) selectSearchResult(searchResults[0].module); }
    else if (event.key === 'Escape') { setSearchOpen(false); setQuery(''); }
  };

  return (
    <div className="wb-page panorama-page panorama-v5">
      <header className="workbench-page-head">
        <div>
          <div className="workbench-page-head__eyebrow"><span className="workbench-page-head__rule" />TECHNICAL MAP / EXPLORATION</div>
          <h1>大模型推理全景图</h1>
          <p>先用一句话定位一个模块，再打开完整知识图例：定义、工作步骤、工程观察与关联知识一次展开。</p>
        </div>
        <div className="panorama-page-actions">
          <div className={cn('panorama-browser', searchOpen && 'is-open')}>
            <div className="panorama-browser-chrome" aria-label="全景图浏览器导航">
              <div className="panorama-browser-lights" aria-hidden="true"><i /><i /><i /></div>
              {searchOpen ? <div className="panorama-browser-address is-editing"><LockKeyhole size={13} /><span className="panorama-browser-origin">llm.local / panorama</span><input ref={searchInputRef} value={query} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={onSearchKeyDown} placeholder="搜索模块、术语或 ID" aria-label="搜索模块、术语或 ID" />{query && <button type="button" className="panorama-browser-clear" onClick={() => setQuery('')} aria-label="清空搜索"><X size={13} /></button>}<kbd>Enter</kbd></div> : <button type="button" className="panorama-browser-address" onClick={activateSearch} aria-label="打开全景图搜索"><LockKeyhole size={13} /><span className="panorama-browser-origin">llm.local</span><span className="panorama-browser-divider">/</span><strong>panorama</strong>{selected && <><span className="panorama-browser-divider">/</span><em>{selected.id}</em></>}<span className="panorama-browser-hint">点击搜索并进入模块</span><kbd>⌘ K</kbd></button>}
            </div>
            {searchOpen && <><div className="panorama-search-backdrop" onClick={closeSearch} aria-hidden="true" /><div className="panorama-search-pop" role="listbox" aria-label="搜索结果">{searchResults.length === 0 ? <div className="panorama-search-pop-empty"><Globe2 size={16} /><span>{query ? '没有匹配的模块，换个关键词试试。' : '输入关键词，点击结果进入模块详情。'}</span></div> : searchResults.map(({ module }) => <button key={module.id} type="button" role="option" onClick={() => selectSearchResult(module)} className="panorama-search-pop-item"><span className="panorama-node-icon"><ModuleIcon id={module.id} size={15} /></span><span className="panorama-search-pop-copy"><b>{module.title}</b><small>{module.englishTitle || module.id}</small><em>{module.categoryLabel || module.category} · 点击进入</em></span><ArrowRight size={13} /></button>)}</div></>}
          </div>
        </div>
      </header>

      <div className="panorama-filter-summary" role="status" aria-live="polite">
        <div><Filter size={14} /><span>当前显示</span><strong>全部模块</strong><em>{panoramaData.modules.length} 个模块</em></div>
        <span className="panorama-filter-summary__hint">搜索可命中模块定义与工程观察；点击节点进入完整知识图例</span>
      </div>

      <div className="panorama-workspace">
        <section className="panorama-canvas-pane" aria-label="推理技术地图">
          <div className="panorama-canvas-viewport"><div className="panorama-map-stage"><div className="panorama-map-grid" />{COLUMNS.map((column) => <div key={column.key} className={cn('panorama-column', `is-${column.accent}`)}><div className={cn('panorama-column-title', `is-${column.accent}`)}><span>{column.title}</span><small>{column.subtitle}</small></div>{column.groups.map((group) => { const meta = GROUP_META[group]; const modules = groups[group] || []; return <div className="panorama-group" key={group}><div className="panorama-group-head"><span>{meta[0]}</span><small>{meta[1]}</small><em>{modules.length}</em></div>{modules.map((module) => { const isSelected = selected?.id === module.id; const isRelated = selectedRelated.some((item) => item.id === module.id); return <button key={module.id} data-module-id={module.id} className={cn('panorama-node', isSelected && 'is-selected', isRelated && 'is-related')} onClick={() => selectModule(module)}><span className="panorama-node-icon"><ModuleIcon id={module.id} size={16} /></span><span className="panorama-node-copy"><b>{module.title}</b><small>{module.englishTitle || module.id}</small></span><ArrowRight size={13} /></button>; })}</div>; })}</div>)}</div></div>
          <div className="panorama-canvas-tools"><Layers size={14} /><span>固定布局</span></div>
          <div className="panorama-canvas-legend"><span><i className="is-line" />主题分组</span><span><i className="is-path" />当前选择</span><span><Network size={12} />滚动浏览全部模块</span></div>
        </section>
        <aside className={cn('panorama-inspector', mobilePanel === 'detail' && 'is-mobile-open')}><div className="panorama-inspector-head"><div><div className="wb-pane-label">检查器</div><strong>{selected ? '模块知识图例' : '选择一个模块'}</strong></div><button className="panorama-close-mobile" onClick={() => setMobilePanel(null)} aria-label="关闭"><X size={16} /></button></div>{selected ? <ModuleInspector module={selected} accent={selectedAccent} related={selectedRelated} onSelect={selectModule} /> : <div className="panorama-empty"><Crosshair size={24} /><p>点击中央画布中的模块，详情会在此处展开。</p><span>固定布局支持搜索和正常滚动浏览。</span></div>}</aside>
      </div>
      {mobilePanel && <div className={cn('panorama-mobile-backdrop', mobilePanel === 'detail' && 'is-detail-backdrop')} onClick={() => setMobilePanel(null)} />}
      <div className="panorama-mobile-actions"><button onClick={() => setMobilePanel('detail')}><Crosshair size={15} />详情</button></div>
    </div>
  );
}

function ModuleInspector({ module, accent, related, onSelect }) {
  const content = { ...module, ...(panoramaV5Content[module.id] || {}) };
  const color = ACCENT[accent];
  const [activeStep, setActiveStep] = useState(0);
  const steps = content.steps || [];
  const currentStep = steps[activeStep] || steps[0];
  const currentStepNote = content.stepNotes?.[activeStep] || `当前阶段围绕“${currentStep || '该步骤'}”展开；具体 API、算子或资源策略会随框架、模型配置与硬件实现变化。`;

  useEffect(() => { setActiveStep(0); }, [module.id]);

  return <div className="panorama-inspector-body panorama-v5-inspector">
    <div className="panorama-v5-module-kicker" style={{ color: color.text }}><span className="panorama-node-icon"><ModuleIcon id={module.id} size={18} /></span><span>{module.categoryLabel || module.category}</span><Badge variant="slate">{module.id}</Badge></div>
    <div className="panorama-v5-title-row"><div><h2>{module.title}</h2><p className="panorama-inspector-english">{module.englishTitle}</p></div><span className="panorama-v5-day">{module.dayLabel || '全部'}</span></div>

    <div className="panorama-plain-card panorama-v5-plain-card"><div className="wb-pane-label">一句话先懂</div><p>{content.plainExplanation || content.summary}</p></div>

    <section className="panorama-v5-professional"><div className="panorama-v5-section-head"><div><div className="wb-pane-label">专业解释</div></div></div><p className="panorama-professional-summary">{content.summary}</p><p>{content.definition}</p></section>

    <section className="panorama-v5-section"><div className="panorama-v5-section-head"><div><div className="wb-pane-label">工程观察</div></div></div><div className="panorama-v5-observation-grid">{(content.observations || []).map((item, index) => <div className="panorama-v5-observation" key={`${module.id}-observation-${index}`}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>)}</div></section>

    <section className="panorama-v5-section"><div className="panorama-v5-section-head"><div><div className="wb-pane-label">解决的问题</div></div></div><p className="panorama-v5-copy">{content.problem}</p></section>

    {steps.length > 0 && <section className="panorama-v5-section"><div className="panorama-v5-section-head"><div><div className="wb-pane-label">如何工作</div></div></div><div className={cn('panorama-v5-flow', steps.length > 4 && 'is-long')}>{steps.map((step, index) => <div className="panorama-v5-flow-item" key={`${module.id}-step-${index}`}><button type="button" className={cn('panorama-v5-step', activeStep === index && 'is-active')} onClick={() => setActiveStep(index)}><span className="panorama-v5-step-top"><b>{String(index + 1).padStart(2, '0')}</b><i>{index === steps.length - 1 ? '✓' : '→'}</i></span><strong>{step}</strong><small>{index === 0 ? '起点 / 准备' : index === steps.length - 1 ? '结果 / 回收' : '中间阶段'}</small></button>{index < steps.length - 1 && <span className="panorama-v5-flow-arrow" aria-hidden="true"><ArrowRight size={15} /></span>}</div>)}</div><div className="panorama-v5-step-detail"><div><strong>当前阶段 · {String(activeStep + 1).padStart(2, '0')}</strong><small>{currentStep}</small></div><p>{currentStepNote}</p></div></section>}

    <section className="panorama-v5-section panorama-v5-boundary"><p>{content.guardrail}</p></section>

    {content.impact?.length > 0 && <section className="panorama-v5-section panorama-v5-impact"><div className="panorama-v5-section-head"><div><div className="wb-pane-label">工程影响</div></div></div><div className="panorama-v5-impact-grid">{content.impact.map((item) => <div className="panorama-v5-impact-item" key={item}><span>{item.includes('↑') ? '↑' : item.includes('↓') ? '↓' : '·'}</span><b>{item.replace(/[↑↓]/g, '').trim()}</b><small>{item.includes('↑') ? '方向上升' : item.includes('↓') ? '方向下降' : '需结合场景'}</small></div>)}</div></section>}

    <section className="panorama-v5-section"><div className="panorama-v5-section-head"><div><div className="wb-pane-label">关联模块</div></div></div><div className="panorama-related-list">{related.length ? related.map((item) => <button key={item.id} onClick={() => onSelect(item)}><span><b>{item.title}</b><small>{item.englishTitle}</small></span><ArrowRight size={13} /></button>) : <span className="panorama-muted">暂无可解析的关联模块</span>}</div></section>

  </div>;
}
