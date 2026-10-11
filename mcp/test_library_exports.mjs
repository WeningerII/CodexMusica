// Library selection exports (library_exports.js): the store build, content
// identity, the plan/download contract, stream limits and verification, on a
// synthetic export. Byte parity with the Worker's own ZIPs on 317c is the
// golden replay (test_library_exports_parity.mjs, library-site.yml).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { ExportStore, buildExportStore, contentId, zipChunks } from './library_exports.js';
import { libraryExportRouter } from './library_export_routes.js';

import { sha, NOTICE, SOURCE_SHA, reading, writeExport } from './test_library_fixtures.mjs';

function storeOf(t, readings, options) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'library-exports-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeExport(path.join(root, 'export'), readings, options);
  buildExportStore(path.join(root, 'export'), path.join(root, 'store'));
  return new ExportStore(path.join(root, 'store'));
}
const zipOf = (store, ids, format) => {
  const parts = [
    ...zipChunks(store.directory, store.layout(ids, format), format, store.snapshotId),
  ];
  return Buffer.concat(parts);
};
async function serve(t, router) {
  const app = express();
  app.use(express.json());
  app.use('/library/v1', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const log = [];
  const call = (p, init = {}) => {
    log.push(p);
    return fetch(base + p, init);
  };
  const plan = (ids, format = 'text', headers = {}) =>
    call('/library/v1/exports/plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ reading_unit_ids: ids, format }),
    });
  return { call, plan, log };
}

test('a ZIP has the Worker layout: per-unit entries, one SOURCES per source (json), then the roots', (t) => {
  const store = storeOf(t, [reading('reading_b'), reading('reading_a')]);
  const names = store.layout(['reading_a', 'reading_b'], 'json').entries.map((e) => e.name);
  assert.deepEqual(names, [
    'READINGS/reading_a.json',
    'TRANSCRIPTIONS/reading_a.txt',
    'PROVENANCE/reading_a.json',
    'ATTRIBUTIONS/reading_a.txt',
    `NOTICES/reading_a-${sha(NOTICE)}.txt`,
    `SOURCES/${SOURCE_SHA}.bin`,
    'READINGS/reading_b.json',
    'TRANSCRIPTIONS/reading_b.txt',
    'PROVENANCE/reading_b.json',
    'ATTRIBUTIONS/reading_b.txt',
    `NOTICES/reading_b-${sha(NOTICE)}.txt`,
    'PROVENANCE.json',
    'ATTRIBUTION.txt',
  ]);
  for (const format of ['text', 'json', 'csv']) {
    const bytes = zipOf(store, ['reading_a', 'reading_b'], format);
    assert.equal(bytes.length, store.layout(['reading_a', 'reading_b'], format).bytes);
    assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50, 'ends with the end record');
  }
  const csv = zipOf(store, ['reading_a'], 'csv').toString('latin1');
  assert.ok(csv.includes('snapshot_id,reading_unit_id'), 'the CSV header row');
  assert.ok(csv.includes('[Verse]'), 'source marks fill the structure column');
});

test('content identity follows the exact inputs: revision churn and snapshot-only churn both change it', (t) => {
  const a = storeOf(t, [reading('reading_a'), reading('reading_b')]);
  const revised = storeOf(t, [reading('reading_a', { revision: 'rev_new' }), reading('reading_b')]);
  const resnapped = storeOf(t, [reading('reading_a'), reading('reading_b')], { snapshot: 'snap2' });
  const ids = ['reading_a', 'reading_b'];
  assert.notEqual(contentId(a, ids, 'text'), contentId(revised, ids, 'text'));
  assert.notEqual(contentId(a, ids, 'text'), contentId(resnapped, ids, 'text'));
  assert.notEqual(contentId(a, ids, 'text'), contentId(a, ids, 'csv'));
  assert.equal(contentId(a, ids, 'text'), contentId(a, [...ids], 'text'));
});

test('plan then download: exact Content-Length, attachment, identical bytes for the same plan twice', async (t) => {
  const store = storeOf(t, [reading('reading_a'), reading('reading_b'), reading('reading_c')]);
  const { call, plan, log } = await serve(t, libraryExportRouter({ exports: store }));
  const p1 = await (await plan(['reading_b', 'reading_a', 'reading_b'])).json();
  assert.equal(p1.url, `/library/v1/exports/p/${p1.content_id}.zip`);
  const head = await call(p1.url, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), p1.bytes);
  const get = await call(p1.url);
  assert.match(
    get.headers.get('content-disposition'),
    /^attachment; filename="codex-musica-library-text-selection\.zip"$/
  );
  const first = Buffer.from(await get.arrayBuffer());
  assert.equal(first.length, p1.bytes);
  const p2 = await (await plan(['reading_a', 'reading_b'])).json();
  assert.equal(p2.content_id, p1.content_id);
  const second = Buffer.from(await (await call(p2.url)).arrayBuffer());
  assert.equal(sha(second), sha(first));
  assert.equal(sha(first), sha(zipOf(store, ['reading_a', 'reading_b'], 'text')));
  for (const url of log) assert.ok(!/reading_|sel=/.test(url), `no selection in a URL: ${url}`);
});

test('a restart forgets plans: PLAN_EXPIRED, served as an attachment; re-planning works', async (t) => {
  const store = storeOf(t, [reading('reading_a'), reading('reading_b')]);
  const first = await serve(t, libraryExportRouter({ exports: store }));
  const p = await (await first.plan(['reading_a'])).json();
  const second = await serve(t, libraryExportRouter({ exports: store }));
  const expired = await second.call(p.url);
  assert.equal(expired.status, 409);
  assert.equal(
    expired.headers.get('content-disposition'),
    'attachment; filename="library-download-error.txt"'
  );
  assert.equal(JSON.parse(await expired.text()).error.code, 'PLAN_EXPIRED');
  const again = await (await second.plan(['reading_a'])).json();
  assert.equal(again.content_id, p.content_id);
  assert.equal((await second.call(again.url)).status, 200);
});

test('a plan whose readings changed under it is PLAN_STALE', async (t) => {
  const store = storeOf(t, [reading('reading_a'), reading('reading_b')]);
  const { call, plan } = await serve(t, libraryExportRouter({ exports: store }));
  const p = await (await plan(['reading_a'])).json();
  store.units.get('reading_a').revision = 'rev_changed';
  const stale = await call(p.url);
  assert.equal(stale.status, 409);
  assert.equal(JSON.parse(await stale.text()).error.code, 'PLAN_STALE');
});

test('planning refuses unknown or unadmitted ids by name, bad formats, and empty selections', async (t) => {
  const store = storeOf(t, [reading('reading_a'), reading('reading_b')]);
  const { plan } = await serve(t, libraryExportRouter({ exports: store }));
  const missing = await plan(['reading_a', 'reading_nope']);
  assert.equal(missing.status, 409);
  const body = await missing.json();
  assert.equal(body.error.code, 'SELECTION_UNAVAILABLE');
  assert.deepEqual(body.error.reading_unit_ids, ['reading_nope']);
  assert.equal((await plan(['reading_a'], 'pdf')).status, 400);
  assert.equal((await plan([])).status, 400);
  assert.equal((await plan(['not-an-id'])).status, 400);
  const whole = await plan(['reading_a', 'reading_b']);
  assert.equal(whole.status, 409);
  assert.equal((await whole.json()).error.code, 'USE_CORPUS_PACKAGE');
});

test('export plans: 120 an hour per address', async (t) => {
  const store = storeOf(t, [reading('reading_a'), reading('reading_b')]);
  const { plan } = await serve(
    t,
    libraryExportRouter({ exports: store, ipOf: () => 'one-address' })
  );
  for (let i = 0; i < 120; i++) assert.equal((await plan(['reading_a'])).status, 200);
  const over = await plan(['reading_a']);
  assert.equal(over.status, 429);
  assert.ok(Number(over.headers.get('retry-after')) >= 1);
});

test('streams: 2 at once per address; a third waits with Retry-After', async (t) => {
  const big = 'x'.repeat(4_000_000); // larger than socket buffers, so an unread body stays open
  const store = storeOf(t, [
    reading('reading_a', { text: big }),
    reading('reading_b'),
    reading('reading_c'),
  ]);
  const { call, plan } = await serve(t, libraryExportRouter({ exports: store, ipOf: () => 'one' }));
  const p = await (await plan(['reading_a'])).json();
  const held = [await call(p.url), await call(p.url)];
  const third = await call(p.url);
  assert.equal(third.status, 429);
  assert.equal(
    third.headers.get('content-disposition'),
    'attachment; filename="library-download-error.txt"'
  );
  for (const r of held) {
    const bytes = Buffer.from(await r.arrayBuffer());
    assert.equal(bytes.length, p.bytes);
  }
  assert.equal((await call(p.url)).status, 200, 'released after the streams finished');
});

test('an entry that no longer matches its recorded CRC aborts the stream', async (t) => {
  const store = storeOf(t, [reading('reading_a'), reading('reading_b')]);
  // Corrupt the recorded facts: generation must refuse rather than send bytes the plan did not promise.
  const unit = store.units.get('reading_a');
  unit.entries.text[0][2] ^= 1;
  assert.throws(
    () => zipOf(store, ['reading_a'], 'text'),
    (e) => e.code === 'STORAGE_CORRUPT'
  );
  const { call, plan } = await serve(t, libraryExportRouter({ exports: store }));
  const p = await (await plan(['reading_a'])).json();
  // Refused before or during the body: either way the client never gets a complete ZIP.
  await assert.rejects(async () => {
    const res = await call(p.url);
    await res.arrayBuffer();
  });
});

test('without an installed store, planning answers 503', async (t) => {
  const { plan } = await serve(t, libraryExportRouter({ exports: null }));
  assert.equal((await plan(['reading_a'])).status, 503);
});

test('the plan cache keeps to its byte budget and always keeps the newest plan', async (t) => {
  const ids = Array.from({ length: 50 }, (_, i) => `reading_${String(i).padStart(2, '0')}`);
  const store = storeOf(
    t,
    ids.map((id) => reading(id))
  );
  // 3 readings cost 12 + 128 bytes; a 300-byte budget holds two such plans.
  const router = libraryExportRouter({ exports: store, planBytes: 300 });
  const { call, plan } = await serve(t, router);
  const p1 = await (await plan(ids.slice(0, 3))).json();
  const p2 = await (await plan(ids.slice(3, 6))).json();
  const p3 = await (await plan(ids.slice(6, 9))).json();
  const expired = await call(p1.url);
  assert.equal(expired.status, 409);
  assert.equal(JSON.parse(await expired.text()).error.code, 'PLAN_EXPIRED');
  for (const p of [p2, p3]) assert.equal((await call(p.url)).status, 200);
  // A selection larger than the whole budget (49 readings: 196 + 128 bytes)
  // is still served, never refused.
  const big = await (await plan(ids.slice(0, 49))).json();
  const res = await call(big.url);
  assert.equal(res.status, 200);
  assert.equal(Buffer.from(await res.arrayBuffer()).length, big.bytes);
});

test('an export store whose tables differ from their recorded sha256 refuses to load', (t) => {
  const store = storeOf(t, [reading('reading_a'), reading('reading_b')]);
  const dir = store.directory;
  const units = path.join(dir, 'export-units.json');
  const original = fs.readFileSync(units, 'utf8');
  // A misassembled table: one reading's revision changed, the record not.
  fs.writeFileSync(units, original.replace(/"revision":"[^"]*"/, '"revision":"rev_other"'));
  assert.throws(() => new ExportStore(dir), /export-units\.json differs/);
  fs.writeFileSync(units, original);
  assert.ok(new ExportStore(dir));
  const items = path.join(dir, 'items.bin');
  const bytes = fs.readFileSync(items);
  bytes[0] ^= 1;
  fs.writeFileSync(items, bytes);
  assert.throws(() => new ExportStore(dir), /items\.bin differs/);
  bytes[0] ^= 1;
  fs.writeFileSync(items, bytes);
  const meta = path.join(dir, 'export-store.json');
  const record = JSON.parse(fs.readFileSync(meta, 'utf8'));
  delete record.files['sources.bin'];
  fs.writeFileSync(meta, JSON.stringify(record));
  assert.throws(() => new ExportStore(dir), /records no sha256 for sources\.bin/);
});
