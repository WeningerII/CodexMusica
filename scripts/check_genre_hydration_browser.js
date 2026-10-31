#!/usr/bin/env node
'use strict';
/* global document, window, requestAnimationFrame, G, location */
// Real pointer input across optional geo hydration. Long/missing labels are authored cases.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + req.url.split('?')[0]);
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    'Content-Type',
    file.endsWith('.html')
      ? 'text/html'
      : file.endsWith('.json')
        ? 'application/json'
        : 'application/javascript'
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  try {
    for (const width of [390, 1280])
      for (const kind of ['real', 'long', 'missing']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        let release;
        const ready = new Promise((resolve) => {
          release = resolve;
        });
        const geo = JSON.parse(fs.readFileSync(path.join(root, 'data/atlas-geo.json')));
        const long = 'A very long place name '.repeat(20);
        if (kind === 'long') for (const coord of Object.values(geo.coords)) coord[2] = long;
        if (kind === 'missing') geo.coords = {};
        await context.route('**/data/atlas-geo.json', async (route) => {
          await ready;
          await route.fulfill({ contentType: 'application/json', body: JSON.stringify(geo) });
        });
        await context.route('**/api/tradition_images.json', (route) =>
          route.fulfill({ contentType: 'application/json', body: '{}' })
        );
        await context.route('https://mcp.codexmusica.com/**', (route) =>
          route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
        );
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(() => {
          window.pointerEvents = [];
          for (const type of ['pointerdown', 'pointerup', 'click'])
            document.addEventListener(
              type,
              (event) => {
                window.pointerEvents.push({ type, trusted: event.isTrusted, id: event.target.id });
              },
              true
            );
        });
        try {
          await page.goto(`http://127.0.0.1:${server.address().port}/codex.html#genre/delta_blues`);
          const tab = page.locator('#gp-tab-instruments');
          await tab.scrollIntoViewIfNeeded();
          const before = await tab.boundingBox();
          await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
          await page.mouse.down();
          release();
          await page.waitForFunction(
            () => typeof G !== 'undefined' && G.geo && typeof G.geo === 'object'
          );
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          );
          const after = await tab.boundingBox();
          await page.mouse.up();
          assert.equal(
            await tab.getAttribute('aria-selected'),
            'true',
            `${width}/${kind}: Instruments activates across hydration`
          );
          assert.deepEqual(
            after,
            before,
            `${width}/${kind}: hydration preserves hit target geometry`
          );
          const events = await page.evaluate(() => window.pointerEvents);
          assert.ok(
            events.some(
              (event) =>
                event.type === 'click' && event.trusted && event.id === 'gp-tab-instruments'
            )
          );
          const label = page.locator('.gp-detail-place');
          if (kind === 'missing') assert.equal(await label.textContent(), '');
          else {
            const text = await label.textContent();
            assert.ok(text.length > 0);
            assert.equal(await label.getAttribute('title'), text);
            if (kind === 'long') assert.ok(text.includes(long));
            assert.ok((await label.ariaSnapshot()).includes(text.trim()));
          }
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
            false,
            'no page overflow'
          );
          assert.deepEqual(errors, []);
          console.log(`PASS genre geo pointer/label ${width}/${kind}`);
        } catch (error) {
          const prefix = path.join(os.tmpdir(), `genre-hydration-${width}-${kind}`);
          fs.writeFileSync(prefix + '.html', await page.content());
          fs.writeFileSync(
            prefix + '.json',
            JSON.stringify(
              await page.evaluate(() => ({
                events: window.pointerEvents,
                active: document.activeElement.outerHTML,
                href: location.href,
              })),
              null,
              2
            )
          );
          await page.screenshot({ path: prefix + '.png', fullPage: true });
          throw error;
        } finally {
          release();
          await context.close();
        }
      }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
  server.close();
});
