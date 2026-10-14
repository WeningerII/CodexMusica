// Re-derive the c4 "Overall, 5 of 24 unchanged-member positions and 5 of 12
// changed-member positions" tally with THIS folder's reference (ref4.js),
// on the exact rows and selection specs of h695/f1-selection/c_selection.js
// (transcribed below), using the candidate page's own lyMigrateSavedReadings
// + lyMapOffset (pure; the e2e runs show the real boundary equals them).
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
const ROWS = {
  RET: { kind: 'returns', row: '[SETUP — returns — 1.T2, 2.end]', where: ['top', 'bottom'], sels: { U_in_2end: ['2.end', 2, 0], U_sel_2end: ['2.end', 0, 5], U_sel_2end_back: ['2.end', 0, 5], C_in_T2: ['1.T2', 3, 0], C_after_T2: ['1.T2', 4, 0], C_sel_T2: ['1.T2', 0, 4] } },
  RHY: { kind: 'rhyme groups', row: '[SETUP — rhyme groups — 1.T2, 2.end]', sels: { U_in_2end: ['2.end', 2, 0], U_sel_2end: ['2.end', 0, 5], C_in_T2: ['1.T2', 3, 0], C_sel_T2: ['1.T2', 0, 4] } },
  RHY_BARE: { kind: 'rhyme groups', row: '[SETUP — rhyme groups — 1.T2,2]', sels: { U_before_2: [',2]', 1, 0], U_sel_2: [',2]', 1, 1], U_after_2: [',2]', 2, 0] } },
  MANY: { kind: 'rhyme groups', row: '[SETUP — rhyme groups — 2.end,4; 1.T2,3.T2; 5.end, 6]', sels: { U_in_2end: ['2.end', 2, 0], U_sel_4: [',4;', 1, 1], U_sel_3T2: ['3.T2', 0, 4], U_in_5end: ['5.end', 1, 0], U_sel_6: [' 6]', 1, 1], C_sel_1T2: ['1.T2', 0, 4] } },
  MANY_LAST: { kind: 'returns', row: '[SETUP — returns — 2.end, 4.end; 5.end,6.end; 1.T2,4.T2]', sels: { U_in_2end: ['2.end', 3, 0], U_sel_6end: ['6.end', 0, 5], U_sel_4T2: ['4.T2]', 0, 4], C_in_1T2: ['1.T2', 2, 0] } },
  CARRIED: { kind: 'returns', row: '[SETUP — returns — 1.end, 2.end]', sels: { U_in_2end: ['2.end', 2, 0], U_sel_2end: ['2.end', 0, 5], C_in_1end: ['1.end', 2, 0] } },
  READ: { kind: 'reading', row: '[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me]', sels: { U_sel_OW1: ['OW1', 0, 3], U_in_source: ['source: me', 3, 0], U_sel_me: ['source: me', 8, 2], C_sel_num: ['token 2', 6, 1] } },
};
(async () => {
  const { srv, base } = await L.serve('cand');
  const browser = await L.launch();
  const out = { cases: [], tally: {} };
  try {
    const { page, ctx } = await L.open(browser, base);
    for (const [rk, rc] of Object.entries(ROWS))
      for (const where of rc.where || ['top']) {
        const doc = where === 'bottom' ? `${BODY}\n\n${rc.row}` : `${rc.row}\n\n${BODY}`;
        const rowAt = doc.indexOf(rc.row);
        const migrated = await page.evaluate((d) => lyMigrateSavedReadings(d).text, doc);
        const newRow = migrated.split('\n')[where === 'bottom' ? doc.split('\n').length - 1 : 0];
        let p = 0;
        while (p < rc.row.length && rc.row[p] === newRow[p]) p++;
        for (const [sk, [anchor, off, len]] of Object.entries(rc.sels)) {
          const s = rowAt + rc.row.indexOf(anchor) + off, e = s + len;
          const pg = await page.evaluate(([d, m, s, e]) => [lyMapOffset(d, m, s), lyMapOffset(d, m, e)], [doc, migrated, s, e]);
          const ra = R.docRange(doc, migrated, s), rb = R.docRange(doc, migrated, e);
          const ok = pg[0] >= ra.lo && pg[0] <= ra.hi && pg[1] >= rb.lo && pg[1] <= rb.hi;
          const cat = sk.split('_')[0];
          const c = { id: `${rk}.${where}.${sk}`, kind: rc.kind, cat, before: [s, e], page: pg, ref: [[ra.lo, ra.hi], [rb.lo, rb.hi]], ok, startColInRow: s - rowAt, endColInRow: e - rowAt, firstChangedCol: p, endsBeforeFirstChange: e - rowAt <= p };
          out.cases.push(c);
          const t = (out.tally[cat] = out.tally[cat] || { n: 0, ok: 0, okIds: [], byKind: {} });
          t.n++;
          (t.byKind[rc.kind] = t.byKind[rc.kind] || { n: 0, ok: 0 }).n++;
          if (ok) {
            t.ok++;
            t.okIds.push(`${c.id}${c.endsBeforeFirstChange ? '' : ' (NOT before the first changed char: cols ' + c.startColInRow + '-' + c.endColInRow + ', first change at ' + p + ')'}`);
            t.byKind[rc.kind].ok++;
          }
          console.log(`${ok ? 'OK  ' : 'FAIL'} ${c.id.padEnd(28)} [${s},${e}] -> [${pg}] ref ${JSON.stringify(c.ref)}  ${R.show(migrated, pg[0], pg[1])}`);
        }
      }
    await ctx.close();
  } finally {
    await browser.close();
    srv.close();
  }
  console.log(JSON.stringify(out.tally, null, 1));
  L.fs.writeFileSync(L.path.join(L.O, 'tally_cand.json'), JSON.stringify(out, null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
