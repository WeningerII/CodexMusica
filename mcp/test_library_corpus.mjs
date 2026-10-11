// Library whole-corpus packages (library_corpus_routes.js): the descriptor
// check, verify-before-serve, hash-addressed URLs, byte ranges and resumes,
// the start and stream limits, the shared stall/crawl guard, and the health
// listing. Synthetic packages: the route never parses the ZIP it serves.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { CorpusPackages, libraryCorpusRouter, parseRange } from './library_corpus_routes.js';
import { STREAM_WRITE_BYTES, guardStream, libraryExportRouter } from './library_export_routes.js';
import { libraryPublicRouter } from './library_routes.js';
import { LIBRARY_LIMITS } from './ratelimit.js';
import { ExportStore, buildExportStore } from './library_exports.js';
import { reading, writeExport } from './test_library_fixtures.mjs';

const SNAPSHOT = 'a'.repeat(64);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ERROR_FILE = 'attachment; filename="library-download-error.txt"';

function packagesOf(
  t,
  { sizes = { text: 3000, json: 5000, csv: 4000 }, scope = 'all_readable' } = {}
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-corpus-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const packages = {};
  const bodies = {};
  for (const [format, size] of Object.entries(sizes)) {
    const bytes = crypto.randomBytes(size);
    const filename = `codex-musica-library-${format}-${SNAPSHOT.slice(0, 12)}.zip`;
    fs.writeFileSync(path.join(dir, filename), bytes);
    bodies[format] = bytes;
    packages[format] = {
      format,
      filename,
      sha256: sha(bytes),
      bytes: size,
      entry_count: 1,
      content_type: 'application/zip',
      parts: [],
    };
  }
  fs.writeFileSync(
    path.join(dir, 'package-manifest.json'),
    JSON.stringify({ schema_version: 1, snapshot_id: SNAPSHOT, scope, packages })
  );
  return { dir, bodies };
}

async function serve(t, ...routers) {
  const app = express();
  app.use(express.json());
  for (const router of routers) app.use('/library/v1', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return (p, init = {}) => fetch(base + p, init);
}

test('the descriptor is checked: sizes, scope and formats; health lists each package by hash', async (t) => {
  const { dir } = packagesOf(t);
  const corpus = new CorpusPackages(dir);
  assert.equal(corpus.snapshotId, SNAPSHOT);
  const health = corpus.health();
  assert.deepEqual(Object.keys(health).sort(), ['csv', 'json', 'text']);
  assert.equal(health.text.url, `/library/v1/corpus/${health.text.sha256.slice(0, 16)}/text.zip`);
  assert.equal(corpus.urlFor('json'), health.json.url);

  fs.appendFileSync(path.join(dir, corpus.packages.csv.filename), 'x');
  assert.throws(() => new CorpusPackages(dir), /size/);
  const selected = packagesOf(t, { scope: 'selected_readings' });
  assert.throws(() => new CorpusPackages(selected.dir), /all readable/);
  const missing = packagesOf(t, { sizes: { text: 10, json: 10 } });
  assert.throws(() => new CorpusPackages(missing.dir), /formats/);

  const call = await serve(t, libraryPublicRouter({ search: null, corpus }));
  assert.deepEqual((await (await call('/library/v1/health')).json()).corpus, health);
});

test('nothing is served until its hash verifies; a corrupt package never is', async (t) => {
  const { dir, bodies } = packagesOf(t);
  const corpus = new CorpusPackages(dir);
  const call = await serve(t, libraryCorpusRouter({ corpus }));
  const early = await call(corpus.urlFor('text'));
  assert.equal(early.status, 503);
  assert.equal(early.headers.get('content-disposition'), ERROR_FILE);
  assert.equal(JSON.parse(await early.text()).error.code, 'CORPUS_VERIFYING');
  assert.ok(Number(early.headers.get('retry-after')) >= 1);

  // Same size, different bytes: the size check passes, the hash does not.
  const flipped = Buffer.from(bodies.csv);
  flipped[0] ^= 1;
  fs.writeFileSync(corpus.packages.csv.file, flipped);
  assert.deepEqual(await corpus.verify(), [corpus.packages.csv.filename]);
  assert.equal((await call(corpus.urlFor('text'))).status, 200);
  assert.equal((await call(corpus.urlFor('csv'))).status, 503);
});

test('a verified package: exact bytes, immutable caching, a strong ETag, and 304 on revalidation', async (t) => {
  const { dir, bodies } = packagesOf(t);
  const corpus = new CorpusPackages(dir);
  await corpus.verify();
  const call = await serve(t, libraryCorpusRouter({ corpus }));
  const url = corpus.urlFor('json');
  const head = await call(url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), bodies.json.length);
  assert.equal(head.headers.get('accept-ranges'), 'bytes');
  const res = await call(url);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(sha(bytes), sha(bodies.json));
  assert.equal(res.headers.get('etag'), `"${sha(bodies.json)}"`);
  assert.equal(res.headers.get('x-library-sha256'), sha(bodies.json));
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(
    res.headers.get('content-disposition'),
    `attachment; filename="${corpus.packages.json.filename}"`
  );
  const again = await call(url, { headers: { 'if-none-match': res.headers.get('etag') } });
  assert.equal(again.status, 304);
});

test('an old package URL is 404 naming the current one; unknown formats and ids are 404', async (t) => {
  const { dir } = packagesOf(t);
  const corpus = new CorpusPackages(dir);
  await corpus.verify();
  const call = await serve(t, libraryCorpusRouter({ corpus }));
  const moved = await call('/library/v1/corpus/0123456789abcdef/text.zip', { method: 'HEAD' });
  assert.equal(moved.status, 404);
  assert.equal(moved.headers.get('content-disposition'), ERROR_FILE);
  const body = JSON.parse(
    await (await call('/library/v1/corpus/0123456789abcdef/text.zip')).text()
  );
  assert.equal(body.error.code, 'CORPUS_PACKAGE_MOVED');
  assert.equal(body.error.url, corpus.urlFor('text'));
  assert.equal(
    (await call(`/library/v1/corpus/${corpus.packages.text.sha16}/pdf.zip`)).status,
    404
  );
  assert.equal((await call('/library/v1/corpus/XYZ/text.zip')).status, 404);
  const none = await serve(t, libraryCorpusRouter({ corpus: null }));
  assert.equal((await none(corpus.urlFor('text'))).status, 503);
});

test('byte ranges resume a download: 206 slices, suffixes, If-Range, and 416', async (t) => {
  assert.deepEqual(parseRange('bytes=10-19', 100), { start: 10, end: 19 });
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-5', 100), { start: 95, end: 99 });
  assert.deepEqual(parseRange('bytes=95-500', 100), { start: 95, end: 99 });
  assert.equal(parseRange('bytes=100-', 100), 'unsatisfiable');
  assert.equal(parseRange('bytes=0-1,5-6', 100), null, 'a multi-range sends the whole file');
  assert.equal(parseRange(undefined, 100), null);

  const { dir, bodies } = packagesOf(t);
  const corpus = new CorpusPackages(dir);
  await corpus.verify();
  const call = await serve(t, libraryCorpusRouter({ corpus }));
  const url = corpus.urlFor('text');
  const part = await call(url, { headers: { range: 'bytes=1000-1999' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes 1000-1999/${bodies.text.length}`);
  assert.deepEqual(Buffer.from(await part.arrayBuffer()), bodies.text.subarray(1000, 2000));
  const tail = await call(url, { headers: { range: 'bytes=-10' } });
  assert.deepEqual(Buffer.from(await tail.arrayBuffer()), bodies.text.subarray(-10));
  const etag = `"${sha(bodies.text)}"`;
  const same = await call(url, { headers: { range: 'bytes=5-', 'if-range': etag } });
  assert.equal(same.status, 206);
  await same.arrayBuffer();
  const changed = await call(url, { headers: { range: 'bytes=5-', 'if-range': '"other"' } });
  assert.equal(changed.status, 200, 'a different entity restarts from byte 0');
  assert.equal(Buffer.from(await changed.arrayBuffer()).length, bodies.text.length);
  const beyond = await call(url, { headers: { range: `bytes=${bodies.text.length}-` } });
  assert.equal(beyond.status, 416);
  assert.equal(beyond.headers.get('content-range'), `bytes */${bodies.text.length}`);
  assert.equal(
    beyond.headers.get('content-disposition'),
    'attachment; filename="library-download-error.txt"'
  );
  assert.equal(beyond.headers.get('cache-control'), 'no-store');
  assert.equal(JSON.parse(await beyond.text()).error.code, 'RANGE_NOT_SATISFIABLE');
});

test('starts: 6 a day per address; HEAD and resumes are free', async (t) => {
  const { dir } = packagesOf(t);
  const corpus = new CorpusPackages(dir);
  await corpus.verify();
  const call = await serve(t, libraryCorpusRouter({ corpus, ipOf: () => 'classroom' }));
  const url = corpus.urlFor('text');
  for (let i = 0; i < 6; i++) {
    const res = await call(url, i % 2 ? { headers: { range: 'bytes=0-' } } : {});
    assert.equal(res.status, i % 2 ? 206 : 200);
    await res.arrayBuffer();
    assert.equal((await call(url, { method: 'HEAD' })).status, 200);
  }
  const seventh = await call(url);
  assert.equal(seventh.status, 429);
  assert.equal(seventh.headers.get('content-disposition'), ERROR_FILE);
  assert.ok(Number(seventh.headers.get('retry-after')) >= 1);
  for (let i = 0; i < 2; i++) assert.equal((await call(url)).status, 429, 'refusals hold no slot');
  const resume = await call(url, { headers: { range: 'bytes=100-' } });
  assert.equal(resume.status, 206, 'an interrupted download still resumes');
  await resume.arrayBuffer();
});

test('streams: 2 service-wide; a third waits and does not spend a start', async (t) => {
  const big = 6_000_000; // larger than socket buffers, so an unread body stays open
  const { dir } = packagesOf(t, { sizes: { text: big, json: 10, csv: 10 } });
  const corpus = new CorpusPackages(dir);
  await corpus.verify();
  let ip = 'one';
  const call = await serve(t, libraryCorpusRouter({ corpus, ipOf: () => ip }));
  const url = corpus.urlFor('text');
  const held = [await call(url), await call(url)];
  ip = 'two';
  const third = await call(url);
  assert.equal(third.status, 429);
  assert.equal(third.headers.get('content-disposition'), ERROR_FILE);
  for (const r of held) assert.equal(Buffer.from(await r.arrayBuffer()).length, big);
  const after = await call(url);
  assert.equal(after.status, 200, 'released after the streams finished');
  await after.arrayBuffer();
});

// A client reading the response at about `rate` bytes a second.
function throttledRead(url, rate, options = {}) {
  return new Promise((resolve, reject) => {
    (url.startsWith('https:') ? https : http)
      .get(url, options, (res) => {
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
          res.pause();
          setTimeout(() => res.resume(), (chunk.length / rate) * 1000);
        });
        res.on('end', () => resolve({ status: res.statusCode, bytes }));
        res.on('error', reject);
        res.on('aborted', () => reject(new Error('cut')));
      })
      .on('error', reject);
  });
}

test('the stream guard cuts a stalled client and a crawling one, and frees the slot', async (t) => {
  // Larger than the loopback socket buffers, so an unread response really stalls.
  const big = 48_000_000;
  const { dir } = packagesOf(t, { sizes: { text: big, json: 10, csv: 10 } });
  const corpus = new CorpusPackages(dir);
  await corpus.verify();
  const url = corpus.urlFor('text');
  const stalled = await serve(
    t,
    libraryCorpusRouter({
      corpus,
      guard: (res) => guardStream(res, { idleMs: 300, windowMs: 60_000 }),
    })
  );
  const unread = await stalled(url);
  assert.equal(unread.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 1200));
  await assert.rejects(unread.arrayBuffer(), 'cut after the idle timeout');
  const next = await stalled(url, { headers: { range: 'bytes=0-9' } });
  assert.equal(next.status, 206, 'the cut stream released its slot');
  await next.arrayBuffer();

  // A client that truly reads nothing after its first burst (a paused
  // response; fetch would read ahead into its own buffer), so the crawl check
  // that cuts it is the unproven one. Observed at the server.
  let crawlCut = false;
  const crawlApp = express();
  crawlApp.use(
    '/library/v1',
    libraryCorpusRouter({
      corpus,
      guard: (res) => {
        res.on('close', () => (crawlCut = true));
        return guardStream(res, { idleMs: 60_000, windowMs: 300, minBytesPerSecond: 1e12 });
      },
    })
  );
  const crawlServer = http.createServer(crawlApp);
  await new Promise((resolve) => crawlServer.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    crawlServer.closeAllConnections();
    crawlServer.close();
  });
  http
    .get(`http://127.0.0.1:${crawlServer.address().port}${url}`, (res) => res.pause())
    .on('error', () => {});
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.equal(crawlCut, true, 'cut below the minimum rate');
});

test('the stream guard measures the socket: a client draining bounded writes steadily is never idle', async (t) => {
  // 12 MB written as STREAM_WRITE_BYTES writes paced by drain, read at about
  // 3 MB/s: about 4 s, longer than the 1.5 s idle limit. Each write's
  // completion is progress, so the steady reader is never idle.
  const size = 12_000_000;
  const server = http.createServer((req, res) => {
    guardStream(res, { idleMs: 1500, windowMs: 60_000, tickMs: 100 });
    respond(res, size);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const read = await throttledRead(`http://127.0.0.1:${server.address().port}/`, 3_000_000);
  assert.deepEqual(read, { status: 200, bytes: size });
});

test('at the production limits a client that reads nothing is cut at the idle deadline', async (t) => {
  // No overrides: idleMs 60 s, a 1 s tick, the 4 KiB/s floor. Outstanding
  // bytes never extend the idle deadline.
  const big = 48_000_000;
  const { dir } = packagesOf(t, { sizes: { text: big, json: 10, csv: 10 } });
  const corpus = new CorpusPackages(dir);
  await corpus.verify();
  let started = 0;
  let cutAt = 0;
  const call = await serve(
    t,
    libraryCorpusRouter({
      corpus,
      guard: (res) => {
        started = Date.now();
        res.on('close', () => (cutAt ||= Date.now()));
        return guardStream(res);
      },
    })
  );
  const unread = await call(corpus.urlFor('text'));
  assert.equal(unread.status, 200);
  const { streamIdleMs } = LIBRARY_LIMITS;
  while (!cutAt && Date.now() - started < streamIdleMs + 5000)
    await new Promise((resolve) => setTimeout(resolve, 250));
  assert.ok(cutAt, 'the stalled client was cut');
  const after = cutAt - started;
  assert.ok(after >= streamIdleMs, `not before the idle deadline (${after} ms)`);
  assert.ok(after <= streamIdleMs + 1000 + 250, `within idleMs + one tick (${after} ms)`);
  await assert.rejects(unread.arrayBuffer());
});

// A self-signed P-256 certificate for localhost, built here with node:crypto
// (a v1 X.509 certificate: DER by hand, so the test needs no openssl).
function selfSigned() {
  const der = (tag, ...parts) => {
    const body = Buffer.concat(parts);
    const n = body.length;
    const len =
      n < 0x80
        ? Buffer.from([n])
        : n < 0x100
          ? Buffer.from([0x81, n])
          : Buffer.from([0x82, n >> 8, n & 0xff]);
    return Buffer.concat([Buffer.from([tag]), len, body]);
  };
  const oid = (dotted) => {
    const [a, b, ...rest] = dotted.split('.').map(Number);
    const bytes = [40 * a + b];
    for (const v of rest) {
      const group = [v & 0x7f];
      for (let x = v >> 7; x; x >>= 7) group.unshift((x & 0x7f) | 0x80);
      bytes.push(...group);
    }
    return der(0x06, Buffer.from(bytes));
  };
  const utc = (date) =>
    der(0x17, Buffer.from(date.toISOString().replace(/[-:T]/g, '').slice(2, 14) + 'Z'));
  const name = der(0x30, der(0x31, der(0x30, oid('2.5.4.3'), der(0x0c, Buffer.from('localhost')))));
  const algorithm = der(0x30, oid('1.2.840.10045.4.3.2')); // ecdsa-with-SHA256
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const now = Date.now();
  const tbs = der(
    0x30,
    der(0x02, Buffer.from([1])),
    algorithm,
    name,
    der(0x30, utc(new Date(now - 3_600_000)), utc(new Date(now + 86_400_000))),
    name,
    publicKey.export({ type: 'spki', format: 'der' })
  );
  const signature = crypto.sign('sha256', tbs, privateKey);
  const cert = der(0x30, tbs, algorithm, der(0x03, Buffer.from([0]), signature));
  const pem = `-----BEGIN CERTIFICATE-----\n${cert.toString('base64').replace(/.{64}/g, '$&\n')}\n-----END CERTIFICATE-----\n`;
  return { cert: pem, key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
}

// A download's shape: STREAM_WRITE_BYTES writes paced by drain.
function respond(res, size) {
  let left = size;
  const pump = () => {
    while (left > 0) {
      const n = Math.min(left, STREAM_WRITE_BYTES);
      left -= n;
      if (!res.write(Buffer.alloc(n, 7))) return res.once('drain', pump);
    }
    res.end();
  };
  pump();
}

test('the stream guard keeps a healthy throttled reader over TLS', async (t) => {
  // Over TLS bytesWritten counts plaintext the moment it is queued and the
  // handle's private queue size counts ciphertext: their difference never
  // moved, and a guard reading it cut a healthy reader. Here progress is
  // bytesWritten movement or our own write callbacks.
  const size = 24_000_000; // well past the loopback socket buffers
  const server = https.createServer(selfSigned(), (req, res) => {
    guardStream(res, { idleMs: 800, windowMs: 1000, minBytesPerSecond: 2_000_000, tickMs: 50 });
    respond(res, size);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `https://127.0.0.1:${server.address().port}`;
  const read = await throttledRead(`${base}/`, 12_000_000, { rejectUnauthorized: false });
  assert.deepEqual(read, { status: 200, bytes: size });
});

test('the stream guard reads no private socket state: a hidden write queue changes nothing', async (t) => {
  // The handle's writeQueueSize reads as nothing pending, the value that made
  // the old difference flat. The download still completes.
  const size = 24_000_000; // well past the loopback socket buffers
  const server = http.createServer((req, res) => {
    const handle = res.socket._handle;
    Object.defineProperty(handle, 'writeQueueSize', { get: () => 0, configurable: true });
    guardStream(res, { idleMs: 800, windowMs: 1000, minBytesPerSecond: 2_000_000, tickMs: 50 });
    respond(res, size);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const read = await throttledRead(`${base}/`, 12_000_000);
  assert.deepEqual(read, { status: 200, bytes: size });
});

test('at the production limits a zero-byte reader is cut at idleMs while a 10 KB/s reader is kept, over HTTP and TLS', async (t) => {
  // 3PO's pair, together, on both transports. The kernel hands a slow
  // reader's progress on in megabyte steps, so a healthy 10.2 KB/s reader
  // shows no progress for well over 60 s; it is kept because it reopened its
  // window after the first burst (proven). A reader that reads nothing never
  // does, and goes at idleMs.
  const closed = new Map();
  const handler = (req, res) => {
    res.on('close', () =>
      closed.set(`${req.socket.encrypted ? 'tls' : 'tcp'}${req.url}`, Date.now())
    );
    guardStream(res);
    respond(res, 200_000_000);
  };
  const servers = {
    tcp: http.createServer(handler),
    tls: https.createServer(selfSigned(), handler),
  };
  for (const server of Object.values(servers)) {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      server.closeAllConnections();
      server.close();
    });
  }
  const start = Date.now();
  const bytes = { tcp: 0, tls: 0 };
  for (const [kind, server] of Object.entries(servers)) {
    const client = kind === 'tls' ? https : http;
    const options = { host: '127.0.0.1', port: server.address().port, rejectUnauthorized: false };
    client.get({ ...options, path: '/zero' }, (res) => res.pause()).on('error', () => {});
    client
      .get({ ...options, path: '/healthy' }, (res) => {
        res.on('data', (chunk) => {
          bytes[kind] += chunk.length;
          res.pause();
          setTimeout(() => res.resume(), (chunk.length / 10_240) * 1000);
        });
      })
      .on('error', () => {});
  }
  await new Promise((resolve) => setTimeout(resolve, 150_000));
  const { streamIdleMs } = LIBRARY_LIMITS;
  for (const kind of ['tcp', 'tls']) {
    const zero = closed.get(`${kind}/zero`) - start;
    assert.ok(
      zero >= streamIdleMs && zero <= streamIdleMs + 1500,
      `${kind}: zero-byte reader cut at ${zero} ms`
    );
    assert.equal(
      closed.has(`${kind}/healthy`),
      false,
      `${kind}: the healthy reader is connected at 150 s`
    );
    assert.ok(
      bytes[kind] > 1_000_000,
      `${kind}: the healthy reader kept reading (${bytes[kind]} bytes)`
    );
  }
});

test('a whole-corpus selection plan names the corpus package URL', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'library-corpus-plan-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeExport(path.join(root, 'export'), [reading('reading_a'), reading('reading_b')]);
  buildExportStore(path.join(root, 'export'), path.join(root, 'store'));
  const store = new ExportStore(path.join(root, 'store'));
  const { dir } = packagesOf(t);
  const corpus = new CorpusPackages(dir);
  const call = await serve(t, libraryExportRouter({ exports: store, corpus }));
  const res = await call('/library/v1/exports/plan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reading_unit_ids: ['reading_a', 'reading_b'], format: 'csv' }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, 'USE_CORPUS_PACKAGE');
  assert.equal(body.error.url, corpus.urlFor('csv'));
});

test('guardStream reads socket progress: movement keeps a stream; silence or a crawl cuts it', async () => {
  // A response whose socket reports bytesWritten, advanced by the test.
  const fake = () => {
    const res = new EventEmitter();
    res.socket = { bytesWritten: 0 };
    res.destroyed = false;
    res.destroy = () => {
      res.destroyed = true;
      res.emit('close');
    };
    return res;
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const steady = fake();
  guardStream(steady, { idleMs: 120, windowMs: 60_000, tickMs: 20 });
  for (let i = 0; i < 8; i++) {
    await sleep(40);
    steady.socket.bytesWritten += 1;
  }
  assert.equal(steady.destroyed, false, 'socket movement inside the idle limit keeps it');
  await sleep(200);
  assert.equal(steady.destroyed, true, 'socket silence past the idle limit cuts it');

  const slow = fake();
  guardStream(slow, { idleMs: 60_000, windowMs: 100, minBytesPerSecond: 1000, tickMs: 20 });
  for (let i = 0; i < 6 && !slow.destroyed; i++) {
    await sleep(25);
    slow.socket.bytesWritten += 10; // 400 B/s, under the 1000 B/s floor
  }
  await sleep(120);
  assert.equal(slow.destroyed, true);

  const fast = fake();
  guardStream(fast, { idleMs: 60_000, windowMs: 100, minBytesPerSecond: 1000, tickMs: 20 });
  for (let i = 0; i < 10; i++) {
    await sleep(25);
    fast.socket.bytesWritten += 500; // 20 kB/s
  }
  assert.equal(fast.destroyed, false);

  const finished = fake();
  guardStream(finished, { idleMs: 60, windowMs: 60_000, tickMs: 20 });
  finished.emit('finish'); // everything handed to the network: no more cutting
  await sleep(150);
  assert.equal(finished.destroyed, false);
  fast.emit('close'); // stops its timers

  // A proven client (progress resumed after a pause) is held to the floor
  // over a horizon long enough for one whole step, less one step: small
  // steps below the floor are cut; whole steps at or above it are kept.
  const proven = () => {
    const res = fake();
    guardStream(res, {
      idleMs: 60_000,
      windowMs: 200,
      minBytesPerSecond: 1000,
      tickMs: 20,
      maxIdleMs: 60_000,
    });
    return res;
  };
  const crawler = proven();
  const stepper = proven();
  await sleep(80); // a pause, then movement: both proven
  for (let i = 0; i < 40; i++) {
    crawler.socket.bytesWritten += 10; // 10 B every 25 ms = 400 B/s, under the floor
    if (i % 10 === 0) stepper.socket.bytesWritten += 400; // 400 B steps every 250 ms = 1600 B/s
    await sleep(25);
  }
  assert.equal(crawler.destroyed, true, 'a proven crawler below the floor is cut');
  assert.equal(stepper.destroyed, false, 'a proven reader stepping above the floor is kept');
  stepper.emit('close');

  // An outstanding write never extends the idle deadline: no movement for
  // idleMs cuts, however much is outstanding (1 MB at 10 kB/s would be 100 s).
  const quiet = fake();
  quiet.write = () => false; // accepted, never called back
  guardStream(quiet, { idleMs: 60, windowMs: 60_000, minBytesPerSecond: 10_000, tickMs: 10 });
  quiet.write(Buffer.alloc(1_000_000));
  await sleep(40);
  assert.equal(quiet.destroyed, false, 'not before the idle limit');
  await sleep(60);
  assert.equal(quiet.destroyed, true, 'cut at the idle limit despite the outstanding write');
});
