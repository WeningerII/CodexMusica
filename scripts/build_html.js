#!/usr/bin/env node
// build_html.js — assemble codex.html from src/ + references/*.js.
//
// codex.html is the shipped browser app. The DEFAULT build (since the lazy-load
// migration) is the LAZY SHELL: an HTML shell (src/index.template.html) with the
// catalog data the first view needs embedded as JS const declarations and the
// application code appended, while the two tradition tables (~66% of the
// embedded bytes) and the instrument engine stay OUT of the page — the app's
// Catalog layer boots the traditions from api/browse_boot.json (one fetch),
// reads the genres' prose from api/browse_prose.json after the first paint,
// and pulls each tradition's import payload from api/traditions/{id}.json on
// demand; the engine's eight tables come from api/engine.json, at the first
// paint or from <head> when a saved session needs them. The shell therefore
// deploys NEXT TO the committed api/ directory (GitHub Pages serves both from
// the repo root).
// `--embedded` builds the historical fully-self-contained single-file variant
// (every table in the page; works from file:// with no api/). check_lazy_app.js
// gates the two variants to behave identically. This script:
//
//   1. Reads the HTML shell src/index.template.html, which contains a single
//      <!--@CODEX_BODY--> marker where everything dynamic is injected.
//   2. Reads references/*.js (the catalog data) and chunks each into its own
//      <script> tag (so the browser frees each AST during parse).
//   3. Inlines the family-parts merge from scripts/_merge.js.
//   4. Reads the application code (src/layout.js, src/app.js, src/workbench.js,
//      src/pages/*.js) and gives each module its own <script> tag, in load order
//      (see RUNTIME_MODULES).
//   5. Replaces the marker with data + merge + app → codex.html.
//
// src/index.template.html and src/app.js are first-class source files; the data
// block is regenerated from references/*.js on every build.
//
// USAGE
//   node scripts/build_html.js                    # lazy shell (default) into OUTPUT_DIR (see _paths.js; CODEX_OUT_DIR overrides)
//   node scripts/build_html.js --out=path.html    # custom output path
//   node scripts/build_html.js --embedded         # fully-embedded single-file variant (all tables in the page; no api/ needed)
//   node scripts/build_html.js --lazy             # explicit lazy shell (same output as the default). Kept, not dead:
//                                                 #   check_lazy_app.js passes it so both of its builds name their mode,
//                                                 #   and `npm run build:html:lazy` and docs/place-production-plan.md cite it
//   node scripts/build_html.js --check            # post-build: eval data block, compile every <script>, assert no block is all-comment, runtime blocks stay sloppy, <script> byte ceiling
//   node scripts/build_html.js --quiet            # suppress per-source-file size summary
//   node scripts/build_html.js --no-minify        # skip minification (reading the artifact by hand; never used by CI or publish)
//
// EXIT CODES
//   0  success
//   2  missing required source (src/index.template.html or src/app.js), or
//      --embedded together with --lazy
//   3  an unknown or retired flag (--validate, --strict), or a positional argument
//   4  embedded data block failed to parse, a table did not read back, an
//      emitted <script> does not compile on its own (--check), or a references
//      file the page-only strip rewrites holds anything but table declarations
//   5  template is missing the <!--@CODEX_BODY--> or <!--@THEME_BOOT--> marker
//   6  an emitted <script> is all comment, a runtime block became strict-mode
//      code, or a block exceeds the hard byte ceiling (--check)

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// The page-only data strip and the instrument engine's tables (see there).
const P = require('./_page_tables.js');

const SKILL_ROOT = path.join(__dirname, '..');
const REFS = path.join(SKILL_ROOT, 'references');
const SRC = path.join(SKILL_ROOT, 'src');
const TEMPLATE = path.join(SRC, 'index.template.html');
const APP = path.join(SRC, 'app.js');
const CODEX_BODY_MARKER = '<!--@CODEX_BODY-->';
const { HTML_OUT: DEFAULT_OUTPUT } = require('./_paths.js');

// Source files in their declaration order — the embedded const declarations
// must appear in the same order they did in the original HTML to keep any
// downstream lookup-by-position assumptions intact.
const SOURCE_FILES = [
  '01_family_parts.js',
  '02_instruments.js',
  '03_rooms_chains_tunings.js',
  '04_tree.js',
  '05_traditions.js',
  '06_extras.js',
  '07_preface_lexicon.js',
  '08_asset_manifest.js',
  '09_nav_glyphs.js',
];

// ──────────────────────────── argv ────────────────────────────

const args = process.argv.slice(2);
const flags = {};
const stray = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[a.slice(2)] = next;
        i++;
      } else flags[a.slice(2)] = true;
    }
  } else stray.push(a);
}

// Only the flags in USAGE are read, and anything else is refused rather than
// ignored: a mistyped `--embed` used to build the lazy shell without a word, and
// a caller still passing --strict (which once also ran --check) would be told
// the build was checked when nothing was.
const KNOWN_FLAGS = new Set(['out', 'embedded', 'lazy', 'check', 'quiet', 'no-minify']);
const RETIRED_FLAGS = {
  validate: 'run `npm run validate` (scripts/validate.js) before the build instead',
  strict: 'run `npm run validate` before the build and pass --check',
};
const refused = Object.keys(flags)
  .filter((f) => !KNOWN_FLAGS.has(f))
  .map((f) =>
    RETIRED_FLAGS[f]
      ? `--${f} is retired: ${RETIRED_FLAGS[f]}`
      : `--${f} is not a flag of this script`
  )
  .concat(stray.map((a) => `unexpected argument "${a}" (build_html takes flags only)`));
if (refused.length) {
  refused.forEach((r) => console.error('build_html: ' + r));
  console.error('  flags: ' + Array.from(KNOWN_FLAGS, (f) => '--' + f).join(' ') + ' (see USAGE)');
  process.exit(3);
}

const outputPath = flags.out || DEFAULT_OUTPUT;

// Mode switch — the lazy shell is the DEFAULT. The two tradition tables —
// 65%+ of the embedded data — stay OUT of the page; the app's Catalog layer
// boots them from api/browse_boot.json (one fetch; the genres' prose follows
// from api/browse_prose.json after the first paint) and pulls each tradition's
// import payload from api/traditions/{id}.json on demand. The injected
// CODEX_LAZY_API const is the switch src/app.js keys off. `--embedded` opts
// into the fully-embedded single-file build (all tables in the page; the
// node/jsdom parity harnesses build it, and it still works from file://).
// `--lazy` stays accepted as an explicit opt-in for pre-flip invocations.
if (flags.embedded && flags.lazy) {
  console.error('build_html: --embedded and --lazy are mutually exclusive');
  process.exit(2);
}
const LAZY = !flags.embedded;
// Files the lazy shell leaves out whole: the two tradition tables (read from
// api/browse_boot.json and api/browse_prose.json), and the references files
// whose every table is an instrument-engine table (scripts/_page_tables.js).
const LAZY_OMIT = new Set(['05_traditions.js', '06_extras.js', ...(LAZY ? P.ENGINE_FILES : [])]);
// Tables the lazy shell leaves out of a file it otherwise ships. NAV_GLYPH_SVGS
// is the room and preface glyph artwork (~0.75 MB), drawn only in the editor's
// Character and Environment tabs, the preface browser and the Instrument page's
// character lists; the app fetches it from api/nav_glyphs.json on first use
// (navGlyphSvg in src/app.js). Its lookup tables stay in the page, and so does
// every picture first paint draws (scripts/_glyph_stores.js).
//
// The instrument-engine tables (ENGINE_TABLES in scripts/_page_tables.js) leave
// the lazy page too: they were 92% of its inline data, gzipped, and the first
// view reads none of them but instrument names and families, which it reads
// from INSTRUMENT_INDEX. The page declares an empty slot for each and fetches
// api/engine.json at its first paint, or from <head> when a saved session needs
// it (Engine in src/app.js, src/engine_preload.js). The embedded build keeps
// them inline.
const LAZY_DROP_TABLES = LAZY ? new Set(['NAV_GLYPH_SVGS', ...P.ENGINE_TABLES]) : new Set();

// ─────────────────────── templates are required source ───────────────────────
// The HTML template and the app are first-class source files under src/. They
// must exist; this script never reconstructs them from a build output.

if (!fs.existsSync(TEMPLATE) || !fs.existsSync(APP)) {
  console.error('Missing source:');
  if (!fs.existsSync(TEMPLATE)) console.error(`  ${TEMPLATE}`);
  if (!fs.existsSync(APP)) console.error(`  ${APP}`);
  process.exit(2);
}

// ──────────────────────────── build ────────────────────────────

const template = fs.readFileSync(TEMPLATE, 'utf8');
const appJs = fs.readFileSync(APP, 'utf8');
const workbenchJs = fs.readFileSync(path.join(SRC, 'workbench.js'), 'utf8');
const workbenchCss = fs.readFileSync(path.join(SRC, 'workbench.css'), 'utf8');
// The four pages, in navigation order. Each registers itself with the shell
// (src/workbench.js) and owns only its own surface; docs/ui-foundation.md
// names the owner of every file. Page styles load after the shell's.
const PAGES = ['genre', 'instrument', 'map', 'lyrics'];
const pageFile = (name, ext) => fs.readFileSync(path.join(SRC, 'pages', name + ext), 'utf8');
const pagesCss = PAGES.map((p) => pageFile(p, '.css')).join('\n');
const layoutJs = fs.readFileSync(path.join(SRC, 'layout.js'), 'utf8');
// The shared theme: tokens + components (loaded first, so everything after it
// may use them) and the preference boot, which runs in <head> before the
// first paint so the page never flashes in the wrong theme.
const themeCss = fs.readFileSync(path.join(SRC, 'theme.css'), 'utf8');
const themeJs = fs.readFileSync(path.join(SRC, 'theme.js'), 'utf8');
const THEME_BOOT_MARKER = '<!--@THEME_BOOT-->';
const layoutCss = fs.readFileSync(path.join(SRC, 'layout.css'), 'utf8');
// The lazy shell asks for its boot index from <head>, so the download starts
// while the page's ~1.6 MB of inline script is still being parsed and run rather
// than when app.js reaches its fetch, 46% of the way down the page. The app's
// fetch() then reuses the preloaded response: `crossorigin` (anonymous) gives
// the same mode and credentials as fetch()'s defaults, and a mismatch would
// show as a second request. The embedded build has no fetch, so no preload.
// Only the boot index: the genres' prose is read after the first paint and is
// never preloaded (a preload would put it on the path to the largest paint).
const BOOT_PRELOAD_MARKER = '<!--@BOOT_PRELOAD-->';
const LAZY_API = 'api/';
if (!template.includes(BOOT_PRELOAD_MARKER)) {
  console.error(`build_html: template is missing the ${BOOT_PRELOAD_MARKER} marker — ${TEMPLATE}`);
  process.exit(5);
}
// A saved session's head start, the lazy page's one other preload: with a
// stored session that has cards, src/engine_preload.js asks for the instrument
// data (api/engine.json) from <head>, so it travels with the page rather than
// after app.js runs; the boot draws nothing until it is in. Emitted as a
// <script> (it reads storage, so it cannot be a static link), with ENGINE_URL
// replaced by the URL app.js's Engine fetches. The embedded build carries the
// instrument data inline and gets nothing here.
const ENGINE_PRELOAD_MARKER = '<!--@ENGINE_PRELOAD-->';
const enginePreloadJs = fs.readFileSync(path.join(SRC, 'engine_preload.js'), 'utf8');
if (!template.includes(ENGINE_PRELOAD_MARKER)) {
  console.error(
    `build_html: template is missing the ${ENGINE_PRELOAD_MARKER} marker — ${TEMPLATE}`
  );
  process.exit(5);
}
if (enginePreloadJs.split("'ENGINE_URL'").length !== 2) {
  console.error("build_html: src/engine_preload.js must name 'ENGINE_URL' exactly once");
  process.exit(5);
}
if (!template.includes(THEME_BOOT_MARKER)) {
  console.error(`build_html: template is missing the ${THEME_BOOT_MARKER} marker — ${TEMPLATE}`);
  process.exit(5);
}
if (!template.includes(CODEX_BODY_MARKER)) {
  console.error(`build_html: template is missing the ${CODEX_BODY_MARKER} marker — ${TEMPLATE}`);
  process.exit(5);
}

// Read each source file. Each gets wrapped in its own <script> tag so the
// browser parses, evaluates, and frees the AST per file — instead of holding
// the entire 5+ MB AST in memory for one monolithic parse. This is what
// unblocks the Claude app's renderer (which was getting OOM-killed during
// the single giant parse). Variables declared with `const` at the top level
// of one classic <script> tag are reachable from later <script> tags in the
// same page since they all share the document's global script scope.
//
// Files that exceed MAX_SCRIPT_BYTES are split further at element boundaries
// via _split_data.js: array declarations split into `const X = []; X.push(...)`
// segments; object declarations split into `const X = {}; Object.assign(X, ...)`.
const { splitFileIntoChunks } = require('./_split_data.js');
const MAX_SCRIPT_CHARS = 600 * 1024; // per-<script> chunk budget (UTF-16 chars; a fast proxy)
const MAX_SCRIPT_BYTES = 1024 * 1024; // hard ceiling on actual emitted UTF-8 bytes, enforced by --check

// Every piece of JavaScript this build emits goes through here. Options and the
// measurements behind them live in _minify.js; this file only decides WHAT is
// squeezed, never HOW.
//
// It is applied to the SOURCES, before they are wrapped in <script> tags, rather
// than to the finished HTML: a regex over the assembled page would have to trust
// that no string literal in a megabyte of catalog data contains `</script>`, and
// a parse failure there could only report an offset into the whole document
// instead of naming the file that broke.
//
// NOTE ON CHUNK SIZES. MAX_SCRIPT_CHARS budgets the split on the source, so
// after minification each emitted block lands ~14% under its budget rather than
// on it. That is left alone on purpose: the budget exists to stay below a
// renderer's parse-memory limit, and this only adds headroom. Retuning it would
// move every chunk boundary, which is a separate change with its own risk.
const { minifyJs, minifyCss, topLevelStatements } = require('./_minify.js');
const { readImageManifest, compactInstrumentImages } = require('./_image_tables.js');
// Escape hatch for reading the shipped artifact by hand. NOT used by CI and not
// used by sync-pages.yml, and it cannot leak into the committed page: that file
// is byte-compared against a default build by check_artifact_fresh.js, so an
// unminified codex.html fails the freshness gate on the next run.
const MINIFY = !flags['no-minify'];
const squeeze = (code, label) => (MINIFY ? minifyJs(code, label) : code);
// The stylesheets get the same treatment: a token-level squeeze that drops
// comments and insignificant whitespace (scripts/_minify.js minifyCss).
const squeezeCss = (code, label) => (MINIFY ? minifyCss(code, label) : code);

// ──────────────────────────── page-only data strip ────────────────────────────
// The tables and fields the page never reads, and the strip itself, live in
// scripts/_page_tables.js (with why each is dropped), shared with the builder of
// api/engine.json and check_api.js.
const { PAGE_DROP_TABLES, PAGE_DROP_FIELDS } = P;
// The page's copy of one references file: evaluated, stripped, re-emitted as one
// `const NAME = <json>;` per declaration in the file's own order. A file with
// nothing to strip is returned byte-for-byte.
function stripForPage(file, source) {
  const names = [...source.matchAll(/^(?:const|let|var)\s+([A-Z_][A-Z0-9_]*)\s*=/gm)].map(
    (m) => m[1]
  );
  if (!names.some((n) => PAGE_DROP_TABLES.has(n) || LAZY_DROP_TABLES.has(n) || PAGE_DROP_FIELDS[n]))
    return source;
  // Only those declarations survive the re-emit, so a file that is rewritten
  // may hold nothing else at top level. A function, an `if`, a statement that
  // patches a table after its declaration, a lower-case or destructured name,
  // a second declarator on one line: each would vanish from the page without a
  // word. Parsed, not pattern-matched, by the parser the minifier uses.
  const parsed = [];
  const other = [];
  for (const node of topLevelStatements(source, file)) {
    const line = node.start ? node.start.line : '?';
    if (!['Const', 'Let', 'Var'].includes(node.TYPE)) {
      other.push(`line ${line}: a top-level ${node.TYPE} statement`);
      continue;
    }
    for (const d of node.definitions) {
      const name = d.name && typeof d.name.name === 'string' ? d.name.name : null;
      if (name && /^[A-Z_][A-Z0-9_]*$/.test(name)) parsed.push(name);
      else other.push(`line ${line}: a declaration of ${name || 'a destructuring pattern'}`);
    }
  }
  if (!other.length && parsed.join() !== names.join())
    other.push(`the parser finds ${parsed.join(', ')}; the re-emit would keep ${names.join(', ')}`);
  if (other.length) {
    console.error(`build_html: ${file} holds more than upper-case table declarations,`);
    console.error('  and the page-only strip re-emits nothing else:');
    other.slice(0, 10).forEach((o) => console.error('  ✗ ' + o));
    process.exit(4);
  }
  const ctx = vm.createContext({});
  vm.runInContext(source, ctx, { filename: file });
  const out = [`// ${file}, page copy: see "page-only data strip" in scripts/build_html.js`];
  for (const name of names) {
    if (PAGE_DROP_TABLES.has(name) || LAZY_DROP_TABLES.has(name)) continue;
    const value = P.stripTable(name, vm.runInContext(name, ctx));
    out.push(`const ${name} = ${JSON.stringify(value).replace(/<\//g, '<\\/')};`);
  }
  return out.join('\n') + '\n';
}

// Every emitted block opens its own <script>, closing the one before it. The
// template supplies only the final </script>, right after <!--@CODEX_BODY-->,
// which closes the runtime block.
const dataParts = [];
const openScript = (label) => {
  if (dataParts.length) dataParts.push(`</script>`);
  dataParts.push(`<script>// ─── ${label} ───`);
};
const sourceSizes = [];
for (const f of SOURCE_FILES) {
  if (LAZY && LAZY_OMIT.has(f)) continue;
  const p = path.join(REFS, f);
  const content = stripForPage(f, fs.readFileSync(p, 'utf8'));
  sourceSizes.push({ name: f, bytes: content.length });

  const chunks = splitFileIntoChunks(content, MAX_SCRIPT_CHARS);
  for (let i = 0; i < chunks.length; i++) {
    if (!chunks[i].trim()) continue; // skip empty splits
    const label = chunks.length === 1 ? f : `${f} [${i + 1}/${chunks.length}]`;
    // The label comment is emitted OUTSIDE the minified body, so it survives:
    // the shipped page still says which source each block came from.
    openScript(label);
    dataParts.push(squeeze(chunks[i].trimEnd(), label));
  }
}
// The lazy shell's instrument engine block: an empty `let` slot per engine
// table, the function that fills them all at once when api/engine.json has
// loaded, the digest that file must carry, the digest of the merge code this
// page inlines (the file's merge plan is used only by that code), and the
// first view's instrument index ([id, name, family, short], which the file
// leaves out of each instrument and the page fills back from here). INSTRUMENT_INDEX is read from
// 02_instruments.js here, not from ENGINE_TABLES, so an edit to that list
// cannot also drop the index.
let ENGINE_SHA = null;
let INSTRUMENT_INDEX_JSON = null;
// What Engine (src/app.js) fetches: CODEX_LAZY_API + 'engine.json?v=' + the
// first 12 of CODEX_ENGINE_SHA. The saved session's preload asks for exactly it.
let ENGINE_URL = null;
if (LAZY) {
  ENGINE_SHA = P.engineSha(P.engineTables(REFS));
  ENGINE_URL = `${LAZY_API}engine.json?v=${ENGINE_SHA.slice(0, 12)}`;
  const ctx = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(REFS, '02_instruments.js'), 'utf8'), ctx, {
    filename: '02_instruments.js',
  });
  INSTRUMENT_INDEX_JSON = JSON.stringify(P.instrumentIndex(vm.runInContext('INSTRUMENTS', ctx)));
  const label =
    'instrument engine: slots + first-view instrument index (tables via api/engine.json)';
  openScript(label);
  dataParts.push(
    squeeze(
      [
        `let ${P.ENGINE_TABLES.join(', ')};`,
        `function CODEX_ENGINE_COMMIT(t) { ${P.ENGINE_TABLES.map((n) => `${n} = t.${n};`).join(' ')} }`,
        `const CODEX_ENGINE_SHA = '${ENGINE_SHA}';`,
        `const CODEX_MERGE_SHA = '${P.mergeSha()}';`,
        `const INSTRUMENT_INDEX = ${INSTRUMENT_INDEX_JSON.replace(/<\//g, '<\\/')};`,
      ].join('\n'),
      label
    )
  );
}
// Instrument photographs: references/_image_manifest.json reduced to what the
// Instrument page shows (scripts/_image_tables.js, compactInstrumentImages).
// Inlined only in the EMBEDDED build, which has no api/ to fetch from (it runs
// on file:// and in the jsdom harnesses). The lazy shell leaves it out of the
// page, 579 KB raw that the default Genre view never reads, and the Instrument
// page fetches api/instrument_images.json the first time it draws, as
// NAV_GLYPH_SVGS is fetched from api/nav_glyphs.json. No manifest yet: the
// constant is null and the page shows glyphs.
if (!LAZY) {
  const imageManifest = compactInstrumentImages(
    readImageManifest(path.join(REFS, '_image_manifest.json'))
  );
  openScript('instrument images (references/_image_manifest.json)');
  dataParts.push(
    `const CODEX_IMAGE_MANIFEST = ${JSON.stringify(imageManifest).replace(/</g, '\\u003c')};`
  );
}
// Retired tradition ids (references/_tradition_aliases.json). The embedded page
// carries the tradition tables, so it carries their aliases beside them; the lazy
// shell reads the same map from api/browse.json (Catalog.bootFromIndex).
if (!LAZY) {
  const reg = JSON.parse(
    fs.readFileSync(path.join(REFS, '_tradition_aliases.json'), 'utf8')
  ).aliases;
  const compact = Object.fromEntries(
    Object.keys(reg)
      .sort()
      .map((id) => [id, { of: reg[id].of, name: reg[id].name }])
  );
  openScript('tradition aliases (references/_tradition_aliases.json)');
  dataParts.push(`const TRADITION_ALIASES = ${JSON.stringify(compact).replace(/</g, '\\u003c')};`);
}

const dataBlock = dataParts.join('\n');

// In-page family-parts merge — inlined from the single source scripts/_merge.js
// so the browser app computes exactly the same inst.parts as the loader. The
// region between the @inline markers in _merge.js is the only copy of this
// algorithm; this build extracts and inlines it verbatim.
const mergeSource = fs.readFileSync(path.join(__dirname, '_merge.js'), 'utf8');
const mergeMatch = mergeSource.match(
  /\/\* @inline-start[^\n]*\*\/\n([\s\S]*?)\n\/\* @inline-end \*\//
);
if (!mergeMatch) {
  console.error(
    'build_html: could not find @inline-start/@inline-end markers in scripts/_merge.js'
  );
  process.exit(5);
}
const FAMILY_PARTS_MERGE_SNIPPET = `
// ─────────── In-page family-parts merge — single source: scripts/_merge.js ───────────
${mergeMatch[1]}
if (typeof INSTRUMENT_FAMILY_PARTS !== 'undefined') mergeFamilyParts(INSTRUMENTS, INSTRUMENT_FAMILY_PARTS);
`;

// In-page card-descriptor harvester — inlined from the single source
// scripts/_card_descriptors.js so the browser's _cardDescriptorSet computes
// exactly the same descriptor set the Node preface pipeline does. The region
// between the @inline markers is the only copy of this algorithm.
const cdSource = fs.readFileSync(path.join(__dirname, '_card_descriptors.js'), 'utf8');
const cdMatch = cdSource.match(/\/\* @inline-start[^\n]*\*\/\n([\s\S]*?)\n\/\* @inline-end \*\//);
if (!cdMatch) {
  console.error(
    'build_html: could not find @inline-start/@inline-end markers in scripts/_card_descriptors.js'
  );
  process.exit(5);
}
const CARD_DESCRIPTORS_SNIPPET = `
// ─────────── In-page card-descriptor harvester — single source: scripts/_card_descriptors.js ───────────
${cdMatch[1]}
// Browser adapter: feed harvestDescriptors the app's index-map lookups so the
// inlined core needs no knowledge of how the app stores the catalog.
function _cardDescriptorSet(card) {
  return harvestDescriptors(card, {
    inst: (id) => Inst(id),
    tuning: (id) => Tuning(id),
    room: (id) => Room(id),
    chainItem: (stageId, id) => ChainItem(stageId, id),
    signature: (tradId) => _traditionSignatureFor(tradId),
  });
}
`;

// ──────────────────────────── runtime blocks ────────────────────────────
// The application, one <script> per source module, in the order they were
// once concatenated into a single `runtime` block. That block reached 988 KiB
// against the 1024 KiB MAX_SCRIPT_BYTES ceiling, and the data chunker cannot
// split it, so the split is by FILE: a module boundary is the only place this
// code can be cut without reading it. Growth now lands on the module that grew;
// a module that nears the ceiling on its own has to be split in src/, not here.
//
// WHAT A FILE BOUNDARY CHANGES, and why this order is safe. The blocks share the
// page's one global scope, as the data blocks always have: a later block reads
// an earlier block's `const`, `let`, `class`, `function` and `var` bindings, and
// a function in an earlier block can call a later block's functions once it has
// loaded. What a single block gave and separate blocks do not is hoisting ACROSS
// files — each block is compiled and run before the next is even parsed. So no
// code that runs while a block loads (its top-level statements, anything they
// call, the promise callbacks they schedule) may reach something a later block
// declares; `typeof laterName` there would now read 'undefined' where it used to
// find the hoisted function. That held for every module at the time of the
// split: the one such path, app.js's global error listener reaching UI_ICONS
// through icon(), is guarded by `typeof UI_ICONS`. Every call into a LATER module
// is made from DOMContentLoaded onward (`_initApp` → `uiStart`) or from page
// hooks, which `uiRegisterPage` only stores. Keep it that way: a new load-time call
// into a later module throws a ReferenceError that the browser gates report as
// a page error.
const RUNTIME_MODULES = [
  {
    label: 'runtime: scripts/_merge.js + scripts/_card_descriptors.js',
    code: FAMILY_PARTS_MERGE_SNIPPET + CARD_DESCRIPTORS_SNIPPET,
  },
  { label: 'runtime: src/layout.js', code: layoutJs },
  {
    label: 'runtime: src/library-import.js',
    code: fs.readFileSync(path.join(SRC, 'library-import.js'), 'utf8'),
  },
  { label: 'runtime: src/app.js', code: appJs },
  { label: 'runtime: src/workbench.js', code: workbenchJs },
  ...PAGES.map((p) => ({ label: `runtime: src/pages/${p}.js`, code: pageFile(p, '.js') })),
];

// EVERY RUNTIME BLOCK RUNS AS SLOPPY-MODE CODE, exactly as the single block did.
// layout.js, workbench.js and every page open with 'use strict', but in the
// concatenation that string came after the merge snippet, so it was never a
// directive prologue — only an inert expression — and the app has always run
// non-strict. As the first statement of a block of its own it WOULD become one,
// silently switching those six files to strict semantics (functions in blocks
// become block-scoped, writes to read-only properties throw, `this` in a plain
// call is undefined) as a side effect of moving a tag. So each block opens with
// an empty statement, which ends the prologue before any string can join it.
// Turning strict mode on is a behaviour change to make on purpose, in src/, with
// its own testing; --check asserts that no runtime block has drifted into it.
const RUNTIME_SLOPPY_GUARD = ';';
const runtimeParts = [];
RUNTIME_MODULES.forEach(({ label, code }, i) => {
  // Closes the block before it (for the first module, the last data block: the
  // instrument image table in an embedded build, the nav-glyph lookups in a
  // lazy one). The last runtime block is closed by the template tail after the
  // marker.
  runtimeParts.push(`</script>`);
  // Each line below is its own line after the join. THE NEWLINE AFTER THE LABEL
  // IS LOAD-BEARING, and it cost an afternoon to learn why: minifying strips
  // leading whitespace, so code that followed a `// ─── label ───` comment with
  // no line break in between was commented out whole — on 2026-09-14 that took
  // the ENTIRE application with it while every <script> tag stayed well-formed.
  // The join supplies the separator; nothing depends on what a module starts with.
  runtimeParts.push(`<script>// ─── ${label} ───`);
  runtimeParts.push(RUNTIME_SLOPPY_GUARD);
  if (i === 0 && LAZY) {
    // The lazy-shell switch. src/app.js sees this const, skips the (absent)
    // embedded tables, and resolves its CATALOG_READY boot promise by fetching
    // `${CODEX_LAZY_API}browse_boot.json` before any UI init runs. It sits in the
    // first runtime block so it is declared before app.js loads.
    // Emitted verbatim, NOT through squeeze(). It is already one short line, so
    // there is nothing to save, and ui_reachability_check.js tells the lazy shell
    // from the embedded build by looking for this exact substring — keeping the
    // builder the only thing that spells it means no minifier setting can rewrite
    // the detector out from under that gate.
    runtimeParts.push(`const CODEX_LAZY_API = '${LAZY_API}';`);
  }
  runtimeParts.push(squeeze(code, label));
});
const runtimeBlock = runtimeParts.join('\n');

// Function replacement: the injected data/app contains `$` sequences
// (template literals, regex) that String.replace would special-case — a
// function replacement returns the string verbatim.
// The template's own <style> is squeezed in place, before anything is
// substituted, so only the template's markup is matched; the other <style>
// holds nothing but the marker the shell and page stylesheets replace.
const WORKBENCH_STYLE_MARKER = '<!--@WORKBENCH_STYLE-->';
const html = template
  .replace(/<style>([\s\S]*?)<\/style>/g, (block, css) =>
    css.includes(WORKBENCH_STYLE_MARKER)
      ? block
      : '<style>' + squeezeCss(css, 'src/index.template.html <style>') + '</style>'
  )
  .replace(BOOT_PRELOAD_MARKER, () =>
    LAZY ? `<link rel="preload" href="${LAZY_API}browse_boot.json" as="fetch" crossorigin>` : ''
  )
  .replace(ENGINE_PRELOAD_MARKER, () =>
    LAZY
      ? '<script>' +
        squeeze(
          enginePreloadJs.replace("'ENGINE_URL'", () => JSON.stringify(ENGINE_URL)),
          'engine preload'
        ) +
        '</script>'
      : ''
  )
  .replace(THEME_BOOT_MARKER, () => '<script>' + squeeze(themeJs, 'theme boot') + '</script>')
  .replace(WORKBENCH_STYLE_MARKER, () =>
    squeezeCss(
      themeCss + '\n' + workbenchCss + '\n' + pagesCss + '\n' + layoutCss,
      'theme.css + workbench.css + pages/*.css + layout.css'
    )
  )
  .replace(CODEX_BODY_MARKER, () => dataBlock + '\n' + runtimeBlock);

// Write
const outDir = path.dirname(outputPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outputPath, html);

console.error(`Built ${outputPath} (${html.length.toLocaleString()} bytes)`);

// The committed artifact lives at the repo root (that's what Pages serves and the
// freshness gate checks). _paths.js defaults the output to a sandbox/temp dir, so a
// bare `build:html` does NOT update ./codex.html. Warn the interactive dev; CI runs
// the bare build only as a syntax/leak check, so stay quiet there.
{
  const repoHtml = path.join(SKILL_ROOT, 'codex.html');
  if (!process.env.CI && path.resolve(outputPath) !== path.resolve(repoHtml)) {
    console.error(
      'note: that is the resolved output dir, not the committed ./codex.html — that file is unchanged.\n' +
        '      to update it: CODEX_OUT_DIR="$(pwd)" node scripts/build_html.js   (or --out=codex.html)'
    );
  }
}

// ──────────────────────────── build summary ────────────────────────────
// Per-source byte counts. Helpful for noticing when a source file shrank or grew
// unexpectedly between builds. Skipped under --quiet.

if (!flags.quiet) {
  const totalData = sourceSizes.reduce((s, x) => s + x.bytes, 0);
  console.error('  data block:');
  for (const s of sourceSizes) {
    const pct = ((s.bytes / totalData) * 100).toFixed(1);
    console.error(
      '    ' +
        s.name.padEnd(28) +
        s.bytes.toLocaleString().padStart(10) +
        '  ' +
        pct.padStart(4) +
        '%'
    );
  }
  console.error('    ' + '(data total)'.padEnd(28) + totalData.toLocaleString().padStart(10));
}

// ──────────────────────────── post-build: --check ────────────────────────────
// Eval the embedded data block in a sandbox to confirm syntactic integrity.
// Catches: missing brackets/braces, malformed object literals, accidental
// duplicate-declaration via `const` collision, unreachable code paths inside
// the data files. Reports concrete catalog sizes (traditions, instruments,
// preface lexicon entries) so the operator can eyeball expected vs actual.

if (flags.check) {
  // The assembled dataBlock interleaves literal </script>/<script> markers (the
  // per-file tag splitting that fixes the renderer OOM). Those are HTML, not JS,
  // so eval-ing dataBlock verbatim always throws "Unexpected token '<'". Strip the
  // marker lines to recover a pure-JS concatenation. What runs below is otherwise
  // the emitted bytes EXACTLY — minified, if this build minified — because the
  // point of this gate is to parse what ships, not a tidier cousin of it.
  const checkJs = dataBlock
    .split('\n')
    .filter((line) => line !== '</script>' && !line.startsWith('<script>'))
    .join('\n');
  const ctx = vm.createContext({});
  try {
    vm.runInContext(checkJs, ctx, { filename: 'data-block.js', timeout: 5000 });
  } catch (e) {
    console.error('check: FAIL — data block did not parse');
    console.error('  ' + e.message);
    process.exit(4);
  }
  // READING THE TABLES BACK. The data files declare with top-level `const`, which
  // in a vm context binds in the global LEXICAL environment and never becomes a
  // property of the sandbox object — so the values have to be fetched by
  // evaluating in the same context. A second script in one context sees the first
  // script's lexical bindings, which is what makes this work.
  //
  // It used to be done by rewriting `^const (\w+) =` to `globalThis.$1 =` before
  // running the block. That was a dependency on how the SOURCE happened to be
  // formatted — it needed every declaration to begin a line AND to put a space
  // before its `=` — and minified output has neither, so on 2026-09-14 the
  // rewrite began matching nothing. The failure was silent in the worst
  // direction: the block still parsed, so this gate still printed PASS, while
  // every count below vanished and the leak guard compared undefined against
  // undefined and waved through whatever it was handed. Evaluating in the context
  // has nothing to match and cannot come loose that way.
  const probe = (expr) => vm.runInContext(expr, ctx, { timeout: 5000 });
  const declared = (name) => probe(`typeof ${name} !== 'undefined'`);
  const countOf = (name) =>
    probe(`typeof ${name} === 'undefined' ? -1 : Array.isArray(${name}) ? ${name}.length : -1`);
  // In a lazy build the tradition tables must NOT be in the page — that
  // absence IS the property the build exists for. Leaking them (e.g. a
  // future edit to LAZY_OMIT) would silently re-ship the 3.7 MB embed.
  if (LAZY && (declared('TRADITIONS') || declared('TRADITION_EXTRAS'))) {
    console.error('check: FAIL — lazy build leaked embedded tradition tables into the page');
    process.exit(4);
  }
  // The preloads: exactly the boot index in a lazy page (twice would download
  // it twice), none in an embedded page, which never fetches it. The genres'
  // prose and api/browse.json are read after the first paint, never preloaded.
  {
    const preloads = [...html.matchAll(/<link rel="preload" href="([^"]*)"[^>]*>/g)].map(
      (m) => m[1]
    );
    const want = LAZY ? [LAZY_API + 'browse_boot.json'] : [];
    if (JSON.stringify(preloads) !== JSON.stringify(want)) {
      console.error(
        `check: FAIL — preloads ${JSON.stringify(preloads)} in a ${LAZY ? 'lazy' : 'embedded'} page; expected ${JSON.stringify(want)} (only the boot index: the genre prose and api/browse.json are read after the first paint)`
      );
      process.exit(4);
    }
  }
  // THE ONE DYNAMIC PRELOAD, a narrow exception to the list above: a lazy
  // page with a saved session asks for the instrument data from <head>
  // (src/engine_preload.js), because the boot cannot draw that session until
  // it is in. Nothing else may preload by script. So: exactly one <script> in
  // a lazy page names "preload" (none in an embedded page), it sits in <head>
  // right after the boot index's link, and, run against stored states, it adds
  // one link — rel=preload, as=fetch, crossorigin=anonymous, href the URL
  // Engine fetches — when the first stored session (storedSessionText's order
  // in src/app.js) has a card, and nothing otherwise, nor when storage throws,
  // and it reads no key storedSessionText does not. check_lazy_app.js holds it
  // to app.js's own decision (ENGINE_AT_BOOT).
  {
    const fail = (msg) => {
      console.error('check: FAIL — ' + msg);
      process.exit(4);
    };
    const all = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
    const naming = all.filter((m) => /(["'`])preload\1/.test(m[1]));
    if (naming.length !== (LAZY ? 1 : 0))
      fail(
        `${naming.length} <script> block(s) in a ${LAZY ? 'lazy' : 'embedded'} page name "preload"; want ${LAZY ? '1 (src/engine_preload.js)' : '0'}`
      );
    if (LAZY) {
      const m = naming[0];
      const bootLink = html.indexOf(`<link rel="preload" href="${LAZY_API}browse_boot.json"`);
      const between = html.slice(bootLink, m.index).replace(/^<link[^>]*>/, '');
      if (bootLink < 0 || m.index > html.indexOf('</head>') || /<(script|link)\b/i.test(between))
        fail("the engine preload is not the <script> right after the boot index's link in <head>");
      // storedSessionText's keys, in its order: the recovery copy in
      // sessionStorage, the rest in localStorage. The script may read no other:
      // a key app.js does not read would preload the engine for a session the
      // page never restores.
      const KEYS = [
        ['sessionStorage', 'codex-workbench-recovery'],
        ['localStorage', 'codex-workbench-v1'],
        ['localStorage', 'musica-workbench-v3'],
        ['localStorage', 'musica-study-v1'],
      ];
      const WS = (cards) => JSON.stringify({ version: 1, name: 'T', cards });
      const CARD = [{ id: 'c1', instrumentId: 'voice', traditionId: 'dub', parts: {} }];
      // [stored, links wanted], by key (each in its own storage, as KEYS).
      const STATES = [
        [{}, 0],
        [{ 'codex-workbench-v1': WS(CARD) }, 1],
        [{ 'codex-workbench-recovery': WS(CARD) }, 1],
        [{ 'musica-workbench-v3': JSON.stringify({ workspace: { cards: CARD } }) }, 1],
        [{ 'musica-study-v1': WS(CARD) }, 1],
        [{ 'codex-workbench-v1': WS([]) }, 0],
        // The order: each key shadows the next, even with no card.
        [{ 'codex-workbench-recovery': WS([]), 'codex-workbench-v1': WS(CARD) }, 0],
        [{ 'codex-workbench-v1': WS([]), 'musica-workbench-v3': WS(CARD) }, 0],
        [{ 'musica-workbench-v3': WS([]), 'musica-study-v1': WS(CARD) }, 0],
        [{ 'codex-workbench-v1': '{not json' }, 0],
        [{ 'codex-workbench-v1': JSON.stringify({ cards: { 0: CARD[0] } }) }, 0],
        ['throw', 0],
      ];
      const want = { rel: 'preload', as: 'fetch', crossorigin: 'anonymous', href: ENGINE_URL };
      const stray = new Set();
      for (const [stored, n] of STATES) {
        const links = [];
        const store = (where) => ({
          getItem(k) {
            if (stored === 'throw') throw new Error('storage refused');
            if (!KEYS.some(([s, key]) => s === where && key === k)) {
              stray.add(`${where}.getItem(${JSON.stringify(k)})`);
              return null;
            }
            return k in stored ? stored[k] : null;
          },
        });
        const doc = {
          head: { appendChild: (el) => links.push(el.attrs) },
          createElement: (tag) => {
            const el = { tag, attrs: {} };
            el.setAttribute = (k, v) => (el.attrs[k] = String(v));
            return el;
          },
        };
        try {
          vm.runInContext(
            m[1],
            vm.createContext({
              document: doc,
              sessionStorage: store('sessionStorage'),
              localStorage: store('localStorage'),
            }),
            { timeout: 1000 }
          );
        } catch (e) {
          fail(`the engine preload threw on stored state ${JSON.stringify(stored)}: ${e.message}`);
        }
        const canon = (a) =>
          JSON.stringify(
            Object.keys(a)
              .sort()
              .map((k) => [k, a[k]])
          );
        const bad = links.filter((a) => canon(a) !== canon(want));
        if (links.length !== n || bad.length)
          fail(
            `the engine preload added ${JSON.stringify(links)} for stored state ${JSON.stringify(stored).slice(0, 120)}; want ${n ? JSON.stringify(want) : 'nothing'}`
          );
      }
      if (stray.size)
        fail(
          `the engine preload reads ${[...stray].join(', ')}, which storedSessionText (src/app.js) does not; it may read only ${KEYS.map(([w, k]) => `${w} ${k}`).join(', ')}`
        );
    }
  }
  // The instrument photo table rides in api/instrument_images.json for the lazy
  // shell; in the page it would be 579 KB the first view never reads.
  if (LAZY && declared('CODEX_IMAGE_MANIFEST')) {
    console.error(
      'check: FAIL — lazy build shipped CODEX_IMAGE_MANIFEST in the page (it loads from api/)'
    );
    process.exit(4);
  }
  // Named here rather than read from LAZY_DROP_TABLES, so an edit to the strip
  // cannot also switch off the check on it: the lazy page ships the nav glyph
  // artwork only through api/nav_glyphs.json.
  if (LAZY && declared('NAV_GLYPH_SVGS')) {
    console.error(
      'check: FAIL — lazy build shipped NAV_GLYPH_SVGS in the page (it loads from api/)'
    );
    process.exit(4);
  }
  // THE INSTRUMENT ENGINE. The eight engine tables are SPELLED OUT here, not
  // read from scripts/_page_tables.js, so an edit to that list cannot also
  // switch off the check on it. A lazy page declares an empty slot for each
  // (the app fills them from api/engine.json) and carries no table; an
  // embedded page carries every table, each with rows, and none of the lazy
  // machinery (the index, the commit, the two digests).
  {
    const ENGINE = [
      'INSTRUMENT_FAMILY_PARTS',
      'INSTRUMENTS',
      'ROOMS',
      'ROOM_CLUSTERS',
      'CHAIN_SECTIONS',
      'TUNINGS',
      'INSTRUMENT_AXIS_DEFINITIONS',
      'PREFACE_LEXICON',
    ];
    const fail = (msg) => {
      console.error('check: FAIL — ' + msg);
      process.exit(4);
    };
    if (LAZY) {
      for (const name of ENGINE) {
        const slot = probe(
          `(() => { try { return ${name} === undefined; } catch { return 'undeclared'; } })()`
        );
        if (slot === 'undeclared') fail(`the lazy page does not declare the engine slot ${name}`);
        if (slot !== true)
          fail(
            `lazy page carries engine table ${name} (${countOf(name)} rows); it loads from api/engine.json`
          );
      }
      if (probe('INSTRUMENT_INDEX.length') !== JSON.parse(INSTRUMENT_INDEX_JSON).length)
        fail('INSTRUMENT_INDEX did not read back whole');
      const want = JSON.stringify(P.instrumentIndex(P.engineTables(REFS).INSTRUMENTS));
      if (probe('JSON.stringify(INSTRUMENT_INDEX)') !== want)
        fail("INSTRUMENT_INDEX differs from the engine's instruments (scripts/_page_tables.js)");
      if (probe('CODEX_ENGINE_SHA') !== P.engineSha(P.engineTables(REFS)))
        fail('CODEX_ENGINE_SHA is not the digest of the engine tables api/engine.json carries');
      if (probe('CODEX_MERGE_SHA') !== P.mergeSha())
        fail(
          'CODEX_MERGE_SHA is not the digest of the merge code this page inlines (scripts/_merge.js)'
        );
      // CODEX_ENGINE_COMMIT fills every slot, each from its own field: run in
      // a second context so the slot checks above saw the page as shipped.
      const ctx2 = vm.createContext({});
      vm.runInContext(checkJs, ctx2, { filename: 'data-block.js', timeout: 5000 });
      vm.runInContext(
        `CODEX_ENGINE_COMMIT(${JSON.stringify(Object.fromEntries(ENGINE.map((n) => [n, 'sentinel:' + n])))})`,
        ctx2,
        { timeout: 5000 }
      );
      for (const name of ENGINE)
        if (vm.runInContext(name, ctx2, { timeout: 5000 }) !== 'sentinel:' + name)
          fail(`CODEX_ENGINE_COMMIT does not fill the engine slot ${name}`);
    } else {
      // Every table, read back with rows: INSTRUMENT_FAMILY_PARTS is the one
      // object (family -> parts), the rest arrays.
      for (const name of ENGINE) {
        const rows = probe(
          `typeof ${name} === 'undefined' || ${name} === null ? -1 : Array.isArray(${name}) ? ${name}.length : typeof ${name} === 'object' ? Object.keys(${name}).length : -1`
        );
        if (rows <= 0)
          fail(
            `the embedded page ${rows < 0 ? 'does not carry' : 'carries an empty'} engine table ${name}`
          );
      }
      for (const name of [
        'INSTRUMENT_INDEX',
        'CODEX_ENGINE_COMMIT',
        'CODEX_ENGINE_SHA',
        'CODEX_MERGE_SHA',
      ])
        if (declared(name)) fail(`the embedded page declares ${name}, a lazy-shell name`);
    }
  }
  // The reverse of the leak guard, and the assertion that would have caught the
  // silent rewrite above: an EMBEDDED build must be able to read its tables back,
  // and every build must be able to read the ones it always carries. A table that
  // reads as absent here is either missing from the page or unreadable by this
  // gate, and both are build failures.
  const REQUIRED = LAZY
    ? ['INSTRUMENT_FAMILIES', 'AXIS_DEFINITIONS', 'TREE_NODES', 'INSTRUMENT_INDEX']
    : ['TRADITIONS', 'INSTRUMENTS', 'ROOMS', 'TUNINGS', 'CHAIN_SECTIONS', 'PREFACE_LEXICON'];
  const unreadable = REQUIRED.filter((name) => countOf(name) <= 0);
  if (unreadable.length) {
    console.error(
      `check: FAIL — ${unreadable.join(', ')} did not read back from the emitted data block`
    );
    process.exit(4);
  }
  // The page-only strip held: no dropped table is declared and no dropped field
  // survives anywhere under its table (searched in the table's own JSON, so a
  // nested copy counts too).
  const leaked = [...PAGE_DROP_TABLES].filter(declared);
  for (const [name, specs] of Object.entries(PAGE_DROP_FIELDS)) {
    if (!declared(name)) continue;
    const json = probe(`JSON.stringify(${name})`);
    for (const [, fields] of specs)
      for (const k of fields) if (json.includes(`"${k}":`)) leaked.push(`${name} .${k}`);
  }
  if (leaked.length) {
    console.error(
      `check: FAIL — the page-only data strip leaked: ${[...new Set(leaked)].join(', ')}`
    );
    process.exit(4);
  }
  const checks = [];
  if (LAZY)
    checks.push(
      `mode:              lazy shell (traditions/extras, the instrument engine and nav glyph art via api/)`
    );
  const report = (label, name) => {
    const n = countOf(name);
    if (n >= 0) checks.push(`${(label + ':').padEnd(18)} ${n}`);
  };
  report('TRADITIONS', 'TRADITIONS');
  report('INSTRUMENTS', 'INSTRUMENTS');
  report('ROOMS', 'ROOMS');
  report('TUNINGS', 'TUNINGS');
  report('CHAIN_SECTIONS', 'CHAIN_SECTIONS');
  report('PREFACE_LEXICON', 'PREFACE_LEXICON');
  report('INSTRUMENT_INDEX', 'INSTRUMENT_INDEX');
  checks.push(
    `page gzip-6:       ${require('zlib').gzipSync(Buffer.from(html, 'utf8'), { level: 6 }).length} B`
  );
  checks.push(
    `page-only strip:   ${PAGE_DROP_TABLES.size} tables, ${Object.keys(PAGE_DROP_FIELDS).length} tables' unread fields`
  );
  if (probe(`typeof TRADITION_EXTRAS === 'object' && TRADITION_EXTRAS !== null`)) {
    checks.push(`TRADITION_EXTRAS:  ${probe('Object.keys(TRADITION_EXTRAS).length')}`);
  }
  console.error('check: PASS — data block parses cleanly');
  for (const c of checks) console.error('    ' + c);

  // Hard byte-ceiling assertion. The chunker budgets in CHARS (a fast proxy);
  // this asserts the real contract on actual UTF-8 bytes, so multibyte-dense
  // data that inflates a chunk past the renderer's safe parse-memory limit
  // fails the build instead of shipping silently.
  const scriptBlocks = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];

  // NO EMITTED BLOCK MAY BE ALL COMMENT. This exists because on 2026-09-14 the
  // whole application shipped commented out: every block is introduced by a
  // `// ─── label ───` line, the minified runtime lost the newline that used to
  // separate it from that label, and `//` ate 766 KB of app in one bite. Nothing
  // upstream noticed — the page was well-formed, all 32 <script> tags parsed, the
  // catalog still loaded, and only the app was missing. Byte ceilings and parse
  // checks are both blind to it: commented-out code is perfectly valid and
  // perfectly sized.
  //
  // Minifying a block that is nothing but comments yields the empty string, so
  // that is the test — asked of the ASSEMBLED page, after every transformation,
  // rather than of any intermediate the builder still holds in a variable.
  //
  // SCOPED TO THE BLOCKS THIS BUILDER LABELS, which is exactly the set at risk:
  // a `// ─── … ───` line is the only comment here that ever sits directly above
  // injected source, so it is the only one that can swallow any.
  const LABEL = /^\s*\/\/ ─── (.*?) ───/;
  const blocks = scriptBlocks.map((block) => {
    const body = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
    const label = body.match(LABEL);
    return {
      body,
      bytes: Buffer.byteLength(block, 'utf8'),
      labeled: !!label,
      name: label ? label[1] : body.trim().split('\n')[0].slice(0, 60),
    };
  });
  const isRuntime = (b) => b.labeled && b.name.startsWith('runtime: ');

  // EVERY BLOCK PARSES ON ITS OWN. The browser compiles each <script> separately,
  // so each is compiled separately here: the template's, the theme boot, every
  // data chunk and every runtime module. The data block is also RUN above; the
  // runtime needs a DOM, so it is compiled, which runs nothing. This comes before
  // the hollow test because that test minifies, and minifying a block that does
  // not parse throws instead of reporting which block it was.
  const unparsed = [];
  for (const b of blocks) {
    try {
      new vm.Script(b.body, { filename: b.name });
    } catch (e) {
      unparsed.push(`${b.name}: ${e.message}`);
    }
  }
  if (unparsed.length) {
    console.error(
      `check: FAIL — ${unparsed.length} <script> block(s) do not parse on their own:\n` +
        unparsed.map((u) => `  ${u}`).join('\n')
    );
    process.exit(4);
  }

  const hollow = [];
  for (const b of blocks) {
    if (!b.labeled) continue;
    if (!minifyJs(b.body, 'emitted <script>').trim()) hollow.push(b.name.slice(0, 60));
  }
  if (hollow.length) {
    console.error(
      `check: FAIL — ${hollow.length} <script> block(s) contain no executable code:\n` +
        hollow.map((h) => `  ${h}`).join('\n') +
        '\n  A label comment with no newline after it swallows the block that follows.'
    );
    process.exit(6);
  }

  // ONE BLOCK PER RUNTIME MODULE, AND EVERY ONE OF THEM SLOPPY. A count short of
  // RUNTIME_MODULES means a boundary was lost somewhere between here and the
  // template. Strictness is asked of V8 rather than read off the text: a `with`
  // statement is a syntax error only in strict-mode code, so a block that still
  // compiles with one appended has no 'use strict' prologue (RUNTIME_SLOPPY_GUARD
  // explains why none may). Compiled, never run.
  const runtimeBlocks = blocks.filter(isRuntime);
  if (runtimeBlocks.length !== RUNTIME_MODULES.length) {
    console.error(
      `check: FAIL — ${runtimeBlocks.length} runtime <script> block(s) in the page, expected ${RUNTIME_MODULES.length} (one per module)`
    );
    process.exit(6);
  }
  const strict = runtimeBlocks.filter((b) => {
    try {
      new vm.Script(b.body + '\nwith ({});', { filename: b.name });
      return false;
    } catch {
      return true;
    }
  });
  if (strict.length) {
    console.error(
      `check: FAIL — ${strict.length} runtime <script> block(s) became strict-mode code:\n` +
        strict.map((b) => `  ${b.name}`).join('\n') +
        '\n  The app has always run sloppy; a leading directive now applies to its whole block.'
    );
    process.exit(6);
  }

  const kib = (bytes) => (bytes / 1024).toFixed(0);
  const largest = blocks.reduce((a, b) => (b.bytes > a.bytes ? b : a));
  const over = blocks.filter((b) => b.bytes > MAX_SCRIPT_BYTES);
  console.error(
    `check: ${over.length === 0 ? 'PASS' : 'FAIL'} — largest <script> ${kib(largest.bytes)} KiB [${largest.name}] ` +
      `of ${blocks.length} blocks (ceiling ${kib(MAX_SCRIPT_BYTES)} KiB)`
  );
  if (over.length > 0) {
    // The remedy depends on which kind of block grew. Data is chunked by this
    // builder; the runtime is cut only where one source file ends.
    for (const b of over) {
      console.error(
        `  ${b.name}: ${kib(b.bytes)} KiB exceeds the byte ceiling — ` +
          (isRuntime(b)
            ? 'split that module into more files under src/ and list them in RUNTIME_MODULES'
            : 'lower MAX_SCRIPT_CHARS in build_html.js')
      );
    }
    process.exit(6);
  }
}
