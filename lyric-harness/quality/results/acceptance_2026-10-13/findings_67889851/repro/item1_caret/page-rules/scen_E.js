// Scenario E: repeated-word readings and T<k> on the 'Oh--oh' and
// 'double bass--' lines, typed into the text area (the paste path), the
// "choose again" path, import-over-existing Undo/Redo, and the tool lists.
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
const OH = 'Oh--oh, oh my love';
const LEGACY = [
  '[SETUP — rhyme groups — 1.T2,7.T2;2.T5,6]',
  `[SETUP — reading — token 3 "love" in "${OH}" — L AH1 V — declared — source: me]`,
  `[SETUP — reading — token 2 "oh" in "${OH}" — needs a choice]`,
  `[SETUP — reading — token 4 "love" in "${OH}" — uncertain]`,
];

(async () => {
  const sessions = JSON.parse(L.fs.readFileSync(L.path.join(L.OUT, 'baseline_sessions.json'), 'utf8')).out;
  const state = { root: L.WT_CAND };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const R = (id, claim, exp, obs, ok) => L.record('E.' + id, claim, exp, obs, ok);
  try {
    const { ctx, page, q, errors: pe } = await X.boot(browser, base);
    // The paste path: the person's own input in the text area.
    await page.fill('#lyrics-draft', `${LEGACY.join('\n')}\n\n${LYRICS}`);
    await page.waitForTimeout(1500);
    const t0 = await L.toasts(page);
    let s = (snaps.paste = await X.snap(page));
    const EXP = [
      `[SETUP — rhyme groups — 1.T3,7.T2;2.T5 ${U},6 — cut v2]`,
      `[SETUP — reading — token 3 "love" in "${OH}" — L AH1 V — declared — source: me — needs a decision: numbered under the earlier word cut]`,
      `[SETUP — reading — token 3 "oh" in "${OH}" — needs a choice — cut v2]`,
      `[SETUP — reading — token 5 "love" in "${OH}" — uncertain — cut v2]`,
    ];
    R('paste.rows', 'typed/pasted legacy rows: 1.T2 (oh 8-10) -> 1.T3 not the v2 T2 (oh 4-6); 2.T5 (bass--) blocked; a reading whose old number named "my" not "love" blocked; needs-a-choice and uncertain readings rebound by span', EXP.join(' | '), s.rows.join(' | '), JSON.stringify(s.rows) === JSON.stringify(EXP));
    R('paste.toast', 'the paste migration is announced (error toast for the blocked ones, naming the renumbering)', 'error toast with renumbered list', JSON.stringify(t0), t0.some((x) => /need your decision/.test(x) && /renumbered/.test(x)));
    const t3 = await page.evaluate(() => lyMemberWord(LY.model, { line: 1, place: 'T3' }));
    const pieces = await page.evaluate((l) => CMLyricTokens.readerLine(l, { stripParens: true }).tokens[2].pieces, OH);
    R('paste.T3', '1.T3 names the standalone "oh" at characters 8-10', 'oh [[8,10]]', JSON.stringify([t3, pieces]), t3 === 'oh' && JSON.stringify(pieces) === '[[8,10]]');
    // Undo after the paste migration never returns to the unmarked numbers.
    const histBefore = await page.evaluate(() => app.history.map((h) => JSON.parse(h).lyrics.split('\n')[0]));
    snaps.historyFirstRows = histBefore;
    R('paste.history', 'no Undo step holds the unmarked (earlier-cut) rhyme row', 'no history entry with "[SETUP — rhyme groups — 1.T2,7.T2;2.T5,6]"', JSON.stringify(histBefore), !histBefore.includes(LEGACY[0]));
    // Tool lists: what the Rhymes tool shows for each member.
    await page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
    const rhymesList = await page.evaluate(() => document.querySelector('.ly-links')?.innerText || '');
    snaps.rhymesList = rhymesList;
    R('tool.rhymesList', 'the Rhymes tool shows the blocked member as blocked (not as a word)', 'list contains "(numbered under the earlier cut)"', rhymesList, /numbered under the earlier cut/.test(rhymesList));
    // Choose the reading again for v2 word 5 "love": the blocked reading is superseded.
    await page.evaluate(() => LY_ACTIONS['ly-tool']('pronunciation'));
    await page.evaluate((k) => LY_ACTIONS['ly-reading-pick'](k), JSON.stringify([OH, 5, 'love']));
    await page.evaluate(() => LY_ACTIONS['ly-reading-kind']('declared'));
    await page.fill('#ly-phones', 'L AH1 V');
    await page.fill('#ly-source', 'me');
    await page.click('[data-ui="ly-draft-apply"][data-id="pronunciation"]');
    await page.waitForTimeout(300);
    s = snaps.chooseAgain = await X.snap(page);
    const readRows = s.rows.filter((r) => /reading/.test(r));
    R('chooseAgain', 'choosing "love" again (v2 word 5) replaces the blocked reading; the others stay', 'no "needs a decision" reading; a token 5 "love" declared row marked cut v2', JSON.stringify(readRows), !readRows.some((r) => /needs a decision/.test(r)) && readRows.some((r) => /token 5 "love" .*L AH1 V — declared — source: me — cut v2\]$/.test(r)));
    await ctx.close();
    errors.push(...pe);

    // Import over an existing draft, then Undo / Redo.
    const b = await X.boot(browser, base);
    await L.setDraft(b.page, `[SETUP — rhyme groups — 5,6 — cut v2]\n\n${LYRICS}`);
    const prior = await L.draftOf(b.page);
    await X.importFile(b.page, 'old-song.txt', sessions.A.text);
    const sImp = await X.snap(b.page);
    R('import.migrated', 'a pre-release .txt imported over a current draft is migrated at once', 'first row 1.T5,8;3 (carried…)…', sImp.rows[0], sImp.rows[0].startsWith(`[SETUP — rhyme groups — 1.T5,8;3 ${C}`));
    await X.undo(b.page);
    const u = await L.draftOf(b.page);
    R('import.undo', 'Undo returns to the draft before the import', 'previous draft', u === prior ? 'previous draft' : u.slice(0, 200), u === prior);
    await X.redo(b.page);
    const r2 = await X.snap(b.page);
    R('import.redo', 'Redo returns the migrated import (never the unmarked earlier-cut rows)', JSON.stringify(sImp.rows), JSON.stringify(r2.rows), JSON.stringify(r2.rows) === JSON.stringify(sImp.rows));
    // The Rhymes / Repeats tool lists for a carried member.
    await b.page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
    const rl = await b.page.evaluate(() => document.querySelector('.ly-links')?.innerText || '');
    await b.page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
    const rp = await b.page.evaluate(() => [...document.querySelectorAll('.ly-plain')].map((e) => e.innerText).join(' / '));
    snaps.toolLists = { rhymes: rl, repeats: rp };
    R('tool.carriedShown', 'the Rhymes / Repeats tool lists show a carried member\'s state (informational)', 'list mentions "carried"', JSON.stringify(snaps.toolLists), /carried/.test(rl) && /carried/.test(rp));
    // Remove another (non-carried) link from the Rhymes tool: the carried states stay.
    await b.page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
    await b.page.check('input[name="ly-link-group"][value="0"]');
    await b.page.click('[data-ui="ly-link-remove"]');
    await b.page.waitForTimeout(200);
    const sRm = await X.snap(b.page);
    R('tool.linkRemove', 'Remove link (first link, 1.T5,8) in the Rhymes tool leaves the other members\' carried states and the mark', `[SETUP — rhyme groups — 3 ${C},5;2 ${C},6;4 ${C},7 — cut v2]`, sRm.rows[0], sRm.rows[0] === `[SETUP — rhyme groups — 3 ${C},5;2 ${C},6;4 ${C},7 — cut v2]`);
    await b.ctx.close();
    errors.push(...b.errors);
  } catch (e) {
    errors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  R('pageErrors', 'no uncaught page errors', '[]', JSON.stringify(errors), errors.length === 0);
  L.fs.writeFileSync(L.path.join(L.OUT, 'scen_E.json'), JSON.stringify({ results: L.results, snaps }, null, 2));
})();
