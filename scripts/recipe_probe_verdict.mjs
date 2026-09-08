// Pure acceptance oracle shared by the paid probe and its regression tests.
const ID_ERROR = /unknown|no part|no card|not found|no such/i;

// Did every edit the model successfully applied actually take, end to end?
// Read off the FINAL workspace, so a later edit that silently reverted an
// earlier one is caught too. Ops with no directly-readable result (add/remove
// tradition, and set_preface's re-derivation) are checked by their own visible
// field; anything this function cannot verify it does not claim to.
function editsHold(run) {
  const ws = run.workspace;
  if (!ws) return false;
  const card = (ref) =>
    (ws.cards || []).find((c) => c.id === ref) ||
    (ws.cards || []).find((c) => c.instrumentId === ref);
  for (const call of run.calls) {
    if (call.name !== 'edit_recipe' || call.isError) continue;
    for (const e of call.args?.edits || []) {
      const c = e.card ? card(e.card) : e.action === 'set_environment' ? ws.cards?.[0] : null;
      switch (e.action) {
        case 'set_variant':
          if (!c || c.parts?.[e.part] !== e.variant) return false;
          break;
        case 'set_preface':
          if (!c || c.preface !== e.preface) return false;
          break;
        case 'set_environment':
          if (!c) return false;
          if (e.room !== undefined && c.room !== e.room) return false;
          if (e.tuning !== undefined && c.tuning !== e.tuning) return false;
          for (const [stage, id] of Object.entries(e.chain || {})) {
            const got = c.chain?.[stage];
            const expected = Array.isArray(id) ? id : [id];
            const actual = Array.isArray(got) ? got : [got];
            if (expected.length !== actual.length || expected.some((x) => !actual.includes(x)))
              return false;
          }
          break;
        case 'add_instrument':
          if (!(ws.cards || []).some((x) => x.instrumentId === e.instrument)) return false;
          break;
        case 'remove_instrument':
          if (e.card && card(e.card)) return false;
          break;
        case 'add_tradition':
          if (!(ws.cards || []).some((x) => x.traditionId === e.tradition)) return false;
          break;
        case 'remove_tradition':
          if ((ws.cards || []).some((x) => x.traditionId === e.tradition)) return false;
          break;
        default:
          return false;
      }
    }
  }
  return true;
}

export function judge(run) {
  const errors = run.calls.filter((c) => c.isError);
  const idErrors = errors.filter((c) => ID_ERROR.test(c.error || ''));
  const recipeCalls = run.calls.filter((c) => c.recipe && !c.isError);
  const editCalls = run.calls.filter(
    (c) => c.name === 'edit_recipe' && !c.isError && c.args?.edits?.length > 0
  );
  // The workspace is threaded by the adapter, so the thing worth proving is that
  // the thread never broke: an edit that ran before any seed comes back as the
  // "no recipe yet" error, and an edit on a stale workspace comes back as an
  // unknown-card error. Both are already counted above; this asserts the
  // POSITIVE — every edit call actually received one.
  const threaded =
    editCalls.length === 0 ||
    (recipeCalls.length > 0 && !errors.some((c) => /no recipe yet/.test(c.error || '')));
  // `changed` is the engine's own confirmation that an edit landed — but it
  // reports a DIFFERENCE FROM THE SEED, so it is legitimately absent when the
  // seed already satisfied the request. Measured: "delta blues with a resonator
  // — steel body, glass slide" seeds `steel-body-resonator: bronze steel …
  // slide` before any edit runs, so the model's set_variant was a correct no-op
  // and `changed` was correctly empty. Failing that is failing the engine for
  // being right the first time.
  //
  // So `changed` is REPORTED, and the pass criterion is the stronger property it
  // was standing in for: does the state the model asked for actually hold in the
  // final workspace? That catches a silently-dropped edit (which `changed` also
  // caught) AND is honest about a no-op (which `changed` did not).
  const reportedChanged = editCalls.every((c) => (c.cards || []).some((card) => card.changed));
  const applied = editsHold(run);
  const lastRecipe = recipeCalls.length ? recipeCalls[recipeCalls.length - 1].recipe : null;
  return {
    errors: errors.length,
    idErrors: idErrors.length,
    threaded,
    edits: editCalls.length,
    verbatim: !!lastRecipe && run.reply === lastRecipe,
    reportedChanged,
    applied,
    pass:
      errors.length === 0 &&
      threaded &&
      applied &&
      editCalls.length > 0 &&
      !!lastRecipe &&
      run.reply === lastRecipe &&
      lastRecipe.length <= 1000 &&
      !run.calls.some((c) => c.name.startsWith('lyric_')),
    lastRecipe,
  };
}
