// (d) On a phone the Song tab remembers the caret by raw offsets
// (LY.songCaret, 'ly-mobile') when the writer leaves it, and restores them
// when they come back. A send boundary in between (Run review on the Review
// tab) rewrites the text above the caret. Where does the restored caret land?
// Usage: node d_mobile.js <cand|main>
'use strict';
const L = require('./f1lib.js');
const R = require('./refmap.js');
const TREE = process.argv[2] || 'cand';
// VIA 'tap': real taps on the tabs and on Run review; 'prog': the same page
// actions called directly (keyboard/assistive activation, no mouse click).
const VIA = process.argv[3] || 'tap';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const ROW = '[SETUP — returns — 1.T2, 2.end]';
const DOC = `${ROW}\n\n${BODY}`;
const CASES = {
  sung_walk: [DOC.indexOf('walk') + 1, DOC.indexOf('walk') + 1],
  sung_sel_line: [DOC.indexOf('Well-worn'), DOC.indexOf('Well-worn') + 'Well-worn'.length],
  row_in_2end: [DOC.indexOf('2.end') + 2, DOC.indexOf('2.end') + 2],
};
(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const out = { tree: TREE, cases: {} };
  try {
    for (const [k, [s, e]] of Object.entries(CASES)) {
      const { ctx, page, errors } = await L.boot(browser, base, { width: 390, height: 844, mobile: true });
      const c = {};
      try {
        c.size = await page.evaluate(() => ({ size: LY.size, mobile: LY.mobile }));
        await L.setDraft(page, DOC);
        await page.waitForTimeout(300);
        if (c.size.mobile !== 'song') await page.click('#ly-mtab-song');
        await page.evaluate(([s, e]) => {
          const d = $ui('lyrics-draft');
          d.focus();
          d.setSelectionRange(s, e);
        }, [s, e]);
        await page.waitForTimeout(200);
        const pre = await L.state(page);
        c.before = { sel: pre.sel, shown: R.show(pre.text, pre.sel[0], pre.sel[1]) };
        if (VIA === 'tap') await page.click('#ly-mtab-review');
        else await page.evaluate(() => LY_ACTIONS['ly-mobile']('review'));
        await page.waitForTimeout(300);
        c.songCaretSaved = await page.evaluate(() => LY.songCaret);
        const btn = page.locator('[data-ui="ly-run-review"]:visible').first();
        c.buttonVisible = await btn.count();
        if (VIA === 'tap') await btn.click();
        else await page.evaluate(() => { LY_ACTIONS['ly-run-review'](); });
        await L.waitIdle(page);
        const mid = await L.state(page);
        c.migrated = mid.text !== pre.text;
        c.afterBoundary = { sel: mid.sel, shown: R.show(mid.text, mid.sel[0], mid.sel[1]) };
        if (VIA === 'tap') await page.click('#ly-mtab-song');
        else await page.evaluate(() => LY_ACTIONS['ly-mobile']('song'));
        await page.waitForTimeout(400);
        const back = await L.state(page);
        c.restored = { sel: back.sel, shown: R.show(back.text, back.sel[0], back.sel[1]), focused: back.focused, activeId: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName) };
        const ref = c.migrated ? [R.refMap(pre.text, back.text, s), R.refMap(pre.text, back.text, e)] : [{ lo: s, hi: s }, { lo: e, hi: e }];
        c.ref = ref;
        c.expectedShown = R.show(back.text, ref[0].lo, ref[1].hi);
        c.sameChars = back.sel[0] >= ref[0].lo && back.sel[0] <= ref[0].hi && back.sel[1] >= ref[1].lo && back.sel[1] <= ref[1].hi;
        c.selectedBefore = pre.text.slice(s, e);
        c.selectedAfter = back.text.slice(back.sel[0], back.sel[1]);
        // A keyboard return to the text (external keyboard / assistive focus).
        await page.evaluate(() => $ui('lyrics-draft').focus());
        await page.keyboard.type('ZQ', { delay: 30 });
        await page.waitForTimeout(300);
        const typed = await L.state(page);
        const z = typed.text.indexOf('ZQ');
        c.typed = { line: typed.text.slice(0, z).split('\n').length, row: typed.text.split('\n')[typed.text.slice(0, z).split('\n').length - 1] };
        c.parsed = await L.parseAsPage(page, typed.text);
        c.errors = errors;
      } catch (x) {
        c.threw = String(x.stack || x);
      }
      out.cases[k] = c;
      console.log(`[${TREE}/${VIA}] ${k}: size=${JSON.stringify(c.size)} migrated=${c.migrated} sameChars=${c.sameChars}\n   before ${JSON.stringify(c.before)}\n   songCaret ${JSON.stringify(c.songCaretSaved)}\n   after boundary ${JSON.stringify(c.afterBoundary)}\n   restored ${JSON.stringify(c.restored)}\n   expected ${JSON.stringify(c.expectedShown)}\n   typed ZQ -> line ${c.typed?.line}: ${JSON.stringify(c.typed?.row)}${c.threw ? '\n   THREW ' + c.threw : ''}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `d_mobile_${TREE}_${VIA}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
