// verify-f4-card-1 side check (not claim b1 itself): a card left by a .txt
// import (10 entries, not dismissed), then a Library working-copy import that
// renumbers 0 or 4 more. Does the card keep the first 10 (listed or counted)?
// Usage: node v4_cross.js <tree>
'use strict';
const L = require('./vlib');
const TREE = process.argv[2] || 'cand';
const envOf = (page, text) =>
  page.evaluate(
    async ([t]) =>
      CMLibraryImport.makeWorkingCopyEnvelope(t, {
        version: 1, brief: '', notes: {}, drafts: {}, ui: {},
        libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title: 'X', language: 'eng', scope: 'whole', provenance: { snapshotId: 's', unitId: 'u', workId: 'w', editionId: 'e', revisionId: 'r' }, lineage: [], declarations: [] },
      }),
    [text]
  );
(async () => {
  const errs = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE, cases: [] };
  try {
    const ten = L.fs.readFileSync(L.path.join(L.OUT, 'gen_mixed_10.txt'), 'utf8');
    const second = {
      zero: '[SETUP — title — "Plain"]\n\n[VERSE]\nA plain line here\nAnother plain line\n',
      four: '[SETUP — title — "Four"]\n[SETUP — rhyme groups — 1.T3,2.T3; 1.T4,2.T4]\n\n[VERSE]\nOh--oh, my sweet dear\nOh--oh, my sweet near\n',
    };
    for (const [name, text] of Object.entries(second)) {
      const ctx = await L.ctxOf(browser);
      const page = await L.openPage(ctx, url, errs);
      await L.importFile(page, 'ten.txt', 'text/plain', ten);
      const c1 = await L.cardOf(page);
      const env = await envOf(page, text);
      await L.importFile(page, 'wc.json', 'application/json', JSON.stringify(env), null);
      await page.waitForFunction((id) => app.lyricMeta && app.lyricMeta.draftId === id, env.draftId, { timeout: 30000 });
      await page.waitForTimeout(1200);
      const c2 = await L.cardOf(page);
      const row = { second: name, afterTxt: c1.item && c1.item.title, afterLibrary: c2.item ? c2.item.title : null, afterLibraryStored: c2.renumbered, toasts: await L.toasts(page) };
      out.cases.push(row);
      console.log(JSON.stringify(row));
      await ctx.close();
    }
  } catch (e) {
    out.error = String(e && e.stack);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errs;
    L.fs.writeFileSync(L.path.join(L.OUT, `v4_cross_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
