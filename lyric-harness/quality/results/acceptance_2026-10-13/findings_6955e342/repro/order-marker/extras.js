// BB8 order-marker extras (one tree per run). Same start as orders.js
// (BODY typed in whole, then the unmarked row pasted by real Ctrl+V).
//  X1_appUndo      : paste -> Rhymes Remove link -> APP Undo (#btn-undo, the page's own history) -> Run review
//  X2_appUndoRedo  : paste -> Remove link -> APP Undo -> APP Redo (#btn-redo) -> Run review
//  X3_nativeUndo   : paste -> Remove link -> focus the textarea, BROWSER-NATIVE Ctrl+Z (the app ignores Ctrl+Z in a textarea) -> Run review
//  X4_wordRules    : paste -> Word rules form apply (lySetSetup('require'), a NON-group key) -> Run review
//  X5_relationOnly : paste -> Rhymes form, relation changed only (lySetSetup('relation')) -> Run review
//  X6_markedTyped  : start with a page-written MARKED row "[SETUP — rhyme groups — 2,3 — cut v2]", type "1.T4,8; " into it by hand
//                    -> O1 (Remove link on 2,3 -> review) and O2 (review -> Remove link -> review)
//  X7_verdict      : body whose line 8 is "And love above"; unmarked "[SETUP — returns — 1.T4,8.T2]";
//                    O1 (placed form -> review) vs O2 (review -> placed form -> review): the harness's placed-return verdict
//  X8_reviewCard   : O1 and O2 of RG4.remove.review: the Review tab's text after each step (is there any notice on the form path?)
// Usage: node extras.js <cand|c61b|main> [filter]
'use strict';
const L = require('./lib.js');
const TREE = process.argv[2] || 'cand';
const FILTER = process.argv[3] ? new RegExp(process.argv[3]) : null;
const BODY_A = `[VERSE]
Oh--oh, oh my love
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh

[CHORUS]
We're sailing on
I hold the dove
Run to the sea
Love above`;
const BODY_V = BODY_A.replace('Love above', 'And love above');
const RG4 = '[SETUP — rhyme groups — 1.T4,8; 2,3]';

const setupRows = (page) => page.evaluate(() => $ui('lyrics-draft').value.split('\n').filter((r) => /^\s*\[SETUP/.test(r)));
const cut = (rows) => rows.map((r) => (/—\s*cut\s+v\d+\s*\]\s*$/.test(r) ? r.match(/cut\s+v\d+/)[0] : 'UNMARKED'));
async function openTool(page, id) {
  if (!(await page.evaluate(() => LY.tab === 'tools'))) {
    const tab = page.locator('[data-ui="ly-tab"][data-id="tools"]:visible').first();
    if (await tab.count()) await tab.click();
    else await page.evaluate(() => LY_ACTIONS['ly-tab']('tools'));
    await page.waitForTimeout(200);
  }
  if (!(await page.evaluate((id) => LY.tool === id, id))) await page.click(`[data-ui="ly-tool"][data-id="${id}"]`);
  await page.waitForTimeout(250);
}
async function reviewText(page) {
  const was = await page.evaluate(() => LY.tab);
  await page.evaluate(() => LY_ACTIONS['ly-tab']('review'));
  await page.waitForTimeout(250);
  const t = await page.evaluate(() => {
    const p = document.querySelector('#ly-panel-review, [data-ui="ly-panel-review"]') || document.querySelector('.ly-panel');
    return p ? p.innerText.replace(/\s+/g, ' ').trim() : '';
  });
  await page.evaluate((was) => LY_ACTIONS['ly-tab'](was), was);
  return t;
}
async function snap(page, step, log, { review = false } = {}) {
  const rows = await setupRows(page);
  const s = { step, rows, cut: cut(rows), toasts: await L.toasts(page), hist: await page.evaluate(() => ({ idx: app.historyIndex, n: app.history.length })) };
  if (review) {
    const t = await reviewText(page);
    s.reviewMentionsCut = /renumbered|word cut|cut mark|earlier cut/i.test(t);
    s.reviewExcerpt = (t.match(/[^.]*(renumbered|word cut|cut mark|earlier cut)[^.]*\./i) || [''])[0].slice(0, 400);
  }
  log.push(s);
  console.log(`  [${step}] rows=${JSON.stringify(rows)} cut=${JSON.stringify(s.cut)} hist=${JSON.stringify(s.hist)}${s.toasts.length ? ` toasts=${JSON.stringify(s.toasts)}` : ''}${review ? ` reviewMentionsCut=${s.reviewMentionsCut} ${JSON.stringify(s.reviewExcerpt)}` : ''}`);
  return s;
}
async function start(page, body) {
  await page.evaluate(() => {
    const d = $ui('lyrics-draft');
    d.focus();
    d.select();
  });
  await page.keyboard.insertText(body);
  await page.waitForTimeout(300);
  await page.evaluate(() => $ui('lyrics-draft').blur());
  await page.waitForTimeout(200);
}
async function paste(page, row) {
  await page.evaluate(() => {
    const d = $ui('lyrics-draft');
    d.focus();
    d.setSelectionRange(0, 0);
  });
  await page.evaluate((t) => navigator.clipboard.writeText(t), `${row}\n\n`);
  await page.keyboard.press('Control+V');
  await page.waitForTimeout(500);
}
async function removeOther(page) {
  await openTool(page, 'rhymes');
  await page.check('input[name="ly-link-group"][value="1"]');
  await page.waitForTimeout(200);
  await page.click('[data-ui="ly-link-remove"]');
  await page.waitForTimeout(400);
}
async function placed(page, lines) {
  await openTool(page, 'repeats-voices');
  for (const n of lines) {
    await page.evaluate((n) => {
      const d = $ui('lyrics-draft');
      const r = lyParse(d.value).sung[n - 1];
      const at = d.value.split('\n').slice(0, r.i).join('\n').length + 1;
      d.focus();
      d.setSelectionRange(at + 1, at + 1);
      d.dispatchEvent(new Event('keyup'));
    }, n);
    await page.waitForTimeout(250);
    const det = page.locator('details.ly-adv:has(#ly-placed-place)');
    if (!(await det.evaluate((e) => e.open))) await det.locator('summary').click();
    await page.selectOption('#ly-placed-place', 'head');
    await page.click('[data-ui="ly-placed-add"]');
    await page.waitForTimeout(200);
  }
  await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
  await page.waitForTimeout(400);
}
async function review(page, q, sends, at) {
  const n = q.calls.length;
  await page.click('[data-ui="ly-run-review"].ly-run');
  await L.waitIdle(page);
  const calls = [];
  for (const c of q.calls.slice(n)) {
    const ctx = c.lyric_context;
    calls.push({ declarations: ctx ? ctx.declarations : null, document: ctx ? ctx.document : null, sung: ctx ? await page.evaluate((d) => lyParse(d).sung.map((s) => s.text), ctx.document) : null });
  }
  sends.push({ at, calls });
  console.log(`  SEND ${at}: ${JSON.stringify(calls.map((c) => c.declarations))}`);
}
const CASES = {
  async X1_appUndo(page, q, c) {
    await start(page, BODY_A);
    await paste(page, RG4);
    await snap(page, '1 pasted', c.steps);
    await removeOther(page);
    await snap(page, '2 Remove link (form)', c.steps);
    await page.click('#btn-undo');
    await page.waitForTimeout(400);
    await snap(page, '3 APP Undo (#btn-undo)', c.steps);
    await review(page, q, c.sends, '4 Run review');
    await snap(page, '4 after review', c.steps);
  },
  async X2_appUndoRedo(page, q, c) {
    await start(page, BODY_A);
    await paste(page, RG4);
    await snap(page, '1 pasted', c.steps);
    await removeOther(page);
    await snap(page, '2 Remove link (form)', c.steps);
    await page.click('#btn-undo');
    await page.waitForTimeout(400);
    await snap(page, '3 APP Undo', c.steps);
    await page.click('#btn-redo');
    await page.waitForTimeout(400);
    await snap(page, '4 APP Redo (#btn-redo)', c.steps);
    await review(page, q, c.sends, '5 Run review');
    await snap(page, '5 after review', c.steps);
  },
  async X3_nativeUndo(page, q, c) {
    await start(page, BODY_A);
    await paste(page, RG4);
    await snap(page, '1 pasted', c.steps);
    await removeOther(page);
    await snap(page, '2 Remove link (form)', c.steps);
    await page.evaluate(() => $ui('lyrics-draft').focus());
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(400);
    await snap(page, '3 BROWSER-NATIVE Ctrl+Z #1 in textarea', c.steps);
    await page.keyboard.press('Control+Z');
    await page.waitForTimeout(400);
    await snap(page, '3b BROWSER-NATIVE Ctrl+Z #2 in textarea', c.steps);
    await page.evaluate(() => $ui('lyrics-draft').blur());
    await review(page, q, c.sends, '4 Run review');
    await snap(page, '4 after review', c.steps);
  },
  async X4_wordRules(page, q, c) {
    await start(page, BODY_A);
    await paste(page, RG4);
    await snap(page, '1 pasted', c.steps);
    await openTool(page, 'word-rules');
    await page.fill('#ly-require-new', 'love');
    await page.click('[data-ui="ly-word-add"][data-id="require"]');
    await page.waitForTimeout(200);
    await page.click('.ly-pending [data-ui="ly-draft-apply"][data-id="word-rules"]');
    await page.waitForTimeout(400);
    await snap(page, '2 Word rules apply (require)', c.steps);
    await review(page, q, c.sends, '3 Run review');
    await snap(page, '3 after review', c.steps);
  },
  async X5_relationOnly(page, q, c) {
    await start(page, BODY_A);
    await paste(page, RG4);
    await snap(page, '1 pasted', c.steps);
    await openTool(page, 'rhymes');
    const segs = page.locator('.ly-seg [data-ui="ly-relation"]');
    const n = await segs.count();
    await segs.nth(n > 1 ? 1 : 0).click();
    await page.waitForTimeout(200);
    await page.click('.ly-pending [data-ui="ly-draft-apply"][data-id="rhymes"]');
    await page.waitForTimeout(400);
    await snap(page, '2 Rhymes relation only apply', c.steps);
    await review(page, q, c.sends, '3 Run review');
    await snap(page, '3 after review', c.steps);
  },
  async X6_markedTyped_O1(page, q, c) {
    await start(page, `[SETUP — rhyme groups — 2,3 — cut v2]\n\n${BODY_A}`);
    await page.evaluate(() => {
      const d = $ui('lyrics-draft');
      d.focus();
      const k = d.value.indexOf('2,3');
      d.setSelectionRange(k, k);
    });
    await page.keyboard.type('1.T4,8; ', { delay: 5 });
    await page.waitForTimeout(400);
    await snap(page, '1 typed into a MARKED row', c.steps);
    await openTool(page, 'rhymes');
    await page.check('input[name="ly-link-group"][value="1"]');
    await page.click('[data-ui="ly-link-remove"]');
    await page.waitForTimeout(400);
    await snap(page, '2 Remove link (form)', c.steps);
    await review(page, q, c.sends, '3 Run review');
    await snap(page, '3 after review', c.steps);
  },
  async X6_markedTyped_O2(page, q, c) {
    await start(page, `[SETUP — rhyme groups — 2,3 — cut v2]\n\n${BODY_A}`);
    await page.evaluate(() => {
      const d = $ui('lyrics-draft');
      d.focus();
      const k = d.value.indexOf('2,3');
      d.setSelectionRange(k, k);
    });
    await page.keyboard.type('1.T4,8; ', { delay: 5 });
    await page.waitForTimeout(400);
    await snap(page, '1 typed into a MARKED row', c.steps);
    await review(page, q, c.sends, '2 Run review');
    await snap(page, '2 after review', c.steps);
    await openTool(page, 'rhymes');
    await page.check('input[name="ly-link-group"][value="1"]');
    await page.click('[data-ui="ly-link-remove"]');
    await page.waitForTimeout(400);
    await snap(page, '3 Remove link (form)', c.steps);
    await review(page, q, c.sends, '4 Run review');
    await snap(page, '4 after review', c.steps);
  },
  async X7_verdict_O1(page, q, c) {
    await start(page, BODY_V);
    await paste(page, '[SETUP — returns — 1.T4,8.T2]');
    await snap(page, '1 pasted', c.steps);
    await placed(page, [2, 6]);
    await snap(page, '2 placed return form apply', c.steps);
    await review(page, q, c.sends, '3 Run review');
    await snap(page, '3 after review', c.steps);
  },
  async X7_verdict_O2(page, q, c) {
    await start(page, BODY_V);
    await paste(page, '[SETUP — returns — 1.T4,8.T2]');
    await snap(page, '1 pasted', c.steps);
    await review(page, q, c.sends, '2 Run review');
    await snap(page, '2 after review', c.steps);
    await placed(page, [2, 6]);
    await snap(page, '3 placed return form apply', c.steps);
    await review(page, q, c.sends, '4 Run review');
    await snap(page, '4 after review', c.steps);
  },
  // X9: a structural Form & story edit (Move down, lyEditSections -> lyAssemble), not lySetSetup:
  // the row's line numbers follow their lines and its cut state is kept as it was.
  async X9_sectionMove(page, q, c) {
    await start(page, BODY_A);
    await paste(page, RG4);
    await snap(page, '1 pasted', c.steps);
    await openTool(page, 'form-story');
    await page.click('[data-ui="ly-sec-move"][data-id="0:1"]');
    await page.waitForTimeout(400);
    await snap(page, '2 Form & story: VERSE Move down', c.steps);
    await review(page, q, c.sends, '3 Run review');
    await snap(page, '3 after review', c.steps);
  },
  async X8_reviewCard_O1(page, q, c) {
    await start(page, BODY_A);
    await paste(page, RG4);
    await snap(page, '1 pasted', c.steps, { review: true });
    await removeOther(page);
    await snap(page, '2 Remove link (form)', c.steps, { review: true });
    await review(page, q, c.sends, '3 Run review');
    await snap(page, '3 after review', c.steps, { review: true });
  },
  async X8_reviewCard_O2(page, q, c) {
    await start(page, BODY_A);
    await paste(page, RG4);
    await snap(page, '1 pasted', c.steps, { review: true });
    await review(page, q, c.sends, '2 Run review');
    await snap(page, '2 after review', c.steps, { review: true });
    await removeOther(page);
    await snap(page, '3 Remove link (form)', c.steps, { review: true });
    await review(page, q, c.sends, '4 Run review');
    await snap(page, '4 after review', c.steps, { review: true });
  },
};
(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const out = { tree: TREE, sha: L.TREES[TREE].sha, cases: [] };
  try {
    for (const [id, fn] of Object.entries(CASES)) {
      if (FILTER && !FILTER.test(id)) continue;
      const { ctx, page, q, errors } = await L.boot(browser, base);
      const c = { id, tree: TREE, steps: [], sends: [] };
      console.log(`\n### ${TREE} ${id}`);
      try {
        await fn(page, q, c);
      } catch (x) {
        c.threw = String(x.stack || x);
        console.log('  THREW', c.threw.split('\n').slice(0, 3).join(' | '));
      }
      c.errors = errors;
      if (errors.length) console.log('  pageerrors', JSON.stringify(errors));
      out.cases.push(c);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `extras_${TREE}${FILTER ? '_' + process.argv[3].replace(/[^A-Za-z0-9]+/g, '_') : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
