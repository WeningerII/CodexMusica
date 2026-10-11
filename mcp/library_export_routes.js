// Public selection-export routes (docs/library-native-design.md,
// "Selection exports"). The ZIP itself (library_exports.js) depends on Node
// built-ins only, so the image build and the golden replay need no server
// packages, and each generation worker loads nothing it does not use.
import { Worker } from 'node:worker_threads';
import express from 'express';
import { LIBRARY_LIMITS, Windows, clientIp } from './ratelimit.js';
import { ExportError, FORMATS, contentId, exportError } from './library_exports.js';

//   POST /library/v1/exports/plan   {reading_unit_ids, format}
//   HEAD|GET /library/v1/exports/p/<content_id>.zip
// Uncredentialed. A plan is held in a process-local LRU (2,000 plans, one
// hour, and at most PLAN_BYTES of selections, counted exactly: a plan keeps
// its readings as 4-byte indices into the installed store's sorted id list);
// no id list ever appears in a URL or log. The download recomputes
// content_id against the installed store (409 PLAN_STALE on a difference,
// 409 PLAN_EXPIRED for an evicted plan) and streams with an exact
// Content-Length, cut when it stalls or crawls (guardStream). Every error on the download path is an attachment, so a
// navigation can never replace the page with an error.

const PLAN_TTL_MS = 3_600_000;
const PLAN_CAP = 2000;
// The plan cache's memory budget (the design's "about 9 MB"). A near-corpus
// selection costs about 100 KB, so about 90 such plans fit; the newest plan
// is always kept, so no selection is ever refused for its size.
const PLAN_BYTES = 9 * 1024 * 1024;
const PLAN_OVERHEAD = 128;
const ID = /^reading_[A-Za-z0-9_-]+$/;
const CONTENT = /^[a-f0-9]{64}$/;

/**
 * Concurrent download streams. The default, shared by selection and analysis
 * exports, allows 2 per address and 4 service-wide; corpus packages use their
 * own limiter (2 service-wide, no per-address cap) (decision 4). acquire()
 * throws a 429 ExportError or returns an idempotent release.
 */
export function createStreamLimiter({
  perIp = LIBRARY_LIMITS.exportStreamsPerIp,
  global = LIBRARY_LIMITS.exportStreamsGlobal,
} = {}) {
  const counts = { global: 0, byIp: new Map() };
  return {
    acquire(ip) {
      const mine = counts.byIp.get(ip) || 0;
      if (mine >= perIp || counts.global >= global)
        throw exportError(
          'RATE_LIMITED',
          'Too many downloads are running; retry shortly.',
          429,
          'Retry after the time in Retry-After.',
          { retryAfter: 10_000 }
        );
      counts.global++;
      counts.byIp.set(ip, mine + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        counts.global--;
        const n = (counts.byIp.get(ip) || 1) - 1;
        if (n) counts.byIp.set(ip, n);
        else counts.byIp.delete(ip);
      };
    },
  };
}

/**
 * Cuts a download that stalls (no progress for idleMs) or crawls (fewer than
 * minBytesPerSecond leave over a windowMs window), so a slow or abandoned
 * client cannot hold one of the few stream slots.
 *
 * Progress is read from two public signals: movement of socket.bytesWritten,
 * and the completion of this response's own write callbacks (a write's
 * callback runs once the socket has handed that write on, so a client draining
 * a stream of chunks completes them steadily). A write that is still
 * outstanding gives neither signal while the client drains it (over TLS
 * bytesWritten counts plaintext the moment it is queued), and the guard cannot
 * tell that client from a stalled one. So the idle limit is absolute: no
 * movement for idleMs cuts, whatever is outstanding. Writers keep each write
 * to STREAM_WRITE_BYTES, which a reader at the floor drains well inside the
 * idle window. Only the crawl check falls back to wall clock while a write is
 * outstanding: the outstanding bytes get the time a reader at
 * minBytesPerSecond needs before a window can count against them. Nothing
 * private (the socket handle's writeQueueSize) is read. The guard stops when
 * the response finishes or closes.
 */
// The largest single write a guarded download makes: at the default floor
// (4096 B/s) it drains in 16 s, inside the 60 s idle window.
export const STREAM_WRITE_BYTES = 1 << 16;

export function guardStream(
  res,
  {
    idleMs = LIBRARY_LIMITS.streamIdleMs,
    minBytesPerSecond = LIBRARY_LIMITS.streamMinBytesPerSecond,
    windowMs = LIBRARY_LIMITS.streamRateWindowMs,
    tickMs = Math.min(1000, idleMs / 4),
  } = {}
) {
  const queued = () => {
    const written = res.socket?.bytesWritten;
    return Number.isFinite(written) ? written : 0;
  };
  let lastQueued = queued();
  let lastMoved = Date.now();
  let pending = 0; // bytes of this response's writes not yet called back
  let completed = 0; // bytes of this response's writes called back
  let stopped = false;
  const moved = () => {
    lastMoved = Date.now();
  };
  const sizeOf = (chunk, encoding) =>
    chunk == null
      ? 0
      : typeof chunk === 'string'
        ? Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : 'utf8')
        : chunk.byteLength || chunk.length || 0;
  const write = typeof res.write === 'function' ? res.write : null;
  if (write) {
    res.write = function guardedWrite(chunk, encoding, callback) {
      if (typeof encoding === 'function') [encoding, callback] = [undefined, encoding];
      const bytes = sizeOf(chunk, encoding);
      pending += bytes;
      const done = (error) => {
        pending -= bytes;
        completed += bytes;
        if (!stopped) moved();
        if (callback) callback(error);
      };
      return encoding === undefined
        ? write.call(this, chunk, done)
        : write.call(this, chunk, encoding, done);
    };
  }
  // end()'s data is outstanding until 'finish', which stops the guard.
  const end = typeof res.end === 'function' ? res.end : null;
  if (end) {
    res.end = function guardedEnd(chunk, encoding, ...rest) {
      if (typeof chunk !== 'function') pending += sizeOf(chunk, encoding);
      return end.call(this, chunk, encoding, ...rest);
    };
  }
  // The rate counts bytes the socket has taken: completed writes where they
  // are observed, else bytesWritten.
  const progress = () => (write ? completed : queued());
  // The crawl check's wall-clock allowance while an outstanding write hides
  // its progress. Never consulted by the idle check.
  const waiting = () =>
    pending > 0 && Date.now() - lastMoved < (pending * 1000) / minBytesPerSecond;
  const cut = () => res.destroy();
  let windowStart = progress();
  const idle = setInterval(() => {
    const now = queued();
    if (now !== lastQueued) {
      lastQueued = now;
      moved();
    } else if (Date.now() - lastMoved >= idleMs) cut();
  }, tickMs);
  const rate = setInterval(() => {
    const now = progress();
    if (now - windowStart < (minBytesPerSecond * windowMs) / 1000 && !waiting()) cut();
    windowStart = now;
  }, windowMs);
  const stop = () => {
    stopped = true;
    clearInterval(idle);
    clearInterval(rate);
  };
  res.on('finish', stop);
  res.on('close', stop);
  return { stop };
}

export { PLAN_BYTES };
export function libraryExportRouter({
  exports: store,
  corpus = null,
  streams = createStreamLimiter(),
  guard = guardStream,
  windows = new Windows(),
  ipOf = clientIp,
  now = Date.now,
  planBytes = PLAN_BYTES,
}) {
  const router = express.Router();
  // content_id -> {store, indices, format, at, bytes}; insertion order = LRU
  const plans = new Map();
  let held = 0;
  const forget = (cid) => {
    const plan = plans.get(cid);
    if (!plan) return;
    held -= plan.bytes;
    plans.delete(cid);
  };
  const remember = (cid, plan) => {
    forget(cid);
    plans.set(cid, plan);
    held += plan.bytes;
    while (plans.size > 1 && (plans.size > PLAN_CAP || held > planBytes))
      forget(plans.keys().next().value);
  };
  const planOf = (s, ids, format) => {
    const indices = Uint32Array.from(ids, (id) => s.indexOf.get(id));
    return { store: s, indices, format, at: now(), bytes: indices.byteLength + PLAN_OVERHEAD };
  };
  const idsOf = (plan) => Array.from(plan.indices, (i) => plan.store.ids[i]);
  const json = (res, status, body, attachment = false) => {
    res.setHeader('Cache-Control', 'no-store');
    if (attachment) {
      res.setHeader('Content-Disposition', 'attachment; filename="library-download-error.txt"');
      res
        .status(status)
        .type('text/plain')
        .send(JSON.stringify(body, null, 2) + '\n');
    } else res.status(status).json(body);
  };
  const failWith = (res, error, attachment) => {
    if (!(error instanceof ExportError)) throw error;
    if (error.extra?.retryAfter)
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(error.extra.retryAfter / 1000))));
    const { retryAfter: _hidden, ...extra } = error.extra || {};
    json(
      res,
      error.status,
      { error: { code: error.code, message: error.message, remedy: error.remedy, ...extra } },
      attachment
    );
  };
  const limit = (key, windowMs, max) => {
    const hit = windows.hit(key, windowMs, max, now());
    if (!hit.ok)
      throw exportError(
        'RATE_LIMITED',
        'Too many export requests; retry shortly.',
        429,
        'Retry after the time in Retry-After.',
        { retryAfter: hit.retryAfter }
      );
  };
  const requireStore = () => {
    if (!store)
      throw exportError(
        'EXPORT_UNAVAILABLE',
        'Library exports are not installed on this service.',
        503,
        'Retry later.'
      );
    return store;
  };

  router.post('/exports/plan', (req, res) => {
    try {
      const s = requireStore();
      if (!req.is('application/json'))
        throw exportError('UNSUPPORTED_MEDIA_TYPE', 'Send application/json.', 415);
      limit(`library-plans:${ipOf(req)}`, 3_600_000, LIBRARY_LIMITS.exportPlansPerIpPerHour);
      const { reading_unit_ids: raw, format } = req.body || {};
      if (!FORMATS.includes(format)) throw exportError('BAD_REQUEST', 'Choose Text, JSON or CSV.');
      if (
        !Array.isArray(raw) ||
        !raw.length ||
        raw.some((id) => typeof id !== 'string' || !ID.test(id))
      )
        throw exportError('BAD_REQUEST', 'Choose a nonempty pinned reading selection.');
      const ids = [...new Set(raw)].sort();
      const missing = ids.filter((id) => !s.units.has(id));
      if (missing.length)
        throw exportError(
          'SELECTION_UNAVAILABLE',
          'The selection contains an unknown or unadmitted reading.',
          409,
          'Remove unavailable items or explicitly choose the remaining readable selection.',
          { reading_unit_ids: missing.slice(0, 100), unavailable_count: missing.length }
        );
      if (ids.length === s.store.readable_count)
        throw exportError(
          'USE_CORPUS_PACKAGE',
          'The whole readable corpus is exported as a prebuilt package.',
          409,
          'Download the readable corpus package instead.',
          corpus?.urlFor(format) ? { url: corpus.urlFor(format) } : {}
        );
      const cid = contentId(s, ids, format);
      const layout = s.layout(ids, format);
      remember(cid, planOf(s, ids, format));
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        content_id: cid,
        bytes: layout.bytes,
        entries: layout.entries.length,
        url: `/library/v1/exports/p/${cid}.zip`,
      });
    } catch (error) {
      failWith(res, error, false);
    }
  });

  const download = (req, res) => {
    let release = null;
    try {
      const s = requireStore();
      const cid = req.params.cid;
      if (!CONTENT.test(cid)) throw exportError('NOT_FOUND', 'No such export.', 404);
      const plan = plans.get(cid);
      if (!plan || now() - plan.at > PLAN_TTL_MS) {
        forget(cid);
        throw exportError(
          'PLAN_EXPIRED',
          'This export plan expired; plan it again.',
          409,
          'Plan the export again from the same selection.'
        );
      }
      const ids = plan.store === s ? idsOf(plan) : null;
      if (!ids || ids.some((id) => !s.units.has(id)) || contentId(s, ids, plan.format) !== cid) {
        forget(cid);
        throw exportError(
          'PLAN_STALE',
          'The readings changed since this export was planned.',
          409,
          'Plan the export again from the same selection.'
        );
      }
      remember(cid, plan);
      const layout = s.layout(ids, plan.format);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(layout.bytes));
      res.setHeader('X-Library-Bytes', String(layout.bytes));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="codex-musica-library-${plan.format}-selection.zip"`
      );
      if (req.method === 'HEAD') return res.status(200).end();
      try {
        release = streams.acquire(ipOf(req));
      } catch (error) {
        for (const h of [
          'Content-Type',
          'Content-Length',
          'X-Library-Bytes',
          'Content-Disposition',
        ])
          res.removeHeader(h);
        throw error;
      }
      const worker = new Worker(new URL('./library_export_worker.js', import.meta.url), {
        workerData: { directory: s.directory, layout, format: plan.format, snapshot: s.snapshotId },
      });
      const pace = guard(res);
      const finish = () => {
        pace.stop();
        release();
        worker.terminate().catch(() => {});
      };
      res.on('close', finish);
      worker.on('message', (message) => {
        if (message.chunk) {
          const flowing = res.write(Buffer.from(message.chunk));
          if (flowing) worker.postMessage('more');
          else res.once('drain', () => worker.postMessage('more'));
        } else if (message.done) {
          res.end();
        } else if (message.error) {
          // Headers and part of the body are gone; a truncated ZIP of the
          // announced length can never be mistaken for a complete one.
          console.error(
            '[library] export stream refused:',
            message.error.code,
            message.error.message
          );
          res.destroy();
        }
      });
      worker.on('error', (error) => {
        console.error('[library] export worker failed:', error.message);
        res.destroy();
      });
    } catch (error) {
      if (release) release();
      failWith(res, error, true);
    }
  };
  router.head('/exports/p/:cid.zip', download);
  router.get('/exports/p/:cid.zip', download);
  return router;
}
