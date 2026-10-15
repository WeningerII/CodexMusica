// check-order-marker extras: APP history (the page's Undo/Redo stack) vs
// BROWSER-NATIVE undo (Ctrl+Z inside the textarea), and commits that do not
// rewrite the group row. Row RG4 = '[SETUP — rhyme groups — 1.T4,8; 2,3]', pasted by real Ctrl+V.
// Usage: node extras.js <cand|c61b|main> [filter]
'use strict';
const C = require('./com.js');
const TREE = process.argv[2] || 'cand';
const FILTER = process.argv[3] || '';
const BODY = ['[VERSE]', 'Oh--oh, oh my love', 'I walk the line tonight', 'I hold you tight', 'Well-worn shoes upon the floor', 'The rain comes down', 'I hear the sound', 'The night is cold', 'Love above', '', '[BRIDGE]', 'Go slow', 'Hold on', '', '[BRIDGE]', 'Go slow', 'Hold on'].join('\n');
const ROW = '[SETUP — rhyme groups — 1.T4,8; 2,3]';
const setupRows = (t) => t.split('\n').filter((l) => /^\[SETUP/.test(l));
async function removeB(page) {
  await C.openTool(page, 'rhymes');
  await page.locator('input[name="ly-link-group"][value="1"]').check();
  await page.waitForTimeout(200);
  await page.locator('[data-ui="ly-link-remove"]').click();
  await page.waitForTimeout(400);
}
async function appUndoToast(page) {
  // the commit toast's own Undo button (lyCommit: run -> #btn-undo click -> app undo())
  await page.locator('#toast button:has-text("Undo")').first().click();
  await page.waitForTimeout(400);
}
async function blurAndKey(page, combo) {
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press(combo); // target = body -> app.js global handler (APP history)
  await page.waitForTimeout(400);
}
async function review(page, q) {
  const n = q.calls.length;
  await page.locator('.ly-run').first().click();
  await C.idle(page);
  return q.calls.slice(n).map((c) => c.lyric_context && c.lyric_context.declarations);
}
const SC = {
  async X1_appUndo_toastButton(page, q, log) {
    await removeB(page); await log('after Remove link');
    await appUndoToast(page); await log('after APP Undo (toast Undo button)');
    return review(page, q);
  },
  async X1k_appUndo_globalCtrlZ(page, q, log) {
    await removeB(page); await log('after Remove link');
    await blurAndKey(page, 'Control+z'); await log('after APP Undo (Ctrl+Z, focus off textarea)');
    return review(page, q);
  },
  async X2_appRedo(page, q, log) {
    await removeB(page); await log('after Remove link');
    await appUndoToast(page); await log('after APP Undo (toast)');
    await blurAndKey(page, 'Control+Shift+z'); await log('after APP Redo (Ctrl+Shift+Z, focus off textarea)');
    return review(page, q);
  },
  async X3_nativeUndo_afterForm(page, q, log) {
    await removeB(page); await log('after Remove link');
    await page.locator('#lyrics-draft').click();
    await page.keyboard.press('Control+z'); await log('after BROWSER-NATIVE Ctrl+Z #1 (in textarea)');
    await page.keyboard.press('Control+z'); await log('after BROWSER-NATIVE Ctrl+Z #2 (in textarea)');
    return review(page, q);
  },
  async X3s_nativeUndo_sanity_noForm(page, q, log) {
    await page.locator('#lyrics-draft').click();
    await page.keyboard.press('Control+z'); await log('after BROWSER-NATIVE Ctrl+Z #1, no form commit (sanity: does native undo work here?)');
    return review(page, q);
  },
  async X4_wordRules(page, q, log) {
    await C.openTool(page, 'word-rules');
    await page.locator('#ly-require-new').fill('rain');
    await page.locator('[data-ui="ly-word-add"][data-id="require"]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-ui="ly-draft-apply"][data-id="word-rules"]').first().click();
    await page.waitForTimeout(400); await log('after Word rules Apply (require "rain")');
    return review(page, q);
  },
  async X5_relationOnly(page, q, log) {
    await C.openTool(page, 'rhymes');
    await page.locator('[data-ui="ly-relation"][data-id="class:RHYME"]').click();
    await page.waitForTimeout(250);
    // the pending strip's Apply (the form's first ly-draft-apply is "Link endings", disabled with <2 members)
    await page.locator('#ly-pending-rhymes [data-ui="ly-draft-apply"]').click();
    await page.waitForTimeout(400); await log('after Rhymes relation-only Apply (class:RHYME)');
    return review(page, q);
  },
  async X9_sectionMove(page, q, log) {
    await C.openTool(page, 'form-story');
    await page.locator('[data-ui="ly-sec-move"][data-id="0:1"]').click();
    await page.waitForTimeout(400); await log('after Form & story: Verse Move down');
    return review(page, q);
  },
};
(async () => {
  const { server, base } = await C.startServer(TREE);
  const browser = await C.launch();
  const out = [];
  try {
    for (const [id, fn] of Object.entries(SC)) {
      if (FILTER && !id.includes(FILTER)) continue;
      const { ctx, page, q, errors } = await C.boot(browser, base);
      const steps = [];
      const log = async (label) => {
        const t = await C.draftText(page);
        const h = await C.hist(page);
        steps.push({ step: label, setup: setupRows(t), toasts: await C.toasts(page), histIdx: h.idx, histN: h.n, histSetup: h.lyrics.map((x) => setupRows(x || '').join(' | ')) });
      };
      const r = { id: `${TREE}.${id}`, steps };
      try {
        await C.enterBody(page, BODY);
        await C.toasts(page);
        await C.insertAtTop(page, `${ROW}\n\n`, 'paste');
        await log('after paste (real Ctrl+V)');
        r.payload = await fn(page, q, log);
        await log('after Run review');
        r.sung = await page.evaluate(() => lyParse($ui('lyrics-draft').value).sung.map((s) => s.text));
      } catch (e) {
        r.threw = String(e.stack || e);
      }
      r.errors = errors;
      out.push(r);
      console.log(`${r.id}\n${steps.map((s) => `   ${s.step}: ${s.setup.join(' | ') || '(no SETUP row)'}  [hist ${s.histIdx}/${s.histN}] toasts=${JSON.stringify(s.toasts)}`).join('\n')}\n   payload=${JSON.stringify(r.payload)}${r.threw ? '\n   THREW ' + r.threw.split('\n')[0] : ''} errs=${errors.length}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  C.fs.writeFileSync(C.path.join(C.OUT, `extras_${TREE}${FILTER ? '_' + FILTER : ''}.json`), JSON.stringify(out, null, 1));
})().catch((e) => (console.error(e), process.exit(1)));
