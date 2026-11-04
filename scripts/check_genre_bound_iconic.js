#!/usr/bin/env node
'use strict';
// check_genre_bound_iconic.js — a genre-bound signature binds a descriptor
// only when the descriptor carries the signature itself (#671).
//
// translate.js splits a descriptor on hyphens and spaces before asking whether
// it carries a genre-bound signature, so "four-on-floor" reaches the check as
// the tokens four, on, floor. The list used to hold those three words singly,
// which bound every descriptor that merely contained one of them: an
// orchestra's viola lost "four layer system", carimbó lost "four voice
// polyphonic" and post-bop lost "clip on" (Jony's pass 2 on #671; a sweep of
// all 7,755 traditions found 14 such recipes and no other change). Hyphenated
// signatures now match as consecutive tokens.
//
//   node scripts/check_genre_bound_iconic.js

const fs = require('node:fs');
const path = require('node:path');
const { translate, hasGenreBoundIconic } = require('./translate.js');
const { RECIPE_CHAR_CEILING } = require('./_api_contract.js');

const root = path.resolve(__dirname, '..');
const problems = [];
let checks = 0;
const expect = (ok, what) => {
  checks++;
  if (!ok) problems.push(what);
};
const tokens = (d) => d.toLowerCase().split(/[-\s]/);

// 1. The predicate, on descriptors as translate.js tokenises them.
for (const d of [
  'four-on-floor',
  'four-on-the-floor kick',
  'Four on the floor',
  'four-to-the-floor stomp',
  'four-on-floor kick drum',
  'two-step shuffle',
  'twostep',
  'breakbeat chop',
  'rave stab',
]) {
  expect(hasGenreBoundIconic(tokens(d)), `"${d}" should carry a genre-bound signature`);
}
for (const d of [
  'four layer system',
  'four voice polyphonic',
  'clip on',
  'floor tom',
  'two hands',
  'step',
  'four of the floors',
]) {
  expect(!hasGenreBoundIconic(tokens(d)), `"${d}" should not carry a genre-bound signature`);
}

// 2. The recipes the split tokens used to cut, from each tradition's committed
// arrangement (the static API's own input).
const config = (id) =>
  JSON.parse(fs.readFileSync(path.join(root, 'api', 'traditions', `${id}.json`), 'utf8')).config;
for (const [id, phrase] of [
  ['orchestral_performance', 'four layer system'],
  ['carimbo', 'four voice polyphonic'],
  ['contemporary_post_bop', 'clip on'],
]) {
  const recipe = translate(config(id), { ceiling: RECIPE_CHAR_CEILING });
  expect(recipe.includes(phrase), `${id}: recipe lost "${phrase}"`);
}

if (problems.length) {
  console.error(`check_genre_bound_iconic: FAIL — ${problems.length} of ${checks} checks`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`check_genre_bound_iconic: ${checks}/${checks} checks pass`);
