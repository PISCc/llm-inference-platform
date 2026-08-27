import { createModelAdapter } from '../../agent/modelAdapter.js';

const TYPES = new Set(['title', 'key-message', 'process', 'comparison', 'diagnosis', 'summary']);
const SOURCE_TYPES = new Set(['answer', 'page', 'comparison', 'diagnosis']);
const THEMES = new Set(['platform-light', 'executive-dark', 'paper']);

function clip(value, max = 100) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function asInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function cleanLines(value) {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .split(/\r?\n|(?<=[。！？；])\s*/)
    .map((line) => clip(line.replace(/^[-*•\d.、)（(]+\s*/, ''), 100))
    .filter((line) => line.length >= 4);
}

function objectFacts(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const label = prefix ? prefix + ' · ' + key : key;
    if (item == null || item === '') return [];
    if (Array.isArray(item)) return item.length ? [clip(label + '：' + item.join('、'), 100)] : [];
    if (typeof item === 'object') return objectFacts(item, label);
    return [clip(label + '：' + item, 100)];
  });
}

function normalizedSources(source) {
  const seen = new Set();
  const supplied = Array.isArray(source?.sources) ? source.sources : [];
  const candidates = [
    ...supplied.map((item) => ({
      label: clip(item.title || item.label || item.id, 100),
      ...(item.url ? { url: clip(item.url, 500) } : {}),
    })),
    { label: clip(source?.pageContext?.pageTitle || source?.label || '当前平台上下文', 100) },
  ];
  return candidates.filter((item) => {
    if (!item.label || seen.has(item.label)) return false;
    seen.add(item.label);
    return true;
  }).slice(0, 8);
}

function sourceTypeOf(source) {
  if (source?.type === 'comparison' || source?.pageContext?.pageId === 'compare') return 'comparison';
  if (source?.type === 'diagnosis' || source?.pageContext?.pageId === 'diagnosis') return 'diagnosis';
  if (source?.type === 'page') return 'page';
  return 'answer';
}

function makeSlide(id, type, title, takeaway, bullets, sources, notes = []) {
  return {
    id,
    type,
    title: clip(title, 52) || '核心内容',
    takeaway: clip(takeaway, 140),
    bullets: bullets.map((item) => clip(item, 100)).filter(Boolean).slice(0, 5),
    notes: notes.map((item) => clip(item, 240)).filter(Boolean).slice(0, 6),
    sources,
  };
}

function deterministicSpec(input) {
  const source = input.source || {};
  const page = source.pageContext || {};
  const preferences = input.preferences || {};
  const sourceType = sourceTypeOf(source);
  const slideCount = asInteger(preferences.slideCount, 6, 3, 12);
  const title = clip(preferences.title || page.pageTitle || source.label || '大模型推理', 80);
  const answerLines = cleanLines(source.answer || source.content);
  const contextLines = [
    clip(page.visibleSummary, 100),
    ...objectFacts(page.selection, '当前选择'),
    ...objectFacts(page.parameters, '当前参数'),
    ...objectFacts(page.result, '当前结果'),
  ].filter(Boolean);
  const material = [...answerLines, ...contextLines].filter((item, index, list) => list.indexOf(item) === index);
  const sources = normalizedSources(source);
  const slides = [
    makeSlide('opening', 'title', title, clip(preferences.subtitle || material[0] || '整理当前内容，形成清晰演示。', 140), [], sources),
    makeSlide('central-message', 'key-message', '核心结论', material[0] || '当前材料聚焦大模型推理系统的机制与关键参数。', material.slice(1, 5), sources),
  ];

  if (sourceType === 'comparison') {
    slides.push(makeSlide(
      'comparison',
      'comparison',
      '方案差异与适用场景',
      '对比核心机制、优势、局限与实施条件。',
      material.slice(0, 5),
      sources,
    ));
  } else if (sourceType === 'diagnosis') {
    slides.push(makeSlide(
      'diagnosis-path',
      'diagnosis',
      '从现象定位可能原因',
      '按推理阶段整理观察、原因、检查步骤和处理方向。',
      [
        material[0] || '记录当前现象与观察项。',
        material[1] || '定位对应推理阶段与可能原因。',
        material[2] || '执行下一步检查并更新处理方向。',
      ],
      sources,
    ));
  } else {
    slides.push(makeSlide(
      'mechanism',
      'process',
      '沿推理链路展开',
      material[1] || '把输入、处理、状态变化与输出放在同一条逻辑链上。',
      material.slice(0, 5),
      sources,
    ));
  }

  let cursor = 3;
  while (slides.length < slideCount - 1) {
    const chunk = material.slice(cursor, cursor + 5);
    const fallback = ['补充关键参数与处理步骤。'];
    slides.push(makeSlide(
      'detail-' + (slides.length + 1),
      slides.length % 2 ? 'key-message' : 'process',
      slides.length % 2 ? '当前状态与关键结果' : '关键步骤与选择',
      chunk[0] || fallback[0],
      (chunk.length ? chunk : fallback).slice(0, 5),
      sources,
    ));
    cursor += 5;
  }
  slides.push(makeSlide(
    'closing',
    'summary',
    sourceType === 'diagnosis' ? '明确下一步检查' : '总结关键结论',
    sourceType === 'diagnosis'
      ? '围绕当前原因执行检查并更新处理方向。'
      : '回到当前页面复算参数、查看机制或继续比较方案。',
    [
      ...material.slice(-2),
    ],
    sources,
  ));

  return validatePresentationSpec({
    version: '1.0',
    meta: {
      title,
      subtitle: clip(preferences.subtitle || '', 120),
      audience: clip(preferences.audience || '技术同事', 60),
      durationMinutes: asInteger(preferences.durationMinutes, 10, 3, 60),
      theme: THEMES.has(preferences.theme) ? preferences.theme : 'platform-light',
      sourceType,
    },
    slides: slides.slice(0, slideCount),
  });
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型未返回 JSON。');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function validatePresentationSpec(input) {
  if (!input || typeof input !== 'object') throw Object.assign(new Error('PresentationSpec 必须是对象。'), { status: 400, code: 'INVALID_PRESENTATION_SPEC' });
  const meta = input.meta || {};
  const slides = Array.isArray(input.slides) ? input.slides : [];
  if (input.version !== '1.0' || slides.length < 3 || slides.length > 12) {
    throw Object.assign(new Error('PresentationSpec 版本或页数不符合要求。'), { status: 400, code: 'INVALID_PRESENTATION_SPEC' });
  }
  const sourceType = SOURCE_TYPES.has(meta.sourceType) ? meta.sourceType : 'answer';
  const theme = THEMES.has(meta.theme) ? meta.theme : 'platform-light';
  const seenIds = new Set();
  const normalizedSlides = slides.map((slide, index) => {
    const id = clip(slide.id || 'slide-' + (index + 1), 64).toLowerCase().replace(/[^a-z0-9-]+/g, '-') || 'slide-' + (index + 1);
    const uniqueId = seenIds.has(id) ? id + '-' + (index + 1) : id;
    seenIds.add(uniqueId);
    const sources = normalizedSources({ sources: slide.sources, label: '当前平台上下文' });
    return makeSlide(
      uniqueId,
      TYPES.has(slide.type) ? slide.type : (index === 0 ? 'title' : 'key-message'),
      slide.title,
      slide.takeaway,
      Array.isArray(slide.bullets) ? slide.bullets : [],
      sources,
      Array.isArray(slide.notes) ? slide.notes : [],
    );
  });
  return {
    version: '1.0',
    meta: {
      title: clip(meta.title, 80) || normalizedSlides[0].title,
      subtitle: clip(meta.subtitle, 120),
      audience: clip(meta.audience, 60) || '技术同事',
      durationMinutes: asInteger(meta.durationMinutes, 10, 3, 60),
      theme,
      sourceType,
    },
    slides: normalizedSlides,
  };
}

export async function createPresentationSpec(input, { env = process.env, modelConfig = null, signal } = {}) {
  const fallback = deterministicSpec(input);
  const adapter = createModelAdapter({ env, config: modelConfig });
  if (!adapter.config.configured) return { spec: fallback, mode: 'deterministic' };
  const material = JSON.stringify({
    source: input.source,
    preferences: input.preferences,
    fallbackStructure: fallback,
  }).slice(0, 24000);
  const messages = [
    {
      role: 'system',
      content: [
        '你负责为大模型推理技术说明生成 PresentationSpec JSON。',
        '只输出 JSON，不要 Markdown。',
        '保持当前页面数据与边界，不得编造性能、硬件、版本、精度或 benchmark。',
        '参数实验与方案对比中的容量结果不是实测性能；链路诊断中的原因只能表述为候选原因。',
        '每页一个主张，标题简洁，最多 5 条要点，每页 sources 至少一项。',
        '必须严格保留 version、meta、slides 结构与页数。',
      ].join('\n'),
    },
    { role: 'user', content: material },
  ];
  try {
    const response = await adapter.generateAnswer({ messages, signal });
    return { spec: validatePresentationSpec(extractJson(response.text)), mode: 'model' };
  } catch (error) {
    return { spec: fallback, mode: 'deterministic', warning: clip(error.message, 180) };
  }
}
