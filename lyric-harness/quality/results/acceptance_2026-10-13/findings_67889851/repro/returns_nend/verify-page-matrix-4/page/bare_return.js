// BB8 verify-page-matrix-4: how a BARE N member of a [SETUP — returns — …] row
// is described by the candidate's carried notice, vs what main's own UI writes
// it for and how the page's own Repeats form shows it. Scratch only.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const CAND = path.join(S, 'wt-678');
const MAIN = path.join(S, 'wt-main');
const OUT = path.join(S, 'h678/verify-page-matrix-4/page');
const { chromium } = require(path.join(CAND, 'node_modules/playwright'));

const SONG = `[VERSE]
Oh--oh, oh my love
Thundered the battery’s double bass--
My love--love is true
You hold my heart.    10

[CHORUS]
I walk the line tonight
Well-worn shoes upon the floor
Stay with me (oh--oh) tonight
Hold me (hold me) close--close tonight`;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.txt': 'text/plain' };
function serve(state) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(state.root, p);
    if (!f.startsWith(state.root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
async function ctxOf(browser, q) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
    if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
      q.calls.push(JSON.parse(r.request().postData() || '{}'));
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) });
    }
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
  });
  return ctx;
}
const ready = (page) => page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
const SESSION = (lyrics) => JSON.stringify({ version: 1, name: 'Untitled session', cards: [], lyrics, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: { tab: 'review', outline: true } } });

// What the page shows/sends for the returns or rhyme-groups row.
const observe = (page, key) =>
  page.evaluate((key) => {
    lyRefresh(true);
    const text = $ui('lyrics-draft').value;
    const m = lyParse(text);
    const row = lySetupOf(m, key)[0];
    const groups = row ? (typeof lyRowGroups === 'function' ? lyRowGroups(row) : lyParseGroups(row.value)) : [];
    const members = groups.flat().map((x) => ({ line: x.line, place: x.place, raw: x.raw, carried: !!x.carried, label: typeof lyMemberLabel === 'function' ? lyMemberLabel(x) : null, word: typeof lyMemberWord === 'function' ? lyMemberWord(m, x) : null }));
    const items = (LY.items || []).filter((i) => i.id.startsWith(key + ':')).map((i) => ({ id: i.id, tone: i.tone, title: i.title, text: i.text, actions: (i.actions || []).map((a) => a[1]) }));
    LY_ACTIONS['ly-tool'](key === 'returns' ? 'repeats-voices' : 'rhymes');
    const tv = document.querySelector('.ly-tool-view');
    let formDeclared = null;
    if (tv) {
      const h = [...tv.querySelectorAll('h4')].find((e) => /Declared returns/.test(e.textContent));
      formDeclared = h && h.nextElementSibling ? h.nextElementSibling.innerText : null;
    }
    const d = lyDeclarationsOf(m);
    const pick = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => /groups|returns/.test(k)));
    return { setupRows: text.split('\n').filter((r) => /^\[SETUP/.test(r)), members, items, formDeclared, decl: pick(d) };
  }, key);

async function runReview(page, q) {
  const n = q.calls.length;
  const r = await page.evaluate(async () => { try { await LY_ACTIONS['ly-run-review'](); return 'ok'; } catch (e) { return String(e); } });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 }).catch(() => {});
  return { r, sent: q.calls.slice(n).map((c) => { const d = (c.lyric_context && c.lyric_context.declarations) || {}; return Object.fromEntries(Object.entries(d).filter(([k]) => /groups|returns/.test(k))); }) };
}

(async () => {
  const state = { root: MAIN };
  const server = serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = {};
  const cases = [
    // MAIN'S OWN UI writes the row: "Declare as exact repeat" of CHORUS over VERSE.
    { id: 'M1_main_declare_repeat', key: 'returns', viaMainAction: true },
    // Hand-written rows in the shape main writes.
    { id: 'H1_returns_bare_4_5', key: 'returns', row: '[SETUP — returns — 4,5]' },
    { id: 'H2_returns_line_4_5', key: 'returns', row: '[SETUP — returns — 4.line,5.line]' },
    { id: 'H3_returns_end_4_5', key: 'returns', row: '[SETUP — returns — 4.end,5.end]' },
    { id: 'H4_groups_bare_4_5', key: 'rhyme groups', row: '[SETUP — rhyme groups — 4,5]' },
  ];
  try {
    for (const c of cases) {
      state.root = MAIN;
      const q = { calls: [] };
      const ctx = await ctxOf(browser, q);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${base}/robots.txt`);
      await page.evaluate((s) => localStorage.setItem('codex-workbench-v1', s), SESSION(c.row ? `${c.row}\n\n${SONG}` : SONG));
      await page.goto(`${base}/codex.html#lyrics`);
      await ready(page);
      await page.waitForTimeout(400);
      if (c.viaMainAction) {
        const did = await page.evaluate(() => {
          const secs = LY.model.sections.map((s, i) => ({ i: s.index ?? i, title: s.title, n: s.sung.length }));
          const a = secs.find((s) => /verse/i.test(s.title));
          const b = secs.find((s) => /chorus/i.test(s.title));
          LY_ACTIONS['ly-declare-repeat'](`${a.i}:${b.i}`);
          lyRefresh(true);
          return { secs, a, b, row: $ui('lyrics-draft').value.split('\n').filter((r) => /^\[SETUP/.test(r)) };
        });
        await page.waitForTimeout(300);
        out[c.id + '__main_action'] = did;
      }
      const mainObs = await observe(page, c.key);
      const mainSent = await runReview(page, q);
      const savedOnMain = await page.evaluate(() => localStorage.getItem('codex-workbench-v1'));
      // Same-origin site upgrade to the candidate; the saved session carries across.
      state.root = CAND;
      await page.evaluate((s) => { for (const k of Object.keys(localStorage)) if (/codex-musica-chat/.test(k)) localStorage.removeItem(k); localStorage.setItem('codex-workbench-v1', s); }, savedOnMain);
      await page.goto(`${base}/robots.txt`);
      await page.goto(`${base}/codex.html#lyrics`);
      await ready(page);
      await page.waitForTimeout(500);
      const isCand = await page.evaluate(() => typeof lyMigrateSavedReadings === 'function');
      if (!isCand) throw new Error('upgrade did not load the candidate page');
      const bootToasts = await page.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
      const candObs = await observe(page, c.key);
      const candSent = await runReview(page, q);
      // The Review panel's own text for the carried notices.
      const reviewText = await page.evaluate(() => { LY_ACTIONS['ly-tab']('review'); return $ui('ly-panel-review').innerText; });
      out[c.id] = { main: { ...mainObs, review: mainSent }, cand: { ...candObs, bootToasts, review: candSent, reviewPanelCarried: reviewText.split('\n').filter((l) => /carried|last rhyme|whole line|under the earlier cut and/.test(l)) }, errors };
      console.log(`== ${c.id}`);
      console.log(JSON.stringify(out[c.id], null, 1));
      await ctx.close();
    }
  } catch (e) {
    console.log('threw', e.stack || e);
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(OUT, 'bare_return.json'), JSON.stringify(out, null, 1));
})();
