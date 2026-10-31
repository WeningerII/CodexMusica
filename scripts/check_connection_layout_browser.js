#!/usr/bin/env node
'use strict';
/* global window, document, requestAnimationFrame, MouseEvent, KeyboardEvent */
// The poem geometry lifecycle with the real pieces in Chromium: the actual
// connection views (layoutPoem, 3PO's contract), marks and interaction model,
// mounted by the actual bindings (src/library/connection-bindings.js), which
// own when layout runs. The poem's font arrives late, from a route held back
// on purpose, and is much wider than the fallback, so a mark measured before
// it arrived sits visibly off its word.
//
//   node scripts/check_connection_layout_browser.js
//
// Needs one local font file for the late font: the first of FONT_FILES that
// exists, or CONNECTION_SLOW_FONT=/path/to/font.ttf. Never skips: a missing
// font is a failure that says so.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const FONT_FILES = [
  process.env.CONNECTION_SLOW_FONT,
  '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf',
  '/System/Library/Fonts/Supplemental/Courier New.ttf',
].filter(Boolean);
const fontFile = FONT_FILES.find((f) => fs.existsSync(f));
if (!fontFile) {
  console.error(
    'CONNECTION LAYOUT: FAIL — no font file for the late font; set CONNECTION_SLOW_FONT'
  );
  process.exit(1);
}
// The views' own authored fixture, taken from their test so this check never
// drifts from it; its poem has exact UTF-16 ranges and no fixture boxes.
const viewsTest = read('scripts/test_connection_views.js');
const start = viewsTest.indexOf('function authoredFixture(I) {');
const fixture = viewsTest.slice(start, viewsTest.indexOf('\n}\n', start) + 2);
assert.ok(start > 0 && fixture.length > 200, 'authoredFixture found in the views test');

const DELAY = 1200;
const PAGE = `<!doctype html><html data-theme="light"><head><style>
@font-face { font-family: "Late Wide"; src: url("/late.ttf"); }
.cv-poem-line { font-family: "Late Wide", serif !important; }
</style></head><body><main id="surface-library"></main></body></html>`;

async function open(browser, { preload }) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let release;
  const held = new Promise((r) => (release = r));
  await page.route('**/late.ttf', async (route) => {
    await held;
    route.fulfill({ body: fs.readFileSync(fontFile), contentType: 'font/ttf' });
  });
  await page.route('http://cm.test/', (route) =>
    route.fulfill({ body: PAGE, contentType: 'text/html' })
  );
  await page.goto('http://cm.test/');
  await page.addStyleTag({ content: read('src/theme.css') });
  await page.addScriptTag({ content: read('src/connection-interaction.js') });
  await page.addScriptTag({
    content: `window.marks = (function(){${read('src/library/marks.js')}\n})();
window.views = (function(){${read('src/library/connection-views.js')}\n})();
window.bindings = (function(){${read('src/library/connection-bindings.js')}\n})();
window.fixture = ${fixture};`,
  });
  // preload: the font is already being fetched when the bindings mount, so
  // they take the fonts.ready path; otherwise they lay out at once with the
  // fallback and the late font's loadingdone lays the poem out again.
  await page.evaluate((preload) => {
    if (preload) document.fonts.load('16px "Late Wide"');
    const I = window.CMConnectionInteraction;
    window.m = window.bindings.mount(document.getElementById('surface-library'), {
      ci: I,
      marks: window.marks,
      createViews: window.views.createViews,
      model: window.fixture(I),
      current: {
        analysisIdentity: 'fixture',
        hasEntity: () => true,
        hasMethod: () => true,
        hasEvidence: () => false,
      },
      view: 'poem',
      narrow: () => false,
    });
  }, preload);
  return { page, errors, release: () => release() };
}

// Every occurrence mark against its word's rendered extent, now.
const offsets = (page) =>
  page.evaluate(() => {
    const I = window.CMConnectionInteraction;
    const root = document.querySelector('#surface-library .cv-root');
    const model = window.m.model();
    return model.occurrences.map((o) => {
      const line = root.querySelectorAll('.cv-poem-line')[o.line - 1];
      const r = model.poem.ranges[o.entity_id];
      const first = line.getExtentOfChar(r.start),
        last = line.getExtentOfChar(r.end - 1);
      const g = [...root.querySelectorAll('g[data-selection]')].find(
        (n) => n.dataset.selection === I.selectionKey(I.occurrence(o.entity_id))
      );
      const rect = g && g.querySelector('rect');
      return {
        id: o.entity_id,
        dx: rect ? Math.abs(+rect.getAttribute('x') - first.x) : Infinity,
        dw: rect
          ? Math.abs(+rect.getAttribute('width') - (last.x + last.width - first.x))
          : Infinity,
      };
    });
  });
const fontsIn = (page) =>
  page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('16px "Late Wide"')));
const frames = (page) =>
  page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  );
const focused = (page) => page.evaluate(() => document.activeElement.dataset.selection || '');
const keyOf = (page, id) =>
  page.evaluate(
    (id) =>
      window.CMConnectionInteraction.selectionKey(window.CMConnectionInteraction.occurrence(id)),
    id
  );
const press = async (page, id) => {
  const key = await keyOf(page, id);
  await page.evaluate((key) => {
    const n = [...document.querySelectorAll('[data-selection]')].find(
      (n) => n.dataset.selection === key
    );
    // Before the late font the poem has no marks yet: select as the URL or
    // another view would, and the bindings owe that mark focus once drawn.
    if (!n) return window.m.select(window.CMConnectionInteraction.selectionFromKey(key));
    n.focus();
    n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, key);
  return key;
};
function aligned(list, label) {
  for (const o of list) {
    assert.ok(o.dx < 0.5, `${label}: ${o.id} box x is ${o.dx.toFixed(2)} off its word`);
    assert.ok(o.dw < 0.5, `${label}: ${o.id} box width is ${o.dw.toFixed(2)} off its word`);
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  let passed = 0;
  const ok = (name) => {
    passed++;
    console.log('PASS ' + name);
  };
  try {
    for (const preload of [true, false]) {
      const how = preload ? 'fonts.ready' : 'loadingdone';
      // 1. The late font: marks follow it, and the focused mark keeps focus.
      {
        const { page, errors, release } = await open(browser, { preload });
        const key = await press(page, 'woods4');
        setTimeout(release, DELAY);
        assert.equal(await fontsIn(page), true, 'the late font arrived');
        await frames(page);
        aligned(await offsets(page), `${how}: after the late font`);
        assert.equal(await focused(page), key, `${how}: focus stays on the replaced mark`);
        assert.deepEqual(errors, []);
        ok(`${how}: marks follow the late font; focus kept on the replaced mark`);
        await page.close();
      }
      // 2. Two renders before the font: only the current one is laid out, right.
      {
        const { page, errors, release } = await open(browser, { preload });
        await press(page, 'woods1');
        const key = await press(page, 'snow');
        setTimeout(release, DELAY);
        await fontsIn(page);
        await frames(page);
        aligned(await offsets(page), `${how}: newest render`);
        assert.equal(await focused(page), key);
        assert.deepEqual(errors, []);
        ok(`${how}: a newer render before the font is the one laid out`);
        await page.close();
      }
      // 3. Destroyed before the font: nothing runs on the detached tree.
      {
        const { page, errors, release } = await open(browser, { preload });
        await page.evaluate(() => window.m.destroy());
        setTimeout(release, DELAY);
        await fontsIn(page);
        await frames(page);
        assert.equal(await page.locator('#surface-library .cv-root').count(), 0);
        assert.deepEqual(errors, []);
        ok(`${how}: destroy before the font measures nothing and throws nothing`);
        await page.close();
      }
    }
    // 5. Phone matrix: the row's button and the hidden desktop cell share a
    // selection key. Tapping a row pair opens the inspector sheet; closing it
    // returns focus to the row button on screen, never to the page.
    {
      const { page, errors, release } = await open(browser, { preload: false });
      release();
      await fontsIn(page);
      await page.setViewportSize({ width: 390, height: 800 });
      const got = await page.evaluate(async () => {
        const I = window.CMConnectionInteraction;
        window.m.destroy();
        window.m = window.bindings.mount(document.getElementById('surface-library'), {
          ci: I,
          marks: window.marks,
          createViews: window.views.createViews,
          model: window.fixture(I),
          current: {
            analysisIdentity: 'fixture',
            hasEntity: () => true,
            hasMethod: () => true,
            hasEvidence: () => false,
          },
          view: 'matrix',
          narrow: () => true,
        });
        window.m.select(I.occurrence('watch'));
        const row = document.querySelectorAll('.cv-phone-row button[data-selection]')[1];
        const key = row.dataset.selection;
        row.focus();
        row.click();
        const opened = document.activeElement.tagName;
        document.activeElement.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        const a = document.activeElement;
        return {
          key,
          opened,
          active: a.dataset.selection || a.tagName,
          visible: a.getClientRects().length > 0,
          inRow: !!a.closest('.cv-phone-row'),
        };
      });
      assert.equal(got.opened, 'H2', 'the sheet takes focus to its heading');
      assert.equal(got.active, got.key, 'Esc returns focus to the tapped pair');
      assert.equal(got.visible && got.inRow, true, 'on the phone row button, not the hidden cell');
      assert.deepEqual(errors, []);
      ok('phone matrix: closing the inspector returns focus to the row button on screen');
      await page.close();
    }
    // 6. Phone matrix with nothing selected offers a word chooser; choosing a
    // word replaces the chooser with that word's row. Closing the inspector
    // then returns focus to the row (a pair with that word), not the page.
    {
      const { page, errors, release } = await open(browser, { preload: false });
      release();
      await fontsIn(page);
      await page.setViewportSize({ width: 390, height: 800 });
      const got = await page.evaluate(() => {
        const I = window.CMConnectionInteraction;
        window.m.destroy();
        window.m = window.bindings.mount(document.getElementById('surface-library'), {
          ci: I,
          marks: window.marks,
          createViews: window.views.createViews,
          model: window.fixture(I),
          current: {
            analysisIdentity: 'fixture',
            hasEntity: () => true,
            hasMethod: () => true,
            hasEvidence: () => false,
          },
          view: 'matrix',
          narrow: () => true,
        });
        const choices = [...document.querySelectorAll('.cv-phone-row button[data-selection]')];
        const pick = choices.find(
          (b) => b.dataset.selection === I.selectionKey(I.occurrence('watch'))
        );
        pick.focus();
        pick.click();
        document.activeElement.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
        );
        const a = document.activeElement;
        const sel = a.dataset.selection && I.selectionFromKey(a.dataset.selection);
        return {
          choices: choices.length,
          inRow: !!a.closest('.cv-phone-row'),
          visible: a.getClientRects().length > 0,
          withWatch: !!sel && I.selectionOccurrences(sel).includes('watch'),
        };
      });
      assert.ok(got.choices > 0, 'the empty phone matrix offers words to choose');
      assert.deepEqual(
        { inRow: got.inRow, visible: got.visible, withWatch: got.withWatch },
        { inRow: true, visible: true, withWatch: true },
        "Esc returns focus to a pair in the chosen word's row"
      );
      assert.deepEqual(errors, []);
      ok('phone matrix: choosing a word keeps focus with its row after the inspector closes');
      await page.close();
    }
    // 7. Phone mode is the CSS's own decision. The views stack at 600 px of
    // their own width (a container query on .cv-root, which pads 24 px a
    // side), so a 610 px host is a phone layout and must get the sheet; a
    // 720 px host is desktop and must not. No narrow() override here.
    {
      const { page, errors, release } = await open(browser, { preload: false });
      release();
      await fontsIn(page);
      const got = await page.evaluate(() => {
        const I = window.CMConnectionInteraction;
        window.m.destroy();
        const at = (px) => {
          const host = document.getElementById('surface-library');
          host.style.width = px + 'px';
          const m = window.bindings.mount(host, {
            ci: I,
            marks: window.marks,
            createViews: window.views.createViews,
            model: window.fixture(I),
            current: {
              analysisIdentity: 'fixture',
              hasEntity: () => true,
              hasMethod: () => true,
              hasEvidence: () => false,
            },
            view: 'matrix',
          });
          const r = {
            sheet: !!host.querySelector('.lib-cb-sheet'),
            phoneRow:
              window.getComputedStyle(host.querySelector('.cv-phone-row')).display !== 'none',
          };
          m.destroy();
          return r;
        };
        return { 610: at(610), 720: at(720) };
      });
      assert.deepEqual(got[610], { sheet: true, phoneRow: true }, '610 px: phone layout and sheet');
      assert.deepEqual(got[720], { sheet: false, phoneRow: false }, '720 px: desktop, no sheet');
      assert.deepEqual(errors, []);
      ok("phone mode follows the views' container query, so layout and sheet always agree");
      await page.close();
    }
    // 4. A poem with a missing range says so once, after the selection words.
    {
      const { page, errors, release } = await open(browser, { preload: false });
      release();
      await fontsIn(page);
      await page.evaluate(() => {
        const I = window.CMConnectionInteraction;
        const model = window.fixture(I);
        delete model.poem.ranges.watch;
        window.m.destroy();
        window.m = window.bindings.mount(document.getElementById('surface-library'), {
          ci: I,
          marks: window.marks,
          createViews: window.views.createViews,
          model,
          current: {
            analysisIdentity: 'fixture',
            hasEntity: () => true,
            hasMethod: () => true,
            hasEvidence: () => false,
          },
          view: 'poem',
          narrow: () => false,
        });
      });
      await frames(page);
      const live = page.locator('#surface-library .lib-cb-live');
      assert.equal(
        await live.textContent(),
        'Poem: 1 of 6 words could not be placed, so their connections are not drawn.'
      );
      await press(page, 'woods1');
      await frames(page);
      assert.doesNotMatch(await live.textContent(), /could not be placed/, 'not said again');
      assert.deepEqual(errors, []);
      ok('a missing range is announced once; redraws stay quiet');
      await page.close();
    }
    console.log(
      `CONNECTION LAYOUT: PASS — ${passed} checks with real views and bindings (${path.basename(fontFile)})`
    );
  } catch (e) {
    console.error('CONNECTION LAYOUT: FAIL —', e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
