// Bundled with analysis (not a separately loaded chunk). Only verified,
// hydrated evidence enters here. No requests, tokenization or sound analysis.
/* exported _connectionModel */
/* global CONNECTION_FAMILIES */
function _connectionComplete(report, loaded, offset, next, pending) {
  return (
    !!report &&
    report.partial === false &&
    next == null &&
    pending === 0 &&
    offset + 1 === report.page_count &&
    loaded === report.evidence_count
  );
}
function _connectionModel(I, { records, registry, report, complete, title }) {
  const lines = records.filter((r) => r.kind === 'line');
  const lineIndex = new Map(lines.map((r, i) => [r.line_id, i]));
  const tokens = records.filter((r) => r.kind === 'token' && lineIndex.has(r.line_id));
  // A partial page can stop mid-line. Only the complete verified census
  // establishes the final supplied token; never re-tokenize the line text.
  const last = new Map();
  if (complete)
    for (const r of tokens) last.set(r.line_id, Math.max(last.get(r.line_id) ?? -1, r.token));
  const occurrences = tokens.map((r) => ({
    ...r,
    entity_id: r.token_id,
    line: lineIndex.get(r.line_id) + 1,
    token: r.token + 1,
    final: complete ? r.token === last.get(r.line_id) : undefined,
  }));
  const byOccurrence = new Map(occurrences.map((o) => [o.entity_id, o]));
  // Display only supplied inventories and complete assignments; never enumerate
  // reading combinations or infer an answer for a combination not disclosed.
  const inventory = (o) => {
    const readings = o.applicable_readings;
    const source =
      { declared: 'declared', variants: 'variants', unlocatable: 'unavailable' }[
        o.applicable_source
      ] || 'not supplied';
    return `${I.occurrenceLabel(o)} · Applicable readings (${source}): ${
      Array.isArray(readings) && readings.length ? readings.join(' / ') : 'not supplied'
    }`;
  };
  for (const o of occurrences) o.readingInventory = inventory(o);
  const held = {
    varied: 'varied reading',
    only_reading: 'only applicable reading',
    first_listed: 'first-listed reading',
    merged_set: 'merged reading set',
    unread: 'unread',
  };
  const verdict = {
    true: 'holds',
    false: 'does not hold',
    undecided: 'undecided',
    outside_locus: 'outside locus (not a predicate false)',
  };
  const basis = {
    rebuilt_assignment: 'rebuilt assignment',
    merged_set: 'merged reading sets',
    first_listed: 'first-listed readings',
    no_span_on_work: 'no span on the work reading',
  };
  const assignment = (rows) =>
    Array.isArray(rows) && rows.length
      ? rows
          .map((a) => {
            const o = byOccurrence.get(a.occurrence);
            return `${(a.role || []).join('/')} · ${o ? I.occurrenceLabel(o) : a.occurrence}: ${
              a.phones ??
              (a.held === 'merged_set'
                ? 'no single pronunciation supplied'
                : 'pronunciation unavailable')
            } (${held[a.held] || 'reading status not supplied'})`;
          })
          .join('; ')
      : 'Assignment not supplied';
  const list = (value) => (Array.isArray(value) ? value : []);
  const known = (value, labels) =>
    labels[value] || (value == null ? 'not supplied' : `unrecognized value: ${String(value)}`);
  const sound = (value) => {
    if (value == null) return 'unavailable';
    if (Array.isArray(value)) return value.length ? value.map(sound).join(' ') : 'empty';
    if (typeof value !== 'object') return String(value);
    if (value.kind === 'readings' && Array.isArray(value.values))
      return `reading alternatives: ${value.values.map(sound).join(' / ')}`;
    return 'unrecognized sound metadata';
  };
  const anchors = (r) => {
    const shared = r.namespace === 'shared_sound';
    const pairs = shared ? r.compared?.aligned : r.alignment?.pairs;
    const k = r.compared?.position;
    const at = Number.isInteger(k) && k >= 0 ? pairs?.[k] : undefined;
    const index = (n) => Number.isInteger(n) && n >= 0;
    const members = ['a', 'b']
      .map((role, side) => {
        const span = r[role],
          units = r.compared?.[role];
        const anchor = shared ? r.compared?.anchors?.[side] : span?.anchor_position;
        const position = index(anchor)
          ? `anchor position ${anchor + 1} in the ${shared ? 'judged' : 'supplied'} span`
          : 'anchor position not supplied';
        const aligned =
          Array.isArray(units) && units.length
            ? units
                .map(
                  (u, i) =>
                    `unit ${shared ? (index(at?.[side]) ? at[side] + 1 : 'position not supplied') : i + 1}: ${u.text ?? 'text not supplied'}; ${[
                      'onset',
                      'nucleus',
                      'coda',
                      'prominence',
                      'moras',
                    ]
                      .filter((key) => Object.hasOwn(u, key))
                      .map((key) => `${key}: ${sound(u[key])}`)
                      .join('; ')}`
                )
                .join('; ')
            : 'compared units not supplied';
        return `${role}: ${position}; ${aligned}`;
      })
      .join(' | ');
    const alignment = Array.isArray(pairs)
      ? pairs
          .map((pair) =>
            Array.isArray(pair) &&
            pair.length === 2 &&
            pair.every((p) => Number.isInteger(p) && p >= 0)
              ? `a unit ${pair[0] + 1} with b unit ${pair[1] + 1}`
              : 'unrecognized aligned positions'
          )
          .join('; ') || 'no aligned pairs supplied'
      : 'not supplied';
    const judged = shared
      ? Array.isArray(at) && at.length === 2 && at.every(index)
        ? ` | Judged aligned pair ${k + 1}: a unit ${at[0] + 1} with b unit ${at[1] + 1}`
        : ' | Judged aligned pair not supplied'
      : '';
    return `${members} | Aligned positions: ${alignment}${judged}`;
  };
  const locus = (rows) =>
    Array.isArray(rows)
      ? rows
          .map(
            ([key, value]) =>
              `${known(key, {
                both_line_final: 'both members end their lines',
                a_line_final: 'member a ends its line',
                both_line_initial: 'both members start their lines',
                neither_line_final: 'neither member ends its line',
                exactly_one_line_final: 'exactly one member ends its line',
                same_line: 'members are on the same line',
                different_lines: 'members are on different lines',
                adjacent_lines: 'member b is on the next line',
                adjacent_stanzas: 'member b is in the next stanza',
              })}: ${value === true ? 'true' : value === false ? 'false' : 'unknown'}`
          )
          .join('; ') || 'No locus predicates supplied'
      : 'Locus predicates not supplied';
  const search = (s) => {
    if (!s) return 'Reading search not supplied';
    const reasons = {
      witness_found: 'a witness was found',
      exhausted: 'all combinations were examined',
      combination_cap: 'the search budget was reached',
      rebuild_unavailable: 'reading rebuild unavailable',
      readings_not_searched_in_scope: 'alternative readings were not searched in this scope',
      no_reading_combination: 'no reading combination available',
      locus_unmatched: 'no matching locus',
    };
    const parts = [
      `Search: ${known(s.state, {
        partial: 'partial',
        exhaustive: 'all combinations examined',
        unavailable: 'unavailable',
        not_needed: 'not needed for this judgment',
      })}`,
    ];
    if (s.termination_reason != null)
      parts.push(`Stopped because ${known(s.termination_reason, reasons)}`);
    if (s.reason != null && s.reason !== s.termination_reason)
      parts.push(`Reason: ${known(s.reason, reasons)}`);
    for (const [key, label] of [
      ['combinations_examined', 'combinations examined'],
      ['combination_limit', 'search budget'],
    ])
      parts.push(`${label}: ${Number.isInteger(s[key]) && s[key] >= 0 ? s[key] : 'not supplied'}`);
    return parts.join('; ');
  };
  const readingDetails = (r) => {
    if (!r.judged_under && !r.witness_assignment && !r.reading_outcomes) return [];
    const details = [];
    if (r.witness_assignment)
      details.push(['Witness assignment', assignment(r.witness_assignment)]);
    const base = r.judged_under;
    if (base)
      details.push([
        `Base · ${basis[base.basis] || 'basis not supplied'} · ${verdict[base.verdict] || 'verdict not supplied'}`,
        assignment(base.assignment),
      ]);
    for (const [i, outcome] of list(r.reading_outcomes).entries())
      details.push([
        `Judged alternative ${i + 1} · ${verdict[outcome.verdict] || 'verdict not supplied'}`,
        assignment(outcome.assignment),
      ]);
    const ids = new Set([
      ...(r.a?.token_ids || []),
      ...(r.b?.token_ids || []),
      ...list(r.witness_assignment).map((a) => a.occurrence),
      ...list(base?.assignment).map((a) => a.occurrence),
      ...list(r.reading_outcomes).flatMap((o) => list(o.assignment).map((a) => a.occurrence)),
    ]);
    details.push([
      'Applicable reading inventory',
      [...ids]
        .map((id) => {
          const o = byOccurrence.get(id);
          return o ? o.readingInventory : `${id}: inventory not supplied`;
        })
        .join('; '),
    ]);
    details.push([
      'Disclosure scope',
      'Only supplied complete assignments are shown. No verdict is supplied for other combinations; missing pair records do not disclose which readings were judged.',
    ]);
    return details;
  };

  const results = new Map(
    records.filter((r) => r.kind === 'method_result').map((r) => [r.method_id, r])
  );
  const supplied = new Set(records.map((r) => r.method_id));
  const methods = registry.methods
    .filter((m) => I.layerOfNamespace(m.namespace))
    .map((m) => {
      const r = results.get(m.id);
      const family = CONNECTION_FAMILIES[m.id];
      return {
        ...m,
        method_id: m.id,
        layer: I.layerOfNamespace(m.namespace),
        family,
        ordering:
          r?.domain?.ordering || (m.namespace === 'shared_sound' ? 'unordered' : 'role_ordered'),
        member_roles: ['a', 'b'],
        matrix_projection: family ? r?.domain?.projection || 'none' : 'none',
        disabledReason: supplied.has(m.id)
          ? null
          : 'Not requested; use the method reference to analyze explicitly',
        coverage: {
          coverage: r?.coverage || 'not yet supplied',
          visual_projection: family ? undefined : 'Native bindings only: no agreed visual family',
          domain: r?.domain,
          counts: r?.counts,
          refusal: r?.refusal,
          reading_search: r?.reading_search,
        },
      };
    });
  const byMethod = new Map(methods.map((m) => [m.method_id, m]));
  const cells = [],
    figures = [],
    indexed = new Map();
  for (const r of records) {
    const m = byMethod.get(r.method_id);
    if (!m || !['relation_instance', 'relation_figure'].includes(r.kind)) continue;
    const a = r.a?.token_ids,
      b = r.b?.token_ids;
    const record = {
      ...r,
      readingDetails: readingDetails(r),
      witness: r.reading?.witness ?? r.reading_witness,
      compared: r.compared && { ...r.compared, a_anchor: r.a, b_anchor: r.b },
    };
    // Presentation is separate: raw evidence remains unchanged on record.
    record.display = {
      quantifier: record.quantifier,
      licence: record.licence,
      readingDetails: record.readingDetails,
      witness:
        Array.isArray(record.witness) && record.witness.every((w) => typeof w === 'string')
          ? record.witness.join('; ')
          : typeof record.witness === 'string'
            ? record.witness
            : record.witness == null
              ? 'Witness not supplied'
              : 'Unrecognized witness metadata',
      compared: anchors(r),
      placement_reads: locus(r.placement_reads),
      reading_search: search(r.reading_search),
    };
    if (r.kind === 'relation_instance' && a?.length === 1 && b?.length === 1 && a[0] !== b[0]) {
      if (!byOccurrence.has(a[0]) || !byOccurrence.has(b[0])) continue;
      const selection =
        m.ordering === 'unordered'
          ? I.pair(m.id, a[0], b[0])
          : I.binding(m.id, [
              { role: 'a', entity_id: a[0] },
              { role: 'b', entity_id: b[0] },
            ]);
      const cell = { selection, record, inLocus: true };
      cells.push(cell);
      indexed.set(I.selectionKey(selection), cell);
    } else
      figures.push({
        evidence_id: r.id,
        method_id: m.id,
        label: m.name,
        inLocus: true,
        members:
          r.kind === 'relation_figure'
            ? {
                frame: r.frame,
                member_lines: r.member_lines,
                edges: r.edges,
                edge_count: r.edge_count,
                edges_incomplete: r.edges_incomplete,
              }
            : { a: r.a, b: r.b },
        record,
      });
  }
  const ranges = {};
  for (const o of occurrences) {
    const line = lines[o.line - 1];
    const base = line.source_ranges?.length === 1 && line.source_ranges[0];
    const span = o.source_ranges?.length === 1 && o.source_ranges[0];
    if (
      base?.precision === 'exact' &&
      span?.precision === 'exact' &&
      base.utf16_range &&
      span.utf16_range
    ) {
      const start = span.utf16_range[0] - base.utf16_range[0];
      const end = span.utf16_range[1] - base.utf16_range[0];
      // Lossy normalization must not bind source coordinates to changed text.
      if (start >= 0 && end <= line.text.length && line.text.slice(start, end) === o.text)
        ranges[o.entity_id] = { start, end };
    }
  }
  // The strip's population (3PO, #637 6547583040): loaded method-token
  // bindings of the checked methods, native-only ones included, each complete
  // ordered binding once. Native non-token-pair holds are separate, never folded in.
  // Undecided is given only once every page and detail part is verified
  // loaded and every checked method answered; a binding loaded in two states
  // gives neither count. Refused, pending and does-not-hold are not supplied
  // here: no backend total is read and nothing is subtracted.
  const countsFor = (checked) => {
    const ids = new Set(checked),
      seen = new Map();
    for (const c of cells) {
      if (!ids.has(c.selection.method_id)) continue;
      const k = I.selectionKey(c.selection),
        st = I.cellState(c).state;
      seen.set(k, seen.has(k) && seen.get(k) !== st ? null : st);
    }
    const states = [...seen.values()];
    const clash = states.includes(null);
    const n = (s) => (clash ? undefined : states.filter((x) => x === s).length);
    const answered = complete && [...ids].every((id) => results.get(id)?.coverage === 'answered');
    const held = new Set(
      figures
        .filter((f) => ids.has(f.method_id) && I.cellState(f).state === 'holds')
        .map((f) => f.evidence_id)
    );
    const holds = n('holds');
    return {
      summary:
        (Number.isInteger(holds)
          ? `${holds} method–token binding hold${holds === 1 ? '' : 's'} loaded`
          : 'Holds: not supplied') +
        ` · ${held.size} native non-token-pair hold${held.size === 1 ? '' : 's'} counted separately`,
      holds,
      undecided: answered ? n('undecided') : undefined,
      native_holds: held.size,
    };
  };
  // A hull's own population: the occurrences it draws and the holds it draws.
  // No hull-local examined population is supplied, so none is given.
  const groupCounts = {};
  for (const c of cells) {
    if (I.cellState(c).state !== 'holds') continue;
    const g = (groupCounts[c.selection.method_id] ||= { ids: new Set(), shown: 0 });
    g.shown += 1;
    for (const id of I.selectionOccurrences(c.selection)) g.ids.add(id);
  }
  for (const [id, g] of Object.entries(groupCounts))
    groupCounts[id] = { occurrences: g.ids.size, shown: g.shown };
  const checkedMethods = methods.filter((m) => !m.disabledReason).map((m) => m.id);
  const model = {
    title: title || 'Connections',
    occurrences,
    methods,
    cells,
    figures,
    checkedMethods,
    selection: null,
    counts: countsFor(checkedMethods),
    countsPopulation: 'method–token binding',
    countsFor,
    groupCounts,
    provenance: `Verified loaded evidence · ${complete ? 'all pages loaded' : 'pages or detail parts incomplete'}`,
    poem: {
      width: 850,
      height: Math.max(160, lines.length * 70 + 50),
      ranges,
      lines: lines.map((r, i) => ({ text: r.text, y: 60 + i * 70 })),
    },
    cell(selection) {
      const found = indexed.get(I.selectionKey(selection));
      if (found) return found;
      const r = results.get(selection.method_id);
      const ids = I.selectionOccurrences(selection);
      if (ids.length !== 2) return null;
      if (!r) return { selection, inLocus: true, jobComplete: false };
      if (r.coverage === 'refused') return { selection, inLocus: true, record: r };
      const answered = complete && r.coverage === 'answered';
      return { selection, ...I.domainFacts(r.domain, ...ids, answered), jobComplete: answered };
    },
  };
  return {
    model,
    current: {
      analysisIdentity: report.identity_hash,
      hasEntity: (id) => byOccurrence.has(id),
      hasMethod: (id) => byMethod.has(id),
      hasEvidence: (id) => figures.some((f) => f.evidence_id === id),
    },
  };
}
