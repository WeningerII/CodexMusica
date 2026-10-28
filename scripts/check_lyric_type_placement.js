#!/usr/bin/env node
// Local browser regression. All non-local requests, including /chat, are blocked.
/* global document, $ui, uiSaveLyrics, pushHistory, lyRefresh, LY_ACTIONS, lyDeclarationsOf, LY, UI */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { start } = require('./_pages_server');
const ROOT = path.join(__dirname, '..');
async function checkTypePlacement() {
  const server = await start({ root: ROOT, port: 0 });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (r) =>
      r.request().url().startsWith(server.url) && !r.request().url().includes('/chat')
        ? r.continue()
        : r.abort()
    );
    const historical = process.argv.find((a) => a.startsWith('--html='))?.slice(7);
    if (historical)
      await page.route('**/codex.html', (r) =>
        r.fulfill({ path: historical, contentType: 'text/html' })
      );
    await page.goto(server.url + '/codex.html#lyrics');
    await page.waitForFunction(() => typeof lyRefresh === 'function' && $ui('lyrics-draft'));
    await page.evaluate(() => {
      $ui('lyrics-draft').value = '[VERSE]\nnever say the word aloud\nnever leave the room';
      uiSaveLyrics();
      pushHistory();
      lyRefresh(true);
      LY_ACTIONS['ly-tool']('rhymes');
    });
    await page.locator('#ly-type-new option[value="43"]').waitFor({ state: 'attached' });
    await page.selectOption('#ly-link-line', '1');
    await page.click('[data-ui="ly-link-add"]');
    await page.selectOption('#ly-link-line', '2');
    await page.click('[data-ui="ly-link-add"]');
    await page.selectOption('#ly-type-new', '43');
    assert.deepEqual(await page.locator('.ly-members strong').allTextContents(), [
      '“never”',
      '“never”',
    ]);
    const highlights = () => page.locator('#ly-overlay .ly-end').allTextContents();
    assert.deepEqual(await highlights(), ['never', 'never']);
    await page.click('[data-ui="ly-draft-apply"][data-id="rhymes"]');
    assert.match(await page.locator('.ly-links').innerText(), /never.*never/s);
    const data = await page.evaluate(() => lyDeclarationsOf(LY.model));
    assert.equal(data.groups, '1,2');
    assert.deepEqual(data.group_types, [{ group: 1, type: 43 }]);
    assert.deepEqual(await highlights(), ['never', 'never']);
    console.log('PASS: pending members, saved links and unchanged declarations');
    await page.locator('input[name="ly-link-group"]').first().check();
    await page.selectOption('#ly-type-group', '0');
    assert.match(await page.locator('.ly-links').innerText(), /aloud.*room/s);
    assert.deepEqual(await highlights(), ['aloud', 'room']);
    await page.locator('#ly-type-group').focus();
    await page.selectOption('#ly-type-group', '43');
    await page.locator('#ly-type-group').dispatchEvent('change');
    await page.waitForFunction(
      () => lyDeclarationsOf(LY.model).group_types?.[0]?.type === 43,
      null,
      { timeout: 10000 }
    );
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForFunction(() => UI.ready && !!LY.model);
    await page.evaluate(() => LY_ACTIONS['ly-tool']('rhymes'));
    await page.locator('.ly-links').waitFor({ timeout: 10000 });
    await page.waitForFunction(
      () => document.querySelector('.ly-links')?.textContent.includes('never'),
      null,
      { timeout: 10000 }
    );
    assert.deepEqual(await highlights(), ['never', 'never']);
    console.log('PASS: change type and reload');
    await page.evaluate(() => {
      $ui('lyrics-draft').value =
        '[SETUP — rhyme groups — 1.T3,2.endword — cut v2]\n[SETUP — group types — 1.T3,2.endword=43]\n[VERSE]\nnever say the word aloud\nnever leave the room';
      uiSaveLyrics();
      pushHistory();
      lyRefresh(true);
    });
    assert.deepEqual(await highlights(), ['the', 'room']);
    assert.match(await page.locator('.ly-links').innerText(), /the.*room/s);
    assert.equal(await page.evaluate(() => lyDeclarationsOf(LY.model).groups), '1.T3,2.endword');
    console.log('PASS: explicit token and endword placements override anaphora');
  } finally {
    await browser.close();
    await server.close();
  }
}
module.exports = checkTypePlacement;
if (require.main === module)
  checkTypePlacement().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
