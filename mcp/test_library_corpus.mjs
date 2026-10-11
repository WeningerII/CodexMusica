// Library whole-corpus packages (library_corpus_routes.js): the descriptor
// check, verify-before-serve, hash-addressed URLs, byte ranges and resumes,
// the start and stream limits, the shared stall/crawl guard, and the health
// listing. Synthetic packages: the route never parses the ZIP it serves.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { CorpusPackages, libraryCorpusRouter, parseRange } from './library_corpus_routes.js';
import { guardStream, libraryExportRouter } from './library_export_routes.js';
import { libraryPublicRouter } from './library_routes.js';
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

test('the stream guard cuts a stalled client and a crawling one, and frees the slot', async (t) => {
  const big = 6_000_000;
  const { dir } = packagesOf(t, { sizes: { text: big, json: 10, csv: 10 } });
  const corpus = new CorpusPackages(dir);
  await corpus.verify();
  const url = corpus.urlFor('text');
  const stalled = await serve(
    t,
    libraryCorpusRouter({
      corpus,
      guard: (res) => guardStream(res, { idleMs: 150, windowMs: 60_000 }),
    })
  );
  const unread = await stalled(url);
  assert.equal(unread.status, 200);
  await new Promise((resolve) => setTimeout(resolve, 600));
  await assert.rejects(unread.arrayBuffer(), 'cut after the idle timeout');
  const next = await stalled(url);
  assert.equal(next.status, 200, 'the cut stream released its slot');
  await next.arrayBuffer();

  // A client that keeps reading, pausing less than the idle timeout each time,
  // finishes however long the whole download takes.
  // Every byte sent is reported to the guard.
  let counted = 0;
  const spied = await serve(
    t,
    libraryCorpusRouter({
      corpus,
      guard: (res) => {
        const inner = guardStream(res);
        return {
          progress: (n) => {
            counted += n;
            inner.progress(n);
          },
          stop: inner.stop,
        };
      },
    })
  );
  await (await spied(url)).arrayBuffer();
  assert.equal(counted, big);

  const crawling = await serve(
    t,
    libraryCorpusRouter({
      corpus,
      guard: (res) => guardStream(res, { idleMs: 60_000, windowMs: 200, minBytesPerSecond: 1e12 }),
    })
  );
  const slow = await crawling(url);
  await new Promise((resolve) => setTimeout(resolve, 600));
  await assert.rejects(slow.arrayBuffer(), 'cut below the minimum rate');
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

test('guardStream: steady progress keeps a stream; silence or a crawl cuts it', async () => {
  const fake = () => {
    const res = new EventEmitter();
    res.destroyed = false;
    res.destroy = () => {
      res.destroyed = true;
      res.emit('close');
    };
    return res;
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const steady = fake();
  const kept = guardStream(steady, { idleMs: 120, windowMs: 60_000 });
  for (let i = 0; i < 8; i++) {
    await sleep(40);
    kept.progress(1);
  }
  assert.equal(steady.destroyed, false, 'progress inside the idle timeout keeps it');
  await sleep(200);
  assert.equal(steady.destroyed, true, 'silence past the idle timeout cuts it');

  const slow = fake();
  const crawl = guardStream(slow, { idleMs: 60_000, windowMs: 100, minBytesPerSecond: 1000 });
  for (let i = 0; i < 6 && !slow.destroyed; i++) {
    await sleep(25);
    crawl.progress(10); // 400 B/s, under the 1000 B/s floor
  }
  await sleep(120);
  assert.equal(slow.destroyed, true);

  const fast = fake();
  const quick = guardStream(fast, { idleMs: 60_000, windowMs: 100, minBytesPerSecond: 1000 });
  for (let i = 0; i < 10; i++) {
    await sleep(25);
    quick.progress(500); // 20 kB/s
  }
  assert.equal(fast.destroyed, false);
  fast.emit('close'); // stops its timers
});
