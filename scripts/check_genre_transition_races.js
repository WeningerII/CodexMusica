#!/usr/bin/env node
'use strict';
/* global document, window, UI_PAGES, UI, uiAddGenre */
// Exercise accepted taps against the real native callback and shell redraws.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const arg = (name, fallback) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const html = path.resolve(arg('html', path.join(root, 'codex.html')));
const motion = path.resolve(arg('module', path.join(root, 'src/pages/genre-motion.mjs')));
const output = path.resolve(arg('output', '/tmp/genres-races'));
fs.mkdirSync(output, { recursive: true });
const photos = require('../api/tradition_images.json').traditions;
const cached = new Map();
for (const id of ['delta_blues', 'detroit_techno', 'javanese_gamelan']) {
  const file = path.join(output, `${id}.jpg`);
  if (!fs.existsSync(file))
    execFileSync('curl', ['-fsSL', '--max-time', '30', '-o', file, photos[id][0]]);
  cached.set(photos[id][0], fs.readFileSync(file));
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file =
    url.pathname === '/codex.html'
      ? html
      : url.pathname === '/src/pages/genre-motion.mjs'
        ? motion
        : path.resolve(root, '.' + url.pathname);
  if (
    (!file.startsWith(root + path.sep) && file !== html && file !== motion) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  )
    return res.writeHead(404).end();
  res.setHeader(
    'Content-Type',
    {
      '.html': 'text/html',
      '.mjs': 'text/javascript',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
    }[path.extname(file)] || 'application/octet-stream'
  );
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--no-sandbox'],
  });
  const results = [];
  try {
    for (const width of [390, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        hasTouch: width === 390,
        serviceWorkers: 'block',
        recordVideo: { dir: output, size: { width, height: 900 } },
      });
      await context.route('**/*', (route) => {
        const url = route.request().url();
        return cached.has(url)
          ? route.fulfill({ contentType: 'image/jpeg', body: cached.get(url) })
          : new URL(url).origin === origin
            ? route.continue()
            : route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await page.addInitScript(() => {
        const start = document.startViewTransition.bind(document);
        window.finished = Promise.resolve();
        document.startViewTransition = (update) => {
          const t = start(async () => {
            if (window.hold)
              await new Promise((r) => {
                window.release = r;
              });
            update();
          });
          t.ready.catch(() => {});
          window.finished = t.finished.catch(() => {});
          return t;
        };
      });
      const reset = async () => {
        await page.goto('about:blank');
        const loaded = page.waitForResponse((r) => r.url().endsWith('/src/pages/genre-motion.mjs'));
        await page.goto(origin + '/codex.html#genre');
        assert((await loaded).ok());
        await page.locator('[data-ui="genre-close"]').click();
        const tile = page.locator('.cm-tile[data-id="delta_blues"]');
        await page.waitForFunction(() => {
          const img = document.querySelector('.cm-tile[data-id="delta_blues"] img');
          return img?.complete && img.naturalWidth;
        });
        await page.waitForTimeout(200);
        await tile.scrollIntoViewIfNeeded();
      };
      const detail = () =>
        page.locator('#genre-detail').evaluateAll((ns) => ns[0]?.dataset.gpId || null);
      for (const next of ['recipe', 'render', 'resize', 'tab', 'search', 'tree', 'route', 'map']) {
        await reset();
        await page.evaluate(() => {
          window.hold = true;
          window.release = null;
        });
        const opener = page.locator('.cm-tile-name[data-id="delta_blues"]');
        if (width === 390) await opener.tap();
        else await opener.click();
        await page.waitForFunction(() => !!window.release);
        assert.equal(await detail(), null, 'native callback is genuinely pending');
        try {
          if (next === 'recipe') await page.evaluate(() => uiAddGenre('detroit_techno'));
          if (next === 'render') await page.evaluate(() => UI_PAGES.genre.render());
          if (next === 'resize') await page.setViewportSize({ width: width + 1, height: 900 });
          if (next === 'tab')
            await page.evaluate(() =>
              document.querySelector('[data-ui="genre-view-tab"][data-id="all"]').click()
            );
          if (next === 'search')
            await page.evaluate(() => {
              const input = document.querySelector('#genre-search');
              input.value = 'Detroit';
              input.dispatchEvent(new Event('input', { bubbles: true }));
            });
          if (next === 'tree')
            await page.evaluate(() => document.querySelector('[data-ui="genre-tree"]').click());
          if (next === 'route')
            await page.evaluate(() =>
              document.querySelector('button[data-view="instrument"]').click()
            );
          // The map's existing message consumer sets the shared selection
          // before rendering Genres. Inject at that boundary, not into motion.
          if (next === 'map')
            await page.evaluate(() => {
              UI.genre = 'detroit_techno';
              UI_PAGES.genre.render();
            });
          const passive = ['recipe', 'render', 'resize'].includes(next);
          await page.evaluate(() => {
            window.raceFocus = document.activeElement;
          });
          await page.evaluate(() => {
            window.hold = false;
            window.release();
          });
          await page.evaluate(() => window.finished);
          await page.waitForTimeout(150);
          if (passive) {
            assert.equal(await detail(), 'delta_blues', `${next} must preserve the accepted tap`);
            assert(
              await page.locator('#gp-detail-title').evaluate((n) => n === document.activeElement)
            );
            await page.locator('[data-ui="genre-close"]').click();
            await page.evaluate(() => window.finished);
            assert(await opener.evaluate((n) => n === document.activeElement));
          } else {
            assert.notEqual(
              await detail(),
              'delta_blues',
              `${next} must supersede the pending tap`
            );
            assert.equal(
              await page.evaluate(() => document.activeElement === window.raceFocus),
              true,
              `${next}: late callback must not steal focus`
            );
            if (next === 'map') assert.equal(await detail(), 'detroit_techno');
            if (next === 'route') assert.equal(new URL(page.url()).hash, '#instrument');
          }
          assert.equal(
            await page
              .locator('.gp-transition, [style*="view-transition-name: genre-image"]')
              .count(),
            0
          );
          results.push({ width, next, pass: true });
          console.log(`PASS ${width} ${next}`);
        } finally {
          await page.evaluate(() => {
            window.hold = false;
            window.release?.();
          });
        }
        await page.setViewportSize({ width, height: 900 });
      }
      const video = page.video();
      await context.close();
      await video.saveAs(path.join(output, `races-${width}.webm`));
    }
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify({ browser: browser.version(), results }, null, 2)
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
