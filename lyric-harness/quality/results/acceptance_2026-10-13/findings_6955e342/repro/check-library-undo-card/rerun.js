// BB8 independent re-run, label check-library-undo-card. Scratch only; written
// from scratch (not a copy of ../library-undo-card/probe.js).
// Usage: node rerun.js <cand|prev|main> <scenario[,scenario...]> [fixture=AB|XY]
//
// Differences from the original probe, on purpose:
// - snapshots are PASSIVE: they read the DOM, app/LY state, localStorage,
//   sessionStorage and IndexedDB (raw, through indexedDB.open), and never call
//   a page function (no lyRefresh, no LY_ACTIONS), so a persist the snapshot
//   itself provokes cannot be mistaken for the page's own;
// - the Review tab is opened by a real mouse click, and the card text is read
//   from the rendered Review panel (plus LY.items for the structured copy);
// - APP Undo is the workbench header's own Undo (#ui-undo, data-ui="undo",
//   mouse click) or Ctrl+Z with focus on BODY (app.js keydown handler);
// - Library envelopes are built OUTSIDE the page, in Node, by each tree's own
//   src/library-import.js makeWorkingCopyEnvelope (webcrypto), and imported
//   through the Lyrics page's file input (#ly-file);
// - a second fixture pair (XY: fire/wire, rain/pain) repeats the main claim
//   with different words.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { webcrypto } = require('crypto');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/check-library-undo-card');
const TREES = { cand: 'wt-695', prev: 'wt-61b', main: 'wt-main' };
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREE = process.argv[2] || 'cand';
const SCEN = (process.argv[3] || 'undo_mouse').split(',');
const FIX = process.argv[4] || 'AB';
const ROOT = path.join(S, TREES[TREE]);
const BUILD = path.join(OUT, 'build-' + TREES[TREE]);
const BUILT = path.join(BUILD, `built-${TREES[TREE]}.html`);
const LI = require(path.join(ROOT, 'src/library-import.js'));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function server() {
  return http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    let f;
    if (p === '/' || p === '/codex.html') f = BUILT;
    else {
      const b = path.join(BUILD, p);
      f = b.startsWith(BUILD + path.sep) && fs.existsSync(b) && fs.statSync(b).isFile() ? b : path.join(ROOT, p);
    }
    const ok = (f === BUILT || f.startsWith(BUILD + path.sep) || f.startsWith(ROOT + path.sep)) && fs.existsSync(f) && fs.statSync(f).isFile();
    if (!ok) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────
// Each song's setup row numbers its words under the earlier cut (T4); the
// current cut splits the doubled interjection, so the same characters are T5.
const FIXTURES = {
  AB: {
    A: ['[SETUP — title — "Song A"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Ah--ah, ah my heart is burning', 'Ah--ah, ah my part is turning'].join('\n'),
    B: ['[SETUP — title — "Song B"]', '[SETUP — returns — 1.T4,2.T4]', '', '[VERSE]', 'Oh--oh, oh sweet love', 'Oh--oh, oh sweet dove'].join('\n'),
    wA: ['heart', 'part'],
    wB: ['love', 'dove'],
  },
  XY: {
    A: ['[SETUP — title — "Song X"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Ay--ay, ay my fire is rising', 'Ay--ay, ay my wire is singing'].join('\n'),
    B: ['[SETUP — title — "Song Y"]', '[SETUP — returns — 1.T4,2.T4]', '', '[VERSE]', 'Oo--oo, oo the rain', 'Oo--oo, oo the pain'].join('\n'),
    wA: ['fire', 'wire'],
    wB: ['rain', 'pain'],
  },
};
const FX = FIXTURES[FIX];
// Sessions: S0 renumbers nothing; S1 renumbers gold/road.
const S0 = ['[SETUP — title — "Song Quiet"]', '[SETUP — rhyme groups — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
const S1 = ['[SETUP — title — "Song S"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Eh--eh, eh my gold is shining', 'Eh--eh, eh my road is winding'].join('\n');
const W_S1 = ['gold', 'road'];

// A Library working copy built in Node by this tree's own library-import.js.
async function envelopeFile(text, title, tag) {
  const meta = {
    version: 1,
    brief: '',
    notes: {},
    drafts: {},
    ui: {},
    libraryOrigin: {
      version: 1,
      handoffId: 'handoff:' + webcrypto.randomUUID(),
      digest: 'a'.repeat(64),
      adapted: false,
      title,
      language: 'eng',
      scope: 'whole',
      provenance: { snapshotId: 'snap:r1', unitId: 'unit:r1', workId: 'work:r1', editionId: 'ed:r1', revisionId: 'rev:r1' },
      lineage: [],
      declarations: [],
    },
  };
  const env = await LI.makeWorkingCopyEnvelope(text, meta, webcrypto);
  const file = path.join(OUT, `env_${TREE}_${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(env, null, 2));
  return { env, file };
}

// ── Browser ───────────────────────────────────────────────────────────────
async function open(browser, base) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    const req = r.request();
    if (req.method() === 'POST' && /\/chat(\?|$)/.test(req.url())) {
      let body = null;
      try {
        body = JSON.parse(req.postData() || 'null');
      } catch (e) {
        body = { unparsable: req.postData() };
      }
      calls.push({ url: req.url(), body });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Stub reply.', history: [], sig: 'stub' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
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
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`${base}/codex.html#lyrics`);
  await ready(page);
  await page.waitForTimeout(600);
  return { ctx, page, calls, errors };
}
const ready = (page) => page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model && !!document.getElementById('lyrics-draft'), null, { timeout: 90000 });
const text = (page) => page.evaluate(() => document.getElementById('lyrics-draft').value);

async function clickTab(page, id) {
  const sel = `#ly-tab-${id}`;
  await page.locator(sel).click();
  await page.waitForTimeout(350);
}

// PASSIVE snapshot: reads only.
async function peek(page, tag) {
  return page.evaluate(async (tag) => {
    const d = document.getElementById('lyrics-draft');
    const lm = app.lyricMeta || {};
    const parse = (s) => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    };
    const lsRaw = localStorage.getItem('codex-workbench-v1');
    const ls = parse(lsRaw || 'null');
    const ssRaw = sessionStorage.getItem('codex-workbench-recovery');
    const ss = parse(ssRaw || 'null');
    const idb = [];
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const { name } of dbs) {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      for (const st of Array.from(db.objectStoreNames)) {
        const [keys, vals] = await new Promise((res, rej) => {
          const tx = db.transaction(st, 'readonly');
          const os = tx.objectStore(st);
          const k = os.getAllKeys();
          const v = os.getAll();
          tx.oncomplete = () => res([k.result, v.result]);
          tx.onerror = () => rej(tx.error);
        });
        keys.forEach((k, i) => {
          const v = vals[i];
          if (st === 'drafts')
            idb.push({ db: name, store: st, key: k, title: v && v.title, head: v && typeof v.text === 'string' ? v.text.split('\n')[0] : null, savedAt: v && v.savedAt, renumbered: v && v.meta && v.meta.ui && v.meta.ui.renumbered ? v.meta.ui.renumbered : null, origTextHead: v && v.originalText ? v.originalText.split('\n')[0] : null, hasOrigin: !!(v && v.meta && v.meta.libraryOrigin) });
        });
      }
      db.close();
    }
    const panel = document.getElementById('ly-panel-review');
    const panelText = panel && !panel.hidden ? panel.innerText : null;
    const cardLines = panelText ? panelText.split('\n').filter((l) => /renumbered to the current word cut|word \d+ → \d+/.test(l)) : null;
    const item = (LY.items || []).find((x) => x && x.id === 'renumbered') || null;
    return {
      tag,
      t: Date.now(),
      text: d.value,
      head: d.value.split('\n')[0],
      setupRows: d.value.split('\n').filter((l) => /^\[SETUP — (rhyme groups|returns)/.test(l)),
      draftId: lm.draftId || null,
      libraryOrigin: lm.libraryOrigin ? { title: lm.libraryOrigin.title, adapted: lm.libraryOrigin.adapted } : null,
      renumbered: lm.ui && lm.ui.renumbered ? JSON.parse(JSON.stringify(lm.ui.renumbered)) : null,
      lyTab: LY.tab,
      reviewPanelVisible: panelText !== null,
      reviewCardLines: cardLines,
      lyItemCard: item ? { title: item.title, text: item.text } : null,
      history: app.history.map((h, i) => {
        const s = parse(h) || {};
        return { i, head: (s.lyrics || '').split('\n')[0], draftId: (s.lyricMeta && s.lyricMeta.draftId) || null, adapted: s.lyricMeta && s.lyricMeta.libraryOrigin ? s.lyricMeta.libraryOrigin.adapted : null, hasUi: !!(s.lyricMeta && s.lyricMeta.ui), cur: i === app.historyIndex };
      }),
      localStorage: ls ? { head: (ls.lyrics || '').split('\n')[0], draftId: ls.lyricMeta && ls.lyricMeta.draftId, renumbered: ls.lyricMeta && ls.lyricMeta.ui && ls.lyricMeta.ui.renumbered } : null,
      sessionStorage: ss ? { head: (ss.lyrics || '').split('\n')[0], draftId: ss.lyricMeta && ss.lyricMeta.draftId, renumbered: ss.lyricMeta && ss.lyricMeta.ui && ss.lyricMeta.ui.renumbered } : null,
      idb,
      toasts: window.__toasts.splice(0),
      undoControls: {
        uiUndoVisible: !!(document.getElementById('ui-undo') && document.getElementById('ui-undo').offsetParent),
        btnUndoVisible: !!(document.getElementById('btn-undo') && document.getElementById('btn-undo').offsetParent),
      },
    };
  }, tag);
}

// Every storage area of the origin, searched for a card entry naming a word.
async function search(page, words) {
  return page.evaluate(async (words) => {
    const hits = Object.fromEntries(words.map((w) => [w, []]));
    const scan = (where, s) => {
      for (const w of words) if (s && s.includes(`"word":"${w}"`)) hits[w].push(where);
    };
    for (let i = 0; i < localStorage.length; i++) scan('localStorage:' + localStorage.key(i), localStorage.getItem(localStorage.key(i)));
    for (let i = 0; i < sessionStorage.length; i++) scan('sessionStorage:' + sessionStorage.key(i), sessionStorage.getItem(sessionStorage.key(i)));
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const { name } of dbs) {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(name);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      for (const st of Array.from(db.objectStoreNames)) {
        const [keys, vals] = await new Promise((res, rej) => {
          const tx = db.transaction(st, 'readonly');
          const k = tx.objectStore(st).getAllKeys();
          const v = tx.objectStore(st).getAll();
          tx.oncomplete = () => res([k.result, v.result]);
          tx.onerror = () => rej(tx.error);
        });
        keys.forEach((k, i) => scan(`idb:${name}/${st}/${k}`, JSON.stringify(vals[i])));
      }
      db.close();
    }
    return { dbs: dbs.map((d) => d.name), lsKeys: Object.keys(localStorage), ssKeys: Object.keys(sessionStorage), hits };
  }, words);
}

async function importTxt(page, name, body) {
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(body, 'utf8') });
  const head = body.split('\n')[0];
  await page.waitForFunction((h) => document.getElementById('lyrics-draft').value.split('\n')[0] === h, head, { timeout: 20000 });
  await page.waitForTimeout(1500);
}
async function importLib(page, body, title, tag) {
  const { env, file } = await envelopeFile(body, title, tag);
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return env.draftId;
}
async function importSession(page, lyrics, name, tag) {
  const file = path.join(OUT, `session_${TREE}_${tag}.json`);
  fs.writeFileSync(file, JSON.stringify({ version: 3, name, cards: [], lyrics, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: {} } }, null, 2));
  await page.setInputFiles('#ui-file', file);
  await page.waitForFunction((n) => app.workspaceName === n, name, { timeout: 30000 });
  await page.waitForTimeout(1500);
}
// APP history (the page's own Undo/Redo stack).
async function appUndoMouse(page) {
  const ui = page.locator('#ui-undo');
  if (await ui.isVisible()) {
    await ui.click();
    return 'APP Undo: #ui-undo (workbench header data-ui=undo), mouse click';
  }
  await page.locator('#btn-undo').click();
  return 'APP Undo: #btn-undo, mouse click';
}
async function appUndoKey(page) {
  await page.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur());
  const tag = await page.evaluate(() => document.activeElement.tagName);
  await page.keyboard.press('Control+z');
  return `APP Undo: Ctrl+Z, activeElement=${tag}`;
}
async function appRedoKey(page) {
  await page.evaluate(() => document.activeElement && document.activeElement !== document.body && document.activeElement.blur());
  const tag = await page.evaluate(() => document.activeElement.tagName);
  await page.keyboard.press('Control+Shift+z');
  return `APP Redo: Ctrl+Shift+Z, activeElement=${tag}`;
}
// BROWSER-NATIVE undo: Ctrl+Z inside the textarea (the page's handler skips TEXTAREA targets).
async function nativeUndo(page) {
  await page.locator('#lyrics-draft').click({ position: { x: 30, y: 10 } });
  const r = await page.evaluate(() => {
    window.__nIn = 0;
    window.__nBefore = document.getElementById('lyrics-draft').value;
    window.__nHist = app.history.length + ':' + app.historyIndex;
    document.getElementById('lyrics-draft').addEventListener('input', () => window.__nIn++);
    return document.activeElement.id;
  });
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  return page.evaluate((focused) => ({ focused, changed: document.getElementById('lyrics-draft').value !== window.__nBefore, inputEvents: window.__nIn, histBefore: window.__nHist, histAfterKeyStillFocused: app.history.length + ':' + app.historyIndex }), r);
}
async function reload(page) {
  await page.reload();
  await ready(page);
  await page.waitForTimeout(2500);
}
async function openFromHistory(page, draftId) {
  await clickTab(page, 'history');
  const b = page.locator(`button[data-ui="ly-library-restore"][data-id="${draftId}"]`);
  if (!(await b.count())) return false;
  await b.click();
  await page.waitForFunction((id) => app.lyricMeta.draftId === id, draftId, { timeout: 20000 });
  await page.waitForTimeout(1800);
  return true;
}
async function sendEdit(page, calls) {
  const n = calls.length;
  await page.locator('[data-ui="ly-menu"][data-id="ai"]').first().click();
  await page.waitForTimeout(150);
  await page.locator('#ly-menu-ai [data-ui="edit-lyrics"]').click();
  await page.waitForTimeout(300);
  const focus = await page.evaluate(() => document.activeElement && document.activeElement.id);
  await page.keyboard.type('Tighten line 2', { delay: 4 });
  await page.locator('#chat-send').click();
  await page.waitForFunction((k) => true, n);
  for (let i = 0; i < 40 && calls.length === n; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(600);
  const c = calls[n] || null;
  return { focus, reached: calls.length - n, declarations: c && c.body && c.body.lyric_context ? c.body.lyric_context.declarations : null, document: c && c.body && c.body.lyric_context ? c.body.lyric_context.document : null, keys: c && c.body ? Object.keys(c.body) : null };
}

const W = (r) => (r && Array.isArray(r.items) ? r.items.map((m) => `${m.kind}:${m.word}@L${(m.n || []).join('/')}:${m.from}->${m.to}`) : []);
function line(s) {
  return JSON.stringify({
    tag: s.tag,
    head: s.head,
    rows: s.setupRows,
    draftId: s.draftId && s.draftId.slice(0, 15),
    card: W(s.renumbered),
    reviewCard: s.reviewCardLines,
    ls: s.localStorage && { head: s.localStorage.head, id: s.localStorage.draftId && s.localStorage.draftId.slice(0, 15), card: W(s.localStorage.renumbered) },
    idb: s.idb.map((r) => `${String(r.key).slice(0, 15)} ${r.head} savedAt=${r.savedAt} card=${JSON.stringify(W(r.renumbered))}`),
    hist: s.history.map((h) => `${h.cur ? '*' : ''}${h.head || '(empty)'}${h.draftId ? '@' + h.draftId.slice(6, 14) : ''}${h.adapted !== null ? '[adapted=' + h.adapted + ']' : ''}`).join(' > '),
    toasts: s.toasts,
  });
}

// ── Scenarios ─────────────────────────────────────────────────────────────
const SC = {
  // Main claim with mouse Undo; passive peeks at +60 ms, +700 ms, +3 s;
  // reload; reopen B then A from the History tab.
  async undo_mouse(b, base) {
    const { ctx, page, calls, errors } = await open(b, base);
    const st = [];
    await clickTab(page, 'review');
    await importTxt(page, 'a.txt', FX.A);
    st.push(await peek(page, '1 after .txt import A (Review tab open)'));
    const idB = await importLib(page, FX.B, 'Song B', 'undo_mouse_B');
    st.push(await peek(page, '2a after Library import B (passive)'));
    await clickTab(page, 'review');
    await page.waitForTimeout(400);
    st.push(await peek(page, '2b after Library import B, Review tab clicked'));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(60);
    st.push(await peek(page, `3a ${how} +60ms`));
    await page.waitForTimeout(640);
    st.push(await peek(page, `3b ${how} +700ms`));
    await page.waitForTimeout(2300);
    st.push(await peek(page, `3c ${how} +3s`));
    const idA = st[st.length - 1].draftId;
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '4 after reload, Review tab clicked'));
    const s4 = await search(page, [...FX.wA, ...FX.wB]);
    const okB = await openFromHistory(page, idB);
    await clickTab(page, 'review');
    st.push(await peek(page, `5 History tab: Open draft B (${okB}), Review tab clicked`));
    const okA = idA ? await openFromHistory(page, idA) : false;
    await clickTab(page, 'review');
    st.push(await peek(page, `6 History tab: Open draft A (${okA}), Review tab clicked`));
    const s6 = await search(page, [...FX.wA, ...FX.wB]);
    await ctx.close();
    return { st, s4, s6, errors, idA, idB, calls: calls.length };
  },
  // Keyboard Undo, then Redo, then Undo again; reload.
  async undo_key(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await clickTab(page, 'review');
    await importTxt(page, 'a.txt', FX.A);
    st.push(await peek(page, '1 after .txt import A'));
    await importLib(page, FX.B, 'Song B', 'undo_key_B');
    await clickTab(page, 'review');
    st.push(await peek(page, '2 after Library import B'));
    const how = await appUndoKey(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${how} +3s`));
    const r = await appRedoKey(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `4 ${r} +3s`));
    const u2 = await appUndoKey(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `5 ${u2} again +3s`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '6 after reload'));
    const s6 = await search(page, [...FX.wA, ...FX.wB]);
    await ctx.close();
    return { st, s6, errors };
  },
  // BROWSER-NATIVE undo in the textarea, separately from APP history.
  async native(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await importTxt(page, 'a.txt', FX.A);
    st.push(await peek(page, '1 after .txt import A'));
    const n0 = await nativeUndo(page);
    await page.evaluate(() => document.getElementById('lyrics-draft').blur());
    await page.waitForTimeout(1200);
    st.push(await peek(page, `2 BROWSER-NATIVE Ctrl+Z in textarea after .txt import A ${JSON.stringify(n0)}, then blur`));
    await importLib(page, FX.B, 'Song B', 'native_B');
    st.push(await peek(page, '3 after Library import B'));
    const n1 = await nativeUndo(page);
    await page.evaluate(() => document.getElementById('lyrics-draft').blur());
    await page.waitForTimeout(1200);
    st.push(await peek(page, `4 BROWSER-NATIVE Ctrl+Z in textarea after import B ${JSON.stringify(n1)}, then blur`));
    await ctx.close();
    return { st, errors, native: [n0, n1] };
  },
  async session_quiet(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await clickTab(page, 'review');
    await importTxt(page, 'a.txt', FX.A);
    st.push(await peek(page, '1 after .txt import A'));
    await importSession(page, S0, 'Session Quiet', 'quiet');
    st.push(await peek(page, '2 after session import S0 (#ui-file)'));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${how} +3s`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '4 after reload'));
    const s4 = await search(page, [...FX.wA, ...W_S1]);
    await ctx.close();
    return { st, s4, errors };
  },
  async session_mig(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await clickTab(page, 'review');
    await importTxt(page, 'a.txt', FX.A);
    st.push(await peek(page, '1 after .txt import A'));
    await importSession(page, S1, 'Session S', 'mig');
    st.push(await peek(page, '2 after session import S1 (#ui-file)'));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${how} +3s`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '4 after reload'));
    const s4 = await search(page, [...FX.wA, ...W_S1]);
    await ctx.close();
    return { st, s4, errors };
  },
  // Card coordinates after a typed edit (no boundary).
  async coords(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await clickTab(page, 'review');
    await importTxt(page, 'a.txt', FX.A);
    st.push(await peek(page, '1 after .txt import A'));
    const first = FX.A.split('\n')[4];
    const at = await page.evaluate((f) => {
      const d = document.getElementById('lyrics-draft');
      const i = d.value.indexOf(f);
      d.focus();
      d.setSelectionRange(i, i);
      return i;
    }, first);
    await page.keyboard.type('A brand new opening line', { delay: 4 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.evaluate(() => document.getElementById('lyrics-draft').blur());
    await page.waitForTimeout(1200);
    const s = await peek(page, `2 typed a sung line above sung line 1 at offset ${at}, blur`);
    s.pageSung = await page.evaluate(() => LY.model.sung.map((x) => `${x.n}:${x.text}`));
    st.push(s);
    await ctx.close();
    return { st, errors };
  },
  // BROWSER-NATIVE Ctrl+Z after APP Undo has actually returned to A (no
  // focus between import B and the app Undo, so no extra step intervenes).
  async native_after_undo(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await importTxt(page, 'a.txt', FX.A);
    await importLib(page, FX.B, 'Song B', 'native2_B');
    st.push(await peek(page, '1 after .txt A then Library B'));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(2500);
    st.push(await peek(page, `2 ${how} +2.5s`));
    const n = await nativeUndo(page);
    st.push(await peek(page, `3 BROWSER-NATIVE Ctrl+Z in textarea, still focused ${JSON.stringify(n)}`));
    await page.evaluate(() => document.getElementById('lyrics-draft').blur());
    await page.waitForTimeout(1200);
    st.push(await peek(page, '4 after blur'));
    await ctx.close();
    return { st, errors, native: [n] };
  },
  // Side check: the Library source line and the history after a focus/blur
  // with no edit, for a migrating copy (B) and a quiet copy (BQ).
  async extra(b, base) {
    const BQ = ['[SETUP — title — "Song BQ"]', '[SETUP — returns — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
    const res = {};
    for (const [k, body] of [['B_migrating', FX.B], ['BQ_quiet', BQ]]) {
      const { ctx, page, errors } = await open(b, base);
      await importTxt(page, 'a.txt', FX.A);
      await importLib(page, body, k, `extra_${k}`);
      const src = () => page.evaluate(() => { const e = document.getElementById('ly-library-source'); return e && !e.hidden ? e.innerText.split('\n')[0] : null; });
      const h = () => page.evaluate(() => ({ idx: app.historyIndex, steps: app.history.map((x) => { const s = JSON.parse(x); return `${(s.lyrics || '').split('\n')[0]}[adapted=${s.lyricMeta && s.lyricMeta.libraryOrigin ? s.lyricMeta.libraryOrigin.adapted : null}]`; }), live: app.lyricMeta.libraryOrigin ? app.lyricMeta.libraryOrigin.adapted : null, textChangedFromImport: document.getElementById('lyrics-draft').value !== window.__imp }));
      await page.evaluate(() => (window.__imp = document.getElementById('lyrics-draft').value));
      const r = { sourceLine: await src(), afterImport: await h() };
      await page.locator('#lyrics-draft').click({ position: { x: 30, y: 10 } });
      await page.waitForTimeout(200);
      await page.evaluate(() => document.getElementById('lyrics-draft').blur());
      await page.waitForTimeout(900);
      r.afterFocusBlur = await h();
      await appUndoMouse(page);
      await page.waitForTimeout(1200);
      r.afterUndo1 = (await text(page)).split('\n')[0];
      await appUndoMouse(page);
      await page.waitForTimeout(1200);
      r.afterUndo2 = (await text(page)).split('\n')[0];
      r.errors = errors;
      res[k] = r;
      console.log(k, JSON.stringify(r));
      await ctx.close();
    }
    return res;
  },
  // /chat payload at three points, each in a fresh context.
  async payload(b, base) {
    const res = {};
    for (const pt of ['P1_A', 'P2_after_B', 'P3_after_undo']) {
      const { ctx, page, calls, errors } = await open(b, base);
      await clickTab(page, 'review');
      await importTxt(page, 'a.txt', FX.A);
      if (pt !== 'P1_A') await importLib(page, FX.B, 'Song B', `payload_${pt}`);
      if (pt === 'P3_after_undo') {
        await appUndoMouse(page);
        await page.waitForTimeout(3000);
      }
      await clickTab(page, 'review');
      const pre = await peek(page, `${pt} before send`);
      const sent = await sendEdit(page, calls);
      const post = await peek(page, `${pt} after send`);
      res[pt] = { pre, sent, post, errors };
      await ctx.close();
    }
    return res;
  },
};

(async () => {
  const srv = server();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: TREE, dir: TREES[TREE], fixture: FIX, built: BUILT };
  try {
    for (const f of SCEN) {
      console.log(`\n## ${TREE} ${f} fixture=${FIX}`);
      try {
        const r = (out[f] = await SC[f](browser, base));
        if (r.st) r.st.forEach((s) => console.log(line(s)));
        for (const k of ['s4', 's6']) if (r[k]) console.log(k, JSON.stringify(r[k]));
        if (r.native) console.log('native', JSON.stringify(r.native));
        if (f === 'coords') console.log('pageSung', JSON.stringify(r.st[1].pageSung));
        if (f === 'payload')
          for (const [k, v] of Object.entries(r)) console.log(k, JSON.stringify({ pre: JSON.parse(line(v.pre)), sent: v.sent, errors: v.errors }));
        if (r.errors && r.errors.length) console.log('PAGE ERRORS', JSON.stringify(r.errors));
      } catch (e) {
        out[f] = { threw: String((e && e.stack) || e) };
        console.log('THREW', out[f].threw);
      }
    }
  } finally {
    fs.writeFileSync(path.join(OUT, `run_${TREE}_${FIX}_${SCEN.join('+')}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    srv.close();
  }
})();
