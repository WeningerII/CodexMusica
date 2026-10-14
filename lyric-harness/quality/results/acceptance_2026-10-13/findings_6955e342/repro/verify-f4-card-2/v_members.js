// verify-f4-card-2: control for the tester's "main already truncates at 40 in
// two live member lists". Renders the rhyme-link form's member list
// (lyToolRhymes) with a pending member on a 57-char word and a whole-line member,
// on the given tree. Usage: node v_members.js <cand|main|base|prev61b>
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-2');
const TREES = { cand: 'wt-695', main: 'wt-main', base: 'wt-base', prev61b: 'wt-61b' };
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREE = process.argv[2] || 'main';
const root = path.join(S, TREES[TREE]);
const WORD = 'supercalifragilisticexpialidociousantidisestablishmentbaa';
const TEXT = ['[SETUP — title — "members"]', '', '[VERSE]', `Oh my ${WORD}`, 'And here is a sung line that is longer than forty characters'].join('\n');
(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404), res.end();
    res.writeHead(200, { 'Content-Type': /\.html$/.test(f) ? 'text/html; charset=utf-8' : /\.js$/.test(f) ? 'application/javascript' : /\.json$/.test(f) ? 'application/json' : 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await browser.newContext();
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  const r = await page.evaluate(([t]) => {
    const d = document.getElementById('lyrics-draft');
    d.value = t;
    uiSaveLyrics();
    lyRefresh(true);
    lyDraftSet('rhymes', 'song', 'members', [{ line: 1, place: 'T3' }, { line: 2, place: 'line' }]);
    const html = lyToolRhymes(LY.model);
    const div = document.createElement('div');
    div.innerHTML = html;
    const lis = [...div.querySelectorAll('ul.ly-members li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim());
    return { lis, word3: lyMemberWord(LY.model, { line: 1, place: 'T3' }) };
  }, [TEXT]);
  console.log(JSON.stringify({ tree: TREE, ...r }, null, 1));
  fs.writeFileSync(path.join(OUT, `v_members_${TREE}.json`), JSON.stringify({ tree: TREE, ...r }, null, 1));
  await browser.close();
  server.close();
})().catch((e) => {
  console.log('ERROR', e.stack || e);
  process.exit(1);
});
