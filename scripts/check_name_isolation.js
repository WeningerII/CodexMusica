#!/usr/bin/env node
// check_name_isolation.js — one tradition's picks may not depend on ANOTHER
// tradition's name.
//
// @covers: name-isolation
//
// THE INVARIANT. A tradition's compiled configuration is a function of its own
// record plus the sound-bearing content of the records around it — lineage,
// family, parent path, room, archetype. It is NOT a function of what those
// other records happen to be CALLED. A name is a label: it gets edited for
// readability, it carries era and place tags for the reader's benefit, and none
// of that was ever a claim about how anything sounds.
//
// WHY THIS EXISTS. It was violated, quietly, for a long time. `scoreVariant`
// consults nearest-neighbour traditions (neighbor-bias) and the hill-climber
// staples a primary's crossRef siblings into the scoring stack on its own
// (search.js traditionStapleMoves). Both paths built the other tradition's FULL
// context, name included. So `Aussie pub rock (70s-80s)` put the tokens `70s`
// and `80s` into the prose of every tradition that had it as a neighbour, and
// the Marshall JCM800 — descriptors "British 80s rock amp" — collected the
// bonus. merseybeat, a tradition dated 1962-1968, was compiled with a 1981
// amplifier because a SIBLING record's name mentioned a decade. Removing the
// parenthetical then silently moved two unrelated traditions' gear, which is
// how the coupling was found at all: a cosmetic rename should not be able to
// change what anyone records.
//
// HOW IT IS TESTED. Two child processes compile the same sample of traditions.
// The second one first rewrites EVERY OTHER tradition's name to carry an
// adversarial payload — era tokens, gear words, a bare year — chosen because
// they are exactly the tokens a variant descriptor would match on. The observer
// tradition's own name is left alone, since a tradition scoring against its own
// name is self-description and is supposed to matter. If any observer's config
// differs between the runs, some other record's label reached its picks.
//
// Configs are compared, not recipe strings: sentence 1 legitimately PRINTS the
// names of the tradition and its staples, so the rendered text is expected to
// move when names move. What may not move is the choice.
//
// Usage: node scripts/check_name_isolation.js [--sample=N] [--verbose]
// Exit 0 if every sampled tradition is isolated, 1 otherwise.

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const sampleFlag = args.find((a) => a.startsWith('--sample='));
// 24 by default. Each observer costs two full compiles (~1.2s), and this gate
// runs twice per CI pass — once inside `npm run test`, once as its own step, the
// same shape check:rest already has. 24 keeps that under a minute total while
// staying far above the detection threshold: with the fix reverted, 10 of 12
// sampled traditions drift, so a 24-sample run cannot plausibly miss it.
const SAMPLE = sampleFlag ? parseInt(sampleFlag.slice('--sample='.length), 10) : 24;

// Tokens picked to be maximally attractive to the scorer: a 4-digit year well
// outside most traditions' era windows, decade forms the era-conflict guard does
// NOT understand (it only parses 4-digit years), and gear/production words that
// appear verbatim in variant descriptors across the catalog.
const PAYLOAD = ' 1985 80s 90s modern digital tube tape analog vintage distorted';

// The two known-affected traditions from the original defect are always sampled,
// then the rest of the catalog is sampled at a fixed stride for breadth. Fixed
// stride, not random: this gate must give the same verdict on every run.
const ALWAYS = ['merseybeat', 'mod_60s_british'];

const child = (payloadForOthers, observers) => `
const C = require(${JSON.stringify(path.join(ROOT, 'scripts', '_loader.js'))});
const OBS = ${JSON.stringify(observers)};
const PAYLOAD = ${JSON.stringify(payloadForOthers)};
if (PAYLOAD) {
  const keep = new Set(OBS);
  // Mutate BEFORE anything scores: score.js reads C.TRADITIONS at call time and
  // its context cache starts empty, so this is the whole catalog as far as
  // scoring is concerned.
  for (const t of C.TRADITIONS) if (!keep.has(t.id)) t.name = t.name + PAYLOAD;
}
const { search, seedFromTradition } = require(${JSON.stringify(path.join(ROOT, 'scripts', 'search.js'))});
const out = {};
for (const id of OBS) {
  const seed = seedFromTradition(id, [], {});
  if (!seed) { out[id] = null; continue; }
  const r = search(seed, { maxIters: 100 });
  // The tradition STACK is part of the answer (which siblings got stapled), and
  // so are the per-instrument slot picks and the environment.
  out[id] = JSON.stringify({
    traditions: r.config.traditions,
    room: r.config.room,
    tuning: r.config.tuning,
    archetype: r.config.archetype,
    aesthetic: r.config.aesthetic || null,
    instruments: (r.config.instruments || []).map((i) => [i.id, i.slots]),
  });
}
process.stdout.write(JSON.stringify(out));
`;

function run(payload, observers) {
  const out = execFileSync('node', ['-e', child(payload, observers)], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

const C = require('./_loader.js');
const all = (C.TRADITIONS || []).map((t) => t.id);
if (all.length === 0) {
  console.error('Name isolation: FAIL — catalog is empty (refusing to pass vacuously)');
  process.exit(1);
}
const observers = [...ALWAYS.filter((id) => all.includes(id))];
const stride = Math.max(1, Math.floor(all.length / Math.max(1, SAMPLE - observers.length)));
for (let i = 0; i < all.length && observers.length < SAMPLE; i += stride) {
  if (!observers.includes(all[i])) observers.push(all[i]);
}

console.log("=== Name isolation (another tradition's NAME may not move your picks) ===");
console.log(`  sampling ${observers.length} tradition(s) of ${all.length}`);

const before = run('', observers);
const after = run(PAYLOAD, observers);

let pass = 0;
const drifted = [];
for (const id of observers) {
  if (before[id] == null || after[id] == null) {
    drifted.push([id, 'no config produced']);
    continue;
  }
  if (before[id] === after[id]) {
    pass++;
    if (VERBOSE) console.log(`  ok   ${id}`);
  } else {
    const a = JSON.parse(before[id]);
    const b = JSON.parse(after[id]);
    const bits = [];
    if (JSON.stringify(a.traditions) !== JSON.stringify(b.traditions))
      bits.push(`stack ${JSON.stringify(a.traditions)} -> ${JSON.stringify(b.traditions)}`);
    for (const [iid, slots] of a.instruments) {
      const other = (b.instruments.find((x) => x[0] === iid) || [])[1];
      if (!other) {
        bits.push(`lost card ${iid}`);
        continue;
      }
      for (const k of Object.keys(slots))
        if (slots[k] !== other[k]) bits.push(`${iid}.${k}: ${slots[k]} -> ${other[k]}`);
    }
    if (a.room !== b.room) bits.push(`room ${a.room} -> ${b.room}`);
    if (a.tuning !== b.tuning) bits.push(`tuning ${a.tuning} -> ${b.tuning}`);
    drifted.push([id, bits.slice(0, 4).join('; ') || 'config differs']);
  }
}

for (const [id, why] of drifted) console.log(`  DRIFT ${id} :: ${why}`);
console.log(`  ${pass} isolated, ${drifted.length} drifted`);

// Refuse to pass vacuously — a sample that asserted nothing would mint a green
// result, the exact failure class the rest of this repo's gates are built against.
if (pass === 0 && drifted.length === 0) {
  console.error('FAIL — no traditions were compared; refusing to pass vacuously');
  process.exit(1);
}
if (drifted.length > 0) {
  console.error("FAIL — a tradition's picks changed when OTHER traditions were renamed.");
  console.error("       Some scoring or stapling path is reading a foreign record's label.");
  console.error('       buildContext takes { includeName: false } for exactly this reason —');
  console.error('       check that every cross-tradition call site passes it.');
  process.exit(1);
}
console.log("PASS — every sampled tradition ignored every other tradition's name.");
process.exit(0);
