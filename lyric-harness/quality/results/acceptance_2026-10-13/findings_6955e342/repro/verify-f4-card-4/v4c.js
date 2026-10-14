// verify-f4-card-4 (BB8 skeptic): Undo across a Library import vs A's card
// evidence. Written from scratch. Scratch only; trees are served read-only.
// Usage: node v4c.js <cand|main|base|prev61b|prev678> <scenario[,scenario...]>
// Scenarios:
//   U  txt A -> Library B (renumbers) -> app Undo (#btn-undo mouse) -> reload -> History opens
//   Q  txt A -> Library B0 (renumbers nothing) -> app Undo -> reload
//   K  as U but app Undo by Ctrl+Z with focus on BODY
//   N  txt A -> Library B -> NO Undo -> wait -> History "Open draft" A (control: is Undo the trigger?)
//   L  Library A -> Library B -> app Undo (A already a Library draft)
// Every scenario also plants, in A, three control values the card does not own:
//   brief  (in Undo's history snapshot: positive control),
//   drafts (a pending rhyme-tool member made by the page's own ly-link-add: user data NOT in the snapshot),
//   ui.probe (a display-state key the page does not own, as f4-card's c7 control did).
// Snapshots are PASSIVE: they read app/LY state, the DOM, Web Storage and raw
// IndexedDB (only when the database already exists), and call no page function.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { webcrypto } = require('crypto');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-4');
const TREES = { cand: 'wt-695', main: 'wt-main', base: 'wt-base', prev61b: 'wt-61b', prev678: 'wt-678' };
const TREE = process.argv[2] || 'cand';
const SCEN = (process.argv[3] || 'U').split(',');
const ROOT = path.join(S, TREES[TREE]);
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const LI = require(path.join(ROOT, 'src/library-import.js'));

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2' };
function server() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}

// ── Fixtures (new words; not the f4-card or check-library-undo-card pairs) ──
// v1 numbered "Oh--oh" as one word, the current cut as two: T4 -> T5 on the
// same characters, so the candidate's migration renumbers each member.
const song = (title, kind, a, b) => [`[SETUP — title — "${title}"]`, `[SETUP — ${kind} — 1.T4,2.T4]`, '', '[VERSE]', a, b].join('\n');
const A = song('Song A', 'rhyme groups', 'Oh--oh, oh my candle', 'Oh--oh, oh my handle');
const B = song('Song B', 'returns', 'Ah--ah, ah my velvet', 'Ah--ah, ah my helmet');
const B0 = ['[SETUP — title — "Song Quiet"]', '[SETUP — rhyme groups — 1,2]', '', '[VERSE]', 'the road is long and grey', 'the load is wrong today'].join('\n');
const WA = ['candle', 'handle'], WB = ['velvet', 'helmet'];

async function envelopeFile(text, title, tag) {
  const meta = {
    version: 1, brief: '', notes: {}, drafts: {}, ui: {},
    libraryOrigin: {
      version: 1, handoffId: 'handoff:' + webcrypto.randomUUID(), digest: 'b'.repeat(64), adapted: false,
      title, language: 'eng', scope: 'whole',
      provenance: { snapshotId: 'snap:v4', unitId: 'unit:v4', workId: 'work:v4', editionId: 'ed:v4', revisionId: 'rev:v4' },
      lineage: [], declarations: [],
    },
  };
  const env = await LI.makeWorkingCopyEnvelope(text, meta, webcrypto);
  const file = path.join(OUT, `env_${TREE}_${tag}.json`);
  fs.writeFileSync(file, JSON.stringify(env, null, 2));
  return { env, file };
}

// ── Page helpers ──────────────────────────────────────────────────────────
async function newPage(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // The chat service is a local stub: nothing reaches a provider or the network.
  await ctx.route(/mcp\.codexmusica\.com/, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  await page.goto(base + '/codex.html#lyrics');
  await ready(page);
  return { ctx, page, errors };
}
const ready = (page) =>
  page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
const draft = (page) => page.evaluate(() => document.getElementById('lyrics-draft').value);
async function importTxt(page, name, text, marker) {
  const before = await draft(page);
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction(([m, b]) => { const v = document.getElementById('lyrics-draft').value; return v !== b && v.includes(m); }, [marker, before], { timeout: 20000 });
  await page.waitForTimeout(800);
}
async function importLibrary(page, text, title, tag) {
  const { env, file } = await envelopeFile(text, title, tag);
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return env;
}
// A's control values: brief through the page's own brief form (one history
// step), a pending rhyme-tool member through the page's own action, and a
// display-state key the page does not own.
async function plantControls(page, label) {
  await page.click('[data-ui="ly-brief-edit"]');
  await page.fill('#ly-brief-text', `${label}-brief`);
  await page.click('[data-ui="ly-brief-save"]');
  await page.waitForTimeout(400);
  const ok = await page.evaluate((label) => {
    LY.activeLine = 1;
    LY_ACTIONS['ly-link-add']();
    app.lyricMeta.ui.probe = `${label}-probe`;
    uiAutosave();
    return { drafts: Object.keys(app.lyricMeta.drafts), brief: app.lyricMeta.brief, probe: app.lyricMeta.ui.probe };
  }, label);
  await page.waitForTimeout(900);
  return ok;
}
// PASSIVE snapshot.
const snap = (page) =>
  page.evaluate(async () => {
    const wordsOf = (r) => (r && Array.isArray(r.items) ? r.items.map((m) => `${m.word}:${m.from}->${m.to}`) : null);
    const pick = (meta) => meta && {
      draftId: meta.draftId || null,
      brief: meta.brief,
      drafts: Object.keys(meta.drafts || {}),
      probe: meta.ui ? meta.ui.probe || null : null,
      card: wordsOf(meta.ui && meta.ui.renumbered),
      more: meta.ui && meta.ui.renumbered ? meta.ui.renumbered.more : null,
    };
    const text = document.getElementById('lyrics-draft').value;
    let ls = null;
    try { ls = JSON.parse(localStorage.getItem('codex-workbench-v1') || 'null'); } catch (e) { ls = { error: String(e) }; }
    let idb = null;
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    if (dbs.some((d) => d.name === 'codex-musica-library-drafts')) {
      idb = await new Promise((res) => {
        const r = indexedDB.open('codex-musica-library-drafts');
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(['drafts'], 'readonly');
          const q = tx.objectStore('drafts').getAll();
          q.onsuccess = () => {
            db.close();
            res(q.result.map((d) => ({ head: (d.text || '').split('\n')[0], savedAt: d.savedAt, writer: !!d.writer, ...pick(d.meta) })));
          };
          q.onerror = () => { db.close(); res({ error: String(q.error) }); };
        };
        r.onerror = () => res({ error: String(r.error) });
      });
    }
    const hist = (app.history || []).map((h, i) => {
      try {
        const s = JSON.parse(h);
        return `${i === app.historyIndex ? '*' : ''}${(s.lyrics || '').split('\n')[0].replace(/^\[SETUP — title — /, '').replace(/\]$/, '') || '(empty)'}${s.lyricMeta && s.lyricMeta.draftId ? '@' + s.lyricMeta.draftId.slice(6, 14) : ''}${s.lyricMeta && 'ui' in s.lyricMeta ? '[ui]' : ''}${s.lyricMeta && s.lyricMeta.brief ? '[brief=' + s.lyricMeta.brief + ']' : ''}`;
      } catch (e) { return 'unparsable'; }
    });
    return {
      head: text.split('\n')[0],
      groupsRow: text.split('\n')[1],
      live: pick(app.lyricMeta),
      ls: ls && ls.lyricMeta ? { head: (ls.lyrics || '').split('\n')[0], ...pick(ls.lyricMeta) } : null,
      idb,
      hist,
    };
  });
// Where does any trace of a word's card entry survive? (localStorage, sessionStorage, IndexedDB all stores, app.history, live meta)
const traces = (page, words) =>
  page.evaluate(async (words) => {
    const pat = (w) => `"word":"${w}"`;
    const found = {};
    const add = (where, s) => { for (const w of words) if (s && s.includes(pat(w))) (found[w] = found[w] || []).push(where); };
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); add('localStorage:' + k, localStorage.getItem(k)); }
    for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); add('sessionStorage:' + k, sessionStorage.getItem(k)); }
    add('app.lyricMeta', JSON.stringify(app.lyricMeta));
    (app.history || []).forEach((h, i) => add('app.history[' + i + ']', h));
    const dbs = indexedDB.databases ? await indexedDB.databases() : [];
    for (const d of dbs) {
      await new Promise((res) => {
        const r = indexedDB.open(d.name);
        r.onsuccess = () => {
          const db = r.result;
          const names = [...db.objectStoreNames];
          if (!names.length) { db.close(); return res(); }
          const tx = db.transaction(names, 'readonly');
          for (const n of names) {
            const q = tx.objectStore(n).getAll();
            q.onsuccess = () => add(`idb:${d.name}/${n}`, JSON.stringify(q.result));
          }
          tx.oncomplete = () => { db.close(); res(); };
          tx.onerror = () => { db.close(); res(); };
        };
        r.onerror = () => res();
      });
    }
    return found;
  }, words);
// The rendered Review card, after a real click on the Review tab.
async function reviewCard(page) {
  await page.click('#ly-tab-review');
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    const t = (document.getElementById('ly-panel-review') || {}).innerText || '';
    const i = t.indexOf('renumbered to the current word cut');
    if (i < 0) return null;
    const j = t.indexOf('Dismiss this when you have checked them.', i);
    return t.slice(Math.max(0, t.lastIndexOf('\n', i)), j > 0 ? j : i + 600).trim();
  });
}
async function openFromHistory(page, draftId) {
  await page.click('#ly-tab-history');
  await page.waitForTimeout(500);
  const sel = `button[data-ui="ly-library-restore"][data-id="${draftId}"]`;
  if (!(await page.locator(sel).count())) return false;
  await page.click(sel);
  await page.waitForFunction((id) => app.lyricMeta.draftId === id, draftId, { timeout: 20000 });
  await page.waitForTimeout(1500);
  return true;
}
const line = (tag, s) => console.log(`  ${tag}: ${JSON.stringify(s)}`);

// ── Scenarios ─────────────────────────────────────────────────────────────
async function run(browser, base, name) {
  const { ctx, page, errors } = await newPage(browser, base);
  const log = { scenario: name, tree: TREE, steps: [] };
  const step = async (tag, extra = {}) => {
    const s = { tag, ...(await snap(page)), ...extra };
    log.steps.push(s);
    line(tag, s);
    return s;
  };
  console.log(`## ${TREE} ${name}`);
  try {
    let envA = null;
    if (name === 'L') {
      envA = await importLibrary(page, A, 'Song A', `${name}_A`);
    } else {
      await importTxt(page, 'a.txt', A, 'Song A');
    }
    log.controls = await plantControls(page, 'A');
    const sA = await step('1 A (controls planted)');
    const second = name === 'Q' ? B0 : B;
    const envB = await importLibrary(page, second, name === 'Q' ? 'Song Quiet' : 'Song B', `${name}_B`);
    const sB = await step('2 after Library import of ' + (name === 'Q' ? 'B0 (renumbers nothing)' : 'B'));
    const aId = name === 'L' ? envA.draftId : (sB.idb || []).find((d) => d.head.includes('Song A'))?.draftId;
    log.aId = aId;
    log.bId = envB.draftId;
    if (name === 'N') {
      await page.waitForTimeout(3000);
      await step('3 +3s, no Undo');
      const ok = await openFromHistory(page, aId);
      await step('4 History: Open draft A', { opened: ok, card: await reviewCard(page) });
    } else {
      let how;
      if (name === 'K') {
        await page.evaluate(() => document.activeElement && document.activeElement.blur && document.activeElement.blur());
        how = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
        await page.keyboard.press('Control+z');
      } else {
        how = 'mouse #btn-undo';
        await page.click('#btn-undo');
      }
      const t0 = Date.now();
      for (const ms of [30, 350, 800, 2000]) {
        const wait = ms - (Date.now() - t0);
        if (wait > 0) await page.waitForTimeout(wait);
        await step(`3 Undo (${how}) +${Date.now() - t0}ms`);
      }
      await step('4 Review tab clicked', { card: await reviewCard(page) });
      await page.reload();
      await ready(page);
      await page.waitForTimeout(1500);
      await step('5 after reload', { card: await reviewCard(page) });
      const okB = await openFromHistory(page, envB.draftId);
      await step('6 History: Open draft B', { opened: okB, card: await reviewCard(page) });
      const okA = await openFromHistory(page, aId);
      await step('7 History: Open draft A', { opened: okA, card: await reviewCard(page) });
    }
    log.traces = { A: await traces(page, WA), B: await traces(page, WB) };
    console.log('  traces of card entries: ' + JSON.stringify(log.traces));
  } catch (e) {
    log.error = String((e && e.stack) || e);
    console.log('ERROR ' + log.error);
  }
  log.pageErrors = errors;
  await ctx.close();
  return log;
}

(async () => {
  const srv = server();
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: TREE, root: ROOT, runs: [] };
  try {
    for (const name of SCEN) out.runs.push(await run(browser, base, name));
  } finally {
    fs.writeFileSync(path.join(OUT, `v4c_${TREE}_${SCEN.join('')}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    srv.close();
  }
})();
