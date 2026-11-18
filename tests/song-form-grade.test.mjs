import assert from 'node:assert/strict';
import test from 'node:test';
import {gradeObservations} from '../src/song-form-grade.mjs';
const form = node => [{id:'symbol',name:'Symbol',scope:'rule',patterns:[node]}];

test('compares measured line stress, counts, end-rhyme class identity and class distinction',()=>{
  const pattern = {unit:'stanza',children:['A','B','A','B'].map(rhyme=>({unit:'line',rhyme,stress:'./',syllables:2,stresses:1}))};
  const lines = ['x','y','x','y'].map(rhyme=>({text:'a b',rhyme,stress:'./'}));
  const run = lines=>gradeObservations(form(pattern),'symbol',{lines});
  assert.equal(run(lines).verdict,'pass');
  for(const kind of ['stress','syllables','stresses'])
    assert.ok(run([{text:'a',rhyme:'x',stress:'...'},...lines.slice(1)]).checks.some(c=>c.kind===kind && c.outcome==='fail'));
  assert.ok(run(lines.map(r=>({...r,rhyme:'x'}))).checks.some(c=>c.kind==='rhyme-distinct' && c.outcome==='fail'));
  assert.ok(run(lines.map(({text})=>({text}))).checks.some(c=>c.kind==='rhyme-distinct' && c.outcome==='unknown'));
});
test('compares declared section function, bars and partition independently of words',()=>{
  const pattern={unit:'song',children:['verse','chorus'].map(role=>({unit:'section',role,bars:2,children:[{unit:'line',times:2}]}))};
  const lines=['a','b','c','d'];
  const sections=[{role:'verse',bars:2,lineSpan:[0,2]},{role:'chorus',bars:2,lineSpan:[2,4]}];
  const run=sections=>gradeObservations(form(pattern),'symbol',{lines,sections});
  assert.equal(run(sections).verdict,'pass');
  const wrong=run([{role:'chorus',bars:1,lineSpan:[0,1]},sections[1]]);
  for(const k of ['role','bars','line-span']) assert.ok(wrong.checks.some(c=>c.kind===k && c.outcome==='fail'));
  assert.equal(run(undefined).verdict,'unknown');
});
