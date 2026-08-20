import PptxGenJS from 'pptxgenjs';
import { validatePresentationSpec } from './presentationSpec.js';

const PX_PER_INCH = 96;
const FONT_FACE = 'Microsoft YaHei';

const PALETTES = {
  'platform-light': {
    bg: 'F4F1EB', ink: '2F2A24', muted: '71695F', line: 'D8D1C7',
    primary: '365F75', secondary: '695C84', good: '47705D', warm: 'A46D3B',
  },
  'executive-dark': {
    bg: '171A1F', ink: 'F4F1EA', muted: 'A9ADB5', line: '343943',
    primary: '69B6D6', secondary: 'A693D3', good: '79B994', warm: 'D7A15E',
  },
  paper: {
    bg: 'FAFAF7', ink: '202020', muted: '66645F', line: 'D9D7D1',
    primary: '3E6575', secondary: '72617E', good: '52705D', warm: '9A6B3F',
  },
};

function inch(value) {
  return Number((value / PX_PER_INCH).toFixed(4));
}

function safeFilename(value) {
  const name = String(value || 'llm-inference-briefing')
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return (name || 'llm-inference-briefing') + '.pptx';
}

function addShape(pptx, slide, {
  geometry = 'rect', left, top, width, height, fill, line = null, radius = false,
}) {
  const shapeType = geometry === 'ellipse'
    ? pptx.ShapeType.ellipse
    : radius
      ? pptx.ShapeType.roundRect
      : pptx.ShapeType.rect;
  slide.addShape(shapeType, {
    x: inch(left), y: inch(top), w: inch(width), h: inch(height),
    fill: { color: fill },
    line: line ? { color: line, width: 1 } : { color: fill, transparency: 100 },
  });
}

function addText(slide, colors, {
  text, left, top, width, height, size = 20, color = colors.ink,
  bold = false, align = 'left', valign = 'top', margin = 0,
}) {
  slide.addText(String(text || ''), {
    x: inch(left), y: inch(top), w: inch(width), h: inch(height),
    fontFace: FONT_FACE,
    fontSize: size,
    color,
    bold,
    align,
    valign,
    margin,
    breakLine: false,
    fit: 'shrink',
    lang: 'zh-CN',
  });
}

function addChrome(pptx, slide, colors, index) {
  slide.background = { color: colors.bg };
  addShape(pptx, slide, { left: 72, top: 54, width: 1136, height: 3, fill: colors.primary });
  addText(slide, colors, {
    text: 'LLM INFERENCE LAB', left: 72, top: 20, width: 360, height: 24,
    size: 13, color: colors.muted, bold: true,
  });
  addText(slide, colors, {
    text: String(index + 1).padStart(2, '0'), left: 1135, top: 676, width: 72,
    height: 22, size: 13, color: colors.muted, align: 'right',
  });
}

function addTitle(slide, colors, item) {
  addText(slide, colors, {
    text: item.title, left: 72, top: 84, width: 1080, height: 62, size: 38, bold: true,
  });
  if (item.takeaway) {
    addText(slide, colors, {
      text: item.takeaway, left: 72, top: 151, width: 1050, height: 62,
      size: 24, color: colors.primary, bold: true,
    });
  }
}

function addBulletList(pptx, slide, colors, bullets, {
  left = 92, top = 258, width = 1030, gap = 72, accent = colors.primary,
} = {}) {
  bullets.slice(0, 5).forEach((bullet, bulletIndex) => {
    addShape(pptx, slide, {
      geometry: 'ellipse', left, top: top + bulletIndex * gap + 9,
      width: 12, height: 12, fill: accent,
    });
    addText(slide, colors, {
      text: bullet, left: left + 30, top: top + bulletIndex * gap,
      width: width - 30, height: 52, size: 22,
    });
  });
}

function addStandardSlide(pptx, slide, colors, item, index) {
  addChrome(pptx, slide, colors, index);
  addTitle(slide, colors, item);

  if (item.type === 'comparison') {
    const splitAt = Math.ceil(item.bullets.length / 2);
    const halves = [item.bullets.slice(0, splitAt), item.bullets.slice(splitAt)];
    halves.forEach((bullets, column) => {
      const left = 72 + column * 580;
      const accent = column ? colors.secondary : colors.primary;
      addShape(pptx, slide, { left, top: 254, width: 506, height: 2, fill: accent });
      addText(slide, colors, {
        text: column ? '方案 B · 适用边界' : '方案 A · 核心机制',
        left, top: 220, width: 506, height: 28, size: 18, color: accent, bold: true,
      });
      addBulletList(pptx, slide, colors, bullets, {
        left, top: 282, width: 506, gap: 86, accent,
      });
    });
    return;
  }

  if (item.type === 'diagnosis') {
    const labels = ['现象与证据', '候选原因', '验证路径'];
    const accents = [colors.primary, colors.warm, colors.good];
    item.bullets.slice(0, 3).forEach((bullet, column) => {
      const left = 72 + column * 386;
      addText(slide, colors, {
        text: labels[column], left, top: 250, width: 338, height: 34,
        size: 20, color: accents[column], bold: true,
      });
      addShape(pptx, slide, { left, top: 292, width: 338, height: 3, fill: accents[column] });
      addText(slide, colors, {
        text: bullet, left, top: 320, width: 338, height: 190, size: 22,
      });
    });
    if (item.bullets.length > 3) {
      addText(slide, colors, {
        text: item.bullets.slice(3).join('；'), left: 72, top: 570,
        width: 1110, height: 58, size: 18, color: colors.muted,
      });
    }
    return;
  }

  if (item.type === 'process') {
    item.bullets.slice(0, 5).forEach((step, stepIndex) => {
      const top = 236 + stepIndex * 78;
      addText(slide, colors, {
        text: String(stepIndex + 1).padStart(2, '0'), left: 78, top,
        width: 55, height: 38, size: 22, color: colors.primary, bold: true,
      });
      addShape(pptx, slide, { left: 145, top: top + 13, width: 54, height: 2, fill: colors.line });
      addText(slide, colors, {
        text: step, left: 220, top: top - 2, width: 900, height: 44, size: 22,
      });
    });
    return;
  }

  addBulletList(pptx, slide, colors, item.bullets, {
    top: 246,
    accent: item.type === 'summary' ? colors.good : colors.primary,
  });
}

function addTitleSlide(pptx, slide, colors, spec, item, index) {
  slide.background = { color: colors.bg };
  addShape(pptx, slide, { left: 72, top: 102, width: 8, height: 438, fill: colors.primary });
  addText(slide, colors, {
    text: 'LLM INFERENCE LAB · TECHNICAL BRIEFING',
    left: 112, top: 108, width: 850, height: 30, size: 15, color: colors.primary, bold: true,
  });
  addText(slide, colors, {
    text: item.title || spec.meta.title, left: 112, top: 190,
    width: 960, height: 170, size: 52, bold: true,
  });
  addText(slide, colors, {
    text: item.takeaway || spec.meta.subtitle || '', left: 112, top: 376,
    width: 900, height: 90, size: 25, color: colors.muted,
  });
  addText(slide, colors, {
    text: `${spec.meta.audience} · ${spec.meta.durationMinutes} 分钟`,
    left: 112, top: 566, width: 720, height: 34, size: 18, color: colors.primary, bold: true,
  });
  addText(slide, colors, {
    text: String(index + 1).padStart(2, '0'), left: 1135, top: 676,
    width: 72, height: 22, size: 13, color: colors.muted, align: 'right',
  });
}

function addSpeakerNotes(slide, item) {
  const sourceLines = (item.sources || [])
    .map((source) => `- ${source.label}${source.url ? ` | ${source.url}` : ''}`);
  slide.addNotes([
    ...(item.notes || []),
    '',
    '[Sources]',
    ...(sourceLines.length ? sourceLines : ['- 当前平台上下文']),
  ].join('\n'));
}

function createPresentation(spec) {
  const pptx = new PptxGenJS();
  const colors = PALETTES[spec.meta.theme] || PALETTES['platform-light'];
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'LLM 推理工作台';
  pptx.company = 'LLM Inference Platform';
  pptx.subject = spec.meta.sourceType;
  pptx.title = spec.meta.title;
  pptx.lang = 'zh-CN';
  pptx.theme = {
    headFontFace: FONT_FACE,
    bodyFontFace: FONT_FACE,
    lang: 'zh-CN',
  };

  spec.slides.forEach((item, index) => {
    const slide = pptx.addSlide();
    if (item.type === 'title' || index === 0) addTitleSlide(pptx, slide, colors, spec, item, index);
    else addStandardSlide(pptx, slide, colors, item, index);
    addSpeakerNotes(slide, item);
  });

  return pptx;
}

export async function renderPresentation(inputSpec) {
  const spec = validatePresentationSpec(inputSpec);
  try {
    const presentation = createPresentation(spec);
    const output = await presentation.write({ outputType: 'nodebuffer', compression: true });
    const bytes = Buffer.isBuffer(output) ? output : Buffer.from(output);
    return {
      bytes,
      filename: safeFilename(spec.meta.title),
      qaStatus: 'rendered',
      slideCount: spec.slides.length,
    };
  } catch (error) {
    throw Object.assign(new Error('PPTX 生成失败：' + error.message), {
      status: 500,
      code: 'PPT_RENDER_FAILED',
    });
  }
}
