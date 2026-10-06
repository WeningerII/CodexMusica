#!/usr/bin/env node
// check_lazy_app.js — BEHAVIORAL parity between the lazy shell and the embedded app.
//
// @covers: lazy-shell-parity
//
// WHY: the lazy build (the `build_html.js` DEFAULT — what ships in codex.html)
// carries the SAME src/app.js with a different data source: api/browse_boot.json
// (every genre without its prose, plus the starter genres'; the page itself
// keeps only an index of instrument ids, names and families), then after the
// first paint api/engine.json (the instrument engine: every instrument with
// its parts and variants, the family parts, rooms, chains, tunings, instrument
// axes, prefaces), then api/browse_prose.json once the engine's bytes are in,
// then per-tradition `source` fetches, instead of embedded tables. Every
// promise the app makes (search recall and ranking, the tradition tree,
// find-similar, import correctness, the recipe string) must survive that swap
// byte-for-byte once the prose and the instrument data have landed. Before
// they land the page must say what it is waiting for rather than claim
// anything is missing, and an action that needs the instrument data must wait
// for it instead of acting without it. This gate boots BOTH builds in jsdom —
// the lazy one against the committed api/ via a fetch shim — and asserts:
//
//   PARITY (section `parity`; the lazy app IS the embedded app):
//   • Catalog data — every tradition's app-facing projection (name/family/
//     lineage/instruments + parent/axes/description/exemplars/crossRefs/status)
//     is deep-equal across ALL ids, axes normalized through the 13-key contract.
//   • Rendered browse surfaces — renderTradPicker() innerHTML is IDENTICAL
//     (string-equal) for the full tree and for search queries.
//   • Import — for a cross-family sample: ensureFull → importTradition yields
//     identical cards and an identical compressRichRecipe string.
//   • The engine — after the imports, an FNV-1a fingerprint of the merged
//     engine is equal in both builds: INSTRUMENTS' order; each instrument's
//     own fields and own part ids; each merged part's id, _fromFamily, fields
//     and the first-seen identity of each of its variants (a variant shared by
//     two parts must stay one object); every distinct variant's JSON; the
//     other seven tables; the instrument and distinct-variant counts. Sorting
//     before the merge, or a file that differs from references/, moves it.
//   • Fetches — exactly 1 boot index; then exactly 1 engine file, its ?v= the
//     file header's digest prefix; then exactly 1 prose file, requested only
//     once the engine's body was delivered; 0 of the published 8 MB
//     api/browse.json, and exactly 1 per imported tradition.
//
//   FIRST VIEW (section `first-view`; ten starting states — default, List,
//   phone width, phone List, a starter deep link, a deep link to a genre
//   outside the boot index, an unknown deep link, a restored recipe, a
//   restored recipe in List, and the Instrument page by its route hash): with
//   api/browse_prose.json AND api/engine.json HELD BACK, the lazy page's body
//   equals the embedded build's byte for byte. Nothing reads the engine
//   (Engine.misses() stays 0); it is requested once, after the first view is
//   drawn (it waits for the paint or an action, section engineEarly), and
//   nothing that waits for its bytes — the prose's background prefetch, the
//   genre page's optional files, the Instrument page's photo table — is
//   requested before them, over the whole boot (the non-starter deep link
//   asks for its genre's prose early, as its reader). A restored recipe asks
//   for the engine at boot instead — from <head>, through the page's one
//   dynamic preload, for the one URL app.js then requests — and holds its
//   first view at the boot status, writing nothing, until it lands; no other
//   state preloads it. The Instrument route says its list is loading
//   (role=status, no count, never "0 instruments") and is the embedded
//   build's everywhere else. Two states draw prose slots as pending
//   (the non-starter deep link, and the restored recipe's List suggestions);
//   there the pending slots must be exactly the genres without prose, and the
//   page must be equal once they are masked. Then both are released: every
//   slot fills IN PLACE (no control the page had is rebuilt) and the page is
//   the embedded build's, byte for byte.
//   The <head> preload (src/engine_preload.js) answers as app.js does: over
//   twelve kinds of stored state and one per key storedSessionText reads, the
//   page preloads the engine exactly when app.js asks for it at boot
//   (ENGINE_AT_BOOT), and then app.js's one request is for the preload's URL.
//
//   WINDOW (section `window`; before the prose and the engine land): the boot
//   index carries exactly the page's STARTER_TRADITIONS' prose; a search
//   covers names only, lists exactly the full search's name matches in the
//   full search's order, and says so; a detail and the picker say "loading",
//   never "none"; nothing reads the engine. After the release the list and the
//   picker on screen equal the embedded build's.
//
//   ENGINE (section `engine`; each check boots its own lazy page with
//   api/engine.json held, against one embedded page doing the same; --checks
//   runs some of them):
//   • E0 — one engine request, after the first view; Engine.state() is
//     'loading' and neither the prose nor an optional download is asked for
//     while it is held; once released, exactly one prose request, after the
//     engine's body.
//   • E1 — InstLite's name, short and family equal the embedded Inst's for
//     every instrument; an unknown id is undefined; Inst() throws
//     EngineNotReadyError and is counted (Engine.misses() 0 → 1).
//   • E2 — a sweep: on every route and in a genre's detail, one click per
//     distinct [data-ui] (but the file import and the downloads), the
//     header's add, saved, undo and redo buttons, and the tree's expand,
//     find-similar, back and import: no error, no unhandled rejection, no
//     card, no engine read, no optional download, and never "0 instruments",
//     "No instruments match", "has no recognised instruments" or "Unknown
//     instrument".
//   • E3 — each action that creates cards or shows one instrument, in its own
//     boot: add a genre, add an instrument (on its own, and to the featured
//     genre), Surprise me, import a session file, open a saved session, the
//     AI writer's Use recipe, and inspecting an instrument. Held 300 ms it
//     has made no card, read nothing, and says it is preparing the instrument
//     data (or draws a loading state); once released it completes exactly as
//     the embedded build's: the same cards and recipe string, or for the
//     inspector the same list and preview.
//   • E4 — the picker's similar view, then "From here": the instruments that
//     fit are drawn as loading, nothing is computed or cached for either
//     genre; once released the picker redraws itself as the embedded build's.
//   • E5 — a search on the Instrument page while it loads stays pending with
//     no count; once released the list is the embedded build's, with the
//     search box still focused.
//   • E6 — the direct reads of the eight engine tables in src/ (identifier
//     references, from the AST) are counted per file, per table and per
//     enclosing function, and must match ENGINE_READERS below: a new reader
//     has to be reviewed (it must run only once the instrument data has
//     loaded), then the census regenerated with --print-readers. A read added
//     in one function and removed from another moves both.
//
//   FAILURE PATHS (section `failure`; the lazy app fails honestly):
//   • the boot index unreachable → the boot-error state renders.
//   • the prose unreachable → the app works; prose slots say they could not
//     load, with Retry; a search says only names were searched; exactly one
//     request, no retry loop, and Retry makes exactly one more.
//   • a tradition fetch 404s → importTraditionWithFeedback adds NO cards and
//     surfaces the error toast.
//   • F4a, the engine unreachable with no saved session → the first view
//     stands (no boot error); one request, none more on a timer; an Add makes
//     one more, adds nothing and says it could not load, with Retry; the
//     Instrument page says it could not load, with Retry, which makes exactly
//     one more; the genre prose still loads.
//   • F4b, the engine unreachable with a saved session → the boot error names
//     api/engine.json; the session is left as it was and nothing is written.
//   • F4c, a file from another deploy (its digest is not the page's) → refused
//     as stale; an Add adds nothing and asks for a reload; no table is filled.
//
// USAGE
//   node scripts/check_lazy_app.js                  # every section (npm run test:lazy, CI)
//   node scripts/check_lazy_app.js --verbose        # per-check detail
//   --only=parity,first-view,window,engine,failure  # run some sections (faults.js)
//   --scenarios=default,deep,instrument-route       # restrict first-view (faults.js)
//   --checks=E1,E3,E4                               # run some engine checks (faults.js)
//   --print-readers                                 # print E6's ENGINE_READERS from src/, exit
// The three filters only restrict: the full run is always a superset. An
// unknown section, scenario or engine check is an error, and so is --checks
// with the engine section left out; the summary line names the engine checks
// that ran when --checks leaves some out.

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const API_DIR = path.join(ROOT, 'api');
const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
const flagList = (name) => {
  const a = argv.find((x) => x.startsWith(`--${name}=`));
  return a
    ? a
        .slice(name.length + 3)
        .split(',')
        .filter(Boolean)
    : null;
};

const SECTIONS = ['parity', 'first-view', 'window', 'engine', 'failure'];
const SITE = 'https://codexmusica.com/codex.html';
const WS = JSON.stringify({
  version: 1,
  name: 'T',
  cards: [
    { id: 'c1', instrumentId: 'voice', traditionId: 'hindustani', parts: {} },
    { id: 'c2', instrumentId: 'voice', traditionId: 'dub', parts: {} },
  ],
});
const LIST = { 'codex-layout:genre-view': '"list"' };
// name → { query, route, width, storage, pending }. `pending`: the state draws
// prose slots as loading, so it is compared masked before the release.
// `route`: the page opens on that route's hash (codex.html#instrument).
const SCENARIOS = {
  default: {},
  list: { storage: LIST },
  mobile: { width: 375 },
  'mobile-list': { width: 375, storage: LIST },
  'deep-starter': { query: '?trad=dub' },
  deep: { query: '?trad=bluegrass', pending: true },
  'deep-unknown': { query: '?trad=nope_not_a_genre' },
  restored: { storage: { 'codex-workbench-v1': WS } },
  'restored-list': { storage: { ...LIST, 'codex-workbench-v1': WS }, pending: true },
  'instrument-route': { route: 'instrument' },
};

// The eight engine tables, spelled out here rather than read from
// scripts/_page_tables.js, so dropping a name there cannot drop it here too.
const ENGINE_TABLES = [
  'INSTRUMENT_FAMILY_PARTS',
  'INSTRUMENTS',
  'ROOMS',
  'ROOM_CLUSTERS',
  'CHAIN_SECTIONS',
  'TUNINGS',
  'INSTRUMENT_AXIS_DEFINITIONS',
  'PREFACE_LEXICON',
];
// E6: the direct reads of the engine tables in src/, per file, per table, per
// enclosing function (an identifier reference: a property name or an object
// key is not one; a read outside any named function is "(top level)"). Each
// reader counted here was reviewed as running only once the instrument data has
// loaded: behind _engineLive, after Engine.ensure() or engineReady(), on a card
// (no card exists before then), or as a `typeof` guard. A change means a reader
// was added, removed or moved to another function: review it, then regenerate
// with `node scripts/check_lazy_app.js --print-readers`.
const ENGINE_READERS = {
  'src/app.js': {
    INSTRUMENTS: {
      _buildIdIndexes: 2,
      '(top level)': 3,
      findSimilarInstruments: 1,
      findInstrumentsForTradition: 1,
    },
    ROOMS: {
      _buildIdIndexes: 2,
      buildDriftCandidates: 1,
      inverseConfigureForPreface: 1,
      renderEnvRow: 4,
    },
    TUNINGS: {
      _buildIdIndexes: 2,
      buildDriftCandidates: 1,
      inverseConfigureForPreface: 1,
      renderEnvRow: 4,
    },
    CHAIN_SECTIONS: {
      _buildIdIndexes: 2,
      buildDriftCandidates: 1,
      buildStackParts: 1,
      inverseConfigureForPreface: 1,
      normalizeWorkspaceCards: 1,
      renderChainSection: 2,
      handleCardClick: 1,
    },
    PREFACE_LEXICON: {
      _resolvePreface: 4,
      _matchSurvivors: 2,
      inverseConfigureForPreface: 2,
      renderReachabilityFan: 2,
      renderPrefaceSection: 2,
      populatePrefaceDatalist: 2,
      prefaceGroups: 1,
      renderPrefaceModalBody: 2,
      openPrefaceModal: 1,
    },
    ROOM_CLUSTERS: {
      renderEnvRow: 1,
    },
    INSTRUMENT_AXIS_DEFINITIONS: {
      computeInstrumentDistance: 1,
      getMatchingInstrumentAxes: 1,
      tradInstrumentCentroid: 1,
      centroidDistance: 1,
      buildSongFingerprint: 3,
    },
  },
  'src/pages/instrument.js': {
    INSTRUMENTS: {
      ipGroups: 1,
      renderInstrumentDiscovery: 3,
      ipRenderCategories: 1,
      ipRenderList: 2,
      uiInstrumentNoResults: 1,
    },
    CHAIN_SECTIONS: {
      ipDiff: 1,
      ipRenderChain: 2,
    },
    PREFACE_LEXICON: {
      ipRenderCharacter: 1,
    },
    TUNINGS: {
      ipRenderEnv: 2,
    },
    ROOMS: {
      ipRenderEnv: 2,
    },
  },
  'src/workbench.js': {
    CHAIN_SECTIONS: {
      uiRecipeEnvHTML: 1,
    },
  },
};

// The engine section's checks, by id (--checks).
const ENGINE_CHECKS = ['E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'];

const ONLY = flagList('only') || SECTIONS;
const PRINT_READERS = argv.includes('--print-readers');
const ONLY_SCENARIOS = flagList('scenarios') || Object.keys(SCENARIOS);
const ONLY_CHECKS = flagList('checks') || ENGINE_CHECKS;
{
  const bad = [
    ...ONLY.filter((x) => !SECTIONS.includes(x)).map((x) => `unknown section "${x}"`),
    ...ONLY_SCENARIOS.filter((x) => !SCENARIOS[x]).map((x) => `unknown scenario "${x}"`),
    ...ONLY_CHECKS.filter((x) => !ENGINE_CHECKS.includes(x)).map(
      (x) => `unknown engine check "${x}"`
    ),
  ];
  // --checks filters the engine section; with the section left out it would
  // filter nothing, and a caller would read the pass as those checks'.
  if (flagList('checks') && !ONLY.includes('engine'))
    bad.push('--checks names engine checks, but --only leaves out the engine section');
  if (bad.length) {
    console.error(
      `check_lazy_app: ${bad.join('; ')} (sections: ${SECTIONS.join(', ')}; scenarios: ${Object.keys(SCENARIOS).join(', ')}; engine checks: ${ENGINE_CHECKS.join(', ')})`
    );
    process.exit(2);
  }
}

// Cross-family import sample: umbrella genre (pop), guitar-amp chain
// (death_metal), acoustic/voice (delta_blues), electronic (detroit_techno),
// non-12-TET tuning (hindustani), field/vocal polyphony (aka_baka_polyphony).
const IMPORT_SAMPLE = [
  'pop',
  'death_metal',
  'delta_blues',
  'detroit_techno',
  'hindustani',
  'aka_baka_polyphony',
];
const SEARCH_QUERIES = ['', 'pop', 'metal', 'lo-fi'];
const AXIS_KEYS = [
  'harm',
  'pitch',
  'ornament',
  'meter',
  'density',
  'transmission',
  'improv',
  'soundTech',
  'intensity',
  'voice',
  'timbre',
  'percussion',
  'cyclicity',
];

const problems = [];
const fail = (msg) => problems.push(msg);
const note = (msg) => {
  if (VERBOSE) console.error('  ' + msg);
};

function buildTempHtml(lazy) {
  const tmp = path.join(os.tmpdir(), `codex_lazy_${lazy ? 'shell' : 'embed'}_${process.pid}.html`);
  const args = [path.join(__dirname, 'build_html.js'), `--out=${tmp}`, '--quiet'];
  // Both modes EXPLICIT: the default flipped to lazy, so the embedded control
  // build must opt in via --embedded — otherwise this gate would compare the
  // lazy shell against itself and prove nothing.
  args.push(lazy ? '--lazy' : '--embedded');
  execFileSync('node', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  const html = fs.readFileSync(tmp, 'utf8');
  fs.unlinkSync(tmp);
  return html;
}

// A response held until release(), so a probe can read the page while a file
// is still on its way.
function deferred() {
  let release;
  const promise = new Promise((resolve) => (release = resolve));
  return { promise, release };
}

// fetch shim — resolves the app's api/ URLs against the COMMITTED repo api/
// (itself gate-verified by check_api + the freshness job). `deny` simulates a
// failure for specific paths ('*': every path, the embedded build's shim);
// `hold` maps a path to a deferred() that lets it through on release;
// `transform` maps a path to a function that rewrites its text (a file from
// another deploy). `log` records every request: the URL the app asked for
// (`url`), its path `rel` without the query, the query `q`, `ready` — whether
// the first view had been drawn when it was made (`stamp`) — and `n`, a
// sequence number shared with `bodies`, which records each body the app read
// (text() or json()). So a request can be ordered against another file's
// delivery, not just its request.
const SITE_PREFIX = /^https:\/\/codexmusica\.com\//;
function makeFetchShim({
  deny = [],
  log = [],
  hold = {},
  stamp,
  bodies = [],
  transform = {},
} = {}) {
  let n = 0;
  return (url) => {
    const full = String(url)
      .replace(SITE_PREFIX, '')
      .replace(/^\.?\//, '');
    const rel = full.replace(/\?.*$/, '');
    log.push({
      url: String(url),
      rel,
      q: full.slice(rel.length),
      ready: stamp ? stamp() : null,
      n: ++n,
    });
    return (hold[rel] ? hold[rel].promise : Promise.resolve()).then(() => {
      const file = path.join(ROOT, rel);
      if (
        deny === '*' ||
        deny.includes(rel) ||
        !file.startsWith(API_DIR + path.sep) ||
        !fs.existsSync(file)
      ) {
        return {
          ok: false,
          status: 404,
          json: async () => {
            throw new Error('404');
          },
          text: async () => {
            throw new Error('404');
          },
        };
      }
      const raw = fs.readFileSync(file, 'utf8');
      const text = transform[rel] ? transform[rel](raw) : raw;
      const delivered = () => bodies.push({ rel, n: ++n });
      return {
        ok: true,
        status: 200,
        json: async () => {
          const data = JSON.parse(text);
          delivered();
          return data;
        },
        text: async () => {
          delivered();
          return text;
        },
      };
    });
  };
}
const fetchesOf = (log, rel) => log.filter((e) => e.rel === rel);
// The genre page's optional downloads (gpLoadOptional): after the paint, and
// after the instrument data's bytes.
const OPTIONAL = ['data/atlas-geo.json', 'api/tradition_images.json'];
// Every optional download, each waiting for the instrument data's bytes: the
// genre page's, and the Instrument page's photo table.
const OPTIONAL_ALL = [...OPTIONAL, 'api/instrument_images.json'];
// They and the genre prose's background prefetch.
const AFTER_ENGINE = ['api/browse_prose.json', ...OPTIONAL_ALL];
// The requests for `rels` made before the body of api/engine.json was
// delivered (all of them, while it is held).
const beforeEngineBody = (log, bodies, rels) => {
  const body = bodies.find((b) => b.rel === 'api/engine.json');
  return log.filter((e) => rels.includes(e.rel) && (!body || e.n < body.n));
};
// The preloads <head> made for the instrument data (src/engine_preload.js).
const enginePreloads = (w) =>
  [...w.document.head.querySelectorAll('link[rel="preload"]')]
    .filter((l) => /engine\.json/.test(l.getAttribute('href') || ''))
    .map((l) => ({
      href: l.getAttribute('href'),
      as: l.getAttribute('as'),
      crossorigin: l.getAttribute('crossorigin'),
    }));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// api/engine.json's header (the file's second line): its `tables_sha1` is the
// digest the page checks, and the page's ?v= cache key is its prefix.
function engineHeader() {
  const lines = fs.readFileSync(path.join(API_DIR, 'engine.json'), 'utf8').split('\n');
  return JSON.parse(lines[1].replace(/,$/, ''));
}

// Whether a booted page has drawn its first view (the shim's `stamp`): the
// genre list's rows on the Genre page, the page itself on any other route.
function drawn(w) {
  try {
    return !!w.eval(
      "typeof UI !== 'undefined' && UI.ready === true && (UI.view !== 'genre' || !!document.querySelector('#genre-list > *'))"
    );
  } catch {
    return false;
  }
}

function bootDom(html, fetchShim, { url = 'about:blank', width, storage, onWindow } = {}) {
  return new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
      if (onWindow) onWindow(w);
      w.storage = {
        async get() {
          return null;
        },
        async set() {},
        async delete() {},
        async list() {
          return { keys: [] };
        },
      };
      w.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      });
      w.scrollTo = () => {};
      // jsdom has no scrollIntoView; an import scrolls its first card into view.
      w.HTMLElement.prototype.scrollIntoView = () => {};
      if (width) Object.defineProperty(w, 'innerWidth', { value: width, configurable: true });
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
      if (fetchShim) w.fetch = fetchShim;
    },
  });
}

// Inject an async probe into a booted dom and wait for its result. The probe
// shares the page's global script scope, so it can reference the app's
// top-level consts (Catalog, app, renderTradPicker, …) directly. It first waits
// for the boot (`boot`, the default; off for a page whose boot is held or has
// failed); with `prose` (the default) it then waits for the genre prose to
// merge; whenProse() never starts a load, so a page that never asks for the
// prose fails here.
function runProbe(dom, probeBody, timeoutMs = 15000, { prose = true, boot = true } = {}) {
  dom.window.__probe = undefined;
  const s = dom.window.document.createElement('script');
  s.textContent = `(async () => {
    try {
      if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, {once:true}));
      ${
        boot
          ? `if (typeof CATALOG_READY !== 'undefined' && CATALOG_READY) await CATALOG_READY;
      if (typeof UI !== 'undefined') {
        for (let i=0;i<100&&!UI.ready;i++) await new Promise(resolve=>setTimeout(resolve,10));
        if (!UI.ready) throw Error('Workbench did not finish booting');
      }`
          : ''
      }
      ${
        prose
          ? `await Promise.race([Catalog.whenProse(), new Promise((_, rej) => setTimeout(() => rej(Error('the genre prose never merged: nothing requested api/browse_prose.json after the first paint')), 10000))]);`
          : ''
      }
      window.__probe = await (async () => { ${probeBody} })();
    } catch (e) { window.__probe = { __err: String((e && e.stack) || e) }; }
  })();`;
  dom.window.document.body.appendChild(s);
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = setInterval(() => {
      if (dom.window.__probe !== undefined) {
        clearInterval(poll);
        resolve(dom.window.__probe);
      } else if (Date.now() - t0 > timeoutMs) {
        clearInterval(poll);
        reject(new Error('probe timed out'));
      }
    }, 50);
  });
}
function waitFor(test, ms, what) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = setInterval(() => {
      let ok = false;
      try {
        ok = test();
      } catch {
        ok = false;
      }
      if (ok) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() - t0 > ms) {
        clearInterval(poll);
        reject(new Error(what));
      }
    }, 50);
  });
}

// The same quiet point in both builds: booted, the AI status settled
// (uiCheckAI runs from uiAfterPaint in both) and two frames drawn.
const FRAMES = (n) =>
  `for (let i = 0; i < ${n}; i++) await new Promise((r) => requestAnimationFrame(() => r()));`;
const SETTLE = `
  for (let i = 0; i < 400 && document.getElementById('ai-status') && document.getElementById('ai-status').textContent === 'Connecting…'; i++)
    await new Promise((r) => setTimeout(r, 25));
  ${FRAMES(2)}
  return true;`;

// body.innerHTML (or a clone's) with the inline scripts stripped (they are the
// two builds' different data), generated card ids normalized, and runs of
// newlines collapsed.
const SNAP_FN = `(root) => root.innerHTML
  .replace(/<script\\b[\\s\\S]*?<\\/script>/g, '')
  .replace(/\\b(card|ws)_[a-z0-9]{4,}\\b/g, 'ID')
  .replace(/\\n+/g, '\\n')`;
const SNAP = `return (${SNAP_FN})(document.body);`;
function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return `at char ${i}: …${JSON.stringify(a.slice(Math.max(0, i - 30), i + 30))} vs …${JSON.stringify(b.slice(Math.max(0, i - 30), i + 30))}`;
}

// The pending prose slots on the page: [[genre id, kind], …].
const PENDING = `[...document.querySelectorAll('[data-prose-pending]')].map((el) => [el.closest('[data-gp-id]')?.dataset.gpId || null, el.dataset.prosePending])`;
// A body clone with each listed prose slot replaced by <!--prose:ID:KIND-->:
// in the lazy page the pending element itself, in the embedded page the
// element a fresh render draws in its place.
const MASKED = (pending) => `
  const clone = document.body.cloneNode(true);
  const missing = [];
  const put = (els, id, kind) => {
    if (!els.length || els.some((e) => !e)) return void missing.push(id + ':' + kind);
    els[0].replaceWith(document.createComment('prose:' + id + ':' + kind));
    for (const e of els.slice(1)) e.remove();
  };
  const sel = (s) => clone.querySelector(s);
  for (const [id, kind] of ${JSON.stringify(pending)}) {
    const pend = [...clone.querySelectorAll('[data-prose-pending="' + kind + '"]')].find((el) => el.closest('[data-gp-id]')?.dataset.gpId === id);
    if (pend) { put([pend], id, kind); continue; }
    const q = '[data-gp-id="' + id + '"]';
    if (kind === 'lede') put([sel('#genre-detail' + q + ' .gp-detail-head > .gp-lede')], id, kind);
    else if (kind === 'row') put([sel('.gp-row' + q + ' .gp-row-desc')], id, kind);
    else {
      const secs = [...(clone.querySelector('#genre-detail' + q + ' #gp-panel-background')?.children || [])];
      if (kind === 'about') {
        const lin = secs[1] && secs[1].querySelector('h3')?.textContent === 'Lineage' ? [secs[1]] : [];
        put([secs[0], ...lin], id, kind);
      } else put([secs[secs.length - 1]], id, kind);
    }
  }
  return { missing, snap: (${SNAP_FN})(clone) };`;

// The capture probe both builds run in `parity` — everything compared comes out of here.
const CAPTURE_PROBE = `
  const sample = ${JSON.stringify(IMPORT_SAMPLE)};
  const queries = ${JSON.stringify(SEARCH_QUERIES)};
  const out = { catalog: {}, pickers: {}, cards: null, recipe: null };
  for (const t of Catalog.all()) {
    const ext = Catalog.ext(t.id) || {};
    out.catalog[t.id] = {
      name: t.name, family: t.family,
      lineage: t.lineage || null,
      instruments: t.instruments || [],
      parent: ext.parent || null,
      axes: ext.axes || {},
      description: ext.description || '',
      exemplars: ext.exemplars || [],
      crossRefs: ext.crossRefs || [],
      status: ext.status || null,
    };
  }
  const picker = document.getElementById('picker-trad');
  for (const q of queries) {
    app.similarFor = null;
    app.tradSearch = q;
    renderTradPicker();
    out.pickers[q || '(tree)'] = picker ? picker.innerHTML : '(no picker element)';
  }
  for (const id of sample) {
    await Catalog.ensureFull(id);   // embedded: instant; lazy: one cached fetch
    await Catalog.ensureFull(id);   // second call must hit the cache
    importTradition(id);
  }
  out.cards = app.cards.map((c) => ({
    instrumentId: c.instrumentId, traditionId: c.traditionId || null,
    tuning: c.tuning || null, room: c.room || null,
    parts: c.parts || null, chain: c.chain || null,
  }));
  out.recipe = compressRichRecipe(app.cards, 1000);
  return out;
`;

// The engine fingerprint both builds compute after the imports (parity):
// FNV-1a per component, so a drift names the part of the engine that moved.
// Variants are numbered by first sight, walking INSTRUMENTS' merged parts in
// order, and a part lists its variants by number: the merge's sharing (one
// lent copy of a material in many parts) is part of the print, then every
// distinct variant's JSON in that order. Sorting before the merge reorders
// what the merge collects; a file that differs from references/ changes JSON.
const ENGINE_FINGERPRINT = `
  const fnv = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; };
  const seen = new Map(), distinct = [];
  const vid = (v) => { if (!seen.has(v)) { seen.set(v, distinct.length); distinct.push(v); } return seen.get(v); };
  const instruments = INSTRUMENTS.map((inst) => {
    const { parts, _ownParts, ...own } = inst;
    return [own, (_ownParts || []).map((p) => p.id), (parts || []).map((p) => {
      const { variants, ...fields } = p;
      return [p.id, p._fromFamily === true, fields, (variants || []).map(vid)];
    })];
  });
  const components = {
    order: INSTRUMENTS.map((i) => i.id),
    instruments,
    variants: distinct,
    INSTRUMENT_FAMILY_PARTS, ROOMS, ROOM_CLUSTERS, CHAIN_SECTIONS, TUNINGS, INSTRUMENT_AXIS_DEFINITIONS, PREFACE_LEXICON,
    counts: [INSTRUMENTS.length, distinct.length],
  };
  const hashes = {};
  for (const [k, v] of Object.entries(components)) hashes[k] = fnv(JSON.stringify(v));
  return { hash: fnv(JSON.stringify(hashes)), hashes, count: INSTRUMENTS.length, distinct: distinct.length };
`;

// Normalize the catalog projection so embedded raw extras (which may omit an
// axis key or the exemplars/crossRefs fields entirely) compare against the
// lazy build's always-materialized form through the same app-facing contract:
// absent ≡ empty ≡ 0 — exactly how every consumer in the app reads them.
function normCatalog(cat) {
  const out = {};
  for (const id of Object.keys(cat).sort()) {
    const c = cat[id];
    out[id] = {
      name: c.name,
      family: c.family,
      lineage: c.lineage,
      instruments: c.instruments,
      parent: c.parent,
      axes: AXIS_KEYS.map((k) => (typeof c.axes[k] === 'number' ? c.axes[k] : 0)),
      description: c.description,
      exemplars: c.exemplars,
      crossRefs: c.crossRefs,
      status: c.status,
    };
  }
  return out;
}

// ── section: parity ─────────────────────────────────────────────────────────
async function parity(embedHtml, lazyHtml) {
  const embedDom = bootDom(embedHtml, null);
  const lazyLog = [],
    lazyBodies = [];
  const lazyDom = bootDom(lazyHtml, makeFetchShim({ log: lazyLog, bodies: lazyBodies }));
  const [embed, lazy] = await Promise.all([
    runProbe(embedDom, CAPTURE_PROBE),
    runProbe(lazyDom, CAPTURE_PROBE),
  ]);
  if (embed.__err) fail('embedded probe crashed: ' + embed.__err);
  if (lazy.__err) fail('lazy probe crashed: ' + lazy.__err);
  // The engine, after the imports, in both builds.
  const [ef, lf] = await Promise.all([
    runProbe(embedDom, ENGINE_FINGERPRINT),
    runProbe(lazyDom, ENGINE_FINGERPRINT),
  ]);
  if (ef.__err || lf.__err) fail('engine fingerprint probe crashed: ' + (ef.__err || lf.__err));
  else {
    if (!ef.count || !ef.distinct)
      fail(
        `engine fingerprint: the embedded build has ${ef.count} instruments and ${ef.distinct} variants — the check is vacuous`
      );
    if (ef.hash !== lf.hash) {
      const moved = Object.keys(ef.hashes).filter((k) => ef.hashes[k] !== lf.hashes[k]);
      fail(
        `engine fingerprint drift — embedded ${ef.hash} (${ef.count} instruments, ${ef.distinct} distinct variants), lazy ${lf.hash} (${lf.count}, ${lf.distinct}); differs in: ${moved.join(', ')}`
      );
    } else
      note(
        `engine fingerprint ${ef.hash}: ${ef.count} instruments, ${ef.distinct} distinct variants, identical`
      );
    embed.engine = ef;
  }

  if (!embed.__err && !lazy.__err) {
    // Catalog projection — every id, every app-facing field.
    const ne = normCatalog(embed.catalog);
    const nl = normCatalog(lazy.catalog);
    const ids = Object.keys(ne);
    if (ids.length !== Object.keys(nl).length || ids.length === 0) {
      fail(`catalog size drift — embedded ${ids.length}, lazy ${Object.keys(nl).length}`);
    }
    let drifted = 0;
    for (const id of ids) {
      if (JSON.stringify(ne[id]) !== JSON.stringify(nl[id])) {
        drifted++;
        if (drifted <= 5) fail(`catalog projection drift on "${id}"`);
      }
    }
    if (drifted > 5) fail(`…and ${drifted - 5} more drifted tradition(s)`);
    note(`catalog projection: ${ids.length} traditions compared, ${drifted} drift(s)`);

    // Rendered browse surfaces — exact innerHTML equality.
    for (const q of Object.keys(embed.pickers)) {
      if (embed.pickers[q] === '(no picker element)' || lazy.pickers[q] === '(no picker element)') {
        // Without this guard a missing #picker-trad would make BOTH builds record
        // the same sentinel and the comparison would pass vacuously — the rendered
        // surface half of the gate must actually render something.
        fail(
          `renderTradPicker for query ${q}: #picker-trad element absent — comparison would be vacuous`
        );
      } else if (embed.pickers[q] !== lazy.pickers[q]) {
        fail(
          `renderTradPicker drift for query ${q} — a browse render path read a field the index doesn't carry`
        );
      } else {
        note(`picker ${q}: ${embed.pickers[q].length} chars, identical`);
      }
    }

    // Import — cards + recipe string.
    if (JSON.stringify(embed.cards) !== JSON.stringify(lazy.cards)) {
      fail(
        `imported cards drift across ${IMPORT_SAMPLE.length} traditions (tuning/room/parts/chain differ)`
      );
    } else {
      note(
        `import: ${embed.cards.length} cards identical across ${IMPORT_SAMPLE.length} traditions`
      );
    }
    if (embed.recipe !== lazy.recipe) {
      fail('compressRichRecipe drift — the pasteable recipe differs between builds');
    } else {
      note(`recipe: ${String(embed.recipe).length} chars, identical`);
    }

    // Fetch discipline — 1 boot index, then 1 prose file, never the published
    // browse.json, and exactly 1 per imported tradition despite ensureFull
    // being called twice per id (the cache must absorb it).
    const rels = lazyLog.map((e) => e.rel);
    const boot = fetchesOf(lazyLog, 'api/browse_boot.json').length;
    const prose = fetchesOf(lazyLog, 'api/browse_prose.json').length;
    if (boot !== 1) fail(`expected exactly 1 browse_boot.json fetch, saw ${boot}`);
    if (prose !== 1) fail(`expected exactly 1 browse_prose.json fetch, saw ${prose}`);
    const full = fetchesOf(lazyLog, 'api/browse.json').length;
    if (full)
      fail(
        `the app must not download the 8 MB published index; saw ${full} api/browse.json fetch(es)`
      );
    if (rels.indexOf('api/browse_prose.json') < rels.indexOf('api/browse_boot.json'))
      fail('api/browse_prose.json was requested before the boot index');
    // The engine: one request after the boot index, keyed by the file's
    // digest, and the prose only once the engine's body is in.
    const engineAsks = fetchesOf(lazyLog, 'api/engine.json');
    const bootAsk = fetchesOf(lazyLog, 'api/browse_boot.json')[0];
    const proseAsk = fetchesOf(lazyLog, 'api/browse_prose.json')[0];
    const engineBody = lazyBodies.find((b) => b.rel === 'api/engine.json');
    const key = `?v=${engineHeader().tables_sha1.slice(0, 12)}`;
    if (engineAsks.length !== 1)
      fail(`expected exactly 1 api/engine.json fetch, saw ${engineAsks.length}`);
    if (engineAsks[0] && bootAsk && engineAsks[0].n < bootAsk.n)
      fail('api/engine.json was requested before the boot index');
    if (engineAsks[0] && engineAsks[0].q !== key)
      fail(
        `api/engine.json was requested as ${JSON.stringify(engineAsks[0].q)}; want ${key}, the prefix of the file header's tables_sha1`
      );
    if (!engineBody) fail('the app never read the body of api/engine.json');
    else if (proseAsk && proseAsk.n < engineBody.n)
      fail(
        'api/browse_prose.json was requested before the body of api/engine.json was delivered — the prose prefetch must follow the instrument data'
      );
    for (const id of IMPORT_SAMPLE) {
      const n = fetchesOf(lazyLog, `api/traditions/${id}.json`).length;
      if (n !== 1) fail(`expected exactly 1 fetch for ${id} (cached thereafter), saw ${n}`);
    }
    note(`fetches: ${lazyLog.length} total — ${JSON.stringify(rels)}`);
  }
  embedDom.window.close();
  lazyDom.window.close();
  return embed;
}

// ── section: first-view ─────────────────────────────────────────────────────
async function firstView(embedHtml, lazyHtml, name) {
  const sc = SCENARIOS[name];
  const url = SITE + (sc.query || '') + (sc.route ? '#' + sc.route : '');
  const opts = { url, width: sc.width, storage: sc.storage };
  const embedDom = bootDom(embedHtml, makeFetchShim({ deny: '*' }), opts);
  const ref = {},
    log = [],
    bodies = [],
    hold = { 'api/browse_prose.json': deferred(), 'api/engine.json': deferred() };
  const lazyDom = bootDom(
    lazyHtml,
    makeFetchShim({
      deny: ['api/tradition_images.json'],
      log,
      bodies,
      hold,
      stamp: () => drawn(ref.w),
    }),
    { ...opts, onWindow: (w) => (ref.w = w) }
  );
  const tag = `first view "${name}"`;
  try {
    const restoredState = !!(sc.storage && sc.storage['codex-workbench-v1']);
    if (restoredState) {
      // A saved recipe draws cards, and cards need the instrument data: the
      // boot asks for it at once and waits at the boot status, writing nothing.
      await sleep(1500);
      const early = await runProbe(
        lazyDom,
        `const status = document.getElementById('boot-status');
        return { ready: typeof UI !== 'undefined' && UI.ready === true, rows: document.querySelectorAll('#genre-list > *').length,
          status: status && !status.hidden ? status.textContent : null,
          bootError: !!document.getElementById('boot-error'),
          stored: localStorage.getItem('codex-workbench-v1'), recovery: sessionStorage.getItem('codex-workbench-recovery'),
          misses: typeof Engine === 'undefined' ? null : Engine.misses() };`,
        15000,
        { boot: false, prose: false }
      );
      const engineAsk = fetchesOf(log, 'api/engine.json');
      if (early.ready || early.rows)
        fail(`${tag}: a restored session drew before the engine arrived`);
      if (!engineAsk.length || engineAsk[0].ready !== false)
        fail(`${tag}: a restored session did not ask for the engine before its first view`);
      // Its download began in <head>: one preload, which the app's request
      // takes over only if it names the same URL (and fetch()'s mode).
      const pre = enginePreloads(lazyDom.window);
      if (
        engineAsk.length !== 1 ||
        pre.length !== 1 ||
        pre[0].as !== 'fetch' ||
        pre[0].crossorigin !== 'anonymous' ||
        new URL(pre[0].href, url).href !== new URL(engineAsk[0].url, url).href
      )
        fail(
          `${tag}: want one engine preload in <head> (as=fetch, crossorigin=anonymous) for the one URL the app asked for; saw preloads ${JSON.stringify(pre)}, requests ${JSON.stringify(engineAsk)}`
        );
      if (early.status === null || early.bootError)
        fail(
          `${tag}: while the engine was held the page did not wait at the boot status (${early.bootError ? '#boot-error drawn' : 'no #boot-status shown'})`
        );
      if (early.stored !== sc.storage['codex-workbench-v1'] || early.recovery !== null)
        fail(
          `${tag}: the saved session was written while the engine was held (codex-workbench-v1 ${early.stored === sc.storage['codex-workbench-v1'] ? 'unchanged' : 'changed'}, recovery copy ${JSON.stringify(early.recovery && early.recovery.slice(0, 60))})`
        );
      if (early.misses) fail(`${tag}: ${early.misses} engine read(s) before it landed`);
      note(
        `${tag}: held at the boot status (${JSON.stringify(early.status)}) until the engine landed`
      );
      hold['api/engine.json'].release();
    }
    const [e0, l0] = await Promise.all([
      runProbe(embedDom, SETTLE),
      runProbe(lazyDom, SETTLE, 15000, { prose: false }),
    ]);
    if (!restoredState) {
      // One request, after the first view (at its paint: requested before, it
      // would count on the path to the largest paint); the Instrument route
      // needs the instruments to draw its list, so it asks as it opens. The
      // optional downloads wait for its bytes, so nothing shares the link
      // with them.
      const asks = fetchesOf(log, 'api/engine.json');
      const pre = enginePreloads(lazyDom.window);
      if (pre.length)
        fail(`${tag}: no session is stored, yet <head> preloaded ${JSON.stringify(pre)}`);
      if (asks.length !== 1)
        fail(`${tag}: want exactly 1 engine request, saw ${JSON.stringify(asks)}`);
      else if (!sc.route && asks[0].ready !== true)
        fail(
          `${tag}: the engine was requested before the first view was drawn (${JSON.stringify(asks)})`
        );
      const early = OPTIONAL.filter((rel) => fetchesOf(log, rel).length);
      if (early.length)
        fail(`${tag}: ${early.join(', ')} requested while the instrument data was on its way`);
      if (lazyDom.window.eval('Engine.ready()')) fail(`${tag}: the engine was ready while held`);
      if (lazyDom.window.eval('Engine.misses()'))
        fail(`${tag}: ${lazyDom.window.eval('Engine.misses()')} engine read(s) before it landed`);
    }
    if (e0.__err || l0.__err) return fail(`${tag}: probe crashed: ${e0.__err || l0.__err}`);

    // (a) When the prose was asked for.
    const asks = fetchesOf(log, 'api/browse_prose.json');
    if (name === 'deep') {
      if (!asks.length || asks[0].ready !== false)
        fail(
          `${tag}: a ?trad= link to a genre outside the boot index did not ask for the prose before the first view`
        );
    } else if (!restoredState && asks.length) {
      fail(
        `${tag}: the genre prose was requested while the instrument data was held (${JSON.stringify(asks)})`
      );
    } else if (restoredState && (asks.length !== 1 || asks[0].ready !== true)) {
      fail(
        `${tag}: the genre prose was requested before the first view was drawn (${JSON.stringify(asks)})`
      );
    }

    // (b)/(c) The page with the prose and the engine held back.
    if (sc.route === 'instrument') {
      // The Instrument page: its list says it is loading, with no count and no
      // claim that nothing matches; the rest of the page is the embedded build's.
      const MASK_IP = `const clone = document.body.cloneNode(true);
        clone.querySelector('#instrument-body')?.replaceChildren(document.createComment('instruments'));
        clone.querySelector('#ip-total')?.replaceChildren();
        return (${SNAP_FN})(clone);`;
      const [em, ls] = await Promise.all([
        runProbe(embedDom, MASK_IP),
        runProbe(
          lazyDom,
          `const b = document.getElementById('instrument-body');
          return { view: UI.view, status: !!b?.querySelector('[data-engine-pending="instruments"][role="status"]'),
            total: document.getElementById('ip-total')?.textContent || '', text: b?.textContent || '',
            snap: (() => { ${MASK_IP} })() };`,
          15000,
          { prose: false }
        ),
      ]);
      if (em.__err || ls.__err) return fail(`${tag}: probe crashed: ${em.__err || ls.__err}`);
      if (ls.view !== 'instrument')
        fail(`${tag}: the page opened on "${ls.view}", not the Instrument page — vacuous`);
      if (!ls.status)
        fail(
          `${tag}: the instrument list is not marked as loading (role=status, data-engine-pending="instruments") while the instrument data is held: ${JSON.stringify(ls.text.slice(0, 160))}`
        );
      if (ls.total)
        fail(
          `${tag}: the Instrument page shows a count (${JSON.stringify(ls.total)}) before the instrument data landed`
        );
      if (/\b0 instruments\b|No instruments match/.test(`${ls.text} ${ls.total}`))
        fail(
          `${tag}: the Instrument page says there are no instruments while they load: ${JSON.stringify(ls.text.slice(0, 160))}`
        );
      if (ls.snap !== em)
        fail(
          `${tag} differs from the embedded build outside the instrument list ${firstDiff(ls.snap, em)}`
        );
      else note(`${tag}: the list says it is loading; identical outside it`);
    } else {
      const embedSnap = await runProbe(embedDom, SNAP);
      const lazyState = await runProbe(
        lazyDom,
        `return {
        pending: ${PENDING},
        unproven: ${PENDING}.filter(([id]) => !id || Catalog.hasProse(id)).length,
        rowsNoSlot: [...document.querySelectorAll('.gp-row[data-gp-id]')].filter((r) => !Catalog.hasProse(r.dataset.gpId) && !r.querySelector('[data-prose-pending="row"]')).map((r) => r.dataset.gpId),
        nonStarterRows: [...document.querySelectorAll('#genre-list .gp-row[data-gp-id]')].map((r) => r.dataset.gpId).filter((id) => !STARTER_TRADITIONS.includes(id)),
        suggestions: /Suggestions for this recipe/.test(document.getElementById('genre-list').textContent),
        cards: app.cards.length,
        snap: (${SNAP_FN})(document.body),
      };`,
        15000,
        { prose: false }
      );
      if (lazyState.__err) return fail(`${tag}: probe crashed: ${lazyState.__err}`);
      const pending = lazyState.pending;
      if (lazyState.rowsNoSlot.length)
        fail(
          `${tag}: ${lazyState.rowsNoSlot.length} row(s) of genres without their prose drawn with no pending slot (e.g. ${lazyState.rowsNoSlot.slice(0, 3).join(', ')})`
        );
      if (!sc.pending) {
        if (pending.length)
          fail(
            `${tag}: drew ${pending.length} pending prose slot(s) (${JSON.stringify(pending.slice(0, 3))}) — the first view must need only the boot index`
          );
        else if (lazyState.snap !== embedSnap)
          fail(
            `${tag} differs from the embedded build with the prose held back ${firstDiff(lazyState.snap, embedSnap)}`
          );
        else note(`${tag}: ${embedSnap.length} chars identical with the prose held back`);
      } else {
        if (!pending.length || lazyState.unproven)
          fail(
            `${tag}: pending slots ${JSON.stringify(pending.slice(0, 4))} — want at least one, each for a genre whose prose is not here`
          );
        if (name === 'deep' && !pending.some(([id, k]) => id === 'bluegrass' && k === 'lede'))
          fail(`${tag}: the deep-linked genre's description is not drawn as loading`);
        if (name === 'restored-list') {
          const rows = pending
            .filter(([, k]) => k === 'row')
            .map(([id]) => id)
            .sort();
          if (lazyState.cards !== 2 || !lazyState.suggestions)
            fail(
              `${tag}: the restored recipe did not draw its suggestions (cards=${lazyState.cards}) — the scenario is vacuous`
            );
          if (JSON.stringify(rows) !== JSON.stringify([...lazyState.nonStarterRows].sort()))
            fail(
              `${tag}: pending rows ${JSON.stringify(rows)} are not exactly the non-starter rows ${JSON.stringify(lazyState.nonStarterRows)}`
            );
        }
        const [em, lm] = await Promise.all([
          runProbe(embedDom, MASKED(pending)),
          runProbe(lazyDom, MASKED(pending), 15000, { prose: false }),
        ]);
        if (em.__err || lm.__err) fail(`${tag}: mask probe crashed: ${em.__err || lm.__err}`);
        else if (em.missing.length || lm.missing.length)
          fail(
            `${tag}: no counterpart for pending slot(s) ${JSON.stringify([...em.missing, ...lm.missing].slice(0, 4))}`
          );
        else if (lm.snap !== em.snap)
          fail(
            `${tag} differs from the embedded build outside its pending slots ${firstDiff(lm.snap, em.snap)}`
          );
        else note(`${tag}: ${pending.length} pending slot(s); identical outside them`);
      }
    }

    // (d) Release: every slot fills in place, nothing else is rebuilt, and
    // the page is the embedded build's.
    await runProbe(
      lazyDom,
      `window.__kept = [...document.querySelectorAll('#surface-genre button, #surface-genre a, #surface-genre input, #surface-genre select')].filter((el) => !el.closest('[data-prose-pending]'));
      return window.__kept.length;`,
      15000,
      { prose: false }
    );
    if (!restoredState) {
      hold['api/engine.json'].release();
      await runProbe(lazyDom, 'await Engine.whenReady(); return true;', 15000, { prose: false });
      if (name !== 'deep') {
        await waitFor(
          () => fetchesOf(log, 'api/browse_prose.json').length > 0,
          10000,
          'prose after engine'
        ).catch(() => {});
        const asks2 = fetchesOf(log, 'api/browse_prose.json');
        if (asks2.length !== 1 || asks2[0].ready !== true)
          fail(
            `${tag}: once the instrument data landed the prose was not requested exactly once after the first view (${JSON.stringify(asks2)})`
          );
      }
      // The optional downloads: once each, after the instrument data's bytes
      // (the Instrument route never draws the genre page, so it asks for none).
      if (sc.route !== 'instrument') {
        await waitFor(
          () => OPTIONAL.every((rel) => fetchesOf(log, rel).length),
          10000,
          'optional after engine'
        ).catch(() => {});
        const opt = OPTIONAL.map((rel) => fetchesOf(log, rel).length);
        if (opt.some((n) => n !== 1))
          fail(
            `${tag}: once the instrument data landed, ${OPTIONAL.join(' and ')} were requested ${opt.join(' and ')} time(s); want once each`
          );
      }
      // The engine's arrival alone (the prose still held) leaves the page the
      // embedded build's: the Instrument route draws its list.
      if (!sc.pending) {
        const [es, ls] = await Promise.all([
          runProbe(embedDom, SNAP),
          runProbe(lazyDom, `${FRAMES(2)} ${SNAP}`, 15000, { prose: false }),
        ]);
        if (ls !== es)
          fail(
            `${tag}: once the instrument data landed (the prose still held) the page differs from the embedded build ${firstDiff(ls, es)}`
          );
      }
    }
    const guard0 = lazyDom.window.eval('Engine.misses()');
    if (guard0) fail(`${tag}: ${guard0} engine read(s) before the engine landed`);
    hold['api/browse_prose.json'].release();
    hold['api/engine.json'].release();
    await runProbe(lazyDom, 'await Engine.ensure(); return true;', 15000, { prose: false });
    const after = await runProbe(
      lazyDom,
      `${FRAMES(3)}
      return { pending: document.querySelectorAll('[data-prose-pending]').length,
        rebuilt: window.__kept.filter((el) => !el.isConnected).length, kept: window.__kept.length,
        snap: (${SNAP_FN})(document.body) };`
    );
    const embedAfter = await runProbe(embedDom, SNAP);
    if (after.__err) fail(`${tag}: after-release probe crashed: ${after.__err}`);
    else {
      if (after.pending)
        fail(`${tag}: ${after.pending} prose slot(s) still pending after the release`);
      if (after.rebuilt)
        fail(
          `${tag}: the descriptions' arrival rebuilt ${after.rebuilt} of ${after.kept} control(s) instead of filling their slots in place`
        );
      if (after.snap !== embedAfter)
        fail(
          `${tag}: after the descriptions arrived the page differs from the embedded build ${firstDiff(after.snap, embedAfter)}`
        );
      else note(`${tag}: after the release identical, ${after.kept} controls kept`);
    }
    // Over the whole boot, in every state (a restored session too): nothing
    // that waits for the instrument data's bytes was asked for before them.
    // The non-starter deep link asks for its genre's prose early, as its reader.
    const jumped = beforeEngineBody(
      log,
      bodies,
      AFTER_ENGINE.filter((rel) => !(name === 'deep' && rel === 'api/browse_prose.json'))
    );
    if (jumped.length)
      fail(
        `${tag}: ${[...new Set(jumped.map((e) => e.rel))].join(', ')} requested before the instrument data's bytes were delivered`
      );
  } finally {
    embedDom.window.close();
    lazyDom.window.close();
  }
}

// ── first view: the engine waits for the paint or an action ───────────────
// The lazy page with its frames HELD (requestAnimationFrame queues and never
// draws until this check says so) and nothing held on the network: the page
// does not ask for the engine — no request, no parse, no merge, no index, no
// engine read — until the first paint (uiAfterPaint → Engine.start), or until
// an action asks for it (Engine.ensure), which does not wait for the paint.
// The genre prose and the optional downloads wait for the paint and the
// engine's bytes.
async function engineEarly(lazyHtml) {
  const boot = () => {
    const log = [],
      frames = [];
    let w = null;
    const dom = bootDom(
      lazyHtml,
      makeFetchShim({ deny: ['api/tradition_images.json'], log, stamp: () => drawn(w) }),
      {
        url: SITE,
        onWindow: (x) => {
          w = x;
          x.requestAnimationFrame = (cb) => frames.push(cb);
          x.cancelAnimationFrame = () => {};
        },
      }
    );
    const paint = () => {
      for (let i = 0; i < 2; i++) for (const cb of frames.splice(0)) cb(w.performance.now());
    };
    return { dom, log, frames, paint, win: () => w };
  };
  // Booted, drawn, and long enough for the shim's bytes to land.
  const settled = async (b, tag) => {
    await waitFor(() => drawn(b.win()), 10000, `${tag}: the first view was never drawn`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const w = b.win();
    const st = {
      state: w.eval('Engine.state()'),
      misses: w.eval('Engine.misses()'),
      engine: fetchesOf(b.log, 'api/engine.json'),
      later: ['api/browse_prose.json', ...OPTIONAL].filter((rel) => fetchesOf(b.log, rel).length),
    };
    if (st.engine.length !== 0)
      fail(
        `${tag}: the engine was requested before the first paint (${JSON.stringify(st.engine)}); it must wait for the paint or an action`
      );
    if (st.state !== 'idle')
      fail(
        `${tag}: before the first paint the engine is "${st.state}"; want "idle" (not asked for)`
      );
    if (st.misses) fail(`${tag}: ${st.misses} engine read(s) before the first paint`);
    if (st.later.length) fail(`${tag}: ${st.later.join(', ')} requested before the first paint`);
    if (!b.frames.length) fail(`${tag}: nothing waits for the first paint — the check is vacuous`);
    return st;
  };
  {
    const tag = 'engine early (paint)';
    const b = boot();
    try {
      await settled(b, tag);
      b.paint();
      const w = b.win();
      await waitFor(() => w.eval('Engine.ready()'), 15000, 'never ready').catch(() =>
        fail(
          `${tag}: the first paint did not start the engine's work (state "${w.eval('Engine.state()')}")`
        )
      );
      await waitFor(
        () => ['api/browse_prose.json', ...OPTIONAL].every((rel) => fetchesOf(b.log, rel).length),
        10000,
        'after paint'
      ).catch(() => {});
      const n = ['api/browse_prose.json', ...OPTIONAL].map((rel) => fetchesOf(b.log, rel).length);
      if (n.some((k) => k !== 1))
        fail(
          `${tag}: after the paint the prose, ${OPTIONAL.join(' and ')} were requested ${n.join(', ')} time(s); want once each`
        );
      if (fetchesOf(b.log, 'api/engine.json').length !== 1)
        fail(
          `${tag}: the engine was requested ${fetchesOf(b.log, 'api/engine.json').length} times`
        );
      if (w.eval('Engine.misses()')) fail(`${tag}: engine read(s) before it landed`);
      note(
        `${tag}: nothing before the paint; the paint asks for it and works on it, then the prose and the optional files`
      );
    } finally {
      b.dom.window.close();
    }
  }
  {
    // The Instrument page lists nothing until the instruments are here, and its
    // photo table waits for their bytes too.
    const tag = 'engine early (instrument page)';
    const log = [],
      hold = { 'api/engine.json': deferred() };
    let w = null;
    const dom = bootDom(lazyHtml, makeFetchShim({ log, hold }), {
      url: SITE,
      onWindow: (x) => (w = x),
    });
    try {
      await waitFor(() => drawn(w), 10000, `${tag}: the first view was never drawn`);
      w.eval("uiNavigate('instrument')");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const before = fetchesOf(log, 'api/instrument_images.json').length;
      const pending = w.eval(
        "document.querySelector('#instrument-body [data-engine-pending]') ? 1 : 0"
      );
      hold['api/engine.json'].release();
      await waitFor(() => w.eval('Engine.ready()'), 15000, 'never ready').catch(() => {});
      await waitFor(
        () => fetchesOf(log, 'api/instrument_images.json').length,
        10000,
        'photos'
      ).catch(() => {});
      const after = fetchesOf(log, 'api/instrument_images.json').length;
      if (!pending)
        fail(`${tag}: the page did not say the instruments are loading — the check is vacuous`);
      if (before || after !== 1)
        fail(
          `${tag}: the photo table was requested ${before} time(s) while the instrument data was on its way and ${after} in all; want 0 and 1`
        );
      else note(`${tag}: the photo table waits for the instrument data's bytes`);
    } finally {
      dom.window.close();
    }
  }
  {
    const tag = 'engine early (action)';
    const b = boot();
    try {
      await settled(b, tag);
      const w = b.win();
      w.eval('Engine.ensure()');
      await waitFor(() => w.eval('Engine.ready()'), 15000, 'never ready').catch(() =>
        fail(
          `${tag}: an action before the first paint did not start the engine's work (state "${w.eval('Engine.state()')}")`
        )
      );
      if (fetchesOf(b.log, 'api/engine.json').length !== 1)
        fail(
          `${tag}: the engine was requested ${fetchesOf(b.log, 'api/engine.json').length} times`
        );
      note(`${tag}: an action before the paint asks for the engine and does the work`);
    } finally {
      b.dom.window.close();
    }
  }
}

// ── first view: <head> asks for the engine exactly when app.js will ────────
// src/engine_preload.js repeats storedSessionText's and _bootNeedsEngine's
// test in <head>, so a saved session's engine download starts with the page.
// It must answer as app.js does: a preload app.js would not use is a download
// the first view pays for, and a missing one costs the restored session its
// head start. build_html --check runs the script against a fixed table of
// stored states; this holds it to app.js itself. For every kind of stored
// state, the page (its boot index and engine held, so nothing is drawn) has
// preloaded the engine if and only if app.js asked for it at boot
// (ENGINE_AT_BOOT), and when it did, app.js made exactly one request, for the
// preload's URL, so the response the preload fetched is the one it reads.
async function enginePreloadAgrees(lazyHtml) {
  const tag = 'engine preload';
  const ws = (cards) => JSON.stringify({ version: 1, name: 'T', cards });
  const CARDS = JSON.parse(WS).cards;
  // [label, sessionStorage, localStorage] — the recovery copy lives in the
  // first, everything else in the second; 'throw': storage is refused.
  const STATES = [
    ['nothing stored', {}, {}],
    ['autosave', {}, { 'codex-workbench-v1': WS }],
    ['recovery copy', { 'codex-workbench-recovery': WS }, {}],
    [
      'legacy workspace',
      {},
      { 'musica-workbench-v3': JSON.stringify({ workspace: { cards: CARDS } }) },
    ],
    ['legacy study', {}, { 'musica-study-v1': WS }],
    ['no cards', {}, { 'codex-workbench-v1': ws([]) }],
    ['empty recovery first', { 'codex-workbench-recovery': ws([]) }, { 'codex-workbench-v1': WS }],
    ['empty autosave first', {}, { 'codex-workbench-v1': ws([]), 'musica-workbench-v3': WS }],
    ['unparseable', {}, { 'codex-workbench-v1': '{"cards":[' }],
    ['cards not a list', {}, { 'codex-workbench-v1': JSON.stringify({ cards: { 0: CARDS[0] } }) }],
    ['layout only', {}, LIST],
    ['storage refused', 'throw', 'throw'],
  ];
  // And one state per key storedSessionText reads, as the page ships it: a key
  // added there and not in <head> fails here even if no state above names it.
  {
    const dom = bootDom(lazyHtml, makeFetchShim({ hold: { 'api/browse_boot.json': deferred() } }), {
      url: SITE,
    });
    const keys = [
      ...dom.window
        .eval('storedSessionText.toString()')
        .matchAll(/\b(sessionStorage|localStorage)\.getItem\((["'])([^"']+)\2\)/g),
    ].map((m) => [m[1], m[3]]);
    dom.window.close();
    if (keys.length < 4)
      fail(`${tag}: read ${keys.length} key(s) from storedSessionText; want its 4 or more`);
    for (const [where, key] of keys)
      STATES.push([
        `${key} alone`,
        where === 'sessionStorage' ? { [key]: WS } : {},
        where === 'localStorage' ? { [key]: WS } : {},
      ]);
  }
  let wanted = 0;
  for (const [label, session, local] of STATES) {
    const log = [];
    const hold = { 'api/browse_boot.json': deferred(), 'api/engine.json': deferred() };
    const dom = bootDom(lazyHtml, makeFetchShim({ hold, log }), {
      url: SITE,
      onWindow: (w) => {
        if (session === 'throw')
          for (const k of ['localStorage', 'sessionStorage'])
            Object.defineProperty(w, k, {
              configurable: true,
              get() {
                throw new w.DOMException('The operation is insecure.', 'SecurityError');
              },
            });
        else {
          for (const [k, v] of Object.entries(session)) w.sessionStorage.setItem(k, v);
          for (const [k, v] of Object.entries(local)) w.localStorage.setItem(k, v);
        }
      },
    });
    try {
      const pre = enginePreloads(dom.window);
      let atBoot;
      try {
        atBoot = dom.window.eval('ENGINE_AT_BOOT !== null');
      } catch (e) {
        fail(`${tag} (${label}): app.js did not reach ENGINE_AT_BOOT: ${e.message}`);
        continue;
      }
      const asks = fetchesOf(log, 'api/engine.json');
      if (pre.length > 1 || !!pre.length !== atBoot)
        fail(
          `${tag} (${label}): <head> preloaded ${JSON.stringify(pre)}, but app.js ${atBoot ? 'asked for the engine at boot' : 'did not ask for the engine at boot'}`
        );
      else if (
        asks.length !== (atBoot ? 1 : 0) ||
        (atBoot && new URL(asks[0].url, SITE).href !== new URL(pre[0].href, SITE).href)
      )
        fail(
          `${tag} (${label}): app.js requested ${JSON.stringify(asks.map((e) => e.url))} at boot; want ${atBoot ? `exactly the preload's ${JSON.stringify(pre[0].href)}` : 'nothing'}`
        );
      wanted += atBoot ? 1 : 0;
    } finally {
      dom.window.close();
    }
  }
  // Vacuity: the matrix must hold states on both sides.
  if (wanted < 8 || wanted === STATES.length)
    fail(
      `${tag}: app.js asked at boot in ${wanted} of ${STATES.length} stored states; want 8 or more, and not all`
    );
  else
    note(
      `${tag}: <head> and app.js agree over ${STATES.length} stored states (${wanted} preload, each the one request)`
    );
  return STATES.length;
}

// ── section: window ─────────────────────────────────────────────────────────
// The same steps in both builds; the lazy page with the prose held back.
const SEARCH = (q) => `
  const s = document.getElementById('genre-search');
  s.value = ${JSON.stringify(q)};
  s.dispatchEvent(new window.Event('input'));`;
const WINDOW_STEPS = [
  [
    'W1',
    `return {
      starters: STARTER_TRADITIONS.slice().sort(),
      prosed: Catalog.all().filter((t) => Catalog.hasProse(t.id)).map((t) => t.id).sort(),
      core: Catalog.all().map((t) => { const x = Catalog.ext(t.id) || {}; return [t.id, t.name, t.family, x.parent || null, ${JSON.stringify(AXIS_KEYS)}.map((k) => (x.axes && typeof x.axes[k] === 'number' ? x.axes[k] : 0)), t.instruments || [], x.crossRefs || [], x.status || null]; }),
    };`,
  ],
  [
    'W2',
    `${SEARCH('polyrhythm')}
    return { text: document.getElementById('genre-list').textContent, n: gpResults().length };`,
  ],
  [
    'W3',
    `document.querySelector('[data-ui="genre-layout"][data-id="list"]').click();
    ${SEARCH('blues')}
    return { ids: gpResults().map((r) => r.t.id), names: Object.fromEntries(gpResults().map((r) => [r.t.id, normalizeSearch(r.t.name).includes(gpQuery())])),
      count: document.getElementById('gp-count')?.textContent || '' };`,
  ],
  [
    'W4',
    `${SEARCH('griot')}
    UI.genre = 'bluegrass'; G.detailTab = 'background'; gpRenderMain();
    return { bg: document.getElementById('gp-panel-background')?.textContent || '', list: document.getElementById('genre-list').innerHTML };`,
  ],
  [
    'W5',
    `app.similarFor = null; app.tradSearch = 'griot'; renderTradPicker();
    const p = document.getElementById('picker-trad');
    return { html: p.innerHTML, text: p.textContent,
      matches: p.querySelectorAll('.tree-search-result').length,
      nonStarterDesc: [...p.querySelectorAll('.tree-search-result')].filter((r) => r.querySelector('.trad-leaf-desc') && !STARTER_TRADITIONS.includes(r.querySelector('[data-import]')?.dataset.import)).length };`,
  ],
];
async function windowSection(embedHtml, lazyHtml) {
  const embedDom = bootDom(embedHtml, makeFetchShim({ deny: '*' }), { url: SITE });
  const hold = { 'api/browse_prose.json': deferred(), 'api/engine.json': deferred() };
  const lazyDom = bootDom(lazyHtml, makeFetchShim({ deny: ['api/tradition_images.json'], hold }), {
    url: SITE,
  });
  const e = {},
    l = {};
  try {
    await Promise.all([
      runProbe(embedDom, SETTLE),
      runProbe(lazyDom, SETTLE, 15000, { prose: false }),
    ]);
    for (const [k, body] of WINDOW_STEPS) {
      e[k] = await runProbe(embedDom, body);
      l[k] = await runProbe(lazyDom, body, 15000, { prose: false });
      if (e[k].__err || l[k].__err)
        return fail(`window ${k}: probe crashed: ${e[k].__err || l[k].__err}`);
    }
    // W1. The boot index carries exactly the page's starters' prose, and every
    // genre's light fields as the embedded build has them.
    if (JSON.stringify(l.W1.prosed) !== JSON.stringify(l.W1.starters))
      fail(
        `window W1: the boot index carries prose for ${JSON.stringify(l.W1.prosed)}, the page's STARTER_TRADITIONS are ${JSON.stringify(l.W1.starters)}`
      );
    if (JSON.stringify(l.W1.core) !== JSON.stringify(e.W1.core))
      fail(
        "window W1: a genre's name, family, parent, axes, roster, cross-listing or status differs from the embedded build"
      );
    // W2. A search no name matches says only names were searched.
    if (!e.W2.n)
      fail('window W2: "polyrhythm" matches nothing in the embedded build — the check is vacuous');
    if (
      !/No genre names match/.test(l.W2.text) ||
      !/still loading/.test(l.W2.text) ||
      /No genres match|Search covers names, lineage and descriptions/.test(l.W2.text)
    )
      fail(
        `window W2: a names-only search with no hits claimed absence: ${JSON.stringify(l.W2.text.slice(0, 200))}`
      );
    // W3. Names only, the full search's name matches in its order, labelled.
    const want = e.W3.ids.filter((id) => e.W3.names[id]);
    if (want.length === e.W3.ids.length)
      fail('window W3: "blues" has no description-only matches — the check is vacuous');
    if (JSON.stringify(l.W3.ids) !== JSON.stringify(want))
      fail(
        `window W3: the names-only search lists ${l.W3.ids.length} genres; want the full search's ${want.length} name matches in its order`
      );
    if (!/names only/.test(l.W3.count))
      fail(`window W3: the count line does not say names only: ${JSON.stringify(l.W3.count)}`);
    // W4. A detail's prose says it is loading; the boot index's status shows.
    const status = (e.W4.bg.match(/Catalog status: [^.]+\./) || [''])[0];
    if (!status)
      fail('window W4: the embedded Background tab has no catalog status — the check is vacuous');
    if (
      !/Loading/.test(l.W4.bg) ||
      (status && !l.W4.bg.includes(status)) ||
      /has no description|names no exemplar artists/.test(l.W4.bg)
    )
      fail(
        `window W4: the Background tab before the prose: ${JSON.stringify(l.W4.bg.slice(0, 240))}`
      );
    // W5. The picker searches names only, says so, and shows no non-starter prose.
    if (!/names only/.test(l.W5.text) || !(l.W5.matches < e.W5.matches) || l.W5.nonStarterDesc)
      fail(
        `window W5: picker before the prose — ${l.W5.matches} of ${e.W5.matches} matches, names-only label ${/names only/.test(l.W5.text)}, ${l.W5.nonStarterDesc} non-starter description(s)`
      );
    // AFTER. Release; the list and the picker on screen are the embedded
    // build's, with no re-render by this probe.
    if (lazyDom.window.eval('Engine.ready()')) fail('window: the engine was ready while held');
    const guardW = lazyDom.window.eval('Engine.misses()');
    if (guardW) fail(`window: ${guardW} engine read(s) before the engine landed`);
    hold['api/browse_prose.json'].release();
    hold['api/engine.json'].release();
    const after = await runProbe(
      lazyDom,
      `${FRAMES(3)}
      return { list: document.getElementById('genre-list').innerHTML, picker: document.getElementById('picker-trad').innerHTML };`
    );
    if (after.__err) fail('window AFTER: probe crashed: ' + after.__err);
    else {
      if (after.list !== e.W4.list)
        fail(
          `window AFTER: the names-only list was not redrawn as the embedded build's once the prose landed ${firstDiff(after.list, e.W4.list)}`
        );
      if (after.picker !== e.W5.html)
        fail(
          `window AFTER: the picker was not redrawn as the embedded build's once the prose landed ${firstDiff(after.picker, e.W5.html)}`
        );
    }
    note(
      'window: names-only search, loading wording, starters exact; list and picker identical after'
    );
  } finally {
    embedDom.window.close();
    lazyDom.window.close();
  }
}

// ── section: engine ─────────────────────────────────────────────────────────
// Each check boots its own lazy page with api/engine.json held back; one
// embedded page takes the same steps in turn, as the reference.

// A probe's ceiling here and in F4, where pages boot side by side and the
// engine loads in idle slices behind them: it only bounds a hang.
const E_WAIT = 60000;

// What a reader sees: the body without its inline scripts.
const PAGE_TEXT = `[...document.body.children].filter((e) => !/^(SCRIPT|STYLE|TEMPLATE)$/.test(e.tagName)).map((e) => e.textContent).join(' ')`;
// "Not loaded yet" must never read as "none".
const ABSENT =
  /\b0 instruments\b|No instruments match|has no recognised instruments|Unknown instrument/;
// Ids the app generates (newId: prefix_counter_time) differ between boots.
const IDS = `.replace(/\\b(?:card|ws|id)_\\d+_[0-9a-z]{1,4}\\b/g, 'ID')`;
// What a step left: the recipe's cards and its pasteable string, or the
// Instrument page's list and preview.
const CARDS_STATE = `return { n: app.cards.length, cards: JSON.stringify(app.cards)${IDS}, recipe: compressRichRecipe(app.cards, 1000) };`;
const INSPECT_STATE = `return { body: document.getElementById('instrument-body').innerHTML${IDS}, preview: document.getElementById('instrument-preview').innerHTML${IDS} };`;

// A lazy page with the engine held: { dom, w, log, bodies, hold }.
function heldLazy(lazyHtml, { onWindow } = {}) {
  const ref = {},
    log = [],
    bodies = [],
    hold = { 'api/engine.json': deferred() };
  const dom = bootDom(
    lazyHtml,
    makeFetchShim({
      deny: ['api/tradition_images.json'],
      log,
      bodies,
      hold,
      stamp: () => drawn(ref.w),
    }),
    {
      url: SITE,
      onWindow: (w) => {
        ref.w = w;
        if (onWindow) onWindow(w);
      },
    }
  );
  return { dom, w: dom.window, log, bodies, hold };
}

// Run `tasks` (functions returning promises) at most `n` at a time.
async function pool(tasks, n) {
  const out = [];
  let next = 0;
  const lane = async () => {
    while (next < tasks.length) {
      const k = next++;
      out[k] = await tasks[k]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, lane));
  return out;
}

// E3: every action that creates cards or shows one instrument — [label, the
// step, 'inspect' for the one that shows an instrument]. The recipe a session
// file, a saved session and the AI writer bring is WS's.
const E3_CARDS = JSON.stringify(JSON.parse(WS).cards);
const E3_STEPS = [
  ['add a genre', 'window.__act = uiAddGenre(STARTER_TRADITIONS[0]);'],
  ['add an instrument on its own', "window.__act = uiAddInstrument('voice', { destination: '' });"],
  [
    'add an instrument to the featured genre',
    "window.__act = uiAddInstrument('voice', { destination: STARTER_TRADITIONS[0] });",
  ],
  ['Surprise me', 'Math.random = () => 0; surpriseTradition();'],
  [
    'import a session file',
    `const file = new File([${JSON.stringify(WS)}], 'codex-musica-session.json', { type: 'application/json' });
    file.text = async () => ${JSON.stringify(WS)}; // jsdom's File has no text()
    window.__act = uiImport(file);`,
  ],
  [
    'open a saved session',
    `window.storage.get = async (key) => (key === 'codex:ws:e3' ? { value: JSON.stringify({ schema: WS_SCHEMA, name: 'E3', cards: ${E3_CARDS} }) } : null);
    window.__act = restoreSavedWorkspace('codex:ws:e3', false);`,
  ],
  [
    "the AI writer's Use recipe",
    `const node = document.createElement('div');
    document.getElementById('chat-log').append(node);
    uiReceiveReply({ recipe: 'E3', workspace: { cards: ${E3_CARDS} } }, null);
    const use = [...node.querySelectorAll('button')].find((b) => /Use recipe/.test(b.textContent));
    if (!use) throw Error('uiReceiveReply drew no Use recipe button');
    use.click();`,
  ],
  ['inspect an instrument', "window.__act = uiInspectInstrument('voice');", 'inspect'],
];
// After the step: wait for it to finish, then read what it left.
const E3_FINISH = (kind) => `
  if (window.__act) await window.__act;
  for (let i = 0; i < 400 && !(${kind === 'inspect' ? "UI.instrumentPreview === 'voice' && !!IP.card" : 'app.cards.length > 0'}); i++)
    await new Promise((r) => setTimeout(r, 25));
  ${FRAMES(2)}
  ${kind === 'inspect' ? INSPECT_STATE : CARDS_STATE}`;
// The embedded reference starts each card step from an empty recipe, as a
// fresh boot does; Surprise me's Math.random is put back.
const E3_RESET = `
  if (!window.__random) window.__random = Math.random;
  Math.random = window.__random;
  window.__act = null;
  app.cards = []; app.history = []; app.historyIndex = -1; pushHistory(); renderAll();`;

// E4: the picker's similar view of the featured genre, then "From here".
const E4_STEP = `
  app.similarFor = STARTER_TRADITIONS[0]; app.tradSearch = ''; renderTradPicker();
  const from = document.querySelector('#picker-trad [data-similar]');
  if (!from) throw Error('the similar view drew no "From here" button');
  window.__e4 = [STARTER_TRADITIONS[0], from.dataset.similar];
  from.click();`;
// E5: a search on the Instrument page.
const E5_STEP = `
  uiNavigate('instrument');
  const s = document.getElementById('instrument-search');
  s.focus(); s.value = 'guitar'; s.dispatchEvent(new window.Event('input', { bubbles: true }));`;
const E5_STATE = `const s = document.getElementById('instrument-search');
  return { body: document.getElementById('instrument-body').innerHTML, total: document.getElementById('ip-total').textContent, focused: document.activeElement === s, value: s.value };`;

// The embedded page, every reference the selected checks use, in turn: E1's
// instruments, E4's picker, E5's search (then cleared), the inspector, then
// each card step (E3).
async function engineReference(embedHtml) {
  const need = (...ids) => ids.some((id) => ONLY_CHECKS.includes(id));
  if (!need('E1', 'E3', 'E4', 'E5')) return { e3: {} };
  const dom = bootDom(embedHtml, makeFetchShim({ deny: '*' }), { url: SITE });
  const probe = (body) => runProbe(dom, body, E_WAIT);
  try {
    const ref = { e3: {} };
    await probe(SETTLE);
    if (need('E1'))
      ref.inst = await probe(
        'return Object.fromEntries(INSTRUMENTS.map((i) => { const x = Inst(i.id); return [i.id, [x.name, x.short == null ? null : x.short, x.family]]; }));'
      );
    if (need('E4'))
      ref.similar = await probe(
        `${E4_STEP}
      ${FRAMES(2)}
      const out = { ids: window.__e4, html: document.getElementById('picker-trad').innerHTML };
      app.similarFor = null; renderTradPicker();
      return out;`
      );
    if (need('E5'))
      ref.search = await probe(
        `${E5_STEP}
      ${FRAMES(2)}
      const out = (() => { ${E5_STATE} })();
      s.value = ''; s.dispatchEvent(new window.Event('input', { bubbles: true })); s.blur();
      uiNavigate('genre');
      return out;`
      );
    const steps = need('E3') ? E3_STEPS : [];
    const inspectFirst = [...steps].sort((a, b) => (b[2] === 'inspect') - (a[2] === 'inspect'));
    for (const [label, step, kind] of inspectFirst)
      ref.e3[label] = await probe(`${E3_RESET} ${step} ${E3_FINISH(kind)}`);
    for (const [k, v] of Object.entries({ ...ref, ...ref.e3 }))
      if (v && v.__err) return { __err: `${k}: ${v.__err}` };
    return ref;
  } catch (e) {
    return { __err: e.message };
  } finally {
    dom.window.close();
  }
}

// E0. One request after the boot index, before the first view is drawn;
// loading, and no prose, while held; once released, one prose request after
// the engine's body.
async function engineE0(lazyHtml) {
  const tag = 'engine E0';
  const L = heldLazy(lazyHtml);
  try {
    const booted = await runProbe(L.dom, SETTLE, E_WAIT, { prose: false });
    if (booted.__err) return fail(`${tag}: probe crashed: ${booted.__err}`);
    await sleep(300);
    const asks = fetchesOf(L.log, 'api/engine.json');
    if (asks.length !== 1 || asks[0].ready !== true)
      fail(
        `${tag}: want 1 request for api/engine.json, made after the first view; saw ${JSON.stringify(asks)}`
      );
    const prose = fetchesOf(L.log, 'api/browse_prose.json');
    if (prose.length)
      fail(
        `${tag}: the genre prose was requested while the instrument data was held (${JSON.stringify(prose)})`
      );
    const early = beforeEngineBody(L.log, L.bodies, OPTIONAL_ALL);
    if (early.length)
      fail(
        `${tag}: ${early.map((e) => e.rel).join(', ')} requested while the instrument data was held`
      );
    const state = L.w.eval('Engine.state()');
    if (state !== 'loading')
      fail(
        `${tag}: Engine.state() is ${JSON.stringify(state)} while its request is held; want "loading"`
      );
    L.hold['api/engine.json'].release();
    const ready = await runProbe(
      L.dom,
      'await Engine.whenReady(); return Engine.state();',
      E_WAIT,
      {
        prose: false,
      }
    );
    await waitFor(() => fetchesOf(L.log, 'api/browse_prose.json').length > 0, 10000, 'prose').catch(
      () => {}
    );
    const after = fetchesOf(L.log, 'api/browse_prose.json');
    const body = L.bodies.find((b) => b.rel === 'api/engine.json');
    if (ready !== 'ready')
      fail(`${tag}: after the release Engine.state() is ${JSON.stringify(ready)}`);
    if (after.length !== 1 || !body || after[0].n < body.n)
      fail(
        `${tag}: once the instrument data was delivered the prose was not requested exactly once after it (${JSON.stringify(after)}, engine body ${JSON.stringify(body)})`
      );
    else note(`${tag}: 1 engine request after the first view; the prose followed its body`);
  } finally {
    L.dom.window.close();
  }
}

// E1. The first view's instrument index is the engine's names and families.
async function engineE1(lazyHtml, refP) {
  const tag = 'engine E1';
  const L = heldLazy(lazyHtml);
  try {
    await runProbe(L.dom, SETTLE, E_WAIT, { prose: false });
    const r = await runProbe(
      L.dom,
      `const lite = {};
      for (const [id] of INSTRUMENT_INDEX) { const x = InstLite(id); lite[id] = x ? [x.name, x.short == null ? null : x.short, x.family] : null; }
      const unknown = InstLite('__not_an_instrument__');
      const before = Engine.misses();
      let thrown = null;
      try { Inst('voice'); } catch (e) { thrown = { name: e.name, typed: e instanceof EngineNotReadyError }; }
      return { lite, unknown: unknown === undefined, before, thrown, after: Engine.misses(), ready: Engine.ready() };`,
      E_WAIT,
      { prose: false }
    );
    const ref = await refP;
    if (r.__err || ref.__err) return fail(`${tag}: probe crashed: ${r.__err || ref.__err}`);
    if (r.ready) fail(`${tag}: the engine was ready while held — vacuous`);
    const ids = [...new Set([...Object.keys(ref.inst), ...Object.keys(r.lite)])].sort();
    const off = ids.filter((id) => JSON.stringify(r.lite[id]) !== JSON.stringify(ref.inst[id]));
    if (!Object.keys(ref.inst).length)
      fail(`${tag}: the embedded build has no instruments — vacuous`);
    if (off.length)
      fail(
        `${tag}: InstLite differs from the embedded Inst for ${off.length} of ${ids.length} instrument(s), e.g. ${off
          .slice(0, 3)
          .map(
            (id) =>
              `${id}: ${JSON.stringify(r.lite[id] ?? 'absent')} vs ${JSON.stringify(ref.inst[id] ?? 'absent')}`
          )
          .join('; ')} (name, short, family)`
      );
    if (!r.unknown) fail(`${tag}: InstLite of an unknown id is not undefined`);
    if (!r.thrown || r.thrown.name !== 'EngineNotReadyError' || !r.thrown.typed)
      fail(
        `${tag}: Inst('voice') before the engine ${r.thrown ? `threw ${r.thrown.name}` : 'did not throw'}; want EngineNotReadyError`
      );
    if (r.before !== 0 || r.after !== 1)
      fail(`${tag}: Engine.misses() went ${r.before} → ${r.after} over one Inst(); want 0 → 1`);
    if (!off.length)
      note(
        `${tag}: InstLite ≡ embedded Inst for ${ids.length} instruments; Inst() throws, counted`
      );
  } finally {
    L.dom.window.close();
  }
}

// E3. One action, in its own boot: it waits, saying so, then completes as the
// embedded build's does.
async function engineAction(lazyHtml, [label, step, kind], refP) {
  const tag = `engine E3 (${label})`;
  const L = heldLazy(lazyHtml);
  try {
    await runProbe(L.dom, SETTLE, E_WAIT, { prose: false });
    const held = await runProbe(
      L.dom,
      `${step}
      await new Promise((r) => setTimeout(r, 300));
      return { cards: app.cards.length, ready: Engine.ready(), misses: Engine.misses(),
        toast: document.getElementById('toast')?.textContent || '',
        pending: !!document.querySelector('[data-engine-pending]') };`,
      E_WAIT,
      { prose: false }
    );
    if (held.__err) return fail(`${tag}: probe crashed: ${held.__err}`);
    if (held.ready) fail(`${tag}: the engine was ready while held — vacuous`);
    if (held.cards)
      fail(
        `${tag}: made ${held.cards} card(s) before the instrument data landed — an action must wait for it`
      );
    if (held.misses)
      fail(
        `${tag}: ${held.misses} engine read(s) before the instrument data landed — an action must wait for it`
      );
    if (!/Preparing the instrument data/.test(held.toast) && !held.pending)
      fail(
        `${tag}: while it waits the page neither says it is preparing the instrument data nor draws a loading state (toast ${JSON.stringify(held.toast)})`
      );
    L.hold['api/engine.json'].release();
    const done = await runProbe(L.dom, `await Engine.whenReady(); ${E3_FINISH(kind)}`, E_WAIT, {
      prose: false,
    });
    const ref = await refP;
    if (done.__err || ref.__err) return fail(`${tag}: probe crashed: ${done.__err || ref.__err}`);
    const want = ref.e3[label];
    if (kind === 'inspect') {
      if (!want.preview) fail(`${tag}: the embedded inspector is empty — vacuous`);
      for (const k of ['body', 'preview'])
        if (done[k] !== want[k])
          fail(
            `${tag}: once the instrument data landed #instrument-${k} differs from the embedded build ${firstDiff(done[k], want[k])}`
          );
    } else {
      if (!want.n) fail(`${tag}: the embedded build made no card — vacuous`);
      if (done.cards !== want.cards)
        fail(
          `${tag}: once the instrument data landed it made ${done.n} card(s), not the embedded build's ${want.n} ${firstDiff(done.cards, want.cards)}`
        );
      else if (done.recipe !== want.recipe)
        fail(
          `${tag}: once the instrument data landed the recipe string differs from the embedded build's`
        );
    }
    note(
      `${tag}: waited (${held.pending ? 'loading state' : 'toast'}), then matched the embedded build`
    );
  } finally {
    L.dom.window.close();
  }
}

// E4. The picker's similar view: the instruments that fit say they are loading
// and nothing is computed or cached; released, the picker redraws itself.
async function engineSimilar(lazyHtml, refP) {
  const tag = 'engine E4';
  const L = heldLazy(lazyHtml);
  try {
    await runProbe(L.dom, SETTLE, E_WAIT, { prose: false });
    const held = await runProbe(
      L.dom,
      `${E4_STEP}
      const p = document.getElementById('picker-trad');
      return { ids: window.__e4, similarFor: app.similarFor, ready: Engine.ready(), misses: Engine.misses(),
        pending: !!p.querySelector('.fit-instruments[data-engine-pending="fits"][role="status"]'),
        canon: /Instruments outside the canon/.test(p.textContent),
        cached: _TRAD_CENTROID_CACHE ? window.__e4.filter((id) => _TRAD_CENTROID_CACHE.has(id)) : [] };`,
      E_WAIT,
      { prose: false }
    );
    if (held.__err) return fail(`${tag}: probe crashed: ${held.__err}`);
    if (held.ready) fail(`${tag}: the engine was ready while held — vacuous`);
    if (held.similarFor !== held.ids[1])
      fail(`${tag}: "From here" did not move the similar view to ${held.ids[1]} — vacuous`);
    if (!held.pending || held.canon)
      fail(
        `${tag}: the similar view before the instrument data ${held.canon ? 'listed instruments outside the canon' : 'does not mark the instruments that fit as loading (role=status, data-engine-pending="fits")'}`
      );
    if (held.misses) fail(`${tag}: ${held.misses} engine read(s) in the similar view while held`);
    if (held.cached.length)
      fail(
        `${tag}: the centroid cache holds ${JSON.stringify(held.cached)} — computed without the instrument data`
      );
    L.hold['api/engine.json'].release();
    // No re-render by this probe: the picker redraws itself as the data and
    // then the prose (which follows the data) land.
    const after = await runProbe(
      L.dom,
      `await Engine.whenReady(); await Catalog.whenProse(); ${FRAMES(3)}
      return { html: document.getElementById('picker-trad').innerHTML, similarFor: app.similarFor };`,
      E_WAIT,
      { prose: false }
    );
    const ref = await refP;
    if (after.__err || ref.__err) return fail(`${tag}: probe crashed: ${after.__err || ref.__err}`);
    if (JSON.stringify(ref.similar.ids) !== JSON.stringify(held.ids))
      fail(
        `${tag}: "From here" went to ${held.ids[1]}, the embedded build's to ${ref.similar.ids[1]}`
      );
    else if (!/Instruments outside the canon/.test(ref.similar.html))
      fail(`${tag}: the embedded similar view lists no instruments that fit — vacuous`);
    else if (after.html !== ref.similar.html)
      fail(
        `${tag}: once the instrument data landed the similar view was not redrawn as the embedded build's ${firstDiff(after.html, ref.similar.html)}`
      );
    else note(`${tag}: loading, nothing cached; redrawn as the embedded build's`);
  } finally {
    L.dom.window.close();
  }
}

// E5. A search on the Instrument page while it loads stays pending; released,
// the list is the embedded build's and the search box keeps the focus.
async function engineSearch(lazyHtml, refP) {
  const tag = 'engine E5';
  const L = heldLazy(lazyHtml);
  try {
    await runProbe(L.dom, SETTLE, E_WAIT, { prose: false });
    const held = await runProbe(
      L.dom,
      `${E5_STEP}
      await new Promise((r) => setTimeout(r, 100));
      const b = document.getElementById('instrument-body');
      return { pending: !!b.querySelector('[data-engine-pending="instruments"][role="status"]'),
        total: document.getElementById('ip-total').textContent, text: b.textContent,
        misses: Engine.misses(), ready: Engine.ready() };`,
      E_WAIT,
      { prose: false }
    );
    if (held.__err) return fail(`${tag}: probe crashed: ${held.__err}`);
    if (held.ready) fail(`${tag}: the engine was ready while held — vacuous`);
    if (
      !held.pending ||
      held.total ||
      /\d[\d,]*\s+instruments?\b/.test(held.text) ||
      ABSENT.test(held.text)
    )
      fail(
        `${tag}: a search while the instrument data loads reads ${JSON.stringify(held.text.slice(0, 160))} (count ${JSON.stringify(held.total)}); want the loading state and no count`
      );
    if (held.misses) fail(`${tag}: ${held.misses} engine read(s) in a search while held`);
    L.hold['api/engine.json'].release();
    const after = await runProbe(
      L.dom,
      `await Engine.whenReady(); ${FRAMES(3)} ${E5_STATE}`,
      E_WAIT,
      {
        prose: false,
      }
    );
    const ref = await refP;
    if (after.__err || ref.__err) return fail(`${tag}: probe crashed: ${after.__err || ref.__err}`);
    if (!ref.search.total) fail(`${tag}: the embedded search shows no count — vacuous`);
    if (after.body !== ref.search.body || after.total !== ref.search.total)
      fail(
        `${tag}: once the instrument data landed the search differs from the embedded build's ${firstDiff(after.body + after.total, ref.search.body + ref.search.total)}`
      );
    if (!after.focused || after.value !== ref.search.value)
      fail(
        `${tag}: once the instrument data landed the search box ${after.focused ? `reads ${JSON.stringify(after.value)}` : 'lost the focus'}`
      );
    else note(`${tag}: pending with no count; then the embedded list, focus kept`);
  } finally {
    L.dom.window.close();
  }
}

// E2. A sweep: every distinct control on every route and in a genre's
// detail, the header's add, saved, undo and redo, and the tree's expand,
// find-similar, back and import, with the engine held throughout. The file import (a file picker) and the
// downloads (jsdom has no URL.createObjectURL) are left out. It runs alone:
// it counts every unhandled rejection in this process.
const E2_SKIP = ['import', 'export', 'ly-download', 'ly-export-session'];
async function engineSweep(lazyHtml) {
  const tag = 'engine E2';
  const errors = [],
    rejections = [],
    bad = [];
  const L = heldLazy(lazyHtml, {
    onWindow: (w) => {
      w.addEventListener('error', (e) => errors.push(String(e.message || e.error)));
      w.console.error = (...a) =>
        errors.push('console.error ' + a.map((x) => String((x && x.stack) || x)).join(' '));
    },
  });
  const onRejection = (r) => rejections.push(String((r && r.stack) || r).split('\n')[0]);
  process.on('unhandledRejection', onRejection);
  const w = L.w;
  let clicks = 0,
    cards = 0,
    misses = 0,
    absent = null;
  const routes = {};
  // After each click: no card, no engine read, no absence claim, no error.
  const check = (what) => {
    const s = w.eval(`({ cards: app.cards.length, misses: Engine.misses(), text: ${PAGE_TEXT} })`);
    const issues = [];
    if (s.cards > cards) issues.push(`${s.cards} card(s)`);
    if (s.misses > misses) issues.push(`${s.misses - misses} engine read(s)`);
    [cards, misses] = [s.cards, s.misses];
    const m = s.text.match(ABSENT);
    const said = m
      ? s.text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 20).replace(/\s+/g, ' ')
      : null;
    if (said && said !== absent) issues.push(`the page reads ${JSON.stringify(said)}`);
    absent = said;
    if (errors.length) issues.push(`error: ${errors.splice(0).join(' | ').slice(0, 300)}`);
    if (rejections.length)
      issues.push(`unhandled rejection: ${rejections.splice(0).join(' | ').slice(0, 300)}`);
    if (issues.length) bad.push(`${what}: ${issues.join('; ')}`);
  };
  const click = async (what, expr) => {
    let v;
    try {
      v = w.eval(expr);
    } catch (e) {
      bad.push(`${what}: threw ${String((e && e.message) || e).slice(0, 200)}`);
      return null;
    }
    if (v === null || v === false) return v;
    clicks++;
    await sleep(20);
    check(typeof v === 'string' ? `${what} [data-ui="${v}"]` : what);
    return v;
  };
  try {
    const booted = await runProbe(L.dom, SETTLE, E_WAIT, { prose: false });
    if (booted.__err) return fail(`${tag}: probe crashed: ${booted.__err}`);
    check('the first view');
    // Every route, then a genre's detail (its tab panels hold the roster's
    // Inspect and Add), opened again before each click in it.
    const views = [
      ...w
        .eval('UI_ROUTES.map((r) => r[0])')
        .map((r) => [r, '[data-ui]', `if (UI.view !== '${r}') uiNavigate('${r}');`]),
      [
        "a genre's detail",
        '#genre-detail [data-ui]',
        "uiNavigate('genre'); gpSelect(STARTER_TRADITIONS[0]);",
      ],
    ];
    for (const [view, sel, setup] of views) {
      const seen = new Set(E2_SKIP);
      for (;;) {
        const v = await click(
          `on ${view}`,
          `(() => {
            ${setup}
            const skip = new Set(${JSON.stringify([...seen])});
            const el = [...document.querySelectorAll('${sel}')].find((e) => !skip.has(e.dataset.ui));
            if (!el) return null;
            el.click();
            return el.dataset.ui;
          })()`
        );
        if (v === null) break;
        seen.add(v);
      }
      routes[view] = seen.size - E2_SKIP.length;
    }
    w.eval("uiNavigate('genre')");
    for (const id of ['btn-traditions', 'btn-add', 'btn-saved', 'btn-undo', 'btn-redo'])
      if (
        !(await click(
          `#${id}`,
          `(() => { const el = document.getElementById('${id}'); if (!el) return false; el.click(); return true; })()`
        ))
      )
        bad.push(`#${id} is not on the page — the sweep is incomplete`);
    w.eval("uiNavigate('genre'); document.getElementById('btn-traditions').click()");
    for (const sel of [
      '[data-toggle-tree]',
      '[data-similar]',
      '[data-similar-back]',
      '[data-import]',
    ])
      if (
        !(await click(
          `the tree's ${sel}`,
          `(() => { const el = document.querySelector('#picker-trad ${sel}'); if (!el) return false; el.click(); return true; })()`
        ))
      )
        bad.push(`the tree has no ${sel} — the sweep is incomplete`);
    await sleep(200);
    check('after the sweep');
    if (w.eval('Engine.ready()')) fail(`${tag}: the engine was ready while held — vacuous`);
    // Every route drawn, the Instrument and Genre pages among them, and still
    // no optional download: each waits for the instrument data's bytes.
    const early = beforeEngineBody(L.log, L.bodies, OPTIONAL_ALL);
    if (early.length)
      fail(
        `${tag}: ${[...new Set(early.map((e) => e.rel))].join(', ')} requested while the instrument data was held`
      );
    const thin = Object.entries(routes).filter(([, n]) => n < 5);
    if (thin.length)
      fail(
        `${tag}: too few controls clicked on ${JSON.stringify(Object.fromEntries(thin))} — vacuous`
      );
  } finally {
    process.off('unhandledRejection', onRejection);
    L.dom.window.close();
  }
  for (const b of bad.slice(0, 6)) fail(`${tag}: ${b}`);
  if (bad.length > 6) fail(`${tag}: …and ${bad.length - 6} more`);
  if (!bad.length)
    note(
      `${tag}: ${clicks} clicks (${JSON.stringify(routes)} distinct controls per route), all clean`
    );
  return clicks;
}

// E6. The direct reads of the engine tables in src/, from the AST: an
// identifier that is not a property name or an object key, counted by the
// function it is read in: { file: { table: { function: reads } } }.
function engineReaders() {
  const espree = require(
    require.resolve('espree', { paths: [path.dirname(require.resolve('eslint'))] })
  );
  const names = new Set(ENGINE_TABLES);
  const readers = {};
  const files = ['src', 'src/pages']
    .flatMap((d) =>
      fs
        .readdirSync(path.join(ROOT, d))
        .filter((f) => f.endsWith('.js'))
        .map((f) => `${d}/${f}`)
    )
    .sort();
  const KEYED = /^(Property|MethodDefinition|PropertyDefinition)$/;
  for (const file of files) {
    const ast = espree.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'), {
      ecmaVersion: 'latest',
      sourceType: 'script',
    });
    const walk = (node, parent, key, fn) => {
      if (!node || typeof node.type !== 'string') return;
      if (/^Function(Declaration|Expression)$/.test(node.type) && node.id) fn = node.id.name;
      else if (
        node.type === 'VariableDeclarator' &&
        node.id.type === 'Identifier' &&
        /Function|Arrow/.test((node.init && node.init.type) || '')
      )
        fn = node.id.name;
      else if (
        KEYED.test(node.type) &&
        !node.computed &&
        /Function|Arrow/.test((node.value && node.value.type) || '')
      )
        fn = node.key.name || String(node.key.value);
      if (
        node.type === 'Identifier' &&
        names.has(node.name) &&
        !(parent.type === 'MemberExpression' && key === 'property' && !parent.computed) &&
        !(KEYED.test(parent.type) && key === 'key' && !parent.computed)
      ) {
        const w = (readers[file] = readers[file] || {});
        const t = (w[node.name] = w[node.name] || {});
        t[fn] = (t[fn] || 0) + 1;
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (Array.isArray(v)) for (const x of v) walk(x, node, k, fn);
        else if (v && typeof v === 'object') walk(v, node, k, fn);
      }
    };
    walk(ast, null, null, '(top level)');
  }
  return readers;
}
// The reads per function, ENGINE_READERS against the tree: one line per
// function whose count moved. A count kept the same by a read added in one
// place and removed in another still moves two functions, unless both are in
// the same one.
function engineReadersCheck() {
  const readers = engineReaders();
  const diffs = [];
  let total = 0;
  for (const file of [...new Set([...Object.keys(ENGINE_READERS), ...Object.keys(readers)])].sort())
    for (const t of ENGINE_TABLES) {
      const want = (ENGINE_READERS[file] || {})[t] || {},
        got = (readers[file] || {})[t] || {};
      for (const fn of [...new Set([...Object.keys(want), ...Object.keys(got)])].sort()) {
        total += got[fn] || 0;
        if ((want[fn] || 0) !== (got[fn] || 0))
          diffs.push(`${file} ${t} in ${fn}: ${want[fn] || 0} → ${got[fn] || 0}`);
      }
    }
  if (diffs.length)
    fail(
      `engine E6: the direct reads of the engine tables changed: ${diffs.join('; ')}. A reader must run only once the instrument data has loaded (behind _engineLive, Engine.ensure() or engineReady(), or on a card); review it, then regenerate ENGINE_READERS with node scripts/check_lazy_app.js --print-readers`
    );
  else
    note(
      `engine E6: ${total} direct reads in ${Object.keys(readers).length} files, each in the function listed`
    );
  return total;
}
function printReaders() {
  console.log(`const ENGINE_READERS = ${JSON.stringify(engineReaders(), null, 2)};`);
}

// The checks --checks selected (all by default), each in its own boot, three
// at a time beside the embedded reference; E2 alone after them (it counts
// every unhandled rejection in this process).
async function engineSection(embedHtml, lazyHtml) {
  const on = (id) => ONLY_CHECKS.includes(id);
  const reads = on('E6') ? engineReadersCheck() : null;
  const refP = engineReference(embedHtml);
  const guard = (name, run) => () =>
    run().catch((e) => fail(`engine ${name}: harness error: ${(e && e.message) || e}`));
  const tasks = {
    E0: [guard('E0', () => engineE0(lazyHtml))],
    E1: [guard('E1', () => engineE1(lazyHtml, refP))],
    E3: E3_STEPS.map((s) => guard(`E3 (${s[0]})`, () => engineAction(lazyHtml, s, refP))),
    E4: [guard('E4', () => engineSimilar(lazyHtml, refP))],
    E5: [guard('E5', () => engineSearch(lazyHtml, refP))],
  };
  await Promise.all([
    refP,
    pool(
      Object.entries(tasks).flatMap(([id, t]) => (on(id) ? t : [])),
      3
    ),
  ]);
  const clicks = on('E2') ? await engineSweep(lazyHtml) : null;
  return { clicks, reads };
}

// ── section: failure ────────────────────────────────────────────────────────
async function failure(lazyHtml) {
  // F1. The boot index unreachable → the honest boot-error state.
  const deadDom = bootDom(lazyHtml, makeFetchShim({ deny: ['api/browse_boot.json'] }));
  await waitFor(
    () => deadDom.window.document.getElementById('boot-error'),
    10000,
    'no boot-error'
  ).then(
    () => note('boot index failure renders the error state'),
    () => fail('browse_boot.json failure did NOT render the boot-error state (silent blank app)')
  );
  deadDom.window.close();

  // F2. The prose unreachable → a working app that says what it could not load.
  {
    const log = [];
    let w = null;
    const dom = bootDom(
      lazyHtml,
      makeFetchShim({ deny: ['api/browse_prose.json', 'api/tradition_images.json'], log }),
      { url: SITE, onWindow: (x) => (w = x) }
    );
    try {
      await waitFor(() => w.eval('Catalog.proseFailed()'), 10000, 'proseFailed never set');
      const r = await runProbe(
        dom,
        `const out = { bootError: !!document.getElementById('boot-error') };
        const lede = document.querySelector('#genre-detail .gp-lede');
        out.featured = !!lede && !lede.hasAttribute('data-prose-pending');
        UI.genre = 'bluegrass'; G.detailTab = 'background'; gpRenderMain();
        const bg = document.getElementById('gp-panel-background');
        out.bg = bg ? bg.textContent : '';
        out.retry = !!(bg && bg.querySelector('[data-ui="genre-prose-retry"]'));
        out.lede = document.querySelector('#genre-detail [data-prose-pending="lede"]')?.textContent || '';
        UI.genre = null;
        ${SEARCH('polyrhythm')}
        out.search = document.getElementById('genre-list').textContent;
        return out;`,
        15000,
        { prose: false }
      );
      if (r.__err) fail('prose-failure probe crashed: ' + r.__err);
      else {
        const claims = /has no description|names no exemplar artists/;
        if (r.bootError) fail('a prose failure rendered #boot-error — the app must keep working');
        if (!r.featured) fail("a prose failure left the featured starter's description pending");
        if (!/Couldn.t load/.test(r.bg) || !r.retry || claims.test(r.bg))
          fail(
            `a prose failure: the Background tab must say it could not load, with Retry: ${JSON.stringify(r.bg.slice(0, 200))}`
          );
        if (!/Couldn.t load the description/.test(r.lede) || claims.test(r.lede))
          fail(`a prose failure: the description slot reads ${JSON.stringify(r.lede)}`);
        if (
          !/No genre names match/.test(r.search) ||
          !/could not be loaded/.test(r.search) ||
          /No genres match/.test(r.search)
        )
          fail(
            `a prose failure: a search with no name hits reads ${JSON.stringify(r.search.slice(0, 200))}`
          );
      }
      const once = fetchesOf(log, 'api/browse_prose.json').length;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const still = fetchesOf(log, 'api/browse_prose.json').length;
      if (once !== 1 || still !== 1)
        fail(
          `a prose failure: ${once} request(s), ${still} after 1.5 s — want exactly 1 and no retry loop`
        );
      // Retry makes exactly one more request, and the wording comes back.
      const retry = w.document.querySelector('[data-ui="genre-prose-retry"]');
      if (!retry) fail('a prose failure: no Retry control on the page');
      else {
        retry.click();
        await waitFor(
          () =>
            fetchesOf(log, 'api/browse_prose.json').length === 2 && w.eval('Catalog.proseFailed()'),
          10000,
          'retry'
        ).catch(() => {});
        const n = fetchesOf(log, 'api/browse_prose.json').length;
        const text = w.document.getElementById('genre-list').textContent;
        if (n !== 2 || !/could not be loaded/.test(text))
          fail(
            `a prose failure: Retry made ${n - 1} request(s) (want 1) and the page reads ${JSON.stringify(text.slice(0, 160))}`
          );
        else note('prose 404: app works, says it could not load, 1 request, Retry makes 1 more');
      }
    } catch (e) {
      fail('a prose failure: ' + e.message);
    } finally {
      dom.window.close();
    }
  }

  // F3. One tradition 404s → no cards + error toast.
  const denyId = IMPORT_SAMPLE[2]; // delta_blues
  const dyingDom = bootDom(lazyHtml, makeFetchShim({ deny: [`api/traditions/${denyId}.json`] }));
  const dying = await runProbe(
    dyingDom,
    `
    const before = app.cards.length;
    const created = await importTraditionWithFeedback(${JSON.stringify(denyId)});
    const toast = document.getElementById('toast');
    return {
      created: (created || []).length,
      after: app.cards.length - before,
      toast: toast ? toast.textContent : '',
    };
  `
  );
  if (dying.__err) {
    fail('tradition-404 probe crashed: ' + dying.__err);
  } else {
    if (dying.created !== 0 || dying.after !== 0) {
      fail(
        `tradition-404 still created ${dying.created || dying.after} card(s) — import must not proceed on a failed fetch`
      );
    }
    if (!/could not load tradition data/i.test(dying.toast)) {
      fail(`tradition-404 did not surface the error toast (toast="${dying.toast}")`);
    }
    if (
      dying.created === 0 &&
      dying.after === 0 &&
      /could not load tradition data/i.test(dying.toast)
    ) {
      note('tradition 404: zero cards, error toast shown');
    }
  }
  dyingDom.window.close();

  // F4a–F4c, each in its own boot, side by side.
  await Promise.all([
    engineUnreachable(lazyHtml),
    engineUnreachableRestore(lazyHtml),
    engineStale(lazyHtml),
  ]);
}

// F4. The instrument data unreachable, or from another deploy.
// F4a: no saved session. The first view stands; a failed load is retried by
// an action or Retry, each exactly once, never on a timer; the prose still
// comes (its prefetch follows the engine's bytes, and a failure counts).
async function engineUnreachable(lazyHtml) {
  const tag = 'engine unreachable (F4a)';
  const log = [];
  const dom = bootDom(
    lazyHtml,
    makeFetchShim({ deny: ['api/engine.json', 'api/tradition_images.json'], log }),
    { url: SITE }
  );
  const w = dom.window;
  const asks = () => fetchesOf(log, 'api/engine.json').length;
  try {
    const booted = await runProbe(dom, SETTLE, E_WAIT, { prose: false });
    if (booted.__err) return fail(`${tag}: the page did not boot: ${booted.__err}`);
    const prose = waitFor(() => w.eval('Catalog.proseLoaded()'), 10000, 'prose').then(
      () => true,
      () => false
    );
    await waitFor(() => w.eval('Engine.failed()'), 10000, 'engine failure').catch(() => {});
    await sleep(1500);
    if (w.document.getElementById('boot-error'))
      fail(
        `${tag}: rendered #boot-error with no saved session — the first view needs only the boot index`
      );
    if (!w.eval('Engine.failed()')) fail(`${tag}: Engine.failed() is false after a 404`);
    const n1 = asks();
    if (n1 !== 1)
      fail(
        `${tag}: ${n1} request(s) for api/engine.json 1.5 s after the first view; want exactly 1 — a failed load is retried by an action, never on a timer`
      );
    // An Add asks once more, adds nothing, and says so, with Retry.
    const add = await runProbe(
      dom,
      `const r = await uiAddGenre(STARTER_TRADITIONS[0]);
      const t = document.getElementById('toast');
      return { added: r.added, cards: app.cards.length, toast: t.textContent, error: t.classList.contains('toast-error'),
        actions: [...t.querySelectorAll('.toast-action')].map((b) => b.textContent) };`,
      E_WAIT,
      { prose: false }
    );
    const n2 = asks();
    if (add.__err) fail(`${tag}: Add probe crashed: ${add.__err}`);
    else {
      if (add.added || add.cards)
        fail(`${tag}: an Add with the instrument data unreachable made ${add.cards} card(s)`);
      if (
        !/Could not load the instrument data/.test(add.toast) ||
        !add.error ||
        !add.actions.includes('Retry')
      )
        fail(
          `${tag}: an Add with the instrument data unreachable reads ${JSON.stringify(add.toast)} (actions ${JSON.stringify(add.actions)}); want the error "Could not load the instrument data — check your connection" with Retry`
        );
      if (n2 !== n1 + 1)
        fail(`${tag}: the Add made ${n2 - n1} request(s) for api/engine.json; want exactly 1`);
    }
    // The Instrument page says it could not load, with Retry; Retry asks once.
    const page = await runProbe(
      dom,
      `uiNavigate('instrument');
      const b = document.getElementById('instrument-body');
      return { failed: !!b.querySelector('[data-engine-pending="failed"][role="status"] [data-ui="engine-retry"]'),
        text: b.textContent, total: document.getElementById('ip-total').textContent };`,
      E_WAIT,
      { prose: false }
    );
    if (page.__err) fail(`${tag}: Instrument page probe crashed: ${page.__err}`);
    else if (
      !page.failed ||
      !/Couldn.t load the instruments/.test(page.text) ||
      page.total ||
      ABSENT.test(page.text)
    )
      fail(
        `${tag}: the Instrument page reads ${JSON.stringify(page.text.slice(0, 160))} (count ${JSON.stringify(page.total)}); want "Couldn’t load the instruments." with Retry, and no count`
      );
    if (asks() !== n2) fail(`${tag}: opening the failed Instrument page made a request by itself`);
    w.document.querySelector('#instrument-body [data-ui="engine-retry"]')?.click();
    await waitFor(() => asks() > n2 && w.eval('Engine.failed()'), 10000, 'retry').catch(() => {});
    await sleep(1500);
    const n3 = asks();
    if (n3 !== n2 + 1)
      fail(`${tag}: Retry made ${n3 - n2} request(s) over 1.5 s; want exactly 1 and no retry loop`);
    if (
      !w.document.querySelector(
        '#instrument-body [data-engine-pending="failed"] [data-ui="engine-retry"]'
      )
    )
      fail(`${tag}: after a failed Retry the Instrument page no longer offers Retry`);
    if (!(await prose))
      fail(
        `${tag}: the genre prose did not load within 10 s — its prefetch follows the instrument data's bytes, and a failed request must count as delivered`
      );
    note(
      `${tag}: first view kept; ${n1} → ${n2} (Add) → ${n3} (Retry) requests, none on a timer; prose loaded`
    );
  } finally {
    dom.window.close();
  }
}

// F4b: a saved session. The boot error names the file; the session is left
// as it was and nothing is written.
async function engineUnreachableRestore(lazyHtml) {
  const tag = 'engine unreachable with a saved session (F4b)';
  const dom = bootDom(
    lazyHtml,
    makeFetchShim({ deny: ['api/engine.json', 'api/tradition_images.json'] }),
    { url: SITE, storage: { 'codex-workbench-v1': WS } }
  );
  const w = dom.window;
  try {
    await waitFor(() => w.document.getElementById('boot-error'), 10000, 'boot-error').catch(
      () => {}
    );
    await sleep(300);
    const r = await runProbe(
      dom,
      `const e = document.getElementById('boot-error');
      return { error: !!e, engine: e ? e.dataset.enginePending || null : null, text: e ? e.textContent : '',
        ready: typeof UI !== 'undefined' && UI.ready === true,
        stored: localStorage.getItem('codex-workbench-v1'), recovery: sessionStorage.getItem('codex-workbench-recovery') };`,
      E_WAIT,
      { boot: false, prose: false }
    );
    if (r.__err) return fail(`${tag}: probe crashed: ${r.__err}`);
    if (!r.error) fail(`${tag}: no #boot-error — a saved recipe that cannot be drawn must say so`);
    else if (r.engine !== 'failed' || !/api\/engine\.json/.test(r.text))
      fail(
        `${tag}: #boot-error (data-engine-pending=${JSON.stringify(r.engine)}) reads ${JSON.stringify(r.text.slice(0, 200))}; want data-engine-pending="failed" and api/engine.json named`
      );
    if (r.ready)
      fail(`${tag}: UI.ready is true — the saved recipe was drawn without its instruments`);
    if (r.stored !== WS || r.recovery !== null)
      fail(
        `${tag}: the saved session was written (codex-workbench-v1 ${r.stored === WS ? 'unchanged' : 'changed'}, recovery copy ${JSON.stringify(r.recovery && r.recovery.slice(0, 60))})`
      );
    if (r.error && r.engine === 'failed' && !r.ready && r.stored === WS && r.recovery === null)
      note(`${tag}: boot error names api/engine.json; the session untouched`);
  } finally {
    dom.window.close();
  }
}

// F4c: a file from another deploy — its digest is not the page's.
async function engineStale(lazyHtml) {
  const tag = 'a stale instrument data file (F4c)';
  const SHA = /"tables_sha1":"[0-9a-f]{40}"/;
  if (!SHA.test(fs.readFileSync(path.join(API_DIR, 'engine.json'), 'utf8')))
    return fail(`${tag}: api/engine.json has no tables_sha1 to make stale — vacuous`);
  const dom = bootDom(
    lazyHtml,
    makeFetchShim({
      deny: ['api/tradition_images.json'],
      transform: { 'api/engine.json': (t) => t.replace(SHA, `"tables_sha1":"${'0'.repeat(40)}"`) },
    }),
    { url: SITE }
  );
  const w = dom.window;
  try {
    await runProbe(dom, SETTLE, E_WAIT, { prose: false });
    await waitFor(() => w.eval('Engine.failed() || Engine.ready()'), 10000, 'engine').catch(
      () => {}
    );
    const s = w.eval(
      '({ failed: Engine.failed(), ready: Engine.ready(), stale: !!(Engine.failure() && Engine.failure().stale), tables: typeof INSTRUMENTS })'
    );
    if (!s.failed || !s.stale)
      fail(
        `${tag}: a file whose tables_sha1 is not the page's was ${s.ready ? 'accepted' : 'not refused as stale'} (failed ${s.failed}, stale ${s.stale})`
      );
    const add = await runProbe(
      dom,
      `const r = await uiAddGenre(STARTER_TRADITIONS[0]);
      const t = document.getElementById('toast');
      return { cards: app.cards.length, toast: t.textContent, actions: [...t.querySelectorAll('.toast-action')].map((b) => b.textContent), tables: typeof INSTRUMENTS };`,
      E_WAIT,
      { prose: false }
    );
    if (add.__err) return fail(`${tag}: Add probe crashed: ${add.__err}`);
    if (add.cards) fail(`${tag}: an Add made ${add.cards} card(s) from a stale file`);
    if (!/out of date/.test(add.toast) || !add.actions.includes('Reload'))
      fail(
        `${tag}: an Add reads ${JSON.stringify(add.toast)} (actions ${JSON.stringify(add.actions)}); want "This page is out of date. Reload to load the matching instrument data." with Reload`
      );
    if (s.tables !== 'undefined' || add.tables !== 'undefined')
      fail(`${tag}: INSTRUMENTS was filled from a stale file`);
    else if (s.stale && !add.cards) note(`${tag}: refused as stale; an Add asks for a reload`);
  } finally {
    dom.window.close();
  }
}

(async () => {
  if (PRINT_READERS) return printReaders();
  console.error('Building embedded + lazy HTML…');
  const embedHtml = buildTempHtml(false);
  const lazyHtml = buildTempHtml(true);
  note(
    `embedded ${(embedHtml.length / 1e6).toFixed(1)} MB, lazy shell ${(lazyHtml.length / 1e6).toFixed(1)} MB`
  );
  const ran = [];
  if (ONLY.includes('parity')) {
    const embed = await parity(embedHtml, lazyHtml);
    ran.push(
      `parity (catalog projection ×${Object.keys(embed.catalog || {}).length}, ${Object.keys(embed.pickers || {}).length} rendered surfaces, ${IMPORT_SAMPLE.length}-tradition import + recipe, engine fingerprint ×${embed.engine ? `${embed.engine.count} instruments / ${embed.engine.distinct} variants` : '?'}; 1 boot + 1 engine + 1 prose fetch, 0 browse.json)`
    );
  }
  if (ONLY.includes('first-view')) {
    for (const name of ONLY_SCENARIOS) await firstView(embedHtml, lazyHtml, name);
    await engineEarly(lazyHtml);
    const states = await enginePreloadAgrees(lazyHtml);
    ran.push(
      `${ONLY_SCENARIOS.length} first view(s) with the prose and the instrument data held, filled in place; the engine asked for at the first paint (or an action), not before; <head>'s engine preload agrees with app.js over ${states} stored states`
    );
  }
  if (ONLY.includes('window')) {
    await windowSection(embedHtml, lazyHtml);
    ran.push('the window before the prose and the instrument data');
  }
  if (ONLY.includes('engine')) {
    const e = await engineSection(embedHtml, lazyHtml);
    const said = {
      E0: 'E0 one request after the first view',
      E1: 'E1 the index ≡ Inst',
      E2: `E2 ${e.clicks} clicks with no read`,
      E3: `E3 ${E3_STEPS.length} actions wait then match`,
      E4: 'E4 similar view',
      E5: 'E5 search',
      E6: `E6 ${e.reads} direct reads, each in the function listed`,
    };
    const checks = ENGINE_CHECKS.filter((id) => ONLY_CHECKS.includes(id));
    ran.push(
      `the instrument data held (${checks.map((id) => said[id]).join(', ')}${checks.length < ENGINE_CHECKS.length ? `; --checks ran ${checks.join(',')} of ${ENGINE_CHECKS.length}` : ''})`
    );
  }
  if (ONLY.includes('failure')) {
    await failure(lazyHtml);
    ran.push(
      'honest failure states (incl. the instrument data unreachable, with a session, stale)'
    );
  }

  // ── report ──
  if (problems.length) {
    console.error(`LAZY-APP: FAIL — ${problems.length} problem(s):`);
    for (const p of problems) console.error('  ✗ ' + p);
    process.exit(1);
  }
  console.error(`LAZY-APP: PASS — lazy shell ≡ embedded app: ${ran.join('; ')}.`);
})().catch((e) => {
  console.error('LAZY-APP: harness crash — ' + ((e && e.stack) || e));
  process.exit(1);
});
