#!/usr/bin/env node
'use strict';
/* global document */
// Local-only keyboard regression for Lyrics section actions after table replacement.
// CHROMIUM_PATH=/path/to/chrome node scripts/check_lyrics_sections_focus_browser.js
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
      for (const operation of ['move', 'duplicate', 'remove']) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          serviceWorkers: 'block',
        });
        await context.route('**/*', (r) =>
          new URL(r.request().url()).origin === origin
            ? r.continue()
            : r.fulfill({ status: 503, body: 'unavailable' })
        );
        const page = await context.newPage();
        page.setDefaultTimeout(10000);
        await page.goto(origin + '/codex.html#lyrics');
        await page
          .locator('#lyrics-draft')
          .fill('[Verse]\nMorning light\n[Chorus]\nWarm and bright\n[Bridge]\nHome tonight');
        await page.locator('[data-ui="ly-find-open"]').click();
        await page.keyboard.press('Escape');
        if (width < 900) await page.locator('[data-ui="ly-mobile"][data-id="tools"]').click();
        await page.locator('[data-ui="ly-tool"][data-id="form-story"]').click();
        const tabTo = async (selector) => {
          for (let i = 0; i < 90; i++) {
            if (await page.locator(selector).evaluate((n) => document.activeElement === n)) return;
            await page.keyboard.press('Tab');
          }
          throw Error('Cannot reach ' + selector);
        };
        const focus = async (selector) => {
          await page.waitForTimeout(100);
          assert(
            await page
              .locator(selector)
              .evaluate(
                (n) => document.activeElement === n && !n.disabled && !!n.getClientRects().length
              ),
            `${width} / ${operation}: focus ${selector}`
          );
          checks++;
        };
        if (operation === 'move') {
          await tabTo('[data-ui="ly-sec-move"][data-id="0:1"]');
          await page.keyboard.press('Enter');
          await focus('[data-ui="ly-sec-move"][data-id="1:1"]');
          assert.match(
            await page.locator('#lyrics-draft').inputValue(),
            /^\[Chorus\][\s\S]*\[Verse\][\s\S]*\[Bridge\]/
          );
          await page.keyboard.press('Enter');
          await focus('[data-ui="ly-form-pick"][data-id="2"]');
          assert(
            await page.locator('[data-ui="ly-sec-move"][data-id="2:1"]').isDisabled(),
            'last Move down remains disabled'
          );
          await page.keyboard.press('Tab');
          await page.keyboard.press('Enter');
          await focus('[data-ui="ly-sec-move"][data-id="1:-1"]');
        } else if (operation === 'duplicate') {
          await tabTo('[data-ui="ly-sec-dup"][data-id="0"]');
          await page.keyboard.press('Enter');
          await focus('[data-ui="ly-sec-dup"][data-id="1"]');
          assert.equal(await page.locator('#ly-form-rows tr').count(), 4);
          await page.keyboard.press('Enter');
          await focus('[data-ui="ly-sec-dup"][data-id="2"]');
          assert.equal(await page.locator('#ly-form-rows tr').count(), 5);
        } else {
          await tabTo('[data-ui="ly-sec-remove"][data-id="1"]');
          await page.keyboard.press('Enter');
          await focus('[data-ui="ly-sec-remove"][data-id="1"]');
          await page.keyboard.press('Enter');
          await focus('[data-ui="ly-sec-remove"][data-id="0"]');
          await page.keyboard.press('Enter');
          await focus(
            width < 900
              ? '#ly-panel-tools [data-ui="ly-tool"][data-id="form-story"]'
              : '.ly-tool-nav [data-ui="ly-tool"]'
          );
          assert.equal(await page.locator('#lyrics-draft').inputValue(), '');
        }
        assert.equal(new URL(page.url()).hash, '#lyrics');
        console.log(`PASS ${width}px / ${operation}`);
        await context.close();
      }
    }
    console.log(`Lyrics sections focus: ${checks} action checks passed`);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
