import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from './tools.js';

let client, server;
before(async () => {
  server = buildServer({ task: { domain: 'lyrics' } });
  client = new Client({ name: 'catalog-writing-check', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(a), server.connect(b)]);
});
after(async () => {
  await Promise.all([client?.close(), server?.close()]);
});

const call = (name, args) =>
  client.callTool({ name, arguments: args }, undefined, { timeout: 120_000 });
function verdict(response) {
  assert.ok(!response.isError, JSON.stringify(response));
  for (const block of response.content) {
    if (block.type !== 'text') continue;
    try {
      const value = JSON.parse(block.text);
      if (typeof value.exit_code === 'number') return value;
    } catch {
      // The other block is the ordinary plain-text report.
    }
  }
  assert.fail('Expected a native writing verdict');
}

test('catalog groups and separate returns run the same writing checks and are accepted unchanged by revise', async () => {
  const lines = [
    'one two',
    'two three',
    'three four',
    'one two',
    'four five',
    'five six',
    'one two',
    'two three',
  ];
  const selected = verdict(await call('lyric_check', { lines, catalog_form: 'triolet' }));
  const wire = selected.catalog_form.rhyme_mandate;
  assert.deepEqual(wire, {
    groups: '1,3,5;2,6',
    returns: '1,4,7;2,8',
    relation: 'type:perfect rhyme (last stressed syllable)',
  });
  assert.equal(selected.catalog_form.expected_lines, 8);
  assert.equal(selected.catalog_form.measurement.verdict, 'fail');
  assert.ok(
    selected.catalog_form.measurement.checks.some(
      (c) => c.kind === 'returns' && c.outcome === 'pass'
    )
  );
  const explicit = verdict(await call('lyric_check', { lines, ...wire }));
  assert.equal(explicit.findings_measured, true);
  assert.equal(explicit.catalog_form, undefined);
  assert.equal(selected.exit_code, explicit.exit_code);
  assert.equal(selected.coverage.pairs_judged, explicit.coverage.pairs_judged);
  assert.ok(selected.findings.some((f) => f.code === 'CATALOG_FORM_MISMATCH'));
  const revised = verdict(
    await call('lyric_revise', {
      draft: lines,
      ...selected.catalog_form.revision_mandate,
      max_rounds: 1,
      attempts: 0,
      backtrack: 0,
    })
  );
  assert.ok([0, 3, 4].includes(revised.exit_code), JSON.stringify(revised));
  assert.ok(revised.run_id, 'revision received a native run capability');
});

test('an undecided, conflicting or unmappable catalog declaration cannot silently pass', async () => {
  const lines = ['one two', 'two three'];
  const cases = [
    [{ catalog_form: 'couplet' }, /needs-input/],
    [{ catalog_form: 'acrostic' }, /deferred/],
    [{ catalog_variant: 0 }, /require catalog_form/],
    [{ catalog_form: 'couplet', catalog_variant: 1, groups: '1,1' }, /conflicts/],
    [
      { catalog_form: 'couplet', catalog_variant: 1, relation: 'class:ASSONANCE' },
      /separate check/,
    ],
    [{ catalog_form: 'couplet', catalog_variant: 0 }, /declare one of/],
    [{ catalog_form: 'triolet' }, /requires 8 sung lines/],
  ];
  for (const [args, expected] of cases) {
    const answer = await call('lyric_check', { lines, ...args });
    assert.equal(answer.isError, true, JSON.stringify(answer));
    assert.match(answer.content[0].text, expected);
  }
});

test('catalog end-rhyme obligations reject a pair that shares only its vowel', async () => {
  const lines = ['one home', 'two alone'];
  const assonance = verdict(
    await call('lyric_check', { lines, groups: '1,2', relation: 'class:ASSONANCE' })
  );
  const endRhyme = verdict(
    await call('lyric_check', { lines, catalog_form: 'couplet', catalog_variant: 1 })
  );
  assert.equal(endRhyme.findings_measured, true, endRhyme.report);
  assert.equal(assonance.findings_measured, true, assonance.report);
  assert.equal(endRhyme.exit_code, 3, endRhyme.report);
  const wrongPair = endRhyme.findings.find(
    (finding) => finding.code === 'SCHEME_VIOLATION' && finding.severity === 'flag'
  );
  assert.deepEqual(wrongPair?.locations, [1, 2]);
  assert.equal(assonance.exit_code, 0);
  const coarse = verdict(
    await call('lyric_check', {
      lines,
      catalog_form: 'couplet',
      catalog_variant: 1,
      relation: 'class:RHYME',
      numbering: 'v2',
    })
  );
  assert.equal(coarse.catalog_form.rhyme_mandate.relation, 'class:RHYME');
  assert.equal(coarse.coverage.pairs_judged, 1);
  assert.equal(coarse.exit_code, 3);
});

test('native writing and revision retain per-line catalog meter and refusals', async () => {
  const draft = ['one two', 'three four'];
  const result = verdict(
    await call('lyric_check', { lines: draft, catalog_form: 'heroic-couplet' })
  );
  const meter = result.catalog_form.measurement;
  assert.equal(meter.verdict, 'fail');
  for (const kind of ['syllables', 'stress', 'stresses']) {
    assert.deepEqual(
      meter.checks.filter((c) => c.kind === kind && c.outcome === 'fail').flatMap((c) => c.lines),
      [1, 2]
    );
  }
  const resumed = verdict(
    await call('lyric_revise', {
      draft,
      catalog_form: 'heroic-couplet',
      max_rounds: 1,
      attempts: 0,
      backtrack: 0,
    })
  );
  assert.equal(resumed.catalog_form.selector.id, result.catalog_form.selector.id);
  assert.ok(resumed.exit_code !== 0);
  const unread = verdict(
    await call('lyric_check', { lines: ['qxzz qzxw', draft[1]], catalog_form: 'heroic-couplet' })
  );
  assert.ok(
    unread.catalog_form.measurement.checks.some(
      (c) => c.kind === 'syllables' && c.outcome === 'unknown'
    )
  );
  assert.equal(unread.certified, false);
});

test('a submitted word-count stanza retains observed lexical roles on revision', async () => {
  const rows = [
    ['addition'],
    ['positive', 'negative'],
    ['computing', 'multiplying', 'dividing'],
    ['one', 'two', 'three', 'four'],
    ['four', 'four', 'four'],
    ['positive', 'negative'],
    ['subtraction'],
  ];
  const lines = rows.map((row) => row.join(' '));
  const checked = verdict(
    await call('lyric_check', {
      lines,
      catalog_form: 'diamante',
      catalog_variant: 1,
      groups: '2,6',
      relation: 'class:RHYME',
    })
  );
  function confirm(report) {
    const roles = report.checks.filter((c) => c.kind === 'role');
    assert.equal(roles.find((c) => c.expected === 'antonym').outcome, 'pass');
    assert.equal(roles.find((c) => c.expected === 'middle-phrase').outcome, 'unknown');
    assert.deepEqual(
      roles.filter((c) => c.expected === 'ing-verbs').map((c) => c.outcome),
      ['pass', 'fail']
    );
    assert.equal(report.verdict, 'fail');
  }
  confirm(checked.catalog_form.measurement);
  const revised = verdict(
    await call('lyric_revise', {
      draft: lines,
      ...checked.catalog_form.revision_mandate,
      attempts: 0,
      max_rounds: 1,
      backtrack: 0,
    })
  );
  confirm(revised.coverage.catalog_form);
});
