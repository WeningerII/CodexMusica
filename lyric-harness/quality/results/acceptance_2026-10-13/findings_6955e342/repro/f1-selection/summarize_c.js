// Summarise c_selection_*.json: per trigger and category, how many cases keep
// the selection on the same characters; every failure with exact offsets and
// text; and whether two keys typed next leave the page's parse of the
// declarations unchanged (vs. the parse right after the boundary).
'use strict';
const fs = require('fs');
const files = process.argv.slice(2);
const out = { byTrigger: {}, failures: [] };
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const c of j.cases) {
    if (c.threw) { out.failures.push({ id: c.id, threw: c.threw }); continue; }
    // A bottom-placed "row to body" selection is degenerate (end < start).
    if (c.where === 'bottom' && c.sel === 'X_row_to_body') continue;
    const cat = c.sel.split('_')[0];
    const key = `${j.tree}.${c.trig}`;
    const t = (out.byTrigger[key] = out.byTrigger[key] || {});
    const b = (t[cat] = t[cat] || { cases: 0, sameChars: 0, migrated: 0 });
    b.cases++;
    if (c.migrated) b.migrated++;
    if (c.sameChars) b.sameChars++;
    const declBefore = JSON.stringify(c.parsedBefore?.decl), declAfter = JSON.stringify(c.parsed?.decl);
    const setupBefore = c.parsedBefore?.setup?.length, setupAfter = c.parsed?.setup?.length;
    if (!c.sameChars)
      out.failures.push({
        id: c.id,
        row: c.row,
        before: { sel: c.before.sel, selected: c.before.selected, shown: c.before.shown },
        after: { sel: c.after.sel, selected: c.after.selected, shown: c.after.shown, focused: c.after.focused },
        expected: { ref: c.ref, shown: c.expectedShown },
        collapsed: c.collapsed,
        typedZQ: c.typed?.rowNow,
        declarationsAfterTyping: declAfter,
        declarationsBeforeTyping: declBefore,
        setupRowsBeforeAfterTyping: [setupBefore, setupAfter],
      });
  }
}
fs.writeFileSync(process.env.OUT || 'c_summary.json', JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out.byTrigger)) console.log(k, JSON.stringify(v));
console.log('failures', out.failures.length);
