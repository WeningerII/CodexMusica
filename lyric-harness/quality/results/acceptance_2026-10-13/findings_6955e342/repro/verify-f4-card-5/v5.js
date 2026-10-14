// verify-f4-card-5: independent re-check of claim c4 ("a session import
// followed by Undo keeps A's card"). Scratch only; written from scratch.
// Usage: node v5.js <cand|prev61b|prev678|main|base> [scenario ...]
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-5');
const TREES = { cand: 'wt-695', prev61b: 'wt-61b', prev678: 'wt-678', main: 'wt-main', base: 'wt-base' };
const LABEL = process.argv[2] || 'cand';
const ONLY = process.argv.slice(3);
const TREE = path.join(S, TREES[LABEL]);
const BUILD = path.join(OUT, `build-${TREES[LABEL]}`);
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));

// The page is my own CODEX_LIBRARY=1 build (byte-identical to the tree's
// codex.html, see COMMANDS.txt); the Library chunks come from the same build;
// every other asset from the tree root.
function serve() {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let f;
    if (p === '/' || p === '/codex.html') f = path.join(BUILD, `built-${TREES[LABEL]}.html`);
    else if (p.startsWith('/library/code/') && fs.existsSync(path.join(BUILD, p))) f = path.join(BUILD, p);
    else f = path.join(TREE, p);
    if (!f.startsWith(TREE) && !f.startsWith(BUILD)) f = null;
    if (!f || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}

// ── Songs (my own; same v1/v2 cut difference: a dash run "Hey--hey" is one
// v1 word and two v2 words, so every later word moves up by one).
const A = [
  '[SETUP — title — "Alpha River"]',
  '[SETUP — rhyme groups — 1.T4,2.T4]',
  '[SETUP — reading — token 4 "river" in "Hey--hey, hey my river" — R IH1 V ER0 — declared — source: me]',
  '',
  '[VERSE]',
  'Hey--hey, hey my river',
  'Hey--hey, hey my shiver',
].join('\n');
const C = [
  '[SETUP — title — "Cello Cobra"]',
  '[SETUP — rhyme groups — 1.T4,2.T4]',
  '',
  '[VERSE]',
  'Yo--yo, yo my cello',
  'Yo--yo, yo my yellow',
].join('\n');
const Q = ['[SETUP — title — "Quiet Field"]', '[SETUP — rhyme groups — 1,2]', '', '[VERSE]', 'we walk the field at night', 'we talk until the light'].join('\n');
// A hand-written session file (version 3, as uiExport writes) holding Q and no card.
const QSESSION = { version: 3, name: 'Quiet Field session', cards: [], lyrics: Q, lyricMeta: { version: 1, brief: 'quiet brief', notes: {}, drafts: {}, ui: {} } };

const results = [];
function rec(id, claim, expected, observed, ok) {
  const status = ok === null ? 'INFO' : ok ? 'PASS' : 'FAIL';
  results.push({ id, claim, expected, observed, status });
  console.log(`[${status}] ${id}: ${claim}\n    expected: ${expected}\n    observed: ${JSON.stringify(observed)}`);
}
async function ctxOf(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // No network: the chat/status service is answered locally, never a provider.
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":false}' }));
  await ctx.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => {
        const t = document.getElementById('toast');
        const s = t && t.innerText;
        if (s && window.__toasts[window.__toasts.length - 1] !== s) window.__toasts.push(s);
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
  });
  return ctx;
}
async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model && Array.isArray(app.history) && app.history.length > 0, null, { timeout: 90000 });
  await page.waitForTimeout(600);
}
async function openPage(ctx, url, errs) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url);
  await ready(page);
  return page;
}
const draft = (page) => page.evaluate(() => document.getElementById('lyrics-draft').value);
async function importTxt(page, name, text, marker) {
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction((m) => document.getElementById('lyrics-draft').value.includes(m), marker, { timeout: 20000 });
  await page.waitForTimeout(700);
}
async function importSession(page, file, marker) {
  await page.setInputFiles('#ui-file', file);
  await page.waitForFunction((m) => document.getElementById('lyrics-draft').value.includes(m), marker, { timeout: 20000 });
  await page.waitForTimeout(900);
}
async function clickUndoRedo(page, which) {
  // The Lyrics page's own Undo/Redo buttons (they click the shell's).
  const sel = `[data-ui="ly-${which}"]`;
  const vis = await page.locator(sel).first().isVisible().catch(() => false);
  if (vis) await page.locator(sel).first().click();
  else await page.evaluate((w) => (document.getElementById(`ui-${w}`) || document.getElementById(`btn-${w}`)).click(), which);
  await page.waitForTimeout(900);
  return vis ? 'lyrics-page button' : 'shell button';
}
// The card as the writer sees it: the rendered Review pane, plus the page
// context that holds it and what localStorage holds.
const card = (page) =>
  page.evaluate(() => {
    if (typeof LY_ACTIONS !== 'undefined' && LY_ACTIONS['ly-tab']) LY_ACTIONS['ly-tab']('review');
    const box = document.getElementById('ly-panel-review');
    const btns = box ? box.querySelectorAll('[data-ui="ly-renumbered-dismiss"]').length : 0;
    const txt = box ? box.innerText : '';
    const i = txt.indexOf('renumbered to the current word cut');
    const r = app.lyricMeta && app.lyricMeta.ui && app.lyricMeta.ui.renumbered;
    let stored = null;
    try {
      const s = JSON.parse(localStorage.getItem('codex-workbench-v1') || 'null');
      stored = s && s.lyricMeta ? { ui: s.lyricMeta.ui || null, brief: s.lyricMeta.brief, head: (s.lyrics || '').split('\n')[0] } : null;
    } catch (e) {
      stored = 'unreadable';
    }
    return {
      domDismissButtons: btns,
      domCardText: i >= 0 ? txt.slice(Math.max(0, i - 40), i + 420) : null,
      words: r && Array.isArray(r.items) ? r.items.map((m) => m.word) : [],
      meta: r ? JSON.parse(JSON.stringify(r)) : null,
      uiKeys: Object.keys((app.lyricMeta && app.lyricMeta.ui) || {}),
      brief: app.lyricMeta && app.lyricMeta.brief,
      draftId: (app.lyricMeta && app.lyricMeta.draftId) || null,
      hist: [app.historyIndex, app.history.length],
      stored,
    };
  });
const toasts = (page) => page.evaluate(() => window.__toasts.splice(0));
async function snap(page, tag, log) {
  const c = await card(page);
  const d = await draft(page);
  const t = await toasts(page);
  const s = { tag, head: d.split('\n')[0], text: d, card: c, toasts: t };
  log.push(s);
  console.log(`   ${tag}: head=${s.head} words=${JSON.stringify(c.words)} domButtons=${c.domDismissButtons} hist=${JSON.stringify(c.hist)} ui=${JSON.stringify(c.uiKeys)} toasts=${JSON.stringify(t).slice(0, 300)}`);
  return s;
}
const allStorage = (page) =>
  page.evaluate(async () => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      ls[k] = localStorage.getItem(k);
    }
    const ss = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      ss[k] = sessionStorage.getItem(k);
    }
    let idb = [];
    try {
      if (typeof lyLibraryStore !== 'undefined' && lyLibraryStore) {
        for (const d of await lyLibraryStore.listDrafts()) {
          const f = await lyLibraryStore.getDraft(d.draftId);
          idb.push({ draftId: d.draftId, head: f && f.text ? f.text.split('\n')[0] : null, renumbered: f && f.meta && f.meta.ui ? f.meta.ui.renumbered || null : null });
        }
      }
    } catch (e) {
      idb = 'error: ' + e.message;
    }
    return { ls, ss, idb, history: app.history.map((h) => { const j = JSON.parse(h); return { head: (j.lyrics || '').split('\n')[0], lyricMetaKeys: Object.keys(j.lyricMeta || {}), hasUi: !!(j.lyricMeta && j.lyricMeta.ui) }; }) };
  });
// Where (if anywhere) the page still holds A's renumbering evidence.
function evidenceOf(store, words) {
  const hits = [];
  for (const [k, v] of Object.entries(store.ls)) if (v && v.includes('renumbered') && words.some((w) => v.includes(`"word":"${w}"`))) hits.push('localStorage:' + k);
  for (const [k, v] of Object.entries(store.ss)) if (v && v.includes('renumbered') && words.some((w) => v.includes(`"word":"${w}"`))) hits.push('sessionStorage:' + k);
  if (Array.isArray(store.idb)) for (const d of store.idb) if (d.renumbered && d.renumbered.items.some((m) => words.includes(m.word))) hits.push('idb:' + d.draftId);
  return hits;
}

(async () => {
  fs.writeFileSync(path.join(OUT, 'q_session.json'), JSON.stringify(QSESSION, null, 2));
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errs = [];
  const out = { label: LABEL, tree: TREE, head: null, scenarios: {} };
  const want = (n) => !ONLY.length || ONLY.includes(n);
  const scen = async (name, fn) => {
    if (!want(name)) return;
    console.log('## ' + name);
    const ctx = await ctxOf(browser);
    const log = [];
    try {
      await fn(ctx, log);
    } catch (e) {
      log.push({ error: String(e && e.stack) });
      console.log('ERROR', e && e.stack);
    }
    out.scenarios[name] = log;
    await ctx.close();
  };
  try {
    // S1: the c4 check exactly: .txt A -> session file import -> Undo (-> Redo -> Undo -> reload).
    await scen('S1', async (ctx, log) => {
      const page = await openPage(ctx, url, errs);
      await snap(page, '0 fresh', log);
      await importTxt(page, 'alpha.txt', A, 'Alpha River');
      const a = await snap(page, '1 after .txt A', log);
      await importSession(page, path.join(OUT, 'q_session.json'), 'Quiet Field');
      const q = await snap(page, '2 after session import Q', log);
      const how = await clickUndoRedo(page, 'undo');
      const u = await snap(page, `3 after Undo (${how})`, log);
      const words = ['river', 'shiver'];
      rec(`${LABEL}.S1.textBack`, 'Undo after the session import returns A\'s text exactly as it stood after the .txt import', 'draft === draft after step 1', { equal: u.text === a.text, head: u.head }, u.text === a.text);
      rec(`${LABEL}.S1.cardAfterA`, 'the .txt import of A shows a renumbered card', 'card lists river/shiver (cand only)', { words: a.card.words, dom: a.card.domDismissButtons }, null);
      rec(`${LABEL}.S1.cardAtImport`, 'card right after the session import', 'informational', { words: q.card.words, dom: q.card.domDismissButtons, ui: q.card.uiKeys }, null);
      rec(`${LABEL}.S1.cardAfterUndo`, "after Undo, A's text is back with A's card (claim c4)", 'card lists river, shiver (and the Review pane shows it)', { words: u.card.words, dom: u.card.domDismissButtons, ui: u.card.uiKeys, brief: u.card.brief }, words.every((w) => u.card.words.includes(w)) && u.card.domDismissButtons > 0);
      rec(`${LABEL}.S1.migratedRowsKept`, "the text Undo restores is A's migrated text (rows marked — cut v2 or renumbered), so no later boundary re-creates the card", 'informational', { rows: u.text.split('\n').filter((l) => l.startsWith('[SETUP — rhyme') || l.startsWith('[SETUP — reading')) }, null);
      let st = await allStorage(page);
      log.push({ tag: 'storage after Undo', evidence: evidenceOf(st, words), history: st.history, idb: st.idb });
      rec(`${LABEL}.S1.evidenceAnywhere`, "after the Undo, A's renumbering evidence is held anywhere on the device (localStorage, sessionStorage, IndexedDB drafts)", 'informational', evidenceOf(st, words), null);
      await clickUndoRedo(page, 'redo');
      await snap(page, '4 after Redo', log);
      await clickUndoRedo(page, 'undo');
      await snap(page, '5 after Undo again', log);
      await page.waitForTimeout(800);
      await page.reload();
      await ready(page);
      const r = await snap(page, '6 after reload', log);
      rec(`${LABEL}.S1.afterReload`, 'after a reload (an open boundary) the card is still absent: A\'s rows are already migrated so nothing re-creates it', 'informational', { words: r.card.words, dom: r.card.domDismissButtons, head: r.head }, null);
    });
    // S2: Undo alone does not remove the card: .txt A -> .txt Q (no card of its own) -> Undo.
    await scen('S2', async (ctx, log) => {
      const page = await openPage(ctx, url, errs);
      await importTxt(page, 'alpha.txt', A, 'Alpha River');
      await snap(page, '1 after .txt A', log);
      await importTxt(page, 'quiet.txt', Q, 'Quiet Field');
      const q = await snap(page, '2 after .txt Q', log);
      await clickUndoRedo(page, 'undo');
      const u = await snap(page, '3 after Undo', log);
      rec(`${LABEL}.S2.txtThenUndo`, '.txt A -> .txt Q -> Undo: A text and the card (control: the loss needs the session import)', 'card lists river, shiver', { head: u.head, words: u.card.words, atQ: q.card.words }, ['river', 'shiver'].every((w) => u.card.words.includes(w)));
    });
    // S3: the session file carries its OWN card (exported by the page after
    // .txt C), so after Undo the card belongs to C while the text is A.
    await scen('S3', async (ctx, log) => {
      const p0 = await openPage(ctx, url, errs);
      await importTxt(p0, 'cello.txt', C, 'Cello Cobra');
      await snap(p0, '0 exporter page after .txt C', log);
      const [dl] = await Promise.all([p0.waitForEvent('download'), p0.evaluate(() => uiExport())]);
      const f = path.join(OUT, `c_session_${LABEL}.json`);
      await dl.saveAs(f);
      await p0.close();
      const ctx2 = await ctxOf(browser);
      const page = await openPage(ctx2, url, errs);
      await importTxt(page, 'alpha.txt', A, 'Alpha River');
      await snap(page, '1 after .txt A', log);
      await importSession(page, f, 'Cello Cobra');
      const c = await snap(page, '2 after session import C (with its card)', log);
      await clickUndoRedo(page, 'undo');
      const u = await snap(page, '3 after Undo', log);
      rec(`${LABEL}.S3.sessionCarriesCard`, "a session file exported after C's import carries C's card into the importing page", 'card lists cello, yellow', c.card.words, null);
      rec(`${LABEL}.S3.undoMismatch`, "after Undo the text is A's but the card is C's (lists words that are not in the draft)", 'informational', { head: u.head, words: u.card.words, cInDraft: ['cello', 'yellow'].map((w) => u.text.includes(w)) }, null);
      await ctx2.close();
    });
    // S4: A as a Library working copy (a draft in IndexedDB), then the session
    // import and Undo; then reopen A's draft from History.
    await scen('S4', async (ctx, log) => {
      const page = await openPage(ctx, url, errs);
      const env = await page.evaluate(async (t) => {
        if (typeof CMLibraryImport === 'undefined' || !CMLibraryImport.makeWorkingCopyEnvelope) return null;
        const meta = { version: 1, brief: '', notes: {}, drafts: {}, ui: {}, libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title: 'Alpha River', language: 'eng', scope: 'whole', provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' }, lineage: [], declarations: [] } };
        return CMLibraryImport.makeWorkingCopyEnvelope(t, meta);
      }, A);
      if (!env) {
        rec(`${LABEL}.S4.skip`, 'no Library working-copy helper on this page', 'n/a', null, null);
        return;
      }
      const f = path.join(OUT, `a_env_${LABEL}.json`);
      fs.writeFileSync(f, JSON.stringify(env, null, 2));
      await page.setInputFiles('#ly-file', f);
      await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
      await page.waitForTimeout(1500);
      await snap(page, '1 after Library A', log);
      let st0 = await allStorage(page);
      log.push({ tag: 'idb after Library A', idb: st0.idb });
      console.log('   idb after Library A', JSON.stringify(st0.idb));
      await importSession(page, path.join(OUT, 'q_session.json'), 'Quiet Field');
      await snap(page, '2 after session import Q', log);
      await page.waitForTimeout(1200);
      st0 = await allStorage(page);
      log.push({ tag: 'idb after session import', idb: st0.idb });
      console.log('   idb after session import', JSON.stringify(st0.idb));
      await clickUndoRedo(page, 'undo');
      const u = await snap(page, '3 after Undo', log);
      await page.waitForTimeout(1200);
      const st = await allStorage(page);
      log.push({ tag: 'idb after Undo', idb: st.idb });
      console.log('   idb after Undo', JSON.stringify(st.idb));
      rec(`${LABEL}.S4.undo`, 'Library A -> session import -> Undo: card after Undo', 'informational', { head: u.head, words: u.card.words, draftId: u.card.draftId, envDraft: env.draftId, idb: st.idb }, null);
      // Reopen A's draft from History.
      await page.evaluate(() => LY_ACTIONS['ly-tab']('history'));
      await page.waitForTimeout(600);
      const sel = `button[data-ui="ly-library-restore"][data-id="${env.draftId}"]`;
      const n = await page.locator(sel).count();
      let reopened = null;
      if (n) {
        await page.click(sel);
        await page.waitForTimeout(2000);
        reopened = await snap(page, '4 after reopening A from History', log);
      }
      rec(`${LABEL}.S4.reopen`, "reopening A's Library draft from History brings A's card back", 'informational', { restoreButton: n, words: reopened && reopened.card.words, head: reopened && reopened.head }, null);
    });
    // S5: the other open path: a saved session loaded from Saved sessions.
    await scen('S5', async (ctx, log) => {
      const page = await openPage(ctx, url, errs);
      await importTxt(page, 'quiet.txt', Q, 'Quiet Field');
      await page.evaluate(() => saveWS('Quiet saved'));
      await page.waitForTimeout(1200);
      const key = await page.evaluate(async () => {
        const r = await window.storage.get('codex:list');
        const l = JSON.parse((r && r.value) || '[]');
        return (l.find((x) => x.name === 'Quiet saved') || {}).key || null;
      });
      await toasts(page);
      await importTxt(page, 'alpha.txt', A, 'Alpha River');
      await snap(page, '1 after .txt A', log);
      if (!key) {
        rec(`${LABEL}.S5.skip`, 'saved session not found', 'n/a', null, null);
        return;
      }
      await page.evaluate((k) => loadWS(k), key);
      await page.waitForFunction(() => document.getElementById('lyrics-draft').value.includes('Quiet Field'), null, { timeout: 20000 });
      await page.waitForTimeout(900);
      await snap(page, '2 after loading the saved session', log);
      await clickUndoRedo(page, 'undo');
      const u = await snap(page, '3 after Undo', log);
      rec(`${LABEL}.S5.savedLoadUndo`, 'saved-session load then Undo: A text back; card?', 'informational', { head: u.head, words: u.card.words }, null);
    });

    // S6/S7: where A's card is destroyed on the Library path: by the session
    // import, or by the Undo that follows it.
    const libA = async (page) => {
      const env = await page.evaluate(async (t) => {
        const meta = { version: 1, brief: '', notes: {}, drafts: {}, ui: {}, libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title: 'Alpha River', language: 'eng', scope: 'whole', provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' }, lineage: [], declarations: [] } };
        return CMLibraryImport.makeWorkingCopyEnvelope(t, meta);
      }, A);
      const f = path.join(OUT, `a_env_${LABEL}_2.json`);
      fs.writeFileSync(f, JSON.stringify(env, null, 2));
      await page.setInputFiles('#ly-file', f);
      await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
      await page.waitForTimeout(1500);
      return env;
    };
    const restore = async (page, id) => {
      await page.evaluate(() => LY_ACTIONS['ly-tab']('history'));
      await page.waitForTimeout(600);
      const sel = `button[data-ui="ly-library-restore"][data-id="${id}"]`;
      if (!(await page.locator(sel).count())) return false;
      await page.click(sel);
      await page.waitForFunction((d) => app.lyricMeta.draftId === d, id, { timeout: 20000 });
      await page.waitForTimeout(1500);
      return true;
    };
    const idbA = async (page, id) => ((await allStorage(page)).idb.find((d) => d.draftId === id) || {}).renumbered;
    await scen('S6', async (ctx, log) => {
      const page = await openPage(ctx, url, errs);
      const env = await libA(page);
      await snap(page, '1 after Library A', log);
      await importSession(page, path.join(OUT, 'q_session.json'), 'Quiet Field');
      await snap(page, '2 after session import Q', log);
      await page.waitForTimeout(4000);
      const r2 = await idbA(page, env.draftId);
      console.log('   IDB A after session import + 4 s:', JSON.stringify(r2));
      const ok = await restore(page, env.draftId);
      const s = await snap(page, '3 after opening A from History (no Undo)', log);
      rec(`${LABEL}.S6.noUndo`, "Library A -> session import -> open A's draft from History (no Undo): A's card is back", 'river, shiver', { idbAAfterImport: r2 && r2.items.map((m) => m.word), opened: ok, words: s.card.words, head: s.head }, ok && ['river', 'shiver'].every((w) => s.card.words.includes(w)));
    });
    await scen('S7', async (ctx, log) => {
      const page = await openPage(ctx, url, errs);
      const env = await libA(page);
      await snap(page, '1 after Library A', log);
      await importSession(page, path.join(OUT, 'q_session.json'), 'Quiet Field');
      await snap(page, '2 after session import Q', log);
      await page.waitForTimeout(4000);
      const before = await idbA(page, env.draftId);
      const qid = await page.evaluate(() => app.lyricMeta.draftId || null);
      await clickUndoRedo(page, 'undo');
      await snap(page, '3 after Undo', log);
      await page.waitForTimeout(4000);
      const after = await idbA(page, env.draftId);
      console.log('   IDB A before Undo:', JSON.stringify(before), ' after Undo + 4 s:', JSON.stringify(after), ' Q draftId:', qid);
      rec(`${LABEL}.S7.undoErasesStored`, "the Undo (not the session import) erases A's card from A's stored Library draft", 'informational', { beforeUndo: before && before.items.map((m) => m.word), afterUndo: after && after.items.map((m) => m.word) }, null);
      const stU = await allStorage(page);
      const qRec = Array.isArray(stU.idb) ? stU.idb.find((d) => d.head && d.head.includes('Quiet Field')) : null;
      rec(`${LABEL}.S7.evidenceAnywhere`, "after the Undo, A's card evidence held anywhere on the device (localStorage, sessionStorage, IndexedDB)", 'informational', { hits: evidenceOf(stU, ['river', 'shiver']), idb: stU.idb }, null);
      let ok1 = qRec ? await restore(page, qRec.draftId) : false;
      await snap(page, '4 after opening Q from History', log);
      const ok2 = await restore(page, env.draftId);
      const s = await snap(page, '5 after opening A from History again', log);
      rec(`${LABEL}.S7.gone`, "after the Undo, reopening A's draft from History no longer brings A's card back", 'informational', { openedQ: ok1, openedA: ok2, words: s.card.words, head: s.head }, null);
    });
  } finally {
    out.pageErrors = errs;
    out.results = results;
    fs.writeFileSync(path.join(OUT, `v5_${LABEL}${ONLY.length ? '_' + ONLY.join('_') : ''}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
