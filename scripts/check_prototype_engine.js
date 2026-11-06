#!/usr/bin/env node
'use strict';
/* global window */
// check_prototype_engine.js — the prototype's recipe engine is production's
// (#670 6639581575, R2's conditions 1 and 3).
//
// prototype/engine/load.js copies codex.html's own engine blocks out of the
// page it is served beside and imports them as a module. Nothing is
// committed in between, so this runs that same file on the working tree's
// codex.html and holds what it makes to production:
//
//   1. Same names: load.js returns exactly the functions the other parity
//      gates call (scripts/_load_app.js EXPORTED), plus the lazy boot.
//   2. Same recipes: the module boots the way the lazy page boots (the
//      catalog from api/browse_boot.json, the instrument engine from
//      api/engine.json, each genre's row on demand), imports each genre of a
//      fixed sample and renders it in all four formats. Each string must
//      equal the production renderer's (scripts/_seed_workspace.js, which
//      check_app_parity.js holds to src/app.js across the catalog). The
//      renderer runs in a child process: the Node catalog loader puts tables
//      on globalThis, and the engine's lazy path must not see them.
//   3. Sealed: building and running the module adds no global.
//   4. In the browser: the prototype page loads ../codex.html through
//      load.js and boots the engine from api/; a genre's recipe equals
//      production's, every request stays on the origin, and no global is
//      added.
//   5. The gate can fail: a page with one engine constant changed yields a
//      module whose recipes disagree, and a page whose shape changed is
//      refused rather than guessed at.
//   6. Every routed name is held (HOLDS). load.js routes engine functions
//      and tables beyond NAMES (PAGE_TABLES, LIVE_TABLES) for the shell's
//      stores. Each one is in a hold here, or, for the six Genre discovery
//      tables, in check_prototype_hosts.js discoveryChecks; a hold names
//      nothing that isn't routed; and every LIVE_TABLES getter reads a filled
//      table once the instrument engine is in. Each hold's samples are
//      computed on codex.html itself in Chromium, on the page's own globals,
//      and on the module, and must be equal.
//   7. Every routed name can fail its hold (PLANTS): the page text with that
//      one name's behaviour changed (or, for a LIVE_TABLES name, load.js
//      returning a plain property in place of its getter) yields a module
//      whose hold disagrees with production. MORE_PLANTS adds a drift for a
//      name whose hold covers more than one behaviour. A plant whose anchor is gone,
//      or occurs more than once, fails the gate as no longer applying.
//
//   node scripts/check_prototype_engine.js
//
// CHROMIUM_PATH may name a Chromium executable.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { EXPORTED } = require('./_load_app.js');

const ROOT = path.resolve(__dirname, '..');
const LOAD = path.join(ROOT, 'prototype', 'engine', 'load.js');
const FORMATS = ['rich', 'tags', 'prose', 'compact'];

// The fixed sample: named genres across families and shapes (one card, many
// cards, a chain-heavy one), then every 300th genre of the index and one
// retired id.
const NAMED = [
  'bluegrass',
  'afrobeat',
  'post_punk',
  'gagaku',
  'thrash_metal',
  'qawwali',
  'band_organ',
  'chouval_bwa',
  'appalachian_folk',
  'delta_blues',
  'gamelan_degung',
  'dub',
];

const problems = [];
let checks = 0;
const expect = (ok, what) => {
  checks++;
  if (!ok) problems.push(what);
};

function sample() {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/traditions/index.json'), 'utf8'));
  const ids = index.items.map((t) => t.id);
  const live = new Set(ids);
  const aliases = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'references/_tradition_aliases.json'), 'utf8')
  ).aliases;
  const retired = Object.keys(aliases).sort()[0];
  const out = NAMED.filter((id) => live.has(id));
  for (let i = 0; i < ids.length; i += 300) if (!out.includes(ids[i])) out.push(ids[i]);
  if (retired) out.push(retired);
  return { ids: out, named: NAMED.filter((id) => live.has(id)).length, retired };
}

// What load.js lets the engine ask for, served from the working tree.
function fileFetch(ENGINE_REQUEST) {
  return (url) => {
    const rel = String(url);
    if (!ENGINE_REQUEST.test(rel) || rel.includes('..'))
      return Promise.reject(new Error(`engine asked for ${url}`));
    const file = path.join(ROOT, rel.replace(/\?.*$/, ''));
    if (!fs.existsSync(file))
      return Promise.resolve({
        ok: false,
        status: 404,
        text: async () => '',
        json: async () => null,
      });
    const text = fs.readFileSync(file, 'utf8');
    return Promise.resolve({
      ok: true,
      status: 200,
      text: async () => text,
      json: async () => JSON.parse(text),
    });
  };
}

const asModule = (text) =>
  import(`data:text/javascript;base64,${Buffer.from(text).toString('base64')}`);

async function recipesOf(mod, request, ids) {
  const E = mod.createEngine({ fetch: fileFetch(request) });
  await E.CATALOG_READY;
  await E.Engine.ensure();
  const out = {};
  for (const id of ids) {
    await E.Catalog.ensureFull(E.Catalog.resolve(id));
    E.app.cards = [];
    E.importTradition(id);
    out[id] = {};
    for (const f of FORMATS) out[id][f] = E.compileRecipeStack(E.app.cards, f, { ceiling: 1000 });
  }
  return out;
}

function reference(ids) {
  const code = `
    const { seedTraditionCards, renderWorkspace } = require('./scripts/_seed_workspace.js');
    const C = require('./scripts/_loader.js');
    const ids = JSON.parse(process.argv[1]);
    const out = {};
    for (const id of ids) {
      const live = C.resolveTraditionId(id);
      out[id] = {};
      for (const f of ${JSON.stringify(FORMATS)})
        out[id][f] = renderWorkspace(seedTraditionCards(live), { format: f, ceiling: 1000 });
    }
    process.stdout.write(JSON.stringify(out));`;
  return JSON.parse(
    execFileSync(process.execPath, ['-e', code, JSON.stringify(ids)], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  );
}

function compare(got, want, ids) {
  let agree = 0;
  const diffs = [];
  for (const id of ids)
    for (const f of FORMATS) {
      const a = got[id] && got[id][f];
      const b = want[id] && want[id][f];
      if (typeof a === 'string' && a.length > 0 && a === b) agree++;
      else
        diffs.push(
          `${id} ${f}: module ${JSON.stringify(String(a).slice(0, 80))} vs production ${JSON.stringify(String(b).slice(0, 80))}`
        );
    }
  return { agree, diffs };
}

// ── 6 and 7: the routed names, each held to production ────────────────────
// Each hold is one sample over the names it lists, computed by holdSamples
// (below) on an engine E: the module's own return, or, in Chromium, the
// globals of codex.html itself. Names the Genre discovery hosts read are held
// in check_prototype_hosts.js discoveryChecks instead.
const HOLDS = {
  render: ['compileStack', 'buildStackParts', 'entryRenderDescs', 'hasEnvironment'],
  tables: [
    'Inst',
    'Variant',
    'Tuning',
    'Room',
    'ChainItem',
    'RECIPE_FORMATS',
    'RECIPE_CHAR_CEILING',
    'PREFACE_LEXICON',
    'TUNINGS',
    'ROOMS',
    'CHAIN_SECTIONS',
  ],
  history: [
    'pushHistory',
    'undo',
    'redo',
    'musicalWorkspaceKey',
    'addInstrumentFromPicker',
    '_addedInstrumentMessage',
  ],
  glyphs: [
    'prefaceGlyphsHTML',
    'prefaceCatGlyphHTML',
    'prefaceGroups',
    'prefaceCategoryOf',
    'PREFACE_CAT_ORDER',
    'loadNavGlyphArt',
  ],
  search: ['normalizeSearch', 'searchRank'],
  instsim: ['findSimilarInstruments', 'getMatchingInstrumentAxes'],
  gensim: ['findSimilar', 'getMatchingAxes'],
};
const DISCOVERY_HELD = [
  'TREE_NODES',
  'AXIS_DEFINITIONS',
  'GLYPH_META',
  'resolveTraditionGlyphs',
  'glyphSvg',
  'axisLabel',
];
// #780's five fixtures (#668 6647783903).
const INSTRUMENT_FIXTURES = ['oud', 'fiddle', 'grand_piano', 'electric_guitar_humbucker', 'voice'];

function holdInput() {
  const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const instruments = read('api/instruments/index.json').items.map((i) => i.id);
  const genres = read('api/traditions/index.json').items.map((t) => t.id);
  const every = (list, n) => list.filter((_, i) => i % n === 0);
  return {
    genres: NAMED,
    instruments: every(instruments, 50),
    allInstruments: instruments,
    queries: ['ud', 'oud', 'banjo', 'bluegrass', 'guitar', 'cafe', 'ʿūd', 'drum', 'a', 'zz'],
    fixed: [
      'ʿŪd',
      'Café',
      'a–b—c-d',
      '  many   spaces  ',
      '',
      'Oud “quoted”',
      'ÀÉÎÕÜ',
      'ʻukulele',
      'Ēwe ʾx',
    ],
    instSim: [
      ...INSTRUMENT_FIXTURES,
      ...every(instruments, 50).filter((id) => !INSTRUMENT_FIXTURES.includes(id)),
    ],
    genSim: ['acousmatic', ...every(genres, 300)],
    preface: 'sermonizing',
  };
}

// The samples, one per hold. This function runs as it is written both in
// Node (on the module) and in codex.html (on its globals), so it uses
// nothing but E and the input. A hold that throws records the error, which
// then disagrees with production.
async function holdSamples(E, which, input) {
  const hash = (s) => {
    let x = 2166136261;
    for (let i = 0; i < s.length; i++) {
      x ^= s.charCodeAt(i);
      x = Math.imul(x, 16777619);
    }
    return (x >>> 0).toString(16) + ':' + s.length;
  };
  const materialOf = (card) => {
    const inst = E.Inst(card.instrumentId);
    const part = inst.parts.find((p) => p.variants.some((v) => v.expanded));
    const alt = part.variants.find((v) => v.expanded && v.id !== card.parts[part.id]);
    return [part.id, alt.id];
  };
  const run = {
    async render() {
      const cards = [];
      for (const id of input.genres) {
        await E.Catalog.ensureFull(E.Catalog.resolve(id));
        E.app.cards = [];
        E.importTradition(id);
        cards.push(...E.app.cards);
      }
      const oud = E.makeCard('oud');
      const [part, alt] = materialOf(oud);
      oud.parts[part] = alt;
      E.applyPartEdit(oud, part, { quiet: true });
      const banjo = E.makeCard('banjo_5_string');
      const r = E.inverseConfigureForPreface(banjo, input.preface);
      if (r) r.apply();
      const fx = E.makeCard('oud');
      fx.chain.fx = E.CHAIN_SECTIONS[0].items.slice(0, 2).map((i) => i.id);
      cards.push(oud, banjo, fx);
      E.app.cards = [];
      return cards.map((c) => {
        const inst = E.Inst(c.instrumentId);
        return {
          instrumentId: c.instrumentId,
          text: ['rich', 'tags', 'prose', 'compact'].map((f) => E.compileStack(c, f)),
          parts: E.buildStackParts(c),
          env: E.hasEnvironment(c),
          descs: [
            c.tuning ? E.Tuning(c.tuning) : null,
            c.room ? E.Room(c.room) : null,
            ...inst.parts.map((p) => E.Variant(inst, p.id, c.parts[p.id])),
          ].map((x) => E.entryRenderDescs(x)),
        };
      });
    },
    async tables() {
      return {
        instruments: input.instruments.map((id) => {
          const i = E.Inst(id);
          if (!i) return null;
          return {
            id: i.id,
            name: i.name,
            short: i.short || null,
            parts: (i.parts || []).map((p) => ({
              id: p.id,
              name: p.name || null,
              variants: p.variants.map((v) => {
                const w = E.Variant(i, p.id, v.id);
                return [
                  v.id,
                  v.name,
                  hash(JSON.stringify(v.descriptors || [])),
                  v.expanded || false,
                  v.alias_of || null,
                  w ? w.id : null,
                ];
              }),
            })),
          };
        }),
        tunings: E.TUNINGS.map((t) => [t.id, t.name, E.Tuning(t.id)?.name ?? null]),
        rooms: E.ROOMS.map((t) => [t.id, t.name, E.Room(t.id)?.name ?? null]),
        chain: E.CHAIN_SECTIONS.map((s) => ({
          id: s.id,
          name: s.name,
          multi: !!s.multiSelect,
          items: s.items.map((it) => [it.id, it.name, E.ChainItem(s.id, it.id)?.id ?? null]),
        })),
        prefaces: E.PREFACE_LEXICON.map((e) => e.id),
        formats: E.RECIPE_FORMATS.map(([id, label]) => [id, label]),
        ceiling: E.RECIPE_CHAR_CEILING,
      };
    },
    async history() {
      const steps = [];
      const mark = (step, extra) =>
        steps.push({
          step,
          key: JSON.parse(E.musicalWorkspaceKey(E.app.cards)).map(({ id, ...c }) => (void id, c)),
          index: E.app.historyIndex,
          length: E.app.history.length,
          ...extra,
        });
      E.app.cards = [];
      E.app.history = [];
      E.app.historyIndex = -1;
      E.app._addToTradition = null;
      E.pushHistory();
      mark('baseline');
      await E.Catalog.ensureFull('bluegrass');
      E.importTradition('bluegrass');
      mark('import');
      E.app._addToTradition = 'bluegrass';
      const oud = await E.addInstrumentFromPicker('oud');
      mark('grouped', { message: E._addedInstrumentMessage('oud', oud) });
      const udu = await E.addInstrumentFromPicker('udu');
      mark('loose', { message: E._addedInstrumentMessage('udu', udu) });
      // The configured add the recipe store's addConfiguredInstrument makes:
      // configure runs on the new card before its one history entry, grouped
      // and loose, so Undo removes it and Redo brings it back configured.
      E.app._addToTradition = 'bluegrass';
      const banjo = await E.addInstrumentFromPicker('banjo_5_string', {
        configure: (c) => {
          c.room = E.ROOMS[3].id;
          c.tuning = E.TUNINGS[5].id;
          c.pinnedParts = [c.pinnedParts || [], Object.keys(c.parts)[0]].flat();
        },
      });
      mark('configured grouped', { message: E._addedInstrumentMessage('banjo_5_string', banjo) });
      await E.addInstrumentFromPicker('udu', {
        configure: (c) => {
          c.room = E.ROOMS[4].id;
        },
      });
      mark('configured loose');
      const [part, alt] = materialOf(oud);
      oud.parts[part] = alt;
      E.applyPartEdit(oud, part, { quiet: true });
      E.pushHistory();
      mark('edit');
      E.undo();
      mark('undo');
      E.undo();
      mark('undo again');
      E.redo();
      mark('redo');
      E.undo();
      E.undo();
      mark('undo past the configured adds');
      E.redo();
      mark('redo the configured grouped add');
      E.redo();
      mark('redo the configured loose add');
      return steps;
    },
    async glyphs() {
      const art = await E.loadNavGlyphArt();
      const entries = E.PREFACE_LEXICON.map((e) => [
        e.id,
        E.prefaceCategoryOf(e),
        E.prefaceGlyphsHTML(e, 15, true),
        E.prefaceGlyphsHTML(e, 15, false),
        E.prefaceGlyphsHTML(e, 16, true),
        E.prefaceGlyphsHTML(e, 16, false),
      ]);
      const categories = E.PREFACE_CAT_ORDER.map((c) => E.prefaceCatGlyphHTML(c, 16));
      return {
        art: art ? Object.keys(art).length : null,
        order: E.PREFACE_CAT_ORDER.slice(),
        groups: Object.entries(E.prefaceGroups()).map(([c, l]) => [c, l.map((e) => e.id)]),
        categories: categories.map(hash),
        entries: entries.map(([id, cat, ...g]) => [id, cat, ...g.map(hash)]),
        unfilled: [...categories, ...entries.flat()].some((h) => h.includes('data-nav-cp')),
      };
    },
    async search() {
      const names = input.allInstruments.map((id) => E.Inst(id)?.name || id);
      const norm = names.map((n) => E.normalizeSearch(n));
      return {
        fixed: input.fixed.map((t) => E.normalizeSearch(t)),
        names: norm.map(hash),
        ranks: input.queries.map((q) => {
          const nq = E.normalizeSearch(q);
          return names
            .map((n, i) => [n, E.searchRank(nq, norm[i])])
            .filter(([, r]) => r >= 0)
            .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
            .slice(0, 12);
        }),
      };
    },
    async instsim() {
      return input.instSim.map((id) => [
        id,
        E.findSimilarInstruments(id, 6).map((n) => [
          n.id,
          n.name,
          Math.round(n.distance * 1e6),
          E.getMatchingInstrumentAxes(id, n.id, 2).map((m) => m.axis.name),
        ]),
      ]);
    },
    async gensim() {
      return input.genSim.map((raw) => {
        const id = E.Catalog.resolve(raw);
        return [
          raw,
          id,
          E.findSimilar(id, 10).map((n) => [
            n.id,
            n.name,
            Math.round(n.distance * 1e6),
            E.getMatchingAxes(id, n.id, 3).map((m) => m.axis.id),
          ]),
        ];
      });
    },
  };
  const out = {};
  for (const w of which) {
    try {
      out[w] = await run[w]();
    } catch (e) {
      out[w] = { error: String((e && e.message) || e) };
    }
  }
  return out;
}

// The routed names a hold reads, and the engine to read them from.
const holdNames = (L) => [...L.NAMES, ...L.PAGE_TABLES, ...L.LIVE_TABLES];
async function moduleHolds(mod, request, which, input) {
  const E = mod.createEngine({ fetch: fileFetch(request) });
  await E.CATALOG_READY;
  await E.Engine.ensure();
  return holdSamples(E, which, input);
}

// The same samples on codex.html itself: its own globals (function
// declarations and the page's top-level const and let), once the page has
// booted its catalog, its instrument engine and its glyph art.
async function pageHolds(browser, base, names, which, input) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(`${base}/codex.html`);
    const expr = `(async () => {
      await CATALOG_READY;
      await Engine.ensure();
      await loadNavGlyphArt();
      const E = {};
      for (const n of ${JSON.stringify(names)}) E[n] = (0, eval)(n);
      return (${holdSamples.toString()})(E, ${JSON.stringify(which)}, ${JSON.stringify(input)});
    })()`;
    const got = await page.evaluate(expr);
    return { got, errors };
  } finally {
    await page.close();
  }
}

// One behaviour-changing defect per routed name, on the minified page text
// (a function: the declaration renamed H__real and a wrapper H; a const: its
// initialiser changed). Each must make its own hold disagree.
const wrap = (name, params, body, { async = false } = {}) => {
  const kw = async ? 'async function ' : 'function ';
  return [`${kw}${name}(`, `${kw}${name}(${params}){${body}}${kw}${name}__real(`];
};
const constWrap = (name, value) => [`const ${name}=`, `const ${name}=${value},${name}__real=`];
const PLANTS = {
  compileStack: wrap('compileStack', 'c,f', 'return compileStack__real(c,f)+" "'),
  buildStackParts: wrap('buildStackParts', 'c', 'return buildStackParts__real(c).reverse()'),
  entryRenderDescs: wrap('entryRenderDescs', 'e', 'return entryRenderDescs__real(e).slice(1)'),
  hasEnvironment: wrap('hasEnvironment', 'c', 'return!hasEnvironment__real(c)'),
  Inst: constWrap(
    'Inst',
    '(i)=>{const r=Inst__real(i);return r&&{...r,parts:[...(r.parts||[])].reverse()}}'
  ),
  Variant: constWrap(
    'Variant',
    '(i,p,v)=>{const r=Variant__real(i,p,v);const part=r&&i&&(i.parts||[]).find((x)=>x.id===p);if(!part)return r;const k=part.variants.findIndex((x)=>x.id===r.id);return part.variants[k+1]||part.variants[0]}'
  ),
  Tuning: constWrap(
    'Tuning',
    '(i)=>{const r=Tuning__real(i);if(!r)return r;const k=TUNINGS.findIndex((x)=>x.id===r.id);return TUNINGS[k+1]||TUNINGS[0]}'
  ),
  Room: constWrap(
    'Room',
    '(i)=>{const r=Room__real(i);if(!r)return r;const k=ROOMS.findIndex((x)=>x.id===r.id);return ROOMS[k+1]||ROOMS[0]}'
  ),
  ChainItem: constWrap(
    'ChainItem',
    '(s,i)=>{const r=ChainItem__real(s,i);const sec=r&&CHAIN_SECTIONS.find((x)=>x.id===s);return sec?sec.items[0]:r}'
  ),
  RECIPE_FORMATS: constWrap(
    'RECIPE_FORMATS',
    '[["rich","Rich"],["tags","Tags"],["prose","Prose"]]'
  ),
  RECIPE_CHAR_CEILING: ['const RECIPE_CHAR_CEILING=1e3;', 'const RECIPE_CHAR_CEILING=120;'],
  // A literal list of names: reversed in place.
  PREFACE_CAT_ORDER: (page) => {
    const m = page.match(/const PREFACE_CAT_ORDER=(\[[^\]]*\]);/g);
    if (!m || m.length !== 1) return null;
    const list = JSON.parse(m[0].slice('const PREFACE_CAT_ORDER='.length, -1));
    return page.replace(m[0], () => `const PREFACE_CAT_ORDER=${JSON.stringify(list.reverse())};`);
  },
  pushHistory: wrap('pushHistory', '', 'void pushHistory__real'),
  undo: wrap('undo', '', 'void undo__real'),
  redo: wrap('redo', '', 'void redo__real'),
  musicalWorkspaceKey: wrap(
    'musicalWorkspaceKey',
    'c',
    'return musicalWorkspaceKey__real(c.map((x)=>({...x,pinnedParts:undefined})))'
  ),
  addInstrumentFromPicker: wrap(
    'addInstrumentFromPicker',
    'i,o',
    'app._addToTradition=null;return addInstrumentFromPicker__real(i,o)',
    { async: true }
  ),
  _addedInstrumentMessage: wrap(
    '_addedInstrumentMessage',
    'i,c',
    'return _addedInstrumentMessage__real(i,null)'
  ),
  prefaceGlyphsHTML: wrap('prefaceGlyphsHTML', 'e,s,a', 'return prefaceGlyphsHTML__real(e,20,a)'),
  prefaceCatGlyphHTML: wrap(
    'prefaceCatGlyphHTML',
    'c,s',
    'return prefaceCatGlyphHTML__real(PREFACE_CAT_ORDER[0],s)'
  ),
  prefaceGroups: wrap(
    'prefaceGroups',
    '',
    'const g={...prefaceGroups__real()};delete g[Object.keys(g)[0]];return g'
  ),
  prefaceCategoryOf: wrap(
    'prefaceCategoryOf',
    'e',
    'prefaceCategoryOf__real(e);return PREFACE_CAT_ORDER[0]'
  ),
  loadNavGlyphArt: wrap(
    'loadNavGlyphArt',
    '',
    'void loadNavGlyphArt__real;return Promise.resolve(null)'
  ),
  normalizeSearch: wrap(
    'normalizeSearch',
    's',
    String.raw`void normalizeSearch__real;return(s||"").toLowerCase().replace(/[-–—]/g," ").replace(/\s+/g," ").trim()`
  ),
  searchRank: wrap('searchRank', 'q,n,x', 'return searchRank__real(q,n,x)+1'),
  findSimilarInstruments: wrap(
    'findSimilarInstruments',
    'i,n',
    'return findSimilarInstruments__real(i,n).slice().reverse()'
  ),
  getMatchingInstrumentAxes: wrap(
    'getMatchingInstrumentAxes',
    'a,b,n',
    'return getMatchingInstrumentAxes__real(a,b,n).slice(1)'
  ),
  findSimilar: wrap('findSimilar', 'i,n', 'return findSimilar__real(i,n).slice().reverse()'),
  getMatchingAxes: wrap('getMatchingAxes', 'a,b,n', 'return getMatchingAxes__real(a,b,n).slice(1)'),
};
// Further drifts, for a name whose hold covers more than one of its
// behaviours: addInstrumentFromPicker's configure option, which the store's
// configured add depends on, ignored.
const MORE_PLANTS = [
  [
    'addInstrumentFromPicker',
    wrap(
      'addInstrumentFromPicker',
      'i,o',
      'return addInstrumentFromPicker__real(i,o&&{...o,configure:undefined})',
      { async: true }
    ),
  ],
];
// A LIVE_TABLES name planted in load.js itself: its getter becomes a plain
// property, which keeps the slot's value when the engine was created.
const livePlant = (moduleText, name) => {
  const from = `get ${name}() { return ${name}; }`;
  return moduleText.split(from).length === 2 ? moduleText.replace(from, `${name}: ${name}`) : null;
};
const holdOf = (name) => Object.keys(HOLDS).find((h) => HOLDS[h].includes(name));
// The page with one plant in, or null when its anchor isn't there exactly once.
function planted(page, plant) {
  if (typeof plant === 'function') return plant(page);
  const [from, to] = plant;
  return page.split(from).length === 2 ? page.replace(from, () => to) : null;
}

async function browserArm(want) {
  const { chromium } = require('playwright');
  const { start } = require('./_pages_server.js');
  const srv = await start({ root: ROOT });
  const base = (srv.url || `http://127.0.0.1:${srv.port}`).replace(/\/$/, '');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    const offsite = [];
    const asked = [];
    page.on('request', (r) => {
      // A blob: URL of the page's own origin is the module load.js built.
      const own = r.url().startsWith(base) || r.url().startsWith(`blob:${base}/`);
      if (!own) offsite.push(r.url());
      else if (r.url().startsWith(base)) asked.push(new URL(r.url()).pathname);
    });
    await page.goto(`${base}/prototype/index.html`);
    const got = await page.evaluate(async () => {
      const before = new Set(Object.getOwnPropertyNames(window));
      const { loadEngine } = await import('./engine/load.js');
      const E = await loadEngine();
      await E.Catalog.ensureFull('bluegrass');
      E.app.cards = [];
      E.importTradition('bluegrass');
      const rich = E.compileRecipeStack(E.app.cards, 'rich', { ceiling: 1000 });
      const added = Object.getOwnPropertyNames(window).filter((k) => !before.has(k));
      return { rich, added };
    });
    expect(got.rich === want, 'browser: the bluegrass recipe differs from production’s');
    expect(offsite.length === 0, `browser: requests left the origin: ${offsite.join(', ')}`);
    expect(asked.includes('/codex.html'), 'browser: load.js did not read ../codex.html');
    expect(
      asked.includes('/api/engine.json') && asked.includes('/api/browse_boot.json'),
      `browser: the engine did not boot from api/ (asked ${asked.join(', ')})`
    );
    expect(got.added.length === 0, `browser: the engine added globals: ${got.added.join(', ')}`);
  } finally {
    await browser.close();
    if (srv.close) await srv.close();
  }
}

async function productionHolds(names, which, input) {
  const { chromium } = require('playwright');
  const { start } = require('./_pages_server.js');
  const srv = await start({ root: ROOT });
  const base = (srv.url || `http://127.0.0.1:${srv.port}`).replace(/\/$/, '');
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  try {
    return await pageHolds(browser, base, names, which, input);
  } finally {
    await browser.close();
    if (srv.close) await srv.close();
  }
}

(async () => {
  const L = await asModule(fs.readFileSync(LOAD, 'utf8'));
  const page = fs.readFileSync(path.join(ROOT, 'codex.html'), 'utf8');

  // 1. names
  const names = ['Catalog', 'Engine', 'CATALOG_READY', ...EXPORTED.filter((n) => n !== 'Catalog')];
  expect(
    JSON.stringify([...L.NAMES].sort()) === JSON.stringify([...names].sort()),
    `load.js NAMES [${L.NAMES}] are not _load_app.js EXPORTED plus the boot [${names}]`
  );

  // 2 and 3. same recipes, sealed
  const { ids, named, retired } = sample();
  expect(named === NAMED.length, `only ${named} of ${NAMED.length} named genres are in the index`);
  expect(!!retired, 'no retired genre id to sample');
  const before = new Set(Object.getOwnPropertyNames(globalThis));
  const mod = await asModule(L.engineModule(page));
  const got = await recipesOf(mod, L.ENGINE_REQUEST, ids);
  const added = Object.getOwnPropertyNames(globalThis).filter((k) => !before.has(k));
  expect(added.length === 0, `the engine added globals: ${added.join(', ')}`);
  const production = reference(ids);
  const { agree, diffs } = compare(got, production, ids);
  expect(
    agree === ids.length * FORMATS.length,
    `${diffs.length} of ${ids.length * FORMATS.length} recipes differ:\n    ${diffs.slice(0, 5).join('\n    ')}`
  );
  // The engine's requests: the static catalog only.
  for (const [url, ok] of [
    ['api/engine.json?v=83ed4a2938b9', true],
    ['api/traditions/bluegrass.json', true],
    ['api/../codex.html', false],
    ['https://example.org/chat', false],
    ['/chat/jobs/1', false],
  ])
    expect(
      (L.ENGINE_REQUEST.test(url) && !url.includes('..')) === ok,
      `the engine's request rule ${ok ? 'refuses' : 'allows'} ${url}`
    );

  // 4. in the browser
  await browserArm(production.bluegrass.rich);

  // 5. the gate can fail: the recipe ceiling the app compiles to, changed;
  // and a page whose app.js block is gone.
  const CEILING = 'const RECIPE_CHAR_CEILING=1e3;';
  expect(page.split(CEILING).length === 2, `codex.html no longer declares ${CEILING} once`);
  const pmod = await asModule(
    L.engineModule(page.replace(CEILING, 'const RECIPE_CHAR_CEILING=120;'))
  );
  const four = NAMED.slice(0, 4);
  const pcmp = compare(await recipesOf(pmod, L.ENGINE_REQUEST, four), production, four);
  expect(pcmp.diffs.length > 0, 'a module with a changed engine constant still agrees');
  let refused = false;
  try {
    L.engineModule(page.replace('// ─── runtime: src/app.js ───', '// ─── runtime: app ───'));
  } catch {
    refused = true;
  }
  expect(refused, 'a page without its app.js block is not refused');

  // 6. every routed name is held, and equal to production
  const routed = [...L.PAGE_TABLES, ...L.LIVE_TABLES];
  const held = Object.values(HOLDS).flat();
  for (const n of routed)
    expect(
      held.includes(n) || DISCOVERY_HELD.includes(n),
      `load.js routes ${n}, but no hold here or in check_prototype_hosts.js holds it`
    );
  for (const n of [...held, ...DISCOVERY_HELD])
    expect(routed.includes(n), `a hold names ${n}, which load.js doesn't route`);
  for (const n of held)
    expect(
      L.LIVE_TABLES.includes(n) || n in PLANTS,
      `${n} has no planted drift, so its hold could never fail`
    );
  {
    const E = mod.createEngine({ fetch: fileFetch(L.ENGINE_REQUEST) });
    await E.CATALOG_READY;
    await E.Engine.ensure();
    for (const n of L.LIVE_TABLES) {
      let v;
      try {
        v = E[n];
      } catch (e) {
        v = e;
      }
      expect(
        Array.isArray(v) && v.length > 0,
        `the engine's ${n} getter does not read a filled table once the instrument engine is in`
      );
    }
  }
  const input = holdInput();
  const which = Object.keys(HOLDS);
  const mine = await moduleHolds(mod, L.ENGINE_REQUEST, which, input);
  const prod = await productionHolds(holdNames(L), which, input);
  expect(!prod.errors.length, `codex.html raised errors: ${prod.errors.join(' | ')}`);
  const want = prod.got;
  for (const h of which) {
    const a = JSON.stringify(mine[h]);
    const b = JSON.stringify(want[h]);
    expect(
      !(want[h] && want[h].error) && a === b,
      `hold ${h} (${HOLDS[h].join(', ')}): the module ${a.slice(0, 160)} vs codex.html ${String(b).slice(0, 160)}`
    );
  }
  // What the holds were written to see (6647387849, 6647648469).
  expect(want.glyphs && want.glyphs.unfilled === false, 'codex.html still shows emoji glyphs');
  const acousmatic = (want.gensim || []).find((g) => g[0] === 'acousmatic');
  expect(
    !!acousmatic && acousmatic[1] === 'acousmatic_music' && acousmatic[2][0][0] === 'glitch_2000s',
    'acousmatic does not resolve to acousmatic_music with glitch_2000s first'
  );
  const ud = ((want.search && want.search.ranks) || [])[0] || [];
  expect(
    ud.length >= 3 && ['Udu (', 'Udukkai (', 'ʿŪd ('].every((w, i) => ud[i][0].startsWith(w)),
    `"ud" does not rank udu, udukkai, oud first (${JSON.stringify(ud.slice(0, 3))})`
  );

  // 7. every routed name's planted drift fails its hold (and MORE_PLANTS)
  let drifts = 0;
  const drifted = [...held.map((n) => [n, PLANTS[n]]), ...MORE_PLANTS];
  for (const [n, plant] of drifted) {
    const text = !plant
      ? livePlant(L.engineModule(page), n)
      : (() => {
          const p = planted(page, plant);
          return p && L.engineModule(p);
        })();
    expect(!!text, `the planted drift for ${n} no longer applies`);
    if (!text) continue;
    const h = holdOf(n);
    let got;
    try {
      got = (await moduleHolds(await asModule(text), L.ENGINE_REQUEST, [h], input))[h];
    } catch (e) {
      got = { error: String(e && e.message) };
    }
    // A drift changes behaviour; it doesn't break the engine (a getter's
    // drift is the one that is meant to leave a table unread).
    expect(
      L.LIVE_TABLES.includes(n) || !(got && got.error),
      `${n}'s planted drift breaks the engine instead of changing it: ${got && got.error}`
    );
    const agrees = JSON.stringify(got) === JSON.stringify(want[h]);
    expect(!agrees, `with ${n}'s planted drift, hold ${h} still agrees with production`);
    if (!agrees) drifts++;
  }

  if (problems.length) {
    console.error(`check_prototype_engine: FAIL — ${problems.length} of ${checks} checks`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log(
    `check_prototype_engine: ${checks}/${checks} checks pass — ${agree} recipes (${ids.length} genres × ${FORMATS.length} formats) equal production's, and bluegrass in Chromium through ../codex.html; a planted drift fails ${pcmp.diffs.length}/${four.length * FORMATS.length}; ${held.length} routed names in ${Object.keys(HOLDS).length} holds equal codex.html's own, and ${drifts}/${drifted.length} planted drifts fail their hold`
  );
})().catch((e) => {
  console.error('check_prototype_engine: ERROR', e && e.stack);
  process.exit(2);
});
