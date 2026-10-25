#!/usr/bin/env node
'use strict';
/* global document, app, UI */
// Local-only keyboard regression for cross-page browser history focus.
// CHROMIUM_PATH=/path/to/chrome node scripts/check_navigation_focus_browser.js
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
    for (const seeded of [false, true]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        serviceWorkers: 'block',
      });
      await context.route('**/*', (r) =>
        new URL(r.request().url()).origin === origin
          ? r.continue()
          : r.fulfill({ status: 503, body: 'unavailable' })
      );
      const page = await context.newPage();
      page.setDefaultTimeout(10000);
      await page.goto(origin + '/codex.html#genre');
      await page.locator('#genre-search').fill('Delta blues');
      await page.locator('[data-ui="genre-select"][data-id="delta_blues"]').first().click();
      const genre = await page.evaluate(() => UI.genre);
      await page.locator('button[data-view="instrument"]').click();
      await page.locator('#instrument-search').fill('Glass harmonica');
      await page
        .locator('[data-ui="instrument-inspect"][data-id="glass_harmonica"]')
        .first()
        .click();
      if (seeded) {
        await page.locator('[data-ui="ip-add-configured"]').click();
        await page.waitForFunction(() => app.cards.length === 1);
      }
      const snapshot = () =>
        page.evaluate(() =>
          JSON.stringify({
            cards: app.cards,
            history: app.history,
            historyIndex: app.historyIndex,
            workspaceName: app.workspaceName,
            lyrics: app.lyrics,
          })
        );
      const before = await snapshot();
      const verify = async (view) => {
        await page.waitForFunction((view) => document.body.dataset.view === view, view);
        assert(
          await page
            .locator(`button[data-view="${view}"]`)
            .evaluate(
              (n) =>
                document.activeElement === n &&
                n.getAttribute('aria-current') === 'page' &&
                !!n.getClientRects().length
            ),
          `history ${view}: destination nav receives focus`
        );
        assert.equal(await snapshot(), before, 'navigation does not edit the recipe or history');
        assert.equal(await page.evaluate(() => UI.genre), genre, 'genre detail retained');
        assert.equal(
          await page.evaluate(() => UI.instrumentPreview),
          'glass_harmonica',
          'instrument preview retained'
        );
        checks++;
      };
      await page.goBack();
      await verify('genre');
      await page.goForward();
      await verify('instrument');
      await page.locator('button[data-view="genre"]').click();
      await verify('genre');
      await page.goBack();
      await verify('instrument');
      await page.goForward();
      await verify('genre');
      console.log(`PASS ${seeded ? 'one-card' : 'empty'} recipe`);
      await context.close();
    }
    console.log(`Navigation focus: ${checks} route checks passed`);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
