// Library search: the store builder (lyric-harness/library/search_store.py),
// the engine (library_search.js) and the public routes (library_routes.js),
// on a small synthetic export that exercises each SQLite semantic the engine
// reproduces. Parity with the approved Worker on the real 317c corpus is the
// separate golden replay (test_library_search_parity.mjs, library-site.yml).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { test } from 'node:test';
import express from 'express';
import { LibrarySearch, searchText, SEARCH_LIMIT } from './library_search.js';
import { libraryPublicRouter, redactLibraryUrl } from './library_routes.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const harness = path.join(here, '..', 'lyric-harness');
const sha = (b) => createHash('sha256').update(b).digest('hex');

function summary(id, fields = {}) {
  return {
    availability: 'readable',
    collection_ids: ['col_a'],
    completeness: 'complete',
    contributor_search: 'anon',
    language: 'eng',
    reading_revision: `rev_${id}`,
    reading_unit_id: id,
    title: fields.title_search ?? id,
    title_search: id,
    work_id: `work_${id}`,
    ...fields,
  };
}
// One line per body line, with exact identity spans (search == normalized).
function reading(id, text) {
  const lines = [];
  const spans = [];
  let cp = 0,
    utf16 = 0,
    bytes = 0;
  text.split('\n').forEach((row, i) => {
    const n = Array.from(row).length;
    lines.push({
      id: `line_${id}_${i}`,
      physical_line: i + 1,
      normalized_cp_range: [cp, cp + n],
      source_cp_range: [cp, cp + n],
      source_utf16_range: [utf16, utf16 + row.length],
      byte_range: [bytes, bytes + Buffer.byteLength(row)],
      source_text: row,
      transformation_spans: [
        {
          normalized_cp_range: [cp, cp + n],
          source_cp_range: [cp, cp + n],
          source_utf16_range: [utf16, utf16 + row.length],
          byte_range: [bytes, bytes + Buffer.byteLength(row)],
          precision: 'exact',
          kind: 'kept',
        },
      ],
    });
    spans.push({
      search_cp_range: [cp, cp + n],
      normalized_cp_range: [cp, cp + n],
      precision: 'exact',
    });
    cp += n + 1;
    utf16 += row.length + 1;
    bytes += Buffer.byteLength(row) + 1;
  });
  return { reading_unit_id: id, search: { text, spans }, lines };
}

function writeExport(dir, items, chunkParts = []) {
  fs.mkdirSync(path.join(dir, 'packs'), { recursive: true });
  const packs = [];
  const put = (name, kind, value) => {
    const raw = Buffer.from(JSON.stringify(value));
    fs.writeFileSync(path.join(dir, name), zlib.gzipSync(raw));
    packs.push({ path: name, kind, raw_bytes: raw.length, raw_sha256: sha(raw) });
  };
  put('packs/readings-00000.json.gz', 'readings', { snapshot_id: 'snap', readings: items });
  chunkParts.forEach(([name, part]) => put(name, 'reading_chunks', part));
  fs.writeFileSync(
    path.join(dir, 'import_manifest.json'),
    JSON.stringify({ snapshot_id: 'snap', packs })
  );
}

function build(t, items, chunkParts) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'library-search-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeExport(path.join(root, 'export'), items, chunkParts);
  execFileSync(
    'python3',
    ['-m', 'library.search_store', path.join(root, 'export'), path.join(root, 'store')],
    {
      cwd: harness,
      stdio: 'pipe',
    }
  );
  const store = new LibrarySearch(path.join(root, 'store'));
  t.after(() => store.close());
  return { store, dir: path.join(root, 'store') };
}
const item = (id, fields, text) => ({
  summary: summary(id, fields),
  reading: text === undefined ? null : reading(id, text),
  reading_chunks: {},
  reading_is_header: false,
  reading_parts: [],
});
const q = (params) => new URLSearchParams(params);
const ids = (body) => body.items.map((x) => x.reading_unit_id);

test('order is UTF-8 byte order (SQLite BINARY), ties broken by id', (t) => {
  const { store } = build(t, [
    item('u3', { title_search: 'éclair' }, 'x'),
    item('u1', { title_search: 'apple' }, 'x'),
    item('u2', { title_search: 'Zebra' }, 'x'),
    item('u0', { title_search: 'apple' }, 'x'),
  ]);
  assert.deepEqual(ids(store.search(q({}))), ['u2', 'u0', 'u1', 'u3']);
});

test('contributor order puts the empty contributor first, then title, then id', (t) => {
  const { store } = build(t, [
    item('u1', { title_search: 'b', contributor_search: 'zed' }, 'x'),
    item('u2', { title_search: 'a', contributor_search: null }, 'x'),
    item('u3', { title_search: 'a', contributor_search: 'zed' }, 'x'),
  ]);
  assert.deepEqual(ids(store.search(q({ sort: 'contributor' }))), ['u2', 'u3', 'u1']);
});

test('instr: first match, 1-based in code points, projected onto the right line', (t) => {
  const { store } = build(t, [item('u1', {}, 'ḤĀFEẒ sea\nthe sea again')]);
  const body = store.search(q({ q: 'sea' }));
  assert.equal(body.total, 1);
  const hit = body.items[0].search_hit;
  assert.deepEqual(hit.normalized_cp_range, [6, 9]); // after 5 non-ASCII code points and a space
  assert.equal(hit.line_id, 'line_u1_0');
  assert.equal(hit.row_offset, 0);
  assert.equal(hit.precision, 'exact');
  assert.deepEqual(hit.source_ranges[0].codepoint_range, [6, 9]);
  assert.equal(body.items[0].snippet, 'ḤĀFEẒ sea');
});

test('a match never spans two units, and empty bodies never claim one', (t) => {
  const { store } = build(t, [
    item('u1', {}, 'ab'),
    item('u2', { availability: 'held' }),
    item('u3', {}, 'cd'),
  ]);
  assert.equal(store.search(q({ q: 'bc' })).total, 0);
  assert.equal(store.search(q({ q: 'cd' })).items[0].reading_unit_id, 'u3');
});

test("lower() is ASCII-only, and an all-space contributor matches everyone (instr(x,'') = 1)", (t) => {
  const { store } = build(t, [
    item('u1', { contributor_search: 'ÉMILE DUPONT' }, 'x'),
    item('u2', { contributor_search: 'someone' }, 'x'),
  ]);
  assert.deepEqual(ids(store.search(q({ contributor: 'dupont' }))), ['u1']);
  assert.equal(store.search(q({ contributor: 'émile' })).total, 0, 'É is not lowered');
  assert.equal(store.search(q({ contributor: '   ' })).total, 2);
});

test('filters: equality, "all", collection membership and work', (t) => {
  const { store } = build(t, [
    item('u1', { language: 'eng', collection_ids: ['a', 'b'] }, 'x'),
    item('u2', { language: 'cym', availability: 'held', collection_ids: ['b'] }),
    item('u3', { language: 'eng', completeness: 'excerpt', collection_ids: ['c'] }, 'x'),
  ]);
  assert.deepEqual(ids(store.search(q({ language: 'eng' }))), ['u1', 'u3']);
  assert.equal(store.search(q({ language: 'all' })).total, 3);
  assert.deepEqual(ids(store.search(q({ availability: 'held' }))), ['u2']);
  assert.deepEqual(ids(store.search(q({ completeness: 'excerpt' }))), ['u3']);
  assert.deepEqual(ids(store.search(q({ collection: 'b' }))), ['u1', 'u2']);
  assert.deepEqual(ids(store.search(q({ work: 'work_u3' }))), ['u3']);
});

test('held units: metadata and an empty snippet, never a hit projection', (t) => {
  const { store } = build(t, [item('u1', { availability: 'held', title_search: 'sea' })]);
  const body = store.search(q({ q: 'sea' }));
  assert.equal(body.items[0].snippet, '');
  assert.equal(body.items[0].search_hit, null);
  assert.equal(store.metadataById('u1').availability, 'held');
});

test("paging and validation follow the Worker's Number() rules; the page cap is 100", (t) => {
  const { store } = build(
    t,
    Array.from({ length: 120 }, (_, i) => item(`u${String(i).padStart(3, '0')}`, {}, 'x'))
  );
  assert.equal(store.search(q({ limit: '250' })).items.length, SEARCH_LIMIT);
  assert.equal(store.search(q({ limit: '250' }), { maxLimit: 250 }).items.length, 120);
  const page = store.search(q({ offset: '110' }));
  assert.equal(page.items.length, 10);
  assert.equal(page.next_offset, null);
  assert.equal(store.search(q({ limit: ' 5 ' })).items.length, 5, 'Number(" 5 ") is 5');
  for (const bad of [
    { limit: '0' },
    { limit: '' },
    { limit: 'abc' },
    { offset: '-1' },
    { offset: '1.5' },
  ])
    assert.throws(
      () => store.search(q(bad)),
      (e) => e.code === 'BAD_QUERY' && e.status === 400
    );
  assert.throws(
    () => store.search(q({ q: 'a'.repeat(501) })),
    (e) => e.code === 'BAD_QUERY'
  );
  assert.equal(store.search(q({ q: 'a'.repeat(500) })).total, 0);
});

test('a page over 2 MiB drops trailing items, as the Worker did', (t) => {
  const big = 'x'.repeat(1_200_000);
  const { store } = build(t, [
    item('u1', { padding: big }, 'x'),
    item('u2', { padding: big }, 'x'),
  ]);
  const body = store.search(q({}));
  assert.equal(body.items.length, 1);
  assert.equal(body.total, 2);
  assert.equal(body.next_offset, 1);
});

test('header readings: logical chunks are joined and projection reads only what it needs', (t) => {
  const id = 'h1';
  const text = 'first line\nsecond line holds the word';
  const r = reading(id, text);
  const part = (field, index, count, value) => [
    `packs/reading_chunks-${field.replace('.', '_')}-${index}.json.gz`,
    {
      field,
      part_index: index,
      part_count: count,
      reading_unit_id: id,
      reading_revision: `rev_${id}`,
      value,
    },
  ];
  const parts = [
    part('search.text', 0, 2, text.slice(0, 11)),
    part('search.text', 1, 2, text.slice(11)),
    part('search.spans', 0, 1, r.search.spans),
    part('lines', 0, 1, r.lines),
  ];
  const chunks = {};
  for (const [name, p] of parts) (chunks[p.field] ??= []).push(name);
  const { store } = build(
    t,
    [
      {
        summary: summary(id),
        reading: { reading_unit_id: id },
        reading_chunks: chunks,
        reading_is_header: true,
        reading_parts: [],
      },
    ],
    parts
  );
  const hit = store.search(q({ q: 'word' })).items[0].search_hit;
  assert.equal(hit.line_id, 'line_h1_1');
  assert.equal(hit.row_offset, 1);
});

test('searchText folds as the Worker did: NFC, casefold table, whitespace collapse', () => {
  assert.equal(searchText('  The SEA\n\tSTRASSE '), 'the sea strasse');
  assert.equal(searchText('Straße'), 'strasse');
  assert.equal(searchText('é'), 'é');
});

test('a truncated column refuses to load', (t) => {
  const { dir } = build(t, [item('u1', {}, 'abc')]);
  fs.truncateSync(path.join(dir, 'body.bin'), 1);
  assert.throws(() => new LibrarySearch(dir), /truncated/);
});

async function serve(t, router) {
  const app = express();
  app.use('/library/v1', router);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/library/v1`;
  return (p, init) => fetch(base + p, init);
}

test('routes: health, cacheable search and metadata, refusals', async (t) => {
  const { store } = build(t, [item('u1', { title_search: 'sea song' }, 'the sea')]);
  const get = await serve(t, libraryPublicRouter({ search: store }));
  const health = await (await get('/health')).json();
  assert.equal(health.contract, 1);
  assert.equal(health.snapshot_id, 'snap');
  assert.equal(health.search_ready, true);
  assert.equal(health.analysis_available, false);
  assert.deepEqual(health.counts, { units: 1, readable: 1 });

  const res = await get('/search?q=sea');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  const etag = res.headers.get('etag');
  assert.equal((await res.json()).total, 1);
  assert.equal((await get('/search?q=sea', { headers: { 'If-None-Match': etag } })).status, 304);

  const bad = await get('/search?limit=0');
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await bad.json(), {
    error: {
      code: 'BAD_QUERY',
      message: 'Invalid search page.',
      remedy: 'Check the input and try again.',
    },
  });
  assert.equal((await get('/metadata/u1')).status, 200);
  assert.equal((await get('/metadata/nope')).status, 404);
  assert.equal((await get('/metadata/bad%20id')).status, 400);
  assert.equal((await get('/search', { method: 'POST' })).status, 405);
  assert.equal((await get('/nothing')).status, 404);
});

test('without an installed store, search answers 503 and health says so', async (t) => {
  const get = await serve(t, libraryPublicRouter({ search: null }));
  assert.equal((await get('/search?q=x')).status, 503);
  const health = await (await get('/health')).json();
  assert.equal(health.search_ready, false);
  assert.equal(health.snapshot_id, null);
});

test('the request log never records search terms', () => {
  assert.equal(redactLibraryUrl('/library/v1/search?q=my+secret'), '/library/v1/search?<redacted>');
  assert.equal(redactLibraryUrl('/library/v1/search'), '/library/v1/search');
  assert.equal(redactLibraryUrl('/library/v1/metadata/u1'), '/library/v1/metadata/u1');
});

test("the fold table is the Worker's own, until the old Site is retired", () => {
  const worker = path.join(here, '..', 'sites/library/lib/unicode-casefold.json');
  if (!fs.existsSync(worker)) return; // retired (design PR 7): this copy is then the only one
  assert.equal(
    sha(fs.readFileSync(path.join(here, 'library_casefold.json'))),
    sha(fs.readFileSync(worker))
  );
});
