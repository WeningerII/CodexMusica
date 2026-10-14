// Keep durability: choose "Keep the link" on a carried member of each row
// type, then (never undoing the Keep) reload, text export + import, Library
// working-copy import + download + import, Export/Import session, section
// reorder (and back), the Rhymes and Repeats forms, Undo/Redo of those edits.
// After each step: the kept member is plain (not flagged, not migrated again),
// the row is what Keep produced, and the value the page sends is unchanged.
'use strict';
const X = require('./cand_lib.js');
const { L, C } = X;
const results = [];
const R = (id, claim, expected, observed, ok) => { results.push({ id, claim, expected, observed, status: ok ? 'pass' : 'fail' }); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${id}: ${claim}\n   expected: ${expected}\n   observed: ${typeof observed === 'string' ? observed : JSON.stringify(observed)}`); };
async function state(page) {
  return page.evaluate(() => {
    lyRefresh(true);
    const text = $ui('lyrics-draft').value;
    const m = lyParse(text);
    const ctx = lyContext(m);
    return {
      rows: text.split('\n').filter((r) => /^\[SETUP/.test(r)),
      carried: (LY.items || []).filter((i) => /:carried:/.test(i.id)).map((i) => i.title),
      inputs: (LY.items || []).filter((i) => /^(rhyme groups|returns):/.test(i.id) && i.tone !== 'note').map((i) => i.title),
      decl: { groups: ctx.declarations.groups, returns: ctx.declarations.returns, nd: Object.keys(ctx.declarations).filter((k) => /need/.test(k)) },
      text,
    };
  });
}
async function review(page, q) {
  await page.evaluate(() => _chatReset());
  const r = await X.runReview(page, q);
  const d = r.calls[0];
  return { calls: r.calls.length, groups: d && d.groups, returns: d && d.returns, nd: d ? Object.keys(d).filter((k) => /need/.test(k)) : null };
}
async function clickKeep(page, key, line) {
  const id = await page.evaluate(([key, line]) => {
    lyRefresh(true);
    LY_ACTIONS['ly-tab']('review');
    const it = (LY.items || []).find((i) => i.id.startsWith(key + ':') && /:carried:/.test(i.id) && i.lines[0] === line);
    return it ? it.actions[0][3] : null;
  }, [key, line]);
  if (!id) return false;
  await page.click(`[data-ui="ly-carried-keep"][data-id="${id}"]`);
  await page.waitForTimeout(150);
  return true;
}
let KEPT; // what Keep produced, with the line numbers of a given layout
function check(step, s, rows, sent, nCarried, keptLines, rv) {
  R(`${step}.rows`, `${step}: rows are what Keep produced (kept members plain, others still carried, mark kept)`, rows.join(' | '), s.rows.join(' | '), JSON.stringify(s.rows) === JSON.stringify(rows));
  const flagged = s.carried.filter((t) => keptLines.some(([cat, n]) => t.startsWith(cat === 'G' ? 'A rhyme link member' : 'A declared return') && t.includes(`line ${n} ·`)));
  R(`${step}.keptNotFlagged`, `${step}: no notice for a kept member; ${nCarried} carried notices remain; no blocking input notice`, `kept flagged: none; carried=${nCarried}; inputs=[]`, { flagged, carried: s.carried.length, inputs: s.inputs }, flagged.length === 0 && s.carried.length === nCarried && s.inputs.length === 0);
  R(`${step}.sendValue`, `${step}: lyContext declarations the page sends are unchanged`, JSON.stringify(sent), JSON.stringify(s.decl), s.decl.groups === sent.groups && s.decl.returns === sent.returns && s.decl.nd.length === 0);
  if (rv) R(`${step}.review`, `${step}: Run review reaches /chat with those values`, `1 call, ${JSON.stringify(sent)}`, rv, rv.calls === 1 && rv.groups === sent.groups && rv.returns === sent.returns && rv.nd.length === 0);
}
async function exportSession(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.evaluate(() => LY_ACTIONS['ly-export-session']())]);
  return { name: dl.suggestedFilename(), body: L.fs.readFileSync(await dl.path(), 'utf8') };
}
async function importSession(page, f) {
  await page.setInputFiles('#ui-file', { name: f.name, mimeType: 'application/json', buffer: Buffer.from(f.body, 'utf8') });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { if (UI.view !== 'lyrics') uiNavigate('lyrics'); });
  await page.waitForTimeout(500);
}
(async () => {
  const keepMain = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'keep_main.json'), 'utf8'));
  const server = L.serve({ root: L.WT_CAND });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const toastsAll = {};
  try {
    let b = await X.boot(browser, base, { session: keepMain.ls });
    toastsAll.boot = await L.toasts(b.page);
    let s = await state(b.page);
    const LOAD_G = `[SETUP — rhyme groups — 1 ${C},6;2.endword ${C},5;4 ${C},3.head ${C} — cut v2]`;
    const LOAD_R = `[SETUP — returns — 1.head ${C},6.head;8.line ${C},5.line — cut v2]`;
    R('load.rows', 'baseline rows on load: every named place on a changed line carried (1, 2.endword, 4, 3.head; 1.head, 8.line), unchanged-line partners plain', `${LOAD_G} | ${LOAD_R}`, s.rows.join(' | '), s.rows[0] === LOAD_G && s.rows[1] === LOAD_R && s.carried.length === 6);
    // ── Keep the link (through the Review notice's own button) ──
    const k1 = await clickKeep(b.page, 'rhyme groups', 1);
    const k2 = await clickKeep(b.page, 'returns', 1);
    toastsAll.keep = await L.toasts(b.page);
    s = await state(b.page);
    KEPT = [`[SETUP — rhyme groups — 1,6;2.endword ${C},5;4 ${C},3.head ${C} — cut v2]`, `[SETUP — returns — 1.head,6.head;8.line ${C},5.line — cut v2]`];
    const SENT = { groups: '1,6;2.endword,5;4,3.head', returns: '1.head,6.head;8.line,5.line' };
    const KL = [['G', 1], ['R', 1]];
    R('keep.clicked', 'Keep the link buttons found and clicked for rhyme line 1 and return line 1', 'both', { k1, k2, toasts: toastsAll.keep }, k1 && k2);
    check('keep', s, KEPT, SENT, 4, KL, await review(b.page, b.q));
    // ── 1. reload (save and reopen) ──
    await X.reload(b.page);
    toastsAll.reload = await L.toasts(b.page);
    s = await state(b.page);
    check('reload', s, KEPT, SENT, 4, KL, await review(b.page, b.q));
    R('reload.noMigrationToast', 'reload: no renumber/carry toast', 'no toast mentioning renumbered/kept as declared', toastsAll.reload, !toastsAll.reload.some((t) => /renumbered|kept as declared/.test(t)));
    // ── 2. Download text, Import in a fresh browser ──
    const dl = await X.downloadText(b.page);
    L.fs.writeFileSync(L.path.join(L.OUT, 'keep_download.txt'), dl.body);
    R('export.body', 'Download text is the draft as Keep left it', 'body rows == KEPT', dl.body.split('\n').filter((r) => /^\[SETUP/.test(r)), JSON.stringify(dl.body.split('\n').filter((r) => /^\[SETUP/.test(r))) === JSON.stringify(KEPT));
    await b.ctx.close();
    errors.push(...b.errors);
    b = await X.boot(browser, base);
    await X.importFile(b.page, dl.name, dl.body);
    toastsAll.importText = await L.toasts(b.page);
    s = await state(b.page);
    check('importText', s, KEPT, SENT, 4, KL, await review(b.page, b.q));
    // ── 3. Library working copy: imported as a Library envelope, downloaded (.json), imported fresh ──
    const lib = await b.page.evaluate(async () => {
      const text = $ui('lyrics-draft').value;
      const meta = { version: 1, brief: '', notes: {}, drafts: {}, ui: {}, libraryOrigin: { version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false, title: 'Song', language: 'eng', scope: 'whole', provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' }, lineage: [], declarations: [] } };
      let err = null;
      try { await lyLibraryImport(await CMLibraryImport.makeWorkingCopyEnvelope(text, meta)); } catch (e) { err = e.message; }
      await new Promise((r) => setTimeout(r, 800));
      lyRefresh(true);
      return { err, origin: !!lyMeta().libraryOrigin };
    });
    s = await state(b.page);
    R('library.import', 'Library working-copy envelope imports without error and is library-origin', 'err null, origin true', lib, lib.err === null && lib.origin);
    check('libraryImport', s, KEPT, SENT, 4, KL, await review(b.page, b.q));
    const dl2 = await X.downloadText(b.page);
    L.fs.writeFileSync(L.path.join(L.OUT, 'keep_library_download.json'), dl2.body);
    R('library.download', 'a library-origin draft downloads as a .json working copy', '.json', dl2.name, dl2.name.endsWith('.json'));
    await b.ctx.close();
    errors.push(...b.errors);
    b = await X.boot(browser, base);
    await X.importFile(b.page, dl2.name, dl2.body, 'application/json');
    await b.page.waitForTimeout(800);
    toastsAll.libraryReimport = await L.toasts(b.page);
    s = await state(b.page);
    check('libraryReimport', s, KEPT, SENT, 4, KL, await review(b.page, b.q));
    // ── 4. Export session, Import session in a fresh browser ──
    const ses = await exportSession(b.page);
    await b.ctx.close();
    errors.push(...b.errors);
    b = await X.boot(browser, base);
    await importSession(b.page, ses);
    toastsAll.importSession = await L.toasts(b.page);
    s = await state(b.page);
    check('importSession', s, KEPT, SENT, 4, KL, await review(b.page, b.q));
    // ── 5. section reorder: verse after chorus, then back ──
    await X.moveSection(b.page, 0, 1);
    s = await state(b.page);
    const RE = [`[SETUP — rhyme groups — 5,2;6.endword ${C},1;8 ${C},7.head ${C} — cut v2]`, `[SETUP — returns — 5.head,2.head;4.line ${C},1.line — cut v2]`];
    check('reorder', s, RE, { groups: '5,2;6.endword,1;8,7.head', returns: '5.head,2.head;4.line,1.line' }, 4, [['G', 5], ['R', 5]], await review(b.page, b.q));
    await X.reload(b.page);
    s = await state(b.page);
    check('reorder.reload', s, RE, { groups: '5,2;6.endword,1;8,7.head', returns: '5.head,2.head;4.line,1.line' }, 4, [['G', 5], ['R', 5]]);
    // Back: the chorus is now section 0; move it down again.
    await X.moveSection(b.page, 0, 1);
    s = await state(b.page);
    check('reorderBack', s, KEPT, SENT, 4, KL);
    // ── 6. Rhymes form: add a link ──
    await X.addLinkUI(b.page, [[5, 'T2'], [6, 'T2']]);
    s = await state(b.page);
    const F1 = [`[SETUP — rhyme groups — 1,6;2.endword ${C},5;4 ${C},3.head ${C};5.T2,6.T2 — cut v2]`, KEPT[1]];
    check('rhymesForm', s, F1, { groups: '1,6;2.endword,5;4,3.head;5.T2,6.T2', returns: SENT.returns }, 4, KL);
    // ── 7. Repeats form: add a placed return ──
    await X.addPlacedUI(b.page, [[5, 'head'], [7, 'head']]);
    s = await state(b.page);
    const F2 = [F1[0], `[SETUP — returns — 1.head,6.head;8.line ${C},5.line;5.head,7.head — cut v2]`];
    check('repeatsForm', s, F2, { groups: '1,6;2.endword,5;4,3.head;5.T2,6.T2', returns: '1.head,6.head;8.line,5.line;5.head,7.head' }, 4, KL, await review(b.page, b.q));
    // ── 8. Rhymes form: Remove link (the 2.endword link, group B) ──
    await b.page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
    await b.page.check('input[name="ly-link-group"][value="1"]');
    await b.page.waitForTimeout(150);
    await b.page.click('[data-ui="ly-link-remove"]');
    await b.page.waitForTimeout(200);
    s = await state(b.page);
    const F3 = [`[SETUP — rhyme groups — 1,6;4 ${C},3.head ${C};5.T2,6.T2 — cut v2]`, F2[1]];
    check('rhymesRemove', s, F3, { groups: '1,6;4,3.head;5.T2,6.T2', returns: F2[1] && '1.head,6.head;8.line,5.line;5.head,7.head' }, 3, KL);
    // ── 9. Undo / Redo of the form edits (never of the Keep) ──
    await X.undo(b.page);
    s = await state(b.page);
    check('undo1', s, F2, { groups: '1,6;2.endword,5;4,3.head;5.T2,6.T2', returns: '1.head,6.head;8.line,5.line;5.head,7.head' }, 4, KL);
    await X.undo(b.page);
    await X.undo(b.page);
    s = await state(b.page);
    check('undo3', s, KEPT, SENT, 4, KL);
    await X.redo(b.page);
    await X.redo(b.page);
    await X.redo(b.page);
    s = await state(b.page);
    check('redo3', s, F3, { groups: '1,6;4,3.head;5.T2,6.T2', returns: '1.head,6.head;8.line,5.line;5.head,7.head' }, 3, KL);
    // ── 10. Voices toggled ON through the Repeats form: marked rows are not re-read ──
    await b.page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
    await b.page.click('[data-ui="ly-voices"][data-id="sung"]');
    await b.page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
    await b.page.waitForTimeout(200);
    s = await state(b.page);
    R('voicesOn.rows', 'turning voices on after Keep: group rows unchanged (no re-migration of the kept or any member)', F3.join(' | '), s.rows.filter((r) => !/voices/.test(r)).join(' | '), JSON.stringify(s.rows.filter((r) => !/voices/.test(r))) === JSON.stringify(F3));
    R('voicesOn.keptNotFlagged', 'turning voices on: kept members still not flagged', 'no line 1 notice', s.carried, !s.carried.some((t) => / line 1 ·/.test(t)));
    await X.reload(b.page);
    s = await state(b.page);
    R('final.reload', 'final reload: same rows (voices row + F3)', F3.join(' | '), s.rows.filter((r) => !/voices/.test(r)).join(' | '), JSON.stringify(s.rows.filter((r) => !/voices/.test(r))) === JSON.stringify(F3));
    toastsAll.final = await L.toasts(b.page);
    await b.ctx.close();
    errors.push(...b.errors);
  } catch (e) {
    errors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  R('pageErrors', 'no uncaught page errors / script exceptions', '[]', errors, errors.length === 0);
  L.fs.writeFileSync(L.path.join(L.OUT, 'keep.json'), JSON.stringify({ results, toastsAll }, null, 1));
  console.log('toasts', JSON.stringify(toastsAll, null, 1));
  console.log(`done ${results.length} checks, ${results.filter((r) => r.status === 'pass').length} pass`);
})();
