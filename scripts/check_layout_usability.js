#!/usr/bin/env node
'use strict';
/* global getComputedStyle, innerWidth, innerHeight, requestAnimationFrame, document, UI, chatState */
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
      // Round 5 #38: the AI recipe panel by keyboard, against a stub writer
      // that answers after 1.5 s (fixture reply, never a provider).
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', async (route) => {
        if (/\/chat$/.test(route.request().url()) && route.request().method() === 'POST') {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          return route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              reply: 'Here is a dusty Delta blues recipe.',
              recipe:
                'classic Delta blues, worn acoustic guitar, bottleneck slide, stomping foot, small wooden room, ribbon microphone, tape saturation.',
              tools: [
                { name: 'start_recipe', exit_code: 0 },
                { name: 'edit_recipe', exit_code: 0 },
              ],
              history: [],
              sig: 'fixture',
            }),
          });
        }
        return route.fulfill({
          contentType: 'application/json',
          body: '{"ok":true,"enabled":true}',
        });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready);
      const opener = page.locator('[data-ui="ai"]:visible').first();
      assert.equal(
        await opener.getAttribute('aria-expanded'),
        'false',
        'Chat: the AI entry says the writer is closed'
      );
      await opener.focus();
      await page.keyboard.press('Enter');
      await page.locator('#chat-input').waitFor();
      assert.equal(
        await opener.getAttribute('aria-expanded'),
        'true',
        'Chat: the AI entry says the writer is open'
      );
      await page.locator('#chat-input').fill('dusty delta blues');
      await page.locator('#chat-send').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const busy = await page.evaluate(() => ({
        busy: chatState.busy,
        focus: document.activeElement?.id || document.activeElement?.tagName,
        unavailable: document.getElementById('chat-send').getAttribute('aria-disabled'),
      }));
      assert.deepEqual(
        busy,
        { busy: true, focus: 'chat-send', unavailable: 'true' },
        'Chat: Ask keeps focus while the request runs, and says it is unavailable'
      );
      await page.locator('.chat-msg-engine .chat-recipe').waitFor({ timeout: 10000 });
      await page.waitForFunction(() => !chatState.busy);
      const log = await page.evaluate(() => {
        const you = [...document.querySelectorAll('#chat-log .chat-msg-you')].pop();
        const reply = [...document.querySelectorAll('#chat-log .chat-msg-engine')].pop();
        const copy = reply.querySelector('.chat-recipe button');
        return {
          you: you.querySelector('.chat-sr')?.textContent,
          codex: reply.querySelector('.chat-sr')?.textContent,
          recipe: [...reply.querySelectorAll('.chat-recipe .chat-sr')].map((s) => s.textContent),
          copy: copy?.getAttribute('aria-label'),
          tools: reply.querySelector('.chat-tools')?.getAttribute('aria-hidden'),
          summary: [...reply.children]
            .filter((n) => n.matches('.chat-sr'))
            .map((n) => n.textContent.trim()),
        };
      });
      assert.deepEqual(
        log,
        {
          you: 'You: ',
          codex: 'Codex: ',
          recipe: ['Recipe: ', '. '],
          copy: 'Copy recipe',
          tools: 'true',
          summary: ['Codex:', '2 tool steps.'],
        },
        'Chat: the log names each speaker, separates the reply, names Copy and sums up the tools'
      );
      await page.locator('#chat-recover').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      assert.notEqual(
        await page.evaluate(() => document.activeElement?.tagName),
        'BODY',
        'Chat: Saved runs keeps focus'
      );
      // With a saved request to recover, Saved runs resets the conversation
      // (which focuses the input) and then goes busy (which disables it).
      await page.waitForFunction(() => !chatState.busy);
      await page.evaluate(() => {
        chatState.pending = null;
        chatState.archives = [{ request_id: 'a'.repeat(64), message: 'saved', domain: 'recipe' }];
      });
      await page.locator('#chat-recover').focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName),
        'chat-recover',
        'Chat: Saved runs keeps focus while it recovers a saved request'
      );
      assert.deepEqual(errors, [], 'Chat: no browser errors');
      console.log('PASS chat panel at 1280px: focus while busy, speakers, parts, Copy, tools');
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
