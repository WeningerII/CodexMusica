import assert from 'node:assert/strict';
import test from 'node:test';
import {gradeObservations} from '../src/song-form-grade.mjs';
import {checkForm} from '../src/song-forms.mjs';
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

test('a musical partition supplies the boundaries of ordered neutral divisions', () => {
  const pattern = {unit:'poem',children:[{unit:'tercet',times:2,children:[{unit:'line',times:3}]}]};
  const lines = Array(6).fill({});
  const grade = sections => gradeObservations(form(pattern),'symbol',{lines,sections});
  const partition = ends => ends.map((end,i) => ({role:'verse',lineSpan:[ends[i-1] ?? 0,end]}));
  const good = grade(partition([3,6]));
  assert.equal(good.verdict,'pass');
  assert.ok(good.checks.every(c => c.kind !== 'role'));
  const shifted = grade(partition([2,6]));
  assert.equal(shifted.verdict,'fail');
  assert.equal(shifted.checks.filter(c => c.kind==='line-span' && c.outcome==='fail').length,2);
  assert.equal(grade(partition([6])).verdict,'fail');
  assert.equal(grade(undefined).verdict,'unknown');
  assert.equal(grade([{role:'verse'},{role:'verse'}]).verdict,'unknown');
});

test('fixed lines are checked within their actual section beside free-length sections', () => {
  const pattern = {unit:'song',children:[{unit:'cycle',times:2,children:[
    {unit:'section',role:'verse'},
    {unit:'section',role:'prechorus',children:[{unit:'line',times:2}]},
    {unit:'section',role:'chorus'},
  ]}]};
  const lines = Array(12).fill({});
  const sections = ends => ends.map((end,i) => ({
    role:['verse','prechorus','chorus'][i % 3],lineSpan:[ends[i-1] ?? 0,end],
  }));
  const grade = observed => gradeObservations(form(pattern),'symbol',{lines,sections:observed});
  const passed = grade(sections([1,3,5,8,10,12]));
  assert.equal(passed.verdict,'pass');
  assert.deepEqual(passed.checks.filter(c=>c.kind==='section-lines').map(c=>c.lines),[[2,3],[9,10]]);
  const drift = grade(sections([1,2,5,8,11,12]));
  assert.equal(drift.verdict,'fail');
  const failed = drift.checks.filter(c=>c.kind==='section-lines' && c.outcome==='fail');
  assert.deepEqual(failed.map(c=>c.actual),[1,3]);
  assert.deepEqual(failed.map(c=>c.lines),[[2],[9,10,11]]);
  assert.equal(grade(sections([1,3,5,8,10,13])).verdict,'fail');
  const missing = sections([1,3,5,8,10,12]);
  delete missing[1].lineSpan;
  assert.equal(grade(missing).verdict,'unknown');
  assert.equal(grade(undefined).verdict,'unknown');
});

test('partial coordinates with a line-level requirement are never certified from counts alone', () => {
  const pattern = {unit:'song',children:[
    {unit:'section',role:'verse'},{unit:'section',role:'chorus',children:[{unit:'line',syllables:4}]},
  ]};
  const verdict = gradeObservations(form(pattern),'symbol',{
    lines:[{},{},{}],sections:[{role:'verse',lineSpan:[0,2]},{role:'chorus',lineSpan:[2,3]}],
  });
  assert.equal(verdict.verdict,'unknown');
});

test('sung words measure native counts while exact returns retain the printed line', () => {
  const unit = {unit:'line',children:[{unit:'word'}],returns:'R',endWord:'E'};
  const schema = form({unit:'stanza',children:[unit,unit]});
  const run = lines => gradeObservations(schema,'symbol',{lines});
  const silent = {text:'one (two)',sungWords:['one']};
  const voiced = {...silent,sungWords:['one','two']};
  assert.equal(run([silent,silent]).verdict,'pass');
  assert.ok(run([voiced,voiced]).checks.some(c=>c.kind==='word-count' && c.outcome==='fail' && c.actual===2));
  const changed = run([silent,{text:'one (three)',sungWords:['one']}]);
  assert.ok(changed.checks.some(c=>c.kind==='returns' && c.outcome==='fail'));
  assert.ok(changed.checks.some(c=>c.kind==='endWord' && c.outcome==='pass'));
  const unknown = run([silent,{text:'one 我',sungWords:null}]);
  assert.ok(unknown.checks.some(c=>c.kind==='word-count' && c.outcome==='unknown'));
  // Plain checks always interpret the supplied text through their own tokenizer.
  assert.ok(checkForm(schema,'symbol',{lines:[silent,silent]}).checks.some(c=>c.kind==='word-count' && c.outcome==='fail'));
  assert.throws(()=>checkForm(schema,'symbol',{lines:[{...silent,words:1},silent]}),/Inconsistent words/);
});
