// Extra: (i) cross-import eviction: .txt A near capacity, then .txt B;
// (ii) a Library working copy whose rows migrate: is it marked Adapted on
// import, with no edit by the person? Usage: node e_extra.js <cand|main>
'use strict';
const L = require('./lib');
const TREE = process.argv[2] || 'cand';
const az = (k) => {
  let s = '';
  do {
    s = String.fromCharCode(97 + (k % 26)) + s;
    k = Math.floor(k / 26);
  } while (k > 0);
  return s;
};
// n group members on Ah-lines (each pair: T2..T7 for both lines).
function groupsSong(title, n, prefix) {
  const sung = [];
  const groups = [];
  let w = 0,
    count = 0;
  while (count < n) {
    sung.push(`Ah--ah, ah my heart and soul ${prefix}${az(w++)}`);
    sung.push(`Ah--ah, ah my heart and soul ${prefix}${az(w++)}`);
    const a = sung.length - 1,
      b = sung.length;
    const parts = [];
    for (let t = 2; t <= 7 && count < n; t++) {
      parts.push(`${a}.T${t},${b}.T${t}`);
      count += 2;
    }
    groups.push(`[SETUP — rhyme groups — ${parts.join(';')}]`);
  }
  return [`[SETUP — title — "${title}"]`, ...groups, '', '[VERSE]', ...sung].join('\n');
}
(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE };
  try {
    if (TREE === 'cand') {
      const ctx = await L.newCtx(browser);
      const page = await L.open(ctx, url, errors);
      const A = groupsSong('Song A', 40, 'qa');
      const B = groupsSong('Song B', 12, 'qb');
      await L.importTxt(page, 'a.txt', A, 'Song A');
      const tA = L.truthFromRows(A, await L.draftOf(page));
      const cA = await L.card(page);
      await L.importTxt(page, 'b.txt', B, 'Song B');
      const tB = L.truthFromRows(B, await L.draftOf(page));
      const cB = await L.card(page);
      const items = cB.meta.items;
      const keyOf = (m) => `${m.kind}|${m.n[0]}|${m.from}|${m.to}`;
      const listedB = tB.filter((t) => items.some((m) => m.word === t.word && keyOf(m) === keyOf(t))).length;
      const listedA = tA.filter((t) => items.some((m) => m.word === t.word && keyOf(m) === keyOf(t))).length;
      out.crossEvict = {
        truthA: tA.length,
        afterA: { items: cA.meta.items.length, more: cA.meta.more },
        truthB: tB.length,
        afterB: { items: items.length, more: cB.meta.more, title: cB.item.title, listedA, listedB, tail: cB.item.text.slice(-200) },
      };
      console.log(JSON.stringify(out.crossEvict, null, 1));
      L.record(
        `${TREE}.e.crossEvict`,
        'A then B beyond the bound: entries of A beyond the room are counted, not silently lost',
        'title = A+B; items + hidden = A+B (listedA/listedB are ambiguous for repeated words, informational)',
        { title: cB.item.title, more: cB.meta.more, listedA, listedB },
        Number(/^\d+/.exec(cB.item.title)[0]) === tA.length + tB.length && items.length + cB.meta.more === tA.length + tB.length && /and 1 earlier one no longer listed/.test(cB.item.text) === (cB.meta.more === 1)
      );
      await ctx.close();
    }
    // (ii) Adapted on import.
    const OH = 'Oh--oh, oh my love';
    const MIG = ['[SETUP — title — "Wc"]', '[SETUP — returns — 1.T3,2.T3]', '', '[VERSE]', OH, OH].join('\n');
    const QUIET = ['[SETUP — title — "Wq"]', '[SETUP — rhyme groups — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
    out.adapted = {};
    for (const [name, text] of [
      ['migrating', MIG],
      ['quiet', QUIET],
    ]) {
      const ctx = await L.newCtx(browser);
      const page = await L.open(ctx, url, errors);
      const env = await L.makeEnvelope(page, text, 'Wc ' + name);
      await L.importLibrary(page, env, L.path.join(L.OUT, `e_${TREE}_${name}_wc.json`));
      await L.settle(page, 1500);
      const st = await page.evaluate(() => ({
        adapted: app.lyricMeta.libraryOrigin && app.lyricMeta.libraryOrigin.adapted,
        label: (document.querySelector('[aria-label="Library source"]') || {}).innerText || null,
        changed: $ui('lyrics-draft').value !== (lyLibraryRecord && lyLibraryRecord.originalText),
      }));
      out.adapted[name] = st;
      console.log(name, JSON.stringify(st));
      L.record(
        `${TREE}.e.adapted.${name}`,
        `a Library working copy (${name}) is not marked Adapted by the import alone`,
        'adapted false',
        st,
        st.adapted === false
      );
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, `e_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
