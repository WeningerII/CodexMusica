"""Additive display metadata, before Section canonicalises a declaration.

Not a grading/coverage API. Callers must retain the original request/blueprint
for persistence and hashing; never write these rows back into plan.request.
The planner uses name readings in its writer brief. Resolution does not run placement, return,
contrast, planning, or acoustic checks. Existing reports own their outcomes.

WHAT IS NOT HERE ANY MORE (issue #676, owner's word 2026-11-15). This module
also held `disclose_section`, a per-section reading of a blueprint heading,
and four standing sentences about who asked for a check and what kind of
repair answers it. Neither was ever shown to a writer: the step that would
have printed them was not built, and `disclose_section` could not be used
where it was meant to go (it judged one section alone, so its words differed
from the run's own for the same fault, and it refused a list request for a
bar count nobody had been asked for). What they were for is now said where
the fact is: the `function:draft` coverage row says a heading is only a
label (`quality/revise.py`), and a placement note says no rewrite moves a
section (`quality/grid.py`).
"""
from copy import deepcopy

from quality import grid


def disclose_functions(functions):
    """Describe a raw ordered sequence; preserve duplicates and exact strings.

    This resolves names only, not roster feasibility or specialisation bars.
    A refused name retains the resolver's exact exception text.
    """
    rows = []
    for raw in functions:
        row = {"raw": deepcopy(raw), "canonical": None,
               "specialised_as": "", "refusal": None}
        try:
            row["canonical"] = grid.as_function(raw)
            specialisation = grid.specialisation_of(raw)
            if specialisation is not None:
                row["specialised_as"] = specialisation[0].name
        except grid.UnknownFunction as exc:
            row["refusal"] = str(exc)
        row["explanation"] = (
            "refused: " + row["refusal"] if row["refusal"] is not None else
            "No function declared; no section function checked."
            if row["canonical"] == grid.UNDECLARED else
            "Name resolved only; planning and section function checks not run."
        )
        rows.append(row)
    return rows


#: Printed under an EFFECT_NOT_VERIFIED note by the `function` verb
#: (`lyric_harness.py`). Report prose: it classifies nothing, and it is
#: never appended as an obligation row. The reason category is the team's
#: agreed "not verified from text" (issue #676 comment 6586644079).
NOT_VERIFIED_FROM_TEXT = (
    "Acoustic properties aren't verified from text. A section's label or "
    "resolved name doesn't show how it sounds when performed.")


def function_capabilities():
    """One row per registered function: what declaring it gets asked.

    The capability ledger of issue #676 (comment 6587459008) as data read off
    the registry, so it cannot go stale beside it. Display metadata like the
    rest of this module: nothing is checked here, and a row describes the
    checks that exist, not a result for any song.

    placement              "checked" when the registry row makes a placement
                           claim the report asks; "refused" when the row
                           records why no claim is made; "no claim" otherwise.
    recurrence, returns_as the row's own convention. `returns_as` is "" on
                           a row that is not asked about its returns
                           (owner's ruling, 18 Nov 2026; "n/a" before).
                           `map/build.py` prints that as "—".
    contrast_measured      the functions this one is measured against.
    not_verified_from_text what the name promises about the performance.
    """
    rows = []
    for name, spec in grid.SECTION_FUNCTIONS.items():
        placed = bool(spec.boundary or spec.requires or spec.adjacent_after
                      or spec.adjacent_before or spec.needs_before
                      or spec.needs_after)
        rows.append({
            "function": name,
            "placement": ("checked" if placed else
                          "refused" if spec.placement_refused else "no claim"),
            "recurrence": spec.recurrence,
            "returns_as": spec.returns_as,
            "contrast_measured": [b for a, b in grid.MEASURED_CONTRASTS if a == name],
            "not_verified_from_text": spec.unverified,
        })
    return rows
