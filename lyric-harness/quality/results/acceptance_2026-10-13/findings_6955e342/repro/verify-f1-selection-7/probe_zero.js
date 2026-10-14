// Probe: when a real click/tap brings the Song tab back after a rewrite, when
// does the restored selection become [0,0]? Samples the draft's selection
// inside ly-mobile (right after its setSelectionRange), at setTimeout 0, and
// after two animation frames; records the draft's display on the Review tab.
// Usage: node probe_zero.js <tree> <click|touch|prog>
'use strict';
const L = require('./lib7.js');
const TREE = process.argv[2];
const VIA = process.argv[3] || 'click';
const DOC = `[VERSE — 12 lines]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const res = {};
  try {
    for (const rewrite of [true, false]) {
      const { ctx, page } = await L.boot(browser, base);
      await L.setDraft(page, DOC);
      await page.waitForTimeout(300);
      const at = DOC.indexOf('walk') + 1;
      await page.evaluate((s) => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(s, s); }, at);
      await L.activate(page, 'tab', 'review', VIA);
      await page.waitForTimeout(300);
      const hidden = await page.evaluate(() => { const d = $ui('lyrics-draft'); return { display: getComputedStyle(d).display, rects: d.getClientRects().length, ancestorsHidden: (() => { let e = d; while (e) { if (getComputedStyle(e).display === 'none') return e.id || e.className || e.tagName; e = e.parentElement; } return null; })() }; });
      if (rewrite) await page.evaluate(() => LY_ACTIONS['ly-fix-count']('0'));
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        window.__samples = [];
        const d = $ui('lyrics-draft');
        const orig = LY_ACTIONS['ly-mobile'];
        LY_ACTIONS['ly-mobile'] = function (...a) {
          const r = orig.apply(this, a);
          window.__samples.push(['in-handler', d.selectionStart, d.selectionEnd]);
          setTimeout(() => window.__samples.push(['timeout0', d.selectionStart, d.selectionEnd]), 0);
          requestAnimationFrame(() => requestAnimationFrame(() => window.__samples.push(['2raf', d.selectionStart, d.selectionEnd])));
          return r;
        };
        for (const ev of ['pointerup', 'mouseup', 'click', 'touchend'])
          document.addEventListener(ev, () => window.__samples.push(['doc-' + ev + '-capture', d.selectionStart, d.selectionEnd]), true);
        const P = HTMLTextAreaElement.prototype, ssr = P.setSelectionRange;
        P.setSelectionRange = function (a, b, dir) {
          const r = ssr.call(this, a, b, dir);
          if (this === d) window.__samples.push(['after-ssr(' + a + ',' + b + ')', d.selectionStart, d.selectionEnd, 'rects=' + d.getClientRects().length]);
          return r;
        };
        document.addEventListener('click', () => {
          window.__samples.push(['doc-click-bubble-after-page', d.selectionStart, d.selectionEnd, 'rects=' + d.getClientRects().length]);
          setTimeout(() => window.__samples.push(['click+timeout0', d.selectionStart, d.selectionEnd]), 0);
          requestAnimationFrame(() => requestAnimationFrame(() => window.__samples.push(['click+2raf', d.selectionStart, d.selectionEnd])));
        });
      });
      await L.activate(page, 'tab', 'song', VIA);
      await page.waitForTimeout(400);
      const samples = await page.evaluate(() => window.__samples);
      const final = await L.st(page);
      res[rewrite ? 'rewrite' : 'norewrite'] = { savedAt: at, hiddenOnReview: hidden, samples, final: final.sel };
      console.log(`[${TREE}/${VIA}] rewrite=${rewrite} hiddenOnReview=${JSON.stringify(hidden)} samples=${JSON.stringify(samples)} final=${JSON.stringify(final.sel)}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `probe_zero_${TREE}_${VIA}.json`), JSON.stringify(res, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
