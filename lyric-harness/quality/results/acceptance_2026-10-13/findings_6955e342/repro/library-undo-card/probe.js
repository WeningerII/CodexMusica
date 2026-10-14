// BB8 acceptance probe, label library-undo-card. Scratch only.
// Claim under test (tester at 6955e342): .txt import of draft A (renumbers,
// card not dismissed) -> Library working-copy import B (renumbers) -> app
// Undo: draft returns to A's text + A's draftId, but the card lists B's
// entries and the persist overwrites A's stored draft record with B's
// entries (A's evidence lost, even after reload). Also: session import ->
// Undo returns A's migrated text with no card.
// Usage: node probe.js <cand|prev|main> <scenario[,scenario...]>
// Serves the CODEX_LIBRARY=1 build in ./build-<tree>/ for /codex.html (and its
// library/ chunks), everything else from the tree root. mcp.codexmusica.com is
// routed to an in-process stub; nothing reaches a provider or the network.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/library-undo-card');
const TREES = { cand: 'wt-695', prev: 'wt-61b', main: 'wt-main' };
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREE = process.argv[2] || 'cand';
const SCEN = (process.argv[3] || 'undo_button').split(',');
const ROOT = path.join(S, TREES[TREE]);
const BUILD = path.join(OUT, 'build-' + TREES[TREE]);
const BUILT = path.join(BUILD, `built-${TREES[TREE]}.html`);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2' };
function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') p = '/__BUILT__';
    let f = p === '/__BUILT__' ? BUILT : path.join(BUILD, p);
    if (p !== '/__BUILT__' && (!f.startsWith(BUILD) || !fs.existsSync(f) || fs.statSync(f).isDirectory())) f = path.join(ROOT, p);
    if (!(f.startsWith(ROOT) || f.startsWith(BUILD)) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
// ── Fixtures ────────────────────────────────────────────────────────────
// A: rhyme link on heart/part, numbered under the earlier cut (v1 T4 = heart;
// the current cut splits "Ah--ah" so the same characters are T5).
const A = ['[SETUP — title — "Song A"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Ah--ah, ah my heart is burning', 'Ah--ah, ah my part is turning'].join('\n');
// B: declared returns on love/dove, same shape, distinct words.
const B = ['[SETUP — title — "Song B"]', '[SETUP — returns — 1.T4,2.T4]', '', '[VERSE]', 'Oh--oh, oh sweet love', 'Oh--oh, oh sweet dove'].join('\n');
// Session S0: renumbers nothing. Session S1: renumbers gold/road.
const S0 = ['[SETUP — title — "Song Quiet"]', '[SETUP — rhyme groups — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
const S1 = ['[SETUP — title — "Song S"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Eh--eh, eh my gold is shining', 'Eh--eh, eh my road is winding'].join('\n');
const WORDS = { A: ['heart', 'part'], B: ['love', 'dove'], S1: ['gold', 'road'] };
// ── Page helpers ────────────────────────────────────────────────────────
async function newCtx(browser, q) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      await new Promise((res) => setTimeout(res, 60));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  await ctx.addInitScript(() => {
    window.__toastLog = [];
    const mo = new MutationObserver(() => {
      const t = document.getElementById('toast');
      if (!t) return;
      const txt = t.innerText;
      if (txt && window.__toastLog[window.__toastLog.length - 1] !== txt) window.__toastLog.push(txt);
    });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  return ctx;
}
const waitReady = (page) => page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
const draftOf = (page) => page.evaluate(() => $ui('lyrics-draft').value);
async function importTxt(page, name, text, marker) {
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction((m) => $ui('lyrics-draft').value.includes(m), marker, { timeout: 20000 });
  await page.waitForTimeout(1200);
}
// A Library working copy made by the page's own envelope function, imported
// through the Lyrics page's file input as a .json file.
async function importLibrary(page, text, title, file) {
  const env = await page.evaluate(async ([t, title]) => {
    const meta = { version: 1, brief: '', notes: {}, drafts: {}, ui: {}, libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title, language: 'eng', scope: 'whole', provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' }, lineage: [], declarations: [] } };
    return CMLibraryImport.makeWorkingCopyEnvelope(t, meta);
  }, [text, title]);
  fs.writeFileSync(file, JSON.stringify(env, null, 2));
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return env;
}
async function importSession(page, lyrics, name, file) {
  const s = { version: 3, name, cards: [], lyrics, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: {} } };
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
  await page.setInputFiles('#ui-file', file);
  await page.waitForFunction((n) => app.workspaceName === n, name, { timeout: 30000 });
  await page.waitForTimeout(1500);
}
// APP history Undo/Redo: the page's own header button (a real mouse click),
// or the page's own keyboard shortcut with focus outside any text field.
async function appUndoButton(page) {
  const vis = await page.locator('#btn-undo').isVisible().catch(() => false);
  if (vis) await page.locator('#btn-undo').click();
  else {
    const proxy = page.locator('[data-ui="undo"]:visible, [data-proxy="btn-undo"]:visible').first();
    if (await proxy.count()) await proxy.click();
    else throw new Error('no visible Undo control');
  }
  return vis ? '#btn-undo (header, mouse click)' : 'visible [data-ui=undo] proxy (mouse click)';
}
async function appUndoKeyboard(page) {
  await page.evaluate(() => {
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
  });
  const active = await page.evaluate(() => (document.activeElement || {}).tagName);
  await page.keyboard.press('Control+z');
  return `Ctrl+Z with document.activeElement=${active}`;
}
// BROWSER-NATIVE undo: Ctrl+Z with the song textarea focused (the page's
// shortcut handler returns early for a TEXTAREA target).
async function nativeUndo(page) {
  await page.evaluate(() => $ui('lyrics-draft').focus());
  const before = await draftOf(page);
  const ev = await page.evaluate(() => {
    window.__inputs = 0;
    $ui('lyrics-draft').addEventListener('input', () => window.__inputs++, { once: false });
    return document.activeElement === $ui('lyrics-draft');
  });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  const after = await draftOf(page);
  const inputs = await page.evaluate(() => window.__inputs);
  return { focusedTextarea: ev, changedText: before !== after, inputEvents: inputs };
}
// Everything the protocol asks to retain, read from the page and its storage.
async function snap(page, tag) {
  return page.evaluate(async (tag) => {
    const safe = (f) => {
      try {
        return f();
      } catch (e) {
        return 'ERR ' + e.message;
      }
    };
    const d = $ui('lyrics-draft');
    if (typeof lyRefresh === 'function') lyRefresh(true);
    const item = (LY.items || []).find((x) => x.id === 'renumbered') || null;
    let reviewPane = null;
    try {
      LY_ACTIONS['ly-tab']('review');
      reviewPane = $ui('ly-panel-review').innerText;
    } catch (e) {
      reviewPane = 'ERR ' + e.message;
    }
    const cardShown = reviewPane && /renumbered to the current word cut/.test(reviewPane);
    let historyPane = null;
    try {
      LY_ACTIONS['ly-tab']('history');
      historyPane = $ui('ly-panel-history').innerText;
      LY_ACTIONS['ly-tab']('review');
    } catch (e) {
      historyPane = 'ERR ' + e.message;
    }
    const ls = safe(() => {
      const s = JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}');
      return { lyrics: s.lyrics, draftId: s.lyricMeta && s.lyricMeta.draftId, ui: s.lyricMeta && s.lyricMeta.ui, libraryOrigin: !!(s.lyricMeta && s.lyricMeta.libraryOrigin), name: s.name };
    });
    let idb = [];
    try {
      const store = typeof lyLibraryStore !== 'undefined' && lyLibraryStore ? lyLibraryStore : typeof CMLibraryImport !== 'undefined' ? CMLibraryImport.createIndexedDBStore() : null;
      const list = store ? await store.listDrafts() : [];
      for (const x of list) {
        const full = await store.getDraft(x.draftId);
        idb.push({ draftId: x.draftId, title: full && full.title, text: full && full.text, savedAt: full && full.savedAt, metaDraftId: full && full.meta && full.meta.draftId, ui: full && full.meta && full.meta.ui, libraryOrigin: !!(full && full.meta && full.meta.libraryOrigin), originalTextHead: full && full.originalText ? full.originalText.split('\n')[0] : null });
      }
    } catch (e) {
      idb = 'ERR ' + e.message;
    }
    return {
      tag,
      text: d.value,
      title: (d.value.split('\n')[0] || ''),
      draftId: (app.lyricMeta && app.lyricMeta.draftId) || null,
      libraryOrigin: !!(app.lyricMeta && app.lyricMeta.libraryOrigin),
      ui: app.lyricMeta && app.lyricMeta.ui ? JSON.parse(JSON.stringify(app.lyricMeta.ui)) : null,
      card: item ? { title: item.title, text: item.text } : null,
      cardShownInReviewPane: !!cardShown,
      reviewPaneCardText: cardShown ? (reviewPane.split('\n').filter((l) => /renumbered|word \d+ → \d+/.test(l)).join(' | ')) : null,
      historyPane,
      appHistory: app.history.map((h, i) => {
        const s = JSON.parse(h);
        return { i, title: (s.lyrics || '').split('\n')[0], draftId: (s.lyricMeta && s.lyricMeta.draftId) || null, hasUi: !!(s.lyricMeta && s.lyricMeta.ui), current: i === app.historyIndex };
      }),
      historyIndex: app.historyIndex,
      localStorage: ls,
      idb,
      toasts: window.__toastLog.splice(0),
    };
  }, tag);
}
const words = (ui) => ((ui && ui.renumbered && ui.renumbered.items) || []).map((m) => m.word);
function brief(s) {
  const idb = Array.isArray(s.idb) ? s.idb.map((r) => `${r.draftId.slice(0, 14)}…[${(r.text || '').split('\n')[0].replace('[SETUP — title — ', '')}] ui.renumbered=${JSON.stringify(words(r.ui))}`) : s.idb;
  return {
    tag: s.tag,
    draft: s.title.replace('[SETUP — title — ', ''),
    draftId: s.draftId,
    cardWords: words(s.ui),
    cardShown: s.cardShownInReviewPane,
    ls: s.localStorage && { title: (s.localStorage.lyrics || '').split('\n')[0].replace('[SETUP — title — ', ''), draftId: s.localStorage.draftId, words: words(s.localStorage.ui) },
    idb,
    hist: s.appHistory.map((h) => `${h.current ? '*' : ''}${h.title.replace('[SETUP — title — ', '') || '(empty)'}${h.draftId ? '@' + h.draftId.slice(6, 14) : ''}`).join(' > '),
  };
}
async function boot(browser, base, q) {
  const ctx = await newCtx(browser, q);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await waitReady(page);
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}
async function reload(page) {
  await page.reload();
  await waitReady(page);
  await page.waitForTimeout(2500);
}
async function restoreFromHistory(page, draftId) {
  await page.evaluate(() => LY_ACTIONS['ly-tab']('history'));
  await page.waitForTimeout(500);
  const sel = `button[data-ui="ly-library-restore"][data-id="${draftId}"]`;
  if (!(await page.locator(sel).count())) return false;
  await page.click(sel);
  await page.waitForFunction((id) => app.lyricMeta.draftId === id, draftId, { timeout: 20000 });
  await page.waitForTimeout(1500);
  return true;
}
async function sendEdit(page, q) {
  const n = q.calls.length;
  await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
  await page.waitForTimeout(250);
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  await page.keyboard.type('Tighten line 2', { delay: 5 });
  // The dock's own Ask button (form submit); Enter in the dock textarea
  // inserts a newline and does not submit.
  await page.locator('#chat-send').click();
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);
  const call = q.calls.slice(n)[0] || null;
  const model = await page.evaluate(() => {
    const m = lyParse($ui('lyrics-draft').value);
    return { sung: m.sung.map((s) => s.text) };
  });
  return { focused, reached: q.calls.length - n, lyric_context: call && call.lyric_context, task: call && call.task, pageSung: model.sung };
}
// Every place A's evidence could still live: all localStorage keys and every
// object store of every IndexedDB database on this origin, searched for a
// card entry naming the word (the card stores {"word":"heart",...}).
async function searchStorage(page, needles) {
  return page.evaluate(async (needles) => {
    const hits = {};
    for (const n of needles) hits[n] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i), v = localStorage.getItem(k) || '';
      for (const n of needles) if (v.includes(`"word":"${n}"`)) hits[n].push('localStorage:' + k);
    }
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const { name } of dbs) {
      const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      for (const st of Array.from(db.objectStoreNames)) {
        const all = await new Promise((res, rej) => { const tx = db.transaction(st, 'readonly'); const r = tx.objectStore(st).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        all.forEach((rec, j) => { const v = JSON.stringify(rec); for (const n of needles) if (v.includes(`"word":"${n}"`)) hits[n].push(`idb:${name}/${st}[${j}]${rec && rec.draftId ? ' ' + rec.draftId : ''}`); });
      }
      db.close();
    }
    return { dbs: dbs.map((d) => d.name), hits };
  }, needles);
}
// ── Scenarios ───────────────────────────────────────────────────────────
const SCENARIOS = {
  // Main claim, APP Undo by the header button; then reload; then reopen B and
  // A from the History list.
  async undo_button(browser, base, out, f) {
    const q = { calls: [] };
    const { ctx, page, errors } = await boot(browser, base, q);
    const steps = [];
    steps.push(await snap(page, '0 fresh page'));
    await importTxt(page, 'a.txt', A, 'Song A');
    steps.push(await snap(page, '1 after .txt import A (= before import B)'));
    const envB = await importLibrary(page, B, 'Song B', path.join(OUT, `env_${TREE}_${f}_B.json`));
    steps.push(await snap(page, '2 after Library working-copy import B'));
    const how = await appUndoButton(page);
    await page.waitForTimeout(60);
    steps.push(await snap(page, `3a APP Undo via ${how}: +60ms`));
    await page.waitForTimeout(1800);
    steps.push(await snap(page, '3b APP Undo: +1.9s (persist timers elapsed)'));
    await reload(page);
    steps.push(await snap(page, '4 after reload'));
    const search4 = await searchStorage(page, [...WORDS.A, ...WORDS.B]);
    const idA = steps[3].draftId;
    const rB = await restoreFromHistory(page, envB.draftId);
    steps.push(await snap(page, `5 History: Open draft B (${rB})`));
    const rA = idA ? await restoreFromHistory(page, idA) : false;
    steps.push(await snap(page, `6 History: Open draft A again (${rA})`));
    const search6 = await searchStorage(page, [...WORDS.A, ...WORDS.B]);
    console.log('storage search after reload:', JSON.stringify(search4));
    console.log('storage search after reopening B then A:', JSON.stringify(search6));
    out[f] = { steps, errors, envB: envB.draftId, search4, search6 };
    await ctx.close();
  },
  // Same, APP Undo by the keyboard shortcut (focus outside a text field).
  async undo_kbd(browser, base, out, f) {
    const q = { calls: [] };
    const { ctx, page, errors } = await boot(browser, base, q);
    const steps = [];
    await importTxt(page, 'a.txt', A, 'Song A');
    steps.push(await snap(page, '1 after .txt import A (= before import B)'));
    await importLibrary(page, B, 'Song B', path.join(OUT, `env_${TREE}_${f}_B.json`));
    steps.push(await snap(page, '2 after Library working-copy import B'));
    const how = await appUndoKeyboard(page);
    await page.waitForTimeout(1900);
    steps.push(await snap(page, `3 APP Undo via ${how}: +1.9s`));
    await reload(page);
    steps.push(await snap(page, '4 after reload'));
    const search = await searchStorage(page, [...WORDS.A, ...WORDS.B, ...WORDS.S1]);
    console.log('storage search after reload:', JSON.stringify(search));
    out[f] = { steps, errors, search };
    await ctx.close();
  },
  // BROWSER-NATIVE Ctrl+Z inside the textarea, after import B; then APP Undo;
  // then native Ctrl+Z again; then reload.
  async native(browser, base, out, f) {
    const q = { calls: [] };
    const { ctx, page, errors } = await boot(browser, base, q);
    const steps = [];
    await importTxt(page, 'a.txt', A, 'Song A');
    steps.push(await snap(page, '1 after .txt import A (= before import B)'));
    await importLibrary(page, B, 'Song B', path.join(OUT, `env_${TREE}_${f}_B.json`));
    steps.push(await snap(page, '2 after Library working-copy import B'));
    const n1 = await nativeUndo(page);
    await page.waitForTimeout(1600);
    steps.push(await snap(page, `3 BROWSER-NATIVE Ctrl+Z in textarea after import B: ${JSON.stringify(n1)}`));
    const how = await appUndoButton(page);
    await page.waitForTimeout(1900);
    steps.push(await snap(page, `4 APP Undo via ${how}: +1.9s`));
    const n2 = await nativeUndo(page);
    await page.waitForTimeout(1600);
    steps.push(await snap(page, `5 BROWSER-NATIVE Ctrl+Z in textarea after APP Undo: ${JSON.stringify(n2)}`));
    await reload(page);
    steps.push(await snap(page, '6 after reload'));
    out[f] = { steps, errors, native: [n1, n2] };
    await ctx.close();
  },
  // Session import of another session (quiet: renumbers nothing), then Undo.
  async session_quiet(browser, base, out, f) {
    const q = { calls: [] };
    const { ctx, page, errors } = await boot(browser, base, q);
    const steps = [];
    await importTxt(page, 'a.txt', A, 'Song A');
    steps.push(await snap(page, '1 after .txt import A (= before session import)'));
    await importSession(page, S0, 'Session Quiet', path.join(OUT, `session_${TREE}_${f}.json`));
    steps.push(await snap(page, '2 after session import (quiet session S0)'));
    const how = await appUndoButton(page);
    await page.waitForTimeout(1900);
    steps.push(await snap(page, `3 APP Undo via ${how}: +1.9s`));
    await reload(page);
    steps.push(await snap(page, '4 after reload'));
    const search = await searchStorage(page, [...WORDS.A, ...WORDS.B, ...WORDS.S1]);
    console.log('storage search after reload:', JSON.stringify(search));
    out[f] = { steps, errors, search };
    await ctx.close();
  },
  // Session import of a session that itself renumbers, then Undo.
  async session_mig(browser, base, out, f) {
    const q = { calls: [] };
    const { ctx, page, errors } = await boot(browser, base, q);
    const steps = [];
    await importTxt(page, 'a.txt', A, 'Song A');
    steps.push(await snap(page, '1 after .txt import A (= before session import)'));
    await importSession(page, S1, 'Session S', path.join(OUT, `session_${TREE}_${f}.json`));
    steps.push(await snap(page, '2 after session import (session S1, renumbers gold/road)'));
    const how = await appUndoButton(page);
    await page.waitForTimeout(1900);
    steps.push(await snap(page, `3 APP Undo via ${how}: +1.9s`));
    await reload(page);
    steps.push(await snap(page, '4 after reload'));
    const search = await searchStorage(page, [...WORDS.A, ...WORDS.B, ...WORDS.S1]);
    console.log('storage search after reload:', JSON.stringify(search));
    out[f] = { steps, errors, search };
    await ctx.close();
  },
  // Are the card's line/word numbers remapped after an edit? Type a new
  // sung line above line 1 (real keyboard, no boundary), then read the card.
  async coords(browser, base, out, f) {
    const q = { calls: [] };
    const { ctx, page, errors } = await boot(browser, base, q);
    const steps = [];
    await importTxt(page, 'a.txt', A, 'Song A');
    steps.push(await snap(page, '1 after .txt import A'));
    const at = await page.evaluate(() => {
      const d = $ui('lyrics-draft');
      const i = d.value.indexOf('Ah--ah, ah my heart');
      d.focus();
      d.setSelectionRange(i, i);
      return i;
    });
    await page.keyboard.type('A brand new opening line', { delay: 5 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    await page.evaluate(() => $ui('lyrics-draft').blur());
    await page.waitForTimeout(1500);
    const s = await snap(page, `2 typed a new sung line above line 1 (caret at ${at}), then blur`);
    s.pageSung = await page.evaluate(() => lyParse($ui('lyrics-draft').value).sung.map((x) => `${x.n}: ${x.text}`));
    steps.push(s);
    out[f] = { steps, errors };
    await ctx.close();
  },
  // Payload: what /chat receives at each point (fresh context per point).
  async payload(browser, base, out, f) {
    const res = {};
    for (const point of ['P1_A_before_B', 'P2_after_B', 'P3_after_app_undo']) {
      const q = { calls: [] };
      const { ctx, page, errors } = await boot(browser, base, q);
      await importTxt(page, 'a.txt', A, 'Song A');
      if (point !== 'P1_A_before_B') await importLibrary(page, B, 'Song B', path.join(OUT, `env_${TREE}_${f}_${point}_B.json`));
      if (point === 'P3_after_app_undo') {
        await appUndoButton(page);
        await page.waitForTimeout(1900);
      }
      const pre = await snap(page, `${point}: before send`);
      const sent = await sendEdit(page, q);
      const post = await snap(page, `${point}: after send`);
      res[point] = { pre, sent, post, errors };
      await ctx.close();
    }
    out[f] = res;
  },
  // Side check: does a focus/blur of the song (no edit) after a migrating
  // Library import add an Undo step? Paired with a quiet (non-migrating) copy.
  async extra_step(browser, base, out, f) {
    const res = {};
    const BQ = ['[SETUP — title — "Song BQ"]', '[SETUP — returns — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
    for (const [k, text] of [['B_migrating', B], ['BQ_quiet', BQ]]) {
      const q = { calls: [] };
      const { ctx, page, errors } = await boot(browser, base, q);
      await importTxt(page, 'a.txt', A, 'Song A');
      await importLibrary(page, text, k, path.join(OUT, `env_${TREE}_${f}_${k}.json`));
      const hist = () => page.evaluate(() => ({ idx: app.historyIndex, steps: app.history.map((h) => { const s = JSON.parse(h); return { title: (s.lyrics || '').split('\n')[0], draftId: (s.lyricMeta && s.lyricMeta.draftId) || null, adapted: s.lyricMeta && s.lyricMeta.libraryOrigin ? s.lyricMeta.libraryOrigin.adapted : null }; }), liveAdapted: app.lyricMeta.libraryOrigin ? app.lyricMeta.libraryOrigin.adapted : null }));
      const h0 = await hist();
      await page.click('#lyrics-draft');
      await page.waitForTimeout(200);
      await page.evaluate(() => $ui('lyrics-draft').blur());
      await page.waitForTimeout(800);
      const h1 = await hist();
      await appUndoButton(page);
      await page.waitForTimeout(1500);
      const t1 = (await draftOf(page)).split('\n')[0];
      await appUndoButton(page);
      await page.waitForTimeout(1500);
      const t2 = (await draftOf(page)).split('\n')[0];
      res[k] = { afterImport: h0, afterClickBlur: h1, afterUndo1: t1, afterUndo2: t2, errors };
      console.log(k, JSON.stringify(res[k]));
      await ctx.close();
    }
    out[f] = res;
  },
};
(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: TREE, dir: TREES[TREE], built: BUILT };
  try {
    for (const f of SCEN) {
      console.log(`\n## ${TREE} ${f}`);
      try {
        await SCENARIOS[f](browser, base, out, f);
        const r = out[f];
        if (r && r.steps) for (const s of r.steps) console.log(JSON.stringify(brief(s)));
        if (r && r.errors && r.errors.length) console.log('PAGE ERRORS', r.errors);
        if (f === 'payload')
          for (const [k, v] of Object.entries(r)) console.log(k, JSON.stringify({ pre: brief(v.pre), reached: v.sent.reached, decl: v.sent.lyric_context && v.sent.lyric_context.declarations, errors: v.errors }));
      } catch (e) {
        out[f] = { threw: String((e && e.stack) || e) };
        console.log('THREW', out[f].threw);
      }
    }
  } finally {
    fs.writeFileSync(path.join(OUT, `${TREE}_${SCEN.join('+')}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
