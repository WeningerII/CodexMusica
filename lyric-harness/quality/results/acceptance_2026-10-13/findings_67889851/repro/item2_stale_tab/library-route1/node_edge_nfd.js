'use strict';
// E1 corrected: an NFD line, with legacy rows numbered as the v1 grader numbered them.
const path = require('path'), fs = require('fs'), vm = require('vm');
const TREE = process.argv[2];
const LT = require(path.join(TREE, 'src/lyric-tokens.js'));
let A; const ctx = vm.createContext({ CMLyricTokens: LT, CMLibraryDefine: (n, f) => (A = f()), esc: String, icon: () => '', showToast() {}, uiDownload() {}, uiEmptyState: () => '', uiTabIndex: () => -1, crypto: globalThis.crypto, TextEncoder, console });
vm.runInContext(fs.readFileSync(path.join(TREE, 'library/code/analysis.9ebd86e5f8.js'), 'utf8'), ctx);
const NFD = 'belovèd love, bé mine';
const v1 = LT.v1GraderSpans(NFD, false).map((s) => [s.text, s.pieces]);
const v2 = LT.readerLine(NFD, { stripParens: false }).tokens.map((t) => [t.text, t.pieces]);
console.log('v1', JSON.stringify(v1)); console.log('v2', JSON.stringify(v2));
const row = (token, word) => ({ line: NFD, token, word, phones: ['OW1'], basis: 'declared', source: 'bb8' });
const s = JSON.parse(JSON.stringify(A.savedInterpretation({ declarations: { pronunciations: [row(1, 'belove'), row(3, 'love'), row(5, 'mine')] } })));
console.log('kept', JSON.stringify(s.declarations.pronunciations.map((r) => [r.word, r.token])));
console.log('undecided', JSON.stringify(s.undecided.map((u) => [u.row.word, u.row.token, u.reason])));
console.log('renumbered', JSON.stringify(s.renumbered));
