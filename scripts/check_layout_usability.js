#!/usr/bin/env node
'use strict';
/* global window, document, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame, app, UI, uiAddGenre, uiNavigate, renderRecipeStack, openModal, closeModal, toastTimed, toastDeadline, hideToast, showToast, ipAnnounce, ipRenderInspector, uiCloseInstrumentPreview, MutationObserver */
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
// Preface commits keep focus (#82), Clear has a name (#83), and the Browse
// dialog says its count, exposes its sections and describes its chips (#84).
async function prefaceKeyboard(page, tag) {
  const where = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      return {
        tag: a?.tagName,
        cls: a?.classList?.[0] || null,
        fan: a?.dataset?.fanPrefaceId || null,
        cat: a?.dataset?.prefCat || null,
        expanded: a?.getAttribute('aria-expanded'),
        value: a?.value ?? null,
        inPreface: !!a?.closest('.preface-section'),
      };
    });
  assert.equal(
    await page
      .locator('#detail-view')
      .getByRole('button', { name: 'Clear preface and re-suggest from current parts' })
      .count(),
    1,
    tag('the preface Clear button is named')
  );
  const input = page.locator('#detail-view .preface-input');
  await input.focus();
  await input.fill('haunting');
  await page.keyboard.press('Enter');
  await settle(page);
  const typed = await where();
  assert.ok(
    typed.cls === 'preface-input' && typed.value === 'haunting',
    tag('Enter in the character search commits and keeps focus there: ' + JSON.stringify(typed))
  );
  const fan = page.locator('#detail-view [data-fan-preface-id]:not(.is-current)').first();
  if (await fan.count()) {
    const id = await fan.getAttribute('data-fan-preface-id');
    await fan.focus();
    await page.keyboard.press('Enter');
    await settle(page);
    const chose = await where();
    assert.ok(
      chose.inPreface && (chose.fan === id || chose.cls === 'preface-input'),
      tag('a suggestion chip pick keeps focus on that chip: ' + JSON.stringify(chose))
    );
  }
  await page.locator('#detail-view .preface-browse').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'search-preface');
  const head = page.locator('#preface-modal-body .preface-cat-head').first();
  assert.equal(await head.getAttribute('aria-expanded'), 'true', tag('an open section says so'));
  const cat = await head.getAttribute('data-pref-cat');
  await head.focus();
  await page.keyboard.press('Enter');
  const folded = await where();
  assert.deepEqual(
    { cat: folded.cat, expanded: folded.expanded },
    { cat, expanded: 'false' },
    tag('collapsing a section keeps focus on its head, which says it is collapsed')
  );
  await page.keyboard.press('Enter');
  await page.locator('#search-preface').fill('bitter');
  await page.waitForFunction(() =>
    /^\d+ match(es)?$/.test(document.getElementById('preface-modal-live')?.textContent || '')
  );
  const heads = page.locator('#preface-modal-body .preface-cat-head');
  assert.equal(
    await page
      .locator('#preface-modal-body')
      .getByRole('button', { name: /^[^\d]+, \d+ prefaces?$/ })
      .count(),
    await heads.count(),
    tag('each section head is named with its count as words')
  );
  const notes = await page.locator('#preface-modal-body .preface-pick').evaluateAll((els) =>
    els
      .filter((b) => b.dataset.tooltip)
      .map((b) => {
        const d = document.getElementById(b.getAttribute('aria-describedby') || '');
        return d && d.textContent === b.dataset.tooltip ? null : b.dataset.prefId;
      })
      .filter(Boolean)
  );
  assert.deepEqual(notes, [], tag('every preface chip is described by its note'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () => !document.getElementById('modal-preface')?.classList.contains('open')
  );
  await settle(page);
  const back = await where();
  assert.ok(
    back.cls === 'btn' && back.inPreface,
    tag('a Browse pick returns focus to Browse on the redrawn card: ' + JSON.stringify(back))
  );
  assert.ok(
    await page.evaluate(() => document.activeElement?.classList.contains('preface-browse')),
    tag('the focused control after a Browse pick is Browse')
  );
}
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
  // #88: the open stage's options are a group named by the stage heading.
  assert.deepEqual(
    await page.evaluate(() => {
      const g = document.querySelector('.chain-edit-options');
      const by = document.getElementById(g.getAttribute('aria-labelledby') || '');
      return { role: g.getAttribute('role'), name: by?.textContent || null };
    }),
    { role: 'group', name: 'Effects — pick any number' },
    tag('the open stage options are a group named by its heading')
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
  await prefaceKeyboard(page, tag);
  // Output: the format switcher is a named group that says which format is
  // shown and keeps focus on the format just pressed.
  await page.locator('.detail-tab[data-tab="stack"]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#detail-view button[data-fmt="tags"]').focus();
  await page.keyboard.press('Enter');
  const fmt = await page.evaluate(() => ({
    focus: document.activeElement?.dataset?.fmt || document.activeElement?.tagName,
    pressed: document.activeElement?.getAttribute('aria-pressed'),
    group: document.activeElement?.parentElement?.getAttribute('aria-label'),
  }));
  assert.deepEqual(
    fmt,
    { focus: 'tags', pressed: 'true', group: 'Recipe format' },
    tag('a format button keeps focus and reads as pressed in a named group')
  );
  // The full recipe dialog's switcher does the same.
  await page.evaluate(() => {
    renderRecipeStack();
    openModal('modal-recipe-stack');
  });
  // openModal moves focus into the dialog on a short timer; let it land
  // first, or it takes focus back from the format button mid-check.
  await page.waitForFunction(() =>
    document.getElementById('modal-recipe-stack')?.contains(document.activeElement)
  );
  await page.waitForTimeout(100);
  await page.locator('#recipe-stack-body button[data-rfmt="compact"]').focus();
  await page.keyboard.press('Enter');
  const rfmt = await page.evaluate(() => ({
    focus: document.activeElement?.dataset?.rfmt || document.activeElement?.tagName,
    pressed: document.activeElement?.getAttribute('aria-pressed'),
    group: document.activeElement?.parentElement?.getAttribute('aria-label'),
  }));
  assert.deepEqual(
    rfmt,
    { focus: 'compact', pressed: 'true', group: 'Recipe format' },
    tag('the full recipe format button keeps focus and reads as pressed')
  );
  await page.keyboard.press('Escape');
  // Early interaction: focus placed in the dialog before its delayed first
  // focus fires is kept, and a dialog closed before then takes no focus.
  await page.evaluate(() => {
    renderRecipeStack();
    openModal('modal-recipe-stack');
    document.querySelector('#recipe-stack-body button[data-rfmt="tags"]').focus();
  });
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(() => document.activeElement?.dataset?.rfmt || null),
    'tags',
    tag('the dialog delayed first focus does not take focus placed inside it')
  );
  await page.evaluate(() => {
    closeModal('modal-recipe-stack');
    openModal('modal-recipe-stack');
    closeModal('modal-recipe-stack');
  });
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(() =>
      document.getElementById('modal-recipe-stack').contains(document.activeElement)
    ),
    false,
    tag('a dialog closed before its first focus takes no focus')
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
      // Forced colours erase colour-only state: a chosen tab, view or page
      // must still differ from its siblings, and a focused field keeps a ring.
      await page.emulateMedia({ forcedColors: 'active' });
      const forced = await page.evaluate(() => {
        const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
        const pair = (on, off) => ({
          on: bg(document.querySelector(on)),
          off: bg(document.querySelector(off)),
        });
        return {
          tab: pair(
            '#surface-genre [role="tab"][aria-selected="true"]',
            '#surface-genre [role="tab"][aria-selected="false"]'
          ),
          layout: pair(
            '#surface-genre button[aria-pressed="true"]',
            '#surface-genre button[aria-pressed="false"]'
          ),
          page: pair(
            '.cm-tab[aria-current="page"]',
            '.cm-tab:not([aria-current]):not([aria-selected="true"])'
          ),
        };
      });
      for (const [what, p] of Object.entries(forced))
        assert.ok(
          p.on && p.off && p.on !== p.off,
          'Forced colours: the chosen ' + what + ' still stands out: ' + JSON.stringify(p)
        );
      // Probes for the states that are not on screen here: a muted label
      // inside a chosen control, an open chain stage, compare's marks.
      const probe = await page.evaluate(() => {
        const host = document.getElementById('surface-library') || document.body;
        const box = document.createElement('div');
        box.innerHTML =
          '<button aria-pressed="true">x<span style="color:#888">1,671</span></button>' +
          '<button class="chain-stage editing">Mic</button><button class="chain-stage">Amp</button>' +
          '<mark>a</mark>';
        host.appendChild(box);
        const [chosen, open, closed] = box.querySelectorAll('button');
        const s = (el) => getComputedStyle(el);
        const out = {
          label: s(chosen.querySelector('span')).color === s(chosen).color,
          stage: s(open).borderTopColor !== s(closed).borderTopColor,
          mark:
            host.id !== 'surface-library' ||
            s(box.querySelector('mark')).backgroundColor !== s(box).backgroundColor,
        };
        box.remove();
        return out;
      });
      assert.deepEqual(
        probe,
        { label: true, stage: true, mark: true },
        'Forced colours: sub-labels, the open stage and compare marks stay visible'
      );
      await page.emulateMedia({ forcedColors: 'none' });
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
      assert.equal(
        await page.locator('#genre-list').getAttribute('role'),
        'tabpanel',
        'Genre: the list the view tabs control is their tabpanel'
      );
      if (width === 1280) {
        // The part editor speaks plainly (Jony #27, #28 on #519): a part option
        // is named by itself, what it adds or removes is its description, and
        // status text reaches a live region the inspector's re-render keeps.
        await page.getByRole('button', { name: 'Instrument', exact: true }).first().click();
        await page.locator('#surface-instrument .cm-tile-name').first().waitFor();
        assert.equal(
          await page.evaluate(() => document.getElementById('ip-live')?.getAttribute('role')),
          'status',
          'Instrument: the live region exists before its first message'
        );
        // A category keeps focus and says what it lists; List view is a list
        // (Jony #44, #45 on #519).
        const catsToggle = page.locator('[data-ui="ip-cats"]');
        if (await catsToggle.isVisible()) {
          if ((await catsToggle.getAttribute('aria-expanded')) !== 'true') await catsToggle.click();
        }
        const famId = await page.evaluate(
          () =>
            document.querySelector(
              '#instrument-body .ip-cat[data-ui="instrument-family"]:not([data-empty])'
            )?.dataset.id
        );
        await page
          .locator(`#instrument-body .ip-cat[data-ui="instrument-family"][data-id="${famId}"]`)
          .focus();
        await page.keyboard.press('Enter');
        const cat = await page.evaluate(() => ({
          id: document.activeElement?.dataset?.id || document.activeElement?.tagName,
          pressed: document.activeElement?.getAttribute('aria-pressed'),
          live: document.getElementById('ip-live')?.textContent || '',
        }));
        assert.ok(
          cat.id === famId && cat.pressed === 'true' && /^[\d,]+ instruments?$/.test(cat.live),
          'Instrument: a category keeps focus and announces its count: ' + JSON.stringify(cat)
        );
        // The class chips, "All · N", the Back crumb and Sort keep focus too
        // (Jony #103 on #519).
        const where = () =>
          page.evaluate(() => {
            const a = document.activeElement;
            return { tag: a?.tagName, ui: a?.dataset?.ui || a?.id || '', id: a?.dataset?.id || '' };
          });
        const clsId = await page.evaluate(
          () => document.querySelector('#instrument-body [data-ui="instrument-class"]')?.dataset.id
        );
        await page
          .locator(`#instrument-body [data-ui="instrument-class"][data-id="${clsId}"]`)
          .focus();
        await page.keyboard.press('Enter');
        assert.deepEqual(
          await where(),
          { tag: 'BUTTON', ui: 'instrument-class', id: clsId },
          'Instrument: a class chip keeps focus'
        );
        await page.locator('#instrument-body [data-ui="instrument-class-all"]').focus();
        await page.keyboard.press('Enter');
        assert.deepEqual(
          (await where()).ui,
          'instrument-class-all',
          "Instrument: the class row's All keeps focus"
        );
        await page
          .locator(`#instrument-body [data-ui="instrument-class"][data-id="${clsId}"]`)
          .click();
        await page.locator('#instrument-body [data-ui="instrument-back"]').focus();
        await page.keyboard.press('Enter');
        assert.equal(
          (await where()).ui,
          'instrument-back',
          'Instrument: Back from a class keeps focus on Back'
        );
        await page.keyboard.press('Enter');
        assert.equal(
          (await where()).ui,
          'ip-list-title',
          'Instrument: Back to all instruments lands on the list heading'
        );
        await page.locator('#ip-sort').focus();
        await page.keyboard.press('ArrowDown');
        assert.equal((await where()).ui, 'ip-sort', 'Instrument: Sort keeps focus as it changes');
        await page.locator('#ip-sort').selectOption('name');
        await page
          .locator(`#instrument-body .ip-cat[data-ui="instrument-family"][data-id="${famId}"]`)
          .click();
        await page.locator('[data-ui="ip-view"][data-id="list"]').click();
        const listRows = await page.locator('#instrument-body .ip-row').count();
        assert.ok(
          listRows > 0 &&
            (await page
              .getByRole('list', { name: 'Instruments' })
              .getByRole('listitem')
              .count()) === listRows,
          'Instrument: List view rows are items of a list'
        );
        await page.locator('[data-ui="ip-view"][data-id="rows"]').click();
        await page.locator('#instrument-body .ip-cat[data-ui="instrument-all"]').click();
        if (
          (await catsToggle.isVisible()) &&
          (await catsToggle.getAttribute('aria-expanded')) === 'true'
        )
          await catsToggle.click();
        await page.locator('#instrument-search').fill('drum');
        await page.waitForFunction(() =>
          /instrument/.test(document.getElementById('ip-live')?.textContent || '')
        );
        await page.locator('#instrument-search').fill('');
        await page.locator('#surface-instrument .cm-tile-name').first().click();
        await page.locator('#instrument-preview .ip-opt input[type=radio]').first().waitFor();
        const opts = await page.evaluate(() => {
          const text = (ids) =>
            (ids || '')
              .split(' ')
              .map((id) => document.getElementById(id)?.textContent.trim() || '')
              .join(' ');
          return [
            ...document.querySelectorAll('#instrument-preview .ip-opt input[type=radio]'),
          ].map((r) => ({
            name: text(r.getAttribute('aria-labelledby')),
            shown: r.closest('label').querySelector('.ip-opt-name')?.textContent.trim(),
            desc: text(r.getAttribute('aria-describedby')),
          }));
        });
        assert.ok(
          opts.length && opts.every((o) => o.name && o.name === o.shown),
          'Instrument: a part option is named by its own name only'
        );
        assert.ok(
          opts.some((o) => /\b(adds|removes) /.test(o.desc)),
          'Instrument: an option describes what it adds or removes in words'
        );
        const live = await page.evaluate(() => {
          ipAnnounce('probe');
          const first = document.getElementById('ip-live');
          ipRenderInspector();
          const again = document.getElementById('ip-live');
          return {
            same: !!first && first === again,
            outside: !document.getElementById('instrument-preview').contains(again),
            role: again?.getAttribute('role'),
            text: again?.textContent,
          };
        });
        assert.deepEqual(
          live,
          { same: true, outside: true, role: 'status', text: 'probe' },
          'Instrument: the live region outlives the inspector re-render'
        );
        await page.locator('#ip-tab-preface').click();
        await page.locator('#ip-pref-q').pressSequentially('dre', { delay: 60 });
        await page
          .waitForFunction(
            () => /match/.test(document.getElementById('ip-live')?.textContent || ''),
            null,
            { timeout: 3000 }
          )
          .catch(() => {});
        assert.match(
          await page.evaluate(() => document.getElementById('ip-live').textContent),
          /^\d+ match(es)?$/,
          'Instrument: the Character search count is announced once typing stops'
        );
        await page.evaluate(() => uiCloseInstrumentPreview());
        assert.equal(
          await page.evaluate(() => document.getElementById('ip-live').textContent),
          '',
          'Instrument: closing the inspector clears its last message'
        );
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
      await editorKeyboard(page, width + 'px');
      if (width >= 1024) {
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
      if (width >= 1024) {
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
      if (width === 1280) {
        // A menu item's action hands focus back to More, and an Undo or Redo
        // that its own step disables hands focus to its partner, never to the
        // page body (Jony #14 on #519).
        await page.locator('#ui-menu [data-ui="reset-layout"]').focus();
        await page.keyboard.press('Enter');
        assert.deepEqual(
          await page.evaluate(() => ({
            hidden: document.getElementById('ui-menu').hidden,
            more: !!document.activeElement?.matches('[data-ui="menu"]'),
          })),
          { hidden: true, more: true },
          'Reset layout from the keyboard returns focus to More'
        );
        const focused = () =>
          page.evaluate(() => {
            const a = document.activeElement;
            return a === document.body ? 'body' : a.id || a.dataset.ui || a.tagName;
          });
        await page.locator('#btn-undo').focus();
        for (let i = 0; i < 60 && (await focused()) === 'btn-undo'; i++)
          await page.keyboard.press('Enter');
        assert.equal(await focused(), 'btn-redo', 'the last Undo hands focus to Redo');
        for (let i = 0; i < 60 && (await focused()) === 'btn-redo'; i++)
          await page.keyboard.press('Enter');
        assert.equal(await focused(), 'btn-undo', 'the last Redo hands focus to Undo');
      } else await page.getByRole('button', { name: 'Reset layout', exact: true }).click();
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
      if (width === 1280) {
        // Relations opens inline beside the song here; opening it from the
        // keyboard puts focus on its Close, not on the page body (Jony #13).
        await page.locator('#lyrics-draft').fill('[Verse]\nThe morning light\nIs warm and bright');
        await page.locator('[data-ui="ly-find-open"]').click();
        await page.keyboard.press('Escape');
        await page.locator('[data-ui="ly-relations"]').focus();
        await page.keyboard.press('Enter');
        await page.locator('#ly-relation-inspector:not([hidden])').waitFor();
        assert.equal(
          await page.evaluate(
            () => document.activeElement?.closest('#ly-relation-inspector')?.id || 'body'
          ),
          'ly-relation-inspector',
          'opening Relations moves focus into the inline inspector'
        );
        await page.locator('#ly-relation-inspector [data-ui="ly-relation-close"]').click();
        await page.locator('#lyrics-draft').fill('');
      }
      await page.getByRole('button', { name: 'Map', exact: true }).click();
      const atlas = page.frameLocator('#map-frame');
      await atlas.locator('.rowbtn').first().waitFor({ state: 'attached' });
      await atlas.getByLabel('Search traditions').fill('classical');
      await atlas.locator('#results').waitFor();
      const mapFrame = page.frames().find((f) => f.url().includes('atlas.html'));
      await settle(mapFrame);
      await inside(mapFrame, '#results');
      if (width === 1280) {
        // Picking a result from the keyboard leaves focus in the tradition card,
        // also after its detail arrives and the card re-renders (Jony #16).
        await mapFrame.locator('#results [data-tid]').first().focus();
        await page.keyboard.press('Enter');
        await mapFrame.locator('#card:not([hidden]) h2').waitFor();
        await page.waitForTimeout(800);
        assert.equal(
          await mapFrame.evaluate(() =>
            document.activeElement?.closest('#card') ? 'card' : document.activeElement?.tagName
          ),
          'card',
          'picking a search result keeps focus in the card'
        );
      }
      await page.goto(base + '/atlas.html');
      await page.locator('.rowbtn').first().waitFor({ state: 'attached' });
      // The location chooser: each row is a named button inside a list item.
      // Iqaluit's dots stack at the zoom a 1024px+ canvas reaches; narrower
      // canvases fly in closer, where they split apart instead.
      if (width >= 1024) {
        await page.getByLabel('Search traditions').fill('Iqaluit');
        await page.locator('#results button[data-tid]').first().click();
        await page.waitForTimeout(2500);
        await page.keyboard.press('Escape');
        const canvas = await page.locator('canvas').first().boundingBox();
        await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
        await page.locator('#stack-list [data-tid]').first().waitFor();
        const stack = page.locator('#stack');
        const stackRows = await page.locator('#stack-list [data-tid]').count();
        assert.ok(stackRows > 1, 'Map: the Iqaluit location opens a chooser');
        assert.equal(
          await stack.getByRole('button', { name: /Iqaluit/ }).count(),
          stackRows,
          'Map: every location chooser row is a button named by its tradition'
        );
        assert.equal(
          await stack.getByRole('listitem').count(),
          stackRows,
          'Map: every location chooser row is a list item'
        );
        await page.keyboard.press('Escape');
        await page.getByLabel('Search traditions').fill('');
      }
      // Typing in the map's search says once what it found, not every keystroke.
      await page.evaluate(() => {
        window.__said = { summary: [], live: [] };
        const watch = (id, key) =>
          new MutationObserver(() => {
            const t = document.getElementById(id).textContent.trim();
            if (t) window.__said[key].push(t);
          }).observe(document.getElementById(id), {
            childList: true,
            subtree: true,
            characterData: true,
          });
        watch('filter-summary', 'summary');
        watch('map-live', 'live');
      });
      await page.getByLabel('Search traditions').pressSequentially('delta blues', { delay: 40 });
      await page.waitForTimeout(1000);
      const said = await page.evaluate(() => window.__said);
      assert.deepEqual(
        [...new Set(said.summary)],
        ['Search: delta blues'],
        'Map: the search summary is written once the typing stops, not per keystroke'
      );
      assert.match(
        said.live[said.live.length - 1] || '',
        /^[\d,]+ traditions? match(es)? “delta blues”$/,
        'Map: the search result count is announced in the live region'
      );
      assert.equal(
        await page.getByLabel('Search traditions').getAttribute('aria-expanded'),
        'true',
        'Map: the search box says its results are open'
      );
      await page.getByLabel('Search traditions').fill('zzqxv');
      await page.waitForFunction(() =>
        /^No matching/.test(document.getElementById('map-live').textContent)
      );
      assert.equal(
        await page.locator('#results [role="status"]').count(),
        0,
        'Map: the no-match text is not a freshly inserted status'
      );
      await page.getByLabel('Search traditions').fill('');
      assert.equal(
        await page.getByLabel('Search traditions').getAttribute('aria-expanded'),
        'false',
        'Map: the search box says its results are closed'
      );
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
      // An action toast is a hundred Tabs away: F8 reaches its action,
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
      await page.keyboard.press('F8');
      const reach = await page.evaluate(() => ({
        focus: document.activeElement?.className,
        label: document.activeElement?.textContent,
        hint: /F8 reaches Undo/.test(document.getElementById('toast').textContent),
      }));
      assert.deepEqual(
        reach,
        { focus: 'toast-action', label: 'Undo', hint: true },
        'Toast: F8 reaches the action, and the toast says so'
      );
      assert.equal(
        await page.evaluate(() =>
          document.getElementById('toast').closest('[role="region"]')?.getAttribute('aria-label')
        ),
        'Notifications',
        'Toast: the toast sits in a Notifications landmark'
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
      await page.keyboard.press('F8');
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
      await page.keyboard.press('F8');
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
      await page.keyboard.press('F8');
      await page.keyboard.press('F8');
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
      await page.keyboard.press('F8');
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
      // A plain error waits too, with Dismiss; other toasts stay long
      // enough to read (at least 4 s, longer for a longer message).
      const plain = await page.evaluate(() => {
        showToast('Probe plain error', 'error');
        const error = {
          timed: toastTimed,
          actions: [...document.querySelectorAll('#toast .toast-action')].map((b) => b.textContent),
        };
        showToast('Saved', 'success');
        const short = toastDeadline - Date.now();
        showToast('x'.repeat(90), 'success');
        const long = toastDeadline - Date.now();
        hideToast(document.getElementById('toast'));
        return { error, short: short >= 3800, long: long > short && long <= 6600 };
      });
      assert.deepEqual(
        plain,
        { error: { timed: false, actions: ['Dismiss'] }, short: true, long: true },
        'Toast: a plain error waits with Dismiss; other toasts last long enough to read'
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
