"""Resolve an explicit catalog section sequence without invoking the native pattern sampler.

The native planner supplies a projected contract and its gradeable totals.
Length allocation reuses the ordinary exact-uniform native partition engine.
"""
import re

from quality import grid, plan
from quality.relations import audible_as_end_rhyme


FIELDS = frozenset(("version", "id", "scope", "variant", "counts", "sections",
                    "rhymeGroups", "returnGroups"))


def line_rhyme_contract(contract):
    """Known v1 shape: all positioned rhyme groups bind line endings."""
    optional = {"openRhymeLines", "lineRequirements", "endingWords", "phraseLines",
                "lineProfile", "printedSteps", "imitationRepeats", "printedParagraphs", "closingChord", "spokenClose"}
    return (isinstance(contract, dict) and set(contract) - optional == FIELDS
            and type(contract["version"]) is int and contract["version"] == 1)


def terminal_rhyme_relation(name):
    """Whether this native declaration can bind an audible rhyme at both line endings."""
    _, schema = plan._schema_of(name)
    return name == "class:RHYME" or schema is not None and audible_as_end_rhyme(schema)


def rhyme_source_groups(groups, returns):
    """The first occurrence carries a repeated line's native rhyme obligation."""
    copies = {line for group in returns for line in group[1:]}
    return [[line for line in group if line not in copies] for group in groups]


def _valid_division_path(path):
    if not isinstance(path, list) or not 1 <= len(path) <= 32:
        return False
    for mark in path:
        if (not isinstance(mark, dict) or set(mark) - {"role"} != {"unit", "address"}
                or any(not isinstance(mark[k], str) or not re.fullmatch(r"[a-z][a-z0-9-]{0,79}", mark[k])
                       for k in ("unit", "role") if k in mark)
                or not isinstance(mark["address"], str) or len(mark["address"]) > 600
                or not re.fullmatch(r"[1-9][0-9]*\[[1-9][0-9]*\](?:\.[1-9][0-9]*\[[1-9][0-9]*\])*", mark["address"])):
            return False
    return True


def _sonnet_sections(parts, contract):
    """Check the native carrier and every positioned line link, including the final wrap."""
    form = contract["id"]
    if form not in {"sonnet-sequence", "crown-of-sonnets", "heroic-crown"}:
        return False
    master = form == "heroic-crown"
    body = parts[:-1] if master else parts
    if (any(p["role"] != "verse" or p["lines"] != 14 for p in parts)
            or any(p.get("sourceRole") != "sonnet" for p in body)
            or master and parts[-1].get("sourceRole") != "master-sonnet"):
        return False
    actual = contract["returnGroups"]
    if not actual:
        return form == "sonnet-sequence" and contract["variant"] == 0
    size = len(body)
    if size != (14 if master else 7):
        return False
    expected = []
    for index in range(size):
        head = 14 * index + 1
        previous_close = 14 * (((index - 1) % size) + 1)
        positions = [head, previous_close]
        if master:
            positions.append(14 * size + index + 1)
        expected.append(sorted(positions))
    return (isinstance(actual, list) and len(actual) == size
            and all(group in actual for group in expected))


def _validate_shape(contract):
    if (not line_rhyme_contract(contract)
            or contract["scope"] not in ("rule", "setting")
            or not isinstance(contract["id"], str)
            or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", contract["id"])
            or type(contract["variant"]) is not int or contract["variant"] < 0
            or not isinstance(contract["counts"], dict)
            or any(not isinstance(k, str) or not re.fullmatch(
                   r"[1-9][0-9]*(?:\[[1-9][0-9]*\])?(?:\.[1-9][0-9]*(?:\[[1-9][0-9]*\])?)*", k)
                   or type(v) is not int or v < 0 for k, v in contract["counts"].items())):
        raise plan.PlanRefused("invalid versioned catalog creation contract")
    parts = contract["sections"]
    if not isinstance(parts, list) or not 1 <= len(parts) <= plan.ENVELOPE["sections"][1]:
        raise plan.PlanRefused("catalog section count is outside the native envelope")
    if "spokenClose" in contract:
        length = 2 if contract["variant"] == 0 else 4
        if (set(contract) != FIELDS | {"spokenClose"} or contract["id"] != "talking-blues"
                or contract["scope"] != "setting" or contract["variant"] not in (0, 1)
                or contract["spokenClose"] is not True
                or parts != [{"unit": "section", "role": "verse", "lines": length}]
                or contract["rhymeGroups"] != ([[1, 2]] if length == 2 else []) or contract["returnGroups"]):
            raise plan.PlanRefused("the scored spoken close requires the selected couplet or quatrain")
    if "closingChord" in contract:
        if (set(contract) != FIELDS | {"closingChord"} or contract["id"] != "barbershop-tag"
                or contract["scope"] != "setting" or contract["variant"] != 0
                or contract["closingChord"] != "close-major-triad"
                or len(parts) != 1 or parts[0] not in [
                    {"unit": "section", "role": "tag", "lines": n} for n in (2, 3, 4)]
                or contract["rhymeGroups"] or contract["returnGroups"]):
            raise plan.PlanRefused("a held closing chord requires a two- to four-line tag")
    if "imitationRepeats" in contract:
        repeats = contract["imitationRepeats"]
        if (set(contract) != FIELDS | {"imitationRepeats"} or contract["scope"] != "setting"
                or contract["id"] not in ("round", "canon") or contract["variant"] != 0
                or parts != [{"unit": "section", "role": "verse", "lines": None}]
                or not isinstance(repeats, list) or not 2 <= len(repeats) <= 16
                or any(type(n) is not int or (not 2 <= n <= 16 if contract["id"] == "round"
                                              else n != 1) for n in repeats)
                or contract["rhymeGroups"] or contract["returnGroups"]):
            raise plan.PlanRefused("a literal imitative setting requires 2–16 independently scored voices")
    if "printedParagraphs" in contract:
        count = contract["printedParagraphs"]
        if (set(contract) != FIELDS | {"printedParagraphs"} or type(count) is not int
                or not plan.ENVELOPE["total_lines"][0] <= count <= plan.ENVELOPE["total_lines"][1]
                or parts != [{"unit": "section", "role": "verse", "lines": count}]
                or contract["rhymeGroups"] or contract["returnGroups"]):
            raise plan.PlanRefused("a printed paragraph setting has one native slot per unbroken paragraph")
    if "printedSteps" in contract:
        steps = contract["printedSteps"]
        if (set(contract) != FIELDS | {"printedSteps"} or not isinstance(steps, list) or not steps
                or any(type(n) is not int or n < 2 for n in steps)
                or sum(steps) > plan.ENVELOPE["total_lines"][1]
                or parts != [{"unit": "section", "role": "verse", "lines": sum(steps)}]
                or contract["rhymeGroups"] or contract["returnGroups"]):
            raise plan.PlanRefused("printed staircases need a verse with one sung row for each segment")
    if "lineProfile" in contract:
        profile = contract["lineProfile"]
        if profile in ("caesural-rhyme", "alliterative-long-line"):
            if profile == "alliterative-long-line" and contract["id"] != "alliterative-verse":
                raise plan.PlanRefused("the long-line profile requires the alliterative verse setting")
            lengths = [None]
        elif profile == "linked-couplet-echoes":
            lengths = [2] * 7
            rows = contract.get("lineRequirements")
            if not isinstance(rows, list) or len(rows) != 14 or any(
                    not isinstance(r, dict) or r.get("line") != i
                    or type(r.get("syllables")) is not int or not 9 <= r["syllables"] <= 11
                    for i, r in enumerate(rows, 1)):
                raise plan.PlanRefused("each of the fourteen echo lines needs its selected syllable count")
        elif profile in ("single-phrase-lines", "english-short-long-five"):
            lengths = [5]
        elif profile in ("didactic-word-roles", "pivot-synonym", "pivot-antonym"):
            widths = (1, 2, 3, 4, 1) if profile == "didactic-word-roles" else (1, 2, 3, 4, 3, 2, 1)
            lengths = [len(widths)]
            required = [{"line": i, "words": n} for i, n in enumerate(widths, 1)]
            if contract.get("lineRequirements") != required:
                raise plan.PlanRefused("word-role stanza requires its selected word counts")
        else:
            raise plan.PlanRefused("unknown catalog line profile")
        if (parts != [{"unit": "section", "role": "verse", "lines": n} for n in lengths]
                or contract["rhymeGroups"] or contract["returnGroups"]):
            raise plan.PlanRefused("line profile requires its declared verse boundaries without sound groups")
    for index, part in enumerate(parts):
        if (not isinstance(part, dict) or set(part) - {"bars", "divisionPath", "sourceRole", "linePaths", "vocalDuty", "melodyGroup", "textualFunction"} != {"unit", "role", "lines"}
                or part["unit"] != "section"):
            raise plan.PlanRefused("seeded catalog creation supports named role sequences only")
        if "bars" in part and (type(part["bars"]) is not int or part["bars"] < 1):
            raise plan.PlanRefused("catalog section bars must be a positive integer")
        if "divisionPath" in part and not _valid_division_path(part["divisionPath"]):
            raise plan.PlanRefused("invalid catalog division path")
        if "textualFunction" in part:
            claim = part["textualFunction"]
            path = part.get("divisionPath") or []
            role = next((m["role"] for m in reversed(path) if "role" in m), path[-1]["unit"] if path else None)
            if (not isinstance(claim, dict) or set(claim) - {"answersSection"} != {"role", "criterion"}
                    or not role or claim["role"] != role
                    or not isinstance(claim["criterion"], str) or not claim["criterion"].strip()
                    or ("answersSection" in claim and (type(claim["answersSection"]) is not int
                        or not 1 <= claim["answersSection"] <= index))):
                raise plan.PlanRefused("a textual function needs a scored role, criterion and any earlier answer target")
        if "vocalDuty" in part:
            roles = {"solo-verse": "solo", "full-choir": "full", "choral-stanza": "ensemble",
                     "cantor-verse": "cantor", "ensemble-reprise": "reprise",
                     "contrasting-part": "ensemble", "repeated-section": "ensemble"}
            path = part.get("divisionPath") or []
            last = path[-1] if path else {}
            duty = roles.get(last.get("role")) if last.get("unit") == "section" else None
            if (len(path) >= 2 and last.get("unit") == "voice" and "role" not in last
                    and path[-2].get("role") == "verse"):
                duty = "distinct-solo"
            if duty is None or part["vocalDuty"] != duty or part["role"] != ("outro" if duty == "reprise" else "verse"):
                raise plan.PlanRefused("catalog vocal duty must match its section or voice path")
        if "linePaths" in part:
            paths = part["linePaths"]
            if ("divisionPath" not in part or not isinstance(paths, list) or len(paths) != part["lines"]
                    or any(not _valid_division_path(path) or path[-1]["unit"] != "line"
                           or not path[-1].get("role") for path in paths)):
                raise plan.PlanRefused("catalog turn paths require one declared participant per line")
        role, lines = part["role"], part["lines"]
        if (not isinstance(role, str) or role not in plan.GENERATOR_ROSTER
                or lines is not None and (type(lines) is not int or lines < 1
                                          or role in plan.ZERO_LINE_FUNCTIONS)):
            raise plan.PlanRefused("unsupported catalog section role or line count")
    if any(p.get("vocalDuty") == "reprise" for p in parts):
        if (len(parts) < 2 or parts[-1].get("vocalDuty") != "reprise" or
                any(p.get("vocalDuty") != "solo" for p in parts[:-1])):
            raise plan.PlanRefused("an ensemble reprise closes the preceding solo verses")
    if any("melodyGroup" in p for p in parts):
        groups = set()
        vamp_break = (contract["id"] == "vamp-riff-form" and
                      [(p.get("sourceRole"), p["role"], p.get("melodyGroup")) for p in parts] ==
                      [("vamp", "vamp", "part-a"), ("break", "solo", "part-b")])
        for index, part in enumerate(parts, 1):
            group = part.get("melodyGroup")
            if "melodyGroup" in part:
                if vamp_break:
                    groups.add(group)
                    continue
                if part.get("sourceRole") == "contrasting-part":
                    if part.get("vocalDuty") != "ensemble" or group != f"section-{index}":
                        raise plan.PlanRefused("a contrasting ensemble part needs its own written melody")
                    groups.add(group)
                    continue
                if (group not in ("part-a", "part-b", "part-c", "part-d")
                        or {"verse": "part-a", "altered-verse": "part-b",
                            "stollen": "part-a", "abgesang": "part-b", "head": "part-a", "repeated-section": "part-a"}.get(
                                part.get("sourceRole"), part.get("sourceRole")) != group
                        or part["role"] != "verse"):
                    raise plan.PlanRefused("a melodic part needs its matching score group")
                groups.add(group)
            elif part is parts[0] and part["role"] == "intro" and part.get("sourceRole") == "introductory-verse":
                continue
            elif "sourceRole" in part or part["role"] not in ("tag", "solo"):
                raise plan.PlanRefused("an ungrouped melodic setting section must be a tag or solo")
        head_return = (len(parts) >= 3 and parts[0].get("sourceRole") == "head"
                       and parts[-1].get("sourceRole") == "head"
                       and all(p["role"] == "solo" for p in parts[1:-1]))
        ensemble_return = len(parts) >= 4 and all(p.get("sourceRole") == "repeated-section"
                                                   and p.get("vocalDuty") == "ensemble" for p in parts)
        if len(groups) < 2 and not head_return and not ensemble_return:
            raise plan.PlanRefused("a contrasting melodic setting needs distinct part groups")
    elif any("sourceRole" in part for part in parts):
        first = parts[0]
        source, carrier, count = first.get("sourceRole"), first["role"], first["lines"]
        fixed_repeat = (source in ("chant", "call") and carrier == "chorus" and
                        type(count) is int and count >= 2)
        numbered_sonnets = _sonnet_sections(parts, contract)
        same_blocks = fixed_repeat and all((part.get("sourceRole"), part["role"], part["lines"]) ==
                                          (source, carrier, count) for part in parts)
        if len(parts) < 2 or not (same_blocks or numbered_sonnets):
            raise plan.PlanRefused("unsupported source section arrangement")
    if "endingWords" in contract:
        ending = contract["endingWords"]
        if (not isinstance(ending, dict) or set(ending) - {"gathered"} != {"groups"}
                or any(p["lines"] is None for p in parts)):
            raise plan.PlanRefused("ending-word declarations need fully positioned lines")
        total = sum(p["lines"] for p in parts)
        classes = ending["groups"]
        if (not isinstance(classes, list) or len(classes) < 2
                or any(not isinstance(g, list) or len(g) < 2 or
                       any(type(i) is not int or not 1 <= i <= total for i in g)
                       or sorted(set(g)) != g for g in classes)):
            raise plan.PlanRefused("ending-word classes need ordered, repeated positions")
        assigned = {i for g in classes for i in g}
        if len(assigned) != sum(map(len, classes)):
            raise plan.PlanRefused("one ending cannot belong to two word identities")
        closing = ending.get("gathered", [])
        if (not isinstance(closing, list) or ("gathered" in ending and not closing)
                or any(type(i) is not int for i in closing)
                or closing != list(range(total - len(closing) + 1, total + 1))
                or assigned.intersection(closing)):
            raise plan.PlanRefused("a gathering passage must close the selection")
    groups = contract["rhymeGroups"]
    open_lines = contract.get("openRhymeLines", [])
    if "openRhymeLines" in contract and (
            not groups or not isinstance(open_lines, list) or not open_lines
            or any(type(n) is not int for n in open_lines)
            or open_lines != sorted(set(open_lines))):
        raise plan.PlanRefused("open rhyme lines must list individually positioned free endings")
    if groups != []:
        if (not isinstance(groups, list) or any(p["lines"] is None for p in parts)
                or len(parts) > 1 and any(p["role"] != "verse" for p in parts)
                or any(not isinstance(g, list) or not g or any(type(n) is not int for n in g)
                       or g != sorted(g) for g in groups)
                or not any(len(g) >= 2 for g in groups)
                or sum(map(len, groups)) + len(open_lines) != sum(p["lines"] for p in parts)
                or [g[0] for g in groups] != sorted(g[0] for g in groups)
                or sorted(open_lines + [n for g in groups for n in g]) != list(range(1, sum(p["lines"] for p in parts) + 1))):
            raise plan.PlanRefused("prescribed rhyme groups must partition complete positioned sections and include a rhyming pair")
    if "lineRequirements" in contract:
        if any(p["lines"] is None for p in parts):
            raise plan.PlanRefused("line requirements need a fully positioned catalog form")
        _validate_line_requirements(contract["lineRequirements"], sum(p["lines"] for p in parts))
    returns = contract["returnGroups"]
    has_repeated_carrier = bool(parts[0].get("sourceRole") in ("chant", "call") and not groups)
    if returns and has_repeated_carrier:
        width = parts[0]["lines"]
        expected = [list(range(i, width * len(parts) + 1, width)) for i in range(1, width + 1)]
        if (returns != expected or
                any(type(n) is not int for group in returns for n in group)):
            raise plan.PlanRefused("catalog returns must match the repeated lyric block at every offset")
    elif returns != []:
        if (not isinstance(returns, list) or any(p["lines"] is None for p in parts)
                or groups and parts[0]["role"] != "verse"
                or any(not isinstance(g, list) or len(g) < 2 or any(type(n) is not int for n in g)
                       or g != sorted(set(g)) or g[0] < 1 or g[-1] > sum(p["lines"] for p in parts)
                       or groups and not any(set(g) <= set(r) for r in groups) for g in returns)
                or len({n for g in returns for n in g}) != sum(map(len, returns))
                or any(len(g) < 2 for g in rhyme_source_groups([g for g in groups if len(g) > 1], returns))):
            raise plan.PlanRefused("fixed returns require independent rhyme sources in complete verse sections")
        if not groups:
            copies = {line for group in returns for line in group[1:]}
            start = 1
            can_bind = False
            for part in parts:
                stop = start + part["lines"]
                can_bind |= sum(n not in copies for n in range(start, stop)) >= 2
                start = stop
            # A complete two-turn exchange already has a testable return.
            verbatim_exchange = (returns == [[1, 2]] and len(parts) == 1
                                 and parts[0]["lines"] == 2
                                 and parts[0].get("divisionPath", [{}])[-1].get("unit") == "exchange"
                                 and tuple(path[-1]["role"] for path in parts[0].get("linePaths", ()))
                                 in (("call", "echo"), ("leader", "congregation")))
            if not can_bind and not verbatim_exchange:
                raise plan.PlanRefused("fixed returns leave no independent pair in any section")
        measures = {row["line"]: {k:v for k,v in row.items() if k != "line"}
                    for row in contract.get("lineRequirements", ())}
        if any(measures.get(n) != measures.get(g[0]) for g in returns for n in g[1:]):
            raise plan.PlanRefused("fixed returns have differing line requirements")
    if "phraseLines" in contract:
        if (contract["phraseLines"] is not True or not groups or returns or
                any(p["role"] != "verse" or p["lines"] < 2 for p in parts) or
                len(contract.get("lineRequirements", [])) != sum(p["lines"] for p in parts) or
                any(set(row) != {"line", "syllables"} for row in contract["lineRequirements"])):
            raise plan.PlanRefused("printed phrases require one measured verse line per phrase")
    return parts


def resolve_catalog_shape(contract, rng, *, totals, lines=None, functions=None,
                          form="open", minimum=1, melody_bars=None):
    """Place the declared roles in order and assign each its native line count."""
    parts = _validate_shape(contract)
    if melody_bars is not None and any("melodyGroup" in part for part in parts):
        raise plan.PlanRefused("a repeated line melody conflicts with the selected whole-section score")
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
    issues = grid.placement_findings(funcs, selected_roles=grid.setting_roles(contract))
    if issues:
        raise plan.PlanRefused("catalog role placement: " + issues[0][0] + ": " + issues[0][2])
    for f in set(funcs):
        if grid.SECTION_FUNCTIONS[f].recurrence == "once" and funcs.count(f) > 1:
            raise plan.PlanRefused("repeated once-only roles require qualified recurrence support")
    # Fixed stanza carriers may change length without asserting a changed tune
    # or a shortened copy of a verbatim chorus.
    if (all(p["role"] == "verse" and p["lines"] is not None and "bars" not in p for p in parts)
            and len({p["lines"] for p in parts}) > 1):
        sizes = [p["lines"] for p in parts]
        total = sum(sizes)
        if (min(sizes) < minimum or total not in totals or total not in plan.song_line_counts()
                or not plan.ENVELOPE["total_lines"][0] <= total <= plan.ENVELOPE["total_lines"][1]
                or lines is not None and lines != total):
            raise plan.PlanRefused("catalog sections cannot fill the requested gradeable line total")
        return {"total": total, "total_from": 1,
                "sections": [{"function": "verse", "lines": k} for k in sizes],
                "instance_lengths": True}
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
    feasible = sorted({n for *_, lengths in options for n in lengths})
    total = rng.choice(feasible)
    fitting = [option for option in options if total in option[-1]]
    bars, fixed, free, weights, base, _ = fitting[0] if len(fitting) == 1 else rng.choice(fitting)
    shares = plan._partition_uniform(weights, total - base, rng)
    counts = {**fixed, **{f: k + minimum - 1 for f, k in zip(free, shares)}}
    if counts.get("tag") and any(0 < k < counts["tag"] for f, k in counts.items() if f != "tag"):
        raise plan.SeedRefused("this catalog partition has a tag longer than an earlier section")
    result = {"total": total, "total_from": len(feasible), "sections": [
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
                or set(row) - {"line", "words", "syllables", "stress", "stresses", "wordLetters", "stressEnding", "shorterThan"}
                or type(row.get("line")) is not int or not previous < row["line"] <= total
                or any(type(row[key]) is not int or row[key] < 1 for key in ("words", "syllables")
                       if key in row)):
            raise plan.PlanRefused("line requirements need unique, increasing positions and positive word/syllable counts")
        values = dict(row)
        if "shorterThan" in values:
            predecessor = values["shorterThan"]
            if (type(predecessor) is not int or predecessor < 1 or predecessor + 1 != row["line"]
                    or "shorterThan" in normalized.get(predecessor, {})):
                raise plan.PlanRefused("relative syllable lengths require a separate preceding long line")
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
        ending = values.get("stressEnding")
        if "stressEnding" in values and (
                ending not in ("/", ".", "/.") or
                ("stress" in values and not values["stress"].endswith(ending)) or
                values.get("syllables", len(ending)) < len(ending)):
            raise plan.PlanRefused("terminal stress must agree with the selected line meter")
        if "stresses" in values and (type(values["stresses"]) is not int or values["stresses"] < 0
                or "syllables" in values and values["stresses"] > values["syllables"]):
            raise plan.PlanRefused("stress count must be nonnegative and fit any stated syllable count")
        if values.get("words", 0) > values.get("syllables", values.get("words", 0)):
            raise plan.PlanRefused("English words require at least one syllable each")
        previous = row["line"]
        normalized[previous] = values
    return normalized


def line_fit_conflicts(native, requirements, bound_copy_lines=()):
    """Necessary arithmetic for this exact plan; pronunciation is judged on the actual draft."""
    total = native["total_lines"]
    rows = _validate_line_requirements(requirements, total)
    pairs = [(n, row["shorterThan"]) for n, row in rows.items() if "shorterThan" in row]
    for _, predecessor in pairs:
        rows.setdefault(predecessor, {})
    for line in bound_copy_lines:
        rows.setdefault(line, {})
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
    intervals = {}
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
        endings = [rows[i]["stressEnding"] for i in members if i in rows and "stressEnding" in rows[i]]
        if endings:
            suffix = max(endings, key=len)
            if (any(not suffix.endswith(e) for e in endings)
                    or "stress" in counts and not counts["stress"].endswith(suffix)
                    or counts.get("syllables", len(suffix)) < len(suffix)
                    or "stresses" in counts and (counts["stresses"] < suffix.count("/")
                        or "syllables" in counts and counts["stresses"] > counts["syllables"] - suffix.count("."))):
                conflicts.append({"line": first, "code": "CATALOG_ENDING_STRESS_CONFLICT",
                                  "detail": "The terminal stress and selected line meter cannot coincide."})
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
        minimum_syllables = max(minimum_syllables, counts.get("stresses", 0) +
                                max((ending.count(".") for ending in endings), default=0),
                                max((len(ending) for ending in endings), default=0))
        exact = counts.get("syllables")
        if exact is not None and exact < minimum_syllables:
            conflicts.append({"line": first, "code": "CATALOG_SYLLABLE_BINDINGS",
                              "detail": f"Line constraints need at least {minimum_syllables} syllables."})
        required_slots = max(minimum_syllables, exact or 0)
        for i in members:
            intervals[i] = (required_slots, min(ceilings[i], exact) if exact is not None else ceilings[i])
            if required_slots > ceilings[i]:
                conflicts.append({"line": i, "code": "CATALOG_SLOTS_EXCEEDED",
                                  "detail": f"At least {required_slots} syllables need space in {ceilings[i]} slots."})
    for short, long in pairs:
        if (long in classes.get(short, ()) or intervals[short][0] >= intervals[long][1]):
            conflicts.append({"line": short, "code": "CATALOG_RELATIVE_LENGTH_CONFLICT",
                              "detail": f"Line {short} cannot have fewer sung syllables than line {long}."})
    return conflicts
