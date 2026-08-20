import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validatePresentationSpec } from './presentationSpec.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RENDER_SCRIPT = path.resolve(__dirname, '../../../skills/knowledge-to-ppt/scripts/render-ppt.mjs');

function firstExisting(paths) {
  return paths.find((item) => item && existsSync(item)) || '';
}

function detectBundledRuntime(env) {
  const roots = [
    env.PPT_RUNTIME_ROOT,
    env.CODEX_RUNTIME_DEPENDENCIES,
    path.join(os.homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies'),
  ].filter((item, index, list) => item && list.indexOf(item) === index);

  for (const root of roots) {
    const node = firstExisting(process.platform === 'win32'
      ? [path.join(root, 'node', 'bin', 'node.exe'), path.join(root, 'node', 'node.exe')]
      : [path.join(root, 'node', 'bin', 'node'), path.join(root, 'node', 'node')]);
    const modules = firstExisting([
      path.join(root, 'node', 'node_modules'),
      path.join(root, 'node_modules'),
    ]);
    const bins = [
      path.join(root, 'bin', 'override'),
      path.join(root, 'bin', 'fallback'),
      path.join(root, 'bin'),
    ].filter((item) => existsSync(item));

    if (node && modules && bins.length) {
      return { node, modules, bin: bins[0], extraBins: bins.slice(1) };
    }
  }
  return null;
}

function runtimeConfig(env) {
  const node = env.PPT_RUNTIME_NODE || env.RUNTIME_NODE || '';
  const modules = env.PPT_RUNTIME_NODE_MODULES || env.RUNTIME_NODE_MODULES || '';
  const bin = env.PPT_RUNTIME_BIN_DIR || env.RUNTIME_BIN_DIR || '';
  if (node && modules && bin) return { node, modules, bin, extraBins: [] };

  const bundled = detectBundledRuntime(env);
  if (bundled) return bundled;

  throw Object.assign(new Error('未找到可用的 PPT 运行时。请设置 PPT_RUNTIME_NODE、PPT_RUNTIME_NODE_MODULES 和 PPT_RUNTIME_BIN_DIR。'), {
    status: 503,
    code: 'PPT_RUNTIME_NOT_CONFIGURED',
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), options.timeoutMs || 120000);
    child.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error((stderr || stdout || '进程退出码 ' + code).slice(-2000)));
    });
  });
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

export async function renderPresentation(inputSpec, { env = process.env } = {}) {
  const spec = validatePresentationSpec(inputSpec);
  const runtime = runtimeConfig(env);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-to-ppt-'));
  const specPath = path.join(tempDir, 'presentation-spec.json');
  const outputPath = path.join(tempDir, safeFilename(spec.meta.title));
  const qaDir = path.join(tempDir, 'qa');
  const localRenderScript = path.join(tempDir, 'render-ppt.mjs');
  try {
    await fs.writeFile(specPath, JSON.stringify(spec, null, 2), 'utf8');
    await fs.copyFile(RENDER_SCRIPT, localRenderScript);
    await fs.symlink(runtime.modules, path.join(tempDir, 'node_modules'), 'junction');
    const commandEnv = {
      ...env,
      RUNTIME_NODE: runtime.node,
      RUNTIME_NODE_MODULES: runtime.modules,
      RUNTIME_BIN_DIR: runtime.bin,
      PATH: [runtime.bin, ...(runtime.extraBins || []), env.PATH || ''].filter(Boolean).join(path.delimiter),
    };
    await run(runtime.node, [localRenderScript, specPath, outputPath, qaDir], {
      cwd: tempDir,
      env: commandEnv,
      timeoutMs: 150000,
    });
    let qaStatus = 'rendered';
    if (env.PPT_QA_PYTHON && env.PPT_SLIDES_TEST) {
      await run(env.PPT_QA_PYTHON, [env.PPT_SLIDES_TEST, outputPath], {
        cwd: tempDir,
        env: commandEnv,
        timeoutMs: 90000,
      });
      qaStatus = 'overflow-checked';
    }
    const bytes = await fs.readFile(outputPath);
    return { bytes, filename: path.basename(outputPath), qaStatus, slideCount: spec.slides.length };
  } catch (error) {
    throw Object.assign(new Error('PPTX 生成失败：' + error.message), { status: 500, code: 'PPT_RENDER_FAILED' });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
