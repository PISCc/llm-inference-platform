import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleAgentHttpRequest } from '../api/agent/chat.js';
import { handlePptOutlineRequest } from '../api/skills/ppt/outline.js';
import { handlePptRenderRequest } from '../api/skills/ppt/render.js';
import { handleAgentConfigRequest } from '../api/agent/config.js';
import { handleAgentConfigTestRequest } from '../api/agent/config/test.js';
import { handleAgentConfigStatusRequest } from '../api/agent/config/status.js';

const isHosted = Boolean(process.env.PORT || process.env.RENDER);
const host = process.env.AGENT_DEV_HOST || (isHosted ? '0.0.0.0' : '127.0.0.1');
const port = Number(process.env.PORT || process.env.AGENT_DEV_PORT || 8787);
const distRoot = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const MAX_API_BODY_BYTES = 512 * 1024;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function isApiPath(pathname) {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function sendStaticFile(response, filePath, status = 200) {
  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(status, {
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(filePath).on('error', () => response.end()).pipe(response);
}

function serveStatic(pathname, response) {
  if (!fs.existsSync(distRoot)) {
    response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Frontend build is not available. Run npm run build first.');
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    decodedPath = '/';
  }
  const requestedPath = path.resolve(distRoot, `.${decodedPath}`);
  const insideDist = requestedPath === distRoot || requestedPath.startsWith(`${distRoot}${path.sep}`);
  const candidate = insideDist ? requestedPath : path.join(distRoot, 'index.html');
  const indexPath = path.join(distRoot, 'index.html');

  fs.stat(candidate, (error, stats) => {
    if (!error && stats.isFile()) {
      sendStaticFile(response, candidate);
      return;
    }
    if (!error && stats.isDirectory()) {
      const nestedIndex = path.join(candidate, 'index.html');
      fs.stat(nestedIndex, (nestedError, nestedStats) => {
        if (!nestedError && nestedStats.isFile()) sendStaticFile(response, nestedIndex);
        else sendStaticFile(response, indexPath);
      });
      return;
    }
    sendStaticFile(response, indexPath);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);

  if (!isApiPath(url.pathname) && ['GET', 'HEAD'].includes(request.method || 'GET')) {
    if (request.method === 'HEAD') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end();
      return;
    }
    serveStatic(url.pathname, response);
    return;
  }

  const chunks = [];
  let bodyBytes = 0;
  for await (const chunk of request) {
    bodyBytes += chunk.length;
    if (bodyBytes > MAX_API_BODY_BYTES) {
      response.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: { code: 'REQUEST_TOO_LARGE', message: '请求内容过大。' } }));
      return;
    }
    chunks.push(chunk);
  }
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const webRequest = new Request(url, {
    method: request.method,
    headers: { ...request.headers, 'x-real-ip': request.socket.remoteAddress || '' },
    body: ['GET', 'HEAD'].includes(request.method || 'GET') ? undefined : body,
  });

  try {
    const handler = url.pathname === '/api/skills/ppt/outline'
      ? handlePptOutlineRequest
      : url.pathname === '/api/skills/ppt/render'
        ? handlePptRenderRequest
        : url.pathname === '/api/agent/config/test'
          ? handleAgentConfigTestRequest
          : url.pathname === '/api/agent/config/status'
            ? handleAgentConfigStatusRequest
            : url.pathname === '/api/agent/config'
              ? handleAgentConfigRequest
              : handleAgentHttpRequest;
    const webResponse = await handler(webRequest, process.env);
    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()));
    if (!webResponse.body) {
      response.end();
      return;
    }
    const reader = webResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      response.write(Buffer.from(value));
    }
    response.end();
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: { code: 'DEV_SERVER_FAILED', message: error.message } }));
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用：可能已有 LLM 推理平台服务在运行。`);
    console.error(`请直接访问 http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/ ，或先关闭占用该端口的进程再重新启动。`);
    process.exit(1);
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`LLM inference platform listening on http://${host}:${port}`);
  console.log('PPT Skill endpoints: /api/skills/ppt/outline, /api/skills/ppt/render');
});
