import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describeForm, realizeForm } from '../src/song-forms.mjs';
import { CREATION_LIMITS, projectSongFormCreation } from '../src/song-form-creation.mjs';

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
  let named = 0, arranged = 0, refused = 0;
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
        if (projected.arrangement) {
          arranged++;
          assert.equal(realization.coverage.lines, 'complete', where);
          assert.equal(projected.arrangement.role, 'verse', where);
          assert.equal(realization.sections.length, 0, where);
          assert.deepEqual(contract.sections.map((p) => p.role), contract.sections.map(() => 'verse'), where);
          const source = [];
          const collect = (node) => {
            if (node.children.length && node.children.every((c) => c.unit === 'line')) {
              source.push({ unit:node.unit, lines:node.children.length });
            } else node.children.forEach(collect);
          };
          realization.tree.forEach(collect);
          assert.deepEqual(projected.arrangement.divisions, source, where);
          assert.deepEqual(contract.sections.map((p) => p.lines), source.map((p) => p.lines), where);
        } else {
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
        }
        const sourceBars = [];
        function collectBars(node) {
          if (node.bars !== undefined) sourceBars.push(node.bars);
          node.children.forEach(collectBars);
        }
        realization.tree.forEach(collectBars);
        assert.deepEqual(contract.sections.filter((part) => part.bars !== undefined).map((part) => part.bars), sourceBars, where);
        const sourceMeasures = [];
        const inspectLine = (node) => {
          if (node.unit === 'line') {
            const position = realization.lines.find((l) => l.address === node.address).index;
            const measures = {line:position};
            if (node.syllables !== undefined) measures.syllables = node.syllables;
            if (node.stress !== undefined) {
              measures.syllables = node.stress.length;
              measures.stress = node.stress;
            }
            if (node.stresses !== undefined) measures.stresses = node.stresses;
            if (node.children.length) {
              assert.ok(node.children.every((child) => child.unit === 'word'), where);
              measures.words = node.children.length;
            }
            if (Object.keys(measures).length > 1) sourceMeasures.push(measures);
          } else node.children.forEach(inspectLine);
        };
        realization.tree.forEach(inspectLine);
        assert.deepEqual(contract.lineRequirements || [], sourceMeasures, where);
        assert.deepEqual(contract.rhymeGroups, [], where);
        assert.deepEqual(contract.returnGroups, [], where);
      }
    }
    classified.add(form.id);
  }
  assert.equal(classified.size, catalog.length);
  assert.ok(named > 0 && arranged > 0 && refused > 0);
  // A contract advertised by the interface must actually build in the native
  // planner at these counts. Seed feasibility is independent of form support.
  const python = [
    'import json, sys',
    'from quality import plan',
    'from quality.catalog_shape import line_fit_conflicts',
    'inputs = json.load(sys.stdin)',
    'limits = inputs["limits"]',
    'assert (limits["minLines"], limits["maxLines"]) == plan.ENVELOPE["total_lines"]',
    'assert limits["maxSections"] == plan.ENVELOPE["sections"][1]',
    'for contract in inputs["contracts"]:',
    '    for seed in range(1, 33):',
    '        try:',
    '            result = plan.make_plan(seed, song_form=contract)',
    '        except plan.SeedRefused:',
    '            continue',
    '        assert result["request"]["song_form"] == contract',
    '        assert all(s["bars"] == p["bars"] for s, p in zip(result["sections"], contract["sections"]) if "bars" in p)',
    '        assert not line_fit_conflicts(result, contract.get("lineRequirements", []))',
    '        assert [s["function"] for s in result["sections"]] == [s["role"] for s in contract["sections"]]',
    '        assert all(sum(slot["section"] == s["name"] for slot in result["line_slots"]) == p["lines"] for s, p in zip(result["sections"], contract["sections"]) if p["lines"] is not None)',
    '        break',
    '    else:',
    '        raise AssertionError((contract["id"], contract["variant"], contract["counts"]))',
  ].join('\n');
  const native = spawnSync('python3', ['-B', '-c', python], {
    cwd: fileURLToPath(new URL('../lyric-harness/', import.meta.url)),
    input: JSON.stringify({contracts, limits:CREATION_LIMITS}), encoding: 'utf8',
  });
  assert.equal(native.status, 0, native.error?.message || native.stderr);

});

test('prescribed line identities refuse the native creation path', () => {
  for (const fields of [{ rhyme: 'a' }, { returns: 'r' }]) {
    const result = projection(entry(poem(stanza(line(fields), line(fields)))), 'f');
    assert.equal(result.status, 'unsupported');
    assert.equal(result.contract, null);
  }
});

test('equal contiguous plain divisions use a disclosed verse arrangement and keep every boundary', () => {
  const choices = entry(poem(stanza(line({ times: 3 })), make('tercet', {children: [line({ times: 3 })]})));
  const result = projection(choices, 'f');
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.arrangement, {role:'verse',divisions:[{unit:'stanza',lines:3},{unit:'tercet',lines:3}]});
  assert.deepEqual(result.contract.sections, numbered(2, () => ({unit:'section',role:'verse',lines:3})));
  assert.deepEqual(result.contract.rhymeGroups, []);
  assert.deepEqual(result.contract.returnGroups, []);
  assert.equal(projection(catalog, 'couplet', {variant:0}).status, 'ready');
  assert.equal(projection(catalog, 'couplet', {variant:1}).status, 'unsupported');
  assert.equal(projection(catalog, 'monostich').status, 'unsupported');
  assert.equal(projection(catalog, 'cherita').status, 'unsupported');
  assert.equal(projection(entry(poem(stanza(line({times:464})))), 'f').status, 'unsupported');
  assert.equal(projection(entry(poem(make('stanza',{times:116,children:[line({times:2})]}))), 'f').status, 'unsupported');
  assert.equal(projection(entry(poem(stanza(line()),stanza(line()))), 'f').status, 'unsupported');
});

test('exact section bars carry through without assigning musical roles to unnamed sections', () => {
  const section = (role, bars, count) => make('section', {role, bars, ...(count && {children:[line({times:count})]})});
  const forms = entry(make('song', {children:[
    section('intro', 4), section('verse', 16, 4), section('solo', 8), section('outro', 4),
  ]}));
  const result = projection(forms, 'f');
  assert.deepEqual(result.contract.sections.map((s) => [s.role,s.bars,s.lines]),[
    ['intro',4,null],['verse',16,4],['solo',8,null],['outro',4,null],
  ]);
  const measured = projection(catalog, '16-bar-blues', {variant:1});
  assert.deepEqual(measured.contract.sections, [{unit:'section',role:'verse',lines:4,bars:16}]);
  assert.ok(measured.arrangement);
  // A caller-supplied meter may exceed the ordinary random draw's range.
  const explicitMelody = projection(entry(section('verse',202,2)), 'f');
  assert.deepEqual(explicitMelody.contract.sections, [{unit:'section',role:'verse',bars:202,lines:2}]);
  for (const rejected of [
    make('song', {bars:8,children:[section('verse', 8)]}),
    section('part-a', 8), section('verse', 3, 2), section('solo', 8, 2),
    make('song',{children:[section('verse',8),section('verse',16)]}),
    make('song',{children:[section('verse',6,2),section('chorus',4)]}),
    make('song',{children:[section('verse',6,2),section('solo',4)]}),
  ]) assert.equal(projection(entry(rejected), 'f').status, 'unsupported');
});

test('numbered observations reflect only the attributes declared for the corresponding line', () => {
  const forms = entry(poem(stanza(line({ syllables: 4 }), line(), line({ children: [make('word', {times:3})] }))));
  assert.deepEqual(projection(forms, 'f').contract.lineRequirements, [{line:1,syllables:4},{line:3,words:3}]);
  const named = entry(make('song', {children: [make('section', {role:'verse'}), make('section', {role:'chorus',children:[line({syllables:4})]})]}));
  assert.equal(projection(named, 'f').status, 'unsupported', 'preceding open section makes the absolute line ambiguous');
  const tail = entry(make('song', {children: [make('section', {role:'verse',children:[line({syllables:4})]}),make('section', {role:'chorus'})]}));
  assert.equal(projection(tail, 'f').status, 'unsupported', 'numeric planning requires the complete partition');
  const impossible = entry(poem(line({ syllables:2,children:[make('word',{times:3})]}),line()));
  assert.equal(projection(impossible, 'f').status, 'unsupported');
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
    ...['stress', 'stresses', 'bars', 'role'].map((key, i) =>
      stanza(line({ [key]: ['./', 1, 1, 'answer'][i] }))),
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

test('a paired stanza projects its ordered inner divisions and preserves outer obligations', () => {
  const inner = make('quatrain', { children: [line({ syllables: 7, times: 4 })] });
  const pair = stanza(inner, inner);
  const result = projection(entry(pair), 'f');
  assert.deepEqual(result.arrangement.divisions, Array(2).fill({ unit: 'quatrain', lines: 4 }));
  assert.deepEqual(result.contract.lineRequirements, numbered(8, i => ({ line: i + 1, syllables: 7 })));
  for (const root of [
    { ...pair, bars: 12 }, { ...pair, role: 'a' },
    make('double-stanza', { children: [stanza(line(), line())] }),
    make('double-stanza', { children: [inner, inner] }),
    stanza(inner, stanza(line({rhyme: 'A'}), line({rhyme: 'A'}))),
  ]) assert.equal(projection(entry(root), 'f').contract, null);
});
