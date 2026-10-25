#!/usr/bin/env node
'use strict';
/* global window, document, getComputedStyle, innerWidth, innerHeight, requestAnimationFrame, app, UI, uiAddGenre, uiNavigate, renderRecipeStack, openModal, closeModal, toastTimed, toastDeadline, hideToast, showToast, ipAnnounce, ipRenderInspector, uiCloseInstrumentPreview, MutationObserver, chatState, Element, InstLite, uiInspectInstrument, matchMedia, uiChatOpen, _chatRenderReply, uiShowStorageConflict, lyErr */
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
      // What a screen reader is told (Jony #22-#24, #26 on #519): every page
      // has its own h1, there is one main landmark, a layout button has a name
      // when its label is hidden, and a field's error joins its help text.
      if (width === 360 || width === 1280) {
        for (const name of ['Rows', 'List'])
          assert.equal(
            (await page.getByRole('button', { name, exact: true }).count()) > 0,
            true,
            `Genre: the ${name} layout button has an accessible name at ${width}px`
          );
      }
      if (width === 1280) {
        for (const view of ['Genre', 'Instrument', 'Map', 'Lyrics']) {
          await page.getByRole('button', { name: view, exact: true }).first().click();
          await page.waitForTimeout(400);
          const marks = await page.evaluate((v) => {
            const surface = document.getElementById('surface-' + v.toLowerCase());
            return {
              h1: surface ? surface.querySelectorAll('h1').length : -1,
              main: document.querySelectorAll('main, [role="main"]').length,
            };
          }, view);
          assert.ok(marks.h1 >= 1, `${view}: the page has an h1 (${JSON.stringify(marks)})`);
          assert.equal(
            marks.main,
            1,
            `${view}: exactly one main landmark (${JSON.stringify(marks)})`
          );
        }
        assert.match(
          await page.evaluate(() => lyErr({ errors: { lines: 'x' } }, 'lines', 'ly-f-lines-help')),
          /aria-describedby="ly-f-lines-help ly-err-lines"/,
          'Lyrics: an error joins the field help in one aria-describedby'
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
      // Landmarks (Jony #124): the page is the one main and holds its h1; Your
      // recipe is its own complementary landmark beside main, not inside it.
      const main = page.getByRole('main');
      assert.equal(await main.count(), 1, 'One main landmark');
      assert.equal(
        await main.getByRole('heading', { level: 1 }).count(),
        1,
        'The page h1 is inside main'
      );
      assert.equal(
        await main.locator('#workspace-sidebar').count(),
        0,
        'Your recipe is outside main'
      );
      assert.equal(
        await page
          .getByRole('complementary', { name: 'Your recipe', exact: true, includeHidden: true })
          .count(),
        1,
        'Your recipe is a named complementary landmark'
      );
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
      // The card editor is a region named for its card, headed by an h2 that
      // names it (Jony #125). A row of genre tiles is a heading and a named
      // list, not a landmark: one region per letter flooded the list (#127).
      const editor = page.getByRole('region', { name: /^Edit / });
      assert.equal(await editor.count(), 1, 'The card editor is one named region');
      const cardName = (await editor.getAttribute('aria-label')).slice('Edit '.length);
      const editorHeading = editor.getByRole('heading', { level: 2 });
      assert.equal(await editorHeading.count(), 1, 'The card editor has one h2');
      assert.ok(
        (await editorHeading.textContent()).includes(cardName),
        'The editor heading names ' + cardName
      );
      const rows = page.locator('.cm-rows-group');
      assert.ok(await rows.count(), 'Genre rows are on the page');
      assert.equal(
        await page.getByRole('region', { includeHidden: true }).and(rows).count(),
        0,
        'A tile row is not a landmark'
      );
      assert.ok(
        await page
          .getByRole('list', { includeHidden: true })
          .and(page.locator('.cm-rows-track[aria-label]'))
          .count(),
        'A tile row keeps its named list'
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
      // Reduced motion: a script-driven jump scrolls without animating.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.getByRole('button', { name: 'Instrument', exact: true }).first().click();
      await page.locator('#surface-instrument .cm-tile-name').first().click();
      await page.locator('[data-ui="ip-similar-jump"]').waitFor();
      const behaviors = await page.evaluate(() => {
        const seen = [];
        const orig = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (o) {
          seen.push(o && o.behavior);
          return orig.call(this, o);
        };
        document.querySelector('[data-ui="ip-similar-jump"]').click();
        Element.prototype.scrollIntoView = orig;
        return seen;
      });
      assert.ok(
        behaviors.length > 0 && !behaviors.includes('smooth'),
        'Reduced motion: the Similar jump scrolls without animating: ' + JSON.stringify(behaviors)
      );
      await page.emulateMedia({ reducedMotion: null });
      await page.keyboard.press('Escape');
      // The tab title names the surface, through Back and Forward too.
      assert.equal(await page.title(), 'Instrument · Codex Musica', 'Title: Instrument');
      await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
      await noOverflow(page);
      assert.equal(await page.title(), 'Lyrics · Codex Musica', 'Title: Lyrics');
      await page.goBack();
      await page.waitForFunction(() => document.body.dataset.view === 'instrument');
      assert.equal(await page.title(), 'Instrument · Codex Musica', 'Title: Back to Instrument');
      await page.goForward();
      await page.waitForFunction(() => document.body.dataset.view === 'lyrics');
      assert.equal(await page.title(), 'Lyrics · Codex Musica', 'Title: Forward to Lyrics');
      // Headings say what they head (Jony #128): the Instruments h1 is not
      // read with its count, the song title heading is the title rather than
      // its button's "Edit title" name, and the review heading leads with words.
      await page.getByRole('button', { name: 'Instrument', exact: true }).click();
      await page.locator('#ip-total', { hasText: /\d/ }).waitFor();
      assert.equal(
        await page.getByRole('heading', { level: 1, name: 'Instruments', exact: true }).count(),
        1,
        'The Instruments h1 is named Instruments'
      );
      await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
      await noOverflow(page);
      const songTitle = await page.locator('.ly-title-btn > span').textContent();
      assert.equal(
        await page.getByRole('heading', { level: 2, name: songTitle, exact: true }).count(),
        1,
        'The song title heading is named by the title'
      );
      await page.locator('#ly-tab-review').dispatchEvent('click');
      assert.equal(
        await page
          .getByRole('heading', { level: 3, name: /^Review of this version/, includeHidden: true })
          .count(),
        1,
        'The review heading leads with words'
      );
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
          'px: landmarks, headings, tree, labels, editor, panes, menus, lyrics, embedded/standalone map, short viewport'
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
          recipe: [...reply.querySelectorAll('.chat-recipe .chat-sr')].map((s) =>
            s.textContent.replace(/^\d+ of 1000 characters\. $/, 'N of 1000 characters. ')
          ),
          // The short "77 / 1000 chars" is for the eye only (Jony #112).
          countHidden: reply.querySelector('.chat-recipe-foot > span')?.getAttribute('aria-hidden'),
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
          recipe: ['Recipe: ', '. ', 'N of 1000 characters. '],
          countHidden: 'true',
          copy: 'Copy recipe',
          tools: 'true',
          summary: ['Codex:', '2 tool steps, all clean.'],
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
    {
      // Keyboard guards on a phone: Ctrl+Z behind a dialog or in a text field
      // never undoes the recipe, and the open Recipe sheet keeps Tab off the
      // page hidden under it.
      const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.getByLabel('Search genres').fill('Delta blues');
      await page.getByRole('button', { name: 'Add Delta blues', exact: true }).click();
      await page.locator('.sb-card').first().waitFor({ state: 'attached' });
      const cards = () => page.evaluate(() => app.cards.length);
      const before = await cards();
      assert.ok(before > 0, 'Keyboard guards: the recipe has cards');
      await page.evaluate(() => document.getElementById('btn-saved').click());
      await page.locator('#modal-saved.open').waitFor();
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
      assert.equal(
        await cards(),
        before,
        'Keyboard guards: Ctrl+Z with Saved sessions open leaves the recipe alone'
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('.modal-bg.open'));
      await page.getByLabel('Search genres').fill('blues');
      await page.getByLabel('Search genres').focus();
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
      assert.equal(
        await cards(),
        before,
        'Keyboard guards: Ctrl+Z in a text field is the field’s own undo'
      );
      // The Recipe sheet covers the page: Tab past its last control stays off it.
      await page.evaluate(() => document.activeElement?.blur());
      await page.locator('[data-ui="session"]').click();
      await page.locator('#workspace-sidebar').waitFor();
      await page.evaluate(() => {
        const items = [
          ...document.querySelectorAll(
            '#workspace-sidebar button, #workspace-sidebar a[href], #workspace-sidebar input, #workspace-sidebar select, #workspace-sidebar textarea, #workspace-sidebar [tabindex="0"]'
          ),
        ].filter((el) => !el.disabled && el.getClientRects().length);
        items[items.length - 1].focus();
      });
      await page.keyboard.press('Tab');
      const landed = await page.evaluate(() => {
        const a = document.activeElement;
        return {
          onPage: !!document.getElementById('discovery')?.contains(a),
          what: a?.getAttribute('aria-label') || a?.id || a?.tagName,
        };
      });
      assert.equal(
        landed.onPage,
        false,
        'Keyboard guards: Tab from the Recipe sheet does not land on the page under it: ' +
          JSON.stringify(landed)
      );
      // Closing the sheet gives the page back.
      await page.locator('[data-ui="session"]').click();
      assert.equal(
        await page.evaluate(() => document.getElementById('discovery').inert),
        false,
        'Keyboard guards: closing the Recipe sheet makes the page usable again'
      );
      // A page opened from the sheet takes focus at once (Jony #81): the page
      // is given back in the same task, before the page focuses its field.
      await page.locator('[data-ui="session"]').click();
      await page.locator('#btn-add').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.body.dataset.view === 'instrument');
      await settle(page);
      assert.deepEqual(
        await page.evaluate(() => ({
          focus: document.activeElement?.id || document.activeElement?.tagName,
          inert: document.getElementById('discovery').inert,
        })),
        { focus: 'instrument-search', inert: false },
        'Keyboard guards: Add instrument from the Recipe sheet lands in Search instruments'
      );
      await page.keyboard.type('fiddle');
      assert.equal(
        await page.locator('#instrument-search').inputValue(),
        'fiddle',
        'Keyboard guards: typing after Add instrument goes into Search instruments'
      );
      // Explore variations from a card's menu in the sheet lands on the
      // variations it opened, not on BODY (Jony, #519).
      await page.locator('[data-ui="session"]').click();
      const fold = page.locator(
        '#workspace-sidebar .sb-tradition-toggle[aria-expanded="false"]:visible'
      );
      if (await fold.count()) await fold.first().click();
      await page.locator('#workspace-sidebar .sb-card-row .sb-more:visible').first().click();
      await page.locator('[data-card-action="drift"]:visible').first().click();
      await page.locator('.drift-panel').first().waitFor();
      await page.waitForTimeout(100);
      assert.equal(
        await page.evaluate(() => !!document.activeElement?.closest('.drift-panel')),
        true,
        'Keyboard guards: Explore variations from the sheet focuses the variations: ' +
          (await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80)))
      );
      console.log('PASS keyboard guards at 390x780: undo behind a dialog, in a field, sheet Tab');
      await context.close();
    }
    // Error and empty states: a Retry keeps the keyboard and says what
    // happened; Genre's no-match is said once; a link that matched nothing
    // says so instead of redirecting silently.
    {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      let engineDown = true;
      await context.route('**/engine.json*', (route) =>
        engineDown ? route.abort('internetdisconnected') : route.continue()
      );
      const page = await context.newPage();
      const toasts = () => page.evaluate(() => window.__toasts || []);
      const lives = () => page.evaluate(() => window.__live || []);
      await page.addInitScript(() => {
        window.__toasts = [];
        window.__live = [];
        // When #ui-live first speaks, relative to DOMContentLoaded, and whether
        // the page it speaks for had rendered by then.
        window.__liveFirst = null;
        document.addEventListener('DOMContentLoaded', () => {
          const dcl = performance.now();
          const live = document.getElementById('ui-live');
          if (live)
            new MutationObserver(() => {
              if (window.__liveFirst || !live.textContent.trim()) return;
              const s = document.querySelector('.ui-surface:not([hidden])');
              window.__liveFirst = {
                after: Math.round(performance.now() - dcl),
                rendered: !!s && s.querySelectorAll('button, a[href]').length > 0,
              };
            }).observe(live, { childList: true, characterData: true, subtree: true });
          for (const [id, log] of [
            ['toast', window.__toasts],
            ['ui-live', window.__live],
          ]) {
            const t = document.getElementById(id);
            if (t)
              new MutationObserver(() => {
                const text = t.textContent.trim();
                if (text && log[log.length - 1] !== text) log.push(text);
              }).observe(t, { childList: true, characterData: true, subtree: true });
          }
        });
      });
      // Instrument: Retry while the data is still down, then once it is back.
      await page.goto(base + '/codex.html#instrument');
      const retry = page.locator('#instrument-body [data-ui="engine-retry"]');
      await retry.waitFor({ timeout: 20000 });
      await retry.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      await page
        .locator('#instrument-body [data-engine-pending="failed"]')
        .waitFor({ timeout: 20000 });
      assert.deepEqual(
        await page.evaluate(() => ({
          focus: document.activeElement?.dataset?.ui || document.activeElement?.tagName,
          words: /Still couldn/.test(
            document.querySelector('#instrument-body [data-engine-pending]')?.textContent || ''
          ),
        })),
        { focus: 'engine-retry', words: true },
        'Instrument: a Retry that fails again keeps focus on Retry and says so'
      );
      engineDown = false;
      await page.keyboard.press('Enter');
      await page.locator('#instrument-body .ip-cat').first().waitFor({ timeout: 30000 });
      assert.equal(
        await page.evaluate(() => document.activeElement?.classList?.contains('ip-title')),
        true,
        'Instrument: a Retry that loads the data lands on the heading'
      );
      // Genre: typing a search that matches nothing says so once.
      await page.getByRole('button', { name: 'Genre', exact: true }).first().click();
      await page.locator('#genre-search').waitFor();
      await page.evaluate(() => {
        window.__toasts.length = 0;
        window.__live.length = 0;
        // An unresolved error and its Retry, standing while the search runs.
        showToast('Probe error', 'error', { label: 'Retry', run() {} });
      });
      await page.locator('#genre-search').pressSequentially('zzqxv', { delay: 60 });
      await page.waitForTimeout(900);
      const said = (await lives()).filter((t) => /No genres match/.test(t));
      const live = await page.evaluate(
        () => document.querySelector('#genre-list .cm-empty')?.getAttribute('role') ?? null
      );
      assert.deepEqual(
        { said, live },
        { said: ['No genres match “zzqxv”'], live: null },
        'Genre: an empty search is said once, and the no-match block is not a live region'
      );
      assert.deepEqual(
        await page.evaluate(() => ({
          text: /Probe error/.test(document.getElementById('toast').textContent),
          retry: !!document.querySelector('#toast .toast-action'),
        })),
        { text: true, retry: true },
        'Genre: a search announcement leaves a standing error and its Retry alone'
      );
      assert.deepEqual(
        (await toasts()).filter((t) => /No genres match/.test(t)),
        [],
        'Genre: a search announcement is not a toast'
      );
      // A link that matched nothing says so.
      await page.goto(base + '/codex.html?miss=1#genre/zzqx_not_a_genre');
      await page
        .waitForFunction(
          () => (window.__live || []).some((t) => /didn’t match a genre/.test(t)),
          null,
          { timeout: 15000 }
        )
        .catch(() => {});
      assert.ok(
        (await lives()).some((t) => /didn’t match a genre/.test(t)),
        'Routes: a genre link that matched nothing says so: ' + JSON.stringify(await lives())
      );
      await page.goto(base + '/codex.html?miss=2#nonsense');
      await page
        .waitForFunction(
          () => (window.__live || []).some((t) => /didn’t match a page/.test(t)),
          null,
          { timeout: 15000 }
        )
        .catch(() => {});
      assert.ok(
        (await lives()).some((t) => /didn’t match a page/.test(t)),
        'Routes: an unknown page link says so: ' + JSON.stringify(await lives())
      );
      await page.goto(base + '/codex.html?miss=3#instrument/zzqx_not_an_instrument');
      await page
        .waitForFunction(
          () => (window.__live || []).some((t) => /didn’t match an instrument/.test(t)),
          null,
          { timeout: 20000 }
        )
        .catch(() => {});
      assert.ok(
        (await lives()).some((t) => /didn’t match an instrument/.test(t)),
        'Routes: an instrument link that matched nothing says so: ' + JSON.stringify(await lives())
      );
      // At boot it is said once the page has rendered and settled, not in the
      // first moments of the load, when screen readers drop polite updates.
      const first = await page.evaluate(() => window.__liveFirst);
      assert.ok(
        first && first.after >= 1000 && first.rendered,
        'Routes: at boot the notice is spoken after the page renders: ' + JSON.stringify(first)
      );
      // Said and shown: a slim note above the page, never a toast and never
      // focused, until it is dismissed or another page is opened.
      const note = () =>
        page.evaluate(() => {
          const n = document.getElementById('ui-route-note');
          return {
            shown: !!n && !n.hidden && n.getClientRects().length > 0,
            text: n?.querySelector('.ui-route-note-text')?.textContent || '',
            focused: !!n?.contains(document.activeElement),
          };
        });
      assert.deepEqual(
        await note(),
        {
          shown: true,
          text: 'That link didn’t match an instrument, so here are all instruments.',
          focused: false,
        },
        'Routes: an unmatched instrument link shows a visible note that does not take focus'
      );
      await page.evaluate(() => (window.location.hash = '#genre/zzqx_other_genre'));
      await page.waitForFunction(() =>
        /didn’t match a genre/.test(document.getElementById('ui-route-note')?.textContent)
      );
      assert.deepEqual(
        await note(),
        {
          shown: true,
          text: 'That link didn’t match a genre, so here are all genres.',
          focused: false,
        },
        'Routes: an unmatched genre link shows the note on the genres'
      );
      await page.setViewportSize({ width: 390, height: 780 });
      assert.deepEqual(
        await page.evaluate(() => {
          const n = document.getElementById('ui-route-note');
          const s = document.getElementById('surface-genre');
          return {
            fits: n.scrollWidth <= n.clientWidth && document.documentElement.scrollWidth <= 390,
            below: s.getBoundingClientRect().top >= n.getBoundingClientRect().bottom - 1,
            target: n.querySelector('button').getBoundingClientRect().height >= 24,
          };
        }),
        { fits: true, below: true, target: true },
        'Routes: at 390 the note fits, covers nothing and its Dismiss is a 24px target'
      );
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.locator('#ui-route-note button').focus();
      await page.keyboard.press('Enter');
      assert.deepEqual(
        await page
          .evaluate(() => ({
            shown: !document.getElementById('ui-route-note').hidden,
            focus: document.activeElement?.tagName,
          }))
          .then((r) => ({ shown: r.shown, lost: r.focus === 'BODY' })),
        { shown: false, lost: false },
        'Routes: Dismiss hides the note without dropping focus'
      );
      await page.evaluate(() => (window.location.hash = '#nonsense'));
      await page.waitForFunction(() => !document.getElementById('ui-route-note').hidden);
      await page.getByRole('button', { name: 'Instrument', exact: true }).first().click();
      assert.equal((await note()).shown, false, 'Routes: opening another page clears the note');
      // The standalone map: Try again keeps the keyboard and says it in words.
      let atlasDown = true;
      await page.route('**/api/traditions/index.json', (route) =>
        atlasDown ? route.abort('internetdisconnected') : route.continue()
      );
      await page.goto(base + '/atlas.html');
      const again = page.locator('[data-act="reload"]');
      await again.waitFor({ timeout: 20000 });
      assert.doesNotMatch(
        await page.locator('#loading').innerText(),
        /Failed to fetch|\.json|\b\d{3}\b/,
        'Map: a failed load says what happened in words, not a raw error'
      );
      await again.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(
        () => /Still couldn/.test(document.getElementById('loading')?.textContent || ''),
        null,
        { timeout: 20000 }
      );
      assert.equal(
        await page.evaluate(
          () => document.activeElement?.dataset?.act || document.activeElement?.tagName
        ),
        'reload',
        'Map: a Try again that fails again keeps focus on Try again'
      );
      atlasDown = false;
      await page.keyboard.press('Enter');
      await page.locator('.rowbtn').first().waitFor({ state: 'attached', timeout: 30000 });
      await page
        .waitForFunction(() => document.activeElement?.id === 'search', null, { timeout: 5000 })
        .catch(() => {});
      assert.equal(
        await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName),
        'search',
        'Map: a Try again that loads the map lands on the search'
      );
      console.log(
        'PASS error states at 1280px: Retry focus and words, empty search said once, unmatched links said'
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
      // Find a sound speaks once a change settles: the targets and the count,
      // not the same status sentence on every step (Jony #110).
      await page.locator('#surface-genre input[type="range"][data-axis]:visible').first().waitFor();
      assert.equal(
        await page.locator('#gp-sound-status').getAttribute('role'),
        null,
        'Find a sound: the visible status line is not itself a live region'
      );
      const slider = page.locator('#surface-genre input[type="range"][data-axis]:visible').first();
      await slider.focus();
      for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(900);
      assert.match(
        await page.evaluate(() => document.getElementById('gp-live')?.textContent || ''),
        /^1 target applied\. [\d,]+ genres?\.$/,
        'Find a sound: one line with the targets and the result count after the steps settle'
      );
      await page.locator('#surface-genre [data-ui="genre-sound-reset"]').first().click();
      await page.waitForTimeout(900);
      assert.match(
        await page.evaluate(() => document.getElementById('gp-live')?.textContent || ''),
        /^Sound targets cleared\./,
        'Find a sound: Reset says the targets were cleared'
      );
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
      // The inspector's own Add names the instrument by its display name too
      // (Jony #111: "Added aburukuwa…", its internal short key).
      const odd = await page.evaluate(
        () =>
          Object.keys(window.INSTRUMENT_INDEX || {}).find((i) => {
            const x = InstLite(i);
            return x && x.short && x.name && x.short !== x.name;
          }) || 'aburukuwa'
      );
      await page.evaluate((i) => uiInspectInstrument(i), odd);
      await page.locator('[data-ui="ip-add-configured"]').waitFor();
      await page.evaluate(() => (document.getElementById('toast').textContent = ''));
      await page.locator('[data-ui="ip-add-configured"]').click();
      await page.waitForFunction(
        () => /Added/.test(document.getElementById('toast').textContent),
        null,
        {
          timeout: 20000,
        }
      );
      const added = await page.evaluate(
        (i) => ({ text: document.getElementById('toast').textContent, name: InstLite(i)?.name }),
        odd
      );
      assert.ok(
        added.name && added.text.includes('Added ' + added.name),
        'Inspector Add: the toast names the display name: ' + JSON.stringify(added)
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
    for (const width of [1280, 390]) {
      // Your recipe: a menu is one Tab stop that Tab leaves closed; the
      // Recording environment rows move focus into what they open; a move or
      // remove that hands the environment to another card says so (#85–#87).
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.evaluate(async () => {
        await uiAddGenre('delta_blues');
        await uiAddGenre('bluegrass');
      });
      await settle(page);
      const focused = () =>
        page.evaluate(() => {
          const a = document.activeElement;
          return {
            tag: a.tagName,
            env: a.closest('[data-toggle-env]')?.dataset.toggleEnv || '',
            stage: a.dataset.editChain || '',
          };
        });
      const said = () =>
        page
          .waitForFunction(() => document.getElementById('ui-live')?.textContent, null, {
            timeout: 3000,
          })
          .then(
            () => page.evaluate(() => document.getElementById('ui-live').textContent),
            () => '(nothing said)'
          );
      // On a phone Your recipe is the Recipe sheet.
      if (width < 900) await page.locator('[data-ui="session"]').click();
      const toggle = page.locator('[data-menu-toggle][aria-label="Bluegrass actions"]').first();
      await toggle.focus();
      await page.keyboard.press('Enter');
      await settle(page);
      const items = await page
        .locator('.sb-menu:not([hidden]) [role="menuitem"]')
        .evaluateAll((els) => els.map((el) => el.tabIndex));
      assert.ok(
        items.length > 1 && items.every((t) => t === -1),
        `Menus at ${width}px: items are not Tab stops (${items})`
      );
      await page.keyboard.press('Tab');
      await settle(page);
      assert.equal(
        await toggle.getAttribute('aria-expanded'),
        'false',
        `Menus at ${width}px: Tab out of a menu closes it`
      );
      await toggle.focus();
      await page.keyboard.press('Enter');
      await settle(page);
      assert.equal(
        await toggle.getAttribute('aria-expanded'),
        'true',
        `Menus at ${width}px: the trigger's next Enter opens the menu again`
      );
      await page.locator('.sb-menu:not([hidden]) [data-move-trad-up="bluegrass"]').click();
      assert.match(
        await said(),
        /^Bluegrass now leads\. The recording environment now comes from .+ \(Bluegrass\)\.$/,
        `Environment at ${width}px: moving a group up says the environment moved`
      );
      await page.evaluate(() => (document.getElementById('ui-live').textContent = ''));
      // Removing a genre asks nothing (Undo restores it).
      await page.locator('[data-menu-toggle][aria-label="Bluegrass actions"]').first().click();
      await page.locator('.sb-menu:not([hidden]) [data-delete-tradition="bluegrass"]').click();
      assert.match(
        await said(),
        /^Delta blues now leads\. The recording environment now comes from .+ \(Delta blues\)\.$/,
        `Environment at ${width}px: removing the lead group says where the environment went`
      );
      for (const [id, want] of [
        ['room', { env: 'room' }],
        ['tuning', { env: 'tuning' }],
        ['chain', { stage: /./ }],
      ]) {
        await page.locator(`.recipe-env-row[data-id="${id}"]`).first().focus();
        await page.keyboard.press('Enter');
        await settle(page);
        const f = await focused();
        assert.ok(
          f.tag !== 'BODY' && (want.env ? f.env === want.env : want.stage.test(f.stage)),
          `Environment at ${width}px: the ${id} row moves focus into what it opened: ` +
            JSON.stringify(f)
        );
      }
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(`PASS recipe menus, environment rows and hand-over at ${width}px`);
      await context.close();
    }
    for (const width of [1280, 390]) {
      // Session flows (Jony #91, #92): an empty copy name is said at the field;
      // Tab leaves the More menu closed behind it; a finished Import closes the
      // menu and hands focus back to More.
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.evaluate(() => {
        app.lyrics = 'a line';
        document.getElementById('btn-save').click();
      });
      await page.locator('#modal-save.open').waitFor();
      await page.locator('#save-name').fill('');
      await page.locator('#save-name').press('Enter');
      const empty = await page.evaluate(() => {
        const f = document.getElementById('save-name');
        const err = document.getElementById('save-name-error');
        return {
          invalid: f.getAttribute('aria-invalid'),
          described: (f.getAttribute('aria-describedby') || '').split(' ').includes(err?.id),
          shown: !!err && !err.hidden && !!err.getClientRects().length,
          focus: document.activeElement === f,
        };
      });
      assert.deepEqual(
        empty,
        { invalid: 'true', described: true, shown: true, focus: true },
        `Save copy at ${width}px: an empty name is marked and explained at the field`
      );
      await page.locator('#save-name').type('Copy');
      assert.deepEqual(
        await page.evaluate(() => ({
          invalid: document.getElementById('save-name').getAttribute('aria-invalid'),
          hidden: document.getElementById('save-name-error').hidden,
        })),
        { invalid: null, hidden: true },
        `Save copy at ${width}px: typing a name clears the error`
      );
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('#modal-save.open'));
      // Tab out of the More menu closes it.
      await page.locator('[data-ui="menu"]').click();
      await page.locator('#ui-menu:not([hidden])').waitFor();
      await page.evaluate(() => {
        const items = [...document.querySelectorAll('#ui-menu button')].filter(
          (b) => !b.disabled && b.getClientRects().length
        );
        items.at(-1).focus();
      });
      await page.keyboard.press('Tab');
      const tabbed = await page.evaluate(() => ({
        hidden: document.getElementById('ui-menu').hidden,
        expanded: document.querySelector('[data-ui="menu"]').getAttribute('aria-expanded'),
        inMenu: document.getElementById('ui-menu').contains(document.activeElement),
      }));
      assert.deepEqual(
        tabbed,
        { hidden: true, expanded: 'false', inMenu: false },
        `More menu at ${width}px: Tab out of it closes it`
      );
      // A finished Import closes the menu and returns focus to More.
      await page.locator('[data-ui="menu"]').click();
      await page.locator('#ui-menu:not([hidden])').waitFor();
      const chooser = page.waitForEvent('filechooser');
      await page.locator('#ui-menu [data-ui="import"]').click();
      await (
        await chooser
      ).setFiles({
        name: 'session.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ version: 1, name: 'Imported', cards: [] })),
      });
      await page.waitForFunction(() =>
        /Session imported/.test(document.getElementById('toast').textContent)
      );
      const imported = await page.evaluate(() => ({
        hidden: document.getElementById('ui-menu').hidden,
        focus: document.activeElement?.dataset.ui || document.activeElement?.tagName,
      }));
      assert.deepEqual(
        imported,
        { hidden: true, focus: 'menu' },
        `More menu at ${width}px: a finished Import closes it and focuses More`
      );
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(`PASS session flows at ${width}px: Save copy name, More menu Tab and Import`);
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
      // #113: the Instrument inspector at 320×256 — its title, tabs and Add
      // can each be brought on screen, and nothing covers them there.
      const { context, page, errors } = await reflowPage(320, 256);
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.evaluate(() => uiInspectInstrument('voice'));
      await page.locator('#ip-title').waitFor({ state: 'attached' });
      await settle(page);
      for (const s of ['#ip-title', '.ip-tabs [role="tab"]', '[data-ui="ip-add-configured"]']) {
        const seen = await page.evaluate((sel) => {
          const e = document.querySelector(sel);
          if (!e) return null;
          e.scrollIntoView({ block: 'nearest' });
          const b = e.getBoundingClientRect();
          const hit = document.elementFromPoint(
            b.left + Math.min(8, b.width / 2),
            b.top + b.height / 2
          );
          return {
            top: b.top,
            bottom: b.bottom,
            height: b.height,
            on: !!hit && (e === hit || e.contains(hit)),
          };
        }, s);
        assert.ok(
          seen && seen.height > 0 && seen.top >= -1 && seen.bottom <= 257 && seen.on,
          `Instrument inspector at 320×256: ${s} can be brought on screen, uncovered: ` +
            JSON.stringify(seen)
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
      await settle(page);
      const dialogHeight = () =>
        page.evaluate(
          () => document.querySelector('#modal-save .modal').getBoundingClientRect().height
        );
      const before = await dialogHeight();
      await page.evaluate(() =>
        showToast('Imported 3 instruments into Your recipe', 'success', {
          label: 'Undo',
          run() {},
        })
      );
      await page.waitForFunction(() => document.getElementById('toast').classList.contains('show'));
      await settle(page);
      // The dialog keeps its size (never shrunk for the toast), and each of
      // its controls is what a click there reaches: the toast is under it.
      assert.ok(
        (await dialogHeight()) >= before - 1,
        `The Save dialog is not shrunk by a toast at 320×256: ${before} → ${await dialogHeight()}`
      );
      for (const s of ['#save-name', '#save-confirm', '#modal-save [data-close="modal-save"]']) {
        const top = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          el.scrollIntoView({ block: 'nearest' });
          const b = el.getBoundingClientRect();
          const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          return el === hit || el.contains(hit);
        }, s);
        assert.ok(top, `A toast does not cover ${s} in the open Save dialog at 320×256`);
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
      // A short window: the toast stays inside it, top and bottom.
      await page.setViewportSize({ width: 320, height: 256 });
      await settle(page);
      const shortToast = await page.evaluate(() => {
        const b = document.getElementById('toast').getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, h: innerHeight };
      });
      assert.ok(
        shortToast.top >= 0 && shortToast.bottom <= shortToast.h,
        'With the banner up at 320×256 the toast stays on screen: ' + JSON.stringify(shortToast)
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
    for (const width of [1280, 390]) {
      // Map focus and speech (Jony #101, #102, #104, #105 on #519): an In view
      // pick lands on the card's title; the count is said once a move
      // settles; Open on the Genre page leaves the hidden frame for the
      // genre's heading; an embedded Add is said once, by the shell.
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const recordLive = (frame) =>
        frame.evaluate(() => {
          window.__said = [];
          const live = document.getElementById('map-live');
          new MutationObserver(() => {
            if (live.textContent) window.__said.push(live.textContent);
          }).observe(live, { childList: true, characterData: true, subtree: true });
        });
      await page.goto(base + '/atlas.html');
      await page.locator('#list .rowbtn[data-tid]').first().waitFor({ state: 'attached' });
      assert.equal(
        await page.locator('#count').getAttribute('role'),
        null,
        `Map at ${width}px: the count is not itself a live region`
      );
      if (!(await page.locator('#list .rowbtn[data-tid]').first().isVisible()))
        await page.locator('#t-inview').click();
      // Let the first view's count be said before recording the pick's.
      await page.waitForTimeout(900);
      await recordLive(page);
      await page.locator('#list .rowbtn[data-tid]').first().focus();
      await page.keyboard.press('Enter');
      await page.locator('#card-title').waitFor();
      await page.waitForTimeout(1500);
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'card-title',
        `Map at ${width}px: an In view pick lands on the card's title`
      );
      const pickSaid = await page.evaluate(() => window.__said.filter((t) => / on map$/.test(t)));
      assert.ok(
        pickSaid.length <= 1,
        `Map at ${width}px: the count is said at most once per fly-to: ` + JSON.stringify(pickSaid)
      );
      await page.keyboard.press('Escape');
      await page.locator('#canvas-host').focus();
      await page.evaluate(() => (window.__said = []));
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(1500);
      const panSaid = await page.evaluate(() => window.__said.filter((t) => / on map$/.test(t)));
      assert.ok(
        panSaid.length <= 1,
        `Map at ${width}px: three pan steps say the count once: ` + JSON.stringify(panSaid)
      );
      // Embedded: Open on the Genre page, and Add.
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.evaluate(() => uiNavigate('map', { push: true }));
      const atlas = page.frameLocator('#map-frame');
      await atlas.locator('#list .rowbtn[data-tid]').first().waitFor({ state: 'attached' });
      const frame = page.frames().find((f) => f.url().includes('atlas.html'));
      await atlas.getByLabel('Search traditions').fill('flamenco');
      await atlas.locator('#results [data-tid]').first().click();
      await atlas.locator('#card [data-act="add"]').waitFor();
      await recordLive(frame);
      await atlas.locator('#card [data-act="add"]').click();
      await page.waitForFunction(() =>
        /Imported/.test(document.getElementById('toast').textContent)
      );
      await page.waitForTimeout(600);
      assert.deepEqual(
        await frame.evaluate(() => window.__said.filter((t) => /^Added /.test(t))),
        [],
        `Map at ${width}px: an embedded Add is said by the shell's toast only`
      );
      await atlas.getByRole('button', { name: 'Open on the Genre page', exact: true }).click();
      await page.waitForFunction(() => document.body.dataset.view === 'genre');
      await page.waitForTimeout(200);
      assert.equal(
        await page.evaluate(() => document.activeElement?.id),
        'gp-detail-title',
        `Map at ${width}px: Open on the Genre page lands on the genre's heading`
      );
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(`PASS map focus and speech at ${width}px`);
      await context.close();
    }
    for (const width of [1280, 390]) {
      // A catalogue search lists its best name match first (Jony #114) and
      // ArrowDown in the search box goes to it (#115), in the default Rows.
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.route('https://mcp.codexmusica.com/**', (route) =>
        route.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const first = async (sel) => {
        const shown = (s) =>
          [...document.querySelectorAll(s)].find((e) => e.getClientRects().length);
        await page.waitForFunction(shown, sel);
        return (await page.evaluateHandle(shown, sel)).evaluate((e) => e?.textContent);
      };
      await page.goto(base + '/codex.html');
      await page.locator('.catalog-row, .cm-tile').first().waitFor();
      await page.getByLabel('Search genres').fill('bluegrass');
      await settle(page);
      const genreSel = '#genre-list .cm-tile-name, #genre-list .gp-open';
      assert.equal(
        await first(genreSel),
        'Bluegrass',
        `Search at ${width}px: "bluegrass" lists Bluegrass first`
      );
      await page.getByLabel('Search genres').press('ArrowDown');
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent),
        'Bluegrass',
        `Search at ${width}px: ArrowDown from Search genres lands on the first result`
      );
      await page.goto(base + '/codex.html#instrument');
      await page.locator('#instrument-search').waitFor();
      await page.waitForFunction(() => document.querySelector('#instrument-body .ip-list'));
      await page.fill('#instrument-search', 'oud');
      await settle(page);
      const instSel = '#instrument-body .cm-tile-name, #instrument-body .ip-row-main';
      assert.match(
        (await first(instSel)) || '',
        /^Oud\b/,
        `Search at ${width}px: "oud" lists an Oud first`
      );
      // ʿŪd's folded name reads "ud"; its id "oud" ranks it with the names
      // that start with the query (Jony, #519).
      assert.ok(
        await page.evaluate(() =>
          [...document.querySelectorAll('#instrument-body [data-ui="instrument-inspect"]')]
            .filter((e) => e.getClientRects().length)
            .slice(0, 3)
            .some((e) => e.dataset.id === 'oud')
        ),
        `Search at ${width}px: "oud" lists ʿŪd (id oud) in the first three`
      );
      // Within a tier a name match leads an id match: "ud" no longer leads with
      // an instrument whose id starts "udmurt" (Jony, #519), and ʿŪd stays near
      // the top with the names that start "ud".
      await page.fill('#instrument-search', 'ud');
      await settle(page);
      const udIds = await page.evaluate(() =>
        [...document.querySelectorAll('#instrument-body [data-ui="instrument-inspect"]')]
          .filter((e) => e.getClientRects().length)
          .slice(0, 3)
          .map((e) => e.dataset.id)
      );
      assert.ok(
        udIds[0] !== 'udmurt_kubyz' && udIds.includes('oud'),
        `Search at ${width}px: "ud" leads with name matches, ʿŪd among them: ` +
          JSON.stringify(udIds)
      );
      await page.fill('#instrument-search', 'oud');
      await settle(page);
      await page.press('#instrument-search', 'ArrowDown');
      assert.match(
        await page.evaluate(() => document.activeElement?.textContent || ''),
        /^Oud\b/,
        `Search at ${width}px: ArrowDown from Search instruments lands on the first result`
      );
      assert.deepEqual(errors, [], 'No browser errors');
      console.log(`PASS catalogue search rank and ArrowDown at ${width}px`);
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
