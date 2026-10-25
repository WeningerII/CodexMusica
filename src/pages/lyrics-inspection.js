/* Shared Lyrics navigation for the evidence component. No writer requests or
 * evidence inference live here; the component owns bindings and sessions. */
/* global LY, LY_TOKEN_SCHEME, LY_MAIN_TOOLS, $ui, esc, lySame, lySungTexts, lyIdentity,
 lyDraft, lyRefresh, lyCaptureWritingOrigin, lyRestoreWritingOrigin, lyGoToRangeParts,
 lySetWritingRangeMarks, lyRelationBindReport, lyRelationEvidenceView,
 lyRelationWritingMarks, lyRelationDockMarkup, lyRelationInspectorMarkup, lyRelationLineLabels,
 lyRelationOccurrenceChoices, lyRelationSessionOpen, lyRelationSessionClose,
 lyRelationSessionReopen, lyRelationSessionExpand, lyRelationSessionSelect,
 lyRelationSessionGo, lyRelationSessionReturn, lyRelationSessionStay, lyRelationSessionBack */
(() => {
  let session = null,
    pendingOrigin = null,
    choices = [],
    opener = null;
  const getView = () => {
    const saved = LY.run?.relationEvidence;
    const model = LY.model;
    return lyRelationEvidenceView(saved?.evidence, {
      requestId: saved?.requestId,
      binding: saved?.binding,
      document: {
        semanticId: lyIdentity(model),
        text: model.text,
        readerScheme: LY_TOKEN_SCHEME,
        voices: model.voices,
      },
    });
  };
  function lyInspectionReceive(
    run,
    { tools, request, matches, asked, resultModel, submittedContext }
  ) {
    const evidence =
      [...tools].reverse().find((t) => t?.schema_instance_evidence?.version === 1)
        ?.schema_instance_evidence || null;
    const model =
      matches &&
      evidence &&
      [asked, resultModel].find(
        (m) =>
          m &&
          typeof evidence.source_text === 'string' &&
          lySame(lySungTexts(m), evidence.source_text.split('\n'))
      );
    run.relationEvidence = {
      evidence,
      requestId: request?.request_id || null,
      binding: model
        ? lyRelationBindReport(evidence, {
            model,
            requestId: request.request_id,
            semanticId: lyIdentity(model),
            readerScheme: LY_TOKEN_SCHEME,
            voices: model.voices,
            submittedContext,
          })
        : null,
    };
  }
  const focusKey = (node) =>
    node && {
      id: node.id,
      ui: node.dataset?.ui,
      item: node.dataset?.id,
      name: node.getAttribute?.('name'),
    };
  const findFocus = (key) => {
    if (!key) return null;
    if (key.id) return $ui(key.id);
    return [...document.querySelectorAll('#surface-lyrics [data-ui], #surface-lyrics [name]')].find(
      (n) =>
        key.ui
          ? n.dataset.ui === key.ui && n.dataset.id === key.item
          : key.name && n.getAttribute('name') === key.name
    );
  };
  function capturePanel() {
    if (LY.size === 'narrow' && LY.mobile === 'song') return null;
    return {
      tab: LY.tab,
      mobile: LY.mobile,
      tool: LY.tool,
      focus: focusKey(document.activeElement),
      scroll: captureScroll(),
    };
  }
  function captureScroll() {
    return {
      nodes: [...document.querySelectorAll('#surface-lyrics, #surface-lyrics *')]
        .filter(
          (n) =>
            n.scrollHeight > n.clientHeight ||
            n.scrollWidth > n.clientWidth ||
            n.scrollTop ||
            n.scrollLeft
        )
        .map((node) => ({ node, id: node.id, top: node.scrollTop, left: node.scrollLeft })),
      x: window.scrollX,
      y: window.scrollY,
    };
  }
  function restoreScroll(saved) {
    for (const item of saved.nodes) {
      const node = item.node.isConnected ? item.node : item.id && $ui(item.id);
      if (node) {
        node.scrollTop = item.top;
        node.scrollLeft = item.left;
      }
    }
    window.scrollTo(saved.x, saved.y);
  }
  function closeDialog() {
    const dialog = $ui('ly-relations-dialog');
    if (!dialog?.open) return;
    const scroll = captureScroll();
    dialog.close();
    // Native dialog close may restore focus; it must not move the reading position.
    restoreScroll(scroll);
  }
  function revealSong() {
    closeDialog();
    if (LY.size === 'narrow') LY.mobile = 'song';
    if (LY_MAIN_TOOLS.includes(LY.tool)) LY.tool = '';
    lyRefresh(true);
  }
  function restorePanel(previous) {
    closeDialog();
    LY.inspectionRestoringPanel = true;
    try {
      LY.tab = previous.tab;
      LY.mobile = previous.mobile;
      LY.tool = previous.tool;
      lyRefresh(true);
      const target = findFocus(previous.focus);
      if (target?.getClientRects().length) target.focus({ preventScroll: true });
      restoreScroll(previous.scroll);
    } finally {
      LY.inspectionRestoringPanel = false;
    }
    return { ok: true };
  }
  function lyInspectionRenderDock() {
    const dock = $ui('ly-relation-dock');
    if (!dock || !LY.model) return;
    const html = lyRelationDockMarkup(getView(), session);
    if (dock.innerHTML !== html) dock.innerHTML = html;
  }
  function render() {
    if (!LY.model) return;
    const view = getView();
    lySetWritingRangeMarks(lyRelationWritingMarks(view, session));
    lyInspectionRenderDock();
    const inline = $ui('ly-relation-inspector'),
      dialog = $ui('ly-relations-dialog');
    const showing = !!session?.listOpen;
    const narrow = LY.size === 'narrow';
    let html = showing ? lyRelationInspectorMarkup(view, session) : '';
    if (showing && choices.length > 1)
      html =
        `<section aria-label="Choose an occurrence"><h3>Choose the occurrence to inspect</h3>${choices.map((o) => `<button type="button" data-ui="ly-relation-source" data-id="${esc(o.id)}">${esc(o.text)} · ${esc(lyRelationLineLabels(o.lineIds))}</button>`).join('')}<button type="button" data-ui="ly-relation-source" data-id="">All document evidence</button></section>` +
        html;
    if (inline) {
      const opening = inline.hidden && showing && !narrow;
      inline.hidden = !showing || narrow;
      if (!inline.hidden && inline.innerHTML !== html) inline.innerHTML = html;
      // Opening replaces the dock's Relations button, so focus would fall to
      // the page body; it moves to the inspector's Close, as the narrow
      // dialog's does (Jony #13 on #519).
      if (opening && (!document.activeElement || document.activeElement === document.body))
        (
          inline.querySelector('[data-ui="ly-relation-close"]') || inline.querySelector('button')
        )?.focus({ preventScroll: true });
    }
    if (dialog) {
      dialog.classList.toggle('is-expanded', !!session?.expanded);
      if (!showing || !narrow) closeDialog();
      else {
        if (dialog.innerHTML !== html) dialog.innerHTML = html;
        if (!dialog.open) dialog.showModal();
      }
    }
  }
  function lyInspectionAction(action, id, button) {
    if (!LY.model) return;
    if (action === 'ly-relations') {
      const captured = pendingOrigin || { origin: lyCaptureWritingOrigin(), panel: capturePanel() };
      pendingOrigin = null;
      opener = button;
      const view = getView();
      choices = lyRelationOccurrenceChoices(view, captured.origin);
      session = lyRelationSessionOpen(
        view,
        captured.origin,
        captured.panel,
        choices.length === 1 ? choices[0].id : null
      );
    } else if (!session) return;
    else if (action === 'ly-relation-source') {
      const view = getView();
      if (id && !choices.some((o) => o.id === id)) return;
      session = { ...session, sourceOccurrence: id || null, expanded: false };
      choices = [];
      // The explicit choice selects a source, never a candidate measurement.
      if (id && !view.occurrences[id]?.canGo) session = { ...session, sourceOccurrence: null };
    } else if (action === 'ly-relation-expand') session = lyRelationSessionExpand(session);
    else if (action === 'ly-relation-reopen') session = lyRelationSessionReopen(session);
    else if (action === 'ly-relation-close') {
      session = lyRelationSessionClose(session);
      closeDialog();
      if (opener?.isConnected && opener.getClientRects().length)
        opener.focus({ preventScroll: true });
    } else if (action === 'ly-relation-go') {
      const index = /^\d+$/.test(button?.dataset.part || '') ? Number(button.dataset.part) : NaN;
      session = lyRelationSessionSelect(
        session,
        getView(),
        button?.dataset.pair,
        button?.dataset.side,
        index
      );
      if (session.selected) {
        // The component validates identity/freshness/placement before any UI change.
        session = lyRelationSessionGo(session, getView(), { go: () => ({ ok: true }) });
        if (!session.reason) {
          session = lyRelationSessionClose(session);
          revealSong();
          session = lyRelationSessionGo(session, getView(), { go: lyGoToRangeParts });
        }
      }
    } else if (action === 'ly-relation-return') {
      // Refuse stale Return BEFORE closing or changing panels: keep current selection/scroll.
      const origin = session.origin,
        draft = lyDraft();
      const valid =
        origin &&
        origin.text === draft?.value &&
        Number.isInteger(origin.start) &&
        Number.isInteger(origin.end) &&
        origin.start >= 0 &&
        origin.end >= origin.start &&
        origin.end <= draft.value.length &&
        ['forward', 'backward', 'none'].includes(origin.direction) &&
        Array.isArray(origin.scroll);
      if (!valid || session.returnUnavailable)
        session = lyRelationSessionReturn(session, {
          restore: () => ({
            ok: false,
            reason: origin?.text !== draft?.value ? 'document-mismatch' : 'invalid-origin',
          }),
        });
      else {
        session = lyRelationSessionClose(session);
        revealSong();
        session = lyRelationSessionReturn(session, { restore: lyRestoreWritingOrigin });
      }
      if (session.armed && session.reason) session = lyRelationSessionReopen(session);
    } else if (action === 'ly-relation-stay') {
      session = lyRelationSessionStay(session);
      choices = [];
      closeDialog();
    } else if (action === 'ly-relation-back') {
      session = lyRelationSessionClose(session);
      session = lyRelationSessionBack(session, { back: restorePanel });
    }
    render();
  }
  function lyInspectionWire(surface) {
    surface.addEventListener(
      'pointerdown',
      (event) => {
        if (event.target.closest('[data-ui="ly-relations"]'))
          pendingOrigin = { origin: lyCaptureWritingOrigin(), panel: capturePanel() };
        else pendingOrigin = null;
      },
      true
    );
    surface.addEventListener(
      'keydown',
      () => {
        pendingOrigin = null;
      },
      true
    );
    $ui('ly-relations-dialog')?.addEventListener('cancel', (event) => {
      event.preventDefault();
      lyInspectionAction('ly-relation-close');
    });
  }
  function lyInspectionEscape() {
    if (!session?.listOpen) return false;
    lyInspectionAction('ly-relation-close');
    return true;
  }
  Object.assign(globalThis, {
    lyInspectionSession: () => session,
    lyInspectionReceive,
    lyInspectionRefresh: render,
    lyInspectionRenderDock,
    lyInspectionWire,
    lyInspectionAction,
    lyInspectionEscape,
  });
})();
