// verify-page-rules-6, part 3: how the candidate page reads the text that
// scenario B left behind (keystrokes appended to the SETUP row).
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const ROOT = path.join(S, 'wt-678');
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const B = JSON.parse(fs.readFileSync(path.join(__dirname, 'caret2_cand.json'), 'utf8')).B.text;
(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404), res.end();
    res.writeHead(200, { 'Content-Type': path.extname(f) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  const r = await page.evaluate((t) => {
    const m = lyParse(t);
    const d = lyDeclarationsOf(m);
    return { sung: m.sung.map((s) => s.text), setup: m.setup.map((s) => s.raw), groups: d.groups || null };
  }, B);
  console.log(JSON.stringify(r, null, 2));
  fs.writeFileSync(path.join(__dirname, 'parse_final.out.json'), JSON.stringify({ input: B, ...r }, null, 2));
  await browser.close();
  server.close();
})().catch((e) => (console.error(e), process.exit(1)));
