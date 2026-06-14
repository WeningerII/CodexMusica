#!/usr/bin/env node
// server_http.js — run the CodexMusica MCP server over Streamable HTTP.
//
// This is the deployable entry point. Host it at an HTTPS URL and add it in
// Claude → Add connectors → custom → paste the URL, and it shows up with its own
// toggle. No login: the engine is read-only compute, so the server is open;
// protect it with edge rate-limiting (e.g. Cloudflare) rather than auth.
//
// Uses the canonical stateful Streamable HTTP pattern: the client initializes
// once (gets an Mcp-Session-Id), then reuses it. State is per-process and
// in-memory, so run a single instance or use sticky sessions if you scale out.
// (For Cloudflare Workers specifically, port to WebStandardStreamableHTTPServerTransport.)

import { randomUUID } from 'node:crypto';
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
  res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'codex-musica-mcp' }));

// session id -> live transport
const transports = {};

const isInitialize = (body) =>
  (Array.isArray(body) ? body : [body]).some((m) => m && m.method === 'initialize');

app.post(MCP_PATH, async (req, res) => {
  try {
    const sid = req.headers['mcp-session-id'];
    let transport = sid ? transports[sid] : undefined;

    if (!transport && isInitialize(req.body)) {
      // New conversation: spin up a transport + server and remember it by session.
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => { transports[id] = transport; },
      });
      transport.onclose = () => { if (transport.sessionId) delete transports[transport.sessionId]; };
      await buildServer().connect(transport);
    } else if (!transport) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: no valid session ID (send initialize first).' },
        id: null,
      });
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP POST error:', err);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

// GET (server-initiated SSE stream) and DELETE (session teardown) reuse the
// session's transport.
const bySession = async (req, res) => {
  const sid = req.headers['mcp-session-id'];
  const transport = sid ? transports[sid] : undefined;
  if (!transport) return res.status(400).send('Invalid or missing session ID');
  await transport.handleRequest(req, res);
};
app.get(MCP_PATH, bySession);
app.delete(MCP_PATH, bySession);

app.listen(PORT, () => {
  console.error(`codex-musica MCP server (Streamable HTTP) listening on :${PORT}${MCP_PATH}`);
});
