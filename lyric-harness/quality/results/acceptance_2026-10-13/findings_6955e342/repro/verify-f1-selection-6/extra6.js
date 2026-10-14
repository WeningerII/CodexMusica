// What the reset needs on the real page, when it happens, and whether the
// page could hold the selection. Draft = 3PO's row (rewritten at the send)
// + the body; caret at "w|alk" (63 -> mapped 72). One fresh page per case.
//   every_button      each visible Run review button, mouse click
//   click_else_first  the writer clicks plain page text, then Run review
//   tab_out_click     the writer Tabs out of the editor, then clicks Run review
//   timing            selection in the handler, at t+0 task, first rAF, 500 ms
//   fix_raf           (probe only) lyEnsureTokenScheme wrapped to re-apply its
//                     mapped selection in the next animation frame
//   fix_mousedown_pd  (probe only) mousedown preventDefault on Run review
//   mouse_return      after the reset, the writer clicks back into the editor
// Usage: node extra6.js <tree> [case,...]
'use strict';
const L = require('./lib6.js');
const TREE = process.argv[2] || 'cand';
const CASES = (process.argv[3] || 'every_button,click_else_first,tab_out_click,timing,fix_raf,fix_mousedown_pd,mouse_return').split(',');
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const DOC = `[SETUP — returns — 1.T2, 2.end]\n\n${BODY}`;
async function prep(page) {
  await page.evaluate(() => {
    if (typeof _chatReset === 'function') _chatReset();
    LY.run = null;
    LY.conflict = null;
    LY.gate = null;
  });
  await L.setDraft(page, DOC);
  await page.waitForTimeout(250);
  const at = DOC.indexOf('walk') + 1;
  await page.evaluate((at) => {
    const d = $ui('lyrics-draft');
    d.focus();
    d.setSelectionRange(at, at);
    window.__t = [];
    const push = (w) => window.__t.push({ w, t: Math.round(performance.now()), sel: [d.selectionStart, d.selectionEnd] });
    window.__push = push;
    if (typeof lyEnsureTokenScheme === 'function') {
      const orig = lyEnsureTokenScheme;
      window.lyEnsureTokenScheme = function () {
        const r = orig.apply(this, arguments);
        push('ensure returned ' + r);
        if (r) {
          setTimeout(() => push('t+0 task'), 0);
          requestAnimationFrame(() => push('first rAF'));
        }
        return r;
      };
    }
  }, at);
  await page.waitForTimeout(150);
  return at;
}
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const out = [];
  try {
    for (const cs of CASES) {
      // every_button: find the visible Run review buttons first.
      let targets = [null];
      if (cs === 'every_button') {
        const { ctx, page } = await L.boot(browser, base);
        await prep(page);
        targets = await page.evaluate(() => {
          const r = [];
          for (const tab of ['review', 'writer']) {
            LY.tab = tab; lyRefresh(true);
            [...document.querySelectorAll('[data-ui="ly-run-review"]')].forEach((b, i) => { if (b.offsetWidth && b.offsetHeight) r.push({ tab, i, where: b.closest('[id]')?.id || '', cls: b.className }); });
          }
          return r;
        });
        await ctx.close();
      }
      for (const tgt of targets) {
        const { ctx, page, errors } = await L.boot(browser, base);
        const c = { tree: TREE, case: cs, target: tgt };
        try {
          if (tgt && tgt.tab) await page.evaluate((tab) => { LY.tab = tab; lyRefresh(true); }, tgt.tab);
          const at = await prep(page);
          c.before = (await L.sel(page)).sel;
          if (cs === 'fix_raf')
            await page.evaluate(() => {
              const inner = window.lyEnsureTokenScheme;
              window.lyEnsureTokenScheme = function () {
                const d = $ui('lyrics-draft');
                const r = inner.apply(this, arguments);
                if (r) { const s = [d.selectionStart, d.selectionEnd, d.selectionDirection]; requestAnimationFrame(() => d.setSelectionRange(...s)); }
                return r;
              };
            });
          if (cs === 'fix_mousedown_pd')
            await page.evaluate(() => document.addEventListener('mousedown', (e) => { if (e.target.closest?.('[data-ui="ly-run-review"]')) e.preventDefault(); }, true));
          if (cs === 'click_else_first') {
            // A plain, non-interactive text node on the page.
            const p = await page.evaluate(() => {
              const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
              let n;
              while ((n = w.nextNode())) {
                const el = n.parentElement;
                if (!n.textContent.trim() || el.closest('button,a,input,textarea,select,label,[data-ui],[contenteditable],[role=button],[tabindex],#ly-overlay')) continue;
                const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect();
                if (b.width > 20 && b.height > 5 && b.top > 0 && b.bottom < innerHeight) return { x: b.left + 5, y: b.top + b.height / 2, text: n.textContent.trim().slice(0, 40), el: el.tagName + '.' + el.className };
              }
              return null;
            });
            c.clickedText = p;
            await page.mouse.click(p.x, p.y);
            await page.waitForTimeout(150);
            c.afterElseClick = await page.evaluate(() => { const s = getSelection(); return { active: document.activeElement?.tagName, docSel: s.anchorNode ? (s.anchorNode.parentElement?.className || s.anchorNode.nodeName) : null }; });
          }
          if (cs === 'tab_out_click') {
            await page.keyboard.press('Tab');
            await page.waitForTimeout(150);
            c.afterTab = await page.evaluate(() => document.activeElement?.dataset?.ui || document.activeElement?.id || document.activeElement?.tagName);
          }
          if (tgt) await page.locator('[data-ui="ly-run-review"]').nth(tgt.i).click();
          else await page.locator('[data-ui="ly-run-review"]:visible').first().click();
          await page.waitForTimeout(500);
          await page.evaluate(() => window.__push('500ms'));
          await L.idle(page);
          const post = await L.sel(page);
          c.text0 = post.text.split('\n')[0];
          c.after = post.sel;
          c.expected = post.text.indexOf('walk') + 1;
          c.kept = post.sel[0] === c.expected && post.sel[1] === c.expected;
          c.trace = await page.evaluate(() => window.__t);
          if (cs === 'mouse_return') {
            // Click into the editor's text area near its middle: the caret goes
            // where the mouse puts it, whatever the cached selection was.
            const box = await page.locator('#lyrics-draft, [data-ui="lyrics-draft"]').first().boundingBox().catch(() => null);
            const d = await page.evaluate(() => { const r = $ui('lyrics-draft').getBoundingClientRect(); return { x: r.left + 40, y: r.top + r.height / 2 }; });
            await page.mouse.click(d.x, d.y);
            await page.waitForTimeout(200);
            c.afterMouseReturn = (await L.sel(page)).sel;
          }
          c.errors = errors.splice(0);
        } catch (x) {
          c.threw = String(x.stack || x).slice(0, 500);
        }
        out.push(c);
        console.log(`${TREE} ${cs}${tgt ? ' ' + JSON.stringify(tgt) : ''}: before=${JSON.stringify(c.before)} after=${JSON.stringify(c.after)} expected=${c.expected} ${c.kept ? 'KEPT' : 'LOST'}${c.clickedText ? ' clicked ' + JSON.stringify(c.clickedText) + ' ' + JSON.stringify(c.afterElseClick) : ''}${c.afterTab ? ' afterTab=' + c.afterTab : ''}${c.afterMouseReturn ? ' mouseReturn=' + JSON.stringify(c.afterMouseReturn) : ''}\n   trace ${JSON.stringify((c.trace || []).map((x) => [x.w, x.t, x.sel[0]]))}${c.threw ? '\n   THREW ' + c.threw : ''}`);
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `extra6_${TREE}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
