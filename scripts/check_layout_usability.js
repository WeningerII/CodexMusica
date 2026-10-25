#!/usr/bin/env node
'use strict';
/* global toastTimed, showToast, document, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame */
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
// Press Tab until `selector` holds focus (or give up after `max` presses).
async function tabTo(page, selector, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => !!document.activeElement?.matches(s), selector)) return true;
  }
  return false;
}
const focusInfo = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return {
      tag: a?.tagName,
      cls: a?.className,
      part: a?.dataset?.togglePart ?? a?.dataset?.setPart,
      variant: a?.dataset?.variant,
      stage: a?.dataset?.editChain ?? a?.dataset?.setChain,
      item: a?.dataset?.item,
      expanded: a?.getAttribute('aria-expanded'),
      pressed: a?.getAttribute('aria-pressed'),
      controls: a?.getAttribute('aria-controls'),
      inList: a?.parentElement?.closest('[id^="detail-opts-"]')?.id || null,
    };
  });
// The card editor works from the keyboard alone (screen-reader round 4,
// #31–#34): section buttons expose which is current, a part row's header is a
// button that opens its options, focus survives each re-render, every option
// exposes whether it is chosen, and the character search has a name.
async function editorKeyboard(page, where) {
  const tag = (msg) => `Editor (${where}): ${msg}`;
  const partsTab = page.locator('.detail-tab[data-tab="parts"]');
  await partsTab.focus();
  await page.keyboard.press('Enter');
  await page.locator('.part-row-grid').first().waitFor();
  assert.deepEqual(
    await page
      .locator('.detail-tab')
      .evaluateAll((els) => els.map((b) => [b.dataset.tab, b.getAttribute('aria-pressed')])),
    [
      ['preface', 'false'],
      ['parts', 'true'],
      ['env', 'false'],
      ['chain', 'false'],
      ['stack', 'false'],
    ],
    tag('the section buttons expose which section is shown')
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset?.tab),
    'parts',
    tag('focus stays on the section button after it re-renders the editor')
  );
  assert.ok(await tabTo(page, 'button[data-toggle-part]'), tag('Tab reaches a part row header'));
  const head = await focusInfo(page);
  assert.equal(head.expanded, 'false', tag('a closed part row header says it is collapsed'));
  await page.keyboard.press('Enter');
  await page.locator('.part-variants-grid').first().waitFor();
  const opened = await focusInfo(page);
  assert.ok(
    opened.part === head.part && opened.expanded === 'true' && opened.controls,
    tag('Enter opens the part row and focus stays on its header: ' + JSON.stringify(opened))
  );
  await page.keyboard.press('Tab');
  const chip = await focusInfo(page);
  assert.ok(
    chip.part === head.part && chip.inList === opened.controls && chip.pressed,
    tag("Tab from the header reaches the row's options: " + JSON.stringify(chip))
  );
  const pressed = await page
    .locator('#' + opened.controls + ' .variant-chip')
    .evaluateAll((els) => els.map((b) => b.getAttribute('aria-pressed')));
  assert.ok(
    pressed.length > 1 && pressed.filter((v) => v === 'true').length === 1,
    tag('every variant option exposes whether it is chosen: ' + JSON.stringify(pressed))
  );
  // A chip's name reads its tags as separate words ("Chest (M1), thick,
  // grounded"), never run together ("Chest (M1)thickgrounded").
  const runTogether = await page
    .locator('#' + opened.controls + ' .variant-chip')
    .evaluateAll((els) =>
      els
        .map((b) => {
          const name = b.querySelector('.variant-chip-name')?.textContent || '';
          const tags = [...b.querySelectorAll('.variant-chip-descr')].map((t) => t.textContent);
          const want = tags.length ? [name, ...tags].join(', ') : name;
          return b.textContent === want ? null : b.textContent;
        })
        .filter(Boolean)
    );
  assert.deepEqual(runTogether, [], tag('variant option names separate their tags'));
  // Choose an option that is not chosen yet, from the keyboard.
  if (chip.pressed === 'true') await page.keyboard.press('Tab');
  const pick = await focusInfo(page);
  await page.keyboard.press('Enter');
  await settle(page);
  const picked = await focusInfo(page);
  assert.ok(
    picked.part === pick.part && picked.variant === pick.variant && picked.pressed === 'true',
    tag('a chosen variant keeps focus and reads as chosen: ' + JSON.stringify(picked))
  );
  // Environment rows open from the keyboard the same way.
  await page.locator('.detail-tab[data-tab="env"]').focus();
  await page.keyboard.press('Enter');
  assert.ok(
    await tabTo(page, 'button[data-toggle-env]'),
    tag('Tab reaches an environment row header')
  );
  await page.keyboard.press('Enter');
  const env = await page.evaluate(() => ({
    expanded: document.activeElement?.getAttribute('aria-expanded'),
    options: document.querySelectorAll('.env-options [aria-pressed="true"]').length,
  }));
  assert.deepEqual(
    env,
    { expanded: 'true', options: 1 },
    tag('Enter opens an environment row, and its chosen option reads as chosen')
  );
  // Chain stages: Enter keeps focus on the stage; fx is multi-select.
  await page.locator('.detail-tab[data-tab="chain"]').focus();
  await page.keyboard.press('Enter');
  const fx = page.locator('button.chain-stage[data-edit-chain="fx"]');
  assert.equal(await fx.getAttribute('aria-expanded'), 'false', tag('a closed stage says so'));
  await fx.focus();
  await page.keyboard.press('Enter');
  await page.locator('.chain-edit-options').waitFor();
  const stage = await focusInfo(page);
  assert.ok(
    stage.stage === 'fx' && stage.expanded === 'true' && stage.controls,
    tag('Enter on a chain stage keeps focus on it: ' + JSON.stringify(stage))
  );
  // The open stage's options are the next Tab stop, not seven stages later,
  // and the panel still sits below every stage on screen.
  await page.keyboard.press('Tab');
  const next = await page.evaluate(() => ({
    inPanel: !!document.activeElement?.closest('.chain-edit-panel'),
    name: document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent,
  }));
  assert.ok(
    next.inPanel,
    tag('Tab from an open stage enters its options: ' + JSON.stringify(next))
  );
  const below = await page.evaluate(() => {
    const panel = document.querySelector('.chain-edit-panel').getBoundingClientRect();
    const stages = [...document.querySelectorAll('.chain-stage')].map((b) =>
      b.getBoundingClientRect()
    );
    return panel.top >= Math.max(...stages.map((r) => r.bottom)) - 1;
  });
  assert.ok(below, tag('the open stage panel stays below every stage'));
  const chainNames = await page
    .locator('.chain-edit-options button[data-set-chain="fx"]')
    .evaluateAll((els) =>
      els
        .filter((b) => b.querySelector('.chip-block-sub'))
        .map((b) => b.textContent)
        .filter((t) => !/^[^,]+, \S/.test(t))
    );
  assert.deepEqual(chainNames, [], tag('chain option names separate the name from its tags'));
  assert.ok(
    await tabTo(page, '.chain-edit-options button[data-set-chain="fx"]'),
    tag('Tab reaches the effects')
  );
  const fxOff = await focusInfo(page);
  await page.keyboard.press('Enter');
  await settle(page);
  const fxOn = await focusInfo(page);
  assert.ok(
    fxOn.item === fxOff.item && fxOn.pressed === String(fxOff.pressed !== 'true'),
    tag(
      'toggling an effect keeps focus and flips its pressed state: ' + JSON.stringify([fxOff, fxOn])
    )
  );
  await page.locator('.detail-tab[data-tab="preface"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(
    await page.getByRole('combobox', { name: 'Search characters' }).count(),
    1,
    tag('the character search is named')
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
      assert.equal(
        await page.locator('#genre-list').getAttribute('role'),
        'tabpanel',
        'Genre: the list the view tabs control is their tabpanel'
      );
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
      await editorKeyboard(page, width + 'px');
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
    // The narrow Edit Voice setup (390x780): the card opened from its own Edit
    // button, then the keyboard alone; then removing it is announced.
    {
      console.log('Checking the card editor at 390x780 (Edit Voice)');
      const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.getByLabel('Search genres').fill('Delta blues');
      await page.getByRole('button', { name: 'Add Delta blues', exact: true }).click();
      await page.locator('.sb-card').first().waitFor({ state: 'attached' });
      await page.locator('[data-ui="session"]').click();
      await page.getByRole('button', { name: 'Edit Voice', exact: true }).click();
      await page.locator('.detail-tab[data-tab="parts"]').waitFor();
      await editorKeyboard(page, '390x780 Edit Voice');
      await page.locator('#detail-view [data-action="delete"]').click();
      await page
        .waitForFunction(
          () =>
            /Removed Voice\. Undo restores it\./.test(
              document.getElementById('toast')?.textContent || ''
            ),
          null,
          { timeout: 3000 }
        )
        .catch(() => {});
      assert.match(
        await page.locator('#toast').innerText(),
        /Removed Voice\. Undo restores it\./,
        'Removing an instrument from the recipe is announced'
      );
      // An action toast is a hundred Tabs away: Alt+Shift+T reaches its action,
      // it does not time out while it holds focus, and when it goes (replaced
      // or timed out) focus returns to where it was, unless the action put
      // focus somewhere on purpose.
      await page.evaluate(() => {
        for (const id of ['probe-return', 'probe-target']) {
          const b = document.createElement('button');
          b.id = id;
          b.textContent = id;
          document.body.appendChild(b);
        }
        document.getElementById('probe-return').focus();
      });
      await page.keyboard.press('Alt+Shift+T');
      const reach = await page.evaluate(() => ({
        focus: document.activeElement?.className,
        label: document.activeElement?.textContent,
        hint: /Alt\+Shift\+T reaches Undo/.test(document.getElementById('toast').textContent),
      }));
      assert.deepEqual(
        reach,
        { focus: 'toast-action', label: 'Undo', hint: true },
        'Toast: Alt+Shift+T reaches the action, and the toast says so'
      );
      await page.waitForTimeout(7500);
      assert.deepEqual(
        await page.evaluate(() => ({
          shown: document.getElementById('toast').classList.contains('show'),
          focus: document.activeElement?.className,
        })),
        { shown: true, focus: 'toast-action' },
        'Toast: a toast holding focus does not time out'
      );
      await page.evaluate(() => showToast('Replaced', 'success'));
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'probe-return',
        'Toast: replacing a toast that holds focus returns focus to where it came from'
      );
      await page.evaluate(() => {
        showToast('Probe timed', 'success', { label: 'Act', run() {} });
        document.getElementById('probe-return').focus();
      });
      await page.keyboard.press('Alt+Shift+T');
      await page.evaluate(() => document.getElementById('probe-return').focus());
      await page
        .waitForFunction(() => !document.getElementById('toast').classList.contains('show'), null, {
          timeout: 9000,
        })
        .catch(() => {});
      assert.deepEqual(
        await page.evaluate(() => ({
          shown: document.getElementById('toast').classList.contains('show'),
          focus: document.activeElement?.id,
        })),
        { shown: false, focus: 'probe-return' },
        'Toast: once focus leaves, the timer resumes and the toast times out'
      );
      await page.evaluate(() => {
        showToast('Probe', 'success', {
          label: 'Act',
          run() {
            document.getElementById('probe-target').focus();
          },
        });
        document.getElementById('probe-return').focus();
      });
      await page.keyboard.press('Alt+Shift+T');
      await page.keyboard.press('Enter');
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'probe-target',
        'Toast: focus the action places on purpose is kept'
      );
      // A second press from inside the toast keeps the original way back.
      await page.evaluate(() => {
        showToast('Probe twice', 'success', { label: 'Act', run() {} });
        document.getElementById('probe-return').focus();
      });
      await page.keyboard.press('Alt+Shift+T');
      await page.keyboard.press('Alt+Shift+T');
      await page.evaluate(() => showToast('Replaced again', 'success'));
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'probe-return',
        'Toast: a repeated shortcut still returns focus to where it came from'
      );
      // The shortcut never takes a keystroke from a text field.
      await page.evaluate(() => {
        const f = document.createElement('input');
        f.id = 'probe-field';
        document.body.appendChild(f);
        showToast('Probe field', 'success', { label: 'Act', run() {} });
        f.focus();
      });
      await page.keyboard.press('Alt+Shift+T');
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'probe-field',
        'Toast: the shortcut leaves a text field alone'
      );
      // Retry is reachable without the shortcut: an error toast with an
      // action does not time out, and it can be dismissed.
      await page.evaluate(() => showToast('Probe error', 'error', { label: 'Retry', run() {} }));
      const err = await page.evaluate(() => ({
        timed: toastTimed,
        actions: [...document.querySelectorAll('#toast .toast-action')].map((b) => b.textContent),
      }));
      assert.deepEqual(
        err,
        { timed: false, actions: ['Retry', 'Dismiss'] },
        'Toast: an error with Retry waits for its user and can be dismissed'
      );
      await page.locator('#toast .toast-dismiss').click();
      assert.equal(
        await page.evaluate(() => document.getElementById('toast').classList.contains('show')),
        false,
        'Toast: Dismiss takes the error toast down'
      );
      // Genre detail: an in-content jump to a tab brings the tab into view.
      await page.getByRole('button', { name: 'Genre', exact: true }).first().click();
      await page.getByLabel('Search genres').fill('Delta blues');
      await page.locator('[data-ui="genre-select"]').first().click();
      const similar = page.locator(
        '#surface-genre [data-ui="genre-tab"][data-id="similar"].gp-linkbtn'
      );
      await similar.first().scrollIntoViewIfNeeded();
      await similar.first().focus();
      await page.keyboard.press('Enter');
      const tabSeen = await page.evaluate(() => {
        const t = document.activeElement;
        const r = t.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return {
          id: t.id,
          visible: r.top >= 0 && r.bottom <= innerHeight && !!hit && t.contains(hit),
          at: `${Math.round(r.top)}..${Math.round(r.bottom)} of ${innerHeight}`,
          over: hit
            ? (hit.closest('[id]')?.id || '') +
              ' ' +
              (hit.getAttribute('aria-label') || hit.textContent.trim().slice(0, 40))
            : null,
        };
      });
      assert.deepEqual(
        { id: tabSeen.id, visible: tabSeen.visible },
        { id: 'gp-tab-similar', visible: true },
        'Genre: Find similar sounds focuses its tab where it can be seen: ' +
          JSON.stringify(tabSeen)
      );
      assert.deepEqual(errors, [], 'No browser errors (390x780)');
      console.log('PASS card editor at 390x780: Edit Voice by keyboard, remove announced');
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
