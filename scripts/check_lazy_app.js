#!/usr/bin/env node
// check_lazy_app.js — BEHAVIORAL parity between the lazy shell and the embedded app.
//
// @covers: lazy-shell-parity
//
// WHY: the lazy build (the `build_html.js` DEFAULT — what ships in codex.html)
// carries the SAME src/app.js with a different data source — api/browse.json +
// per-tradition `source` fetches instead of embedded tables. Every promise the app makes (search recall and
// ranking, the tradition tree, find-similar, import correctness, the recipe
// string) must survive that swap byte-for-byte. This gate proves it by booting
// BOTH builds in jsdom — the lazy one against the committed api/ via a fetch
// shim — and asserting:
//
//   PARITY (the lazy app IS the embedded app):
//   • Catalog data — every tradition's app-facing projection (name/family/
//     lineage/instruments + parent/axes/description/exemplars/crossRefs) is
//     deep-equal across ALL ids, axes normalized through the 13-key contract.
//   • Rendered browse surfaces — renderTradPicker() innerHTML is IDENTICAL
//     (string-equal) for the full tree and for search queries. Same code +
//     proven-equal data ⇒ any drift here means a render path read a field
//     the index doesn't carry.
//   • Import — for a cross-family sample (incl. an umbrella genre and an
//     amp-chain tradition): ensureFull → importTradition yields identical
//     cards (tuning/room/parts/chain) and an identical compressRichRecipe
//     string. Exactly ONE fetch per imported tradition, cached thereafter.
//
//   FAILURE PATHS (the lazy app fails honestly, never blankly):
//   • browse.json unreachable → the boot-error state renders (no silent blank).
//   • a tradition fetch 404s → importTraditionWithFeedback adds NO cards and
//     surfaces the error toast.
//
// USAGE
//   node scripts/check_lazy_app.js            # build both, assert parity + failure paths
//   node scripts/check_lazy_app.js --verbose  # per-check detail

'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const API_DIR = path.join(ROOT, 'api');
const VERBOSE = process.argv.includes('--verbose');

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

// fetch shim — resolves the app's relative api/ URLs against the COMMITTED
// repo api/ (itself gate-verified by check_api + the freshness job). `deny`
// simulates network failure for specific paths; `log` records every request
// so the gate can assert the one-fetch-per-import promise.
function makeFetchShim({ deny = [], log = [] } = {}) {
  return (url) => {
    const rel = String(url).replace(/^\.?\//, '');
    log.push(rel);
    return Promise.resolve().then(() => {
      const file = path.join(ROOT, rel);
      if (deny.includes(rel) || !file.startsWith(API_DIR) || !fs.existsSync(file)) {
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

function bootDom(html, fetchShim) {
  return new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(w) {
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
      if (fetchShim) w.fetch = fetchShim;
    },
  });
}

// Inject an async probe into a booted dom and wait for its result. The probe
// shares the page's global script scope, so it can reference the app's
// top-level consts (Catalog, app, renderTradPicker, …) directly.
function runProbe(dom, probeBody, timeoutMs = 15000) {
  const s = dom.window.document.createElement('script');
  s.textContent = `(async () => {
    try {
      if (typeof CATALOG_READY !== 'undefined' && CATALOG_READY) await CATALOG_READY;
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

// The capture probe both builds run — everything compared comes out of here.
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
    };
  }
  return out;
}

(async () => {
  console.error('Building embedded + lazy HTML…');
  const embedHtml = buildTempHtml(false);
  const lazyHtml = buildTempHtml(true);
  note(
    `embedded ${(embedHtml.length / 1e6).toFixed(1)} MB, lazy shell ${(lazyHtml.length / 1e6).toFixed(1)} MB`
  );

  // ── parity: boot both, capture, compare ──
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

    // Fetch discipline — 1 browse fetch + exactly 1 per imported tradition,
    // despite ensureFull being called twice per id (cache must absorb it).
    const browseFetches = lazyLog.filter((u) => u === 'api/browse.json').length;
    if (browseFetches !== 1) fail(`expected exactly 1 browse.json fetch, saw ${browseFetches}`);
    for (const id of IMPORT_SAMPLE) {
      const n = lazyLog.filter((u) => u === `api/traditions/${id}.json`).length;
      if (n !== 1) fail(`expected exactly 1 fetch for ${id} (cached thereafter), saw ${n}`);
    }
    note(`fetches: ${lazyLog.length} total — ${JSON.stringify(lazyLog)}`);
  }
  embedDom.window.close();
  lazyDom.window.close();

  // ── failure path: browse.json unreachable → honest boot-error state ──
  const deadDom = bootDom(lazyHtml, makeFetchShim({ deny: ['api/browse.json'] }));
  await new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = setInterval(() => {
      const el = deadDom.window.document.getElementById('boot-error');
      if (el) {
        clearInterval(poll);
        resolve();
      } else if (Date.now() - t0 > 10000) {
        clearInterval(poll);
        reject(new Error('no boot-error state'));
      }
    }, 50);
  }).then(
    () => note('boot failure renders the error state'),
    () => fail('browse.json failure did NOT render the boot-error state (silent blank app)')
  );
  deadDom.window.close();

  // ── failure path: one tradition 404s → no cards + error toast ──
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

  // ── report ──
  if (problems.length) {
    console.error(`LAZY-APP: FAIL — ${problems.length} problem(s):`);
    for (const p of problems) console.error('  ✗ ' + p);
    process.exit(1);
  }
  console.error(
    `LAZY-APP: PASS — lazy shell ≡ embedded app (catalog projection ×${Object.keys(embed.catalog || {}).length}, ` +
      `${Object.keys(embed.pickers || {}).length} rendered surfaces, ${IMPORT_SAMPLE.length}-tradition import + recipe), ` +
      `1 fetch per action (cached), honest failure states.`
  );
})().catch((e) => {
  console.error('LAZY-APP: harness crash — ' + ((e && e.stack) || e));
  process.exit(1);
});
