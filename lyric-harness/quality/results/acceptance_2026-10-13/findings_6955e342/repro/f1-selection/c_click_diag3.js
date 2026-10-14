// Does the page move/hide the editor after the click-triggered boundary?
// MutationObserver for removals/insertions containing the draft and for
// attribute changes on it and its ancestors; selection polled at 1 ms.
'use strict';
const L = require('./f1lib.js');
const TREE = process.argv[2] || 'cand';
const KIND = process.argv[3] || 'click';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const doc = `[SETUP — returns — 1.T2, 2.end]\n\n${BODY}`;
(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const { ctx, page } = await L.boot(browser, base);
  await L.setDraft(page, doc);
  await page.waitForTimeout(300);
  await page.evaluate((at) => {
    const d = $ui('lyrics-draft');
    window.__trace = [];
    const push = (what) => window.__trace.push({ what, t: Math.round(performance.now()), sel: [d.selectionStart, d.selectionEnd], same: $ui('lyrics-draft') === d, connected: d.isConnected, display: getComputedStyle(d).display, vis: getComputedStyle(d).visibility });
    window.__push = push;
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === 'childList') {
          for (const n of [...m.removedNodes]) if (n === d || (n.contains && n.contains(d))) push('removed ' + (n.id || n.className || n.nodeName));
          for (const n of [...m.addedNodes]) if (n === d || (n.contains && n.contains(d))) push('added ' + (n.id || n.className || n.nodeName));
        } else if (m.type === 'attributes' && (m.target === d || m.target.contains(d))) push(`attr ${m.attributeName} on ${m.target.id || m.target.className || m.target.nodeName}`);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
    const orig = window.lyEnsureTokenScheme;
    window.lyEnsureTokenScheme = function () { push('ensure:before'); const r = orig.apply(this, arguments); push('ensure:after=' + r); return r; };
    let last = null;
    setInterval(() => { const s = JSON.stringify([d.selectionStart, d.selectionEnd]); if (s !== last) push('poll'); last = s; }, 1);
    d.focus();
    d.setSelectionRange(at, at);
  }, doc.indexOf('walk') + 1);
  await page.waitForTimeout(100);
  if (KIND === 'click') await page.locator('[data-ui="ly-run-review"]:visible').first().click();
  else if (KIND === 'blurprog') await page.evaluate(() => { $ui('lyrics-draft').blur(); window.__push('blurred'); LY_ACTIONS['ly-run-review'](); });
  else if (KIND === 'mouseblur_prog') { await page.mouse.click(5, 450); await page.waitForTimeout(100); await page.evaluate(() => { window.__push('after mouse blur'); LY_ACTIONS['ly-run-review'](); }); }
  else if (KIND === 'kbd') { await page.evaluate(() => { document.querySelector('[data-ui="ly-run-review"]:not([hidden])') && [...document.querySelectorAll('[data-ui="ly-run-review"]')].find((b) => b.offsetWidth).focus(); window.__push('button focused'); }); await page.keyboard.press('Enter'); }
  else if (KIND === 'click_ensure_only') { await page.evaluate(() => { const b = document.createElement('button'); b.id = 'probe-btn'; b.textContent = 'probe'; b.style.cssText = 'position:fixed;left:2px;top:2px;z-index:99999'; b.addEventListener('click', () => { window.__push('probe click'); lyEnsureTokenScheme(); }); document.body.append(b); }); await page.click('#probe-btn'); }
  else if (KIND === 'blurensure') await page.evaluate(() => { $ui('lyrics-draft').blur(); window.__push('blurred'); lyEnsureTokenScheme(); });
  await L.waitIdle(page);
  const trace = await page.evaluate(() => window.__trace);
  let prev = null;
  for (const t of trace) { const s = JSON.stringify(t); if (s !== prev) console.log(s); prev = s; }
  L.fs.writeFileSync(L.path.join(L.OUT, `c_click_diag3_${TREE}_${KIND}.json`), JSON.stringify(trace, null, 2));
  await ctx.close();
  await browser.close();
  server.close();
})().catch((e) => (console.error(e), process.exit(1)));
