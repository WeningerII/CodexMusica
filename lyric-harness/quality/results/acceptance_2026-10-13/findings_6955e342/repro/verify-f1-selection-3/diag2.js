// diag2: which page function moves the selection to [0,0] after the real
// Run-review click on the candidate? Wrap every global function whose name
// starts with ly/ui/render/push/_chat and log selection before/after each call
// that changes it (outermost change wins the blame by order).
'use strict';
const L = require('./lib.js');
const TREE = process.argv[2] || 'cand';
const DOC = '[SETUP — returns — 1.T2, 2.end]\n\n[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe\'re sailing on\nLove above';
(async () => {
  const { server, base } = await L.serveTree(TREE);
  const browser = await L.launch();
  try {
    const { ctx, page } = await L.open(browser, base);
    await page.evaluate((t) => {
      const d = $ui('lyrics-draft');
      d.value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true);
    }, DOC);
    await page.waitForTimeout(300);
    const n = await page.evaluate(() => {
      const d = $ui('lyrics-draft');
      window.__log = [];
      let depth = 0;
      const names = Object.getOwnPropertyNames(window).filter((k) => /^(ly|ui|render|push|_chat|show)/.test(k) && typeof window[k] === 'function' && !/^(lyDraft|lyParse|lyMeta|uiCount|lyQuote)$/.test(k));
      for (const k of names) {
        const f = window[k];
        try {
          window[k] = function (...a) {
            const b = [d.selectionStart, d.selectionEnd];
            depth++;
            try { return f.apply(this, a); } finally {
              depth--;
              const e = [d.selectionStart, d.selectionEnd];
              if (b[0] !== e[0] || b[1] !== e[1]) window.__log.push({ fn: k, depth, before: b, after: e, t: Math.round(performance.now()) });
            }
          };
        } catch (x) {}
      }
      d.addEventListener('blur', () => window.__log.push({ ev: 'blur', sel: [d.selectionStart, d.selectionEnd] }));
      d.addEventListener('focus', () => window.__log.push({ ev: 'focus', sel: [d.selectionStart, d.selectionEnd] }));
      new MutationObserver((ms) => { for (const m of ms) for (const r of m.removedNodes) if (r === d || (r.contains && r.contains(d))) window.__log.push({ ev: 'draft-removed', sel: [d.selectionStart, d.selectionEnd] }); for (const m of ms) for (const r of m.addedNodes) if (r === d || (r.contains && r.contains(d))) window.__log.push({ ev: 'draft-added', sel: [d.selectionStart, d.selectionEnd] }); }).observe(document.body, { childList: true, subtree: true });
      d.focus();
      d.setSelectionRange(19, 23);
      return names.length;
    });
    await page.locator('[data-ui="ly-run-review"]:visible').first().click();
    await page.waitForTimeout(1500);
    const log = await page.evaluate(() => window.__log);
    const fin = await L.state(page);
    console.log('wrapped', n);
    for (const x of log) console.log(JSON.stringify(x));
    console.log('FINAL', JSON.stringify(fin.sel), fin.active);
    await ctx.close();
  } finally { await browser.close(); server.close(); }
})().catch((e) => (console.error(e), process.exit(1)));
