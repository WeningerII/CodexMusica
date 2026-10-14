// verify-f1-selection-3: does a caret/selection inside (or right after) the
// CHANGED member of an unmarked row stay on the same characters when a
// boundary migrates the row? Written from scratch.
// Usage: node sel.js <cand|c61b|main> [trigger,...]   triggers: ensure, click, send
'use strict';
const L = require('./lib.js');
const TREE = process.argv[2] || 'cand';
const TRIGS = (process.argv[3] || 'ensure,click,send').split(',');

const BODY = '[VERSE]\nOh--oh, oh my love\nI walk the line tonight\nWell-worn shoes upon the floor\nOh, oh, I said oh\n\n[CHORUS]\nWe\'re sailing on\nLove above';
// [anchor in row, offset from anchor, length]
const ROWS = {
  RET: { row: '[SETUP — returns — 1.T2, 2.end]', sels: { C_in_T2: ['1.T2', 3, 0], C_after_T2: ['1.T2', 4, 0], C_sel_T2: ['1.T2', 0, 4], U_sel_2end: ['2.end', 0, 5], S_body_walk: ['BODY:walk', 1, 0] } },
  RHY: { row: '[SETUP — rhyme groups — 1.T2, 2.end]', sels: { C_after_T2: ['1.T2', 4, 0], C_sel_T2: ['1.T2', 0, 4] } },
  RET_LAST: { row: '[SETUP — returns — 2.end, 1.T2]', sels: { C_after_T2: ['1.T2', 4, 0], C_sel_T2: ['1.T2', 0, 4] } },
  READ: { row: '[SETUP — reading — token 2 "oh" in "Oh--oh, oh my love" — OW1 — declared — source: me]', sels: { C_sel_num: ['token 2', 6, 1], C_after_num: ['token 2', 7, 0], U_sel_OW1: ['OW1', 0, 3] } },
};
const ONLY = process.env.ROWS ? process.env.ROWS.split(',') : null;
function selOf(doc, row, [anchor, off, len]) {
  const at = anchor.startsWith('BODY:') ? doc.indexOf(anchor.slice(5), doc.indexOf('[VERSE]')) : doc.indexOf(row) + row.indexOf(anchor);
  return [at + off, at + off + len];
}

(async () => {
  const { server, base } = await L.serveTree(TREE);
  const browser = await L.launch();
  const out = { tree: TREE, dir: L.TREES[TREE], cases: [] };
  try {
    for (const trig of TRIGS)
      for (const [rk, rc] of Object.entries(ROWS)) {
        if (ONLY && !ONLY.includes(rk)) continue;
        for (const [sk, spec] of Object.entries(rc.sels)) {
          const refocusModes = trig === 'ensure' ? ['none'] : ['tab', 'mouse'];
          for (const refocus of refocusModes) {
            const { ctx, page, calls, errors } = await L.open(browser, base);
            if (process.env.RAW) await page.evaluate(() => (window.__RAW = true));
            const doc = `${rc.row}\n\n${BODY}`;
            const c = { id: `${TREE}${process.env.RAW ? '.raw' : ''}.${trig}.${rk}.${sk}.${refocus}`, row: rc.row };
            try {
              // The writer's text, as typed/pasted: value, saved, one step, the typing refresh.
              await page.evaluate((t) => {
                const d = $ui('lyrics-draft');
                d.value = t;
                uiSaveLyrics();
                pushHistory();
                if (!window.__RAW) lyRefresh(true);
              }, doc);
              await page.waitForTimeout(300);
              const [s, e] = selOf(doc, rc.row, spec);
              await page.evaluate(([s, e]) => {
                const d = $ui('lyrics-draft');
                d.focus();
                d.setSelectionRange(s, e, 'forward');
              }, [s, e]);
              await page.waitForTimeout(150);
              const pre = await L.state(page);
              c.preUnchangedByRefresh = pre.text === doc;
              c.before = { sel: pre.sel, shown: L.show(pre.text, pre.sel[0], pre.sel[1]), active: pre.active };
              const n0 = calls.length;
              if (trig === 'ensure') {
                c.ensureReturned = await page.evaluate(() => (typeof lyEnsureTokenScheme === 'function' ? lyEnsureTokenScheme() : 'absent'));
              } else if (trig === 'click') {
                const btn = page.locator('[data-ui="ly-run-review"]:visible').first();
                c.buttonCount = await page.locator('[data-ui="ly-run-review"]:visible').count();
                await btn.click();
              } else if (trig === 'send') {
                await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
                await page.waitForTimeout(200);
                c.chatActive = await page.evaluate(() => document.activeElement && document.activeElement.id);
                await page.keyboard.type('Tighten line 2', { delay: 5 });
                await page.locator('#chat-send').click();
              }
              await page.waitForTimeout(400);
              await page.waitForFunction(() => !chatState.busy, null, { timeout: 15000 }).catch(() => {});
              await page.waitForTimeout(150);
              const post = await L.state(page);
              c.migrated = post.text !== pre.text;
              c.sentDecl = calls.slice(n0).map((x) => (x.lyric_context ? x.lyric_context.declarations : null));
              c.after = { sel: post.sel, shown: L.show(post.text, post.sel[0], post.sel[1]), active: post.active };
              if (c.migrated) {
                const r0 = L.refRange2(pre.text, post.text, pre.sel[0]);
                const r1 = L.refRange2(pre.text, post.text, pre.sel[1]);
                c.refLcs = [L.refRange(pre.text, post.text, pre.sel[0]), L.refRange(pre.text, post.text, pre.sel[1])];
                c.ref = [r0, r1];
                c.refShown = L.show(post.text, r0.lo, r1.hi);
                c.sameChars = post.sel[0] >= r0.lo && post.sel[0] <= r0.hi && post.sel[1] >= r1.lo && post.sel[1] <= r1.hi;
                c.pageMap = TREE === 'cand' ? await page.evaluate(([a, b, s, e]) => [lyMapOffset(a, b, s), lyMapOffset(a, b, e)], [pre.text, post.text, pre.sel[0], pre.sel[1]]) : null;
              } else c.sameChars = post.sel[0] === pre.sel[0] && post.sel[1] === pre.sel[1];
              // Return to the editor, then type two keys.
              if (refocus === 'tab') {
                let k = 0;
                while (k < 400 && (await page.evaluate(() => document.activeElement !== $ui('lyrics-draft')))) {
                  await page.keyboard.press('Shift+Tab');
                  k++;
                }
                c.tabPresses = k;
              } else if (refocus === 'mouse') {
                // click on the body word "tonight"
                const box = await page.locator('#lyrics-draft').boundingBox();
                c.draftBox = box;
                await page.locator('#lyrics-draft').click({ position: { x: Math.min(120, box.width - 5), y: Math.min(60, box.height - 5) } });
              }
              await page.waitForTimeout(150);
              const ref = await L.state(page);
              c.refocused = { active: ref.active, sel: ref.sel, shown: L.show(ref.text, ref.sel[0], ref.sel[1]) };
              if (ref.active === 'lyrics-draft') {
                await page.keyboard.type('ZQ', { delay: 20 });
                await page.waitForTimeout(300);
                const typed = await L.state(page);
                c.typedLine = typed.text.split('\n').find((l) => l.includes('ZQ'));
                c.rowAfterTyping = typed.text.split('\n')[0];
                c.parsedAfterTyping = await L.parse(page, typed.text);
                // what the next send would carry
                c.nextContext = await page.evaluate(() => {
                  const r = window.uiLyricContext ? window.uiLyricContext('lyrics-edit') : null;
                  return r && (r.blocked ? { blocked: r.blocked } : { declarations: r.declarations || null });
                });
                c.reviewItems = await page.evaluate(() => {
                  try {
                    return lyLocalChecks(lyParse($ui('lyrics-draft').value)).map((i) => `${i.tone || ''}|${i.title}`);
                  } catch (x) {
                    return 'ERR ' + x.message;
                  }
                });
              }
              c.errors = errors;
            } catch (x) {
              c.threw = String((x && x.stack) || x);
            }
            out.cases.push(c);
            console.log(`${c.id}: preUnmarked=${c.preUnchangedByRefresh} migrated=${c.migrated} sameChars=${c.sameChars}\n  before ${JSON.stringify(c.before)}\n  after  ${JSON.stringify(c.after)}\n  ref    ${JSON.stringify(c.ref || null)} ${JSON.stringify(c.refShown || '')}  pageMap=${JSON.stringify(c.pageMap || null)}\n  sent   ${JSON.stringify(c.sentDecl)}\n  refocus(${refocus}) ${JSON.stringify(c.refocused)} tabs=${c.tabPresses ?? ''}\n  typed  ${JSON.stringify(c.typedLine || null)}\n  decl   ${JSON.stringify(c.parsedAfterTyping ? c.parsedAfterTyping.decl : null)}\n  next   ${JSON.stringify(c.nextContext || null)}${c.threw ? '\n  THREW ' + c.threw : ''}${c.errors && c.errors.length ? '\n  ERRORS ' + JSON.stringify(c.errors) : ''}`);
            await ctx.close();
          }
        }
      }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.V, `sel_${TREE}${process.env.RAW ? '_raw' : ''}_${TRIGS.join('-')}${process.env.ROWS ? '_' + process.env.ROWS.replace(/,/g, '-') : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
