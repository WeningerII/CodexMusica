const assert = require('node:assert/strict');
global.window = {};
require('../dist/data.js');
const data = window.POEM_DATA;
const model = require('../dist/model.js').create(data);

assert.equal(model.count(), 1572);
assert.equal(model.count(0), 0);
assert.deepEqual(model.labels(model.pair(1, 9).mask).map(c => c.id), ['E5', 'E7', 'E9', 'E10']);
assert.deepEqual(model.pair(9, 1), model.pair(1, 9));
for (const invalid of [[1,1],[0,1],[1,109],[1.1,2],[null,2]]) assert.equal(model.pair(...invalid), null);
for (const c of model.categories) {
  assert.equal(model.count(c.bit), data.counts.nonabsence_by_category[c.id]);
  if (c.unavailable) assert.equal(model.availableMask & c.bit, 0);
}
assert.deepEqual(model.related(1, model.bit('E7')).map(r => r.id), [9,25,58]);
assert.equal(model.count(model.bit('E3')), 75);
assert.equal(model.related(1, 0).length, 0);
const overlap = model.bit('E7') | model.bit('E9');
assert.deepEqual(model.related(1, overlap, 'all').map(r => r.id), [9,25,58]);
const exactAndEye = model.pair(17, 27);
assert.ok(exactAndEye.mask & model.bit('E1'));
assert.ok(exactAndEye.mask & model.bit('E20'));
assert.ok(exactAndEye.evidence.some(e => e.mask & model.bit('E1')));
assert.ok(exactAndEye.evidence.some(e => e.mask & model.bit('E20')));
for (const id of ['E12','E13','E14','E15']) {
  const [a,b] = data.pairs.find(([a,b,m]) => m & model.bit(id));
  assert.deepEqual(model.pair(a,b), model.pair(b,a), `${id} retains poem-order orientation`);
}
assert.equal(model.pair(8,30).mask & model.bit('E5'), 0, 'Empty coda agreement stays out of displayed matches');
console.log('PASS: model count/filter behavior, earlier-to-later lookup, opening connection, recorded reading evidence, absence filtering, and unavailable types.');
