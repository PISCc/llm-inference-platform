import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(ROOT, '..');

const PANORAMA_HTML = path.join(PROJECT_ROOT, 'llm-inference-panorama.html');
const KNOWLEDGE_DIR = path.join(PROJECT_ROOT, 'llm-knowledge');
const DATA_DIR = path.join(ROOT, 'src', 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

// ========== 1. Extract panorama data from static HTML ==========
function extractPanorama() {
  const html = fs.readFileSync(PANORAMA_HTML, 'utf-8');
  const start = html.indexOf('const DATA = {');
  const end = html.indexOf('const GROUP_LABELS', start);
  if (start === -1 || end === -1) {
    throw new Error('Cannot find DATA object in panorama HTML');
  }
  const dataText = html.slice(start + 'const DATA = '.length, end);

  const GROUP_LABELS_TEXT = html.slice(
    html.indexOf('{', html.indexOf('const GROUP_LABELS')),
    html.indexOf(';', html.indexOf('const GROUP_LABELS'))
  );
  const groupLabels = new Function('return ' + GROUP_LABELS_TEXT)();

  const data = new Function('return ' + dataText)();

  const modules = [];
  const perGroup = {};

  for (const [category, list] of Object.entries(data)) {
    perGroup[category] = list.length;
    for (const m of list) {
      const dayLabel = m.day || '';
      const days = [...dayLabel.matchAll(/\d+/g)].map((x) => parseInt(x[0], 10));
      modules.push({
        id: m.id,
        title: m.name,
        category,
        categoryLabel: groupLabels[category] || category,
        day: days[0] ?? null,
        dayLabel,
        summary: m.sub,
        definition: m.def,
        problem: m.problem,
        steps: m.how || [],
        impact: m.impact || [],
        related: m.related || [],
        source: 'llm-inference-panorama.html',
      });
    }
  }

  const ids = modules.map((m) => m.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) throw new Error('Duplicate ids: ' + dup.join(', '));
  if (modules.length !== 60) {
    console.warn('Expected 60 modules, got', modules.length);
  }

  const payload = {
    meta: { source: 'llm-inference-panorama.html', moduleCount: modules.length, groups: perGroup, groupLabels },
    modules,
  };
  fs.writeFileSync(path.join(DATA_DIR, 'panorama.json'), JSON.stringify(payload, null, 2), 'utf-8');
  console.log('Panorama:', modules.length, 'modules', perGroup);
}

// ========== 2. Convert llm-knowledge markdown to JSON ==========
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const lines = match[1].split('\n');
  const fm = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      value = [...value.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    }
    fm[key] = value;
  }
  return fm;
}

function parseBody(text) {
  const body = text.replace(/^---\n[\s\S]*?\n---\n*/, '').trim();
  const sections = {};
  const matches = [...body.matchAll(/##\s+(.+)\n([\s\S]*?)(?=\n##\s|$)/g)];
  for (const m of matches) {
    const title = m[1].trim();
    const content = m[2].trim();
    sections[title] = content;
  }
  if (Object.keys(sections).length === 0 && body) {
    sections['正文'] = body;
  }
  return sections;
}

function cleanRelated(related) {
  if (!Array.isArray(related)) return [];
  return related.map((r) => r.replace(/\[\[(.*?)\]\]/g, '$1').trim()).filter(Boolean);
}

function dayToNumber(dayLabel) {
  if (!dayLabel) return null;
  const m = String(dayLabel).match(/第?\s*(\d+)\s*天/);
  return m ? parseInt(m[1], 10) : null;
}

function extractKnowledge() {
  const entries = [];
  const categories = new Set();

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith('.md')) {
        const filePath = path.join(dir, entry.name);
        const relPath = path.relative(PROJECT_ROOT, filePath).replace(/\\/g, '/');
        if (relPath.includes('99-原始素材')) continue;
        const text = fs.readFileSync(filePath, 'utf-8');
        const fm = parseFrontmatter(text);
        if (!fm.title) continue;
        const body = parseBody(text);
        const categoryFolder = path.basename(path.dirname(filePath));
        const category = fm.category || categoryFolder;
        const dayLabel = fm.day || '';

        entries.push({
          id: fm.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-\u4e00-\u9fa5]/g, ''),
          title: fm.title,
          category,
          day: dayToNumber(dayLabel),
          dayLabel,
          summary: fm.summary || body['一句话定义'] || '',
          definition: body['一句话定义'] || '',
          problem: body['解决什么问题'] || '',
          steps: body['工作原理'] ? body['工作原理'].split('\n').filter((s) => s.trim()) : [],
          impact: Array.isArray(fm.tags) ? fm.tags.map(String) : [],
          related: cleanRelated(fm.related),
          aliases: Array.isArray(fm.aliases) ? fm.aliases : [],
          tags: Array.isArray(fm.tags) ? fm.tags : [],
          sourceFile: relPath,
          sections: body,
        });
        categories.add(category);
      }
    }
  }

  walk(KNOWLEDGE_DIR);

  const payload = {
    meta: { count: entries.length, categories: [...categories].sort() },
    entries,
  };
  fs.writeFileSync(path.join(DATA_DIR, 'knowledge.json'), JSON.stringify(payload, null, 2), 'utf-8');
  console.log('Knowledge:', entries.length, 'entries');
}

extractPanorama();
extractKnowledge();
