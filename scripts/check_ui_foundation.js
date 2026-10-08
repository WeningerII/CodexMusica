#!/usr/bin/env node
// check_ui_foundation.js — the shared UI foundation does what docs/ui-foundation.md says.
//
// @covers: theme-preference-honoured, one-recipe-workspace
//
// Drives the SHIPPED page (codex.html, and the atlas it embeds) in Chromium and
// asserts behaviour, not selectors:
//
//   THEME
//   A. The stored preference is on <html> before <body> exists — so before any
//      content can paint — for Light and for Dark. (A theme applied later is a
//      flash of the wrong theme, however brief.)
//   B. The setting in More changes the theme, survives a reload and every route
//      change, and "System" follows the operating system live.
//   C. The atlas embedded in the Map view resolves the same theme, and follows
//      a change made in the app while it is open.
//   D. In Dark, no shell surface carries a hue: header, recipe panel, pages,
//      menu, dialogs and the map backdrop are neutral (R = G = B within 2).
//
//   ONE RECIPE WORKSPACE
//   E. Genre, Instrument and Map show the SAME recipe panel (one DOM node, one
//      state): an edit made on Genre is visible on Instrument and on the Map,
//      and the Map reaches the editor from its "Your recipe" dock.
//   F. A reload restores the session from autosave (Autosaved is shown only
//      after a real write) and Undo/Redo walk that session's edits.
//   G. When the browser refuses the write, the status says Autosave failed —
//      never Autosaved; when another tab takes the autosave over, it says Not
//      autosaved.
//   H. Escape closes the topmost layer only and returns focus to its opener;
//      Back and Forward step between sections; ?trad=<id> opens that genre
//      once, adds nothing, and yields to an explicit #section.
//   I. Collapse is remembered across a reload and cleared by Reset layout.
//   J. Empty and no-results states say so and offer the recovery.
//   K. On a phone, the Recipe sheet over the Map leaves the map on screen.
//   L. A toast's action (Undo, Retry) leaves with the toast: once it fades,
//      nothing at its place takes a click for it.
//   M. Your recipe as a right-hand column (recipe: 'sidebar-right'): right of
//      the page, resizable from its left edge, the editor opening beside it,
//      collapsing to a rail at the right edge; its row menus open, close on
//      Escape back to their trigger and run the editor's commands; Recording
//      environment names the card the recipe really renders it from and opens
//      the editor there; the format selector drives the preview.
//
//   A TO Z
//   N. At a desktop and a phone width, every row of All genres, a Browse
//      branch, All instruments, a family, a family's classes, a class and an
//      instrument search reads A to Z by the name it shows, as before the
//      redesign. Ranked lists keep their rank — a genre search its match tier,
//      a sound target and Similar sounds their distance, the map key and the
//      map's In view their group size, a map search an exact name first — and
//      read A to Z within a tie. Curated orders (the taxonomy's categories,
//      the instrument families, the starter recipes) are not this rule's to
//      change.
//
//   ROWS
//   Q. Rows is the default layout of Genre and Instrument: All genres is one
//      scrolling row per first letter (# for digits), A to Z within it, and
//      All instruments one row per family, largest first (per class inside a
//      family). Rows far below get their cards only when scrolled near; the
//      A–Z bar scrolls to a row and marks it. Hovering a card shows Listen
//      and Add on its photo; its ⋮ opens Add, Listen, Details and Photo
//      credit and Escape returns to it; the photo opens the genre's details;
//      Add puts the genre in Your recipe (✓), and ✓ takes it out; the
//      removal's Undo puts it back, but only while it is the latest change.
//      A jump takes focus to its row; a search starts at the top of its
//      results; sound targets are one ranked row with each card's reason. An
//      instrument's ✓ is about the "Add to" group only. A card's name and line
//      stay inside it. On a touch screen Listen and Add show without a hover,
//      every card control and jump letter is 44px to a thumb, the A–Z bar
//      fades where it continues, and the page never scrolls sideways.
//
//   PHOTOS
//   O. A catalog photo (Instrument inspector; a Genre row, and a genre's
//      details) enlarges on a click, Enter or Space: a modal dialog with the
//      photo scaled up at once, then replaced by the larger copy — never past
//      that copy's natural size, never cropped — and the credit and licence
//      linked to the source page. One click anywhere (the photo or the
//      dimmed page), Escape or Back closes it and focus returns to the photo;
//      Escape closes nothing under it, the page underneath neither moves nor
//      scrolls, closing leaves no history entry behind, and when no larger
//      copy loads the thumb stays. On a phone the photo fits the screen.
//
//   NAV GLYPHS
//   P. The room and preface glyph artwork (api/nav_glyphs.json) is not in the
//      page. With that file refused, the preface browser draws every glyph —
//      the missing ones as their emoji character, none blank — and asks for it
//      at most twice however often it re-renders; once the file is served
//      again, coming back online swaps the artwork in place.
//
// Usage: node scripts/check_ui_foundation.js [--html=codex.html]
// Exit 0 if every assertion passes, 1 otherwise.

'use strict';
/* global document, window, openPrefaceModal, renderPrefaceModalBody, MutationObserver, getComputedStyle, localStorage, location, parent, app, UI, UI_PAGES, innerHeight, Storage, ROOMS, RECIPE_CHAR_CEILING, Inst, Room, Tradition, addCard, compileRecipeStack, envCardOf, pushHistory, renderAll, uiNavigate, uiSync, Catalog, INSTRUMENTS, normalizeSearch, renderGenreDiscovery, gpRenderMain, renderInstrumentDiscovery, computeDistance */
/* global innerWidth, UITheme, uiInspectInstrument, INSTRUMENT_FAMILIES, uiAddGenre, Engine */
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const flags = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const HTML = flags.html || 'codex.html';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
};
function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/' + HTML;
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(f).pipe(res);
  });
}
// Chromium may be preinstalled at a different build than the pinned playwright.
function chromiumPath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  for (const d of fs.readdirSync(base)) {
    if (!/^chromium-\d+$/.test(d)) continue;
    const exe = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

const failures = [];
let checks = 0;
let stage = 'start'; // named in a thrown failure, so a timeout says where
function check(ok, message) {
  checks++;
  if (!ok) failures.push(message);
  return ok;
}
// The first place a list stops reading A to Z, or '' when it never does. A
// ranked list passes { name, key } rows: key ascending comes first (a match
// tier, a distance), and rows with the same key must be A to Z. The collation
// is the app's: English, case- and accent-insensitive.
function azBreak(rows) {
  const az = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' });
  const items = rows.map((r) => (typeof r === 'string' ? { name: r, key: 0 } : r));
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1],
      b = items[i];
    if (a.key > b.key) return `#${i} "${b.name}" ranks above "${a.name}" but follows it`;
    if (a.key === b.key && az(a.name, b.name) > 0)
      return `#${i} "${a.name}" comes before "${b.name}"`;
  }
  return '';
}

// Records data-theme at the moment <body> is inserted, before any script in the
// page body runs and before anything in it can paint.
const FIRST_PAINT_PROBE = () => {
  window.__themeAtBody = null;
  new MutationObserver((records, observer) => {
    for (const r of records)
      for (const n of r.addedNodes)
        if (n.nodeName === 'BODY') {
          window.__themeAtBody = document.documentElement.getAttribute('data-theme');
          observer.disconnect();
        }
  }).observe(document, { childList: true, subtree: true });
};

// Background colours of the shell's surfaces, with anything translucent
// resolved against the canvas beneath it.
const SURFACES = `(() => {
  const out = [];
  const sel = ['body', '.ui-header', '#workspace-sidebar', '.recipe-panel-head', '.ui-surface:not([hidden])',
    '#ui-menu:not([hidden])', '#workspace-detail', '.modal-bg.open .modal'];
  for (const s of sel) for (const el of document.querySelectorAll(s)) {
    if (!el.getClientRects().length) continue;
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\\(([^)]+)\\)/);
    if (!m) continue;
    const [r, g, b, a = 1] = m[1].split(',').map(Number);
    if (a === 0) continue;
    out.push({ sel: s, r, g, b });
  }
  return out;
})()`;

// Remote photos are local PNGs in this gate: a 192px thumb and a 1024px copy
// for anything larger (a Commons rendition or a full image), so no network is
// needed and the two stages can be told apart. The larger copy can be held
// back until release() or refused (fail()).
async function stubPhotos(ctx) {
  const thumb = fs.readFileSync(path.join(ROOT, 'assets/icon-192.png'));
  const large = fs.readFileSync(path.join(ROOT, 'assets/icon-1024.png'));
  const seen = [];
  const refused = [];
  let mode = 'ok',
    gate = null,
    open = () => {};
  await ctx.route(/^https:\/\//, async (route) => {
    if (route.request().resourceType() !== 'image') return route.fallback();
    const u = route.request().url();
    seen.push(u);
    if (/\/\d+px-[^/]+$/.test(u) && !/\/1280px-/.test(u))
      return route.fulfill({ contentType: 'image/png', body: thumb });
    if (mode === 'fail') {
      refused.push(u);
      return route.fulfill({ status: 404, body: '' });
    }
    if (gate) await gate;
    return route.fulfill({ contentType: 'image/png', body: large });
  });
  return {
    requested: () => seen.slice(),
    failed: () => refused.slice(),
    hold() {
      gate = new Promise((resolve) => (open = resolve));
    },
    release() {
      open();
      gate = null;
    },
    fail() {
      mode = 'fail';
    },
  };
}
// Booted, the genre prose merged and the instrument engine (api/engine.json)
// committed, so searches, details and every stage that reads ROOMS,
// INSTRUMENTS, Inst or Room read what the embedded build reads. In the lazy
// shell those tables are empty `let` slots until the engine lands (asked for at
// the first paint, or from <head> for a saved session); a stage run before
// then reads `undefined`, or tests nothing. The state before either arrives
// is check_lazy_app.js's to gate. The embedded build has the engine at load
// (Engine.ready() at once), and a page with no Engine at all predates the
// split.
async function ready(page) {
  await page.waitForFunction(
    () =>
      typeof UI !== 'undefined' &&
      UI.ready &&
      (typeof Catalog === 'undefined' || Catalog.proseLoaded()) &&
      (typeof Engine === 'undefined' || Engine.ready()),
    null,
    { timeout: 60000 }
  );
}
async function loadDelta(page) {
  await page.getByLabel('Search genres').fill('Delta blues');
  await page.click('[data-ui="genre-add"][data-id="delta_blues"]');
  await page.waitForFunction(() => app.cards.length >= 2, null, { timeout: 20000 });
  await page.getByLabel('Search genres').fill('');
}

(async () => {
  if (!fs.existsSync(path.join(ROOT, HTML))) {
    console.error(`UI FOUNDATION: FAIL — ${HTML} not found (build it first)`);
    process.exit(1);
  }
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('UI FOUNDATION: FAIL — playwright not installed (npm ci)');
    process.exit(2);
  }
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const url = base + HTML;
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const pageErrors = [];
  const newPage = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
    // Never reach the AI service from a gate.
    await ctx.route(/mcp\.codexmusica\.com/, (r) =>
      r.fulfill({ contentType: 'application/json', body: '{"ok":true,"enabled":true}' })
    );
    const page = await ctx.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    return { ctx, page };
  };

  try {
    // ── A. before first paint ────────────────────────────────────────────
    stage = 'A. before first paint';
    for (const theme of ['dark', 'light']) {
      const { ctx, page } = await newPage({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
      await ctx.addInitScript((t) => localStorage.setItem('codex-theme', t), theme);
      await ctx.addInitScript(FIRST_PAINT_PROBE);
      await page.goto(url + '#genre');
      await ready(page);
      const at = await page.evaluate(() => window.__themeAtBody);
      check(
        at === theme,
        `A. stored "${theme}" was not applied before first paint (data-theme at <body>: ${at})`
      );
      const frameProbe = await ctx.newPage();
      await frameProbe.goto(base + 'atlas.html');
      const atlasAt = await frameProbe.evaluate(() => window.__themeAtBody);
      check(
        atlasAt === theme,
        `A. atlas.html did not apply stored "${theme}" before first paint (got ${atlasAt})`
      );
      await ctx.close();
    }

    // ── B, D, E, F, H, I: one long session in a desktop window ───────────
    {
      const { ctx, page } = await newPage({ colorScheme: 'light' });
      await page.goto(url + '#genre');
      await ready(page);

      // J (empty). A fresh session shows the empty recipe state, with actions.
      stage = 'J (empty).';
      const empty = await page.evaluate(() => {
        const el = document.getElementById('recipe-empty');
        return el && !el.hidden && el.getClientRects().length
          ? el.querySelectorAll('button').length
          : 0;
      });
      check(empty >= 2, 'J. a new session shows no empty recipe state with its actions');

      // B. the setting.
      stage = 'B. the setting.';
      await page.click('[data-ui="menu"]');
      await page.click('[data-ui="theme"][data-id="dark"]');
      check(
        (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark',
        'B. choosing Dark in More did not switch the theme'
      );
      check(
        (await page.getAttribute('[data-ui="theme"][data-id="dark"]', 'aria-pressed')) === 'true',
        'B. the theme control does not report Dark as the current choice'
      );
      await page.keyboard.press('Escape');

      // E. one workspace across routes. Build a recipe on Genre and edit it.
      stage = 'E. one workspace across routes.';
      await loadDelta(page);
      const marker = await page.evaluate(() => {
        const panel = document.getElementById('workspace-sidebar');
        panel.__gateMarker = 'same-node';
        return app.cards.length;
      });
      // ready() waited for the engine, so ROOMS is the whole table here. The
      // edit must MOVE the room: a guard that left it as it was (as a
      // `typeof ROOMS` fallback does on a lazy page read before the engine)
      // lets every "same state on another route" check below pass on nothing.
      const edited = await page.evaluate(() => {
        app.workspaceName = 'Gate session';
        const c = app.cards[0];
        const from = c.room;
        c.room = ROOMS.find((r) => r.id !== from).id;
        pushHistory();
        renderAll();
        return { room: c.room, from, id: c.id };
      });
      check(
        edited.room && edited.room !== edited.from,
        `E. the room edit did not change the room (${edited.from} → ${edited.room})`
      );
      for (const view of ['instrument', 'map']) {
        await page.click(`button[data-view="${view}"]`);
        await page.waitForTimeout(view === 'map' ? 1500 : 300);
        const state = await page.evaluate((id) => {
          const panel = document.getElementById('workspace-sidebar');
          const r = panel.getBoundingClientRect();
          return {
            same: panel.__gateMarker === 'same-node',
            visible: r.width > 100 && r.height > 40 && r.top < innerHeight,
            cards: document.querySelectorAll('#workspace-sidebar .sb-card').length,
            room: app.cards.find((c) => c.id === id)?.room,
            name: document.getElementById('ws-name-display')?.textContent,
            theme: document.documentElement.dataset.theme,
          };
        }, edited.id);
        check(state.same, `E. ${view} does not show the same recipe panel node`);
        check(state.visible, `E. Your recipe is not reachable on the ${view} page`);
        check(state.cards === marker, `E. ${view} shows ${state.cards} cards, not ${marker}`);
        check(state.room === edited.room, `E. the Genre edit is not the state on ${view}`);
        check(state.name === 'Gate session', `E. the session name differs on ${view}`);
        check(state.theme === 'dark', `B. the theme did not survive the route change to ${view}`);
      }
      // The Map reaches the full editor from its dock.
      stage = 'The Map reaches the full editor from its dock.';
      await page.locator('#workspace-sidebar .sb-card').first().click();
      await page.waitForTimeout(400);
      const editor = await page.evaluate(() => {
        const d = document.getElementById('detail-view');
        const r = d && d.getBoundingClientRect();
        return {
          visible: !!(r && r.width > 200 && r.height > 100),
          tabs: [...document.querySelectorAll('#detail-view .detail-tab')].map((t) =>
            t.textContent.trim()
          ),
        };
      });
      check(editor.visible, 'E. the Map does not open the recipe editor from Your recipe');
      check(
        ['Character', 'Parts', 'Environment', 'Signal chain', 'Output'].every((t) =>
          editor.tabs.includes(t)
        ),
        `E. the editor on the Map lacks a destination (${editor.tabs.join(', ')})`
      );
      // D. neutral dark surfaces, including the map backdrop inside the atlas.
      stage = 'D. neutral dark surfaces';
      const tinted = (await page.evaluate(SURFACES)).filter(
        (s) => Math.max(s.r, s.g, s.b) - Math.min(s.r, s.g, s.b) > 2
      );
      check(
        !tinted.length,
        `D. dark shell surfaces carry a hue: ${tinted.map((s) => `${s.sel} rgb(${s.r},${s.g},${s.b})`).join('; ')}`
      );
      const frame = page.frames().find((f) => f.url().includes('atlas.html'));
      check(!!frame, 'C. the Map view has no atlas frame');
      if (frame) {
        await frame.waitForFunction(() => document.documentElement.dataset.theme, null, {
          timeout: 20000,
        });
        const atlas = await frame.evaluate(() => ({
          theme: document.documentElement.dataset.theme,
          backdrop: getComputedStyle(document.documentElement)
            .getPropertyValue('--cm-map-backdrop')
            .trim(),
        }));
        check(atlas.theme === 'dark', `C. the embedded atlas is "${atlas.theme}", not dark`);
        check(
          /^#0{3,6}$|^#000000$/.test(atlas.backdrop),
          `D. the dark map backdrop is ${atlas.backdrop}`
        );
        await page.click('[data-ui="menu"]');
        await page.click('[data-ui="theme"][data-id="light"]');
        await page.keyboard.press('Escape');
        await frame
          .waitForFunction(() => document.documentElement.dataset.theme === 'light', null, {
            timeout: 5000,
          })
          .catch(() => {});
        check(
          (await frame.evaluate(() => document.documentElement.dataset.theme)) === 'light',
          'C. the embedded atlas did not follow a theme change made in the app'
        );
        // The atlas asks the shell to add a genre and hears how much arrived.
        const reply = await frame.evaluate(
          () =>
            new Promise((resolve) => {
              const on = (e) => {
                if (e.data?.type !== 'genre-added') return;
                window.removeEventListener('message', on);
                resolve(e.data);
              };
              window.addEventListener('message', on);
              parent.postMessage({ type: 'add-genre', id: 'dub' }, location.origin);
              setTimeout(() => resolve(null), 15000);
            })
        );
        check(
          reply && reply.ok === true && reply.added > 0 && reply.expected >= reply.added,
          `E. adding from the Map did not report what arrived (${JSON.stringify(reply)})`
        );
        await page.keyboard.press('Control+z');
      }

      // H. Escape: the menu first, then the editor, each returning focus.
      stage = 'H. Escape: the menu first';
      // A second import collapses the other genre groups; open them again.
      await page.evaluate(() => {
        app.collapsedTraditionGroups.clear();
        renderAll();
      });
      await page.locator('#workspace-sidebar .sb-card').first().click();
      await page.waitForTimeout(300);
      await page.click('[data-ui="menu"]');
      await page.keyboard.press('Escape');
      const afterMenu = await page.evaluate(() => ({
        menu: !document.getElementById('ui-menu').hidden,
        editor: document.body.classList.contains('editor-open'),
        focus: document.activeElement?.dataset?.ui,
      }));
      check(!afterMenu.menu && afterMenu.editor, 'H. Escape in the menu closed more than the menu');
      check(afterMenu.focus === 'menu', 'H. closing the menu did not return focus to More');
      await page.keyboard.press('Escape');
      const afterEditor = await page.evaluate(() => ({
        editor: document.body.classList.contains('editor-open'),
        focus: document.activeElement?.classList.contains('sb-card'),
      }));
      check(!afterEditor.editor, 'H. Escape did not close the editor');
      check(afterEditor.focus, 'H. closing the editor did not return focus to its recipe row');

      // H. Back and Forward step between sections.
      stage = 'H. Back and Forward';
      await page.click('button[data-view="genre"]');
      await page.click('button[data-view="instrument"]');
      await page.goBack();
      await page.waitForTimeout(200);
      check(
        (await page.evaluate(() => UI.view)) === 'genre',
        'H. Back did not return to the previous section'
      );
      await page.goForward();
      await page.waitForTimeout(200);
      check(
        (await page.evaluate(() => UI.view)) === 'instrument',
        'H. Forward did not return to the next section'
      );

      // I. Collapse is remembered and Reset layout clears it, for each
      // presentation: a sidebar collapses to a rail (Genre), the dock to its
      // header (Instrument). They are separate remembered preferences.
      stage = 'I. Collapse is remembered';
      const panelBox = () =>
        page.evaluate(() => {
          const r = document.getElementById('workspace-sidebar').getBoundingClientRect();
          return { width: r.width, height: r.height, mode: document.body.dataset.recipe };
        });
      await page.click('[data-ui="recipe-collapse"]');
      const collapsedDock = await panelBox();
      check(
        collapsedDock.mode === 'dock',
        `I. the Instrument page shows Your recipe as ${collapsedDock.mode}`
      );
      check(
        collapsedDock.height <= 64,
        `I. collapsing the Your recipe dock left it ${collapsedDock.height}px tall`
      );
      await page.click('button[data-view="genre"]');
      await page.click('[data-ui="recipe-collapse"]');
      const collapsed = await panelBox();
      // Either side: Genre may present the column left ('sidebar') or right
      // ('sidebar-right').
      check(
        collapsed.mode.startsWith('sidebar'),
        `I. the Genre page shows Your recipe as ${collapsed.mode}`
      );
      check(collapsed.width <= 64, `I. collapsing Your recipe left it ${collapsed.width}px wide`);

      // F. reload: the session, the theme and the collapse all come back.
      stage = 'F. reload:';
      await page.waitForTimeout(200);
      await page.reload();
      await ready(page);
      const restored = await page.evaluate(() => ({
        name: app.workspaceName,
        cards: app.cards.length,
        theme: document.documentElement.dataset.theme,
        width: document.getElementById('workspace-sidebar').getBoundingClientRect().width,
        status: document.getElementById('ui-autosave').textContent.trim(),
        undo: document.getElementById('btn-undo').disabled,
      }));
      check(restored.name === 'Gate session', 'F. the reload lost the session name');
      check(restored.cards === marker, `F. the reload restored ${restored.cards} cards`);
      check(restored.theme === 'light', 'B. the theme choice did not survive a reload');
      check(restored.width <= 64, 'I. the collapsed recipe panel did not survive a reload');
      check(
        restored.status === 'Autosaved',
        `F. after a reload the status reads "${restored.status}"`
      );
      check(restored.undo, 'F. Undo can step behind the restored session');
      await page.click('button[data-view="instrument"]');
      const restoredDock = await panelBox();
      check(restoredDock.height <= 64, 'I. the collapsed recipe dock did not survive a reload');
      await page.click('[data-ui="menu"]');
      await page.click('[data-ui="reset-layout"]');
      const resetDock = await panelBox();
      check(resetDock.height > 150, 'I. Reset layout did not expand the collapsed recipe dock');
      await page.click('button[data-view="genre"]');
      const reset = (await panelBox()).width;
      check(reset > 150, 'I. Reset layout did not expand the collapsed recipe panel');

      // F. Undo and Redo walk the session's edits.
      stage = 'F. Undo and Redo';
      const before = await page.evaluate(() => app.cards.length);
      await page.evaluate(() => {
        addCard('oud');
        pushHistory();
        renderAll();
      });
      await page.click('#btn-undo');
      check(
        (await page.evaluate(() => app.cards.length)) === before,
        'F. Undo did not revert the last edit'
      );
      await page.click('#btn-redo');
      check(
        (await page.evaluate(() => app.cards.length)) === before + 1,
        'F. Redo did not restore the edit'
      );

      // G. another tab taking the autosave over is reported, never as Autosaved.
      stage = 'G. another tab';
      {
        const other = await ctx.newPage();
        await other.goto(base + 'gate-other-tab');
        await other.evaluate(() =>
          localStorage.setItem(
            'codex-workbench-v1',
            JSON.stringify({ version: 1, name: 'Other tab', cards: [], lyrics: '' })
          )
        );
        await page
          .waitForFunction(() => document.getElementById('storage-conflict'), null, {
            timeout: 5000,
          })
          .catch(() => {});
        const taken = await page.evaluate(() => ({
          text: document.getElementById('ui-autosave').textContent.trim(),
          tone: document.getElementById('ui-autosave').dataset.tone,
          banner: !!document.getElementById('storage-conflict'),
        }));
        check(taken.banner, 'G. another tab took the autosave over and this tab does not say so');
        check(
          taken.text === 'Not autosaved' && taken.tone === 'warning',
          `G. after another tab took the autosave over the status reads "${taken.text}" (${taken.tone})`
        );
        await other.close();
        if (taken.banner) await page.click('[data-ui="keep-session"]');
      }

      // G. a refused write is reported as a failure, never as Autosaved.
      stage = 'G. a refused write';
      await page.evaluate(() => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === 'codex-workbench-v1') throw new Error('QuotaExceededError');
          return set.call(this, k, v);
        };
        app.workspaceName = 'Refused write';
        pushHistory();
        uiSync();
      });
      const failed = await page.evaluate(() => ({
        text: document.getElementById('ui-autosave').textContent.trim(),
        tone: document.getElementById('ui-autosave').dataset.tone,
      }));
      check(
        failed.text === 'Autosave failed' && failed.tone === 'danger',
        `G. a refused autosave reads "${failed.text}" (${failed.tone})`
      );

      // J. no results says why and recovers.
      stage = 'J. no results';
      await page.click('button[data-view="genre"]');
      await page.getByLabel('Search genres').fill('zzzq no such genre');
      const none = await page.evaluate(
        () => document.querySelector('#genre-body .cm-empty')?.textContent || ''
      );
      check(/No genres match/.test(none), 'J. a search with no results does not say so');
      await page.click('[data-ui="genre-clear-search"]');
      check(
        (await page.locator('#genre-body .catalog-row, #genre-body .cm-tile').count()) > 0,
        'J. Clear search did not restore the genre list'
      );
      await ctx.close();
    }

    // ── M. Your recipe: the right-hand column, menus, environment, output ─
    // Genre's reference puts Your recipe on the right. The presentation is
    // switched here the way a page registers it (recipe: 'sidebar-right'), so
    // the shell's side of that contract is gated whichever page adopts it.
    stage = 'M. Your recipe on the right';
    {
      const { ctx, page } = await newPage({ colorScheme: 'light' });
      await page.goto(url + '#genre');
      await ready(page);
      await page.evaluate(() => {
        UI_PAGES.genre.recipe = 'sidebar-right';
        uiNavigate('genre');
      });
      await loadDelta(page);
      const side = await page.evaluate(() => {
        const panel = document.getElementById('workspace-sidebar').getBoundingClientRect();
        const pageBox = document.getElementById('discovery').getBoundingClientRect();
        return { panelLeft: panel.left, panelRight: panel.right, pageRight: pageBox.right };
      });
      check(
        side.panelLeft >= side.pageRight - 1 && side.panelRight >= 1279,
        `M. sidebar-right does not put Your recipe right of the page (${JSON.stringify(side)})`
      );
      const split = page.getByRole('separator', { name: 'Resize recipe sidebar' });
      const w0 = (await page.locator('#workspace-sidebar').boundingBox()).width;
      await split.press('ArrowLeft');
      await page
        .waitForFunction(
          (w) => document.getElementById('workspace-sidebar').getBoundingClientRect().width > w,
          w0,
          { timeout: 5000 }
        )
        .catch(() => {});
      const w1 = (await page.locator('#workspace-sidebar').boundingBox()).width;
      check(w1 > w0, `M. ArrowLeft on the right-hand splitter did not widen it (${w0} → ${w1})`);
      await split.press('Home');
      // The editor opens between the page and Your recipe.
      await page.locator('#workspace-sidebar .sb-card').first().click();
      await page.waitForTimeout(300);
      const between = await page.evaluate(() => {
        const d = document.getElementById('workspace-detail').getBoundingClientRect();
        const p = document.getElementById('workspace-sidebar').getBoundingClientRect();
        return d.width > 200 && d.right <= p.left + 1;
      });
      check(between, 'M. with Your recipe on the right, the editor does not open beside it');
      await page.keyboard.press('Escape');
      // A row's … menu: opens on its items, Escape closes it back to its
      // trigger, and an item runs the editor's own command.
      const trigger = page.locator('.sb-card-row [data-menu-toggle]').first();
      await trigger.click();
      const opened = await page.evaluate(() => ({
        open: !!document.querySelector('.sb-card-row .sb-menu:not([hidden])'),
        focus: document.activeElement?.getAttribute('role'),
      }));
      check(
        opened.open && opened.focus === 'menuitem',
        'M. a row menu did not open onto its items'
      );
      await page.keyboard.press('Escape');
      const closed = await page.evaluate(() => ({
        open: !!document.querySelector('.sb-menu:not([hidden])'),
        editor: document.body.classList.contains('editor-open'),
        focus: document.activeElement?.hasAttribute('data-menu-toggle'),
      }));
      check(
        !closed.open && closed.focus,
        'M. Escape did not close the row menu and return focus to its trigger'
      );
      await trigger.click();
      await page.click('.sb-menu:not([hidden]) [data-card-action="pin"]');
      check(
        (await page.evaluate(() => app.cards.filter((c) => c.pinned).length)) === 1,
        'M. Pin in the row menu did not pin the instrument'
      );
      // Recording environment names the card the recipe renders it from, and
      // Room opens the editor there, on Environment, with the room picker open.
      const env = await page.evaluate(() => {
        const c = envCardOf(app.cards);
        return {
          source: document.querySelector('.recipe-env-source')?.textContent || '',
          inst: Inst(c.instrumentId).name,
          trad: Tradition(c.traditionId)?.name || '',
          room: document.querySelector('[data-ui="recipe-env"][data-id="room"] .recipe-env-value')
            ?.textContent,
          roomName: c.room ? Room(c.room).name : 'Not set',
        };
      });
      check(
        env.source.includes(env.inst) && env.source.includes(env.trad) && env.room === env.roomName,
        `M. Recording environment does not name its real source (${JSON.stringify(env)})`
      );
      await page.click('[data-ui="recipe-env"][data-id="room"]');
      await page.waitForTimeout(300);
      const opensEnv = await page.evaluate(() => ({
        tab: document.querySelector('#detail-view .detail-tab.is-active')?.dataset.tab,
        card: document.getElementById('detail-view')?.dataset.cardId,
        source: envCardOf(app.cards).id,
        picker: envCardOf(app.cards).editingEnv,
      }));
      check(
        opensEnv.tab === 'env' && opensEnv.card === opensEnv.source && opensEnv.picker === 'room',
        `M. Room did not open the editor on the environment's card (${JSON.stringify(opensEnv)})`
      );
      await page.keyboard.press('Escape');
      // The format selector drives the preview (and so Copy recipe).
      await page.selectOption('#sb-recipe-format', 'tags');
      const tags = await page.evaluate(
        () =>
          document.querySelector('#sidebar-recipe-preview .rp-text')?.textContent ===
          compileRecipeStack(app.cards, 'tags', { ceiling: RECIPE_CHAR_CEILING })
      );
      check(tags, 'M. choosing Tags did not show the Tags recipe in the preview');
      await page.selectOption('#sb-recipe-format', 'rich');
      // Collapse leaves a rail at the right edge.
      await page.click('[data-ui="recipe-collapse"]');
      const rail = await page.evaluate(() =>
        document.getElementById('workspace-sidebar').getBoundingClientRect().toJSON()
      );
      check(
        rail.width <= 64 && rail.right >= 1279,
        `M. collapsing the right-hand Your recipe left ${Math.round(rail.width)}px at x=${Math.round(rail.left)}`
      );
      await ctx.close();
    }

    // ── B. System follows the operating system, live ─────────────────────
    stage = 'B. System follows';
    {
      const { ctx, page } = await newPage({ colorScheme: 'dark' });
      await page.goto(url + '#lyrics');
      await ready(page);
      check(
        (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark',
        'B. System did not follow a dark operating system'
      );
      await page.emulateMedia({ colorScheme: 'light' });
      // Wait for the change listener rather than a fixed delay: under a loaded
      // CI runner 150 ms was not always enough for the media event to land.
      await page
        .waitForFunction(() => document.documentElement.dataset.theme === 'light', null, {
          timeout: 5000,
        })
        .catch(() => {});
      check(
        (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light',
        'B. System did not follow the operating system switching to light'
      );
      await ctx.close();
    }

    // ── H. ?trad=<id> opens a genre once and yields to a #section ─────────
    stage = 'H. ?trad= deep link';
    {
      const { ctx, page } = await newPage();
      await page.goto(url + '?trad=delta_blues');
      await ready(page);
      const deep = await page.evaluate(() => ({
        view: UI.view,
        genre: UI.genre,
        cards: app.cards.length,
        search: location.search,
      }));
      check(
        deep.view === 'genre' && deep.genre === 'delta_blues',
        `H. ?trad=delta_blues opened ${deep.view}/${deep.genre}, not the Delta blues genre`
      );
      check(deep.cards === 0, `H. ?trad=delta_blues added ${deep.cards} cards by itself`);
      check(deep.search === '', `H. ?trad= stays in the URL (${deep.search}) to reopen on reload`);
      // A fresh load, not a same-document hash change.
      await page.goto('about:blank');
      await page.goto(url + '?trad=delta_blues#instrument');
      await ready(page);
      check(
        (await page.evaluate(() => UI.view)) === 'instrument',
        'H. ?trad= overrode an explicit #instrument'
      );
      await ctx.close();
    }

    // ── L. a toast's action leaves with the toast ────────────────────────
    stage = 'L. a toast action';
    {
      const { ctx, page } = await newPage({ colorScheme: 'light' });
      await page.goto(url + '#genre');
      await ready(page);
      const actionAt = () =>
        page.evaluate(() => {
          const b = document.querySelector('#toast .toast-action');
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
      const takesClick = (p) =>
        page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.toast-action'), p);
      // Faded on its own.
      await loadDelta(page);
      const undoAt = await actionAt();
      check(!!undoAt, 'L. adding a genre shows no Undo on its toast');
      if (undoAt) {
        check(await takesClick(undoAt), 'L. the Undo of a showing toast does not take a click');
        await page.waitForFunction(
          () => !document.getElementById('toast').classList.contains('show'),
          null,
          { timeout: 15000 }
        );
        await page.waitForTimeout(400);
        check(
          !(await takesClick(undoAt)),
          'L. the Undo of a faded toast still takes a click at its place'
        );
      }
      // Dismissed by its own click.
      const cards = await page.evaluate(() => app.cards.length);
      await page.getByLabel('Search genres').fill('Dub');
      await page.click('[data-ui="genre-add"][data-id="dub"]');
      await page.waitForFunction((n) => app.cards.length > n, cards, { timeout: 20000 });
      const againAt = await actionAt();
      check(!!againAt, 'L. a second addition shows no Undo on its toast');
      if (againAt) {
        await page.click('#toast .toast-action');
        check(
          (await page.evaluate(() => app.cards.length)) === cards,
          'L. the toast Undo did not remove the addition'
        );
        await page.waitForTimeout(400);
        check(!(await takesClick(againAt)), 'L. a used Undo still takes a click at its place');
      }
      await ctx.close();
    }

    // ── N. the lists read A to Z ─────────────────────────────────────────
    // Read from the DOM, at a desktop and a phone width: what a reader scans.
    stage = 'N. A to Z';
    for (const vp of [
      { name: 'desktop', opts: {} },
      {
        name: 'phone',
        opts: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
      },
    ]) {
      const { ctx, page } = await newPage(vp.opts);
      await page.goto(url + '#genre');
      await ready(page);
      const where = (list) => `N. ${vp.name}: ${list}`;
      // Every row of a list, not the first page of it.
      const all = (render) =>
        page.evaluate((fn) => {
          UI.limit = 1e6;
          ({ renderGenreDiscovery, gpRenderMain, renderInstrumentDiscovery })[fn]();
        }, render);
      const names = (sel) =>
        page.$$eval(sel, (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
      // Similar sounds (the featured genre's, open on Start exploring) ranks by
      // distance across the 13 characteristics; the same distance reads A to Z.
      stage = `N. ${vp.name}: Similar sounds`;
      const similar = await page.evaluate(() => {
        const d = document.querySelector('#genre-detail');
        if (!d) return [];
        return [...d.querySelectorAll('#gp-panel-similar [data-ui="genre-select"]')].map((b) => ({
          name: Tradition(b.dataset.id).name,
          key: computeDistance(d.dataset.gpId, b.dataset.id),
        }));
      });
      check(similar.length > 1, where('the featured genre lists no similar sounds'));
      check(
        azBreak(similar) === '',
        where('Similar sounds is not A to Z at equal distance: ' + azBreak(similar))
      );
      stage = `N. ${vp.name}: All genres`;
      await page.click('#genre-maintabs [data-ui="genre-view-tab"][data-id="all"]');
      // The List layout: every row of it, in its order. (Rows is Q.)
      await page.click('[data-ui="genre-layout"][data-id="list"]');
      await all('renderGenreDiscovery');
      const genres = await names('#genre-list .gp-row-name');
      check(
        genres.length === (await page.evaluate(() => Catalog.all().length)),
        where(`All genres shows ${genres.length} rows, not the whole catalog`)
      );
      check(azBreak(genres) === '', where('All genres is not A to Z: ' + azBreak(genres)));
      check(
        /A to Z/.test(await page.textContent('#gp-count')),
        where('All genres does not say it is A to Z')
      );
      stage = `N. ${vp.name}: a branch`;
      await page.evaluate(() =>
        document.querySelector('#genre-browse [data-ui="genre-branch"]').click()
      );
      await all('renderGenreDiscovery');
      const branch = await names('#genre-list .gp-row-name');
      check(branch.length > 1, where('a Browse branch lists no genres'));
      check(azBreak(branch) === '', where('a Browse branch is not A to Z: ' + azBreak(branch)));
      await page.evaluate(() =>
        document.querySelector('#genre-list [data-ui="genre-all"]').click()
      );
      // Search ranks by where the query matches; within each tier, A to Z.
      stage = `N. ${vp.name}: search`;
      await page.getByLabel('Search genres').fill('blues');
      await all('gpRenderMain');
      const found = await page.evaluate(() => {
        const q = normalizeSearch('blues');
        return [...document.querySelectorAll('#genre-list .gp-row-name')].map((e) => {
          const n = normalizeSearch(e.textContent);
          return {
            name: e.textContent,
            key: n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3,
          };
        });
      });
      check(found.length > 1, where('a search for "blues" finds nothing'));
      check(
        azBreak(found) === '',
        where('search results are not A to Z within a match tier: ' + azBreak(found))
      );
      await page.getByLabel('Search genres').fill('');
      // A sound target ranks by distance; the same distance reads A to Z.
      stage = `N. ${vp.name}: a sound target`;
      await page.evaluate(() => document.querySelector('#genre-browse input[data-axis]').click());
      await all('gpRenderMain');
      const near = await page.evaluate(() => {
        const input = document.querySelector('#genre-browse .gp-axis.is-applied input');
        const axis = input.dataset.axis,
          v = Number(input.value);
        return [...document.querySelectorAll('#genre-list .gp-row')].map((row) => ({
          name: row.querySelector('.gp-row-name').textContent,
          key: Math.abs((Catalog.ext(row.dataset.gpId)?.axes?.[axis] ?? 0) - v),
        }));
      });
      check(near.length > 1, where('a sound target lists no genres'));
      check(
        azBreak(near) === '',
        where('sound-target results are not A to Z at equal distance: ' + azBreak(near))
      );
      await page.evaluate(() => document.querySelector('[data-ui="genre-sound-reset"]').click());
      // Instrument: the catalogue, a family, a class and a search, by name.
      stage = `N. ${vp.name}: Instrument`;
      await page.click('button[data-view="instrument"]');
      await page.click('[data-ui="ip-view"][data-id="list"]');
      await all('renderInstrumentDiscovery');
      const insts = await names('#instrument-body .ip-row-name');
      check(
        insts.length === (await page.evaluate(() => INSTRUMENTS.length)),
        where(`All instruments shows ${insts.length} rows, not the whole catalogue`)
      );
      check(azBreak(insts) === '', where('All instruments is not A to Z: ' + azBreak(insts)));
      for (const [label, sel] of [
        ['a family', '#instrument-body [data-ui="instrument-family"][data-id="percussion"]'],
        ['a class', '#instrument-body [data-ui="instrument-class"]'],
      ]) {
        await page.evaluate((s) => document.querySelector(s).click(), sel);
        await all('renderInstrumentDiscovery');
        const rows = await names('#instrument-body .ip-row-name');
        check(rows.length > 1, where(`${label} lists fewer than two instruments`));
        check(azBreak(rows) === '', where(`${label} is not A to Z: ` + azBreak(rows)));
        // The family's classes, by the label on each chip (less its count).
        const classes = (await names('#instrument-body [data-ui="instrument-class"]')).map((c) =>
          c.replace(/ · [\d,]+$/, '')
        );
        check(classes.length > 1, where(`${label} offers fewer than two classes`));
        check(
          azBreak(classes) === '',
          where(`the classes beside ${label} are not A to Z: ` + azBreak(classes))
        );
      }
      await page.evaluate(() => document.querySelector('[data-ui="instrument-all"]')?.click());
      await page.fill('#instrument-search', 'guitar');
      await all('renderInstrumentDiscovery');
      const guitars = await names('#instrument-body .ip-row-name');
      check(guitars.length > 1, where('a search for "guitar" finds nothing'));
      check(azBreak(guitars) === '', where('instrument search is not A to Z: ' + azBreak(guitars)));
      // Map key: largest group first, a tie A to Z by the name shown. London
      // has tied groups at this zoom; the world view is checked too.
      for (const at of ['atlas.html', 'atlas.html?trad=acid_breaks']) {
        stage = `N. ${vp.name}: map key at ${at}`;
        await page.goto(base + at);
        await page.waitForFunction(() => document.querySelector('#legend-key .key-row'), null, {
          timeout: 60000,
        });
        await page.waitForTimeout(1500); // the deep link flies there
        const key = await page.$$eval('#legend-key .key-row', (rows) =>
          rows.map((r) => ({
            name: r.querySelector('.key-name').textContent,
            key: -Number(r.querySelector('.key-n').textContent),
          }))
        );
        check(key.length > 1, where(`the map key at ${at} names fewer than two groups`));
        check(
          azBreak(key) === '',
          where(`the map key at ${at} is not A to Z within a count: ` + azBreak(key))
        );
        // In view: largest region first, a tie A to Z; each region's rows A to Z.
        const inView = await page.$$eval('#list .list-group', (groups) =>
          groups.map((g) => ({
            name: g.querySelector('.list-region > span').textContent,
            key: -Number(g.querySelector('.list-region > .list-n').textContent),
            rows: [...g.querySelectorAll('.rowname')].map((r) => r.textContent),
          }))
        );
        check(inView.length > 0, where(`In view at ${at} lists no region`));
        check(
          azBreak(inView) === '',
          where(`In view at ${at} is not A to Z within a count: ` + azBreak(inView))
        );
        for (const g of inView)
          check(
            azBreak(g.rows) === '',
            where(`In view at ${at}: ${g.name} is not A to Z: ` + azBreak(g.rows))
          );
      }
      // Map search: a name that is exactly the search first, then A to Z.
      stage = `N. ${vp.name}: map search`;
      await page.fill('#search', 'blues');
      await page.waitForFunction(() => document.querySelector('#results .rowname'), null, {
        timeout: 20000,
      });
      const mapHits = await page.$$eval('#results .rowname', (els) =>
        els.map((e) => ({
          name: e.textContent,
          key: e.textContent.toLowerCase() === 'blues' ? 0 : 1,
        }))
      );
      check(mapHits.length > 1, where('a map search for "blues" finds nothing'));
      check(mapHits[0].key === 0, where('a map search for "blues" does not put Blues first'));
      check(
        azBreak(mapHits) === '',
        where('map search results are not A to Z: ' + azBreak(mapHits))
      );
      await ctx.close();
    }

    // ── O. a photo enlarges; one click anywhere puts it back ─────────────
    stage = 'O. photo lightbox';
    {
      // Tall enough that the 1024px copy fits whole: it must then be shown
      // at exactly its natural size.
      const { ctx, page } = await newPage({
        viewport: { width: 1280, height: 1200 },
        colorScheme: 'light',
      });
      const photos = await stubPhotos(ctx);
      const lightbox = () =>
        page.evaluate(() => {
          const d = document.getElementById('ui-lightbox');
          const img = d?.querySelector('img');
          const r = img?.getBoundingClientRect();
          const link = d?.querySelector('figcaption a');
          return {
            open: !!d?.open,
            role: d?.getAttribute('role'),
            modal: d?.getAttribute('aria-modal'),
            label: d?.getAttribute('aria-label') || '',
            src: img?.getAttribute('src') || '',
            width: r ? Math.round(r.width) : 0,
            height: r ? Math.round(r.height) : 0,
            natural: img ? [img.naturalWidth, img.naturalHeight] : [0, 0],
            inView:
              !!r && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
            credit: d?.querySelector('figcaption')?.textContent || '',
            href: link?.href || '',
            focusInside: !!d && d.contains(document.activeElement),
            locked: document.documentElement.classList.contains('cm-lightbox-open'),
          };
        });
      const focusedPhoto = (sel) =>
        page.evaluate((s) => document.activeElement === document.querySelector(s), sel);
      const loaded = (sel) =>
        page.waitForFunction((s) => document.querySelector(s)?.naturalWidth > 0, sel, {
          timeout: 15000,
        });
      await page.goto(url + '#genre');
      await ready(page);
      await page.click('button[data-view="instrument"]');
      await page.evaluate(() => uiInspectInstrument('oud'));
      const hero = '#instrument-preview .ip-media [data-ui="lightbox"]';
      await loaded(hero + ' img');
      const trigger = await page.evaluate((s) => {
        const b = document.querySelector(s);
        return {
          label: b.getAttribute('aria-label'),
          cursor: getComputedStyle(b).cursor,
          href: b.dataset.href,
          thumb: b.querySelector('img').getAttribute('src'),
        };
      }, hero);
      check(
        /^Enlarge photo of .*Ūd/.test(trigger.label) && trigger.cursor === 'zoom-in',
        `O. the inspector photo is not an "Enlarge photo of" control with a zoom-in cursor (${JSON.stringify(trigger)})`
      );
      const pageBox = () =>
        page.evaluate(() => {
          const r = document.getElementById('instrument-preview').getBoundingClientRect();
          const s = document.querySelector('#instrument-preview .ip-insp-scroll');
          return { box: [r.left, r.top, r.width, r.height], scroll: s.scrollTop };
        });
      const before = await pageBox();
      // Open: the thumb at once, scaled up, while the larger copy is held back.
      photos.hold();
      await page.click(hero);
      const thumbStage = await lightbox();
      check(
        thumbStage.open && thumbStage.role === 'dialog' && thumbStage.modal === 'true',
        `O. clicking the photo did not open a modal dialog (${JSON.stringify(thumbStage)})`
      );
      check(
        /^Photo of .*Ūd/.test(thumbStage.label) && thumbStage.focusInside,
        `O. the open photo is unnamed or does not take focus (${thumbStage.label})`
      );
      check(
        /Photo: .+ · .+/.test(thumbStage.credit) && thumbStage.href === trigger.href,
        `O. the enlarged photo lacks its credit and licence linked to the source page (${thumbStage.credit} → ${thumbStage.href})`
      );
      check(
        thumbStage.src === trigger.thumb && thumbStage.width > 192 && thumbStage.inView,
        `O. the thumb is not shown at once, scaled up and on screen (${JSON.stringify(thumbStage)})`
      );
      check(
        photos.requested().some((u) => /\/1280px-/.test(u)),
        'O. no larger copy of the photo was requested once it was opened'
      );
      const during = await pageBox();
      await page.mouse.move(640, 500);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(200);
      const scrolled = await pageBox();
      check(
        thumbStage.locked &&
          JSON.stringify(during.box) === JSON.stringify(before.box) &&
          scrolled.scroll === before.scroll,
        `O. the page under the photo moved or scrolled (${JSON.stringify({ before, during, scrolled })})`
      );
      photos.release();
      await page
        .waitForFunction(
          () => /\/1280px-/.test(document.querySelector('#ui-lightbox img')?.src || ''),
          null,
          { timeout: 10000 }
        )
        .catch(() => {});
      const largeStage = await lightbox();
      check(
        /\/1280px-/.test(largeStage.src) &&
          largeStage.width === largeStage.natural[0] &&
          Math.abs(
            largeStage.width / largeStage.height - largeStage.natural[0] / largeStage.natural[1]
          ) < 0.02,
        `O. the larger copy did not replace the thumb at its natural size, uncropped (${JSON.stringify(largeStage)})`
      );
      // One click anywhere — here the photo itself — closes it.
      await page.click('#ui-lightbox img');
      const closed = await lightbox();
      check(!closed.open && !closed.locked, 'O. a click on the enlarged photo did not close it');
      check(await focusedPhoto(hero), 'O. closing the photo did not return focus to it');
      // Keyboard: Enter opens, Escape closes this layer only.
      await page.keyboard.press('Enter');
      check((await lightbox()).open, 'O. Enter on a focused photo did not enlarge it');
      await page.keyboard.press('Escape');
      const escaped = await page.evaluate(() => ({
        open: document.getElementById('ui-lightbox').open,
        preview: UI.instrumentPreview,
      }));
      check(
        !escaped.open && escaped.preview === 'oud',
        `O. Escape did not close only the photo (${JSON.stringify(escaped)})`
      );
      check(await focusedPhoto(hero), 'O. Escape did not return focus to the photo');
      // Space opens; a click on the dimmed page closes.
      await page.keyboard.press(' ');
      check((await lightbox()).open, 'O. Space on a focused photo did not enlarge it');
      await page.mouse.click(4, 4);
      check(!(await lightbox()).open, 'O. a click on the dimmed page did not close the photo');
      check(await focusedPhoto(hero), 'O. a backdrop click did not return focus to the photo');
      // Back closes the photo and stays in the section; closing by a click
      // left no history entry behind, so Back after it leaves the section.
      await page.click(hero);
      await page.goBack();
      await page.waitForTimeout(300);
      const back = await page.evaluate(() => ({
        open: document.getElementById('ui-lightbox').open,
        view: UI.view,
        preview: UI.instrumentPreview,
      }));
      check(
        !back.open && back.view === 'instrument' && back.preview === 'oud',
        `O. Back did not close the photo in place (${JSON.stringify(back)})`
      );
      await page.goBack();
      await page.waitForTimeout(300);
      check(
        (await page.evaluate(() => UI.view)) === 'genre',
        'O. an enlarged photo left a history entry behind: Back did not return to Genre'
      );

      // Genre (List layout): a row's photo enlarges without opening the row;
      // the photo in a genre's details does too, and keeps the thumb when no
      // larger copy loads. (In Rows a card's photo opens the details: Q.)
      await page.click('[data-ui="genre-layout"][data-id="list"]');
      await page.getByLabel('Search genres').fill('Delta blues');
      const row = '#genre-list .gp-row[data-gp-id="delta_blues"] [data-ui="lightbox"]';
      await page.waitForSelector(row, { timeout: 15000 });
      await loaded(row + ' img');
      // Refuse this source before its first enlargement: a successfully
      // loaded row copy could otherwise satisfy the detail probe from cache.
      photos.fail();
      await page.click(row);
      const fromRow = await page.evaluate(() => ({
        open: document.getElementById('ui-lightbox').open,
        label: document.getElementById('ui-lightbox').getAttribute('aria-label'),
        detail: !!document.getElementById('genre-detail'),
      }));
      check(
        fromRow.open && /Delta blues/i.test(fromRow.label) && !fromRow.detail,
        `O. a Genre row's photo did not enlarge on its own (${JSON.stringify(fromRow)})`
      );
      await page.mouse.click(1270, 1190);
      check(!(await lightbox()).open, 'O. a click anywhere did not close a Genre photo');
      check(await focusedPhoto(row), 'O. closing a Genre row photo did not return focus to it');
      await page.click('#genre-list .gp-row[data-gp-id="delta_blues"] .gp-open');
      const detailPhoto = '#genre-detail .gp-media [data-ui="lightbox"]';
      await page.waitForSelector(detailPhoto, { timeout: 10000 });
      await loaded(detailPhoto + ' img');
      await page.click(detailPhoto);
      await page.waitForTimeout(600);
      const failed = await lightbox();
      const detailThumb = await page.$eval(detailPhoto + ' img', (i) => i.getAttribute('src'));
      check(
        photos.failed().length > 0,
        'O. the fallback test received no refused larger photo request'
      );
      check(
        failed.open && failed.src === detailThumb && failed.natural[0] > 0,
        `O. with no larger copy loading, the enlarged genre photo did not keep its thumb (${JSON.stringify(failed)})`
      );
      await page.keyboard.press('Escape');
      check(
        !(await lightbox()).open &&
          (await page.evaluate(() => !!document.getElementById('genre-detail'))),
        "O. Escape on a genre's enlarged photo closed its details too"
      );
      check(
        await focusedPhoto(detailPhoto),
        "O. closing a genre's photo did not return focus to it"
      );
      // Dark: the frame is a neutral surface, like every other.
      await page.evaluate(() => UITheme.set('dark'));
      await page.click(detailPhoto);
      const frame = await page.evaluate(
        () => getComputedStyle(document.querySelector('#ui-lightbox figure')).backgroundColor
      );
      const [r, g, b] = (frame.match(/\d+/g) || []).map(Number);
      check(
        Math.max(r, g, b) - Math.min(r, g, b) <= 2 && r < 64,
        `O. in Dark the photo's frame is not a dark neutral surface (${frame})`
      );
      await page.keyboard.press('Escape');
      await ctx.close();
    }
    stage = 'O. photo lightbox on a phone';
    {
      const { ctx, page } = await newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await stubPhotos(ctx);
      await page.goto(url + '#instrument');
      await ready(page);
      await page.evaluate(() => uiInspectInstrument('oud'));
      const hero = '#instrument-preview .ip-media [data-ui="lightbox"]';
      await page.waitForFunction(
        (s) => document.querySelector(s)?.naturalWidth > 0,
        hero + ' img',
        { timeout: 15000 }
      );
      await page.tap(hero);
      await page.waitForTimeout(400);
      const phone = await page.evaluate(() => {
        const d = document.getElementById('ui-lightbox');
        const r = d.querySelector('img').getBoundingClientRect();
        const c = d.querySelector('figcaption').getBoundingClientRect();
        return {
          open: d.open,
          img: [r.left, r.right, r.top, r.bottom].map(Math.round),
          caption: [c.left, c.right, c.top, c.bottom].map(Math.round),
          vw: innerWidth,
          vh: innerHeight,
        };
      });
      check(
        phone.open &&
          phone.img[0] >= 8 &&
          phone.img[1] <= phone.vw - 8 &&
          phone.img[1] - phone.img[0] >= phone.vw * 0.8 &&
          phone.caption[0] >= 0 &&
          phone.caption[1] <= phone.vw &&
          phone.caption[3] <= phone.vh,
        `O. on a phone the enlarged photo does not fill the screen's width with its credit on screen (${JSON.stringify(phone)})`
      );
      await page.tap('#ui-lightbox', { position: { x: 10, y: 10 } });
      check(
        !(await page.evaluate(() => document.getElementById('ui-lightbox').open)),
        'O. a tap anywhere did not close the photo on a phone'
      );
      await ctx.close();
    }

    // ── Q. Rows: the Genre and Instrument pages' default layout ───────────
    stage = 'Q. Rows';
    {
      const { ctx, page } = await newPage({ colorScheme: 'light' });
      await stubPhotos(ctx);
      await page.goto(url + '#genre');
      await ready(page);
      const pressed = (sel) => page.$eval(sel, (b) => b.getAttribute('aria-pressed'));
      check(
        (await pressed('[data-ui="genre-layout"][data-id="rows"]')) === 'true',
        "Q. Rows is not the Genre page's default layout"
      );
      await page.click('#genre-maintabs [data-ui="genre-view-tab"][data-id="all"]');
      // A row per first letter, # first, A to Z within each and filed right;
      // together they hold the whole catalog.
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('#genre-list .cm-rows-group')].map((g) => ({
          key: g.dataset.rows,
          label: g.querySelector('.cm-rows-label')?.textContent,
          count: Number(g.querySelector('.cm-rows-count').textContent.replace(/\D/g, '')),
          names: [...g.querySelectorAll('.cm-tile-name')].map((b) => b.textContent),
        }))
      );
      check(
        rows[0]?.label === '#' && rows.some((r) => r.key === 'genre:A' && r.label === 'A'),
        `Q. All genres has no # row first and no A row (${rows.map((r) => r.label).join(' ')})`
      );
      check(
        rows.reduce((n, r) => n + r.count, 0) === (await page.evaluate(() => Catalog.all().length)),
        'Q. the letter rows do not hold the whole catalog between them'
      );
      const fold = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
      for (const r of rows.filter((x) => x.names.length)) {
        check(azBreak(r.names) === '', `Q. row ${r.label} is not A to Z: ${azBreak(r.names)}`);
        const stray = r.names.find((n) => (/[A-Z]/.test(fold(n)) ? fold(n) : '#') !== r.label);
        check(!stray, `Q. "${stray}" is filed under ${r.label}`);
      }
      const zTiles = () =>
        page.$$eval('.cm-rows-track[data-rows="genre:Z"] .cm-tile', (t) => t.length);
      check(
        (await zTiles()) === 0 &&
          (await page.$$eval('#genre-list .cm-tile', (t) => t.length)) <= 12 * 30,
        'Q. rows far below the screen got their cards on first paint'
      );
      // The A–Z bar scrolls a row under itself and marks it; the last row,
      // which cannot reach the top, is marked too, and gets its cards.
      const jump = async (k) => {
        await page.click(`[data-ui="rows-jump"][data-id="genre:${k}"]`);
        await page.waitForTimeout(1200);
        return page.evaluate((key) => {
          const nav = document.querySelector('#genre-maintabs .cm-rows-jump');
          const sec = document.querySelector(`.cm-rows-group[data-rows="genre:${key}"]`);
          return {
            gap: Math.round(sec.getBoundingClientRect().top - nav.getBoundingClientRect().bottom),
            current: nav.querySelector('[aria-current="true"]')?.textContent,
          };
        }, k);
      };
      const z = await jump('Z');
      check(
        z.current === 'Z' && (await zTiles()) > 0,
        `Q. the A–Z bar did not bring the Z row on screen, filled and marked (${JSON.stringify(z)})`
      );
      const m = await jump('M');
      check(
        m.gap >= 0 && m.gap <= 48 && m.current === 'M',
        `Q. the A–Z bar did not bring the M row just under it, marked (${JSON.stringify(m)})`
      );
      // The jump takes focus to that row, so the next Tab goes on into it.
      const inRow = () =>
        page.evaluate(() => [
          document.activeElement?.closest('.cm-rows-group')?.dataset.rows,
          document.activeElement?.className,
        ]);
      const landed = await inRow();
      check(
        landed[0] === 'genre:M' && landed[1] === 'cm-rows-label',
        `Q. after a jump, focus is not on the M row's heading (${landed})`
      );
      await page.keyboard.press('Tab');
      check(
        (await inRow())[0] === 'genre:M',
        `Q. Tab after a jump did not go on into the M row (${await inRow()})`
      );
      // Hover shows Listen and Add on the photo; ⋮ opens the card's menu.
      const card = '.cm-rows-group[data-rows="genre:M"] .cm-tile:nth-child(2)';
      const shown = () =>
        page.$eval(card, (t) =>
          ['.cm-tile-play', '.cm-tile-add'].map((s) => getComputedStyle(t.querySelector(s)).opacity)
        );
      check(
        (await shown()).every((o) => o === '0'),
        'Q. Listen and Add show on a card nobody is pointing at'
      );
      await page.hover(card + ' .cm-tile-shot');
      await page.waitForTimeout(400);
      check(
        (await shown()).every((o) => o === '1'),
        `Q. hovering a card does not show Listen and Add (${await shown()})`
      );
      const id = await page.$eval(card, (t) => t.dataset.id);
      await page.click(card + ' .cm-tile-more');
      const menu = await page.evaluate(() => {
        const m = document.getElementById('cm-tile-menu');
        return {
          open: !m.hidden,
          items: [...m.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent),
          focus: m.contains(document.activeElement),
        };
      });
      check(
        menu.open &&
          menu.focus &&
          ['Add to recipe', 'Listen on YouTube', 'Details'].every((i) => menu.items.includes(i)),
        `Q. ⋮ does not open the card's menu (${JSON.stringify(menu)})`
      );
      await page.keyboard.press('Escape');
      check(
        await page.evaluate(
          (s) =>
            document.getElementById('cm-tile-menu').hidden &&
            document.activeElement === document.querySelector(s + ' .cm-tile-more'),
          card
        ),
        'Q. Escape did not close the card menu back to its ⋮'
      );
      // The photo opens the genre's details; closing them returns to the card.
      await page.click(card + ' .cm-tile-shot', { position: { x: 30, y: 30 } });
      check(
        (await page.evaluate(() => document.getElementById('genre-detail')?.dataset.gpId)) === id,
        "Q. a card's photo did not open that genre's details"
      );
      await page.keyboard.press('Escape');
      check(
        await page.evaluate(
          (i) =>
            !document.getElementById('genre-detail') &&
            document.activeElement?.matches('.cm-tile-name') &&
            document.activeElement.dataset.id === i,
          id
        ),
        'Q. closing the details did not return focus to the card'
      );
      // Add from the card, then ✓ takes it out again.
      await page.hover(card + ' .cm-tile-shot');
      await page.click(card + ' .cm-tile-add');
      await page.waitForFunction((i) => app.cards.some((c) => c.traditionId === i), id, {
        timeout: 20000,
      });
      await page.waitForTimeout(300);
      check(
        await page.$eval(card + ' .cm-tile-add', (b) => b.classList.contains('is-on')),
        'Q. a genre added from its card is not marked ✓ in the row'
      );
      const inRecipe = () => page.evaluate((i) => app.cards.some((c) => c.traditionId === i), id);
      await page.click(card + ' .cm-tile-add');
      await page.waitForTimeout(300);
      check(!(await inRecipe()), 'Q. ✓ on a card did not take the genre out of Your recipe');
      // The removal's Undo puts it back while it is the latest change…
      await page.click('#toast .toast-action');
      await page.waitForTimeout(300);
      check(
        (await inRecipe()) &&
          (await page.$eval(card + ' .cm-tile-add', (b) => b.classList.contains('is-on'))),
        'Q. Undo on the removal did not put the genre back, marked ✓'
      );
      // …and once a later change followed, it undoes nothing: not the later
      // change, and not the removal (owner review).
      await page.click(card + ' .cm-tile-add');
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        app.workspaceName = 'Named after the removal';
        pushHistory();
        uiSync();
      });
      await page.click('#toast .toast-action');
      await page.waitForTimeout(300);
      const late = await page.evaluate(() => ({
        name: app.workspaceName,
        toast: document.getElementById('toast').textContent,
      }));
      check(
        !(await inRecipe()) &&
          late.name === 'Named after the removal' &&
          /Later changes/.test(late.toast),
        `Q. a stale removal Undo changed the recipe (${JSON.stringify(late)})`
      );
      // A card's text stays inside the card, and its line is the genre's branch.
      const spill = await page.evaluate(() => {
        const out = [];
        for (const t of [...document.querySelectorAll('#genre-list .cm-tile')].slice(0, 120)) {
          const sub = t.querySelector('.cm-tile-sub').textContent;
          if (!sub || /^\d+$/.test(sub)) out.push(`${t.dataset.id} reads "${sub}"`);
          const r = t.getBoundingClientRect();
          for (const el of t.querySelectorAll('.cm-tile-name, .cm-tile-sub')) {
            const b = el.getBoundingClientRect();
            if (b.right > r.right + 1 || b.left < r.left - 1) out.push(t.dataset.id);
          }
        }
        return out;
      });
      check(
        spill.length === 0,
        `Q. card text overflows its card or its line is not a branch: ${spill.slice(0, 5)}`
      );
      // A search narrows the rows, from their beginning (not where a jump
      // left the last list); a letter with nothing left has no row.
      await jump('M');
      const scrolled = () => page.evaluate(() => document.getElementById('genre-main').scrollTop);
      const before = await scrolled();
      await page.getByLabel('Search genres').fill('blues');
      const after = await scrolled();
      check(
        before > 0 && after === 0,
        `Q. a search after a jump does not start at the top of its results (${before} → ${after})`
      );
      const narrowed = await page.$$eval('#genre-list .cm-rows-group', (g) =>
        g.map((x) => x.dataset.rows)
      );
      check(
        narrowed.length > 1 && !narrowed.includes('genre:Q') && !narrowed.includes('genre:X'),
        `Q. a search did not narrow the letter rows (${narrowed.join(' ')})`
      );
      await page.getByLabel('Search genres').fill('');
      // Sound targets rank: one row, closest first, each card saying how close.
      await page.evaluate(() => document.querySelector('#genre-browse input[data-axis]').click());
      await page.waitForTimeout(200);
      const near = await page.evaluate(() =>
        [...document.querySelectorAll('#genre-list .cm-rows-group')].map((g) => ({
          label: g.querySelector('.cm-rows-label')?.textContent,
          subs: [...g.querySelectorAll('.cm-tile-sub')].slice(0, 5).map((x) => x.textContent),
        }))
      );
      check(
        near.length === 1 &&
          near[0].label === 'Closest to your sound' &&
          near[0].subs.length &&
          near[0].subs.every((t) => /^(Matches|Exact on)/.test(t)),
        `Q. sound targets in Rows are not one ranked row with the reasons (${JSON.stringify(near)})`
      );
      await page.click('[data-ui="genre-sound-reset"]');
      // Instrument: Rows by default, one row per family, largest first; a
      // family's rows are its classes.
      await page.click('button[data-view="instrument"]');
      check(
        (await pressed('[data-ui="ip-view"][data-id="rows"]')) === 'true',
        "Q. Rows is not the Instrument page's default layout"
      );
      const fams = await page.$$eval('#instrument-body .cm-rows-group', (g) =>
        g.map((x) => Number(x.querySelector('.cm-rows-count').textContent.replace(/\D/g, '')))
      );
      check(
        fams.length === (await page.evaluate(() => INSTRUMENT_FAMILIES.length)) &&
          fams.every((n, i) => !i || n <= fams[i - 1]),
        `Q. All instruments is not one row per family, largest first (${fams})`
      );
      // An instrument card's ✓ is about the "Add to" group only (owner
      // review): Voice in Delta blues and Zydeco is no independent Voice, and
      // with Delta blues chosen, ✓ takes out that one card.
      await page.evaluate(async () => {
        await uiAddGenre('delta_blues');
        await uiAddGenre('zydeco');
      });
      await page.click('#instrument-body [data-ui="instrument-family"][data-id="voice"]');
      const voice = '#instrument-body .cm-tile[data-id="voice"]';
      const addTo = async (v) => {
        await page.selectOption('#instrument-destination', { value: v });
        await page.waitForTimeout(200);
      };
      const voiceAdd = () =>
        page.$eval(voice + ' .cm-tile-add', (b) => ({
          on: b.classList.contains('is-on'),
          label: b.getAttribute('aria-label'),
        }));
      await addTo('');
      const solo = await voiceAdd();
      check(
        !solo.on,
        `Q. with Add to: Independent, Voice (only in genres) shows ✓ (${solo.label})`
      );
      await addTo('delta_blues');
      const inDelta = await voiceAdd();
      check(
        inDelta.on && /Delta blues/.test(inDelta.label),
        `Q. with Add to: Delta blues, Voice is not ✓ for Delta blues (${inDelta.label})`
      );
      await page.hover(voice + ' .cm-tile-shot');
      await page.click(voice + ' .cm-tile-add');
      await page.waitForTimeout(300);
      const voices = await page.evaluate(() =>
        app.cards.filter((c) => c.instrumentId === 'voice').map((c) => c.traditionId)
      );
      check(
        voices.length === 1 && voices[0] === 'zydeco',
        `Q. ✓ on Voice with Add to: Delta blues did not take out that card alone (left: ${voices})`
      );
      await page.click('#instrument-body [data-ui="instrument-family"][data-id="percussion"]');
      const classes = await page.$$eval('#instrument-body .cm-rows-group', (g) =>
        g.map((x) => x.dataset.rows)
      );
      check(
        classes.length > 1 &&
          (await page.$$eval('#instrument-body [data-ui="rows-jump"]', (b) => b.length)) > 1,
        `Q. a family is not a row per class with its jump bar (${classes.join(' ')})`
      );
      await ctx.close();
    }
    stage = 'Q. Rows on a touch screen';
    {
      const { ctx, page } = await newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await stubPhotos(ctx);
      await page.goto(url + '#genre');
      await ready(page);
      await page.tap('#genre-maintabs [data-ui="genre-view-tab"][data-id="all"]');
      const touch = await page.evaluate(() => {
        const t = document.querySelector('#genre-list .cm-tile');
        return {
          controls: ['.cm-tile-play', '.cm-tile-add'].map(
            (s) => getComputedStyle(t.querySelector(s)).opacity
          ),
          arrows: getComputedStyle(document.querySelector('#genre-list .cm-rows-nav')).display,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      check(
        touch.controls.every((o) => o === '1') && touch.arrows === 'none' && touch.overflow <= 0,
        `Q. on a touch screen Listen and Add need a hover, or the page scrolls sideways (${JSON.stringify(touch)})`
      );
      // A thumb's 44px: 21px either side of each control's centre still hits it
      // (the circles are drawn smaller); a jump letter is 44px tall to a
      // thumb; the A–Z bar fades where letters continue past its edge.
      // The photo credits arrive after the first paint (the photo table is
      // fetched once the page has drawn), so wait for one before measuring it.
      await page.waitForSelector('#genre-list .cm-tile-credit', { timeout: 15000 });
      const thumbs = await page.evaluate(() => {
        const t = document.querySelector('#genre-list .cm-tile-credit').closest('.cm-tile');
        t.scrollIntoView({ block: 'center' });
        const hits = (el, dx, dy) => {
          const r = el.getBoundingClientRect(),
            x = r.left + r.width / 2,
            y = r.top + r.height / 2;
          return [
            [x - dx, y],
            [x + dx, y],
            [x, y - dy],
            [x, y + dy],
          ].every(([a, b]) => el.contains(document.elementFromPoint(a, b)));
        };
        const miss = ['.cm-tile-play', '.cm-tile-add', '.cm-tile-more', '.cm-tile-credit'].filter(
          (s) => !hits(t.querySelector(s), 21, 21)
        );
        const nav = document.querySelector('#genre-maintabs .cm-rows-jump');
        if (!hits(nav.querySelector('button:not(:disabled)'), 0, 21)) miss.push('a jump letter');
        return { miss, fades: nav.classList.contains('is-more-end') };
      });
      check(
        thumbs.miss.length === 0 && thumbs.fades,
        `Q. on a touch screen these are under 44px to a thumb, or the A–Z bar gives no sign of more (${JSON.stringify(thumbs)})`
      );
      await ctx.close();
    }

    // ── P. nav glyphs: never blank, fetched with backoff, filled in place ─
    stage = 'P. nav glyphs';
    {
      const { ctx, page } = await newPage();
      let refuse = true;
      let asked = 0;
      await ctx.route(/\/api\/nav_glyphs\.json$/, (route) => {
        asked++;
        return refuse ? route.fulfill({ status: 404, body: '' }) : route.fallback();
      });
      await page.goto(url + '#genre');
      await ready(page);
      await loadDelta(page);
      await page.evaluate(() => openPrefaceModal(app.cards[0]));
      await page.waitForTimeout(400);
      // Re-render as a search does, keystroke by keystroke.
      await page.evaluate(() => {
        for (let i = 0; i < 6; i++) renderPrefaceModalBody();
      });
      await page.waitForTimeout(300);
      const refused = await page.evaluate(() => {
        const glyphs = [...document.querySelectorAll('#preface-modal-body svg.codex-glyph')];
        return {
          total: glyphs.length,
          blank: glyphs.filter((g) => !g.childElementCount).length,
          fallback: glyphs.filter((g) => g.hasAttribute('data-nav-cp')).length,
        };
      });
      check(refused.total > 100, `P. the preface browser drew ${refused.total} glyphs`);
      check(
        refused.blank === 0,
        `P. with api/nav_glyphs.json refused, ${refused.blank} of ${refused.total} preface glyphs are blank`
      );
      check(refused.fallback > 0, 'P. no preface glyph waited on api/nav_glyphs.json');
      check(
        asked >= 1 && asked <= 2,
        `P. api/nav_glyphs.json was asked for ${asked} time(s) across 7 renders (want 1-2)`
      );
      refuse = false;
      await page.evaluate(() => window.dispatchEvent(new Event('online')));
      await page
        .waitForFunction(
          () => !document.querySelector('#preface-modal-body svg[data-nav-cp]'),
          null,
          {
            timeout: 15000,
          }
        )
        .catch(() => {});
      const served = await page.evaluate(() => ({
        waiting: document.querySelectorAll('#preface-modal-body svg[data-nav-cp]').length,
        text: document.querySelectorAll('#preface-modal-body svg.codex-glyph text').length,
      }));
      check(
        served.waiting === 0 && served.text === 0,
        `P. back online, ${served.waiting} preface glyph(s) still wait and ${served.text} still show an emoji character`
      );
      await ctx.close();
    }

    // ── K. a phone: the Recipe sheet leaves the map on screen ────────────
    stage = 'K. a phone';
    {
      const { ctx, page } = await newPage({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      await page.goto(url + '#genre');
      await ready(page);
      await loadDelta(page);
      await page.click('button[data-view="map"]');
      await page.waitForTimeout(800);
      await page.click('[data-ui="session"]');
      await page.waitForTimeout(300);
      const sheet = await page.evaluate(() => {
        const s = document.getElementById('workspace-sidebar').getBoundingClientRect();
        const m = document.getElementById('map-frame').getBoundingClientRect();
        return { sheetTop: s.top, sheetBottom: s.bottom, mapTop: m.top, vh: innerHeight };
      });
      check(
        Math.abs(sheet.sheetBottom - sheet.vh) <= 2,
        'K. the Recipe sheet on the Map is not anchored to the bottom'
      );
      check(
        sheet.sheetTop - sheet.mapTop >= sheet.vh * 0.2,
        `K. the Recipe sheet leaves only ${Math.round(sheet.sheetTop - sheet.mapTop)}px of the map`
      );
      await ctx.close();
    }
  } catch (e) {
    if (process.env.UI_FOUNDATION_DEBUG)
      for (const c of browser.contexts())
        for (const p of c.pages())
          await p.screenshot({ path: process.env.UI_FOUNDATION_DEBUG }).catch(() => {});
    failures.push(`gate threw during "${stage}": ` + String((e && e.message) || e).split('\n')[0]);
  } finally {
    await browser.close();
    server.close();
  }
  checks++;
  if (pageErrors.length) failures.push('uncaught page error: ' + pageErrors[0]);

  if (failures.length) {
    console.error(`UI FOUNDATION: FAIL — ${failures.length} problem(s):`);
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log(
    `UI FOUNDATION: PASS — ${checks} assertions: theme before first paint (app + atlas), ` +
      'persisted across reload and routes, System live, atlas follows, neutral dark surfaces; ' +
      'one recipe panel and editor on Genre, Instrument and Map, Map add reports what arrived, ' +
      'reload restores, Undo/Redo, truthful autosave, layered Escape with focus return, ' +
      'Back/Forward, ?trad= once and below #section, remembered collapse + Reset layout, another tab ' +
      'reported, empty and no-results recovery, phone Map sheet, toast action leaves with the toast, ' +
      'Your recipe on the right with its menus, truthful environment source and output format, ' +
      'genre, instrument and map lists A to Z (within a tie when ranked) on desktop and phone, ' +
      'photos that enlarge and close on a click anywhere, Escape or Back; ' +
      'Rows by default on Genre and Instrument: letter and family rows, the A–Z bar, hover and ' +
      'touch controls, the card menu, details from the photo, Add and ✓; ' +
      'nav glyphs never blank without api/nav_glyphs.json, fetched with backoff, filled in place.'
  );
  process.exit(0);
})();
