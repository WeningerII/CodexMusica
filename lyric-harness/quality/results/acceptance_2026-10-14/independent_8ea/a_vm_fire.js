// (a) A.2-six: run a tree's own lyLineCutChanged (src/pages/lyrics.js with
// src/lyric-tokens.js loaded first, as the bundle and check_lyrics_page's
// unit VM do) over BB8's 8 union lines + R2's 24 receipt lines + the 7
// NFC-only lines (controls). Usage: node a_vm_fire.js <tree> <out.json>
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const TREE = path.resolve(process.argv[2]);
const OUT = process.argv[3];
const UNION = path.join(process.env.EVIDENCE_ROOT || '/workspace/acceptance-evidence', 'lyric-harness/quality/results/acceptance_2026-10-13/findings_67889851/six_lines/union.json');
const RECEIPT = path.join(TREE, 'lyric-harness/quality/results/named_place_lookup_2026-10-14/result.json');
const draft = { value: '' };
const app = { lyricMeta: { version: 1 }, history: ['before'], historyIndex: 0, lyrics: '' };
const ctx = vm.createContext({
  console,
  $ui: (id) => (id === 'lyrics-draft' ? draft : null),
  uiRegisterPage: () => {},
  uiCount: (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`,
  chatState: { generation: 0, lyric: null, busy: false },
  UI: {}, app,
  lyricMetaOf: (v) => (v && v.version === 1 ? v : { version: 1, notes: {}, ui: {} }),
  uiAutosave: () => {}, uiSaveLyrics: () => (app.lyrics = draft.value),
  sessionSnapshot: () => ({ lyrics: app.lyrics, lyricMeta: { ...app.lyricMeta } }),
  showToast: () => {}, _chatSend: () => Promise.resolve({ ok: true }), uiSwitchChat: () => false,
});
vm.runInContext(fs.readFileSync(path.join(TREE, 'src/lyric-tokens.js'), 'utf8'), ctx, { filename: 'src/lyric-tokens.js' });
vm.runInContext(fs.readFileSync(path.join(TREE, 'src/pages/lyrics.js'), 'utf8'), ctx, { filename: 'src/pages/lyrics.js' });
const run = (code, vars = {}) => { Object.assign(ctx, vars); return vm.runInContext(code, ctx); };
const union = JSON.parse(fs.readFileSync(UNION, 'utf8')).rows;
const receipt = JSON.parse(fs.readFileSync(RECEIPT, 'utf8'));
const lines = new Map();
const add = (line, src) => { if (!lines.has(line)) lines.set(line, new Set()); lines.get(line).add(src); };
for (const r of union) add(r.text, 'union:' + r.found_by.join('+'));
for (const r of receipt.lookup_differs) add(r.line, 'receipt.lookup_differs' + (r.end_changed ? '(end_changed)' : ''));
for (const r of receipt.end_changed) add(r.line, 'receipt.end_changed');
for (const r of receipt.label_nfc_only) add(r.line, 'receipt.label_nfc_only');
const hasLookup = run('typeof CMLyricTokens.v1GraderLookup === "function"');
const rows = [];
for (const [line, srcs] of lines) {
  const out = { line, sources: [...srcs] };
  for (const voices of [false, true]) {
    const cuts = run('lyLineCuts(__l, __v)', { __l: line, __v: voices });
    const identical = !!cuts.old && cuts.old.length === cuts.cur.length &&
      cuts.old.every((o, k) => o.text === cuts.cur[k].text && JSON.stringify(o.pieces) === JSON.stringify(cuts.cur[k].pieces));
    const fired = run('lyLineCutChanged(__l, __v)', { __l: line, __v: voices });
    const key = voices ? 'voices_on' : 'voices_off';
    out[key] = { fires: fired, cut_identical: identical, cut: cuts.cur.map((t) => t.text) };
    if (hasLookup) out[key].v1_lookup = run('CMLyricTokens.v1GraderLookup(__l, !__v)', { __l: line, __v: voices });
  }
  // the page's own downstream effect: a named-place member on that line in a
  // rhyme groups row and a returns row, migrated by lyMigrateSavedReadings.
  const PLAIN = 'We sing it plain';
  for (const row of ['[SETUP — rhyme groups — 1.end,2.end]', '[SETUP — returns — 1.end,2.end]']) {
    const t = `${row}\n\n[VERSE]\n${line}\n${PLAIN}`;
    const got = run('lyMigrateSavedReadings(__t)', { __t: t });
    (out.migrate = out.migrate || []).push({ row, carried: got.carried, new_row: got.text.split('\n')[0], moved: got.moved, blocked: got.blocked });
  }
  rows.push(out);
}
const unionLines = union.map((r) => r.text);
const summary = {
  tree: TREE, has_v1GraderLookup: hasLookup,
  union_fire_voices_off: unionLines.map((l) => [l, rows.find((r) => r.line === l).voices_off.fires]),
  union_all_fire: unionLines.every((l) => rows.find((r) => r.line === l).voices_off.fires),
  receipt_lookup_differs_fire: receipt.lookup_differs.filter((x) => rows.find((r) => r.line === x.line).voices_off.fires).length + '/' + receipt.lookup_differs.length,
  nfc_controls_fire: receipt.label_nfc_only.filter((x) => rows.find((r) => r.line === x.line).voices_off.fires).length + '/' + receipt.label_nfc_only.length,
  distinct_lines: rows.length,
};
fs.writeFileSync(OUT, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary, null, 1));
