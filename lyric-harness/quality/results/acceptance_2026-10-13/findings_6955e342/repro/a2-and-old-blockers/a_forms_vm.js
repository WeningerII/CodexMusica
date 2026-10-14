// (a) other member forms on the A.2-six lines, candidate page VM: bare N,
// N.end, N.endword, N.head, N.T<k> in returns and rhyme groups rows, migrated
// by lyMigrateSavedReadings, then the declaration the page builds for the wire
// (lyDeclarationsOf on the migrated text, if present). Usage: node a_forms_vm.js <tree> <out.json>
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const TREE = path.resolve(process.argv[2]); const OUT = process.argv[3];
const draft = { value: '' };
const app = { lyricMeta: { version: 1 }, history: ['before'], historyIndex: 0, lyrics: '' };
const ctx = vm.createContext({ console, $ui: (id) => (id === 'lyrics-draft' ? draft : null), uiRegisterPage: () => {},
  uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`, chatState: { generation: 0, lyric: null, busy: false }, UI: {}, app,
  lyricMetaOf: (v) => (v && v.version === 1 ? v : { version: 1, notes: {}, ui: {} }), uiAutosave: () => {},
  uiSaveLyrics: () => (app.lyrics = draft.value), sessionSnapshot: () => ({ lyrics: app.lyrics, lyricMeta: { ...app.lyricMeta } }),
  showToast: () => {}, _chatSend: () => Promise.resolve({ ok: true }), uiSwitchChat: () => false });
vm.runInContext(fs.readFileSync(path.join(TREE, 'src/lyric-tokens.js'), 'utf8'), ctx);
vm.runInContext(fs.readFileSync(path.join(TREE, 'src/pages/lyrics.js'), 'utf8'), ctx);
const run = (code, vars = {}) => { Object.assign(ctx, vars); return vm.runInContext(code, ctx); };
const RECEIPT = '/tmp/claude-0/-home-user-CodexMusica/29b3134b-089b-5de1-9704-33ac556c7f6b/scratchpad/wt-695/lyric-harness/quality/results/named_place_lookup_2026-10-14/result.json';
const receipt = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'));
const lines = [...receipt.lookup_differs.map((x) => x.line), 'We sing it plain tonight'];
const forms = ['1,2', '1.end,2.end', '1.endword,2.endword', '1.head,2.head', '1.headrime,2.headrime', '1.T3,2.T3', '1,2.end', '2,1.end'];
const hasDecl = run('typeof lyDeclarationsOf === "function"');
const rows = [];
for (const line of lines) for (const key of ['returns', 'rhyme groups']) for (const f of forms) {
  const t = `[SETUP — ${key} — ${f}]\n\n[VERSE]\n${line}\nWe sing it plain`;
  const got = run('lyMigrateSavedReadings(__t)', { __t: t });
  let decl = null;
  if (hasDecl) { try { decl = run('lyDeclarationsOf(lyParse(__t))', { __t: got.text }); } catch (e) { decl = 'ERR ' + e.message; } }
  const wire = decl && typeof decl === 'object' ? (key === 'returns' ? decl.returns : decl.groups) : decl;
  rows.push({ line, key, form: f, row_after: got.text.split('\n')[0], changed: got.text !== t, carried: got.carried.map((c) => `${c.n}.${c.place}`), moved: got.moved.length, blocked: got.blocked.length, wire });
}
fs.writeFileSync(OUT, JSON.stringify({ tree: TREE, hasDecl, rows }, null, 1));
const tally = {};
for (const r of rows) { const k = `${r.line === 'We sing it plain tonight' ? 'control' : 'A2line'}|${r.key}|${r.form} -> ${r.row_after.replace(/^\[SETUP — [a-z ]+ — /, '').replace(/\]$/, '')} || wire=${JSON.stringify(r.wire)}`; tally[k] = (tally[k] || 0) + 1; }
console.log(`hasDecl=${hasDecl}`); for (const [k, n] of Object.entries(tally)) console.log(String(n).padStart(3), k);
