// p3 (BB8 order-marker at 8ea94ac9): the two form writers the earlier probes did not
// drive -- "Remove the link" for undecided members (ly-drop-undecided) and Keep / Remove on
// a carried member (ly-carried-keep / ly-carried-remove) -- plus whole-line returns, a member
// the policy pass BLOCKS, and per-step evidence of the renumbering record, the Review card
// and the form's own message. Same protocol as check-order-marker (p2/com.js helpers):
//   ORDER 1: start text -> real Ctrl+V of the unmarked row at offset 0 -> form commit (real
//            clicks) -> send.
//   ORDER 2: start text -> the same paste -> send -> the same form commit -> send.
// Every step records: raw [SETUP] rows, their cut marker, the toasts, the renumbering record
// the page keeps (app.lyricMeta.renumbered; at older heads app.lyricMeta.ui.renumbered), the
// Review card's title (lyRenumberedCheck, display only) and the Review panel's own text, and
// the APP history index. Every send records the exact /chat lyric_context.declarations and the
// sung lines of lyric_context.document, or the refusal (no /chat call; its toast).
// Usage: node run.js <cand|c0af|c695|c61b|main> [id-substring]
'use strict';
const C = require('../p2/com.js');
const TREE = process.argv[2] || 'cand';
const FILTER = process.argv[3] || '';
const OUT = C.path.join(C.S, 'h8ea/order-marker/p3');

const SONG = ['[VERSE]', 'Oh--oh, oh my love', 'I walk the line tonight', 'I hold you tight', 'Well-worn shoes upon the floor', 'The rain comes down', 'I hear the sound', 'The night is cold', 'Love above', '', '[BRIDGE]', 'Go slow', 'Hold on', '', '[BRIDGE]', 'Go slow', 'Hold on'];
const BODY_A = SONG.join('\n');
const BODY_W = [...SONG, '', '[OUTRO]', 'Oh--oh, oh my love'].join('\n'); // line 13 = line 1
const BODY_V = BODY_A.replace('\nLove above\n', '\nAnd love above\n');

const setupRows = (t) => t.split('\n').filter((l) => /^\s*\[SETUP/.test(l));
const marker = (rows) => rows.map((r) => (/—\s*cut\s+\S+\s*\]\s*$/.test(r) ? r.match(/cut\s+\S+?(?=\s*\]\s*$)/)[0] : 'UNMARKED'));

async function openReview(page) {
  await page.locator('[data-ui="ly-tab"][data-id="review"]').first().click();
  await page.waitForTimeout(250);
}
async function reviewClick(page, act, how) {
  await openReview(page);
  const b = page.locator(`[data-ui="${act}"]:visible`);
  how[`${act}_buttons`] = await b.count();
  how[`${act}_ids`] = await b.evaluateAll((xs) => xs.map((x) => x.getAttribute('data-id')));
  if (!(await b.count())) throw new Error(`NOT REACHABLE: no visible ${act} button in Review`);
  await b.first().click();
  await page.waitForTimeout(450);
}
async function removeLinkB(page) {
  await C.openTool(page, 'rhymes');
  await page.locator('input[name="ly-link-group"][value="1"]').check();
  await page.waitForTimeout(200);
  await page.locator('[data-ui="ly-link-remove"]').click();
  await page.waitForTimeout(400);
}
async function addLink57(page) {
  await C.openTool(page, 'rhymes');
  for (const n of ['5', '7']) {
    await page.selectOption('#ly-link-place', 'end');
    await page.waitForTimeout(100);
    await page.selectOption('#ly-link-line', n);
    await page.waitForTimeout(200);
    await page.locator('[data-ui="ly-link-add"]').click();
    await page.waitForTimeout(200);
  }
  await page.locator('[data-ui="ly-draft-apply"][data-id="rhymes"]').first().click();
  await page.waitForTimeout(400);
}
async function placed26(page) {
  await C.openTool(page, 'repeats-voices');
  const det = page.locator('details.ly-adv:has(#ly-placed-place)');
  if (!(await det.evaluate((d) => d.open))) await det.locator('summary').click();
  for (const n of [2, 6]) {
    await C.caretToLine(page, n);
    await page.selectOption('#ly-placed-place', 'head');
    await page.waitForTimeout(100);
    await page.locator('[data-ui="ly-placed-add"]').click();
    await page.waitForTimeout(250);
    const d2 = page.locator('details.ly-adv:has(#ly-placed-place)');
    if (!(await d2.evaluate((d) => d.open))) await d2.locator('summary').click();
  }
  await page.locator('[data-ui="ly-draft-apply"][data-id="repeats-voices"]').first().click();
  await page.waitForTimeout(400);
}
async function declare(page) {
  await C.openTool(page, 'repeats-voices');
  await page.locator('[data-ui="ly-declare-repeat"]').first().click();
  await page.waitForTimeout(400);
}
const FORMS = {
  drop: (page, how) => reviewClick(page, 'ly-drop-undecided', how),
  keep: (page, how) => reviewClick(page, 'ly-carried-keep', how),
  remove: (page, how) => reviewClick(page, 'ly-carried-remove', how),
  removeLink: (page) => removeLinkB(page),
  add: (page) => addLink57(page),
  placed: (page) => placed26(page),
  declare: (page) => declare(page),
};
// id, start text, pasted row, form, send kind, optional final extra form step
const CASES = [
  { id: 'DU1.drop.review', start: `[SETUP — rhyme groups — 2,3 — cut v9]\n\n${BODY_A}`, row: '[SETUP — rhyme groups — 1.T4,8]\n', form: 'drop', send: 'review' },
  { id: 'DU1.drop.dock', start: `[SETUP — rhyme groups — 2,3 — cut v9]\n\n${BODY_A}`, row: '[SETUP — rhyme groups — 1.T4,8]\n', form: 'drop', send: 'dock' },
  { id: 'DUR.drop.review', start: `[SETUP — returns — 9,11 — cut v9]\n\n${BODY_A}`, row: '[SETUP — returns — 1.T4,8.T1]\n', form: 'drop', send: 'review' },
  { id: 'DU2.drop.review', start: BODY_A, row: '[SETUP — rhyme groups — 1.T4,8; 2.T9 (numbered under the earlier cut),3]\n\n', form: 'drop', send: 'review' },
  { id: 'KC1.keep.review', start: BODY_A, row: '[SETUP — rhyme groups — 1.T4,8; 1.head (carried across the word-cut change),4.head]\n\n', form: 'keep', send: 'review' },
  { id: 'KC1.keep.dock', start: BODY_A, row: '[SETUP — rhyme groups — 1.T4,8; 1.head (carried across the word-cut change),4.head]\n\n', form: 'keep', send: 'dock' },
  { id: 'KC1.remove.review', start: BODY_A, row: '[SETUP — rhyme groups — 1.T4,8; 1.head (carried across the word-cut change),4.head]\n\n', form: 'remove', send: 'review' },
  { id: 'KCB.keep.review', start: BODY_A, row: '[SETUP — rhyme groups — 1.T4,8; 1 (carried across the word-cut change),4]\n\n', form: 'keep', send: 'review' },
  { id: 'KCR.keep.review', start: BODY_A, row: '[SETUP — returns — 1.T4,8.T1; 2.head (carried across the word-cut change),6.head]\n\n', form: 'keep', send: 'review' },
  { id: 'KCW.keep.review', start: BODY_A, row: '[SETUP — returns — 1.T4,8.T1; 9 (carried across the word-cut change),11]\n\n', form: 'keep', send: 'review' },
  { id: 'KCW.remove.review', start: BODY_A, row: '[SETUP — returns — 1.T4,8.T1; 9 (carried across the word-cut change),11]\n\n', form: 'remove', send: 'review' },
  { id: 'RW.placed.review', start: BODY_W, row: '[SETUP — returns — 1.T4,8.T1; 1,13]\n\n', form: 'placed', send: 'review' },
  { id: 'RW.declare.review', start: BODY_W, row: '[SETUP — returns — 1.T4,8.T1; 1,13]\n\n', form: 'declare', send: 'review' },
  { id: 'RGW.add.review', start: BODY_W, row: '[SETUP — rhyme groups — 1.T4,8; 1,13]\n\n', form: 'add', send: 'review' },
  { id: 'BL.removeLink.review', start: BODY_A, row: '[SETUP — rhyme groups — 1.T1,8; 2,3]\n\n', form: 'removeLink', send: 'review', then: 'drop' },
  { id: 'X7v.placed.dock', start: BODY_V, row: '[SETUP — returns — 1.T4,8.T2]\n\n', form: 'placed', send: 'dock' },
  { id: 'X7v.declare.review', start: BODY_V, row: '[SETUP — returns — 1.T4,8.T2]\n\n', form: 'declare', send: 'review' },
];

async function state(page) {
  return page.evaluate(() => {
    const meta = app.lyricMeta || {};
    const rec = meta.renumbered || (meta.ui && meta.ui.renumbered) || null;
    let card = null;
    try {
      const c = typeof lyRenumberedCheck === 'function' ? lyRenumberedCheck() : null;
      card = c ? { title: c.title, text: c.text } : null;
    } catch (e) {
      card = { error: String(e) };
    }
    const m = lyParse($ui('lyrics-draft').value);
    const display = {};
    for (const key of ['rhyme groups', 'returns'])
      display[key] = lySetupOf(m, key)
        .flatMap((d) => (typeof lyRowGroups === 'function' ? lyRowGroups(d) : lyParseGroups(d.value)))
        .map((g) => g.map((x) => (x.bad || x.undecided ? `${x.raw}${x.undecided ? ' [undecided]' : ''}` : `${x.raw || x.line}=${JSON.stringify(lyMemberWord(m, x))}${x.carried ? ' [carried]' : ''}`)).join(' ~ '));
    return { record: rec ? JSON.parse(JSON.stringify(rec)) : null, card, draftId: meta.draftId || null, display, histIdx: app.historyIndex, histN: app.history.length };
  });
}
async function snap(page, label, steps, extra = {}) {
  const t = await C.draftText(page);
  const rows = setupRows(t);
  const s = { step: label, rows, cut: marker(rows), toasts: await C.toasts(page), ...(await state(page)), text: t, ...extra };
  steps.push(s);
  return s;
}
async function send(page, q, kind, how) {
  const n = q.calls.length;
  if (kind === 'review') {
    await page.locator('.ly-run').first().click();
  } else {
    await page.locator('[data-ui="ly-menu"][data-id="ai"]').first().click();
    await page.waitForTimeout(150);
    await page.locator('#ly-menu-ai [data-ui="edit-lyrics"]').click();
    await page.waitForTimeout(250);
    how.dockFocus = await page.evaluate(() => document.activeElement && document.activeElement.id);
    await page.keyboard.type('Tighten line 2', { delay: 5 });
    await page.locator('#chat-send').click();
  }
  await C.idle(page);
  const got = q.calls.slice(n);
  const out = [];
  for (const c of got) {
    const ctx = c.lyric_context || null;
    out.push({ declarations: ctx ? ctx.declarations : null, document: ctx ? ctx.document : null, sung: ctx && ctx.document ? await page.evaluate((d) => lyParse(d).sung.map((s) => s.text), ctx.document) : null });
  }
  // close the dock so the next step's Lyrics controls are reachable
  await page.evaluate(() => typeof _chatClosePanel === 'function' && _chatClosePanel()).catch(() => {});
  await page.waitForTimeout(150);
  return { kind, calls: out, refused: out.length === 0 };
}
async function reviewPanel(page) {
  await openReview(page);
  const txt = await page.evaluate(() => (($ui('ly-panel-review') || {}).innerText || '').replace(/\s+/g, ' '));
  const k = txt.search(/renumbered to the current word cut/i);
  return { mentionsRenumbered: k >= 0, excerpt: k >= 0 ? txt.slice(Math.max(0, k - 60), k + 420) : '' };
}
async function runOne(browser, base, c, order) {
  const { ctx, page, q, errors } = await C.boot(browser, base);
  const steps = [];
  const how = {};
  const r = { id: `${TREE}.${c.id}.O${order}`, tree: TREE, case: c.id, order, steps, how, sends: [] };
  try {
    await C.enterBody(page, c.start);
    await C.toasts(page);
    await snap(page, '0 start text entered', steps);
    await C.insertAtTop(page, c.row, 'paste');
    await snap(page, '1 row pasted (real Ctrl+V at offset 0)', steps);
    await page.waitForTimeout(1200); // well past the 120 ms typing refresh
    await snap(page, '1b +1.2 s (typing refresh only)', steps);
    let k = 2;
    if (order === 2) {
      const s1 = await send(page, q, c.send, how);
      r.sends.push({ at: `${k} send first (${c.send})`, ...s1 });
      await snap(page, `${k++} after send (${c.send})`, steps);
    }
    await FORMS[c.form](page, how);
    await snap(page, `${k++} form commit (${c.form})`, steps);
    const s2 = await send(page, q, c.send, how);
    r.sends.push({ at: `${k} send (${c.send})`, ...s2 });
    await snap(page, `${k++} after send (${c.send})`, steps);
    if (c.then) {
      await FORMS[c.then](page, how);
      await snap(page, `${k++} then (${c.then})`, steps);
      const s3 = await send(page, q, c.send, how);
      r.sends.push({ at: `${k} send (${c.send})`, ...s3 });
      await snap(page, `${k++} after send (${c.send})`, steps);
    }
    r.sungAtFinal = await page.evaluate(() => lyParse($ui('lyrics-draft').value).sung.map((s) => s.text));
    r.review = await reviewPanel(page);
  } catch (e) {
    r.threw = String(e.stack || e);
  }
  r.errors = errors;
  await ctx.close();
  return r;
}
(async () => {
  const { server, base } = await C.startServer(TREE);
  const browser = await C.launch();
  const out = [];
  try {
    for (const c of CASES) {
      if (FILTER && !c.id.includes(FILTER)) continue;
      const o1 = await runOne(browser, base, c, 1);
      const o2 = await runOne(browser, base, c, 2);
      out.push(o1, o2);
      const fin = (r) => {
        const s = r.sends.filter((x) => !x.refused).slice(-1)[0];
        const d = s && s.calls.slice(-1)[0].declarations;
        return JSON.stringify(d ? { groups: d.groups, returns: d.returns, gnd: d.groups_need_decision, rnd: d.returns_need_decision } : null) + ` refused=[${r.sends.map((x) => x.refused)}]`;
      };
      const rows = (r) => r.steps.map((s) => `${s.rows.join(' | ') || '(none)'} {${s.cut}}`).join('\n      => ');
      const rec = (r) => JSON.stringify(r.steps.slice(-1)[0] && r.steps.slice(-1)[0].record);
      console.log(`### ${TREE} ${c.id}\n  O1 rows: ${rows(o1)}\n  O1 final ${fin(o1)} record=${rec(o1)}${o1.threw ? '\n  O1 THREW ' + o1.threw.split('\n')[0] : ''}\n  O2 rows: ${rows(o2)}\n  O2 final ${fin(o2)} record=${rec(o2)}${o2.threw ? '\n  O2 THREW ' + o2.threw.split('\n')[0] : ''}\n  O1 toasts ${JSON.stringify(o1.steps.map((s) => s.toasts))}\n  O2 toasts ${JSON.stringify(o2.steps.map((s) => s.toasts))}\n  review O1 ${o1.review && o1.review.mentionsRenumbered} | O2 ${o2.review && o2.review.mentionsRenumbered}  errs=${o1.errors.length + o2.errors.length}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  C.fs.writeFileSync(C.path.join(OUT, `run_${TREE}${FILTER ? '_' + FILTER.replace(/[^A-Za-z0-9]+/g, '_') : ''}.json`), JSON.stringify(out, null, 1));
})().catch((e) => (console.error(e), process.exit(1)));
