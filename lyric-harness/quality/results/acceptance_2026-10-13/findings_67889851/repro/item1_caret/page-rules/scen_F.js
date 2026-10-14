// Scenario F: other named places (endword, headrime, line, head on a
// leading-dash line), a mid-line numeral, and section duplicate / remove
// (the page's assembly) on carried and blocked members.
'use strict';
const X = require('./cand_lib.js');
const { L, C, U } = X;
const snaps = {};
const LY2 = `[VERSE]
I play the double bass--
--and so it goes
I have 2 hearts
Run--run away to the sea

[CHORUS]
I walk the line tonight
Well-worn shoes upon the floor`;
const ROWS = ['[SETUP — rhyme groups — 1.endword,5;2.headrime,6.head;3,6.line;4.line,5.endword;1.T1,6.T1]'];

(async () => {
  const state = { root: L.WT_CAND };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const R = (id, claim, exp, obs, ok) => L.record('F.' + id, claim, exp, obs, ok);
  try {
    const sess = JSON.stringify({ version: 1, name: 'Untitled session', cards: [], lyrics: `${ROWS.join('\n')}\n\n${LY2}`, lyricMeta: { version: 1 } });
    const { ctx, page, q, errors: pe } = await X.boot(browser, base, { session: sess });
    let s = (snaps.load = await X.snap(page));
    const EXP = `[SETUP — rhyme groups — 1.endword ${C},5;2.headrime ${C},6.head;3 ${C},6.line;4.line ${C},5.endword;1.T1,6.T1 — cut v2]`;
    R('load.row', 'endword / headrime / end / line places on changed lines (dash end, leading dashes, mid-line numeral, earlier dash run) are kept named and carried; places on unchanged lines plain; 1.T1 (I) unchanged', EXP, s.rows[0], s.rows[0] === EXP);
    const notes = X.carriedIds(s).map((i) => `${i.title} :: ${(i.text.match(/shows “[^”]*” under the earlier cut and “[^”]*” under the current one/) || [''])[0]}`);
    snaps.notes = notes;
    R('load.notices', 'four notices with the words under each cut (bass--/bass; --and/and; heart-line words; Run--run… line)', '4 notices', JSON.stringify(notes), notes.length === 4 && notes.some((n) => /line 2 · first rhyme/.test(n) && /“--and” under the earlier cut and “and”/.test(n)) && notes.some((n) => /line 3 · last rhyme/.test(n) && /“hearts” under the earlier cut and “hearts”/.test(n)));
    // Section duplicate (assembly): the members keep their state and the mark.
    await page.evaluate(() => LY_ACTIONS['ly-tool']('form-story'));
    await page.click('[data-ui="ly-sec-dup"][data-id="0"]');
    await page.waitForTimeout(200);
    s = snaps.dup = await X.snap(page);
    R('dup.row', 'Duplicate section keeps the row (carried states, mark), renumbering the chorus lines 5,6 -> 9,10', `[SETUP — rhyme groups — 1.endword ${C},9;2.headrime ${C},10.head;3 ${C},10.line;4.line ${C},9.endword;1.T1,10.T1 — cut v2]`, s.rows[0], s.rows[0] === `[SETUP — rhyme groups — 1.endword ${C},9;2.headrime ${C},10.head;3 ${C},10.line;4.line ${C},9.endword;1.T1,10.T1 — cut v2]`);
    await X.undo(page);
    // Section remove: members on removed lines go, the rest keep state.
    await page.evaluate(() => LY_ACTIONS['ly-tool']('form-story'));
    await page.click('[data-ui="ly-sec-remove"][data-id="1"]');
    await page.waitForTimeout(300);
    const dlg = await page.evaluate(() => document.querySelector('dialog[open], .cm-modal.is-open, [role="dialog"]:not([hidden])')?.innerText || '');
    s = snaps.remove = await X.snap(page);
    R('remove.row', 'Remove the chorus: links that lose a member to the removal go (each had two), and nothing is laundered', 'no rhyme groups row left, or only links whose members all survive', JSON.stringify({ rows: s.rows, dialog: dlg.slice(0, 200), toasts: await L.toasts(page) }), !s.rows.some((r) => /rhyme groups/.test(r)) || s.rows.every((r) => !/rhyme groups/.test(r) || !/,[56]/.test(r)));
    await ctx.close();
    errors.push(...pe);
  } catch (e) {
    errors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  R('pageErrors', 'no uncaught page errors', '[]', JSON.stringify(errors), errors.length === 0);
  L.fs.writeFileSync(L.path.join(L.OUT, 'scen_F.json'), JSON.stringify({ results: L.results, snaps }, null, 2));
})();
