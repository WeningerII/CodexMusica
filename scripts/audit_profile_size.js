#!/usr/bin/env node
// audit_profile_size.js — every preface profile must have exactly 9 tokens.
// Uniform denominator means score = raw count of shared tokens / 9,
// which makes ranking by raw overlap count independent of profile shape.
const C = require('./_loader.js');
let issues = 0;
for (const p of C.PREFACE_LEXICON) {
  const tokens = Array.isArray(p.tokens) ? p.tokens : [];
  if (tokens.length !== 9) {
    console.log('  ' + p.id + ': ' + tokens.length + ' tokens (must be 9)');
    issues++;
  }
}
if (issues === 0) console.log('PROFILE-SIZE AUDIT: CLEAN — all profiles exactly 9 tokens.');
else {
  console.log('\nPROFILE-SIZE AUDIT: ' + issues + ' issues');
  process.exit(1);
}
