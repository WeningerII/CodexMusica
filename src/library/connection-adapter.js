// Bundled with analysis (not a separately loaded chunk). Only verified,
// hydrated evidence enters here. No requests, tokenization or sound analysis.
/* exported _connectionModel */
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
  const occurrences = tokens.map((r) => ({
    ...r,
    entity_id: r.token_id,
    line: lineIndex.get(r.line_id) + 1,
    token: r.token + 1,
  }));
  const byOccurrence = new Map(occurrences.map((o) => [o.entity_id, o]));
  const results = new Map(
    records.filter((r) => r.kind === 'method_result').map((r) => [r.method_id, r])
  );
  const supplied = new Set(records.map((r) => r.method_id));
  const methods = registry.methods
    .filter((m) => I.layerOfNamespace(m.namespace))
    .map((m) => {
      const r = results.get(m.id);
      const family =
        m.name.includes('assonance') || m.name === 'vowel@v1'
          ? 'assonance'
          : m.name.includes('consonance') || m.name === 'coda@v1'
            ? 'consonance'
            : m.name === 'alliteration' || /^(stressed_)?onset@/.test(m.name)
              ? 'alliteration'
              : m.name.includes('rhyme')
                ? 'rhyme'
                : undefined;
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
      witness: r.reading?.witness ?? r.reading_witness,
      compared: r.compared && { ...r.compared, a_anchor: r.a, b_anchor: r.b },
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
      figures.push({ evidence_id: r.id, method_id: m.id, label: m.name, inLocus: true, record });
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
  const model = {
    title: title || 'Connections',
    occurrences,
    methods,
    cells,
    figures,
    checkedMethods: methods.filter((m) => !m.disabledReason).map((m) => m.id),
    selection: null,
    counts: {},
    groupCounts: {},
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
