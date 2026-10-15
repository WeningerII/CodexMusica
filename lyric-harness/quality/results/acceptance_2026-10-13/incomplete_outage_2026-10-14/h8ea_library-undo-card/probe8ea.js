// BB8 team, label library-undo-card, candidate 8ea94ac9. Scratch only.
// Adapted from findings_6955e342/repro/check-library-undo-card/rerun.js
// (same protocol: passive snapshots, real clicks, Library envelopes built in
// Node by each tree's own src/library-import.js, imported through #ly-file;
// sessions through #ui-file). Changes from rerun.js:
// - trees: cand=wt-8ea, prev=wt-695 (must still fail), p0af=wt-0af, main=wt-main;
// - the renumbering record is read wherever the tree keeps it: the candidate's
//   lyricMeta.renumbered {draftId, items, more?} and the earlier
//   lyricMeta.ui.renumbered {items, more}; live, every history step,
//   localStorage, sessionStorage and every IndexedDB draft record;
// - the Review card's entries are parsed from the rendered panel text;
// - new scenarios: undo_redo_mouse (header Redo button), chain3 (A, B, C),
//   session_mig_lib (session over a Library draft), txt_onto_lib, dismiss_undo,
//   download (the side finding: adapted with no edit, then the working-copy
//   download's declarations), all marked in COMMANDS.txt.
// Usage: node probe8ea.js <cand|prev|p0af|main> <scenario[,scenario...]> [AB|XY]
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { webcrypto } = require('crypto');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h8ea/library-undo-card');
const TREES = { cand: 'wt-8ea', prev: 'wt-695', p0af: 'wt-0af', p61b: 'wt-61b', main: 'wt-main' };
const { chromium } = require(path.join(S, 'wt-8ea/node_modules/playwright'));
const TREE = process.argv[2] || 'cand';
const SCEN = (process.argv[3] || 'undo_mouse').split(',');
const FIX = process.argv[4] || 'AB';
const ROOT = path.join(S, TREES[TREE]);
const BUILD = path.join(OUT, 'build-' + TREES[TREE]);
const BUILT = path.join(BUILD, `built-${TREES[TREE]}.html`);
const LI = require(path.join(ROOT, 'src/library-import.js'));
const TMP = path.join(OUT, 'tmp_inputs');
fs.mkdirSync(TMP, { recursive: true });
const DL = path.join(OUT, 'downloads');
fs.mkdirSync(DL, { recursive: true });

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

// ── Fixtures (same as rerun.js, plus C) ───────────────────────────────────
const FIXTURES = {
  AB: {
    A: ['[SETUP — title — "Song A"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Ah--ah, ah my heart is burning', 'Ah--ah, ah my part is turning'].join('\n'),
    B: ['[SETUP — title — "Song B"]', '[SETUP — returns — 1.T4,2.T4]', '', '[VERSE]', 'Oh--oh, oh sweet love', 'Oh--oh, oh sweet dove'].join('\n'),
    C: ['[SETUP — title — "Song C"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Uh--uh, uh the night', 'Uh--uh, uh the light'].join('\n'),
    wA: ['heart', 'part'],
    wB: ['love', 'dove'],
    wC: ['night', 'light'],
  },
  XY: {
    A: ['[SETUP — title — "Song X"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Ay--ay, ay my fire is rising', 'Ay--ay, ay my wire is singing'].join('\n'),
    B: ['[SETUP — title — "Song Y"]', '[SETUP — returns — 1.T4,2.T4]', '', '[VERSE]', 'Oo--oo, oo the rain', 'Oo--oo, oo the pain'].join('\n'),
    C: ['[SETUP — title — "Song Z"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Ee--ee, ee the moon', 'Ee--ee, ee the tune'].join('\n'),
    wA: ['fire', 'wire'],
    wB: ['rain', 'pain'],
    wC: ['moon', 'tune'],
  },
};
const FX = FIXTURES[FIX];
const S0 = ['[SETUP — title — "Song Quiet"]', '[SETUP — rhyme groups — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
const S1 = ['[SETUP — title — "Song S"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Eh--eh, eh my gold is shining', 'Eh--eh, eh my road is winding'].join('\n');
const W_S1 = ['gold', 'road'];
const BQ = ['[SETUP — title — "Song BQ"]', '[SETUP — returns — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
// Library declarations carried as source history (shape from scripts/test_library_import.js).
const DECL = [{ pronunciations: [{ line: 'Oh--oh, oh sweet love', token: 2, word: 'oh', phones: ['OW1'], basis: 'declared', source: 'the singer' }] }];

async function envelopeFile(text, title, tag, declarations = []) {
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
      declarations,
    },
  };
  const env = await LI.makeWorkingCopyEnvelope(text, meta, webcrypto);
  const file = path.join(TMP, `env_${TREE}_${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(env, null, 2));
  return { env, file };
}

// ── Browser ───────────────────────────────────────────────────────────────
async function open(browser, base) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
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
  await page.locator(`#ly-tab-${id}`).click();
  await page.waitForTimeout(350);
}

// PASSIVE snapshot: reads only (no page function is called).
async function peek(page, tag) {
  return page.evaluate(async (tag) => {
    const rec = (m) => {
      if (!m || typeof m !== 'object') return null;
      const r = m.renumbered && Array.isArray(m.renumbered.items) ? { at: 'renumbered', ...m.renumbered } : m.ui && m.ui.renumbered && Array.isArray(m.ui.renumbered.items) ? { at: 'ui.renumbered', ...m.ui.renumbered } : null;
      return r ? JSON.parse(JSON.stringify(r)) : null;
    };
    const d = document.getElementById('lyrics-draft');
    const lm = app.lyricMeta || {};
    const parse = (s) => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return null;
      }
    };
    const ls = parse(localStorage.getItem('codex-workbench-v1') || 'null');
    const ss = parse(sessionStorage.getItem('codex-workbench-recovery') || 'null');
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
          if (st === 'drafts') idb.push({ db: name, store: st, key: k, title: v && v.title, head: v && typeof v.text === 'string' ? v.text.split('\n')[0] : null, rows: v && typeof v.text === 'string' ? v.text.split('\n').filter((l) => /^\[SETUP — (rhyme groups|returns)/.test(l)) : null, savedAt: v && v.savedAt, renumbered: rec(v && v.meta), adapted: v && v.meta && v.meta.libraryOrigin ? v.meta.libraryOrigin.adapted : null, origTextHead: v && v.originalText ? v.originalText.split('\n')[0] : null });
        });
      }
      db.close();
    }
    const panel = document.getElementById('ly-panel-review');
    const panelText = panel && !panel.hidden ? panel.innerText : null;
    const cardLines = panelText ? panelText.split('\n').filter((l) => /renumbered to the current word cut|word \d+ → \d+|Show all|earlier version/.test(l)) : null;
    const item = (LY.items || []).find((x) => x && x.id === 'renumbered') || null;
    return {
      tag,
      t: Date.now(),
      text: d.value,
      head: d.value.split('\n')[0],
      setupRows: d.value.split('\n').filter((l) => /^\[SETUP — (rhyme groups|returns)/.test(l)),
      draftId: lm.draftId || null,
      libraryOrigin: lm.libraryOrigin ? { title: lm.libraryOrigin.title, adapted: lm.libraryOrigin.adapted, declarations: lm.libraryOrigin.declarations } : null,
      renumbered: rec(lm),
      lyTab: LY.tab,
      reviewPanelVisible: panelText !== null,
      reviewCardLines: cardLines,
      lyItemCard: item ? { title: item.title, text: item.text } : null,
      history: app.history.map((h, i) => {
        const s = parse(h) || {};
        return { i, head: (s.lyrics || '').split('\n')[0], draftId: (s.lyricMeta && s.lyricMeta.draftId) || null, adapted: s.lyricMeta && s.lyricMeta.libraryOrigin ? s.lyricMeta.libraryOrigin.adapted : null, renumbered: rec(s.lyricMeta), cur: i === app.historyIndex };
      }),
      localStorage: ls ? { head: (ls.lyrics || '').split('\n')[0], draftId: ls.lyricMeta && ls.lyricMeta.draftId, renumbered: rec(ls.lyricMeta) } : null,
      sessionStorage: ss ? { head: (ss.lyrics || '').split('\n')[0], draftId: ss.lyricMeta && ss.lyricMeta.draftId, renumbered: rec(ss.lyricMeta) } : null,
      idb,
      toasts: window.__toasts.splice(0),
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
    // the in-memory history too (APP Undo/Redo steps)
    app.history.forEach((h, i) => scan(`history[${i}]${i === app.historyIndex ? '*' : ''}`, h));
    return { hits };
  }, words);
}

async function importTxt(page, name, body) {
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(body, 'utf8') });
  const head = body.split('\n')[0];
  await page.waitForFunction((h) => document.getElementById('lyrics-draft').value.split('\n')[0] === h, head, { timeout: 20000 });
  await page.waitForTimeout(1500);
}
async function importLib(page, body, title, tag, declarations = []) {
  const { env, file } = await envelopeFile(body, title, tag, declarations);
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return env.draftId;
}
async function importSession(page, lyrics, name, tag) {
  const file = path.join(TMP, `session_${TREE}_${tag}.json`);
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
    return 'APP Undo: #ui-undo (header, data-ui=undo), mouse click';
  }
  await page.locator('#btn-undo').click();
  return 'APP Undo: #btn-undo, mouse click';
}
async function appRedoMouse(page) {
  const ui = page.locator('#ui-redo');
  if (await ui.isVisible()) {
    await ui.click();
    return 'APP Redo: #ui-redo (header, data-ui=redo), mouse click';
  }
  await page.locator('#btn-redo').click();
  return 'APP Redo: #btn-redo, mouse click';
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
  for (let i = 0; i < 40 && calls.length === n; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(600);
  const c = calls[n] || null;
  return { focus, reached: calls.length - n, declarations: c && c.body && c.body.lyric_context ? c.body.lyric_context.declarations : null, document: c && c.body && c.body.lyric_context ? c.body.lyric_context.document : null, keys: c && c.body ? Object.keys(c.body) : null };
}
// Export menu -> "Download text" (real clicks); returns the saved file and its parse.
async function downloadText(page, tag) {
  await page.locator('[data-ui="ly-menu"][data-id="export"]').first().click();
  await page.waitForTimeout(200);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('#ly-menu-export [data-ui="ly-download"]').click()]);
  const name = dl.suggestedFilename();
  const file = path.join(DL, `${TREE}_${tag}_${name}`);
  await dl.saveAs(file);
  const raw = fs.readFileSync(file, 'utf8');
  let env = null;
  try {
    env = JSON.parse(raw);
  } catch (e) {}
  await page.waitForTimeout(300);
  return {
    name,
    file,
    isEnvelope: !!(env && env.payload),
    payloadDeclarations: env && env.payload ? env.payload.declarations : null,
    workingCopyAdapted: env && env.payload && env.payload.provenance && env.payload.provenance.workingCopy ? env.payload.provenance.workingCopy.adapted : null,
    workingCopyDeclarations: env && env.payload && env.payload.provenance && env.payload.provenance.workingCopy ? env.payload.provenance.workingCopy.declarations : null,
    payloadTextHead: env && env.payload ? env.payload.text.split('\n').slice(0, 2) : raw.split('\n').slice(0, 2),
  };
}

const W = (r) => (r && Array.isArray(r.items) ? r.items.map((m) => `${m.kind}:${m.word}@L${(m.n || []).join('/')}:${m.from}->${m.to}`) : []);
function line(s) {
  return JSON.stringify({
    tag: s.tag,
    head: s.head,
    rows: s.setupRows,
    draftId: s.draftId && s.draftId.slice(0, 15),
    card: W(s.renumbered),
    cardDraftId: s.renumbered && s.renumbered.draftId ? s.renumbered.draftId.slice(0, 15) : null,
    reviewCard: s.reviewCardLines,
    ls: s.localStorage && { head: s.localStorage.head, id: s.localStorage.draftId && s.localStorage.draftId.slice(0, 15), card: W(s.localStorage.renumbered) },
    idb: s.idb.map((r) => `${String(r.key).slice(0, 15)} ${r.head} savedAt=${r.savedAt} card=${JSON.stringify(W(r.renumbered))}`),
    hist: s.history.map((h) => `${h.cur ? '*' : ''}${h.head || '(empty)'}${h.draftId ? '@' + h.draftId.slice(6, 14) : ''}${h.adapted !== null ? '[adapted=' + h.adapted + ']' : ''}{${W(h.renumbered).map((x) => x.split(':')[1].split('@')[0]).join(',')}}`).join(' > '),
    toasts: s.toasts,
  });
}
const ALL = () => [...FX.wA, ...FX.wB, ...FX.wC, ...W_S1];

// ── Scenarios ─────────────────────────────────────────────────────────────
const SC = {
  // Main claim with mouse Undo; passive peeks at +60 ms, +700 ms, +3 s; whole-
  // storage search; reload; reopen B then A from the History tab.
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
    const s3 = await search(page, ALL());
    const idA = st[st.length - 1].draftId;
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '4 after reload, Review tab clicked'));
    const s4 = await search(page, ALL());
    const okB = await openFromHistory(page, idB);
    await clickTab(page, 'review');
    st.push(await peek(page, `5 History tab: Open draft B (${okB}), Review tab clicked`));
    const okA = idA ? await openFromHistory(page, idA) : false;
    await clickTab(page, 'review');
    st.push(await peek(page, `6 History tab: Open draft A (${okA}), Review tab clicked`));
    const s6 = await search(page, ALL());
    await ctx.close();
    return { st, s3, s4, s6, errors, idA, idB, calls: calls.length };
  },
  // How long the rendered Review card lags the live record after APP Undo /
  // Redo: a MutationObserver on #ly-panel-review stamps every change with
  // performance.now() relative to the click and which fixture words it names.
  async render_timing(b, base) {
    const { ctx, page, errors } = await open(b, base);
    await importTxt(page, 'a.txt', FX.A);
    await importLib(page, FX.B, 'Song B', 'timing_B');
    await clickTab(page, 'review');
    await page.waitForTimeout(800);
    const words = [...FX.wA, ...FX.wB];
    const arm = () =>
      page.evaluate((words) => {
        window.__rt = [];
        const p = document.getElementById('ly-panel-review');
        const probe = (why) => {
          const t = p && !p.hidden ? p.innerText : '';
          const card = t.split('\n').filter((l) => /word \d+ → \d+/.test(l)).join(' ');
          const live = app.lyricMeta && app.lyricMeta.renumbered ? app.lyricMeta.renumbered.items.map((x) => x.word) : app.lyricMeta && app.lyricMeta.ui && app.lyricMeta.ui.renumbered ? app.lyricMeta.ui.renumbered.items.map((x) => x.word) : [];
          window.__rt.push({ dt: Math.round(performance.now() - (window.__t0 || performance.now())), why, head: document.getElementById('lyrics-draft').value.split('\n')[0], cardWords: words.filter((w) => card.includes('“' + w + '”')), liveWords: live });
        };
        if (window.__mo) window.__mo.disconnect();
        window.__mo = new MutationObserver(() => probe('mutation'));
        window.__mo.observe(p, { subtree: true, childList: true, characterData: true });
        window.__t0 = null;
        document.addEventListener('click', () => { window.__t0 = performance.now(); probe('click-capture'); }, { capture: true, once: true });
        let n = 0;
        const tick = () => { if (window.__t0 !== null) probe('raf'); if (n++ < 400) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }, words);
    const collect = () => page.evaluate(() => {
      const out = [];
      let last = null;
      for (const r of window.__rt) {
        const k = JSON.stringify([r.head, r.cardWords, r.liveWords]);
        if (k !== last) out.push(r);
        last = k;
      }
      return out;
    });
    const res = {};
    await arm();
    res.undo_how = await appUndoMouse(page);
    await page.waitForTimeout(2500);
    res.undo = await collect();
    await arm();
    res.redo_how = await appRedoMouse(page);
    await page.waitForTimeout(2500);
    res.redo = await collect();
    res.errors = errors;
    console.log(JSON.stringify(res, null, 1));
    await ctx.close();
    return res;
  },
  // Header Undo, header Redo, Undo again, each +3 s; reload; History reopen.
  async undo_redo_mouse(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await clickTab(page, 'review');
    await importTxt(page, 'a.txt', FX.A);
    const idB = await importLib(page, FX.B, 'Song B', 'undo_redo_mouse_B');
    await clickTab(page, 'review');
    st.push(await peek(page, '1 after .txt A then Library B, Review tab clicked'));
    let h = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `2 ${h} +3s`));
    const idA = st[st.length - 1].draftId;
    h = await appRedoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${h} +3s`));
    const s3 = await search(page, ALL());
    h = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `4 ${h} again +3s`));
    h = await appRedoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `5 ${h} again +3s (B live)`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '6 after reload (B live)'));
    const okA = await openFromHistory(page, idA);
    await clickTab(page, 'review');
    st.push(await peek(page, `7 History tab: Open draft A (${okA}), Review tab clicked`));
    const okB = await openFromHistory(page, idB);
    await clickTab(page, 'review');
    st.push(await peek(page, `8 History tab: Open draft B (${okB}), Review tab clicked`));
    const s8 = await search(page, ALL());
    await ctx.close();
    return { st, s3, s8, errors, idA, idB };
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
    const s6 = await search(page, ALL());
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
    const s4 = await search(page, ALL());
    await ctx.close();
    return { st, s4, errors, native: [n0, n1] };
  },
  // BROWSER-NATIVE Ctrl+Z after APP Undo has returned to A.
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
    await page.waitForTimeout(1500);
    st.push(await peek(page, '4 after blur +1.5s'));
    const s4 = await search(page, ALL());
    await ctx.close();
    return { st, s4, errors, native: [n] };
  },
  async session_quiet(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await clickTab(page, 'review');
    await importTxt(page, 'a.txt', FX.A);
    st.push(await peek(page, '1 after .txt import A'));
    await importSession(page, S0, 'Session Quiet', 'quiet');
    await clickTab(page, 'review');
    st.push(await peek(page, '2 after session import S0 (#ui-file), Review clicked'));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${how} +3s`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '4 after reload'));
    const s4 = await search(page, ALL());
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
    await clickTab(page, 'review');
    st.push(await peek(page, '2 after session import S1 (#ui-file), Review clicked'));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${how} +3s`));
    const h2 = await appRedoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `4 ${h2} +3s`));
    const h3 = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `5 ${h3} again +3s`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '6 after reload'));
    const s6 = await search(page, ALL());
    await ctx.close();
    return { st, s6, errors };
  },
  // The second session-import path: Saved sessions (Load, Fork). The two
  // saved copies are made by the page's own Save from TYPED text (the typing
  // refresh never migrates, so the saved rows stay unmarked and migrate on
  // open). Then .txt A, Load "Saved S1" (migrating), Undo/Redo/Undo, Load
  // "Saved S0" (quiet), Undo; Library B, Fork "Saved S1", Undo; reload.
  async saved_sessions(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    const saveAs = async (name, body) => {
      await page.fill('#lyrics-draft', body);
      await page.waitForTimeout(600);
      await page.evaluate(() => document.getElementById('lyrics-draft').blur());
      await page.waitForTimeout(300);
      const vis = page.locator('[data-ui="save"]').first();
      if (await vis.isVisible()) await vis.click();
      else await page.locator('#btn-save').click();
      await page.waitForTimeout(300);
      await page.fill('#save-name', name);
      await page.locator('#save-confirm').click();
      await page.waitForTimeout(1500);
    };
    const openSaved = async (name, how) => {
      const vis = page.locator('[data-ui="saved"]').first();
      if (await vis.isVisible()) await vis.click();
      else await page.locator('#btn-saved').click();
      await page.waitForSelector('#saved-body .saved-item', { timeout: 15000 });
      const item = page.locator('#saved-body .saved-item').filter({ hasText: name }).first();
      await item.locator(how === 'fork' ? '[data-fork]' : '[data-load]').click();
      await page.waitForFunction((n) => app.workspaceName === n && document.getElementById('lyrics-draft').value.includes('[SETUP'), name, { timeout: 20000 });
      await page.waitForTimeout(1500);
    };
    await saveAs('Saved S1', S1);
    await saveAs('Saved S0', S0);
    const fx = await page.evaluate(async () => {
      const list = JSON.parse((await window.storage.get('codex:list')).value);
      const out = [];
      for (const w of list) {
        const d = JSON.parse((await window.storage.get(w.key)).value);
        out.push({ name: d.name, rows: (d.lyrics || '').split('\n').filter((l) => /^\[SETUP — (rhyme groups|returns)/.test(l)), hasRecord: !!(d.lyricMeta && (d.lyricMeta.renumbered || (d.lyricMeta.ui && d.lyricMeta.ui.renumbered))), backend: window.storage.backend });
      }
      return out;
    });
    console.log('saved fixtures', JSON.stringify(fx));
    await importTxt(page, 'a.txt', FX.A);
    await clickTab(page, 'review');
    st.push(await peek(page, '1 after .txt import A'));
    await openSaved('Saved S1', 'load');
    await clickTab(page, 'review');
    st.push(await peek(page, '2 after Saved sessions > Load "Saved S1" (migrating)'));
    let h = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${h} +3s (expect A)`));
    h = await appRedoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `4 ${h} +3s (expect S1)`));
    h = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `5 ${h} again +3s (expect A)`));
    await openSaved('Saved S0', 'load');
    await clickTab(page, 'review');
    st.push(await peek(page, '6 after Saved sessions > Load "Saved S0" (quiet)'));
    h = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `7 ${h} +3s (expect A)`));
    const idB = await importLib(page, FX.B, 'Song B', 'saved_B');
    await clickTab(page, 'review');
    st.push(await peek(page, '8 after Library import B'));
    await openSaved('Saved S1', 'fork');
    await clickTab(page, 'review');
    st.push(await peek(page, '9 after Saved sessions > Fork "Saved S1" over B'));
    h = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `10 ${h} +3s (expect B)`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '11 after reload'));
    const s11 = await search(page, ALL());
    await ctx.close();
    return { st, s6: s11, errors, fixtures: fx, idB };
  },
  // Race: APP Undo clicked as soon as draft B is live (inside the 300 ms
  // Library save debounce), then Redo and Undo at once; peeks at +3 s.
  async race_undo(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await importTxt(page, 'a.txt', FX.A);
    const { env, file } = await envelopeFile(FX.B, 'Song B', 'race_B');
    await page.setInputFiles('#ly-file', file);
    await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
    const t0 = Date.now();
    let h = await appUndoMouse(page);
    const dt = Date.now() - t0;
    await page.waitForTimeout(3000);
    await clickTab(page, 'review');
    st.push(await peek(page, `1 ${h} clicked ${dt} ms after B went live, +3s`));
    h = await appRedoMouse(page);
    await page.waitForTimeout(40);
    const h2 = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    await clickTab(page, 'review');
    st.push(await peek(page, `2 ${h} then ${h2} 40 ms apart, +3s (expect A)`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '3 after reload'));
    const s3 = await search(page, ALL());
    const okB = await openFromHistory(page, env.draftId);
    await clickTab(page, 'review');
    st.push(await peek(page, `4 History tab: Open draft B (${okB}), Review clicked`));
    await ctx.close();
    return { st, s3, errors, idB: env.draftId };
  },
  // BROWSER-NATIVE Ctrl+Z with typed text in play: type in B, native Ctrl+Z
  // (reverts the typing only), then APP Undo, then native Ctrl+Z again in A.
  async native_typed(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await importTxt(page, 'a.txt', FX.A);
    await importLib(page, FX.B, 'Song B', 'native_typed_B');
    await page.evaluate(() => {
      const d = document.getElementById('lyrics-draft');
      d.focus();
      d.setSelectionRange(d.value.length, d.value.length);
    });
    await page.keyboard.type(' typed', { delay: 4 });
    await page.waitForTimeout(300);
    st.push(await peek(page, '1 B with typed text, textarea focused'));
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    st.push(await peek(page, '2 BROWSER-NATIVE Ctrl+Z in textarea (still focused)'));
    await page.evaluate(() => document.getElementById('lyrics-draft').blur());
    await page.waitForTimeout(1200);
    st.push(await peek(page, '3 blur +1.2s'));
    const h = await appUndoMouse(page);
    await page.waitForTimeout(2500);
    await clickTab(page, 'review');
    st.push(await peek(page, `4 ${h} +2.5s`));
    const n = await nativeUndo(page);
    await page.evaluate(() => document.getElementById('lyrics-draft').blur());
    await page.waitForTimeout(1500);
    await clickTab(page, 'review');
    st.push(await peek(page, `5 BROWSER-NATIVE Ctrl+Z in textarea ${JSON.stringify(n)}, blur +1.5s`));
    const s5 = await search(page, ALL());
    await ctx.close();
    return { st, s4: s5, errors, native: [n] };
  },
  // A session import over a Library draft B, then Undo back to B.
  async session_mig_lib(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await importTxt(page, 'a.txt', FX.A);
    const idB = await importLib(page, FX.B, 'Song B', 'smlib_B');
    await clickTab(page, 'review');
    st.push(await peek(page, '1 after .txt A then Library B'));
    await importSession(page, S1, 'Session S', 'mig_lib');
    await clickTab(page, 'review');
    st.push(await peek(page, '2 after session import S1 (#ui-file) over B'));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${how} +3s (expect B)`));
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '4 after reload'));
    const s4 = await search(page, ALL());
    await ctx.close();
    return { st, s4, errors, idB };
  },
  // Three drafts: .txt A, Library B, Library C; APP Undo until A's text is
  // back (each step peeked: the migrating-import side finding can add a
  // step), Redo until C; reload; reopen A, B, C by the ids read from
  // IndexedDB (by title), each from a draft that is not itself.
  async chain3(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    const headA = FX.A.split('\n')[0], headC = FX.C.split('\n')[0];
    await importTxt(page, 'a.txt', FX.A);
    const idB = await importLib(page, FX.B, 'Song B', 'chain_B');
    const idC = await importLib(page, FX.C, 'Song C', 'chain_C');
    await clickTab(page, 'review');
    st.push(await peek(page, '1 after .txt A, Library B, Library C'));
    let n = 0;
    while (n < 6 && (await text(page)).split('\n')[0] !== headA) {
      const h = await appUndoMouse(page);
      n++;
      await page.waitForTimeout(2500);
      st.push(await peek(page, `2.${n} ${h} #${n} +2.5s`));
    }
    const idA = st[st.length - 1].draftId;
    let m = 0;
    while (m < 6 && (await text(page)).split('\n')[0] !== headC) {
      const h = await appRedoMouse(page);
      m++;
      await page.waitForTimeout(2500);
      st.push(await peek(page, `3.${m} ${h} #${m} +2.5s`));
    }
    await reload(page);
    await clickTab(page, 'review');
    st.push(await peek(page, '4 after reload (C live)'));
    for (const [k, id] of [['A', idA], ['B', idB], ['C', idC]]) {
      const okk = id ? await openFromHistory(page, id) : false;
      await clickTab(page, 'review');
      st.push(await peek(page, `5${k} History tab: Open draft ${k} (${okk})`));
      if (k === 'B') {
        // C was current before B; reopen A again so C is opened from another draft
      }
    }
    const s5 = await search(page, ALL());
    await ctx.close();
    return { st, s6: s5, errors, idA, idB, idC, undoSteps: n, redoSteps: m };
  },
  // A .txt import onto a Library draft (same draft by the candidate's rule), then Undo.
  async txt_onto_lib(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    const idB = await importLib(page, FX.B, 'Song B', 'txtlib_B');
    await clickTab(page, 'review');
    st.push(await peek(page, '1 after Library import B (fresh page)'));
    await importTxt(page, 'a.txt', FX.A);
    await clickTab(page, 'review');
    st.push(await peek(page, '2 after .txt import A onto draft B (+1.5s)'));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(3000);
    st.push(await peek(page, `3 ${how} +3s (expect B text)`));
    const s3 = await search(page, ALL());
    await ctx.close();
    return { st, s3, errors, idB };
  },
  // Dismiss, then Undo across an edit made before it.
  async dismiss_undo(b, base) {
    const { ctx, page, errors } = await open(b, base);
    const st = [];
    await importTxt(page, 'a.txt', FX.A);
    await clickTab(page, 'review');
    st.push(await peek(page, '1 after .txt import A'));
    await page.evaluate(() => {
      const d = document.getElementById('lyrics-draft');
      d.focus();
      d.setSelectionRange(d.value.length, d.value.length);
    });
    await page.keyboard.type('\nA third sung line', { delay: 4 });
    await page.evaluate(() => document.getElementById('lyrics-draft').blur());
    await page.waitForTimeout(1200);
    await clickTab(page, 'review');
    st.push(await peek(page, '2 typed a third line, blur'));
    const btn = page.locator('[data-ui="ly-renumbered-dismiss"]');
    const n = await btn.count();
    if (n) await btn.first().click();
    await page.waitForTimeout(1000);
    st.push(await peek(page, `3 Dismiss clicked (${n} buttons)`));
    const how = await appUndoMouse(page);
    await page.waitForTimeout(1500);
    await clickTab(page, 'review');
    st.push(await peek(page, `4 ${how} +1.5s`));
    await ctx.close();
    return { st, errors };
  },
  // Card coordinates after a typed edit (no boundary), and after a reload.
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
    await clickTab(page, 'review');
    const s = await peek(page, `2 typed a sung line above sung line 1 at offset ${at}, blur`);
    s.pageSung = await page.evaluate(() => LY.model.sung.map((x) => `${x.n}:${x.text}`));
    st.push(s);
    await reload(page);
    await clickTab(page, 'review');
    const r = await peek(page, '3 after reload');
    r.pageSung = await page.evaluate(() => LY.model.sung.map((x) => `${x.n}:${x.text}`));
    st.push(r);
    await ctx.close();
    return { st, errors };
  },
  // Side check (rerun.js extra): Library source line and history after focus/blur, no edit.
  async extra(b, base) {
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
  // Side finding: a migrating Library import with declarations, no edit,
  // then Export -> Download text; a quiet import as control; a real edit as
  // the by-design control; the downloaded copy re-imported.
  async download(b, base) {
    const res = {};
    for (const [k, body, edit] of [['B_migrating', FX.B, false], ['BQ_quiet', BQ, false], ['BQ_quiet_edited', BQ, true]]) {
      const { ctx, page, errors } = await open(b, base);
      await importTxt(page, 'a.txt', FX.A);
      const id = await importLib(page, body, k, `dl_${k}`, DECL);
      const live = () => page.evaluate(() => ({ adapted: app.lyricMeta.libraryOrigin ? app.lyricMeta.libraryOrigin.adapted : null, declN: app.lyricMeta.libraryOrigin && Array.isArray(app.lyricMeta.libraryOrigin.declarations) ? app.lyricMeta.libraryOrigin.declarations.length : null, steps: app.history.map((x) => { const s = JSON.parse(x); return `${(s.lyrics || '').split('\n')[0].replace('[SETUP — title — ', '')}[ad=${s.lyricMeta && s.lyricMeta.libraryOrigin ? s.lyricMeta.libraryOrigin.adapted : null}]`; }), idx: app.historyIndex, rows: document.getElementById('lyrics-draft').value.split('\n').filter((l) => /^\[SETUP — (rhyme groups|returns)/.test(l)) }));
      const r = { draftId: id, afterImport: await live() };
      r.idbAfterImport = (await peek(page, 'idb')).idb.filter((x) => x.key === id).map((x) => ({ adapted: x.adapted, rows: x.rows, origTextHead: x.origTextHead }));
      if (edit) {
        await page.evaluate(() => {
          const d = document.getElementById('lyrics-draft');
          d.focus();
          d.setSelectionRange(d.value.length, d.value.length);
        });
        await page.keyboard.type(' again', { delay: 4 });
        await page.evaluate(() => document.getElementById('lyrics-draft').blur());
        await page.waitForTimeout(1200);
        r.afterEdit = await live();
      }
      r.dl1 = await downloadText(page, `${k}_dl1`);
      r.afterDl1 = await live();
      // the downloaded copy, imported back into a fresh page
      if (r.dl1.isEnvelope) {
        const { ctx: c2, page: p2, errors: e2 } = await open(b, base);
        const env = JSON.parse(fs.readFileSync(r.dl1.file, 'utf8'));
        await p2.setInputFiles('#ly-file', r.dl1.file);
        await p2.waitForFunction((x) => app.lyricMeta && app.lyricMeta.draftId === x, env.draftId, { timeout: 30000 });
        await p2.waitForTimeout(1500);
        r.reimported = await p2.evaluate(() => ({ adapted: app.lyricMeta.libraryOrigin.adapted, declarations: app.lyricMeta.libraryOrigin.declarations }));
        r.reimportErrors = e2;
        await c2.close();
      }
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
        for (const k of ['s3', 's4', 's6', 's8']) if (r[k]) console.log(k, JSON.stringify(r[k]));
        if (r.native) console.log('native', JSON.stringify(r.native));
        if (f === 'coords') r.st.forEach((s) => s.pageSung && console.log('pageSung', JSON.stringify(s.pageSung)));
        if (f === 'payload') for (const [k, v] of Object.entries(r)) console.log(k, JSON.stringify({ pre: JSON.parse(line(v.pre)), sent: v.sent, errors: v.errors }));
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
