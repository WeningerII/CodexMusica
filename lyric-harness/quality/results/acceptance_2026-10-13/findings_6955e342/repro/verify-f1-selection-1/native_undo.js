// Adversarial re-check of f1-selection b10: the textarea's native Ctrl+Z after
// a send boundary. Usage: node native_undo.js <cand|main|base|c61b|c678> [scen,...]
'use strict';
const L = require('./vlib.js');
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
const MARKED = [
  '[SETUP — rhyme groups — 1.T5,8 — cut v2]',
  '[SETUP — returns — 1.T3, 2.end — cut v2]',
  '[SETUP — reading — token 3 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me — cut v2]',
].join('\n') + `\n\n${BODY}`;
const NOROWS = BODY;

// line 2 of the song, wherever it is; rows = the [SETUP] rows.
const view = (t) => ({ line2: t.split('\n').find((l) => l.startsWith('I walk')) ?? null, rows: t.split('\n').filter((l) => l.startsWith('[SETUP')), marked: t.split('\n').filter((l) => /cut v2\]$/.test(l)).length, len: t.length });
const caretAfter = (page, needle) =>
  page.evaluate((n) => {
    const d = $ui('lyrics-draft');
    d.focus();
    const at = d.value.indexOf(n) + n.length;
    d.setSelectionRange(at, at);
  }, needle);
async function ctrlZ(page, n) {
  const out = [];
  await page.evaluate(() => $ui('lyrics-draft').focus());
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    const t = await L.draftText(page);
    out.push(view(t));
  }
  return out;
}
const progSend = (page) => page.evaluate(() => _chatSend('Tighten line 2', { choice: 'lyrics-edit' }).then((r) => r));

const SCEN = {
  // The tester's exact steps (b_boundaries.js nativeUndo), one more Ctrl+Z.
  async replica(page, q) {
    await L.setDraft(page, UNMARKED);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    const typed = view(await L.draftText(page));
    const r = await progSend(page);
    await L.waitIdle(page);
    const sent = view(await L.draftText(page));
    const z = await ctrlZ(page, 3);
    return { sendResult: r, posts: q.calls.length, typed, sent, rewroteAtSend: sent.marked !== typed.marked, ctrlZ: z };
  },
  // The same text already in the current cut: nothing to rewrite at the send.
  async markedControl(page, q) {
    await L.setDraft(page, MARKED);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    const typed = view(await L.draftText(page));
    const r = await progSend(page);
    await L.waitIdle(page);
    const sent = view(await L.draftText(page));
    const z = await ctrlZ(page, 3);
    return { sendResult: r, posts: q.calls.length, typed, sent, ctrlZ: z };
  },
  async noRowsControl(page, q) {
    await L.setDraft(page, NOROWS);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    const r = await progSend(page);
    await L.waitIdle(page);
    const z = await ctrlZ(page, 3);
    return { sendResult: r, posts: q.calls.length, ctrlZ: z };
  },
  // Text arriving by a native insert (as a paste does), then typing, then a
  // send: how far back does Ctrl+Z reach?
  async pasteTypeSend(page, q) {
    await L.setDraft(page, '');
    await page.waitForTimeout(200);
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(0, 0); });
    await page.keyboard.insertText(UNMARKED);
    await page.waitForTimeout(600);
    const pasted = view(await L.draftText(page));
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    const typed = view(await L.draftText(page));
    const r = await progSend(page);
    await L.waitIdle(page);
    const sent = view(await L.draftText(page));
    const z = await ctrlZ(page, 8);
    return { sendResult: r, posts: q.calls.length, pasted, typed, sent, ctrlZ: z.map((v) => ({ ...v, rows: v.rows.length ? v.rows : '(none)' })) };
  },
  // The real dock: click the chat field, pick "Edit existing lyrics", type,
  // click Ask (this path clears the chat field programmatically).
  async dockSend(page, q) {
    await L.setDraft(page, UNMARKED);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    const typed = view(await L.draftText(page));
        await page.click('#ly-tab-writer');
    await page.waitForTimeout(300);
    await page.selectOption('#chat-domain', 'lyrics-edit');
    const dockVisible = await page.evaluate(() => !!document.getElementById('chat-input')?.offsetParent);
    await page.click('#chat-input');
    await page.keyboard.type('Tighten line 2', { delay: 10 });
    await page.click('#chat-send');
    await L.waitIdle(page);
    const sent = view(await L.draftText(page));
    const chatInputAfter = await page.evaluate(() => document.getElementById('chat-input').value);
    // back to the draft by a click at the end of line 2
    const box = await page.locator('#lyrics-draft').boundingBox();
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); const at = d.value.indexOf('again') + 5; d.setSelectionRange(at, at); });
    const z = await ctrlZ(page, 3);
    return { dockVisible, posts: q.calls.length, sentHadContext: !!q.calls[0]?.lyric_context, typed, sent, rewroteAtSend: sent.marked !== typed.marked, chatInputAfter, draftBox: !!box, ctrlZ: z };
  },
  // The dock path with nothing to rewrite (control for the dock's own clear).
  async dockSendMarked(page, q) {
    await L.setDraft(page, MARKED);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    await page.click('#ly-tab-writer');
    await page.waitForTimeout(300);
    await page.selectOption('#chat-domain', 'lyrics-edit');
    await page.click('#chat-input');
    await page.keyboard.type('Tighten line 2', { delay: 10 });
    await page.click('#chat-send');
    await L.waitIdle(page);
    const sent = view(await L.draftText(page));
    await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); const at = d.value.indexOf('again') + 5; d.setSelectionRange(at, at); });
    const z = await ctrlZ(page, 3);
    return { posts: q.calls.length, sent, ctrlZ: z };
  },
  // Run review by a real click on the page's button.
  async runReviewClick(page, q) {
    await L.setDraft(page, UNMARKED);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    const typed = view(await L.draftText(page));
    const btn = page.locator('[data-ui="ly-run-review"]:visible').first();
    const n = await page.locator('[data-ui="ly-run-review"]:visible').count();
    await btn.click();
    await L.waitIdle(page);
    const sent = view(await L.draftText(page));
    const z = await ctrlZ(page, 3);
    return { buttons: n, posts: q.calls.length, typed, sent, rewroteAtSend: sent.marked !== typed.marked, ctrlZ: z };
  },
  // After the rewrite, new typing is undoable again (the loss is bounded by
  // the rewrite), and app-level Undo still works.
  async afterRewrite(page, q) {
    await L.setDraft(page, UNMARKED);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    await progSend(page);
    await L.waitIdle(page);
    await caretAfter(page, 'again');
    await page.keyboard.type(' more', { delay: 30 });
    await page.waitForTimeout(300);
    const z = await ctrlZ(page, 7);
    await page.evaluate(() => $ui('lyrics-draft').blur());
    await page.waitForTimeout(200);
    await page.evaluate(() => $ui('btn-undo').click());
    await page.waitForTimeout(300);
    const appUndo1 = view(await L.draftText(page));
    await page.evaluate(() => $ui('btn-undo').click());
    await page.waitForTimeout(300);
    const appUndo2 = view(await L.draftText(page));
    return { posts: q.calls.length, ctrlZ: z, appUndo1, appUndo2 };
  },
  // Pre-existing class (page writes the draft programmatically): app-level
  // Undo button, then the textarea's Ctrl+Z.
  async appUndoThenCtrlZ(page, q) {
    await L.setDraft(page, NOROWS);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.evaluate(() => $ui('lyrics-draft').blur());
    await page.waitForTimeout(300);
    await caretAfter(page, 'floor');
    await page.keyboard.type(' x', { delay: 30 });
    await page.evaluate(() => $ui('lyrics-draft').blur());
    await page.waitForTimeout(300);
    await page.evaluate(() => $ui('btn-undo').click());
    await page.waitForTimeout(300);
    const afterAppUndo = (await L.draftText(page)).split('\n').slice(2, 4);
    await page.evaluate(() => $ui('lyrics-draft').focus());
    const z = [];
    for (let i = 0; i < 2; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(250);
      z.push((await L.draftText(page)).split('\n').slice(2, 4));
    }
    return { afterAppUndo, ctrlZ: z };
  },
  // Pre-existing class: a .txt import replaces the draft.
  async importTxtThenCtrlZ(page, q) {
    await L.setDraft(page, NOROWS);
    await page.waitForTimeout(200);
    await caretAfter(page, 'tonight');
    await page.keyboard.type(' again', { delay: 30 });
    await page.waitForTimeout(300);
    await page.setInputFiles('#ly-file', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from(NOROWS + '\n\n[BRIDGE]\nNew line') });
    await page.waitForTimeout(1000);
    const afterImport = view(await L.draftText(page));
    const z = await ctrlZ(page, 2);
    return { afterImport, ctrlZ: z };
  },
};

(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const out = { tree: TREE, root: L.TREES[TREE], scen: {} };
  try {
    for (const [name, fn] of Object.entries(SCEN)) {
      if (ONLY && !ONLY.has(name)) continue;
      const { ctx, page, q, errors } = await L.boot(browser, base);
      let r;
      try {
        r = await fn(page, q);
      } catch (e) {
        r = { threw: String(e.stack || e).slice(0, 1500) };
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
  L.fs.writeFileSync(L.path.join(L.OUT, `native_undo_${TREE}${ONLY ? '_' + [...ONLY].join('-') : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
