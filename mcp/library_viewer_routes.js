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
import { Worker } from 'node:worker_threads';
import { analysisLayout, analysisTail, canonical } from './library_exports.js';
import { createStreamLimiter, guardStream } from './library_export_routes.js';
import { createAdmission } from './library_admission.js';

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
  EXPORT_READING_CHANGED: 'Run the analysis again on the current reading.',
  EXPORT_DEFINITIONS_UNAVAILABLE: 'Run the analysis again on the current reading.',
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
  exports: exportStore = null,
  definitions = () => null,
  resourceFingerprint = () => null,
  streams = createStreamLimiter(),
  guard = guardStream,
  windows = new Windows(),
  ipOf = clientIp,
  now = Date.now,
  admission = createAdmission({ store, unitOf, fail, now }),
}) {
  const router = express.Router();

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
      }
      // Checked and held now, across the identity awaits, so two creates
      // cannot both take the last slot (library_admission.js).
      const held = existing ? null : admission.reserve({ ip, unitId: request.reading_unit_id });
      res.setHeader('Set-Cookie', cookieHeader(value));
      let result;
      try {
        result = await createAnalysisJob({
          store,
          scheduler,
          prepareRequest,
          resolveIdentity,
          viewer: viewerOf(value),
          idempotencyKey: key,
          request,
          definitions: definitions(),
        });
        if (result.created) held?.commit(result.record.id);
      } finally {
        held?.release(); // a no-op once committed
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
      const options = control(req);
      // A resume re-enters the queue: the same rules as a create, held across
      // the identity await, with this job excluded from its own counts.
      const held = admission.reserve({
        ip: ipOf(req),
        unitId: record.request?.reading_unit_id,
        except: record.id,
      });
      let result;
      try {
        const identity = await resolveIdentity(record.request);
        result = store.resume(record.id, capability, viewer, identity, options);
      } catch (error) {
        held.release();
        throw error;
      }
      held.commit(record.id);
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

  // GET|HEAD /jobs/:id/exports/<manifest>.zip: the analysis export. The
  // reading's entries are the export store's bytes for the job's exact
  // revision (409 EXPORT_READING_CHANGED otherwise); METHODS and
  // RESULT_SCHEMA are the job's retained definitions (409
  // EXPORT_DEFINITIONS_UNAVAILABLE for a job without them on a different
  // fingerprint); evidence pages are the store's, hash-verified, in manifest
  // order. Every error on this path is an attachment.
  const exportAnalysis = (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    let release = null;
    const refuse = (error) => {
      if (release) release();
      if (!error.status) throw error;
      const retryAfter = error.extra?.retryAfter;
      if (retryAfter)
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil(retryAfter / 1000))));
      const { retryAfter: _hidden, ...extra } = error.extra || {};
      res.setHeader('Content-Disposition', 'attachment; filename="library-download-error.txt"');
      res
        .status(error.status)
        .type('text/plain')
        .send(
          JSON.stringify(
            {
              error: {
                code: error.code,
                message: error.message,
                remedy: REMEDY[error.code] || 'Check the request and retry explicitly.',
                ...extra,
              },
            },
            null,
            2
          ) + '\n'
        );
    };
    try {
      if (!exportStore)
        throw fail('EXPORT_UNAVAILABLE', 'Library exports are not installed on this service.', 503);
      const sha = req.params.sha;
      if (!HASH.test(sha)) throw fail('BAD_REQUEST', 'An analysis manifest hash is required.');
      limit(`library-reads:${ipOf(req)}`, 60_000, LIBRARY_LIMITS.jobReadsPerIpPerMinute);
      const { viewer, capability, record } = jobFor(req, res);
      const manifest = store.readManifest(req.params.id, capability, viewer, sha);
      const manifestBytes = Buffer.from(JSON.stringify(manifest));
      if (sha256(manifestBytes) !== sha)
        throw fail('STORAGE_CORRUPT', 'The immutable manifest hash does not match.', 503);
      const identity = record.identity;
      const unitId = identity.reading_unit_id;
      const unit = exportStore.units.get(unitId);
      if (!unit || unit.revision !== identity.reading_revision)
        throw fail(
          'EXPORT_READING_CHANGED',
          'The reading changed since this analysis ran; its exact text is no longer installed.',
          409
        );
      let methods = store.readDefinition(req.params.id, capability, viewer, 'methods');
      let schema = store.readDefinition(req.params.id, capability, viewer, 'result_schema');
      if (!methods || !schema) {
        const current = definitions();
        if (!current || identity.resource_fingerprint !== resourceFingerprint())
          throw fail(
            'EXPORT_DEFINITIONS_UNAVAILABLE',
            'This analysis predates retained definitions and ran on different resources.',
            409
          );
        methods = Buffer.from(current.methods);
        schema = Buffer.from(current.result_schema);
      }
      const refs = [];
      for (let offset = 0; ; ) {
        const page = store.readManifestPage(req.params.id, capability, viewer, sha, {
          offset,
          limit: 250,
        });
        refs.push(...page.page_refs);
        if (page.next_offset == null || !page.page_refs.length) break;
        offset = page.next_offset;
      }
      const layout = analysisLayout(exportStore, {
        unitId,
        identity,
        manifestHash: sha,
        partial: manifest.partial === true,
        extras: [
          ['ANALYSIS/MANIFEST.json', manifestBytes],
          ['ANALYSIS/REQUEST.json', Buffer.from(canonical(record.request) + '\n')],
          ['ANALYSIS/METHODS.json', methods],
          ['ANALYSIS/RESULT_SCHEMA.json', schema],
        ],
        pageSizes: refs.map((ref) => ref.bytes),
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(layout.bytes));
      res.setHeader('X-Library-Bytes', String(layout.bytes));
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="codex-musica-library-analysis-${sha.slice(0, 12)}.zip"`
      );
      if (req.method === 'HEAD') return res.status(200).end();
      release = streams.acquire(ipOf(req));
      const readPage = (i) => {
        const bytes = Buffer.from(
          JSON.stringify(store.readPage(req.params.id, refs[i].sha256, capability, viewer, sha))
        );
        if (sha256(bytes) !== refs[i].sha256)
          throw fail('STORAGE_CORRUPT', 'An evidence page failed hash verification.', 503);
        return bytes;
      };
      const worker = new Worker(new URL('./library_export_worker.js', import.meta.url), {
        workerData: {
          directory: exportStore.directory,
          layout: layout.unitLayout,
          format: 'json',
          snapshot: exportStore.snapshotId,
          tail: false,
        },
      });
      const done = release;
      const pace = guard(res);
      // The ANALYSIS/ entries and the central directory, read, hashed and
      // written one entry at a time: a full socket buffer waits for 'drain'
      // (a slow client never makes the server buffer the rest), and every
      // entry yields the event loop to other requests. The stream guard
      // (guardStream) watches the socket's own progress.
      const writeTail = async () => {
        for (const chunk of analysisTail(layout, readPage)) {
          if (res.destroyed) return;
          if (!res.write(chunk))
            await new Promise((resolve) => {
              const go = () => {
                res.off('drain', go);
                res.off('close', go);
                resolve();
              };
              res.on('drain', go);
              res.on('close', go);
            });
          else await new Promise((resolve) => setImmediate(resolve));
        }
        if (!res.destroyed) res.end();
      };
      res.on('close', () => {
        pace.stop();
        done();
        worker.terminate().catch(() => {});
      });
      worker.on('message', (message) => {
        if (message.chunk) {
          const flowing = res.write(Buffer.from(message.chunk));
          if (flowing) worker.postMessage('more');
          else res.once('drain', () => worker.postMessage('more'));
        } else if (message.done) {
          writeTail().catch((error) => {
            console.error('[library] analysis export refused:', error.code, error.message);
            res.destroy();
          });
        } else if (message.error) {
          console.error(
            '[library] analysis export refused:',
            message.error.code,
            message.error.message
          );
          res.destroy();
        }
      });
      worker.on('error', () => res.destroy());
    } catch (error) {
      for (const h of ['Content-Type', 'Content-Length', 'X-Library-Bytes', 'Content-Disposition'])
        res.removeHeader(h);
      refuse(error);
    }
  };
  router.head('/jobs/:id/exports/:sha.zip', exportAnalysis);
  router.get('/jobs/:id/exports/:sha.zip', exportAnalysis);

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
/**
 * The app-level error handler for /library/v1, mounted after its routers. An
 * error raised before routing (express.json() refusing a body that does not
 * parse) never reaches a mounted router's own handlers, so without this it
 * would get Express's default HTML page. It answers the same JSON, uncached
 * refusal the routers do; viewer paths stay private.
 */
export function libraryErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = error.status ?? error.statusCode;
  const client = status >= 400 && status < 500;
  res.setHeader('Cache-Control', isViewerPath(req.originalUrl) ? 'private, no-store' : 'no-store');
  res.status(client ? status : 500).json({
    error: {
      code: client ? 'BAD_REQUEST' : 'LIBRARY_ERROR',
      message: client ? 'Malformed request.' : 'The Library could not answer.',
      remedy: client ? 'Check the request and retry explicitly.' : 'Retry explicitly.',
    },
  });
}

export function isViewerPath(url) {
  return /^\/library\/v1\/(?:analyses|jobs)(?:[/?]|$)/.test(url);
}
