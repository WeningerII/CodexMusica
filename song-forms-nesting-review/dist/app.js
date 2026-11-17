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
const clean = value => value.replaceAll('**','');
const normal = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function titleCase(name) {
  const disambiguated = name.replace(/^(.*) \(([^)]+)\)$/, '$1 · $2');
  return disambiguated;
}
const formsById=new Map(FORMS.map(form=>[form.id,form]));
const start='verse-chorus-bridge';
const finder=byId('finder'), source=byId('source'), query=byId('query'), filter=byId('filter');
let current, resizeFrame, selectionFromAction=false, previousWidth=-1;
const entries = FORMS.map(form=>({form, title:normal(form.name), aliases:normal(form.aliases), shape:normal(form.shape)}));
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
  const matches=entries.filter(e=>(!filter.value||e.form.family===filter.value)&&tokens.every(t=>(e.title+' '+e.aliases+' '+e.shape).includes(t)));
  if(term){const rank=e=>e.title===term?0:e.title.startsWith(term)?1:e.title.includes(term)?2:e.aliases.includes(term)?3:4;matches.sort((a,b)=>rank(a)-rank(b));}
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
  const statusLabels = {supported:'Source-supported', partial:'Partial model', contested:'Sources differ', unresolved:'Structure unresolved'};
  const note = byId('reviewNote');
  note.hidden = current.review.status === 'supported';
  note.textContent = statusLabels[current.review.status] + ' · ' + current.review.note;
  window.drawStructure(byId('diagram'),current);
  window.drawRelations(byId('relations'),current,FORMS,select,openFinder);
  if(selectionFromAction){byId('title').focus({preventScroll:true});window.scrollTo(0,0);selectionFromAction=false}
}
document.querySelector('.skip').onclick=e=>{e.preventDefault();byId('work').focus()};
function openSource(){
  const f=current, body=byId('sourceBody'),dl=element('dl');
  for(const [label,value] of [['Reviewed alternate names',f.aliases],['Source alias field',f.alias_review ? f.raw_aliases : '–'],['Alias review',f.alias_review?.reason || '–'],['Shape',f.shape],['Lines',f.length],['Planner section types in source',f.roles],['Nesting review',f.review.note]]){
    if(!value||value==='–')continue;dl.append(element('dt',label),element('dd',clean(value)));
  }
  body.replaceChildren(element('h3',f.name),dl,element('footer','english-forms.md · line '+f.line));
  for(const url of new Set([...f.review.refs,...(f.alias_review?.refs||[])])){const a=element('a',new URL(url).hostname);a.href=url;a.target='_blank';a.rel='noopener noreferrer';const paragraph=element('p');paragraph.append(a);body.append(paragraph)}
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

