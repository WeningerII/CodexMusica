// Song generators with truth BY CONSTRUCTION (not read back from the page).
// "Oh--oh, oh my X": earlier cut  Oh--oh(1) oh(2) my(3) X(4)
//                    current cut  Oh(1) oh(2) oh(3) my(4) X(5)
// so an unmarked N.T2 -> T3 (oh), N.T3 -> T4 (my), N.T4 -> T5 (X): same characters.
'use strict';
const az = (k) => {
  let s = '';
  do { s = String.fromCharCode(97 + (k % 26)) + s; k = Math.floor(k / 26); } while (k > 0);
  return s;
};
const Q = (s) => JSON.stringify(s);
// N moved rhyme-group members, all on T4 (the unique last word): each member
// is its own one-member-moved pair "a.T4,b" (b bare: a bare N is a definition,
// carried silently on... no: b's line also changed cut, so b would be "carried").
// To avoid carried noise, pair two T4 members: "a.T4,b.T4" -> 2 moved entries.
function groupsSong(title, N, tag = 'w') {
  const sung = [];
  const truth = [];
  const pairs = [];
  for (let k = 0; k < N; k += 2) {
    const a = sung.push(`Oh--oh, oh my ${tag}${az(k)}`);
    const b = sung.push(`Oh--oh, oh my ${tag}${az(k + 1)}`);
    if (k + 1 < N) {
      pairs.push(`${a}.T4,${b}.T4`);
      truth.push({ kind: 'rhyme groups', word: `${tag}${az(k)}`, n: [a], from: 4, to: 5 });
      truth.push({ kind: 'rhyme groups', word: `${tag}${az(k + 1)}`, n: [b], from: 4, to: 5 });
    } else {
      // odd N: last one pairs with a T3 member of the same line (my 3 -> 4)
      pairs.push(`${a}.T4,${a}.T3`);
      truth.push({ kind: 'rhyme groups', word: `${tag}${az(k)}`, n: [a], from: 4, to: 5 });
      truth.push({ kind: 'rhyme groups', word: 'my', n: [a], from: 3, to: 4 });
    }
  }
  // one rhyme groups row, members separated by ';' (groups)
  const text = [`[SETUP — title — ${Q(title)}]`, `[SETUP — rhyme groups — ${pairs.join(';')}]`, '', '[VERSE]', ...sung].join('\n');
  return { text, truth: truth.slice(0, N % 2 ? N + 1 : N) };
}
module.exports = { az, Q, groupsSong };
