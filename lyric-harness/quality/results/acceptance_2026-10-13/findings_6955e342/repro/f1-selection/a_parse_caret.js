// (a) Parse every final document of caret.js / caret2.js (candidate and main
// runs) as each tree's page does: sung lines, [SETUP] rows, declarations.
'use strict';
const L = require('./f1lib.js');
(async () => {
  const browser = await L.launch();
  const out = {};
  for (const tree of ['cand', 'main']) {
    const lab = tree === 'cand' ? 'cand695' : 'main';
    const docs = [];
    for (const c of require(`./a_caret/vpr6/caret_${lab}.json`)) docs.push([`caret.${c.id}`, c.finalText]);
    const c2 = require(`./a_caret/vpr6/caret2_${lab}.json`);
    for (const k of ['A_observe', 'A_restore']) docs.push([`caret2.${k}`, c2[k].text]);
    docs.push(['caret2.B', c2.B.text]);
    const { server, base } = await L.startServer(L.TREES[tree]);
    const { ctx, page } = await L.boot(browser, base);
    out[tree] = {};
    for (const [id, t] of docs) {
      const p = await L.parseAsPage(page, t);
      out[tree][id] = { setup: p.setup, decl: p.decl, sungCount: p.sung.length };
      console.log(`[${tree}] ${id}: setup=${JSON.stringify(p.setup)} decl=${JSON.stringify(p.decl)} sung=${p.sung.length}`);
    }
    await ctx.close();
    server.close();
  }
  await browser.close();
  L.fs.writeFileSync(L.path.join(L.OUT, 'a_parse_caret.json'), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
