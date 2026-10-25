#!/usr/bin/env node
'use strict';
/* global document, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame, uiAddGenre */
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
      // Below 900 the editor open in the Recipe sheet is its own layer: one
      // Escape closes it, the next closes the sheet.
      if (width < 900) await page.keyboard.press('Escape');
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
      // The Recipe sheet's editor on a phone, by touch (Jony round 27):
      // #119 Edit brings the editor's tabs into the sheet's view and its Close
      // stays pinned; #117 a variant tap keeps the sheet where it was; #120
      // the title's parts read as separate words; #118 Escape closes the
      // editor first, then the sheet; #121 classification links are 24px.
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.evaluate(() => uiAddGenre('bluegrass'));
      await page.waitForFunction(
        () => document.querySelectorAll('#sidebar-traditions .sb-card').length > 2
      );
      await page.locator('[data-ui="session"]').tap();
      const fold = page.locator(
        '#workspace-sidebar .sb-tradition-toggle[aria-expanded="false"]:visible'
      );
      if (await fold.count()) await fold.first().tap();
      await page.locator('#workspace-sidebar .sb-card-edit:visible').first().tap();
      await page.locator('#detail-view .detail-tab-bar').waitFor();
      await page.waitForTimeout(700);
      const box = () =>
        page.evaluate(() => {
          const b = document.getElementById('sidebar-scroll');
          const r = b.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, scroll: b.scrollTop };
        });
      const closeOn = () =>
        page.evaluate(() => {
          const c = document.querySelector('#detail-view [data-ui="close-editor"]');
          const r = c.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { top: r.top, on: !!hit && (hit === c || c.contains(hit)) };
        });
      const frame = await box();
      const tabs = await page.evaluate(
        () => document.querySelector('#detail-view .detail-tab-bar').getBoundingClientRect().bottom
      );
      assert.ok(
        tabs <= frame.bottom + 1,
        `Phone editor: Edit brings the editor's tabs into the sheet's view: ${JSON.stringify({ tabs, frame })}`
      );
      let close = await closeOn();
      assert.ok(
        close.on,
        'Phone editor: Close is in view once Edit opens it: ' + JSON.stringify(close)
      );
      assert.match(
        await page.evaluate(() => document.querySelector('#detail-view .detail-title').textContent),
        /\S, \S/,
        'Phone editor: the title reads its parts as separate words'
      );
      await page.locator('#detail-view .detail-tab').filter({ hasText: /Parts/ }).first().tap();
      // Each tap re-renders the tree; the part's row stays where it was on
      // screen (the sheet does not jump).
      const part = await page
        .locator('#detail-view [data-toggle-part]:visible')
        .last()
        .getAttribute('data-toggle-part');
      const row = `#detail-view [data-toggle-part="${part}"]`;
      const rowTop = () =>
        page.evaluate((sel) => document.querySelector(sel).getBoundingClientRect().top, row);
      const tapKeeps = async (target, what) => {
        await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
        const before = { scroll: (await box()).scroll, row: await rowTop() };
        await target.tap();
        await page.waitForTimeout(700);
        const after = { scroll: (await box()).scroll, row: await rowTop() };
        assert.ok(
          before.scroll > 0 && Math.abs(after.row - before.row) <= 2,
          `Phone editor: a ${what} tap keeps the sheet where it was: ${JSON.stringify({ before, after })}`
        );
      };
      await tapKeeps(page.locator(row).first(), 'part-row');
      await tapKeeps(page.locator('#detail-view .variant-chip:visible').nth(1), 'variant');
      await page.evaluate(() => {
        // Scroll to the editor's last line: its Close is still on screen.
        const b = document.getElementById('sidebar-scroll');
        const end = document.getElementById('detail-view').getBoundingClientRect().bottom;
        b.scrollTop += end - b.getBoundingClientRect().bottom;
      });
      await page.waitForTimeout(200);
      close = await closeOn();
      assert.ok(
        close.on,
        'Phone editor: Close stays reachable after scrolling the editor: ' + JSON.stringify(close)
      );
      await page.locator('#detail-view [data-toggle-part]:visible').first().focus();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      assert.deepEqual(
        await page.evaluate(() => ({
          sheet: document.body.classList.contains('session-open'),
          editor: !!document.getElementById('detail-view'),
          focus: document.activeElement?.className,
        })),
        { sheet: true, editor: false, focus: 'sb-card-edit' },
        'Phone editor: the first Escape closes the editor, onto its Edit, and keeps the sheet'
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      assert.equal(
        await page.evaluate(() => document.body.classList.contains('session-open')),
        false,
        'Phone editor: a second Escape closes the sheet'
      );
      await page.goto(base + '/codex.html#genre/delta_blues');
      await page.locator('.gp-crumbs .gp-link').first().waitFor();
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('.gp-crumbs .gp-link')]
          .filter((a) => a.getClientRects().length)
          .map((a) => Math.round(a.getBoundingClientRect().height))
          .filter((h) => h < 24)
      );
      assert.deepEqual(small, [], 'Genre classification links are at least 24px tall at 390');
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(
        'PASS phone Recipe sheet editor: reveal, steady scroll, pinned Close, Escape layers, title, 24px links'
      );
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
