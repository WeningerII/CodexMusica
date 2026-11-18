"""Resolve an explicit catalog section sequence without invoking the native pattern sampler.

The native planner supplies a projected contract and its gradeable totals.
Length allocation reuses the ordinary exact-uniform native partition engine.
"""
import re

from quality import grid, plan


FIELDS = frozenset(("version", "id", "scope", "variant", "counts", "sections",
                    "rhymeGroups", "returnGroups"))


def _validate_shape(contract):
    if (not isinstance(contract, dict) or set(contract) - {"lineRequirements"} != FIELDS
            or type(contract["version"]) is not int or contract["version"] != 1
            or contract["scope"] not in ("rule", "setting")
            or not isinstance(contract["id"], str)
            or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", contract["id"])
            or type(contract["variant"]) is not int or contract["variant"] < 0
            or not isinstance(contract["counts"], dict)
            or any(not isinstance(k, str) or not re.fullmatch(
                   r"[1-9][0-9]*(?:\[[1-9][0-9]*\])?(?:\.[1-9][0-9]*(?:\[[1-9][0-9]*\])?)*", k)
                   or type(v) is not int or v < 0 for k, v in contract["counts"].items())):
        raise plan.PlanRefused("invalid versioned catalog creation contract")
    if contract["rhymeGroups"] != [] or contract["returnGroups"] != []:
        raise plan.PlanRefused("seeded catalog creation supports native rhyme and return planning only")
    parts = contract["sections"]
    if not isinstance(parts, list) or not 1 <= len(parts) <= plan.ENVELOPE["sections"][1]:
        raise plan.PlanRefused("catalog section count is outside the native envelope")
    for part in parts:
        if (not isinstance(part, dict) or set(part) != {"unit", "role", "lines"}
                or part["unit"] != "section"):
            raise plan.PlanRefused("seeded catalog creation supports named role sequences only")
        role, lines = part["role"], part["lines"]
        if (not isinstance(role, str) or role not in plan.GENERATOR_ROSTER
                or lines is not None and (type(lines) is not int or lines < 1
                                          or role in plan.ZERO_LINE_FUNCTIONS)):
            raise plan.PlanRefused("unsupported catalog section role or line count")
    if "lineRequirements" in contract:
        if any(p["lines"] is None for p in parts):
            raise plan.PlanRefused("line requirements need a fully positioned catalog form")
        _validate_line_requirements(contract["lineRequirements"], sum(p["lines"] for p in parts))
    return parts


def resolve_catalog_shape(contract, rng, *, totals, lines=None, functions=None,
                          form="open", minimum=1):
    """Place the declared roles in order and assign each its native line count."""
    parts = _validate_shape(contract)
    if type(minimum) is not int or minimum < 1:
        raise plan.PlanRefused("invalid minimum sung lines per section")
    if lines is not None and (type(lines) is not int or lines < 1):
        raise plan.PlanRefused("invalid catalog line total")
    funcs = [p["role"] for p in parts]
    if functions is not None and set(funcs) - set(functions):
        raise plan.PlanRefused("declared function roster excludes catalog roles")
    if form not in plan.PLAN_FORMS or set(plan.FORM_REQUIRES.get(form, ())) - set(funcs) or any(
            funcs.count(f) < 2 for f in plan.FORM_RECURS.get(form, ())):
        raise plan.PlanRefused("native form requirement conflicts with the catalog sections")
    issues = grid.placement_findings(funcs)
    if issues:
        raise plan.PlanRefused("catalog role placement: " + issues[0][0] + ": " + issues[0][2])
    for f in set(funcs):
        if grid.SECTION_FUNCTIONS[f].recurrence == "once" and funcs.count(f) > 1:
            raise plan.PlanRefused("repeated once-only roles require qualified recurrence support")
    fixed = {f: 0 for f in funcs if f in plan.ZERO_LINE_FUNCTIONS}
    for fn, part in zip(funcs, parts):
        n = part["lines"]
        if n is not None:
            if fn in fixed and fixed[fn] != n:
                raise plan.PlanRefused("different lengths for one recurrent native function")
            if n < minimum:
                raise plan.PlanRefused("declared catalog section is shorter than requested minimum")
            fixed[fn] = n
    free = [f for f in dict.fromkeys(funcs) if f not in fixed]
    weights = tuple(funcs.count(f) for f in free)
    base = sum(fixed.get(f, 0) for f in funcs) + sum(weights) * (minimum - 1)
    # Even a shape with no declared sound class needs an inspectable native pair.
    lengths = [n for n in sorted(set(totals).intersection(plan.song_line_counts()))
               if plan.ENVELOPE["total_lines"][0] <= n <= plan.ENVELOPE["total_lines"][1]
               and (lines is None or n == lines) and plan._partition_count(weights, n - base)
               and (any(k >= 2 for k in fixed.values())
                    or free and (minimum >= 2 or n > base + sum(weights)))]
    # With only a tag length open, its maximum is already known. Excluding
    # impossible totals before drawing avoids losing a known-valid arrangement.
    if free == ["tag"]:
        earlier = [k for f, k in fixed.items() if f != "tag" and k > 0]
        if earlier:
            maximum = sum(fixed.get(f, 0) for f in funcs) + weights[0] * min(earlier)
            lengths = [n for n in lengths if n <= maximum]
    if not lengths:
        raise plan.PlanRefused("catalog sections cannot fill the requested gradeable line total")
    n = rng.choice(lengths)
    shares = plan._partition_uniform(weights, n - base, rng)
    counts = {**fixed, **{f: k + minimum - 1 for f, k in zip(free, shares)}}
    if counts.get("tag") and any(0 < k < counts["tag"] for f, k in counts.items() if f != "tag"):
        raise plan.SeedRefused("this catalog partition has a tag longer than an earlier section")
    return {"total": n, "sections": [
        {"function": fn, "lines": counts[fn]} for fn in funcs]}


def _validate_line_requirements(rows, total):
    if not isinstance(rows, list) or len(rows) > total:
        raise plan.PlanRefused("lineRequirements must be an ordered list inside the declared line count")
    normalized = {}
    previous = 0
    for row in rows:
        if (not isinstance(row, dict) or not 2 <= len(row) <= 5
                or set(row) - {"line", "words", "syllables", "stress", "stresses"}
                or type(row.get("line")) is not int or not previous < row["line"] <= total
                or any(type(row[key]) is not int or row[key] < 1 for key in ("words", "syllables")
                       if key in row)):
            raise plan.PlanRefused("line requirements need unique, increasing positions and positive word/syllable counts")
        values = dict(row)
        if "stress" in values:
            mask = values["stress"]
            if not isinstance(mask, str) or not re.fullmatch(r"[./]+", mask):
                raise plan.PlanRefused("lexical stress requires an exact sequence of dots and slashes")
            if values.setdefault("syllables", len(mask)) != len(mask):
                raise plan.PlanRefused("declared syllables disagree with the stress sequence length")
            if values.setdefault("stresses", mask.count("/")) != mask.count("/"):
                raise plan.PlanRefused("declared stress count disagrees with the stress sequence")
        if "stresses" in values and (type(values["stresses"]) is not int or "syllables" not in values
                or not 0 <= values["stresses"] <= values["syllables"]):
            raise plan.PlanRefused("the stress count needs a compatible exact syllable length")
        if values.get("words", 0) > values.get("syllables", values.get("words", 0)):
            raise plan.PlanRefused("English words require at least one syllable each")
        previous = row["line"]
        normalized[previous] = values
    return normalized


def line_fit_conflicts(native, requirements):
    """Necessary arithmetic for this exact plan; pronunciation is judged on the actual draft."""
    total = native["total_lines"]
    rows = _validate_line_requirements(requirements, total)
    if not rows:
        return []
    ceilings = {s["line"]: int(plan.line_syllable_ceiling(s["duration"] * native["subdivision"]))
                for s in native["line_slots"]}
    places = plan.bound_placements(native)
    overhang = {}
    for index, members in enumerate(filter(None, native["groups"].split(";"))):
        key = plan.SC.label((index,))
        _, schema = plan._schema_of(native["relations"].get(key, native["relation"]))
        if schema is not None:
            binding = plan._overhang_binding(schema, members.split(","))
            if binding:
                line, word = binding
                overhang.setdefault(line, set()).add(word)

    # Only a verbatim whole-line return inherits the same text's word counts.
    # Union transitive returns with the grader's own equivalence rule.
    classes = {}
    if native["returns"]:
        groups = [members.split(",") for members in native["returns"].split(";") if members]
        for item in plan.SC._normalise_returns(groups, total, plan.SC.ReturnRule()):
            if item.verbatim is True and not item.placed:
                classes.update((i, item.lines) for i in item.lines)

    conflicts = []
    for members in sorted({classes.get(i, (i,)) for i in rows}):
        first = members[0]
        counts = {}
        for key in ("words", "syllables", "stresses", "stress"):
            values = {rows[i][key] for i in members if i in rows and key in rows[i]}
            if len(values) > 1:
                conflicts.append({"line": first, "code": ("CATALOG_RETURN_STRESS_CONFLICT" if key == "stress"
                                                          else "CATALOG_RETURN_COUNT_CONFLICT"),
                                  "detail": f"Whole-line returns {members} have different declared {key}."})
            elif values:
                counts[key] = values.pop()
        words = {plan.placement_word(p) for i in members for p in places.get(i, ())}
        last_separate = int(plan.LAST_WORD in words)
        highest_index = max((w for w in words if w != plan.LAST_WORD), default=0)
        minimum_words = max(highest_index + last_separate, len(words) + plan.WORDS_LEFT_FREE)
        extra = len(set().union(*(overhang.get(i, ()) for i in members)))
        if counts.get("words", minimum_words) < minimum_words:
            conflicts.append({"line": first, "code": "CATALOG_WORD_BINDINGS",
                              "detail": f"Native placements and the free-word reserve need {minimum_words} words."})
        minimum_syllables = max(minimum_words, counts.get("words", 0)) + extra
        exact = counts.get("syllables")
        if exact is not None and exact < minimum_syllables:
            conflicts.append({"line": first, "code": "CATALOG_SYLLABLE_BINDINGS",
                              "detail": f"Word and sound constraints need at least {minimum_syllables} syllables."})
        required_slots = max(minimum_syllables, exact or 0)
        for i in members:
            if required_slots > ceilings[i]:
                conflicts.append({"line": i, "code": "CATALOG_SLOTS_EXCEEDED",
                                  "detail": f"At least {required_slots} syllables need space in {ceilings[i]} slots."})
    return conflicts
