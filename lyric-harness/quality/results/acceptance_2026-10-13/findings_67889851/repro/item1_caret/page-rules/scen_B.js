// Scenarios B (unrebindable -> blocked), C (unchanged lines), D (unknown
// marker cut v9), on the candidate page.
'use strict';
const X = require('./cand_lib.js');
const { L, C, U } = X;
const snaps = {};

const LYRICS = `[VERSE]
Oh--oh, oh my love
I play the double bass--
Run--run away to the sea
You hold my heart.    10

[CHORUS]
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh
Love above`;

(async () => {
  const sessions = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'baseline_sessions.json'), 'utf8')).out;
  const state = { root: L.WT_CAND };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const allErrors = [];
  const blockedNow = async (page, q, tag, R) => {
    const send = await X.runReview(page, q);
    const typed = await X.typedSend(page, q);
    R(`${tag}.sendBlocked`, 'Run review and a typed lyrics-edit request are both refused while blocked; nothing reaches /chat', '0 calls, toast "Nothing was sent", typed reason=declarations', JSON.stringify({ calls: send.calls.length, toasts: send.toasts, typed: typed.out, typedReached: typed.reached }), send.calls.length === 0 && typed.reached === 0 && send.toasts.some((t) => /Nothing was sent/.test(t)) && typed.out?.reason === 'declarations');
    return { send, typed };
  };
  try {
    // ── B: unrebindable members and reading ──
    {
      const R = (id, claim, exp, obs, ok) => L.record('B.' + id, claim, exp, obs, ok);
      const { ctx, page, q, errors } = await X.boot(browser, base, { session: sessions.B.localStorage });
      const t0 = await L.toasts(page);
      let s = (snaps.B_load = await X.snap(page));
      const EG = `[SETUP — rhyme groups — 1.T1 ${U},8;5.T2,6.T2 — cut v2]`;
      const ER = `[SETUP — returns — 1.T1 ${U},7.T1 — cut v2]`;
      const EP = '[SETUP — reading — token 1 "Oh--oh" in "Oh--oh, oh my love" — OW1 OW1 — declared — source: the singer — needs a decision: numbered under the earlier word cut]';
      R('load.rows', '1.T1 ("Oh--oh", no v2 word covers 0-6) is kept under its old number and blocks; the reading is flagged; 5.T2/6.T2 unchanged', [EG, ER, EP].join(' | '), s.rows.join(' | '), JSON.stringify(s.rows) === JSON.stringify([EG, ER, EP]));
      R('load.toast', 'an error toast says a saved number needs a decision', 'error toast', JSON.stringify(t0), t0.some((t) => /needs? your decision/.test(t)));
      R('load.decl', 'declarations keep the blocked links out of what binds and carry them as need_decision', 'groups=5.T2,6.T2; groups_need_decision, returns_need_decision, readings_need_decision present', JSON.stringify(s.decl), s.decl.groups === '5.T2,6.T2' && !s.decl.returns && !!s.decl.groups_need_decision && !!s.decl.returns_need_decision && !!s.decl.readings_need_decision);
      const inputs = s.items.filter((i) => i.tone === 'input').map((i) => i.title);
      R('load.review', 'Review shows input notices for the reading, the rhyme link and the return', '3 input notices', JSON.stringify(inputs), inputs.length === 3);
      await page.screenshot({ path: L.path.join(L.OUT, 'B_review.png') });
      await blockedNow(page, q, 'load', R);
      // reorder
      await X.moveSection(page, 0, 1);
      s = snaps.B_reorder = await X.snap(page);
      R('reorder.rows', 'reorder renumbers lines and keeps the blocked state', `5.T1 ${U},4;1.T2,2.T2 | 5.T1 ${U},3.T1`, s.rows.slice(0, 2).join(' | '), s.rows[0] === `[SETUP — rhyme groups — 5.T1 ${U},4;1.T2,2.T2 — cut v2]` && s.rows[1] === `[SETUP — returns — 5.T1 ${U},3.T1 — cut v2]`);
      await blockedNow(page, q, 'reorder', R);
      await X.undo(page);
      s = await X.snap(page);
      R('reorder.undo', 'Undo of reorder restores blocked rows', EG, s.rows[0], s.rows[0] === EG && s.rows[1] === ER);
      // rhymes form + repeats form
      await X.addLinkUI(page, [[6, 'end'], [8, 'end']]);
      await X.addPlacedUI(page, [[6, 'head'], [7, 'head']]);
      s = snaps.B_forms = await X.snap(page);
      R('forms.rows', 'adding a link and a placed return through the forms keeps the blocked members', `1.T1 ${U},8;5.T2,6.T2;6,8 | 1.T1 ${U},7.T1;6.head,7.head`, s.rows.slice(0, 2).join(' | '), s.rows[0] === `[SETUP — rhyme groups — 1.T1 ${U},8;5.T2,6.T2;6,8 — cut v2]` && s.rows[1] === `[SETUP — returns — 1.T1 ${U},7.T1;6.head,7.head — cut v2]`);
      await blockedNow(page, q, 'forms', R);
      await X.undo(page);
      await X.undo(page);
      s = await X.snap(page);
      R('undo', 'Undo twice restores the original blocked rows', [EG, ER].join(' | '), s.rows.slice(0, 2).join(' | '), s.rows[0] === EG && s.rows[1] === ER);
      await X.redo(page);
      s = await X.snap(page);
      R('redo', 'Redo re-applies the rhymes edit with the blocked member', `1.T1 ${U},8;5.T2,6.T2;6,8`, s.rows[0], s.rows[0] === `[SETUP — rhyme groups — 1.T1 ${U},8;5.T2,6.T2;6,8 — cut v2]`);
      await X.undo(page);
      // reload
      const before = (await X.snap(page)).text;
      await X.reload(page);
      s = snaps.B_reload = await X.snap(page);
      R('reload', 'reload reopens the same blocked text', 'identical', s.text === before ? 'identical' : s.text, s.text === before);
      await blockedNow(page, q, 'reload', R);
      // export / import
      const dl = await X.downloadText(page);
      R('export', 'Download text holds the blocked markers', 'body == draft', dl.body === s.text ? 'equal' : dl.body.slice(0, 300), dl.body === s.text);
      await ctx.close();
      allErrors.push(...errors);
      const b = await X.boot(browser, base);
      await X.importFile(b.page, dl.name, dl.body);
      const s2 = await X.snap(b.page);
      R('import', 'Import in a fresh browser gives the same blocked rows', JSON.stringify(s.rows), JSON.stringify(s2.rows), JSON.stringify(s2.rows) === JSON.stringify(s.rows));
      await blockedNow(b.page, b.q, 'import', R);
      // Remove the link (ly-drop-undecided): wording of the toast.
      const tA = await L.toasts(b.page);
      await b.page.evaluate(() => LY_ACTIONS['ly-drop-undecided']('rhyme groups'));
      await b.page.waitForTimeout(200);
      const tB = await L.toasts(b.page);
      const s3 = await X.snap(b.page);
      snaps.B_drop = { toasts: tB, rows: s3.rows };
      R('drop.row', 'Remove the link removes only the link holding the blocked member', '[SETUP — rhyme groups — 5.T2,6.T2 — cut v2]', s3.rows[0], s3.rows[0] === '[SETUP — rhyme groups — 5.T2,6.T2 — cut v2]');
      R('drop.wording', 'the removal message does not claim the row was provably created before the release (policy 6)', 'no "saved before this release"', JSON.stringify(tB), !tB.some((t) => /saved before this release/.test(t)));
      // Choose the reading again for the v2 word "Oh" (token 1): the undecided one is superseded.
      await b.ctx.close();
      allErrors.push(...b.errors);
    }
    // ── C: only unchanged lines (named places), plus T<k> on unchanged lines ──
    {
      const R = (id, claim, exp, obs, ok) => L.record('C.' + id, claim, exp, obs, ok);
      const { ctx, page, q, errors } = await X.boot(browser, base, { session: sessions.C.localStorage });
      const t0 = await L.toasts(page);
      const s = (snaps.C_load = await X.snap(page));
      const orig = sessions.C.text.split('\n').filter((r) => /^\[SETUP/.test(r));
      R('load.namedRow', 'a row of named places on unchanged lines is carried with NO notice and left byte-identical', orig[0], s.rows[0], s.rows[0] === orig[0] && X.carriedIds(s).length === 0);
      R('load.numberedRow', 'a T<k>-only row whose binding did not change: byte-identical? (invariant: unchanged choices byte-identical)', orig[1], s.rows[1], s.rows[1] === orig[1]);
      R('load.toast', 'no migration toast for rows whose binding did not change', 'no toast', JSON.stringify(t0), t0.length === 0);
      const send = await X.runReview(page, q);
      R('send', 'nothing blocks; groups/returns sent as declared', 'groups=5,6;7.head,8 returns=5.T2,6.T2', JSON.stringify(send.calls.map((c) => [c?.groups, c?.returns])), send.calls.length === 1 && send.calls[0].groups === '5,6;7.head,8' && send.calls[0].returns === '5.T2,6.T2');
      // a reading on a repeated word on an unchanged line
      await X.L.setDraft(page, `[SETUP — reading — token 5 "oh" in "Oh, oh, I said oh" — OW1 — declared — source: the singer]\n\n${LYRICS}`);
      const s2 = await X.snap(page);
      R('reading.unchanged', 'a reading on an unchanged line keeps token 5 (binding unchanged); byte-identical?', '[SETUP — reading — token 5 "oh" in "Oh, oh, I said oh" — OW1 — declared — source: the singer]', s2.rows[0], s2.rows[0] === '[SETUP — reading — token 5 "oh" in "Oh, oh, I said oh" — OW1 — declared — source: the singer]');
      await ctx.close();
      allErrors.push(...errors);
    }
    // ── D: unknown marker cut v9 ──
    {
      const R = (id, claim, exp, obs, ok) => L.record('D.' + id, claim, exp, obs, ok);
      const rows = [
        '[SETUP — rhyme groups — 5,6 — cut v9]',
        '[SETUP — returns — 5.T2,6.T2 — cut v9]',
        '[SETUP — reading — token 2 "walk" in "I walk the line tonight" — W AO1 K — declared — source: me — cut v9]',
      ];
      const text = `${rows.join('\n')}\n\n${LYRICS}`;
      const sess = JSON.stringify({ version: 1, name: 'Untitled session', cards: [], lyrics: text, lyricMeta: { version: 1 } });
      const { ctx, page, q, errors } = await X.boot(browser, base, { session: sess });
      let s = (snaps.D_load = await X.snap(page));
      R('load.rows', 'rows marked cut v9 are left exactly as they are (never rewritten as v2)', rows.join(' | '), s.rows.join(' | '), JSON.stringify(s.rows) === JSON.stringify(rows));
      const inputs = s.items.filter((i) => i.tone === 'input');
      R('load.review', 'Review: input notices naming cut v9 and the accepted value "cut v2"', '3 input notices, each naming v9 and “cut v2”', JSON.stringify(inputs.map((i) => i.text)), inputs.length === 3 && inputs.every((i) => /v9/.test(i.text) && /“cut v2”/.test(i.text)));
      R('load.decl', 'no v9 row binds: groups/returns/pronunciations absent, need_decision present', 'need_decision only', JSON.stringify(s.decl), !s.decl.groups && !s.decl.returns && !s.decl.pronunciations && !!s.decl.groups_need_decision && !!s.decl.returns_need_decision && !!s.decl.readings_need_decision);
      const send = await X.runReview(page, q);
      R('send', 'send blocked with a message naming the accepted value', '0 calls; toast names “cut v2”', JSON.stringify({ calls: send.calls.length, toasts: send.toasts }), send.calls.length === 0 && send.toasts.some((t) => /“cut v2”/.test(t)));
      // reorder
      await X.moveSection(page, 0, 1);
      s = snaps.D_reorder = await X.snap(page);
      R('reorder', 'reorder renumbers lines but keeps cut v9 (not laundered into v2)', '[SETUP — rhyme groups — 1,2 — cut v9] | [SETUP — returns — 1.T2,2.T2 — cut v9]', s.rows.slice(0, 2).join(' | '), s.rows[0] === '[SETUP — rhyme groups — 1,2 — cut v9]' && s.rows[1] === '[SETUP — returns — 1.T2,2.T2 — cut v9]');
      await X.undo(page);
      // rhymes form add -> v9 members must not become v2-bound
      await X.addLinkUI(page, [[7, 'end'], [8, 'end']]);
      s = snaps.D_form = await X.snap(page);
      R('rhymesForm', 'adding a link through the Rhymes form keeps the v9 members unbound (marked) and still blocks', 'v9 members written as “(marked cut v9: not read here)”', s.rows[0], /5 \(marked cut v9: not read here\),6 \(marked cut v9: not read here\);7,8 — cut v2\]$/.test(s.rows[0]));
      const send2 = await X.runReview(page, q);
      R('rhymesForm.send', 'still blocked after the form edit', '0 calls', JSON.stringify({ calls: send2.calls.length, toasts: send2.toasts }), send2.calls.length === 0);
      // reload + export/import
      const before = s.text;
      await X.reload(page);
      s = await X.snap(page);
      R('reload', 'reload keeps the v9 state', 'identical', s.text === before ? 'identical' : s.text, s.text === before);
      const dl = await X.downloadText(page);
      await ctx.close();
      allErrors.push(...errors);
      const b = await X.boot(browser, base);
      await X.importFile(b.page, dl.name, dl.body);
      const s2 = await X.snap(b.page);
      R('import', 'export/import keeps the v9 state', JSON.stringify(s.rows), JSON.stringify(s2.rows), JSON.stringify(s2.rows) === JSON.stringify(s.rows));
      // the removal wording on a v9 (not pre-release) row
      await L.toasts(b.page);
      await b.page.evaluate(() => LY_ACTIONS['ly-drop-undecided']('returns'));
      await b.page.waitForTimeout(200);
      const tB = await L.toasts(b.page);
      snaps.D_drop = tB;
      R('drop.wording', 'removing a v9-marked return does not call it "saved before this release" (policy 6)', 'no "saved before this release"', JSON.stringify(tB), !tB.some((t) => /saved before this release/.test(t)));
      await b.ctx.close();
      allErrors.push(...b.errors);
    }
  } catch (e) {
    allErrors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  L.record('BCD.pageErrors', 'no uncaught page errors', '[]', JSON.stringify(allErrors), allErrors.length === 0);
  L.fs.writeFileSync(L.path.join(L.OUT, 'scen_B.json'), JSON.stringify({ results: L.results, snaps }, null, 2));
})();
