// Phase 1: every cell's row written on the BASELINE page (wt-main 8b1d2ad2):
// through its own Rhymes / Repeats forms where they can write the spelling,
// hand-written in the identical format otherwise. Output: main_cells.json
'use strict';
const L = require('./lib.js');
const { TEXT, cells } = require('./cells.js');

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
    await page.evaluate((n) => { LY.activeLine = n; lyRefresh(true); }, line);
    await page.evaluate(() => { const d = $ui('ly-placed-place')?.closest('details'); if (d && !d.open) d.open = true; });
    await page.selectOption('#ly-placed-place', place);
    await page.click('[data-ui="ly-placed-add"]');
  }
  await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
}
async function voicesOn(page) {
  await page.evaluate(() => LY_ACTIONS['ly-tool']('repeats-voices'));
  await page.click('[data-ui="ly-voices"][data-id="sung"]');
  await page.click('[data-ui="ly-draft-apply"][data-id="repeats-voices"]');
}
(async () => {
  const state = { root: L.WT_MAIN };
  const server = L.serve(state);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const errors = [];
  const out = {};
  const t0 = Date.now();
  try {
    const q = { replies: [], calls: [] };
    const ctx = await L.newCtx(browser, q);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${base}/codex.html#lyrics`);
    await L.waitReady(page);
    let voicesRow = null;
    for (const c of cells()) {
      await L.setDraft(page, TEXT);
      if (c.voices) await voicesOn(page);
      const t1 = await L.draftOf(page);
      if (c.voices) voicesRow = t1.split('\n').find((r) => /^\[SETUP — voices/.test(r));
      const [pm, pn, pp] = [c.partner, ...require('./cells.js').PARTNER[c.key].slice(1)];
      if (c.viaForm) {
        if (c.key === 'rhyme groups') await addLink(page, [[c.n, c.formPlace], [pn, pp]]);
        else await addPlaced(page, [[c.n, c.formPlace], [pn, pp]]);
      } else {
        // Hand-written, where the form writes its rows: after the setup rows, before the song.
        const rows = t1.split('\n');
        const at = rows.findIndex((r) => !/^\[SETUP/.test(r));
        rows.splice(at, 0, `[SETUP — ${c.key} — ${c.member},${pm}]`);
        await L.setDraft(page, rows.join('\n').replace(/^(\[SETUP[^\n]*\])\n\[VERSE\]/m, '$1\n\n[VERSE]'));
      }
      await page.waitForTimeout(80);
      const got = await page.evaluate(([key, n, sp]) => {
        const text = $ui('lyrics-draft').value;
        const m = lyParse(text);
        const d = lyDeclarationsOf(m);
        const row = lySetupOf(m, key)[0];
        const groups = row ? lyParseGroups(row.value) : [];
        const mem = groups.flat()[0];
        return {
          text,
          ls: localStorage.getItem('codex-workbench-v1'),
          decl: { groups: d.groups, returns: d.returns, voices: d.voices },
          bad: (LY.items || []).filter((i) => /^(rhyme groups|returns):/.test(i.id)).map((i) => [i.id, i.tone, i.title]),
          mainWord: mem && !mem.bad ? lyMemberWord(m, mem) : null,
        };
      }, [c.key, c.n, c.sp]);
      out[c.id] = { cell: c, ...got };
      process.stdout.write(`${c.id} ${c.viaForm ? 'form' : 'hand'} ${got.text.split('\n').filter((r) => /^\[SETUP/.test(r)).join(' | ')} -> sent ${JSON.stringify(got.decl)} word=${JSON.stringify(got.mainWord)} bad=${got.bad.length}\n`);
    }
    out.__voicesRow = voicesRow;
    await ctx.close();
  } catch (e) {
    errors.push('threw: ' + (e.stack || e));
  } finally {
    await browser.close();
    server.close();
  }
  L.fs.writeFileSync(L.path.join(L.OUT, 'main_cells.json'), JSON.stringify({ out, errors }, null, 1));
  console.log('errors:', errors, 'secs', (Date.now() - t0) / 1000);
})();
