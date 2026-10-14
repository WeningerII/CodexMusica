// S4: after a Library working-copy import that evicts card entries, is the
// unmigrated original kept anywhere the page can show (record.originalText)?
'use strict';
const H = require('./h');
const G = require('./gen');
(async () => {
  const env = await H.boot('cand');
  const errs = [];
  try {
    const ctx = await H.context(env);
    const page = await H.openPage(ctx, env, errs);
    const song = G.groupsSong('Lib 60', 60, 'q');
    const id = await H.importLibrary(page, song.text, 'Lib 60', H.path.join(H.OUT, 's4_lib60_wc.json'));
    const st = await H.cardState(page);
    const o = await page.evaluate(async (id) => {
      const rec = await lyLibraryStore.getDraft(id);
      const live = document.getElementById('lyrics-draft').value;
      return { hasOriginal: typeof rec.originalText === 'string', originalRow1: rec.originalText ? rec.originalText.split('\n')[1].slice(0, 70) : null, liveRow1: live.split('\n')[1].slice(0, 70), adapted: app.lyricMeta.libraryOrigin && app.lyricMeta.libraryOrigin.adapted };
    }, id);
    console.log(JSON.stringify({ listed: st.stored.items.length, more: st.stored.more, ...o, originalEqualsImported: null }));
    await ctx.close();
  } finally { await env.close(); }
  console.log('page errors:', errs.length);
})();
