// BB8 verify-page-matrix-2: what the Lyrics page (candidate vs main) does to a
// hand-written / pre-batch `N.end` member in a [SETUP — returns — …] row, and
// what declarations it puts in the /chat request. /chat is stubbed in-page;
// no provider is reached. Scratch only.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h678/verify-page-matrix-2');
const { chromium } = require(path.join(S, 'wt-678/node_modules/playwright'));
const TREES = { main: path.join(S, 'wt-main'), cand: path.join(S, 'wt-678') };
const SONG = [
  '[VERSE]',
  'Oh--oh, oh my love',
  'Thundered the battery’s double bass--',
  'My love--love is true',
  'You hold my heart.    10',
  '',
  '[CHORUS]',
  'I walk the line tonight',
  'Well-worn shoes upon the floor',
  'Stay with me (oh--oh) tonight',
  'Hold me (hold me) close--close tonight',
].join('\n');
const ROWS = [
  ['R1 returns 4.end,6.end (L4 numeral end, cut changed)', '[SETUP — returns — 4.end,6.end]'],
  ['R2 returns 4,6 (bare, whole line)', '[SETUP — returns — 4,6]'],
  ['R3 returns 4.end,6.end already marked cut v2', '[SETUP — returns — 4.end,6.end — cut v2]'],
  ['R4 returns 5.end,6.end (unchanged lines)', '[SETUP — returns — 5.end,6.end]'],
  ['R5 returns 5.end,6.end;1.T4,8.T4 (unchanged N.end + T row-mate)', '[SETUP — returns — 5.end,6.end;1.T4,8.T4]'],
  ['R6 returns 4.head,6.head (named non-end place, cut changed)', '[SETUP — returns — 4.head,6.head]'],
  ['G1 rhyme groups 4.end,6 (rhyme row for contrast)', '[SETUP — rhyme groups — 4.end,6]'],
];
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
async function one(browser, base, row) {
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
  const before = await page.evaluate(() => {
    lyRefresh(true);
    const text = $ui('lyrics-draft').value;
    const m = lyParse(text);
    const d = lyDeclarationsOf(m);
    return {
      rows: text.split('\n').filter((r) => /^\[SETUP/.test(r)),
      saved_rows: (JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics || '').split('\n').filter((r) => /^\[SETUP/.test(r)),
      decl: { groups: d.groups, returns: d.returns, returns_need_decision: d.returns_need_decision, groups_need_decision: d.groups_need_decision },
      notices: (LY.items || []).filter((i) => /returns|rhyme groups|carried/.test(i.id)).map((i) => `${i.tone} | ${i.id} | ${i.title}`),
      declaredReturnsView: (() => { try { LY_ACTIONS['ly-tool']('repeats-voices'); const el = document.querySelector('#ly-panel-tools') || document.body; const t = el.innerText; const k = t.indexOf('Declared returns'); return k >= 0 ? t.slice(k, k + 200) : null; } catch (e) { return 'ERR ' + e; } })(),
    };
  });
  const r = await page.evaluate(async () => { try { await LY_ACTIONS['ly-run-review'](); return 'ok'; } catch (e) { return String(e); } });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  await ctx.close();
  return { before, review: r, chat_calls: calls.length, sent: calls.map((c) => c.lyric_context?.declarations || null), errors };
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const res = [];
  for (const [label, root] of Object.entries(TREES)) {
    const server = serve(root);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [name, row] of ROWS) {
      const o = await one(browser, base, row);
      res.push({ tree: label, name, written: row, ...o });
      console.log(`[${label}] ${name}\n  written : ${row}\n  on load : ${o.before.rows.join(' | ')}\n  notices : ${JSON.stringify(o.before.notices)}\n  view    : ${JSON.stringify(o.before.declaredReturnsView)}\n  decl    : ${JSON.stringify(o.before.decl)}\n  /chat   : calls=${o.chat_calls} declarations.returns=${JSON.stringify(o.sent.map((s) => s && s.returns))} declarations.groups=${JSON.stringify(o.sent.map((s) => s && s.groups))}\n  errors  : ${JSON.stringify(o.errors)}`);
    }
    server.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'page_end_returns.json'), JSON.stringify(res, null, 1));
})();
