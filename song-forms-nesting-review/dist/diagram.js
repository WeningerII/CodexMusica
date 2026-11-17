(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const ink = '#172238';
  const indigo = '#4349bc';
  const roles = [
    [/\b(chorus|refrain|hook)\b/i, '#167565'],
    [/\b(bridge|turnaround|episode)\b/i, '#98651b'],
    [/\b(verse|strophe)\b/i, '#4353ae'],
    [/\b(coda|tag|envoi|outro)\b/i, '#846087']
  ];
  const palette = [indigo, '#397e92', '#8770a5', '#537884'];

  function tone(label, index) {
    const role = roles.find(([pattern]) => pattern.test(label));
    return role ? role[1] : palette[index % palette.length];
  }
  function tag(name, cls) {
    const node = document.createElement(name);
    if (cls) node.className = cls;
    return node;
  }
  function svgTag(name, attributes, content) {
    const node = document.createElementNS(NS, name);
    Object.entries(attributes).forEach(([k,v]) => node.setAttribute(k,v));
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function setStyles() {
    if (document.getElementById('sf-structure-style')) return;
    const style = tag('style');
    style.id = 'sf-structure-style';
    style.textContent = `
.sf-structure {margin:0; width:100%; min-width:0; color:#172238}
.sf-structure .sf-arch {display:block;width:100%;overflow:visible}
.sf-structure .sf-transcript {position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.sf-structure .sf-list,.sf-structure .sf-list :is(ol,ul) {margin:0;padding:0;list-style:none}
.sf-structure .sf-list li {--indent:clamp(9px,2.5vw,18px); margin:0;padding:0;min-width:0;line-height:1.4;position:relative}
.sf-structure .sf-list :is(ol,ul) {margin-left:4px;padding-left:var(--indent);border-left:1px solid #cbd0df}
.sf-structure .sf-list :is(ol,ul)>li:before {content:"";position:absolute;left:calc(var(--indent) * -1);top:1.1em;width:var(--indent);border-top:1px solid #cbd0df}
.sf-structure .sf-list .sf-node {display:flex;align-items:baseline;gap:9px;padding:5px 0;overflow-wrap:anywhere;font-size:14px;letter-spacing:normal}
.sf-structure .sf-list>li+li {margin-top:8px}
.sf-structure .sf-list .sf-group>.sf-node {font-weight:650}
.sf-structure .sf-list .sf-node::before {content:"";display:inline-block;align-self:flex-start;margin-top:.48em;width:8px;height:8px;flex:0 0 8px;border-radius:50%;background:var(--node-color);outline:2px solid var(--sf-diagram-bg,#fffefa)}
.sf-structure .sf-list .sf-group>.sf-node::before {border-radius:2px}
.sf-structure.sf-vertical {position:relative}
.sf-vertical .sf-side-arches {position:absolute;top:0;left:0;display:block;pointer-events:none}
.sf-structure.sf-vertical>.sf-list {padding:3px 0 3px var(--plot-width)}
.sf-structure.sf-vertical .sf-list :is(ol,ul) {border:0;padding:0;margin:0}
.sf-structure.sf-vertical .sf-list li {padding:0;margin:0}
.sf-structure.sf-vertical .sf-list li::before,.sf-structure.sf-vertical .sf-list .sf-node::before {display:none}
.sf-structure.sf-vertical .sf-list .sf-node {display:block;min-height:29px;box-sizing:border-box;padding:5px 0 5px 11px;font-size:14px;line-height:1.4}
.sf-structure.sf-vertical .sf-list .sf-group>.sf-node {color:#3b4562}
@media(forced-colors:active){.sf-structure .sf-node::before {background:CanvasText!important}.sf-structure .sf-arch path {stroke:CanvasText}}
`;
    document.head.appendChild(style);
  }

  function treeLayout(nodes) {
    const leaves = [], groups = [];
    function visit(source) {
      if (typeof source === 'string') {
        const leaf = {label:source, first:leaves.length, last:leaves.length, level:0};
        leaves.push(leaf);
        return leaf;
      }
      const children = source.children.map(visit);
      const parent = {
        label:source.label, children,
        first:children[0].first, last:children[children.length-1].last,
        level:1 + Math.max(...children.map(n => n.level))
      };
      groups.push(parent);
      return parent;
    }
    const roots = nodes.map(visit);
    return {leaves,groups,roots};
  }
  function semanticTree(nodes, paletteByLabel, tagName) {
    const list = tag(tagName);
    list.setAttribute('role','list');
    nodes.forEach(node => {
      const item = tag('li',node.children?'sf-group':'');
      const name = tag('span','sf-node');
      name.textContent = node.label;
      node.row = name;
      name.style.setProperty('--node-color',node.children?indigo:paletteByLabel.get(node.label));
      item.appendChild(name);
      if (node.children) item.appendChild(semanticTree(node.children,paletteByLabel,tagName));
      list.appendChild(item);
    });
    return list;
  }
  function wrap(text, limit, measure) {
    const lines = [];
    for (const word of text.split(/\s+/)) {
      if (measure(word)>limit) return null;
      const last = lines[lines.length-1];
      if (last && measure(last+' '+word)<=limit) lines[lines.length-1]=last+' '+word;
      else lines.push(word);
    }
    return lines;
  }

  // In portrait mode the reading direction turns down the page. The text list
  // is the layout, so a wrapped label or larger font also moves the arc endpoints.
  function verticalArches(figure,roots,leaves,groups,width,paletteByLabel) {
    if (width<220 || groups.length+leaves.length>30 || roots.some(n=>n.level>4)) return;
    const plotWidth=Math.round(Math.min(92,Math.max(52,width*.225)));
    const baseline=plotWidth-3;
    figure.style.setProperty('--plot-width',plotWidth+'px');
    figure.classList.add('sf-vertical');
    const box=figure.getBoundingClientRect();
    if (!box.height) return;
    const svg=svgTag('svg',{class:'sf-side-arches',width:plotWidth,height:box.height,
      viewBox:'0 0 '+plotWidth+' '+box.height,'aria-hidden':'true',focusable:'false'});
    function locate(node) {
      const row=node.row.getBoundingClientRect();
      node.start=row.top-box.top+2;
      node.middle=(row.top+row.bottom)/2-box.top;
      node.end=row.bottom-box.top-2;
      node.radius=11;
      if (node.children) {
        node.children.forEach(locate);
        node.end=node.children[node.children.length-1].end;
        node.radius=enclosingRadius(node.start,node.end,node.children);
      }
    }
    function enclosingRadius(start,end,children) {
      return Math.max(...children.map(c=>Math.max(c.radius+15,
        c.radius*Math.sqrt((end-start)/Math.max(1,c.end-c.start))+6)));
    }
    roots.forEach(locate);
    const start=roots[0].start,end=roots[roots.length-1].end;
    const fullRadius=roots.length>1?enclosingRadius(start,end,roots):roots[0].radius;
    const scale=Math.min(1.6,(baseline-4)/fullRadius);
    function arc(start,end,radius,color,stroke,filled) {
      const d='M '+baseline+' '+start+' A '+radius*scale+' '+(end-start)/2+' 0 0 0 '+baseline+' '+end;
      svg.appendChild(svgTag('path',{d,stroke:color,'stroke-width':stroke,'stroke-linecap':'round',
        fill:filled?color:'none','fill-opacity':filled ? .08 : 0}));
    }
    svg.appendChild(svgTag('line',{x1:baseline,x2:baseline,y1:start,y2:end,stroke:'#cbd0df'}));
    if(roots.length>1)arc(start,end,fullRadius,indigo,1.8,false);
    groups.slice().reverse().forEach(n=>arc(n.start,n.end,n.radius,'#727ab4',1.55,false));
    leaves.forEach(n=>arc(n.start,n.end,n.radius,paletteByLabel.get(n.label),2.2,true));
    [...groups,...leaves].forEach(n=>{
      const color=n.children?'#727ab4':paletteByLabel.get(n.label);
      svg.appendChild(svgTag('circle',{cx:baseline,cy:n.middle,r:n.children?2:2.6,fill:color}));
    });
    figure.prepend(svg);
  }

  window.drawStructure = (container,form) => {
    if (form.review && form.review.status === 'unresolved') {container.replaceChildren();return;}
    setStyles();
    const width = Math.max(1,Math.floor(container.clientWidth));
    const {leaves,groups,roots} = treeLayout(form.tree);
    const paletteByLabel = new Map();
    leaves.forEach(leaf => {
      if (!paletteByLabel.has(leaf.label)) paletteByLabel.set(leaf.label,tone(leaf.label,paletteByLabel.size));
    });
    const figure = tag('figure','sf-structure');
    figure.setAttribute('aria-label',form.name+' structure · '+form.mode);
    const textTree = semanticTree(roots,paletteByLabel,form.mode==='Rule'?'ul':'ol');
    textTree.classList.add('sf-list');
    figure.appendChild(textTree);
    container.replaceChildren(figure);
    const maxDepth = Math.max(...roots.map(n => n.level));
    const gutter = 15;
    const cell = (width-2*gutter)/leaves.length;
    if (form.mode==='Rule') return;
    const vertical=()=>verticalArches(figure,roots,leaves,groups,width,paletteByLabel);
    if (width<390 || cell<61 || maxDepth>4) return vertical();

    const family = getComputedStyle(container).fontFamily || 'system-ui';
    const measureContext = document.createElement('canvas').getContext('2d');
    if (!measureContext) return vertical();
    measureContext.font = '600 13px '+family;
    const measure = text=>measureContext.measureText(text).width;
    const labels = leaves.map(leaf=>wrap(leaf.label,cell-12,measure));
    if (labels.some(lines=>!lines || lines.length>3)) return vertical();
    if (groups.some(node=>measure(node.label)+18>cell*(node.last-node.first+1))) return vertical();

    // Every span starts and ends at a leaf boundary. All arches share one baseline.
    const leafHeight = 29;
    const count = node => node.last-node.first+1;
    function spanHeight(span,children) {
      // Near a shared endpoint an ellipse grows as sqrt(x). Scaling height
      // by sqrt(parent span / child span) keeps the entire child arc inside.
      return Math.max(...children.map(child=>Math.max(child.height+48,
        child.height*Math.sqrt(span/count(child))+12)));
    }
    leaves.forEach(node=>{node.height=leafHeight;});
    groups.forEach(node=>{node.height=spanHeight(count(node),node.children);});
    const outerHeight = roots.length===1 ? roots[0].height : spanHeight(leaves.length,roots);
    const baseline = 22+outerHeight;
    const height = baseline+31+17*Math.max(...labels.map(lines=>lines.length));
    const svg = svgTag('svg',{viewBox:'0 0 '+width+' '+height,height,class:'sf-arch','aria-hidden':'true',focusable:'false'});
    svg.style.fontFamily = family;
    const segment = node => [gutter+cell*node.first,gutter+cell*(node.last+1)];
    const arch = (start,end,ry,color,stroke,opacity) => {
      const rx=(end-start)/2;
      const curve='M '+start+' '+baseline+' A '+rx+' '+ry+' 0 0 1 '+end+' '+baseline;
      svg.appendChild(svgTag('path',{d:curve,fill:'none',stroke:color,'stroke-width':stroke,'stroke-opacity':opacity,'stroke-linecap':'round'}));
    };
    if (roots.length>1) arch(gutter,width-gutter,outerHeight,indigo,2.1,.8);
    groups.slice().sort((a,b)=>b.level-a.level).forEach(node=>{
      const [start,end]=segment(node);
      arch(start,end,node.height,indigo,1.6,.64);
      const label=svgTag('text',{x:(start+end)/2,y:baseline-node.height-8,
        'text-anchor':'middle','font-size':12,'font-weight':600,fill:ink,stroke:'var(--sf-diagram-bg,#fffefa)','stroke-width':5,'paint-order':'stroke'},node.label);
      svg.appendChild(label);
    });
    svg.appendChild(svgTag('line',{x1:gutter,x2:width-gutter,y1:baseline,y2:baseline,stroke:'#c9cdd9','stroke-width':1}));
    leaves.forEach((node,i)=>{
      const [start,end]=segment(node), color=paletteByLabel.get(node.label);
      const rx=(end-start)/2;
      svg.appendChild(svgTag('path',{d:'M '+start+' '+baseline+' A '+rx+' '+leafHeight+' 0 0 1 '+end+' '+baseline+' Z',fill:color,'fill-opacity':.065}));
      arch(start,end,leafHeight,color,2.5,.98);
      const label=svgTag('text',{x:start+rx,'text-anchor':'middle',fill:ink,'font-size':13,'font-weight':600});
      labels[i].forEach((line,j)=>label.appendChild(svgTag('tspan',{x:start+rx,y:baseline+24+j*17},line)));
      svg.appendChild(label);
    });
    for (let i=0;i<=leaves.length;i++) svg.appendChild(svgTag('circle',{cx:gutter+i*cell,cy:baseline,r:2.3,fill:ink}));
    textTree.classList.add('sf-transcript');
    figure.prepend(svg);
  };
})();
