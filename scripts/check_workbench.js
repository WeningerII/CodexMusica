#!/usr/bin/env node
'use strict';
// Production frontend integration checks. Network replies are deterministic fixtures;
// these tests never authorize a paid request and do not claim live AI availability.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-workbench-'));
const htmlFile = path.join(temp, 'codex.html');
execFileSync(
  process.execPath,
  [path.join(root, 'scripts/build_html.js'), '--embedded', '--out=' + htmlFile, '--quiet'],
  { cwd: root, stdio: 'pipe' }
);
const html = fs.readFileSync(htmlFile, 'utf8');
fs.rmSync(temp, { recursive: true, force: true });
const errors = [];
const vc = new VirtualConsole();
vc.on('error', (...args) => console.error(...args));
vc.on('jsdomError', (e) => {
  if (!/Not implemented/.test(e.message)) errors.push(e.message);
});
const dom = new JSDOM(html, {
  url: 'https://codexmusica.com/codex.html',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = () => ({ matches: false, addListener() {}, addEventListener() {} });
    w.HTMLElement.prototype.scrollIntoView = function () {};
    w.fetch = async (url) => {
      const u = new URL(url, w.location.href);
      if (u.hostname === 'mcp.codexmusica.com')
        return { ok: true, status: 200, json: async () => ({ ok: true, enabled: true }) };
      const file = path.join(root, u.pathname.replace(/^\//, ''));
      if (!fs.existsSync(file)) throw Error('Missing local fixture ' + u.pathname);
      return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
    };
    w.AbortSignal.timeout = () => new w.AbortController().signal;
  },
});
const run = (code) => dom.window.eval(code);
(async () => {
  for (let i = 0; i < 100 && !run("typeof UI!=='undefined'&&UI.ready"); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(run('UI.ready'), true, errors.join('\n'));
  assert.deepEqual(errors, []);
  assert.equal(dom.window.document.querySelectorAll('.ui-header').length, 1);
  assert.equal(dom.window.document.querySelector('.native-header'), null);
  assert.equal(dom.window.document.querySelectorAll('#btn-save').length, 1);
  // Removing charts must preserve category navigation and listening in both catalogs.
  const doc = dom.window.document;
  const click = (selector) => {
    const button = doc.querySelector(selector);
    assert.ok(button, 'Missing navigation control: ' + selector);
    button.click();
  };
  assert.equal(doc.querySelector('.ui-wheel, .genre-web'), null);
  assert.match(
    doc.querySelector('#genre-body .listen').href,
    /^https:\/\/www\.youtube\.com\/results\?search_query=/
  );
  click('#genre-body [data-ui="genre-branch"]');
  assert.ok(run('UI.genreNode'));
  click('#genre-body [data-ui="genre-back"]');
  assert.equal(run('UI.genreNode'), '');
  click('#genre-body [data-ui="genre-select"]');
  assert.equal(doc.querySelector('.genre-web'), null);
  assert.ok(doc.querySelector('.related-row [data-ui="genre-select"]'));
  click('[data-ui="genre-close"]');
  click('[data-ui="genre-tree"]');
  assert.equal(
    dom.window.getComputedStyle(doc.querySelector('.inline-tree > .modal')).opacity,
    '1',
    'embedded tree must not inherit the closed modal animation'
  );
  assert.ok(doc.querySelector('#genre-body .tree-row'), 'Browse tree must render its categories');
  click('#genre-body [data-close]');
  assert.ok(doc.querySelector('#genre-body .catalog-row'), 'closing tree restores the genre list');
  run("uiNavigate('instrument')");
  click('#instrument-body [data-ui="instrument-family"]');
  click('#instrument-body [data-ui="instrument-class"]');
  assert.ok(run('UI.instrumentClass'));
  assert.match(
    new URL(doc.querySelector('#instrument-body .listen').href).searchParams.get('search_query'),
    /musical instrument solo demonstration$/
  );
  click('#instrument-body [data-ui="instrument-back"]');
  assert.equal(run('UI.instrumentClass'), '');
  click('#instrument-body [data-ui="instrument-back"]');
  assert.equal(run('UI.instrumentFamily'), '');
  run("uiNavigate('genre')");
  // Exports with intentionally unselected parts remain valid. Transfers own their data.
  run("app.cards=[];app.lyrics='';app.history=[];app.historyIndex=-1;pushHistory();");
  for (const id of ['drum_kit', 'didgeridoo', 'bajo_sexto']) {
    assert.equal(run(`normalizeWorkspaceCards([makeCard('${id}')])[0].instrumentId`), id);
  }
  run(
    "window.fixture=makeCard('oud');window.copy=normalizeWorkspaceCards([window.fixture],true);window.copy[0].parts.changed='x';"
  );
  assert.equal(run('window.fixture.parts.changed'), undefined);
  assert.throws(() => run("normalizeWorkspaceCards([{...makeCard('oud'),room:'unknown'}])"));
  assert.equal(
    run(
      "window.unset=makeCard('oud');window.unset.parts[Inst('oud').parts[0].id]=null;normalizeWorkspaceCards([window.unset]).length"
    ),
    1
  );
  // One addition/refinement per Undo, presentation state irrelevant, redo retained.
  run(
    "addCard('oud');renderAll();window.card=app.cards[0];window.card._uiTab='env';pushHistory();window.card.room=ROOMS[0].id;rerenderCard(window.card);"
  );
  assert.equal(run('app.history.length'), 3);
  assert.equal(run('document.querySelector("[data-proxy=btn-undo]").disabled'), false);
  run('document.querySelector("[data-proxy=btn-undo]").click()');
  assert.equal(run('app.cards[0].room'), null);
  run('undo()');
  assert.equal(run('app.cards.length'), 0);
  run('redo()');
  assert.equal(run('app.cards.length'), 1);
  assert.equal(run('document.querySelector("[data-proxy=btn-redo]").disabled'), false);
  // Whole session load/import semantics include title and writing.
  run(
    "app.workspaceName='Before';app.lyrics='Original words';pushHistory();app.workspaceName='After';app.lyrics='New words';pushHistory();undo();"
  );
  assert.equal(run('app.workspaceName'), 'Before');
  assert.equal(run('app.lyrics'), 'Original words');
  // Import replaces the complete session, including absent lyrics in legacy
  // files. Undo restores the previous song; invalid files change nothing.
  await run(
    "uiImport({text:async()=>JSON.stringify({name:'Legacy recipe',cards:[makeCard('oud')]})})"
  );
  assert.equal(run('app.lyrics'), '');
  assert.equal(doc.getElementById('lyrics-draft').value, '');
  run('undo()');
  assert.equal(run('app.workspaceName'), 'Before');
  assert.equal(run('app.lyrics'), 'Original words');
  await run(
    "uiImport({text:async()=>JSON.stringify({name:'Invalid',lyrics:'Wrong song',cards:[{...makeCard('oud'),room:'unknown'}]})})"
  );
  assert.equal(run('app.workspaceName'), 'Before');
  assert.equal(run('app.lyrics'), 'Original words');
  // Recipe request remains recipe request when user opens lyrics during work.
  run("chatState.busy=true;chatState.task={domain:'recipe'};uiNavigate('lyrics');");
  assert.equal(run("document.getElementById('chat-dock').parentElement.id"), 'assistant-slot');
  assert.equal(run('uiSwitchChat("lyrics")'), false);
  assert.equal(run('chatState.task.domain'), 'recipe');
  run("chatState.busy=false;chatState.task=null;uiNavigate('lyrics');");
  assert.equal(run("document.getElementById('chat-dock').parentElement.id"), 'lyrics-chat');
  // Late artifact/recovery cannot overwrite changed manual writing; explicit Use is undoable.
  run(
    "app.lyrics='Manual edits';document.getElementById('lyrics-draft').value=app.lyrics;UI.lyricRequest={id:'old-request',revision:1,text:'Old draft'};UI.lyricRevision=2;_chatAppend('<div></div>');uiReceiveReply({artifact:{text:'Recovered lyrics'}},{request_id:'old-request'});"
  );
  assert.equal(run('app.lyrics'), 'Manual edits');
  assert.equal(
    run("document.getElementById('chat-log').lastElementChild.textContent"),
    'Use these lyrics'
  );
  // Ask with a pending request enters recovery, never recaptures the new draft.
  run(
    "chatState.pending={request_id:'old-request',domain:'lyrics'};chatState.busy=false;window.fetch=async()=>({ok:true,json:async()=>({state:'completed',response:{body:{artifact:{text:'Old recovered result'}}}})});"
  );
  await run('_chatSubmit({preventDefault(){}})');
  assert.equal(run('app.lyrics'), 'Manual edits');
  // Domain changes fail atomically if a continuation cannot be stored.
  run(
    "chatState.task={domain:'lyrics'};chatState.pending=null;chatState.continuationId='lyric-receipt';window.oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('QuotaExceededError')};"
  );
  assert.equal(run("uiSwitchChat('recipe')"), false);
  assert.equal(run('chatState.continuationId'), 'lyric-receipt');
  run('Storage.prototype.setItem=window.oldSet;');
  // Concurrent native saves retain both indexed records and lyrics, including valid partial cards.
  run(
    'window.records=new Map();window.storage={async get(k){return window.records.has(k)?{value:window.records.get(k)}:null},async set(k,v){window.records.set(k,v)},async delete(k){window.records.delete(k)},async list(p){return {keys:[...window.records.keys()].filter(k=>k.startsWith(p))}}};'
  );
  await run("Promise.all([saveWS('One'),saveWS('Two')])");
  assert.equal(run("JSON.parse(window.records.get('codex:list')).length"), 2);
  assert.equal((await run('listSaved()')).length, 2);
  run(
    "window.savedKey=JSON.parse(window.records.get('codex:list'))[0].key;app.lyrics='Unsaved other';app.workspaceName='Other';"
  );
  await run('loadWS(window.savedKey)');
  assert.equal(run('app.workspaceName'), 'One');
  assert.equal(run('app.lyrics'), 'Manual edits');
  run("window.records.set('codex:list','[]')");
  assert.equal((await run('listSaved()')).length, 2);
  // Presentation-only rerender does not issue a second write; cross-tab conflict retains a recovery copy.
  run(
    "UI.lastSaved=null;uiAutosave();window.oldSaved=localStorage.getItem('codex-workbench-v1');UI.storageConflict=true;app.workspaceName='Conflicting tab';uiAutosave();"
  );
  assert.equal(run("localStorage.getItem('codex-workbench-v1')===window.oldSaved"), true);
  assert.equal(
    run("JSON.parse(sessionStorage.getItem('codex-workbench-recovery')).name"),
    'Conflicting tab'
  );
  // A reload reads the tab recovery before shared storage and keeps the conflict.
  run(
    "app.cards=[];app.workspaceName='Reset';app.lyrics='';UI.storageConflict=false;uiRestoreSession();"
  );
  assert.equal(run('app.workspaceName'), 'Conflicting tab');
  assert.equal(run('UI.storageConflict'), true);
  assert.equal(run("localStorage.getItem('codex-workbench-v1')===window.oldSaved"), true);
  // Storage may discover that it is memory-only on its very first get.
  run(
    "window.writes=0;window.storage={backend:'indexedDB',async get(){this.backend='memory';return null},async set(){window.writes++}};"
  );
  await run("saveWS('Must not report saved')");
  assert.equal(run('window.writes'), 0);
  // ── Enter commits the preface you typed, not the one before it ──
  //
  // The preface search input is debounced at 30 ms, and its Enter handler
  // commits whatever `.preface-pick` is FIRST in the rendered list. Those two
  // facts together are a bug unless Enter flushes the pending render: between
  // the last keystroke and the render there is a window where the list still
  // belongs to the PREVIOUS query, and typing a name then pressing Enter is
  // the ordinary way to use this input, so that window is the common path.
  //
  // Caught live when the debounce landed (2026-09-15): after typing `bright`
  // the top match was still `bittersweet` until the flush ran. This asserts the
  // flush, because without it the regression is silent — the modal closes, a
  // preface is applied, and it is simply the wrong one.
  run('app.cards=[];');
  await run(
    "(async()=>{ await Catalog.ensureFull('delta_blues'); importTradition('delta_blues'); })()"
  );
  assert.ok(run('app.cards.length') > 0, 'need a card to open the preface modal against');
  run('openPrefaceModal(app.cards[0]);');
  const typeInto = (q) =>
    run(
      `(() => { const el = document.getElementById('search-preface');
                el.value = ${JSON.stringify(q)};
                el.dispatchEvent(new Event('input', { bubbles: true })); })()`
    );
  const topMatch = () =>
    run("document.querySelector('#preface-modal-body .preface-pick')?.dataset.prefId || null");

  // Settle on the first query so the list genuinely belongs to it.
  typeInto('warm');
  await new Promise((r) => setTimeout(r, 80));
  const warmTop = topMatch();
  assert.ok(warmTop, 'the first query should match at least one preface');

  // Learn what the SECOND query settles to, from a clean modal, so the
  // assertion compares against a real expectation rather than "not the first".
  run('openPrefaceModal(app.cards[0]);');
  typeInto('bright');
  await new Promise((r) => setTimeout(r, 80));
  const brightTop = topMatch();
  assert.ok(brightTop, 'the second query should match at least one preface');
  assert.notEqual(brightTop, warmTop, 'the two queries must differ for this test to mean anything');

  // Now the real path: settle on the first query, retype the second, and press
  // Enter INSIDE the debounce window with no settle in between.
  run('openPrefaceModal(app.cards[0]);');
  typeInto('warm');
  await new Promise((r) => setTimeout(r, 80));
  typeInto('bright');
  run(
    `document.getElementById('search-preface')
       .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))`
  );
  assert.equal(
    run('app.cards[0].preface'),
    brightTop,
    'Enter inside the debounce window must commit the typed query’s top match, not the previous query’s'
  );

  console.log(
    'PASS workbench integration: boot, partial import, isolated transfers, Undo, full sessions, concurrent save recovery, chat routing, late lyrics, conflict protection, preface Enter flush'
  );
  dom.window.close();
})().catch((e) => {
  console.error(e);
  dom.window.close();
  process.exitCode = 1;
});
