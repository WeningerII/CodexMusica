import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';

let client, server;
before(async () => {
  server = buildServer({ task: { domain: 'lyrics' } });
  client = new Client({ name: 'song-form-recovery-test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
});
after(async () => {
  await Promise.all([client?.close(), server?.close()]);
});

const lines = ['one two three four five', 'one two three', 'five four three two one'];

function call(args) {
  return client.callTool(
    {
      name: 'lyric_recover',
      arguments: { lines, placements: 'end', ...args },
    },
    undefined,
    { timeout: 120_000 }
  );
}

async function recover(args) {
  const response = await call(args);
  assert.ok(!response.isError, JSON.stringify(response));
  for (const block of response.content) {
    if (block.type !== 'text') continue;
    try {
      const value = JSON.parse(block.text);
      if (typeof value.exit_code === 'number') return value;
    } catch {
      /* Other blocks contain the user-facing report. */
    }
  }
  assert.fail('No lyric_recover verdict returned by MCP');
}

test('optional form uses the complete reader measurements and preserves the ordinary recovery result', async () => {
  const ordinary = await recover({});
  assert.ok(!Object.hasOwn(ordinary, 'catalog_form'));
  const selected = await recover({ catalog_form: 'lune', catalog_variant: 0 });
  assert.deepEqual(selected.lines, ordinary.lines);
  assert.deepEqual(selected.mandate, ordinary.mandate);
  assert.deepEqual(selected.refusals, ordinary.refusals);
  assert.equal(selected.exit_code, ordinary.exit_code);
  assert.equal(selected.catalog_form.verdict, 'pass');
  assert.deepEqual(
    selected.catalog_form.checks.filter((c) => c.kind === 'syllables').map((c) => c.outcome),
    ['pass', 'pass', 'pass']
  );
});

test('a measurable wrong line fails but an unreadable line is unknown', async () => {
  const shape = { catalog_form: 'lune', catalog_variant: 0 };
  const wrong = await recover({ ...shape, lines: [lines[0], 'one two', lines[2]] });
  assert.equal(wrong.catalog_form.verdict, 'fail');
  const unclear = await recover({ ...shape, lines: [lines[0], 'one qzzxv', lines[2]] });
  assert.equal(unclear.catalog_form.verdict, 'unknown');
  assert.deepEqual(
    unclear.catalog_form.checks.filter((c) => c.kind === 'syllables').map((c) => c.outcome),
    ['pass', 'unknown', 'pass']
  );
});

test('dictionary variants with differing counts abstain while a shared count survives a stress disagreement', async () => {
  const shape = { catalog_form: 'lune', catalog_variant: 0 };
  const measure = (middle) => recover({ ...shape, lines: [lines[0], middle, lines[2]] });
  const variableLength = await measure('one fire');
  assert.equal(variableLength.catalog_form.verdict, 'unknown');
  const sharedLength = await measure('one record');
  assert.equal(sharedLength.catalog_form.verdict, 'pass');
  assert.match(sharedLength.catalog_form.meter_basis, /shared by all listed readings/);
});

test('undecided and deferred forms never report a successful match', async () => {
  const undecided = await recover({ catalog_form: 'lune' });
  assert.equal(undecided.catalog_form.status, 'needs-input');
  assert.equal(undecided.catalog_form.verdict, 'unknown');
  assert.deepEqual(undecided.catalog_form.needs[0].choices, [0, 1]);
  const deferred = await recover({ catalog_form: 'acrostic' });
  assert.equal(deferred.catalog_form.status, 'deferred');
  assert.equal(deferred.catalog_form.verdict, 'unknown');
});

test('printed headers compare by section role while the recovered source retains its original spelling', async () => {
  const shape = { catalog_form: 'strophic', catalog_counts: [{ path: '1.1', count: 2 }] };
  const marked = [
    '[VERSE1 — 1 line — 4 bars of 4/4]',
    'one two',
    '[VERSE 2 — 1 line — 4 bars of 4/4]',
    'three four',
    '[GRADED — seed 1]',
  ];
  const original = await recover({ ...shape, lines: marked });
  assert.deepEqual(original.lines, ['one two', 'three four']);
  assert.equal(original.sections[0].name, marked[0].slice(1, -1));
  assert.deepEqual(
    original.catalog_form.checks.filter((c) => c.kind === 'role').map((c) => c.outcome),
    ['pass', 'pass']
  );
  assert.equal(original.catalog_form.checks.find((c) => c.kind === 'sections-count').actual, 2);
  const changed = await recover({
    ...shape,
    lines: marked.map((x) => x.replace('VERSE 2', 'CHORUS 2')),
  });
  assert.equal(changed.catalog_form.verdict, 'fail');
  const unmarked = await recover({ ...shape, lines: ['one two', '', 'three four'] });
  assert.equal(unmarked.catalog_form.verdict, 'unknown');
  assert.ok(!unmarked.catalog_form.checks.some((c) => c.kind === 'role' && c.outcome === 'pass'));
});

test('numbered pre-chorus headers preserve the role across harness and editor spellings', async () => {
  const item = await recover({
    catalog_form: 'verse-prechorus-chorus',
    catalog_counts: [
      { path: '1.1', count: 2 },
      { path: '1.1.2.1', count: 2 },
    ],
    lines: [
      '[VERSE1]',
      'one',
      '[PRE_CHORUS1]',
      'two',
      'three',
      '[CHORUS1]',
      'four',
      '[VERSE 2]',
      'one',
      '[PRE-CHORUS 2]',
      'two',
      'three',
      '[CHORUS 2]',
      'four',
    ],
  });
  const checks = item.catalog_form.checks.filter((c) => c.kind === 'role');
  assert.equal(checks.length, 6);
  assert.ok(checks.every((c) => c.outcome === 'pass'));
});

test('correct total line count cannot hide a misplaced section break', async () => {
  const item = await recover({
    catalog_form: 'strophic-with-refrain',
    catalog_variant: 0,
    catalog_counts: [
      { path: '1.1', count: 2 },
      { path: '1.1.1', count: 1 },
    ],
    lines: ['[VERSE 1]', 'one', 'two', 'three', '[VERSE 2]', 'four'],
  });
  assert.equal(item.catalog_form.checks.find((c) => c.kind === 'lines-count').outcome, 'pass');
  assert.equal(item.catalog_form.verdict, 'fail');
  assert.ok(item.catalog_form.checks.some((c) => c.kind === 'line-span' && c.outcome === 'fail'));
});

test('invalid selection is refused over the MCP boundary', async () => {
  for (const args of [
    { catalog_variant: 0 },
    { catalog_form: 'no-such-song-form' },
    { catalog_form: 'lune', catalog_variant: 31 },
    {
      catalog_form: 'strophic',
      catalog_counts: [
        { path: '1.1', count: 2 },
        { path: '1.1', count: 3 },
      ],
    },
  ]) {
    const response = await call(args);
    assert.equal(response.isError, true, JSON.stringify(response));
    assert.match(
      JSON.stringify(response.content),
      /catalog_form|[Uu]nknown form|[Uu]nknown variant|[Dd]uplicate count/
    );
  }
});

test('recovery judges word positions from the native sung tokens', async () => {
  const { prepareFormReview, reviewRecoveredForm } = await import('./lyric_form.js');
  const selection = await prepareFormReview({ catalog_form: 'lune', catalog_variant: 1 });
  const printed = ['a b c (d)', 'a b c d e', 'a b c'];
  const check = (first) =>
    reviewRecoveredForm(selection, {
      lines: printed,
      form_reading: [first, ['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c']].map((sungWords) => ({
        sungWords,
      })),
    }).verdict;
  assert.equal(check(['a', 'b', 'c']), 'pass');
  assert.equal(check(['a', 'b', 'c', 'd']), 'fail');
  assert.equal(check(null), 'unknown');
  assert.equal(reviewRecoveredForm(selection, { lines: printed }).verdict, 'unknown');
});

test('recovery checks a descending syllable rhyme at its printed positions', async () => {
  const run = (middle) =>
    recover({
      catalog_form: 'than-bauk',
      lines: ['x x x x', middle, 'y x z z'],
    });
  const passed = await run('x x x y');
  assert.equal(passed.catalog_form.verdict, 'pass');
  const changed = await run('x x z y');
  assert.equal(
    changed.catalog_form.checks.find((c) => c.kind === 'syllable-rhyme').outcome,
    'fail'
  );
});

test('Pindaric header recovery reports the actual printed lines and leaves the meter unresolved', async () => {
  const grade = await recover({
    catalog_form: 'pindaric-ode',
    catalog_counts: [{ path: '1.1', count: 1 }],
    lines: ['[Strophe 1]', 'one', 'two', '[Antistrophe 1]', 'one', 'two', '[Epode 1]', 'three'],
  });
  assert.equal(grade.catalog_form.verdict, 'unknown');
  assert.deepEqual(
    grade.catalog_form.checks.find((c) => c.kind === 'metrical-responsion').printedLineCounts,
    [2, 2]
  );
  assert.equal(
    grade.catalog_form.checks.find((c) => c.kind === 'epode-meter-contrast').printedLineCount,
    1
  );
});

test('recovery requests per-syllable sounds only for an active syllable rhyme', async () => {
  const { catalogReadingFlag, prepareFormReview } = await import('./lyric_form.js');
  const flag = async (options) => catalogReadingFlag((await prepareFormReview(options))?.plan);
  assert.equal(await flag({}), null);
  assert.equal(await flag({ catalog_form: 'lune' }), null);
  assert.equal(await flag({ catalog_form: 'lune', catalog_variant: 0 }), '--form-reading=lines');
  assert.equal(await flag({ catalog_form: 'luc-bat' }), '--form-reading');
  assert.equal(await flag({ catalog_form: 'than-bauk' }), '--form-reading');
});
