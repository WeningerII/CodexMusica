"""Whole-reading form, prosody and language adapters. No writer is invoked.

Source blocks have text ranges, not invented musical geometry. Selection is
deliberately absent from this interface: consumers slice returned evidence.
"""
from __future__ import annotations

import copy
import io
import math
from collections import Counter, defaultdict
from contextlib import redirect_stderr, redirect_stdout
from fractions import Fraction

from .contracts import json_safe, range_pair


class InvalidDeclaration(ValueError):
    code = "INVALID_DECLARATION"


def _presence(value):
    return "absent" if value is None else "empty" if value == [] or value == {} else "present"


def _question(status, code=None, reason=None, **values):
    out = {"coverage": status, **values}
    if code:
        out["code"] = code
    if reason:
        out["reason"] = str(reason)
    return out


def _findings(values):
    """Serialize the engine-owned severity property without re-deciding it."""
    return [{**json_safe(value), "severity": value.severity} for value in values]


def _capacity_guard(phase, extra_bytes=0):
    # Imported at call time so the direct form API and the session traversal
    # share one deployment envelope without a module import cycle.
    from .analysis import _resource_guard
    _resource_guard(phase, extra_bytes)


def _declarations(value):
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise InvalidDeclaration("declarations must be an object")
    return copy.deepcopy(value)


def _source_basis(value, field):
    if not isinstance(value, dict) or not isinstance(value.get("source"), str) or not value["source"].strip():
        raise InvalidDeclaration(f"{field} requires a nonempty source")


def _rows(source):
    if not isinstance(source, dict):
        raise InvalidDeclaration("source must be an object")
    raw = source.get("lines")
    if raw is None:
        text = source.get("normalized_text", source.get("text", ""))
        if not isinstance(text, str):
            raise InvalidDeclaration("reading text must be a string")
        raw, offset = [], 0
        for index, physical in enumerate(text.splitlines(keepends=True)):
            line = physical.splitlines()[0] if physical.splitlines() else ""
            raw.append({"id": f"line:{index}", "text": line,
                        "kind": "lyric" if line.strip() else "blank",
                        "normalized_cp_range": [offset, offset + len(line)],
                        "source_ranges": [{**range_pair(text, offset, offset + len(line)), "precision": "exact"}]})
            offset += len(physical)
    if not isinstance(raw, list):
        raise InvalidDeclaration("source lines must be an array")
    physical, sung, used = [], [], set()
    for index, supplied in enumerate(raw):
        if index % 256 == 0:
            _capacity_guard("source row preparation")
        row = dict(supplied) if isinstance(supplied, dict) else {"text": str(supplied)}
        row.setdefault("id", f"{source.get('reading_unit_id', 'reading')}:line:{index + 1}")
        if row["id"] in used:
            raise InvalidDeclaration("source line IDs must be unique")
        used.add(row["id"])
        row.setdefault("physical_line", row.get("physical_lineno", index + 1))
        row.setdefault("source_text", row.get("text", ""))
        row.setdefault("kind", "lyric")
        cp = row.get("normalized_cp_range")
        normalized = source.get("normalized_text", source.get("text"))
        if row["kind"] == "lyric" and cp is not None:
            if (not isinstance(normalized, str) or not isinstance(cp, (list, tuple)) or len(cp) != 2
                    or any(type(v) is not int for v in cp) or not 0 <= cp[0] <= cp[1] <= len(normalized)):
                raise InvalidDeclaration("source line range is outside normalized text")
            row["text"] = normalized[cp[0]:cp[1]]
        physical.append(row)
        if row["kind"] == "lyric" and str(row.get("text", "")).strip():
            row["analysis_line"] = len(sung) + 1
            sung.append(row)
    return physical, sung


def _ranges(row):
    if row.get("source_ranges") is not None:
        return copy.deepcopy(row["source_ranges"])
    value = {"line_id": row["id"], "physical_line": row["physical_line"],
             "codepoint_range": row.get("source_cp_range"),
             "utf16_range": row.get("source_utf16_range"),
             "byte_range": row.get("byte_range"), "precision": "row"}
    return [{key: item for key, item in value.items() if item is not None}]


def _printed_source_edits(source, physical):
    """Use the engine's edition-specific printed-label receipts, in-place IDs.

    These edits interpret source apparatus; the authoritative normalized lyric
    text and all original rows/ranges remain owned by the source adapter.
    """
    from quality import grid as G
    raw = [str(row.get("source_text", row.get("text", ""))) for row in physical]
    edits, drops = G._printed_chorus_labels(raw, str(source.get("source_path", "")))
    return raw, edits, drops


def _sections(source, physical, sung, declarations):
    from quality import grid as G
    by_id = {r["id"]: r for r in sung}
    sections, marks, voice_by_line = [], [], {}
    current, voice = None, ""
    originals, source_edits, source_drops = _printed_source_edits(source, physical)
    for position, row in enumerate(physical):
        raw = source_edits.get(position, originals[position])
        if str(raw).startswith("--- TITLE:"):
            voice = ""
        match = (G._MARK_RE.match(str(raw).strip())
                 if row["kind"] != "lyric" and position not in source_drops else None)
        if match:
            base, index, function, refusal = G.ingest_mark(match.group(1), source.get("language", ""))
            if base == "PART" and ":" in match.group(1):
                voice = match.group(1).split(":", 1)[1].strip()
            spec = G.SECTION_FUNCTIONS.get(function)
            current = {"id": f"{row['id']}:block", "name": match.group(1),
                       "base": base, "instance": index, "function": function or None,
                       "kind": spec.kind if spec else "source_block", "line_ids": [],
                       "source_ranges": _ranges(row), "voice": voice or None,
                       "annotation": str(raw).strip()[match.end():].strip(),
                       "basis": "source", "source": f"source line {row['physical_line']}",
                       "function_refusal": json_safe(refusal), "bars": None, "meter": None}
            if position in source_edits:
                receipt_positions = [position]
                following = position + 1
                while following in source_edits or following in source_drops:
                    receipt_positions.append(following)
                    following += 1
                current["source_interpretation"] = {
                    "method": "quality.grid._printed_chorus_labels", "basis": "source_printed_label",
                    "printed_mark": originals[position],
                    "line_ids": [physical[i]["id"] for i in receipt_positions],
                    "source_ranges": [r for i in receipt_positions for r in _ranges(physical[i])]}
            sections.append(current)
            marks.append({"line_id": row["id"], "base": base, "raw": match.group(1),
                          "function": function or None, "refusal": json_safe(refusal)})
        if row["id"] in by_id:
            voice_by_line[row["id"]] = voice or None
            if current is not None:
                current["line_ids"].append(row["id"])
    # An upstream source adapter may have structural ranges not printed as marks.
    for item in source.get("sections", []):
        if not isinstance(item, dict) or not item.get("line_ids"):
            continue
        if not any(s["id"] == item.get("id") for s in sections):
            sections.append({"bars": None, "meter": None, "function": None,
                             "kind": "source_block", "basis": "source", **copy.deepcopy(item)})
    # Native source fields are evidence of units; they are not invented marks.
    if sung and all(r.get("couplet") is not None for r in sung):
        groups = defaultdict(list)
        for row in sung:
            groups[str(row["couplet"])].append(row)
        for key, rows in groups.items():
            sections.append({"id": f"{source.get('reading_unit_id', 'reading')}:couplet:{key}",
                "name": f"Couplet {key}", "kind": "form", "native_kind": "couplet", "function": None,
                "line_ids": [r["id"] for r in rows], "source_ranges": [x for r in rows for x in _ranges(r)],
                "basis": "source", "source": "native couplet field", "bars": None, "meter": None})
    elif sung and all(r.get("pada") is not None and r.get("native_fields", {}).get("verse") is not None for r in sung):
        groups = defaultdict(list)
        for row in sung:
            fields = row["native_fields"]
            groups[(str(fields.get("chapter", "")), str(fields["verse"]))].append(row)
        for (chapter, verse), rows in groups.items():
            sections.append({"id": f"{source.get('reading_unit_id', 'reading')}:verse:{chapter}:{verse}",
                "name": f"Verse {verse}", "kind": "form", "native_kind": "verse_pada", "function": None,
                "line_ids": [r["id"] for r in rows], "padas": [r["pada"] for r in rows],
                "source_ranges": [x for r in rows for x in _ranges(r)], "basis": "source",
                "source": "native chapter/verse/pada fields", "bars": None, "meter": None})
    annotation = declarations.get("form", {})
    if annotation is None:
        annotation = {}
    if not isinstance(annotation, dict):
        raise InvalidDeclaration("form must be an object")
    if not isinstance(annotation.get("sections", []), list):
        raise InvalidDeclaration("form sections must be an array")
    occupied = {}
    for item in annotation.get("sections", []):
        _source_basis(item, "form section")
        if "voice" in item and (not isinstance(item["voice"], str) or not item["voice"].strip()):
            raise InvalidDeclaration("a declared section voice must be a nonempty label")
        line_ids = item.get("line_ids")
        if not isinstance(line_ids, list) or not line_ids or len(set(line_ids)) != len(line_ids):
            raise InvalidDeclaration("form section requires distinct line_ids")
        if any(i not in by_id for i in line_ids):
            raise InvalidDeclaration("form section refers to a missing sung line")
        positions = [by_id[i]["analysis_line"] for i in line_ids]
        if positions != list(range(positions[0], positions[0] + len(positions))):
            raise InvalidDeclaration("form section line_ids must be an ordered contiguous range")
        function = G.as_function(item.get("function"))
        spec = G.SECTION_FUNCTIONS.get(function)
        sid = item.get("id")
        if not isinstance(sid, str) or not sid:
            raise InvalidDeclaration("form section requires an id")
        if spec and spec.kind == "section":
            for lid in line_ids:
                if lid in occupied:
                    raise InvalidDeclaration("declared section ranges must not overlap")
                occupied[lid] = sid
        raw_function = str(item.get("function") or "").strip().lower()
        special = G._SPECIALISATIONS.get(G._FUNCTION_SPELLINGS.get(raw_function, raw_function))
        if special and item.get("bars") is not None and item["bars"] != special[0].differentia_value:
            raise InvalidDeclaration(f"{raw_function} requires {special[0].differentia_field}={special[0].differentia_value}")
        value = {"id": sid, "name": item.get("name", sid), "function": function or None,
                 "raw_function": item.get("function"), "kind": spec.kind if spec else "source_block",
                 "line_ids": list(line_ids), "source": item["source"], "basis": "reader_declared",
                 "source_ranges": [r for lid in line_ids for r in _ranges(by_id[lid])],
                 "voice": item.get("voice"), "bars": None, "meter": None,
                 "specialised_as": special[0].name if special else None}
        hit = next((i for i, s in enumerate(sections) if s["id"] == sid), None)
        if hit is None:
            sections.append(value)
        else:
            sections[hit] = value
    for s in sections:
        if any(lid not in by_id for lid in s.get("line_ids", [])):
            raise InvalidDeclaration("source section refers to missing sung lines")
        s["line_count"] = len(s.get("line_ids", []))
    source_order = {row["id"]: index for index, row in enumerate(physical)}
    sections.sort(key=lambda s: min((source_order[l] for l in s["line_ids"]),
        default=source_order.get(s["id"].removesuffix(":block"), len(physical))))
    if len({s["id"] for s in sections}) != len(sections):
        raise InvalidDeclaration("section occurrence IDs must be unique")
    return sections, marks, voice_by_line


def _phonology(language, declarations):
    from quality import phonology as P
    phon = P.get(language)
    settings = declarations.get("phonology", {})
    if not isinstance(settings, dict):
        raise InvalidDeclaration("phonology settings must be an object")
    choices = declarations.get("pronunciations")
    if choices and language != "eng":
        raise InvalidDeclaration("English pronunciation choices cannot be applied to a native language")
    if language == "eng":
        if set(settings) - {"fallback", "readings"}:
            raise InvalidDeclaration("unsupported English phonology setting")
        from lyric_harness import Lexicon
        from quality.phonology.eng import English
        lex = (Lexicon(strip_parens=False, fallback=settings.get("fallback"), pronunciations=choices)
               if choices or settings.get("fallback") is not None else None)
        phon = English(fallback=settings.get("fallback"), readings=settings.get("readings", "all"), lexicon=lex)
    elif language == "ltc":
        if set(settings) - {"standard", "variants", "overlap", "edition"}:
            raise InvalidDeclaration("unsupported Middle Chinese phonology setting")
        from quality.phonology.ltc import MiddleChinese
        phon = MiddleChinese(**settings)
    elif settings:
        raise InvalidDeclaration("this native profile has no constructor settings")
    return phon


def _units(value):
    return {"text": value.text, "units": json_safe(value.units), "unit": value.unit_name,
            "grid_unit": value.grid_unit, "count": value.count if value.units else None,
            "count_lower_bound": bool(value.units) and not value.certain,
            "certain": value.certain, "prominence_rule": value.prominence_rule,
            "pattern": value.pattern() if value.units else None,
            "prominence_runs": json_safe(value.prominence_runs) if value.units else None,
            "tokens": list(value.tokens), "reading": json_safe(value.reading), "whole_readings": json_safe(value.segments),
            "refused_tokens": json_safe(value.refused),
            "prominence_refusal": json_safe(value.prominence_refusal)}


def _prosody(source, sung, declarations):
    from quality import fit as F
    from quality.phonology import Unsupported
    from lyric_harness import LexicalAssetUnavailable
    def missing_resource(exc):
        return None, {"coverage": "refused", "availability": "available", "code": "LEXICAL_ASSET_MISSING",
                      "reason": str(exc), "lines": [{"line_id": l["id"], "count": None,
                          "coverage": "refused", "source_ranges": _ranges(l)} for l in sung]}
    try:
        phon = _phonology(declarations.get("language", source.get("language", "")), declarations)
    except Unsupported as exc:
        return None, {"coverage": "refused", "availability": "unsupported", "reason": str(exc), "lines": []}
    except (ImportError, FileNotFoundError, LexicalAssetUnavailable) as exc:
        return missing_resource(exc)
    rows = []
    for index, line in enumerate(sung):
        if index % 128 == 0:
            _capacity_guard("native prosody preparation")
        try:
            units = F.read_line(line["text"], phon=phon, strip_parens=False)
        except (ImportError, FileNotFoundError, LexicalAssetUnavailable) as exc:
            return missing_resource(exc)
        rows.append({"line_id": line["id"], "source_ranges": _ranges(line), **_units(units),
                     "coverage": "answered" if units.certain else "refused"})
    return phon, {"coverage": "refused" if any(r["coverage"] == "refused" for r in rows) else "answered",
                  "availability": "available", "basis": "measured", "phonology": phon.declaration(), "lines": rows}


def decode_beatgrid(source, declaration):
    """Decode exact sourced positions: displayed unit 1 -> engine unit 0.

    Dense indices refer to the complete sung reading, never a selected slice.
    A caller resolving positions to a native stream validates the actual unit
    correspondence; this decoder does not guess units for an unread token.
    """
    if declaration is None:
        return None
    _source_basis(declaration, "beatgrid")
    from quality.declared_inputs import BeatGrid
    from quality.meter import Cycle, exact_integer, exact_number
    _physical, sung = _rows(source)
    by_id = {r["id"]: r for r in sung}
    meter = declaration.get("meter")
    if not isinstance(meter, dict) or not {"beats", "unit"} <= meter.keys():
        raise InvalidDeclaration("beatgrid requires explicit meter beats and unit")
    cycle = Cycle(exact_number(meter["beats"], "beatgrid meter beats"),
                  exact_integer(meter["unit"], "beatgrid meter unit", 1),
                  tuple(exact_number(g, "beatgrid group") for g in meter.get("groups", [])))
    if not isinstance(declaration.get("positions"), list) or declaration.get("derived_from") not in BeatGrid.DERIVATIONS:
        raise InvalidDeclaration("beatgrid requires positions array and explicit derived_from basis")
    positions = {}
    for pos in declaration["positions"]:
        if not isinstance(pos, dict) or pos.get("line_id") not in by_id:
            raise InvalidDeclaration("beatgrid position requires an existing sung line_id")
        index = exact_integer(pos.get("unit"), "beatgrid unit", 1) - 1
        locus = (by_id[pos["line_id"]]["analysis_line"] - 1, index)
        if locus in positions:
            raise InvalidDeclaration("beatgrid contains duplicate unit positions")
        positions[locus] = exact_number(pos.get("pulse"), "beatgrid pulse")
    return BeatGrid(cycle=cycle, positions=positions, derived_from=declaration["derived_from"], source=declaration["source"])


def _setting(source, sung, sections, declarations, phon):
    from quality import fit as F, grid as G
    setting = declarations.get("setting")
    if setting is None:
        decode_beatgrid(source, declarations.get("beatgrid"))  # validate a standalone R5 declaration
        return None, None, _question("not_requested", "SETTING_UNDECLARED", input_presence="absent", sections=[], lines=[])
    _source_basis(setting, "setting")
    bp = copy.deepcopy(setting)
    if not isinstance(bp.get("sections"), list) or not isinstance(bp.get("lines"), list):
        raise InvalidDeclaration("setting requires sections and lines arrays")
    if any(not isinstance(row, dict) for row in bp["sections"] + bp["lines"]):
        raise InvalidDeclaration("setting sections and lines must contain objects")
    by_id, section_ids = {l["id"]: l for l in sung}, {s["id"]: s for s in sections}
    names, line_order = {}, []
    for sec in bp["sections"]:
        sid = sec.get("id")
        if sid not in section_ids:
            raise InvalidDeclaration("setting section must reference an existing concrete form section id")
        if sid in names:
            raise InvalidDeclaration("setting section ids must be unique")
        names[sid] = section_ids[sid]
        sec["name"] = sid  # identity, never the repeated display name
        sec.setdefault("function", names[sid].get("raw_function", names[sid].get("function")))
        if not isinstance(sec.get("meter"), dict) or not {"beats", "unit"} <= sec["meter"].keys():
            raise InvalidDeclaration("each setting section requires explicit meter beats and unit")
    for line in bp["lines"]:
        lid, sid = line.get("line_id"), line.get("section_id", line.get("section"))
        if lid not in by_id or lid in line_order:
            raise InvalidDeclaration("setting line requires a distinct existing line_id")
        if sid not in names or lid not in names[sid]["line_ids"]:
            raise InvalidDeclaration("setting line must belong to its concrete form section")
        if not {"bar", "beat", "duration"} <= line.keys():
            raise InvalidDeclaration("setting line requires explicit bar, beat and duration")
        line["text"], line["section"] = by_id[lid]["text"], sid
        line_order.append(lid)
    song, _hooks = G.song_from_blueprint(bp)  # shared specialization/shape validation
    sub = declarations.get("subdivision")
    subdivision = None
    if sub is not None:
        _source_basis(sub, "subdivision")
        subdivision = F.Subdivision(sub.get("slots_per_pulse", sub.get("s")), sub["source"])
    iso = declarations.get("isochrony")
    assume = None
    if iso is not None:
        _source_basis(iso, "isochrony")
        assume = F.Isochrony(iso["source"])
    grid = decode_beatgrid(source, declarations.get("beatgrid"))
    if phon is None:
        return bp, song, _question("refused", "PHONOLOGY_UNAVAILABLE", reason="setting fit needs the reading's native phonology/resources",
                                  sections=[], lines=[], unplaced_line_ids=[l["id"] for l in sung if l["id"] not in line_order])
    fitted = F.fit_song(bp, phon=phon, subdivision=subdivision, assume=assume, strip_parens=False)
    values = []
    # SongFit.lines groups sections; map by placement, not declaration order.
    lookup = {(l["section"], l["bar"], str(Fraction(str(l["beat"]))), str(Fraction(str(l["duration"]))), l["text"]): []
              for l in bp["lines"]}
    for line in bp["lines"]:
        key = (line["section"], line["bar"], str(Fraction(str(line["beat"]))), str(Fraction(str(line["duration"]))), line["text"])
        lookup[key].append(line["line_id"])
    for lf in fitted.lines:
        p = lf.placement
        key = (p.section, p.bar, str(p.beat), str(p.duration), lf.units.text)
        lid = lookup[key].pop(0)
        if grid is not None:
            if (grid.cycle.pulses, grid.cycle.unit, grid.cycle.groups) != (p.cycle.pulses, p.cycle.unit, p.cycle.groups):
                raise InvalidDeclaration("beatgrid cycle must equal each participating line's declared cycle; mixed-cycle grid is unsupported")
            dense_index = by_id[lid]["analysis_line"] - 1
            if any(li == dense_index and ui >= len(lf.units.units) for li, ui in grid.positions) and lf.units.certain:
                raise InvalidDeclaration("beatgrid unit is outside the line's native unit stream")
            fitted_with_grid = F.fit_line(lf.units, p, phon=phon, subdivision=subdivision, assume=assume,
                                        beatgrid=grid, line_index=dense_index, strip_parens=False)
            # Preserve cross-line notes already computed by fit_song.
            fitted_with_grid.findings.extend(f for f in lf.findings if f.code == "OVERLAPPING_SPANS")
            for sec in fitted.sections:
                sec.lines = [fitted_with_grid if old is lf else old for old in sec.lines]
            lf = fitted_with_grid
        declared_line = next(l for l in song.lines if l.section == p.section and l.bar == p.bar and l.text == lf.units.text and l.beat == p.beat and l.duration == p.duration)
        try:
            seconds = json_safe(song.line_seconds(declared_line))
        except ValueError as exc:
            # Fit deliberately reports contradictory placements. One of
            # those cannot erase the report merely because timing refuses it.
            seconds = _question("refused", "DECLARED_TIMING_UNREAD", reason=str(exc), value=None)
        values.append({"line_id": lid, "section_id": p.section, "placement": json_safe(p),
                       "units": _units(lf.units), "count": lf.count if lf.units.units else None,
                       "per_pulse": json_safe(lf.per_pulse) if lf.units.units else None,
                       "per_bar": json_safe(lf.per_bar) if lf.units.units else None,
                       "required_subdivision": lf.required_subdivision if lf.units.units else None,
                       "group_heads": json_safe(lf.heads), "slots": json_safe(lf.slots),
                       "max_prominent_on_heads": lf.max_prominent_on_heads,
                       "seconds": seconds,
                       "satisfiable": lf.satisfiable, "findings": _findings(lf.findings),
                       "refusals": json_safe(lf.refusals), "source_ranges": _ranges(by_id[lid])})
    table = fitted.table()
    from quality.metric_complexity import Hypermeter, read_complexity
    raw_sections = {sec["id"]: sec for sec in bp["sections"]}
    for row in table:
        row["section_id"] = row["section"]
        row["name"] = names[row["section"]]["name"]
        declared_section = raw_sections[row["section"]]
        cycle = next(sec.cycle for sec in fitted.sections if sec.name == row["section"])
        row["meter"] = json_safe(cycle)
        complexity = declared_section.get("metric_complexity")
        row["metric_complexity"] = {
            "input_presence": _presence(complexity), "basis": "reader_declared",
            "coverage": "not_requested" if complexity is None else "answered",
            "source": setting["source"],
            "events": [{"kind": kind, "declaration": json_safe(event),
                        "result": json_safe(event.result(declared_section["bars"]) if isinstance(event, Hypermeter) else event.result())}
                       for kind, event in read_complexity(complexity or [], declared_section["bars"], cycle.pulses)]}
        if not row["exact"]:
            row["count_lower_bound"] = True
    return bp, song, {"coverage": "refused" if any(v["refusals"] for v in values) else "answered", "basis": "conditional",
                      "input_presence": "present", "source": setting["source"], "sections": json_safe(table),
                      "tempo": json_safe(song.tempo), "beatgrid": json_safe(declarations.get("beatgrid")),
                      "lines": values, "unplaced_line_ids": [l["id"] for l in sung if l["id"] not in line_order],
                      "section_findings": _findings(fitted.section_findings)}


def _return_key(declarations, phon, language, sung):
    from quality import grid as G
    supplied = declarations.get("returns")
    if supplied is not None and not isinstance(supplied, dict):
        raise InvalidDeclaration("returns must be an object")
    mode = (supplied or {}).get("rhyme_key")
    if mode is None:
        return None
    if mode == "orthographic":
        return G.rime_orthographic
    if mode != "cmudict" or language != "eng":
        raise InvalidDeclaration("return rhyme key supports explicit English cmudict or orthographic proxy")
    # Existing helper chooses first readings. Require an explicit occurrence
    # declaration before claiming this stronger return identity interpretation.
    if not declarations.get("pronunciations"):
        raise InvalidDeclaration("cmudict return identity requires explicit whole pronunciation readings")
    lex = copy.copy(getattr(phon, "lexicon", None))
    if lex is None:
        return None  # requested reading unavailable; compare_returns refuses
    declared = defaultdict(set)
    from lyric_harness import line_tokens
    endings = {}
    for line in sung:
        ts = line_tokens(line["text"], strip_parens=False)
        if ts:
            endings[line["text"]] = (len(ts), ts[-1].lower())
    for choice in declarations["pronunciations"]:
        end = endings.get(choice["line"])
        if end is not None and choice["token"] == end[0] and choice["word"].lower() == end[1]:
            declared[G.normalise_line(choice["word"]).strip("'")].add(tuple(choice["phones"]))
    # The existing helper is word-keyed, not occurrence-keyed. Distinct
    # readings of one end word cannot be collapsed into an invented identity.
    lex.entries = {word: [list(next(iter(readings)))] for word, readings in declared.items() if len(readings) == 1}
    base = G.rime_cmudict(lex)

    def explicit_key(word):
        normalized = G.normalise_line(word).strip("'")
        return base(word) if normalized in lex.entries else None

    explicit_key.declared_name = base.declared_name + "; explicit whole readings only; conflicting occurrence readings refused"
    return explicit_key


def _returns(sections, sung, declarations, phon, language, song=None, setting=None):
    from quality import grid as G
    by_id = {l["id"]: l for l in sung}
    supplied = declarations.get("returns") or {}
    if not isinstance(supplied, dict):
        raise InvalidDeclaration("returns must be an object")
    for field in ("lexical_max_tokens", "min_invariant_run"):
        if field in supplied and (type(supplied[field]) is not int or supplied[field] < (1 if field == "min_invariant_run" else 0)):
            raise InvalidDeclaration(f"{field} must be a valid nonnegative integer")
    if "restatement_overlap" in supplied and (type(supplied["restatement_overlap"]) not in (int, float) or not math.isfinite(supplied["restatement_overlap"]) or not 0 <= supplied["restatement_overlap"] <= 1):
        raise InvalidDeclaration("restatement_overlap must lie between zero and one")
    if "varies_off_text" in supplied and not isinstance(supplied["varies_off_text"], str):
        raise InvalidDeclaration("varies_off_text must name the declared channel as a string")
    key = _return_key(declarations, phon, language, sung)
    options = {k: supplied[k] for k in ("lexical_max_tokens", "min_invariant_run", "restatement_overlap", "varies_off_text") if k in supplied}
    options["rhyme_key"] = getattr(key, "declared_name", "")
    decl = G.VariationDeclaration(**options)
    # Relative timing is answerable independently of a pronunciation asset.
    timed = {row["line_id"] for row in (declarations.get("setting") or {}).get("lines", [])}
    musical = {section.name: section for section in song.sections} if song is not None else {}

    def slot(section):
        declared = musical.get(section["id"])
        if declared is None or any(lid not in timed for lid in section["line_ids"]):
            return None
        return song.slot_profile(declared)

    previous, pairs = {}, []
    for section in sections:
        fn = section.get("function")
        if not fn or not section["line_ids"]:
            continue
        if fn in previous:
            first = previous[fn]
            references = [s for s in sections if s.get("function") == fn and s["line_ids"]]
            result = G.compare_returns([by_id[l]["text"] for l in first["line_ids"]],
                                       [by_id[l]["text"] for l in section["line_ids"]], decl=decl, rhyme_key=key,
                                       first_slot=slot(first), again_slot=slot(section),
                                       reference_blocks=[[by_id[l]["text"] for l in s["line_ids"]] for s in references],
                                       language=language)
            comparison = json_safe(result)
            comparison["definition"] = result.gloss
            comparison["qualities"] = sorted(result.qualities)
            receipts = []
            for side, printed_line, target_index, _text in result.stub_resolutions:
                printed = first if side == "first" else section
                target = references[target_index - 1]
                receipts.append({"side": side, "printed_line_id": printed["line_ids"][printed_line - 1],
                    "target_section_id": target["id"], "target_line_ids": list(target["line_ids"]),
                    "source_ranges": [r for lid in target["line_ids"] for r in _ranges(by_id[lid])]})
            comparison["source_stub_resolutions"] = receipts
            for side, declared_section in (("first", first), ("again", section)):
                resolved = {r["printed_line_id"]: r["target_line_ids"] for r in receipts if r["side"] == side}
                comparison[side + "_effective_line_ids"] = [effective for lid in declared_section["line_ids"]
                    for effective in resolved.get(lid, [lid])]
            pairs.append({"id": f"{first['id']}->{section['id']}", "first_section_id": first["id"],
                          "return_section_id": section["id"], "function": fn,
                          "first_line_ids": first["line_ids"], "return_line_ids": section["line_ids"],
                          "basis": "measured", "comparison": comparison})
        previous[fn] = section
    return {"kinds": [{"id": k, "definition": d} for k, d in G.VARIATION_KINDS],
            "input_presence": _presence(declarations.get("returns")),
            "method": json_safe(decl), "requested_rhyme_key": supplied.get("rhyme_key"), "pairs": pairs,
            "coverage": "answered" if pairs else "not_requested"}


def _voices(sections, sung, voice_by_line, declarations):
    from quality.line_relations import read_line_relations, line_relation_report
    by_id = {l["id"]: i for i, l in enumerate(sung)}
    blocks = [None] * len(sung)
    for section in sections:
        for lid in section["line_ids"]:
            blocks[by_id[lid]] = section["id"]
    value = declarations.get("line_relations")
    converted = None
    if value is not None:
        if not isinstance(value, list):
            raise InvalidDeclaration("line_relations must be an array")
        converted = []
        for item in value:
            _source_basis(item, "line relation")
            if item.get("call") not in by_id or item.get("response") not in by_id:
                raise InvalidDeclaration("line relation refers to a missing line_id")
            converted.append({**item, "call": by_id[item["call"]] + 1, "response": by_id[item["response"]] + 1})
    relations = read_line_relations(converted, blocks)
    report = line_relation_report(relations, [l["text"] for l in sung], blocks)
    for link in report.get("rows", []):
        if isinstance(link, dict):
            for field in ("call", "response"):
                if type(link.get(field)) is int:
                    link[field + "_line_id"] = sung[link[field] - 1]["id"]
    grouped = defaultdict(list)
    for lid, voice in voice_by_line.items():
        if voice:
            grouped[voice].append(lid)
    return {"input_presence": _presence(value), "coverage": "not_requested" if value is None else "answered",
            "source_voices": [{"label": v, "line_ids": ids, "basis": "source"} for v, ids in grouped.items()],
            "declared_voices": [{"label": s["voice"], "line_ids": list(s["line_ids"]), "section_id": s["id"],
                                 "source": s["source"], "basis": "reader_declared"}
                                for s in sections if s.get("basis") == "reader_declared" and s.get("voice")],
            "line_relations": json_safe(report)}


def _narrative(sections, declarations):
    from quality import narrative as N
    value = declarations.get("narrative")
    result = {"atoms": list(N.ATOMS), "junctions": list(N.JUNCTIONS), "semantics": "unsupported",
              "research": {"P1": "research_only", "P2": "research_only", "P3": "deferred"},
              "input_presence": _presence(value), "coverage": "not_requested", "declaration": None, "problems": None}
    if value is not None:
        _source_basis(value, "narrative")
        if not isinstance(value.get("atoms"), list) or not isinstance(value.get("junctions"), list):
            raise InvalidDeclaration("narrative requires atoms and junctions arrays")
        functions = [s.get("function") or "" for s in sections]
        try:
            problems = N.validate_lineup(functions, value["atoms"], value["junctions"])
        except N.NarrativeRefused as exc:
            result.update(coverage="refused", reason=str(exc), code="NARRATIVE_FUNCTION_UNDECLARED")
        else:
            result.update(coverage="answered", valid=not problems, problems=problems)
        result["declaration"] = copy.deepcopy(value)
        result["basis"] = "reader_declared"
    return result


def source_ground(source):
    """Printed or explicit native-unit ground, never a guessed single stanza."""
    from quality import grid as G
    physical, sung = _rows(source)
    if sung and all(r.get("couplet") is not None for r in sung):
        keys = [str(r["couplet"]) for r in sung]
        basis = "native_couplet"
    elif sung and all(r.get("pada") is not None and r.get("native_fields", {}).get("verse") is not None for r in sung):
        keys = [(r["native_fields"].get("chapter"), r["native_fields"]["verse"]) for r in sung]
        basis = "native_verse_pada"
    else:
        originals, edits, drops = _printed_source_edits(source, physical)
        # Keep physical positions stable for stanza-to-line projection while
        # applying the same printed-block interpretation as the form reader.
        raw = ["" if i in drops else edits.get(i, row) for i, row in enumerate(originals)]
        ground, basis, refused = G.stanza_ground(raw, source.get("language", ""))
        ids = {r["id"] for r in sung}
        return {"source": basis, "lines": None if ground is None else
                [{"line_id": r["id"], "stanza": ground[i]} for i, r in enumerate(physical) if r["id"] in ids],
                "coverage": "answered" if ground is not None else "refused", "refused_marks": list(refused)}
    membership = {}
    return {"source": basis, "coverage": "answered", "refused_marks": [],
            "lines": [{"line_id": row["id"], "stanza": membership.setdefault(key, len(membership))}
                      for row, key in zip(sung, keys)]}


def _hooks(source, sung, sections, declarations):
    from quality import grid as G
    supplied = declarations.get("hooks")
    result = {"input_presence": _presence(supplied), "coverage": "not_requested" if supplied is None else "answered", "hooks": []}
    if supplied is None:
        return result
    if not isinstance(supplied, list):
        raise InvalidDeclaration("hooks must be an array")
    owner = {lid: s for s in sections for lid in s["line_ids"]}
    hook_ids = set()
    for index, hook in enumerate(supplied):
        _source_basis(hook, "hook")
        if not isinstance(hook.get("text"), str):
            raise InvalidDeclaration("hook text must be a string")
        hid = hook.get("id", f"hook:{index}")
        if not isinstance(hid, str) or not hid or hid in hook_ids:
            raise InvalidDeclaration("hook IDs must be distinct nonempty strings")
        hook_ids.add(hid)
        needle = G.tokens(hook.get("text", ""))
        if not needle:
            raise InvalidDeclaration("hook text must contain a sung token")
        occurrences = []
        for line in sung:
            words = G.tokens(line["text"])
            for offset in range(len(words) - len(needle) + 1):
                if words[offset:offset + len(needle)] == needle:
                    section = owner.get(line["id"], {})
                    occurrences.append({"line_id": line["id"], "token_offset": offset,
                        "section_id": section.get("id"), "function": section.get("function"),
                        "source_ranges": _ranges(line), "musical_position": None})
                    break  # existing hook engine counts each lyric line once
        title = G.tokens(source.get("title", ""))
        title_in = (any(needle[i:i + len(title)] == title for i in range(len(needle) - len(title) + 1))
                    if title and len(title) <= len(needle) else None)
        findings = [{"code": "HOOK_ABSENT", "severity": "flag"}] if not occurrences else []
        if len(occurrences) == 1:
            findings.append({"code": "HOOK_DOES_NOT_RECUR", "severity": "note"})
        if title_in is False:
            findings.append({"code": "TITLE_NOT_IN_HOOK", "severity": "flag"})
        functions = {o["function"] for o in occurrences if o["function"]}
        placement_refusals = []
        if len(occurrences) > 1 and not functions:
            placement_refusals.append({"code": "HOOK_PLACEMENT_UNDECLARED",
                "reason": "the recurring hook's source ranges have no declared section function"})
        elif len(occurrences) > 2 and len(functions) == 1:
            if any(not o["function"] for o in occurrences):
                placement_refusals.append({"code": "HOOK_PLACEMENT_PARTLY_UNDECLARED",
                    "reason": "whether the hook stays in one function is unknown for undeclared occurrences"})
            else:
                findings.append({"code": "HOOK_CONFINED", "severity": "note"})
        result["hooks"].append({"id": hid, "text": hook["text"],
            "source": hook["source"], "basis": "reader_declared", "occurrences": occurrences,
            "present": bool(occurrences), "recurs": len(occurrences) > 1, "title_in_hook": title_in,
            "title_coverage": "answered" if title_in is not None else "refused",
            "title_refusal": None if title_in is not None else "TITLE_UNDECLARED" if not title else "TITLE_LONGER_THAN_HOOK",
            "placement_basis": "source text ranges and declared section functions",
            "placement_coverage": "refused" if placement_refusals else "answered",
            "placement_refusals": placement_refusals, "findings": findings})
    return result


def _report_coordinates(report, lines):
    """Preserve engine line numbers and add immutable reading coordinates."""
    report = json_safe(report)

    def visit(value):
        if isinstance(value, list):
            return [visit(item) for item in value]
        if not isinstance(value, dict):
            return value
        out = {key: visit(item) for key, item in value.items()}
        if type(value.get("line")) is int and 1 <= value["line"] <= len(lines):
            row = lines[value["line"] - 1]
            out.update(line_id=row["id"], source_ranges=_ranges(row))
        if isinstance(value.get("locations"), list):
            rows = [lines[index - 1] for index in value["locations"]
                    if type(index) is int and 1 <= index <= len(lines)]
            out["line_ids"] = [row["id"] for row in rows]
            out["source_ranges"] = [r for row in rows for r in _ranges(row)]
        return out

    result = visit(report)
    if "stacked" in result:
        result["stacked_line_ids"] = [lines[i - 1]["id"] for i in result["stacked"]
                                      if type(i) is int and 1 <= i <= len(lines)]
        available = result.get("available", False)
        result["coverage"] = "answered" if available else "refused"
        if not available or not lines:
            result["fraction"] = None
        if not available:
            result["code"] = "NLP_RESOURCE_UNAVAILABLE"
    if result.get("lines_countable") == 0:
        result["rate_unreadable_final"] = None
    return result


def analyze_language(source, declarations=None):
    """Existing English feature/readability proxies, with explicit refusals."""
    from quality import features as Q
    _capacity_guard("language preparation")
    declarations = _declarations(declarations)
    _physical, lines = _rows(source)
    language = declarations.get("language", source.get("language", ""))
    unavailable = {name: {"value": None, "coverage": "refused", "reason": "English resource-backed feature unavailable"}
                   for name in Q.QualityFeatures.NAMES}
    result = {"scope": "whole_reading_unit", "line_ids": [l["id"] for l in lines],
              "features": unavailable, "sentencehood": None, "readability": None}
    if language != "eng":
        result.update(coverage="refused", availability="unsupported", reason="These lexical/POS resources are declared for English only")
        # Spelling is still available under a supported native tokenizer.
        _phon, prosody = _prosody(source, lines, declarations)
        if prosody.get("availability") == "available" and len(prosody["lines"]) == len(lines):
            repeated = defaultdict(list)
            endings = []
            for row, read in zip(lines, prosody["lines"]):
                ts = read.get("tokens", [])
                for index, word in enumerate(ts):
                    repeated[word.lower()].append({"line_id": row["id"], "token": index + 1, "source_ranges": _ranges(row)})
                endings.append({"line_id": row["id"], "word": ts[-1] if ts else None})
            result["spelling_repetitions"] = [{"word": w, "count": len(v), "occurrences": v} for w, v in sorted(repeated.items()) if len(v) > 1]
            result["line_endings"] = endings
            result["tokenizer"] = f"native phonology {language}"
        return result
    from lyric_harness import Lexicon, LexicalAssetUnavailable, line_tokens
    from quality import sentencehood as S, readability as R
    text = [l["text"] for l in lines]
    repeats = defaultdict(list)
    endings = []
    for row in lines:
        tokens = line_tokens(row["text"], strip_parens=False)
        for index, word in enumerate(tokens):
            repeats[word.lower()].append({"line_id": row["id"], "token": index + 1, "source_ranges": _ranges(row)})
        endings.append({"line_id": row["id"], "word": tokens[-1] if tokens else None})
    result["spelling_repetitions"] = [{"word": word, "count": len(hits), "occurrences": hits}
                                      for word, hits in sorted(repeats.items()) if len(hits) > 1]
    result["line_endings"] = endings
    result["tokenizer"] = "lyric_harness.line_tokens, strip_parens=False"
    result["feature_method"] = {"pair_basis": "adjacent couplets (existing extractor default)", "mattr_window": Q.MATTR_WINDOW,
                                "aggregate_score": None, "language": "eng"}
    lexical_words = [word.lower() for row in lines for word in Q.QualityFeatures._tokens(row["text"])]
    mattr = Q.QualityFeatures._mattr(lexical_words, Q.MATTR_WINDOW)
    mattr_value = {"value": json_safe(mattr), "coverage": "answered" if math.isfinite(mattr) else "refused",
                   "reason": None if math.isfinite(mattr) else "no countable tokens"}
    try:
        lex = Lexicon(strip_parens=False, fallback=declarations.get("phonology", {}).get("fallback"),
                      pronunciations=declarations.get("pronunciations"))
    except LexicalAssetUnavailable as exc:
        for value in unavailable.values():
            value["reason"] = str(exc)
        result["features"]["mattr"] = mattr_value
        result.update(coverage="refused", reason=str(exc))
        result["readability"] = _question("refused", "LEXICAL_ASSET_MISSING", reason=str(exc))
        result["sentencehood"] = _report_coordinates(S.report(text), lines)
        return json_safe(result)
    result["readability"] = _report_coordinates(R.report(lex, text), lines)
    report = S.report(text)
    result["sentencehood"] = _report_coordinates(report, lines)
    stderr = io.StringIO()
    try:
        # The CLI resource gate prints and exits 2. Preserve the refusal as
        # data rather than letting a library caller exit or pollute stdout.
        with redirect_stdout(stderr), redirect_stderr(stderr):
            extractor = Q.QualityFeatures(lex=lex)
            values = extractor.extract(text)
    except (ImportError, OSError, LookupError, SystemExit) as exc:
        reason = stderr.getvalue().strip() or str(exc)
        for value in unavailable.values():
            value["reason"] = reason
        result["features"]["mattr"] = mattr_value
    else:
        values = dict(zip(Q.QualityFeatures.NAMES, values)) if not isinstance(values, dict) else values
        result["features"] = {name: {"value": json_safe(values.get(name)),
            "coverage": "answered" if values.get(name) is not None and math.isfinite(values[name]) else "refused",
            "reason": None if values.get(name) is not None and math.isfinite(values[name]) else "measurement unavailable"}
            for name in Q.QualityFeatures.NAMES}
    result["coverage"] = "refused" if any(v["coverage"] == "refused" for v in result["features"].values()) or not report["available"] else "answered"
    return json_safe(result)


def analyze_form(source, declarations=None):
    """Return deterministic JSON-safe whole-work form and rhythm evidence."""
    from quality import grid as G
    _capacity_guard("form preparation")
    declarations = _declarations(declarations)
    physical, sung = _rows(source)
    language = declarations.get("language", source.get("language", ""))
    sections, marks, voice_by_line = _sections(dict(source, language=language), physical, sung, declarations)
    phon, prosody = _prosody(source, sung, declarations)
    bp, song, setting = _setting(source, sung, sections, declarations, phon)
    hooks = _hooks(source, sung, sections, declarations)
    by_id = {l["id"]: l for l in sung}
    stanza_source = dict(source, language=language)
    stanzas = source_ground(stanza_source)
    convention = declarations.get("convention")
    if convention not in (None, "popular_song"):
        raise InvalidDeclaration("only the explicit popular_song convention is implemented")
    shape_keys = ("four_four", "bars_multiple_of_four", "equal_section_length", "equal_line_duration",
                  "downbeat_locked", "uniform_anacrusis", "four_lines_per_section")
    contrast = {c: {"bridge": None, "against": None, "separates": None, "reason": "musical setting undeclared"}
                for c in G.POPULAR_SONG.contrast_channels}
    profile = {"form": [s.get("function") for s in sections],
               "counts": dict(Counter(s["function"] for s in sections if s.get("function"))),
               "declared": sum(bool(s.get("function")) for s in sections),
               "undeclared": sum(not s.get("function") for s in sections), "total_bars": None}
    shape, findings, refusals = {k: None for k in shape_keys}, [], []
    if song is not None and not setting["unplaced_line_ids"]:
        # Do not call a partial musical declaration the whole-work shape.
        musical_profile = G.function_profile(song)
        profile["musical_profile"] = musical_profile
        profile["total_bars"] = musical_profile["total_bars"]
        shape = G.uniformity(song)
        key = _return_key(declarations, phon, language, sung)
        _fs, cr, channels = G.bridge_contrast(song, rhyme_key=key)
        contrast = {c: channels.get(c, contrast[c]) for c in G.POPULAR_SONG.contrast_channels}
        refusals.extend(cr)
        if convention == "popular_song":
            supplied = declarations.get("returns") or {}
            variation = G.VariationDeclaration(**{k: supplied[k] for k in
                ("lexical_max_tokens", "min_invariant_run", "restatement_overlap", "varies_off_text") if k in supplied},
                rhyme_key=getattr(key, "declared_name", ""))
            report = G.song_function_report(song, hooks=[h["text"] for h in hooks["hooks"]],
                                            rhyme_key=key, decl=variation)
            findings = report["findings"] + G.stanza_lock(song)
            refusals.extend(report["refusals"])
    returns = _returns(sections, sung, declarations, phon, language, song, setting)
    melody = declarations.get("melody")
    melody_result = _question("not_requested", input_presence="absent", declaration=None)
    if melody is not None:
        _source_basis(melody, "melody")
        from quality.melody import validate_melody
        melody_result = _question("answered", input_presence="present", basis="reader_declared", source=melody["source"],
            declaration=validate_melody({k: v for k, v in melody.items() if k != "source"}),
            underlay=None, performance=None)
    return json_safe({"scope": "whole_reading_unit", "reading_unit_id": source.get("reading_unit_id"),
                      "reading_revision": source.get("reading_revision"), "completeness": source.get("completeness"),
                      "line_ids": [l["id"] for l in sung], "line_count": len(sung), "sections": sections,
                      "source_marks": marks, "profile": profile, "convention": convention,
                      "shape": shape, "bridge_contrast": contrast, "findings": _findings(findings), "refusals": refusals,
                      "stanzas": stanzas, "hooks": hooks,
                      "returns": returns, "voices": _voices(sections, sung, voice_by_line, declarations),
                      "narrative": _narrative(sections, declarations), "rhythm": {"prosody": prosody, "setting": setting, "melody": melody_result}})
