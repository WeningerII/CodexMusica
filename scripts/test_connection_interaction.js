// Acceptance tests for src/connection-interaction.js: the interaction rules
// the named team agreed for the connection views (docs/design/connection-views
// spec.md, frozen design r5). Fixture: the r5 six occurrences of Frost's first
// stanza, with woods L1 w2 and woods L4 w4 as two distinct occurrences.
const assert = require('node:assert/strict');
const test = require('node:test');
const CI = require('../src/connection-interaction.js');

const OCC = [
  { entity_id: 'e-woods-1-2', text: 'woods', line: 1, token: 2 },
  { entity_id: 'e-know-1-8', text: 'know', line: 1, token: 8 },
  { entity_id: 'e-though-2-7', text: 'though', line: 2, token: 7 },
  { entity_id: 'e-watch-4-2', text: 'watch', line: 4, token: 2 },
  { entity_id: 'e-woods-4-4', text: 'woods', line: 4, token: 4 },
  { entity_id: 'e-snow-4-8', text: 'snow', line: 4, token: 8 },
];
const BY_ID = new Map(OCC.map((o) => [o.entity_id, o]));
const ALLIT = 'schema:alliteration';
const RHYME = 'schema:perfect_rhyme';
const METHODS = new Map([
  [ALLIT, { method_id: ALLIT, name: 'Alliteration', layer: 'registered' }],
  [RHYME, { method_id: RHYME, name: 'Perfect rhyme', layer: 'registered' }],
]);
const IDENTITY = 'analysis-rev-1';
const current = {
  analysisIdentity: IDENTITY,
  hasEntity: (id) => BY_ID.has(id),
  hasMethod: (id) => METHODS.has(id),
  hasEvidence: (id) => id === 'ev-stanza-rhyme',
};

test('selection is keyed by occurrence id, never by spelling', () => {
  const a = CI.occurrence('e-woods-1-2');
  const b = CI.occurrence('e-woods-4-4');
  assert.notEqual(CI.selectionKey(a), CI.selectionKey(b));
  assert.equal(CI.sameSelection(a, CI.occurrence('e-woods-1-2')), true);
  assert.throws(() => CI.occurrence(''), TypeError);
});

test('a symmetric pair is one selection in either order; a self pair is refused', () => {
  const ab = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  const ba = CI.pair(ALLIT, 'e-woods-4-4', 'e-watch-4-2');
  assert.equal(CI.sameSelection(ab, ba), true);
  assert.throws(() => CI.pair(ALLIT, 'e-watch-4-2', 'e-watch-4-2'), RangeError);
  // The same two words under another method are another question.
  assert.equal(CI.sameSelection(ab, CI.pair(RHYME, 'e-watch-4-2', 'e-woods-4-4')), false);
});

test('a directed binding keeps its roles: a→b differs from b→a', () => {
  const ab = CI.binding('schema:chain', [
    { role: 'a', entity_id: 'e-know-1-8' },
    { role: 'b', entity_id: 'e-though-2-7' },
  ]);
  const ba = CI.binding('schema:chain', [
    { role: 'a', entity_id: 'e-though-2-7' },
    { role: 'b', entity_id: 'e-know-1-8' },
  ]);
  assert.equal(CI.sameSelection(ab, ba), false);
  assert.throws(
    () =>
      CI.binding('schema:chain', [
        { role: 'a', entity_id: 'e-know-1-8' },
        { role: 'a', entity_id: 'e-though-2-7' },
      ]),
    RangeError
  );
});

test('URL round-trips every selection kind, including ids with separators', () => {
  const sels = [
    CI.occurrence('e-woods-1-2'),
    CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4'),
    CI.binding(ALLIT, [
      { role: 'a', entity_id: 'e-watch-4-2' },
      { role: 'b', entity_id: 'e-woods-4-4' },
    ]),
    CI.figure('ev-stanza-rhyme'),
  ];
  for (const sel of sels) {
    const back = CI.decodeSelection(CI.encodeSelection(IDENTITY, sel), current);
    assert.equal(back.ok, true, CI.selectionKey(sel));
    assert.equal(CI.sameSelection(back.selection, sel), true);
  }
});

test('a view key reads back to the same selection; a bad key reads as none', () => {
  for (const sel of [
    CI.occurrence('e-woods-4-4'),
    CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4'),
    CI.figure('ev-stanza-rhyme'),
  ]) {
    assert.equal(CI.sameSelection(CI.selectionFromKey(CI.selectionKey(sel)), sel), true);
  }
  assert.equal(CI.selectionFromKey('p:only-one'), null);
  assert.equal(CI.selectionFromKey(''), null);
});

test('a link from another revision is refused, never remapped', () => {
  const qs = CI.encodeSelection('analysis-rev-0', CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4'));
  const r = CI.decodeSelection(qs, current);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'revision');
  assert.equal(r.message, 'This pair no longer exists in the current revision.');
  assert.equal(r.selection, undefined);
});

test('a link naming a vanished occurrence or method is refused', () => {
  const gone = CI.decodeSelection(
    CI.encodeSelection(IDENTITY, CI.pair(ALLIT, 'e-watch-4-2', 'e-deleted')),
    current
  );
  assert.deepEqual([gone.ok, gone.reason], [false, 'missing']);
  const noMethod = CI.decodeSelection(
    CI.encodeSelection(IDENTITY, CI.pair('schema:retired', 'e-watch-4-2', 'e-woods-4-4')),
    current
  );
  assert.deepEqual([noMethod.ok, noMethod.reason], [false, 'missing']);
  const fig = CI.decodeSelection(CI.encodeSelection(IDENTITY, CI.figure('ev-old')), current);
  assert.equal(fig.message, 'This figure no longer exists in the current revision.');
});

test('a malformed or absent link is reported, not guessed', () => {
  assert.equal(CI.decodeSelection('cv=analysis-rev-1&sel=p:x', current).reason, 'malformed');
  assert.equal(CI.decodeSelection('cv=analysis-rev-1&sel=%E0%A4%A', current).reason, 'malformed');
  assert.equal(CI.decodeSelection('', current).reason, 'none');
});

test('unchecking the method hides the pair but keeps it selected, with Show', () => {
  const sel = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  const scope = {
    checkedMethods: new Set([RHYME]),
    methodName: (id) => METHODS.get(id).name,
    hiddenByFilter: () => null,
  };
  const n = CI.hiddenNotice(sel, scope);
  assert.equal(n.text, 'Selected pair hidden by current methods');
  assert.deepEqual(n.action, {
    type: 'check_method',
    method_id: ALLIT,
    label: 'Show Alliteration',
  });
  assert.equal(CI.sameSelection(sel, CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4')), true);
  scope.checkedMethods.add(ALLIT);
  assert.equal(CI.hiddenNotice(sel, scope), null);
});

test('a display filter that hides the selection says so and offers Show', () => {
  const sel = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  const n = CI.hiddenNotice(sel, {
    checkedMethods: new Set([ALLIT]),
    methodName: (id) => METHODS.get(id).name,
    hiddenByFilter: () => 'both members unstressed',
  });
  assert.equal(n.text, 'Selected pair hidden by current filter');
  assert.equal(n.action.type, 'clear_filter');
});

test('six states: outside locus, refused, holds, does not hold, undecided, not yet computed', () => {
  const st = (cell) => CI.cellState(cell).state;
  assert.equal(st({ inLocus: false }), 'not_examined');
  assert.equal(
    st({ inLocus: true, record: { coverage: 'refused', refusal: { reason: 'unreadable word' } } }),
    'refused'
  );
  assert.equal(
    st({
      inLocus: true,
      record: { coverage: 'answered', outcome: true, informative_channels: ['onset'] },
    }),
    'holds'
  );
  assert.equal(
    st({ inLocus: true, record: { coverage: 'answered', outcome: false } }),
    'does_not_hold'
  );
  assert.equal(
    st({ inLocus: true, record: { coverage: 'answered', outcome: 'undecided' } }),
    'undecided'
  );
  assert.equal(st({ inLocus: true, jobComplete: false }), 'not_yet_computed');
});

test('an absent record is a negative only for a completed, certified domain', () => {
  assert.equal(
    CI.cellState({ inLocus: true, jobComplete: true, domainCertified: true }).state,
    'does_not_hold'
  );
  const uncertified = CI.cellState({ inLocus: true, jobComplete: true, domainCertified: false });
  assert.equal(uncertified.state, 'undecided');
  assert.equal(CI.stateWords(uncertified), 'undecided · absence not certified for this method');
});

test('undecided names its reason from unknown_channels, else says it was not reported', () => {
  const named = CI.cellState({
    inLocus: true,
    record: { outcome: null, unknown_channels: [[0, 'nucleus']] },
  });
  assert.equal(CI.stateWords(named), 'undecided · nucleus not settled');
  const bare = CI.cellState({ inLocus: true, record: { outcome: null } });
  assert.equal(CI.stateWords(bare), 'undecided · reason not reported');
  assert.doesNotMatch(CI.stateWords(bare), /search cap/);
});

test('a hold on empty onsets only is labelled, never hidden', () => {
  const r = CI.cellState({ inLocus: true, record: { outcome: true, informative_channels: [] } });
  assert.equal(r.state, 'holds');
  assert.equal(CI.stateWords(r), 'holds · only empty onsets compared');
});

test('matrix arrows stay above the diagonal and inside the grid', () => {
  const n = OCC.length;
  assert.deepEqual(CI.matrixMove({ row: 3, col: 4 }, 'ArrowRight', n), { row: 3, col: 5 });
  assert.deepEqual(CI.matrixMove({ row: 3, col: 5 }, 'ArrowRight', n), { row: 3, col: 5 });
  assert.deepEqual(CI.matrixMove({ row: 3, col: 4 }, 'ArrowLeft', n), { row: 3, col: 4 });
  assert.deepEqual(CI.matrixMove({ row: 3, col: 4 }, 'ArrowDown', n), { row: 3, col: 4 });
  assert.deepEqual(CI.matrixMove({ row: 3, col: 4 }, 'ArrowUp', n), { row: 2, col: 4 });
  assert.deepEqual(CI.matrixMove({ row: 0, col: 1 }, 'ArrowUp', n), { row: 0, col: 1 });
  // Every reachable cell is a real unordered pair.
  for (let r = 0; r < n; r++)
    for (let c = r + 1; c < n; c++)
      for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) {
        const p = CI.matrixMove({ row: r, col: c }, k, n);
        assert.ok(p.row < p.col && p.row >= 0 && p.col < n);
      }
});

test('Enter inspects, Esc clears, Tab follows the poem', () => {
  assert.equal(CI.keyAction('Enter'), 'inspect');
  assert.equal(CI.keyAction('Escape'), 'clear');
  assert.equal(CI.keyAction('ArrowUp'), 'move');
  assert.equal(CI.keyAction('a'), null);
  const shuffled = [OCC[4], OCC[0], OCC[5], OCC[2], OCC[3], OCC[1]];
  assert.deepEqual(
    CI.readingOrder(shuffled).map((o) => o.entity_id),
    OCC.map((o) => o.entity_id)
  );
  assert.equal(CI.nextInReadingOrder(shuffled, 'e-though-2-7'), 'e-watch-4-2');
  assert.equal(CI.nextInReadingOrder(shuffled, 'e-though-2-7', true), 'e-know-1-8');
  assert.equal(CI.nextInReadingOrder(shuffled, 'e-snow-4-8'), null);
  assert.equal(CI.nextInReadingOrder(shuffled, null), 'e-woods-1-2');
});

test('the live region speaks the selection in words', () => {
  const ctx = (extra) => ({
    occurrence: (id) => BY_ID.get(id),
    method: (id) => METHODS.get(id),
    ...extra,
  });
  const sel = CI.pair(ALLIT, 'e-watch-4-2', 'e-woods-4-4');
  const held = CI.cellState({
    inLocus: true,
    record: { outcome: true, informative_channels: ['onset'] },
  });
  assert.equal(
    CI.announce(sel, ctx({ state: held })),
    'watch L4 w2 – woods L4 w4: Registered figure · Alliteration holds'
  );
  const hidden = { text: 'Selected pair hidden by current methods' };
  assert.match(CI.announce(sel, ctx({ state: held, hidden })), /; hidden by current methods$/);
  assert.equal(
    CI.announce(CI.occurrence('e-woods-1-2'), ctx({ counts: { holds: 0, not_examined: 5 } })),
    'woods L1 w2 selected: 5 outside this method’s locus'
  );
  assert.equal(CI.announce(null, ctx({})), 'Selection cleared');
});

test('Cell shows offers only checked methods, named with their layer', () => {
  const checked = [METHODS.get(ALLIT), METHODS.get(RHYME)];
  const r = CI.cellShows(checked, ALLIT);
  assert.deepEqual(
    r.options.map((o) => o.label),
    ['Registered: Alliteration', 'Registered: Perfect rhyme']
  );
  assert.equal(r.selected, ALLIT);
  assert.equal(r.notice, null);
  const moved = CI.cellShows([METHODS.get(RHYME)], ALLIT);
  assert.equal(moved.selected, RHYME);
  assert.match(moved.notice, /no longer checked/);
  assert.deepEqual(CI.cellShows([], ALLIT), {
    options: [],
    selected: null,
    notice: 'No method checked',
  });
});

test('the shared-sound layer is always named in full', () => {
  const vowel = { method_id: 'sound:vowel', name: 'Vowel', layer: 'sound' };
  assert.equal(CI.LAYER_WORDS.sound, 'Shared sound (not a registered figure)');
  assert.deepEqual(
    CI.cellShows([vowel], 'sound:vowel').options.map((o) => o.label),
    ['Shared sound (not a registered figure): Vowel']
  );
  const held = CI.cellState({
    inLocus: true,
    record: { outcome: true, informative_channels: ['nucleus'] },
  });
  assert.match(
    CI.announce(CI.pair('sound:vowel', 'e-watch-4-2', 'e-woods-4-4'), {
      occurrence: (id) => BY_ID.get(id),
      method: () => vowel,
      state: held,
    }),
    /Shared sound \(not a registered figure\) · Vowel holds$/
  );
});

test('occurrence labels carry the coordinate, as in r5', () => {
  assert.equal(CI.occurrenceLabel(OCC[0]), 'woods · L1 w2');
  assert.equal(CI.occurrenceLabel(OCC[4]), 'woods · L4 w4');
});
