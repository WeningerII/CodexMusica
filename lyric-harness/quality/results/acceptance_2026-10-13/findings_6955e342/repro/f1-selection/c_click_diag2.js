// Who resets the selection to [0,0] after a click-triggered send boundary?
// Hooks: the draft's value setter, setSelectionRange, selectionStart/End
// setters and select(), each with a stack; polled selection.
'use strict';
const L = require('./f1lib.js');
const TREE = process.argv[2] || 'cand';
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const doc = `[SETUP — returns — 1.T2, 2.end]\n\n${BODY}`;
(async () => {
  const { server, base } = await L.startServer(L.TREES[TREE]);
  const browser = await L.launch();
  const { ctx, page } = await L.boot(browser, base);
  await L.setDraft(page, doc);
  await page.waitForTimeout(300);
  await page.evaluate((at) => {
    const d = $ui('lyrics-draft');
    window.__trace = [];
    const push = (what, stack) => window.__trace.push({ what, t: Math.round(performance.now()), sel: [d.selectionStart, d.selectionEnd], focused: document.activeElement === d, len: d.value.length, stack: stack ? stack.split('\n').slice(2, 9).map((s) => s.trim().replace(/https?:\/\/[^ )]+\//, '')).join(' | ') : undefined });
    const desc = Object.getOwnPropertyDescriptor(d, 'value') || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    Object.defineProperty(d, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); push('value=' + String(v).length, new Error().stack); } });
    const ssr = d.setSelectionRange;
    d.setSelectionRange = function (...a) { const r = ssr.apply(this, a); push('setSelectionRange(' + a.join(',') + ')', new Error().stack); return r; };
    const sel = d.select;
    d.select = function () { const r = sel.apply(this); push('select()', new Error().stack); return r; };
    for (const p of ['selectionStart', 'selectionEnd']) {
      const pd = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, p);
      Object.defineProperty(d, p, { configurable: true, get() { return pd.get.call(this); }, set(v) { pd.set.call(this, v); push(p + '=' + v, new Error().stack); } });
    }
    let last = null;
    setInterval(() => { const s = JSON.stringify([d.selectionStart, d.selectionEnd]); if (s !== last) push('poll'); last = s; }, 2);
    d.focus();
    d.setSelectionRange(at, at);
  }, doc.indexOf('walk') + 1);
  await page.waitForTimeout(100);
  await page.locator('[data-ui="ly-run-review"]:visible').first().click();
  await L.waitIdle(page);
  const trace = await page.evaluate(() => window.__trace);
  for (const t of trace) console.log(JSON.stringify(t));
  L.fs.writeFileSync(L.path.join(L.OUT, `c_click_diag2_${TREE}.json`), JSON.stringify(trace, null, 2));
  await ctx.close();
  await browser.close();
  server.close();
})().catch((e) => (console.error(e), process.exit(1)));
