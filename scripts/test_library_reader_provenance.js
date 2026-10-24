'use strict';
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
  NEXT = 'b'.repeat(64),
  SNAP = 'c'.repeat(64),
  DATA = 'd'.repeat(64);
const canonical = Import.canonical;
const sha = (x) =>
  createHash('sha256')
    .update(typeof x === 'string' ? x : canonical(x))
    .digest('hex');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(options = {}) {
  const files = new Map(),
    requests = [],
    downloads = [],
    handoffs = [];
  const rights = { sources: [], file_sources: [], notices: [], required_attribution: [] };
  const metadata = { title: 'Saved reading' },
    rr = sha(rights),
    mr = sha(metadata);
  files.set(`rights/r-${rr.slice(0, 2)}.json.gz`, canonical({ rights: { [rr]: rights } }));
  files.set(
    `meta/${(parseInt(mr.slice(0, 2), 16) >> 2).toString(16).padStart(2, '0')}.json.gz`,
    canonical({ metadata: { [mr]: metadata } })
  );
  function addHead(revision, projection = '') {
    const text = 'A café at dusk';
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
      lines: [['lyric', text, 0, 1, 1, [0, text.length], null, []]],
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
      title: 'Saved reading' + projection,
      language: 'eng',
      work_id: 'work:fixture',
      edition_id: 'edition:fixture',
      contributors: [],
      completeness: 'complete',
    };
    let page;
    if (options.extraPage) {
      head.page_count = 2;
      page = canonical({ reading_unit_id: ID, reading_revision: revision,
        page_index: 1, page_count: 2, start: { row_start: 1, analysis_line_start: 1,
          normalized_cp_start: text.length + 1, normalized_utf16_start: text.length + 1 }, lines: [] });
      head.pages = [sha(page)];
    }
    const bytes = canonical(head),
      key = revision.slice(0, 16) + '-' + sha(bytes).slice(0, 12);
    files.set(`r/12/${ID}/${key}/head.json.gz`, bytes);
    if (page) files.set(`r/12/${ID}/${key}/1-${sha(page).slice(0, 12)}.json.gz`, page);
    return key;
  }
  const oldKey = addHead(REV);
  const currentKey =
    options.currentRevision || options.projectionOnly
      ? addHead(options.currentRevision || REV, ' projection')
      : oldKey;
  const catalog = { data_id: DATA, projected_from: { snapshot_id: SNAP } };
  const shard = {
    data_id: options.shardDataId || DATA,
    units: options.missingUnit ? [] : [[ID, currentKey, 'collection:fixture']],
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
    CMLibraryImport: Import,
    console: { error() {}, warn() {} },
    clearTimeout,
    window: {},
    uiEmptyState: ({ title, text }) => `${title}: ${text}`,
    esc: String,
    icon: () => '',
    uiDownload: (...x) => downloads.push(x),
    uiOpenInLyrics: async (x) => handoffs.push(x),
    fetch: async (url) => {
      const name = String(url).replace(lib.base, '');
      requests.push(name);
      if (options.onFetch) await options.onFetch(name);
      return files.has(name) ? new Response(files.get(name)) : new Response('', { status: 404 });
    },
  });
  // Expose existing action closures without adding test-only production APIs.
  const source = fs
    .readFileSync(path.join(ROOT, 'src/library/reader.js'), 'utf8')
    .replace(
      '_internals: {',
      '_internals: { readingContext, fillSources, handoff, downloadProvenance, setState: (s) => S = s,'
    );
  const reader = vm.runInContext(`(function () { ${source}\n})()`, ctx)._internals;
  async function open() {
    const R = await reader.openReading(lib, ID, oldKey);
    const main = { innerHTML: 'A café at dusk' },
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
    return { R, state, main, alerts };
  }
  return { reader, lib, files, requests, downloads, handoffs, oldKey, currentKey, catalog, open };
}

for (const projectionOnly of [false, true])
  test(`verified ${projectionOnly ? 'retained projection of current revision' : 'current reading'} exports valid whole and excerpt origins`, async () => {
    const f = fixture({ projectionOnly }),
      { R } = await f.open();
    const provenance = await f.reader.provenance(f.lib, R);
    assert.equal(provenance.snapshot_id, SNAP);
    assert.equal(provenance.reading_revision, REV);
    for (const ids of [null, new Set([R.pages.get(0).lines[0].id])]) {
      const envelope = await f.reader.buildEnvelope(f.lib, R, ids, {});
      assert.equal(envelope.payload.provenance.snapshotId, SNAP);
      assert.equal(envelope.payload.provenance.revisionId, REV);
      await Import.validateEnvelope(envelope, webcrypto);
    }
  });

for (const options of [
  { currentRevision: NEXT },
  { currentRevision: REV.slice(0, 16) + 'b'.repeat(48) },
  { shardDataId: 'e'.repeat(64) },
  { missingUnit: true },
])
  test(`unverified retained origin refuses exports without closing content: ${JSON.stringify(options)}`, async () => {
    const f = fixture(options),
      { R, main, state, alerts } = await f.open();
    assert.equal((await f.reader.wholeText(f.lib, R)).text, main.innerHTML);
    await f.reader.rightsOf(f.lib, R);
    const ordinary = (error) =>
      error.constructor.name === 'Error' && /snapshot.*verif/i.test(error.message);
    await assert.rejects(f.reader.provenance(f.lib, R), ordinary);
    await assert.rejects(f.reader.buildEnvelope(f.lib, R, null, {}), ordinary);
    await assert.rejects(f.reader.buildEnvelope(f.lib, R, state.sel, null), ordinary);
    await f.reader.downloadProvenance();
    await f.reader.handoff(false);
    await f.reader.handoff(true);
    assert.equal(main.innerHTML, 'A café at dusk');
    assert.equal(state.busy, false);
    assert.match(alerts.innerHTML, /snapshot.*verif/i);
    assert.equal(f.downloads.length, 0);
    assert.equal(f.handoffs.length, 0);
    assert.equal(await f.reader.readingContext().snapshotId(), '');
    const identity = { innerHTML: 'snapshot …' };
    await f.reader.fillSources({
      isConnected: true,
      querySelector: (q) => (q === '[data-rd-ident]' ? identity : null),
    });
    assert.match(identity.innerHTML, /snapshot unverified/);
    assert.ok(!identity.innerHTML.includes(SNAP.slice(0, 12)));
  });

test('catalog unavailable or missing identity never emits an empty/sentinel snapshot; retry can recover', async () => {
  const f = fixture(),
    { R } = await f.open();
  f.lib.catalog = async () => {
    throw Error('offline');
  };
  await assert.rejects(f.reader.provenance(f.lib, R), /snapshot.*verif/i);
  f.lib.catalog = async () => ({ data_id: DATA, projected_from: {} });
  await assert.rejects(f.reader.buildEnvelope(f.lib, R, null, {}), /snapshot.*verif/i);
  f.lib.catalog = async () => ({ data_id: DATA, projected_from: { snapshot_id: 'unknown' } });
  await assert.rejects(f.reader.buildEnvelope(f.lib, R, null, {}), /snapshot.*verif/i);
  f.lib.catalog = async () => ({ projected_from: { snapshot_id: SNAP } });
  await assert.rejects(f.reader.provenance(f.lib, R), /snapshot.*verif/i);
  f.lib.catalog = async () => f.catalog;
  assert.equal((await f.reader.provenance(f.lib, R)).snapshot_id, SNAP);
});

test('unavailable or corrupt current head cannot invalidate an intact saved reading', async () => {
  for (const corrupt of [false, true]) {
    const f = fixture({ currentRevision: NEXT }),
      { R, main } = await f.open();
    const name = `r/12/${ID}/${f.currentKey}/head.json.gz`;
    if (corrupt) f.files.set(name, '{}');
    else f.files.delete(name);
    await assert.rejects(f.reader.provenance(f.lib, R), /snapshot.*verif/i);
    assert.equal((await f.reader.wholeText(f.lib, R)).text, main.innerHTML);
  }
});

test('deferred snapshot resolution remains bound to the captured reading context and export', async () => {
  const gate = deferred();
  const f = fixture(),
    { R } = await f.open();
  f.lib.catalog = () => gate.promise;
  const context = f.reader.readingContext();
  const snapshot = context.snapshotId();
  const exportPromise = f.reader.buildEnvelope(f.lib, R, null, {});
  f.reader.setState({
    R: { id: 'other', revision: NEXT },
    lib: { catalog: async () => ({ projected_from: { snapshot_id: NEXT } }) },
  });
  gate.resolve(f.catalog);
  assert.equal(await snapshot, SNAP);
  const envelope = await exportPromise;
  assert.equal(envelope.payload.provenance.unitId, ID);
  assert.equal(envelope.payload.provenance.revisionId, REV);
  assert.equal(envelope.payload.provenance.snapshotId, SNAP);
});

test('shard failure is retryable without losing the reading', async () => {
  let offline = true;
  const f = fixture({
    onFetch: async (name) => {
      if (name.startsWith('u/') && offline) throw Error('offline');
    },
  });
  const { R } = await f.open();
  await assert.rejects(f.reader.provenance(f.lib, R), /snapshot.*verif/i);
  offline = false;
  assert.equal((await f.reader.provenance(f.lib, R)).snapshot_id, SNAP);
});

for (const replaced of [false, true]) {
  for (const integrity of [false, true]) {
    test(`provenance ${integrity ? 'integrity' : 'network'} failure belongs to ${replaced ? 'replaced' : 'current'} reader`, async () => {
      const gate = deferred(), entered = deferred();
      const f = fixture({ extraPage: true, async onFetch(name) {
        if (!/\/1-/.test(name)) return;
        entered.resolve(); await gate.promise;
        if (!integrity) throw Error('Download network failed');
      } });
      const first = await f.open();
      const page = [...f.files.keys()].find(name => /\/1-/.test(name));
      if (integrity) f.files.set(page, JSON.stringify({ changed: true }));
      const pending = f.reader.downloadProvenance();
      await entered.promise;
      let second;
      if (replaced) {
        second = await f.open();
        second.R.id = 'replacement-B'; second.R.revision = NEXT;
        second.main.innerHTML = 'Replacement reader B';
      }
      gate.resolve(); await pending;
      assert.equal(f.downloads.length, 0);
      if (replaced) {
        assert.equal(second.main.innerHTML, 'Replacement reader B');
        assert.equal(second.alerts.innerHTML, '');
      } else if (integrity) {
        assert.match(first.main.innerHTML, /This reading failed its check/);
        assert.match(first.main.innerHTML, /integrity check/);
      } else {
        assert.equal(first.main.innerHTML, 'A café at dusk');
        assert.match(first.alerts.innerHTML, /Download network failed/);
      }
    });
  }
}

test('successful delayed provenance downloads its originating identity after reader replacement', async () => {
  const gate = deferred(), entered = deferred();
  const f = fixture({ extraPage: true, async onFetch(name) {
    if (/\/1-/.test(name)) { entered.resolve(); await gate.promise; }
  } });
  await f.open();
  const pending = f.reader.downloadProvenance(); await entered.promise;
  const second = await f.open();
  second.R.id = 'replacement-B'; second.R.revision = NEXT;
  second.main.innerHTML = 'Replacement reader B';
  gate.resolve(); await pending;
  assert.equal(f.downloads.length, 1);
  const artifact = JSON.parse(f.downloads[0][1]);
  assert.equal(artifact.reading_unit_id, ID);
  assert.equal(artifact.reading_revision, REV);
  assert.equal(artifact.snapshot_id, SNAP);
  assert.equal(second.main.innerHTML, 'Replacement reader B');
  assert.equal(second.alerts.innerHTML, '');
});
