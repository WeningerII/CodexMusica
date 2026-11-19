import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describeForm, realizeForm } from '../src/song-forms.mjs';
import { gradeObservations } from '../src/song-form-grade.mjs';
import { CREATION_LIMITS, projectSongFormCreation } from '../src/song-form-creation.mjs';
import { _formInternals, automaticFormCandidates, prepareFormReview } from '../mcp/lyric_form.js';
import { catalogSelection } from '../mcp/lyric_workflow.js';

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
  // ~~One named form, its last section~~ (#902): that form is past the
  // owner's 150-line cap and is refused. Every ready setting is read
  // instead: a section carried as a native verse keeps the catalog role's
  // own spelling as its sourceRole, hyphens included.
  let kept = 0;
  for (const form of catalog) {
    for (const choice of describeForm(catalog, form.id).variants) {
      const counts = Object.fromEntries(choice.counts.map(({ path, min, max }) =>
        [path, Math.min(min + 1, max ?? Infinity)]));
      const realization = realizeForm(catalog, form.id, { variant: choice.index, counts });
      const projected = projectSongFormCreation(realization, counts);
      if (projected.status !== 'ready') continue;
      const roles = new Set();
      const collect = (node) => {
        if (node.role !== undefined) roles.add(node.role);
        node.children.forEach(collect);
      };
      realization.tree.forEach(collect);
      projected.contract.sections.forEach((part, i) => {
        if (part.sourceRole === undefined || part.role !== 'verse') return;
        assert.ok(roles.has(part.sourceRole), `${form.id}/${choice.index}/${i}: ${part.sourceRole}`);
        if (part.sourceRole.includes('-')) kept++;
      });
    }
  }
  assert.ok(kept > 0);
});

test('no ready contract fixes more lines than the cap, and a form past it is refused by name', () => {
  // #902: the owner's 150-line cap holds every form shape. A form of fixed
  // named sections was not checked, so one past the cap was advertised as
  // ready and the planner refused it.
  let over = 0;
  for (const form of catalog) {
    for (const choice of describeForm(catalog, form.id).variants) {
      const counts = Object.fromEntries(choice.counts.map(({ path, min, max }) =>
        [path, Math.min(min + 1, max ?? Infinity)]));
      const projected = projectSongFormCreation(
        realizeForm(catalog, form.id, { variant: choice.index, counts }), counts);
      const where = form.id + '/' + choice.index;
      if (projected.status === 'ready') {
        const fixed = projected.contract.sections.reduce((n, part) => n + (part.lines ?? 1), 0);
        assert.ok(fixed <= CREATION_LIMITS.maxLines, `${where}: ${fixed} lines`);
      } else if (projected.reasons?.some((reason) => reason.code === 'native-line-limit')) {
        over++;
      }
    }
  }
  assert.ok(over > 0);
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

// THE AUTOMATIC DRAW (#902). Rows are chosen from the catalog by property; no
// form is named. The first call below builds the draw's table cold.
let coldDraw;
const automaticDraw = () => (coldDraw ??= (async () => {
  const start = performance.now();
  const settings = await automaticFormCandidates({ lines: null });
  return { settings, ms: performance.now() - start };
})());
const knownTotal = (contract) => contract.sections.reduce((n, section) => n + (section.lines ?? 0), 0);
const openTotal = (contract) => contract.sections.some((section) => section.lines === null);
const insideLimits = (contract) =>
  contract.sections.length <= CREATION_LIMITS.maxSections &&
  knownTotal(contract) <= CREATION_LIMITS.maxLines &&
  (openTotal(contract) || knownTotal(contract) >= CREATION_LIMITS.minLines);
// A contract the automatic draw may offer for these counts, or null.
function drawable(id, variant, counts) {
  let result;
  try {
    result = projection(catalog, id, { variant, counts });
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
  const contract = result.status === 'ready' ? result.contract : null;
  return contract && !contract.sections.some((section) => section.textualFunction) && insideLimits(contract)
    ? contract
    : null;
}
// Every variant with count paths whose every path at its minimum is drawable.
const floorRows = () => catalog.flatMap((form) =>
  describeForm(catalog, form.id).variants
    .filter(({ counts }) => counts.length)
    .map(({ index, counts }) => ({
      id: form.id, variant: index, paths: counts,
      floor: Object.fromEntries(counts.map(({ path, min }) => [path, min])),
    }))
    .filter((row) => drawable(row.id, row.variant, row.floor)));
const offeredOf = (settings, { id, variant }) =>
  settings.filter((contract) => contract.id === id && contract.variant === variant);

test('the automatic draw takes an unbounded repeat past min+2, and at a length it fits', async () => {
  const { settings } = await automaticDraw();
  const rows = floorRows().flatMap((row) => row.paths
    .filter(({ max }) => max === null)
    .map(({ path, min }) => ({ ...row, path, min, value: Math.max(min + 3, 5) }))
    .filter((r) => drawable(r.id, r.variant, { ...r.floor, [r.path]: r.value })));
  assert.ok(rows.length, 'some unbounded path is drawable at min+3 and at 5 or more');
  const fixed = [];
  for (const row of rows) {
    const past = offeredOf(settings, row).filter((contract) => contract.counts[row.path] >= row.min + 3);
    assert.ok(past.length, JSON.stringify([row.id, row.variant, row.path]));
    fixed.push(...past.filter((contract) => !openTotal(contract)));
  }
  assert.ok(fixed.length, 'some setting past min+2 has a known total');
  for (const contract of fixed.filter((_, i) => i % 7 === 0)) {
    const lines = knownTotal(contract);
    const offered = await automaticFormCandidates({ lines });
    assert.ok(offered.some((other) => other.id === contract.id && other.variant === contract.variant &&
      JSON.stringify(other.counts) === JSON.stringify(contract.counts)), JSON.stringify([lines, contract.counts]));
  }
});

test('a stated length reaches the count vector whose known total it is', async () => {
  await automaticDraw();
  const rows = floorRows()
    .filter(({ paths }) => paths.length === 1)
    .filter(({ paths: [only] }) => only.max === null || only.max >= only.min + 3)
    .map((row) => {
      const [{ path, min }] = row.paths;
      const totals = [0, 1, 2, 3].map((offset) => drawable(row.id, row.variant, { [path]: min + offset }));
      return { ...row, totals };
    })
    .filter(({ totals }) => totals.every((contract) => contract && !openTotal(contract)) &&
      !totals.slice(0, 3).some((contract) => knownTotal(contract) === knownTotal(totals[3])));
  assert.ok(rows.length, 'some single-path variant has a fourth total the first three lack');
  for (const row of rows) {
    const lines = knownTotal(row.totals[3]);
    const offered = offeredOf(await automaticFormCandidates({ lines }), row);
    assert.ok(offered.some((contract) => knownTotal(contract) === lines && !openTotal(contract)),
      JSON.stringify([row.id, row.variant, lines]));
  }
});

// The contract an explicit catalog request (catalog_form, catalog_variant,
// catalog_counts) compiles for the selection an automatic sweep reports.
async function replayed(contract) {
  const { options, plan } = await prepareFormReview(catalogSelection({ song_form: contract }));
  return projectSongFormCreation(plan, options.counts);
}

test('count paths take values independently of one another, and replay exactly', async () => {
  const { settings } = await automaticDraw();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // From every path at its minimum, each path stepped alone by one.
  const rows = floorRows().map((row) => ({
    ...row,
    steps: row.paths
      .map(({ path, min }) => ({ ...row.floor, [path]: min + 1 }))
      .filter((counts) => drawable(row.id, row.variant, counts)),
  })).filter(({ steps }) => steps.length);
  assert.ok(rows.some(({ paths, steps }) => paths.length >= 3 && steps.length >= 2),
    'some variant of three or more paths steps two of them alone');
  for (const row of rows) {
    const offered = offeredOf(settings, row);
    for (const counts of row.steps) {
      const where = JSON.stringify([row.id, row.variant, counts]);
      const contract = offered.find((other) => same(other.counts, counts));
      assert.ok(contract, where);
      const again = await replayed(contract);
      assert.equal(again.status, 'ready', where);
      assert.deepEqual(again.contract, contract, where);
    }
  }
});

test('a variant of a vast count product is sampled, and its length search ends without enumerating it', async () => {
  const { settings } = await automaticDraw();
  const product = ({ paths }) => paths.reduce((n, { min, max }) => n * (max === null ? Infinity : max - min + 1), 1);
  const rows = floorRows().filter((row) => Number.isFinite(product(row)) && product(row) > 1e6);
  assert.ok(rows.length, 'some variant has more than a million bounded count vectors');
  let settled = 0;
  for (const row of rows) {
    const where = JSON.stringify([row.id, row.variant]);
    const offered = offeredOf(settings, row);
    assert.ok(offered.length <= 3 + 12 * row.paths.length, where);
    const distinct = (counts) => new Set(row.paths.map(({ path }) => counts[path])).size > 1;
    assert.ok(offered.some((contract) => JSON.stringify(contract.counts) === JSON.stringify(row.floor)), where);
    assert.ok(offered.some((contract) => distinct(contract.counts)), where);
    const totals = new Set(offered.filter((contract) => !openTotal(contract)).map(knownTotal));
    if (totals.size !== 1) continue;
    const [total] = totals;
    const outcome = async (lines) => {
      const drawn = await automaticFormCandidates({ lines });
      const entry = (await _formInternals.lengthSearch(lines)).find((v) => v.id === row.id && v.variant === row.variant);
      return { entry, offered: offeredOf(drawn, row) };
    };
    const held = await outcome(total);
    assert.equal(held.entry.outcome, 'kept', where);
    assert.equal(held.offered.length, offered.filter((contract) => knownTotal(contract) === total).length, where);
    const past = await outcome(total + 1);
    assert.equal(past.entry.outcome, 'infeasible', where);
    assert.ok(past.entry.counted <= 2 * row.paths.length && past.entry.projected === 0, JSON.stringify(past.entry));
    assert.equal(past.offered.length, 0, where);
    settled++;
  }
  assert.ok(settled, 'some such variant holds one known total across its settings');
  // An exhausted search is the one that spent its budget; an infeasible one
  // did not, and an outcome that found a setting offers it.
  for (const lines of [7, 30, 150, 300]) {
    const drawn = await automaticFormCandidates({ lines });
    const { budget } = _formInternals;
    const variants = await _formInternals.lengthSearch(lines);
    const known = new Set(['open', 'kept', 'found', 'infeasible', 'exhausted', 'unmodeled']);
    for (const entry of variants) {
      const where = JSON.stringify([lines, entry]);
      assert.ok(known.has(entry.outcome), where);
      const spent = entry.counted >= budget.counted || entry.projected >= budget.projected;
      if (entry.outcome === 'exhausted') assert.ok(spent, where);
      if (entry.outcome === 'infeasible') assert.ok(!spent, where);
      if (['found', 'kept'].includes(entry.outcome))
        assert.ok(offeredOf(drawn, entry).some((contract) => !openTotal(contract) && knownTotal(contract) === lines), where);
      if (['infeasible', 'exhausted'].includes(entry.outcome))
        assert.ok(!offeredOf(drawn, entry).some((contract) => !openTotal(contract)), where);
    }
  }
});

test('every offered setting replays ready inside the native limits, up to the last value inside them', async () => {
  const { settings } = await automaticDraw();
  const lengths = [2, 3, 4, 6, 8, 12, 16, 24, 30, 48, 64, 100, 200, CREATION_LIMITS.maxLines];
  const seen = new Map();
  for (const contract of [settings, ...await Promise.all(lengths.map((lines) => automaticFormCandidates({ lines })))].flat())
    seen.set(JSON.stringify([contract.id, contract.variant, contract.counts]), contract);
  for (const contract of seen.values()) {
    const where = JSON.stringify([contract.id, contract.variant, contract.counts]);
    const result = await replayed(contract);
    assert.equal(result.status, 'ready', where);
    assert.deepEqual(result.contract, contract, where);
    assert.ok(!contract.sections.some((section) => section.textualFunction), where);
    assert.ok(insideLimits(contract), where);
  }
  // A path whose sections or known lines grow by a fixed step reaches the
  // last value inside the limits, and nothing past it is offered.
  const rows = floorRows().flatMap((row) => row.paths
    .filter(({ max }) => max === null)
    .map(({ path, min }) => {
      const [low, next] = [min, min + 1].map((value) => drawable(row.id, row.variant, { ...row.floor, [path]: value }));
      if (!next) return null;
      const steps = [];
      const sections = next.sections.length - low.sections.length;
      if (sections > 0) steps.push(min + Math.floor((CREATION_LIMITS.maxSections - low.sections.length) / sections));
      const lines = knownTotal(next) - knownTotal(low);
      if (!openTotal(low) && lines > 0) steps.push(min + Math.floor((CREATION_LIMITS.maxLines - knownTotal(low)) / lines));
      const last = Math.min(...steps);
      return steps.length && drawable(row.id, row.variant, { ...row.floor, [path]: last }) &&
        !drawable(row.id, row.variant, { ...row.floor, [path]: last + 1 }) ? { ...row, path, last } : null;
    })
    .filter(Boolean));
  assert.ok(rows.length, 'some unbounded path stops at a native limit');
  for (const row of rows) {
    const values = offeredOf(settings, row).map((contract) => contract.counts[row.path]);
    assert.ok(values.includes(row.last), JSON.stringify([row.id, row.variant, row.path, row.last]));
    assert.ok(values.every((value) => value <= row.last), JSON.stringify([row.id, row.variant, row.path]));
  }
});

test('each form holds one contiguous run of the draw however many settings it has', async () => {
  for (const lines of [null, 12, 30]) {
    const settings = lines === null ? (await automaticDraw()).settings : await automaticFormCandidates({ lines });
    const runs = [];
    for (const contract of settings)
      if (runs.at(-1)?.id !== contract.id) runs.push({ id: contract.id, variants: [contract.variant], size: 1 });
      else {
        const run = runs.at(-1);
        run.size++;
        if (run.variants.at(-1) !== contract.variant) run.variants.push(contract.variant);
      }
    const ids = runs.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length, 'a form appears in one run only');
    for (const run of runs)
      assert.equal(new Set(run.variants).size, run.variants.length, 'a variant appears in one run inside its form');
    if (lines === null)
      // The old lockstep window gave a variant at most three settings.
      assert.ok(runs.some((run) => run.size > 3 * run.variants.length), 'some form offers more than three settings a variant');
  }
});

test('the draw is a bounded spread over each path, built in bounded time', async () => {
  const { settings, ms } = await automaticDraw();
  assert.ok(ms < 60_000, `cold draw took ${Math.round(ms)} ms`);
  // The stated bound: 3 lockstep vectors and 12 values per path, and one more
  // where a stated length's search found a setting.
  const bound = (paths) => 3 + 12 * paths;
  for (const lines of [null, 30]) {
    const offered = lines === null ? settings : await automaticFormCandidates({ lines });
    const found = new Set(lines === null ? [] : (await _formInternals.lengthSearch(lines))
      .filter(({ outcome }) => outcome === 'found').map(({ id, variant }) => JSON.stringify([id, variant])));
    const perVariant = new Map();
    for (const contract of offered) {
      const key = JSON.stringify([contract.id, contract.variant]);
      perVariant.set(key, (perVariant.get(key) ?? 0) + 1);
    }
    for (const [key, n] of perVariant) {
      const [id, variant] = JSON.parse(key);
      const paths = describeForm(catalog, id).variants[variant].counts.length;
      assert.ok(n <= Math.max(1, bound(paths) + (found.has(key) ? 1 : 0)), `${key}: ${n}`);
    }
  }
  // A single unbounded path is offered across its range: at least six values,
  // reaching past half the widest offered value among those paths.
  const spreads = floorRows()
    .filter(({ paths }) => paths.length === 1 && paths[0].max === null)
    .map((row) => [...new Set(offeredOf(settings, row).map((contract) => contract.counts[row.paths[0].path]))]);
  const widest = Math.max(...spreads.map((values) => Math.max(...values)));
  assert.ok(spreads.some((values) => values.length >= 6 && Math.max(...values) * 2 > widest),
    JSON.stringify(spreads.map((values) => values.length)));
});
