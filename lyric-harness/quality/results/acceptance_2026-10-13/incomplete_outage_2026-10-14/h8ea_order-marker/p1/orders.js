// BB8 order-marker: does the ORDER of a Rhymes/Repeats form commit and a send
// change which word a hand-typed/pasted UNMARKED rhyme groups / returns row
// binds? Same starting text and state for both orders:
//   ORDER O1: paste/type the unmarked row -> form commit (another group) -> send
//   ORDER O2: paste/type the unmarked row -> send -> the same form commit -> send
// Recorded at every step: every [SETUP] row (raw), whether it ends with the
// cut mark, what the page's own tool list shows for the row's members, the
// toasts, and -- for every send -- the exact /chat body (lyric_context.declarations
// plus the sung lines of lyric_context.document as the page itself parses them).
// The harness binding is computed afterwards by bind.py at each tree.
// Usage: node orders.js <cand|c61b|main> [scenarioFilter]
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
const BODY_B = `${BODY_A}

[BRIDGE]
Far from the shore
Over the hill

[BRIDGE]
Far from the shore
Over the hill`;
const ROWS = {
  RG4: { body: BODY_A, row: '[SETUP — rhyme groups — 1.T4,8; 2,3]', key: 'rhyme groups', forms: ['remove', 'add'] },
  RG2: { body: BODY_A, row: '[SETUP — rhyme groups — 1.T2,8; 2,3]', key: 'rhyme groups', forms: ['remove', 'add'] },
  RT4: { body: BODY_B, row: '[SETUP — returns — 1.T4,8.T1]', key: 'returns', forms: ['placed', 'declare'] },
};
const SENDS = ['review', 'dock'];
const INPUTS = ['paste', 'type'];

const setupRows = (page) => page.evaluate(() => $ui('lyrics-draft').value.split('\n').filter((r) => /^\s*\[SETUP/.test(r)));
const marker = (rows) => rows.map((r) => (/—\s*cut\s+v\d+\s*\]\s*$/.test(r) ? r.match(/cut\s+v\d+/)[0] : 'UNMARKED'));
async function openTool(page, id) {
  // the Tools tab first (a review switches the panel to Review), by its own tab button
  if (!(await page.evaluate(() => LY.tab === 'tools'))) {
    const tab = page.locator('[data-ui="ly-tab"][data-id="tools"]:visible').first();
    if (await tab.count()) await tab.click();
    else await page.evaluate(() => LY_ACTIONS['ly-tab']('tools'));
    await page.waitForTimeout(200);
  }
  const open = await page.evaluate((id) => LY.tool === id, id);
  if (!open) await page.click(`[data-ui="ly-tool"][data-id="${id}"]`);
  await page.waitForTimeout(250);
}
// What the page's own form lists show for the declared members right now.
async function shown(page, key) {
  if (key === 'rhyme groups') {
    await openTool(page, 'rhymes');
    return page.evaluate(() => [...document.querySelectorAll('.ly-links li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
  }
  await openTool(page, 'repeats-voices');
  return page.evaluate(() => {
    const h = [...document.querySelectorAll('.ly-h4')].find((x) => /Declared returns/.test(x.textContent));
    const ul = h && h.nextElementSibling;
    return ul && ul.tagName === 'UL' ? [...ul.querySelectorAll('li')].map((li) => li.innerText.trim()) : [];
  });
}
// The page's own word for every member of every group of the first row (display only).
const pageWords = (page, key) =>
  page.evaluate((key) => {
    const model = lyParse($ui('lyrics-draft').value);
    const d = lySetupOf(model, key)[0];
    if (!d) return null;
    return (typeof lyRowGroups === 'function' ? lyRowGroups(d) : lyParseGroups(d.value)).map((g) => g.map((m) => `${m.line}.${m.place}=${m.undecided ? '(undecided)' : JSON.stringify(lyMemberWord(model, m))}`).join(' ~ '));
  }, key);
async function snap(page, key, label, log) {
  const rows = await setupRows(page);
  const s = {
    step: label,
    rows,
    cut: marker(rows),
    pageWords: await pageWords(page, key),
    shown: await shown(page, key),
    toasts: await L.toasts(page),
    hist: await page.evaluate(() => ({ idx: app.historyIndex, n: app.history.length })),
  };
  log.push(s);
  return s;
}
async function inputRow(page, how, row) {
  await page.evaluate(() => {
    const d = $ui('lyrics-draft');
    d.focus();
    d.setSelectionRange(0, 0);
  });
  if (how === 'paste') {
    await page.evaluate((t) => navigator.clipboard.writeText(t), `${row}\n\n`);
    await page.keyboard.press('Control+V');
  } else {
    await page.keyboard.type(row, { delay: 5 });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(500);
}
async function formCommit(page, form) {
  if (form === 'remove') {
    await openTool(page, 'rhymes');
    await page.check('input[name="ly-link-group"][value="1"]');
    await page.waitForTimeout(200);
    await page.click('[data-ui="ly-link-remove"]');
  } else if (form === 'add') {
    await openTool(page, 'rhymes');
    for (const n of ['5', '7']) {
      await page.selectOption('#ly-link-line', n);
      await page.waitForTimeout(100);
      await page.selectOption('#ly-link-place', 'end');
      await page.click('[data-ui="ly-link-add"]');
      await page.waitForTimeout(150);
    }
    await page.click('.ly-actions [data-ui="ly-draft-apply"][data-id="rhymes"]');
  } else if (form === 'placed') {
    await openTool(page, 'repeats-voices');
    for (const n of [2, 6]) {
      // the caret in the document picks the line, as a writer does it
      await page.evaluate((n) => {
        const d = $ui('lyrics-draft');
        const model = lyParse(d.value);
        const r = model.sung[n - 1];
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
  } else if (form === 'declare') {
    await openTool(page, 'repeats-voices');
    await page.click('[data-ui="ly-declare-repeat"]');
  }
  await page.waitForTimeout(400);
}
async function send(page, q, how) {
  const n = q.calls.length;
  if (how === 'review') {
    await page.click('[data-ui="ly-run-review"].ly-run');
  } else {
    await page.evaluate(() => LY_ACTIONS['edit-lyrics']());
    await page.waitForTimeout(250);
    await page.locator('#chat-input').fill('');
    await page.locator('#chat-input').type('Tighten line 2', { delay: 5 });
    await page.locator('#chat-send').click();
  }
  await L.waitIdle(page);
  const calls = q.calls.slice(n);
  const out = [];
  for (const c of calls) {
    const ctx = c.lyric_context || null;
    const sung = ctx ? await page.evaluate((doc) => lyParse(doc).sung.map((s) => s.text), ctx.document) : null;
    out.push({ message: c.message, task: c.task || null, continuation: !!(c.sig || c.continuation_id), declarations: ctx ? ctx.declarations : null, document: ctx ? ctx.document : null, sung });
  }
  // back to the Lyrics page's tools for the next step
  await page.evaluate(() => typeof _chatClosePanel === 'function' && _chatClosePanel()).catch(() => {});
  return out;
}

(async () => {
  const { server, base } = await L.startServer(TREE);
  const browser = await L.launch();
  const out = { tree: TREE, sha: L.TREES[TREE].sha, cases: [] };
  try {
    for (const [rk, R] of Object.entries(ROWS))
      for (const form of R.forms)
        for (const sendHow of SENDS)
          for (const input of INPUTS)
            for (const order of ['O1', 'O2']) {
              const id = `${rk}.${form}.${sendHow}.${input}.${order}`;
              if (FILTER && !FILTER.test(id)) continue;
              // typing is checked on the rhyme-groups T4 row with Remove link and on the returns row; paste everywhere
              if (input === 'type' && !(rk === 'RG4' || rk === 'RT4')) continue;
              const { ctx, page, q, errors } = await L.boot(browser, base);
              const c = { id, tree: TREE, row: R.row, key: R.key, form, send: sendHow, input, order, steps: [], sends: [] };
              try {
                // SAME START: the body typed in whole (no [SETUP] row yet), then left.
                await page.evaluate(() => {
                  const d = $ui('lyrics-draft');
                  d.focus();
                  d.select();
                });
                await page.keyboard.insertText(R.body);
                await page.waitForTimeout(300);
                await page.evaluate(() => $ui('lyrics-draft').blur());
                await page.waitForTimeout(200);
                await snap(page, R.key, '0 start (body only)', c.steps);
                await inputRow(page, input, R.row);
                await snap(page, R.key, `1 row ${input}d by hand`, c.steps);
                if (order === 'O1') {
                  await formCommit(page, form);
                  await snap(page, R.key, `2 form commit (${form})`, c.steps);
                  c.sends.push({ at: `3 send (${sendHow})`, calls: await send(page, q, sendHow) });
                  await snap(page, R.key, `3 after send (${sendHow})`, c.steps);
                } else {
                  c.sends.push({ at: `2 send (${sendHow})`, calls: await send(page, q, sendHow) });
                  await snap(page, R.key, `2 after send (${sendHow})`, c.steps);
                  await formCommit(page, form);
                  await snap(page, R.key, `3 form commit (${form})`, c.steps);
                  c.sends.push({ at: `4 send (${sendHow})`, calls: await send(page, q, sendHow) });
                  await snap(page, R.key, `4 after send (${sendHow})`, c.steps);
                }
                const last = c.sends[c.sends.length - 1].calls.slice(-1)[0];
                c.finalDeclarations = last ? last.declarations : null;
                c.errors = errors;
              } catch (x) {
                c.threw = String(x.stack || x);
              }
              out.cases.push(c);
              console.log(`\n### ${TREE} ${id}`);
              for (const s of c.steps) console.log(`  [${s.step}] rows=${JSON.stringify(s.rows)} cut=${JSON.stringify(s.cut)}\n      pageWords=${JSON.stringify(s.pageWords)} shown=${JSON.stringify(s.shown)} hist=${JSON.stringify(s.hist)}${s.toasts.length ? `\n      toasts=${JSON.stringify(s.toasts)}` : ''}`);
              for (const s of c.sends) console.log(`  SEND ${s.at}: ${JSON.stringify(s.calls.map((x) => ({ decl: x.declarations, continuation: x.continuation })))}`);
              if (c.threw) console.log('  THREW', c.threw);
              if (errors.length) console.log('  pageerrors', JSON.stringify(errors));
              await ctx.close();
            }
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, `orders_${TREE}${FILTER ? '_' + process.argv[3].replace(/[^A-Za-z0-9]+/g, '_') : ''}.json`), JSON.stringify(out, null, 2));
})().catch((e) => (console.error(e), process.exit(1)));
