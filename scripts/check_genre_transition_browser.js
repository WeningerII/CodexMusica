#!/usr/bin/env node
'use strict';
/* global document, window */
// Local browser comparison. Uses real catalog photographs cached by URL; no
// synthetic image stands in for a genre. See docs/genres-native-transition.md.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const arg = (name, fallback) =>
  process.argv
    .find((v) => v.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') || fallback;
const html = path.resolve(arg('html', '/tmp/genres-native-after.html'));
const baseline = path.resolve(arg('baseline', '/tmp/genres-native-before.html'));
const output = path.resolve(arg('output', '/tmp/genres-native-evidence'));
fs.mkdirSync(output, { recursive: true });
const photos = require('../api/tradition_images.json').traditions;
const ids = ['delta_blues', 'detroit_techno', 'javanese_gamelan'];
const cached = new Map();
for (const id of ids) {
  const file = path.join(output, id + '.jpg');
  if (!fs.existsSync(file))
    execFileSync('curl', ['-fsSL', '--max-time', '30', '-o', file, photos[id][0]]);
  cached.set(photos[id][0], fs.readFileSync(file));
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const file =
    url.pathname === '/before.html'
      ? baseline
      : url.pathname === '/after.html'
        ? html
        : path.resolve(root, '.' + url.pathname);
  if (
    (!file.startsWith(root + path.sep) && file !== baseline && file !== html) ||
    !fs.existsSync(file) ||
    !fs.statSync(file).isFile()
  )
    return res.writeHead(404).end();
  res.setHeader(
    'Content-Type',
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.css': 'text/css',
    }[path.extname(file)] || 'application/octet-stream'
  );
  fs.createReadStream(file).pipe(res);
});
const results = [];
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    for (const width of [390, 1280])
      for (const variant of ['before', 'after']) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          serviceWorkers: 'block',
          hasTouch: width === 390,
          recordVideo: { dir: output, size: { width, height: 900 } },
        });
        await context.route('**/*', (route) => {
          const url = route.request().url();
          if (cached.has(url))
            return route.fulfill({ contentType: 'image/jpeg', body: cached.get(url) });
          return new URL(url).origin === origin ? route.continue() : route.abort();
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
          window.transitions = [];
          const start = document.startViewTransition.bind(document);
          document.startViewTransition = (update) => {
            const entry = {
              oldNames: document.querySelectorAll('[style*="view-transition-name: genre-image"]')
                .length,
            };
            window.transitions.push(entry);
            const transition = start(async () => {
              if (window.delayUpdate) await new Promise((r) => setTimeout(r, 100));
              await update();
              entry.newNames = document.querySelectorAll(
                '[style*="view-transition-name: genre-image"]'
              ).length;
            });
            const skip = transition.skipTransition.bind(transition);
            transition.skipTransition = () => {
              entry.skipCalls = (entry.skipCalls || 0) + 1;
              skip();
            };
            transition.ready.then(
              () => {
                entry.ready = true;
                entry.frames = document
                  .getAnimations()
                  .filter((a) => a.effect?.pseudoElement === '::view-transition-group(genre-image)')
                  .map((a) => a.effect.getKeyframes());
              },
              (e) => {
                entry.skipped = e.name;
              }
            );
            transition.finished.then(
              () => {
                entry.finished = true;
              },
              () => {
                entry.finished = true;
              }
            );
            return transition;
          };
        });
        await page.goto(origin + '/' + variant + '.html#genre');
        await page.locator('[data-ui="genre-close"]').click();
        const button = (id) =>
          page.locator(`#genre-list [data-ui="genre-select"][data-id="${id}"]`).first();
        const settle = async () => {
          await page.waitForFunction(() => window.transitions.every((t) => t.finished));
          await page.waitForTimeout(50);
        };
        const ready = async (id) => {
          const b = button(id);
          await b.locator('..').locator('..').scrollIntoViewIfNeeded();
          await page.waitForFunction((id) => {
            const row = document.querySelector(
              `.cm-tile[data-id="${id}"], .gp-row[data-gp-id="${id}"]`
            );
            const img = row?.querySelector('.cm-tile-img, .gp-img');
            return img?.complete && img.naturalWidth > 0;
          }, id);
          await page.waitForTimeout(150);
        };
        const states = [];
        for (const layout of ['rows', 'list']) {
          await page.locator(`[data-ui="genre-layout"][data-id="${layout}"]`).click();
          for (const id of ids) {
            await ready(id);
            if (id === 'detroit_techno') {
              await button(id).hover();
              await page.waitForTimeout(400);
              await button(id).click();
            } else {
              await button(id).focus();
              await page.keyboard.press('Enter');
            }
            await settle();
            assert.equal(await page.locator('#genre-detail').getAttribute('data-gp-id'), id);
            assert(
              await page.locator('#gp-detail-title').evaluate((n) => document.activeElement === n)
            );
            assert.equal(new URL(page.url()).hash, '#genre');
            if (id === 'delta_blues' && layout === 'rows')
              await page.screenshot({ path: path.join(output, `${variant}-${width}-detail.png`) });
            await page.locator('#gp-tab-sound').click();
            await page.locator('[data-ui="genre-close"]').click();
            await settle();
            assert(await button(id).evaluate((n) => document.activeElement === n));
            states.push(
              await page.evaluate(() => ({
                focus: document.activeElement.dataset.id,
                scroll: [...document.querySelectorAll('.cm-rows-track')].map((n) => n.scrollLeft),
                details: !!document.querySelector('#genre-detail'),
              }))
            );
          }
        }
        // Rapid open/open and open/Escape while the real API callback is pending.
        await page.locator('[data-ui="genre-layout"][data-id="rows"]').click();
        await ready('delta_blues');
        await page.evaluate(() => {
          window.delayUpdate = true;
          document.querySelector('.cm-tile-name[data-id="delta_blues"]').click();
          document.querySelector('.cm-tile-name[data-id="detroit_techno"]').click();
        });
        await settle();
        assert.equal(
          await page.locator('#genre-detail').getAttribute('data-gp-id'),
          'detroit_techno'
        );
        await page.locator('[data-ui="genre-close"]').click();
        await settle();
        await ready('delta_blues');
        await page.evaluate(() =>
          document.querySelector('.cm-tile-name[data-id="delta_blues"]').click()
        );
        await page.keyboard.press('Escape');
        await settle();
        assert.equal(await page.locator('#genre-detail').count(), 0);
        await page.evaluate(() => {
          window.delayUpdate = false;
        });
        // Tab during snapshot capture must start from the committed heading.
        await ready('delta_blues');
        await button('delta_blues').focus();
        await page.evaluate(() => {
          window.delayUpdate = true;
          document.querySelector('.cm-tile-name[data-id="delta_blues"]').click();
        });
        await page.keyboard.press('Tab');
        await settle();
        states.push(await page.evaluate(() => ({ tabFocus: document.activeElement.outerHTML })));
        await page.evaluate(() => {
          window.delayUpdate = false;
        });
        await page.locator('[data-ui="genre-close"]').click();
        await settle();
        // Existing shell history only: genre selection does not create routes.
        await page.locator('button[data-view="instrument"]').click();
        await page.waitForURL('**#instrument');
        await page.goBack();
        await page.waitForURL('**#genre');
        await page.goForward();
        await page.waitForURL('**#instrument');
        await page.goBack();
        await page.waitForURL('**#genre');
        // Resize / motion preference changes interrupt a real running animation.
        if (variant === 'after')
          for (const interrupt of ['resize', 'reduce', 'wheel']) {
            await ready('delta_blues');
            await page.evaluate(() =>
              document.querySelector('.cm-tile-name[data-id="delta_blues"]').click()
            );
            await page.waitForFunction(() => transitions.at(-1)?.ready);
            if (interrupt === 'resize')
              await page.setViewportSize({ width: width + 1, height: 900 });
            else if (interrupt === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' });
            else await page.mouse.wheel(0, 10);
            await settle();
            assert(
              await page.evaluate(() => transitions.at(-1).skipCalls > 0),
              'running transition explicitly skipped'
            );
            assert.equal(
              await page.locator('#genre-detail').getAttribute('data-gp-id'),
              'delta_blues'
            );
            assert.equal(
              await page.locator('[style*="view-transition-name: genre-image"]').count(),
              0
            );
            await page.locator('[data-ui="genre-close"]').click();
            await settle();
            await page.setViewportSize({ width, height: 900 });
            await page.emulateMedia({ reducedMotion: 'no-preference' });
          }
        // A clipped or wholly offscreen photo never supplies a fabricated source.
        for (const offset of [32, 10000]) {
          await ready('delta_blues');
          await button('delta_blues').evaluate((b, offset) => {
            const track = b.closest('.cm-rows-track');
            // Freeze a deliberate clipping fixture; proximity snap would turn
            // a 32px scroll back into a fully visible card on some hosts.
            track.style.scrollSnapType = 'none';
            track.scrollLeft = offset;
          }, offset);
          await page.waitForTimeout(80);
          assert(
            await button('delta_blues').evaluate((b) => {
              const photo = b
                .closest('.cm-tile')
                .querySelector('.cm-tile-shot')
                .getBoundingClientRect();
              const track = b.closest('.cm-rows-track').getBoundingClientRect();
              return photo.left < track.left;
            }),
            'fixture has a genuinely clipped photo'
          );
          const count = await page.evaluate(() => transitions.length);
          await button('delta_blues').evaluate((b) => b.click());
          await settle();
          assert.equal(await page.evaluate(() => transitions.length), count);
          await page.locator('[data-ui="genre-close"]').click();
          await settle();
        }
        // Reduced motion and feature-disabled both retain the same state/focus path.
        for (const fallback of ['reduce', 'disabled']) {
          if (fallback === 'reduce') await page.emulateMedia({ reducedMotion: 'reduce' });
          else {
            await page.emulateMedia({ reducedMotion: 'no-preference' });
            await page.evaluate(() => {
              document.startViewTransition = undefined;
            });
          }
          await ready('delta_blues');
          const count = await page.evaluate(() => transitions.length);
          if (width === 390) await button('delta_blues').tap();
          else await button('delta_blues').click();
          await settle();
          assert.equal(await page.evaluate(() => transitions.length), count);
          await page.locator('[data-ui="genre-close"]').click();
          await settle();
          assert(await button('delta_blues').evaluate((n) => document.activeElement === n));
        }
        // A cold photo must not hold up the state/focus update.
        const slow = await context.newPage();
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        await slow.route('**/*', async (route) => {
          const url = route.request().url();
          if (!cached.has(url)) return route.fallback();
          await gate;
          await route.fulfill({ contentType: 'image/jpeg', body: cached.get(url) });
        });
        await slow.addInitScript(() => {
          window.starts = 0;
          const start = document.startViewTransition.bind(document);
          document.startViewTransition = (fn) => {
            window.starts++;
            return start(fn);
          };
        });
        await slow.goto(origin + '/' + variant + '.html#genre', { waitUntil: 'domcontentloaded' });
        await slow.locator('[data-ui="genre-close"]').click();
        await slow.locator('.cm-tile[data-id="delta_blues"] .cm-tile-img').waitFor();
        await slow.locator('.cm-tile-name[data-id="delta_blues"]').click();
        assert.equal(await slow.locator('#genre-detail').getAttribute('data-gp-id'), 'delta_blues');
        assert.equal(await slow.evaluate(() => window.starts), 0);
        assert(
          await slow.locator('#gp-detail-title').evaluate((n) => document.activeElement === n)
        );
        release();
        await slow.close();
        const transitions = await page.evaluate(() => transitions);
        if (variant === 'after') {
          assert(
            transitions.filter((t) => t.ready && t.frames?.length).length >= 2,
            'native image transitions must actually render'
          );
          assert(
            transitions.every((t) => t.oldNames <= 1 && t.newNames <= 1),
            'one named element per snapshot'
          );
          assert.equal(
            await page.locator('[style*="view-transition-name: genre-image"]').count(),
            0
          );
        }
        // The optional module must not delay a cold action or replay it later.
        if (variant === 'after') {
          const cold = await context.newPage();
          let releaseModule;
          const gate = new Promise((resolve) => {
            releaseModule = resolve;
          });
          let requests = 0;
          const modulePath = '**/src/pages/genre-motion.mjs';
          await cold.route(modulePath, async (route) => {
            requests++;
            await gate;
            await route.continue();
          });
          await cold.addInitScript(() => {
            window.motionCalls = 0;
            const start = document.startViewTransition.bind(document);
            document.startViewTransition = (fn) => {
              window.motionCalls++;
              return start(fn);
            };
          });
          await cold.goto(origin + '/after.html#library');
          await cold.locator('#surface-library').waitFor({ state: 'visible' });
          await cold.waitForTimeout(150);
          assert.equal(requests, 0, 'Library entry does not load Genres motion');
          await cold.locator('button[data-view="instrument"]').click();
          await cold.locator('#surface-instrument').waitFor({ state: 'visible' });
          await cold.waitForTimeout(150);
          assert.equal(requests, 0, 'other route does not load Genres motion');
          await cold.locator('button[data-view="genre"]').click();
          await cold.waitForTimeout(100);
          assert.equal(requests, 1);
          await cold.locator('[data-ui="genre-close"]').click();
          const card = cold.locator('.cm-tile[data-id="delta_blues"]');
          await card.scrollIntoViewIfNeeded();
          await cold.waitForFunction(
            () => document.querySelector('.cm-tile[data-id="delta_blues"] img')?.naturalWidth > 0
          );
          await cold.locator('.cm-tile-name[data-id="delta_blues"]').click();
          assert.equal(
            await cold.locator('#genre-detail').getAttribute('data-gp-id'),
            'delta_blues'
          );
          assert(
            await cold.locator('#gp-detail-title').evaluate((n) => n === document.activeElement)
          );
          await cold.locator('[data-ui="genre-close"]').click();
          assert.equal(await cold.evaluate(() => window.motionCalls), 0);
          await cold.locator('button[data-view="instrument"]').click();
          const focus = await cold.evaluate(() => document.activeElement.outerHTML);
          const loaded = cold.waitForResponse(modulePath);
          releaseModule();
          await loaded;
          await cold.waitForTimeout(100);
          assert.equal(await cold.evaluate(() => document.activeElement.outerHTML), focus);
          assert.equal(
            await cold.locator('#genre-detail').count(),
            0,
            'late load never replays cold selection'
          );
          await cold.goBack();
          await cold.waitForURL('**#genre');
          await card.scrollIntoViewIfNeeded();
          await cold.locator('.cm-tile-name[data-id="delta_blues"]').focus();
          await cold.keyboard.press('Enter');
          await cold.waitForTimeout(500);
          assert(
            (await cold.evaluate(() => window.motionCalls)) > 0,
            'return uses loaded native motion'
          );
          assert.equal(requests, 1, 'return reuses the module');
          await cold.locator('[data-ui="genre-close"]').click();
          await cold.waitForTimeout(400);
          await cold.goForward();
          await cold.waitForURL('**#instrument');
          await cold.goBack();
          await cold.waitForURL('**#genre');
          await cold.close();

          const absent = await context.newPage();
          const errors = [];
          absent.on('pageerror', (error) => errors.push(error.message));
          await absent.route(modulePath, (route) =>
            route.fulfill({ status: 503, body: 'unavailable' })
          );
          await absent.goto(origin + '/after.html?trad=detroit_techno');
          await absent.locator('#genre-detail[data-gp-id="detroit_techno"]').waitFor();
          assert.equal(new URL(absent.url()).searchParams.has('trad'), false);
          await absent.locator('[data-ui="genre-close"]').click();
          await absent.locator('.cm-tile-name[data-id="delta_blues"]').first().click();
          assert(
            await absent.locator('#gp-detail-title').evaluate((n) => n === document.activeElement)
          );
          await absent.locator('[data-ui="genre-close"]').click();
          assert.equal(await absent.locator('#genre-detail').count(), 0);
          assert.deepEqual(errors, [], 'missing module is a handled instant fallback');
          await absent.unroute(modulePath);
          const deepLoaded = absent.waitForResponse(modulePath);
          await absent.goto(origin + '/after.html?trad=detroit_techno');
          assert((await deepLoaded).ok(), 'normal deep link loads the existing module asset');
          await absent.waitForTimeout(100);
          assert.equal(
            await absent.locator('#genre-detail').getAttribute('data-gp-id'),
            'detroit_techno'
          );
          assert.equal(new URL(absent.url()).searchParams.has('trad'), false);
          await absent.close();
        }
        results.push({ width, variant, states, transitions });
        await context.close();
        const videoFile = await page.video().path();
        fs.copyFileSync(videoFile, path.join(output, `${variant}-${width}.webm`));
      }
    for (const width of [390, 1280])
      assert.deepEqual(
        results.find((r) => r.width === width && r.variant === 'after').states,
        results.find((r) => r.width === width && r.variant === 'before').states,
        'resting focus/Rows positions match baseline'
      );
    fs.writeFileSync(
      path.join(output, 'results.json'),
      JSON.stringify(
        {
          browser: browser.version(),
          baseline: crypto.createHash('sha256').update(fs.readFileSync(baseline)).digest('hex'),
          candidate: crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex'),
          motionModule: crypto
            .createHash('sha256')
            .update(fs.readFileSync(path.join(root, 'src/pages/genre-motion.mjs')))
            .digest('hex'),
          results,
        },
        null,
        2
      )
    );
    console.log(
      'PASS: real catalog/photo open/back in Rows and List, 390/1280; baseline focus/Rows parity; pending rapid actions/Escape; touch; reduced/disabled; native frames and unique names; cold/missing module, route-only request, return/history and deep link. Evidence: ' +
        output
    );
  } finally {
    await browser.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.close();
});
