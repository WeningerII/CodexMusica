// (a) the candidate page's own lyLineCuts/lyLineCutChanged over the whole
// English song corpus, per line, both voice modes. Usage: node a_page_scan.js <tree> <out.tsv>
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const TREE = path.resolve(process.argv[2]); const OUT = process.argv[3];
const ctx = vm.createContext({ console, $ui: () => ({ value: '' }), uiRegisterPage: () => {}, uiCount: (n, w) => `${n} ${w}`,
  chatState: { generation: 0 }, UI: {}, app: { lyricMeta: { version: 1 }, history: [], historyIndex: 0, lyrics: '' },
  lyricMetaOf: (v) => v, uiAutosave: () => {}, uiSaveLyrics: () => {}, sessionSnapshot: () => ({}), showToast: () => {},
  _chatSend: () => Promise.resolve({}), uiSwitchChat: () => false });
vm.runInContext(fs.readFileSync(path.join(TREE, 'src/lyric-tokens.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(TREE, 'src/pages/lyrics.js'), 'utf8'), ctx);
const cutsFn = vm.runInContext('lyLineCuts', ctx); const firesFn = vm.runInContext('lyLineCutChanged', ctx);
const ident = (c) => !!c.old && c.old.length === c.cur.length && c.old.every((o, k) => o.text === c.cur[k].text && JSON.stringify(o.pieces) === JSON.stringify(c.cur[k].pieces));
const dir = path.join(TREE, 'lyric-harness/corpus/song');
const rows = []; const t0 = Date.now();
for (const f of fs.readdirSync(dir).filter((x) => /^eng_.*\.txt$/.test(x)).sort()) {
  const raws = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  raws.forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('#') || l.startsWith('---') || l.startsWith('[')) return;
    const io = ident(cutsFn(l, false)), fo = firesFn(l, false);
    const in_ = ident(cutsFn(l, true)), fn = firesFn(l, true);
    // lookup flag as the harness file encodes it: only on identical cut
    rows.push(`${f}\t${i}\t${+io}\t${+(io && fo)}\t${+in_}\t${+(in_ && fn)}\t${+fo}\t${+fn}`);
  });
}
fs.writeFileSync(OUT, rows.join('\n') + '\n');
const col = (k) => rows.filter((r) => r.split('\t')[k] === '1').length;
console.log(JSON.stringify({ lines: rows.length, identical_off: col(2), fires_on_identical_off: col(3), identical_on: col(4), fires_on_identical_on: col(5), fires_off_total: col(6), fires_on_total: col(7), secs: (Date.now() - t0) / 1000 }, null, 1));
