import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describeForm, realizeForm } from '../src/song-forms.mjs';
import { gradeObservations } from '../src/song-form-grade.mjs';
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

test('stepped printing is bounded by native physical slots and leaves undeclared features open', () => {
  const create = n => projection(catalog, 'triadic-line', { counts: {'1.1': n} });
  assert.equal(projection(catalog, 'triadic-line').status, 'needs-input');
  assert.deepEqual(create(1).contract.printedSteps, [3]);
  const maximum = Math.floor(CREATION_LIMITS.maxLines / 3);
  assert.equal(create(maximum).contract.sections[0].lines, maximum * 3);
  assert.equal(create(maximum + 1).reasons[0].code, 'native-line-limit');
  const altered = entry(poem(make('line', {children: [make('segment', {role:'indent-step'}),
    make('segment', {role:'indent-step', syllables: 2})]})));
  assert.equal(projection(altered, 'f').status, 'unsupported');
});

test('a named catalog role retains its spelling on a native verse carrier', () => {
  const {contract} = projection(catalog, 'heroic-crown', {variant:0});
  const last = contract.sections.at(-1);
  assert.deepEqual([last.role, last.sourceRole], ['verse', 'master-sonnet']);
});

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
      let realization = realizeForm(catalog, form.id, options);
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
        if (contract.phraseLines) {
          // Derive the expected carrier independently from the original phrase data.
          const root = realization.tree[0];
          const spans = root.unit === 'verse-unit' ? [root] : root.children;
          const stanzas = spans.map(span => stanza(...span.children.map(({unit, rhyme, syllables}) => {
            assert.equal(unit, 'phrase', where);
            return {unit:'line', rhyme, syllables};
          })));
          realization = realizeForm(entry(poem(...stanzas)), 'f');
        }
        if (contract.printedParagraphs) {
          const paragraphs = realization.tree[0].children;
          assert.ok(paragraphs.every(node => node.unit === 'paragraph' && !node.children.length), where);
          assert.equal(contract.printedParagraphs, paragraphs.length, where);
          assert.deepEqual(contract.sections, [{unit:'section',role:'verse',lines:paragraphs.length}], where);
        } else if (contract.printedSteps) {
          const sizes = realization.tree[0].children.map(node => {
            assert.equal(node.unit, 'line', where);
            assert.ok(node.children.every(child => child.unit === 'segment' && child.role === 'indent-step'), where);
            return node.children.length;
          });
          assert.deepEqual(contract.printedSteps, sizes, where);
          assert.deepEqual(contract.sections, [{ unit:'section', role:'verse', lines:sizes.reduce((n,c) => n+c, 0) }], where);
        } else if (contract.spokenClose) {
          assert.equal(realization.lines.at(-1).role, 'spoken-close');
          assert.equal(contract.sections[0].lines, realization.lines.length);
          assert.deepEqual(contract.rhymeGroups, realization.lines[0].rhyme ? [[1,2]] : []);
        } else if (contract.imitationRepeats) {
          const voices = realization.tree[0].children;
          assert.equal(realization.tree[0].unit, 'staggered-voices');
          assert.deepEqual(contract.imitationRepeats, voices.map(v => v.children.length || 1));
          assert.deepEqual(contract.sections, [{unit:'section', role:'verse', lines:null}]);
        } else if (projected.nestedRefrain) {
          const song=realization.tree[0], refrain=song.children.at(-1);
          const intro=song.children.length===2;
          const leaves=[...(intro?[song.children[0]]:[]),...refrain.children];
          assert.deepEqual(contract.sections.map(p=>p.sourceRole),leaves.map(p=>p.role),where);
          assert.equal(contract.sections.slice(intro?1:0).reduce((n,s)=>n+s.bars,0),refrain.bars,where);
          contract.sections.forEach((s,i)=>assert.deepEqual(s.divisionPath.map(p=>p.address),
            [...(intro && i===0?[song]:[song,refrain]),leaves[i]].map(p=>p.address),where));
        } else if (projected.nestedDivisions) {
          const nodes = new Map();
          function index(node) {
            nodes.set(node.address, node);
            node.children.forEach(index);
          }
          realization.tree.forEach(index);
          for (const part of contract.sections) {
            assert.ok(part.divisionPath.length, where);
            for (const mark of part.divisionPath) {
              const original = nodes.get(mark.address);
              assert.equal(mark.unit, original.unit, where);
              assert.equal(mark.role, original.role, where);
            }
          }
        } else if (['caesural-rhyme', 'alliterative-long-line'].includes(contract.lineProfile)) {
          assert.equal(realization.tree.length, 1);
          assert.deepEqual(realization.tree[0].children.map(n => n.unit), ['half-line', 'caesura', 'half-line']);
          assert.deepEqual(contract.sections, [{unit:'section',role:'verse',lines:null}]);
          if (contract.lineProfile === 'alliterative-long-line') {
            assert.deepEqual(realization.tree[0].children.map(n => n.stresses), [2,undefined,2]);
            assert.ok(realization.tree[0].children.every(n => !n.children.length));
          }
        } else if (projected.arrangement) {
          arranged++;
          assert.equal(realization.coverage.lines, 'complete', where);
          assert.equal(projected.arrangement.role, 'verse', where);
          assert.ok(realization.sections.every((section) => section.role === undefined), where);
          assert.equal(realization.sections.length, projected.arrangement.divisions.filter((part) => part.unit === 'section').length, where);
          assert.deepEqual(contract.sections.map((p) => p.role), contract.sections.map(() => 'verse'), where);
          const source = [];
          const collect = (node) => {
            if (contract.openRhymeLines && node === realization.tree[0]) {
              const prefix = node.children.slice(0, -1);
              assert.ok(prefix.every(n => n.unit === 'line'), where);
              source.push({ unit: 'opening-lines', lines: prefix.length });
              collect(node.children.at(-1));
            } else if (node.unit === 'line') {
              source.push({ unit: 'line', lines: 1 });
            } else if (node.children.length && node.children.every((c) => c.unit === 'line')) {
              source.push({ unit:node.unit, lines:node.children.length });
            } else node.children.forEach(collect);
          };
          realization.tree.forEach(collect);
          assert.deepEqual(projected.arrangement.divisions, source, where);
          assert.deepEqual(contract.sections.map((p) => p.lines), source.map((p) => p.lines), where);
        } else {
          named++;
          assert.deepEqual(contract.sections.map(s => s.sourceRole ?? s.role),
            realization.sections.map((s, i) => contract.sections[i]?.sourceRole !== undefined
              ? s.role : s.role.replaceAll('-', '_')), where);
          const expectedLengths = [];
          function collect(node) {
            if (node.unit === 'section') {
              expectedLengths.push(node.children.length ? node.span.lines[1] - node.span.lines[0] : null);
            }
            node.children.forEach(collect);
          }
          realization.tree.forEach(collect);
          if (realization.tree[0].unit === 'stanza' && realization.sections[0]?.role === 'stollen') {
            const [first,second,last] = contract.sections.map(s => s.lines);
            assert.ok(first > 0 && first === second && last > first, where);
          } else assert.deepEqual(contract.sections.map(s => s.lines), expectedLengths, where);
        }
        const sourceBars = [];
        function collectBars(node) {
          if (node.bars !== undefined) sourceBars.push(node.bars);
          node.children.forEach(collectBars);
        }
        realization.tree.forEach(collectBars);
        const chosenBars = contract.sections.filter(part => part.bars !== undefined).map(part => part.bars);
        if (projected.nestedRefrain) {
          assert.equal(chosenBars.reduce((n,bars)=>n+bars,0),realization.tree[0].children.at(-1).bars,where);
        } else if (realization.tree[0].unit === 'song' && realization.tree[0].bars !== undefined) {
          assert.equal(chosenBars.length, realization.sections.length, where);
          assert.equal(chosenBars.reduce((n,bars)=>n+bars,0), realization.tree[0].bars, where);
          realization.sections.forEach((section,i) => {
            if(section.bars !== undefined) assert.equal(chosenBars[i],section.bars,where);
          });
        } else assert.deepEqual(chosenBars, sourceBars, where);
        const sourceMeasures = [];
        const inspectLine = (node) => {
          if (node.unit === 'line') {
            const position = realization.lines.find((l) => l.address === node.address).index;
            const measures = {line:position};
            if (node.role === 'short-line') {
              assert.equal(realization.lines[position-2].role, 'long-line', where);
              measures.shorterThan = position-1;
            }
            if (node.syllables !== undefined) measures.syllables = node.syllables;
            if (node.stress !== undefined) {
              measures.syllables = node.stress.length;
              measures.stress = node.stress;
            }
            if (node.stresses !== undefined) measures.stresses = node.stresses;
            if (projected.arrangement?.scansion === 'regular-anapestic-feet') {
              assert.equal(form.id, 'limerick', where);
              assert.equal(node.stresses, [3,3,2,2,3][position-1], where);
              measures.stress = '../'.repeat(node.stresses);
              measures.syllables = measures.stress.length;
            }
            if (node.role === 'alexandrine') {
              measures.stress = './'.repeat(6);
              measures.syllables = measures.stress.length;
            }
            const ending = {'stressed-ending':'/', 'unstressed-ending':'.', 'masculine-ending':'/', 'feminine-ending':'/.'}[node.role];
            if (ending && node.stress === undefined) measures.stressEnding = ending;
            if (node.children.length && node.children.every(child => child.unit === 'syllable')) {
              measures.syllables = node.children.length;
            } else if (contract.closingChord && node.role === 'closing-line') {
              assert.deepEqual(node.children.map(child => child.unit), ['held-note'], where);
              assert.equal(position, realization.lines.length, where);
            } else if (contract.lineProfile === 'single-phrase-lines') {
              assert.deepEqual(node.children.map(child=>child.unit), ['phrase'], where);
              assert.equal(node.children[0].children.length, 0, where);
            } else if (node.children.length && !contract.printedSteps && contract.lineProfile !== 'alliterative-long-line') {
              assert.ok(node.children.every((child) => child.unit === 'word'), where);
              measures.words = node.children.length;
              if (node.children.some(word => word.children.length))
                measures.wordLetters = node.children.map(word => word.children.length || null);
            }
            if (Object.keys(measures).length > 1) sourceMeasures.push(measures);
          } else node.children.forEach(inspectLine);
        };
        realization.tree.forEach(inspectLine);
        assert.deepEqual(contract.lineRequirements || [], sourceMeasures, where);
        const marked = realization.lines.filter(line => line.rhyme !== undefined);
        if (marked.length) {
          assert.ok(marked.length >= 2, where);
          assert.deepEqual(realization.lines.filter(line => line.rhyme === undefined).map(line => line.index),
            contract.openRhymeLines ?? [], where);
          assert.ok(contract.rhymeGroups.some(group => group.length >= 2), where);
        }
        assert.deepEqual(contract.rhymeGroups, [...new Set(marked.map(line => line.rhyme))].map(label => marked.filter(line => line.rhyme === label).map(line => line.index)), where);
        const repeated = realization.lines.filter(line => line.returns !== undefined);
        assert.deepEqual(contract.returnGroups, [...new Set(repeated.map(line => line.returns))].map(
          label => repeated.filter(line => line.returns === label).map(line => line.index)), where);
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

test('a prescribed terminal pair is distinct from line and word identity', () => {
  const rhymed = projection(entry(poem(stanza(line({rhyme:'z'}),line({rhyme:'z'})))), 'f');
  assert.deepEqual(rhymed.contract.rhymeGroups, [[1,2]]);
  for (const fields of [{ endWord: 'a' }, { returns: 'r' }]) {
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
  assert.deepEqual(projection(catalog, 'couplet', {variant:1}).contract.rhymeGroups, [[1,2]]);
  assert.equal(projection(catalog, 'monostich').status, 'unsupported');
  assert.deepEqual(projection(catalog, 'cherita').arrangement.divisions.map((part) => part.lines), [1, 2, 3]);
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
    stanza(...['A','B','C','D'].map(rhyme => line({rhyme}))),
    stanza(line({ rhyme:'A' }), line()), stanza(line({ returns:'r' }), line()),
    make('simultaneous', { children: [stanza(line()), stanza(line())] }),
    make('staggered-voices', { children: [stanza(line()), stanza(line())] }),
    make('section', { role:'unmapped' }),
    make('section', { role:'burden' }),
    poem(stanza(line(), line()), make('section', { role:'verse' })),
    poem(make('section', {role:'chorus', children:[line(), line()]}),
      make('section', {role:'chorus', children:[line(), line(), line()]})),
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
  for (const [id, status] of [['couplet','needs-input'], ['free-verse','deferred'], ['monostich','unsupported']]) {
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

test('letter selections retain word order and refuse features on an individual letter', () => {
  const word = children => make('word', { children });
  const makeForm = last => entry(stanza(line({times:2, children:[
    word([make('letter', {times:2})]), make('word'), word([last]),
  ]})));
  const result = projection(makeForm(make('letter')), 'f');
  assert.deepEqual(result.contract.lineRequirements, [1,2].map(line=>({line,words:3,wordLetters:[2,null,1]})));
  assert.equal(projection(makeForm(make('letter',{role:'initial'})), 'f').contract,null);
});

test('the writer preserves selected syllable leaves and lexical ending measurements', () => {
  const simple = entry(stanza(line({role:'stressed-ending',children:[make('syllable',{times:3})]}),line({role:'unstressed-ending'})));
  const projected = projection(simple,'f');
  assert.deepEqual(projected.contract.lineRequirements,[{line:1,syllables:3,stressEnding:'/'},{line:2,stressEnding:'.'}]);
  for (const child of [
    line({role:'narrative'}),line({role:'feminine-ending',stress:'./'}),
    line({syllables:4,children:[make('syllable',{times:3})]}),line({children:[make('syllable',{role:'stressed'})]}),
    line({stresses:4,children:[make('syllable',{times:3})]}),
  ]) assert.equal(projection(entry(stanza(child,line())), 'f').status,'unsupported');
});

test('unmeasured subject matter, morae, line length and bardic closure retain explicit refusals', () => {
  for (const [id, variant, counts, code] of [
    ['senryu', 1, { '1.1.1': 3 }, 'unmeasured-subject-matter'],
    ['haiku', 1, { '1.1.1': 3 }, 'unmeasured-imagistic-cut'],
    ['senryu', 0, {}, 'unmeasured-mora-count'],
    ['tanka', 0, {}, 'unmeasured-mora-count'],
    ['irish-syllabic-quatrains', 0, {}, 'unmeasured-bardic-correspondences'],
    ['irish-syllabic-quatrains', 3, {}, 'unmeasured-bardic-closure'],
  ]) {
    const result = projection(catalog, id, { variant, counts });
    assert.equal(result.status, 'unsupported', id);
    assert.ok(result.reasons.some(row => row.code === code), id);
    assert.equal(result.contract, null);
  }
});

test('a join cannot establish its component songs even when no theme returns', () => {
  for (const joins of [1, 2]) {
    for (const [id, counts, reason] of [
      ['medley', {'1.2': joins}, 'source-song-identity-required'],
      ['multi-part-suite', {'1.2': joins, '1.3': 0}, 'independent-movement-form-required'],
    ]) {
      const result = projection(catalog, id, {counts});
      assert.equal(result.status, 'unsupported');
      assert.equal(result.contract, null);
      assert.ok(result.reasons.some(row => row.code === reason && row.path === '1.1'));
    }
  }
});


test('linked couplets measure each cross-boundary echo and the closing wrap in sung tokens', () => {
  const id = 'duplex';
  const counts = Object.fromEntries(describeForm(catalog, id).variants[0].counts.map(({path})=>[path,9]));
  const {contract} = projection(catalog,id,{counts});
  assert.equal(contract.lineProfile, 'linked-couplet-echoes');
  assert.deepEqual(contract.sections.map(section=>section.lines), Array(7).fill(2));
  assert.deepEqual(contract.lineRequirements.map(row=>row.syllables), Array(14).fill(9));
  const sections = numbered(7, i=>({role:'verse',lineSpan:[2*i,2*i+2]}));
  const line = (x) => ({text:x, sungWords:x.split(' '), syllables:9});
  const a = 'one two three four five six ten eight nine';
  const b = 'one two three four five six twelve eight nine';
  const lines = numbered(14, i=>line(i === 13 || i%2 ? a : b));
  lines[0] = line(a);
  const read = () => gradeObservations(catalog, id, {counts, lines, sections});
  const yes=read();
  assert.equal(yes.verdict,'pass',JSON.stringify(yes.checks.filter(c=>c.outcome!=='pass')));
  assert.deepEqual(yes.checks.filter(c=>c.kind==='role').map(c=>c.comparedLines), [
    [1,14],[2,3],[2,3],[4,5],[4,5],[6,7],[6,7],[8,9],[8,9],[10,11],[10,11],[12,13],[12,13],[1,14]]);
  lines[2] = {...line('ten ten ten ten ten ten ten ten ten'),role:'echo-of-previous-close'};
  assert.equal(read().verdict,'unknown');
  lines[2] = {...line(b),sungWords:null};
  assert.equal(read().verdict,'unknown');
  lines[2] = {...line(b),syllables:8};
  assert.equal(read().verdict,'fail');
});

test('English tanka measures a bounded English reading independently of Japanese morae', () => {
  const form = 'tanka';
  assert.equal(projection(catalog,form,{variant:1}).contract.lineProfile,'english-short-long-five');
  assert.equal(projection(catalog,form,{variant:0}).status,'unsupported');
  const read = counts => gradeObservations(catalog,form,{variant:1, lines:counts.map(n=>({text:'one',syllables:n})),
    sections:[{role:'verse',lineSpan:[0,5]}]});
  assert.equal(read([2,4,3,5,6]).verdict,'pass');
  assert.equal(read([5,7,5,7,7]).verdict,'pass');
  assert.equal(read([5,8,5,7,7]).verdict,'unknown');
  assert.equal(read([2,4,5,5,6]).verdict,'unknown');
});
