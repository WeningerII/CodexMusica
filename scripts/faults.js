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
//   app<->connector     -> check_app_parity.js   (connector render drifts from the app)
//   preface drift       -> regression_prefaces.js (matcher output drifts from fixtures)
//   slot-pick drift     -> check_slot_picks.js    (searched slot drifts from lock-ins)
//   dead audit token    -> audit_dead_tokens.js   (token dead even in the enriched pool)
//   workspace mutation  -> check_workspace_ops.js (an edit op mutates its input ws)
//   stale voice-parts   -> _gen_voice_parts.js --check (Node voice maps drift from src/app.js)
//   drifted frozen DF   -> build_descriptor_df.js --check (app.js DF block != the JSON)
//   stale frozen DF     -> build_descriptor_df.js --check (the freeze fell behind the catalog)
//
// Usage:
//   node scripts/faults.js [--fresh-api=DIR --fresh-html=FILE] [--verbose]
// Exit 0 if every defect was caught, 1 if any gate escaped.

'use strict';
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
const FRESH_API = flags['fresh-api'] ? path.resolve(ROOT, flags['fresh-api']) : null;
const FRESH_HTML = flags['fresh-html'] ? path.resolve(ROOT, flags['fresh-html']) : null;
const q = (s) => JSON.stringify(s);

// Isolated temp copy of just the items a gate needs; node_modules is symlinked.
function mkenv(items) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-fault-'));
  for (const it of items) execSync(`cp -a ${q(path.join(ROOT, it))} ${q(path.join(d, it))}`);
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

const results = [];
// A defect is "caught" only when the gate exits NON-ZERO *and* its output names
// the planted defect (the `expect` pattern). This rejects two false positives the
// old `code !== 0` test counted as caught: a gate that times out, and a gate that
// fails for an unrelated reason (env crash, missing file in the temp copy).
function record(cls, res, expect) {
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
  process.stderr.write(`  ${tag}  ${cls}  (exit ${code})\n`);
}

process.stderr.write(
  'Injecting one defect per gate-class (isolated temp copies; real tree untouched)…\n'
);

// 1. broken ref -> validate.js
{
  const d = mkenv(['scripts', 'references']);
  const f = path.join(d, 'references/05_traditions.js');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace("room: '", "room: 'zzz_fault_"));
  record('broken-ref -> validate.js', gate(d, ['scripts/validate.js']), /zzz_fault|BROKEN_REF/i);
}

// 2. >1000-char recipe -> check_api.js
{
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
{
  const d = mkenv(['scripts', 'references', 'api']);
  fs.unlinkSync(path.join(d, 'api/traditions/zydeco.json'));
  record(
    'dropped-tradition -> check_api.js',
    gate(d, ['scripts/check_api.js']),
    /zydeco|missing|count/i
  );
}

// 4. unresolvable config id (stale snapshot vs catalog) -> check_api.js
{
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
{
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
if (FRESH_API && FRESH_HTML) {
  const d = mkenv(['scripts', 'references', 'api']);
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
} else {
  process.stderr.write(
    '  - skipped stale-api fault (pass --fresh-api=DIR --fresh-html=FILE to enable)\n'
  );
}

// 6b. stale codex.html (committed != fresh build) -> check_artifact_fresh.js
//     Class 6 mutates only api/ and passes the SAME file as committed+prebuilt
//     html, so the codex.html half of the gate was never exercised. This proves
//     it two-sided: the api halves match (fresh==fresh) while the committed html
//     is a mutated copy, so only an unguarded html comparison could stay green.
if (FRESH_API && FRESH_HTML) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-fault-html-'));
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
record(
  'silent-blend-drop -> recipe.js',
  gate(ROOT, ['scripts/recipe.js', '--traditions', 'afrobeat,__bogus_fault__']),
  /__bogus_fault__|[Uu]nknown|not found|resolve/
);

// 8. orphan promise (documented but unregistered/ungated) -> check_promises.js
{
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
//    lazy one reads api/browse.json through the fetch shim. Corrupting one
//    tradition's name in the isolated browse.json forces the two builds to
//    disagree on the catalog projection, which the parity gate must catch.
{
  const d = mkenv(['scripts', 'references', 'src', 'api']);
  const f = path.join(d, 'api/browse.json');
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  j.items[0].name = (j.items[0].name || '') + ' __FAULT__';
  fs.writeFileSync(f, JSON.stringify(j, null, 2));
  record(
    'lazy-shell-desync -> check_lazy_app.js',
    gate(d, ['scripts/check_lazy_app.js']),
    /__FAULT__|drift|projection|LAZY-APP: FAIL/i
  );
}

// 10. doc count drift -> check_docs.js  (a canonical count in the docs no longer
//     matches the live catalog — the class that shipped stale AGENTS/SKILL counts)
{
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
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('1167-tradition', '1166-tradition'));
  record(
    'count-drift -> check_docs.js',
    gate(d, ['scripts/check_docs.js']),
    /1166|1167|drift|mismatch|count|expected/i
  );
}

// 11. a documented command that no longer exits 0 -> check_doc_commands.js
{
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

// 12. a documented BEHAVIOR drifts from the prose -> check_doc_behaviors.js
//     (corrupt belting's documented §3d token list — the assertion must catch it)
{
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
{
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
{
  const d = mkenv(['scripts', 'references', 'src']);
  const f = path.join(d, 'scripts/_seed_workspace.js');
  fs.writeFileSync(
    f,
    fs
      .readFileSync(f, 'utf8')
      .replace('return header + body;', "return header + body + ' __PARITY_FAULT__';")
  );
  record(
    'app-connector-parity-drift -> check_app_parity.js',
    gate(d, ['scripts/check_app_parity.js', '--limit=30']),
    /__PARITY_FAULT__|mismatch|FAIL/i
  );
}

// 15. preface assignment drift -> regression_prefaces.js  (corrupt one fixture's
//     expected preface so the matcher's real output no longer matches it)
{
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
{
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
{
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
{
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
{
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
{
  const d = mkenv(['scripts', 'codex.html', 'api']);
  const f = path.join(d, 'codex.html');
  const before = fs.readFileSync(f, 'utf8');
  const after = before.replace(
    '</body>',
    '<style>/* __MOBILE_FAULT__ */ .app-bar .actions { min-width: 720px !important; }</style>\n</body>'
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
{
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
{
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

// Registry-driven completeness: every promise-bound gate (_promises.js) must have
// a fault class here, or "every gate is two-sided" is hollow. faults.js itself is
// exempt (it is the injector); check_artifact_fresh's faults need --fresh-*, so
// completeness is only asserted on a full run (CI passes --fresh-api/--fresh-html).
let uncovered = [];
if (FRESH_API && FRESH_HTML) {
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
    FRESH_API && FRESH_HTML
      ? 'PASS — every injected defect was caught AND every promise-bound gate has a fault class. All gates are two-sided.'
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
    '  (ESCAPED = gate passed; TIMEOUT = gate hung; WRONG-REASON = failed but not on the planted defect)'
  );
}
if (uncovered.length) {
  console.error(
    `FAIL — ${uncovered.length} promise-bound gate(s) have NO fault class, so "every gate is two-sided" is unproven for them:`
  );
  for (const g of uncovered) console.error(`  ✗ ${g}  (add a fault class in faults.js)`);
}
process.exit(1);
