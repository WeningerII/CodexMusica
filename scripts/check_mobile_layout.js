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

    // Load a real workspace. Every assertion below is about editing a stack,
    // and the empty state has neither a tree nor a recipe bar to check.
    const starter = await page.$('#starter-gallery .starter-trad');
    if (!starter) {
      fail(vp, 'no starter recipe in the empty state — cannot exercise the editor');
      await ctx.close();
      continue;
    }
    await starter.click();
    await page.waitForTimeout(2000);

    let r = await page.evaluate(PROBE);

    // ---- A. layout viewport must equal the device width --------------------
    checks++;
    if (r.innerWidth > vp.width + 1) {
      fail(
        vp,
        `layout viewport blown open to ${r.innerWidth}px on a ${vp.width}px device ` +
          `(the page is being scaled down ~${Math.round((vp.width / r.innerWidth) * 100)}%)`
      );
    }
    // ---- B. no horizontal overflow -----------------------------------------
    checks++;
    if (r.scrollWidth > r.innerWidth + 1) {
      fail(vp, `horizontal overflow ${r.scrollWidth - r.innerWidth}px`);
    }

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
      `no overlap, no empty icons, sticky bar, inline-expansion model).`
  );
  process.exit(0);
})().catch((e) => {
  console.error('MOBILE LAYOUT: FAIL — ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
