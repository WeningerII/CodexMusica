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
//
// Exits 0 if all checks pass, 1 if any drift detected.

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
const EXCLUDED_FILES = ['CHANGELOG.md'];

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
// Each pattern matches "X NOUN" but EXCLUDES when followed by qualifier words
// like "with", "flagged", "of", "in", "are" — those phrasings denote subset
// counts (e.g. "42 prefaces with 8 tokens", "5 traditions flagged by audit")
// rather than canonical catalog totals. The pragma override remains available
// for any edge case the regex misclassifies.

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
const Q_NEG = `(?!\\s+(?:${QUALIFIERS.join('|')})\\b)`;

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
    phrase: new RegExp(`${N}(?:\\s+(?:recorded-music|music))?\\s+traditions\\b${Q_NEG}`, 'g'),
    expected: C.TRADITIONS.length,
    kind: 'traditions',
  },
  {
    phrase: new RegExp(`${N} instruments\\b${Q_NEG}`, 'g'),
    expected: C.INSTRUMENTS.length,
    kind: 'instruments',
  },
  {
    phrase: new RegExp(`${N} prefaces\\b${Q_NEG}`, 'g'),
    expected: C.PREFACE_LEXICON.length,
    kind: 'prefaces',
  },
  { phrase: new RegExp(`${N} rooms\\b${Q_NEG}`, 'g'), expected: C.ROOMS.length, kind: 'rooms' },
  {
    phrase: new RegExp(`${N} chain archetypes\\b${Q_NEG}`, 'g'),
    expected: C.CHAIN_ARCHETYPES.length,
    kind: 'chain_archetypes',
  },
  {
    phrase: new RegExp(`${N} production aesthetics\\b${Q_NEG}`, 'g'),
    expected: C.PRODUCTION_AESTHETICS.length,
    kind: 'production_aesthetics',
  },
  {
    phrase: new RegExp(`${N} tunings\\b${Q_NEG}`, 'g'),
    expected: C.TUNINGS.length,
    kind: 'tunings',
  },
  {
    phrase: new RegExp(`${N} tree nodes\\b${Q_NEG}`, 'g'),
    expected: C.TREE_NODES.length,
    kind: 'tree_nodes',
  },
  {
    phrase: new RegExp(`${N} catalog tables\\b${Q_NEG}`, 'g'),
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
for (const { rel, content } of activeMarkdowns) {
  for (const check of COUNT_CHECKS) {
    check.phrase.lastIndex = 0;
    let m;
    while ((m = check.phrase.exec(content)) !== null) {
      const found = parseInt(m[1].replace(/,/g, ''), 10);
      if (found === check.expected) continue;
      const lineNum = lineNumberAt(content, m.index);
      const line = lineAt(content, lineNum);
      if (PRAGMA_RE.test(line)) continue;
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
