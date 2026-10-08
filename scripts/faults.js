#!/usr/bin/env node
// faults.js — Goal 2: prove every gate is TWO-SIDED.
//
// @covers: gates-two-sided
//
// A check you've never seen go red is worthless. For each gate-class this plants
// ONE known defect into an ISOLATED temp copy of the source (the real tree is
// never mutated) and asserts the owning gate exits non-zero. 0 escapes required:
// a gate that stays green on a planted defect fails this suite.
//
// Gate-classes (each maps to the gate that owns it):
//   broken ref          -> validate.js
//   >1000-char recipe   -> check_api.js
//   dropped tradition   -> check_api.js
//   app<->node desync   -> equivalence.js
//   stale api/          -> check_artifact_fresh.js   (needs --fresh-api/--fresh-html)
//   stale codex.html    -> check_artifact_fresh.js   (needs --fresh-api/--fresh-html)
//   silent blend-drop   -> recipe.js  (input validation)
//   orphan promise      -> check_promises.js  (documented but unregistered/ungated)
//   lazy != embedded    -> check_lazy_app.js  (shipped shell drifts from embedded build)
//   lazy prose desync   -> check_lazy_app.js  (the prose file drifts from the catalog)
//   first view needs prose -> check_lazy_app.js (the first view waits on what follows it)
//   pending claims absence -> check_lazy_app.js (the window says "none" for "not yet")
//   prose arrival redraws -> check_lazy_app.js  (the descriptions' arrival rebuilds the page)
//   published index drift -> check_api.js       (browse.json drifts, no app reads it now)
//   prose preloaded     -> build_html.js --check (the prose joins the first view's path)
//   engine desync       -> check_lazy_app.js  (api/engine.json's tables drift under an unchanged digest)
//   engine read in first view -> check_lazy_app.js (the first view reads a table the page holds back)
//   restore without engine -> check_lazy_app.js (a saved recipe draws before the instrument data lands)
//   action without engine -> check_lazy_app.js (an Add acts on the empty engine slots)
//   engine before first paint -> check_lazy_app.js (the engine request races the first view)
//   sort before merge   -> check_lazy_app.js  (the lazy merge sorts first; its engine is not the embedded one)
//   similar before engine -> check_lazy_app.js (the similar view computes without the instrument data)
//   engine retry loop   -> check_lazy_app.js  (a failed engine load retries itself on a timer)
//   engine skew accepted -> check_lazy_app.js (a file from another deploy fills the slots)
//   engine in page      -> build_html.js --check (an engine table is back inline in the lazy page)
//   engine file drift   -> check_api.js       (api/engine.json drifts from references/)
//   page over budget    -> check_payload_budget.js (the lazy page regrows past its gzip budget)
//   critical over budget -> check_payload_budget.js (the boot index regrows; the first view waits on it)
//   inline data over budget -> check_payload_budget.js (a data table is back inline in the page)
//   engine over budget  -> check_payload_budget.js (api/engine.json regrows; an early Add waits on it)
//   index drift         -> check_lazy_app.js  (the page's instrument index differs from the engine)
//   prose not sequenced -> check_lazy_app.js  (the prose prefetch shares the link with the engine)
//   prose starved       -> check_lazy_app.js  (a failed engine request holds the prose back for good)
//   engine preload disagrees -> check_lazy_app.js (<head> and app.js read a saved session differently)
//   engine preload unused -> check_lazy_app.js (<head> preloads a URL the app does not fetch)
//   preload by script   -> build_html.js --check (a second script preloads beside the engine's)
//   inspect without engine -> check_lazy_app.js (an Inspect reads the empty engine slots)
//   count while pending -> check_lazy_app.js  (the Instrument page counts "0 instruments" before they land)
//   engine reader moved -> check_lazy_app.js  (a direct engine read moves to a function nobody reviewed)
//   boot error unmarked -> check_lazy_app.js  (a saved session's engine failure loses its marker)
//   merge plan misordered -> check_lazy_app.js (the page lends variants in an order the plan got wrong)
//   lending drops tail  -> check_api.js       (the merge stops lending; configs name variants that are gone)
//   record after wait   -> check_lazy_app.js  (an Add asks for its genre's record only after the engine)
//   optional before engine -> check_lazy_app.js (the genre page's optional files race the engine)
//   engine preload dropped -> build_html.js --check (the page ships without the saved session's preload)
//   boot error hidden   -> check_lazy_app.js  (a failed boot's error is drawn where nothing shows it)
//   boot failure unhandled -> check_lazy_app.js (an early boot failure reaches the unhandled-rejection trap)
//   not the file as stale -> check_lazy_app.js (a sign-in page answered 200 is refused as another deploy's)
//   engine preload stray key -> build_html.js --check (<head> reads a session key app.js does not)
//   embedded engine table missing -> build_html.js --embedded --check (the reference page lacks a table)
//   inlined engine reader -> check_lazy_app.js (an engine read in code inlined from scripts/ goes uncounted)
//   sig unguarded       -> check_lazy_app.js (a tradition's signature reads as none before the instrument data)
//   df unguarded        -> check_lazy_app.js (a descriptor sort caches frequencies before the instrument data)
//   table read in first view -> check_lazy_app.js (the first view reads a render table)
//   sigs left in page   -> build_html.js --check (the signatures' src mirror ships in the lazy page)
//   df left in page     -> build_html.js --check (the frequencies' src mirror ships in the lazy page)
//   codec unfolded      -> check_api.js       (the engine digest no longer names the codec)
//   codec region skew   -> build_html.js --check (the page inlines a codec its digest does not name)
//   engine df drift     -> check_api.js       (api/engine.json's frequencies drift under its header)
//   false pair in engine only -> check_signature_tokens.js (a pair ruled false is back in api/engine.json)
//   mirror skew at build -> build_html.js --check (the cut mirror is not its references JSON)
//   commit skips table  -> build_html.js --check (CODEX_ENGINE_COMMIT leaves a render table's slot empty)
//   decode drops tail   -> check_lazy_app.js  (the page decodes fewer signatures than the file carries)
//   strip too wide      -> check_api.js       (the page copy drops signatures that are not empty)
//   tree prose inline   -> build_html.js --check (the tree's descriptions are back in the lazy page)
//   tree prose missing  -> check_api.js       (the prose file no longer carries the tree's descriptions)
//   tree prose no redraw -> check_lazy_app.js (the picker is not redrawn when the tree's descriptions land)
//   app<->connector     -> check_app_parity.js   (connector render drifts from the app)
//   preface drift       -> regression_prefaces.js (matcher output drifts from fixtures)
//   slot-pick drift     -> check_slot_picks.js    (searched slot drifts from lock-ins)
//   dead audit token    -> audit_dead_tokens.js   (token dead even in the enriched pool)
//   workspace mutation  -> check_workspace_ops.js (an edit op mutates its input ws)
//   stale voice-parts   -> _gen_voice_parts.js --check (Node voice maps drift from src/app.js)
//   drifted frozen DF   -> build_descriptor_df.js --check (app.js DF block != the JSON)
//   stale frozen DF     -> build_descriptor_df.js --check (the freeze fell behind the catalog)
//   stdout lost to exit -> check_cli_output.js      (process.exit drops the unflushed pipe queue)
//   corrupt spend file -> mcp/test.mjs  (a negative usd would hand spent budget back)
//   connector over-cascades -> check_edit_parity.js (guard the app has, the connector lacked)
//   renderer fork drift -> check_edit_differential.js (one engine's copy changes, the other's doesn't)
//   input outside closure -> check_build_closure.js  (CI would skip a rebuild it needed)
//   false cultural claim  -> check_signature_tokens.js (a pair ruled false is back in the table)
//   unruled cultural pair -> check_signature_tokens.js (a cultural token lands with no verdict)
//   restated ceiling    -> check_chat_counter.js    (ask-bar counter names a bound the field no longer enforces)
//   theme after paint   -> check_ui_foundation.js   (the stored theme lands only once the page has painted)
//   map loses recipe    -> check_ui_foundation.js   (the Map view hides Your recipe again)
//   toast action lingers -> check_ui_foundation.js  (a faded toast's Undo still takes a click)
//
// Usage:
//   node scripts/faults.js [--only=ID,…] [--fresh-api=DIR --fresh-html=FILE] [--verbose] [--keep]
// --only runs the classes named and skips the rest: a class answers to its
// number (9x) where it has one, and to its gate-class name, the part of its
// row before ` -> ` (engine-preload-disagrees). A run with --only is partial,
// so it never asserts gate-coverage completeness.
// Exit 0 if every defect was caught, 1 if any gate escaped, 2 if --only names
// a class that does not exist or selects none that can run.
// Each class's temp copy is removed once its verdict is recorded (--keep
// leaves them all in the OS temp dir, codex-fault-*, for inspection).

'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const i = a.indexOf('=');
    if (i > 0) flags[a.slice(2, i)] = a.slice(i + 1);
    else flags[a.slice(2)] = true;
  }
}
const VERBOSE = !!flags.verbose;
const KEEP = !!flags.keep;
const FRESH_API = flags['fresh-api'] ? path.resolve(ROOT, flags['fresh-api']) : null;
const FRESH_HTML = flags['fresh-html'] ? path.resolve(ROOT, flags['fresh-html']) : null;
const ONLY = typeof flags.only === 'string' ? flags.only.split(',').filter(Boolean) : null;
const q = (s) => JSON.stringify(s);

// Isolated temp copy of just the items a gate needs; node_modules is symlinked.
// A copy with api/ and references/ is ~140 MB and a full run makes dozens, so
// each is removed when its class records (dropEnvs): left in place they filled
// the temp disk before the run could finish. Removal never follows a link, so
// the tree a copy links to (node_modules, foundationEnv's api/ and assets/) is
// untouched.
const ENVS = [];
function dropEnvs() {
  if (KEEP) return;
  while (ENVS.length) fs.rmSync(ENVS.pop(), { recursive: true, force: true });
}
process.on('exit', dropEnvs);
function mkenv(items) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-fault-'));
  ENVS.push(d);
  for (const it of items) {
    // mcp/ carries its own dependency tree (the MCP SDK + zod, ~27MB). Copying
    // it per fault class would dominate this script's runtime, so stage the
    // source and symlink the modules — same resolution, none of the bytes.
    if (it === 'mcp') {
      fs.mkdirSync(path.join(d, 'mcp'), { recursive: true });
      for (const f of fs.readdirSync(path.join(ROOT, 'mcp'))) {
        if (f === 'node_modules') continue;
        execSync(`cp -a ${q(path.join(ROOT, 'mcp', f))} ${q(path.join(d, 'mcp', f))}`);
      }
      fs.symlinkSync(path.join(ROOT, 'mcp', 'node_modules'), path.join(d, 'mcp', 'node_modules'));
      continue;
    }
    // An item may be a nested path (api/engine.json): its parent is made first.
    fs.mkdirSync(path.dirname(path.join(d, it)), { recursive: true });
    execSync(`cp -a ${q(path.join(ROOT, it))} ${q(path.join(d, it))}`);
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(d, 'node_modules'));
  return d;
}
// Run a gate; capture combined output + exit code (never throws). 0 = passed
// (BAD here). A non-zero exit is only a real CATCH if its output also names the
// planted defect (see record) — a timeout is surfaced separately so a gate that
// merely hangs can't masquerade as detection.
function gate(dir, args) {
  try {
    const out = execFileSync('node', args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (VERBOSE) process.stderr.write(out);
    return { code: 0, out };
  } catch (e) {
    const out = `${e.stdout || ''}${e.stderr || ''}`;
    if (VERBOSE) process.stderr.write(out);
    const code = e.code === 'ETIMEDOUT' ? 'timeout' : e.status == null ? -1 : e.status;
    return { code, out };
  }
}

// Each class opens with want(): its number, where it has one, then its
// gate-class name. It answers whether --only selects the class, and remembers
// the class so record() can refuse a row under another name.
const CLASS_IDS = new Set();
let CLASS = null;
function want(...ids) {
  for (const id of ids) CLASS_IDS.add(id);
  CLASS = ids;
  return !ONLY || ids.some((id) => ONLY.includes(id));
}

const results = [];
// A defect is "caught" only when the gate exits NON-ZERO *and* its output names
// the planted defect (the `expect` pattern). This rejects two false positives the
// old `code !== 0` test counted as caught: a gate that times out, and a gate that
// fails for an unrelated reason (env crash, missing file in the temp copy).
function record(cls, res, expect) {
  const name = CLASS && CLASS[CLASS.length - 1];
  if (!name || !cls.startsWith(name + ' -> '))
    throw new Error(
      `faults: the row ${JSON.stringify(cls)} is not the class want() opened (${name})`
    );
  const { code, out } = res;
  const nonzero = code !== 0 && code !== 'timeout';
  const matched = !expect || expect.test(out);
  const caught = nonzero && matched;
  let tag;
  if (caught) tag = '✓ caught     ';
  else if (code === 0) tag = '✗ ESCAPED    ';
  else if (code === 'timeout') tag = '✗ TIMEOUT    ';
  else tag = '✗ WRONG-REASON'; // failed, but not on the planted defect
  results.push({ cls, caught, code, reason: tag.trim() });
  const num = CLASS.length > 1 ? `${CLASS[0]}, ` : '';
  process.stderr.write(`  ${tag}  ${cls}  (${num}exit ${code})\n`);
  CLASS = null;
  dropEnvs(); // every class records once, after its last gate run
}
// A class that could not plant its defect for a reason found at run time (not
// a plant site that moved: plantIn stops the run for that). A failure row of
// its own, named by `reason`, and the run goes on to the next class.
function refuse(cls, reason, why) {
  const name = CLASS && CLASS[CLASS.length - 1];
  if (!name || !cls.startsWith(name + ' -> '))
    throw new Error(
      `faults: the row ${JSON.stringify(cls)} is not the class want() opened (${name})`
    );
  results.push({ cls, caught: false, code: reason, reason });
  const num = CLASS.length > 1 ? `${CLASS[0]}, ` : '';
  process.stderr.write(`  ✗ ${reason}  ${cls}  (${num}${why})\n`);
  CLASS = null;
  dropEnvs();
}

process.stderr.write(
  'Injecting one defect per gate-class (isolated temp copies; real tree untouched)…\n'
);

// 1. broken ref -> validate.js
if (want('1', 'broken-ref')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'references/05_traditions.js');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("room: '", "room: 'zzz_fault_"));
  record('broken-ref -> validate.js', gate(d, ['scripts/validate.js']), /zzz_fault|BROKEN_REF/i);
}

// 2. >1000-char recipe -> check_api.js
if (want('2', 'over-ceiling-recipe')) {
  const d = mkenv(['scripts', 'references', 'api']);
  const f = path.join(d, 'api/traditions/bluegrass.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.recipe = 'x'.repeat(1001);
  j.recipe_chars = 1001;
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  record(
    'over-ceiling-recipe -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /1000|ceiling|chars/i
  );
}

// 3. dropped tradition -> check_api.js
if (want('3', 'dropped-tradition')) {
  const d = mkenv(['scripts', 'references', 'api']);
  fs.unlinkSync(path.join(d, 'api/traditions/zydeco.json'));
  record(
    'dropped-tradition -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /zydeco|missing|count/i
  );
}

// 4. unresolvable config id (stale snapshot vs catalog) -> check_api.js
if (want('4', 'unresolvable-id')) {
  const d = mkenv(['scripts', 'references', 'api']);
  const f = path.join(d, 'api/traditions/bluegrass.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.config.room = 'BOGUS_ROOM_FAULT';
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  record(
    'unresolvable-id -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /BOGUS_ROOM_FAULT|resolve|room/i
  );
}

// 5. app<->node desync -> equivalence.js  (mutate the NODE adapter only; the
//    browser inlines the @inline core, so this forces the two sides to disagree)
if (want('5', 'app-node-desync')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'scripts/_card_descriptors.js');
  const s = fs
    .readFileSync(f, 'utf8')
    .replace(
      '  return harvestDescriptors(card, lookups);',
      "  const _s = harvestDescriptors(card, lookups); _s.add('__FAULT__'); return _s;"
    );
  fs.writeFileSync(f, s);
  record(
    'app-node-desync -> equivalence.js',
    gate(d, ['scripts/equivalence.js']),
    /__FAULT__|EQUIVALENCE|differ|mismatch/i
  );
}

// 6. stale api/ (committed != fresh build) -> check_artifact_fresh.js
//
// The temp env has to carry more than scripts/references/api. check_artifact_fresh
// regenerates the discovery files by running build_discovery.js, and that script
// now refuses to emit a sitemap URL with no file behind it — a deliberate guard
// against declaring 404s to a crawler. With only three directories copied,
// index.html / AGENTS.md / SKILL.md / server.json are all absent, the generator
// exits 1, and the gate dies BEFORE it ever compares the planted STALE_DRIFT.
// That reads as WRONG-REASON, which is the harness reporting honestly: the gate
// failed, but not on the defect we planted. The fix belongs here, not in the
// guard — a fault env that cannot run the gate is not evidence about the gate.
// The three discovery outputs come along for the same reason: the gate reads the
// COMMITTED copies from its own root, and "committed copy missing" is likewise
// not the failure this class is meant to prove.
if (want('6', 'stale-api') && FRESH_API && FRESH_HTML) {
  const d = mkenv([
    'scripts',
    'references',
    'api',
    'index.html',
    'AGENTS.md',
    'SKILL.md',
    'server.json',
    'sitemap.xml',
    'llms.txt',
    'robots.txt',
    // mcp/ because server.json is generated, and its version field is read from
    // mcp/package.json — the single source it exists to stop drifting from.
    // Without it build_discovery.js throws ENOENT inside check_artifact_fresh,
    // and the gate then fails for that reason instead of the planted stale
    // recipe: a WRONG-REASON escape, which is exactly what this harness is
    // built to notice. mkenv symlinks the module tree rather than copying it,
    // so staging it costs almost nothing.
    'mcp',
  ]);
  const f = path.join(d, 'api/traditions/bluegrass.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.recipe = j.recipe + ' STALE_DRIFT';
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  const res = gate(d, [
    'scripts/check_artifact_fresh.js',
    `--committed-api=${path.join(d, 'api')}`,
    `--prebuilt-api=${FRESH_API}`,
    `--prebuilt-html=${FRESH_HTML}`,
    `--committed-html=${FRESH_HTML}`,
  ]);
  record('stale-api -> check_artifact_fresh.js', res, /STALE_DRIFT|drift|stale|!=|content/i);
} else if (want('6', 'stale-api')) {
  process.stderr.write(
    '  - skipped stale-api fault (pass --fresh-api=DIR --fresh-html=FILE to enable)\n'
  );
}

// 6b. stale codex.html (committed != fresh build) -> check_artifact_fresh.js
//     Class 6 mutates only api/ and passes the SAME file as committed+prebuilt
//     html, so the codex.html half of the gate was never exercised. This proves
//     it two-sided: the api halves match (fresh==fresh) while the committed html
//     is a mutated copy, so only an unguarded html comparison could stay green.
if (want('6b', 'stale-html') && FRESH_API && FRESH_HTML) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-fault-html-'));
  ENVS.push(tmp); // removed with the class, as mkenv's copies are
  const staleHtml = path.join(tmp, 'stale_codex.html');
  fs.writeFileSync(
    staleHtml,
    fs.readFileSync(FRESH_HTML, 'utf8') + '\n<!-- __STALE_HTML_FAULT__ -->\n'
  );
  const res = gate(ROOT, [
    'scripts/check_artifact_fresh.js',
    `--committed-api=${FRESH_API}`,
    `--prebuilt-api=${FRESH_API}`,
    `--prebuilt-html=${FRESH_HTML}`,
    `--committed-html=${staleHtml}`,
  ]);
  record('stale-html -> check_artifact_fresh.js', res, /codex\.html|stale|!=|drift/i);
}

// 7. silent blend-drop -> recipe.js  (read-only on the real tree)
if (want('7', 'silent-blend-drop'))
  record(
    'silent-blend-drop -> recipe.js',
    gate(ROOT, ['scripts/recipe.js', '--traditions', 'afrobeat,__bogus_fault__']),
    /__bogus_fault__|[Uu]nknown|not found|resolve/
  );

// 8. orphan promise (documented but unregistered/ungated) -> check_promises.js
if (want('8', 'orphan-promise')) {
  const d = mkenv(['scripts', 'AGENTS.md', 'llms.txt', 'README.md', 'SKILL.md']);
  fs.appendFileSync(path.join(d, 'AGENTS.md'), '\n<!-- @promise: __orphan_fault__ -->\n');
  record(
    'orphan-promise -> check_promises.js',
    gate(d, ['scripts/check_promises.js']),
    /__orphan_fault__|orphan|no row/i
  );
}

// 9. lazy shell drifts from embedded build -> check_lazy_app.js
//    The gate boots BOTH builds; the embedded one reads references/ while the
//    lazy one boots from api/browse_boot.json through the fetch shim.
//    Corrupting one tradition's name in the isolated boot index forces the two
//    builds to disagree on the catalog projection, which the parity gate must
//    catch. (The app no longer reads api/browse.json; 9g holds that file.)
if (want('9', 'lazy-shell-desync')) {
  const d = mkenv(['scripts', 'references', 'src', 'api']);
  const f = path.join(d, 'api/browse_boot.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.items[0].name = (j.items[0].name || '') + ' __FAULT__';
  fs.writeFileSync(f, JSON.stringify(j));
  record(
    'lazy-shell-desync -> check_lazy_app.js',
    gate(d, ['scripts/check_lazy_app.js', '--only=parity']),
    /__FAULT__|drift|projection|LAZY-APP: FAIL/i
  );
}

// 9c. the prose the lazy shell merges after its first paint drifts -> check_lazy_app.js
if (want('9c', 'lazy-prose-desync')) {
  const d = mkenv(['scripts', 'references', 'src', 'api']);
  const f = path.join(d, 'api/browse_prose.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.items[0].description = (j.items[0].description || '') + ' __FAULT__';
  fs.writeFileSync(f, JSON.stringify(j));
  record(
    'lazy-prose-desync -> check_lazy_app.js',
    gate(d, ['scripts/check_lazy_app.js', '--only=parity']),
    /__FAULT__|drift|projection|LAZY-APP: FAIL/i
  );
}

// 9d. the first view needs prose the boot index no longer carries -> check_lazy_app.js
//     The featured genre (the page's first starter) loses its prose from the
//     boot index, so the first view would wait on the file that follows it.
if (want('9d', 'first-view-needs-prose')) {
  const d = mkenv(['scripts', 'references', 'src', 'api']);
  const B = require('./_browse_tables.js');
  const featured = B.starterIds(fs.readFileSync(path.join(d, 'src/app.js'), 'utf8'))[0];
  const f = path.join(d, 'api/browse_boot.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const it = j.items.find((x) => x.id === featured);
  if (!it || typeof it.description !== 'string')
    throw new Error(`faults: the boot index carries no prose for ${featured}; class 9d is vacuous`);
  for (const k of B.PROSE_KEYS) delete it[k];
  fs.writeFileSync(f, JSON.stringify(j));
  record(
    'first-view-needs-prose -> check_lazy_app.js',
    gate(d, ['scripts/check_lazy_app.js', '--only=first-view', '--scenarios=default']),
    /first view|LAZY-APP: FAIL/i
  );
}

// 9e. the page claims prose is there before it lands -> check_lazy_app.js
//     proseState answers 'here' for every genre, so the window's readers say
//     "the catalog has no description" where they should say "loading".
if (want('9e', 'pending-claims-absence')) {
  const d = mkenv(['scripts', 'references', 'src', 'api']);
  const f = path.join(d, 'src/app.js');
  const src = fs.readFileSync(f, 'utf8');
  const patched = src.replace(
    'function proseState(id) {',
    "function proseState(id) { return 'here';"
  );
  if (patched === src) throw new Error('faults: could not plant the proseState defect');
  fs.writeFileSync(f, patched);
  record(
    'pending-claims-absence -> check_lazy_app.js',
    gate(d, ['scripts/check_lazy_app.js', '--only=window']),
    /window|has no description|names no exemplar|No genres match|LAZY-APP: FAIL/i
  );
}

// 9f. the prose's arrival redraws the page instead of filling its slots -> check_lazy_app.js
if (want('9f', 'prose-arrival-redraws')) {
  const d = mkenv(['scripts', 'references', 'src', 'api']);
  const f = path.join(d, 'src/pages/genre.js');
  const src = fs.readFileSync(f, 'utf8');
  const patched = src.replace(
    'function gpApplyProse() {',
    'function gpApplyProse() {\n  return gpRenderMain();'
  );
  if (patched === src) throw new Error('faults: could not plant the gpApplyProse defect');
  fs.writeFileSync(f, patched);
  record(
    'prose-arrival-redraws -> check_lazy_app.js',
    gate(d, ['scripts/check_lazy_app.js', '--only=first-view', '--scenarios=default']),
    /in place|rebuilt|LAZY-APP: FAIL/i
  );
}

// 9g. the published browse.json drifts -> check_api.js
//     No behavioural gate reads it now that the app boots from the split files,
//     so check_api's derivation is what holds it.
if (want('9g', 'published-browse-drift')) {
  const d = mkenv(['scripts', 'references', 'api']);
  const f = path.join(d, 'api/browse.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.items[0].name = (j.items[0].name || '') + ' __FAULT__';
  fs.writeFileSync(f, JSON.stringify(j));
  record(
    'published-browse-drift -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /browse\.json|__FAULT__/i
  );
}

// 9h. the genre prose is preloaded with the boot index -> build_html.js --check
if (want('9h', 'prose-preloaded')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'scripts/build_html.js');
  const src = fs.readFileSync(f, 'utf8');
  const lit = '<link rel="preload" href="${LAZY_API}browse_boot.json" as="fetch" crossorigin>';
  const patched = src.replace(
    lit,
    lit + '<link rel="preload" href="${LAZY_API}browse_prose.json" as="fetch" crossorigin>'
  );
  if (patched === src) throw new Error('faults: could not plant the prose preload');
  fs.writeFileSync(f, patched);
  record(
    'prose-preloaded -> build_html.js --check',
    gate(d, ['scripts/build_html.js', '--check', '--quiet', `--out=${path.join(d, 'x.html')}`]),
    /preload/i
  );
}

// 9i–9zi. THE INSTRUMENT ENGINE OUTSIDE THE LAZY PAGE. The lazy codex.html
//     carries an empty slot for each of the ten engine tables, an index of
//     instrument names (INSTRUMENT_INDEX) and the digest of api/engine.json,
//     and fills the slots from that file (at its first paint, or from <head>
//     when a saved session needs it). Each class
//     plants one way that split goes wrong and expects the gate's own sentence
//     for it, not `LAZY-APP: FAIL`: a check_lazy_app section fails on many
//     things, and a bare banner would count a catch made for another reason.
//     Every plant goes through plantIn, which throws when its anchor is gone,
//     so a class whose code moved stops the run instead of recording a pass
//     for a fault that was never planted. A class planted for one check of the
//     engine section runs that check alone (check_lazy_app --checks): the
//     section's other checks, a boot each, would re-prove what other classes
//     prove, and the freshness job pays for every boot.
function plantIn(d, rel, find, replace) {
  const f = path.join(d, rel);
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes(find))
    throw new Error(
      `faults: plant site not found in ${rel}: ${JSON.stringify(find.slice(0, 100))}`
    );
  // A replacer function, so a `$&` or `$1` in `replace` is written as typed.
  const out = src.replace(find, () => replace);
  fs.writeFileSync(f, out);
}
const lazyEnv = () => mkenv(['scripts', 'references', 'src', 'api']);
const lazyGate = (d, ...args) => gate(d, ['scripts/check_lazy_app.js', ...args]);
// 9i and 9s: the first descriptor list of api/engine.json gains a second copy
// of its own first word. The line layout and the header's tables_sha1 are left
// as they were. The page checks that digest, the instrument count and the
// zeroed index fields, never what the tables hold, so it accepts the file. A
// word the file already carries keeps the engine vocabulary the same set, so
// the descriptor frequencies (scripts/_engine_codec.js) still decode; a new
// word would make them fail to, and the page would refuse the file as stale.
function plantEngineFile(d) {
  const f = path.join(d, 'api/engine.json');
  const text = fs.readFileSync(f, 'utf8');
  const m = text.match(/"descriptors":\["((?:[^"\\]|\\.)*)"/);
  if (!m) throw new Error('faults: no descriptor list in api/engine.json');
  fs.writeFileSync(
    f,
    text.replace(m[0], () => `${m[0]},"${m[1]}"`)
  );
}

// 9i. engine-desync: the file's tables drift under an unchanged digest -> check_lazy_app.js
//     The embedded build merges references/; the lazy build merges the file.
//     Parity fingerprints both merged engines, so the drift shows there, the
//     one place a body the page accepted can be compared with its source.
if (want('9i', 'engine-desync')) {
  const d = lazyEnv();
  plantEngineFile(d);
  record(
    'engine-desync -> check_lazy_app.js',
    lazyGate(d, '--only=parity'),
    /engine fingerprint drift/
  );
}

// 9j. engine-read-in-first-view -> check_lazy_app.js
//     A genre's roster names its instruments through InstLite, which reads the
//     page's index. Inst reads the engine, which the first view holds back; put
//     it back in the roster and the read throws EngineNotReadyError and is
//     counted, which is how the gate sees a reader nobody declared.
if (want('9j', 'engine-read-in-first-view')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/pages/genre.js',
    '      const name = InstLite(i)?.name || i;',
    '      const name = Inst(i)?.name || i;'
  );
  record(
    'engine-read-in-first-view -> check_lazy_app.js',
    lazyGate(d, '--only=first-view', '--scenarios=default'),
    /first view "default": \d+ engine read\(s\) before (?:it|the engine) landed/
  );
}

// 9k. restore-without-engine -> check_lazy_app.js
//     A saved recipe draws its cards at boot, and cards need the engine, so the
//     boot asks for it first and holds at its status until it lands, writing
//     nothing. _bootNeedsEngine is that switch: answering false sends the
//     restore into the empty slots.
if (want('9k', 'restore-without-engine')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    'function _bootNeedsEngine() {',
    'function _bootNeedsEngine() { return false;'
  );
  record(
    'restore-without-engine -> check_lazy_app.js',
    lazyGate(d, '--only=first-view', '--scenarios=restored'),
    /first view "restored": (?:while the engine was held the page did not wait at the boot status|a restored session did not ask for the engine before its first view|\d+ engine read\(s\) before it landed)/
  );
}

// 9l. action-without-engine -> check_lazy_app.js  (E3)
//     An Add builds a card, and a card reads the instrument, its parts and the
//     room. addInstrumentFromPicker waits for the engine through engineReady,
//     which says "Preparing the instrument data…"; without the wait, an Add
//     clicked before the engine lands acts on the empty slots.
if (want('9l', 'action-without-engine')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    '  if (!_engineLive && !(await engineReady(opts && opts.retry))) return null;\n',
    ''
  );
  record(
    'action-without-engine -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E3'),
    /engine E3 \(add an instrument on its own\): .*before the instrument data landed — an action must wait for it/
  );
}

// 9m. engine-before-first-paint -> check_lazy_app.js
//     The engine file is larger gzipped than the page itself (653 KB against
//     498 KB). Asked for at boot, it shares the link with the first view and
//     delays it. The plant moves Engine.start() out of uiAfterPaint, so the
//     request goes out at init, before the first view is drawn.
if (want('9m', 'engine-before-first-paint')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    'uiAfterPaint(() => { Engine.start(); Engine.fetched()',
    'Engine.start(); uiAfterPaint(() => { Engine.fetched()'
  );
  record(
    'engine-before-first-paint -> check_lazy_app.js',
    lazyGate(d, '--only=first-view', '--scenarios=default'),
    /first view "default": the engine was requested before the first view was drawn/
  );
}

// 9n. sort-before-merge -> check_lazy_app.js
//     The embedded page merges the family parts into INSTRUMENTS in source
//     order and sorts after, and the lazy boot must do the same. The merge
//     depends on order: the universal-material pass collects each material
//     from the instruments in the order it meets them and lends the copies in
//     that order. Sorted first, the merged engine differs while every
//     instrument is still present.
if (want('9n', 'sort-before-merge')) {
  const d = lazyEnv();
  const merge =
    'yield* mergeFamilyPartsSteps(t.INSTRUMENTS, t.INSTRUMENT_FAMILY_PARTS, { plan: kinds });';
  plantIn(d, 'src/app.js', merge, `_sortInstruments(t.INSTRUMENTS); ${merge}`);
  plantIn(
    d,
    'src/app.js',
    '        _sortInstruments(t.INSTRUMENTS);\n        CODEX_ENGINE_COMMIT(t);',
    '        CODEX_ENGINE_COMMIT(t);'
  );
  record(
    'sort-before-merge -> check_lazy_app.js',
    lazyGate(d, '--only=parity'),
    /engine fingerprint drift[^\n]*differs in:[^\n]*\binstruments\b/
  );
}

// 9o. similar-before-engine -> check_lazy_app.js  (E4)
//     The similar view's "instruments that fit" reads every instrument's axes.
//     Before the engine lands it must draw a loading block and compute nothing;
//     with its guard switched off it draws no block at all.
if (want('9o', 'similar-before-engine')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    '  if (!_engineLive) {\n    _pickerEnginePending = true;',
    '  if (false) {\n    _pickerEnginePending = true;'
  );
  record(
    'similar-before-engine -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E4'),
    /engine E4: the similar view before the instrument data/
  );
}

// 9p. engine-retry-loop -> check_lazy_app.js  (F4a)
//     A failed engine load is retried by an action, Retry or the browser
//     coming back online, never on a timer: with the host down, a timer keeps
//     asking for the file for as long as the page stays open. The plant's
//     timer is 30 s, longer than the whole of F4a, so only running the timers
//     still pending at its end can see it; a short one also shows in the
//     counts F4a takes between its steps.
if (want('9p', 'engine-retry-loop')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    "        state = 'failed';\n        bootP = null;",
    "        state = 'failed';\n        bootP = null;\n        setTimeout(() => load().catch(() => {}), 30000);"
  );
  record(
    'engine-retry-loop -> check_lazy_app.js',
    lazyGate(d, '--only=failure'),
    /engine unreachable \(F4a\): the page's \d+ pending timer\(s\), run as if it had stayed open, made [1-9]\d* request\(s\) for api\/engine\.json/
  );
}

// 9q. engine-skew-accepted -> check_lazy_app.js  (F4c)
//     A page from one deploy can meet api/engine.json from another, from a
//     cache or a half-finished upload. The page refuses a file whose digest is
//     not its own CODEX_ENGINE_SHA; without that compare, another deploy's
//     tables fill the slots whenever its instrument count still matches.
if (want('9q', 'engine-skew-accepted')) {
  const d = lazyEnv();
  plantIn(d, 'src/app.js', 'if (head.tables_sha1 !== CODEX_ENGINE_SHA) throw stale();', '');
  record(
    'engine-skew-accepted -> check_lazy_app.js',
    lazyGate(d, '--only=failure'),
    /\(F4c\): a file whose tables_sha1 is not the page's was accepted/
  );
}

// 9r. engine-in-page -> build_html.js --check
//     The lazy build strips the tables named in ENGINE_TABLES
//     (scripts/_page_tables.js). Drop a name from that list and the table ships
//     inline again: for INSTRUMENTS, about 550 KB more gzipped. --check spells
//     the ten names out itself, so the edit that puts a table back cannot
//     also turn off the check.
if (want('9r', 'engine-in-page')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantIn(
    d,
    'scripts/_page_tables.js',
    "const ENGINE_TABLES = [\n  'INSTRUMENT_FAMILY_PARTS',\n  'INSTRUMENTS',\n",
    "const ENGINE_TABLES = [\n  'INSTRUMENT_FAMILY_PARTS',\n"
  );
  record(
    'engine-in-page -> build_html.js --check',
    gate(d, ['scripts/build_html.js', '--check', '--quiet', `--out=${path.join(d, 'x.html')}`]),
    /lazy page carries engine table INSTRUMENTS/
  );
}

// 9s. engine-file-drift -> check_api.js
//     The plant of 9i, held by the static check instead: the file is internal
//     and nothing but check_api reads it whole. It derives the file from
//     references/ through scripts/_page_tables.js and compares it byte for
//     byte, so the drift fails here without a browser.
if (want('9s', 'engine-file-drift')) {
  const d = mkenv(['scripts', 'references', 'api']);
  plantEngineFile(d);
  record(
    'engine-file-drift -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /engine\.json differs from what scripts\/_page_tables\.js derives/
  );
}

// 9t, 9ta–9tc. THE PAYLOAD BUDGETS -> check_payload_budget.js. No other gate
//     holds the lazy page and its two first downloads to a size, so each of
//     the four budgets gets its own plant, each in a copy of the page and of
//     the two api/ files the budgets read. The plant is incompressible base64,
//     sized from the gate's own baseline line so the budget lands about 32 KiB
//     over its limit whatever its headroom is today (a fixed size would stop
//     reaching the limit once the page shrank, or the engine file did; at step
//     9 the headroom is 76 KB for the page, 45 KB for page + boot index, 37 KB
//     for the inline data and 125 KB for the engine). The bytes come from a
//     hash chain, not a random source, so every run plants the same files. The
//     unplanted copy must pass first, or a class could not tell its plant from
//     a page already over. When it does not, each budget class records a
//     failure of its own (BASELINE-OVER; the gate's table is printed once) and
//     the run goes on: in CI the freshness job's budget step has already
//     failed on that page, and the classes after these still owe a verdict.
function budgetEnv() {
  const d = mkenv(['scripts']);
  const html = path.join(d, 'codex.html');
  const api = path.join(d, 'api');
  fs.copyFileSync(FRESH_HTML || path.join(ROOT, 'codex.html'), html);
  fs.mkdirSync(api);
  for (const f of ['browse_boot.json', 'engine.json'])
    fs.copyFileSync(path.join(FRESH_API || path.join(ROOT, 'api'), f), path.join(api, f));
  const args = ['scripts/check_payload_budget.js', `--html=${html}`, `--api=${api}`];
  const baseline = gate(d, args);
  if (baseline.code !== 0) return { d, over: baseline };
  const num = (s) => Number(s.replace(/,/g, ''));
  // What the budget has left, from its line of the gate's table.
  const left = (id) => {
    const m = baseline.out.match(new RegExp(`^ +${id} +([\\d,]+) +([\\d,]+) `, 'm'));
    if (!m) throw new Error(`faults: check_payload_budget printed no ${id} line`);
    return num(m[2]) - num(m[1]);
  };
  return { d, html, api, args, left };
}
let baselineShown = false;
// One budget class: plant(B) into budgetEnv's copy, then the gate. With the
// unplanted copy already over, the class cannot plant: a failure row.
function budgetClass(cls, plant, expect) {
  const B = budgetEnv();
  if (B.over) {
    if (!baselineShown)
      process.stderr.write(
        `  The unplanted page fails check_payload_budget (exit ${B.over.code}), so no budget class can plant:\n${B.over.out.replace(/^/gm, '    ')}\n`
      );
    baselineShown = true;
    return refuse(cls, 'BASELINE-OVER', `the unplanted page fails the gate, exit ${B.over.code}`);
  }
  plant(B);
  record(cls, gate(B.d, B.args), expect);
}
// Base64 of `n` hash-chained bytes: about `n` bytes once gzipped, at 6 bits a
// character.
function incompressible(tag, n) {
  const chunks = [];
  for (let i = 0; chunks.length * 64 < n; i++)
    chunks.push(crypto.createHash('sha512').update(`faults ${tag} ${i}`).digest());
  return Buffer.concat(chunks).subarray(0, n).toString('base64');
}
const OVER = 32 * 1024;

// 9t. page-over-budget: the lazy page growing back — a table inline again, a
//     runtime module, a comment. The plant is a comment before the last
//     </body>.
if (want('9t', 'page-over-budget'))
  budgetClass(
    'page-over-budget -> check_payload_budget.js',
    (B) => {
      const filler = incompressible('9t', B.left('page') + OVER);
      const html = fs.readFileSync(B.html, 'utf8');
      const at = html.lastIndexOf('</body>');
      if (at < 0)
        throw new Error('faults: no </body> in codex.html to plant the 9t comment before');
      fs.writeFileSync(
        B.html,
        `${html.slice(0, at)}<!-- __BUDGET_FAULT__ ${filler} -->\n${html.slice(at)}`
      );
    },
    /✗ page: [\d,]+ B gzip, over its [\d,]+ B/
  );

// 9ta. critical-over-budget: the first view's other download regrows — prose
//     or exemplars back in the boot index. The plant is one more field in
//     api/browse_boot.json; the page itself is untouched, so only the page +
//     boot index budget can see it.
if (want('9ta', 'critical-over-budget'))
  budgetClass(
    'critical-over-budget -> check_payload_budget.js',
    (B) => {
      const filler = incompressible('9ta', B.left('critical') + OVER);
      plantIn(B.d, 'api/browse_boot.json', '{', `{"__BUDGET_FAULT__":"${filler}",`);
    },
    /✗ critical: [\d,]+ B gzip, over its [\d,]+ B/
  );

// 9tb. inline-data-over-budget: a references table inline again, beside the
//     engine block. The plant is one more labelled data <script> block,
//     which the inline-data budget reads (it may also take the page + boot
//     index budget over; the row expects the inline-data line).
if (want('9tb', 'inline-data-over-budget'))
  budgetClass(
    'inline-data-over-budget -> check_payload_budget.js',
    (B) => {
      const filler = incompressible('9tb', B.left('inline-data') + OVER);
      const html = fs.readFileSync(B.html, 'utf8');
      const at = html.lastIndexOf('</body>');
      if (at < 0) throw new Error('faults: no </body> in codex.html to plant the 9tb block before');
      fs.writeFileSync(
        B.html,
        `${html.slice(0, at)}<script>\n// ─── __BUDGET_FAULT__ ───\nconst __BUDGET_FAULT__ = "${filler}";\n</script>\n${html.slice(at)}`
      );
    },
    /✗ inline-data: [\d,]+ B gzip, over its [\d,]+ B/
  );

// 9tc. engine-over-budget: api/engine.json regrows — a dropped field kept, a
//     table added — which a restored session's first draw and every early Add
//     wait for. The plant is one more element line before the closing ].
if (want('9tc', 'engine-over-budget'))
  budgetClass(
    'engine-over-budget -> check_payload_budget.js',
    (B) => {
      const filler = incompressible('9tc', B.left('engine') + OVER);
      plantIn(B.d, 'api/engine.json', '\n]\n', `,\n["__BUDGET_FAULT__","${filler}"]\n]\n`);
    },
    /✗ engine: [\d,]+ B gzip, over its [\d,]+ B/
  );

// 9u. index-drift -> check_lazy_app.js  (E1)
//     The first view names instruments from INSTRUMENT_INDEX, which the build
//     derives from the same tables as the engine; once the engine lands Inst
//     answers instead. A trailing space in every indexed name is invisible on
//     screen, and the build's --check derives its expectation through the same
//     function, so only comparing InstLite with the embedded Inst catches it.
if (want('9u', 'index-drift')) {
  const d = lazyEnv();
  plantIn(
    d,
    'scripts/_page_tables.js',
    'instruments.map((i) => [i.id, i.name, i.family,',
    "instruments.map((i) => [i.id, i.name + ' ', i.family,"
  );
  record(
    'index-drift -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E1'),
    /engine E1: InstLite differs from the embedded Inst/
  );
}

// 9v. prose-not-sequenced -> check_lazy_app.js
//     The background prose prefetch waits for the engine's bytes: requested
//     together at paint, the two share a slow link and the engine, which
//     every Add waits for, lands about 4 s later (measured, slow 4G). The
//     plant asks for the prose at paint, beside the engine.
if (want('9v', 'prose-not-sequenced')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    'uiAfterPaint(() => { Engine.start(); Engine.fetched().then(() => Catalog.loadProse().catch(() => {})); });',
    'uiAfterPaint(() => { Engine.start(); Catalog.loadProse().catch(() => {}); });'
  );
  record(
    'prose-not-sequenced -> check_lazy_app.js',
    lazyGate(d, '--only=first-view', '--scenarios=default'),
    /first view "default": the genre prose was requested while the instrument data was held/
  );
}

// 9w. prose-starved -> check_lazy_app.js  (F4a)
//     The other side of 9v: the prefetch follows Engine.fetched(), so a failed
//     engine request must still count as delivered. Without the bytesDone()
//     that opens the load's catch, an unreachable engine also holds back the
//     genre descriptions, which never needed it.
if (want('9w', 'prose-starved')) {
  const d = lazyEnv();
  plantIn(d, 'src/app.js', '      .catch((e) => {\n        bytesDone();', '      .catch((e) => {');
  record(
    'prose-starved -> check_lazy_app.js',
    lazyGate(d, '--only=failure'),
    /the genre prose did not load within 10 s/
  );
}

// 9x. engine-preload-disagrees -> check_lazy_app.js
//     A saved session's page asks for the engine from <head>
//     (src/engine_preload.js), by the test app.js applies at boot:
//     _bootNeedsEngine over storedSessionText's keys. Read differently, a
//     session that needs the engine starts it late, or a page that never uses
//     it downloads it during its first view. build_html.js --check runs the
//     <head> script over a fixed table of keys, so a key dropped there fails
//     the build; the plant is on the side only check_lazy_app reads, a key
//     app.js starts to read and <head> does not.
if (want('9x', 'engine-preload-disagrees')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    "localStorage.getItem('musica-study-v1') || null;\n}",
    "localStorage.getItem('musica-study-v1') || localStorage.getItem('codex-workbench-v2') || null;\n}"
  );
  record(
    'engine-preload-disagrees -> check_lazy_app.js',
    lazyGate(d, '--only=first-view', '--scenarios=default'),
    /engine preload \(codex-workbench-v2 alone\): <head> preloaded \[\], but app\.js asked for the engine at boot/
  );
}

// 9y. engine-preload-unused -> check_lazy_app.js
//     The preload is only worth its bytes if the app's fetch() takes it over,
//     and that needs the same URL. The plant shortens the build's ?v= key by
//     one character: build_html.js --check compares the script with the URL
//     the build computes, so only the app's own request can tell.
if (want('9y', 'engine-preload-unused')) {
  const d = lazyEnv();
  plantIn(
    d,
    'scripts/build_html.js',
    'engine.json?v=${ENGINE_SHA.slice(0, 12)}',
    'engine.json?v=${ENGINE_SHA.slice(0, 11)}'
  );
  record(
    'engine-preload-unused -> check_lazy_app.js',
    lazyGate(d, '--only=first-view', '--scenarios=restored'),
    /first view "restored": want one engine preload in <head> \(as=fetch, crossorigin=anonymous\) for the one URL the app asked for/
  );
}

// 9z. preload-by-script -> build_html.js --check
//     The page's one dynamic preload is the engine's, for a saved session.
//     Any other script that preloads joins the first view's download unseen
//     by the static list, so a second script naming "preload" is refused.
if (want('9z', 'preload-by-script')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantIn(
    d,
    'src/app.js',
    'function storedSessionText() {',
    "function storedSessionText() { if (!storedSessionText.done) { storedSessionText.done = 1; const l = document.createElement('link'); l.rel = 'preload'; l.as = 'fetch'; l.href = CODEX_LAZY_API + 'browse_prose.json'; document.head.appendChild(l); }"
  );
  record(
    'preload-by-script -> build_html.js --check',
    gate(d, ['scripts/build_html.js', '--check', '--quiet', `--out=${path.join(d, 'x.html')}`]),
    /2 <script> block\(s\) in a lazy page name "preload"/
  );
}

// 9za. inspect-without-engine -> check_lazy_app.js  (E2)
//     Inspecting an instrument reads it, its parts and their variants. Before
//     the engine lands uiInspectInstrument opens the Instrument page and waits;
//     without that guard, the genre roster's Inspect reads the empty slots,
//     which the E2 sweep counts as an engine read.
if (want('9za', 'inspect-without-engine')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/pages/instrument.js',
    'function uiInspectInstrument(id, { fromTrail = false, similar = false } = {}) {\n  if (!_engineLive) {',
    'function uiInspectInstrument(id, { fromTrail = false, similar = false } = {}) {\n  if (false) {'
  );
  record(
    'inspect-without-engine -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E2'),
    /engine E2: on a genre's detail \[data-ui="instrument-inspect"\]: \d+ engine read\(s\)/
  );
}

// 9zb. count-while-pending -> check_lazy_app.js  (E5)
//     The Instrument page's count is INSTRUMENTS.length, and before the
//     engine lands that is a claim about an empty slot. The pending list
//     shows no count; the plant shows "0 instruments" there.
if (want('9zb', 'count-while-pending')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/pages/instrument.js',
    "  $ui('ip-total').textContent = '';\n",
    "  $ui('ip-total').textContent = uiCount(0, 'instrument');\n"
  );
  record(
    'count-while-pending -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E5'),
    /engine E5: a search while the instrument data loads reads .*\(count "0 instruments"\); want the loading state and no count/
  );
}

// 9zc. engine-reader-moved -> check_lazy_app.js  (E6)
//     Every direct read of an engine table is listed in ENGINE_READERS, per
//     file, table and enclosing function, so a new reader is reviewed for when
//     it runs. The plant moves one: a top-level read of INSTRUMENTS is added
//     and findInstrumentsForTradition stops reading it. The table's count is
//     unchanged, which a census per table would pass.
if (want('9zc', 'engine-reader-moved')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    "if (typeof INSTRUMENTS !== 'undefined') _sortInstruments(INSTRUMENTS);\n",
    "if (typeof INSTRUMENTS !== 'undefined') _sortInstruments(INSTRUMENTS);\nconst __FAULT__ = !!INSTRUMENTS;\n"
  );
  plantIn(
    d,
    'src/app.js',
    '  return INSTRUMENTS\n    .filter(i => !existing.has(i.id) && i.axes)',
    '  return [..._INST_BY_ID.values()]\n    .filter(i => !existing.has(i.id) && i.axes)'
  );
  record(
    'engine-reader-moved -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E6'),
    /engine E6: the direct reads of the engine tables changed: src\/app\.js INSTRUMENTS in \(top level\): 3 → 4; src\/app\.js INSTRUMENTS in findInstrumentsForTradition: 1 → 0/
  );
}

// 9zd. boot-error-unmarked -> check_lazy_app.js  (F4b)
//     A saved session the boot cannot draw for want of the engine says so in
//     a #boot-error marked data-engine-pending="failed", the mark every engine
//     failure state carries. The plant draws the error without it.
if (want('9zd', 'boot-error-unmarked')) {
  const d = lazyEnv();
  plantIn(d, 'src/app.js', `(engine ? ' data-engine-pending="failed"' : '')`, "''");
  record(
    'boot-error-unmarked -> check_lazy_app.js',
    lazyGate(d, '--only=failure'),
    /engine unreachable with a saved session \(F4b\): #boot-error \(data-engine-pending=null/
  );
}

// 9ze. merge-plan-misordered -> check_lazy_app.js
//     api/engine.json's MERGE_PLAN tells the page which variants each
//     universal material lends, in the order the merge would collect them,
//     and the page trusts a plan whose positions resolve. The plant swaps two
//     variants the plan takes from one part, under the file's own digests:
//     every position still resolves, so the page lends them in the wrong order,
//     and only the merged engine, fingerprinted against the embedded build's,
//     shows it: its variants, numbered by first sight, are met in another
//     order (check_api fails the file too, byte for byte, as in 9s).
if (want('9ze', 'merge-plan-misordered')) {
  const d = lazyEnv();
  const f = path.join(d, 'api/engine.json');
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const at = lines.findIndex((l) => l.startsWith('["MERGE_PLAN",'));
  if (at < 0) throw new Error('faults: api/engine.json has no MERGE_PLAN line for class 9ze');
  const el = JSON.parse(lines[at]);
  const u = el[1].kinds.string.u;
  // Triples of (instrument delta, part, variant): the first two in one part.
  let n = 3;
  while (n < u.length && !(u[n] === 0 && u[n + 1] === u[n - 2])) n += 3;
  if (n >= u.length)
    throw new Error('faults: the string plan takes no two variants from one part (class 9ze)');
  [u[n - 1], u[n + 2]] = [u[n + 2], u[n - 1]];
  lines[at] = JSON.stringify(el);
  fs.writeFileSync(f, lines.join('\n'));
  record(
    'merge-plan-misordered -> check_lazy_app.js',
    lazyGate(d, '--only=parity'),
    /engine fingerprint drift[^\n]*differs in:[^\n]*\bvariants\b/
  );
}

// 9zf. lending-drops-tail -> check_api.js
//     The universal-material merge lends each target part the union's
//     variants it does not hold, cut as slices of the union between the ones
//     it does. Drop the last slice and 871 parts lose 235,236 lent variants;
//     the merge's own proof (planned against unplanned) cannot see it, since
//     both run the same code, and nor can the app/Node equivalence. The
//     catalog's own records can: every tradition's config names its variants,
//     and a lent one that is gone no longer resolves.
if (want('9zf', 'lending-drops-tail')) {
  const d = mkenv(['scripts', 'references', 'api']);
  plantIn(
    d,
    'scripts/_merge.js',
    '        if (from < lent.length) slices.push(lent.slice(from));\n',
    ''
  );
  record(
    'lending-drops-tail -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /✗ traditions\/[\w-]+\.json — [\w-]+\.[\w-]+: variant not in catalog: /
  );
}

// 9zg. record-after-wait -> check_lazy_app.js  (E8)
//     An Add asks for its genre's record (api/traditions/<id>.json) beside
//     the engine, so on a slow link the two waits overlap instead of adding
//     up. The plant asks for it after the engine wait, as before step 9's fix.
if (want('9zg', 'record-after-wait')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    '  const full = Catalog.ensureFull(tradId);\n  full.catch(() => {});\n  if (!_engineLive && !(await engineReady(retry))) return [];',
    '  if (!_engineLive && !(await engineReady(retry))) return [];\n  const full = Catalog.ensureFull(tradId);\n  full.catch(() => {});'
  );
  record(
    'record-after-wait -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E8'),
    /engine E8: while the instrument data was held the Add requested api\/traditions\/[\w-]+\.json 0 time\(s\)/
  );
}

// 9zh. optional-before-engine -> check_lazy_app.js  (E0)
//     The genre page's optional downloads (the atlas outlines and the genre
//     photos) wait for the engine's bytes, as the prose does: requested at
//     the paint, they share the link with the file an early Add waits for.
//     The plant asks for them at the paint.
if (want('9zh', 'optional-before-engine')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/pages/genre.js',
    'uiAfterPaint(() => Engine.fetched().then(gpLoadOptional));',
    'uiAfterPaint(gpLoadOptional);'
  );
  record(
    'optional-before-engine -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E0'),
    /engine E0: [^\n]*(?:data\/atlas-geo\.json|api\/tradition_images\.json)[^\n]* requested while the instrument data was held/
  );
}

// 9zi. engine-preload-dropped -> build_html.js --check
//     The <head> preload is a saved session's head start (src/engine_preload.js,
//     placed by the template's <!--@ENGINE_PRELOAD--> marker). A template
//     without the marker stops the build at once; the plant is the quieter
//     loss, a build that keeps the marker and emits nothing for it, so the
//     page ships without the script.
if (want('9zi', 'engine-preload-dropped')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantIn(
    d,
    'scripts/build_html.js',
    '  .replace(ENGINE_PRELOAD_MARKER, () =>\n    LAZY\n',
    '  .replace(ENGINE_PRELOAD_MARKER, () =>\n    false\n'
  );
  record(
    'engine-preload-dropped -> build_html.js --check',
    gate(d, ['scripts/build_html.js', '--check', '--quiet', `--out=${path.join(d, 'x.html')}`]),
    /0 <script> block\(s\) in a lazy page name "preload"; want 1/
  );
}

// 9zj. boot-error-hidden -> check_lazy_app.js  (F1, F4b, F4c, F4f)
//     A boot that fails draws its error in the boot status's place, which
//     body.boot-failed shows over the whole viewport. Drawn in the editor
//     panel, as step 9 first drew it, the words are there and nobody sees
//     them: the workbench's styles hide that panel until an editor opens, and
//     the page is blank. The gate asks the computed style of the error and
//     every ancestor, not only its words.
if (want('9zj', 'boot-error-hidden')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    "  const host = document.getElementById('boot-status') || document.body;",
    "  const host = document.getElementById('workspace-detail') || document.body;"
  );
  record(
    'boot-error-hidden -> check_lazy_app.js',
    lazyGate(d, '--only=failure'),
    /#boot-error and its Reload are drawn but not shown \(section#workspace-detail display=none\): a blank page/
  );
}

// 9zk. boot-failure-unhandled -> check_lazy_app.js  (F1, F4b)
//     The boot's handlers attach at DOMContentLoaded, and a saved session's
//     engine request goes out from <head>, so a fast 404 can reject
//     CATALOG_READY while the page is still arriving. Handled from its
//     creation, it waits for them; unhandled, it reaches the page's trap,
//     whose "Something went wrong" toast covers the boot error. The plant
//     drops that first handler; F1 and F4b hold DOMContentLoaded's handlers
//     until the failure has landed.
if (want('9zk', 'boot-failure-unhandled')) {
  const d = lazyEnv();
  plantIn(d, 'src/app.js', 'if (CATALOG_READY) CATALOG_READY.catch(() => {});\n', '');
  record(
    'boot-failure-unhandled -> check_lazy_app.js',
    lazyGate(d, '--only=failure'),
    /\((?:F1|F4b)\): unhandled rejection before DOMContentLoaded \(/
  );
}

// 9zl. not-the-file-as-stale -> check_lazy_app.js  (F4d)
//     Only a header that parses and names another digest is another deploy's
//     file, which a reload fixes. A 200 that is not the file (a captive
//     portal's sign-in page, a host's fallback page) is a load failure, which
//     a retry can fix; refused as stale it offers Reload alone. The plant
//     throws the stale refusal for it.
if (want('9zl', 'not-the-file-as-stale')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    "          throw new Error('the response is not the instrument data');",
    '          throw stale();'
  );
  record(
    'not-the-file-as-stale -> check_lazy_app.js',
    lazyGate(d, '--only=failure'),
    /\(F4d, a sign-in page in its place\): the engine is failed \("instrument data does not match this page", stale true\)/
  );
}

// 9zm. engine-preload-stray-key -> build_html.js --check
//     The other side of 9x: <head> reads a key app.js does not, so a page
//     that never restores that session downloads the engine during its first
//     view. build_html.js --check answers every key the script asks for and
//     refuses one storedSessionText does not read (check_lazy_app's first
//     view fails it too, from the page).
if (want('9zm', 'engine-preload-stray-key')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantIn(
    d,
    'src/engine_preload.js',
    "      localStorage.getItem('musica-study-v1') ||\n",
    "      localStorage.getItem('musica-study-v1') ||\n      localStorage.getItem('codex-workbench-v2') ||\n"
  );
  record(
    'engine-preload-stray-key -> build_html.js --check',
    gate(d, ['scripts/build_html.js', '--check', '--quiet', `--out=${path.join(d, 'x.html')}`]),
    /the engine preload reads localStorage\.getItem\("codex-workbench-v2"\), which storedSessionText \(src\/app\.js\) does not/
  );
}

// 9zn. embedded-engine-table-missing -> build_html.js --embedded --check
//     The embedded page is the one check_lazy_app and tandem hold the lazy
//     shell to, and it carries every engine table inline. --check reads each
//     of the eight back, by name, with rows; the plant strips ROOM_CLUSTERS
//     from the embedded build as the lazy build strips the whole engine.
if (want('9zn', 'embedded-engine-table-missing')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantIn(
    d,
    'scripts/build_html.js',
    "const LAZY_DROP_TABLES = LAZY ? new Set(['NAV_GLYPH_SVGS', ...P.ENGINE_TABLES]) : new Set();",
    "const LAZY_DROP_TABLES = LAZY ? new Set(['NAV_GLYPH_SVGS', ...P.ENGINE_TABLES]) : new Set(['ROOM_CLUSTERS']);"
  );
  record(
    'embedded-engine-table-missing -> build_html.js --embedded --check',
    gate(d, [
      'scripts/build_html.js',
      '--embedded',
      '--check',
      '--quiet',
      `--out=${path.join(d, 'x.html')}`,
    ]),
    /the embedded page does not carry engine table ROOM_CLUSTERS/
  );
}

// 9zo. inlined-engine-reader -> check_lazy_app.js  (E6)
//     The page runs the regions build_html.js inlines from scripts/ beside
//     src/, so E6's census of the engine-table reads covers them too. The
//     plant adds a read of INSTRUMENTS to harvestDescriptors, in
//     scripts/_card_descriptors.js's inlined region.
if (want('9zo', 'inlined-engine-reader')) {
  const d = lazyEnv();
  plantIn(
    d,
    'scripts/_card_descriptors.js',
    '  const inst = lookups.inst(card.instrumentId);\n',
    '  const inst = lookups.inst(card.instrumentId) || INSTRUMENTS.find((x) => x.id === card.instrumentId);\n'
  );
  record(
    'inlined-engine-reader -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E6'),
    /engine E6: the direct reads of the engine tables changed: scripts\/_card_descriptors\.js@inline INSTRUMENTS in harvestDescriptors: 0 → 1/
  );
}

// 10d–10f. THE RENDER TABLES. TRADITION_SIGNATURES and DESCRIPTOR_DF are
//     read only through _traditionSignatureFor and _ensureDescriptorDF, and
//     only from a card, so no first-view path reads either. Before the
//     instrument data is in, each reader misses: a counted EngineNotReadyError,
//     never an answer. (The lazy page reads both from api/engine.json; until
//     it lands their slots are empty.)

// 10d. sig-unguarded -> check_lazy_app.js  (E11)
//     Without its _engineLive test the reader answers before the instrument
//     data is in, and an empty signature reads as "this tradition has none".
if (want('10d', 'sig-unguarded')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    "  !_engineLive ? Engine.miss('TRADITION_SIGNATURES ' + tradId) : (tradId && TRADITION_SIGNATURES[tradId]) || [];",
    '  (tradId && TRADITION_SIGNATURES[tradId]) || [];'
  );
  record(
    'sig-unguarded -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E11'),
    /engine E11: _traditionSignatureFor\('bluegrass'\) before the instrument data landed (?:answered|threw \w+); want EngineNotReadyError/
  );
}

// 10e. df-unguarded -> check_lazy_app.js  (E11)
//     Without its guard the reader reaches for the table before the instrument
//     data is in. With the table inline it filled its memo then, and every
//     later sort ordered by what it cached; with the table in api/engine.json
//     the slot is still empty, and the read throws a TypeError, uncounted,
//     where an EngineNotReadyError belongs.
if (want('10e', 'df-unguarded')) {
  const d = lazyEnv();
  plantIn(d, 'src/app.js', "  if (!_engineLive) return Engine.miss('DESCRIPTOR_DF');\n", '');
  record(
    'df-unguarded -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E11'),
    /engine E11: (?:_DESCRIPTOR_DF was filled before the instrument data landed|_sortDescriptorsByPriority\([^)]*\) before the instrument data landed threw TypeError; want EngineNotReadyError)/
  );
}

// 10f. table-read-in-first-view -> check_lazy_app.js  (E2)
//     The genre picker's tree is drawn the moment the picker opens, which can
//     be long before the instrument data is in. A signature read there misses,
//     and E2's sweep, which opens the picker and expands the tree with the
//     data held, counts it.
if (want('10f', 'table-read-in-first-view')) {
  const d = lazyEnv();
  plantIn(
    d,
    'src/app.js',
    '  const indent = depth * 16;\n\n  let html = `<div class="tree-node"',
    '  const indent = depth * 16;\n  _traditionSignatureFor(node.id);\n\n  let html = `<div class="tree-node"'
  );
  record(
    'table-read-in-first-view -> check_lazy_app.js',
    lazyGate(d, '--only=engine', '--checks=E2'),
    /engine E2: [^\n]*\b\d+ engine read\(s\)/
  );
}

// 10a, 10r, 10g–10n. THE RENDER TABLES IN api/engine.json. The lazy build
//     cuts both src/app.js mirrors and the page reads the two tables from
//     api/engine.json, each written as one compact line by the codec
//     (scripts/_engine_codec.js), whose digest the engine digest folds in.
//     (10r is the plan's 10b, renumbered: 10b is count-drift-behind-qualifier.)
// api/engine.json rewritten in a copy by its own (planted) scripts, so the
// file and the code agree and only the gate the class names can tell.
const rebuildEngine = (d) =>
  execFileSync(
    'node',
    [
      '-e',
      "require('fs').writeFileSync('api/engine.json', require('./scripts/_page_tables.js').engineText('references'))",
    ],
    { cwd: d, stdio: 'pipe' }
  );
// One encoded line of api/engine.json, edited in place: edit(value) mutates it.
function editEngineLine(d, name, edit) {
  const f = path.join(d, 'api/engine.json');
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  const k = lines.findIndex((l) => l.startsWith(`[${JSON.stringify(name)},`));
  if (k < 0) throw new Error(`faults: no ${name} line in api/engine.json`);
  const [n, value] = JSON.parse(lines[k].replace(/,$/, ''));
  edit(value);
  lines[k] = JSON.stringify([n, value]) + ',';
  fs.writeFileSync(f, lines.join('\n'));
}
// The page's slot for one render table taken out, and its src mirror left in
// the page, so the page still parses (a `const` beside its `let` would not).
function plantMirrorLeft(d, name) {
  plantIn(
    d,
    'scripts/build_html.js',
    "  if (LAZY) appJs = appJs.replace(m[0], () => '');",
    `  if (LAZY && name !== '${name}') appJs = appJs.replace(m[0], () => '');`
  );
  plantIn(
    d,
    'scripts/build_html.js',
    "        `let ${P.ENGINE_TABLES.join(', ')};`,",
    `        \`let \${P.ENGINE_TABLES.filter((n) => n !== '${name}').join(', ')};\`,`
  );
}
const htmlCheck = (d) =>
  gate(d, ['scripts/build_html.js', '--check', '--quiet', `--out=${path.join(d, 'x.html')}`]);

// 10a. sigs-left-in-page -> build_html.js --check
//     The signatures' mirror is about 43 KB of the lazy page, gzipped, that
//     the page then also fetches.
if (want('10a', 'sigs-left-in-page')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantMirrorLeft(d, 'TRADITION_SIGNATURES');
  record(
    'sigs-left-in-page -> build_html.js --check',
    htmlCheck(d),
    /a block of the lazy page declares TRADITION_SIGNATURES with a value/
  );
}

// 10r. df-left-in-page -> build_html.js --check
//     The frequencies' mirror: about 74 KB of the lazy page, gzipped.
if (want('10r', 'df-left-in-page')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantMirrorLeft(d, 'DESCRIPTOR_DF');
  record(
    'df-left-in-page -> build_html.js --check',
    htmlCheck(d),
    /a block of the lazy page declares DESCRIPTOR_DF with a value/
  );
}

// 10g. codec-unfolded -> check_api.js
//     engineSha without the codec's digest: a page and a file written by
//     different codecs would then agree on a digest and the page would decode
//     the file wrongly. The file is rewritten by the planted code, so it is
//     what that code derives; check_api recomputes the digest itself.
if (want('10g', 'codec-unfolded')) {
  const d = mkenv(['scripts', 'references', 'api']);
  plantIn(
    d,
    'scripts/_page_tables.js',
    ".update(JSON.stringify(tables) + '\\n' + codec.codecSha())",
    '.update(JSON.stringify(tables))'
  );
  rebuildEngine(d);
  record(
    'codec-unfolded -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /engine\.json: tables_sha1 is not the digest of the page copy of the engine tables with codec_sha1 folded in/
  );
}

// 10h. codec-region-skew -> build_html.js --check
//     The page's copy of the codec reads the counts in base 32: a page whose
//     codec is not the one the digest names.
if (want('10h', 'codec-region-skew')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantIn(
    d,
    'scripts/build_html.js',
    '  CODEC_INLINED = codec.codecRegion();',
    "  CODEC_INLINED = codec.codecRegion().replace('parseInt(a[j], 36)', 'parseInt(a[j], 32)');"
  );
  record(
    'codec-region-skew -> build_html.js --check',
    htmlCheck(d),
    /the inlined codec region digest ≠ codecSha\(\)/
  );
}

// 10i. engine-df-drift -> check_api.js
//     One frequency one higher in api/engine.json, under its unchanged header:
//     the page would sort by it and nothing in the page could tell.
if (want('10i', 'engine-df-drift')) {
  const d = mkenv(['scripts', 'references', 'api']);
  editEngineLine(d, 'DESCRIPTOR_DF', (value) => {
    const a = value.a.split(',');
    const j = a.findIndex((x) => x !== '');
    a[j] = (parseInt(a[j], 36) + 1).toString(36);
    value.a = a.join(',');
  });
  record(
    'engine-df-drift -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /engine\.json differs from what scripts\/_page_tables\.js derives from references\/[\s\S]*its DESCRIPTOR_DF line does not decode to references\/_descriptor_df\.json/
  );
}

// 10j. false-pair-in-engine-only -> check_signature_tokens.js
//     A pair ruled false, back in api/engine.json's copy only: the table, the
//     src/app.js mirror and codex.html stay clean, so the catch has to come
//     from the gate decoding the file the lazy page reads.
if (want('10j', 'false-pair-in-engine-only')) {
  const d = mkenv(['scripts', 'references', 'src', 'api/engine.json', 'codex.html']);
  const rulings = JSON.parse(
    fs.readFileSync(path.join(d, 'references/_signature_rulings.json'), 'utf8')
  ).rulings;
  let r = null;
  editEngineLine(d, 'TRADITION_SIGNATURES', (value) => {
    const ids = value.k.split(' '),
      lists = value.l.split(' ');
    const tokensOf = (i) => lists[i].split('.').map((n) => value.v[parseInt(n, 36)]);
    r = rulings.find(
      (x) =>
        x.verdict === 'false' &&
        ids.includes(x.tradition) &&
        !tokensOf(ids.indexOf(x.tradition)).includes(x.token)
    );
    if (!r) throw new Error('faults: no false signature ruling to restore in api/engine.json');
    let at = value.v.indexOf(r.token);
    if (at < 0) at = value.v.push(r.token) - 1;
    lists[ids.indexOf(r.tradition)] += '.' + at.toString(36);
    value.l = lists.join(' ');
  });
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  record(
    'false-pair-in-engine-only -> check_signature_tokens.js',
    gate(d, ['scripts/check_signature_tokens.js']),
    new RegExp(
      `FALSE_SURVIVES[\\s\\S]*${esc(r.tradition)} / ${esc(r.token)} \\(ruled false[^)]*\\) is still in api/engine\\.json`
    )
  );
}

// 10k. mirror-skew-at-build -> build_html.js --check
//     One count in the src/app.js frequencies, off by 777: the embedded build
//     and Node would sort by it, the lazy page by the JSON. Fault 21 holds the
//     same drift to build_descriptor_df.js --check; the build refuses it too.
if (want('10k', 'mirror-skew-at-build')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'src/app.js');
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/(const DESCRIPTOR_DF = \{\n {2}'[^']+': )(\d+),/);
  if (!m) throw new Error('faults: DESCRIPTOR_DF block not found in src/app.js');
  fs.writeFileSync(f, src.replace(m[0], m[1] + (Number(m[2]) + 777) + ','));
  record(
    'mirror-skew-at-build -> build_html.js --check',
    htmlCheck(d),
    /cut DESCRIPTOR_DF ≠ references\/_descriptor_df\.json; run node scripts\/build_descriptor_df\.js/
  );
}

// 10l. commit-skips-table -> build_html.js --check
//     CODEX_ENGINE_COMMIT written without the frequencies: the engine loads,
//     says it is ready, and every sort misses for good.
if (want('10l', 'commit-skips-table')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantIn(
    d,
    'scripts/build_html.js',
    '${P.ENGINE_TABLES.map((n) => `${n} = t.${n};`)',
    "${P.ENGINE_TABLES.filter((n) => n !== 'DESCRIPTOR_DF').map((n) => `${n} = t.${n};`)"
  );
  record(
    'commit-skips-table -> build_html.js --check',
    htmlCheck(d),
    /CODEX_ENGINE_COMMIT does not fill the engine slot DESCRIPTOR_DF/
  );
}

// 10m. decode-drops-tail -> check_lazy_app.js  (parity)
//     The signature decode stops a slice early, in a page only (Node's run of
//     the same region, which proves the encoder's round trip, is spared), so
//     the file is written and its digest agrees: only a gate that runs the
//     page sees the last few hundred traditions lose their signatures.
if (want('10m', 'decode-drops-tail')) {
  const d = lazyEnv();
  plantIn(
    d,
    'scripts/_engine_codec.js',
    '  for (let i = 0; i < keys.length; i += 500) {',
    "  for (let i = 0; i < keys.length - (typeof window !== 'undefined' ? 500 : 0); i += 500) {"
  );
  rebuildEngine(d);
  record(
    'decode-drops-tail -> check_lazy_app.js',
    lazyGate(d, '--only=parity'),
    /engine fingerprint drift[^\n]*differs in: [^\n]*TRADITION_SIGNATURES/
  );
}

// 10n. strip-too-wide -> check_api.js
//     The page strip drops each signature of one token too: those traditions'
//     cards would read as having none. The file is rewritten by the planted
//     code; check_api filters references/ for empty lists itself.
if (want('10n', 'strip-too-wide')) {
  const d = mkenv(['scripts', 'references', 'api']);
  plantIn(
    d,
    'scripts/_page_tables.js',
    'if (list.length) out[id] = list;',
    'if (list.length > 1) out[id] = list;'
  );
  rebuildEngine(d);
  record(
    'strip-too-wide -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /engine\.json: its TRADITION_SIGNATURES line does not decode to references\/_tradition_signatures\.json less its empty lists/
  );
}

// 10c, 10o, 10p. THE TREE'S DESCRIPTIONS. The lazy page's TREE_NODES carries
//     each node's id, name and parent only (build_html.js LAZY_DROP_FIELDS);
//     the descriptions ride in api/browse_prose.json under "tree" and merge
//     back by id when the prose lands. Until then the picker leaves a row's
//     description out, claims nothing, and redraws once the prose settles.

// 10c. tree-prose-inline -> build_html.js --check
//     The strip emptied: about 30 KB of descriptions, gzipped, back in the
//     lazy page's first download, for rows only an expanded picker draws.
if (want('10c', 'tree-prose-inline')) {
  const d = mkenv(['scripts', 'references', 'src']);
  plantIn(
    d,
    'scripts/build_html.js',
    "const LAZY_DROP_FIELDS = LAZY ? { TREE_NODES: [['', ['description']]] } : {};",
    'const LAZY_DROP_FIELDS = {};'
  );
  record(
    'tree-prose-inline -> build_html.js --check',
    htmlCheck(d),
    /TREE_NODES carries description in a lazy page/
  );
}

// 10o. tree-prose-missing -> check_api.js
//     browse_prose.json written without "tree": the lazy picker would never
//     draw a node description. The file is rewritten by the planted code, so
//     it is what that code derives; check_api holds it to references/.
//     (check_lazy_app's W-tree fails it too: the picker never fills in.)
if (want('10o', 'tree-prose-missing')) {
  const d = mkenv(['scripts', 'references', 'api']);
  plantIn(d, 'scripts/_browse_tables.js', '    tree: treeProse(nodes),\n', '');
  execFileSync(
    'node',
    [
      '-e',
      "const C = require('./scripts/_loader.js'); const B = require('./scripts/_browse_tables.js'); " +
        'const items = C.TRADITIONS.map((t) => B.browseItem(t, C.TRADITION_EXTRAS[t.id] || {})); ' +
        "require('fs').writeFileSync('api/browse_prose.json', JSON.stringify(B.proseIndex(items, C.TREE_NODES)));",
    ],
    { cwd: d, stdio: 'pipe' }
  );
  record(
    'tree-prose-missing -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /browse_prose\.json carries no "tree"/
  );
}

// 10p. tree-prose-no-redraw -> check_lazy_app.js  (W-tree)
//     A row that leaves its description out without marking the picker: when
//     no genre row asks for prose, the picker is never redrawn and the
//     descriptions that landed stay undrawn until it is reopened.
if (want('10p', 'tree-prose-no-redraw')) {
  const d = lazyEnv();
  plantIn(d, 'src/app.js', '    else if (!Catalog.treeProse()) _pickerProsePending = true;\n', '');
  record(
    'tree-prose-no-redraw -> check_lazy_app.js',
    lazyGate(d, '--only=window'),
    /window W-tree: a tree row left its description out and did not mark the picker pending/
  );
}

// 9b. minification changes behaviour -> check_minified_equivalence.js
//     The gate builds the embedded app BOTH ways from one source and compares
//     them, so the defect to plant is in the transformer itself: _minify.js is
//     patched to reprint one value differently. That is the SUBTLE class the
//     gate exists for — the page still boots and renders, and exactly one
//     string in one table is wrong, which no byte ceiling or parse check can
//     see. (A total break, like enabling top-level mangling, is caught by the
//     behavioural harnesses too; this one is not.)
if (want('9b', 'minifier-changes-behaviour')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'scripts/_minify.js');
  const src = fs.readFileSync(f, 'utf8');
  const patched = src.replace(
    '  return result.code;\n}',
    "  return result.code.replace('guitar', '__FAULT__');\n}"
  );
  if (patched === src) throw new Error('faults: could not plant the minifier defect');
  fs.writeFileSync(f, patched);
  record(
    'minifier-changes-behaviour -> check_minified_equivalence.js',
    gate(d, ['scripts/check_minified_equivalence.js']),
    /__FAULT__|differs at offset|MINIFIED EQUIVALENCE: FAIL/i
  );
}

// 10. doc count drift -> check_docs.js  (a canonical count in the docs no longer
//     matches the live catalog — the class that shipped stale AGENTS/SKILL counts)
if (want('10', 'count-drift')) {
  const d = mkenv([
    'scripts',
    'references',
    'SKILL.md',
    'AGENTS.md',
    'index.html',
    'package.json',
    'llms.txt',
  ]);
  const f = path.join(d, 'package.json');
  // Derive the count from the file rather than hardcoding it. A literal here
  // rots the moment the catalog grows: the replace silently becomes a no-op,
  // nothing gets planted, and the gate "passes" for the wrong reason — this
  // class escaped exactly that way when the catalog went 1,145 -> 1,426.
  const pkg = fs.readFileSync(f, 'utf8');
  const m = pkg.match(/(\d+)-tradition/);
  if (!m) throw new Error('faults: no "<n>-tradition" claim in package.json to perturb');
  const off = String(Number(m[1]) - 1);
  fs.writeFileSync(f, pkg.replace(m[0], off + '-tradition'));
  record(
    'count-drift -> check_docs.js',
    gate(d, ['scripts/check_docs.js']),
    new RegExp(`${m[1]}|${off}|drift|mismatch|count|expected`, 'i')
  );
}

// 10b. doc count drift in the SUPPRESSED phrasing -> check_docs.js
//
//      Class 10 above perturbs "<n>-tradition", which no qualifier rule touches
//      — so it only ever proved the gate catches drift on the easy path. The
//      phrasing that actually shipped stale was "returns all 1145 traditions
//      WITH their recipe strings": the trailing `with` marked it a subset claim,
//      the gate skipped it, and AGENTS.md advertised 1145 against a real 2503
//      while check_docs printed PASS. A gate that goes green on the defect it
//      exists to catch is worse than no gate, because it is also a claim.
//
//      This class is deliberately built from the qualifier list itself rather
//      than a literal `with`, so it keeps testing the boundary if QUALIFIERS is
//      ever edited.
if (want('10b', 'count-drift-behind-qualifier')) {
  const d = mkenv(['scripts', 'references', 'SKILL.md', 'AGENTS.md', 'index.html', 'llms.txt']);
  const f = path.join(d, 'AGENTS.md');
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/all (\d+)\s*\n?traditions with/);
  if (!m) throw new Error('faults: no "all <n> traditions with" claim in AGENTS.md to perturb');
  const off = String(Number(m[1]) - 1);
  fs.writeFileSync(f, src.replace(m[0], m[0].replace(m[1], off)));
  record(
    'count-drift-behind-qualifier -> check_docs.js',
    gate(d, ['scripts/check_docs.js']),
    new RegExp(`${m[1]}|${off}|drift|mismatch|count|expected`, 'i')
  );
}

// 11. a documented command that no longer exits 0 -> check_doc_commands.js
if (want('11', 'failing-doc-command')) {
  const d = mkenv([
    'scripts',
    'references',
    'api',
    'src',
    'AGENTS.md',
    'llms.txt',
    'README.md',
    'SKILL.md',
  ]);
  fs.appendFileSync(
    path.join(d, 'AGENTS.md'),
    '\nnode scripts/recipe.js --tradition __doccmd_fault__\n'
  );
  record(
    'failing-doc-command -> check_doc_commands.js',
    gate(d, ['scripts/check_doc_commands.js']),
    /__doccmd_fault__|errored|exit|recipe/i
  );
}

// 11b. a documented command names a file that does not exist ->
//      check_doc_paths.js  (the gate added 2026-08-21 after four RESULTS
//      documents were found citing two example lyrics that had been deleted
//      nine days earlier, across 49 citations and 17 "REPRODUCES EXACTLY"
//      rows, while `npm run check-docs` stayed green throughout)
if (want('11b', 'documented-path-missing')) {
  const d = mkenv([
    'scripts',
    'references',
    'api',
    'src',
    'AGENTS.md',
    'llms.txt',
    'README.md',
    'SKILL.md',
  ]);
  fs.appendFileSync(
    path.join(d, 'AGENTS.md'),
    '\n```\npython3 quality/floor.py corpus/song/__docpath_fault__.txt\n```\n'
  );
  record(
    'documented-path-missing -> check_doc_paths.js',
    gate(d, ['scripts/check_doc_paths.js']),
    /__docpath_fault__|MISSING|do not exist/i
  );
}

// 12. a documented BEHAVIOR drifts from the prose -> check_doc_behaviors.js
//     (corrupt belting's documented §3d token list — the assertion must catch it)
if (want('12', 'behavior-drift')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'references/07_preface_lexicon.js');
  // Rename belting's UNIQUE id so the §3d assertion (which finds 'belting' and
  // checks its documented 8 tokens) sees "(belting not found)" and fails.
  fs.writeFileSync(
    f,
    fs.readFileSync(f, 'utf8').replace("id: 'belting'", "id: 'belting__fault__'")
  );
  record(
    'behavior-drift -> check_doc_behaviors.js',
    gate(d, ['scripts/check_doc_behaviors.js']),
    /belting|behavior|drift|not found|FAIL/i
  );
}

// 13. a production-dead preface token -> check_prefaces.js  (a token no card can
//     surface in production preface scoring: it silently never matches yet still
//     inflates the |shared|/tokens.length denominator — the M-DATA-1 class)
if (want('13', 'dead-preface-token')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'references/07_preface_lexicon.js');
  fs.writeFileSync(
    f,
    fs.readFileSync(f, 'utf8').replace('tokens: [', "tokens: ['zzz_dead_fault_token', ")
  );
  record(
    'dead-preface-token -> check_prefaces.js',
    gate(d, ['scripts/check_prefaces.js']),
    /zzz_dead_fault_token|dead-token|never scores/i
  );
}

// 14. app<->connector parity drift -> check_app_parity.js  (mutate ONLY the connector
//     render path; the app reads its own inlined compileRecipeStack from src/app.js,
//     so a sentinel in _seed_workspace.renderWorkspace forces the two to disagree)
if (want('14', 'app-connector-parity-drift')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'scripts/_seed_workspace.js');
  const source = fs.readFileSync(f, 'utf8');
  const anchor = 'const rendered = header + body;';
  if (source.split(anchor).length !== 2)
    throw new Error('app-connector-parity-drift mutation anchor is stale or ambiguous');
  fs.writeFileSync(
    f,
    source.replace(anchor, "const rendered = '__PARITY_FAULT__' + header + body;")
  );
  record(
    'app-connector-parity-drift -> check_app_parity.js',
    gate(d, ['scripts/check_app_parity.js', '--limit=30']),
    /__PARITY_FAULT__|mismatch|FAIL/i
  );
}

// 15. preface assignment drift -> regression_prefaces.js  (corrupt one fixture's
//     expected preface so the matcher's real output no longer matches it)
if (want('15', 'preface-drift')) {
  const d = mkenv(['scripts', 'references', 'tests']);
  const f = path.join(d, 'tests/_preface_regression_fixtures.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j[0].expectedPreface = '__preface_fault__';
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  record(
    'preface-drift -> regression_prefaces.js',
    gate(d, ['scripts/regression_prefaces.js']),
    /__preface_fault__|FAIL/
  );
}

// 16. slot-pick drift -> check_slot_picks.js  (corrupt one fixture's expected variant
//     so the searched slot pick no longer matches the lock-in)
if (want('16', 'slot-pick-drift')) {
  const d = mkenv(['scripts', 'references', 'tests']);
  const f = path.join(d, 'tests/slot_pick_lock_ins.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.tests[0].expected_variant = '__slot_fault__';
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  record(
    'slot-pick-drift -> check_slot_picks.js',
    gate(d, ['scripts/check_slot_picks.js']),
    /__slot_fault__|FAILURES|FAIL/
  );
}

// 17. dead token in the AUDIT-enriched pool -> audit_dead_tokens.js  (class 13 covers
//     the production pool via check_prefaces; this covers the enriched-pool gate that
//     also scans variant.match_tokens — a token dead even there does no work)
if (want('17', 'dead-audit-token')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'references/07_preface_lexicon.js');
  fs.writeFileSync(
    f,
    fs.readFileSync(f, 'utf8').replace('tokens: [', "tokens: ['zzz_dead_audit_token', ")
  );
  record(
    'dead-audit-token -> audit_dead_tokens.js',
    gate(d, ['scripts/audit_dead_tokens.js']),
    /zzz_dead_audit_token|DEAD-TOKEN AUDIT: FAIL/i
  );
}

// 18. workspace mutation -> check_workspace_ops.js  (neuter clone() to an identity
//     function so edit ops mutate their input workspace, violating the state-passing
//     immutability the gate's "IMMUTABLE: ..." checks assert)
if (want('18', 'workspace-mutation')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'scripts/_workspace_ops.js');
  fs.writeFileSync(
    f,
    fs
      .readFileSync(f, 'utf8')
      .replace(
        'function clone(ws) {',
        'function clone(ws) {\n  return ws; // __WORKSPACE_FAULT__ identity clone breaks state-passing'
      )
  );
  record(
    'workspace-mutation -> check_workspace_ops.js',
    gate(d, ['scripts/check_workspace_ops.js']),
    /IMMUTABLE|FAIL/
  );
}

// 19. stale voice-parts mirror -> _gen_voice_parts.js --check  (the Node seed's voice
//     maps in _voice_parts_data.js drift from src/app.js without regeneration — a
//     desync the recipe-parity gates can miss, since it need not change a rendered recipe)
if (want('19', 'stale-voice-parts')) {
  const d = mkenv(['scripts', 'src']);
  const f = path.join(d, 'scripts/_voice_parts_data.js');
  fs.writeFileSync(
    f,
    fs
      .readFileSync(f, 'utf8')
      .replace("voice_articulation: 'melisma_voice'", "voice_articulation: '__VP_FAULT__'")
  );
  record(
    'stale-voice-parts -> _gen_voice_parts.js',
    gate(d, ['scripts/_gen_voice_parts.js', '--check']),
    /VOICE-PARTS: FAIL|stale/i
  );
}

// 20. the header stops fitting a phone -> check_mobile_layout.js
//     (the real regression this gate was written for: `.app-bar .actions` held eight
//     `white-space: nowrap` controls in a non-shrinking flex row, so its min-content
//     width — measured at ~712px — exceeded the device width. That never surfaces as
//     document overflow: the browser opens the LAYOUT VIEWPORT to fit and scales the
//     whole app down, so every scrollWidth-based check stays green. Re-plant that
//     width demand on the same container the regression lived in.)
//     SINCE THE WORKBENCH HEADER, ALSO ON ITS TWO CLUSTERS. `.app-bar .actions`
//     is the old header, which the workbench removes from the DOM at boot, so a
//     plant on it alone matched nothing and ESCAPED. The new header is a grid
//     below 900px and the page clips its overflow, so the same width demand on
//     its nav pushes the rightmost section tab off screen without any document
//     overflow: the gate catches it through the four section capabilities.
if (want('20', 'unfittable-header')) {
  const d = mkenv(['scripts', 'codex.html', 'api']);
  const f = path.join(d, 'codex.html');
  const before = fs.readFileSync(f, 'utf8');
  const after = before.replace(
    '</body>',
    '<style>/* __MOBILE_FAULT__ */ .app-bar .actions, .app-bar nav, .app-bar .ui-tools { min-width: 720px !important; }</style>\n</body>'
  );
  if (after === before) throw new Error('mobile fault: could not inject into codex.html');
  fs.writeFileSync(f, after);
  // Deliberately NOT matching the generic `MOBILE LAYOUT: FAIL` banner: this gate
  // needs a browser, and a Chromium-launch failure prints that same banner. Only
  // the two measured-defect messages count, so a missing browser is reported as
  // WRONG-REASON instead of masquerading as detection.
  //
  // These two phrases are a CONTRACT with check_mobile_layout.js. It reports the
  // viewport measurement before it touches the page, precisely so a layout this
  // broken — which also stops Playwright clicking through it — still fails on the
  // measurement rather than on a click timeout. Keep them in step.
  record(
    'unfittable-header -> check_mobile_layout.js',
    gate(d, ['scripts/check_mobile_layout.js']),
    /layout viewport blown open|off-screen/i
  );
}

// 21. drifted frozen descriptor-DF mirror -> build_descriptor_df.js --check
//     The DF counts that order every descriptor chunk are committed in
//     references/_descriptor_df.json and inlined into src/app.js (which cannot
//     require()). If the inlined copy drifts, the browser and the connector sort
//     chunks by DIFFERENT numbers — a desync the recipe fixtures need not catch,
//     since it only shows on the traditions whose chunks the drifted tokens reach.
if (want('21', 'drifted-descriptor-df')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'src/app.js');
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/(const DESCRIPTOR_DF = \{\n {2}'[^']+': )(\d+),/);
  if (!m) throw new Error('descriptor-df fault: DESCRIPTOR_DF block not found in src/app.js');
  fs.writeFileSync(f, src.replace(m[0], m[1] + (Number(m[2]) + 777) + ','));
  record(
    'drifted-descriptor-df -> build_descriptor_df.js',
    gate(d, ['scripts/build_descriptor_df.js', '--check']),
    /PARITY|DESCRIPTOR-DF: FAIL/
  );
}

// 22. frozen descriptor-DF fallen behind the catalog -> build_descriptor_df.js --check
//     The freeze is ALLOWED to lag the catalog — that lag is what stops one new
//     instrument reordering everyone's cards. What must not happen is the lag
//     growing without bound: every token the catalog gains after a freeze is
//     unknown to the table and drops to the 999 fallback, piling up at the back of
//     every chunk. Truncating the frozen table is the mechanical dual of the
//     catalog growing past it. The app.js block is regenerated from the truncated
//     JSON first, so PARITY is clean and only COVERAGE can fail.
if (want('22', 'stale-frozen-df')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const p = path.join(d, 'references/_descriptor_df.json');
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const keys = Object.keys(j.df);
  j.df = Object.fromEntries(keys.slice(0, Math.floor(keys.length / 2)).map((k) => [k, j.df[k]]));
  fs.writeFileSync(p, JSON.stringify(j, null, 2));
  gate(d, ['scripts/build_descriptor_df.js']); // re-inline, so parity is NOT the defect
  record(
    'stale-frozen-df -> build_descriptor_df.js',
    gate(d, ['scripts/build_descriptor_df.js', '--check']),
    /COVERAGE/
  );
}

// 23. A foreign tradition's NAME reaches the picks -> check_name_isolation.js
// The exact regression this gate exists for. buildContext takes
// { includeName: false } so that neighbor-bias and hill-climbed staples read what
// a neighbouring tradition SOUNDS like and not what it is CALLED. Restore the
// name and the coupling comes straight back: a sibling's label becomes prose
// tokens in the focal tradition's scoring context, and gear descriptors collect
// bonuses from words that were never claims about sound. This is a one-word
// defect (`false` -> `true`) with catalog-wide reach, which is exactly the kind
// a reviewer waves through.
if (want('23', 'foreign-name-in-picks')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'scripts/score.js');
  const src = fs.readFileSync(f, 'utf8');
  const faulted = src.replace(
    /buildContext\((n\.id|tradIds\[i\]), \{ includeName: false \}\)/g,
    'buildContext($1, { includeName: true }) /* FAULT */'
  );
  if (faulted === src) {
    // The call sites moved or were rewritten; fail loudly rather than record a
    // pass for a fault that was never actually planted.
    record('foreign-name-in-picks -> check_name_isolation.js', {
      code: 0,
      out: 'FAULT NOT PLANTED: no { includeName: false } call site found in score.js',
    });
  } else {
    fs.writeFileSync(f, faulted);
    record(
      'foreign-name-in-picks -> check_name_isolation.js',
      gate(d, ['scripts/check_name_isolation.js', '--sample=12']),
      /DRIFT|drifted/i
    );
  }
}

// 24. Two entities that print the same label -> check_duplicates.js
//     The gate's BLOCK tier is identity collision on the display label, so the
//     fault is a second room carrying an existing room's name. It must fail and
//     name the pair, not merely exit non-zero: an id-collision check would also
//     exit 1 here, and this gate exists precisely because that is not what it
//     is testing.
if (want('24', 'duplicate-entity')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'references/03_rooms_chains_tunings.js');
  const src = fs.readFileSync(f, 'utf8');
  const first = src.match(/const ROOMS = \[\s*\{[\s\S]*?name: '([^']+)'/);
  if (!first) {
    record('duplicate-entity -> check_duplicates.js', {
      code: 0,
      out: 'FAULT NOT PLANTED: could not read the first room name from 03_rooms_chains_tunings.js',
    });
  } else {
    const clone =
      "const ROOMS = [\n  { id: 'zz_fault_dupe', name: '" +
      first[1].replace(/'/g, "\\'") +
      "', cluster: 'small_domestic', descriptors: ['dry'], note: 'injected fault' },";
    fs.writeFileSync(f, src.replace('const ROOMS = [', clone));
    record(
      'duplicate-entity -> check_duplicates.js',
      gate(d, ['scripts/check_duplicates.js']),
      /zz_fault_dupe/
    );
  }
}

// 25. A cultural claim ruled false comes back -> check_signature_tokens.js
//     The defect this gate exists for: a token the tradition's own prose rules
//     out (a Yolŋu didgeridoo tagged `celtic`) returns to the signature table,
//     where the atlas, the connector and the app all publish it. Planted in the
//     JSON ONLY — src/app.js, api/engine.json and codex.html keep the clean
//     block (the gate reads each, so each is staged) — so the catch
//     has to come from the gate reading the table itself, not from the mirror
//     parity check, which is a different gate with its own failure message.
//     The pair is read from the rulings file rather than typed here, so the
//     class keeps planting a real false pair whatever the rulings become.
if (want('25', 'signature-false-pair-restored')) {
  const d = mkenv(['scripts', 'references', 'src', 'api/engine.json', 'codex.html']);
  const rulings = JSON.parse(
    fs.readFileSync(path.join(d, 'references/_signature_rulings.json'), 'utf8')
  ).rulings;
  const f = path.join(d, 'references/_tradition_signatures.json');
  const sigs = JSON.parse(fs.readFileSync(f, 'utf8'));
  const r = rulings.find(
    (x) =>
      x.verdict === 'false' &&
      Array.isArray(sigs[x.tradition]) &&
      !sigs[x.tradition].includes(x.token)
  );
  if (!r) throw new Error('faults: no false signature ruling to restore');
  sigs[r.tradition].push(r.token);
  fs.writeFileSync(f, JSON.stringify(sigs, null, 2) + '\n');
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  record(
    'signature-false-pair-restored -> check_signature_tokens.js',
    gate(d, ['scripts/check_signature_tokens.js']),
    new RegExp(`FALSE_SURVIVES[\\s\\S]*${esc(r.tradition)} / ${esc(r.token)} \\(ruled false`)
  );
}

// 25b. A new cultural claim lands with no ruling -> check_signature_tokens.js
//      The other half of the promise: a cultural token cannot reach a tradition
//      unread. Adds a cultural token the vocabulary knows to a signed tradition
//      that has no ruling for it — the shape of an honest edit that skipped the
//      ruling, not a typo the vocabulary would catch as UNCLASSED.
if (want('25b', 'signature-pair-unruled')) {
  const d = mkenv(['scripts', 'references', 'src', 'api/engine.json', 'codex.html']);
  const vocab = JSON.parse(
    fs.readFileSync(path.join(d, 'references/_soundword_vocab.json'), 'utf8')
  ).tokens;
  const ruled = new Set(
    JSON.parse(
      fs.readFileSync(path.join(d, 'references/_signature_rulings.json'), 'utf8')
    ).rulings.map((x) => x.tradition + '\u0000' + x.token)
  );
  const f = path.join(d, 'references/_tradition_signatures.json');
  const sigs = JSON.parse(fs.readFileSync(f, 'utf8'));
  const cultural = Object.keys(vocab)
    .filter((t) => vocab[t].class === 'cultural')
    .sort();
  const trad = 'bluegrass';
  // Check the tradition is still signed BEFORE reading its list, so a lost
  // signature stops with the "could not stage" message, not a TypeError.
  const tok = Array.isArray(sigs[trad])
    ? cultural.find((t) => !sigs[trad].includes(t) && !ruled.has(trad + '\u0000' + t))
    : undefined;
  if (!tok) throw new Error('faults: could not stage an unruled cultural pair on bluegrass');
  sigs[trad].push(tok);
  fs.writeFileSync(f, JSON.stringify(sigs, null, 2) + '\n');
  record(
    'signature-pair-unruled -> check_signature_tokens.js',
    gate(d, ['scripts/check_signature_tokens.js']),
    new RegExp(
      `UNRULED[\\s\\S]*${trad} / ${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: cultural token with no ruling`
    )
  );
}

// Connector contract classes. These stage `mcp` (see mkenv: source copied,
// node_modules symlinked) because the gate drives a real in-memory MCP client
// rather than compiling the schemas itself.

// chain shape validation -> check_workspace_ops.js
// Disabling the multi-select branch is exactly the state the fx-corruption bug
// shipped in: a bare id written straight through, to be spread into characters
// by the next clone.
if (want('chain-shape-unvalidated')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'scripts/_workspace_ops.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('if (sec.multiSelect) {'))
    throw new Error('faults: multiSelect branch missing');
  fs.writeFileSync(f, src.replace('if (sec.multiSelect) {', 'if (false) {'));
  record(
    'chain-shape-unvalidated -> check_workspace_ops.js',
    gate(d, ['scripts/check_workspace_ops.js']),
    /multi-select|character|fx|chain/i
  );
}

// out-of-subset schema keyword -> check_connector_contract.js
// looseObject republishes the open-record shape the named stages replaced.
if (want('schema-out-of-subset')) {
  const d = mkenv(['scripts', 'references', 'mcp']);
  const f = path.join(d, 'mcp/schemas.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('.strictObject(')) throw new Error('faults: chain strictObject missing');
  fs.writeFileSync(f, src.replace('.strictObject(', '.looseObject('));
  record(
    'schema-out-of-subset -> check_connector_contract.js',
    gate(d, ['scripts/check_connector_contract.js']),
    /structural|additionalProperties|subset|exemption/i
  );
}

// false read-only claim -> check_connector_contract.js
if (want('annotation-lies')) {
  const d = mkenv(['scripts', 'references', 'mcp']);
  const f = path.join(d, 'mcp/tools.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('readOnlyHint: true')) throw new Error('faults: readOnlyHint missing');
  fs.writeFileSync(f, src.replace('readOnlyHint: true', 'readOnlyHint: false'));
  record(
    'annotation-lies -> check_connector_contract.js',
    gate(d, ['scripts/check_connector_contract.js']),
    /readOnly|idempotent|closed-world|annotation/i
  );
}

// invisible edits -> check_connector_contract.js
if (want('edit-invisible')) {
  const d = mkenv(['scripts', 'references', 'mcp']);
  const f = path.join(d, 'mcp/engine.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('if (changed) row.changed = changed;'))
    throw new Error('faults: changed assembly missing');
  fs.writeFileSync(f, src.replace('if (changed) row.changed = changed;', ''));
  record(
    'edit-invisible -> check_connector_contract.js',
    gate(d, ['scripts/check_connector_contract.js']),
    /changed|reported|visib/i
  );
}

// workspace leaks into the Gemini declarations -> check_connector_contract.js
//
// The adapter's whole job on this node is to DELETE it: `workspace.cards.items`
// is the empty schema node the catalog's 4051 part ids make untypeable, and an
// empty node is illegal for a restricted function-calling client. Point the
// removal at a property that does not exist and the node survives into the
// declarations — which the SUBSET scan above would never notice, because there
// the same node is a justified exemption. Distinct plant, distinct gate row.
if (want('gemini-workspace-leak')) {
  const d = mkenv(['scripts', 'references', 'mcp']);
  const f = path.join(d, 'mcp/gemini_tools.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes("export const WORKSPACE_PROPERTY = 'workspace';"))
    throw new Error('faults: WORKSPACE_PROPERTY declaration missing');
  fs.writeFileSync(
    f,
    src.replace(
      "export const WORKSPACE_PROPERTY = 'workspace';",
      "export const WORKSPACE_PROPERTY = 'workspace_not_a_property';"
    )
  );
  record(
    'gemini-workspace-leak -> check_connector_contract.js',
    gate(d, ['scripts/check_connector_contract.js']),
    /GEMINI-ILLEGAL|Gemini rejects|exposes `workspace`|flagged for injection/i
  );
}

// a keyword Gemini rejects survives the adapter -> check_connector_contract.js
//
// The sanitizer is an allowlist, so the way it breaks is by allowing too much.
// `additionalProperties` is the realistic one: it is present in the published
// schema (chain's strictObject) and exempted there on purpose, so admitting it
// to the allowlist republishes it to the one client that cannot read it.
if (want('gemini-illegal-keyword')) {
  const d = mkenv(['scripts', 'references', 'mcp']);
  const f = path.join(d, 'mcp/gemini_tools.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes("const GEMINI_KEYS = new Set([\n  'type',"))
    throw new Error('faults: GEMINI_KEYS allowlist missing');
  fs.writeFileSync(
    f,
    src.replace(
      "const GEMINI_KEYS = new Set([\n  'type',",
      "const GEMINI_KEYS = new Set([\n  'additionalProperties',\n  'type',"
    )
  );
  record(
    'gemini-illegal-keyword -> check_connector_contract.js',
    gate(d, ['scripts/check_connector_contract.js']),
    /GEMINI-ILLEGAL|Gemini rejects/i
  );
}

// a chain hit forgets its stage -> check_connector_contract.js
//
// The regression this guards is the one that cost a 14-call, 93k-token failure
// loop: search hands back a real chain id, the caller has to file it under one
// of eight stages, and nothing it can reach says which. Dropping the `stage`
// field restores exactly that.
if (want('chain-hit-stageless')) {
  const d = mkenv(['scripts', 'references', 'mcp']);
  const f = path.join(d, 'mcp/engine.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('stage: sec.id || sec.stage,'))
    throw new Error('faults: chain stage tagging missing');
  fs.writeFileSync(f, src.replace('stage: sec.id || sec.stage,', ''));
  record(
    'chain-hit-stageless -> check_connector_contract.js',
    gate(d, ['scripts/check_connector_contract.js']),
    /names a real stage|stage/i
  );
}

// a misfiled chain id gets a dead-end refusal -> check_connector_contract.js
if (want('chain-misfile-dead-end')) {
  const d = mkenv(['scripts', 'references', 'mcp']);
  const f = path.join(d, 'scripts/_workspace_ops.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('that id belongs to the')) throw new Error('faults: misfiled hint missing');
  fs.writeFileSync(
    f,
    src.replace(
      /other\n\s*\? `Unknown \$\{stage\} id: "\$\{candidate\}" — that id belongs[\s\S]*?\n\s*: `Unknown/,
      'false\n          ? ``\n          : `Unknown'
    )
  );
  record(
    'chain-misfile-dead-end -> check_connector_contract.js',
    gate(d, ['scripts/check_connector_contract.js']),
    /wrong stage|would take it/i
  );
}

// connector edits diverge from the app -> check_edit_parity.js
//
// The exact defect this gate was written for: set_variant as a bare field
// assignment, with no inverse cascade and no pin, while the browser reshapes the
// rest of the card around the same edit. It shipped that way, and every existing
// gate stayed green — check_app_parity.js compares SEED + RENDER, so an edit that
// diverges in between is invisible to it. Cutting the cascade back out restores
// precisely the code that was wrong.
if (want('connector-edit-divergence')) {
  const d = mkenv(['scripts', 'references', 'src', 'mcp']);
  const f = path.join(d, 'scripts/_workspace_ops.js');
  const src = fs.readFileSync(f, 'utf8');
  // Matched by shape, not by the exact argument list. This used to pin the
  // literal `{ pin: [partId] }`, which was the cascade's whole pin set at the
  // time — and then the pin set grew (accumulated part pins plus the frozen
  // environment axes) and this threw "set_variant cascade missing" against a
  // cascade that was right there. A fault class that breaks when the code it
  // guards is legitimately improved trains people to edit the fault, and the
  // thing it actually needs to find is the inverseConfigure call.
  const marker = /^ {2}const res = inverseConfigure\(card, target, \{ pin: .*\}\);$/m;
  const m = src.match(marker);
  if (!m) throw new Error('faults: set_variant cascade missing');
  const cut = src.indexOf(m[0]);
  const end = src.indexOf('\n  return next;\n}', cut);
  if (end < 0) throw new Error('faults: could not bound the set_variant cascade');
  fs.writeFileSync(f, src.slice(0, cut) + src.slice(end + 1));
  record(
    'connector-edit-divergence -> check_edit_parity.js',
    gate(d, ['scripts/check_edit_parity.js', '--limit=60']),
    /diverged|EDIT PARITY: FAIL/i
  );
}

// the icon set drifts from its declared source -> build_favicon.js --check
//
// The defect this catches is the one the repo shipped for real until the
// generator existed: edit the mark, and the PNGs beside it still show the old
// one, because nothing derived them and nothing compared them. The source is
// assets/icon-master.png since 2026-09-14, so repainting the master stands in
// for any edit: it must fail twice over — the master's own pinned hash, and the
// derived rasters that are a pure function of it.
if (want('favicon-raster-drift')) {
  const d = mkenv(['scripts', 'assets', 'favicon.ico', 'package.json']);
  const f = path.join(d, 'assets', 'icon-master.png');
  const before = fs.readFileSync(f);
  // A DIFFERENT valid image, not a corrupted one: a torn PNG would fail the
  // renderer and prove nothing about the comparison this gate exists to make.
  fs.copyFileSync(path.join(d, 'assets', 'icon-512.png'), f);
  if (fs.readFileSync(f).equals(before)) throw new Error('faults: icon master unchanged');
  record(
    'favicon-raster-drift -> build_favicon.js',
    gate(d, ['scripts/build_favicon.js', '--check']),
    /not what this script declares|assets:favicon/i
  );
}

// a build input falls outside the closure -> check_build_closure.js
//
// The CI scope step skips the 30-minute rebuild when no changed path is in the
// artifact build closure. If a real build input is ever classified inert, that
// skip fires on a diff that needed the rebuild and a stale artifact ships with
// every other gate green — the failure this repo has already had twice.
//
// So plant exactly that: widen an inert rule to swallow scripts/, which is where
// eleven real inputs live. Nothing about the build changes; only the classifier
// lies. Caught only by the trace — no static review of the rule would notice,
// which is why the gate runs a real build instead of reading its own list.
if (want('build-input-outside-closure')) {
  // build_discovery.js refuses to emit a sitemap URL with no file behind it, so
  // the staged tree needs every ENTRY_POINTS target (build_discovery.js:169) —
  // it only stats them, never reads them, which is also why editing a .md
  // cannot move sitemap.xml and the docs-only skip was sound to begin with.
  const d = mkenv([
    'scripts',
    'references',
    'src',
    'mcp',
    'api',
    'package.json',
    'index.html',
    'codex.html',
    'AGENTS.md',
    'SKILL.md',
    'server.json',
  ]);
  const f = path.join(d, 'scripts/_build_closure.js');
  const src = fs.readFileSync(f, 'utf8');
  const marker = "if (p.startsWith('scripts/')) {";
  if (!src.includes(marker)) throw new Error('faults: _build_closure.js scripts branch not found');
  fs.writeFileSync(
    f,
    src.replace(
      marker,
      `${marker}\n    return { kind: 'inert', why: 'FAULT: scripts are never inputs' };`
    )
  );
  record(
    'build-input-outside-closure -> check_build_closure.js',
    gate(d, ['scripts/check_build_closure.js']),
    /classified inert|outside the closure/i
  );
}

// a corrupt spend file hands budget back -> mcp/test.mjs
//
// mcp/spend_store.js reads the daily spend counters from disk when the
// deployment has somewhere to keep them. That file is the ONE input that can
// RAISE the remaining budget, so invalid counters close admission on read.
// Drop that rejection and a negative `usd` — from a truncated write, a
// half-flushed crash, or anyone who can touch the disk —
// restores budget that was already spent, and the cap silently stops capping.
//
// Planted by removing the invalid-counter rejection after JSON parsing, which
// restores the old "just parse the JSON" failure mode. Anchor on the rejection
// itself rather than the former numeric-clamping helper.
if (want('corrupt-spend-file-widens-cap')) {
  // test.mjs calls the same exported assertion. Its standalone runner keeps
  // the baseline and mutant focused on disk validation: the full MCP suite
  // exercises long kitchen runs and exceeds the gate's five-minute bound.
  const d = mkenv(['mcp']);
  const args = ['mcp/test_spend_store.mjs'];
  const baseline = gate(d, args);
  if (baseline.code !== 0)
    throw new Error(
      `faults: unmutated spend-store check failed (${baseline.code}):\n${baseline.out}`
    );
  const f = path.join(d, 'mcp/spend_store.js');
  const src = fs.readFileSync(f, 'utf8');
  const marker = "throw new Error('invalid spend counters');";
  if (src.split(marker).length !== 2)
    throw new Error('faults: unique spend_store invalid-counter rejection not found');
  fs.writeFileSync(f, src.replace(marker, '// FAULT: accept parsed counters without validation.'));
  record(
    'corrupt-spend-file-widens-cap -> mcp/test.mjs',
    gate(d, args),
    /invalid counters disable paid admission/
  );
}

// the connector cascades where the browser does not -> check_edit_parity.js
//
// A variant pick takes one of two paths in the browser (src/app.js:applyPartEdit):
// a MATERIAL part runs the full inverse cascade, anything else re-derives the
// preface and stops. Only 354 of 1406 instruments have a material part, so the
// second path is the common one.
//
// This is the defect the repo actually shipped: _workspace_ops.setVariant
// cascaded unconditionally, and BOTH parity gates missed it because they called
// reconfigureAfterPartEdit directly — reaching past the guard, comparing cascade
// against cascade, and agreeing. Measured at the time: 66 of 1321 single-variant
// edits rendered a different recipe across the two surfaces.
//
// Planted by neutering the guard, which is exactly the prior state.
if (want('connector-cascades-where-app-does-not')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'scripts/_workspace_ops.js');
  const src = fs.readFileSync(f, 'utf8');
  const marker = '  if (!isMaterialPart) {';
  if (!src.includes(marker)) throw new Error('faults: setVariant material guard not found');
  fs.writeFileSync(f, src.replace(marker, '  if (false) {'));
  record(
    'connector-cascades-where-app-does-not -> check_edit_parity.js',
    gate(d, ['scripts/check_edit_parity.js']),
    /diverged in card state|post-edit render\(s\) diverged/i
  );
}

// one renderer fork drifts from the other -> check_edit_differential.js
//
// The two engines carry duplicate renderers, and the whole risk of that fork is
// a change landing in one copy and not the other. This plants exactly that: put
// the Node engine's environment lookup back to the unconditional cards[0] while
// src/app.js keeps envCardOf.
//
// The plant is invisible to the single-action matrix — check_edit_parity edits
// ONE freshly seeded card, whose cards[0] always carries a tradition's
// environment, so both spellings agree there. It only shows up in a composed
// state (add a bare instrument, drop the tradition that seeded the workspace),
// which is the space this harness explores and the matrix cannot enumerate.
// That is the point of having both gates, so the plant is chosen to separate
// them rather than to be caught by either.
if (want('renderer-fork-drift')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'scripts/_recipe_stack.js');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('buildStackParts(envCardOf(cards))'))
    throw new Error('faults: _recipe_stack.js env lookup not found');
  fs.writeFileSync(
    f,
    src.replace(/buildStackParts\(envCardOf\(cards\)\)/g, 'buildStackParts(cards[0])')
  );
  record(
    'renderer-fork-drift -> check_edit_differential.js',
    gate(d, ['scripts/check_edit_differential.js']),
    /bytes differ|divergence/i
  );
}

// stdout truncated by process.exit -> check_cli_output.js
//
// The defect this plants is one line: restore the process.exit(0) that used to
// end list.js's --traditions branch. Nothing about the output changes when the
// command is run normally, redirected to a file, or watched in a terminal —
// only when stdout is a pipe whose reader has not drained it yet, which is when
// Node discards the queue it never got to write. Before the fix that cost 989
// of 2503 entries at exit 0.
//
// Scoped with --only so the class costs one command rather than all 33, and
// pinned to ~~--traditions because it is the mode whose 227KB is far enough
// past the 64KB pipe buffer for the loss to be unambiguous~~ `--traditions
// --json`, the 4MB mode: the child's stdout is a socketpair that holds ~208KB
// unread (M-282 addendum 2, measured), so 227KB can fit whole and the plant on
// the plain mode could exit having dropped nothing -- the same misfire that
// turned CI red in the other direction. 4MB cannot fit on any default kernel.
if (want('stdout-truncated-by-exit')) {
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'scripts/list.js');
  const src = fs.readFileSync(f, 'utf8');
  const at = src.indexOf('flags.parent;');
  const tail = '    console.log(JSON.stringify(filtered, null, 2));\n    return;';
  const hit = at < 0 ? -1 : src.indexOf(tail, at);
  if (hit < 0) throw new Error('faults: list.js --traditions --json tail not found');
  fs.writeFileSync(
    f,
    src.slice(0, hit) + tail.replace(/return;$/, 'process.exit(0);') + src.slice(hit + tail.length)
  );
  record(
    'stdout-truncated-by-exit -> check_cli_output.js',
    gate(d, ['scripts/check_cli_output.js', '--only=scripts/list.js --traditions --json']),
    /LOST \d+b of \d+b through the pipe|EXITED while its output was still unread/i
  );
}

// the ask bar's counter names its own ceiling -> check_chat_counter.js
//
// The counter exists because `maxlength` is a silent wall — the field simply
// stops accepting keystrokes — and its one hard requirement is that it read the
// ceiling off the attribute instead of restating it. The attribute is already
// pinned to the server's CHAT_MAX_MESSAGE by mcp/test.mjs, so sourcing it from
// the DOM keeps one number in one place across three files.
//
// Planted as `const max = 5000;` — the shape a well-meaning edit takes, since
// 5000 is the correct value TODAY and the diff looks like a no-op. It is not:
// it survives the next raise, and the counter then confidently reports the old
// ceiling while the field enforces the new one. A counter that lies is worse
// than no counter, because it turns "I wonder why it stopped" into a wrong
// answer the user believes.
if (want('chat-counter-restates-ceiling')) {
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'src/app.js');
  const src = fs.readFileSync(f, 'utf8');
  const marker = '  const max = input.maxLength;';
  if (!src.includes(marker)) throw new Error('faults: chat counter ceiling read not found');
  fs.writeFileSync(f, src.replace(marker, '  const max = 5000;'));
  record(
    'chat-counter-restates-ceiling -> check_chat_counter.js',
    gate(d, ['scripts/check_chat_counter.js']),
    /naming a ceiling of its own/i
  );
}

// 36-38. The shared UI foundation -> check_ui_foundation.js. Each plant goes into a
//     copy of the BUILT page, because the gate drives what ships. The map needs
//     the atlas, its sidecars and the tile pyramid; those are read-only here, so
//     they are linked rather than copied (assets/ alone is ~155 MB).
function foundationEnv() {
  const d = mkenv(['scripts', 'codex.html', 'src', 'atlas.html']);
  for (const dir of ['api', 'assets', 'data', 'references'])
    fs.symlinkSync(path.join(ROOT, dir), path.join(d, dir));
  return d;
}
//   (a) THE FLASH THE BOOT EXISTS TO PREVENT. The theme is applied, just after
//       the page has parsed — which is exactly how a boot moved to the end of
//       <body>, or into the app's init, would behave. The page ends up in the
//       right theme, so a screenshot taken after load cannot tell; only the
//       moment <body> appears can.
if (want('36', 'theme-after-first-paint')) {
  const d = foundationEnv();
  const f = path.join(d, 'codex.html');
  const before = fs.readFileSync(f, 'utf8');
  const setter = 'root.setAttribute("data-theme",theme);';
  const after = before.replace(
    setter,
    '/* __THEME_FAULT__ */document.addEventListener("DOMContentLoaded",function(){root.setAttribute("data-theme",theme)});'
  );
  if (after === before) throw new Error('faults: theme boot setter not found in codex.html');
  fs.writeFileSync(f, after);
  record(
    'theme-after-first-paint -> check_ui_foundation.js',
    gate(d, ['scripts/check_ui_foundation.js']),
    /not applied before first paint/
  );
}
//   (b) THE MAP WITHOUT THE RECIPE. Until the foundation, the Map view hid the
//       recipe panel at desktop width and offered nothing to open it. Put that
//       back and the one-workspace promise is false on one of its three pages.
if (want('37', 'map-loses-recipe')) {
  const d = foundationEnv();
  const f = path.join(d, 'codex.html');
  const before = fs.readFileSync(f, 'utf8');
  const after = before.replace(
    '</body>',
    "<style>/* __RECIPE_FAULT__ */ .workbench[data-view='map'] .workspace #workspace-sidebar { display: none !important; }</style>\n</body>"
  );
  if (after === before) throw new Error('faults: could not inject into codex.html');
  fs.writeFileSync(f, after);
  record(
    'map-loses-recipe -> check_ui_foundation.js',
    gate(d, ['scripts/check_ui_foundation.js']),
    /Your recipe is not reachable on the map page/
  );
}
//   (c) THE INVISIBLE UNDO. A toast's action button used to stay in the faded
//       toast: opacity 0, still a target, so a later click at bottom centre ran
//       Undo (or Retry) unseen. Both halves of the fix go — the button is kept
//       when the toast hides, and nothing stops it taking the click.
if (want('38', 'toast-action-lingers')) {
  const d = foundationEnv();
  const f = path.join(d, 'codex.html');
  const before = fs.readFileSync(f, 'utf8');
  const removal = 't.querySelector(".toast-action")?.remove()';
  if (!before.includes(removal))
    throw new Error('faults: toast action removal not found in codex.html');
  const after = before
    .replace(removal, 'void 0 /* __TOAST_FAULT__ */')
    .replace(
      '</body>',
      '<style>/* __TOAST_FAULT__ */ #toast .toast-action { visibility: visible !important; pointer-events: auto !important; }</style>\n</body>'
    );
  fs.writeFileSync(f, after);
  record(
    'toast-action-lingers -> check_ui_foundation.js',
    gate(d, ['scripts/check_ui_foundation.js']),
    /Undo of a faded toast still takes a click/
  );
}

// Registry-driven completeness: every promise-bound gate (_promises.js) must have
// a fault class here, or "every gate is two-sided" is hollow. faults.js itself is
// exempt (it is the injector); check_artifact_fresh's faults need --fresh-*, so
// completeness is only asserted on a full run (CI passes --fresh-api/--fresh-html,
// and no --only).
if (ONLY) {
  const unknown = ONLY.filter((id) => !CLASS_IDS.has(id));
  if (unknown.length || !results.length) {
    console.error(
      unknown.length
        ? `faults: --only names no class: ${unknown.join(', ')} (a class answers to its number and its gate-class name)`
        : `faults: --only=${ONLY.join(',')} selected no class that could run here (class 6 and 6b need --fresh-api/--fresh-html)`
    );
    process.exit(2);
  }
}
let uncovered = [];
if (FRESH_API && FRESH_HTML && !ONLY) {
  const PROMISES = require('./_promises.js');
  const faulted = new Set(results.map((r) => r.cls.split('->').pop().trim()));
  uncovered = [...new Set(PROMISES.map((p) => p.gate))].filter(
    (g) => g !== 'faults.js' && !faulted.has(g)
  );
}

const escaped = results.filter((r) => !r.caught);
console.log(
  `\n=== Fault injection: ${results.length} gate-class(es) tested, ${escaped.length} escape(s) ===`
);
if (escaped.length === 0 && uncovered.length === 0) {
  console.log(
    FRESH_API && FRESH_HTML && !ONLY
      ? 'PASS — every injected defect was caught AND every promise-bound gate has a fault class. All gates are two-sided.'
      : ONLY
        ? `PASS — every injected defect was caught (partial run: --only=${ONLY.join(',')}).`
        : 'PASS — every injected defect was caught (partial run; pass --fresh-api/--fresh-html to also assert gate-coverage completeness).'
  );
  process.exit(0);
}
if (escaped.length) {
  console.error(
    'FAIL — these gate-classes did not catch their planted defect for the right reason:'
  );
  for (const e of escaped) console.error(`  ✗ ${e.cls}  [${e.reason}]`);
  console.error(
    '  (ESCAPED = gate passed; TIMEOUT = gate hung; WRONG-REASON = failed but not on the planted defect; BASELINE-OVER = the unplanted page already fails the budget gate, so nothing could be planted)'
  );
}
if (uncovered.length) {
  console.error(
    `FAIL — ${uncovered.length} promise-bound gate(s) have NO fault class, so "every gate is two-sided" is unproven for them:`
  );
  for (const g of uncovered) console.error(`  ✗ ${g}  (add a fault class in faults.js)`);
}
process.exit(1);
