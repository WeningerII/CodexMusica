// verify-f4-card-10 S2b: in one overflowing import, which entries does the
// card drop, in what order did the page find them, and are the three the
// toast names among the dropped? Also N sweep (10/40/60/200) on one import.
// Usage: node v10b.js cand
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-10');
const root = path.join(S, 'wt-695');
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/codex.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return res.writeHead(404), res.end();
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const reading = (tok, word, line) => `[SETUP — reading — token ${tok} ${JSON.stringify(word)} in ${JSON.stringify(line)} — OW1 — declared — source: me]`;
const W = (i) => 'w' + String.fromCharCode(97 + Math.floor(i / 26)) + String.fromCharCode(97 + (i % 26)) + 'en';
function song(N) {
  const lines = [];
  for (let i = 0; i < N; i++) lines.push(`Oh--oh, oh my ${W(i)}`);
  const groups = [];
  for (let i = 0; i + 1 < N; i += 2) groups.push(`[SETUP — rhyme groups — ${i + 1}.T4,${i + 2}.T4]`);
  // Returns rows LAST in the text, readings in the middle, groups first.
  const rets = [];
  for (let i = 0; i + 1 < N; i += 2) rets.push(`[SETUP — returns — ${i + 1}.T3,${i + 2}.T3]`);
  return ['[SETUP — title — "Sweep"]', ...groups, ...lines.map((l) => reading(2, 'oh', l)), ...rets, '', '[VERSE]', ...lines].join('\n');
}
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { head: require('child_process').execSync(`git -C ${root} rev-parse HEAD`).toString().trim(), runs: [] };
  try {
    for (const N of [10, 20, 30, 100]) {
      const SONG = song(N);
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
      await ctx.addInitScript(() => {
        window.__toasts = [];
        document.addEventListener('DOMContentLoaded', () =>
          new MutationObserver(() => {
            const t = document.getElementById('toast');
            const s = t && t.innerText;
            if (s && window.__toasts[window.__toasts.length - 1] !== s) window.__toasts.push(s);
          }).observe(document.body, { subtree: true, childList: true, characterData: true })
        );
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(url);
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
      // The page's own scan order for this exact text (pure function).
      const order = await page.evaluate((t) => {
        const d = lyMigrateSavedReadings(t);
        const m = lyParse(d.text);
        return d.moved.map((x) => ({ kind: x.kind, word: x.word, n: x.kind === 'reading' ? m.sung.filter((s) => s.text === x.line).map((s) => s.n) : [x.n], from: x.from, to: x.to }));
      }, SONG);
      await page.evaluate(() => window.__toasts.splice(0));
      await page.setInputFiles('#ly-file', { name: 'sweep.txt', mimeType: 'text/plain', buffer: Buffer.from(SONG, 'utf8') });
      await page.waitForFunction(() => $ui('lyrics-draft').value.includes('"Sweep"'), null, { timeout: 30000 });
      await page.waitForTimeout(600);
      const st = await page.evaluate(() => {
        lyRefresh(true);
        const it = (LY.items || []).find((x) => x.id === 'renumbered');
        return { toasts: window.__toasts.slice(), title: it && it.title, text: it && it.text, meta: JSON.parse(JSON.stringify(app.lyricMeta.ui.renumbered || null)) };
      });
      const key = (m) => `${m.kind}|${m.word}|${m.n.join('.')}|${m.from}>${m.to}`;
      const listed = new Set(st.meta.items.map(key));
      const droppedIdx = order.map((m, i) => (listed.has(key(m)) ? -1 : i)).filter((i) => i >= 0);
      const run = {
        N,
        moved: order.length,
        listed: st.meta.items.length,
        more: st.meta.more,
        title: st.title,
        moreClause: (st.text.match(/; and [^.]*no longer listed/) || [null])[0],
        droppedAreScanPrefix: droppedIdx.every((v, i) => v === i),
        droppedKinds: droppedIdx.reduce((a, i) => ((a[order[i].kind] = (a[order[i].kind] || 0) + 1), a), {}),
        toastNamesFirstThreeOfScan: order.slice(0, 3).map((m) => ({ ...m, droppedFromCard: !listed.has(key(m)) })),
        toastSaysReviewListsEach: st.toasts.some((t) => /Review lists each one until you dismiss it/.test(t)),
        toasts: st.toasts,
        textRowOrder: 'groups rows, then reading rows, then returns rows',
        errors,
      };
      out.runs.push(run);
      console.log(JSON.stringify({ ...run, toasts: undefined }));
      await ctx.close();
    }
  } catch (e) {
    out.error = String(e && e.stack);
    console.log(out.error);
  } finally {
    fs.writeFileSync(path.join(OUT, 'v10b_cand.json'), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
