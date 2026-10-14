// m2: controls for the d1 claim. Same phone round trip as m1 (Song -> Review
// -> an action on the Review tab -> Song), with the Review-tab action varied:
//   fixcount : tap the Review card "Set the header to 4 lines" (a header row
//              ABOVE the caret is rewritten 1 char shorter; no send) -- exists
//              unchanged on main/base.
//   gate     : a pending (unapplied) Word rules entry, then Run review -> the
//              gate's "Apply all" (inserts a [SETUP — require — …] row ABOVE
//              the caret, then sends) -- a Run review that rewrites the text
//              on main/base too.
//   nomig    : Run review on a draft whose returns row already carries the
//              current cut mark (the candidate's migration has nothing to do).
//   mig      : the d1 scenario itself (unmarked returns row), for reference.
// Usage: node m2.js <tree> <scen> <via,via,...>
'use strict';
const L = require('./lib7.js');
const TREE = process.argv[2];
const SCEN = process.argv[3];
const VIAS = (process.argv[4] || 'prog,click,touch,kbd').split(',');
const BODY = `Oh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const DOCS = {
  fixcount: `[VERSE — 12 lines]\n${BODY}`,
  gate: `[VERSE]\n${BODY}`,
  nomig: `[SETUP — returns — 1.T3, 2.end — cut v2]\n\n[VERSE]\n${BODY}`,
  mig: `[SETUP — returns — 1.T2, 2.end]\n\n[VERSE]\n${BODY}`,
};
const DOC = DOCS[SCEN];
const CASES = [
  ['sung_walk', 'walk', 1, 1],
  ['sung_sel_wellworn', 'Well-worn', 0, 9],
];
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const out = { tree: TREE, scen: SCEN, doc: DOC, runs: {} };
  try {
    for (const via of VIAS)
      for (const [name, anchor, so, eo] of CASES) {
        const key = `${SCEN}/${via}/${name}`;
        const { ctx, page, q, errors } = await L.boot(browser, base);
        const c = {};
        try {
          await L.setDraft(page, DOC);
          await page.waitForTimeout(300);
          const t0 = await L.st(page);
          c.textChangedAtSetDraft = t0.text !== DOC;
          if (t0.mobile !== 'song') await L.activate(page, 'tab', 'song', via);
          if (SCEN === 'gate')
            await page.evaluate(() => { lyDraftSet('word-rules', 'song', 'require', ['love']); lyRefresh(true); });
          const at = t0.text.indexOf(anchor);
          const s = at + so, e = at + eo;
          await page.evaluate(([s, e]) => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(s, e); }, [s, e]);
          await page.waitForTimeout(200);
          const pre = await L.st(page);
          c.pending = await page.evaluate(() => lyPendingAll());
          c.before = { sel: pre.sel, shown: L.show(pre.text, pre.sel[0], pre.sel[1]) };
          await L.activate(page, 'tab', 'review', via);
          await page.waitForTimeout(300);
          c.songCaret = await page.evaluate(() => LY.songCaret);
          if (SCEN === 'fixcount') {
            c.actionButtons = await page.locator('[data-ui="ly-fix-count"]:visible').count();
            if (via === 'prog') await page.evaluate(() => LY_ACTIONS['ly-fix-count']('0'));
            else await L.activate(page, 'btn', 'ly-fix-count', via);
          } else {
            await L.activate(page, 'btn', 'ly-run-review', via);
            await page.waitForTimeout(300);
            if (SCEN === 'gate') {
              c.gateButtons = await page.locator('[data-ui="ly-gate-apply"]:visible').count();
              await L.activate(page, 'btn', 'ly-gate-apply', via);
            }
          }
          await L.waitIdle(page);
          const mid = await L.st(page);
          c.sends = q.calls.length;
          c.rewritten = mid.text !== pre.text;
          c.firstRowsAfter = mid.text.split('\n').slice(0, 3);
          c.afterAction = { mobile: mid.mobile, sel: mid.sel, shown: L.show(mid.text, mid.sel[0], mid.sel[1]) };
          await L.activate(page, 'tab', 'song', via);
          await page.waitForTimeout(400);
          const back = await L.st(page);
          const at2 = back.text.indexOf(anchor);
          c.expected = { sel: [at2 + so, at2 + eo], shown: L.show(back.text, at2 + so, at2 + eo) };
          c.restored = { mobile: back.mobile, sel: back.sel, shown: L.show(back.text, back.sel[0], back.sel[1]), focused: back.focused };
          c.restoredEqualsRawSaved = back.sel[0] === pre.sel[0] && back.sel[1] === pre.sel[1];
          c.sameChars = back.sel[0] === at2 + so && back.sel[1] === at2 + eo;
          await page.evaluate(() => $ui('lyrics-draft').focus());
          await page.keyboard.type('ZQ', { delay: 20 });
          await page.waitForTimeout(250);
          const typed = await L.st(page);
          const z = typed.text.indexOf('ZQ');
          c.typedRow = typed.text.split('\n')[typed.text.slice(0, z).split('\n').length - 1];
          c.errors = errors;
        } catch (x) {
          c.threw = String(x.stack || x);
        }
        out.runs[key] = c;
        console.log(`[${TREE}] ${key}: pending=${c.pending} sends=${c.sends} rewritten=${c.rewritten} sameChars=${c.sameChars} restoredEqualsRaw=${c.restoredEqualsRawSaved}\n   rows0-2  ${JSON.stringify(c.firstRowsAfter)}\n   before   ${JSON.stringify(c.before)} songCaret=${JSON.stringify(c.songCaret)}\n   action   ${JSON.stringify(c.afterAction)}\n   restored ${JSON.stringify(c.restored)}\n   expected ${JSON.stringify(c.expected)}\n   typed ZQ row: ${JSON.stringify(c.typedRow)}${c.threw ? '\n   THREW ' + c.threw : ''}`);
        await ctx.close();
      }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `m2_${TREE}_${SCEN}_${VIAS.join('-')}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
