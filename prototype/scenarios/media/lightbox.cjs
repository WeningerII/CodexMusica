#!/usr/bin/env node
'use strict';
// Globals assigned by setup() inside the browser and read by page.evaluate().
/* global overlayEvents, overlayCallbacks, controller, controller2, escapeCount,
          photos, original, handle, resolutions, mountAgain */
// Standalone browser qualification only: all checklist rows remain pending.
// Production tuple: api/instrument_images.json at main 10b42689f04db0f16a98425b3e22c9a5487b254c,
// blob d0386633dec52cb64a388adbdbe7ec28382b547f (a_tenores_quartet).
// Edge fixtures preserve the same tuple shape; images are local PNG responses.
// LIGHTBOX_MUTATION=escape removes Escape ownership and MUST fail this scenario.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const moduleFile = path.join(root, 'features/media/lightbox.js');
const css = fs.readFileSync(path.join(root, 'features/media/lightbox.css'), 'utf8');
let code = fs.readFileSync(moduleFile, 'utf8');
if (process.env.LIGHTBOX_MUTATION === 'escape') {
  const before = code;
  code = code.replace('event.stopPropagation();', '/* Escape ownership mutation */');
  assert.notEqual(code, before, 'mutation must actually alter the implementation');
}
if (process.env.LIGHTBOX_MUTATION === 'release') {
  const before = code;
  code = code.replace('    release(box);', '    /* missing shell release mutation */');
  assert.notEqual(code, before, 'release mutation must alter implementation');
}
const production = JSON.parse(
  fs.readFileSync(path.join(root, '../api/instrument_images.json'), 'utf8')
).instruments.a_tenores_quartet;
const instrumentRows = JSON.parse(
  fs.readFileSync(path.join(root, '../api/instrument_images.json'), 'utf8')
).instruments;
const traditionRows = JSON.parse(
  fs.readFileSync(path.join(root, '../api/tradition_images.json'), 'utf8')
).traditions;
// Exact rows, not repaired to five fields: accordina is a real four-field row.
const catalogRecords = [
  {
    id: 'a_tenores_quartet',
    name: 'a_tenores_quartet',
    kind: 'instrument',
    image: instrumentRows.a_tenores_quartet,
  },
  { id: 'accordina', name: 'accordina', kind: 'instrument', image: instrumentRows.accordina },
  {
    id: '21st_century_classical',
    name: '21st_century_classical',
    kind: 'tradition',
    image: traditionRows['21st_century_classical'],
  },
];
const images = {
  thumb: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAPAAAACgCAIAAAC9uXYyAAABxklEQVR4nO3SUQkAIBTAwBfOClawfwRLCMI4uAD72Kx9IGO+F8BDhibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNiqFJMTQphibF0KQYmhRDk2JoUgxNygX183K8Rc+8yAAAAABJRU5ErkJggg==',
    'base64'
  ),
  large: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAA+gAAAH0CAIAAAAhSpB6AAAKJElEQVR4nO3WMQ0AIADAMMRhAQv4l4AETljSpAJ2bsy1AQCAz43nBQAAwJVxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAcYdAAACjDsAAAQYdwAACDDuAAAQYNwBACDAuAMAQIBxBwCAAOMOAAABxh0AAAKMOwAABBh3AAAIMO4AABBg3AEAIMC4AwBAgHEHAIAA4w4AAAHGHQAAAow7AAAEGHcAAAgw7gAAEGDcAQAgwLgDAECAcQcAgADjDgAAAQe0GfDY5uxZbQAAAABJRU5ErkJggg==',
    'base64'
  ),
};
const png = (w) => (w === 240 ? images.thumb : images.large);
const shellCSS = fs.readFileSync(path.join(root, 'proto.css'), 'utf8');
const requests = [];
let mode = 'success';
const server = http.createServer((req, res) => {
  requests.push(req.url);
  const send = (type, data, status = 200) => {
    res.writeHead(status, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  };
  if (req.url === '/prototype/proto.css') return send('text/css', shellCSS);
  if (req.url === '/prototype/lightbox.js') return send('text/javascript', code);
  if (req.url === '/prototype/lightbox.css') return send('text/css', css);
  if (req.url === '/prototype/thumb.svg') return send('image/png', png(240, 160));
  if (req.url === '/prototype/broken.svg') return send('text/plain', 'broken', 404);
  if (req.url === '/prototype/large.svg' || req.url === '/prototype/full.svg') {
    if (mode === 'fail' || (mode === 'full' && req.url.includes('large')))
      return send('text/plain', 'broken', 404);
    if (mode === 'delay') return setTimeout(() => send('image/png', png(1000, 500)), 250);
    return send('image/png', png(1000, 500));
  }
  send(
    'text/html',
    '<!doctype html><meta name="viewport" content="width=device-width"><title>Standalone lightbox scenario</title><link rel="stylesheet" href="/prototype/proto.css"><button id="outside">Outside</button><div id="host"></div><p id="status" role="status"></p>'
  );
});
let checks = 0;
const eq = (a, b, message) => {
  assert.deepEqual(a, b, message);
  checks++;
};
async function setup(page, opts = {}) {
  await page.goto(origin + '/prototype/');
  await page.evaluate(
    async ({ production, catalogRecords, opts }) => {
      const { mount } = await import('/prototype/lightbox.js');
      window.escapeCount = 0;
      document.querySelector('#host').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') window.escapeCount++;
      });
      let photos = [
        {
          id: 'a_tenores_quartet',
          name: 'Tenores',
          kind: 'instrument',
          image: production,
        },
        {
          id: 'missing',
          name: 'Missing credit',
          kind: 'instrument',
          image: [production[0], '', '', 'javascript:alert(1)'],
        },
        {
          id: 'tradition',
          name: 'Tradition',
          kind: 'tradition',
          image: [production[0], ' CC  BY ', ' A\n B ', production[3], 1],
        },
        {
          id: 'broken',
          name: 'Broken',
          kind: 'instrument',
          image: [production[0].replace('500px-', 'broken-'), 'L', 'C', production[3]],
        },
        {
          id: 'bad',
          name: 'Bad scheme',
          kind: 'instrument',
          image: ['javascript:alert(1)', '', '', ''],
        },
      ];
      if (opts.catalog) photos = catalogRecords;
      photos.forEach((p) => {
        Object.freeze(p.image);
        Object.freeze(p);
      });
      Object.freeze(photos);
      window.original = JSON.stringify(photos);
      window.photos = photos;
      window.resolutions = 0;
      window.controller = new AbortController();
      window.controller2 = new AbortController();
      if (opts.aborted) window.controller.abort();
      const resolve = (source) => {
        window.resolutions++;
        if (opts.remote) return production[0];
        if (opts.resolveNull) return null;
        if (opts.credentials) {
          const url = new URL('/prototype/thumb.svg', location.href);
          if (opts.credentials === 'username') url.username = 'test-user';
          else url.password = 'test-password';
          return url.href;
        }
        if (opts.resolveBlob) return URL.createObjectURL(new Blob(['bad']));
        if (source.includes('broken')) return '/prototype/broken.svg';
        if (source.includes('1280px-')) return '/prototype/large.svg';
        if (source === production[4]) return '/prototype/full.svg';
        return '/prototype/thumb.svg';
      };
      window.overlayEvents = [];
      window.overlayCallbacks = [];
      window.overlayAdapter = Object.freeze({
        open({ label, onClose }) {
          overlayEvents.push(['open', label]);
          overlayCallbacks.push(onClose);
          if (opts.openThrows) throw Error('unavailable');
          if (opts.syncClose) onClose();
          if (opts.abortInOpen) controller.abort();
          let closed = false;
          return {
            close() {
              overlayEvents.push(['close']);
              if (closed) throw Error('double overlay close');
              closed = true;
              if (opts.asyncClose) setTimeout(onClose, 25);
              else if (opts.reentrantClose) onClose();
            },
          };
        },
      });
      const ctx = Object.freeze({
        signal: controller.signal,
        storage: Object.freeze({
          read() {
            throw Error('unexpected storage read');
          },
          write() {
            throw Error('unexpected storage write');
          },
        }),
        announce: (text) => (document.querySelector('#status').textContent = text),
        photos: opts.empty ? Object.freeze([]) : photos,
        media: Object.freeze({
          resolve: opts.noResolver ? undefined : resolve,
        }),
        overlay: window.overlayAdapter,
      });
      window.handle = mount(document.querySelector('#host'), ctx);
      window.mountAgain = () => {
        const h = document.createElement('div');
        h.id = 'second';
        document.body.append(h);
        window.handle2 = mount(h, Object.freeze({ ...ctx, signal: controller2.signal }));
      };
    },
    { production, catalogRecords, opts }
  );
  if (
    !opts.empty &&
    !opts.remote &&
    !opts.noResolver &&
    !opts.resolveNull &&
    !opts.resolveBlob &&
    !opts.credentials &&
    !opts.aborted
  ) {
    await page.waitForFunction(
      () => document.querySelector('.media-photo-enlarge img')?.naturalWidth > 0
    );
    await page.waitForFunction(
      () =>
        document.querySelectorAll('.media-photo')[3].querySelector('.media-photo-enlarge').hidden
    );
  }
}
let origin;
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({
        viewport: mobile ? { width: 320, height: 640 } : { width: 1280, height: 800 },
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: 'reduce',
        colorScheme: mobile ? 'dark' : 'light',
      });
      const page = await context.newPage();
      const external = [],
        errors = [];
      let sourceVisits = 0;
      page.on('pageerror', (e) => errors.push(e.message));
      await context.route('**/*', (route) => {
        if (route.request().url() === production[3]) {
          sourceVisits++;
          return route.fulfill({
            contentType: 'text/html',
            body: '<title>Local source-page fixture</title>',
          });
        }
        if (new URL(route.request().url()).origin !== origin) {
          external.push(route.request().url());
          return route.abort();
        }
        return route.continue();
      });
      mode = 'success';
      requests.length = 0;
      await setup(page);
      eq(
        await page.locator('.media-photos').evaluate((e) => getComputedStyle(e).color),
        mobile ? 'rgb(236, 236, 241)' : 'rgb(27, 27, 31)',
        'P2 light/dark foreground token'
      );
      eq(
        requests.some((p) => /large|full/.test(p)),
        false,
        'no enlargement request before activation'
      );
      const trigger = page.getByRole('button', {
        name: 'Enlarge photo of Tenores',
        exact: true,
      });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('dialog img')?.naturalWidth === 1000);
      eq(
        await page
          .locator('dialog')
          .evaluate((d) => document.getElementById(d.getAttribute('aria-describedby'))?.tagName),
        'FIGCAPTION',
        'accessible caption association'
      );
      eq(
        await page.locator('dialog').getAttribute('aria-label'),
        'Photo of Tenores',
        'dialog accessible name'
      );
      eq(
        await page.locator('dialog a').textContent(),
        'Photo: Sardegnabella · CC BY-SA 3.0',
        'exact production attribution'
      );
      eq(await page.locator('dialog a').getAttribute('href'), production[3], 'source retained');
      const geometry = await page.locator('dialog img').evaluate((img) => ({
        w: img.getBoundingClientRect().width,
        h: img.getBoundingClientRect().height,
        fit: getComputedStyle(img).objectFit,
        max: innerWidth,
        ratio: img.naturalWidth / img.naturalHeight,
      }));
      eq(
        geometry.w <= Math.min(1000, geometry.max) &&
          Math.abs(geometry.w / geometry.h - geometry.ratio) < 0.02 &&
          geometry.fit === 'contain',
        true,
        'uncropped viewport-bounded photo'
      );
      eq(
        await page
          .locator(mobile ? '.media-lightbox-touch-hint' : '.media-lightbox-hint')
          .isVisible(),
        true,
        'pointer-specific hint'
      );
      await page.keyboard.press('Escape');
      eq(await page.locator('dialog').evaluate((d) => d.open), false, 'Escape closes');
      eq(
        await trigger.evaluate((b) => document.activeElement === b),
        true,
        'focus returns to opener'
      );
      eq(await page.evaluate(() => escapeCount), 0, 'Escape is owned by dialog');
      eq(
        await page.evaluate(() => overlayEvents),
        [['open', 'Photo of Tenores'], ['close']],
        'one shell open and one close per local dismissal'
      );
      await page.keyboard.press('Space');
      eq(await page.locator('dialog').evaluate((d) => d.open), true, 'Space opens');
      await page.locator('dialog').click({ position: { x: 2, y: 2 } });
      eq(await page.locator('dialog').evaluate((d) => d.open), false, 'backdrop click closes');
      await trigger.click();
      await page.keyboard.press('Enter');
      eq(await page.locator('dialog').evaluate((d) => d.open), false, 'dialog Enter closes');
      await trigger.focus();
      await page.keyboard.down('Enter');
      await page.keyboard.down('Enter');
      eq(
        await page.locator('dialog').evaluate((d) => d.open),
        true,
        'held Enter does not immediately dismiss the newly opened photo'
      );
      await page.keyboard.up('Enter');
      const popupPromise = page.waitForEvent('popup', { timeout: 2500 });
      await page.locator('dialog a').focus();
      await page.keyboard.press('Enter');
      const popup = await popupPromise;
      await popup.waitForFunction(() => document.title === 'Local source-page fixture', null, {
        timeout: 5000,
      });
      eq(
        await popup.title(),
        'Local source-page fixture',
        'Enter on inner credit link activates its source'
      );
      eq(sourceVisits, 1, 'source navigation intercepted locally exactly once');
      eq(
        await page.locator('dialog').evaluate((d) => d.open),
        false,
        'source link activation closes the photo'
      );
      await popup.close();
      await page.locator('.media-photo-credit').first().click();
      eq(
        await page.locator('#status').textContent(),
        'Photo: Sardegnabella · CC BY-SA 3.0',
        'credit announces through ctx'
      );
      await page.locator('.media-photo-credit-details a').first().focus();
      await page.keyboard.press('Escape');
      eq(
        await page.locator('.media-photo-credit-details').first().isHidden(),
        true,
        'credit Escape closes disclosure'
      );
      eq(
        await page.locator('.media-photo-credit').nth(1).getAttribute('title'),
        'Photo: uncredited · licence not stated',
        'instrument fallback'
      );
      eq(
        await page.locator('.media-photo-credit').nth(2).getAttribute('title'),
        'Photo: A B · CC BY',
        'tradition whitespace normalization'
      );
      eq(
        await page.locator('.media-photo-credit-details').nth(1).locator('a').count(),
        0,
        'unsafe source has no link'
      );
      eq(
        await page.locator('.media-photo').nth(3).locator('.media-photo-credit').isHidden(),
        true,
        'failed thumbnail hides credit'
      );
      eq(
        await page.locator('.media-photo').nth(4).locator('button').count(),
        0,
        'unsafe thumbnail not rendered'
      );
      eq(
        await page
          .locator('.media-photo')
          .nth(3)
          .locator('.media-photo-credit-details a')
          .isVisible(),
        true,
        'failed image retains visible attribution and source'
      );
      eq(
        await page.evaluate(() => JSON.stringify(photos) === original),
        true,
        'frozen supplied records preserved'
      );
      eq(
        await page.locator('.media-photos').evaluate((e) => getComputedStyle(e).transitionDuration),
        '0s',
        'reduced motion'
      );
      mode = 'fail';
      await setup(page);
      requests.length = 0;
      await trigger.click();
      await page.waitForFunction(() => document.querySelector('dialog img')?.naturalWidth === 240);
      await page.waitForTimeout(100);
      eq(
        requests.includes('/prototype/large.svg') && requests.includes('/prototype/full.svg'),
        true,
        'fallback attempted in failure case'
      );
      eq(
        await page.locator('dialog img').evaluate((img) => img.naturalWidth),
        240,
        'failed larger copies retain thumbnail'
      );
      await page.keyboard.press('Escape');
      mode = 'full';
      await setup(page);
      await trigger.click();
      await page.waitForFunction(() => document.querySelector('dialog img')?.naturalWidth === 1000);
      eq(
        await page.locator('dialog img').getAttribute('src'),
        origin + '/prototype/full.svg',
        'full follows failed rendition'
      );
      await page.keyboard.press('Escape');
      mode = 'delay';
      await setup(page);
      await trigger.click();
      await page.evaluate(() => controller.abort());
      await page.waitForTimeout(350);
      eq(
        await page.locator('#host').evaluate((h) => h.children.length),
        0,
        'abort removes component and late responses cannot reinsert it'
      );
      await page.evaluate(() => {
        handle.unmount();
        handle.focus();
      });
      eq(errors, [], 'no lifecycle exceptions');
      mode = 'delay';
      await setup(page);
      requests.length = 0;
      await trigger.click();
      for (let n = 0; n < 50 && !requests.includes('/prototype/large.svg'); n++)
        await new Promise((resolve) => setTimeout(resolve, 10));
      eq(
        requests.includes('/prototype/large.svg'),
        true,
        'pending image probe has actually started before teardown'
      );
      await page.evaluate(() => {
        window.retiredTrigger = document.querySelector('.media-photo-enlarge');
        window.retiredCredit = document.querySelector('.media-photo-credit');
        handle.unmount();
        mountAgain();
        document.querySelector('#status').textContent = 'Current mount';
        window.retiredTrigger.click();
        window.retiredCredit.click();
      });
      await page.waitForTimeout(350);
      eq(
        await page.locator('#status').textContent(),
        'Current mount',
        'retired controls cannot announce into the new mount'
      );
      eq(
        await page.locator('#second dialog').evaluate((d) => d.open),
        false,
        'retired controls cannot open the new mount overlay'
      );
      eq(
        await page.evaluate(() => overlayEvents.map((e) => e[0])),
        ['open', 'close'],
        'pending teardown releases overlay once without late reopening'
      );
      eq(
        requests.includes('/prototype/full.svg'),
        false,
        'retired probe starts no fallback request after teardown'
      );
      eq(
        await page.locator('#host').evaluate((h) => h.children.length),
        0,
        'retired probe cannot repopulate removed host children'
      );

      await setup(page, { remote: true });
      eq(await page.locator('.media-photo-enlarge').count(), 0, 'remote resolver rejected');
      await setup(page, { noResolver: true });
      eq(
        await page.locator('.media-photo-enlarge').count(),
        0,
        'missing image adapter shows fallback'
      );
      await setup(page, { empty: true });
      eq(
        await page.locator('.media-photos p').textContent(),
        'No detail photos are available.',
        'empty state'
      );
      await setup(page, { aborted: true });
      eq(
        await page.locator('#host').evaluate((h) => h.children.length),
        0,
        'already-aborted mount cleans up'
      );
      eq(await page.evaluate(() => resolutions), 0, 'pre-aborted mount resolves no images');
      for (const credentials of ['username', 'password']) {
        await setup(page, { credentials });
        eq(
          await page.locator('.media-photo-enlarge').count(),
          0,
          `${credentials}-bearing resource URL rejected`
        );
        eq(
          await page.evaluate(() => overlayEvents.length),
          0,
          'rejected resource never opens an overlay'
        );
      }
      eq(Object.keys(instrumentRows).length, 1671, 'actual instrument table count');
      eq(Object.keys(traditionRows).length, 6425, 'actual tradition table count');
      eq(
        [...Object.values(instrumentRows), ...Object.values(traditionRows)].every((r) =>
          /^https:/.test(r[0])
        ),
        true,
        'all actual catalog thumbnails are remote'
      );
      eq(
        Object.values(instrumentRows).filter((r) => r.length === 4).length,
        375,
        'four-field production rows are preserved rather than invented full fields'
      );
      requests.length = 0;
      await setup(page, { resolveNull: true, catalog: true });
      eq(await page.locator('.media-photo').count(), 3, 'real production records rendered');
      eq(
        await page.locator('.media-photo img').count(),
        0,
        'real all-null catalog records issue no image request'
      );
      eq(
        requests.some((p) => /thumb|large|full/.test(p)),
        false,
        'null catalog never requests local image substitutes'
      );
      eq(
        await page.evaluate(() => overlayEvents.length),
        0,
        'real all-null catalog never opens overlay'
      );
      for (let i = 0; i < catalogRecords.length; i++) {
        const record = catalogRecords[i],
          card = page.locator('.media-photo').nth(i);
        eq(
          await card.locator('figcaption').textContent(),
          record.name,
          'unavailable catalog photo retains caption'
        );
        eq(
          await card.locator('.media-photo-credit-details').isVisible(),
          true,
          'unavailable catalog photo keeps credit visible'
        );
        eq(
          await card.locator('.media-photo-credit-details').textContent(),
          `Photo: ${record.image[2]} · ${record.image[1]}`,
          'unavailable catalog attribution matches exact source tuple'
        );
        eq(
          await card.locator('a').getAttribute('href'),
          record.image[3],
          'unavailable catalog source link retained'
        );
      }
      eq(
        await page.evaluate(
          () =>
            JSON.stringify(photos) === original &&
            Object.isFrozen(photos) &&
            photos.every((p) => Object.isFrozen(p) && Object.isFrozen(p.image))
        ),
        true,
        'real source tuples remain unchanged and frozen'
      );
      await setup(page, { resolveNull: true });
      eq(
        await page.locator('.media-photo-enlarge').count(),
        0,
        'shell null resolution honestly shows no photo buttons'
      );
      eq(
        await page.locator('.media-photo-credit').count(),
        0,
        'unresolved photos expose no credit action'
      );
      eq(
        await page.locator('.media-photo-fallback:visible').count(),
        5,
        'unresolved photos show unavailable state'
      );
      eq(
        await page.evaluate(() => overlayEvents.length),
        0,
        'unresolved photos never open overlay'
      );
      eq(
        await page.locator('.media-photo-credit-details').first().isVisible(),
        true,
        'null resolution retains visible credit'
      );
      eq(
        await page.locator('.media-photo-credit-details a').first().getAttribute('href'),
        production[3],
        'null resolution retains source'
      );
      eq(
        await page.locator('.media-photo figcaption').first().textContent(),
        'Tenores',
        'null resolution retains caption'
      );
      await setup(page, { resolveBlob: true });
      eq(await page.locator('.media-photo-enlarge').count(), 0, 'blob is not a committed file');
      await setup(page, { syncClose: true });
      await page.getByRole('button', { name: 'Enlarge photo of Tenores', exact: true }).click();
      eq(
        await page.locator('dialog').evaluate((d) => d.open),
        false,
        'synchronous shell cancellation prevents dialog'
      );
      await page.evaluate(() => handle.unmount());
      eq(
        await page.evaluate(() => overlayEvents.map((e) => e[0])),
        ['open'],
        'shell cancellation never calls shell close back'
      );
      await setup(page, { openThrows: true });
      await page.getByRole('button', { name: 'Enlarge photo of Tenores', exact: true }).click();
      eq(
        await page.locator('dialog').evaluate((d) => d.open),
        false,
        'failed overlay leaves dialog closed'
      );
      eq(
        await page.locator('#status').textContent(),
        'Photo enlargement is unavailable.',
        'overlay failure announced'
      );
      await setup(page, { abortInOpen: true });
      await page.getByRole('button', { name: 'Enlarge photo of Tenores', exact: true }).click();
      eq(
        await page.locator('#host').evaluate((h) => h.children.length),
        0,
        'teardown within overlay.open removes host children'
      );
      eq(
        await page.evaluate(() => overlayEvents.map((e) => e[0])),
        ['open', 'close'],
        'late returned handle released exactly once'
      );
      await setup(page, { reentrantClose: true });
      await page.getByRole('button', { name: 'Enlarge photo of Tenores', exact: true }).click();
      await page.keyboard.press('Escape');
      eq(
        await page.evaluate(() => overlayEvents.map((e) => e[0])),
        ['open', 'close'],
        'defensive reentrant callback still releases once'
      );
      await setup(page, { asyncClose: true });
      await page.getByRole('button', { name: 'Enlarge photo of Tenores', exact: true }).click();
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Enlarge photo of Tenores', exact: true }).click();
      await page.waitForTimeout(75);
      eq(
        await page.locator('dialog').evaluate((d) => d.open),
        true,
        'old asynchronous close cannot close reopened dialog'
      );
      await page.evaluate(() => {
        overlayCallbacks[1]();
        overlayCallbacks[1]();
      });
      eq(
        await page.locator('dialog').evaluate((d) => d.open),
        false,
        'Back callback closes local dialog idempotently'
      );
      eq(
        await page.evaluate(() => overlayEvents.map((e) => e[0])),
        ['open', 'close', 'open'],
        'Back does not call shell close recursively'
      );
      eq(
        await page
          .getByRole('button', {
            name: 'Enlarge photo of Tenores',
            exact: true,
          })
          .evaluate((b) => document.activeElement === b),
        true,
        'Back returns focus'
      );
      await setup(page);
      await page.getByRole('button', { name: 'Enlarge photo of Tenores', exact: true }).click();
      await page.evaluate(() => {
        controller.abort();
        handle.unmount();
        handle.unmount();
      });
      eq(
        await page.evaluate(() => overlayEvents.map((e) => e[0])),
        ['open', 'close'],
        'abort plus repeated unmount releases exactly once'
      );
      await page.locator('#outside').focus();
      await page.evaluate(() => overlayCallbacks[0]());
      eq(
        await page.locator('#outside').evaluate((b) => document.activeElement === b),
        true,
        'late callback after disposal does not steal focus'
      );
      eq(errors, [], 'overlay lifecycle has no uncaught errors');
      mode = 'success';
      await setup(page);
      await page.evaluate(() => mountAgain());
      await page.evaluate(() => handle.unmount());
      await page.locator('#second .media-photo-enlarge').first().click();
      eq(
        await page.locator('#second dialog').evaluate((d) => d.open),
        true,
        'other instance survives unmount'
      );
      await page.keyboard.press('Escape');
      eq(external, [], 'all test requests local');
      await context.close();
    }
    console.log(
      `lightbox: ${checks}/${checks} browser checks pass (desktop + 320px touch, reduced motion); integration pending`
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
