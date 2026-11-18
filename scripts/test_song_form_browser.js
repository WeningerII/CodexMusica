#!/usr/bin/env node
'use strict';
/* global document, getComputedStyle, innerWidth */
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
