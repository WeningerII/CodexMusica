#!/usr/bin/env node
'use strict';
/* global document */
// Local-only keyboard regression for the shipped atlas and the app's Map iframe.
// CHROMIUM_PATH=/path/to/chrome node scripts/check_atlas_focus_browser.js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
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
    for (const mode of [
      { name: 'standalone desktop', route: '/atlas.html', width: 1440 },
      { name: 'embedded desktop', route: '/codex.html#map', width: 1440 },
      { name: 'embedded narrow', route: '/codex.html#map', width: 390 },
    ]) {
      const context = await browser.newContext({
        viewport: { width: mode.width, height: 900 },
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
      await page.goto(origin + mode.route);
      const map = mode.route === '/atlas.html' ? page : page.frameLocator('#map-frame');
      const info = map.locator('#t-info');
      await info.waitFor();
      await map.locator('#key-body [data-act="open-noorigin"]').waitFor({ state: 'attached' });
      const focused = async (selector, label) => {
        await page.waitForTimeout(50); // Observe after the browser has settled hidden-element focus.
        assert(
          await map
            .locator(selector)
            .evaluate((n) => document.activeElement === n && !!n.getClientRects().length),
          `${mode.name}: ${label}`
        );
        checks++;
      };
      await info.click();
      await page.keyboard.press('Escape');
      await focused('#t-info', 'information panel returns focus');
      const entries = mode.width > 900 ? ['information', 'legend'] : ['information'];
      for (const entry of entries) {
        for (const dismissal of ['Escape', 'close']) {
          if (entry === 'information') await info.click();
          const selector =
            entry === 'information'
              ? '#provenance [data-act="open-noorigin"]'
              : '#key-body [data-act="open-noorigin"]';
          await map.locator(selector).click();
          await focused('[data-act="close-noorigin"]', 'list receives initial focus');
          if (dismissal === 'Escape') {
            await page.keyboard.press('Tab'); // Dismiss while a list link owns focus, too.
            await page.keyboard.press('Escape');
          } else await map.locator('[data-act="close-noorigin"]').click();
          assert(await map.locator('#noorigin').isHidden(), 'list closes');
          await focused(
            entry === 'information' ? '#t-info' : selector,
            `${entry} / ${dismissal} returns to a visible opener`
          );
        }
      }
      if (mode.width > 900) {
        for (const mutation of ['removed', 'hidden']) {
          const opener = map.locator('#key-body [data-act="open-noorigin"]');
          await opener.click();
          // A panel redraw or layout change can invalidate the remembered DOM node.
          await opener.evaluate(
            (n, mutation) =>
              mutation === 'removed' ? n.replaceWith(n.cloneNode(true)) : (n.hidden = true),
            mutation
          );
          await page.keyboard.press('Escape');
          await focused('#t-info', `${mutation} opener uses a visible fallback`);
          if (mutation === 'hidden')
            await opener.evaluate((n) => {
              n.hidden = false;
            });
        }
      }
      console.log(`PASS ${mode.name}`);
      await context.close();
    }
    console.log(`Atlas focus: ${checks} checks passed`);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
