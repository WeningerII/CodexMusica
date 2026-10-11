// Whole-corpus packages (docs/library-native-design.md, "Whole-corpus exports").
// The image builds them with `python -m library.catalog_downloads SNAPSHOT OUT`
// (LIBRARY_CORPUS_DIR); verify_downloads runs in the build, and the server
// re-hashes every package before serving it, because each response names that
// hash (ETag, X-Library-SHA256).
//
//   HEAD|GET /library/v1/corpus/<package_sha16>/<format>.zip
//
// Uncredentialed and addressed by the package's own hash, so a URL is
// immutable: public, one-year caching, a strong ETag, and single byte ranges
// so an interrupted download resumes. An old package URL answers 404 with the
// current URL in its body. Limits (decision 4): 6 starts a day per address
// (a request without Range, or from byte 0; resumes are free), 2 streams
// service-wide, and the shared idle and minimum-rate guard. Every error is an
// attachment, so a navigation can never replace the page.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { LIBRARY_LIMITS, Windows, clientIp } from './ratelimit.js';
import { ExportError, FORMATS, exportError } from './library_exports.js';
import { createStreamLimiter, guardStream } from './library_export_routes.js';

const DAY_MS = 86_400_000;
const FILENAME = /^[A-Za-z0-9._-]+\.zip$/;
const SHA = /^[a-f0-9]{64}$/;
const SHA16 = /^[a-f0-9]{16}$/;

export class CorpusPackages {
  /**
   * Reads package-manifest.json and checks each package's size; the hashes are
   * checked by verify() before anything is served. The *.part-* upload files
   * the builder also writes are not read.
   */
  constructor(directory) {
    this.directory = directory;
    const descriptor = JSON.parse(fs.readFileSync(path.join(directory, 'package-manifest.json')));
    if (descriptor.schema_version !== 1 || descriptor.scope !== 'all_readable')
      throw new Error('corpus packages must be schema 1 over all readable units');
    if (!SHA.test(descriptor.snapshot_id || '')) throw new Error('corpus snapshot id');
    const formats = Object.keys(descriptor.packages || {}).sort();
    if (formats.join() !== [...FORMATS].sort().join()) throw new Error('corpus formats');
    this.snapshotId = descriptor.snapshot_id;
    this.packages = {};
    for (const format of FORMATS) {
      const info = descriptor.packages[format];
      if (
        info.format !== format ||
        !FILENAME.test(info.filename || '') ||
        !SHA.test(info.sha256 || '') ||
        !Number.isSafeInteger(info.bytes) ||
        info.bytes <= 0
      )
        throw new Error(`corpus package descriptor: ${format}`);
      const file = path.join(directory, info.filename);
      if (fs.statSync(file).size !== info.bytes)
        throw new Error(`corpus package size: ${info.filename}`);
      const sha16 = info.sha256.slice(0, 16);
      this.packages[format] = {
        format,
        file,
        filename: info.filename,
        bytes: info.bytes,
        sha256: info.sha256,
        sha16,
        url: `/library/v1/corpus/${sha16}/${format}.zip`,
        verified: false,
      };
    }
  }

  /** Streams each package through sha256; a mismatch leaves it unservable. */
  async verify() {
    const failures = [];
    for (const pkg of Object.values(this.packages)) {
      const hash = crypto.createHash('sha256');
      for await (const chunk of fs.createReadStream(pkg.file, { highWaterMark: 1 << 20 }))
        hash.update(chunk);
      pkg.verified = hash.digest('hex') === pkg.sha256;
      if (!pkg.verified) failures.push(pkg.filename);
    }
    return failures;
  }

  urlFor(format) {
    return this.packages[format]?.url || null;
  }

  /** The health listing: {format: {bytes, sha256, url}}. */
  health() {
    return Object.fromEntries(
      Object.values(this.packages).map((p) => [
        p.format,
        { bytes: p.bytes, sha256: p.sha256, url: p.url },
      ])
    );
  }
}

/**
 * One satisfiable byte range of a resource of `size` bytes, as {start, end}
 * (inclusive); null to send the whole resource (no Range, a multi-range, or a
 * syntax this route does not honour); 'unsatisfiable' for a well-formed range
 * outside the resource.
 */
export function parseRange(header, size) {
  if (typeof header !== 'string') return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return 'unsatisfiable';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(m[1]);
  const end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size || end < start) return 'unsatisfiable';
  return { start, end };
}

export function libraryCorpusRouter({
  corpus,
  streams = createStreamLimiter({ perIp: Infinity, global: LIBRARY_LIMITS.corpusStreamsGlobal }),
  guard = guardStream,
  windows = new Windows(),
  ipOf = clientIp,
  now = Date.now,
}) {
  const router = express.Router();
  const ERROR_HEADERS = [
    'Content-Type',
    'Content-Length',
    'Content-Range',
    'Content-Disposition',
    'Accept-Ranges',
    'ETag',
    'X-Library-SHA256',
    'X-Library-Bytes',
  ];
  const refuse = (res, error, headers = {}) => {
    if (!(error instanceof ExportError)) throw error;
    for (const h of ERROR_HEADERS) res.removeHeader(h);
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    res.setHeader('Cache-Control', 'no-store');
    if (error.extra?.retryAfter)
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(error.extra.retryAfter / 1000))));
    res.setHeader('Content-Disposition', 'attachment; filename="library-download-error.txt"');
    const { retryAfter: _hidden, ...extra } = error.extra || {};
    res
      .status(error.status)
      .type('text/plain')
      .send(
        JSON.stringify(
          { error: { code: error.code, message: error.message, remedy: error.remedy, ...extra } },
          null,
          2
        ) + '\n'
      );
  };

  const download = (req, res) => {
    let release = null;
    try {
      if (!corpus)
        throw exportError(
          'EXPORT_UNAVAILABLE',
          'Corpus packages are not installed on this service.',
          503,
          'Retry later.'
        );
      const { sha16, format } = req.params;
      const pkg = FORMATS.includes(format) ? corpus.packages[format] : null;
      if (!pkg || !SHA16.test(sha16)) throw exportError('NOT_FOUND', 'No such package.', 404);
      if (sha16 !== pkg.sha16)
        throw exportError(
          'CORPUS_PACKAGE_MOVED',
          'This corpus package was replaced by a newer build.',
          404,
          'Download the current package from url.',
          { url: pkg.url }
        );
      if (!pkg.verified)
        throw exportError(
          'CORPUS_VERIFYING',
          'This corpus package is still being verified.',
          503,
          'Retry after the time in Retry-After.',
          { retryAfter: 30_000 }
        );
      const etag = `"${pkg.sha256}"`;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('ETag', etag);
      res.setHeader('X-Library-SHA256', pkg.sha256);
      res.setHeader('X-Library-Bytes', String(pkg.bytes));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      const inm = req.headers['if-none-match'];
      if (inm && inm.split(',').some((t) => t.trim() === etag || t.trim() === '*'))
        return res.status(304).end();
      const ifRange = req.headers['if-range'];
      const range = ifRange && ifRange !== etag ? null : parseRange(req.headers.range, pkg.bytes);
      // Like every refusal here, an attachment (a navigation never replaces
      // the page), and with the Content-Range a resuming client needs.
      if (range === 'unsatisfiable')
        return refuse(
          res,
          exportError(
            'RANGE_NOT_SATISFIABLE',
            'The requested byte range is outside this package.',
            416,
            'Restart the download from the beginning.'
          ),
          { 'Content-Range': `bytes */${pkg.bytes}` }
        );
      const { start, end } = range || { start: 0, end: pkg.bytes - 1 };
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(end - start + 1));
      res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
      if (range) res.setHeader('Content-Range', `bytes ${start}-${end}/${pkg.bytes}`);
      res.status(range ? 206 : 200);
      if (req.method === 'HEAD') return res.end();
      const ip = ipOf(req);
      release = streams.acquire(ip);
      if (start === 0) {
        // A start, not a resume: the daily allowance counts these only.
        const hit = windows.hit(
          `library-corpus:${ip}`,
          DAY_MS,
          LIBRARY_LIMITS.corpusStartsPerIpPerDay,
          now()
        );
        if (!hit.ok)
          throw exportError(
            'RATE_LIMITED',
            'Too many corpus downloads from this network today.',
            429,
            'Retry after the time in Retry-After; an interrupted download can still resume.',
            { retryAfter: hit.retryAfter }
          );
      }
      const pace = guard(res);
      const source = fs.createReadStream(pkg.file, { start, end, highWaterMark: 1 << 20 });
      const done = release;
      res.on('close', () => {
        pace.stop();
        done();
        source.destroy();
      });
      source.on('data', (chunk) => {
        if (!res.write(chunk)) {
          source.pause();
          res.once('drain', () => source.resume());
        }
      });
      source.on('end', () => res.end());
      source.on('error', (error) => {
        console.error('[library] corpus stream failed:', error.message);
        res.destroy();
      });
    } catch (error) {
      if (release) release();
      refuse(res, error);
    }
  };
  router.head('/corpus/:sha16/:format.zip', download);
  router.get('/corpus/:sha16/:format.zip', download);
  return router;
}
