// ─── Library chunk: marks ──────────────────────────────────────────────────
// Wrapped by the build as CMLibraryDefine('marks', function () { … }).
// The connection views' visual system (docs/design/connection-views/spec.md,
// frozen candidate r5): family marks, the six pair states, the ink selection
// ring and tag, the legend row, the count strip, arc geometry with one port per
// occurrence, and network nodes, edges and hull labels. The views place what
// these return and wire their own events; nothing here fetches, stores or
// listens.
//
// Rules this file keeps (spec, Jony Ives conditions 1–11):
// - hue means a relation family and nothing else; navigation and selection
//   are ink, and selection is a ring plus a tag, never a colour;
// - colour is never the only channel: every family also has a stroke pattern
//   and a glyph, every state a glyph or a fill that survives greyscale;
// - the layer is named in words; on arcs and edges a shared-sound mark is also
//   outline-only at 1 px, a registered figure 2 px;
// - a count is printed only when it was supplied; a missing one says so.
'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Relation families. Hue comes from the stylesheet (--lib-mk-<id>); the dash
// pattern and glyph are the second and third channels.
const FAMILIES = {
  alliteration: { glyph: 'A', label: 'alliteration', dash: '1.5 3.5' },
  rhyme: { glyph: 'R', label: 'rhyme', dash: '' },
  assonance: { glyph: 'V', label: 'assonance', dash: '8 4' },
  consonance: { glyph: 'C', label: 'consonance', dash: '3 3' },
  repetition: { glyph: '=', label: 'repetition', dash: '', double: true },
};

// The six pair states, in rank order, by the ids and words of
// src/connection-interaction.js (cellState, STATE_WORDS), which owns what each
// state says; these are only how each one looks. `not_examined` is a flat cell
// with no glyph: the method's domain reads as the lit shape around it.
const STATES = {
  holds: { glyph: null },
  undecided: { glyph: '?' },
  not_yet_computed: { glyph: '…' },
  refused: { glyph: '×' },
  does_not_hold: { glyph: '·' },
  not_examined: { glyph: null },
};
const STATE_ORDER = Object.keys(STATES);

// Stroke weight on arcs and edges by layer; the layer's name is words the
// caller supplies.
const LAYERS = { registered: { stroke: 2 }, sound: { stroke: 1 } };

function family(id) {
  const f = FAMILIES[id];
  if (!f) throw Error('Unknown relation family: ' + id);
  return f;
}
function layer(id) {
  const l = LAYERS[id || 'registered'];
  if (!l) throw Error('Unknown layer: ' + id);
  return l;
}

function svg(tag, attrs, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {}))
    if (v !== undefined && v !== null) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
}
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function html(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

// The marks' styles travel with this chunk, not in pages/library.css, so the
// shell the Library first loads does not grow. Hues: light measured on white,
// dark on #141414; every one ≥ 4.5:1, worst colour-blind pair ΔE 16, which is
// why each family also has a dash pattern and a glyph. Outside the method's
// locus is a flat sunken cell with no border, so the domain reads as a shape.
// Dimming touches only decorative edges and fills; text never dims.
const S = '#surface-library ';
const CSS = `
:root[data-theme='light']{--lib-mk-rhyme:#7954b3;--lib-mk-alliteration:#087e8b;--lib-mk-assonance:#b45309;--lib-mk-consonance:#be185d}
:root[data-theme='dark']{--lib-mk-rhyme:#b79cf0;--lib-mk-alliteration:#3cc2cf;--lib-mk-assonance:#f0a24b;--lib-mk-consonance:#f2789f}
${Object.keys(FAMILIES)
  .map((id) => `${S}.lib-mk-fam-${id}{--lib-mk-hue:var(--lib-mk-${id},var(--cm-text))}`)
  .join('\n')}
${S}.lib-mk-cell .lib-mk-bg{fill:var(--cm-surface);stroke:var(--cm-border);stroke-width:1}
${S}.lib-mk-cell-not_examined .lib-mk-bg{fill:var(--cm-surface-sunken);stroke:none}
${S}.lib-mk-cell-not_yet_computed .lib-mk-bg{stroke:var(--cm-text-muted)}
${S}.lib-mk-cell-holds .lib-mk-bg{stroke:var(--lib-mk-hue);stroke-width:1.5}
${S}.lib-mk-glyph{font:600 13px/1 var(--cm-font);fill:var(--cm-text-muted)}
${S}.lib-mk-cell-holds .lib-mk-glyph,${S}.lib-mk-edge-glyph{fill:var(--lib-mk-hue);font-weight:700}
${S}.lib-mk-edge-glyph,${S}.lib-mk-node-coord{paint-order:stroke;stroke:var(--cm-surface);stroke-width:8px;stroke-linejoin:round}
${S}.lib-mk-select{fill:none;stroke:var(--cm-text);stroke-width:2}
${S}.lib-mk-preview{fill:none;stroke:var(--cm-text);stroke-width:1;stroke-dasharray:3 2}
${S}.lib-mk-focus:is(:hover,:focus-visible){outline:1px dashed var(--cm-text);outline-offset:3px}
${S}.lib-mk-tag,${S}.lib-mk-strong{font-weight:700}
${S}.lib-mk-arc path{stroke:var(--lib-mk-hue)}
${S}.lib-mk-arc path.lib-mk-gap{stroke:var(--cm-surface)}
${S}.lib-mk-arc path.lib-mk-head{fill:var(--cm-text);stroke:none}
${S}.lib-mk-port line,${S}.lib-mk-port circle{stroke:var(--lib-mk-hue,var(--cm-text-muted));stroke-width:1.5;fill:var(--cm-surface)}
${S}.lib-mk-dim>path{opacity:.25}
${S}.lib-mk-node circle:first-child{fill:var(--cm-surface);stroke:var(--cm-text);stroke-width:1.5}
${S}.lib-mk-node-word{font:600 17px/1 var(--cm-font);fill:var(--cm-text)}
${S}.lib-mk-node-coord,${S}.lib-mk-node-also{font:12px/1 var(--cm-font);fill:var(--cm-text-secondary)}
${S}.lib-mk-hull-title{color:var(--lib-mk-hue);font-weight:600}
${S}.lib-mk-hull-count,${S}.lib-mk-count-lead{color:var(--cm-text)}
${S}.lib-mk-hull-note,${S}.lib-mk-count-rest,${S}.lib-mk-legend-families,${S}.lib-mk-legend-layers{color:var(--cm-text-muted);font-size:12px}
${S}.lib-mk-legend-states{display:flex;flex-wrap:wrap;gap:8px 24px;align-items:center}
${S}.lib-mk-legend-item{display:inline-flex;gap:8px;align-items:center}
`;
if (!document.getElementById('lib-mk-style')) {
  const style = document.createElement('style');
  style.id = 'lib-mk-style';
  style.textContent = CSS;
  document.head.append(style);
}

// ── Cells ───────────────────────────────────────────────────────────────────
// One matrix cell, size × size, at (x, y). `family` is required for holds.
function stateCell({ state, family: fam, x = 0, y = 0, size = 24, selected = false }) {
  const s = STATES[state];
  if (!s) throw Error('Unknown pair state: ' + state);
  const g = svg('g', { class: `lib-mk-cell lib-mk-cell-${state}`, 'data-state': state });
  const inset = state === 'not_examined' ? 0 : 0.5;
  const rect = svg('rect', {
    x: x + inset,
    y: y + inset,
    width: size - 2 * inset,
    height: size - 2 * inset,
    class: 'lib-mk-bg',
  });
  if (state === 'not_yet_computed') rect.setAttribute('stroke-dasharray', '2 2');
  g.append(rect);
  let glyph = s.glyph;
  if (state === 'holds') {
    const f = family(fam);
    g.classList.add(`lib-mk-fam-${fam}`);
    g.setAttribute('data-family', fam);
    glyph = f.glyph;
  }
  if (glyph)
    g.append(
      svg(
        'text',
        {
          x: x + size / 2,
          y: y + size / 2,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          class: 'lib-mk-glyph',
        },
        glyph
      )
    );
  if (selected) g.append(selectionRect(x, y, size, size));
  return g;
}

// ── Selection ───────────────────────────────────────────────────────────────
// The one selection treatment: a 2 px ink ring, offset outside the thing it
// selects, in every view.
function selectionRect(x, y, w, h, offset = 0) {
  return svg('rect', {
    x: x - offset,
    y: y - offset,
    width: w + 2 * offset,
    height: h + 2 * offset,
    class: 'lib-mk-select',
  });
}
function selectionRing(cx, cy, r) {
  return svg('circle', { cx, cy, r: r + 4, class: 'lib-mk-select' });
}
// The preview: what hover shows, and keyboard focus shows the same. A lighter
// ring in the selection's place (1 px, dashed ink), so a preview never reads as
// a choice already made. A view gives any focusable mark the class
// `lib-mk-focus` and the stylesheet draws it on :hover and :focus-visible;
// these builders are for a view that draws the preview itself.
function previewRect(x, y, w, h, offset = 0) {
  const r = selectionRect(x, y, w, h, offset);
  r.setAttribute('class', 'lib-mk-preview');
  return r;
}
function previewRing(cx, cy, r) {
  return svg('circle', { cx, cy, r: r + 4, class: 'lib-mk-preview' });
}
// `label` is the occurrence's words from connection-interaction.js
// (occurrenceLabel: "watch · L4 w2"), never the spelling alone.
function selectionTagHTML(label) {
  return html('span', 'lib-mk-tag', label);
}

// ── Arcs ────────────────────────────────────────────────────────────────────
// Ports: one per occurrence, at the top centre of its word box. Ports closer
// than `gap` are spread apart in order, so two words never share one.
function fanPorts(xs, gap = 6) {
  const order = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(xs.length);
  let last = -Infinity;
  for (const [x, i] of order) {
    out[i] = Math.max(x, last + gap);
    last = out[i];
  }
  return out;
}

// The path between two ports. a and b are { x, y, line, final }.
// - same line: a low arc directly above the line;
// - both line-final: out to the right margin, bowing outward (the margin
//   style), with `stems` the horizontal runs from each port to the margin;
// - otherwise: a bow through the inter-line space on the left.
function arcGeometry(a, b, { margin, gutter, lift = 28 } = {}) {
  if (a.line === b.line) {
    const h = Math.min(lift, 8 + Math.abs(b.x - a.x) * 0.15);
    return {
      route: 'same-line',
      d: `M${a.x},${a.y} C${a.x},${a.y - h} ${b.x},${b.y - h} ${b.x},${b.y}`,
      stems: [],
      head: { x: b.x, y: b.y, angle: 90 },
    };
  }
  if (a.final && b.final) {
    if (margin === undefined) throw Error('arcGeometry: margin is required for line-final pairs');
    const [top, bottom] = a.y <= b.y ? [a, b] : [b, a];
    const bow = Math.min(80, 12 + (bottom.y - top.y) * 0.25);
    return {
      route: 'margin',
      d: `M${margin},${top.y} C${margin + bow},${top.y} ${margin + bow},${bottom.y} ${margin},${bottom.y}`,
      stems: [`M${a.x},${a.y} H${margin}`, `M${b.x},${b.y} H${margin}`],
      head: { x: b.x, y: b.y, angle: b.x < margin ? 180 : 0 },
    };
  }
  if (gutter === undefined) throw Error('arcGeometry: gutter is required for interior pairs');
  return {
    route: 'interline',
    d: `M${a.x},${a.y} C${gutter},${a.y} ${gutter},${b.y} ${b.x},${b.y}`,
    stems: [],
    head: { x: b.x, y: b.y, angle: b.x < gutter ? 180 : 0 },
  };
}

// A role-ordered binding's ink arrowhead (spec condition 1: "ink arrowhead +
// 'a → b' in inspector"), its tip just outside b's port, pointing the way the
// arc arrives. `head` is where it arrives (arcGeometry, edge); `back` sets
// the tip off a port, and is 0 at a node's rim. Ink, not hue: direction is
// not a family. A path, so it dims with its arc.
function arrowhead({ x, y, angle, back = 5 }) {
  const t = (angle * Math.PI) / 180,
    ux = Math.cos(t),
    uy = Math.sin(t);
  const tx = x - ux * back,
    ty = y - uy * back;
  const bx = tx - ux * 8,
    by = ty - uy * 8;
  const f = (n) => Math.round(n * 100) / 100;
  return svg('path', {
    d: `M${f(tx)},${f(ty)} L${f(bx - uy * 4)},${f(by + ux * 4)} L${f(bx + uy * 4)},${f(by - ux * 4)} Z`,
    class: 'lib-mk-head',
  });
}

// An arc (or network edge path) in its family's hue and pattern, at its
// layer's weight. Only holds are drawn: an arc says "these connect".
function arc(
  geometry,
  { family: fam, layer: lay = 'registered', dim = false, directed = false } = {}
) {
  const f = family(fam);
  const l = layer(lay);
  if (directed && !geometry.head) throw Error('arc: a directed arc needs its geometry.head');
  const g = svg('g', {
    class: `lib-mk-arc lib-mk-fam-${fam} lib-mk-layer-${lay}${dim ? ' lib-mk-dim' : ''}`,
    'data-family': fam,
    'data-layer': lay,
    'data-directed': directed ? 'true' : null,
  });
  const paths = [geometry.d, ...(geometry.stems || [])];
  for (const d of paths) {
    const p = svg('path', {
      d,
      fill: 'none',
      'stroke-width': l.stroke,
      'stroke-dasharray': f.dash || null,
    });
    g.append(p);
    if (f.double) {
      p.setAttribute('stroke-width', l.stroke * 3);
      g.append(
        svg('path', {
          d,
          fill: 'none',
          'stroke-width': Math.max(1, l.stroke * 3 - 2),
          class: 'lib-mk-gap',
        })
      );
    }
  }
  if (directed) g.append(arrowhead(geometry.head));
  return g;
}

function port(x, y, { family: fam } = {}) {
  const g = svg('g', { class: 'lib-mk-port' + (fam ? ` lib-mk-fam-${fam}` : '') });
  g.append(
    svg('line', { x1: x, y1: y, x2: x, y2: y + 8 }),
    svg('circle', { cx: x, cy: y, r: 3.5 })
  );
  return g;
}

// ── Network ─────────────────────────────────────────────────────────────────
// Every node has one radius and an ink outline; hue lives on edges and hulls.
// The word sits inside, its coordinate below.
function node(occ, { cx, cy, r = 37, selected = false, alsoIn = [] }) {
  const g = svg('g', { class: 'lib-mk-node', 'data-line': occ.line, 'data-token': occ.token });
  g.append(
    svg('circle', { cx, cy, r }),
    svg(
      'text',
      {
        x: cx,
        y: cy,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        class: 'lib-mk-node-word',
      },
      occ.text
    ),
    svg(
      'text',
      {
        x: cx,
        y: cy + r + 16,
        'text-anchor': 'middle',
        class: 'lib-mk-node-coord' + (selected ? ' lib-mk-strong' : ''),
      },
      `L${occ.line} w${occ.token}`
    )
  );
  if (alsoIn.length)
    g.append(
      svg(
        'text',
        { x: cx, y: cy + r + 32, 'text-anchor': 'middle', class: 'lib-mk-node-also' },
        'also in: ' + alsoIn.map((id) => family(id).glyph).join(' ')
      )
    );
  if (selected) g.append(selectionRing(cx, cy, r));
  return g;
}

function edge(
  a,
  b,
  { family: fam, layer: lay = 'registered', dim = false, glyph = false, r = 37, directed = false }
) {
  const dx = b.cx - a.cx,
    dy = b.cy - a.cy,
    len = Math.hypot(dx, dy) || 1;
  const ux = dx / len,
    uy = dy / len;
  const d = `M${a.cx + ux * r},${a.cy + uy * r} L${b.cx - ux * r},${b.cy - uy * r}`;
  const head = {
    x: b.cx - ux * r,
    y: b.cy - uy * r,
    angle: (Math.atan2(uy, ux) * 180) / Math.PI,
    back: 0,
  };
  const g = arc({ d, stems: [], head }, { family: fam, layer: lay, dim, directed });
  g.classList.add('lib-mk-edge');
  if (glyph)
    g.append(
      svg(
        'text',
        {
          x: (a.cx + b.cx) / 2,
          y: (a.cy + b.cy) / 2,
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          class: 'lib-mk-glyph lib-mk-edge-glyph',
        },
        family(fam).glyph
      )
    );
  return g;
}

// A hull's caption. `shown` holds out of `examined` eligible, evaluated pairs;
// pending and hidden appear only when non-zero. The consistency line is always
// there: no view claims one reading fits the whole group.
function hullLabel({
  family: fam,
  occurrences,
  shown,
  examined,
  pending = 0,
  hidden = 0,
  fixture = false,
}) {
  const f = family(fam);
  for (const [k, v] of Object.entries({ occurrences, shown, examined }))
    if (!Number.isInteger(v) || v < 0) throw Error(`hullLabel: ${k} must be a supplied count`);
  const box = html('div', `lib-mk-hull lib-mk-fam-${fam}`);
  const title = html('div', 'lib-mk-hull-title');
  title.append(html('span', 'lib-mk-glyph', f.glyph), document.createTextNode(' ' + f.label));
  const verb = fixture ? 'illustrated' : 'hold';
  const parts = [
    `${occurrences} occurrence${occurrences === 1 ? '' : 's'}`,
    `${shown} of ${examined} eligible pair${examined === 1 ? '' : 's'} ${verb}`,
  ];
  if (pending) parts.push(`${pending} pending`);
  if (hidden) parts.push(`${hidden} hidden`);
  box.append(
    title,
    html('div', 'lib-mk-hull-count', parts.join(' · ')),
    html('div', 'lib-mk-hull-note', 'Joint reading consistency not assessed')
  );
  return box;
}

// ── Legend and counts ───────────────────────────────────────────────────────
// `words` is STATE_WORDS from connection-interaction.js.
function legendRow({ words, families = Object.keys(FAMILIES), examples = false } = {}) {
  if (!words) throw Error('legendRow: words are required');
  const row = html('div', 'lib-mk-legend');
  const states = html('div', 'lib-mk-legend-states');
  if (examples) states.append(html('span', 'lib-mk-legend-note', 'State key · examples only'));
  for (const id of STATE_ORDER) {
    const item = html('span', 'lib-mk-legend-item');
    const box = svg('svg', { width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': 'true' });
    box.append(
      stateCell({ state: id, family: id === 'holds' ? families[0] : undefined, size: 24 })
    );
    item.append(box, html('span', null, cap(words[id])));
    states.append(item);
  }
  const fams = html(
    'div',
    'lib-mk-legend-families',
    'Families: ' +
      families.map((id) => `${FAMILIES[id].glyph} ${FAMILIES[id].label}`).join(' · ') +
      '. Selection uses ink, never hue.'
  );
  const layers = html(
    'div',
    'lib-mk-legend-layers',
    'Registered figure: solid, 2 px · Shared sound: outline only, 1 px'
  );
  row.append(states, fams, layers);
  return row;
}

// The strip under a view's title. `counts` maps state → number; a state with
// no number is reported as not supplied, never as zero. `provenance` says what
// produced the numbers ("fixture only", "Library schema analysis at <rev>").
function countStrip(counts, { words, provenance, emptyOnset, hidden, population } = {}) {
  if (!provenance) throw Error('countStrip: provenance is required');
  if (!words) throw Error('countStrip: words are required');
  const strip = html('div', 'lib-mk-count');
  const lead = html('div', 'lib-mk-count-lead');
  const holds = counts.holds;
  // A named population says what was counted ("method–token binding");
  // figures, when counted, are reported beside it and never added to it.
  const pop = typeof population === 'string' ? `${population} ` : '';
  const figs = counts.figure_holds;
  lead.textContent =
    (Number.isInteger(holds)
      ? `${holds} ${pop}hold${holds === 1 ? '' : 's'} ${pop ? 'loaded' : 'shown'}`
      : 'Holds: not supplied') +
    (pop && Number.isInteger(figs)
      ? ` · ${figs} figure hold${figs === 1 ? '' : 's'} counted separately`
      : '') +
    ` · ${provenance}`;
  if (Number.isInteger(emptyOnset) && emptyOnset > 0)
    lead.textContent += ` · ${emptyOnset} only empty onsets compared`;
  if (hidden && Number.isInteger(hidden.count) && hidden.count > 0)
    lead.textContent += ` · ${hidden.count} hidden by ${hidden.by}`;
  const known = [],
    missing = [];
  for (const id of STATE_ORDER.slice(1)) {
    if (id === 'not_examined') continue;
    if (Number.isInteger(counts[id])) known.push(`${counts[id]} ${words[id]}`);
    else missing.push(cap(words[id]));
  }
  const rest = html('div', 'lib-mk-count-rest');
  const bits = [];
  if (known.length) bits.push(known.join(' · '));
  if (missing.length) bits.push(missing.join(' / ') + ': not supplied');
  bits.push('outside locus is method-specific');
  rest.textContent = bits.join(' · ');
  strip.append(lead, rest);
  return strip;
}

return {
  FAMILIES,
  STATES,
  STATE_ORDER,
  LAYERS,
  stateCell,
  selectionRect,
  selectionRing,
  previewRect,
  previewRing,
  selectionTagHTML,
  fanPorts,
  arcGeometry,
  arc,
  arrowhead,
  port,
  node,
  edge,
  hullLabel,
  legendRow,
  countStrip,
};
