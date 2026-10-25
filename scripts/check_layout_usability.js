#!/usr/bin/env node
'use strict';
/* global getComputedStyle, innerWidth, innerHeight, requestAnimationFrame, document, app, UI, uiAddGenre, uiNavigate */
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
// THE RECIPE TREE KEEPS THE KEYBOARD (Jony #15, #519). Every tree action
// rebuilds #sidebar-traditions; before the fix each one left focus on <body>,
// so the next Tab started from the top of the page. Driven with the real
// keyboard: focus the control, Enter to open its menu, Enter on the item.
async function treeFocus(page, width) {
  if (width < 900) await page.locator('[data-ui="session"]').click();
  await settle(page);
  const focused = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      const row = a && a.closest('.sb-card-row');
      const group = a && a.closest('.sb-tradition-group');
      return {
        body: !a || a === document.body,
        className: (a && a.className) || '',
        card: row ? row.querySelector('.sb-card').dataset.cardId : null,
        genre: group ? group.dataset.traditionId : null,
        title: !!(a && a.closest('#detail-view') && a.classList.contains('detail-title')),
      };
    });
  const cardIds = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#sidebar-traditions .sb-card')].map((b) => b.dataset.cardId)
    );
  const genreOf = (id) =>
    page.evaluate((id) => (app.cards.find((c) => c.id === id) || {}).traditionId, id);
  // The … menu of the i-th visible card row, and that row's card id.
  const more = (i) => page.locator('#sidebar-traditions .sb-card-row .sb-more:visible').nth(i);
  async function runItem(trigger, name) {
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.locator('[id="' + (await trigger.getAttribute('aria-controls')) + '"]');
    await menu.getByRole('menuitem', { name }).focus();
    await page.keyboard.press('Enter');
    await settle(page);
  }
  const where = width + 'px tree focus, ';
  // Duplicate → the copy's … menu.
  let before = await cardIds();
  await runItem(more(0), 'Duplicate');
  let f = await focused();
  const copy = (await cardIds()).find((id) => !before.includes(id));
  assert.ok(copy, where + 'Duplicate adds a card');
  assert.equal(f.card, copy, where + 'Duplicate focuses the copy: ' + JSON.stringify(f));
  assert.match(f.className, /\bsb-more\b/, where + "Duplicate focuses the copy's menu");
  // Pin → the same card's … menu, wherever it now sits.
  const pinned = await more(2).evaluate(
    (b) => b.closest('.sb-card-row').querySelector('.sb-card').dataset.cardId
  );
  await runItem(more(2), /Pin to top|Unpin/);
  f = await focused();
  assert.equal(f.card, pinned, where + 'Pin keeps focus on its card: ' + JSON.stringify(f));
  // Move to genre → the moved card, or its new genre's name when that genre
  // is collapsed and the card is hidden in it.
  const moved = await more(1).evaluate(
    (b) => b.closest('.sb-card-row').querySelector('.sb-card').dataset.cardId
  );
  await runItem(more(1), 'Move to genre…');
  await page.keyboard.press('Enter');
  await settle(page);
  f = await focused();
  const target = await genreOf(moved);
  assert.ok(!f.body, where + 'Move to genre keeps focus');
  assert.equal(
    f.genre,
    target,
    where + 'Move to genre focuses the new genre: ' + JSON.stringify(f)
  );
  assert.ok(
    f.card === moved || /sb-tradition-toggle/.test(f.className),
    where + 'Move to genre: ' + JSON.stringify(f)
  );
  // Remove → a remaining card in the same genre.
  const removed = await more(1).evaluate(
    (b) => b.closest('.sb-card-row').querySelector('.sb-card').dataset.cardId
  );
  const removedGenre = await genreOf(removed);
  await runItem(more(1), 'Remove');
  f = await focused();
  assert.ok(!(await cardIds()).includes(removed), where + 'Remove removes the card');
  assert.ok(
    f.card && f.card !== removed,
    where + 'Remove focuses another card: ' + JSON.stringify(f)
  );
  assert.equal(await genreOf(f.card), removedGenre, where + 'Remove stays in the genre');
  // Edit → the editor's heading.
  await page.locator('#sidebar-traditions .sb-card-edit:visible').first().focus();
  await page.keyboard.press('Enter');
  await settle(page);
  f = await focused();
  assert.ok(f.title, where + 'Edit focuses the editor heading: ' + JSON.stringify(f));
  // A genre's Move down → that genre's … menu.
  const genreMenu = page
    .locator('#sidebar-traditions .sb-tradition-header .sb-more:visible')
    .first();
  const genre = await genreMenu.evaluate(
    (b) => b.closest('.sb-tradition-group').dataset.traditionId
  );
  await runItem(genreMenu, /^Move .* group down$/);
  f = await focused();
  assert.equal(f.genre, genre, where + 'Move down keeps focus on the genre: ' + JSON.stringify(f));
  assert.match(f.className, /\bsb-more\b/, where + 'Move down focuses the genre menu');
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('#sidebar-traditions .sb-tradition-group')].map(
      (g) => g.dataset.traditionId
    )
  );
  assert.notEqual(order[0], genre, where + 'Move down moved the genre');
  // Remove genre → the genre beside it (Remove tradition is undoable and
  // asks nothing; confirmDialog resolves it at once).
  const gone = order[0];
  const goneMenu = page.locator(
    '#sidebar-traditions [data-tradition-id="' + gone + '"] .sb-tradition-header .sb-more'
  );
  await runItem(goneMenu, /^Remove .* group$/);
  f = await focused();
  const left = await page.evaluate(() =>
    [...document.querySelectorAll('#sidebar-traditions .sb-tradition-group')].map(
      (g) => g.dataset.traditionId
    )
  );
  assert.ok(!left.includes(gone), where + 'Remove genre removes it');
  assert.ok(
    f.genre && left.includes(f.genre),
    where + 'Remove genre focuses a remaining genre: ' + JSON.stringify(f)
  );
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
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready);
      await page.evaluate(async () => {
        await uiAddGenre('delta_blues');
        await uiAddGenre('bluegrass');
        uiNavigate('genre');
      });
      await treeFocus(page, width);
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(
        'PASS recipe tree focus at ' +
          width +
          'px: duplicate, pin, move to genre, remove, edit, genre move down, remove genre'
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
