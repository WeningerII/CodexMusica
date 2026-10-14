// (c)/(d): where the writer's caret / selection lands when a boundary
// migrates an unmarked row while the editor holds it. Each row is saved
// unmarked (as a pre-release draft holds it, or as typed/pasted since the
// last boundary), the selection is put on/inside an UNCHANGED member, a
// CHANGED member, after the row, or on sung text; then a send boundary runs:
//   click   : a real mouse click on the visible Run review button
//   prog    : LY_ACTIONS['ly-run-review']() with the editor still focused
//   chat    : a typed lyrics-edit request (_chatSend -> uiLyricContext)
// Recorded: the text before/after, the selection before/after (offsets and
// the characters it covers), a member-aware reference of "the same
// characters" (refmap.js, independent of the page's lyMapOffset), where two
// keys typed next land, and how the page parses the result.
// Usage: node c_selection.js <cand|main> [trigger,...]
'use strict';
const L = require('./f1lib.js');
const R = require('./refmap.js');
const TREE = process.argv[2] || 'cand';
const TRIGGERS = (process.argv[3] || 'click,prog,chat').split(',');

const BODY = `[VERSE]
Oh--oh, oh my love
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh

[CHORUS]
We're sailing on
Love above`;
// A selection: [anchor substring in the ROW (or 'BODY:' in the body), offset
// of start within it, length] (+ 'backward').
const ROWS = {
  // 3PO's case: line 1's cut differs (T2 -> T3), line 2 unchanged.
  RET: {
    row: '[SETUP — returns — 1.T2, 2.end]',
    sels: {
      U_in_2end: ['2.end', 2, 0], // caret 2.|end
      U_sel_2end: ['2.end', 0, 5],
      U_sel_2end_back: ['2.end', 0, 5, 'backward'],
      C_in_T2: ['1.T2', 3, 0], // caret 1.T|2
      C_after_T2: ['1.T2', 4, 0], // caret 1.T2|
      C_sel_T2: ['1.T2', 0, 4],
      E_before_close: [']', 0, 0],
      E_after_row: [']', 1, 0],
      S_body_walk: ['BODY:walk', 1, 0],
      X_row_to_body: ['2.end', 0, -1], // from 2.end through "Oh--oh"
    },
  },
  RHY: {
    row: '[SETUP — rhyme groups — 1.T2, 2.end]',
    sels: {
      U_in_2end: ['2.end', 2, 0],
      U_sel_2end: ['2.end', 0, 5],
      C_in_T2: ['1.T2', 3, 0],
      C_sel_T2: ['1.T2', 0, 4],
      E_after_row: [']', 1, 0],
    },
  },
  // The bare member "2" is the row's last character before "]", as is the
  // "2" of the added "cut v2".
  RHY_BARE: {
    row: '[SETUP — rhyme groups — 1.T2,2]',
    sels: {
      U_before_2: [',2]', 1, 0], // caret 1.T2,|2
      U_sel_2: [',2]', 1, 1],
      U_after_2: [',2]', 2, 0], // caret ,2|]
      E_after_row: [']', 1, 0],
    },
  },
  // Several unchanged members around one changed one.
  MANY: {
    row: '[SETUP — rhyme groups — 2.end,4; 1.T2,3.T2; 5.end, 6]',
    sels: {
      U_in_2end: ['2.end', 2, 0],
      U_sel_4: [',4;', 1, 1],
      U_sel_3T2: ['3.T2', 0, 4],
      U_in_5end: ['5.end', 1, 0],
      U_sel_6: [' 6]', 1, 1],
      C_sel_1T2: ['1.T2', 0, 4],
      E_after_row: [']', 1, 0],
    },
  },
  // The changed member last; unchanged ones before it.
  MANY_LAST: {
    row: '[SETUP — returns — 2.end, 4.end; 5.end,6.end; 1.T2,4.T2]',
    sels: {
      U_in_2end: ['2.end', 3, 0],
      U_sel_6end: ['6.end', 0, 5],
      U_sel_4T2: ['4.T2]', 0, 4],
      C_in_1T2: ['1.T2', 2, 0],
    },
  },
  // A named place on the changed line: carried, the row grows mid-way.
  CARRIED: {
    row: '[SETUP — returns — 1.end, 2.end]',
    sels: {
      U_in_2end: ['2.end', 2, 0],
      U_sel_2end: ['2.end', 0, 5],
      C_in_1end: ['1.end', 2, 0],
    },
  },
  // Two rows: the first is rewritten, the second (unchanged lines only)
  // keeps every byte; the selection sits in the second.
  TWO_ROWS: {
    row: '[SETUP — returns — 1.T2, 2.end]\n[SETUP — rhyme groups — 5.end, 6]',
    sels: {
      U_other_in_5end: ['5.end', 1, 0],
      U_other_sel_6: [' 6]', 1, 1],
      U_first_in_2end: ['2.end', 2, 0],
    },
  },
  // A reading row: number and mark change, its tail is unchanged.
  READ: {
    row: '[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me]',
    sels: {
      U_sel_OW1: ['OW1', 0, 3],
      U_in_source: ['source: me', 3, 0],
      U_sel_me: ['source: me', 8, 2],
      C_sel_num: ['token 2', 6, 1],
      E_after_row: [']', 1, 0],
    },
  },
};
// Rows at the top (as the page writes them) by default; one row also at the
// bottom (as caret2.js typed it).
const PLACEMENTS = { RET: ['top', 'bottom'] };

function docOf(row, where) {
  return where === 'bottom' ? `${BODY}\n\n${row}` : `${row}\n\n${BODY}`;
}
function selOf(doc, row, spec) {
  const [anchor, off, len, dir] = spec;
  const rowAt = doc.indexOf(row);
  let base;
  if (anchor.startsWith('BODY:')) base = doc.indexOf(anchor.slice(5), doc.indexOf('[VERSE]'));
  else {
    const k = anchor === ']' ? row.length - 1 : row.indexOf(anchor);
    if (k < 0) throw Error(`anchor ${anchor} not in ${row}`);
    base = rowAt + k;
  }
  const s = base + off;
  const e = len === -1 ? doc.indexOf('Oh--oh') + 6 : s + len;
  return [s, e, dir || 'forward'];
}

(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const out = { tree: TREE, root: L.TREES[TREE], cases: [] };
  try {
    for (const trig of TRIGGERS)
      for (const [rk, rc] of Object.entries(ROWS).filter(([k]) => !process.env.ROWS || process.env.ROWS.split(',').includes(k)))
        for (const where of PLACEMENTS[rk] || ['top']) {
          const { ctx, page, q, errors } = await L.boot(browser, base);
          const doc = docOf(rc.row, where);
          for (const [sk, spec] of Object.entries(rc.sels)) {
            const id = `${TREE}.${trig}.${rk}.${where}.${sk}`;
            const c = { id, trig, row: rc.row, where, sel: sk };
            try {
              await page.evaluate(() => {
                if (typeof _chatReset === 'function') _chatReset();
                LY.run = null;
                LY.conflict = null;
                LY.gate = null;
              });
              await L.setDraft(page, doc);
              await page.waitForTimeout(250);
              const [s, e, dir] = selOf(doc, rc.row, spec);
              await page.evaluate(([s, e, dir]) => {
                const d = $ui('lyrics-draft');
                d.focus();
                d.setSelectionRange(s, e, dir);
              }, [s, e, dir]);
              await page.waitForTimeout(200);
              const pre = await L.state(page);
              c.before = { text: pre.text, sel: pre.sel, shown: R.show(pre.text, pre.sel[0], pre.sel[1]), selected: pre.text.slice(pre.sel[0], pre.sel[1]), unchangedByRefresh: pre.text === doc };
              await L.toasts(page);
              const nCalls = q.calls.length;
              if (trig === 'click') {
                const btn = page.locator('[data-ui="ly-run-review"]:visible').first();
                c.button = await btn.evaluate((b) => b.outerHTML.slice(0, 160)).catch((x) => 'none: ' + x);
                await btn.click();
              } else if (trig === 'prog') {
                await page.evaluate(() => {
                  LY_ACTIONS['ly-run-review']();
                });
              } else if (trig === 'chat') {
                await page.evaluate(() => {
                  _chatSend('Tighten line 2', { choice: 'lyrics-edit' });
                });
              }
              await L.waitIdle(page);
              const post = await L.state(page);
              c.after = { text: post.text, sel: post.sel, focused: post.focused, shown: R.show(post.text, post.sel[0], post.sel[1]), selected: post.text.slice(post.sel[0], post.sel[1]) };
              c.toasts = await L.toasts(page);
              c.sent = q.calls.slice(nCalls).map((x) => x.lyric_context?.declarations ?? null);
              c.migrated = post.text !== pre.text;
              // The member-aware reference: where the same characters are.
              const ref = c.migrated ? [R.refMap(pre.text, post.text, pre.sel[0]), R.refMap(pre.text, post.text, pre.sel[1])] : [{ lo: pre.sel[0], hi: pre.sel[0] }, { lo: pre.sel[1], hi: pre.sel[1] }];
              c.ref = ref;
              c.pagePredicted = c.migrated ? [R.lyMapOffset(pre.text, post.text, pre.sel[0]), R.lyMapOffset(pre.text, post.text, pre.sel[1])] : null;
              const inRange = (v, r) => r && v >= r.lo && v <= r.hi;
              c.sameChars = inRange(post.sel[0], ref[0]) && inRange(post.sel[1], ref[1]) && (pre.sel[2] === 'none' || post.sel[2] === pre.sel[2]);
              c.expectedShown = ref[0] && ref[1] ? R.show(post.text, ref[0].lo, ref[1].hi) : null;
              c.collapsed = pre.sel[0] !== pre.sel[1] && post.sel[0] === post.sel[1];
              // The writer returns to the editor and types two keys.
              await page.evaluate(() => $ui('lyrics-draft').focus());
              const refocus = await L.state(page);
              c.afterRefocusSel = refocus.sel;
              await page.keyboard.type('ZQ', { delay: 30 });
              await page.waitForTimeout(400);
              const typed = await L.state(page);
              const z = typed.text.indexOf('ZQ');
              c.typed = { at: z, line: typed.text.slice(0, z).split('\n').length, rowNow: typed.text.split('\n')[typed.text.slice(0, z).split('\n').length - 1] };
              c.parsed = await L.parseAsPage(page, typed.text);
              c.parsedBefore = await L.parseAsPage(page, post.text);
              c.errors = errors.splice(0);
            } catch (x) {
              c.threw = String(x.stack || x);
            }
            out.cases.push(c);
            console.log(
              `${id}: migrated=${c.migrated} sameChars=${c.sameChars}${c.collapsed ? ' COLLAPSED' : ''}\n` +
                `    before ${JSON.stringify(c.before?.sel)} ${JSON.stringify(c.before?.shown)}\n` +
                `    after  ${JSON.stringify(c.after?.sel)} ${JSON.stringify(c.after?.shown)} focused=${c.after?.focused}\n` +
                `    ref    ${JSON.stringify(c.ref)} ${JSON.stringify(c.expectedShown)}\n` +
                `    typed ZQ -> line ${c.typed?.line}: ${JSON.stringify(c.typed?.rowNow)}; sent=${JSON.stringify(c.sent)}${c.threw ? '\n    THREW ' + c.threw : ''}`
            );
          }
          await ctx.close();
        }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `c_selection_${TREE}_${TRIGGERS.join('-')}${process.env.ROWS ? '_' + process.env.ROWS : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
