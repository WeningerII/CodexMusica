// diag3: attribute/style mutations on the draft and its ancestors during the
// real Run-review click, with the selection at each mutation record; plus a
// micro-test of Chrome itself: an unfocused textarea whose value and
// selection were set programmatically, then hidden/disabled/readonly toggled.
'use strict';
const L = require('./lib.js');
const TREE = process.argv[2] || 'cand';
const DOC = '[SETUP — returns — 1.T2, 2.end]\n\n[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe\'re sailing on\nLove above';
(async () => {
  const { server, base } = await L.serveTree(TREE);
  const browser = await L.launch();
  try {
    const { ctx, page } = await L.open(browser, base);
    await page.evaluate((t) => { const d = $ui('lyrics-draft'); d.value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); }, DOC);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const d = $ui('lyrics-draft');
      window.__m = [];
      const chain = [];
      for (let n = d; n && n !== document; n = n.parentNode) chain.push(n);
      const mo = new MutationObserver((ms) => { for (const m of ms) window.__m.push({ who: m.target === d ? 'draft' : (m.target.id || m.target.className || m.target.tagName), attr: m.attributeName, val: m.target.getAttribute && m.target.getAttribute(m.attributeName), sel: [d.selectionStart, d.selectionEnd] }); });
      for (const n of chain) mo.observe(n, { attributes: true });
      const ch = () => window.__m.push({ ev: 'selectionchange', sel: [d.selectionStart, d.selectionEnd], active: document.activeElement && (document.activeElement.id || document.activeElement.tagName) });
      document.addEventListener('selectionchange', ch);
      d.addEventListener('selectionchange', ch);
      d.focus(); d.setSelectionRange(19, 23);
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => (window.__m.length = 0));
    await page.locator('[data-ui="ly-run-review"]:visible').first().click();
    await page.waitForTimeout(1500);
    for (const x of await page.evaluate(() => window.__m)) console.log(JSON.stringify(x));
    const micro = await page.evaluate(() => {
      const res = {};
      for (const how of ['hidden', 'display', 'disabled', 'readonly', 'none']) {
        const ta = document.createElement('textarea');
        document.body.appendChild(ta);
        ta.value = 'abcdefghij';
        ta.focus();
        ta.setSelectionRange(2, 4);
        document.body.focus();
        ta.blur();
        ta.value = 'abcdefghijKLMN';
        ta.setSelectionRange(2, 6);
        const b = [ta.selectionStart, ta.selectionEnd];
        if (how === 'hidden') { ta.hidden = true; ta.offsetHeight; ta.hidden = false; }
        if (how === 'display') { ta.style.display = 'none'; ta.offsetHeight; ta.style.display = ''; }
        if (how === 'disabled') { ta.disabled = true; ta.disabled = false; }
        if (how === 'readonly') { ta.readOnly = true; ta.readOnly = false; }
        res[how] = { before: b, after: [ta.selectionStart, ta.selectionEnd] };
        ta.remove();
      }
      return res;
    });
    console.log('MICRO', JSON.stringify(micro));
    const fin = await L.state(page);
    console.log('FINAL', JSON.stringify(fin.sel), fin.active);
    await ctx.close();
  } finally { await browser.close(); server.close(); }
})().catch((e) => (console.error(e), process.exit(1)));
