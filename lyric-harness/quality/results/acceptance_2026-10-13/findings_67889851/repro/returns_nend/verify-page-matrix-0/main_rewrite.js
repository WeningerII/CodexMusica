// BB8 verify-page-matrix-0: is the `.end` drop pre-existing on the baseline
// page? On wt-main (8b1d2ad2) and on the candidate, type a returns row whose
// members sit on UNCHANGED lines only (5.end,6.end: the candidate's load
// leaves it alone), then let a user action rewrite the row: (a) move a
// section, (b) apply the Repeats form adding an unrelated placed return.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h678/verify-page-matrix-0');
const TREES = { main: path.join(S, 'wt-main'), cand: path.join(S, 'wt-678') };
const { chromium } = require(path.join(TREES.cand, 'node_modules/playwright'));
const SONG = ['[VERSE]', 'Oh--oh, oh my love', 'Thundered the battery’s double bass--', 'My love--love is true', 'You hold my heart.    10', '', '[CHORUS]', 'I walk the line tonight', 'Well-worn shoes upon the floor', 'Stay with me (oh--oh) tonight', 'Hold me (hold me) close--close tonight'].join('\n');
const ROW = '[SETUP — returns — 5.end,6.end]';
function serve(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(f)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
const rowOf = (page) => page.evaluate(() => { lyRefresh(true); const t = $ui('lyrics-draft').value; return { row: t.split('\n').find((r) => r.startsWith('[SETUP') && r.includes('returns')), decl: lyDeclarationsOf(lyParse(t)).returns }; });
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = {};
  for (const [tree, root] of Object.entries(TREES)) {
    for (const action of ['move', 'repeats-form']) {
      const server = serve(root);
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
      await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#lyrics`);
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
      await page.locator('#lyrics-draft').fill(`${ROW}\n\n${SONG}`);
      await page.waitForTimeout(800);
      const before = await rowOf(page);
      if (action === 'move') {
        await page.evaluate(() => LY_ACTIONS['ly-tool']('form-story'));
        await page.click('[data-ui="ly-sec-move"][data-id="1:-1"]');
      } else {
        await page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
        for (const n of [2, 3]) {
          await page.evaluate((n) => { LY.activeLine = n; lyRefresh(true); }, n);
          await page.evaluate(() => { const d = $ui('ly-placed-place')?.closest('details'); if (d) d.open = true; });
          await page.selectOption('#ly-placed-place', 'head');
          await page.click('[data-ui="ly-placed-add"]');
        }
        await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
      }
      await page.waitForTimeout(400);
      const after = await rowOf(page);
      out[`${tree}|${action}`] = { before, after };
      console.log(`[${tree}] ${action}: before ${before.row} (sends ${before.decl}) -> after ${after.row} (sends ${after.decl})`);
      await ctx.close();
      server.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'main_rewrite.json'), JSON.stringify(out, null, 1));
})();
