import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { connectConnector } from './client.js';
import { buildServer } from './tools.js';
import { buildWorkflowServer } from './workflow_tools.js';
import { WorkflowSessions } from './workflow_sessions.js';
import { JobStore } from './job_store.js';
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
  // One warning per card and set of fields (#671, BB8 6681659990): both writes
  // stand, and they leave the same field, so the card is said once, by the first.
  assert.deepEqual(
    hidden(effects).map((w) => w.edit),
    [0],
    'appending another effect retains both writes, said once for the card by the first'
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

// ── ENVIRONMENT_NOT_RENDERED: what a set_environment wrote, said while it stands ──
// (#671, BB8 6675691909, amended 6681659990)
//
// Each card keeps a record (`envWritten`) of the environment fields a
// set_environment wrote on it. A card other than the environment card that still
// holds one of them is said on every response that renders the workspace, on
// every surface: the engine, the raw MCP endpoint, and the session endpoints,
// which keep only the workspace between calls. On the edit that wrote it the
// warning names that edit; on any other response it has no `edit`. A tradition's
// stock settings and a room a set_preface re-derived are not in the record and
// never warn, and a workspace saved before the record existed has nothing in it.

const NOT_RENDERED = 'ENVIRONMENT_NOT_RENDERED';
const RECORD = 'envWritten';
const FORMATS = ['rich', 'tags', 'prose', 'compact'];
const unrendered = (r) => r.render_warnings.filter((w) => w.code === NOT_RENDERED);
const moved = (r) => r.render_warnings.filter((w) => w.code === 'ENVIRONMENT_MOVED');
const overwritten = (r) => r.render_warnings.filter((w) => w.code === 'ENVIRONMENT_OVERWRITTEN');
// A workspace as a session or client saved it before the record existed.
const FORGET = 'forget the record';
const withoutRecord = (ws) => {
  const copy = JSON.parse(JSON.stringify(ws));
  for (const card of copy.cards) delete card[RECORD];
  return copy;
};

async function linked(server) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'not-rendered-test', version: '1' }, { capabilities: {} });
  await server.connect(a);
  await client.connect(b);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

// Each surface drives the same three tools. `next` is what the following call
// is given: the workspace for a caller-managed surface, the session_id for a
// session. `reopen` carries the state into a fresh server, as a reconnect or a
// caller moving its workspace to another connection would. `forget` drops the
// record from the state the surface holds, as a workspace saved by an earlier
// release has none, and `recorded` reads a card's record back from that state.
// A session only moves forward, so a scenario that goes on from an earlier
// response replays that response's steps into a new session first; the call
// under test is then an ordinary call on a session that holds that workspace.
const traced = (r, history) => ({ ...r, history });
const stepped = (prev, step) => ({ ...prev.history, steps: [...prev.history.steps, step] });
const callerManaged = (call, close, reopen) => ({
  start: (traditions) => call('start_recipe', { traditions }, { traditions, steps: [] }),
  edit: (prev, edits) => call('edit_recipe', { workspace: prev.next, edits }, stepped(prev, edits)),
  render: (prev, extra = {}) =>
    call('render_recipe', { workspace: prev.next, ...extra }, prev.history),
  forget: async (prev) => ({
    ...prev,
    next: withoutRecord(prev.next),
    history: stepped(prev, FORGET),
  }),
  recorded: async (prev, card) => prev.next.cards.find((c) => c.id === card)?.[RECORD],
  reopen,
  close,
});
const SURFACES = {
  engine: async () => {
    const tools = {
      start_recipe: startRecipe,
      edit_recipe: editRecipe,
      render_recipe: renderRecipe,
    };
    const call = async (name, args, history) => {
      const r = tools[name](JSON.parse(JSON.stringify(args)));
      return traced({ ...r, next: JSON.parse(JSON.stringify(r.workspace)) }, history);
    };
    return callerManaged(
      call,
      async () => {},
      async () => {}
    );
  },
  'raw /mcp/recipe': async () => {
    // The host owns a task endpoint's format: one request, one format.
    let conns = {};
    const conn = async (format = 'rich') =>
      (conns[format] ??= await linked(buildServer({ task: { domain: 'recipe', format } })));
    const call = async (name, args, history) => {
      const res = await (await conn(args.format)).client.callTool({ name, arguments: args });
      assert(!res.isError, JSON.stringify(res));
      const r = JSON.parse(res.content[0].text);
      return traced({ ...r, next: r.workspace }, history);
    };
    const closeAll = async () => {
      for (const c of Object.values(conns)) await c.close();
      conns = {};
    };
    return callerManaged(call, closeAll, closeAll);
  },
  ...Object.fromEntries(
    [
      ['session /mcp/chatgpt/recipe', { domain: 'recipe' }],
      ['session /mcp', { compatibility: true }],
    ].map(([name, options]) => [
      name,
      async () => {
        const sessions = new WorkflowSessions({ store: new JobStore() });
        const open = async () => linked(await buildWorkflowServer({ ...options, sessions }));
        let conn = await open();
        let latest = null;
        const call = async (tool, args, history) => {
          const res = await conn.client.callTool({ name: tool, arguments: args });
          assert(!res.isError, JSON.stringify(res));
          const r = JSON.parse(res.content[0].text);
          assert(res.structuredContent?.session_id, JSON.stringify(res.structuredContent));
          latest = res.structuredContent.session_id;
          return traced({ ...r, next: latest }, history);
        };
        // The workspace a session holds, read and written in its store.
        const held = (id) => sessions.store.get(id).response.body.session.workspace;
        const forgetIn = (id) => {
          const record = sessions.store.records.get(id);
          const response = record.response;
          response.body.session.workspace = withoutRecord(response.body.session.workspace);
          sessions.store.records.set(id, { ...record, response });
        };
        const start = (traditions) =>
          call('start_recipe', { traditions }, { traditions, steps: [] });
        // The session holding `prev`'s workspace, as the latest one.
        const current = async (prev) => {
          if (prev.next === latest) return prev.next;
          let at = await start(prev.history.traditions);
          for (const step of prev.history.steps)
            if (step === FORGET) forgetIn(at.next);
            else at = await call('edit_recipe', { session_id: at.next, edits: step }, at.history);
          return at.next;
        };
        return {
          start,
          edit: async (prev, edits) =>
            call('edit_recipe', { session_id: await current(prev), edits }, stepped(prev, edits)),
          render: async (prev, extra = {}) =>
            call('render_recipe', { session_id: await current(prev), ...extra }, prev.history),
          forget: async (prev) => {
            const id = await current(prev);
            forgetIn(id);
            return { ...prev, next: id, history: stepped(prev, FORGET) };
          },
          recorded: async (prev, card) =>
            held(await current(prev)).cards.find((c) => c.id === card)?.[RECORD],
          reopen: async () => {
            await conn.close();
            conn = await open();
          },
          close: () => conn.close(),
        };
      },
    ])
  ),
};

async function onEverySurface(scenario) {
  for (const [name, open] of Object.entries(SURFACES)) {
    const surface = await open();
    try {
      await scenario(surface, name);
    } finally {
      await surface.close();
    }
  }
}

// The warning a response gives for `card`: with `edit` on the call that wrote
// the setting, and without it (the key absent, not null) on every other one.
function expectUnrendered(r, card, env, { edit, where } = {}) {
  const ws = unrendered(r).filter((w) => w.card === card.card);
  assert.equal(
    ws.length,
    1,
    `${where}: one ${NOT_RENDERED} for ${card.card}: ${JSON.stringify(r.render_warnings)}`
  );
  const X = card.instrument;
  const want = {
    card: card.card,
    instrument: X,
    code: NOT_RENDERED,
    ...(edit === undefined ? {} : { edit }),
    environment_card: env.card,
    environment_instrument: env.instrument,
    meaning: `Saved on ${X}, but the recipe takes its room, tuning and chain from ${env.instrument}, so this setting does not set the rendered environment. While ${X}'s preface is auto-derived, it can still shape ${X}'s preface word. Repeat the edit without \`card\` to change the rendered environment.`,
  };
  assert.deepEqual(ws[0], want, where);
  assert.deepEqual(Object.keys(ws[0]), Object.keys(want), `${where}: key order`);
  if (edit === undefined) assert(!('edit' in ws[0]), `${where}: no edit key`);
  assert.equal(r.render_scope.environment_card, env.card, where);
}
const cardOf = (r, id) => r.cards.find((c) => c.card === id);
const garage = async (s) => {
  const seed = await s.start(['garage_rock']);
  return {
    seed,
    env: cardOf(seed, seed.render_scope.environment_card),
    bass: seed.cards.find((c) => c.instrument === 'electric_bass'),
  };
};

test('the record holds what set_environment wrote, on every surface that threads the workspace', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env, bass } = await garage(s);
    for (const card of seed.cards)
      assert.equal(await s.recorded(seed, card.card), undefined, `${name}: a seed records nothing`);
    const wrote = await s.edit(seed, [
      { action: 'set_environment', card: bass.card, room: 'cathedral' },
      { action: 'set_environment', card: bass.card, chain: { fx: 'fuzz_germanium' } },
    ]);
    assert.deepEqual(await s.recorded(wrote, bass.card), {
      room: 'cathedral',
      fx: ['fuzz_germanium'],
    });
    assert.equal(await s.recorded(wrote, env.card), undefined, `${name}: only the card written`);
    await s.reopen();
    const echo = await s.edit(wrote, [
      { action: 'set_environment', card: bass.card, chain: { fx: 'tape_echo' } },
    ]);
    assert.deepEqual(
      await s.recorded(echo, bass.card),
      { room: 'cathedral', fx: ['fuzz_germanium', 'tape_echo'] },
      `${name}: an effect joins the ones written before it, across calls`
    );
    const cleared = await s.edit(echo, [
      { action: 'set_environment', card: bass.card, clear: ['fx'] },
    ]);
    assert.deepEqual(await s.recorded(cleared, bass.card), { room: 'cathedral' });
    const tinted = await s.edit(cleared, [
      { action: 'set_preface', card: bass.card, preface: 'drowning' },
    ]);
    assert.notEqual(cardOf(tinted, bass.card).changed?.room, 'cathedral', `${name}: fixture`);
    assert.equal(
      await s.recorded(tinted, bass.card),
      undefined,
      `${name}: a re-derived room leaves the record, and an empty record leaves the card`
    );
    // A card-less set_environment records on the environment card.
    const whole = await s.edit(seed, [{ action: 'set_environment', tuning: 'just_intonation' }]);
    assert.deepEqual(await s.recorded(whole, env.card), { tuning: 'just_intonation' });
    // The record changes no byte of any format.
    for (const format of FORMATS) {
      const a = await s.render(wrote, { format });
      const b = await s.render(await s.forget(wrote), { format });
      assert.equal(a.recipe, b.recipe, `${name} ${format}: same recipe with and without it`);
    }
  });
});

test('stock environment settings on other cards never warn, on any response', async () => {
  await onEverySurface(async (s, name) => {
    // A blend's second tradition seeds its cards with a room of their own that
    // the environment card does not have: stock, so nobody asked for it.
    for (const traditions of [['garage_rock'], ['tamil_filmi'], ['garage_rock', 'delta_blues']]) {
      const seed = await s.start(traditions);
      const env = seed.render_scope.environment_card;
      assert(
        seed.cards.some((c) => c.card !== env && !c.changed),
        `${name}: fixture has untouched non-environment cards`
      );
      assert.deepEqual(unrendered(seed), [], `${name} start_recipe ${traditions}`);
      for (const format of FORMATS)
        assert.deepEqual(unrendered(await s.render(seed, { format })), [], `${name} ${format}`);
      const other = await s.edit(seed, [{ action: 'add_instrument', instrument: 'harmonica' }]);
      assert.deepEqual(unrendered(other), [], `${name} unrelated edit`);
    }
  });
});

test('the AGENTS.md working order leaves no recurring warning, on any response', async () => {
  // set_preface on every card, then one set_environment without `card`. The
  // prefaces re-derive rooms on cards the environment does not render from;
  // nobody wrote those, so nothing says they do not render (BB8 6681659990).
  await onEverySurface(async (s, name) => {
    for (const traditions of [
      ['garage_rock'],
      ['appalachian_folk'],
      ['garage_rock', 'delta_blues'],
    ]) {
      const where = `${name} ${traditions}`;
      const seed = await s.start(traditions);
      const ordered = await s.edit(seed, [
        ...seed.cards.map((c) => ({ action: 'set_preface', card: c.card, preface: 'drowning' })),
        { action: 'set_environment', room: 'cathedral' },
      ]);
      const env = ordered.render_scope.environment_card;
      assert(
        ordered.cards.some((c) => c.card !== env && c.changed?.room),
        `${where}: fixture: a preface moved the room of a card that does not render it`
      );
      assert.match(ordered.recipe, /cathedral/, where);
      assert.deepEqual(
        ordered.render_warnings.filter((w) =>
          [NOT_RENDERED, 'ENVIRONMENT_MOVED', 'ENVIRONMENT_OVERWRITTEN'].includes(w.code)
        ),
        [],
        `${where}: the edit`
      );
      for (const format of FORMATS)
        assert.deepEqual(unrendered(await s.render(ordered, { format })), [], `${where} ${format}`);
      const later = await s.edit(ordered, [{ action: 'add_instrument', instrument: 'harmonica' }]);
      assert.deepEqual(unrendered(later), [], `${where}: a later edit`);
      // A set_preface on its own, in a later call, on such a card.
      const other = ordered.cards.find((c) => c.card !== env);
      const tinted = await s.edit(ordered, [
        { action: 'set_preface', card: other.card, preface: 'haunting' },
      ]);
      assert.deepEqual(unrendered(tinted), [], `${where}: a later set_preface`);
      assert.deepEqual(unrendered(await s.render(tinted)), [], `${where}: render after it`);
    }
  });
});

test('a written setting warns on its edit, then on every later response without `edit`', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env, bass } = await garage(s);
    const wrote = await s.edit(seed, [
      { action: 'set_environment', card: bass.card, room: 'cathedral' },
    ]);
    assert.equal(wrote.recipe, seed.recipe, `${name}: fixture: the room does not render`);
    assert.equal(cardOf(wrote, bass.card).changed?.room, 'cathedral');
    expectUnrendered(wrote, bass, env, { edit: 0, where: `${name} causing edit` });
    for (const format of FORMATS)
      expectUnrendered(await s.render(wrote, { format }), bass, env, {
        where: `${name} render_recipe ${format}`,
      });
    const later = await s.edit(wrote, [{ action: 'add_instrument', instrument: 'harmonica' }]);
    expectUnrendered(later, bass, env, { where: `${name} unrelated later edit` });
    expectUnrendered(await s.render(later), bass, env, { where: `${name} render after it` });
  });
});

test('the warning clears when the setting is cleared, and stands when the seeded value is written', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env, bass } = await garage(s);
    const stock = 'concrete_basement';
    const write = { action: 'set_environment', card: bass.card, room: 'cathedral' };
    const wrote = await s.edit(seed, [write]);
    expectUnrendered(wrote, bass, env, { edit: 0, where: name });
    const back = await s.edit(wrote, [
      { action: 'set_environment', card: bass.card, clear: ['room'] },
    ]);
    assert.deepEqual(unrendered(back), [], `${name} cleared`);
    assert.deepEqual(unrendered(await s.render(back)), [], `${name} render after`);
    // The seeded room written back is still a value a set_environment wrote:
    // nothing is inferred from values.
    const again = await s.edit(wrote, [{ ...write, room: stock }]);
    assert.equal(cardOf(again, bass.card).changed?.room, undefined, `${name}: fixture`);
    expectUnrendered(again, bass, env, { edit: 0, where: `${name} the seeded room written` });
    expectUnrendered(await s.render(again), bass, env, { where: `${name} render after` });
    // In one batch: the write that stands is the one named.
    expectUnrendered(await s.edit(seed, [write, { ...write, room: stock }]), bass, env, {
      edit: 1,
      where: `${name} write, then the seeded room`,
    });
    assert.deepEqual(
      unrendered(
        await s.edit(seed, [write, { action: 'set_environment', card: bass.card, clear: ['room'] }])
      ),
      [],
      `${name}: write, then clear`
    );
  });
});

test('a set_preface that re-derives a written setting takes it out: ENVIRONMENT_OVERWRITTEN once', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env, bass } = await garage(s);
    const write = { action: 'set_environment', card: bass.card, room: 'cathedral' };
    const drowning = { action: 'set_preface', card: bass.card, preface: 'drowning' };
    const wrote = await s.edit(seed, [write]);
    expectUnrendered(wrote, bass, env, { edit: 0, where: name });
    // drowning re-derives the bass's room.
    const over = await s.edit(wrote, [drowning]);
    const room = cardOf(over, bass.card).changed?.room;
    assert(room && room !== 'cathedral', `${name}: fixture: the preface moved the room`);
    assert.deepEqual(
      overwritten(over).map((w) => [w.card, w.instrument, w.edit, w.action, w.settings]),
      [[bass.card, 'electric_bass', 0, 'set_preface', { room: { was: 'cathedral', now: room } }]],
      `${name}: the transition, on its edit`
    );
    assert.equal(
      overwritten(over)[0].meaning,
      `set_preface on electric_bass replaced the environment you set (room cathedral → ${room}): it re-derives room, tuning and chain toward the preface. To keep your settings, put set_environment after set_preface in the same batch.`
    );
    assert.deepEqual(unrendered(over), [], `${name}: the warning clears with it`);
    const after = await s.render(over);
    assert.deepEqual(overwritten(after), [], `${name}: said once`);
    assert.deepEqual(unrendered(after), [], `${name}: render after`);
    // A preface that leaves the written room as it was takes nothing out.
    const kept = await s.edit(wrote, [{ ...drowning, preface: 'raging' }]);
    assert.equal(cardOf(kept, bass.card).changed?.room, 'cathedral', `${name}: fixture`);
    assert.deepEqual(overwritten(kept), [], `${name}: nothing was replaced`);
    expectUnrendered(kept, bass, env, { where: `${name} a preface that kept the room` });
    // In one batch: a set_preface after the write reports it; a set_environment
    // after the set_preface is the documented order, and stands.
    const batch = await s.edit(seed, [write, drowning]);
    assert.deepEqual(
      overwritten(batch).map((w) => [w.card, w.edit]),
      [[bass.card, 1]]
    );
    assert.deepEqual(unrendered(batch), [], `${name}: write, then preface`);
    const ordered = await s.edit(seed, [drowning, write]);
    assert.deepEqual(overwritten(ordered), [], `${name}: preface, then write`);
    expectUnrendered(ordered, bass, env, { edit: 1, where: `${name} preface, then write` });
    const restored = await s.edit(seed, [write, drowning, write]);
    assert.deepEqual(overwritten(restored), [], `${name}: written again after the preface`);
    expectUnrendered(restored, bass, env, { edit: 2, where: `${name} written again` });
  });
});

test('a workspace with no record is silent on render and warns at edit time, as before', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env, bass } = await garage(s);
    const wrote = await s.edit(seed, [
      { action: 'set_environment', card: bass.card, room: 'cathedral' },
    ]);
    const old = await s.forget(wrote);
    assert.equal(await s.recorded(old, bass.card), undefined, `${name}: fixture`);
    const shown = await s.render(old);
    assert.equal(cardOf(shown, bass.card).changed?.room, 'cathedral', `${name}: still on the card`);
    for (const format of FORMATS)
      assert.deepEqual(unrendered(await s.render(old, { format })), [], `${name} ${format}`);
    const other = await s.edit(old, [{ action: 'add_instrument', instrument: 'harmonica' }]);
    assert.deepEqual(unrendered(other), [], `${name}: an unrelated edit`);
    // A set_environment with that card warns on its edit, and from then on.
    const tuned = await s.edit(old, [
      { action: 'set_environment', card: bass.card, tuning: 'just_intonation' },
    ]);
    expectUnrendered(tuned, bass, env, { edit: 0, where: `${name} a new write` });
    expectUnrendered(await s.render(tuned), bass, env, { where: `${name} render after it` });
    // The environment card's own unrecorded settings are not reported as moved.
    const whole = await s.forget(
      await s.edit(seed, [{ action: 'set_environment', room: 'cathedral' }])
    );
    const guitar = seed.cards.find((c) => c.instrument === 'electric_guitar_single_coil');
    const front = await s.edit(whole, [{ action: 'move_instrument', card: guitar.card }]);
    assert.equal(front.render_scope.environment_card, guitar.card, `${name}: fixture`);
    assert.deepEqual(moved(front), [], `${name}: no record, nothing moved`);
    assert.deepEqual(unrendered(front), [], `${name}: and nothing unrendered`);
  });
});

test('ENVIRONMENT_MOVED speaks only for settings a set_environment wrote', async () => {
  await onEverySurface(async (s, name) => {
    // An untouched seed changing hands.
    const blend = await s.start(['garage_rock', 'delta_blues']);
    const handed = await s.edit(blend, [
      { action: 'move_instrument', card: blend.cards.at(-1).card },
    ]);
    assert.notEqual(
      handed.render_scope.environment_card,
      blend.render_scope.environment_card,
      `${name}: fixture`
    );
    assert.deepEqual(moved(handed), [], `${name}: a stock environment changing hands`);
    // A room a set_preface re-derived on the environment card.
    const folk = await s.start(['appalachian_folk']);
    const voice = folk.render_scope.environment_card;
    const tinted = await s.edit(folk, [{ action: 'set_preface', card: voice, preface: 'raging' }]);
    assert.notEqual(
      tinted.render_scope.environment_settings.room,
      folk.render_scope.environment_settings.room,
      `${name}: fixture: the preface moved the room`
    );
    const move = { action: 'move_instrument', card: folk.cards[1].card };
    const away = await s.edit(tinted, [move]);
    assert.notEqual(away.render_scope.environment_card, voice, `${name}: fixture`);
    assert.deepEqual(moved(away), [], `${name}: a re-derived room is not a written one`);
    assert.deepEqual(unrendered(away), [], `${name}: nor does it warn on its old card`);
    // A room a set_environment wrote there: MOVED once, for that room.
    const wrote = await s.edit(tinted, [{ action: 'set_environment', room: 'cathedral' }]);
    const gone = await s.edit(wrote, [move]);
    assert.deepEqual(
      moved(gone).map((w) => [w.card, w.edit, Object.keys(w.settings)]),
      [[voice, 0, ['room']]],
      `${name}: the written room`
    );
    expectUnrendered(gone, cardOf(folk, voice), cardOf(gone, gone.render_scope.environment_card), {
      where: `${name}: and it stands on the old card`,
    });
    assert.deepEqual(moved(await s.render(gone)), [], `${name}: once`);
  });
});

test('the environment moving to the written card is ENVIRONMENT_MOVED once, and its warning goes', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env, bass } = await garage(s);
    const ownRoom = await s.edit(seed, [{ action: 'set_environment', room: 'cathedral' }]);
    assert.deepEqual(
      ownRoom.render_warnings,
      [],
      `${name}: a write on the environment card renders`
    );
    const wrote = await s.edit(ownRoom, [
      { action: 'set_environment', card: bass.card, room: 'tin_roofed_shack' },
    ]);
    expectUnrendered(wrote, bass, env, { edit: 0, where: name });
    const front = await s.edit(wrote, [{ action: 'move_instrument', card: bass.card }]);
    assert.equal(front.render_scope.environment_card, bass.card, `${name}: fixture`);
    assert.match(front.recipe, /tin-roofed/, `${name}: the written room renders now`);
    assert.equal(moved(front).length, 1, `${name}: ${JSON.stringify(front.render_warnings)}`);
    assert.equal(moved(front)[0].card, env.card);
    assert.equal(moved(front)[0].edit, 0);
    assert.deepEqual(
      unrendered(front).filter((w) => w.card === bass.card),
      [],
      `${name}: no state warning for the card that renders now`
    );
    const after = await s.render(front);
    assert.deepEqual(moved(after), [], `${name}: the transition is said once`);
    assert.deepEqual(
      unrendered(after).filter((w) => w.card === bass.card),
      [],
      `${name}: render after the move`
    );
  });
});

test('a multi-select write warns while an item it added is still in the list', async () => {
  await onEverySurface(async (s, name) => {
    const seed = await s.start(['tamil_filmi']);
    const env = cardOf(seed, seed.render_scope.environment_card);
    const [veena, bansuri] = ['veena', 'bansuri'].map((i) =>
      seed.cards.find((c) => c.instrument === i)
    );
    const fuzz = { action: 'set_environment', card: veena.card, chain: { fx: 'fuzz_germanium' } };
    const added = await s.edit(seed, [fuzz]);
    expectUnrendered(added, veena, env, { edit: 0, where: `${name} added` });
    expectUnrendered(await s.render(added), veena, env, { where: `${name} render` });
    // Another effect on the same card in a later call: one warning, naming it.
    const echo = await s.edit(added, [{ ...fuzz, chain: { fx: 'tape_echo' } }]);
    expectUnrendered(echo, veena, env, { edit: 0, where: `${name} second effect` });
    // An item the card was seeded with, written again, is a write: the caller
    // chose it, and the bansuri does not render it.
    const stock = await s.edit(added, [
      { action: 'set_environment', card: bansuri.card, chain: { fx: 'plate_reverb' } },
    ]);
    assert.deepEqual(
      unrendered(stock).map((w) => [w.card, w.edit]),
      [
        [bansuri.card, 0],
        [veena.card, undefined],
      ],
      `${name}: the reverb written on bansuri, and the fuzz from the earlier call`
    );
    // Cleared: the list emptied, or replaced by an item of its own.
    const gone = await s.edit(echo, [
      { action: 'set_environment', card: veena.card, clear: ['fx'] },
    ]);
    assert.deepEqual(unrendered(gone), [], `${name} cleared`);
    assert.deepEqual(unrendered(await s.render(gone)), [], `${name} render after clearing`);
    const replaced = await s.edit(echo, [
      { action: 'set_environment', card: veena.card, clear: ['fx'], chain: { fx: 'plate_reverb' } },
    ]);
    expectUnrendered(replaced, veena, env, { edit: 0, where: `${name} replaced` });
    // Retained against removed in one batch.
    assert.deepEqual(
      unrendered(
        await s.edit(seed, [fuzz, { action: 'set_environment', card: veena.card, clear: ['fx'] }])
      ),
      [],
      `${name}: write then clear`
    );
    expectUnrendered(
      await s.edit(seed, [{ action: 'set_environment', card: veena.card, clear: ['fx'] }, fuzz]),
      veena,
      env,
      { edit: 1, where: `${name} clear then write` }
    );
    expectUnrendered(
      await s.edit(seed, [
        fuzz,
        { action: 'set_environment', card: veena.card, clear: ['fx'] },
        fuzz,
      ]),
      veena,
      env,
      { edit: 2, where: `${name} write, clear, write: the write that stands` }
    );
  });
});

test('an effects list replaced or reordered warns while an item written into it is there', async () => {
  // `clear` then add is the documented way to replace a list. Every item it adds
  // is a value the caller wrote, even one the card was seeded with, and even when
  // the list comes back exactly as seeded: nothing is inferred from values.
  const cases = [
    // [tradition, card, the seeded list, the list written]
    ['city_pop', 'card_7', ['chorus_pedal', 'fx_lexicon_224'], ['fx_lexicon_224', 'chorus_pedal']],
    ['honky_tonk', 'card_2', ['spring_reverb', 'analog_delay'], ['spring_reverb']],
  ];
  for (const [tradition, id, stock] of cases) {
    const seeded = startRecipe({ traditions: [tradition] });
    const card = seeded.workspace.cards.find((c) => c.id === id);
    assert.deepEqual(card.chain.fx, stock, `fixture: ${tradition} ${id} fx`);
    assert.notEqual(seeded.render_scope.environment_card, id, `fixture: ${tradition} ${id}`);
  }
  await onEverySurface(async (s, name) => {
    for (const [tradition, id, stock, list] of cases) {
      const seed = await s.start([tradition]);
      const env = cardOf(seed, seed.render_scope.environment_card);
      const card = cardOf(seed, id);
      // The published schema takes one effect per edit: clear with the first,
      // then add the rest, each in its own edit.
      const replace = ([first, ...rest]) => [
        { action: 'set_environment', card: id, clear: ['fx'], chain: { fx: first } },
        ...rest.map((fx) => ({ action: 'set_environment', card: id, chain: { fx } })),
      ];
      const wrote = await s.edit(seed, replace(list));
      assert.deepEqual(cardOf(wrote, id).changed?.chain?.fx, list, `${name}: changed says it`);
      expectUnrendered(wrote, card, env, { edit: 0, where: `${name} ${tradition} edit` });
      expectUnrendered(await s.render(wrote), card, env, { where: `${name} ${tradition} render` });
      // Put back as seeded, in the seeded order, by set_environment: written.
      const back = await s.edit(wrote, replace(stock));
      assert.equal(cardOf(back, id).changed, undefined, `${name}: fixture: the seeded list`);
      expectUnrendered(back, card, env, { edit: 0, where: `${name} ${tradition} written back` });
      // Emptied: nothing written stands.
      const empty = await s.edit(wrote, [{ action: 'set_environment', card: id, clear: ['fx'] }]);
      assert.deepEqual(unrendered(empty), [], `${name} ${tradition} cleared`);
      assert.deepEqual(unrendered(await s.render(empty)), [], `${name} ${tradition} render after`);
    }
  });
});

test('the causing edit and the standing state are one warning, not two', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env, bass } = await garage(s);
    const room = { action: 'set_environment', card: bass.card, room: 'cathedral' };
    const tuning = { action: 'set_environment', card: bass.card, tuning: 'just_intonation' };
    const wrote = await s.edit(seed, [room]);
    // The room stands from the earlier call; this call writes the tuning.
    expectUnrendered(await s.edit(wrote, [tuning]), bass, env, {
      edit: 0,
      where: `${name} second field in a later call`,
    });
    // One warning per card and set of fields still standing: two edits in one
    // call that each leave a different field standing are each named, as the
    // edit response always named them; two effects added to one list leave the
    // same field, and are said once, by the first.
    const two = await s.edit(seed, [room, tuning]);
    assert.deepEqual(
      unrendered(two).map((w) => [w.card, w.edit]),
      [
        [bass.card, 0],
        [bass.card, 1],
      ],
      `${name} two fields, one batch`
    );
    const effects = await s.edit(seed, [
      { action: 'set_environment', card: bass.card, chain: { fx: 'plate_reverb' } },
      { action: 'set_environment', card: bass.card, chain: { fx: 'fuzz_germanium' } },
    ]);
    expectUnrendered(effects, bass, env, { edit: 0, where: `${name} two effects, one list` });
    // Once the call is over the card's settings are one standing state: one
    // warning, no `edit`.
    expectUnrendered(await s.render(two), bass, env, { where: `${name} render after` });
    expectUnrendered(
      await s.edit(seed, [
        { action: 'add_instrument', instrument: 'harmonica' },
        room,
        { ...room, room: 'tin_roofed_shack' },
      ]),
      bass,
      env,
      { edit: 2, where: `${name} the write that stands names it` }
    );
  });
});

test('the warning recurs after the state is carried on: a new server, or another environment card', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env, bass } = await garage(s);
    const wrote = await s.edit(seed, [
      { action: 'set_environment', card: bass.card, room: 'cathedral' },
    ]);
    await s.reopen();
    expectUnrendered(await s.render(wrote), bass, env, { where: `${name} after reopening` });
    // The environment card is removed and the environment passes to the next
    // card that has one, which is not the written card: the warning names it.
    const removed = await s.edit(wrote, [{ action: 'remove_instrument', card: env.card }]);
    const next = cardOf(removed, removed.render_scope.environment_card);
    assert.notEqual(next.card, bass.card, `${name}: fixture`);
    assert.deepEqual(moved(removed), [], `${name}: a stock environment changing hands`);
    expectUnrendered(removed, bass, next, { where: `${name} environment passed on` });
    expectUnrendered(await s.render(removed), bass, next, { where: `${name} render after` });
    // The written card removed: the warning leaves with it.
    const without = await s.edit(wrote, [{ action: 'remove_instrument', card: bass.card }]);
    assert.deepEqual(unrendered(without), [], `${name}: the card is gone`);
  });
});

test('a value written on the environment card warns once another card takes the environment', async () => {
  await onEverySurface(async (s, name) => {
    const { seed, env: first } = await garage(s);
    const guitar = seed.cards.find((c) => c.instrument === 'electric_guitar_single_coil');
    const write = { action: 'set_environment', room: 'cathedral' };
    const move = { action: 'move_instrument', card: guitar.card };
    const wrote = await s.edit(seed, [write]);
    assert.deepEqual(unrendered(wrote), [], `${name}: it renders while its card leads`);
    const front = await s.edit(wrote, [move]);
    assert.equal(front.render_scope.environment_card, guitar.card, `${name}: fixture`);
    assert.doesNotMatch(front.recipe, /cathedral/);
    assert.deepEqual(
      moved(front).map((w) => [w.card, w.edit]),
      [[first.card, 0]],
      `${name}: the transition, on its edit`
    );
    expectUnrendered(front, first, guitar, { where: `${name} re-attributed` });
    const later = await s.render(front);
    assert.deepEqual(moved(later), [], `${name}: MOVED stays on its edit`);
    expectUnrendered(later, first, guitar, { where: `${name} render after` });
    // set_environment without a card now lands on the new environment card and
    // leaves the old card's room where it is.
    const there = await s.edit(front, [{ action: 'set_environment', tuning: 'just_intonation' }]);
    expectUnrendered(there, first, guitar, { where: `${name} later environment edit` });
    // The same two steps in one batch name the write, as they always have.
    const batch = await s.edit(seed, [write, move]);
    assert.deepEqual(
      moved(batch).map((w) => [w.card, w.edit]),
      [[first.card, 1]]
    );
    expectUnrendered(batch, first, guitar, { edit: 0, where: `${name} one batch` });
    // Moved back: it renders again, and nothing is said about it.
    const home = await s.edit(front, [{ action: 'move_instrument', card: first.card }]);
    assert.match(home.recipe, /cathedral/, `${name}: back`);
    assert.deepEqual(unrendered(home), [], `${name}: back on the environment card`);
  });
});
