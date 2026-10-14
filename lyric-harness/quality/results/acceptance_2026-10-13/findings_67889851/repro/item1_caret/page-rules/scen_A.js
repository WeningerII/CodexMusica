// Scenario A: the baseline page's rows (rebindable T<k>, named places on
// changed and unchanged lines, readings on a repeated word), opened on the
// candidate as a pre-batch user's saved session.
'use strict';
const X = require('./cand_lib.js');
const { L, C } = X;
const R = (id, claim, exp, obs, ok) => L.record('A.' + id, claim, exp, obs, ok);
const snaps = {};

(async () => {
  const base0 = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'baseline_sessions.json'), 'utf8')).out.A;
  const state = { root: L.WT_CAND };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const allErrors = [];
  try {
    const { ctx, page, q, errors } = await X.boot(browser, base, { session: base0.localStorage });
    const bootToasts = await L.toasts(page);
    let s = (snaps.load = await X.snap(page));
    const EXP_G = `[SETUP — rhyme groups — 1.T5,8;3 ${C},5;2 ${C},6;4 ${C},7 — cut v2]`;
    const EXP_R = `[SETUP — returns — 1.T5,8.T1;3.head ${C},5.head — cut v2]`;
    const EXP_P1 = '[SETUP — reading — token 3 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: the singer — cut v2]';
    const EXP_P2 = '[SETUP — reading — token 5 "oh" in "Oh, oh, I said oh" — OW1 — declared — source: the singer — cut v2]';
    R('load.rows', 'baseline rows migrate on open: 1.T4 (love) -> 1.T5 by span, named places on changed lines carried, unchanged lines plain', [EXP_G, EXP_R, EXP_P1, EXP_P2].join(' | '), s.rows.join(' | '), JSON.stringify(s.rows) === JSON.stringify([EXP_G, EXP_R, EXP_P1, EXP_P2]));
    const span = await page.evaluate(() => {
      const toks = CMLyricTokens.readerLine('Oh--oh, oh my love', { stripParens: true }).tokens;
      return { t5: [toks[4].text, toks[4].pieces], t4: [toks[3].text, toks[3].pieces], t3: [toks[2].text, toks[2].pieces] };
    });
    R('load.span', 'the rebound T5 / token 3 cover the same characters as v1 T4 (love 14-18) / v1 token 2 (oh 8-10)', 'T5=love[[14,18]], token3=oh[[8,10]]', JSON.stringify(span), span.t5[0] === 'love' && JSON.stringify(span.t5[1]) === '[[14,18]]' && span.t3[0] === 'oh' && JSON.stringify(span.t3[1]) === '[[8,10]]');
    R('load.toast', 'the renumbering and the carried places are said at open', 'a toast naming love 4 -> 5, oh 2 -> 3 and the carried places', JSON.stringify(bootToasts), bootToasts.some((t) => /renumbered/.test(t) && /4 → 5/.test(t) && /kept as declared/.test(t)));
    R('load.saved', 'autosave holds the migrated text', 'saved == draft', s.saved === s.text ? 'equal' : 'differs', s.saved === s.text);
    const car = X.carriedIds(s);
    R('notice.count', 'one Review notice per carried member: rhyme line 3 end, line 2 end, line 4 end; return line 3 head; none for lines 5-8 or T5', '4 notices', JSON.stringify(car.map((i) => i.title)), car.length === 4);
    const want = [
      ['Rhyme', 3, 'last rhyme', 'sea', 'sea'],
      ['Rhyme', 2, 'last rhyme', 'bass--', 'bass'],
      ['Rhyme', 4, 'last rhyme', 'heart', '10'],
      ['Return', 3, 'first word', 'Run--run', 'Run'],
    ];
    for (const [cat, n, place, before, now] of want) {
      const it = car.find((i) => i.title.startsWith(cat === 'Rhyme' ? 'A rhyme link' : 'A declared return') && i.title.includes(`line ${n} · ${place}`));
      R(
        `notice.L${n}.${cat}`,
        `notice names line ${n}, the place, both words, says page display is not the grader's binding, offers Keep/Remove, non-blocking`,
        `title has "line ${n} · ${place}", text has “${before}” earlier and “${now}” current, "not the grader's evidence", actions Keep the link/Remove it, tone note`,
        it ? { title: it.title, tone: it.tone, text: it.text, actions: it.actions.map((a) => a[1]) } : 'missing',
        !!it && it.tone === 'note' && it.text.includes(`“${before}” under the earlier cut and “${now}” under the current one`) && /not the grader's evidence/.test(it.text) && it.actions.map((a) => a[1]).join('|') === 'Keep the link|Remove it'
      );
    }
    R('notice.visibleInReview', 'the carried notices are rendered in the Review pane', 'review innerText contains "carried across the word-cut change" for the members', (s.review.match(/carried across the word-cut change/g) || []).length + ' occurrences', /carried across the word-cut change/.test(s.review));
    await page.screenshot({ path: L.path.join(L.OUT, 'A_review.png'), fullPage: false });
    // Non-blocking: Run review reaches /chat with the members as declared.
    let send = await X.runReview(page, q);
    snaps.send1 = send;
    const d0 = send.calls[0] || {};
    R('send.reaches', 'carried members do not block: Run review reaches /chat once', '1 call', `${send.calls.length} call(s); toasts ${JSON.stringify(send.toasts)}`, send.calls.length === 1);
    R('send.groups', 'declarations sent: groups 1.T5,8;3,5;2,6;4,7 (numeral-end member 4 not dropped), returns 1.T5,8.T1;3.head,5.head, pronunciations tokens 3 and 5, nothing marked need_decision', 'groups=1.T5,8;3,5;2,6;4,7 returns=1.T5,8.T1;3.head,5.head tokens=[3,5]', JSON.stringify({ g: d0.groups, r: d0.returns, p: (d0.pronunciations || []).map((p) => p.token), nd: Object.keys(d0).filter((k) => /need_decision/.test(k)) }), d0.groups === '1.T5,8;3,5;2,6;4,7' && d0.returns === '1.T5,8.T1;3.head,5.head' && JSON.stringify((d0.pronunciations || []).map((p) => p.token)) === '[3,5]' && !Object.keys(d0).some((k) => /need_decision/.test(k)));
    snaps.decl0 = d0;

    // ── Persistence 1: section reorder (verse moves after the chorus) ──
    await X.moveSection(page, 0, 1);
    s = snaps.reorder = await X.snap(page);
    const EXP_G2 = `[SETUP — rhyme groups — 5.T5,4;7 ${C},1;6 ${C},2;8 ${C},3 — cut v2]`;
    const EXP_R2 = `[SETUP — returns — 5.T5,4.T1;7.head ${C},1.head — cut v2]`;
    R('reorder.rows', 'section reorder renumbers lines and keeps the carried state and the mark', `${EXP_G2} | ${EXP_R2}`, s.rows.slice(0, 2).join(' | '), s.rows[0] === EXP_G2 && s.rows[1] === EXP_R2);
    R('reorder.notices', 'four carried notices after reorder, naming the new line numbers 7,6,8 (rhyme) and 7 (return)', 'lines 7,6,8,7', JSON.stringify(X.carriedIds(s).map((i) => i.title)), X.carriedIds(s).length === 4 && ['line 7 · last rhyme', 'line 6 · last rhyme', 'line 8 · last rhyme', 'line 7 · first word'].every((t) => X.carriedIds(s).some((i) => i.title.includes(t))));
    const tok = await page.evaluate(() => lyMemberWord(LY.model, { line: 5, place: 'T5' }));
    R('reorder.T5word', 'after reorder 5.T5 still names "love"', 'love', tok, tok === 'love');
    await X.undo(page);
    s = await X.snap(page);
    R('reorder.undo', 'Undo of the reorder restores the migrated rows exactly', `${EXP_G} | ${EXP_R}`, s.rows.slice(0, 2).join(' | '), s.rows[0] === EXP_G && s.rows[1] === EXP_R && X.carriedIds(s).length === 4);
    await X.redo(page);
    s = await X.snap(page);
    R('reorder.redo', 'Redo re-applies the reorder with states', EXP_G2, s.rows[0], s.rows[0] === EXP_G2 && X.carriedIds(s).length === 4);
    await X.undo(page);

    // ── Persistence 2: the rhymes form adds a link ──
    await X.addLinkUI(page, [[5, 'T2'], [6, 'T2']]);
    s = snaps.rhymesForm = await X.snap(page);
    const EXP_G3 = `[SETUP — rhyme groups — 1.T5,8;3 ${C},5;2 ${C},6;4 ${C},7;5.T2,6.T2 — cut v2]`;
    R('rhymesForm.row', 'adding a link through the Rhymes form keeps the earlier members, their carried state and the mark', EXP_G3, s.rows[0], s.rows[0] === EXP_G3 && X.carriedIds(s).length === 4);
    // ── Persistence 3: the repeats form adds a placed return ──
    await X.addPlacedUI(page, [[6, 'head'], [7, 'head']]);
    s = snaps.repeatsForm = await X.snap(page);
    const EXP_R3 = `[SETUP — returns — 1.T5,8.T1;3.head ${C},5.head;6.head,7.head — cut v2]`;
    R('repeatsForm.row', 'adding a placed return through the Repeats form keeps the carried state and the mark', EXP_R3, s.rows[1], s.rows[1] === EXP_R3 && X.carriedIds(s).length === 4);
    // ── Persistence 4: Undo / Redo of the form edits ──
    await X.undo(page);
    s = await X.snap(page);
    R('undo.repeats', 'Undo of the repeats edit restores the returns row with its carried member', EXP_R, s.rows[1], s.rows[1] === EXP_R && s.rows[0] === EXP_G3);
    await X.undo(page);
    s = await X.snap(page);
    R('undo.rhymes', 'second Undo restores the rhyme row with carried states', EXP_G, s.rows[0], s.rows[0] === EXP_G && X.carriedIds(s).length === 4);
    await X.redo(page);
    await X.redo(page);
    s = await X.snap(page);
    R('redo.both', 'Redo twice brings back both form edits with states', `${EXP_G3} | ${EXP_R3}`, s.rows.slice(0, 2).join(' | '), s.rows[0] === EXP_G3 && s.rows[1] === EXP_R3 && X.carriedIds(s).length === 4);
    await X.undo(page);
    await X.undo(page);
    // ── Keep / Remove with Undo / Redo (numeral-line member, line 4) ──
    s = await X.snap(page);
    const it4 = X.carriedIds(s).find((i) => i.title.includes('line 4 ·'));
    await page.evaluate((id) => LY_ACTIONS['ly-carried-keep'](id), it4.actions[0][2]);
    s = await X.snap(page);
    const EXP_GK = `[SETUP — rhyme groups — 1.T5,8;3 ${C},5;2 ${C},6;4,7 — cut v2]`;
    R('keep.row', 'Keep the link on line 4 clears only that member\'s carried state', EXP_GK, s.rows[0], s.rows[0] === EXP_GK && X.carriedIds(s).length === 3);
    await X.undo(page);
    s = await X.snap(page);
    R('keep.undo', 'Undo restores the carried state and notice', EXP_G, s.rows[0], s.rows[0] === EXP_G && X.carriedIds(s).length === 4);
    await X.redo(page);
    s = await X.snap(page);
    R('keep.redo', 'Redo keeps it again', EXP_GK, s.rows[0], s.rows[0] === EXP_GK && X.carriedIds(s).length === 3);
    await X.undo(page);
    s = await X.snap(page);
    const it2 = X.carriedIds(s).find((i) => i.title.includes('line 2 ·'));
    await page.evaluate((id) => LY_ACTIONS['ly-carried-remove'](id), it2.actions[1][2]);
    s = await X.snap(page);
    const EXP_GR = `[SETUP — rhyme groups — 1.T5,8;3 ${C},5;4 ${C},7 — cut v2]`;
    R('remove.row', 'Remove it on line 2 drops that two-member link whole and nothing else', EXP_GR, s.rows[0], s.rows[0] === EXP_GR && X.carriedIds(s).length === 3);
    await X.undo(page);
    s = await X.snap(page);
    R('remove.undo', 'Undo restores the removed carried member', EXP_G, s.rows[0], s.rows[0] === EXP_G);

    // ── Persistence 5: save and reopen (reload) ──
    const before = s.text;
    await X.reload(page);
    const reloadToasts = await L.toasts(page);
    s = snaps.reload = await X.snap(page);
    R('reload.text', 'reload reopens the same text, with no second migration or mark', 'identical text', s.text === before ? 'identical' : s.text, s.text === before);
    R('reload.notices', 'reload keeps the four notices, and shows no new migration toast', '4 notices, no renumber toast', JSON.stringify({ n: X.carriedIds(s).length, toasts: reloadToasts }), X.carriedIds(s).length === 4 && !reloadToasts.some((t) => /renumbered/.test(t)));

    // ── Persistence 6: Download text, then Import into a fresh browser ──
    const dl = await X.downloadText(page);
    L.fs.writeFileSync(L.path.join(L.OUT, 'A_download.txt'), dl.body);
    R('export.body', 'Download text writes the draft with its marks and carried states', 'body == draft', dl.body === s.text ? `equal (${dl.name})` : dl.body.slice(0, 300), dl.body === s.text);
    await ctx.close();
    allErrors.push(...errors);
    {
      const b = await X.boot(browser, base);
      await X.importFile(b.page, dl.name, dl.body);
      const s2 = (snaps.imported = await X.snap(b.page));
      R('import.text', 'Import of the downloaded text in a fresh browser gives the same rows', 'same SETUP rows', JSON.stringify(s2.rows), JSON.stringify(s2.rows) === JSON.stringify(s.rows));
      R('import.notices', 'imported draft shows the four carried notices', '4', X.carriedIds(s2).length, X.carriedIds(s2).length === 4);
      // ── Persistence 7: the Library working-copy path (envelope with a
      // libraryOrigin, Download -> .json, Import in a fresh browser) ──
      const lib = await b.page.evaluate(async () => {
        const text = $ui('lyrics-draft').value;
        const meta = {
          version: 1, brief: '', notes: {}, drafts: {}, ui: {},
          libraryOrigin: {
            version: 1, handoffId: 'handoff:' + crypto.randomUUID(), digest: '0'.repeat(64), importedAt: Date.now(), adapted: false,
            title: 'Song', language: 'eng', scope: 'whole',
            provenance: { snapshotId: 'snap:1', unitId: 'unit:1', workId: 'work:1', editionId: 'ed:1', revisionId: 'rev:1' },
            lineage: [], declarations: [],
          },
        };
        let err = null;
        try {
          await lyLibraryImport(await CMLibraryImport.makeWorkingCopyEnvelope(text, meta));
        } catch (e) {
          err = e.message;
        }
        await new Promise((r) => setTimeout(r, 800));
        lyRefresh(true);
        return { err, text: $ui('lyrics-draft').value, origin: !!lyMeta().libraryOrigin };
      });
      R('library.import', 'a Library working copy holding the migrated rows imports with them unchanged', 'no error, same SETUP rows', JSON.stringify({ err: lib.err, origin: lib.origin, rows: lib.text.split('\n').filter((r) => /^\[SETUP/.test(r)) }), lib.err === null && JSON.stringify(lib.text.split('\n').filter((r) => /^\[SETUP/.test(r))) === JSON.stringify(s.rows));
      let dl2 = null;
      try {
        dl2 = await X.downloadText(b.page);
      } catch (e) {
        dl2 = { name: 'none', body: 'download failed: ' + e.message };
      }
      L.fs.writeFileSync(L.path.join(L.OUT, 'A_library_download.' + (dl2.name.endsWith('.json') ? 'json' : 'txt')), dl2.body);
      await b.ctx.close();
      allErrors.push(...b.errors);
      if (dl2.name.endsWith('.json')) {
        const c = await X.boot(browser, base);
        await X.importFile(c.page, dl2.name, dl2.body, 'application/json');
        await c.page.waitForTimeout(800);
        const s3 = (snaps.libraryReimport = await X.snap(c.page));
        R('library.roundtrip', 'the Library working copy downloaded (.json) and imported in a fresh browser keeps marks and carried states', JSON.stringify(s.rows), JSON.stringify(s3.rows), JSON.stringify(s3.rows) === JSON.stringify(s.rows) && X.carriedIds(s3).length === 4);
        await c.ctx.close();
        allErrors.push(...c.errors);
      } else R('library.roundtrip', 'Library working copy download is a .json envelope', '.json', dl2.name, false);
    }
  } catch (e) {
    allErrors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  R('pageErrors', 'no uncaught page errors', '[]', JSON.stringify(allErrors), allErrors.length === 0);
  L.fs.writeFileSync(L.path.join(L.OUT, 'scen_A.json'), JSON.stringify({ results: L.results, snaps }, null, 2));
})();
