// Control for trees whose typing refresh migrates (61b6618a, 67889851): the
// unmarked row is put in the draft WITHOUT an input event (value set, no
// refresh), the selection set on 2.end with the editor focused, then one
// boundary/refresh runs. Where does the selection land, and on what text?
// Usage: node ctl_noinput.js <label> ; triggers: refresh (lyRefresh(true)), reviewProg, reviewKbd
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const O = path.join(S, 'h695/verify-f1-selection-2');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const TREES = { cand: 'wt-695', c61b: 'wt-61b', c678: 'wt-678', main: 'wt-main', base: 'wt-base' };
const LABEL = process.argv[2];
const ROOT = path.join(S, TREES[LABEL]);
const PAGE = path.join(O, 'built', `built-${TREES[LABEL]}.html`);
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const ROW = '[SETUP — returns — 1.T2, 2.end]';
const DOC = `${ROW}\n\n${BODY}`;
const show = (t, a, b) => { const ls = t.lastIndexOf('\n', a - 1) + 1; let le = t.indexOf('\n', b); if (le < 0) le = t.length; return a === b ? t.slice(ls, a) + '|' + t.slice(a, le) : t.slice(ls, a) + '«' + t.slice(a, b) + '»' + t.slice(b, le); };
(async () => {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return fs.createReadStream(PAGE).pipe(res); }
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = [];
  for (const trig of ['refresh', 'reviewProg', 'reviewKbd'])
    for (const [name, s, e] of [['caret_2.|end', 27, 27], ['sel_2end', 25, 30]]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: r.request().method() === 'POST' ? JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) : '{"ok":true}' }));
      const page = await ctx.newPage();
      await page.goto(`${base}/codex.html#lyrics`);
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
      await page.waitForTimeout(400);
      const pre = await page.evaluate(([doc, s, e]) => { const d = document.getElementById('lyrics-draft'); d.focus(); d.value = doc; d.setSelectionRange(s, e); return { text: d.value, sel: [d.selectionStart, d.selectionEnd] }; }, [DOC, s, e]);
      if (trig === 'refresh') await page.evaluate(() => lyRefresh(true));
      else if (trig === 'reviewProg') await page.evaluate(() => LY_ACTIONS['ly-run-review']());
      else { await page.locator('[data-ui="ly-run-review"]:visible').first().focus(); await page.keyboard.press('Enter'); }
      await page.waitForTimeout(700);
      const post = await page.evaluate(() => { const d = document.getElementById('lyrics-draft'); return { text: d.value, sel: [d.selectionStart, d.selectionEnd], len: d.value.length }; });
      const r = { id: `${LABEL}.${trig}.${name}`, before: { sel: pre.sel, shown: show(pre.text, pre.sel[0], pre.sel[1]) }, after: { sel: post.sel, len: post.len, row1: post.text.split('\n')[0], shown: show(post.text, post.sel[0], post.sel[1]) } };
      out.push(r);
      console.log(JSON.stringify(r));
      await ctx.close();
    }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(O, `ctl_noinput_${LABEL}.json`), JSON.stringify(out, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
