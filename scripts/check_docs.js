#!/usr/bin/env node
// check_docs.js — verify markdown numeric claims against current catalog/audit state.
//
// @covers: catalog-counts
//
// CATCHES drift across active markdown documentation. Run after catalog
// changes that move any canonical count, or before tagging a release.
//
// What it checks (instant):
// - Canonical numeric counts: "X traditions", "X instruments", "X prefaces",
//   "X rooms", "X chain archetypes", "X production aesthetics", "X tunings",
//   "X tree nodes", "X catalog tables" — each verified against the loader's
//   current values.
// - Script references: every `scripts/<name>.js` mention in active markdowns
//   is verified to exist in `scripts/`.
//
// What it checks with --with-audits (fast audits, ~10s):
// - "audit_dead_tokens.js flags X prefaces" — run audit, capture count
// - "audit_profile_size.js flags X prefaces" — run audit, capture count
//
// What it checks with --with-smoke (slow, ~3min):
// - "X recipe-stack ceiling assertions" — run smoke.js, capture total
// - "X advisories" (no_iconic_descriptor) — run audit section, capture count
//
// What it skips:
// - Markdowns with STATUS marker SHIPPED|ACTED ON|MOSTLY SHIPPED (historical
//   reference docs that intentionally preserve point-in-time snapshots).
// - CHANGELOG.md (a historical record: old entries state old counts on purpose)
//   and the tests/ fixtures. README.md IS checked — its thousands separators are
//   handled rather than exempted.
// - Lines containing `<!-- check_docs:ignore -->` inline pragma.
//
// Usage:
//   node scripts/check_docs.js                # default checks (instant)
//   node scripts/check_docs.js --with-audits  # + fast audit count checks
//   node scripts/check_docs.js --with-smoke   # + slow smoke + advisory checks
//   node scripts/check_docs.js --all          # everything
//   node scripts/check_docs.js --json         # machine-readable output
//   node scripts/check_docs.js --fix          # rewrite drifted counts from the catalog
//
// Exits 0 if all checks pass, 1 if any drift detected. --fix repairs the
// canonical counts in place and still reports what it changed (and still exits
// 1), so a CI run can never pass by silently rewriting the docs it is auditing.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const C = require('./_loader.js');

const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) flags[a.slice(2)] = true;
}
const WITH_AUDITS = flags.audits || flags['with-audits'] || flags.all;
const WITH_SMOKE = flags.smoke || flags['with-smoke'] || flags.all;
const JSON_OUT = flags.json;
const FIX = flags.fix;

// ───────────────────────── Path-based exclusions ─────────────────────────

// docs/ and the _one_off / _archive trees were removed in the production-hardening
// pass; SKILL.md is the one canonical manifest whose counts must stay truthful.
// tests/ holds fixtures.
const EXCLUDED_PREFIXES = ['node_modules/', 'tests/', '.git/'];

// CHANGELOG.md only. Its entries are a historical record — an old entry is
// SUPPOSED to state the count that was true when it was written, so drift-checking
// it would be wrong. README.md used to be excluded on the same "prose" rationale,
// which left the repo's most-read file as the only one allowed to be wrong: it
// advertised 1,195 traditions and 651 instruments long after the real figures were
// 1,167 and 870, and no gate could say so. The only real obstacle was that README
// writes numbers with thousands separators, which N below now accepts.
// AUDIT.md joins it for the same reason from the other direction: it is a review
// document that QUOTES wrong counts as evidence. One of its own findings is that
// server.json advertises 1145 traditions against a real 2503 — a drift checker
// that forces that sentence to say 2503 would delete the defect it reports.
// lyric-harness/quality/RESULTS_REGISTER_AUDIT.md joins them for AUDIT.md's
// exact reason: it is a review document that QUOTES counts as evidence, and the
// count it quotes is a verbatim commit message ("75 of 77 traditions"). Forcing
// that line to say 2503 would falsify a quotation, which is worse than the drift
// it would be preventing.
//
// NOTE THE TWO THAT ARE *NOT* EXCLUDED, because the choice is the point.
// `lyric-harness/` uses "traditions" to mean RHYME traditions — qafiya,
// cynghanedd, dróttkvætt — which collides with this checker's catalog noun by
// spelling only. The blanket fix is to exclude the whole subtree, and it is
// wrong: `lyric-harness/MISSING.md` also states "the MCP server (2,503
// traditions, 1,406 instruments, 741 prefaces)", a REAL catalog claim that is
// currently correct and deserves this gate. So the other two sites were
// QUALIFIED instead — "16 rhyme traditions", "6 rhyme traditions" — which is
// more precise prose, changes no number, and leaves the catalog claim guarded.
// A bare noun two subsystems both claim is a coordinate that needs declaring,
// not a checker that needs silencing.
const EXCLUDED_FILES = [
  'CHANGELOG.md',
  'AUDIT.md',
  'lyric-harness/quality/RESULTS_REGISTER_AUDIT.md',
];

const STATUS_RE = /\*\*STATUS:\*\*\s+(SHIPPED|ACTED ON|MOSTLY SHIPPED)/;

function isExcluded(relpath, content) {
  if (EXCLUDED_FILES.includes(relpath)) return true;
  if (EXCLUDED_PREFIXES.some((p) => relpath.startsWith(p))) return true;
  if (STATUS_RE.test(content)) return true;
  return false;
}

// ───────────────────────── Markdown discovery ─────────────────────────

function findMarkdowns(dir, results = []) {
  for (const entry of fs.readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) findMarkdowns(full, results);
    else if (entry.endsWith('.md')) results.push(full);
  }
  return results;
}

const allMarkdowns = findMarkdowns(ROOT);
const activeMarkdowns = [];
for (const md of allMarkdowns) {
  const rel = path.relative(ROOT, md);
  const content = fs.readFileSync(md, 'utf-8');
  if (!isExcluded(rel, content)) activeMarkdowns.push({ rel, abs: md, content });
}
// Also gate the non-.md discovery surfaces (llms.txt, index.html, package.json):
// they carry canonical counts and script refs, but findMarkdowns only collects
// *.md. (codex.html is intentionally excluded — a generated bundle full of data.)
for (const extra of ['llms.txt', 'index.html', 'package.json']) {
  const abs = path.join(ROOT, extra);
  if (fs.existsSync(abs))
    activeMarkdowns.push({ rel: extra, abs, content: fs.readFileSync(abs, 'utf-8') });
}

// ───────────────────────── Canonical count registry ─────────────────────────
//
// Each pattern matches "X NOUN". Whether that match is a CANONICAL claim (a
// catalog total, which must be checked) or a SUBSET claim (which must not) is
// decided by isSubsetClaim below, not by the pattern:
//
//   - a qualifier word after the noun ("with", "flagged", "of", "in", "are")
//     marks a subset — "42 prefaces with 8 tokens", "5 traditions flagged by
//     audit";
//   - a totality determiner before the number ("all", "every", "the full")
//     outranks it and marks a total — "returns all <n> traditions with their
//     recipe strings" (no live count written here: a comment illustrating this
//     rule is the last place that should carry a transcribed one).
//
// Both callers share that one function: --fix cannot repair a claim --check
// would not flag. The pragma override remains available for any edge case it
// misclassifies.

const QUALIFIERS = [
  'with',
  'flagged',
  'of',
  'in',
  'that',
  'are',
  'is',
  'were',
  'was',
  'having',
  'lack',
  'fail',
  'pass',
];
// Markdown emphasis and quote marks may sit between the number and the noun:
// `**649 "prefaces"**` is the same canonical claim as `649 prefaces`, but a
// pattern anchored on a literal space misses it — which is exactly how
// docs/connector-directory-submission.md carried a stale preface count of 649
// against an actual 741 without this gate noticing. The noun is what identifies
// the claim; the decoration around it must not decide whether we check.
const Q = '["\u201C\u201D\u2018\u2019*_`]*';

// A totality marker BEFORE the number outranks a qualifier after the noun.
//
// The qualifier list is an open-world negative: it can only ever name the
// disqualifiers someone has already been burned by, so every miss widens it
// again (quote decoration, line wraps, "recorded-music" — three widenings, each
// after a production escape). This is the same failure a fourth time, and
// adding `with` to QUALIFIERS would be the wrong repair: `with` really does
// mark a subset in "42 prefaces with 8 tokens".
//
// What actually separates the two is not the qualifier, it is `all`. English
// marks totality up front, and a subset claim never carries one of these
// determiners. So rather than enumerating more ways to be a subset, look for
// the positive evidence of a total. AGENTS.md's "returns all 1145 traditions
// with their `recipe` strings" is a canonical claim that this gate reported as
// PASS while the real count was 2503.
//
// This does not make the classifier complete — nothing over free prose is. It
// makes the completeness burden fall on a closed set (the handful of English
// totality determiners) instead of an open one (every phrasing that could ever
// follow a noun).
const TOTAL_MARKERS = ['all', 'every', 'the full', 'the complete', 'the entire'];

const QUALIFIER_RE = new RegExp(`^\\s+(?:${QUALIFIERS.join('|')})\\b`);
const TOTAL_RE = new RegExp(`\\b(?:${TOTAL_MARKERS.join('|')})\\s+$`, 'i');

// Suppression is decided here rather than inside each pattern so that --check
// and --fix cannot disagree about what counts as a canonical claim: one
// classifier, both callers.
function isSubsetClaim(content, start, end) {
  if (!QUALIFIER_RE.test(content.slice(end, end + 32))) return false;
  return !TOTAL_RE.test(content.slice(Math.max(0, start - 24), start));
}

// Number group accepting both "870" and "1,167". README writes prose numbers with
// thousands separators; the agent-facing docs do not. Spelled out rather than
// written [\\d,]+ so it can never match a trailing comma ("in 2024, 84 rooms").
// Commas are stripped before the comparison.
const N = '((?:\\d{1,3}(?:,\\d{3})+|\\d+))';

const GLOBAL_FAMILY_COUNT = C.TRADITIONS.filter((t) => t.family === 'global').length;
const DOTTED_NODE_COUNT = C.TREE_NODES.filter((n) => n.id.includes('.')).length;

const COUNT_CHECKS = [
  // "N traditions" with optional in-between modifiers ("recorded-music", "music")
  // and \s+ so a line-wrapped "all 1195\ntraditions" still matches — both forms
  // drifted silently before this pattern was widened.
  {
    phrase: new RegExp(`${N}(?:\\s+(?:recorded-music|music))?\\s+${Q}traditions\\b`, 'g'),
    expected: C.TRADITIONS.length,
    kind: 'traditions',
  },
  {
    phrase: new RegExp(`${N}\\s+${Q}instruments\\b`, 'g'),
    expected: C.INSTRUMENTS.length,
    kind: 'instruments',
  },
  {
    phrase: new RegExp(`${N}\\s+${Q}prefaces\\b`, 'g'),
    expected: C.PREFACE_LEXICON.length,
    kind: 'prefaces',
  },
  {
    phrase: new RegExp(`${N}\\s+${Q}rooms\\b`, 'g'),
    expected: C.ROOMS.length,
    kind: 'rooms',
  },
  {
    phrase: new RegExp(`${N}\\s+${Q}chain archetypes\\b`, 'g'),
    expected: C.CHAIN_ARCHETYPES.length,
    kind: 'chain_archetypes',
  },
  {
    phrase: new RegExp(`${N}\\s+${Q}production aesthetics\\b`, 'g'),
    expected: C.PRODUCTION_AESTHETICS.length,
    kind: 'production_aesthetics',
  },
  {
    phrase: new RegExp(`${N}\\s+${Q}tunings\\b`, 'g'),
    expected: C.TUNINGS.length,
    kind: 'tunings',
  },
  {
    phrase: new RegExp(`${N}\\s+${Q}tree nodes\\b`, 'g'),
    expected: C.TREE_NODES.length,
    kind: 'tree_nodes',
  },
  {
    phrase: new RegExp(`${N}\\s+${Q}catalog tables\\b`, 'g'),
    expected: Object.keys(C).length,
    kind: 'catalog_tables',
  },
  // Adjectival forms ("1195-tradition / 490-instrument codex", "312-node genre
  // tree"). ≥3 digits so hypothetical example builds ("a 5-tradition build")
  // aren't mistaken for catalog totals.
  { phrase: /(\d{3,})-tradition\b/g, expected: C.TRADITIONS.length, kind: 'traditions_adj' },
  { phrase: /(\d{3,})-instrument\b/g, expected: C.INSTRUMENTS.length, kind: 'instruments_adj' },
  { phrase: /(\d+)-node genre tree/g, expected: C.TREE_NODES.length, kind: 'tree_nodes_adj' },
  // SKILL.md §1 table rows ("| traditions | 1195 |")
  {
    phrase: /\|\s*traditions\s*\|\s*(\d+)\s*\|/g,
    expected: C.TRADITIONS.length,
    kind: 'traditions_table',
  },
  {
    phrase: /\|\s*tradition extras\s*\|\s*(\d+)\s*\|/g,
    expected: C.TRADITION_EXTRAS ? Object.keys(C.TRADITION_EXTRAS).length : C.TRADITIONS.length,
    kind: 'tradition_extras_table',
  },
  {
    phrase: /\|\s*instruments\s*\|\s*(\d+)\s*\|/g,
    expected: C.INSTRUMENTS.length,
    kind: 'instruments_table',
  },
  {
    phrase: /\|\s*tree nodes\s*\|\s*(\d+)\s*\|/g,
    expected: C.TREE_NODES.length,
    kind: 'tree_nodes_table',
  },
  // Loader-output shorthand ("loaded: 490 insts, 1195 trads" — anchored on
  // "loaded:"/"insts," so per-tradition roster counts like "9 insts" don't
  // false-positive) and derived facts that drift when traditions/nodes are
  // added ("global dominates at 733/1195", "288 of 312 ids contain dots").
  { phrase: /loaded: (\d+) insts\b/g, expected: C.INSTRUMENTS.length, kind: 'insts_short' },
  { phrase: /insts, (\d+) trads\b/g, expected: C.TRADITIONS.length, kind: 'trads_short' },
  {
    phrase: /dominates at (\d+)\/\d+/g,
    expected: GLOBAL_FAMILY_COUNT,
    kind: 'global_family_count',
  },
  {
    phrase: /dominates at \d+\/(\d+)/g,
    expected: C.TRADITIONS.length,
    kind: 'global_family_total',
  },
  {
    phrase: /(\d+) of \d+ ids contain dots/g,
    expected: DOTTED_NODE_COUNT,
    kind: 'dotted_node_count',
  },
  {
    phrase: /\d+ of (\d+) ids contain dots/g,
    expected: C.TREE_NODES.length,
    kind: 'dotted_node_total',
  },
];

const PRAGMA_RE = /<!--\s*check_docs:ignore\s*-->/;

function lineNumberAt(content, index) {
  return content.substring(0, index).split('\n').length;
}

function lineAt(content, lineNum) {
  return content.split('\n')[lineNum - 1] || '';
}

const numericFailures = [];
// file → [{start, end, expected}] for --fix, collected during the same scan so a
// repair can never target a claim the check would not have flagged.
const repairs = new Map();
for (const { rel, abs, content } of activeMarkdowns) {
  for (const check of COUNT_CHECKS) {
    // Recompiled with `d` so the capture group reports its own offsets. Several
    // patterns capture the SECOND number in a claim ("288 of 312 ids contain
    // dots", "dominates at 733/2503"), and searching the match text for the
    // captured digits picks the wrong one whenever the two happen to be equal.
    // hasIndices removes the guess.
    const re = new RegExp(check.phrase.source, check.phrase.flags + 'd');
    let m;
    while ((m = re.exec(content)) !== null) {
      const found = parseInt(m[1].replace(/,/g, ''), 10);
      if (found === check.expected) continue;
      if (isSubsetClaim(content, m.index, m.index + m[0].length)) continue;
      const lineNum = lineNumberAt(content, m.index);
      const line = lineAt(content, lineNum);
      if (PRAGMA_RE.test(line)) continue;
      const [numStart, numEnd] = m.indices[1];
      if (!repairs.has(abs)) repairs.set(abs, []);
      repairs.get(abs).push({
        start: numStart,
        end: numEnd,
        // Preserve the source's own thousands-separator convention: README
        // writes 1,167 and the agent docs write 1167, and a repair must not
        // silently restyle either into the other.
        text: m[1].includes(',') ? check.expected.toLocaleString('en-US') : String(check.expected),
      });
      numericFailures.push({
        file: rel,
        line: lineNum,
        kind: check.kind,
        found,
        expected: check.expected,
        context: line.trim().slice(0, 120),
      });
    }
  }
}

// ───────────────────────── --fix: derive instead of transcribe ─────────────────────────
//
// The counts in these docs are a copy of a fact the catalog already holds, kept
// in sync by hand. llms.txt does not have this problem — build_discovery.js
// interpolates ${tindex.count} into it, so it is structurally incapable of
// drifting. AGENTS.md cannot be generated the same way (it is served raw and is
// mostly hand-written prose), but the NUMBERS in it can still stop being
// something anyone types: --fix rewrites them from the loader.
//
// That is the difference between a smoke detector and not keeping petrol in the
// hallway. The check stays — it is what makes the gate two-sided — but the
// routine path after a catalog import is now `npm run fix:docs`, not "notice the
// gate went red, then hand-edit the number the gate just told you".
if (FIX) {
  for (const [abs, edits] of repairs) {
    // Right-to-left so each splice leaves earlier offsets valid.
    edits.sort((a, b) => b.start - a.start);
    let out = fs.readFileSync(abs, 'utf-8');
    for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    fs.writeFileSync(abs, out);
  }
}

// ───────────────────────── Script-reference check ─────────────────────────

// The trailing boundary matters: without it `scripts/_duplicate_rulings.json`
// matches as `_duplicate_rulings.js` and is reported as a missing script.
const SCRIPT_REF_RE = /scripts\/([a-z_0-9]+\.js)(?![a-z0-9])/g;
const scriptRefs = new Map(); // script → array of {file, line}

for (const { rel, content } of activeMarkdowns) {
  SCRIPT_REF_RE.lastIndex = 0;
  let m;
  while ((m = SCRIPT_REF_RE.exec(content)) !== null) {
    const script = m[1];
    const lineNum = lineNumberAt(content, m.index);
    if (!scriptRefs.has(script)) scriptRefs.set(script, []);
    scriptRefs.get(script).push({ file: rel, line: lineNum });
  }
}

const missingScripts = [];
for (const [script, sources] of scriptRefs) {
  if (!fs.existsSync(path.join(ROOT, 'scripts', script))) {
    missingScripts.push({ script, sources });
  }
}

// ───────────────────────── Audit-derived counts (opt-in) ─────────────────────────

const auditFailures = [];

function runCapture(cmd, args) {
  // execSync throws on non-zero exit. Audit scripts exit 1 when issues found
  // (which is informational, not an error). Capture output either way.
  try {
    return execSync([cmd, ...args].join(' '), {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (e) {
    if (e.stdout) return e.stdout;
    throw e;
  }
}

if (WITH_AUDITS) {
  // audit_dead_tokens.js
  try {
    const out = runCapture('node', ['scripts/audit_dead_tokens.js']);
    const isClean = /AUDIT: CLEAN/.test(out);
    const flagged = isClean ? 0 : (out.match(/^\s+\S+:/gm) || []).length;
    // Search for claims like "audit_dead_tokens.js flags X prefaces"
    for (const { rel, content } of activeMarkdowns) {
      const re = /audit_dead_tokens\.js\s+flags?\s+(\d+)\s+prefaces/gi;
      let m;
      while ((m = re.exec(content)) !== null) {
        const found = parseInt(m[1], 10);
        const lineNum = lineNumberAt(content, m.index);
        if (PRAGMA_RE.test(lineAt(content, lineNum))) continue;
        if (found !== flagged) {
          auditFailures.push({
            file: rel,
            line: lineNum,
            kind: 'dead_token_count',
            found,
            expected: flagged,
            context: lineAt(content, lineNum).trim().slice(0, 120),
          });
        }
      }
    }
  } catch (e) {
    auditFailures.push({ error: 'audit_dead_tokens failed to run: ' + e.message });
  }

  // audit_profile_size.js
  try {
    const out = runCapture('node', ['scripts/audit_profile_size.js']);
    const flagged = (out.match(/tokens \(must be 9\)/g) || []).length;
    for (const { rel, content } of activeMarkdowns) {
      const re = /audit_profile_size\.js\s+flags?\s+(\d+)\s+prefaces/gi;
      let m;
      while ((m = re.exec(content)) !== null) {
        const found = parseInt(m[1], 10);
        const lineNum = lineNumberAt(content, m.index);
        if (PRAGMA_RE.test(lineAt(content, lineNum))) continue;
        if (found !== flagged) {
          auditFailures.push({
            file: rel,
            line: lineNum,
            kind: 'profile_size_count',
            found,
            expected: flagged,
            context: lineAt(content, lineNum).trim().slice(0, 120),
          });
        }
      }
    }
  } catch (e) {
    auditFailures.push({ error: 'audit_profile_size failed to run: ' + e.message });
  }
}

const smokeFailures = [];

if (WITH_SMOKE) {
  // smoke ceiling assertions
  try {
    const out = runCapture('node', ['scripts/smoke.js']);
    const m = out.match(/total:\s*(\d+)/);
    const total = m ? parseInt(m[1], 10) : null;
    if (total !== null) {
      for (const { rel, content } of activeMarkdowns) {
        const re = /(\d+)\s+recipe-stack\s+ceiling\s+assertions/gi;
        let m2;
        while ((m2 = re.exec(content)) !== null) {
          const found = parseInt(m2[1], 10);
          const lineNum = lineNumberAt(content, m2.index);
          if (PRAGMA_RE.test(lineAt(content, lineNum))) continue;
          if (found !== total) {
            smokeFailures.push({
              file: rel,
              line: lineNum,
              kind: 'smoke_ceiling_assertions',
              found,
              expected: total,
              context: lineAt(content, lineNum).trim().slice(0, 120),
            });
          }
        }
      }
    }
  } catch (e) {
    smokeFailures.push({ error: 'smoke.js failed to run: ' + e.message });
  }

  // no_iconic_descriptor advisories
  try {
    const out = runCapture('node', ['scripts/audit.js', '--section=no_iconic_descriptor']);
    const m = out.match(/\[no_iconic_descriptor\]\s+(\d+)/);
    const count = m ? parseInt(m[1], 10) : null;
    if (count !== null) {
      for (const { rel, content } of activeMarkdowns) {
        const re = /\((\d+)\s+advisories/gi;
        let m2;
        while ((m2 = re.exec(content)) !== null) {
          const found = parseInt(m2[1], 10);
          const lineNum = lineNumberAt(content, m2.index);
          if (PRAGMA_RE.test(lineAt(content, lineNum))) continue;
          if (found !== count) {
            smokeFailures.push({
              file: rel,
              line: lineNum,
              kind: 'no_iconic_advisories',
              found,
              expected: count,
              context: lineAt(content, lineNum).trim().slice(0, 120),
            });
          }
        }
      }
    }
  } catch (e) {
    smokeFailures.push({ error: 'audit no_iconic_descriptor failed: ' + e.message });
  }
}

// ───────────────────────── Report ─────────────────────────

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        scope: {
          activeMarkdowns: activeMarkdowns.length,
          totalMarkdowns: allMarkdowns.length,
          withAudits: !!WITH_AUDITS,
          withSmoke: !!WITH_SMOKE,
        },
        numericFailures,
        missingScripts,
        auditFailures,
        smokeFailures,
      },
      null,
      2
    )
  );
  process.exit(
    numericFailures.length + missingScripts.length + auditFailures.length + smokeFailures.length > 0
      ? 1
      : 0
  );
}

console.log(`=== Documentation verification ===`);
console.log(
  `(${activeMarkdowns.length} active docs scanned: *.md + llms.txt + index.html; CHANGELOG/tests + codex.html excluded)\n`
);

// Numeric counts
console.log(`[NUMERIC CLAIMS]  (${COUNT_CHECKS.length} count types)`);
if (numericFailures.length === 0) {
  console.log(`  ✓ All canonical counts match current catalog state.`);
} else {
  for (const f of numericFailures) {
    console.log(`  ✗ ${f.file}:${f.line} — claims ${f.found} ${f.kind} (actual: ${f.expected})`);
    console.log(`      "${f.context}"`);
  }
}
console.log();

// Script refs
console.log(`[SCRIPT REFERENCES]  (${scriptRefs.size} unique refs across active docs)`);
if (missingScripts.length === 0) {
  console.log(`  ✓ All script refs resolve to existing files.`);
} else {
  for (const m of missingScripts) {
    console.log(`  ✗ scripts/${m.script} — does not exist in scripts/`);
    for (const src of m.sources) console.log(`      referenced at ${src.file}:${src.line}`);
  }
}
console.log();

// Audit findings
if (WITH_AUDITS) {
  console.log(`[AUDIT-DERIVED COUNTS]  (dead_tokens, profile_size)`);
  if (auditFailures.length === 0) {
    console.log(`  ✓ Audit-derived count claims match current audit output.`);
  } else {
    for (const f of auditFailures) {
      if (f.error) {
        console.log(`  ⚠ ${f.error}`);
        continue;
      }
      console.log(`  ✗ ${f.file}:${f.line} — claims ${f.found} ${f.kind} (actual: ${f.expected})`);
      console.log(`      "${f.context}"`);
    }
  }
  console.log();
}

if (WITH_SMOKE) {
  console.log(`[SMOKE + ADVISORY COUNTS]  (smoke.js + no_iconic_descriptor)`);
  if (smokeFailures.length === 0) {
    console.log(`  ✓ Smoke + advisory claims match current output.`);
  } else {
    for (const f of smokeFailures) {
      if (f.error) {
        console.log(`  ⚠ ${f.error}`);
        continue;
      }
      console.log(`  ✗ ${f.file}:${f.line} — claims ${f.found} ${f.kind} (actual: ${f.expected})`);
      console.log(`      "${f.context}"`);
    }
  }
  console.log();
}

const totalFailures =
  numericFailures.length + missingScripts.length + auditFailures.length + smokeFailures.length;
if (totalFailures === 0) {
  console.log(`PASS — no drift detected.`);
  if (!WITH_AUDITS && !WITH_SMOKE) {
    console.log(`(Run with --with-audits for fast audit-count checks, or --all for full sweep.)`);
  }
  process.exit(0);
} else {
  console.log(`FAIL — ${totalFailures} drift issue(s) above.`);
  process.exit(1);
}
