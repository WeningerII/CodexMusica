const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const project = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(project, '..');
global.window = {};
require(path.join(project, 'dist/data.js'));
const data = window.POEM_DATA;
const raw = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'frost_pair_analysis/frost_rhyme_pairs.json')));
const audit = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'frost_notation/full_sound_audit.json')));

assert.equal(data.lines.length, 16);
assert.equal(data.tokens.length, 108);
assert.equal(data.pairs.length, 5778);
assert.equal(data.categories.length, 22);
assert.deepEqual(data.tokens, raw.tokens);
assert.deepEqual(data.pairs, raw.pairs);
assert.deepEqual(data.absenceOnly, raw.absence_only);
assert.deepEqual(data.readingWitnesses, raw.reading_witnesses);
assert.deepEqual(data.witnessEdges, raw.witness_edges);
assert.deepEqual(data.counts, raw.counts);

const retained = ['line', 'text', 'rhyme', 'pronunciation', 'joins', 'stress', 'alternatives', 'P', 'G', 'V', 'R'];
let nextId = 1;
for (const [index, line] of data.lines.entries()) {
  for (const key of retained) assert.deepEqual(line[key], audit.lines[index][key], `Preserved line ${index + 1}: ${key}`);
  assert.equal(line.words.join(' '), line.text);
  assert.equal(line.pronunciation.length, 8);
  assert.equal(line.syllableWords.length, 8);
  assert.equal(line.wordIds.length, line.words.length);
  assert.equal(new Set(line.syllableWords).size, line.words.length);
  for (const [position, id] of line.wordIds.entries()) {
    assert.equal(id, nextId++);
    assert.equal(data.tokens[id - 1][1], index + 1);
    assert.equal(data.tokens[id - 1][2], position + 1);
    assert.ok(data.tokenPronunciations[id - 1]);
  }
  assert.deepEqual([...new Set(line.syllableWords)], line.wordIds);
}
assert.equal(nextId, 109);
assert.equal(data.tokenPronunciations.length, 108);

const absence = new Map(data.absenceOnly.map(([a, b, mask]) => [`${a}:${b}`, mask]));
const pairKeys = new Set();
const counts = Object.fromEntries(Array.from({length: 22}, (_, i) => [`E${i + 1}`, 0]));
let displayed = 0;
for (const [a, b, mask] of data.pairs) {
  assert.ok(a >= 1 && a < b && b <= 108);
  const key = `${a}:${b}`;
  assert.ok(!pairKeys.has(key));
  pairKeys.add(key);
  const omit = absence.get(key) || 0;
  assert.equal(mask & omit, omit);
  const show = mask & ~omit;
  if (show) displayed++;
  for (let n = 1; n <= 22; n++) if (show & (1 << (n - 1))) counts[`E${n}`]++;
}
assert.equal(displayed, 1572);
assert.deepEqual(counts, raw.counts.nonabsence_by_category);
assert.deepEqual(data.pairs.find(([a, b]) => a === 1 && b === 9), [1, 9, 848]);
assert.deepEqual(data.optionalPauses, {1:4,7:3,13:4,15:4,16:4});
console.log('PASS: exact poem and all retained annotations; 108 occurrence bindings; 5,778 pairs; 22 categories; reading witnesses; 1,572 displayed pairs.');
