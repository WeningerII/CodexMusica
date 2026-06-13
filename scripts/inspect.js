#!/usr/bin/env node
// inspect.js — diagnostic tool for any tradition's variant selection.
//
// Shows what got picked, what almost picked, what scored zero, and why —
// across every part of every instrument, plus chain-section selections.
// Replaces ad-hoc node REPL debugging when investigating "why did X surface
// for tradition Y" or "why didn't Z surface for tradition Y."
//
// USAGE
//   node scripts/inspect.js --tradition=<id>
//   node scripts/inspect.js --tradition=<id> --staples=<id1>,<id2>
//   node scripts/inspect.js --tradition=<id> --instrument=<inst_id>
//   node scripts/inspect.js --tradition=<id> --part=<part_id>
//   node scripts/inspect.js --tradition=<id> --runner-up=N         # show top N candidates per slot
//   node scripts/inspect.js --tradition=<id> --threshold=N         # only show variants scoring >= N
//   node scripts/inspect.js --tradition=<id> --filtered            # also show what got filtered by translate
//
// EXIT
//   0 — diagnostic ran cleanly
//   2 — bad arguments

const C = require('./_loader.js');
const { buildMergedContext, scoreVariant } = require('./score.js');

const args = process.argv.slice(2);
const flags = {};
// Accept both --flag=value and --flag value (the latter previously became
// flags.flag === true, then failed downstream as "Unknown tradition: true").
// BOOLEAN_FLAGS never consume the next token.
const BOOLEAN_FLAGS = new Set(['filtered']);
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (!a.startsWith('--')) continue;
  const eq = a.indexOf('=');
  if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
  const name = a.slice(2);
  const next = args[i + 1];
  if (!BOOLEAN_FLAGS.has(name) && next !== undefined && !next.startsWith('--')) { flags[name] = next; i++; }
  else flags[name] = true;
}

if (!flags.tradition) {
  console.error('Usage: inspect.js --tradition=<id> [--staples=id1,id2] [--instrument=id] [--part=id] [--runner-up=N] [--threshold=N] [--filtered]');
  process.exit(2);
}

const tid = flags.tradition;
const staples = flags.staples ? flags.staples.split(',') : [];
const filterInstrument = flags.instrument || null;
const filterPart = flags.part || null;
const runnerUpCount = parseInt(flags['runner-up']) || 3;
const minScore = flags.threshold !== undefined ? parseFloat(flags.threshold) : null;
const showFiltered = !!flags.filtered;

const t = C.TRADITIONS.find(x => x.id === tid);
if (!t) {
  console.error(`Unknown tradition: ${tid}`);
  process.exit(2);
}

const allIds = [tid, ...staples];
for (const sid of staples) {
  if (!C.TRADITIONS.find(x => x.id === sid)) {
    console.error(`Unknown staple tradition: ${sid}`);
    process.exit(2);
  }
}

// ─────────────── HEADER ───────────────
const e = C.TRADITION_EXTRAS[tid] || {};
console.log(`╔════════════════════════════════════════════════════════════════════════════`);
console.log(`║ INSPECT: ${t.name} (${tid})`);
if (staples.length) console.log(`║ STAPLED: ${staples.join(', ')}`);
console.log(`║ parent: ${e.parent || '(none)'}`);
console.log(`║ crossRefs: ${(e.crossRefs || []).map(cr => (cr && typeof cr === 'object') ? cr.ref : cr).join(', ') || '(none)'}`);
console.log(`║ instruments: ${(t.instruments || []).join(', ')}`);
console.log(`║ room: ${t.room || '(none)'}    archetype: ${t.chain_archetype || '(inline)'}`);
console.log(`║ chain inline: mic=${t.chain_mic || '?'} pre=${t.chain_pre || '?'} medium=${t.chain_medium || '?'} console=${t.chain_console || '?'}`);
console.log(`╚════════════════════════════════════════════════════════════════════════════\n`);

// ─────────────── CONTEXT TOKENS ───────────────
const ctx = buildMergedContext(allIds, 0.5);
if (!ctx) {
  console.error(`Failed to build context for ${tid}`);
  process.exit(2);
}
console.log(`── CONTEXT TOKENS (top 15 per space by weight) ──`);
function showTopN(map, label, n = 15) {
  const m = map || new Map();
  const entries = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  console.log(`\n  [${label}] (${m.size} unique)`);
  for (const [k, w] of entries) {
    console.log(`    ${w.toFixed(2).padStart(6)}  ${k}`);
  }
}
showTopN(ctx.prose, 'prose');
showTopN(ctx.compounds, 'compounds');
showTopN(ctx.singles, 'singles');
console.log('');

// ─────────────── PER-INSTRUMENT VARIANT SCORING ───────────────
console.log(`── INSTRUMENT VARIANT SELECTION ──\n`);

const allInstrumentIds = new Set(t.instruments || []);
for (const sid of staples) {
  const s = C.TRADITIONS.find(x => x.id === sid);
  if (s && Array.isArray(s.instruments)) for (const iid of s.instruments) allInstrumentIds.add(iid);
}

const instrumentList = filterInstrument ? [filterInstrument] : [...allInstrumentIds];

for (const iid of instrumentList) {
  const i = C.INSTRUMENTS.find(x => x.id === iid);
  if (!i) {
    console.log(`[${iid}] NOT FOUND in catalog`);
    continue;
  }
  console.log(`▸ ${iid}  (family: ${i.family})`);

  const partsList = filterPart
    ? (i.parts || []).filter(p => p.id === filterPart)
    : (i.parts || []);

  for (const part of partsList) {
    const isFamilyPart = !!part._fromFamily;
    const tag = isFamilyPart ? '[family]' : '[own]   ';
    console.log(`  ${tag} ${part.id}`);

    // Score every variant. Mirror the engine's auto-pick semantics so the ✓
    // marks the variant the engine ACTUALLY selects (search.js seedFromTradition),
    // not merely the top raw score: `auto: false` variants are explicit-only and
    // never auto-picked, and ties break toward the canonical `default: true`.
    const scored = [];
    for (const v of (part.variants || [])) {
      const r = scoreVariant(v, ctx, { useNeighbors: true });
      scored.push({
        id: v.id,
        score: r.score,
        descriptors: v.descriptors || [],
        applies_to: v.applies_to || null,
        auto: v.auto,
        isDefault: v.default === true,
      });
    }
    scored.sort((a, b) => b.score - a.score);

    // The engine's actual auto-pick: highest score among auto-eligible variants,
    // ties resolved toward the canonical default.
    const pick = scored
      .filter(s => s.auto !== false)
      .reduce((best, s) => {
        if (!best) return s;
        if (s.score > best.score) return s;
        if (s.score === best.score && s.isDefault && !best.isDefault) return s;
        return best;
      }, null);

    // Show top N with a clear marker for the engine's pick
    const toShow = scored.slice(0, runnerUpCount);
    for (let idx = 0; idx < toShow.length; idx++) {
      const s = toShow[idx];
      if (minScore !== null && s.score < minScore) continue;
      const marker = (pick && s.id === pick.id) ? '✓' : ' ';
      const score = s.score.toFixed(3).padStart(8);
      const id = s.id.padEnd(34);
      const tags = [];
      if (s.applies_to && !s.applies_to.includes(iid)) tags.push('applies_to-filtered');
      if (s.auto === false) tags.push('explicit-only');
      const filtered = tags.length ? ' [' + tags.join(', ') + ']' : '';
      console.log(`     ${marker} ${score}  ${id} ${filtered}`);
      if (s.descriptors.length > 0) {
        const d = s.descriptors.slice(0, 8).join(', ');
        console.log(`                  descriptors: [${d}]`);
      }
    }
    if (scored.length > toShow.length) {
      console.log(`       (... ${scored.length - toShow.length} more variants below threshold)`);
    }
  }
  console.log('');
}

// ─────────────── ROOM + ARCHETYPE FRAMING ───────────────
console.log(`── ROOM CONTEXT ──`);
if (t.room) {
  const room = C.ROOMS.find(r => r.id === t.room);
  if (room) {
    console.log(`  room=${room.id}`);
    console.log(`  era=${room.era || '?'}  region=${room.region || '?'}`);
    console.log(`  descriptors=${(room.descriptors || []).join(', ') || '(none)'}`);
  } else {
    console.log(`  room=${t.room} (NOT FOUND)`);
  }
}
console.log('');

if (t.chain_archetype) {
  console.log(`── ARCHETYPE CONTEXT ──`);
  const arch = C.CHAIN_ARCHETYPES.find(a => a.id === t.chain_archetype);
  if (arch) {
    console.log(`  archetype=${arch.id}`);
    console.log(`  era=${arch.era || '?'}  region=${arch.region || '?'}`);
    console.log(`  components: mic=${arch.components?.mic} pre=${arch.components?.pre} console=${arch.components?.console} medium=${arch.components?.medium}`);
    console.log(`  comp=${arch.components?.comp || '?'} eq=${arch.components?.eq || '?'}`);
    console.log(`  fx=${(arch.components?.fx || []).join(', ') || '(none)'}`);
  } else {
    console.log(`  archetype=${t.chain_archetype} (NOT FOUND)`);
  }
  console.log('');
}

// ─────────────── TRANSLATE-FILTERED OUTPUT ───────────────
if (showFiltered) {
  console.log(`── TRANSLATE OUTPUT (what surfaces in the recipe) ──`);
  const { seedFromTradition } = require('./search.js');
  const { translate } = require('./translate.js');
  const seed = seedFromTradition(tid, staples);
  const out = translate(seed);
  console.log('  ' + out);
  console.log('');
}

console.log(`(end inspect — for finer detail use --instrument=ID or --part=ID to scope)`);
