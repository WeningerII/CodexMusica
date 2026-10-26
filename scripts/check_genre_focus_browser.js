#!/usr/bin/env node
'use strict';
/* global document */
// Local-only keyboard regression for closing and reopening the Genre sound target controls.
// CHROMIUM_PATH=/path/to/chrome node scripts/check_genre_focus_browser.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const htmlArg = process.argv.find((arg) => arg.startsWith('--html='));
const html = path.resolve(htmlArg ? htmlArg.slice(7) : path.join(root, 'codex.html'));
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = pathname === '/codex.html' ? html : path.resolve(root, '.' + pathname);
  if (
    (file !== html && !file.startsWith(root + path.sep)) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  ) {
    res.writeHead(404).end();
    return;
  }
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
  };
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  let checks = 0;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox'],
    });
    for (const width of [1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        serviceWorkers: 'block',
      });
      await context.route('**/*', (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.fulfill({ status: 503, body: 'unavailable' })
      );
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.goto(origin + '/codex.html#genre');
      const density = page.locator('#gp-ax-density');
      await density.waitFor({ state: 'attached' });
      if (!(await density.isVisible()))
        await page.locator('[data-ui="genre-browse-toggle"]').click();
      for (const entry of ['adjacent', 'result chip']) {
        await density.click();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Tab');
        if (entry === 'result chip') {
          for (let i = 0; i < 100; i++) {
            if (
              await page.evaluate(() =>
                document.activeElement.matches(
                  '.cm-chip[data-ui="genre-sound-clear"][data-id="density"]'
                )
              )
            )
              break;
            await page.keyboard.press('Tab');
          }
        }
        assert(
          await page.evaluate(() =>
            document.activeElement.matches('[data-ui="genre-sound-clear"][data-id="density"]')
          ),
          `${entry} is keyboard reachable`
        );
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        assert(
          await density.evaluate((n) => document.activeElement === n),
          `${entry}: returns to matching slider`
        );
        assert.equal(await density.getAttribute('aria-valuetext'), 'Any — not applied');
        checks++;
      }
      await page.locator('[data-ui="genre-axes"]').click();
      const extra = page.locator('#surface-genre input[type="range"][data-axis]').nth(3);
      const id = await extra.getAttribute('id');
      const axis = await extra.getAttribute('data-axis');
      await extra.click();
      await page.keyboard.press('ArrowRight');
      await page.locator('[data-ui="genre-axes"]').click();
      await page.locator('#' + id).click();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.id), axis);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#' + id).count(), 0, 'inactive extra axis is collapsed');
      assert(
        await page.locator('[data-ui="genre-axes"]').evaluate((n) => document.activeElement === n),
        'collapsed slider returns to characteristics toggle'
      );
      checks++;
      if (width < 900) {
        await density.click();
        await page.keyboard.press('ArrowRight');
        await page.locator('[data-ui="genre-browse-toggle"]').click();
        for (let i = 0; i < 100; i++) {
          if (
            await page.evaluate(() =>
              document.activeElement.matches(
                '.cm-chip[data-ui="genre-sound-clear"][data-id="density"]'
              )
            )
          )
            break;
          await page.keyboard.press('Tab');
        }
        assert(
          await page.evaluate(() =>
            document.activeElement.matches(
              '.cm-chip[data-ui="genre-sound-clear"][data-id="density"]'
            )
          ),
          'collapsed-panel result chip is keyboard reachable'
        );
        await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
        assert(
          await page
            .locator('[data-ui="genre-browse-toggle"]')
            .evaluate((n) => document.activeElement === n),
          'collapsed panel returns to its visible disclosure'
        );
        assert.equal(
          await page.locator('[data-ui="genre-browse-toggle"]').getAttribute('aria-expanded'),
          'false',
          'panel stays collapsed'
        );
        checks++;
      }
      console.log(`PASS ${width}px`);
      await context.close();
    }
    console.log(`Genre focus: ${checks} clear-target checks passed`);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
