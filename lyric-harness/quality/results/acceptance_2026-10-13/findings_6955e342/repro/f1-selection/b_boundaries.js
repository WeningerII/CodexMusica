// (b): the migration runs only at an open (session restored at start, a
// saved session loaded or copied, a session file imported, page mount), an
// import (.txt, Library working copy) or before a send; never from typing,
// a blur, tab/tool switching, Undo or Redo. It adds no Undo step: Undo after
// an open/import returns to the draft from before it, Redo to the migrated
// text, and no step holds the unmarked rows the boundary migrated.
// Every boundary is run on the candidate and, as a control, on main (which
// has no migration: the same steps leave the text as written).
// Usage: node b_boundaries.js <cand|main> [scenario,...]
'use strict';
const L = require('./f1lib.js');
const TREE = process.argv[2] || 'cand';
const ONLY = process.argv[3] ? new Set(process.argv[3].split(',')) : null;

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
const ROWS = [
  '[SETUP — rhyme groups — 1.T4,8]',
  '[SETUP — returns — 1.T2, 2.end]',
  '[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me]',
];
const UNMARKED = `${ROWS.join('\n')}\n\n${BODY}`;
// By hand: v1 cut of line 1 is Oh--oh|oh|my|love, so token 4
// = love) is v2 token 5; v1 token 2 ("oh", chars 8-10) is v2 token 3; line 2
// is unchanged, so 2.end keeps its bytes; the reading moves 2 -> 3.
const MIGRATED_BY_HAND = [
  '[SETUP — rhyme groups — 1.T5,8 — cut v2]',
  '[SETUP — returns — 1.T3, 2.end — cut v2]',
  '[SETUP — reading — token 3 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me — cut v2]',
].join('\n') + `\n\n${BODY}`;
const OTHER = `[VERSE]\nA different song\nWith its own lines`;
const SESSION = (lyrics) => ({ version: 3, name: 'F1 session', cards: [], lyrics, lyricMeta: { version: 1, brief: '', notes: {}, drafts: {}, ui: {} } });

async function hookEnsure(page) {
  await page.evaluate(() => {
    window.__ensure = [];
    if (typeof window.lyEnsureTokenScheme !== 'function') return;
    const orig = window.lyEnsureTokenScheme;
    window.lyEnsureTokenScheme = function () {
      const r = orig.apply(this, arguments);
      window.__ensure.push({ how: arguments[0] ?? 'page', changed: r, stack: new Error().stack.split('\n').slice(2, 5).map((s) => s.trim().split(' (')[0]).join(' < ') });
      return r;
    };
  });
}
const ensureCalls = (page) => page.evaluate(() => (window.__ensure || []).splice(0));
const undo = (page) => page.evaluate(() => { $ui('btn-undo').click(); });
const redo = (page) => page.evaluate(() => { $ui('btn-redo').click(); });
const label = (t) => (t === UNMARKED ? 'UNMARKED' : t === MIGRATED_BY_HAND ? 'MIGRATED' : t === OTHER ? 'OTHER' : t === '' ? 'EMPTY' : 'other:' + JSON.stringify(t.slice(0, 60)));
async function hist(page) {
  const s = await L.state(page);
  return { steps: s.hist.map(label), idx: s.histIdx, draft: label(s.text), app: label(s.appLyrics), saved: s.saved === null ? null : label(s.saved) };
}
// The writer's text before the boundary: OTHER recorded as a step.
async function startFrom(page, text = OTHER) {
  await L.setDraft(page, text);
  await page.waitForTimeout(200);
  await L.toasts(page);
}
// Undo/Redo walk around the current step; the page must not migrate there.
async function undoRedo(page) {
  const out = {};
  await undo(page);
  await page.waitForTimeout(250);
  out.afterUndo = await hist(page);
  await redo(page);
  await page.waitForTimeout(250);
  out.afterRedo = await hist(page);
  out.ensureDuringUndoRedo = (await ensureCalls(page)).filter((c) => c.changed);
  return out;
}

const SCEN = {
  // 1. Typing, paste, blur, tab and tool switching: never a rewrite.
  async typing(page) {
    await startFrom(page, BODY);
    await page.click('#lyrics-draft');
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); });
    await page.keyboard.type(ROWS[1] + '\n', { delay: 160 });
    await page.waitForTimeout(500);
    const typed = await L.state(page);
    await page.keyboard.insertText(ROWS[0] + '\n');
    await page.waitForTimeout(500);
    const pasted = await L.state(page);
    await page.evaluate(() => $ui('lyrics-draft').blur());
    await page.waitForTimeout(300);
    const blurred = await L.state(page);
    await page.evaluate(() => { LY_ACTIONS['ly-tab']('review'); LY_ACTIONS['ly-tab']('tools'); LY_ACTIONS['ly-tool']('rhymes'); LY_ACTIONS['ly-tool']('repeats-voices'); lyRefresh(true); });
    await page.waitForTimeout(400);
    const switched = await L.state(page);
    const want = `${ROWS[1]}\n${ROWS[0]}\n${BODY}`; // the paste lands at the caret, after the typed row
    return {
      typedRowIntact: typed.text === `${ROWS[1]}\n${BODY}`,
      pastedIntact: pasted.text === want,
      blurIntact: blurred.text === want,
      switchIntact: switched.text === want,
      caretAfterPaste: pasted.sel,
      expectCaret: ROWS[0].length + ROWS[1].length + 2,
      ensure: await ensureCalls(page),
      toasts: await L.toasts(page),
      final: switched.text,
    };
  },
  // 2. Session restored at start (a returning user's saved session).
  async restore(page) {
    return { at: await hist(page), ensure: await ensureCalls(page), toasts: await L.toasts(page), undoDisabled: await page.evaluate(() => $ui('btn-undo').disabled) };
  },
  // 3/4. A saved session loaded / copied from the Saved sessions store.
  async load(page) {
    return loadOrCopy(page, false);
  },
  async copy(page) {
    return loadOrCopy(page, true);
  },
  // 5. A session file imported (Import session).
  async importSession(page) {
    await startFrom(page);
    const before = await hist(page);
    await page.setInputFiles('#ui-file', { name: 'f1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(SESSION(UNMARKED))) });
    await page.waitForTimeout(1500);
    const at = await hist(page);
    return { before, at, ensure: await ensureCalls(page), toasts: await L.toasts(page), ...(await undoRedo(page)) };
  },
  // 6. A .txt imported into the Lyrics page.
  async importTxt(page) {
    await startFrom(page);
    const before = await hist(page);
    await page.setInputFiles('#ly-file', { name: 'f1.txt', mimeType: 'text/plain', buffer: Buffer.from(UNMARKED) });
    await page.waitForTimeout(1000);
    const at = await hist(page);
    return { before, at, ensure: await ensureCalls(page), toasts: await L.toasts(page), ...(await undoRedo(page)) };
  },
  // 7. A Library working copy restored (a saved draft holding unmarked rows).
  async library(page) {
    await startFrom(page);
    const before = await hist(page);
    const r = await page.evaluate(async (text) => {
      try {
        await lyLibraryStart();
        if (!lyLibraryStore) return { err: 'no store' };
        await lyLibraryStore.saveDraft({ draftId: 'draft:f1', text, title: 'F1', meta: { version: 1, draftId: 'draft:f1', notes: {}, drafts: {}, ui: {} }, writer: null, writerInput: '', savedAt: Date.now(), pageReview: {} });
        await LY_ACTIONS['ly-library-restore']('draft:f1');
        return { ok: true };
      } catch (e) {
        return { err: String(e) };
      }
    }, UNMARKED);
    await page.waitForTimeout(800);
    const at = await hist(page);
    return { call: r, before, at, ensure: await ensureCalls(page), toasts: await L.toasts(page), ...(await undoRedo(page)) };
  },
  // 8. Before a send: Run review, a typed lyrics request, Rhyme options,
  // resume. The unmarked rows were TYPED (not yet a step): the boundary
  // records the writer's text, then replaces that step.
  async sendReview(page, q) {
    return send(page, q, () => page.evaluate(() => { LY_ACTIONS['ly-run-review'](); }), false);
  },
  async sendReviewAfterBlur(page, q) {
    return send(page, q, () => page.evaluate(() => { LY_ACTIONS['ly-run-review'](); }), true);
  },
  async sendChat(page, q) {
    return send(page, q, () => page.evaluate(() => { _chatSend('Tighten line 2', { choice: 'lyrics-edit' }); }), false);
  },
  async sendRhymeOptions(page, q) {
    return send(page, q, () => page.evaluate(() => { LY.activeLine = 2; lySubmitLyricsAction('rhyme-options', { word: 'tonight', n: 2 }); }), false);
  },
  async sendResume(page, q) {
    return send(page, q, () => page.evaluate(() => { lySubmitLyricsAction('resume'); }), false);
  },
  // 9. Undo/Redo across steps that hold unmarked rows typed by hand: they are
  // restored exactly and never migrated; the next boundary migrates.
  async undoRedoTyped(page, q) {
    await startFrom(page, BODY);
    const step = async (text) => {
      await page.evaluate((t) => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); }, text);
      await page.keyboard.insertText(text);
      await page.evaluate(() => $ui('lyrics-draft').blur());
      await page.waitForTimeout(300);
    };
    await step(ROWS[1] + '\n');
    await step(ROWS[0] + '\n');
    const s0 = await L.state(page);
    const walk = [];
    for (const act of ['undo', 'undo', 'redo', 'redo']) {
      await (act === 'undo' ? undo(page) : redo(page));
      await page.waitForTimeout(250);
      const s = await L.state(page);
      walk.push({ act, idx: s.histIdx, draft: s.text.split('\n').slice(0, 2), toasts: await L.toasts(page) });
    }
    const ensure = (await ensureCalls(page)).filter((c) => c.changed);
    // Then a boundary migrates the current step.
    await page.evaluate(() => { LY_ACTIONS['ly-run-review'](); });
    await L.waitIdle(page);
    const after = await L.state(page);
    await undo(page);
    await page.waitForTimeout(250);
    const u = await L.state(page);
    await redo(page);
    await page.waitForTimeout(250);
    const r = await L.state(page);
    return { stepsBefore: s0.hist.map((t) => t.split('\n').slice(0, 2)), idx: s0.histIdx, walk, ensureDuringWalk: ensure, boundary: { steps: after.hist.map((t) => t.split('\n').slice(0, 2)), idx: after.histIdx }, undoAfterBoundary: u.text.split('\n').slice(0, 2), redoAfterBoundary: r.text.split('\n').slice(0, 2), sent: q.calls.map((c) => c.lyric_context?.declarations ?? null) };
  },
  // 10. The textarea's own Ctrl+Z (native text undo) after a send boundary.
  async nativeUndo(page, q) {
    await startFrom(page, UNMARKED);
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); const at = d.value.indexOf('tonight') + 'tonight'.length; d.setSelectionRange(at, at); });
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    const typed = await L.state(page);
    await page.evaluate(() => { _chatSend('Tighten line 2', { choice: 'lyrics-edit' }); });
    await L.waitIdle(page);
    const sent = await L.state(page);
    await page.evaluate(() => $ui('lyrics-draft').focus());
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const z1 = await L.state(page);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    const z2 = await L.state(page);
    return { typedLine2: typed.text.split('\n')[6], afterSendRows: sent.text.split('\n').slice(0, 3), afterSendLine2: sent.text.split('\n')[6], ctrlZ1: { rows: z1.text.split('\n').slice(0, 3), line2: z1.text.split('\n')[6] }, ctrlZ2: { rows: z2.text.split('\n').slice(0, 3), line2: z2.text.split('\n')[6] } };
  },
};
async function loadOrCopy(page, fork) {
  await startFrom(page);
  const before = await hist(page);
  const r = await page.evaluate(async ([text, fork]) => {
    try {
      if (!window.storage) return { err: 'no window.storage' };
      const key = 'codex:ws:f1';
      await window.storage.set(key, JSON.stringify({ schema: 2, key, name: 'F1 saved', saved_at: new Date().toISOString(), cards: [], lyrics: text, lyricMeta: { version: 1, notes: {}, drafts: {}, ui: {} } }));
      await (fork ? forkWS(key) : loadWS(key));
      return { ok: true, backend: window.storage.backend };
    } catch (e) {
      return { err: String(e) };
    }
  }, [UNMARKED, fork]);
  await page.waitForTimeout(800);
  const at = await hist(page);
  return { call: r, before, at, ensure: await ensureCalls(page), toasts: await L.toasts(page), ...(await undoRedo(page)) };
}
async function send(page, q, trigger, blurFirst) {
  await startFrom(page, BODY);
  const before = await hist(page);
  await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); });
  await page.keyboard.insertText(ROWS.join('\n') + '\n\n');
  await page.waitForTimeout(400);
  if (blurFirst) {
    await page.evaluate(() => $ui('lyrics-draft').blur());
    await page.waitForTimeout(200);
  }
  const typed = await hist(page);
  const n = q.calls.length;
  await trigger();
  await L.waitIdle(page);
  const at = await hist(page);
  const sent = q.calls.slice(n).map((c) => c.lyric_context?.declarations ?? '(no lyric_context)');
  return { before, typed, at, sent, ensure: await ensureCalls(page), toasts: await L.toasts(page), ...(await undoRedo(page)) };
}

(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const out = { tree: TREE, UNMARKED, MIGRATED_BY_HAND, scen: {} };
  try {
    // The page's own pure migration of the fixture equals the hand expectation.
    {
      const { ctx, page } = await L.boot(browser, base);
      out.pageMigrates = await page.evaluate((t) => (typeof lyMigrateSavedReadings === 'function' ? lyMigrateSavedReadings(t).text : null), UNMARKED);
      out.pageMigratesAsHand = out.pageMigrates === MIGRATED_BY_HAND;
      console.log(`[${TREE}] page migration == hand expectation: ${out.pageMigratesAsHand}`);
      await ctx.close();
    }
    for (const [name, fn] of Object.entries(SCEN)) {
      if (ONLY && !ONLY.has(name)) continue;
      const session = name === 'restore' ? SESSION(UNMARKED) : null;
      const { ctx, page, q, errors } = await L.boot(browser, base, session ? { session } : {});
      await hookEnsure(page);
      let r;
      try {
        r = await fn(page, q);
      } catch (e) {
        r = { threw: String(e.stack || e) };
      }
      r.errors = errors;
      out.scen[name] = r;
      console.log(`[${TREE}] ${name}: ${JSON.stringify(r)}`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `b_boundaries_${TREE}${ONLY ? '_' + [...ONLY].join('-') : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
