'use strict';
const L = require('./vlib.js');
(async () => {
  const { server, base } = await L.startServer(L.TREES[process.argv[2] || 'cand']);
  const browser = await L.launch();
  const { ctx, page } = await L.boot(browser, base);
  const info = await page.evaluate(() => {
    const el = (id) => document.getElementById(id);
    const vis = (e) => !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    const anc = (e) => { const out = []; for (let x = e; x; x = x.parentElement) if (x.hidden || getComputedStyle(x).display === 'none') out.push((x.id || x.className || x.tagName) + (x.hidden ? '[hidden]' : '[display:none]')); return out; };
    return {
      dockHidden: el('chat-dock')?.hidden, dockVis: vis(el('chat-dock')), inputVis: vis(el('chat-input')), domainVis: vis(el('chat-domain')),
      domainAnc: anc(el('chat-domain')), inputParent: el('chat-input')?.parentElement?.id, domainValue: el('chat-domain')?.value, domainDisabled: el('chat-domain')?.disabled,
      writerTabBtn: [...document.querySelectorAll('[data-ui]')].map((b) => b.dataset.ui).filter((s) => /writer|tab|ask|chat/i.test(s)).slice(0, 30),
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await ctx.close(); await browser.close(); server.close();
})();
