// verify-f4-card-9: adversarial re-run of f4-card d3 ("the card stays visible
// after a review has run"). Usage: node v9.js <cand|main|prev61b|prev678> [scenario,...]
// Every /chat reply is a local stub (never a provider). No secrets.
'use strict';
const L = require('./vlib');
const TREE = process.argv[2] || 'cand';
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const OH = 'Oh--oh, oh my love';
// The tester's song (unmarked returns row whose T3 moves to T4 under v2).
const SONG = ['[SETUP — title — "Old Song"]', '[SETUP — returns — 1.T3,2.T3]', '', '[VERSE]', OH, OH, 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
// The same song with a section-size mismatch: a local check main also has.
const SONG_SIZE = SONG.replace('[VERSE]', '[VERSE — 3 lines]');
// A song with nothing to migrate (marked row) and the size mismatch.
const SONG_QUIET = ['[SETUP — title — "Quiet Song"]', '', '[VERSE — 3 lines]', 'we walk the line', 'we hold the time', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
const SUNG = (t) => L.sungLines(t).map((s) => s.trim());
const unfinished = (draft) => ({
  reply: 'Reviewed.',
  history: [],
  sig: 'fixture',
  task: { domain: 'lyrics', phase: 'edit' },
  lyric: { standing: ['L3: RHYME — line 3 does not rhyme with line 4 (plain / home)'], open: [] },
  artifact: { text: SUNG(draft).join('\n'), final_draft: SUNG(draft), status: 'unfinished', certified: false },
  completion: null,
  stopped: 'LYRICS_UNFINISHED',
  tools: [{ name: 'lyric_check', exit_code: 3 }],
});
const certified = (draft) => ({
  reply: 'Finished.',
  history: [],
  sig: 'fixture',
  task: { domain: 'lyrics', phase: 'edit' },
  lyric: { standing: [], open: [] },
  artifact: { text: SUNG(draft).join('\n'), final_draft: SUNG(draft), status: 'finished', certified: true },
  completion: { certified: true },
  stopped: null,
  tools: [{ name: 'lyric_check', exit_code: 0 }],
});
// What the Review pane shows. refresh: force lyRefresh(true) first; tab: select Review first.
const probe = (page, { refresh = true, tab = true } = {}) =>
  page.evaluate(
    ({ refresh, tab }) => {
      if (tab) LY_ACTIONS['ly-tab']('review');
      if (refresh) lyRefresh(true);
      const box = $ui('ly-panel-review');
      const d = box.querySelector('details.ly-local');
      const li = [...box.querySelectorAll('li.ly-item')].find((x) => /renumbered to the current word cut/.test(x.textContent));
      const sum = d && d.querySelector('summary');
      const vis = (el) => !!el && (typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.getClientRects().length > 0);
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), h: Math.round(r.height) };
      };
      const items = LY.items || [];
      return {
        lyTab: LY.tab,
        boxVisible: vis(box),
        localOpen: d ? d.open : null,
        summaryText: sum ? sum.innerText.replace(/\s+/g, ' ').trim() : null,
        summaryVisible: vis(sum),
        summaryRect: rect(sum),
        cardInDom: !!li,
        cardVisible: vis(li),
        cardRect: rect(li),
        paneInnerTextHasCard: /renumbered to the current word cut/.test(box.innerText),
        paneTextContentHasCard: /renumbered to the current word cut/.test(box.textContent),
        cardInItems: !!items.find((i) => i.id === 'renumbered'),
        metaEntries: app.lyricMeta?.ui?.renumbered?.items?.length || 0,
        runItems: items.filter((i) => i.source === 'run').map((i) => i.id),
        localItems: items.filter((i) => i.source === 'page').map((i) => i.id),
        hasRun: !!LY.run,
        viewport: window.innerHeight,
        reviewTab: (() => {
          const b = document.querySelector('#ly-tab-review');
          return b ? b.innerText.replace(/\s+/g, ' ').trim() : null;
        })(),
      };
    },
    { refresh, tab }
  );
async function review(page, q, reply) {
  q.replies.push(reply);
  await page.evaluate(() => LY_ACTIONS['ly-run-review']());
  await page.waitForFunction(() => !chatState.busy, null, { timeout: 30000 });
  await L.settle(page, 1200);
}
const out = { tree: TREE, scen: {} };
const errors = [];
const want = (s) => !ONLY || ONLY.has(s);
(async () => {
  const { server, url, browser } = await L.start(TREE);
  try {
    // A: tester's song, .txt import, unfinished review (sung-only final_draft).
    if (want('A')) {
      const q = { calls: [], replies: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await L.open(ctx, url, errors);
      await L.importTxt(page, 'old.txt', SONG, 'Old Song');
      const s = { draftAfterImport: await L.draftOf(page), toasts: await L.toasts(page) };
      s.beforeReview = await probe(page);
      await review(page, q, unfinished(s.draftAfterImport));
      s.calls = q.calls.length;
      s.afterReview = await probe(page);
      s.afterReviewNoRefresh = await probe(page, { refresh: false, tab: false });
      await page.evaluate(() => {
        const d = $ui('ly-panel-review').querySelector('details.ly-local');
        d && d.scrollIntoView();
      });
      await page.screenshot({ path: L.path.join(L.OUT, `A_${TREE}_after_review.png`) });
      // E: reload keeps the card (if any) and the run; still collapsed?
      await L.settle(page, 1500);
      await page.reload();
      await L.waitReady(page);
      await L.settle(page, 1200);
      s.afterReload = await probe(page);
      s.draftAfterReload = await L.draftOf(page);
      out.scen.A = s;
      await ctx.close();
    }
    // B: a clean certified review: are there run items, and is Local checks closed?
    if (want('B')) {
      const q = { calls: [], replies: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await L.open(ctx, url, errors);
      await L.importTxt(page, 'old.txt', SONG, 'Old Song');
      const d = await L.draftOf(page);
      const s = { beforeReview: await probe(page) };
      await review(page, q, certified(d));
      s.calls = q.calls.length;
      s.afterReview = await probe(page);
      s.status = await page.evaluate(() => lyRunStatus(LY.run)?.word || null);
      out.scen.B = s;
      await ctx.close();
    }
    // C: the person expands Local checks; does it stay open through the page's own re-renders?
    if (want('C')) {
      const q = { calls: [], replies: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await L.open(ctx, url, errors);
      await L.importTxt(page, 'old.txt', SONG, 'Old Song');
      const d = await L.draftOf(page);
      await review(page, q, unfinished(d));
      const s = { afterReview: await probe(page) };
      await page.click('#ly-panel-review details.ly-local > summary');
      await L.settle(page, 300);
      s.afterClick = await probe(page, { refresh: false, tab: false });
      await page.evaluate(() => lyRefresh(true));
      await L.settle(page, 200);
      s.afterForcedRefresh = await probe(page, { refresh: false, tab: false });
      // reopen, then type one character at the end of the last sung line (the page's own input path)
      await page.click('#ly-panel-review details.ly-local > summary').catch(() => {});
      await L.settle(page, 200);
      s.reopened = await probe(page, { refresh: false, tab: false });
      await page.focus('#lyrics-draft').catch(async () => page.evaluate(() => $ui('lyrics-draft').focus()));
      await page.evaluate(() => {
        const t = $ui('lyrics-draft');
        t.setSelectionRange(t.value.length, t.value.length);
      });
      await page.keyboard.type('s');
      await L.settle(page, 800);
      s.afterTyping = await probe(page, { refresh: false, tab: false });
      // tab switch Tools -> Review through the tab buttons
      await page.evaluate(() => {
        const d = $ui('ly-panel-review').querySelector('details.ly-local');
        if (d) d.open = true;
      });
      s.reopened2 = await probe(page, { refresh: false, tab: false });
      await page.click('#ly-tab-tools').catch((e) => (s.toolsClickErr = String(e)));
      await L.settle(page, 300);
      await page.click('#ly-tab-review').catch((e) => (s.reviewClickErr = String(e)));
      await L.settle(page, 300);
      s.afterTabSwitch = await probe(page, { refresh: false, tab: false });
      // G: Dismiss still works once expanded
      await page.evaluate(() => {
        const d = $ui('ly-panel-review').querySelector('details.ly-local');
        if (d) d.open = true;
      });
      const dismiss = await page.$('#ly-panel-review [data-ui="ly-renumbered-dismiss"]');
      s.dismissButtonVisible = dismiss ? await dismiss.isVisible() : null;
      if (dismiss) await dismiss.click();
      await L.settle(page, 300);
      s.afterDismiss = await probe(page);
      out.scen.C = s;
      await ctx.close();
    }
    // D: the card is born AFTER a review exists: review a quiet song, then import the migrating .txt.
    if (want('D')) {
      const q = { calls: [], replies: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await L.open(ctx, url, errors);
      await L.importTxt(page, 'quiet.txt', SONG_QUIET, 'Quiet Song');
      const d0 = await L.draftOf(page);
      await review(page, q, unfinished(d0));
      const s = { afterQuietReview: await probe(page) };
      await L.toasts(page);
      await L.importTxt(page, 'old.txt', SONG, 'Old Song');
      s.toastsAtImport = await L.toasts(page);
      s.afterImport = await probe(page);
      s.draftAfterImport = await L.draftOf(page);
      // D2: the same song typed by hand after a review, then a reload (the mount boundary)
      out.scen.D = s;
      await ctx.close();
    }
    if (want('D2')) {
      const q = { calls: [], replies: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await L.open(ctx, url, errors);
      await L.importTxt(page, 'quiet.txt', SONG_QUIET, 'Quiet Song');
      const d0 = await L.draftOf(page);
      await review(page, q, unfinished(d0));
      const s = { afterQuietReview: await probe(page) };
      // hand-typed (pasted) unmarked row: added to the draft through the page's own save path
      const withRow = d0.replace('[SETUP — title — "Quiet Song"]', '[SETUP — title — "Quiet Song"]\n[SETUP — returns — 1.T3,2.T3]').replace('we walk the line', OH).replace('we hold the time', OH);
      await L.setDraft(page, withRow);
      await L.settle(page, 1500);
      s.beforeReload = await probe(page);
      await page.reload();
      await L.waitReady(page);
      await L.settle(page, 1500);
      s.afterReload = await probe(page);
      s.draftAfterReload = await L.draftOf(page);
      s.toastsAfterReload = await L.toasts(page);
      out.scen.D2 = s;
      await ctx.close();
    }
    // F: phone viewport after a review.
    if (want('F')) {
      const q = { calls: [], replies: [] };
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await ctx.route(/mcp\.codexmusica\.com/, async (r) => {
        if (/\/chat$/.test(r.request().url()) && r.request().method() === 'POST') {
          q.calls.push(JSON.parse(r.request().postData() || '{}'));
          const next = q.replies.shift() || { reply: 'ok', history: [], sig: 'x' };
          return r.fulfill({ contentType: 'application/json', body: JSON.stringify(next) });
        }
        return r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' });
      });
      const page = await L.open(ctx, url, errors);
      await L.importTxt(page, 'old.txt', SONG, 'Old Song');
      const d = await L.draftOf(page);
      const s = { beforeReview: await probe(page) };
      await review(page, q, unfinished(d));
      s.afterReview = await probe(page);
      await page.evaluate(() => {
        const d = $ui('ly-panel-review').querySelector('details.ly-local');
        d && d.scrollIntoView();
      });
      await page.screenshot({ path: L.path.join(L.OUT, `F_${TREE}_phone_after_review.png`) });
      out.scen.F = s;
      await ctx.close();
    }
    // C2: re-collapse control for any local check (size mismatch), every tree.
    if (want('C2')) {
      const q = { calls: [], replies: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await L.open(ctx, url, errors);
      await L.importTxt(page, 'size.txt', SONG_SIZE, 'Old Song');
      const d = await L.draftOf(page);
      await review(page, q, unfinished(d));
      const st = () =>
        page.evaluate(() => {
          const det = $ui('ly-panel-review').querySelector('details.ly-local');
          return { open: det ? det.open : null, sum: det ? det.querySelector('summary').innerText.replace(/\s+/g, ' ') : null };
        });
      const s = { afterReview: await probe(page) };
      await page.click('#ly-panel-review details.ly-local > summary');
      await L.settle(page, 300);
      s.afterClick = await st();
      await page.evaluate(() => {
        const t = $ui('lyrics-draft');
        t.focus();
        t.setSelectionRange(t.value.length, t.value.length);
      });
      await page.keyboard.type('s');
      await L.settle(page, 800);
      s.afterTyping = await st();
      await page.click('#ly-panel-review details.ly-local > summary');
      await L.settle(page, 300);
      s.reopened = await st();
      await page.click('#ly-tab-tools');
      await L.settle(page, 300);
      await page.click('#ly-tab-review');
      await L.settle(page, 300);
      s.afterTabSwitch = await st();
      out.scen.C2 = s;
      await ctx.close();
    }
    // H: pre-existing rule control: a size-mismatch local check before/after a review (every tree).
    if (want('H')) {
      const q = { calls: [], replies: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await L.open(ctx, url, errors);
      await L.importTxt(page, 'size.txt', SONG_SIZE, 'Old Song');
      const d = await L.draftOf(page);
      const s = { draftAfterImport: d, toasts: await L.toasts(page), beforeReview: await probe(page) };
      const sizeOpen = () =>
        page.evaluate(() => {
          const box = $ui('ly-panel-review');
          const li = [...box.querySelectorAll('li.ly-item')].find((x) => /declares 3 lines but has 4/.test(x.textContent));
          return { sizeInDom: !!li, sizeVisible: !!li && li.checkVisibility(), sizeInnerText: /declares 3 lines but has 4/.test(box.innerText) };
        });
      s.sizeBefore = await sizeOpen();
      await review(page, q, unfinished(d));
      s.afterReview = await probe(page);
      s.sizeAfter = await sizeOpen();
      out.scen.H = s;
      await ctx.close();
    }
  } catch (e) {
    out.error = String((e && e.stack) || e);
    console.log('ERROR', out.error);
  } finally {
    out.pageErrors = errors;
    const name = `v9_${TREE}${ONLY ? '_' + [...ONLY].join('') : ''}.json`;
    L.fs.writeFileSync(L.path.join(L.OUT, name), JSON.stringify(out, null, 1));
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
