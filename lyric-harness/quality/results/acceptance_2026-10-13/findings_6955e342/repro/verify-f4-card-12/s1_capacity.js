// S1: one import that renumbers N members (short words). Does the card list
// every one? Truth by construction (gen.js). Usage: node s1_capacity.js <tree> <txt|lib> N...
'use strict';
const H = require('./h');
const G = require('./gen');
const tree = process.argv[2];
const route = process.argv[3];
const Ns = process.argv.slice(4).map(Number);
(async () => {
  const env = await H.boot(tree);
  const errs = [];
  const runs = [];
  try {
    for (const N of Ns) {
      const ctx = await H.context(env);
      const page = await H.openPage(ctx, env, errs);
      const song = G.groupsSong(`Cap ${N}`, N);
      H.fs.writeFileSync(H.path.join(H.OUT, `s1_song_${N}.txt`), song.text);
      if (route === 'lib') await H.importLibrary(page, song.text, `Cap ${N}`, H.path.join(H.OUT, `s1_${tree}_${N}_wc.json`));
      else await H.importTxt(page, `cap-${N}.txt`, song.text);
      const after = await H.draft(page);
      const st = await H.cardState(page);
      const t = await H.toasts(page);
      const items = st.stored ? st.stored.items : [];
      const key = (m) => `${m.kind}|${m.word}|${(m.n || []).join(',')}|${m.from}|${m.to}`;
      const have = new Set(items.map(key));
      const lost = song.truth.filter((m) => !have.has(key(m)));
      const listedIdx = song.truth.map((m, i) => (have.has(key(m)) ? i : -1)).filter((i) => i >= 0);
      // Is a lost entry visible anywhere: pane text, the toast log, the draft?
      const visible = lost.map((m) => ({ word: m.word, inPane: st.pane.includes(`“${m.word}”`), inToast: t.some((x) => x.includes(`“${m.word}” word ${m.from} → ${m.to}`)) }));
      const rowAfter = after.split('\n')[1];
      await H.reload(page);
      const st2 = await H.cardState(page);
      const run = {
        N, truth: song.truth.length, rowRewritten: /— cut v2\]$/.test(rowAfter),
        listed: items.length, more: st.stored ? st.stored.more : null, title: st.title,
        firstListed: listedIdx[0], lastListed: listedIdx[listedIdx.length - 1],
        lostCount: lost.length, lostFirst: lost.slice(0, 3).map((m) => m.word), lostLast: lost.slice(-2).map((m) => m.word),
        lostVisibleAnywhere: visible.filter((v) => v.inPane || v.inToast).map((v) => v.word),
        lostNotVisible: visible.filter((v) => !v.inPane && !v.inToast).length,
        toasts: t, uiLen: st.uiLen, storedLen: JSON.stringify(st.stored || {}).length,
        paneSaysMore: (/and (\d+) earlier ones? no longer listed/.exec(st.pane) || [])[1] || null,
        afterReload: { listed: st2.stored ? st2.stored.items.length : 0, more: st2.stored ? st2.stored.more : null, same: JSON.stringify(st2.stored) === JSON.stringify(st.stored) },
      };
      runs.push(run);
      console.log(JSON.stringify({ ...run, toasts: run.toasts.map((x) => x.slice(0, 260)) }));
      await ctx.close();
    }
  } finally {
    await env.close();
  }
  H.fs.writeFileSync(H.path.join(H.OUT, `s1_${tree}_${route}.json`), JSON.stringify({ tree, route, runs, errs }, null, 1));
  console.log('page errors:', errs.length, errs.slice(0, 3));
})();
