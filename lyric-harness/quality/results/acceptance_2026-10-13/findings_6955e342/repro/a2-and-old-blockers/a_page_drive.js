// (a) A.2-six in the shipped page: for each line, a draft whose rhyme groups /
// returns row names `1.end` on that line is OPENED (uiLyricsOpened, the open
// boundary, as check_lyrics_page step 9 does), then Run review is sent to a
// local /chat stub. Records the row as rewritten, the Review notice, and the
// declaration on the wire. Usage: node a_page_drive.js <tree-root> <html> <out.json>
'use strict';
const fs = require('fs'); const path = require('path'); const http = require('http');
const [ROOT, HTML, OUT] = process.argv.slice(2);
const { chromium } = require(path.join(ROOT, 'node_modules/playwright'));
const UNION = '/home/user/CodexMusica/lyric-harness/quality/results/acceptance_2026-10-13/findings_67889851/six_lines/union.json';
const RECEIPT = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-695/lyric-harness/quality/results/named_place_lookup_2026-10-14/result.json';
const union = JSON.parse(fs.readFileSync(UNION, 'utf8')).rows.map((r) => r.text);
const receipt = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'));
const lines = [...new Set([...union, ...receipt.lookup_differs.map((x) => x.line)])];
const controls = ['We sing it plain tonight', 'Below the knap, a runnèn still;', receipt.label_nfc_only[0].line];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.gz': 'application/gzip' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/' + HTML;
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${HTML}#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const calls = [];
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      calls.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'no fixture', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && !!LY.model, null, { timeout: 60000 });
  const hasFn = await page.evaluate(() => typeof lyLineCutChanged === 'function');
  const results = [];
  for (const line of [...lines, ...controls]) {
    for (const key of ['rhyme groups', 'returns']) {
      const pre = `[SETUP — ${key} — 1.end,2.end]\n\n[VERSE]\n${line}\nWe sing it plain`;
      const got = await page.evaluate((t) => {
        $ui('lyrics-draft').value = t;
        if (typeof uiLyricsOpened === "function") uiLyricsOpened(); else if (typeof lyEnsureTokenScheme === "function") lyEnsureTokenScheme(); uiSaveLyrics(); pushHistory(); lyRefresh(true);
        LY_ACTIONS['ly-tab']('review');
        return { text: $ui('lyrics-draft').value, review: $ui('ly-panel-review').innerText,
          fires: typeof lyLineCutChanged === 'function' ? lyLineCutChanged(t.split('\n')[3], false) : null };
      }, pre);
      const n0 = calls.length;
      await page.evaluate(() => LY_ACTIONS['ly-run-review']());
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
      const body = calls.length > n0 ? calls[calls.length - 1] : null;
      const wire = body ? JSON.stringify(body).match(/"(groups|returns|rhyme_groups)":("[^"]*"|\[[^\]]*\]|null)/g) : null;
      const notice = got.review.split('\n').filter((l) => /carried|word-cut|cut change|earlier cut|may have changed/i.test(l));
      results.push({ line, key, fires: got.fires, row_after_open: got.text.split('\n')[0], notice, wire, sent: !!body,
        body_keys: body ? Object.keys(body) : null, decl: body && (body.declarations || (body.context && body.context.declarations) || null) });
      await page.evaluate(() => { try { LY_ACTIONS['ly-tab']('tools'); } catch (e) {} });
    }
  }
  fs.writeFileSync(OUT, JSON.stringify({ root: ROOT, html: HTML, hasFn, errs, results }, null, 1));
  const s = results.map((r) => `${r.fires}\t${r.key}\t${r.row_after_open}\t${r.notice.length}\t${JSON.stringify(r.wire)}\t${r.line}`);
  console.log(`hasFn=${hasFn} errs=${errs.length}\n` + s.join('\n'));
  await browser.close(); server.close();
})().catch((e) => { console.error(e); process.exit(1); });
