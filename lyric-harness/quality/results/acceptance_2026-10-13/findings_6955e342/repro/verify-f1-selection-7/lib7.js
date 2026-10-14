// verify-f1-selection-7: independent helpers (scratch only, no tracked file is touched).
// Serves a tree's root with /codex.html replaced by the page built in ./build
// (cmp-identical to the tree's committed codex.html, COMMANDS.txt), stubs
// every mcp.codexmusica.com request locally (no provider is reached), drives
// Chromium at /opt/pw-browsers/chromium.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f1-selection-7');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREES = { cand: 'wt-695', main: 'wt-main', base: 'wt-base', c61b: 'wt-61b', c678: 'wt-678' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.woff2': 'font/woff2' };
async function startServer(tree) {
  const root = path.join(S, TREES[tree]);
  const built = path.join(OUT, 'build', `built-${TREES[tree]}.html`);
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return fs.createReadStream(built).pipe(res);
    }
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const launch = () => chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function boot(browser, base, { width = Number(process.env.VW || 390), height = Number(process.env.VH || 844), mobile = process.env.VMOBILE !== '0', init = null } = {}) {
  const q = { calls: [], replies: [] };
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 3 : 1 });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(r.request().postData() || '');
      const next = q.replies.shift() || { reply: 'Noted.', history: [], sig: 'x' };
      await new Promise((res) => setTimeout(res, 80));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify(next) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  return { ctx, page, q, errors };
}
const setDraft = (page, text) => page.evaluate((t) => { $ui('lyrics-draft').value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); }, text);
const st = (page) => page.evaluate(() => { const d = $ui('lyrics-draft'); return { text: d.value, sel: [d.selectionStart, d.selectionEnd], focused: document.activeElement === d, mobile: LY.mobile, size: LY.size, songCaret: LY.songCaret || null, caretRow: LY.caretRow ?? null, activeLine: LY.activeLine ?? null }; });
async function waitIdle(page) {
  await page.waitForTimeout(250);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(200);
}
function show(text, s, e) {
  const rs = text.lastIndexOf('\n', s - 1) + 1;
  let re = text.indexOf('\n', e);
  if (re < 0) re = text.length;
  if (s === e) return text.slice(rs, s) + '|' + text.slice(s, re);
  return text.slice(rs, s) + '«' + text.slice(s, e) + '»' + text.slice(e, re);
}
// Activate a mobile tab / button the way `via` says.
async function activate(page, kind, id, via) {
  const sel = kind === 'tab' ? `#ly-mtab-${id}` : `[data-ui="${id}"]:visible`;
  if (via === 'prog') {
    if (kind === 'tab') return page.evaluate((i) => LY_ACTIONS['ly-mobile'](i), id);
    return page.evaluate((i) => LY_ACTIONS[i](), id);
  }
  const loc = page.locator(sel).first();
  if (via === 'click') return loc.click();
  if (via === 'touch') return loc.tap();
  if (via === 'kbd') { await loc.focus(); return page.keyboard.press('Enter'); }
  throw new Error('via ' + via);
}
module.exports = { fs, path, S, OUT, TREES, startServer, launch, boot, setDraft, st, waitIdle, show, activate };
