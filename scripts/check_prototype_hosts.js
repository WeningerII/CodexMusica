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
//  13. SPEECH (#758, 6642118480). Play does not open read-aloud after the
//      reader, alone, with the reading's language, every line of every
//      verified page as { analysis_line, text } and one autoplay grant; or
//      ctx.speech does not give the device one utterance at a time (a
//      handle's cancel() stops only its own, a queued one leaves the device
//      alone), clamp rate to 0.5–2, pick the named voice, report voice
//      changes until unsubscribed, and say it is unavailable where the
//      browser cannot speak.
//   9. UNMOUNT. unmount() does not abort ctx.signal, remove the host and
//      restore the placeholder.
//  14. CLOSE (#665 B0). On a fixture lane registered closable: true, beside
//      a plain lane in one panel, closed once by its Close button and once
//      by Escape: the plain lane's ctx has close or the closable one's lacks
//      it (so every list in CTX_KEYS still holds); after ctx.close() the host
//      is not idle, its node stays, focus does not return to the opener, the
//      lane's unmount() did not run, or the old signal is not aborted; the
//      teardown is not the lane's unmount(), then the abort while the node
//      is still in the page, then the node's removal; a close() called inside
//      mount() does not return false and leave the mount standing; the
//      next show() does not mount the lane again, into an empty host, with a
//      new and live signal; close() does not return true once, or a stale
//      ctx closes a later mount; the other lane or the hidden placeholder is
//      disturbed; close() takes focus from outside the lane; focus does not
//      return to the opener when the lane cleared its own content (and so
//      the focus) before it called close(); focus does not fall back to the
//      panel heading when the opener is gone, or is still on the page but
//      can't take focus (disabled), or ignores show()'s returnFocus; a lane
//      whose own unmount() throws does not get the error back from close(),
//      or the host does not still close, focus included. Each check also
//      runs on host.js with a planted defect, served beside it as
//      host.js?mutant=<name>, and that defect must fail the check under both
//      Close and Escape.
//  15. ON DEMAND (#665 B0-3). On fixture lanes opened through
//      createOnDemand(panel) in a panel that already holds a tab lane: open()
//      does not mount a lane after the panel's lanes with focus in it, or
//      gives close to a lane not registered closable: true; a second open()
//      does not unmount what was open, or does not mount several lanes in
//      order with focus in the first; an open() overtaken while its lane's
//      module or ctx loads throws, mounts that lane or moves focus, or goes
//      on to mount its later lanes or resolve true; a closable lane opened on
//      demand does not close back to the opener, alone or second of two, or
//      to returnFocus; the shell's close() leaves a lane mounted, or does not
//      stop an open() still loading its first lane; or a host unmounted
//      while its lane's module or ctx loads, which then fails, is not idle,
//      so its next show() does not mount. Each check has a planted defect, as
//      in 14. The reader and read-aloud, which app.js opens through it, keep
//      their CTX_KEYS.
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
  libraryreading: '/prototype/features/library-reading/text-view.js',
  libraryspeech: '/prototype/features/library-speech/controls.js',
  genrecategories: '/prototype/features/genre-categories/categories.js',
  genretargets: '/prototype/features/genre-targets/targets.js',
};
const CTX_KEYS = {
  genrecategories: ['announce', 'categories', 'discovery', 'signal', 'storage', 'targets'],
  genretargets: ['announce', 'discovery', 'signal', 'storage', 'targets'],
  libraryreading: ['announce', 'reading', 'signal', 'storage', 'unitId'],
  libraryspeech: ['announce', 'language', 'lines', 'signal', 'speech', 'storage'],
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
    keys: window.__probe.libraryreading && window.__probe.libraryreading.keys,
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
  expect(
    JSON.stringify(reader.keys) === JSON.stringify(CTX_KEYS.libraryreading),
    `ctx: libraryreading got [${reader.keys}], expected [${CTX_KEYS.libraryreading}]`
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

// The reader's ctx.reading (#757): production's checks on the committed files.
async function readingChecks(browser, srv) {
  const gz = (rel) => zlib.gunzipSync(fs.readFileSync(path.join(root, 'library', 'data', rel)));
  // A reading with a head and two pages, and one with a head only.
  const units = [];
  for (const f of fs.readdirSync(path.join(root, 'library', 'data', 'u')).sort()) {
    for (const [uid, key] of JSON.parse(gz(`u/${f}`)).units) {
      const dir = `r/${uid.slice(8, 10)}/${uid}/${key}`;
      const n = fs.readdirSync(path.join(root, 'library', 'data', dir)).length;
      if (!units.some((u) => u.n > 1 === n > 1)) units.push({ uid, key, dir, n });
    }
    if (units.length === 2) break;
  }
  const multi = units.find((u) => u.n > 1);
  const single = units.find((u) => u.n === 1);
  expect(!!multi && !!single, 'reading: no multi-page and single-page readings found');
  const head = JSON.parse(gz(`${multi.dir}/head.json.gz`));
  const pageFile = fs
    .readdirSync(path.join(root, 'library', 'data', multi.dir))
    .find((f) => f.startsWith('1-'));
  const page1 = JSON.parse(gz(`${multi.dir}/${pageFile}`));
  const { context, page, errors, override, failing } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#library`);
  await waitMounted(page, 'library');
  const run = (body, arg) =>
    page.evaluate(
      async ({ body, arg }) => {
        const { readingLoader } = await import('/prototype/data.js');
        const r = readingLoader();
        const code = (p) =>
          p.then(
            () => 'resolved',
            (e) => `${typeof e.code === 'string' ? e.code : e.name}|${e.message}`
          );
        const frozenDeep = (v) =>
          !v || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(frozenDeep));
        return new Function('r', 'code', 'frozenDeep', 'arg', `return (async () => { ${body} })()`)(
          r,
          code,
          frozenDeep,
          arg
        );
      },
      { body, arg }
    );
  const got = await run(
    `const x = await r.reading(arg.multi);
     const p0 = await x.loadPage(0);
     const p1 = await x.loadPage(1);
     return {
       head: JSON.stringify(x.head), same0: p0 === x.head, p1: JSON.stringify(p1),
       frozen: frozenDeep(x.head) && frozenDeep(p1),
       past: await code(x.loadPage(x.head.page_count)),
       single: (await r.reading(arg.single)).head.page_count,
       bad: await code(r.reading('reading_not-an-id')),
       unknown: await code(r.reading('reading_00000000-0000-0000-0000-000000000000')),
     };`,
    { multi: multi.uid, single: single.uid }
  );
  expect(got.head === JSON.stringify(head), 'reading: the head is not the committed file');
  expect(got.same0, 'reading: loadPage(0) is not the head');
  expect(got.p1 === JSON.stringify(page1), 'reading: page 1 is not the committed file');
  expect(got.frozen, 'reading: the head or a page is not deep-frozen');
  expect(got.single === 1, `reading: a one-page reading has page_count ${got.single}`);
  const NF =
    'NOT_FOUND|This reading isn’t in the Library’s data. Reload to see the current collections.';
  for (const k of ['past', 'bad', 'unknown']) expect(got[k] === NF, `reading: ${k} gave ${got[k]}`);
  const DC =
    'DATA_CHANGED|This reading changed or failed its checks, so no text is shown. Reload to see the current collections.';
  // A page whose bytes changed fails its digest; a head whose bytes changed
  // fails its address.
  const tamper = (rel, fn) => {
    const bytes = zlib.gzipSync(Buffer.from(fn(gz(rel).toString('utf8'))));
    override.set(`/library/data/${rel}`, {
      status: 200,
      body: bytes,
      contentType: 'application/gzip',
    });
  };
  tamper(`${multi.dir}/${pageFile}`, (t) => t.replace('"page_index":1', '"page_index": 1'));
  const pageChanged = await run(
    `const x = await r.reading(arg); return code(x.loadPage(1));`,
    multi.uid
  );
  override.clear();
  tamper(`${multi.dir}/head.json.gz`, (t) => t.replace('"page_count"', ' "page_count"'));
  const headChanged = await run(`return code(r.reading(arg));`, multi.uid);
  override.clear();
  expect(pageChanged === DC, `reading: a changed page gave ${pageChanged}`);
  expect(headChanged === DC, `reading: a changed head gave ${headChanged}`);
  // A page that won't load, and an aborted page load.
  override.set(`/library/data/${multi.dir}/${pageFile}`, { status: 503, body: '' });
  const unloaded = await run(
    `const x = await r.reading(arg); return code(x.loadPage(1));`,
    multi.uid
  );
  override.clear();
  expect(
    unloaded === 'LOAD_FAILED|The reading couldn’t load. Check your connection, then try again.',
    `reading: a page that won't load gave ${unloaded}`
  );
  const aborted = await run(
    `const x = await r.reading(arg); const c = new AbortController(); c.abort(); return code(x.loadPage(1, { signal: c.signal }));`,
    multi.uid
  );
  expect(/^AbortError\|/.test(aborted), `reading: an aborted page load gave ${aborted}`);
  void failing;
  expect(!errors.length, `reading: uncaught errors: ${errors.join(' | ')}`);
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

// A device speech stand-in: records what reaches it, ends on demand.
function fakeSpeech() {
  const log = (window.__speech = { spoken: [], cancels: 0 });
  class Utterance {
    constructor(text) {
      this.text = text;
      this.rate = 1;
      this.lang = '';
      this.voice = null;
    }
  }
  const t = new EventTarget();
  const voices = [
    { voiceURI: 'v-en', name: 'English', lang: 'en-GB', default: true, localService: true },
    { voiceURI: 'v-zh', name: 'Chinese', lang: 'zh-CN', default: false, localService: false },
  ];
  const synth = {
    getVoices: () => voices,
    speak(u) {
      log.spoken.push(u);
    },
    cancel() {
      log.cancels++;
      const u = log.spoken[log.spoken.length - 1];
      if (u && u.onerror) u.onerror({ error: 'interrupted' });
    },
    addEventListener: (...a) => t.addEventListener(...a),
    removeEventListener: (...a) => t.removeEventListener(...a),
    dispatchEvent: (e) => t.dispatchEvent(e),
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: Utterance,
    configurable: true,
  });
}

async function speechChecks(browser, srv) {
  const gz = (rel) => zlib.gunzipSync(fs.readFileSync(path.join(root, 'library', 'data', rel)));
  // The first multi-page reading, and its lines from the committed pages.
  let multi = null;
  for (const f of fs.readdirSync(path.join(root, 'library', 'data', 'u')).sort()) {
    for (const [uid, key] of JSON.parse(gz(`u/${f}`)).units) {
      const dir = `r/${uid.slice(8, 10)}/${uid}/${key}`;
      if (fs.readdirSync(path.join(root, 'library', 'data', dir)).length > 2) {
        multi = { uid, dir };
        break;
      }
    }
    if (multi) break;
  }
  expect(!!multi, 'speech: no reading with two or more pages found');
  const head = JSON.parse(gz(`${multi.dir}/head.json.gz`));
  const files = fs.readdirSync(path.join(root, 'library', 'data', multi.dir));
  const want = [];
  for (let i = 0; i < head.page_count; i++) {
    const rows =
      i === 0
        ? head.lines
        : JSON.parse(gz(`${multi.dir}/${files.find((f) => f.startsWith(`${i}-`))}`)).lines;
    for (const r of rows) want.push({ analysis_line: r[4] == null ? null : r[4], text: r[1] });
  }
  const { context, page, errors } = await newPage(browser, srv, { init: { fn: fakeSpeech } });
  await page.goto(`${srv.url}/prototype/#library`);
  await waitMounted(page, 'library');

  // The whole reading's lines.
  const lines = await page.evaluate(async (uid) => {
    const { readingLoader, readingLines } = await import('/prototype/data.js');
    const x = await readingLines(await readingLoader().reading(uid));
    return { json: JSON.stringify(x), frozen: Object.isFrozen(x) && x.every(Object.isFrozen) };
  }, multi.uid);
  expect(
    lines.json === JSON.stringify(want),
    'speech: readingLines is not every committed line in order'
  );
  expect(lines.frozen, 'speech: readingLines is not frozen');

  // The adapter on the stand-in.
  const a = await page.evaluate(async () => {
    const { speechAdapter } = await import('/prototype/adapters.js');
    const log = window.__speech;
    const s = speechAdapter();
    const ended = [];
    const out = { available: s.available, frozen: Object.isFrozen(s) };
    const v = s.getVoices();
    out.voices = JSON.stringify(v);
    out.voicesFrozen = Object.isFrozen(v) && v.every(Object.isFrozen);
    let heard = 0;
    const off = s.subscribeVoices(() => heard++);
    window.speechSynthesis.dispatchEvent(new Event('voiceschanged'));
    off();
    window.speechSynthesis.dispatchEvent(new Event('voiceschanged'));
    out.heard = heard;
    const one = s.speak('one', { rate: 9, voiceURI: 'v-zh', onend: () => ended.push('one') });
    const two = s.speak('two', { rate: 0.1, lang: 'fa', onend: () => ended.push('two') });
    const three = s.speak('three', { onend: () => ended.push('three') });
    out.atOnce = log.spoken.length;
    out.one = {
      rate: log.spoken[0].rate,
      lang: log.spoken[0].lang,
      voice: log.spoken[0].voice && log.spoken[0].voice.voiceURI,
    };
    two.cancel();
    out.queuedCancel = log.cancels;
    log.spoken[0].onend();
    out.afterOne = log.spoken.map((u) => u.text);
    out.three = { rate: log.spoken[1].rate, lang: log.spoken[1].lang };
    three.cancel();
    out.currentCancel = log.cancels;
    log.spoken[1].onend && log.spoken[1].onend();
    one.cancel();
    out.ended = ended.slice();
    const four = s.speak('four', { rate: 0.1, lang: 'fa', onerror: (e) => ended.push(`err:${e}`) });
    out.four = { rate: log.spoken[2].rate, lang: log.spoken[2].lang };
    log.spoken[2].onerror({ error: 'synthesis-failed' });
    log.spoken[2].onerror({ error: 'synthesis-failed' });
    four.cancel();
    out.errored = ended.slice();
    out.grantOff = [s.takeAutoplay(), s.takeAutoplay()];
    const g = speechAdapter({ autoplay: true });
    out.grantOn = [g.takeAutoplay(), g.takeAutoplay()];
    return out;
  });
  expect(
    a.available && a.frozen,
    'speech: the adapter is unavailable or not frozen on a device that speaks'
  );
  expect(
    a.voices ===
      JSON.stringify([
        { voiceURI: 'v-en', name: 'English', lang: 'en-GB', default: true, localService: true },
        { voiceURI: 'v-zh', name: 'Chinese', lang: 'zh-CN', default: false, localService: false },
      ]) && a.voicesFrozen,
    `speech: getVoices gave ${a.voices}`
  );
  expect(a.heard === 1, `speech: subscribeVoices heard ${a.heard} changes, expected 1`);
  expect(a.atOnce === 1, `speech: ${a.atOnce} utterances reached the device at once`);
  expect(
    a.one.rate === 2 && a.one.voice === 'v-zh' && a.one.lang === 'zh-CN',
    `speech: the first utterance was ${JSON.stringify(a.one)}`
  );
  expect(a.queuedCancel === 0, 'speech: cancelling a queued utterance cancelled the device');
  expect(
    JSON.stringify(a.afterOne) === '["one","three"]' && a.three.rate === 1,
    `speech: after the first ended the device heard ${JSON.stringify(a.afterOne)} (${JSON.stringify(a.three)})`
  );
  expect(
    a.currentCancel === 1,
    `speech: cancelling the current utterance cancelled the device ${a.currentCancel} times`
  );
  expect(
    JSON.stringify(a.ended) === '["one"]',
    `speech: onend ran for ${JSON.stringify(a.ended)}, expected only the one that ended`
  );
  expect(
    a.four.rate === 0.5 &&
      a.four.lang === 'fa' &&
      JSON.stringify(a.errored) === '["one","err:synthesis-failed"]',
    `speech: rate floor, lang or one onerror failed: ${JSON.stringify(a.four)} ${JSON.stringify(a.errored)}`
  );
  expect(
    JSON.stringify(a.grantOff) === '[false,false]' && JSON.stringify(a.grantOn) === '[true,false]',
    `speech: autoplay grants were ${JSON.stringify(a.grantOff)} and ${JSON.stringify(a.grantOn)}`
  );

  // Play opens read-aloud after the reader, with one grant.
  const shell = await page.evaluate(async (cid) => {
    const c = window.__probeCtx.library;
    const { unitId } = await c.openReading(cid);
    await c.openReading(cid);
    const t0 = Date.now();
    while (
      !(window.__probe.libraryspeech && window.__probe.libraryspeech.mounts === 2) &&
      Date.now() - t0 < 15000
    )
      await new Promise((r) => setTimeout(r, 50));
    const x = window.__probeCtx.libraryspeech;
    const hosts = [...document.querySelectorAll('[data-feature-host]')].map(
      (h) => h.dataset.featureHost
    );
    const { readingLoader, readingLines } = await import('/prototype/data.js');
    const rec = await readingLoader().reading(unitId);
    return {
      hosts,
      keys: window.__probe.libraryspeech && window.__probe.libraryspeech.keys,
      mounts: window.__probe.libraryspeech && window.__probe.libraryspeech.mounts,
      language: x && x.language,
      expected: rec.head.language,
      lines: x && JSON.stringify(x.lines) === JSON.stringify(await readingLines(rec)),
      grant: x && [x.speech.takeAutoplay(), x.speech.takeAutoplay()],
    };
  }, libData('catalog.json').shelves[0].cards[0][0]);
  const sp = shell.hosts.filter((h) => h === 'libraryspeech').length;
  expect(
    sp === 1 && shell.hosts.indexOf('libraryspeech') === shell.hosts.indexOf('libraryreading') + 1,
    `speech: read-aloud is not one host right after the reader (${shell.hosts.join(', ')})`
  );
  expect(shell.mounts === 2, `speech: read-aloud mounted ${shell.mounts} times over two Plays`);
  expect(
    JSON.stringify(shell.keys) === JSON.stringify(CTX_KEYS.libraryspeech),
    `ctx: libraryspeech got [${shell.keys}], expected [${CTX_KEYS.libraryspeech}]`
  );
  expect(
    shell.language === shell.expected,
    `speech: ctx.language is ${shell.language}, the head says ${shell.expected}`
  );
  expect(shell.lines === true, 'speech: ctx.lines is not the whole reading');
  expect(
    JSON.stringify(shell.grant) === '[true,false]',
    `speech: Play granted autoplay ${JSON.stringify(shell.grant)}`
  );
  expect(!errors.length, `speech: uncaught errors: ${errors.join(' | ')}`);
  await context.close();

  // A browser that can't speak.
  const bare = await newPage(browser, srv, {
    init: {
      fn: () => {
        Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
      },
    },
  });
  await bare.page.goto(`${srv.url}/prototype/#library`);
  await waitMounted(bare.page, 'library');
  const none = await bare.page.evaluate(async () => {
    const { speechAdapter } = await import('/prototype/adapters.js');
    const s = speechAdapter({ autoplay: true });
    let thrown = null;
    try {
      s.speak('x');
    } catch (e) {
      thrown = e.code;
    }
    return {
      available: s.available,
      voices: s.getVoices().length,
      thrown,
      off: typeof s.subscribeVoices(() => {}),
    };
  });
  expect(
    none.available === false &&
      none.voices === 0 &&
      none.thrown === 'UNAVAILABLE' &&
      none.off === 'function',
    `speech: a browser without speech gave ${JSON.stringify(none)}`
  );
  await bare.context.close();
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

// ── 14. CLOSE (#665 B0) ─────────────────────────────────────────────────────
// A closable fixture lane and a plain one, in one panel, on host.js as
// committed and then on each planted defect (CLOSE_MUTANTS): the edits to
// host.js, applied in order, each of whose `from` must occur exactly once,
// and the check that the defect must fail. The fixture lane closes itself
// as a sheet does: its Close button, or Escape anywhere inside it. Its own
// ctx fields ask for three variants: closeInMount calls close() inside
// mount(), contentFirst clears the lane's own content (and with it the focus)
// before it calls close(), as a sheet's `unmount(); ctx.close();` would, and
// unmountThrows makes its unmount() throw, as a buggy lane's might.
const CLOSER = `
export function mount(host, ctx) {
  const lane = host.dataset.featureHost;
  const all = window.__closer;
  const rec = (all[lane] = all[lane] || {
    mounts: 0, keys: [], ctxs: [], fields: [], empty: [], unmounts: 0, returned: [],
    atAbort: [], blurred: [],
  });
  rec.mounts++;
  rec.keys.push(Object.keys(ctx).sort().join());
  rec.ctxs.push(ctx);
  rec.empty.push(host.childNodes.length === 0);
  let unmounted = false;
  ctx.signal.addEventListener('abort', () => {
    rec.atAbort.push({ unmounted, connected: host.isConnected });
  });
  const field = document.createElement('textarea');
  field.setAttribute('aria-label', lane + ' field');
  rec.fields.push(field);
  host.append(field);
  if (typeof ctx.close === 'function') {
    const close = () => {
      if (ctx.contentFirst) {
        host.replaceChildren();
        rec.blurred.push(document.activeElement === document.body);
      }
      rec.returned.push(ctx.close());
    };
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.close = '';
    b.textContent = 'Close';
    host.append(b);
    b.addEventListener('click', close, { signal: ctx.signal });
    host.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      close();
    }, { signal: ctx.signal });
    if (ctx.closeInMount) rec.inMount = ctx.close();
  }
  return {
    unmount() {
      unmounted = true;
      rec.unmounts++;
      if (ctx.unmountThrows) throw new Error('the lane’s unmount failed');
    },
    focus() { field.focus(); },
  };
}
`;
const OPENER_LINE = 'let opener = null; // what show() was opened from, for close()';
const CLOSE_MUTANTS = {
  'close in every ctx': {
    check: 'opt-in',
    edits: [['...(lane.closable === true ? { close } : {}),', 'close,']],
  },
  'close leaves the host mounted': {
    check: 'idle',
    edits: [["state = 'idle'; // the next show() mounts the lane afresh", '']],
  },
  'close keeps the node': { check: 'node removed', edits: [['if (node) node.remove();', '']] },
  'close drops focus': {
    check: 'focus to the opener',
    edits: [['if (hadFocus) refocus(back);', '']],
  },
  'a throwing unmount drops focus': {
    check: 'unmount throws',
    edits: [
      [
        'try {\n        teardown();\n      } finally {\n        if (hadFocus) refocus(back);',
        '{\n        teardown();\n        if (hadFocus) refocus(back);',
      ],
    ],
  },
  'close skips the lane’s unmount': {
    check: 'lane unmounted',
    edits: [["if (h && typeof h.unmount === 'function') h.unmount();", '']],
  },
  'close leaves the signal live': {
    check: 'old signal aborted',
    edits: [['if (c) c.abort();', '']],
  },
  'the node goes before the abort': {
    check: 'teardown order',
    edits: [
      [
        'if (c) c.abort();\n      if (node) node.remove();',
        'if (node) node.remove();\n      if (c) c.abort();',
      ],
    ],
  },
  'the abort comes before the lane’s unmount': {
    check: 'teardown order',
    edits: [
      [
        "try {\n      if (h && typeof h.unmount === 'function') h.unmount();\n    } finally {\n      if (c) c.abort();",
        "if (c) c.abort();\n    try {\n      if (h && typeof h.unmount === 'function') h.unmount();\n    } finally {",
      ],
    ],
  },
  'a close inside mount() tears it down': {
    check: 'close during mount',
    edits: [
      [
        "if (controller !== mine || state !== 'mounted') return false;",
        'if (controller !== mine) return false;',
      ],
    ],
  },
  'a host mounts its lane once': {
    check: 'mounts again',
    edits: [
      [OPENER_LINE, `${OPENER_LINE}\n  let shown = false;`],
      ["if (state === 'idle') {", "if (state === 'idle' && !shown) {\n        shown = true;"],
    ],
  },
  'one signal per host': {
    check: 'new signal',
    edits: [
      [OPENER_LINE, `${OPENER_LINE}\n  let kept = null;`],
      ['const mine = new AbortController();', 'const mine = (kept ||= new AbortController());'],
    ],
  },
  'a stale ctx closes the current mount': {
    check: 'closes once',
    edits: [
      [
        "if (controller !== mine || state !== 'mounted') return false;",
        "if (state !== 'mounted') return false;",
      ],
    ],
  },
  'close brings the placeholder back': {
    check: 'other lane kept',
    edits: [
      [
        "if (placeholder && !panel.querySelector('[data-feature-host]')) placeholder.hidden = false;",
        'if (placeholder) placeholder.hidden = false;',
      ],
    ],
  },
  'close takes focus from outside the lane': {
    check: 'focus not taken',
    edits: [
      [
        'const hadFocus = !active || active === document.body || node.contains(active);',
        'const hadFocus = true;',
      ],
    ],
  },
  'focus that was nowhere stays lost': {
    check: 'focus from nowhere',
    edits: [
      [
        'const hadFocus = !active || active === document.body || node.contains(active);',
        'const hadFocus = node.contains(active);',
      ],
    ],
  },
  'no fallback to the heading': {
    check: 'heading fallback',
    edits: [["if (!ok || document.activeElement !== to) panel.querySelector('h1')?.focus();", '']],
  },
  'an opener that can’t take focus is trusted': {
    check: 'unfocusable opener',
    edits: [['if (!ok || document.activeElement !== to)', 'if (!ok)']],
  },
  'returnFocus ignored': {
    check: 'returnFocus',
    edits: [
      ['opener = returnFocus || document.activeElement;', 'opener = document.activeElement;'],
    ],
  },
};
const HOST_JS = fs.readFileSync(path.join(root, 'prototype', 'host.js'), 'utf8');
function plant(edits) {
  let src = HOST_JS;
  for (const [from, to] of edits) {
    if (src.split(from).length !== 2) return null;
    src = src.replace(from, () => to);
  }
  return src;
}

// The person closes the lane `id` from inside it: its Close button, or
// Escape.
async function closeBy(page, id, via) {
  const lane = page.locator(`[data-close-run] [data-feature-host="${id}"]`).first();
  await lane.locator('textarea').focus();
  if (via === 'button') await lane.locator('[data-close]').click();
  else await page.keyboard.press('Escape');
}

// One run on the host module at hostUrl, the lane closed by `via` (its
// Close button, or Escape): what the gate reads back.
async function closeRun(page, hostUrl, via) {
  const keys = await page.evaluate(
    async ({ hostUrl, src }) => {
      const { createHost } = await import(hostUrl);
      for (const old of document.querySelectorAll('[data-close-run]')) old.remove();
      window.__closer = {};
      const panel = document.createElement('section');
      panel.dataset.closeRun = '';
      panel.innerHTML =
        '<h1 tabindex="-1">Close probe</h1><p data-placeholder>Placeholder.</p>' +
        '<button type="button" data-opener>Open</button><input data-elsewhere aria-label="Elsewhere">';
      document.body.append(panel);
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const lane = (id, more) => ({
        id,
        label: id,
        load: () => import(url),
        context: async () => ({}),
        unloaded: 'x',
        ...more,
      });
      const stay = createHost(lane('stay'), panel);
      const closer = createHost(lane('closer', { closable: true }), panel);
      await stay.show();
      const opener = panel.querySelector('[data-opener]');
      opener.focus();
      await closer.show();
      const heading = panel.querySelector('h1');
      const elsewhere = panel.querySelector('[data-elsewhere]');
      const where = () => {
        const a = document.activeElement;
        if (a === opener) return 'opener';
        if (a === elsewhere) return 'elsewhere';
        if (a === heading) return 'heading';
        if (!a || a === document.body) return 'body';
        return panel.contains(a) ? 'lane' : a.tagName;
      };
      // Another closable lane in the same panel, with its own ctx fields.
      const make = (id, fields) =>
        createHost(lane(id, { closable: true, context: async () => fields }), panel);
      window.__closeRun = { panel, stay, closer, opener, elsewhere, where, make };
      return { stay: window.__closer.stay.keys[0], closer: window.__closer.closer.keys[0] };
    },
    { hostUrl, src: CLOSER }
  );
  await closeBy(page, 'closer', via);
  const rest = await page.evaluate(async () => {
    const r = window.__closeRun;
    const { elsewhere, where } = r;
    const c = window.__closer.closer;
    const s = window.__closer.stay;
    const count = (id) => r.panel.querySelectorAll(`[data-feature-host="${id}"]`).length;
    const nodes = () => count('closer');
    const live = (i) => !!c.ctxs[i] && !c.ctxs[i].signal.aborted;
    const closeOf = (i) => (c.ctxs[i] ? c.ctxs[i].close() : null);
    // Closed by the person.
    const after = {
      state: r.closer.state,
      nodes: nodes(),
      focus: where(),
      unmounts: c.unmounts,
      aborted: c.ctxs[0].signal.aborted,
      atAbort: c.atAbort.slice(),
      returned: c.returned.slice(),
      placeholderHidden: r.panel.querySelector('[data-placeholder]').hidden,
      stay: {
        state: r.stay.state,
        nodes: r.panel.querySelectorAll('[data-feature-host="stay"]').length,
        aborted: s.ctxs[0].signal.aborted,
        unmounts: s.unmounts,
      },
    };
    // Shown again: a second mount, into an empty host, with its own signal.
    await r.closer.show();
    const again = {
      mounts: c.mounts,
      nodes: nodes(),
      state: r.closer.state,
      empty: c.empty[1] === true,
      fresh: !!c.ctxs[1] && c.ctxs[1].signal !== c.ctxs[0].signal,
      live: live(1),
    };
    // The first mount's ctx, closed again: it can't touch the second.
    const stale = {
      returned: closeOf(0),
      state: r.closer.state,
      nodes: nodes(),
      live: live(1),
      unmounts: c.unmounts,
    };
    // A close while focus is elsewhere leaves it there.
    elsewhere.focus();
    const away = { returned: closeOf(1), focus: where(), state: r.closer.state };
    // The opener is gone by the time the lane closes: the panel heading.
    const gone = document.createElement('button');
    gone.textContent = 'Gone';
    r.panel.append(gone);
    gone.focus();
    await r.closer.show();
    gone.remove();
    if (c.fields[2]) c.fields[2].focus();
    const fallback = { returned: closeOf(2), focus: where() };
    // show()'s returnFocus wins over what had focus.
    await r.closer.show({ returnFocus: elsewhere });
    if (c.fields[3]) c.fields[3].focus();
    const explicit = { returned: closeOf(3), focus: where() };
    // The opener is still on the page but can't take focus: the heading.
    const stuck = document.createElement('button');
    stuck.textContent = 'Stuck';
    r.panel.append(stuck);
    stuck.focus();
    await r.closer.show();
    stuck.disabled = true;
    if (c.fields[4]) c.fields[4].focus();
    const unfocusable = { returned: closeOf(4), focus: where() };
    stuck.remove();
    // A lane whose own unmount() throws gets the error back from close(),
    // and the host still closes, focus included.
    const thrower = r.make('thrower', { unmountThrows: true });
    r.opener.focus();
    await thrower.show();
    const t = window.__closer.thrower;
    t.fields[0].focus();
    const throws = { threw: null };
    try {
      throws.returned = t.ctxs[0].close();
    } catch (e) {
      throws.threw = e.message;
    }
    Object.assign(throws, {
      state: thrower.state,
      nodes: count('thrower'),
      aborted: t.ctxs[0].signal.aborted,
      focus: where(),
    });
    // A lane that calls close() inside its own mount() hasn't begun: nothing
    // closes, and the mount stands until a later close.
    const early = r.make('early', { closeInMount: true });
    await early.show();
    const during = {
      returned: window.__closer.early.inMount,
      state: early.state,
      nodes: count('early'),
      later: window.__closer.early.ctxs[0].close(),
    };
    Object.assign(during, { closed: early.state, left: count('early') });
    early.unmount();
    // Next, a lane that clears its own content before it calls close().
    r.first = r.make('first', { contentFirst: true });
    r.opener.focus();
    await r.first.show();
    return { after, again, stale, away, fallback, explicit, unfocusable, throws, during };
  });
  // The person closes it; focus was nowhere by the time close() ran.
  await closeBy(page, 'first', via);
  const nowhere = await page.evaluate(() => {
    const r = window.__closeRun;
    const f = window.__closer.first;
    const got = {
      blurred: f.blurred.slice(),
      returned: f.returned.slice(),
      focus: r.where(),
      state: r.first.state,
      nodes: r.panel.querySelectorAll('[data-feature-host="first"]').length,
    };
    r.first.unmount();
    r.closer.unmount();
    r.stay.unmount();
    r.panel.remove();
    return got;
  });
  return { keys, ...rest, nowhere };
}

// The checks, by name, on one run.
function closeVerdict(g) {
  return {
    'opt-in':
      g.keys.closer === 'announce,close,signal,storage' &&
      g.keys.stay === 'announce,signal,storage',
    idle: g.after.state === 'idle',
    'node removed': g.after.nodes === 0,
    'focus to the opener': g.after.focus === 'opener',
    'lane unmounted': g.after.unmounts === 1,
    'old signal aborted': g.after.aborted === true,
    'teardown order':
      g.after.atAbort.length === 1 &&
      g.after.atAbort[0].unmounted === true &&
      g.after.atAbort[0].connected === true,
    'close during mount':
      g.during.returned === false &&
      g.during.state === 'mounted' &&
      g.during.nodes === 1 &&
      g.during.later === true &&
      g.during.closed === 'idle' &&
      g.during.left === 0,
    'mounts again':
      g.again.mounts === 2 && g.again.nodes === 1 && g.again.state === 'mounted' && g.again.empty,
    'new signal': g.again.fresh && g.again.live,
    'closes once':
      JSON.stringify(g.after.returned) === '[true]' &&
      g.stale.returned === false &&
      g.stale.state === 'mounted' &&
      g.stale.nodes === 1 &&
      g.stale.live &&
      g.stale.unmounts === 1,
    'other lane kept':
      g.after.placeholderHidden &&
      g.after.stay.state === 'mounted' &&
      g.after.stay.nodes === 1 &&
      !g.after.stay.aborted &&
      g.after.stay.unmounts === 0,
    'focus not taken':
      g.away.returned === true && g.away.focus === 'elsewhere' && g.away.state === 'idle',
    'focus from nowhere':
      JSON.stringify(g.nowhere.blurred) === '[true]' &&
      JSON.stringify(g.nowhere.returned) === '[true]' &&
      g.nowhere.focus === 'opener' &&
      g.nowhere.state === 'idle' &&
      g.nowhere.nodes === 0,
    'heading fallback': g.fallback.returned === true && g.fallback.focus === 'heading',
    'unfocusable opener': g.unfocusable.returned === true && g.unfocusable.focus === 'heading',
    'unmount throws':
      g.throws.threw === 'the lane’s unmount failed' &&
      g.throws.state === 'idle' &&
      g.throws.nodes === 0 &&
      g.throws.aborted === true &&
      g.throws.focus === 'opener',
    returnFocus: g.explicit.returned === true && g.explicit.focus === 'elsewhere',
  };
}

// ── 15. ON DEMAND (#665 B0-3) ───────────────────────────────────────────────
// createOnDemand on the same fixture lane, in a panel that already holds a
// tab lane, as Library's holds Explore. Lanes load slowly, their module or
// their ctx, so a second open() or the shell's close() overtakes the first
// mid-load. Two more lanes fail to load their module or ctx the first time,
// after their host was unmounted.
const DEMAND_MUTANTS = {
  'open moves no focus': { check: 'opens', edits: [['if (i === 0) h.focus();', '']] },
  'every on-demand lane is closable': {
    check: 'opt-in',
    edits: [
      [
        'const hosts = list.map((l) => createHost(l, panel));',
        'const hosts = list.map((l) => createHost({ ...l, closable: true }, panel));',
      ],
    ],
  },
  'open keeps what was open': {
    check: 'replaces',
    edits: [['clear(); // what was open goes first', '']],
  },
  'lanes out of order': {
    check: 'in order',
    edits: [['const list = [].concat(lanes);', 'const list = [].concat(lanes).reverse();']],
  },
  'no stop after the module loads': {
    check: 'overtaken while loading',
    edits: [['if (host !== node) return; // unmounted while the module loaded', '']],
  },
  'no stop after the ctx loads': {
    check: 'overtaken while its ctx loads',
    edits: [['if (host !== node) return; // unmounted while its ctx loaded', '']],
  },
  'an overtaken open goes on': {
    check: 'stops when overtaken',
    edits: [['if (mine !== turn) return false;', '']],
  },
  'later lanes close to the first': {
    check: 'closes to the opener',
    edits: [['await h.show({ returnFocus: back });', 'await h.show();']],
  },
  'open ignores returnFocus': {
    check: 'returnFocus',
    edits: [
      [
        'const back = returnFocus || document.activeElement;',
        'const back = document.activeElement;',
      ],
    ],
  },
  'the shell’s close keeps the lanes': {
    check: 'shell close',
    edits: [["clear(); // the shell's own close", '']],
  },
  'the shell’s close doesn’t stop an open': {
    check: 'shell close stops an open',
    edits: [
      ["turn++;\n      clear(); // the shell's own close", "clear(); // the shell's own close"],
    ],
  },
  'a load that fails after unmount sticks': {
    check: 'idle after a late failure',
    edits: [
      [
        "      if (host !== node) return;\n      state = 'unavailable';\n      explain(node,",
        "      state = 'unavailable';\n      explain(node,",
      ],
    ],
  },
  'a ctx that fails after unmount sticks': {
    check: 'idle after a late failure',
    edits: [
      [
        "      if (host !== node) return;\n      state = 'unavailable';\n      const sentence",
        "      state = 'unavailable';\n      const sentence",
      ],
    ],
  },
};

async function demandRun(page, hostUrl) {
  return page.evaluate(
    async ({ hostUrl, src }) => {
      const { createHost, createOnDemand } = await import(hostUrl);
      for (const old of document.querySelectorAll('[data-close-run]')) old.remove();
      window.__closer = {};
      const panel = document.createElement('section');
      panel.dataset.closeRun = '';
      panel.innerHTML =
        '<h1 tabindex="-1">On-demand probe</h1><p data-placeholder>Placeholder.</p>' +
        '<button type="button" data-opener>Open</button><input data-elsewhere aria-label="Elsewhere">';
      document.body.append(panel);
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const lane = (id, more) => ({
        id,
        label: id,
        load: () => import(url),
        context: async () => ({}),
        unloaded: 'x',
        ...more,
      });
      const slowLoad = (id) => lane(id, { load: () => wait(150).then(() => import(url)) });
      const slowCtx = (id) => lane(id, { context: () => wait(150).then(() => ({})) });
      const rec = (id) =>
        window.__closer[id] || { mounts: 0, keys: [], ctxs: [], fields: [], unmounts: 0 };
      const closeOf = (id) => (rec(id).ctxs[0] ? rec(id).ctxs[0].close() : null);
      const opener = panel.querySelector('[data-opener]');
      const elsewhere = panel.querySelector('[data-elsewhere]');
      const where = () => {
        const a = document.activeElement;
        if (a === opener) return 'opener';
        if (a === elsewhere) return 'elsewhere';
        const h = a && a.closest && a.closest('[data-feature-host]');
        if (h) return h.dataset.featureHost;
        return !a || a === document.body ? 'body' : a.tagName;
      };
      const order = () =>
        [...panel.querySelectorAll('[data-feature-host]')].map((n) => n.dataset.featureHost).join();
      const settle = (p) => p.catch((e) => `threw: ${e.message}`);
      const ended = (id) =>
        rec(id).unmounts === 1 && !!rec(id).ctxs[0] && rec(id).ctxs[0].signal.aborted;
      const tab = createHost(lane('tab'), panel);
      await tab.show();
      const slot = createOnDemand(panel);
      // One lane, opened from a button.
      opener.focus();
      const one = {
        returned: await settle(slot.open(lane('one'))),
        order: order(),
        mounts: rec('one').mounts,
        focus: where(),
        keys: rec('one').keys[0],
      };
      // Two lanes, which replace it.
      opener.focus();
      const two = {
        returned: await settle(slot.open([lane('a'), lane('b')])),
        order: order(),
        focus: where(),
        oneEnded: ended('one'),
      };
      // Overtaken while its first lane's module loads (at once), then while
      // its ctx loads (50 ms in, of 150). Neither slow lane, nor the lane
      // after it, may mount.
      opener.focus();
      const p1 = settle(slot.open([slowLoad('slowload'), lane('late')]));
      const p2 = settle(slot.open(lane('c')));
      const loading = { returned: [await p1, await p2] };
      await wait(250);
      Object.assign(loading, {
        order: order(),
        slow: rec('slowload').mounts,
        late: rec('late').mounts,
        focus: where(),
      });
      opener.focus();
      const p3 = settle(slot.open([slowCtx('slowctx'), lane('later')]));
      await wait(50); // its module is in; its ctx is not
      const p4 = settle(slot.open(lane('d')));
      const ctxing = { returned: [await p3, await p4] };
      await wait(250);
      Object.assign(ctxing, {
        order: order(),
        slow: rec('slowctx').mounts,
        later: rec('later').mounts,
        focus: where(),
      });
      // Closable lanes close back to the opener: alone, second of two, and
      // to returnFocus.
      opener.focus();
      await settle(slot.open(lane('sheet', { closable: true })));
      const sheet = { inside: where(), returned: closeOf('sheet') };
      Object.assign(sheet, {
        focus: where(),
        order: order(),
        placeholderHidden: panel.querySelector('[data-placeholder]').hidden,
      });
      opener.focus();
      await settle(slot.open([lane('g'), lane('h', { closable: true })]));
      if (rec('h').fields[0]) rec('h').fields[0].focus();
      const second = { returned: closeOf('h') };
      second.focus = where();
      opener.focus();
      await settle(slot.open(lane('sheet2', { closable: true }), { returnFocus: elsewhere }));
      const explicit = { returned: closeOf('sheet2') };
      explicit.focus = where();
      // The shell's own close.
      await settle(slot.open([lane('e'), lane('f')]));
      slot.close();
      const shut = { order: order(), ended: ended('e') && ended('f') };
      // The shell's close while an open() still loads its first lane: that
      // open stops, mounts nothing more and resolves false.
      opener.focus();
      const p5 = settle(slot.open([slowLoad('slowshut'), lane('aftershut')]));
      slot.close();
      const shutting = { returned: await p5 };
      await wait(250);
      Object.assign(shutting, {
        order: order(),
        slow: rec('slowshut').mounts,
        after: rec('aftershut').mounts,
        focus: where(),
      });
      // A host unmounted while its lane's module (at once) or ctx (50 ms
      // in, of 100) loads, which then fails: the host is idle, so the next
      // show() mounts the lane, which loads this time.
      const late = {};
      for (const field of ['load', 'context']) {
        let n = 0;
        const fail = () =>
          wait(100).then(() => {
            throw new Error('not this time');
          });
        const id = `fail${field}`;
        const h = createHost(
          lane(
            id,
            field === 'load'
              ? { load: () => (n++ ? import(url) : fail()) }
              : { context: () => (n++ ? Promise.resolve({}) : fail()) }
          ),
          panel
        );
        const p = settle(h.show());
        if (field === 'context') await wait(50);
        h.unmount();
        const first = await p;
        const idle = h.state;
        await settle(Promise.resolve(h.show()));
        late[field] = { first: String(first), idle, state: h.state, mounts: rec(id).mounts };
        h.unmount();
      }
      tab.unmount();
      panel.remove();
      return { one, two, loading, ctxing, sheet, second, explicit, shut, shutting, late };
    },
    { hostUrl, src: CLOSER }
  );
}

function demandVerdict(g) {
  const settled = (v) => typeof v === 'boolean';
  return {
    opens:
      g.one.returned === true &&
      g.one.order === 'tab,one' &&
      g.one.mounts === 1 &&
      g.one.focus === 'one',
    'opt-in': g.one.keys === 'announce,signal,storage',
    replaces: g.two.oneEnded && !g.two.order.split(',').includes('one'),
    'in order': g.two.returned === true && g.two.order === 'tab,a,b' && g.two.focus === 'a',
    'overtaken while loading':
      settled(g.loading.returned[0]) &&
      g.loading.returned[1] === true &&
      g.loading.slow === 0 &&
      g.loading.focus === 'c',
    'overtaken while its ctx loads':
      settled(g.ctxing.returned[0]) &&
      g.ctxing.returned[1] === true &&
      g.ctxing.slow === 0 &&
      g.ctxing.focus === 'd',
    'stops when overtaken':
      g.loading.returned[0] === false &&
      g.loading.late === 0 &&
      g.loading.order === 'tab,c' &&
      g.ctxing.returned[0] === false &&
      g.ctxing.later === 0 &&
      g.ctxing.order === 'tab,d',
    'closes to the opener':
      g.sheet.inside === 'sheet' &&
      g.sheet.returned === true &&
      g.sheet.focus === 'opener' &&
      g.sheet.order === 'tab' &&
      g.sheet.placeholderHidden &&
      g.second.returned === true &&
      g.second.focus === 'opener',
    returnFocus: g.explicit.returned === true && g.explicit.focus === 'elsewhere',
    'shell close': g.shut.order === 'tab' && g.shut.ended,
    'shell close stops an open':
      g.shutting.returned === false &&
      g.shutting.slow === 0 &&
      g.shutting.after === 0 &&
      g.shutting.order === 'tab' &&
      g.shutting.focus === 'opener',
    'idle after a late failure': ['load', 'context'].every(
      (f) =>
        g.late[f].first === 'undefined' &&
        g.late[f].idle === 'idle' &&
        g.late[f].state === 'mounted' &&
        g.late[f].mounts === 1
    ),
  };
}

// The suites: each runs on host.js as committed, once per variant, then on
// each of its planted defects, which must fail its check in every variant.
const SUITES = [
  {
    label: 'close',
    variants: ['button', 'escape'],
    run: closeRun,
    verdict: closeVerdict,
    mutants: CLOSE_MUTANTS,
  },
  {
    label: 'on demand',
    variants: [null],
    run: demandRun,
    verdict: demandVerdict,
    mutants: DEMAND_MUTANTS,
  },
];
const ALL_MUTANTS = SUITES.flatMap((s) => Object.keys(s.mutants));
let planted = 0;
async function closing(browser, srv) {
  const { context, page, errors } = await newPage(browser, srv);
  const mutants = new Map();
  await context.route(
    (u) => u.pathname === '/prototype/host.js' && u.searchParams.has('mutant'),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/javascript',
        body: mutants.get(new URL(route.request().url()).searchParams.get('mutant')),
      })
  );
  await page.goto(`${srv.url}/prototype/#map`);
  expect(
    new Set(ALL_MUTANTS).size === ALL_MUTANTS.length,
    'close: two planted defects share a name'
  );
  for (const suite of SUITES) {
    const tag = (v) => (v ? `${suite.label} (${v})` : suite.label);
    const names = new Set();
    for (const v of suite.variants) {
      const got = await suite.run(page, '/prototype/host.js', v);
      for (const [check, ok] of Object.entries(suite.verdict(got))) {
        names.add(check);
        expect(ok, `${tag(v)}: ${check} failed on host.js: ${JSON.stringify(got)}`);
      }
    }
    expect(!errors.length, `${suite.label}: uncaught errors: ${errors.join(' | ')}`);
    // Every check has a planted defect of its own.
    const planting = new Set(Object.values(suite.mutants).map((m) => m.check));
    for (const check of names)
      expect(planting.has(check), `${suite.label}: the ${check} check has no planted defect`);
    for (const [name, { check, edits }] of Object.entries(suite.mutants)) {
      const src = plant(edits);
      expect(!!src, `${suite.label}: the planted defect "${name}" no longer applies to host.js`);
      if (!src) continue;
      mutants.set(name, src);
      const hostUrl = `/prototype/host.js?mutant=${encodeURIComponent(name)}`;
      const missed = [];
      for (const v of suite.variants)
        if (suite.verdict(await suite.run(page, hostUrl, v))[check]) missed.push(tag(v));
      expect(
        !missed.length,
        `${suite.label}: with the planted defect "${name}", the ${check} check still passes (${missed.join(', ')})`
      );
      if (!missed.length) planted++;
    }
  }
  await context.close();
}

// ── 10. GENRE DISCOVERY (#668 6665493327) ─────────────────────────────────
// Categories and Find a sound against codex.html's own gpMembership,
// getRoots, traditionGlyphsHTML's glyphs and gpResults: every node's count
// and cross-listed count, the root and child order, every glyph pair, and the
// ranked list for seeded targets with and without a branch. Then the
// commands: refusals, unapplied versus an explicit 0, Use as sound targets,
// the settled announcement, focus after a branch or a match, and the narrow
// disclosure.
function seededTargets(keys) {
  let s = 20261105;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out = [];
  for (let i = 0; i < 12; i++) {
    const n = 1 + Math.floor(rnd() * 4);
    const t = {};
    while (Object.keys(t).length < n)
      t[keys[Math.floor(rnd() * keys.length)]] = Math.floor(rnd() * 5) - 2;
    out.push(t);
  }
  return out;
}

async function discoveryChecks(browser, srv) {
  const boot = readJson('api/browse_boot.json');
  const combos = seededTargets(boot.axisKeys);
  const prod = await (async () => {
    const { context, page } = await newPage(browser, srv);
    await page.goto(`${srv.url}/codex.html#genre`);
    const out = await page.evaluate(async (combos) => {
      /* global gpMembership, getRoots, TREE_NODES, resolveTraditionGlyphs, glyphSvg, GLYPH_META, gpResults, G, UI, $ui, AXIS_DEFINITIONS, axisLabel */
      await CATALOG_READY;
      const t0 = Date.now();
      while (!$ui('genre-search') && Date.now() - t0 < 20000)
        await new Promise((r) => setTimeout(r, 100));
      const m = gpMembership();
      const byId = Object.fromEntries(TREE_NODES.map((n) => [n.id, n]));
      const nodes = TREE_NODES.map((n) => {
        const r = resolveTraditionGlyphs(n.id, byId);
        const glyphs = [
          [r.fn, 'fn'],
          [r.second, r.secondKind || 'region'],
        ]
          .map(([ch, kind]) => ({
            svg: ch ? glyphSvg(ch, 22) : '',
            label: (ch && GLYPH_META[ch]?.label) || '',
            kind,
          }))
          .filter((g) => g.svg);
        return {
          id: n.id,
          count: m.count.get(n.id) || 0,
          cross: m.cross.get(n.id) || 0,
          children: TREE_NODES.filter((k) => k.parent === n.id).map((k) => k.id),
          glyphs,
        };
      });
      const roots = getRoots().map((n) => n.id);
      $ui('genre-search').value = '';
      const ranked = (targets, branch) => {
        G.targets = { ...targets };
        UI.genreNode = branch || '';
        return gpResults().map((r) => r.t.id);
      };
      const branch = roots[0];
      const deep = TREE_NODES.find((n) => n.parent && TREE_NODES.some((k) => k.parent === n.id)).id;
      const runs = [];
      runs.push({ targets: {}, branch: null, ids: ranked({}, null) });
      runs.push({ targets: {}, branch: deep, ids: ranked({}, deep) });
      for (const [i, t] of combos.entries())
        runs.push({
          targets: t,
          branch: i % 3 === 1 ? branch : i % 3 === 2 ? deep : null,
          ids: ranked(t, i % 3 === 1 ? branch : i % 3 === 2 ? deep : null),
        });
      G.targets = {};
      UI.genreNode = '';
      const labels = AXIS_DEFINITIONS.map((ax) => [-2, -1, 0, 1, 2].map((v) => axisLabel(ax, v)));
      return { nodes, roots, runs, labels, axes: AXIS_DEFINITIONS.map((a) => a.id) };
    }, combos);
    await context.close();
    return out;
  })();
  expect(
    prod.roots.length === 25 && prod.nodes.length > 300,
    `discovery: production gave ${prod.roots.length} roots, ${prod.nodes.length} nodes`
  );

  const { context, page, errors } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#genre`);
  await waitMounted(page, 'genrecategories');
  await waitMounted(page, 'genretargets');
  for (const lane of ['genrecategories', 'genretargets']) {
    const p = await probe(page, lane);
    expect(
      JSON.stringify(p.keys) === JSON.stringify(CTX_KEYS[lane]),
      `ctx: ${lane} got [${p.keys}], expected [${CTX_KEYS[lane]}]`
    );
  }
  const got = await page
    .evaluate(
      async ({ runs, ids }) => {
        const C = window.__probeCtx.genrecategories;
        const T = window.__probeCtx.genretargets;
        const { discovery } = await import('/prototype/app.js');
        const frozenDeep = (v) =>
          !v || typeof v !== 'object' || (Object.isFrozen(v) && Object.values(v).every(frozenDeep));
        const svgOf = (url) =>
          decodeURIComponent(url.slice('data:image/svg+xml,'.length)).replace(
            ' xmlns="http://www.w3.org/2000/svg"',
            ''
          );
        const glyphsOf = (n) =>
          n.glyphs.map((g) => ({ svg: svgOf(g.url), label: g.label, kind: g.kind }));
        const cat = C.categories.current();
        const out = {
          frozen: frozenDeep(cat) && frozenDeep(T.targets.current()),
          roots: cat.roots.map((n) => n.id),
          rootGlyphs: Object.fromEntries(cat.roots.map((n) => [n.id, glyphsOf(n)])),
          total: cat.total,
          rootCount: cat.rootCount,
          nodes: {},
        };
        // Every node, opened as a branch: its count, cross-listed count,
        // children and glyphs.
        for (const id of ids) {
          await C.categories.openBranch(id, C.categories.current().revision);
          const b = C.categories.current().branch;
          out.nodes[id] = {
            count: b.node.count,
            cross: b.cross,
            children: b.children.map((k) => k.id),
            glyphs: glyphsOf(b.node),
          };
        }
        const runOne = async ({ targets, branch }) => {
          const c = C.categories.current();
          if (branch) await C.categories.openBranch(branch, c.revision);
          else await C.categories.allGenres(c.revision);
          await T.targets.reset(T.targets.current().revision);
          for (const [k, v] of Object.entries(targets))
            await T.targets.apply(k, v, T.targets.current().revision);
          return discovery.results.current().rows.map((r) => r.id);
        };
        out.results = [];
        for (const r of runs) out.results.push(await runOne(r));
        return out;
      },
      { runs: prod.runs, ids: prod.nodes.map((n) => n.id) }
    )
    .catch((e) => ({ error: String(e) }));
  expect(!got.error, `discovery: the prototype run threw ${got.error}`);
  if (!got.error) {
    expect(got.frozen, 'discovery: a snapshot is not deeply frozen');
    expect(
      JSON.stringify(got.roots) === JSON.stringify(prod.roots),
      'discovery: the roots are not production’s, in production’s order'
    );
    expect(
      got.total === boot.items.length && got.rootCount === 25,
      `discovery: total ${got.total}, rootCount ${got.rootCount}`
    );
    let nodesSame = 0;
    for (const b of prod.nodes) {
      const a = got.nodes[b.id];
      const ok =
        a &&
        a.count === b.count &&
        a.cross === b.cross &&
        JSON.stringify(a.children) === JSON.stringify(b.children) &&
        JSON.stringify(a.glyphs) === JSON.stringify(b.glyphs);
      if (ok) nodesSame++;
      else if (nodesSame + 5 > prod.nodes.length || !a || problems.length < 40)
        expect(
          false,
          `discovery: node ${b.id} differs from production (${JSON.stringify(a)?.slice(0, 160)})`
        );
    }
    expect(
      nodesSame === prod.nodes.length,
      `discovery: ${nodesSame}/${prod.nodes.length} nodes equal production's count, cross-listed count, children and glyphs`
    );
    for (const id of prod.roots)
      expect(
        JSON.stringify(got.rootGlyphs[id]) ===
          JSON.stringify(prod.nodes.find((n) => n.id === id).glyphs),
        `discovery: root ${id}'s glyphs differ`
      );
    let same = 0;
    prod.runs.forEach((r, i) => {
      const ok = JSON.stringify(got.results[i]) === JSON.stringify(r.ids);
      if (ok) same++;
      else
        expect(
          false,
          `discovery: results for ${JSON.stringify(r.targets)} in ${r.branch || 'all'} differ (prototype ${got.results[i].length}, production ${r.ids.length})`
        );
    });
    expect(
      same === prod.runs.length,
      `discovery: ${same}/${prod.runs.length} ranked lists equal production's`
    );
  }
  // The commands, refusals, announcement and focus.
  const beh = await page
    .evaluate(async (profileId) => {
      const C = window.__probeCtx.genrecategories;
      const T = window.__probeCtx.genretargets;
      const { genre } = await import('/prototype/selection.js');
      const code = async (fn) => {
        try {
          await fn();
          return null;
        } catch (e) {
          return e.code || e.name;
        }
      };
      const status = () => document.getElementById('proto-status').textContent;
      const settle = () => new Promise((r) => setTimeout(r, 700));
      const count = document.querySelector('[data-genre-count]');
      const out = {};
      await C.categories.allGenres(C.categories.current().revision);
      await T.targets.reset(T.targets.current().revision);
      await settle();
      const r0 = T.targets.current().revision;
      out.stale = await code(() => T.targets.apply('density', 1, r0 - 1));
      out.badAxis = await code(() => T.targets.apply('nope', 1, r0));
      out.badValue = await code(() => T.targets.apply('density', 3, r0));
      out.badFraction = await code(() => T.targets.apply('density', 0.5, r0));
      out.notApplied = await code(() => T.targets.clear('density', r0));
      out.noBranch = await code(() =>
        C.categories.openBranch('__nope__', C.categories.current().revision)
      );
      // Unapplied versus an explicit 0.
      const before = T.targets.current();
      await T.targets.apply('density', 0, before.revision);
      const zero = T.targets.current();
      out.zero = { applied: zero.applied, target: zero.targets[0], before: before.applied };
      await settle();
      out.said1 = status();
      document.getElementById('proto-status').textContent = 'x';
      await T.targets.apply('density', 0, T.targets.current().revision);
      await settle();
      out.repeatSilent = status() === 'x';
      await T.targets.clear('density', T.targets.current().revision);
      await settle();
      out.said2 = status();
      out.cleared = T.targets.current().applied;
      // Featured axes first; toggles.
      out.axes = T.targets
        .current()
        .axes.slice(0, 3)
        .map((a) => a.id);
      await T.targets.toggleAll(T.targets.current().revision);
      out.allAxes = T.targets.current().allAxes;
      await C.categories.toggleRoots(C.categories.current().revision);
      out.allRoots = C.categories.current().allRoots;
      // A branch: focus moves to the shell's count, which names it.
      const root = C.categories.current().roots[0];
      await C.categories.openBranch(root.id, C.categories.current().revision);
      out.branchFocus = document.activeElement === count;
      out.countLine = count.textContent;
      out.rootName = root.name;
      out.rootCount = root.count;
      await C.categories.back(C.categories.current().revision);
      out.backTo = C.categories.current().branch;
      // Use as sound targets: all 13 from the profile, all axes, no branch.
      await T.targets.useProfile(profileId);
      const u = T.targets.current();
      out.profile = {
        applied: u.applied,
        allAxes: u.allAxes,
        focus: document.activeElement === count,
      };
      out.profileSaid = status();
      // Match opens the best genre; nothing to match focuses the count.
      genre.set(null);
      await T.targets.match(T.targets.current().revision);
      out.matched = genre.current();
      out.best = T.targets.current().results.best && T.targets.current().results.best.id;
      // 3PO's sequence (#668 6667209954): Match a genre, apply targets that
      // empty the list, Match again. Production keeps the open genre
      // (gpApplyAxis and genre-sound-match never touch UI.genre; observed in
      // codex.html at d022ec589d) and focuses the count.
      for (const ax of T.targets.current().axes)
        await T.targets.apply(ax.id, ax.id === 'density' ? -2 : 2, T.targets.current().revision);
      const empty = T.targets.current().results.count;
      // Focus starts on a known control, so the count taking it is a move.
      const prior = document.createElement('button');
      prior.textContent = 'before';
      document.body.append(prior);
      prior.focus();
      const away = document.activeElement === prior && document.activeElement !== count;
      await T.targets.match(T.targets.current().revision);
      out.emptyMatch = {
        empty,
        kept: genre.current(),
        away,
        focus: document.activeElement === count,
      };
      prior.remove();
      return out;
    }, 'bluegrass')
    .catch((e) => ({ error: String(e) }));
  expect(!beh.error, `discovery: the command run threw ${beh.error}`);
  if (!beh.error) {
    expect(
      beh.stale === 'STALE' &&
        beh.badAxis === 'BAD_AXIS' &&
        beh.badValue === 'BAD_VALUE' &&
        beh.badFraction === 'BAD_VALUE' &&
        beh.notApplied === 'NOT_APPLIED' &&
        beh.noBranch === 'NOT_FOUND',
      `discovery: refusals were ${JSON.stringify([beh.stale, beh.badAxis, beh.badValue, beh.badFraction, beh.notApplied, beh.noBranch])}`
    );
    expect(
      beh.zero.before === 0 &&
        beh.zero.applied === 1 &&
        beh.zero.target.value === 0 &&
        beh.zero.target.label === 'middle',
      `discovery: an explicit 0 is not an applied "middle" target (${JSON.stringify(beh.zero)})`
    );
    expect(
      /^1 target applied\. [\d,]+ genres\.$/.test(beh.said1),
      `discovery: the settled announcement was "${beh.said1}"`
    );
    expect(beh.repeatSilent, 'discovery: the same sentence was announced twice in a row');
    expect(
      /^Sound targets cleared\. 7,755 genres\.$/.test(beh.said2) && beh.cleared === 0,
      `discovery: clearing said "${beh.said2}"`
    );
    expect(
      JSON.stringify(beh.axes) === JSON.stringify(['soundTech', 'density', 'voice']),
      `discovery: featured axes ${beh.axes}`
    );
    expect(
      beh.allAxes === true && beh.allRoots === true,
      'discovery: toggleAll or toggleRoots did not flip'
    );
    expect(
      beh.branchFocus &&
        beh.countLine.startsWith(`${beh.rootCount.toLocaleString('en')} genres in ${beh.rootName}`),
      `discovery: after a branch, focus ${beh.branchFocus}, count "${beh.countLine}"`
    );
    expect(beh.backTo === null, 'discovery: Back from a root did not return to all genres');
    expect(
      beh.profile.applied === 13 && beh.profile.allAxes && beh.profile.focus,
      `discovery: useProfile gave ${JSON.stringify(beh.profile)}`
    );
    expect(
      beh.profileSaid === 'Sound targets set from Bluegrass’s profile',
      `discovery: useProfile said "${beh.profileSaid}"`
    );
    expect(
      beh.best && beh.matched === beh.best,
      `discovery: match opened ${beh.matched}, best ${beh.best}`
    );
    expect(
      beh.emptyMatch.empty === 0 &&
        beh.emptyMatch.kept === beh.matched &&
        beh.emptyMatch.away &&
        beh.emptyMatch.focus,
      `discovery: after targets that empty the list, Match did not keep the open genre and focus the count, as production does (${JSON.stringify(beh.emptyMatch)})`
    );
  }
  // The breakpoint is production's @container discovery (max-width: 720px).
  const widths = [];
  for (const w of [700, 760, 1000]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(150);
    widths.push(
      await page.evaluate(() => {
        const panel = document.querySelector('[data-panel="genre"]');
        return {
          width: panel.clientWidth,
          narrow: window.__probeCtx.genretargets.discovery.current().narrow,
        };
      })
    );
  }
  expect(
    widths.every((x) => x.narrow === x.width <= 720) &&
      widths.some((x) => x.narrow) &&
      widths.some((x) => !x.narrow),
    `discovery: narrow is not production's 720px rule at ${JSON.stringify(widths)}`
  );
  // Narrow: Find a sound waits behind the disclosure until it opens.
  await page.setViewportSize({ width: 600, height: 900 });
  await page
    .waitForFunction(() => window.__probeCtx.genretargets.discovery.current().narrow, null, {
      timeout: 5000,
    })
    .catch(() => {});
  const narrow = await page.evaluate(async () => {
    const D = window.__probeCtx.genrecategories.discovery;
    const host = () => document.querySelector('[data-feature-host="genretargets"]');
    // A stand-in for the Categories lane's marked toggle.
    const cats = document.querySelector('[data-feature-host="genrecategories"]');
    const toggle = document.createElement('button');
    toggle.dataset.discoveryToggle = '';
    toggle.textContent = 'Categories & find a sound';
    cats.append(toggle);
    const closed = { narrow: D.current().narrow, hidden: host().hidden, id: host().id };
    await D.setOpen(true, D.current().revision);
    const openHidden = host().hidden;
    // Focus inside Find a sound when it closes moves to the toggle.
    host().querySelector('textarea').focus();
    await D.setOpen(false, D.current().revision);
    const afterClose = document.activeElement === toggle;
    // Escape closes the open disclosure and returns focus to the toggle.
    await D.setOpen(true, D.current().revision);
    host().querySelector('textarea').focus();
    document.activeElement.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    await new Promise((r) => setTimeout(r, 50));
    const escaped = { open: D.current().open, focus: document.activeElement === toggle };
    let unsub = 0;
    const stop = D.subscribe(() => unsub++);
    stop();
    await D.setOpen(true, D.current().revision);
    let stale = null;
    try {
      await D.setOpen(false, D.current().revision - 1);
    } catch (e) {
      stale = e.code;
    }
    return { closed, openHidden, afterClose, escaped, unsubscribed: unsub === 0, stale };
  });
  expect(
    narrow.closed.narrow &&
      narrow.closed.hidden &&
      narrow.closed.id === 'proto-genre-targets' &&
      !narrow.openHidden,
    `discovery: narrow disclosure ${JSON.stringify(narrow)}`
  );
  expect(
    narrow.afterClose,
    'discovery: hiding Find a sound left focus inside it, not on the toggle'
  );
  expect(
    !narrow.escaped.open && narrow.escaped.focus,
    `discovery: Escape gave ${JSON.stringify(narrow.escaped)}`
  );
  expect(
    narrow.unsubscribed && narrow.stale === 'STALE',
    `discovery: subscribe/unsubscribe or STALE on setOpen failed (${JSON.stringify(narrow)})`
  );
  expect(!errors.length, `discovery: uncaught errors: ${errors.join(' | ')}`);
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
    await discoveryChecks(browser, srv);
    await readingChecks(browser, srv);
    await speechChecks(browser, srv);
    await unmounting(browser, srv);
    await closing(browser, srv);
  } finally {
    await browser.close();
    await srv.close();
  }
  if (problems.length) {
    console.error(`check_prototype_hosts: FAIL — ${problems.length} of ${checks} checks`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(
    `check_prototype_hosts: ${checks}/${checks} checks pass; ${planted}/${ALL_MUTANTS.length} planted host.js defects fail their checks`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
