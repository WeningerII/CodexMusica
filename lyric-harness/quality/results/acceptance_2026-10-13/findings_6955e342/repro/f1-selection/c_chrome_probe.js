// Is it the browser? A bare page: a textarea, focused, caret set, blurred;
// then (as lyEnsureTokenScheme does) value replaced and setSelectionRange
// called while unfocused. Polled for 300 ms. Variants: focused (control);
// unfocused + forced layout (offsetHeight) after; unfocused + rAF re-apply.
'use strict';
const L = require('./f1lib.js');
(async () => {
  const browser = await L.launch();
  const page = await browser.newPage();
  await page.setContent('<textarea id="t" rows="10" cols="60"></textarea><button id="b">x</button>');
  const run = (variant) =>
    page.evaluate(async (variant) => {
      const d = document.getElementById('t');
      d.value = 'abcdefghij\nklmnopqrst\nuvwxyz';
      d.focus();
      d.setSelectionRange(13, 13);
      if (variant !== 'focused') d.blur();
      const v = d.value.replace('abcdefghij', 'abcdefghij — cut v2');
      d.value = v;
      d.setSelectionRange(13 + 9, 13 + 9);
      const now = [d.selectionStart, d.selectionEnd];
      if (variant === 'layout') void d.offsetHeight;
      if (variant === 'raf') requestAnimationFrame(() => d.setSelectionRange(22, 22));
      await new Promise((r) => setTimeout(r, 300));
      return { variant, immediately: now, after300ms: [d.selectionStart, d.selectionEnd], focused: document.activeElement === d };
    }, variant);
  for (const v of ['focused', 'unfocused', 'layout', 'raf']) console.log(JSON.stringify(await run(v)));
  console.log('chromium', browser.version());
  await browser.close();
})().catch((e) => (console.error(e), process.exit(1)));
