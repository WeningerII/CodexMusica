import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { connectConnector } from './client.js';
import { buildServer } from './tools.js';
import { startRecipe, editRecipe, renderRecipe, ENV_FIELDS } from './engine.js';
import { _verdictInternals } from './lyric_tools.js';
const require = createRequire(import.meta.url);
const W = require('../scripts/_workspace_ops.js');

async function connect(session) {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  return connectConnector({ task: 'lyrics', transport: b, session });
}

test('native creation blocks bypass, records real sweep/screen/plan, survives reconnect', async () => {
  let c = await connect();
  try {
    await assert.rejects(c.call('lyric_check', { draft: ['words'] }), /CREATION_PLAN/);
    await assert.rejects(c.call('lyric_plan', { seed: 31 }), /CREATION_ORDER/);
    const swept = await c.call('lyric_sweep', { seed_from: 31, count: 1, lines: 12 });
    assert(!swept.isError, JSON.stringify(swept));
    const sw = JSON.parse(swept.content[0].text);
    assert.equal(sw.exit_code, 0);
    const seed = sw.accepted_shown[0];
    assert(Number.isInteger(seed));
    await c.call('lyric_screen', { words: ['stove', 'coat'], relation: 'class:ASSONANCE' });
    await c.call('lyric_plan', { seed, lines: 12 });
    const session = c.snapshot();
    assert(session.task.workflow.plan, JSON.stringify(session.task.workflow));
    const lines = Array(12).fill('The kettle whistles by the stove');
    const assessed = await c.call('lyric_grade', { seed, draft_text: lines.join('\n') });
    assert(!assessed.isError, JSON.stringify(assessed));
    const grade = assessed.content
      .flatMap((block) => {
        try {
          return [JSON.parse(block.text)];
        } catch {
          return [];
        }
      })
      .find((value) => Number.isInteger(value.exit_code));
    assert.equal(grade.measurement_status, 'graded');
    assert.deepEqual(grade.final_draft, lines);
    assert(c.snapshot().task.workflow.grade, JSON.stringify(grade));

    await c.close();
    c = await connect(session);
    await assert.rejects(
      c.call('lyric_revise', { seed, scheme: 'AA', draft: ['words'] }),
      /hand-authored/
    );
    await assert.rejects(
      c.call('lyric_revise', { seed, draft: Array(12).fill('The kettle whistles by the stove') }),
      /CREATION_GRADE/
    );
    // Mutating the public surface is not host authority.
    c.surface.task.phase = 'edit';
    await assert.rejects(c.call('lyric_check', { draft: ['words'] }), /CREATION_PLAN/);
  } finally {
    await c.close();
  }
});

test('a redrawn seed keeps its 64-bit candidates exact through sweep, plan and grade', async () => {
  // Option (b): a default draw the joint gate refuses is redrawn and disclosed in
  // choices.seed_redraw; with wants, the wants path discloses its draws in brief_selection.
  // Candidates are 64-bit integers, past what a JSON double holds, so both disclose seeds as
  // strings: the verdict block (JSON.parse of plan.json) must name exactly what the report
  // prints (Jony, #519 6347921225; 3PO 6348036141). ~~At 12 lines seed 32 needs one redraw and
  // seed 1204 two~~ — RE-MEASURED 2026-10-27 under the per-group type draw (D1) and the
  // `open` default form (D7): at 12 lines seeds 21 and 89 each need one redraw, no seed in
  // 0..2999 needs two, and seed 21 with a want takes the wants path.
  for (const { seed, want, grade } of [
    { seed: 21, grade: true },
    { seed: 89 },
    { seed: 21, want: 'group<=99' },
  ]) {
    const c = await connect();
    try {
      const verdict = (result) =>
        result.content
          .flatMap((block) => {
            try {
              return [JSON.parse(block.text)];
            } catch {
              return [];
            }
          })
          .find((value) => Number.isInteger(value.exit_code));
      const wants = want ? { want: [want] } : {};
      const sw = verdict(
        await c.call('lyric_sweep', { seed_from: seed, count: 1, lines: 12, ...wants })
      );
      assert.deepEqual(sw.accepted_shown, [seed]);
      await c.call('lyric_screen', { words: ['stove', 'coat'], relation: 'class:ASSONANCE' });
      const planned = await c.call('lyric_plan', {
        seed,
        lines: 12,
        ...(want ? { wants: [want] } : {}),
      });
      const [label, field] = want
        ? ['BRIEF SELECTION', 'brief_selection']
        : ['SEED REDRAW', 'seed_redraw'];
      const printed = JSON.parse(planned.content[0].text.match(new RegExp(`${label}: (.*)`))[1]);
      const { plan } = verdict(planned);
      const disclosed = plan.choices[field];
      const draws = disclosed[want ? 'attempts' : 'refused'].map((x) => x.seed);
      assert.equal(plan.request.seed, seed);
      assert.match(disclosed.candidate_seed, /^\d+$/);
      assert.equal(disclosed.candidate_seed, printed.candidate_seed, `seed ${seed}`);
      assert.deepEqual(
        draws,
        printed[want ? 'attempts' : 'refused'].map((x) => x.seed)
      );
      assert.equal(draws[0], String(seed));
      for (const d of draws) assert.match(d, /^\d+$/);
      if (!want && seed === 1204) assert.equal(draws.length, 2);
      if (want) assert(draws.length >= 2, JSON.stringify(draws));
      if (grade) {
        // ... and grade re-plans the same candidate, so the receipt is recorded on it.
        const draft = Array(12).fill('The kettle whistles by the stove');
        const g = verdict(await c.call('lyric_grade', { seed, lines: 12, draft }));
        assert.equal(g.measurement_status, 'graded');
        assert(c.snapshot().task.workflow.grade, 'no grade receipt on the redrawn seed');
      }
    } finally {
      await c.close();
    }
  }
});

test('moving a card changes primary order without rebuilding or mutating any card', () => {
  const original = startRecipe({ traditions: ['garage_rock', 'delta_blues'] });
  const target = original.workspace.cards.find((c) => c.traditionId === 'delta_blues');
  const snapshot = JSON.stringify(original.workspace);
  const result = editRecipe({
    workspace: original.workspace,
    edits: [{ action: 'move_instrument', card: target.id }],
  });
  assert.equal(result.workspace.cards[0].id, target.id);
  assert(result.recipe.startsWith('Delta blues + Garage rock'), result.recipe);
  assert.equal(result.render_scope.environment_card, target.id);
  assert.equal(JSON.stringify(original.workspace), snapshot);
  assert.deepEqual(
    [...result.workspace.cards].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    [...original.workspace.cards].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  );
  // The refusal names the roster, like every other unknown-card refusal, so a
  // caller that guessed a card has something to correct toward.
  assert.throws(
    () => W.moveInstrument(original.workspace, 'absent'),
    /No card matching "absent"\. Cards in this recipe: voice, /
  );
});

test('explicit part descriptors survive before stock descriptors; losses are disclosed', () => {
  let ws = W.seed('honky_tonk');
  ws = W.setVariant(ws, 'voice', 'voice_register', 'mix_voice');
  const rich = renderRecipe({ workspace: ws, max_chars: 1000 });
  assert(rich.recipe_chars <= 1000);
  for (const token of ['bridging', 'balanced', 'sustained']) assert(rich.recipe.includes(token));
  const unpinned = structuredClone(ws);
  unpinned.cards[0].pinnedParts = [];
  assert(
    !renderRecipe({ workspace: unpinned }).recipe.includes('bridging'),
    'counterexample: stock descriptor priorities discard the explicit register detail'
  );
  const tiny = renderRecipe({ workspace: ws, max_chars: 50 });
  assert(tiny.recipe_chars <= 50);
  assert(tiny.render_warnings.some((w) => w.code === 'PINNED_DESCRIPTORS_NOT_LITERAL'));
  assert.match(rich.render_scope.output, /no recording/);
});

// #671 (R2 6670845696 §4, BB8 6670984213): a pinned descriptor is disclosed
// only as a whole word inside its OWN card's segment of the rendered recipe.
const swapOne = (tradition, instrument, part, variant) => {
  const seeded = startRecipe({ traditions: [tradition] });
  const card = seeded.cards.find((c) => c.instrument === instrument).card;
  const { workspace } = editRecipe({
    workspace: seeded.workspace,
    edits: [{ action: 'set_variant', card, part, variant }],
  });
  return { seeded, card, workspace };
};
const pinnedWarnings = (r, card) =>
  r.render_warnings
    .filter((w) => w.card === card && w.code.startsWith('PINNED_DESCRIPTORS_'))
    .map((w) => [w.code, w.descriptors]);

test('#671 a pinned word printed only on another card is not disclosed, in any format', () => {
  // Each target variant's only descriptor is the BARE token `modern`. R2's
  // table: 12 renders, of which only celtic rich prints `modern` on the swapped
  // card itself. Gangsta rich, gangsta tags and celtic tags print it only on
  // other cards (`electric-bass: modern alder …`) and used to warn nothing.
  const swaps = [
    ['gangsta_rap', 'sampler_classic', 'sampler_archetypes', 'mpc_modern'],
    ['bluegrass', 'acoustic_guitar_dread', 'top_wood', 'sintir_poplar_body'],
    ['celtic_irish_trad', 'uilleann_pipes', 'uilleann_chanter_wood', 'sintir_poplar_body'],
  ];
  const lost = [['PINNED_DESCRIPTORS_NOT_LITERAL', ['modern']]];
  for (const [tradition, instrument, part, variant] of swaps) {
    const { card, workspace } = swapOne(tradition, instrument, part, variant);
    for (const format of ['rich', 'tags', 'prose', 'compact']) {
      const r = renderRecipe({ workspace, format });
      const own = tradition === 'celtic_irish_trad' && format === 'rich';
      if (own)
        assert.match(r.recipe, /uilleann-pipes: modern /, 'fixture: the word is on the pipes');
      assert.deepEqual(pinnedWarnings(r, card), own ? [] : lost, `${tradition} ${format}`);
    }
  }
  // The three that were silent really do print `modern`, as a whole word,
  // somewhere else — so a whole-recipe test, even a whole-word one, passes them.
  for (const [tradition, format] of [
    ['gangsta_rap', 'rich'],
    ['gangsta_rap', 'tags'],
    ['celtic_irish_trad', 'tags'],
  ]) {
    const [, instrument, part, variant] = swaps.find((s) => s[0] === tradition);
    const { workspace } = swapOne(tradition, instrument, part, variant);
    assert.match(
      renderRecipe({ workspace, format }).recipe,
      /\bmodern\b/,
      `${tradition} ${format}`
    );
  }
});

test('#671 a pinned word inside a longer word is not disclosed; a hyphenated compound is', () => {
  // vocal_fry's `low` is printed only inside the voice's own preface
  // `spoken-flowing`, and nowhere as a word.
  const fry = swapOne('yacht_rock', 'voice', 'voice_register', 'vocal_fry');
  const r = renderRecipe({ workspace: fry.workspace });
  assert.match(r.recipe, /^Yacht rock, spoken-flowing voice: croaky vocal-fry /, 'fixture moved');
  assert.doesNotMatch(r.recipe, /\blow\b/i, 'fixture: `low` must not be a word anywhere');
  assert.deepEqual(pinnedWarnings(r, fry.card), [['PINNED_DESCRIPTORS_NOT_LITERAL', ['low']]]);
  // Control: a hyphen bounds a word, as `\b` does, so a pinned word kept inside
  // a compound on its own card (`nervy` in `nervy-intensity`) is printed.
  const vib = swapOne('honky_tonk', 'voice', 'voice_vibrato', 'fast_vibrato');
  const v = renderRecipe({ workspace: vib.workspace });
  assert.match(v.recipe, /^Honky-tonk, [a-z-]+ voice: [^,]*\bnervy-intensity\b/, 'fixture moved');
  assert.ok(
    !pinnedWarnings(v, vib.card).some(([, ds]) => ds.includes('nervy')),
    JSON.stringify(v.render_warnings)
  );
});

test('#671 a pinned word in a chunk pooled from several cards is named as not attributable', () => {
  // Rich merges tack-piano and upright-piano into one chunk on the shared
  // trailing word and pools their descriptors, so `stride` is printed but the
  // output does not say which piano it describes.
  const { seeded, card, workspace } = swapOne(
    'honky_tonk',
    'tack_piano',
    'keyboard_technique',
    'keyboard_stride_left_hand'
  );
  const upright = seeded.cards.find((c) => c.instrument === 'upright_piano').card;
  const r = renderRecipe({ workspace });
  assert.match(r.recipe, / tack piercing upright piano: stride /, 'fixture moved');
  assert.deepEqual(pinnedWarnings(r, card), [['PINNED_DESCRIPTORS_NOT_ATTRIBUTABLE', ['stride']]]);
  const w = r.render_warnings.find((x) => x.code === 'PINNED_DESCRIPTORS_NOT_ATTRIBUTABLE');
  assert.deepEqual(w.shared_with, [upright]);
  assert.match(w.meaning, /tack_piano with upright_piano/);
  // `stride` is in the descriptors the merged chunk pools, after the colon, not
  // in the tack piano's own head words (`tack`), and the meaning says so.
  assert.match(w.meaning, /only in the words one segment shares among the cards it merges/);
  assert.match(w.meaning, /Do not claim they survived on this card/);
  // Tags keeps each piano in its own chunk (and gives explicit parts no trim
  // priority), so there the word is plainly lost from the card's own chunk.
  const tags = renderRecipe({ workspace, format: 'tags' });
  assert.match(tags.recipe, / tack-piano: [^,]*, piercing upright-piano: /, 'fixture moved');
  assert.doesNotMatch(tags.recipe, /\bstride\b/);
  assert.deepEqual(pinnedWarnings(tags, card), [['PINNED_DESCRIPTORS_NOT_LITERAL', ['stride']]]);
});

// #671 (BB8 6676262617): a pinned preface is judged as a pinned descriptor is:
// as whole words in its own card's segment. `recipe.includes(preface)` let the
// same preface printed on another card hide that this card's was dropped.
test('#671 a pinned preface counts only in its own card segment, not on a card that shares it', () => {
  const seeded = startRecipe({ traditions: ['honky_tonk'] });
  const id = (instrument) => seeded.cards.find((c) => c.instrument === instrument).card;
  const [voice, upright] = ['voice', 'upright_piano'].map(id);
  // The voice and the upright piano both pin `raging`.
  const { workspace } = editRecipe({
    workspace: seeded.workspace,
    edits: [
      { action: 'set_preface', card: voice, preface: 'raging' },
      { action: 'set_preface', card: upright, preface: 'raging' },
    ],
  });
  const prefaceWarnings = (r) =>
    r.render_warnings
      .filter((w) => w.code.startsWith('EXPLICIT_PREFACE_'))
      .map((w) => [w.card, w.code]);
  // Tags at 200 hides the upright piano; `raging` is still printed, on the voice.
  const hidden = renderRecipe({ workspace, format: 'tags', max_chars: 200 });
  assert.match(hidden.recipe, /^Honky-tonk, raging voice, .*\[\+1 hidden\]$/, 'fixture moved');
  assert.doesNotMatch(hidden.recipe, /upright[- ]piano/, 'fixture: the upright piano is hidden');
  assert.deepEqual(prefaceWarnings(hidden), [[upright, 'EXPLICIT_PREFACE_NOT_LITERAL']]);
  const w = hidden.render_warnings.find((x) => x.code === 'EXPLICIT_PREFACE_NOT_LITERAL');
  assert.equal(w.preface, 'raging');
  assert.match(w.meaning, /Do not claim it survived/);
  // Rich at 150 sheds both pianos' prefaces from their shared chunk.
  const shed = renderRecipe({ workspace, format: 'rich', max_chars: 150 });
  assert.match(
    shed.recipe,
    /^Honky-tonk, raging voice, .*, tack upright piano\.$/,
    'fixture moved'
  );
  assert.deepEqual(prefaceWarnings(shed), [[upright, 'EXPLICIT_PREFACE_NOT_LITERAL']]);
  // Rich at full length merges the two pianos on their trailing word, and
  // prints `raging` right before the upright piano's own inner label: in its
  // own head words, so it is printed on that card (BB8's ruling on #814).
  const merged = renderRecipe({ workspace, format: 'rich' });
  assert.match(merged.recipe, / maracatu-marching tack raging upright piano: /, 'fixture moved');
  assert.deepEqual(prefaceWarnings(merged), []);
  // Tags at full length gives the upright piano its own chunk: nothing to say.
  const own = renderRecipe({ workspace, format: 'tags' });
  assert.match(own.recipe, /, raging upright-piano: /, 'fixture moved');
  assert.deepEqual(prefaceWarnings(own), []);
});

// #671, BB8's ruling on #814 (option 2): where Rich or Prose merges cards on a
// shared trailing word, each preface is printed right before its own card's
// inner label. The trace records each single-source card's own head words as
// the renderer joins them, and a pinned preface or descriptor found there is
// printed on that card. NOT_ATTRIBUTABLE stays for same-label pooling, for the
// words the merged cards share, and for renders with no per-card segments.
const pinAllShown = (seeded, extra = []) =>
  editRecipe({
    workspace: seeded.workspace,
    edits: seeded.cards
      .filter((c) => c.preface)
      .map((c) => ({ action: 'set_preface', card: c.card, preface: c.preface }))
      .concat(extra),
  });
const prefaceCodes = (r) =>
  r.render_warnings
    .filter((w) => w.code.startsWith('EXPLICIT_PREFACE_'))
    .map((w) => [w.card, w.code, w.preface]);

test('#671 a preface printed in its own card head words of a merged chunk is printed (48g)', () => {
  const seeded = startRecipe({ traditions: ['48g'] });
  const id = (instrument) => seeded.cards.find((c) => c.instrument === instrument).card;
  const [electric, dread] = ['electric_guitar_humbucker', 'acoustic_guitar_dread'].map(id);
  const { workspace } = pinAllShown(seeded);
  const head = 'cold humbucker-solid-body-electric street-pulsing dreadnought-acoustic guitar';
  for (const format of ['rich', 'prose']) {
    const r = renderRecipe({ workspace, format });
    assert.ok(r.recipe.includes(`, ${head}`), `fixture moved (${format}): ${r.recipe}`);
    assert.deepEqual(prefaceCodes(r), [], format);
  }
  for (const format of ['tags', 'compact'])
    assert.deepEqual(prefaceCodes(renderRecipe({ workspace, format })), [], format);
  // A pinned descriptor follows the same rule. `solid` is a word of the
  // electric guitar's own inner label (`humbucker-solid-body-electric`), so it
  // is printed there; the variant's other words are, in Rich, only in the
  // descriptors the chunk pools from both guitars, and absent from Prose.
  const swapped = pinAllShown(seeded, [
    {
      action: 'set_variant',
      card: electric,
      part: 'body_wood',
      variant: 'sitka_spruce_solid_quartersawn',
    },
  ]).workspace;
  const rest = ['sitka-spruce', 'quartersawn', '8-12-rings-per-inch'];
  const rich = renderRecipe({ workspace: swapped, format: 'rich' });
  assert.ok(rich.recipe.includes(`, ${head}: sitka-spruce `), `fixture moved: ${rich.recipe}`);
  assert.deepEqual(pinnedWarnings(rich, electric), [['PINNED_DESCRIPTORS_NOT_ATTRIBUTABLE', rest]]);
  const w = rich.render_warnings.find((x) => x.code === 'PINNED_DESCRIPTORS_NOT_ATTRIBUTABLE');
  assert.deepEqual(w.shared_with, [dread]);
  assert.match(w.meaning, /only in the words one segment shares among the cards it merges/);
  const prose = renderRecipe({ workspace: swapped, format: 'prose' });
  assert.ok(prose.recipe.includes(`, ${head}, `), `fixture moved: ${prose.recipe}`);
  assert.deepEqual(pinnedWarnings(prose, electric), [['PINNED_DESCRIPTORS_NOT_LITERAL', rest]]);
  assert.deepEqual(prefaceCodes(rich).concat(prefaceCodes(prose)), []);
});

test('#671 a preface pooled with a card of the same label is still not attributable', () => {
  // Two voices share the label `voice`: Rich and Prose pool their prefaces into
  // one part, `eye-watering raging voice`, so neither card has head words of
  // its own and the output does not say which voice is raging.
  const seeded = startRecipe({ traditions: ['honky_tonk'] });
  const voice = seeded.cards.find((c) => c.instrument === 'voice').card;
  const two = editRecipe({
    workspace: seeded.workspace,
    edits: [{ action: 'add_instrument', instrument: 'voice' }],
  });
  const added = two.cards.find((c) => c.instrument === 'voice' && c.card !== voice).card;
  const pinned = editRecipe({
    workspace: two.workspace,
    edits: [{ action: 'set_preface', card: added, preface: 'raging' }],
  }).workspace;
  for (const format of ['rich', 'prose']) {
    const r = renderRecipe({ workspace: pinned, format });
    assert.match(
      r.recipe,
      /^Honky-tonk, eye-watering raging voice[:,] /,
      `fixture moved (${format})`
    );
    assert.deepEqual(prefaceCodes(r), [[added, 'EXPLICIT_PREFACE_NOT_ATTRIBUTABLE', 'raging']]);
    const w = r.render_warnings.find((x) => x.code === 'EXPLICIT_PREFACE_NOT_ATTRIBUTABLE');
    assert.deepEqual(w.shared_with, [voice]);
    assert.match(
      w.meaning,
      /where this card shares its label, and so its words, with another card/
    );
  }
  // A same-label part inside a chunk merged on a trailing word: the second
  // upright piano is pooled with the first (`maracatu-marching raging upright`),
  // while the tack piano, its part's only source, has its own head words.
  const pianos = editRecipe({
    workspace: seeded.workspace,
    edits: [{ action: 'add_instrument', instrument: 'upright_piano' }],
  });
  const tack = pianos.cards.find((c) => c.instrument === 'tack_piano').card;
  const [first, second] = pianos.cards
    .filter((c) => c.instrument === 'upright_piano')
    .map((c) => c.card);
  const mixed = editRecipe({
    workspace: pianos.workspace,
    edits: [
      { action: 'set_preface', card: second, preface: 'raging' },
      { action: 'set_preface', card: tack, preface: 'sobbing' },
    ],
  }).workspace;
  for (const format of ['rich', 'prose']) {
    const r = renderRecipe({ workspace: mixed, format });
    assert.match(
      r.recipe,
      /, sobbing tack maracatu-marching raging upright piano[:,] /,
      `fixture moved (${format})`
    );
    assert.deepEqual(prefaceCodes(r), [[second, 'EXPLICIT_PREFACE_NOT_ATTRIBUTABLE', 'raging']]);
    const w = r.render_warnings.find((x) => x.code === 'EXPLICIT_PREFACE_NOT_ATTRIBUTABLE');
    // Only the other upright piano shares the part `raging` is printed in; the
    // tack piano's head words are its own.
    assert.deepEqual(w.shared_with, [first]);
    assert.match(w.meaning, /shares its label/);
    assert.match(w.meaning, /\(upright_piano \(card_\d+\) with upright_piano \(card_\d+\)\)/);
    assert.doesNotMatch(w.meaning, /tack_piano/);
  }
});

test('#671 shared_with names the cards that share the words a pinned word is printed in', () => {
  // The same second upright piano, now also with a pinned keyboard technique.
  // Its preface is in the part it pools with the first upright piano, so only
  // that card shares it; the technique's word is printed only in the
  // descriptors Rich pools from the whole merged chunk, so every other card of
  // the chunk does.
  const seeded = startRecipe({ traditions: ['honky_tonk'] });
  const pianos = editRecipe({
    workspace: seeded.workspace,
    edits: [{ action: 'add_instrument', instrument: 'upright_piano' }],
  });
  const tack = pianos.cards.find((c) => c.instrument === 'tack_piano').card;
  const [first, second] = pianos.cards
    .filter((c) => c.instrument === 'upright_piano')
    .map((c) => c.card);
  const { workspace } = editRecipe({
    workspace: pianos.workspace,
    edits: [
      { action: 'set_preface', card: second, preface: 'raging' },
      {
        action: 'set_variant',
        card: second,
        part: 'keyboard_technique',
        variant: 'keyboard_gospel_chord_runs',
      },
    ],
  });
  const r = renderRecipe({ workspace, format: 'rich' });
  assert.match(r.recipe, / tack piercing raging upright piano: gospel-runs /, 'fixture moved');
  const of = (code) => r.render_warnings.find((x) => x.card === second && x.code === code);
  const preface = of('EXPLICIT_PREFACE_NOT_ATTRIBUTABLE');
  assert.deepEqual(preface.shared_with, [first]);
  assert.match(
    preface.meaning,
    /where this card shares its label, and so its words, with another card/
  );
  const words = of('PINNED_DESCRIPTORS_NOT_ATTRIBUTABLE');
  assert.deepEqual(words.descriptors, ['gospel-runs']);
  assert.deepEqual(words.shared_with, [tack, first]);
  assert.match(words.meaning, /only in the words one segment shares among the cards it merges/);
  assert.match(words.meaning, /not the part that holds this card's label/);
  assert.match(words.meaning, /with tack_piano, upright_piano \(card_\d+\)\)/);
  // Two voices pool into one chunk of their own label, so the descriptors they
  // pool are theirs together: the other voice is the one card that shares them.
  const voice = seeded.cards.find((c) => c.instrument === 'voice').card;
  const two = editRecipe({
    workspace: seeded.workspace,
    edits: [{ action: 'add_instrument', instrument: 'voice' }],
  });
  const added = two.cards.find((c) => c.instrument === 'voice' && c.card !== voice).card;
  const voices = editRecipe({
    workspace: two.workspace,
    edits: [{ action: 'set_variant', card: added, part: 'voice_register', variant: 'head_voice' }],
  }).workspace;
  const v = renderRecipe({ workspace: voices, format: 'rich' });
  assert.match(
    v.recipe,
    /^Honky-tonk, eye-watering jaw-dropping voice: soaring light ringing /,
    'fixture moved'
  );
  const w = v.render_warnings.find((x) => x.code === 'PINNED_DESCRIPTORS_NOT_ATTRIBUTABLE');
  assert.equal(w.card, added);
  assert.deepEqual(w.shared_with, [voice]);
  assert.match(w.meaning, /where this card shares its label, and so its words, with another card/);
});

test('#671 a preface shed from one card of a merged chunk is not printed on that card only', () => {
  // The tack and upright pianos both pin `raging`, and Rich merges them on
  // `piano`. At 186 characters the shed pops the tail part's preface first:
  // `raging tack upright piano`. The word is still in the chunk, but only in the
  // tack piano's own head words, so the upright piano's preface is gone.
  const seeded = startRecipe({ traditions: ['honky_tonk'] });
  const id = (instrument) => seeded.cards.find((c) => c.instrument === instrument).card;
  const [tack, upright] = ['tack_piano', 'upright_piano'].map(id);
  const { workspace } = editRecipe({
    workspace: seeded.workspace,
    edits: [
      { action: 'set_preface', card: tack, preface: 'raging' },
      { action: 'set_preface', card: upright, preface: 'raging' },
    ],
  });
  const shed = renderRecipe({ workspace, format: 'rich', max_chars: 186 });
  assert.match(shed.recipe, /, raging tack upright piano\.$/, 'fixture moved');
  assert.deepEqual(prefaceCodes(shed), [[upright, 'EXPLICIT_PREFACE_NOT_LITERAL', 'raging']]);
  assert.match(
    shed.render_warnings.find((x) => x.code === 'EXPLICIT_PREFACE_NOT_LITERAL').meaning,
    /the same word printed on another card or in the header does not count/
  );
  // Unshed, each piano prints `raging` in its own head words: nothing to say.
  for (const format of ['rich', 'prose']) {
    const full = renderRecipe({ workspace, format });
    assert.match(
      full.recipe,
      /, raging tack raging upright piano[:,.]/,
      `fixture moved (${format})`
    );
    assert.deepEqual(prefaceCodes(full), [], format);
  }
});

test('#671 a same-label card is not given a word printed only in another card head words', () => {
  // Two upright pianos pool into one part of the chunk Rich and Prose merge on
  // `piano`; the tack piano is its part's only source. With `raging` pinned on
  // the tack piano and the second upright piano, shedding the uprights' part
  // leaves `raging` only in the tack piano's own head words: that is the tack
  // piano's, so the second upright piano's preface is not printed.
  const seeded = startRecipe({ traditions: ['honky_tonk'] });
  const pianos = editRecipe({
    workspace: seeded.workspace,
    edits: [{ action: 'add_instrument', instrument: 'upright_piano' }],
  });
  const tack = pianos.cards.find((c) => c.instrument === 'tack_piano').card;
  const second = pianos.cards.filter((c) => c.instrument === 'upright_piano')[1].card;
  const { workspace } = editRecipe({
    workspace: pianos.workspace,
    edits: [
      { action: 'set_preface', card: tack, preface: 'raging' },
      { action: 'set_preface', card: second, preface: 'raging' },
    ],
  });
  for (const [format, max, shape] of [
    ['rich', 200, /, raging tack upright piano\.$/],
    ['rich', 207, /, raging tack maracatu-marching upright piano\.$/],
    ['prose', 521, /, raging tack maracatu-marching upright piano, /],
    ['prose', 200, /, raging tack piano\.$/],
  ]) {
    const r = renderRecipe({ workspace, format, max_chars: max });
    assert.match(r.recipe, shape, `fixture moved (${format} ${max}): ${r.recipe}`);
    assert.deepEqual(prefaceCodes(r), [[second, 'EXPLICIT_PREFACE_NOT_LITERAL', 'raging']]);
  }
  // Printed in the uprights' own pooled part, it is still not attributable.
  for (const format of ['rich', 'prose']) {
    const full = renderRecipe({ workspace, format });
    assert.match(full.recipe, /, raging tack maracatu-marching raging upright piano[:,] /);
    assert.deepEqual(prefaceCodes(full), [[second, 'EXPLICIT_PREFACE_NOT_ATTRIBUTABLE', 'raging']]);
  }
});

test('partial authenticated measurement is not labelled as no harness answer', () => {
  const verdict = _verdictInternals.verdictOf({
    code: 2,
    stdout: '',
    stderr: '',
    lyric_result: {
      version: 1,
      status: 'graded',
      findings: [],
      final_draft: ['Moonshot'],
      coverage: { certified: false, scope: 'requested_layers', refused_obligations: ['meter:L1'] },
    },
  });
  assert.match(verdict.meaning, /coverage incomplete/);
  assert.equal(verdict.certified, false);
});

test('actual explicit-blueprint connector revision retains meter headers', async () => {
  const server = buildServer({ task: { domain: 'lyrics' } });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const c = await connectConnector({ task: { domain: 'lyrics', phase: 'edit' }, transport: b });
  try {
    const draft = ['My kettle whistles by the stove', 'Your fingers brush my heavy coat'];
    const blueprint = {
      sections: [
        {
          name: 'verse',
          function: 'verse',
          start_bar: 1,
          bars: 1,
          meter: { beats: 4, unit: 4, groups: [2, 2] },
        },
        {
          name: 'chorus',
          function: 'chorus',
          start_bar: 2,
          bars: 1,
          meter: { beats: 7, unit: 8, groups: [3, 2, 2] },
        },
      ],
      lines: draft.map((text, i) => ({
        text,
        bar: i + 1,
        beat: 1,
        duration: i ? 7 : 4,
        section: i ? 'chorus' : 'verse',
      })),
    };
    const result = await c.call('lyric_revise', {
      draft,
      blueprint: JSON.stringify(blueprint),
      scheme: 'AA',
      relation: 'class:ASSONANCE',
      subdivision: 4,
      writer: 'interview',
      max_rounds: 1,
      attempts: 0,
      backtrack: 0,
    });
    assert(!result.isError, JSON.stringify(result));
    assert.match(result.content[0].text, /\[VERSE — 1 line — 1 bar of 4\/4/);
    assert.match(result.content[0].text, /\[CHORUS — 1 line — 1 bar of 7\/8/);
  } finally {
    await c.close();
  }
});

test('every public recipe format obeys limits smaller than its genre header', () => {
  const ws = W.seed(['garage_rock', 'delta_blues']);
  for (const format of ['rich', 'prose', 'tags', 'compact']) {
    for (const max_chars of [1, 2, 10, 20, 35, 50, 1000]) {
      const r = renderRecipe({ workspace: ws, format, max_chars });
      assert(r.recipe_chars <= max_chars, JSON.stringify({ format, max_chars, recipe: r.recipe }));
    }
  }
});

test('mixing session_id with caller-managed state names the offending fields, and the schema says so first', async () => {
  const { JobStore } = await import('./job_store.js');
  const { WorkflowSessions } = await import('./workflow_sessions.js');
  const { buildWorkflowServer } = await import('./workflow_tools.js');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const server = await buildWorkflowServer({
    sessions: new WorkflowSessions({ store: new JobStore() }),
    compatibility: true,
  });
  const client = new Client({ name: 'mixed-mode-check', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(a);
    await client.connect(b);
    // Measured on the hosted connector, 2026-09-21: a caller that mirrored
    // the published schema sent `writer: 'interview'` beside its session_id
    // and was refused with "never both" and no field name. The refusal names
    // the keys now. Since 2026-09-27 no outside surface publishes `writer` at
    // all — the caller writes every line — so sending it changes nothing and
    // is not refused.
    const begun = await client.callTool({
      name: 'begin_lyrics',
      arguments: { writer: 'interview' },
    });
    assert(!begun.isError, JSON.stringify(begun));
    const session_id = begun.structuredContent.session_id;
    const mixed = await client.callTool({
      name: 'lyric_revise',
      arguments: { session_id, seed: 31, run_id: 'abc', run_revision: 2 },
    });
    assert(mixed.isError, JSON.stringify(mixed));
    const text = mixed.content[0].text;
    assert.match(text, /never both: /);
    assert.match(text, /\brun_id\b/);
    assert.match(text, /\brun_revision\b/);
    assert.match(
      text,
      /are caller-managed state the session already carries; omit it with session_id/
    );
    const one = await client.callTool({
      name: 'lyric_revise',
      arguments: { session_id, seed: 31, run_id: 'abc' },
    });
    assert(one.isError);
    assert.match(one.content[0].text, /never both: run_id is caller-managed state/);
    const writerOnly = await client.callTool({
      name: 'lyric_revise',
      arguments: { session_id, seed: 31, writer: 'interview', draft: ['a line'] },
    });
    assert.doesNotMatch(writerOnly.content[0].text, /never both/);
    // Ordinary arguments are not caller-managed state: the refusal is not raised for them.
    const plain = await client.callTool({
      name: 'lyric_revise',
      arguments: { session_id, seed: 31, draft: ['a line'] },
    });
    assert.doesNotMatch(plain.content[0].text, /never both/);
    // And the schema says which fields are caller-managed before any call is made.
    const revise = (await client.listTools()).tools.find((t) => t.name === 'lyric_revise');
    assert.equal(revise.inputSchema.properties.writer, undefined);
    for (const key of ['state', 'checkpoint', 'run_id', 'run_revision'])
      assert.match(
        revise.inputSchema.properties[key].description,
        /^CALLER-MANAGED STATE — only without session_id: a session carries this/,
        key
      );
    for (const key of ['draft', 'pronunciations', 'seed'])
      assert.doesNotMatch(
        revise.inputSchema.properties[key].description ?? '',
        /CALLER-MANAGED/,
        key
      );
  } finally {
    await client.close();
    await server.close();
  }
});

test('the maintained client never keeps a stopped run as a pending question', async () => {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { z } = await import('zod');
  const { revisionStopped } = await import('./client.js');
  const verdicts = [
    { exit_code: 4, status: 'awaiting_proposal', state: 'suspended', run_id: 'r', run_revision: 1 },
    // A stop hands its journal back as `state` for provenance.
    {
      exit_code: 3,
      measurement_status: 'finished',
      state: 'archived',
      run_id: 'r',
      run_revision: 2,
    },
  ];
  const server = new McpServer(
    { name: 'stub', version: '1' },
    { instructions: '=== LYRICS TASK ===\nstub' }
  );
  server.registerTool(
    'lyric_revise',
    {
      inputSchema: {
        scheme: z.string().optional(),
        draft: z.array(z.string()).optional(),
        answer: z.string().optional(),
        state: z.string().optional(),
        run_id: z.string().optional(),
        run_revision: z.number().optional(),
      },
    },
    async () => ({ content: [{ type: 'text', text: JSON.stringify(verdicts.shift()) }] })
  );
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const c = await connectConnector({
    task: { domain: 'lyrics', phase: 'edit' },
    transport: b,
    verifySurface: false,
  });
  try {
    await c.call('lyric_revise', { scheme: 'AA', draft: ['a', 'b'] });
    assert.equal(c.snapshot().continuation.args.state, 'suspended');
    await c.call('lyric_revise', { answer: 'x' });
    assert.equal(c.snapshot().continuation, null);
  } finally {
    await c.close();
    await server.close();
  }
  for (const verdict of [{ exit_code: 0 }, { exit_code: 2, resumable: false }])
    assert(revisionStopped(verdict));
  assert(!revisionStopped({ exit_code: 4 }));
});

test('the tree’s expected surface is built once per domain, not per connection', async () => {
  const { expectedSurfaceFor } = await import('./client.js');
  assert.equal(expectedSurfaceFor('recipe'), expectedSurfaceFor('recipe'));
  assert.notEqual(expectedSurfaceFor('recipe'), expectedSurfaceFor('lyrics'));
  const { tools } = await expectedSurfaceFor('recipe');
  assert(tools.some((tool) => tool.name === 'edit_recipe'));
});

test('environment clear warnings distinguish cleared settings from retained non-rendered writes', () => {
  const initial = startRecipe({ traditions: ['garage_rock'] });
  const owner = initial.render_scope.environment_card;
  const later = initial.workspace.cards.find((c) => c.id !== owner && c.room).id;
  const run = (edits) => editRecipe({ workspace: initial.workspace, edits });
  const hidden = (result) =>
    result.render_warnings.filter((w) => w.code === 'ENVIRONMENT_NOT_RENDERED');
  const cleared = run([{ action: 'set_environment', clear: ENV_FIELDS }]);
  assert.notEqual(cleared.render_scope.environment_card, owner);
  const empty = cleared.workspace.cards.find((c) => c.id === owner);
  assert(
    ENV_FIELDS.every((field) => {
      const value = ['room', 'tuning'].includes(field) ? empty[field] : empty.chain[field];
      return Array.isArray(value) ? value.length === 0 : value == null;
    })
  );
  assert(cleared.render_warnings.some((w) => w.code === 'ENVIRONMENT_MOVED'));
  assert.deepEqual(hidden(cleared), [], 'a clear cannot claim its removed setting is stored');
  const partial = run([{ action: 'set_environment', clear: ['room'] }]);
  assert.equal(partial.render_scope.environment_card, owner);
  assert.deepEqual(hidden(partial), []);
  assert.deepEqual(hidden(run([{ action: 'set_environment', card: later, clear: ['room'] }])), []);
  const write = { action: 'set_environment', card: later, room: 'cathedral' };
  assert.equal(hidden(run([write])).length, 1, 'a non-rendered room write still warns');
  assert.equal(
    hidden(run([{ ...write, clear: ['tuning'] }])).length,
    1,
    'mixed clear/write still stores the room'
  );
  assert.deepEqual(
    hidden(run([write, { action: 'set_environment', card: later, clear: ['room'] }])),
    [],
    'a later clear means the earlier room is no longer stored'
  );
  assert.deepEqual(
    hidden(run([{ action: 'set_environment', card: later, clear: ['room'] }, write])).map(
      (w) => w.edit
    ),
    [1]
  );
  const effects = run([
    { action: 'set_environment', card: later, chain: { fx: 'plate_reverb' } },
    { action: 'set_environment', card: later, chain: { fx: 'fuzz_germanium' } },
  ]);
  assert.deepEqual(
    hidden(effects).map((w) => w.edit),
    [0, 1],
    'appending another effect retains both earlier and later writes'
  );
  const different = run([
    write,
    { action: 'set_environment', card: later, room: 'concrete_basement' },
  ]);
  assert.deepEqual(
    hidden(different).map((w) => w.edit),
    [1],
    'an overwritten value is not reported as still stored'
  );
});

test('environment warning accuracy preserves preface/write ordering disclosures', () => {
  const initial = startRecipe({ traditions: ['appalachian_folk'] });
  const write = { action: 'set_environment', room: 'cathedral' };
  const preface = { action: 'set_preface', card: 'voice', preface: 'raging' };
  const overwritten = editRecipe({ workspace: initial.workspace, edits: [write, preface] });
  assert(overwritten.render_warnings.some((w) => w.code === 'ENVIRONMENT_OVERWRITTEN'));
  const preserved = editRecipe({ workspace: initial.workspace, edits: [preface, write] });
  assert.equal(preserved.render_scope.environment_settings.room, 'cathedral');
  assert(!preserved.render_warnings.some((w) => w.code === 'ENVIRONMENT_OVERWRITTEN'));
});
