#!/usr/bin/env node
'use strict';
/* global document, getComputedStyle, innerWidth, innerHeight, matchMedia, requestAnimationFrame,
   uiChatOpen, _chatRenderReply, openModal, closeModal, showToast, uiShowStorageConflict */
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
    // Reflow (Jony round 20): 400% zoom is 320×256 CSS px of a 1280×1024
    // window; WCAG 1.4.12 text spacing; forced colours.
    const reflowPage = async (width, height) => {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      return { context, page, errors };
    };
    const rectOf = (page, selector) =>
      page.evaluate((s) => {
        const e = typeof s === 'string' ? document.querySelector(s) : null;
        if (!e) return null;
        e.scrollIntoView({ block: 'nearest' });
        const b = e.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, height: b.height };
      }, selector);
    const overlaps = (a, b) =>
      !!a && !!b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    {
      // #94: the AI panel at 320×256 — after a reply, the reply, the input,
      // the Task select and Ask can each be brought on screen.
      const { context, page, errors } = await reflowPage(320, 256);
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.evaluate(() => uiChatOpen());
      await page.evaluate(() =>
        _chatRenderReply(
          {
            reply: 'Delta blues, brooding voice.',
            recipe: 'Delta blues, brooding voice, slide guitar, tin roof.',
            tools: [{ name: 'start_recipe', by_server: true }],
          },
          {}
        )
      );
      await settle(page);
      for (const s of ['#chat-log > :last-child', '#chat-input', '#chat-domain', '.chat-send']) {
        const r = await rectOf(page, s);
        assert.ok(
          r && r.height > 0 && r.top >= -1 && r.bottom <= 257,
          `AI panel at 320×256: ${s} can be brought on screen: ` + JSON.stringify(r)
        );
      }
      assert.deepEqual(errors, [], 'No browser errors');
      await context.close();
    }
    {
      // #96: with text spacing the header keeps every tool inside the window.
      const spacing =
        '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
      for (const width of [1024, 1280]) {
        const { context, page, errors } = await reflowPage(width, 800);
        for (const view of ['genre', 'lyrics', 'library']) {
          await page.goto(base + '/codex.html#' + view);
          await page.locator('.ui-tools').waitFor();
          await page.addStyleTag({ content: spacing });
          await settle(page);
          await settle(page);
          const out = await page.evaluate(() =>
            [...document.querySelectorAll('.ui-tools > *')]
              .filter((e) => e.getClientRects().length)
              .map((e) => [e.dataset.ui || e.id, Math.round(e.getBoundingClientRect().right)])
              .filter(([, r]) => r > innerWidth)
          );
          assert.deepEqual(
            out,
            [],
            `Header with text spacing at ${width}px on ${view}: no tool past the right edge`
          );
          const named = await page.evaluate(() =>
            [...document.querySelectorAll('.ui-tools button')]
              .filter((b) => b.getClientRects().length)
              .every((b) => (b.getAttribute('aria-label') || b.textContent).trim())
          );
          assert.ok(named, `Header at ${width}px on ${view}: every tool keeps its name`);
        }
        assert.deepEqual(errors, [], 'No browser errors');
        await context.close();
      }
    }
    {
      // #99: a toast never covers an open dialog's controls (320×256) or the
      // storage-conflict banner's buttons.
      const { context, page, errors } = await reflowPage(320, 256);
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.evaluate(() => openModal('modal-save'));
      await page.locator('#save-name').waitFor();
      await page.evaluate(() =>
        showToast('Imported 3 instruments into Your recipe', 'success', {
          label: 'Undo',
          run() {},
        })
      );
      await page.waitForFunction(() => document.getElementById('toast').classList.contains('show'));
      await settle(page);
      for (const s of ['#save-name', '#save-confirm']) {
        const toast = await page.evaluate(() => {
          const b = document.getElementById('toast').getBoundingClientRect();
          return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        });
        const r = await rectOf(page, s);
        assert.ok(
          !overlaps(toast, r),
          `A toast does not cover ${s} in the open Save dialog at 320×256: ` +
            JSON.stringify({ toast, r })
        );
      }
      await page.evaluate(() => closeModal('modal-save'));
      await page.setViewportSize({ width: 390, height: 780 });
      await page.evaluate(() => uiShowStorageConflict());
      await page.evaluate(() =>
        showToast('Imported 3 instruments into Your recipe', 'success', {
          label: 'Undo',
          run() {},
        })
      );
      await settle(page);
      const banner = await page.evaluate(() => {
        const r = (e) => {
          const b = e.getBoundingClientRect();
          return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
        };
        return {
          toast: r(document.getElementById('toast')),
          buttons: [...document.querySelectorAll('#storage-conflict button')].map(r),
        };
      });
      assert.ok(
        !banner.buttons.some((b) => overlaps(banner.toast, b)),
        'A toast does not cover the storage-conflict banner’s buttons at 390: ' +
          JSON.stringify(banner)
      );
      assert.deepEqual(errors, [], 'No browser errors');
      await context.close();
    }
    {
      // #98: in forced colours a descriptor the swap would add is told apart
      // from one it keeps by more than colour.
      const { context, page, errors } = await reflowPage(1280, 800);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'forced-colors', value: 'active' }],
      });
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      const looks = await page.evaluate(() => {
        const chip = document.createElement('button');
        chip.className = 'chip variant-chip';
        chip.innerHTML =
          '<span class="variant-chip-descr is-new">added</span><span class="variant-chip-descr is-kept">kept</span>';
        document.body.append(chip);
        const look = (e) => {
          const s = getComputedStyle(e);
          return [s.textDecorationLine, s.fontWeight, s.fontStyle, s.borderBottomStyle].join(' ');
        };
        const out = { forced: matchMedia('(forced-colors: active)').matches };
        out.added = look(chip.children[0]);
        out.kept = look(chip.children[1]);
        chip.remove();
        return out;
      });
      assert.ok(
        looks.forced && looks.added !== looks.kept,
        'Forced colours: a new descriptor looks different from a kept one: ' + JSON.stringify(looks)
      );
      assert.deepEqual(errors, [], 'No browser errors');
      await context.close();
    }
    console.log(
      'PASS reflow: AI panel at 320×256, header under text spacing, toasts clear of dialogs and the banner, forced-colours descriptors'
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
