import knowledgeData from '../../src/data/knowledge.json' with { type: 'json' };
import { buildContextInsight } from '../../src/modules/agent/contextInsights.js';
import { clean, scoreEntry } from '../../src/modules/agent/knowledgeSearch.js';

const ALL_ENTRIES = knowledgeData.entries || [];
const SEARCH_ENTRIES = ALL_ENTRIES.filter(
  (entry) => entry.id !== '大模型推理知识库' && entry.category !== '90-智能体知识库',
);

const RELATED_ACTIONS = {
  'kv-cache': [{ label: '打开 KV Cache 全景模块', path: '/panorama', state: { moduleId: 'kv' } }, { label: '计算缓存容量', path: '/lab', state: { tab: 'kv' } }],
  'prefill-与-decode': [{ label: '观察推理流水线', path: '/pipeline' }, { label: '打开两阶段推理模块', path: '/panorama', state: { moduleId: 'prefill_decode' } }],
  性能指标: [{ label: '打开性能指标模块', path: '/panorama', state: { moduleId: 'metrics' } }, { label: '进入链路诊断台', path: '/diagnosis' }],
  mhamqagqa: [{ label: '打开 Attention 参数实验', path: '/lab', state: { tab: 'attn' } }],
  moe: [{ label: '对比 Dense 与 MoE', path: '/compare', state: { tab: 'moe' } }, { label: '打开 MoE 全景模块', path: '/panorama', state: { moduleId: 'moe' } }],
  量化: [{ label: '对比量化方案', path: '/compare', state: { tab: 'quant' } }, { label: '打开量化全景模块', path: '/panorama', state: { moduleId: 'quant' } }],
  scheduler: [{ label: '对比调度与组批', path: '/compare', state: { tab: 'scheduling' } }, { label: '进入链路诊断台', path: '/diagnosis' }],
  'batching-与-continuous-batching': [{ label: '对比调度与组批', path: '/compare', state: { tab: 'scheduling' } }, { label: '打开连续批处理模块', path: '/panorama', state: { moduleId: 'cb' } }],
  'prefix-cache': [{ label: '打开前缀缓存模块', path: '/panorama', state: { moduleId: 'prefix' } }, { label: '观察 Prefill 过程', path: '/pipeline' }],
  'cuda-graph': [{ label: '打开 CUDA Graph 模块', path: '/panorama', state: { moduleId: 'cudagraph' } }, { label: '进入链路诊断台', path: '/diagnosis' }],
  'memory-manager': [{ label: '打开显存管理模块', path: '/panorama', state: { moduleId: 'mm' } }, { label: '诊断显存 OOM', path: '/diagnosis' }],
  pagedattention: [{ label: '打开 PagedAttention 模块', path: '/panorama', state: { moduleId: 'paged' } }, { label: '诊断显存 OOM', path: '/diagnosis' }],
  flashattention: [{ label: '打开 FlashAttention 模块', path: '/panorama', state: { moduleId: 'flash' } }, { label: '打开 Attention 参数实验', path: '/lab', state: { tab: 'attn' } }],
};

function pageContextTerms(pageContext = {}) {
  const selection = pageContext.selection || {};
  const result = pageContext.result || {};
  return [
    pageContext.pageTitle,
    pageContext.activeSection,
    pageContext.visibleSummary,
    selection.currentModule?.title,
    selection.caseLabel,
    selection.tabLabel,
    selection.comparisonGroup,
    selection.scenario?.title,
    result.selectedCause?.title,
  ].filter(Boolean).join(' ');
}

function buildSnippet(entry) {
  const sections = entry.sections || {};
  const preferredKeys = ['一句话定义', '对比', '为什么需要多头', '解决什么问题', '工作原理', '区别', '关键点', '性能影响', '收益与代价'];
  const selectedSections = preferredKeys
    .filter((key) => sections[key])
    .slice(0, 3)
    .map((key) => `${key}：${clean(sections[key])}`);
  return clean([
    entry.definition || entry.summary,
    entry.problem,
    ...(entry.steps || []).slice(0, 4),
    ...selectedSections,
  ].filter(Boolean).join('\n')).slice(0, 2400);
}

export function retrieveKnowledge({ query, pageContext = {}, limit = 4 } = {}) {
  const expandedQuery = `${String(query || '')} ${pageContextTerms(pageContext)}`.trim();
  return SEARCH_ENTRIES
    .map((entry) => ({ entry, score: scoreEntry(entry, expandedQuery) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'zh-CN'))
    .slice(0, Math.max(1, Math.min(limit, 6)))
    .map(({ entry, score }) => ({
      id: entry.id,
      title: entry.title,
      category: entry.category,
      summary: clean(entry.summary),
      snippet: buildSnippet(entry),
      sourceFile: entry.sourceFile || '',
      score,
    }));
}

export function relatedActionsForSources(sources = []) {
  const seen = new Set();
  return sources.flatMap((source) => RELATED_ACTIONS[source.id] || []).filter((action) => {
    const key = `${action.path}:${JSON.stringify(action.state || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

export function buildOfflineAnswer({ query, pageContext = {}, sources = [] } = {}) {
  const contextInsight = buildContextInsight(pageContext);
  const pageLead = contextInsight ? `当前页面状态\n${contextInsight}\n\n` : '';
  if (!sources.length) {
    return {
      text: `${pageLead}暂无与“${String(query || '').trim()}”直接匹配的内容。可换用更具体的技术术语，或配置在线模型后继续提问。`,
      modelSupplementRequired: true,
    };
  }

  const sourceIds = new Set(sources.map((source) => source.id));
  if (sourceIds.has('mhamqagqa') && sourceIds.has('kv-cache')) {
    return {
      text: `${pageLead}GQA 通过让一组 Q 头共享同一套 K、V，减少需要保存的 K、V 头数量。KV Cache 只保存历史 K、V，因此 GQA 相比 MHA 需要保存的 K、V 向量更少。\n\nGQA 仍保留多组 K、V，是缓存成本与表达能力之间的折中。`,
      modelSupplementRequired: false,
    };
  }

  const evidence = sources.slice(0, 3).map((source) => (
    `**${source.title}**\n${source.summary}`
  )).join('\n\n');
  return {
    text: `${pageLead}${evidence}`,
    modelSupplementRequired: false,
  };
}
