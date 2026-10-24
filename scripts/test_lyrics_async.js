'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function page() {
  const requests = [],
    notices = [],
    renders = [];
  const elements = { 'surface-lyrics': { inert: false }, 'lyrics-draft': { readOnly: false } };
  const ctx = vm.createContext({
    uiRegisterPage() {},
    CHAT_BACKEND: 'https://example.invalid',
    fetch: () => {
      const d = deferred();
      requests.push(d);
      return d.promise;
    },
    showToast: (...args) => notices.push(args),
    UI: { lyricRevision: 0 },
    $ui: (id) => elements[id],
  });
  vm.runInContext(fs.readFileSync('src/lyric-tokens.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('src/pages/lyrics.js', 'utf8'), ctx);
  ctx.renders = renders;
  vm.runInContext(
    `lyRefresh=()=>{};lyRenderHistory=()=>renders.push('history');
    globalThis.state=LY;globalThis.restore=LY_ACTIONS['ly-library-restore'];
    globalThis.acquire=lyLibraryAcquire;globalThis.release=lyLibraryRelease;`,
    ctx
  );
  return { ctx, requests, notices, elements, renders };
}
const idA = 'a'.repeat(64),
  idB = 'b'.repeat(64);
const response = (text) => ({
  ok: true,
  json: async () => ({ state: 'complete', response: { body: { reply: text } } }),
});

for (const staleFailure of [false, true])
  test(`latest retrieval owns result despite older ${staleFailure ? 'failure' : 'success'}`, async () => {
    const f = page();
    const a = f.ctx.lyRetrieve(idA),
      b = f.ctx.lyRetrieve(idB);
    f.requests[1].resolve(response('B'));
    await b;
    if (staleFailure) f.requests[0].reject(new Error('A failed'));
    else f.requests[0].resolve(response('A'));
    await a;
    assert.equal(f.ctx.state.retrieved.id, idB);
    assert.equal(f.ctx.state.retrieved.text, 'B');
  });
test('retrieval completion preserves later Tools navigation', async () => {
  const f = page();
  const pending = f.ctx.lyRetrieve(idA);
  f.ctx.lyShowTab('tools');
  f.requests[0].resolve(response('A'));
  await pending;
  assert.equal(f.ctx.state.tab, 'tools');
  assert.equal(f.ctx.state.retrieved.text, 'A');
  assert.equal(f.renders.length, 0);
});
test('request ownership is checked after the response body resolves', async () => {
  const f = page(),
    body = deferred();
  const a = f.ctx.lyRetrieve(idA);
  f.requests[0].resolve({ ok: true, json: () => body.promise });
  await Promise.resolve();
  const b = f.ctx.lyRetrieve(idB);
  f.requests[1].resolve(response('B'));
  await b;
  body.resolve({ state: 'complete', response: { body: { reply: 'A' } } });
  await a;
  assert.equal(f.ctx.state.retrieved.id, idB);
});
function restoreFixture() {
  const f = page(),
    get = deferred(),
    save = deferred(),
    active = [];
  f.ctx.store = { getDraft: () => get.promise, saveDraft: () => save.promise };
  f.ctx.active = active;
  vm.runInContext(
    `lyLibraryStore=store;lyLibraryCapture=()=>({draftId:'previous'});
    lyLibraryActivate=async record=>active.push(record.draftId);`,
    f.ctx
  );
  return { ...f, get, save, active };
}
test('restore acquires before its first await and rejects another restore without releasing its lock', async () => {
  const f = restoreFixture();
  const a = f.ctx.restore('A');
  assert.equal(f.elements['lyrics-draft'].readOnly, true);
  await f.ctx.restore('B');
  assert.equal(f.elements['surface-lyrics'].inert, true);
  assert.match(f.notices[0][0], /Another draft is being opened/);
  f.get.resolve({ draftId: 'A' });
  await Promise.resolve();
  await f.ctx.restore('C');
  assert.equal(f.elements['surface-lyrics'].inert, true);
  f.save.resolve();
  await a;
  assert.deepEqual(f.active, ['A']);
  assert.equal(f.elements['surface-lyrics'].inert, false);
  assert.equal(f.elements['lyrics-draft'].readOnly, false);
});
for (const failure of ['missing', 'get', 'save', 'activate'])
  test(`restore releases its own lock after ${failure} failure`, async () => {
    const f = restoreFixture();
    if (failure === 'activate')
      vm.runInContext("lyLibraryActivate=async()=>{throw Error('activation failed')}", f.ctx);
    const pending = f.ctx.restore('A');
    if (failure === 'get') f.get.reject(new Error('get failed'));
    else f.get.resolve(failure === 'missing' ? null : { draftId: 'A' });
    if (failure === 'save') f.save.reject(new Error('save failed'));
    else f.save.resolve();
    await pending;
    assert.equal(f.elements['surface-lyrics'].inert, false);
    assert.equal(f.elements['lyrics-draft'].readOnly, false);
    const owner = f.ctx.acquire();
    f.ctx.release(owner);
  });
test('only the current lock owner can release the draft', () => {
  const f = page(),
    owner = f.ctx.acquire();
  assert.throws(() => f.ctx.acquire(), /Another draft/);
  f.ctx.release();
  f.ctx.release({});
  assert.equal(f.elements['surface-lyrics'].inert, true);
  f.ctx.release(owner);
  const newer = f.ctx.acquire();
  f.ctx.release(owner);
  assert.equal(f.elements['surface-lyrics'].inert, true);
  f.ctx.release(newer);
  assert.equal(f.elements['surface-lyrics'].inert, false);
});
test('a refused import cannot release a restore lock; its own failed capture remains releasable', async () => {
  const f = restoreFixture();
  f.ctx.window = {};
  f.ctx.CMLibraryImport = {
    createIndexedDBStore: () => ({
      listDrafts: async () => [],
      getDraft: async () => {
        throw Error('read failed');
      },
    }),
    createReceiver: (options) => {
      f.ctx.receiverOptions = options;
      return { start: async () => {} };
    },
  };
  vm.runInContext('lyMeta=()=>({});', f.ctx);
  await f.ctx.lyLibraryStart();
  const owner = f.ctx.acquire();
  await assert.rejects(f.ctx.receiverOptions.captureCurrent(), /Another draft/);
  f.ctx.receiverOptions.releaseCurrent();
  assert.equal(f.elements['surface-lyrics'].inert, true);
  f.ctx.release(owner);
  vm.runInContext(
    "lyLibraryCapture=()=>({draftId:'old',meta:{libraryOrigin:{}},originalText:null});",
    f.ctx
  );
  await assert.rejects(f.ctx.receiverOptions.captureCurrent(), /read failed/);
  f.ctx.receiverOptions.releaseCurrent();
  assert.equal(f.elements['surface-lyrics'].inert, false);
});
