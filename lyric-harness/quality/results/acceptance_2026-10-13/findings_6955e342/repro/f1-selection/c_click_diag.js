// Why does a real click on Run review leave the selection at [0,0] on the
// candidate? Instrument: the selection before/after lyEnsureTokenScheme,
// every later change of selectionStart (polled), the textarea's visibility,
// and a control row that does NOT migrate (marked) on the same page.
// Usage: node c_click_diag.js <cand|main>
'use strict';
const L = require('./f1lib.js');
const TREE = process.argv[2] || 'cand';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const DOCS = {
  unmarked: `[SETUP — returns — 1.T2, 2.end]\n\n${BODY}`,
  marked: `[SETUP — returns — 1.T3, 2.end — cut v2]\n\n${BODY}`,
};
(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const out = {};
  try {
    for (const [k, doc] of Object.entries(DOCS)) {
      const { ctx, page, errors } = await L.boot(browser, base);
      await page.evaluate(() => {
        window.__trace = [];
        const d = $ui('lyrics-draft');
        const push = (what) => window.__trace.push({ what, t: Math.round(performance.now()), sel: [d.selectionStart, d.selectionEnd], focused: document.activeElement === d, visible: !!(d.offsetWidth || d.offsetHeight), len: d.value.length });
        window.__push = push;
        if (typeof window.lyEnsureTokenScheme === 'function') {
          const orig = window.lyEnsureTokenScheme;
          window.lyEnsureTokenScheme = function () {
            push('ensure:before(' + [...arguments].join(',') + ')');
            const r = orig.apply(this, arguments);
            push('ensure:after=' + r);
            return r;
          };
        }
        d.addEventListener('blur', () => push('blur'));
        let last = null;
        setInterval(() => {
          const s = JSON.stringify([d.selectionStart, d.selectionEnd, d.value.length]);
          if (s !== last) push('poll');
          last = s;
        }, 5);
      });
      await L.setDraft(page, doc);
      await page.waitForTimeout(300);
      const at = doc.indexOf('walk') + 1;
      await page.evaluate((at) => {
        const d = $ui('lyrics-draft');
        d.focus();
        d.setSelectionRange(at, at);
        window.__push('set');
      }, at);
      await page.waitForTimeout(100);
      const btn = page.locator('[data-ui="ly-run-review"]:visible').first();
      const where = await btn.evaluate((b) => ({ html: b.outerHTML.slice(0, 200), parent: b.parentElement?.className }));
      await btn.click();
      await L.waitIdle(page);
      await page.waitForTimeout(300);
      const trace = await page.evaluate(() => window.__trace);
      const st = await L.state(page);
      out[k] = { where, trace, final: { sel: st.sel, focused: st.focused, migrated: st.text !== doc }, errors };
      console.log(`[${TREE}] ${k}: final sel ${JSON.stringify(st.sel)} focused=${st.focused} migrated=${st.text !== doc}`);
      for (const t of trace) console.log('   ', JSON.stringify(t));
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `c_click_diag_${TREE}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
