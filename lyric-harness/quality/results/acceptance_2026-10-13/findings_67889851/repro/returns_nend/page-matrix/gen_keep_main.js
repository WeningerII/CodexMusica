// Baseline (wt-main) session for the Keep-durability run, written by the
// baseline page's own Rhymes and Repeats forms. Output: keep_main.json
'use strict';
const L = require('./lib.js');
const { TEXT } = require('./cells.js');
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
(async () => {
  const server = L.serve({ root: L.WT_MAIN });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await L.chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const q = { replies: [], calls: [] };
  const ctx = await L.newCtx(browser, q);
  const page = await ctx.newPage();
  await page.goto(`${base}/codex.html#lyrics`);
  await L.waitReady(page);
  await L.setDraft(page, TEXT);
  await addLink(page, [[1, 'end'], [6, 'end']]);
  await addLink(page, [[2, 'endword'], [5, 'end']]);
  await addLink(page, [[4, 'end'], [3, 'head']]);
  await addPlaced(page, [[1, 'head'], [6, 'head']]);
  await addPlaced(page, [[8, 'line'], [5, 'line']]);
  await page.waitForTimeout(200);
  const text = await L.draftOf(page);
  const ls = await page.evaluate(() => localStorage.getItem('codex-workbench-v1'));
  L.fs.writeFileSync(L.path.join(L.OUT, 'keep_main.json'), JSON.stringify({ text, ls }, null, 1));
  console.log(text);
  await browser.close();
  server.close();
})();
