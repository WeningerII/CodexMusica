// The matrix: rows written the pre-batch way, one isolated link per cell.
'use strict';
const LINES = [
  'Oh--oh, oh my love', // 1 changed: only word 1 re-cut (head changed; end "love" same chars)
  'Thundered the battery’s double bass--', // 2 changed: last word re-cut (bass-- -> bass)
  'My love--love is true', // 3 changed: only a middle word re-cut (head/end same)
  'You hold my heart.    10', // 4 changed: numeral end only v2 reads
  'I walk the line tonight', // 5 unchanged
  'Well-worn shoes upon the floor', // 6 unchanged (partner line)
  'Stay with me (oh--oh) tonight', // 7 aside: changed only inside the aside
  'Hold me (hold me) close--close tonight', // 8 aside + re-cut outside the aside
];
const TEXT = `[VERSE]\n${LINES.slice(0, 4).join('\n')}\n\n[CHORUS]\n${LINES.slice(4).join('\n')}`;
const NAMED = ['N', 'end', 'endword', 'head', 'headrime', 'line'];
const T_OFF = { 1: ['T1', 'T2', 'T4'], 2: ['T1', 'T5'], 3: ['T2', 'T4'], 4: ['T4'], 5: ['T4', 'T5'], 7: ['T3', 'T4'], 8: ['T3', 'T4'] };
const T_ON = { 7: ['T3', 'T4', 'T5'], 8: ['T3', 'T5', 'T6'] };
const KEYS = ['rhyme groups', 'returns'];
const PARTNER = { 'rhyme groups': ['6', 6, 'end'], returns: ['6.head', 6, 'head'] };
// Which spellings the baseline page's own forms can write.
const FORM = { 'rhyme groups': new Set(['N', 'endword', 'head', 'headrime', 'line', 'T']), returns: new Set(['endword', 'head', 'line', 'T']) };
const member = (n, sp) => (sp === 'N' ? `${n}` : `${n}.${sp}`);
function cells() {
  const out = [];
  for (const key of KEYS)
    for (const [voices, lines, tl] of [
      [false, [1, 2, 3, 4, 5, 7, 8], T_OFF],
      [true, [7, 8], T_ON],
    ])
      for (const n of lines)
        for (const sp of [...NAMED, ...tl[n]]) {
          const isT = /^T/.test(sp);
          const viaForm = FORM[key].has(isT ? 'T' : sp);
          out.push({
            id: `${key === 'returns' ? 'R' : 'G'}|v${voices ? 1 : 0}|L${n}|${sp}`,
            key, voices, n, sp, member: member(n, sp), partner: PARTNER[key][0],
            formPlace: sp === 'N' ? 'end' : sp, viaForm,
          });
        }
  return out;
}
module.exports = { LINES, TEXT, cells, PARTNER };
if (require.main === module) { const c = cells(); console.log(c.length, 'cells'); for (const x of c) console.log(x.id, x.member + ',' + x.partner, x.viaForm ? 'form' : 'hand'); }
