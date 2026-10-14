// (c) Cross-import persistence of the renumbered card, without and with
// dismissal; (d) Dismiss behaviour and Undo. Usage: node c_cross.js [cand]
'use strict';
const L = require('./lib');
const TREE = process.argv[2] || 'cand';
const song = (title, a, b) =>
  [`[SETUP — title — "${title}"]`, '[SETUP — rhyme groups — 1.T4,2.T4]', '', '[VERSE]', a, b].join('\n');
const A = song('Song A', 'Oh--oh, oh my apple', 'Oh--oh, oh my anchor'); // apple, anchor 4 -> 5
const B = song('Song B', 'Ah--ah, ah my bravo', 'Ah--ah, ah my banjo'); // bravo, banjo 4 -> 5
const B0 = ['[SETUP — title — "Song Quiet"]', '[SETUP — rhyme groups — 1,2]', '', '[VERSE]', 'we sing it plain tonight', 'we bring it home tonight'].join('\n');
const words = (c) => ((c.meta && c.meta.items) || []).map((m) => m.word);
const has = (c, ws) => ws.every((w) => words(c).includes(w));
const none = (c, ws) => ws.every((w) => !words(c).includes(w));
let envN = 0;
async function lib(page, text, title) {
  const env = await L.makeEnvelope(page, text, title);
  await L.importLibrary(page, env, L.path.join(L.OUT, `c_env_${TREE}_${++envN}.json`));
  return env;
}
async function undo(page) {
  await page.evaluate(() => $ui('btn-undo').click());
  await L.settle(page, 700);
}
async function redo(page) {
  await page.evaluate(() => $ui('btn-redo').click());
  await L.settle(page, 700);
}
async function restoreDraft(page, draftId) {
  await page.evaluate(() => LY_ACTIONS['ly-tab']('history'));
  await L.settle(page, 500);
  const sel = `button[data-ui="ly-library-restore"][data-id="${draftId}"]`;
  const n = await page.locator(sel).count();
  if (!n) return false;
  await page.click(sel);
  await page.waitForFunction((id) => app.lyricMeta.draftId === id, draftId, { timeout: 20000 });
  await L.settle(page, 1200);
  return true;
}
async function dismiss(page) {
  await page.evaluate(() => {
    LY_ACTIONS['ly-tab']('review');
    lyRefresh(true);
  });
  const sel = 'button[data-ui="ly-renumbered-dismiss"]';
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.click(sel);
  await L.settle(page, 600);
}
const snap = async (page, tag, log) => {
  const c = await L.card(page);
  const d = await L.draftOf(page);
  const s = { tag, words: words(c), more: c.meta && c.meta.more, title: c.item && c.item.title, draftId: c.draftId, draftHead: d.split('\n')[0] };
  log.push(s);
  console.log('  ', JSON.stringify(s));
  return c;
};
(async () => {
  const errors = [];
  const { server, url, browser } = await L.start(TREE);
  const out = { tree: TREE, scenarios: {} };
  const scen = async (name, fn) => {
    console.log('## ' + name);
    const ctx = await L.newCtx(browser);
    const page = await L.open(ctx, url, errors);
    const log = [];
    try {
      await fn(page, log);
    } catch (e) {
      log.push({ error: String((e && e.stack) || e) });
      console.log('ERROR', e && e.stack);
    }
    out.scenarios[name] = log;
    await ctx.close();
  };
  try {
    await scen('C1 txt A -> txt B (renumbers) -> Undo -> Redo', async (page, log) => {
      await L.importTxt(page, 'a.txt', A, 'Song A');
      let c = await snap(page, 'after A', log);
      await L.importTxt(page, 'b.txt', B, 'Song B');
      c = await snap(page, 'after B', log);
      L.record(`${TREE}.c1.accumulate`, '.txt A then .txt B: the card keeps A and adds B', 'apple, anchor, bravo, banjo', words(c), has(c, ['apple', 'anchor', 'bravo', 'banjo']));
      await undo(page);
      c = await snap(page, 'after Undo (draft back to A)', log);
      L.record(`${TREE}.c1.undo`, 'after Undo of import B the card no longer lists B (whose text is gone)', 'apple, anchor only', words(c), has(c, ['apple', 'anchor']) && none(c, ['bravo', 'banjo']));
      await redo(page);
      c = await snap(page, 'after Redo', log);
    });
    await scen('C2 txt A -> txt B0 (renumbers nothing)', async (page, log) => {
      await L.importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A', log);
      await L.importTxt(page, 'b0.txt', B0, 'Song Quiet');
      const c = await snap(page, 'after B0', log);
      L.record(`${TREE}.c2.keep`, '.txt A then a .txt that renumbers nothing: A survives', 'apple, anchor', words(c), has(c, ['apple', 'anchor']));
    });
    await scen('C3 txt A -> Library B (renumbers) -> open A from History -> open B', async (page, log) => {
      await L.importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A', log);
      await L.settle(page, 800);
      const env = await lib(page, B, 'Song B');
      let c = await snap(page, 'after Library B', log);
      L.record(`${TREE}.c3.current`, 'txt A then Library B: what the current card shows', 'B only (per-draft) or A+B', words(c), null);
      const drafts = await L.idbDrafts(page);
      log.push({ tag: 'idb after B', drafts });
      console.log('   idb', JSON.stringify(drafts.map((d) => [d.draftId, d.textHead && d.textHead.slice(0, 30), d.renumbered && d.renumbered.items.map((m) => m.word)])));
      const prev = drafts.find((d) => d.draftId !== env.draftId);
      L.record(`${TREE}.c3.preserved`, "A's card evidence is kept with A's preserved draft", 'IDB record of A has apple, anchor', prev && prev.renumbered, !!(prev && prev.renumbered && prev.renumbered.items.some((m) => m.word === 'apple')));
      const ok = prev ? await restoreDraft(page, prev.draftId) : false;
      c = await snap(page, 'after Open draft A', log);
      L.record(`${TREE}.c3.restoreA`, "opening A's draft from History brings A's card back", 'apple, anchor; not bravo, banjo', { opened: ok, words: words(c) }, ok && has(c, ['apple', 'anchor']) && none(c, ['bravo', 'banjo']));
      const ok2 = await restoreDraft(page, env.draftId);
      c = await snap(page, 'after Open draft B', log);
      L.record(`${TREE}.c3.restoreB`, "opening B's draft again shows B's card", 'bravo, banjo', { opened: ok2, words: words(c) }, ok2 && has(c, ['bravo', 'banjo']));
    });
    await scen('C4 txt A -> Library B0 (renumbers nothing)', async (page, log) => {
      await L.importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A', log);
      await L.settle(page, 800);
      const env = await lib(page, B0, 'Song Quiet');
      const c = await snap(page, 'after Library B0', log);
      const drafts = await L.idbDrafts(page);
      const prev = drafts.find((d) => d.draftId !== env.draftId);
      log.push({ tag: 'idb', drafts });
      L.record(`${TREE}.c4.current`, 'txt A then a Library copy that renumbers nothing: the current card', 'none (A kept with its draft) -- per-draft isolation', { words: words(c), aStored: prev && prev.renumbered && prev.renumbered.items.map((m) => m.word) }, words(c).length === 0 && !!(prev && prev.renumbered));
    });
    await scen('C5 Library A -> txt B (renumbers)', async (page, log) => {
      await lib(page, A, 'Song A');
      await snap(page, 'after Library A', log);
      await L.importTxt(page, 'b.txt', B, 'Song B');
      const c = await snap(page, 'after txt B', log);
      L.record(`${TREE}.c5.accumulate`, 'Library A then .txt B: A survives and B is added', 'apple, anchor, bravo, banjo', words(c), has(c, ['apple', 'anchor', 'bravo', 'banjo']));
    });
    await scen('C6 Library A -> Library B -> open A', async (page, log) => {
      const envA = await lib(page, A, 'Song A');
      await snap(page, 'after Library A', log);
      await L.settle(page, 800);
      const envB = await lib(page, B, 'Song B');
      let c = await snap(page, 'after Library B', log);
      const drafts = await L.idbDrafts(page);
      log.push({ tag: 'idb', drafts });
      const ok = await restoreDraft(page, envA.draftId);
      c = await snap(page, 'after Open draft A', log);
      L.record(`${TREE}.c6.restoreA`, "Library A then Library B, then open A: A's card is back", 'apple, anchor', { opened: ok, words: words(c) }, ok && has(c, ['apple', 'anchor']) && none(c, ['bravo', 'banjo']));
    });
    await scen('C7 txt A -> Library B -> Undo (back to A text) -> reload -> open drafts', async (page, log) => {
      await L.importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A', log);
      await L.settle(page, 800);
      const env = await lib(page, B, 'Song B');
      await snap(page, 'after Library B', log);
      const before = await L.idbDrafts(page);
      log.push({ tag: 'idb before Undo', drafts: before });
      const prevId = (before.find((d) => d.draftId !== env.draftId) || {}).draftId;
      await undo(page);
      let c = await snap(page, 'after Undo', log);
      await L.settle(page, 1500);
      const afterUndo = await L.idbDrafts(page);
      log.push({ tag: 'idb after Undo', drafts: afterUndo });
      console.log('   idb after Undo', JSON.stringify(afterUndo.map((d) => [d.draftId, d.textHead && d.textHead.slice(0, 30), d.renumbered && d.renumbered.items.map((m) => m.word)])));
      L.record(`${TREE}.c7.undoCard`, 'after Undo of a Library import the card matches the restored draft A', 'apple, anchor (A); not bravo, banjo', { words: words(c), draftId: c.draftId, prevId }, has(c, ['apple', 'anchor']) && none(c, ['bravo', 'banjo']));
      const recA = afterUndo.find((d) => d.draftId === prevId);
      L.record(`${TREE}.c7.storeA`, "A's stored draft keeps A's card evidence after the Undo", 'IDB record A: apple, anchor', recA && recA.renumbered, !!(recA && recA.renumbered && recA.renumbered.items.some((m) => m.word === 'apple')));
      await page.reload();
      await L.waitReady(page);
      await L.settle(page, 1200);
      c = await snap(page, 'after reload', log);
    });
    await scen('C8 txt A -> session import of another session -> Undo', async (page, log) => {
      // A session file exported from a fresh page holding song B0 (no card).
      await L.importTxt(page, 'b0.txt', B0, 'Song Quiet');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => LY_ACTIONS['ly-export-session']())]);
      const f = L.path.join(L.OUT, `c_${TREE}_quiet_session.json`);
      await dl.saveAs(f);
      await page.evaluate(() => LY_ACTIONS['ly-blank']());
      await L.settle(page, 500);
      await L.importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A', log);
      await page.setInputFiles('#ui-file', f);
      await page.waitForFunction(() => $ui('lyrics-draft').value.includes('Song Quiet'), null, { timeout: 20000 });
      await L.settle(page, 800);
      let c = await snap(page, 'after session import', log);
      await undo(page);
      c = await snap(page, 'after Undo (A text back?)', log);
      L.record(`${TREE}.c8.undo`, 'session import then Undo: A text returns; does its card?', 'informational', { words: words(c), head: log[log.length - 1].draftHead }, null);
    });
    // ── With dismissal ────────────────────────────────────────────
    await scen('D1 txt A -> Dismiss -> txt B', async (page, log) => {
      await L.importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A', log);
      const hist0 = await page.evaluate(() => [app.historyIndex, app.history.length]);
      await dismiss(page);
      const t = await L.toasts(page);
      let c = await snap(page, 'after Dismiss', log);
      const hist1 = await page.evaluate(() => [app.historyIndex, app.history.length]);
      log.push({ tag: 'dismiss', toasts: t, hist0, hist1 });
      L.record(`${TREE}.d.dismiss`, 'Dismiss removes the card, adds no Undo step, and says nothing', 'card gone; history unchanged', { words: words(c), toasts: t, hist0, hist1 }, words(c).length === 0 && JSON.stringify(hist0) === JSON.stringify(hist1));
      await L.settle(page, 600);
      await page.reload();
      await L.waitReady(page);
      c = await snap(page, 'after reload', log);
      L.record(`${TREE}.d.dismissPersist`, 'a dismissal persists across reload', 'no card', words(c), words(c).length === 0);
      await L.importTxt(page, 'b.txt', B, 'Song B');
      c = await snap(page, 'after B', log);
      L.record(`${TREE}.d1.onlyB`, 'after dismissing A, import B lists only B', 'bravo, banjo', words(c), has(c, ['bravo', 'banjo']) && none(c, ['apple', 'anchor']));
    });
    await scen('D2 txt A -> Dismiss -> Undo (what does Undo do?)', async (page, log) => {
      await L.importTxt(page, 'a.txt', A, 'Song A');
      await snap(page, 'after A', log);
      await dismiss(page);
      await snap(page, 'after Dismiss', log);
      await undo(page);
      const c = await snap(page, 'after Undo', log);
      L.record(`${TREE}.d2.undo`, 'Undo right after Dismiss: brings the card back?', 'informational: card back or not, and what Undo changed', { words: words(c), draftHead: log[log.length - 1].draftHead }, null);
    });
    await scen('D3 txt A -> Dismiss -> Library B -> open A', async (page, log) => {
      await L.importTxt(page, 'a.txt', A, 'Song A');
      await dismiss(page);
      await snap(page, 'after A + Dismiss', log);
      await L.settle(page, 800);
      const env = await lib(page, B, 'Song B');
      await snap(page, 'after Library B', log);
      const drafts = await L.idbDrafts(page);
      const prev = drafts.find((d) => d.draftId !== env.draftId);
      const ok = prev ? await restoreDraft(page, prev.draftId) : false;
      const c = await snap(page, 'after Open draft A', log);
      L.record(`${TREE}.d3.noResurrect`, 'a card dismissed in A does not come back when A is reopened', 'no card', { opened: ok, words: words(c) }, ok && words(c).length === 0);
    });
    await scen('D4 Library A -> Library B -> Dismiss in B -> open A -> open B', async (page, log) => {
      const envA = await lib(page, A, 'Song A');
      await L.settle(page, 800);
      const envB = await lib(page, B, 'Song B');
      await dismiss(page);
      await snap(page, 'B after Dismiss', log);
      await L.settle(page, 800);
      await restoreDraft(page, envA.draftId);
      let c = await snap(page, 'after Open draft A', log);
      L.record(`${TREE}.d4.isolated`, "dismissing B's card leaves A's card with A", 'apple, anchor', words(c), has(c, ['apple', 'anchor']));
      await restoreDraft(page, envB.draftId);
      c = await snap(page, 'after Open draft B', log);
      L.record(`${TREE}.d4.Bdismissed`, "B's dismissal persisted with B's draft", 'no card', words(c), words(c).length === 0);
    });
  } finally {
    out.pageErrors = errors;
    out.results = L.results;
    L.fs.writeFileSync(L.path.join(L.OUT, `c_${TREE}.json`), JSON.stringify(out, null, 1));
    await browser.close();
    server.close();
  }
})();
