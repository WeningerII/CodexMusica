// micro: plain Chromium, no page code. A textarea's selection set while a
// button holds focus; then the focused button is removed (focus -> body).
'use strict';
const L = require('./lib.js');
(async () => {
  const browser = await L.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent('<textarea id=t rows=5 cols=40></textarea><div id=box><button id=b>Run</button></div>');
  const res = {};
  for (const variant of ['valueThenSel_removeButton', 'selOnly_removeButton', 'valueThenSel_keepButton', 'valueThenSel_removeButton_noChange']) {
    res[variant] = await page.evaluate((variant) => {
      const t = document.getElementById('t');
      let b = document.getElementById('b');
      if (!b) { b = document.createElement('button'); b.id = 'b'; b.textContent = 'Run'; document.getElementById('box').appendChild(b); }
      t.value = 'abcdefghijklmnopqrstuvwxyz';
      t.focus();
      t.setSelectionRange(2, 4);
      b.focus();
      if (variant.startsWith('valueThenSel')) t.value = variant.endsWith('noChange') ? t.value : 'abcdefghijklmnopqrstuvwxyzABCDEFG';
      t.setSelectionRange(2, 9);
      const mid = [t.selectionStart, t.selectionEnd];
      if (variant.includes('removeButton')) b.remove();
      return new Promise((r) => setTimeout(() => r({ mid, after: [t.selectionStart, t.selectionEnd], active: document.activeElement.tagName }), 100));
    }, variant);
  }
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
