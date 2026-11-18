'use strict';
const byId = id => document.getElementById(id);
const fams = {A:['Popular & stage','#5654a8'],B:['Folk & sacred','#347b66'],C:['Fixed poetry','#a86544'],D:['Stanza & verse','#446c8a'],E:['Open forms','#8c5779']};
const shapeIcons = {A:'M2 15 Q6 1 10 15 Q14 1 18 15',B:'M2 13 Q10 -2 18 13 M5 15 Q10 6 15 15',C:'M2 15 V8 H7 V4 H13 V8 H18 V15',D:'M2 5 H15 M2 10 H18 M2 15 H12',E:'M2 14 C5 -1 12 22 18 5'};
function glyph(key) {
  const ns='http://www.w3.org/2000/svg', s=document.createElementNS(ns,'svg'), p=document.createElementNS(ns,'path');
  for(const [k,v] of Object.entries({width:20,height:20,viewBox:'0 0 20 20','aria-hidden':'true',class:'glyph'}))s.setAttribute(k,v);
  for(const [k,v] of Object.entries({d:shapeIcons[key],fill:'none',stroke:fams[key][1],'stroke-width':1.65,'stroke-linecap':'round','stroke-linejoin':'round'}))p.setAttribute(k,v);
  s.append(p);return s;
}
const normal = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function titleCase(name) {
  const disambiguated = name.replace(/^(.*) \(([^)]+)\)$/, '$1 · $2');
  return disambiguated;
}
const formsById=new Map(FORMS.map(form=>[form.id,form]));
const start='verse-chorus-bridge';
const finder=byId('finder'), source=byId('source'), query=byId('query'), filter=byId('filter');
let current, resizeFrame, selectionFromAction=false, previousWidth=-1;
function treeWords(nodes) {
  return nodes.flatMap(node => typeof node === 'string' ? [node] : [node.label, ...treeWords(node.children)]);
}
const entries = FORMS.map(form => {
  const title = normal(form.name);
  const aliases = form.aliases.split(',').map(normal).filter(Boolean);
  const discovery = form.search_terms.map(normal).filter(Boolean);
  const text = [title, ...aliases, ...discovery, ...treeWords(form.tree).map(normal)].join(' ');
  return {form, title, aliases, discovery, text};
});

function matchRank(entry, term) {
  if (entry.title === term) return 0;
  if (entry.aliases.includes(term)) return 1;
  if (entry.discovery.includes(term)) return 2;
  if (entry.title.startsWith(term)) return 3;
  if (entry.title.includes(term)) return 4;
  if (entry.aliases.some(alias => alias.includes(term))) return 5;
  return 6;
}
function element(tag, text, cls) {const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function addOption(label,val){const opt=element('option',label);opt.value=val;filter.append(opt)}
addOption('All groups','');
for(const [key,[name]] of Object.entries(fams)){
  const count=FORMS.filter(f=>f.family===key).length;
  const b=element('button',undefined,'familybtn');b.type='button';b.dataset.family=key;b.setAttribute('aria-label','Browse '+name+' · '+count+' forms');
  b.append(glyph(key),element('span',name),element('span',String(count),'num'));b.onclick=()=>openFinder(key);
  byId('families').append(b);addOption(name,key);
}
function showResults() {
  const term=normal(query.value),tokens=term.split(' ').filter(Boolean);
  const matches = entries.filter(entry =>
    (!filter.value || entry.form.family === filter.value) && tokens.every(token => entry.text.includes(token))
  );
  if (term) matches.sort((a, b) => matchRank(a, term) - matchRank(b, term));
  const nodes=matches.map(({form})=>{
    const b=element('button',undefined,'result');b.type='button';b.append(element('span',titleCase(form.name)),element('small',fams[form.family][0]));
    b.onclick=()=>{finder.close();select(form.id)};return b;
  });
  byId('count').textContent=matches.length===0?'No matching forms':matches.length+' '+(matches.length===1?'form':'forms');
  byId('results').replaceChildren(...nodes);byId('results').scrollTop=0;
}
function openFinder(key=''){
  filter.value=key;query.value='';showResults();if(!finder.open)finder.showModal();query.focus();
}
function select(id){if(!formsById.has(id))return;selectionFromAction=true;if(location.hash.slice(1)===id){render();return}location.hash=id}
function render() {
  current=formsById.get(location.hash.slice(1))||formsById.get(start);
  byId('title').textContent=titleCase(current.name);
  byId('family').replaceChildren(glyph(current.family),element('span',fams[current.family][0]));byId('family').onclick=()=>openFinder(current.family);
  for(const btn of byId('families').children){if(btn.dataset.family===current.family)btn.setAttribute('aria-current','true');else btn.removeAttribute('aria-current')}
  byId('mode').textContent={Pattern:'Pattern',Rule:'Structural rule',Example:'One possible pattern'}[current.mode];
  document.title=titleCase(current.name)+' · Song Forms';
  const statusLabels = {supported:'Reviewed pattern', partial:'Partial model', contested:'Contested pattern', unresolved:'Structure unresolved'};
  const note = byId('reviewNote');
  const basis = current.review.basis ||
    (current.review.refs.length ? 'reference recorded; passage unverified' : 'catalog and model only');
  const provenance = {
    'passage checked for stated scope': 'Source passage checked for this claim',
    'reference recorded; passage unverified': 'Reference recorded, passage unverified',
    'catalog and model only': 'Catalog evidence only'
  }[basis];
  note.textContent = statusLabels[current.review.status] + ' · ' + provenance + '. ' + current.review.note;
  window.drawStructure(byId('diagram'),current);
  window.drawRelations(byId('relations'),current,FORMS,select,openFinder);
  if(selectionFromAction){byId('title').focus({preventScroll:true});window.scrollTo(0,0);selectionFromAction=false}
}
document.querySelector('.skip').onclick=e=>{e.preventDefault();byId('work').focus()};
function openSource(){
  const f=current, body=byId('sourceBody'),dl=element('dl');
  for (const [label, value] of [['Alternate names', f.aliases], ['Related search terms', f.search_terms.join(', ')], ['Review', f.review.note]]) {
    if (value && value !== '–') dl.append(element('dt', label), element('dd', value));
  }
  body.replaceChildren(element('h3',f.name),dl,element('footer','Original source record · line '+f.line));
  for (const url of f.review.refs) {
    const link=element('a',new URL(url).hostname);
    link.href=url; link.target='_blank'; link.rel='noopener noreferrer';
    const paragraph=element('p'); paragraph.append(link); body.append(paragraph);
  }
  source.showModal();
}
byId('searchOpen').onclick=()=>openFinder();byId('all').onclick=()=>openFinder();byId('sourceOpen').onclick=openSource;
query.oninput=showResults;filter.onchange=showResults;
query.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();byId('results').querySelector('button')?.focus()}if(e.key==='Enter'&&!e.isComposing){e.preventDefault();byId('results').querySelector('button')?.click()}};
byId('results').onkeydown=e=>{const b=e.target.closest('.result');if(!b)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();(e.key==='ArrowDown'?b.nextElementSibling:b.previousElementSibling||query)?.focus()}};
document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!finder.open&&!source.open){e.preventDefault();openFinder()}});
for(const dialog of [finder,source]){dialog.querySelector('.close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close()})}
for(const [id,step] of [['prev',-1],['next',1]])byId(id).onclick=()=>select(FORMS[(FORMS.indexOf(current)+step+FORMS.length)%FORMS.length].id);
window.addEventListener('hashchange',render);render();
new ResizeObserver(([entry])=>{const width=Math.round(entry.contentRect.width);if(width===previousWidth)return;previousWidth=width;cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>window.drawStructure(byId('diagram'),current))}).observe(byId('diagram'));

