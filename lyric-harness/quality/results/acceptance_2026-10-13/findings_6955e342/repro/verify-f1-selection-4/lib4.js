// verify-f1-selection-4: own helpers (independent of h695/f1-selection's f1lib.js).
// Serves one tree's directory, but /codex.html is answered with THIS folder's
// fresh build of that tree (built-<tree>.html, checked byte-equal to the
// tree's committed codex.html in COMMANDS.txt; base cannot build without
// node_modules, so its committed codex.html is served). Every
// mcp.codexmusica.com request is stubbed locally; no provider is reached.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const O = path.join(S, 'h695/verify-f1-selection-4');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREES = { cand: 'wt-695', main: 'wt-main', base: 'wt-base', c61b: 'wt-61b' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain' };
function pageFile(tree) {
  const built = path.join(O, `built-${TREES[tree]}.html`);
  return fs.existsSync(built) ? built : path.join(S, TREES[tree], 'codex.html');
}
async function serve(tree) {
  const root = path.join(S, TREES[tree]);
  const html = pageFile(tree);
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') {
      res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-store' });
      return fs.createReadStream(html).pipe(res);
    }
    const f = path.join(root, p);
    if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { srv, base: `http://127.0.0.1:${srv.address().port}`, html };
}
const launch = () => chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
async function open(browser, base) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    const rq = r.request();
    if (/\/chat$/.test(rq.url()) && rq.method() === 'POST') {
      calls.push(JSON.parse(rq.postData() || '{}'));
      await new Promise((ok) => setTimeout(ok, 60));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof LY !== 'undefined' && !!LY.model && typeof $ui === 'function' && !!$ui('lyrics-draft'), null, { timeout: 90000 });
  await page.waitForTimeout(500);
  return { ctx, page, calls, errors };
}
const editorState = (page) =>
  page.evaluate(() => {
    const d = $ui('lyrics-draft');
    return { text: d.value, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection], focused: document.activeElement === d };
  });
module.exports = { fs, path, S, O, TREES, serve, launch, open, editorState, pageFile };
