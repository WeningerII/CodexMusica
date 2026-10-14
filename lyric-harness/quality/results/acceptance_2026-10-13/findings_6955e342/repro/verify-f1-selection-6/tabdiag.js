// Why does a mouse click on the head's Run review keep the selection when the
// Writer tab is open? Per starting tab (tools, writer, review, history):
// the default tab after boot, focus() calls during the click (hooked), the
// document selection's anchor before the click and right after the handler,
// and the editor's selection in the handler, first rAF and 500 ms later.
// Usage: node tabdiag.js <tree>
'use strict';
const L = require('./lib6.js');
const TREE = process.argv[2] || 'cand';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const DOC = `[SETUP — returns — 1.T2, 2.end]\n\n${BODY}`;
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const out = [];
  try {
    for (const tab of ['default', 'tools', 'writer', 'review', 'history']) {
      const { ctx, page, errors } = await L.boot(browser, base);
      const c = { tree: TREE, tab };
      try {
        c.defaultTab = await page.evaluate(() => LY.tab);
        if (tab !== 'default') await page.evaluate((t) => { LY.tab = t; lyRefresh(true); }, tab);
        await L.setDraft(page, DOC);
        await page.waitForTimeout(250);
        const at = DOC.indexOf('walk') + 1;
        await page.evaluate((at) => {
          const d = $ui('lyrics-draft');
          d.focus();
          d.setSelectionRange(at, at);
          window.__t = [];
          const desc = (n) => (n ? (n.nodeType === 3 ? '#text in ' : '') + ((n.nodeType === 3 ? n.parentElement : n)?.id || (n.nodeType === 3 ? n.parentElement : n)?.className || n.nodeName) : null);
          const docSel = () => { const s = getSelection(); return { type: s.type, anchor: desc(s.anchorNode), inDraft: !!(s.anchorNode && (s.anchorNode === d || d.contains(s.anchorNode))) }; };
          const push = (w) => window.__t.push({ w, t: Math.round(performance.now()), sel: [d.selectionStart, d.selectionEnd], active: document.activeElement === d ? 'draft' : document.activeElement?.dataset?.ui || document.activeElement?.id || document.activeElement?.tagName, docSel: docSel() });
          window.__push = push;
          const of = HTMLElement.prototype.focus;
          HTMLElement.prototype.focus = function () { push('focus() on ' + (this.dataset?.ui || this.id || this.tagName)); return of.apply(this, arguments); };
          const ob = HTMLElement.prototype.blur;
          HTMLElement.prototype.blur = function () { push('blur() on ' + (this.dataset?.ui || this.id || this.tagName)); return ob.apply(this, arguments); };
          const orig = lyEnsureTokenScheme;
          window.lyEnsureTokenScheme = function () {
            push('ensure:before');
            const r = orig.apply(this, arguments);
            push('ensure returned ' + r);
            if (r) {
              Promise.resolve().then(() => push('microtask after ensure'));
              requestAnimationFrame(() => push('first rAF'));
            }
            return r;
          };
          document.addEventListener('mousedown', () => push('mousedown (capture)'), true);
          document.addEventListener('mouseup', () => push('mouseup (capture)'), true);
          document.addEventListener('click', () => push('click (capture)'), true);
          d.addEventListener('blur', () => push('draft blur event'));
        }, at);
        await page.waitForTimeout(150);
        await page.evaluate(() => window.__push('before click'));
        await page.locator('[data-ui="ly-run-review"]:visible').first().click();
        await page.waitForTimeout(500);
        await page.evaluate(() => window.__push('500ms'));
        await L.idle(page);
        const post = await L.sel(page);
        c.after = post.sel;
        c.tabAfter = await page.evaluate(() => LY.tab);
        c.expected = post.text.indexOf('walk') + 1;
        c.kept = post.sel[0] === c.expected;
        c.trace = await page.evaluate(() => window.__t);
        c.errors = errors;
      } catch (x) {
        c.threw = String(x.stack || x).slice(0, 500);
      }
      out.push(c);
      console.log(`${TREE} start tab=${tab} (default ${c.defaultTab}) -> after=${JSON.stringify(c.after)} expected=${c.expected} ${c.kept ? 'KEPT' : 'LOST'} tabAfter=${c.tabAfter}`);
      for (const x of c.trace || []) console.log(`    ${x.t} ${x.w} sel=${x.sel[0]} active=${x.active} docSel=${JSON.stringify(x.docSel)}`);
      if (c.threw) console.log('   THREW ' + c.threw);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `tabdiag_${TREE}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
