import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { connectConnector } from './client.js';
import { buildServer } from './tools.js';
import { startRecipe, editRecipe, renderRecipe } from './engine.js';
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
  assert.throws(() => W.moveInstrument(original.workspace, 'absent'), /Unknown card/);
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
