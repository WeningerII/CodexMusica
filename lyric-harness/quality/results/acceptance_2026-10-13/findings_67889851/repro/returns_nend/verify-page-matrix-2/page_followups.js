// BB8 verify-page-matrix-2: follow-ups to page_end_returns.js.
//  K1 cand: unmarked `4.end,6.end` -> Keep the link (Review notice) -> row and /chat.
//  F1 main: unmarked `4.end,6.end` -> Repeats form adds 2.head,3.head -> row and /chat (pre-existing form path).
//  F2 cand: MARKED `4.end,6.end — cut v2` -> Repeats form adds 2.head,3.head -> row and /chat.
//  F3 main/cand: does the Repeats "Placed returns" form offer 'end' at all?
// /chat is stubbed; no provider. Scratch only.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h678/verify-page-matrix-2');
const { chromium } = require(path.join(S, 'wt-678/node_modules/playwright'));
const TREES = { main: path.join(S, 'wt-main'), cand: path.join(S, 'wt-678') };
const SONG = ['[VERSE]', 'Oh--oh, oh my love', 'Thundered the battery’s double bass--', 'My love--love is true', 'You hold my heart.    10', '', '[CHORUS]', 'I walk the line tonight', 'Well-worn shoes upon the floor', 'Stay with me (oh--oh) tonight', 'Hold me (hold me) close--close tonight'].join('\n');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain' };
function serve(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(''); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
async function open(browser, base, row) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      calls.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'stub', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/robots.txt`).catch(() => {});
  const session = { version: 1, name: 'bb8', cards: [], lyrics: `${row}\n\n${SONG}`, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: { tab: 'tools', tool: 'repeats-voices', outline: true } } };
  await page.evaluate((s) => localStorage.setItem('codex-workbench-v1', s), JSON.stringify(session));
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(300);
  return { ctx, page, calls, errors };
}
const rowOf = (page) => page.evaluate(() => { lyRefresh(true); return $ui('lyrics-draft').value.split('\n').filter((r) => /^\[SETUP/.test(r)); });
async function review(o) {
  const n = o.calls.length;
  await o.page.evaluate(async () => { try { await LY_ACTIONS['ly-run-review'](); } catch (e) {} });
  await o.page.waitForTimeout(500);
  await o.page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  return o.calls.slice(n).map((c) => c.lyric_context?.declarations?.returns ?? null);
}
async function placedAdd(page, members) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
  const offered = await page.evaluate(() => [...(document.querySelectorAll('#ly-placed-place option') || [])].map((o) => o.value));
  for (const [line, place] of members) {
    await page.evaluate((n) => { LY.activeLine = n; lyRefresh(true); }, line);
    await page.evaluate(() => { const d = $ui('ly-placed-place')?.closest('details'); if (d && !d.open) d.open = true; });
    await page.selectOption('#ly-placed-place', place);
    await page.click('[data-ui="ly-placed-add"]');
  }
  await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
  await page.waitForTimeout(250);
  return offered;
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const res = {};
  const servers = {};
  const bases = {};
  for (const [k, root] of Object.entries(TREES)) {
    servers[k] = serve(root);
    await new Promise((r) => servers[k].listen(0, '127.0.0.1', r));
    bases[k] = `http://127.0.0.1:${servers[k].address().port}`;
  }
  try {
    // K1
    {
      const o = await open(browser, bases.cand, '[SETUP — returns — 4.end,6.end]');
      const loaded = await rowOf(o.page);
      const items = await o.page.evaluate(() => (LY.items || []).filter((i) => /carried/.test(i.id)).map((i) => ({ id: i.id, text: i.text, actions: i.actions.map((a) => [a[0], a[3]]) })));
      const keepId = items[0]?.actions.find((a) => a[0] === 'ly-carried-keep')?.[1];
      await o.page.evaluate((id) => LY_ACTIONS['ly-carried-keep'](id), keepId);
      const afterKeep = await rowOf(o.page);
      const notices = await o.page.evaluate(() => (LY.items || []).filter((i) => /carried/.test(i.id)).length);
      const sent = await review(o);
      res.K1 = { loaded, notice: items[0], afterKeep, carriedNoticesAfterKeep: notices, sent, errors: o.errors };
      console.log(`[cand] K1 4.end,6.end -> load ${JSON.stringify(loaded)}\n   notice text: ${items[0]?.text}\n   after Keep: ${JSON.stringify(afterKeep)} (carried notices left ${notices})\n   /chat returns: ${JSON.stringify(sent)}`);
      await o.ctx.close();
    }
    // F1 main form path, F2 cand marked row form path
    for (const [k, row, id] of [['main', '[SETUP — returns — 4.end,6.end]', 'F1'], ['cand', '[SETUP — returns — 4.end,6.end — cut v2]', 'F2']]) {
      const o = await open(browser, bases[k], row);
      const loaded = await rowOf(o.page);
      const sent0 = await review(o);
      const offered = await placedAdd(o.page, [[2, 'head'], [3, 'head']]);
      const after = await rowOf(o.page);
      const sent1 = await review(o);
      res[id] = { tree: k, written: row, loaded, sentBeforeForm: sent0, placedPlacesOffered: offered, afterForm: after, sentAfterForm: sent1, errors: o.errors };
      console.log(`[${k}] ${id} ${row}\n   load ${JSON.stringify(loaded)} -> /chat ${JSON.stringify(sent0)}\n   Placed-returns places offered: ${JSON.stringify(offered)}\n   after Repeats form add 2.head,3.head: ${JSON.stringify(after)} -> /chat ${JSON.stringify(sent1)}`);
      await o.ctx.close();
    }
  } catch (e) { console.log('threw', e.stack || e); }
  for (const s of Object.values(servers)) s.close();
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'page_followups.json'), JSON.stringify(res, null, 1));
})();
