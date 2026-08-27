import knowledge from '../../data/knowledge.json';
import { buildContextInsight, contextActionsForPage } from './contextInsights.js';
import { clean, scoreEntry } from './knowledgeSearch.js';

const ENTRIES = (knowledge.entries || []).filter(
  (entry) => entry.id !== '大模型推理知识库' && entry.category !== '90-智能体知识库',
);

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
    .map((entry) => ({ entry, score: scoreEntry(entry, expanded, { minScore: 18 }) }))
    .filter((item) => item.score > 0)
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
