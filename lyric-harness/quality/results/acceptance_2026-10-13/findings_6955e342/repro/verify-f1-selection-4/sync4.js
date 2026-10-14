// Synchronous boundary probe (one page task, no refresh can run in between):
// value set, editor focused, selection set, then the send boundary
// (LY_ACTIONS['ly-run-review'] or uiLyricContext('lyrics-edit')) and the
// selection read back at once; then again 400 ms later. For 61b, whose typing
// refresh / focus path migrates first, this isolates what the BOUNDARY's
// rewrite does to the selection. Usage: node sync4.js <tree> <review|context>
'use strict';
const L = require('./lib4.js');
const R = require('./ref4.js');
const BODY = `[VERSE]
Oh--oh, oh my love
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh

[CHORUS]
We're sailing on
Love above`;
const CASES = [
  ['[SETUP — rhyme groups — 1.T2, 2.end]', 'sel 2.end', '2.end', 0, 5],
  ['[SETUP — rhyme groups — 1.T2, 2.end]', 'caret 2.|end', '2.end', 2, 0],
  ['[SETUP — rhyme groups — 2.end,4; 1.T2,3.T2; 5.end, 6]', 'caret 2.|end', '2.end', 2, 0],
  ['[SETUP — rhyme groups — 2.end,4; 1.T2,3.T2; 5.end, 6]', 'sel 4', ',4;', 1, 1],
  ['[SETUP — rhyme groups — 2.end,4; 1.T2,3.T2; 5.end, 6]', 'sel 3.T2', '3.T2', 0, 4],
  ['[SETUP — rhyme groups — 2.end,4; 1.T2,3.T2; 5.end, 6]', 'caret 5|.end', '5.end', 1, 0],
  ['[SETUP — rhyme groups — 2.end,4; 1.T2,3.T2; 5.end, 6]', 'sel 6', ' 6]', 1, 1],
  ['[SETUP — returns — 2.end, 4.end; 5.end,6.end; 1.T2,4.T2]', 'sel 4.T2', '4.T2]', 0, 4],
  ['[SETUP — rhyme groups — 1.T2,2]', 'caret |2', ',2]', 1, 0],
  ['[SETUP — rhyme groups — 1.T2,2]', 'sel 2', ',2]', 1, 1],
];
(async () => {
  const [tree, how] = process.argv.slice(2);
  const { srv, base } = await L.serve(tree);
  const browser = await L.launch();
  const out = { tree, how, cases: [] };
  try {
    for (const [row, label, anchor, off, len] of CASES) {
      const { ctx, page } = await L.open(browser, base);
      const doc = `${row}\n\n${BODY}`;
      const s = row.indexOf(anchor) + off, e = s + len;
      const r = await page.evaluate(
        ([doc, s, e, how]) => {
          const d = $ui('lyrics-draft');
          d.value = doc;
          d.focus();
          d.setSelectionRange(s, e, 'forward');
          const before = [d.selectionStart, d.selectionEnd, d.value === doc];
          if (typeof _chatReset === 'function') _chatReset();
          if (how === 'review') LY_ACTIONS['ly-run-review']();
          else window.uiLyricContext('lyrics-edit');
          return { before, after: [d.selectionStart, d.selectionEnd, d.selectionDirection], text: d.value };
        },
        [doc, s, e, how]
      );
      await page.waitForTimeout(400);
      const later = await L.editorState(page);
      const ra = R.docRange(doc, r.text, s), rb = R.docRange(doc, r.text, e);
      const c = { row, label, before: r.before, after: r.after, newRow: r.text.split('\n')[0], shownAfter: R.show(r.text, r.after[0], r.after[1]), ref: ra && rb ? [[ra.lo, ra.hi], [rb.lo, rb.hi]] : null, sameChars: ra && rb ? r.after[0] >= ra.lo && r.after[0] <= ra.hi && r.after[1] >= rb.lo && r.after[1] <= rb.hi : null, docLen: r.text.length, later: later.sel, laterText: later.text === r.text };
      out.cases.push(c);
      console.log(`${tree}.${how} ${label.padEnd(14)} ${JSON.stringify(row)}\n   before [${r.before}]  after [${r.after}] of len ${r.text.length}  sameChars=${c.sameChars}  ${JSON.stringify(c.shownAfter)}\n   newRow ${JSON.stringify(c.newRow)}  ref ${JSON.stringify(c.ref)}  400ms later [${later.sel}] textSame=${c.laterText}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    srv.close();
  }
  L.fs.writeFileSync(L.path.join(L.O, `sync_${tree}_${how}.json`), JSON.stringify(out, null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
