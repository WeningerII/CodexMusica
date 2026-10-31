// Library views mounted by the verified analysis controller.
// Supply Don's CMConnectionInteraction and Jony's marks chunk to createViews.
// This presentation adapter consumes supplied cells, counts and coverage only:
// it performs no analysis, syllabification, domain inference or network requests.
'use strict';

// Adapter model: occurrences {entity_id,text,line,token,final}; methods
// {method_id,name,layer,family,ordering,member_roles,matrix_projection,coverage,
// disabledReason}; cells {selection,inLocus,record,jobComplete,domainCertified}.
// counts/groupCounts and provenance describe supplied populations, not inferred
// totals. hiddenCount is {count: nonnegative integer, by: nonempty string};
// partial counts stay unknown, never inferred from visible nodes or edges.
// poem contains full lines and ranges keyed by occurrence ID: {start,end}
// (UTF-16 offsets into that occurrence’s 1-based line). Figures
// retain native members and evidence_id. This is not a backend schema adapter.
// Returned DOM carries data-selection (Don's selectionKey), data-method,
// data-view, data-action=cell_method and data-recovery hooks for Don's bindings.
// The owner updates the immutable model and rerenders after an action; no event,
// URL or live-region ownership is claimed here. After mounting, the owner awaits
// document.fonts.ready and calls layoutPoem(root) before binding/focusing controls;
// repeat layout after font changes. Detached/unmeasurable text has no guessed marks.
// layoutPoem(root) returns {poems:[{status,measured,fixture,issues}]}; status is
// ready/partial/unavailable; measured/fixture contain occurrence IDs; issues are
// {entity_id,reason}: missing_range, invalid_range, detached, measurement_unavailable.
// No matching poem returns {poems:[]}. Visible role=note diagnostics have no live
// region: the binding owner decides announcements, cancellation and focus ordering.
// Authored non-browser fixtures may explicitly set poem.fixtureBoxes=true.
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
  const isCount = (value) => Number.isInteger(value) && value >= 0;
  const name = (m) => `${I.LAYER_WORDS[m.layer]} · ${m.name}`;
  const describe = (value) =>
    value == null ? 'not supplied' : typeof value === 'string' ? value : JSON.stringify(value);
  const action = (node, selection, label) => {
    node.dataset.selection = I.selectionKey(selection);
    node.classList.add('lib-mk-focus');
    if (label != null) {
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', label);
    }
    return node;
  };
  const button = (text, selection) => action(el('button', text), selection);
  // Each cell carries a Don selection plus explicit domain/population facts.
  // A missing cell descriptor is unknown to this adapter, never false.
  const find = (model, selection) =>
    model.cell
      ? model.cell(selection)
      : model.cells.find((c) => I.sameSelection(c.selection, selection));
  const state = (cell) => (cell ? I.stateWords(I.cellState(cell)) : 'Not supplied');
  const method = (model, id) => model.methods.find((m) => m.method_id === id);
  const word = (model, id) => model.occurrences.find((o) => o.entity_id === id);
  const checked = (model) =>
    model.methods.filter((m) => model.checkedMethods.includes(m.method_id) && !m.disabledReason);
  // Normalize display roles only; never rewrite the selection or its key.
  const roles = (sel) =>
    sel.kind === 'pair'
      ? sel.members.map((entity_id) => ({ entity_id }))
      : sel.members.map((m) => m.role).join() === 'b,a'
        ? sel.members.slice().reverse()
        : sel.members;
  const ends = (sel) => {
    const ms = roles(sel);
    if (sel.kind === 'pair' || ms.map((m) => m.role).join() === 'a,b')
      return ms.map((m) => m.entity_id);
  };
  const labels = (model, sel) =>
    roles(sel)
      .map((m) => `${m.role ? m.role + ': ' : ''}${I.occurrenceLabel(word(model, m.entity_id))}`)
      .join(sel.kind === 'binding' ? ' → ' : ' ↔ ');
  const label = (model, cell, short) =>
    `${name(method(model, cell.selection.method_id))} · ${short ? '' : labels(model, cell.selection) + ' · '}${state(cell)}`;
  const stroke = (m, cell, active) => ({
    family: m.family,
    layer: m.layer,
    glyph: true,
    directed: cell.selection.kind === 'binding',
    dim: active.size > 0 && !ends(cell.selection).some((id) => active.has(id)),
  });
  function binding(m, a, b) {
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
      const o = word(model, sel.entity_id);
      pane.append(el('h3', o ? I.occurrenceLabel(o) : 'Occurrence no longer available'));
      for (const cell of model.cells) {
        if (!I.selectionOccurrences(cell.selection).includes(sel.entity_id)) continue;
        pane.append(button(label(model, cell), cell.selection));
      }
      return pane;
    }
    const cell =
      sel.kind === 'figure'
        ? model.figures?.find((f) => f.evidence_id === sel.evidence_id)
        : find(model, sel);
    const m = method(model, sel.method_id || cell?.method_id);
    if (m) pane.append(el('h3', name(m)));
    if (sel.kind === 'figure') {
      pane.append(el('h3', `Figure / span · ${sel.evidence_id}`));
      pane.append(el('p', describe(cell?.members)));
    } else {
      pane.append(el('h3', (sel.kind === 'binding' ? 'Asked roles · ' : '') + labels(model, sel)));
    }
    pane.append(el('p', state(cell), 'cv-verdict'));
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
    const m = method(model, choice.selected);
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
        `${name(m)} · ${m.ordering === 'unordered' ? 'unordered pairs shown once' : 'row → column; role order preserved'}`
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
    for (const [row, a] of occurrences.entries()) {
      const tr = el('tr'),
        h = el('th', I.occurrenceLabel(a));
      h.scope = 'row';
      tr.append(h);
      for (const [col, b] of occurrences.entries()) {
        const td = el('td');
        if (row !== col && (m.ordering !== 'unordered' || row < col)) {
          const sel = binding(m, a.entity_id, b.entity_id),
            cell = find(model, sel);
          const btn = button('', sel);
          btn.dataset.row = row;
          btn.dataset.col = col;
          btn.setAttribute(
            'aria-label',
            `${I.occurrenceLabel(a)} ${m.ordering === 'unordered' ? '↔' : '→'} ${I.occurrenceLabel(b)} · ${state(cell)}`
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
                state: I.cellState(cell).state,
                family: m.family,
                selected: I.sameSelection(model.selection, sel),
              })
            );
            btn.append(mark);
          } else btn.textContent = 'NS';
          if (I.sameSelection(model.selection, sel)) btn.classList.add('cv-selected');
          td.append(btn);
        }
        tr.append(td);
      }
      table.append(tr);
    }
    const scroll = el('div', null, 'cv-scroll');
    scroll.append(table);
    scroll.append(el('p', 'NS = not supplied; not an engine state.'));
    box.append(scroll);
    const phone = el('section', null, 'cv-phone-row');
    const focus = model.rowOccurrence || I.selectionOccurrences(model.selection)[0];
    const a = word(model, focus);
    phone.append(
      el(
        'h3',
        a ? `Matrix row · ${I.occurrenceLabel(a)}` : 'Select an occurrence to show its matrix row'
      )
    );
    if (a)
      for (const b of occurrences.filter((o) => o.entity_id !== a.entity_id)) {
        const sel = binding(m, a.entity_id, b.entity_id),
          cell = find(model, sel);
        const btn = button('', sel);
        btn.append(el('strong', I.occurrenceLabel(b)), el('span', state(cell)));
        if (I.sameSelection(model.selection, sel)) btn.classList.add('cv-selected');
        phone.append(btn);
      }
    else
      for (const o of occurrences)
        phone.append(button(I.occurrenceLabel(o), I.occurrence(o.entity_id)));
    box.append(phone);
    return box;
  }
  function holds(model, method) {
    return model.cells.filter(
      (c) =>
        c.selection.method_id === method.method_id &&
        method.family &&
        ends(c.selection) &&
        I.cellState(c).state === 'holds'
    );
  }
  const poemLayouts = new WeakMap();
  function layoutPoem(root) {
    const poems = [...root.querySelectorAll('.cv-poem')].flatMap(
      (canvas) => poemLayouts.get(canvas)?.() || []
    );
    return { poems };
  }
  function poem(model) {
    const box = el('div', null, 'cv-scroll'),
      active = new Set(I.selectionOccurrences(model.selection));
    // A full source line stays intact, including unselected function words.
    const canvas = svg('svg', {
      height: model.poem.height,
      'aria-label': 'Poem and supplied holding connections',
      class: 'cv-poem',
    });
    for (const line of model.poem.lines)
      canvas.append(
        svg('text', { x: 48, y: line.y, class: 'cv-poem-line', 'xml:space': 'preserve' }, line.text)
      );
    const marks = svg('g'),
      notice = el('p', null, 'cv-geometry-notice');
    notice.setAttribute('role', 'note');
    box.append(notice);
    canvas.append(marks);
    const draw = () => {
      const boxes = {},
        points = new Map();
      const lines = canvas.querySelectorAll('.cv-poem-line');
      // Whole lines include punctuation and words without usable token ranges.
      let width = model.poem.width;
      try {
        if (canvas.isConnected)
          for (const line of lines) {
            const b = line.getBBox();
            width = Math.max(width, b.x + b.width + 114);
          }
      } catch {
        width = 0;
      }
      canvas.setAttribute('width', width || model.poem.width);
      canvas.setAttribute('viewBox', `0 0 ${width || model.poem.width} ${model.poem.height}`);
      const report = { measured: [], fixture: [], issues: [] };
      for (const o of model.occurrences) {
        const range = model.poem.ranges?.[o.entity_id],
          line = lines[o.line - 1];
        let reason = !range
          ? 'missing_range'
          : !line ||
              ![range.start, range.end].every(Number.isInteger) ||
              range.start < 0 ||
              range.end <= range.start ||
              range.end > line.textContent.length ||
              line.textContent.slice(range.start, range.end) !== o.text
            ? 'invalid_range'
            : !canvas.isConnected
              ? 'detached'
              : !width
                ? 'measurement_unavailable'
                : null;
        if (!reason) {
          try {
            // DOM Text ranges use UTF-16 offsets; no SVG character-index conversion.
            // Convert viewport bounds back into this SVG's local coordinate system.
            const selection = document.createRange();
            selection.setStart(line.firstChild, range.start);
            selection.setEnd(line.firstChild, range.end);
            const rect = selection.getBoundingClientRect(),
              matrix = canvas.getScreenCTM().inverse();
            const cx = (rect.left + rect.right) / 2,
              cy = (rect.top + rect.bottom) / 2,
              width = Math.abs(matrix.a) * rect.width + Math.abs(matrix.c) * rect.height,
              height = Math.abs(matrix.b) * rect.width + Math.abs(matrix.d) * rect.height,
              x = matrix.a * cx + matrix.c * cy + matrix.e - width / 2,
              y = matrix.b * cx + matrix.d * cy + matrix.f - height / 2;
            if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
              boxes[o.entity_id] = { x, y, width, height };
              report.measured.push(o.entity_id);
            }
          } catch {
            /* Unsupported or unlaid-out text is reported below. */
          }
          if (!boxes[o.entity_id]) reason = 'measurement_unavailable';
        }
        if (!boxes[o.entity_id] && model.fixture === true && model.poem.fixtureBoxes === true) {
          const p = model.poem.boxes?.[o.entity_id];
          if (p && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0) {
            boxes[o.entity_id] = { ...p, y: p.y - 23, height: 30 };
            report.fixture.push(o.entity_id);
            reason = null;
          }
        }
        if (reason) report.issues.push({ entity_id: o.entity_id, reason });
      }
      report.status = report.issues.length
        ? Object.keys(boxes).length
          ? 'partial'
          : 'unavailable'
        : 'ready';
      notice.hidden = !report.issues.length;
      notice.textContent = report.issues.length
        ? 'Poem connection geometry unavailable: ' +
          report.issues
            .map(
              ({ entity_id, reason }) =>
                `${I.occurrenceLabel(word(model, entity_id))} (${entity_id}): ${reason.replace(/_/g, ' ')}`
            )
            .join('; ')
        : '';
      marks.replaceChildren();
      const top = svg('g');
      for (const o of I.readingOrder(model.occurrences)) {
        const p = boxes[o.entity_id];
        if (!p) continue;
        const port = { x: p.x + p.width / 2, y: p.y - 1, line: o.line, final: o.final };
        points.set(o.entity_id, port);
        const g = action(svg('g'), I.occurrence(o.entity_id), I.occurrenceLabel(o));
        const ink = action(svg('g', { 'aria-hidden': 'true' }), I.occurrence(o.entity_id));
        ink.append(M.port(port.x, port.y));
        g.append(
          svg('rect', { x: p.x, y: p.y, width: p.width, height: p.height, fill: 'transparent' })
        );
        if (active.has(o.entity_id)) ink.append(M.selectionRect(p.x, p.y, p.width, p.height, 2));
        marks.append(g);
        top.append(ink);
      }
      for (const m of checked(model))
        for (const cell of holds(model, m)) {
          const [a, b] = ends(cell.selection).map((id) => points.get(id));
          if (!a || !b) continue;
          const arc = M.arc(
            M.arcGeometry(a, b, { margin: width - 90, gutter: 10 }),
            stroke(m, cell, active)
          );
          const text = label(model, cell, cell.selection.kind === 'pair');
          action(arc, cell.selection, text);
          arc.append(svg('title', {}, text));
          marks.append(arc);
        }
      marks.append(top);
      return report;
    };
    poemLayouts.set(canvas, draw);
    draw();
    box.append(canvas);
    for (const id of active) {
      const o = word(model, id);
      if (o) box.append(M.selectionTagHTML(I.occurrenceLabel(o)));
    }
    return box;
  }
  function network(model) {
    const box = el('div', null, 'cv-network'),
      active = new Set(I.selectionOccurrences(model.selection)),
      represented = new Set();
    for (const m of checked(model)) {
      const edges = holds(model, m);
      const ids = [...new Set(edges.flatMap((c) => ends(c.selection)))];
      if (!ids.length) continue;
      const group = el('section', null, 'cv-group');
      group.append(el('h3', name(m)));
      const counts = model.groupCounts?.[m.method_id];
      if (counts && ['occurrences', 'shown', 'examined'].every((key) => isCount(counts[key]))) {
        group.append(
          M.hullLabel({
            ...counts,
            pending: isCount(counts.pending) ? counts.pending : undefined,
            hidden: isCount(counts.hidden) ? counts.hidden : undefined,
            family: m.family,
            fixture: model.fixture,
          })
        );
      } else {
        group.append(el('p', 'Group counts not supplied in full'));
        if (counts)
          for (const [key, label] of [
            ['occurrences', 'Occurrences'],
            ['shown', 'Holds shown'],
            ['examined', 'Eligible pairs examined'],
            ['pending', 'Pending'],
            ['hidden', 'Hidden'],
          ])
            group.append(
              el('p', `${label}: ${isCount(counts[key]) ? counts[key] : 'not supplied'}`)
            );
        group.append(el('p', 'Joint reading consistency not assessed'));
      }
      const canvas = svg('svg', { viewBox: '0 0 440 340', 'aria-label': name(m) });
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
        const [a, b] = ends(cell.selection).map((id) => positions.get(id));
        const edge = M.edge(a, b, stroke(m, cell, active));
        action(edge, cell.selection, label(model, cell));
        edge.append(svg('title', {}, state(cell)));
        canvas.append(edge);
      }
      for (const id of ids) {
        represented.add(id);
        const node = action(
          M.node(word(model, id), { ...positions.get(id), r: 37, selected: active.has(id) }),
          I.occurrence(id),
          I.occurrenceLabel(word(model, id))
        );
        canvas.append(node);
      }
      group.append(canvas);
      box.append(group);
    }
    for (const o of model.occurrences)
      if (!represented.has(o.entity_id))
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
    const hidden = model.hiddenCount;
    const validHidden =
      hidden && isCount(hidden.count) && typeof hidden.by === 'string' && hidden.by.trim();
    root.append(
      M.countStrip(model.counts || {}, {
        words: I.STATE_WORDS,
        provenance: model.provenance,
        population: model.countsPopulation,
        hidden: validHidden ? hidden : undefined,
        emptyOnset: model.emptyOnset,
      })
    );
    if (!validHidden && (hidden != null || model.hiddenByFilter))
      root.append(
        el(
          'p',
          `Hidden count: ${isCount(hidden?.count) ? hidden.count : 'not supplied'} · filter: ${typeof hidden?.by === 'string' && hidden.by.trim() ? hidden.by : 'not supplied'}`
        )
      );
    root.append(el('p', 'Counts cover all checked methods; Cell shows displays one method.'));
    const notice = I.hiddenNotice(model.selection, {
      checkedMethods: new Set(model.checkedMethods),
      methodName: (id) => method(model, id).name,
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
    // Keep native bindings and figures inspectable; never make spans into cliques.
    for (const cell of model.cells)
      if (
        cell.selection.kind === 'binding' &&
        model.checkedMethods.includes(cell.selection.method_id)
      )
        native.append(button(label(model, cell), cell.selection));
    for (const f of model.figures || [])
      if (model.checkedMethods.includes(f.method_id))
        native.append(
          button(
            `Figure / span · ${f.label || f.evidence_id} · ${state(f)}`,
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
      coverage.append(el('p', `${name(m)} · ${describe(m.coverage)}`));
    root.append(coverage, M.legendRow({ words: I.STATE_WORDS, examples: model.fixture }));
    const frame = el('div', null, 'cv-container');
    frame.append(root);
    return frame;
  }
  return { render, inspector, matrix, poem, layoutPoem, network, controls };
}

const CSS = `.cv-container{container-type:inline-size}.cv-root{font-family:var(--cm-font,Arial,sans-serif);color:var(--cm-text,#242a28);background:var(--cm-surface,#fff);padding:24px;line-height:1.5}.cv-root *{box-sizing:border-box}.cv-root button,.cv-root select,.cv-root summary{font:inherit;color:inherit;background:var(--cm-surface,#fff);border:1px solid var(--cm-border,#bfc7c3);border-radius:6px;padding:8px;cursor:pointer}.cv-root button:not(.lib-mk-focus):focus-visible,.cv-root select:focus-visible,.cv-root summary:focus-visible{outline:2px solid currentColor;outline-offset:3px}.cv-root nav{display:flex;gap:16px;margin:20px 0}.cv-root nav button{border:0;border-radius:0}.cv-root [aria-current=true]{border-bottom:3px solid currentColor;font-weight:bold}.cv-controls{display:flex;gap:16px;align-items:start;margin-bottom:16px;flex-wrap:wrap}.cv-controls label{display:block}.cv-controls fieldset{border:0}.cv-controls details[open]{border:1px solid var(--cm-border,#bfc7c3);padding:8px}.cv-layout{align-items:start;display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:24px;margin-top:20px}.cv-inspector,.cv-group{border:1px solid var(--cm-border,#dce2df);border-radius:10px;padding:20px}.cv-inspector h4{font-size:12px;text-transform:uppercase;margin-bottom:6px}.cv-inspector p{overflow-wrap:anywhere}.cv-inspector button,.cv-native button{display:block;margin:8px 0}.cv-scroll{overflow:auto}.cv-scroll>svg{display:block}.cv-poem-line{white-space:pre;font:24px Georgia,serif;fill:var(--cm-text,#242a28)}.cv-network{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}.cv-network>button{grid-column:1/-1;text-align:left}.cv-group svg{width:100%}.cv-selected{outline:2px solid var(--cm-text,#242a28);outline-offset:-2px}.cv-root table{border-collapse:collapse}.cv-root th{font-size:12px;font-weight:normal;padding:10px;min-width:75px}.cv-root td{text-align:center;padding:0}.cv-root td button{border:0;padding:3px;border-radius:0;min-width:40px}.cv-root footer{border-bottom:1px solid var(--cm-border,#dce2df);padding:12px 0;margin-bottom:16px}.cv-phone-row{display:none}.lib-mk-tag{display:inline-block;margin:8px}.cv-fixture{font-weight:bold}@container(max-width:600px){.cv-root{padding:16px}.cv-layout,.cv-phone-row,.cv-controls,.cv-network{display:block}.cv-desktop-matrix{display:none}.cv-phone-row button{display:block;text-align:left;width:100%;margin:8px 0}.cv-phone-row span{display:block;font-size:12px}.cv-inspector{margin-top:20px}.cv-controls select{max-width:100%}.cv-root nav{gap:2px}}`;
return { createViews };
