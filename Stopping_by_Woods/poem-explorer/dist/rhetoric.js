(function () {
  'use strict';
  const D = window.RHETORIC_DATA;
  const P = window.POEM_DATA;
  const $ = id => document.getElementById(id);
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {selected:(D.findings.find(f=>f.id==='H01')||D.findings[0]).id, word:null, filter:'all', search:''};
  const statusNames = {observed:'Evidence found',checked_no_match:'Checked; no match',interpretation_component:'Interpretive / partial',out_of_scope:'Outside scope',not_executed:'Not run'};
  const kinds = {computed:'Code check',reviewed:'Manual review',combined:'Code + review',interpretation:'Interpretation'};
  const allWordIds = f => new Set(f.spans.flatMap(s=>s.words));
  const findingWords = new Map(D.findings.map(f=>[f.id,allWordIds(f)]));
  const labelName = label => typeof label === 'string' ? label : label.name;
  const location = f => {
    const lines = [...new Set([...allWordIds(f)].map(id=>P.tokens[id-1][1]))].sort((a,b)=>a-b);
    return 'L' + lines.map((n,i)=>i && n === lines[i-1]+1 ? (i === lines.length-1 || lines[i+1] !== n+1 ? '–'+n : '') : (i ? ', '+n : String(n))).join('');
  };
  const filtered = () => D.findings.filter(f =>
    (state.word == null || findingWords.get(f.id).has(state.word)) &&
    (state.filter === 'all' || (state.filter === 'interpretation' ? f.kind === 'interpretation' : f.kind !== 'interpretation')) &&
    (!state.search || (f.title+' '+f.labels.map(labelName).join(' ')+' '+f.summary+' '+f.spans.map(s=>s.quote).join(' ')).toLowerCase().includes(state.search.toLowerCase()))
  );
  function sourceList(ids) {
    return (ids || []).map(id=>D.sources.find(s=>s.id===id)).filter(Boolean).map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.label)+'</a></li>').join('');
  }
  function announce(message) {$('announcement').textContent=message;}
  function expandPanel() {
    document.querySelector('.inspector').classList.remove('is-collapsed');
    $('inspector-toggle').setAttribute('aria-expanded','true');
    document.querySelector('.inspector').scrollTop=0;
  }
  function scrollToFinding(f) {
    const first = Math.min(...findingWords.get(f.id));
    const line = document.getElementById('line-'+P.tokens[first-1][1]);
    line.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth',block:'center'});
  }
  function selectFinding(id, scroll) {
    const f=D.findings.find(x=>x.id===id);
    if(!f)return;
    state.selected=id;
    render();
    expandPanel();
    if(scroll)scrollToFinding(f);
    announce(f.title+'. '+location(f)+'. '+kinds[f.kind]+'.');
  }
  function selectWord(id) {
    state.word=id;state.search='';state.filter='all';
    $('rhetoric-search').value='';$('rhetoric-filter').value='all';
    const matches=filtered();
    const size=f=>f.id==='R05' ? f.spans.find(s=>s.words.includes(id)).words.length : findingWords.get(f.id).size;
    const priority=f=>f.kind==='interpretation'?2:f.applicationState==='interpretation_or_component_only'?1:0;
    const best=matches.slice().sort((a,b)=>priority(a)-priority(b)||size(a)-size(b))[0];
    state.selected=best ? best.id : null;
    render();expandPanel();
    announce(P.tokens[id-1][0]+': '+matches.length+' findings attached to this occurrence.');
  }
  function renderHighlights() {
    const selected=D.findings.find(f=>f.id===state.selected);
    const selectedWords=selected ? (selected.id==='R05'&&state.word ? new Set(selected.spans.filter(s=>s.words.includes(state.word)).flatMap(s=>s.words)) : findingWords.get(selected.id)) : new Set();
    document.querySelectorAll('[data-word]').forEach(el=>{
      const id=Number(el.dataset.word);
      const n=D.findings.filter(f=>findingWords.get(f.id).has(id)).length;
      ['is-anchor','is-partner','is-connected','is-overview-match','is-muted'].forEach(c=>el.classList.remove(c));
      el.classList.toggle('rhetoric-evidence',selectedWords.has(id));
      el.classList.toggle('rhetoric-word-focus',state.word===id);
      el.classList.toggle('rhetoric-interpretation',Boolean(selected && selected.kind==='interpretation' && selectedWords.has(id)));
      el.setAttribute('aria-pressed',String(selectedWords.has(id)));
      el.title='Line '+P.tokens[id-1][1]+' · word '+P.tokens[id-1][2]+' · '+n+' attached '+(n===1?'finding':'findings');
    });
    document.querySelectorAll('[data-syllable-word]').forEach(el=>{
      ['is-anchor','is-partner','is-connected','is-overview-match'].forEach(c=>el.classList.remove(c));
      el.classList.toggle('rhetoric-syllable',selectedWords.has(Number(el.dataset.syllableWord)));
    });
    document.querySelectorAll('.poem-line').forEach(el=>{
      el.classList.toggle('rhetoric-line',Boolean(selected && selected.spans.some(s=>s.words.some(id=>P.tokens[id-1][1]===Number(el.dataset.line)))));
    });
    $('rhetoric-guide').classList.toggle('interpreting',Boolean(selected && selected.kind==='interpretation'));
    $('rhetoric-guide').firstElementChild.innerHTML='<i aria-hidden="true"></i> '+(selected && selected.kind==='interpretation' ? 'Passages for this possible reading' : 'Evidence for the selected finding');
  }
  function renderSelection(f) {
    if(!f){
      $('rhetoric-selection').innerHTML='<p class="rhetoric-empty">'+(state.word ? 'No rhetorical finding is attached to this word occurrence under these filters. This is not a claim that it has no literary function.' : 'No findings match these filters.')+'</p><button type="button" class="text-button" data-sound-view>Explore sound connections ↗</button>';
      return;
    }
    if(f.id==='R05'&&state.word)f={...f,title:'Exact recurrence of “'+P.tokens[state.word-1][0]+'”',spans:f.spans.filter(s=>s.words.includes(state.word))};
    const overlaps=f.labels.filter(l=>typeof l==='object'&&l.scope).map(l=>'<li><strong>'+esc(l.name)+':</strong> '+esc(l.scope)+'</li>').join('');
    $('rhetoric-selection').innerHTML='<article class="rhetoric-selected kind-'+f.kind+'"><div class="finding-meta"><span class="method-badge">'+kinds[f.kind]+'</span><span>'+location(f)+'</span></div><h2>'+esc(f.title)+'</h2><div class="device-labels">'+f.labels.map(l=>'<span>'+esc(labelName(l))+'</span>').join('')+'</div><p class="finding-summary">'+esc(f.summary)+'</p><div class="evidence-passages">'+f.spans.map((s,i)=>'<button type="button" data-passage="'+i+'" class="passage-button"><q>'+esc(s.quote)+'</q><span>'+esc(s.label)+' ↗</span></button>').join('')+'</div>'+(f.limit?'<p class="finding-limit">'+esc(f.limit)+'</p>':'')+'<details class="finding-method"><summary>How this was identified</summary><p><strong>'+esc(f.method.name)+'</strong></p><p>'+esc(f.method.description)+'</p>'+(overlaps?'<h3>How the labels overlap</h3><ul>'+overlaps+'</ul>':'')+(f.sources.length?'<h3>Method & definition sources</h3><ul class="source-list">'+sourceList(f.sources)+'</ul>':'')+'</details></article>';
    if(f.soundCategory)$('rhetoric-selection').querySelector('article').insertAdjacentHTML('beforeend','<button type="button" class="sample-button" data-sound-rule="'+esc(f.soundCategory)+'">Inspect '+f.soundPairCount+' matching sound pairs <span aria-hidden="true">↗</span></button>');
  }
  function render() {
    const findings=filtered();
    if(!findings.some(f=>f.id===state.selected))state.selected=findings.length?findings[0].id:null;
    $('rhetoric-result-count').textContent=findings.length+' / '+D.findings.length;
    const context=$('rhetoric-word-context');
    context.hidden=state.word==null;
    if(state.word)context.innerHTML='<span>At <strong>“'+esc(P.tokens[state.word-1][0])+'”</strong> · L'+P.tokens[state.word-1][1]+'</span><button type="button" data-clear-word aria-label="Clear selected word">×</button>';
    renderSelection(findings.find(f=>f.id===state.selected));
    $('rhetoric-findings-list').innerHTML=findings.map(f=>'<button type="button" class="finding-option'+(f.id===state.selected?' is-selected':'')+'" data-finding="'+f.id+'" aria-pressed="'+(f.id===state.selected)+'"><span class="finding-option-number">'+location(f)+'</span><span><strong>'+esc(f.title)+'</strong><small>'+esc(f.labels.map(labelName).join(' · '))+'</small></span><span class="kind-indicator '+f.kind+'" title="'+kinds[f.kind]+'" aria-label="'+kinds[f.kind]+'"></span></button>').join('');
    if(window.PoemExplorer.state.view==='rhetoric')renderHighlights();
  }
  function openDialog(title,html) {$('dialog-title').textContent=title;$('dialog-content').innerHTML=html;$('info-dialog').showModal();}
  function coverageRows() {
    const q=($('coverage-search').value||'').toLowerCase();
    const mode=$('coverage-status').value;
    const entries=D.coverage.entries.filter(e=>(mode==='all'||e.status===mode)&&(!q||(e.name+' '+e.id+' '+e.note).toLowerCase().includes(q)));
    $('coverage-results').innerHTML=entries.map(e=>'<tr><td><strong>'+esc(e.name)+'</strong><small>'+esc(e.id)+'</small></td><td><span class="coverage-status status-'+e.status+'">'+statusNames[e.status]+'</span><small>'+esc(e.mode)+'</small></td><td>'+esc(e.note)+(e.sources&&e.sources.length?'<ul class="source-list">'+sourceList(e.sources)+'</ul>':'')+'</td></tr>').join('');
    $('coverage-count').textContent=entries.length+' of 91 methods';
  }
  function showCoverage() {
    const counts=Object.fromEntries(Object.keys(statusNames).map(s=>[s,D.coverage.entries.filter(e=>e.status===s).length]));
    openDialog('What was applied to this poem','<p>The research inventory has <strong>415 entries</strong>. We account for each of the <strong>91 entries with a scoped identification method</strong> below. Having a method does not mean that its device occurs here, or that its original software was run.</p><div class="coverage-totals">'+Object.entries(counts).map(([k,n])=>'<div><strong>'+n+'</strong><span>'+statusNames[k]+'</span></div>').join('')+'</div><p>'+esc(D.coverage.summary)+'</p><p><strong>The other 324 inventory entries remain research-only in this application.</strong> A few useful close-reading notes go beyond the 91-method set; their cards explicitly say manual review or interpretation.</p><div class="coverage-controls"><label><span class="sr-only">Find a method</span><input id="coverage-search" type="search" placeholder="Find a device or method…"></label><label><span class="sr-only">Application status</span><select id="coverage-status"><option value="all">All outcomes</option>'+Object.entries(statusNames).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label><span id="coverage-count"></span></div><div class="table-scroll"><table class="coverage-table"><thead><tr><th>Inventory entry</th><th>Application</th><th>Result and scope</th></tr></thead><tbody id="coverage-results"></tbody></table></div><p class="method-note">These counts describe this application, not a reclassification of the 415-entry research inventory. A “not run” or “outside scope” result is not evidence that a device is absent.</p><h3>Download the recorded evidence</h3><ul class="source-list"><li><a href="rhetoric-application.json" download>Compact findings and application record (JSON)</a></li><li><a href="structural-audit.json" download>All exact recurrences, boundary checks and finite tests (JSON)</a></li><li><a href="native-repetition-results.json" download>Complete original repetition-rule outputs and errors (JSON)</a></li><li><a href="scope-refinement-audit.json" download>Whole-poem alliteration and ending-rule refinement (JSON)</a></li></ul>');
    $('coverage-search').addEventListener('input',coverageRows);
    $('coverage-status').addEventListener('change',coverageRows);
    coverageRows();
  }
  function showReview() {
    openDialog('Labels checked but not confirmed','<p>These decisions prevent a suggestive word or a loose software match from becoming an unsupported label. They are local findings about this poem and the stated method, not universal exclusions.</p>'+D.reviewedLabels.map(r=>'<section class="review-item"><h3>'+esc(r.label)+'</h3><p class="review-quote">'+esc(r.quote)+'</p><p>'+esc(r.reason)+'</p>'+(r.sources&&r.sources.length?'<ul class="source-list">'+sourceList(r.sources)+'</ul>':'')+'</section>').join(''));
  }
  function onView(view) {
    if(view==='rhetoric'){render();const f=D.findings.find(x=>x.id===state.selected);announce(f?f.title+'. '+kinds[f.kind]+'.':'Rhetorical reading.');}
    else document.querySelectorAll('.rhetoric-evidence,.rhetoric-word-focus,.rhetoric-interpretation,.rhetoric-syllable,.rhetoric-line').forEach(el=>el.classList.remove('rhetoric-evidence','rhetoric-word-focus','rhetoric-interpretation','rhetoric-syllable','rhetoric-line'));
  }
  function clearWord(){state.word=null;render();}
  $('view-rhetoric').addEventListener('click',()=>window.PoemExplorer.setView('rhetoric'));
  $('rhetoric-search').addEventListener('input',event=>{state.search=event.target.value;render();});
  $('rhetoric-filter').addEventListener('change',event=>{state.filter=event.target.value;render();});
  $('rhetoric-reset').addEventListener('click',()=>{state.word=null;state.search='';state.filter='all';$('rhetoric-search').value='';$('rhetoric-filter').value='all';render();});
  $('rhetoric-findings-list').addEventListener('click',event=>{const b=event.target.closest('[data-finding]');if(b)selectFinding(b.dataset.finding,true);});
  $('rhetoric-word-context').addEventListener('click',event=>{if(event.target.closest('[data-clear-word]')){state.word=null;render();}});
  $('rhetoric-selection').addEventListener('click',event=>{
    const b=event.target.closest('[data-passage]');
    if(b){const f=D.findings.find(x=>x.id===state.selected);const id=f.spans[Number(b.dataset.passage)].words[0];document.getElementById('line-'+P.tokens[id-1][1]).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}
    if(event.target.closest('[data-sound-view]')){window.PoemExplorer.setView('poem');if(state.word){window.PoemExplorer.state.anchor=null;window.PoemExplorer.state.partner=null;window.PoemExplorer.selectWord(state.word);}}
    const rule=event.target.closest('[data-sound-rule]');
    if(rule){const explorer=window.PoemExplorer;explorer.state.filter=explorer.model.bit(rule.dataset.soundRule);explorer.state.anchor=null;explorer.state.partner=null;explorer.state.evidence=null;explorer.setView('poem');}
  });
  $('coverage-open').addEventListener('click',showCoverage);
  document.querySelector('.rhetoric-examples').addEventListener('click',event=>{
    const b=event.target.closest('[data-rhetoric-example]');if(!b)return;
    state.word=null;state.search='';state.filter='all';$('rhetoric-search').value='';$('rhetoric-filter').value='all';selectFinding(b.dataset.rhetoricExample,true);
  });
  $('rhetoric-review-open').addEventListener('click',showReview);
  const interpretations=D.findings.filter(f=>f.kind==='interpretation').length;
  $('rhetoric-overview-copy').textContent=D.findings.length+' evidence groups across all 16 lines, including '+interpretations+' interpretive readings. Each finding shows its words, overlapping labels and method.';
  window.RhetoricExplorer={state,selectWord,selectFinding,renderHighlights,onView,showCoverage,clearWord};
  render();
  const view=new URLSearchParams(window.location.search).get('view');
  window.PoemExplorer.setView(view==='sound'?'poem':view==='map'?'map':'rhetoric');
})();
