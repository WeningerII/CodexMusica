// The page itself: a draft holding a [SETUP] row typed/pasted unmarked since
// the last boundary (so the candidate migrates it at the send), the writer's
// selection placed, then Run review activated four ways:
//   click   real mouse click on the visible Run review button
//   kbd     the button focused by script, Enter
//   tabkbd  Tab from the editor until the Run review button has focus, Enter
//   prog    LY_ACTIONS['ly-run-review']() with the editor still focused
// Recorded per case: whether the send rewrote the text, the selection inside
// lyEnsureTokenScheme (when the tree has it), the selection ~0.5 s after the
// send settles, the expected "same characters" (computed here from the
// anchor text, not from the page's lyMapOffset), and the writer's keyboard
// return (Shift+Tab / Tab back into the editor), two typed keys, and how the
// page parses the result.
// Usage: node sel6.js <tree,...> [trigger,...] [doc,...]
'use strict';
const L = require('./lib6.js');
const TREES = (process.argv[2] || 'cand,c61b,main,base').split(',');
const TRIGS = (process.argv[3] || 'click,kbd,tabkbd,prog').split(',');
const BODY = `[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe're sailing on\nLove above`;
const DOCS = {
  // 3PO's row: line 1's word number changes under the current cut.
  MIG: `[SETUP — returns — 1.T2, 2.end]\n\n${BODY}`,
  // Control: a row on unchanged lines only -- no rewrite at the send.
  NOMIG: `[SETUP — returns — 2.end, 7.end]\n\n${BODY}`,
};
const DOCSEL = (process.argv[4] || 'MIG,NOMIG').split(',');
// selection: [anchor text, offset in it, length, direction]; the expected
// position after any rewrite is the same anchor text's position + offset.
const SELS = {
  sung_walk: ['walk the', 1, 0],
  sung_range_line2: ['I walk the line tonight', 0, 23, 'backward'],
  row_in_2end: ['2.end', 2, 0],
  row_range_2end: ['2.end', 0, 5, 'forward'],
};
(async () => {
  const browser = await L.launch();
  const out = [];
  try {
    for (const tree of TREES) {
      const { server, base } = await L.startServer(tree);
      for (const trig of TRIGS)
        for (const dk of DOCSEL) {
          const { ctx, page, q, errors } = await L.boot(browser, base);
          const doc = DOCS[dk];
          for (const [sk, [anchor, off, len, dir]] of Object.entries(SELS)) {
            const c = { tree, trig, doc: dk, sel: sk };
            try {
              await page.evaluate(() => {
                if (typeof _chatReset === 'function') _chatReset();
                LY.run = null;
                LY.conflict = null;
                LY.gate = null;
              });
              await L.setDraft(page, doc);
              await page.waitForTimeout(250);
              const pre0 = await L.sel(page);
              c.migratedBeforeSend = pre0.text !== doc; // 61b migrates in the refresh
              const s0 = pre0.text.indexOf(anchor) + off;
              await page.evaluate(([s, e, d]) => {
                const t = $ui('lyrics-draft');
                t.focus();
                t.setSelectionRange(s, e, d);
              }, [s0, s0 + len, dir || 'none']);
              await page.waitForTimeout(150);
              const pre = await L.sel(page);
              c.before = { sel: pre.sel, chars: pre.text.slice(pre.sel[0], pre.sel[1]), active: pre.active };
              await page.evaluate(() => {
                window.__ens = [];
                if (typeof lyEnsureTokenScheme === 'function' && !window.__wrapped) {
                  const orig = lyEnsureTokenScheme;
                  window.lyEnsureTokenScheme = function () {
                    const d = $ui('lyrics-draft');
                    const r = orig.apply(this, arguments);
                    window.__ens.push({ r, sel: [d.selectionStart, d.selectionEnd, d.selectionDirection], active: document.activeElement === d });
                    return r;
                  };
                  window.__wrapped = true;
                }
              });
              const nCalls = q.calls.length;
              if (trig === 'click') {
                await page.locator('[data-ui="ly-run-review"]:visible').first().click();
              } else if (trig === 'kbd') {
                await page.evaluate(() => [...document.querySelectorAll('[data-ui="ly-run-review"]')].find((b) => b.offsetWidth && b.offsetHeight).focus());
                await page.keyboard.press('Enter');
              } else if (trig === 'tabkbd') {
                let ok = false;
                for (let k = 0; k < 80 && !ok; k++) {
                  await page.keyboard.press('Shift+Tab');
                  ok = await page.evaluate(() => document.activeElement?.dataset?.ui === 'ly-run-review');
                  c.tabPresses = k + 1;
                }
                if (!ok) {
                  await page.evaluate(() => $ui('lyrics-draft').focus());
                  for (let k = 0; k < 80 && !ok; k++) {
                    await page.keyboard.press('Tab');
                    ok = await page.evaluate(() => document.activeElement?.dataset?.ui === 'ly-run-review');
                    c.tabPresses = 'fwd ' + (k + 1);
                  }
                }
                c.tabReached = ok;
                if (!ok) throw Error('Run review not reachable by Tab');
                c.selAtButton = (await L.sel(page)).sel;
                await page.keyboard.press('Enter');
              } else if (trig === 'prog') {
                await page.evaluate(() => LY_ACTIONS['ly-run-review']());
              }
              await L.idle(page);
              const post = await L.sel(page);
              c.sent = q.calls.length - nCalls;
              c.sentReturns = q.calls.slice(nCalls).map((x) => x.lyric_context?.declarations?.returns ?? null);
              c.rewrittenAtSend = post.text !== pre.text;
              c.ensure = await page.evaluate(() => window.__ens);
              c.after = { sel: post.sel, chars: post.text.slice(post.sel[0], post.sel[1]), active: post.active };
              const e0 = post.text.indexOf(anchor) + off;
              c.expected = [e0, e0 + len];
              c.kept = post.sel[0] === c.expected[0] && post.sel[1] === c.expected[1];
              c.row0 = post.text.split('\n')[0];
              // The writer comes back by keyboard: Shift+Tab, else Tab.
              let back = false;
              for (let k = 0; k < 80 && !back; k++) {
                await page.keyboard.press('Shift+Tab');
                back = await page.evaluate(() => document.activeElement === $ui('lyrics-draft'));
                c.backPresses = k + 1;
              }
              if (!back)
                for (let k = 0; k < 120 && !back; k++) {
                  await page.keyboard.press('Tab');
                  back = await page.evaluate(() => document.activeElement === $ui('lyrics-draft'));
                  c.backPresses = 'fwd ' + (k + 1);
                }
              c.backReached = back;
              const ret = await L.sel(page);
              c.onReturn = { sel: ret.sel, active: ret.active };
              if (back) {
                await page.keyboard.type('ZQ', { delay: 30 });
                await page.waitForTimeout(300);
                const typed = await L.sel(page);
                const z = typed.text.indexOf('ZQ');
                c.typedAt = z;
                c.typedRow = typed.text.split('\n')[typed.text.slice(0, z).split('\n').length - 1];
                c.parsedAfterTyping = await L.parse(page, typed.text);
              }
              c.errors = errors.splice(0);
            } catch (x) {
              c.threw = String(x.stack || x).slice(0, 600);
            }
            out.push(c);
            const ens = (c.ensure || []).filter((x) => x.r).map((x) => JSON.stringify(x.sel.slice(0, 2))).join(',');
            console.log(
              `${tree.padEnd(4)} ${trig.padEnd(6)} ${dk.padEnd(5)} ${sk.padEnd(17)} preMig=${c.migratedBeforeSend ? 'Y' : 'n'} sendRewrote=${c.rewrittenAtSend ? 'Y' : 'n'} before=${JSON.stringify(c.before?.sel)} inEnsure=${ens || '-'} after=${JSON.stringify(c.after?.sel)} expected=${JSON.stringify(c.expected)} ${c.kept ? 'KEPT' : 'LOST'} active=${c.after?.active} | return(${c.backPresses})=${JSON.stringify(c.onReturn?.sel?.slice(0, 2))} ZQ@${c.typedAt} row=${JSON.stringify(c.typedRow)} setup=${c.parsedAfterTyping ? c.parsedAfterTyping.setup.length : '?'}${c.threw ? ' THREW ' + c.threw : ''}`
            );
          }
          await ctx.close();
        }
      server.close();
    }
  } finally {
    await browser.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `sel6_${TREES.join('-')}_${TRIGS.join('-')}_${DOCSEL.join('-')}${process.env.MODE ? '_' + process.env.MODE : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
