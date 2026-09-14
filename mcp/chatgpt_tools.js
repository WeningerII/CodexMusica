// Temporary import compatibility; all clients share one workflow implementation.
export {
  buildWorkflowServer as buildChatGPTServer,
  WORKFLOW_CONNECTOR_VERSION as CHATGPT_CONNECTOR_VERSION,
} from './workflow_tools.js';
