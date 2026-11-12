const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
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
test('import eligibility does not impose a two-to-twelve-word line gate', () => {
  for (const text of [
    'Alone',
    'One two three four five six seven eight nine ten eleven twelve thirteen',
    '[VERSE]\nAlone\n\nOne two three four five six seven eight nine ten eleven twelve thirteen',
  ]) {
    assert.deepEqual(api.eligibleForWriter(text, 'eng'), { eligible: true, reasons: [] });
  }
});
test('removing the import word gate preserves language, row and character safeguards', () => {
  assert.equal(api.eligibleForWriter('a'.repeat(200), 'en').eligible, true);
  assert.match(api.eligibleForWriter('a'.repeat(201), 'en').reasons.join(' '), /200-character/);
  assert.equal(api.eligibleForWriter(Array(463).fill('Alone').join('\n'), 'en-US').eligible, true);
  assert.match(
    api.eligibleForWriter(Array(464).fill('Alone').join('\n'), 'eng').reasons.join(' '),
    /463-row/
  );
  assert.match(api.eligibleForWriter('Alone', 'fra').reasons.join(' '), /English/);
});
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
  const commit = await store.commitImport(value, old);
  assert.deepEqual(await store.getDraft(old.draftId), old);
  assert.deepEqual(commit.draft.meta.libraryOrigin.provenance, value.payload.provenance);
  assert.equal(commit.draft.writer, null);
  assert.equal(commit.draft.meta.libraryOrigin.adapted, false);
  assert.equal((await store.pendingActivation()).draftId, value.draftId);
  await store.markActivated(value.draftId);
  assert.equal(await store.pendingActivation(), null);
});
test('write failure rolls back old draft, new draft and receipt together', async () => {
  const indexedDB = fakeIndexedDB({ failAtWrite: 3 }),
    store = api.createIndexedDBStore(indexedDB);
  const value = await envelope();
  await assert.rejects(store.commitImport(value, previous()), /Injected write failure/);
  assert.equal(await store.getDraft(value.draftId), null);
  assert.equal(await store.getDraft(previous().draftId), null);
  assert.equal(await store.getReceipt(value.handoffId), null);
  assert.equal(indexedDB.tables.get('active').size, 0);
});
test('identical re-import creates one imported draft; changed content under the same handoff refuses', async () => {
  const indexedDB = fakeIndexedDB(),
    store = api.createIndexedDBStore(indexedDB);
  const activations = [];
  const receiver = api.createReceiver({
    store,
    captureCurrent: previous,
    activate: async (draft) => activations.push(draft.draftId),
  });
  await receiver.start();
  const value = await envelope();
  const first = await receiver.importEnvelope(value);
  assert.equal(first.duplicate, false);
  const again = await receiver.importEnvelope(value);
  assert.equal(again.duplicate, true);
  assert.deepEqual(again.receipt, first.receipt);
  assert.deepEqual(activations, [value.draftId]);
  assert.equal((await store.listDrafts()).length, 2);
  const changed = await envelope({ payload: { ...value.payload, text: 'A different song' } });
  await assert.rejects(receiver.importEnvelope(changed), /already used for different content/);
  assert.equal((await store.listDrafts()).length, 2);
  assert.deepEqual(activations, [value.draftId]);
});
test('failed commits always release the current-draft lock and never activate', async () => {
  const store = api.createIndexedDBStore(fakeIndexedDB({ failAtWrite: 3 }));
  let locked = false,
    releases = 0;
  const receiver = api.createReceiver({
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
  await assert.rejects(receiver.importEnvelope(await envelope()), /Injected write failure/);
  assert.equal(locked, false);
  assert.equal(releases, 1);
  assert.deepEqual(await store.listDrafts(), []);
});
test('concurrent imports serialize so each preserves the immediately preceding active draft', async () => {
  const store = api.createIndexedDBStore(fakeIndexedDB());
  let current = previous();
  const receiver = api.createReceiver({
    store,
    captureCurrent: () => current,
    activate: async (draft) => {
      current = draft;
    },
  });
  await receiver.start();
  const first = await envelope({ handoffId: 'handoff:file', draftId: 'draft:file' });
  const second = await envelope({ handoffId: 'handoff:reader', draftId: 'draft:reader' });
  const [a, b] = await Promise.all([
    receiver.importEnvelope(first),
    receiver.importEnvelope(second),
  ]);
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, false);
  assert.equal(current.draftId, second.draftId);
  assert.equal((await store.getReceipt(first.handoffId)).preservedDraftId, previous().draftId);
  assert.equal((await store.getReceipt(second.handoffId)).preservedDraftId, first.draftId);
  assert.equal((await store.listDrafts()).length, 3);
});
test('receiver reload completes committed activation without duplicate draft creation', async () => {
  const indexedDB = fakeIndexedDB(),
    store = api.createIndexedDBStore(indexedDB),
    value = await envelope();
  await store.commitImport(value, previous());
  const restored = [];
  const receiver = api.createReceiver({
    store: api.createIndexedDBStore(indexedDB),
    captureCurrent: previous,
    activate: async (draft) => restored.push(draft.draftId),
  });
  await receiver.start();
  assert.deepEqual(restored, [value.draftId]);
  assert.equal((await receiver.importEnvelope(value)).duplicate, true);
  assert.deepEqual(restored, [value.draftId]);
  assert.equal((await store.listDrafts()).length, 2);
});
test('file import retains an oversized native reading verbatim and refuses writer eligibility', async () => {
  const sample = await envelope();
  const text = 'شعر محفوظ\n'.repeat(900000);
  const value = await envelope({
    payload: { ...sample.payload, text, language: 'fas', scope: 'excerpt' },
  });
  assert.ok(new TextEncoder().encode(JSON.stringify(value)).byteLength > api.TRANSFER_BYTES);
  const store = api.createIndexedDBStore(fakeIndexedDB());
  const receiver = api.createReceiver({
    store,
    captureCurrent: previous,
    activate: async () => {},
  });
  const result = await receiver.importEnvelope(value);
  assert.equal(result.draft.text, text);
  assert.equal(result.draft.meta.libraryOrigin.scope, 'excerpt');
  assert.equal(result.draft.meta.libraryOrigin.writingEligibility.eligible, false);
});
// #659: the website never links to, or takes an import from, the old Library
// Site. Every Library import arrives in-page or from a bundle file. GitHub
// Pages serves every file on main (.nojekyll is at the root), not only the
// page, so a perf config or a README is as reachable under codexmusica.com as
// codex.html is: the scope is every file git tracks. What is matched is an
// address: a host label before the domain, or the bare domain right after a
// URL's two slashes, so prose that names the domain (this comment, the design
// doc) does not trip it. Files are read as stored; none
// of the tracked .gz or .zip files holds the address once unpacked (checked
// for #659), but this test does not unpack them. #811 deleted sites/library/,
// the old Site's own source, so no tracked path is exempt.
const SITE_ADDRESS = /[a-z0-9-]+\.chatgpt\.site|\/\/chatgpt\.site/i;
test('the address pattern matches an address, with or without a host label, and not prose', () => {
  // Built at run time, so this file holds no address for the scan below.
  const domain = ['chatgpt', 'site'].join('.');
  for (const address of [
    `https://codex-musica-corpus.example.${domain}/`,
    `https://${domain}/library`,
    `href="//${domain}"`,
    `HTTPS://${domain.toUpperCase()}`,
  ])
    assert.ok(SITE_ADDRESS.test(address), address);
  for (const prose of [`no ${domain} URL`, `the ${domain} origin`, `on ${domain}.`])
    assert.ok(!SITE_ADDRESS.test(prose), prose);
});
test('no tracked file names a chatgpt.site address (Pages serves all of main)', () => {
  const root = path.join(__dirname, '..');
  // A fixed-string git grep narrows the tracked tree to the few files that
  // mention the domain at all, in about a second; the address pattern decides.
  const found = spawnSync('git', ['grep', '-z', '-l', '-i', '-F', 'chatgpt.site'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.ok(found.status === 0 || found.status === 1, `git grep failed: ${found.stderr}`);
  const mentions = found.stdout.split('\0').filter(Boolean);
  // This file names the domain, so a scan that did not list it did not look.
  assert.ok(mentions.includes('scripts/test_library_import.js'), 'the tracked tree was scanned');
  const hits = mentions.filter((rel) =>
    SITE_ADDRESS.test(fs.readFileSync(path.join(root, rel), 'latin1'))
  );
  assert.deepEqual(hits, []);
});
test('metadata, saved copies, session exports and Undo retain the full untruncated provenance sidecar', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  // Include the recipe revision tracker used by history restoration.
  const start = source.indexOf('function musicalWorkspaceKey(cards)'),
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
    CMLyricTokens: require('../src/lyric-tokens.js'),
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
  const owner = ctx.acquire();
  const preserved = ctx.capture();
  assert.equal(elements['lyrics-draft'].readOnly, true);
  assert.equal(elements['surface-lyrics'].inert, true);
  assert.equal(preserved.writer.continuationId, 'private-run');
  assert.equal(preserved.writer.pending.request_id, 'private-request');
  assert.equal(preserved.writerInput, 'My unsent writer message');
  assert.equal(preserved.meta.notes.Verse, 'Existing note');
  // A Library choice saved before the word-cut release, carried in the
  // bundle: it is source history (routes 3 and 4 of the saved-choice
  // migration). The imported copy keeps it verbatim (the digest covers it,
  // so it is never rewritten), and nothing the page sends the grader reads
  // it: it binds no word in Lyrics.
  const legacyChoice = {
    line: 'Oh--oh, oh my love',
    token: 2,
    word: 'oh',
    phones: ['AA1'],
    basis: 'declared',
    source: 'the singer',
  };
  const base = await envelope();
  const carried = await envelope({
    payload: {
      ...base.payload,
      text: 'Oh--oh, oh my love\nThe evening wind returns',
      declarations: [{ pronunciations: [legacyChoice] }],
    },
  });
  const imported = api.importedDraft(carried, Date.now());
  await ctx.activate(imported, { imported: true, preservedDraftId: preserved.draftId });
  assert.deepEqual(copy(ctx.app.lyricMeta.libraryOrigin.declarations), [
    { pronunciations: [legacyChoice] },
  ]);
  assert.equal(ctx.app.lyricMeta.libraryOrigin.digest, carried.digest);
  const sent = vm.runInContext('JSON.stringify(lyDeclarationsOf(lyParse(lyDraft().value)))', ctx);
  assert.ok(!/AA1|the singer|readings|pronunciation/.test(sent), sent);
  ctx.release(owner);
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
