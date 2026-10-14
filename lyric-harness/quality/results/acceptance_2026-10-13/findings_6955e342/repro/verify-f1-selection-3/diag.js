// diag: (1) trace every write to the draft's value/selection during a real
// Run-review click on the candidate; (2) a synchronous unit control on every
// tree: value + selection + lyEnsureTokenScheme() in one task (no refresh can
// run first), where does the selection land?
// Usage: node diag.js <cand|c61b|main>
'use strict';
const L = require('./lib.js');
const TREE = process.argv[2] || 'cand';
const BODY = '[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe\'re sailing on\nLove above';
const ROW = '[SETUP — returns — 1.T2, 2.end]';
const DOC = `${ROW}\n\n${BODY}`;
(async () => {
  const { server, base } = await L.serveTree(TREE);
  const browser = await L.launch();
  const out = { tree: TREE };
  try {
    // (2) synchronous unit control
    {
      const { ctx, page } = await L.open(browser, base);
      out.unit = await page.evaluate((doc) => {
        const d = $ui('lyrics-draft');
        const res = {};
        for (const [k, s, e] of [['C_sel_T2', 19, 23], ['C_after_T2', 23, 23], ['S_body', 72, 72]]) {
          d.value = doc;
          d.focus();
          d.setSelectionRange(s, e);
          const ret = typeof lyEnsureTokenScheme === 'function' ? lyEnsureTokenScheme() : 'absent';
          res[k] = { ret, sel: [d.selectionStart, d.selectionEnd], len: d.value.length, row: d.value.split('\n')[0] };
        }
        return res;
      }, DOC);
      console.log('UNIT', JSON.stringify(out.unit));
      await ctx.close();
    }
    // (1) trace during a real Run review click
    if (TREE === 'cand') {
      const { ctx, page } = await L.open(browser, base);
      await page.evaluate(() => {
        const d = $ui('lyrics-draft');
        window.__trace = [];
        const proto = HTMLTextAreaElement.prototype;
        const desc = Object.getOwnPropertyDescriptor(proto, 'value');
        Object.defineProperty(d, 'value', {
          get() { return desc.get.call(this); },
          set(v) {
            const before = [this.selectionStart, this.selectionEnd];
            desc.set.call(this, v);
            window.__trace.push({ op: 'value=', same: false, len: v.length, before, after: [this.selectionStart, this.selectionEnd], stack: new Error().stack.split('\n').slice(2, 7).map((s) => s.trim()) });
          },
          configurable: true,
        });
        const ssr = proto.setSelectionRange;
        d.setSelectionRange = function (a, b, dir) {
          ssr.call(this, a, b, dir);
          window.__trace.push({ op: 'setSelectionRange', args: [a, b, dir], after: [this.selectionStart, this.selectionEnd], stack: new Error().stack.split('\n').slice(2, 7).map((s) => s.trim()) });
        };
        const sel = proto.select;
        d.select = function () { sel.call(this); window.__trace.push({ op: 'select', stack: new Error().stack.split('\n').slice(2, 6) }); };
      });
      await page.evaluate((t) => {
        const d = $ui('lyrics-draft');
        d.value = t;
        uiSaveLyrics();
        pushHistory();
        lyRefresh(true);
      }, DOC);
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const d = $ui('lyrics-draft');
        d.focus();
        d.setSelectionRange(19, 23);
        window.__trace.length = 0;
        // poll the selection every animation frame
        window.__poll = [];
        let last = '';
        const tick = () => {
          const s = `${d.selectionStart},${d.selectionEnd},${d.isConnected},${getComputedStyle(d).display}`;
          if (s !== last) window.__poll.push({ t: Math.round(performance.now()), s });
          last = s;
          if (window.__poll.length < 50) requestAnimationFrame(tick);
        };
        tick();
      });
      await page.locator('[data-ui="ly-run-review"]:visible').first().click();
      await page.waitForTimeout(1200);
      out.trace = await page.evaluate(() => window.__trace);
      out.poll = await page.evaluate(() => window.__poll);
      out.final = await L.state(page);
      out.sameElement = await page.evaluate(() => $ui('lyrics-draft') === document.getElementById('lyrics-draft'));
      console.log('TRACE', JSON.stringify(out.trace, null, 1));
      console.log('POLL', JSON.stringify(out.poll));
      console.log('FINAL', JSON.stringify(out.final.sel), out.final.active);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.V, `diag_${TREE}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
