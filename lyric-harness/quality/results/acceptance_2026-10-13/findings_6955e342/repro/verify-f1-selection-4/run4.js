// verify-f1-selection-4 runner.
//   node run4.js sweep             -> exhaustive in-page lyMigrateSavedReadings + lyMapOffset over
//                                     every caret position of each c4 row (candidate page)
//   node run4.js e2e <tree> <trig,...> [feed]
//        tree: cand | main | base | c61b ; trig: prog | kbd | chat | click
//        feed: paste (default: the doc pasted with a real insertText, the page's own input path)
//              | value (value set with no input event, no refresh: as Undo/Redo restore a step)
'use strict';
const L = require('./lib4.js');
const R = require('./ref4.js');

const BODY = `[VERSE]
Oh--oh, oh my love
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh

[CHORUS]
We're sailing on
Love above`;
const ROWS = {
  RHY: '[SETUP — rhyme groups — 1.T2, 2.end]',
  MANY: '[SETUP — rhyme groups — 2.end,4; 1.T2,3.T2; 5.end, 6]',
  MANY_LAST: '[SETUP — returns — 2.end, 4.end; 5.end,6.end; 1.T2,4.T2]',
  BARE: '[SETUP — rhyme groups — 1.T2,2]',
  // extra (not in c4): the same members in a returns row, and a bare member that is NOT last
  RET_BARE: '[SETUP — returns — 1.T2,2]',
  BARE_MID: '[SETUP — rhyme groups — 3, 1.T2, 2]',
};
const docOf = (row) => `${row}\n\n${BODY}`;
// selections named by member text: [label, startCol, endCol]
function sels(row) {
  const at = (s, from = 0) => {
    const k = row.indexOf(s, from);
    if (k < 0) throw Error(`${s} not in ${row}`);
    return k;
  };
  switch (row) {
    case ROWS.RHY:
      return [['caret 2.|end', at('2.end') + 2, at('2.end') + 2], ['sel 2.end', at('2.end'), at('2.end') + 5], ['caret 1.T|2', at('1.T2') + 3, at('1.T2') + 3], ['sel 1.T2', at('1.T2'), at('1.T2') + 4]];
    case ROWS.MANY:
      return [
        ['caret 2.|end', at('2.end') + 2, at('2.end') + 2],
        ['sel 4', at(',4;') + 1, at(',4;') + 2],
        ['sel 1.T2', at('1.T2'), at('1.T2') + 4],
        ['sel 3.T2', at('3.T2'), at('3.T2') + 4],
        ['caret 5|.end', at('5.end') + 1, at('5.end') + 1],
        ['sel 6', at(' 6]') + 1, at(' 6]') + 2],
      ];
    case ROWS.MANY_LAST:
      return [['caret 2.e|nd', at('2.end') + 3, at('2.end') + 3], ['sel 6.end', at('6.end'), at('6.end') + 5], ['sel 4.T2', at('4.T2]'), at('4.T2]') + 4], ['caret 1.T|2', at('1.T2') + 3, at('1.T2') + 3]];
    case ROWS.BARE:
    case ROWS.RET_BARE:
      return [['caret |2 (bare)', at(',2]') + 1, at(',2]') + 1], ['sel 2 (bare)', at(',2]') + 1, at(',2]') + 2], ['caret 2|] (bare)', at(',2]') + 2, at(',2]') + 2]];
    case ROWS.BARE_MID:
      return [['sel 3 (bare, first)', at('3,'), at('3,') + 1], ['sel 2 (bare, last)', at(' 2]') + 1, at(' 2]') + 2]];
  }
  return [];
}

async function sweep() {
  const { srv, base, html } = await L.serve('cand');
  const browser = await L.launch();
  const out = { page: html, rows: {} };
  try {
    const { page, ctx } = await L.open(browser, base);
    for (const [k, row] of Object.entries(ROWS)) {
      const doc = docOf(row);
      const got = await page.evaluate(
        ([doc, n]) => {
          const done = lyMigrateSavedReadings(doc);
          const maps = [];
          for (let p = 0; p <= n; p++) maps.push(lyMapOffset(doc, done.text, p));
          return { text: done.text, moved: done.moved, carried: done.carried, blocked: done.blocked, maps };
        },
        [doc, row.length]
      );
      const newRow = got.text.split('\n')[0];
      const m = R.rowModel(row, newRow);
      const pos = [];
      for (let c = 0; c <= row.length; c++) {
        const r = R.caretRange(m, c);
        const left = R.regionOf(m, c, 'l'), right = R.regionOf(m, c, 'r');
        pos.push({ col: c, page: got.maps[c], lo: r.lo, hi: r.hi, ok: got.maps[c] >= r.lo && got.maps[c] <= r.hi, left: left && (left.label || left.kind) + '/' + left.kind, right: right && (right.label || right.kind) + '/' + right.kind, shownBefore: R.show(row, c, c), shownPage: R.show(newRow, got.maps[c], got.maps[c]) });
      }
      // first changed column in the row (old) and the common suffix length (lyMapOffset's interval)
      let p = 0;
      while (p < row.length && p < newRow.length && row[p] === newRow[p]) p++;
      let s = 0;
      while (s < row.length - p && s < newRow.length - p && row[row.length - 1 - s] === newRow[newRow.length - 1 - s]) s++;
      // per member: every caret position strictly inside or at its edges + whole-member selection
      const members = m.regions.filter((r) => /member|num|word/.test(r.kind)).map((r) => {
        const inner = pos.filter((q) => q.col >= r.from && q.col <= r.to);
        return { label: r.label, kind: r.kind, from: r.from, to: r.to, text: r.text, now: r.now, carets: inner.length, caretsOk: inner.filter((q) => q.ok).length, wholeSelOk: pos[r.from].ok && pos[r.to].ok, wholeSelPage: [pos[r.from].page, pos[r.to].page], wholeSelRef: [[pos[r.from].lo, pos[r.from].hi], [pos[r.to].lo, pos[r.to].hi]] };
      });
      const selsOut = sels(row).map(([label, a, b]) => {
        const ra = R.caretRange(m, a), rb = R.caretRange(m, b);
        const pa = got.maps[a], pb = got.maps[b];
        return { label, before: [a, b], page: [pa, pb], ref: [[ra.lo, ra.hi], [rb.lo, rb.hi]], ok: pa >= ra.lo && pa <= ra.hi && pb >= rb.lo && pb <= rb.hi, shownBefore: R.show(row, a, b), shownPage: R.show(newRow, pa, pb), shownRef: R.show(newRow, ra.lo, Math.max(ra.lo, rb.hi)) };
      });
      out.rows[k] = { row, newRow, moved: got.moved, carried: got.carried, blocked: got.blocked, firstChangedCol: p, commonSuffix: s, pageMiddleTarget: newRow.length - s, members, sels: selsOut, positions: pos };
      console.log(`\n${k}: ${JSON.stringify(row)} -> ${JSON.stringify(newRow)}  firstChangedCol=${p} commonSuffix=${s} (lyMapOffset sends cols ${p + 1}..${row.length - s - 1} to ${newRow.length - s})`);
      for (const x of selsOut) console.log(`  ${x.ok ? 'OK  ' : 'FAIL'} ${x.label.padEnd(20)} [${x.before}] -> page [${x.page}]  ref ${JSON.stringify(x.ref)}   ${x.shownBefore}  =>  ${x.shownPage}`);
      for (const mm of members) console.log(`  member ${mm.label.padEnd(10)} ${mm.kind.padEnd(15)} cols ${mm.from}-${mm.to}: carets ok ${mm.caretsOk}/${mm.carets}; whole-member selection ${mm.wholeSelOk ? 'OK' : 'FAIL'} page [${mm.wholeSelPage}]`);
    }
    await ctx.close();
  } finally {
    await browser.close();
    srv.close();
  }
  L.fs.writeFileSync(L.path.join(L.O, 'sweep_cand.json'), JSON.stringify(out, null, 1));
}

async function e2e(tree, trigs, feed) {
  const { srv, base, html } = await L.serve(tree);
  const browser = await L.launch();
  const out = { tree, page: html, feed, cases: [] };
  try {
    for (const trig of trigs)
      for (const [rk, row] of Object.entries(ROWS)) {
        const { ctx, page, calls, errors } = await L.open(browser, base);
        const doc = docOf(row);
        for (const [label, a, b] of sels(row)) {
          const c = { tree, trig, feed, row: rk, label };
          try {
            await page.evaluate(() => {
              if (typeof _chatReset === 'function') _chatReset();
              LY.run = null;
              LY.conflict = null;
              LY.gate = null;
            });
            // put the unmarked doc in the editor
            if (feed === 'value') {
              await page.evaluate((t) => {
                $ui('lyrics-draft').value = t;
              }, doc);
            } else {
              await page.evaluate(() => {
                const d = $ui('lyrics-draft');
                d.focus();
                d.select();
              });
              await page.keyboard.insertText(doc);
              await page.waitForTimeout(450); // the 120 ms typing refresh runs
            }
            const fed = await L.editorState(page);
            c.migratedBeforeBoundary = fed.text !== doc;
            // the writer's selection (offsets of the doc as fed; recomputed if the page already changed it)
            const base0 = fed.text === doc ? [a, b] : null;
            if (!base0) {
              c.note = 'text already rewritten before the boundary (typing refresh)';
              c.fedRow = fed.text.split('\n')[0];
            }
            const [sa, sb] = base0 || [a, b];
            await page.evaluate(([s, e]) => {
              const d = $ui('lyrics-draft');
              d.focus();
              d.setSelectionRange(s, e, 'forward');
            }, [sa, sb]);
            await page.waitForTimeout(150);
            const pre = await L.editorState(page);
            c.before = { sel: pre.sel, shown: R.show(pre.text, pre.sel[0], pre.sel[1]) };
            const prediction = await page.evaluate(
              ([t, s, e]) => {
                if (typeof lyMigrateSavedReadings !== 'function') return null;
                const done = lyMigrateSavedReadings(t);
                if (typeof lyMapOffset !== 'function') return { text: done.text };
                return { text: done.text, sel: [lyMapOffset(t, done.text, s), lyMapOffset(t, done.text, e)] };
              },
              [pre.text, pre.sel[0], pre.sel[1]]
            );
            const n0 = calls.length;
            if (trig === 'prog') await page.evaluate(() => LY_ACTIONS['ly-run-review']());
            else if (trig === 'chat') await page.evaluate(() => _chatSend('Tighten line 2', { choice: 'lyrics-edit' }));
            else if (trig === 'kbd') {
              const btn = page.locator('[data-ui="ly-run-review"]:visible').first();
              await btn.focus();
              await page.keyboard.press('Enter');
            } else if (trig === 'click') await page.locator('[data-ui="ly-run-review"]:visible').first().click();
            await page.waitForTimeout(300);
            await page.waitForFunction(() => typeof chatState === 'undefined' || !chatState.busy, null, { timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(150);
            const post = await L.editorState(page);
            c.after = { sel: post.sel, focused: post.focused, shown: R.show(post.text, post.sel[0], post.sel[1]), row: post.text.split('\n')[0] };
            c.migratedAtBoundary = post.text !== pre.text;
            c.requests = calls.length - n0;
            c.sentDecl = calls.slice(n0).map((x) => (x.lyric_context && x.lyric_context.declarations) || null);
            c.pagePrediction = prediction && prediction.sel ? prediction.sel : null;
            c.predictionMatches = prediction && prediction.sel ? post.sel[0] === prediction.sel[0] && post.sel[1] === prediction.sel[1] : null;
            if (c.migratedAtBoundary) {
              const ra = R.docRange(pre.text, post.text, pre.sel[0]), rb = R.docRange(pre.text, post.text, pre.sel[1]);
              c.ref = ra && rb ? [[ra.lo, ra.hi], [rb.lo, rb.hi]] : null;
              c.sameChars = !!(ra && rb) && post.sel[0] >= ra.lo && post.sel[0] <= ra.hi && post.sel[1] >= rb.lo && post.sel[1] <= rb.hi;
              c.refShown = ra && rb ? R.show(post.text, ra.lo, Math.max(ra.lo, rb.hi)) : null;
            } else c.sameChars = post.sel[0] === pre.sel[0] && post.sel[1] === pre.sel[1];
            // the writer comes back to the editor (focus keeps the selection) and types two keys
            await page.evaluate(() => $ui('lyrics-draft').focus());
            await page.keyboard.type('ZQ', { delay: 25 });
            await page.waitForTimeout(400);
            const typed = await L.editorState(page);
            const z = typed.text.indexOf('ZQ');
            c.typed = { at: z, row0: typed.text.split('\n')[0], lineOfZQ: typed.text.slice(0, z).split('\n').length };
            c.parseTyped = await page.evaluate((t) => {
              if (typeof lyParse !== 'function' || typeof lyDeclarationsOf !== 'function') return null;
              return JSON.parse(JSON.stringify(lyDeclarationsOf(lyParse(t))));
            }, typed.text);
            c.errors = errors.splice(0);
          } catch (x) {
            c.threw = String(x.stack || x);
          }
          out.cases.push(c);
          console.log(`${tree}.${trig}.${feed}.${rk} ${label}: migratedBefore=${c.migratedBeforeBoundary} migratedAtBoundary=${c.migratedAtBoundary} sameChars=${c.sameChars} predMatch=${c.predictionMatches} req=${c.requests}\n   before ${JSON.stringify(c.before && c.before.sel)} ${JSON.stringify(c.before && c.before.shown)}\n   after  ${JSON.stringify(c.after && c.after.sel)} ${JSON.stringify(c.after && c.after.shown)} focused=${c.after && c.after.focused}\n   ref    ${JSON.stringify(c.ref || null)} ${JSON.stringify(c.refShown || null)}\n   typed  ${JSON.stringify(c.typed && c.typed.row0)} decl=${JSON.stringify(c.parseTyped)}${c.threw ? '\n   THREW ' + c.threw : ''}${c.errors && c.errors.length ? '\n   pageerrors ' + JSON.stringify(c.errors) : ''}`);
        }
        await ctx.close();
      }
  } finally {
    await browser.close();
    srv.close();
  }
  L.fs.writeFileSync(L.path.join(L.O, `e2e_${tree}_${trigs.join('-')}_${feed}.json`), JSON.stringify(out, null, 1));
}

const [mode, tree, trigs, feed] = process.argv.slice(2);
(mode === 'sweep' ? sweep() : e2e(tree, (trigs || 'prog').split(','), feed || 'paste')).catch((e) => {
  console.error(e);
  process.exit(1);
});
