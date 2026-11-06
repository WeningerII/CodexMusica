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
//
// A lifted id is ADDED to the list. These checks used to assert that the list
// came back as exactly the one id asked for — `fx.length === 1` — which pinned
// the very loss the paragraph above describes: the seeded plate_reverb gone
// because a fuzz was asked for. The app's multi-select chip appends
// (`[...cur, itemId]`), so the connector does too, and `clear` is how a list is
// emptied or replaced.
{
  const fxSeed = W.seed(['tamil_filmi']);
  const fxCard = fxSeed.cards[0].id;
  const afterString = W.setEnvironment(fxSeed, fxCard, { chain: { fx: 'fuzz_germanium' } });
  check(
    'chain: bare string at a multi-select stage is lifted and ADDED to the list',
    JSON.stringify(afterString.cards[0].chain.fx) === '["plate_reverb","fuzz_germanium"]',
    JSON.stringify(afterString.cards[0].chain.fx)
  );
  // The regression itself: survive a SECOND edit, which is what clones the card.
  const recloned = W.setEnvironment(afterString, afterString.cards[0].id, {
    room: afterString.cards[0].room,
  });
  check(
    'chain: fx survives a subsequent edit without spreading into characters',
    JSON.stringify(recloned.cards[0].chain.fx) === '["plate_reverb","fuzz_germanium"]',
    JSON.stringify(recloned.cards[0].chain.fx)
  );
  const reclonedRender = W.render(recloned, { format: 'rich', ceiling: 1000 });
  check(
    'chain: both effects still render after a re-clone (section not silently dropped)',
    /germanium|fuzz/i.test(reclonedRender) && /plate/i.test(reclonedRender)
  );
  check(
    'chain: adding an id already in the list leaves the list as it was',
    JSON.stringify(
      W.setEnvironment(afterString, fxCard, { chain: { fx: 'plate_reverb' } }).cards[0].chain.fx
    ) === '["plate_reverb","fuzz_germanium"]'
  );

  const s2 = W.seed(['tamil_filmi']);
  check(
    'chain: array of ids accepted at a multi-select stage (added in order, no duplicates)',
    JSON.stringify(
      W.setEnvironment(s2, s2.cards[0].id, {
        chain: { fx: ['fuzz_germanium', 'plate_reverb'] },
      }).cards[0].chain.fx
    ) === '["plate_reverb","fuzz_germanium"]'
  );

  const s3 = W.seed(['tamil_filmi']);
  check(
    'chain: null clears a multi-select stage to an empty list',
    JSON.stringify(
      W.setEnvironment(s3, s3.cards[0].id, { chain: { fx: null } }).cards[0].chain.fx
    ) === '[]'
  );
  check(
    'clear: empties a multi-select stage',
    JSON.stringify(W.setEnvironment(s3, s3.cards[0].id, { clear: ['fx'] }).cards[0].chain.fx) ===
      '[]'
  );
  check(
    'clear runs before the edit sets: clear + one id replaces the list',
    JSON.stringify(
      W.setEnvironment(s3, s3.cards[0].id, { clear: ['fx'], chain: { fx: 'fuzz_germanium' } })
        .cards[0].chain.fx
    ) === '["fuzz_germanium"]'
  );
  const cleared = W.setEnvironment(s3, s3.cards[0].id, { clear: ['room', 'tuning', 'mic'] })
    .cards[0];
  check(
    'clear: room, tuning and a single-select stage go to null (the app\'s "Not set")',
    cleared.room === null && cleared.tuning === null && cleared.chain.mic === null
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
  check(
    'clear: an unknown field is rejected',
    throws(() => W.setEnvironment(s5, s5.cards[0].id, { clear: ['rooms'] }))
  );

  // IMMUTABLE: the seed workspace is untouched by every branch above.
  check(
    'IMMUTABLE: fx seed workspace still holds its original single effect',
    JSON.stringify(fxSeed.cards[0].chain.fx) === '["plate_reverb"]'
  );
}

// ── set_environment with no card: the card the environment renders from ────
//
// The renderer takes the environment from the first card that HAS one
// (envCardOf). An omitted card used to mean cards[0], which is a different card
// as soon as a bare instrument reaches the front — and writing a room onto that
// bare card made it the environment card, so the recipe lost its tuning and its
// whole signal chain. Asserted on the exact shape that reproduced it.
console.log('\nset_environment with no card:');
{
  const { envCardOf } = require('./_recipe_stack.js');
  let w = W.seed(['appalachian_folk']);
  const envBefore = envCardOf(w.cards);
  w = W.addInstrument(w, 'theremin');
  w = W.moveInstrument(w, 'theremin');
  check('a bare card at the front is not the environment card', envCardOf(w.cards) !== w.cards[0]);
  const after = W.setEnvironment(w, null, { room: 'cathedral' });
  const target = envCardOf(after.cards);
  check(
    'an omitted card writes to the environment card, not to cards[0]',
    target.id === envBefore.id && target.room === 'cathedral' && after.cards[0].room === null,
    `wrote to ${target.id}; cards[0].room=${after.cards[0].room}`
  );
  check(
    'the tuning and chain the recipe had are still there',
    target.tuning === envBefore.tuning && target.chain.mic === envBefore.chain.mic
  );
  const rendered = W.render(after, { format: 'rich', ceiling: 1000 });
  check(
    'the recipe renders the new room AND keeps the rest of the environment',
    /cathedral/.test(rendered) && /ribbon/.test(rendered),
    rendered.slice(-200)
  );
  check(
    'with no cards at all there is nothing to set, and it says so',
    throws(() => W.setEnvironment({ cards: [] }, null, { room: 'cathedral' }))
  );
}

// ── what set_environment wrote: the card's envWritten record (#671) ─────────
//
// The connector says a setting does not render only when a set_environment
// wrote it (BB8 6681659990). The record is how it knows: set by
// set_environment, a field out of it when it is cleared or a set_preface
// re-derives it, absent when empty, never inferred from values, and never read
// by a renderer. The ops share it by reference through clone(), so each must
// assign a fresh one; the IMMUTABLE checks below catch one changed in place.
console.log('\nenvWritten record:');
{
  const K = W.ENV_RECORD;
  const seed = W.seed(['garage_rock']);
  const bass = seed.cards.find((c) => c.instrumentId === 'electric_bass').id;
  const rec = (ws, id = bass) => ws.cards.find((c) => c.id === id)[K];
  const json = (x) => JSON.stringify(x);
  check(
    'a seed records nothing (no key on any card)',
    seed.cards.every((c) => !(K in c))
  );
  const w1 = W.setEnvironment(seed, bass, { room: 'cathedral', chain: { mic: 'ribbon_passive' } });
  check(
    'set_environment records what it wrote, by field',
    json(rec(w1)) === json({ room: 'cathedral', mic: 'ribbon_passive' }),
    json(rec(w1))
  );
  const env = W.setEnvironment(seed, null, { tuning: 'just_intonation' });
  check(
    'with no card it records on the environment card it wrote to',
    json(rec(env, envCardOfSeed(env))) === json({ tuning: 'just_intonation' })
  );
  const w2 = W.setEnvironment(w1, bass, { chain: { fx: 'tape_echo' } });
  const w3 = W.setEnvironment(w2, bass, { chain: { fx: ['plate_reverb', 'tape_echo'] } });
  check(
    'a multi-select stage records the items written, an item already there included',
    json(rec(w3).fx) === json(['tape_echo', 'plate_reverb']),
    json(rec(w3))
  );
  check(
    'IMMUTABLE: an op leaves the record it was given as it was',
    json(rec(w1)) === json({ room: 'cathedral', mic: 'ribbon_passive' }) &&
      json(rec(w2).fx) === json(['tape_echo'])
  );
  const w4 = W.setEnvironment(w3, bass, { clear: ['fx'], chain: { mic: null } });
  check(
    'clear and a null value take the field out',
    json(rec(w4)) === json({ room: 'cathedral' }),
    json(rec(w4))
  );
  const w5 = W.setEnvironment(w4, bass, { clear: ['fx'], chain: { fx: 'tape_echo' } });
  check('clear then add records exactly the new list', json(rec(w5).fx) === json(['tape_echo']));
  check(
    'a record emptied leaves the card without the key',
    !(K in W.setEnvironment(w4, bass, { clear: ['room'] }).cards.find((c) => c.id === bass))
  );
  // set_preface: a field the re-derivation changed leaves; one it kept stays.
  const card = (ws) => ws.cards.find((c) => c.id === bass);
  let moved = null;
  let kept = null;
  for (const p of C.PREFACE_LEXICON || []) {
    let out;
    try {
      out = W.setPreface(w4, bass, p.id);
    } catch {
      continue;
    }
    if (!moved && card(out).room !== 'cathedral') moved = out;
    if (!kept && card(out).room === 'cathedral') kept = out;
    if (moved && kept) break;
  }
  check(
    'set_preface takes out a field whose value it re-derived',
    moved && !(K in card(moved)),
    moved && json(card(moved)[K])
  );
  check(
    'set_preface keeps a field it left as it was',
    kept && json(card(kept)[K]) === json({ room: 'cathedral' }),
    kept && json(card(kept)[K])
  );
  check(
    'IMMUTABLE: set_preface leaves the record it was given',
    json(rec(w4)) === '{"room":"cathedral"}'
  );
  // Ops that do not write the environment carry the record with the card.
  const carried = [
    W.setVariant(
      w4,
      bass,
      Object.keys(card(w4).parts)[0],
      card(w4).parts[Object.keys(card(w4).parts)[0]]
    ),
    W.moveInstrument(w4, bass),
    W.addInstrument(w4, GUEST || 'harmonica'),
  ];
  check(
    'set_variant, move_instrument and add_instrument carry it unchanged',
    carried.every((ws) => json(rec(ws)) === '{"room":"cathedral"}')
  );
  // Read defensively: a record off the wire that is not one is ignored.
  const junk = {
    cards: seed.cards.map((c) =>
      c.id === bass ? { ...c, [K]: { room: 7, fx: 'x', nope: 'y' } } : c
    ),
  };
  check(
    'a malformed record reads as nothing recorded',
    json(W.envRecord(junk.cards.find((c) => c.id === bass))) === '{}'
  );
  check(
    'a malformed record does not stop a write, which stores a clean one',
    json(rec(W.setEnvironment(junk, bass, { tuning: 'just_intonation' }))) ===
      '{"tuning":"just_intonation"}'
  );
  // No renderer reads it: the same cards render the same bytes without it.
  const bare = { cards: w3.cards.map(({ [K]: _, ...c }) => c) };
  check(
    'no format renders a byte of it',
    ['rich', 'tags', 'prose', 'compact'].every(
      (format) =>
        W.render(w3, { format, ceiling: 1000 }) === W.render(bare, { format, ceiling: 1000 })
    )
  );
  check(
    'the retained rule: a single value while stored, an effect while any written item is listed',
    W.envRecordHolds(card(w3), 'room', 'cathedral') &&
      !W.envRecordHolds(card(w3), 'room', 'tin_roofed_shack') &&
      W.envRecordHolds({ chain: { fx: ['a', 'b'] } }, 'fx', ['c', 'b']) &&
      !W.envRecordHolds({ chain: { fx: ['a'] } }, 'fx', ['b'])
  );
  // Only catalog ids of the field count: the record is bounded by the catalog,
  // however long a list a caller threads back (#671 review).
  check(
    'a record keeps only catalog ids of each field, each once',
    json(
      W.envRecord({
        [K]: {
          room: 'not_a_room',
          tuning: 'cathedral',
          mic: 'tape_echo',
          fx: ['tape_echo', 'x', 'tape_echo', ...Array.from({ length: 1000 }, (_, i) => `z${i}`)],
        },
      })
    ) === '{"fx":["tape_echo"]}'
  );
  // A set_environment on the environment card settles what it names on every
  // other card: the caller has chosen what renders there (#671 review).
  const envId = envCardOfSeed(seed);
  const guitar = seed.cards.find((c) => c.instrumentId === 'electric_guitar_single_coil').id;
  const marked = W.setEnvironment(
    W.setEnvironment(w3, guitar, { room: 'tin_roofed_shack', tuning: 'just_intonation' }),
    bass,
    { tuning: 'just_intonation' }
  );
  const settled = W.setEnvironment(marked, null, { room: 'concrete_basement' });
  check(
    'set_environment on the environment card settles that field on every other card',
    json(rec(settled)) ===
      json({
        tuning: 'just_intonation',
        fx: ['tape_echo', 'plate_reverb'],
        mic: 'ribbon_passive',
      }) &&
      json(rec(settled, guitar)) === json({ tuning: 'just_intonation' }) &&
      json(rec(settled, envId)) === json({ room: 'concrete_basement' }),
    json([rec(settled), rec(settled, guitar)])
  );
  check(
    'IMMUTABLE: settling leaves the records it was given',
    json(rec(marked, guitar)) === json({ room: 'tin_roofed_shack', tuning: 'just_intonation' })
  );
  check(
    'an effect added there settles that effect only; a cleared list settles all of it',
    json(rec(W.setEnvironment(marked, null, { chain: { fx: 'tape_echo' } })).fx) ===
      json(['plate_reverb']) && !('fx' in rec(W.setEnvironment(marked, null, { clear: ['fx'] })))
  );
  check(
    'a clear on the environment card settles the field too',
    !('tuning' in (rec(W.setEnvironment(marked, null, { clear: ['tuning'] })) || {}))
  );
  check(
    'a write on a card that is not the environment card settles nothing elsewhere',
    json(rec(W.setEnvironment(marked, guitar, { tuning: 'pythagorean' }))) === json(rec(marked))
  );
}
function envCardOfSeed(ws) {
  return require('./_recipe_stack.js').envCardOf(ws.cards).id;
}

// ── card ids belong to the workspace, not the process ─────────────────────
//
// Ids used to come from a module-level counter, so a workspace minted by one
// process and edited by the next (any restart or deploy) got the next process's
// card_1 for a new card while card_1 already stood in it — and remove_instrument
// then deleted both. Both halves run in FRESH child processes: this process has
// minted plenty of cards by now, and a counter that is already high would pass
// the check without the fix.
console.log('\ncard ids across processes:');
{
  const { execFileSync } = require('child_process');
  const inChild = (code, input) =>
    JSON.parse(
      execFileSync(process.execPath, ['-e', "const W=require('./_workspace_ops.js');" + code], {
        cwd: __dirname,
        encoding: 'utf8',
        input,
      })
    );
  const minted = inChild(
    "let w=W.seed(['garage_rock']);w=W.addInstrument(w,'theremin');" +
      'process.stdout.write(JSON.stringify(w));'
  );
  const ids = minted.cards.map((c) => c.id);
  check(
    'a seed numbers its cards from card_1 in any process',
    ids[0] === 'card_1' && new Set(ids).size === ids.length
  );
  const next = inChild(
    "const w=JSON.parse(require('fs').readFileSync(0,'utf8'));" +
      "process.stdout.write(JSON.stringify(W.addInstrument(w,'harmonica')));",
    JSON.stringify(minted)
  );
  const added = next.cards[next.cards.length - 1];
  check(
    'a card added by a second fresh process takes an id the workspace does not already hold',
    !ids.includes(added.id) && new Set(next.cards.map((c) => c.id)).size === next.cards.length,
    added.id
  );
  const removed = W.removeInstrument(next, added.id);
  check(
    'removing it by id removes exactly that one card',
    removed.cards.length === minted.cards.length &&
      removed.cards.every((c, i) => c.id === minted.cards[i].id)
  );
  // A workspace made before ids were derived can already hold a duplicate.
  const legacy = JSON.parse(JSON.stringify(minted));
  legacy.cards[legacy.cards.length - 1].id = legacy.cards[0].id;
  const pruned = W.removeInstrument(legacy, legacy.cards[0].id);
  check(
    'a legacy workspace with a duplicated id loses one card per removal, not both',
    pruned.cards.length === legacy.cards.length - 1
  );
  check(
    'and a new card never reuses an id already present',
    !legacy.cards.some((c) => c.id === W.addInstrument(legacy, 'harmonica').cards.at(-1).id)
  );
  check(
    'start_recipe is idempotent in its ids as well as its recipe',
    JSON.stringify(W.seed(['garage_rock'])) === JSON.stringify(W.seed(['garage_rock']))
  );
}

// ── add_instrument into a tradition: configured and placed as the app does ──
console.log('\nadd_instrument with a tradition:');
{
  const base = W.seed(['bluegrass', 'tamil_filmi']);
  const guest = W.addInstrument(base, 'theremin', { tradition: 'bluegrass' });
  const idx = guest.cards.findIndex((c) => c.instrumentId === 'theremin');
  const card = guest.cards[idx];
  const seeded = W.seed(['bluegrass']).cards[0];
  check(
    "an off-roster guest gets the tradition's whole recording chain, not just room and tuning",
    JSON.stringify(card.chain) === JSON.stringify(seeded.chain) &&
      card.room === seeded.room &&
      card.tuning === seeded.tuning,
    JSON.stringify(card.chain)
  );
  const lastBluegrass = base.cards.map((c) => c.traditionId).lastIndexOf('bluegrass');
  check(
    "it lands after that tradition's last card (src/app.js _placeCardAfterTraditionRun)",
    idx === lastBluegrass + 1,
    `index ${idx}, expected ${lastBluegrass + 1}`
  );
  const { envCardOf, _kebab } = require('./_recipe_stack.js');
  const moved = W.moveInstrument(guest, card.id);
  const medium = ((C.CHAIN_SECTIONS.find((x) => x.id === 'medium') || {}).items || []).find(
    (it) => it.id === seeded.chain.medium
  );
  check(
    'moved to the front, it is the environment card and renders the chain it was given',
    envCardOf(moved.cards).id === card.id &&
      !!medium &&
      W.render(moved, { format: 'rich', ceiling: 1000 }).includes(_kebab(medium.name))
  );
}

// ── the environment-card rule, as the page receives it (#662) ───────────────
//
// hasEnvironment + envCardOf have ONE source: _recipe_stack.js's @inline
// region, which build_html.js inlines into codex.html and _load_app.js prepends
// for the parity gates. One source cannot drift, but it can be wrong, and every
// parity gate would then compare the wrong text with itself. So the case table
// is hand-specified (expected index, not a frozen copy of an older body) and is
// run against the region TEXT, evaluated alone in an empty context — which also
// proves the region reaches nothing module-scoped — and against the module.
console.log('\nenvironment-card rule (single source):');
{
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const RS = require('./_recipe_stack.js');
  const text = fs.readFileSync(path.join(__dirname, '_recipe_stack.js'), 'utf8');
  const regions =
    text.match(/\/\* @inline-start[^\n]*\*\/\n[\s\S]*?\n\/\* @inline-end \*\//g) || [];
  check(
    '_recipe_stack.js has exactly one @inline region',
    regions.length === 1,
    `${regions.length}`
  );
  const body = (regions[0] || '').replace(/^[^\n]*\n/, '').replace(/\n[^\n]*$/, '');
  const box = vm.createContext({});
  let regionOk = true;
  try {
    vm.runInContext(
      `${body}\nthis.hasEnvironment = hasEnvironment; this.envCardOf = envCardOf;`,
      box
    );
  } catch (e) {
    regionOk = false;
    fail(`the region does not run alone: ${e.message}`);
  }
  const bare = () => ({ tuning: null, room: null, chain: {} });
  const env = () => ({ tuning: 't', room: null, chain: {} });
  // [label, card, expected hasEnvironment]
  const PRED = [
    ['null card', null, false],
    ['bare card', bare(), false],
    ['chain: null', { tuning: null, room: null, chain: null }, false],
    ['no chain key', { tuning: null, room: null }, false],
    ["stage values 0, '' and null", { chain: { mic: 0, pre: '', console: null } }, false],
    ['fx: [] (empty multi-select)', { chain: { fx: [] } }, false],
    ["fx: [''] (length 1)", { chain: { fx: [''] } }, true],
    ["tuning: '' with room: null", { tuning: '', room: null, chain: {} }, false],
    ['tuning set', { tuning: 't' }, true],
    ['room set', { room: 'r' }, true],
    ['one single-stage id', { chain: { mic: 'm' } }, true],
  ];
  // [label, cards, expected index (-1 = null)]
  const a = bare();
  const b = env();
  const c = { tuning: null, room: null, chain: { fx: [] } };
  const d = { tuning: null, room: 'r', chain: {} };
  const SEL = [
    ['missing list', null, -1],
    ['empty list', [], -1],
    ['[null]', [null], 0],
    ['[null, env] -> the env card', [null, b], 1],
    ['all bare -> cards[0] itself', [a, bare()], 0],
    ['environment only on a later card', [a, b], 1],
    ['an earlier fx: [] loses to a later environment', [c, d], 1],
    ['cards[0] with an environment wins', [b, d], 0],
    ['reordered, the first holder wins', [d, b], 0],
    ['owner cleared -> the next holder', [{ ...b, tuning: null }, d], 1],
  ];
  for (const [impl, H, E] of [
    ['module', RS.hasEnvironment, RS.envCardOf],
    ['region', regionOk ? box.hasEnvironment : null, regionOk ? box.envCardOf : null],
  ]) {
    if (!H || !E) continue;
    const predBad = PRED.filter(([, card, want]) => {
      const got = H(card);
      return typeof got !== 'boolean' || got !== want;
    }).map(([l]) => l);
    check(
      `${impl}: hasEnvironment, ${PRED.length} cases, always a boolean`,
      !predBad.length,
      predBad.join('; ')
    );
    const selBad = SEL.filter(([, cards, want]) => {
      const before = JSON.stringify(cards);
      const got = E(cards);
      const same = want === -1 ? got === null : got === cards[want];
      return !same || JSON.stringify(cards) !== before;
    }).map(([l]) => l);
    check(
      `${impl}: envCardOf, ${SEL.length} cases, the card object itself, input unchanged`,
      !selBad.length,
      selBad.join('; ')
    );
  }
  // One source holds only if nothing else carries the body. A local copy in a
  // page or the server matches today and drifts later, so the region's core
  // expression `Array.isArray(x) ? x.length > 0 : !!x` (whitespace removed, any
  // variable name) may appear in no .js/.mjs file under src/ or mcp/. It is a
  // tripwire for that one spelling, not a ban on every rewording: the older
  // `Array.isArray(v) ? v.length : v` is deliberately not matched, because
  // mcp/engine.js envSettings uses it for a different job (which chain stages
  // are set, for the response). The test oracles in check_edit_differential.js
  // and recipe_probe_verdict.mjs are deliberate independent copies and live
  // outside these roots.
  const CORE = /Array\.isArray\((\w+)\)\?\1\.length>0:!!\1/;
  const copies = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const f = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(f);
      else if (
        /\.(m?js)$/.test(ent.name) &&
        CORE.test(fs.readFileSync(f, 'utf8').replace(/\s+/g, ''))
      )
        copies.push(path.relative(path.join(__dirname, '..'), f));
    }
  };
  for (const root of ['src', 'mcp']) walk(path.join(__dirname, '..', root));
  check(
    "the region's core expression appears in no .js/.mjs file under src/ or mcp/",
    !copies.length,
    copies.join(', ')
  );
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
