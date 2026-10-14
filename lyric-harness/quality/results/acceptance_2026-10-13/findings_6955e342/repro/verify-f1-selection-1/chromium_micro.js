// How this Chromium's native text undo reacts to programmatic writes, on a
// blank page (no app code): two textareas A (the draft) and B (the chat field).
'use strict';
const L = require('./vlib.js');
const HTML = '<textarea id=A rows=4 cols=40></textarea><textarea id=B rows=2 cols=40></textarea>';
async function fresh(page) {
  await page.setContent(HTML);
  await page.click('#A');
}
const val = (page) => page.evaluate(() => ({ A: A.value, B: B.value }));
async function z(page, n, sel = '#A') {
  const out = [];
  await page.focus(sel);
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(80);
    out.push(await val(page));
  }
  return out;
}
(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const out = { chromium: browser.version() };
  // 0. baseline: typing, Ctrl+Z
  await fresh(page);
  await page.keyboard.type('abc', { delay: 30 });
  out.baseline = await z(page, 2);
  // 1. A.value = something else (the candidate's draft.value = done.text)
  await fresh(page);
  await page.keyboard.type('abc', { delay: 30 });
  await page.evaluate(() => { A.value = 'X' + A.value; });
  out.setValueOnA = await z(page, 2);
  // 1b. A.value set to the same string
  await fresh(page);
  await page.keyboard.type('abc', { delay: 30 });
  await page.evaluate(() => { A.value = A.value; });
  out.setSameValueOnA = await z(page, 2);
  // 2. type in A, type in B, B.value = '' (the dock's clearInput), back to A
  await fresh(page);
  await page.keyboard.type('abc', { delay: 30 });
  await page.click('#B');
  await page.keyboard.type('def', { delay: 30 });
  await page.evaluate(() => { B.value = ''; });
  out.typeB_clearB_zInA = await z(page, 4);
  // 3. type in A, type in B (no clear), back to A: does Ctrl+Z reach B?
  await fresh(page);
  await page.keyboard.type('abc', { delay: 30 });
  await page.click('#B');
  await page.keyboard.type('def', { delay: 30 });
  out.typeB_noClear_zInA = await z(page, 6);
  // 4. type in A, B.value = 'q' without typing in B
  await fresh(page);
  await page.keyboard.type('abc', { delay: 30 });
  await page.evaluate(() => { B.value = 'q'; });
  out.setB_only_zInA = await z(page, 2);
  // 5. setRangeText on A
  await fresh(page);
  await page.keyboard.type('abc', { delay: 30 });
  await page.evaluate(() => { A.setRangeText('Z', 0, 1); });
  out.setRangeTextOnA = await z(page, 3);
  // 6. execCommand insertText over a range of A (an undoable rewrite)
  await fresh(page);
  await page.keyboard.type('abc', { delay: 30 });
  await page.evaluate(() => { A.focus(); A.setSelectionRange(0, 1); document.execCommand('insertText', false, 'Z'); A.setSelectionRange(3, 3); });
  out.execInsertTextOnA = await z(page, 4);
  console.log(JSON.stringify(out, null, 1));
  L.fs.writeFileSync(L.path.join(L.OUT, 'chromium_micro.json'), JSON.stringify(out, null, 2));
  await browser.close();
})();
