// (d) Where the card sits once a review has run: Local checks is open only
// when there are no review items. A stubbed /chat reply (never a provider)
// gives the review one standing finding. Usage: node f_collapsed.js [cand]
'use strict';
const L = require('./lib');
const TREE = process.argv[2] || 'cand';
const OH = 'Oh--oh, oh my love';
const SONG = ['[SETUP — title — "Old Song"]', '[SETUP — returns — 1.T3,2.T3]', '', '[VERSE]', OH, OH, 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE };
  try {
    const q = { calls: [], replies: [] };
    const ctx = await L.newCtx(browser, q);
    const page = await L.open(ctx, url, errors);
    await L.importTxt(page, 'old.txt', SONG, 'Old Song');
    const draft = await L.draftOf(page);
    const before = await page.evaluate(() => {
      LY_ACTIONS['ly-tab']('review');
      lyRefresh(true);
      const d = document.querySelector('#ly-panel-review details.ly-local');
      return { open: !!(d && d.open), paneHasCard: /renumbered to the current word cut/.test($ui('ly-panel-review').innerText) };
    });
    q.replies.push({
      reply: 'Reviewed.',
      history: [],
      sig: 'fixture',
      task: { domain: 'lyrics', phase: 'edit' },
      lyric: { standing: ['L3: RHYME — line 3 does not rhyme with line 4 (plain / home)'], open: [] },
      artifact: { text: draft, final_draft: draft.split('\n'), status: 'unfinished', certified: false },
      completion: null,
      stopped: 'LYRICS_UNFINISHED',
      tools: [{ name: 'lyric_check', exit_code: 3 }],
    });
    await page.evaluate(() => LY_ACTIONS['ly-run-review']());
    await page.waitForFunction(() => !chatState.busy, null, { timeout: 30000 });
    await L.settle(page, 1200);
    const after = await page.evaluate(() => {
      LY_ACTIONS['ly-tab']('review');
      lyRefresh(true);
      const d = document.querySelector('#ly-panel-review details.ly-local');
      const runItems = (LY.items || []).filter((i) => i.source === 'run').length;
      return {
        open: !!(d && d.open),
        runItems,
        cardInItems: !!(LY.items || []).find((i) => i.id === 'renumbered'),
        paneHasCard: /renumbered to the current word cut/.test($ui('ly-panel-review').innerText),
      };
    });
    out.before = before;
    out.after = after;
    out.calls = q.calls.length;
    console.log(JSON.stringify(out));
    await page.screenshot({ path: L.path.join(L.OUT, `f_${TREE}_after_review.png`) });
    L.record(
      `${TREE}.f.visibleAfterReview`,
      'after a review has run, the renumbered card is still visible in Review without opening anything',
      'card text visible in the Review pane',
      after,
      after.paneHasCard
    );
    await ctx.close();
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, `f_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
