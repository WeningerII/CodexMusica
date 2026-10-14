// Phase 1: rows written by the BASELINE page (wt-main, 8b1d2ad2) through its
// own forms, saved to files. Run: node gen_baseline.js
'use strict';
const L = require('./lib.js');

const LYRICS_A = `[VERSE]
Oh--oh, oh my love
I play the double bass--
Run--run away to the sea
You hold my heart.    10

[CHORUS]
I walk the line tonight
Well-worn shoes upon the floor
Oh, oh, I said oh
Love above`;

async function addLink(page, members) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
  for (const [line, place] of members) {
    await page.selectOption('#ly-link-line', String(line));
    await page.selectOption('#ly-link-place', place);
    await page.click('[data-ui="ly-link-add"]');
  }
  await page.click('[data-ui="ly-draft-apply"][data-id="rhymes"]');
}
async function addPlaced(page, members) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
  for (const [line, place] of members) {
    // The placed-return form adds the line the caret is on.
    await page.evaluate((n) => {
      LY.activeLine = n;
      lyRefresh(true);
    }, line);
    await page.evaluate(() => {
      const d = $ui('ly-placed-place')?.closest('details');
      if (d && !d.open) d.open = true;
    });
    await page.selectOption('#ly-placed-place', place);
    await page.click('[data-ui="ly-placed-add"]');
  }
  await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
}
async function addReading(page, line, token, word, phones, source) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('pronunciation'));
  await page.evaluate((k) => LY_ACTIONS['ly-reading-pick'](k), JSON.stringify([line, token, word]));
  await page.evaluate(() => LY_ACTIONS['ly-reading-kind']('declared'));
  await page.fill('#ly-phones', phones);
  await page.fill('#ly-source', source);
  await page.click('[data-ui="ly-draft-apply"][data-id="pronunciation"]');
}

(async () => {
  const state = { root: L.WT_MAIN };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const out = {};
  try {
    for (const [name, build] of [
      [
        'A',
        async (page) => {
          await addLink(page, [[1, 'T4'], [8, 'end']]);
          await addLink(page, [[3, 'end'], [5, 'end']]);
          await addLink(page, [[2, 'end'], [6, 'end']]);
          await addLink(page, [[4, 'end'], [7, 'end']]);
          await addPlaced(page, [[1, 'T4'], [8, 'T1']]);
          await addPlaced(page, [[3, 'head'], [5, 'head']]);
          await addReading(page, 'Oh--oh, oh my love', 2, 'oh', 'OW1', 'the singer');
          await addReading(page, 'Oh, oh, I said oh', 5, 'oh', 'OW1', 'the singer');
        },
      ],
      [
        'B',
        async (page) => {
          // Word 1 of line 1 is "Oh--oh" in the baseline picker: no v2 word covers it.
          await addLink(page, [[1, 'T1'], [8, 'end']]);
          await addLink(page, [[5, 'T2'], [6, 'T2']]);
          await addPlaced(page, [[1, 'T1'], [7, 'T1']]);
          await addReading(page, 'Oh--oh, oh my love', 1, 'Oh--oh', 'OW1 OW1', 'the singer');
        },
      ],
      [
        'C',
        async (page) => {
          // Only named places, all on lines whose cut did not change, plus one
          // T<k> on an unchanged line.
          await addLink(page, [[5, 'end'], [6, 'end']]);
          await addLink(page, [[7, 'head'], [8, 'end']]);
          await addPlaced(page, [[5, 'T2'], [6, 'T2']]);
        },
      ],
    ]) {
      const q = { replies: [], calls: [] };
      const ctx = await L.newCtx(browser, q);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
      await page.goto(`${base}/codex.html#lyrics`);
      await L.waitReady(page);
      await L.setDraft(page, LYRICS_A);
      await build(page);
      await page.waitForTimeout(300);
      const text = await L.draftOf(page);
      const ls = await page.evaluate(() => localStorage.getItem('codex-workbench-v1'));
      out[name] = { text, localStorage: ls, toasts: await L.toasts(page) };
      L.fs.writeFileSync(L.path.join(L.OUT, `baseline_${name}.txt`), text);
      await ctx.close();
    }
  } catch (e) {
    errors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, 'baseline_sessions.json'), JSON.stringify({ out, errors }, null, 2));
  for (const [k, v] of Object.entries(out)) console.log(`--- baseline ${k} ---\n${v.text}\n`);
  console.log('errors:', errors);
})();
