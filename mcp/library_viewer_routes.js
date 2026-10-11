// Credentialed /library/v1 viewer routes: the native Library tab's analyses
// (docs/library-native-design.md, "Analysis and identity").
//
// Mounted only when LIBRARY_PUBLIC=1. Jobs share the reader-jobs-v1 store,
// admission and scheduler with the Site bridge (/internal/reader), and create
// runs the same pipeline (reader_routes.createAnalysisJob).
//
// Identity. A random, unsigned, HttpOnly cookie:
//   __Host-cm_library=<43-char base64url of 32 random bytes>
//   Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000
// minted only by POST /analyses when no valid cookie is present (so a GET
// never creates state), and slid on every viewer response. The store viewer is
// 'lv1:' + sha256hex(value). The per-job capability is re-derived from the
// path's job id and the cookie's viewer on every call (store.capabilityFor)
// and never leaves the process: not in a response, URL, log or the client.
//
// Every response is Cache-Control: private, no-store. Another viewer's job is
// 404. Methods route strictly. Limits are owner decision 4 (LIBRARY_LIMITS).
import crypto from 'node:crypto';
import express from 'express';
import { publicReaderJob, validateRequest, createAnalysisJob } from './reader_routes.js';
import { LIBRARY_LIMITS, Windows, clientIp } from './ratelimit.js';

export const VIEWER_COOKIE = '__Host-cm_library';
const COOKIE_VALUE = /^[A-Za-z0-9_-]{43}$/;
const MAX_AGE = 30 * 24 * 3600;
const HASH = /^[a-f0-9]{64}$/;
const HOUR = 3_600_000;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

class ViewerError extends Error {
  constructor(code, message, status, extra = {}) {
    super(message);
    Object.assign(this, { code, status, extra });
  }
}
const fail = (code, message, status = 400, extra) => new ViewerError(code, message, status, extra);

export function viewerOf(value) {
  return `lv1:${sha256(value)}`;
}
function readCookie(req) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    if (part.slice(0, at).trim() !== VIEWER_COOKIE) continue;
    const value = part.slice(at + 1).trim();
    if (COOKIE_VALUE.test(value)) return value;
  }
  return null;
}
const cookieHeader = (value) =>
  `${VIEWER_COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}`;

const REMEDY = {
  RATE_LIMITED: 'Retry after the time in Retry-After.',
  LONG_READING_BUSY: 'Another long reading is being analysed; retry after the time in Retry-After.',
  QUEUE_FULL: 'The analysis queue is full; retry shortly.',
  STALE_READING: 'Reload the reading: it was updated, and analysis runs on the current revision.',
  STORE_RECOUNTING: 'Retry shortly.',
  RESOURCE_LIMIT: 'Free storage by deleting earlier analyses, or retry later.',
};

/**
 * @param {object} o
 * @param {import('./reader_job_store.js').ReaderJobStore} o.store
 * @param {{kick(): void}} o.scheduler
 * @param {(request) => Promise<object>} o.prepareRequest
 * @param {(request) => Promise<object>} o.resolveIdentity
 * @param {(id: string) => ({availability, revision, lines} | null)} o.unitOf
 *   the installed snapshot's view of a unit (LibrarySearch.unit)
 * @param {() => string} o.snapshotId the installed snapshot, filled into every request
 */
export function libraryViewerRouter({
  store,
  scheduler,
  prepareRequest,
  resolveIdentity,
  unitOf,
  snapshotId,
  windows = new Windows(),
  ipOf = clientIp,
  now = Date.now,
}) {
  const router = express.Router();
  const jobsByIp = new Map(); // ip -> Set(job id): the per-address outstanding ceiling

  const limit = (key, windowMs, max) => {
    const hit = windows.hit(key, windowMs, max, now());
    if (!hit.ok)
      throw fail('RATE_LIMITED', 'Too many requests; retry shortly.', 429, {
        retryAfter: hit.retryAfter,
      });
  };
  const handler = (fn) => (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    Promise.resolve()
      .then(() => fn(req, res))
      .catch(next);
  };
  // The viewer for a read or control: no cookie is simply no job (404).
  const viewerFor = (req, res) => {
    const value = readCookie(req);
    if (!value) throw fail('NOT_FOUND', 'Reader job does not exist.', 404);
    res.setHeader('Set-Cookie', cookieHeader(value)); // slide Max-Age
    return viewerOf(value);
  };
  const jobFor = (req, res) => {
    const viewer = viewerFor(req, res);
    const capability = store.capabilityFor(req.params.id, viewer);
    return { viewer, capability, record: store.get(req.params.id, capability, viewer) };
  };
  const outstanding = (id) => {
    try {
      return ['queued', 'running', 'paused'].includes(store.inspect(id).state);
    } catch {
      return false;
    }
  };
  const longJobBusy = () => {
    for (const record of store.records.values()) {
      if (!['queued', 'running'].includes(record.state)) continue;
      if (record.expires_at <= now()) continue;
      const unit = unitOf(record.request?.reading_unit_id);
      if (unit && unit.lines > LIBRARY_LIMITS.longReadingLines) return true;
    }
    return false;
  };
  const control = (req) => {
    const key = req.get('Idempotency-Key');
    if (!key || key.length > 200)
      throw fail('BAD_REQUEST', 'An Idempotency-Key header (at most 200 characters) is required.');
    return { idempotency_key: key };
  };
  const jsonOnly = (req) => {
    if (!req.is('application/json'))
      throw fail('UNSUPPORTED_MEDIA_TYPE', 'Send application/json.', 415);
  };

  router.post(
    '/analyses',
    handler(async (req, res) => {
      jsonOnly(req);
      const ip = ipOf(req);
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body))
        throw fail('BAD_REQUEST', 'The analysis request must be a JSON object.');
      if ('snapshot_id' in body)
        throw fail('BAD_REQUEST', 'The server chooses the snapshot; do not send snapshot_id.');
      const key = body.idempotency_key;
      if (typeof key !== 'string' || !key || key.length > 200)
        throw fail('BAD_REQUEST', 'An idempotency_key (at most 200 characters) is required.');
      const request = validateRequest({ ...body, snapshot_id: snapshotId() });
      const unit = unitOf(request.reading_unit_id);
      if (!unit) throw fail('NOT_FOUND', 'This reading is not in the snapshot.', 404);
      if (unit.availability !== 'readable')
        throw fail(
          'READING_UNAVAILABLE',
          'This reading is held or available only as metadata.',
          403
        );
      if (unit.revision !== request.reading_revision)
        throw fail('STALE_READING', 'This reading was updated since it was loaded.', 409, {
          current_revision: unit.revision,
        });

      let value = readCookie(req);
      const existing =
        value &&
        [...store.records.values()].find(
          (r) =>
            r.viewer === viewerOf(value) &&
            r.request?.idempotency_key === key &&
            !['expired', 'deleted'].includes(r.state)
        );
      if (!existing) {
        limit(`library-creates-ip:${ip}`, HOUR, LIBRARY_LIMITS.createsPerIpPerHour);
        if (!value) {
          limit(`library-mints:${ip}`, HOUR, LIBRARY_LIMITS.mintsPerIpPerHour);
          value = crypto.randomBytes(32).toString('base64url');
        }
        limit(
          `library-creates-viewer:${viewerOf(value)}`,
          HOUR,
          LIBRARY_LIMITS.createsPerViewerPerHour
        );
        const mine = jobsByIp.get(ip) || new Set();
        for (const id of mine) if (!outstanding(id)) mine.delete(id);
        if (mine.size >= LIBRARY_LIMITS.outstandingPerIp)
          throw fail(
            'RATE_LIMITED',
            'Too many analyses are running from this network address.',
            429,
            {
              retryAfter: 60_000,
            }
          );
        if (unit.lines > LIBRARY_LIMITS.longReadingLines && longJobBusy())
          throw fail('LONG_READING_BUSY', 'Another long reading is being analysed.', 429, {
            retryAfter: 60_000,
          });
      }
      res.setHeader('Set-Cookie', cookieHeader(value));
      const result = await createAnalysisJob({
        store,
        scheduler,
        prepareRequest,
        resolveIdentity,
        viewer: viewerOf(value),
        idempotencyKey: key,
        request,
      });
      if (result.created) {
        if (!jobsByIp.has(ip)) jobsByIp.set(ip, new Set());
        jobsByIp.get(ip).add(result.record.id);
      }
      res
        .status(result.created ? 202 : 200)
        .json({ contract_version: 1, job: publicReaderJob(result.record) });
    })
  );

  const read = (fn) =>
    handler((req, res) => {
      limit(`library-reads:${ipOf(req)}`, 60_000, LIBRARY_LIMITS.jobReadsPerIpPerMinute);
      return fn(req, res);
    });
  const act = (fn) =>
    handler((req, res) => {
      jsonOnlyOrEmpty(req);
      const viewer = viewerFor(req, res);
      limit(`library-controls:${viewer}`, HOUR, LIBRARY_LIMITS.controlsPerViewerPerHour);
      return fn(req, res);
    });
  // A control may carry no body; one that does must be JSON (forcing a preflight).
  const jsonOnlyOrEmpty = (req) => {
    if (req.headers['content-length'] && req.headers['content-length'] !== '0') jsonOnly(req);
  };

  router.get(
    '/jobs/:id',
    read((req, res) => {
      const { record } = jobFor(req, res);
      res.json({ contract_version: 1, job: publicReaderJob(record) });
    })
  );
  router.post(
    '/jobs/:id/cancel',
    act((req, res) => {
      const { viewer, capability } = jobFor(req, res);
      const result = store.cancel(req.params.id, capability, viewer, control(req));
      res.json({ contract_version: 1, job: publicReaderJob(result) });
    })
  );
  router.post(
    '/jobs/:id/resume',
    act(async (req, res) => {
      const { viewer, capability, record } = jobFor(req, res);
      const identity = await resolveIdentity(record.request);
      const result = store.resume(record.id, capability, viewer, identity, control(req));
      scheduler.kick();
      res.status(202).json({ contract_version: 1, job: publicReaderJob(result) });
    })
  );
  router.delete(
    '/jobs/:id',
    act((req, res) => {
      const viewer = viewerFor(req, res);
      const capability = store.capabilityFor(req.params.id, viewer);
      store.delete(req.params.id, capability, viewer, control(req));
      res.json({ contract_version: 1, deleted: true, job_id: req.params.id });
    })
  );
  const immutable = (res, value, hash) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    if (sha256(bytes) !== hash)
      throw fail('STORAGE_CORRUPT', 'The immutable object hash does not match.', 503);
    res.set('X-Library-SHA256', hash).type('application/json').send(bytes);
  };
  router.get(
    '/jobs/:id/manifests/:sha',
    read((req, res) => {
      if (!HASH.test(req.params.sha)) throw fail('BAD_REQUEST', 'A manifest hash is required.');
      const { viewer, capability } = jobFor(req, res);
      immutable(
        res,
        store.readManifest(req.params.id, capability, viewer, req.params.sha),
        req.params.sha
      );
    })
  );
  router.get(
    '/jobs/:id/manifests/:sha/pages',
    read((req, res) => {
      if (!HASH.test(req.params.sha))
        throw fail('BAD_REQUEST', 'A fixed manifest hash is required.');
      const offset = Number(req.query.offset ?? 0);
      const pageLimit = Number(req.query.limit ?? 100);
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(pageLimit) ||
        pageLimit < 1 ||
        pageLimit > 250
      )
        throw fail(
          'BAD_REQUEST',
          'Manifest pagination needs a nonnegative offset and limit from 1 to 250.'
        );
      const { viewer, capability } = jobFor(req, res);
      res.json(
        store.readManifestPage(req.params.id, capability, viewer, req.params.sha, {
          offset,
          limit: pageLimit,
        })
      );
    })
  );
  router.get(
    '/jobs/:id/pages/:sha',
    read((req, res) => {
      if (!HASH.test(req.params.sha) || !HASH.test(String(req.query.manifest || '')))
        throw fail('BAD_REQUEST', 'Page reads require a page hash and a fixed manifest hash.');
      const { viewer, capability } = jobFor(req, res);
      immutable(
        res,
        store.readPage(req.params.id, req.params.sha, capability, viewer, req.query.manifest),
        req.params.sha
      );
    })
  );

  // Strict routing: anything else on these paths is 404, never a read.
  router.use(['/analyses', '/jobs'], (req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next(fail('NOT_FOUND', 'No such Library route.', 404));
  });
  router.use(['/analyses', '/jobs'], (error, _req, res, _next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const status =
      error.status || (['RESOURCE_LIMIT', 'QUEUE_FULL'].includes(error.code) ? 429 : 400);
    const retryAfter =
      error.extra?.retryAfter ??
      (['QUEUE_FULL', 'STORE_RECOUNTING'].includes(error.code) ? 5_000 : null);
    if (retryAfter != null)
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfter / 1000))));
    const { retryAfter: _hidden, ...extra } = error.extra || {};
    res.status(status).json({
      error: {
        code: error.code || 'LIBRARY_ERROR',
        message: error.message,
        remedy: REMEDY[error.code] || 'Check the request and retry explicitly.',
        ...extra,
      },
    });
  });
  return router;
}

/** Paths whose CORS responses carry Access-Control-Allow-Credentials. */
export function isViewerPath(url) {
  return /^\/library\/v1\/(?:analyses|jobs)(?:[/?]|$)/.test(url);
}
