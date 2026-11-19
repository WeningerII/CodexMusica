#!/usr/bin/env node
'use strict';
// Optional real-browser gate: CHROMIUM_PATH=/path/to/chrome node scripts/check_atlas_tiles_browser.js
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + rel);
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  const type =
    {
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.webp': 'image/webp',
      '.html': 'text/html',
      '.css': 'text/css',
    }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': fs.statSync(file).size });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/atlas.html`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const report = [];
  try {
    for (const mode of [
      { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
      {
        name: 'mobile',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    ]) {
      const context = await browser.newContext(mode);
      const page = await context.newPage();
      const errors = [],
        failures = [],
        requests = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('response', (r) => {
        if (r.status() >= 400 && r.url().includes('/earth-tiles/')) failures.push(r.url());
      });
      page.on('request', (r) => {
        if (r.url().includes('/earth-tiles/')) requests.push(r.url());
      });
      await page.route('https://**/*', (route) => route.abort()); // External fonts are not part of the imagery test.
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForSelector('#canvas-host canvas');
      await delay(400);
      const initial = requests.slice();
      const initialBytes = initial.reduce(
        (n, u) => n + fs.statSync(path.join(root, new URL(u).pathname)).size,
        0
      );
      assert(initialBytes < 1000000, `${mode.name}: initial imagery over 1 MB: ${initialBytes}`);
      assert(
        initial.every((u) => !u.includes('/6/')),
        'Native source detail fetched at overview'
      );
      await page.screenshot({ path: `/tmp/atlas-${mode.name}-overview.png` });
      if (mode.isMobile) {
        await page.locator('#search').fill('Hungarian');
        await page.locator('#results [data-tid]').first().tap();
        await delay(500); // Let the existing fly-to animation finish.
        await page.locator('#search').fill('');
        await page.locator('[data-act="close-card"]').first().tap();
        // Exercise actual touch controls; wheel deltas are normalized differently
        // by mobile emulation and do not represent a finger pinch.
        for (let i = 0; i < 8; i++) await page.locator('#zoom-in').tap();
      } else {
        // Zoom toward Europe, then exercise the shared zoom buttons.
        const host = await page.locator('#canvas-host').boundingBox();
        const baseScale = Math.min(host.width / 5.6, host.height / 2.75);
        await page.mouse.move(
          host.x + host.width / 2 + 0.25 * baseScale,
          host.y + host.height / 2 - 0.9 * baseScale
        );
        await page.mouse.wheel(0, -1800);
        await delay(100);
        await page.mouse.wheel(0, -1800);
        await delay(100);
        await page.locator('#zoom-out').click({ force: true });
        await page.locator('#zoom-in').click({ force: true });
      }
      await delay(200);
      await page.waitForLoadState('networkidle');
      await delay(400);
      assert(
        requests.some((u) => /\/6\/\d+\/\d+\.webp$/.test(u)),
        `${mode.name}: maximum detail not requested; URLs: ${requests.join(', ')}`
      );
      await page.screenshot({ path: `/tmp/atlas-${mode.name}-detail.png` });
      const canvas = await page.locator('#canvas-host canvas').boundingBox();
      await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height * 0.6);
      await page.mouse.down();
      await page.mouse.move(canvas.x + canvas.width * 0.35, canvas.y + canvas.height * 0.45, {
        steps: 12,
      });
      await page.mouse.up();
      await delay(200);
      await page.waitForLoadState('networkidle');
      await page.locator('#zoom-reset').click({ force: true });
      await delay(200);
      await page.waitForLoadState('networkidle');
      await page.setViewportSize({
        width: mode.viewport.width - 20,
        height: mode.viewport.height - 20,
      });
      await delay(300);
      assert.equal(errors.length, 0, errors.join('\n'));
      assert.equal(failures.length, 0, failures.join('\n'));
      report.push({
        mode: mode.name,
        initialRequests: initial.length,
        initialImageBytes: initialBytes,
        totalRequestsAfterZoomPanReset: requests.length,
        pageErrors: errors.length,
        missingTiles: failures.length,
      });
      await context.close();
    }
    // Tile failures must not disable search/zoom or cause a retry loop.
    //
    // A retry is a second request for a tile URL that has already had its 404
    // delivered. A second batch of NEW tiles is not one: the loader fetches
    // MAX_ACTIVE (6) tiles at a time, so a zoom that needs 12 sends them in
    // two batches, and on a loaded runner the second can come late. So the
    // check compares URLs, never a count over a quiet interval, and it waits
    // for the loader's own queue to drain (a script injected before the page
    // loads keeps a reference to the loader; no production code changes):
    // no timer pending, nothing in flight, every wanted tile cached or failed.
    //
    // The controls run every time, so the check is shown to tell the two
    // apart: 'late-batch' holds the first six 404s for 600 ms (the second
    // batch of new URLs arrives late) and must pass; 'repeat-once' requests
    // each failed tile once more 250 ms after its 404 and then stops, and
    // 'retry-always' disables the loader's failed-tile guard; both must fail.
    const failureRun = async (control) => {
      const page = await browser.newPage();
      await page.addInitScript((mode) => {
        let wrapped;
        Object.defineProperty(globalThis, 'AtlasTiles', {
          configurable: true,
          get: () => wrapped,
          set: (Loader) => {
            wrapped = function (...args) {
              const tiles = new Loader(...args);
              globalThis.__atlasTiles = tiles;
              if (mode === 'retry-always') tiles.failed.has = () => false;
              return tiles;
            };
            wrapped.prototype = Loader.prototype;
          },
        });
        if (mode === 'repeat-once') {
          const original = globalThis.fetch;
          globalThis.fetch = function (input, init) {
            const pending = original.call(this, input, init);
            const href = String(input);
            if (/earth-tiles\/.*\.webp$/.test(href))
              pending.then(
                (response) => {
                  if (!response.ok) setTimeout(() => original(href).catch(() => {}), 250);
                },
                () => {}
              );
            return pending;
          };
        }
      }, control);
      const delivered = new Set();
      const requested = new Set();
      const repeats = [];
      let stationary = false;
      await page.route('https://**/*', (route) => route.abort());
      await page.route(/earth-tiles\/.*\/[0-6]\/\d+\/\d+\.webp$/, async (route) => {
        const href = route.request().url();
        if (stationary && delivered.has(href)) repeats.push(href);
        requested.add(href);
        if (control === 'late-batch' && requested.size <= 6) await delay(600);
        try {
          await route.fulfill({ status: 404 });
          delivered.add(href);
        } catch {
          /* the page abandoned the request; it was never a delivered 404 */
        }
      });
      await page.goto(url, { waitUntil: 'networkidle' });
      for (let i = 0; i < 5; i++) await page.locator('#zoom-in').click({ force: true });
      stationary = true;
      const drainedNow = () =>
        page.evaluate(() => {
          const tiles = globalThis.__atlasTiles;
          return Boolean(
            tiles &&
            tiles.manifest &&
            tiles.timer === null &&
            tiles.active.size === 0 &&
            tiles.wanted.length > 0 &&
            tiles.wanted.every(
              (t) => tiles.cache.has(t.key) || Map.prototype.has.call(tiles.failed, t.key)
            )
          );
        });
      let drained = false;
      // Bounded: 20 s, and a repeat already seen ends the wait (it fails anyway).
      for (let waited = 0; waited < 20000 && !drained && !repeats.length; waited += 100) {
        drained = await drainedNow();
        if (!drained) await delay(100);
      }
      // A retry scheduled from a 404 would arrive within this window.
      await delay(1000);
      drained = drained && (await drainedNow());
      await page.locator('#zoom-reset').click({ force: true });
      await page.locator('#search').fill('blues');
      assert.equal(await page.locator('#search').inputValue(), 'blues');
      await delay(300);
      if (control === 'none') await page.screenshot({ path: '/tmp/atlas-fallback.png' });
      await page.close();
      return { control, drained, requested: requested.size, repeats: repeats.length };
    };
    const real = await failureRun('none');
    assert(real.requested > 0, 'Failure route did not intercept tiles');
    assert(real.drained, `Tile queue did not drain after failures: ${JSON.stringify(real)}`);
    assert.equal(real.repeats, 0, 'Failed tiles were requested again');
    const late = await failureRun('late-batch');
    assert(
      late.drained && late.repeats === 0 && late.requested === real.requested,
      `Control: a late batch of new tiles was taken for a retry: ${JSON.stringify(late)}`
    );
    for (const control of ['repeat-once', 'retry-always']) {
      const run = await failureRun(control);
      assert(run.repeats > 0, `Control: ${control} was not detected: ${JSON.stringify(run)}`);
    }
    report.push({ failureFallback: 'passed', failedRequests: real.requested });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
