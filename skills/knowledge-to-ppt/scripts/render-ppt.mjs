import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const [specPath, outputPath, qaDir] = process.argv.slice(2);
if (!specPath || !outputPath || !qaDir) {
  throw new Error('Usage: render-ppt.mjs <spec.json> <output.pptx> <qa-dir>');
}

const spec = JSON.parse(await fs.readFile(specPath, 'utf8'));
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(qaDir, { recursive: true });

const paletteByTheme = {
  'platform-light': { bg: '#F4F1EB', ink: '#2F2A24', muted: '#71695F', line: '#D8D1C7', primary: '#365F75', secondary: '#695C84', good: '#47705D', warm: '#A46D3B' },
  'executive-dark': { bg: '#171A1F', ink: '#F4F1EA', muted: '#A9ADB5', line: '#343943', primary: '#69B6D6', secondary: '#A693D3', good: '#79B994', warm: '#D7A15E' },
  paper: { bg: '#FAFAF7', ink: '#202020', muted: '#66645F', line: '#D9D7D1', primary: '#3E6575', secondary: '#72617E', good: '#52705D', warm: '#9A6B3F' },
};
const colors = paletteByTheme[spec.meta.theme] || paletteByTheme['platform-light'];
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

function addShape(slide, { name, geometry = 'rect', left, top, width, height, fill = 'none', line = 'none', radius }) {
  return slide.shapes.add({
    geometry,
    name,
    position: { left, top, width, height },
    fill,
    line: line === 'none' ? { style: 'solid', fill: 'none', width: 0 } : line,
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function addText(slide, { name, text, left, top, width, height, size = 20, color = colors.ink, bold = false, align = 'left', valign = 'top' }) {
  const shape = addShape(slide, { name, geometry: 'textbox', left, top, width, height });
  shape.text = String(text || '');
  shape.text.style = {
    fontSize: size,
    bold,
    color,
    typeface: 'Microsoft YaHei',
    alignment: align,
    verticalAlignment: valign,
  };
  return shape;
}

function addChrome(slide, index) {
  slide.background.fill = colors.bg;
  addShape(slide, { name: `top-rule-${index}`, left: 72, top: 54, width: 1136, height: 3, fill: colors.primary });
  addText(slide, { name: `section-${index}`, text: 'LLM INFERENCE LAB', left: 72, top: 20, width: 360, height: 24, size: 13, color: colors.muted, bold: true });
  addText(slide, { name: `page-${index}`, text: String(index + 1).padStart(2, '0'), left: 1135, top: 676, width: 72, height: 22, size: 13, color: colors.muted, align: 'right' });
}

function addTitle(slide, item, index) {
  addText(slide, { name: `title-${index}`, text: item.title, left: 72, top: 84, width: 1080, height: 62, size: 38, bold: true });
  if (item.takeaway) addText(slide, { name: `takeaway-${index}`, text: item.takeaway, left: 72, top: 151, width: 1050, height: 62, size: 24, color: colors.primary, bold: true });
}

function addBulletList(slide, bullets, { left = 92, top = 258, width = 1030, gap = 72, accent = colors.primary } = {}) {
  bullets.slice(0, 5).forEach((bullet, bulletIndex) => {
    addShape(slide, { name: `bullet-mark-${bulletIndex}`, geometry: 'ellipse', left, top: top + bulletIndex * gap + 9, width: 12, height: 12, fill: accent });
    addText(slide, { name: `bullet-${bulletIndex}`, text: bullet, left: left + 30, top: top + bulletIndex * gap, width: width - 30, height: 52, size: 22, color: colors.ink });
  });
}

function addStandardSlide(slide, item, index) {
  addChrome(slide, index);
  addTitle(slide, item, index);
  if (item.type === 'comparison') {
    const splitAt = Math.ceil(item.bullets.length / 2);
    const halves = [item.bullets.slice(0, splitAt), item.bullets.slice(splitAt)];
    halves.forEach((bullets, column) => {
      const left = 72 + column * 580;
      addShape(slide, { name: `comparison-rule-${column}`, left, top: 254, width: 506, height: 2, fill: column ? colors.secondary : colors.primary });
      addText(slide, { name: `comparison-label-${column}`, text: column ? '方案 B · 适用边界' : '方案 A · 核心机制', left, top: 220, width: 506, height: 28, size: 18, color: column ? colors.secondary : colors.primary, bold: true });
      addBulletList(slide, bullets, { left, top: 282, width: 506, gap: 86, accent: column ? colors.secondary : colors.primary });
    });
  } else if (item.type === 'diagnosis') {
    const labels = ['现象与证据', '候选原因', '验证路径'];
    const accents = [colors.primary, colors.warm, colors.good];
    item.bullets.slice(0, 3).forEach((bullet, column) => {
      const left = 72 + column * 386;
      addText(slide, { name: `diagnosis-label-${column}`, text: labels[column], left, top: 250, width: 338, height: 34, size: 20, color: accents[column], bold: true });
      addShape(slide, { name: `diagnosis-rule-${column}`, left, top: 292, width: 338, height: 3, fill: accents[column] });
      addText(slide, { name: `diagnosis-body-${column}`, text: bullet, left, top: 320, width: 338, height: 190, size: 22, color: colors.ink });
    });
    if (item.bullets.length > 3) addText(slide, { name: 'diagnosis-boundary', text: item.bullets.slice(3).join('；'), left: 72, top: 570, width: 1110, height: 58, size: 18, color: colors.muted });
  } else if (item.type === 'process') {
    item.bullets.slice(0, 5).forEach((step, stepIndex) => {
      const top = 236 + stepIndex * 78;
      addText(slide, { name: `step-number-${stepIndex}`, text: String(stepIndex + 1).padStart(2, '0'), left: 78, top, width: 55, height: 38, size: 22, color: colors.primary, bold: true });
      addShape(slide, { name: `step-rule-${stepIndex}`, left: 145, top: top + 13, width: 54, height: 2, fill: colors.line });
      addText(slide, { name: `step-${stepIndex}`, text: step, left: 220, top: top - 2, width: 900, height: 44, size: 22, color: colors.ink });
    });
  } else {
    addBulletList(slide, item.bullets, { top: 246, accent: item.type === 'summary' ? colors.good : colors.primary });
  }
}

function addTitleSlide(slide, item, index) {
  slide.background.fill = colors.bg;
  addShape(slide, { name: 'title-accent', left: 72, top: 102, width: 8, height: 438, fill: colors.primary });
  addText(slide, { name: 'deck-label', text: 'LLM INFERENCE LAB · TECHNICAL BRIEFING', left: 112, top: 108, width: 850, height: 30, size: 15, color: colors.primary, bold: true });
  addText(slide, { name: 'deck-title', text: item.title || spec.meta.title, left: 112, top: 190, width: 960, height: 170, size: 52, color: colors.ink, bold: true });
  addText(slide, { name: 'deck-subtitle', text: item.takeaway || spec.meta.subtitle || '', left: 112, top: 376, width: 900, height: 90, size: 25, color: colors.muted });
  addText(slide, { name: 'deck-audience', text: `${spec.meta.audience} · ${spec.meta.durationMinutes} 分钟`, left: 112, top: 566, width: 720, height: 34, size: 18, color: colors.primary, bold: true });
  addText(slide, { name: 'deck-page', text: String(index + 1).padStart(2, '0'), left: 1135, top: 676, width: 72, height: 22, size: 13, color: colors.muted, align: 'right' });
}

for (const [index, item] of spec.slides.entries()) {
  const slide = presentation.slides.add();
  if (item.type === 'title' || index === 0) addTitleSlide(slide, item, index);
  else addStandardSlide(slide, item, index);
  const sourceLines = (item.sources || []).map((source) => `- ${source.label}${source.url ? ` | ${source.url}` : ''}`);
  slide.speakerNotes.textFrame.setText([
    ...(item.notes || []),
    '',
    '[Sources]',
    ...(sourceLines.length ? sourceLines : ['- 当前平台上下文']),
  ]);
  slide.speakerNotes.setVisible(true);
}

for (const [index, slide] of presentation.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2, '0')}`;
  const png = await presentation.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(path.join(qaDir, `${stem}.png`), new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: 'layout' });
  await fs.writeFile(path.join(qaDir, `${stem}.layout.json`), await layout.text(), 'utf8');
}
const montage = await presentation.export({ format: 'webp', montage: true, scale: 1 });
await fs.writeFile(path.join(qaDir, 'deck-montage.webp'), new Uint8Array(await montage.arrayBuffer()));
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(outputPath);

