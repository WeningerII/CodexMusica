#!/usr/bin/env node
'use strict';
/* global document, window */
// Exercise the published HTML shell and its lazy Song Forms assets on the Lyrics route.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('./_pages_server.js');

async function checkViewport(browser, origin, viewport) {
  const context = await browser.newContext({
    viewport,
    serviceWorkers: 'block',
    reducedMotion: viewport.width < 500 ? 'reduce' : 'no-preference',
  });
  try {
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
    );
    const page = await context.newPage();
    // Capture the actual native POST without contacting or charging a provider.
    await page.route('**/chat', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Offline request captured.' }),
      })
    );

    await page.goto(origin + '/codex.html#lyrics');
    const draft = page.locator('#lyrics-draft');
    await draft.waitFor();
    const original = await draft.inputValue();
    const disclosure = page.locator('#ly-song-forms > summary');
    await disclosure.focus();
    const view = page.locator('#ly-song-forms-view');
    let posts = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && new URL(req.url()).pathname === '/chat') posts++;
    });
    const failures = [];
    page.on('pageerror', (err) => failures.push(err.message));
    let graphAttempts = 0;
    await page.route('**/api/song-form-relationships.json', (r) =>
      ++graphAttempts === 1 ? r.abort() : r.continue()
    );
    await disclosure.press('Enter');
    const query = view.getByRole('combobox', { name: 'Search song forms' });
    const current = view.locator('#selected-form');
    const action = view.getByRole('button', { name: 'Write with this form' });
    async function select(id, name) {
      await query.fill(id);
      await query.press('ArrowDown');
      await query.press('Enter');
      await current.getByText(name, { exact: true }).waitFor();
    }
    await view.getByRole('button', { name: 'Retry', exact: true }).click();
    await view.locator('.relation-choice').first().waitFor();
    await select('8-bar-blues', '8-bar blues');
    await view
      .locator('#relations')
      .getByRole('button', { name: 'Can contain: Couplet' })
      .press('Enter');
    await current.getByText('Couplet', { exact: true }).waitFor();
    await view.locator('#all-related summary').press('Enter');
    const reverse = view
      .locator('#relation-list')
      .getByRole('button', { name: 'Can occur within: 8-bar blues' });
    assert.match(await reverse.locator('..').innerText(), /Catalog evidence only/);
    await reverse.press('Enter');
    await current.getByText('8-bar blues', { exact: true }).waitFor();
    await select('triolet', 'Triolet');
    const chart = view.locator('#diagram svg');
    await chart.waitFor();
    const marks = chart.locator('.mark');
    assert.equal(await marks.count(), 8);
    await marks.first().focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await marks.nth(1).getAttribute('aria-pressed'), 'true');
    await view.getByRole('button', { name: 'Zoom in' }).click();
    await view.locator('#diagram svg[data-zoomed]').waitFor();
    await view.getByRole('button', { name: 'Fit entire diagram' }).click();
    await view.locator('#diagram svg:not([data-zoomed])').waitFor();
    await chart.scrollIntoViewIfNeeded();
    const rect = await chart.boundingBox();
    const x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2;
    await page.mouse.move(x, y);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await view.locator('#diagram svg[data-zoomed]').waitFor();
    const transformed = chart.locator('g[transform]').first();
    const previous = await transformed.getAttribute('transform');
    await page.mouse.down();
    await page.mouse.move(x + 25, y, { steps: 4 });
    await page.mouse.up();
    assert.notEqual(await transformed.getAttribute('transform'), previous);
    await view.getByRole('button', { name: 'Fit entire diagram' }).click();
    await view.locator('#diagram svg:not([data-zoomed])').waitFor();
    if (process.env.SONG_FORM_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.SONG_FORM_SCREENSHOT_DIR, { recursive: true });
      await view.screenshot({
        path: path.join(
          process.env.SONG_FORM_SCREENSHOT_DIR,
          'lyrics-song-forms-' + viewport.width + '.png'
        ),
      });
    }
    const outline = view.locator('#symbolic summary');
    await outline.press('Enter');
    await view.locator('#symbolic-body li').first().waitFor();
    assert.match(await view.locator('#symbolic-body').innerText(), /refrain r1/);
    assert.ok(await view.evaluate((n) => n.scrollWidth <= n.clientWidth + 1));
    assert.equal(new URL(page.url()).hash, '#lyrics');
    const notes = view.locator('#writing-note');
    for (const [id, name, pattern, expected] of [
      ['tritina', 'Tritina', null, /closing passage on line 10/],
      ['ruthless-rhyme', 'Ruthless rhyme', '1', /distinct ending sound/],
      ['tumbling-verse', 'Tumbling verse', null, /number of unstressed syllables can vary/],
      ['quatrain', 'Quatrain', null, /one 4-line verse/],
    ]) {
      await select(id, name);
      if (pattern !== null) await view.locator('#patterns').selectOption(pattern);
      await notes.filter({ hasText: expected }).waitFor();
      assert.ok(await action.isEnabled());
    }
    await select('contrafactum', 'Contrafactum');
    await view.getByText('This form has a catalog entry but no structure yet.').waitFor();
    assert.ok(await action.isDisabled());
    await select('petrarchan-sonnet', 'Petrarchan sonnet');
    assert.equal(await action.isDisabled(), true);
    await view.locator('#patterns').selectOption('1');
    await view.getByText('This pattern is available for study only.').waitFor();
    await select('chorus-first', 'Chorus-first');
    await view.locator('#patterns').selectOption('1');
    await view.locator('#repeat-panel summary').click();
    await view.getByRole('spinbutton').fill('24');
    await view.getByRole('button', { name: 'Apply counts' }).click();
    await view.getByText('This pattern is available for study only.').waitFor();
    assert.equal(await action.isDisabled(), true);
    await view.locator('#repeat-panel summary').click();
    await view.getByRole('spinbutton').fill('3');
    assert.equal(await action.isDisabled(), true);
    await view.getByRole('button', { name: 'Apply counts' }).click();
    await view.locator('#write-with-form:enabled').waitFor();
    await action.press('Enter');
    const directory = process.env.SONG_FORM_SCREENSHOT_DIR;
    if (directory) {
      await fs.mkdir(directory, { recursive: true });
      await page.screenshot({
        path: path.join(directory, 'lyrics-writer-' + viewport.width + '.png'),
      });
    }
    assert.deepEqual(failures, []);
    assert.equal(posts, 0, 'Selecting a form must not send a write request');
    const input = page.locator('#chat-input');
    await input.waitFor();
    assert.ok(await input.evaluate((node) => document.activeElement === node));
    const badge = page.locator('#ly-creation-form');
    assert.equal(await badge.isVisible(), true);
    assert.match(
      await badge.locator('span').textContent(),
      /Song form · Chorus-first · Pattern 2 · .+ 1\.2 × 3/
    );
    const selection = {
      catalog_form: 'chorus-first',
      catalog_variant: 1,
      catalog_counts: [{ path: '1.2', count: 3 }],
    };
    assert.deepEqual(
      await page.evaluate(() => window.uiLyricContext('lyrics').declarations),
      selection
    );
    assert.equal(
      await page.evaluate(
        () => 'catalog_form' in window.uiLyricContext('lyrics-edit').declarations
      ),
      false
    );
    if (viewport.width < 500) {
      await badge.getByRole('button', { name: 'Remove form' }).click();
      assert.deepEqual(await page.evaluate(() => window.uiLyricContext('lyrics').declarations), {});
      await page.locator('#ly-mtab-song').click();
      await action.press('Enter');
      await input.waitFor();
      assert.equal(posts, 0);
    }
    const request = page.waitForRequest(
      (req) => new URL(req.url()).pathname === '/chat' && req.method() === 'POST'
    );
    await input.fill('Create a song.');
    await page.locator('#chat-send').click();
    const body = (await request).postDataJSON();
    assert.deepEqual(body.task, { domain: 'lyrics', phase: 'create' });
    assert.deepEqual(body.lyric_context.declarations, selection);
    assert.equal(await draft.inputValue(), original);
    if (viewport.width === 1280) {
      const retry = await context.newPage();
      let catalogLoads = 0;
      await retry.route('**/api/song-forms.json', (route) => {
        catalogLoads++;
        return catalogLoads === 1 ? route.abort('internetdisconnected') : route.continue();
      });
      await retry.goto(origin + '/codex.html#lyrics');
      const editor = retry.locator('#lyrics-draft');
      await editor.fill('Untitled draft');
      const toggle = retry.locator('#ly-song-forms > summary');
      assert.equal(catalogLoads, 0);
      await toggle.focus();
      await retry.keyboard.press('Enter');
      await retry.getByText('Could not load Song Forms.').waitFor();
      assert.equal(await editor.inputValue(), 'Untitled draft');
      await retry.getByRole('button', { name: 'Retry', exact: true }).click();
      await retry.locator('#selected-form').waitFor();
      assert.equal(catalogLoads, 2);
      assert.equal(await editor.inputValue(), 'Untitled draft');
      await retry.close();
    }
    console.log(
      'PASS native Song Forms keyboard navigation, stylesheet and fit at ' + viewport.width + 'px'
    );
  } finally {
    await context.close();
  }
}

async function main() {
  const server = await start({ root: path.resolve(__dirname, '..') });
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox'],
    });
    for (const viewport of [
      { width: 1280, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await checkViewport(browser, server.url, viewport);
    }
  } finally {
    try {
      await browser?.close();
    } finally {
      await server.close();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
