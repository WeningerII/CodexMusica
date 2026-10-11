// Public, uncredentialed /library/v1 routes for the native Library tab
// (docs/library-native-design.md, "Render").
//
//   GET /library/v1/health        passive: no cookie, no writes
//   GET /library/v1/search        exact search (mcp/library_search.js)
//   GET /library/v1/metadata/:id  one unit's recorded metadata, any availability
//
// All three are CORS simple requests and carry no credentials. The client
// never sends a snapshot: every response names the server's own. Search and
// metadata are cacheable (public, max-age=300, ETag); errors never are. The
// credentialed viewer routes (analyses, jobs) mount separately, only when
// LIBRARY_PUBLIC=1.
import crypto from 'node:crypto';
import express from 'express';
import { LibraryError, errorBody } from './library_search.js';
import { LIBRARY_LIMITS, Windows, clientIp } from './ratelimit.js';

const ID = /^[A-Za-z0-9_.:-]{1,200}$/;

function send(req, res, body) {
  const text = JSON.stringify(body);
  const etag = `"${crypto.createHash('sha256').update(text).digest('hex').slice(0, 32)}"`;
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('ETag', etag);
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  res.type('application/json').send(text);
}
function fail(res, error) {
  if (!error.status) throw error;
  res.setHeader('Cache-Control', 'no-store');
  res.status(error.status).json(errorBody(error));
}

/**
 * @param {object} options
 * @param {import('./library_search.js').LibrarySearch | null} options.search
 *   the loaded store, or null when this service has none installed
 * @param {() => boolean} [options.analysisAvailable] public analysis is live
 * @param {Windows} [options.windows] rate-limit counters (shared per process)
 * @param {(req) => string} [options.ipOf] the caller's address (ratelimit.clientIp)
 * @param {() => number} [options.now]
 */
export function libraryPublicRouter({
  search,
  analysisAvailable = () => false,
  windows = new Windows(),
  ipOf = clientIp,
  now = Date.now,
}) {
  const router = express.Router();
  // Decision 4: search's abuse ceiling. Ordinary use never meets it; the
  // refusal says when to retry.
  const searchCeiling = (req, res) => {
    const hit = windows.hit(
      `library-search:${ipOf(req)}`,
      60_000,
      LIBRARY_LIMITS.searchPerIpPerMinute,
      now()
    );
    if (hit.ok) return true;
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(hit.retryAfter / 1000))));
    fail(
      res,
      new LibraryError(
        'RATE_LIMITED',
        'Too many searches from this network address; retry shortly.',
        429,
        'Retry after the time in Retry-After.'
      )
    );
    return false;
  };
  router.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return fail(
        res,
        new LibraryError('METHOD_NOT_ALLOWED', 'Use GET to read Library records.', 405)
      );
    next();
  });
  const requireSearch = () => {
    if (!search)
      throw new LibraryError(
        'SEARCH_UNAVAILABLE',
        'Library search is not installed on this service.',
        503,
        'Retry later.'
      );
    return search;
  };
  router.get('/health', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
      contract: 1,
      snapshot_id: search ? search.snapshotId : null,
      readable_ids_sha256: search ? search.store.readable_ids_sha256 : null,
      counts: search
        ? { units: search.store.unit_count, readable: search.store.readable_count }
        : null,
      search_ready: Boolean(search),
      analysis_available: Boolean(analysisAvailable()),
      corpus: {},
    });
  });
  router.get('/search', (req, res) => {
    if (!searchCeiling(req, res)) return;
    try {
      // The raw query string, read as the Worker read url.searchParams (first
      // value wins), never Express's parsed req.query.
      const params = new URL(req.originalUrl, 'http://library.invalid').searchParams;
      send(req, res, requireSearch().search(params));
    } catch (error) {
      fail(res, error);
    }
  });
  router.get('/metadata/:id', (req, res) => {
    try {
      if (!ID.test(req.params.id))
        throw new LibraryError('BAD_REQUEST', 'Invalid reading identity.');
      send(req, res, requireSearch().metadataById(req.params.id));
    } catch (error) {
      fail(res, error);
    }
  });
  router.use((_req, res) =>
    fail(res, new LibraryError('NOT_FOUND', 'No such Library route.', 404))
  );
  return router;
}

/** The request log never records search terms (the query string). */
export function redactLibraryUrl(url) {
  return /^\/library\/v1\/search(?:\?|$)/.test(url) ? url.replace(/\?.*$/, '?<redacted>') : url;
}
