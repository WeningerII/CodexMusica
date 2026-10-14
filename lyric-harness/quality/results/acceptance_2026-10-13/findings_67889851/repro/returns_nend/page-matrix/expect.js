// Expected outcome per cell, from the agreed policy and the cuts measured in
// cuts2.out (hard-coded here, not read from the page under test).
'use strict';
const CHANGED = { false: new Set([1, 2, 3, 4, 8]), true: new Set([1, 2, 3, 4, 7, 8]) };
// v1 page word k -> v2 word covering exactly the same characters (null: none).
const TMAP = {
  false: { 1: { T1: null, T2: 'T3', T4: 'T5' }, 2: { T1: 'T1', T5: null }, 3: { T2: null, T4: 'T5' }, 4: { T4: 'T4' }, 5: { T4: 'T4', T5: 'T5' }, 7: { T3: 'T3', T4: 'T4' }, 8: { T3: null, T4: 'T5' } },
  true: { 7: { T3: 'T3', T4: null, T5: 'T6' }, 8: { T3: 'T3', T5: null, T6: 'T7' } },
};
const C = '(carried across the word-cut change)';
const U = '(numbered under the earlier cut)';
function expect(c, mainRow) {
  const isT = /^T/.test(c.sp);
  const changed = CHANGED[c.voices].has(c.n);
  const key = c.key;
  const field = key === 'returns' ? 'returns' : 'groups';
  if (!isT) {
    const plain = c.sp === 'N' || c.sp === 'end' ? `${c.n}` : `${c.n}.${c.sp}`;
    if (changed)
      return { kind: 'carried', row: `[SETUP — ${key} — ${plain} ${C},${c.partner} — cut v2]`, notice: 'note:carried', sent: { [field]: `${plain},${c.partner}` }, blocked: false };
    return { kind: 'silent', row: mainRow, notice: null, sent: { [field]: `${c.member},${c.partner}` }, blocked: false };
  }
  const to = TMAP[c.voices][c.n][c.sp];
  if (to) return { kind: 'rebound', row: `[SETUP — ${key} — ${c.n}.${to},${c.partner} — cut v2]`, notice: null, sent: { [field]: `${c.n}.${to},${c.partner}` }, blocked: false, moved: to !== c.sp };
  return { kind: 'blocked', row: `[SETUP — ${key} — ${c.n}.${c.sp} ${U},${c.partner} — cut v2]`, notice: 'input:undecided', sent: null, needDecision: { [`${field}_need_decision`]: [`${c.n}.${c.sp} ${U},${c.partner}`] }, blocked: true };
}
module.exports = { expect, C, U, CHANGED };
