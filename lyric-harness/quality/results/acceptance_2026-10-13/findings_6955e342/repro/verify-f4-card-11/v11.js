// A: a Library working copy (envelope made by the served page's own
// makeWorkingCopyEnvelope, origin not adapted, NON-EMPTY declarations) is
// imported through #ly-file. Is it marked Adapted with no edit? Does that
// survive a reload? What does the next "Download text and sources" carry, and
// what does re-importing that file hold?   Usage: node v11.js <tree>
'use strict';
const L = require('./vlib');
const TREE = process.argv[2];
const OH = 'Oh--oh, oh my love';
const DECL = [{ token_cut: 'probe', pronunciations: [{ token: 2, word: 'oh', phones: ['OW1'] }], note: 'v11 probe' }];
const CASES = {
  // the tester's case: an unmarked returns row whose T3 moves under the new cut
  mig_returns: ['[SETUP — title — "Wc"]', '[SETUP — returns — 1.T3,2.T3]', '', '[VERSE]', OH, OH].join('\n'),
  // an unmarked returns row with a named place on a line whose cut changed
  carried_end: ['[SETUP — title — "Wc"]', '[SETUP — returns — 1.end,2.end]', '', '[VERSE]', OH, OH].join('\n'),
  // an unmarked returns row on lines whose cut did not change (row keeps bytes)
  quiet_same: ['[SETUP — title — "Wq"]', '[SETUP — returns — 1.T2,2.T2]', '', '[VERSE]', 'we sing it plain tonight', 'we sing it plain tonight'].join('\n'),
  // the tester's quiet control
  quiet_groups: ['[SETUP — title — "Wq"]', '[SETUP — rhyme groups — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n'),
  // no [SETUP] rows, CRLF line ends (a non-edit change the textarea itself makes)
  crlf_plain: ['Oh my love we sing', 'We bring it home tonight'].join('\r\n'),
};
(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE, cases: {} };
  try {
    for (const [name, text] of Object.entries(CASES)) {
      const c = (out.cases[name] = {});
      const ctx = await L.newCtx(browser);
      let page = await L.open(ctx, url, errors);
      let env;
      try {
        env = await L.makeEnvelope(page, text, 'V11 ' + name, DECL);
      } catch (e) {
        c.envelopeError = String(e.message || e);
        console.log(name, 'envelope error', c.envelopeError);
        await ctx.close();
        continue;
      }
      const f = L.path.join(L.OUT, `A_${TREE}_${name}_in.json`);
      L.fs.writeFileSync(f, JSON.stringify(env, null, 2));
      await L.importFile(page, f, env.draftId);
      const s1 = await L.state(page);
      c.afterImport = {
        adapted: s1.adapted,
        label: s1.label,
        draftEqualsPayload: s1.draft === env.payload.text,
        originalEqualsPayload: s1.original === env.payload.text,
        changedRows: env.payload.text
          .split('\n')
          .map((r, i) => [r, s1.draft.split('\n')[i]])
          .filter(([a, b]) => a !== b),
        declarationsKept: JSON.stringify(s1.declarations) === JSON.stringify(DECL),
        renumberedCard: s1.renumberedCard,
      };
      L.record(
        `${TREE}.A.${name}.import`,
        'state right after import (no edit)',
        c.afterImport,
        null
      );
      // Reload: is the mark persisted?
      await page.reload();
      await L.waitReady(page);
      await page.waitForTimeout(1500);
      const s2 = await L.state(page);
      c.afterReload = { adapted: s2.adapted, storedAdapted: s2.storedAdapted, label: s2.label, draftUnchanged: s2.draft === s1.draft };
      L.record(`${TREE}.A.${name}.reload`, 'state after a reload', c.afterReload, null);
      // The page's own working-copy download.
      const d = await L.download(page, L.path.join(L.OUT, `A_${TREE}_${name}_dl.json`));
      c.download = {
        payloadDeclarations: d.payload.declarations,
        wcAdapted: d.payload.provenance.workingCopy && d.payload.provenance.workingCopy.adapted,
        wcDeclarations: d.payload.provenance.workingCopy && d.payload.provenance.workingCopy.declarations,
        textEqualsDraft: d.payload.text === s2.draft,
      };
      L.record(`${TREE}.A.${name}.download`, 'the next working-copy download', c.download, null);
      await ctx.close();
      // Re-import the downloaded file in a fresh browser profile.
      const ctx2 = await L.newCtx(browser);
      page = await L.open(ctx2, url, errors);
      await L.importFile(page, L.path.join(L.OUT, `A_${TREE}_${name}_dl.json`), d.draftId);
      const s3 = await L.state(page);
      c.reimport = { adapted: s3.adapted, label: s3.label, originDeclarations: s3.declarations };
      L.record(`${TREE}.A.${name}.reimport`, 'the downloaded file imported again', c.reimport, null);
      await ctx2.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, `A_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
