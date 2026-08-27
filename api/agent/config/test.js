import { handleAgentConfigTestRequest } from '../config.js';

export { handleAgentConfigTestRequest };
export default { fetch: (request) => handleAgentConfigTestRequest(request, process.env) };
