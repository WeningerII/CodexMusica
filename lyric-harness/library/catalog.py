"""Build immutable, source-faithful Library snapshots. No network or model calls.

Run from lyric-harness: python -m library.catalog build --output /path/snapshot
All source coordinates are zero-based half-open offsets in the original file;
normalized coordinates are offsets in the complete reading unit.
"""
from __future__ import annotations

import argparse
from array import array
import bisect
import csv
import difflib
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import unicodedata
import uuid

ROOT = Path(__file__).resolve().parents[1]
PARSER_VERSION = "library-catalog-v1"
NORMALIZER_VERSION = "normalized-lyrics-v1"
NAMESPACE = uuid.UUID("7b347e4c-4ea7-5cbf-8387-2975a17890f3")
AVAILABILITY = {"readable", "metadata_only", "held", "rejected", "research_only"}


class CatalogError(ValueError):
    pass


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def sha(value):
    return hashlib.sha256(value if isinstance(value, bytes) else canonical(value)).hexdigest()


def stable(kind, key):
    return f"{kind}_{uuid.uuid5(NAMESPACE, kind + ':' + key)}"


def u16(text):
    return len(text.encode("utf-16-le")) // 2


class Coordinates:
    def __init__(self, text):
        self.bytes, self.utf16 = array("Q", [0]), array("Q", [0])
        byte = utf16 = 0
        for character in text:
            byte += len(character.encode()); utf16 += 2 if ord(character) > 0xFFFF else 1
            self.bytes.append(byte); self.utf16.append(utf16)

    def project(self, start, end):
        return {"codepoint_range": [start, end], "utf16_range": [self.utf16[start], self.utf16[end]],
                "byte_range": [self.bytes[start], self.bytes[end]]}


def physical_rows(raw):
    """Preserve original terminators, offsets and Unicode whitespace."""
    text = raw.decode("utf-8", errors="strict")
    rows, cp, byte, utf16 = [], 0, 0, 0
    for number, chunk in enumerate(text.splitlines(keepends=True), 1):
        body = chunk.rstrip("\r\n\v\f\x1c\x1d\x1e\x85\u2028\u2029")
        rows.append({"physical_line": number, "source_text": body,
                     "source_cp_range": [cp, cp + len(body)],
                     "source_utf16_range": [utf16, utf16 + u16(body)],
                     "byte_range": [byte, byte + len(body.encode("utf-8"))],
                     "terminator": chunk[len(body):]})
        cp += len(chunk); byte += len(chunk.encode("utf-8")); utf16 += u16(chunk)
    return text, rows


def range_in_row(row, start, end, precision="exact"):
    body = row["source_text"]
    return {"codepoint_range": [row["source_cp_range"][0] + start, row["source_cp_range"][0] + end],
            "utf16_range": [row["source_utf16_range"][0] + u16(body[:start]), row["source_utf16_range"][0] + u16(body[:end])],
            "byte_range": [row["byte_range"][0] + len(body[:start].encode()), row["byte_range"][0] + len(body[:end].encode())],
            "physical_line": row["physical_line"], "precision": precision}


def transformation_spans(row, normalized, base):
    spans = []
    original = row["source_text"]
    for tag, a, b, c, d in difflib.SequenceMatcher(None, original, normalized, autojunk=False).get_opcodes():
        precision = "exact" if tag == "equal" else "row" if tag == "insert" else "span"
        if tag == "insert": a, b = 0, len(original)
        source = range_in_row(row, a, b, precision)
        spans.append({"normalized_cp_range": [base + c, base + d],
                      "source_cp_range": source["codepoint_range"],
                      "source_utf16_range": source["utf16_range"], "byte_range": source["byte_range"],
                      "precision": precision,
                      "kind": {"equal": "unchanged", "replace": "substitution", "delete": "deleted", "insert": "inserted"}[tag]})
    return spans


def header_fields(rows):
    result = {}; current = None
    for row in rows:
        match = re.match(r"^#\s*([\w-]+):\s*(.*)$", row["source_text"])
        if match:
            current = match[1].lower()
            result.setdefault(current, []).append(match[2])
        elif current and re.match(r"^#\s+\S", row["source_text"]):
            result[current][-1] += "\n" + re.sub(r"^#\s*", "", row["source_text"])
        else:
            current = None
    return result


def native_anchor(title):
    for pattern in (r"\[ganjoor:\s*([^\]]+)\]", r"\[(?:id|item):\s*([^\]]+)\]", r"^(\d+)[.)]\s"):
        match = re.search(pattern, title, re.I)
        if match:
            return match[1].strip()
    return None


def marked_units(path, raw_rows):
    from quality.lyric_reader import normalized_rows
    normalized = list(normalized_rows(path))
    if len(normalized) != len(raw_rows):
        raise CatalogError(f"physical row mismatch: {path}")
    rows = [{**raw, "text": norm.text, "kind": norm.kind, "indent": norm.indent}
            for raw, norm in zip(raw_rows, normalized)]
    titles = [i for i, row in enumerate(rows) if row["kind"] == "title"]
    units = []
    if titles:
        if any(row["kind"] == "lyric" for row in rows[:titles[0]]):
            units.append({"title": path.stem.replace("_", " ") + " — source prelude", "anchor": "prelude",
                          "rows": rows[:titles[0]], "completeness": "contiguous_source_segment"})
        for at, end in zip(titles, titles[1:] + [len(rows)]):
            title = rows[at]["text"][10:].strip()
            anchor = native_anchor(title)
            if anchor and re.match(r"^\d+[.)]\s", title):
                scope = "|".join(row["text"] for row in rows[at:end] if row["text"].startswith(("--- SOURCE:", "--- SECTION:")))
                anchor = scope + "|item:" + anchor
            units.append({"title": title, "anchor": anchor or f"line:{at + 1}",
                          "title_line": at + 1, "rows": rows[at:end], "completeness": "source_item"})
    elif any(row["kind"] == "lyric" for row in rows):
        units.append({"title": path.stem.replace("_", " "), "anchor": "source-segment", "rows": rows,
                      "completeness": "contiguous_source_segment"})
    return units


def roman_value(token):
    values = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
    return sum(-values[c] if i + 1 < len(token) and values[c] < values[token[i + 1]] else values[c]
               for i, c in enumerate(token))


def gutenberg_units(path, raw_rows):
    """Source-numbered sonnets and explicitly indented Whitman source titles."""
    start, end = 0, len(raw_rows)
    for i, row in enumerate(raw_rows):
        if re.search(r"\*\*\*\s*START OF", row["source_text"], re.I): start = i + 1
        if re.search(r"\*\*\*\s*END OF", row["source_text"], re.I): end = i; break
    rows = [{**r, "text": r["source_text"].strip(), "kind": "lyric" if r["source_text"].strip() else "blank",
             "indent": len(r["source_text"]) - len(r["source_text"].lstrip())} for r in raw_rows]
    anchors = []
    if path.name == "sonnets.txt":
        expected = 1
        for i in range(start, end):
            t = rows[i]["text"]
            if re.fullmatch(r"[IVXLCDM]+[.]?", t) and roman_value(t.rstrip(".")) == expected:
                anchors.append((i, f"Sonnet {expected}", str(expected))); expected += 1
        if len(anchors) != 154:
            raise CatalogError(f"sonnet numbering incomplete: found {len(anchors)}")
    else:
        # In this witness titles are flush-left and verse is indented.
        for i in range(start + 1, end - 1):
            r = rows[i]; t = r["text"]
            if r["indent"] == 0 and t and not t.startswith(("BOOK ", "By ")) and t != "LEAVES OF GRASS" and not rows[i - 1]["text"]:
                if any(rows[j]["indent"] >= 2 and rows[j]["text"] for j in range(i + 1, min(i + 5, end))):
                    anchors.append((i, t, f"line:{i + 1}"))
        if not anchors:
            raise CatalogError("Whitman witness has no evidenced title boundaries")
    units = []
    if path.name == "whitman.txt":
        prelude = [dict(r) for r in rows[start:anchors[0][0]]]
        for r in prelude:
            if r["indent"] < 2 or r["text"] == "Walt Whitman": r["kind"] = "apparatus" if r["text"] else "blank"
        if any(r["kind"] == "lyric" for r in prelude):
            units.append({"title": "Leaves of Grass — source prelude", "anchor": "prelude", "rows": prelude,
                          "completeness": "contiguous_source_segment"})
    for (at, title, anchor), stop in zip(anchors, [a[0] for a in anchors[1:]] + [end]):
        body = [dict(r) for r in rows[at:stop]]
        body[0]["kind"] = "title"
        for r in body:
            if r["text"].startswith("BOOK ") or re.fullmatch(r"\d+", r["text"]) or re.match(r"^\[[IVXLCDM]+\]\s+", r["text"]):
                r["kind"] = "apparatus"; r["source_marker"] = r["text"]
        units.append({"title": title, "anchor": anchor, "title_line": at + 1, "rows": body, "completeness": "source_item"})
    return units


def json_string_spans(text):
    """All JSON string lexemes, decoded with their exact original spans."""
    for match in re.finditer(r'"(?:[^"\\]|\\.)*"', text):
        token = match.group()
        yield match.start(), match.end(), json.loads(token)


def hafez_units(path, text, raw_rows):
    items = json.loads(text)
    if not isinstance(items, list): raise CatalogError("Hafez staged JSON must be an array")
    decoder = json.JSONDecoder(); cursor = text.find("[") + 1; units = []
    starts = [r["source_cp_range"][0] for r in raw_rows]
    for item in items:
        if set(item) != {"id", "poem"}: raise CatalogError("uncleared Hafez JSON fields")
        poem = item["poem"]
        if not isinstance(poem, list) or not all(isinstance(s, str) for s in poem): raise CatalogError("Hafez poem must be native hemistich array")
        while cursor < len(text) and text[cursor] in " \n\r\t,": cursor += 1
        object_begin = cursor; decoded, object_stop = decoder.raw_decode(text, cursor)
        if decoded != item: raise CatalogError("Hafez object correspondence")
        lexemes = list(json_string_spans(text[object_begin:object_stop]))
        at = next(i for i, (_, _, value) in enumerate(lexemes) if value == "poem")
        strings = lexemes[at + 1:]
        if [s[2] for s in strings] != poem: raise CatalogError("Hafez poem correspondence")
        poem_rows = []
        for i, ((begin, stop, _), line) in enumerate(zip(strings, poem)):
            if not line.strip(): continue
            begin += object_begin + 1; stop += object_begin - 1
            row = raw_rows[bisect.bisect_right(starts, begin) - 1]
            precision = "exact" if text[begin:stop] == line.strip() else "span"
            projected = {**row, "text": line.strip(), "kind": "lyric", "indent": len(line) - len(line.lstrip()),
                         "field_range": [begin, stop], "field_path": f"$[{len(units)}].poem", "hemistich": i + 1,
                         "couplet": i // 2 + 1, "forced_precision": precision}
            poem_rows.append(projected)
        units.append({"title": f"Hafez — ghazal {item['id']}", "anchor": f"id:{item['id']}", "rows": poem_rows,
                      "completeness": "source_item", "native_id": item["id"], "source_cp_range": [object_begin, object_stop]})
        cursor = object_stop
    return units


def dcs_units(path, raw_rows):
    units = []
    for row in raw_rows:
        if not row["source_text"].strip() or row["source_text"].startswith("#"): continue
        cells = row["source_text"].split("\t")
        if len(cells) < 7: raise CatalogError(f"DCS columns: {row['physical_line']}")
        # Header declares the native chapter/verse/half and metre-derived pādas.
        pada_cell = cells[-1]
        parts = [s.strip() for s in pada_cell.split(" | ")]
        if len(parts) != 2 or not all(parts): raise CatalogError(f"DCS pāda boundary: {row['physical_line']}")
        offset = len(row["source_text"]) - len(pada_cell)
        projected = []
        for i, part in enumerate(parts):
            at = row["source_text"].find(part, offset)
            if at < 0: raise CatalogError("DCS field correspondence")
            projected.append({**row, "text": part, "kind": "lyric", "indent": 0, "field_range": [row['source_cp_range'][0] + at, row['source_cp_range'][0] + at + len(part)], "pada": i + 1})
            offset = at + len(part)
        units.append({"title": f"{cells[0]} — {cells[1]} verse {cells[2]} half {cells[3]}",
                      "anchor": "dcs:" + ":".join(cells[:4]), "rows": projected,
                      "completeness": "documented_excerpt", "native_fields": {"text": cells[0], "chapter": cells[1], "verse": cells[2], "half": cells[3], "metre": cells[4], "criterion": cells[5]}})
    return units


class IdentityRegistry:
    def __init__(self, value=None):
        self.value = value or {"version": 1, "namespace": str(NAMESPACE), "entries": {}, "lineage": {}, "source_overrides": {}}
        if self.value.get("namespace") != str(NAMESPACE): raise CatalogError("identity namespace drift")
        self.seen = set(); self.initial = dict(self.value["entries"]); self.assigned = set()
        self.by_body = {}; self.keys_by_id = {}
        for key, entry in self.initial.items():
            self.by_body.setdefault((entry["source_path"], entry["body_sha256"]), []).append(entry)
            self.keys_by_id[entry["reading_unit_id"]] = key

    def resolve(self, rel, unit, digest, reviewed_work=None, witness=""):
        key = rel + "#" + unit["anchor"]
        entries = self.value["entries"]
        old = entries.get(key)
        if old and unit["anchor"].startswith("line:") and old["body_sha256"] != digest:
            matches = [v for v in self.by_body.get((rel, digest), []) if v["reading_unit_id"] not in self.assigned]
            if len(matches) > 1: raise CatalogError(f"ambiguous body identity: {key}")
            if matches: old = matches[0]
            elif old["title"] != unit["title"]: old = None
        if old is None and key in self.value.get("lineage", {}):
            target = self.value["lineage"][key]
            matches = [entries[self.keys_by_id[target]]] if target in self.keys_by_id else []
            if len(matches) != 1: raise CatalogError(f"invalid identity lineage: {key}")
            old = matches[0]
        if old is None:
            matches = [v for v in self.by_body.get((rel, digest), []) if v["reading_unit_id"] not in self.assigned]
            if len(matches) > 1: raise CatalogError(f"ambiguous body identity: {key}")
            if matches: old = matches[0]
        if old is not None and old["reading_unit_id"] in self.assigned:
            raise CatalogError(f"identity assigned twice: {key}")
        result = dict(old or {"reading_unit_id": stable("reading", key), "work_id": stable("work", rel + "#" + unit["anchor"]),
                              "edition_id": stable("edition", rel + "#" + (witness or "digital-witness")), "first_anchor": key})
        if reviewed_work:
            target = stable("work", "reviewed:" + reviewed_work)
            if old and old["work_id"] != target: raise CatalogError(f"reviewed work identity drift: {key}")
            result["work_id"] = target
        result.update(source_path=rel, title=unit["title"], body_sha256=digest, anchor=unit["anchor"])
        # Remove moved alias: there is exactly one current entry per occurrence.
        previous_key = self.keys_by_id.get(result["reading_unit_id"])
        if previous_key and previous_key != key: entries.pop(previous_key, None)
        self.keys_by_id[result["reading_unit_id"]] = key
        entries[key] = result; self.seen.add(key); self.assigned.add(result["reading_unit_id"])
        return result


class RightsResolver:
    def __init__(self, root, registry):
        from quality.provenance import load_sources, load_authority, ProvenanceGate
        self.root, self.registry = root, registry
        self.sources = load_sources(root / "data/sources.tsv")
        self.gate = ProvenanceGate(sources=self.sources, authority=load_authority(root / "data/authority.tsv"))
        with (root / "data/sources.tsv").open(encoding="utf-8") as stream:
            self.raw = {r["source_id"]: r for r in csv.DictReader(stream, delimiter="\t")}

    def declared(self, declaration):
        token = declaration.split()[0] if declaration.split() else ""
        if token in self.sources: return token
        scoped = [sid for sid in self.sources if sid.split("#")[0] == token]
        if len(scoped) == 1: return scoped[0]
        match = re.match(r"^(GITenberg)/.*_(\d+)$", token)
        if match:
            scoped = [sid for sid in self.sources if re.match(r"^" + match[1] + r"/.*_" + match[2] + r"(?:#.*)?$", sid)]
            if len(scoped) == 1: return scoped[0]
        return None

    def resolve(self, rel, fields, unit, language):
        from quality.provenance import Item, ADMITTED, noncommercial_marker
        declarations = [d for d in fields.get("source", []) if d.split() and "/" in d.split()[0]]
        declarations += self.registry.value.get("source_declarations", {}).get(rel, [])
        parents = [(d, self.declared(d)) for d in declarations]
        missing = [d for d, sid in parents if sid is None]
        parent_ids = list(dict.fromkeys(sid for _, sid in parents if sid))
        local = "local:" + rel if "local:" + rel in self.sources else self.registry.value.get("source_overrides", {}).get(rel)
        if local and local not in self.sources: raise CatalogError(f"unknown explicit source join: {local}")
        locators = [r["text"][11:].strip() for r in unit["rows"] if r["text"].startswith("--- SOURCE:")]
        chosen = []
        for locator in locators:
            pg = re.search(r"\bPG(\d+)\b", locator)
            if pg:
                matches = [sid for sid in parent_ids if re.search(r"_" + pg[1] + r"(?:#.*)?$", sid)]
                if len(matches) != 1: missing.append("item locator " + locator)
                else: chosen.append(matches[0])
        relevant = chosen or parent_ids or ([local] if local else [])
        if not relevant: missing.append("no recorded source binding")
        scoped_ids = list(dict.fromkeys(([local] if local else []) + relevant))
        author = fields.get("author", [""])[0]
        if rel == "corpus/san_dcs_verse.txt":
            author = "Jayadeva" if unit.get("native_fields", {}).get("text") == "Gītagovinda" else "Bharavi"
        if language == "fin" and "kanteletar" in rel: author = ""
        if author.upper().startswith("ANONYMOUS"): author = ""
        # Exact committed authority keys, with the same staging slug when available.
        try:
            from quality.populate_authority import slug
            author_key = slug(author) if author else ""
            if author_key not in self.gate.authority and author:
                name_key = slug(author.splitlines()[0].split("(")[0].strip())
                if name_key in self.gate.authority: author_key = name_key
        except ImportError:
            author_key = re.sub(r"[^a-z0-9]+", "_", unicodedata.normalize("NFKD", author).encode("ascii", "ignore").decode().lower()).strip("_")
        verdicts = []
        for sid in scoped_ids:
            verdict, reason = self.gate.admit(Item(item_id=rel + "#" + unit["anchor"], language=language, source_id=sid, author_key=author_key))
            verdicts.append({"source_id": sid, "verdict": verdict, "reason": reason})
        restricted = [sid for sid in relevant if noncommercial_marker(self.sources[sid].licence)]
        generated = any(self.sources[sid].generated for sid in scoped_ids)
        if generated: availability = "research_only"
        elif restricted: availability = "rejected"
        elif missing: availability = "held"
        elif any(v["verdict"] in ADMITTED for v in verdicts): availability = "readable"
        else: availability = "held"
        notices = []
        notice = self.root / "corpus/fas_hafez.LICENSE.txt"
        if rel == "corpus/fas_hafez.json" and notice.exists():
            notices.append({"path": "corpus/fas_hafez.LICENSE.txt", "sha256": sha(notice.read_bytes()), "text": notice.read_text(), "scope": [rel]})
        if rel in {"corpus/sonnets.txt", "corpus/whitman.txt"}:
            text = (self.root / rel).read_text(encoding="utf-8")
            match = re.search(r"\*\*\*\s*END OF[^\n]+", text, re.I)
            if match:
                notice_text = text[match.start():]
                notices.append({"path": rel, "sha256": sha(notice_text.encode()), "text": notice_text,
                                "scope": [rel], "source_cp_range": [match.start(), len(text)], "kind": "gutenberg_terms"})
        attribution = fields.get("attribution", [])[:]
        if any("dcs" in sid.lower() for sid in scoped_ids):
            attribution.append("Oliver Hellwig: Digital Corpus of Sanskrit (DCS). 2010-2021.")
        return {"availability": availability, "admission": verdicts, "unresolved": missing,
                "sources": [self.raw[sid] for sid in scoped_ids], "file_sources": [self.raw[sid] for sid in parent_ids],
                "source_declarations": declarations, "source_locators": locators,
                "required_attribution": list(dict.fromkeys(attribution)), "notices": notices,
                "uncertainties": fields.get("caveat", []) + fields.get("note", []),
                "layers": {"work": "recorded admission", "digital_witness": rel, "underlying_printing": "unknown unless recorded in source notes"}}


def language_for(rel, fields):
    declared = fields.get("language", [""])[0].split()[0].lower() if fields.get("language") else ""
    aliases = {"en": "eng", "fa": "fas", "fi": "fin", "cy": "cym", "sa": "san", "ms": "msa", "zh": "ltc"}
    if declared: return aliases.get(declared, declared)
    stem = Path(rel).stem
    prefix = stem.split("_")[0]
    if prefix in {"eng", "fas", "fin", "cym", "non", "ltc", "msa", "san", "som"}: return prefix
    return "eng" if stem in {"sonnets", "whitman", "sonnets_generated"} else "und"


def search_projection(text):
    """NFC/casefold/whitespace search key with conservative original span map."""
    output, spans, start = [], [], 0
    for match in re.finditer(r"\s+|\S+", text):
        token = match.group()
        transformed = " " if token.isspace() else unicodedata.normalize("NFC", token).casefold()
        output.append(transformed)
        spans.append({"search_cp_range": [start, start + len(transformed)], "normalized_cp_range": [match.start(), match.end()],
                      "precision": "exact" if transformed == token else "span"})
        start += len(transformed)
    return {"text": "".join(output), "spans": spans}


def contributor_records(fields):
    records = []
    for role in ("author", "translator", "compiler", "editor", "transcriber"):
        for declared in fields.get(role, []):
            name = declared.splitlines()[0].split("(")[0].strip()
            if name.upper().startswith("ANONYMOUS"): name = name.split(".")[0]
            records.append({"role": role, "name": name, "basis": "source_header", "source_declaration": declared})
            if role == "author":
                compiled = re.search(r"COMPILED AND EDITED by\s+([^\n(]+)", declared)
                if compiled:
                    for additional_role in ("compiler", "editor"):
                        records.append({"role": additional_role, "name": compiled[1].strip(), "basis": "source_header", "source_declaration": declared})
    return records


def build_reading(rel, source_text, source_sha, unit, identity, fields, rights, language, collection, coordinates=None):
    coordinates = coordinates or Coordinates(source_text)
    rows, marks, cp, utf16, sung = [], [], 0, 0, 0
    for index, original in enumerate(unit["rows"]):
        row = dict(original); text = row["text"]
        row["id"] = stable("line", identity["reading_unit_id"] + ":" + str(index))
        row["physical_lineno"] = row["physical_line"]
        row["analysis_line"] = row["sung_line"] = None
        row["normalized_cp_range"] = row["normalized_utf16_range"] = None
        row["transformation_spans"] = []
        if row["kind"] == "lyric":
            if sung: cp += 1; utf16 += 1
            sung += 1; row["analysis_line"] = row["sung_line"] = sung
            row["normalized_cp_range"] = [cp, cp + len(text)]
            row["normalized_utf16_range"] = [utf16, utf16 + u16(text)]
            if "field_range" in row:
                a, b = row["field_range"]; raw = source_text[a:b]
                source_range = {**coordinates.project(a, b),
                                "physical_line": row["physical_line"], "precision": row.get("forced_precision", "exact")}
                row["source_ranges"] = [source_range]
                row["transformation_spans"] = [{"normalized_cp_range": row["normalized_cp_range"], "source_cp_range": [a, b],
                    "source_utf16_range": source_range["utf16_range"], "byte_range": source_range["byte_range"],
                    "precision": source_range["precision"], "kind": "unchanged" if raw == text else "substitution"}]
            else:
                row["transformation_spans"] = transformation_spans(row, text, cp)
                row["source_ranges"] = [{"codepoint_range": s["source_cp_range"], "utf16_range": s["source_utf16_range"],
                    "byte_range": s["byte_range"], "physical_line": row["physical_line"], "precision": s["precision"]}
                    for s in row["transformation_spans"] if s["kind"] != "deleted"]
            cp += len(text); utf16 += u16(text)
        else:
            row["source_ranges"] = [range_in_row(row, 0, len(row["source_text"]))]
        mark = re.match(r"^\[([^\]]+)\]$", row["source_text"].strip())
        if mark or row.get("source_marker"):
            marks.append({"id": stable("mark", row["id"]), "name": mark[1] if mark else row["source_marker"], "raw": row["source_text"],
                          "physical_line": row["physical_line"], "analysis_line_before": sung or None,
                          "analysis_line_after": sung + 1})
        rows.append(row)
    normalized = "\n".join(r["text"] for r in rows if r["kind"] == "lyric")
    for mark in marks:
        if mark["analysis_line_after"] > sung: mark["analysis_line_after"] = None
    a = min((r["source_cp_range"][0] for r in rows), default=0)
    b = max((r["source_cp_range"][1] + len(r.get("terminator", "")) for r in rows), default=0)
    if "source_cp_range" in unit: a, b = unit["source_cp_range"]
    source_range = coordinates.project(a, b)
    reading = {**{k: identity[k] for k in ("reading_unit_id", "work_id", "edition_id")}, "collection_ids": [collection],
               "title": unit["title"], "language": language, "notation": fields.get("notation", ["source orthography"])[0],
               "direction": "rtl" if language == "fas" else "ltr", "availability": rights["availability"],
               "completeness": unit["completeness"], "source_path": rel, "source_sha256": source_sha,
               "source_text": source_text[a:b], "source_range": source_range, "normalized_text": normalized,
               "normalized_sha256": sha(normalized.encode()), "lines": rows, "source_marks": marks,
               "metadata": fields, "rights": rights, "parser_version": PARSER_VERSION, "normalizer_version": NORMALIZER_VERSION,
               "source_map": {"coordinate_system": "unicode_codepoint", "source_scope": "file", "normalized_scope": "reading_unit", "rows": [r["id"] for r in rows]},
               "search": search_projection(normalized),
               "contributors": contributor_records(fields),
               "census": {"physical_source_rows": len({r["physical_line"] for r in rows}), "normalized_lines": sung,
                          "apparatus_rows": sum(r["kind"] == "apparatus" for r in rows), "blank_rows": sum(r["kind"] == "blank" for r in rows),
                          "scope": "complete_reading_unit"}}
    if unit.get("native_fields"): reading["native_fields"] = unit["native_fields"]
    if unit.get("native_id") is not None: reading["native_id"] = unit["native_id"]
    reading["reading_revision"] = sha(reading)
    return reading


def validate_reading(reading, raw, coordinates=None):
    text = raw.decode("utf-8")
    coordinates = coordinates or Coordinates(text)
    normalized = reading["normalized_text"]
    if reading["availability"] not in AVAILABILITY: raise CatalogError("availability")
    if sha(raw) != reading["source_sha256"]: raise CatalogError("source hash")
    for row in reading["lines"]:
        a, b = row["source_cp_range"]
        if text[a:b] != row["source_text"]: raise CatalogError("source row round trip")
        a, b = row["byte_range"]
        if raw[a:b].decode() != row["source_text"]: raise CatalogError("source byte round trip")
        if row["kind"] == "lyric":
            a, b = row["normalized_cp_range"]
            if normalized[a:b] != row["text"]: raise CatalogError("normalized row round trip")
            for projection in row["source_ranges"]:
                a, b = projection["codepoint_range"]; ba, bb = projection["byte_range"]
                if raw[ba:bb].decode() != text[a:b]: raise CatalogError("projection byte round trip")
                if projection["utf16_range"] != coordinates.project(a, b)["utf16_range"]: raise CatalogError("projection UTF16 round trip")


def registry_seed_path(root, explicit=None):
    """Prefer the checked-in gzip seed; plain JSON remains a fixture format."""
    if explicit is not None:
        return Path(explicit)
    plain = Path(root) / "data/library_identity_registry.json"
    compressed = plain.with_suffix(".json.gz")
    return compressed if compressed.exists() else plain


def load_registry_seed(path):
    raw = Path(path).read_bytes()
    if Path(path).suffix == ".gz":
        raw = gzip.decompress(raw)
    return json.loads(raw)


def registry_seed_bytes(value, compressed=False):
    raw = canonical(value) + b"\n"
    if not compressed:
        return raw
    output = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=output, compresslevel=9, mtime=0) as stream:
        stream.write(raw)
    return output.getvalue()


def build(root, output, repo_sha, registry_path=None, source_manifest=None, write_registry=False):
    root, output = Path(root), Path(output)
    registry_path = registry_seed_path(root, registry_path)
    registry = IdentityRegistry(load_registry_seed(registry_path) if registry_path.exists() else None)
    corpus = sorted(p for p in (root / "corpus").rglob("*") if p.is_file() and p.suffix in {".txt", ".json"} and ".LICENSE." not in p.name)
    if source_manifest:
        expected = json.loads(Path(source_manifest).read_text())
        if isinstance(expected, dict) and expected.get("repository_commit", repo_sha) != repo_sha: raise CatalogError("pinned repository commit mismatch")
        expected = expected.get("tree", []) if isinstance(expected, dict) else expected
        expected = [e for e in expected if e["path"].startswith("lyric-harness/corpus/")]
        actual = {"lyric-harness/" + p.relative_to(root).as_posix() for p in (root / "corpus").rglob("*") if p.is_file()}
        extras = actual - {e["path"] for e in expected}
        if extras: raise CatalogError(f"unapproved corpus sources: {sorted(extras)[:8]}")
        for entry in expected:
            path = root / entry["path"].removeprefix("lyric-harness/")
            if not path.exists(): raise CatalogError(f"missing pinned source: {entry['path']}")
            raw = path.read_bytes()
            git_sha = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
            if git_sha != entry["sha"]: raise CatalogError(f"pinned source drift: {entry['path']}")
    resolver = RightsResolver(root, registry)
    policy_path = root / "data/calibration_work_editions.json"
    policy = json.loads(policy_path.read_text()) if policy_path.exists() else {"works": []}
    reviewed = {(w["file"], e["title_line"]): (w["work_id"], e) for w in policy["works"] for e in w["editions"]}
    reviewed_seen = set()
    collections, works, editions, summaries, source_files, availability_counts = {}, {}, {}, [], [], {}
    if output.exists() and any(output.iterdir()): raise CatalogError("output must be an empty staging directory")
    output.mkdir(parents=True, exist_ok=True)
    artifacts = {}
    def write(path, value, raw=False):
        data = value if raw else canonical(value)
        target = output / path; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(data)
        artifacts[path] = sha(data)
    for path in corpus:
        rel = path.relative_to(root).as_posix(); raw = path.read_bytes(); digest = sha(raw)
        text, physical = physical_rows(raw); fields = header_fields(physical); coordinates = Coordinates(text)
        language = language_for(rel, fields)
        if path.name == "fas_hafez.json": units = hafez_units(path, text, physical)
        elif path.name == "san_dcs_verse.txt": units = dcs_units(path, physical)
        elif path.name in {"sonnets.txt", "whitman.txt"}: units = gutenberg_units(path, physical)
        elif path.suffix == ".txt": units = marked_units(path, physical)
        else: raise CatalogError(f"unsupported corpus format: {rel}")
        scope = registry.value.get("reading_scopes", {}).get(rel)
        if scope:
            if len(units) != 1: raise CatalogError(f"single segment scope drift: {rel}")
            units[0].update(scope)
        collection = stable("collection", rel)
        collections[collection] = {"collection_id": collection, "title": fields.get("author", [path.stem.replace("_", " ")])[0],
                                   "language": language, "source_path": rel, "reading_unit_ids": [], "readable_reading_unit_ids": []}
        write(f"sources/{digest}.bin", raw, True)
        source_files.append({"path": rel, "sha256": digest, "bytes": len(raw), "physical_rows": len(physical), "reading_units": len(units)})
        for unit in units:
            body = "\n".join(r["text"] for r in unit["rows"] if r["kind"] == "lyric")
            if not body: continue
            digest_body = sha(body.encode())
            declared_work = reviewed.get((rel, unit.get("title_line")))
            if declared_work:
                work_key, entry = declared_work
                if entry["title"] != unit["title"] or entry["body_sha256"] != digest_body: raise CatalogError(f"reviewed identity drift: {rel}:{unit.get('title_line')}")
                reviewed_seen.add((rel, unit["title_line"]))
            else: work_key = None
            rights = resolver.resolve(rel, fields, unit, language)
            witness = "|".join(rights["source_locators"])
            identity = registry.resolve(rel, unit, digest_body, work_key, witness)
            reading = build_reading(rel, text, digest, unit, identity, fields, rights, language, collection, coordinates)
            validate_reading(reading, raw, coordinates)
            filename = f"readings/{identity['reading_unit_id']}.json"
            write(filename, reading)
            summary = {k: reading[k] for k in ("reading_unit_id", "reading_revision", "work_id", "edition_id", "collection_ids", "title", "language", "direction", "availability", "completeness", "source_path", "source_sha256", "normalized_sha256")}
            summary.update(path=filename, lines=sum(r["kind"] == "lyric" for r in reading["lines"]), title_search=search_projection(reading["title"])["text"])
            summary["contributors"] = reading["contributors"]
            summary["contributor_search"] = search_projection(" ".join(c["name"] for c in reading["contributors"]))["text"]
            summary["source_search"] = search_projection(" ".join([rel] + [s["source_id"] for s in rights["sources"]] + fields.get("source", []) + fields.get("edition", [])))["text"]
            summary["availability_reason"] = {"admission": rights["admission"], "unresolved": rights["unresolved"]}
            summaries.append(summary)
            collections[collection]["reading_unit_ids"].append(identity["reading_unit_id"])
            if reading["availability"] == "readable": collections[collection]["readable_reading_unit_ids"].append(identity["reading_unit_id"])
            availability_counts[reading["availability"]] = availability_counts.get(reading["availability"], 0) + 1
            works.setdefault(identity["work_id"], {"work_id": identity["work_id"], "title": reading["title"], "reviewed_equivalence": bool(work_key), "reading_unit_ids": []})["reading_unit_ids"].append(identity["reading_unit_id"])
            editions.setdefault(identity["edition_id"], {"edition_id": identity["edition_id"], "source_path": rel, "source_sha256": digest, "source_locators": rights["source_locators"], "underlying_printing": "unknown unless recorded in source notes", "reading_unit_ids": []})["reading_unit_ids"].append(identity["reading_unit_id"])
    if reviewed_seen != set(reviewed): raise CatalogError(f"reviewed editions missing: {sorted(set(reviewed) - reviewed_seen)[:8]}")
    source_readability = {}
    for item in summaries:
        source_readability[item["source_sha256"]] = source_readability.get(item["source_sha256"], True) and item["availability"] == "readable"
    for item in summaries:
        item["whole_source_availability"] = "readable" if source_readability.get(item["source_sha256"], False) else "held"
    write("identity_registry.json", registry.value)
    index = {"collections": list(collections.values()), "works": list(works.values()), "editions": list(editions.values()), "readings": summaries}
    write("index.json", index)
    readable = [r for r in summaries if r["availability"] == "readable"]
    counts = {"source_files": len(source_files), "collections": len(collections), "works": len(works), "editions": len(editions), "reading_units": len(summaries),
              "readable_collections": sum(bool(c["readable_reading_unit_ids"]) for c in collections.values()), "readable_works": len({r["work_id"] for r in readable}),
              "readable_editions": len({r["edition_id"] for r in readable}), "readable_reading_units": len(readable), "availability": availability_counts}
    manifest = {"schema_version": 1, "repository_commit": repo_sha, "parser_version": PARSER_VERSION, "normalizer_version": NORMALIZER_VERSION,
                "identity_registry_sha256": sha(registry.value), "rights_registry_sha256": sha((root / "data/sources.tsv").read_bytes()),
                "counts": counts, "sources": source_files, "artifacts": artifacts}
    manifest["snapshot_id"] = sha(manifest)
    (output / "manifest.json").write_bytes(canonical(manifest))
    if write_registry:
        registry_path.parent.mkdir(parents=True, exist_ok=True)
        registry_path.write_bytes(registry_seed_bytes(registry.value, registry_path.suffix == ".gz"))
    return manifest


def load_reading(catalog_dir, snapshot_id, reading_unit_id, reading_revision):
    """Resolve only registered immutable local objects; no caller paths."""
    directory = Path(catalog_dir)
    manifest = json.loads((directory / "manifest.json").read_bytes())
    if manifest["snapshot_id"] != snapshot_id: raise CatalogError("SNAPSHOT_CHANGED")
    if sha({k: v for k, v in manifest.items() if k != "snapshot_id"}) != snapshot_id: raise CatalogError("manifest hash mismatch")
    if not re.fullmatch(r"reading_[a-f0-9-]{36}", reading_unit_id): raise CatalogError("UNKNOWN_READING")
    expected = f"readings/{reading_unit_id}.json"
    if expected not in manifest["artifacts"]: raise CatalogError("UNKNOWN_READING")
    if not (directory / expected).is_file(): raise CatalogError("READING_UNAVAILABLE")
    raw = (directory / expected).read_bytes()
    if sha(raw) != manifest["artifacts"][expected]: raise CatalogError("reading hash mismatch")
    reading = json.loads(raw)
    if reading["reading_unit_id"] != reading_unit_id: raise CatalogError("reading identity mismatch")
    if reading["availability"] != "readable": raise CatalogError("READING_UNAVAILABLE")
    if reading["reading_revision"] != reading_revision: raise CatalogError("STALE_READING")
    if sha({k: v for k, v in reading.items() if k != "reading_revision"}) != reading_revision: raise CatalogError("reading revision hash mismatch")
    reading["snapshot_id"] = snapshot_id
    return reading


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    command = sub.add_parser("build")
    command.add_argument("--root", type=Path, default=ROOT)
    command.add_argument("--output", type=Path, required=True)
    command.add_argument("--repo-sha", required=True)
    command.add_argument("--registry", type=Path)
    command.add_argument("--source-manifest", type=Path, default=ROOT / "library/catalog_sources.json")
    command.add_argument("--write-registry", action="store_true")
    args = parser.parse_args(argv)
    manifest = build(args.root, args.output, args.repo_sha, args.registry, args.source_manifest, args.write_registry)
    print(json.dumps({"snapshot_id": manifest["snapshot_id"], "counts": manifest["counts"], "output": str(args.output)}, ensure_ascii=False))


if __name__ == "__main__": main()
