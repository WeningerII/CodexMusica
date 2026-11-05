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
      for (const kind of ['real', 'long', 'missing', 'one', 'two']) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        let release;
        const ready = new Promise((resolve) => {
          release = resolve;
        });
        const geo = JSON.parse(fs.readFileSync(path.join(root, 'data/atlas-geo.json')));
        const long = 'A very long place name '.repeat(20);
        if (kind === 'long') for (const coord of Object.values(geo.coords)) coord[2] = long;
        if (kind === 'missing') geo.coords = {};
        // #656 item 7: fixed strings, independent of the live catalog. At 390
        // the place line reserves two lines; 'one' and 'two' fit, 'long' does not.
        const fixed = {
          one: 'Clarksdale, North America',
          two: 'Southern Appalachians and the Blue Ridge, North America',
        };
        if (fixed[kind]) for (const coord of Object.values(geo.coords)) coord[2] = fixed[kind];
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
          // #656 item 7: only a name its reserved lines cannot hold becomes a
          // button; it reveals the whole name on Enter, and the name stays
          // complete for assistive technology throughout.
          const fit = () =>
            page.evaluate(() => {
              const l = document.querySelector('.gp-detail-place');
              const sp = l.querySelector('span');
              return {
                role: l.getAttribute('role'),
                expanded: l.getAttribute('aria-expanded'),
                height: l.getBoundingClientRect().height,
                clipped: !!sp && sp.scrollHeight > sp.clientHeight + 1,
              };
            });
          const placed = await fit();
          if (width === 390 && kind === 'long') {
            assert.equal(placed.role, 'button', `${width}/${kind}: a clipped name is a button`);
            assert.equal(placed.expanded, 'false');
            assert.ok(placed.clipped, `${width}/${kind}: the name is clipped before the reveal`);
            await label.focus();
            await page.keyboard.press('Enter');
            const open = await fit();
            assert.equal(open.expanded, 'true', `${width}/${kind}: Enter reveals the name`);
            assert.ok(!open.clipped, `${width}/${kind}: the whole name is shown`);
            assert.ok(open.height > placed.height, `${width}/${kind}: the line grew on request`);
            assert.ok((await label.ariaSnapshot()).includes(long.trim()));
          } else {
            assert.equal(placed.role, null, `${width}/${kind}: no button when the name fits`);
          }
          if (width === 390 && (kind === 'one' || kind === 'two'))
            assert.ok(!placed.clipped, `${width}/${kind}: the name is shown whole`);
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
