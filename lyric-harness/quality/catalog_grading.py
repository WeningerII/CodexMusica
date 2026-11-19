"""Measure a selected symbolic catalog pattern against each candidate draft."""
from dataclasses import replace
import json
import subprocess
from pathlib import Path

import lyric_harness as lh


def _reading(lex, text):
    words = lh._meter_words(lex, text) or []
    # The number of sung word tokens does not require a known pronunciation.
    # Meter rows are per word *piece*, so they cannot supply a compound's count.
    cut = lh.reader_line(text, lex.strip_parens, "v2")
    scheme = lh._scheme_of(lex)
    incomplete = any(lh.letters_outside_repertoire(run.text) or
                     (scheme == "v1" and run.numeral) for run in cut.runs)
    tokens = None if incomplete else lh.line_tokens(text, lex.strip_parens, scheme)
    observed = {"text": text, "sungWords": tokens, **lh._form_reading(lex, text, words=words)}
    if tokens == []:
        observed.update(syllables=0, stresses=0)
    if not words or lh.printed_endpoint(cut) or words[-1]["source"] not in ("dictionary", "declared"):
        return observed
    last = words[-1]
    reader = lex.for_line(text).for_token(last["token"] - 1)
    keys = set()
    for phones in reader.pronunciation_variants(last["word"]):
        syllables = lh.anchor(lh.syllabify(phones))
        if not syllables:
            return observed
        tail = [syllables[0]["nucleus"], *syllables[0]["coda"]]
        for syllable in syllables[1:]:
            tail.extend([*syllable["onset"], syllable["nucleus"], *syllable["coda"]])
        keys.add(" ".join(tail))
    if keys:
        observed["rhymeOptions"] = sorted(keys)
    if len(keys) == 1:
        observed["rhyme"] = keys.pop()
    return observed


def _sections(bp, observed):
    slots, sections = bp.get("lines"), bp.get("sections")
    if not isinstance(slots, list) or len(slots) != len(observed) or not isinstance(sections, list):
        return None
    from quality.fit import _owner_of
    from quality.meter import exact_integer, exact_number, validate_blueprint
    try:
        validate_blueprint(bp)
    except ValueError:
        return None
    # Use the grid's section instances. A unique label can declare an
    # overflowing placement; repeated or omitted labels need the bar interval.
    spans = []
    rows = []
    cursor = 1
    for index, section in enumerate(sections):
        bars = exact_integer(section["bars"])
        start = exact_integer(section.get("start_bar", cursor))
        spans.append({"name": section["name"], "bars": bars, "start_bar": start, "index": index})
        row = {"bars": bars}
        if "vocal_roster" in bp:
            row["vocalRoster"] = bp["vocal_roster"]
        if "choir_roster" in bp:
            row["choirRoster"] = bp["choir_roster"]
        if "performers" in section:
            row["performers"] = section["performers"]
        if "divisionPath" in section:
            row["divisionPath"] = section["divisionPath"]
        if isinstance(section.get("function"), str) and section["function"]:
            row["role"] = section["function"]
        if isinstance(section.get("source_role"), str):
            row["sourceRole"] = section["source_role"]
        rows.append(row)
        cursor = start + bars
    lengths = [0] * len(sections)
    line_bars = {}
    previous = -1
    for index, slot in enumerate(slots):
        owner = _owner_of(spans, slot.get("section"), exact_integer(slot["bar"]), dict.__getitem__)
        position = owner["index"]
        if position < previous:
            # The ordered lyric cannot express these assignments as contiguous spans.
            return None
        previous = position
        lengths[position] += 1
        meter = sections[position].get("meter") or {}
        if "duration" in slot and "beats" in meter:
            width = exact_number(slot["duration"]) / exact_number(meter["beats"])
            if width.denominator == 1:
                line_bars[index] = int(width)
    start = 0
    for row, length in zip(rows, lengths):
        row["lineSpan"] = [start, start + length]
        start += length
    for index, slot in enumerate(slots):
        if "divisionPath" in slot:
            observed[index]["divisionPath"] = slot["divisionPath"]
    for index, bars in line_bars.items():
        observed[index]["bars"] = bars
    return rows


def _native_rhyme(result, lines, mandate, report, *, terminal_groups=None, return_groups=()):
    """Combine native pair verdicts with the catalog's measured ending-sound classes."""
    basis = mandate.default_relation
    if terminal_groups:
        from quality.catalog_shape import rhyme_source_groups, terminal_rhyme_relation
        paired_groups = [group for group in terminal_groups if len(group) > 1]
        sources = rhyme_source_groups(paired_groups, return_groups)
        if return_groups:
            declared = [list(r.lines) for r in mandate.returns if r.verbatim is True and not r.placed]
            if declared != return_groups:
                result["checks"].append({"kind": "catalog-return-mandate", "outcome": "unknown"})
                if result["verdict"] == "pass":
                    result["verdict"] = "unknown"
                return result
        if ([list(group) for group in mandate.groups[:len(sources)]] != sources
                or any(not terminal_rhyme_relation(mandate.relation_of(k))
                       or any(mandate.slot_of(k, i).locus != "line_final_token" for i in group)
                       for k, group in enumerate(sources))):
            result["checks"].append({"kind": "catalog-rhyme-mandate", "outcome": "unknown"})
            if result["verdict"] == "pass":
                result["verdict"] = "unknown"
            return result
        terminal_verdicts = {(*row["lines"], row["group"]): bool(row.get("satisfied_by"))
                             for row in report["verdicts"]}
        refused_groups = set(map(tuple, report.get("refused_obligations", ())))
    elif not basis.startswith("class:"):
        return result
    verdicts = {tuple(row["lines"]): bool(row.get("satisfied_by")) for row in report["verdicts"]}
    refused = {(a, b) for a, b, _ in report.get("refused_obligations", ())}
    for check in result["checks"]:
        if check["kind"] == "rhyme-distinct":
            if terminal_groups:
                check.update(basis="ending-sound identity", lines=sorted(n for g in terminal_groups for n in g))
            else:
                check.update(outcome="unknown", reason="Distinct classes require the selected pair relation across groups")
        if check["kind"] != "rhyme":
            continue
        if terminal_groups:
            # A truncated draft can project fewer line numbers. It cannot prove the complete group.
            members = check.get("lines")
            if members not in paired_groups:
                continue
            k = paired_groups.index(members)
            sources_in_group = sources[k]
            pairs = [(a, b) for pos, a in enumerate(sources_in_group) for b in sources_in_group[pos + 1:]]
            outcomes = [None if (*pair, k) in refused_groups else terminal_verdicts.get((*pair, k)) for pair in pairs]
            native = "fail" if False in outcomes else "unknown" if None in outcomes else "pass"
            check["basis"] = mandate.relation_of(k)
            if len(terminal_groups) == 1:
                check["outcome"] = native
            else:
                identity = check["outcome"]
                check.update(nativeOutcome=native, identityOutcome=identity)
                check["outcome"] = ("fail" if "fail" in (native, identity)
                                    else "pass" if native == identity == "pass" else "unknown")
            continue
        # A verbatim repeated line shares the terminal evidence of its first occurrence.
        members = {}
        for number in check.get("lines", []):
            if number <= len(lines):
                members.setdefault(lines[number - 1], []).append(number)
        groups = list(members.values())
        outcomes = []
        for index, group in enumerate(groups):
            for other in groups[index + 1:]:
                pairs = [tuple(sorted((a, b))) for a in group for b in other]
                judged = [verdicts[pair] for pair in pairs if pair in verdicts and pair not in refused]
                outcomes.append(False if False in judged else True if True in judged else None)
        check["outcome"] = ("fail" if False in outcomes else "pass" if outcomes and None not in outcomes
                            else "unknown")
        check["basis"] = basis
    outcomes = {c["outcome"] for c in result["checks"]}
    result["verdict"] = "fail" if "fail" in outcomes else "pass" if outcomes == {"pass"} else "unknown"
    return result


def inspect_catalog(lex, lines, blueprint, mandate, report):
    selection = getattr(lex, "catalog_selection", None)
    if not selection and not isinstance(blueprint, dict):
        return None
    bp = blueprint if isinstance(blueprint, dict) else {}
    if isinstance(blueprint, (str, Path)) and selection:
        bp = json.loads(Path(blueprint).read_text(encoding="utf-8"))
    selection = selection or bp.get("song_form")
    if not selection:
        return None
    form_id = selection["id"]
    observed = [_reading(lex, line) for line in lines]
    request = {k: selection[k] for k in ("variant", "counts") if k in selection}
    request["lines"] = observed
    sections = _sections(bp, observed)
    if sections is not None:
        request["sections"] = sections
    script = Path(__file__).resolve().parents[2] / "scripts" / "song_forms.mjs"
    try:
        run = subprocess.run(["node", str(script), "grade-observations", form_id],
                             input=json.dumps(request), capture_output=True, text=True,
                             encoding="utf-8", timeout=20, check=True)
        groups = (bp.get("song_form") or {}).get("rhymeGroups")
        result = json.loads(run.stdout)
        # The native placed-return judge reads a word, not an entire repeated
        # line. Its classes stay separate from the ordinary writing mandate:
        # repeating an ending never licenses repetition elsewhere on the line.
        from quality import schemes
        classes = [row["lines"] for row in result["checks"] if row["kind"] == "endWord" and "lines" in row]
        groups_to_read = [g for g in classes if len(g) > 1 and max(g) <= len(lines)
                          and all(observed[n - 1].get("sungWords") for n in g)]
        if groups_to_read:
            positioned = schemes._normalise_returns([[f"{n}.endword" for n in g] for g in groups_to_read],
                                                   len(lines), schemes.ReturnRule())
            findings = replace(mandate, returns=positioned).placed_returns_check(lines, lex)
            outcome = ("fail" if any(row[3] == "NOT_RETURNED_AT" for row in findings)
                       else "unknown" if findings or len(groups_to_read) < len(classes) else "pass")
            result["checks"].append({"kind": "positioned-ending-identity", "outcome": outcome,
                                     "lines": sorted(n for group in classes for n in group)})
            if outcome == "fail" or result["verdict"] == "pass":
                result["verdict"] = outcome
        return _native_rhyme(result, lines, mandate, report,
                             terminal_groups=groups, return_groups=(bp.get("song_form") or {}).get("returnGroups", ()))
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        return {"id": form_id, "verdict": "unknown", "checks": [
            {"kind": "catalog-runtime", "outcome": "unknown", "reason": type(exc).__name__}]}
