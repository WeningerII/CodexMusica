#!/usr/bin/env node
// check_mobile_layout.js — the shipped page must be USABLE on a phone.
//
// @covers: mobile-layout-usable
//
// WHAT THIS GATE LEARNED THE HARD WAY
//
// v1 asserted that the app bar fit. It passed on a build whose phone header was
// seven unlabelled icon squares in a horizontal scroll strip — the app FIT and
// was unusable, and the only route to "add a genre" was an unlabelled glyph.
// Two holes let that through:
//
//   1. it checked 2 of 8 controls, and
//   2. `if (c.hidden) continue;  // deliberately hidden at this width is fine`
//      — so "solve the overflow by hiding the button" scored as a pass.
//
// So the assertions below are about CAPABILITIES, not button ids. A capability
// is satisfied only by a control a thumb can actually hit: on screen, not
// covered, and >= 44px on a phone. Moving a control into the overflow sheet is
// allowed — the gate opens the sheet and re-checks — but hiding it with no
// route at all is a failure, which is exactly what v1 permitted.
//
// Assertions, per viewport:
//   A. layout viewport == device width      (no zoom-out blowout)
//   B. no horizontal document overflow
//   C. every CAPABILITY reachable: visible, on screen, hit-testable, >=44px
//      on phone widths — directly, or behind the overflow trigger
//   D. no two visible header controls overlap
//   E. the app bar stays pinned after scrolling to the bottom
//   F. no icon renders as an empty box (icon() returns '' for unknown names)
//   G. below 900px, the MODEL holds: the genre tree is on screen with no
//      interaction, tapping an instrument expands it INSIDE the tree, and the
//      recipe bar is pinned within the viewport
//      above 900px: the detail mounts in the right-hand pane, as before
//   H. drag and drop works with the viewport's REAL input — a genuine touch
//      gesture on phones, a genuine mouse drag on desktop — and leaves no
//      ghost or highlight behind
//
// ORDERING CONTRACT: A and B are measured BEFORE the page is interacted with.
// A layout broken enough to blow the viewport open also stops Playwright
// clicking through it, so an interaction-first version of this gate dies on a
// click timeout and never prints the measurement that explains why. faults.js
// plants exactly that defect and matches on the measurement text — see its
// `unfittable-header` class.
//
// Usage:
//   node scripts/check_mobile_layout.js [--html=codex.html] [--verbose]
// Exit 0 if every assertion passes, 1 otherwise.

'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const i = a.indexOf('=');
    if (i > 0) flags[a.slice(2, i)] = a.slice(i + 1);
    else flags[a.slice(2)] = true;
  }
}
const HTML = flags.html || 'codex.html';
const VERBOSE = !!flags.verbose;

// 899 is where the layout switches to the single-scrolling-page model.
const MOBILE_MAX = 899;
const TOUCH_MIN = 44;

const VIEWPORTS = [
  { name: 'android-360', width: 360, height: 800, phone: true },
  { name: 'iphone-se-375', width: 375, height: 667, phone: true },
  { name: 'iphone-14-390', width: 390, height: 844, phone: true },
  { name: 'pixel-412', width: 412, height: 915, phone: true },
  { name: 'landscape-844', width: 844, height: 390, phone: true },
  { name: 'tablet-768', width: 768, height: 1024, phone: false },
  { name: 'tablet-820', width: 820, height: 1180, phone: false },
  { name: 'desktop-1280', width: 1280, height: 900, phone: false },
];

// Everything the desktop can do, keyed by what the USER is trying to do. Each
// entry lists the controls that satisfy it; any one reachable control passes.
// `inOverflow` marks capabilities allowed to live behind the #btn-more sheet
// below 900px — the gate opens it and checks the proxy is really tappable.
const CAPABILITIES = [
  { id: 'add-instrument', label: 'add an instrument', sel: ['#btn-add'] },
  { id: 'add-genre', label: 'add a genre', sel: ['#btn-traditions'] },
  { id: 'undo', label: 'undo', sel: ['#btn-undo', '[data-proxy="btn-undo"]'] },
  { id: 'redo', label: 'redo', sel: ['#btn-redo', '[data-proxy="btn-redo"]'] },
  { id: 'copy-recipe', label: 'copy the recipe', sel: ['#sb-recipe-copy'] },
  // A readout, not a target: it must be legible and on screen, but the 44px
  // touch minimum is about what a thumb has to hit, so it does not apply.
  { id: 'recipe-size', label: 'see the recipe size', sel: ['.rp-count'], readout: true },
  {
    id: 'save',
    label: 'save the workspace',
    sel: ['#btn-save', '[data-proxy="btn-save"]'],
    inOverflow: true,
  },
  {
    id: 'saved',
    label: 'open saved workspaces',
    sel: ['#btn-saved', '[data-proxy="btn-saved"]'],
    inOverflow: true,
  },
  {
    id: 'credits',
    label: 'open image credits',
    sel: ['#btn-attributions', '[data-proxy="btn-attributions"]'],
    inOverflow: true,
  },
];

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
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
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    console.error('playwright not installed — run: npm install');
    process.exit(2);
  }
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

// Measures one control: is it laid out, on screen, and does a tap at its centre
// actually land on it? `hittable` is the assertion that matters — a control can
// be perfectly positioned and still be covered by a bar or a sheet.
const CONTROL_FN = `(function measure(sel) {
  const el = document.querySelector(sel);
  if (!el) return { missing: true };
  const s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || el.closest('[hidden]')) {
    return { hidden: true };
  }
  const r = el.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
  const topEl = (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight)
    ? document.elementFromPoint(cx, cy) : null;
  return {
    left: Math.round(r.left), right: Math.round(r.right),
    top: Math.round(r.top), bottom: Math.round(r.bottom),
    w: Math.round(r.width), h: Math.round(r.height),
    inside: r.left >= -1 && r.right <= window.innerWidth + 1
            && r.top >= -1 && r.bottom <= window.innerHeight + 1,
    hittable: !!(topEl && (topEl === el || el.contains(topEl) || topEl.contains(el))),
  };
})`;

// The two measurements that need no interaction, so they can be taken on a
// layout too broken to click through.
const VIEWPORT_PROBE = `({
  innerWidth: window.innerWidth,
  scrollWidth: document.documentElement.scrollWidth,
})`;

const PROBE = `(() => {
  const measure = ${CONTROL_FN};
  const caps = {};
  for (const c of ${JSON.stringify(CAPABILITIES)}) {
    caps[c.id] = c.sel.map(s => ({ sel: s, m: measure(s) }));
  }
  // Header controls that are actually painted — used for the overlap check.
  const painted = [];
  for (const el of document.querySelectorAll('.app-bar button, .rp-head button')) {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    painted.push({ id: el.id || el.className, l: r.left, r: r.right, t: r.top, b: r.bottom });
  }
  const tree = document.querySelector('.sb-tradition-group');
  const treeRect = tree ? tree.getBoundingClientRect() : null;
  return {
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    caps,
    painted,
    cardCount: document.querySelectorAll('.sb-card').length,
    treeOnScreen: !!(treeRect && treeRect.height > 0 && treeRect.width > 0
                     && treeRect.top < window.innerHeight),
    emptyIcons: [...new Set([...document.querySelectorAll('[data-icon]')]
      .filter(e => !e.innerHTML.trim()).map(e => e.dataset.icon))],
  };
})()`;

// Where the detail panel mounted, and whether expanding it broke the page.
const MOUNT_PROBE = `(() => {
  const d = document.getElementById('detail-view');
  if (!d) return { missing: true };
  return {
    inTree: !!d.closest('.sb-tradition-cards'),
    inPane: !!d.closest('#workspace-detail'),
    tabs: document.querySelectorAll('.detail-tab').length,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
})()`;

// Deterministic tree shape for the drag test: two genres, every genre expanded,
// no inline detail open, scrolled to top — so a source row and a target genre
// are on one screen at 360px as well as at 1280px.
const DND_SETUP = `(() => {
  app.collapsedTraditionGroups.clear();
  app.selected = null;
  renderAll();
  window.scrollTo(0, 0);
  const s = document.getElementById('sidebar-scroll');
  if (s) s.scrollTop = 0;
  return [...new Set(app.cards.map(c => c.traditionId))];
})()`;

// Put the boundary between genre 1 and genre 2 near the middle of the screen,
// so a source row and a target genre are both visible. Needed for the landscape
// phone (844x390), where the tree is far taller than the viewport and the second
// genre otherwise starts below the fold.
const DND_FOCUS = `(() => {
  const groups = document.querySelectorAll('.sb-tradition-group');
  if (groups.length < 2) return false;
  const cards = groups[0].querySelectorAll('.sb-card');
  const anchor = cards[cards.length - 1] || groups[0];
  window.scrollBy(0, anchor.getBoundingClientRect().top - window.innerHeight * 0.35);
  return true;
})()`;

// A point on the element that is genuinely hit-testable there — the sticky
// genre headers cover the row beneath them once the tree is scrolled, so the
// geometric centre is not always the right place to press.
const DND_POINT = `((sel, idx) => {
  const el = document.querySelectorAll(sel)[idx];
  if (!el) return null;
  const r = el.getBoundingClientRect();
  for (const fy of [0.5, 0.75, 0.9, 0.25]) {
    const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height * fy);
    if (y < 0 || y > window.innerHeight) continue;
    const top = document.elementFromPoint(x, y);
    if (top && (top === el || el.contains(top))) return { x, y };
  }
  return null;
})`;

// Scroll to the bottom, then check the two anchored bars are still anchored.
const PINNED_PROBE = `(() => {
  window.scrollTo(0, document.documentElement.scrollHeight);
  const bar = document.querySelector('.app-bar');
  const rp = document.getElementById('sidebar-recipe-preview');
  return {
    scrolled: Math.round(window.scrollY),
    barTop: bar ? Math.round(bar.getBoundingClientRect().top) : null,
    rpBottom: rp && rp.childElementCount ? Math.round(rp.getBoundingClientRect().bottom) : null,
    vh: window.innerHeight,
  };
})()`;

(async () => {
  if (!fs.existsSync(path.join(ROOT, HTML))) {
    console.error(`MOBILE LAYOUT: FAIL — ${HTML} not found (build it first)`);
    process.exit(1);
  }
  const { chromium } = loadPlaywright();
  const server = serve();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${HTML}`;

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const failures = [];
  let checks = 0;
  const fail = (vp, msg) => failures.push(`${vp.name}: ${msg}`);

  for (const vp of VIEWPORTS) {
    const mobile = vp.width <= MOBILE_MAX;
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.phone,
      hasTouch: vp.phone,
    });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(1200);

    // A and B are measured BEFORE anything is clicked, and are re-measured
    // after the workspace loads. This ordering is load-bearing: a layout broken
    // badly enough to blow the viewport open is also broken enough that
    // Playwright cannot click through it (a mis-sized element starts
    // intercepting pointer events), so an interaction-first gate throws and
    // reports a click timeout instead of the measurement that explains it.
    // That is precisely the confusing failure faults.js calls WRONG-REASON.
    const assertViewport = (probe, when) => {
      checks++;
      if (probe.innerWidth > vp.width + 1) {
        fail(
          vp,
          `layout viewport blown open to ${probe.innerWidth}px on a ${vp.width}px device ${when} ` +
            `(the page is being scaled down ~${Math.round((vp.width / probe.innerWidth) * 100)}%)`
        );
      }
      checks++;
      if (probe.scrollWidth > probe.innerWidth + 1) {
        fail(vp, `horizontal overflow ${probe.scrollWidth - probe.innerWidth}px ${when}`);
      }
    };
    assertViewport(await page.evaluate(VIEWPORT_PROBE), 'on the empty state');

    // Load a real workspace. Every assertion below is about editing a stack,
    // and the empty state has neither a tree nor a recipe bar to check.
    const starter = await page.$('#starter-gallery .starter-trad');
    if (!starter) {
      fail(vp, 'no starter recipe in the empty state — cannot exercise the editor');
      await ctx.close();
      continue;
    }
    try {
      await starter.click({ timeout: 15000 });
    } catch (e) {
      // Not fatal to the run: the measurements above already stand, and this
      // failure is reported on its own terms rather than as a bare timeout.
      fail(
        vp,
        `could not load a starter recipe — the empty state is not clickable ` +
          `(${String((e && e.message) || e)
            .split('\n')[0]
            .slice(0, 90)})`
      );
      await ctx.close();
      continue;
    }
    await page.waitForTimeout(2000);

    let r = await page.evaluate(PROBE);
    assertViewport(r, 'with a workspace loaded');

    // ---- C. every capability reachable -------------------------------------
    // Anything unsatisfied directly gets a second look behind the overflow
    // trigger, which must itself be reachable for that to count.
    const unresolved = [];
    for (const cap of CAPABILITIES) {
      const hit = r.caps[cap.id].find((c) => c.m.inside && c.m.hittable);
      if (hit) continue;
      unresolved.push(cap);
    }
    if (unresolved.length) {
      const trigger = await page.evaluate(`(${CONTROL_FN})('#btn-more')`);
      if (trigger.inside && trigger.hittable) {
        await page.click('#btn-more');
        await page.waitForTimeout(350);
        const after = await page.evaluate(
          `(() => { const measure = ${CONTROL_FN};
             const o = {};
             for (const c of ${JSON.stringify(CAPABILITIES)}) o[c.id] = c.sel.map(s => ({ sel: s, m: measure(s) }));
             return o; })()`
        );
        for (const cap of unresolved) r.caps[cap.id] = after[cap.id];
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
      }
    }
    for (const cap of CAPABILITIES) {
      checks++;
      const cands = r.caps[cap.id];
      const hit = cands.find((c) => c.m.inside && c.m.hittable);
      if (!hit) {
        const why = cands
          .map((c) => {
            const m = c.m;
            if (m.missing) return `${c.sel} not in the DOM`;
            if (m.hidden) return `${c.sel} is display:none`;
            if (!m.inside)
              return `${c.sel} off-screen (x ${m.left}..${m.right}, y ${m.top}..${m.bottom})`;
            return `${c.sel} is covered by another element`;
          })
          .join('; ');
        fail(vp, `cannot ${cap.label} — ${why}`);
        continue;
      }
      // Touch sizing is asserted on WIDTH, not on the emulation's pointer type:
      // a narrow desktop window gets this layout too, and a 28px control is no
      // easier to hit there.
      if (mobile && !cap.readout && (hit.m.w < TOUCH_MIN - 1 || hit.m.h < TOUCH_MIN - 1)) {
        fail(
          vp,
          `"${cap.label}" control ${hit.sel} is ${hit.m.w}x${hit.m.h}, below the ${TOUCH_MIN}px touch minimum`
        );
      }
    }

    // ---- D. no two painted controls overlap --------------------------------
    checks++;
    for (let i = 0; i < r.painted.length; i++) {
      for (let j = i + 1; j < r.painted.length; j++) {
        const a = r.painted[i],
          b = r.painted[j];
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (ox > 1 && oy > 1) {
          fail(
            vp,
            `controls overlap: ${a.id} and ${b.id} share ${Math.round(ox)}x${Math.round(oy)}px`
          );
        }
      }
    }

    // ---- F. no empty icon glyphs -------------------------------------------
    // icon() returns '' for a name with no ICON_PATHS entry and no alias, so a
    // typo ships as a blank square rather than throwing. This is how `undo` and
    // `redo` rendered empty for months.
    checks++;
    if (r.emptyIcons.length) {
      fail(vp, `icon(s) render as empty boxes: ${r.emptyIcons.join(', ')}`);
    }

    // ---- G. the layout model -----------------------------------------------
    checks++;
    if (mobile && !r.treeOnScreen) {
      fail(vp, 'the genre tree is not on screen — it must be the page, not behind a drawer');
    }

    // Tapping an instrument must expand it in place on mobile, and fill the
    // right-hand pane on desktop.
    checks++;
    const card = await page.$('.sb-card');
    if (!card) {
      fail(vp, 'no instrument rows rendered after loading a starter recipe');
    } else {
      await card.click();
      await page.waitForTimeout(900);
      const mount = await page.evaluate(MOUNT_PROBE);
      if (mount.missing) {
        fail(vp, 'tapping an instrument rendered no detail panel');
      } else if (mobile && !mount.inTree) {
        fail(
          vp,
          'the instrument detail did not expand inside the tree (mobile model is inline expansion)'
        );
      } else if (!mobile && !mount.inPane) {
        fail(
          vp,
          'the instrument detail is not in the detail pane (desktop model is master/detail)'
        );
      }
      // Full authoring parity: every tab present at every width.
      checks++;
      if (mount.tabs < 4) {
        fail(
          vp,
          `only ${mount.tabs} detail tabs rendered — expected the full set (parts/environment/chain/preface)`
        );
      }
      checks++;
      if (mount.scrollWidth > mount.innerWidth + 1) {
        fail(
          vp,
          `expanding an instrument overflowed the page by ${mount.scrollWidth - mount.innerWidth}px`
        );
      }
    }

    // ---- E. the app bar must stay pinned once the page scrolls -------------
    // `html, body { height: 100% }` clamps a sticky bar to a viewport-tall
    // containing block: scroll past it and the bar — and every action on it —
    // leaves the screen for good.
    checks++;
    const pinned = await page.evaluate(PINNED_PROBE);
    await page.waitForTimeout(200);
    if (pinned.scrolled > 4 && Math.abs(pinned.barTop) > 2) {
      fail(
        vp,
        `the app bar scrolled off (top ${pinned.barTop}px after scrolling ${pinned.scrolled}px) — it must stay pinned`
      );
    }
    // The recipe bar is pinned to the bottom edge below 900px.
    if (mobile) {
      checks++;
      if (pinned.rpBottom === null) {
        fail(vp, 'no recipe bar rendered with a loaded workspace');
      } else if (Math.abs(pinned.rpBottom - pinned.vh) > 2) {
        fail(
          vp,
          `the recipe bar is not pinned to the bottom (bottom ${pinned.rpBottom}, viewport ${pinned.vh})`
        );
      }
    }

    // ---- H. drag and drop, driven by the viewport's real input --------------
    // HTML5 drag-and-drop is mouse-only: `dragstart` never fires from a finger,
    // so for as long as the tree used it, reparenting a card into another genre
    // had no touch path at all and nothing failed. This drives a genuine touch
    // gesture on phone viewports (CDP touch events -> real pointerType 'touch')
    // and a genuine mouse drag on desktop, then asserts the model actually
    // changed. A regression here means a whole interaction silently died again.
    checks++;
    try {
      // Add a second genre so there is somewhere to drag TO.
      const staple = await page.$('#sb-staple-add');
      if (staple) {
        // Short timeout on purpose: under a deliberately broken layout (see
        // faults.js) this click is unreachable, and the default 30s x 8
        // viewports would add four minutes to a run that has already failed.
        await staple.click({ timeout: 8000 });
        await page.waitForTimeout(1800);
      }
      const genres = await page.evaluate(DND_SETUP);
      await page.waitForTimeout(400);
      await page.evaluate(DND_FOCUS);
      await page.waitForTimeout(400);
      if (genres.length < 2) {
        fail(vp, 'could not build a two-genre workspace to exercise drag and drop');
      } else {
        const before = await page.evaluate('app.cards.map(c => ({ id: c.id, t: c.traditionId }))');
        // The LAST card of genre 1 — nearest the genre-1/genre-2 boundary that
        // DND_FOCUS just centred, so both ends of the drag are on screen even on
        // the 390px-tall landscape phone.
        const srcId = await page.evaluate(
          `(() => { const c = document.querySelectorAll('.sb-tradition-group')[0].querySelectorAll('.sb-card');
             return c.length ? c[c.length - 1].dataset.cardId : null; })()`
        );
        const from = await page.evaluate(
          `(() => { const c = document.querySelectorAll('.sb-tradition-group')[0].querySelectorAll('.sb-card');
             return ${DND_POINT}('.sb-tradition-group:nth-of-type(1) .sb-card', c.length - 1); })()`
        );
        const to = await page.evaluate(
          `${DND_POINT}('.sb-tradition-group:nth-of-type(2) .sb-tradition-header', 0)`
        );
        if (!from || !to || !srcId) {
          fail(vp, 'drag source or target row is not hit-testable on screen');
        } else {
          let armed = false;
          if (vp.phone) {
            const cdp = await ctx.newCDPSession(page);
            const send = (type, pts) =>
              cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
            await send('touchStart', [{ x: from.x, y: from.y }]);
            await page.waitForTimeout(500); // long press to arm
            armed = await page.evaluate('!!(app._dnd && app._dnd.armed)');
            for (let i = 1; i <= 10; i++) {
              await send('touchMove', [
                {
                  x: from.x + ((to.x - from.x) * i) / 10,
                  y: from.y + ((to.y - from.y) * i) / 10,
                },
              ]);
              await page.waitForTimeout(25);
            }
            await page.waitForTimeout(120);
            await send('touchEnd', []);
          } else {
            await page.mouse.move(from.x, from.y);
            await page.mouse.down();
            for (let i = 1; i <= 12; i++) {
              await page.mouse.move(
                from.x + ((to.x - from.x) * i) / 12,
                from.y + ((to.y - from.y) * i) / 12
              );
              await page.waitForTimeout(15);
            }
            armed = await page.evaluate('!!(app._dnd && app._dnd.armed)');
            await page.waitForTimeout(120);
            await page.mouse.up();
          }
          await page.waitForTimeout(800);
          const after = await page.evaluate('app.cards.map(c => ({ id: c.id, t: c.traditionId }))');
          const b = before.find((c) => c.id === srcId);
          const a = after.find((c) => c.id === srcId);
          const input = vp.phone ? 'touch' : 'mouse';
          if (!armed) {
            fail(vp, `drag never armed on ${input} — the row could not be picked up`);
          } else if (!a || !b || a.t === b.t) {
            fail(vp, `drag on ${input} did not reparent the card (still in "${b && b.t}")`);
          }
          checks++;
          const leftover = await page.evaluate(
            `!!document.querySelector('.dnd-ghost, .is-dragging, .is-drag-over, .is-drag-over-top, .is-drag-over-bottom')`
          );
          if (leftover) fail(vp, 'drag artefacts (ghost / highlight) survived the drop');
        }
      }
    } catch (e) {
      fail(
        vp,
        `drag and drop check threw: ${(e && e.message ? e.message : String(e)).slice(0, 120)}`
      );
    }

    checks++;
    if (pageErrors.length) fail(vp, `uncaught JS error: ${pageErrors[0]}`);

    if (VERBOSE) {
      console.error(
        `  ${vp.name.padEnd(16)} iw=${r.innerWidth} sw=${r.scrollWidth} cards=${r.cardCount} ` +
          `model=${mobile ? 'inline' : 'pane'} controls=${r.painted.length}`
      );
    }
    await ctx.close();
  }

  await browser.close();
  server.close();

  if (failures.length) {
    console.error(
      `MOBILE LAYOUT: FAIL — ${failures.length} problem(s) across ${VIEWPORTS.length} viewports:`
    );
    for (const f of failures) console.error('  ✗ ' + f);
    process.exit(1);
  }
  console.log(
    `MOBILE LAYOUT: PASS — ${checks} assertions across ${VIEWPORTS.length} viewports ` +
      `(viewport, overflow, ${CAPABILITIES.length} capabilities reachable + touch-sized, ` +
      `no overlap, no empty icons, sticky bar, inline-expansion model, ` +
      `drag-and-drop under real touch + mouse).`
  );
  process.exit(0);
})().catch((e) => {
  console.error('MOBILE LAYOUT: FAIL — ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
