import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Bot, BookOpenCheck, Boxes, Braces, CheckCircle2,
  ChevronRight, CircleHelp, Cpu, Database, FileSearch, Gauge, Layers3,
  Lightbulb, Link2, ListChecks, MessageSquareText, Network, Send,
  ShieldCheck, Sparkles, Workflow, X,
} from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import GlowCard from '../components/GlowCard.jsx';
import knowledge from '../data/knowledge.json';

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[\s`*_#\[\]（）()：:，,。.!！?？、/\\|\-]+/g, '');

const clean = (value) => String(value || '')
  .replace(/```(?:text)?/gi, '')
  .replace(/```/g, '')
  .replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .trim();

const ALL_ENTRIES = knowledge.entries;
const SEARCH_ENTRIES = ALL_ENTRIES.filter(
  (entry) => entry.id !== '大模型推理知识库' && entry.category !== '90-智能体知识库',
);
const ENTRY_BY_ID = new Map(ALL_ENTRIES.map((entry) => [entry.id, entry]));
const ENTRY_BY_KEY = new Map(
  ALL_ENTRIES.flatMap((entry) => [
    [normalize(entry.id), entry],
    [normalize(entry.title), entry],
  ]),
);

const PRESETS = [
  ['什么是 KV Cache？', 'kv-cache', '缓存', Database, 'cyan'],
  ['Prefill 和 Decode 有什么区别？', 'prefill-与-decode', '流程', Workflow, 'violet'],
  ['TTFT 和 TPOT 分别表示什么？', '性能指标', '指标', Gauge, 'emerald'],
  ['MHA、GQA、MQA 有什么区别？', 'mhamqagqa', '架构', Network, 'amber'],
  ['什么是 MoE？', 'moe', '模型', Boxes, 'violet'],
  ['量化解决什么问题？', '量化', '压缩', Braces, 'amber'],
  ['Continuous Batching 如何影响吞吐？', 'batching-与-continuous-batching', '调度', Layers3, 'cyan'],
  ['Prefix Cache 如何复用公共前缀？', 'prefix-cache', '缓存', Database, 'emerald'],
  ['CUDA Graph 解决什么问题？', 'cuda-graph', '执行', Cpu, 'violet'],
  ['为什么显存会 OOM？', 'memory-manager', '显存', Database, 'amber'],
  ['PagedAttention 优化了什么？', 'pagedattention', '缓存', Layers3, 'cyan'],
  ['FlashAttention 会改变模型结果吗？', 'flashattention', '架构', Sparkles, 'emerald'],
];

const HINTS = {
  'kv cache': ['kv-cache'], kv缓存: ['kv-cache'], 缓存: ['kv-cache', 'prefix-cache', 'pagedattention', 'memory-manager'],
  prefill: ['prefill-与-decode', 'chunked-prefill', 'pd-分离'], decode: ['prefill-与-decode', '自回归生成', 'speculative-decoding'],
  ttft: ['性能指标', 'prefill-与-decode'], tpot: ['性能指标', 'prefill-与-decode'], 延迟: ['性能指标', 'prefill-与-decode'], 吞吐: ['性能指标', 'batching-与-continuous-batching'],
  batching: ['batching-与-continuous-batching'], batch: ['batching-与-continuous-batching'], 连续批处理: ['batching-与-continuous-batching'],
  mha: ['mhamqagqa'], mqa: ['mhamqagqa'], gqa: ['mhamqagqa'], attention: ['attention-机制', 'mhamqagqa', 'flashattention'], 注意力: ['attention-机制', 'mhamqagqa', 'flashattention'],
  moe: ['moe'], 专家: ['moe', 'expert', 'router-与-top-k-routing'], 量化: ['量化', '数据格式与精度', 'gptq-与-awq'], int8: ['量化', '数据格式与精度'], int4: ['量化', '数据格式与精度'],
  prefix: ['prefix-cache'], 前缀: ['prefix-cache'], cuda: ['cuda-graph'], graph: ['cuda-graph'], oom: ['memory-manager', 'pagedattention', '显存与带宽'], 显存: ['显存与带宽', 'memory-manager', 'kv-cache', 'pagedattention'],
  碎片: ['block-table-与显存碎片', 'pagedattention', 'memory-manager'], pagedattention: ['pagedattention'], flashattention: ['flashattention'], 投机解码: ['speculative-decoding'], speculative: ['speculative-decoding'],
  token: ['token-与-token-id', 'tokenizer', '自回归生成'], tokenizer: ['tokenizer'], 调度: ['scheduler', '请求准入抢占重排与负载均衡'], 并行: ['并行方式总览', 'tpppdp', 'epcpsp'],
};

const LINKS = {
  'kv-cache': [['打开 KV Cache 全景模块', '/panorama', { moduleId: 'kv' }, 'cyan'], ['查看推理流水线', '/pipeline', null, 'violet'], ['计算缓存容量', '/lab', { tab: 'kv' }, 'emerald']],
  'prefill-与-decode': [['观察完整推理流程', '/pipeline', null, 'violet'], ['打开两阶段推理模块', '/panorama', { moduleId: 'prefill_decode' }, 'cyan']],
  性能指标: [['打开性能指标模块', '/panorama', { moduleId: 'metrics' }, 'cyan'], ['进入链路诊断台', '/diagnosis', null, 'emerald']],
  mhamqagqa: [['打开 Attention 参数实验', '/lab', { tab: 'attn' }, 'emerald'], ['打开 KV 共享策略模块', '/panorama', { moduleId: 'mha' }, 'cyan'], ['打开自注意力计算模块', '/panorama', { moduleId: 'attn' }, 'violet']],
  moe: [['对比 Dense 与 MoE', '/compare', { tab: 'moe' }, 'amber'], ['打开 MoE 全景模块', '/panorama', { moduleId: 'moe' }, 'cyan']],
  量化: [['对比 FP16、INT8、INT4', '/compare', { tab: 'quant' }, 'amber'], ['打开量化全景模块', '/panorama', { moduleId: 'quant' }, 'cyan']],
  scheduler: [['对比调度与组批策略', '/compare', { tab: 'scheduling' }, 'amber'], ['打开请求调度模块', '/panorama', { moduleId: 'scheduler' }, 'cyan'], ['进入链路诊断台', '/diagnosis', null, 'emerald']],
  'chunked-prefill': [['对比调度与组批策略', '/compare', { tab: 'scheduling' }, 'amber'], ['打开 Chunked Prefill 模块', '/panorama', { moduleId: 'chunked' }, 'cyan'], ['诊断首 Token 延迟', '/diagnosis', null, 'emerald']],
  'batching-与-continuous-batching': [['对比调度与组批策略', '/compare', { tab: 'scheduling' }, 'amber'], ['打开连续批处理模块', '/panorama', { moduleId: 'cb' }, 'cyan'], ['诊断吞吐问题', '/diagnosis', null, 'emerald']],
  'prefix-cache': [['打开前缀缓存模块', '/panorama', { moduleId: 'prefix' }, 'cyan'], ['观察 Prefill 过程', '/pipeline', null, 'violet']],
  'cuda-graph': [['打开 CUDA Graph 模块', '/panorama', { moduleId: 'cudagraph' }, 'cyan'], ['诊断启动与执行开销', '/diagnosis', null, 'emerald']],
  'memory-manager': [['打开显存管理模块', '/panorama', { moduleId: 'mm' }, 'cyan'], ['诊断显存 OOM', '/diagnosis', null, 'emerald'], ['计算显存容量', '/lab', { tab: 'kv' }, 'violet']],
  pagedattention: [['打开 PagedAttention 模块', '/panorama', { moduleId: 'paged' }, 'cyan'], ['诊断显存 OOM', '/diagnosis', null, 'emerald']],
  flashattention: [['打开 FlashAttention 模块', '/panorama', { moduleId: 'flash' }, 'cyan'], ['打开 Attention 参数实验', '/lab', { tab: 'attn' }, 'emerald']],
};

const FALLBACK_IDS = ['推理系统总览', 'prefill-与-decode', 'kv-cache', 'attention-机制', 'moe', '量化'];
const MATCH_LABELS = {
  preset: '预设问题映射', title: '标题或 ID 直接命中', alias: '别名命中', keyword: '主题关键词命中', field: '知识字段相关匹配', index: '知识索引推荐',
};
const toneClasses = (tone) => ({
  cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
  violet: 'border-violet-500/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20',
  emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
}[tone] || 'border-space-700/60 bg-space-900/60 text-space-300 hover:bg-space-800/70');

const entryCorpus = (entry) => [
  entry.id, entry.title, entry.summary, entry.definition, entry.problem,
  ...(entry.aliases || []), ...(entry.tags || []), ...(entry.related || []),
  ...Object.keys(entry.sections || {}), ...Object.values(entry.sections || {}),
].join(' ');

const addEvidence = (list, type, detail) => {
  if (!list.some((item) => item.type === type && item.detail === detail)) list.push({ type, detail });
};

function scoreEntry(entry, rawQuery) {
  const query = normalize(rawQuery);
  const rawLower = String(rawQuery || '').toLowerCase();
  const title = normalize(entry.title);
  const id = normalize(entry.id);
  const corpus = normalize(entryCorpus(entry));
  const evidence = [];
  let score = 0;
  if (query && (query.includes(title) || query.includes(id) || title.includes(query) || id.includes(query))) {
    score += 100;
    addEvidence(evidence, 'title', '标题或条目 ID 与问题直接对应');
  }
  for (const alias of entry.aliases || []) {
    const aliasKey = normalize(alias);
    if (aliasKey.length >= 2 && query.includes(aliasKey)) {
      score += 72;
      addEvidence(evidence, 'alias', '命中别名：' + alias);
    }
  }
  for (const [term, ids] of Object.entries(HINTS)) {
    const termKey = normalize(term);
    if (termKey.length >= 2 && query.includes(termKey) && ids.includes(entry.id)) {
      score += Math.max(24, 52 - ids.indexOf(entry.id) * 8);
      addEvidence(evidence, 'keyword', '命中主题关键词：' + term);
    }
  }
  const titleParts = [entry.title, ...(entry.aliases || []), ...(entry.tags || [])]
    .flatMap((value) => String(value).toLowerCase().split(/[\\s、，,/与和及]+/))
    .map(normalize)
    .filter((part) => part.length >= 2);
  for (const part of titleParts) {
    if (query.includes(part)) {
      score += 20;
      addEvidence(evidence, 'keyword', '命中主题词：' + part);
    }
  }
  const englishTokens = rawLower.match(/[a-z][a-z0-9-]{1,}/g) || [];
  for (const token of englishTokens) {
    if (corpus.includes(normalize(token))) {
      score += 10;
      addEvidence(evidence, 'field', '知识字段包含：' + token.toUpperCase());
    }
  }
  if (evidence.length && score >= 20) {
    const matchType = evidence.some((item) => item.type === 'title') ? 'title'
      : evidence.some((item) => item.type === 'alias') ? 'alias'
        : evidence.some((item) => item.type === 'keyword') ? 'keyword' : 'field';
    return { entry, score, matchType, evidence };
  }
  return null;
}

export function retrieve(query, forcedId = null) {
  if (forcedId && ENTRY_BY_ID.has(forcedId)) {
    return { direct: true, matches: [{ entry: ENTRY_BY_ID.get(forcedId), score: 1000, matchType: 'preset', evidence: [{ type: 'preset', detail: '预设问题已绑定到指定知识主题' }] }] };
  }
  const ranked = SEARCH_ENTRIES.map((entry) => scoreEntry(entry, query)).filter(Boolean)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'zh-CN'));
  const matches = ranked.slice(0, 4);
  if (matches.length) return { direct: true, matches };
  return {
    direct: false,
    matches: FALLBACK_IDS.map((id) => ENTRY_BY_ID.get(id)).filter(Boolean)
      .map((entry) => ({ entry, score: 0, matchType: 'index', evidence: [{ type: 'index', detail: '未形成足够明确的主题命中，仅作为浏览入口' }] })),
  };
}

function answerBlocks(entry) {
  const sections = entry.sections || {};
  const preferred = ['解决什么问题', '区别', '对比', '工作原理', '关键点', '收益与代价', '为什么占显存', '为什么快', '核心指标', '尾延迟', '原理', '两种量化', '收益'];
  const keys = preferred.filter((key) => sections[key]).concat(Object.keys(sections).filter((key) => !preferred.includes(key)));
  const blocks = [];
  const seen = new Set();
  const push = (label, value) => {
    const text = clean(value);
    if (!text || seen.has(text)) return;
    seen.add(text);
    blocks.push({ label, text });
  };
  push('定义', entry.definition || sections['一句话定义'] || entry.summary);
  push('问题边界', entry.problem);
  (entry.steps || []).filter((step) => clean(step)).forEach((step, index) => push('流程步骤 ' + (index + 1), step));
  keys.slice(0, 5).forEach((key) => push(key, sections[key]));
  return blocks.slice(0, 8);
}

function relatedEntries(entry) {
  return (entry.related || []).map((ref) => ENTRY_BY_KEY.get(normalize(ref)) || ENTRY_BY_ID.get(ref)).filter(Boolean)
    .filter((item, index, list) => item.id !== entry.id && list.findIndex((other) => other.id === item.id) === index).slice(0, 6);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function Stat({ value, label, tone = 'cyan' }) {
  return <div className={'rounded-xl border px-3 py-3 ' + toneClasses(tone)}><div className="text-lg font-semibold text-space-100">{value}</div><div className="mt-1 text-[11px] text-space-400">{label}</div></div>;
}

function MatchEvidence({ match }) {
  return <div className="mt-4 rounded-xl border border-space-700/50 bg-space-950/45 p-4"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-space-300">检索依据</span><Badge variant={match.matchType === 'preset' ? 'violet' : 'cyan'}>{MATCH_LABELS[match.matchType]}</Badge></div><div className="mt-3 flex flex-wrap gap-2">{match.evidence.map((item) => <span key={item.type + item.detail} className="inline-flex items-center gap-1.5 rounded-lg border border-space-700/55 bg-space-900/60 px-2.5 py-1.5 text-[11px] text-space-400"><CheckCircle2 size={12} className="text-emerald-400" />{item.detail}</span>)}</div></div>;
}

function StructuredText({ text }) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const isTable = lines.length >= 2 && lines.every((line) => line.startsWith('|')) && /^\|?[\s:|-]+\|?$/.test(lines[1]);
  if (isTable) {
    const cells = (line) => line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
    const headers = cells(lines[0]);
    const rows = lines.slice(2).map(cells);
    return <div className="mt-3 overflow-x-auto rounded-lg border border-space-700/50"><table className="w-full min-w-[520px] border-collapse text-left text-xs"><thead className="bg-space-900/85 text-space-300"><tr>{headers.map((header) => <th key={header} className="border-b border-space-700/60 px-3 py-2.5 font-semibold">{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-space-800/80 last:border-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2.5 leading-5 text-space-400">{cell}</td>)}</tr>)}</tbody></table></div>;
  }
  return <div className="mt-3 space-y-2 text-sm leading-7 text-space-400">{lines.map((line, index) => /^[-*]\s+/.test(line) ? <div key={index} className="flex items-start gap-2"><span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400/70" /><span>{line.replace(/^[-*]\s+/, '')}</span></div> : <p key={index} className="whitespace-pre-wrap">{line}</p>)}</div>;
}

export default function Agent() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [forcedId, setForcedId] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const result = useMemo(() => submitted ? retrieve(submitted, forcedId) : null, [submitted, forcedId]);
  const directMatch = result?.direct ? result.matches[0] : null;
  const entry = directMatch?.entry || null;
  const blocks = entry ? answerBlocks(entry) : [];
  const related = entry ? relatedEntries(entry) : [];

  const submit = (nextQuery = query, nextForcedId = null) => {
    const value = String(nextQuery || '').trim().slice(0, 200);
    if (!value) return;
    setQuery(value);
    setForcedId(nextForcedId);
    setSubmitted(value);
    setActiveHistoryId(null);
    setHistory((items) => [{ id: Date.now(), query: value, forcedId: nextForcedId, title: nextForcedId ? ENTRY_BY_ID.get(nextForcedId)?.title : '自定义检索', createdAt: Date.now() }, ...items.filter((item) => item.query !== value || item.forcedId !== nextForcedId)].slice(0, 8));
  };
  const openPreset = (preset) => submit(preset[0], preset[1]);
  const openHistory = (item) => { setQuery(item.query); setForcedId(item.forcedId || null); setSubmitted(item.query); setActiveHistoryId(item.id); };
  const openEntry = (item) => submit('解释：' + item.title, item.id);
  const clearHistory = () => { setHistory([]); setActiveHistoryId(null); };

  return <div className="space-y-6">
    <ProductHeader
      title="AI 讲解智能体"
      subtitle="基于本地推理知识库进行确定性检索，将已记录的定义、问题、步骤和主题分区整理成可核验的技术说明。"
      accent="violet"
      badges={[
        { label: '离线可用', variant: 'emerald' },
        { label: '不扩写知识库外结论', variant: 'slate' },
        { label: '显示检索依据与来源文件', variant: 'slate' },
        { label: '支持模块联动', variant: 'slate' },
      ]}
    />
    <div className="panel-shell rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.08] via-space-900/85 to-cyan-500/[0.05] p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/15 text-violet-300"><Bot size={25} /></div>
          <div><div className="text-sm font-semibold text-space-200">确定性本地检索</div><div className="mt-1 text-xs text-space-500">问题 → 主题 → 字段 → 回答</div></div>
        </div>
        <div className="grid grid-cols-5 gap-1.5 md:w-[min(100%,420px)]">{['输入', '检索', '抽取', '组装', '联动'].map((label, index) => <div key={label} className="text-center"><div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-space-700/60 bg-space-900/70 text-[10px] font-semibold text-space-300">{index + 1}</div><div className="mt-1.5 text-[10px] text-space-600">{label}</div></div>)}</div>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3"><Stat value={SEARCH_ENTRIES.length} label="技术主题" tone="cyan" /><Stat value={PRESETS.length} label="预设问题" tone="violet" /><Stat value="5" label="可联动模块" tone="emerald" /></div>

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="space-y-6">
        <GlowCard className="p-5 md:p-6" accent="violet">
          <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><MessageSquareText size={17} className="text-violet-300" />提出技术问题</div><p className="mt-1 text-xs text-space-500">建议包含具体术语、指标或推理阶段，便于形成明确主题命中。</p></div><Badge variant="slate">{query.length}/200</Badge></div>
          <form className="mt-4" onSubmit={(event) => { event.preventDefault(); submit(); }}><div className="relative"><textarea value={query} maxLength={200} onChange={(event) => { setQuery(event.target.value); setForcedId(null); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} placeholder="例如：为什么 TTFT 会变高？" rows={3} className="w-full resize-none rounded-xl border border-space-700/70 bg-space-950/75 px-4 py-3 pr-14 text-sm leading-6 text-space-200 outline-none transition placeholder:text-space-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10" /><button type="submit" aria-label="开始检索" className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200 transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:opacity-40" disabled={!query.trim()}><Send size={16} /></button></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-space-600"><span>Enter 检索 · Shift+Enter 换行 · 最多 200 字</span><span>仅使用本地 knowledge.json</span></div></form>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{PRESETS.slice(0, 6).map(([label, id, tag, Icon, tone]) => <button key={id} type="button" onClick={() => openPreset([label, id])} className="group flex items-center gap-3 rounded-xl border border-space-700/55 bg-space-950/45 p-3 text-left transition hover:border-violet-400/35 hover:bg-space-900/70"><span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + toneClasses(tone)}><Icon size={16} /></span><span className="min-w-0"><span className="block truncate text-xs font-medium text-space-300 group-hover:text-space-100">{label}</span><span className="mt-1 block text-[10px] text-space-600">{tag} · 预设映射</span></span><ChevronRight size={14} className="ml-auto shrink-0 text-space-600" /></button>)}</div>
        </GlowCard>

        <AnimatePresence mode="wait">
          {!submitted && <motion.section key="empty" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-space-700/50 bg-space-900/55 p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300"><Sparkles size={19} /></span><div><h2 className="text-lg font-semibold text-space-100">从主题开始定位</h2><p className="mt-2 text-sm leading-7 text-space-500">该智能体只对本地知识库中能够明确定位的主题进行回答。推荐使用“概念 + 阶段 / 指标 / 原因”的问法。</p></div></div><div className="mt-6 grid gap-3 md:grid-cols-3">{[['概念定义', 'KV Cache 是什么？'], ['阶段定位', '为什么 Prefill 变慢？'], ['指标解释', 'TTFT 与 TPOT 有什么区别？']].map(([label, example]) => <button key={label} type="button" onClick={() => submit(example)} className="rounded-xl border border-space-700/55 bg-space-950/35 px-3 py-3 text-left transition hover:border-cyan-500/30"><span className="block text-[10px] text-space-600">{label}</span><span className="mt-1 block text-xs leading-relaxed text-space-400">{example}</span></button>)}</div></motion.section>}

          {submitted && result?.direct && entry && <motion.article key={submitted + entry.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-space-900/90 to-space-950/75"><header className="border-b border-space-700/50 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Badge variant="cyan">已定位主题</Badge><span className="text-xs text-space-600">{entry.category}</span></div><button type="button" onClick={() => { setSubmitted(''); setQuery(''); setForcedId(null); }} className="inline-flex items-center gap-1.5 text-xs text-space-600 transition hover:text-space-300"><X size={14} />清除回答</button></div><h2 className="mt-4 text-2xl font-semibold tracking-tight text-space-100">{entry.title}</h2><p className="mt-2 max-w-3xl text-sm leading-7 text-space-400">{clean(entry.summary)}</p><MatchEvidence match={directMatch} /><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-space-600"><span className="inline-flex items-center gap-1.5"><FileSearch size={13} />来源文件：{entry.sourceFile}</span></div></header><div className="space-y-5 p-6">{blocks.map((block) => <section key={block.label + block.text} className="rounded-xl border border-space-700/45 bg-space-950/35 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><BookOpenCheck size={15} className="text-cyan-400" />{block.label}</div><StructuredText text={block.text} /></section>)}<section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ShieldCheck size={15} className="text-amber-300" />回答边界</div><p className="mt-2 text-xs leading-6 text-space-500">本回答仅重组该主题的 definition、summary、problem、steps 与 sections 字段，不补写性能数据、精度损失、硬件实测值或延迟 / 吞吐结论。</p></section>{related.length > 0 && <section><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-space-200"><Link2 size={16} className="text-violet-300" />相关知识主题</div><div className="flex flex-wrap gap-2">{related.map((item) => <button key={item.id} type="button" onClick={() => openEntry(item)} className="rounded-lg border border-space-700/55 bg-space-900/55 px-2.5 py-1.5 text-xs text-space-400 transition hover:border-violet-500/35 hover:text-violet-300">{item.title}</button>)}</div></section>}<section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ArrowRight size={16} className="text-emerald-400" />继续验证与探索</div><p className="mt-1 text-xs leading-relaxed text-space-500">从回答进入可视化、参数计算、方案对比或链路诊断。</p></div><div className="flex flex-wrap gap-2">{(LINKS[entry.id] || [['在互动全景图中继续检索', '/panorama', null, 'cyan']]).map(([label, path, state, linkTone]) => <button key={label} type="button" onClick={() => navigate(path, state ? { state } : undefined)} className={'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition ' + toneClasses(linkTone)}>{label}<ArrowUpRight size={13} /></button>)}</div></div></section>{result.matches.length > 1 && <section><div className="mb-3 flex items-center gap-2 text-sm font-semibold text-space-200"><ListChecks size={16} className="text-space-500" />其他候选主题</div><div className="grid gap-2 sm:grid-cols-2">{result.matches.slice(1).map((match) => <button key={match.entry.id} type="button" onClick={() => openEntry(match.entry)} className="flex items-center justify-between gap-3 rounded-xl border border-space-700/50 bg-space-950/30 px-3 py-2.5 text-left transition hover:border-violet-500/30"><span><span className="block text-xs font-medium text-space-300">{match.entry.title}</span><span className="mt-0.5 block line-clamp-1 text-[10px] text-space-600">{match.entry.summary}</span></span><ChevronRight size={14} className="shrink-0 text-space-600" /></button>)}</div></section>}</div><footer className="flex items-start gap-2 border-t border-space-700/45 bg-space-950/35 px-5 py-4 md:px-6"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-space-500" /><p className="text-[11px] leading-relaxed text-space-500">本页面使用本地 knowledge.json 完成检索与回答组装，未调用在线大模型 API；回答内容以知识库现有字段为准。</p></footer></motion.article>}

          {submitted && result && !result.direct && <motion.section key={submitted + '-fallback'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-space-900/85 to-space-950/70"><div className="border-b border-space-700/50 p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300"><CircleHelp size={20} /></span><div><Badge variant="amber">未形成明确主题命中</Badge><h2 className="mt-3 text-lg font-semibold text-space-100">暂不生成推断性答案</h2><p className="mt-2 text-sm leading-7 text-space-400">本地知识库没有足够明确的条目支持直接回答“{submitted}”。以下内容仅作为浏览入口，不代表对该问题的结论。</p></div></div></div><div className="p-6"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><BookOpenCheck size={16} className="text-cyan-400" />知识索引推荐</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{result.matches.map((match) => <button key={match.entry.id} type="button" onClick={() => openEntry(match.entry)} className="rounded-xl border border-space-700/50 bg-space-950/35 p-4 text-left transition hover:border-cyan-500/30 hover:bg-space-900/70"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-space-200">{match.entry.title}</span><ArrowUpRight size={14} className="text-space-600" /></div><p className="mt-2 line-clamp-2 text-xs leading-relaxed text-space-500">{match.entry.summary}</p><span className="mt-3 inline-flex items-center gap-1 text-[10px] text-space-600"><FileSearch size={11} />索引推荐 · 不构成回答</span></button>)}</div><div className="mt-5 rounded-xl border border-space-700/50 bg-space-950/35 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-space-300"><Lightbulb size={14} className="text-amber-300" />建议改写提问</div><p className="mt-2 text-xs leading-6 text-space-500">可使用“具体术语 + 作用 / 原因 / 区别 / 阶段”的结构，例如“为什么长上下文会增加 KV Cache 显存压力？”</p></div><button type="button" onClick={() => navigate('/panorama')} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300 transition hover:bg-cyan-500/20">打开完整互动全景图<ArrowRight size={13} /></button></div><footer className="flex items-start gap-2 border-t border-space-700/45 bg-space-950/35 px-6 py-4"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-space-500" /><p className="text-[11px] leading-relaxed text-space-500">兜底结果仅用于导航，不构成对当前问题的回答。</p></footer></motion.section>}
        </AnimatePresence>
      </section>

      <aside className="space-y-4"><GlowCard className="p-5" accent="cyan"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ListChecks size={16} className="text-cyan-400" />预设问题</div><span className="text-[10px] text-space-600">12 条</span></div><div className="mt-4 space-y-2">{PRESETS.slice(6).map(([label, id, tag, Icon, tone]) => <button key={id} type="button" onClick={() => openPreset([label, id])} className="flex w-full items-center gap-2 rounded-lg border border-space-700/45 bg-space-950/35 px-3 py-2.5 text-left transition hover:border-cyan-500/30"><Icon size={14} className="shrink-0 text-space-500" /><span className="min-w-0 flex-1"><span className="block truncate text-xs text-space-300">{label}</span><span className="mt-0.5 block text-[10px] text-space-600">{tag}</span></span><ArrowRight size={13} className="shrink-0 text-space-600" /></button>)}</div></GlowCard>
        <GlowCard className="p-5" accent="emerald"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><ShieldCheck size={16} className="text-emerald-400" />回答口径</div><ul className="mt-4 space-y-3 text-xs leading-6 text-space-500"><li className="flex gap-2"><CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-400" />只重组 knowledge.json 已记录字段。</li><li className="flex gap-2"><CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-400" />明确区分回答、证据和索引推荐。</li><li className="flex gap-2"><CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-400" />不展示无明确含义的检索分数。</li><li className="flex gap-2"><CheckCircle2 size={14} className="mt-1 shrink-0 text-emerald-400" />支持回到全景图、流水线、实验室、对比台和诊断台。</li></ul></GlowCard>
        <GlowCard className="p-5" accent="violet"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-semibold text-space-200"><MessageSquareText size={16} className="text-violet-300" />最近检索</div>{history.length > 0 && <button type="button" onClick={clearHistory} className="text-[10px] text-space-600 transition hover:text-space-300">清空</button>}</div>{history.length === 0 ? <p className="mt-4 text-xs leading-6 text-space-600">提交问题后，这里会保留最近 8 条本地记录。</p> : <div className="mt-3 space-y-1.5">{history.map((item) => <button key={item.id} type="button" onClick={() => openHistory(item)} className={'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ' + (activeHistoryId === item.id ? 'bg-violet-500/10 text-violet-200' : 'hover:bg-space-800/55')}><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/70" /><span className="min-w-0"><span className="block truncate text-xs text-space-400">{item.query}</span><span className="mt-1 block text-[10px] text-space-600">{item.title} · {formatDate(item.createdAt)}</span></span></button>)}</div>}</GlowCard>
      </aside>
    </div>
  </div>;
}
