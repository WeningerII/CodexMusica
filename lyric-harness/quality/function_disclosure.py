"""Additive display metadata, before Section canonicalises a declaration.

Not a grading/coverage API. Callers must retain the original request/blueprint
for persistence and hashing; never write these rows back into plan.request.
The planner uses name readings in its writer brief. Resolution does not run placement, return,
contrast, planning, or acoustic checks. Existing reports own their outcomes.
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


def disclose_section(section):
    """Describe an original blueprint section, or a heading-only name mapping.

    Recognising a label never declares its function. For a supplied function,
    the normal blueprint reader validates the section (including meter and
    specialisation). Its refusal is retained verbatim. Validation is not a
    song-function assessment, and no coverage row or status is manufactured.

    Input must be a mapping. This helper has no assume_meter argument: a
    consumer using an explicit assumed meter must carry that assumption via
    its existing validation path, not silently use this no-assumption helper.
    An original whole-blueprint/run refusal takes precedence over heading-only
    disclosure; this helper cannot replace or clear that refusal.
    """
    raw = deepcopy(section)
    reading = disclose_functions([raw.get("function")])[0]
    out = {"raw": raw, "function": reading, "label_recognized": None,
           "declaration_refusal": None}
    if reading["refusal"] is None and reading["canonical"] == grid.UNDECLARED:
        label = raw.get("name", "")
        if not isinstance(label, str) or not label.strip():
            out["explanation"] = "No label supplied; no section function declared or checked."
            return out
        label_reading = disclose_functions([label])[0]
        recognized = (label_reading["refusal"] is None
                      and label_reading["canonical"] != grid.UNDECLARED)
        out["label_recognized"] = recognized
        if recognized:
            out["explanation"] = (
                f"label {label!r} recognised; no section function declared or checked")
        else:
            out["explanation"] = (
                f"label {label!r} not recognised; no section function checked")
        return out
    if reading["refusal"] is not None:
        out["declaration_refusal"] = reading["refusal"]
    else:
        try:
            grid.song_from_blueprint({"sections": [deepcopy(raw)], "lines": []})
        except ValueError as exc:
            out["declaration_refusal"] = str(exc)
    out["explanation"] = (
        "refused: " + out["declaration_refusal"]
        if out["declaration_refusal"] is not None else
        "This section on its own passed declaration validation (bars, meter and specialisation); "
        "its lines, placement, return and contrast were not checked."
    )
    return out


def function_contract_explanations():
    """Report prose, not a classifier of findings or an authority policy.

    A2: issue #676 comment 6586644079; accepted ledger 6587769412.
    Existing finding severity, obligation counts and certification stay owned
    by the assessment. In particular, do not append these as obligation rows.
    """
    return {
        "convention": "Convention: musical advice. It never withholds certification.",
        "declared": "Declared: you, or the form you chose, asked for this. If it couldn't be judged, it can withhold certification.",
        "structural_repair": "Structural repair: if a problem is how often a section occurs, its order or its bars, fix it by editing the structure, changing the declaration or replanning, then check again. Rewriting words alone won't fix it.",
        "word_repair": "Word repair: a declared Return asks for the same words to come back. Copying or rewriting the words can fix that; check the declaration again afterwards. This is separate from the advisory measurement of how much a section returns.",
        "measurement": "Acoustic properties aren't verified from text. A section's label or resolved name doesn't show how it sounds when performed.",
    }


def function_capabilities():
    """One row per registered function: what declaring it gets asked.

    The capability ledger of issue #676 (comment 6587459008) as data read off
    the registry, so it cannot go stale beside it. Display metadata like the
    rest of this module: nothing is checked here, and a row describes the
    checks that exist, not a result for any song.

    placement              "checked" when the registry row makes a placement
                           claim the report asks; "refused" when the row
                           records why no claim is made; "no claim" otherwise.
    recurrence, returns_as the row's own convention.
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
