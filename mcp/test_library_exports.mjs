// Library selection exports (library_exports.js): the store build, content
// identity, the plan/download contract, stream limits and verification, on a
// synthetic export. Byte parity with the Worker's own ZIPs on 317c is the
// golden replay (test_library_exports_parity.mjs, library-site.yml).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { test } from 'node:test';
import express from 'express';
import { ExportStore, buildExportStore, contentId, zipChunks } from './library_exports.js';
import { libraryExportRouter } from './library_export_routes.js';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const NOTICE = 'A notice that must travel.';
const SOURCE_TEXT = 'The whole original source.\n';
const SOURCE_SHA = sha(SOURCE_TEXT);

function reading(id, { revision = `rev_${id}`, text = 'line one\nline two' } = {}) {
  const lines = text.split('\n').map((row, i) => ({
    id: `line_${id}_${i}`,
    physical_line: i + 1,
    analysis_line: i + 1,
    kind: 'lyric',
    text: row,
    source_text: row,
  }));
  return {
    reading_unit_id: id,
    reading_revision: revision,
    work_id: `work_${id}`,
    edition_id: `ed_${id}`,
    title: `Title, "${id}"`,
    language: 'eng',
    source_path: `corpus/${id}.txt`,
    source_sha256: SOURCE_SHA,
    contributors: [{ role: 'author', name: 'Anon' }],
    rights: {
      basis: 'public domain',
      notices: [{ sha256: sha(NOTICE), text: NOTICE, scope: 'all' }],
    },
    source_marks: [{ physical_line: 1, name: 'VERSE', raw: '[Verse]' }],
    source_map: { rows: lines.map((l) => l.id) },
    lines,
    normalized_text: text,
    source_text: text,
    search: { text, spans: [] },
  };
}
function writeExport(dir, readings, { snapshot = 'snap', wholeSource = true } = {}) {
  fs.mkdirSync(path.join(dir, 'packs'), { recursive: true });
  const packs = [];
  const put = (name, kind, value) => {
    const raw = Buffer.from(JSON.stringify(value));
    fs.writeFileSync(path.join(dir, name), zlib.gzipSync(raw));
    packs.push({ path: name, kind, raw_bytes: raw.length, raw_sha256: sha(raw) });
  };
  put('packs/readings-00000.json.gz', 'readings', {
    snapshot_id: snapshot,
    readings: readings.map((r) => ({
      summary: {
        reading_unit_id: r.reading_unit_id,
        reading_revision: r.reading_revision,
        availability: 'readable',
        whole_source_availability: wholeSource ? 'readable' : 'held',
        source_sha256: SOURCE_SHA,
      },
      reading: r,
      reading_chunks: {},
      reading_is_header: false,
      reading_parts: [],
    })),
  });
  put('packs/sources-00000.json.gz', 'sources', {
    snapshot_id: snapshot,
    sources: [{ path: `sources/${SOURCE_SHA}.bin`, sha256: SOURCE_SHA, text: SOURCE_TEXT }],
  });
  fs.writeFileSync(
    path.join(dir, 'import_manifest.json'),
    JSON.stringify({
      snapshot_id: snapshot,
      packs,
      whole_sources: { [SOURCE_SHA]: { availability: wholeSource ? 'readable' : 'held' } },
      derived_metadata: { rights_registry_sha256: 'r'.repeat(64) },
    })
  );
}
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
