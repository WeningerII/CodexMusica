// p5 (BB8 order-marker at 8ea94ac9, OUTSIDE the four contracted group writers): the
// pronunciation form is also a form writer over [SETUP — reading] rows. Does the ORDER of a
// pronunciation-form commit and a send change what an UNMARKED (legacy) saved reading becomes?
//   ORDER 1: body -> real Ctrl+V of an unmarked reading row at offset 0 -> pronunciation form
//            (caret on line 1, the word chip, "Mark uncertain", which applies at once) -> send.
//   ORDER 2: body -> the same paste -> send -> the same pronunciation commit -> send.
// The pasted row names token 4 "love" under the earlier cut (Oh--oh|oh|my|love); under the
// current cut "love" is token 5 and token 4 is "my".
// Usage: node readings.js <cand|c0af|c695|c61b|main> [filter]
'use strict';
const C = require('../p2/com.js');
const TREE = process.argv[2] || 'cand';
const FILTER = process.argv[3] || '';
const OUT = C.path.join(C.S, 'h8ea/order-marker/p5');
const BODY = ['[VERSE]', 'Oh--oh, oh my love', 'I walk the line tonight', 'I hold you tight', 'Well-worn shoes upon the floor', 'The rain comes down', 'I hear the sound', 'The night is cold', 'Love above'].join('\n');
const ROW = '[SETUP — reading — token 4 "love" in "Oh--oh, oh my love" — L AH1 V — declared — source: the writer]';
const CASES = [
  { id: 'PRmy.review', chip: 'my', send: 'review' },
  { id: 'PRlove.review', chip: 'love', send: 'review' },
  { id: 'PRmy.dock', chip: 'my', send: 'dock' },
];
const readingRows = (t) => t.split('\n').filter((l) => /^\s*\[SETUP\s+—\s+reading/i.test(l));
async function pronounce(page, chip, how) {
  await C.openTool(page, 'pronunciation');
  await C.caretToLine(page, 1);
  await page.waitForTimeout(200);
  const chips = page.locator('[data-ui="ly-reading-pick"].cm-chip');
  how.chips = await chips.evaluateAll((xs) => xs.map((x) => `${x.textContent}|${x.getAttribute('data-id')}`));
  const k = how.chips.findIndex((c) => c.split('|')[0] === chip);
  if (k < 0) throw new Error(`no chip ${chip}`);
  await chips.nth(k).click();
  await page.waitForTimeout(250);
  how.card = await page.evaluate(() => (document.querySelector('.ly-word-card') || {}).innerText || '');
  await page.locator('[data-ui="ly-reading-kind"][data-id="uncertain"]').first().click();
  await page.waitForTimeout(400);
}
async function send(page, q, kind) {
  const n = q.calls.length;
  if (kind === 'review') await page.locator('.ly-run').first().click();
  else {
    await page.locator('[data-ui="ly-menu"][data-id="ai"]').first().click();
    await page.waitForTimeout(150);
    await page.locator('#ly-menu-ai [data-ui="edit-lyrics"]').click();
    await page.waitForTimeout(250);
    await page.keyboard.type('Tighten line 2', { delay: 5 });
    await page.locator('#chat-send').click();
  }
  await C.idle(page);
  await page.evaluate(() => typeof _chatClosePanel === 'function' && _chatClosePanel()).catch(() => {});
  return q.calls.slice(n).map((c) => (c.lyric_context ? c.lyric_context.declarations : null));
}
async function runOne(browser, base, c, order) {
  const { ctx, page, q, errors } = await C.boot(browser, base);
  const steps = [];
  const how = {};
  const r = { id: `${TREE}.${c.id}.O${order}`, case: c.id, order, steps, how, sends: [] };
  const snap = async (label) => {
    const t = await C.draftText(page);
    steps.push({ step: label, readings: readingRows(t), toasts: await C.toasts(page) });
  };
  try {
    await C.enterBody(page, BODY);
    await C.toasts(page);
    await C.insertAtTop(page, `${ROW}\n\n`, 'paste');
    await snap('1 pasted unmarked reading');
    if (order === 2) {
      r.sends.push(await send(page, q, c.send));
      await snap('2 after send');
    }
    await pronounce(page, c.chip, how);
    await snap(`${order === 2 ? 3 : 2} pronunciation form: "${c.chip}" Mark uncertain`);
    r.sends.push(await send(page, q, c.send));
    await snap(`${order === 2 ? 4 : 3} after send`);
    r.finalText = await C.draftText(page);
  } catch (e) {
    r.threw = String(e.stack || e);
  }
  r.errors = errors;
  await ctx.close();
  return r;
}
(async () => {
  const { server, base } = await C.startServer(TREE);
  const browser = await C.launch();
  const out = [];
  try {
    for (const c of CASES) {
      if (FILTER && !c.id.includes(FILTER)) continue;
      const o1 = await runOne(browser, base, c, 1);
      const o2 = await runOne(browser, base, c, 2);
      out.push(o1, o2);
      const fin = (r) => {
        const s = r.sends.slice(-1)[0] || [];
        const d = s.slice(-1)[0] || {};
        const pick = {};
        for (const k of Object.keys(d)) if (/reading|pronunc|uncertain/i.test(k)) pick[k] = d[k];
        return JSON.stringify(pick);
      };
      for (const r of [o1, o2])
        console.log(`### ${r.id}\n${r.steps.map((s) => `   ${s.step}: ${JSON.stringify(s.readings)} toasts=${JSON.stringify(s.toasts)}`).join('\n')}\n   final readings payload=${fin(r)}\n   chips=${JSON.stringify(r.how.chips)}${r.threw ? '\n   THREW ' + r.threw.split('\n')[0] : ''} errs=${r.errors.length}`);
      console.log(`   SAME final text: ${o1.finalText === o2.finalText}; SAME final readings payload: ${fin(o1) === fin(o2)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  C.fs.writeFileSync(C.path.join(OUT, `readings_${TREE}${FILTER ? '_' + FILTER : ''}.json`), JSON.stringify(out, null, 1));
})().catch((e) => (console.error(e), process.exit(1)));
