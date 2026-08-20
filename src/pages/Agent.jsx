import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Boxes,
  Braces,
  ChevronRight,
  CircleHelp,
  Cpu,
  Database,
  Gauge,
  FileSliders,
  Layers3,
  Lightbulb,
  Link2,
  ListChecks,
  MessageSquareText,
  Network,
  Send,
  Settings2,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import Badge from '../components/Badge.jsx';
import ProductHeader from '../components/ProductHeader.jsx';
import GlowCard from '../components/GlowCard.jsx';
import knowledge from '../data/knowledge.json';
import { useAgentSession } from '../context/AgentSessionContext.jsx';
import { usePptExport } from '../context/PptExportContext.jsx';
import { useModelConfig } from '../context/ModelConfigContext.jsx';
import AnswerContent from '../modules/agent/AnswerContent.jsx';

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[\s`*_#\[\]（）()：:，,。.!！?？、/\\|\-]+/g, '');

const clean = (value) => String(value || '')
  .replace(/```(?:text)?/gi, '')
  .replace(/```/g, '')
  .replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .trim();

const uniqueBy = (items = [], getKey) => {
  const seen = new Set();
  return items.filter((item, index) => {
    const key = String(getKey(item, index) || `item-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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
const toneClasses = (tone) => ({
  cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20',
  violet: 'border-violet-500/25 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20',
  emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20',
}[tone] || 'border-space-700/60 bg-space-900/60 text-space-300 hover:bg-space-800/70');

const entryCorpus = (entry) => [
  entry.id,
  entry.title,
  entry.summary,
  entry.definition,
  entry.problem,
  ...(entry.aliases || []),
  ...(entry.tags || []),
  ...(entry.related || []),
  ...Object.keys(entry.sections || {}),
  ...Object.values(entry.sections || {}),
].join(' ');

function scoreEntry(entry, rawQuery) {
  const query = normalize(rawQuery);
  const rawLower = String(rawQuery || '').toLowerCase();
  const title = normalize(entry.title);
  const id = normalize(entry.id);
  const corpus = normalize(entryCorpus(entry));
  let score = 0;

  if (query && (query.includes(title) || query.includes(id) || title.includes(query) || id.includes(query))) {
    score += 100;
  }

  for (const alias of entry.aliases || []) {
    const aliasKey = normalize(alias);
    if (aliasKey.length >= 2 && query.includes(aliasKey)) score += 72;
  }

  for (const [term, ids] of Object.entries(HINTS)) {
    const termKey = normalize(term);
    if (termKey.length >= 2 && query.includes(termKey) && ids.includes(entry.id)) {
      score += Math.max(24, 52 - ids.indexOf(entry.id) * 8);
    }
  }

  const titleParts = [entry.title, ...(entry.aliases || []), ...(entry.tags || [])]
    .flatMap((value) => String(value).toLowerCase().split(/[\s、，,/与和及]+/))
    .map(normalize)
    .filter((part) => part.length >= 2);

  for (const part of titleParts) {
    if (query.includes(part)) score += 20;
  }

  const englishTokens = rawLower.match(/[a-z][a-z0-9-]{1,}/g) || [];
  for (const token of englishTokens) {
    if (corpus.includes(normalize(token))) score += 10;
  }

  return score >= 20 ? { entry, score } : null;
}

export function retrieve(query, forcedId = null) {
  if (forcedId && ENTRY_BY_ID.has(forcedId)) {
    return { direct: true, matches: [{ entry: ENTRY_BY_ID.get(forcedId), score: 1000 }] };
  }

  const ranked = SEARCH_ENTRIES
    .map((entry) => scoreEntry(entry, query))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'zh-CN'));
  const matches = ranked.slice(0, 4);

  if (matches.length) return { direct: true, matches };

  return {
    direct: false,
    matches: FALLBACK_IDS
      .map((id) => ENTRY_BY_ID.get(id))
      .filter(Boolean)
      .map((entry) => ({ entry, score: 0 })),
  };
}

function answerBlocks(entry) {
  const sections = entry.sections || {};
  const preferred = ['解决什么问题', '区别', '对比', '工作原理', '关键点', '收益与代价', '为什么占显存', '为什么快', '核心指标', '尾延迟', '原理', '两种量化', '收益'];
  const keys = preferred
    .filter((key) => sections[key])
    .concat(Object.keys(sections).filter((key) => !preferred.includes(key)));
  const blocks = [];
  const seen = new Set();

  const push = (label, value) => {
    const text = clean(value);
    if (!text || seen.has(text)) return;
    seen.add(text);
    blocks.push({ label, text });
  };

  push('定义', entry.definition || sections['一句话定义'] || entry.summary);
  push('解决的问题', entry.problem);
  (entry.steps || []).filter((step) => clean(step)).forEach((step, index) => push(`流程步骤 ${index + 1}`, step));
  keys.slice(0, 5).forEach((key) => push(key, sections[key]));
  return blocks.slice(0, 8);
}

function relatedEntries(entry) {
  return (entry.related || [])
    .map((ref) => ENTRY_BY_KEY.get(normalize(ref)) || ENTRY_BY_ID.get(ref))
    .filter(Boolean)
    .filter((item, index, list) => item.id !== entry.id && list.findIndex((other) => other.id === item.id) === index)
    .slice(0, 6);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function Stat({ value, label, tone = 'cyan' }) {
  return (
    <div className={`rounded-xl border px-3 py-3 ${toneClasses(tone)}`}>
      <div className="text-lg font-semibold text-space-100">{value}</div>
      <div className="mt-1 text-[11px] text-space-400">{label}</div>
    </div>
  );
}
export default function Agent() {
  const navigate = useNavigate();
  const {
    turns,
    activeTurn,
    activeTurnId,
    ask,
    selectTurn,
    clearActive,
    clearConversation,
  } = useAgentSession();
  const { openPptExport } = usePptExport();
  const { open: openModelConfig, status: modelStatus, loading: modelStatusLoading } = useModelConfig();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [forcedId, setForcedId] = useState(null);
  const hydratedTurnRef = useRef(null);
  const history = useMemo(() => [...turns].reverse().map((turn) => ({
    ...turn,
    title: turn.pageTitle || '自由提问',
  })), [turns]);
  const activeHistoryId = activeTurnId;
  const onlineAnswer = activeTurn?.answer || '';
  const onlineStatus = activeTurn?.status || 'idle';
  const onlineMeta = activeTurn?.meta || null;

  const result = useMemo(
    () => (submitted ? retrieve(submitted, forcedId) : null),
    [submitted, forcedId],
  );
  const entry = result?.direct ? result.matches[0]?.entry || null : null;
  const blocks = entry ? answerBlocks(entry) : [];
  const related = entry ? relatedEntries(entry) : [];
  const moduleLinks = entry ? (LINKS[entry.id] || []) : [];
  const useLocalResult = !onlineAnswer && ['idle', 'offline', 'error'].includes(onlineStatus);

  useEffect(() => {
    if (!activeTurn || hydratedTurnRef.current === activeTurn.id) return;
    hydratedTurnRef.current = activeTurn.id;
    setQuery(activeTurn.query);
    setSubmitted(activeTurn.query);
    setForcedId(null);
  }, [activeTurn]);

  const submit = (nextQuery = query, nextForcedId = forcedId) => {
    const value = String(nextQuery || '').trim();
    if (!value) return;
    setQuery(value);
    setSubmitted(value);
    setForcedId(nextForcedId);
    ask(value);
  };

  const openPreset = (preset) => submit(preset[0], preset[1]);
  const openHistory = (item) => {
    setQuery(item.query);
    setSubmitted(item.query);
    setForcedId(item.forcedId);
    selectTurn(item.id);
  };
  const clearHistory = () => {
    clearConversation();
    setSubmitted('');
    setQuery('');
    setForcedId(null);
  };
  const openEntry = (nextEntry) => submit(`什么是${nextEntry.title}？`, nextEntry.id);
  const openLink = ([, path, state]) => navigate(path, state ? { state } : undefined);
  const modelStatusTitle = modelStatusLoading
    ? '正在读取模型配置'
    : modelStatus.configured
      ? `${modelStatus.source === 'session' ? '会话模型' : modelStatus.isFreeDefault ? '免费默认模型' : '部署默认'}：${modelStatus.model}`
      : '当前使用本地知识降级';
  const modelStatusDetail = modelStatus.configured
    ? `${modelStatus.provider === 'groq' ? 'Groq' : modelStatus.provider || '兼容接口'} · ${modelStatus.baseUrl || ''}`
    : '填写 API Key、服务地址和模型名称即可启用在线回答。';

  return (
    <div className="agent-workbench space-y-5 pb-10">
      <ProductHeader
        title="AI 技术问答"
        subtitle="询问推理概念、指标、阶段与方案，并跳转到相关模块。"
        accent="violet"
        badges={[
          { label: '离线可用', variant: 'emerald' },
          { label: '模块联动', variant: 'slate' },
        ]}
      />

      <div className="agent-task-workspace">
        <aside className="agent-source-rail">
      <div className="agent-statusbar">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${modelStatus.configured ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.45)]' : 'bg-space-600'}`} />
          <div className="min-w-0">
            <div className="text-xs font-medium text-space-300">{modelStatusTitle}</div>
            <div className="mt-0.5 truncate text-[10px] text-space-600">{modelStatusDetail}</div>
          </div>
        </div>
        <button type="button" onClick={openModelConfig} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/[0.08] px-3 py-2 text-xs font-medium text-cyan-600 transition hover:bg-cyan-500/[0.14]"><Settings2 size={14} />配置模型</button>
      </div>
      <div className="agent-intro-strip">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/30 bg-violet-500/15 text-violet-300">
              <Bot size={25} />
            </div>
            <div>
              <div className="text-sm font-semibold text-space-200">智能技术问答</div>
              <div className="mt-1 text-xs text-space-500">问题 → 回答 → 探索</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 md:w-[min(100%,360px)]">
            {['提问', '回答', '探索'].map((label, index) => (
              <div key={label} className="rounded-xl border border-space-700/55 bg-space-950/45 px-2 py-2.5 text-center">
                <div className="text-[10px] font-semibold text-violet-300">0{index + 1}</div>
                <div className="mt-1 text-[10px] text-space-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="agent-context-stats">
        <Stat value={SEARCH_ENTRIES.length} label="技术主题" tone="cyan" />
        <Stat value={PRESETS.length} label="快捷问题" tone="violet" />
        <Stat value="5" label="可联动模块" tone="emerald" />
      </div>

        </aside>
        <main className="agent-conversation">
          <GlowCard className="p-5" accent="violet">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-space-200">
                  <MessageSquareText size={17} className="text-violet-300" />
                  提出技术问题
                </div>
                <p className="mt-1 text-xs text-space-500">输入术语、指标或推理阶段。</p>
              </div>
              <Badge variant="slate">{query.length}/200</Badge>
            </div>
            <form className="mt-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
              <div className="relative">
                <textarea
                  value={query}
                  maxLength={200}
                  onChange={(event) => { setQuery(event.target.value); setForcedId(null); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="例如：为什么 TTFT 会变高？"
                  aria-label="输入技术问题"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-space-700/70 bg-space-950/75 px-4 py-3 pr-14 text-sm leading-6 text-space-200 outline-none transition placeholder:text-space-600 focus:border-violet-400/50 focus:ring-2 focus:ring-violet-500/10"
                />
                <button
                  type="submit"
                  aria-label="提交问题"
                  className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/20 text-violet-200 transition hover:bg-violet-500/35 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!query.trim()}
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="mt-2 text-[11px] text-space-600">Enter 提交 · Shift+Enter 换行 · 最多 200 字</div>
            </form>
          </GlowCard>

          <AnimatePresence mode="wait">
            {!submitted && (
              <motion.section
                key="empty"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-space-700/50 bg-space-900/55 p-6"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300">
                    <Sparkles size={19} />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-space-100">从一个技术问题开始</h2>
                    <p className="mt-2 text-sm leading-7 text-space-500">你可以询问概念定义、工作阶段、性能指标、方案差异或常见问题。</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  {[
                    ['概念定义', 'KV Cache 是什么？'],
                    ['阶段分析', '为什么 Prefill 变慢？'],
                    ['指标解释', 'TTFT 与 TPOT 有什么区别？'],
                  ].map(([label, example]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => submit(example)}
                      className="rounded-xl border border-space-700/55 bg-space-950/35 px-3 py-3 text-left transition hover:border-cyan-500/30"
                    >
                      <span className="block text-[10px] text-space-600">{label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-space-400">{example}</span>
                    </button>
                  ))}
                </div>
              </motion.section>
            )}

            {submitted && ['connecting', 'streaming'].includes(onlineStatus) && !onlineAnswer && (
              <motion.section
                key={`online-loading-${submitted}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-violet-500/20 bg-space-900/65 p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-500/10 text-violet-300">
                    <Bot size={19} className="animate-pulse" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-space-200">正在生成回答…</div>
                  </div>
                </div>
              </motion.section>
            )}

            {submitted && onlineAnswer && (
              <motion.article
                key={`online-${submitted}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-violet-500/25 bg-gradient-to-br from-space-900/90 to-space-950/75"
              >
                <header className="border-b border-space-700/50 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={onlineMeta?.mode === 'model' ? 'violet' : 'amber'}>
                        {onlineMeta?.mode === 'model' ? '大模型回答' : '本地知识回答'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openPptExport({
                          title: submitted,
                          answer: onlineAnswer,
                          sources: onlineMeta?.sources || [],
                        })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.08] px-2.5 py-1.5 text-xs text-violet-500 transition hover:bg-violet-500/[0.14]"
                      >
                        <FileSliders size={14} />生成 PPT
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitted('');
                          setQuery('');
                          setForcedId(null);
                          clearActive();
                        }}
                        className="inline-flex items-center gap-1.5 text-xs text-space-600 transition hover:text-space-300"
                      >
                        <X size={14} />清除回答
                      </button>
                    </div>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight text-space-100">{submitted}</h2>
                  {onlineMeta?.model?.model && (
                    <p className="mt-2 text-[11px] text-space-600">模型：{onlineMeta.model.model}</p>
                  )}
                </header>

                <div className="space-y-4 p-6">
                  <section className="rounded-xl border border-space-700/50 bg-space-950/35 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-space-300">
                      <MessageSquareText size={14} className="text-violet-300" />回答
                    </div>
                    <AnswerContent text={onlineAnswer} className="mt-3" />
                  </section>

                  {(onlineMeta?.relatedActions || []).length > 0 && (
                    <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                        <ArrowUpRight size={14} />继续探索
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {uniqueBy(onlineMeta.relatedActions, (action) => `${action.path}-${action.label}`).map((action, index) => (
                          <button
                            key={`${action.path}-${action.label}-${index}`}
                            type="button"
                            onClick={() => navigate(action.path, action.state ? { state: action.state } : undefined)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            {action.label}<ArrowRight size={13} />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </motion.article>
            )}

            {submitted && useLocalResult && result?.direct && entry && (
              <motion.article
                key={`${submitted}-${entry.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-space-900/90 to-space-950/75"
              >
                <header className="border-b border-space-700/50 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="cyan">相关主题</Badge>
                    <button
                      type="button"
                      onClick={() => { setSubmitted(''); setQuery(''); setForcedId(null); }}
                      className="inline-flex items-center gap-1.5 text-xs text-space-600 transition hover:text-space-300"
                    >
                      <X size={14} />清除回答
                    </button>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-space-100">{entry.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-space-400">{clean(entry.summary)}</p>
                </header>

                <div className="space-y-4 p-6">
                  {blocks.map((block, index) => (
                    <section key={`${block.label}-${index}`} className="rounded-xl border border-space-700/50 bg-space-950/35 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-space-300">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-500/10 text-[10px] text-cyan-300">{index + 1}</span>
                        {block.label}
                      </div>
                      <AnswerContent text={block.text} className="mt-3" />
                    </section>
                  ))}

                  {related.length > 0 && (
                    <section className="rounded-xl border border-space-700/50 bg-space-950/35 p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold text-space-300">
                        <Link2 size={14} className="text-violet-300" />相关主题
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {related.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => openEntry(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-space-700/60 bg-space-900/65 px-2.5 py-1.5 text-xs text-space-400 transition hover:border-violet-500/30 hover:text-violet-200"
                          >
                            {item.title}<ChevronRight size={12} />
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                      <ArrowUpRight size={14} />继续探索
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {moduleLinks.map((link) => (
                        <button
                          key={link[0]}
                          type="button"
                          onClick={() => openLink(link)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition ${toneClasses(link[3])}`}
                        >
                          {link[0]}<ArrowRight size={13} />
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => navigate('/panorama')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-space-700/60 bg-space-900/65 px-3 py-2 text-xs text-space-400 transition hover:border-cyan-500/30 hover:text-cyan-200"
                      >
                        浏览互动全景图<ArrowRight size={13} />
                      </button>
                    </div>
                  </section>
                </div>
              </motion.article>
            )}

            {submitted && useLocalResult && result && !result.direct && (
              <motion.section
                key={`fallback-${submitted}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-amber-500/20 bg-space-900/65"
              >
                <div className="p-6">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300">
                      <CircleHelp size={19} />
                    </span>
                    <div>
                      <Badge variant="amber">暂无匹配结果</Badge>
                      <h2 className="mt-3 text-xl font-semibold text-space-100">试试相关主题</h2>
                      <p className="mt-2 text-sm leading-7 text-space-500">可选择相关主题，或调整问题中的技术术语。</p>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-space-300">
                    <Sparkles size={14} className="text-cyan-400" />相关主题
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {result.matches.map((match) => (
                      <button
                        key={match.entry.id}
                        type="button"
                        onClick={() => openEntry(match.entry)}
                        className="rounded-xl border border-space-700/50 bg-space-950/35 p-4 text-left transition hover:border-cyan-500/30 hover:bg-space-900/70"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-space-200">{match.entry.title}</span>
                          <ArrowUpRight size={14} className="text-space-600" />
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-space-500">{clean(match.entry.summary)}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-[10px] text-cyan-400">查看主题<ArrowRight size={11} /></span>
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-xl border border-space-700/50 bg-space-950/35 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-space-300">
                      <Lightbulb size={14} className="text-amber-300" />建议改写提问
                    </div>
                    <p className="mt-2 text-xs leading-6 text-space-500">可使用“具体术语 + 作用 / 原因 / 区别 / 阶段”的结构，例如“为什么长上下文会增加 KV Cache 显存压力？”</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/panorama')}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300 transition hover:bg-cyan-500/20"
                  >
                    打开完整互动全景图<ArrowRight size={13} />
                  </button>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </main>

        <aside className="agent-context-inspector">
          <GlowCard className="p-5" accent="cyan">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-space-200">
                <ListChecks size={16} className="text-cyan-400" />快捷问题
              </div>
              <span className="text-[10px] text-space-600">12 条</span>
            </div>
            <div className="mt-4 space-y-2">
              {PRESETS.slice(6).map(([label, id, tag, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openPreset([label, id])}
                  className="flex w-full items-center gap-2 rounded-lg border border-space-700/45 bg-space-950/35 px-3 py-2.5 text-left transition hover:border-cyan-500/30"
                >
                  <Icon size={14} className="shrink-0 text-space-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-space-300">{label}</span>
                    <span className="mt-0.5 block text-[10px] text-space-600">{tag}</span>
                  </span>
                  <ArrowRight size={13} className="shrink-0 text-space-600" />
                </button>
              ))}
            </div>
          </GlowCard>

          <GlowCard className="p-5" accent="emerald">
            <div className="flex items-center gap-2 text-sm font-semibold text-space-200">
              <Sparkles size={16} className="text-emerald-400" />推荐探索
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ['流水线', '/pipeline'],
                ['参数实验', '/lab'],
                ['方案对比', '/compare'],
                ['链路诊断', '/diagnosis'],
              ].map(([label, path]) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => navigate(path)}
                  className="rounded-lg border border-space-700/55 bg-space-950/35 px-3 py-2 text-xs text-space-400 transition hover:border-emerald-500/30 hover:text-emerald-200"
                >
                  {label}
                </button>
              ))}
            </div>
          </GlowCard>

          <GlowCard className="p-5" accent="violet">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-space-200">
                <MessageSquareText size={16} className="text-violet-300" />最近提问
              </div>
              {history.length > 0 && (
                <button type="button" onClick={clearHistory} className="text-[10px] text-space-600 transition hover:text-space-300">清空</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="mt-4 text-xs leading-6 text-space-600">提交问题后，这里会保留最近 8 条记录。</p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openHistory(item)}
                    className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${activeHistoryId === item.id ? 'bg-violet-500/10 text-violet-200' : 'hover:bg-space-800/55'}`}
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400/70" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-space-400">{item.query}</span>
                      <span className="mt-1 block text-[10px] text-space-600">{item.title} · {formatDate(item.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </GlowCard>
        </aside>
      </div>
    </div>
  );
}

