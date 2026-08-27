import { Fragment } from 'react';

const HEADING_PATTERN = /^(#{1,3})\s+(.+)$/;
const SECTION_PATTERN = /^\*\*(.+?)\*\*\s*[:：]?$/;
const UNORDERED_PATTERN = /^\s*[-*+]\s+(.+)$/;
const ORDERED_PATTERN = /^\s*(\d+)[.)、]\s+(.+)$/;
const QUOTE_PATTERN = /^\s*>\s?(.*)$/;
const FENCE_PATTERN = /^\s*```\s*([^\s`]*)\s*$/;
const TABLE_DIVIDER_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function normalizeText(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
}

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableStart(lines, index) {
  if (index + 1 >= lines.length || !lines[index].includes('|')) return false;
  return TABLE_DIVIDER_PATTERN.test(lines[index + 1]);
}

function isBlockStart(lines, index) {
  const line = lines[index] || '';
  const trimmed = line.trim();
  return !trimmed
    || HEADING_PATTERN.test(trimmed)
    || SECTION_PATTERN.test(trimmed)
    || UNORDERED_PATTERN.test(line)
    || ORDERED_PATTERN.test(line)
    || QUOTE_PATTERN.test(line)
    || FENCE_PATTERN.test(line)
    || isTableStart(lines, index);
}

function parseBlocks(value) {
  const lines = normalizeText(value).split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = trimmed.match(FENCE_PATTERN);
    if (fence) {
      const language = fence[1] || '';
      const code = [];
      index += 1;
      while (index < lines.length && !FENCE_PATTERN.test(lines[index].trim())) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: 'code', language, text: code.join('\n') });
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const heading = trimmed.match(HEADING_PATTERN);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    const section = trimmed.match(SECTION_PATTERN);
    if (section) {
      blocks.push({ type: 'section', text: section[1].trim() });
      index += 1;
      continue;
    }

    const unordered = line.match(UNORDERED_PATTERN);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(UNORDERED_PATTERN);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    const ordered = line.match(ORDERED_PATTERN);
    if (ordered) {
      const items = [];
      while (index < lines.length) {
        const match = lines[index].match(ORDERED_PATTERN);
        if (!match) break;
        items.push({ marker: match[1], text: match[2].trim() });
        index += 1;
      }
      blocks.push({ type: 'ordered-list', items });
      continue;
    }

    const quote = line.match(QUOTE_PATTERN);
    if (quote) {
      const quoteLines = [];
      while (index < lines.length) {
        const match = lines[index].match(QUOTE_PATTERN);
        if (!match) break;
        quoteLines.push(match[1]);
        index += 1;
      }
      blocks.push({ type: 'quote', text: quoteLines.join('\n') });
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraph.join('\n') });
  }

  return blocks;
}

function InlineContent({ text }) {
  const value = String(text || '');
  const tokenPattern = /(\*\*([^*\n]+?)\*\*|`([^`\n]+?)`|\[([^\]\n]+?)\]\((https?:\/\/[^\s)]+)\))/g;
  const nodes = [];
  let cursor = 0;
  let match;

  while ((match = tokenPattern.exec(value)) !== null) {
    if (match.index > cursor) nodes.push(value.slice(cursor, match.index));

    if (match[2] !== undefined) {
      nodes.push(<strong key={`strong-${match.index}`} className="font-semibold text-space-100">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      nodes.push(
        <code key={`code-${match.index}`} className="rounded-md border border-space-700/65 bg-space-950/80 px-1.5 py-0.5 font-mono text-[0.88em] text-cyan-500">
          {match[3]}
        </code>,
      );
    } else {
      nodes.push(
        <a
          key={`link-${match.index}`}
          href={match[5]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-cyan-500 underline decoration-cyan-500/35 underline-offset-4 transition hover:text-cyan-400"
        >
          {match[4]}
        </a>,
      );
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < value.length) nodes.push(value.slice(cursor));
  return nodes;
}

function HeadingBlock({ block, compact }) {
  const sizeClass = compact
    ? 'text-[12px] leading-5'
    : block.level === 1
      ? 'text-base leading-7'
      : 'text-sm leading-6';

  return (
    <div className={`flex items-start gap-2.5 font-semibold text-space-100 ${sizeClass}`}>
      <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400 shadow-[0_0_0_3px_rgba(167,139,250,0.10)]" />
      <span><InlineContent text={block.text} /></span>
    </div>
  );
}

function SectionBlock({ text, compact }) {
  return (
    <div className={`flex items-center gap-2 border-t border-space-700/60 font-semibold text-space-200 ${compact ? 'pt-2.5 text-[11px]' : 'pt-3 text-xs'}`}>
      <span className="h-3.5 w-0.5 rounded-full bg-cyan-500/75" />
      <InlineContent text={text} />
    </div>
  );
}

export default function AnswerContent({ text, compact = false, className = '' }) {
  const blocks = parseBlocks(text);
  const spacing = compact ? 'space-y-2.5 text-[13px] leading-6' : 'space-y-3 text-sm leading-7';

  if (blocks.length === 0) return null;

  return (
    <div className={`${spacing} break-words text-space-400 ${className}`}>
      {blocks.map((block, blockIndex) => {
        const key = `${block.type}-${blockIndex}`;

        if (block.type === 'heading') return <HeadingBlock key={key} block={block} compact={compact} />;
        if (block.type === 'section') return <SectionBlock key={key} text={block.text} compact={compact} />;

        if (block.type === 'paragraph') {
          return (
            <p key={key} className="whitespace-pre-line text-space-300">
              <InlineContent text={block.text} />
            </p>
          );
        }

        if (block.type === 'unordered-list') {
          return (
            <ul key={key} className={compact ? 'space-y-1.5' : 'space-y-2'}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="flex items-start gap-2.5">
                  <span className="mt-[0.8em] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500/70 shadow-[0_0_0_3px_rgba(34,211,238,0.06)]" />
                  <span className="min-w-0 flex-1"><InlineContent text={item} /></span>
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={key} className={compact ? 'space-y-1.5' : 'space-y-2'}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`} className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md border border-violet-500/20 bg-violet-500/[0.08] px-1 font-mono text-[9px] font-semibold text-violet-400">
                    {item.marker}
                  </span>
                  <span className="min-w-0 flex-1"><InlineContent text={item.text} /></span>
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'quote') {
          return (
            <div key={key} className="rounded-r-lg border-l-2 border-amber-500/45 bg-amber-500/[0.05] px-3 py-2 text-space-400">
              <InlineContent text={block.text} />
            </div>
          );
        }

        if (block.type === 'code') {
          return (
            <div key={key} className="overflow-hidden rounded-lg border border-space-700/70 bg-space-950/85">
              {block.language && (
                <div className="border-b border-space-700/60 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-space-600">
                  {block.language}
                </div>
              )}
              <pre className={`overflow-x-auto whitespace-pre p-3 font-mono text-cyan-500 ${compact ? 'text-[10px] leading-5' : 'text-xs leading-6'}`}>
                <code>{block.text}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'table') {
          return (
            <div key={key} className="overflow-x-auto rounded-lg border border-space-700/60 bg-space-950/35">
              <table className={`w-full border-collapse text-left ${compact ? 'min-w-[420px] text-[10px]' : 'min-w-[520px] text-xs'}`}>
                <thead className="bg-space-900/90 text-space-300">
                  <tr>
                    {block.headers.map((header, cellIndex) => (
                      <th key={`${key}-head-${cellIndex}`} className="border-b border-space-700/60 px-3 py-2.5 font-semibold">
                        <InlineContent text={header} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${key}-row-${rowIndex}`} className="border-b border-space-800/80 last:border-0">
                      {block.headers.map((_, cellIndex) => (
                        <td key={`${key}-cell-${rowIndex}-${cellIndex}`} className="px-3 py-2.5 align-top leading-5 text-space-400">
                          <InlineContent text={row[cellIndex] || ''} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return <Fragment key={key} />;
      })}
    </div>
  );
}
