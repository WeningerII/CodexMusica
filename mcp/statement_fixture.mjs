// Test fixture (stage 3, "state it or say draw"): a new-song sweep's
// arguments with every STATEABLE thing stated. What the call states stays as
// it is. A missing form is a FORM_ROWS row the call can plan (its `lines` at
// least the row's floor, its `functions` holding what the row requires),
// picked by `seed` among those; every other missing row is drawn. Nothing
// here is a hand-picked value: forms come from the table, the rest is `draw`.
import { FORM_ROWS, drawList, statementsOf } from './lyric_workflow.js';

const roster = (functions) =>
  functions == null
    ? null
    : String(functions)
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean);

// -> the FORM_ROWS rows a call with these `lines` and `functions` can plan.
export function formsFor(args = {}) {
  const fns = roster(args.functions);
  return FORM_ROWS.filter(
    (r) =>
      (args.lines == null || r.min_lines <= args.lines) &&
      (!fns || r.requires.every((f) => fns.includes(f)))
  );
}

export function stated(args = {}, seed = 0) {
  const out = { ...args };
  const { missing } = statementsOf(args);
  if (missing.some((r) => !r.draw)) {
    const forms = formsFor(args);
    out.form = forms[Math.abs(seed) % forms.length].form;
  }
  const drawn = missing.filter((r) => r.draw).map((r) => r.field);
  if (drawn.length) out.draw = drawList([...(args.draw || []), ...drawn]);
  return out;
}
