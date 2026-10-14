// Control for C7 (Undo across a Library import overwrites the preserved
// draft's display state). The same mechanism with a display-state key the
// page does not own (`probe`), on main and on the candidate.
// Usage: node c7_control.js <main|cand>
'use strict';
const L = require('./lib');
const TREE = process.argv[2] || 'main';
const A = ['[SETUP — title — "Song A"]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
const B = ['[SETUP — title — "Song B"]', '', '[VERSE]', 'the river runs so slow', 'the evening lights go low'].join('\n');
const idbUi = (page) =>
  page.evaluate(async () => {
    const out = [];
    for (const d of await lyLibraryStore.listDrafts()) {
      const full = await lyLibraryStore.getDraft(d.draftId);
      out.push({ draftId: d.draftId, head: full.text.slice(0, 26), ui: full.meta && full.meta.ui });
    }
    return out;
  });
(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE, steps: [] };
  try {
    const ctx = await L.newCtx(browser);
    const page = await L.open(ctx, url, errors);
    await L.importTxt(page, 'a.txt', A, 'Song A');
    await page.evaluate(() => {
      lyMeta().ui.probe = 'A-evidence';
      uiAutosave();
    });
    await L.settle(page, 800);
    const env = await L.makeEnvelope(page, B, 'Song B');
    await L.importLibrary(page, env, L.path.join(L.OUT, `c7_${TREE}_envB.json`));
    const s1 = { tag: 'after Library B', ui: await page.evaluate(() => app.lyricMeta.ui), idb: await idbUi(page) };
    out.steps.push(s1);
    console.log(JSON.stringify(s1));
    await page.evaluate(() => $ui('btn-undo').click());
    await L.settle(page, 2000);
    const s2 = {
      tag: 'after Undo',
      head: (await L.draftOf(page)).slice(0, 26),
      draftId: await page.evaluate(() => app.lyricMeta.draftId || null),
      ui: await page.evaluate(() => app.lyricMeta.ui),
      idb: await idbUi(page),
    };
    out.steps.push(s2);
    console.log(JSON.stringify(s2));
    const recA = s2.idb.find((d) => d.draftId === s2.draftId);
    L.record(
      `${TREE}.c7ctl.probe`,
      "Undo across a Library import: A's preserved draft keeps its own display state",
      "IDB record A keeps ui.probe = 'A-evidence'",
      { current: s2.ui, recordA: recA && recA.ui },
      !!(recA && recA.ui && recA.ui.probe === 'A-evidence')
    );
    await ctx.close();
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, `c7_control_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
