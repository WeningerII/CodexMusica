// verify-page-matrix-5 (BB8 skeptic): unrecognised member annotations on the
// Lyrics page, candidate vs main. Own script. /chat stubbed in-page; no provider.
'use strict';
const fs = require('fs'), http = require('http'), path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h678/verify-page-matrix-5');
const { chromium } = require(path.join(S, 'wt-678/node_modules/playwright'));
const TREES = { cand: path.join(S, 'wt-678'), main: path.join(S, 'wt-main') };
const LINES = ['Oh--oh, oh my love', 'Thundered the battery’s double bass--', 'My love--love is true', 'You hold my heart.    10', 'I walk the line tonight', 'Well-worn shoes upon the floor', 'Stay with me (oh--oh) tonight', 'Hold me (hold me) close--close tonight'];
const TEXT = `[VERSE]\n${LINES.slice(0, 4).join('\n')}\n\n[CHORUS]\n${LINES.slice(4).join('\n')}`;
const CASES = [
  ['B1 T member + bare cut tail', '[SETUP — rhyme groups — 1.T4,6 — cut]'],
  ['B2 T member + mark with trailing note', '[SETUP — rhyme groups — 1.T4,6 — cut v2 (checked)]'],
  ['B3 T member + mark missing space', '[SETUP — rhyme groups — 1.T4,6 —cut v2]'],
  ['B4 CONTROL T member + proper mark', '[SETUP — rhyme groups — 1.T4,6 — cut v2]'],
];
const _OLD = [
  ['A1 U6 groups 1.head (kept) unmarked', '[SETUP — rhyme groups — 1.head (kept),6]'],
  ['A2 U7 groups 1.T4 (carried…) cut v2', '[SETUP — rhyme groups — 1.T4 (carried across the word-cut change),6 — cut v2]'],
  ['A3 U8 returns 1.head (numbered under…) cut v2', '[SETUP — returns — 1.head (numbered under the earlier cut),6.head — cut v2]'],
  ['A4 U12 groups 1,6 — cut', '[SETUP — rhyme groups — 1,6 — cut]'],
  ['A5 returns 1.head (kept) unmarked', '[SETUP — returns — 1.head (kept),6.head]'],
  ['A6 groups misspelt carried marker', '[SETUP — rhyme groups — 5 (carried across the word cut change),6 — cut v2]'],
  ['A7 CONTROL groups 1.T4 (numbered under…) cut v2', '[SETUP — rhyme groups — 1.T4 (numbered under the earlier cut),6 — cut v2]'],
  ['A8 CONTROL groups 1,6 cut v3', '[SETUP — rhyme groups — 1,6 — cut v3]'],
  ['A9 groups reopened U12 output', '[SETUP — rhyme groups — 1 (carried across the word-cut change),6 — cut — cut v2]'],
  ['A10 groups 5,6 — cut (unchanged line 5)', '[SETUP — rhyme groups — 5,6 — cut]'],
  ['A11 groups 1.T4 (numbered under…) unmarked row', '[SETUP — rhyme groups — 1.T4 (numbered under the earlier cut),6]'],
  ['A12 groups plain typo 1.hed,6 cut v2', '[SETUP — rhyme groups — 1.hed,6 — cut v2]'],
];
function serve(root) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(root, p);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    const ext = path.extname(f);
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css' }[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
async function ctxFor(browser, calls) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      calls.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  await ctx.addInitScript(() => {
    window.__t = [];
    const orig = () => {
      const t = document.getElementById('toast');
      if (t && t.innerText && window.__t[window.__t.length - 1] !== t.innerText) window.__t.push(t.innerText);
    };
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(orig).observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  return ctx;
}
const ready = (page) => page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
const state = (page) => page.evaluate(() => {
  lyRefresh(true);
  const text = $ui('lyrics-draft').value;
  const m = lyParse(text);
  const d = lyDeclarationsOf(m);
  const keep = ['groups', 'returns', 'groups_need_decision', 'returns_need_decision'];
  LY_ACTIONS['ly-tab']('review');
  return {
    row: text.split('\n').find((r) => /^\[SETUP/.test(r)) || null,
    decl: Object.fromEntries(keep.filter((k) => d[k] !== undefined).map((k) => [k, d[k]])),
    gate: typeof lyUndecidedRefusal === 'function' ? lyUndecidedRefusal(m) : '(no gate fn on this page)',
    items: (LY.items || []).filter((i) => /^(rhyme groups|returns)/.test(i.id)).map((i) => ({ id: i.id, tone: i.tone, title: i.title, text: i.text, actions: (i.actions || []).map((a) => a[1]) })),
    reviewHas: (() => { const t = $ui('ly-panel-review').innerText; return { pointsAt: /points at/.test(t), carried: /carried across/.test(t) }; })(),
  };
});
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const all = {};
  for (const [tree, root] of Object.entries(TREES)) {
    const server = serve(root);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    all[tree] = [];
    for (const [name, row] of CASES) {
      for (const route of ['typed', 'reopened']) {
        const calls = [];
        const ctx = await ctxFor(browser, calls);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`${base}/codex.html#lyrics`);
        await ready(page);
        const draft = `${row}\n\n${TEXT}`;
        if (route === 'typed') {
          await page.evaluate((t) => { $ui('lyrics-draft').value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); }, draft);
        } else {
          // saved session holding the text, page reopened
          await page.evaluate((t) => { $ui('lyrics-draft').value = t; uiSaveLyrics(); }, draft);
          await page.evaluate((t) => { const s = JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}'); s.lyrics = t; localStorage.setItem('codex-workbench-v1', JSON.stringify(s)); }, draft);
          await page.reload();
          await ready(page);
        }
        await page.waitForTimeout(300);
        await page.evaluate(() => window.__t.splice(0));
        const before = await state(page);
        const n = calls.length;
        const ret = await page.evaluate(async () => { try { return await LY_ACTIONS['ly-run-review'](); } catch (e) { return 'threw ' + e; } });
        await page.waitForTimeout(400);
        await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
        const sent = calls.slice(n).map((c) => { const d = c.lyric_context?.declarations || {}; return { groups: d.groups, returns: d.returns, groups_need_decision: d.groups_need_decision, returns_need_decision: d.returns_need_decision, draftHead: (c.lyric_context?.document || c.lyric_context?.draft || '').toString().split('\n')[0] }; });
        const toasts = await page.evaluate(() => window.__t.splice(0));
        const rec = { name, route, written: row, ...before, runReviewReturn: ret, chatCalls: sent.length, sent, toasts, errors };
        all[tree].push(rec);
        console.log(`[${tree}/${route}] ${name}\n  written: ${row}\n  row now: ${before.row}\n  decl:    ${JSON.stringify(before.decl)}\n  gate:    ${JSON.stringify(before.gate)}\n  notices: ${JSON.stringify(before.items.map((i) => `${i.tone}|${i.title}|${i.actions.join('/')}`))}\n  /chat:   ${sent.length} ${JSON.stringify(sent.map((s) => ({ groups: s.groups, returns: s.returns, gnd: s.groups_need_decision, rnd: s.returns_need_decision })))}\n  toasts:  ${JSON.stringify(toasts)}\n  errors:  ${JSON.stringify(errors)}`);
        await ctx.close();
      }
    }
    server.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'page_b.json'), JSON.stringify(all, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
