export const normalize = (value) => String(value || '')
  .toLowerCase()
  .replace(/[\s`*_#\[\]（）()：:，,。.!！?？、/\\|\-]+/g, '');

export const clean = (value) => String(value || '')
  .replace(/```(?:text)?/gi, '')
  .replace(/```/g, '')
  .replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/^#{1,6}\s+/gm, '')
  .trim();

export const HINTS = {
  'kv cache': ['kv-cache'], kv缓存: ['kv-cache'], 缓存: ['kv-cache', 'prefix-cache', 'pagedattention', 'memory-manager'],
  prefill: ['prefill-与-decode', 'chunked-prefill', 'pd-分离'], decode: ['prefill-与-decode', '自回归生成', 'speculative-decoding'],
  ttft: ['性能指标', 'prefill-与-decode'], tpot: ['性能指标', 'prefill-与-decode'], 延迟: ['性能指标', 'prefill-与-decode'], 吞吐: ['性能指标', 'batching-与-continuous-batching'],
  batching: ['batching-与-continuous-batching'], batch: ['batching-与-continuous-batching'], 连续批处理: ['batching-与-continuous-batching'],
  mha: ['mhamqagqa'], mqa: ['mhamqagqa'], gqa: ['mhamqagqa'], attention: ['attention-机制', 'mhamqagqa', 'flashattention'], 注意力: ['attention-机制', 'mhamqagqa', 'flashattention'],
  moe: ['moe'], 专家: ['moe', 'expert', 'router-与-top-k-routing'], 量化: ['量化', '数据格式与精度', 'gptq-与-awq'],
  int8: ['量化', '数据格式与精度'], int4: ['量化', '数据格式与精度'],
  prefix: ['prefix-cache'], 前缀: ['prefix-cache'], cuda: ['cuda-graph'], graph: ['cuda-graph'],
  oom: ['memory-manager', 'pagedattention', '显存与带宽'], 显存: ['显存与带宽', 'memory-manager', 'kv-cache', 'pagedattention'],
  碎片: ['block-table-与显存碎片', 'pagedattention', 'memory-manager'], pagedattention: ['pagedattention'], flashattention: ['flashattention'],
  投机解码: ['speculative-decoding'], speculative: ['speculative-decoding'],
  token: ['token-与-token-id', 'tokenizer', '自回归生成'], tokenizer: ['tokenizer'],
  调度: ['scheduler', '请求准入抢占重排与负载均衡'], 并行: ['并行方式总览', 'tpppdp', 'epcpsp'],
};

export function entryCorpus(entry) {
  return [
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
}

export function scoreEntry(entry, rawQuery, {
  hints = HINTS,
  minScore = 20,
  corpusScoring = true,
} = {}) {
  const query = normalize(rawQuery);
  const rawLower = String(rawQuery || '').toLowerCase();
  const title = normalize(entry.title);
  const id = normalize(entry.id);
  const corpus = corpusScoring ? normalize(entryCorpus(entry)) : '';
  let score = 0;

  if (query && (query.includes(title) || query.includes(id) || title.includes(query) || id.includes(query))) score += 100;

  for (const alias of entry.aliases || []) {
    const aliasKey = normalize(alias);
    if (aliasKey.length >= 2 && query.includes(aliasKey)) score += 72;
  }

  for (const [term, ids] of Object.entries(hints)) {
    const termKey = normalize(term);
    if (termKey.length >= 2 && query.includes(termKey) && ids.includes(entry.id)) {
      score += Math.max(24, 52 - ids.indexOf(entry.id) * 8);
    }
  }

  const titleParts = [entry.title, ...(entry.aliases || []), ...(entry.tags || [])]
    .flatMap((value) => String(value).toLowerCase().split(/[\s、，,/与和及]+/))
    .map(normalize)
    .filter((part) => part.length >= 2);
  for (const part of titleParts) if (query.includes(part)) score += 20;

  if (corpusScoring) {
    const englishTokens = rawLower.match(/[a-z][a-z0-9-]{1,}/g) || [];
    for (const token of englishTokens) if (corpus.includes(normalize(token))) score += 10;
  }

  return score >= minScore ? score : 0;
}
