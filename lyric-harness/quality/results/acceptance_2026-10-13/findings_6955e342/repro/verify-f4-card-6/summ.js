// Summarise v6_<tree>.json: per step, the rhyme-group row in the draft, card words, card title, history lyricMeta keys.
const fs=require('fs');
for (const t of process.argv.slice(2)) {
  const j=JSON.parse(fs.readFileSync(`v6_${t}.json`,'utf8'));
  console.log(`=== ${t} (${j.built.split('/').pop()}) pageErrors=${JSON.stringify(j.pageErrors)}`);
  for (const [name, steps] of Object.entries(j.scenarios)) {
    console.log('  ## '+name);
    for (const s of steps) {
      if (s.error) { console.log('   ERROR '+s.error.split('\n')[0]); continue; }
      const row=(s.draft.split('\n').find(l=>/rhyme groups/.test(l))||'(none)');
      const keys=[...new Set(s.history.map(h=>JSON.stringify(h.lyricMetaKeys)))].join(' ');
      console.log(`   ${s.tag.padEnd(30)} head=${JSON.stringify(s.draftHead).padEnd(28)} row=${row.padEnd(48)} card=${JSON.stringify(s.words)} title=${s.card?JSON.stringify(s.card.title):'-'} storedRenumbered=${s.storedRenumbered?s.storedRenumbered.items.length:0} histKeys=${keys}`);
    }
  }
}
