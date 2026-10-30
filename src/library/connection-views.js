// Isolated Library chunk. Deliberately absent from production loaders/manifests.
// Supply Don's CMConnectionInteraction and Jony's marks chunk to createViews.
// This presentation adapter consumes supplied cells, counts and coverage only:
// it performs no analysis, syllabification, domain inference or network requests.
'use strict';

// Adapter model: occurrences {entity_id,text,line,token,final}; methods
// {method_id,name,layer,family,ordering,member_roles,matrix_projection,coverage,
// disabledReason}; cells {selection,inLocus,record,jobComplete,domainCertified}.
// counts/groupCounts and provenance describe supplied populations, not inferred
// totals. poem contains full lines plus caller-measured token boxes. Figures
// retain native members and evidence_id. This is not a backend schema adapter.
// Returned DOM carries data-selection (Don's selectionKey), data-method,
// data-view, data-action=cell_method and data-recovery hooks for Don's bindings.
// The owner updates the immutable model and rerenders after an action; no event,
// URL, live-region or lifecycle ownership is claimed here.
function createViews({ interaction: I, marks: M, bindings: B, actions, live }) {
  // Optional composed controls use Don's handlers, never local replacements.
  if (
    B &&
    (!actions || typeof actions.cellMethod !== 'function' || typeof actions.show !== 'function')
  )
    throw new TypeError('bindings require cellMethod and show callbacks');
  if (!I || !M) throw new TypeError('connection views require interaction and marks');
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const svg = (tag, attrs, text) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  };
  const layerName = (m) => I.LAYER_WORDS[m.layer];
  const methodName = (m) => `${layerName(m)} · ${m.name}`;
  const describe = (value) =>
    value == null ? 'not supplied' : typeof value === 'string' ? value : JSON.stringify(value);
  const action = (node, selection) => {
    node.dataset.selection = I.selectionKey(selection);
    return node;
  };
  const button = (text, selection) => action(el('button', text), selection);
  // Each cell carries a Don selection plus explicit domain/population facts.
  // A missing cell descriptor is unknown to this adapter, never false.
  const findCell = (model, selection) =>
    model.cells.find((c) => I.sameSelection(c.selection, selection));
  const result = (cell) => (cell ? I.cellState(cell) : null);
  const stateText = (cell) => (cell ? I.stateWords(result(cell)) : 'Not supplied');
  const selected = (model, sel) => I.sameSelection(model.selection, sel);
  const touched = (model) => new Set(I.selectionOccurrences(model.selection));
  const getMethod = (model, id) => model.methods.find((m) => m.method_id === id);
  const getOcc = (model, id) => model.occurrences.find((o) => o.entity_id === id);
  const checked = (model) =>
    model.methods.filter((m) => model.checkedMethods.includes(m.method_id) && !m.disabledReason);
  function pairSelection(m, a, b) {
    return m.ordering === 'unordered'
      ? I.pair(m.method_id, a, b)
      : I.binding(m.method_id, [
          { role: m.member_roles[0], entity_id: a },
          { role: m.member_roles[1], entity_id: b },
        ]);
  }
  function controls(model, view) {
    const box = el('div', null, 'cv-controls');
    const menu = el('details');
    menu.append(
      el(
        'summary',
        `Method · ${
          checked(model)
            .map((m) => m.name)
            .join(' + ') || 'None checked'
        }`
      )
    );
    for (const layer of ['registered', 'sound']) {
      const group = el('fieldset');
      group.append(
        el('legend', layer === 'registered' ? 'Registered figures' : I.LAYER_WORDS.sound)
      );
      for (const m of model.methods.filter((m) => m.layer === layer)) {
        const label = el('label');
        const input = el('input');
        input.type = 'checkbox';
        input.checked = model.checkedMethods.includes(m.method_id);
        input.disabled = !!m.disabledReason;
        input.dataset.method = m.method_id;
        label.append(
          input,
          document.createTextNode(m.name + (m.disabledReason ? ` · ${m.disabledReason}` : ''))
        );
        group.append(label);
      }
      menu.append(group);
    }
    box.append(menu);
    if (view === 'matrix' && B) {
      const control = B.cellShowsControl(
        document,
        I,
        checked(model),
        model.cellMethod,
        actions.cellMethod,
        live
      );
      box.append(control.el);
    } else if (view === 'matrix') {
      const choice = I.cellShows(checked(model), model.cellMethod);
      const label = el('label', 'Cell shows '),
        select = el('select');
      select.dataset.action = 'cell_method';
      for (const option of choice.options) {
        const item = el('option', option.label);
        item.value = option.method_id;
        item.selected = option.method_id === choice.selected;
        select.append(item);
      }
      select.disabled = !choice.selected;
      label.append(select);
      box.append(label);
      if (choice.notice) box.append(el('p', choice.notice));
    }
    return box;
  }
  function inspector(model) {
    const pane = el('aside', null, 'cv-inspector');
    pane.setAttribute('aria-label', 'Connection inspector');
    pane.append(el('h2', 'Inspector'));
    const sel = model.selection;
    if (!sel) {
      pane.append(el('p', 'Select an occurrence or connection'));
      return pane;
    }
    if (sel.kind === 'occurrence') {
      const o = getOcc(model, sel.entity_id);
      pane.append(el('h3', o ? I.occurrenceLabel(o) : 'Occurrence no longer available'));
      for (const cell of model.cells.filter((c) =>
        I.selectionOccurrences(c.selection).includes(sel.entity_id)
      )) {
        const m = getMethod(model, cell.selection.method_id);
        pane.append(
          button(
            `${methodName(m)} · ${I.selectionOccurrences(cell.selection)
              .map((id) => I.occurrenceLabel(getOcc(model, id)))
              .join(cell.selection.kind === 'binding' ? ' → ' : ' ↔ ')} · ${stateText(cell)}`,
            cell.selection
          )
        );
      }
      return pane;
    }
    const cell =
      sel.kind === 'figure'
        ? model.figures?.find((f) => f.evidence_id === sel.evidence_id)
        : findCell(model, sel);
    const m = getMethod(model, sel.method_id || cell?.method_id);
    if (m) pane.append(el('h3', methodName(m)));
    if (sel.kind === 'figure') {
      pane.append(el('h3', `Figure / span · ${sel.evidence_id}`));
      pane.append(el('p', describe(cell?.members)));
    } else {
      const members =
        sel.kind === 'binding' ? sel.members : sel.members.map((entity_id) => ({ entity_id }));
      pane.append(
        el(
          'h3',
          members
            .map(
              (member) =>
                `${member.role ? member.role + ': ' : ''}${I.occurrenceLabel(getOcc(model, member.entity_id))}`
            )
            .join(sel.kind === 'binding' ? ' → ' : ' ↔ ')
        )
      );
    }
    pane.append(el('p', stateText(cell), 'cv-verdict'));
    const record = cell?.record;
    for (const [label, value] of [
      ['Whole-word witness', record?.witness],
      [
        'Compared span / anchors (engine supplied)',
        record?.compared ?? 'compared syllable not reported for this reading',
      ],
      ['Quantifier', record?.quantifier],
      ['Locus', record?.placement_reads],
      ['Licence', record?.licence],
      ['Alternate reading outcomes', record?.alternates],
      ['Reading search', record?.reading_search],
    ]) {
      pane.append(el('h4', label), el('p', describe(value)));
    }
    return pane;
  }
  function matrix(model) {
    const box = el('div', null, 'cv-matrix');
    const choice = I.cellShows(checked(model), model.cellMethod);
    const m = getMethod(model, choice.selected);
    if (!m) {
      box.append(el('p', 'No method checked'));
      return box;
    }
    if (m.matrix_projection !== 'exact_token_pair') {
      box.append(
        el(
          'p',
          'This method retains its native figure / span bindings below. No pair-cell projection.'
        )
      );
      return box;
    }
    const occurrences = I.readingOrder(model.occurrences);
    const table = el('table', null, 'cv-desktop-matrix');
    table.append(
      el(
        'caption',
        `${methodName(m)} · ${m.ordering === 'unordered' ? 'unordered pairs shown once' : 'row → column; role order preserved'}`
      )
    );
    const head = el('tr');
    head.append(el('th', 'Occurrence'));
    for (const o of occurrences) {
      const h = el('th', I.occurrenceLabel(o));
      h.scope = 'col';
      head.append(h);
    }
    table.append(head);
    occurrences.forEach((a, row) => {
      const tr = el('tr'),
        h = el('th', I.occurrenceLabel(a));
      h.scope = 'row';
      tr.append(h);
      occurrences.forEach((b, col) => {
        const td = el('td');
        if (row !== col && (m.ordering !== 'unordered' || row < col)) {
          const sel = pairSelection(m, a.entity_id, b.entity_id),
            cell = findCell(model, sel);
          const btn = button('', sel);
          btn.dataset.row = row;
          btn.dataset.col = col;
          btn.setAttribute(
            'aria-label',
            `${I.occurrenceLabel(a)} ${m.ordering === 'unordered' ? '↔' : '→'} ${I.occurrenceLabel(b)} · ${stateText(cell)}`
          );
          if (cell) {
            const mark = svg('svg', {
              width: 34,
              height: 34,
              viewBox: '-4 -4 32 32',
              'aria-hidden': 'true',
            });
            mark.append(
              M.stateCell({
                state: result(cell).state,
                family: m.family,
                selected: selected(model, sel),
              })
            );
            btn.append(mark);
          } else btn.textContent = 'NS';
          if (selected(model, sel)) btn.classList.add('cv-selected');
          td.append(btn);
        }
        tr.append(td);
      });
      table.append(tr);
    });
    const scroll = el('div', null, 'cv-scroll');
    scroll.append(table);
    scroll.append(el('p', 'NS = not supplied; not an engine state.'));
    box.append(scroll);
    const phone = el('section', null, 'cv-phone-row');
    const focus = model.rowOccurrence || I.selectionOccurrences(model.selection)[0];
    const a = getOcc(model, focus);
    phone.append(
      el(
        'h3',
        a ? `Matrix row · ${I.occurrenceLabel(a)}` : 'Select an occurrence to show its matrix row'
      )
    );
    if (a)
      for (const b of occurrences.filter((o) => o.entity_id !== a.entity_id)) {
        const sel = pairSelection(m, a.entity_id, b.entity_id),
          cell = findCell(model, sel);
        const btn = button('', sel);
        btn.append(el('strong', I.occurrenceLabel(b)), el('span', stateText(cell)));
        if (selected(model, sel)) btn.classList.add('cv-selected');
        phone.append(btn);
      }
    box.append(phone);
    return box;
  }
  function holds(model, method) {
    return model.cells.filter(
      (c) =>
        c.selection.method_id === method.method_id &&
        c.selection.kind === 'pair' &&
        result(c).state === 'holds'
    );
  }
  function poem(model) {
    const box = el('div', null, 'cv-scroll'),
      points = new Map(),
      active = touched(model);
    // Token boxes are presentation geometry, supplied by the caller after text
    // layout. A full source line stays intact, including unselected function words.
    const canvas = svg('svg', {
      viewBox: `0 0 ${model.poem.width} ${model.poem.height}`,
      width: model.poem.width,
      height: model.poem.height,
      'aria-label': 'Poem and supplied holding connections',
    });
    for (const line of model.poem.lines)
      canvas.append(svg('text', { x: 48, y: line.y, class: 'cv-poem-line' }, line.text));
    for (const o of model.occurrences) {
      const p = model.poem.boxes[o.entity_id];
      if (!p) continue;
      points.set(o.entity_id, { x: p.x + p.width / 2, y: p.y - 24, line: o.line, final: o.final });
    }
    for (const m of checked(model))
      for (const cell of holds(model, m)) {
        const [a, b] = cell.selection.members.map((id) => points.get(id));
        if (!a || !b) continue;
        const arc = M.arc(M.arcGeometry(a, b, { margin: model.poem.width - 90, gutter: 10 }), {
          family: m.family,
          layer: m.layer,
          dim: active.size > 0 && !cell.selection.members.some((id) => active.has(id)),
        });
        action(arc, cell.selection);
        arc.setAttribute('tabindex', '0');
        arc.setAttribute('role', 'button');
        arc.setAttribute('aria-label', `${methodName(m)} · ${stateText(cell)}`);
        arc.append(svg('title', {}, `${methodName(m)} · ${stateText(cell)}`));
        canvas.append(arc);
      }
    for (const o of model.occurrences) {
      const p = model.poem.boxes[o.entity_id],
        port = points.get(o.entity_id);
      if (!p) continue;
      const g = action(
        svg('g', { tabindex: 0, role: 'button', 'aria-label': I.occurrenceLabel(o) }),
        I.occurrence(o.entity_id)
      );
      g.append(M.port(port.x, port.y));
      g.append(
        svg('rect', { x: p.x, y: p.y - 23, width: p.width, height: 30, fill: 'transparent' })
      );
      if (active.has(o.entity_id)) g.append(M.selectionRect(p.x, p.y - 23, p.width, 30, 2));
      canvas.append(g);
    }
    box.append(canvas);
    for (const id of active) {
      const o = getOcc(model, id);
      if (o) box.append(M.selectionTagHTML(I.occurrenceLabel(o)));
    }
    return box;
  }
  function network(model) {
    const box = el('div', null, 'cv-network'),
      active = touched(model),
      represented = new Set();
    for (const m of checked(model)) {
      const edges = holds(model, m);
      const ids = [...new Set(edges.flatMap((c) => c.selection.members))];
      if (!ids.length) continue;
      const group = el('section', null, 'cv-group');
      group.append(el('h3', methodName(m)));
      const counts = model.groupCounts?.[m.method_id];
      if (counts)
        group.append(M.hullLabel({ ...counts, family: m.family, fixture: !!model.fixture }));
      else
        group.append(
          el('p', 'Group counts not supplied'),
          el('p', 'Joint reading consistency not assessed')
        );
      const canvas = svg('svg', { viewBox: '0 0 440 340', 'aria-label': methodName(m) });
      const positions = new Map(
        ids.map((id, i) => [
          id,
          {
            cx: 220 + 142 * Math.cos((2 * Math.PI * i) / ids.length - Math.PI / 2),
            cy: 155 + 105 * Math.sin((2 * Math.PI * i) / ids.length - Math.PI / 2),
          },
        ])
      );
      for (const cell of edges) {
        const [a, b] = cell.selection.members.map((id) => positions.get(id));
        const edge = M.edge(a, b, {
          family: m.family,
          layer: m.layer,
          glyph: true,
          dim: active.size > 0 && !cell.selection.members.some((id) => active.has(id)),
        });
        action(edge, cell.selection);
        edge.setAttribute('tabindex', '0');
        edge.setAttribute('role', 'button');
        edge.setAttribute(
          'aria-label',
          `${methodName(m)} · ${cell.selection.members.map((id) => I.occurrenceLabel(getOcc(model, id))).join(' ↔ ')} · ${stateText(cell)}`
        );
        edge.append(svg('title', {}, stateText(cell)));
        canvas.append(edge);
      }
      for (const id of ids) {
        represented.add(id);
        const node = action(
          M.node(getOcc(model, id), { ...positions.get(id), r: 37, selected: active.has(id) }),
          I.occurrence(id)
        );
        node.setAttribute('tabindex', '0');
        node.setAttribute('role', 'button');
        node.setAttribute('aria-label', I.occurrenceLabel(getOcc(model, id)));
        canvas.append(node);
      }
      group.append(canvas);
      box.append(group);
    }
    for (const o of model.occurrences.filter((o) => !represented.has(o.entity_id)))
      box.append(
        button(
          `${I.occurrenceLabel(o)} · No holding edge supplied in checked methods`,
          I.occurrence(o.entity_id)
        )
      );
    return box;
  }
  function render(model, { view = 'poem' } = {}) {
    const root = el('section', null, 'cv-root');
    root.append(el('style', CSS), el('h2', model.title || 'Connections'));
    if (model.fixture) root.append(el('p', 'Illustrative subset · not computed', 'cv-fixture'));
    const tabs = el('nav');
    tabs.setAttribute('aria-label', 'Connection views');
    for (const [id, label] of [
      ['poem', 'Poem + arcs'],
      ['matrix', 'Matrix'],
      ['network', 'Grouped network'],
    ]) {
      const tab = el('button', label);
      tab.dataset.view = id;
      tab.setAttribute('aria-current', String(view === id));
      tabs.append(tab);
    }
    root.append(tabs, controls(model, view));
    root.append(
      M.countStrip(model.counts || {}, {
        words: I.STATE_WORDS,
        provenance: model.provenance,
        hidden: model.hiddenCount,
        emptyOnset: model.emptyOnset,
      })
    );
    root.append(el('p', 'Counts cover all checked methods; Cell shows displays one method.'));
    const notice = I.hiddenNotice(model.selection, {
      checkedMethods: new Set(model.checkedMethods),
      methodName: (id) => getMethod(model, id).name,
      hiddenByFilter: () => model.hiddenByFilter || null,
    });
    if (notice && B) {
      root.append(B.hiddenNotice(document, notice, actions.show));
    } else if (notice) {
      const panel = el('p', notice.text);
      const show = el('button', notice.action.label);
      show.dataset.recovery = JSON.stringify(notice.action);
      panel.append(show);
      root.append(panel);
    }
    if (model.notice) root.append(el('p', model.notice, 'cv-notice'));
    const layout = el('div', null, 'cv-layout');
    layout.append({ poem, matrix, network }[view](model), inspector(model));
    root.append(layout);
    const native = el('section', null, 'cv-native');
    // Directed and span/figure evidence remains native, never made into cliques.
    for (const cell of model.cells.filter(
      (c) => c.selection.kind === 'binding' && model.checkedMethods.includes(c.selection.method_id)
    ))
      native.append(
        button(
          `${methodName(getMethod(model, cell.selection.method_id))} · ${cell.selection.members.map((m) => `${m.role}: ${I.occurrenceLabel(getOcc(model, m.entity_id))}`).join(' → ')} · ${stateText(cell)}`,
          cell.selection
        )
      );
    for (const f of model.figures || [])
      if (model.checkedMethods.includes(f.method_id))
        native.append(
          button(
            `Figure / span · ${f.label || f.evidence_id} · ${stateText(f)}`,
            I.figure(f.evidence_id)
          )
        );
    if (native.childNodes.length) {
      native.prepend(el('h3', 'Directed bindings, spans and figures'));
      root.append(native);
    }
    const coverage = el('footer');
    coverage.append(el('h3', 'Coverage'));
    for (const m of checked(model))
      coverage.append(el('p', `${methodName(m)} · ${describe(m.coverage)}`));
    root.append(coverage, M.legendRow({ words: I.STATE_WORDS, examples: !!model.fixture }));
    return root;
  }
  return { render, inspector, matrix, poem, network, controls };
}

const CSS = `
.cv-root{font-family:var(--cm-font,Arial,sans-serif);color:var(--cm-text,#242a28);background:var(--cm-surface,#fff);padding:24px;line-height:1.5}
.cv-root *{box-sizing:border-box}.cv-root button,.cv-root select,.cv-root summary{font:inherit;color:inherit;background:var(--cm-surface,#fff);border:1px solid var(--cm-border,#bfc7c3);border-radius:6px;padding:8px;cursor:pointer}
.cv-root button:focus-visible,.cv-root select:focus-visible,.cv-root summary:focus-visible,.cv-root g:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.cv-root nav{display:flex;gap:16px;margin:20px 0}.cv-root nav button{border:0;border-radius:0}.cv-root [aria-current=true]{border-bottom:3px solid currentColor;font-weight:bold}
.cv-controls{display:flex;gap:16px;align-items:start;margin-bottom:16px;flex-wrap:wrap}.cv-controls label{display:block}.cv-controls fieldset{border:0}.cv-controls details[open]{border:1px solid var(--cm-border,#bfc7c3);padding:8px}
.cv-layout{align-items:start;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;margin-top:20px}.cv-inspector,.cv-group{border:1px solid var(--cm-border,#dce2df);border-radius:10px;padding:20px}.cv-inspector h4{font-size:12px;text-transform:uppercase;margin-bottom:6px}.cv-inspector p{overflow-wrap:anywhere}.cv-inspector button{display:block;margin:8px 0}.cv-scroll{overflow:auto}.cv-scroll>svg{display:block}.cv-poem-line{font:24px Georgia,serif;fill:var(--cm-text,#242a28)}
.cv-network{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}.cv-network>button{grid-column:1/-1;text-align:left}.cv-group svg{width:100%}.cv-root .cv-selected{outline:2px solid var(--cm-text,#242a28);outline-offset:-2px}.cv-root table{border-collapse:collapse}.cv-root th{font-size:12px;font-weight:normal;padding:10px;min-width:75px}.cv-root td{text-align:center;padding:0}.cv-root td button{border:0;padding:3px;border-radius:0;min-width:40px}.cv-root footer{border-bottom:1px solid var(--cm-border,#dce2df);padding:12px 0;margin-bottom:16px}.cv-phone-row{display:none}.cv-native button{display:block;margin:8px 0}.lib-mk-tag{display:inline-block;margin:8px}.cv-fixture{font-weight:bold}
@media(max-width:600px){.cv-root{padding:16px}.cv-layout{display:block}.cv-desktop-matrix{display:none}.cv-phone-row{display:block}.cv-phone-row button{display:block;text-align:left;width:100%;margin:8px 0}.cv-phone-row span{display:block;font-size:12px}.cv-inspector{margin-top:20px}.cv-controls{display:block}.cv-controls select{max-width:100%}.cv-root nav{gap:2px}.cv-network{display:block}}
`;
return { createViews };
