#!/usr/bin/env node
'use strict';
/* global window, document */ // referenced only inside page.evaluate callbacks, which run in the browser
// check_library_perf.js — is the native Library tab measurably faster than the
// old Library Site, measured the same way on both sides?
//
// THE CONTRACT (docs/library-native-design.md, "Performance plan"). The owner
// asked for a Library that loads faster than the Site it replaces. "Faster" is
// only a claim when both sides are timed by the same harness, under the same
// throttling, against the same kind of host, and when "ready" means usable
// rather than "a heading exists". So:
//
//   MODES, LABELLED ON EVERY NUMBER. Each side is served one of three ways:
//     synthetic           a directory or recorded fixture served by
//                         _pages_server.js with zero server delay;
//     synthetic-modelled  the same, plus a measured per-endpoint delay table;
//     live                the real URL.
//   A ratio or an improvement is computed only between two sides in the SAME
//   mode, never from a run whose fixture saw an unmatched request (the server
//   answers those 599 and never touches the live host), and a synthetic
//   improvement is evaluated against a threshold only when a calibration
//   record (synthetic vs live medians for the old Site) is supplied. Otherwise
//   the report says why it refused.
//
//   READY MEANS USABLE, detected identically for both sides by an init script.
//   A milestone (for example shelves-ready: first shelf heading and first card
//   title) counts at the first animation frame after ALL of these hold:
//     1. every configured selector matches an element that is painted inside
//        the viewport (non-zero box, intersecting the viewport, computed
//        visibility visible, not display:none);
//     2. fonts have settled (document.fonts.status 'loaded'), or 100 ms have
//        passed since condition 1 first held;
//     3. no busy indicator (aria-busy=true, or the side's configured skeleton
//        or loading selector) intersects the viewport.
//   Then an IMMEDIATE-ACTION PROBE runs inside the page: the configured
//   element is activated and the configured response must appear within
//   100 ms. A probe that fails is reported per run.
//
//   RUNS. n fresh browser contexts per side (default 9), interleaved A/B so
//   runner drift lands on both sides. Per milestone: median, p90, MAD, and for
//   an A/B pair the bootstrap 95% confidence interval of the median
//   difference (fixed seed, so a re-run of the same samples gives the same
//   interval). Also recorded: FCP and LCP, the bytes and requests the page had
//   transferred before each milestone (Resource Timing; cross-origin entries
//   without Timing-Allow-Origin read as zero bytes and are counted
//   separately), long tasks over 50 ms, and the DOM element count.
//
//   THRESHOLDS (all optional; with none, the run reports and exits 0):
//     caps        { milestone: ms } on the new side's median;
//     improvement m (default 0.45): new median <= (1 - m) x old median AND the
//                 CI of (new - old) lies wholly below zero.
//   A failed or refused threshold exits 1.
//
//   PROFILES, the applied Slow-4G constants Lighthouse's own throttling uses,
//   not its simulated ones:
//     mobile   412x823 at DPR 1.75; 562.5 ms latency, 1,474.56 kbps down,
//              675 kbps up; CPU throttled 4x;
//     desktop  1350x940; 40 ms latency, 10,240 kbps; no CPU throttle.
//
// USAGE
//   node scripts/check_library_perf.js --config=FILE [--report=FILE] [--runs=N]
//   node scripts/check_library_perf.js --self-test
//
// CONFIG (JSON):
//   { "profile": "mobile" | "desktop",
//     "runs": 9,
//     "milestones": ["shelves-ready"],
//     "sides": {
//       "old": { "mode": "synthetic" | "synthetic-modelled" | "live",
//                "root": DIR | "fixture": FILE | "url": URL,
//                "path": "/codex.html#library",          (served modes)
//                "delays": FILE,                          (synthetic-modelled)
//                "busy": ".skeleton, [data-loading]",
//                "milestones": { "shelves-ready": {
//                    "selectors": ["h2.shelf", ".card .title"],
//                    "probe": { "activate": ".card a", "expect": ".reader h1" } } } },
//       "new": { ...same shape... } },
//     "thresholds": { "caps": { "shelves-ready": 4500 }, "improvement": 0.45 },
//     "calibration": FILE }                               (synthetic improvement)
//
// The Chromium binary: CHROMIUM_PATH, else the newest chromium-NNNN under
// PLAYWRIGHT_BROWSERS_PATH, else Playwright's default.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROFILES = {
  mobile: {
    viewport: { width: 412, height: 823 },
    deviceScaleFactor: 1.75,
    isMobile: true,
    hasTouch: true,
    network: { latency: 562.5, download: (1474.56 * 1024) / 8, upload: (675 * 1024) / 8 },
    cpu: 4,
  },
  desktop: {
    viewport: { width: 1350, height: 940 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    network: { latency: 40, download: (10240 * 1024) / 8, upload: (10240 * 1024) / 8 },
    cpu: 1,
  },
};
const MODES = new Set(['synthetic', 'synthetic-modelled', 'live']);
const PROBE_BUDGET_MS = 100;
const MILESTONE_TIMEOUT_MS = 90000;

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  const dirs = fs
    .readdirSync(base)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    const exe = path.join(base, d, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

// ── statistics ──────────────────────────────────────────────────────────────
const sorted = (xs) => [...xs].sort((a, b) => a - b);
function quantile(xs, q) {
  const s = sorted(xs);
  if (!s.length) return null;
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}
const median = (xs) => quantile(xs, 0.5);
function mad(xs) {
  const m = median(xs);
  return m == null ? null : median(xs.map((x) => Math.abs(x - m)));
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Bootstrap CI of median(b) - median(a), resampling each side independently.
function bootstrapDiffCI(a, b, iterations = 2000, seed = 0x5eed) {
  if (a.length < 2 || b.length < 2) return null;
  const rand = mulberry32(seed);
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const diffs = [];
  for (let i = 0; i < iterations; i++) {
    const ra = Array.from(a, () => pick(a));
    const rb = Array.from(b, () => pick(b));
    diffs.push(median(rb) - median(ra));
  }
  return [quantile(diffs, 0.025), quantile(diffs, 0.975)];
}
function summary(xs) {
  return {
    n: xs.length,
    median: median(xs),
    p90: quantile(xs, 0.9),
    mad: mad(xs),
    min: xs.length ? Math.min(...xs) : null,
    max: xs.length ? Math.max(...xs) : null,
  };
}

// ── the in-page detector ────────────────────────────────────────────────────
// Installed before any page script runs. It polls on every animation frame,
// so the two sides are watched by the same loop at the same cadence.
function detectorSource(spec) {
  return `(() => {
  const SPEC = ${JSON.stringify(spec)};
  const out = { milestones: {}, probes: {}, fcp: null, lcp: null, longTasks: [] };
  window.__libraryPerf = out;
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') out.fcp = e.startTime; })
      .observe({ type: 'paint', buffered: true });
    new PerformanceObserver((l) => { const es = l.getEntries(); if (es.length) out.lcp = es[es.length - 1].startTime; })
      .observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.duration > 50) out.longTasks.push(Math.round(e.duration)); })
      .observe({ type: 'longtask', buffered: true });
  } catch (_) {}
  const painted = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const busy = () => {
    const sel = '[aria-busy="true"]' + (SPEC.busy ? ', ' + SPEC.busy : '');
    for (const el of document.querySelectorAll(sel)) if (painted(el)) return true;
    return false;
  };
  const firstHeld = {};
  const probe = (name, p) => new Promise((resolve) => {
    const target = document.querySelector(p.activate);
    if (!target) return resolve({ ok: false, ms: null, why: 'probe target missing' });
    const t0 = performance.now();
    let done = false;
    const finish = (ok, why) => { if (done) return; done = true; mo.disconnect(); resolve({ ok, ms: Math.round(performance.now() - t0), why }); };
    const mo = new MutationObserver(() => { if (document.querySelector(p.expect)) finish(true); });
    mo.observe(document, { subtree: true, childList: true, attributes: true });
    setTimeout(() => finish(!!document.querySelector(p.expect), 'no response within ${PROBE_BUDGET_MS} ms'), ${PROBE_BUDGET_MS});
    target.click();
    if (document.querySelector(p.expect)) finish(true);
  });
  const tick = () => {
    if (!document.documentElement) return requestAnimationFrame(tick);
    let pending = false;
    for (const [name, m] of Object.entries(SPEC.milestones)) {
      if (out.milestones[name] != null) continue;
      pending = true;
      const els = m.selectors.map((s) => document.querySelector(s));
      if (!els.every(painted)) { delete firstHeld[name]; continue; }
      const now = performance.now();
      if (firstHeld[name] == null) firstHeld[name] = now;
      const fontsOk = !document.fonts || document.fonts.status === 'loaded' || now - firstHeld[name] >= 100;
      if (!fontsOk || busy()) continue;
      requestAnimationFrame(() => {
        if (out.milestones[name] != null) return;
        out.milestones[name] = performance.now();
        const res = performance.getEntriesByType('resource');
        const nav = performance.getEntriesByType('navigation')[0];
        const before = res.filter((r) => r.responseEnd <= out.milestones[name]);
        out[name + ':bytes'] = (nav ? nav.transferSize : 0) + before.reduce((n, r) => n + (r.transferSize || 0), 0);
        out[name + ':requests'] = before.length + 1;
        out[name + ':opaque'] = before.filter((r) => !r.transferSize && !r.decodedBodySize).length;
        if (m.probe) probe(name, m.probe).then((r) => { out.probes[name] = r; });
        else out.probes[name] = { ok: true, ms: null, why: 'no probe configured' };
      });
    }
    if (pending) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;
}

// ── one run of one side ─────────────────────────────────────────────────────
async function runOnce(browser, side, profileName, milestoneNames) {
  const profile = PROFILES[profileName];
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
  });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.network.latency,
      downloadThroughput: profile.network.download,
      uploadThroughput: profile.network.upload,
    });
    if (profile.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu });
    const spec = {
      busy: side.busy || '',
      milestones: Object.fromEntries(milestoneNames.map((n) => [n, side.milestones[n]])),
    };
    await page.addInitScript({ content: detectorSource(spec) });
    if (side.server) side.server.reset();
    const response = await page.goto(side.target, {
      waitUntil: 'commit',
      timeout: MILESTONE_TIMEOUT_MS,
    });
    const deadline = Date.now() + MILESTONE_TIMEOUT_MS;
    let state = null;
    for (;;) {
      state = await page.evaluate(() => window.__libraryPerf || null).catch(() => null);
      const ready =
        state && milestoneNames.every((n) => state.milestones[n] != null && state.probes[n]);
      if (ready || Date.now() > deadline) break;
      await page.waitForTimeout(50);
    }
    const dom = await page
      .evaluate(() => document.getElementsByTagName('*').length)
      .catch(() => null);
    // A missed milestone says what the page showed instead, so a wrong
    // selector, a consent wall or a bot check is visible in the log.
    if (milestoneNames.some((n) => !state || state.milestones[n] == null)) {
      const shown = await page
        .evaluate((spec) => {
          const seen = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return 'absent';
            const r = el.getBoundingClientRect();
            return r.width && r.height ? 'painted' : 'unpainted';
          };
          return {
            url: window.location.href,
            title: document.title,
            busy: spec.busy ? seen(spec.busy) : null,
            selectors: Object.fromEntries(
              Object.values(spec.milestones).flatMap((m) => m.selectors.map((s) => [s, seen(s)]))
            ),
            text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 300),
          };
        }, spec)
        .catch((error) => ({ error: error.message }));
      console.log(
        `MISS ${side.name} ${profileName} ${JSON.stringify({ status: response ? response.status() : null, ...shown })}`
      );
    }
    const result = { milestones: {}, probes: {}, bytes: {}, requests: {}, opaque: {}, dom };
    for (const n of milestoneNames) {
      result.milestones[n] = state && state.milestones[n] != null ? state.milestones[n] : null;
      result.probes[n] = (state && state.probes[n]) || { ok: false, ms: null, why: 'timed out' };
      result.bytes[n] = state ? state[n + ':bytes'] : null;
      result.requests[n] = state ? state[n + ':requests'] : null;
      result.opaque[n] = state ? state[n + ':opaque'] : null;
    }
    result.fcp = state ? state.fcp : null;
    result.lcp = state ? state.lcp : null;
    result.longTasks = state ? state.longTasks : [];
    return result;
  } finally {
    await context.close();
  }
}

// ── sides ───────────────────────────────────────────────────────────────────
async function openSide(name, cfg, base) {
  if (!MODES.has(cfg.mode)) throw new Error(`side ${name}: unknown mode ${cfg.mode}`);
  const side = { name, mode: cfg.mode, busy: cfg.busy, milestones: cfg.milestones || {} };
  if (cfg.mode === 'live') {
    if (!cfg.url) throw new Error(`side ${name}: live mode needs "url"`);
    side.target = cfg.url;
    return side;
  }
  const { start } = require('./_pages_server');
  const resolve = (p) => (p && !path.isAbsolute(p) ? path.join(base, p) : p);
  const delays =
    cfg.mode === 'synthetic-modelled'
      ? JSON.parse(fs.readFileSync(resolve(cfg.delays), 'utf8'))
      : undefined;
  if (cfg.mode === 'synthetic-modelled' && !delays)
    throw new Error(`side ${name}: synthetic-modelled needs a "delays" table`);
  side.server = await start(
    cfg.fixture ? { fixture: resolve(cfg.fixture), delays } : { root: resolve(cfg.root), delays }
  );
  side.target = side.server.url + (cfg.path || '/');
  return side;
}

// ── the measurement ─────────────────────────────────────────────────────────
async function measure(config, base = process.cwd()) {
  const { chromium } = require('playwright');
  const profile = config.profile || 'mobile';
  if (!PROFILES[profile]) throw new Error(`unknown profile ${profile}`);
  const runs = Number(config.runs || 9);
  const names = config.milestones || [];
  if (!names.length) throw new Error('config.milestones lists no milestone');
  const sideNames = Object.keys(config.sides || {});
  if (!sideNames.length) throw new Error('config.sides is empty');
  const sides = [];
  for (const n of sideNames) sides.push(await openSide(n, config.sides[n], base));
  for (const s of sides)
    for (const m of names)
      if (!s.milestones[m] || !Array.isArray(s.milestones[m].selectors))
        throw new Error(`side ${s.name}: milestone ${m} has no selectors`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumPath(),
    args: ['--no-sandbox'],
  });
  const samples = Object.fromEntries(sides.map((s) => [s.name, []]));
  try {
    for (let i = 0; i < runs; i++)
      for (const s of i % 2 ? [...sides].reverse() : sides)
        samples[s.name].push(await runOnce(browser, s, profile, names));
  } finally {
    await browser.close();
    for (const s of sides) if (s.server) await s.server.close();
  }

  const report = {
    profile,
    runs,
    milestones: names,
    sides: {},
    comparisons: [],
    thresholds: [],
    refusals: [],
  };
  for (const s of sides) {
    const rs = samples[s.name];
    const unmatched = s.server ? s.server.unmatched() : [];
    const entry = {
      mode: s.mode,
      label: s.mode,
      target: s.target,
      unmatched,
      provenance: s.server ? s.server.provenance : null,
      milestones: {},
      fcp: summary(rs.map((r) => r.fcp).filter((x) => x != null)),
      lcp: summary(rs.map((r) => r.lcp).filter((x) => x != null)),
      longTasks: rs.map((r) => r.longTasks),
      dom: rs.map((r) => r.dom),
    };
    for (const n of names) {
      const times = rs.map((r) => r.milestones[n]).filter((x) => x != null);
      entry.milestones[n] = {
        ...summary(times),
        missed: rs.filter((r) => r.milestones[n] == null).length,
        probes: rs.map((r) => r.probes[n]),
        probeFailures: rs.filter((r) => !r.probes[n] || !r.probes[n].ok).length,
        bytes: summary(rs.map((r) => r.bytes[n]).filter((x) => x != null)),
        requests: summary(rs.map((r) => r.requests[n]).filter((x) => x != null)),
        opaque: rs.map((r) => r.opaque[n]),
        samples: times,
      };
    }
    report.sides[s.name] = entry;
  }

  // Comparisons: old vs new only when the two were measured the same way.
  const old = report.sides.old;
  const neu = report.sides.new;
  const thresholds = config.thresholds || {};
  let calibration = null;
  if (config.calibration) {
    const f = path.isAbsolute(config.calibration)
      ? config.calibration
      : path.join(base, config.calibration);
    calibration = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  report.calibration = calibration;
  if (old && neu) {
    const why = [];
    if (old.mode !== neu.mode)
      why.push(`the sides used different modes (${old.mode} vs ${neu.mode})`);
    for (const [n, s] of [
      ['old', old],
      ['new', neu],
    ])
      if (s.unmatched.length)
        why.push(`side ${n} saw ${s.unmatched.length} request(s) its fixture does not hold`);
    for (const n of names) {
      if (why.length) {
        report.refusals.push(`${n}: no comparison — ${why.join('; ')}`);
        continue;
      }
      const a = old.milestones[n].samples;
      const b = neu.milestones[n].samples;
      const c = {
        milestone: n,
        mode: neu.mode,
        old_median: median(a),
        new_median: median(b),
        ratio: median(a) ? median(b) / median(a) : null,
        diff_ci95: bootstrapDiffCI(a, b),
      };
      report.comparisons.push(c);
    }
  }

  // Thresholds.
  const fail = [];
  for (const [n, cap] of Object.entries(thresholds.caps || {})) {
    const m = neu && neu.milestones[n];
    const ok = m && m.median != null && m.median <= cap && m.missed === 0;
    report.thresholds.push({
      kind: 'cap',
      milestone: n,
      cap,
      value: m ? m.median : null,
      ok: !!ok,
    });
    if (!ok)
      fail.push(`cap ${n}: median ${m ? m.median : 'n/a'} ms > ${cap} ms or a run missed it`);
  }
  if (thresholds.improvement != null) {
    const mFactor = Number(thresholds.improvement);
    for (const n of names) {
      const c = report.comparisons.find((x) => x.milestone === n);
      if (!c) {
        report.thresholds.push({ kind: 'improvement', milestone: n, ok: false, refused: true });
        fail.push(`improvement ${n}: refused (no valid comparison)`);
        continue;
      }
      if (c.mode !== 'live' && !calibration) {
        report.thresholds.push({ kind: 'improvement', milestone: n, ok: false, refused: true });
        fail.push(`improvement ${n}: refused (a ${c.mode} improvement needs a calibration record)`);
        continue;
      }
      const ok =
        c.new_median <= (1 - mFactor) * c.old_median && c.diff_ci95 != null && c.diff_ci95[1] < 0;
      report.thresholds.push({ kind: 'improvement', milestone: n, m: mFactor, ...c, ok });
      if (!ok)
        fail.push(
          `improvement ${n}: new ${Math.round(c.new_median)} ms vs old ${Math.round(c.old_median)} ms (needs <= ${Math.round((1 - mFactor) * c.old_median)} ms and a CI below zero)`
        );
    }
  }
  for (const n of names)
    if (neu && neu.milestones[n] && neu.milestones[n].probeFailures)
      fail.push(
        `probe ${n}: ${neu.milestones[n].probeFailures} run(s) did not respond within ${PROBE_BUDGET_MS} ms`
      );
  report.failures = fail;
  report.thresholded = Boolean(
    (thresholds.caps && Object.keys(thresholds.caps).length) || thresholds.improvement != null
  );
  return report;
}

function printReport(r) {
  const ms = (x) => (x == null ? 'n/a' : `${Math.round(x)} ms`);
  console.log(`=== Library timing (${r.profile}, ${r.runs} run(s) per side, interleaved) ===`);
  for (const [name, s] of Object.entries(r.sides)) {
    console.log(`\n[${name}] mode=${s.label}  ${s.target}`);
    if (s.unmatched.length) console.log(`  ✗ ${s.unmatched.length} unmatched fixture request(s)`);
    for (const [m, v] of Object.entries(s.milestones))
      console.log(
        `  ${m.padEnd(16)} median ${ms(v.median)}  p90 ${ms(v.p90)}  MAD ${ms(v.mad)}  missed ${v.missed}  probe failures ${v.probeFailures}  bytes~${v.bytes.median ?? 'n/a'}  (${s.label})`
      );
    console.log(`  FCP median ${ms(s.fcp.median)}  LCP median ${ms(s.lcp.median)}  (${s.label})`);
  }
  for (const c of r.comparisons)
    console.log(
      `\n${c.milestone}: new/old = ${c.ratio == null ? 'n/a' : c.ratio.toFixed(3)} (${c.mode}); median diff CI95 [${c.diff_ci95 ? c.diff_ci95.map((x) => Math.round(x)).join(', ') : 'n/a'}] ms`
    );
  for (const x of r.refusals) console.log(`\nREFUSED: ${x}`);
  for (const f of r.failures) console.log(`✗ ${f}`);
  console.log(r.failures.length && r.thresholded ? '\nFAIL' : '\nDONE');
}

// ── self-test ───────────────────────────────────────────────────────────────
async function selfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-perf-'));
  const page = (body) =>
    `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>${body}</body></html>`;
  const card = `<h2 class="shelf">English</h2><div class="card"><a class="open" href="#" onclick="event.preventDefault();document.body.insertAdjacentHTML('beforeend','<h1 class=reader>Read</h1>')"><span class="title">Sonnets</span></a></div>`;
  fs.writeFileSync(path.join(dir, 'data.json'), JSON.stringify({ shelf: 'English' }));
  fs.writeFileSync(
    path.join(dir, 'old.html'),
    page(
      `<div class="skeleton" style="height:40px">Loading</div><script>fetch('data.json').then(r=>r.json()).then(()=>setTimeout(()=>{document.querySelector('.skeleton').remove();document.body.insertAdjacentHTML('beforeend',${JSON.stringify(card)})},300))</script>`
    )
  );
  fs.writeFileSync(path.join(dir, 'new.html'), page(card));
  const milestones = {
    'shelves-ready': {
      selectors: ['h2.shelf', '.card .title'],
      probe: { activate: '.card a.open', expect: 'h1.reader' },
    },
  };
  const base = {
    profile: 'desktop',
    runs: 3,
    milestones: ['shelves-ready'],
  };
  const r = await measure({
    ...base,
    sides: {
      old: { mode: 'synthetic', root: dir, path: '/old.html', busy: '.skeleton', milestones },
      new: { mode: 'synthetic', root: dir, path: '/new.html', busy: '.skeleton', milestones },
    },
    thresholds: { caps: { 'shelves-ready': 5000 } },
  });
  printReport(r);
  const problems = [];
  const o = r.sides.old.milestones['shelves-ready'];
  const n = r.sides.new.milestones['shelves-ready'];
  if (o.missed || n.missed) problems.push('a milestone was missed');
  if (!(n.median < o.median))
    problems.push(`new (${n.median}) is not faster than old (${o.median})`);
  if (o.median < 300)
    problems.push(`old (${o.median}) finished before its 300 ms timer: busy state ignored`);
  if (n.probeFailures || o.probeFailures) problems.push('a probe failed');
  if (r.sides.old.label !== 'synthetic' || r.sides.new.label !== 'synthetic')
    problems.push('mode labels missing');
  if (!r.comparisons.length || !r.comparisons[0].diff_ci95) problems.push('no comparison or CI');
  if (r.failures.length) problems.push(`unexpected failures: ${r.failures.join('; ')}`);

  // A fixture run that sees a request it does not hold must be refused.
  const fixture = path.join(dir, 'fixture.json');
  fs.writeFileSync(
    fixture,
    JSON.stringify({
      provenance: { note: 'self-test' },
      responses: [
        {
          method: 'GET',
          url_path_and_query: '/old.html',
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body_base64: fs.readFileSync(path.join(dir, 'old.html')).toString('base64'),
        },
      ],
    })
  );
  const refused = await measure({
    ...base,
    runs: 1,
    sides: {
      old: { mode: 'synthetic', fixture, path: '/old.html', busy: '.skeleton', milestones },
      new: { mode: 'synthetic', root: dir, path: '/new.html', busy: '.skeleton', milestones },
    },
    thresholds: { improvement: 0.45 },
  });
  if (!refused.sides.old.unmatched.length)
    problems.push('the fixture recorded no unmatched request');
  if (!refused.refusals.length)
    problems.push('a run with an unmatched fixture request was not refused');
  if (!refused.failures.some((f) => /refused/.test(f)))
    problems.push('the improvement threshold was not refused');

  // Different modes are never compared.
  const mixed = await measure({
    ...base,
    runs: 1,
    sides: {
      old: {
        mode: 'synthetic-modelled',
        root: dir,
        path: '/old.html',
        busy: '.skeleton',
        milestones,
        delays: writeDelays(dir),
      },
      new: { mode: 'synthetic', root: dir, path: '/new.html', busy: '.skeleton', milestones },
    },
  });
  if (!mixed.refusals.some((x) => /different modes/.test(x)))
    problems.push('mixed modes were compared');

  fs.rmSync(dir, { recursive: true, force: true });
  if (problems.length) {
    for (const p of problems) console.log(`✗ self-test: ${p}`);
    console.log('SELF-TEST FAIL');
    return 1;
  }
  console.log(
    'SELF-TEST PASS — milestones, busy state, probes, labels, CI, fixture refusal and mode refusal behave.'
  );
  return 0;
}
function writeDelays(dir) {
  const f = path.join(dir, 'delays.json');
  fs.writeFileSync(f, JSON.stringify({ '/data.json': 50 }));
  return f;
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const m = a.match(/^--([^=]+)(?:=(.*))?$/);
      if (!m) throw new Error(`unknown argument ${a}`);
      return [m[1], m[2] ?? true];
    })
  );
  if (args['self-test']) return selfTest();
  if (!args.config) {
    console.error(
      'usage: node scripts/check_library_perf.js --config=FILE [--report=FILE] [--runs=N] | --self-test'
    );
    return 2;
  }
  const config = JSON.parse(fs.readFileSync(args.config, 'utf8'));
  if (args.runs) config.runs = Number(args.runs);
  const report = await measure(config, path.dirname(path.resolve(args.config)));
  if (args.report) fs.writeFileSync(args.report, JSON.stringify(report, null, 2) + '\n');
  printReport(report);
  return report.failures.length && report.thresholded ? 1 : 0;
}

if (require.main === module)
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e.stack || e.message);
      process.exit(1);
    }
  );

module.exports = { measure, median, quantile, mad, bootstrapDiffCI, PROFILES };
