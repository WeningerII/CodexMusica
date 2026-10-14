// verify-f4-card-12: independent helpers (written from scratch; mechanics only
// informed by reading the page source). Scratch only; serves tree roots read-only.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-12');
const TREES = { cand: 'wt-695', main: 'wt-main', prev61b: 'wt-61b', prev678: 'wt-678' };
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

async function boot(tree) {
  const root = path.join(S, TREES[tree]);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.normalize(path.join(root, p));
    if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  return { tree, root, server, browser, url, async close() { await browser.close(); server.close(); } };
}
async function context(env) {
  const ctx = await env.browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
  // Any call to the hosted service is answered locally; no provider, no network.
  await ctx.route(/codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  await ctx.addInitScript(() => {
    window.__toasts = [];
    const watch = () => {
      const t = document.getElementById('toast');
      if (!t) return;
      const s = t.innerText.trim();
      if (s && window.__toasts[window.__toasts.length - 1] !== s) window.__toasts.push(s);
    };
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(watch).observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  return ctx;
}
async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 120000 });
  await page.waitForTimeout(500);
}
async function openPage(ctx, env, errs) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 300)));
  await page.goto(env.url);
  await ready(page);
  return page;
}
const draft = (page) => page.evaluate(() => document.getElementById('lyrics-draft').value);
async function importTxt(page, name, text) {
  const before = await draft(page);
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction((b) => document.getElementById('lyrics-draft').value !== b, before, { timeout: 30000 });
  await page.waitForTimeout(700);
}
// A Library working copy built by the page's own CMLibraryImport, imported
// through the Lyrics file input as .json (lyLibraryImport -> receiver).
async function importLibrary(page, text, title, file) {
  const env = await page.evaluate(([t, title]) => CMLibraryImport.makeWorkingCopyEnvelope(t, {
    version: 1, brief: '', notes: {}, drafts: {}, ui: {},
    libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title, language: 'eng', scope: 'whole',
      provenance: { snapshotId: 'snap:v12', unitId: 'unit:v12', workId: 'work:v12', editionId: 'ed:v12', revisionId: 'rev:v12' }, lineage: [], declarations: [] },
  }), [text, title]);
  fs.writeFileSync(file, JSON.stringify(env));
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
  await page.waitForTimeout(1500);
  return env.draftId;
}
async function importSession(page, session, file) {
  fs.writeFileSync(file, JSON.stringify(session));
  const before = await draft(page);
  await page.setInputFiles('#ui-file', file);
  await page.waitForFunction((b) => document.getElementById('lyrics-draft').value !== b, before, { timeout: 30000 });
  await page.waitForTimeout(800);
}
async function undo(page) {
  await page.evaluate(() => LY_ACTIONS['ly-undo']());
  await page.waitForTimeout(900);
}
async function redo(page) {
  await page.evaluate(() => LY_ACTIONS['ly-redo']());
  await page.waitForTimeout(900);
}
async function reload(page) {
  await page.waitForTimeout(900);
  await page.reload();
  await ready(page);
  await page.waitForTimeout(900);
}
// What the page holds and shows for the renumbered card.
const cardState = (page) =>
  page.evaluate(() => {
    const r = app.lyricMeta && app.lyricMeta.ui ? app.lyricMeta.ui.renumbered : undefined;
    const item = typeof lyRenumberedCheck === 'function' ? lyRenumberedCheck() : null;
    let pane = '';
    try {
      LY_ACTIONS['ly-tab']('review');
      pane = (document.getElementById('ly-panel-review') || {}).innerText || '';
    } catch (e) { pane = 'ERR ' + e.message; }
    return {
      stored: r ? JSON.parse(JSON.stringify(r)) : null,
      title: item ? item.title : null,
      text: item ? item.text : null,
      paneHasCard: /renumbered to the current word cut/.test(pane),
      pane,
      draftId: (app.lyricMeta && app.lyricMeta.draftId) || null,
      head: document.getElementById('lyrics-draft').value.split('\n')[0],
      uiLen: JSON.stringify((app.lyricMeta && app.lyricMeta.ui) || {}).length,
      ui: JSON.parse(JSON.stringify((app.lyricMeta && app.lyricMeta.ui) || {})),
      histLen: app.history.length, histIdx: app.historyIndex,
    };
  });
const toasts = (page) => page.evaluate(() => window.__toasts.splice(0));
const idb = (page) =>
  page.evaluate(async () => {
    if (typeof lyLibraryStore === 'undefined' || !lyLibraryStore) return [];
    const out = [];
    for (const d of await lyLibraryStore.listDrafts()) {
      const full = await lyLibraryStore.getDraft(d.draftId);
      out.push({ draftId: d.draftId, head: full && full.text ? full.text.split('\n')[0] : null, ui: full && full.meta ? full.meta.ui || null : null });
    }
    return out;
  });
const words = (st) => (st && st.stored && Array.isArray(st.stored.items) ? st.stored.items.map((m) => m.word) : []);
const log = [];
function rec(id, claim, expected, observed, verdict) {
  const line = `[${verdict}] ${id}: ${claim}\n    expected: ${expected}\n    observed: ${typeof observed === 'string' ? observed : JSON.stringify(observed)}`;
  console.log(line);
  log.push({ id, claim, expected, observed, verdict });
}
module.exports = { fs, path, S, OUT, boot, context, openPage, ready, draft, importTxt, importLibrary, importSession, undo, redo, reload, cardState, toasts, idb, words, rec, log };
