// The page's copy of the catalog tables, and the instrument engine the lazy
// shell fetches instead of carrying. One definition, four readers:
// build_html.js strips the tables it inlines, build_static_api.js writes
// api/engine.json, check_api.js holds that file to exactly what these
// functions derive, and tandem.js holds the shipped page's engine slots and
// digests to them.
//
// ──────────────────────────── page-only data strip ────────────────────────────
// references/ is the catalog for every consumer, and the page reads less of it
// than the others. The tables and fields below exist for the Node side — the CLI
// renderers, scoring, audits and the connector — and nothing the page runs reads
// them: git grep --text over src/ and the snippets build_html.js inlines finds no
// reader (no property access, and no generic read such as Object.keys over a
// catalog object). Re-run that search before adding a field here. They are
// dropped from the PAGE only: references/, the published api/ files, the
// connector and the CLI keep full data. The built-page gates
// (app_recipe_regression, equivalence, check_lazy_app,
// check_minified_equivalence) prove the page did not need them, and
// build_html.js --check asserts they are gone.
//
//   CHAIN_ARCHETYPES, PRODUCTION_AESTHETICS, ARRANGEMENTS — CLI-only renderer
//     inputs (SKILL.md §9.1: "not levers for the Rich/browser recipe").
//   match_tokens — the offline matcher's vocabulary; _card_descriptors.js pools
//     descriptors only, and tandem.js fails if the page ever reads it.
//   canonical_tags — scoring-only (entryRenderDescs omits them on purpose).
//   surface, auto, pointer, stateKey, neg_anchor / pos_anchor, and rooms'
//     default_chain_archetype / scale_tier / era / region — audit and CLI
//     fields; families and room clusters are read for id and name only.
//   instruments' description and sources (158 instruments carry them) — the
//     published per-instrument files and the CLI show them; the page shows
//     neither (every `.description` it reads is a genre's or a taxonomy
//     node's, and nothing reads `.sources`). About 24 KB gzipped: 3.5% of
//     api/engine.json with them kept.
//
// ──────────────────────────── the instrument engine ────────────────────────────
// ENGINE_TABLES are what the page reads to edit and render a recipe: the
// instruments with their parts and variants, the family parts merged into them,
// rooms, chains, tunings, the instrument axes and the preface lexicon. They
// were 92% of the lazy page's inline data, gzipped (check_payload_budget's
// inline-data measure, on the step-8 page), and the first view reads none of
// them but the instruments' names and families (INSTRUMENT_INDEX, below). The
// --embedded build keeps them inline; the lazy shell declares an empty slot for
// each, and fetches api/engine.json at its first paint, or sooner when an
// action needs it or a saved session will (Engine in src/app.js,
// src/engine_preload.js).
//
// api/engine.json is the page copy, unmerged: exactly the tables the embedded
// page inlines, stripped as above, before mergeFamilyParts runs in the page —
// less what the lazy page already holds, and plus what spares it work:
//
//   • INDEX_FIELDS. Each instrument's id, name, family and short are written as
//     0. The lazy page carries them in INSTRUMENT_INDEX (below), in the same
//     order, and fills each back by position before anything reads it; the key
//     stays, so every instrument keeps its key order. 40 KB of the file
//     gzipped that the page had already downloaded.
//   • MERGE_PLAN (mergePlan, below): the universal-material choices of the
//     family-parts merge, written down by running scripts/_merge.js here. The
//     page passes it to the same merge, which then skips its predicate passes
//     (a quarter of a second of main thread at 4x CPU) and builds the same
//     objects; mergePlan proves that before the file is written.
//
// It is ONE JSON array with ONE ELEMENT PER LINE, so the page can parse it a
// line at a time in idle slices rather than in one long task:
//
//   [
//   {"name": …, "tables_sha1": …, "tables": ENGINE_TABLES, "run": 50, "index_fields": INDEX_FIELDS},
//   ["INSTRUMENT_FAMILY_PARTS", {…}],
//   ["INSTRUMENTS", [ …the first 50 instruments… ]],
//   ["INSTRUMENTS", [ …the next 50… ]],
//   …
//   ["PREFACE_LEXICON", […]],
//   ["MERGE_PLAN", {"merge_sha1": …, "kinds": {…}}]
//   ]
//
// tables_sha1 is engineSha(the tables), whole (the index fields filled in); the
// page carries the same digest (CODEX_ENGINE_SHA) and refuses a file that does
// not match it, so a page and an engine from different deploys never mix.
// merge_sha1 is mergeSha(), the digest of the merge code that wrote the plan;
// the page uses the plan only when its own merge code has that digest
// (CODEX_MERGE_SHA), and otherwise merges the long way, to the same result.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PAGE_DROP_TABLES = new Set(['CHAIN_ARCHETYPES', 'PRODUCTION_AESTHETICS', 'ARRANGEMENTS']);
const VARIANT_DROP = ['match_tokens', 'canonical_tags', 'surface', 'auto'];
const PAGE_DROP_FIELDS = {
  // table -> [path from each element ('' = the element itself), fields]
  INSTRUMENT_FAMILY_PARTS: [['*.variants', VARIANT_DROP]],
  INSTRUMENT_FAMILIES: [['', ['note', 'descriptors', 'canonical_tags']]],
  INSTRUMENTS: [
    ['', ['surface', 'description', 'sources']],
    ['parts', ['surface']],
    ['parts.variants', VARIANT_DROP],
  ],
  ROOMS: [['', ['canonical_tags', 'default_chain_archetype', 'scale_tier', 'era', 'region']]],
  ROOM_CLUSTERS: [['', ['note', 'descriptors', 'canonical_tags']]],
  CHAIN_SECTIONS: [
    ['', ['stateKey']],
    ['items', ['canonical_tags']],
  ],
  TUNINGS: [['', ['pointer', 'canonical_tags']]],
  AXIS_DEFINITIONS: [['', ['neg_anchor', 'pos_anchor']]],
  INSTRUMENT_AXIS_DEFINITIONS: [['', ['neg_anchor', 'pos_anchor']]],
};
// Objects reached from each element of a table by a dotted path; `*` expands an
// object's values (INSTRUMENT_FAMILY_PARTS is family -> parts).
function reach(elements, pathSpec) {
  const flat = (list) => list.flatMap((n) => (Array.isArray(n) ? flat(n) : n == null ? [] : [n]));
  let nodes = flat(elements);
  for (const step of pathSpec ? pathSpec.split('.') : [])
    nodes = flat(nodes.map((n) => (step === '*' ? Object.values(n) : n[step])));
  return nodes;
}
const tableElements = (value) => (Array.isArray(value) ? value : [value]);
// Re-emitting a table as JSON is exact only for JSON-safe data. Say so loudly
// rather than letting undefined, NaN, -0 or a function change on the way.
function assertJsonSafe(v, where) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || Object.is(v, -0)) throw new Error(`page strip: ${where} is ${v}`);
    return;
  }
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      if (!(i in v)) throw new Error(`page strip: ${where} has a hole at ${i}`);
      assertJsonSafe(v[i], `${where}[${i}]`);
    }
    return;
  }
  if (typeof v === 'object') {
    for (const k of Object.keys(v)) assertJsonSafe(v[k], `${where}.${k}`);
    return;
  }
  throw new Error(`page strip: ${where} is a ${typeof v}`);
}
// One table's page copy: the page-only fields dropped (in place), then checked
// JSON-safe. Returns the value.
function stripTable(name, value) {
  for (const [pathSpec, fields] of PAGE_DROP_FIELDS[name] || [])
    for (const node of reach(tableElements(value), pathSpec))
      for (const k of fields) delete node[k];
  assertJsonSafe(value, name);
  return value;
}

// The signature table's page copy holds only the non-empty lists. Its one
// reader in the page, _traditionSignatureFor, answers
// `(tradId && TRADITION_SIGNATURES[tradId]) || []`, which is [] for a missing
// id and for an empty list alike, so dropping the 1,183 empty lists changes no
// answer and spares api/engine.json about 6 KB gzipped. This is the one
// definition of that rule: the codec (scripts/_engine_codec.js) refuses an
// empty list, and the gates compare the decoded table with this, never with a
// filter of their own (check_api.js recomputes it inline on purpose, to catch
// a rule that drops too much).
const nonEmptySignatures = (sigs) => {
  const out = {};
  for (const [id, list] of Object.entries(sigs)) if (list.length) out[id] = list;
  return out;
};

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
// references files whose every table is an engine table: the lazy page omits
// them whole (a fully stripped file would leave an empty labelled block).
const ENGINE_FILES = ['01_family_parts.js', '07_preface_lexicon.js'];
// The files the engine tables are declared in.
const ENGINE_SOURCES = [
  '01_family_parts.js',
  '02_instruments.js',
  '03_rooms_chains_tunings.js',
  '07_preface_lexicon.js',
];
const ENGINE_RUN = 50; // instruments per line of api/engine.json
// The instrument fields api/engine.json leaves to INSTRUMENT_INDEX, in its
// column order (instrumentIndex, below).
const INDEX_FIELDS = ['id', 'name', 'family', 'short'];

function declaredTables(source) {
  return [...source.matchAll(/^(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=/gm)].map((m) => m[1]);
}

// The engine tables, as the embedded page inlines them: each source file
// evaluated in a fresh context (never _loader.js, whose INSTRUMENTS are already
// merged), each table stripped, round-tripped through JSON, in ENGINE_TABLES
// order. Throws if a source no longer declares what this module expects.
function engineTables(refsDir) {
  const found = {};
  for (const f of ENGINE_SOURCES) {
    const source = fs.readFileSync(path.join(refsDir, f), 'utf8');
    const names = declaredTables(source);
    if (ENGINE_FILES.includes(f)) {
      const strays = names.filter((n) => !ENGINE_TABLES.includes(n));
      if (strays.length)
        throw new Error(
          `_page_tables: ${f} declares ${strays.join(', ')}, which is not an engine table; the lazy page omits this file whole`
        );
    }
    const ctx = vm.createContext({});
    vm.runInContext(source, ctx, { filename: f });
    for (const n of names) if (ENGINE_TABLES.includes(n)) found[n] = vm.runInContext(n, ctx);
  }
  const out = {};
  for (const n of ENGINE_TABLES) {
    if (!(n in found)) throw new Error(`_page_tables: no references file declares ${n}`);
    out[n] = JSON.parse(JSON.stringify(stripTable(n, found[n])));
  }
  return out;
}
const engineSha = (tables) =>
  crypto.createHash('sha1').update(JSON.stringify(tables)).digest('hex');

// ─────────────────────────────── the merge plan ───────────────────────────────
// The digest of the merge code the page carries: the region of scripts/_merge.js
// that build_html.js inlines.
function mergeSha() {
  const source = fs.readFileSync(path.join(__dirname, '_merge.js'), 'utf8');
  const m = source.match(/\/\* @inline-start[^\n]*\*\/\n([\s\S]*?)\n\/\* @inline-end \*\//);
  if (!m) throw new Error('_page_tables: no @inline region in scripts/_merge.js');
  return crypto.createHash('sha1').update(m[1]).digest('hex');
}
// Whether two object graphs are the same: the same keys in the same order, the
// same primitives (Object.is), and the same SHARING — a bijection between their
// objects, so an object two parts share in one is one object in the other, and
// two objects in one are two in the other. Returns null, or where they differ.
function graphDiff(a, b) {
  const ab = new Map(),
    ba = new Map(),
    stack = [[a, b, '$']];
  while (stack.length) {
    const [x, y, at] = stack.pop();
    const ox = x !== null && typeof x === 'object',
      oy = y !== null && typeof y === 'object';
    if (!ox || !oy) {
      if (ox !== oy || !Object.is(x, y)) return at;
      continue;
    }
    if (ab.has(x) || ba.has(y)) {
      if (ab.get(x) !== y || ba.get(y) !== x) return at + ' (shared differently)';
      continue;
    }
    ab.set(x, y);
    ba.set(y, x);
    if (Array.isArray(x) !== Array.isArray(y)) return at;
    const kx = Object.keys(x),
      ky = Object.keys(y);
    if (kx.length !== ky.length || kx.some((k, i) => k !== ky[i])) return at + ' (keys)';
    for (const k of kx) stack.push([x[k], y[k], at + '.' + k]);
  }
  return null;
}
// The merge plan for these (stripped, unmerged) tables: for each universal
// material kind, in scripts/_merge.js's order, the parts its predicate picks
// (`t`: instrument-index delta, part index) and the variants it collects, in
// union order (`u`: instrument-index delta, part index, variant index), each at
// the first place the pass meets it. Positions are as the pass sees them: after
// the family parts are merged in and the kinds before it have lent theirs.
// Then the proof: the tables merged with the plan and merged without it are the
// same graph (graphDiff), or this throws and no file is written.
function mergePlan(tables) {
  const { mergeFamilyParts } = require('./_merge.js');
  const copy = () =>
    JSON.parse(JSON.stringify([tables.INSTRUMENTS, tables.INSTRUMENT_FAMILY_PARTS]));
  const kinds = {};
  const observe = (kind, instruments, targets, union) => {
    const t = [],
      u = [],
      first = new Map();
    let last = 0;
    instruments.forEach((inst, i) =>
      (Array.isArray(inst.parts) ? inst.parts : []).forEach((p, j) => {
        if (!targets.has(p)) return;
        t.push(i - last, j);
        last = i;
        (Array.isArray(p.variants) ? p.variants : []).forEach((v, k) => {
          if (!first.has(v)) first.set(v, [i, j, k]);
        });
      })
    );
    last = 0;
    for (const v of union) {
      const [i, j, k] = first.get(v);
      u.push(i - last, j, k);
      last = i;
    }
    kinds[kind] = { t, u };
  };
  const [i1, f1] = copy();
  mergeFamilyParts(i1, f1, { observe });
  const [i2, f2] = copy();
  mergeFamilyParts(i2, f2, { plan: kinds });
  const diff = graphDiff([i1, f1], [i2, f2]);
  if (diff)
    throw new Error(
      `_page_tables: the merge plan does not reproduce the merge (differs at ${diff})`
    );
  return { merge_sha1: mergeSha(), kinds };
}

const ENGINE_NAME =
  'Codex Musica — instrument engine (the page copy of references 01, 02, 03 and 07, unmerged; read by the lazy app at its first paint, or from <head> when a saved session needs it; internal)';

// An instrument as api/engine.json writes it: INDEX_FIELDS as 0, in place.
const indexFieldsOut = (inst) => {
  const out = {};
  for (const k of Object.keys(inst)) out[k] = INDEX_FIELDS.includes(k) ? 0 : inst[k];
  return out;
};
// The inverse, in place, as the page does it (Engine in src/app.js): each
// instrument's index fields back from its row of `index`, by position. Throws
// when the counts differ or a field is not the 0 it should be.
function fillIndexFields(instruments, index) {
  if (instruments.length !== index.length)
    throw new Error(`${instruments.length} instruments against an index of ${index.length}`);
  instruments.forEach((inst, k) =>
    INDEX_FIELDS.forEach((f, c) => {
      if (!(f in inst)) return;
      if (inst[f] !== 0) throw new Error(`instrument ${k}: ${f} is not the 0 the index fills`);
      inst[f] = index[k][c];
    })
  );
  return instruments;
}

// api/engine.json's text (see the layout above).
function engineText(refsDir) {
  const tables = engineTables(refsDir);
  const els = [
    {
      name: ENGINE_NAME,
      tables_sha1: engineSha(tables),
      tables: ENGINE_TABLES,
      run: ENGINE_RUN,
      index_fields: INDEX_FIELDS,
    },
  ];
  for (const n of ENGINE_TABLES) {
    if (n !== 'INSTRUMENTS') els.push([n, tables[n]]);
    else
      for (let i = 0; i < tables[n].length; i += ENGINE_RUN)
        els.push([n, tables[n].slice(i, i + ENGINE_RUN).map(indexFieldsOut)]);
  }
  els.push(['MERGE_PLAN', mergePlan(tables)]);
  const lines = els.map((e) => JSON.stringify(e));
  for (const l of lines)
    if (l.includes('\n')) throw new Error('_page_tables: an engine element spans lines');
  return '[\n' + lines.join(',\n') + '\n]\n';
}
// The inverse, for the gates: { header, tables, plan }, the instruments' index
// fields filled back from `index` (instrumentIndex of the same instruments).
// Requires the line layout.
function readEngineText(text, index) {
  const lines = text.split('\n');
  if (lines[0] !== '[' || lines[lines.length - 2] !== ']' || lines[lines.length - 1] !== '')
    throw new Error('engine.json: not one element per line between "[" and "]"');
  const body = lines
    .slice(1, -2)
    .map((l, i, a) => JSON.parse(i < a.length - 1 ? l.replace(/,$/, '') : l));
  const [header, ...rest] = body;
  const tables = {};
  let plan = null;
  for (const [name, value] of rest) {
    if (name === 'INSTRUMENTS') (tables.INSTRUMENTS = tables.INSTRUMENTS || []).push(...value);
    else if (name === 'MERGE_PLAN') plan = value;
    else tables[name] = value;
  }
  if (JSON.stringify(header.index_fields) !== JSON.stringify(INDEX_FIELDS))
    throw new Error(`engine.json: its header's index_fields are not ${INDEX_FIELDS.join(', ')}`);
  fillIndexFields(tables.INSTRUMENTS || [], index);
  return { header, tables, plan };
}

// The first view's instrument index: [id, name, family, short] per instrument,
// in source order (short is null when the instrument has none).
const instrumentIndex = (instruments) =>
  instruments.map((i) => [i.id, i.name, i.family, i.short == null ? null : i.short]);

module.exports = {
  PAGE_DROP_TABLES,
  VARIANT_DROP,
  PAGE_DROP_FIELDS,
  reach,
  tableElements,
  assertJsonSafe,
  stripTable,
  nonEmptySignatures,
  ENGINE_TABLES,
  ENGINE_FILES,
  ENGINE_SOURCES,
  ENGINE_RUN,
  INDEX_FIELDS,
  engineTables,
  engineSha,
  mergeSha,
  graphDiff,
  mergePlan,
  fillIndexFields,
  engineText,
  readEngineText,
  instrumentIndex,
};
