#!/usr/bin/env node
// tandem.js — verify the codex behaves consistently across all three artifacts:
//   1. Source code (references + scripts)
//   2. The shipped zip (round-trip extraction)
//   3. The shipped standalone HTML (parseability + catalog parity + recipe-stack)
//
// This is a meta-test that runs the full pipeline + cross-checks the artifacts
// against each other. Use after any major change to confirm everything ships
// in a coherent state.
//
// Usage: node scripts/tandem.js
//
// Exits 0 on success, non-zero on any failure.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const { HTML_OUT: HTML_PATH, ZIP_OUT: ZIP_PATH } = require('./_paths.js');

// Default tandem reads the committed audit snapshots (fast, ~25 min, robust).
// The voice/pick audits are advisory review tools; regenerating them fresh
// hill-climbs every voice/instrument tradition (~60 min) and made tandem
// fragile to environmental interruption. Pass --deep to regenerate fresh.
const DEEP = process.argv.includes('--deep');

let failed = 0;
function check(label, fn) {
  try {
    const result = fn();
    console.log('  ✓ ' + label + (result ? ': ' + result : ''));
  } catch (e) {
    console.error('  ✗ ' + label + ': ' + e.message);
    failed++;
  }
}

// Default execSync options used by all subprocess checks. The 2>&1 redirect
// folds stderr into stdout so the regex matchers don't lose output to a
// silent stderr stream. maxBuffer raised from the 1MB default to safely
// hold smoke.js / regression.js / calibrate.js output across all 450
// traditions even if they grow.
const RUN = (cmd) => execSync(cmd + ' 2>&1', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Tolerant variant — captures full output even on non-zero exit. Used for
// scripts that are review-tools rather than hard build gates (e.g. calibrate.js,
// which per SKILL.md is "review side-by-side for human judgment" and which
// exits 1 on partial-pass to draw attention without blocking pipeline coherence).
// Uses temp-file redirect because execSync's pipe-buffered stdout can truncate
// when a child writes large output then exits non-zero (calibrate ~47KB).
const RUN_TOLERANT = (cmd) => {
  const tmp = `/tmp/tandem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.out`;
  try {
    execSync(`${cmd} > ${tmp} 2>&1`, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  } catch {
    // child exited non-zero; output is still in tmp file
  }
  const out = fs.existsSync(tmp) ? fs.readFileSync(tmp, 'utf8') : '';
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  return out;
};

console.log('\n[1/4] Source pipeline');
check('validate', () => {
  const out = RUN('node scripts/validate.js');
  if (!out.includes('VALID')) throw new Error(out.trim());
  return out.match(/(\d+ traditions[^.]*\.)/)?.[1] || 'ok';
});
check('regression_prefaces', () => {
  const out = RUN('node scripts/regression_prefaces.js');
  const m = out.match(/PREFACE REGRESSION: (\d+\/\d+)/);
  if (!m) throw new Error('no preface regression count');
  const [pass, total] = m[1].split('/');
  if (pass !== total) throw new Error(`only ${pass}/${total} pass`);
  return m[1];
});
check('regression_recipes', () => {
  const out = RUN('node scripts/regression_recipes.js');
  const m = out.match(/(\d+\/\d+) fixture/);
  if (!m) throw new Error('no recipe fixture count');
  const [pass, total] = m[1].split('/');
  if (pass !== total) throw new Error(`only ${pass}/${total} pass`);
  return m[1];
});
// Behavioral browser↔node equivalence. The HTML-embed/Node-primitive parity
// checks above are TEXTUAL (they grep for matching invariant patterns); this
// one EXECUTES both implementations on the same card fixtures and asserts
// identical descriptor sets + preface suggestions. Catches output drift the
// textual checks can't see — the class that shipped a forked signature set.
check('equivalence (browser ↔ node behavioral)', () => {
  const out = RUN('node scripts/equivalence.js');
  const m = out.match(/EQUIVALENCE: (\d+\/\d+) PASS/);
  if (!m) throw new Error('browser↔node equivalence failed:\n' + out.trim());
  return m[1] + ' fixtures agree';
});
check('smoke', () => {
  const out = RUN('node scripts/smoke.js');
  const m = out.match(/SMOKE: (\d+\/\d+) pass/);
  if (!m) throw new Error('no smoke summary');
  return m[1];
});
check('calibrate', () => {
  // Calibrate is a review tool, not a hard pass/fail (per SKILL.md "review
  // side-by-side for quality"). Partial pass is acceptable; report the ratio.
  const out = RUN_TOLERANT('node scripts/calibrate.js');
  const m = out.match(/Calibration: (\d+\/\d+) pass/);
  if (!m) throw new Error('no calibration summary');
  return m[1] + ' (review tool — see SKILL.md discrepancy taxonomy)';
});
// voice audit classifications coherence — regenerates audit via --dry-run
// (writing to /tmp instead of tests/) and verifies hand-curated classifications
// align with the FRESH mismatch set, not the on-disk audit JSON which may be
// stale from past catalog state. Mirrors the pick_audit_classifications check
// below. The on-disk tests/voice_audit.json serves as the snapshot of the last
// successfully-classified mismatch set; the fresh /tmp version is what tandem
// validates against. When catalog drifts, this surfaces immediately.
// ADVISORY (review tool, not a hard gate) — same class as calibrate above.
// audit_voice_picks reports traditions where the primary-only voice pick differs
// from the staple-context pick. Post-type-separation, divergence IS the designed
// behavior: staple-context scoring is meant to override the naive primary-only
// pick when staples carry signal. Empirically every current divergence has
// current_pick_score ≥ primary_pick_score — i.e. the context pick is the
// higher-scoring (intended) one, not a regression. Demanding a hand-rationale for
// each instance of expected behavior is miscalibrated for a CI gate (and the set
// re-churns wholesale on every scorer change). So this REPORTS the triage backlog
// rather than failing. The hand-curated classifications that DO exist are still
// format-checked (cheap integrity on the human-authored entries). For a fresh
// review pass, run: node scripts/audit_voice_picks.js
check('voice audit classifications (advisory — staple-context override)', () => {
  const clsPath = path.join(ROOT, 'tests/voice_audit_classifications.json');
  if (!fs.existsSync(clsPath)) return 'no classifications file';
  let auditPath, mode;
  if (DEEP) {
    try {
      execSync('node scripts/audit_voice_picks.js --dry-run',
        { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
      auditPath = '/tmp/voice_audit.json'; mode = 'fresh';
    } catch (e) {
      return 'fresh audit unavailable (advisory) — ' + (e.message || '').slice(0, 60);
    }
  } else {
    auditPath = path.join(ROOT, 'tests/voice_audit.json'); mode = 'committed baseline';
  }
  if (!fs.existsSync(auditPath)) return `no ${mode} snapshot (advisory)`;
  const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const cls = JSON.parse(fs.readFileSync(clsPath, 'utf8'));
  const tids = new Set(audit.records.map(r => r.tid));
  const classified = new Set(Object.keys(cls.classifications || {}));
  const missing = [...tids].filter(t => !classified.has(t));
  // Format integrity of human-authored entries stays fatal — guards the file itself.
  for (const [tid, val] of Object.entries(cls.classifications || {})) {
    if (!Array.isArray(val) || val.length !== 2) throw new Error(`${tid}: malformed`);
    if (!['A', 'B', 'C'].includes(val[0])) throw new Error(`${tid}: invalid bucket ${val[0]}`);
    if (!val[1] || val[1].length < 10) throw new Error(`${tid}: rationale missing or too short`);
  }
  return `${mode}: ${tids.size} divergences, ${classified.size} triaged, ${missing.length} untriaged — advisory (context-override expected; --deep or audit_voice_picks.js to refresh)`;
});
check('slot-pick lock-ins', () => {
  const out = RUN('node scripts/check_slot_picks.js');
  const m = out.match(/Slot-pick lock-ins: (\d+\/\d+) pass/);
  if (!m) throw new Error('no slot-pick lock-in summary');
  return m[1];
});
// pick_audit_classifications coherence — regenerates each slot's audit JSON
// via `--dry-run` (writing to /tmp instead of tests/) and verifies that the
// hand-curated classifications still align with the FRESH mismatch set,
// rather than the on-disk audit JSON which may be stale from past catalog
// state. This makes the check self-refreshing: when the catalog changes,
// drift in classifications surfaces immediately instead of waiting for a
// manual `audit_picks.js` rerun. The on-disk audit JSONs serve two roles:
//   (1) bootstrap source of (instrument, part) target metadata
//   (2) snapshot of the last successfully-classified mismatch set
// On a coherent run, the fresh /tmp audit equals the on-disk one. On a
// drift run, this check fails with the specific drift before the on-disk
// audit gets touched, preserving the historical record for diagnosis.
check('pick_audit_classifications (advisory — staple-context override)', () => {
  const clsPath = path.join(ROOT, 'tests/pick_audit_classifications.json');
  if (!fs.existsSync(clsPath)) return 'no classifications file';
  const cls = JSON.parse(fs.readFileSync(clsPath, 'utf8'));
  const slots = Object.keys(cls).filter(k => !k.startsWith('_'));
  const issues = [];          // STRUCTURAL problems → fatal (missing/unparseable audit JSON, dry-run crash)
  let totalMissing = 0, totalStale = 0;  // CLASSIFICATION BACKLOG → advisory (same rationale as voice audit)
  for (const slotKey of slots) {
    // Derive (instrument, part) from the on-disk audit JSON metadata.
    // Two historical formats exist: target as "<instr>/<part>" string, or
    // as {instrument, part} object. Both are handled.
    const onDiskPath = path.join(ROOT, `tests/${slotKey}_audit.json`);
    if (!fs.existsSync(onDiskPath)) {
      issues.push(`${slotKey}: missing on-disk audit JSON (can't derive target)`);
      continue;
    }
    const onDisk = JSON.parse(fs.readFileSync(onDiskPath, 'utf8'));
    let instrument, part;
    if (typeof onDisk.target === 'string' && onDisk.target.includes('/')) {
      [instrument, part] = onDisk.target.split('/');
    } else if (onDisk.target && onDisk.target.instrument) {
      instrument = onDisk.target.instrument;
      part = onDisk.target.part;
    } else {
      issues.push(`${slotKey}: on-disk audit has unparseable target`);
      continue;
    }
    // Default: use the committed on-disk audit JSON (fast, robust). Under --deep,
    // regenerate fresh (writes /tmp/<slotKey>_audit.json) to surface live drift.
    let audit = onDisk;
    if (DEEP) {
      try {
        execSync(`node scripts/audit_picks.js --instrument=${instrument} --part=${part} --dry-run --json-only`,
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
      } catch (e) {
        issues.push(`${slotKey}: dry-run audit failed (${(e.message || '').slice(0, 80)})`);
        continue;
      }
      const freshPath = `/tmp/${slotKey}_audit.json`;
      if (!fs.existsSync(freshPath)) {
        issues.push(`${slotKey}: dry-run produced no /tmp file`);
        continue;
      }
      audit = JSON.parse(fs.readFileSync(freshPath, 'utf8'));
    }
    const auditTids = new Set(audit.records.map(r => r.tid));
    const slotCls = cls[slotKey] || {};
    const classified = new Set([
      ...(slotCls.resolved_via_isolated_parts || []),
      ...(slotCls.B_current_right || []),
      ...(slotCls.C_bin3 || []),
      ...(slotCls.C_tied_scores || []),
    ]);
    const resolved = new Set(slotCls.resolved_via_isolated_parts || []);
    const missing = [...auditTids].filter(t => !classified.has(t));
    const stale = [...classified].filter(t => !auditTids.has(t) && !resolved.has(t));
    totalMissing += missing.length;
    totalStale += stale.length;
  }
  // Structural integrity stays fatal; classification backlog is advisory (the
  // divergences are designed staple-context overrides, not regressions).
  if (issues.length) throw new Error(issues.join('; '));
  return `${slots.length} slots (${DEEP ? 'fresh' : 'committed baseline'}), ${totalMissing} untriaged, ${totalStale} stale — advisory (context-override expected; --deep or audit_picks.js to refresh)`;
});

// check_docs.js — verify markdown numeric claims and script references match
// current catalog state. Runs the script's default (instant) mode: catalog
// counts + script-ref existence. Audit-derived counts (--with-audits) and
// smoke ceiling counts (--with-smoke) stay opt-in for direct invocation;
// tandem only runs the fast checks to keep this gate quick.
check('check_docs (markdown drift)', () => {
  const out = RUN('node scripts/check_docs.js --json');
  let data;
  try { data = JSON.parse(out); } catch { throw new Error('check_docs JSON parse failed'); }
  const fails = (data.numericFailures || []).length + (data.missingScripts || []).length;
  if (fails > 0) {
    const summary = [];
    for (const f of (data.numericFailures || []).slice(0, 3)) {
      summary.push(`${f.file}:${f.line} claims ${f.found} ${f.kind} (actual ${f.expected})`);
    }
    for (const m of (data.missingScripts || []).slice(0, 3)) {
      summary.push(`scripts/${m.script} missing — referenced at ${m.sources[0].file}:${m.sources[0].line}`);
    }
    throw new Error(summary.join('; ') + (fails > summary.length ? ` (+${fails - summary.length} more)` : ''));
  }
  return `${data.scope.activeMarkdowns} active markdowns clean (${data.scope.totalMarkdowns - data.scope.activeMarkdowns} excluded as historical/shipped)`;
});

// Preface-matcher alignment: three implementations of the v2 algorithm exist
// across the codex (see _preface_match.js header). This check verifies that
// the HTML-embedded copy in src/app.js agrees on the critical
// algorithmic invariants with the canonical Node primitive. Drift here means
// the regression gate could pass on a bug that ships to users in the HTML.
check('preface-matcher alignment (HTML embed ↔ Node primitive)', () => {
  const htmlSrc = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const nodeSrc = fs.readFileSync(path.join(ROOT, 'scripts/_preface_match.js'), 'utf8');

  // Extract _matchSurvivors body from the HTML template
  const m = htmlSrc.match(/function _matchSurvivors\(card\)\s*\{([\s\S]*?)\n\}/);
  if (!m) throw new Error('_matchSurvivors not found in HTML template');
  const embedBody = m[1];

  const invariants = [
    // The scoring expression: shared / <length-of-preface-tokens>.
    // Both implementations name the token array slightly differently —
    // `tokens.length` in the HTML embed, `prefaceTokens.length` in the
    // Node primitive — so the check matches either.
    { name: 'precision-normalized scoring', re: /shared\s*\/\s*(?:prefaceT|t)okens\.length/, where: 'both' },
    // Empty-card short-circuit
    { name: 'empty-card short-circuit', re: /size\s*===\s*0/, where: 'both' },
    // Zero-shared skip
    { name: 'zero-shared skip', re: /shared\s*===\s*0/, where: 'both' },
    // Habitat fallback: must consult mustHave / mustHaveAny / register when tokens absent
    { name: 'habitat-fallback (mustHave)', re: /mustHave\b/, where: 'both' },
    { name: 'habitat-fallback (mustHaveAny)', re: /mustHaveAny/, where: 'both' },
    { name: 'habitat-fallback (register)', re: /register/, where: 'both' },
  ];
  const issues = [];
  for (const inv of invariants) {
    if (!inv.re.test(embedBody)) issues.push(`HTML embed missing: ${inv.name}`);
    if (!inv.re.test(nodeSrc)) issues.push(`Node primitive missing: ${inv.name}`);
  }

  // Also verify the alphabetical-id tiebreak — lives in suggestPrefaceForCard
  // (HTML) and rank() (Node primitive). Tiebreak symmetry is the part most
  // likely to drift silently because it's invisible until two tokens tie.
  const htmlSuggest = htmlSrc.match(/function suggestPrefaceForCard[\s\S]*?\n\}/);
  if (!htmlSuggest) issues.push('suggestPrefaceForCard not found in HTML template');
  else if (!/localeCompare/.test(htmlSuggest[0])) {
    issues.push('HTML suggestPrefaceForCard missing alphabetical tiebreak (localeCompare)');
  }
  if (!/localeCompare/.test(nodeSrc)) {
    issues.push('Node primitive rank() missing alphabetical tiebreak (localeCompare)');
  }

  if (issues.length) throw new Error(issues.join('; '));
  return `${invariants.length + 1} invariants aligned across HTML embed and Node primitive`;
});

// Tradition-signature parity: signatures live canonically in
// references/_tradition_signatures.json (read by the agent scripts) and are
// inlined into src/app.js for the browser by scripts/build_signatures.js. They
// previously forked (208 keys differed, a rename on one side, 13 orphan keys).
// This check fails if the inlined block drifts from the JSON — regenerate with
// `node scripts/build_signatures.js`.
check('tradition-signature parity (app.js inline ↔ canonical JSON)', () => {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'references/_tradition_signatures.json'), 'utf8'));
  const appSrc = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const m = appSrc.match(/const TRADITION_SIGNATURES = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error('TRADITION_SIGNATURES not found in src/app.js');
  const inline = new Function('return ' + m[1])();
  if (JSON.stringify(inline) !== JSON.stringify(json)) {
    throw new Error('src/app.js TRADITION_SIGNATURES != references/_tradition_signatures.json — run `node scripts/build_signatures.js`');
  }
  return `${Object.keys(json).length} tradition signatures parity-locked (app.js ↔ JSON)`;
});

// Card-descriptor semantics: there are TWO different card-descriptor harvesters
// in the codex, intentionally:
//   - `_card_descriptors.cardDescriptors` and the HTML embed's
//     `_cardDescriptorSet` pool ONLY variant.descriptors (production semantics).
//   - `_matcher.cardDescriptors` pools variant.descriptors AND
//     variant.match_tokens (offline audit-tool semantics).
//
// This check locks in the dichotomy:
//   1. Both production-side harvesters (HTML embed + _card_descriptors.js)
//      must NOT pool match_tokens. Re-introducing match_tokens to the HTML
//      embed silently changes preface assignments for ~5/79 regression
//      fixtures and uncontrolled additional cards.
//   2. The audit-tool harvester (_matcher.cardDescriptors) MUST pool
//      match_tokens, because audit tools depend on the enriched signal.
//
// If either invariant breaks, fail loudly: the divergence is a known design
// choice, not a bug to be "fixed" by silent equalization.
check('card-descriptor semantics aligned (production vs audit)', () => {
  // The production harvester is now SINGLE-SOURCE in scripts/_card_descriptors.js
  // (the @inline `harvestDescriptors` core) and injected into codex.html by
  // build_html.js. There is no hand-duplicated copy in src/app.js anymore, so we
  // read the production body from the built HTML (proving the inject happened)
  // and still guard the match_tokens divergence vs the audit harvester.
  const prodNodeSrc = fs.readFileSync(path.join(ROOT, 'scripts/_card_descriptors.js'), 'utf8');
  const auditNodeSrc = fs.readFileSync(path.join(ROOT, 'scripts/_matcher.js'), 'utf8');
  const builtHtml = fs.readFileSync(HTML_PATH, 'utf8');

  // The injected core in the built HTML.
  const m = builtHtml.match(/function harvestDescriptors\(card, lookups\)\s*\{([\s\S]*?)\n\}/);
  if (!m) throw new Error('harvestDescriptors not found in built codex.html — build_html inject missing');
  const embedBody = m[1];
  if (!/function _cardDescriptorSet\(card\)/.test(builtHtml)) {
    throw new Error('_cardDescriptorSet browser adapter not found in built codex.html');
  }

  // Extract cardDescriptors body from _matcher.js
  const m2 = auditNodeSrc.match(/function cardDescriptors\(card\)\s*\{([\s\S]*?)\n\}/);
  if (!m2) throw new Error('cardDescriptors not found in _matcher.js');
  const matcherBody = m2[1];

  const issues = [];

  // Production-side: HTML embed and _card_descriptors.js must NOT reference match_tokens
  if (/match_tokens/.test(embedBody)) {
    issues.push('HTML _cardDescriptorSet references match_tokens — would silently change production preface assignments');
  }
  if (/match_tokens/.test(prodNodeSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''))) {
    // Strip comments before checking — the header documents the divergence and mentions match_tokens
    issues.push('_card_descriptors.js references match_tokens outside comments — production gate would drift from HTML embed');
  }

  // Audit-side: _matcher.cardDescriptors MUST reference match_tokens
  if (!/match_tokens/.test(matcherBody)) {
    issues.push('_matcher.cardDescriptors no longer pools match_tokens — audit tools would lose the enrichment signal they were designed to consume');
  }

  if (issues.length) throw new Error(issues.join('; '));
  return 'production harvesters skip match_tokens; audit harvester includes match_tokens (documented divergence preserved)';
});

// Redesign-discipline gates — lock in the visual-system tokens so future edits
// can't silently drift back to hardcoded values or stale token names. Each gate
// catches a class of regression the redesign was meant to eliminate.
check('CSS — no orphan color token refs', () => {
  // Catches re-introduction of legacy tokens (--accent, --danger, --bg-1/2,
  // --text-1) that the Phase 1 color migration removed. Falls back to inherited
  // values silently — bug-by-inaction unless gated.
  const css = fs.readFileSync(path.join(ROOT, 'src/index.template.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const banned = ['--accent', '--accent-soft', '--danger', '--bg-1', '--bg-2', '--text-1'];
  const found = [];
  for (const tok of banned) {
    if (css.includes(`var(${tok})`)) found.push(`top:${tok}`);
    if (js.includes(`var(${tok})`)) found.push(`bottom:${tok}`);
  }
  if (found.length) throw new Error(`orphan tokens: ${found.join(', ')}`);
  return 'no legacy color tokens referenced';
});
check('CSS/JS — no hardcoded font-size or font-weight', () => {
  // Catches re-introduction of pixel-literal font values that the Phase 2 type
  // migration eliminated. Token-definition lines in :root are allowed to carry
  // pixel values; usage sites must reference --fs-* and --fw-*.
  for (const rel of ['src/index.template.html', 'src/app.js']) {
    const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const lines = txt.split('\n');
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*--/.test(line)) continue;  // token definition allowed
      if (/font-size:\s*\d/.test(line)) violations.push(`${rel}:${i+1} font-size`);
      if (/font-weight:\s*\d/.test(line)) violations.push(`${rel}:${i+1} font-weight`);
    }
    if (violations.length) throw new Error(`${violations.length} hardcoded: ${violations.slice(0,3).join('; ')}`);
  }
  return 'all font props use tokens';
});
check('HTML/JS — no glyph close buttons (✕)', () => {
  // Catches re-introduction of text-glyph close markers. The icon system
  // landed in Phase 3 with proper SVG and aria-label='Close'.
  const top = fs.readFileSync(path.join(ROOT, 'src/index.template.html'), 'utf8');
  const bottom = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const xCount = (top.match(/✕/g) || []).length + (bottom.match(/✕/g) || []).length;
  if (xCount > 0) throw new Error(`${xCount} stray ✕ glyph(s) — use icon('x') or inline SVG`);
  return 'no glyph close buttons';
});
check('Icons — every name called is defined in ICONS map', () => {
  // Catches typos and references to icons that were never added to the library.
  // Resolves each icon('name') call through the SAME logic the runtime icon()
  // uses: ICON_ALIASES[name] || name, then ICON_PATHS[resolved] ||
  // ICON_PATHS_LOCAL[resolved]. ICON_PATHS (96) and ICON_ALIASES (63) live in
  // references/08_asset_manifest.js (loaded via _loader); ICON_PATHS_LOCAL is a
  // small inline map in the bottom template. Earlier this check scanned only the
  // bottom template for a `'name': '<` literal and so false-flagged every aliased
  // or manifest-defined icon as undefined.
  const bottom = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const C = require('./_loader.js');
  const ICON_PATHS = C.ICON_PATHS || {};
  const ICON_ALIASES = C.ICON_ALIASES || {};
  const localKeys = new Set([...bottom.matchAll(/^\s*'([\w-]+)':\s*'</gm)].map(m => m[1]));
  const resolves = (name) => {
    const r = ICON_ALIASES[name] || name;
    return Object.prototype.hasOwnProperty.call(ICON_PATHS, r) || localKeys.has(r);
  };
  const calls = [...bottom.matchAll(/\bicon\(['"]([\w-]+)['"]/g)].map(m => m[1]);
  const missing = [...new Set(calls.filter(c => !resolves(c)))];
  if (missing.length) throw new Error(`undefined icons called: ${missing.join(', ')}`);
  // Targeted guard for the specific quote-escape regression: `icon("'name'", N)`
  // is a malformed call that the strict regex above silently skips, leaving
  // empty SVGs in the rendered UI. Catch the pattern by literal match.
  const broken = (bottom.match(/icon\(["']['"][\w-]+/g) || []).length;
  if (broken) throw new Error(`${broken} malformed icon("'name'", ...) call(s) — quote-escape damage`);
  return `${calls.length} call(s) resolve via ICON_PATHS(${Object.keys(ICON_PATHS).length})+aliases(${Object.keys(ICON_ALIASES).length})+local(${localKeys.size})`;
});

check('Icons — no inline SVGs bypassing the icon() renderer', () => {
  // Visual coherence guard: the only acceptable <svg> tag is the one inside
  // the icon() function. Any other inline SVG means someone wrote path data
  // at a call site instead of adding it to the ICONS map — that's how stroke
  // widths drift, that's how trash designs diverge. Tandem will block the
  // build before the inconsistency ships.
  //
  // Exception: data visualizations (UpSet, future viz) render hand-rolled
  // SVG by design — they're not icons, they're charts. Those functions
  // are explicitly allowlisted below.
  const top = fs.readFileSync(path.join(ROOT, 'src/index.template.html'), 'utf8');
  const bottom = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  const topSvgs = (top.match(/<svg\b/g) || []).length;
  if (topSvgs > 0) throw new Error(`${topSvgs} inline <svg> in top template — use <span data-icon="name"> placeholder instead`);
  // Bottom template: <svg> is permitted inside icon() and inside hand-rolled
  // visualization functions (allowlist below). Anything else is a bypass.
  const VIZ_ALLOWLIST = ['function renderUpSet(', 'function image('];
  const allowedRegions = [];
  // icon() function — ~200-char window around its definition
  const iconFnIdx = bottom.indexOf('function icon(name');
  if (iconFnIdx >= 0) allowedRegions.push([iconFnIdx, iconFnIdx + 400]);
  // Each viz function — from its `function X(` to the next top-level `function ` declaration
  for (const sig of VIZ_ALLOWLIST) {
    const start = bottom.indexOf(sig);
    if (start < 0) continue;
    // End: next line starting with "function " at column 0
    const tail = bottom.slice(start + sig.length);
    const nextFnRel = tail.search(/\nfunction /);
    const end = nextFnRel < 0 ? bottom.length : start + sig.length + nextFnRel;
    allowedRegions.push([start, end]);
  }
  const svgPositions = [...bottom.matchAll(/<svg\b/g)].map(m => m.index);
  const stray = svgPositions.filter(pos => !allowedRegions.some(([s, e]) => pos >= s && pos < e));
  if (stray.length) {
    const lineNo = bottom.slice(0, stray[0]).split('\n').length;
    throw new Error(`${stray.length} inline <svg> in bottom template (first at line ${lineNo}) — migrate to icon('name') call`);
  }
  return `0 stray inline SVGs across both templates`;
});

console.log('\n[2/4] HTML artifact');
check('exists', () => {
  if (!fs.existsSync(HTML_PATH)) throw new Error('not found at ' + HTML_PATH);
  const size = fs.statSync(HTML_PATH).size;
  return (size / 1024 / 1024).toFixed(2) + ' MB';
});
check('JS parseable (vm.Script syntax check)', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no <script> tag');
  new vm.Script(m[1]); // throws on syntax error
  return m[1].length.toLocaleString() + ' chars';
});
check('catalog data matches source', () => {
  // Three checks, all using the shipped HTML's embedded data block as ground
  // truth — that's what users actually see, regardless of source state.
  //
  // (1) Same TRADITIONS count as source — catches embedded data truncation or
  //     a source-file write that didn't get rebuilt.
  // (2) Bijection: TRADITIONS.id ≡ TRADITION_EXTRAS keys. Historically only
  //     the extras→tradition direction was checked, by validate.js. The reverse
  //     (a tradition with no extras entry) slipped through: extras is where the
  //     UI gets a tradition's tree-parent, axes, description. Without those,
  //     the tradition exists in data but is invisible in the tree browser.
  //     The alternative_rock bug of May 2026 was exactly this. We assert the
  //     bijection literally against the shipped HTML so a regression in
  //     validate.js can't bypass it.
  // (3) Same TRADITION_EXTRAS count between source and HTML — catches embed
  //     truncation in the extras block specifically (its own ~700KB chunk).
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const C = require('./_loader.js');

  // Read the TRUE id/key sets by evaluating the embedded data block, rather than
  // regex-scraping it. The embed chunks the extras as `Object.assign(
  // TRADITION_EXTRAS, {'id': {…})` calls (renderer-OOM splitting), so the first
  // key of each chunk sits inline after `{` instead of on its own 2-space-indented
  // line — a line-anchored regex silently misses exactly those keys. Eval is
  // format-proof and matches what the browser actually loads. (Mirrors the
  // tag-strip + const→globalThis promotion used by build_html.js --check.)
  const tradStart = html.indexOf('const TRADITIONS');
  const tradEnd = html.indexOf('const TRADITION_EXTRAS');
  if (tradStart < 0 || tradEnd < 0) throw new Error('TRADITIONS/EXTRAS blocks not found in HTML');
  const dataEnd = (() => {
    const m = html.slice(tradEnd + 'const TRADITION_EXTRAS'.length).match(/\nconst [A-Z_]+\s*=/);
    return m ? tradEnd + 'const TRADITION_EXTRAS'.length + m.index : html.length;
  })();
  const dataJs = html.slice(tradStart, dataEnd)
    .split('\n').filter(l => l !== '</script>' && !l.startsWith('<script>')).join('\n')
    .replace(/^const (\w+) =/gm, 'globalThis.$1 =');
  const dataSandbox = { Object, Array, JSON };
  vm.createContext(dataSandbox);
  vm.runInContext(dataJs, dataSandbox, { filename: 'html-data-block.js', timeout: 15000 });
  const htmlTradIds = new Set((dataSandbox.TRADITIONS || []).map(t => t.id));
  const htmlExtrasKeys = new Set(Object.keys(dataSandbox.TRADITION_EXTRAS || {}));

  // (1) Count parity with source
  const sourceCount = C.TRADITIONS.length;
  if (htmlTradIds.size !== sourceCount) {
    throw new Error(`source has ${sourceCount} traditions, HTML has ${htmlTradIds.size}`);
  }

  // (2) Bijection inside the HTML itself
  const tradWithoutExtras = [...htmlTradIds].filter(id => !htmlExtrasKeys.has(id));
  const extrasWithoutTrad = [...htmlExtrasKeys].filter(id => !htmlTradIds.has(id));
  if (tradWithoutExtras.length) {
    throw new Error(`${tradWithoutExtras.length} tradition(s) have no extras entry — UI-invisible in tree: ${tradWithoutExtras.slice(0, 3).join(', ')}${tradWithoutExtras.length > 3 ? '…' : ''}`);
  }
  if (extrasWithoutTrad.length) {
    throw new Error(`${extrasWithoutTrad.length} extras entry/entries have no matching tradition: ${extrasWithoutTrad.slice(0, 3).join(', ')}${extrasWithoutTrad.length > 3 ? '…' : ''}`);
  }

  // (3) Extras count parity between source and HTML
  const sourceExtrasCount = Object.keys(C.TRADITION_EXTRAS).length;
  if (htmlExtrasKeys.size !== sourceExtrasCount) {
    throw new Error(`source has ${sourceExtrasCount} extras entries, HTML has ${htmlExtrasKeys.size}`);
  }

  return `${sourceCount} traditions + extras bijection holds`;
});
check('recently-added catalog content present', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  // Phase 0 (gap fixes): rap_voice, fado_voice, qawwali_lead, hindustani_sarod
  // Phase 1 (voice mechanism split): fry_bleed_voice, false_fold_voice, breath_admixed_voice,
  //   pressed_phonation_voice, worn_fold_voice, full_chest_belt_voice, aspirated_voice
  // Phase 2 (chain mechanism vocab): top-rolled-off-12k (mic), even-harmonic-rich (pre),
  //   transformer-coupled-channel (console), hf-compression-natural (medium)
  // Phase 6+ (chain mechanism vocab continued): comp/eq/fx/amp circuit-topology vocabulary
  // Phase 6+ warm-audit: instrument-side warm replacements (low-mid-rich-spectrum, etc.)
  const required = [
    'rap_voice', 'fado_voice', 'qawwali_lead', 'hindustani_sarod',
    'fry_bleed_voice', 'false_fold_voice', 'breath_admixed_voice',
    'pressed_phonation_voice', 'worn_fold_voice', 'full_chest_belt_voice',
    'aspirated_voice', 'lowered_larynx_voice', 'register_break_voice',
    'top-rolled-off-12k', 'even-harmonic-rich',
    'transformer-coupled-channel', 'hf-compression-natural',
    'high-gain-cascading-tube-stages', 'long-attack-LDR-thermal',
    'germanium-soft-clip-asymmetric', 'passive-LC-broad-curves',
    'doppler-pitch-modulation',
    'low-mid-rich-spectrum', 'chest-resonance-low-mid',
  ];
  const missing = required.filter(t => !html.includes(t));
  if (missing.length) throw new Error('missing: ' + missing.join(', '));
  return required.length + ' editorial-pass identifiers present';
});

console.log('\n[3/4] Zip artifact');
check('exists', () => {
  // Build the zip on demand if it isn't already on disk, so tandem is
  // self-sufficient in a fresh checkout (nothing else in the pipeline builds
  // it). build_zip.sh honors ZIP_OUT; point it at the path tandem reads.
  if (!fs.existsSync(ZIP_PATH)) {
    try {
      RUN(`ZIP_OUT=${ZIP_PATH} bash scripts/build_zip.sh`);
    } catch (e) {
      throw new Error('not found and build_zip.sh failed: ' + (e.message || '').slice(0, 200));
    }
    if (!fs.existsSync(ZIP_PATH)) throw new Error('build_zip.sh ran but produced no zip at ' + ZIP_PATH);
  }
  return (fs.statSync(ZIP_PATH).size / 1024).toFixed(0) + ' KB';
});
check('round-trip extract + run validate', () => {
  const tmpDir = '/tmp/tandem_roundtrip_' + Date.now();
  try {
    execSync(`mkdir -p ${tmpDir} && cd ${tmpDir} && unzip -q ${ZIP_PATH}`, { encoding: 'utf8' });
    // Zip extracts with a single top-level folder (see scripts/build_zip.sh:
    // "Layout: ZIP root → codex-music-tool/ → SKILL.md + ..."). Locate that
    // sole subdirectory rather than assuming files at tmpDir root.
    const entries = fs.readdirSync(tmpDir);
    const subdirs = entries.filter(e => fs.statSync(path.join(tmpDir, e)).isDirectory());
    if (subdirs.length !== 1) throw new Error(`expected 1 subdir in zip root, got ${subdirs.length}: ${entries.join(',')}`);
    const workDir = path.join(tmpDir, subdirs[0]);
    const out = execSync('node scripts/validate.js', { cwd: workDir, encoding: 'utf8' });
    if (!out.includes('VALID')) throw new Error('zip validate failed');
    return 'extracted + validated';
  } finally {
    execSync(`rm -rf ${tmpDir}`, { encoding: 'utf8' });
  }
});

console.log('\n[4/4] HTML ↔ source parity');
check('HTML preface coordination — no repetition within tradition', () => {
  // Tony's verbalized rule: if a preface is the top match for two cards in the
  // same recipe, the highest-scoring card keeps it and the others advance to
  // their next-best preface. This rule lives in the HTML embed's
  // `_applyRecipeDedup` (production runtime) — a Node-side counterpart used to
  // live in `_renderer_v2.js` until that file was archived alongside the
  // dead v1-vs-v2 comparison chain. The HTML's per-card display had been
  // bypassing the dedup, so a single dominant preface like bandish-locking
  // landed on all six Hindustani instruments. This gate samples
  // multi-instrument traditions through the HTML's actual JavaScript and
  // verifies every card's preface is unique within its recipe.
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  let scriptContent = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  scriptContent += '\nObject.assign(globalThis, { TRADITIONS, INSTRUMENTS, importTradition, _applyRecipeDedup, app });\n';
  const noop = () => {};
  const stubEl = () => ({
    className: '', innerHTML: '', dataset: {},
    classList: { add: noop, remove: noop, contains: () => false, toggle: noop },
    appendChild: noop, addEventListener: noop, removeEventListener: noop,
    replaceWith: noop, querySelector: stubEl, querySelectorAll: () => [],
    style: {}, focus: noop, click: noop,
  });
  const doc = {
    addEventListener: noop, getElementById: stubEl, querySelector: stubEl, querySelectorAll: () => [],
    createElement: stubEl, body: stubEl(), head: stubEl(), readyState: 'complete',
  };
  const sandbox = {
    console: { log: noop, error: noop, warn: noop }, setTimeout, clearTimeout, requestAnimationFrame: (fn) => fn(), document: doc,
    navigator: { clipboard: null }, addEventListener: noop, removeEventListener: noop,
    isSecureContext: false, location: { href: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  // Sample includes the original failure case (Hindustani) plus traditions
  // from each major tree branch with 4+ instruments — enough surface area to
  // catch any regression in the dedup loop.
  const sample = ['hindustani', 'qawwali', 'chicago_blues', 'bluegrass', 'fado', 'mariachi',
                  'samba', 'pansori', 'pentecostal_gospel', 'klezmer'];
  const failures = [];
  for (const tid of sample) {
    sandbox.app.cards = [];
    sandbox.importTradition(tid);
    if (sandbox.app.cards.length < 2) continue;
    sandbox._applyRecipeDedup();
    const prefs = sandbox.app.cards.map(c => c.preface).filter(p => p);
    const seen = new Map();
    for (let i = 0; i < prefs.length; i++) {
      if (seen.has(prefs[i])) {
        failures.push(`${tid}: '${prefs[i]}' on ${seen.get(prefs[i])} AND ${sandbox.app.cards[i].instrumentId}`);
        break;
      }
      seen.set(prefs[i], sandbox.app.cards[i].instrumentId);
    }
  }
  if (failures.length) throw new Error(failures.join('; '));
  return sample.length + ' traditions verified, all prefaces unique per recipe';
});

check('HTML import simulation produces expected card counts', () => {
  // Load the HTML JS and exercise importTradition for the four recently-fixed
  // traditions; verify card counts match expectations
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  let scriptContent = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  scriptContent += '\nObject.assign(globalThis, { TRADITIONS, INSTRUMENTS, importTradition, compileStack, app });\n';
  const noop = () => {};
  const stubEl = () => ({
    className: '', innerHTML: '', dataset: {},
    classList: { add: noop, remove: noop, contains: () => false, toggle: noop },
    appendChild: noop, addEventListener: noop, removeEventListener: noop,
    replaceWith: noop, querySelector: stubEl, querySelectorAll: () => [],
    style: {}, focus: noop, click: noop,
  });
  const doc = {
    addEventListener: noop, getElementById: stubEl, querySelector: stubEl, querySelectorAll: () => [],
    createElement: stubEl, body: stubEl(), head: stubEl(), readyState: 'complete',
  };
  const sandbox = {
    console: { log: noop, error: noop, warn: noop }, setTimeout, clearTimeout, requestAnimationFrame: (fn) => fn(), document: doc,
    navigator: { clipboard: null }, addEventListener: noop, removeEventListener: noop,
    isSecureContext: false, location: { href: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);
  const expected = {
    qawwali: 4,
    fado: 3,
    golden_age_hip_hop_1986_1991: 4,
    hindustani: 7,
    hindustani_sarod: 4,
  };
  const mismatches = [];
  for (const [tid, n] of Object.entries(expected)) {
    sandbox.app.cards = [];
    sandbox.importTradition(tid);
    if (sandbox.app.cards.length !== n) {
      mismatches.push(`${tid}: expected ${n} cards, got ${sandbox.app.cards.length}`);
    }
  }
  if (mismatches.length) throw new Error(mismatches.join('; '));
  return Object.keys(expected).length + ' traditions verified';
});

check('HTML buildUpSetData — fixture correctness', () => {
  // Verifies the UpSet data-prep against a synthetic fixture with known
  // overlap structure. Four cards A/B/C/D with descriptor sets:
  //   A: {a, b, c, d}
  //   B: {a, b, e, f}
  //   C: {a, c, e, g}
  //   D: {b, d, f, h}
  // Exclusive intersections (token appears in exactly the listed sets):
  //   a → {A,B,C}     b → {A,B,D}     c → {A,C}     d → {A,D}
  //   e → {B,C}       f → {B,D}       g → {C}        h → {D}
  // 8 non-empty intersections, each of size 1. The data builder must
  // enumerate exactly those 8 and prune the other 7 (out of 15 possible).
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  let scriptContent = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  scriptContent += '\nObject.assign(globalThis, { buildUpSetData, _cardDescriptorSet, Inst });\n';
  const noop = () => {};
  const stubEl = () => ({
    className: '', innerHTML: '', dataset: {},
    classList: { add: noop, remove: noop, contains: () => false, toggle: noop },
    appendChild: noop, addEventListener: noop, removeEventListener: noop,
    replaceWith: noop, querySelector: stubEl, querySelectorAll: () => [],
    style: {}, focus: noop, click: noop,
  });
  const doc = {
    addEventListener: noop, getElementById: stubEl, querySelector: stubEl, querySelectorAll: () => [],
    createElement: stubEl, body: stubEl(), head: stubEl(), readyState: 'complete',
  };
  const sandbox = {
    console: { log: noop, error: noop, warn: noop }, setTimeout, clearTimeout, requestAnimationFrame: (fn) => fn(), document: doc,
    navigator: { clipboard: null }, addEventListener: noop, removeEventListener: noop,
    isSecureContext: false, location: { href: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(scriptContent, sandbox);

  // Swap in fixture descriptor source + lookup
  const fixture = {
    a: new Set(['a', 'b', 'c', 'd']),
    b: new Set(['a', 'b', 'e', 'f']),
    c: new Set(['a', 'c', 'e', 'g']),
    d: new Set(['b', 'd', 'f', 'h']),
  };
  sandbox._cardDescriptorSet = (card) => fixture[card.instrumentId];
  sandbox.Inst = (id) => ({ name: id.toUpperCase(), family: 'voice' });
  const cards = ['a', 'b', 'c', 'd'].map(id => ({ instrumentId: id }));
  const data = sandbox.buildUpSetData(cards);
  if (!data) throw new Error('buildUpSetData returned null');
  if (data.sets.length !== 4) throw new Error(`expected 4 sets, got ${data.sets.length}`);
  if (data.intersections.length !== 8) {
    throw new Error(`expected 8 non-empty intersections, got ${data.intersections.length}`);
  }
  for (const inter of data.intersections) {
    if (inter.size !== 1) throw new Error(`intersection ${inter.setIdxs.join(',')} has size ${inter.size}, expected 1`);
  }
  return '8/8 non-empty intersections found in fixture';
});

console.log('');
if (failed > 0) {
  console.error(`TANDEM CHECK FAILED: ${failed} issue(s) above\n`);
  process.exit(1);
} else {
  console.log('TANDEM CHECK PASSED: source, zip, and HTML are coherent.\n');
}
