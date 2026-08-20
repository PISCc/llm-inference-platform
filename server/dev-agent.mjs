import http from 'node:http';
import { handleAgentHttpRequest } from '../api/agent/chat.js';
import { handlePptOutlineRequest } from '../api/skills/ppt/outline.js';
import { handlePptRenderRequest } from '../api/skills/ppt/render.js';
import { handleAgentConfigRequest } from '../api/agent/config.js';
import { handleAgentConfigTestRequest } from '../api/agent/config/test.js';

const host = process.env.AGENT_DEV_HOST || '127.0.0.1';
const port = Number(process.env.AGENT_DEV_PORT || 8787);

const server = http.createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const url = new URL(request.url || '/', `http://${request.headers.host || `${host}:${port}`}`);
  const webRequest = new Request(url, {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method || 'GET') ? undefined : body,
  });

  try {
    const handler = url.pathname === '/api/skills/ppt/outline'
      ? handlePptOutlineRequest
      : url.pathname === '/api/skills/ppt/render'
        ? handlePptRenderRequest
        : url.pathname === '/api/agent/config/test'
          ? handleAgentConfigTestRequest
          : url.pathname === '/api/agent/config' || url.pathname === '/api/agent/config/status'
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

server.listen(port, host, () => {
  console.log(`M6 API listening on http://${host}:${port}/api/agent/chat`);
  console.log('PPT Skill endpoints: /api/skills/ppt/outline, /api/skills/ppt/render');
});
