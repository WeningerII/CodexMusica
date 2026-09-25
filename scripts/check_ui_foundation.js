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
// Usage: node scripts/check_ui_foundation.js [--html=codex.html]
// Exit 0 if every assertion passes, 1 otherwise.

'use strict';
/* global document, window, MutationObserver, getComputedStyle, localStorage, location, parent, app, UI, UI_PAGES, innerHeight, Storage, ROOMS, RECIPE_CHAR_CEILING, Inst, Room, Tradition, addCard, compileRecipeStack, envCardOf, pushHistory, renderAll, uiNavigate, uiSync */
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
    '#ui-menu:not([hidden])', '#workspace-detail', '.modal-bg.open .modal', '.discovery-toolbar'];
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

async function ready(page) {
  await page.waitForFunction(() => typeof UI !== 'undefined' && UI.ready, null, {
    timeout: 60000,
  });
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
      const edited = await page.evaluate(() => {
        app.workspaceName = 'Gate session';
        const c = app.cards[0];
        c.room = typeof ROOMS !== 'undefined' ? ROOMS[1].id : c.room;
        pushHistory();
        renderAll();
        return { room: c.room, id: c.id };
      });
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

      // I. Collapse is remembered and Reset layout clears it.
      stage = 'I. Collapse is remembered';
      await page.click('[data-ui="recipe-collapse"]');
      const collapsedWidth = await page.evaluate(
        () => document.getElementById('workspace-sidebar').getBoundingClientRect().width
      );
      check(collapsedWidth <= 64, `I. collapsing Your recipe left it ${collapsedWidth}px wide`);

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
      await page.click('[data-ui="menu"]');
      await page.click('[data-ui="reset-layout"]');
      const reset = await page.evaluate(
        () => document.getElementById('workspace-sidebar').getBoundingClientRect().width
      );
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
        (await page.locator('#genre-body .catalog-row').count()) > 0,
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
      'Your recipe on the right with its menus, truthful environment source and output format.'
  );
  process.exit(0);
})();
