import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describeForm, realizeForm } from '../src/song-forms.mjs';
import { projectSongFormCreation } from '../src/song-form-creation.mjs';

const catalog = JSON.parse(readFileSync(new URL('../data/song-forms.json', import.meta.url), 'utf8'));
const make = (unit, fields = {}) => ({ unit, ...fields });
const line = (fields = {}) => make('line', fields);
const stanza = (...children) => make('stanza', { children });
const poem = (...children) => make('poem', { children });
const numbered = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
const entry = (...patterns) => [{ id: 'f', name: 'F', scope: 'rule', patterns }];
const projection = (forms, id, options = {}) =>
  projectSongFormCreation(realizeForm(forms, id, options), options.counts);

test('every published selection has an exact structural contract or an explicit refusal', () => {
  const classified = new Set();
  const contracts = [];
  let named = 0, refused = 0;
  for (const form of catalog) {
    const { variants } = describeForm(catalog, form.id);
    const initial = projection(catalog, form.id);
    if (form.scope === 'deferred') {
      assert.equal(initial.status, 'deferred', form.id);
      assert.equal(initial.contract, null, form.id);
    } else if (variants.length > 1) {
      assert.equal(initial.status, 'needs-input', form.id);
      assert.deepEqual(initial.needs[0].choices, variants.map(v => v.index), form.id);
    }
    for (const choice of variants) {
      const counts = Object.fromEntries(choice.counts.map(({ path, min, max }) =>
        [path, Math.min(min + 1, max ?? Infinity)]));
      const options = { variant: choice.index, counts };
      const realization = realizeForm(catalog, form.id, options);
      const projected = projectSongFormCreation(realization, counts);
      const where = form.id + '/' + choice.index;
      assert.equal(projected.scope, form.scope, where);
      if (projected.status === 'unsupported') {
        refused++;
        assert.equal(projected.contract, null, where);
        assert.ok(projected.reasons.length, where);
        assert.ok(projected.reasons.every(reason => typeof reason.code === 'string'), where);
      } else {
        assert.equal(projected.status, 'ready', where);
        assert.deepEqual(projected.reasons, [], where);
        const contract = projected.contract;
        contracts.push(contract);
        assert.equal(contract.version, 1, where);
        assert.equal(contract.scope, form.scope, where);
        assert.equal(contract.id, form.id, where);
        assert.equal(contract.variant, choice.index, where);
        assert.deepEqual(contract.counts, counts, where);
        assert.ok(contract.sections.length > 0, where);
        named++;
        assert.deepEqual(contract.sections.map(s => s.role), realization.sections.map(s =>
          s.role.replaceAll('-', '_')), where);
        const expectedLengths = [];
        function collect(node) {
          if (node.unit === 'section') {
            expectedLengths.push(node.children.length ? node.span.lines[1] - node.span.lines[0] : null);
          }
          node.children.forEach(collect);
        }
        realization.tree.forEach(collect);
        assert.deepEqual(contract.sections.map(s => s.lines), expectedLengths, where);
        assert.deepEqual(contract.rhymeGroups, [], where);
        assert.deepEqual(contract.returnGroups, [], where);
      }
    }
    classified.add(form.id);
  }
  assert.equal(classified.size, catalog.length);
  assert.ok(named > 0 && refused > 0);
  // A contract advertised by the interface must actually build in the native
  // planner at these counts. Seed feasibility is independent of form support.
  const python = [
    'import json, sys',
    'from quality import plan',
    'for contract in json.load(sys.stdin):',
    '    for seed in range(1, 33):',
    '        try:',
    '            result = plan.make_plan(seed, song_form=contract)',
    '        except plan.SeedRefused:',
    '            continue',
    '        assert result["request"]["song_form"] == contract',
    '        assert [s["function"] for s in result["sections"]] == [s["role"] for s in contract["sections"]]',
    '        break',
    '    else:',
    '        raise AssertionError((contract["id"], contract["variant"], contract["counts"]))',
  ].join('\n');
  const native = spawnSync('python3', ['-B', '-c', python], {
    cwd: fileURLToPath(new URL('../lyric-harness/', import.meta.url)),
    input: JSON.stringify(contracts), encoding: 'utf8',
  });
  assert.equal(native.status, 0, native.error?.message || native.stderr);

});

test('counted stanzas and prescribed line identities refuse the native creation path', () => {
  for (const fields of [{}, { rhyme: 'a' }, { returns: 'r' }]) {
    const result = projection(entry(poem(stanza(line(fields), line(fields)))), 'f');
    assert.equal(result.status, 'unsupported');
    assert.equal(result.contract, null);
  }
});

test('named role order keeps free lengths separate from caller-selected lengths', () => {
  const forms = entry(make('song', { children: [make('cycle', {
    times: [2, 4], children: [make('section', { role: 'verse' }),
      make('section', { role: 'prechorus', children: [line({ times: [2, 4] })] }),
      make('section', { role: 'chorus' })],
  })] }));
  assert.equal(projection(forms, 'f').status, 'needs-input');
  const counts = { '1.1': 2, '1.1.2.1': 3 };
  const chosen = projection(forms, 'f', { counts });
  assert.deepEqual(chosen.contract.sections.map(({ role, lines }) => [role, lines]),
    [['verse', null], ['prechorus', 3], ['chorus', null], ['verse', null], ['prechorus', 3], ['chorus', null]]);
  assert.deepEqual(chosen.contract.counts, counts);
  const divergent = projection(forms, 'f', { counts: { ...counts, '1[1].1[2].2[1].1': 4 } });
  assert.equal(divergent.status, 'unsupported');
  assert.ok(divergent.reasons.some(r => r.code === 'inconsistent-recurring-section-length'));
});

test('no contract escapes when a selected obligation cannot be enforced by the native writer', () => {
  const rejected = [
    stanza(line({ endWord:'a' }), line({ endWord:'a' })),
    ...['stress', 'syllables', 'stresses', 'bars', 'role'].map((key, i) =>
      stanza(line({ [key]: ['./', 2, 1, 1, 'answer'][i] }))),
    stanza(line({ children: [make('word', { times: 2 })] })),
    stanza(...numbered(4, i => line({ rhyme: i % 2 ? 'B' : 'A' }))),
    stanza(line({ rhyme:'A' }), line()), stanza(line({ returns:'r' }), line()),
    make('simultaneous', { children: [stanza(line()), stanza(line())] }),
    make('staggered-voices', { children: [stanza(line()), stanza(line())] }),
    make('section', { role:'unmapped' }),
    make('section', { role:'burden' }),
    poem(stanza(line(), line()), make('section', { role:'verse' })),
    poem(stanza(line(), line()), stanza(line(), line(), line())),
    poem(make('section', { role:'verse', children: [line({ returns:'r', times:2 })] })),
  ];
  for (const root of rejected) {
    const result = projection(entry(root), 'f');
    assert.equal(result.status, 'unsupported', JSON.stringify(root));
    assert.ok(result.reasons.length);
    assert.equal(result.contract, null);
  }
});

test('create CLI returns the same contract for positional and request-body selections', () => {
  const script = fileURLToPath(new URL('../scripts/song_forms.mjs', import.meta.url));
  const run = (args, input) => spawnSync(process.execPath, [script, ...args], {
    input: JSON.stringify(input), encoding: 'utf8',
  });
  const options = { variant: 0, counts: { '1.2': 1 } };
  const expected = projection(catalog, 'chorus-first', options);
  assert.equal(expected.status, 'ready');
  for (const [args, input] of [
    [['create', 'chorus-first'], options],
    [['create'], { id: 'chorus-first', ...options }],
    [[], { command: 'create', id: 'chorus-first', ...options }],
  ]) {
    const result = run(args, input);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), expected);
  }
  for (const [id, status] of [['couplet','needs-input'], ['free-verse','deferred'], ['heroic-couplet','unsupported']]) {
    const result = run(['create', id], {});
    assert.equal(result.status, 3);
    assert.equal(JSON.parse(result.stdout).status, status);
    assert.equal(JSON.parse(result.stdout).contract, null);
  }
  assert.equal(run(['create', 'couplet'], {variant: 1, lines: []}).status, 2);
});
