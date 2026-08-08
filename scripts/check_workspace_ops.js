#!/usr/bin/env node
'use strict';
// check_workspace_ops.js — exercises the editable workspace: a seed → edit → re-render
// sequence mirroring what
// a human does on the canvas, asserting determinism, the verbatim-preface
// re-derive, roster add/remove, and state-passing immutability.
//
//   node scripts/check_workspace_ops.js

const C = require('./_loader.js');
const W = require('./_workspace_ops.js');

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const fail = (m) => {
  console.error('  ✗ ' + m);
  failures++;
};
const check = (name, cond, detail) =>
  cond ? ok(name) : fail(`${name}${detail ? ' — ' + detail : ''}`);
const has = (arr, id) => arr.some((x) => x.id === id);

const pick = (cands, pool) => cands.find((id) => has(pool, id)) || null;
const PREFACE = pick(
  ['satirical', 'keening', 'wailing', 'operatic', 'rocking', 'rebellious'],
  C.PREFACE_LEXICON || []
);
const GUEST = pick(['harmonica', 'saxophone', 'trumpet', 'tambourine'], C.INSTRUMENTS || []);

// ── baseline ──────────────────────────────────────────────────────────────
console.log('seed garage_rock:');
const ws0 = W.seed('garage_rock');
const r0 = W.render(ws0);
check('5 cards, header "Garage rock, "', ws0.cards.length === 5 && r0.startsWith('Garage rock, '));
const voicePrefaceBaseline = (r0.match(/Garage rock,\s*([a-z-]+) voice:/) || [])[1] || '(none)';
ok(`baseline voice preface: ${voicePrefaceBaseline}`);

// ── set_preface: deterministic re-derive + verbatim label ───────────────────
console.log(`\nset_preface(voice → ${PREFACE}):`);
if (!PREFACE) {
  fail('no candidate preface id present in lexicon');
} else {
  const before = JSON.stringify(ws0.cards[0].parts);
  const ws1 = W.setPreface(ws0, 'voice', PREFACE);
  const r1 = W.render(ws1);
  check(
    `recipe names "${PREFACE} voice:" verbatim`,
    new RegExp(`(^|,\\s*)${PREFACE} voice:`).test(r1),
    r1.slice(0, 80)
  );
  check(
    'voice settings were re-derived (parts changed)',
    JSON.stringify(ws1.cards[0].parts) !== before,
    'preface caused no change'
  );
  check('preface locked verbatim on the edited card', ws1.cards[0].prefaceLock === true);
  check('still ≤ 1000 chars', r1.length <= 1000, `${r1.length}`);
  check(
    'IMMUTABLE: ws0 voice untouched (no lock, original parts)',
    !ws0.cards[0].prefaceLock && JSON.stringify(ws0.cards[0].parts) === before
  );
}

// ── add / remove tradition (explicit staple, header reflects roster) ────────
console.log('\nadd_tradition(punk) then remove_tradition(punk):');
if (!has(C.TRADITIONS || [], 'punk')) {
  console.log('  – punk absent, skipped');
} else {
  const wsA = W.addTradition(ws0, 'punk');
  const rA = W.render(wsA);
  check(
    'header becomes "Garage rock + Punk, "',
    rA.startsWith('Garage rock + Punk, '),
    rA.slice(0, 40)
  );
  check(
    'punk cards added',
    wsA.cards.length > ws0.cards.length && wsA.cards.some((c) => c.traditionId === 'punk')
  );
  const wsB = W.removeTradition(wsA, 'punk');
  check(
    'remove restores "Garage rock, " and card count',
    W.render(wsB).startsWith('Garage rock, ') && wsB.cards.length === ws0.cards.length
  );
  check('IMMUTABLE: ws0 still 5 cards', ws0.cards.length === 5);
}

// ── add / remove instrument ─────────────────────────────────────────────────
console.log(`\nadd_instrument(${GUEST}) then remove:`);
if (!GUEST) {
  fail('no candidate guest instrument present');
} else {
  const wsC = W.addInstrument(ws0, GUEST, { tradition: 'garage_rock' });
  check(
    'card added + still renders ≤1000',
    wsC.cards.length === 6 && W.render(wsC).length <= 1000,
    `${wsC.cards.length}`
  );
  const wsD = W.removeInstrument(wsC, GUEST);
  check('removed back to 5', wsD.cards.length === 5);
}

// ── set_variant ─────────────────────────────────────────────────────────────
console.log('\nset_variant(electric_guitar_single_coil, body_wood → mahogany):');
const wsE = W.setVariant(ws0, 'electric_guitar_single_coil', 'body_wood', 'mahogany');
check(
  'guitar card body_wood = mahogany',
  W.findCard(wsE, 'electric_guitar_single_coil').parts.body_wood === 'mahogany'
);
check('recipe reflects mahogany', /mahogany/.test(W.render(wsE)));
check(
  'IMMUTABLE: ws0 guitar still alder',
  W.findCard(ws0, 'electric_guitar_single_coil').parts.body_wood === 'alder'
);

// ── what the cascade may NOT touch ──────────────────────────────────────────
//
// Asserted here rather than left to check_edit_parity, because that gate
// compares the two SURFACES against each other: both regressing together reads
// as agreement. These are properties of the operation itself, so they hold or
// fail on one surface alone — the same reason the locale gate had to compare
// two runs instead of two implementations.
//
// 1. A part edit must not move the environment. Reproduced before the fix:
//    set the room, change one unrelated variant, and the room came back as a
//    different room entirely, silently.
const wsEnv0 = W.setEnvironment(ws0, 'electric_guitar_single_coil', {
  room: 'ainu_cise_wooden_interior',
});
const envBefore = W.findCard(wsEnv0, 'electric_guitar_single_coil');
const wsEnv1 = W.setVariant(wsEnv0, 'electric_guitar_single_coil', 'body_wood', 'mahogany');
const envAfter = W.findCard(wsEnv1, 'electric_guitar_single_coil');
check(
  'set_variant leaves an explicitly set room alone',
  envAfter.room === 'ainu_cise_wooden_interior',
  `room became ${envAfter.room}`
);
check('set_variant leaves tuning alone', envAfter.tuning === envBefore.tuning);
check(
  'set_variant leaves the chain alone',
  JSON.stringify(envAfter.chain) === JSON.stringify(envBefore.chain)
);

// 2. Pins accumulate. Before the fix the cascade was told about the CURRENT
//    part only, so each edit handed the previous edit's part back to the
//    optimizer and a multi-edit batch silently lost settings.
//
//    THE CONTROL RUN IS THE POINT. Most parts do not fight each other, so a
//    sequence picked at random keeps every pin under the old scope too — the
//    first version of this check passed against the very defect it was written
//    for. So the same sequence runs twice: once normally, and once with the
//    accumulator cleared between calls, which is exactly the old behaviour. The
//    assertion is that the first keeps everything AND the second does not. If
//    the catalog ever drifts to where the control stops losing pins, this fails
//    as "no longer discriminates" rather than passing on a case that proves
//    nothing.
// MUST be an instrument with several MATERIAL parts, and that is not incidental.
//
// This used to run on `voice` in homeric_rhapsode, chosen when setVariant
// cascaded on every part. It no longer does: the connector now matches the
// browser and cascades only for parts carrying lent (`expanded`) material
// variants, and `voice` has none — so nothing reshaped, every pin survived
// trivially in BOTH runs, and the control stopped discriminating. The gate said
// exactly that rather than passing on a case that proved nothing, which is what
// the control is for.
//
// acoustic_guitar_dread has three material parts (top_wood, back_sides,
// string_acoustic), so each edit really does run the inverse cascade over the
// previous edits' choices — the only condition under which pin accumulation
// means anything. Chosen by searching every (tradition, instrument) pair for the
// strongest discriminator rather than by guessing: here the control loses 2 of
// its 3 pins, against 1 for the next-best candidates.
const PIN_SEED = 'outlaw_country';
const PIN_CARD = 'acoustic_guitar_dread';
const pinInst = (C.INSTRUMENTS || []).find((i) => i.id === PIN_CARD);
const pinParts = (pinInst.parts || [])
  .filter((p) => (p.variants || []).length > 1 && (p.variants || []).some((v) => v.expanded))
  .slice(0, 4);

function runPinSequence(accumulate) {
  let w = W.seed([PIN_SEED]);
  const asked = [];
  let finalCard = null;
  for (const p of pinParts) {
    const cur = W.findCard(w, PIN_CARD).parts[p.id];
    const alt = (p.variants || []).map((v) => v.id).find((v) => v !== cur);
    if (!alt) continue;
    if (!accumulate) {
      // Simulate the old scope through the public API: with no accumulator, the
      // cascade is told about the current part only.
      const c = W.findCard(w, PIN_CARD);
      if (c) c.pinnedParts = [];
    }
    w = W.setVariant(w, PIN_CARD, p.id, alt);
    asked.push([p.id, alt]);
  }
  finalCard = W.findCard(w, PIN_CARD);
  return {
    asked,
    ws: w,
    card: finalCard,
    lost: asked.filter(([pid, alt]) => finalCard.parts[pid] !== alt),
  };
}

const accumulated = runPinSequence(true);
const control = runPinSequence(false);
check(
  `every pin survives a ${accumulated.asked.length}-edit sequence`,
  accumulated.asked.length >= 2 && accumulated.lost.length === 0,
  accumulated.lost
    .map(([pid, alt]) => `${pid}: asked ${alt}, got ${accumulated.card.parts[pid]}`)
    .join('; ')
);
check(
  'the pin sequence actually discriminates (control loses at least one)',
  control.lost.length > 0,
  'control kept every pin too — this case no longer proves accumulation'
);

// 3. set_preface spends the pins, because it re-derives the whole card. Leaving
//    them set would make the NEXT part edit restore what the preface moved.
check(
  'the pin sequence left pins to clear',
  (accumulated.card.pinnedParts || []).length > 0,
  'nothing accumulated, so the next check would pass vacuously'
);
const wsPref = W.setPreface(accumulated.ws, PIN_CARD, 'howling');
check(
  'set_preface clears the accumulated pins',
  (W.findCard(wsPref, PIN_CARD).pinnedParts || []).length === 0
);

// ── error handling ──────────────────────────────────────────────────────────
console.log('\nerrors:');
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch (e) {
    return e instanceof W.WorkspaceError;
  }
};
check(
  'unknown tradition rejected',
  throws(() => W.seed('not_a_tradition'))
);
check(
  'unknown variant rejected',
  throws(() => W.setVariant(ws0, 'electric_guitar_single_coil', 'body_wood', 'unobtainium'))
);
check(
  'unknown preface rejected',
  throws(() => W.setPreface(ws0, 'voice', 'not_a_preface'))
);

// @covers: chain-stage-validated
//
// A multi-select chain stage (fx) holds an ARRAY; every other stage holds one
// id. Writing a bare string into fx type-checked fine and corrupted the card one
// edit later, because clone() spreads chain.fx: 'fuzz_germanium' became
// ['f','u','z','z',...], the renderer resolved none of those characters, and the
// entire fx section vanished from the recipe — taking the seeded plate_reverb
// with it. Silent gear deletion, reachable through the shipped connector schema.
//
// These cases pin the whole contract, not just the one bug: the lift, the array
// path, the clear, the untouched single-select path, and loud failure on every
// malformed input. The re-clone step is the one that actually reproduced it — a
// single setEnvironment call looked fine.
{
  const fxSeed = W.seed(['tamil_filmi']);
  const fxCard = fxSeed.cards[0].id;
  const afterString = W.setEnvironment(fxSeed, fxCard, { chain: { fx: 'fuzz_germanium' } });
  check(
    'chain: bare string at a multi-select stage lifts to a one-element array',
    Array.isArray(afterString.cards[0].chain.fx) &&
      afterString.cards[0].chain.fx.length === 1 &&
      afterString.cards[0].chain.fx[0] === 'fuzz_germanium'
  );
  // The regression itself: survive a SECOND edit, which is what clones the card.
  const recloned = W.setEnvironment(afterString, afterString.cards[0].id, {
    room: afterString.cards[0].room,
  });
  check(
    'chain: fx survives a subsequent edit without spreading into characters',
    Array.isArray(recloned.cards[0].chain.fx) &&
      recloned.cards[0].chain.fx.length === 1 &&
      recloned.cards[0].chain.fx[0] === 'fuzz_germanium'
  );
  check(
    'chain: fx still renders after a re-clone (section not silently dropped)',
    /germanium|fuzz/i.test(W.render(recloned, { format: 'rich', ceiling: 1000 }))
  );

  const s2 = W.seed(['tamil_filmi']);
  check(
    'chain: array of ids accepted at a multi-select stage',
    JSON.stringify(
      W.setEnvironment(s2, s2.cards[0].id, {
        chain: { fx: ['fuzz_germanium', 'plate_reverb'] },
      }).cards[0].chain.fx
    ) === '["fuzz_germanium","plate_reverb"]'
  );

  const s3 = W.seed(['tamil_filmi']);
  check(
    'chain: null clears a multi-select stage to an empty list',
    JSON.stringify(
      W.setEnvironment(s3, s3.cards[0].id, { chain: { fx: null } }).cards[0].chain.fx
    ) === '[]'
  );

  const s4 = W.seed(['tamil_filmi']);
  check(
    'chain: single-select stage still stores a bare id',
    W.setEnvironment(s4, s4.cards[0].id, { chain: { mic: 'ribbon_passive' } }).cards[0].chain
      .mic === 'ribbon_passive'
  );

  const s5 = W.seed(['tamil_filmi']);
  const bad = (chain) => throws(() => W.setEnvironment(s5, s5.cards[0].id, { chain }));
  check('chain: unknown fx id rejected', bad({ fx: 'not_a_real_effect' }));
  check('chain: unknown id INSIDE an fx array rejected', bad({ fx: ['plate_reverb', 'nope'] }));
  check('chain: unknown stage rejected', bad({ bogus: 'x' }));
  check('chain: unknown single-select id rejected', bad({ mic: 'not_a_real_mic' }));
  check('chain: non-string, non-array value at a multi-select stage rejected', bad({ fx: 42 }));

  // IMMUTABLE: the seed workspace is untouched by every branch above.
  check(
    'IMMUTABLE: fx seed workspace still holds its original single effect',
    JSON.stringify(fxSeed.cards[0].chain.fx) === '["plate_reverb"]'
  );
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
