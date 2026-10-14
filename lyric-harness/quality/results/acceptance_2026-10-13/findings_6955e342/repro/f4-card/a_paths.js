// (a) Both import paths: the card lists every renumbered entry (old -> new,
// word, line); it survives a reload and a session export/import.
// Usage: node a_paths.js [cand|main|prev]
'use strict';
const L = require('./lib');
const TREE = process.argv[2] || 'cand';
const OH = 'Oh--oh, oh my love';
const DOVE = 'You are the one I dream of my dove';
const PLAIN = 'we sing it plain tonight';
const AH = 'Ah--ah, ah my heart and soul';
const ORPHAN = 'Oh--oh, oh my lost line';
// A pre-release draft: unmarked rows. One unchanged reading (keeps bytes),
// one moved reading on a repeated line, one moved reading whose line is not
// in the draft, group rows with moved, bare and unchanged members.
const SONG = [
  '[SETUP — title — "Old Song"]',
  `[SETUP — reading — token 2 "oh" in ${JSON.stringify(OH)} — OW1 — declared — source: me]`,
  `[SETUP — reading — token 2 "sing" in ${JSON.stringify(PLAIN)} — S IH1 NG — declared — source: me]`,
  `[SETUP — reading — token 4 "heart" in ${JSON.stringify(AH)} — HH AA1 R T — declared — source: me]`,
  `[SETUP — reading — token 4 "lost" in ${JSON.stringify(ORPHAN)} — L AO1 S T — declared — source: me]`,
  '[SETUP — rhyme groups — 1.T4,2;4.T3,5.T6]',
  `[SETUP — reading — token 1 "Oh--oh" in ${JSON.stringify(OH)} — OW1 — declared — source: me]`,
  '[SETUP — returns — 1.T3,3.T3]',
  '',
  '[VERSE]',
  OH,
  DOVE,
  OH,
  PLAIN,
  AH,
].join('\n');
const MARK = 'Old Song';

function compare(tag, truth, c) {
  const text = (c.item && c.item.text) || '';
  const pane = c.pane || '';
  const items = (c.meta && c.meta.items) || [];
  const rows = truth.map((t) => {
    const hit = items.find(
      (m) => m.kind === t.kind && m.word === t.word && m.from === t.from && m.to === t.to && JSON.stringify(m.n) === JSON.stringify(t.n)
    );
    const phrase = `“${t.word}”`;
    const arrow = `word ${t.from} → ${t.to}`;
    return {
      kind: t.kind,
      word: t.word,
      from: t.from,
      to: t.to,
      n: t.n,
      line: t.line || t.lineText,
      inMeta: !!hit,
      inItemText: text.includes(phrase) && text.includes(arrow),
      inPane: pane.includes(phrase) && pane.includes(arrow),
    };
  });
  return rows;
}

(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE, url, steps: {} };
  try {
    // ── .txt import ─────────────────────────────────────────────
    let ctx = await L.newCtx(browser);
    let page = await L.open(ctx, url, errors);
    await L.importTxt(page, 'old-song.txt', SONG, MARK);
    const after = await L.draftOf(page);
    const truth = L.truthFromRows(SONG, after);
    const t1 = await L.toasts(page);
    let c = await L.card(page);
    out.steps.txt = { after, truth, toasts: t1, card: c, cmp: compare('txt', truth, c) };
    console.log('TRUTH', JSON.stringify(truth, null, 1));
    console.log('CARD', JSON.stringify(c.item, null, 1));
    console.log('META', JSON.stringify(c.meta));
    L.record(
      `${TREE}.a.txt.every`,
      '.txt import: the card lists every renumbered entry with old -> new, word, line',
      `${truth.length} entries, each in meta, item text and pane`,
      out.steps.txt.cmp,
      truth.length > 0 && out.steps.txt.cmp.every((r) => r.inMeta && r.inItemText && r.inPane)
    );
    // The orphan reading: its line is in no sung line of the draft.
    const orphan = out.steps.txt.cmp.find((r) => r.word === 'lost');
    L.record(
      `${TREE}.a.txt.orphanLine`,
      'a renumbered reading whose line text is not a sung line of the draft names its line on the card',
      'some line reference or the line text',
      orphan ? { n: orphan.n, cardText: (c.item && c.item.text.match(/the reading for “lost”[^;]*/) || [null])[0] } : 'no orphan entry in truth',
      orphan ? /“lost”, line/.test(c.item.text) || (c.item.text || '').includes(ORPHAN) : null
    );
    // Overwrite the toast; reload.
    await page.evaluate(() => showToast('Something else', 'success'));
    await L.settle(page, 800);
    const st = await L.stored(page);
    await page.reload();
    await L.waitReady(page);
    await L.settle(page, 800);
    const c2 = await L.card(page);
    out.steps.txtReload = { stored: st.renumbered, card: c2, cmp: compare('reload', truth, c2) };
    L.record(
      `${TREE}.a.txt.reload`,
      'the card survives a reload with the same entries',
      'identical meta.items and every entry rendered',
      { sameMeta: JSON.stringify(c2.meta) === JSON.stringify(c.meta), rendered: out.steps.txtReload.cmp.every((r) => r.inPane) },
      JSON.stringify(c2.meta) === JSON.stringify(c.meta) && out.steps.txtReload.cmp.every((r) => r.inPane)
    );
    // Session export (the Lyrics menu's Export session).
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => LY_ACTIONS['ly-export-session']()),
    ]);
    const sessFile = L.path.join(L.OUT, `a_${TREE}_session.json`);
    await dl.saveAs(sessFile);
    const sess = JSON.parse(L.fs.readFileSync(sessFile, 'utf8'));
    out.steps.export = { renumbered: sess.lyricMeta && sess.lyricMeta.ui && sess.lyricMeta.ui.renumbered };
    L.record(
      `${TREE}.a.export`,
      'the exported session file carries the card',
      'lyricMeta.ui.renumbered equal to the page context',
      out.steps.export.renumbered,
      JSON.stringify(out.steps.export.renumbered) === JSON.stringify(c.meta)
    );
    await ctx.close();
    // Session import into a fresh browser profile.
    ctx = await L.newCtx(browser);
    page = await L.open(ctx, url, errors);
    await page.setInputFiles('#ui-file', sessFile);
    await page.waitForFunction((m) => $ui('lyrics-draft').value.includes(m), MARK, { timeout: 20000 });
    await L.settle(page, 800);
    const c3 = await L.card(page);
    out.steps.sessionImport = { card: c3, draft: await L.draftOf(page) };
    L.record(
      `${TREE}.a.sessionImport`,
      'a session import in a fresh profile restores the card',
      'identical meta.items, card rendered',
      { sameMeta: JSON.stringify(c3.meta) === JSON.stringify(c.meta), title: c3.item && c3.item.title },
      JSON.stringify(c3.meta) === JSON.stringify(c.meta) && !!c3.item && compare('si', truth, c3).every((r) => r.inPane)
    );
    await ctx.close();

    // ── Library working-copy import ─────────────────────────────
    ctx = await L.newCtx(browser);
    page = await L.open(ctx, url, errors);
    const env = await L.makeEnvelope(page, SONG, 'Old Song (Library)');
    await L.importLibrary(page, env, L.path.join(L.OUT, `a_${TREE}_working_copy.json`));
    const afterL = await L.draftOf(page);
    const truthL = L.truthFromRows(SONG, afterL);
    const tL = await L.toasts(page);
    const cL = await L.card(page);
    out.steps.lib = { after: afterL, truth: truthL, toasts: tL, card: cL, cmp: compare('lib', truthL, cL) };
    L.record(
      `${TREE}.a.lib.every`,
      'Library working-copy import: the card lists every renumbered entry',
      `${truthL.length} entries, each in meta, item text and pane`,
      out.steps.lib.cmp,
      truthL.length > 0 && out.steps.lib.cmp.every((r) => r.inMeta && r.inItemText && r.inPane)
    );
    L.record(
      `${TREE}.a.lib.sameAsTxt`,
      'the Library path migrates to the same text and the same card entries as the .txt path',
      'same draft text and same meta.items',
      { sameText: afterL === after, sameItems: JSON.stringify(cL.meta && cL.meta.items) === JSON.stringify(c.meta && c.meta.items) },
      afterL === after && JSON.stringify(cL.meta && cL.meta.items) === JSON.stringify(c.meta && c.meta.items)
    );
    await L.settle(page, 1200);
    const idb1 = await L.idbDrafts(page);
    await page.reload();
    await L.waitReady(page);
    await L.settle(page, 1500);
    const cL2 = await L.card(page);
    const idb2 = await L.idbDrafts(page);
    out.steps.libReload = { card: cL2, idbBefore: idb1, idbAfter: idb2 };
    L.record(
      `${TREE}.a.lib.reload`,
      'after a Library import the card survives a reload',
      'identical meta.items',
      { sameMeta: JSON.stringify(cL2.meta) === JSON.stringify(cL.meta), idb: idb2.map((d) => [d.draftId, !!d.renumbered]) },
      JSON.stringify(cL2.meta) === JSON.stringify(cL.meta)
    );
    const [dl2] = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => LY_ACTIONS['ly-export-session']()),
    ]);
    const sessFile2 = L.path.join(L.OUT, `a_${TREE}_session_lib.json`);
    await dl2.saveAs(sessFile2);
    await ctx.close();
    ctx = await L.newCtx(browser);
    page = await L.open(ctx, url, errors);
    await page.setInputFiles('#ui-file', sessFile2);
    await page.waitForFunction((m) => $ui('lyrics-draft').value.includes(m), MARK, { timeout: 20000 });
    await L.settle(page, 800);
    const cL3 = await L.card(page);
    L.record(
      `${TREE}.a.lib.sessionImport`,
      'Library draft: session export/import into a fresh profile restores the card',
      'identical meta.items',
      { sameMeta: JSON.stringify(cL3.meta) === JSON.stringify(cL.meta) },
      JSON.stringify(cL3.meta) === JSON.stringify(cL.meta)
    );
    await page.screenshot({ path: L.path.join(L.OUT, `a_${TREE}_review.png`), fullPage: false });
    await ctx.close();
  } catch (e) {
    out.error = String(e && e.stack || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, `a_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
