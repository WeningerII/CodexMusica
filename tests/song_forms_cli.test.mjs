import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {realizeForm} from '../src/song-forms.mjs';
import {formMandate, formMandateWire} from '../src/song-form-mandate.mjs';

function mandate(children) {
  const catalog = [{id:'shape', name:'Shape', scope:'rule', patterns:[{unit:'stanza', children}]}];
  return formMandate(realizeForm(catalog, 'shape'));
}
const line = fields => ({unit:'line', ...fields});

test('return identities exempt exact repetitions while requiring the independent rhyme', () => {
  const result = mandate([
    line({rhyme:'A', returns:'R', syllables:2}), line({rhyme:'A', returns:'R', endWord:'W'}),
    line({rhyme:'A', endWord:'W'}), line({rhyme:'A'}), line({rhyme:'B'}), line({rhyme:'B'}),
  ]);
  assert.equal(result.lineCount, 6);
  assert.deepEqual(result.lineConstraints, [{line:1, syllables:2}]);
  assert.deepEqual(result.rhymeGroups, [{symbol:'A', lines:[1,4]}, {symbol:'B', lines:[5,6]}]);
  assert.deepEqual(formMandateWire(result), {groups:'1,4;5,6', returns:'1,2;2.endword,3.endword'});
});

test('exact end words alone cannot supply a sound-class mandate', () => {
  const result = mandate([line({endWord:'E'}), line({endWord:'E'})]);
  assert.equal(result.returns, '1.endword,2.endword');
  assert.equal(result.groups, '');
  assert.deepEqual(result.returnGroups, []);
});

test('an opaque section preserves the known prefix and guards later line coordinates', () => {
  const result = mandate([line({rhyme:'A'}), line({rhyme:'A'}), {unit:'section', role:'solo'}, line({rhyme:'A', syllables:7})]);
  assert.equal(result.lineCount, null);
  assert.equal(result.minimumLines, 3);
  assert.equal(result.groups, '1,2');
  assert.equal(result.unpositioned.length, 1);
  assert.deepEqual(result.lineConstraints, []);
});

test('unordered simultaneous voices cannot produce absolute line declarations', () => {
  const result = mandate([{unit:'simultaneous', children:[line({returns:'R'}), line({returns:'R'})]}]);
  assert.equal(result.returns, '');
  assert.equal(result.unpositioned.length, 2);
  assert.equal(result.minimumLines, 0);
  assert.equal(result.lineCount, null);
  const after = mandate([{unit:'staggered-voices', children:[line({}), line({})]}, line({})]);
  assert.equal(after.minimumLines, 1);
  assert.equal(after.unpositioned.length, 3);
});

test('unresolved counts and deferred forms yield no mandate', () => {
  const catalog = [
    {id:'shape', name:'Shape', scope:'rule', patterns:[line({times:[1,3]})]},
    {id:'open', name:'Open', scope:'deferred', patterns:[]},
  ];
  for (const [id,status] of [['shape','needs-input'], ['open','deferred']]) {
    const result = formMandate(realizeForm(catalog,id));
    assert.equal(result.status,status);
    assert.equal(result.lineCount,null);
    assert.equal(result.groups,'');
    assert.equal(result.returns,'');
  }
});

const cli = fileURLToPath(new URL('../scripts/song_forms.mjs', import.meta.url));
function run(args, request) {
  const result = spawnSync(process.execPath, [cli,...args], {input: request ?? '', encoding:'utf8', cwd:fileURLToPath(new URL('.',import.meta.url))});
  if (result.error) throw result.error;
  return {status:result.status, body: JSON.parse((result.stdout || result.stderr).trim())};
}

test('canonical CLI list, describe and realize operate independently of cwd', () => {
  const listing = run([]);
  assert.equal(listing.status, 0);
  assert.ok(listing.body.some(row => row.id === 'couplet'));
  const descriptor = run(['describe','couplet']);
  assert.equal(descriptor.body.id, 'couplet');
  assert.ok(descriptor.body.variants.length);
  const plan = run([],JSON.stringify({command:'realize',id:'couplet',variant:1}));
  assert.equal(plan.status,0);
  assert.equal(plan.body.mandate.groups,'1,2');
});

test('canonical CLI distinguishes strict pass, failed evidence, unknown and invalid input', () => {
  const check = options => run(['check','couplet'], JSON.stringify(options));
  assert.equal(check({variant:1,lines:[{rhyme:'x'},{rhyme:'x'}]}).status, 0);
  assert.equal(check({variant:1,lines:[{rhyme:'x'},{rhyme:'y'}]}).status, 1);
  assert.equal(check({variant:1,lines:['1','2']}).status, 3);
  assert.equal(run(['realize','free-verse']).status, 3);
  assert.equal(run(['describe','no-such-form']).status, 2);
  assert.equal(run(['check','couplet'],'{').status, 2);
  assert.equal(check({unexpected:true}).status, 2);
});
