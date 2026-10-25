#!/usr/bin/env node
'use strict';
/* global window, document, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame */
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
// Walks focus with `key` and returns each focused control that a sticky or
// fixed element (not one containing it) covers at its centre or a corner
// (WCAG 2.4.11). The Lyrics draft keeps its own caret handling.
async function obscuredFocus(page, key, steps) {
  const hidden = new Set();
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press(key);
    const hit = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body || a.id === 'lyrics-draft') return null;
      const c = a.getBoundingClientRect();
      const by = [
        [c.left + c.width / 2, c.top + c.height / 2],
        [c.left + 2, c.top + 2],
        [c.right - 2, c.bottom - 2],
      ]
        .filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight)
        .map(([x, y]) => document.elementFromPoint(x, y))
        .filter((h) => h && !a.contains(h) && !h.contains(a))
        .map((h) => {
          for (let e = h; e; e = e.parentElement) {
            const pos = getComputedStyle(e).position;
            if ((pos === 'sticky' || pos === 'fixed') && !e.contains(a)) return e;
          }
          return null;
        })
        .find(Boolean);
      return by
        ? `${(a.getAttribute('aria-label') || a.textContent).trim().slice(0, 40)} under .${by.className}`
        : null;
    });
    if (hit) hidden.add(hit);
  }
  return [...hidden];
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
      // A first visit's recipe is empty. Where a page docks the recipe under
      // it (Instrument, Map), the empty card's title and both of its actions
      // must be the topmost thing at their own centre, not under the
      // genre-tree column (Jony, #519).
      if (width >= 900)
        for (const view of ['Instrument', 'Map']) {
          await page.getByRole('button', { name: view, exact: true }).click();
          await page.locator('#recipe-empty:not([hidden]) [data-ui="surprise"]').waitFor();
          await settle(page);
          const covered = await page.evaluate(() =>
            ['strong', '[data-ui="genre-nav"]', '[data-ui="surprise"]']
              .map((sel) => document.querySelector('#recipe-empty ' + sel))
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return !el.contains(
                  document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                );
              })
              .map((el) => el.textContent.trim())
          );
          assert.deepEqual(covered, [], `${view}: empty recipe card covered at ${width}px`);
        }
      if (width >= 900) {
        await page.getByRole('button', { name: 'Genre', exact: true }).click();
        await page.locator('.catalog-row, .cm-tile').first().waitFor();
      }
      // Focus is never left under a sticky bar (Jony, #519): Shift+Tab back up
      // the Genre page lands below its sticky tabs, and on a phone a control
      // focused behind the Lyrics line dock scrolls into view.
      if (width === 899 || width === 1280) {
        await page.locator('#genre-main').evaluate((el) => {
          const all = [...el.querySelectorAll('a, button, input, select, [tabindex="0"]')];
          all
            .filter((e) => e.getClientRects().length)
            .pop()
            ?.focus();
        });
        const under = await obscuredFocus(page, 'Shift+Tab', 60);
        assert.deepEqual(under, [], `Genre: focus under a sticky bar at ${width}px`);
      }
      if (width === 360) {
        const small = await page
          .locator('#surface-genre .gp-crumbs .gp-link, #surface-genre .gp-also .gp-link')
          .evaluateAll((els) =>
            els
              .filter((el) => el.getClientRects().length)
              .map((el) => [el.textContent.trim(), el.getBoundingClientRect().height])
              .filter(([, h]) => h < 24)
          );
        assert.deepEqual(small, [], 'Genre: breadcrumb and also links are 24 px targets');
        // A phone-height screen, where the empty song's actions reach the dock.
        await page.setViewportSize({ width, height: 780 });
        await page.getByRole('button', { name: 'Lyrics', exact: true }).first().click();
        await page.locator('#ly-body').waitFor();
        await page
          .locator('#ly-page')
          .focus()
          .catch(() => {});
        const under = await obscuredFocus(page, 'Tab', 40);
        assert.deepEqual(under, [], 'Lyrics: focus under the line dock at 360x780');
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole('button', { name: 'Genre', exact: true }).first().click();
        await page.locator('.catalog-row, .cm-tile').first().waitFor();
      }
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
      // The save and delete dialogs are safe from the keyboard (Jony #7, #9 on
      // #519): Enter in the name field saves once and does not reopen Save, and
      // Enter on Cancel in the delete confirmation keeps the workspace, while
      // Enter on Delete still deletes it.
      if (width === 1280) {
        const saved = () =>
          page.evaluate(
            async () => JSON.parse((await window.storage.get('codex:list'))?.value || '[]').length
          );
        const settleCount = async (n) => {
          for (let i = 0; i < 40 && (await saved()) !== n; i++) await page.waitForTimeout(50);
          return saved();
        };
        const start = await saved();
        await page.locator('#btn-save').click();
        await page.locator('#save-name').fill('Keyboard check');
        await page.locator('#save-name').press('Enter');
        assert.equal(await settleCount(start + 1), start + 1, 'Enter in the name field saves once');
        await page.waitForTimeout(300);
        assert.equal(
          await page.evaluate(() => !!document.querySelector('#modal-save.open')),
          false,
          'Enter in the name field must not reopen Save'
        );
        assert.equal(await saved(), start + 1, 'one Enter, one saved copy');
        const confirmDelete = async (choice) => {
          await page.locator('#btn-saved').click();
          const row = page.locator('#modal-saved [data-del]').last();
          await row.waitFor();
          await row.focus();
          await page.keyboard.press('Enter');
          await page
            .waitForFunction(
              () => document.activeElement?.matches('.confirm-dialog [data-confirm-action]'),
              null,
              { timeout: 3000 }
            )
            .catch(() => {});
          const dialog = await page.evaluate(() => {
            const d = document.querySelector('.confirm-dialog');
            const text = (id) => (id && document.getElementById(id)?.textContent.trim()) || '';
            return {
              role: d?.getAttribute('role'),
              modal: d?.getAttribute('aria-modal'),
              name: text(d?.getAttribute('aria-labelledby')),
              desc: text(d?.getAttribute('aria-describedby')),
              focus: document.activeElement?.dataset?.confirmAction || null,
            };
          });
          assert.ok(
            dialog.role === 'alertdialog' && dialog.modal === 'true' && dialog.name && dialog.desc,
            `the confirm dialog is a named, described alertdialog: ${JSON.stringify(dialog)}`
          );
          assert.equal(dialog.focus, 'cancel', 'a delete confirmation opens on Cancel');
          if (choice === 'confirm')
            await page.locator('.confirm-dialog [data-confirm-action="confirm"]').focus();
          await page.keyboard.press('Enter');
          await page.locator('.confirm-dialog').waitFor({ state: 'detached' });
          await page.keyboard.press('Escape');
        };
        await confirmDelete('cancel');
        // A delete is asynchronous: the count has to stay put, not merely be
        // right at the first look.
        for (let i = 0; i < 20; i++) {
          assert.equal(await saved(), start + 1, 'Enter on Cancel must not delete');
          await page.waitForTimeout(50);
        }
        await confirmDelete('confirm');
        assert.equal(await settleCount(start), start, 'Enter on Delete deletes');
      }
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
      // Chat (Jony #89): Ask while an earlier request's outcome is unknown and
      // its lookup fails sends nothing past it, says so in the log, and keeps
      // the new text and focus in the box (the box is disabled while
      // recovery checks, which drops focus in a real browser).
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      let posts = 0;
      await context.route('https://mcp.codexmusica.com/**', (route) => {
        const url = route.request().url();
        if (route.request().method() === 'POST' && /\/chat$/.test(url)) {
          posts++;
          return route.abort();
        }
        if (/\/chat\/jobs\//.test(url))
          return route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: '{"error":"The request outcome is unknown. The saved request will not be repeated."}',
          });
        return route.fulfill({
          contentType: 'application/json',
          body: '{"ok":true,"enabled":true}',
        });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      await page.locator('[data-ui="ai"]:visible').first().click();
      const input = page.locator('#chat-input');
      await input.fill('make it bluesy');
      await page.locator('#chat-send').click();
      await page.waitForFunction(() =>
        /outcome is unknown/.test(document.getElementById('chat-log').textContent)
      );
      await page.waitForFunction(() => !document.getElementById('chat-input').disabled);
      assert.equal(posts, 1, 'Chat: the first request is sent once');
      await input.fill('add a fiddle');
      await input.focus();
      await page.evaluate(() => document.getElementById('chat-form').requestSubmit());
      await page.waitForFunction(() => !document.getElementById('chat-input').disabled);
      await settle(page);
      const after = await page.evaluate(() => ({
        active: document.activeElement.id || document.activeElement.tagName,
        value: document.getElementById('chat-input').value,
        last: document.getElementById('chat-log').lastElementChild?.textContent || '',
      }));
      assert.equal(posts, 1, 'Chat: nothing is sent past an unknown outcome');
      assert.equal(after.value, 'add a fiddle', 'Chat: the new text stays in the box');
      assert.equal(after.active, 'chat-input', 'Chat: focus stays in the box, not BODY');
      assert.match(after.last, /new message wasn’t sent/, 'Chat: the log says it was not sent');
      assert.match(after.last, /set aside here, not cancelled/);
      assert.deepEqual(errors, [], 'No browser errors');
      console.log('PASS chat: an Ask past an unknown outcome is held, said and kept at 1280px');
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
