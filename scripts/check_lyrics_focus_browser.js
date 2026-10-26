#!/usr/bin/env node
'use strict';
/* global document */
// Local-only keyboard regression for closing and reopening the Lyrics Relations dialog.
// CHROMIUM_PATH=/path/to/chrome node scripts/check_lyrics_focus_browser.js
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
    for (const draft of ['', '[Verse]\nThe morning light\nIs warm and bright']) {
      for (const dismissal of ['Escape', 'Enter']) {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          serviceWorkers: 'block',
        });
        await context.route('**/*', (route) =>
          new URL(route.request().url()).origin === origin
            ? route.continue()
            : route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: '{"error":"unavailable"}',
              })
        );
        const page = await context.newPage();
        await page.goto(origin + '/codex.html#lyrics');
        await page.locator('#lyrics-draft').waitFor();
        if (draft) {
          await page.locator('#lyrics-draft').fill(draft);
          await page.locator('[data-ui="ly-find-open"]').click();
          await page.keyboard.press('Escape');
        }
        // Reach the initial trigger using real Tab navigation, then activate Enter.
        const trigger = page.locator('[data-ui="ly-relations"]');
        for (let i = 0; i < 60; i++) {
          if (await trigger.evaluate((n) => document.activeElement === n)) break;
          await page.keyboard.press('Tab');
        }
        assert(
          await trigger.evaluate((n) => document.activeElement === n),
          'Relations is keyboard reachable'
        );
        const dialog = page.locator('#ly-relations-dialog');
        for (const opening of ['first opening', 'reopening']) {
          await page.keyboard.press('Enter');
          await dialog.waitFor({ state: 'visible' });
          assert(
            await dialog
              .locator('[data-ui="ly-relation-close"]')
              .evaluate((n) => document.activeElement === n),
            'dialog focuses Close'
          );
          if (dismissal === 'Escape') await page.keyboard.press('Tab');
          await page.keyboard.press(dismissal);
          await dialog.waitFor({ state: 'hidden' });
          assert(
            await page
              .locator('[data-ui="ly-relation-reopen"]')
              .evaluate((n) => document.activeElement === n && !!n.getClientRects().length),
            `${opening} / ${dismissal}: focus returns to Back to relations`
          );
          assert.equal(
            await page.locator('#lyrics-draft').inputValue(),
            draft,
            'draft text unchanged'
          );
          assert.equal(new URL(page.url()).hash, '#lyrics', 'route unchanged');
          checks++;
        }
        console.log(`PASS ${draft ? 'two-line draft' : 'empty draft'} / ${dismissal}`);
        await context.close();
      }
    }
    console.log(`Lyrics focus: ${checks} dismissal checks passed`);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
