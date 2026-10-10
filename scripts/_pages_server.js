#!/usr/bin/env node
'use strict';
// _pages_server.js — a local stand-in for GitHub Pages, and a strict replayer
// of recorded responses, for the Library timing gate (check_library_perf.js).
//
// WHY THIS EXISTS. The timing gate compares the old Library Site with the
// native Library tab under identical CDP throttling. A comparison is only
// worth reporting when the two sides differ in their client and their bytes
// and in nothing else, so both are served from this one process, with the
// same transfer behaviour and the same (zero, by default) server delay:
//
//   STATIC MODE (`root`): a directory served the way GitHub Pages serves the
//   repo's own pages (docs/library-native-design.md, "Timing gate"):
//     • text types (html, js, mjs, css, json, svg, txt, xml, webmanifest) go
//       out with Content-Encoding: gzip when the request accepts it — zlib
//       level 6, the yardstick check_payload_budget measures with;
//     • a file ending .gz goes out RAW: its stored bytes, Content-Type
//       application/gzip, no Content-Encoding — the reader's gzipped data
//       files are fetched and inflated by the client, never by the browser;
//     • Cache-Control: max-age=600 on every 200, an ETag, and 304 on a
//       matching If-None-Match;
//     • 404 for anything missing, a directory without index.html included
//       (no listings), and a 301 to the trailing-slash form for a directory
//       that has one;
//     • a path that escapes the root after decoding (`%2e%2e`, a NUL, a
//       backslash) is refused with 403 before the filesystem is touched.
//
//   FIXTURE MODE (`fixture`): a JSON file of recorded responses, replayed
//   byte for byte and nothing else. Each entry is
//     { method, url_path_and_query, status, headers, body_base64, sequence? }
//   and is matched on the exact method and the exact path-and-query the
//   browser sent. Several entries for one request form an ORDERED SEQUENCE —
//   ordered by their numeric `sequence`, else by file order — so a manifest
//   that answered 202 three times and then 200 answers the same way here;
//   once a sequence is spent its last response repeats. `sequence` may also
//   be an array of {status, headers, body_base64} steps on one entry.
//   `reset()` rewinds every sequence, and the gate calls it before each fresh
//   browser context so every run sees the recorded exchange from its start.
//   The body goes out exactly as stored, with the recorded headers (and their
//   Content-Encoding) except the hop-by-hop ones and Content-Length, which is
//   recomputed. The file may instead be { provenance, responses: [...] }; the
//   provenance (date, runner, URL list) is handed back for the report.
//
//   STRICT NO-LIVE FALLBACK. Any request a fixture does not hold is answered
//   599 and recorded; `unmatched()` returns the list, and the gate refuses to
//   report a comparison from a run that produced one. There is no proxying to
//   the live host, ever: a fixture that has gone stale fails loudly instead
//   of quietly measuring the network.
//
//   DELAYS. Zero by default, in both modes. `delays` is an optional table
//   { "<path prefix>": ms } — the measured old-Site server time per endpoint
//   (TTFB minus a same-connection RTT) for the "synthetic-modelled" profile.
//   The longest matching prefix wins, and the delay is applied before the
//   first byte, as server think-time would be.
//
// API:
//   const { start } = require('./_pages_server');
//   const srv = await start({ root | fixture, port = 0, delays, host });
//   srv.url          'http://127.0.0.1:PORT'
//   srv.unmatched()  [{ method, url, at }]        (fixture mode; [] in static)
//   srv.requests()   [{ method, url, status, at }] every request answered
//   srv.reset()      rewind fixture sequences
//   srv.provenance   fixture provenance (+ file, sha256), or null
//   await srv.close()
//
// CLI:
//   node scripts/_pages_server.js --root=DIR [--port=N] [--delays=FILE]
//   node scripts/_pages_server.js --fixture=FILE [--port=N] [--delays=FILE]
// Serves until interrupted; prints each unmatched request to stderr, and on
// exit the unmatched count (exit 1 when there was any).

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const zlib = require('node:zlib');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
};
// The extensions Pages compresses on the fly. A .gz is never one of them.
const GZIP_EXT = new Set([
  '.html',
  '.htm',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.webmanifest',
  '.svg',
  '.txt',
  '.xml',
  '.map',
]);
const CACHE_CONTROL = 'max-age=600';
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-length',
  'upgrade',
  'proxy-connection',
  'te',
  'trailer',
]);

function loadJson(fileOrObject) {
  if (fileOrObject == null) return null;
  if (typeof fileOrObject === 'object') return fileOrObject;
  return JSON.parse(fs.readFileSync(fileOrObject, 'utf8'));
}

// Longest matching prefix of the delay table, or 0.
function delayFor(delays, urlPath) {
  let best = -1;
  let ms = 0;
  for (const [prefix, v] of Object.entries(delays || {})) {
    if (urlPath.startsWith(prefix) && prefix.length > best) {
      best = prefix.length;
      ms = Number(v) || 0;
    }
  }
  return Math.max(0, ms);
}

// Fixture entries → Map<"METHOD path?query", [step...]>, each step
// { status, headers, body }.
function compileFixture(raw) {
  const list = Array.isArray(raw)
    ? raw
    : raw && Array.isArray(raw.responses)
      ? raw.responses
      : null;
  if (!list) throw new Error('fixture: expected an array of responses or { responses: [...] }');
  const groups = new Map();
  list.forEach((e, i) => {
    if (!e || typeof e.url_path_and_query !== 'string' || !e.url_path_and_query.startsWith('/')) {
      throw new Error(`fixture entry ${i}: url_path_and_query must be a string starting with "/"`);
    }
    const key = String(e.method || 'GET').toUpperCase() + ' ' + e.url_path_and_query;
    const steps = Array.isArray(e.sequence) ? e.sequence : [e];
    steps.forEach((s, j) => {
      const status = Number(s.status);
      if (!Number.isInteger(status) || status < 100 || status > 599) {
        throw new Error(`fixture entry ${i}${steps.length > 1 ? ` step ${j}` : ''}: bad status`);
      }
      const order = Array.isArray(e.sequence)
        ? i * 1e6 + j
        : Number.isFinite(e.sequence)
          ? Number(e.sequence)
          : i * 1e6;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({
        order,
        index: i,
        status,
        headers: s.headers || {},
        body: Buffer.from(s.body_base64 || '', 'base64'),
      });
    });
  });
  for (const steps of groups.values()) steps.sort((a, b) => a.order - b.order || a.index - b.index);
  return groups;
}

// Resolve a request path inside root, or null when it escapes.
function resolveInside(root, rawPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/');
  if (segments.some((s) => s === '..')) return null;
  const full = path.resolve(root, '.' + path.posix.normalize('/' + decoded));
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function acceptsGzip(req) {
  return /\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''));
}

async function start(opts = {}) {
  const { port = 0, host = '127.0.0.1' } = opts;
  if (!opts.root === !opts.fixture)
    throw new Error('_pages_server: pass exactly one of root, fixture');
  const delays = loadJson(opts.delays) || {};
  const root = opts.root ? fs.realpathSync(path.resolve(opts.root)) : null;
  let groups = null;
  let provenance = null;
  if (opts.fixture) {
    const raw = loadJson(opts.fixture);
    groups = compileFixture(raw);
    provenance = Object.assign({}, (raw && !Array.isArray(raw) && raw.provenance) || {});
    if (typeof opts.fixture === 'string') {
      provenance.file = path.resolve(opts.fixture);
      provenance.sha256 = crypto
        .createHash('sha256')
        .update(fs.readFileSync(opts.fixture))
        .digest('hex');
    }
    provenance.entries = [...groups.values()].reduce((n, g) => n + g.length, 0);
  }
  const allowMissing = new Set(opts.allowMissing || []);
  const cursors = new Map();
  const unmatched = [];
  const log = [];
  const gzCache = new Map();

  function finish(req, res, status, headers, body) {
    log.push({ method: req.method, url: req.url, status, at: Date.now() });
    res.writeHead(status, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  function serveFixture(req, res) {
    const key = req.method + ' ' + req.url;
    const steps = groups.get(key);
    if (!steps) {
      const pathname = req.url.split('?')[0];
      if (allowMissing.has(pathname)) {
        return finish(req, res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
      }
      unmatched.push({ method: req.method, url: req.url, at: Date.now() });
      return finish(
        req,
        res,
        599,
        { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        'unmatched fixture request: ' + key
      );
    }
    const i = cursors.get(key) || 0;
    const step = steps[Math.min(i, steps.length - 1)];
    cursors.set(key, i + 1);
    const headers = {};
    for (const [k, v] of Object.entries(step.headers)) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = v;
    }
    headers['Content-Length'] = String(step.body.length);
    return finish(req, res, step.status, headers, step.body);
  }

  function serveStatic(req, res) {
    const rawPath = req.url.split('?')[0].split('#')[0];
    const full = resolveInside(root, rawPath);
    if (!full) return finish(req, res, 403, { 'Content-Type': 'text/plain' }, 'Forbidden');
    let file = full;
    let st;
    try {
      st = fs.statSync(file);
      if (st.isDirectory()) {
        const index = path.join(file, 'index.html');
        if (!fs.existsSync(index)) throw new Error('no index');
        if (!rawPath.endsWith('/')) {
          const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
          return finish(req, res, 301, { Location: rawPath + '/' + q }, '');
        }
        file = index;
        st = fs.statSync(file);
      }
      if (!st.isFile()) throw new Error('not a file');
    } catch {
      return finish(req, res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found');
    }
    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': type,
      'Cache-Control': CACHE_CONTROL,
      ETag: etag,
      'Last-Modified': st.mtime.toUTCString(),
    };
    if (req.headers['if-none-match'] === etag) return finish(req, res, 304, headers, '');
    let body = fs.readFileSync(file);
    if (GZIP_EXT.has(ext)) {
      headers.Vary = 'Accept-Encoding';
      if (acceptsGzip(req)) {
        const ck = file + '\0' + etag;
        if (!gzCache.has(ck)) gzCache.set(ck, zlib.gzipSync(body, { level: 6 }));
        body = gzCache.get(ck);
        headers['Content-Encoding'] = 'gzip';
      }
    }
    headers['Content-Length'] = String(body.length);
    return finish(req, res, 200, headers, body);
  }

  const server = http.createServer((req, res) => {
    const ms = delayFor(delays, req.url);
    const go = () => {
      if (groups) return serveFixture(req, res);
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return finish(req, res, 405, { Allow: 'GET, HEAD' }, 'Method not allowed');
      }
      return serveStatic(req, res);
    };
    if (ms > 0) setTimeout(go, ms);
    else go();
  });
  server.keepAliveTimeout = 5000;
  const sockets = new Set();
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const addr = server.address();
  return {
    url: `http://${host}:${addr.port}`,
    mode: groups ? 'fixture' : 'static',
    provenance,
    unmatched: () => unmatched.slice(),
    requests: () => log.slice(),
    reset() {
      cursors.clear();
    },
    close: () =>
      new Promise((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

module.exports = { start, compileFixture, resolveInside, delayFor, MIME, GZIP_EXT };

if (require.main === module) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
      if (!m) {
        console.error(
          'usage: _pages_server.js --root=DIR | --fixture=FILE [--port=N] [--delays=FILE]'
        );
        process.exit(2);
      }
      return [m[1], m[2] === undefined ? true : m[2]];
    })
  );
  start({
    root: args.root,
    fixture: args.fixture,
    delays: args.delays,
    port: Number(args.port || 0),
    allowMissing: args['allow-missing'] ? String(args['allow-missing']).split(',') : [],
  })
    .then((srv) => {
      console.log(`serving ${srv.mode} at ${srv.url}`);
      let seen = 0;
      const tick = setInterval(() => {
        const u = srv.unmatched();
        for (; seen < u.length; seen++)
          console.error(`599 unmatched: ${u[seen].method} ${u[seen].url}`);
      }, 250);
      const stop = () => {
        clearInterval(tick);
        const n = srv.unmatched().length;
        console.log(`unmatched requests: ${n}`);
        srv.close().then(() => process.exit(n ? 1 : 0));
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    })
    .catch((e) => {
      console.error(e.message);
      process.exit(2);
    });
}
