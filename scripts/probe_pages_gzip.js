#!/usr/bin/env node
// probe_pages_gzip.js — record how GitHub Pages serves a .json.gz file.
//
// The native Library tab stores bulk reading data as .json.gz under
// library/data/. The client sniffs the gzip magic bytes and inflates them
// itself, but if Pages ever answers with Content-Encoding: gzip, the browser
// inflates first and the bytes arrive already decoded. That behaviour cannot
// be checked offline, so library/probe/probe.json.gz is published and this
// script records the live answer: status, Content-Type, Content-Encoding, and
// whether the raw body is still gzip. It reads the response without automatic
// decompression, so what it reports is what the wire carried.
//
// It records; it does not gate. A payload that cannot be read either way is
// the only failure.
//
// Usage: node scripts/probe_pages_gzip.js [URL]
//   default URL: https://codexmusica.com/library/probe/probe.json.gz

'use strict';
const https = require('https');
const zlib = require('zlib');

const url = process.argv[2] || 'https://codexmusica.com/library/probe/probe.json.gz';

function get(target, redirects = 3) {
  return new Promise((resolve, reject) => {
    const req = https.get(target, { headers: { 'accept-encoding': 'gzip' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume();
        resolve(get(new URL(res.headers.location, target).toString(), redirects - 1));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ res, body: Buffer.concat(chunks) }));
    });
    req.setTimeout(15000, () => req.destroy(new Error('no response within 15 s')));
    req.on('error', reject);
  });
}

(async () => {
  const { res, body } = await get(url);
  const enc = res.headers['content-encoding'] || '';
  let raw = body;
  if (enc === 'gzip') raw = zlib.gunzipSync(raw); // undo the transport layer only
  const stillGzip = raw[0] === 0x1f && raw[1] === 0x8b;
  let payload = null;
  try {
    payload = JSON.parse((stillGzip ? zlib.gunzipSync(raw) : raw).toString('utf8'));
  } catch {
    /* reported below */
  }
  const report = {
    url,
    status: res.statusCode,
    content_type: res.headers['content-type'] || null,
    content_encoding: enc || null,
    body_is_gzip_after_transport: stillGzip,
    payload_ok: Boolean(payload && payload.probe === 'codex-musica.library-pages-gzip'),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.status === 200 && report.payload_ok ? 0 : 1);
})().catch((e) => {
  console.error(`probe_pages_gzip: ${e.message}`);
  process.exit(1);
});
