// X1 follow-on: an unrecognised note on a legacy T member, beside a member the
// migration touches. Then the writer removes the note (edits the row text).
// What word does 1.T4 name before (main / v1 cut) and after (candidate)?
'use strict';
const V = require('./vlib.js');
const ROWS = {
  annotated: '[SETUP — rhyme groups — 1.T4 (kept),8.T4]',
  plain: '[SETUP — rhyme groups — 1.T4,8.T4]',
};
async function words(page) {
  return page.evaluate(() => {
    lyRefresh(true);
    const text = $ui('lyrics-draft').value;
    const m = lyParse(text);
    const row = m.setup.find((s) => s.key === 'rhyme groups');
    const groups = lyParseGroups(row.value);
    return {
      row: text.split('\n').find((r) => r.includes('— rhyme groups —')),
      members: groups.flat().map((x) => ({ raw: x.raw, bad: !!x.bad, undecided: !!x.undecided, word: x.bad ? null : lyMemberWord(m, x) })),
      sent: lyDeclarationsOf(m).groups ?? null,
      need: lyDeclarationsOf(m).groups_need_decision ?? null,
      line1_v2: lyTokens('Oh--oh, oh my love', false),
      line1_v1: typeof lyV1MigrationTokens === 'function' ? lyV1MigrationTokens('Oh--oh, oh my love', false) : null,
    };
  });
}
async function edit(page, from, to) {
  await page.evaluate(([from, to]) => {
    const el = $ui('lyrics-draft');
    el.value = el.value.replace(from, to);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    lyRefresh(true);
  }, [from, to]);
  await page.waitForTimeout(300);
}
(async () => {
  const browser = await V.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const out = {};
  for (const tree of ['main', 'cand']) {
    const server = V.serve(V.TREES[tree]);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const [k, row] of Object.entries(ROWS)) {
      const b = await V.boot(browser, base, `${row}\n\n${V.SONG}`);
      const loaded = await words(b.page);
      let edited = null;
      if (k === 'annotated') {
        await edit(b.page, '1.T4 (kept)', '1.T4');
        edited = await words(b.page);
      }
      const rec = { loaded, edited, toasts: await b.page.evaluate(() => window.__toasts.splice(0)), errors: b.errors };
      out[`${tree}:${k}`] = rec;
      console.log(`[${tree}] ${k}\n  loaded: ${loaded.row}\n          ${JSON.stringify(loaded.members)} sent=${JSON.stringify(loaded.sent)} need=${JSON.stringify(loaded.need)}\n          line1 v2-cut=${JSON.stringify(loaded.line1_v2)} v1-cut=${JSON.stringify(loaded.line1_v1)}`);
      if (edited) console.log(`  after removing " (kept)": ${edited.row}\n          ${JSON.stringify(edited.members)} sent=${JSON.stringify(edited.sent)}`);
      console.log(`  toasts: ${JSON.stringify(rec.toasts)} errors: ${JSON.stringify(b.errors)}`);
      await b.ctx.close();
    }
    server.close();
  }
  await browser.close();
  V.fs.writeFileSync(V.path.join(V.OUT, 'x1_followon.json'), JSON.stringify(out, null, 1));
})();
