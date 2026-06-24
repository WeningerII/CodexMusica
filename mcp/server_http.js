#!/usr/bin/env node
// server_http.js — run the CodexMusica MCP server over Streamable HTTP.
//
// This is the deployable entry point. Host it at an HTTPS URL and add it in
// Claude → Add connectors → custom → paste the URL. No login: the engine is
// read-only compute, so the server is open; protect it with edge rate-limiting.
//
// STATELESS mode: a fresh server + transport is created per request and no
// session id is issued. This is the robust pattern for a hosted connector — an
// instance restart (deploy, autoscale, crash-recovery) can't orphan a session,
// because there are no sessions to lose. (The earlier stateful/in-memory variant
// dropped sessions on every redeploy, which surfaced as "execution errors" on
// calls made after a deploy.) Each tool call is self-contained.

import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer } from './tools.js';

const PORT = process.env.PORT || 3000;
const MCP_PATH = process.env.MCP_PATH || '/mcp';

const app = express();
app.use(express.json({ limit: '2mb' }));

// Permissive CORS so browser-based MCP clients / the Inspector can connect.
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, mcp-protocol-version');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'codex-musica-mcp' }));

// Server card for zero-config discovery — served from the server's OWN origin so a client
// can learn identity / transport / auth before the MCP handshake (the SEP-1649/SEP-1960
// /.well-known/mcp.json pattern, mirroring OAuth/OIDC well-known docs). The full tool list
// still comes from the MCP initialize + tools/list handshake; this is the pre-connect hint.
const PUBLIC_MCP_URL = process.env.MCP_PUBLIC_URL || 'https://codex-musica-mcp.onrender.com/mcp';
app.get('/.well-known/mcp.json', (_req, res) =>
  res.json({
    name: 'io.github.weningerii/codex-musica',
    title: 'Codex Musica',
    description:
      'Deterministic recording-recipe workspace: seed a recipe from any of 1119 music ' +
      'traditions and edit it (prefaces, part variants, room/chain/tuning, instruments) — ' +
      'the headless twin of the browser app, read-only and reproducible.',
    version: '2.0.0',
    transport: 'streamable-http',
    endpoint: PUBLIC_MCP_URL,
    authentication: 'none',
    documentation: 'https://weningerii.github.io/CodexMusica/AGENTS.md',
    websiteUrl: 'https://weningerii.github.io/CodexMusica',
    repository: 'https://github.com/WeningerII/CodexMusica',
  })
);

// One-line observability so the Render log shows what each call was.
function describe(body) {
  const m = Array.isArray(body) ? body[0] : body;
  if (!m || !m.method) return 'unknown';
  return m.method === 'tools/call' ? `tools/call ${m.params && m.params.name}` : m.method;
}

app.post(MCP_PATH, async (req, res) => {
  console.error(`[mcp] ${describe(req.body)}`);
  // Stateless: brand-new server + transport for this single request.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => { transport.close(); server.close(); });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

// Stateless mode has no server-initiated SSE stream and no session lifecycle.
const notAllowed = (_req, res) =>
  res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server).' }, id: null });
app.get(MCP_PATH, notAllowed);
app.delete(MCP_PATH, notAllowed);

app.listen(PORT, () => {
  console.error(`codex-musica MCP server (stateless Streamable HTTP) listening on :${PORT}${MCP_PATH}`);
});
