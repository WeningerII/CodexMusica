// Side effect of "boundaries only": between boundaries an unmarked row typed
// or pasted by hand stays in the draft. What does a Rhymes form commit do to
// it before the next boundary? (lySetSetup marks every rhyme groups row it
// writes with `— cut v2`.) Paths, from the same unmarked row:
//   A. Run review at once (the boundary migrates it);
//   B. Remove another link with the Rhymes tool, then Run review;
//   C. Add a link with the Rhymes tool, then Run review.
// Recorded: the row after each step, the word the Declared links list shows
// for 1.T4, and what reaches /chat. Main is the control.
// Usage: node e_form_mark.js <cand|main>
'use strict';
const L = require('./f1lib.js');
const TREE = process.argv[2] || 'cand';
const BODY = `[VERSE]
Oh--oh, oh my love
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh

[CHORUS]
We're sailing on
I hold the dove
Run to the sea
Love above`;
const ROW = '[SETUP — rhyme groups — 1.T4,8; 2,3]';
const DOC = `${ROW}\n\n${BODY}`;
const linksShown = (page) =>
  page.evaluate(() => {
    LY_ACTIONS['ly-tool']('rhymes');
    lyRefresh(true);
    return [...document.querySelectorAll('.ly-links li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim());
  });
const rowOf = (page) => page.evaluate(() => $ui('lyrics-draft').value.split('\n').filter((r) => /^\[SETUP/.test(r)));
async function review(page, q) {
  const n = q.calls.length;
  await page.evaluate(() => { LY_ACTIONS['ly-run-review'](); });
  await L.waitIdle(page);
  return { sent: q.calls.slice(n).map((c) => c.lyric_context?.declarations ?? null), rows: await rowOf(page), toasts: await L.toasts(page) };
}
(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const out = { tree: TREE, DOC, paths: {} };
  try {
    for (const path of ['A_review', 'B_remove_other_link', 'C_add_link']) {
      const { ctx, page, q, errors } = await L.boot(browser, base);
      const r = {};
      try {
        await L.setDraft(page, DOC);
        await page.waitForTimeout(300);
        r.shownBefore = await linksShown(page);
        r.rowsBefore = await rowOf(page);
        if (path === 'B_remove_other_link') {
          await page.check('input[name="ly-link-group"][value="1"]');
          await page.waitForTimeout(200);
          await page.click('[data-ui="ly-link-remove"]');
          await page.waitForTimeout(300);
        } else if (path === 'C_add_link') {
          for (const n of ['5', '7']) {
            await page.selectOption('#ly-link-line', n);
            await page.waitForTimeout(100);
            await page.selectOption('#ly-link-place', 'end');
            await page.click('[data-ui="ly-link-add"]');
            await page.waitForTimeout(150);
          }
          await page.click('[data-ui="ly-draft-apply"][data-id="rhymes"]');
          await page.waitForTimeout(300);
        }
        r.rowsAfterForm = await rowOf(page);
        r.shownAfterForm = await linksShown(page);
        r.formToasts = await L.toasts(page);
        r.review = await review(page, q);
        r.shownAfterReview = await linksShown(page);
        r.errors = errors;
      } catch (x) {
        r.threw = String(x.stack || x);
      }
      out.paths[path] = r;
      console.log(`[${TREE}] ${path}:\n   rows before    ${JSON.stringify(r.rowsBefore)}\n   shown before   ${JSON.stringify(r.shownBefore)}\n   rows after form ${JSON.stringify(r.rowsAfterForm)}\n   shown after form ${JSON.stringify(r.shownAfterForm)}\n   review sent   ${JSON.stringify(r.review?.sent)}\n   rows after review ${JSON.stringify(r.review?.rows)}\n   shown after review ${JSON.stringify(r.shownAfterReview)}\n   toasts ${JSON.stringify([...(r.formToasts || []), ...(r.review?.toasts || [])])}${r.threw ? '\n   THREW ' + r.threw : ''}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `e_form_mark_${TREE}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
