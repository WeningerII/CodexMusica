// Bare Chromium page (no app code): an unfocused textarea's value is replaced
// inside a button's click handler and setSelectionRange is called; where is
// the selection 300 ms later? Mouse click vs keyboard Enter; value changed vs not.
'use strict';
const path = require('path');
const S = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad';
const { chromium } = require(path.join(S, 'wt-695/node_modules/playwright'));
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  console.log('chromium', browser.version());
  for (const how of ['mouse', 'keyboard'])
    for (const change of [true, false]) {
      const page = await browser.newPage();
      await page.setContent('<textarea id="t" rows="6" cols="60">[SETUP — returns — 1.T2, 2.end]\nbody</textarea><button id="b">Run</button>');
      await page.evaluate((change) => {
        const t = document.getElementById('t');
        document.getElementById('b').addEventListener('click', () => {
          if (change) t.value = t.value.replace('1.T2, 2.end]', '1.T3, 2.end — cut v2]');
          t.setSelectionRange(27, 27);
          window.__in = [t.selectionStart, t.selectionEnd];
        });
      }, change);
      await page.click('#t');
      await page.evaluate(() => document.getElementById('t').setSelectionRange(27, 27));
      if (how === 'mouse') await page.click('#b');
      else { await page.focus('#b'); await page.keyboard.press('Enter'); }
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => { const t = document.getElementById('t'); return { inHandler: window.__in, after300: [t.selectionStart, t.selectionEnd] }; });
      console.log(JSON.stringify({ how, valueChanged: change, ...r }));
      await page.close();
    }
  await browser.close();
})();
