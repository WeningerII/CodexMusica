// Skeptic re-check of f4-card a4 ("every listed entry names its line").
// Usage: node v.js <cand|prev|main>   (scratch only; serves the tree root read-only)
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-0');
const TREES = { cand: path.join(S, 'wt-695'), prev: path.join(S, 'wt-61b'), main: path.join(S, 'wt-main') };
const TREE = process.argv[2] || 'cand';
const ROOT = TREES[TREE];
const { chromium } = require(path.join(TREES.cand, 'node_modules/playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
async function newCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  // No network: the chat service is answered locally and never called by these steps.
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
  await ctx.addInitScript(() => {
    window.__toastLog = [];
    const mo = new MutationObserver(() => {
      const t = document.getElementById('toast');
      if (!t) return;
      const txt = t.innerText;
      if (txt && window.__toastLog[window.__toastLog.length - 1] !== txt) window.__toastLog.push(txt);
    });
    document.addEventListener('DOMContentLoaded', () => mo.observe(document.body, { subtree: true, childList: true, characterData: true }));
  });
  return ctx;
}
const ready = (page) => page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
async function open(ctx, url, errs) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(url);
  await ready(page);
  return page;
}
const draftOf = (page) => page.evaluate(() => $ui('lyrics-draft').value);
async function importTxt(page, name, text, marker) {
  const before = await draftOf(page);
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction(([m, b]) => $ui('lyrics-draft').value !== b && $ui('lyrics-draft').value.includes(m), [marker, before], { timeout: 20000 });
  await page.waitForTimeout(500);
}
// Review state: the renumbered card (if the page has one), every Review item,
// and the rendered Review pane text.
const review = (page) => page.evaluate(() => {
  lyRefresh(true);
  const items = (LY.items || []).map((x) => ({ id: x.id, title: x.title, where: x.where, text: x.text, lines: x.lines }));
  LY_ACTIONS['ly-tab']('review');
  const det = document.querySelector('#ly-panel-review details.ly-local');
  if (det) det.open = true;
  const pane = $ui('ly-panel-review').innerText;
  const ui = app.lyricMeta && app.lyricMeta.ui;
  return { card: items.find((x) => x.id === 'renumbered') || null, items, pane, meta: ui && ui.renumbered ? JSON.parse(JSON.stringify(ui.renumbered)) : null, sung: LY.model.sung.map((r) => [r.n, r.text]) };
});
const toasts = (page) => page.evaluate(() => window.__toastLog.splice(0));
// An in-editor edit, as typing then leaving the editor records it (no boundary).
const editDraft = (page, text) => page.evaluate((t) => { $ui('lyrics-draft').value = t; $ui('lyrics-draft').dispatchEvent(new Event('input', { bubbles: true })); uiSaveLyrics(); pushHistory(); lyRefresh(true); }, text);

const q = JSON.stringify;
const OH = 'Oh--oh, oh my love';
const DOVE = 'You are the one I dream of my dove';
const AH = 'Ah--ah, ah my heart and soul';
const ORPHAN = 'Oh--oh, oh my lost line';
const ORPHAN2 = 'Ah--ah, ah my lost way';
// S1: the tester's song shape (an orphan reading plus a matched one), plus a
// second orphan reading with the same word and the same numbers on another line.
const S1 = [
  '[SETUP — title — "Skeptic One"]',
  `[SETUP — reading — token 2 "oh" in ${q(OH)} — OW1 — declared — source: me]`,
  `[SETUP — reading — token 4 "heart" in ${q(AH)} — HH AA1 R T — declared — source: me]`,
  `[SETUP — reading — token 4 "lost" in ${q(ORPHAN)} — L AO1 S T — declared — source: me]`,
  `[SETUP — reading — token 4 "lost" in ${q(ORPHAN2)} — L AO1 S T — declared — source: me]`,
  '[SETUP — rhyme groups — 1.T4,2]',
  '',
  '[VERSE]',
  OH,
  DOVE,
  OH,
  AH,
].join('\n');
// S2: a reading on a line sung six times.
const S2 = [
  '[SETUP — title — "Skeptic Two"]',
  `[SETUP — reading — token 2 "oh" in ${q(OH)} — OW1 — declared — source: me]`,
  '',
  '[CHORUS]',
  OH, OH, OH, OH, OH, OH,
  DOVE,
].join('\n');
// S3: a later, unrelated .txt with nothing to migrate.
const S3 = ['[SETUP — title — "Skeptic Three"]', '', '[VERSE]', 'Rain on the window', 'Oh--oh, oh my love', 'Wind in the door'].join('\n');

(async () => {
  const errs = [];
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: TREE, head: null, steps: {} };
  try {
    let ctx = await newCtx(browser);
    let page = await open(ctx, url, errs);
    await toasts(page);
    // ── S1 ──
    await importTxt(page, 's1.txt', S1, 'Skeptic One');
    const t1 = await toasts(page);
    const r1 = await review(page);
    const d1 = await draftOf(page);
    out.steps.s1 = { toasts: t1, draft: d1, ...r1 };
    const lostItems = r1.items.filter((x) => /lost/.test(x.title + ' ' + (x.text || '')));
    console.log('S1 toasts:', q(t1));
    console.log('S1 card text:', r1.card ? r1.card.text : null);
    console.log('S1 card meta:', q(r1.meta));
    console.log('S1 items mentioning "lost":', q(lostItems, null, 1));
    console.log('S1 pane contains ORPHAN line text:', r1.pane.includes(ORPHAN), '| ORPHAN2:', r1.pane.includes(ORPHAN2));
    console.log('S1 draft reading rows:', q(d1.split('\n').filter((l) => /reading/.test(l))));
    // ── S1b: frozen numbers -- an in-editor edit adds a line above line 1 ──
    const d1b = d1.replace('[VERSE]\n', '[VERSE]\nA new first line here\n');
    await editDraft(page, d1b);
    await page.waitForTimeout(400);
    const r1b = await review(page);
    const ohNow = r1b.sung.filter(([, t]) => t === OH).map(([n]) => n);
    out.steps.s1b = { ...r1b, ohLinesNow: ohNow };
    console.log('S1b after inserting a line above: OH is now sung at lines', q(ohNow), '; card says:', r1b.card ? (r1b.card.text.match(/the reading for “oh”[^;]*/) || [null])[0] : null);
    console.log('S1b card rhyme-link entry:', r1b.card ? (r1b.card.text.match(/a rhyme link on[^;]*/) || [null])[0] : null, '; group row now:', q((await draftOf(page)).split('\n').find((l) => /rhyme groups/.test(l))));
    // ── S3: a later unrelated .txt import (nothing to migrate) ──
    await importTxt(page, 's3.txt', S3, 'Skeptic Three');
    const t3 = await toasts(page);
    const r3 = await review(page);
    out.steps.s3 = { toasts: t3, ...r3 };
    console.log('S3 toasts:', q(t3));
    console.log('S3 card after unrelated import:', r3.card ? r3.card.text : null);
    console.log('S3 sung lines now:', q(r3.sung));
    await ctx.close();
    // ── S2: a fresh profile ──
    ctx = await newCtx(browser);
    page = await open(ctx, url, errs);
    await toasts(page);
    await importTxt(page, 's2.txt', S2, 'Skeptic Two');
    const t2 = await toasts(page);
    const r2 = await review(page);
    out.steps.s2 = { toasts: t2, ...r2 };
    console.log('S2 toasts:', q(t2));
    console.log('S2 card text:', r2.card ? r2.card.text : null);
    console.log('S2 OH sung at:', q(r2.sung.filter(([, t]) => t === OH).map(([n]) => n)));
    await ctx.close();
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errs;
    fs.writeFileSync(path.join(OUT, `v_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
