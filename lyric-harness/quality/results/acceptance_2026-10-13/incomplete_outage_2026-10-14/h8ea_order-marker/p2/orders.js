// check-order-marker: paired ORDER 1 / ORDER 2 runs.
// ORDER 1: enter body -> insert unmarked row (real Ctrl+V or real typing) ->
//          form commit (real clicks) -> send (Run review click, or the dock's
//          Send button after Write with AI > Edit this draft).
// ORDER 2: enter body -> insert the same row -> send -> the same form commit -> send.
// Usage: node orders.js <cand|c61b|main> [filter-substring]
'use strict';
const C = require('./com.js');
const TREE = process.argv[2] || 'cand';
const FILTER = process.argv[3] || '';
const BODY_A = ['[VERSE]', 'Oh--oh, oh my love', 'I walk the line tonight', 'I hold you tight', 'Well-worn shoes upon the floor', 'The rain comes down', 'I hear the sound', 'The night is cold', 'Love above', '', '[BRIDGE]', 'Go slow', 'Hold on', '', '[BRIDGE]', 'Go slow', 'Hold on'].join('\n');
const BODY_B = BODY_A.replace('\nLove above\n', '\nAnd love above\n');
const ROWS = {
  RG4: '[SETUP — rhyme groups — 1.T4,8; 2,3]',
  RG2: '[SETUP — rhyme groups — 1.T2,8; 2,3]',
  RT4: '[SETUP — returns — 1.T4,8.T1]',
  RT2: '[SETUP — returns — 1.T2,8.T1]',
  RT4v: '[SETUP — returns — 1.T4,8.T2]',
};
const OPS = { RG4: ['remove', 'add'], RG2: ['remove', 'add'], RT4: ['placed', 'declare'], RT2: ['placed', 'declare'] };
const CASES = [];
for (const [rk, ops] of Object.entries(OPS))
  for (const op of ops)
    for (const [input, send] of [['paste', 'review'], ['paste', 'dock'], ['type', 'review']])
      CASES.push({ id: `${rk}.${op}.${send}.${input}`, body: BODY_A, row: ROWS[rk], op, send, input });
CASES.push({ id: 'X7.RT4v.placed.review.paste', body: BODY_B, row: ROWS.RT4v, op: 'placed', send: 'review', input: 'paste' });

const setupRows = (t) => t.split('\n').filter((l) => /^\[SETUP/.test(l));
const sungOf = (page) => page.evaluate(() => lyParse($ui('lyrics-draft').value).sung.map((s) => s.text));
async function display(page) {
  return page.evaluate(() => {
    const m = lyParse($ui('lyrics-draft').value);
    const out = {};
    for (const key of ['rhyme groups', 'returns'])
      // display only; main has no lyRowGroups (its rows have no cut mark), so it reads lyParseGroups
      out[key] = lySetupOf(m, key).flatMap((d) => (typeof lyRowGroups === 'function' ? lyRowGroups(d) : lyParseGroups(d.value))).map((g) => g.map((x) => (x.bad || x.undecided ? x.raw : `${x.line}.${x.place}=${lyMemberWord(m, x)}`)).join(' ~ '));
    return out;
  });
}
async function formCommit(page, op, how) {
  if (op === 'remove') {
    await C.openTool(page, 'rhymes');
    await page.locator('input[name="ly-link-group"][value="1"]').check();
    await page.waitForTimeout(200);
    await page.locator('[data-ui="ly-link-remove"]').click();
  } else if (op === 'add') {
    await C.openTool(page, 'rhymes');
    for (const n of ['5', '7']) {
      await page.selectOption('#ly-link-place', 'end');
      await page.waitForTimeout(100);
      await page.selectOption('#ly-link-line', n);
      await page.waitForTimeout(200);
      await page.locator('[data-ui="ly-link-add"]').click();
      await page.waitForTimeout(200);
    }
    how.members = await page.evaluate(() => [...document.querySelectorAll('.ly-members li')].map((l) => l.innerText.replace(/\s+/g, ' ')));
    await page.locator('[data-ui="ly-draft-apply"][data-id="rhymes"]').first().click();
  } else if (op === 'placed') {
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
    how.members = await page.evaluate(() => [...document.querySelectorAll('.ly-members li')].map((l) => l.innerText.replace(/\s+/g, ' ')));
    await page.locator('[data-ui="ly-draft-apply"][data-id="repeats-voices"]').first().click();
  } else if (op === 'declare') {
    await C.openTool(page, 'repeats-voices');
    await page.locator('[data-ui="ly-declare-repeat"]').first().click();
  }
  await page.waitForTimeout(400);
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
  return got.map((c) => ({ declarations: c.lyric_context && c.lyric_context.declarations, task: c.task }));
}
async function snap(page, label, steps, extra = {}) {
  const t = await C.draftText(page);
  const s = { step: label, setup: setupRows(t), toasts: await C.toasts(page), display: await display(page), ...extra };
  steps.push(s);
  return s;
}
async function reviewText(page) {
  await page.locator('[data-ui="ly-tab"][data-id="review"]').click();
  await page.waitForTimeout(250);
  const txt = await page.evaluate(() => ($ui('ly-panel-review') || {}).innerText || '');
  return { mentionsCut: /\bcut\b/i.test(txt), mentionsRenumber: /renumber/i.test(txt), excerpt: txt.replace(/\s+/g, ' ').slice(0, 600) };
}
async function runOne(browser, base, c, order) {
  const { ctx, page, q, errors } = await C.boot(browser, base);
  const steps = [];
  const how = {};
  const r = { id: `${TREE}.${c.id}.O${order}`, tree: TREE, case: c.id, order, steps, how, sends: [] };
  try {
    await C.enterBody(page, c.body);
    await C.toasts(page);
    await C.insertAtTop(page, `${c.row}\n\n`, c.input);
    await snap(page, `1 ${c.input} row at offset 0`, steps);
    if (order === 2) {
      const s1 = await send(page, q, c.send, how);
      r.sends.push(s1);
      await snap(page, `2 send first (${c.send})`, steps, { payload: s1 });
    }
    await formCommit(page, c.op, how);
    await snap(page, `${order === 2 ? 3 : 2} form commit (${c.op})`, steps);
    const s2 = await send(page, q, c.send, how);
    r.sends.push(s2);
    r.sungAtFinal = await sungOf(page);
    await snap(page, `${order === 2 ? 4 : 3} final send (${c.send})`, steps, { payload: s2 });
    r.review = await reviewText(page);
    r.hist = await C.hist(page).then((h) => ({ idx: h.idx, n: h.n }));
    r.final = s2.length ? s2[s2.length - 1].declarations : null;
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
      const f = (r) => JSON.stringify(r.final && { groups: r.final.groups, returns: r.final.returns });
      console.log(`${TREE} ${c.id}\n  O1 rows: ${o1.steps.map((s) => s.setup.join(' | ')).join('  =>  ')}\n  O1 final ${f(o1)}${o1.threw ? ' THREW ' + o1.threw.split('\n')[0] : ''}\n  O2 rows: ${o2.steps.map((s) => s.setup.join(' | ')).join('  =>  ')}\n  O2 final ${f(o2)}${o2.threw ? ' THREW ' + o2.threw.split('\n')[0] : ''}\n  O1 toasts ${JSON.stringify(o1.steps.map((s) => s.toasts))}\n  O2 toasts ${JSON.stringify(o2.steps.map((s) => s.toasts))}\n  review O1 cut=${o1.review && o1.review.mentionsCut} renum=${o1.review && o1.review.mentionsRenumber} | O2 cut=${o2.review && o2.review.mentionsCut} renum=${o2.review && o2.review.mentionsRenumber}  dockFocus=${o1.how.dockFocus || '-'}  errs=${o1.errors.length + o2.errors.length}`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  C.fs.writeFileSync(C.path.join(C.OUT, `orders_${TREE}${FILTER ? '_' + FILTER : ''}.json`), JSON.stringify(out, null, 1));
})().catch((e) => (console.error(e), process.exit(1)));
