import { handleAgentConfigRequest } from '../config.js';

export async function handleAgentConfigStatusRequest(request, env = process.env) {
  return handleAgentConfigRequest(request, env);
}

export default { fetch: (request) => handleAgentConfigRequest(request, process.env) };
