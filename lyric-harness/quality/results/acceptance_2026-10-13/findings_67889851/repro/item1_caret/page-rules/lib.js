// Shared helpers for the page-rules acceptance run (BB8). Scratch only.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const WT_CAND = path.join(S, 'wt-678');
const WT_MAIN = path.join(S, 'wt-main');
const OUT = path.join(S, 'h678/page-rules');
const { chromium } = require(path.join(WT_CAND, 'node_modules/playwright'));

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
// One origin; the served tree can be switched (a site upgrade under the same
// origin, so the browser's saved session carries across, as for a real user).
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

const results = [];
function record(id, claim, expected, observed, ok, extra) {
  const status = ok === null ? 'cannot_tell' : ok ? 'pass' : 'fail';
  results.push({ id, claim, expected, observed, status, ...(extra ? { extra } : {}) });
  console.log(`[${status.toUpperCase()}] ${id}: ${claim}\n    expected: ${expected}\n    observed: ${typeof observed === 'string' ? observed : JSON.stringify(observed)}`);
  return ok;
}

async function newCtx(browser, q) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // The chat service is a local stub: never a provider.
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      const next = q.replies.shift() || { reply: 'ok', history: [], sig: 'x' };
      await new Promise((res) => setTimeout(res, 100));
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
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, {
    timeout: 90000,
  });
}
const draftOf = (page) => page.evaluate(() => $ui('lyrics-draft').value);
const savedOf = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics || '');
const setDraft = (page, text) =>
  page.evaluate((t) => {
    $ui('lyrics-draft').value = t;
    uiSaveLyrics();
    pushHistory();
    lyRefresh(true);
  }, text);
const reviewText = (page) =>
  page.evaluate(() => {
    LY_ACTIONS['ly-tab']('review');
    return $ui('ly-panel-review').innerText;
  });
const reviewItems = (page) =>
  page.evaluate(() =>
    (LY.items || []).map((i) => ({ id: i.id, tone: i.tone, title: i.title, where: i.where, text: i.text, actions: (i.actions || []).map((a) => [a[0], a[1], a[3]]) }))
  );
const toasts = (page) => page.evaluate(() => window.__toastLog.splice(0));

module.exports = { fs, path, S, WT_CAND, WT_MAIN, OUT, chromium, serve, results, record, newCtx, waitReady, draftOf, savedOf, setDraft, reviewText, reviewItems, toasts };
