// D: a reading row written by main's own lyReadingValue (unmarked, numbered
// under the earlier cut), in a working copy imported into each tree.
// Usage: node v11d.js
'use strict';
const L = require('./vlib');
const OH = 'Oh--oh, oh my love';
const DECL = [{ token_cut: 'probe', note: 'v11d probe' }];
(async () => {
  const errors = [];
  const { state, server, url, browser } = await L.start('main');
  const out = {};
  try {
    let ctx = await L.newCtx(browser);
    let page = await L.open(ctx, url, errors);
    const row = await page.evaluate(
      (line) =>
        `[SETUP — reading — ${lyReadingValue({ token: 2, word: 'oh', line, kind: 'declared', phones: ['OW1'], basis: 'declared', source: 'the singer' })}]`,
      OH
    );
    out.row = row;
    const text = [row, '', '[VERSE]', OH, 'We sing it plain tonight'].join('\n');
    const env = await L.makeEnvelope(page, text, 'V11d', DECL);
    const f = L.path.join(L.OUT, 'D_reading_in.json');
    L.fs.writeFileSync(f, JSON.stringify(env, null, 2));
    await ctx.close();
    for (const tree of ['cand', 'p678', 'main', 'base']) {
      state.root = L.TREES[tree];
      ctx = await L.newCtx(browser);
      page = await L.open(ctx, url, errors);
      await L.importFile(page, f, env.draftId);
      const s = await L.state(page);
      out[tree] = {
        adapted: s.adapted,
        label: s.label,
        changedRows: text
          .split('\n')
          .map((x, i) => [x, s.draft.split('\n')[i]])
          .filter(([a, b]) => a !== b),
      };
      L.record(`D.${tree}`, 'a main-written reading row in a working copy, imported unedited', out[tree], null);
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    L.fs.writeFileSync(L.path.join(L.OUT, 'D.json'), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
