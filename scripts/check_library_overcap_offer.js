'use strict';
// Local action-level check: real reader dispatch, envelope construction and size guard.
// DOM mounting/layout and file-import parsing are deliberately outside this check.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash, webcrypto } = require('node:crypto');
const Import = require('../src/library-import.js');
const ROOT = path.join(__dirname, '..');
const ID = 'reading_12345678-1234-5678-9012-123456789012';
const REV = 'a'.repeat(64),
  SNAP = 'c'.repeat(64),
  DATA = 'd'.repeat(64);
const canonical = Import.canonical;
const sha = (x) =>
  createHash('sha256')
    .update(typeof x === 'string' ? x : canonical(x))
    .digest('hex');
function fixture(options = {}) {
  const files = new Map(),
    downloads = [],
    handoffs = [],
    attempts = [];
  const rights = { sources: [], file_sources: [], notices: [], required_attribution: [] };
  const metadata = { title: 'Saved reading' },
    rr = sha(rights),
    mr = sha(metadata);
  files.set(`rights/r-${rr.slice(0, 2)}.json.gz`, canonical({ rights: { [rr]: rights } }));
  files.set(
    `meta/${(parseInt(mr.slice(0, 2), 16) >> 2).toString(16).padStart(2, '0')}.json.gz`,
    canonical({ metadata: { [mr]: metadata } })
  );
  function addHead(revision) {
    const texts = ['Small selected excerpt', options.tail || 'A café at dusk'];
    const text = texts.join('\n');
    let sourceCp = 0;
    const head = {
      reading_unit_id: ID,
      reading_revision: revision,
      page_index: 0,
      page_count: 1,
      pages: [],
      start: {
        row_start: 0,
        analysis_line_start: 0,
        normalized_cp_start: 0,
        normalized_utf16_start: 0,
      },
      lines: texts.map((line, i) => {
        const start = sourceCp;
        sourceCp += [...line].length;
        const row = ['lyric', line, 0, i + 1, i + 1, [start, sourceCp], null, []];
        sourceCp += 1; // newline before the next source line
        return row;
      }),
      normalized_sha256: sha(text),
      canonical_reading_sha256: sha('canonical:' + revision),
      rights_ref: rr,
      metadata_ref: mr,
      source_map: {},
      source_marks: {},
      source_labels: [],
      source_sha256: sha(text),
      source_path: 'fixture.txt',
      work_reviewed_equivalence: false,
      title: 'Saved reading',
      language: 'eng',
      work_id: 'work:fixture',
      edition_id: 'edition:fixture',
      contributors: [],
      completeness: 'complete',
    };
    const bytes = canonical(head),
      key = revision.slice(0, 16) + '-' + sha(bytes).slice(0, 12);
    files.set(`r/12/${ID}/${key}/head.json.gz`, bytes);
    return key;
  }
  const oldKey = addHead(REV);
  const currentKey = oldKey;
  const catalog = { data_id: DATA, projected_from: { snapshot_id: SNAP } };
  const shard = {
    data_id: DATA,
    units: [[ID, currentKey, 'collection:fixture']],
  };
  files.set('u/12.json.gz', JSON.stringify(shard));
  const lib = { base: 'https://fixture.invalid/', catalog: async () => catalog };
  const ctx = vm.createContext({
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    Response,
    Blob,
    DecompressionStream,
    CMLibraryImport: { ...Import, TRANSFER_BYTES: options.cap || Import.TRANSFER_BYTES },
    console: { error() {}, warn() {} },
    esc: String,
    icon: () => '',
    uiDownload: (...x) => downloads.push(x),
    uiOpenInLyrics: async (x) => {
      attempts.push(x);
      if (options.onOpen) await options.onOpen(x, attempts.length);
      handoffs.push(x);
    },
    fetch: async (url) => {
      const name = String(url).replace(lib.base, '');
      return files.has(name) ? new Response(files.get(name)) : new Response('', { status: 404 });
    },
  });
  // Expose existing action closures without adding test-only production APIs.
  let source = fs.readFileSync(path.join(ROOT, 'src/library/reader.js'), 'utf8');
  assert.equal(source.split('_internals: {').length, 2, 'reader action hook must be unique');
  source = source.replace('_internals: {', '_internals: { onClick, setState: (s) => S = s,');
  if (options.mutate) source = options.mutate(source);
  const reader = vm.runInContext(`(function () { ${source}\n})()`, ctx)._internals;
  async function open() {
    const R = await reader.openReading(lib, ID, oldKey);
    const main = { innerHTML: 'synthetic reading remains visible' },
      alerts = { innerHTML: '' };
    const state = {
      lib,
      R,
      main,
      root: { querySelector: (s) => (s === '[data-rd-alerts]' ? alerts : null) },
      sel: new Set([R.pages.get(0).lines[0].id]),
      busy: false,
      ana: { declarations: {} },
      anaP: Promise.resolve({ declarations: {} }),
    };
    reader.setState(state);
    const click = (action) =>
      reader.onClick({
        target: {
          closest: () => ({
            tagName: 'BUTTON',
            dataset: { rd: action },
          }),
        },
      });
    return { R, state, main, alerts, click };
  }
  return { reader, lib, downloads, handoffs, attempts, open };
}
// A small injected transfer limit keeps boundary/fault checks cheap; the final
// scenario below also runs against the unchanged production transfer limit.
const CAP = 4096;
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
async function overcap(mutate, cap = CAP) {
  // UTF-8 is over the cap while JS string length is below it at the small cap.
  const f = fixture({ cap, tail: 'é'.repeat(Math.ceil(cap / 2)), mutate });
  const view = await f.open();
  const preview = await f.reader.buildEnvelope(f.lib, view.R, null, {});
  assert.ok(bytes(preview) > cap);
  if (cap === CAP) assert.ok(JSON.stringify(preview).length < cap);
  await view.click('lyrics');
  assert.equal(f.handoffs.length, 0, 'oversized whole must not open in Lyrics');
  assert.equal(f.downloads.length, 1, 'oversized whole must offer a bundle');
  const [name, encoded, mime] = f.downloads[0];
  assert.equal(name, 'codex-musica-library-import.json');
  assert.equal(mime, 'application/json');
  const bundle = JSON.parse(encoded);
  await Import.validateEnvelope(bundle, webcrypto);
  assert.equal(bundle.payload.scope, 'whole');
  assert.equal(bundle.payload.text, 'Small selected excerpt\n' + 'é'.repeat(Math.ceil(cap / 2)));
  assert.equal(bundle.payload.lineage.length, 2);
  assert.match(view.alerts.innerHTML, /bundle was downloaded/i);
  assert.match(view.alerts.innerHTML, /in Lyrics, choose Import/i);
  assert.match(view.alerts.innerHTML, /select an excerpt/i, 'offer must explain excerpt recovery');
  assert.equal(view.state.busy, false, 'oversize must release the busy guard');
  await view.click('p-lyrics');
  assert.equal(f.downloads.length, 1, 'small excerpt must not download again');
  assert.equal(f.handoffs.length, 1, 'excerpt must recover after oversized whole');
  const excerpt = f.handoffs[0];
  assert.equal(excerpt.payload.scope, 'excerpt');
  assert.equal(excerpt.payload.text, 'Small selected excerpt');
  assert.equal(excerpt.payload.lineage.length, 1);
  assert.equal(excerpt.payload.lineage[0].line_id, [...view.state.sel][0]);
  assert.ok(bytes(excerpt) <= cap);
  await Import.validateEnvelope(excerpt, webcrypto);
  assert.equal(view.state.busy, false);
}
async function boundary(delta, mutate) {
  // Measure the real serialized envelope, including provenance/range digits.
  // UUIDs, dates and digests have fixed serialized lengths; no production
  // serializer or digest implementation is replaced.
  let length = 100;
  for (let attempt = 0; attempt < 8; attempt++) {
    const f = fixture({ cap: CAP, tail: 'x'.repeat(length), mutate });
    const view = await f.open();
    const envelope = await f.reader.buildEnvelope(f.lib, view.R, null, {});
    const difference = CAP + delta - bytes(envelope);
    if (difference) {
      length += difference;
      continue;
    }
    await view.click('lyrics');
    assert.equal(f.handoffs.length, delta > 0 ? 0 : 1, 'exact byte boundary handoff');
    assert.equal(f.downloads.length, delta > 0 ? 1 : 0, 'exact byte boundary bundle');
    const deliveredBytes = delta > 0 ? Buffer.byteLength(f.downloads[0][1]) : bytes(f.handoffs[0]);
    assert.equal(deliveredBytes, CAP + delta, 'dispatched envelope must match measured boundary');
    assert.equal(view.state.busy, false);
    return;
  }
  assert.fail('could not construct exact serialized boundary');
}
async function refusedHandoff(excerpt, mutate) {
  const f = fixture({
    cap: CAP,
    mutate,
    onOpen: async (_envelope, attempt) => {
      if (attempt === 1) throw Error('synthetic receiver refusal');
    },
  });
  const view = await f.open();
  const action = excerpt ? 'p-lyrics' : 'lyrics';
  await view.click(action);
  assert.equal(f.attempts.length, 1, 'under-cap action must reach Lyrics');
  assert.equal(f.handoffs.length, 0, 'refused action must not activate');
  assert.ok(bytes(f.attempts[0]) <= CAP);
  assert.equal(f.downloads.length, 1, 'receiver refusal must download its envelope');
  const [name, encoded, mime] = f.downloads[0];
  assert.equal(name, 'codex-musica-library-import.json');
  assert.equal(mime, 'application/json');
  const bundle = JSON.parse(encoded);
  assert.deepEqual(
    bundle,
    JSON.parse(JSON.stringify(f.attempts[0])),
    'fallback must retain the exact attempted envelope'
  );
  await Import.validateEnvelope(bundle, webcrypto);
  assert.equal(bundle.payload.scope, excerpt ? 'excerpt' : 'whole');
  assert.equal(
    bundle.payload.text,
    excerpt ? 'Small selected excerpt' : 'Small selected excerpt\nA café at dusk'
  );
  assert.equal(bundle.payload.lineage.length, excerpt ? 1 : 2);
  if (excerpt) {
    assert.equal(bundle.payload.lineage[0].line_id, [...view.state.sel][0]);
    assert.deepEqual(bundle.payload.declarations, []);
  }
  assert.match(view.alerts.innerHTML, /Import bundle downloaded\. In Lyrics, choose Import\./);
  assert.match(view.alerts.innerHTML, /Lyrics could not open it here: synthetic receiver refusal/);
  assert.equal(view.state.busy, false, 'receiver refusal must release busy guard');
  await view.click(action);
  assert.equal(f.attempts.length, 2, 'retry must reach Lyrics after refusal');
  assert.equal(f.handoffs.length, 1);
  assert.equal(f.downloads.length, 1, 'successful retry must not download again');
  assert.deepEqual(JSON.parse(JSON.stringify(f.handoffs[0].payload)), bundle.payload);
  assert.equal(view.alerts.innerHTML, '', 'successful retry must clear refusal guidance');
  assert.equal(view.state.busy, false);
}
async function overcapExcerpt(mutate) {
  const tail = 'é'.repeat(CAP / 2);
  const f = fixture({ cap: CAP, tail, mutate });
  const view = await f.open();
  const lines = view.R.pages.get(0).lines;
  view.state.sel = new Set([lines[1].id]);
  await view.click('p-lyrics');
  assert.equal(f.attempts.length, 0, 'oversized excerpt must not reach Lyrics');
  assert.equal(f.downloads.length, 1, 'oversized excerpt must offer its own bundle');
  const [name, encoded, mime] = f.downloads[0];
  assert.equal(name, 'codex-musica-library-import.json');
  assert.equal(mime, 'application/json');
  const bundle = JSON.parse(encoded);
  assert.ok(Buffer.byteLength(encoded) > CAP);
  await Import.validateEnvelope(bundle, webcrypto);
  assert.equal(bundle.payload.scope, 'excerpt');
  assert.equal(bundle.payload.text, tail, 'excerpt bundle must exclude unselected text');
  assert.equal(bundle.payload.lineage.length, 1);
  assert.equal(bundle.payload.lineage[0].line_id, lines[1].id);
  assert.deepEqual(bundle.payload.declarations, []);
  assert.match(view.alerts.innerHTML, /bundle was downloaded.*choose Import, or select an excerpt/);
  assert.equal(view.state.busy, false);
  view.state.sel = new Set([lines[0].id]);
  await view.click('p-lyrics');
  assert.equal(f.attempts.length, 1, 'smaller selection must recover after oversized excerpt');
  assert.equal(f.handoffs.length, 1);
  assert.equal(f.downloads.length, 1);
  assert.equal(f.handoffs[0].payload.text, lines[0].text);
  assert.equal(f.handoffs[0].payload.scope, 'excerpt');
  assert.equal(f.handoffs[0].payload.lineage.length, 1);
  assert.equal(f.handoffs[0].payload.lineage[0].line_id, lines[0].id);
  assert.ok(bytes(f.handoffs[0]) <= CAP);
  await Import.validateEnvelope(f.handoffs[0], webcrypto);
  assert.equal(view.alerts.innerHTML, '');
  assert.equal(view.state.busy, false);
}
function fault(from, to) {
  return (source) => {
    assert.equal(source.split(from).length, 2, 'fault must target exactly one production site');
    return source.replace(from, to);
  };
}
test('in-page UTF-8 over-cap whole offers bundle and recovers with selected excerpt', () =>
  overcap());
for (const delta of [-1, 0, 1])
  test(`in-page serialized envelope at transfer cap ${delta >= 0 ? '+' : ''}${delta}`, () =>
    boundary(delta));
test('unchanged production cap: oversized whole followed by excerpt', () =>
  overcap(null, Import.TRANSFER_BYTES));
test('empty selection fails locally and a later excerpt still succeeds', async () => {
  const f = fixture({ cap: CAP }),
    view = await f.open();
  const selected = [...view.state.sel];
  view.state.sel.clear();
  await view.click('p-lyrics');
  assert.match(view.alerts.innerHTML, /Select at least one analysis line/);
  assert.equal(f.downloads.length, 0);
  assert.equal(f.handoffs.length, 0);
  assert.equal(view.state.busy, false);
  view.state.sel.add(selected[0]);
  await view.click('p-lyrics');
  assert.equal(f.handoffs.length, 1);
});
for (const excerpt of [false, true])
  test(`receiver refusal downloads exact ${excerpt ? 'excerpt' : 'whole'} envelope and retry recovers`, () =>
    refusedHandoff(excerpt));
test('oversized excerpt downloads only selected data and smaller selection recovers', () =>
  overcapExcerpt());
for (const [name, mutate, check, message] of [
  [
    'drop receiver-refusal fallback download',
    fault(
      "uiDownload('codex-musica-library-import.json', JSON.stringify(envelope), 'application/json');",
      'void envelope;'
    ),
    (m) => refusedHandoff(false, m),
    /receiver refusal must download its envelope/,
  ],
  [
    'truncate receiver-refusal fallback text',
    fault(
      "JSON.stringify(envelope), 'application/json'",
      "JSON.stringify({ ...envelope, payload: { ...envelope.payload, text: '' } }), 'application/json'"
    ),
    (m) => refusedHandoff(true, m),
    /fallback must retain the exact attempted envelope/,
  ],
  [
    'exempt selected excerpts from transfer cap',
    fault(
      'enc.encode(encoded).length > TRANSFER_BYTES',
      '!excerpt && enc.encode(encoded).length > TRANSFER_BYTES'
    ),
    overcapExcerpt,
    /oversized excerpt must not reach Lyrics/,
  ],
  [
    'bypass size guard',
    fault('enc.encode(encoded).length > TRANSFER_BYTES', 'false'),
    overcap,
    /oversized whole must not open/,
  ],
  [
    'count characters instead of UTF-8 bytes',
    fault('enc.encode(encoded).length > TRANSFER_BYTES', 'encoded.length > TRANSFER_BYTES'),
    overcap,
    /oversized whole must not open/,
  ],
  [
    'drop bundle download',
    fault(
      "uiDownload('codex-musica-library-import.json', encoded, 'application/json');",
      'void encoded;'
    ),
    overcap,
    /must offer a bundle/,
  ],
  [
    'drop excerpt advice',
    fault('or select an excerpt.', 'or try again.'),
    overcap,
    /offer must explain excerpt recovery/,
  ],
  [
    'leave busy guard set',
    fault('if (S) S.busy = false;', 'if (S) S.busy = true;'),
    overcap,
    /release the busy guard/,
  ],
  [
    'dispatch excerpt as whole',
    fault('return handoff(true);', 'return handoff(false);'),
    overcap,
    /small excerpt must not download again/,
  ],
  [
    'reject exactly-at-cap envelope',
    fault(
      'enc.encode(encoded).length > TRANSFER_BYTES',
      'enc.encode(encoded).length >= TRANSFER_BYTES'
    ),
    (m) => boundary(0, m),
    /exact byte boundary handoff/,
  ],
])
  test(`planted defect detected: ${name}`, async () => {
    await assert.rejects(
      check(mutate),
      (error) => error.code === 'ERR_ASSERTION' && message.test(error.message)
    );
  });
