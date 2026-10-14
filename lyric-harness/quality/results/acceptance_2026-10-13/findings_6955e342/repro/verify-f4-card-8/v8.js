// verify-f4-card-8: adversarial re-check of f4-card d2 (cand.d.frozenLines).
// Own harness, written from scratch. Scratch only; no tracked file is touched.
// Usage: node v8.js <cand|prev61b|prev678|main|base>
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const OUT = path.join(S, 'h695/verify-f4-card-8');
const TREES = {
  cand: 'wt-695',
  prev61b: 'wt-61b',
  prev678: 'wt-678',
  main: 'wt-main',
  base: 'wt-base',
};
const TREE = process.argv[2] || 'cand';
const ROOT = path.join(S, TREES[TREE]);
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));

const OH = 'Oh--oh, oh my love';
const DOVE = 'You are the one I dream of my dove';
// The tester's fixture, byte for byte (f4-card/d_card.js SONG).
const SONG = [
  '[SETUP — title — "Old Song"]',
  `[SETUP — reading — token 2 "oh" in ${JSON.stringify(OH)} — OW1 — declared — source: me]`,
  '[SETUP — rhyme groups — 1.T4,2]',
  '[SETUP — returns — 1.T3,3.T3]',
  '',
  '[VERSE]',
  OH,
  DOVE,
  OH,
].join('\n');
// A second fixture: the reading sits on ONE distinctive line, so the card names
// exactly one line; no group rows (isolates the reading entry).
const RED = 'Red--red, my rose';
// Run D: a reading the migration renumbers (v1 token 2 = chars of the second
// "red" = v2 token 3) on one distinctive line.
const RED2 = 'Red--red, red my rose';
const SONG3 = [
  '[SETUP — title — "Rose Two"]',
  `[SETUP — reading — token 2 "red" in ${JSON.stringify(RED2)} — R1 — declared — source: me]`,
  '',
  '[VERSE]',
  'Morning comes over the hill',
  'Evening falls and all is still',
  RED2,
].join('\n');
const SONG2 = [
  '[SETUP — title — "Rose Song"]',
  `[SETUP — reading — token 2 "red" in ${JSON.stringify(RED)} — R1 — declared — source: me]`,
  '',
  '[VERSE]',
  'Morning comes over the hill',
  'Evening falls and all is still',
  RED,
].join('\n');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/codex.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('nf');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
async function ctxOf(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
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
  return ctx;
}
const ready = (page) =>
  page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
const wait = (page, ms) => page.waitForTimeout(ms);

// Everything the page itself says, read passively (lyRefresh is the page's own
// redraw; the Review tab is opened through its own action).
const snap = (page) =>
  page.evaluate(() => {
    if (typeof lyRefresh === 'function') lyRefresh(true);
    const draft = document.getElementById('lyrics-draft').value;
    const m = LY.model;
    const sung = (m.sung || []).map((r) => ({ n: r.n, text: r.text }));
    const setup = draft.split('\n').filter((r) => /^\[SETUP/.test(r.trim()));
    const items = (LY.items || []).map((x) => ({ id: x.id, title: x.title, where: x.where, text: x.text, lines: x.lines }));
    const card = items.find((x) => x.id === 'renumbered') || null;
    const meta = app.lyricMeta && app.lyricMeta.ui && app.lyricMeta.ui.renumbered ? JSON.parse(JSON.stringify(app.lyricMeta.ui.renumbered)) : null;
    try { LY_ACTIONS['ly-tab']('review'); } catch (e) {}
    const li = [...document.querySelectorAll('#ly-panel-review li.ly-item')].find((el) => /renumbered to the current word cut/.test(el.innerText));
    // Where each group member now points, by the page's own tokenizer.
    const tok = (t) => (typeof lyTokens === 'function' ? lyTokens(t) : null);
    const resolve = (spec) =>
      spec
        .replace(/ — cut v\d+$/, '')
        .split(/[;,]/)
        .map((s) => s.trim())
        .map((s) => {
          const q = /^(\d+)(?:\.T(\d+))?/.exec(s);
          if (!q) return { member: s };
          const line = sung[Number(q[1]) - 1];
          const words = line ? tok(line.text) : null;
          return { member: s, lineText: line ? line.text : '(no such line)', word: q[2] && words ? words[Number(q[2]) - 1] || null : null };
        });
    const groups = setup
      .map((r) => /^\[SETUP — (rhyme groups|returns) — (.*)\]$/.exec(r.trim()))
      .filter(Boolean)
      .map((g) => ({ kind: g[1], spec: g[2], members: resolve(g[2]) }));
    const readings = setup
      .map((r) => /^\[SETUP — reading — token (\d+) ("(?:[^"\\]|\\.)*") in ("(?:[^"\\]|\\.)*")/.exec(r.trim()))
      .filter(Boolean)
      .map((q) => {
        const line = JSON.parse(q[3]);
        return { token: Number(q[1]), word: JSON.parse(q[2]), line, appliesToSungLines: sung.filter((s) => s.text === line).map((s) => s.n) };
      });
    return {
      draft,
      sung,
      setup,
      readings,
      groups,
      card,
      cardShown: li ? li.innerText : null,
      cardHasShowInDraft: li ? /Show in draft/.test(li.innerText) : null,
      meta,
      otherItems: items.filter((x) => x.id !== 'renumbered'),
      toasts: window.__toasts.splice(0),
    };
  });

async function importTxt(page, name, text, marker) {
  const before = await page.evaluate(() => document.getElementById('lyrics-draft').value);
  const file = path.join(OUT, `in_${TREE}_${name}`);
  fs.writeFileSync(file, text);
  await page.setInputFiles('#ly-file', file);
  await page.waitForFunction(([m, b]) => { const v = document.getElementById('lyrics-draft').value; return v !== b && v.includes(m); }, [marker, before], { timeout: 20000 });
  await wait(page, 600);
  fs.unlinkSync(file);
}
// Real keystrokes: caret placed at a character offset, then typed.
async function typeAt(page, offset, keys) {
  await page.focus('#lyrics-draft');
  await page.evaluate((o) => document.getElementById('lyrics-draft').setSelectionRange(o, o), offset);
  for (const k of keys) {
    if (k.press) await page.keyboard.press(k.press);
    else await page.keyboard.type(k.type, { delay: 15 });
  }
  await wait(page, 400);
  await page.evaluate(() => document.getElementById('lyrics-draft').blur());
  await wait(page, 600);
}
async function selectAndDelete(page, from, to) {
  await page.focus('#lyrics-draft');
  await page.evaluate(([a, b]) => document.getElementById('lyrics-draft').setSelectionRange(a, b), [from, to]);
  await page.keyboard.press('Backspace');
  await wait(page, 400);
  await page.evaluate(() => document.getElementById('lyrics-draft').blur());
  await wait(page, 600);
}

(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = { tree: TREE, root: ROOT, runs: {} };
  const errors = [];
  try {
    // ── Run A: the tester's fixture; a line typed above the verse; reload.
    {
      const ctx = await ctxOf(browser);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push('A: ' + e.message));
      await page.goto(url);
      await ready(page);
      await importTxt(page, 'old-song.txt', SONG, 'Old Song');
      const afterImport = await snap(page);
      const d = afterImport.draft;
      const at = d.indexOf('[VERSE]\n') + '[VERSE]\n'.length;
      await typeAt(page, at, [{ type: 'A brand new opening line' }, { press: 'Enter' }]);
      const afterInsert = await snap(page);
      const expected = d.slice(0, at) + 'A brand new opening line\n' + d.slice(at);
      afterInsert.typedAsExpected = afterInsert.draft === expected;
      await page.reload();
      await ready(page);
      await wait(page, 800);
      const afterReload = await snap(page);
      out.runs.A = { afterImport, afterInsert, afterReload };
      await ctx.close();
    }
    // ── Run B: same fixture; the third sung line deleted (no insertion).
    {
      const ctx = await ctxOf(browser);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push('B: ' + e.message));
      await page.goto(url);
      await ready(page);
      await importTxt(page, 'old-song.txt', SONG, 'Old Song');
      const afterImport = await snap(page);
      const d = afterImport.draft;
      const last = d.lastIndexOf('\n' + OH);
      await selectAndDelete(page, last, last + 1 + OH.length);
      const afterDelete = await snap(page);
      afterDelete.editedAsExpected = afterDelete.draft === d.slice(0, last) + d.slice(last + 1 + OH.length);
      out.runs.B = { afterImport, afterDelete };
      await ctx.close();
    }
    // ── Run C: a reading on one distinctive line; two lines typed above it.
    {
      const ctx = await ctxOf(browser);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push('C: ' + e.message));
      await page.goto(url);
      await ready(page);
      await importTxt(page, 'rose-song.txt', SONG2, 'Rose Song');
      const afterImport = await snap(page);
      const d = afterImport.draft;
      const at = d.indexOf('[VERSE]\n') + '[VERSE]\n'.length;
      await typeAt(page, at, [{ type: 'A first new line' }, { press: 'Enter' }, { type: 'A second new line' }, { press: 'Enter' }]);
      const afterInsert = await snap(page);
      afterInsert.typedAsExpected = afterInsert.draft === d.slice(0, at) + 'A first new line\nA second new line\n' + d.slice(at);
      out.runs.C = { afterImport, afterInsert };
      await ctx.close();
    }
    // ── Run D: a renumbered reading on one distinctive line; two lines typed above.
    {
      const ctx = await ctxOf(browser);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push('D: ' + e.message));
      await page.goto(url);
      await ready(page);
      await importTxt(page, 'rose-two.txt', SONG3, 'Rose Two');
      const afterImport = await snap(page);
      const d = afterImport.draft;
      const at = d.indexOf('[VERSE]\n') + '[VERSE]\n'.length;
      await typeAt(page, at, [{ type: 'A first new line' }, { press: 'Enter' }, { type: 'A second new line' }, { press: 'Enter' }]);
      const afterInsert = await snap(page);
      afterInsert.typedAsExpected = afterInsert.draft === d.slice(0, at) + 'A first new line\nA second new line\n' + d.slice(at);
      out.runs.D = { afterImport, afterInsert };
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
  } finally {
    out.pageErrors = errors;
    fs.writeFileSync(path.join(OUT, `v8_${TREE}.json`), JSON.stringify(out, null, 1));
    // Short human log.
    const L = [];
    L.push(`tree ${TREE} (${ROOT})`);
    if (out.error) L.push('ERROR ' + out.error);
    for (const [k, r] of Object.entries(out.runs)) {
      for (const [step, s] of Object.entries(r)) {
        L.push(`== run ${k} / ${step}`);
        if (s.typedAsExpected !== undefined) L.push(`  typedAsExpected: ${s.typedAsExpected}`);
        if (s.editedAsExpected !== undefined) L.push(`  editedAsExpected: ${s.editedAsExpected}`);
        L.push('  sung (page model): ' + JSON.stringify(s.sung.map((x) => `${x.n}:${x.text}`)));
        L.push('  setup rows: ' + JSON.stringify(s.setup));
        L.push('  readings: ' + JSON.stringify(s.readings));
        L.push('  groups: ' + JSON.stringify(s.groups));
        L.push('  card item text: ' + JSON.stringify(s.card && s.card.text));
        L.push('  card as shown: ' + JSON.stringify(s.cardShown) + ' showInDraft=' + s.cardHasShowInDraft);
        L.push('  stored meta: ' + JSON.stringify(s.meta));
        L.push('  other Review items: ' + JSON.stringify(s.otherItems.map((x) => `${x.title} | ${x.where} | lines=${JSON.stringify(x.lines)}`)));
        L.push('  toasts: ' + JSON.stringify(s.toasts));
      }
    }
    L.push('pageErrors: ' + JSON.stringify(errors));
    console.log(L.join('\n'));
    await browser.close();
    server.close();
  }
})();
