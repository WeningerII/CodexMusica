#!/usr/bin/env node
'use strict';
/* global InstLite, document, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame */
// Real rendering regression coverage for anchored overlays and adjustable panes.
// Run against the built artifact, alongside check_mobile_layout's touch/reorder gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
const widths = [360, 548, 899, 900, 1024, 1280, 1920];
const settle = (page) =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
  );
async function inside(page, selector) {
  const results = await page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => el.getClientRects().length)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: (el.getAttribute('aria-label') || el.textContent).slice(0, 100),
          x: r.x,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
          vw: innerWidth,
          vh: innerHeight,
        };
      })
  );
  assert.ok(results.length, 'Nothing visible for ' + selector);
  for (const r of results)
    assert.ok(
      r.x >= -1 &&
        r.right <= r.vw + 1 &&
        r.top >= -1 &&
        r.bottom <= r.vh + 1 &&
        r.width > 0 &&
        r.height > 0,
      selector + ': ' + JSON.stringify(r)
    );
}
async function noOverflow(page) {
  const bad = await page
    .locator(
      '.workspace, .ui-header, .ui-surface:not([hidden]), .catalog-row, #workspace-detail, .part-row-grid, .modal-bg.open > .modal'
    )
    .evaluateAll((els) =>
      els
        .filter((el) => el.getClientRects().length && el.scrollWidth > el.clientWidth + 2)
        .map((el) => ({
          selector: el.id || el.className,
          scroll: el.scrollWidth,
          client: el.clientWidth,
          overflowing: [...el.querySelectorAll('*')]
            .filter(
              (child) => child.getClientRects().length && child.scrollWidth > child.clientWidth + 2
            )
            .slice(0, 12)
            .map((child) => ({
              selector: child.id || child.className,
              scroll: child.scrollWidth,
              client: child.clientWidth,
            })),
        }))
    );
  assert.deepEqual(bad, [], 'Content must reflow within its container');
}
(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const width of widths) {
      console.log('Checking layout usability at ' + width + 'px');
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      // The genre catalogue: cards in Rows (the default), rows in List.
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await noOverflow(page);
      await page.getByRole('button', { name: 'Browse tree', exact: true }).click();
      const tree = page.locator('.inline-tree > .modal');
      assert.equal(
        await tree.evaluate((el) => getComputedStyle(el).opacity),
        '1',
        'Browse tree must be painted'
      );
      assert.ok(await tree.locator('.tree-row').count());
      await tree.locator('[data-close]').click();
      await page.getByLabel('Search genres').fill('Delta blues');
      await page.getByRole('button', { name: 'Add Delta blues', exact: true }).click();
      await page.locator('.sb-card').first().waitFor({ state: 'attached' });
      if (width < 900) await page.locator('[data-ui="session"]').click();
      else {
        // The recipe column may sit on either side (recipe: 'sidebar' or
        // 'sidebar-right'). Narrow it first — a right-hand column can open at
        // its maximum — then widen it back, proving both directions.
        const split = page.getByRole('separator', { name: 'Resize recipe sidebar' });
        const sidebar = page.locator('#workspace-sidebar');
        const before = await sidebar.boundingBox();
        const onRight = before.x > width / 2;
        await split.press(onRight ? 'ArrowRight' : 'ArrowLeft');
        await settle(page);
        const narrowed = await sidebar.boundingBox();
        assert.ok(
          narrowed.width < before.width,
          `recipe splitter must narrow the ${onRight ? 'right' : 'left'}-hand column`
        );
        await split.press(onRight ? 'ArrowLeft' : 'ArrowRight');
        await settle(page);
        assert.ok(
          (await sidebar.boundingBox()).width > narrowed.width,
          `recipe splitter must widen the ${onRight ? 'right' : 'left'}-hand column`
        );
        await split.press('Home');
      }
      const card = page.locator('.sb-card').first();
      if ((await card.getAttribute('aria-expanded')) !== 'true') await card.click();
      await page.locator('.detail-tab[data-tab="parts"]').click();
      await page.locator('.part-row-grid').first().waitFor();
      await noOverflow(page);
      const labels = await page
        .locator('.part-label-cell, .part-variant-cell, .part-descriptors-cell')
        .evaluateAll((els) =>
          els
            .filter((el) => el.getClientRects().length)
            .map((el) => getComputedStyle(el).whiteSpace)
        );
      assert.ok(
        labels.length && labels.every((value) => value !== 'nowrap'),
        'Part text must remain readable'
      );
      if (width >= 900) {
        await page.locator('.detail-actions [data-action="pin"]').hover();
        await page.getByRole('tooltip').waitFor();
        await inside(page, '#layout-tooltip');
        await noOverflow(page);
        await page.mouse.move(0, 0);
      }
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'AI recipe', exact: true }).last().click();
      await page.locator('#assistant-slot').waitFor();
      await inside(page, '#assistant-slot');
      if (width >= 900) {
        const move = page.getByRole('button', { name: 'Move AI recipe panel', exact: true });
        const resize = page.getByRole('button', { name: 'Resize AI recipe panel', exact: true });
        await move.press('ArrowLeft');
        await resize.press('ArrowLeft');
        await settle(page);
        await inside(page, '#assistant-slot');
        const before = await page.locator('#assistant-slot').boundingBox();
        const grip = await move.boundingBox();
        await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
        await page.mouse.down();
        await page.mouse.move(grip.x - 70, grip.y + 30, { steps: 5 });
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await settle(page);
        const after = await page.locator('#assistant-slot').boundingBox();
        assert.ok(Math.abs(after.x - before.x) < 1, 'Escape cancels a panel drag');
        await page.getByRole('button', { name: 'Reset AI recipe panel', exact: true }).click();
        assert.equal(
          await page
            .locator('#assistant-slot')
            .evaluate((el) => el.classList.contains('layout-adjusted')),
          false
        );
      }
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'More', exact: true }).click();
      await settle(page);
      await inside(page, '#ui-menu');
      await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
      await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
      await noOverflow(page);
      await page.getByRole('button', { name: 'Map', exact: true }).click();
      const atlas = page.frameLocator('#map-frame');
      await atlas.locator('.rowbtn').first().waitFor({ state: 'attached' });
      await atlas.getByLabel('Search traditions').fill('classical');
      await atlas.locator('#results').waitFor();
      const mapFrame = page.frames().find((f) => f.url().includes('atlas.html'));
      await settle(mapFrame);
      await inside(mapFrame, '#results');
      await page.goto(base + '/atlas.html');
      await page.locator('.rowbtn').first().waitFor({ state: 'attached' });
      await page.getByLabel('Search traditions').fill('-');
      await page.locator('#results').waitFor();
      await settle(page);
      await inside(page, '.topbar, #results');
      await page.setViewportSize({ width, height: 390 });
      await settle(page);
      await inside(page, '#results');
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(
        'PASS layout usability at ' +
          width +
          'px: tree, labels, editor, panes, menus, lyrics, embedded/standalone map, short viewport'
      );
      await context.close();
    }
    {
      // Genre › Instruments: the destination is named on each Add and its
      // note is tied to the select and said once; the toast names the
      // instrument; the Instrument inspector's Similar items are a list.
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.getByLabel('Search genres').fill('Delta blues');
      await page.locator('[data-ui="genre-select"]').first().click();
      await page.locator('#gp-tab-instruments').click();
      const select = page.locator('#gp-inst-dest');
      await select.waitFor();
      const first = page.locator('[data-ui="genre-inst-add"]').first();
      const before = await page.evaluate(() => ({
        described: document.getElementById('gp-inst-dest').getAttribute('aria-describedby'),
        live: document.getElementById('gp-inst-dest-note')?.getAttribute('aria-live'),
      }));
      assert.deepEqual(
        before,
        { described: 'gp-inst-dest-note', live: 'polite' },
        'Genre instruments: the destination note is tied to the select and announced'
      );
      assert.match(
        (await first.getAttribute('aria-label')) || '',
        /^Add .+ to (?!the chosen destination).+$/,
        'Genre instruments: each Add names its destination'
      );
      await select.selectOption('');
      await page.waitForTimeout(500);
      assert.equal(
        await page.evaluate(() => document.getElementById('gp-inst-dest-note').textContent),
        'Added on its own, outside any genre group.',
        'Genre instruments: choosing "on its own" updates the note'
      );
      assert.match(
        (await first.getAttribute('aria-label')) || '',
        /^Add .+ on its own$/,
        'Genre instruments: Add says it adds on its own'
      );
      const id = await first.getAttribute('data-id');
      await first.click();
      await page.waitForFunction(
        () => /Added/.test(document.getElementById('toast').textContent),
        null,
        {
          timeout: 20000,
        }
      );
      const toast = await page.evaluate(
        (i) => ({
          text: document.getElementById('toast').textContent,
          name: InstLite(i)?.name,
        }),
        id
      );
      assert.ok(
        toast.name && toast.text.includes('Added ' + toast.name),
        'Toast: an added instrument is named by its display name: ' + JSON.stringify(toast)
      );
      await page.getByRole('button', { name: 'Instrument', exact: true }).first().click();
      await page.locator('#surface-instrument .cm-tile-name').first().click();
      await page.locator('#ip-similar').waitFor();
      assert.ok(
        (await page.locator('#ip-similar').getByRole('listitem').count()) > 0 &&
          (await page.locator('#ip-similar').getByRole('listitem').count()) ===
            (await page.locator('#ip-similar .ip-sim-main').count()),
        'Instrument: Similar instruments are a list, one item per instrument'
      );
      assert.equal(
        await page.locator('#ip-similar ul').first().getAttribute('role'),
        'list',
        'Instrument: the unstyled Similar list keeps its list role (Safari)'
      );
      assert.deepEqual(errors, [], 'No browser errors');
      console.log('PASS genre instruments destination, add toast name, similar list at 1280px');
      await context.close();
    }
    for (const width of [1280, 390]) {
      // Back from a page lands where that page was left (the Inspect button
      // that opened the Instrument page), and Forward on the page's nav
      // button: never on BODY (body carries data-view too).
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html#genre/delta_blues');
      await page.locator('#gp-tab-instruments').click();
      const inspect = page.locator('[data-ui="instrument-inspect"]').first();
      const id = await inspect.getAttribute('data-id');
      await inspect.focus();
      await page.keyboard.press('Enter');
      await page.locator('#ip-title').waitFor();
      const focused = () =>
        page.evaluate(() => {
          const a = document.activeElement;
          return {
            tag: a.tagName,
            ui: a.dataset.ui || '',
            id: a.dataset.id || '',
            view: a.dataset.view || '',
          };
        });
      await page.goBack();
      await page.waitForFunction(() => document.body.dataset.view === 'genre');
      await settle(page);
      assert.deepEqual(
        await focused(),
        { tag: 'BUTTON', ui: 'instrument-inspect', id, view: '' },
        `Back to Genre at ${width}px: focus returns to the Inspect button that left it`
      );
      await page.goForward();
      await page.waitForFunction(() => document.body.dataset.view === 'instrument');
      await settle(page);
      const f = await focused();
      assert.ok(
        f.tag !== 'BODY' && f.view === 'instrument',
        `Forward to Instrument at ${width}px: focus lands on its nav button, not BODY: ` +
          JSON.stringify(f)
      );
      // Back again, after Forward: the Inspect button again, not the
      // Instrument nav button Forward left focus on.
      await page.goBack();
      await page.waitForFunction(() => document.body.dataset.view === 'genre');
      await settle(page);
      assert.deepEqual(
        await focused(),
        { tag: 'BUTTON', ui: 'instrument-inspect', id, view: '' },
        `Back after Forward at ${width}px: focus returns to the Inspect button again`
      );
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(`PASS page Back/Forward focus at ${width}px`);
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
