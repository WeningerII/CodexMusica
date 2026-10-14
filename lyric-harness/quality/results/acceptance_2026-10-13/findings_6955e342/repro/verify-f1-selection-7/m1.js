// m1: the d1 claim from scratch. Phone (390x844, isMobile, hasTouch), caret or
// selection on the Song tab, leave to Review, Run review (a send boundary),
// come back to Song. Where is the selection, and which characters are under
// it? Caret positions are found by searching the tree's ACTUAL draft text
// (61b/678 migrate at the typing refresh, so offsets differ there).
// Usage: node m1.js <tree> <via,via,...> [trace]
'use strict';
const L = require('./lib7.js');
const TREE = process.argv[2];
const VIAS = (process.argv[3] || 'prog,click,touch,kbd').split(',');
const TRACE = process.argv[4] === 'trace';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const DOC = process.env.DOC || `[SETUP — returns — 1.T2, 2.end]\n\n${BODY}`;
// [name, anchor string, start offset within anchor, end offset within anchor]
const CASES = [
  ['sung_walk', 'walk', 1, 1],
  ['sung_sel_wellworn', 'Well-worn', 0, 9],
  ['row_in_2end', '2.end', 2, 2],
  ['row_before_1T', '1.T', 0, 0],
];
const init = () => {
  window.__selLog = [];
  const P = HTMLTextAreaElement.prototype;
  const ssr = P.setSelectionRange;
  P.setSelectionRange = function (a, b, d) {
    if (this.id === 'lyrics-draft' || this.dataset?.ui === 'lyrics-draft') window.__selLog.push({ op: 'ssr', a, b, stack: new Error().stack.split('\n').slice(2, 6).map((s) => s.trim()).join(' < ') });
    return ssr.call(this, a, b, d);
  };
  const vd = Object.getOwnPropertyDescriptor(P, 'value');
  Object.defineProperty(P, 'value', {
    configurable: true,
    enumerable: vd.enumerable,
    get() { return vd.get.call(this); },
    set(v) {
      if (this.id === 'lyrics-draft' || this.dataset?.ui === 'lyrics-draft') {
        const same = vd.get.call(this) === v;
        window.__selLog.push({ op: 'value=', same, len: String(v).length, stack: new Error().stack.split('\n').slice(2, 6).map((s) => s.trim()).join(' < ') });
      }
      return vd.set.call(this, v);
    },
  });
};
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const out = { tree: TREE, doc: DOC, runs: {} };
  try {
    for (const via of VIAS)
      for (const [name, anchor, so, eo] of CASES) {
        const key = `${via}/${name}`;
        const { ctx, page, q, errors } = await L.boot(browser, base, { init: TRACE ? init : null });
        const c = {};
        try {
          if (process.env.INSERT === '1') {
            // The writer pastes the text into the empty Song editor (one
            // insertText = one paste); no boundary runs.
            if ((await L.st(page)).mobile !== 'song') await L.activate(page, 'tab', 'song', 'prog');
            await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.select(); });
            await page.keyboard.insertText(DOC);
            await page.waitForTimeout(600);
          } else await L.setDraft(page, DOC);
          await page.waitForTimeout(300);
          const t0 = await L.st(page);
          c.mobileAtStart = t0.mobile;
          c.textAfterSetDraftMigrated = t0.text !== DOC;
          if (t0.mobile !== 'song') await L.activate(page, 'tab', 'song', via === 'prog' ? 'prog' : via);
          const at = t0.text.indexOf(anchor);
          if (at < 0) throw new Error('anchor not found ' + anchor);
          const s = at + so, e = at + eo;
          await page.evaluate(([s, e]) => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(s, e); }, [s, e]);
          await page.waitForTimeout(200);
          const pre = await L.st(page);
          c.before = { sel: pre.sel, shown: L.show(pre.text, pre.sel[0], pre.sel[1]), chars: pre.text.slice(pre.sel[0], pre.sel[1]) };
          if (TRACE) await page.evaluate(() => (window.__selLog.length = 0));
          await L.activate(page, 'tab', 'review', via);
          await page.waitForTimeout(300);
          const r1 = await L.st(page);
          c.onReview = { mobile: r1.mobile, songCaret: r1.songCaret, liveSel: r1.sel };
          if (TRACE) c.traceLeave = await page.evaluate(() => window.__selLog.splice(0));
          c.runReviewButtons = await page.locator('[data-ui="ly-run-review"]:visible').count();
          await L.activate(page, 'btn', 'ly-run-review', via);
          await L.waitIdle(page);
          const mid = await L.st(page);
          c.sends = q.calls.length;
          c.migrated = mid.text !== pre.text;
          c.afterBoundary = { mobile: mid.mobile, sel: mid.sel, shown: L.show(mid.text, mid.sel[0], mid.sel[1]), songCaret: mid.songCaret };
          if (TRACE) c.traceBoundary = await page.evaluate(() => window.__selLog.splice(0));
          await L.activate(page, 'tab', 'song', via);
          await page.waitForTimeout(400);
          const back = await L.st(page);
          if (TRACE) c.traceReturn = await page.evaluate(() => window.__selLog.splice(0));
          // Same characters: the anchor's position in the final text (sung
          // rows are byte-identical; for the row cases the anchor is unique).
          const at2 = back.text.indexOf(anchor);
          c.expected = { sel: [at2 + so, at2 + eo], shown: L.show(back.text, at2 + so, at2 + eo) };
          c.restored = { mobile: back.mobile, sel: back.sel, shown: L.show(back.text, back.sel[0], back.sel[1]), chars: back.text.slice(back.sel[0], back.sel[1]), focused: back.focused };
          c.restoredEqualsRawSaved = back.sel[0] === pre.sel[0] && back.sel[1] === pre.sel[1];
          c.sameChars = back.sel[0] === at2 + so && back.sel[1] === at2 + eo;
          // A keyboard return to the text (external keyboard / assistive focus):
          await page.evaluate(() => $ui('lyrics-draft').focus());
          await page.keyboard.type('ZQ', { delay: 20 });
          await page.waitForTimeout(250);
          const typed = await L.st(page);
          const z = typed.text.indexOf('ZQ');
          const rowIdx = typed.text.slice(0, z).split('\n').length - 1;
          c.typedRow = typed.text.split('\n')[rowIdx];
          c.typedSung = await page.evaluate((t) => lyParse(t).sung.map((x) => x.text), typed.text);
          c.errors = errors;
        } catch (x) {
          c.threw = String(x.stack || x);
        }
        out.runs[key] = c;
        console.log(`[${TREE}] ${key}: migratedAtSetDraft=${c.textAfterSetDraftMigrated} sends=${c.sends} migratedAtBoundary=${c.migrated} sameChars=${c.sameChars} restoredEqualsRaw=${c.restoredEqualsRawSaved}\n   before   ${JSON.stringify(c.before)}\n   onReview ${JSON.stringify(c.onReview)}\n   boundary ${JSON.stringify(c.afterBoundary)}\n   restored ${JSON.stringify(c.restored)}\n   expected ${JSON.stringify(c.expected)}\n   typed ZQ row: ${JSON.stringify(c.typedRow)}${c.threw ? '\n   THREW ' + c.threw : ''}`);
        if (TRACE) console.log('   traceBoundary ' + JSON.stringify(c.traceBoundary) + '\n   traceReturn ' + JSON.stringify(c.traceReturn));
        await ctx.close();
      }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `m1_${TREE}_${VIAS.join('-')}${TRACE ? '_trace' : ''}${process.env.TAG ? '_' + process.env.TAG : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
