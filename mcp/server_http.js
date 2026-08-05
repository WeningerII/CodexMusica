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
import { counts } from './engine.js';

const PORT = process.env.PORT || 3000;
const MCP_PATH = process.env.MCP_PATH || '/mcp';

const app = express();

// ─────────────────────── inbound request log ───────────────────────
//
// WHY THIS EXISTS. Before this line existed the server recorded nothing at all
// about who called it — it never read req.headers for any purpose other than the
// MCP handshake itself. That made every external reachability test we ran
// unfalsifiable: the sole evidence that a model had actually reached one of our
// URLs was the model SAYING it had, and Google documents that Gemini will report
// a fetch it never performed. We were reading prose as an experimental result.
// A "yes I loaded it" that the server cannot corroborate is not data; this line
// is what turns the next test into one that can come back negative.
//
// ORDER MATTERS, so it is mounted first — ahead of express.json() and ahead of
// the CORS block below, which answers OPTIONS with 204 and returns. Mounted any
// later, two whole classes of call would stay invisible: preflights, and bodies
// that fail to parse (express.json() raises its own 400 before any route runs).
// Those are precisely the requests a caller reports to us as "your server never
// answered", so they are the ones we can least afford to be missing.
//
// EMITTED ON COMPLETION rather than on arrival, so `status` and `ms` are the
// values that really happened instead of a guess made before the handler ran.
// 'close' is bound alongside 'finish' because a caller that hangs up mid-response
// — an agent harness hitting its own timeout — fires only 'close'; a request that
// vanishes is exactly the case worth having on the record, and `aborted`
// separates it from a clean finish. The once-guard is because a normal response
// fires both. Read `status` on an aborted line as the code the server had staged,
// not one any caller received.
//
// ONE JSON LINE, FIXED KEYS, so the log is greppable and machine-parsable
// (`grep '"ev":"http"' | jq 'select(.ua|test("GPTBot"))'`) instead of prose that
// has to be re-parsed by hand each time we ask a new question of it. Render
// captures stdout as the service log, so stdout is the destination; the existing
// [mcp] line stays on stderr.
//
// NO BODIES. This endpoint is public and unauthenticated, so anything logged is
// volume we did not choose and content we did not vet. Method, URL, status and
// user-agent are enough to answer "did anything actually call us"; MCP arguments
// live in the body and stay unlogged.
const HEADER_LOG_LIMIT = 300;

// Header values are attacker-controlled and unbounded in practice, so they get a
// ceiling. The URL does not need one: Node caps the whole request head at 16 KB,
// and truncating a query string would defeat the point of logging it.
function logHeader(req, name) {
  const raw = req.headers[name];
  if (raw == null) return null;
  const flat = Array.isArray(raw) ? raw.join(', ') : String(raw);
  return flat.length > HEADER_LOG_LIMIT ? `${flat.slice(0, HEADER_LOG_LIMIT)}...` : flat;
}

app.use((req, res, next) => {
  // Monotonic: a clock step during the request must not produce a negative or
  // wildly inflated duration, which is the failure mode of Date.now() here.
  const startedAt = process.hrtime.bigint();
  let emitted = false;
  let finished = false;
  const emit = () => {
    if (emitted) return;
    emitted = true;
    try {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      console.log(
        JSON.stringify({
          ev: 'http',
          t: new Date().toISOString(),
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          ms: Number(ms.toFixed(1)),
          ua: logHeader(req, 'user-agent'),
          referer: logHeader(req, 'referer'),
          xff: logHeader(req, 'x-forwarded-for'),
          aborted: !finished,
        })
      );
    } catch {
      // A log line is never worth a request. The caller already has its response
      // by the time this runs, and there is nowhere useful to report to anyway —
      // reporting is the thing that just failed.
    }
  };
  // `aborted` is derived from whether 'finish' actually fired, and deliberately
  // not from res.writableFinished: measured against this server, writableFinished
  // is still true after the peer has vanished (a response written into a dead
  // socket "completes" from the writer's side), which made it a flag that could
  // never be true and therefore worth nothing.
  res.on('finish', () => {
    finished = true;
    emit();
  });
  res.on('close', emit);
  next();
});

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

// A one-hop pointer for anyone who opens the bare origin in a browser, so the
// root is not express's default "Cannot GET /". The MCP handshake is the whole
// interface; this only says where it is.
app.get('/', (_req, res) =>
  res.json({
    service: 'codex-musica-mcp',
    transport: 'streamable-http',
    endpoint: '/mcp',
    card: '/.well-known/mcp.json',
    documentation: 'https://weningerii.github.io/CodexMusica/AGENTS.md',
  })
);

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
      `Deterministic recording-recipe workspace: seed a recipe from any of ${counts.traditions} music ` +
      'traditions and edit it (prefaces, part variants, room/chain/tuning, instruments) — ' +
      'the headless twin of the browser app, read-only and reproducible.',
    version: '2.1.0',
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
  res.on('close', () => {
    transport.close();
    server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] request error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// Stateless mode has no server-initiated SSE stream and no session lifecycle.
const notAllowed = (_req, res) =>
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed (stateless server).' },
    id: null,
  });
app.get(MCP_PATH, notAllowed);
app.delete(MCP_PATH, notAllowed);

app.listen(PORT, () => {
  console.error(
    `codex-musica MCP server (stateless Streamable HTTP) listening on :${PORT}${MCP_PATH}`
  );
});
