#!/usr/bin/env node
// server_stdio.js — run the CodexMusica MCP server over stdio.
//
// This is the local entry point: wire it into a desktop MCP client's config and
// the engine runs on your own machine (zero hosting). For the hosted-connector
// experience (the toggle in Claude's Connectors menu), use server_http.js.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from './tools.js';

const server = buildServer();
const transport = new StdioServerTransport();
await server.connect(transport);

// Logs MUST go to stderr — stdout is the JSON-RPC channel.
console.error('codex-musica MCP server running on stdio');
