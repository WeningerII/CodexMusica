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
// hour); no id list ever appears in a URL or log. The download recomputes
// content_id against the installed store (409 PLAN_STALE on a difference,
// 409 PLAN_EXPIRED for an evicted plan) and streams with an exact
// Content-Length. Every error on the download path is an attachment, so a
// navigation can never replace the page with an error.

const PLAN_TTL_MS = 3_600_000;
const PLAN_CAP = 2000;
const IDLE_MS = 60_000;
const ID = /^reading_[A-Za-z0-9_-]+$/;
const CONTENT = /^[a-f0-9]{64}$/;

export function libraryExportRouter({
  exports: store,
  windows = new Windows(),
  ipOf = clientIp,
  now = Date.now,
}) {
  const router = express.Router();
  const plans = new Map(); // content_id -> {ids, format, at}; insertion order = LRU
  const streams = { global: 0, byIp: new Map() };
  const remember = (cid, plan) => {
    plans.delete(cid);
    plans.set(cid, plan);
    while (plans.size > PLAN_CAP) plans.delete(plans.keys().next().value);
  };
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
          'Download the readable corpus package instead.'
        );
      const cid = contentId(s, ids, format);
      const layout = s.layout(ids, format);
      remember(cid, { ids, format, at: now() });
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
        plans.delete(cid);
        throw exportError(
          'PLAN_EXPIRED',
          'This export plan expired; plan it again.',
          409,
          'Plan the export again from the same selection.'
        );
      }
      if (plan.ids.some((id) => !s.units.has(id)) || contentId(s, plan.ids, plan.format) !== cid) {
        plans.delete(cid);
        throw exportError(
          'PLAN_STALE',
          'The readings changed since this export was planned.',
          409,
          'Plan the export again from the same selection.'
        );
      }
      remember(cid, { ...plan, at: plan.at });
      const layout = s.layout(plan.ids, plan.format);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(layout.bytes));
      res.setHeader('X-Library-Bytes', String(layout.bytes));
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="codex-musica-library-${plan.format}-selection.zip"`
      );
      if (req.method === 'HEAD') return res.status(200).end();
      const ip = ipOf(req);
      const mine = streams.byIp.get(ip) || 0;
      if (
        mine >= LIBRARY_LIMITS.exportStreamsPerIp ||
        streams.global >= LIBRARY_LIMITS.exportStreamsGlobal
      ) {
        for (const h of [
          'Content-Type',
          'Content-Length',
          'X-Library-Bytes',
          'Content-Disposition',
        ])
          res.removeHeader(h);
        throw exportError(
          'RATE_LIMITED',
          'Too many downloads are running; retry shortly.',
          429,
          'Retry after the time in Retry-After.',
          { retryAfter: 10_000 }
        );
      }
      streams.global++;
      streams.byIp.set(ip, mine + 1);
      let released = false;
      release = () => {
        if (released) return;
        released = true;
        streams.global--;
        const n = (streams.byIp.get(ip) || 1) - 1;
        if (n) streams.byIp.set(ip, n);
        else streams.byIp.delete(ip);
      };
      const worker = new Worker(new URL('./library_export_worker.js', import.meta.url), {
        workerData: { directory: s.directory, layout, format: plan.format, snapshot: s.snapshotId },
      });
      let idle = setTimeout(() => res.destroy(), IDLE_MS);
      const finish = () => {
        clearTimeout(idle);
        release();
        worker.terminate().catch(() => {});
      };
      res.on('close', finish);
      worker.on('message', (message) => {
        if (message.chunk) {
          clearTimeout(idle);
          idle = setTimeout(() => res.destroy(), IDLE_MS);
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
