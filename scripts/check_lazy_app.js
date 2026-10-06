#!/usr/bin/env node
// check_lazy_app.js — BEHAVIORAL parity between the lazy shell and the embedded app.
//
// @covers: lazy-shell-parity
//
// WHY: the lazy build (the `build_html.js` DEFAULT — what ships in codex.html)
// carries the SAME src/app.js with a different data source: api/browse_boot.json
// (every genre without its prose, plus the starter genres'), then
// api/browse_prose.json after the first paint, then per-tradition `source`
// fetches, instead of embedded tables. Every promise the app makes (search
// recall and ranking, the tradition tree, find-similar, import correctness, the
// recipe string) must survive that swap byte-for-byte once the prose has
// landed, and before it lands the page must say what it is waiting for rather
// than claim anything is missing. This gate boots BOTH builds in jsdom — the
// lazy one against the committed api/ via a fetch shim — and asserts:
//
//   PARITY (section `parity`; the lazy app IS the embedded app):
//   • Catalog data — every tradition's app-facing projection (name/family/
//     lineage/instruments + parent/axes/description/exemplars/crossRefs/status)
//     is deep-equal across ALL ids, axes normalized through the 13-key contract.
//   • Rendered browse surfaces — renderTradPicker() innerHTML is IDENTICAL
//     (string-equal) for the full tree and for search queries.
//   • Import — for a cross-family sample: ensureFull → importTradition yields
//     identical cards and an identical compressRichRecipe string.
//   • Fetches — exactly 1 boot index, then exactly 1 prose file, 0 of the
//     published 8 MB api/browse.json, and exactly 1 per imported tradition.
//
//   FIRST VIEW (section `first-view`; nine starting states — default, List,
//   phone width, phone List, a starter deep link, a deep link to a genre
//   outside the boot index, an unknown deep link, a restored recipe, a
//   restored recipe in List): with api/browse_prose.json HELD BACK, the lazy
//   page's body equals the embedded build's byte for byte. Two states draw
//   prose slots as pending (the non-starter deep link, and the restored
//   recipe's List suggestions); there the pending slots must be exactly the
//   genres without prose, and the page must be equal once they are masked.
//   The prose is requested only after the first view is drawn, except for the
//   non-starter deep link, which asks early. Then the prose is released: every
//   slot fills IN PLACE (no control the page had is rebuilt) and the page is
//   the embedded build's, byte for byte.
//
//   WINDOW (section `window`; before the prose lands): the boot index carries
//   exactly the page's STARTER_TRADITIONS' prose; a search covers names only,
//   lists exactly the full search's name matches in the full search's order,
//   and says so; a detail and the picker say "loading", never "none". After
//   the release the list and the picker on screen equal the embedded build's.
//
//   FAILURE PATHS (section `failure`; the lazy app fails honestly):
//   • the boot index unreachable → the boot-error state renders.
//   • the prose unreachable → the app works; prose slots say they could not
//     load, with Retry; a search says only names were searched; exactly one
//     request, no retry loop, and Retry makes exactly one more.
//   • a tradition fetch 404s → importTraditionWithFeedback adds NO cards and
//     surfaces the error toast.
//
// USAGE
//   node scripts/check_lazy_app.js            # every section (npm run test:lazy, CI)
//   node scripts/check_lazy_app.js --verbose  # per-check detail
//   --only=parity,first-view,window,failure   # run some sections (faults.js)
//   --scenarios=default,deep                  # restrict first-view (faults.js)
// The two filters only restrict: the full run is always a superset.

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

const SECTIONS = ['parity', 'first-view', 'window', 'failure'];
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
// name → { query, width, storage, pending }. `pending`: the state draws prose
// slots as loading, so it is compared masked before the release.
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
};

const ONLY = flagList('only') || SECTIONS;
const ONLY_SCENARIOS = flagList('scenarios') || Object.keys(SCENARIOS);
{
  const bad = [
    ...ONLY.filter((x) => !SECTIONS.includes(x)).map((x) => `section "${x}"`),
    ...ONLY_SCENARIOS.filter((x) => !SCENARIOS[x]).map((x) => `scenario "${x}"`),
  ];
  if (bad.length) {
    console.error(
      `check_lazy_app: unknown ${bad.join(', ')} (sections: ${SECTIONS.join(', ')}; scenarios: ${Object.keys(SCENARIOS).join(', ')})`
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
// `hold` maps a path to a deferred() that lets it through on release; `log`
// records every request, with `ready` — whether the first view had been drawn
// when it was made (`stamp`).
const SITE_PREFIX = /^https:\/\/codexmusica\.com\//;
function makeFetchShim({ deny = [], log = [], hold = {}, stamp } = {}) {
  return (url) => {
    const rel = String(url)
      .replace(SITE_PREFIX, '')
      .replace(/^\.?\//, '');
    log.push({ rel, ready: stamp ? stamp() : null });
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
        };
      }
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { ok: true, status: 200, json: async () => data };
    });
  };
}
const fetchesOf = (log, rel) => log.filter((e) => e.rel === rel);

// Whether a booted page has drawn its first view (the shim's `stamp`).
function drawn(w) {
  try {
    return !!w.eval(
      "typeof UI !== 'undefined' && UI.ready === true && !!document.querySelector('#genre-list > *')"
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
      if (width) Object.defineProperty(w, 'innerWidth', { value: width, configurable: true });
      if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
      if (fetchShim) w.fetch = fetchShim;
    },
  });
}

// Inject an async probe into a booted dom and wait for its result. The probe
// shares the page's global script scope, so it can reference the app's
// top-level consts (Catalog, app, renderTradPicker, …) directly. With `prose`
// (the default) it first waits for the genre prose to merge; whenProse() never
// starts a load, so a page that never asks for the prose fails here.
function runProbe(dom, probeBody, timeoutMs = 15000, { prose = true } = {}) {
  dom.window.__probe = undefined;
  const s = dom.window.document.createElement('script');
  s.textContent = `(async () => {
    try {
      if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, {once:true}));
      if (typeof CATALOG_READY !== 'undefined' && CATALOG_READY) await CATALOG_READY;
      if (typeof UI !== 'undefined') {
        for (let i=0;i<100&&!UI.ready;i++) await new Promise(resolve=>setTimeout(resolve,10));
        if (!UI.ready) throw Error('Workbench did not finish booting');
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
  const lazyLog = [];
  const lazyDom = bootDom(lazyHtml, makeFetchShim({ log: lazyLog }));
  const [embed, lazy] = await Promise.all([
    runProbe(embedDom, CAPTURE_PROBE),
    runProbe(lazyDom, CAPTURE_PROBE),
  ]);
  if (embed.__err) fail('embedded probe crashed: ' + embed.__err);
  if (lazy.__err) fail('lazy probe crashed: ' + lazy.__err);

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
  const url = SITE + (sc.query || '');
  const opts = { url, width: sc.width, storage: sc.storage };
  const embedDom = bootDom(embedHtml, makeFetchShim({ deny: '*' }), opts);
  const ref = {},
    log = [],
    hold = { 'api/browse_prose.json': deferred() };
  const lazyDom = bootDom(
    lazyHtml,
    makeFetchShim({
      deny: ['api/tradition_images.json'],
      log,
      hold,
      stamp: () => drawn(ref.w),
    }),
    { ...opts, onWindow: (w) => (ref.w = w) }
  );
  const tag = `first view "${name}"`;
  try {
    const [e0, l0] = await Promise.all([
      runProbe(embedDom, SETTLE),
      runProbe(lazyDom, SETTLE, 15000, { prose: false }),
    ]);
    if (e0.__err || l0.__err) return fail(`${tag}: probe crashed: ${e0.__err || l0.__err}`);

    // (a) When the prose was asked for.
    const asks = fetchesOf(log, 'api/browse_prose.json');
    if (name === 'deep') {
      if (!asks.length || asks[0].ready !== false)
        fail(
          `${tag}: a ?trad= link to a genre outside the boot index did not ask for the prose before the first view`
        );
    } else if (asks.length !== 1 || asks[0].ready !== true) {
      fail(
        `${tag}: the genre prose was requested before the first view was drawn (${JSON.stringify(asks)})`
      );
    }

    // (b)/(c) The page with the prose held back.
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

    // (d) Release: every slot fills in place, nothing else is rebuilt, and
    // the page is the embedded build's.
    await runProbe(
      lazyDom,
      `window.__kept = [...document.querySelectorAll('#surface-genre button, #surface-genre a, #surface-genre input, #surface-genre select')].filter((el) => !el.closest('[data-prose-pending]'));
      return window.__kept.length;`,
      15000,
      { prose: false }
    );
    hold['api/browse_prose.json'].release();
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
  } finally {
    embedDom.window.close();
    lazyDom.window.close();
  }
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
  const hold = { 'api/browse_prose.json': deferred() };
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
    hold['api/browse_prose.json'].release();
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
}

(async () => {
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
      `parity (catalog projection ×${Object.keys(embed.catalog || {}).length}, ${Object.keys(embed.pickers || {}).length} rendered surfaces, ${IMPORT_SAMPLE.length}-tradition import + recipe; 1 boot + 1 prose fetch, 0 browse.json)`
    );
  }
  if (ONLY.includes('first-view')) {
    for (const name of ONLY_SCENARIOS) await firstView(embedHtml, lazyHtml, name);
    ran.push(`${ONLY_SCENARIOS.length} first view(s) with the prose held, filled in place`);
  }
  if (ONLY.includes('window')) {
    await windowSection(embedHtml, lazyHtml);
    ran.push('the window before the prose');
  }
  if (ONLY.includes('failure')) {
    await failure(lazyHtml);
    ran.push('honest failure states');
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
