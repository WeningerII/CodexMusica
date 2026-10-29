(function (root) {
  'use strict';
  // Original core-rule output stays intact on disk. This declared adaptation
  // replaces E63's affix heuristic and adds A1 without shifting existing bits.
  function apply(data, refinement) {
    if (data.scopeRefinement) return data;
    const endingBit = 1 << 22, initialBit = 1 << 25;
    function update(d, scope) {
      const r = refinement.scopes[scope];
      const initial = new Set(r.initialPairs.map(p => p.join(':')));
      const endings = new Map(r.endingPairs.map(p => [p.slice(0,2).join(':'),p[2]]));
      const oldDisplayed = d.counts.pairs_with_nonabsence_matches;
      d.categories = d.categories.map(c => c[0] === 'E9' ? [c[0], 'alliteration · whole onset', c[2]] :
        c[0] === 'E63' ? [c[0], 'homeoteleuton · adjacent / parallel endings', 'adapted ending + position rule'] :
        c[0] === 'H1' ? [c[0], 'same spelled rhyme ending', c[2]] : c);
      d.categories.push(['A1','alliteration · initial consonant','initial-consonant agreement']);
      d.pairs = d.pairs.map(([a,b,mask]) => [a,b,(mask & ~endingBit) |
        (initial.has(a+':'+b) ? initialBit : 0) | (endings.has(a+':'+b) ? endingBit : 0)]);
      d.absenceOnly = d.absenceOnly.map(([a,b,m])=>[a,b,m & ~endingBit]).filter(p=>p[2]);
      const absence = new Map(d.absenceOnly.map(([a,b,m])=>[a+':'+b,m]));
      const displayed = new Map(d.pairs.map(([a,b,m])=>[a+':'+b,m & ~(absence.get(a+':'+b)||0)]));
      const original = {displayedPairs:oldDisplayed,rawNativePairs:d.counts.pairs_with_native_matches,
        E63:d.counts.by_category.E63,positiveE63:d.counts.nonabsence_by_category.E63};
      d.counts = {...d.counts,category_slots:d.pairs.length*d.categories.length,
        pairs_with_nonabsence_matches:[...displayed.values()].filter(Boolean).length,
        by_category:{...d.counts.by_category,E63:{true:endings.size,false:d.pairs.length-endings.size},A1:{true:initial.size,false:d.pairs.length-initial.size}},
        nonabsence_by_category:{...d.counts.nonabsence_by_category,E63:endings.size,A1:initial.size}};
      d.witnessEdges = d.witnessEdges.map(([a,b,m,w])=>[a,b,m & ~endingBit,w]).filter(p=>p[2]);
      const witnessIndex = new Map(d.readingWitnesses.map((w,i)=>[JSON.stringify(w),i]));
      for (const [a,b,flags,ra,rb] of r.witnesses) {
        const readings = [a,b].map((id,i)=>data.tokens[id-1][0]+' = '+refinement.pronunciations[i ? rb : ra].join(' '));
        const key=JSON.stringify(readings);
        let w=witnessIndex.get(key);
        if(w===undefined){
          w=d.readingWitnesses.length;witnessIndex.set(key,w);d.readingWitnesses.push(readings);
          d.readingWitnessLabels.push([a,b].map((id,i)=>data.tokens[id-1][0]+' = '+refinement.respellings[i ? rb : ra]));
        }
        const mask=scope==='annotated' ? displayed.get(a+':'+b) : (flags&1 ? initialBit:0)|(flags&2 ? endingBit:0);
        d.witnessEdges.push([a,b,mask,w]);
      }
      const merged=new Map();
      for(const [a,b,m,w] of d.witnessEdges){const key=a+':'+b+':'+w;const row=merged.get(key);if(row)row[2]|=m;else merged.set(key,[a,b,m,w]);}
      d.witnessEdges=[...merged.values()];
      d.scopeRefinement={version:refinement.version,scope,original,
        counts:r.counts,endingPositions:Object.fromEntries(endings),legacyEndingPairs:refinement.legacyEndingPairs};
    }
    update(data,'annotated');update(data.allReadings,'dictionary_union');
    data.analysisNotes=refinement.analysisNotes;
    data.sourceLinks.push(...refinement.sourceLinks);
    data.globalNotes.rhymeOverlap.push('A1 records shared first consonants; E9 is the narrower whole-onset check and excludes repeated spellings. Homeoteleuton overlaps end rhyme, internal rhyme, weak ending echoes and exact repetition when the declared placement condition also holds. These are overlapping relations, not counts of independent rhetorical effects.');
    return data;
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={apply};
  if(root&&root.POEM_DATA&&root.POEM_REFINEMENT)apply(root.POEM_DATA,root.POEM_REFINEMENT);
})(typeof window!=='undefined'?window:null);
