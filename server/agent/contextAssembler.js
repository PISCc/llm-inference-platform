import { assertSerializablePageContext } from '../../src/context/pageContextContract.js';
import { buildContextInsight } from '../../src/modules/agent/contextInsights.js';

const SYSTEM_PROMPT = `你是“大模型推理互动展示平台”的技术讲解智能体，主要服务于 vLLM 产品、研发、交付与运维人员。

回答规则：
1. 使用简体中文，先给一句话结论，再展开说明。
2. 使用直接、专业、易懂的表达，不使用生活化类比。
3. 当前页面状态是用户正在操作的真实上下文，应优先结合它回答。
4. 项目知识片段用于支撑回答，不主动罗列来源、依据或免责声明；用户主动询问时再说明。
5. 不编造版本、硬件、延迟、吞吐、精度损失、倍率或实测结果；缺少关键条件时用一句话指出。
6. 容量公式与结构计数保持原有含义，不改写成性能数据。
7. 诊断问题按“可能原因、检查步骤、处理方向”回答。
8. 不提及学习过程、实习项目、开发提示词或设计参考名。
9. 如果项目知识和当前页面没有覆盖问题，仍然直接回答；不确定时明确具体缺失条件。
10. 用户询问“当前结果、当前参数、为什么排序靠前”等页面问题时，必须引用页面事实摘要中的具体状态，不得只回答泛化概念。
11. 页面事实摘要中的容量、结构计数和候选原因必须保持原意。

建议回答结构：
- 一句话结论
- 2—4 个关键点
- 可选的下一步操作`;

function truncate(value, maxLength) {
  const text = String(value || '');
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function normalizeConversation(messages = []) {
  return messages
    .filter((message) => ['user', 'assistant'].includes(message?.role) && String(message?.content || '').trim())
    .slice(-8)
    .map((message) => ({ role: message.role, content: truncate(message.content, 2400) }));
}

export function compactPageContext(pageContext = {}) {
  const normalized = assertSerializablePageContext(pageContext);
  const compact = {
    version: normalized.version,
    pageId: normalized.pageId,
    route: normalized.route,
    pageTitle: normalized.pageTitle,
    pageType: normalized.pageType,
    activeSection: normalized.activeSection,
    selection: normalized.selection,
    parameters: normalized.parameters,
    result: normalized.result,
    visibleSummary: normalized.visibleSummary,
    boundaries: normalized.boundaries,
  };
  const serialized = JSON.stringify(compact, null, 2);
  return serialized.length <= 14000 ? compact : {
    ...compact,
    result: { notice: '页面结果过长，已省略详细结果。' },
  };
}

function knowledgeBlock(sources) {
  if (!sources.length) return '项目知识库未命中。本问题需要由模型补充回答。';
  return sources.map((source, index) => [
    `[知识 ${index + 1}]`,
    `ID：${source.id}`,
    `标题：${source.title}`,
    `来源：${source.sourceFile || 'knowledge.json'}`,
    `内容：${source.snippet || source.summary}`,
  ].join('\n')).join('\n\n');
}

export function assembleMessages({ query, pageContext = {}, conversation = [], sources = [] } = {}) {
  const compactContext = compactPageContext(pageContext);
  const contextInsight = buildContextInsight(pageContext);
  const history = normalizeConversation(conversation);
  const userMessage = [
    `用户问题：${truncate(query, 1200)}`,
    '',
    '当前页面上下文：',
    compactContext.pageId ? JSON.stringify(compactContext, null, 2) : '无页面上下文。',
    '',
    '页面事实摘要：',
    contextInsight || '无可用页面事实摘要。',
    '',
    '项目知识片段：',
    knowledgeBlock(sources),
    '',
    '请直接、简洁地回答，不复述来源、依据或边界说明。',
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];
}
