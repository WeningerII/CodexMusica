/* exported CMConnectionInteraction */
/* global module */
/* Interaction model for the three connection views (poem + arcs, matrix,
   grouped network), as agreed in docs/design/connection-views/spec.md and
   frozen in drafts/r5. No DOM and no dependencies: the views bind it.

   What lives here, and the rule each part keeps:
   - selection: one object shared by every view. It is an occurrence, an
     unordered pair under a symmetric method, a role-ordered binding under a
     directed method, or a figure. It is keyed by the backend contract's ids
     (entity_id, method_id + members, evidence_id), never by spelling.
   - URL: the selection is written with the analysis_identity that binds the
     revision. A link from another revision, or one naming an id that is gone,
     is refused with its reason; it is never remapped to another occurrence.
   - hidden selection: changing the checked methods or a display filter never
     moves or clears the selection; the views say it is hidden and offer Show.
   - states: the six presentation states. An absent record reads as "does not
     hold" only after a completed, non-refused evaluation of a certified
     domain; anything else is a different state with its reason.
   - keyboard: arrows over the upper-triangle matrix, Tab in poem order, Enter
     inspects, Esc clears.
   - announcements: the words the live region speaks for a selection.
   - Cell shows: one checked method per matrix cell, named with its layer. */
(function (root) {
  const STATES = Object.freeze([
    'holds',
    'undecided',
    'not_yet_computed',
    'refused',
    'does_not_hold',
    'not_examined',
  ]);

  const STATE_WORDS = Object.freeze({
    holds: 'holds',
    undecided: 'undecided',
    not_yet_computed: 'not yet computed',
    refused: 'refused',
    does_not_hold: 'does not hold',
    not_examined: 'outside this method’s locus',
  });

  // Layer labels follow the evidence record's namespace.
  const LAYER_WORDS = Object.freeze({
    registered: 'Registered figure',
    sound: 'Shared sound (not a registered figure)',
  });
  const LAYER_SHORT = Object.freeze({
    registered: 'Registered',
    sound: 'Shared sound (not a registered figure)',
  });

  // An evidence record's namespace names its layer; display text never does.
  const NAMESPACE_LAYER = Object.freeze({ schema: 'registered', shared_sound: 'sound' });
  function layerOfNamespace(namespace) {
    return Object.prototype.hasOwnProperty.call(NAMESPACE_LAYER, namespace)
      ? NAMESPACE_LAYER[namespace]
      : null;
  }

  const KINDS = Object.freeze(['occurrence', 'pair', 'binding', 'figure']);

  function requireId(value, what) {
    if (typeof value !== 'string' || value === '') {
      throw new TypeError(`${what} must be a non-empty string`);
    }
    return value;
  }

  // ---- selection --------------------------------------------------------

  function occurrence(entityId) {
    return Object.freeze({ kind: 'occurrence', entity_id: requireId(entityId, 'entity_id') });
  }

  // A symmetric method's pair: the members are sorted, so a and b in either
  // order are one selection. Two members must be two distinct occurrences.
  function pair(methodId, a, b) {
    requireId(methodId, 'method_id');
    requireId(a, 'entity_id');
    requireId(b, 'entity_id');
    if (a === b) throw new RangeError('a pair needs two distinct occurrences');
    const members = a < b ? [a, b] : [b, a];
    return Object.freeze({ kind: 'pair', method_id: methodId, members: Object.freeze(members) });
  }

  // A directed method's binding keeps its roles: a->b and b->a are different
  // questions and different selections.
  function binding(methodId, members) {
    requireId(methodId, 'method_id');
    if (!Array.isArray(members) || members.length < 2) {
      throw new RangeError('a binding needs at least two role-labelled members');
    }
    const roles = new Set();
    const seen = new Set();
    const out = members.map((m) => {
      const role = requireId(m && m.role, 'role');
      const id = requireId(m && m.entity_id, 'entity_id');
      if (roles.has(role)) throw new RangeError(`role ${role} appears twice`);
      if (seen.has(id)) throw new RangeError(`occurrence ${id} appears twice`);
      roles.add(role);
      seen.add(id);
      return Object.freeze({ role, entity_id: id });
    });
    return Object.freeze({ kind: 'binding', method_id: methodId, members: Object.freeze(out) });
  }

  function figure(evidenceId) {
    return Object.freeze({ kind: 'figure', evidence_id: requireId(evidenceId, 'evidence_id') });
  }

  // Each id is percent-encoded, so ids may themselves contain the separators
  // (method ids are "schema:<id>").
  const enc = encodeURIComponent;
  function selectionKey(sel) {
    if (!sel) return '';
    switch (sel.kind) {
      case 'occurrence':
        return `o:${enc(sel.entity_id)}`;
      case 'pair':
        return `p:${enc(sel.method_id)}:${sel.members.map(enc).join(',')}`;
      case 'binding':
        return `b:${enc(sel.method_id)}:${sel.members.map((m) => `${enc(m.role)}=${enc(m.entity_id)}`).join(',')}`;
      case 'figure':
        return `f:${enc(sel.evidence_id)}`;
      default:
        throw new RangeError(`unknown selection kind ${sel.kind}`);
    }
  }

  function sameSelection(a, b) {
    return selectionKey(a) === selectionKey(b);
  }

  // Every occurrence the selection touches, for rings, ports and dimming.
  function selectionOccurrences(sel) {
    if (!sel) return [];
    if (sel.kind === 'occurrence') return [sel.entity_id];
    if (sel.kind === 'pair') return sel.members.slice();
    if (sel.kind === 'binding') return sel.members.map((m) => m.entity_id);
    return [];
  }

  // ---- URL --------------------------------------------------------------

  const PARAM_REVISION = 'cv';
  const PARAM_SELECTION = 'sel';

  function encodeSelection(analysisIdentity, sel) {
    requireId(analysisIdentity, 'analysis_identity');
    const params = new URLSearchParams();
    params.set(PARAM_REVISION, analysisIdentity);
    if (sel) params.set(PARAM_SELECTION, selectionKey(sel));
    return params.toString();
  }

  function parseKey(key) {
    const dec = decodeURIComponent;
    const kind = key.slice(0, 2);
    const rest = key.slice(2);
    if (kind === 'o:') return occurrence(dec(rest));
    if (kind === 'f:') return figure(dec(rest));
    const cut = rest.indexOf(':');
    if (cut <= 0) throw new RangeError('malformed selection');
    const method = dec(rest.slice(0, cut));
    const body = rest.slice(cut + 1).split(',');
    if (kind === 'p:') {
      if (body.length !== 2) throw new RangeError('malformed pair');
      return pair(method, dec(body[0]), dec(body[1]));
    }
    if (kind === 'b:') {
      return binding(
        method,
        body.map((part) => {
          const eq = part.indexOf('=');
          if (eq <= 0) throw new RangeError('malformed binding');
          return { role: dec(part.slice(0, eq)), entity_id: dec(part.slice(eq + 1)) };
        })
      );
    }
    throw new RangeError('malformed selection');
  }

  // A selection back from its key (a view's data-selection), or null when the
  // key cannot be read. Existence is not checked here; decodeSelection does
  // that for links.
  function selectionFromKey(key) {
    try {
      return key ? parseKey(key) : null;
    } catch {
      return null;
    }
  }

  // current: { analysisIdentity, hasEntity(id), hasMethod(id), hasEvidence(id) }.
  // Returns { ok: true, selection } or { ok: false, reason, message }, where
  // reason is 'none', 'malformed', 'revision' or 'missing'. A refusal never
  // carries a substitute selection.
  function decodeSelection(search, current) {
    const params = new URLSearchParams(search || '');
    const key = params.get(PARAM_SELECTION);
    if (!key) return { ok: false, reason: 'none', message: '' };
    let sel;
    try {
      sel = parseKey(key);
    } catch {
      return {
        ok: false,
        reason: 'malformed',
        message: 'This link’s selection could not be read.',
      };
    }
    const noun =
      sel.kind === 'occurrence' ? 'occurrence' : sel.kind === 'figure' ? 'figure' : 'pair';
    const gone = {
      ok: false,
      reason: 'missing',
      message: `This ${noun} no longer exists in the current revision.`,
    };
    if (params.get(PARAM_REVISION) !== current.analysisIdentity) {
      return { ok: false, reason: 'revision', message: gone.message };
    }
    if (sel.kind === 'figure')
      return current.hasEvidence(sel.evidence_id) ? { ok: true, selection: sel } : gone;
    if (sel.method_id !== undefined && !current.hasMethod(sel.method_id)) return gone;
    for (const id of selectionOccurrences(sel)) if (!current.hasEntity(id)) return gone;
    return { ok: true, selection: sel };
  }

  // ---- hidden selection --------------------------------------------------

  // scope: { checkedMethods: Set<method_id>, methodName(id), hiddenByFilter(sel) }
  // hiddenByFilter returns a filter's name, or null. The selection is never
  // changed here; the caller keeps it and shows the notice.
  function hiddenNotice(sel, scope) {
    if (!sel) return null;
    const noun =
      sel.kind === 'occurrence' ? 'occurrence' : sel.kind === 'figure' ? 'figure' : 'pair';
    if (
      (sel.kind === 'pair' || sel.kind === 'binding') &&
      !scope.checkedMethods.has(sel.method_id)
    ) {
      return {
        text: `Selected ${noun} hidden by current methods`,
        action: {
          type: 'check_method',
          method_id: sel.method_id,
          label: `Show ${scope.methodName(sel.method_id)}`,
        },
      };
    }
    const filter = scope.hiddenByFilter ? scope.hiddenByFilter(sel) : null;
    if (filter) {
      return {
        text: `Selected ${noun} hidden by current filter`,
        action: { type: 'clear_filter', filter, label: 'Show selected pair' },
      };
    }
    return null;
  }

  // ---- states -----------------------------------------------------------

  // cell: { inLocus, record, jobComplete, domainCertified }
  //   inLocus        the method's declared domain covers this binding
  //   record         the evidence record, if one exists
  //   jobComplete    the evaluation of this method's population finished
  //   domainCertified the domain descriptor certifies that an absent record
  //                   means false (completed, non-refused, pruning proven safe)
  // Returns { state, reason, absenceOnly }.
  // Why a record is undecided, in words, by the evidence contract's declared
  // reasons (library/contracts.py UndecidedReason).
  const UNDECIDED_WORDS = Object.freeze({
    combination_cap: 'reading search reached its cap',
    rebuild_unavailable: 'an alternate reading could not be rebuilt',
    locus_unmatched: 'locus not matched under every reading',
    // The backend can emit this after judging a merged knowledge set, so it
    // does not always mean only the first-listed reading was judged (spec
    // dispute 6, resolved 2026-10-31).
    readings_not_searched_in_scope: 'alternative readings were not searched in this scope',
    no_reading_combination: 'no compatible reading combination',
    placement_unknown: 'placement not settled',
    identity_unknown: 'identity not settled',
    channel_unknown: 'a sound channel not settled',
    judge_unknown: 'the judge gave no answer',
    member_edges_undecided: 'member pairs undecided',
  });

  // The backend ranks its own reason (library/analysis.py _undecided_reason:
  // the search's reason first, then placement, identity, channel), so a named
  // reason is authoritative. Only a channel reason, or none, falls back to the
  // channels themselves: `unknown_channels` entries are (channel, position)
  // pairs, and the channel is the string member.
  function undecidedReason(rec) {
    const why = rec.undecided_reason;
    if (why && why !== 'channel_unknown' && UNDECIDED_WORDS[why]) return UNDECIDED_WORDS[why];
    const unknown = Array.isArray(rec.unknown_channels) ? rec.unknown_channels : [];
    const channels = [
      ...new Set(
        unknown
          .map((u) => (Array.isArray(u) ? u.find((x) => typeof x === 'string') : u))
          .filter((c) => typeof c === 'string' && c)
      ),
    ];
    if (channels.length) return `${channels.join(', ')} not settled`;
    return UNDECIDED_WORDS[why] || 'reason not reported';
  }

  // What a method's domain descriptor (library/contracts.py MethodDomain)
  // says about one occurrence pair, as cellState's inputs. `answered` is the
  // method's own coverage. A pair touching a reading-dependent occurrence is
  // neither outside nor a certified negative: only its own record answers.
  function domainFacts(domain, a, b, answered) {
    if (!domain || domain.projection !== 'exact_token_pair') {
      return {
        inLocus: false,
        locusReason: (domain && domain.reason) || 'no pair projection for this method',
      };
    }
    const tokens = domain.tokens || [];
    const listed = (x, y) => {
      const runs = (domain.pairs || {})[String(tokens.indexOf(x))] || [];
      const j = tokens.indexOf(y);
      return j >= 0 && runs.some(([lo, hi]) => j >= lo && j <= hi);
    };
    const inLocus = listed(a, b) || (domain.ordering !== 'role_ordered' && listed(b, a));
    const dependent = (domain.reading_dependent_tokens || []).some((t) => t === a || t === b);
    if (dependent) return { inLocus: true, readingDependent: true, domainCertified: false };
    return { inLocus, domainCertified: !!answered };
  }

  function cellState(cell) {
    const rec = cell.record;
    if (!cell.inLocus) {
      return { state: 'not_examined', reason: cell.locusReason || null, absenceOnly: false };
    }
    if (rec) {
      if (rec.coverage === 'refused') {
        // The backend's refusal carries its words in `detail`
        // (library/analysis.py method_result refusal); `reason` is kept for
        // any producer that names it so.
        const refusal = rec.refusal || {};
        return {
          state: 'refused',
          reason: refusal.reason || refusal.detail || 'reason not reported',
          absenceOnly: false,
        };
      }
      if (rec.coverage === 'not_requested') {
        return { state: 'not_examined', reason: 'not requested', absenceOnly: false };
      }
      // The evidence contract calls it `verdict` ("true" | "false" | "undecided").
      const verdict = rec.verdict !== undefined ? rec.verdict : rec.outcome;
      if (verdict === true || verdict === 'true') {
        const informative = rec.informative_channels;
        return {
          state: 'holds',
          reason: null,
          absenceOnly: Array.isArray(informative) && informative.length === 0,
        };
      }
      if (verdict === false || verdict === 'false') {
        return { state: 'does_not_hold', reason: null, absenceOnly: false };
      }
      return { state: 'undecided', reason: undecidedReason(rec), absenceOnly: false };
    }
    // An absent record on pages still loading is not yet computed, whatever
    // the domain says; a record that is present answers on its own, partial
    // pages or not.
    if (!cell.jobComplete) return { state: 'not_yet_computed', reason: null, absenceOnly: false };
    if (cell.readingDependent) {
      return {
        state: 'not_examined',
        reason: 'across readings',
        absenceOnly: false,
        uncertified: true,
      };
    }
    if (cell.domainCertified) return { state: 'does_not_hold', reason: null, absenceOnly: false };
    return {
      state: 'undecided',
      reason: 'absence not certified for this method',
      absenceOnly: false,
    };
  }

  function stateWords(result) {
    if (result.state === 'holds' && result.absenceOnly) return 'holds · only empty onsets compared';
    if (result.uncertified) return 'Not certified across readings';
    const words = STATE_WORDS[result.state];
    return result.reason && result.state !== 'holds' && result.state !== 'does_not_hold'
      ? `${words} · ${result.reason}`
      : words;
  }

  // ---- keyboard ---------------------------------------------------------

  // The matrix shows each unordered pair once, above the diagonal: row < col.
  function matrixMove(pos, key, n) {
    let { row, col } = pos;
    if (key === 'ArrowRight' && col + 1 < n) col += 1;
    else if (key === 'ArrowLeft' && col - 1 > row) col -= 1;
    else if (key === 'ArrowDown' && row + 1 < col) row += 1;
    else if (key === 'ArrowUp' && row - 1 >= 0) row -= 1;
    return { row, col };
  }

  function keyAction(key) {
    if (key === 'Enter') return 'inspect';
    if (key === 'Escape') return 'clear';
    if (key.startsWith('Arrow')) return 'move';
    return null;
  }

  // occurrences: [{ entity_id, line, token }]. Tab follows the poem.
  function readingOrder(occurrences) {
    return occurrences.slice().sort((a, b) => a.line - b.line || a.token - b.token);
  }

  function nextInReadingOrder(occurrences, currentId, backwards) {
    const order = readingOrder(occurrences);
    if (!order.length) return null;
    const at = order.findIndex((o) => o.entity_id === currentId);
    if (at < 0) return order[backwards ? order.length - 1 : 0].entity_id;
    const next = at + (backwards ? -1 : 1);
    return next < 0 || next >= order.length ? null : order[next].entity_id;
  }

  // ---- words ------------------------------------------------------------

  function occurrenceLabel(o) {
    return `${o.text} · L${o.line} w${o.token}`;
  }

  // ctx: { occurrence(id) -> {text,line,token}, method(id) -> {name, layer},
  //        state: cellState result (pairs and bindings), counts (occurrences),
  //        hidden: hiddenNotice result or null }
  function announce(sel, ctx) {
    if (!sel) return 'Selection cleared';
    const spoken = (id) => {
      const o = ctx.occurrence(id);
      return `${o.text} L${o.line} w${o.token}`;
    };
    let text;
    if (sel.kind === 'occurrence') {
      const counts = ctx.counts || {};
      const parts = STATES.filter((s) => counts[s]).map((s) => `${counts[s]} ${STATE_WORDS[s]}`);
      text = `${spoken(sel.entity_id)} selected${parts.length ? `: ${parts.join(', ')}` : ''}`;
    } else if (sel.kind === 'figure') {
      text = `Figure selected`;
    } else {
      const m = ctx.method(sel.method_id);
      const who =
        sel.kind === 'pair'
          ? `${spoken(sel.members[0])} – ${spoken(sel.members[1])}`
          : sel.members.map((x) => spoken(x.entity_id)).join(' → ');
      text = `${who}: ${LAYER_WORDS[m.layer] || m.layer} · ${m.name} ${stateWords(ctx.state)}`;
    }
    if (ctx.hidden) text += `; ${ctx.hidden.text.toLowerCase().replace(/^selected \w+ /, '')}`;
    return text;
  }

  // ---- Cell shows ---------------------------------------------------------

  // checked: [{ method_id, name, layer }] in menu order. Returns the options,
  // the method the matrix shows, and a notice when that had to change.
  function cellShows(checked, currentId) {
    const options = checked.map((m) => ({
      method_id: m.method_id,
      label: `${LAYER_SHORT[m.layer] || m.layer}: ${m.name}`,
    }));
    if (!options.length) return { options, selected: null, notice: 'No method checked' };
    if (options.some((o) => o.method_id === currentId))
      return { options, selected: currentId, notice: null };
    const notice =
      currentId == null
        ? null
        : `Cell shows changed to ${options[0].label}: the previous method is no longer checked`;
    return { options, selected: options[0].method_id, notice };
  }

  const api = {
    STATES,
    STATE_WORDS,
    LAYER_WORDS,
    NAMESPACE_LAYER,
    layerOfNamespace,
    KINDS,
    occurrence,
    pair,
    binding,
    figure,
    selectionKey,
    selectionFromKey,
    sameSelection,
    selectionOccurrences,
    encodeSelection,
    decodeSelection,
    hiddenNotice,
    cellState,
    domainFacts,
    UNDECIDED_WORDS,
    stateWords,
    matrixMove,
    keyAction,
    readingOrder,
    nextInReadingOrder,
    occurrenceLabel,
    announce,
    cellShows,
  };
  root.CMConnectionInteraction = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
