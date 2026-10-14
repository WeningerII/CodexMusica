// Shared helpers for BB8 f1-selection (candidate 6955e342 / code 643e292e).
// Scratch only: serves a pinned tree's committed codex.html (checked equal to
// a CODEX_LIBRARY=1 build, COMMANDS.txt), stubs every mcp.codexmusica.com
// request locally (no provider is reached), drives Chromium.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/f1-selection');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREES = {
  cand: path.join(S, 'wt-695'),
  main: path.join(S, 'wt-main'),
  c678: path.join(S, 'wt-678'),
  c61b: path.join(S, 'wt-61b'),
};
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
  '.woff2': 'font/woff2',
};
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
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
async function startServer(root) {
  const state = { root };
  const server = serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { state, server, base: `http://127.0.0.1:${server.address().port}` };
}
async function launch() {
  return chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}
async function newCtx(browser, q, { width = 1440, height = 900, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, isMobile: mobile, hasTouch: mobile });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      const next = q.replies.shift() || { reply: 'Noted.', history: [], sig: 'x' };
      await new Promise((res) => setTimeout(res, 80));
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
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  return ctx;
}
async function waitReady(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
}
// session: a saved session object, written to this origin's storage before
// the page first loads (a returning user's session).
async function boot(browser, base, { session = null, hash = '#lyrics', ...vp } = {}) {
  const q = { replies: [], calls: [] };
  const ctx = await newCtx(browser, q, vp);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (session !== null) {
    await page.goto(`${base}/robots.txt`);
    await page.evaluate((s) => localStorage.setItem('codex-workbench-v1', s), typeof session === 'string' ? session : JSON.stringify(session));
  }
  await page.goto(`${base}/codex.html${hash}`);
  await waitReady(page);
  await page.waitForTimeout(400);
  return { ctx, page, q, errors };
}
// The draft as the writer would have it after typing or pasting (no
// boundary): value set, saved, one history step, the refresh run.
const setDraft = (page, text) =>
  page.evaluate((t) => {
    $ui('lyrics-draft').value = t;
    uiSaveLyrics();
    pushHistory();
    lyRefresh(true);
  }, text);
const state = (page) =>
  page.evaluate(() => {
    const d = $ui('lyrics-draft');
    return {
      text: d.value,
      sel: [d.selectionStart, d.selectionEnd, d.selectionDirection],
      focused: document.activeElement === d,
      hist: app.history.map((h) => JSON.parse(h).lyrics),
      histIdx: app.historyIndex,
      appLyrics: app.lyrics,
      saved: (() => {
        try {
          return JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics ?? null;
        } catch (e) {
          return 'ERR ' + e;
        }
      })(),
      renumbered: app.lyricMeta?.ui?.renumbered || null,
      caretRow: LY.caretRow,
      activeLine: LY.activeLine,
    };
  });
const toasts = (page) => page.evaluate(() => window.__toastLog.splice(0));
// How the page itself reads a text: sung lines, [SETUP] rows, declarations.
const parseAsPage = (page, text) =>
  page.evaluate((t) => {
    const m = lyParse(t);
    const d = lyDeclarationsOf(m);
    return { sung: m.sung.map((s) => s.text), setup: m.setup.map((s) => s.raw), decl: JSON.parse(JSON.stringify(d)) };
  }, text);
async function waitIdle(page) {
  await page.waitForTimeout(250);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(150);
}
const results = [];
function record(id, claim, expected, observed, ok, extra) {
  const status = ok === null ? 'cannot_tell' : ok ? 'pass' : 'fail';
  results.push({ id, claim, expected, observed, status, ...(extra ? { extra } : {}) });
  console.log(`[${status.toUpperCase()}] ${id}: ${claim}\n    expected: ${expected}\n    observed: ${typeof observed === 'string' ? observed : JSON.stringify(observed)}`);
  return ok;
}
module.exports = { fs, path, S, OUT, TREES, chromium, serve, startServer, launch, newCtx, waitReady, boot, setDraft, state, toasts, parseAsPage, waitIdle, results, record };
