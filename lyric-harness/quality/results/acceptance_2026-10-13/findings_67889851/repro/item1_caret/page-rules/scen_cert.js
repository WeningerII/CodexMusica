// A pre-batch draft certified on the BASELINE page, then the site is upgraded
// to the candidate under the same origin: does a row whose binding did not
// change keep the certification?
'use strict';
const X = require('./cand_lib.js');
const { L } = X;
const snaps = {};
const SUNG = ['I walk the line tonight', 'Well-worn shoes upon the floor', 'Oh, oh, I said oh', 'Love above'];
const body = `\n[CHORUS]\n${SUNG.join('\n')}`;
const variants = {
  named_only: `[SETUP — rhyme groups — 1,2]\n${body}`,
  numbered_unchanged: `[SETUP — returns — 1.T2,2.T2]\n${body}`,
  reading_unchanged: `[SETUP — reading — token 5 "oh" in "Oh, oh, I said oh" — OW1 — declared — source: the singer]\n${body}`,
};
const certified = () => ({
  reply: 'Finished.',
  history: [],
  sig: 'fixture',
  task: { domain: 'lyrics', phase: 'edit' },
  lyric: { standing: [], open: [] },
  artifact: { text: SUNG.join('\n'), final_draft: SUNG, status: 'finished', certified: true },
  completion: { certified: true },
  stopped: null,
  tools: [{ name: 'lyric_check', exit_code: 0 }],
});
const meta = (page) => page.evaluate(() => $ui('ly-badge').innerText.replace(/\s+/g, ' ') + ' | ' + (LY.run ? lyRunStatus(LY.run)?.word || '' : ''));

(async () => {
  const state = { root: L.WT_MAIN };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  try {
    for (const [name, text] of Object.entries(variants)) {
      state.root = L.WT_MAIN;
      const q = { replies: [], calls: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
      await page.goto(`${base}/codex.html#lyrics`);
      await L.waitReady(page);
      await L.setDraft(page, text);
      q.replies.push(certified());
      await page.evaluate(() => LY_ACTIONS['ly-run-review']());
      await page.waitForTimeout(500);
      await page.waitForFunction(() => !chatState.busy, null, { timeout: 20000 });
      await page.waitForTimeout(300);
      const m0 = await meta(page);
      const d0 = await L.draftOf(page);
      await page.reload();
      await L.waitReady(page);
      await page.waitForTimeout(400);
      const m1 = await meta(page);
      // The site is upgraded under the same origin.
      state.root = L.WT_CAND;
      await page.reload();
      await L.waitReady(page);
      await page.waitForTimeout(600);
      const m2 = await meta(page);
      const d2 = await L.draftOf(page);
      snaps[name] = { baselineAfterReview: m0, baselineAfterReload: m1, candidateAfterUpgrade: m2, rowsBefore: d0.split('\n').filter((r) => /^\[SETUP/.test(r)), rowsAfter: d2.split('\n').filter((r) => /^\[SETUP/.test(r)), toasts: await L.toasts(page) };
      const certifiedOnBase = /Certified for this version/.test(m1);
      L.record(
        `cert.${name}`,
        `a draft certified on the baseline (${name}) keeps "Certified for this version" after the upgrade when no binding changed`,
        'Certified for this version (as on the baseline after reload)',
        JSON.stringify(snaps[name]),
        certifiedOnBase ? /Certified for this version/.test(m2) : null
      );
      await ctx.close();
    }
  } catch (e) {
    errors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  L.record('cert.pageErrors', 'no uncaught page errors', '[]', JSON.stringify(errors), errors.length === 0);
  L.fs.writeFileSync(L.path.join(L.OUT, 'scen_cert.json'), JSON.stringify({ results: L.results, snaps }, null, 2));
})();
