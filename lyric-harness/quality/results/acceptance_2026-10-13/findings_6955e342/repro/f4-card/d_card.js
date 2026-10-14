// (d) The card as a person sees it: wording, placement, frozen line numbers
// after an edit, Dismiss (toast? Undo?). Usage: node d_card.js [cand]
'use strict';
const L = require('./lib');
const TREE = process.argv[2] || 'cand';
const OH = 'Oh--oh, oh my love';
const DOVE = 'You are the one I dream of my dove';
const SONG = [
  '[SETUP — title — "Old Song"]',
  `[SETUP — reading — token 2 "oh" in ${JSON.stringify(OH)} — OW1 — declared — source: me]`,
  '[SETUP — rhyme groups — 1.T4,2]',
  '[SETUP — returns — 1.T3,3.T3]',
  '',
  '[VERSE]',
  OH,
  DOVE,
  OH,
].join('\n');
async function cardShot(page, file) {
  await page.evaluate(() => {
    LY_ACTIONS['ly-tab']('review');
    lyRefresh(true);
  });
  const li = page.locator('#ly-panel-review li.ly-item', { hasText: 'renumbered to the current word cut' }).first();
  if (!(await li.count())) return null;
  await li.scrollIntoViewIfNeeded();
  await li.screenshot({ path: file });
  return li.innerText();
}
(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE };
  try {
    for (const phone of [false, true]) {
      const ctx = await L.newCtx(browser);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      if (phone) await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await L.waitReady(page);
      await L.importTxt(page, 'old-song.txt', SONG, 'Old Song');
      await L.toasts(page);
      const shown = await cardShot(page, L.path.join(L.OUT, `d_${TREE}_card_${phone ? 'phone' : 'desktop'}.png`));
      out[phone ? 'phone' : 'desktop'] = { shown };
      console.log(phone ? 'PHONE' : 'DESKTOP', JSON.stringify(shown));
      if (phone) {
        await ctx.close();
        continue;
      }
      const detailsOpen = await page.evaluate(() => !!document.querySelector('#ly-panel-review details.ly-local')?.open);
      out.detailsOpen = detailsOpen;
      // Frozen line numbers: a line inserted above the verse's first line.
      const draft = await L.draftOf(page);
      await L.setDraft(page, draft.replace('[VERSE]\n', '[VERSE]\nA brand new opening line\n'));
      await L.settle(page, 400);
      const c = await L.card(page);
      const sung = L.sungLines(await L.draftOf(page));
      out.afterInsert = { cardText: c.item && c.item.text, line1Now: sung[0], line2Now: sung[1] };
      L.record(
        `${TREE}.d.frozenLines`,
        'after a line is inserted above, the card still points at the right lines',
        'line refs follow the text (or the card shows the line text)',
        { card: (c.item.text.match(/the reading for “oh”[^;]*/) || [])[0], line1Now: sung[0], line2Now: sung[1] },
        /lines 2 and 4/.test(c.item.text)
      );
      // Dismiss through the real button.
      const hist0 = await page.evaluate(() => [app.historyIndex, app.history.length]);
      await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
      await page.locator('button[data-ui="ly-renumbered-dismiss"]').first().scrollIntoViewIfNeeded();
      await L.toasts(page);
      await page.click('button[data-ui="ly-renumbered-dismiss"]');
      await L.settle(page, 800);
      const t = await L.toasts(page);
      const toastEl = await page.evaluate(() => {
        const el = document.getElementById('toast');
        return el ? { text: el.innerText, visible: el.offsetParent !== null, buttons: [...el.querySelectorAll('button')].map((b) => b.innerText) } : null;
      });
      const hist1 = await page.evaluate(() => [app.historyIndex, app.history.length]);
      const c2 = await L.card(page);
      out.dismiss = { toasts: t, toastEl, hist0, hist1, cardAfter: c2.item, metaAfter: c2.meta };
      L.record(
        `${TREE}.d.dismissNoUndo`,
        'Dismiss: is there any confirmation or Undo for the removed record?',
        'informational',
        { newToasts: t, toastEl, hist0, hist1, card: !!c2.item },
        null
      );
      await page.evaluate(() => $ui('btn-undo').click());
      await L.settle(page, 600);
      const c3 = await L.card(page);
      out.undoAfterDismiss = { card: !!c3.item, draftHasInserted: (await L.draftOf(page)).includes('A brand new opening line') };
      L.record(
        `${TREE}.d.undoAfterDismiss`,
        'Undo after Dismiss restores the card',
        'card back',
        out.undoAfterDismiss,
        !!c3.item
      );
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, `d_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
