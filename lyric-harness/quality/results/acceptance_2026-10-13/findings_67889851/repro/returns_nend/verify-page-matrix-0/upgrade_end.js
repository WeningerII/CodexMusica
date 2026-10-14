// BB8 verify-page-matrix-0: independent reproduction of M6-returns-N.end.
// A pre-batch user TYPES a returns row on the baseline page (wt-main 8b1d2ad2),
// the session is saved in that origin's storage, then the same origin is
// upgraded to the candidate (wt-678 67889851) and reloaded. Nothing tracked is
// written; /chat is a local stub (no provider).
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h678/verify-page-matrix-0');
const TREES = { main: path.join(S, 'wt-main'), cand: path.join(S, 'wt-678') };
const { chromium } = require(path.join(TREES.cand, 'node_modules/playwright'));

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

const CASES = [
  ['C1 returns 4.end,6.end (line 4 re-cut)', '[SETUP — returns — 4.end,6.end]'],
  ['C2 returns 1.end,6.head (line 1 re-cut; placed partner)', '[SETUP — returns — 1.end,6.head]'],
  ['C3 returns 5.end,6.end (both lines unchanged)', '[SETUP — returns — 5.end,6.end]'],
  ['C4 returns 5.end,6.end;1.T4,8.T4 (unchanged .end + T row-mate)', '[SETUP — returns — 5.end,6.end;1.T4,8.T4]'],
  ['C5 control returns 1.endword,8.endword', '[SETUP — returns — 1.endword,8.endword]'],
  ['C6 control returns 1,8 (bare)', '[SETUP — returns — 1,8]'],
  ['C7 rhyme groups 4.end,6.end', '[SETUP — rhyme groups — 4.end,6.end]'],
  ['C8 returns 1.end,8.end then Keep the link x2, reload', '[SETUP — returns — 1.end,8.end]', 'keep'],
];

function serve(state) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(state.root, p);
    if (!f.startsWith(state.root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    const ext = path.extname(f);
    const type = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}

async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(500);
}

const capture = (page, key) =>
  page.evaluate((key) => {
    lyRefresh(true);
    const text = $ui('lyrics-draft').value;
    const m = lyParse(text);
    const d = lyDeclarationsOf(m);
    return {
      row: text.split('\n').find((r) => r.startsWith('[SETUP') && r.includes(key)) || null,
      saved: (JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics || '').split('\n').find((r) => r.startsWith('[SETUP') && r.includes(key)) || null,
      decl: { groups: d.groups, returns: d.returns, returns_need_decision: d.returns_need_decision, groups_need_decision: d.groups_need_decision },
      items: (LY.items || []).filter((i) => i.id.startsWith(key + ':')).map((i) => ({ id: i.id, tone: i.tone, title: i.title, actions: (i.actions || []).map((a) => a[1] + '=' + a[3]) })),
      toasts: (window.__t || []).slice(),
    };
  }, key);

async function runReview(page, calls) {
  const n = calls.length;
  await page.evaluate(async () => { try { await LY_ACTIONS['ly-run-review'](); } catch (e) { window.__err = String(e); } });
  await page.waitForTimeout(600);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  return calls.slice(n).map((c) => {
    const d = c.lyric_context?.declarations || {};
    return { groups: d.groups, returns: d.returns, returns_need_decision: d.returns_need_decision };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = [];
  for (const [name, row, extra] of CASES) {
    const state = { root: TREES.main };
    const server = serve(state);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const calls = [];
    await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
      if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
        calls.push(JSON.parse(r.request().postData() || '{}'));
        return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'ok', history: [], sig: 'x' }) });
      }
      return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
    });
    await ctx.addInitScript(() => {
      window.__t = [];
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          const t = document.getElementById('toast');
          const s = t && t.innerText;
          if (s && window.__t[window.__t.length - 1] !== s) window.__t.push(s);
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const key = row.includes('returns') ? 'returns' : 'rhyme groups';
    const rec = { name, typed: row };
    // 1. Baseline page: the user types the document (row included).
    await page.goto(`${base}/codex.html#lyrics`);
    await ready(page);
    await page.locator('#lyrics-draft').fill(`${row}\n\n${SONG}`);
    await page.waitForTimeout(1500);
    await page.reload();
    await ready(page);
    rec.main = await capture(page, key);
    rec.main.sent = await runReview(page, calls);
    // Which sung lines' cuts the candidate considers changed (for the record).
    // 2. Same origin, upgraded to the candidate.
    // The stub's reply leaves the baseline's chat request open; drop the chat
    // store (only) so the candidate's own Run review can send.
    await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('codex-musica-chat')) localStorage.removeItem(k); });
    state.root = TREES.cand;
    await page.reload();
    await ready(page);
    rec.cand = await capture(page, key);
    rec.cand.cutChanged = await page.evaluate(() => LY.model.sung.map((r) => [r.n, lyLineCutChanged(r.text, LY.model.voices)]));
    rec.cand.sent = await runReview(page, calls);
    if (extra === 'keep') {
      for (let k = 0; k < 4; k++) {
        const id = await page.evaluate(() => {
          lyRefresh(true);
          const it = (LY.items || []).find((i) => /:carried:/.test(i.id));
          return it ? it.actions.find((a) => a[0] === 'ly-carried-keep')[3] : null;
        });
        if (!id) break;
        await page.evaluate((id) => LY_ACTIONS['ly-carried-keep'](id), id);
        await page.waitForTimeout(300);
      }
      rec.candAfterKeep = await capture(page, key);
      rec.candAfterKeep.sent = await runReview(page, calls);
      await page.reload();
      await ready(page);
      rec.candAfterKeepReload = await capture(page, key);
      rec.candAfterKeepReload.sent = await runReview(page, calls);
    }
    rec.errors = errors;
    results.push(rec);
    console.log(`\n=== ${name}\n typed on main: ${row}`);
    console.log(` main  row: ${rec.main.row}\n       saved: ${rec.main.saved}\n       notices: ${JSON.stringify(rec.main.items.map((i) => i.title))}\n       sent: ${JSON.stringify(rec.main.sent)}`);
    console.log(` cand  row: ${rec.cand.row}\n       saved: ${rec.cand.saved}\n       notices: ${JSON.stringify(rec.cand.items.map((i) => i.tone + ': ' + i.title))}\n       toasts: ${JSON.stringify(rec.cand.toasts)}\n       sent: ${JSON.stringify(rec.cand.sent)}\n       cutChanged: ${JSON.stringify(rec.cand.cutChanged.filter((x) => x[1]).map((x) => x[0]))}`);
    if (rec.candAfterKeep) {
      console.log(` cand after Keep x${rec.candAfterKeep ? '' : ''}: row ${rec.candAfterKeep.row} | notices ${JSON.stringify(rec.candAfterKeep.items.map((i) => i.title))} | sent ${JSON.stringify(rec.candAfterKeep.sent)}`);
      console.log(` cand after Keep + reload: row ${rec.candAfterKeepReload.row} | notices ${JSON.stringify(rec.candAfterKeepReload.items.map((i) => i.title))} | sent ${JSON.stringify(rec.candAfterKeepReload.sent)}`);
    }
    if (errors.length) console.log(' pageerrors:', errors);
    await ctx.close();
    server.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'upgrade_end.json'), JSON.stringify(results, null, 1));
})();
