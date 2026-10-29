'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const context={window:{}};
vm.runInNewContext(read('dist/data.js'),context);
const original=JSON.parse(JSON.stringify(context.window.POEM_DATA));
vm.runInNewContext(read('dist/scope-refinement-data.js'),context);
vm.runInNewContext(read('dist/scope-refinement.js'),context);
const data=JSON.parse(JSON.stringify(context.window.POEM_DATA));
const r=JSON.parse(read('dist/scope-refinement-audit.json'));
const {create}=require('../dist/model.js');
assert.equal(crypto.createHash('sha256').update(read('dist/data.js')).digest('hex'),r.baseDataSha256);
const make=(d,s)=>s==='annotated'?d:{...d,...d.allReadings};
for(const scope of ['annotated','dictionary_union']){
  const d=make(data,scope),base=make(original,scope),m=create(d),old=create(base);
  assert.equal(d.pairs.length,5778);assert.equal(d.categories.length,26);
  assert.equal(m.count(m.bit('A1')),235);assert.equal(m.count(m.bit('E9')),147);assert.equal(m.count(m.bit('E63')),34);
  assert.equal(m.count(),d.counts.pairs_with_nonabsence_matches);
  for(const [a,b] of d.pairs){
    assert.equal(m.pair(a,b).mask&~(m.bit('A1')|m.bit('E63')),old.pair(a,b).mask&~old.bit('E63'));
    if(m.pair(a,b).mask&m.bit('E9'))assert.ok(m.pair(a,b).mask&m.bit('A1'));
  }
  for(const [a,b] of [[73,75],[19,21],[27,48],[37,94]]){
    assert.ok(m.pair(a,b).mask&m.bit('A1'));assert.equal(m.pair(a,b).mask&m.bit('E9'),0);
  }
  for(const [a,b] of [[4,5],[1,2],[62,68]])assert.equal(m.pair(a,b).mask&m.bit('A1'),0);
  assert.equal(m.pair(4,14).mask,0);
  for(const [a,b] of r.legacyEndingPairs){assert.equal(m.pair(a,b).mask&m.bit('E63'),0);assert.ok(m.pair(a,b).mask&m.bit('E18'));}
  for(const [a,b] of [[19,20],[70,71],[77,80],[95,102],[101,108]])assert.ok(m.pair(a,b).mask&m.bit('E63'));
  for(const [a,b] of [[92,96],[92,103]])assert.equal(m.pair(a,b).mask&m.bit('E63'),0);
  // A pronunciation-dependent formal candidate must never borrow the wrong reading.
  const theOnly=m.pair(70,71).evidence.filter(w=>w.mask&m.bit('E63'));
  assert.ok(theOnly.length);
  for(const w of theOnly)assert.ok(w.readings.some(x=>x==='The = DH IY0'||x==='The = DH IY1'));
  // Preserved spelling and trite-rhyme classifications remain independently visible.
  assert.equal(m.count(m.bit('E66')),2);assert.equal(m.count(m.bit('H1')),scope==='annotated'?29:47);
}
assert.deepEqual(data.lines,original.lines);assert.deepEqual(data.tokenPronunciations,original.tokenPronunciations);
assert.equal(data.lines.reduce((n,l)=>n+l.pronunciation.length,0),128);
const once=JSON.stringify(context.window.POEM_DATA);vm.runInNewContext(read('dist/scope-refinement.js'),context);assert.equal(JSON.stringify(context.window.POEM_DATA),once);
const current=JSON.parse(read('dist/rhetoric-application.json'));
assert.equal(current.soundVerification.annotatedPositivePairs,create(data).count());
assert.equal(current.soundVerification.dictionaryUnionPositivePairs,create(make(data,'dictionary_union')).count());
assert.ok(current.findings.find(f=>f.id==='G01').labels.some(l=>l.name==='Shared English inflection'));
const endIds=new Set(data.lines.map(line=>line.wordIds.at(-1)));
for(const s of current.findings.find(f=>f.id==='S06').spans.filter(s=>s.label.startsWith('Line endings'))){
  for(const id of s.words)assert.ok(endIds.has(id),'Ending-rhyme group must highlight actual line endings');
  for(let i=0;i<s.words.length;i++)for(let j=i+1;j<s.words.length;j++)assert.ok(create(data).pair(s.words[i],s.words[j]).mask&create(data).bit('E63'));
}
console.log('PASS: 5,778 pairs in each mode; A1=235, unchanged E9=147, revised E63=34; all other pair labels and the complete pronunciation/meter grid preserved; five unsupported ending labels retired without losing E18; pronunciation-specific evidence and overlaps verified. Current connected pairs: '+create(data).count()+' / '+create(make(data,'dictionary_union')).count()+'.');
