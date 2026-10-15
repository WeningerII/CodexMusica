// Item 2: legacy `more` (evicted-entry count) survives an appending migration
// until Dismiss. Uses the REAL lyricMetaOf / lyricMetaHistory from <root>/src/app.js
// (extracted by text) so persistence normalization is exercised too.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const make = require('./ctx.js');
const root = process.argv[2];
const appSrc = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
const grab = (re) => { const m = re.exec(appSrc); if (!m) throw new Error('not found ' + re); return m[0]; };
const metaSrc = grab(/const LYRIC_META_LIMITS=[^\n]*\n/) + grab(/function lyricMetaOf\(v\)\{[\s\S]*?\n  return out;\n\}\n/) + grab(/const lyricMetaHistory=[^\n]*\n/);
const T = make(root);
vm.runInContext(metaSrc, T.ctx);
const { run, draft, app } = T;
const BODY = '[VERSE]\nOh--oh, oh my love\nwe sing it plain tonight';
const LEGACY = '[SETUP — returns — 1.T2,2.end]';
const entry = { kind: 'returns', word: 'love', n: [3], from: 4, to: 5 };
const out = [];
const card = () => run('lyRenumberedCheck()');
for (const shape of ['legacy-ui', 'top-level', 'top-level-empty-items', 'other-draft']) {
  run('LY.metaRef = null');
  let meta;
  if (shape === 'legacy-ui') meta = { version: 1, draftId: 'd1', ui: { renumbered: { items: [entry], more: 7 } } };
  else if (shape === 'top-level') meta = { version: 1, draftId: 'd1', renumbered: { draftId: 'd1', items: [entry], more: 7 } };
  else if (shape === 'top-level-empty-items') meta = { version: 1, draftId: 'd1', renumbered: { draftId: 'd1', items: [], more: 7 } };
  else meta = { version: 1, draftId: 'd2', renumbered: { draftId: 'd1', items: [entry], more: 7 } };
  // Imported through the app's own normalizer (as a session import / Library record would be).
  app.lyricMeta = run('lyricMetaOf(__m)', { __m: JSON.parse(JSON.stringify(meta)) });
  const before = card();
  draft.value = `${LEGACY}\n${BODY}`;
  run('lyEnsureTokenScheme("open")');
  const r = JSON.parse(JSON.stringify(run('lyMeta().renumbered')));
  const after = card();
  // Persist round trip: snapshot -> lyricMetaOf (what save/export/undo restore do).
  const snap = JSON.parse(JSON.stringify(run('lyricMetaHistory(lyricMetaOf(app.lyricMeta))')));
  const reread = run('lyricMetaOf(__s)', { __s: snap }).renumbered;
  // A second appending migration (another legacy row appears later).
  draft.value = `[SETUP — rhyme groups — 1.T2,2.end]\n${draft.value}`;
  run('lyEnsureTokenScheme("open")');
  const r2 = JSON.parse(JSON.stringify(run('lyMeta().renumbered')));
  const c2 = card();
  run('LY_ACTIONS["ly-renumbered-dismiss"]()');
  const dismissed = run('lyMeta().renumbered');
  out.push({
    shape,
    beforeTitle: before && before.title,
    after: { more: r.more, items: r.items.length, draftId: r.draftId, title: after && after.title, says7: /7 earlier entries were dropped/.test(after && after.text) },
    roundTrip: { more: reread && reread.more, items: reread && reread.items.length },
    secondAppend: { more: r2.more, items: r2.items.length, says7: /7 earlier entries were dropped/.test(c2 && c2.text) },
    afterDismiss: dismissed === undefined ? 'gone' : dismissed,
  });
}
for (const o of out) console.log(JSON.stringify(o));
