#!/usr/bin/env node
'use strict';
/* global document, getComputedStyle, innerWidth, window */
// Exercise the published HTML shell and its lazy Song Forms assets on the Lyrics route.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('./_pages_server.js');

async function checkViewport(browser, origin, viewport) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  try {
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
    );
    const page = await context.newPage();
    await page.goto(origin + '/codex.html#lyrics');
    const draft = page.locator('#lyrics-draft');
    await draft.waitFor();
    const original = await draft.inputValue();
    const disclosure = page.locator('#ly-song-forms > summary');
    await disclosure.focus();
    const sheetResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/src/pages/song-forms.css'
    );
    await page.keyboard.press('Enter');
    const sheet = await sheetResponse;
    assert.equal(sheet.status(), 200);
    assert.match(sheet.headers()['content-type'], /text\/css/);
    await page.waitForFunction(() => {
      const link = document.getElementById('song-forms-style');
      return (
        link?.sheet?.cssRules.length &&
        getComputedStyle(document.getElementById('ly-song-forms-view')).display === 'grid'
      );
    });

    const view = page.locator('#ly-song-forms-view');
    const picker = view.getByRole('combobox', { name: 'Song form', exact: true });
    await picker.waitFor();
    await page.keyboard.press('Tab');
    assert.ok(await picker.evaluate((n) => n === document.activeElement));
    await page.keyboard.press('8');
    assert.equal(await picker.inputValue(), '8-bar-blues');
    const relations = view.locator('details').first();
    const summary = relations.locator(':scope > summary');
    await page.waitForFunction(
      () =>
        document.querySelector('#ly-song-forms-view details > summary')?.textContent ===
        'Related forms · 3'
    );
    await page.keyboard.press('Tab');
    assert.ok(await summary.evaluate((n) => n === document.activeElement));
    await page.keyboard.press('Enter');
    const couplet = relations.getByRole('button', { name: 'Couplet', exact: true });
    await couplet.waitFor();
    assert.match(await couplet.locator('..').textContent(), /Can contain · Catalog evidence only/);
    const directory = process.env.SONG_FORM_SCREENSHOT_DIR;
    if (directory) {
      await fs.mkdir(directory, { recursive: true });
      await page.screenshot({
        path: path.join(directory, 'lyrics-song-forms-' + viewport.width + '.png'),
      });
    }
    // Follow the link with actual Tab/Enter navigation.
    const buttons = await relations.getByRole('button').count();
    for (let i = 0; i < buttons; i++) {
      await page.keyboard.press('Tab');
      if (await couplet.evaluate((n) => n === document.activeElement)) break;
    }
    assert.ok(await couplet.evaluate((n) => n === document.activeElement));
    await page.keyboard.press('Enter');
    assert.equal(await picker.inputValue(), 'couplet');
    assert.ok(await summary.evaluate((n) => n === document.activeElement));
    const reverse = relations.getByRole('button', { name: '8-bar blues', exact: true });
    assert.match(
      await reverse.locator('..').textContent(),
      /Can occur within · Catalog evidence only/
    );
    const fit = await view.evaluate((node) => ({
      form: node.scrollWidth <= node.clientWidth + 1,
      page: document.documentElement.scrollWidth <= innerWidth + 1,
    }));
    assert.deepEqual(
      fit,
      { form: true, page: true },
      'No horizontal overflow at ' + viewport.width
    );
    assert.equal(await draft.inputValue(), original);
    assert.equal(new URL(page.url()).hash, '#lyrics');
    // Browsing an ineligible pattern never binds a generic writer request.
    await view.getByRole('combobox', { name: 'Pattern to expand' }).selectOption('1');
    await view.getByRole('button', { name: 'Show expanded structure' }).click();
    await view.getByText('This pattern is available for study only.').waitFor();
    assert.equal(await view.getByRole('button', { name: 'Write with this form' }).count(), 0);
    assert.deepEqual(await page.evaluate(() => window.uiLyricContext('lyrics').declarations), {});
    await picker.selectOption('chorus-first');
    await view.getByRole('combobox', { name: 'Pattern to expand' }).selectOption('0');
    await view.getByRole('spinbutton').fill('1');
    await view.getByRole('button', { name: 'Show expanded structure' }).click();
    const write = view.getByRole('button', { name: 'Write with this form' });
    await write.focus();
    await page.keyboard.press('Enter');
    const input = page.locator('#chat-input');
    await input.waitFor();
    assert.ok(await input.evaluate((node) => document.activeElement === node));
    const badge = page.locator('#ly-creation-form');
    assert.equal(await badge.isVisible(), true);
    assert.equal(await badge.locator('span').textContent(), 'Song form · Chorus-first');
    const selection = {
      catalog_form: 'chorus-first',
      catalog_variant: 0,
      catalog_counts: [{ path: '1.2', count: 1 }],
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
      assert.equal(await badge.isVisible(), false);
      assert.deepEqual(await page.evaluate(() => window.uiLyricContext('lyrics').declarations), {});
    }
    // Capture the actual native POST without contacting or charging a provider.
    await page.route('**/chat', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Offline request captured.' }),
      })
    );
    const request = page.waitForRequest(
      (req) => new URL(req.url()).pathname === '/chat' && req.method() === 'POST'
    );
    await input.fill('Create a song.');
    await page.locator('#chat-send').click();
    const body = (await request).postDataJSON();
    assert.deepEqual(body.task, { domain: 'lyrics', phase: 'create' });
    assert.deepEqual(body.lyric_context.declarations, viewport.width < 500 ? {} : selection);
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
      await retry.getByText('Song forms could not load. Close and reopen to retry.').waitFor();
      assert.equal(await editor.inputValue(), 'Untitled draft');
      assert.deepEqual(
        await retry.evaluate(() => window.uiLyricContext('lyrics').declarations),
        {}
      );
      await toggle.press('Enter');
      await toggle.press('Enter');
      await retry.getByRole('combobox', { name: 'Song form', exact: true }).waitFor();
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
