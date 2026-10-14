// Control: are the mechanisms behind the card's loss pre-existing? Uses a
// marker in the page context's display state (app.lyricMeta.ui), where the
// candidate keeps its card, and the brief (which Undo is meant to restore).
// Quiet texts only (nothing to migrate), so every tree runs the same steps.
// Usage: node ctl_mech.js <cand|main|prev61b>
'use strict';
const H = require('./h');
const tree = process.argv[2];
const A = '[SETUP — title — "Quiet A"]\n\n[VERSE]\nwe sing it plain tonight\nand all the night is ours';
const B = '[SETUP — title — "Quiet B"]\n\n[VERSE]\nthe river runs to morning\nand never looks behind';
const mark = (page, m, brief) =>
  page.evaluate(([m, brief]) => {
    lyMeta().ui.marker = m;
    lyMeta().brief = brief;
    uiAutosave();
  }, [m, brief]);
const state = async (page, tag) => {
  const o = await page.evaluate(async () => {
    const out = { head: document.getElementById('lyrics-draft').value.split('\n')[0], marker: (app.lyricMeta.ui || {}).marker || null, brief: app.lyricMeta.brief, draftId: (app.lyricMeta.draftId || '').slice(0, 14) || null };
    if (typeof lyLibraryStore !== 'undefined' && lyLibraryStore) {
      out.idb = [];
      for (const d of await lyLibraryStore.listDrafts()) {
        const f = await lyLibraryStore.getDraft(d.draftId);
        out.idb.push({ id: d.draftId.slice(0, 14), head: f && f.text ? f.text.split('\n')[0] : null, marker: f && f.meta && f.meta.ui ? f.meta.ui.marker || null : null, brief: f && f.meta ? f.meta.brief : null });
      }
    }
    return out;
  });
  console.log('   ', tag, JSON.stringify(o));
  return o;
};
(async () => {
  const env = await H.boot(tree);
  const errs = [];
  const res = {};
  try {
    {
      console.log('## M1 A(marker A) -> Library B -> Undo (the C7 path)');
      const ctx = await H.context(env);
      const page = await H.openPage(ctx, env, errs);
      await H.importTxt(page, 'a.txt', A);
      await mark(page, 'A', 'brief A');
      await page.waitForTimeout(600);
      const s = [await state(page, 'A marked')];
      await H.importLibrary(page, B, 'Quiet B', H.path.join(H.OUT, `ctl_${tree}_B.json`));
      s.push(await state(page, 'after Library B'));
      await H.undo(page);
      await page.waitForTimeout(1500);
      s.push(await state(page, 'after Undo +1.5s'));
      res.M1 = s;
      const aRec = (s[2].idb || []).find((d) => d.head && d.head.includes('Quiet A'));
      H.rec(`${tree}.M1.liveMarker`, 'after Undo across a Library import, the display state of A comes back', 'marker A', s[2].marker, s[2].marker === 'A' ? 'PASS' : 'FAIL');
      H.rec(`${tree}.M1.storedMarker`, "A's stored Library draft keeps A's display state after the Undo", 'marker A', aRec || null, aRec && aRec.marker === 'A' ? 'PASS' : 'FAIL');
      H.rec(`${tree}.M1.brief`, 'the brief (creative context) is restored by that Undo', 'brief A', s[2].brief, s[2].brief === 'brief A' ? 'PASS' : 'FAIL');
      await ctx.close();
    }
    {
      console.log('## M2 A(marker A) -> session import -> Undo (the C8 path)');
      const ctx = await H.context(env);
      const page = await H.openPage(ctx, env, errs);
      await H.importTxt(page, 'a.txt', A);
      await mark(page, 'A', 'brief A');
      await page.waitForTimeout(600);
      const s = [await state(page, 'A marked')];
      await H.importSession(page, { version: 3, name: 'Other', cards: [], lyrics: B, lyricMeta: { version: 1, brief: 'brief B', notes: {}, drafts: {}, ui: {} } }, H.path.join(H.OUT, `ctl_${tree}_session.json`));
      s.push(await state(page, 'after session import'));
      await H.undo(page);
      s.push(await state(page, 'after Undo'));
      res.M2 = s;
      H.rec(`${tree}.M2.liveMarker`, 'after Undo across a session import, the display state of A comes back', 'marker A', s[2].marker, s[2].marker === 'A' ? 'PASS' : 'FAIL');
      H.rec(`${tree}.M2.brief`, 'the brief is restored by that Undo', 'brief A', s[2].brief, s[2].brief === 'brief A' ? 'PASS' : 'FAIL');
      await ctx.close();
    }
  } finally {
    await env.close();
  }
  H.fs.writeFileSync(H.path.join(H.OUT, `ctl_mech_${tree}.json`), JSON.stringify({ res, log: H.log, errs }, null, 1));
  console.log('page errors:', errs.length, errs.slice(0, 3));
})();
