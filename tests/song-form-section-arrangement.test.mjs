import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeForm, realizeForm } from '../src/song-forms.mjs';
import { projectSongFormCreation } from '../src/song-form-creation.mjs';
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
    ['sonnet-sequence', 1],
    ['dj-toasting', 0],
    ['modified-strophic', 0],
    ['ternary', 0],
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
