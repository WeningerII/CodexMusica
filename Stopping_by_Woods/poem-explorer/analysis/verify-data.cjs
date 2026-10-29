#!/usr/bin/env node
'use strict';

// Run: node analysis/verify-data.cjs
// FROST_ANALYSIS_ROOT may name the directory containing frost_pair_analysis/
// and frost_notation/. This checks packaged data, not the earlier PNG's hash.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const project = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(process.env.FROST_ANALYSIS_ROOT || path.join(project, '..'));
const read = relative => fs.readFileSync(path.join(sourceRoot, relative));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const auditBytes = read('frost_notation/full_sound_audit.json');
const audit = JSON.parse(auditBytes);
const packaged = fs.readFileSync(path.join(project, 'dist/data.js'), 'utf8');
const payload = packaged.match(/^\s*window\.POEM_DATA\s*=\s*([\s\S]*);\s*$/);
assert.ok(payload, 'data.js contains the complete POEM_DATA assignment');
const rootData = JSON.parse(payload[1]);
const createModel = require(path.join(project, 'dist/model.js')).create;
const key = (a, b) => `${a}:${b}`;
const expectedIds = [...Array.from({length: 22}, (_, i) => `E${i + 1}`), 'E63', 'E66', 'H1'];
const baseMask = (1 << 22) - 1;
const allMask = (1 << expectedIds.length) - 1;
const files = {
  annotated: ['frost_annotated_pairs.json', 'frost_annotated_extra_classifications.json'],
  all: ['frost_rhyme_pairs.json', 'frost_extra_classifications.json']
};
assert.equal(rootData.readingMode, 'annotated', 'The default population matches the pronunciation shown');
assert.equal(rootData.allReadings.readingMode, 'all');
assert.deepEqual(Object.keys(rootData.scopeNotes).sort(), ['all', 'annotated']);
const checked = new Map();

for (const scope of ['annotated', 'all']) {
const data = scope === 'annotated' ? rootData : {...rootData, ...rootData.allReadings};
const model = createModel(data);
const [baseName, extraName] = files[scope];
const baseBytes = read(`frost_pair_analysis/${baseName}`);
const extraBytes = read(`frost_pair_analysis/${extraName}`);
const base = JSON.parse(baseBytes);
const extra = JSON.parse(extraBytes);

// Each build must consume the current comparison and its matching add-on.
assert.equal(data.dataSha256, sha256(baseBytes), 'Browser data uses the current base comparison');
assert.equal(extra.source.base_sha256, sha256(baseBytes), 'Add-on was regenerated for the current base');
assert.equal(data.additionalAnalysis.source.base_sha256, sha256(baseBytes));
assert.equal(data.additionalAnalysis.sha256, sha256(extraBytes), 'Browser data uses the current add-on');
assert.equal(extra.source.commit, base.source.commit);
assert.equal(data.readingMode, scope);
assert.equal(data.source.reading_scope, scope);
assert.equal(data.method.reading_scope, scope);
assert.equal(base.source.reading_scope, scope);
assert.equal(base.method.reading_scope, scope);
assert.equal(extra.source.reading_scope, scope);
assert.equal(extra.method.reading_scope, scope);
assert.deepEqual(data.source, base.source, `${scope}: packaged source declaration is exact`);
assert.deepEqual(data.method, base.method, `${scope}: packaged method declaration is exact`);
assert.deepEqual(extra.source.analysis_modules, base.source.analysis_modules);
assert.deepEqual(extra.source.phonology, base.source.phonology);
assert.deepEqual(extra.method.schema_corrections, base.method.schema_corrections);
assert.deepEqual(Object.keys(base.source.analysis_modules).sort(), ['english_schema_contracts.py', 'poem_readings.py']);
for (const hash of Object.values(base.source.analysis_modules)) assert.match(hash, /^[a-f0-9]{64}$/);
assert.match(base.source.adapter.sha256, /^[a-f0-9]{64}$/);
assert.match(extra.source.adapter.sha256, /^[a-f0-9]{64}$/);
assert.deepEqual(data.tokens, base.tokens);
assert.deepEqual(data.categories.map(([id]) => id), expectedIds);
assert.deepEqual(data.categories.slice(0, 22), base.categories);
assert.deepEqual(data.categories.slice(22), extra.categories);
assert.deepEqual(extra.bit_positions, {E63: 22, E66: 23, H1: 24});
for (const [index, id] of expectedIds.entries()) {
  assert.equal(model.bit(id), 1 << index, `${id} has an independent dense bit`);
  assert.deepEqual(model.labels(model.bit(id)).map(c => c.id), [id]);
}
assert.equal(new Set(model.categories.map(c => c.bit)).size, 25);
assert.equal(model.bit('unrecognised'), 0);

// Keep the exact reading, foot boundaries, pronunciation, and close-reading notes.
assert.equal(data.lines.length, 16);
assert.equal(data.tokens.length, 108);
assert.equal(data.tokenPronunciations.length, 108);
assert.equal(data.tokenDefaultPronunciations.length, 108);
for (const [index, pronunciation] of data.tokenDefaultPronunciations.entries()) {
  assert.ok(pronunciation === null || (typeof pronunciation === 'string' && pronunciation.length > 0));
  if (scope === 'annotated') {
    assert.ok(pronunciation !== null, `Annotated occurrence ${index + 1} has a declared lexical pronunciation`);
    const quality = value => value.toLowerCase().replaceAll('-', '');
    assert.equal(quality(pronunciation), quality(data.tokenPronunciations[index]));
  }
}
const retained = ['line', 'text', 'rhyme', 'pronunciation', 'joins', 'stress', 'alternatives', 'P', 'G', 'V', 'R'];
let nextWord = 1;
let footCount = 0;
for (const [index, line] of data.lines.entries()) {
  const original = audit.lines[index];
  for (const field of retained) {
    assert.deepEqual(line[field], original[field], `Original line ${index + 1}: ${field}`);
  }
  assert.equal(line.words.join(' '), line.text);
  assert.equal(line.pronunciation.length, 8);
  assert.equal(line.stress.split(' ').length, 8);
  assert.equal(line.syllableWords.length, 8);
  assert.equal(line.wordIds.length, line.words.length);
  footCount += line.pronunciation.length / 2;
  let localWord = 0;
  let syllables = [];
  for (let s = 0; s < 8; s++) {
    const id = line.wordIds[localWord];
    assert.equal(line.syllableWords[s], id, `Line ${index + 1}, syllable ${s + 1} binds its original word`);
    syllables.push(line.pronunciation[s]);
    if (!line.joins.includes(s)) {
      assert.equal(id, nextWord++);
      assert.equal(data.tokens[id - 1][1], index + 1);
      assert.equal(data.tokens[id - 1][2], localWord + 1);
      assert.equal(data.tokenPronunciations[id - 1], syllables.join('-'));
      syllables = [];
      localWord++;
    }
  }
  assert.equal(syllables.length, 0);
  assert.equal(localWord, line.words.length);
}
assert.equal(nextWord, 109);
assert.equal(footCount, 64);
assert.deepEqual(data.optionalPauses, {1: 4, 7: 3, 13: 4, 15: 4, 16: 4});
if (scope === 'annotated') {
  const manifest = base.source.annotated_reading;
  // The manifest hashes the pronunciation array with Python's default JSON
  // separators, not the annotation audit's unrelated full-file envelope.
  const pronunciationJSON = '[' + data.tokenPronunciations.map(value => JSON.stringify(value)).join(', ') + ']';
  assert.equal(manifest.annotation_sha256, sha256(pronunciationJSON));
  assert.equal(manifest.rows.length, 108);
  assert.deepEqual(manifest.unresolved, []);
  assert.deepEqual(manifest.ambiguous, []);
  let syllables = 0;
  for (const [index, row] of manifest.rows.entries()) {
    const [id, line, position, word, pronunciation, phones, source] = row;
    assert.equal(id, index + 1);
    assert.deepEqual([word, line, position], data.tokens[index]);
    assert.equal(pronunciation, data.tokenPronunciations[index]);
    assert.ok(Array.isArray(phones) && phones.length > 0);
    assert.ok(typeof source === 'string' && source.length > 0);
    syllables += phones.filter(phone => /^[A-Z]+[012]$/.test(phone)).length;
  }
  assert.equal(syllables, 128, 'The pinned reading retains all 128 annotated syllables');
} else {
  assert.equal(base.source.annotated_reading, null);
  for (const id of [4, 13, 23, 96]) assert.equal(data.tokenDefaultPronunciations[id - 1], null);
  assert.ok(typeof data.tokenDefaultPronunciations[7] === 'string'); // know has one supported reading.
}

function maskMap(rows, name) {
  const result = new Map();
  for (const [a, b, mask] of rows) {
    const k = key(a, b);
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && 1 <= a && a < b && b <= 108, `${name}: valid occurrence pair ${k}`);
    assert.ok(Number.isInteger(mask) && mask >= 0 && (mask & ~allMask) === 0, `${name}: valid mask for ${k}`);
    assert.ok(!result.has(k), `${name}: no duplicate pair ${k}`);
    result.set(k, mask);
  }
  return result;
}

const raw = maskMap(data.pairs, 'Packaged pairs');
const baseRaw = maskMap(base.pairs, 'Base pairs');
const extraRaw = maskMap(extra.pairs, 'Additional pairs');
const absent = maskMap(data.absenceOnly, 'Packaged absence flags');
const baseAbsent = maskMap(base.absence_only, 'Base absence flags');
const extraAbsent = maskMap(extra.absence_only, 'Additional absence flags');
assert.equal(raw.size, 5778);
assert.equal(baseRaw.size, 5778);
assert.equal(raw.size, 108 * 107 / 2);
assert.equal(base.counts.occurrences, 108);
assert.equal(base.counts.unordered_pairs, 5778);
assert.equal(extra.counts.occurrences, 108);
assert.equal(extra.counts.unordered_pairs, 5778);
for (const mask of baseRaw.values()) assert.equal(mask & ~baseMask, 0);
for (const mask of extraRaw.values()) assert.equal(mask & baseMask, 0);
const unavailableMask = Object.keys(data.unavailable).reduce((m, id) => m | model.bit(id), 0);
assert.equal(model.availableMask, allMask & ~unavailableMask);
const rawCounts = Object.fromEntries(expectedIds.map(id => [id, 0]));
const shownCounts = Object.fromEntries(expectedIds.map(id => [id, 0]));
let nativePairs = 0;
let displayedPairs = 0;
for (const [a, b, mask] of data.pairs) {
  const k = key(a, b);
  assert.equal(mask & baseMask, baseRaw.get(k), `${k}: E1–E22 match the current base`);
  assert.equal(mask, baseRaw.get(k) | (extraRaw.get(k) || 0), `${k}: all supplemental labels preserved`);
  const omission = absent.get(k) || 0;
  assert.equal(omission, (baseAbsent.get(k) || 0) | (extraAbsent.get(k) || 0));
  assert.equal(omission & mask, omission, `${k}: absence flags only mark recorded positives`);
  const shown = mask & ~omission;
  const pair = model.pair(a, b);
  assert.equal(pair.raw, mask);
  assert.equal(pair.mask, shown);
  assert.equal(shown & unavailableMask, 0, `${k}: unavailable types are not displayed`);
  assert.equal(Boolean(shown & model.bit('E10')), Boolean(shown & (model.bit('E4') | model.bit('E5'))), `${k}: displayed E10 is exactly E4 or E5`);
  nativePairs += Number(Boolean(mask));
  displayedPairs += Number(Boolean(shown));
  for (const category of model.categories) {
    rawCounts[category.id] += Number(Boolean(mask & category.bit));
    shownCounts[category.id] += Number(Boolean(shown & category.bit));
  }
  for (const witness of pair.evidence) {
    assert.ok(witness.mask > 0, `${k}: no empty displayed witness`);
    assert.equal(witness.mask & ~shown, 0, `${k}: witness support is a subset of displayed labels`);
    assert.deepEqual(witness.readings, data.readingWitnesses[witness.witness]);
    assert.ok(witness.readings.length > 0);
    for (const record of witness.readings) assert.match(record, /^.+ = [A-Z0-9 ]+$/);
  }
}
for (const k of absent.keys()) assert.ok(raw.has(k), `Absence flags refer to an existing pair: ${k}`);
for (const id of expectedIds) {
  assert.equal(data.counts.by_category[id].true || 0, rawCounts[id], `${id}: raw count derives from masks`);
  assert.equal(data.counts.nonabsence_by_category[id], shownCounts[id], `${id}: displayed count derives from masks`);
  assert.equal(model.count(model.bit(id)), shownCounts[id], `${id}: filter count matches data`);
  assert.equal(Object.values(data.counts.by_category[id]).reduce((sum, n) => sum + n, 0), 5778, `${id}: every pair was accounted for`);
}
assert.equal(data.counts.pairs_with_native_matches, nativePairs);
assert.equal(data.counts.pairs_with_nonabsence_matches, displayedPairs);
assert.equal(data.counts.category_slots, 5778 * 25);
assert.equal(model.count(), displayedPairs);
assert.equal(model.count(0), 0);
assert.deepEqual(model.overview(0), {words: [], pairs: 0});
assert.equal(data.counts.by_category.E18.undecided || 0, 0, `${scope}: final-syllable classification is fully determined`);

// Preserve every recorded positive witness that still supports a displayed label.
// Compare by pronunciation content, so interning may legitimately change indexes.
function collectWitnesses(rows, pool, target) {
  for (const [a, b, mask, witnessId] of rows) {
    assert.ok(Number.isInteger(witnessId) && witnessId >= 0 && witnessId < pool.length);
    const pair = model.pair(a, b);
    assert.ok(pair, `Witness refers to an existing pair: ${key(a, b)}`);
    assert.equal(mask & ~pair.mask, 0, `Witness only names displayed positives: ${scope} ${key(a, b)}`);
    const visible = mask & pair.mask;
    if (!visible) continue;
    const k = JSON.stringify([a, b, pool[witnessId]]);
    target.set(k, (target.get(k) || 0) | visible);
  }
}
const expectedWitnesses = new Map();
collectWitnesses(base.witness_edges, base.reading_witnesses, expectedWitnesses);
collectWitnesses(extra.witness_edges, extra.reading_witnesses, expectedWitnesses);
const actualWitnesses = new Map();
collectWitnesses(data.witnessEdges, data.readingWitnesses, actualWitnesses);
assert.deepEqual([...actualWitnesses].sort(), [...expectedWitnesses].sort(), 'All displayed pronunciation witnesses and overlapping support survive packaging');
assert.equal(data.readingWitnessLabels.length, data.readingWitnesses.length);
for (const [i, readings] of data.readingWitnesses.entries()) {
  assert.equal(data.readingWitnessLabels[i].length, readings.length);
  for (const label of data.readingWitnessLabels[i]) assert.match(label, /^.+ = .+$/);
}

function contains(a, b, ids, absentIds = []) {
  const pair = model.pair(a, b);
  assert.ok(pair);
  for (const id of ids) assert.ok(pair.mask & model.bit(id), `${scope} ${a}/${b}: ${id} is retained`);
  for (const id of absentIds) assert.equal(pair.mask & model.bit(id), 0, `${scope} ${a}/${b}: ${id} must not be displayed`);
  assert.deepEqual(pair, model.pair(b, a), `${a}/${b}: click order does not change the analysis`);
  return pair;
}
contains(4, 14, [], ['E5', 'E10']); // are / village: the reported false match
contains(14, 84, [], ['E5', 'E10']); // village / the second are
contains(1, 9, ['E5', 'E7', 'E9', 'E10'], ['E4']);
contains(8, 30, ['E1', 'E4', 'E10', 'H1'], ['E5']);
contains(88, 94, ['E1', 'E4', 'E5', 'E10', 'H1']);
contains(8, 98, ['E1', 'E4', 'E10', 'E66'], ['H1', 'E5']);
contains(8, 105, ['E1', 'E4', 'E10', 'E66'], ['H1', 'E5']);
contains(21, 52, ['E63']);
contains(71, 85, ['E63']);
contains(101, 108, ['E3'], ['H1']);
const willFill = contains(17, 27, ['E1', 'E4', 'E5', 'E10', 'H1'], scope === 'annotated' ? ['E20'] : []);
if (scope === 'all') {
  contains(17, 27, ['E20']);
  assert.ok(willFill.evidence.some(e => (e.mask & model.bit('E1')) && e.readings.includes('will = W IH1 L')), 'will/fill retains its full-vowel perfect-rhyme witness');
  assert.ok(willFill.evidence.some(e => (e.mask & model.bit('E20')) && e.readings.includes('will = W AH0 L')), 'will/fill retains its reduced-vowel eye-rhyme witness');
}

// Check every pair within each established end-rhyme family, including here.
const endFamilies = {
  A: [8, 15, 30], B: [22, 37, 43, 55],
  C: [49, 62, 69, 81], D: [75, 88, 94, 101, 108]
};
for (const [letter, members] of Object.entries(endFamilies)) {
  assert.deepEqual(data.lines.filter(line => line.rhyme === letter).map(line => line.wordIds.at(-1)), members);
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i], b = members[j];
      const sameWord = data.tokens[a - 1][0].toLowerCase() === data.tokens[b - 1][0].toLowerCase();
      contains(a, b, sameWord ? ['E3'] : ['E1', 'E4', 'E10']);
    }
  }
}

// These findings must be corrected by the full comparison, not word exclusions.
for (const [a, b] of [[4, 14], [14, 84], [23, 28], [23, 40], [23, 44], [23, 69], [23, 99], [23, 106]]) {
  assert.equal(model.pair(a, b).mask, 0, `${scope} ${a}/${b}: no unsupported sound link`);
}
for (const [a, b] of [[13, 44], [23, 40], [23, 44], [23, 69], [23, 99], [23, 106]]) {
  contains(a, b, [], ['E18']); // A preceding unstressed syllable is not an unstressed word ending.
}
for (const [a, b] of [[14, 23], [23, 32], [23, 72], [13, 77]]) {
  contains(a, b, [], ['E11']); // Family rhyme cannot omit the rest of the longer tail.
}
contains(13, 23, [], ['E1']); // Two weak function words do not become stressed perfect rhyme.
contains(23, 41, [], ['E1']);
if (scope === 'annotated') {
  for (const [a, b] of [[14, 23], [13, 19], [13, 44], [13, 77]]) {
    assert.equal(model.pair(a, b).mask, 0, `annotated ${a}/${b}: alternatives do not leak into the reference reading`);
  }
  contains(19, 70, ['E4', 'E10', 'E16']); // The explicitly annotated "dhee" remains audible.
} else {
  const theSee = contains(13, 19, ['E4', 'E10']);
  assert.ok(theSee.evidence.some(e => (e.mask & model.bit('E4')) && e.readings.includes('the = DH IY0')));
  contains(14, 23, ['E4', 'E10', 'E15']);
}

// The all-poem highlight must include internal occurrences, not just line ends.
for (const id of ['E63', 'E66']) {
  const bit = model.bit(id);
  const matches = data.pairs.filter(([a, b]) => model.pair(a, b).mask & bit);
  const words = [...new Set(matches.flatMap(([a, b]) => [a, b]))].sort((a, b) => a - b);
  assert.deepEqual(model.overview(bit), {words, pairs: matches.length}, `${id}: overview highlights every matching occurrence`);
  assert.ok(words.some(wordId => {
    const [, line, position] = data.tokens[wordId - 1];
    return position < data.lines[line - 1].words.length;
  }), `${id}: includes internal words`);
}
assert.deepEqual(model.overview(model.bit('E66')), {words: [8, 98, 105], pairs: 2});
for (const wordId of [21, 52, 71, 85]) assert.ok(model.overview(model.bit('E63')).words.includes(wordId));
assert.deepEqual(model.related(8, model.bit('E66')).map(r => r.id), [98, 105]);
assert.deepEqual(model.overview(model.bit('E1') | model.bit('E66'), 'all'), {words: [8, 98, 105], pairs: 2});

checked.set(scope, {data, model, base, extra, displayedPairs, footCount});
}

const annotated = checked.get('annotated');
const alternatives = checked.get('all');
assert.deepEqual(annotated.data.tokens, alternatives.data.tokens);
assert.deepEqual(annotated.data.categories, alternatives.data.categories);
assert.deepEqual(annotated.base.source.analysis_modules, alternatives.base.source.analysis_modules);
assert.deepEqual(annotated.base.method.schema_corrections, alternatives.base.method.schema_corrections);
assert.deepEqual(annotated.base.source.sha256, alternatives.base.source.sha256);
let alternativeOnlyPairs = 0;
for (const [a, b] of annotated.data.pairs) {
  const fixed = annotated.model.pair(a, b);
  const all = alternatives.model.pair(a, b);
  assert.equal(fixed.raw & ~all.raw, 0, `${a}/${b}: all-reading raw results include every annotated category`);
  assert.equal(fixed.mask & ~all.mask, 0, `${a}/${b}: all-reading display includes every annotated category`);
  alternativeOnlyPairs += Number(Boolean(all.mask & ~fixed.mask));
}
assert.ok(alternativeOnlyPairs > 0, 'The two reading populations are distinct');
assert.ok(alternatives.model.related(23).length > annotated.model.related(23).length, 'To alternatives are confined to the alternative population');
assert.ok(alternatives.model.related(13).length > annotated.model.related(13).length, 'The alternatives are confined to the alternative population');

console.log(`PASS: both reading scopes contain 108 occurrences, 5,778 unique pairs and 25 independent labels; ${annotated.displayedPairs.toLocaleString()} annotated and ${alternatives.displayedPairs.toLocaleString()} all-reading displayed matches; every annotated category is included in all readings; matching source/add-on hashes; 64 retained feet and 128 pinned syllables; all end-rhyme families including here; positive witnesses; corrected To/up, inner-syllable and truncated-tail negatives.`);
