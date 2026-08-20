import knowledge from '../../data/knowledge.json';
import { buildContextInsight, contextActionsForPage } from './contextInsights.js';

const ENTRIES = (knowledge.entries || []).filter(
  (entry) => entry.id !== '大模型推理知识库' && entry.category !== '90-智能体知识库',
);

const HINTS = {
  'kv cache': ['kv-cache'], kv缓存: ['kv-cache'], 缓存: ['kv-cache', 'prefix-cache', 'pagedattention', 'memory-manager'],
  prefill: ['prefill-与-decode', 'chunked-prefill'], decode: ['prefill-与-decode', '自回归生成'],
  ttft: ['性能指标', 'prefill-与-decode'], tpot: ['性能指标', 'prefill-与-decode'], 吞吐: ['性能指标', 'batching-与-continuous-batching'],
  mha: ['mhamqagqa'], mqa: ['mhamqagqa'], gqa: ['mhamqagqa'], attention: ['attention-机制', 'mhamqagqa', 'flashattention'], 注意力: ['attention-机制', 'mhamqagqa', 'flashattention'],
  moe: ['moe'], 量化: ['量化', '数据格式与精度'], oom: ['memory-manager', 'pagedattention', '显存与带宽'], 显存: ['显存与带宽', 'memory-manager', 'kv-cache'],
  调度: ['scheduler', 'batching-与-continuous-batching'], 并行: ['并行方式总览', 'tpppdp', 'epcpsp'],
};

const ACTIONS = {
  'kv-cache': [{ label: '计算缓存容量', path: '/lab', state: { tab: 'kv' } }],
  'prefill-与-decode': [{ label: '观察推理流水线', path: '/pipeline' }],
  性能指标: [{ label: '进入链路诊断台', path: '/diagnosis' }],
  mhamqagqa: [{ label: '打开 Attention 参数实验', path: '/lab', state: { tab: 'attn' } }],
  moe: [{ label: '对比 Dense 与 MoE', path: '/compare', state: { tab: 'moe' } }],
  量化: [{ label: '对比量化方案', path: '/compare', state: { tab: 'quant' } }],
  'batching-与-continuous-batching': [{ label: '对比调度与组批', path: '/compare', state: { tab: 'scheduling' } }],
  'memory-manager': [{ label: '诊断显存 OOM', path: '/diagnosis' }],
};

const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[\s`*_#\[\]（）()：:，,。.!！?？、/\\|\-]+/g, '');

const clean = (value) => String(value || '')
  .replace(/```(?:text)?/gi, '')
  .replace(/```/g, '')
  .replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .trim();

function score(entry, query) {
  const normalizedQuery = normalize(query);
  const title = normalize(entry.title);
  const id = normalize(entry.id);
  let total = 0;
  if (normalizedQuery.includes(title) || normalizedQuery.includes(id)) total += 100;
  for (const alias of entry.aliases || []) {
    if (normalizedQuery.includes(normalize(alias))) total += 70;
  }
  for (const [term, ids] of Object.entries(HINTS)) {
    if (normalizedQuery.includes(normalize(term)) && ids.includes(entry.id)) total += 45;
  }
  for (const token of [entry.title, ...(entry.tags || [])]
    .flatMap((value) => String(value).split(/[\s、，,/与和及]+/))
    .map(normalize)
    .filter((value) => value.length >= 2)) {
    if (normalizedQuery.includes(token)) total += 18;
  }
  return total;
}

function snippet(entry) {
  const sections = entry.sections || {};
  const keys = ['一句话定义', '对比', '解决什么问题', '工作原理', '关键点', '收益与代价'];
  return clean([
    entry.definition || entry.summary,
    ...keys.filter((key) => sections[key]).slice(0, 3).map((key) => `${key}：${sections[key]}`),
  ].filter(Boolean).join('\n'));
}

export function buildLocalKnowledgeAnswer(query, pageContext = {}) {
  const expanded = `${query} ${pageContext.pageTitle || ''} ${pageContext.activeSection || ''}`;
  const sources = ENTRIES
    .map((entry) => ({ entry, score: score(entry, expanded) }))
    .filter((item) => item.score >= 18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ entry }) => ({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      summary: clean(entry.summary),
      sourceFile: entry.sourceFile || '',
      snippet: snippet(entry),
    }));

  const ids = new Set(sources.map((source) => source.id));
  const contextInsight = buildContextInsight(pageContext);
  let answer;
  if (ids.has('mhamqagqa') && ids.has('kv-cache')) {
    answer = 'GQA 让一组 Q 头共享同一套 K、V，减少需要保存的 K、V 头数量。KV Cache 只保存历史 K、V，容量与 KV 头数量直接相关，因此 GQA 相比每个头各自保存 K、V 的 MHA，需要保存的 K、V 向量更少。GQA 仍保留多组 K、V，是缓存成本与表达能力之间的折中。';
  } else if (sources.length) {
    answer = sources.slice(0, 2).map((source) => `${source.title}\n${source.summary}`).join('\n\n');
  } else {
    answer = `暂无与“${String(query).trim()}”直接匹配的内容。请换用更具体的技术术语，或配置在线模型后继续提问。`;
  }

  if (contextInsight) answer = `当前页面状态\n${contextInsight}\n\n${answer}`;

  const seen = new Set();
  const relatedActions = [
    ...contextActionsForPage(pageContext),
    ...sources.flatMap((source) => ACTIONS[source.id] || []),
  ].filter((action) => {
    const key = `${action.path}:${action.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);

  return {
    answer,
    meta: {
      mode: 'offline-fallback',
      sourceModes: [pageContext.pageId ? 'current-page' : null, sources.length ? 'project-knowledge' : null].filter(Boolean),
      sources,
      relatedActions,
      warning: { code: 'LOCAL_FALLBACK', message: '模型服务不可用，已使用本地知识回答。' },
    },
  };
}
