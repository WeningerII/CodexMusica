#!/usr/bin/env node
'use strict';
/* global document, window, localStorage, Storage, history */
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
//  10. LIBRARY (6640163315, 6640718497). ctx.shelves is not catalog.json's
//      shelves in order, frozen, with production's language names
//      (src/library/core.js LANGUAGE_NAMES) and its card mapping; loadMore
//      does not append exactly the next readable rows of collections.json for
//      that language, with first: null, or a data_id that disagrees with the
//      catalog is not refused as DATA_CHANGED; openReading does not resolve a
//      preview card to its `first` and an appended card to the first of its
//      collection file's readable_ids, or does not refuse a bad id
//      (NOT_FOUND) and a collection with nothing readable (NO_READABLE);
//      selection does not toggle all of a collection's units and notify; or
//      showCredit does not say artwork.json's credit. Each refusal's message
//      is not its sentence, with a next step (SAYS).
//  11. REFERENCE (#747, #750). The Library panel does not hold Explore, the
//      sources and credits, and the method reference in that order; their ctx
//      is not catalog.json, artwork.json and methods.json exactly, deep-frozen;
//      artworkUrls is not one committed rendition per artwork; or inspectAll
//      does not say the Works list isn't here yet.
//  12. ADAPTERS. media.resolve lets a remote, climbing or non-string image
//      through, or refuses a committed one; overlay.open does not hold one
//      history entry and a scroll lock that Back releases with one onClose,
//      close() releases without one, and a second overlay takes over cleanly.
//   9. UNMOUNT. unmount() does not abort ctx.signal, remove the host and
//      restore the placeholder.
//
//   node scripts/check_prototype_hosts.js
//
// CHROMIUM_PATH may name a Chromium executable.

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { start } = require('./_pages_server.js');

const root = path.resolve(__dirname, '..');
const NS = 'codex-prototype:';
const LANE_MODULES = {
  browse: '/prototype/features/browse-map/discovery.js',
  lyrics: '/prototype/features/lyrics/editor.js',
  library: '/prototype/features/library/explore.js',
  librarycredits: '/prototype/features/library-rights/census-credits.js',
  librarymethods: '/prototype/features/library-methods/reference.js',
  genredetail: '/prototype/features/genre-detail/detail.js',
  instrumentdetail: '/prototype/features/instrument-detail/detail.js',
};
const CTX_KEYS = {
  libraryreading: ['announce', 'reading', 'signal', 'storage', 'unitId'],
  genredetail: ['announce', 'genre', 'loadGenre', 'media', 'openPhoto', 'signal', 'storage'],
  instrumentdetail: [
    'announce',
    'instrument',
    'loadInstrument',
    'media',
    'openPhoto',
    'signal',
    'storage',
  ],
  browse: ['announce', 'items', 'signal', 'storage'],
  lyrics: ['announce', 'onChange', 'signal', 'storage', 'text'],
  // No recipe object, ever (Rule 1, 6639673247).
  library: [
    'announce',
    'loadMore',
    'openCollection',
    'openReading',
    'selection',
    'shelves',
    'showCredit',
    'signal',
    'storage',
  ],
  librarycredits: [
    'announce',
    'artwork',
    'artworkUrls',
    'catalog',
    'inspectAll',
    'signal',
    'storage',
  ],
  librarymethods: ['announce', 'registry', 'signal', 'storage'],
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
  // Paths answered 404 for now; a check can clear one to let a retry through.
  const failing = new Set(opts.fail || []);
  // Paths answered with these bytes instead (a tampered file).
  const override = new Map();
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== srv.url) return route.abort();
    const lane = Object.keys(LANE_MODULES).find((l) => LANE_MODULES[l] === u.pathname);
    if (lane) {
      requested.push(lane);
      if ((opts.missing || []).includes(lane)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: PROBE });
    }
    if (failing.has(u.pathname)) return route.fulfill({ status: 404, body: '' });
    if (override.has(u.pathname)) return route.fulfill(override.get(u.pathname));
    return route.continue();
  });
  if (opts.init) await context.addInitScript(opts.init.fn, opts.init.arg);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, requested, errors, failing, override };
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
  // Retry (#668 6645267823): the sentence says what happened and what to do;
  // Retry tries the lane's data again; a second failure keeps focus on Retry
  // and says so once; a success mounts the lane and puts focus in it.
  {
    const { context, page, errors, failing } = await newPage(browser, srv, {
      fail: ['/data/geo.json'],
    });
    await page.goto(`${srv.url}/prototype/#browse`);
    const note = await settledNote(page, 'browse');
    expect(
      /did not load/.test(note) && /Check your connection, then try again\.$/.test(note),
      `retry: the failure sentence doesn't say what to do: ${JSON.stringify(note)}`
    );
    const retry = page.locator('[data-panel="browse"] [data-host-retry]');
    expect((await retry.count()) === 1, 'retry: no Retry button follows the sentence');
    const box = await retry.boundingBox();
    expect(box && box.height >= 44, `retry: the Retry target is ${box && box.height}px tall`);
    const status = () => page.evaluate(() => document.getElementById('proto-status').textContent);
    await retry.click();
    const onRetry = await page
      .waitForFunction(
        () => document.activeElement && document.activeElement.matches('[data-host-retry]'),
        null,
        { timeout: 10000 }
      )
      .then(
        () => true,
        () => false
      );
    expect(onRetry, 'retry: after a second failure, focus is not on Retry');
    expect(
      (await status()) === note,
      `retry: a second failure announced ${JSON.stringify(await status())}`
    );
    expect(!(await probe(page, 'browse')), 'retry: Browse mounted while its data still fails');
    failing.delete('/data/geo.json');
    await page.locator('[data-panel="browse"] [data-host-retry]').click();
    await waitMounted(page, 'browse');
    const focused = await page.evaluate(
      () => document.activeElement && document.activeElement.dataset.probe
    );
    expect(focused === 'browse', `retry: after it mounted, focus is on ${focused}`);
    expect(
      (await page
        .locator('[data-panel="browse"] [data-host-note], [data-panel="browse"] [data-host-retry]')
        .count()) === 0,
      'retry: the failure sentence or Retry stayed beside the mounted lane'
    );
    expect((await probe(page, 'browse')).mounts === 1, 'retry: the lane mounted more than once');
    expect(!errors.length, `retry: uncaught errors: ${errors.join(' | ')}`);
    await context.close();
  }
}

const libData = (rel) =>
  JSON.parse(fs.readFileSync(path.join(root, 'library', 'data', rel), 'utf8'));
function coreLanguageNames() {
  const src = fs.readFileSync(path.join(root, 'src', 'library', 'core.js'), 'utf8');
  const m = /const LANGUAGE_NAMES = (\{[^}]*\});/.exec(src);
  return m ? Function(`return (${m[1]})`)() : null;
}

// What a person reads for each refusal (Jony, #744 6642173271): a sentence,
// with what to do next; never a raw "HTTP 404" or "Failed to fetch".
const SAYS = {
  NOT_FOUND:
    'NOT_FOUND|This collection isn’t in the Library’s data. Reload to see the current collections.',
  LOAD_FAILED:
    'LOAD_FAILED|The Library’s collections couldn’t load. Check your connection, then try again.',
  DATA_CHANGED:
    'DATA_CHANGED|The Library data changed since this page loaded. Reload to see the current collections.',
  NO_READABLE: 'NO_READABLE|This collection has no readable work yet.',
};

async function libraryChecks(browser, srv) {
  const catalog = libData('catalog.json');
  const collections = libData('collections.json').collections;
  const artwork = libData('artwork.json').artwork;
  const names = coreLanguageNames();
  expect(!!names, 'library: could not read LANGUAGE_NAMES from src/library/core.js');
  const { context, page, errors } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#library`);
  await waitMounted(page, 'library');
  const p = await probe(page, 'library');
  expect(
    JSON.stringify(p.keys) === JSON.stringify(CTX_KEYS.library),
    `ctx: library got [${p.keys}], expected [${CTX_KEYS.library}]`
  );
  const shelves = await page.evaluate(() => {
    const s = window.__probeCtx.library.shelves;
    return {
      frozen: Object.isFrozen(s) && s.every((x) => Object.isFrozen(x) && Object.isFrozen(x.cards)),
      list: JSON.parse(JSON.stringify(s)),
    };
  });
  expect(shelves.frozen, 'library: ctx.shelves (or a shelf, or its cards) is not frozen');
  const want = catalog.shelves.map((s) => ({
    language: s.language,
    languageLabel: names ? names[s.language] || s.language : null,
    total: s.total,
    cards: s.cards.map((t) => [t[0], t[1], s.language, t[2], t[3], t[4], t[5]]),
  }));
  const have = shelves.list.map((s) => ({
    language: s.language,
    languageLabel: s.languageLabel,
    total: s.total,
    cards: s.cards.map((c) => [c.id, c.title, c.language, c.readable, c.recorded, c.art, c.first]),
  }));
  expect(
    JSON.stringify(have) === JSON.stringify(want),
    'library: ctx.shelves differs from catalog.json (order, names, totals or card mapping)'
  );
  const withArt = shelves.list.flatMap((s) => s.cards).filter((c) => c.art);
  expect(
    withArt.length > 0 &&
      withArt.every(
        (c) =>
          c.artworkUrl === `../assets/library/art/${c.art}-480.webp` &&
          c.artworkLabel === (artwork.find((a) => a.id === c.art) || {}).title
      ),
    'library: a card with art lacks its artworkUrl or artworkLabel'
  );
  // loadMore
  const eng = collections.filter((r) => r[3] > 0 && r[2] === 'eng');
  const more = await page.evaluate(async () => {
    const c = window.__probeCtx.library;
    const a = await c.loadMore('eng', 24);
    const b = await c.loadMore('eng', 24);
    return {
      a: JSON.parse(JSON.stringify(a)),
      b: JSON.parse(JSON.stringify(b)),
      frozen: Object.isFrozen(a.cards),
    };
  });
  const preview = catalog.shelves.find((s) => s.language === 'eng').cards.length;
  expect(
    JSON.stringify(more.a.cards.map((c) => c.id)) ===
      JSON.stringify(eng.slice(preview, preview + 24).map((r) => r[0])) &&
      JSON.stringify(more.b.cards.map((c) => c.id)) ===
        JSON.stringify(eng.slice(preview + 24, preview + 48).map((r) => r[0])),
    'library: loadMore did not append the next readable English rows of collections.json, in order'
  );
  expect(
    more.a.total === catalog.shelves.find((s) => s.language === 'eng').total &&
      more.a.cards.every((c) => c.first === null) &&
      more.frozen,
    'library: loadMore cards lack first: null, are not frozen, or the total is wrong'
  );
  // openReading
  const firstCard = catalog.shelves[0].cards[0];
  const appended = more.a.cards[0].id;
  const file = JSON.parse(
    zlib.gunzipSync(fs.readFileSync(path.join(root, 'library', 'data', 'c', `${appended}.json.gz`)))
  );
  const open = await page.evaluate(
    async ({ a, b }) => {
      const c = window.__probeCtx.library;
      const code = (fn) =>
        fn().then(
          () => 'resolved',
          (e) => `${e.code}|${e.message}`
        );
      return {
        a: (await c.openReading(a)).unitId,
        said: document.getElementById('proto-status').textContent,
        b: (await c.openReading(b)).unitId,
        bad: await code(() => c.openReading('collection_not-a-real-id')),
        missing: await code(() => c.openReading('collection_00000000-0000-0000-0000-000000000000')),
      };
    },
    { a: firstCard[0], b: appended }
  );
  expect(
    open.a === firstCard[5],
    `library: openReading(a preview card) gave ${open.a}, its first is ${firstCard[5]}`
  );
  expect(
    open.b === (file.readable_ids || [])[0],
    `library: openReading(an appended card) gave ${open.b}, its collection file says ${(file.readable_ids || [])[0]}`
  );
  const reader = await page.evaluate(() => ({
    hosts: document.querySelectorAll('[data-feature-host="libraryreading"]').length,
    mounts: window.__probe.libraryreading && window.__probe.libraryreading.mounts,
    unitId: window.__probeCtx.libraryreading && window.__probeCtx.libraryreading.unitId,
    focused: document.activeElement && document.activeElement.dataset.probe,
  }));
  expect(
    reader.hosts === 1 && reader.mounts === 2 && reader.unitId === open.b,
    `library: openReading did not open the reader for the last unit, alone (${JSON.stringify(reader)})`
  );
  expect(
    reader.focused === 'libraryreading',
    `library: after openReading, focus is on ${reader.focused}`
  );
  expect(open.bad === SAYS.NOT_FOUND, `library: openReading(a malformed id) gave ${open.bad}`);
  expect(
    open.missing === SAYS.NOT_FOUND,
    `library: openReading(an unknown collection) gave ${open.missing}`
  );
  // selection and credit
  const sel = await page.evaluate(async (cid) => {
    const c = window.__probeCtx.library;
    const seen = [];
    const off = c.selection.subscribe((id) => seen.push(id));
    const before = c.selection.state(cid);
    const on = await c.selection.toggle(cid);
    const offState = await c.selection.toggle(cid);
    off();
    await c.selection.toggle(cid);
    return { before, on, offState, seen };
  }, appended);
  expect(
    sel.before === 'none' && sel.on === 'all' && sel.offState === 'none' && sel.seen.length === 2,
    `library: selection toggle/notify gave ${JSON.stringify(sel)}`
  );
  const art = artwork.find((a) => withArt.some((c) => c.art === a.id));
  const credit = await page.evaluate((id) => {
    window.__probeCtx.library.showCredit(id);
    return document.getElementById('proto-status').textContent;
  }, art.id);
  expect(credit === art.credit, `library: showCredit said "${credit}"`);
  expect(!errors.length, `library: uncaught errors: ${errors.join(' | ')}`);
  await context.close();

  // DATA_CHANGED and NO_READABLE, from served files that disagree.
  {
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await ctx2.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === LANE_MODULES.library)
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: PROBE });
      if (u.pathname === '/library/data/collections.json')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...libData('collections.json'), data_id: 'changed' }),
        });
      if (u.pathname === `/library/data/c/${appended}.json.gz`)
        return route.fulfill({
          status: 200,
          contentType: 'application/gzip',
          body: zlib.gzipSync(JSON.stringify({ ...file, readable_ids: [] })),
        });
      return route.continue();
    });
    await page2.goto(`${srv.url}/prototype/#library`);
    await waitMounted(page2, 'library');
    const codes = await page2.evaluate(async (b) => {
      const c = window.__probeCtx.library;
      const code = (fn) =>
        fn().then(
          () => 'resolved',
          (e) => `${e.code}|${e.message}`
        );
      return {
        more: await code(() => c.loadMore('eng', 24)),
        none: await code(() => c.openReading(b)),
      };
    }, appended);
    expect(
      codes.more === SAYS.DATA_CHANGED,
      `library: a disagreeing collections.json gave ${codes.more}`
    );
    expect(
      codes.none === SAYS.NO_READABLE,
      `library: a collection with no readable unit gave ${codes.none}`
    );
    await ctx2.close();
  }

  // LOAD_FAILED, from a collections.json the server won't send.
  {
    const ctx3 = await browser.newContext();
    const page3 = await ctx3.newPage();
    await ctx3.route('**/*', (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === LANE_MODULES.library)
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: PROBE });
      if (u.pathname === '/library/data/collections.json')
        return route.fulfill({ status: 503, body: '' });
      return route.continue();
    });
    await page3.goto(`${srv.url}/prototype/#library`);
    await waitMounted(page3, 'library');
    const failed = await page3.evaluate(() =>
      window.__probeCtx.library.loadMore('eng', 24).then(
        () => 'resolved',
        (e) => `${e.code}|${e.message}`
      )
    );
    expect(
      failed === SAYS.LOAD_FAILED,
      `library: a collections.json that won't load gave ${failed}`
    );
    await ctx3.close();
  }
}

// The Genre detail lane's ctx (#668 6645704407), held to production: the same
// genres opened in codex.html give the same name, status, prose and gpPath.
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
function genreSample() {
  const boot = readJson('api/browse_boot.json');
  const none = new Set(readJson('data/no-fixed-origin.json').ids || []);
  const photos = readJson('api/tradition_images.json').traditions || {};
  const items = boot.items;
  const pick = (f) => (items.find(f) || {}).id;
  const ids = [
    'bluegrass',
    'honky_tonk',
    pick((t) => !t.status),
    pick((t) => none.has(t.id)),
    pick((t) => !photos[t.id]),
    pick((t) => !t.parent),
  ].filter(Boolean);
  const retired = Object.keys(boot.aliases || {}).sort()[0];
  return { ids: [...new Set(ids)], retired, of: retired && boot.aliases[retired].of };
}

async function genreChecks(browser, srv) {
  const { ids, retired, of } = genreSample();
  expect(ids.length >= 5, `genre: only ${ids.length} sample genres found`);
  // Production: codex.html's own Catalog and gpPath, after the prose loads.
  const prod = await (async () => {
    const { context, page } = await newPage(browser, srv);
    await page.goto(`${srv.url}/codex.html`);
    const out = await page.evaluate(async (list) => {
      /* global CATALOG_READY, Catalog, Tradition, gpPath */
      await CATALOG_READY;
      Catalog.needProse();
      const t0 = Date.now();
      while (list.some((id) => Catalog.proseState(id) !== 'here') && Date.now() - t0 < 30000)
        await new Promise((r) => setTimeout(r, 100));
      return list.map((id) => {
        const t = Tradition(id) || {};
        const ext = Catalog.ext(id) || {};
        return {
          id,
          name: t.name,
          lineage: t.lineage || null,
          description: ext.description || null,
          exemplars: (ext.exemplars || []).filter((x) => typeof x === 'string' && x.trim()),
          status: ext.status || null,
          path: gpPath(id).map((n) => ({ id: n.id, name: n.name })),
        };
      });
    }, ids);
    await context.close();
    return out;
  })();
  const { context, page, errors, failing } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#genre`);
  await waitMounted(page, 'genredetail');
  const p = await probe(page, 'genredetail');
  expect(
    JSON.stringify(p.keys) === JSON.stringify(CTX_KEYS.genredetail),
    `ctx: genredetail got [${p.keys}], expected [${CTX_KEYS.genredetail}]`
  );
  const got = await page.evaluate(
    async ({ list, retired }) => {
      const ctx = window.__probeCtx.genredetail;
      const frozenDeep = (v) =>
        !v || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(frozenDeep));
      const loaded = [];
      for (const id of list) loaded.push(await ctx.loadGenre(id));
      const fail = async (fn) => {
        try {
          await fn();
          return null;
        } catch (e) {
          return `${typeof e.code === 'string' ? e.code : e.name}|${e.message}`;
        }
      };
      const missing = await fail(() => ctx.loadGenre('__not_a_genre__'));
      const alias = retired ? (await ctx.loadGenre(retired)).id : null;
      const pre = new AbortController();
      pre.abort();
      const abortedBefore = await fail(() => ctx.loadGenre(list[0], { signal: pre.signal }));
      // Selection: current/subscribe, once per change, and unsubscribe.
      const { genre } = await import('/prototype/selection.js');
      let calls = 0;
      const stop = ctx.genre.subscribe(() => calls++);
      genre.set(list[0]);
      genre.set(list[0]);
      const current = ctx.genre.current();
      stop();
      genre.set(list[1]);
      genre.set(null);
      // openPhoto: says so, and puts focus back where it is asked to.
      const back = document.createElement('button');
      back.textContent = 'back';
      document.body.append(back);
      ctx.openPhoto(loaded[0].photo, { label: 'x', returnFocus: back });
      const focusBack = document.activeElement === back;
      const said = document.getElementById('proto-status').textContent;
      back.remove();
      return {
        loaded: JSON.parse(JSON.stringify(loaded)),
        frozen: loaded.every(frozenDeep),
        missing,
        alias,
        abortedBefore,
        calls,
        current,
        currentAfter: ctx.genre.current(),
        focusBack,
        said,
        setInCtx: 'set' in ctx.genre,
      };
    },
    { list: ids, retired }
  );
  const boot = new Map(readJson('api/browse_boot.json').items.map((t) => [t.id, t]));
  const photos = readJson('api/tradition_images.json').traditions || {};
  const geo = readJson('data/geo.json');
  const none = new Set(readJson('data/no-fixed-origin.json').ids || []);
  ids.forEach((id, i) => {
    const g = got.loaded[i];
    const w = prod[i];
    for (const k of ['name', 'lineage', 'description', 'status'])
      expect(
        g[k] === w[k],
        `genre ${id}: ${k} ${JSON.stringify(g[k])} is not production's ${JSON.stringify(w[k])}`
      );
    for (const k of ['exemplars', 'path'])
      expect(
        JSON.stringify(g[k]) === JSON.stringify(w[k]),
        `genre ${id}: ${k} ${JSON.stringify(g[k])} is not production's ${JSON.stringify(w[k])}`
      );
    expect(g.family === boot.get(id).family, `genre ${id}: family is not the boot index's`);
    expect(
      JSON.stringify(g.photo) === JSON.stringify(photos[id] || null),
      `genre ${id}: photo is not api/tradition_images.json's`
    );
    const c = geo[id];
    expect(
      none.has(id) || !Array.isArray(c)
        ? g.place === null
        : g.place && g.place.label === c[2] && g.place.region === c[3] && !!g.place.provenance,
      `genre ${id}: place ${JSON.stringify(g.place)} is not data/geo.json's`
    );
  });
  expect(
    prod.some((w) => w.path.length > 1),
    'genre: no sample genre has a taxonomy path deeper than one node'
  );
  expect(
    prod.some((w) => w.status === null),
    'genre: no sample genre lacks a status'
  );
  expect(got.frozen, 'genre: a loaded genre is not deep-frozen');
  expect(
    got.missing ===
      `NOT_FOUND|This genre isn’t in the catalog’s data. Reload to see the current catalog.`,
    `genre: an unknown genre gave ${got.missing}`
  );
  expect(!retired || got.alias === of, `genre: retired ${retired} gave ${got.alias}, not ${of}`);
  expect(
    /^AbortError\|/.test(got.abortedBefore || ''),
    `genre: an aborted load gave ${got.abortedBefore}`
  );
  expect(got.calls === 1, `genre: subscribe ran ${got.calls} times for one change`);
  expect(got.current === ids[0], `genre: current() is ${got.current}`);
  expect(got.currentAfter === null, `genre: current() after clearing is ${got.currentAfter}`);
  expect(!got.setInCtx, 'genre: the lane can set the selection');
  expect(got.focusBack, 'genre: openPhoto did not put focus back');
  expect(
    got.said === 'The photo viewer isn’t part of this build of the prototype yet.',
    `genre: openPhoto said ${JSON.stringify(got.said)}`
  );
  // A file that won't load: the sentence, then a later call asks again.
  failing.add('/api/browse_boot.json');
  const failed = await page.evaluate(async (id) => {
    // A fresh loader: the lane's own one has its files already.
    const { genreLoader } = await import('/prototype/data.js');
    window.__retryGenre = genreLoader();
    try {
      await window.__retryGenre.loadGenre(id);
      return null;
    } catch (e) {
      return `${e.code}|${e.message}`;
    }
  }, ids[0]);
  failing.delete('/api/browse_boot.json');
  const abortedDuring = await page.evaluate(async (id) => {
    const { genreLoader } = await import('/prototype/data.js');
    const c = new AbortController();
    const pending = genreLoader().loadGenre(id, { signal: c.signal });
    c.abort();
    try {
      await pending;
      return null;
    } catch (e) {
      return e.name;
    }
  }, ids[0]);
  expect(
    abortedDuring === 'AbortError',
    `genre: a load aborted while waiting gave ${abortedDuring}`
  );
  const again = await page.evaluate(
    async (id) => (await window.__retryGenre.loadGenre(id)).id,
    ids[0]
  );
  expect(
    failed ===
      `LOAD_FAILED|This genre’s details couldn’t load. Check your connection, then try again.`,
    `genre: a boot index that won't load gave ${failed}`
  );
  expect(again === ids[0], 'genre: after a failed load, the next call did not ask again');
  expect(!errors.length, `genre: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
}

// The Instrument detail lane's ctx (#668 6646057912), held to production:
// every instrument's identity against references/02_instruments.js, its
// family name against the page's INSTRUMENT_FAMILIES, and its glyph against
// codex.html's own image().
async function instrumentChecks(browser, srv) {
  const ids = readJson('api/instruments/index.json').items.map((i) => i.id);
  const ref = JSON.parse(
    require('node:child_process').execFileSync(
      process.execPath,
      [
        '-e',
        "const C = require('./scripts/_loader.js'); process.stdout.write(JSON.stringify({ i: C.INSTRUMENTS.map((x) => ({ id: x.id, name: x.name, family: x.family, class: x.class || null, short: x.short || null })), f: C.INSTRUMENT_FAMILIES }))",
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
  );
  const refBy = new Map(ref.i.map((x) => [x.id, x]));
  const famName = new Map(ref.f.map((f) => [f.id, f.name]));
  const prod = await (async () => {
    const { context, page } = await newPage(browser, srv);
    await page.goto(`${srv.url}/codex.html`);
    const out = await page.evaluate((list) => {
      /* global image, EMOJI_REGISTRY */
      return {
        glyphs: list.map((id) => image(id, 32)),
        fallback: list.filter((id) => !EMOJI_REGISTRY[id]).length,
      };
    }, ids);
    await context.close();
    return out;
  })();
  const { context, page, errors, failing } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#instrument`);
  await waitMounted(page, 'instrumentdetail');
  const p = await probe(page, 'instrumentdetail');
  expect(
    JSON.stringify(p.keys) === JSON.stringify(CTX_KEYS.instrumentdetail),
    `ctx: instrumentdetail got [${p.keys}], expected [${CTX_KEYS.instrumentdetail}]`
  );
  const asked = [];
  page.on('request', (r) => asked.push(new URL(r.url()).pathname));
  const got = await page.evaluate(async (list) => {
    const ctx = window.__probeCtx.instrumentdetail;
    const frozenDeep = (v) =>
      !v || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(frozenDeep));
    const loaded = [];
    for (let i = 0; i < list.length; i += 100)
      loaded.push(
        ...(await Promise.all(list.slice(i, i + 100).map((id) => ctx.loadInstrument(id))))
      );
    const fail = async (fn) => {
      try {
        await fn();
        return null;
      } catch (e) {
        return `${typeof e.code === 'string' ? e.code : e.name}|${e.message}`;
      }
    };
    const missing = await fail(() => ctx.loadInstrument('__not_an_instrument__'));
    const climbing = await fail(() => ctx.loadInstrument('../../codex'));
    const pre = new AbortController();
    pre.abort();
    const aborted = await fail(() => ctx.loadInstrument(list[0], { signal: pre.signal }));
    const { instrument } = await import('/prototype/selection.js');
    let calls = 0;
    const stop = ctx.instrument.subscribe(() => calls++);
    instrument.set(list[0]);
    instrument.set(list[0]);
    const current = ctx.instrument.current();
    stop();
    instrument.set(null);
    return {
      loaded: JSON.parse(JSON.stringify(loaded)),
      frozen: loaded.every(frozenDeep),
      missing,
      climbing,
      aborted,
      calls,
      current,
      setInCtx: 'set' in ctx.instrument,
    };
  }, ids);
  const photos = readJson('api/instrument_images.json').instruments || {};
  const human = (c) => {
    const t = String(c || '').replaceAll('_', ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const PREFIX = 'data:image/svg+xml,';
  let identity = 0;
  let glyphs = 0;
  let withGlyph = 0;
  const bad = [];
  ids.forEach((id, k) => {
    const g = got.loaded[k];
    const r = refBy.get(id);
    const same =
      r &&
      g.id === r.id &&
      g.name === r.name &&
      g.short === r.short &&
      g.family.id === r.family &&
      g.family.name === famName.get(r.family) &&
      g.class.id === r.class &&
      g.class.name === (r.class ? human(r.class) : null) &&
      JSON.stringify(g.photo) === JSON.stringify(photos[id] || null);
    if (same) identity++;
    else if (bad.length < 3) bad.push(`${id}: ${JSON.stringify(g)} vs ${JSON.stringify(r)}`);
    const want = prod.glyphs[k];
    const svg =
      g.glyphUrl && g.glyphUrl.startsWith(PREFIX)
        ? decodeURIComponent(g.glyphUrl.slice(PREFIX.length))
        : null;
    const ok = want
      ? svg === want.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
      : g.glyphUrl === null;
    if (ok) glyphs++;
    else if (bad.length < 3) bad.push(`${id}: glyph differs from production's image()`);
    if (want) withGlyph++;
  });
  expect(
    identity === ids.length,
    `instrument: ${ids.length - identity} of ${ids.length} records differ from references/02_instruments.js: ${bad.join(' | ')}`
  );
  expect(
    glyphs === ids.length,
    `instrument: ${ids.length - glyphs} of ${ids.length} glyphs differ from production's image(): ${bad.join(' | ')}`
  );
  expect(
    ids.length === ref.i.length,
    `instrument: the index lists ${ids.length}, the catalog ${ref.i.length}`
  );
  expect(
    withGlyph > 0 && prod.fallback > 0,
    'instrument: no glyph, or no family-fallback glyph, in the sample'
  );
  expect(got.frozen, 'instrument: a loaded instrument is not deep-frozen');
  const NF =
    'NOT_FOUND|This instrument isn’t in the catalog’s data. Reload to see the current catalog.';
  expect(got.missing === NF, `instrument: an unknown id gave ${got.missing}`);
  expect(got.climbing === NF, `instrument: a climbing id gave ${got.climbing}`);
  expect(
    !asked.some((a) => a.includes('codex.json') || a.includes('__not_an_instrument__')),
    'instrument: an id the index does not list was requested'
  );
  expect(
    /^AbortError\|/.test(got.aborted || ''),
    `instrument: an aborted load gave ${got.aborted}`
  );
  expect(got.calls === 1 && got.current === ids[0], `instrument: subscribe ran ${got.calls} times`);
  expect(!got.setInCtx, 'instrument: the lane can set the selection');
  // A record that won't load: the sentence, then a later call asks again.
  failing.add(`/api/instruments/${ids[0]}.json`);
  const failed = await page.evaluate(async (id) => {
    const { instrumentLoader } = await import('/prototype/data.js');
    window.__retryInstrument = instrumentLoader();
    try {
      await window.__retryInstrument.loadInstrument(id);
      return null;
    } catch (e) {
      return `${e.code}|${e.message}`;
    }
  }, ids[0]);
  failing.delete(`/api/instruments/${ids[0]}.json`);
  const again = await page.evaluate(
    async (id) => (await window.__retryInstrument.loadInstrument(id)).id,
    ids[0]
  );
  expect(
    failed ===
      'LOAD_FAILED|This instrument’s details couldn’t load. Check your connection, then try again.',
    `instrument: a record that won't load gave ${failed}`
  );
  expect(again === ids[0], 'instrument: after a failed load, the next call did not ask again');
  expect(!errors.length, `instrument: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
}

// The Library panel's reference lanes (#747, #750) and the shell adapters.
async function referenceLanes(browser, srv) {
  const { context, page, errors } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#library`);
  for (const lane of ['library', 'librarycredits', 'librarymethods']) await waitMounted(page, lane);
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('[data-panel="library"] [data-feature-host]')].map(
      (h) => h.dataset.featureHost
    )
  );
  expect(
    JSON.stringify(order) === JSON.stringify(['library', 'librarycredits', 'librarymethods']),
    `reference: the Library panel's lanes are [${order}], not Explore, credits, methods in order`
  );
  for (const lane of ['librarycredits', 'librarymethods']) {
    const p = await probe(page, lane);
    expect(
      JSON.stringify(p.keys) === JSON.stringify(CTX_KEYS[lane]),
      `ctx: ${lane} got [${p.keys}], expected [${CTX_KEYS[lane]}]`
    );
  }
  const got = await page.evaluate(() => {
    const c = window.__probeCtx.librarycredits;
    const m = window.__probeCtx.librarymethods;
    const frozenDeep = (v) =>
      !v || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(frozenDeep));
    c.inspectAll();
    return {
      catalog: JSON.stringify(c.catalog),
      artwork: JSON.stringify(c.artwork),
      registry: JSON.stringify(m.registry),
      frozen: frozenDeep(c.catalog) && frozenDeep(c.artwork) && frozenDeep(m.registry),
      urls: { ...c.artworkUrls },
      urlsFrozen: Object.isFrozen(c.artworkUrls),
      said: document.getElementById('proto-status').textContent,
    };
  });
  const file = (rel) => JSON.stringify(JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')));
  expect(
    got.catalog === file('library/data/catalog.json'),
    'reference: ctx.catalog is not catalog.json'
  );
  expect(
    got.artwork === file('library/data/artwork.json'),
    'reference: ctx.artwork is not artwork.json'
  );
  expect(
    got.registry === file('library/data/methods.json'),
    'reference: ctx.registry is not methods.json'
  );
  expect(got.frozen, 'reference: catalog, artwork or registry is not deep-frozen');
  const ids = JSON.parse(
    fs.readFileSync(path.join(root, 'library/data/artwork.json'), 'utf8')
  ).artwork.map((a) => a.id);
  expect(
    got.urlsFrozen &&
      JSON.stringify(Object.keys(got.urls).sort()) === JSON.stringify([...ids].sort()) &&
      Object.entries(got.urls).every(
        ([id, u]) =>
          u === `../assets/library/art/${id}-480.webp` &&
          fs.existsSync(path.join(root, 'assets', 'library', 'art', `${id}-480.webp`))
      ),
    `reference: artworkUrls ${JSON.stringify(got.urls)} are not one committed rendition per artwork`
  );
  expect(
    /Works list isn’t part of this prototype/.test(got.said),
    `reference: inspectAll said "${got.said}"`
  );

  // The adapters: media.resolve and overlay.open (#668 6641909843).
  const ad = await page.evaluate(async () => {
    const { media, overlay } = await import('/prototype/adapters.js');
    const r = (x) => media.resolve(x);
    const out = {
      local: r('../assets/library/art/blake-480.webp'),
      remote: r('https://upload.wikimedia.org/x.jpg'),
      climb: r('../assets/../../etc/passwd.png'),
      nonString: r(null),
    };
    const waitPop = () =>
      new Promise((res) => window.addEventListener('popstate', res, { once: true }));
    const len0 = history.length;
    let closed = 0;
    const h1 = overlay.open({ label: 'Photo', onClose: () => closed++ });
    out.pushed = history.length === len0 + 1;
    out.locked = document.documentElement.style.overflow === 'hidden';
    const back = waitPop();
    history.back();
    await back;
    out.backCloses = closed === 1;
    out.unlockedByBack = document.documentElement.style.overflow === '';
    h1.close(); // already closed: nothing happens
    out.closedOnce = closed === 1;
    let closed2 = 0;
    const h2 = overlay.open({ label: 'Photo', onClose: () => closed2++ });
    const settled = waitPop();
    h2.close();
    await settled;
    out.closeNoCallback = closed2 === 0;
    out.unlockedByClose = document.documentElement.style.overflow === '';
    let firstClosed = 0;
    const a = overlay.open({ label: 'A', onClose: () => firstClosed++ });
    const lenA = history.length;
    const b = overlay.open({ label: 'B', onClose: () => {} });
    out.secondReplaces = firstClosed === 1 && history.length === lenA;
    const end = waitPop();
    b.close();
    await end;
    a.close();
    out.finalUnlocked = document.documentElement.style.overflow === '';
    return out;
  });
  expect(
    ad.local === '../assets/library/art/blake-480.webp',
    `adapters: a committed file resolved to ${ad.local}`
  );
  expect(
    ad.remote === null && ad.climb === null && ad.nonString === null,
    'adapters: media.resolve let a remote, climbing or non-string image through'
  );
  expect(
    ad.pushed && ad.locked,
    'adapters: overlay.open did not push one history entry and lock scroll'
  );
  expect(
    ad.backCloses && ad.unlockedByBack && ad.closedOnce,
    'adapters: Back did not close the overlay once and unlock scroll'
  );
  expect(
    ad.closeNoCallback && ad.unlockedByClose,
    'adapters: close() called onClose, or left scroll locked'
  );
  expect(
    ad.secondReplaces && ad.finalUnlocked,
    'adapters: a second overlay did not take over the first one cleanly'
  );
  expect(!errors.length, `reference: uncaught errors: ${errors.join(' | ')}`);
  await context.close();
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
    await libraryChecks(browser, srv);
    await referenceLanes(browser, srv);
    await genreChecks(browser, srv);
    await instrumentChecks(browser, srv);
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
