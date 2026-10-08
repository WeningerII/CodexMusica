const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const api = require('../src/library-import.js');
const copy = (value) => JSON.parse(JSON.stringify(value));

async function envelope(overrides = {}) {
  const result = {
    protocol: api.PROTOCOL,
    version: 1,
    handoffId: 'handoff:one',
    draftId: 'draft:imported',
    createdAt: '2026-10-08T00:00:00Z',
    payload: {
      text: 'The evening wind\nReturns the song',
      title: 'Test reading',
      language: 'eng',
      scope: 'whole',
      provenance: {
        snapshotId: 'snapshot:one',
        unitId: 'unit:one',
        workId: 'work:one',
        editionId: 'edition:one',
        revisionId: 'revision:one',
        rights: { attribution: 'Source credit', notices: ['First notice', 'Second notice'] },
      },
      lineage: [{ row: 1, sourceLine: 12, sourceStart: 100, sourceEnd: 116 }],
      declarations: [],
    },
    ...overrides,
  };
  result.digest = await api.envelopeDigest(result, webcrypto);
  return result;
}
const previous = () => ({
  draftId: 'draft:previous',
  text: 'My existing song',
  meta: { version: 1, brief: 'Retain this', notes: { Verse: 'Retain that' } },
  writer: {
    continuationId: 'private-previous-run',
    pending: { request_id: 'pending-request' },
    task: { domain: 'lyrics', phase: 'edit' },
  },
  savedAt: 1,
});

// A transaction simulator exercises the actual IndexedDB adapter, including
// aborting after a partial write. Each transaction commits its private maps
// only on completion, as IndexedDB does; no external dependencies are needed.
function fakeIndexedDB({ failAtWrite = 0 } = {}) {
  const tables = new Map();
  let writes = 0;
  const db = {
    objectStoreNames: { contains: (name) => tables.has(name) },
    createObjectStore(name) {
      tables.set(name, new Map());
    },
    transaction(names, mode) {
      const local = new Map(names.map((name) => [name, new Map(tables.get(name))]));
      let pending = 0,
        aborted = false,
        completed = false;
      const tx = {
        error: null,
        abort() {
          if (aborted) return;
          aborted = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore(name) {
          function request(work) {
            const req = {};
            pending++;
            queueMicrotask(() => {
              if (aborted) {
                pending--;
                return;
              }
              try {
                req.result = work();
                req.onsuccess?.();
              } catch (error) {
                tx.error = error;
                tx.abort();
              }
              pending--;
              finish();
            });
            return req;
          }
          return {
            get(key) {
              return request(() => local.get(name).get(key));
            },
            getAll() {
              return request(() => Array.from(local.get(name).values()));
            },
            put(value, key) {
              if (mode !== 'readwrite') throw new Error('Readonly transaction.');
              if (++writes === failAtWrite) throw new Error('Injected write failure.');
              return request(() => {
                local.get(name).set(key, copy(value));
                return key;
              });
            },
          };
        },
      };
      function finish() {
        setImmediate(() => {
          if (pending || aborted || completed) return;
          completed = true;
          if (mode === 'readwrite') for (const name of names) tables.set(name, local.get(name));
          tx.oncomplete?.();
        });
      }
      finish();
      return tx;
    },
  };
  return {
    tables,
    open() {
      const request = { result: db };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    },
  };
}
function fakeWindow(nonce = '1'.repeat(64), origin = api.SITE_ORIGIN) {
  const messages = [],
    session = new Map();
  const opener = { postMessage: (data, target) => messages.push({ data, target }) };
  return {
    opener,
    messages,
    location: {
      href:
        'https://codexmusica.com/codex.html?cm_library_origin=' +
        encodeURIComponent(origin) +
        '&cm_library_nonce=' +
        nonce +
        '#lyrics',
    },
    sessionStorage: {
      getItem: (key) => session.get(key) || null,
      setItem: (key, value) => session.set(key, value),
    },
    addEventListener() {},
    removeEventListener() {},
  };
}
function transfer(win, value, overrides = {}) {
  return {
    origin: api.SITE_ORIGIN,
    source: win.opener,
    data: { type: api.TYPES.transfer, version: 1, nonce: '1'.repeat(64), envelope: value },
    ...overrides,
  };
}

test('canonical SHA256 authenticates identity, exact text and every source notice', async () => {
  const value = await envelope();
  assert.equal(
    (await api.validateEnvelope(value, webcrypto)).payload.provenance.rights.notices.length,
    2
  );
  const order = Object.fromEntries(Object.entries(value).reverse());
  assert.equal(await api.envelopeDigest(order, webcrypto), value.digest);
  for (const edit of [
    (x) => {
      x.payload.text += '!';
    },
    (x) => {
      x.payload.provenance.rights.notices.pop();
    },
    (x) => {
      x.draftId = 'draft:other';
    },
  ]) {
    const changed = copy(value);
    edit(changed);
    await assert.rejects(api.validateEnvelope(changed, webcrypto), /digest/);
  }
});
test('unsupported versions, missing coordinates and unsafe envelope fields refuse', async () => {
  const value = await envelope();
  await assert.rejects(api.validateEnvelope({ ...value, version: 2 }, webcrypto), /version/);
  const missing = copy(value);
  delete missing.payload.provenance.unitId;
  await assert.rejects(api.validateEnvelope(missing, webcrypto), /unitId/);
  await assert.rejects(
    api.validateEnvelope({ ...value, jobCapability: 'private' }, webcrypto),
    /Unexpected/
  );
  assert.throws(() => api.canonical(JSON.parse('{"__proto__":{"polluted":true}}')), /Unsafe/);
});
test('atomic commit preserves full previous draft, private continuation and provenance', async () => {
  const indexedDB = fakeIndexedDB(),
    store = api.createIndexedDBStore(indexedDB);
  const value = await envelope(),
    old = previous();
  const commit = await store.commitImport(value, old, {
    nonce: '1'.repeat(64),
    origin: api.SITE_ORIGIN,
  });
  assert.deepEqual(await store.getDraft(old.draftId), old);
  assert.deepEqual(commit.draft.meta.libraryOrigin.provenance, value.payload.provenance);
  assert.equal(commit.draft.writer, null);
  assert.equal(commit.draft.meta.libraryOrigin.adapted, false);
  assert.equal((await store.pendingActivation()).draftId, value.draftId);
  await store.markActivated(value.draftId);
  assert.equal(await store.pendingActivation(), null);
});
test('write failure rolls back old draft, new draft, receipt and nonce claim together', async () => {
  const indexedDB = fakeIndexedDB({ failAtWrite: 3 }),
    store = api.createIndexedDBStore(indexedDB);
  const value = await envelope();
  await assert.rejects(
    store.commitImport(value, previous(), { nonce: '1'.repeat(64), origin: api.SITE_ORIGIN }),
    /Injected write failure/
  );
  assert.equal(await store.getDraft(value.draftId), null);
  assert.equal(await store.getDraft(previous().draftId), null);
  assert.equal(await store.getReceipt(value.handoffId), null);
  assert.equal(await store.getHandshake('1'.repeat(64)), null);
});
test('lost ACK and identical retry create one imported draft; changed digest and nonce reuse refuse', async () => {
  const indexedDB = fakeIndexedDB(),
    store = api.createIndexedDBStore(indexedDB);
  const win = fakeWindow(),
    activations = [];
  const receiver = api.createReceiver({
    window: win,
    store,
    captureCurrent: previous,
    activate: async (draft) => activations.push(draft.draftId),
  });
  await receiver.start();
  const value = await envelope();
  assert.equal(await receiver.receive(transfer(win, value)), true);
  assert.equal(await receiver.receive(transfer(win, value)), true);
  assert.deepEqual(activations, [value.draftId]);
  assert.equal((await store.listDrafts()).length, 2);
  assert.equal(win.messages.filter((item) => item.data.type === api.TYPES.ack).length, 2);
  const changed = await envelope({ payload: { ...value.payload, text: 'A different song' } });
  assert.equal(await receiver.receive(transfer(win, changed)), false);
  const next = await envelope({ handoffId: 'handoff:two', draftId: 'draft:two' });
  assert.equal(await receiver.receive(transfer(win, next)), false);
  assert.equal((await store.listDrafts()).length, 2);
});
test('wrong origin, source and nonce do not commit or acknowledge', async () => {
  const store = api.createIndexedDBStore(fakeIndexedDB()),
    win = fakeWindow();
  const receiver = api.createReceiver({
    window: win,
    store,
    captureCurrent: previous,
    activate: async () => {},
  });
  await receiver.start();
  const value = await envelope();
  assert.equal(
    await receiver.receive(transfer(win, value, { origin: 'https://attacker.example' })),
    false
  );
  assert.equal(await receiver.receive(transfer(win, value, { source: {} })), false);
  const wrongNonce = transfer(win, value);
  wrongNonce.data.nonce = '2'.repeat(64);
  assert.equal(await receiver.receive(wrongNonce), false);
  assert.deepEqual(await store.listDrafts(), []);
  assert.equal(win.messages.length, 1); // Only the ready signal.
});
test('failed commits always release the current-draft lock and never acknowledge', async () => {
  const win = fakeWindow(),
    store = api.createIndexedDBStore(fakeIndexedDB({ failAtWrite: 3 }));
  let locked = false,
    releases = 0;
  const receiver = api.createReceiver({
    window: win,
    store,
    captureCurrent: () => {
      locked = true;
      return previous();
    },
    releaseCurrent: () => {
      locked = false;
      releases++;
    },
    activate: async () => assert.fail('An aborted draft was activated.'),
  });
  await receiver.start();
  assert.equal(await receiver.receive(transfer(win, await envelope())), false);
  assert.equal(locked, false);
  assert.equal(releases, 1);
  assert.equal(
    win.messages.some((item) => item.data.type === api.TYPES.ack),
    false
  );
});
test('file and window imports serialize so each preserves the immediately preceding active draft', async () => {
  const win = fakeWindow(),
    store = api.createIndexedDBStore(fakeIndexedDB());
  let current = previous();
  const receiver = api.createReceiver({
    window: win,
    store,
    captureCurrent: () => current,
    activate: async (draft) => {
      current = draft;
    },
  });
  await receiver.start();
  const first = await envelope({ handoffId: 'handoff:file', draftId: 'draft:file' });
  const second = await envelope({ handoffId: 'handoff:window', draftId: 'draft:window' });
  const a = receiver.importEnvelope(first),
    b = receiver.receive(transfer(win, second));
  await a;
  assert.equal(await b, true);
  assert.equal(current.draftId, second.draftId);
  assert.equal((await store.getReceipt(second.handoffId)).preservedDraftId, first.draftId);
  assert.equal((await store.listDrafts()).length, 3);
});
test('unused handshake expires at 60 seconds; a committed retry remains safe', async () => {
  let clock = 1000;
  const store = api.createIndexedDBStore(fakeIndexedDB()),
    win = fakeWindow();
  const receiver = api.createReceiver({
    window: win,
    store,
    captureCurrent: previous,
    activate: async () => {},
    now: () => clock,
  });
  await receiver.start();
  clock += 60000;
  assert.equal(await receiver.receive(transfer(win, await envelope())), false);
  assert.equal((await store.listDrafts()).length, 0);
});
test('receiver reload completes committed activation without duplicate draft creation', async () => {
  const indexedDB = fakeIndexedDB(),
    store = api.createIndexedDBStore(indexedDB),
    value = await envelope();
  await store.commitImport(value, previous(), { nonce: '1'.repeat(64), origin: api.SITE_ORIGIN });
  const restored = [],
    win = fakeWindow();
  const receiver = api.createReceiver({
    window: win,
    store: api.createIndexedDBStore(indexedDB),
    captureCurrent: previous,
    activate: async (draft) => restored.push(draft.draftId),
  });
  await receiver.start();
  assert.deepEqual(restored, [value.draftId]);
  assert.equal(await receiver.receive(transfer(win, value)), true);
  assert.equal((await store.listDrafts()).length, 2);
});
test('file import retains an oversized native reading verbatim and refuses writer eligibility', async () => {
  const sample = await envelope();
  const text = 'شعر محفوظ\n'.repeat(900000);
  const value = await envelope({
    payload: { ...sample.payload, text, language: 'fas', scope: 'excerpt' },
  });
  assert.ok(new TextEncoder().encode(JSON.stringify(value)).byteLength > api.TRANSFER_BYTES);
  const store = api.createIndexedDBStore(fakeIndexedDB()),
    win = fakeWindow();
  const receiver = api.createReceiver({
    window: win,
    store,
    captureCurrent: previous,
    activate: async () => {},
  });
  const result = await receiver.importEnvelope(value);
  assert.equal(result.draft.text, text);
  assert.equal(result.draft.meta.libraryOrigin.scope, 'excerpt');
  assert.equal(result.draft.meta.libraryOrigin.writingEligibility.eligible, false);
});
test('origins require exact production or explicitly configured localhost equality', () => {
  assert.equal(api.originAllowed(api.SITE_ORIGIN), true);
  assert.equal(api.originAllowed(api.SITE_ORIGIN + '.attacker.example'), false);
  assert.equal(api.originAllowed('http://localhost:3000'), false);
  assert.equal(api.originAllowed('http://localhost:3000', 'http://localhost:3000'), true);
  assert.equal(api.originAllowed('http://localhost:3001', 'http://localhost:3000'), false);
  assert.equal(api.originAllowed('https://dev.example', 'https://dev.example'), false);
});
test('metadata, saved copies, session exports and Undo retain the full untruncated provenance sidecar', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const start = source.indexOf('const LYRIC_META_LIMITS='),
    end = source.indexOf('function sessionSnapshot()', start);
  const context = vm.createContext({});
  vm.runInContext(
    source.slice(start, end) +
      '\nglobalThis.normalize=lyricMetaOf;globalThis.historyMeta=lyricMetaHistory;',
    context
  );
  const value = api.importedDraft(await envelope(), Date.now());
  value.meta.libraryOrigin.provenance.rights.longNotice = 'Mandatory attribution '.repeat(10000);
  const normalized = context.normalize(value.meta);
  assert.equal(normalized.libraryOrigin.provenance.rights.longNotice.length, 220000);
  assert.deepEqual(copy(context.historyMeta(normalized)).libraryOrigin, value.meta.libraryOrigin);
  const restorationStart = source.indexOf('function _restoreSnapshot(idx)'),
    restorationEnd = source.indexOf('function undo()', restorationStart);
  context.app = {
    cards: [],
    lyricMeta: normalized,
    history: [
      JSON.stringify({
        cards: [],
        name: 'Previous',
        lyrics: 'Old text',
        lyricMeta: { version: 1, brief: 'Previous', notes: {} },
      }),
    ],
  };
  context.UI = { lyricRevision: 0 };
  context.document = { getElementById: () => null };
  context.console = console;
  context.showToast = () => {};
  vm.runInContext(
    source.slice(restorationStart, restorationEnd) + '\nglobalThis.restore=_restoreSnapshot;',
    context
  );
  assert.equal(context.restore(0), true);
  assert.equal(context.app.lyricMeta.libraryOrigin, undefined);
  context.app.history.push(
    JSON.stringify({
      cards: [],
      name: 'Imported',
      lyrics: value.text,
      lyricMeta: copy(context.historyMeta(normalized)),
    })
  );
  assert.equal(context.restore(1), true);
  assert.deepEqual(copy(context.app.lyricMeta.libraryOrigin), value.meta.libraryOrigin);
});
test('working-copy download binds the complete text and mandatory credits in one importable envelope', async () => {
  const original = api.importedDraft(await envelope(), Date.now());
  original.meta.brief = 'A new writing brief';
  original.meta.notes = { Verse: 'A retained note' };
  original.meta.libraryOrigin.provenance.rights.longNotice = 'Source attribution '.repeat(20000);
  original.meta.libraryOrigin.declarations = [{ type: 'meter', line: 1, value: '7/8' }];
  original.meta.libraryOrigin.adapted = true;
  const edited = 'An edited opening\nReturns the song';
  const bundle = await api.makeWorkingCopyEnvelope(edited, original.meta, webcrypto);
  assert.equal(bundle.payload.text, edited);
  assert.equal(
    bundle.payload.provenance.rights.longNotice,
    original.meta.libraryOrigin.provenance.rights.longNotice
  );
  assert.notEqual(bundle.draftId, original.draftId);
  assert.deepEqual(bundle.payload.declarations, []);
  assert.equal(bundle.payload.provenance.workingCopy.declarations[0].value, '7/8');
  const imported = api.importedDraft(await api.validateEnvelope(bundle, webcrypto), Date.now());
  assert.equal(imported.meta.brief, original.meta.brief);
  assert.deepEqual(imported.meta.notes, original.meta.notes);
  assert.equal(imported.writer, null);
  assert.equal(imported.pageReview, null);
  assert.equal(
    imported.meta.libraryOrigin.provenance.workId,
    original.meta.libraryOrigin.provenance.workId
  );
});
test('Lyrics activation preserves the old private continuation without aborting it or inheriting its certification', async () => {
  const appSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const pageSource = fs.readFileSync(path.join(__dirname, '../src/pages/lyrics.js'), 'utf8');
  const elements = {
    'lyrics-draft': { value: 'My existing song', readOnly: false },
    'surface-lyrics': { inert: false },
    'chat-domain': { value: 'lyrics-edit' },
    'chat-input': { value: 'My unsent writer message' },
    'chat-log': { innerHTML: 'Old conversation' },
  };
  let aborts = 0,
    resets = 0;
  const state = {
    generation: 5,
    busy: true,
    task: { domain: 'lyrics', phase: 'edit' },
    continuationId: 'private-run',
    pending: { request_id: 'private-request' },
    lyric: { certified: true },
    controller: {
      abort: () => {
        aborts++;
      },
    },
    archives: [],
  };
  const stored = new Map();
  const ctx = vm.createContext({
    console,
    crypto: webcrypto,
    CMLibraryImport: api,
    $ui: (id) => elements[id],
    UI: { lyricRevision: 7, saveFailed: false, storageConflict: false },
    app: {
      cards: [{ id: 'recipe-card-unchanged' }],
      lyrics: elements['lyrics-draft'].value,
      lyricMeta: {
        version: 1,
        brief: 'Existing brief',
        notes: { Verse: 'Existing note' },
        ui: {},
        drafts: {},
      },
    },
    chatState: state,
    uiChatSessions: new Map(),
    CHAT_STORAGE_KEY: 'fixture-chat',
    localStorage: { setItem: (key, value) => stored.set(key, value) },
    document: { createDocumentFragment: () => ({}) },
    _chatPersistedState: () => ({
      continuationId: state.continuationId,
      pending: state.pending,
      domain: 'lyrics',
      phase: 'edit',
    }),
    _chatSave: () => {},
    _chatPollStop: () => {},
    _chatReset: () => {
      resets++;
    },
    _chatSyncCount: () => {},
    uiRegisterPage: () => {},
    pushHistory: () => {},
    uiAutosave: () => {},
    uiNavigate: () => {},
    showToast: () => {},
  });
  vm.runInContext(
    appSource.slice(
      appSource.indexOf('const LYRIC_META_LIMITS='),
      appSource.indexOf('function sessionSnapshot()')
    ),
    ctx
  );
  vm.runInContext(pageSource, ctx);
  vm.runInContext(
    'lyRefresh=()=>{};lyLibraryStore={listDrafts:async()=>[]};LY.run={lyric:{certified:true},final:["My existing song"]};globalThis.capture=lyLibraryCapture;globalThis.acquire=lyLibraryAcquire;globalThis.release=lyLibraryRelease;globalThis.activate=lyLibraryActivate;globalThis.pageState=LY;',
    ctx
  );
  ctx.acquire();
  const preserved = ctx.capture();
  assert.equal(elements['lyrics-draft'].readOnly, true);
  assert.equal(elements['surface-lyrics'].inert, true);
  assert.equal(preserved.writer.continuationId, 'private-run');
  assert.equal(preserved.writer.pending.request_id, 'private-request');
  assert.equal(preserved.writerInput, 'My unsent writer message');
  assert.equal(preserved.meta.notes.Verse, 'Existing note');
  const imported = api.importedDraft(await envelope(), Date.now());
  await ctx.activate(imported, { imported: true, preservedDraftId: preserved.draftId });
  ctx.release();
  assert.equal(aborts, 0);
  assert.equal(resets, 0);
  assert.equal(ctx.chatState.generation, 6);
  assert.equal(ctx.chatState.continuationId, null);
  assert.equal(ctx.chatState.lyric, null);
  assert.equal(ctx.pageState.run, null);
  assert.equal(elements['lyrics-draft'].value, imported.text);
  assert.equal(elements['lyrics-draft'].readOnly, false);
  assert.equal(elements['surface-lyrics'].inert, false);
  assert.deepEqual(copy(ctx.app.cards), [{ id: 'recipe-card-unchanged' }]);
  await ctx.activate(preserved, { restored: true });
  assert.equal(ctx.chatState.continuationId, 'private-run');
  assert.equal(elements['chat-input'].value, 'My unsent writer message');
  assert.equal(aborts, 0);
  assert.equal(resets, 0);
});
