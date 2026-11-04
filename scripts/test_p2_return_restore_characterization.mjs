/** #676 P2 characterization, observed on main 10b42689.
 * Calls the real page/parser/save/restore functions with in-memory storage and
 * DOM adapters. This is NOT browser reload, IndexedDB, visible coverage, or
 * completed P2 role/container acceptance. No provider or network is used.
 * Run: PATH=<runtime-venv>/bin:$PATH node --test scripts/test_p2_return_restore_characterization.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'src/pages/lyrics.js'), 'utf8');
const copy = (v) => JSON.parse(JSON.stringify(v));
const song = '[SETUP — returns — 1,3 — cut v2]\n[Verse]\nI hold the light\nWe face the night\nI hold the light\nYou face the night';

function slice(start, end) {
  const a = appSource.indexOf(start), b = appSource.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `production function boundaries: ${start}`);
  return appSource.slice(a, b);
}

function page(text = song) {
  const stored = new Map();
  const elements = {
    'lyrics-draft': { value: text, readOnly: false },
    'surface-lyrics': { inert: false },
    'chat-domain': { value: 'lyrics-edit' },
    'chat-input': { value: '' },
    'chat-log': { innerHTML: '' },
  };
  const ctx = vm.createContext({
    console, crypto: webcrypto,
    CMLibraryImport: require('../src/library-import.js'),
    CMLyricTokens: require('../src/lyric-tokens.js'),
    $ui: (id) => elements[id],
    document: { getElementById: (id) => elements[id], createDocumentFragment: () => ({}) },
    UI: { lyricRevision: 0, saveFailed: false, storageConflict: false },
    app: { cards: [], lyrics: text, workspaceName: 'P2 fixture', lyricMeta: { version: 1 } },
    chatState: { generation: 0, task: { domain: 'lyrics', phase: 'edit' }, archives: [] },
    uiChatSessions: new Map(), CHAT_STORAGE_KEY: 'p2-test',
    localStorage: { setItem: (k, v) => stored.set(k, v) },
    window: { storage: {
      backend: 'fixture',
      set: async (k, v) => stored.set(k, v),
      get: async (k) => stored.has(k) ? { value: stored.get(k) } : null,
    } },
    readListStrict: async () => JSON.parse(stored.get('codex:list') || '[]'),
    newId: () => 'p2', WS_SCHEMA: 1, _engineLive: true,
    normalizeWorkspaceCards: (cards) => { assert.deepEqual(copy(cards), []); return []; },
    _CARD_TRANSIENTS: {},
    _chatPersistedState: () => null, _chatSave() {}, _chatPollStop() {},
    _chatReset() {}, _chatSyncCount() {}, uiRegisterPage() {}, pushHistory() {},
    uiAutosave() {}, uiNavigate() {}, showToast() {}, closeModal() {}, renderAll() {},
  });
  vm.runInContext(slice('const LYRIC_META_LIMITS=', 'function sessionSnapshot()'), ctx);
  vm.runInContext(slice('function sessionSnapshot()', 'function sessionKey('), ctx);
  vm.runInContext(slice('let _savedWriteQueue=', 'async function delWS('), ctx);
  vm.runInContext(pageSource, ctx);
  vm.runInContext('lyRefresh=()=>{}; lyLibraryStore={listDrafts:async()=>[]}; globalThis.pageState=LY;', ctx);
  return { ctx, stored, elements };
}

function reading(p) {
  return JSON.parse(vm.runInContext(`JSON.stringify((()=>{
    const model=lyParse(lyDraft().value);
    return {text:model.text, sung:model.sung.map(r=>r.text),
      sections:model.sections.map(s=>s.header?.name), declarations:lyDeclarationsOf(model)};
  })())`, p.ctx));
}

function identity(read) {
  const result = spawnSync(process.env.PYTHON || 'python3', ['-B', '-c',
    'import json,sys; from quality import schemes as S; d=json.load(sys.stdin); m=S.mandate("ABAB",n_lines=4,returns=d["declarations"]["returns"]); print(json.dumps([list(f[:4]) for f in m.returns_check(d["sung"],variation=False)]))'],
  { cwd: root, env: { ...process.env, PYTHONPATH: path.join(root, 'lyric-harness') },
    input: JSON.stringify(read), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  return JSON.parse(result.stdout);
}

test('saved workspace: real saveWS/restoreSavedWorkspace preserve text and Return declaration in a fresh page context', async () => {
  const before = page();
  const initial = reading(before);
  assert.equal(initial.declarations.returns, '1,3');
  assert.deepEqual(identity(initial), []);
  await vm.runInContext('saveWS("P2 saved session")', before.ctx);
  assert.ok(before.stored.has('codex:ws:p2'));
  const reopened = page('discard me');
  for (const [k, v] of before.stored) reopened.stored.set(k, v);
  await vm.runInContext('restoreSavedWorkspace("codex:ws:p2",false)', reopened.ctx);
  assert.deepEqual(reading(reopened), initial);
  assert.deepEqual(identity(reading(reopened)), []);
});

test('Library copy: capture serializes parsed models as text; activation independently reparses them', async () => {
  const before = page();
  vm.runInContext('LY.run={baseModel:lyParse(lyDraft().value),resultModel:lyParse(lyDraft().value)}', before.ctx);
  const record = copy(vm.runInContext('lyLibraryCapture()', before.ctx));
  assert.equal(record.pageReview.run.baseModel, song);
  assert.equal(record.pageReview.run.resultModel, song);
  const reopened = page('discard me');
  reopened.ctx.record = record;
  await vm.runInContext('lyLibraryActivate(record,{restored:true})', reopened.ctx);
  assert.deepEqual(reading(reopened), reading(before));
  assert.deepEqual(identity(reading(reopened)), []);
  const run = reopened.ctx.pageState.run;
  assert.equal(run.baseModel.text, song);
  assert.equal(run.resultModel.text, song);
  assert.notEqual(run.baseModel, run.resultModel);
  assert.equal(record.pageReview.run.baseModel, song, 'stored record stays text');
});

test('manual one-occurrence edit stays divergent through EACH independent restore and leaves an open Return', async () => {
  const edited = song.replace('I hold the light', 'I guard the light');
  const before = page(edited);
  const expected = [['R1', 1, 3, 'NOT_VERBATIM']];
  assert.deepEqual(identity(reading(before)), expected);
  await vm.runInContext('saveWS("Edited")', before.ctx);
  const session = page();
  for (const [k, v] of before.stored) session.stored.set(k, v);
  await vm.runInContext('restoreSavedWorkspace("codex:ws:p2",false)', session.ctx);
  const library = page();
  library.ctx.record = copy(vm.runInContext('lyLibraryCapture()', before.ctx));
  await vm.runInContext('lyLibraryActivate(record,{restored:true})', library.ctx);
  for (const restored of [session, library]) {
    assert.equal(reading(restored).text, edited);
    assert.deepEqual(reading(restored).sung, ['I guard the light', 'We face the night', 'I hold the light', 'You face the night']);
    assert.deepEqual(identity(reading(restored)), expected);
  }
});

test('current limitation: raw Refrain/Burden headers are section labels, not contained line-role declarations', () => {
  for (const role of ['ReFrAiN', 'BuRdEn']) {
    const p = page(`[Verse]\nA first line\n[${role}]\nA returning line`);
    const result = reading(p);
    assert.deepEqual(result.sections, ['Verse', role]);
    assert.equal(result.declarations.returns, undefined);
    assert.equal(result.declarations.roles, undefined);
  }
});

test.todo('P2 acceptance gap: typed contained refrain/burden plus raw role on all reporting surfaces');
test.todo('P2 acceptance gap: real browser saved-session reload and independent IndexedDB Library restore with visible re-review');
