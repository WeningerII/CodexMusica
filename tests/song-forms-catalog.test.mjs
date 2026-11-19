import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {checkForm, describeForm, realizeForm} from '../src/song-forms.mjs';
import {formMandate} from '../src/song-form-mandate.mjs';

const load = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const canonical = load('../data/song-forms.json');
const shipped = load('../api/song-forms.json');
const catalog = JSON.parse(shipped);
const nodeFields = new Set(['unit', 'children', 'times', 'role', 'syllables', 'stresses', 'bars',
  'stress', 'rhyme', 'returns', 'endWord']);
const structuralId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const classId = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/;

function checkVocabulary(node, where) {
  for (const key of Object.keys(node)) assert.ok(nodeFields.has(key), where + ' unexpected key ' + key);
  assert.match(node.unit, structuralId, where);
  if (node.role !== undefined) assert.match(node.role, structuralId, where);
  for (const field of ['rhyme', 'returns', 'endWord']) {
    if (node[field] !== undefined) assert.match(node[field], classId, where + ' ' + field);
  }
  if (node.stress !== undefined) assert.match(node.stress, /^[./]+$/, where);
  for (const field of ['syllables', 'stresses', 'bars']) {
    if (node[field] !== undefined) assert.ok(Number.isSafeInteger(node[field]) && node[field] > 0, where + ' ' + field);
  }
  if (node.children !== undefined) {
    assert.ok(Array.isArray(node.children) && node.children.length > 0, where);
    node.children.forEach((child, i) => checkVocabulary(child, where + '.' + (i + 1)));
  }
}

// Count from the shipped template independently of the engine's spans and projections.
function expectedSize(node, counts, path = '1') {
  const times = Array.isArray(node.times) ? counts[path] : (node.times ?? 1);
  const size = {nodes:1, lines:Number(node.unit === 'line'), sections:Number(node.unit === 'section')};
  node.children?.forEach((child, i) => {
    const next = expectedSize(child, counts, path + '.' + (i + 1));
    for (const key of Object.keys(size)) size[key] += next[key];
  });
  for (const key of Object.keys(size)) size[key] *= times;
  return size;
}

function chooseCounts(parameters, representative) {
  return Object.fromEntries(parameters.map(({path, min, max}) => [
    path, representative ? Math.min(min + 1, max ?? Infinity) : min,
  ]));
}

function assertEmptyMandate(result, where) {
  assert.equal(result.lineCount, null, where);
  assert.equal(result.minimumLines, null, where);
  assert.deepEqual(result.rhymeGroups, [], where);
  assert.deepEqual(result.returnGroups, [], where);
  assert.deepEqual(result.endWordGroups, [], where);
  assert.deepEqual(result.lineConstraints, [], where);
}

test('the static catalog is the complete canonical structural payload', () => {
  assert.equal(shipped, canonical, 'regenerate api/song-forms.json from data/song-forms.json');
  assert.ok(catalog.length >= 364, 'the initial reviewed inventory contains 364 forms');
  assert.equal(new Set(catalog.map(f => f.id)).size, catalog.length);
  assert.equal(new Set(catalog.map(f => f.name)).size, catalog.length);
  for (const form of catalog) {
    assert.deepEqual(Object.keys(form).sort(), ['id', 'name', 'patterns', 'scope'], form.id);
    assert.match(form.id, structuralId);
    assert.ok(form.name.trim().length && !/[\r\n<>]|:\/\//u.test(form.name), form.id);
    assert.ok(['rule', 'setting', 'deferred'].includes(form.scope), form.id);
    assert.equal(Boolean(form.patterns.length), form.scope !== 'deferred', form.id);
    form.patterns.forEach((pattern, i) => checkVocabulary(pattern, form.id + '/' + i));
  }
});

test('every published alternative is selectable and reproduces its structural projections', () => {
  for (const form of catalog) {
    const description = describeForm(catalog, form.id);
    assert.deepEqual(description.patterns, form.patterns, form.id);
    const indices = form.patterns.map((_, i) => i);
    assert.deepEqual(description.variants.map(v => v.index), indices, form.id);
    const initial = realizeForm(catalog, form.id);
    assert.equal(initial.scope, form.scope, form.id);
    if (form.scope === 'deferred' || indices.length > 1) {
      assert.equal(initial.status, form.scope === 'deferred' ? 'deferred' : 'needs-input', form.id);
      assert.deepEqual(initial.tree, [], form.id);
      assert.equal(checkForm(catalog, form.id, {lines:[]}).verdict, 'unknown', form.id);
      assertEmptyMandate(formMandate(initial), form.id);
      if (indices.length) assert.deepEqual(initial.needs, [{kind:'variant', choices:indices}], form.id);
    }
    for (const {index, counts: parameters} of description.variants) {
      const where = form.id + '/' + index;
      if (parameters.length) {
        const pending = realizeForm(catalog, form.id, {variant:index});
        assert.equal(pending.status, 'needs-input', where);
        assertEmptyMandate(formMandate(pending), where);
      }
      for (const representative of parameters.length ? [false, true] : [false]) {
        const counts = chooseCounts(parameters, representative);
        const options = {variant:index, counts};
        const expected = expectedSize(form.patterns[index], counts);
        const plan = realizeForm(catalog, form.id, options);
        assert.equal(plan.status, 'ready', where);
        assert.equal(plan.scope, form.scope, where);
        assert.deepEqual(plan.needs, [], where);
        assert.equal(plan.tree.reduce((n, root) => n + root.span.nodes[1] - root.span.nodes[0], 0), expected.nodes, where);
        assert.equal(plan.lines.length, expected.lines, where);
        assert.equal(plan.sections.length, expected.sections, where);
        const mandate = formMandate(plan);
        assert.equal(mandate.scope, form.scope, where);
        if (plan.coverage.lines !== 'complete') assert.equal(mandate.lineCount, null, where);
        if (mandate.lineCount !== null) assert.equal(mandate.lineCount, expected.lines, where);
        assert.equal(checkForm(catalog, form.id, options).verdict, 'unknown', where + ' lacks observations');
        for (const key of ['lines', 'sections']) {
          if (plan.coverage[key] === 'complete') {
            // The printed triadic setting consumes physical rows, three per logical line.
            const stepped = key === 'lines' && form.id === 'triadic-line';
            const count = stepped ? 3 * expected.lines : expected[key];
            const observed = Array.from({length:count + 1}, (_, i) =>
              stepped ? ' '.repeat(i % 3) + 'x' : {});
            const countKind = stepped ? 'printed-row-count' : key + '-count';
            const check = checkForm(catalog, form.id, {...options, [key]:observed});
            assert.equal(check.verdict, 'fail', where + ' extra ' + key);
            assert.ok(check.checks.some(c => c.kind === countKind && c.outcome === 'fail'), where);
          }
        }
      }
    }
  }
});

test('a published open repeat rejects runaway expansion and invalid caller input', () => {
  for (const form of catalog) {
    for (const variant of describeForm(catalog, form.id).variants) {
      const unbounded = variant.counts.find(({max}) => max === null);
      if (!unbounded) continue;
      const counts = chooseCounts(variant.counts, true);
      const realizeWith = (path, value) => realizeForm(catalog, form.id, {
        variant:variant.index, counts:{...counts, [path]:value},
      });
      assert.throws(() => realizeWith(unbounded.path, Number.MAX_SAFE_INTEGER), /size limit/i);
      assert.throws(() => realizeWith(unbounded.path, -1), /count/i);
      assert.throws(() => realizeWith('0', 1), /count/i);
      assert.throws(() => realizeForm(catalog, form.id, {variant:form.patterns.length}), /variant/i);
      return;
    }
  }
  assert.fail('the shipped catalog lost every open repeat');
});

test('compatible symbolic observations are accepted and measured disagreements fail', () => {
  let accepted = 0;
  let measurable = 0;
  for (const form of catalog) {
    for (const variant of describeForm(catalog, form.id).variants) {
      const options = {variant:variant.index, counts:chooseCounts(variant.counts, true), units:{}};
      const plan = realizeForm(catalog, form.id, options);
      if (plan.coverage.lines !== 'none') options.lines = plan.lines.map(() => ({}));
      if (plan.coverage.sections !== 'none') options.sections = plan.sections.map(() => ({}));
      let counter;
      function observe(node) {
        const observation = {unit:node.unit};
        for (const field of ['role', 'stress', 'stresses', 'bars', 'syllables', 'rhyme', 'returns', 'endWord']) {
          if (node[field] !== undefined) observation[field] = node[field];
        }
        if (node.children.length && node.unit !== 'line' && node.span.lines[1] > node.span.lines[0]) {
          observation.lineSpan = node.span.lines;
        }
        if (node.unit === 'line' && node.children.length) {
          const part = node.children[0].unit;
          const key = {word:'words', mora:'moras', syllable:'syllables'}[part];
          if (key && node.children.every(child => child.unit === part)) observation[key] = node.children.length;
        }
        // Alter one independent scalar; changing a derived count alongside a supplied
        // stress sequence would constitute contradictory input instead of a valid negative.
        if (!counter && !node.stress) {
          const key = ['syllables', 'stresses', 'bars'].find(k => node[k] !== undefined);
          if (key) counter = {observation, key};
        }
        options.units[node.address] = observation;
        node.children.forEach(observe);
      }
      plan.tree.forEach(observe);
      const where = form.id + '/' + variant.index;
      const result = checkForm(catalog, form.id, options);
      assert.ok(['pass', 'unknown'].includes(result.verdict), where + ' consistent symbolic observations');
      if (result.verdict === 'pass') {
        accepted++;
        assert.ok(result.checks.length && result.checks.every(c => c.outcome === 'pass'), where);
      } else {
        assert.ok(result.checks.some(c => c.outcome === 'unknown') || !result.checks.length, where);
      }
      if (counter) {
        measurable++;
        counter.observation[counter.key]++;
        const mismatch = checkForm(catalog, form.id, options);
        assert.equal(mismatch.verdict, 'fail', where);
        assert.ok(mismatch.checks.some(c => c.kind === counter.key && c.outcome === 'fail'), where);
      }
    }
  }
  assert.ok(accepted > 0, 'no published setting could pass on observed symbols');
  assert.ok(measurable > 0, 'no published numeric constraint was exercised');
});

test('a Rondo diagram checks part order without inferring tunes from labels or words', () => {
  for (const [variant, roles] of ['abaca', 'abacaba'].entries()) {
    const parts=[...roles].map((letter)=>({role:'part-'+letter}));
    const good=checkForm(catalog,'rondo',{variant,sections:parts});
    assert.equal(good.verdict,'unknown');
    assert.ok(good.checks.filter((c)=>c.kind==='role').every((c)=>c.outcome==='pass'));
    const groups=good.checks.filter((c)=>c.kind==='musical-return');
    assert.deepEqual(groups.map(c=>c.sections),variant===0?[[1,3,5]]:[[1,3,5,7],[2,6]]);
    assert.ok(groups.every(c=>c.outcome==='unknown'));
    assert.equal(good.checks.find((c)=>c.kind==='musical-contrast').outcome,'unknown');
    parts[1]={role:'part-a'};
    assert.equal(checkForm(catalog,'rondo',{variant,sections:parts}).verdict,'fail');
  }
});
