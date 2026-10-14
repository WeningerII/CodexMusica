// Candidate page's own pure migration (lyMigrateSavedReadings) + declarations
// on every `N.end,6.head` returns row, voices off and on. No storage written.
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const root = path.join(S, 'wt-678');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const SONG = ['[VERSE]', 'Oh--oh, oh my love', 'Thundered the battery’s double bass--', 'My love--love is true', 'You hold my heart.    10', '', '[CHORUS]', 'I walk the line tonight', 'Well-worn shoes upon the floor', 'Stay with me (oh--oh) tonight', 'Hold me (hold me) close--close tonight'].join('\n');
const server = http.createServer((req, res) => { let p = req.url.split('?')[0]; if (p === '/') p = '/codex.html'; const f = path.join(root, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof lyMigrateSavedReadings === 'function', null, { timeout: 90000 });
  const res = await page.evaluate((SONG) => {
    const out = [];
    for (const voices of [false, true])
      for (const n of [1, 2, 3, 4, 5, 7, 8]) {
        const head = voices ? '[SETUP — voices — parentheses are sung]\n' : '';
        const row = `[SETUP — returns — ${n}.end,6.head]`;
        const text = `${head}${row}\n\n${SONG}`;
        const done = lyMigrateSavedReadings(text);
        const after = done.text.split('\n').find((r) => r.includes('returns'));
        out.push({ cell: `R|v${voices ? 1 : 0}|L${n}|end`, after, sends: lyDeclarationsOf(lyParse(done.text)).returns, carried: done.carried.length });
      }
    return out;
  }, SONG);
  for (const r of res) console.log(`${r.cell.padEnd(14)} -> ${r.after}  | sends ${r.sends} | carried ${r.carried}`);
  await browser.close(); server.close();
})();
