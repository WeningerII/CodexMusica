#!/usr/bin/env node
'use strict';
/* global document, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame */
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
    // Map keyboard (1280): the canvas shows its focus ring above the canvas
    // (also in forced colours), a skip link reaches the map past the In view
    // list, and choosing a route says which.
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      await page.goto(base + '/atlas.html');
      await page.locator('.rowbtn').first().waitFor({ state: 'attached' });
      await page.locator('#search').focus();
      await page.keyboard.press('Tab');
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent?.trim()),
        'Skip to map',
        'Map: the Tab stop after the search skips to the map'
      );
      await page.keyboard.press('Enter');
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'canvas-host',
        'Map: the skip link puts focus on the map'
      );
      const ring = () =>
        page.evaluate(() => {
          const s = getComputedStyle(document.getElementById('canvas-host'), '::after');
          return { content: s.content, outline: s.outlineStyle, width: s.outlineWidth };
        });
      const shown = await ring();
      assert.ok(
        shown.content !== 'none' && shown.outline === 'solid' && parseFloat(shown.width) > 0,
        'Map: the focused canvas shows a ring above the canvas: ' + JSON.stringify(shown)
      );
      await page.emulateMedia({ forcedColors: 'active' });
      const forcedRing = await ring();
      assert.ok(
        forcedRing.content !== 'none' && forcedRing.outline === 'solid',
        'Map: the canvas ring stays in forced colours: ' + JSON.stringify(forcedRing)
      );
      await page.emulateMedia({ forcedColors: 'none' });
      await page.locator('#t-routes').click();
      await page.locator('.route-row').first().focus();
      await page.keyboard.press('Enter');
      await page
        .waitForFunction(
          () => /^Route: /.test(document.getElementById('map-live').textContent),
          null,
          {
            timeout: 3000,
          }
        )
        .catch(() => {});
      assert.match(
        await page.evaluate(() => document.getElementById('map-live').textContent),
        /^Route: .+, 2 endpoints$/,
        'Map: choosing a route says which'
      );
      await context.close();
    }
    // Genre prose Retry (1280): with the prose index failing, Retry keeps
    // focus on its slot through failure and success, says the outcome, and
    // each Retry is named for what it loads.
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      let failProse = true;
      await context.route('**/browse_prose.json', (route) =>
        failProse ? route.abort() : route.continue()
      );
      const page = await context.newPage();
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.getByLabel('Search genres').fill('1960s girl group');
      await page.locator('[data-ui="genre-select"]').first().click();
      const retry = page.getByRole('button', {
        name: 'Retry loading the description',
        exact: true,
      });
      await page.locator('[data-prose-pending="lede"] [data-ui="genre-prose-retry"]').waitFor();
      assert.equal(
        await retry.count(),
        1,
        'Genre: the description Retry is named for what it loads'
      );
      await retry.focus();
      await page.keyboard.press('Enter');
      await page
        .waitForFunction(
          () => /Still couldn/.test(document.getElementById('ui-live').textContent),
          null,
          {
            timeout: 5000,
          }
        )
        .catch(() => {});
      const failed = await page.evaluate(() => ({
        focus:
          document.activeElement?.getAttribute('aria-label') || document.activeElement?.tagName,
        toast: document.getElementById('ui-live').textContent,
      }));
      assert.ok(
        failed.focus === 'Retry loading the description' && /Still couldn/.test(failed.toast),
        'Genre: a failed Retry keeps focus on Retry and says so: ' + JSON.stringify(failed)
      );
      failProse = false;
      await page.keyboard.press('Enter');
      await page
        .waitForFunction(
          () => /Description loaded/.test(document.getElementById('ui-live').textContent),
          null,
          {
            timeout: 10000,
          }
        )
        .catch(() => {});
      const loaded = await page.evaluate(() => ({
        focus: document.activeElement?.className || document.activeElement?.tagName,
        toast: document.getElementById('ui-live').textContent,
      }));
      assert.ok(
        loaded.focus !== 'BODY' && /Description loaded/.test(loaded.toast),
        'Genre: a Retry that loads keeps focus on the description and says so: ' +
          JSON.stringify(loaded)
      );
      await context.close();
      console.log('PASS map keyboard and genre prose Retry at 1280px');
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
