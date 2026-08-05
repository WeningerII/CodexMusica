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
if (FRESH_API && FRESH_HTML) {
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
{
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

// 23. A foreign tradition's NAME reaches the picks -> check_name_isolation.js
// The exact regression this gate exists for. buildContext takes
// { includeName: false } so that neighbor-bias and hill-climbed staples read what
// a neighbouring tradition SOUNDS like and not what it is CALLED. Restore the
// name and the coupling comes straight back: a sibling's label becomes prose
// tokens in the focal tradition's scoring context, and gear descriptors collect
// bonuses from words that were never claims about sound. This is a one-word
// defect (`false` -> `true`) with catalog-wide reach, which is exactly the kind
// a reviewer waves through.
{
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
{
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

// Connector contract classes. These stage `mcp` (see mkenv: source copied,
// node_modules symlinked) because the gate drives a real in-memory MCP client
// rather than compiling the schemas itself.

// chain shape validation -> check_workspace_ops.js
// Disabling the multi-select branch is exactly the state the fx-corruption bug
// shipped in: a bare id written straight through, to be spread into characters
// by the next clone.
{
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
{
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
{
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
{
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
{
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
{
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
{
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
{
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
{
  const d = mkenv(['scripts', 'references', 'src', 'mcp']);
  const f = path.join(d, 'scripts/_workspace_ops.js');
  const src = fs.readFileSync(f, 'utf8');
  const marker = '  const res = inverseConfigure(card, target, { pin: [partId] });';
  if (!src.includes(marker)) throw new Error('faults: set_variant cascade missing');
  const cut = src.indexOf(marker);
  const end = src.indexOf('\n  return next;\n}', cut);
  if (end < 0) throw new Error('faults: could not bound the set_variant cascade');
  fs.writeFileSync(f, src.slice(0, cut) + src.slice(end + 1));
  record(
    'connector-edit-divergence -> check_edit_parity.js',
    gate(d, ['scripts/check_edit_parity.js', '--limit=60']),
    /diverged|EDIT PARITY: FAIL/i
  );
}

// icon rasters drift from favicon.svg -> build_favicon.js --check
//
// The defect this catches is the one the repo shipped for real until the
// generator existed: edit the mark, and the six PNGs beside it still show the
// old one, because nothing derived them and nothing compared them. Recoloring
// the SVG stands in for any edit — every raster is a pure function of it.
{
  const d = mkenv(['scripts', 'assets', 'favicon.svg', 'package.json']);
  const f = path.join(d, 'favicon.svg');
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('#ee1111')) throw new Error('faults: favicon fill missing');
  fs.writeFileSync(f, src.replace(/#ee1111/g, '#00aa00'));
  record(
    'favicon-raster-drift -> build_favicon.js',
    gate(d, ['scripts/build_favicon.js', '--check']),
    /do not match favicon\.svg|assets:favicon/i
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
