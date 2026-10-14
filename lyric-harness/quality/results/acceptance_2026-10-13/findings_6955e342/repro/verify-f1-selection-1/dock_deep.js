// The real dock path (Writer tab -> "Edit existing lyrics" -> type -> Ask),
// then up to N Ctrl+Z in the draft, recording the draft's line 2, the row
// marks and the chat field after each press. Usage: node dock_deep.js <tree> <UNMARKED|MARKED> [N]
'use strict';
const L = require('./vlib.js');
const TREE = process.argv[2] || 'cand';
const WHICH = process.argv[3] || 'UNMARKED';
const N = Number(process.argv[4] || 25);
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nI hold the dove\nRun to the sea\nLove above`;
const UNMARKED = ['[SETUP — rhyme groups — 1.T4,8]', '[SETUP — returns — 1.T2, 2.end]', '[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me]'].join('\n') + `\n\n${BODY}`;
const MARKED = ['[SETUP — rhyme groups — 1.T5,8 — cut v2]', '[SETUP — returns — 1.T3, 2.end — cut v2]', '[SETUP — reading — token 3 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me — cut v2]'].join('\n') + `\n\n${BODY}`;
const TEXT = WHICH === 'MARKED' ? MARKED : UNMARKED;
const snap = (page) => page.evaluate(() => { const t = $ui('lyrics-draft').value; return { line2: t.split('\n').find((l) => l.startsWith('I walk')) ?? null, marked: t.split('\n').filter((l) => /cut v2\]$/.test(l)).length, rows: t.split('\n').filter((l) => l.startsWith('[SETUP')).length, chat: document.getElementById('chat-input').value }; });
(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const { ctx, page, q, errors } = await L.boot(browser, base);
  await L.setDraft(page, TEXT);
  await page.waitForTimeout(200);
  await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); const at = d.value.indexOf('tonight') + 7; d.setSelectionRange(at, at); });
  await page.keyboard.type(' again', { delay: 30 });
  await page.waitForTimeout(300);
  const typed = await snap(page);
  await page.click('#ly-tab-writer');
  await page.waitForTimeout(300);
  await page.selectOption('#chat-domain', 'lyrics-edit');
  await page.click('#chat-input');
  await page.keyboard.type('Tighten line 2', { delay: 10 });
  await page.click('#chat-send');
  await L.waitIdle(page);
  const sent = await snap(page);
  await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); const at = d.value.indexOf('again') + 5; d.setSelectionRange(at, at); });
  const z = [];
  for (let i = 0; i < N; i++) {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    z.push(await snap(page));
  }
  const firstDraftChange = z.findIndex((s) => s.line2 !== sent.line2 || s.marked !== sent.marked);
  const out = { tree: TREE, text: WHICH, posts: q.calls.length, typed, sent, firstDraftChangeAtPress: firstDraftChange < 0 ? null : firstDraftChange + 1, ctrlZ: z, errors };
  console.log(JSON.stringify({ tree: TREE, text: WHICH, posts: out.posts, typed, sent, firstDraftChangeAtPress: out.firstDraftChangeAtPress, after: z.map((s, i) => `${i + 1}:${JSON.stringify(s.line2.slice(19))}/m${s.marked}/chat=${JSON.stringify(s.chat)}`).join(' ') }));
  L.fs.writeFileSync(L.path.join(L.OUT, `dock_deep_${TREE}_${WHICH}.json`), JSON.stringify(out, null, 2));
  await ctx.close(); await browser.close(); server.close();
})();
