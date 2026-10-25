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
import { readFileSync } from 'node:fs';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';
import { counts } from './engine.js';
import { createChatRouter } from './chat.js';
import { Windows, clientIp } from './ratelimit.js';
import { JobStore, createJobRouter, liveBuildIdentity, redactJobCapability } from './job_store.js';
import { withExecutionContext } from './execution_context.js';
import { HTTP_REQUEST_BYTES } from './payload_limits.js';
import {
  lyricCapacity,
  lyricWorkerState,
  probeReaderSchemeOfWorker,
  readerPythonBridge,
} from './lyric_tools.js';
import { ReaderJobStore } from './reader_job_store.js';
import { ReaderScheduler, createCatalogResolver } from './reader_scheduler.js';
import { createReaderRouter } from './reader_routes.js';
import { LibrarySearch } from './library_search.js';
import { libraryPublicRouter, redactLibraryUrl } from './library_routes.js';
import { libraryViewerRouter, isViewerPath, libraryErrorHandler } from './library_viewer_routes.js';
import { ExportStore } from './library_exports.js';
import { libraryExportRouter, createStreamLimiter } from './library_export_routes.js';
import { CorpusPackages, libraryCorpusRouter } from './library_corpus_routes.js';
import { createAdmission } from './library_admission.js';
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
          url: redactLibraryUrl(redactJobCapability(req.originalUrl)),
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
    // Only the Library viewer routes are credentialed (their HttpOnly cookie);
    // search, metadata and everything else stay uncredentialed.
    if (isViewerPath(req.originalUrl)) res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, mcp-session-id, mcp-protocol-version, Idempotency-Key'
  );
  res.header(
    'Access-Control-Expose-Headers',
    'Retry-After, Content-Disposition, X-Library-Bytes, X-Library-SHA256'
  );
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Max-Age', '600');
    return res.sendStatus(204);
  }
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
// STARTUP_TRACE=1 logs when each startup phase ends, in milliseconds since the
// process started, so a slow start can be located on the machine that has it
// (the capacity harness sets it; production does not).
const startupTrace = (phase) => {
  if (process.env.STARTUP_TRACE === '1')
    console.error(`[startup] ${phase} +${Math.round(performance.now())}ms`);
};
startupTrace('modules loaded');
// Read once here, before listen, as before; if that asset check does not
// complete (a slow boot timed out on 2026-10-16), the identity and the reader
// fingerprint below are read again on use until it does, rather than serving
// null asset fields until a restart.
const buildIdentity = liveBuildIdentity();
buildIdentity();
const runtimeDir = (name) =>
  process.env.LYRIC_RUNTIME_DIR ? path.join(process.env.LYRIC_RUNTIME_DIR, name) : null;
// The resources every new job is pinned to (its identity's resource_fingerprint).
// The build identity carries the same assets_sha256 the asset check reports.
const readerResourceFingerprint = () =>
  process.env.READER_RESOURCE_FINGERPRINT ||
  buildIdentity().assets_sha256 ||
  buildIdentity().commit ||
  'unidentified';
startupTrace('runtime assets read');
let readerScheduler;
let readerStore;
// One admission state for every path that queues an analysis (the private
// bridge and the public viewer routes), so the long-reading rule is one
// service-wide rule (library_admission.js). Created on first use, once the
// store exists; it reads the search store's line counts when one is loaded.
let admissionState = null;
const libraryAdmission = () =>
  (admissionState ||= createAdmission({
    store: readerStore,
    unitOf: (id) => {
      loadLibraryStores();
      return librarySearch?.unit(id) ?? null;
    },
    fail: (code, message, status, extra) =>
      Object.assign(new Error(message), { code, status, extra }),
  }));
let readerResolver;
let readerFailure;
// The reader (store, catalog resolver, scheduler) runs whenever it has a
// pinned catalog and durable storage. Its two browser families mount on their
// own conditions: /internal/reader (the Site bridge) only while the bridge
// secret and Site identity are set, and the /library/v1 viewer routes only
// with public analysis on (below; LIBRARY_PUBLIC=0 turns it off). Removing the bridge secrets therefore never
// silently disables public analysis.
try {
  readerStore = new ReaderJobStore({
    directory: process.env.READER_RUNTIME_DIR || runtimeDir('reader-jobs'),
    maxBytes: Number(process.env.READER_STORAGE_MAX_BYTES) || 256 * 1024 * 1024,
  });
  if (!process.env.READER_CATALOG_DIR)
    throw new Error('Reader requires a pinned catalog and a durable directory.');
  readerResolver = createCatalogResolver({
    directory: process.env.READER_CATALOG_DIR,
    engineCommit: buildIdentity().commit,
    resourceFingerprint: readerResourceFingerprint,
    readerScheme: await probeReaderSchemeOfWorker(),
  });
  const readerCatalog = await readerResolver.probe();
  readerScheduler = new ReaderScheduler({
    store: readerStore,
    bridge: readerPythonBridge,
    ...readerResolver,
  });
  readerScheduler.catalog = readerCatalog;
  readerScheduler.kick();
  readerStore.startMaintenance();
} catch (error) {
  readerFailure = error.message;
  readerScheduler = undefined;
}
startupTrace('reader ready');
const bridgeConfigured =
  process.env.READER_BRIDGE_SECRET &&
  Buffer.byteLength(process.env.READER_BRIDGE_SECRET) >= 32 &&
  process.env.READER_SITE_ID;
if (readerScheduler && bridgeConfigured) {
  app.use(
    createReaderRouter({
      admission: libraryAdmission(),
      store: readerStore,
      scheduler: readerScheduler,
      secret: process.env.READER_BRIDGE_SECRET,
      site: process.env.READER_SITE_ID,
      resolveIdentity: readerResolver.resolveIdentity,
      prepareRequest: readerResolver.prepareRequest,
    })
  );
} else {
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
// The public Library browser API (docs/library-native-design.md). Search and
// metadata are read-only and uncredentialed, served from the store the image
// builds (LIBRARY_SEARCH_DIR); without one they answer 503. Public analysis is
// reported available only while public analysis mounts the viewer routes.
//
// THE STORES LOAD ON FIRST USE, NOT AT STARTUP. Built before listen(), the
// search and export stores (about 0.8 s of synchronous parsing and ~110 MB of
// heap on one CPU, measured 2026-10-11) pushed the resident server past the
// capacity matrix's 30 s startup gate: Production qualification runs 86 and 87
// failed 4/4 and 3/4 cells with "Connection refused" while run 85, before the
// Library merge, passed. Nothing on the startup path reads them, so the first
// /library/v1 request (or the private bridge's admission) loads them, once,
// synchronously: no request ever sees a half-loaded store. `libraryState`
// reports `not_loaded`, then `ready` (every configured store loaded), `failed`
// (a configured store is unusable; its routes answer 503, as when it is not
// installed, and `libraryState.failures` names it) or `absent` (none
// configured). GET /health reports it without loading anything.
let librarySearch = null;
let libraryExports = null;
let libraryCorpus = null;
// `corpus` is the packages' background hash check: `absent` (not configured),
// `verifying`, `verified`, or `failed` (which also fails the whole state).
const libraryState = { state: 'not_loaded', failures: [], corpus: 'absent' };
const libraryFailed = (store) => {
  if (!libraryState.failures.includes(store)) libraryState.failures.push(store);
  libraryState.state = 'failed';
};
function loadLibraryStores() {
  if (libraryState.state !== 'not_loaded') return;
  const failures = [];
  const configured = ['LIBRARY_SEARCH_DIR', 'LIBRARY_EXPORT_DIR', 'LIBRARY_CORPUS_DIR'].some(
    (name) => process.env[name]
  );
  if (process.env.LIBRARY_SEARCH_DIR) {
    try {
      librarySearch = new LibrarySearch(process.env.LIBRARY_SEARCH_DIR);
    } catch (error) {
      failures.push('search');
      console.error('[library] the search store is unusable; search answers 503:', error.message);
    }
  }
  // Public selection exports (uncredentialed), from the export store the
  // image builds (LIBRARY_EXPORT_DIR); without one they answer 503.
  if (process.env.LIBRARY_EXPORT_DIR) {
    try {
      libraryExports = new ExportStore(process.env.LIBRARY_EXPORT_DIR);
    } catch (error) {
      failures.push('exports');
      console.error('[library] the export store is unusable; exports answer 503:', error.message);
    }
  }
  // Whole-corpus packages (LIBRARY_CORPUS_DIR), installed only when they were
  // built from the same snapshot the search and export stores serve; each is
  // re-hashed in the background and answers 503 until it verifies.
  if (process.env.LIBRARY_CORPUS_DIR) {
    try {
      const corpus = new CorpusPackages(process.env.LIBRARY_CORPUS_DIR);
      const served = [librarySearch, libraryExports].filter(Boolean).map((s) => s.snapshotId);
      if (served.some((id) => id !== corpus.snapshotId))
        throw new Error('the packages were built from a different snapshot');
      libraryCorpus = corpus;
      libraryState.corpus = 'verifying';
      // A package that fails its hash is never served (it answers 503), and
      // the Library is reported failed rather than ready: deploy verification
      // reads this state, so a corrupt package cannot pass as healthy.
      corpus.verify().then(
        (bad) => {
          if (!bad.length) return void (libraryState.corpus = 'verified');
          libraryState.corpus = 'failed';
          libraryFailed('corpus');
          console.error('[library] corpus packages failed verification:', bad.join(', '));
        },
        (error) => {
          libraryState.corpus = 'failed';
          libraryFailed('corpus');
          console.error('[library] corpus verification failed:', error.message);
        }
      );
    } catch (error) {
      libraryState.corpus = 'failed';
      failures.push('corpus');
      console.error(
        '[library] the corpus packages are unusable; corpus answers 503:',
        error.message
      );
    }
  }
  for (const store of failures) libraryFailed(store);
  // A verification that already failed (it cannot finish this early, but the
  // order is not assumed) keeps the state failed.
  if (libraryState.state !== 'failed') libraryState.state = configured ? 'ready' : 'absent';
}
// One download limiter for selection and analysis exports (decision 4).
const libraryStreams = createStreamLimiter();
// Retained definitions: the exact methods and result-schema bytes this image
// analyses with, copied into each new job so its export never borrows a later
// image's.
let libraryDefinitions = null;
try {
  const root = new URL('../lyric-harness/library/', import.meta.url);
  libraryDefinitions = {
    methods: readFileSync(new URL('methods.json', root)),
    result_schema: readFileSync(new URL('schema.json', root)),
  };
} catch (error) {
  console.error('[library] retained definitions are unavailable:', error.message);
}
// Public analysis: on since the native Library tab shipped (LIBRARY_PUBLIC=0
// turns it off), with a running reader and the search store, whose snapshot
// is the one every request is filled with. Mounted before the public router,
// whose refusals would otherwise answer.
const LIBRARY_PUBLIC = process.env.LIBRARY_PUBLIC !== '0';
// Every /library/v1 router, built once the stores have loaded (above), in the
// order they always had: exports, corpus, the viewer routes, then the public
// router.
function buildLibraryRouter() {
  const router = express.Router();
  router.use(
    libraryExportRouter({ exports: libraryExports, corpus: libraryCorpus, streams: libraryStreams })
  );
  router.use(libraryCorpusRouter({ corpus: libraryCorpus }));
  if (LIBRARY_PUBLIC) {
    if (readerScheduler && librarySearch) {
      router.use(
        libraryViewerRouter({
          admission: libraryAdmission(),
          store: readerStore,
          scheduler: readerScheduler,
          prepareRequest: readerResolver.prepareRequest,
          resolveIdentity: readerResolver.resolveIdentity,
          unitOf: (id) => librarySearch.unit(id),
          snapshotId: () => librarySearch.snapshotId,
          exports: libraryExports,
          streams: libraryStreams,
          definitions: () => libraryDefinitions,
          resourceFingerprint: readerResourceFingerprint,
        })
      );
    } else {
      console.error(
        '[library] public analysis is on but the reader or the search store is unavailable; analysis is not mounted.'
      );
    }
  }
  router.use(
    libraryPublicRouter({
      search: librarySearch,
      corpus: libraryCorpus,
      analysisAvailable: () =>
        LIBRARY_PUBLIC && Boolean(librarySearch) && readerReadiness().ready === true,
    })
  );
  return router;
}
let libraryRouter = null;
app.use('/library/v1', (req, res, next) => {
  loadLibraryStores();
  libraryRouter ||= buildLibraryRouter();
  libraryRouter(req, res, next);
});
// After every /library/v1 router: errors raised before routing (a body that
// does not parse) answer JSON, not Express's HTML page.
app.use('/library/v1', libraryErrorHandler);
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
startupTrace('chat ready');
app.use(chatRouter);

// M-230: the process says WHICH BUILD it is. mcp/check_live.mjs compares the
// tool surface, and a change that touches no tool (the M-228/M-229 merge —
// gemini_agent.js only) leaves the surface byte-identical between the old
// process and the new, so the battery's wait-for-live matched the OLD
// deployment on the spot. RENDER_GIT_COMMIT is the sha Render built (set by
// Render in every service's runtime env); null means a runtime that does not
// say, which the probe treats as "not this tree", never as a match.
app.get('/health', (_req, res) => {
  const build = buildIdentity();
  res.json({
    ok: true,
    service: 'codex-musica-mcp',
    lyrics: chatRouter.readiness(),
    queue: lyricCapacity(),
    reader: readerReadiness(),
    // The Library stores' load state (loadLibraryStores above). Reading it
    // never loads them: `not_loaded` until the first /library/v1 request.
    library: {
      state: libraryState.state,
      failures: [...libraryState.failures],
      corpus: libraryState.corpus,
    },
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
    commit: build.commit,
    build,
    recovery: {
      durable: jobStore.durable,
      retention_ms: jobStore.ttlMs,
      records: jobStore.records.size,
      max_records: jobStore.maxRecords,
      max_payload_records: jobStore.maxPayloadRecords,
      healthy: !jobStore.failure,
      sessions: {
        durable: sessionStore.durable,
        retention_ms: sessionStore.ttlMs,
        records: sessionStore.records.size,
        max_records: sessionStore.maxRecords,
        max_payload_records: sessionStore.maxPayloadRecords,
        max_bytes: sessionStore.maxBytes,
        healthy: !sessionStore.failure,
      },
    },
  });
});

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
    build: buildIdentity(),
    assets: {
      ...assets,
      attempts: runtimeAssets.attempts(),
      in_flight: runtimeAssets.inFlight() ?? null,
    },
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
  startupTrace('listening');
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
