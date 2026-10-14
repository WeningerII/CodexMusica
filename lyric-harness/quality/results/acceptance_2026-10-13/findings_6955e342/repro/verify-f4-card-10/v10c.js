// verify-f4-card-10 S5/S6: (S5) clean screenshots of the card once the toast
// has gone, at 1440 and 390 px, card scrolled to the middle of the viewport;
// (S6) which import paths mix entries: .txt A then Library B, Library A then
// .txt B. Usage: node v10c.js cand
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
const A = ['[SETUP — title — "Song A"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Oh--oh, oh my apple', 'Oh--oh, oh my anchor'].join('\n');
const B = ['[SETUP — title — "Song B"]', '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', 'Oh--oh, oh my bravo', 'Oh--oh, oh my banjo'].join('\n');
async function open(browser, phone) {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }));
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', (e) => page.__errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  return { ctx, page };
}
async function importTxt(page, name, text, marker) {
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction((m) => $ui('lyrics-draft').value.includes(m), marker, { timeout: 30000 });
  await page.waitForTimeout(600);
}
async function importLib(page, text, title, file) {
  const env = await page.evaluate(
    ([t, title]) =>
      CMLibraryImport.makeWorkingCopyEnvelope(t, {
        version: 1, brief: '', notes: {}, drafts: {}, ui: {},
        libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title, language: 'eng', scope: 'whole', provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' }, lineage: [], declarations: [] },
      }),
    [text, title]
  );
  fs.writeFileSync(file, JSON.stringify(env));
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
  await page.waitForTimeout(1200);
  fs.unlinkSync(file);
}
const words = (page) =>
  page.evaluate(() => {
    lyRefresh(true);
    const it = (LY.items || []).find((x) => x.id === 'renumbered');
    return it ? [...it.text.matchAll(/on “([^”]+)”/g)].map((m) => m[1]) : [];
  });
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { head: require('child_process').execSync(`git -C ${root} rev-parse HEAD`).toString().trim() };
  try {
    // S5
    const OH = 'Oh--oh, oh my love';
    const SONG = ['[SETUP — title — "Old Song"]', reading(2, 'oh', OH), '[SETUP — rhyme groups — 1.T4,2]', '[SETUP — returns — 1.T3,3.T3]', '', '[VERSE]', OH, 'You are the one I dream of my dove', OH].join('\n');
    out.S5 = {};
    for (const phone of [false, true]) {
      const { ctx, page } = await open(browser, phone);
      await importTxt(page, 'old.txt', SONG, 'Old Song');
      await page.waitForTimeout(3500); // past the 2,200 ms toast lifetime
      await page.evaluate(() => { LY_ACTIONS['ly-tab']('review'); lyRefresh(true); });
      const li = page.locator('#ly-panel-review li.ly-item', { hasText: 'renumbered to the current word cut' }).first();
      await li.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      const geo = await li.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const t = document.getElementById('toast');
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: innerWidth, vh: innerHeight, docScrollW: document.documentElement.scrollWidth, toastShown: !!(t && t.classList.contains('show')), dismissVisible: (() => { const b = el.querySelector('button[data-ui="ly-renumbered-dismiss"]'); if (!b) return null; const q = b.getBoundingClientRect(); const top = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!top && (top === b || b.contains(top)); })() };
      });
      await page.screenshot({ path: path.join(OUT, `S5_cand_${phone ? 'phone' : 'desktop'}_clean.png`) });
      out.S5[phone ? 'phone' : 'desktop'] = { geo, errors: page.__errors };
      console.log('S5', phone ? 'phone' : 'desktop', JSON.stringify(geo));
      await ctx.close();
    }
    // S6a: .txt A then Library B
    {
      const { ctx, page } = await open(browser, false);
      await importTxt(page, 'a.txt', A, 'Song A');
      const w1 = await words(page);
      await importLib(page, B, 'Song B', path.join(OUT, 'tmp_envB.json'));
      const w2 = await words(page);
      out.S6a = { afterTxtA: w1, afterLibB: w2, errors: page.__errors };
      console.log('S6a txtA->LibB', JSON.stringify(out.S6a));
      await ctx.close();
    }
    // S6b: Library A then .txt B
    {
      const { ctx, page } = await open(browser, false);
      await importLib(page, A, 'Song A', path.join(OUT, 'tmp_envA.json'));
      const w1 = await words(page);
      await importTxt(page, 'b.txt', B, 'Song B');
      const w2 = await words(page);
      out.S6b = { afterLibA: w1, afterTxtB: w2, errors: page.__errors };
      console.log('S6b LibA->txtB', JSON.stringify(out.S6b));
      await ctx.close();
    }
  } catch (e) {
    out.error = String(e && e.stack);
    console.log(out.error);
  } finally {
    fs.writeFileSync(path.join(OUT, 'v10c_cand.json'), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
