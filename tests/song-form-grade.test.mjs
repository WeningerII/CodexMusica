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

test('measured bars belong to the observed division, even when arranged as a verse', () => {
  const pattern = {unit:'stanza',bars:16,children:[{unit:'line',times:4}]};
  const grade = sections => gradeObservations(form(pattern),'symbol',{lines:Array(4).fill('x'),sections});
  const outcome = report => report.checks.find(check=>check.kind==='bars').outcome;
  assert.equal(outcome(grade([{role:'verse',bars:16,lineSpan:[0,4]}])),'pass');
  assert.equal(outcome(grade([{role:'verse',bars:8,lineSpan:[0,4]}])),'fail');
  assert.equal(outcome(grade([{role:'verse',lineSpan:[0,4]}])),'unknown');
  assert.equal(outcome(grade([{role:'verse',bars:16,lineSpan:[0,2]}])),'unknown');
  assert.equal(outcome(grade(undefined)),'unknown');
});
test('a native wordless section needs both its measured bars and an empty sung span', () => {
  for (const role of ['solo','interlude']) {
    const pattern = {unit:'song',children:[{unit:'section',role:'verse'},{unit:'section',role,bars:8}]};
    const grade = (seen, verseSpan = [0,2]) => gradeObservations(form(pattern),'symbol',{
      lines:['x','y'],sections:[{role:'verse',lineSpan:verseSpan},{role,...seen}],
    });
    assert.equal(grade({bars:8,lineSpan:[2,2]}).verdict,'pass');
    assert.equal(grade({bars:7,lineSpan:[2,2]}).verdict,'fail');
    assert.equal(grade({lineSpan:[2,2]}).verdict,'unknown');
    assert.equal(grade({bars:8}).verdict,'unknown');
    const sung = grade({bars:8,lineSpan:[1,2]},[0,1]);
    assert.equal(sung.verdict,'fail');
    assert.ok(sung.checks.some(c=>c.kind==='section-lines' && c.expected===0 && c.actual===1 && c.outcome==='fail'));
    assert.equal(grade({bars:8,lineSpan:[3,3]}).verdict,'fail');
  }
});

test('a reader-only catalog model adds no native wordless arrangement obligation', () => {
  const pattern = {unit:'song',children:[{unit:'section',role:'part-a'},{unit:'section',role:'solo',bars:8}]};
  const reading = gradeObservations(form(pattern),'symbol',{
    lines:['x','y'],sections:[{role:'part-a',lineSpan:[0,1]},{role:'solo',bars:8,lineSpan:[1,2]}],
  });
  assert.ok(!reading.checks.some(c=>c.kind==='section-lines' && c.expected===0));
  assert.equal(reading.verdict,'pass');
});

test('a nested pair is judged by both observed boundaries and every line measurement', () => {
  const pattern = {unit:'stanza', children:Array.from({length:2}, () => ({
    unit:'quatrain', children:[{unit:'line', syllables:3, times:4}],
  }))};
  const lines = Array.from({length:8}, () => ({syllables:3}));
  const grade = (ends, observed=lines) => gradeObservations(form(pattern), 'symbol', {
    lines:observed, sections:ends.map((end,i)=>({role:'verse', lineSpan:[ends[i-1] ?? 0,end]})),
  });
  assert.equal(grade([4,8]).verdict,'pass');
  assert.equal(grade([3,8]).checks.filter(c=>c.kind==='line-span' && c.outcome==='fail').length,2);
  assert.equal(grade([8]).verdict,'fail');
  assert.equal(grade([4,8],[...lines.slice(0,7),{syllables:2}]).verdict,'fail');
});

test('letter counts use the supplied sung tokens and preserve uncertainty for unreadable text', () => {
  const pattern={unit:'stanza', children:[{unit:'line', times:2, children:[
    {unit:'word',children:[{unit:'letter',times:2}]},
  ]}]};
  const grade = row => gradeObservations(form(pattern), 'symbol', {lines:[row,row],sections:[{lineSpan:[0,2]}]});
  const known=grade({text:"(x) a-b",sungWords:["a-b"]});
  assert.equal(known.verdict,'pass');
  assert.deepEqual(known.checks.filter(c=>c.kind==='letter-count').map(c=>c.lines),[[1],[2]]);
  assert.equal(grade({text:'ab',sungWords:null}).verdict,'unknown');
});

test('terminal accent roles are measured from the observed stress even if the supplied role claims otherwise', () => {
  const shape = form({unit:'stanza',children:[
    {unit:'line',role:'masculine-ending'},{unit:'line',role:'feminine-ending'},
  ]});
  const check = (lines) => gradeObservations(shape,'symbol',{lines}).checks.filter(c=>c.kind==='role').map(c=>c.outcome);
  assert.deepEqual(check([{text:'a',stress:'../'},{text:'b',stress:'./.'}]),['pass','pass']);
  assert.deepEqual(check([{text:'a',stress:'/.',role:'masculine-ending'},{text:'b',stress:'...'}]),['fail','fail']);
  assert.deepEqual(check([{role:'masculine-ending'},{}]),['unknown','unknown']);
  assert.deepEqual(check([{role:'masculine-ending',stress:'../'},{role:'feminine-ending',stress:'./.'}]),['unknown','unknown']);
  const hex = form({unit:'stanza',children:[{unit:'line',role:'alexandrine',stresses:6}]});
  assert.equal(gradeObservations(hex,'symbol',{lines:[{text:'a',stress:'./'.repeat(6)}]}).verdict,'pass');
  assert.equal(gradeObservations(hex,'symbol',{lines:[{text:'a',stress:'/.'.repeat(6)}]}).verdict,'unknown');
});

test('the same printed line at the designated locations in distinct stanzas supplies the refrain evidence', () => {
  const pattern = {unit:'poem',children:[{unit:'stanza',times:2,children:[
    {unit:'line'}, {unit:'line',role:'refrain',returns:'x'},
  ]}]};
  const measure = lines => gradeObservations(form(pattern),'symbol',{
    lines,sections:[{role:'verse',lineSpan:[0,2]},{role:'verse',lineSpan:[2,4]}],
  }).checks.filter(c=>c.kind==='role').map(c=>c.outcome);
  assert.deepEqual(measure(['one','two','three','two']),['pass','pass']);
  assert.deepEqual(measure(['one','two','three','four']),['fail','fail']);
  assert.deepEqual(measure(['one','two','three',{}]),['unknown','unknown']);
  assert.deepEqual(measure(['one',{returns:'r'},'three',{returns:'r'}]),['unknown','unknown']);
  const local=form({unit:'stanza',children:[{unit:'line',role:'refrain',returns:'r',times:2}]});
  assert.equal(gradeObservations(local,'symbol',{lines:['x','x']}).verdict,'unknown');
});

test('measurable stanza roles require actual evidence for every line', async () => {
  const { readFileSync } = await import('node:fs');
  const { projectSongFormCreation } = await import('../src/song-form-creation.mjs');
  const { realizeForm } = await import('../src/song-forms.mjs');
  const catalog = JSON.parse(readFileSync(new URL('../data/song-forms.json', import.meta.url)));
  const cases = [
    { id: 'haiku', variant: 2, syllables: [5, 7, 5] },
    { id: 'englyn', variant: 0, syllables: [7, 7, 7] },
  ];
  for (const { id, variant, syllables } of cases) {
    const sections = [{ role: 'verse', lineSpan: [0, 3] }];
    const grade = lines => gradeObservations(catalog, id, { variant, lines, sections });
    const rows = syllables.map(value => ({ syllables: value, rhyme: 'x' }));
    const projected = projectSongFormCreation(realizeForm(catalog, id, { variant }));
    assert.equal(projected.status, 'ready');
    assert.deepEqual(projected.contract.lineRequirements.map(row => row.syllables), syllables);
    assert.equal(grade(rows).verdict, 'pass');
    assert.equal(grade([{}, ...rows.slice(1)]).verdict, 'unknown');
    assert.equal(grade([{ syllables: 8, rhyme: 'x' }, ...rows.slice(1)]).verdict, 'fail');
    if (id === 'englyn') {
      assert.deepEqual(projected.contract.rhymeGroups, [[1, 2, 3]]);
      assert.equal(grade([{ syllables: 7, rhyme: 'y' }, ...rows.slice(1)]).verdict, 'fail');
    }
  }
  const japanese = projectSongFormCreation(realizeForm(catalog, 'haiku', { variant: 0 }));
  assert.equal(japanese.status, 'unsupported');
  const selected = realizeForm(catalog, 'song-cycle', { counts: { '1.1': 2 } });
  assert.ok(projectSongFormCreation(selected).reasons.some(row => row.code === 'independent-song-required'));
});

test('a free stanza before each refrain and a short final envoi retain their score divisions', async () => {
  const { readFileSync } = await import('node:fs');
  const { projectSongFormCreation } = await import('../src/song-form-creation.mjs');
  const { realizeForm } = await import('../src/song-forms.mjs');
  const catalog = JSON.parse(readFileSync(new URL('../data/song-forms.json', import.meta.url)));
  const cases = [
    { id: 'camp-meeting-song', variant: 1, counts: { '1.1': 2 },
      widths: [4, 2, 4, 2], roles: ['verse', 'refrain', 'verse', 'refrain'] },
    { id: 'canzone', variant: 0, counts: { '1.1': 5, '1.1.1': 4, '1.2.1': 2 },
      widths: [4, 4, 4, 4, 4, 2], roles: ['verse', 'verse', 'verse', 'verse', 'verse', 'outro'] },
  ];
  for (const { id, variant, counts, widths, roles } of cases) {
    const p = projectSongFormCreation(realizeForm(catalog, id, { variant, counts }), counts);
    assert.equal(p.status, 'ready', id);
    assert.deepEqual(p.contract.sections.map(s => s.role), roles);
    let end = 0;
    const sections = p.contract.sections.map(({ role, divisionPath }, i) => ({
      role, divisionPath, lineSpan: [end, end += widths[i]],
    }));
    const lines = Array.from({ length: end }, () => ({ text: 'x' }));
    const grade = (sections, observed = lines) => gradeObservations(catalog, id, { variant, counts, lines: observed, sections });
    assert.equal(grade(sections).verdict, 'pass');
    if (id === 'camp-meeting-song') {
      const lastRefrain = sections.at(-1).lineSpan[0];
      const altered = lines.map((line, i) => i === lastRefrain ? { text: 'y' } : line);
      assert.equal(grade(sections, altered).verdict, 'fail');
      delete altered[lastRefrain].text;
      assert.equal(grade(sections, altered).verdict, 'unknown');
    }
    assert.equal(grade(sections.map(({divisionPath, ...rest}) => rest)).verdict, 'unknown');
    assert.equal(grade([...sections.slice(0, -1), { ...sections.at(-1), role: 'verse' }]).verdict, 'fail');
    const moved = sections.map(section => ({...section, lineSpan: [...section.lineSpan]}));
    moved[1].lineSpan[0] += 1;
    assert.equal(grade(moved).verdict, 'fail');
  }
  const equal = { '1.1': 5, '1.1.1': 2, '1.2.1': 2 };
  assert.equal(projectSongFormCreation(realizeForm(catalog, 'canzone', { variant: 0, counts: equal }), equal).status,
    'unsupported');
});

test('copied literary labels do not validate either the plan alone or a draft carrying the same labels', () => {
  for (const role of ['turn','wish','punchline','answer','first-speaker']) {
    const template = form({unit:'poem',children:[{unit:'line'},{unit:'line',role}]});
    for (const lines of [[{}, {role}], [{text:'one'}, {text:'two',role}], [{text:'one'}, {text:'two',role:'another'}]]) {
      const result = gradeObservations(template,'symbol',{lines});
      assert.equal(result.verdict,'unknown');
      assert.deepEqual(result.checks.filter(c=>c.kind==='role').map(c=>c.outcome),['unknown']);
    }
  }
});

test('a zero-count optional section counts only observed named sections outside the stanza carriers', () => {
  const pattern = {unit:'song',children:[
    {unit:'stanza',times:2,children:[{unit:'line',times:2}]},
    {unit:'section',role:'outro',times:[0,1]},
  ]};
  const args={counts:{'1.2':0},lines:['a','b','c','d']};
  const sections=[{role:'verse',lineSpan:[0,2]},{role:'verse',lineSpan:[2,4]}];
  const grade=sections=>gradeObservations(form(pattern),'symbol',{...args,sections});
  assert.equal(grade(sections).verdict,'pass');
  assert.equal(grade([sections[0],{...sections[1],role:'outro'}]).verdict,'fail');
  assert.equal(grade([{...sections[0],lineSpan:[0,1]},sections[1]]).verdict,'fail');
});

test('repeated cycles get only the spans supplied by their observed section instances', () => {
  const p = {unit:'song', children:[{unit:'cycle', times:2, children:['verse','chorus'].map(role => ({
    unit:'section', role, children:[{unit:'line',times:2}]}))}]};
  const lines = Array(8).fill({text:'a'});
  const sections = ['verse','chorus','verse','chorus'].map((role,i)=>({role,lineSpan:[2*i,2*i+2]}));
  const grade = (secs) => gradeObservations(form(p),'symbol',{lines,sections:secs});
  assert.equal(grade(sections).verdict,'pass');
  const missing = sections.map(({role})=>({role}));
  assert.equal(grade(missing).verdict,'unknown');
  const drift = structuredClone(sections);
  drift[1].lineSpan[1] = drift[2].lineSpan[0] = 3;
  assert.equal(grade(drift).verdict,'fail');
});

test('descending groups are located by their actual meter and sparse terminal rhymes', async () => {
  const { readFileSync } = await import('node:fs');
  const { projectSongFormCreation } = await import('../src/song-form-creation.mjs');
  const { realizeForm } = await import('../src/song-forms.mjs');
  const catalog = JSON.parse(readFileSync(new URL('../data/song-forms.json', import.meta.url)));
  const id = 'zeno';
  const measures = [8, 4, 2, 1, 4, 2, 1, 4, 2, 1];
  const rows = measures.map((syllables, index) => ({
    syllables, rhyme: syllables === 1 ? 'common' : String(index),
  }));
  const grade = (lines) => gradeObservations(catalog, id, {lines});
  const passed = grade(rows);
  assert.equal(passed.verdict, 'pass');
  assert.deepEqual(passed.checks.filter(c => c.kind === 'line-span').map(c => c.lines),
    [[2,3,4], [5,6,7], [8,9,10]]);
  const change = (index, value) => rows.map((row, i) => i === index ? value : row);
  assert.equal(grade(change(5, {syllables: 3})).verdict, 'fail');
  assert.equal(grade(change(5, {})).verdict, 'unknown');
  assert.equal(grade(change(6, {syllables: 1, rhyme:'other'})).verdict, 'fail');
  assert.equal(grade(change(6, {syllables: 1})).verdict, 'unknown');
  const projection = projectSongFormCreation(realizeForm(catalog, id));
  assert.equal(projection.contract, null);
  assert.ok(projection.reasons.some(r => r.code === 'native-free-word-reserve'));

  const shaped = form({unit:'stanza',children:[{unit:'line',syllables:6},
    {unit:'descent',children:[{unit:'line',syllables:4},{unit:'line',syllables:2}]}]});
  const arrange = projectSongFormCreation(realizeForm(shaped, 'symbol'));
  assert.deepEqual(arrange.contract.sections,[{unit:'section',role:'verse',lines:3}]);
  assert.deepEqual(arrange.contract.lineRequirements.map(line => line.syllables), [6,4,2]);
  const unmeasured = form({unit:'stanza',children:[{unit:'line'},{unit:'descent',role:'unspecified',
    children:[{unit:'line',syllables:3},{unit:'line',syllables:2}]}]});
  assert.equal(projectSongFormCreation(realizeForm(unmeasured,'symbol')).status,'unsupported');
});

test('measured identities use submitted words even when callers supply class labels', () => {
  const schema = form({unit:'stanza',children:['a','b','a','b'].map(id => ({
    unit:'line',endWord:id,returns:id,
  }))});
  const labels = ['a','b','a','b'].map(id=>({returns:id,endWord:id}));
  const grade = lines => gradeObservations(schema,'symbol',{lines});
  assert.equal(checkForm(schema,'symbol',{lines:labels}).verdict,'pass');
  assert.equal(grade(labels).verdict,'unknown');
  const rows = ['x','y','x','y'].map(text=>({text,returns:'c',endWord:'c'}));
  assert.equal(grade(rows).verdict,'pass');
  assert.equal(grade([{text:'z'},...rows.slice(1)]).verdict,'fail');
  assert.equal(grade([labels[0],...rows.slice(1)]).verdict,'unknown');
  assert.equal(grade(rows.map(row=>({...row,text:'x'}))).verdict,'fail');
});

test('Quatern measured CLI requires text at the four rotating return positions', async () => {
  const {spawnSync} = await import('node:child_process');
  const {fileURLToPath} = await import('node:url');
  const script = fileURLToPath(new URL('../scripts/song_forms.mjs',import.meta.url));
  const sections = [0,4,8,12].map(start=>({role:'verse',lineSpan:[start,start+4]}));
  const labels = Array.from({length:16},()=>({returns:'r'}));
  const run = (command, lines) => {
    const result = spawnSync(process.execPath,[script,command,'quatern'],{
      input:JSON.stringify({lines,sections}),encoding:'utf8',
    });
    assert.equal(result.status,0,result.stderr);
    return JSON.parse(result.stdout);
  };
  const outcomes = lines => run('grade-observations',lines).checks
    .filter(check=>check.kind==='returns').map(check=>check.outcome);
  assert.deepEqual(outcomes(labels),['unknown']);
  const printed = labels.map((row,i)=>({...row,text:i%5===0?'x':String(i)}));
  assert.deepEqual(outcomes(printed),['pass']);
  printed[15].text='y';
  assert.deepEqual(outcomes(printed),['fail']);
});

test('long and short roles compare two positioned readings without assuming a fixed meter', () => {
  const node = {unit:'stanza',children:['long-line','short-line'].map(role=>({unit:'line',role}))};
  const grade = (lengths,hasText=true) => gradeObservations(form(node),'symbol',{
    lines:lengths.map(syllables=>({...(hasText && {text:'x'}),syllables})),
    sections:[{role:'verse',lineSpan:[0,2]}],
  });
  for (const [lengths,expected] of [[[3,2],'pass'],[[7,5],'pass'],[[4,4],'fail'],[[2,3],'fail']]) {
    const result=grade(lengths); assert.equal(result.verdict,expected);
    assert.ok(result.checks.filter(c=>c.kind==='role').every(c=>c.outcome===expected));
  }
  assert.equal(grade([7,5],false).verdict,'unknown');
});

test('a syllable rhyme needs evidence at the prescribed position on each line', async () => {
  const { readFileSync } = await import('node:fs');
  const catalog = JSON.parse(readFileSync(new URL('../data/song-forms.json', import.meta.url)));
  const rows = ['yyxx','yyxy','yxyy'].map(text => ({
    text, syllables: 4, rhyme: 'terminal',
    syllableRimes: [...text].map(c=>c==='x'?'IH K':'AY'),
  }));
  const grade = lines => gradeObservations(catalog,'than-bauk',{lines});
  assert.equal(grade(rows).verdict, 'pass');
  const changed = structuredClone(rows);
  changed[1].syllableRimes[2] = 'AY';
  assert.equal(grade(changed).verdict, 'fail');
  changed[1].syllableRimes[2] = null;
  assert.equal(grade(changed).verdict, 'unknown');
  assert.equal(grade(rows.map(({syllableRimes, ...row}) => row)).verdict, 'unknown');
  assert.throws(() => grade([{...rows[0], syllableRimes:['AA']}, ...rows.slice(1)]),
    /Invalid aligned syllable rimes/);
});

test('printed phrase boundaries require local syllable and ending measurements', () => {
  const pattern={unit:'verse-unit',children:['A','A','B'].map(rhyme=>({unit:'phrase',rhyme,syllables:3}))};
  const grade = (lines, options={}) => gradeObservations(form(pattern),'symbol',{lines,...options});
  const rows=['x','x','y'].map((rhyme)=>({text:'x',rhyme,syllables:3}));
  assert.equal(grade(rows).verdict,'pass');
  assert.equal(grade([{...rows[0],syllables:2},...rows.slice(1)]).verdict,'fail');
  assert.equal(grade(rows.map(row=>({...row,rhyme:'x'}))).verdict,'fail');
  assert.equal(grade(rows.map(row=>({text:row.text}))).verdict,'unknown');
  assert.equal(grade([{text:'x'}]).verdict,'unknown');
  assert.equal(grade(rows.slice(0,2),{phraseLines:true}).verdict,'fail');
});
