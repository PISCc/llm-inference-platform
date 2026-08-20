import fs from 'node:fs/promises';
import path from 'node:path';
import { renderPresentation } from '../../../server/skills/ppt/pptService.js';

const [specPath, outputPath, qaDir] = process.argv.slice(2);
if (!specPath || !outputPath || !qaDir) {
  throw new Error('Usage: render-ppt.mjs <spec.json> <output.pptx> <qa-dir>');
}

const spec = JSON.parse(await fs.readFile(specPath, 'utf8'));
const result = await renderPresentation(spec);

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(qaDir, { recursive: true });
await fs.writeFile(outputPath, result.bytes);
await fs.writeFile(path.join(qaDir, 'render-report.json'), JSON.stringify({
  renderer: 'pptxgenjs',
  qaStatus: result.qaStatus,
  slideCount: result.slideCount,
  outputFile: path.basename(outputPath),
}, null, 2));

process.stdout.write(JSON.stringify({
  ok: true,
  outputPath,
  slideCount: result.slideCount,
  qaStatus: result.qaStatus,
}));
