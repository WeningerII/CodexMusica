import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkForm, describeForm, realizeForm } from '../src/song-forms.mjs';
import { CREATION_LIMITS, projectSongFormCreation } from '../src/song-form-creation.mjs';
import { gradeObservations } from '../src/song-form-grade.mjs';

const catalog = JSON.parse(readFileSync(new URL('../data/song-forms.json', import.meta.url)));
function select(id, variant = 0) {
  const v = describeForm(catalog, id).variants[variant];
  const counts = Object.fromEntries(v.counts.map(({ path, min }) => [path, min]));
  return projectSongFormCreation(realizeForm(catalog, id, { variant, counts }), counts);
}

test('repeated blocks keep the catalog role separate from their written arrangement', () => {
  for (const [id, variant, label] of [
    ['terrace-chant', 0, 'chant'],
    ['street-cry', 1, 'call'],
    ['playground-taunt', 1, 'chant'],
    ['sonnet-sequence', 0, 'sonnet'],
  ]) {
    const { contract } = select(id, variant);
    const num = label === 'sonnet' ? 14 : 2;
    const role = label === 'sonnet' ? 'verse' : 'chorus';
    assert.deepEqual(
      contract.sections,
      Array(2).fill({ unit: 'section', role, sourceRole: label, lines: num })
    );
    const text = Array.from({ length: num }, (_, i) => String(i + 1));
    const sections = contract.sections.map((s, i) => ({
      role,
      sourceRole: s.sourceRole,
      lineSpan: [i * num, (i + 1) * num],
    }));
    const grade = (lines, s = sections) =>
      gradeObservations(catalog, id, { variant, counts: contract.counts, sections: s, lines });
    const lines = [...text, ...text];
    assert.equal(grade(lines).verdict, 'pass');
    assert.equal(
      grade(
        lines,
        sections.map((s) => ({ ...s, sourceRole: 'unrelated' }))
      ).verdict,
      'fail'
    );
    assert.equal(
      grade(
        lines,
        sections.map((s) => ({ ...s, role: 'interlude' }))
      ).verdict,
      'fail'
    );
    if (role === 'chorus') {
      lines[num] = 'x ' + lines[num];
      const g = grade(lines);
      assert.equal(g.verdict, 'fail');
      assert.deepEqual(
        g.checks
          .filter((c) => c.kind === 'section-text-return' && c.outcome === 'fail')
          .map((c) => c.lines),
        [[1, num + 1]]
      );
    } else {
      assert.equal(
        grade(lines, [
          { ...sections[0], lineSpan: [0, num + 1] },
          { ...sections[1], lineSpan: [num + 1, num * 2] },
        ]).verdict,
        'fail'
      );
    }
  }
});

test('unrelated roles and unrepresented linkage remain ineligible', () => {
  for (const [id, variant] of [
    ['street-cry', 0],
    ['playground-taunt', 0],
    ['dj-toasting', 0],
    ['verse-chorus-bridge', 1],
  ]) {
    assert.equal(select(id, variant).status, 'unsupported', id + ' ' + variant);
  }
});

test('alternating participants retain their independent division paths', () => {
  const result = select('call-and-response');
  assert.equal(result.nestedDivisions, true);
  assert.deepEqual(
    result.contract.sections.map((section) => section.divisionPath.at(-1).role),
    ['call', 'response', 'call', 'response']
  );
  assert.ok(result.contract.sections.every((section) => section.sourceRole === undefined));
});

test('closing lines link successive 14-line sections, including the return to the first', () => {
  for (const [id, variant, size, master] of [
    ['crown-of-sonnets', 0, 7, false],
    ['sonnet-sequence', 1, 7, false],
    ['heroic-crown', 0, 14, true],
  ]) {
    // (#902) A crown past the owner's 150-line cap is refused by name, with
    // no contract to grade.
    if (14 * (size + Number(master)) > CREATION_LIMITS.maxLines) {
      const refused = select(id, variant);
      assert.equal(refused.status, 'unsupported', id);
      assert.deepEqual(refused.reasons.map((r) => r.code), ['native-line-limit'], id);
      assert.equal(refused.contract, null, id);
      continue;
    }
    const { contract } = select(id, variant);
    const sections = contract.sections.map((s, i) => ({ ...s, lineSpan: [14*i, 14*(i+1)] }));
    assert.equal(sections.length, size + Number(master));
    assert.equal(sections.at(-1).sourceRole, master ? 'master-sonnet' : 'sonnet');
    assert.equal(contract.returnGroups.length, size);
    const lines = Array.from({length: 14 * sections.length}, (_, i) => String(i));
    for (let i = 0; i < size; i++) {
      const head = String(i);
      lines[14*i] = lines[14*((i+size-1)%size)+13] = head;
      if (master) lines[14*size+i] = head;
    }
    const grade = () => gradeObservations(catalog, id, {variant, counts: {}, lines, sections});
    assert.equal(grade().verdict, 'pass');
    const declarations = lines.map((returns) => ({returns}));
    assert.equal(gradeObservations(catalog, id, {variant, counts: {}, lines: declarations, sections}).verdict, 'unknown');
    lines[lines.length-1] = 'x';
    assert.equal(grade().verdict, 'fail');
  }
});

test('Pindaric labels and line totals cannot certify metrical responsion', () => {
  const id = 'pindaric-ode';
  const counts = { '1.1': 2 };
  const plan = realizeForm(catalog, id, { counts });
  const stanzas = plan.tree[0].children.flatMap((triad) => triad.children);
  const labelsOnly = Object.fromEntries(
    stanzas.map(({ address, unit, role }) => [address, { unit, role }])
  );
  assert.equal(checkForm(catalog, id, { counts, units: labelsOnly }).verdict, 'unknown');
  const widths = [2, 2, 1, 2, 3, 1];
  let offset = 0;
  const sections = stanzas.map(({ role }, i) => {
    const start = offset;
    offset += widths[i];
    return { role, lineSpan: [start, offset] };
  });
  const lines = Array.from({ length: offset }, () => ({ text: 'one', stress: '/' }));
  const measured = (score) => gradeObservations(catalog, id, { counts, lines, sections: score });
  const lengths = (result) => result.checks.filter((c) => c.kind === 'metrical-responsion')
    .map((c) => c.printedLineCounts);
  const result = measured(sections);
  assert.equal(result.verdict, 'unknown');
  assert.deepEqual(lengths(result), [[2, 2], [2, 3]]);
  assert.deepEqual(result.checks.filter((c) => c.kind === 'epode-meter-contrast')
    .map((c) => [c.printedLineCount, c.outcome]), [[1, 'unknown'], [1, 'unknown']]);
  for (const score of [
    undefined,
    sections.slice(1),
    [{ ...sections[0], lineSpan: [1, 2] }, ...sections.slice(1)],
    [{ ...sections[0], role: 'verse' }, ...sections.slice(1)],
  ]) assert.deepEqual(lengths(measured(score)), [undefined, undefined]);
  assert.equal(projectSongFormCreation(plan, counts).status, 'ready');
});


test('interlocking rhymes keep the measured boundary of each stanza and the final line or couplet', () => {
  const cases = [
    ['rubaiyat-stanza', 1, [4, 4]],
    ['terza-rima', 0, [3, 3, 3, 1]],
    ['terza-rima', 1, [3, 3, 3, 2]],
  ];
  for (const [id, variant, lengths] of cases) {
    const plan = realizeForm(catalog, id, { variant });
    const { contract } = projectSongFormCreation(plan);
    assert.deepEqual(contract.sections.map((s) => s.lines), lengths);
    const lines = plan.lines.map(({ rhyme }) => ({ text: 'one', rhyme }));
    let index = 0;
    const sections = lengths.map((n) => {
      const start = index;
      index += n;
      return { role: 'verse', lineSpan: [start, index] };
    });
    const grade = () => gradeObservations(catalog, id, { variant, lines, sections });
    assert.equal(grade().verdict, 'pass');
    sections[0].lineSpan[1]--;
    sections[1].lineSpan[0]--;
    const wrong = grade();
    assert.equal(wrong.verdict, 'fail');
    assert.equal(wrong.checks.filter((c) => c.kind === 'line-span' && c.outcome === 'fail').length, 2);
  }
});

test('Byr a thoddaid binds the closing line and leaves the other couplet ending open', () => {
  const id = 'byr-a-thoddaid';
  const { contract } = select(id);
  assert.deepEqual(contract.openRhymeLines, [5]);
  assert.deepEqual(contract.rhymeGroups, [[1,2,3,4,6]]);
  const lines = Array.from({ length: 6 }, () => ({ text: 'x', syllables: 8, rhyme: 'A' }));
  const sections = [{ role: 'verse', lineSpan: [0,4] }, { role: 'verse', lineSpan: [4,6] }];
  const grade = (score) => gradeObservations(catalog, id, { variant: 0, lines, sections: score });
  for (const end of ['A', 'B', undefined]) {
    lines[4] = { text: 'x', syllables: 3, ...(end && {rhyme: end}) };
    assert.equal(grade(sections).verdict, 'pass');
  }
  lines[5].rhyme = 'B';
  assert.equal(grade(sections).verdict, 'fail');
  delete lines[5].rhyme;
  assert.equal(grade(sections).verdict, 'unknown');
  lines[5].rhyme = 'A';
  lines[2].syllables = 7;
  assert.equal(grade(sections).verdict, 'fail');
  lines[2].syllables = 8;
  assert.equal(grade().verdict, 'unknown');
  assert.equal(grade([{ role: 'verse', lineSpan:[0,3] }, {role: 'verse', lineSpan:[3,6]}]).verdict, 'fail');
});
