'use strict';
// Edge cases against the BUILT analysis chunk (library/code/analysis.9ebd86e5f8.js)
// loaded in a vm realm, with the tree's src/lyric-tokens.js as CMLyricTokens.
const fs = require('fs'), path = require('path'), vm = require('vm');
const TREE = process.argv[2];
const LT = require(path.join(TREE, 'src/lyric-tokens.js'));
let chunk = null;
const ctx = vm.createContext({ CMLyricTokens: LT, CMLibraryDefine: (n, f) => (chunk = f()), esc: String, icon: () => '', showToast() {}, uiDownload() {}, uiEmptyState: () => '', uiTabIndex: () => -1, crypto: globalThis.crypto, TextEncoder, console });
const file = fs.readdirSync(path.join(TREE, 'library/code')).filter((f) => f.startsWith('analysis.')).find((f) => fs.readFileSync(path.join(TREE, 'library/code', f), 'utf8').includes('savedInterpretation'));
vm.runInContext(fs.readFileSync(path.join(TREE, 'library/code', file), 'utf8'), ctx);
const A = chunk;
const P = (x) => JSON.parse(JSON.stringify(x));
const row = (line, token, word) => ({ line, token, word, phones: ['OW1'], basis: 'declared', source: 'bb8' });
const span = (line, tok) => { const t = LT.readerLine(line, { stripParens: false }).tokens[tok - 1]; return t ? `${t.text}@${JSON.stringify(t.pieces)}` : 'none'; };
const v1span = (line, tok) => { const s = LT.v1GraderSpans(line, false); const t = s && s[tok - 1]; return t ? `${t.text}@${JSON.stringify(t.pieces)}` : 'none'; };
const show = (label, stored) => {
  const s = P(A.savedInterpretation(stored));
  console.log(`\n## ${label}`);
  console.log('  kept:', JSON.stringify((s.declarations.pronunciations || []).map((r) => [r.word, r.token, span(r.line, r.token)])));
  console.log('  undecided:', JSON.stringify(s.undecided.map((u) => [u.row && u.row.word, u.row && u.row.token, u.reason])));
  console.log('  renumbered:', JSON.stringify(s.renumbered), ' notice:', A.renumberedNotice(s.renumbered));
  const body = A.analysisRequest({ reading_unit_id: 'u', reading_revision: 'r' }, s, null, 'k');
  console.log('  request:', body.refused ? 'REFUSED: ' + body.refused : 'sent ' + JSON.stringify(body.declaration_set.pronunciations?.map((r) => r.token)));
  return s;
};
console.log('chunk file:', file);
const NFD = 'belovèd love, bé mine';
console.log('E1 v1:', v1span(NFD, 1), ' v2:', span(NFD, 1));
show('E1 NFD-decomposed word, same span (v2 text is NFC)', { declarations: { pronunciations: [row(NFD, 1, 'belovèd'), row(NFD, 2, 'love')] } });
const OO = 'Oh--oh, oh, oh my love';
console.log('\nE2 v1 cut:', JSON.stringify(LT.v1GraderSpans(OO, false).map((s) => [s.text, s.pieces])));
console.log('E2 v2 cut:', JSON.stringify(LT.readerLine(OO, { stripParens: false }).tokens.map((t) => [t.text, t.pieces])));
const m = show('E2 double-oh: legacy v1 tokens 2 and 3', { declarations: { pronunciations: [row(OO, 2, 'oh'), row(OO, 3, 'oh')] } });
// E3: the migrated record re-saved WITHOUT the mark (as the retained old
// generation chunk analysis.71b110b249.js writes: device.set(key, {declarations: v}))
const migratedOne = P(A.interpretationRecord({ ...P(A.savedInterpretation({ declarations: { pronunciations: [row(OO, 2, 'oh')] } })) }));
console.log('\nE3 migrated record (new page):', JSON.stringify(migratedOne.declarations.pronunciations.map((r) => [r.token, span(r.line, r.token)])), 'token_cut', migratedOne.token_cut);
const reSaved = { declarations: migratedOne.declarations }; // old chunk onSave shape (main analysis.js: device.set(deviceKey, { declarations: v }))
show('E3 same record after an old-generation-chunk save drops token_cut, reopened on the new page', reSaved);
show('E5 token as a string', { declarations: { pronunciations: [row('Oh--oh, oh my love', '2', 'oh')] } });
show('E6 unmarked, no pronunciations', { declarations: { hooks: [{ text: 'x', source: 's' }] } });
show('E7 token_cut null', { declarations: { pronunciations: [row('Oh--oh, oh my love', 2, 'oh')] }, token_cut: null });
show('E8 word case mismatch', { declarations: { pronunciations: [row('Oh--oh, oh my love', 1, 'oh')] } });
show('E9 stored not an object', 'garbage');
show('E10 token 0 / beyond end', { declarations: { pronunciations: [row('Oh--oh, oh my love', 0, 'oh'), row('Oh--oh, oh my love', 9, 'oh')] } });
