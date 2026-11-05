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
            kind = grid.SECTION_FUNCTIONS[label_reading["canonical"]].kind
            out["explanation"] = (
                f"section labelled {label!r}; no line {label_reading['canonical']} declared"
                if kind == "line" else
                f"label {label!r} recognised; no section function declared or checked"
            )
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
    line_kind = grid.SECTION_FUNCTIONS.get(reading["canonical"])
    out["explanation"] = (
        "refused: " + out["declaration_refusal"]
        if out["declaration_refusal"] is not None else
        f"Blueprint reader accepts {raw.get('function')!r}, a line-kind name, on this section; "
        "no contained line role is declared and no section-function assessment has run."
        if line_kind is not None and line_kind.kind == "line" else
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
        "convention": "Convention: musical advice; never withholds certification.",
        "declared": "Declared: the user or chosen form asked for it; an unjudged obligation can withhold certification.",
        "structural_repair": "Occurrence, order and grid changes require manual structural editing, redeclaration or replanning, followed by recheck; rewriting words alone does not repair them.",
        "word_repair": "Explicit Return identity obligations are separate from advisory function return measurements. Existing copy/rewrite operations may repair word identity; recheck the declared obligation.",
        "measurement": "Acoustic properties are not verified from text. A label or resolved name does not establish a performed musical result.",
    }
