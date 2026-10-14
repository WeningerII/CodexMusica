// verify-f4-card-1: where does the bound start to drop entries from the card
// in ONE import? For each (kind, word length) the import is repeated with N
// from LO to HI on one page; before each import the card is dismissed (the
// page's own Dismiss action), so every import starts with no earlier entries.
// Import = lyImportText(text, msg), the exact call the page's #ly-file
// handler makes for a .txt file after reading it.
// Usage: node v2_threshold.js <tree> LO HI
'use strict';
const L = require('./vlib');
const [TREE, LO, HI] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const tag = (k) => {
  let s = '';
  do {
    s = String.fromCharCode(97 + (k % 26)) + s;
    k = Math.floor(k / 26);
  } while (k > 0);
  return s;
};
function gen(N, kind, wlen) {
  // Line k: "Oh--oh, w2 w3 w4 w5 w6 tag": v1 word t (t>=2) -> v2 word t+1.
  const w = (k, t) => {
    const base = ['we', 'ride', 'the', 'long', 'road'][t - 2] || 'z' + tag(k);
    if (wlen === 'short') return base;
    return (base + 'x'.repeat(wlen)).slice(0, wlen - 4) + tag(k * 6 + t).padStart(4, 'q');
  };
  const lineOf = (k) => `Oh--oh, ${[2, 3, 4, 5, 6, 7].map((t) => w(k, t)).join(' ')}`;
  const sung = [];
  const rows = [];
  let count = 0;
  if (kind === 'reading') {
    for (let i = 0; i < N; i++) {
      sung.push(lineOf(i));
      const t = 2 + (i % 6);
      rows.push(`[SETUP — reading — token ${t} "${w(i, t)}" in "${sung[i]}" — R OW1 D — declared — source: me]`);
      count++;
    }
  } else {
    let k = 0;
    while (count < N) {
      sung.push(lineOf(k++), lineOf(k++));
      const a = sung.length - 1,
        b = sung.length;
      const parts = [];
      for (let t = 2; t <= 7 && count + 2 <= N; t++) {
        parts.push(`${a}.T${t},${b}.T${t}`);
        count += 2;
      }
      if (!parts.length) break;
      rows.push(`[SETUP — ${kind} — ${parts.join('; ')}]`);
    }
  }
  return { text: ['[SETUP — title — "T"]', ...rows, '', '[VERSE]', ...sung, ''].join('\n'), count };
}
(async () => {
  const errs = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE, rows: [] };
  try {
    const ctx = await L.ctxOf(browser);
    const page = await L.openPage(ctx, url, errs);
    for (const kind of ['reading', 'rhyme groups', 'returns'])
      for (const wlen of ['short', 40]) {
        let firstLoss = null,
          maxFull = null;
        const series = [];
        for (let N = LO; N <= HI; N += kind === 'reading' ? 1 : 2) {
          const g = gen(N, kind, wlen);
          const r = await page.evaluate(
            ([text]) => {
              LY_ACTIONS['ly-renumbered-dismiss']();
              const before = $ui('lyrics-draft').value;
              lyImportText(text, 'imported');
              const after = $ui('lyrics-draft').value;
              lyRefresh(true);
              const it = (LY.items || []).find((x) => x.id === 'renumbered');
              const rn = app.lyricMeta.ui.renumbered || { items: [], more: 0 };
              const changedRows = after.split('\n').filter((row, i) => row !== text.split('\n')[i]).length;
              return {
                items: rn.items.length,
                more: rn.more,
                title: it ? it.title : null,
                says: it ? (/and (\d+) earlier ones? no longer listed/.exec(it.text) || [])[1] || null : null,
                uiLen: JSON.stringify(app.lyricMeta.ui).length,
                changedRows,
                firstListed: rn.items[0] ? `${rn.items[0].kind}:${rn.items[0].word}:${rn.items[0].from}->${rn.items[0].to}` : null,
                draftChanged: after !== before,
              };
            },
            [g.text]
          );
          const titleN = r.title ? Number(/^(\d+)/.exec(r.title)[1]) : null;
          const row = { N: g.count, ...r, titleN, accounted: r.items + r.more === g.count && titleN === g.count };
          series.push(row);
          if (r.more > 0 && firstLoss === null) firstLoss = g.count;
          if (r.more === 0 && r.items === g.count) maxFull = g.count;
        }
        const summary = { kind, wlen, maxFullyListed: maxFull, firstNWithLoss: firstLoss, allAccounted: series.every((s) => s.accounted), series };
        out.rows.push(summary);
        console.log(JSON.stringify({ kind, wlen, maxFullyListed: maxFull, firstNWithLoss: firstLoss, allAccounted: summary.allAccounted, atFirstLoss: series.find((s) => s.N === firstLoss) || null }));
      }
    await ctx.close();
  } catch (e) {
    out.error = String(e && e.stack);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errs;
    L.fs.writeFileSync(L.path.join(L.OUT, `v2_threshold_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
