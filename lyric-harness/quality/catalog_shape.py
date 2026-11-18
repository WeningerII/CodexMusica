"""Resolve an explicit catalog section sequence without invoking the native pattern sampler.

The native planner supplies a projected contract and its gradeable totals.
Length allocation reuses the ordinary exact-uniform native partition engine.
"""
import re

from quality import grid, plan
from quality.relations import audible_as_end_rhyme


FIELDS = frozenset(("version", "id", "scope", "variant", "counts", "sections",
                    "rhymeGroups", "returnGroups"))


def terminal_rhyme_relation(name):
    """Whether this native declaration can bind an audible rhyme at both line endings."""
    _, schema = plan._schema_of(name)
    return name == "class:RHYME" or schema is not None and audible_as_end_rhyme(schema)


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
    if contract["returnGroups"] != []:
        raise plan.PlanRefused("prescribed catalog returns are not supported by the seeded writer")
    parts = contract["sections"]
    if not isinstance(parts, list) or not 1 <= len(parts) <= plan.ENVELOPE["sections"][1]:
        raise plan.PlanRefused("catalog section count is outside the native envelope")
    for part in parts:
        if (not isinstance(part, dict) or set(part) - {"bars"} != {"unit", "role", "lines"}
                or part["unit"] != "section"):
            raise plan.PlanRefused("seeded catalog creation supports named role sequences only")
        if "bars" in part and (type(part["bars"]) is not int or part["bars"] < 1):
            raise plan.PlanRefused("catalog section bars must be a positive integer")
        role, lines = part["role"], part["lines"]
        if (not isinstance(role, str) or role not in plan.GENERATOR_ROSTER
                or lines is not None and (type(lines) is not int or lines < 1
                                          or role in plan.ZERO_LINE_FUNCTIONS)):
            raise plan.PlanRefused("unsupported catalog section role or line count")
    groups = contract["rhymeGroups"]
    if groups != []:
        if (not isinstance(groups, list) or len(groups) != 1 or not isinstance(groups[0], list)
                or len(parts) != 1 or len(groups[0]) < 2 or len(groups[0]) != parts[0]["lines"]
                or any(type(n) is not int or n != i for i, n in enumerate(groups[0], 1))):
            raise plan.PlanRefused("prescribed rhyme requires one terminal group spanning one section")
    if "lineRequirements" in contract:
        if any(p["lines"] is None for p in parts):
            raise plan.PlanRefused("line requirements need a fully positioned catalog form")
        _validate_line_requirements(contract["lineRequirements"], sum(p["lines"] for p in parts))
    return parts


def resolve_catalog_shape(contract, rng, *, totals, lines=None, functions=None,
                          form="open", minimum=1, melody_bars=None):
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
    totals = sorted(n for n in set(totals).intersection(plan.song_line_counts())
                    if plan.ENVELOPE["total_lines"][0] <= n <= plan.ENVELOPE["total_lines"][1]
                    and (lines is None or lines == n))
    by_role = {}
    for part in parts:
        if "bars" in part and by_role.setdefault(part["role"], part["bars"]) != part["bars"]:
            raise plan.PlanRefused("different bar counts for one recurrent native function")
    if by_role:
        if melody_bars is not None and (type(melody_bars) is not int or melody_bars < 1):
            raise plan.PlanRefused("melody bars must be a positive integer")
        low, high = plan.ENVELOPE["bars_per_line"]
        bar_values = (melody_bars,) if melody_bars is not None else range(low, min(high, min(by_role.values())) + 1)
    else:
        bar_values = (None,)
    # The native meter spans the same number of bars per phrase throughout.
    # Enumerate exact divisors and feasible totals before choosing either.
    options = []
    for bars in bar_values:
        if any(value % bars for value in by_role.values()):
            continue
        sung = {f: value // bars for f, value in by_role.items() if f not in plan.WORDLESS_FUNCTIONS}
        if any(k < minimum or f in fixed and fixed[f] != k for f, k in sung.items()):
            continue
        determined = {**fixed, **sung}
        free, weights, base, lengths = _partition_options(funcs, determined, minimum, totals)
        if lengths:
            options.append((bars, determined, free, weights, base, lengths))
    if not options:
        if by_role:
            raise plan.PlanRefused("catalog section bars cannot fit the declared lines, melody, and native section partition")
        raise plan.PlanRefused("catalog sections cannot fill the requested gradeable line total")
    total = rng.choice(sorted({n for *_, lengths in options for n in lengths}))
    fitting = [option for option in options if total in option[-1]]
    bars, fixed, free, weights, base, _ = fitting[0] if len(fitting) == 1 else rng.choice(fitting)
    shares = plan._partition_uniform(weights, total - base, rng)
    counts = {**fixed, **{f: k + minimum - 1 for f, k in zip(free, shares)}}
    if counts.get("tag") and any(0 < k < counts["tag"] for f, k in counts.items() if f != "tag"):
        raise plan.SeedRefused("this catalog partition has a tag longer than an earlier section")
    result = {"total": total, "sections": [
        {"function": fn, "lines": counts[fn]} for fn in funcs]}
    if bars is not None:
        result["bars_per_line"] = bars
        result["wordless_phrases"] = {f: n // bars for f, n in by_role.items() if f in plan.WORDLESS_FUNCTIONS}
    return result


def _partition_options(funcs, fixed, minimum, totals):
    free = [f for f in dict.fromkeys(funcs) if f not in fixed]
    weights = tuple(funcs.count(f) for f in free)
    base = sum(fixed.get(f, 0) for f in funcs) + sum(weights) * (minimum - 1)
    # Even a shape with no declared sound class needs an inspectable native pair.
    lengths = [n for n in totals
               if plan._partition_count(weights, n - base)
               and (any(k >= 2 for k in fixed.values())
                    or free and (minimum >= 2 or n > base + sum(weights)))]
    # With only a tag length open, its maximum is already known. Excluding
    # impossible totals before drawing avoids losing a known-valid arrangement.
    if free == ["tag"]:
        earlier = [k for f, k in fixed.items() if f != "tag" and k > 0]
        if earlier:
            maximum = sum(fixed.get(f, 0) for f in funcs) + weights[0] * min(earlier)
            lengths = [n for n in lengths if n <= maximum]
    return free, weights, base, lengths


def _validate_line_requirements(rows, total):
    if not isinstance(rows, list) or len(rows) > total:
        raise plan.PlanRefused("lineRequirements must be an ordered list inside the declared line count")
    normalized = {}
    previous = 0
    for row in rows:
        if (not isinstance(row, dict) or len(row) < 2
                or set(row) - {"line", "words", "syllables", "stress", "stresses", "wordLetters"}
                or type(row.get("line")) is not int or not previous < row["line"] <= total
                or any(type(row[key]) is not int or row[key] < 1 for key in ("words", "syllables")
                       if key in row)):
            raise plan.PlanRefused("line requirements need unique, increasing positions and positive word/syllable counts")
        values = dict(row)
        if "wordLetters" in values:
            widths = values["wordLetters"]
            if (not isinstance(widths, list) or len(widths) != values.get("words")
                    or not any(width is not None for width in widths)
                    or any(width is not None and (type(width) is not int or width < 1) for width in widths)):
                raise plan.PlanRefused("wordLetters must select positive letter counts at declared word positions")
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
        # A verbatim return has the same spelling at each constrained word position.
        word_widths = {}
        for i in members:
            for position, width in enumerate(rows.get(i, {}).get("wordLetters", ()), 1):
                if width is not None and word_widths.setdefault(position, width) != width:
                    conflicts.append({"line": i, "code": "CATALOG_RETURN_COUNT_CONFLICT",
                                      "detail": f"Whole-line returns {members} disagree on letters in word {position}."})
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
