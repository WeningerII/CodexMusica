#!/usr/bin/env node
// audit_picks.js — for every tradition that uses the target instrument,
// compare the variant pick for the target part under two scoring contexts:
//   - PRIMARY: just the primary tradition (`buildContext(tradId)`)
//   - STAPLED: the hill-climber-chosen tradition stack (primary + staples
//     it actually selected, with isolated_parts respected for the target slot)
//
// When the top pick differs between the two contexts, it's a mismatch. The
// audit records both top-3 lists so an operator can classify each mismatch:
//
//   A — flip target: the stapled pick is wrong, primary pick is what we'd want
//   B — current right: stapled pick is correct, primary alone would regress
//   C — bin-3 defensible: stapled pick is one of several reasonable choices
//
// Output JSON to `tests/<instrument>_<part>_audit.json` and markdown to stdout
// (or `--out=<path>`).
//
// NOT in build pipeline. Run on demand when refactoring scoring or staple
// logic to catch unintended drift; tandem.js consumes the JSON for
// classification-coherence checks against `tests/pick_audit_classifications.json`.
//
// ⚠ RUNNING THIS SCRIPT REGENERATES tests/<instrument>_<part>_audit.json —
//   IT IS NOT READ-ONLY. The companion file tests/pick_audit_classifications.json
//   is HAND-CURATED to match a specific snapshot of each slot's mismatch set,
//   bucketed into resolved_via_isolated_parts / B_current_right / C_bin3 /
//   C_tied_scores. The tandem check `pick_audit_classifications coherent`
//   enforces the alignment.
//
//   If the catalog has drifted since the last classifications refresh,
//   re-running this script will surface real drift but will break the
//   tandem check until classifications are updated (add new mismatch
//   classifications, remove stale ones). That refresh requires domain
//   knowledge — you have to bucket each new mismatch and write the rationale.
//
// USAGE
//   node scripts/audit_picks.js --instrument=<id> --part=<id>
//   node scripts/audit_picks.js --instrument=<id> --part=<id> --tradition=<id>     # single-tradition mode
//   node scripts/audit_picks.js --instrument=<id> --part=<id> --out=<path>         # custom markdown output
//   node scripts/audit_picks.js --instrument=<id> --part=<id> --json-only          # skip markdown stdout
//
// EXAMPLES
//   node scripts/audit_picks.js --instrument=drum_kit --part=shell_wood
//   node scripts/audit_picks.js --instrument=electric_guitar_humbucker --part=body_wood

const fs = require('fs');
const path = require('path');
const C = require(path.join(__dirname, '_loader.js'));
const { search, seedFromTradition } = require(path.join(__dirname, 'search.js'));
const { buildContext, buildMergedContext, isolatedStaplesForPart, scoreVariant } = require(
  path.join(__dirname, 'score.js')
);

// Locale-invariant ordering: localeCompare with no locale argument collates by
// the machine's ICU locale, which made this ordering depend on where it ran.
// Mirrors `_cmp` in scripts/_recipe_stack.js.
const _cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// === CLI parsing ===
const flags = {};
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--')) {
    const eq = a.indexOf('=');
    if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else flags[a.slice(2)] = true;
  }
}
const TARGET_INSTRUMENT = flags.instrument;
const TARGET_PART = flags.part;
const SINGLE_TRAD = flags.tradition || null;
const OUT_PATH = flags.out || null;
const JSON_ONLY = !!flags['json-only'];

if (!TARGET_INSTRUMENT || !TARGET_PART) {
  console.error(
    'Usage: audit_picks.js --instrument=<id> --part=<id> [--tradition=<id>] [--out=<path>] [--json-only] [--dry-run]'
  );
  process.exit(2);
}

// === Locate instrument and part definitions ===
const inst = C.INSTRUMENTS.find((x) => x.id === TARGET_INSTRUMENT);
if (!inst) {
  console.error(`Unknown instrument: ${TARGET_INSTRUMENT}`);
  process.exit(2);
}

// Find the part — it may be defined inline on the instrument OR inherited
// from a family-parts shared definition. _loader.js merges family parts onto
// instruments before exposing them.
const part = (inst.parts || []).find((p) => p.id === TARGET_PART);
if (!part) {
  console.error(`Unknown part ${TARGET_PART} on instrument ${TARGET_INSTRUMENT}`);
  process.exit(2);
}

// === Find all traditions that use this instrument ===
const candidateTraditions = SINGLE_TRAD
  ? C.TRADITIONS.filter(
      (t) => t.id === SINGLE_TRAD && (t.instruments || []).includes(TARGET_INSTRUMENT)
    )
  : C.TRADITIONS.filter((t) => (t.instruments || []).includes(TARGET_INSTRUMENT));

if (candidateTraditions.length === 0) {
  console.error(
    `No tradition uses ${TARGET_INSTRUMENT}${SINGLE_TRAD ? ` (looked up ${SINGLE_TRAD})` : ''}`
  );
  process.exit(2);
}

// === Score every variant of the part under a given context ===
// Note: variant.surface and part.surface control whether picks SHOW in the
// recipe text output. They do NOT exclude variants from scoring — the
// hill-climber still picks among them, and the audit needs to follow that.
function scoreAllVariants(context) {
  const out = [];
  for (const v of part.variants || []) {
    const result = scoreVariant(v, context, { useNeighbors: true });
    out.push({ id: v.id, score: Number(result.score.toFixed(4)) });
  }
  out.sort((a, b) => b.score - a.score || _cmp(a.id, b.id));
  return out;
}

// === For each candidate tradition, run the audit ===
const records = [];
for (const t of candidateTraditions) {
  const e = C.TRADITION_EXTRAS[t.id] || {};

  // Step 1: run the hill-climber to get the staple set it actually picks
  const seed = seedFromTradition(t.id);
  if (!seed) continue;
  let searchResult;
  try {
    searchResult = search(seed, { maxIters: 200 });
  } catch (err) {
    console.error(`  ${t.id}: search failed (${err.message}), skipping`);
    continue;
  }
  const allTradIds = searchResult.config.traditions || [t.id];
  const stapleIds = allTradIds.slice(1); // primary is index 0; rest are staples

  // Step 2: compute isolation set for the target part. Staples isolated for
  // this part don't contribute to its scoring.
  const isolated = isolatedStaplesForPart(t.id, allTradIds, TARGET_PART);
  const stapleIdsForPart = stapleIds.filter((sid) => !isolated.has(sid));

  // Step 3: build the two contexts.
  const primaryCtx = buildContext(t.id);
  if (!primaryCtx) continue;
  const stapledCtx = buildMergedContext([t.id, ...stapleIdsForPart]);
  if (!stapledCtx) continue;

  // Step 4: score every variant under each context, take top-3.
  const primaryRanked = scoreAllVariants(primaryCtx).slice(0, 3);
  const stapledRanked = scoreAllVariants(stapledCtx).slice(0, 3);
  if (primaryRanked.length === 0 || stapledRanked.length === 0) continue;

  const primaryPick = primaryRanked[0];
  const stapledPick = stapledRanked[0];
  const mismatch = primaryPick.id !== stapledPick.id;

  // Record. crossRefs schema can be string or { ref, isolated_parts, voice_isolated }.
  const crossRefs = (e.crossRefs || []).map((cr) =>
    typeof cr === 'string'
      ? cr
      : cr.isolated_parts || cr.voice_isolated
        ? {
            ref: cr.ref,
            isolated_parts: cr.isolated_parts || (cr.voice_isolated ? ['voice_quality'] : []),
          }
        : cr.ref
  );

  records.push({
    tid: t.id,
    name: t.name || t.id,
    family: e.family || null,
    parent: e.parent || null,
    lineage: e.lineage || null,
    crossRefs,
    staples: stapleIdsForPart,
    current_pick: stapledPick.id,
    current_pick_score: stapledPick.score,
    primary_pick: primaryPick.id,
    primary_pick_score: primaryPick.score,
    mismatch,
    primary_top: primaryRanked,
    stapled_top: stapledRanked,
  });
}

// === Output ===
const mismatches = records.filter((r) => r.mismatch);

// Voice gets a slightly different schema for backward compat (and because
// SKILL.md describes voice as the only slot with classification-coherence
// enforced by tandem). Keep both shapes.
const isVoice = TARGET_INSTRUMENT === 'voice' && TARGET_PART === 'voice_quality';
const outputJson = isVoice
  ? {
      generated_at: new Date().toISOString(),
      total_voice_traditions: records.length,
      mismatch_count: mismatches.length,
      records: mismatches,
    }
  : {
      generated_at: new Date().toISOString(),
      target: `${TARGET_INSTRUMENT}/${TARGET_PART}`,
      total_traditions: records.length,
      mismatch_count: mismatches.length,
      records: mismatches,
    };

const slotKey = `${TARGET_INSTRUMENT}_${TARGET_PART}`;
const DRY_RUN = flags['dry-run'] === true || flags['dry-run'] === '';
const jsonPath = DRY_RUN
  ? path.join('/tmp', isVoice ? 'voice_audit.json' : `${slotKey}_audit.json`)
  : isVoice
    ? path.join(__dirname, '..', 'tests', 'voice_audit.json')
    : path.join(__dirname, '..', 'tests', `${slotKey}_audit.json`);
fs.writeFileSync(jsonPath, JSON.stringify(outputJson, null, 2) + '\n');
console.error(
  `Wrote ${jsonPath} (${mismatches.length} mismatch(es) across ${records.length} traditions)`
);

// Markdown output for human review (unless --json-only)
if (!JSON_ONLY) {
  const md = [];
  md.push(`# Pick audit — ${TARGET_INSTRUMENT} / ${TARGET_PART}`);
  md.push('');
  md.push(`Generated: ${outputJson.generated_at}`);
  md.push(`Traditions audited: ${records.length}`);
  md.push(`Mismatches: ${mismatches.length}`);
  md.push('');
  if (mismatches.length === 0) {
    md.push('No mismatches.');
  } else {
    md.push('| Tradition | Primary pick | Stapled pick | Staples |');
    md.push('|---|---|---|---|');
    for (const r of mismatches) {
      const stapleList = (r.staples || []).join(', ') || '—';
      md.push(
        `| \`${r.tid}\` | \`${r.primary_pick}\` (${r.primary_pick_score}) | \`${r.current_pick}\` (${r.current_pick_score}) | ${stapleList} |`
      );
    }
  }
  const mdText = md.join('\n') + '\n';
  if (OUT_PATH) {
    fs.writeFileSync(OUT_PATH, mdText);
    console.error(`Wrote ${OUT_PATH}`);
  } else {
    process.stdout.write(mdText);
  }
}
