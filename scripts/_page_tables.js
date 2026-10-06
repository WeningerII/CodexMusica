// The page's copy of the catalog tables, and the instrument engine the lazy
// shell fetches instead of carrying. One definition, three readers:
// build_html.js strips the tables it inlines, build_static_api.js writes
// api/engine.json, and check_api.js holds that file to exactly what these
// functions derive.
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
//
// ──────────────────────────── the instrument engine ────────────────────────────
// ENGINE_TABLES are what the page reads to edit and render a recipe: the
// instruments with their parts and variants, the family parts merged into them,
// rooms, chains, tunings, the instrument axes and the preface lexicon. They are
// 77% of the page's inline data and the first view reads none of them but the
// instruments' names and families (INSTRUMENT_INDEX, below). The --embedded
// build keeps them inline; the lazy shell declares an empty slot for each, and
// fetches api/engine.json after its first paint (Engine in src/app.js).
//
// api/engine.json is the page copy, unmerged: exactly the tables the embedded
// page inlines, stripped as above, before mergeFamilyParts runs in the page.
// It is ONE JSON array with ONE ELEMENT PER LINE, so the page can parse it a
// line at a time in idle slices rather than in one long task:
//
//   [
//   {"name": …, "tables_sha1": …, "tables": ENGINE_TABLES, "run": 50},
//   ["INSTRUMENT_FAMILY_PARTS", {…}],
//   ["INSTRUMENTS", [ …the first 50 instruments… ]],
//   ["INSTRUMENTS", [ …the next 50… ]],
//   …
//   ["PREFACE_LEXICON", […]]
//   ]
//
// tables_sha1 is engineSha(the tables); the page carries the same digest
// (CODEX_ENGINE_SHA) and refuses a file that does not match it, so a page and
// an engine from different deploys never mix.
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
    ['', ['surface']],
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

const ENGINE_NAME =
  'Codex Musica — instrument engine (the page copy of references 01, 02, 03 and 07, unmerged; read by the lazy app after its first paint; internal)';

// api/engine.json's text (see the layout above).
function engineText(refsDir) {
  const tables = engineTables(refsDir);
  const els = [
    { name: ENGINE_NAME, tables_sha1: engineSha(tables), tables: ENGINE_TABLES, run: ENGINE_RUN },
  ];
  for (const n of ENGINE_TABLES) {
    if (n !== 'INSTRUMENTS') els.push([n, tables[n]]);
    else
      for (let i = 0; i < tables[n].length; i += ENGINE_RUN)
        els.push([n, tables[n].slice(i, i + ENGINE_RUN)]);
  }
  const lines = els.map((e) => JSON.stringify(e));
  for (const l of lines)
    if (l.includes('\n')) throw new Error('_page_tables: an engine element spans lines');
  return '[\n' + lines.join(',\n') + '\n]\n';
}
// The inverse, for the gates: { header, tables }. Requires the line layout.
function readEngineText(text) {
  const lines = text.split('\n');
  if (lines[0] !== '[' || lines[lines.length - 2] !== ']' || lines[lines.length - 1] !== '')
    throw new Error('engine.json: not one element per line between "[" and "]"');
  const body = lines
    .slice(1, -2)
    .map((l, i, a) => JSON.parse(i < a.length - 1 ? l.replace(/,$/, '') : l));
  const [header, ...rest] = body;
  const tables = {};
  for (const [name, value] of rest) {
    if (name === 'INSTRUMENTS') (tables.INSTRUMENTS = tables.INSTRUMENTS || []).push(...value);
    else tables[name] = value;
  }
  return { header, tables };
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
  ENGINE_TABLES,
  ENGINE_FILES,
  ENGINE_SOURCES,
  ENGINE_RUN,
  engineTables,
  engineSha,
  engineText,
  readEngineText,
  instrumentIndex,
};
