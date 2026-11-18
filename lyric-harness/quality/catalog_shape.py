"""Resolve an explicit catalog section sequence without invoking the native pattern sampler.

The native planner supplies a projected contract and its gradeable totals.
Length allocation reuses the ordinary exact-uniform native partition engine.
"""
import re

from quality import grid, plan


FIELDS = frozenset(("version", "id", "scope", "variant", "counts", "sections",
                    "rhymeGroups", "returnGroups"))


def _validate_shape(contract):
    if (not isinstance(contract, dict) or set(contract) != FIELDS
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
