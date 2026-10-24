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
