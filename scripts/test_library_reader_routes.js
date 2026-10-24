'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, webcrypto } = require('node:crypto');
const { JSDOM } = require('jsdom');
const canonical = require('../src/library-import.js').canonical;
const ID = 'reading_12345678-1234-5678-9012-123456789012';
const OLD = 'a'.repeat(64),
  CURRENT = 'b'.repeat(64);
const sha = (x) =>
  createHash('sha256')
    .update(typeof x === 'string' ? x : canonical(x))
    .digest('hex');
function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function fixture(t) {
  const utterances = [];
  const dom = new JSDOM('<div id="surface-library"><main></main></div>', {
    url: 'https://example.test/#library',
    runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const w = dom.window,
    files = new Map(),
    routes = [],
    requests = [],
    frames = [],
    scrolls = [],
    gates = new Map(),
    statuses = new Map(),
    fetchOptions = [];
  const rights = { sources: [], file_sources: [], notices: [] },
    metadata = {};
  files.set(`rights/r-${sha(rights).slice(0, 2)}.json.gz`, { rights: { [sha(rights)]: rights } });
  files.set(
    `meta/${(parseInt(sha(metadata).slice(0, 2), 16) >> 2).toString(16).padStart(2, '0')}.json.gz`,
    { metadata: { [sha(metadata)]: metadata } }
  );
  function add(revision, title) {
    const text = title + ' text';
    const tail = title + ' continuation';
    const page = {
      reading_unit_id: ID,
      reading_revision: revision,
      page_index: 1,
      page_count: 2,
      start: {
        row_start: 250,
        analysis_line_start: 1,
        normalized_cp_start: text.length,
        normalized_utf16_start: text.length,
      },
      lines: [['lyric', tail, 0, 251, 2, [0, tail.length], null, []]],
    };
    const pageHash = sha(page);
    const head = {
      reading_unit_id: ID,
      reading_revision: revision,
      page_index: 0,
      page_count: 2,
      pages: [pageHash],
      start: {
        row_start: 0,
        analysis_line_start: 0,
        normalized_cp_start: 0,
        normalized_utf16_start: 0,
      },
      lines: [['lyric', text, 0, 1, 1, [0, text.length], null, []]],
      title,
      language: 'eng',
      contributors: [],
      normalized_sha256: sha(text + '\n' + tail),
      canonical_reading_sha256: sha(revision),
      source_map: {},
      source_marks: {},
      source_labels: [],
      rights_ref: sha(rights),
      metadata_ref: sha(metadata),
      completeness: 'complete',
      census: {},
      work_reviewed_equivalence: false,
    };
    const key = revision.slice(0, 16) + '-' + sha(head).slice(0, 12);
    files.set(`r/12/${ID}/${key}/head.json.gz`, head);
    files.set(`r/12/${ID}/${key}/1-${pageHash.slice(0, 12)}.json.gz`, page);
    return key;
  }
  const oldKey = add(OLD, 'Retained'),
    currentKey = add(CURRENT, 'Current'),
    projectionKey = add(CURRENT, 'Another projection');
  const catalog = { data_id: 'd'.repeat(64), projected_from: { snapshot_id: 'c'.repeat(64) } };
  files.set('u/12.json.gz', {
    data_id: catalog.data_id,
    units: [[ID, currentKey, 'collection:test']],
  });
  const analysis = { setLens() {}, setLines() {}, setSelection() {}, destroy() {} };
  Object.assign(w, {
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Response,
    Blob,
    DecompressionStream,
    esc: (s) =>
      String(s ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('"', '&quot;'),
    icon: () => '',
    uiEmptyState: ({ title, text = '', actions = '' }) => `<p>${title}: ${text}</p>${actions}`,
    libraryChunk: async () => ({ mount: () => analysis }),
    requestAnimationFrame: (fn) => {
      frames.push(fn);
    },
    fetch: async (url, options) => {
      const name = String(url).replace('https://example.test/data/', '');
      requests.push(name);
      fetchOptions.push({ name, cache: options?.cache });
      if (statuses.has(name)) return new Response('', { status: statuses.get(name) });
      if (gates.has(name)) await gates.get(name).promise;
      return files.has(name)
        ? new Response(canonical(files.get(name)))
        : new Response('', { status: 404 });
    },
  });
  Object.defineProperty(w, 'crypto', { value: webcrypto });
  w.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  w.speechSynthesis = {
    getVoices: () => [{ voiceURI: 'english', lang: 'en' }],
    speak: (u) => utterances.push(u),
    cancel() {},
    addEventListener() {},
  };
  w.HTMLElement.prototype.scrollIntoView = function () {
    scrolls.push(this.id);
  };
  let source = fs
    .readFileSync(path.join(__dirname, '../src/library/reader.js'), 'utf8')
    .replace(
      '_internals: {',
      '_internals: { state: () => S, parse, route, rowRequests, speak, resolveKey,'
    );
  source = source.replace(
    'return {\n  show,',
    'const rowRequests = []; const originalGoToRow = goToRow; goToRow = (row) => { const task = originalGoToRow(row); rowRequests.push(task); return task; };\nreturn {\n  show,'
  );
  const reader = w.eval(`(function () { ${source}\n})()`);
  const main = w.document.querySelector('main');
  const lib = {
    base: 'https://example.test/data/',
    go: (route) => routes.push(route),
    catalog: async () => catalog,
  };
  const open = (query = '') => reader.show(main, `/read/${ID}${query ? '?' + query : ''}`, lib);
  const drain = () => {
    const pending = frames.splice(0);
    pending.forEach((f) => f());
  };
  return {
    w,
    main,
    reader,
    lib,
    files,
    oldKey,
    utterances,
    currentKey,
    projectionKey,
    routes,
    requests,
    statuses,
    fetchOptions,
    frames,
    gates,
    scrolls,
    open,
    drain,
    state: () => reader._internals.state(),
    headPath: (key) => `r/12/${ID}/${key}/head.json.gz`,
  };
}

test('documented revision path opens retained content and emitted routes keep its verified key', async (t) => {
  const f = fixture(t);
  await f.open(`revision=${f.oldKey}&lens=sources&line=chosen&span=1:4&precision=exact`);
  assert.equal(f.state().R.revision, OLD);
  assert.equal(new URLSearchParams(f.routes.at(-1).split('?')[1]).get('revision'), f.oldKey);
  f.main.querySelector('[data-id="summary"]').click();
  const q = new URLSearchParams(f.routes.at(-1).split('?')[1]);
  assert.equal(q.get('revision'), f.oldKey);
  assert.equal(q.get('line'), 'chosen');
  assert.equal(q.get('span'), '1:4');
  const source = f.main.querySelector('[data-rd="source"]');
  source.checked = true;
  source.dispatchEvent(new f.w.Event('change', { bubbles: true }));
  assert.equal(new URLSearchParams(f.routes.at(-1).split('?')[1]).get('revision'), f.oldKey);
  const other = fixture(t);
  await other.reader.show(other.main, f.routes.at(-1), other.lib);
  assert.equal(other.state().R.revision, OLD);
  assert.equal(other.state().source, true);
  await assert.rejects(f.reader._internals.provenance(f.lib, f.state().R), /snapshot.*verif/i);
});

test('key and id path aliases remain accepted but normalize to revision', async (t) => {
  for (const alias of ['key', '@', ':']) {
    const f = fixture(t);
    const route =
      alias === 'key' ? `/read/${ID}?key=${f.oldKey}` : `/read/${ID}${alias}${f.oldKey}`;
    await f.reader.show(f.main, route, f.lib);
    assert.equal(f.state().R.revision, OLD);
    assert.match(f.routes.at(-1), new RegExp(`^/read/${ID}\\?revision=${f.oldKey}`));
    assert.ok(!f.routes.at(-1).includes('key='));
  }
});

test('same-id navigation honors different generations and bare links resolve current', async (t) => {
  const f = fixture(t);
  await f.open('snapshot=historic');
  assert.equal(new URLSearchParams(f.routes.at(-1).split('?')[1]).has('snapshot'), false);
  assert.equal(f.state().R.revision, CURRENT);
  assert.equal(new URLSearchParams(f.routes.at(-1).split('?')[1]).get('revision'), f.currentKey);
  await f.open(`revision=${f.oldKey}`);
  assert.equal(f.state().R.revision, OLD);
  const root = f.state().root;
  await f.open(`revision=${f.oldKey}&lens=sources&view=source`);
  assert.equal(f.state().root, root);
  assert.equal(f.state().source, true);
  await f.open(`revision=${f.oldKey}&view=normalized`);
  assert.equal(f.state().source, false);
  await f.open();
  assert.equal(f.state().R.revision, CURRENT);
});

test('full revisions compare all64characters; unavailable versions offer coordinate-free explicit current navigation', async (t) => {
  const f = fixture(t);
  await f.open(`revision=${CURRENT}&span=1:4&offset=0`);
  assert.equal(f.state().R.revision, CURRENT);
  assert.ok(f.state().record);
  for (const revision of [OLD, CURRENT.slice(0, 16) + 'f'.repeat(48)]) {
    await f.open(
      `revision=${revision}&line=stale&offset=250&span=1:4&precision=exact&lens=sources&view=source&autoplay=1`
    );
    assert.equal(f.main.querySelector('.rd'), null);
    assert.match(f.main.textContent, /version.*unavailable|version.*changed/i);
    const button = f.main.querySelector('[data-rd-current]');
    assert.ok(button);
    button.click();
    const route = f.routes.at(-1),
      q = new URLSearchParams(route.split('?')[1]);
    for (const k of ['revision', 'key', 'line', 'offset', 'span', 'precision', 'autoplay'])
      assert.equal(q.has(k), false, k);
    await f.reader.show(f.main, route, f.lib);
    assert.equal(f.state().R.revision, CURRENT);
    assert.equal(f.state().record, null);
  }
});

test('mounted retained full revision remains on its verified path; malformed and conflicting selectors fail safely', async (t) => {
  const f = fixture(t);
  await f.open(`key=${f.oldKey}`);
  await f.open(`revision=${OLD}&lens=sources`);
  assert.equal(f.state().R.pathKey, f.oldKey);
  for (const query of [
    'revision=oops',
    'revision=',
    `revision=${f.oldKey}&key=${f.currentKey}`,
    `revision=${f.oldKey}&revision=${f.currentKey}`,
  ]) {
    await f.open(query);
    assert.equal(f.main.querySelector('.rd'), null, query);
    assert.match(f.main.textContent, /version|selector/i);
  }
});

test('late loads and animation callbacks cannot move or replace a newer route', async (t) => {
  const f = fixture(t),
    gate = deferred();
  f.gates.set(f.headPath(f.oldKey), gate);
  const pending = f.open(`revision=${f.oldKey}&line=stale`);
  await f.open(`revision=${f.currentKey}`);
  gate.resolve();
  await pending;
  assert.equal(f.state().R.revision, CURRENT);
  assert.ok(!f.routes.some((r) => r.includes(f.oldKey)));
  await f.open(`revision=${f.oldKey}`);
  f.drain();
  const line = f.main.querySelector('.rd-line').id;
  await f.open(`revision=${f.currentKey}&line=${line}`);
  await f.open(`revision=${f.oldKey}`);
  f.scrolls.length = 0;
  f.drain();
  assert.deepEqual(f.scrolls, []);
});

test('saved line and numeric position are restored only for the same full revision', async (t) => {
  const f = fixture(t);
  await f.open(`revision=${f.oldKey}`);
  f.drain();
  const line = f.main.querySelector('.rd-line').id;
  f.w.localStorage.setItem(
    'cm-library-position:' + ID,
    JSON.stringify({ revision: OLD, offset: 0, line_id: line })
  );
  f.scrolls.length = 0;
  await f.open(`revision=${f.currentKey}`);
  f.drain();
  assert.deepEqual(f.scrolls, []);
  await f.open(`revision=${f.oldKey}`);
  f.drain();
  assert.ok(f.scrolls.includes(line));
});

test('an old offset page load cannot change a new revision or supersede a newer offset', async (t) => {
  for (const changeRevision of [false, true]) {
    const f = fixture(t);
    await f.open(`revision=${f.currentKey}`);
    const head = f.files.get(f.headPath(f.currentKey));
    const pagePath = `r/12/${ID}/${f.currentKey}/1-${head.pages[0].slice(0, 12)}.json.gz`;
    const gate = deferred();
    f.gates.set(pagePath, gate);
    await f.open(`revision=${f.currentKey}&offset=250`);
    const pending = f.reader._internals.rowRequests.at(-1);
    await f.open(`revision=${changeRevision ? f.oldKey : f.currentKey}&offset=0`);
    gate.resolve();
    await pending;
    assert.equal(f.state().R.revision, changeRevision ? OLD : CURRENT);
    assert.deepEqual([...f.state().window], [0, 0]);
    assert.ok(f.main.querySelector('.rd'));
  }
});

test('same-reading offset navigation does not cancel speech ownership', async (t) => {
  const f = fixture(t);
  await f.open(`revision=${f.currentKey}`);
  await f.reader._internals.wholeText(f.lib, f.state().R);
  f.reader._internals.speak(false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.utterances.length, 1);
  await f.open(`revision=${f.currentKey}&offset=1`);
  f.utterances[0].onend();
  assert.equal(f.utterances.length, 2);
  f.utterances[1].onend();
  assert.equal(f.state().speaking, false);
});

for (const stopSpeech of [false, true])
  test(`speech ${stopSpeech ? 'start/stop' : 'start'} does not supersede a pending offset`, async (t) => {
    const f = fixture(t);
    await f.open(`revision=${f.currentKey}`);
    const head = f.files.get(f.headPath(f.currentKey));
    const pagePath = `r/12/${ID}/${f.currentKey}/1-${head.pages[0].slice(0, 12)}.json.gz`;
    const gate = deferred();
    f.gates.set(pagePath, gate);
    await f.open(`revision=${f.currentKey}&offset=250`);
    const pending = f.reader._internals.rowRequests.at(-1);
    f.reader._internals.speak(false);
    if (stopSpeech) f.reader._internals.speak(false);
    gate.resolve();
    await pending;
    assert.deepEqual([...f.state().window], [1, 1]);
    assert.equal(f.state().speaking, !stopSpeech);
  });

async function waitFor(condition) {
  for (let i = 0; i < 50; i++) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(condition(), 'expected async reader action to finish');
}
const MISSING_KEY = '0'.repeat(16) + '-' + '0'.repeat(12);

test('missing retained head offers explicit current recovery using a refreshed shard, not cached paths', async (t) => {
  const f = fixture(t),
    shardPath = 'u/12.json.gz';
  const shard = f.files.get(shardPath);
  f.files.set(shardPath, { ...shard, units: [[ID, MISSING_KEY, 'collection:test']] });
  assert.equal(await f.reader._internals.resolveKey(f.lib, ID, ''), MISSING_KEY);
  f.files.set(shardPath, shard);
  let cachedPathCalls = 0;
  f.lib.unitPath = async () => {
    cachedPathCalls++;
    return MISSING_KEY;
  };
  await f.open(
    `revision=${MISSING_KEY}&line=stale&offset=250&span=1:4&precision=exact&lens=sources&view=source&autoplay=1`
  );
  assert.equal(f.main.querySelector('.rd'), null);
  const button = f.main.querySelector('[data-rd-current]');
  assert.ok(button);
  button.click();
  await waitFor(() => f.routes.length > 0);
  const route = f.routes.at(-1),
    q = new URLSearchParams(route.split('?')[1]);
  assert.equal(q.get('revision'), f.currentKey);
  for (const k of ['line', 'offset', 'span', 'precision', 'autoplay'])
    assert.equal(q.has(k), false, k);
  assert.ok(f.fetchOptions.some((r) => r.name === shardPath && r.cache === 'reload'));
  assert.equal(cachedPathCalls, 0);
  await f.reader.show(f.main, route, f.lib);
  assert.equal(f.state().R.revision, CURRENT);
  assert.equal(f.state().record, null);
  assert.equal(
    (await f.reader._internals.provenance(f.lib, f.state().R)).snapshot_id,
    'c'.repeat(64)
  );
});

for (const failure of ['lookup', 'unreadable'])
  test(`failed current recovery stays closed and retryable: ${failure}`, async (t) => {
    const f = fixture(t),
      shardPath = 'u/12.json.gz',
      shard = f.files.get(shardPath);
    await f.open(`revision=${MISSING_KEY}&offset=250&span=1:4`);
    const button = f.main.querySelector('[data-rd-current]');
    assert.ok(button);
    if (failure === 'lookup') f.statuses.set(shardPath, 503);
    else f.files.set(shardPath, { ...shard, units: [] });
    button.click();
    await waitFor(
      () => !button.disabled && f.main.querySelector('[data-rd-recovery-error]')?.textContent
    );
    assert.equal(f.routes.length, 0);
    assert.equal(f.main.querySelector('.rd'), null);
    assert.ok(f.main.querySelector('[data-rd-retry]'));
    f.statuses.delete(shardPath);
    f.files.set(shardPath, shard);
    button.click();
    await waitFor(() => f.routes.length > 0);
    assert.equal(new URLSearchParams(f.routes.at(-1).split('?')[1]).get('revision'), f.currentKey);
  });

for (const failure of ['500', 'integrity', 'page404'])
  test(`current recovery is not offered for ${failure} failure`, async (t) => {
    const f = fixture(t);
    if (failure === '500') f.statuses.set(f.headPath(f.currentKey), 500);
    if (failure === 'integrity') f.files.set(f.headPath(f.currentKey), {});
    if (failure === 'page404') {
      const h = f.files.get(f.headPath(f.currentKey));
      f.files.delete(`r/12/${ID}/${f.currentKey}/1-${h.pages[0].slice(0, 12)}.json.gz`);
    }
    await f.open(`revision=${f.currentKey}&offset=${failure === 'page404' ? 250 : 0}`);
    assert.equal(f.main.querySelector('[data-rd-current]'), null);
    assert.ok(f.main.querySelector('[data-rd-retry]'));
    assert.ok(!f.fetchOptions.some((r) => r.cache === 'reload'));
  });

test('late recovery cannot navigate away from a newer reading', async (t) => {
  const f = fixture(t),
    gate = deferred();
  await f.open(`revision=${MISSING_KEY}`);
  f.gates.set('u/12.json.gz', gate);
  const button = f.main.querySelector('[data-rd-current]');
  assert.ok(button);
  button.click();
  await f.open(`revision=${f.currentKey}`);
  const count = f.routes.length;
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.routes.length, count);
  assert.equal(f.state().R.revision, CURRENT);
});
