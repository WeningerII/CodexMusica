// (c) The typed-request boundary as a writer does it: the caret/selection is
// left in the song, the chat input is opened (uiChatOpen focuses it), a
// lyrics-edit request is typed and sent by Enter (keyboard) or by clicking
// the dock's Send button (mouse). Where is the song's selection afterwards?
// Usage: node c_chat_real.js <cand|main>
'use strict';
const L = require('./f1lib.js');
const R = require('./refmap.js');
const TREE = process.argv[2] || 'cand';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const ROW = '[SETUP — returns — 1.T2, 2.end]';
const DOC = `${ROW}\n\n${BODY}`;
const SELS = {
  U_in_2end: [DOC.indexOf('2.end') + 2, DOC.indexOf('2.end') + 2],
  U_sel_2end: [DOC.indexOf('2.end'), DOC.indexOf('2.end') + 5],
  C_sel_T2: [DOC.indexOf('1.T2'), DOC.indexOf('1.T2') + 4],
  S_body_walk: [DOC.indexOf('walk') + 1, DOC.indexOf('walk') + 1],
};
(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const out = { tree: TREE, cases: [] };
  try {
    for (const how of ['enter', 'sendButton'])
      for (const [k, [s, e]] of Object.entries(SELS)) {
        const { ctx, page, q, errors } = await L.boot(browser, base);
        const c = { id: `${TREE}.${how}.${k}` };
        try {
          await L.setDraft(page, DOC);
          await page.waitForTimeout(250);
          await page.evaluate(([s, e]) => {
            const d = $ui('lyrics-draft');
            d.focus();
            d.setSelectionRange(s, e);
          }, [s, e]);
          const pre = await L.state(page);
          // The page's own "Edit this draft" entry: Writer tab, dock input
          // focused, domain lyrics-edit, prefilled.
          await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
          await page.waitForTimeout(200);
          c.chatFocused = await page.evaluate(() => document.activeElement?.id);
          await page.keyboard.type('Tighten line 2', { delay: 10 });
          const n = q.calls.length;
          if (how === 'enter') await page.keyboard.press('Enter');
          else await page.locator('#chat-send').click();
          await L.waitIdle(page);
          const post = await L.state(page);
          c.reached = q.calls.length - n;
          c.sent = q.calls.slice(n).map((x) => x.lyric_context?.declarations ?? null);
          c.migrated = post.text !== pre.text;
          c.before = { sel: pre.sel, shown: R.show(pre.text, pre.sel[0], pre.sel[1]) };
          c.after = { sel: post.sel, shown: R.show(post.text, post.sel[0], post.sel[1]) };
          const ref = c.migrated ? [R.refMap(pre.text, post.text, s), R.refMap(pre.text, post.text, e)] : [{ lo: s, hi: s }, { lo: e, hi: e }];
          c.ref = ref;
          c.expectedShown = ref[0] && ref[1] ? R.show(post.text, ref[0].lo, ref[1].hi) : null;
          c.sameChars = ref[0] && ref[1] && post.sel[0] >= ref[0].lo && post.sel[0] <= ref[0].hi && post.sel[1] >= ref[1].lo && post.sel[1] <= ref[1].hi;
          c.errors = errors;
        } catch (x) {
          c.threw = String(x.stack || x);
        }
        out.cases.push(c);
        console.log(`${c.id}: chatFocused=${c.chatFocused} reached=${c.reached} migrated=${c.migrated} sameChars=${c.sameChars}\n   before ${JSON.stringify(c.before)}\n   after  ${JSON.stringify(c.after)}\n   expect ${JSON.stringify(c.expectedShown)}\n   sent ${JSON.stringify(c.sent)}${c.threw ? '\n   THREW ' + c.threw : ''}`);
        await ctx.close();
      }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `c_chat_real_${TREE}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
