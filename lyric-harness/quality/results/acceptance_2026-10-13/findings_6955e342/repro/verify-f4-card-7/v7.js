// verify-f4-card-7: independent repro of f4-card d1 ("Dismiss has a way back").
// Usage: node v7.js <cand|prev61b|main>
// Page = my CODEX_LIBRARY=1 build of the tree (cmp-identical to its codex.html),
// every other file from the tree root. mcp.codexmusica.com is routed to an
// in-process stub (no provider, no network). Scratch only.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const V = path.join(S, 'h695/verify-f4-card-7');
const TREES = { cand: 'wt-695', prev61b: 'wt-61b', main: 'wt-main' };
const TREE = process.argv[2] || 'cand';
const ROOT = path.join(S, TREES[TREE]);
const BUILT = path.join(V, `build-${TREES[TREE]}`, `built-${TREES[TREE]}.html`);
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.txt': 'text/plain', '.woff2': 'font/woff2' };
function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/codex.html') {
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return fs.createReadStream(BUILT).pipe(res);
    }
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
}
const OH = 'Oh--oh, oh my love';
const DOVE = 'You are the one I dream of my dove';
// Unmarked rows numbered under the earlier cut on a line whose cut changed.
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
const out = { tree: TREE, root: ROOT, built: BUILT, steps: [] };
const errors = [];
function step(name, data) {
  out.steps.push({ name, ...data });
  console.log(`[${name}] ${JSON.stringify(data)}`);
}
async function newCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' }));
  await ctx.addInitScript(() => {
    window.__toast = [];
    const snap = () => {
      const t = document.getElementById('toast');
      if (!t) return;
      const s = { t: Math.round(performance.now()), text: t.innerText, show: t.classList.contains('show'), buttons: [...t.querySelectorAll('button')].map((b) => b.innerText) };
      const last = window.__toast[window.__toast.length - 1];
      if (!last || last.text !== s.text || last.show !== s.show || last.buttons.join('|') !== s.buttons.join('|')) window.__toast.push(s);
    };
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(snap).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    });
  });
  return ctx;
}
async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(300);
}
const draft = (page) => page.evaluate(() => $ui('lyrics-draft').value);
const hist = (page) => page.evaluate(() => [app.historyIndex, app.history.length]);
const toastsSince = (page, mark) => page.evaluate((m) => window.__toast.filter((x) => x.t >= m), mark);
const now = (page) => page.evaluate(() => Math.round(performance.now()));
async function reviewTab(page) {
  const tab = page.locator('button[data-ui="ly-tab"][data-id="review"]').first();
  if (await tab.isVisible()) await tab.click();
  else await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
  await page.waitForTimeout(300);
}
async function card(page) {
  await reviewTab(page);
  return page.evaluate(() => {
    const li = [...document.querySelectorAll('#ly-panel-review li.ly-item')].find((x) => /renumbered to the current word cut/.test(x.innerText));
    const meta = app.lyricMeta && app.lyricMeta.ui ? app.lyricMeta.ui.renumbered : undefined;
    return {
      shown: !!li,
      text: li ? li.innerText : null,
      buttons: li ? [...li.querySelectorAll('button')].map((b) => `${b.dataset.ui}:${b.innerText.trim()}`) : [],
      meta: meta === undefined ? null : meta,
      dismissButtons: document.querySelectorAll('button[data-ui="ly-renumbered-dismiss"]').length,
    };
  });
}
async function clickUndo(page, which = 'undo') {
  const sel = `#btn-${which}`;
  const vis = await page.locator(sel).isVisible().catch(() => false);
  const en = vis && (await page.locator(sel).isEnabled());
  if (vis && en) await page.click(sel);
  else await page.evaluate((w) => LY_ACTIONS[`ly-${w}`](), which);
  await page.waitForTimeout(700);
  return vis ? (en ? 'mouse #btn-' + which : 'disabled') : 'LY_ACTIONS';
}
async function importTxt(page, text, name = 'old-song.txt') {
  const before = await draft(page);
  await page.setInputFiles('#ly-file', { name, mimeType: 'text/plain', buffer: Buffer.from(text, 'utf8') });
  await page.waitForFunction((b) => $ui('lyrics-draft').value !== b, before, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
}
(async () => {
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/codex.html#lyrics`;
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    // ---------- Scenario A: import -> Dismiss -> Undo -> Redo -> reload -> re-import ----------
    {
      const ctx = await newCtx(browser);
      const page = await ctx.newPage();
      const dialogs = [];
      page.on('dialog', async (d) => { dialogs.push({ type: d.type(), message: d.message() }); await d.dismiss(); });
      page.on('pageerror', (e) => errors.push('A: ' + e.message));
      await page.goto(url);
      await ready(page);
      const pre = await draft(page);
      const h0 = await hist(page);
      let m = await now(page);
      await importTxt(page, SONG);
      const imported = await draft(page);
      const h1 = await hist(page);
      const c1 = await card(page);
      step('A1.import', { histBefore: h0, histAfter: h1, draftChanged: imported !== pre, migrated: imported !== SONG, rowsAfter: imported.split('\n').filter((r) => /^\[SETUP/.test(r)), toasts: await toastsSince(page, m), card: c1 });
      if (c1.dismissButtons) {
        await page.locator('button[data-ui="ly-renumbered-dismiss"]').first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        m = await now(page);
        const modalBefore = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],.modal.open,.modal.show')].filter((e) => e.offsetParent !== null).length);
        await page.click('button[data-ui="ly-renumbered-dismiss"]');
        await page.waitForTimeout(900);
        const modalAfter = await page.evaluate(() => [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],dialog[open],.modal.open,.modal.show')].filter((e) => e.offsetParent !== null).length);
        const h2 = await hist(page);
        const d2 = await draft(page);
        const c2 = await card(page);
        const toastNow = await page.evaluate(() => { const t = document.getElementById('toast'); return { text: t.innerText, show: t.classList.contains('show') }; });
        step('A2.dismiss', { histBefore: h1, histAfter: h2, draftUnchanged: d2 === imported, newToastEvents: await toastsSince(page, m), toastNow, dialogs: dialogs.slice(), modalBefore, modalAfter, card: c2, metaUiKeys: await page.evaluate(() => Object.keys(app.lyricMeta.ui || {})) });
        m = await now(page);
        const how = await clickUndo(page, 'undo');
        const h3 = await hist(page);
        const d3 = await draft(page);
        const c3 = await card(page);
        step('A3.undoAfterDismiss', { how, histAfter: h3, draftEqualsPreImport: d3 === pre, draftEqualsImported: d3 === imported, card: { shown: c3.shown, meta: c3.meta }, toasts: await toastsSince(page, m) });
        const how2 = await clickUndo(page, 'redo');
        const h4 = await hist(page);
        const d4 = await draft(page);
        const c4 = await card(page);
        step('A4.redo', { how: how2, histAfter: h4, draftEqualsImported: d4 === imported, card: { shown: c4.shown, meta: c4.meta } });
        await page.waitForTimeout(1500); // lyMetaSaved 250 ms + autosave
        await page.reload();
        await ready(page);
        const c5 = await card(page);
        step('A5.reloadAfterDismiss', { draftEqualsImported: (await draft(page)) === imported, card: { shown: c5.shown, meta: c5.meta } });
        // Way back probe: import the same unmarked file again.
        m = await now(page);
        await importTxt(page, SONG + '\n', 'old-song-again.txt');
        const c6 = await card(page);
        step('A6.reimportSameFile', { card: { shown: c6.shown, text: c6.text }, toasts: await toastsSince(page, m) });
      } else {
        step('A2.dismiss', { skipped: 'no Dismiss button on this tree', toastsAll: await page.evaluate(() => window.__toast) });
        // Is any record of the renumbering left once the toast is gone?
        await page.waitForTimeout(9000);
        const toastLater = await page.evaluate(() => { const t = document.getElementById('toast'); return { text: t.innerText, show: t.classList.contains('show') }; });
        const anyRecord = await page.evaluate(() => /word \d+ → \d+/.test(document.body.innerText));
        step('A2b.afterToastGone', { toastLater, bodyHasArrowRecord: anyRecord, metaUi: app_ui(await page.evaluate(() => app.lyricMeta.ui)) });
      }
      await ctx.close();
    }
    // ---------- Scenario B: import -> typed edit -> Dismiss (mouse; blurs the editor) -> Undo ----------
    {
      const ctx = await newCtx(browser);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push('B: ' + e.message));
      await page.goto(url);
      await ready(page);
      await importTxt(page, SONG);
      const imported = await draft(page);
      const c1 = await card(page);
      if (!c1.dismissButtons) {
        step('B.skip', { reason: 'no Dismiss button on this tree', card: c1 });
      } else {
        // Type a line at the end of the song with the keyboard.
        const ta = page.locator('#lyrics-draft');
        await ta.focus();
        await page.evaluate(() => { const d = $ui('lyrics-draft'); d.setSelectionRange(d.value.length, d.value.length); });
        await page.keyboard.type('\nA line typed by hand', { delay: 20 });
        await page.waitForTimeout(400);
        const typed = await draft(page);
        const hT = await hist(page);
        await page.locator('button[data-ui="ly-renumbered-dismiss"]').first().scrollIntoViewIfNeeded();
        await page.click('button[data-ui="ly-renumbered-dismiss"]');
        await page.waitForTimeout(900);
        const hD = await hist(page);
        const cD = await card(page);
        step('B1.typeThenDismiss', { typedAppended: typed.endsWith('A line typed by hand'), histAfterTyping: hT, histAfterDismissClick: hD, card: { shown: cD.shown, meta: cD.meta } });
        const how = await clickUndo(page, 'undo');
        const dU = await draft(page);
        const cU = await card(page);
        step('B2.undo', { how, hist: await hist(page), draftEqualsImported: dU === imported, draftHasTyped: dU.includes('A line typed by hand'), card: { shown: cU.shown } });
        const how2 = await clickUndo(page, 'redo');
        const dR = await draft(page);
        step('B3.redo', { how: how2, draftEqualsTyped: dR === typed, card: { shown: (await card(page)).shown } });
      }
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    fs.writeFileSync(path.join(V, `v7_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
function app_ui(u) {
  return u;
}
