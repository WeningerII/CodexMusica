// Item 5: provenance (`numbering`) of rows the MIGRATION writes vs rows a FORM writes,
// across a later voices toggle made with the page's own repeats-voices form.
'use strict';
const make = require('./ctx.js');
const { run } = make(process.argv[2]);
const LINE = 'Oh--oh, (ah) oh my love';
const SONG = `[VERSE]\n${LINE}\nwe sing it plain tonight`;
const word = (t, voices) => run('CMLyricTokens.readerLine(__l, {stripParens: !__v}).tokens.map(x => x.text)', { __l: LINE, __v: voices })[t - 1];
const toggleVoices = (text) => run(`LY_FORMS['repeats-voices'].apply(lyParse(__t), null, { voices: 'sung' }, ['voices']).text`, { __t: text });
const has = (fn) => { try { return run(`typeof ${fn} === 'function'`); } catch { return false; } };
console.log('v1 tokens (stripped):', JSON.stringify(run('CMLyricTokens.v1GraderSpans(__l, true).map(x => x.text)', { __l: LINE })));
console.log('v2 tokens voices off:', JSON.stringify(run('CMLyricTokens.readerLine(__l, {stripParens:true}).tokens.map(x=>x.text)', { __l: LINE })));
console.log('v2 tokens voices on :', JSON.stringify(run('CMLyricTokens.readerLine(__l, {stripParens:false}).tokens.map(x=>x.text)', { __l: LINE })));
// A. legacy (unmarked) group row naming v1 token 4 = "love" -> migrated while voices are off.
const legacy = `[SETUP — rhyme groups — 1.T4,2.end]\n${SONG}`;
const migrated = run('lyMigrateSavedReadings(__t).text', { __t: legacy });
console.log('\nA. migrated row:', migrated.split('\n')[0]);
let wire = run('lyDeclarationsOf(lyParse(__t))', { __t: migrated });
let t = Number(/1\.T(\d+)/.exec(wire.groups)[1]);
console.log('   before toggle wire:', wire.groups, wire.numbering, '-> word', word(t, false));
const toggled = toggleVoices(migrated);
wire = run('lyDeclarationsOf(lyParse(__t))', { __t: toggled });
t = Number(/1\.T(\d+)/.exec(wire.groups)[1]);
console.log('   after voices toggle wire:', wire.groups, wire.numbering, 'need_decision:', wire.groups_need_decision || null, '-> word', word(t, true));
// B. the same place written by the page's form while voices are off.
if (has('lySetSetup')) {
  const formed = run('lySetSetup("rhyme groups", ["1.T5,2.end"], __t)', { __t: SONG });
  console.log('\nB. form-written row:', formed.split('\n')[0]);
  const tog = toggleVoices(formed);
  const w = run('lyDeclarationsOf(lyParse(__t))', { __t: tog });
  const k = Number(/1\.T(\d+)/.exec(w.groups)[1]);
  console.log('   after voices toggle wire:', w.groups, w.numbering, '-> word', word(k, true));
}
// C. legacy reading row migrated, then voices toggled.
const rrow = `[SETUP — reading — token 4 "love" in ${JSON.stringify(LINE)} — L AH1 V — declared — source: the singer]`;
const migR = run('lyMigrateSavedReadings(__t).text', { __t: `${rrow}\n${SONG}` });
console.log('\nC. migrated reading row:', migR.split('\n')[0]);
const togR = toggleVoices(migR);
const wr = run('lyDeclarationsOf(lyParse(__t))', { __t: togR });
console.log('   after voices toggle wire pronunciations:', JSON.stringify(wr.pronunciations || null), 'readings_need_decision:', JSON.stringify(wr.readings_need_decision || null));
if (wr.pronunciations) { const p = wr.pronunciations[0]; console.log('   wire token', p.token, 'numbering', p.numbering, '-> word under that numbering', word(p.token, /voices/.test(p.numbering)), '(row says', JSON.stringify(p.word) + ')'); }
