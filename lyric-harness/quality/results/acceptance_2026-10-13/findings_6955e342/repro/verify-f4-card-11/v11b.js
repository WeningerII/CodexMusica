// B: the realistic origin of an unmarked row in a Library working copy.
// On main (the deployed page) a person opens a Library working copy with no
// [SETUP] rows and non-empty declarations, TYPES a returns row (main writes
// it unmarked), and downloads "text and sources" (file M). M is then
// imported, unedited, into each tree.
// C: the upgrade path on one origin: M is imported on main, then the same
// origin is served from the candidate and reloaded.
// Usage: node v11b.js
'use strict';
const L = require('./vlib');
const OH = 'Oh--oh, oh my love';
const DECL = [{ token_cut: 'probe', pronunciations: [{ token: 2, word: 'oh', phones: ['OW1'] }], note: 'v11b probe' }];
const FRESH = ['[VERSE]', OH, OH].join('\n');
const ROW = '[SETUP — returns — 1.T3,2.T3]';
(async () => {
  const errors = [];
  const { state, server, url, browser } = await L.start('main');
  const out = { B: {}, C: {} };
  try {
    // B1-B3 on main.
    let ctx = await L.newCtx(browser);
    let page = await L.open(ctx, url, errors);
    const env = await L.makeEnvelope(page, FRESH, 'V11b', DECL);
    const fIn = L.path.join(L.OUT, 'B_main_fresh_in.json');
    L.fs.writeFileSync(fIn, JSON.stringify(env, null, 2));
    await L.importFile(page, fIn, env.draftId);
    const s0 = await L.state(page);
    out.B.mainAfterImport = { adapted: s0.adapted, label: s0.label };
    L.record('B.main.import', 'main: fresh working copy imported', out.B.mainAfterImport, null);
    // The person types the row at the top of the draft.
    await page.click('#lyrics-draft');
    await page.keyboard.press('Control+Home');
    await page.keyboard.type(ROW);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    const s1 = await L.state(page);
    out.B.mainAfterEdit = { adapted: s1.adapted, label: s1.label, firstRow: s1.draft.split('\n')[0] };
    L.record('B.main.edit', 'main: after typing the returns row', out.B.mainAfterEdit, null);
    const fM = L.path.join(L.OUT, 'B_M_main_download.json');
    const M = await L.download(page, fM);
    out.B.M = {
      text: M.payload.text,
      payloadDeclarations: M.payload.declarations,
      wcAdapted: M.payload.provenance.workingCopy.adapted,
      wcDeclarations: M.payload.provenance.workingCopy.declarations,
    };
    L.record('B.M', 'main download M (the realistic working copy holding an unmarked row)', out.B.M, null);
    await ctx.close();
    // B4: M imported unedited into each tree (same origin, fresh profile).
    for (const tree of ['cand', 'p61b', 'main', 'base']) {
      state.root = L.TREES[tree];
      ctx = await L.newCtx(browser);
      page = await L.open(ctx, url, errors);
      await L.importFile(page, fM, M.draftId);
      const s = await L.state(page);
      const r = (out.B[tree] = {
        adapted: s.adapted,
        label: s.label,
        changedRows: M.payload.text
          .split('\n')
          .map((x, i) => [x, s.draft.split('\n')[i]])
          .filter(([a, b]) => a !== b),
      });
      const d = await L.download(page, L.path.join(L.OUT, `B_${tree}_redownload.json`));
      r.redownload = {
        payloadDeclarations: d.payload.declarations,
        wcAdapted: d.payload.provenance.workingCopy.adapted,
        wcDeclarations: d.payload.provenance.workingCopy.declarations,
      };
      L.record(`B.${tree}`, `M imported unedited into ${tree}, then downloaded`, r, null);
      await ctx.close();
    }
    // C: upgrade on one origin.
    state.root = L.TREES.main;
    ctx = await L.newCtx(browser);
    page = await L.open(ctx, url, errors);
    await L.importFile(page, fM, M.draftId);
    const c0 = await L.state(page);
    out.C.main = { adapted: c0.adapted, label: c0.label };
    L.record('C.main', 'main: M imported', out.C.main, null);
    state.root = L.TREES.cand;
    await page.reload();
    await L.waitReady(page);
    await page.waitForTimeout(2000);
    const c1 = await L.state(page);
    out.C.candReload = {
      adapted: c1.adapted,
      storedAdapted: c1.storedAdapted,
      label: c1.label,
      firstRow: c1.draft.split('\n')[0],
      originalFirstRow: c1.original && c1.original.split('\n')[0],
      renumberedCard: c1.renumberedCard,
    };
    L.record('C.cand', 'the same origin reloaded on the candidate (no edit)', out.C.candReload, null);
    const isCand = await page.evaluate(() => typeof lyEnsureTokenScheme === 'function' && typeof lyRecordRenumbered === 'function');
    out.C.servedCandidate = isCand;
    await ctx.close();
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, 'B_C.json'), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
