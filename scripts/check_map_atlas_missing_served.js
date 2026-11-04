#!/usr/bin/env node
'use strict';
/* global document, window, location, innerWidth, innerHeight */
// #660, Don's #668 handoff 6639689668, phase 1 ONLY. No production fix.
// CHROMIUM_PATH=/path/to/chromium node scripts/check_map_atlas_missing_served.js
// Default: reproduce the known defect; exit 0 means reproduced, NOT product healthy.
// --assert-recovery: require an announced recovery instead; currently exits 1.
// --evidence-dir=/tmp/map-evidence: retain JSON and screenshots.
// Builds the real embedded shell into a temporary folder, serves HTTP, and withholds
// only atlas.html (empty HTML 404). Healthy atlas and data-error cases are controls.
// No file://, offline, live-site, other-browser or assistive-technology claim.
// Registration and merge require the runtime train owner: scripts/ is fingerprinted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
assert(
  args.every((a) => a === '--assert-recovery' || a.startsWith('--evidence-dir=')),
  'Unknown argument'
);
const recoveryMode = args.includes('--assert-recovery');
const evidenceArg = args.find((a) => a.startsWith('--evidence-dir='));
const evidenceDir = evidenceArg && path.resolve(evidenceArg.slice('--evidence-dir='.length));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'map-atlas-served-'));
const records = [];
const gates = new Map();
const requests = [];
// DOM/actionability checks, not proof that a screen reader announced the text or
// that activating the eventual recovery performs a successful recovery.
async function visibleAndExposed(locator) {
  return (
    (await locator.isVisible()) &&
    locator.evaluate((el) => {
      for (let node = el; node; node = node.parentElement) {
        if (
          node.inert ||
          node.getAttribute('aria-hidden') === 'true' ||
          Number(window.getComputedStyle(node).opacity) === 0
        )
          return false;
      }
      return true;
    })
  );
}
async function recoveryState(status) {
  const statusVisible = await visibleAndExposed(status);
  const statusText = statusVisible ? (await status.innerText()).trim() : '';
  const explanation = statusVisible
    ? await status.evaluate((el) => {
        // An actionable button alone must not stand in for visible explanation text.
        const walker = document.createTreeWalker(el, 4 /* SHOW_TEXT */);
        const text = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent.trim() || node.parentElement.closest('button,a[href]')) continue;
          let exposed = true;
          for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            const css = window.getComputedStyle(parent);
            if (
              parent.inert ||
              parent.getAttribute('aria-hidden') === 'true' ||
              css.visibility !== 'visible' ||
              Number(css.opacity) === 0
            )
              exposed = false;
          }
          const range = document.createRange();
          range.selectNodeContents(node);
          if (exposed && [...range.getClientRects()].some((r) => r.width > 0 && r.height > 0))
            text.push(node.textContent.trim());
        }
        return text.join(' ');
      })
    : '';
  const role = await status.getAttribute('role');
  const fitsViewport = await status.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return (
      b.width > 0 &&
      b.height > 0 &&
      b.left >= 0 &&
      b.right <= innerWidth &&
      b.top >= 0 &&
      b.bottom <= innerHeight
    );
  });
  let recoveryActions = 0;
  if (statusVisible) {
    for (const action of await status.locator('a[href],button').all()) {
      if (!(await visibleAndExposed(action)) || !(await action.isEnabled())) continue;
      if (!((await action.innerText()).trim() || (await action.getAttribute('aria-label'))))
        continue;
      try {
        // Trial checks enabled, stable, visible and receives pointer events; no navigation.
        await action.click({ trial: true, timeout: 300 });
        recoveryActions++;
      } catch {
        /* An obstructed/disabled control is not an actionable recovery. */
      }
    }
  }
  return {
    statusVisible,
    statusText,
    explanation,
    role,
    fitsViewport,
    recoveryActions,
    announcedRecovery:
      statusVisible &&
      !!explanation &&
      ['status', 'alert'].includes(role) &&
      !/Loading the map/.test(statusText) &&
      recoveryActions > 0 &&
      fitsViewport,
  };
}
async function bounded(promise, label, ms = 10000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}: timed out after ${ms} ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function waitForRecovery(status) {
  const deadline = Date.now() + 3000;
  let state;
  do {
    state = await recoveryState(status);
    if (state.announcedRecovery) return state;
    await status.page().waitForTimeout(50);
  } while (Date.now() < deadline);
  return state;
}
async function predicateControls(browser) {
  const results = [];
  for (const width of [1280, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    try {
      for (const variant of [
        'visible-enabled',
        'hidden-status',
        'hidden-action',
        'disabled-action',
        'aria-disabled-action',
        'aria-hidden-status',
        'transparent-status',
        'hidden-explanation',
      ]) {
        await page.setContent(
          '<div id="status" role="status">The map did not load. <button>Try again</button></div>'
        );
        await page.evaluate((variant) => {
          const status = document.querySelector('#status');
          const button = status.querySelector('button');
          if (variant === 'hidden-status') status.style.visibility = 'hidden';
          if (variant === 'hidden-action') button.style.visibility = 'hidden';
          if (variant === 'disabled-action') button.disabled = true;
          if (variant === 'aria-disabled-action') button.setAttribute('aria-disabled', 'true');
          if (variant === 'aria-hidden-status') status.setAttribute('aria-hidden', 'true');
          if (variant === 'transparent-status') status.style.opacity = '0';
          if (variant === 'hidden-explanation')
            status.innerHTML =
              '<span style="visibility:hidden">The map did not load.</span><button>Try again</button>';
        }, variant);
        const result = await recoveryState(page.locator('#status'));
        assert.equal(
          result.announcedRecovery,
          variant === 'visible-enabled',
          `${width}: ${variant} recovery predicate`
        );
        results.push({ width, variant, accepted: result.announcedRecovery });
      }
      // This fixture proves the bounded wait accepts recovery appearing after load.
      await page.setContent(
        '<div id="status" role="status" hidden>The map did not load. <button>Try again</button></div>'
      );
      await page.evaluate(() =>
        setTimeout(() => {
          document.querySelector('#status').hidden = false;
        }, 150)
      );
      assert(
        (await waitForRecovery(page.locator('#status'))).announcedRecovery,
        'delayed recovery'
      );
      results.push({ width, variant: 'delayed-recovery', accepted: true });
    } finally {
      await page.close();
    }
  }
  await assert.rejects(
    bounded(new Promise(() => {}), 'unseen atlas request control', 25),
    /timed out/
  );
  console.log(
    `PASS: ${results.length} synthetic recovery controls and missing-request timeout control (not product fixes)`
  );
  return results;
}
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const [, caseId, ...parts] = pathname.split('/');
  const relative = parts.join('/');
  const gate = gates.get(caseId);
  if (!gate) return res.writeHead(404).end();
  if (relative === 'atlas.html') {
    gate.requested();
    await gate.releasePromise;
  }
  const status =
    relative === 'atlas.html' && gate.scenario === 'missing'
      ? 404
      : relative === 'data/atlas-geo.json' && gate.scenario === 'data-error'
        ? 503
        : 200;
  if (status !== 200) {
    requests.push({ caseId, relative, status });
    // Empty HTML avoids a server-provided error explanation masking the shell defect.
    return res
      .writeHead(status, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
      .end('');
  }
  const base = relative === 'codex.html' ? temp : root;
  const file = path.resolve(base, relative);
  if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    requests.push({ caseId, relative, status: 404 });
    return res.writeHead(404).end();
  }
  requests.push({ caseId, relative, status: 200 });
  res.writeHead(200, {
    'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  let browser;
  try {
    execFileSync(
      process.execPath,
      [
        path.join(root, 'scripts/build_html.js'),
        '--embedded',
        '--quiet',
        '--out=' + path.join(temp, 'codex.html'),
      ],
      { cwd: root, stdio: 'pipe' }
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox'],
    });
    const recoveryControls = await predicateControls(browser);
    if (evidenceDir) fs.mkdirSync(evidenceDir, { recursive: true });
    for (const width of [1280, 375]) {
      for (const scenario of ['healthy', 'missing', 'data-error']) {
        const caseId = `${scenario}-${width}`;
        let requested, release;
        const requestedPromise = new Promise((resolve) => {
          requested = resolve;
        });
        const releasePromise = new Promise((resolve) => {
          release = resolve;
        });
        gates.set(caseId, { scenario, requested, releasePromise });
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          serviceWorkers: 'block',
        });
        try {
          // Keep this test local, without claiming imagery or external services work.
          await context.route('**/*', (route) =>
            new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
          );
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', (error) => errors.push(error.message));
          await page.addInitScript(() => {
            window.__mapFrameLoads = 0;
            document.addEventListener(
              'load',
              (event) => {
                if (event.target.id === 'map-frame') window.__mapFrameLoads++;
              },
              true
            );
          });
          await page.goto(`${origin}/${caseId}/codex.html#map`, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() =>
            document.querySelector('#map-frame')?.getAttribute('src')?.includes('atlas.html')
          );
          await bounded(requestedPromise, `${caseId}: atlas request`);
          const status = page.locator('#map-status');
          assert(
            await status.isVisible(),
            `${caseId}: loading status visible while HTTP is pending`
          );
          assert.match(await status.innerText(), /Loading the map/);
          const beforeLoads = await page.evaluate(() => window.__mapFrameLoads);
          release();
          await page.waitForFunction((before) => window.__mapFrameLoads > before, beforeLoads);
          const frame = page.frameLocator('#map-frame');
          if (scenario === 'healthy') {
            await frame
              .locator('#loading')
              .filter({ hasText: /\d+ traditions loaded/ })
              .waitFor({ state: 'attached' });
            assert(await status.isHidden(), `${caseId}: shell loading status clears`);
            assert(await frame.locator('#map-main').isVisible(), `${caseId}: real atlas visible`);
          } else if (scenario === 'data-error') {
            await frame.getByRole('button', { name: 'Try again', exact: true }).waitFor();
            assert.match(await frame.locator('#loading').innerText(), /The map did not load/);
            assert.equal(await frame.locator('#loading').getAttribute('role'), 'status');
            assert(
              requests.some(
                (r) =>
                  r.caseId === caseId && r.relative === 'data/atlas-geo.json' && r.status === 503
              ),
              `${caseId}: controlled data failure reached the server`
            );
          }
          const recovery =
            recoveryMode && scenario === 'missing'
              ? await waitForRecovery(status)
              : await recoveryState(status);
          const snapshot = {
            ...recovery,
            ...(await page.evaluate(() => {
              const frame = document.querySelector('#map-frame');
              const doc = frame.contentDocument;
              return {
                protocol: location.protocol,
                atlasPresent: !!doc?.querySelector('#map-main'),
                frameText: doc?.body?.textContent.trim() || '',
                frameLoads: window.__mapFrameLoads,
              };
            })),
          };
          const blank =
            !snapshot.statusVisible && !snapshot.atlasPresent && snapshot.frameText === '';
          const { announcedRecovery } = recovery;
          assert.equal(snapshot.protocol, 'http:');
          assert.deepEqual(errors, [], `${caseId}: unexpected JavaScript errors`);
          const atlasRequests = requests.filter(
            (r) => r.caseId === caseId && r.relative === 'atlas.html'
          );
          assert.equal(atlasRequests.length, 1, `${caseId}: exactly one controlled atlas request`);
          assert.equal(atlasRequests[0].status, scenario === 'missing' ? 404 : 200);
          if (scenario !== 'missing')
            assert.equal(blank, false, `${caseId}: negative control must not classify as blank`);
          records.push({
            caseId,
            width,
            scenario,
            ...snapshot,
            blank,
            announcedRecovery,
            errors,
            requests: requests.filter((r) => r.caseId === caseId),
          });
          if (evidenceDir) await page.screenshot({ path: path.join(evidenceDir, caseId + '.png') });
          console.log(
            `${caseId}: HTTP ${atlasRequests[0].status}; statusVisible=${snapshot.statusVisible}; atlasPresent=${snapshot.atlasPresent}; blank=${blank}; announcedRecovery=${announcedRecovery}`
          );
        } finally {
          release();
          await context.close();
        }
      }
    }
    const report = {
      build: 'fresh --embedded; default Library setting',
      browser: browser.version(),
      source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      workingTreeStatus: execFileSync('git', ['status', '--porcelain'], {
        cwd: root,
        encoding: 'utf8',
      }),
      sha256: Object.fromEntries(
        [
          'scripts/check_map_atlas_missing_served.js',
          'src/pages/map.js',
          'src/pages/map.css',
          'src/atlas.js',
          'atlas.html',
          'scripts/build_html.js',
          'src/app.js',
        ].map((file) => [
          file,
          createHash('sha256')
            .update(fs.readFileSync(path.join(root, file)))
            .digest('hex'),
        ])
      ),
      recoveryControls,
      scope:
        'Local served HTTP only; external requests blocked. No offline or production qualification.',
      mode: recoveryMode ? 'assert-recovery' : 'reproduce-known-defect',
      records,
    };
    if (evidenceDir)
      fs.writeFileSync(
        path.join(evidenceDir, 'report.json'),
        JSON.stringify(report, null, 2) + '\n'
      );
    for (const row of records.filter((r) => r.scenario === 'missing')) {
      if (recoveryMode)
        assert(
          row.announcedRecovery,
          `${row.caseId}: missing atlas must expose an announced, visible recovery action`
        );
      else
        assert(
          row.blank,
          `${row.caseId}: known blank-panel defect no longer reproduces; inspect before updating this phase-1 check`
        );
    }
    console.log(
      recoveryMode
        ? 'PASS: announced recovery'
        : 'REPRODUCED: blank missing-atlas panel at both widths; healthy and data-error controls are not blank. This is defect evidence, not a passing product gate.'
    );
  } finally {
    await browser?.close();
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(temp, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
