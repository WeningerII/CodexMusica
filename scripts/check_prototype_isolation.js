#!/usr/bin/env node
'use strict';
/* global document, window, location, localStorage, sessionStorage, indexedDB, caches, Storage, Document, IDBFactory, getComputedStyle */
// check_prototype_isolation.js — the #670 prototype stays inside R2's limits
// (#670, 6622432911) and its shell meets the spec §3 baseline.
//
// The prototype lives in prototype/ and nowhere else. This gate fails when:
//
//   1. NETWORK. Any request leaves the origin, or reaches /mcp or /chat on it.
//      Every request the page makes is recorded; off-origin ones are aborted.
//      Statically, no prototype file names an absolute or protocol-relative
//      URL, and fetch() is only ever given the committed static catalog
//      (../api/).
//   2. STORAGE. Statically, only prototype/storage.js may name localStorage,
//      and no prototype file names sessionStorage, indexedDB, caches,
//      document.cookie or serviceWorker; so every storage access, by method
//      or by property, goes through the one wrapper that refuses any key
//      outside `codex-prototype:`. At runtime, a getItem/setItem/removeItem/
//      key/clear call on a key outside the namespace, or any IndexedDB open,
//      Cache Storage open, cookie access or service-worker registration,
//      fails. Every production key is pre-seeded with a sentinel (and the
//      production IndexedDB databases with a sentinel record) and must be
//      byte-unchanged after the full sweep, and neither localStorage nor
//      sessionStorage may gain a key outside the namespace. A positive control
//      requires the prototype's own route key to be written, so a page that
//      stored nothing cannot pass by accident. The namespace shares the
//      production app's origin and so its quota (Jony, #719): everything under
//      it must stay within OWN_BYTES_MAX.
//   3. SEPARATION. codex.html, the app source (src/), the Library chunks
//      (library/code/) and the page builder name neither a path to the
//      prototype (/prototype, ./prototype, ../prototype, with or without a
//      trailing slash; `Object.prototype` is not a path) nor the prototype's
//      storage namespace, so no prototype byte reaches the shipped
//      page or any check_payload_budget row. With --base=REF it also fails if
//      codex.html or library/code/ differ from REF (use it on prototype PRs;
//      it is not part of the standing suite, where other PRs change them).
//   4. SHELL. At 320, 390 and 1280 px every route is reachable from the nav by
//      keyboard and (at 390) by touch; a route change moves focus to the new
//      panel's heading; "Your recipe" is present on every route; nav targets
//      are at least 44 px; Back returns to the previous route; a reload
//      restores the last route; there is no horizontal scroll at 320 px, at
//      200% zoom, or with the browser's default font size doubled (and the
//      text does grow then); reduced motion leaves no animation or
//      transition; a storage failure and a catalog failure each leave a
//      working page with an honest message.
//   5. CHECKLIST. prototype/workflows.json holds the six spec §3 workflows,
//      numbered 1–6, each pending or naming a scenario file that exists, with
//      the 6622487968 §2 corrections (no Undo "across the reload", no
//      workspace "restore"). prototype/fixtures.js holds all seven states.
//
//   node scripts/check_prototype_isolation.js [--base=REF]
//
// CHROMIUM_PATH may name a Chromium executable.

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { start } = require('./_pages_server.js');

const root = path.resolve(__dirname, '..');
const PROTO_DIR = path.join(root, 'prototype');
const NS = 'codex-prototype:';
const ROUTES = ['browse', 'genre', 'instrument', 'map', 'lyrics', 'library'];
const WIDTHS = [320, 390, 1280];
const FIXTURE_STATES = [
  'pending',
  'partial',
  'refusal',
  'cancel',
  'resume',
  'stale',
  'storage-failure',
];

// The production app's keys as of this gate (src/app.js, src/pages/*,
// src/library/*). The gate does not rely on this list being complete — any
// key outside the namespace fails rule 2 — but each listed key is seeded with
// a sentinel so a write that slipped past the instrumentation is still caught.
const PRODUCTION_LOCAL_KEYS = [
  'codex-workbench-v1',
  'codex-workbench-recovery',
  'codex-layout:recipe-dock',
  'codex-theme',
  'codex:prefaceRecent',
  'codex-musica-chat-v2:gemini',
  'codex-musica-library-handshake:probe',
  'musica-workbench-v3',
  'musica-study-v1',
  'musica-writing-v1',
  'musica-lyrics-v3',
  'cm-library-reader',
  'export-format',
];
const PRODUCTION_DBS = [
  'codex-musica',
  'codex-musica-library-v1',
  'codex-musica-library-analysis-v1',
  'codex-musica-library-drafts',
];
const sentinel = (k) => `sentinel:${k}:do-not-touch`;
// The prototype shares the production origin's ~5 MB storage quota. Its own
// keys and values together stay under this many characters, so a feature
// slice cannot crowd production's autosave out unnoticed (Jony, #719).
const OWN_BYTES_MAX = 64 * 1024;
// Only the wrapper may name a storage area; no prototype file names the rest.
const STORAGE_NAMES =
  /\b(localStorage|sessionStorage|indexedDB|caches|serviceWorker)\b|document\.cookie/g;
const STORAGE_ALLOWED = { 'prototype/storage.js': ['localStorage'] };
// A path to the prototype, not `Foo.prototype`.
const PROTOTYPE_PATH = /(?:^|[^.\w$])\.{0,2}\/prototype\b/;

const problems = [];
let checks = 0;
const expect = (ok, what) => {
  checks++;
  if (!ok) problems.push(what);
};

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// ── 1 (static), 3 and 5: files on disk ─────────────────────────────────────
function staticChecks(base) {
  expect(fs.existsSync(path.join(PROTO_DIR, 'index.html')), 'prototype/index.html is missing');
  for (const file of walk(PROTO_DIR)) {
    const rel = path.relative(root, file);
    if (!/\.(html|js|mjs|css|json)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    expect(
      !/(?:https?:)?\/\/[\w-]+\.[\w.-]+\//i.test(text),
      `${rel}: names an absolute or protocol-relative URL`
    );
    expect(
      !/\b(XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(text),
      `${rel}: opens a network channel other than fetch() of the static catalog`
    );
    if (/\.(m?js|html)$/.test(file)) {
      const allowed = STORAGE_ALLOWED[rel.split(path.sep).join('/')] || [];
      const named = [...new Set([...text.matchAll(STORAGE_NAMES)].map((m) => m[0]))];
      const stray = named.filter((n) => !allowed.includes(n));
      expect(
        !stray.length,
        `${rel}: names ${stray.join(', ')}; only prototype/storage.js may touch storage, and only localStorage`
      );
    }
    for (const m of text.matchAll(/\bfetch\(\s*([^)]*)\)/g)) {
      expect(
        /^['"`]\.\.\/api\/[\w./-]+['"`]$/.test(m[1].trim()),
        `${rel}: fetch(${m[1].trim()}) is not a literal path into the static catalog (../api/)`
      );
    }
  }

  const shipped = [
    'codex.html',
    'scripts/build_html.js',
    ...walk(path.join(root, 'src')).map((f) => path.relative(root, f)),
    ...walk(path.join(root, 'library', 'code')).map((f) => path.relative(root, f)),
  ];
  for (const rel of shipped) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    expect(
      !PROTOTYPE_PATH.test(text) && !text.includes(NS),
      `${rel}: names the prototype (a /prototype path or ${NS}); prototype code must stay out of the shipped page`
    );
  }
  if (base) {
    let changed = '';
    try {
      changed = execFileSync(
        'git',
        ['diff', '--name-only', `${base}...HEAD`, '--', 'codex.html', 'library/code'],
        { cwd: root, encoding: 'utf8' }
      ).trim();
    } catch (e) {
      expect(false, `--base=${base}: git diff failed (${e.message.split('\n')[0]})`);
    }
    expect(
      !changed,
      `codex.html or library/code/ differ from ${base}: ${changed.replace(/\n/g, ', ')}`
    );
  }

  const wf = JSON.parse(fs.readFileSync(path.join(PROTO_DIR, 'workflows.json'), 'utf8'));
  const list = wf.workflows || [];
  expect(
    list.length === 6 && list.every((w, i) => w.id === i + 1),
    `workflows.json: expected workflows 1–6 in order, found ids [${list.map((w) => w.id)}]`
  );
  for (const w of list) {
    const done = w.status !== 'pending';
    expect(
      !done || (w.scenario && fs.existsSync(path.join(root, w.scenario))),
      `workflow ${w.id}: status "${w.status}" without an existing scenario file`
    );
    expect(typeof w.steps === 'string' && w.steps.length > 40, `workflow ${w.id}: no steps`);
  }
  const byId = Object.fromEntries(list.map((w) => [w.id, w.steps || '']));
  expect(
    !/across the reload/i.test(byId[1]),
    'workflow 1: still says Undo/Redo work across the reload (withdrawn, 6622487968 §2)'
  );
  expect(
    !/\brestor/i.test(byId[2]),
    'workflow 2: still includes restoring a deleted workspace (removed, 6622487968 §2)'
  );
}

// ── the browser instrumentation (rules 1 and 2) ────────────────────────────
// Installed on every page, active only under /prototype/, so seeding the
// production keys from another same-origin page is not itself reported.
function instrument() {
  if (!location.pathname.startsWith('/prototype/')) return;
  const NS = 'codex-prototype:';
  const report = (kind, name) => window.__isoReport && window.__isoReport(kind, String(name));
  const S = Storage.prototype;
  for (const m of ['getItem', 'setItem', 'removeItem']) {
    const orig = S[m];
    S[m] = function (k, ...rest) {
      if (!String(k).startsWith(NS)) report(`storage.${m}`, k);
      return orig.call(this, k, ...rest);
    };
  }
  const clear = S.clear;
  S.clear = function () {
    report('storage.clear', '*');
    return clear.call(this);
  };
  const key = S.key;
  S.key = function (i) {
    report('storage.key', i);
    return key.call(this, i);
  };
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (name, ...rest) {
    if (!String(name).startsWith(NS)) report('indexedDB.open', name);
    return open.call(this, name, ...rest);
  };
  const del = IDBFactory.prototype.deleteDatabase;
  IDBFactory.prototype.deleteDatabase = function (name) {
    if (!String(name).startsWith(NS)) report('indexedDB.deleteDatabase', name);
    return del.call(this, name);
  };
  if (window.caches) {
    const co = caches.open.bind(caches);
    caches.open = (name) => {
      report('caches.open', name);
      return co(name);
    };
  }
  const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(Document.prototype, 'cookie', {
    get() {
      report('cookie.get', '');
      return cookie.get.call(this);
    },
    set(v) {
      report('cookie.set', v);
      cookie.set.call(this, v);
    },
  });
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register = (u) => {
      report('serviceWorker.register', u);
      return Promise.reject(new Error('blocked by check_prototype_isolation'));
    };
  }
}

function breakStorage() {
  if (!location.pathname.startsWith('/prototype/')) return;
  const fail = () => {
    throw new DOMException('blocked', 'SecurityError');
  };
  Storage.prototype.setItem = fail;
  Storage.prototype.getItem = fail;
}

async function seed(page, url) {
  await page.goto(`${url}/api/index.json`);
  await page.evaluate(
    async ({ keys, dbs }) => {
      for (const k of keys) {
        localStorage.setItem(k, `sentinel:${k}:do-not-touch`);
        sessionStorage.setItem(k, `sentinel:${k}:do-not-touch`);
      }
      for (const name of dbs) {
        await new Promise((res, rej) => {
          const req = indexedDB.open(name, 1);
          req.onupgradeneeded = () => req.result.createObjectStore('sentinel');
          req.onsuccess = () => {
            const tx = req.result.transaction('sentinel', 'readwrite');
            tx.objectStore('sentinel').put(`sentinel:${name}:do-not-touch`, 'probe');
            tx.oncomplete = () => {
              req.result.close();
              res();
            };
            tx.onerror = () => rej(tx.error);
          };
          req.onerror = () => rej(req.error);
        });
      }
    },
    { keys: PRODUCTION_LOCAL_KEYS, dbs: PRODUCTION_DBS }
  );
}

async function verifySentinels(page, url, at) {
  await page.goto(`${url}/api/index.json`);
  const state = await page.evaluate(
    async ({ keys, dbs }) => {
      const local = {};
      const session = {};
      for (const k of keys) {
        local[k] = localStorage.getItem(k);
        session[k] = sessionStorage.getItem(k);
      }
      const own = [];
      for (let i = 0; i < localStorage.length; i++) own.push(localStorage.key(i));
      const sessionKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) sessionKeys.push(sessionStorage.key(i));
      const ownBytes = own
        .filter((k) => k.startsWith('codex-prototype:'))
        .reduce((n, k) => n + k.length + (localStorage.getItem(k) || '').length, 0);
      const db = {};
      for (const name of dbs) {
        db[name] = await new Promise((res) => {
          const req = indexedDB.open(name, 1);
          req.onsuccess = () => {
            try {
              const g = req.result.transaction('sentinel').objectStore('sentinel').get('probe');
              g.onsuccess = () => {
                req.result.close();
                res(g.result);
              };
              g.onerror = () => res(null);
            } catch {
              res(null);
            }
          };
          req.onerror = () => res(null);
        });
      }
      return { local, session, db, keys: own, sessionKeys, ownBytes };
    },
    { keys: PRODUCTION_LOCAL_KEYS, dbs: PRODUCTION_DBS }
  );
  for (const k of PRODUCTION_LOCAL_KEYS) {
    expect(state.local[k] === sentinel(k), `${at}: localStorage "${k}" changed`);
    expect(state.session[k] === sentinel(k), `${at}: sessionStorage "${k}" changed`);
  }
  for (const name of PRODUCTION_DBS) {
    expect(state.db[name] === sentinel(name), `${at}: IndexedDB "${name}" changed`);
  }
  const foreign = state.keys.filter((k) => !k.startsWith(NS) && !PRODUCTION_LOCAL_KEYS.includes(k));
  expect(!foreign.length, `${at}: new non-prototype localStorage keys: ${foreign.join(', ')}`);
  const foreignSession = state.sessionKeys.filter(
    (k) => !k.startsWith(NS) && !PRODUCTION_LOCAL_KEYS.includes(k)
  );
  expect(
    !foreignSession.length,
    `${at}: new non-prototype sessionStorage keys: ${foreignSession.join(', ')}`
  );
  expect(
    state.ownBytes <= OWN_BYTES_MAX,
    `${at}: the prototype stores ${state.ownBytes} characters under ${NS}, over its ${OWN_BYTES_MAX} share of the origin's quota`
  );
  return state.keys;
}

function watchNetwork(context, origin, at) {
  const offenders = [];
  context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== origin) {
      offenders.push(`off-origin ${u.href}`);
      return route.abort();
    }
    if (/^\/(mcp|chat)(\/|$)/.test(u.pathname)) offenders.push(`connector path ${u.pathname}`);
    return route.continue();
  });
  return () => {
    for (const o of offenders) expect(false, `${at}: request ${o}`);
  };
}

async function newContext(browser, opts, reports) {
  const context = await browser.newContext(opts);
  await context.exposeFunction('__isoReport', (kind, name) => reports.push(`${kind} ${name}`));
  await context.addInitScript(instrument);
  return context;
}

// Fails when the page scrolls sideways, naming the elements that stick out.
async function expectNoHScroll(page, what) {
  const wide = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return '';
    return [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > doc.clientWidth + 0.5)
      .slice(0, 4)
      .map((el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''))
      .join(', ');
  });
  expect(!wide, `${what} (wider than the viewport: ${wide})`);
}

// A route is shown once its hash is set AND the hashchange handler has run:
// location.hash changes before the event fires, so waiting on it alone races.
const waitRoute = (page, route) =>
  page.waitForFunction(
    (r) =>
      location.hash === `#${r}` &&
      !document.querySelector(`[data-panel="${r}"]`).hidden &&
      document.querySelector(`[data-route="${r}"]`).getAttribute('aria-current') === 'page',
    route
  );

async function routeState(page) {
  return page.evaluate(() => {
    const visible = [...document.querySelectorAll('[data-panel]')]
      .filter((p) => !p.hidden && p.getBoundingClientRect().height > 0)
      .map((p) => p.dataset.panel);
    const active = document.activeElement;
    const panel = active && active.closest('[data-panel]');
    const recipe = document.querySelector('aside.recipe');
    const rb = recipe && recipe.getBoundingClientRect();
    return {
      hash: location.hash,
      visible,
      current: [...document.querySelectorAll('[data-route][aria-current="page"]')].map(
        (a) => a.dataset.route
      ),
      focusPanel: panel ? panel.dataset.panel : null,
      focusIsHeading: !!active && active.tagName === 'H1',
      recipe: !!rb && rb.width > 0 && rb.height > 0 && !recipe.hidden,
    };
  });
}

async function sweep(browser, url, width) {
  const at = `@${width}`;
  const reports = [];
  const touch = width === 390;
  const context = await newContext(
    browser,
    { viewport: { width, height: 800 }, hasTouch: touch, isMobile: touch },
    reports
  );
  const flush = watchNetwork(context, url, at);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seed(page, url);

  await page.goto(`${url}/prototype/`);
  const catalogLoaded = await page
    .waitForFunction(
      () => /Catalog: \d+ traditions/.test(document.getElementById('proto-catalog').textContent),
      null,
      { timeout: 15000 }
    )
    .then(() => true)
    .catch(() => false);
  expect(catalogLoaded, `${at}: the catalog count from ../api/index.json never showed`);
  let s = await routeState(page);
  expect(
    s.visible.join() === 'browse',
    `${at}: first paint shows [${s.visible}] instead of browse`
  );
  expect(s.focusPanel === null, `${at}: the first paint took focus into a panel`);
  await expectNoHScroll(page, `${at}: horizontal scroll on first paint`);

  const sizes = await page.$$eval('[data-route]', (as) =>
    as.map((a) => {
      const r = a.getBoundingClientRect();
      return { route: a.dataset.route, w: r.width, h: r.height };
    })
  );
  for (const z of sizes) {
    expect(
      z.w >= 44 && z.h >= 44,
      `${at}: nav "${z.route}" is ${Math.round(z.w)}×${Math.round(z.h)} px, under 44×44`
    );
  }

  let previous = 'browse';
  for (const route of ROUTES.filter((r) => r !== 'browse').concat('browse')) {
    const link = page.locator(`[data-route="${route}"]`);
    if (touch) {
      await link.tap();
    } else {
      await link.focus();
      await page.keyboard.press('Enter');
    }
    await waitRoute(page, route);
    await page
      .waitForFunction(
        (r) => document.activeElement && document.activeElement.closest(`[data-panel="${r}"]`),
        route,
        { timeout: 3000 }
      )
      .catch(() => {});
    s = await routeState(page);
    const how = touch ? 'tap' : 'Enter';
    expect(s.visible.join() === route, `${at}: ${how} on ${route} shows [${s.visible}]`);
    expect(s.current.join() === route, `${at}: ${route}: aria-current on [${s.current}]`);
    expect(
      s.focusPanel === route && s.focusIsHeading,
      `${at}: ${how} on ${route} left focus outside its panel heading (in ${s.focusPanel})`
    );
    expect(s.recipe, `${at}: "Your recipe" is not shown on ${route}`);
    await expectNoHScroll(page, `${at}: horizontal scroll on ${route}`);
    previous = route;
  }

  // Back returns to the route before; a reload restores the last route.
  await page.locator('[data-route="lyrics"]').click();
  await waitRoute(page, 'lyrics');
  await page.goBack();
  await waitRoute(page, previous);
  s = await routeState(page);
  expect(s.visible.join() === previous, `${at}: Back shows [${s.visible}], not ${previous}`);
  await page.locator('[data-route="map"]').click();
  await waitRoute(page, 'map');
  await page.waitForFunction((k) => localStorage.getItem(k) === '"map"', `${NS}route`);
  await page.goto(`${url}/prototype/`);
  s = await routeState(page);
  expect(
    s.visible.join() === 'map',
    `${at}: a reload without a hash shows [${s.visible}], not map`
  );

  const ownKeys = await verifySentinels(page, url, at);
  expect(
    ownKeys.includes(`${NS}route`),
    `${at}: the prototype never wrote ${NS}route, so the storage gate proved nothing`
  );
  flush();
  for (const r of [...new Set(reports)])
    expect(false, `${at}: touched non-prototype storage: ${r}`);
  for (const e of errors) expect(false, `${at}: page error: ${e}`);
  await context.close();
}

async function zoomAndText(browser, url) {
  // 200% zoom on a 1280 px window is a 640 px CSS viewport.
  const reports = [];
  const context = await newContext(browser, { viewport: { width: 640, height: 800 } }, reports);
  const page = await context.newPage();
  for (const route of ROUTES) {
    await page.goto(`${url}/prototype/#${route}`);
    await expectNoHScroll(page, `200% zoom: horizontal scroll on ${route}`);
  }
  await context.close();

  for (const width of [320, 1280]) {
    const c = await newContext(browser, { viewport: { width, height: 800 } }, reports);
    const p = await c.newPage();
    const cdp = await c.newCDPSession(p);
    await p.goto(`${url}/prototype/`);
    const before = await p.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32 } });
    for (const route of ROUTES) {
      await p.goto(`${url}/prototype/#${route}`);
      await expectNoHScroll(p, `default font 32 px @${width}: horizontal scroll on ${route}`);
    }
    const after = await p.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
    expect(
      after >= before * 1.9,
      `default font 32 px @${width}: body text went ${before} → ${after} px, so raising the browser font size does not enlarge it`
    );
    await c.close();
  }
  for (const r of [...new Set(reports)])
    expect(false, `zoom/text: touched non-prototype storage: ${r}`);
}

async function reducedMotion(browser, url) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  for (const route of ROUTES) {
    await page.goto(`${url}/prototype/#${route}`);
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          const dur = (v) => v.split(',').some((d) => parseFloat(d) > 0.01);
          return (
            (cs.animationName !== 'none' && dur(cs.animationDuration)) ||
            (cs.transitionProperty !== 'none' && dur(cs.transitionDuration))
          );
        })
        .map((el) => el.tagName + (el.className ? `.${el.className}` : ''))
    );
    expect(!moving.length, `reduced motion: ${route} still animates ${moving.join(', ')}`);
  }
  await context.close();
}

async function failures(browser, url) {
  // Storage that throws on every call: the shell still switches routes and
  // says, in its status region, that nothing is being saved.
  const context = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await context.addInitScript(breakStorage);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}/prototype/`);
  await page.locator('[data-route="library"]').click();
  await waitRoute(page, 'library');
  const s = await routeState(page);
  expect(s.visible.join() === 'library', `storage failure: the shell stopped switching routes`);
  const msg = await page.locator('#proto-status[role="status"]').textContent();
  expect(/not saved/i.test(msg || ''), `storage failure: no honest status message ("${msg}")`);
  for (const e of errors) expect(false, `storage failure: page error: ${e}`);
  await context.close();

  // The catalog does not load: say so instead of showing a count.
  const c2 = await browser.newContext({ viewport: { width: 390, height: 800 } });
  await c2.route('**/api/index.json', (r) => r.fulfill({ status: 404, body: 'missing' }));
  const p2 = await c2.newPage();
  await p2.goto(`${url}/prototype/`);
  const shown = await p2
    .waitForFunction(() =>
      /did not load/.test(document.getElementById('proto-catalog').textContent)
    )
    .then(() => true)
    .catch(() => false);
  expect(shown, 'catalog failure: no honest message in "Your recipe"');
  await c2.close();
}

async function fixtures(browser, url) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${url}/prototype/`);
  const got = await page.evaluate(async () => {
    const m = await import('/prototype/fixtures.js');
    const all = await Promise.all(m.FIXTURE_STATES.map((s) => m.replay(s)));
    const again = await m.replay(m.FIXTURE_STATES[0]);
    all[0].message = 'mutated';
    const unknown = await m.replay('no-such-state').then(
      () => 'resolved',
      () => 'rejected'
    );
    return {
      states: m.FIXTURE_STATES,
      shaped: all.every((f, i) => f.state === m.FIXTURE_STATES[i] && f.message),
      copies: again.message !== 'mutated',
      unknown,
    };
  });
  for (const s of FIXTURE_STATES) {
    expect(got.states.includes(s), `fixtures: no fixture for the "${s}" state`);
  }
  expect(got.shaped, 'fixtures: a fixture lacks its state or message');
  expect(got.copies, 'fixtures: replay hands out a shared object');
  expect(got.unknown === 'rejected', 'fixtures: an unknown state resolves instead of failing');
  await context.close();
}

(async () => {
  const base = (process.argv.find((a) => a.startsWith('--base=')) || '').slice(7) || null;
  staticChecks(base);
  const srv = await start({ root });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    for (const w of WIDTHS) await sweep(browser, srv.url, w);
    await zoomAndText(browser, srv.url);
    await reducedMotion(browser, srv.url);
    await failures(browser, srv.url);
    await fixtures(browser, srv.url);
  } finally {
    await browser.close();
    await srv.close();
  }
  if (problems.length) {
    console.error(`check_prototype_isolation: FAIL — ${problems.length} of ${checks} checks`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(`check_prototype_isolation: ${checks}/${checks} checks pass`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
