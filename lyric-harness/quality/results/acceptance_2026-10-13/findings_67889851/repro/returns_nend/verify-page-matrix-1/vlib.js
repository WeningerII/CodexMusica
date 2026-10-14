// BB8 verify-page-matrix-1: own page driver (scratch only, no tracked file touched).
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const TREES = { cand: path.join(S, 'wt-678'), main: path.join(S, 'wt-main') };
const OUT = path.join(S, 'h678/verify-page-matrix-1');
const { chromium } = require(path.join(TREES.cand, 'node_modules/playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.txt': 'text/plain' };
function serve(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
const LINES = [
  'Oh--oh, oh my love',
  'Thundered the battery’s double bass--',
  'My love--love is true',
  'You hold my heart.    10',
  'I walk the line tonight',
  'Well-worn shoes upon the floor',
  'Stay with me (oh--oh) tonight',
  'Hold me (hold me) close--close tonight',
];
const SONG = `[VERSE]\n${LINES.slice(0, 4).join('\n')}\n\n[CHORUS]\n${LINES.slice(4).join('\n')}`;
const session = (lyrics) => JSON.stringify({ version: 1, name: 'Untitled session', cards: [], lyrics, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: { tab: 'review', outline: true } } });
async function boot(browser, base, lyrics) {
  const q = { calls: [] };
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  // /chat is a local stub (records the request body, never a provider).
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  await ctx.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => {
      const t = document.getElementById('toast');
      const s = t && t.innerText;
      if (s && window.__toasts[window.__toasts.length - 1] !== s) window.__toasts.push(s);
    }).observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/robots.txt`).catch(() => {});
  await page.evaluate((s) => localStorage.setItem('codex-workbench-v1', s), session(lyrics));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(500);
  return { ctx, page, q, errors };
}
const state = (page, key) => page.evaluate((key) => {
  lyRefresh(true);
  LY_ACTIONS['ly-tab']('review');
  const text = $ui('lyrics-draft').value;
  const d = lyDeclarationsOf(lyParse(text));
  const keep = ['groups', 'returns', 'groups_need_decision', 'returns_need_decision'];
  return {
    row: text.split('\n').find((r) => r.includes(`— ${key} —`)) || null,
    decl: Object.fromEntries(keep.filter((k) => d[k] !== undefined).map((k) => [k, d[k]])),
    items: (LY.items || []).filter((i) => i.id.startsWith(key + ':')).map((i) => ({ id: i.id, tone: i.tone, title: i.title, actions: (i.actions || []).map((a) => a[1]) })),
    saved: JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics?.split('\n').find((r) => r.includes(`— ${key} —`)) || null,
  };
}, key);
async function runReview(page, q) {
  const n = q.calls.length;
  await page.evaluate(() => window.__toasts.splice(0));
  const ret = await page.evaluate(async () => { try { const r = await LY_ACTIONS['ly-run-review'](); return r === undefined ? 'undefined' : JSON.parse(JSON.stringify(r)); } catch (e) { return { threw: String(e) }; } });
  await page.waitForTimeout(600);
  await page.waitForFunction(() => typeof chatState === 'undefined' || !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  const calls = q.calls.slice(n);
  return { ret, calls: calls.length, decl: calls.map((c) => c.lyric_context?.declarations || null), toasts: await page.evaluate(() => window.__toasts.splice(0)) };
}
module.exports = { fs, path, S, TREES, OUT, chromium, serve, SONG, LINES, boot, state, runReview };
