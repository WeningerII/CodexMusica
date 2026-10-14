// verify-f1-selection-6: shared helpers (written from scratch for this check).
// Serves a pinned tree; /codex.html is this folder's own CODEX_LIBRARY=1
// build of that tree (cmp-identical to the committed file, COMMANDS.txt).
// Every mcp.codexmusica.com request is answered locally; nothing leaves.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S='/workspace';
const OUT=__dirname;
const {chromium}=require('/workspace/acceptance-code/node_modules/playwright');
const TREES={cand:'acceptance-code'};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
async function startServer(tree) {
  const root = path.join(S, TREES[tree]);
  const built = path.join(root, 'acceptance.html');
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return fs.createReadStream(built).pipe(res);
    }
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
// MODE: 'headless' (default, full chrome in new headless), 'headed' (needs
// an X display, run under xvfb-run), 'shell' (chromium_headless_shell).
function launch(mode = process.env.MODE || 'headless') {
  const exe = mode === 'shell' ? '/usr/bin/chromium_headless_shell-1194/chrome-linux/headless_shell' : '/usr/bin/chromium';
  return chromium.launch({ headless: mode !== 'headed', executablePath: exe, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}
async function boot(browser, base, { width = 1440, height = 900 } = {}) {
  const q = { calls: [] };
  const ctx = await browser.newContext({ viewport: { width, height } });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      await new Promise((res) => setTimeout(res, 60));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(400);
  return { ctx, page, q, errors };
}
// Text arriving as a paste would: value set, saved, one step, refresh run.
const setDraft = (page, text) =>
  page.evaluate((t) => {
    const d = $ui('lyrics-draft');
    d.value = t;
    uiSaveLyrics();
    pushHistory();
    lyRefresh(true);
  }, text);
const sel = (page) =>
  page.evaluate(() => {
    const d = $ui('lyrics-draft');
    const a = document.activeElement;
    return { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection], active: a === d ? 'draft' : (a && (a.dataset?.ui || a.id || a.tagName)) || null };
  });
const parse = (page, t) =>
  page.evaluate((t) => {
    const m = lyParse(t);
    return { setup: m.setup.map((s) => s.raw), decl: JSON.parse(JSON.stringify(lyDeclarationsOf(m))) };
  }, t);
async function idle(page) {
  await page.waitForTimeout(250);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(250);
}
module.exports = { fs, path, S, OUT, TREES, chromium, startServer, launch, boot, setDraft, sel, parse, idle };
