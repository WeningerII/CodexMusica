import test from 'node:test';
import assert from 'node:assert/strict';
import {describeForm, realizeForm, checkForm} from '../src/song-forms.mjs';

const node = (unit, extra = {}) => ({unit, ...extra});
const lines = (...entries) => node('stanza', {children:entries.map(e => node('line',e))});
const make = (...patterns) => [{id:'f', name:'F', scope:'rule', patterns}];
const check = (catalog, options) => checkForm(catalog,'f',options);
const realize = (catalog, options) => realizeForm(catalog,'f',options);
const symbolText = n => Array.from({length:n}, (_,i) => 'w'+i).join(' ');

test('selection is explicit, stable, and does not mutate source templates', () => {
  const catalog = make(lines({}),lines({},{}));
  const d = describeForm(catalog,'f');
  assert.deepEqual(d.variants.map(v => v.index),[0,1]);
  d.patterns[0].unit = 'changed';
  assert.equal(catalog[0].patterns[0].unit,'stanza');
  const p = realize(catalog);
  assert.equal(p.status,'needs-input');
  assert.deepEqual(p.needs,[{kind:'variant',choices:[0,1]}]);
  assert.deepEqual(p.tree,[]);
  assert.equal(check(catalog,{lines:[{}]}).verdict,'unknown');
  assert.equal(realize(catalog,{variant:1}).lines.length,2);
  assert.throws(() => realize(catalog,{variant:2}),/variant/);
});

test('a template path applies for every occurrence, with half-open spans and one-based line positions', () => {
  const catalog = make(node('poem',{children:[node('stanza',{times:[1,null],children:[node('line',{times:[1,4]})]})]}));
  assert.deepEqual(realize(catalog).needs.map(c=>c.path),['1.1','1.1.1']);
  const counts = {'1.1':2,'1.1.1':3};
  const p = realize(catalog,{counts});
  assert.equal(p.status,'ready');
  assert.deepEqual(p.tree[0].span,{nodes:[0,9],lines:[0,6],sections:[0,0]});
  assert.deepEqual(p.tree[0].children.map(c=>c.span.lines),[[0,3],[3,6]]);
  assert.equal(p.lines[3].index,4);
  assert.equal(p.lines[3].address,'1[1].1[2].1[1]');
  assert.equal(p.lines[3].path,'1.1.1');
  assert.equal(p.coverage.lines,'complete');
  assert.throws(() => realize(catalog,{counts:{...counts,'1.1.1':5}}),/count/);
  assert.throws(() => realize(catalog,{counts:{...counts,'2.1':2}}),/count/);
});

test('a skipped optional branch requires no choices in its inactive descendants', () => {
  const catalog = make(node('poem',{children:[
    node('stanza',{times:[0,1],children:[node('line',{times:[2,null]})]}),node('line')
  ]}));
  const p = realize(catalog,{counts:{'1.1':0}});
  assert.equal(p.status,'ready');
  assert.deepEqual(p.lines.map(l=>l.path),['1.2']);
  assert.deepEqual(p.needs,[]);
});

test('input guards reject unsupported features, duplicates, invalid depths, and runaway expansions', () => {
  assert.throws(() => describeForm([], 'missing'),/Unknown form/);
  const catalog = make(lines({}));
  assert.throws(() => describeForm([...catalog,...catalog],'f'),/Duplicate/);
  for (const n of [node('line',{times:[2,1]}),node('line',{times:-1}),node('line',{arbitrary:true}),
    node('line',{stress:'abc'}),node('line',{stress:'./',syllables:4}),node('line',{children:[node('line')]})]) {
    assert.throws(() => realize(make(n)),TypeError);
  }
  const cyclic = node('stanza');cyclic.children=[cyclic];
  assert.throws(() => realize(make(cyclic)),/limit/);
  assert.throws(() => realize(make(node('line',{times:[0,null]})),{counts:{1:999999}}),/limit/);
  assert.throws(() => check(catalog,{lines:['']}),/nonblank/);
  assert.throws(() => check(catalog,{lines:['1\n2']}),/nonblank/);
  assert.throws(() => check(catalog,{units:{'8[1]':{}}}),/address/);
});

test('roles and bars require observations, including when a model is a particular setting', () => {
  const catalog = make(node('song',{children:[
    node('section',{role:'a',bars:3}),node('section',{role:'b',bars:2})
  ]}));
  catalog[0].scope='setting';
  const r=check(catalog,{sections:[{role:'a',bars:3},{role:'b',bars:2}]});
  assert.equal(r.verdict,'pass');
  assert.equal(r.scope,'setting');
  assert.equal(r.coverage.lines,'none');
  assert.equal(check(catalog,{sections:['a','b']}).verdict,'unknown');
  assert.equal(check(catalog,{sections:['b','a']}).verdict,'fail');
  assert.equal(check(catalog,{lines:[{}],sections:[{role:'a',bars:3},{role:'b',bars:2}]}).verdict,'unknown');
});

test('unknown line material does not shift later known lines onto the wrong observations', () => {
  const catalog=make(node('song',{children:[node('line',{syllables:2}),node('section'),node('line',{syllables:7})]}));
  const p=realize(catalog);
  assert.deepEqual(p.lines.map(l=>l.positionKnown),[true,false]);
  assert.equal(p.coverage.lines,'partial');
  const r=check(catalog,{lines:[{syllables:2},{syllables:4},{syllables:7}],sections:[{}]});
  assert.equal(r.verdict,'unknown');
  assert.ok(r.checks.some(c=>c.kind==='syllables'&&c.outcome==='unknown'));
  assert.equal(check(catalog,{lines:[{syllables:4}]}).verdict,'fail');
});

test('line count cannot verify grouped stanza boundaries', () => {
  const catalog=make(node('poem',{children:[lines({},{}),lines({}, {})]}));
  const opts={lines:[{},{},{},{}]};
  assert.equal(check(catalog,opts).verdict,'unknown');
  const units={'1[1].1[1]':{lineSpan:[0,2]},'1[1].2[1]':{lineSpan:[2,4]}};
  assert.equal(check(catalog,{...opts,units}).verdict,'pass');
  assert.equal(check(catalog,{...opts,units:{...units,'1[1].2[1]':{lineSpan:[1,4]}}}).verdict,'fail');
});

test('simultaneous voices do not establish a serial order for singing their lines', () => {
  const catalog=make(node('simultaneous',{children:[node('line',{syllables:2}),node('line',{syllables:4})]}));
  assert.deepEqual(realize(catalog).lines.map(l=>l.positionKnown),[false,false]);
  assert.equal(check(catalog,{lines:[{syllables:4},{syllables:2}]}).verdict,'unknown');
});

test('syllabic and stress evidence may be measured or missing', () => {
  const catalog = make(lines({syllables:4,stresses:2,stress:'././'}));
  assert.equal(check(catalog,{lines:[{stress:'././'}]}).verdict,'pass');
  assert.equal(check(catalog,{lines:[{syllables:4,stresses:2}]}).verdict,'unknown');
  assert.equal(check(catalog,{lines:[{stress:'/./.'}]}).verdict,'fail');
  assert.equal(check(catalog,{lines:[symbolText(4)]}).verdict,'unknown');
});

test('word-count patterns are measured from words and mora counts require their own observations', () => {
  const counted=(unit, counts)=>make(lines(...counts.map(times=>({children:[node(unit,{times})]}))));
  for (const counts of [[1,2,3],[3,5,3]]) {
    const catalog=counted('word',counts);
    assert.equal(check(catalog,{lines:counts.map(symbolText)}).verdict,'pass');
    assert.equal(check(catalog,{lines:counts.map(()=>symbolText(1))}).verdict,'fail');
    assert.equal(check(catalog,{lines:counts.map(words=>({words}))}).verdict,'pass');
    assert.equal(check(catalog,{lines:counts.map(()=>({}))}).verdict,'unknown');
  }
  const c=counted('mora',[5]);
  assert.equal(check(c,{lines:[{syllables:5}]}).verdict,'unknown');
  assert.equal(check(c,{lines:[{moras:5}]}).verdict,'pass');
  assert.equal(check(c,{lines:[{moras:4}]}).verdict,'fail');
});

test('rhyme identities are observed, preserve distinct groups, and include interior syllables', () => {
  const catalog=make(lines({rhyme:'A'},{rhyme:'B',children:[node('syllable',{rhyme:'A'})]}));
  const p=realize(catalog);
  const inner=p.tree[0].children[1].children[0];
  assert.equal(inner.lineIndex,2);
  const opts={lines:[{rhyme:'one'},{rhyme:'two',syllables:1}],units:{[inner.address]:{rhyme:'one'}}};
  assert.equal(check(catalog,opts).verdict,'pass');
  const split=check(catalog,{...opts,units:{[inner.address]:{rhyme:'three'}}});
  assert.ok(split.checks.some(c=>c.kind==='rhyme'&&c.outcome==='fail'&&c.addresses.includes(inner.address)));
  const collapsed=check(catalog,{...opts,lines:[{rhyme:'one'},{rhyme:'one',syllables:1}]});
  assert.ok(collapsed.checks.some(c=>c.kind==='rhyme-distinct'&&c.outcome==='fail'));
  assert.equal(check(catalog,{lines:[symbolText(1),symbolText(1)]}).verdict,'unknown');
});

test('terminal-word permutations and whole-line returns have independent identities', () => {
  const catalog=make(lines({returns:'x',endWord:'A'},{endWord:'B'},{returns:'x',endWord:'A'}));
  const first='s1 t1', other='s2 t2';
  assert.equal(check(catalog,{lines:[first,other,first]}).verdict,'pass');
  const changed=check(catalog,{lines:[first,other,'s3 t1']});
  assert.equal(changed.checks.find(c=>c.kind==='returns').outcome,'fail');
  assert.equal(changed.checks.find(c=>c.kind==='endWord').outcome,'pass');
  assert.equal(check(catalog,{lines:[first,'s2 t1',first]}).verdict,'fail');
  assert.equal(check(catalog,{lines:[{returns:'class',endWord:'word'},{endWord:'other'},first]}).verdict,'unknown');
});

test('missing evidence for roles, quantities and isolated labels cannot produce a pass', () => {
  const c=make(lines({role:'pivot',children:[node('long-syllable')]}));
  assert.equal(check(c,{lines:[{role:'pivot',syllables:1}]}).verdict,'unknown');
  assert.equal(check(c,{lines:[{role:'pivot'}],units:{'1[1].1[1].1[1]':{unit:'short-syllable'}}}).verdict,'fail');
  assert.equal(check(make(lines({rhyme:'A'})),{lines:[{rhyme:'r'}]}).verdict,'unknown');
  const deferred=[{id:'f',name:'F',scope:'deferred',patterns:[]}];
  assert.equal(check(deferred,{lines:[{}]}).verdict,'unknown');
  assert.equal(realize(deferred).status,'deferred');
});

test('individual words can have different lengths inside a repeated template', () => {
  const c=make(node('line',{children:[
    node('word',{times:3,children:[node('letter',{times:[1,5]})]})
  ]}));
  const second='1[1].1[2].1', third='1[1].1[3].1';
  const counts={'1.1.1':1,[second]:2,[third]:3};
  const p=realize(c,{counts});
  assert.deepEqual(p.tree[0].children.map(w=>w.children.length),[1,2,3]);
  const text=[1,2,3].map(n=>'q'.repeat(n)).join(' ');
  assert.equal(check(c,{counts,lines:[text]}).verdict,'pass');
  assert.equal(check(c,{counts:{'1.1.1':1},lines:[text]}).verdict,'fail');
  const some=realize(c,{counts:{[second]:2,[third]:3}});
  assert.equal(some.status,'needs-input');
  assert.deepEqual(some.tree,[]);
  assert.equal(some.needs[0].occurrencePath,'1[1].1[1].1');
  assert.equal(realize(c,{counts:{'1[1].1[1].1':1,[second]:2,[third]:3}}).status,'ready');
  assert.throws(()=>realize(c,{counts:{...counts,'1[1].1[4].1':1}}),/inactive/);
  assert.throws(()=>realize(c,{counts:{...counts,[second]:6}}),/count/);
});

test('closing refrain text can recur across lines without requiring the whole lines to repeat', () => {
  const c=make(node('stanza',{children:[node('line',{times:2,children:[
    node('segment',{rhyme:'k'}),node('phrase',{role:'tail',returns:'r'})
  ]})]}));
  const observations=['s1 q','s2 q'];
  const units={};
  for (const l of realize(c).tree[0].children) {
    units[l.children[0].address]={unit:'segment',rhyme:'x'};
    units[l.children[1].address]={unit:'phrase',role:'tail',text:'q'};
  }
  assert.equal(check(c,{lines:observations,units}).verdict,'pass');
  const mismatched=check(c,{lines:['s1 q','s2 z'],units});
  assert.ok(mismatched.checks.some(c=>c.kind==='closing-phrase' && c.outcome==='fail'));
  const changed=check(c,{lines:['s1 q','s2 z'],units:{...units,'1[1].1[2].2[1]':{unit:'phrase',role:'tail',text:'z'}}});
  assert.ok(changed.checks.some(c=>c.kind==='returns' && c.outcome==='fail'));
  assert.equal(check(c,{lines:observations}).verdict,'unknown');
});

test('parallel parts do not impose their sum or a fictitious position on later transcript lines', () => {
  for (const parallel of ['simultaneous','staggered-voices']) {
    const c=make(node('song',{children:[node('line'),node(parallel,{children:[node('line'),node('line')]}),node('line')]}));
    const p=realize(c);
    assert.equal(p.coverage.lines,'partial');
    assert.equal(p.minimum.lines,2);
    assert.deepEqual(p.lines.map(l=>l.positionKnown),[true,false,false,false]);
    assert.equal(check(c,{lines:[{},{},{}]}).verdict,'unknown');
  }
});
