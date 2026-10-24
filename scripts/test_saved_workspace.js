'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const section = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(storage) {
  let id = 0;
  const notices = [];
  const context = vm.createContext({
    app: { cards: [{ id: 'one', instrumentId: 'voice' }], lyrics: 'Old text', workspaceName: 'Old', lyricMeta: {
      version: 1, brief: 'Old brief', draftId: 'old-draft', notes: { line: 'Old note' },
      drafts: { previous: 'Old draft' }, ui: { selected: 'old' },
      libraryOrigin: { version: 1, source: 'old-source' },
    } },
    window: { storage }, navigator: {}, _CARD_TRANSIENTS: {}, WS_SCHEMA: 2,
    newId: () => String(++id), showToast: (...args) => notices.push(args),
    console: { error() {} }, loadWS() {},
  });
  vm.runInContext(section('const LYRIC_META_LIMITS=', 'function sessionKey(')
    + section('async function readListStrict()', '// Saved-workspace schema')
    + section('let _savedWriteQueue=', 'async function restoreSavedWorkspace('), context);
  return { context, notices, save: name => vm.runInContext(`saveWS(${JSON.stringify(name)})`, context) };
}

test('save captures complete metadata with text before waiting for storage', async () => {
  const read = deferred(), writes = new Map();
  const f = fixture({ backend: 'indexedDB', get: () => read.promise, async set(k, v) { writes.set(k, v); } });
  const saving = f.save('Copy');
  await settle();
  f.context.app.lyrics = 'New text';
  f.context.app.cards = [];
  f.context.app.lyricMeta.brief = 'New brief';
  f.context.app.lyricMeta.notes.line = 'New note';
  f.context.app.lyricMeta.drafts.previous = 'New draft';
  f.context.app.lyricMeta.ui.selected = 'new';
  f.context.app.lyricMeta.libraryOrigin.source = 'new-source';
  read.resolve(null);
  await saving;
  const saved = JSON.parse([...writes].find(([k]) => k.startsWith('codex:ws:'))[1]);
  assert.equal(saved.lyrics, 'Old text');
  assert.equal(saved.cards.length, 1);
  assert.deepEqual(saved.lyricMeta, { version: 1, brief: 'Old brief', draftId: 'old-draft', notes: { line: 'Old note' },
    drafts: { previous: 'Old draft' }, ui: { selected: 'old' }, libraryOrigin: { version: 1, source: 'old-source' } });
});

test('queued saves retain their own invocation snapshots and preserve both entries', async () => {
  const firstRead = deferred(), writes = new Map(); let reads = 0;
  const f = fixture({ backend: 'indexedDB', get: () => ++reads === 1 ? firstRead.promise : Promise.resolve({ value: writes.get('codex:list') }),
    async set(k, v) { writes.set(k, v); } });
  const first = f.save('First');
  f.context.app.lyrics = 'Second text'; f.context.app.lyricMeta.brief = 'Second brief';
  const second = f.save('Second');
  f.context.app.lyricMeta.brief = 'Later brief';
  firstRead.resolve(null);
  await Promise.all([first, second]);
  const saved = [...writes].filter(([k]) => k.startsWith('codex:ws:')).map(([, v]) => JSON.parse(v));
  assert.deepEqual(saved.map(x => [x.lyrics, x.lyricMeta.brief]), [['Old text', 'Old brief'], ['Second text', 'Second brief']]);
  assert.equal(JSON.parse(writes.get('codex:list')).length, 2);
});

test('failed index read writes nothing and leaves the open session intact', async () => {
  let writes = 0;
  const f = fixture({ backend: 'indexedDB', async get() { throw Error('offline'); }, async set() { writes++; } });
  const before = JSON.stringify(f.context.app);
  await f.save('Failure');
  assert.equal(writes, 0);
  assert.equal(JSON.stringify(f.context.app), before);
  assert.equal(f.notices.at(-1)[1], 'error');
});

function openFixture() {
  const requests = new Map(), notices = [], history = [];
  const f = fixture({ get(key) { const request = deferred(); requests.set(key, request); return request.promise; } });
  const c = f.context;
  Object.assign(c, { _engineLive: true, document: { getElementById: () => null },
    musicalWorkspaceKey: cards => JSON.stringify(cards),
    normalizeWorkspaceCards(cards, fork) {
      if (!Array.isArray(cards)) throw Error('Invalid cards');
      return cards.map(card => ({ ...card, id: fork ? card.id + '-fork' : card.id }));
    },
    closeModal() {}, renderAll() {}, showToast: (...args) => notices.push(args),
    pushHistory: () => history.push(JSON.stringify(c.app.cards)),
    $ui: () => ({}), uiSaveLyrics() {},
  });
  vm.runInContext(section('function sessionKey(', 'function pushHistory(')
    + section('function sessionOpenKey(', 'async function delWS('), c);
  const workbench = fs.readFileSync(path.join(__dirname, '../src/workbench.js'), 'utf8');
  vm.runInContext(workbench.slice(workbench.indexOf('async function uiImport('), workbench.indexOf('function uiSaveLyrics(')), c);
  const stored = name => ({ value: JSON.stringify({ schema: 2, name, cards: [{ id: name, instrumentId: 'voice' }], lyrics: name }) });
  return { c, requests, notices, history, stored,
    load: key => vm.runInContext(`loadWS(${JSON.stringify(key)})`, c),
    fork: key => vm.runInContext(`forkWS(${JSON.stringify(key)})`, c),
    importFile: file => c.uiImport(file),
  };
}

test('latest saved load wins over an older load or fork', async () => {
  for (const older of ['load', 'fork']) {
    const f = openFixture(), a = f[older]('A'), b = f.load('B');
    f.requests.get('B').resolve(f.stored('B')); await b;
    f.requests.get('A').resolve(f.stored('A')); await a;
    assert.equal(f.c.app.workspaceName, 'B');
    assert.equal(f.history.length, 1);
  }
});

test('file import and saved load share replacement ownership in either order', async () => {
  for (const importFirst of [true, false]) {
    const f = openFixture(), file = deferred();
    let importing, loading;
    if (importFirst) { importing = f.importFile({ text: () => file.promise }); loading = f.load('B'); }
    else { loading = f.load('B'); importing = f.importFile({ text: () => file.promise }); }
    if (importFirst) {
      f.requests.get('B').resolve(f.stored('B')); await loading;
      file.resolve(f.stored('File').value); await importing;
      assert.equal(f.c.app.workspaceName, 'B');
    } else {
      file.resolve(f.stored('File').value); await importing;
      f.requests.get('B').resolve(f.stored('B')); await loading;
      assert.equal(f.c.app.workspaceName, 'File');
    }
    assert.equal(f.history.length, 1);
  }
});

test('pending replacements preserve subsequent edits and a cleared workspace', async () => {
  for (const clear of [false, true]) {
    const f = openFixture(), loading = f.load('A');
    f.c.app.cards = clear ? [] : [{ id: 'edited', instrumentId: 'voice' }];
    const changed = JSON.stringify(f.c.app.cards);
    f.requests.get('A').resolve(f.stored('A')); await loading;
    assert.equal(JSON.stringify(f.c.app.cards), changed);
    assert.equal(f.history.length, 0);
  }
});

test('a failed newer load never resurrects the older request', async () => {
  const f = openFixture(), before = JSON.stringify(f.c.app.cards);
  const a = f.load('A'), b = f.load('B');
  f.requests.get('B').reject(Error('offline')); await b;
  f.requests.get('A').resolve(f.stored('A')); await a;
  assert.equal(JSON.stringify(f.c.app.cards), before);
  assert.equal(f.history.length, 0);
  assert.equal(f.notices.length, 1);
  assert.equal(f.notices[0][0], 'offline');
});

test('obsolete load and import errors do not disturb the newer session', async () => {
  for (const kind of ['load', 'import']) {
    const f = openFixture(), file = deferred();
    const a = kind === 'load' ? f.load('A') : f.importFile({ text: () => file.promise });
    const b = f.load('B'); f.requests.get('B').resolve(f.stored('B')); await b;
    (kind === 'load' ? f.requests.get('A') : file).reject(Error('obsolete'));
    await a;
    assert.equal(f.c.app.workspaceName, 'B');
    assert.equal(f.notices.length, 1);
    assert.equal(f.notices[0][1], 'success');
  }
});

test('ownership is reserved before engine readiness and stale work never reads storage', async () => {
  const f = openFixture(), gates = [];
  f.c._engineLive = false;
  f.c.engineReady = () => { const gate = deferred(); gates.push(gate); return gate.promise; };
  const a = f.load('A'), b = f.load('B');
  gates[0].resolve(true); await a;
  assert.equal(f.requests.has('A'), false);
  gates[1].resolve(true); await settle();
  f.requests.get('B').resolve(f.stored('B')); await b;
  assert.equal(f.c.app.workspaceName, 'B');
});

test('successful fork copies once with fresh IDs; failed input leaves state intact', async () => {
  const f = openFixture(), copying = f.fork('Copy');
  f.requests.get('Copy').resolve(f.stored('Copy')); await copying;
  assert.equal(f.c.app.cards[0].id, 'Copy-fork');
  assert.equal(f.history.length, 1);
  const before = JSON.stringify(f.c.app.cards);
  for (const payload of [null, { value: 'not JSON' }, { value: JSON.stringify({ schema: 999, cards: [] }) }]) {
    const pending = f.load('Invalid'); f.requests.get('Invalid').resolve(payload); await pending;
    assert.equal(JSON.stringify(f.c.app.cards), before);
  }
  await f.importFile({ text: async () => 'not JSON' });
  assert.equal(JSON.stringify(f.c.app.cards), before);
  assert.equal(f.history.length, 1);
});

test('opening preserves newer tool drafts and migration records but tolerates presentation changes', async () => {
  for (const field of ['drafts', 'renumbered', 'ui']) {
    const f = openFixture(), pending = f.load('A');
    f.c.app.lyricMeta[field] = field === 'renumbered' ? { items: [{ from: 1, to: 2 }] } : { changed: 'new' };
    f.requests.get('A').resolve(f.stored('A')); await pending;
    assert.equal(f.c.app.workspaceName, field === 'ui' ? 'A' : 'Old');
    assert.equal(f.history.length, field === 'ui' ? 1 : 0);
    if (field !== 'ui') assert.ok(f.c.app.lyricMeta[field]);
  }
});
