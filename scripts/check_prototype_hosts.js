#!/usr/bin/env node
'use strict';
/* global document, window, localStorage, Storage, history, MutationObserver, location */
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
//      stop an open() still loading its first lane; a held lane whose own
//      unmount() throws stops the next open() or the shell's close() from
//      ending every held lane, stops the open from mounting its lane with
//      focus in it, or is swallowed instead of coming back from open() and
//      close() (#810 6675659005), or, when several held lanes throw, does not
//      come back as one AggregateError holding each of their errors, in the
//      order they were thrown (#810 6677708921); or a host unmounted
//      while its lane's module or ctx loads, which then fails, is not idle,
//      so its next show() does not mount. Each check has a planted defect, as
//      in 14. The reader and read-aloud, which app.js opens through it, keep
//      their CTX_KEYS.
//
//  16. RECIPE STORE (#670 P2 step 5). prototype/recipe-store.js, through
//      the `recipe` app.js constructs, each check in a page of its own and
//      against codex.html's own functions on the same sequence: one history
//      entry per command, with a baseline; the recipe production builds for
//      the same adds; STALE on revision, previewRevision and instrumentId,
//      and BUSY while an edit or a preview rebuild runs (#668 6647636873's
//      four safeguards, the planted race included); the preview's baseline
//      never sharing the card's chain; the five preview views equal to
//      production's lists, glyphs, ipApply, ipChoose note, render and copy;
//      sourceMessage held to production's own render at ceilings 1000, 150
//      and 100, with a room named like part of a card's own line, and one
//      card alone whose environment line is dropped, among the cases; every
//      outcome said once, in production's words where it has them; the
//      destination's fallback; frozen snapshots and the notification order; the store's hold on the engine's workspace; each
//      view's methods; apply's vocabulary; the hand-over sentence; pending
//      commands always settling; the note cleared at each rebuild; no
//      previewRevision change while nothing is open; addGenre before start;
//      no selection effect before start; a retried catalog boot; an Undo
//      that restores nothing refused; and the commands' argument guards and
//      the shell's previewIs. With Genre Instruments (#770)
//      registered: its roster is the genre page's, the "Your recipe" line
//      follows the store, and its host's ctx and recipe view are exactly
//      CTX_KEYS and PORT_KEYS, with "Try again." and a Retry that mounts it
//      when the store can't load. Every registered lane's ctx views carry
//      exactly CTX_VIEWS's methods, its subscriptions (listener methods,
//      such as speak's onend, among them) are SUBSCRIBED's, and each hears a
//      change while the lane is mounted and none once its mount's signal
//      aborts, and the device is given nothing to say after it (#810
//      6682309672). Each check has a planted defect of its own
//      (STORE_MUTANTS, LOAD_MUTANTS, DATA_MUTANTS, APP_MUTANTS), served in
//      place of the file in that check's own page, and that defect must fail
//      the check.
//  17. READER (#810 6677708921). Through the Library lane's openReading,
//      with a stand-in that says a rejection as explore.js does: when the
//      reader that is open throws from its own unmount(), the new reading
//      does not resolve { unitId }, is not mounted once after the Library's
//      lanes with focus in it, leaves the old one standing, says anything, or
//      does not log the error; when both of the old reading's lanes throw,
//      the same, and each of their errors is not logged once; or, when the
//      new reader's open fails, over an old one that throws, openReading
//      does not reject with the new reader's error, or does not log the old
//      one's. Each check has a planted defect in app.js (READER_MUTANTS), as
//      in 16.
//  18. READER START (#810, Don's reply to 6683384760). Through openReading
//      again, when the new reader can't start, because its module doesn't
//      load, its context() fails or its mount() throws: the status region
//      does not hear exactly one sentence, the one the reader's host shows,
//      or does not end on it once read-aloud has mounted and spoken;
//      openReading does not resolve { unitId }; focus is not moved to the
//      reader's Retry when it has one, else to its sentence, from Play or
//      from nowhere, or is moved when the person put it elsewhere, while the
//      unit was looked up or while the reader's module loaded; read-aloud is
//      granted Play's autoplay; or, with the Library's route left at once,
//      anything is said. With read-aloud failing too, anything but the
//      reader's sentence is said, or focus is not on that sentence; with
//      read-aloud failing alone, anything is said, or focus leaves the
//      reader. The reader's Retry: a mount() that throws then is not said,
//      with focus on its sentence; focus the person moved on (elsewhere, or
//      back to Play) is taken, by a Retry that fails again or one that
//      mounts. Two Plays whose look-ups finish out of order: the earlier
//      one's reading opens. Each check has a planted defect in host.js or
//      app.js (START_MUTANTS), as in 16.
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
  genreinstruments: '/prototype/features/genre-instruments/instruments.js',
  libraryreading: '/prototype/features/library-reading/text-view.js',
  libraryspeech: '/prototype/features/library-speech/controls.js',
  genrecategories: '/prototype/features/genre-categories/categories.js',
  genretargets: '/prototype/features/genre-targets/targets.js',
};
const CTX_KEYS = {
  genrecategories: ['announce', 'categories', 'discovery', 'signal', 'storage', 'targets'],
  genretargets: ['announce', 'discovery', 'signal', 'storage', 'targets'],
  genreinstruments: [
    'announce',
    'genre',
    'loadGenreInstruments',
    'openInstrument',
    'recipe',
    'signal',
    'storage',
  ],
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
  // A check can make a lane's mount() throw: one lane, or a list.
  if ([].concat(window.__probeThrow).includes(lane)) throw new Error('probe mount failure');
  if ([].concat(window.__probeSays).includes(lane)) ctx.announce(lane + ' probe mounted');
  // A check can make a lane's unmount() (one lane, or a list) or focus()
  // throw, read when called. Each unmount error names its lane and is kept.
  const throws = () => window.__probeThrows || {};
  return {
    unmount() {
      rec.unmounted = true;
      if ([].concat(throws().unmount).includes(lane)) {
        const error = new Error('probe unmount failure in ' + lane);
        (window.__probeUnmountErrors = window.__probeUnmountErrors || []).push(error);
        throw (window.__probeUnmountError = error);
      }
    },
    focus() {
      if (throws().focus === lane) throw new Error('probe focus failure');
      field.focus();
    },
  };
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
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.origin !== srv.url) return route.abort();
    const lane = Object.keys(LANE_MODULES).find((l) => LANE_MODULES[l] === u.pathname);
    if (lane) {
      requested.push(lane);
      if (opts.slow && opts.slow[lane]) await new Promise((r) => setTimeout(r, opts.slow[lane]));
      if ((opts.missing || []).includes(lane)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: PROBE });
    }
    if (failing.has(u.pathname)) return route.fulfill({ status: 404, body: '' });
    if (override.has(u.pathname)) return route.fulfill(override.get(u.pathname));
    // A path answered late, as `slow` gives it (keyed by a lane, or a path).
    if (opts.slow && opts.slow[u.pathname])
      await new Promise((r) => setTimeout(r, opts.slow[u.pathname]));
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

// ── 17. A READING OVER A THROWING ONE (#810 6677708921) ────────────────────
// app.js's openReader, through the Library lane's openReading, as Play calls
// it. explore.js (lines 85-88) says a rejected openReading to the person, so
// here a stand-in says it the same way, and every sentence the status region
// hears is kept. Then, with the reader that is open throwing from its own
// unmount(), a second reading must open, resolve { unitId } and take focus,
// with nothing said and the error logged (console.warn or console.error).
// With a new reader whose open fails (its focus() throws, the last step of
// an open), over one whose unmount also throws, openReading must still
// reject, with the new reader's error, and the teardown error still logged.
// (A reader whose mount() throws is not that case: the host says so in the
// panel, as for any lane (8), and the open resolves. Before this fix it
// resolved too, but only when the old reading ended cleanly.) And when both
// lanes of the reading that is open throw from unmount(), the slot hands
// back both errors at once (15): the new reading must still open as above,
// with nothing said, and each error logged once, so neither hides the other.
// Each check also runs on app.js with a planted defect (READER_MUTANTS),
// served in place of app.js in a page of its own, which must fail it.
const READER_MUTANTS = {
  'openReader rejects on the old reader’s teardown (as at c1cb00757)': {
    check: 'an old reader’s teardown',
    edits: [
      [
        "  try {\n    reader.close();\n  } catch (error) {\n    for (const e of error instanceof AggregateError ? error.errors : [error]) {\n      console.warn('[prototype] The reading that was open did not end cleanly:', e);\n    }\n  }\n",
        '',
      ],
    ],
  },
  'openReader opens nothing after a teardown error': {
    check: 'an old reader’s teardown',
    edits: [
      [
        "console.warn('[prototype] The reading that was open did not end cleanly:', e);\n    }\n",
        "console.warn('[prototype] The reading that was open did not end cleanly:', e);\n    }\n    throw error;\n",
      ],
    ],
  },
  'openReader resolves before the reading opens': {
    check: 'an old reader’s teardown',
    edits: [['  await reader.open([\n', '  void reader.open([\n']],
  },
  'openReader tells the person about the teardown': {
    check: 'nothing said',
    edits: [
      [
        "console.warn('[prototype] The reading that was open did not end cleanly:', e);",
        "announce('The reading that was open did not end cleanly.');",
      ],
    ],
  },
  'openReader drops the teardown error unlogged': {
    check: 'logged',
    edits: [
      ["console.warn('[prototype] The reading that was open did not end cleanly:', e);", 'void e;'],
    ],
  },
  'openReader logs both lanes’ teardown errors as one': {
    check: 'both lanes’ teardown errors',
    edits: [['error instanceof AggregateError ? error.errors : [error]', '[error]']],
  },
  'openReader swallows a failed open': {
    check: 'a new reader’s failure',
    edits: [
      [
        "  ]);\n}\n\n// The Library lane's ctx",
        "  ]).catch(() => {});\n}\n\n// The Library lane's ctx",
      ],
    ],
  },
};

async function readerRun(page, cid) {
  return page.evaluate(async (cid) => {
    const c = window.__probeCtx.library;
    const region = document.getElementById('proto-status');
    const said = [];
    new MutationObserver(() => {
      if (region.textContent) said.push(region.textContent);
    }).observe(region, { childList: true, characterData: true, subtree: true });
    const logged = [];
    for (const k of ['warn', 'error']) {
      const real = console[k].bind(console);
      console[k] = (...args) => {
        logged.push(args);
        real(...args);
      };
    }
    const loggedOf = (err) =>
      logged.filter((args) =>
        args.some((a) => a === err || (typeof a === 'string' && a.includes(err.message)))
      ).length;
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const until = async (ok) => {
      const t0 = Date.now();
      while (!ok() && Date.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 50));
    };
    const mounts = (lane) => (window.__probe[lane] ? window.__probe[lane].mounts : 0);
    // Play, as explore.js handles it: a rejection is said, in its message.
    const play = async () => {
      try {
        return JSON.stringify(await c.openReading(cid));
      } catch (error) {
        c.announce((error && error.message) || 'Library action could not finish. Try again.');
        return `threw: ${error && error.message}`;
      }
    };
    const hosts = () =>
      [...document.querySelectorAll('[data-panel="library"] [data-feature-host]')].map(
        (h) => h.dataset.featureHost
      );
    const focusIn = () => {
      const a = document.activeElement;
      const h = a && a.closest && a.closest('[data-feature-host]');
      return h ? h.dataset.featureHost : a ? a.tagName : null;
    };
    const playButton = () => document.querySelector('[data-feature-host="library"] textarea');

    // A first reading, with nothing throwing.
    playButton().focus();
    const first = await play();
    await until(() => mounts('libraryspeech') === 1);
    const old = {
      reading: window.__probe.libraryreading,
      speech: window.__probe.libraryspeech,
      readingCtx: window.__probeCtx.libraryreading,
      speechCtx: window.__probeCtx.libraryspeech,
    };
    await tick();
    said.length = 0;

    // A: the reader that is open throws from its unmount().
    window.__probeThrows = { unmount: 'libraryreading' };
    playButton().focus();
    const returned = await play();
    const a = {
      first,
      returned,
      hosts: hosts().join(),
      mounts: [mounts('libraryreading'), mounts('libraryspeech')],
      focus: focusIn(),
      focusNew:
        !!window.__probe.libraryreading &&
        window.__probe.libraryreading !== old.reading &&
        document.activeElement ===
          document.querySelector('[data-feature-host="libraryreading"] textarea'),
      oldEnded:
        old.reading.unmounted &&
        old.reading.aborted &&
        old.readingCtx.signal.aborted &&
        old.speech.unmounted &&
        old.speech.aborted &&
        old.speechCtx.signal.aborted,
      threw: !!window.__probeUnmountError,
    };
    const errA = window.__probeUnmountError;
    a.logged = errA ? loggedOf(errA) : 0;
    await until(() => mounts('libraryspeech') >= 2);
    await tick();
    a.said = said.slice();
    said.length = 0;

    // B: a new reader whose open fails, over one whose unmount throws.
    window.__probeUnmountError = null;
    window.__probeThrows = { unmount: 'libraryreading', focus: 'libraryreading' };
    playButton().focus();
    const b = { returned: await play() };
    const errB = window.__probeUnmountError;
    b.threw = !!errB;
    b.logged = errB ? loggedOf(errB) : 0;
    await tick();
    b.said = said.slice();

    // C: both lanes of the reading that is open throw from their unmount().
    // First a reading with nothing throwing, then one over it.
    window.__probeThrows = {};
    const speechMounts = mounts('libraryspeech');
    playButton().focus();
    const clean = await play();
    await until(() => mounts('libraryspeech') === speechMounts + 1);
    const oldC = { reading: window.__probe.libraryreading, speech: window.__probe.libraryspeech };
    await tick();
    said.length = 0;
    window.__probeUnmountErrors = [];
    window.__probeThrows = { unmount: ['libraryreading', 'libraryspeech'] };
    playButton().focus();
    const d = { clean, returned: await play() };
    const errsC = window.__probeUnmountErrors.slice();
    Object.assign(d, {
      threw: errsC.map((e) => e.message).sort(),
      logged: errsC.map(loggedOf),
      focus: focusIn(),
      focusNew:
        window.__probe.libraryreading !== oldC.reading &&
        document.activeElement ===
          document.querySelector('[data-feature-host="libraryreading"] textarea'),
      oldEnded:
        oldC.reading.unmounted &&
        oldC.reading.aborted &&
        oldC.speech.unmounted &&
        oldC.speech.aborted,
    });
    await until(() => mounts('libraryspeech') === speechMounts + 2);
    await tick();
    d.said = said.slice();
    d.hosts = hosts().join();
    d.speech = mounts('libraryspeech') - speechMounts;
    window.__probeThrows = {};
    return { a, b, d };
  }, cid);
}

function readerVerdict(g) {
  const { a, b, d } = g;
  const tail = a.hosts.split(',').slice(-2).join();
  const once = (id) => a.hosts.split(',').filter((h) => h === id).length === 1;
  return {
    'an old reader’s teardown':
      a.threw &&
      /"unitId":"/.test(a.first) &&
      a.returned === a.first &&
      tail === 'libraryreading,libraryspeech' &&
      once('libraryreading') &&
      once('libraryspeech') &&
      a.mounts[0] === 2 &&
      a.mounts[1] === 2 &&
      a.oldEnded &&
      a.focus === 'libraryreading' &&
      a.focusNew,
    'nothing said': a.threw && a.said.length === 0,
    logged: a.threw && a.logged === 1,
    'a new reader’s failure':
      b.threw && b.returned === 'threw: probe focus failure' && b.logged === 1,
    'both lanes’ teardown errors':
      d.clean === a.first &&
      d.returned === a.first &&
      d.threw.join() ===
        'probe unmount failure in libraryreading,probe unmount failure in libraryspeech' &&
      d.logged.length === 2 &&
      d.logged.every((n) => n === 1) &&
      d.said.length === 0 &&
      d.oldEnded &&
      d.focus === 'libraryreading' &&
      d.focusNew &&
      d.speech === 2 &&
      d.hosts.split(',').slice(-2).join() === 'libraryreading,libraryspeech' &&
      d.hosts.split(',').filter((h) => h === 'libraryreading').length === 1 &&
      d.hosts.split(',').filter((h) => h === 'libraryspeech').length === 1,
  };
}

let readerPlanted = 0;
const READER_DEFECTS = Object.keys(READER_MUTANTS).length;
async function readerChecks(browser, srv) {
  const cid = libData('catalog.json').shelves[0].cards[0][0];
  const once = async (body) => {
    const { context, page, errors, override } = await newPage(browser, srv);
    if (body)
      override.set('/prototype/app.js', { status: 200, contentType: 'text/javascript', body });
    let got;
    try {
      await page.goto(`${srv.url}/prototype/#library`);
      await waitMounted(page, 'library');
      got = await readerRun(page, cid);
    } catch (e) {
      got = null;
      errors.push(`threw: ${(e && e.message) || e}`);
    }
    await context.close();
    return { got, errors };
  };
  const base = await once(null);
  const names = [];
  if (base.got) {
    for (const [check, ok] of Object.entries(readerVerdict(base.got))) {
      names.push(check);
      expect(ok, `reader: ${check} failed on app.js: ${JSON.stringify(base.got)}`);
    }
  } else expect(false, `reader: the run failed: ${base.errors.join(' | ')}`);
  expect(!base.errors.length, `reader: uncaught errors: ${base.errors.join(' | ')}`);
  // Every check has a planted defect of its own, and each must fail it.
  const planting = new Set(Object.values(READER_MUTANTS).map((m) => m.check));
  for (const n of names) expect(planting.has(n), `reader: the ${n} check has no planted defect`);
  for (const [name, { check, edits }] of Object.entries(READER_MUTANTS)) {
    expect(names.includes(check), `reader: the planted defect "${name}" names no check (${check})`);
    const src = plantIn(APP_JS, edits);
    expect(!!src, `reader: the planted defect "${name}" no longer applies to app.js`);
    if (!src) continue;
    const r = await once(src);
    const failed = !r.got || readerVerdict(r.got)[check] !== true;
    expect(failed, `reader: with the planted defect "${name}", the ${check} check still passes`);
    if (failed) readerPlanted++;
  }
}

// ── 18. A READER THAT CAN'T START (#810, Don's reply to 6683384760) ──────
// app.js's openReader again, through the Library lane's openReading, with the
// same stand-in for explore.js that says a rejection. Here the new reader
// can't start, in each of the three ways a lane can't: its module doesn't
// load (served 404), its context() fails, or its mount() throws (the
// probe's). The reader's context awaits nothing in this build, so it can't
// fail by itself: the gate serves app.js with that one context changed to
// throw when window.__readerContextFails is set (READER_CONTEXT_FAULT), and
// applies each planted defect beneath it. The stand-in read-aloud says
// something as it mounts, as the real one can, and its first module load is
// answered late. In each way, Play ("Play" is the Library probe's field) is
// pressed with focus on it: once it is left there, once moved nowhere
// (blurred) and once moved elsewhere (the method reference's field), each
// move made at once, while the unit is looked up and before the open begins,
// and once moved elsewhere while the reader's module loads. Each time the
// status region must hear exactly one sentence, the one the reader's host
// shows in the panel, and end on it; openReading must resolve { unitId }, so
// the stand-in says nothing; focus must be on the reader's Retry when its
// host has one (the context), else on the sentence, unless the person moved
// it elsewhere, where it must stay; and read-aloud must not be granted Play's
// autoplay. Once more, the person leaves the Library's route at once, and
// nothing may be said. With the reader and read-aloud both throwing, only the
// reader's sentence is said, with focus on it; with read-aloud alone
// throwing, nothing is said, focus stays in the reader, where the open put
// it, and read-aloud is granted the autoplay. The reader's Retry (the
// context's): when its mount() throws, its sentence is said with focus on
// it; when its data fails again, its sentence is said and focus moved back
// to Retry, unless the person moved it on (elsewhere, or back to Play) while
// it loaded; when it mounts, focus goes into the reader unless the person
// moved it on. And Play on an appended card, whose collection file is
// answered late, then Play on a shelf's card: only the later reading opens,
// and its sentence is said once. Each check has a planted defect in host.js
// or app.js (START_MUTANTS), served in place of the file in pages of its own,
// which must fail it.
const START_SAYS = {
  module: 'The reader isn’t part of this build of the prototype yet.',
  context: 'The reading did not load. Check your connection, then try again.',
  mount: 'The reader couldn’t start. The rest of the prototype still works.',
};
const SPEECH_COULDNT_START = 'Read aloud couldn’t start. The rest of the prototype still works.';
const START_KINDS = Object.keys(START_SAYS);
const READER_CONTEXT_FAULT = [
  [
    '      context: async () => ({ unitId, reading: readings.reading }),\n',
    "      context: async () => {\n        if (window.__readerContextFails) throw new Error('probe context failure');\n        return { unitId, reading: readings.reading };\n      },\n",
  ],
];
const TELL_IF = 'if (!active || active === document.body || active === from)';
// The Retry's own: its data fails again, or it mounts.
const RETRY_TOLD =
  '      if (again) tell(null); // a Retry asked for it\n      return;\n    }\n    if (host !== node) {';
const RETRY_FOCUS =
  "    if (again && (!active || active === document.body) && typeof handle.focus === 'function')\n      handle.focus();";
const OPEN_TELLS = 'if (mounted && hosts.length) hosts[0].tellUnavailable();';
const START_MUTANTS = {
  'a reader that can’t start is not said': {
    file: 'host',
    check: 'said once',
    edits: [['    announce(note.textContent);\n    return true;', '    return true;']],
  },
  'focus stays where the open left it': {
    file: 'host',
    check: 'focus from Play',
    edits: [
      [`    ${TELL_IF}\n      (host.querySelector('[data-host-retry]') || note).focus();\n`, ''],
    ],
  },
  'focus from Play is not moved': {
    file: 'host',
    check: 'focus from Play',
    edits: [[TELL_IF, 'if (!active || active === document.body)']],
  },
  'focus that was nowhere stays nowhere': {
    file: 'host',
    check: 'focus from nowhere',
    edits: [[TELL_IF, 'if (active === from)']],
  },
  'focus taken from wherever it is': {
    file: 'host',
    check: 'focus moved elsewhere',
    edits: [[TELL_IF, 'if (active || !active)']],
  },
  'the sentence over Retry': {
    file: 'host',
    check: 'Retry before the sentence',
    edits: [["(host.querySelector('[data-host-retry]') || note).focus();", 'note.focus();']],
  },
  'every lane that can’t start is said': {
    file: 'host',
    check: 'both lanes',
    edits: [[OPEN_TELLS, 'if (mounted) for (const h of hosts) h.tellUnavailable();']],
  },
  'a later lane’s failure is said too': {
    file: 'host',
    check: 'read-aloud alone',
    edits: [[OPEN_TELLS, 'if (mounted) for (const h of hosts) if (h.tellUnavailable()) break;']],
  },
  'told before the later lanes are shown': {
    file: 'host',
    check: 'said last',
    edits: [
      [
        '        if (i === 0) h.focus();\n      }\n',
        '        if (i === 0) {\n          h.focus();\n          h.tellUnavailable();\n        }\n      }\n',
      ],
      [`      ${OPEN_TELLS}\n`, ''],
    ],
  },
  // Focus as it was when the lane was shown, before its module had loaded.
  'focus read when the lane was shown, not when told': {
    file: 'host',
    check: 'focus moved while the reader loads',
    edits: [
      [
        '  let opener = null; // what show() was opened from, for close()\n',
        '  let opener = null; // what show() was opened from, for close()\n  let seen = null;\n',
      ],
      [
        '        opener = returnFocus || document.activeElement;\n',
        '        opener = returnFocus || document.activeElement;\n        seen = document.activeElement;\n',
      ],
      [
        `    const active = document.activeElement;\n    ${TELL_IF}`,
        `    const active = seen;\n    ${TELL_IF}`,
      ],
    ],
  },
  'said while the panel is hidden': {
    file: 'host',
    check: 'nothing said while the Library is hidden',
    edits: [["if (!note || panel.closest('[hidden]')) return false;", 'if (!note) return false;']],
  },
  // Each way a lane can't start, left unmarked, so the open can't tell it.
  'a module that won’t load is not marked': {
    file: 'host',
    check: 'a module that won’t load',
    edits: [
      [
        "      state = 'unavailable';\n      explain(node, `${lane.label} isn’t part",
        '      explain(node, `${lane.label} isn’t part',
      ],
    ],
  },
  'a context that fails is not marked': {
    file: 'host',
    check: 'a context that fails',
    edits: [["      state = 'unavailable';\n      const sentence", '      const sentence']],
  },
  'a mount that throws is not marked': {
    file: 'host',
    check: 'a mount that throws',
    edits: [
      [
        "      state = 'unavailable';\n      explain(host, `${lane.label} couldn’t start.",
        '      explain(host, `${lane.label} couldn’t start.',
      ],
    ],
  },
  // A Retry, as 13de255a3 left it, and judged as the open is.
  'a Retry whose mount throws says nothing': {
    file: 'host',
    check: 'Retry whose mount throws',
    edits: [
      [
        'prototype still works.`);\n      if (again) tell(null); // a Retry asked for it\n',
        'prototype still works.`);\n',
      ],
    ],
  },
  'a Retry that fails again takes focus back': {
    file: 'host',
    check: 'Retry leaves focus the person moved',
    edits: [
      [
        RETRY_TOLD,
        "      if (again) {\n        host.querySelector('[data-host-retry]').focus();\n        announce(sentence);\n      }\n      return;\n    }\n    if (host !== node) {",
      ],
    ],
  },
  'a Retry judged from what opened the lane': {
    file: 'host',
    check: 'Retry leaves focus the person moved',
    edits: [[RETRY_TOLD, RETRY_TOLD.replace('tell(null)', 'tell(opener)')]],
  },
  'a Retry that starts takes focus back': {
    file: 'host',
    check: 'a Retry that starts leaves focus the person moved',
    edits: [[RETRY_FOCUS, "    if (again && typeof handle.focus === 'function') handle.focus();"]],
  },
  'the opener taken after the look-up': {
    file: 'app',
    check: 'focus moved elsewhere',
    edits: [
      [
        '      const opener = document.activeElement; // Play, before the look-up\n      const unitId = await lib.unitOf(cid);\n',
        '      const unitId = await lib.unitOf(cid);\n      const opener = document.activeElement;\n',
      ],
    ],
  },
  'openReader drops the opener': {
    file: 'app',
    check: 'focus moved elsewhere',
    edits: [
      [
        'open: (lanes) => slot.open(lanes, { returnFocus: opener }),',
        'open: (lanes) => slot.open(lanes),',
      ],
    ],
  },
  'an earlier Play opens over a later one': {
    file: 'app',
    check: 'the latest Play opens',
    edits: [['      if (mine !== plays) return { unitId }; // a later Play opens instead\n', '']],
  },
  'autoplay beside a reader that couldn’t start': {
    file: 'app',
    check: 'no autoplay beside a reader that couldn’t start',
    edits: [
      [
        "        if (!readerStarted()) play = false; // Play's autoplay, only beside the reader\n",
        '',
      ],
    ],
  },
  'openReading rejects with the sentence as well': {
    file: 'app',
    check: 'resolves',
    edits: [
      [
        '      await openReader(unitId, { play: true, opener });\n      return { unitId };',
        "      await openReader(unitId, { play: true, opener });\n      const note = document.querySelector('[data-feature-host=\"libraryreading\"] [data-host-note]');\n      if (note) throw Object.assign(new Error(note.textContent), { code: 'UNAVAILABLE' });\n      return { unitId };",
      ],
    ],
  },
};

// `later` is a collection only appended cards show, whose look-up fetches its
// collection file: the gate answers that file late (LATE_LOOKUP_MS).
async function startRun(page, cid, kind, later) {
  return page.evaluate(
    async ({ cid, kind, later }) => {
      const c = window.__probeCtx.library;
      const region = document.getElementById('proto-status');
      // Every sentence the region is given, one per announcement, but the
      // stand-in read-aloud's own (said as it mounts, for "said last").
      let said = [];
      new MutationObserver((records) => {
        for (const r of records)
          for (const n of r.addedNodes)
            if (n.textContent && !n.textContent.endsWith('probe mounted')) said.push(n.textContent);
      }).observe(region, { childList: true, subtree: true });
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const play = () => document.querySelector('[data-feature-host="library"] textarea');
      const elsewhere = () =>
        document.querySelector('[data-feature-host="librarymethods"] textarea');
      const where = () => {
        const a = document.activeElement;
        if (!a || a === document.body) return 'nowhere';
        if (a === play()) return 'play';
        if (a === elsewhere()) return 'elsewhere';
        if (a.closest('[data-panel="browse"]')) return 'browse';
        const h = a.closest && a.closest('[data-feature-host]');
        const id = h ? h.dataset.featureHost : a.tagName;
        if (a.matches('[data-host-note]')) return `note:${id}`;
        if (a.matches('[data-host-retry]')) return `retry:${id}`;
        return id;
      };
      const inHost = (lane, sel) =>
        document.querySelector(`[data-panel="library"] [data-feature-host="${lane}"] ${sel}`);
      // Play, as explore.js handles it: a rejection is said, in its message.
      const openFromPlay = (id) =>
        c.openReading(id).then(
          (v) => JSON.stringify(v),
          (error) => {
            c.announce((error && error.message) || 'Library action could not finish. Try again.');
            return `threw: ${error && error.message}`;
          }
        );
      const speechCtx = () => window.__probeCtx && window.__probeCtx.libraryspeech;
      const readerMounts = () => (window.__probe.libraryreading || {}).mounts || 0;
      const state = (situation, returned, before) => {
        const reader = inHost('libraryreading', '[data-host-note]');
        const speech = inHost('libraryspeech', '[data-host-note]');
        const sp = speechCtx();
        return {
          situation,
          returned,
          said: said.slice(),
          last: region.textContent,
          focus: where(),
          reader: reader ? reader.textContent : null,
          readerRetry: !!inHost('libraryreading', '[data-host-retry]'),
          speech: speech ? speech.textContent : null,
          // What this open's read-aloud was granted (null: it had no ctx).
          autoplay: sp && sp !== before.sp ? sp.speech.takeAutoplay() : null,
          readerMounts: readerMounts() - before.mounts,
          readerUnit: window.__probeCtx.libraryreading && window.__probeCtx.libraryreading.unitId,
          hidden: document.querySelector('[data-panel="library"]').hidden,
          hosts: [...document.querySelectorAll('[data-panel="library"] [data-feature-host]')]
            .map((h) => h.dataset.featureHost)
            .join(),
        };
      };
      const press = async (situation, throws) => {
        await wait(50); // the turn before has ended
        window.__probeThrow = throws;
        said = [];
        const before = { sp: speechCtx(), mounts: readerMounts() };
        play().focus();
        const opened = openFromPlay(cid);
        // The person moves focus at once, while the unit is looked up.
        if (situation === 'nowhere') document.activeElement.blur();
        if (situation === 'elsewhere') elsewhere().focus();
        // Or once the open has begun, while the reader's module loads.
        if (situation === 'during') {
          while (!/^Loading/.test(inHost('libraryreading', '[data-host-note]')?.textContent || ''))
            await wait(5);
          elsewhere().focus();
        }
        const returned = await opened;
        await wait(150); // anything said late is heard
        return state(situation, returned, before);
      };
      // The shell's own route change, run now rather than in the task the
      // hash change queues, so that no open can finish before it.
      const route = (to) => {
        location.hash = `#${to}`;
        window.dispatchEvent(new window.HashChangeEvent('hashchange'));
      };
      // Play, and the person leaves the Library's route at once.
      const away = async (throws) => {
        await wait(50);
        window.__probeThrow = throws;
        said = [];
        const before = { sp: speechCtx(), mounts: readerMounts() };
        play().focus();
        const opened = openFromPlay(cid);
        route('browse');
        const returned = await opened;
        await wait(150);
        const r = state('away', returned, before);
        route('library');
        await wait(50);
        return r;
      };
      // Play on an appended card, then on a shelf's card before the first
      // card's look-up has finished, so the earlier look-up finishes last.
      const overtaken = async (throws) => {
        await wait(50);
        window.__probeThrow = throws;
        said = [];
        const before = { sp: speechCtx(), mounts: readerMounts() };
        play().focus();
        const first = openFromPlay(later);
        await wait(50);
        play().focus();
        const second = openFromPlay(cid);
        const returned = await Promise.all([first, second]);
        await wait(150);
        return state('overtaken', returned, before);
      };
      window.__readerContextFails = kind === 'context';
      window.__probeSays = 'libraryspeech'; // read-aloud speaks as it mounts
      const lane = kind === 'mount' ? 'libraryreading' : undefined;
      const runs = [];
      // 'during' first: only the first load of the reader's module is slow.
      for (const situation of ['during', 'play', 'nowhere', 'elsewhere'])
        runs.push(await press(situation, lane));
      // A Retry (the context's), with focus on it: its data fails again with
      // focus moved elsewhere or back to Play while it loads; it mounts and
      // the mount throws; or it mounts, with focus left or moved elsewhere.
      const retry = async (situation) => {
        await press('play', lane); // focus on Retry
        await wait(50);
        said = [];
        if (/^retry-(mount|ok)/.test(situation)) window.__readerContextFails = false;
        if (situation === 'retry-mount') window.__probeThrow = 'libraryreading';
        inHost('libraryreading', '[data-host-retry]').click();
        if (/elsewhere$/.test(situation)) elsewhere().focus();
        if (situation === 'retry-play') play().focus();
        await wait(200);
        window.__readerContextFails = true;
        window.__probeThrow = undefined;
        return { situation, said: said.slice(), focus: where() };
      };
      if (kind === 'context')
        for (const situation of [
          'retry-mount',
          'retry-elsewhere',
          'retry-play',
          'retry-ok',
          'retry-ok-elsewhere',
        ])
          runs.push(await retry(situation));
      if (kind === 'mount') {
        runs.push(await press('both', ['libraryreading', 'libraryspeech']));
        runs.push(await press('speech', 'libraryspeech'));
        runs.push(await overtaken(lane));
      }
      runs.push(await away(lane));
      window.__probeThrow = undefined;
      window.__probeSays = undefined;
      return runs;
    },
    { cid, kind, later }
  );
}

function startVerdict(g) {
  const SITUATIONS = ['play', 'nowhere', 'elsewhere'];
  const of = (kind) => (g[kind] || []).filter((r) => SITUATIONS.includes(r.situation));
  const all = START_KINDS.flatMap((kind) => of(kind).map((r) => ({ kind, r })));
  const run = (kind, s) => (g[kind] || []).find((r) => r.situation === s) || null;
  const target = (kind, s) =>
    s === 'elsewhere' ? 'elsewhere' : `${kind === 'context' ? 'retry' : 'note'}:libraryreading`;
  const resolved = (r) => /^\{"unitId":"[^"]+"\}$/.test(r.returned);
  const tail = (r) =>
    r.hosts.split(',').slice(-2).join() === 'libraryreading,libraryspeech' &&
    r.hosts.split(',').filter((h) => h === 'libraryreading').length === 1 &&
    r.hosts.split(',').filter((h) => h === 'libraryspeech').length === 1;
  const saidOnce = (r, sentence) => r.said.length === 1 && r.said[0] === sentence;
  const right = ({ kind, r }) =>
    saidOnce(r, START_SAYS[kind]) &&
    r.reader === START_SAYS[kind] &&
    r.readerRetry === (kind === 'context') &&
    r.speech === null &&
    resolved(r) &&
    tail(r) &&
    r.focus === target(kind, r.situation);
  const kindRight = (kind) => of(kind).length === 3 && of(kind).every((r) => right({ kind, r }));
  const focusFrom = (s) =>
    all.filter((x) => x.r.situation === s).length === 3 &&
    all.filter((x) => x.r.situation === s).every((x) => x.r.focus === target(x.kind, s));
  const both = run('mount', 'both');
  const speech = run('mount', 'speech');
  const overtaken = run('mount', 'overtaken');
  const during = START_KINDS.map((kind) => [kind, run(kind, 'during')]);
  const away = START_KINDS.map((kind) => [kind, run(kind, 'away')]);
  const retried = (s) => run('context', s);
  const unitOf = (json) => {
    try {
      return JSON.parse(json).unitId;
    } catch {
      return null;
    }
  };
  // Every open beside a reader that couldn't start, whose read-aloud had a ctx.
  const besideFailed = [
    ...START_KINDS.flatMap((kind) => ['during', ...SITUATIONS].map((s) => run(kind, s))),
    both,
  ];
  return {
    'focus moved while the reader loads': during.every(
      ([kind, r]) => r && r.focus === 'elsewhere' && saidOnce(r, START_SAYS[kind]) && resolved(r)
    ),
    'said last': all.length === 9 && all.every((x) => x.r.last === START_SAYS[x.kind]),
    'Retry whose mount throws':
      !!retried('retry-mount') &&
      saidOnce(retried('retry-mount'), START_SAYS.mount) &&
      retried('retry-mount').focus === 'note:libraryreading',
    'Retry leaves focus the person moved': ['elsewhere', 'play'].every(
      (to) =>
        !!retried(`retry-${to}`) &&
        saidOnce(retried(`retry-${to}`), START_SAYS.context) &&
        retried(`retry-${to}`).focus === to
    ),
    'a Retry that starts leaves focus the person moved':
      !!retried('retry-ok') &&
      !retried('retry-ok').said.length &&
      retried('retry-ok').focus === 'libraryreading' &&
      !!retried('retry-ok-elsewhere') &&
      !retried('retry-ok-elsewhere').said.length &&
      retried('retry-ok-elsewhere').focus === 'elsewhere',
    'a module that won’t load': kindRight('module'),
    'a context that fails': kindRight('context'),
    'a mount that throws': kindRight('mount'),
    'said once': all.length === 9 && all.every((x) => saidOnce(x.r, START_SAYS[x.kind])),
    'focus from Play': focusFrom('play'),
    'focus from nowhere': focusFrom('nowhere'),
    'focus moved elsewhere': focusFrom('elsewhere'),
    'Retry before the sentence':
      of('context').filter((r) => r.situation !== 'elsewhere').length === 2 &&
      of('context')
        .filter((r) => r.situation !== 'elsewhere')
        .every((r) => r.readerRetry && r.focus === 'retry:libraryreading'),
    resolves:
      all.length === 9 &&
      all.every((x) => resolved(x.r)) &&
      !!both &&
      resolved(both) &&
      !!speech &&
      resolved(speech),
    'both lanes':
      !!both &&
      saidOnce(both, START_SAYS.mount) &&
      both.reader === START_SAYS.mount &&
      both.speech === SPEECH_COULDNT_START &&
      both.focus === 'note:libraryreading' &&
      tail(both),
    'read-aloud alone':
      !!speech &&
      !speech.said.length &&
      speech.reader === null &&
      speech.speech === SPEECH_COULDNT_START &&
      speech.focus === 'libraryreading' &&
      tail(speech),
    'nothing said while the Library is hidden': away.every(
      ([kind, r]) =>
        r &&
        r.hidden &&
        !r.said.length &&
        r.reader === START_SAYS[kind] &&
        r.focus === 'browse' &&
        resolved(r)
    ),
    'the latest Play opens':
      !!overtaken &&
      overtaken.returned.every((x) => resolved({ returned: x })) &&
      overtaken.readerMounts === 1 &&
      !!overtaken.readerUnit &&
      overtaken.readerUnit === unitOf(overtaken.returned[1]) &&
      overtaken.readerUnit !== unitOf(overtaken.returned[0]) &&
      saidOnce(overtaken, START_SAYS.mount) &&
      overtaken.focus === 'note:libraryreading' &&
      tail(overtaken),
    // Beside a reader that started (read-aloud alone failing), Play's grant.
    'no autoplay beside a reader that couldn’t start':
      besideFailed.every((r) => r && r.autoplay === false) && !!speech && speech.autoplay === true,
  };
}

const LATE_LOOKUP_MS = 400;
let startPlanted = 0;
const START_DEFECTS = Object.keys(START_MUTANTS).length;
async function startChecks(browser, srv) {
  const catalog = libData('catalog.json');
  const cid = catalog.shelves[0].cards[0][0];
  // A readable collection no shelf shows, so its look-up fetches its file.
  const shown = new Set(catalog.shelves.flatMap((s) => s.cards.map((t) => t[0])));
  const later = libData('collections.json').collections.find((r) => r[3] > 0 && !shown.has(r[0]));
  // One page per way the reader can't start, with app.js and host.js as
  // served (`served.app`, `served.host`: the planted text, or undefined for
  // the committed file); the context's page gets READER_CONTEXT_FAULT on top.
  // The reader's module is answered late (only its first load asks for it),
  // and so is the appended collection's file.
  const onePage = async (kind, served) => {
    const slow = {
      libraryreading: 300,
      [`/library/data/c/${later && later[0]}.json.gz`]: LATE_LOOKUP_MS,
    };
    const { context, page, errors, override } = await newPage(
      browser,
      srv,
      kind === 'module' ? { missing: ['libraryreading'], slow } : { slow }
    );
    const js = (body) => ({ status: 200, contentType: 'text/javascript', body });
    const app =
      kind === 'context' ? plantIn(served.app || APP_JS, READER_CONTEXT_FAULT) : served.app;
    if (kind === 'context' && !app) errors.push('the context fault no longer applies to app.js');
    if (app) override.set('/prototype/app.js', js(app));
    if (served.host) override.set('/prototype/host.js', js(served.host));
    let got = null;
    try {
      await page.goto(`${srv.url}/prototype/#library`);
      await waitMounted(page, 'library');
      await waitMounted(page, 'librarymethods');
      if (!later) throw new Error('no readable collection is left off the shelves');
      got = await startRun(page, cid, kind, later[0]);
    } catch (e) {
      errors.push(`threw: ${(e && e.message) || e}`);
    }
    await context.close();
    return { got, errors };
  };
  const once = async (served) => {
    const pages = await Promise.all(START_KINDS.map((kind) => onePage(kind, served)));
    const g = {};
    START_KINDS.forEach((kind, i) => (g[kind] = pages[i].got));
    return { g, ok: pages.every((p) => p.got), errors: pages.flatMap((p) => p.errors) };
  };
  const base = await once({});
  const names = [];
  for (const [check, ok] of Object.entries(startVerdict(base.g))) {
    names.push(check);
    expect(ok, `reader start: ${check} failed: ${JSON.stringify(base.g)}`);
  }
  expect(base.ok, `reader start: a page did not run: ${base.errors.join(' | ')}`);
  expect(!base.errors.length, `reader start: uncaught errors: ${base.errors.join(' | ')}`);
  // Every check has a planted defect of its own, and each must fail it.
  const planting = new Set(Object.values(START_MUTANTS).map((m) => m.check));
  for (const n of names)
    expect(planting.has(n), `reader start: the ${n} check has no planted defect`);
  const texts = { app: APP_JS, host: HOST_JS };
  const outcomes = await pooled(Object.entries(START_MUTANTS), 2, async ([name, m]) => {
    const src = plantIn(texts[m.file], m.edits);
    if (!src) return { name, m, applies: false };
    const r = await once({ [m.file]: src });
    return { name, m, applies: true, failed: startVerdict(r.g)[m.check] !== true };
  });
  for (const { name, m, applies, failed } of outcomes) {
    expect(
      names.includes(m.check),
      `reader start: the planted defect "${name}" names no check (${m.check})`
    );
    expect(applies, `reader start: the planted defect "${name}" no longer applies to ${m.file}.js`);
    if (!applies) continue;
    expect(
      failed,
      `reader start: with the planted defect "${name}", the ${m.check} check still passes`
    );
    if (failed) startPlanted++;
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

// ── 14. CLOSE (#665 B0) ─────────────────────────────────────────────────────
// A closable fixture lane and a plain one, in one panel, on host.js as
// committed and then on each planted defect (CLOSE_MUTANTS): the edits to
// host.js, applied in order, each of whose `from` must occur exactly once,
// and the check that the defect must fail. The fixture lane closes itself
// as a sheet does: its Close button, or Escape anywhere inside it. Its own
// ctx fields ask for three variants: closeInMount calls close() inside
// mount(), contentFirst clears the lane's own content (and with it the focus)
// before it calls close(), as a sheet's `unmount(); ctx.close();` would, and
// unmountThrows makes its unmount() throw, as a buggy lane's might (with
// unmountThrows as the message, when it is a string).
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
      if (ctx.unmountThrows)
        throw new Error(
          typeof ctx.unmountThrows === 'string' ? ctx.unmountThrows : 'the lane’s unmount failed'
        );
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
    edits: [['const failed = clear(); // what was open goes first', 'const failed = [];']],
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
    edits: [
      [
        '    if (host !== node) {\n      mine.abort();\n      return; // unmounted while its ctx loaded\n    }\n',
        '',
      ],
    ],
  },
  'an overtaken open goes on': {
    check: 'stops when overtaken',
    edits: [['mounted = false; // overtaken\n          break;', '']],
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
    edits: [["const failed = clear(); // the shell's own close", 'const failed = [];']],
  },
  'the shell’s close doesn’t stop an open': {
    check: 'shell close stops an open',
    edits: [['turn++;\n      const failed = clear();', 'const failed = clear();']],
  },
  // #810 6675659005: a held lane whose unmount() throws.
  'clear stops at a throwing unmount': {
    check: 'a throwing unmount',
    edits: [
      [
        '      try {\n        h.unmount();\n      } catch (error) {\n        errors.push(error);\n      }\n',
        '      h.unmount();\n',
      ],
    ],
  },
  'an open stops at a throwing unmount': {
    check: 'a throwing unmount',
    edits: [
      [
        'const failed = clear(); // what was open goes first',
        'const failed = clear(); // what was open goes first\n      if (failed.length) throw failure(failed);',
      ],
    ],
  },
  'an open swallows a throwing unmount': {
    check: 'a throwing unmount',
    edits: [['if (failed.length) throw failure(failed); // the open went on regardless', '']],
  },
  'the shell’s close swallows a throwing unmount': {
    check: 'a throwing unmount',
    edits: [['if (failed.length) throw failure(failed); // every lane went regardless', '']],
  },
  // #810 6677708921: several held lanes whose unmount() throws.
  'clear keeps only the first of several errors': {
    check: 'several throwing unmounts',
    edits: [['        errors.push(error);\n', '        if (!errors.length) errors.push(error);\n']],
  },
  'an open hands back one of several errors': {
    check: 'several throwing unmounts',
    edits: [
      [
        'if (failed.length) throw failure(failed); // the open went on regardless',
        'if (failed.length) throw failed[0]; // the open went on regardless',
      ],
    ],
  },
  'the shell’s close hands back one of several errors': {
    check: 'several throwing unmounts',
    edits: [
      [
        'if (failed.length) throw failure(failed); // every lane went regardless',
        'if (failed.length) throw failed[0]; // every lane went regardless',
      ],
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
      // A held lane whose unmount() throws (#810 6675659005): the next open()
      // still ends every held lane, mounts its own with focus in it, and then
      // rejects with that error; the shell's close() ends every lane too,
      // then throws it.
      const throwing = { context: async () => ({ unmountThrows: true }) };
      opener.focus();
      await settle(slot.open([lane('t1'), lane('t2', throwing)]));
      const throwsOpen = { returned: await settle(slot.open(lane('t3'))) };
      Object.assign(throwsOpen, {
        order: order(),
        focus: where(),
        ended: ended('t1') && ended('t2'),
        mounts: rec('t3').mounts,
      });
      await settle(slot.open([lane('t4'), lane('t5', throwing)]));
      const throwsClose = { threw: null };
      try {
        slot.close();
      } catch (e) {
        throwsClose.threw = e.message;
      }
      Object.assign(throwsClose, { order: order(), ended: ended('t4') && ended('t5') });
      // Two held lanes whose unmount() throws (#810 6677708921): neither error
      // is lost. open() rejects, and close() throws, one AggregateError
      // holding both, in the order they were thrown (the last lane's first).
      const several = (e) =>
        e instanceof AggregateError
          ? e.errors.map((x) => x.message).join()
          : `one: ${e && e.message}`;
      const thrower = (id) =>
        lane(id, { context: async () => ({ unmountThrows: `${id} failed` }) });
      opener.focus();
      await settle(slot.open([thrower('u1'), thrower('u2')]));
      const severalOpen = { threw: null };
      try {
        severalOpen.returned = await slot.open(lane('u3'));
      } catch (e) {
        severalOpen.threw = several(e);
      }
      Object.assign(severalOpen, {
        order: order(),
        focus: where(),
        ended: ended('u1') && ended('u2'),
        mounts: rec('u3').mounts,
      });
      await settle(slot.open([thrower('u4'), thrower('u5')]));
      const severalClose = { threw: null };
      try {
        slot.close();
      } catch (e) {
        severalClose.threw = several(e);
      }
      Object.assign(severalClose, { order: order(), ended: ended('u4') && ended('u5') });
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
      return {
        one,
        two,
        loading,
        ctxing,
        sheet,
        second,
        explicit,
        shut,
        throwsOpen,
        throwsClose,
        severalOpen,
        severalClose,
        shutting,
        late,
      };
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
    'a throwing unmount':
      g.throwsOpen.returned === 'threw: the lane’s unmount failed' &&
      g.throwsOpen.ended &&
      g.throwsOpen.order === 'tab,t3' &&
      g.throwsOpen.mounts === 1 &&
      g.throwsOpen.focus === 't3' &&
      g.throwsClose.threw === 'the lane’s unmount failed' &&
      g.throwsClose.ended &&
      g.throwsClose.order === 'tab',
    'several throwing unmounts':
      g.severalOpen.threw === 'u2 failed,u1 failed' &&
      g.severalOpen.ended &&
      g.severalOpen.order === 'tab,u3' &&
      g.severalOpen.mounts === 1 &&
      g.severalOpen.focus === 'u3' &&
      g.severalClose.threw === 'u5 failed,u4 failed' &&
      g.severalClose.ended &&
      g.severalClose.order === 'tab',
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
// disclosure. The count line must head the results, as production's #gp-count
// does: right after Find a sound's host and before the Genre detail's, so
// focus after a branch doesn't land past the detail (Jony, #810 6673521152);
// and when the discovery data doesn't load, neither the store's sentence nor
// the one each lane's host shows on the page may blame a connection (the
// engine's page parse fails there too).
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

  // Data that doesn't load: the store's own sentence, and the sentence each
  // lane's host shows on the page before its Retry, say what failed and what
  // to do, with no connection named.
  {
    const { context, page } = await newPage(browser, srv, { fail: ['/api/browse_boot.json'] });
    await page.goto(`${srv.url}/prototype/#genre`);
    await page.evaluate(async () => {
      window.__discovery = (await import('/prototype/app.js')).discovery;
    });
    const failed = await page
      .waitForFunction(
        () => {
          const c = window.__discovery.categories.current();
          return c.status === 'error' && { code: c.error.code, message: c.error.message };
        },
        null,
        { timeout: 15000 }
      )
      .then((h) => h.jsonValue())
      .catch((e) => ({ error: String(e) }));
    expect(
      !!failed &&
        failed.code === 'LOAD_FAILED' &&
        failed.message === 'The genres couldn’t load. Try again.',
      `discovery: a load that failed said ${JSON.stringify(failed)}`
    );
    const shown = await page
      .waitForFunction(
        () => {
          const notes = ['genrecategories', 'genretargets'].map((l) => {
            const host = document.querySelector(`[data-feature-host="${l}"]`);
            const n = host && host.querySelector('[data-host-note]');
            return n && n.textContent;
          });
          return notes.every((n) => n && !/^Loading/.test(n)) && notes;
        },
        null,
        { timeout: 15000 }
      )
      .then((h) => h.jsonValue())
      .catch((e) => ({ error: String(e) }));
    expect(
      JSON.stringify(shown) ===
        JSON.stringify([
          'The genre categories did not load. Try again.',
          'Find a sound did not load. Try again.',
        ]),
      `discovery: a load that failed showed ${JSON.stringify(shown)} on the page`
    );
    await context.close();
  }

  const { context, page, errors } = await newPage(browser, srv);
  await page.goto(`${srv.url}/prototype/#genre`);
  await waitMounted(page, 'genrecategories');
  await waitMounted(page, 'genretargets');
  const placed = await page.evaluate(() => {
    const panel = document.querySelector('[data-panel="genre"]');
    const count = panel.querySelector('[data-genre-count]');
    const host = (lane) => panel.querySelector(`[data-feature-host="${lane}"]`);
    return {
      afterTargets: !!host('genretargets') && host('genretargets').nextElementSibling === count,
      beforeDetail: !!host('genredetail') && count.nextElementSibling === host('genredetail'),
    };
  });
  expect(
    placed.afterTargets && placed.beforeDetail,
    `discovery: the count line is not between Find a sound and the Genre detail (${JSON.stringify(placed)})`
  );
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

// ── 16. THE RECIPE STORE (#670 P2 step 5) ─────────────────────────────────
// prototype/recipe-store.js, through the shell that constructs it (app.js's
// exported `recipe` and selection.js's `instrument`), each check in a page
// of its own, against codex.html's own functions on the same sequence:
// uiAddGenre, uiAddInstrument, ipAddConfigured, ipApply, ipChoose, ipDiff,
// makeCard, traditionCardOpts, compileStack, compileRecipeStack, envCardOf,
// uiEnvHandoverText and copyToClipboard, and the toasts they show. Every
// check also runs on the store with a planted defect of its own
// (STORE_MUTANTS; LOAD_MUTANTS for load.js), served in place of the file in
// that check's own page, and that defect must fail the check.
const STORE_FILE = path.join(root, 'prototype', 'recipe-store.js');
const LOAD_FILE = path.join(root, 'prototype', 'engine', 'load.js');
const hasStore = fs.existsSync(STORE_FILE);
const STORE_JS = hasStore ? fs.readFileSync(STORE_FILE, 'utf8') : '';
const LOAD_JS = fs.readFileSync(LOAD_FILE, 'utf8');
const DATA_JS = fs.readFileSync(path.join(root, 'prototype', 'data.js'), 'utf8');
const APP_JS = fs.readFileSync(path.join(root, 'prototype', 'app.js'), 'utf8');
// A registered lane's recipe view: exactly these methods (the §10 table).
const PORT_KEYS = {
  genreinstruments: { recipe: ['addEnsemble', 'addInstrument', 'snapshot', 'subscribe'] },
};
// Every registered lane, and what its ctx lets it subscribe to (a field's
// subscribe or subscribeVoices, or a method that takes a listener among its
// options, CALLBACK_METHODS), each of which ends with its mount (app.js
// ending and speaking, #810 6682309672).
const SUBSCRIBED = {
  browse: [],
  genrecategories: ['categories.subscribe', 'discovery.subscribe', 'targets.subscribe'],
  genredetail: ['genre.subscribe'],
  genreinstruments: ['genre.subscribe', 'recipe.subscribe'],
  genretargets: ['discovery.subscribe', 'targets.subscribe'],
  instrumentdetail: ['instrument.subscribe'],
  library: ['selection.subscribe'],
  librarycredits: [],
  librarymethods: [],
  libraryreading: [],
  libraryspeech: ['speech.speak', 'speech.subscribeVoices'],
  lyrics: [],
};
// The ctx methods that take a listener among their options: speak's onend
// and onerror (#810, the review of 6682309672's fixes).
const CALLBACK_METHODS = ['speech.speak'];
// Every registered lane's ctx views (each object field but the host's
// storage and signal) and every method each one carries. A view given a new
// method fails check 40 until it is listed here, and so classified: a
// subscription, by whatever name, also goes in SUBSCRIBED (and a listener
// method in CALLBACK_METHODS too), where check 40 drives it (#810, the
// review of 6682309672's fixes: a subscription inside a view, named
// otherwise, went unchecked).
const DISCLOSURE_METHODS = ['current', 'focusToggle', 'setOpen', 'subscribe'];
const CTX_VIEWS = {
  browse: {},
  genrecategories: {
    categories: ['allGenres', 'back', 'current', 'openBranch', 'subscribe', 'toggleRoots'],
    discovery: DISCLOSURE_METHODS,
    targets: ['current', 'subscribe'],
  },
  genredetail: { genre: ['current', 'subscribe'], media: ['resolve'] },
  genreinstruments: {
    genre: ['current', 'subscribe'],
    recipe: ['addEnsemble', 'addInstrument', 'snapshot', 'subscribe'],
  },
  genretargets: {
    discovery: DISCLOSURE_METHODS,
    targets: [
      'apply',
      'clear',
      'current',
      'match',
      'reset',
      'subscribe',
      'toggleAll',
      'useProfile',
    ],
  },
  instrumentdetail: { instrument: ['current', 'subscribe'], media: ['resolve'] },
  library: { selection: ['state', 'subscribe', 'toggle'] },
  // Data, with no methods.
  librarycredits: { artwork: [], artworkUrls: [], catalog: [] },
  librarymethods: { registry: [] },
  libraryreading: {},
  libraryspeech: { speech: ['getVoices', 'speak', 'subscribeVoices', 'takeAutoplay'] },
  lyrics: {},
};
// What a check may serve in place of a committed file.
const SERVED = {
  store: '/prototype/recipe-store.js',
  load: '/prototype/engine/load.js',
  data: '/prototype/data.js',
  app: '/prototype/app.js',
  host: '/prototype/host.js',
};
// Before any page script: every AbortController the page makes, so a check
// can abort a mount's signal as its host's unmount would.
const KEEP_CONTROLLERS = () => {
  const Real = window.AbortController;
  const made = (window.__controllers = []);
  window.AbortController = class extends Real {
    constructor() {
      super();
      made.push(this);
    }
  };
};
function plantIn(text, edits) {
  let src = text;
  for (const [from, to] of edits) {
    if (src.split(from).length !== 2) return null;
    src = src.replace(from, () => to);
  }
  return src;
}
// The planned recipe and preview views (the §10 table of the step-5
// design): each lane's view has exactly these methods.
const STORE_VIEWS = {
  recipe: ['apply', 'canRedo', 'canUndo', 'redo', 'snapshot', 'subscribe', 'undo'],
  genreinstruments: ['addEnsemble', 'addInstrument', 'snapshot', 'subscribe'],
  instrumentactions: [
    'addConfiguredInstrument',
    'resetInstrumentPreview',
    'setInstrumentDestination',
    'snapshot',
    'subscribe',
  ],
  instrumentsimilar: ['addInstrument', 'snapshot', 'subscribe'],
  instrumentcatalog: ['addInstrument', 'snapshot', 'subscribe'],
};
const PREVIEW_KEYS = {
  configuration: ['choosePart', 'snapshot', 'subscribe'],
  character: ['automatic', 'choose', 'normalize', 'snapshot', 'subscribe'],
  environment: ['choose', 'snapshot', 'subscribe'],
  chain: ['choose', 'snapshot', 'subscribe'],
  output: ['copy', 'setFormat', 'snapshot', 'subscribe'],
};
// Genres whose full row the gate rewrites, the same way for production and
// for the prototype: one with an instrument the catalog doesn't know (a
// partial ensemble) and one with none it knows.
const PARTIAL = 'delta_blues';
const NONE = 'dub';
function rowOverrides() {
  const out = {};
  const boot = readJson('api/browse_boot.json');
  const light = (id) => boot.items.find((t) => t.id === id);
  for (const [id, list] of [
    [PARTIAL, (l) => [...l.instruments.slice(0, -1), 'zz_not_an_instrument']],
    [NONE, () => ['zz_not_an_instrument']],
  ]) {
    const rec = readJson(`api/traditions/${id}.json`);
    rec.source = { ...(rec.source || {}), instruments: list(light(id)) };
    out[`/api/traditions/${id}.json`] = {
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(rec),
    };
  }
  return out;
}

// In every page: the announcements, one by one (announce() clears the
// region first, so each sentence is an added text node).
const SAID = () => {
  window.__said = [];
  const watch = () => {
    const region = document.getElementById('proto-status');
    if (!region) return;
    new MutationObserver((records) => {
      for (const r of records)
        for (const n of r.addedNodes) if (n.textContent) window.__said.push(n.textContent);
    }).observe(region, { childList: true, subtree: true, characterData: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch);
  else watch();
};
// The page-side helpers every check's code starts from.
const STORE_HELPERS = `
  const S = {
    async boot({ start = true } = {}) {
      const app = await import('/prototype/app.js');
      const sel = await import('/prototype/selection.js');
      const load = await import('/prototype/engine/load.js');
      const recipe = app.recipe;
      if (start) await recipe.start();
      const E = start ? await load.loadEngine() : null;
      const R = recipe.port(${JSON.stringify([
        'snapshot',
        'subscribe',
        'apply',
        'undo',
        'redo',
        'canUndo',
        'canRedo',
        'addInstrument',
        'addEnsemble',
        'setInstrumentDestination',
        'addConfiguredInstrument',
        'resetInstrumentPreview',
      ])});
      return { recipe, R, V: recipe.preview, instrument: sel.instrument, E, load };
    },
    said: () => window.__said.splice(0),
    tick: (ms = 0) => new Promise((r) => setTimeout(r, ms)),
    async settle(n = 4) { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); },
    async code(p) { try { await p; return 'ok'; } catch (e) { return (e && e.code) || String(e); } },
    key: (E) => JSON.parse(E.musicalWorkspaceKey(E.app.cards)).map(({ id, ...c }) => (void id, c)),
    acts: (R) => R.snapshot().instrumentActions,
    // An instrument-action command's arguments, from the current snapshot.
    args(R, extra) {
      const s = R.snapshot();
      const a = s.instrumentActions;
      return { instrumentId: a.instrumentId, revision: s.revision, previewRevision: a.previewRevision, ...extra };
    },
    // The preview card as the five views show it.
    project(V) {
      const c = V.configuration.snapshot();
      const ch = V.character.snapshot();
      const env = V.environment.snapshot();
      const chain = V.chain.snapshot();
      return {
        parts: Object.fromEntries(c.parts.map((p) => [p.id, p.value])),
        pinned: c.parts.filter((p) => p.pinned).map((p) => p.id).sort(),
        preface: ch.current,
        auto: ch.automatic,
        tuning: (env.fields.find((f) => f.key === 'tuning') || {}).value ?? null,
        room: (env.fields.find((f) => f.key === 'room') || {}).value ?? null,
        chain: Object.fromEntries(chain.stages.map((s) => [s.stage, s.value])),
      };
    },
    materialOf(E, id, current) {
      const part = E.Inst(id).parts.find((p) => p.variants.some((v) => v.expanded));
      const alt = part.variants.find((v) => v.expanded && v.id !== current[part.id]);
      return [part.id, alt.id];
    },
    svgUrl(html) {
      const m = /<svg[\\s\\S]*?<\\/svg>/.exec(html || '');
      return m ? 'data:image/svg+xml,' + encodeURIComponent(m[0].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')) : null;
    },
  };
`;
// The same card shape from a production card (the five views' projection).
const PROJECT_CARD = `
  const projectCard = (card) => ({
    parts: Object.fromEntries((Inst(card.instrumentId).parts || []).map((p) => [p.id, card.parts[p.id] || null])),
    pinned: (card.pinnedParts || []).slice().sort(),
    preface: card.preface || null,
    auto: card.prefaceAuto !== false,
    tuning: card.tuning || null,
    room: card.room || null,
    chain: Object.fromEntries(CHAIN_SECTIONS.map((s) => [s.id, s.multiSelect ? [...((card.chain || {})[s.id] || [])] : (card.chain || {})[s.id] || null])),
  });
`;
// Runs `body` (an async function's source, given S and its arguments) in the
// page and returns what it returns.
const inPage = (page, body, arg) =>
  page.evaluate(
    `(async () => { ${STORE_HELPERS}; const ARG = ${JSON.stringify(arg === undefined ? null : arg)}; return (${body})(S, ARG); })()`
  );

// A fresh page for one check: the prototype at `hash`, with the store (and
// load.js) served as given, and the check's own routes.
async function storePage(browser, srv, { served = {}, routes = {}, permissions, fail, init } = {}) {
  const { context, page, errors, override, failing } = await newPage(browser, srv, { fail, init });
  await context.addInitScript(SAID);
  for (const [p, r] of Object.entries(rowOverrides())) override.set(p, r);
  if (permissions) await context.grantPermissions(permissions, { origin: srv.url });
  for (const [file, body] of Object.entries(served))
    await context.route(
      (u) => u.pathname === SERVED[file],
      (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body })
    );
  // { path: { delay, status, times } }: a slow or failing answer, for the
  // first `times` requests (every request when times is left out).
  for (const [p, r] of Object.entries(routes)) {
    let n = 0;
    await context.route(
      (u) => u.pathname === p,
      async (route) => {
        n++;
        if (r.times && n > r.times) return route.fallback();
        if (r.delay) await new Promise((res) => setTimeout(res, r.delay));
        if (r.status) return route.fulfill({ status: r.status, body: '' });
        return route.fallback();
      }
    );
  }
  return { context, page, errors, override, failing };
}

// codex.html's own answers for the sequences the checks drive, from its
// globals: one page, booted, then each sequence from an empty recipe with a
// baseline entry. Toasts are read as showToast is given them.
async function storeProduction(browser, srv) {
  const { context, page, errors, override } = await newPage(browser, srv);
  for (const [p, r] of Object.entries(rowOverrides())) override.set(p, r);
  await context.route(
    (u) => u.pathname === '/api/traditions/post_punk.json',
    (route) => route.fulfill({ status: 404, body: '' })
  );
  await page.goto(`${srv.url}/codex.html#instrument`);
  const got = await page.evaluate(`(async () => {
    /* the page's own globals */
    await CATALOG_READY;
    await Engine.ensure();
    await loadNavGlyphArt();
    for (let i = 0; i < 200 && !(typeof UI !== 'undefined' && UI.ready); i++) await new Promise((r) => setTimeout(r, 50));
    ${STORE_HELPERS}
    ${PROJECT_CARD}
    const toasts = [];
    const real = showToast;
    showToast = (msg, ...rest) => { toasts.push(String(msg)); return real(msg, ...rest); };
    const took = () => toasts.splice(0);
    const reset = () => { app.cards = []; app.history = []; app.historyIndex = -1; app._addToTradition = null; pushHistory(); renderAll(); };
    const key = () => S.key({ musicalWorkspaceKey, app });
    const out = {};

    // 3 and 16: the recipe commands and what they say.
    reset();
    took();
    const step = async (name, run) => { await run(); out.toasts[name] = took(); };
    out.toasts = {};
    await step('genre', () => uiAddGenre('bluegrass'));
    await step('grouped', () => uiAddInstrument('oud', { destination: 'bluegrass' }));
    await step('loose', () => uiAddInstrument('udu', { destination: '' }));
    await step('created', () => uiAddInstrument('banjo_5_string', { destination: 'afrobeat' }));
    out.parity = { key: key(), length: app.history.length, index: app.historyIndex };
    await step('partial', () => uiAddGenre(${JSON.stringify(PARTIAL)}));
    await step('none', () => uiAddGenre(${JSON.stringify(NONE)}));
    UI.busy = true;
    await step('busyGenre', () => uiAddGenre('gagaku'));
    UI.busy = false;
    out.failedGenre = { name: Inst('udu').name, genre: Tradition('post_punk').name };
    await step('failed', () => uiAddInstrument('udu', { destination: 'post_punk' }));
    // The configured add, from the inspector, with and without changes.
    uiInspectInstrument('oud');
    await S.settle(8);
    ipSyncDestination();
    $ui('instrument-destination').value = 'bluegrass';
    await ipRebuild();
    ipChoose({ k: 'room', v: ROOMS[3].id });
    await step('configured', () => ipAddConfigured());
    IP.edits.set('oud', []);
    await ipRebuild();
    await step('defaults', () => ipAddConfigured());
    UI.busy = true;
    await step('busyAdd', () => ipAddConfigured());
    UI.busy = false;
    $ui('instrument-destination').value = '';
    await ipRebuild();

    // 11, 12, 15: the inspector's card for Oud with no destination.
    const fresh = (id, opts) => {
      IP.edits.set(id, []);
      IP.card = makeCard(id, opts);
      IP.base = makeCard(id, opts);
      UI.instrumentPreview = id;
    };
    const partsOf = (id) => Inst(id).parts.map((p) => ({
      id: p.id,
      name: p.name || ipHuman(p.id),
      variants: p.variants.map((v) => ({ id: v.id, name: v.name, descriptors: entryRenderDescs(v), expanded: v.expanded || false, alias_of: v.alias_of || null })),
    }));
    out.parts = { oud: partsOf('oud'), banjo_5_string: partsOf('banjo_5_string') };
    fresh('oud');
    const [mp, mv] = S.materialOf({ Inst }, 'oud', IP.card.parts);
    out.material = { part: mp, variant: mv };
    ipChoose({ k: 'part', part: mp, v: mv });
    out.choosePart = { card: projectCard(IP.card), note: IP.note || null, changed: ipDiff(IP.base, IP.card).length };
    // Then, on a fresh banjo, a choice that moves something else, so the
    // note says what.
    fresh('banjo_5_string');
    const moving = () => {
      for (const part of Inst('banjo_5_string').parts)
        for (const v of part.variants.slice(0, 120)) {
          if (v.id === IP.card.parts[part.id]) continue;
          const c = JSON.parse(JSON.stringify(IP.card));
          const before = JSON.parse(JSON.stringify(c));
          ipApply(c, { k: 'part', part: part.id, v: v.id });
          if (ipDiff(before, c).some((x) => x.key !== 'part:' + part.id)) return { part: part.id, variant: v.id };
        }
      return null;
    };
    out.moving = moving();
    if (out.moving) ipChoose({ k: 'part', part: out.moving.part, v: out.moving.variant });
    out.chooseMoving = { card: projectCard(IP.card), note: IP.note || null };
    fresh('oud');
    out.character0 = { current: IP.card.preface || null, automatic: IP.card.prefaceAuto !== false, suggestion: (() => { const s = suggestPrefaceForCard(IP.card); return s && s !== IP.card.preface ? s : null; })() };
    ipChoose({ k: 'preface', id: 'sermonizing' });
    out.choosePreface = { card: projectCard(IP.card), note: IP.note || null };
    ipChoose({ k: 'auto' });
    out.chooseAuto = { card: projectCard(IP.card), note: IP.note || null };
    out.categories = PREFACE_CAT_ORDER.map((cat) => ({
      id: cat,
      glyph: S.svgUrl(prefaceCatGlyphHTML(cat, 16)),
      prefaces: (prefaceGroups()[cat] || []).map((e) => ({ id: e.id, note: e.note || null, entry: S.svgUrl(prefaceGlyphsHTML(e, 15, true)) })),
    }));
    out.tunings = TUNINGS.map((t) => ({ id: t.id, name: t.name }));
    out.rooms = ROOMS.map((r) => ({ id: r.id, name: r.name }));
    out.tuningDescs = entryRenderDescs(Tuning(TUNINGS[5].id));
    out.stages = CHAIN_SECTIONS.map((s) => ({ stage: s.id, multi: !!s.multiSelect, options: s.items.map((i) => ({ id: i.id, name: i.name })) }));
    // 15: a configured card's single-card render.
    const conf = makeCard('oud', traditionCardOpts('bluegrass', 'oud'));
    ipApply(conf, { k: 'part', part: mp, v: mv });
    out.output = Object.fromEntries(RECIPE_FORMATS.map(([f]) => [f, compileStack(conf, f)]));

    // 13: the environment sentence, by the gate's own rule over this
    // page's render: where the card would land (after its genre's run, as
    // addInstrumentFromPicker places it), which card the recipe's
    // environment would come from, and whether Compact writes it.
    const who = (c) => uiCardWho(c);
    const place = (recipe, copy) => {
      const saved = app.cards;
      try {
        app.cards = [...recipe, copy];
        if (copy.traditionId) _placeCardAfterTraditionRun(copy, copy.traditionId);
        return app.cards;
      } finally {
        app.cards = saved;
      }
    };
    // The render with the environment items' names marked (sentence).
    const MARK = '\\u2400';
    const marked = (after, src, ceiling) => {
      const chain = src.chain || {};
      const items = [
        ...new Set(
          [
            src.tuning && Tuning(src.tuning),
            src.room && Room(src.room),
            ...CHAIN_SECTIONS.flatMap((sec) =>
              [].concat(chain[sec.id] || []).map((id) => ChainItem(sec.id, id))
            ),
          ].filter(Boolean)
        ),
      ];
      const names = items.map((it) => it.name);
      try {
        items.forEach((it) => { it.name = MARK.repeat(it.name.length); });
        return compileRecipeStack(after, 'compact', { ceiling });
      } finally {
        items.forEach((it, i) => { it.name = names[i]; });
      }
    };
    const sentence = (after, copy, format, ceiling) => {
      const src = envCardOf(after);
      if (!src || !hasEnvironment(src)) return 'Your recipe has no environment yet, and neither does this instrument.';
      const lead = src === copy
        ? 'Added now, this instrument would set your recipe’s environment: its tuning, room and chain are the ones the recipe renders.'
        : 'Your recipe renders one environment, from ' + who(src) + ' (' + (src.traditionId ? Tradition(src.traditionId).name : 'independent') + '). This instrument’s tuning, room and chain are kept on its card, but render only if it becomes that source.';
      if (format !== 'compact') return lead;
      // Whether Compact writes the environment, read from a signal the
      // render's shape can't counterfeit (#810, the review of 6682309672's
      // fixes): the same render with the name of each environment item (the
      // source card's tuning, room and chain items) swapped for a run of a
      // mark no catalog name uses, each run as long as the name it stands
      // for. compressCompactRecipe cuts by length alone, so the swapped
      // render makes the same cut, and the environment is written exactly
      // when the mark is in it. A swapped render of another length, or the
      // mark already in the render, would make this rule wrong, and the
      // sentence says so instead.
      const text = compileRecipeStack(after, 'compact', { ceiling });
      const swapped = marked(after, src, ceiling);
      if (swapped.length !== text.length || text.includes(MARK))
        return 'gate: the swapped render can’t say whether Compact writes the environment: ' + JSON.stringify([text, swapped]);
      const written = swapped.includes(MARK);
      return written
        ? lead + ' In Compact it is written once, after the instruments.'
        : lead + ' In Compact the environment line is dropped to fit the ' + ceiling + '-character limit.';
    };
    const room = ROOMS[3].id;
    await Catalog.ensureFull('whale_song');
    await Catalog.ensureFull('brasilia_indie');
    const edited = (p) => { p.room = room; p.tuning = TUNINGS[5].id; return p; };
    const cases = {
      empty: () => ({ recipe: [], preview: makeCard('oud') }),
      genre: () => { app.cards = []; importTradition('bluegrass'); return { recipe: app.cards.slice(), preview: makeCard('oud') }; },
      banjo: () => { const p = makeCard('oud'); p.room = room; return { recipe: [makeCard('banjo_5_string')], preview: p }; },
      alone: () => { const p = makeCard('oud'); p.room = room; return { recipe: [], preview: p }; },
      // One card alone whose environment line can't fit at 150 or 100 (its
      // room, its tuning and one item on every chain stage): the single-card
      // render without it, one line ("<preface> oud,").
      aloneLong: () => { const p = edited(makeCard('oud')); for (const sec of CHAIN_SECTIONS) p.chain[sec.id] = sec.multiSelect ? [sec.items[0].id] : sec.items[0].id; return { recipe: [], preview: p }; },
      // The same card, its instrument named with a " · " of its own: at 150
      // and 100 its render is still one line with a " · " in it, and no
      // environment.
      aloneNamed: () => ({ ...cases.aloneLong(), dotted: true }),
      // Whale song's cards have no environment and a loose banjo with a
      // room follows them; the preview, grouped to whale song, lands before
      // the banjo, so it would set the environment.
      grouped: () => {
        app.cards = [];
        importTradition('whale_song');
        const banjo = makeCard('banjo_5_string');
        banjo.room = room;
        return { recipe: [...app.cards, banjo], preview: edited(makeCard('oud', traditionCardOpts('whale_song', 'oud') || undefined)) };
      },
      // Brasília indie's five cards and the loose preview: cut at 150.
      truncating: () => { app.cards = []; importTradition('brasilia_indie'); return { recipe: app.cards.slice(), preview: edited(makeCard('oud')) }; },
      // An environment label inside a card's own line (#810 6682309672, D4):
      // the environment card's room renamed as its own instrument is, so the
      // label is in the render whether or not the environment line is. The
      // truncating cards, cut at 150 and 100; then their first card alone
      // with the preview, whose instrument lines fit where the environment
      // line doesn't.
      named: () => ({ ...cases.truncating(), rename: true }),
      namedShort: () => { const c = cases.truncating(); return { recipe: c.recipe.slice(0, 1), preview: c.preview, rename: true }; },
    };
    // The renamed room, only while a case's sentence is read.
    const renamed = (after, read) => {
      const src = envCardOf(after);
      const r = Room(src.room);
      const was = r.name;
      r.name = Inst(src.instrumentId).short || Inst(src.instrumentId).name;
      try { return read(); } finally { r.name = was; }
    };
    // The instrument named with a " · " of its own, only while a case is
    // read.
    const dotted = (id, read) => {
      const inst = Inst(id);
      const had = Object.prototype.hasOwnProperty.call(inst, 'short');
      const was = inst.short;
      inst.short = (inst.short || inst.name) + ' · lute';
      try { return read(); } finally { if (had) inst.short = was; else delete inst.short; }
    };
    out.sources = {};
    out.dottedRenders = {};
    for (const [name, make] of Object.entries(cases)) {
      out.sources[name] = {};
      for (const ceiling of [1000, 150, 100])
        for (const [f] of RECIPE_FORMATS) {
          const { recipe, preview, rename, dotted: dot } = make();
          const copy = { ...preview, id: '__preview__' };
          const after = place(recipe, copy);
          const read = () => sentence(after, copy, f, ceiling);
          const named = rename ? () => renamed(after, read) : read;
          out.sources[name][ceiling + ':' + f] = dot ? dotted(copy.instrumentId, named) : named();
          if (dot && f === 'compact')
            out.dottedRenders[ceiling] = dotted(copy.instrumentId, () => compileRecipeStack(after, 'compact', { ceiling }));
        }
    }
    out.room = room;

    // 21: the editor's part click on a recipe card (handleCardClick).
    reset();
    importTradition('bluegrass');
    const banjo = app.cards.find((c) => c.instrumentId === 'banjo_5_string');
    const [bp, bv] = S.materialOf({ Inst }, 'banjo_5_string', banjo.parts);
    banjo.parts[bp] = bv;
    if (applyPartEdit(banjo, bp)) pushHistory();
    out.setVariant = { part: bp, variant: bv, card: projectCard(banjo) };

    // 22: the hand-over sentence, read after each step (the page's own
    // deferred read is held off while the sequence runs).
    UI.envPending = true;
    reset();
    UI.envSource = null;
    uiEnvHandoverText();
    const said = [];
    const read = (name) => said.push([name, uiEnvHandoverText()]);
    await Catalog.ensureFull('afrobeat');
    importTradition('afrobeat');
    read('afrobeat');
    importTradition('bluegrass');
    read('bluegrass');
    rmCard(envCardOf(app.cards).id);
    read('remove source');
    for (const c of app.cards.filter((c) => c.traditionId === 'afrobeat')) rmCard(c.id, { skipHistory: true });
    pushHistory();
    read('remove afrobeat');
    for (const c of app.cards.filter((c) => c.traditionId === 'bluegrass')) rmCard(c.id, { skipHistory: true });
    pushHistory();
    read('remove bluegrass');
    addCard('banjo_5_string');
    read('loose banjo');
    importTradition('bluegrass');
    read('bluegrass again');
    undo();
    read('undo');
    redo();
    read('redo');
    UI.envPending = false;
    out.handover = said;

    // The genre page's roster (gpInstruments): the light row's instruments,
    // in order, named by InstLite, with image()'s glyph.
    const xmlns = (svg) => (svg ? 'data:image/svg+xml,' + encodeURIComponent(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')) : null);
    out.rosters = {};
    for (const id of ['bluegrass', 'afrobeat', 'gagaku', 'qawwali', 'acousmatic']) {
      const live = Catalog.resolve(id);
      const t = Tradition(live);
      out.rosters[id] = { id: live, name: t.name, instruments: (t.instruments || []).map((i) => ({ id: i, name: InstLite(i)?.name || i, glyphUrl: xmlns(image(i, 32)), listenHref: null })) };
    }
    return out;
  })()`);
  await context.close();
  return { got, errors };
}

// A clipboard the gate decides, the same in production's page and the
// store's: 'resolve' is a write the browser takes; 'reject' is a write the
// browser refuses, as one without the permission does; 'throw' is a
// clipboard that throws at once; 'none' is a page with no clipboard API. The
// last three send a copy to the execCommand fallback, whatever this browser
// does with a permission (#810 6682309672: a click's activation alone lets
// Chromium 141 write after clearPermissions()), and 'resolve' takes the
// write whatever the browser would (one that refuses even a granted write
// would send it to the fallback too, and hide a success said as a failure).
// window.__copiedText is what each copy put on the clipboard: the text given
// to writeText, or the selection execCommand('copy') copied.
function stubClipboard(mode) {
  window.__copiedText = [];
  if (!window.__execWrapped) {
    window.__execWrapped = true;
    const real = document.execCommand.bind(document);
    document.execCommand = (cmd, ...rest) => {
      if (cmd === 'copy') {
        const a = document.activeElement;
        window.__copiedText.push(
          a && typeof a.value === 'string'
            ? a.value.slice(a.selectionStart, a.selectionEnd)
            : String(window.getSelection())
        );
      }
      return real(cmd, ...rest);
    };
  }
  const value =
    mode === 'none'
      ? undefined
      : {
          writeText:
            mode === 'resolve'
              ? (t) => {
                  window.__copiedText.push(String(t));
                  return Promise.resolve();
                }
              : mode === 'reject'
                ? () => Promise.reject(new DOMException('gate: not allowed', 'NotAllowedError'))
                : () => {
                    throw new Error('gate: no clipboard');
                  },
        };
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value });
}

// copyToClipboard on codex.html, from a click, with the clipboard granted
// and, given `clipboard`, stubbed as stubClipboard has it: what production
// says for the same browser. A copyToClipboard that throws (it doesn't catch
// a writeText that throws at once) says nothing; that is `threw`.
async function productionCopy(browser, srv, { clipboard } = {}) {
  const { context, page } = await newPage(browser, srv);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: srv.url });
  await page.goto(`${srv.url}/codex.html#instrument`);
  await page.evaluate(`(async () => {
    await CATALOG_READY;
    window.__toasts = [];
    window.__threw = null;
    const real = showToast;
    showToast = (m, ...r) => { window.__toasts.push(String(m)); return real(m, ...r); };
    const b = document.createElement('button');
    b.id = 'gate-copy';
    b.textContent = 'copy';
    b.addEventListener('click', () => {
      try {
        copyToClipboard('gate text', 'Copied', 'Copy failed — select the text instead');
      } catch (e) {
        window.__threw = String((e && e.message) || e);
      }
    });
    document.body.prepend(b);
  })()`);
  if (clipboard) await page.evaluate(stubClipboard, clipboard);
  await page.click('#gate-copy');
  await page.waitForFunction(() => window.__toasts.length > 0 || window.__threw !== null, null, {
    timeout: 5000,
  });
  await page.waitForTimeout(50);
  const out = await page.evaluate(() => ({
    toasts: window.__toasts,
    threw: window.__threw,
    copied: window.__copiedText || null,
  }));
  await context.close();
  return out;
}

// The checks. Each runs in a page of its own (`opts` set it up), returns
// what it saw, and its verdict compares that with the rule and, where
// production has an answer, with storeProduction's. A verdict is true, or
// the reason it failed.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The sentence production's Copy said last (productionCopy).
const copySaid = (r) => r.toasts[r.toasts.length - 1];
const why = (ok, detail) => (ok ? true : detail);
const STORE_CHECKS = {
  // 1. The baseline: nothing to undo on an empty recipe; one add, then Undo,
  // gives the empty recipe back.
  baseline: {
    page: async (S) => {
      const { R } = await S.boot();
      const before = R.canUndo();
      await S.code(
        R.addInstrument({ instrumentId: 'udu', destination: null, revision: R.snapshot().revision })
      );
      const afterAdd = R.canUndo();
      const undo = R.undo();
      return { before, afterAdd, undo, cards: R.snapshot().cards.length, canUndo: R.canUndo() };
    },
    verdict: (g) =>
      why(
        g.before === false &&
          g.afterAdd === true &&
          same(g.undo, { ok: true, changed: true }) &&
          g.cards === 0 &&
          g.canUndo === false,
        JSON.stringify(g)
      ),
  },
  // 2. One history entry for each command and each apply op.
  entries: {
    page: async (S) => {
      const { R, E, instrument } = await S.boot();
      const n = () => E.app.history.length;
      const out = {};
      const rev = () => R.snapshot().revision;
      let at = n();
      const mark = (name) => {
        out[name] = n() - at;
        at = n();
      };
      await R.addEnsemble({ genreId: 'bluegrass', revision: rev() });
      mark('addEnsemble');
      await R.addInstrument({ instrumentId: 'oud', destination: 'bluegrass', revision: rev() });
      mark('addInstrument');
      instrument.set('udu');
      await S.settle();
      await S.code(R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' })));
      mark('setInstrumentDestination');
      await R.addConfiguredInstrument(S.args(R, { destination: 'bluegrass' }));
      mark('addConfiguredInstrument');
      const card = (id) => E.app.cards.find((c) => c.instrumentId === id);
      const banjo = card('banjo_5_string');
      const [p, v] = S.materialOf(E, 'banjo_5_string', banjo.parts);
      out.receipts = [];
      const op = (name, edit) => {
        out.receipts.push([name, R.apply(edit)]);
        mark(name);
      };
      op('set_variant', { op: 'set_variant', card: banjo.id, part: p, variant: v });
      op('set_preface', { op: 'set_preface', card: banjo.id, preface: 'bitter' });
      op('set_preface auto', { op: 'set_preface', card: banjo.id, preface: null });
      op('set_environment', { op: 'set_environment', room: E.ROOMS[7].id });
      op('remove_instrument', { op: 'remove_instrument', card: card('oud').id });
      op('remove_tradition', { op: 'remove_tradition', tradition: 'bluegrass' });
      return out;
    },
    verdict: (g) => {
      const counts = Object.entries(g).filter(([k]) => k !== 'receipts');
      return why(
        counts.every(([k, d]) => d === (k === 'setInstrumentDestination' ? 0 : 1)) &&
          g.receipts.every(([, r]) => r.ok === true && r.changed === true),
        JSON.stringify(g)
      );
    },
  },
  // 3. The recipe the store builds equals production's for the same adds.
  parity: {
    page: async (S) => {
      const { R, E } = await S.boot();
      const rev = () => R.snapshot().revision;
      const placed = [];
      await R.addEnsemble({ genreId: 'bluegrass', revision: rev() });
      for (const [id, d] of [
        ['oud', 'bluegrass'],
        ['udu', null],
        ['banjo_5_string', 'afrobeat'],
      ])
        placed.push(
          (await R.addInstrument({ instrumentId: id, destination: d, revision: rev() })).placed
        );
      return { key: S.key(E), length: E.app.history.length, index: E.app.historyIndex, placed };
    },
    verdict: (g, p) =>
      why(
        same(g.key, p.parity.key) &&
          g.length === p.parity.length &&
          g.index === p.parity.index &&
          same(g.placed, ['grouped', 'independent', 'grouped']),
        `the store's recipe ${JSON.stringify(g).slice(0, 300)} vs codex.html's ${JSON.stringify(p.parity).slice(0, 300)}`
      ),
  },
  // 4. A command against an old revision is STALE, and changes nothing.
  staleRevision: {
    page: async (S) => {
      const { R, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      const s0 = R.snapshot();
      const h0 = JSON.stringify(E.app.history);
      const old = s0.revision - 1;
      const a = s0.instrumentActions;
      const pa = {
        instrumentId: a.instrumentId,
        previewRevision: a.previewRevision,
        revision: old,
      };
      const out = {
        addInstrument: await S.code(
          R.addInstrument({ instrumentId: 'udu', destination: null, revision: old })
        ),
        addEnsemble: await S.code(R.addEnsemble({ genreId: 'afrobeat', revision: old })),
        setInstrumentDestination: await S.code(
          R.setInstrumentDestination({ ...pa, destination: 'bluegrass' })
        ),
        addConfiguredInstrument: await S.code(
          R.addConfiguredInstrument({ ...pa, destination: null })
        ),
        resetInstrumentPreview: await S.code(R.resetInstrumentPreview(pa)),
        apply: R.apply({ op: 'set_environment', room: E.ROOMS[7].id, revision: old }).code,
      };
      out.sameSnapshot = R.snapshot() === s0;
      out.sameHistory = JSON.stringify(E.app.history) === h0;
      // Undo and Redo move the revision too: a command made against the
      // revision before either is STALE.
      const beforeUndo = R.snapshot().revision;
      out.undone = R.undo().ok;
      out.afterUndo = await S.code(
        R.addInstrument({ instrumentId: 'udu', destination: null, revision: beforeUndo })
      );
      const beforeRedo = R.snapshot().revision;
      out.redone = R.redo().ok;
      out.afterRedo = R.apply({
        op: 'set_environment',
        room: E.ROOMS[7].id,
        revision: beforeRedo,
      }).code;
      return out;
    },
    verdict: (g) =>
      why(
        [
          'addInstrument',
          'addEnsemble',
          'setInstrumentDestination',
          'addConfiguredInstrument',
          'resetInstrumentPreview',
          'apply',
          'afterUndo',
          'afterRedo',
        ].every((k) => g[k] === 'STALE') &&
          g.undone === true &&
          g.redone === true &&
          g.sameSnapshot &&
          g.sameHistory,
        JSON.stringify(g)
      ),
  },
  // 5. Safeguard 1: an old previewRevision or another instrument is STALE;
  // so is each preview view's action against an old revision, and a part's
  // variant it doesn't have is INVALID.
  stalePreview: {
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      const h0 = E.app.history.length;
      const out = {};
      for (const [name, extra] of [
        ['setInstrumentDestination', { destination: 'bluegrass' }],
        ['addConfiguredInstrument', { destination: null }],
        ['resetInstrumentPreview', {}],
      ]) {
        const base = S.args(R, extra);
        out[name] = [
          await S.code(R[name]({ ...base, previewRevision: base.previewRevision - 1 })),
          await S.code(R[name]({ ...base, instrumentId: 'banjo_5_string' })),
        ];
      }
      out.history = E.app.history.length - h0;
      // Each preview view's action, against the revision before the one it
      // shows: STALE, and the preview doesn't move.
      const before = JSON.stringify(S.project(V));
      const old = (v) => V[v].snapshot().revision - 1;
      const conf = V.configuration.snapshot();
      const part = conf.parts.find((x) => x.variants.some((w) => w.id !== x.value));
      const other = part.variants.find((w) => w.id !== part.value).id;
      const fx = E.CHAIN_SECTIONS[0].items[2].id;
      out.views = [
        await S.code(
          V.configuration.choosePart({
            partId: part.id,
            variantId: other,
            revision: old('configuration'),
          })
        ),
        await S.code(V.character.choose({ prefaceId: 'sermonizing', revision: old('character') })),
        await S.code(V.character.automatic({ revision: old('character') })),
        await S.code(
          V.environment.choose({ field: 'room', id: E.ROOMS[9].id, revision: old('environment') })
        ),
        await S.code(V.chain.choose({ stage: 'fx', id: fx, on: true, revision: old('chain') })),
      ];
      out.unmoved = JSON.stringify(S.project(V)) === before;
      // A real part with a variant it doesn't have.
      out.unknownVariant = await S.code(
        V.configuration.choosePart({
          partId: part.id,
          variantId: 'zz_not_a_variant',
          revision: V.configuration.snapshot().revision,
        })
      );
      out.stillUnmoved = JSON.stringify(S.project(V)) === before;
      return out;
    },
    verdict: (g) =>
      why(
        ['setInstrumentDestination', 'addConfiguredInstrument', 'resetInstrumentPreview'].every(
          (k) => same(g[k], ['STALE', 'STALE'])
        ) &&
          g.history === 0 &&
          same(g.views, ['STALE', 'STALE', 'STALE', 'STALE', 'STALE']) &&
          g.unmoved &&
          g.unknownVariant === 'INVALID' &&
          g.stillUnmoved,
        JSON.stringify(g)
      ),
  },
  // 6. While a recipe edit waits on a genre's row, everything is BUSY and
  // Undo and Redo are unavailable.
  busyEdit: {
    opts: { routes: { '/api/traditions/afrobeat.json': { delay: 1500 } } },
    page: async (S) => {
      const { R, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      const canUndo0 = R.canUndo();
      const running = R.addEnsemble({ genreId: 'afrobeat', revision: R.snapshot().revision });
      await S.tick(200);
      const s = R.snapshot();
      const pa = S.args(R);
      const out = {
        busy: s.busy,
        canUndo0,
        canUndo: R.canUndo(),
        canRedo: R.canRedo(),
        addInstrument: await S.code(
          R.addInstrument({ instrumentId: 'udu', destination: null, revision: s.revision })
        ),
        addEnsemble: await S.code(R.addEnsemble({ genreId: 'gagaku', revision: s.revision })),
        setInstrumentDestination: await S.code(
          R.setInstrumentDestination({ ...pa, destination: 'bluegrass' })
        ),
        addConfiguredInstrument: await S.code(
          R.addConfiguredInstrument({ ...pa, destination: null })
        ),
        resetInstrumentPreview: await S.code(R.resetInstrumentPreview(pa)),
        apply: R.apply({ op: 'set_environment', room: E.ROOMS[7].id }).code,
        undo: R.undo().code,
      };
      out.done = await S.code(running);
      out.after = R.snapshot().busy;
      return out;
    },
    verdict: (g) =>
      why(
        g.busy === true &&
          g.canUndo0 === true &&
          g.canUndo === false &&
          g.canRedo === false &&
          [
            'addInstrument',
            'addEnsemble',
            'setInstrumentDestination',
            'addConfiguredInstrument',
            'resetInstrumentPreview',
            'apply',
            'undo',
          ].every((k) => g[k] === 'BUSY') &&
          g.done === 'ok' &&
          g.after === false,
        JSON.stringify(g)
      ),
  },
  // 7. Safeguard 2 as resolved: while the preview rebuilds, the three
  // instrument-action commands are BUSY, so is each preview view's action,
  // and plain Add still adds.
  busyPreview: {
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      const oud = E.Inst('oud').parts[0];
      void S.code(R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' })));
      // Before anything is awaited: the rebuild is running.
      const s = R.snapshot();
      const pa = S.args(R);
      const now = (v) => V[v].snapshot().revision;
      const viewCode = async (run) => {
        try {
          return await S.code(run());
        } catch (e) {
          return 'threw: ' + ((e && e.message) || e);
        }
      };
      // Every call starts before anything is awaited.
      const viewCalls = [
        () =>
          V.configuration.choosePart({
            partId: oud.id,
            variantId: oud.variants[1].id,
            revision: now('configuration'),
          }),
        () => V.character.choose({ prefaceId: 'sermonizing', revision: now('character') }),
        () => V.character.automatic({ revision: now('character') }),
        () =>
          V.environment.choose({ field: 'room', id: E.ROOMS[9].id, revision: now('environment') }),
        () =>
          V.chain.choose({
            stage: 'fx',
            id: E.CHAIN_SECTIONS[0].items[2].id,
            on: true,
            revision: now('chain'),
          }),
      ].map(viewCode);
      const loading = V.configuration.snapshot().status;
      const calls = {
        setInstrumentDestination: R.setInstrumentDestination({ ...pa, destination: null }),
        addConfiguredInstrument: R.addConfiguredInstrument({ ...pa, destination: 'bluegrass' }),
        resetInstrumentPreview: R.resetInstrumentPreview(pa),
        addInstrument: R.addInstrument({
          instrumentId: 'udu',
          destination: null,
          revision: s.revision,
        }),
      };
      const out = { status: s.instrumentActions.status, loading };
      out.views = await Promise.all(viewCalls);
      for (const [k, p] of Object.entries(calls)) out[k] = await S.code(p);
      out.cards = R.snapshot()
        .cards.map((c) => c.instrumentId)
        .filter((i) => i === 'udu').length;
      return out;
    },
    verdict: (g) =>
      why(
        g.status === 'loading' &&
          g.loading === 'loading' &&
          same(g.views, ['BUSY', 'BUSY', 'BUSY', 'BUSY', 'BUSY']) &&
          g.setInstrumentDestination === 'BUSY' &&
          g.addConfiguredInstrument === 'BUSY' &&
          g.resetInstrumentPreview === 'BUSY' &&
          g.addInstrument === 'ok' &&
          g.cards === 1,
        JSON.stringify(g)
      ),
  },
  // 8. Safeguard 3: setInstrumentDestination and resetInstrumentPreview move
  // previewRevision and say 'loading' before anything is awaited, so an Add
  // against the old preview is STALE.
  safeguard3: {
    page: async (S) => {
      const { R, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      const out = {};
      for (const [name, extra] of [
        ['setInstrumentDestination', { destination: 'bluegrass' }],
        ['resetInstrumentPreview', {}],
      ]) {
        const old = S.args(R);
        const p = R[name]({ ...old, ...extra });
        const a = S.acts(R);
        const add = R.addConfiguredInstrument({ ...old, destination: a.destination });
        out[name] = {
          status: a.status,
          moved: a.previewRevision !== old.previewRevision,
          add: await S.code(add),
          done: await S.code(p),
        };
      }
      return out;
    },
    verdict: (g) =>
      why(
        ['setInstrumentDestination', 'resetInstrumentPreview'].every(
          (k) =>
            g[k].status === 'loading' && g[k].moved && g[k].add === 'STALE' && g[k].done === 'ok'
        ),
        JSON.stringify(g)
      ),
  },
  // 9. Safeguard 4 and the planted race: the configured add is the preview
  // as it was at the call (its parts, pins, character and its automatic
  // flag, tuning, room and chain), whatever is chosen while the add waits.
  capture: {
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      await V.environment.choose({
        field: 'room',
        id: E.ROOMS[9].id,
        revision: V.environment.snapshot().revision,
      });
      await V.chain.choose({
        stage: 'fx',
        id: E.CHAIN_SECTIONS[0].items[2].id,
        on: true,
        revision: V.chain.snapshot().revision,
      });
      // A chosen character, then a part choice that pins (not the material
      // part the race below moves).
      await V.character.choose({
        prefaceId: 'sermonizing',
        revision: V.character.snapshot().revision,
      });
      const c0 = V.configuration.snapshot();
      const [mp] = S.materialOf(E, 'oud', Object.fromEntries(c0.parts.map((x) => [x.id, x.value])));
      const pin = c0.parts.find((x) => x.id !== mp && x.variants.some((w) => w.id !== x.value));
      await V.configuration.choosePart({
        partId: pin.id,
        variantId: pin.variants.find((w) => w.id !== pin.value).id,
        revision: c0.revision,
      });
      const captured = S.project(V);
      const h0 = E.app.history.length;
      const adding = R.addConfiguredInstrument(S.args(R, { destination: 'bluegrass' }));
      // While it waits: a choice on the preview.
      const conf = V.configuration.snapshot();
      const [p, v] = S.materialOf(
        E,
        'oud',
        Object.fromEntries(conf.parts.map((x) => [x.id, x.value]))
      );
      const raced = await S.code(
        V.configuration.choosePart({ partId: p, variantId: v, revision: conf.revision })
      );
      const receipt = await adding;
      const entries = E.app.history.length - h0;
      const addedId = E.app.cards.find((c) => c.instrumentId === 'oud').id;
      const added = () => E.app.cards.find((c) => c.id === addedId);
      const proj = (c) => ({
        parts: Object.fromEntries(
          E.Inst(c.instrumentId).parts.map((x) => [x.id, c.parts[x.id] || null])
        ),
        pinned: (c.pinnedParts || []).slice().sort(),
        preface: c.preface || null,
        auto: c.prefaceAuto !== false,
        tuning: c.tuning || null,
        room: c.room || null,
        chain: Object.fromEntries(
          E.CHAIN_SECTIONS.map((s) => [
            s.id,
            s.multiSelect ? [...(c.chain[s.id] || [])] : c.chain[s.id] || null,
          ])
        ),
      });
      const got = proj(added());
      // A later chain choice on the preview leaves the added card alone.
      await V.chain.choose({
        stage: 'fx',
        id: E.CHAIN_SECTIONS[0].items[3].id,
        on: true,
        revision: V.chain.snapshot().revision,
      });
      const later = proj(added());
      await R.setInstrumentDestination(S.args(R, { destination: null }));
      await S.settle();
      const loose = await R.addConfiguredInstrument(S.args(R, { destination: null }));
      // Undo past both configured adds, then Redo the grouped one: it comes
      // back as captured, because it was configured before its history entry.
      R.undo();
      R.undo();
      const undone = !added();
      R.redo();
      const redone = added() ? proj(added()) : null;
      return {
        undone,
        redone,
        raced,
        pin: pin.id,
        captured,
        got,
        later,
        entries,
        placed: receipt.placed,
        loosePlaced: loose.placed,
        differs: JSON.stringify(captured) !== JSON.stringify(S.project(V)),
      };
    },
    verdict: (g) =>
      why(
        g.raced === 'ok' &&
          g.differs &&
          g.captured.pinned.includes(g.pin) &&
          g.captured.preface === 'sermonizing' &&
          g.captured.auto === false &&
          same(g.got, g.captured) &&
          same(g.later, g.captured) &&
          g.undone &&
          same(g.redone, g.captured) &&
          g.entries === 1 &&
          g.placed === 'grouped' &&
          g.loosePlaced === 'independent',
        JSON.stringify(g).slice(0, 900)
      ),
  },
  // 10. The baseline and the card never share a chain: a chain choice on a
  // preview seeded from a genre counts as a change.
  aliasing: {
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      const before = S.acts(R).changedCount;
      await V.chain.choose({
        stage: 'fx',
        id: E.CHAIN_SECTIONS[0].items[0].id,
        on: true,
        revision: V.chain.snapshot().revision,
      });
      const fx = S.acts(R).changedCount;
      const mic = E.CHAIN_SECTIONS.find((s) => s.id === 'mic');
      await V.chain.choose({
        stage: 'mic',
        id: mic.items[5].id,
        revision: V.chain.snapshot().revision,
      });
      return { before, fx, mic: S.acts(R).changedCount, canReset: S.acts(R).canReset };
    },
    verdict: (g) =>
      why(g.before === 0 && g.fx === 1 && g.mic === 2 && g.canReset === true, JSON.stringify(g)),
  },
  // 11. configuration: the parts and variants as production lists them, and
  // a material choice that leaves the card, and the note, as ipChoose does.
  configuration: {
    page: async (S, ARG) => {
      const { V, instrument } = await S.boot();
      const lists = {};
      for (const id of ['banjo_5_string', 'oud']) {
        instrument.set(id);
        await S.settle();
        lists[id] = V.configuration
          .snapshot()
          .parts.map(({ id: pid, name, variants }) => ({ id: pid, name, variants }));
      }
      const r = V.configuration.snapshot().revision;
      await V.configuration.choosePart({ partId: ARG.part, variantId: ARG.variant, revision: r });
      const first = { card: S.project(V), note: V.configuration.snapshot().note };
      instrument.set('banjo_5_string');
      await S.settle();
      if (ARG.moving)
        await V.configuration.choosePart({
          partId: ARG.moving.part,
          variantId: ARG.moving.variant,
          revision: V.configuration.snapshot().revision,
        });
      return {
        lists,
        ...first,
        moving: { card: S.project(V), note: V.configuration.snapshot().note },
      };
    },
    arg: (p) => ({ ...p.material, moving: p.moving }),
    verdict: (g, p) =>
      why(
        same(g.lists.oud, p.parts.oud) &&
          same(g.lists.banjo_5_string, p.parts.banjo_5_string) &&
          same(g.card, p.choosePart.card) &&
          g.note === p.choosePart.note &&
          !!p.moving &&
          same(g.moving, p.chooseMoving) &&
          !!g.moving.note,
        `parts equal: ${same(g.lists.oud, p.parts.oud)}/${same(g.lists.banjo_5_string, p.parts.banjo_5_string)}; card ${JSON.stringify(g.card).slice(0, 200)} vs ${JSON.stringify(p.choosePart.card).slice(0, 200)}; note ${g.note} vs ${p.choosePart.note}; then ${JSON.stringify(p.moving)}: ${JSON.stringify(g.moving).slice(0, 300)} vs ${JSON.stringify(p.chooseMoving).slice(0, 300)}`
      ),
  },
  // 12. character: 16 categories, 740 entries, production's glyphs at its
  // sizes, and choose and automatic leaving the card as ipChoose does.
  character: {
    page: async (S) => {
      const { V, instrument } = await S.boot();
      instrument.set('oud');
      await S.settle();
      const s = V.character.snapshot();
      const head = { current: s.current, automatic: s.automatic, suggestion: s.suggestion };
      const categories = s.categories.map((c) => ({
        id: c.id,
        glyph: (c.prefaces[0] && c.prefaces[0].glyph.category) || null,
        prefaces: c.prefaces.map((e) => ({ id: e.id, note: e.note, entry: e.glyph.entry })),
      }));
      await V.character.choose({ prefaceId: 'sermonizing', revision: s.revision });
      const chosen = { card: S.project(V), note: V.configuration.snapshot().note };
      await V.character.automatic({ revision: V.character.snapshot().revision });
      const auto = { card: S.project(V), note: V.configuration.snapshot().note };
      return { head, categories, chosen, auto, normalize: V.character.normalize('ʿŪd – Café') };
    },
    verdict: (g, p) =>
      why(
        g.categories.length === 16 &&
          g.categories.reduce((n, c) => n + c.prefaces.length, 0) === 740 &&
          same(g.categories, p.categories) &&
          same(g.head, p.character0) &&
          same(g.chosen, p.choosePreface) &&
          same(g.auto, p.chooseAuto) &&
          g.normalize === 'ud cafe',
        `categories equal: ${same(g.categories, p.categories)}; head ${JSON.stringify(g.head)} vs ${JSON.stringify(p.character0)}; chosen ${same(g.chosen, p.choosePreface)}; auto ${same(g.auto, p.chooseAuto)}; normalize ${g.normalize}`
      ),
  },
  // 13. environment: the options, a choice, and sourceMessage for every
  // format at ceilings 1000, 150 and 100 against production's own render,
  // with the preview placed where Add would put it (grouped, it lands after
  // its genre's run) and a recipe Compact cuts at 150.
  environment: {
    run: async (page, p, ctx) => {
      const out = {};
      for (const ceiling of [1000, 150, 100])
        out[ceiling] = await inPage(
          ceiling === 1000 ? page : await ctx.fresh(),
          async (S, ARG) => {
            let recipe;
            let V;
            let instrument;
            if (ARG.ceiling === 1000) ({ recipe, V, instrument } = await S.boot());
            else {
              const { recipeStore } = await import('/prototype/recipe-store.js');
              const { loadEngine } = await import('/prototype/engine/load.js');
              let value = null;
              const fns = new Set();
              instrument = {
                current: () => value,
                subscribe: (fn) => (fns.add(fn), () => fns.delete(fn)),
                set: (v) => {
                  value = v;
                  for (const fn of [...fns]) fn();
                },
              };
              recipe = recipeStore({
                load: loadEngine,
                selection: instrument,
                announce: () => {},
                ceiling: ARG.ceiling,
              });
              await recipe.start();
              V = recipe.preview;
            }
            const R = recipe.port([
              'snapshot',
              'addInstrument',
              'addEnsemble',
              'apply',
              'setInstrumentDestination',
            ]);
            const E = await (await import('/prototype/engine/load.js')).loadEngine();
            const rev = () => R.snapshot().revision;
            const messages = {};
            const read = async (name) => {
              messages[name] = {};
              for (const f of ['rich', 'tags', 'prose', 'compact']) {
                V.output.setFormat(f);
                messages[name][ARG.ceiling + ':' + f] = V.environment.snapshot().sourceMessage;
              }
              V.output.setFormat('rich');
            };
            instrument.set('oud');
            await S.settle();
            const env = V.environment.snapshot();
            const fields = env.fields.map((f) => ({
              key: f.key,
              count: f.options.length,
              options: f.options,
            }));
            await read('empty');
            await R.addEnsemble({ genreId: 'bluegrass', revision: rev() });
            await read('genre');
            R.apply({ op: 'remove_tradition', tradition: 'bluegrass' });
            await R.addInstrument({
              instrumentId: 'banjo_5_string',
              destination: null,
              revision: rev(),
            });
            await V.environment.choose({
              field: 'room',
              id: ARG.room,
              revision: V.environment.snapshot().revision,
            });
            await read('banjo');
            R.apply({ op: 'remove_instrument', card: R.snapshot().cards[0].id });
            await read('alone');
            await V.environment.choose({
              field: 'tuning',
              id: E.TUNINGS[5].id,
              revision: V.environment.snapshot().revision,
            });
            const tuning = V.environment.snapshot().fields.find((f) => f.key === 'tuning');
            const bad = await S.code(
              V.environment.choose({
                field: 'room',
                id: 'zz_no_room',
                revision: V.environment.snapshot().revision,
              })
            );
            const source = R.snapshot().environmentCard;
            // aloneLong: the preview alone, with its room, its tuning and
            // one item on every chain stage, so its one line can't fit at
            // 150 or 100; then the stages cleared again.
            const stages = (on) =>
              E.CHAIN_SECTIONS.map((sec) => ({
                stage: sec.id,
                id: sec.multiSelect || on ? sec.items[0].id : null,
                ...(sec.multiSelect ? { on } : {}),
              }));
            for (const choice of stages(true))
              await V.chain.choose({ ...choice, revision: V.chain.snapshot().revision });
            await S.settle();
            await read('aloneLong');
            // aloneNamed: the same, its instrument named with a " · " of its
            // own while it is read.
            const inst = E.Inst('oud');
            const had = Object.prototype.hasOwnProperty.call(inst, 'short');
            const was = inst.short;
            inst.short = `${inst.short || inst.name} · lute`;
            await read('aloneNamed');
            if (had) inst.short = was;
            else delete inst.short;
            for (const choice of stages(false))
              await V.chain.choose({ ...choice, revision: V.chain.snapshot().revision });
            await S.settle();
            // grouped: whale song, a loose banjo with the room, and the
            // preview (its room and tuning) grouped to whale song.
            await R.addEnsemble({ genreId: 'whale_song', revision: rev() });
            await R.addInstrument({
              instrumentId: 'banjo_5_string',
              destination: null,
              revision: rev(),
            });
            const banjo = R.snapshot().cards.find((c) => c.instrumentId === 'banjo_5_string').id;
            R.apply({ op: 'set_environment', card: banjo, room: ARG.room });
            await R.setInstrumentDestination(S.args(R, { destination: 'whale_song' }));
            await S.settle();
            await read('grouped');
            // truncating: Brasília indie and the loose preview.
            R.apply({ op: 'remove_tradition', tradition: 'whale_song' });
            R.apply({ op: 'remove_instrument', card: banjo });
            await S.settle();
            await R.addEnsemble({ genreId: 'brasilia_indie', revision: rev() });
            await S.settle();
            await read('truncating');
            // named: the same, with the environment card's room named as its
            // own instrument is; namedShort: that card alone with the preview.
            const rename = () => {
              const src = E.envCardOf(E.app.cards);
              const r = E.Room(src.room);
              const was = r.name;
              r.name = E.Inst(src.instrumentId).short || E.Inst(src.instrumentId).name;
              return () => {
                r.name = was;
              };
            };
            let back = rename();
            await read('named');
            back();
            for (const c of R.snapshot().cards.slice(1))
              R.apply({ op: 'remove_instrument', card: c.id });
            await S.settle();
            back = rename();
            await read('namedShort');
            back();
            return {
              fields,
              messages,
              tuning: { value: tuning.value, descriptors: tuning.descriptors },
              bad,
              source,
            };
          },
          { ceiling, room: p.room }
        );
      return out;
    },
    verdict: (g, p) => {
      const r = g[1000];
      if (!r || !r.fields) return JSON.stringify(g).slice(0, 300);
      const wrong = [];
      for (const ceiling of [1000, 150, 100])
        for (const name of [
          'empty',
          'genre',
          'banjo',
          'alone',
          'aloneLong',
          'aloneNamed',
          'grouped',
          'truncating',
          'named',
          'namedShort',
        ])
          for (const f of ['rich', 'tags', 'prose', 'compact']) {
            const k = ceiling + ':' + f;
            const got = g[ceiling].messages[name][k];
            if (got !== p.sources[name][k])
              wrong.push(`${name} ${k}: "${got}" vs "${p.sources[name][k]}"`);
          }
      return why(
        r.fields[0].key === 'tuning' &&
          r.fields[0].count === 122 &&
          r.fields[1].key === 'room' &&
          r.fields[1].count === 256 &&
          same(r.fields[0].options, p.tunings) &&
          same(r.fields[1].options, p.rooms) &&
          same(r.tuning.descriptors, p.tuningDescs) &&
          r.bad === 'INVALID' &&
          !wrong.length,
        wrong.slice(0, 4).join(' | ') || JSON.stringify(r).slice(0, 300)
      );
    },
  },
  // 14. chain: production's stage order; an effect added goes last, one
  // removed goes; a single stage clears with null.
  chain: {
    page: async (S) => {
      const { V, E, instrument } = await S.boot();
      instrument.set('oud');
      await S.settle();
      const fx = E.CHAIN_SECTIONS[0].items.map((i) => i.id);
      const c = () => V.chain.snapshot();
      const value = (stage) => c().stages.find((s) => s.stage === stage).value;
      const out = { order: c().stages.map((s) => [s.stage, s.multi, s.options.length]) };
      await V.chain.choose({ stage: 'fx', id: fx[4], on: true, revision: c().revision });
      await V.chain.choose({ stage: 'fx', id: fx[1], on: true, revision: c().revision });
      out.added = value('fx');
      const r0 = c().revision;
      await V.chain.choose({ stage: 'fx', id: fx[1], on: true, revision: r0 });
      out.again = [value('fx'), c().revision === r0];
      await V.chain.choose({ stage: 'fx', id: fx[4], on: false, revision: c().revision });
      out.removed = value('fx');
      const mic = E.CHAIN_SECTIONS.find((s) => s.id === 'mic').items[2].id;
      await V.chain.choose({ stage: 'mic', id: mic, revision: c().revision });
      out.mic = value('mic');
      await V.chain.choose({ stage: 'mic', id: null, revision: c().revision });
      out.cleared = value('mic');
      out.bad = await S.code(V.chain.choose({ stage: 'zz', id: null, revision: c().revision }));
      out.want = { added: [fx[4], fx[1]], removed: [fx[1]], mic };
      return out;
    },
    verdict: (g, p) =>
      why(
        same(
          g.order,
          p.stages.map((s) => [s.stage, s.multi, s.options.length])
        ) &&
          same(g.added, g.want.added) &&
          same(g.again, [g.want.added, true]) &&
          same(g.removed, g.want.removed) &&
          g.mic === g.want.mic &&
          g.cleared === null &&
          g.bad === 'INVALID',
        JSON.stringify(g).slice(0, 600)
      ),
  },
  // 15. output: production's single-card render in every format; an
  // unknown format refused; copy says its outcome once, in production's
  // words for the same clipboard, and copies the output's own text: a write
  // taken, a write refused, and one that throws at once (all stubbed, so
  // each route runs in every browser), the throwing one held to
  // production's own fallback (#810 6682309672).
  output: {
    opts: { permissions: ['clipboard-read', 'clipboard-write'] },
    run: async (page, p) => {
      const got = await inPage(
        page,
        async (S, ARG) => {
          const { R, V, E, instrument } = await S.boot();
          await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
          instrument.set('oud');
          await S.settle();
          await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
          await S.settle();
          const conf = V.configuration.snapshot();
          await V.configuration.choosePart({
            partId: ARG.part,
            variantId: ARG.variant,
            revision: conf.revision,
          });
          const text = {};
          for (const f of ['rich', 'tags', 'prose', 'compact']) {
            V.output.setFormat(f);
            text[f] = V.output.snapshot().text;
          }
          V.output.setFormat('rich');
          const s0 = V.output.snapshot();
          let thrown = null;
          try {
            V.output.setFormat('zz');
          } catch (e) {
            thrown = e instanceof TypeError;
          }
          window.__copied = [];
          const b = document.createElement('button');
          b.id = 'gate-copy';
          b.addEventListener('click', () => {
            window.__copied.push(V.output.copy());
          });
          document.body.prepend(b);
          return { text, thrown, unchanged: V.output.snapshot() === s0, ready: !!E };
        },
        p.material
      );
      const copy = async () => {
        await page.evaluate(() => window.__said.splice(0));
        await page.click('#gate-copy');
        const r = await page.evaluate(async () => {
          const result = await window.__copied[window.__copied.length - 1];
          await new Promise((res) => setTimeout(res, 50));
          return { result, said: window.__said.splice(0), copied: window.__copiedText.splice(0) };
        });
        return r;
      };
      // Granted: a write the browser takes, stubbed, so the success path
      // runs whatever this browser's own writeText does.
      await page.evaluate(stubClipboard, 'resolve');
      got.granted = await copy();
      // Denied: the write refused, by the stub rather than by clearing the
      // permission, so the fallback runs in every browser.
      await page.evaluate(stubClipboard, 'reject');
      got.denied = await copy();
      // A clipboard that throws at once still says the outcome once.
      await page.evaluate(stubClipboard, 'throw');
      got.throwing = await copy();
      return got;
    },
    verdict: (g, p) => {
      // What each copy put on the clipboard: the output's own text, once.
      const ok = (r, want) =>
        r &&
        r.said.length === 1 &&
        r.said[0] === want &&
        r.result.ok === (want === 'Copied') &&
        same(r.copied, [g.text.rich]);
      return why(
        same(g.text, p.output) &&
          g.thrown === true &&
          g.unchanged &&
          ok(g.granted, copySaid(p.copy.granted)) &&
          ok(g.denied, copySaid(p.copy.denied)) &&
          ok(g.throwing, copySaid(p.copy.throwing)),
        JSON.stringify({ g: { ...g, text: same(g.text, p.output) }, copy: p.copy }).slice(0, 700)
      );
    },
  },
  // 16. Every recipe command's outcome is said once, in production's words
  // where production has them.
  announcements: {
    // Gagaku's row is slowed so the two BUSY sentences are read while its
    // ensemble still waits (unslowed, its "Imported" could land among them).
    opts: {
      routes: {
        '/api/traditions/post_punk.json': { status: 404 },
        '/api/traditions/gagaku.json': { delay: 1500 },
      },
    },
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      S.said();
      const rev = () => R.snapshot().revision;
      const out = {};
      const step = async (name, run) => {
        await S.code(run());
        await S.settle();
        out[name] = S.said();
      };
      await step('genre', () => R.addEnsemble({ genreId: 'bluegrass', revision: rev() }));
      await step('grouped', () =>
        R.addInstrument({ instrumentId: 'oud', destination: 'bluegrass', revision: rev() })
      );
      await step('loose', () =>
        R.addInstrument({ instrumentId: 'udu', destination: null, revision: rev() })
      );
      await step('created', () =>
        R.addInstrument({
          instrumentId: 'banjo_5_string',
          destination: 'afrobeat',
          revision: rev(),
        })
      );
      await step('partial', () => R.addEnsemble({ genreId: 'delta_blues', revision: rev() }));
      await step('none', () => R.addEnsemble({ genreId: 'dub', revision: rev() }));
      await step('failed', () =>
        R.addInstrument({ instrumentId: 'udu', destination: 'post_punk', revision: rev() })
      );
      instrument.set('oud');
      await S.settle();
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      S.said();
      await V.environment.choose({
        field: 'room',
        id: E.ROOMS[3].id,
        revision: V.environment.snapshot().revision,
      });
      await step('configured', () =>
        R.addConfiguredInstrument(S.args(R, { destination: 'bluegrass' }))
      );
      await R.resetInstrumentPreview(S.args(R));
      await S.settle();
      S.said();
      await step('defaults', () =>
        R.addConfiguredInstrument(S.args(R, { destination: 'bluegrass' }))
      );
      // While an addition runs: both BUSY sentences.
      const running = R.addEnsemble({ genreId: 'gagaku', revision: rev() });
      S.said();
      const busy = [
        await S.code(R.addEnsemble({ genreId: 'afrobeat', revision: rev() })),
        await S.code(R.addConfiguredInstrument(S.args(R, { destination: 'bluegrass' }))),
      ];
      await S.settle();
      out.busy = S.said();
      out.busyCodes = busy;
      await running;
      await S.settle();
      S.said();
      await step('stale', () =>
        R.addInstrument({ instrumentId: 'udu', destination: null, revision: rev() - 1 })
      );
      return out;
    },
    verdict: (g, p) => {
      const t = p.toasts;
      const want = {
        genre: t.genre,
        grouped: t.grouped,
        loose: t.loose,
        created: t.created,
        partial: t.partial,
        none: t.none,
        failed: [
          `Added ${p.failedGenre.name} as an independent instrument (${p.failedGenre.genre} couldn’t be loaded)`,
        ],
        configured: t.configured,
        defaults: t.defaults,
        busy: [...t.busyGenre, ...t.busyAdd],
        stale: [
          `Your recipe changed before ${p.failedGenre.name} was added. Nothing was added; try again.`,
        ],
      };
      const wrong = Object.keys(want).filter(
        (k) => !same(g[k], want[k]) || want[k].length !== 1 + (k === 'busy' ? 1 : 0)
      );
      return why(
        !wrong.length && same(g.busyCodes, ['BUSY', 'BUSY']),
        wrong
          .map((k) => `${k}: ${JSON.stringify(g[k])} vs ${JSON.stringify(want[k])}`)
          .join(' | ') || JSON.stringify(g.busyCodes)
      );
    },
  },
  // 17. The destination: Independent first and the default, the genres in
  // first-card order; undoing a genre, or removing it with apply, falls back
  // and rebuilds the preview.
  destination: {
    page: async (S) => {
      const { R, instrument } = await S.boot();
      instrument.set('oud');
      await S.settle();
      const first = S.acts(R);
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      await R.addEnsemble({ genreId: 'afrobeat', revision: R.snapshot().revision });
      const listed = S.acts(R).destinations.map((d) => d.genreId);
      await R.setInstrumentDestination(S.args(R, { destination: 'afrobeat' }));
      await S.settle();
      const pr = S.acts(R).previewRevision;
      R.undo();
      const fell = S.acts(R).destination;
      await S.settle();
      const a = S.acts(R);
      // Removing the destination genre with apply falls back the same way.
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      const pr2 = S.acts(R).previewRevision;
      const removed = R.apply({ op: 'remove_tradition', tradition: 'bluegrass' });
      const fell2 = S.acts(R).destination;
      await S.settle();
      const b = S.acts(R);
      return {
        default: [first.destination, first.destinations[0]],
        listed,
        fell,
        after: {
          destination: a.destination,
          moved: a.previewRevision > pr,
          status: a.status,
          listed: a.destinations.map((d) => d.genreId),
        },
        applied: {
          removed,
          fell: fell2,
          destination: b.destination,
          moved: b.previewRevision > pr2,
          status: b.status,
          listed: b.destinations.map((d) => d.genreId),
        },
      };
    },
    verdict: (g) =>
      why(
        same(g.default, [null, { genreId: null, name: 'Independent instrument' }]) &&
          same(g.listed, [null, 'bluegrass', 'afrobeat']) &&
          g.fell === null &&
          same(g.after, {
            destination: null,
            moved: true,
            status: 'ready',
            listed: [null, 'bluegrass'],
          }) &&
          same(g.applied, {
            removed: { ok: true, changed: true },
            fell: null,
            destination: null,
            moved: true,
            status: 'ready',
            listed: [null],
          }),
        JSON.stringify(g)
      ),
  },
  // 18. Snapshots are deep-frozen and the same object until a change;
  // subscribe's unsubscribe is idempotent; a throwing listener stops no
  // other; a command started in a listener is delivered after the pass;
  // the views are told in view order.
  immutability: {
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      const s = R.snapshot();
      const c = V.configuration.snapshot();
      const frozen = [
        s,
        s.instrumentActions,
        s.instrumentActions.destinations[1],
        s.groups[0],
        s.cards[0],
        c,
        c.parts[0],
        c.parts[0].variants[0],
        c.parts[0].variants[0].descriptors,
        V.character.snapshot().categories[0].prefaces[0].glyph,
      ].every((x) => Object.isFrozen(x));
      const stable = R.snapshot() === s && V.configuration.snapshot() === c;
      const seen = [];
      let started = false;
      const offA = R.subscribe(() => {
        seen.push(['a', R.snapshot().revision]);
        if (!started) {
          started = true;
          R.apply({ op: 'set_environment', room: E.ROOMS[11].id });
          seen.push(['a started', R.snapshot().revision]);
        }
      });
      const offThrow = R.subscribe(() => {
        throw new Error('gate: a listener that throws');
      });
      const offB = R.subscribe(() => seen.push(['b', R.snapshot().revision]));
      R.apply({ op: 'set_environment', room: E.ROOMS[13].id });
      offA();
      offThrow();
      const twice = [offB(), offB()];
      const quiet = seen.length;
      R.apply({ op: 'set_environment', room: E.ROOMS[15].id });
      const quietAfter = seen.length === quiet;
      // A preview choice changes every view: each is told, in view order.
      const told = [];
      const offs = ['recipe', 'configuration', 'character', 'environment', 'chain', 'output'].map(
        (v) => (v === 'recipe' ? R : V[v]).subscribe(() => told.push(v))
      );
      await V.chain.choose({
        stage: 'fx',
        id: E.CHAIN_SECTIONS[0].items[6].id,
        on: true,
        revision: V.chain.snapshot().revision,
      });
      for (const off of offs) off();
      return {
        frozen,
        stable,
        seen,
        twice,
        quietAfter,
        fresh: R.snapshot() !== s,
        fn: typeof offA,
        told,
      };
    },
    verdict: (g) => {
      // a sees commit 1 and starts commit 2 at once; b is told of commit 1
      // (reading the newer snapshot), then of commit 2, in order.
      const order = g.seen.map(([w]) => w).join(',');
      return why(
        g.frozen &&
          g.stable &&
          g.fresh &&
          g.fn === 'function' &&
          same(g.twice, [undefined, undefined]) &&
          g.quietAfter &&
          order === 'a,a started,b,a,b' &&
          same(g.told, ['recipe', 'configuration', 'character', 'environment', 'chain', 'output']),
        JSON.stringify(g)
      );
    },
    errors: ['gate: a listener that throws'],
  },
  // 19. The store owns the engine's workspace: it resets what was there,
  // a second store can't claim it, and the other loaders never write it.
  ownership: {
    page: async (S) => {
      const data = await import('/prototype/data.js');
      const engine = (await data.loadGenreDiscovery()).page;
      engine.app.history.push('{"cards":[]}');
      engine.app.historyIndex = engine.app.history.length - 1;
      const { R, E, recipe } = await S.boot();
      const reset = { length: E.app.history.length, index: E.app.historyIndex, same: E === engine };
      await R.addInstrument({
        instrumentId: 'udu',
        destination: null,
        revision: R.snapshot().revision,
      });
      const h = JSON.stringify(E.app.history);
      const { recipeStore } = await import('/prototype/recipe-store.js');
      const { instrument } = await import('/prototype/selection.js');
      const second = recipeStore({
        load: (await import('/prototype/engine/load.js')).loadEngine,
        selection: instrument,
        announce: () => {},
      });
      const claimed = await S.code(second.start());
      const kept = JSON.stringify(E.app.history) === h;
      await data.instrumentLoader().loadInstrument('oud');
      await data.loadGenreDiscovery();
      return {
        reset,
        claimed,
        kept,
        untouched: JSON.stringify(E.app.history) === h,
        status: recipe.status(),
      };
    },
    verdict: (g) =>
      why(
        same(g.reset, { length: 1, index: 0, same: true }) &&
          g.claimed === 'CLAIMED' &&
          g.kept &&
          g.untouched &&
          g.status === 'ready',
        JSON.stringify(g)
      ),
  },
  // 20. Each view carries exactly its contract's methods.
  surfaces: {
    page: async (S, ARG) => {
      const { recipe } = await S.boot();
      const out = {};
      for (const [lane, keys] of Object.entries(ARG.ports))
        out[lane] = Object.keys(recipe.port(keys)).sort();
      for (const v of Object.keys(ARG.views)) out[v] = Object.keys(recipe.preview[v]).sort();
      out.store = Object.keys(recipe).sort();
      out.frozen =
        Object.isFrozen(recipe) &&
        Object.isFrozen(recipe.preview) &&
        Object.isFrozen(recipe.port(['snapshot']));
      let refused = false;
      try {
        recipe.port(['snapshot', 'zz']);
      } catch (e) {
        refused = e instanceof TypeError;
      }
      out.refused = refused;
      return out;
    },
    arg: () => ({ ports: STORE_VIEWS, views: PREVIEW_KEYS }),
    verdict: (g) => {
      const wrong = [...Object.entries(STORE_VIEWS), ...Object.entries(PREVIEW_KEYS)].filter(
        ([k, keys]) => !same(g[k], [...keys].sort())
      );
      return why(
        !wrong.length &&
          same(g.store, [
            'addGenre',
            'port',
            'preview',
            'previewIs',
            'reopen',
            'start',
            'status',
          ]) &&
          g.frozen &&
          g.refused,
        wrong.map(([k]) => `${k}: ${JSON.stringify(g[k])}`).join(' | ') || JSON.stringify(g)
      );
    },
  },
  // 21. apply: the ops not in this build are refused; set_variant is the
  // editor's part click, and takes only a variant the part has;
  // set_environment with no card edits envCardOf, not the first card; an
  // edit that moves nothing is { ok: true, changed: false } and no entry; a
  // list stage takes a copy of the caller's list, and clear empties it;
  // set_preface null is Back to automatic;
  // remove_tradition takes a genre id only, so it can't reach the loose udu.
  apply: {
    page: async (S, ARG) => {
      const { R, E } = await S.boot();
      await R.addInstrument({
        instrumentId: 'udu',
        destination: null,
        revision: R.snapshot().revision,
      });
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      const banjo = E.app.cards.find((c) => c.instrumentId === 'banjo_5_string');
      const refused = [
        'duplicate_instrument',
        'move_to_tradition',
        'make_primary',
        'move_instrument',
        'zz_op',
      ].map((op) => R.apply({ op, card: banjo.id }).code);
      const asyncOps = ['add_instrument', 'add_tradition'].map((op) => R.apply({ op }).code);
      const invalid = [
        R.apply({ op: 'set_variant', card: banjo.id, part: 'zz', variant: null }).code,
        R.apply({ op: 'set_variant', card: 'zz', part: ARG.part, variant: null }).code,
        R.apply({ op: 'set_environment' }).code,
        R.apply({ op: 'set_variant', card: banjo.id, part: ARG.part, variant: 'zz_not_a_variant' })
          .code,
      ];
      const count = () => E.app.cards.length;
      const n0 = count();
      const removeTradition = [
        R.apply({ op: 'remove_tradition', tradition: null }).code,
        R.apply({ op: 'remove_tradition' }).code,
        R.apply({ op: 'remove_tradition', tradition: 42 }).code,
        R.apply({ op: 'remove_tradition', tradition: 'zz_not_in_recipe' }).code,
        count() - n0,
      ];
      const v = R.apply({
        op: 'set_variant',
        card: banjo.id,
        part: ARG.part,
        variant: ARG.variant,
      });
      const after = E.app.cards.find((c) => c.id === banjo.id);
      const card = {
        parts: Object.fromEntries(
          E.Inst('banjo_5_string').parts.map((x) => [x.id, after.parts[x.id] || null])
        ),
        pinned: (after.pinnedParts || []).slice().sort(),
        preface: after.preface || null,
        auto: after.prefaceAuto !== false,
        tuning: after.tuning || null,
        room: after.room || null,
        chain: Object.fromEntries(
          E.CHAIN_SECTIONS.map((s) => [
            s.id,
            s.multiSelect ? [...(after.chain[s.id] || [])] : after.chain[s.id] || null,
          ])
        ),
      };
      const src = E.envCardOf(E.app.cards);
      const udu = E.app.cards[0];
      // The loose udu leads and has no environment, so the environment card
      // isn't the first card (#671's "environment not rendered").
      const leads = udu.instrumentId === 'udu' && !E.hasEnvironment(udu) && src !== udu;
      const room = E.ROOMS[17].id;
      const env = R.apply({ op: 'set_environment', room });
      const landed =
        E.envCardOf(E.app.cards).id === src.id &&
        E.envCardOf(E.app.cards).room === room &&
        !udu.room &&
        !E.hasEnvironment(udu);
      const h = E.app.history.length;
      const r = R.snapshot().revision;
      const sameRoom = R.apply({ op: 'set_environment', room });
      const entries = E.app.history.length - h;
      const revisionKept = R.snapshot().revision === r;
      // A list stage takes a copy of the caller's list, and clear empties it.
      const fxIds = E.CHAIN_SECTIONS.find((x) => x.id === 'fx')
        .items.slice(0, 2)
        .map((i) => i.id);
      const list = fxIds.slice();
      const setFx = R.apply({ op: 'set_environment', chain: { fx: list } });
      list.push('zz_added_after');
      const fxAfter = [...(E.envCardOf(E.app.cards).chain.fx || [])];
      const cleared = R.apply({ op: 'set_environment', clear: ['fx', 'mic'] });
      const envAfter = E.envCardOf(E.app.cards);
      const chain = {
        setFx,
        copied: JSON.stringify(fxAfter) === JSON.stringify(fxIds),
        cleared,
        fx: envAfter.chain.fx,
        mic: envAfter.chain.mic,
      };
      // Back to automatic: the card is automatic again, and its character
      // is no longer the one picked (the engine's history entry re-derives
      // every automatic card's character, as production's does).
      const now = () => E.app.cards.find((c) => c.id === banjo.id);
      const pick = 'bitter';
      R.apply({ op: 'set_preface', card: banjo.id, preface: pick });
      const picked = [now().preface, now().prefaceAuto !== false];
      const auto = R.apply({ op: 'set_preface', card: banjo.id, preface: null });
      const automatic = {
        pick,
        picked,
        auto,
        preface: now().preface,
        flag: now().prefaceAuto !== false,
      };
      return {
        leads,
        chain,
        automatic,
        refused,
        asyncOps,
        invalid,
        removeTradition,
        v,
        card,
        env,
        landed,
        sameRoom,
        entries,
        revision: revisionKept,
      };
    },
    arg: (p) => ({ part: p.setVariant.part, variant: p.setVariant.variant }),
    verdict: (g, p) =>
      why(
        g.refused.every((c) => c === 'NOT_IN_BUILD') &&
          same(g.asyncOps, ['ASYNC', 'ASYNC']) &&
          same(g.invalid, ['INVALID', 'NOT_FOUND', 'INVALID', 'INVALID']) &&
          same(g.removeTradition, ['INVALID', 'INVALID', 'INVALID', 'NOT_FOUND', 0]) &&
          same(g.v, { ok: true, changed: true }) &&
          same(g.card, p.setVariant.card) &&
          same(g.env, { ok: true, changed: true }) &&
          g.leads &&
          g.landed &&
          same(g.sameRoom, { ok: true, changed: false }) &&
          g.entries === 0 &&
          g.revision &&
          same(g.chain, {
            setFx: { ok: true, changed: true },
            copied: true,
            cleared: { ok: true, changed: true },
            fx: [],
            mic: null,
          }) &&
          same(g.automatic.picked, [g.automatic.pick, false]) &&
          same(g.automatic.auto, { ok: true, changed: true }) &&
          g.automatic.flag &&
          typeof g.automatic.preface === 'string' &&
          g.automatic.preface !== g.automatic.pick,
        JSON.stringify({ ...g, card: undefined }).slice(0, 900)
      ),
  },
  // 22. The environment's hand-over is said as production says it, and an
  // add that takes the environment over says nothing about it.
  handover: {
    page: async (S) => {
      const { R } = await S.boot();
      await S.settle();
      S.said();
      const rev = () => R.snapshot().revision;
      const out = [];
      const step = async (name, run) => {
        await S.code(run());
        await S.settle();
        out.push([name, S.said()]);
      };
      await step('afrobeat', () => R.addEnsemble({ genreId: 'afrobeat', revision: rev() }));
      await step('bluegrass', () => R.addEnsemble({ genreId: 'bluegrass', revision: rev() }));
      await step('remove source', () =>
        Promise.resolve(R.apply({ op: 'remove_instrument', card: R.snapshot().environmentCard }))
      );
      await step('remove afrobeat', () =>
        Promise.resolve(R.apply({ op: 'remove_tradition', tradition: 'afrobeat' }))
      );
      await step('remove bluegrass', () =>
        Promise.resolve(R.apply({ op: 'remove_tradition', tradition: 'bluegrass' }))
      );
      await step('loose banjo', () =>
        R.addInstrument({ instrumentId: 'banjo_5_string', destination: null, revision: rev() })
      );
      await step('bluegrass again', () => R.addEnsemble({ genreId: 'bluegrass', revision: rev() }));
      await step('undo', () => Promise.resolve(R.undo()));
      await step('redo', () => Promise.resolve(R.redo()));
      return out;
    },
    verdict: (g, p) => {
      const adds = ['afrobeat', 'bluegrass', 'loose banjo', 'bluegrass again'];
      const wrong = [];
      for (const [name, text] of p.handover) {
        const said = (g.find(([n]) => n === name) || [null, null])[1];
        if (!said) wrong.push(`${name}: not run`);
        else if (adds.includes(name)) {
          if (said.length !== 1 || (text && said.includes(text)))
            wrong.push(`${name}: ${JSON.stringify(said)} (production: "${text}")`);
        } else if (!same(said, text ? [text] : []))
          wrong.push(`${name}: ${JSON.stringify(said)} vs "${text}"`);
      }
      const spoken = p.handover.filter(([, t]) => t).length;
      return why(
        !wrong.length && spoken >= 3,
        wrong.join(' | ') || `only ${spoken} hand-overs in production's sequence`
      );
    },
  },
  // 23. A pending destination change or Reset always settles: when a later
  // rebuild overtakes it, and when the rebuild ends in an error.
  settles: {
    page: async (S) => {
      const { R, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      await R.addEnsemble({ genreId: 'afrobeat', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      const within = (p) => Promise.race([S.code(p), S.tick(3000).then(() => 'pending')]);
      // Each command waits on a rebuild that waits on the genre's row; a
      // later rebuild, started at once, ends it.
      const round = async (then) => {
        const fresh = async () => {
          instrument.set(null);
          instrument.set('oud');
          await S.settle();
        };
        await fresh();
        const reset = R.resetInstrumentPreview(S.args(R));
        then();
        const r = await within(reset);
        await fresh();
        const other = S.acts(R).destination === 'bluegrass' ? 'afrobeat' : 'bluegrass';
        const dest = R.setInstrumentDestination(S.args(R, { destination: other }));
        then();
        return [r, await within(dest)];
      };
      const out = {};
      out.overtaken = await round(() => instrument.set(null));
      out.unknown = await round(() => instrument.set('zz_not_an_instrument'));
      const inst = E.Inst('udu');
      const parts = inst.parts;
      out.throwing = await round(() => {
        Object.defineProperty(inst, 'parts', {
          configurable: true,
          get() {
            throw new Error('gate: a broken instrument');
          },
        });
        instrument.set('udu');
      });
      Object.defineProperty(inst, 'parts', { configurable: true, writable: true, value: parts });
      instrument.set('oud');
      await S.settle();
      out.after = await S.code(R.resetInstrumentPreview(S.args(R)));
      return out;
    },
    verdict: (g) =>
      why(
        same(g.overtaken, ['ok', 'ok']) &&
          same(g.unknown, ['NOT_FOUND', 'NOT_FOUND']) &&
          same(g.throwing, ['LOAD_FAILED', 'LOAD_FAILED']) &&
          g.after === 'ok',
        JSON.stringify(g)
      ),
  },
  // 24. The "what moved" note is cleared at every rebuild.
  note: {
    page: async (S) => {
      const { R, V, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      await V.character.choose({
        prefaceId: 'sermonizing',
        revision: V.character.snapshot().revision,
      });
      const picked = V.configuration.snapshot().note;
      instrument.set('banjo_5_string');
      await S.settle();
      const opened = V.configuration.snapshot().note;
      await V.character.choose({
        prefaceId: 'sermonizing',
        revision: V.character.snapshot().revision,
      });
      const again = V.configuration.snapshot().note;
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      return { picked, opened, again, moved: V.configuration.snapshot().note };
    },
    verdict: (g) =>
      why(!!g.picked && g.opened === null && !!g.again && g.moved === null, JSON.stringify(g)),
  },
  // 25. While no instrument is open, nothing moves previewRevision, and the
  // five preview views keep their snapshots through recipe changes.
  noInstrument: {
    page: async (S) => {
      const { R, V, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      instrument.set(null);
      await S.settle();
      const views = Object.fromEntries(Object.keys(V).map((k) => [k, V[k].snapshot()]));
      const pr = S.acts(R).previewRevision;
      const a0 = S.acts(R);
      await R.addInstrument({
        instrumentId: 'udu',
        destination: null,
        revision: R.snapshot().revision,
      });
      R.undo();
      R.undo();
      await S.settle();
      const a = S.acts(R);
      return {
        error: views.configuration.error,
        state: [a0.status, a0.instrumentId, a0.destination],
        kept: Object.keys(V).every((k) => V[k].snapshot() === views[k]),
        revision: a.previewRevision === pr,
        after: [a.status, a.instrumentId, a.destination, a.destinations.length],
      };
    },
    verdict: (g) =>
      why(
        same(g.error, { code: 'NO_INSTRUMENT', message: 'No instrument is open.' }) &&
          same(g.state, ['ready', null, 'bluegrass']) &&
          g.kept &&
          g.revision &&
          same(g.after, ['ready', null, null, 1]),
        JSON.stringify(g)
      ),
  },
  // 26. addGenre on a page where nothing has started the store, called twice
  // at once: one import, and the second says an addition is in progress.
  addGenre: {
    page: async (S) => {
      const { recipe } = await S.boot({ start: false });
      const before = recipe.status();
      S.said();
      let threw = false;
      try {
        // Two at once: the second finds the first running.
        recipe.addGenre('bluegrass');
        recipe.addGenre('afrobeat');
      } catch {
        threw = true;
      }
      for (let i = 0; i < 300 && window.__said.length < 2; i++) await S.tick(20);
      await S.tick(300);
      await S.settle();
      const R = recipe.port(['snapshot']);
      return {
        before,
        threw,
        said: S.said(),
        groups: R.snapshot().groups.map((g) => [g.genreId, g.count]),
      };
    },
    verdict: (g, p) =>
      why(
        g.before === 'loading' &&
          !g.threw &&
          same(g.said, [...p.toasts.busyGenre, ...p.toasts.genre]) &&
          same(g.groups, [['bluegrass', 6]]),
        JSON.stringify(g)
      ),
  },
  // 27. Before the store starts, a selection change reaches nothing: no
  // throw, the listeners after the store's still run, no instrument data.
  selection: {
    opts: { hash: '#instrument' },
    run: async (page, p, ctx) => {
      const got = await inPage(page, async (S) => {
        const { instrument, recipe } = await S.boot({ start: false });
        let ran = 0;
        const off = instrument.subscribe(() => ran++);
        let threw = null;
        try {
          instrument.set('oud');
          instrument.set('banjo_5_string');
        } catch (e) {
          threw = String(e && e.message);
        }
        off();
        await S.tick(300);
        const pr = recipe.port(['snapshot']).snapshot().instrumentActions.previewRevision;
        return { ran, threw, status: recipe.status(), pr };
      });
      got.engineJson = ctx.requested().some((u) => u.startsWith('/api/engine.json'));
      return got;
    },
    verdict: (g) =>
      why(
        g.ran === 2 && g.threw === null && g.status === 'loading' && g.pr === 0 && !g.engineJson,
        JSON.stringify(g)
      ),
  },
  // 28. A failed catalog boot can be retried.
  retry: {
    // The engine's own CATALOG_READY and loadEngine's immediate second ask
    // both fail; the next start() asks a third time.
    opts: { routes: { '/api/browse_boot.json': { status: 404, times: 2 } } },
    page: async (S) => {
      const { recipe } = await S.boot({ start: false });
      const first = await S.code(recipe.start());
      const status = recipe.status();
      const second = await S.code(recipe.start());
      const R = recipe.port(['snapshot', 'addEnsemble']);
      const added = await S.code(
        R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision })
      );
      return {
        first,
        status,
        second,
        after: recipe.status(),
        added,
        cards: R.snapshot().cards.length,
      };
    },
    verdict: (g) =>
      why(
        g.first === 'LOAD_FAILED' &&
          g.status === 'error' &&
          g.second === 'ok' &&
          g.after === 'ready' &&
          g.added === 'ok' &&
          g.cards === 6,
        JSON.stringify(g)
      ),
  },
  // 29. An Undo or a Redo that restores nothing is refused, is said once,
  // and changes nothing.
  undoFails: {
    page: async (S) => {
      const { R, E } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      await R.addInstrument({
        instrumentId: 'udu',
        destination: null,
        revision: R.snapshot().revision,
      });
      await S.settle();
      S.said();
      const fails = async (step, at) => {
        const good = E.app.history[at];
        E.app.history[at] = '{not json';
        const s = R.snapshot();
        const index = E.app.historyIndex;
        let told = 0;
        const off = R.subscribe(() => told++);
        const r = R[step]();
        off();
        await S.settle();
        const out = {
          r,
          said: S.said(),
          revision: R.snapshot().revision === s.revision,
          same: R.snapshot() === s,
          told,
          index: E.app.historyIndex === index,
        };
        E.app.history[at] = good;
        return out;
      };
      const undo = await fails('undo', E.app.historyIndex - 1);
      R.undo();
      await S.settle();
      S.said();
      const redo = await fails('redo', E.app.historyIndex + 1);
      return { undo, redo };
    },
    verdict: (g) => {
      const ok = (x, code) =>
        x.r.ok === false &&
        x.r.changed === false &&
        x.r.code === code &&
        typeof x.r.refusal === 'string' &&
        same(x.said, [x.r.refusal]) &&
        x.revision &&
        x.same &&
        x.told === 0 &&
        x.index;
      return why(ok(g.undo, 'UNDO_FAILED') && ok(g.redo, 'REDO_FAILED'), JSON.stringify(g));
    },
  },
  // 30. Genre Instruments' roster (#770): production's genre page roster, in
  // order, an alias answered by its genre, an unknown id NOT_FOUND.
  roster: {
    page: async (S) => {
      await S.boot();
      const data = await import('/prototype/data.js');
      const out = {};
      for (const id of ['bluegrass', 'afrobeat', 'gagaku', 'qawwali', 'acousmatic'])
        out[id] = JSON.parse(JSON.stringify(await data.loadGenreInstruments(id)));
      const r = await data.loadGenreInstruments('bluegrass');
      out.frozen =
        Object.isFrozen(r) && Object.isFrozen(r.instruments) && Object.isFrozen(r.instruments[0]);
      out.unknown = await S.code(data.loadGenreInstruments('zz_not_a_genre'));
      const ac = new AbortController();
      ac.abort();
      out.aborted = await data.loadGenreInstruments('bluegrass', { signal: ac.signal }).then(
        () => 'resolved',
        (e) => e.name
      );
      return out;
    },
    verdict: (g, p) => {
      const ids = Object.keys(p.rosters);
      const wrong = ids.filter((id) => !same(g[id], p.rosters[id]));
      return why(
        !wrong.length &&
          g.frozen &&
          g.unknown === 'NOT_FOUND' &&
          g.aborted === 'AbortError' &&
          g.acousmatic.id !== 'acousmatic',
        wrong
          .map(
            (id) =>
              `${id}: ${JSON.stringify(g[id]).slice(0, 200)} vs ${JSON.stringify(p.rosters[id]).slice(0, 200)}`
          )
          .join(' | ') ||
          JSON.stringify({ frozen: g.frozen, unknown: g.unknown, aborted: g.aborted })
      );
    },
  },
  // 31. The "Your recipe" line follows the store: nothing before it starts,
  // the count after each change, and back after Undo.
  countLine: {
    page: async (S) => {
      const line = () => document.querySelector('aside.recipe > p:not(.catalog)').textContent;
      const { recipe } = await S.boot({ start: false });
      const out = { before: line() };
      await recipe.start();
      out.started = line();
      const R = recipe.port(['snapshot', 'addEnsemble', 'addInstrument', 'undo']);
      await R.addInstrument({
        instrumentId: 'udu',
        destination: null,
        revision: R.snapshot().revision,
      });
      out.one = line();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      out.seven = line();
      R.undo();
      out.undone = line();
      R.undo();
      out.empty = line();
      return out;
    },
    verdict: (g) =>
      why(
        same(g, {
          before: 'No instruments yet.',
          started: 'No instruments yet.',
          one: '1 instrument in Your recipe.',
          seven: '7 instruments in Your recipe.',
          undone: '1 instrument in Your recipe.',
          empty: 'No instruments yet.',
        }),
        JSON.stringify(g)
      ),
  },
  // 32. The Genre Instruments host (#770): its ctx and its recipe view are
  // exactly the registered ones; when the store can't load it says so with
  // "Try again." and Retry mounts it; openInstrument opens the Instrument
  // route on that instrument.
  genreHost: {
    opts: { hash: '#genre', fail: ['/api/browse_boot.json'] },
    run: async (page, p, ctx) => {
      const note = () =>
        page.evaluate(() => {
          const n = document.querySelector(
            '[data-feature-host="genreinstruments"] [data-host-note]'
          );
          return n ? n.textContent : null;
        });
      await page.waitForFunction(
        () => {
          const n = document.querySelector(
            '[data-feature-host="genreinstruments"] [data-host-note]'
          );
          return n && !/^Loading/.test(n.textContent);
        },
        null,
        { timeout: 30000 }
      );
      const unloaded = await note();
      ctx.unfail('/api/browse_boot.json');
      await page.click('[data-feature-host="genreinstruments"] [data-host-retry]');
      await waitMounted(page, 'genreinstruments');
      const got = await page.evaluate(async () => {
        const ctx = window.__probeCtx.genreinstruments;
        const sel = await import('/prototype/selection.js');
        const keys = window.__probe.genreinstruments.keys;
        const recipeKeys = Object.keys(ctx.recipe).sort();
        const frozen = Object.isFrozen(ctx.recipe) && Object.isFrozen(ctx.genre);
        ctx.openInstrument('oud', { returnFocus: document.body });
        await new Promise((r) => setTimeout(r, 100));
        return {
          keys,
          recipeKeys,
          frozen,
          instrument: sel.instrument.current(),
          hash: location.hash,
          heading: document.activeElement && document.activeElement.id,
        };
      });
      return { unloaded, ...got };
    },
    verdict: (g) =>
      why(
        g.unloaded === 'The genre’s instruments did not load. Try again.' &&
          same(g.keys, CTX_KEYS.genreinstruments) &&
          same(g.recipeKeys, PORT_KEYS.genreinstruments.recipe) &&
          g.frozen &&
          g.instrument === 'oud' &&
          g.hash === '#instrument' &&
          g.heading === 'h-instrument',
        JSON.stringify(g)
      ),
  },
  // 33. The argument guards and the shell's previewIs: an instrument-action
  // command with no instrument open, or naming a destination that isn't on
  // offer, is INVALID; a configured add for another destination than the
  // preview's is INVALID; Undo and Redo with nothing to step say so and
  // change nothing; subscribe() takes only a function; previewIs is true
  // for the open preview's own instrument and revision only.
  guards: {
    page: async (S) => {
      const { R, recipe, instrument } = await S.boot();
      const out = {};
      const none = S.args(R);
      out.noInstrument = [
        await S.code(R.setInstrumentDestination({ ...none, destination: null })),
        await S.code(R.addConfiguredInstrument({ ...none, destination: null })),
        await S.code(R.resetInstrumentPreview(none)),
      ];
      out.nothing = [R.undo(), R.redo()].map((r) => [r.ok, r.changed, r.code]);
      out.revision = R.snapshot().revision;
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      const a = S.args(R);
      out.badDestination = await S.code(
        R.setInstrumentDestination({ ...a, destination: 'gagaku' })
      );
      out.otherDestination = await S.code(
        R.addConfiguredInstrument({ ...a, destination: 'bluegrass' })
      );
      out.cards = R.snapshot().cards.length;
      let threw = null;
      try {
        R.subscribe('not a function');
      } catch (e) {
        threw = e instanceof TypeError;
      }
      out.subscribe = threw;
      const pr = S.acts(R).previewRevision;
      out.previewIs = [
        recipe.previewIs('oud', pr),
        recipe.previewIs('oud', pr - 1),
        recipe.previewIs('banjo_5_string', pr),
      ];
      return out;
    },
    verdict: (g) =>
      why(
        same(g.noInstrument, ['INVALID', 'INVALID', 'INVALID']) &&
          same(g.nothing, [
            [false, false, 'NOTHING_TO_UNDO'],
            [false, false, 'NOTHING_TO_REDO'],
          ]) &&
          g.revision === 1 &&
          g.badDestination === 'INVALID' &&
          g.otherDestination === 'INVALID' &&
          g.cards === 6 &&
          g.subscribe === true &&
          same(g.previewIs, [true, false, false]),
        JSON.stringify(g)
      ),
  },
  // 34. An add whose engine call throws part-way changes nothing, is
  // refused LOAD_FAILED and said once, and leaves the store free: the next
  // add, ensemble, apply, Undo and addGenre all work. The ensemble's last
  // instrument can't be read, so the cards before it were made and must go;
  // the other adds throw when the engine pushes their card.
  throwingAdd: {
    page: async (S) => {
      const { R, E, recipe, instrument } = await S.boot();
      const rev = () => R.snapshot().revision;
      await R.addInstrument({ instrumentId: 'udu', destination: null, revision: rev() });
      await S.settle();
      S.said();
      const roster = E.Catalog.get('afrobeat').instruments;
      const brokenId = roster[roster.length - 1];
      const broken = E.Inst(brokenId);
      const parts = broken.parts;
      const unreadable = () =>
        Object.defineProperty(broken, 'parts', {
          configurable: true,
          get() {
            throw new Error('gate: an instrument that can’t be read');
          },
        });
      const readable = () =>
        Object.defineProperty(broken, 'parts', {
          configurable: true,
          writable: true,
          value: parts,
        });
      const unpushable = () => {
        E.app.cards = Object.freeze(E.app.cards.slice());
      };
      const pushable = () => {
        if (Object.isFrozen(E.app.cards)) E.app.cards = E.app.cards.slice();
      };
      const state = () =>
        JSON.stringify([S.key(E), E.app.history.length, E.app.historyIndex, rev()]);
      const out = {};
      const attempt = async (name, breakIt, mend, run) => {
        const before = state();
        breakIt();
        const code = await S.code(run());
        mend();
        await S.settle();
        out[name] = { code, said: S.said(), same: state() === before, busy: R.snapshot().busy };
      };
      await attempt('ensemble', unreadable, readable, () =>
        R.addEnsemble({ genreId: 'afrobeat', revision: rev() })
      );
      await attempt('loose', unreadable, readable, () =>
        R.addInstrument({ instrumentId: brokenId, destination: null, revision: rev() })
      );
      await attempt('grouped', unpushable, pushable, () =>
        R.addInstrument({ instrumentId: 'oud', destination: 'afrobeat', revision: rev() })
      );
      instrument.set('oud');
      await S.settle();
      await attempt('configured', unpushable, pushable, () =>
        R.addConfiguredInstrument(S.args(R, { destination: null }))
      );
      const after = {
        add: await S.code(
          R.addInstrument({ instrumentId: 'banjo_5_string', destination: null, revision: rev() })
        ),
        ensemble: await S.code(R.addEnsemble({ genreId: 'afrobeat', revision: rev() })),
        apply: R.apply({ op: 'remove_tradition', tradition: 'afrobeat' }),
        undo: R.undo(),
        cards: R.snapshot().cards.length,
      };
      await S.settle();
      S.said();
      recipe.addGenre('bluegrass');
      for (let i = 0; i < 300 && !window.__said.length; i++) await S.tick(20);
      await S.settle();
      after.addGenre = S.said();
      return {
        ...out,
        after,
        names: {
          genre: E.Catalog.get('afrobeat').name,
          broken: broken.name,
          oud: E.Inst('oud').name,
        },
        roster: roster.length,
      };
    },
    verdict: (g, p) => {
      const n = g.names || {};
      const want = {
        ensemble: `${n.genre} couldn’t be loaded, so nothing was added. Try again.`,
        loose: `${n.broken} couldn’t be added. Nothing was changed. Try again.`,
        grouped: `${n.oud} couldn’t be added. Nothing was changed. Try again.`,
        configured: `${n.oud} couldn’t be added. Nothing was changed. Try again.`,
      };
      const wrong = Object.keys(want).filter(
        (k) =>
          !g[k] || !same(g[k], { code: 'LOAD_FAILED', said: [want[k]], same: true, busy: false })
      );
      const a = g.after || {};
      return why(
        g.roster > 1 &&
          !wrong.length &&
          a.add === 'ok' &&
          a.ensemble === 'ok' &&
          same(a.apply, { ok: true, changed: true }) &&
          same(a.undo, { ok: true, changed: true }) &&
          same(a.addGenre, p.toasts.genre),
        wrong.map((k) => `${k}: ${JSON.stringify(g[k])} (want "${want[k]}")`).join(' | ') ||
          JSON.stringify(a)
      );
    },
  },
  // 35. Opening the instrument already open rebuilds its preview, as
  // production's inspect does: a preview that failed (its instrument
  // couldn't be read) is tried again through a lane's openInstrument, and a
  // ready one is rebuilt. Another instrument opens as before; a reopen of
  // anything but the open instrument does nothing.
  reopen: {
    opts: { hash: '#genre' },
    run: async (page) => {
      await waitMounted(page, 'genreinstruments');
      return inPage(page, async (S) => {
        const { recipe, R, E, instrument } = await S.boot();
        const ctx = window.__probeCtx.genreinstruments;
        const inst = E.Inst('udu');
        const parts = inst.parts;
        const state = () => {
          const a = S.acts(R);
          return [a.status, a.instrumentId, a.error && a.error.code, a.previewRevision];
        };
        Object.defineProperty(inst, 'parts', {
          configurable: true,
          get() {
            throw new Error('gate: an instrument that can’t be read');
          },
        });
        ctx.openInstrument('udu', { returnFocus: document.body });
        await S.settle(8);
        const failed = state();
        Object.defineProperty(inst, 'parts', { configurable: true, writable: true, value: parts });
        ctx.openInstrument('udu', { returnFocus: document.body });
        await S.settle(8);
        const again = state();
        ctx.openInstrument('udu', { returnFocus: document.body });
        await S.settle(8);
        const ready = state();
        const others = [recipe.reopen('oud'), recipe.reopen(null), state()[3] === ready[3]];
        ctx.openInstrument('oud', { returnFocus: document.body });
        await S.settle(8);
        return {
          failed,
          again,
          ready,
          others,
          oud: state(),
          selected: instrument.current(),
          hash: location.hash,
        };
      });
    },
    verdict: (g) =>
      why(
        same(g.failed.slice(0, 3), ['error', 'udu', 'LOAD_FAILED']) &&
          same(g.again.slice(0, 3), ['ready', 'udu', null]) &&
          g.again[3] > g.failed[3] &&
          same(g.ready.slice(0, 3), ['ready', 'udu', null]) &&
          g.ready[3] > g.again[3] &&
          same(g.others, [false, false, true]) &&
          same(g.oud.slice(0, 3), ['ready', 'oud', null]) &&
          g.selected === 'oud' &&
          g.hash === '#instrument',
        JSON.stringify(g)
      ),
  },
  // 36. A view nobody listens to isn't built when the recipe or the preview
  // changes: it is built once when read, and then at each change while it
  // has a listener. Counted on the environment view, whose sourceMessage
  // places a copy of the preview card ('__preview__') in the recipe.
  lazyViews: {
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      let cards = E.app.cards;
      let builds = 0;
      Object.defineProperty(E.app, 'cards', {
        configurable: true,
        enumerable: true,
        get: () => cards,
        set: (v) => {
          if (Array.isArray(v) && v.some((c) => c && c.id === '__preview__')) builds++;
          cards = v;
        },
      });
      const fx = E.CHAIN_SECTIONS[0].items.map((i) => i.id);
      const changes = async (room) => {
        await V.chain.choose({
          stage: 'fx',
          id: fx[1],
          on: true,
          revision: V.chain.snapshot().revision,
        });
        R.apply({ op: 'set_environment', room: E.ROOMS[room].id });
        await V.chain.choose({
          stage: 'fx',
          id: fx[1],
          on: false,
          revision: V.chain.snapshot().revision,
        });
      };
      await changes(5);
      const unread = builds;
      const first = V.environment.snapshot();
      const read = builds;
      const again = V.environment.snapshot();
      const reread = builds;
      let told = 0;
      const off = V.environment.subscribe(() => told++);
      await changes(6);
      const listened = builds;
      off();
      await changes(7);
      return {
        unread,
        read,
        reread,
        listened,
        unlistened: builds,
        told,
        same: first === again,
        message: typeof first.sourceMessage === 'string' && first.sourceMessage.length > 0,
      };
    },
    verdict: (g) =>
      why(
        g.unread === 0 &&
          g.read === 1 &&
          g.reread === 1 &&
          g.listened === 4 &&
          g.unlistened === 4 &&
          g.told >= 2 &&
          g.same &&
          g.message,
        JSON.stringify(g)
      ),
  },
  // 37. A lane's listeners end with its mount, whatever the lane keeps
  // (#770's mount returns a bare function and never unsubscribes): Genre
  // Instruments' recipe and genre listeners stop at its signal's abort, as
  // the host's unmount aborts it, and one added after the abort is never
  // added. The host gives context() that same signal before the lane has a
  // ctx, and aborts it when the context fails or the host is unmounted
  // while it loads.
  released: {
    opts: { hash: '#genre', init: { fn: KEEP_CONTROLLERS } },
    run: async (page) => {
      await waitMounted(page, 'genreinstruments');
      return inPage(page, async (S) => {
        const { R } = await S.boot();
        const sel = await import('/prototype/selection.js');
        const ctx = window.__probeCtx.genreinstruments;
        const mine = window.__controllers.find((c) => c.signal === ctx.signal);
        const heard = { recipe: 0, genre: 0 };
        const offRecipe = ctx.recipe.subscribe(() => heard.recipe++);
        ctx.genre.subscribe(() => heard.genre++);
        const change = async (g) => {
          await R.addInstrument({
            instrumentId: 'udu',
            destination: null,
            revision: R.snapshot().revision,
          });
          sel.genre.set(g);
          await S.settle();
        };
        await change('bluegrass');
        const live = { ...heard };
        let own = 0;
        const off = ctx.recipe.subscribe(() => own++);
        const offs = [off(), off()];
        if (mine) mine.abort();
        await change('afrobeat');
        const after = { ...heard };
        let late = 0;
        const offLate = ctx.recipe.subscribe(() => late++);
        ctx.genre.subscribe(() => late++);
        await change('gagaku');
        let threw = false;
        try {
          ctx.recipe.subscribe('not a function');
        } catch (e) {
          threw = e instanceof TypeError;
        }
        // The host's side, with fixture lanes: a context overtaken while it
        // loads, one that fails, and one that mounts.
        const { createHost } = await import('/prototype/host.js');
        const panel = document.createElement('section');
        panel.innerHTML = '<h1>Probe</h1>';
        document.body.append(panel);
        const url = URL.createObjectURL(
          new Blob(
            [
              'export function mount(h, ctx) { (window.__fixtureCtx = window.__fixtureCtx || []).push(ctx); return { unmount() {}, focus() {} }; }',
            ],
            { type: 'text/javascript' }
          )
        );
        const given = [];
        const lane = (id, context) => ({
          id,
          label: id,
          load: () => import(url),
          unloaded: 'x',
          context: (a) => {
            given.push(a && a.signal);
            return context();
          },
        });
        let release;
        const slow = createHost(
          lane('slowctx', () => new Promise((r) => (release = r))),
          panel
        );
        const showing = slow.show();
        // Its context has started (the lane's module loads first).
        for (let i = 0; i < 500 && !release; i++) await S.tick(10);
        slow.unmount();
        release({});
        await showing;
        await createHost(
          lane('failctx', () => Promise.reject(new Error('gate: a ctx that fails'))),
          panel
        ).show();
        const ok = createHost(
          lane('okctx', async () => ({})),
          panel
        );
        await ok.show();
        const mounted = (window.__fixtureCtx || [])[0];
        const host = {
          signals: given.map((x) => !!x && typeof x.aborted === 'boolean'),
          aborted: given.map((x) => !!x && x.aborted),
          same: !!mounted && mounted.signal === given[2],
        };
        ok.unmount();
        host.unmounted = !!given[2] && given[2].aborted;
        return {
          found: !!mine,
          live,
          after,
          final: { ...heard },
          own,
          offs,
          late,
          types: [typeof offRecipe, typeof offLate],
          threw,
          host,
        };
      });
    },
    verdict: (g) =>
      why(
        g.found &&
          g.live.recipe >= 1 &&
          g.live.genre === 1 &&
          same(g.after, g.live) &&
          same(g.final, g.live) &&
          g.own === 0 &&
          same(g.offs, [undefined, undefined]) &&
          g.late === 0 &&
          same(g.types, ['function', 'function']) &&
          g.threw &&
          same(g.host, {
            signals: [true, true, true],
            aborted: [true, true, false],
            same: true,
            unmounted: true,
          }),
        JSON.stringify(g)
      ),
  },
  // 39. One outcome is said once: a Reset whose rebuild fails is said by the
  // store and by a lane that says the preview's error (as #762 does), in the
  // same turn, and the person hears it once. The same sentence in a later
  // turn is said again, and two sentences in one turn are both said.
  saidOnce: {
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      const { announce } = await import('/prototype/host.js');
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      let shown = null;
      const off = V.configuration.subscribe(() => {
        const c = V.configuration.snapshot();
        if (c.status === 'error' && c.revision !== shown) {
          shown = c.revision;
          announce(c.error.message);
        }
      });
      await V.environment.choose({
        field: 'room',
        id: E.ROOMS[4].id,
        revision: V.environment.snapshot().revision,
      });
      await S.settle();
      S.said();
      const inst = E.Inst('oud');
      const parts = inst.parts;
      Object.defineProperty(inst, 'parts', {
        configurable: true,
        get() {
          throw new Error('gate: an instrument that can’t be read');
        },
      });
      const reset = await S.code(R.resetInstrumentPreview(S.args(R)));
      Object.defineProperty(inst, 'parts', { configurable: true, writable: true, value: parts });
      await S.settle();
      const once = S.said();
      off();
      announce('Gate: one.');
      await S.tick();
      announce('Gate: one.');
      await S.settle();
      const turns = S.said();
      announce('Gate: one.');
      announce('Gate: two.');
      await S.settle();
      return { reset, once, turns, sentences: S.said(), shown: shown !== null };
    },
    verdict: (g) =>
      why(
        g.reset === 'LOAD_FAILED' &&
          g.shown &&
          same(g.once, ['This instrument’s settings couldn’t be prepared.']) &&
          same(g.turns, ['Gate: one.', 'Gate: one.']) &&
          same(g.sentences, ['Gate: one.', 'Gate: two.']),
        JSON.stringify(g)
      ),
  },
  // 38. The preview's choices are remembered per instrument and replayed on
  // every rebuild: after a destination round trip, and after another
  // instrument is opened and this one again, the preview is the one chosen.
  replay: {
    page: async (S) => {
      const { R, V, E, instrument } = await S.boot();
      await R.addEnsemble({ genreId: 'bluegrass', revision: R.snapshot().revision });
      instrument.set('oud');
      await S.settle();
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      const seeded = S.project(V);
      await V.environment.choose({
        field: 'room',
        id: E.ROOMS[9].id,
        revision: V.environment.snapshot().revision,
      });
      await V.chain.choose({
        stage: 'fx',
        id: E.CHAIN_SECTIONS[0].items[2].id,
        on: true,
        revision: V.chain.snapshot().revision,
      });
      await V.character.choose({
        prefaceId: 'sermonizing',
        revision: V.character.snapshot().revision,
      });
      const c = V.configuration.snapshot();
      const part = c.parts.find((x) => x.variants.some((w) => w.id !== x.value));
      await V.configuration.choosePart({
        partId: part.id,
        variantId: part.variants.find((w) => w.id !== part.value).id,
        revision: c.revision,
      });
      const chosen = S.project(V);
      const changed = S.acts(R).changedCount;
      await R.setInstrumentDestination(S.args(R, { destination: null }));
      await S.settle();
      const loose = S.project(V);
      await R.setInstrumentDestination(S.args(R, { destination: 'bluegrass' }));
      await S.settle();
      const back = S.project(V);
      const backChanged = S.acts(R).changedCount;
      instrument.set('banjo_5_string');
      await S.settle();
      instrument.set('oud');
      await S.settle();
      const reopened = S.project(V);
      return { seeded, chosen, changed, loose, back, backChanged, reopened };
    },
    verdict: (g) =>
      why(
        !same(g.chosen, g.seeded) &&
          g.changed > 0 &&
          g.loose.room === g.chosen.room &&
          g.loose.preface === g.chosen.preface &&
          same(g.back, g.chosen) &&
          g.backChanged === g.changed &&
          same(g.reopened, g.chosen),
        JSON.stringify(g).slice(0, 900)
      ),
  },
  // 40. Every lane's subscriptions end with its mount (Don, #810 6682309672,
  // point 5). Each registered lane is mounted (the reader's two through
  // openReading), and a listener goes on every subscribe its ctx carries,
  // and on every CALLBACK_METHODS method (for speak, three utterances, each
  // ending with the listener): it hears a change while the lane is mounted,
  // none once the mount's signal aborts (as the host's unmount aborts it),
  // and one added after the abort never hears; nor is the device given
  // anything to say after the abort. Each lane's views carry exactly
  // CTX_VIEWS's methods, and the subscriptions found (SUBSCRIBED's, the
  // listener methods, and any method named as a subscription is) are exactly
  // SUBSCRIBED's, so a lane given a new one, by any name, can't go
  // unchecked.
  lanesReleased: {
    opts: { hash: '#genre', init: { fn: `(${KEEP_CONTROLLERS})();\n(${fakeSpeech})();` } },
    run: async (page) => {
      const routes = [
        ['#genre', ['genrecategories', 'genretargets', 'genredetail', 'genreinstruments']],
        ['#instrument', ['instrumentdetail']],
        ['#browse', ['browse']],
        ['#lyrics', ['lyrics']],
        ['#library', ['library', 'librarycredits', 'librarymethods']],
      ];
      for (const [hash, lanes] of routes) {
        await page.evaluate((h) => {
          location.hash = h;
        }, hash);
        for (const l of lanes) await waitMounted(page, l);
      }
      const cid = libData('catalog.json').shelves[0].cards[0][0];
      await page.evaluate((c) => window.__probeCtx.library.openReading(c), cid);
      for (const l of ['libraryreading', 'libraryspeech']) await waitMounted(page, l);
      return inPage(
        page,
        async (S, ARG) => {
          const { R } = await S.boot();
          const sel = await import('/prototype/selection.js');
          const { discovery } = await import('/prototype/app.js');
          const all = window.__probeCtx;
          // A method named as a subscription is (onResults, say).
          const LISTENING = /^(?:subscribe|on[A-Z]|listen|watch|observe)/;
          // A listener method as a subscribe: speak's, three utterances
          // that each end with the listener (one ends while the lane is
          // mounted, two wait behind it at the abort); refused, nothing.
          const AS_SUBSCRIBE = {
            'speech.speak': (speak) => (fn) => {
              const handles = [];
              try {
                for (const n of [1, 2, 3])
                  handles.push(speak(`gate ${n}`, { onend: () => fn(), onerror: () => fn() }));
              } catch {
                // An ended lane's speak() is refused.
              }
              return () => handles.forEach((h) => h.cancel());
            },
          };
          // Every method each lane's views carry (its object fields, the
          // host's storage and signal aside), as CTX_VIEWS pins them; and,
          // as 'field.method', every one that subscribes: SUBSCRIBED's,
          // every listener method, and any named as a subscription is.
          const views = {};
          const found = {};
          const subs = [];
          for (const lane of ARG.lanes) {
            views[lane] = {};
            found[lane] = [];
            const ctx = all[lane] || {};
            for (const field of Object.keys(ctx).sort()) {
              const v = ctx[field];
              if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
              if (field === 'storage' || field === 'signal') continue;
              views[lane][field] = Object.keys(v)
                .filter((k) => typeof v[k] === 'function')
                .sort();
              for (const k of views[lane][field]) {
                const name = `${field}.${k}`;
                if (ARG.callbacks.includes(name))
                  subs.push({ lane, name, subscribe: (AS_SUBSCRIBE[name] || (() => null))(v[k]) });
                else if (ARG.subscribed[lane].includes(name) || LISTENING.test(k))
                  subs.push({ lane, name, subscribe: v[k] });
                else continue;
                found[lane].push(name);
              }
            }
            found[lane].sort();
          }
          // A change that reaches each kind of subscription.
          let turn = 0;
          const genres = ['bluegrass', 'afrobeat', 'gagaku'];
          const instruments = ['oud', 'udu', 'banjo_5_string'];
          const CHANGES = {
            'genre.subscribe': () => sel.genre.set(genres[turn % 3]),
            'instrument.subscribe': () => sel.instrument.set(instruments[turn % 3]),
            'recipe.subscribe': async () => {
              for (let i = 0; i < 200 && R.snapshot().busy; i++) await S.tick(25);
              await R.addInstrument({
                instrumentId: 'udu',
                destination: null,
                revision: R.snapshot().revision,
              });
            },
            'categories.subscribe': () =>
              discovery.categories.toggleRoots(discovery.categories.current().revision),
            'targets.subscribe': () =>
              discovery.targets.toggleAll(discovery.targets.current().revision),
            'discovery.subscribe': () => {
              const d = discovery.discovery.current();
              return discovery.discovery.setOpen(!d.open, d.revision);
            },
            'selection.subscribe': () => all.library.selection.toggle(ARG.cid),
            'speech.subscribeVoices': () =>
              window.speechSynthesis.dispatchEvent(new Event('voiceschanged')),
            // The utterance with the device ends.
            'speech.speak': () => {
              const u = window.__speech.spoken[window.__speech.spoken.length - 1];
              if (u && u.onend) u.onend();
            },
          };
          const unknown = subs
            .filter((x) => !CHANGES[x.name] || typeof x.subscribe !== 'function')
            .map((x) => `${x.lane} ${x.name}`);
          const kinds = [...new Set(subs.map((x) => x.name))].filter((n) => CHANGES[n]);
          const failed = [];
          const round = async () => {
            turn++;
            for (const n of kinds) {
              const code = await S.code(Promise.resolve().then(CHANGES[n]));
              if (code !== 'ok') failed.push(`${n}: ${code}`);
            }
            await S.settle(8);
          };
          const heard = subs.map(() => 0);
          subs.forEach((x, i) => x.subscribe(() => heard[i]++));
          await round();
          const live = heard.slice();
          // Each mount ends: its signal aborts, as the host's unmount aborts it.
          const controllers = ARG.lanes.map((l) =>
            window.__controllers.find((c) => all[l] && c.signal === all[l].signal)
          );
          const spokenAtAbort = window.__speech.spoken.length;
          for (const c of controllers) if (c) c.abort();
          await round();
          const late = subs.map(() => 0);
          subs.forEach((x, i) => x.subscribe(() => late[i]++));
          await round();
          const named = (list) => list.map((i) => `${subs[i].lane} ${subs[i].name}`);
          const at = (test) => subs.map((_, i) => i).filter(test);
          return {
            views,
            found,
            unknown,
            failed,
            unmounted: ARG.lanes.filter((l, i) => !controllers[i]),
            deaf: named(at((i) => !live[i])),
            kept: named(at((i) => heard[i] !== live[i])),
            late: named(at((i) => late[i] > 0)),
            spokenAfterAbort: window.__speech.spoken.slice(spokenAtAbort).map((u) => u.text),
          };
        },
        { lanes: Object.keys(SUBSCRIBED), cid, callbacks: CALLBACK_METHODS, subscribed: SUBSCRIBED }
      );
    },
    verdict: (g) =>
      why(
        same(Object.keys(SUBSCRIBED).sort(), Object.keys(LANE_MODULES).sort()) &&
          same(g.views, CTX_VIEWS) &&
          same(g.found, SUBSCRIBED) &&
          !g.unknown.length &&
          !g.failed.length &&
          !g.unmounted.length &&
          !g.deaf.length &&
          !g.kept.length &&
          !g.late.length &&
          same(g.spokenAfterAbort, []),
        JSON.stringify(g).slice(0, 900)
      ),
  },
};

// One planted defect (at least) for every check: text edits to
// prototype/recipe-store.js (STORE_MUTANTS) or prototype/engine/load.js
// (LOAD_MUTANTS), served in that check's own page in place of the file.
const STORE_MUTANTS = {
  'no baseline entry': {
    check: 'baseline',
    edits: [
      [
        '    E.app._addToTradition = null;\n    E.pushHistory();\n    tables();',
        '    E.app._addToTradition = null;\n    tables();',
      ],
    ],
  },
  'an entry per ensemble card': {
    check: 'entries',
    edits: [
      [
        '          created = E.importTradition(id);',
        '          created = (trad.instruments || []).map((i) => E.addCard(i, E.traditionCardOpts(id, i))).filter(Boolean);',
      ],
    ],
  },
  'addInstrument ignores its destination': {
    check: 'parity',
    edits: [
      [
        'return addCard(instrumentId, dest || null, null)',
        'return addCard(instrumentId, null, null)',
      ],
    ],
  },
  'no revision check in addEnsemble': {
    check: 'staleRevision',
    edits: [
      [
        "    if (rev !== revision)\n      return refuse(fail('STALE', M.STALE_ADD(`${genreName(genreId)}’s ensemble`)));\n",
        '',
      ],
    ],
  },
  'no previewRevision check in addConfiguredInstrument': {
    check: 'stalePreview',
    edits: [
      [
        '    const e = actionGuard(args);\n    if (e)\n      return refuse(',
        '    const e = actionGuard({ ...args, previewRevision: pv.revision });\n    if (e)\n      return refuse(',
      ],
    ],
  },
  'busy cleared before the wait': {
    check: 'busyEdit',
    edits: [
      [
        '    setBusy(true);\n    return E.Catalog.ensureFull(id).then(',
        '    setBusy(true);\n    busy = false;\n    return E.Catalog.ensureFull(id).then(',
      ],
    ],
  },
  'plain Add refused while the preview rebuilds': {
    check: 'busyPreview',
    edits: [
      [
        "    if (busy) return refuse(fail('BUSY', M.BUSY_ADD(name)));",
        "    if (busy || pv.state === 'loading') return refuse(fail('BUSY', M.BUSY_ADD(name)));",
      ],
    ],
  },
  'previewRevision moved only after the wait': {
    check: 'safeguard3',
    edits: [
      [
        "    pv.state = 'loading';\n    pv.error = null;\n    pv.revision++;\n",
        "    pv.state = 'loading';\n    pv.error = null;\n",
      ],
    ],
  },
  'configure reads the live preview': {
    check: 'capture',
    edits: [
      [
        'const configure = captured ? (c) => Object.assign(c, clone(captured)) : null;',
        'const configure = captured ? (c) => Object.assign(c, clone({ parts: pv.card.parts, pinnedParts: pv.card.pinnedParts || [], preface: pv.card.preface, prefaceAuto: pv.card.prefaceAuto, tuning: pv.card.tuning, room: pv.card.room, chain: pv.card.chain })) : null;',
      ],
    ],
  },
  'the configured add configured after its history entry': {
    check: 'capture',
    edits: [
      [
        '      card = await E.addInstrumentFromPicker(id, configure ? { configure } : undefined);',
        '      card = await E.addInstrumentFromPicker(id);\n      if (card && configure) configure(card);',
      ],
    ],
  },
  'one traditionCardOpts for both seeds': {
    check: 'aliasing',
    edits: [['b = E.traditionCardOpts(dest, id) || undefined;', 'b = a;']],
  },
  'no applyPartEdit on a part choice': {
    check: 'configuration',
    edits: [['      E.applyPartEdit(card, e.part, { quiet: true });\n', '']],
  },
  'the category glyph taken from the entry': {
    check: 'character',
    edits: [
      [
        'glyph: { category, entry: svgUrl(E.prefaceGlyphsHTML(e, 15, true)) },',
        'glyph: { category: svgUrl(E.prefaceGlyphsHTML(e, 15, true)), entry: svgUrl(E.prefaceGlyphsHTML(e, 15, true)) },',
      ],
    ],
  },
  'the Compact clause always at 1000': {
    check: 'environment',
    edits: [
      ['const limit = ceiling || E.RECIPE_CHAR_CEILING;', 'const limit = E.RECIPE_CHAR_CEILING;'],
    ],
  },
  'an effect added first': {
    check: 'chain',
    edits: [['v: [...now, id] }', 'v: [id, ...now] }']],
  },
  'no execCommand fallback': {
    check: 'output',
    edits: [["const ok = document.execCommand('copy');", 'const ok = false;']],
  },
  // Each fallback route on its own: a refused write, and a clipboard that
  // throws at once.
  'a refused write not sent to the fallback': {
    check: 'output',
    edits: [
      [
        'navigator.clipboard.writeText(text).then(() => finish(true), fallbackCopy);',
        'navigator.clipboard.writeText(text).then(() => finish(true), () => finish(false));',
      ],
    ],
  },
  'a throwing clipboard not sent to the fallback': {
    check: 'output',
    edits: [
      [
        '          } catch {\n            fallbackCopy();\n          }',
        '          } catch {\n            finish(false);\n          }',
      ],
    ],
  },
  // What was copied, and a write the browser took (#810, the review of
  // 6682309672's fixes): each copy route copies the output's own text, and a
  // granted write says it copied.
  'the fallback copies nothing': {
    check: 'output',
    edits: [['              ta.value = text;', "              ta.value = '';"]],
  },
  'the clipboard written with nothing': {
    check: 'output',
    edits: [
      [
        'navigator.clipboard.writeText(text).then(() => finish(true), fallbackCopy);',
        "navigator.clipboard.writeText('').then(() => finish(true), fallbackCopy);",
      ],
    ],
  },
  'a granted write said as a failure': {
    check: 'output',
    edits: [
      [
        'navigator.clipboard.writeText(text).then(() => finish(true), fallbackCopy);',
        'navigator.clipboard.writeText(text).then(() => finish(false), fallbackCopy);',
      ],
    ],
  },
  'the grouped sentence whatever happened': {
    check: 'announcements',
    edits: [
      [
        '        card.traditionId || !dest\n          ? E._addedInstrumentMessage(instrumentId, card)\n          : `Added ${name} as an independent instrument (${genreName(dest)} couldn’t be loaded)`',
        '        !dest\n          ? E._addedInstrumentMessage(instrumentId, card)\n          : `Added ${name} to ${genreName(dest)}`',
      ],
    ],
  },
  'no fallback to Independent': {
    check: 'destination',
    edits: [
      ['if (destination && !groups().some((g) => g.genreId === destination)) {', 'if (false) {'],
    ],
  },
  'snapshots not frozen': {
    check: 'immutability',
    edits: [['snaps[view] = freeze(make());', 'snaps[view] = make();']],
  },
  'no reset at start': {
    check: 'ownership',
    edits: [['    E.app.cards = [];\n    E.app.history = [];\n    E.app.historyIndex = -1;\n', '']],
  },
  'no claim guard': {
    check: 'ownership',
    edits: [
      ["    if (claimed.has(engine) && engine !== held) throw fail('CLAIMED', M.CLAIMED);\n", ''],
    ],
  },
  'apply on every recipe view': {
    check: 'surfaces',
    edits: [
      [
        "    return Object.freeze(out);\n  }\n\n  // The shell's openInstrument",
        "    out.apply = recipe.apply;\n    return Object.freeze(out);\n  }\n\n  // The shell's openInstrument",
      ],
    ],
  },
  'changed always true': {
    check: 'apply',
    edits: [
      [
        '    return { ok: true, changed: commit(before) };',
        '    commit(before);\n    return { ok: true, changed: true };',
      ],
    ],
  },
  'the old card named in the hand-over': {
    check: 'handover',
    edits: [
      [
        'const from = `${instrumentName(card.instrumentId)} (${',
        'const from = `${instrumentName(prev.card.instrumentId)} (${',
      ],
    ],
  },
  'pending commands settle only on a ready rebuild': {
    check: 'settles',
    edits: [
      [
        "    if (pv.state === 'error') {\n      announce(pv.error.message);",
        "    if (pv.state === 'error') {\n      return void pv.waiting.push(...list);\n      announce(pv.error.message);",
      ],
    ],
  },
  'the note kept across a rebuild': {
    check: 'note',
    edits: [
      ['    pv.note = null;\n    pv.base = pv.card = null;', '    pv.base = pv.card = null;'],
    ],
  },
  'the fallback moves previewRevision': {
    check: 'noInstrument',
    edits: [
      [
        '      if (pv.instrumentId) rebuild();',
        '      if (pv.instrumentId) rebuild();\n      else (pv.revision++, touchPreview(), flush());',
      ],
    ],
  },
  'addGenre without starting the store': {
    check: 'addGenre',
    edits: [
      [
        '    start().then(\n      () => {\n        if (busy) return announce(M.BUSY_GENRE);\n        ensemble(id).catch(() => {}); // announced already\n      },\n      () => announce(M.LOAD_FAILED)\n    );',
        '    if (busy) return announce(M.BUSY_GENRE);\n    ensemble(id).catch(() => {});',
      ],
    ],
  },
  'subscribed to the selection at construction': {
    check: 'selection',
    edits: [['  // ── Boot ──', '  selection.subscribe(() => rebuild());\n  // ── Boot ──']],
  },
  'an Undo that restores nothing still succeeds': {
    check: 'undoFails',
    edits: [
      [
        "    if (E.app.historyIndex === at) {\n      const r = no(back ? 'UNDO_FAILED' : 'REDO_FAILED');\n      announce(r.refusal);\n      return r;\n    }\n",
        '',
      ],
    ],
  },
  'a failed Undo or Redo is said nowhere': {
    check: 'undoFails',
    edits: [['      announce(r.refusal);\n      return r;\n', '      return r;\n']],
  },
};
// The guards check's defects, among the store's.
Object.assign(STORE_MUTANTS, {
  'previewIs ignores the revision': {
    check: 'guards',
    edits: [
      [
        'pv.instrumentId === instrumentId && pv.revision === previewRevision,',
        'pv.instrumentId === instrumentId,',
      ],
    ],
  },
  'any destination accepted': {
    check: 'guards',
    edits: [
      [
        "    if (!destinations().some((d) => d.genreId === dest))\n      return refuse(fail('INVALID', M.BAD_DESTINATION));\n",
        '',
      ],
    ],
  },
  'the configured add takes any destination': {
    check: 'guards',
    edits: [
      [
        "    if ((args.destination === undefined ? null : args.destination) !== destination)\n      return refuse(fail('INVALID', M.BAD_DESTINATION));\n",
        '',
      ],
    ],
  },
});
// remove_tradition's genre guard, among apply's.
STORE_MUTANTS['remove_tradition takes a genre that isn’t an id'] = {
  check: 'apply',
  edits: [["      if (typeof edit.tradition !== 'string') return no('INVALID');\n", '']],
};
// The reopen check's defects.
STORE_MUTANTS['reopen rebuilds nothing'] = {
  check: 'reopen',
  edits: [
    [
      '    if (instrumentId !== selection.current() || instrumentId !== pv.instrumentId) return false;\n    rebuild();\n    return true;',
      '    if (instrumentId !== selection.current() || instrumentId !== pv.instrumentId) return false;\n    return true;',
    ],
  ],
};
// The review's planted defects (finding 3): each must fail the check named.
Object.assign(STORE_MUTANTS, {
  'the configured add drops the pins': {
    check: 'capture',
    edits: [['          pinnedParts: card.pinnedParts || [],\n', '          pinnedParts: [],\n']],
  },
  'the configured add drops the chosen character': {
    check: 'capture',
    edits: [['          preface: card.preface,\n          prefaceAuto: card.prefaceAuto,\n', '']],
  },
  'set_environment with no card writes the first card': {
    check: 'apply',
    edits: [
      [
        "const c = 'card' in edit ? cardOf(edit.card) : E.envCardOf(E.app.cards);",
        "const c = 'card' in edit ? cardOf(edit.card) : E.app.cards[0];",
      ],
    ],
  },
  'set_variant takes any variant id': {
    check: 'apply',
    edits: [
      [
        "      if (!part || (v !== null && !E.Variant(inst, part.id, v))) return no('INVALID');",
        "      if (!part) return no('INVALID');",
      ],
    ],
  },
  'clear empties a list stage to null': {
    check: 'apply',
    edits: [
      [
        'writes.push(() => (c.chain[stage] = stageOf(stage).multiSelect ? [] : null));',
        'writes.push(() => (c.chain[stage] = null));',
      ],
    ],
  },
  'a list stage shares the caller’s array': {
    check: 'apply',
    edits: [
      [
        'writes.push(() => (c.chain[stage] = v.slice()));',
        'writes.push(() => (c.chain[stage] = v));',
      ],
    ],
  },
  // (Dropping Back to automatic's own suggestion changes nothing: the
  // engine's history entry re-derives every automatic card's character.)
  'Back to automatic leaves the card manual': {
    check: 'apply',
    edits: [
      [
        '        c.prefaceAuto = true;\n        c.preface = E.suggestPrefaceForCard(c);\n        E.pushHistory();',
        '        c.preface = E.suggestPrefaceForCard(c);\n        E.pushHistory();',
      ],
    ],
  },
  'remove_tradition takes a genre not in the recipe': {
    check: 'apply',
    edits: [
      [
        "      if (!ids.length) return no('NOT_FOUND');\n      for (const id of ids) E.rmCard(id, { skipHistory: true });",
        '      for (const id of ids) E.rmCard(id, { skipHistory: true });',
      ],
    ],
  },
  'preview choices not remembered': {
    check: 'replay',
    edits: [['    editsOf(pv.instrumentId).push(e);\n', '']],
  },
  'choices not replayed on a rebuild': {
    check: 'replay',
    edits: [['      for (const e of editsOf(id)) applyEdit(pv.card, e);\n', '']],
  },
  'addGenre without its busy guard': {
    check: 'addGenre',
    edits: [['        if (busy) return announce(M.BUSY_GENRE);\n', '']],
  },
  'Undo does not move the revision': {
    check: 'staleRevision',
    edits: [['    revision++;\n    const said = handover();', '    const said = handover();']],
  },
  'no STALE on a preview choice': {
    check: 'stalePreview',
    edits: [
      [
        "    if (a.revision !== pv.revision) return Promise.reject(fail('STALE', M.STALE_CHOICE));\n",
        '',
      ],
    ],
  },
  'choosePart takes any variant id': {
    check: 'stalePreview',
    edits: [
      [
        '        if (!part || (v !== null && !(part.variants || []).some((x) => x.id === v))) return false;',
        '        if (!part) return false;',
      ],
    ],
  },
  'no BUSY on a preview choice while it loads': {
    check: 'busyPreview',
    edits: [
      ["    if (pv.state !== 'ready') return Promise.reject(fail('BUSY', M.BUSY_CHOICE));\n", ''],
    ],
  },
  'views told in reverse order': {
    check: 'immutability',
    edits: [
      [
        '    const changed = VIEWS.filter((v) => unsent.delete(v));',
        '    const changed = VIEWS.filter((v) => unsent.delete(v)).reverse();',
      ],
    ],
  },
  'apply skips the destination fallback': {
    check: 'destination',
    edits: [
      [
        "    const said = handover();\n    fallback();\n    touch('recipe', 'environment');\n    flush();\n    if (said) announce(said);\n    return changed;",
        "    const said = handover();\n    touch('recipe', 'environment');\n    flush();\n    if (said) announce(said);\n    return changed;",
      ],
    ],
  },
});
// The environment check's defects: the preview not placed in its genre's
// run; Compact's clause decided by counting lines, which a cut render's
// "[truncated]" line fools; and by an environment label found anywhere in
// the text, which a room named like part of a card's own line fools (#810
// 6682309672, D4).
Object.assign(STORE_MUTANTS, {
  'sourceMessage never places the preview in its genre': {
    check: 'environment',
    edits: [
      ['      if (copy.traditionId) E._placeCardAfterTraditionRun(copy, copy.traditionId);\n', ''],
    ],
  },
  'the Compact clause counted by lines': {
    check: 'environment',
    edits: [['        ? lines[lines.length - 1] === env\n', '        ? true\n']],
  },
  // One card on one line: that line ends with the environment, or the
  // environment was dropped (aloneLong).
  'the Compact clause for one card counted by lines': {
    check: 'environment',
    edits: [
      [
        '        : after.length === 1 && lines.length === 1 && text.endsWith(` · ${env}`);',
        '        : after.length === 1 && lines.length === 1;',
      ],
    ],
  },
  // ...and read by any " · " in it, the gate's own rule before (#810, the
  // review of 6682309672's fixes): aloneNamed's instrument has one.
  'the Compact clause for one card read from any " · "': {
    check: 'environment',
    edits: [['text.endsWith(` · ${env}`);', "text.includes(' · ');"]],
  },
  'the Compact clause found anywhere in the text': {
    check: 'environment',
    edits: [
      [
        '    const written =\n      lines.length === after.length + 1\n        ? lines[lines.length - 1] === env\n        : after.length === 1 && lines.length === 1 && text.endsWith(` · ${env}`);',
        "    const written = env.slice(0, -1).split(' · ').some((label) => text.includes(label));",
      ],
    ],
  },
});
// The lazy views check's defect.
STORE_MUTANTS['every view built at every change'] = {
  check: 'lazyViews',
  edits: [
    [
      '    for (const v of VIEWS) if (listeners[v].size && dirty.delete(v)) build(v);',
      '    for (const v of VIEWS) if (dirty.delete(v)) build(v);',
    ],
  ],
};
// The throwing-add check's defects.
Object.assign(STORE_MUTANTS, {
  'an ensemble whose engine call throws leaves the store busy': {
    check: 'throwingAdd',
    edits: [
      [
        "        let created;\n        try {\n          created = E.importTradition(id);\n        } catch {\n          failed(before, undo);\n          return refuse(fail('LOAD_FAILED', M.GENRE_FAILED(trad.name)));\n        }\n",
        '        const created = E.importTradition(id);\n',
      ],
    ],
  },
  'the cards a failed add made are kept': {
    check: 'throwingAdd',
    edits: [['      if (now.every((x, i) => x === at[i])) E.app.cards = cards;\n', '']],
  },
  'an add whose engine call throws comes out raw': {
    check: 'throwingAdd',
    edits: [
      [
        "    } catch {\n      E.app._addToTradition = null;\n      failed(before, undo);\n      const e = fail('LOAD_FAILED', M.ADD_FAILED(instrumentName(id)));\n      announce(e.message);\n      throw e;\n    }",
        '    } catch (e) {\n      E.app._addToTradition = null;\n      setBusy(false);\n      throw e;\n    }',
      ],
    ],
  },
});
const LOAD_MUTANTS = {
  'loadEngine waits on CATALOG_READY itself': {
    check: 'retry',
    edits: [['  await bootCatalog(engine);', '  await engine.CATALOG_READY;']],
  },
};
const DATA_MUTANTS = {
  'the roster reversed': {
    check: 'roster',
    edits: [
      [
        '      (t.instruments || []).map((i) =>',
        '      (t.instruments || []).slice().reverse().map((i) =>',
      ],
    ],
  },
};
const APP_MUTANTS = {
  'the recipe line never rewritten': {
    check: 'countLine',
    edits: [['shellRecipe.subscribe(writeRecipeLine);\n', '']],
  },
  'no retryHint on the genre instruments': {
    check: 'genreHost',
    edits: [
      [
        "      unloaded: 'The genre’s instruments did not load.',\n      // As for the discovery lanes: the store's load also fails on the\n      // engine's page parse, which no connection fixes.\n      retryHint: 'Try again.',\n",
        "      unloaded: 'The genre’s instruments did not load.',\n",
      ],
    ],
  },
  'openInstrument leaves the open instrument as it is': {
    check: 'reopen',
    edits: [
      [
        "  if (typeof id === 'string' && id && id === instrument.current()) recipe.reopen(id);\n  else instrument.set(id);",
        '  instrument.set(id);',
      ],
    ],
  },
  'the genre instruments recipe view outlives its mount': {
    check: 'released',
    edits: [['          recipe: ending(signal, port),', '          recipe: port,']],
  },
  'the genre instruments genre selection outlives its mount': {
    check: 'released',
    edits: [
      [
        '          genre: ending(signal, { current: genre.current, subscribe: genre.subscribe }),\n          loadGenreInstruments,',
        '          genre: Object.freeze({ current: genre.current, subscribe: genre.subscribe }),\n          loadGenreInstruments,',
      ],
    ],
  },
  // Every other lane's subscriptions (lanesReleased), one bypassed at a
  // time, and ending itself ending nothing.
  'the genre detail selection outlives its mount': {
    check: 'lanesReleased',
    edits: [
      [
        '    genre: ending(signal, { current: genre.current, subscribe: genre.subscribe }),\n    loadGenre: genres.loadGenre,',
        '    genre: Object.freeze({ current: genre.current, subscribe: genre.subscribe }),\n    loadGenre: genres.loadGenre,',
      ],
    ],
  },
  'the instrument detail selection outlives its mount': {
    check: 'lanesReleased',
    edits: [
      [
        '    instrument: ending(signal, { current: instrument.current, subscribe: instrument.subscribe }),',
        '    instrument: Object.freeze({ current: instrument.current, subscribe: instrument.subscribe }),',
      ],
    ],
  },
  'the categories store outlives its mount': {
    check: 'lanesReleased',
    edits: [
      [
        '        categories: ending(signal, discovery.categories),',
        '        categories: discovery.categories,',
      ],
    ],
  },
  'the categories lane’s disclosure outlives its mount': {
    check: 'lanesReleased',
    edits: [
      [
        '        categories: ending(signal, discovery.categories),\n        discovery: ending(signal, discovery.discovery),',
        '        categories: ending(signal, discovery.categories),\n        discovery: discovery.discovery,',
      ],
    ],
  },
  'the categories lane’s targets outlive its mount': {
    check: 'lanesReleased',
    edits: [
      [
        '        targets: ending(signal, {\n          current: discovery.targets.current,',
        '        targets: Object.freeze({\n          current: discovery.targets.current,',
      ],
    ],
  },
  'Find a sound’s targets outlive its mount': {
    check: 'lanesReleased',
    edits: [
      [
        '        targets: ending(signal, discovery.targets),',
        '        targets: discovery.targets,',
      ],
    ],
  },
  'Find a sound’s disclosure outlives its mount': {
    check: 'lanesReleased',
    edits: [
      [
        '        targets: ending(signal, discovery.targets),\n        discovery: ending(signal, discovery.discovery),',
        '        targets: ending(signal, discovery.targets),\n        discovery: discovery.discovery,',
      ],
    ],
  },
  'the Library selection outlives its mount': {
    check: 'lanesReleased',
    edits: [['    selection: ending(signal, selection),', '    selection,']],
  },
  'read-aloud’s voices outlive its mount': {
    check: 'lanesReleased',
    edits: [["    ...ending(signal, speech, 'subscribeVoices'),", '    ...speech,']],
  },
  // Read-aloud's speech (speaking): the whole wrapper gone, as before the
  // review of 6682309672's fixes; the queued utterances cancelled after the
  // one with the device, so each starts; and a speak() after the abort taken.
  'read-aloud’s speech outlives its mount': {
    check: 'lanesReleased',
    edits: [
      [
        '          speech: speaking(signal, speechAdapter({ autoplay: play })),',
        "          speech: ending(signal, speechAdapter({ autoplay: play }), 'subscribeVoices'),",
      ],
    ],
  },
  'read-aloud’s queued utterances start at the abort': {
    check: 'lanesReleased',
    edits: [
      [
        '      for (const h of [...live].reverse()) h.cancel();',
        '      for (const h of [...live]) h.cancel();',
      ],
    ],
  },
  'read-aloud speaks for an ended lane': {
    check: 'lanesReleased',
    edits: [
      [
        "      if (signal.aborted)\n        throw Object.assign(new Error('Read aloud has ended.'), { code: 'ENDED' });\n",
        '',
      ],
    ],
  },
  // A subscription inside a view under a name of its own (the review of
  // 6682309672's fixes): one named as subscriptions are, and one not.
  'a subscription named onResults inside a view': {
    check: 'lanesReleased',
    edits: [
      [
        '        targets: ending(signal, discovery.targets),\n        discovery: ending(signal, discovery.discovery),',
        '        targets: ending(signal, discovery.targets),\n        discovery: ending(signal, {\n          ...discovery.discovery,\n          onResults: discovery.results.subscribe,\n        }),',
      ],
    ],
  },
  'a subscription by another name inside a view': {
    check: 'lanesReleased',
    edits: [
      [
        '        targets: ending(signal, discovery.targets),\n        discovery: ending(signal, discovery.discovery),',
        '        targets: ending(signal, { ...discovery.targets, results: discovery.results.subscribe }),\n        discovery: ending(signal, discovery.discovery),',
      ],
    ],
  },
  'ending ends nothing': {
    check: 'lanesReleased',
    edits: [
      [
        '  Object.freeze({ ...view, [key]: untilAborted(view[key], signal) });',
        '  Object.freeze({ ...view });',
      ],
    ],
  },
  'openInstrument without the route': {
    check: 'genreHost',
    edits: [["  if (routeFromHash() !== 'instrument') location.hash = '#instrument';\n", '']],
  },
};

const HOST_SHELL_MUTANTS = {
  'a context given another signal than its mount': {
    check: 'released',
    edits: [
      [
        'extra = (await lane.context({ signal: mine.signal })) || {};',
        'extra = (await lane.context({ signal: new AbortController().signal })) || {};',
      ],
    ],
  },
  'a failed context keeps its signal': {
    check: 'released',
    edits: [
      [
        '    } catch {\n      mine.abort();\n      if (host !== node) return;',
        '    } catch {\n      if (host !== node) return;',
      ],
    ],
  },
  'an overtaken context keeps its signal': {
    check: 'released',
    edits: [
      [
        '    if (host !== node) {\n      mine.abort();\n      return;',
        '    if (host !== node) {\n      return;',
      ],
    ],
  },
  'the same sentence said twice in one turn': {
    check: 'saidOnce',
    edits: [['  if (sentence === saidNow) return;\n', '']],
  },
  'a sentence never said again': {
    check: 'saidOnce',
    edits: [['    if (saidNow === sentence) saidNow = null;\n', '']],
  },
  'a listener kept after the abort': {
    check: 'released',
    edits: [["    signal.addEventListener('abort', end, { once: true });\n", '']],
  },
};

// Runs one check in its own page (and any further pages it opens), with the
// store and load.js as served (`served.store`, `served.load`: the planted
// text, or undefined for the committed file). Returns its verdict and the
// page errors it didn't expect.
async function storeRun(browser, srv, name, prod, served = {}) {
  const check = STORE_CHECKS[name];
  const opts = check.opts || {};
  const pages = [];
  const open = async () => {
    const x = await storePage(browser, srv, {
      served,
      routes: opts.routes,
      permissions: opts.permissions,
      fail: opts.fail,
      init: opts.init,
    });
    x.urls = [];
    x.page.on('request', (r) => x.urls.push(new URL(r.url()).pathname));
    pages.push(x);
    await x.page.goto(`${srv.url}/prototype/${opts.hash || '#map'}`);
    return x;
  };
  let verdict;
  try {
    const first = await open();
    const ctx = {
      fresh: async () => (await open()).page,
      requested: () => first.urls,
      unfail: (p) => first.failing.delete(p),
    };
    const got = check.run
      ? await check.run(first.page, prod, ctx)
      : await inPage(first.page, check.page, check.arg ? check.arg(prod) : null);
    verdict = check.verdict(got, prod);
  } catch (e) {
    verdict = `threw: ${(e && e.message) || e}`.slice(0, 600);
  }
  const all = pages.flatMap((x) => x.errors);
  const wanted = check.errors || [];
  const errors = all.filter((e) => !wanted.some((w) => e.includes(w)));
  const missing = wanted.filter((w) => !all.some((e) => e.includes(w)));
  for (const x of pages) await x.context.close();
  return { verdict, errors, missing };
}

// A few checks at a time, each in its own browser context.
async function pooled(items, size, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return out;
}

let storePlanted = 0;
let storeDefects = 0;
async function recipeChecks(browser, srv) {
  expect(hasStore, 'recipe store: prototype/recipe-store.js is missing');
  if (!hasStore) return;
  const prodRun = await storeProduction(browser, srv);
  expect(
    !prodRun.errors.length,
    `recipe store: codex.html raised errors: ${prodRun.errors.join(' | ')}`
  );
  const p = prodRun.got;
  // Production's Copy under the clipboards the output check gives the store.
  // Production's copyToClipboard doesn't catch a writeText that throws at
  // once, so for a throwing one it says nothing; its own fallback, which the
  // store's runs then, is what it says with no clipboard API.
  p.copy = {
    granted: await productionCopy(browser, srv, { clipboard: 'resolve' }),
    denied: await productionCopy(browser, srv, { clipboard: 'reject' }),
    throwing: await productionCopy(browser, srv, { clipboard: 'throw' }),
    none: await productionCopy(browser, srv, { clipboard: 'none' }),
  };
  if (p.copy.throwing.threw && !p.copy.throwing.toasts.length) p.copy.throwing = p.copy.none;
  // What the output check relies on: production's fallback copies in this
  // browser, and each route copies the text it was given, so a store whose
  // fallback never copies, or copies something else, says otherwise. (A
  // browser whose execCommand('copy') can't copy fails here, not silently.)
  expect(
    ['granted', 'denied', 'throwing'].every((k) => p.copy[k].toasts.length === 1) &&
      copySaid(p.copy.granted) === 'Copied' &&
      copySaid(p.copy.denied) === 'Copied' &&
      copySaid(p.copy.throwing) === 'Copied' &&
      ['granted', 'denied', 'throwing'].every((k) => same(p.copy[k].copied, ['gate text'])),
    `recipe store: codex.html's Copy and its fallback don't both copy here: ${JSON.stringify(p.copy)}`
  );
  // The production sequences did what the checks rely on.
  expect(
    same(p.toasts.genre, ['Imported Bluegrass']) &&
      p.toasts.partial.length === 1 &&
      /^Imported \d+\/\d+ instruments from "/.test(p.toasts.partial[0]) &&
      /has no recognised instruments$/.test(p.toasts.none[0]),
    `recipe store: codex.html's ensemble toasts are not the full, partial and none cases: ${JSON.stringify(p.toasts).slice(0, 400)}`
  );
  expect(
    p.handover.filter(([, t]) => t).length >= 3,
    `recipe store: codex.html's hand-over sequence says too little: ${JSON.stringify(p.handover)}`
  );
  // The environment check's aloneNamed case is what it is there to be: at
  // 150 and 100 the render is one line with a " · " in it, and the gate's
  // reference says the environment line is dropped.
  expect(
    [150, 100].every((c) => {
      const text = p.dottedRenders[c];
      return (
        typeof text === 'string' &&
        !text.includes('\n') &&
        text.includes(' · ') &&
        / the environment line is dropped /.test(p.sources.aloneNamed[`${c}:compact`])
      );
    }) && !Object.values(p.sources).some((s) => Object.values(s).some((t) => /^gate: /.test(t))),
    `recipe store: codex.html's environment cases don't hold the gate's rule: ${JSON.stringify(p.dottedRenders)}`
  );

  const names = Object.keys(STORE_CHECKS);
  const results = await pooled(names, 4, (n) => storeRun(browser, srv, n, p));
  names.forEach((n, i) => {
    const r = results[i];
    expect(r.verdict === true, `recipe store: ${n}: ${r.verdict}`);
    expect(!r.errors.length, `recipe store: ${n}: uncaught errors: ${r.errors.join(' | ')}`);
    expect(
      !r.missing.length,
      `recipe store: ${n}: the page never reported ${r.missing.join(', ')}`
    );
  });

  // Every check has a planted defect of its own, and each must fail it.
  const mutants = [
    ...Object.entries(STORE_MUTANTS).map(([m, d]) => ({ m, ...d, file: 'store', text: STORE_JS })),
    ...Object.entries(LOAD_MUTANTS).map(([m, d]) => ({ m, ...d, file: 'load', text: LOAD_JS })),
    ...Object.entries(DATA_MUTANTS).map(([m, d]) => ({ m, ...d, file: 'data', text: DATA_JS })),
    ...Object.entries(APP_MUTANTS).map(([m, d]) => ({ m, ...d, file: 'app', text: APP_JS })),
    ...Object.entries(HOST_SHELL_MUTANTS).map(([m, d]) => ({
      m,
      ...d,
      file: 'host',
      text: HOST_JS,
    })),
  ];
  expect(
    new Set(mutants.map((x) => x.m)).size === mutants.length,
    'recipe store: two planted defects share a name'
  );
  const planting = new Set(mutants.map((x) => x.check));
  for (const n of names)
    expect(planting.has(n), `recipe store: the ${n} check has no planted defect`);
  for (const x of mutants)
    expect(
      names.includes(x.check),
      `recipe store: the planted defect "${x.m}" names no check (${x.check})`
    );
  storeDefects = mutants.length;
  const outcomes = await pooled(mutants, 4, async (x) => {
    const src = plantIn(x.text, x.edits);
    if (!src) return { applies: false };
    const r = await storeRun(browser, srv, x.check, p, { [x.file]: src });
    return { applies: true, verdict: r.verdict };
  });
  mutants.forEach((x, i) => {
    const o = outcomes[i];
    expect(
      o.applies,
      `recipe store: the planted defect "${x.m}" no longer applies to ${SERVED[x.file].slice('/prototype/'.length)}`
    );
    if (!o.applies) return;
    expect(
      o.verdict !== true,
      `recipe store: with the planted defect "${x.m}", the ${x.check} check still passes`
    );
    if (o.verdict !== true) storePlanted++;
  });
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
    await readerChecks(browser, srv);
    await startChecks(browser, srv);
    await unmounting(browser, srv);
    await closing(browser, srv);
    await recipeChecks(browser, srv);
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
    `check_prototype_hosts: ${checks}/${checks} checks pass; ${planted + storePlanted + readerPlanted + startPlanted}/${ALL_MUTANTS.length + storeDefects + READER_DEFECTS + START_DEFECTS} planted defects fail their checks (${planted}/${ALL_MUTANTS.length} in host.js, ${storePlanted}/${storeDefects} in the recipe store's checks, ${readerPlanted}/${READER_DEFECTS} in app.js's openReader, ${startPlanted}/${START_DEFECTS} for a reader that can't start)`
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
