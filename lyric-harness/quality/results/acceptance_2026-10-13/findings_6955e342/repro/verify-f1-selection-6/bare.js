// Bare page, no Codex code: is the reset a Chromium behaviour, and what does
// it need? A textarea holds a caret at 13 (focused by the "writer"); then a
// button is activated whose handler replaces the textarea's value and sets
// the selection to 22 (the mapped offset), exactly what lyEnsureTokenScheme
// does. The selection is sampled in the handler, on every animation frame and
// at 500 ms, with selectionchange events logged.
// Variants:
//  click            real mouse click; handler on 'click' (the page's case)
//  click_same       real mouse click; value NOT changed, only setSelectionRange
//  click_noval_sel  real mouse click; value unchanged, no selection call (control)
//  mousedown        real mouse; handler on 'mousedown' (before focus moves)
//  pointerup        real mouse; handler on 'pointerup'
//  click_pd         real mouse click; mousedown preventDefault (focus stays in textarea)
//  click_div        real mouse click on a non-focusable <div> (focus stays in textarea)
//  click_raf        real mouse click; handler re-applies the selection in rAF
//  click_t0         real mouse click; handler re-applies the selection in setTimeout(0)
//  click_neverfocused  textarea never focused (caret set while unfocused); click
//  click_blurfirst  textarea blurred by script before the click; click
//  click_clickelse  user clicks plain page text first (moves the doc selection), then the button
//  kbd_enter        button focused by script, Enter
//  kbd_space        button focused by script, Space
//  tab_enter        Tab from the textarea to the button, Enter
'use strict';
const L = require('./lib6.js');
const MODE = process.env.MODE || 'headless';
(async () => {
  const browser = await L.launch(MODE);
  const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
  const results = [];
  const run = async (variant) => {
    await page.setContent('<p id="p">Some plain page text to click on.</p><textarea id="t" rows="8" cols="60"></textarea><br><button id="b">run</button> <div id="dv" style="display:inline-block;padding:4px;border:1px solid">div</div>');
    await page.evaluate((variant) => {
      const d = document.getElementById('t');
      const target = variant === 'click_div' ? document.getElementById('dv') : document.getElementById('b');
      d.value = 'abcdefghij\nklmnopqrst\nuvwxyz';
      if (variant !== 'click_neverfocused') d.focus();
      d.setSelectionRange(13, 13);
      if (variant === 'click_blurfirst') d.blur();
      window.__log = [];
      const t0 = performance.now();
      const push = (what) => window.__log.push({ what, t: Math.round(performance.now() - t0), sel: [d.selectionStart, d.selectionEnd], active: document.activeElement === d ? 'textarea' : document.activeElement?.id || document.activeElement?.tagName });
      window.__push = push;
      document.addEventListener('selectionchange', () => push('doc selectionchange'));
      d.addEventListener('selectionchange', () => push('textarea selectionchange'));
      d.addEventListener('blur', () => push('textarea blur'));
      if (variant === 'click_pd') target.addEventListener('mousedown', (e) => e.preventDefault());
      const ev = variant === 'mousedown' ? 'mousedown' : variant === 'pointerup' ? 'pointerup' : 'click';
      target.addEventListener(ev, () => {
        push('handler:before');
        if (variant !== 'click_same' && variant !== 'click_noval_sel') d.value = d.value.replace('abcdefghij', 'abcdefghij — cut v2');
        if (variant !== 'click_noval_sel') d.setSelectionRange(variant === 'click_same' ? 15 : 22, variant === 'click_same' ? 15 : 22);
        push('handler:after');
        if (variant === 'click_raf') requestAnimationFrame(() => { d.setSelectionRange(22, 22); push('raf re-apply'); });
        if (variant === 'click_t0') setTimeout(() => { d.setSelectionRange(22, 22); push('t0 re-apply'); }, 0);
        let k = 0;
        const frame = () => { push('frame ' + k); if (++k < 6) requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
      });
    }, variant);
    if (variant === 'click_clickelse') {
      await page.click('#p', { position: { x: 30, y: 5 } });
      await page.evaluate(() => window.__push('after clicking page text'));
    }
    if (variant === 'kbd_enter' || variant === 'kbd_space') {
      await page.evaluate(() => { document.getElementById('b').focus(); window.__push('button focused by script'); });
      await page.keyboard.press(variant === 'kbd_enter' ? 'Enter' : 'Space');
    } else if (variant === 'tab_enter') {
      await page.keyboard.press('Tab');
      await page.evaluate(() => window.__push('after Tab'));
      await page.keyboard.press('Enter');
    } else if (variant === 'click_div') await page.click('#dv');
    else await page.click('#b');
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const d = document.getElementById('t');
      window.__push('500ms');
      return { log: window.__log, final: [d.selectionStart, d.selectionEnd], value: d.value };
    });
    // How the writer would come back: a script focus() and a Shift+Tab from
    // the button both restore the textarea's cached selection.
    await page.evaluate(() => document.getElementById('t').focus());
    const refocus = await page.evaluate(() => { const d = document.getElementById('t'); return [d.selectionStart, d.selectionEnd]; });
    const rec = { variant, mode: MODE, version: browser.version(), handlerAfter: (r.log.find((x) => x.what === 'handler:after') || {}).sel, final: r.final, afterScriptFocus: refocus, log: r.log };
    results.push(rec);
    const firstReset = r.log.find((x, i) => i > r.log.findIndex((y) => y.what === 'handler:after') && x.sel[0] !== (rec.handlerAfter || [])[0]);
    console.log(`${MODE} ${variant.padEnd(20)} handler->${JSON.stringify(rec.handlerAfter)} 500ms->${JSON.stringify(r.final)} refocus->${JSON.stringify(refocus)}${firstReset ? `  changed at "${firstReset.what}" t=${firstReset.t}` : ''}`);
  };
  for (const v of ['click', 'click_same', 'click_noval_sel', 'mousedown', 'pointerup', 'click_pd', 'click_div', 'click_raf', 'click_t0', 'click_neverfocused', 'click_blurfirst', 'click_clickelse', 'kbd_enter', 'kbd_space', 'tab_enter'])
    await run(v);
  console.log('browser', browser.version());
  L.fs.writeFileSync(L.path.join(L.OUT, `bare_${MODE}.json`), JSON.stringify(results, null, 2));
  await browser.close();
})().catch((e) => (console.error(e), process.exit(1)));
