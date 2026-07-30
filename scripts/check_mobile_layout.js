#!/usr/bin/env node
// check_mobile_layout.js — the shipped page must be usable on a phone.
//
// @covers: mobile-layout-usable
//
// This gate exists because the app-bar silently stopped being responsive: `.actions`
// held eight `white-space: nowrap` controls in a non-wrapping flex row, giving the
// header a ~712px min-content width. At a 360-375px device width that does NOT show
// up as document overflow — instead the browser opens the LAYOUT VIEWPORT to fit
// (innerWidth measured 791px) and scales the whole app down to ~47%. Every
// scrollWidth-based check reads clean while the app is unusable, which is exactly how
// it regressed unnoticed. So the assertion here is on window.innerWidth, not overflow.
//
// Assertions, per viewport:
//   A. layout viewport == device width      (no zoom-out blowout)
//   B. no horizontal document overflow
//   C. every primary header control is inside the viewport AND hit-testable
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

// Phones and small tablets. 768/820 matter because the sidebar becomes a drawer at
// 899px, so the header must already be slim well above phone widths.
const VIEWPORTS = [
  { name: 'android-360', width: 360, height: 800, phone: true },
  { name: 'iphone-se-375', width: 375, height: 667, phone: true },
  { name: 'iphone-14-390', width: 390, height: 844, phone: true },
  { name: 'landscape-844', width: 844, height: 390, phone: true },
  { name: 'tablet-768', width: 768, height: 1024, phone: false },
  { name: 'tablet-820', width: 820, height: 1180, phone: false },
  { name: 'desktop-1280', width: 1280, height: 900, phone: false },
];

// Controls a user must be able to reach on any device.
const REQUIRED_CONTROLS = ['btn-add', 'btn-drawer-toggle'];

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

const PROBE = `(() => {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const controls = {};
  for (const id of ${JSON.stringify(REQUIRED_CONTROLS)}) {
    const el = document.getElementById(id);
    if (!el) { controls[id] = { missing: true }; continue; }
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') { controls[id] = { hidden: true }; continue; }
    const r = el.getBoundingClientRect();
    const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
    const topEl = (cx >= 0 && cy >= 0 && cx < vw && cy < window.innerHeight)
      ? document.elementFromPoint(cx, cy) : null;
    controls[id] = {
      left: Math.round(r.left), right: Math.round(r.right),
      w: Math.round(r.width), h: Math.round(r.height),
      inside: r.left >= -1 && r.right <= vw + 1,
      hittable: !!(topEl && (topEl === el || el.contains(topEl))),
    };
  }
  return { innerWidth: vw, scrollWidth: de.scrollWidth, controls };
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

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.phone,
      hasTouch: vp.phone,
    });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(1200);
    const r = await page.evaluate(PROBE);

    // A. the layout viewport must equal the device width
    checks++;
    if (r.innerWidth > vp.width + 1) {
      failures.push(
        `${vp.name}: layout viewport blown open to ${r.innerWidth}px on a ${vp.width}px device ` +
          `(the page is being scaled down ~${Math.round((vp.width / r.innerWidth) * 100)}%)`
      );
    }
    // B. no horizontal overflow
    checks++;
    if (r.scrollWidth > r.innerWidth + 1) {
      failures.push(`${vp.name}: horizontal overflow ${r.scrollWidth - r.innerWidth}px`);
    }
    // C. required controls reachable
    for (const id of REQUIRED_CONTROLS) {
      const c = r.controls[id];
      checks++;
      if (!c || c.missing) {
        failures.push(`${vp.name}: #${id} missing from the DOM`);
        continue;
      }
      if (c.hidden) continue; // deliberately hidden at this width is fine
      if (!c.inside) {
        failures.push(
          `${vp.name}: #${id} is off-screen (x ${c.left}..${c.right}, viewport ${r.innerWidth})`
        );
      } else if (!c.hittable) {
        failures.push(`${vp.name}: #${id} is covered by another element and cannot be tapped`);
      }
    }
    if (VERBOSE) {
      console.error(
        `  ${vp.name.padEnd(16)} innerWidth=${r.innerWidth} scrollWidth=${r.scrollWidth} ` +
          REQUIRED_CONTROLS.map((id) => {
            const c = r.controls[id] || {};
            return `${id}:${c.hidden ? 'hidden' : c.inside ? 'ok' : 'OFF'}`;
          }).join(' ')
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
      `(layout viewport, overflow, control reachability).`
  );
  process.exit(0);
})().catch((e) => {
  console.error('MOBILE LAYOUT: FAIL — ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
});
