const formatNumber = (value, digits = 2) => (
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : null
);

function uniqueActions(actions) {
  const seen = new Set();
  return actions.filter((action) => {
    if (!action?.path || !action?.label) return false;
    const key = `${action.path}:${JSON.stringify(action.state || {})}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

export function buildContextInsight(pageContext = {}) {
  const selection = pageContext.selection || {};
  const parameters = pageContext.parameters || {};
  const result = pageContext.result || {};

  if (pageContext.pageId === 'panorama') {
    const module = selection.currentModule;
    if (module) {
      return [
        `当前全景图打开“${module.title}（${module.englishTitle || module.id}）”。`,
        module.summary,
        module.definition ? `定义：${module.definition}` : '',
        module.problem ? `解决的问题：${module.problem}` : '',
        module.related?.length ? `关联模块：${module.related.join('、')}。` : '',
      ].filter(Boolean).join('\n');
    }
    if (selection.searchQuery) {
      return `当前在全景图搜索“${selection.searchQuery}”，页面命中 ${result.searchResultCount ?? 0} 个模块。`;
    }
    return pageContext.visibleSummary || '';
  }

  if (pageContext.pageId === 'pipeline') {
    const branch = selection.cacheBranch === 'with-kv-cache'
      ? '已选择使用 KV Cache'
      : selection.cacheBranch === 'without-kv-cache'
        ? '已选择不使用 KV Cache'
        : '尚未选择 KV Cache 分支';
    const lines = [
      `当前流水线处于“${selection.stageLabel || pageContext.activeSection}”阶段：${selection.stageDescription || pageContext.visibleSummary}`,
      selection.question ? `演示问题：${selection.question}` : '',
      `Batch=${parameters.batchSize ?? 1}，输入 Token=${parameters.inputTokenCount ?? 0}，计划输出 Token=${parameters.plannedOutputTokenCount ?? 0}，${branch}。`,
    ];
    if (result.structuralStats) {
      lines.push(`当前分支结构计数：Prefill 输入片段 ${result.structuralStats.prefillTokens}，Decode 生成步数 ${result.structuralStats.decodeSteps}，相对历史处理量 ${result.structuralStats.relativeDecodeWork}，缓存 K/V 向量组 ${result.structuralStats.cachedVectors}。`);
    }
    return lines.filter(Boolean).join('\n');
  }

  if (pageContext.pageId === 'lab') {
    const kvGiB = formatNumber(result.kvCache?.kvCacheGB);
    const weightGiB = formatNumber(result.modelWeight);
    const ratio = formatNumber((result.kvCache?.kvMemoryRatio || 0) * 100, 1);
    const total = kvGiB != null && weightGiB != null
      ? formatNumber(Number(kvGiB) + Number(weightGiB))
      : null;
    const hasParameters = Object.keys(parameters).length > 0;
    return [
      `当前位于“${selection.tabLabel || pageContext.activeSection || pageContext.pageTitle || '参数实验室'}”。`,
      hasParameters ? `配置：${parameters.architecture || '未指定架构'}、${parameters.precision || '未指定精度'}、序列长度 ${parameters.seqLen ?? '未指定'}、Batch ${parameters.batchSize ?? '未指定'}。` : '',
      hasParameters ? `结构参数：Hidden Size ${parameters.hiddenSize ?? '未指定'}，层数 ${parameters.numLayers ?? '未指定'}，Q 头 ${parameters.numHeads ?? '未指定'}，KV 头 ${result.kvCache?.effectiveKVHeads ?? parameters.numKVHeads ?? '未指定'}。` : '',
      kvGiB != null ? `公式结果：KV Cache ${kvGiB} GiB，权重容量 ${weightGiB} GiB，二者合计 ${total} GiB；当前缓存约为同输入 MHA 基线的 ${ratio}%。` : '',
      (result.alerts || []).map((alert) => alert.msg).join('\n'),
    ].filter(Boolean).join('\n');
  }

  if (pageContext.pageId === 'compare') {
    const group = selection.comparisonGroup || selection.tab;
    if (group === 'scheduling' && selection.selectedOption) {
      const option = selection.selectedOption;
      return `当前选择“${option.name}”。优势：${option.advantage}；限制：${option.limitation}；适用条件：${option.fit}。`;
    }
    if (group === 'moe') {
      return `当前 MoE 配置包含 ${parameters.expertCount} 个专家、Top-${parameters.topK}，总参数 ${result.totalParams}B，单 Token 激活参数 ${result.activeParams}B，激活比例 ${formatNumber(result.activeRatio * 100, 1)}%。`;
    }
    if (group === 'quant') {
      return `当前选择 ${selection.selectedName}，参数量 ${parameters.parameterCountB}B，理论权重容量 ${formatNumber(result.theoreticalWeightGiB)} GiB，按单卡 ${parameters.gpuMemoryGiB} GiB 至少需要 ${result.theoreticalMinimumShards} 个权重分片。`;
    }
    return pageContext.visibleSummary || '';
  }

  if (pageContext.pageId === 'diagnosis') {
    const scenario = selection.scenario || {};
    const cause = result.selectedCause || {};
    const evidence = selection.selectedEvidence || [];
    const missing = result.unselectedEvidence || [];
    return [
      `当前症状：${scenario.title || ''}（${scenario.short || ''}）。${scenario.symptom || ''}`,
      evidence.length ? `已选观察：${evidence.map((item) => item.label).join('、')}。` : '当前尚未选择观察项。',
      `当前原因：“${cause.title || ''}”，位于${cause.stageLabel || cause.stage || '未指定'}阶段。${cause.reason || ''}`,
      cause.matchedEvidence?.length ? `相关观察：${cause.matchedEvidence.join('、')}。` : '',
      cause.verify?.length ? `下一步检查：${cause.verify.slice(0, 2).join('；')}` : '',
      missing.length ? `还可补充核对：${missing.slice(0, 3).map((item) => item.label).join('、')}。` : '',
    ].filter(Boolean).join('\n');
  }

  return pageContext.visibleSummary || '';
}

export function contextActionsForPage(pageContext = {}) {
  const selection = pageContext.selection || {};
  const result = pageContext.result || {};
  const actions = [];

  if (pageContext.pageId === 'panorama') {
    const moduleId = selection.currentModule?.id;
    if (['kv', 'mha', 'mla'].includes(moduleId)) actions.push({ label: '用当前结构计算 KV Cache', path: '/lab', state: { tab: 'kv' } });
    if (['prefill_decode', 'token', 'attn'].includes(moduleId)) actions.push({ label: '在流水线中观察', path: '/pipeline' });
    if (moduleId === 'mha') actions.push({ label: '进入 Attention 参数实验', path: '/lab', state: { tab: 'attn' } });
    if (['moe', 'quant', 'cb'].includes(moduleId)) actions.push({ label: '打开对应方案对比', path: '/compare', state: { tab: moduleId === 'moe' ? 'moe' : moduleId === 'quant' ? 'quant' : 'scheduling' } });
  }

  if (pageContext.pageId === 'pipeline') {
    const stageTargets = { tokenizing: 'token', prefill: 'prefill_decode', branch: 'kv', decoding: 'prefill_decode' };
    if (stageTargets[pageContext.activeSection]) actions.push({ label: '查看当前阶段知识', path: '/panorama', state: { moduleId: stageTargets[pageContext.activeSection] } });
    if (['branch', 'decoding', 'finished'].includes(pageContext.activeSection)) actions.push({ label: '复算当前 KV Cache 配置', path: '/lab', state: { tab: 'kv' } });
    if (pageContext.activeSection === 'finished') actions.push({ label: '诊断对应性能现象', path: '/diagnosis' });
  }

  if (pageContext.pageId === 'lab') {
    if (selection.tab === 'attn') actions.push({ label: '查看 Attention 机制', path: '/panorama', state: { moduleId: 'mha' } });
    if (selection.tab === 'kv') actions.push({ label: '查看 KV Cache 机制', path: '/panorama', state: { moduleId: 'kv' } });
    if (selection.tab === 'parallel') actions.push({ label: '查看并行策略全景', path: '/panorama', state: { moduleId: 'tp_pp_dp' } });
    if ((result.alerts || []).some((alert) => alert.type === 'warning')) actions.push({ label: '进入显存与链路诊断', path: '/diagnosis' });
  }

  if (pageContext.pageId === 'compare') {
    const group = selection.comparisonGroup || selection.tab;
    if (group === 'quant') actions.push({ label: '打开容量规划', path: '/lab', state: { tab: 'parallel' } });
    if (group === 'moe') actions.push({ label: '查看 MoE 技术全景', path: '/panorama', state: { moduleId: 'moe' } });
    if (group === 'scheduling') actions.push({ label: '在流水线中观察组批', path: '/pipeline' });
  }

  if (pageContext.pageId === 'diagnosis') {
    const cause = result.selectedCause || {};
    if (cause.panoramaId) actions.push({ label: `查看${cause.linkLabel || '相关技术'}`, path: '/panorama', state: { moduleId: cause.panoramaId } });
    if (cause.labTab) actions.push({ label: '用当前方向复算参数', path: '/lab', state: { tab: cause.labTab } });
    if (cause.compareTab) actions.push({ label: '打开相关方案对比', path: '/compare', state: { tab: cause.compareTab } });
  }

  return uniqueActions(actions);
}
