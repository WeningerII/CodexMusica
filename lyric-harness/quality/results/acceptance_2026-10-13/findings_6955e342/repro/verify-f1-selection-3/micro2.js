// micro2: plain Chromium, no page code. A REAL mouse click on a button whose
// handler (a) sets the textarea's value and selection, then (b) re-renders the
// button's container (the focused button is replaced) -- or not.
'use strict';
const L = require('./lib.js');
(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = {};
  for (const v of ['setValue+rerender', 'setValue_only', 'selOnly+rerender', 'nothing+rerender']) {
    await page.setContent(`<textarea id=t rows=5 cols=40>abcdefghijklmnopqrstuvwxyz</textarea><div id=box><button id=b>Run</button></div>
<script>
document.addEventListener('click', (e) => {
  if (e.target.id !== 'b') return;
  const t = document.getElementById('t');
  const v = ${JSON.stringify(v)};
  if (v.startsWith('setValue')) { t.value = 'abcdefghijklmnopqrstuvwxyzABCDEFG'; t.setSelectionRange(2, 9); }
  if (v.startsWith('selOnly')) t.setSelectionRange(2, 9);
  window.__mid = [t.selectionStart, t.selectionEnd];
  if (v.includes('rerender')) document.getElementById('box').innerHTML = '<button id=b>Run</button>';
});
</script>`);
    await page.evaluate(() => { const t = document.getElementById('t'); t.focus(); t.setSelectionRange(2, 4); });
    await page.click('#b');
    await page.waitForTimeout(200);
    res[v] = await page.evaluate(() => ({ mid: window.__mid, after: [document.getElementById('t').selectionStart, document.getElementById('t').selectionEnd], active: document.activeElement.tagName }));
  }
  console.log(JSON.stringify(res));
  await browser.close();
})();
