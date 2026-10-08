#!/usr/bin/env node
import { CONNECTOR_VERSION } from './contract_version.js';
// server_http.js — run the CodexMusica MCP server over Streamable HTTP.
//
// This is the deployable entry point. Host it at an HTTPS URL and add it in
// Claude → Add connectors → custom → paste the URL. No login: recipe compute is
// public, and the connector's lyric tools plan and grade without calling a model;
// only /chat spends, against its admission ledger. Open is not the same as unguarded —
// per-IP limits live below (MCP_LIMITS) and per-request size ceilings live in
// schemas.js. An edge limiter in front is still welcome; it is no longer the
// only thing standing between an open endpoint and a busy loop.
//
// STATELESS mode: a fresh server + transport is created per request and no
// session id is issued. This is the robust pattern for a hosted connector — an
// instance restart cannot orphan a transport session. Connector workflow
// sessions (session_id / operation_id) and durable /chat receipts have their own
// explicit, persisted recovery lifecycle. (The earlier stateful/in-memory variant
// dropped sessions on every redeploy, which surfaced as "execution errors" on
// calls made after a deploy.) Each tool call is self-contained.

import compression from 'compression';
import express from 'express';
import path from 'node:path';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { counts } from './engine.js';
import { createChatRouter } from './chat.js';
import { Windows, clientIp } from './ratelimit.js';
import {
  JobStore,
  createJobRouter,
  runtimeBuildIdentity,
  redactJobCapability,
} from './job_store.js';
import { withExecutionContext } from './execution_context.js';
import { HTTP_REQUEST_BYTES } from './payload_limits.js';
import { lyricCapacity, lyricWorkerState, readerPythonBridge } from './lyric_tools.js';
import { ReaderJobStore } from './reader_job_store.js';
import { ReaderScheduler, createCatalogResolver } from './reader_scheduler.js';
import { createReaderRouter } from './reader_routes.js';
import { createOperationBudget } from './paid_budget.js';
import { effectiveConfiguration } from './runtime_config.js';
import { runtimeAssets } from './runtime_assets.js';
import {
  WorkflowSessions,
  SESSION_STORE_LIMITS,
  INTEGRATION as SESSION_INTEGRATION,
} from './workflow_sessions.js';
import { buildWorkflowServer } from './workflow_tools.js';

const PORT = process.env.PORT || 3000;
const MCP_PATH = process.env.MCP_PATH || '/mcp';

// ─────────────────────── /mcp rate limits ───────────────────────
//
// The header above used to say "protect it with edge rate-limiting" and that
// was the whole of the protection: render.yaml configures no edge, so the
// open endpoint had none, while /chat — the one that spends money — had a
// limiter in code. Cost was guarded and CPU was not, which is backwards for a
// synchronous engine on a single-process instance: a tool call that holds the
// event loop holds it against /health too, and a failed health check restarts
// the service.
//
// These ceilings are set for an agent, not a browser. A model working through
// a recipe makes a handful of calls per turn — search, seed, a few edits, a
// render — so 60/minute leaves an interactive session untouched while turning
// "block the loop forever" into "block it, then wait".
const MCP_LIMITS = {
  perIpPerMinute: Number(process.env.MCP_IP_RPM) || 60,
  perIpPerHour: Number(process.env.MCP_IP_RPH) || 600,
};
const mcpWindows = new Windows();

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
  const flat = redactJobCapability(Array.isArray(raw) ? raw.join(', ') : String(raw));
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
          url: redactJobCapability(req.originalUrl),
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

// ─────────────────────── response compression ───────────────────────
//
// WHY THIS EXISTS. Every response this service sent went out uncompressed, and
// the largest one is the one every client fetches first. Measured on this tree
// (2026-09-14), `tools/list` plain vs gzipped, per surface:
//
//   /mcp/chatgpt    100,470 -> 16,626   (83% off)
//   /mcp             76,378 -> 16,194   (79% off)
//   /mcp/lyrics      63,298 -> 12,984   (79% off)
//   /mcp/recipe      13,148 ->  3,784   (71% off)
//
// Four fifths of every handshake was padding, paid once per connection by every
// connector pointed at this URL. Tool results compress about as well:
// list_traditions 3,919 -> 939, search_catalog 3,308 -> 788. The engine is
// unchanged; only the bytes on the wire move.
//
// WHY IT IS SAFE HERE is the half worth checking before copying this line into
// another service. `compression` buffers, and buffering a long-lived stream
// delays every event on it. This server has no long-lived stream to delay:
// `GET` on an MCP path -- the Streamable HTTP spec's server-initiated SSE
// channel -- is refused 405 below, /chat answers with a single buffered body
// and reports progress through polled receipts, and everything else is
// res.json(). The `text/event-stream` bodies the POST handler does emit are
// complete when written: they carry a Content-Length and close.
//
// So the precondition is "no open streams", NOT "no SSE" -- and the change
// that would quietly break it is enabling that GET channel, which would turn
// a delivered event into one held until the stream ended. The two facts are
// asserted together in test_connector_http.mjs for exactly that reason: that a
// large body comes back gzipped, and that the GET stream is still refused.
//
// Mounted after the request log so a compressed response is still logged, and
// before every route so there is no surface it does not cover. The default
// 1 KB threshold is kept: /health and /ready are smaller than their own gzip
// headers would be, and compressing them would make them bigger.
app.use(compression());

app.use(
  express.json({
    limit: HTTP_REQUEST_BYTES,
    verify: (req, _res, bytes) => {
      if (req.originalUrl?.startsWith('/internal/reader/')) req.readerRawBody = Buffer.from(bytes);
    },
  })
);

// Supplied browser origins are checked before any dispatch, including preflights.
// Native clients without Origin follow the public endpoint's access policy.
const allowedOrigins = new Set(
  (
    process.env.MCP_ALLOWED_ORIGINS ||
    'https://weningerii.github.io,https://codexmusica.com,https://www.codexmusica.com,https://mcp.codexmusica.com'
  )
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
);
for (const origin of allowedOrigins) {
  if (origin === '*' || new URL(origin).origin !== origin)
    throw new Error('MCP_ALLOWED_ORIGINS must list exact trusted origins, never a wildcard.');
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin !== undefined && (typeof origin !== 'string' || !allowedOrigins.has(origin)))
    return res.status(403).json({ error: 'Origin is not permitted by this service.' });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id, mcp-protocol-version');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// The chat bar's backend, mounted on this service because it already holds the
// engine and the catalog in memory. It is a SEPARATE surface from /mcp: /mcp is
// the public connector; paid lyrics calls and /chat share one model ledger.
// /chat additionally has conversation admission and signed request recovery. Mounting it here rather
// than in its own service is what keeps one deploy and one catalog load.
//
// Awaited before listen() so the in-memory MCP client it drives is connected
// before the first request can arrive.
const buildIdentity = runtimeBuildIdentity();
const runtimeDir = (name) =>
  process.env.LYRIC_RUNTIME_DIR ? path.join(process.env.LYRIC_RUNTIME_DIR, name) : null;
let readerScheduler;
let readerFailure;
try {
  const readerStore = new ReaderJobStore({
    directory: process.env.READER_RUNTIME_DIR || runtimeDir('reader-jobs'),
    maxBytes: Number(process.env.READER_STORAGE_MAX_BYTES) || 256 * 1024 * 1024,
  });
  if (
    !process.env.READER_BRIDGE_SECRET ||
    Buffer.byteLength(process.env.READER_BRIDGE_SECRET) < 32 ||
    !process.env.READER_SITE_ID ||
    !process.env.READER_CATALOG_DIR
  )
    throw new Error(
      'Reader requires its private bridge secret, Site identity, pinned catalog and durable directory.'
    );
  const resolver = createCatalogResolver({
    directory: process.env.READER_CATALOG_DIR,
    engineCommit: buildIdentity.commit,
    resourceFingerprint:
      process.env.READER_RESOURCE_FINGERPRINT ||
      runtimeAssets().assets_sha256 ||
      buildIdentity.commit ||
      'unidentified',
  });
  const readerCatalog = await resolver.probe();
  readerScheduler = new ReaderScheduler({
    store: readerStore,
    bridge: readerPythonBridge,
    ...resolver,
  });
  readerScheduler.catalog = readerCatalog;
  app.use(
    createReaderRouter({
      store: readerStore,
      scheduler: readerScheduler,
      secret: process.env.READER_BRIDGE_SECRET,
      site: process.env.READER_SITE_ID,
      resolveIdentity: resolver.resolveIdentity,
      prepareRequest: resolver.prepareRequest,
    })
  );
  readerScheduler.kick();
} catch (error) {
  readerFailure = error.message;
  app.use('/internal/reader', (_req, res) =>
    res.status(503).json({
      error: {
        code: 'READER_UNAVAILABLE',
        message: 'The durable private reader is unavailable.',
        remedy: 'Configure and verify the reader storage, pinned catalog and private bridge.',
      },
    })
  );
}
const readerReadiness = () => {
  try {
    if (readerScheduler) return readerScheduler.readiness();
  } catch {
    readerFailure = 'Reader persistence is unavailable.';
  }
  return { ready: false, durable: false, enabled: false, reason: readerFailure, provider_calls: 0 };
};
let jobStore;
try {
  jobStore = new JobStore(runtimeDir('jobs'));
} catch (err) {
  console.error(
    '[chat] /chat recovery persistence is unusable; /chat is disabled until repaired:',
    err.message
  );
  jobStore = new JobStore();
  jobStore.failure = err.message;
}
// Connector sessions keep their own store, so neither surface's traffic, disk
// failure or capacity can stop the other. Sessions an earlier release wrote to
// the /chat store stay readable and continuable from it until they expire.
let sessionStore;
try {
  sessionStore = new JobStore(runtimeDir('sessions'), SESSION_STORE_LIMITS);
} catch (err) {
  console.error(
    '[mcp] session persistence is unusable; recipe calls answer without saving a session and lyric sessions are refused until repaired:',
    err.message
  );
  sessionStore = new JobStore(null, SESSION_STORE_LIMITS);
  sessionStore.failure = err.message;
}
let chatRouter;
const workflowSessions = new WorkflowSessions({
  store: sessionStore,
  legacyStore: jobStore,
  build: buildIdentity,
});
app.use(
  createJobRouter({
    store: jobStore,
    build: buildIdentity,
    recoverCheckpoint: (record) => chatRouter?.recoverCheckpoint?.(record),
    // Session receipts hold private continuation state; only get_operation reads them.
    exposes: (record) => record.intent?.integration !== SESSION_INTEGRATION,
  })
);

chatRouter = await createChatRouter({
  buildServer,
  Client,
  InMemoryTransport,
});
app.use(chatRouter);

// M-230: the process says WHICH BUILD it is. mcp/check_live.mjs compares the
// tool surface, and a change that touches no tool (the M-228/M-229 merge —
// gemini_agent.js only) leaves the surface byte-identical between the old
// process and the new, so the battery's wait-for-live matched the OLD
// deployment on the spot. RENDER_GIT_COMMIT is the sha Render built (set by
// Render in every service's runtime env); null means a runtime that does not
// say, which the probe treats as "not this tree", never as a match.
app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    service: 'codex-musica-mcp',
    lyrics: chatRouter.readiness(),
    queue: lyricCapacity(),
    reader: readerReadiness(),
    // WHY THIS FIELD EXISTS (M-187(a)). Nothing measured whether the warm
    // worker is ENGAGED on the deployed box. check_live.mjs compares the
    // ADVERTISED surface, not the process answering it, and a warm answer and
    // a cold one are byte-identical — the only difference is the clock. So the
    // standing instrument was two identical deferred lyric_revise calls timed
    // back to back on the live /mcp: the second under ~10 s means the replay
    // memo engaged, ~80 s flat means every call is cold. That costs two full
    // paid revisions and about three minutes to ask a yes/no question. This
    // field turns it into one curl: `spawned` says the warm process exists at
    // all (the M-187 defect was an image that never shipped worker.py, and a
    // failed spawn falls back to cold silently), and `warm` says it has
    // answered at least one request IN THIS PROCESS, which is the only state
    // under which its memo is populated. It is a read of variables the bridge
    // already keeps: no probe, no spawn, no grading, no provider call, and
    // nothing that can block this handler. Booleans and a count carry no
    // lyric, no model text, no capability and no secret, so it is safe on a
    // public endpoint.
    //
    // WHAT THIS FIELD IS NOT. M-187 also asked for RENDER_GIT_COMMIT here so
    // the deploy guard could learn the SERVING sha. That half was already
    // paid: `commit` below is the baked image identity falling back to
    // BUILD_GIT_COMMIT then RENDER_GIT_COMMIT, `build.reported_commit` is
    // RENDER_GIT_COMMIT verbatim, and since M-289 deploy_guard.sh reads this
    // very field through `check_live.mjs --print-commit`. Nothing was added
    // for it.
    worker: lyricWorkerState(),
    commit: buildIdentity.commit,
    build: buildIdentity,
    recovery: {
      durable: jobStore.durable,
      retention_ms: jobStore.ttlMs,
      max_records: jobStore.maxRecords,
      max_payload_records: jobStore.maxPayloadRecords,
      healthy: !jobStore.failure,
      sessions: {
        durable: sessionStore.durable,
        retention_ms: sessionStore.ttlMs,
        max_records: sessionStore.maxRecords,
        max_payload_records: sessionStore.maxPayloadRecords,
        max_bytes: sessionStore.maxBytes,
        healthy: !sessionStore.failure,
      },
    },
  })
);

app.get('/ready', (_req, res) => {
  const lyrics = chatRouter.readiness();
  const assets = runtimeAssets();
  const reader = readerReadiness();
  const ready =
    lyrics.ready === true &&
    !jobStore.failure &&
    !sessionStore.failure &&
    assets.ok &&
    (process.env.READER_REQUIRED !== '1' || reader.ready === true);
  res.status(ready ? 200 : 503).json({
    ready,
    capabilities: { recipe: true, lyrics: ready, reader: reader.ready === true },
    reader,
    lyrics,
    recovery: {
      durable: jobStore.durable,
      healthy: !jobStore.failure,
      sessions: { durable: sessionStore.durable, healthy: !sessionStore.failure },
    },
    queue: lyricCapacity(),
    build: buildIdentity,
    assets,
    configuration: effectiveConfiguration(),
  });
});

// A one-hop pointer for anyone who opens the bare origin in a browser, so the
// root is not express's default "Cannot GET /". The MCP handshake is the whole
// interface; this only says where it is.
app.get('/', (_req, res) =>
  res.json({
    service: 'codex-musica-mcp',
    transport: 'streamable-http',
    endpoint: '/mcp',
    card: '/.well-known/mcp.json',
    documentation: 'https://codexmusica.com/AGENTS.md',
  })
);

// Server card for zero-config discovery — served from the server's OWN origin so a client
// can learn identity / transport / auth before the MCP handshake (the SEP-1649/SEP-1960
// /.well-known/mcp.json pattern, mirroring OAuth/OIDC well-known docs). The full tool list
// still comes from the MCP initialize + tools/list handshake; this is the pre-connect hint.
const PUBLIC_MCP_URL = process.env.MCP_PUBLIC_URL || 'https://mcp.codexmusica.com/mcp';
app.get('/.well-known/mcp.json', (_req, res) =>
  res.json({
    name: 'io.github.weningerii/codex-musica',
    title: 'Codex Musica',
    description:
      `Recording recipes over ${counts.traditions} traditions and a separate lyrics planning, grading and revision pipeline. ` +
      'Recipe tools are deterministic. Lyrics tools plan and grade; the caller writes every line, and revision stores private run state.',
    version: CONNECTOR_VERSION,
    transport: 'streamable-http',
    endpoint: PUBLIC_MCP_URL,
    authentication: 'none',
    taskEndpoints: { recipe: PUBLIC_MCP_URL + '/recipe', lyrics: PUBLIC_MCP_URL + '/lyrics' },
    workflowControls: ['begin_lyrics', 'get_operation', 'resume_operation'],
    privacy:
      'Workflow sessions, lyrics requests, accepted drafts and recovery receipts can be persisted. Connector calls send nothing to a model provider.',
    documentation: 'https://codexmusica.com/AGENTS.md',
    websiteUrl: 'https://codexmusica.com',
    repository: 'https://github.com/WeningerII/CodexMusica',
  })
);

// One-line observability so the Render log shows what each call was.
function describe(body) {
  const m = Array.isArray(body) ? body[0] : body;
  if (!m || !m.method) return 'unknown';
  return m.method === 'tools/call' ? `tools/call ${m.params && m.params.name}` : m.method;
}

// Refuse in JSON-RPC, not in Express's default HTML: the caller is a protocol
// client, and -32000 with a retry hint is something it can act on.
function tooMany(res, retryAfterMs) {
  const secs = Math.max(1, Math.ceil(retryAfterMs / 1000));
  res.setHeader('Retry-After', String(secs));
  res.status(429).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: `Rate limit exceeded. Retry in ${secs}s.` },
    id: null,
  });
}

// The SDK (1.31 and later) writes `Cache-Control: no-cache, no-transform` on
// the text/event-stream response a POST gets here, and `compression` honours
// `no-transform` by leaving the body as it is: every tools/list would go out
// uncompressed again. The token asks intermediaries not to hold an open stream;
// this body is complete when written ("response compression", above), so it is
// dropped from this response alone and `no-cache` stays. Every header write
// passes through setHeader (on-headers spreads writeHead's headers into it), so
// compression reads the header as it is left here.
function keepCompressible(res) {
  const setHeader = res.setHeader;
  const drop = (v) =>
    String(v)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s.toLowerCase() !== 'no-transform')
      .join(', ');
  res.setHeader = function (name, value) {
    if (String(name).toLowerCase() === 'cache-control')
      value = Array.isArray(value) ? value.map(drop) : drop(value);
    return setHeader.call(this, name, value);
  };
}

const mcpPaths = [
  MCP_PATH,
  MCP_PATH + '/recipe',
  MCP_PATH + '/lyrics',
  MCP_PATH + '/chatgpt',
  MCP_PATH + '/chatgpt/recipe',
  MCP_PATH + '/chatgpt/lyrics',
];
app.post(mcpPaths, async (req, res) => {
  const ip = clientIp(req);
  const now = Date.now();
  const perMin = mcpWindows.hit(`mcp:${ip}`, 60_000, MCP_LIMITS.perIpPerMinute, now);
  if (!perMin.ok) {
    console.error(`[mcp] 429 ${ip} (minute)`);
    return tooMany(res, perMin.retryAfter);
  }
  const perHour = mcpWindows.hit(`mcp:${ip}`, 3_600_000, MCP_LIMITS.perIpPerHour, now);
  if (!perHour.ok) {
    console.error(`[mcp] 429 ${ip} (hour)`);
    return tooMany(res, perHour.retryAfter);
  }

  console.error(`[mcp] ${describe(req.body)}`);
  // Stateless: brand-new server + transport for this single request.
  const controller = new AbortController();
  const requestPath = req.path.replace(/\/$/, '');
  const compatibilityAlias =
    requestPath === MCP_PATH + '/chatgpt' || requestPath.startsWith(MCP_PATH + '/chatgpt/');
  const shared = requestPath === MCP_PATH;
  if (compatibilityAlias) res.setHeader('Link', `<${PUBLIC_MCP_URL}>; rel="canonical"`);
  const domain = requestPath.endsWith('/recipe')
    ? 'recipe'
    : requestPath.endsWith('/lyrics')
      ? 'lyrics'
      : null;
  // Task-scoped raw HTTP supports the same explicit views its schema advertises.
  // Native hosts still pin their own task.format through the maintained client.
  const format = req.body?.method === 'tools/call' ? req.body.params?.arguments?.format : null;
  const task = domain ? { domain, format: format ?? 'rich', maxChars: 1000 } : null;
  const context = {
    task,
    signal: controller.signal,
    budget: createOperationBudget({
      maxUsd: Number(process.env.CHAT_MAX_TURN_USD) || 2.5,
      dailyUsd: Number(process.env.CHAT_DAILY_USD) || 25,
    }),
  };
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  keepCompressible(res);
  let server;
  res.on('close', () => {
    controller.abort(new Error('MCP client disconnected'));
    transport.close();
    server?.close();
  });
  try {
    server =
      shared || compatibilityAlias
        ? await buildWorkflowServer({ domain, sessions: workflowSessions, compatibility: shared })
        : buildServer(task ? { task } : {});
    await server.connect(transport);
    await withExecutionContext(context, () => transport.handleRequest(req, res, req.body));
  } catch (err) {
    console.error('[mcp] request error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  } finally {
    try {
      context.budget.close();
    } catch (err) {
      console.error('[mcp] accounting settlement failed:', err.message);
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
app.get(mcpPaths, notAllowed);
app.delete(mcpPaths, notAllowed);

const httpServer = app.listen(PORT, () => {
  console.error(
    `codex-musica MCP server (stateless Streamable HTTP) listening on :${PORT}${MCP_PATH}`
  );
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  readerScheduler?.stop();
  const closed = new Promise((resolve) => httpServer.close(resolve));
  httpServer.closeIdleConnections();
  // A reader stops at its next fsynced checkpoint. A blocked native judge
  // cannot hold process shutdown forever; its last acknowledged generation
  // remains the restart point if this grace expires.
  const readerDeadline = Date.now() + 4000;
  const force = setTimeout(() => {
    void readerPythonBridge.internals.kill();
    httpServer.closeAllConnections();
    setImmediate(() => process.exit(0));
  }, 8000);
  void (async () => {
    while (readerScheduler?.active && Date.now() < readerDeadline)
      await new Promise((resolve) => setTimeout(resolve, 25));
    // Reap the shared warm worker, including its process-group helpers.
    await readerPythonBridge.internals.kill();
    // Remaining raw MCP requests already cancel their workers on disconnect.
    httpServer.closeAllConnections();
    await closed;
    await new Promise((resolve) => setImmediate(resolve));
    clearTimeout(force);
    process.exit(0);
  })().catch((error) => {
    console.error('[mcp] shutdown cleanup failed:', error.message);
    void readerPythonBridge.internals.kill();
    httpServer.closeAllConnections();
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
