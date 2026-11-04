#!/usr/bin/env node
'use strict';
/* global __dirname, process, Buffer, URL, window, document, AbortController, MouseEvent, innerWidth, console, getComputedStyle */
// Standalone source-grounded browser proof, not integrated-shell row completion.
// Run: CHROMIUM_PATH=/usr/bin/chromium node prototype/scenarios/library-rights/census-credits.cjs
// --mutate-note deliberately corrupts the metadata-only explanation and MUST fail.
// All browser requests are fulfilled locally; no external image/data requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { start } = require('../../../scripts/_pages_server.js');
const root = path.resolve(__dirname, '../../..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'library/data/catalog.json'), 'utf8'));
const artwork = JSON.parse(fs.readFileSync(path.join(root, 'library/data/artwork.json'), 'utf8'));
const production = fs.readFileSync(path.join(root, 'src/library/rights.js'), 'utf8');
const file = path.join(root, 'prototype/features/library-rights/census-credits.js');
let source = fs.readFileSync(file, 'utf8');
const css =
  fs.readFileSync(path.join(root, 'prototype/proto.css'), 'utf8') +
  fs.readFileSync(file.replace(/\.js$/, '.css'), 'utf8');
const note =
  'Held and research records remain searchable as metadata. Their source bodies are excluded from readable exports.';
const exclusion = 'Collection artwork is historical and credited here; it is in no export package.';
assert.ok(production.includes(note));
assert.ok(production.includes(exclusion));
assert.ok(production.includes("lib.go('/works?availability=all')"));
if (process.argv.includes('--mutate-note')) {
  assert.ok(source.includes(note), 'mutation target exists');
  source = source.replace(note, 'Held records are included in readable exports.');
}
const keys = [
  'source_files',
  'collections',
  'works',
  'editions',
  'reading_units',
  'readable_collections',
  'readable_works',
  'readable_editions',
  'readable_reading_units',
];
for (const key of keys) assert.ok(production.includes("'" + key + "'"));
let groups = 0;
async function main() {
  const server = await start({ root });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1024, height: 900 } });
  const unexpected = [];
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== server.url) {
      unexpected.push(url.href);
      return route.abort();
    }
    if (url.pathname === '/')
      return route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html lang="en"><head><title>Credits scenario</title><link rel="stylesheet" href="/component.css"></head><body><button id="outside">Outside</button><main id="host"></main></body></html>',
      });
    if (url.pathname === '/component.js')
      return route.fulfill({ contentType: 'text/javascript', body: source });
    if (url.pathname === '/component.css')
      return route.fulfill({ contentType: 'text/css', body: css });
    if (artwork.artwork.some((a) => url.pathname === '/assets/library/art/' + a.id + '-480.webp'))
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=',
          'base64'
        ),
      });
    if (url.pathname === '/broken.webp') return route.fulfill({ status: 404, body: '' });
    unexpected.push(url.pathname);
    return route.abort();
  });
  try {
    await page.goto(server.url + '/');
    await page.evaluate(
      async ({ catalog, artwork }) => {
        window.component = await import('/component.js');
        const freeze = (value) => {
          if (value && typeof value === 'object') {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
          }
          return value;
        };
        window.freeze = freeze;
        window.catalog = freeze(catalog);
        window.artwork = freeze(artwork);
        window.messages = [];
        window.calls = 0;
        window.make = (extra = {}) => {
          window.instance?.unmount();
          window.controller = new AbortController();
          window.ctx = freeze({
            catalog: window.catalog,
            artwork: window.artwork,
            signal: window.controller.signal,
            storage: {
              read() {
                throw Error('read-only view read storage');
              },
              write() {
                throw Error('read-only view wrote storage');
              },
              remove() {
                throw Error('read-only view removed storage');
              },
            },
            announce(message) {
              window.messages.push(message);
            },
            artworkUrls: Object.fromEntries(
              window.artwork.artwork.map((a) => [
                a.id,
                '../assets/library/art/' + a.id + '-480.webp',
              ])
            ),
            inspectAll() {
              window.calls++;
            },
            ...extra,
          });
          const winListen = window.addEventListener;
          const docListen = document.addEventListener;
          window.addEventListener = document.addEventListener = () => {
            throw Error('global listener');
          };
          try {
            window.instance = window.component.mount(document.querySelector('#host'), window.ctx);
          } finally {
            window.addEventListener = winListen;
            document.addEventListener = docListen;
          }
        };
        // Catch forbidden global dependencies even if they would otherwise succeed.
        window.fetch = () => {
          throw Error('feature fetch');
        };
        window.make();
      },
      { catalog, artwork }
    );
    const rows = await page
      .locator('.pcc-census > div')
      .evaluateAll((els) =>
        els.map((el) => [el.querySelector('dt').textContent, el.querySelector('dd').textContent])
      );
    const expected = keys.map((k) => [
      k.replace(/_/g, ' '),
      Number(catalog.census[k] ?? 0).toLocaleString('en-US'),
    ]);
    for (const [k, v] of Object.entries(catalog.census.availability))
      expected.push([k.replace(/_/g, ' ') + ' units', Number(v).toLocaleString('en-US')]);
    assert.deepEqual(rows, expected, 'every source census count and order');
    assert.ok(
      (await page.locator('#host').innerText()).includes(note),
      'metadata-only explanation preserved'
    );
    assert.ok(
      (await page.locator('#host').innerText()).includes(
        'Readings: snapshot ' + catalog.projected_from.snapshot_id.slice(0, 8)
      )
    );
    assert.ok((await page.locator('#host').innerText()).includes(exclusion));
    groups++;
    const credits = await page.locator('.pcc-art').evaluateAll((els) =>
      els.map((el) => ({
        title: el.querySelector('h4').textContent,
        author: el.querySelectorAll('p')[0].textContent,
        credit: el.querySelectorAll('p')[1].textContent,
        note: el.querySelector('small').textContent,
        source: el.querySelector('a').getAttribute('href'),
        label: el.querySelector('a').getAttribute('aria-label'),
        rel: el.querySelector('a').rel,
        target: el.querySelector('a').target,
      }))
    );
    assert.equal(credits.length, artwork.artwork.length);
    credits.forEach((a, i) => {
      const original = artwork.artwork[i];
      for (const k of ['title', 'author', 'credit', 'note', 'source'])
        assert.equal(a[k], original[k]);
      assert.equal(a.label, 'Source for ' + original.title + ' (opens in a new tab)');
      assert.equal(a.target, '_blank');
      assert.equal(a.rel, 'noopener noreferrer');
    });
    assert.equal(await page.locator('.pcc-art img').count(), 8);
    assert.deepEqual(
      await page
        .locator('.pcc-art img')
        .evaluateAll((images) => images.map((img) => new URL(img.src).pathname)),
      artwork.artwork.map((a) => '/assets/library/art/' + a.id + '-480.webp'),
      'uses exact host-supplied rendition URLs'
    );
    await page.locator('.pcc-art img').first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('.pcc-art img').naturalWidth === 1);
    groups++;
    await page.evaluate(() => {
      const urls = { ...window.ctx.artworkUrls };
      delete urls[window.artwork.artwork[0].id];
      window.make({ artworkUrls: urls });
    });
    assert.equal(await page.locator('.pcc-art img').count(), 7, 'missing map key creates no image');
    assert.equal(await page.locator('.pcc-art').first().locator('img').count(), 0);
    assert.equal(await page.getByText('Artwork preview unavailable.', { exact: true }).count(), 1);
    assert.equal(
      await page.locator('.pcc-art a').count(),
      8,
      'missing image preserves every credit source'
    );
    assert.equal(await page.evaluate(() => Object.isFrozen(window.ctx.artworkUrls)), true);
    assert.deepEqual(
      await page.evaluate(() => window.artwork),
      artwork,
      'missing image leaves immutable records unchanged'
    );
    groups++;
    await page.evaluate(() => window.make({ artworkUrls: {} }));
    assert.equal(await page.locator('.pcc-art img').count(), 0, 'empty map never invents paths');
    assert.equal(await page.getByText('Artwork preview unavailable.', { exact: true }).count(), 8);
    assert.equal(await page.locator('.pcc-art a').count(), 8);
    groups++;
    await page.evaluate(() => window.instance.focus());
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H2');
    await page.keyboard.press('Tab');
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      'Inspect all recorded availability'
    );
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.calls), 1);
    assert.deepEqual(
      await page.evaluate(() => ({ catalog: window.catalog, artwork: window.artwork })),
      { catalog, artwork }
    );
    groups++;
    await page.evaluate(() =>
      window.make({
        inspectAll: () => {
          window.calls++;
          return new Promise((resolve, reject) => {
            window.resolveAction = resolve;
            window.rejectAction = reject;
          });
        },
      })
    );
    await page.getByRole('button', { name: 'Inspect all recorded availability' }).click();
    await page.evaluate(() =>
      document.querySelector('.pcc button').dispatchEvent(new MouseEvent('click'))
    );
    assert.equal(await page.evaluate(() => window.calls), 2, 'single flight');
    await page.evaluate(() => window.rejectAction(new Error('Inspection unavailable')));
    await page.waitForFunction(
      () => !document.querySelector('.pcc button').hasAttribute('aria-disabled')
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      'Inspect all recorded availability',
      'failed callback retains keyboard focus'
    );
    assert.equal(await page.evaluate(() => window.messages.at(-1)), 'Inspection unavailable');
    assert.ok((await page.locator('#host').innerText()).includes('Inspection unavailable'));
    groups++;
    await page.getByRole('button', { name: 'Inspect all recorded availability' }).click();
    await page.evaluate(() => {
      window.controller.abort();
      window.rejectAction(new Error('late error'));
    });
    await page.waitForTimeout(30);
    assert.equal(await page.locator('.pcc').count(), 0);
    assert.equal(
      await page.evaluate(() => window.messages.at(-1)),
      'Inspection unavailable',
      'late failure silent after abort'
    );
    groups++;
    await page.evaluate(() => {
      window.make();
      window.oldButton = document.querySelector('.pcc button');
      window.instance.unmount();
      window.instance.unmount();
      window.oldButton.click();
      document.querySelector('#outside').focus();
      window.instance.focus();
    });
    assert.equal(await page.evaluate(() => window.calls), 3, 'detached action listener removed');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside');
    await page.evaluate(() => {
      const controller = new AbortController();
      controller.abort();
      window.make({ signal: controller.signal });
    });
    assert.equal(await page.locator('.pcc').count(), 0, 'pre-aborted mount inert');
    groups++;
    await page.evaluate(() =>
      window.make({
        catalog: { census: { source_files: 0, availability: { research_only: 7, held: 0 } } },
        artwork: { artwork: [] },
        inspectAll: undefined,
      })
    );
    assert.equal(await page.locator('.pcc-census dd').first().textContent(), '0');
    assert.equal(
      await page.locator('.pcc-census dd').nth(1).textContent(),
      '0',
      'production missing-key zero fallback'
    );
    assert.ok((await page.locator('#host').innerText()).includes('research only units'));
    assert.equal(await page.locator('.pcc-art').count(), 0);
    assert.equal(
      await page.getByRole('button', { name: 'Inspect all recorded availability' }).isDisabled(),
      true
    );
    assert.ok(
      (await page.locator('#host').innerText()).includes('Availability inspection is not connected')
    );
    assert.ok(!(await page.locator('#host').innerText()).includes('Readings: snapshot'));
    groups++;
    await page.evaluate(() => window.make({ catalog: null, artwork: null }));
    assert.ok(
      (await page.locator('#host').innerText()).includes('The catalog census could not be loaded')
    );
    assert.ok(
      (await page.locator('#host').innerText()).includes('Artwork credits could not be loaded')
    );
    assert.equal(
      await page.locator('.pcc-census').count(),
      0,
      'absent catalog not fabricated zero census'
    );
    groups++;
    await page.evaluate(() =>
      window.make({
        artworkUrls: Object.fromEntries(window.artwork.artwork.map((a) => [a.id, '/broken.webp'])),
      })
    );
    for (let i = 0; i < 8; i++) {
      await page.locator('.pcc-art').nth(i).scrollIntoViewIfNeeded();
    }
    await page.waitForFunction(() => document.querySelectorAll('.pcc-art img').length === 0);
    assert.equal(
      await page.locator('.pcc-art a').count(),
      8,
      'image failure keeps all source links'
    );
    assert.equal(await page.getByText('Artwork preview unavailable.', { exact: true }).count(), 8);
    groups++;
    await page.evaluate(() =>
      window.make({
        artwork: {
          artwork: [
            {
              id: 'bad',
              title: '<img src=x onerror=alert(1)>',
              author: '<script>bad</script>',
              credit: 'CC0 & <terms>',
              note: 'Do not infer text rights.',
              source: 'javascript:alert(1)',
            },
          ],
        },
        artworkUrls: { bad: window.artwork.artwork[0].source },
      })
    );
    assert.equal(await page.locator('.pcc-art img, .pcc-art script, .pcc-art a').count(), 0);
    assert.equal(await page.locator('.pcc-art h4').textContent(), '<img src=x onerror=alert(1)>');
    assert.ok(
      (await page.locator('#host').innerText()).includes('javascript:alert(1)'),
      'unsafe source retained as plain text'
    );
    groups++;
    await page.evaluate(() =>
      window.make({
        inspectAll() {
          window.controller.abort();
          return Promise.reject(new Error('reentrant'));
        },
      })
    );
    await page.getByRole('button', { name: 'Inspect all recorded availability' }).click();
    assert.equal(await page.locator('.pcc').count(), 0);
    assert.equal(await page.evaluate(() => window.messages.at(-1)), 'Inspection unavailable');
    groups++;
    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(() => window.make());
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await page.locator('.pcc').evaluate((el) => ({
      foreground: getComputedStyle(el).color,
      background: getComputedStyle(el.querySelector('.pcc-card')).backgroundColor,
      muted: getComputedStyle(el.querySelector('.pcc-note')).color,
    }));
    assert.deepEqual(
      dark,
      {
        foreground: 'rgb(236, 236, 241)',
        background: 'rgb(21, 22, 26)',
        muted: 'rgb(184, 184, 194)',
      },
      'P2 dark-theme tokens respected'
    );
    groups++;
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      '320px no horizontal overflow'
    );
    await page.evaluate(() => {
      window.second = window.component.mount(document.querySelector('#host'), window.ctx);
      window.instance.unmount();
    });
    assert.equal(await page.locator('.pcc').count(), 1, 'instance cleanup scoped');
    await page.evaluate(() => window.controller.abort());
    assert.equal(await page.locator('.pcc').count(), 0);
    groups++;
    assert.deepEqual(unexpected, [], 'no unapproved browser request');
    assert.deepEqual(errors, [], 'no browser errors');
    console.log(
      'census-credits: ' +
        groups +
        '/' +
        groups +
        ' browser scenario groups passed; production-shaped fixtures, all requests local.'
    );
  } finally {
    await browser.close();
    await server.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
