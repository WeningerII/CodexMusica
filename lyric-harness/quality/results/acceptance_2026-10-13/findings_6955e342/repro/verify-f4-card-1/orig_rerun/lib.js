// F4 Review-card acceptance helpers (BB8 team, label f4-card). Scratch only.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-1/orig_rerun');
const TREES = {
  cand: path.join(S, 'wt-695'),
  main: path.join(S, 'wt-main'),
  prev: path.join(S, 'wt-678'),
};
const { chromium } = require(path.join(TREES.cand, 'node_modules/playwright'));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain',
};
// One origin per run; the served tree root can be switched.
function serve(state) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const root = state.root;
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(f).pipe(res);
  });
}
async function start(tree = 'cand') {
  const state = { root: TREES[tree] };
  const server = serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  return { state, server, url, browser };
}
const results = [];
function record(id, claim, expected, observed, ok, extra) {
  const status = ok === null ? 'cannot_tell' : ok ? 'pass' : 'fail';
  results.push({ id, claim, expected, observed, status, ...(extra ? { extra } : {}) });
  console.log(
    `[${status.toUpperCase()}] ${id}: ${claim}\n    expected: ${expected}\n    observed: ${typeof observed === 'string' ? observed : JSON.stringify(observed)}`
  );
  return ok;
}
async function newCtx(browser, q = { calls: [], replies: [] }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // The chat service is a local stub: never a provider.
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      const next = q.replies.shift() || { reply: 'ok', history: [], sig: 'x' };
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify(next) });
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
    document.addEventListener('DOMContentLoaded', () =>
      mo.observe(document.body, { subtree: true, childList: true, characterData: true })
    );
  });
  return ctx;
}
async function waitReady(page) {
  await page.waitForFunction(
    () => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model,
    null,
    { timeout: 90000 }
  );
}
async function open(ctx, url, errors) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors && errors.push(e.message));
  await page.goto(url);
  await waitReady(page);
  return page;
}
const draftOf = (page) => page.evaluate(() => $ui('lyrics-draft').value);
const setDraft = (page, text) =>
  page.evaluate((t) => {
    $ui('lyrics-draft').value = t;
    uiSaveLyrics();
    pushHistory();
    lyRefresh(true);
  }, text);
const toasts = (page) => page.evaluate(() => window.__toastLog.splice(0));
// A .txt import through the Lyrics page's own file input.
async function importTxt(page, name, text, marker) {
  const before = await draftOf(page);
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction(
    ([m, b]) => $ui('lyrics-draft').value !== b && $ui('lyrics-draft').value.includes(m),
    [marker, before],
    { timeout: 20000 }
  );
  await page.waitForTimeout(400);
}
// A Library working-copy envelope made by the page's own function (as the
// Lyrics "download" does for a Library draft), saved to disk, then imported
// through the same file input as a .json file (lyLibraryImport).
async function makeEnvelope(page, text, title) {
  return page.evaluate(
    async ([t, title]) => {
      const meta = {
        version: 1,
        brief: '',
        notes: {},
        drafts: {},
        ui: {},
        libraryOrigin: {
          version: 1,
          handoffId: 'handoff:' + crypto.randomUUID(),
          digest: '0'.repeat(64),
          importedAt: Date.now(),
          adapted: false,
          title,
          language: 'eng',
          scope: 'whole',
          provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' },
          lineage: [],
          declarations: [],
        },
      };
      return CMLibraryImport.makeWorkingCopyEnvelope(t, meta);
    },
    [text, title]
  );
}
async function importLibrary(page, envelope, file) {
  fs.writeFileSync(file, JSON.stringify(envelope, null, 2));
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, envelope.draftId, {
    timeout: 30000,
  });
  await page.waitForTimeout(1200);
}
// The renumbered card: the page's own item, the rendered Review pane text,
// and what the page context holds.
const card = (page) =>
  page.evaluate(() => {
    lyRefresh(true);
    const item = (LY.items || []).find((x) => x.id === 'renumbered') || null;
    LY_ACTIONS['ly-tab']('review');
    const pane = $ui('ly-panel-review').innerText;
    const r = app.lyricMeta && app.lyricMeta.ui && app.lyricMeta.ui.renumbered;
    return {
      item: item && { title: item.title, text: item.text, tone: item.tone, category: item.category, where: item.where, actions: item.actions },
      pane,
      meta: r ? JSON.parse(JSON.stringify(r)) : null,
      uiLen: JSON.stringify((app.lyricMeta && app.lyricMeta.ui) || {}).length,
      draftId: app.lyricMeta.draftId || null,
    };
  });
const stored = (page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}');
    return { lyrics: s.lyrics, renumbered: s.lyricMeta && s.lyricMeta.ui ? s.lyricMeta.ui.renumbered || null : null, ui: s.lyricMeta && s.lyricMeta.ui, draftId: s.lyricMeta && s.lyricMeta.draftId };
  });
const idbDrafts = (page) =>
  page.evaluate(async () => {
    const list = lyLibraryStore ? await lyLibraryStore.listDrafts() : [];
    const out = [];
    for (const d of list) {
      const full = await lyLibraryStore.getDraft(d.draftId);
      out.push({
        draftId: d.draftId,
        title: full && full.title,
        textHead: full && full.text ? full.text.slice(0, 80) : null,
        renumbered: full && full.meta && full.meta.ui ? full.meta.ui.renumbered || null : null,
      });
    }
    return out;
  });
async function settle(page, ms = 900) {
  await page.waitForTimeout(ms);
}

// ── Independent truth ──────────────────────────────────────────────────
// Sung lines of a text (my own reading: every non-blank row that is not a
// bracketed row), numbered from 1.
function sungLines(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const t = raw.trim();
    if (!t || /^\[.*\]$/.test(t)) continue;
    out.push(raw);
  }
  return out;
}
const READING = /^\[SETUP — reading — token (\d+) ("(?:[^"\\]|\\.)*") in ("(?:[^"\\]|\\.)*")/;
const GROUP = /^\[SETUP — (rhyme groups|returns) — (.*?)( — cut v2)?\]$/;
// The pre-release page's own word regex (main 8b1d2ad2 src/library-import.js),
// used as an independent v1 word list for the simple lines generated here.
const v1Words = (line) =>
  (line.replace(/\([^)]*\)/g, ' ').match(/(?:[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]|['’‘-])+/g) || []).filter((w) =>
    /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/.test(w)
  );
// Diff the saved rows of `before` (as imported) and `after` (the draft the
// page saved): every reading / group member whose number changed.
function truthFromRows(before, after) {
  const a = before.split('\n'),
    b = after.split('\n');
  if (a.length !== b.length) throw new Error('row count changed');
  const sung = sungLines(after);
  const entries = [];
  for (let i = 0; i < a.length; i++) {
    const x = a[i],
      y = b[i];
    if (x === y) continue;
    let m1 = READING.exec(x),
      m2 = READING.exec(y);
    if (m1 && m2) {
      const line = JSON.parse(m1[3]);
      const n = [];
      sung.forEach((s, k) => s === line && n.push(k + 1));
      if (Number(m1[1]) !== Number(m2[1]))
        entries.push({ kind: 'reading', word: JSON.parse(m1[2]), n, line, from: Number(m1[1]), to: Number(m2[1]) });
      continue;
    }
    m1 = GROUP.exec(x);
    m2 = GROUP.exec(y);
    if (m1 && m2 && m1[1] === m2[1]) {
      const ma = m1[2].split(/[;,]/).map((s) => s.trim());
      const mb = m2[2].split(/[;,]/).map((s) => s.trim());
      if (ma.length !== mb.length) throw new Error('member count changed in row ' + i);
      for (let k = 0; k < ma.length; k++) {
        const p = /^(\d+)\.T(\d+)$/.exec(ma[k]),
          q = /^(\d+)\.T(\d+)$/.exec(mb[k]);
        if (p && q && p[2] !== q[2])
          entries.push({ kind: m1[1], word: v1Words(sung[Number(p[1]) - 1] || '')[Number(p[2]) - 1], line: Number(p[1]), n: [Number(p[1])], from: Number(p[2]), to: Number(q[2]), lineText: sung[Number(p[1]) - 1] });
      }
      continue;
    }
    entries.push({ kind: 'other-change', row: i, before: x, after: y });
  }
  return entries;
}

module.exports = {
  fs, path, S, OUT, TREES, chromium, start, results, record, newCtx, waitReady, open, draftOf, setDraft,
  toasts, importTxt, v1Words, makeEnvelope, importLibrary, card, stored, idbDrafts, settle, sungLines, truthFromRows,
};
