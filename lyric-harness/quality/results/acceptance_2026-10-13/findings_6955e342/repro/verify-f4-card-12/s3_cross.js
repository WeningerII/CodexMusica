// S3: the card across imports, Undo, reload, Library drafts and sessions.
// Candidate only (main and 61b6618a have no card; their mechanisms are
// checked by ctl_mech.js). Usage: node s3_cross.js cand [X1 X2 ...]
'use strict';
const H = require('./h');
const G = require('./gen');
const tree = process.argv[2] || 'cand';
const only = new Set(process.argv.slice(3));
const small = (title, tag) => G.groupsSong(title, 2, tag); // 2 moved entries: <tag>a, <tag>b
const QUIET = '[SETUP — title — "Quiet"]\n\n[VERSE]\nwe sing it plain tonight\nand all the night is ours';
const snap = async (page, tag, extra = {}) => {
  const st = await H.cardState(page);
  const o = { tag, words: H.words(st), more: st.stored ? st.stored.more : null, title: st.title, head: st.head, draftId: st.draftId, paneHasCard: st.paneHasCard, hist: [st.histIdx, st.histLen], ...extra };
  console.log('   ', JSON.stringify(o));
  return o;
};
const idbSummary = async (page) => (await H.idb(page)).map((d) => ({ id: d.draftId.slice(0, 14), head: d.head, words: d.ui && d.ui.renumbered ? d.ui.renumbered.items.map((m) => m.word) : [] }));
const restoreDraft = async (page, id) => {
  await page.evaluate((id) => LY_ACTIONS['ly-library-restore'](id), id);
  await page.waitForFunction((id) => app.lyricMeta.draftId === id, id, { timeout: 20000 });
  await page.waitForTimeout(1500);
};
const want = (id) => !only.size || only.has(id);
(async () => {
  const env = await H.boot(tree);
  const errs = [];
  const res = {};
  const fresh = async () => {
    const ctx = await H.context(env);
    const page = await H.openPage(ctx, env, errs);
    return { ctx, page };
  };
  const f = (n) => H.path.join(H.OUT, `s3_${n}.json`);
  try {
    if (want('X1')) {
      console.log('## X1 .txt A (30 moved) -> .txt B (30 moved) -> Undo: does A keep its entries?');
      const { ctx, page } = await fresh();
      const A = G.groupsSong('Song A', 30, 'a');
      const B = G.groupsSong('Song B', 30, 'b');
      const s = [];
      await H.importTxt(page, 'a.txt', A.text);
      s.push(await snap(page, 'after A'));
      await H.importTxt(page, 'b.txt', B.text);
      s.push(await snap(page, 'after B'));
      await H.undo(page);
      s.push(await snap(page, 'after Undo'));
      const aw = A.truth.map((m) => m.word);
      const keptA = s[2].words.filter((w) => aw.includes(w));
      H.rec('X1.accumEvict', 'after Undo back to A, the card lists all 30 of A\'s renumbered entries', '30 of A', { draft: s[2].head, keptA: keptA.length, listedB: s[2].words.filter((w) => w.startsWith('b')).length, more: s[2].more }, keptA.length === 30 ? 'PASS' : 'FAIL');
      res.X1 = s;
      await ctx.close();
    }
    if (want('X2')) {
      console.log('## X2 (C7) .txt A -> Library B -> Undo -> wait -> reload -> open A from History');
      const { ctx, page } = await fresh();
      const s = [];
      await H.importTxt(page, 'a.txt', small('Song A', 'apple').text);
      s.push(await snap(page, 'after A'));
      await H.importLibrary(page, small('Song B', 'bravo').text, 'Song B', f('X2_B'));
      s.push(await snap(page, 'after Library B', { idb: await idbSummary(page) }));
      await H.undo(page);
      s.push(await snap(page, 'after Undo'));
      await page.waitForTimeout(1500);
      s.push(await snap(page, 'after Undo +1.5s', { idb: await idbSummary(page) }));
      await H.reload(page);
      s.push(await snap(page, 'after reload', { idb: await idbSummary(page) }));
      const aId = s[2].draftId;
      const bRec = s[1].draftId;
      await restoreDraft(page, bRec);
      s.push(await snap(page, 'after open B from History'));
      await restoreDraft(page, aId);
      s.push(await snap(page, 'after open A from History', { idb: await idbSummary(page) }));
      const aEverywhere = [s[3], s[4], s[6]].map((x) => x.words.some((w) => w.startsWith('apple')) || (x.idb || []).some((d) => d.words.some((w) => w.startsWith('apple'))));
      H.rec('X2.undoLibrary', 'after Undo of a Library import, A\'s card evidence (applea, appleb) still exists somewhere (live card or any stored draft)', 'apple* somewhere', { afterUndo: s[3].words, idbAfterUndo: s[3].idb, afterReopenA: s[6].words }, aEverywhere.some(Boolean) ? 'PASS' : 'FAIL');
      H.rec('X2.misattrib', 'after Undo the card on draft A lists only renumberings of A', 'apple* only', { head: s[2].head, words: s[2].words }, s[2].words.every((w) => w.startsWith('apple')) ? 'PASS' : 'FAIL');
      res.X2 = s;
      await ctx.close();
    }
    if (want('X2b')) {
      console.log('## X2b .txt A -> Library Q (renumbers nothing) -> Undo');
      const { ctx, page } = await fresh();
      const s = [];
      await H.importTxt(page, 'a.txt', small('Song A', 'apple').text);
      s.push(await snap(page, 'after A'));
      await H.importLibrary(page, QUIET, 'Quiet', f('X2b_Q'));
      s.push(await snap(page, 'after Library Q', { idb: await idbSummary(page) }));
      await H.undo(page);
      await page.waitForTimeout(1500);
      s.push(await snap(page, 'after Undo +1.5s', { idb: await idbSummary(page) }));
      H.rec('X2b.undoQuiet', 'Undo of a quiet Library import: A\'s card evidence still exists somewhere', 'apple* in live card or IDB', { live: s[2].words, idb: s[2].idb }, s[2].words.length || s[2].idb.some((d) => d.words.length) ? 'PASS' : 'FAIL');
      res.X2b = s;
      await ctx.close();
    }
    if (want('X3')) {
      console.log('## X3 Library A -> Library B -> Undo');
      const { ctx, page } = await fresh();
      const s = [];
      await H.importLibrary(page, small('Song A', 'apple').text, 'Song A', f('X3_A'));
      s.push(await snap(page, 'after Library A'));
      await H.importLibrary(page, small('Song B', 'bravo').text, 'Song B', f('X3_B'));
      s.push(await snap(page, 'after Library B', { idb: await idbSummary(page) }));
      await H.undo(page);
      await page.waitForTimeout(1500);
      s.push(await snap(page, 'after Undo +1.5s', { idb: await idbSummary(page) }));
      H.rec('X3.undoLibLib', 'Library A, Library B, Undo: A\'s card evidence still exists somewhere', 'apple*', { live: s[2].words, idb: s[2].idb }, s[2].words.some((w) => w.startsWith('apple')) || s[2].idb.some((d) => d.words.some((w) => w.startsWith('apple'))) ? 'PASS' : 'FAIL');
      res.X3 = s;
      await ctx.close();
    }
    if (want('X4')) {
      console.log('## X4 (C8) .txt A -> session import -> Undo -> Redo');
      const { ctx, page } = await fresh();
      const s = [];
      await H.importTxt(page, 'a.txt', small('Song A', 'apple').text);
      s.push(await snap(page, 'after A'));
      await H.importSession(page, { version: 3, name: 'Other', cards: [], lyrics: QUIET, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: {} } }, f('X4_session'));
      s.push(await snap(page, 'after session import'));
      await H.undo(page);
      s.push(await snap(page, 'after Undo'));
      await H.redo(page);
      s.push(await snap(page, 'after Redo'));
      H.rec('X4.sessionUndo', 'session import then Undo: A\'s text returns; does its card?', 'apple*', { head: s[2].head, words: s[2].words }, s[2].words.some((w) => w.startsWith('apple')) ? 'PASS' : 'FAIL');
      res.X4 = s;
      await ctx.close();
    }
    if (want('X5')) {
      console.log('## X5 Quiet -> Save a copy Q -> .txt A -> Load Q from Saved sessions -> Undo');
      const { ctx, page } = await fresh();
      const s = [];
      await H.importTxt(page, 'q.txt', QUIET);
      const backend = await page.evaluate(() => window.storage && window.storage.backend);
      await page.evaluate(() => saveWS('Q copy'));
      await page.waitForTimeout(800);
      const key = await page.evaluate(async () => { const l = JSON.parse((await window.storage.get('codex:list')).value); return l[l.length - 1].key; });
      await H.importTxt(page, 'a.txt', small('Song A', 'apple').text);
      s.push(await snap(page, 'after A', { backend, key }));
      await page.evaluate((k) => loadWS(k), key);
      await page.waitForFunction(() => document.getElementById('lyrics-draft').value.includes('Quiet'), null, { timeout: 20000 });
      await page.waitForTimeout(800);
      s.push(await snap(page, 'after Load Q'));
      await H.undo(page);
      s.push(await snap(page, 'after Undo'));
      H.rec('X5.loadUndo', 'Load a saved session, then Undo: A\'s text returns; does its card?', 'apple*', { head: s[2].head, words: s[2].words }, s[2].words.some((w) => w.startsWith('apple')) ? 'PASS' : 'FAIL');
      res.X5 = s;
      await ctx.close();
    }
    if (want('X6')) {
      console.log('## X6 Library A -> Library B -> open A from History -> Undo (back to B)');
      const { ctx, page } = await fresh();
      const s = [];
      const aId = await H.importLibrary(page, small('Song A', 'apple').text, 'Song A', f('X6_A'));
      const bId = await H.importLibrary(page, small('Song B', 'bravo').text, 'Song B', f('X6_B'));
      s.push(await snap(page, 'after Library B'));
      await restoreDraft(page, aId);
      s.push(await snap(page, 'after open A'));
      await H.undo(page);
      await page.waitForTimeout(1500);
      s.push(await snap(page, 'after Undo +1.5s', { idb: await idbSummary(page) }));
      H.rec('X6.restoreUndo', 'open A from History, then Undo back to B: B\'s card evidence still exists somewhere', 'bravo*', { live: s[2].words, head: s[2].head, idb: s[2].idb }, s[2].words.some((w) => w.startsWith('bravo')) || s[2].idb.some((d) => d.words.some((w) => w.startsWith('bravo'))) ? 'PASS' : 'FAIL');
      res.X6 = s;
      await ctx.close();
    }
    if (want('X7')) {
      console.log('## X7 single big import with Undo: are the evicted entries recoverable by Undo/Redo?');
      const { ctx, page } = await fresh();
      const s = [];
      await H.importTxt(page, 'big.txt', G.groupsSong('Big', 60, 'z').text);
      s.push(await snap(page, 'after big import'));
      await H.undo(page);
      s.push(await snap(page, 'after Undo', { draftRow1: (await H.draft(page)).split('\n')[1] || null }));
      await H.redo(page);
      s.push(await snap(page, 'after Redo', { draftRow1: (await H.draft(page)).split('\n')[1].slice(0, 80) }));
      res.X7 = s;
      await ctx.close();
    }
    if (want('X8')) {
      console.log('## X8 (C3 clean) .txt A -> Library B -> reload -> open A from History (no Undo)');
      const { ctx, page } = await fresh();
      const s = [];
      await H.importTxt(page, 'a.txt', small('Song A', 'apple').text);
      s.push(await snap(page, 'after A'));
      await H.importLibrary(page, small('Song B', 'bravo').text, 'Song B', f('X8_B'));
      s.push(await snap(page, 'after Library B', { idb: await idbSummary(page) }));
      await H.reload(page);
      s.push(await snap(page, 'after reload', { idb: await idbSummary(page) }));
      const aId = (await H.idb(page)).find((d) => d.head && d.head.includes('Song A')).draftId;
      await restoreDraft(page, aId);
      s.push(await snap(page, 'after open A from History'));
      H.rec('X8.isolatedRecoverable', 'without Undo, A\'s card stays with A\'s Library draft and comes back when A is opened', 'applea, appleb', s[3].words, s[3].words.join() === 'applea,appleb' ? 'PASS' : 'FAIL');
      res.X8 = s;
      await ctx.close();
    }
  } finally {
    await env.close();
  }
  H.fs.writeFileSync(H.path.join(H.OUT, `s3_${tree}${only.size ? '_' + [...only].join('_') : ''}.json`), JSON.stringify({ res, log: H.log, errs }, null, 1));
  console.log('page errors:', errs.length, errs.slice(0, 3));
})();
