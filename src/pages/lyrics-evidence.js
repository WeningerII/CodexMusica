/* Read-only evidence adapter and inspection sessions. Shared receive/navigation
 * wiring belongs to integration; editor selection belongs to writing's hooks. */
(() => {
  const hash = (s) => globalThis.lySha256(s);
  const esc = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const boundary = (text, n) =>
    Number.isInteger(n) &&
    n >= 0 &&
    n <= text.length &&
    !(
      n > 0 &&
      n < text.length &&
      /[\uD800-\uDBFF]/.test(text[n - 1]) &&
      /[\uDC00-\uDFFF]/.test(text[n])
    );
  const range = (text, a, b) => boundary(text, a) && boundary(text, b) && a < b;

  // This receipt must come from an independently verified, authenticated
  // request/declaration association. Never construct it by copying the report
  // being bound: matching lyric text cannot establish declaration equivalence.
  function declarationMatches(evidence, receipt, basis) {
    return !!(
      receipt?.version === 1 &&
      typeof evidence?.identity?.declaration_hash === 'string' &&
      evidence.identity.declaration_hash.length === 64 &&
      receipt.declarationHash === evidence.identity.declaration_hash &&
      receipt.reportIdentityHash === evidence.identity.hash &&
      receipt.requestId === basis.requestId &&
      receipt.semanticId === basis.semanticId &&
      receipt.text === basis.text &&
      receipt.readerScheme === basis.readerScheme &&
      receipt.voices === basis.voices
    );
  }

  // Ordinal sung rows + exact trim offsets, never spelling search. The caller
  // supplies only a request-matched source/result model, not the current edited
  // model guessed from the report's words.
  function lyRelationBindReport(
    evidence,
    { model, requestId, semanticId, readerScheme, voices, declarationReceipt } = {}
  ) {
    if (
      !requestId ||
      !declarationMatches(evidence, declarationReceipt, {
        requestId,
        semanticId,
        text: model?.text,
        readerScheme,
        voices,
      }) ||
      !model ||
      typeof model.text !== 'string' ||
      !Array.isArray(model.rows) ||
      !Array.isArray(model.sung) ||
      typeof evidence?.source_text !== 'string' ||
      model.rows.map((r) => r.raw).join('\n') !== model.text ||
      model.sung.map((r) => r.text).join('\n') !== evidence.source_text
    )
      return null;
    const rowStarts = [];
    let start = 0;
    for (const row of model.rows) {
      rowStarts.push(start);
      start += row.raw.length + 1;
    }
    let sourceStart = 0;
    const sourceMap = model.sung.map((row) => {
      const offset = row.raw.length - row.raw.trimStart().length;
      const start = rowStarts[row.i] + offset;
      const item = {
        sourceStart,
        sourceEnd: sourceStart + row.text.length,
        start,
        end: start + row.text.length,
      };
      sourceStart += row.text.length + 1;
      return item;
    });
    return {
      requestId,
      identityHash: evidence.identity?.hash,
      sourceText: evidence.source_text,
      semanticId,
      text: model.text,
      readerScheme,
      voices,
      sourceMap,
      declarationReceipt: { ...declarationReceipt },
    };
  }

  // context.binding is made by the matched-request/result integration, never
  // by word search. sourceMap maps explicit source rows into exact editor rows.
  function lyRelationEvidenceView(evidence, context = {}) {
    const document = context.document || {};
    const binding = context.binding;
    const text = typeof document.text === 'string' ? document.text : '';
    const sourceText = evidence?.source_text;
    const identity = evidence?.identity;
    let freshness = 'unknown';
    let reason = 'No verified report-to-document binding.';
    if (
      evidence?.version === 1 &&
      identity?.hash &&
      typeof sourceText === 'string' &&
      identity.source_sha256 === hash(sourceText) &&
      binding?.requestId &&
      context.requestId === binding.requestId &&
      binding.identityHash === identity.hash &&
      declarationMatches(evidence, binding.declarationReceipt, binding) &&
      binding.sourceText === sourceText &&
      typeof binding.semanticId === 'string' &&
      typeof document.semanticId === 'string' &&
      typeof binding.readerScheme === 'string' &&
      typeof document.readerScheme === 'string' &&
      typeof binding.voices === 'boolean' &&
      typeof document.voices === 'boolean' &&
      identity.provenance?.reader_scheme === binding.readerScheme &&
      identity.provenance?.voices === binding.voices
    ) {
      freshness =
        binding.semanticId === document.semanticId &&
        binding.text === text &&
        binding.readerScheme === document.readerScheme &&
        binding.voices === document.voices
          ? 'current'
          : 'stale';
      reason = freshness === 'current' ? '' : 'The document or reading declarations changed.';
    }
    const maps = Array.isArray(binding?.sourceMap) ? binding.sourceMap : [];
    const mapValid =
      maps.length > 0 &&
      maps.every(
        (m, i) =>
          m &&
          range(sourceText || '', m.sourceStart, m.sourceEnd) &&
          range(text, m.start, m.end) &&
          m.sourceEnd - m.sourceStart === m.end - m.start &&
          sourceText.slice(m.sourceStart, m.sourceEnd) === text.slice(m.start, m.end) &&
          (!i || (maps[i - 1].sourceEnd <= m.sourceStart && maps[i - 1].end <= m.start))
      );
    const view = {
      document: { ...document, text, exactTextHash: hash(text) },
      source: { kind: 'lyric_report', identity, requestId: binding?.requestId ?? null },
      freshness,
      reason,
      coverage: { ...(evidence?.coverage || { status: 'unavailable', complete: false }) },
      population: evidence?.population ?? null,
      occurrences: {},
      pairs: [],
      declarations: context.declarations || [],
      candidateOptions: context.candidateOptions || [],
    };
    const ids = new Set();
    let malformed = false;
    const endpoint = (record, side) => {
      const raw = record[side];
      const id =
        'occurrence:' +
        hash(
          JSON.stringify([
            identity?.hash,
            raw?.unit_ids,
            raw?.token_ids,
            raw?.line_ids,
            raw?.source_ranges?.map((r) => [r.utf16_range, r.precision]),
          ])
        );
      const occurrence = {
        id,
        lineIds: raw?.line_ids || [],
        parts: [],
        sourceParts: [],
        text: '',
        canPaint: false,
        canGo: false,
        reason: reason || 'No exact source projection.',
        unplaced: true,
      };
      const ranges = raw?.source_ranges;
      if (
        typeof sourceText === 'string' &&
        Array.isArray(ranges) &&
        ranges.length &&
        ranges.every(
          (r) =>
            r?.precision === 'exact' &&
            Array.isArray(r.utf16_range) &&
            range(sourceText, ...r.utf16_range)
        )
      ) {
        occurrence.sourceParts = ranges.map((r) => ({
          start: r.utf16_range[0],
          end: r.utf16_range[1],
          text: sourceText.slice(...r.utf16_range),
        }));
        occurrence.text = occurrence.sourceParts.map((p) => p.text).join(' … ');
      }

      if (
        freshness === 'current' &&
        mapValid &&
        Array.isArray(ranges) &&
        ranges.length &&
        Array.isArray(raw?.token_ids) &&
        raw.token_ids.length &&
        Array.isArray(raw?.unit_ids) &&
        raw.unit_ids.length
      ) {
        const parts = [];
        for (const r of ranges) {
          const [a, b] = Array.isArray(r?.utf16_range) ? r.utf16_range : [];
          if (r?.precision !== 'exact' || !range(sourceText, a, b)) break;
          const m = maps.find((m) => m.sourceStart <= a && b <= m.sourceEnd);
          if (!m) break;
          const start = m.start + a - m.sourceStart,
            end = m.start + b - m.sourceStart;
          if (!range(text, start, end) || (parts.length && parts.at(-1).end > start)) break;
          parts.push({ start, end, text: text.slice(start, end) });
        }
        if (parts.length === ranges.length)
          Object.assign(occurrence, {
            parts,
            text: parts.map((p) => p.text).join(' … '),
            canPaint: true,
            canGo: true,
            reason: '',
            unplaced: false,
          });
      }
      view.occurrences[id] = occurrence;
      return id;
    };
    for (const record of Array.isArray(evidence?.records) ? evidence.records : []) {
      if (
        evidence?.version !== 1 ||
        record?.kind !== 'relation_instance' ||
        typeof record.id !== 'string' ||
        !record.id ||
        ids.has(record.id) ||
        typeof record.schema_name !== 'string' ||
        !['true', 'false', 'undecided'].includes(record.verdict) ||
        !record.a ||
        !record.b
      ) {
        malformed = true;
        continue;
      }
      ids.add(record.id);
      const a = endpoint(record, 'a'),
        b = endpoint(record, 'b');
      view.pairs.push({
        id: record.id,
        a,
        b,
        types: [{ recordId: record.id, schema: record.schema_name, verdict: record.verdict }],
        freshness,
        canPaint: view.occurrences[a].canPaint && view.occurrences[b].canPaint,
        canGo: view.occurrences[a].canGo && view.occurrences[b].canGo,
        provenance: record.method_id,
      });
    }
    // Stable source order, not score/strength or schema-name order. Unplaced
    // records retain their source order and stay inspectable without navigation.
    const position = (p) =>
      Math.min(...[p.a, p.b].flatMap((id) => view.occurrences[id].sourceParts.map((x) => x.start)));
    view.pairs.sort((a, b) => position(a) - position(b));
    if (malformed || evidence?.coverage?.loaded_records !== view.pairs.length) {
      view.coverage = {
        ...view.coverage,
        complete: false,
        status: 'partial',
        reason: 'invalid_or_missing_records',
      };
    }
    if (!evidence || evidence.version !== 1)
      view.coverage = { complete: false, status: 'unavailable', reason: 'no_supported_report' };
    return view;
  }

  function lyRelationOccurrenceChoices(view, selection) {
    if (
      view.freshness !== 'current' ||
      !selection ||
      !boundary(view.document.text, selection.start) ||
      !boundary(view.document.text, selection.end) ||
      selection.end < selection.start
    )
      return [];
    return Object.values(view.occurrences).filter(
      (o) =>
        o.canGo &&
        o.parts.some((p) =>
          selection.start === selection.end
            ? p.start <= selection.start && selection.start < p.end
            : p.start < selection.end && selection.start < p.end
        )
    );
  }
  function lyRelationWritingMarks(view, session) {
    if (
      !session?.armed ||
      view.freshness !== 'current' ||
      session.evidenceId !== view.source.identity?.hash
    )
      return null;
    const pair = view.pairs.find((p) => p.id === session.selected?.pairId);
    if (!pair?.canPaint) return null;
    return {
      text: view.document.text,
      occurrences: [...new Set([pair.a, pair.b])].map((id) => {
        const o = view.occurrences[id];
        return { id: o.id, parts: o.parts, canPaint: o.canPaint };
      }),
    };
  }
  const navigationReason = (reason) =>
    ({
      'document-mismatch': 'Your draft changed; your edits are kept. Stay here to end inspection.',
      'invalid-origin':
        'The original selection can no longer be restored. Stay here to end inspection.',
      'editor-not-available': 'Open Song and close the dialog before navigating.',
      'split-grapheme': 'This range cannot be selected exactly.',
      'choose-part': 'Choose an explicit endpoint part.',
    })[reason] || reason;
  function lyRelationSessionExpand(session) {
    return { ...session, expanded: true };
  }
  function lyRelationSessionOpen(view, origin, previousPanel = null, sourceOccurrence = null) {
    return {
      armed: true,
      listOpen: true,
      sourceOccurrence,
      expanded: false,
      evidenceId: view.source.identity?.hash ?? null,
      origin,
      previousPanel,
      selected: null,
      reason: '',
    };
  }
  function lyRelationSessionClose(session) {
    return { ...session, listOpen: false };
  }
  function lyRelationSessionReopen(session) {
    return { ...session, listOpen: true };
  }
  function lyRelationSessionSelect(session, view, pairId, side, partIndex) {
    const pair = view.pairs.find((p) => p.id === pairId);
    if (!session?.armed || !pair || !['a', 'b'].includes(side))
      return { ...session, selected: null, reason: 'Pair is unavailable.' };
    const occurrence = view.occurrences[pair[side]];
    if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= occurrence.parts.length)
      return { ...session, selected: null, reason: 'Choose an explicit endpoint part.' };
    return { ...session, selected: { pairId, side, partIndex }, reason: '' };
  }
  function lyRelationSessionGo(session, view, hooks) {
    const selected = session?.selected;
    const pair = view.pairs.find((p) => p.id === selected?.pairId);
    const occurrence = pair && view.occurrences[pair[selected.side]];
    if (
      !session?.armed ||
      session.evidenceId !== view.source.identity?.hash ||
      view.freshness !== 'current' ||
      !occurrence?.canGo ||
      !occurrence.parts[selected.partIndex]
    )
      return {
        ...session,
        reason: 'This occurrence is no longer current. Stay here or return to your origin.',
      };
    const result = hooks.go(
      { text: view.document.text, parts: occurrence.parts, canGo: true },
      selected.partIndex
    );
    return {
      ...session,
      reason:
        result === true || result?.ok === true
          ? ''
          : navigationReason(result?.reason) || 'The editor could not reveal this part.',
    };
  }
  function lyRelationSessionReturn(session, hooks) {
    if (session?.returnUnavailable) return session;
    if (!session?.armed || !session.origin)
      return {
        ...session,
        reason: 'The editing origin is unavailable. Stay here to end inspection.',
      };
    const result = hooks.restore(session.origin);
    if (result !== true && result?.ok !== true)
      return {
        ...session,
        returnUnavailable:
          ['document-mismatch', 'invalid-origin'].includes(result?.reason) ||
          /changed/i.test(result?.reason || ''),
        reason:
          navigationReason(result?.reason) ||
          'The origin changed. Stay here to keep your current edits and position.',
      };
    return { ...session, armed: false, listOpen: false, origin: null, selected: null, reason: '' };
  }
  function lyRelationSessionStay(session) {
    return { ...session, armed: false, listOpen: false, origin: null, selected: null, reason: '' };
  }
  function lyRelationSessionBack(session, hooks) {
    if (!session?.previousPanel)
      return { ...session, reason: 'There is no previous panel to return to.' };
    const result = hooks.back(session.previousPanel);
    return result === true || result?.ok === true
      ? { ...session, armed: false, listOpen: false, origin: null, selected: null, reason: '' }
      : { ...session, reason: result?.reason || 'The previous panel is unavailable.' };
  }
  function lyRelationDockMarkup(view, session) {
    if (!session?.armed)
      return '<button type="button" data-ui="ly-relations"><span aria-hidden="true">↔</span> Relations</button>';
    const source = view.occurrences[session.sourceOccurrence]?.text || 'Selected relation';
    return `<span>${esc(source)}</span><button type="button" data-ui="ly-relation-reopen"><span aria-hidden="true">↔</span> Back to relations</button><button type="button" data-ui="ly-relation-return"${session.returnUnavailable ? ' disabled' : ''}><span aria-hidden="true">↩</span> Return to editing</button>`;
  }
  function lyRelationInspectorMarkup(view, session) {
    const status = view.coverage.status || 'unavailable';
    const summary =
      status === 'complete'
        ? `${view.pairs.length} reported pairs in the executed population.`
        : `${view.pairs.length} reported pairs. Coverage ${status}; this is not a complete census.`;
    const listed = session?.sourceOccurrence
      ? view.pairs.filter(
          (p) => p.a === session.sourceOccurrence || p.b === session.sourceOccurrence
        )
      : view.pairs;
    const partners = new Set(
      listed.flatMap((p) => [p.a, p.b]).filter((id) => id !== session?.sourceOccurrence)
    );
    const visible = session?.expanded ? listed : listed.slice(0, 3);
    const rows = visible
      .map((pair) => {
        const endpoints = ['a', 'b']
          .map((side) => {
            const o = view.occurrences[pair[side]];
            const lines = o.lineIds.map((id) => {
              const match = /^line:(\d+)$/.exec(id);
              return match ? `L${Number(match[1]) + 1}` : 'Line unavailable';
            });
            const label = `${side.toUpperCase()} · ${lines.join(', ')}`;
            return `<div><span>${esc(label)}</span> ${
              o.parts.length
                ? o.parts
                    .map(
                      (p, i) =>
                        `<button type="button" data-ui="ly-relation-go" data-pair="${esc(pair.id)}" data-side="${side}" data-part="${i}"${o.canGo ? '' : ' disabled'}>Go to ${side.toUpperCase()}${o.parts.length > 1 ? ` part ${i + 1}` : ''}: ${esc(p.text)}</button>`
                    )
                    .join(' ')
                : `<span>${esc(o.text)}</span> <span title="${esc(o.reason)}" aria-label="${esc(`Not placed in this draft. ${o.reason}`)}">Not placed in this draft</span>`
            }</div>`;
          })
          .join('');
        return `<li data-relation-id="${esc(pair.id)}"${session?.selected?.pairId === pair.id ? ' aria-current="true"' : ''}><p>${pair.types.map((t) => `${esc(t.schema)} · ${esc({ true: 'Confirmed', false: 'Not confirmed', undecided: 'Cannot determine' }[String(t.verdict)] || 'Verdict unavailable')}`).join('; ')}</p>${endpoints}</li>`;
      })
      .join('');
    const scope =
      view.population?.scope === 'pair_local_registry_instances'
        ? 'Reported relations between pairs of lyric spans, using the readings graded. Whole-song patterns and other possible readings were not searched.'
        : 'The scope of this report is unavailable.';
    const scopeDetails = view.population
      ? `<details><summary>Report scope and exclusions</summary><pre>${esc(JSON.stringify(view.population, null, 2))}</pre><p>Coverage by check</p><pre>${esc(JSON.stringify(view.coverage.methods || [], null, 2))}</pre></details>`
      : '';
    return `<section aria-label="Relations"><h3>Relations</h3>${session?.sourceOccurrence ? `<p>Source: ${esc(view.occurrences[session.sourceOccurrence]?.text || 'unplaced occurrence')} · ${listed.length} reported pairs · ${partners.size} partner occurrences</p>` : ''}<p role="status">${esc(summary)} ${esc(view.reason)}</p><p>Measured schema instances; candidate options and declared Scheme are separate.</p><p>${esc(scope)}</p>${scopeDetails}${!session?.expanded && listed.length ? `<p>${visible.length} of ${listed.length}, in lyric order</p>` : ''}<ol>${rows}</ol>${visible.length < listed.length ? `<button type="button" data-ui="ly-relation-expand">Show all ${listed.length} pairs</button>` : ''}<p role="status">${esc(session?.reason)}</p><button type="button" data-ui="ly-relation-close">Close</button><button type="button" data-ui="ly-relation-return"${session?.returnUnavailable ? ' disabled' : ''}>Return to editing origin</button>${session?.previousPanel ? '<button type="button" data-ui="ly-relation-back">Back to previous panel</button>' : ''}<button type="button" data-ui="ly-relation-stay">Stay here and end inspection</button></section>`;
  }
  Object.assign(globalThis, {
    lyRelationBindReport,
    lyRelationDockMarkup,
    lyRelationEvidenceView,
    lyRelationOccurrenceChoices,
    lyRelationWritingMarks,
    lyRelationSessionOpen,
    lyRelationSessionExpand,
    lyRelationSessionClose,
    lyRelationSessionReopen,
    lyRelationSessionSelect,
    lyRelationSessionGo,
    lyRelationSessionReturn,
    lyRelationSessionStay,
    lyRelationSessionBack,
    lyRelationInspectorMarkup,
  });
})();
