// Scenario H: a person TYPES an unmarked row today, key by key, in the text
// area of a current draft; what the page does with it and with the caret.
'use strict';
const X = require('./cand_lib.js');
const { L, C } = X;
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
  const state = { root: L.WT_CAND };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const R = (id, claim, exp, obs, ok) => L.record('H.' + id, claim, exp, obs, ok);
  try {
    const { ctx, page } = await X.boot(browser, base);
    await L.setDraft(page, `\n${LYRICS}`);
    await page.click('#lyrics-draft');
    await page.evaluate(() => {
      const d = $ui('lyrics-draft');
      d.focus();
      d.setSelectionRange(0, 0);
    });
    // Typed today, meaning the CURRENT cut's word 4 of line 1 ("my").
    await page.keyboard.type('[SETUP — rhyme groups — 1.T4,8]', { delay: 30 });
    await page.waitForTimeout(1500);
    const mid = await page.evaluate(() => ({ text: $ui('lyrics-draft').value.split('\n')[0], caret: $ui('lyrics-draft').selectionStart }));
    await page.keyboard.type('Z', { delay: 30 });
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => {
      const t = $ui('lyrics-draft').value;
      return { first: t.split('\n')[0], zAt: t.indexOf('Z'), len: t.length, lineOfZ: t.slice(0, t.indexOf('Z')).split('\n').length };
    });
    snaps.typed = { mid, after, toasts: await L.toasts(page) };
    R('typed.today', 'an unmarked T<k> row typed today is read as the earlier cut (policy: unmarked = legacy) and renumbered, with a toast', 'row becomes 1.T5,8 — cut v2 (love), toast says renumbered', JSON.stringify(snaps.typed), /1\.T5,8 — cut v2\]$/.test(mid.text));
    R('typed.caret', 'the rewrite does not move the caret away from where the person is typing', 'Z typed right after the row (line 1)', JSON.stringify(after), after.lineOfZ === 1);
    await ctx.close();
  } catch (e) {
    errors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  R('pageErrors', 'no uncaught page errors', '[]', JSON.stringify(errors), errors.length === 0);
  L.fs.writeFileSync(L.path.join(L.OUT, process.env.OUTJSON || 'scen_H.json'), JSON.stringify({ results: L.results, snaps }, null, 2));
})();
