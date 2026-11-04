#!/usr/bin/env node
'use strict';
/* global document, window, localStorage, Storage */
// check_prototype_hosts.js — the #670 prototype shell mounts feature lanes
// exactly as the contract in #670 6639542176 §1 (with 6640163315 for the
// browse items) says, whatever the lanes themselves do.
//
// The lanes' own files are not under test here. Every request for a
// registered lane module is answered with a probe lane that records what it
// was given, so the gate checks the shell side alone. It fails when:
//
//   1. LAZY. A lane's module is requested before its route is first shown,
//      or is not requested when it is.
//   2. CTX. A lane's ctx is not frozen, lacks or adds a field (browse:
//      storage, announce, signal, items; lyrics: storage, announce, signal,
//      text, onChange), or the host is not empty when mount() runs, or the
//      placeholder stays visible beside a mounted lane.
//   3. ITEMS. ctx.items is not a frozen array of frozen { id, name, family,
//      place } in the catalog's order and number; `place` is not null for
//      exactly the catalog ids data/no-fixed-origin.json lists; a place lacks
//      lat, lng, label, region or a provenance status of verified, reviewed
//      or unreviewed; or bluegrass is not placed at Rosine, as data/geo.json
//      records it.
//   4. STORAGE. ctx.storage.write does not land under
//      `codex-prototype:<lane>-`, or a write past the 64 KiB ceiling is not
//      refused as "full" (and stored nothing), or remove() leaves the name.
//   5. ANNOUNCE. ctx.announce does not reach the shell's role="status".
//   6. KEEP. Leaving a route and coming back mounts the lane again, or loses
//      its node or its typed text; or a route change does not focus the
//      panel's heading with a lane mounted.
//   7. DRAFT. The Lyrics text the lane reported through onChange is not
//      handed back as ctx.text after a reload, or a refused write is not
//      said ("Not saved") in the status region.
//   8. FAILURE. A missing lane module, a mount() that throws, or catalog data
//      that won't load does not leave one honest sentence in that panel, in
//      place of the placeholder, and a working shell, with no uncaught error.
//   9. UNMOUNT. unmount() does not abort ctx.signal, remove the host and
//      restore the placeholder.
//
//   node scripts/check_prototype_hosts.js
//
// CHROMIUM_PATH may name a Chromium executable.

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { start } = require('./_pages_server.js');

const root = path.resolve(__dirname, '..');
const NS = 'codex-prototype:';
const LANE_MODULES = {
  browse: '/prototype/features/browse-map/discovery.js',
  lyrics: '/prototype/features/lyrics/editor.js',
};
const CTX_KEYS = {
  browse: ['announce', 'items', 'signal', 'storage'],
  lyrics: ['announce', 'onChange', 'signal', 'storage', 'text'],
};

const problems = [];
let checks = 0;
const expect = (ok, what) => {
  checks++;
  if (!ok) problems.push(what);
};

// The probe lane. It runs in the page, so it may use window (it is served by
// this gate, never committed under prototype/features/).
const PROBE = `
export function mount(host, ctx) {
  const lane = host.dataset.featureHost;
  const all = (window.__probe = window.__probe || {});
  const rec = (all[lane] = {
    mounts: ((all[lane] && all[lane].mounts) || 0) + 1,
    keys: Object.keys(ctx).sort(),
    frozen: Object.isFrozen(ctx),
    hostEmpty: host.childNodes.length === 0,
    aborted: false,
    unmounted: false,
    text: ctx.text,
  });
  (window.__probeCtx = window.__probeCtx || {})[lane] = ctx;
  ctx.signal.addEventListener('abort', () => { rec.aborted = true; });
  const field = document.createElement('textarea');
  field.setAttribute('aria-label', lane + ' probe');
  field.dataset.probe = lane;
  field.value = typeof ctx.text === 'string' ? ctx.text : '';
  host.append(field);
  field.addEventListener('input', () => ctx.onChange && ctx.onChange(field.value), { signal: ctx.signal });
  rec.write = ctx.storage.write('pref', { n: 1 });
  if (window.__probeThrow === lane) throw new Error('probe mount failure');
  return { unmount() { rec.unmounted = true; }, focus() { field.focus(); } };
}
`;

async function newPage(browser, srv, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const requested = [];
  const errors = [];
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== srv.url) return route.abort();
    const lane = Object.keys(LANE_MODULES).find((l) => LANE_MODULES[l] === u.pathname);
    if (lane) {
      requested.push(lane);
      if ((opts.missing || []).includes(lane)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: PROBE });
    }
    if ((opts.fail || []).includes(u.pathname)) return route.fulfill({ status: 404, body: '' });
    return route.continue();
  });
  if (opts.init) await context.addInitScript(opts.init.fn, opts.init.arg);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, requested, errors };
}

const probe = (page, lane) => page.evaluate((l) => (window.__probe || {})[l] || null, lane);
const waitMounted = (page, lane) =>
  page.waitForFunction((l) => window.__probe && window.__probe[l], lane, { timeout: 15000 });
const noteOf = (page, route) =>
  page.evaluate((r) => {
    const n = document.querySelector(`[data-panel="${r}"] [data-host-note]`);
    return n ? n.textContent : null;
  }, route);
const placeholderVisible = (page, route) =>
  page.evaluate(
    (r) => !document.querySelector(`[data-panel="${r}"] [data-placeholder]`).hidden,
    route
  );

async function mounting(browser, srv) {
  const { context, page, requested, errors } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#browse`);
  await waitMounted(page, 'browse');
  // 1. lazy
  expect(
    requested.includes('browse'),
    'lazy: the Browse lane was not loaded when Browse was shown'
  );
  expect(!requested.includes('lyrics'), 'lazy: the Lyrics lane loaded before its route was shown');
  // 2. ctx (browse)
  const b = await probe(page, 'browse');
  expect(
    JSON.stringify(b.keys) === JSON.stringify(CTX_KEYS.browse),
    `ctx: browse got [${b.keys}], expected [${CTX_KEYS.browse}]`
  );
  expect(b.frozen, 'ctx: the browse ctx is not frozen');
  expect(b.hostEmpty, 'ctx: the browse host was not empty when mount() ran');
  expect(
    !(await placeholderVisible(page, 'browse')),
    'ctx: the Browse placeholder shows beside the lane'
  );
  // 3. items
  const items = await page.evaluate(async () => {
    const ctx = window.__probeCtx.browse;
    const list = ctx.items;
    const index = await (await fetch('../api/traditions/index.json')).json();
    const none = new Set((await (await fetch('../data/no-fixed-origin.json')).json()).ids);
    const STATUS = ['verified', 'reviewed', 'unreviewed'];
    const bad = [];
    list.forEach((it, i) => {
      const t = index.items[i];
      const keys = Object.keys(it).sort().join();
      if (keys !== 'family,id,name,place') bad.push(`${i}: keys ${keys}`);
      else if (!Object.isFrozen(it)) bad.push(`${it.id}: not frozen`);
      else if (!t || it.id !== t.id || it.name !== t.name || it.family !== t.family)
        bad.push(`${i}: ${it.id} out of the catalog's order`);
      else if (none.has(it.id) !== (it.place === null))
        bad.push(
          `${it.id}: place ${it.place === null ? 'null' : 'set'}, no-fixed-origin ${none.has(it.id)}`
        );
      else if (
        it.place &&
        !(
          Object.isFrozen(it.place) &&
          Number.isFinite(it.place.lat) &&
          Number.isFinite(it.place.lng) &&
          typeof it.place.label === 'string' &&
          it.place.label &&
          typeof it.place.region === 'string' &&
          STATUS.includes(it.place.provenance && it.place.provenance.status)
        )
      )
        bad.push(`${it.id}: incomplete place ${JSON.stringify(it.place)}`);
    });
    const blue = list.find((it) => it.id === 'bluegrass');
    return {
      frozen: Object.isFrozen(list) && Array.isArray(list),
      n: list.length,
      want: index.items.length,
      nulls: list.filter((it) => it.place === null).length,
      bad: bad.slice(0, 5),
      badCount: bad.length,
      blue: blue && blue.place && blue.place.label,
    };
  });
  expect(items.frozen, 'items: ctx.items is not a frozen array');
  expect(items.n === items.want, `items: ${items.n} items, the catalog index has ${items.want}`);
  expect(
    items.badCount === 0,
    `items: ${items.badCount} bad item(s), e.g. ${items.bad.join('; ')}`
  );
  expect(
    items.nulls > 0,
    'items: no item has place null, but the catalog has no-fixed-origin traditions'
  );
  expect(
    items.blue === 'Rosine',
    `items: bluegrass is placed at ${items.blue}, data/geo.json says Rosine`
  );
  // 4. storage (scoped)
  expect(
    b.write && b.write.ok,
    `storage: the browse lane's write failed (${JSON.stringify(b.write)})`
  );
  const ceiling = await page.evaluate(async () => {
    const m = await import('/prototype/storage.js');
    const s = m.scope('lyrics');
    const big = s.write('big', 'x'.repeat(m.CEILING));
    const stored = localStorage.getItem('codex-prototype:lyrics-big');
    const small = s.write('small', 'y');
    const removed = s.remove('small');
    return {
      key: localStorage.getItem('codex-prototype:browse-pref'),
      big,
      stored,
      small,
      removed,
      left: localStorage.getItem('codex-prototype:lyrics-small'),
      index: JSON.parse(localStorage.getItem('codex-prototype:index') || '[]'),
    };
  });
  expect(ceiling.key === '{"n":1}', `storage: browse's write did not land at ${NS}browse-pref`);
  expect(
    ceiling.big.ok === false && ceiling.big.reason === 'full' && ceiling.stored === null,
    `storage: a write past the ceiling was not refused as full (${JSON.stringify(ceiling.big)})`
  );
  expect(ceiling.small.ok, 'storage: a small write under the ceiling failed');
  expect(
    ceiling.removed.ok && ceiling.left === null && !ceiling.index.includes('lyrics-small'),
    'storage: remove() left the name stored or indexed'
  );
  // 5. announce
  const said = await page.evaluate(() => {
    window.__probeCtx.browse.announce('Probe announcement.');
    const s = document.getElementById('proto-status');
    return { text: s.textContent, role: s.getAttribute('role') };
  });
  expect(
    said.text === 'Probe announcement.' && said.role === 'status',
    `announce: the status region says "${said.text}"`
  );
  // 6. keep, with lyrics
  await page.locator('[data-route="lyrics"]').click();
  await waitMounted(page, 'lyrics');
  expect(
    requested.includes('lyrics'),
    'lazy: the Lyrics lane was not loaded when Lyrics was shown'
  );
  const l = await probe(page, 'lyrics');
  expect(
    JSON.stringify(l.keys) === JSON.stringify(CTX_KEYS.lyrics),
    `ctx: lyrics got [${l.keys}], expected [${CTX_KEYS.lyrics}]`
  );
  expect(l.frozen && l.hostEmpty, 'ctx: the lyrics ctx is not frozen, or its host was not empty');
  expect(l.text === '', `draft: a fresh Lyrics lane got text ${JSON.stringify(l.text)}`);
  expect(
    await page.evaluate(() => document.activeElement && document.activeElement.id === 'h-lyrics'),
    'keep: the route change to Lyrics did not focus the panel heading'
  );
  const field = page.locator('[data-probe="lyrics"]');
  await field.fill('Line one,\nline “two” — ♪');
  await page.evaluate(() => {
    document.querySelector('[data-probe="lyrics"]').__mark = 'same-node';
  });
  await page.locator('[data-route="browse"]').click();
  await page.locator('[data-route="lyrics"]').click();
  const kept = await page.evaluate(() => {
    const f = document.querySelector('[data-probe="lyrics"]');
    return { mark: f && f.__mark, value: f && f.value, mounts: window.__probe.lyrics.mounts };
  });
  expect(kept.mounts === 1, `keep: Lyrics was mounted ${kept.mounts} times across a route switch`);
  expect(kept.mark === 'same-node', 'keep: the Lyrics node was replaced across a route switch');
  expect(
    kept.value === 'Line one,\nline “two” — ♪',
    'keep: typed Lyrics text was lost across a route switch'
  );
  // 7. draft, across a reload
  await page.reload();
  await waitMounted(page, 'lyrics');
  const reloaded = await probe(page, 'lyrics');
  expect(
    reloaded.text === 'Line one,\nline “two” — ♪',
    `draft: after a reload ctx.text was ${JSON.stringify(reloaded.text)}`
  );
  const foreign = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => !k.startsWith('codex-prototype:'))
  );
  expect(!foreign.length, `storage: keys outside the namespace: ${foreign.join(', ')}`);
  expect(!errors.length, `mounting: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
}

async function refusedDraft(browser, srv) {
  const { context, page, errors } = await newPage(browser, srv, {
    init: {
      fn: () => {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (String(k).includes('lyrics-draft'))
            throw new DOMException('quota', 'QuotaExceededError');
          return set.call(this, k, v);
        };
      },
    },
  });
  await page.goto(`${srv.url}/prototype/#lyrics`);
  await waitMounted(page, 'lyrics');
  await page.locator('[data-probe="lyrics"]').fill('unsaved words');
  const said = await page.locator('#proto-status').textContent();
  expect(/^Not saved/.test(said), `draft: a refused draft write said "${said}"`);
  expect(
    (await page.locator('[data-probe="lyrics"]').inputValue()) === 'unsaved words',
    'draft: the text was lost when the write was refused'
  );
  expect(!errors.length, `draft: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
}

// The sentence a panel shows, once it has stopped saying "Loading…" (null if
// none appears within the wait).
async function settledNote(page, route) {
  try {
    await page.waitForFunction(
      (r) => {
        const n = document.querySelector(`[data-panel="${r}"] [data-host-note]`);
        return n && n.textContent && !/^Loading/.test(n.textContent);
      },
      route,
      { timeout: 10000 }
    );
  } catch {
    return null;
  }
  return noteOf(page, route);
}

async function failuresOf(browser, srv) {
  // A lane module that isn't in the build.
  {
    const { context, page, errors } = await newPage(browser, srv, { missing: ['lyrics'] });
    await page.goto(`${srv.url}/prototype/#lyrics`);
    const note = await settledNote(page, 'lyrics');
    expect(
      /isn’t part of this build/.test(note),
      `failure: a missing Lyrics module says ${JSON.stringify(note)}`
    );
    expect(
      !(await placeholderVisible(page, 'lyrics')),
      'failure: the placeholder still shows beside the sentence that replaces it'
    );
    await page.locator('[data-route="browse"]').click();
    await waitMounted(page, 'browse');
    expect(!errors.length, `failure (missing): uncaught errors: ${errors.join(' | ')}`);
    await context.close();
  }
  // A mount() that throws.
  {
    const { context, page, errors } = await newPage(browser, srv, {
      init: { fn: () => (window.__probeThrow = 'lyrics') },
    });
    await page.goto(`${srv.url}/prototype/#lyrics`);
    const note = await settledNote(page, 'lyrics');
    expect(
      /couldn’t start/.test(note),
      `failure: a mount() that threw left ${JSON.stringify(note)}`
    );
    const p = await probe(page, 'lyrics');
    expect(p && p.aborted, 'failure: a mount() that threw did not have its signal aborted');
    expect(!errors.length, `failure (throw): uncaught errors: ${errors.join(' | ')}`);
    await context.close();
  }
  // Catalog data that won't load.
  {
    const { context, page, errors } = await newPage(browser, srv, { fail: ['/data/geo.json'] });
    await page.goto(`${srv.url}/prototype/#browse`);
    const note = await settledNote(page, 'browse');
    expect(
      /did not load/.test(note),
      `failure: Browse without its catalog data says ${JSON.stringify(note)}`
    );
    expect(!(await probe(page, 'browse')), 'failure: Browse mounted without its catalog data');
    await page.locator('[data-route="lyrics"]').click();
    await waitMounted(page, 'lyrics');
    expect(!errors.length, `failure (data): uncaught errors: ${errors.join(' | ')}`);
    await context.close();
  }
}

async function unmounting(browser, srv) {
  const { context, page, errors } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#genre`);
  const got = await page.evaluate(async (src) => {
    const { createHost } = await import('/prototype/host.js');
    const panel = document.createElement('section');
    panel.innerHTML = '<h1>Probe</h1><p data-placeholder>Placeholder.</p>';
    document.body.append(panel);
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const h = createHost(
      {
        id: 'probe',
        label: 'Probe',
        load: () => import(url),
        context: async () => ({}),
        unloaded: 'x',
      },
      panel
    );
    await h.show();
    await h.show();
    const mounted = {
      state: h.state,
      host: !!panel.querySelector('[data-feature-host="probe"]'),
      mounts: window.__probe.probe.mounts,
    };
    h.unmount();
    return {
      mounted,
      aborted: window.__probe.probe.aborted,
      unmounted: window.__probe.probe.unmounted,
      host: !!panel.querySelector('[data-feature-host]'),
      placeholder: !panel.querySelector('[data-placeholder]').hidden,
      state: h.state,
    };
  }, PROBE);
  expect(
    got.mounted.state === 'mounted' && got.mounted.host && got.mounted.mounts === 1,
    `unmount: show() twice gave ${JSON.stringify(got.mounted)}`
  );
  expect(
    got.unmounted && got.aborted,
    'unmount: the lane was not unmounted, or ctx.signal not aborted'
  );
  expect(
    !got.host && got.placeholder && got.state === 'idle',
    'unmount: the host stayed, or the placeholder did not return'
  );
  expect(!errors.length, `unmount: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
}

(async () => {
  for (const [lane, mod] of Object.entries(LANE_MODULES)) {
    const app = fs.readFileSync(path.join(root, 'prototype', 'app.js'), 'utf8');
    expect(
      app.includes(`import('.${mod.slice('/prototype'.length)}')`),
      `registry: app.js does not load the ${lane} lane from ${mod}`
    );
  }
  const srv = await start({ root });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    await mounting(browser, srv);
    await refusedDraft(browser, srv);
    await failuresOf(browser, srv);
    await unmounting(browser, srv);
  } finally {
    await browser.close();
    await srv.close();
  }
  if (problems.length) {
    console.error(`check_prototype_hosts: FAIL — ${problems.length} of ${checks} checks`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(`check_prototype_hosts: ${checks}/${checks} checks pass`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
