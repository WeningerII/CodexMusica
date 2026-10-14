// verify-page-matrix-3 (BB8). Independent page driver. Scratch only.
// A pre-batch user writes a returns row on the MAIN page (8b1d2ad2); the same
// origin is then served the CANDIDATE page (67889851) and reloaded, as a real
// site upgrade. We record: the row as main saved it, what main sends to /chat,
// the row after the candidate's load-time migration, its Review notices and
// toast, and what the candidate sends. /chat is stubbed (no provider).
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const TREES = { main: path.join(S, 'wt-main'), cand: path.join(S, 'wt-678') };
const OUT = path.join(S, 'h678/verify-page-matrix-3/page');
const { chromium } = require(path.join(TREES.cand, 'node_modules/playwright'));

const SONG = `[Verse]
Hold on--hold on to me
The night is cold and grey
We danced until the morning
Meet me at the corner at 9

[Chorus]
I walk the line tonight
Stay with me tonight
The station clock says nine
Hold on--hold on tonight`;

const state = { root: TREES.main };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/codex.html';
  const f = path.join(state.root, p);
  if (!f.startsWith(state.root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404);
    return res.end('nf');
  }
  const ext = path.extname(f);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});

async function context(browser) {
  const calls = [];
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    const rq = r.request();
    if (/\/chat$/.test(rq.url()) && rq.method() === 'POST') {
      calls.push(JSON.parse(rq.postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  await ctx.addInitScript(() => {
    window.__toasts = [];
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => {
        const t = document.getElementById('toast');
        const s = t && t.innerText;
        if (s && window.__toasts[window.__toasts.length - 1] !== s) window.__toasts.push(s);
      }).observe(document.body, { subtree: true, childList: true, characterData: true });
    });
  });
  return { ctx, calls };
}
async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(300);
}
const rowOf = (page, key) =>
  page.evaluate((key) => $ui('lyrics-draft').value.split('\n').filter((r) => r.startsWith('[SETUP') && r.includes(`— ${key} —`)), key);
const savedRows = (page) =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('codex-workbench-v1') || '{}').lyrics || '').split('\n').filter((r) => r.startsWith('[SETUP')));
const notices = (page) =>
  page.evaluate(() => {
    lyRefresh(true);
    return (LY.items || []).filter((i) => /^(returns|rhyme groups)/.test(i.id)).map((i) => ({ id: i.id, tone: i.tone, title: i.title, actions: (i.actions || []).map((a) => [a[0], a[3]]) }));
  });
const toasts = (page) => page.evaluate(() => window.__toasts.splice(0));
// Run review on this page; returns the declarations /chat received.
async function review(page, calls) {
  const n = calls.length;
  const r = await page.evaluate(async () => {
    const d = lyDeclarationsOf(lyParse($ui('lyrics-draft').value));
    const builder = { returns: d.returns, groups: d.groups, returns_need_decision: d.returns_need_decision, groups_need_decision: d.groups_need_decision };
    // A stubbed earlier reply can leave a pending request; clear it (test
    // harness only) so this review reaches /chat. Recorded.
    const clearedPending = !!chatState.pending;
    chatState.pending = null;
    try {
      await LY_ACTIONS['ly-run-review']();
      return { builder, clearedPending };
    } catch (e) {
      return { builder, clearedPending, err: String(e) };
    }
  });
  await page.waitForTimeout(300);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 30000 });
  const got = calls.slice(n).map((c) => {
    const d = (c.lyric_context && c.lyric_context.declarations) || {};
    return { returns: d.returns, groups: d.groups, returns_need_decision: d.returns_need_decision, groups_need_decision: d.groups_need_decision };
  });
  return { r, got: { chat: got, builder: r.builder, clearedPending: r.clearedPending, err: r.err } };
}
// The user writes the draft on the page (as typing then autosave would).
const writeDraft = (page, text) =>
  page.evaluate((t) => {
    $ui('lyrics-draft').value = t;
    uiSaveLyrics();
    pushHistory();
    lyRefresh(true);
  }, text);

const LOAD_CASES = [
  ['L1 returns 4.end,7.end (line 4 ends in a numeral)', 'returns', '4.end,7.end'],
  ['L2 returns 5.end,6.end (unchanged lines only)', 'returns', '5.end,6.end'],
  ['L3 returns 5.end,6.end;2.T2,3.T2 (unchanged N.end + T row-mate)', 'returns', '5.end,6.end;2.T2,3.T2'],
  ['L4 returns 1.end,6.head', 'returns', '1.end,6.head'],
  ['L5 returns 5.end,6.end;4.T3,7.T3 (unchanged N.end + T row-mate on a re-cut line)', 'returns', '5.end,6.end;4.T3,7.T3'],
  ['L6 rhyme groups 5.end,6.end;2.T2,3.T2 (control)', 'rhyme groups', '5.end,6.end;2.T2,3.T2'],
];
const LOAD_CASES_2 = [
  ['L7 returns 5.end,6.end;1.head,8.head (unchanged N.end + named row-mate on re-cut lines)', 'returns', '5.end,6.end;1.head,8.head'],
  ['L8 returns 4,7 (bare N, as main declare-repeat writes, on a re-cut line)', 'returns', '4,7'],
  ['L9 returns 5.end,6.end (then the same row is untouched by load: Keep of an unrelated rhyme link)', 'returns', '5.end,6.end'],
];

async function loadCase(browser, base, [name, key, value]) {
  state.root = TREES.main;
  const { ctx, calls } = await context(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await ready(page);
  await writeDraft(page, `[SETUP — ${key} — ${value}]\n\n${SONG}`);
  await page.reload();
  await ready(page);
  const rec = { name, key, written: value };
  rec.main_row_after_reload = await rowOf(page, key);
  rec.main_saved = await savedRows(page);
  {
    // What main sends: a separate context, so the upgrade context never ran
    // a review on main (a stubbed reply would gate the candidate's review).
    const B = await context(browser);
    const pb = await B.ctx.newPage();
    await pb.goto(`${base}/codex.html#lyrics`);
    await ready(pb);
    await writeDraft(pb, `[SETUP — ${key} — ${value}]\n\n${SONG}`);
    await pb.reload();
    await ready(pb);
    rec.main_sent = (await review(pb, B.calls)).got;
    await B.ctx.close();
  }
  // Site upgrade: same origin, candidate page.
  state.root = TREES.cand;
  await page.reload();
  await ready(page);
  rec.cand_cut_changed = await page.evaluate(() => LY.model.sung.map((r) => [r.n, lyLineCutChanged(r.text, LY.model.voices)]));
  rec.cand_row_after_upgrade = await rowOf(page, key);
  rec.cand_toasts = await toasts(page);
  rec.cand_notices = await notices(page);
  rec.cand_sent = (await review(page, calls)).got;
  // Keep every carried member (the agreed policy's Keep the link).
  const keeps = rec.cand_notices.flatMap((n) => n.actions.filter((a) => a[0] === 'ly-carried-keep').map((a) => a[1]));
  if (keeps.length) {
    for (const id of keeps) {
      await page.evaluate((id) => LY_ACTIONS['ly-carried-keep'](id), id);
      await page.waitForTimeout(150);
    }
    rec.cand_row_after_keep = await rowOf(page, key);
    rec.cand_toasts_after_keep = await toasts(page);
    rec.cand_sent_after_keep = (await review(page, calls)).got;
  }
  rec.errors = errors;
  await ctx.close();
  return rec;
}

// Pre-existing paths: the same row on ONE tree, then a page edit that is not
// about returns at all.
const EDITS = {
  'duplicate Chorus (ly-sec-dup 1)': (p) => p.evaluate(() => LY_ACTIONS['ly-sec-dup']('1')),
  'move Chorus up (ly-sec-move 1:-1)': (p) => p.evaluate(() => LY_ACTIONS['ly-sec-move']('1:-1')),
  'add a section (ly-add-section BRIDGE)': (p) => p.evaluate(() => LY_ACTIONS['ly-add-section']('Bridge')),
  'Repeats form: placed return 2.head,3.head': async (p) => {
    await p.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
    for (const n of [2, 3]) {
      await p.evaluate((n) => {
        LY.activeLine = n;
        lyRefresh(true);
        const d = $ui('ly-placed-place')?.closest('details');
        if (d && !d.open) d.open = true;
      }, n);
      await p.selectOption('#ly-placed-place', 'head');
      await p.click('[data-ui="ly-placed-add"]');
    }
    await p.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
  },
};
async function editCase(browser, base, tree, value, editName) {
  state.root = TREES[tree];
  const { ctx, calls } = await context(browser);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/codex.html#lyrics`);
  await ready(page);
  await writeDraft(page, `[SETUP — returns — ${value}]\n\n${SONG}`);
  await page.reload();
  await ready(page);
  const rec = { tree, written: value, edit: editName };
  rec.row_before = await rowOf(page, 'returns');
  await toasts(page);
  await EDITS[editName](page);
  await page.waitForTimeout(250);
  rec.row_after = await rowOf(page, 'returns');
  rec.toasts = await toasts(page);
  rec.sent_after = (await review(page, calls)).got;
  rec.errors = errors;
  await ctx.close();
  return rec;
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { load: [], edits: [] };
  const which = process.argv[2] || 'all';
  try {
    if (which === 'load2')
      for (const c of LOAD_CASES_2) {
        const r = await loadCase(browser, base, c);
        out.load.push(r);
        console.log(JSON.stringify(r, null, 1));
      }
    if (which === 'all' || which === 'load')
      for (const c of LOAD_CASES) {
        const r = await loadCase(browser, base, c);
        out.load.push(r);
        console.log(JSON.stringify(r, null, 1));
      }
    if (which === 'all' || which === 'edits')
      for (const tree of ['main', 'cand'])
        for (const value of ['5.end,6.end', '4.end,7.end'])
          for (const e of Object.keys(EDITS)) {
            const r = await editCase(browser, base, tree, value, e);
            out.edits.push(r);
            console.log(JSON.stringify(r));
          }
  } catch (e) {
    console.log('THREW', e.stack || e);
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(OUT, `page_${which}.json`), JSON.stringify(out, null, 1));
})();
