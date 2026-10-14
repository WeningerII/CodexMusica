// How the candidate page reads the row after the writer's next two keys,
// observed (caret at 77: "cut v2ZQ") vs the same-characters caret (65: "2.ZQend").
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const ROOT = process.argv[2];
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const ROWS = {
  observed_77: '[SETUP — returns — 1.end (carried across the word-cut change), 2.end — cut v2ZQ]',
  same_chars_65: '[SETUP — returns — 1.end (carried across the word-cut change), 2.ZQend — cut v2]',
  untouched: '[SETUP — returns — 1.end (carried across the word-cut change), 2.end — cut v2]',
};
(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404), res.end('nf');
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : p.endsWith('.js') ? 'application/javascript' : 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  for (const [k, row] of Object.entries(ROWS)) {
    const r = await page.evaluate((t) => {
      const m = lyParse(t);
      const rows = lySetupOf(m, 'returns').map((d) => ({ value: d.value, cut: d.cut || null, unknownCut: d.unknownCut || null }));
      const decl = lyDeclarationsOf(m);
      const refusal = typeof lyUndecidedRefusal === 'function' ? lyUndecidedRefusal(m) : 'n/a';
      return { rows, decl: JSON.parse(JSON.stringify(decl)), refusal };
    }, `${row}\n\n${BODY}`);
    console.log(k, JSON.stringify(r));
  }
  await browser.close(); server.close();
})().catch((e) => (console.error(e), process.exit(1)));
