// diag4: wrap, before any page script runs, every listener / timer / rAF /
// observer callback so that a callback that changes the draft's selection is
// logged with its source text head and the stack at registration.
'use strict';
const L = require('./lib.js');
const DOC = '[SETUP — returns — 1.T2, 2.end]\n\n[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe\'re sailing on\nLove above';
(async () => {
  const { server, base } = await L.serveTree('cand');
  const browser = await L.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/mcp\.codexmusica\.com/, (r) => (/\/chat$/.test(r.request().url()) ? r.fulfill({ contentType: 'application/json', body: JSON.stringify({ reply: 'Noted.', history: [], sig: 'x' }) }) : r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })));
  await ctx.addInitScript(() => {
    window.__w = [];
    const sel = () => { const d = document.getElementById('lyrics-draft'); return d ? `${d.selectionStart},${d.selectionEnd}` : 'none'; };
    const wrap = (cb, kind, reg) => function (...a) {
      const b = sel();
      try { return cb.apply(this, a); } finally { const e = sel(); if (window.__arm && b !== e) window.__w.push({ kind, b, e, src: String(cb).slice(0, 160), reg }); }
    };
    const ael = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, cb, o) {
      if (typeof cb !== 'function') return ael.call(this, type, cb, o);
      const reg = `${type}@${this.id || this.nodeName || 'win'}`;
      const w = wrap(cb, 'listener', reg);
      (cb.__w || (cb.__w = new Map())).set(this, w);
      return ael.call(this, type, w, o);
    };
    const rel = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.removeEventListener = function (type, cb, o) { return rel.call(this, type, (cb && cb.__w && cb.__w.get(this)) || cb, o); };
    const st = window.setTimeout; window.setTimeout = function (cb, ms, ...r) { return st.call(this, typeof cb === 'function' ? wrap(cb, 'timeout', String(ms)) : cb, ms, ...r); };
    const raf = window.requestAnimationFrame; window.requestAnimationFrame = function (cb) { return raf.call(this, wrap(cb, 'raf', '')); };
    const qm = window.queueMicrotask; window.queueMicrotask = function (cb) { return qm.call(this, wrap(cb, 'microtask', '')); };
    for (const O of ['ResizeObserver', 'MutationObserver', 'IntersectionObserver']) {
      const C = window[O]; if (!C) continue;
      window[O] = class extends C { constructor(cb, o) { super(wrap(cb, O, ''), o); } };
    }
    const th = Promise.prototype.then; Promise.prototype.then = function (a, b) { return th.call(this, typeof a === 'function' ? wrap(a, 'then', '') : a, typeof b === 'function' ? wrap(b, 'then', '') : b); };
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/codex.html#lyrics`);
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready && typeof LY !== 'undefined' && !!LY.model, null, { timeout: 90000 });
  await page.waitForTimeout(300);
  await page.evaluate((t) => { const d = $ui('lyrics-draft'); d.value = t; uiSaveLyrics(); pushHistory(); lyRefresh(true); }, DOC);
  await page.waitForTimeout(300);
  await page.evaluate(() => { const d = $ui('lyrics-draft'); d.focus(); d.setSelectionRange(19, 23); window.__w.length = 0; window.__arm = true; });
  await page.locator('[data-ui="ly-run-review"]:visible').first().click();
  await page.waitForTimeout(1500);
  for (const x of await page.evaluate(() => window.__w)) console.log(JSON.stringify(x));
  console.log('FINAL', JSON.stringify((await L.state(page)).sel));
  await browser.close(); server.close();
})().catch((e) => (console.error(e), process.exit(1)));
