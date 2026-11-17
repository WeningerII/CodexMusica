(function () {
  'use strict';
  const familyNames = {A: 'Popular & stage', B: 'Folk & sacred', C: 'Fixed poetry', D: 'Stanza & verse', E: 'Open forms'};
  const mounted = new WeakMap();
  const css = `
    .sf-relations { container-type:inline-size; color:#172238; font:inherit; }
    .sfr-map { position:relative; isolation:isolate; }
    .sfr-lines {position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:-1; overflow:visible; }
    .sfr-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.15fr) minmax(0,1.15fr); column-gap:clamp(36px,6cqi,78px); align-items:center; padding:20px 0; }
    .sfr-layout.sfr-single { grid-template-columns:minmax(100px,210px) minmax(100px,240px); }
    .sfr-column {min-width:0;}
    .sfr-title {display:block; margin:0 0 7px; font-size:11px; font-family:inherit; font-weight:650; line-height:1.35; letter-spacing:.075em; text-transform:uppercase; color:#5c6575;}
    .sfr-node { position:relative; display:flex; align-items:center; gap:9px; min-height:44px; width:100%; padding:7px 0; box-sizing:border-box; border:0; border-radius:0; background:transparent; color:inherit; font:inherit; line-height:1.25; text-align:start; overflow-wrap:anywhere; }
    .sfr-node::before { content:''; flex:0 0 auto; width:8px; height:8px; border:1.6px solid #697298; border-radius:50%; background:#fff; box-sizing:border-box; }
    button.sfr-node, .sfr-toggle {cursor:pointer;}
    button.sfr-node:hover .sfr-label, .sfr-toggle:hover { text-decoration:underline; text-underline-offset:3px;}
    .sfr-node:focus-visible,.sfr-toggle:focus-visible { outline:2px solid #4349bc; outline-offset:3px; border-radius:3px; }
    .sfr-chosen .sfr-node {font-weight:650; color:#303792;}
    .sfr-chosen .sfr-node::before {width:11px; height:11px; border:0; background:#4349bc;}
    .sfr-items {list-style:none; margin:0; padding:0; display:grid; gap:3px;}
    .sfr-toggle {padding:6px 1px; min-height:44px; border:0; background:transparent; color:#414694; font:inherit; font-size:14px; font-weight:550; }
    .sfr-peers { margin-block-start:8px; font-size:14px; }
    .sfr-peers > summary { min-height:44px; padding-block:12px; box-sizing:border-box; width:fit-content; max-width:100%; color:#414694; cursor:pointer; }
    .sfr-peers summary:focus-visible,.sfr-peer:focus-visible {outline:2px solid #4349bc; outline-offset:2px;}
    .sfr-peers ul {display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,165px),1fr)); gap:0 14px; list-style:none; margin:0 0 12px; padding:0;}
    .sfr-peer {padding:6px 0; min-height:44px; color:#172238; background:transparent; border:0; text-align:start; font:inherit; cursor:pointer;}
    .sfr-peer:hover {text-decoration:underline; text-underline-offset:3px;}
    @container(max-width:620px){
      .sfr-layout,.sfr-layout.sfr-single {grid-template-columns:1fr; row-gap:24px; padding:8px 0 12px;}
      .sfr-family {margin-inline-end:26px;}
      .sfr-chosen {margin-inline-start:24px;}
      .sfr-related {margin-inline-start:48px;}
      .sfr-title {margin-inline-start:17px; margin-bottom:0;}
      .sfr-node {width:fit-content; max-width:100%; }
      .sfr-toggle {margin-inline-start:17px;}
    }
  `;
  const titleTerms = [
    ['verse-chorus', /\bverse chorus(?:es)?\b/],
    ['sonnet', /\bsonnets?\b/], ['strophic', /\bstrophic\b/],
    ['shanty', /\bshant(?:y|ies)\b/], ['ballade', /\bballades?\b/],
    ['ballad', /\bballads?\b/], ['blues', /\bblues\b/],
    ['sestina', /\bsestinas?\b/], ['quatrain', /\bquatrains?\b/],
    ['couplet', /\bcouplets?\b/], ['hymn', /\bhymns?\b/],
    ['rondeau', /\brondeau(?:x|s)?\b/], ['carol', /\bcarols?\b/],
    ['psalm', /\bpsalms?\b/], ['ode', /\bodes?\b/],
    ['tercet', /\btercets?\b/], ['octave', /\boctaves?\b/],
    ['tanka', /\btankas?\b/], ['kyrielle', /\bkyrielles?\b/],
    ['virelai', /\bvirelais?\b/], ['anthem', /\banthems?\b/],
    ['metre', /\bmetres?\b/], ['chant', /\bchants?\b/],
    ['crown', /\bcrowns?\b/], ['dactyl', /\bdactyls?\b/],
    ['terza rima', /\bterza rima\b/], ['rap', /\brap\b/]
  ];
  function titleWords(name) {
    return name.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'')
      .replace(/[^a-z0-9]+/g,' ').trim();
  }
  function titlePeers(form, forms, related) {
    const seen = new Set([form.id,...related.map(item=>item.id)]);
    const groups = [];
    for(const [term,pattern] of titleTerms) {
      if(!pattern.test(titleWords(form.name))) continue;
      const items = forms.filter(item => !seen.has(item.id) && pattern.test(titleWords(item.name)));
      if(!items.length) continue;
      items.sort((a,b)=>a.name.localeCompare(b.name,'en'));
      items.forEach(item=>seen.add(item.id));
      groups.push({term,items});
    }
    return groups;
  }
  function make(tag, cls, value) {
    const el = document.createElement(tag);
    el.className = cls;
    if (value) el.textContent = value;
    return el;
  }
  function choice(label, action, accessible) {
    const el = make(action ? 'button' : 'span', 'sfr-node');
    if (action) {
      el.type = 'button';
      el.addEventListener('click', action);
    }
    if (accessible) el.setAttribute('aria-label',accessible);
    el.append(make('span','sfr-label',label));
    return el;
  }
  function column(cls, title) {
    const el = make('div','sfr-column '+cls);
    el.append(make('span','sfr-title',title));
    return el;
  }
  window.drawRelations = function(container, form, forms, onSelect, onFamily) {
    mounted.get(container)?.();
    if (!document.querySelector('#song-form-relations-style')) {
      const style = document.createElement('style');
      style.id='song-form-relations-style';
      style.textContent=css;
      document.head.append(style);
    }
    const outgoing = new Set(form.related || []);
    const related = forms.filter(other => other.id !== form.id &&
       (outgoing.has(other.name) || other.related?.includes(form.name)));
    related.sort((a,b) => Number(outgoing.has(b.name))-Number(outgoing.has(a.name)) ||
      a.name.localeCompare(b.name,'en'));
    const wrapper = make('div','sf-relations');
    const map = make('div','sfr-map');
    const ns = 'http://www.w3.org/2000/svg';
    const lines = document.createElementNS(ns,'svg');
    lines.setAttribute('class','sfr-lines');
    lines.setAttribute('aria-hidden','true');
    const layout = make('div','sfr-layout'+(related.length?'':' sfr-single'));
    const family = column('sfr-family','Catalog group');
    const selected = column('sfr-chosen','Selected form');
    const familyName = familyNames[form.family];
    const root = choice(familyName,()=>onFamily(form.family),'Browse '+familyName);
    const origin = choice(form.name);
    family.append(root);
    selected.append(origin);
    layout.append(family,selected);
    const list = make('ul','sfr-items');
    const branch = column('sfr-related','Related forms');
    const toggle = make('button','sfr-toggle');
    toggle.type='button';
    const limit = 4;
    let expanded = false;
    function renderList(){
      list.replaceChildren();
      for(const item of (expanded ? related : related.slice(0,limit))) {
        const li=make('li','');
        const outgoingNotes=form.review.edges.filter(e=>e.status==='supported'&&e.target===item.name);
        const incomingNotes=item.review.edges.filter(e=>e.status==='supported'&&e.target===form.name);
        const facts=[...outgoingNotes.map(edge=>({...edge, from:form.name})),...incomingNotes.map(edge=>({...edge, from:item.name}))];
        const relations={variant:'Variant connection',contains:'Component connection','shares-feature':'Shared feature',comparison:'Comparison',other:'Documented connection'};
        const kinds=[...new Set(facts.map(edge=>relations[edge.kind] || 'Documented connection'))];
        const button=choice(item.name,()=>onSelect(item.id),'Explore '+item.name);
        li.append(make('small','sfr-kind',kinds.join(' · ')),button);
        const evidence=make('details','sfr-basis');
        evidence.append(make('summary','','Evidence'));
        for(const note of new Set(facts.map(edge=>edge.from+' → '+edge.target+' · '+edge.evidence))) evidence.append(make('p','',note));
        li.append(evidence);
        list.append(li);
      }
      toggle.textContent=expanded?'Show fewer':'Show '+(related.length-limit)+' more';
      toggle.setAttribute('aria-expanded',String(expanded));
    }
    if(related.length) {
      renderList();
      branch.append(list);
      if(related.length>limit) branch.append(toggle);
      layout.append(branch);
    }
    map.append(lines,layout);
    wrapper.append(map);
    for(const {term,items} of titlePeers(form,forms,related)) {
      const details=make('details','sfr-peers');
      const summary=make('summary','','Other titles with “'+term+'” · '+items.length);
      const peers=make('ul','');
      for(const item of items) {
        const li=make('li','');
        const button=make('button','sfr-peer',item.name);
        button.type='button';
        button.addEventListener('click',()=>onSelect(item.id));
        li.append(button);
        peers.append(li);
      }
      details.append(summary,peers);
      wrapper.append(details);
    }
    container.replaceChildren(wrapper);
    let frame=0;
    function draw() {
      frame=0;
      lines.replaceChildren();
      const box=map.getBoundingClientRect();
      if(!box.width || !box.height) return;
      const stacked=wrapper.clientWidth<=620;
      function bounds(node){
        const r=node.getBoundingClientRect();
        return {x:r.x-box.x,y:r.y-box.y,w:r.width,h:r.height};
      }
      function mark(from,to){
        const a=bounds(from), b=bounds(to);
        const y=b.y+b.h/2;
        const end=b.x+4;
        const path=document.createElementNS(ns,'path');
        let d;
        if(stacked) {
          const x=a.x+(from===origin?5.5:4);
          const start=a.y+a.h/2+5;
          d='M '+x+' '+start+' V '+(y-7)+' Q '+x+' '+y+' '+(x+7)+' '+y+' H '+end;
        } else {
          const label=from.querySelector('.sfr-label');
          const text=document.createRange();
          text.selectNodeContents(label);
          const rows=Array.from(text.getClientRects()).filter(rect=>rect.width>0);
          const row=rows[Math.floor(rows.length/2)] || label.getBoundingClientRect();
          const start=row.right-box.left+8;
          const sy=row.top-box.top+row.height/2;
          const mid=(start+end)/2;
          d='M '+start+' '+sy+' C '+mid+' '+sy+' '+mid+' '+y+' '+end+' '+y;
        }
        path.setAttribute('d',d);
        path.setAttribute('fill','none');
        path.setAttribute('stroke',from===root?'#9aa1b2':'#acafd6');
        path.setAttribute('stroke-width','1.25');
        lines.append(path);
      }
      mark(root,origin);
      list.querySelectorAll('.sfr-node').forEach(n=>mark(origin,n));
    }
    function schedule(){ if(!frame) frame=requestAnimationFrame(draw); }
    toggle.addEventListener('click',()=>{
      expanded=!expanded;
      renderList();
      if(expanded) list.children[limit].querySelector('button').focus();
      schedule();
    });
    const observer=new ResizeObserver(schedule);
    observer.observe(map);
    observer.observe(wrapper);
    schedule();
    mounted.set(container,()=>{observer.disconnect();cancelAnimationFrame(frame);});
  };
}());
