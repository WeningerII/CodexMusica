// Compact table of a v4c_*.json: per step, the live page context and A's / B's IndexedDB records.
const o = require(process.argv[2]);
for (const r of o.runs) {
  console.log(`## ${o.tree} ${r.scenario}  aId=${r.aId} bId=${r.bId}`);
  if (r.error) console.log('ERROR', r.error.slice(0, 400));
  for (const s of r.steps) {
    const a = (s.idb || []).find((d) => d.draftId === r.aId) || {};
    const b = (s.idb || []).find((d) => d.draftId === r.bId) || {};
    console.log(
      `${s.tag.padEnd(36)}| draft ${s.head.replace(/.*title — /, '').padEnd(14)} live id ${(s.live.draftId || '-').slice(6, 14).padEnd(8)} brief=${s.live.brief || '-'} drafts=${JSON.stringify(s.live.drafts)} probe=${s.live.probe || '-'} card=${JSON.stringify(s.live.card)}` +
        ` || A rec: drafts=${JSON.stringify(a.drafts)} probe=${a.probe || '-'} card=${JSON.stringify(a.card)} || B rec card=${JSON.stringify(b.card)}` +
        (s.card !== undefined ? `\n${''.padEnd(36)}  rendered: ${s.card ? s.card.replace(/\n/g, ' / ').replace(/^.*?exactly the same characters: /, '… ') : null}` : '') +
        (s.opened !== undefined ? ` opened=${s.opened}` : '')
    );
  }
  console.log('  hist(last): ' + JSON.stringify(r.steps[r.steps.length - 1].hist));
  if (r.traces) console.log('  traces: ' + JSON.stringify(r.traces));
  console.log('  pageErrors: ' + JSON.stringify(r.pageErrors));
}
