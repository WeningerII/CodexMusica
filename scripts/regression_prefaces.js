#!/usr/bin/env node
// regression_prefaces.js — verifies the habitat matcher produces stable
// preface assignments for 79 canonical (tradition, instrument) fixtures
// spanning all 14 instrument classes.
// Run before any release. Failing means the matcher changed behavior.

const fs = require('fs');
const path = require('path');
const C = require(path.join(__dirname, '_loader.js'));
const PM = require(path.join(__dirname, '_preface_match.js'));
const CD = require(path.join(__dirname, '_card_descriptors.js'));
const M = require(path.join(__dirname, '_matcher.js'));
const sigs = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'references', '_tradition_signatures.json'), 'utf8'));
const fixtures = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tests', '_preface_regression_fixtures.json'), 'utf8'));

// suggest() delegates to the canonical primitive in _preface_match.js.
// Two implementations of the v2 algorithm exist (HTML embed, _preface_match.js).
// Importing the canonical primitive here collapses the historical inline
// copy in this file; the HTML embed is necessarily duplicated because
// the shipped artifact has no Node runtime. The tandem check
// `preface-matcher alignment (HTML embed ↔ Node primitive)` detects
// silent drift between them.
//
// Card-descriptor extraction is similarly factored: _card_descriptors.js holds
// the production-aligned version (descriptors only, NO match_tokens — matching
// the HTML embed's _cardDescriptorSet). See that module's header for the
// divergence from _matcher.js:cardDescriptors.
function suggest(card) {
  return PM.suggest(CD.cardDescriptors(card, C, sigs), C.PREFACE_LEXICON);
}

let pass = 0, fail = 0;
const failures = [];
for (const f of fixtures) {
  const card = M.defaultCard(f.traditionId, f.instrumentId);
  const actual = suggest(card);
  if (actual === f.expectedPreface) pass++;
  else { fail++; failures.push({ ...f, actual }); }
}
console.log('PREFACE REGRESSION:', pass + '/' + fixtures.length, fail === 0 ? 'PASS' : 'FAIL');
if (failures.length) {
  console.log('failures:');
  failures.forEach(f => console.log('  ' + f.traditionId + ' / ' + f.instrumentId + ' [' + f.instrumentClass + ']: expected=' + f.expectedPreface + ' actual=' + f.actual));
}
process.exit(fail === 0 ? 0 : 1);
