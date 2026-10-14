// sweep: every caret offset in each fixture row, the page's own lyMapOffset
// (through its own lyMigrateSavedReadings) vs the edit-structure reference.
'use strict';
const L = require('./lib.js');
const BODY = '[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe\'re sailing on\nLove above';
const ROWS = {
  RET: '[SETUP — returns — 1.T2, 2.end]',
  RHY: '[SETUP — rhyme groups — 1.T2, 2.end]',
  RET_LAST: '[SETUP — returns — 2.end, 1.T2]',
  RET_MID: '[SETUP — returns — 2.end, 1.T2, 4.end]',
  READ: '[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me]',
};
(async () => {
  const { server, base } = await L.serveTree('cand');
  const browser = await L.launch();
  const out = {};
  try {
    const { ctx, page } = await L.open(browser, base);
    for (const [k, row] of Object.entries(ROWS)) {
      const doc = `${row}\n\n${BODY}`;
      const r = await page.evaluate((doc) => {
        const after = lyMigrateSavedReadings(doc).text;
        const n = doc.split('\n')[0].length;
        const maps = [];
        for (let p = 0; p <= n + 1; p++) maps.push(lyMapOffset(doc, after, p));
        return { after, maps };
      }, doc);
      const rowAfter = r.after.split('\n')[0];
      const bad = [], amb = [];
      for (let p = 0; p < r.maps.length; p++) {
        const ref = L.refRange2(doc, r.after, p);
        const ok = r.maps[p] >= ref.lo && r.maps[p] <= ref.hi;
        if (!ok) bad.push(p);
        else if (ref.lo !== ref.hi) amb.push(p);
      }
      const runs = (xs) => xs.reduce((a, x) => (a.length && a[a.length - 1][1] === x - 1 ? (a[a.length - 1][1] = x, a) : (a.push([x, x]), a)), []).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`));
      out[k] = { row, rowAfter, wrongOffsets: runs(bad), wrongTargets: [...new Set(bad.map((p) => r.maps[p]))], ambiguousOffsets: runs(amb), wrongSpan: bad.length ? JSON.stringify(row.slice(bad[0], bad[bad.length - 1])) : '' };
      console.log(k, JSON.stringify(out[k]));
    }
    await ctx.close();
  } finally { await browser.close(); server.close(); }
  L.fs.writeFileSync(L.path.join(L.V, 'sweep_cand.json'), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
