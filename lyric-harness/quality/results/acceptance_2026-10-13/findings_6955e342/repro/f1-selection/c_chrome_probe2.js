// Bare page: a mouse click on a button whose click handler replaces the
// (unfocused) textarea's value and calls setSelectionRange -- does Chromium
// keep the selection? Variants: value changed / value unchanged; handler on
// click / on mousedown; keyboard Enter on the button.
'use strict';
const L = require('./f1lib.js');
(async () => {
  const browser = await L.launch();
  const page = await browser.newPage();
  await page.setContent('<textarea id="t" rows="10" cols="60"></textarea><button id="b">run</button>');
  const run = async (variant) => {
    await page.evaluate((variant) => {
      const d = document.getElementById('t');
      const b = document.getElementById('b');
      d.value = 'abcdefghij\nklmnopqrst\nuvwxyz';
      d.focus();
      d.setSelectionRange(13, 13);
      const nb = b.cloneNode(true);
      b.replaceWith(nb);
      nb.addEventListener(variant.startsWith('down') ? 'mousedown' : 'click', () => {
        const before = [d.selectionStart, d.selectionEnd];
        if (!variant.endsWith('same')) d.value = d.value.replace('abcdefghij', 'abcdefghij — cut v2');
        d.setSelectionRange(variant.endsWith('same') ? 13 : 22, variant.endsWith('same') ? 13 : 22);
        window.__r = { before, inHandler: [d.selectionStart, d.selectionEnd] };
      });
    }, variant);
    if (variant.startsWith('kbd')) {
      await page.focus('#b');
      await page.keyboard.press('Enter');
    } else await page.click('#b');
    await page.waitForTimeout(200);
    return page.evaluate((variant) => {
      const d = document.getElementById('t');
      return { variant, ...window.__r, after200ms: [d.selectionStart, d.selectionEnd], focused: document.activeElement === d };
    }, variant);
  };
  for (const v of ['click', 'click-same', 'down', 'kbd']) console.log(JSON.stringify(await run(v)));
  await browser.close();
})().catch((e) => (console.error(e), process.exit(1)));
