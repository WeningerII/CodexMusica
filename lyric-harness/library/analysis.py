"""Resumable deterministic Library interpretation over a complete reading.

This adapter calls the installed judges. It does not call the writer/reviser,
infer missing music, guess a language, or impose a comparison cutoff. A cursor
counts candidate bindings, not just matches, so an interrupted search resumes
without either losing its negative population or duplicating evidence.
"""
from __future__ import annotations

import copy
import hashlib
import itertools
import json
import os
import re
import time
from dataclasses import replace
from pathlib import Path
from typing import Callable, Iterable

from .contracts import (CONTRACT_VERSION, canonical_json, digest, json_safe,
                        method_id, range_pair, semantic_identity, verdict)
from .registry import LANGUAGES, REMEDIES, NATIVE_WORK_METHODS

ROOT = Path(__file__).resolve().parents[1]
_READER_LANGUAGE = None


def _reader_rss_bytes():
    try:
        for row in Path("/proc/self/status").read_text().splitlines():
            if row.startswith("VmRSS:"):
                return int(row.split()[1]) * 1024
    except (OSError, ValueError):
        pass
    return None


def _resource_guard(phase, extra_bytes=0):
    """Capacity guard, never a semantic comparison/input-length cutoff.

    A paused primitive requires more capacity to retry; it does not mark a
    population answered, and the worker keeps preceding durable evidence.
    The deployment may lower this per-process envelope after qualifying its
    combined Node, lookup and reader resident memory.
    """
    ceiling = int(os.environ.get("LIBRARY_READER_MAX_RSS_MIB", "1024")) * 1024 * 1024
    if ceiling <= 0:
        raise ValueError("INVALID_RUNTIME: reader memory envelope must be positive")
    resident = _reader_rss_bytes()
    if resident is not None and resident + extra_bytes > ceiling:
        raise ValueError(f"RESOURCE_LIMIT: {phase} requires more resident capacity; "
                         f"observed={resident}, reserved={extra_bytes}, envelope={ceiling}. "
                         "No source or comparison was dropped. Resume requires increased capacity.")


class _GuardedPhonology:
    """Call the identical native reader while guarding stream preparation."""
    def __init__(self, phon, counter=None):
        self._inner = phon
        self._counter = counter if counter is not None else [0]

    def __getattr__(self, name):
        value = getattr(self._inner, name)
        if name in ("for_line", "for_token"):
            return lambda *args, **kwargs: _GuardedPhonology(value(*args, **kwargs), self._counter)
        return value

    def syllabify(self, word):
        self._counter[0] += 1
        if self._counter[0] % 128 == 0:
            _resource_guard("native stream preparation")
        return self._inner.syllabify(word)


def clear_reader_resources_if_language_changed(language):
    """Reset reader traversal globals without touching the writer's lexicon."""
    global _READER_LANGUAGE
    from quality import relations as RL
    for name in ("_ACTIVE_LINE_READS", "_ACTIVE_SIGS"):
        if hasattr(RL, name):
            setattr(RL, name, None)
    if _READER_LANGUAGE != language:
        for name in ("_WVP_MEMO", "_RESOLVE_MEMO", "_PAIR_MEMO"):
            memo = getattr(RL, name, None)
            if hasattr(memo, "clear"):
                memo.clear()
        _READER_LANGUAGE = language


def runtime_identity() -> dict:
    h = hashlib.sha256()
    paths = sorted((ROOT / "quality").glob("*.py")) + sorted((ROOT / "quality/phonology").glob("*.py"))
    paths += sorted((ROOT / "library").glob("*.py")) + [ROOT / "lyric_harness.py"]
    for path in paths:
        if path.is_file() and not path.name.startswith("test"):
            h.update(str(path.relative_to(ROOT)).encode())
            h.update(path.read_bytes())
    assets = ROOT / "data/runtime_assets.json"
    return {"engine_hash": h.hexdigest(),
            "resources_hash": hashlib.sha256(assets.read_bytes()).hexdigest() if assets.is_file() else None}


def _normal_request(requested):
    if requested is None:
        requested = {"layers": ["sound", "form", "language"]}
    if isinstance(requested, (tuple, list)):
        requested = {"layers": list(requested)}
    if not isinstance(requested, dict) or set(requested) - {"layers", "schemas"}:
        raise ValueError("INVALID_DECLARATION: requested contains layers and optional schema IDs")
    layers = requested.get("layers", ["sound", "form", "language"])
    if not isinstance(layers, list) or any(x not in ("sound", "form", "rhythm", "language", "summary") for x in layers):
        raise ValueError("UNSUPPORTED_METHOD: unknown reader layer")
    schemas = requested.get("schemas")
    if schemas is not None and (not isinstance(schemas, list) or any(not isinstance(x, str) for x in schemas)):
        raise ValueError("INVALID_DECLARATION: schemas must be a list of registry IDs or exact names")
    return {"layers": sorted(set(layers)), "schemas": sorted(set(schemas)) if schemas is not None else None}


def _public_declarations(value):
    if isinstance(value, dict):
        if any(k in ("source", "provenance", "citation") and not isinstance(v, str) for k, v in value.items()):
            raise ValueError("INVALID_DECLARATION: declaration provenance must be a string")
        return {k: ("caller declaration" if v.strip() else "") if k in ("source", "provenance", "citation")
                else _public_declarations(v) for k, v in value.items() if k not in ("viewer_id", "user_id")}
    if isinstance(value, list):
        return [_public_declarations(v) for v in value]
    return value


def _source_lines(source):
    text = source.get("normalized_text", source.get("text"))
    if not isinstance(text, str):
        raise ValueError("INVALID_DECLARATION: reading requires normalized_text")
    supplied = source.get("lines")
    if supplied:
        rows = []
        for row in supplied:
            if row.get("kind", "lyric") == "lyric":
                row = dict(row)
                cp = row.get("normalized_cp_range")
                if cp is not None:
                    a, b = cp
                    if not 0 <= a <= b <= len(text):
                        raise ValueError("STALE_READING: line range is outside normalized text")
                    row["analysis_text"] = text[a:b]
                else:
                    row["analysis_text"] = row.get("text", "")
                rows.append(row)
            else:
                rows.append(dict(row))
        return text, rows
    rows, offset = [], 0
    for i, physical in enumerate(text.splitlines(keepends=True)):
        line = re.sub(r"(?:\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029])$", "", physical)
        rows.append({"id": f"line:{i}", "kind": "lyric" if line.strip() else "blank",
                     "text": line, "analysis_text": line,
                     "normalized_cp_range": [offset, offset + len(line)],
                     "source_ranges": [{**range_pair(text, offset, offset + len(line)), "precision": "exact"}]})
        offset += len(physical)
    return text, rows


def _restore_edge(payload, RL):
    def span(v):
        return RL.Span(tuple(v["idx"]), v["anchor_pos"], v["direction"], v["unit"], v["origin"], v["search_k"])
    a = payload["alignment"]
    alignment = RL.Alignment(tuple(tuple(p) for p in a["pairs"]), tuple(a["unmatched_a"]), tuple(a["unmatched_b"]), a["kind"])
    reads = tuple((c, p, RL.Read(r["value"], r["informative"], r.get("note", "")))
                  for c, p, r in payload["reads"])
    return RL.Instance(payload["schema"], span(payload["a"]), span(payload["b"]), alignment,
                       reads, payload["verdict"], (), (), payload.get("search_k", 1))


def resolve_detail_records(records):
    """Reconstruct one addressable record at a time from durable detail parts.

    Parts are written immediately after their parent. A missing, duplicate,
    stale, or changed part refuses reuse instead of making a partial edge.
    This same wire format is consumed by the reader's browser projection.
    """
    pending = None
    buffers = {}
    for record in records:
        if record.get("kind") == "detail_part":
            detail_id = record.get("detail_id")
            if pending is None or detail_id not in buffers:
                raise ValueError("RESULT_EXPIRED: detail part has no pending parent")
            buffer = buffers[detail_id]
            if record.get("parent_id") != pending["id"] or record.get("part") != len(buffer["parts"]):
                raise ValueError("RESULT_EXPIRED: detail parts are out of order")
            if record.get("total") != buffer["ref"]["parts"]:
                raise ValueError("RESULT_EXPIRED: detail part count differs")
            buffer["parts"].append(record["json_fragment"])
            if len(buffer["parts"]) == buffer["ref"]["parts"]:
                encoded = "".join(buffer["parts"])
                raw = encoded.encode("utf-8")
                if len(raw) != buffer["ref"]["byte_length"] or hashlib.sha256(raw).hexdigest() != buffer["ref"]["sha256"]:
                    raise ValueError("RESULT_EXPIRED: detail bytes do not match the immutable reference")
                pending[buffer["field"]] = json.loads(encoded)
                del buffers[detail_id]
                if not buffers:
                    yield pending
                    pending = None
            continue
        if pending is not None:
            raise ValueError("RESULT_EXPIRED: incomplete detail record before another parent")
        refs = {v["$detail_ref"]: {"field": k, "ref": v, "parts": []}
                for k, v in record.items() if isinstance(v, dict) and "$detail_ref" in v}
        if refs:
            pending, buffers = dict(record), refs
        else:
            yield record
    if pending is not None:
        raise ValueError("RESULT_EXPIRED: final detail record is incomplete")


class AnalysisSession:
    """One lease; checkpoints contain bounded cursors, never an edge history.

    ``load_records(schema_id)`` must yield the caller's *committed* immutable
    records when a resumed global figure reaches assembly. The worker waits
    for durable acknowledgement before calling ``step`` again.
    """
    def __init__(self, source: dict, declarations: dict | None = None,
                 requested=None, checkpoint: dict | None = None, *,
                 load_records: Callable[[str], Iterable[dict]] | None = None,
                 identity: dict | None = None, requested_methods=None, phon=None):
        from quality import relations as RL
        from quality.phonology import get, Unsupported
        self.RL = RL
        if not isinstance(source, dict):
            raise ValueError("INVALID_DECLARATION: source must be a registered reading object")
        self.source = copy.deepcopy(source)
        private_declarations = {} if declarations is None else copy.deepcopy(declarations)
        self.declarations = _public_declarations(private_declarations)
        if not isinstance(self.declarations, dict):
            raise ValueError("INVALID_DECLARATION: declarations must be an object")
        supported = {"language", "phonology", "pronunciations", "sound", "form", "setting", "subdivision", "isochrony",
                     "beatgrid", "returns", "hooks", "line_relations", "narrative", "melody", "convention"}
        if set(self.declarations) - supported:
            raise ValueError("INVALID_DECLARATION: unknown reader declarations: " + ", ".join(sorted(set(self.declarations) - supported)))
        self.requested = _normal_request(requested)
        if requested_methods is not None:
            from .registry import build_registry
            catalog = {m["id"]: m for m in build_registry()["methods"]}
            if not isinstance(requested_methods, list) or any(m not in catalog for m in requested_methods):
                raise ValueError("UNSUPPORTED_METHOD: unknown requested method IDs")
            if any(not catalog[m].get("reader_requestable") for m in requested_methods):
                raise ValueError("UNSUPPORTED_METHOD: the requested engine helper has no independent reader traversal")
            self.requested["methods"] = sorted(set(requested_methods))
            self.requested["schemas"] = [catalog[m]["name"] for m in self.requested["methods"]
                                         if catalog[m]["namespace"] == "schema"]
        self.text, self.rows = _source_lines(self.source)
        self.language = self.declarations.get("language", source.get("language"))
        if self.language not in LANGUAGES:
            raise ValueError("UNSUPPORTED_METHOD: language has no declared native phonology")
        if self.language != "eng" and self.declarations.get("pronunciations"):
            raise ValueError("UNSUPPORTED_METHOD: occurrence phone overrides are only installed for English; use the native profile's declared policy")
        if requested_methods is not None:
            if requested_methods and "sound" not in self.requested["layers"]:
                raise ValueError("INVALID_DECLARATION: requested sound methods require the sound layer")
            if any(catalog[m].get("language", self.language) != self.language for m in requested_methods):
                raise ValueError("UNSUPPORTED_METHOD: native method belongs to another phonology")
        clear_reader_resources_if_language_changed(self.language)
        settings = self.declarations.get("phonology", {})
        if not isinstance(settings, dict):
            raise ValueError("INVALID_DECLARATION: phonology settings must be an object")
        if phon is not None:
            self.phon = phon
        elif self.language == "eng":
            from quality.phonology.eng import English
            import lyric_harness as LH
            lex = LH.Lexicon(strip_parens=False, fallback=settings.get("fallback"),
                             pronunciations=private_declarations.get("pronunciations"))
            lines = {r.get("analysis_text", r.get("text", "")) for r in self.rows if r.get("kind", "lyric") == "lyric"}
            if any(choice["line"] not in lines for choice in lex.pronunciations):
                raise ValueError("STALE_READING: an exact pronunciation line is absent from this registered reading")
            # Validation reads the original provenance before it is redacted.
            # It cannot convert a blank/oversized source into a valid one.
            lex.pronunciations = copy.deepcopy(self.declarations.get("pronunciations") or [])
            self.phon = English(fallback=settings.get("fallback"), readings=settings.get("readings", "all"), lexicon=lex)
        elif self.language == "ltc":
            from quality.phonology.ltc import MiddleChinese
            self.phon = MiddleChinese(**{k: v for k, v in settings.items()
                                         if k in ("standard", "variants", "overlap", "edition")})
            if set(settings) - {"standard", "variants", "overlap", "edition"}:
                raise ValueError("INVALID_DECLARATION: unsupported Middle Chinese setting")
        else:
            if settings:
                raise ValueError("INVALID_DECLARATION: this native profile has no constructor settings")
            self.phon = copy.copy(get(self.language))
        if self.language == "eng" and set(settings) - {"fallback", "readings"}:
            raise ValueError("INVALID_DECLARATION: unsupported English setting")
        self.identity = semantic_identity(source, private_declarations, self.requested,
                                         {**runtime_identity(), "phonology": json_safe(self.phon.declaration())}, identity)
        self.load_records = load_records
        self._local_records = {}
        self._generator = None
        self._current_key = None
        self._schema_stream = None
        self._pending_event = None
        self._token_projection_cache = {}
        self.stream, self.stream_rows = self._build_stream()
        registry = list(RL.REGISTRY)
        selected = self.requested["schemas"]
        lookup = {method_id("schema", n): n for n in registry}
        lookup.update({n: n for n in registry})
        if selected is not None:
            unknown = [n for n in selected if n not in lookup]
            if unknown:
                raise ValueError("UNSUPPORTED_METHOD: unknown schema IDs: " + ", ".join(unknown))
            registry = [n for n in registry if n in {lookup[x] for x in selected}]
        self.schema_names = registry if "sound" in self.requested["layers"] else []
        self.tasks = [("coordinates", "coordinates")]
        if set(self.requested["layers"]) & {"form", "rhythm"}:
            self.tasks.append(("form", "form"))
        if "language" in self.requested["layers"]:
            self.tasks.append(("language", "language"))
        if "sound" in self.requested["layers"]:
            allowed = set(self.requested.get("methods", [])) if "methods" in self.requested else None
            relation_name = self.language + ".relations"
            for native_name in NATIVE_WORK_METHODS[self.language]:
                name = self.language + "." + native_name
                if allowed is None or method_id("native", name) in allowed:
                    self.tasks.append(("native_work", name))
            if allowed is None or method_id("native", relation_name) in allowed:
                self.tasks.append(("native_pairs", relation_name))
            for name in self.schema_names:
                self.tasks.append(("schema", name))
                if not RL.pair_scope_representable(RL.REGISTRY[name]) and name not in RL.FULL_SHAPES:
                    self.tasks.append(("assembly", name))
        if checkpoint is not None:
            if checkpoint.get("contract_version") != CONTRACT_VERSION or checkpoint.get("identity_hash") != self.identity["hash"]:
                raise ValueError("STALE_READING: checkpoint semantic identity differs")
            self.checkpoint = copy.deepcopy(checkpoint)
        else:
            self.checkpoint = {"contract_version": CONTRACT_VERSION, "identity_hash": self.identity["hash"],
                               "phase": "coordinates", "method_index": 0, "candidate": 0,
                               "emission": 0, "sequence": 0, "counters": {"candidates": 0, "evidence_records": 0,
                                   "true": 0, "false": 0, "undecided": 0}, "methods": {}}
        self.checkpoint["done"] = self.checkpoint["method_index"] >= len(self.tasks)
        self.checkpoint.setdefault("emission", 0)

    def _build_stream(self):
        from quality import grid as GR
        raw, rows = [], []
        for row in self.rows:
            kind = row.get("kind", "lyric")
            text = row.get("analysis_text", row.get("text", ""))
            if kind == "lyric" or not text.strip() or GR.SECTION_MARK.match(text) or text.strip().startswith(GR.GROUP_BREAK_PREFIX):
                raw.append(text)
                rows.append(row)
        sections, status = GR.sections_from_marks(raw, self.language)
        status = tuple(st or ("song_break" if line.strip().startswith(GR.GROUP_BREAK_PREFIX) else "")
                       for st, line in zip(status, raw))
        ground, source, refused = GR.stanza_ground(raw, self.language)
        if refused or ground is None and any(status):
            ground, source = [0] * len(raw), "none"
        # Native JSON couplets and documented TSV verse/pāda fields are
        # source declarations, even when their transcription prints no mark.
        from .form import source_ground
        native_ground = source_ground(self.source)
        if native_ground.get("source") in ("native_couplet", "native_verse_pada"):
            memberships = {r["line_id"]: r["stanza"] for r in native_ground["lines"]}
            ground = [memberships.get(r.get("id"), 0) for r in rows]
            source = native_ground["source"]
        _resource_guard("native stream preparation")
        st = self.RL.build_stream(raw, _GuardedPhonology(self.phon), sections=sections, stanzas=ground,
                                 stanza_source=source or "", line_status=status,
                                 exclude_status=(GR.SECTION_MARKER_STATUS, "song_break"))
        st.phon = self.phon
        _resource_guard("native stream preparation")
        self._apply_declarations(st, rows)
        return st, rows

    def _apply_declarations(self, st, rows):
        RL = self.RL
        sound = self.declarations.get("sound", {})
        if not isinstance(sound, dict):
            raise ValueError("INVALID_DECLARATION: sound must be an object")
        allowed = {"caesura", "lifts", "beat", "refrain_tail", "stanzas", "stub_resolution", "tonal_template", "surfaces"}
        if set(sound) - allowed:
            raise ValueError("INVALID_DECLARATION: unknown sound declaration")
        by_id = {r.get("id", f"line:{i}"): i for i, r in enumerate(rows)}
        def line(v):
            if isinstance(v, str) and v in by_id:
                return by_id[v]
            raise ValueError("INVALID_DECLARATION: frame positions require registered line IDs")
        def unit(li, v):
            if type(v) is not int or not 0 <= v < len(st.lines[li]):
                raise ValueError("INVALID_DECLARATION: syllable position is outside its line")
            return st.lines[li][v]
        for name in ("caesura", "refrain_tail", "lifts", "beat", "tonal_template"):
            if name not in sound:
                continue
            declaration = sound[name]
            if not isinstance(declaration, dict) or not declaration.get("source") or not isinstance(declaration.get("positions"), dict):
                raise ValueError("INVALID_DECLARATION: frame declaration requires positions and source")
            positions = declaration["positions"]
            mapping = {}
            for lid, values in positions.items():
                li = line(lid)
                if name == "tonal_template":
                    mapping[li] = values
                elif name in ("lifts", "beat"):
                    if not isinstance(values, list):
                        raise ValueError("INVALID_DECLARATION: frame syllables must be a list")
                    mapping[li] = tuple(unit(li, v) for v in values)
                else:
                    mapping[li] = unit(li, values)
            if name == "tonal_template":
                RL.declare_tonal_template(st, mapping)
                st.frames.tonal_source = "declared"
            elif name == "lifts":
                RL.declare_lifts(st, mapping)
                st.frames.lift_source = "declared"
            elif name == "beat":
                RL.declare_beat(st, mapping)
                st.frames.beat_source = "declared"
            elif name == "caesura":
                st.frames.caesura, st.frames.caesura_source = mapping, "declared"
            else:
                st.frames.refrain_tail, st.frames.refrain_source = mapping, "declared"
        if "stanzas" in sound:
            declaration = sound["stanzas"]
            if not isinstance(declaration, dict) or not declaration.get("source") or not isinstance(declaration.get("groups"), list):
                raise ValueError("INVALID_DECLARATION: stanzas requires groups and source")
            assignment = {}
            for group, lids in enumerate(declaration["groups"]):
                if not isinstance(lids, list):
                    raise ValueError("INVALID_DECLARATION: stanza group must contain line IDs")
                for lid in lids:
                    li = line(lid)
                    if li in assignment:
                        raise ValueError("INVALID_DECLARATION: duplicate stanza line")
                    assignment[li] = group
            verse = {i for i, r in enumerate(rows) if r.get("kind", "lyric") == "lyric" and st.lexical_tokens[i]}
            if set(assignment) != verse and assignment:
                raise ValueError("INVALID_DECLARATION: stanza declaration must cover every lyric line")
            st.units = [replace(u, stanza=assignment.get(u.line, 0)) for u in st.units]
            st.line_stanzas = tuple(assignment.get(i, 0) for i in range(len(rows)))
            st.frames.stanza_source = "declared"
            if not assignment:
                # The underlying frame's population is syllable-bearing
                # stanzas; preserve an explicitly empty declaration honestly.
                st.frames.stanza_source = "none"
                raise ValueError("INVALID_DECLARATION: empty stanza assignment cannot frame nonempty verse")
        if "stub_resolution" in sound:
            declaration = sound["stub_resolution"]
            if not isinstance(declaration, dict) or not declaration.get("source"):
                raise ValueError("INVALID_DECLARATION: stub resolution requires source")
            mapping = {}
            for lid, target in declaration.get("positions", {}).items():
                if not isinstance(target, list) or len(target) != 2:
                    raise ValueError("INVALID_DECLARATION: stub target is a start/end line range")
                mapping[line(lid)] = (line(target[0]), line(target[1]) + 1)
            RL.declare_stub_resolution(st, mapping)
            st.frames.stub_source = "declared"
        if sound.get("surfaces"):
            raise ValueError("UNSUPPORTED_METHOD: sourced alternative phonology surfaces require an installed resource adapter")
        # Only actual printed marks are read by default. Searching a caesura
        # or inventing a musical beat is not a source coordinate.
        if "caesura" not in sound and any("/" in line or "|" in line for line in st.text_lines):
            RL.mark_printed_caesura(st)
        self._beat_placed = None
        if self.declarations.get("beatgrid") is not None:
            if "beat" in sound:
                raise ValueError("INVALID_DECLARATION: supply one beat declaration, not both beatgrid and sound.beat")
            from .form import decode_beatgrid
            from quality.declared_inputs import BeatGrid
            grid = decode_beatgrid(self.source, self.declarations["beatgrid"])
            dense = [i for i, r in enumerate(rows) if r.get("kind", "lyric") == "lyric"]
            positions, placed = {}, set()
            for (li, ui), pulse in grid.positions.items():
                if not 0 <= li < len(dense) or not 0 <= ui < len(st.lines[dense[li]]):
                    raise ValueError("INVALID_DECLARATION: beatgrid position has no known native unit")
                original_line = dense[li]
                global_unit = st.lines[original_line][ui]
                positions[(original_line, global_unit)] = pulse
                placed.add(global_unit)
            projected = BeatGrid(cycle=grid.cycle, positions=positions,
                                 derived_from=grid.derived_from, source=grid.source)
            RL.declare_beat(st, projected)
            # A sourced empty map stays empty; a partial grid does not place
            # the other units off beat. They remain unknown in this adapter.
            st.frames.beat_source = "declared"
            self._beat_placed = placed

    def _row(self, li):
        return self.stream_rows[li]

    def _line_id(self, li):
        return self._row(li).get("id", f"line:{li}")

    def _record(self, kind, method, key, **values):
        return {"id": kind + ":" + digest([self.identity["hash"], method, key])[:32],
                "kind": kind, "method_id": method, "basis": "measured", **json_safe(values)}

    def _bounded_records(self, records):
        """Losslessly detach large fields; never truncate an evidence scalar."""
        for original in records:
            record = dict(original)
            details = []
            encoded_fields = {k: canonical_json(v) for k, v in record.items()
                              if k not in ("id", "kind", "method_id", "basis")}
            candidates = sorted(encoded_fields, key=lambda k: len(encoded_fields[k].encode("utf-8")), reverse=True)
            for field in candidates:
                encoded = encoded_fields[field]
                raw = encoded.encode("utf-8")
                if len(raw) <= 8192 and len(canonical_json(record).encode("utf-8")) <= 24576:
                    continue
                sha = hashlib.sha256(raw).hexdigest()
                detail_id = "detail:" + digest([original["id"], field, sha])[:32]
                parts = max(1, (len(encoded) + 4095) // 4096)
                record[field] = {"$detail_ref": detail_id, "encoding": "json",
                                 "sha256": sha, "byte_length": len(raw), "parts": parts}
                details.append((field, detail_id, encoded, parts))
            yield record
            for field, detail_id, encoded, total in details:
                for part in range(total):
                    yield self._record("detail_part", original["method_id"], [detail_id, part],
                        parent_id=original["id"], detail_id=detail_id, field=field,
                        part=part, total=total, json_fragment=encoded[part * 4096:(part + 1) * 4096])

    def _token_pieces(self, li):
        """Source positions for the tokens the installed phonology actually read.

        English's declared tokenizer folds apostrophes and joins spaced
        enclitics; a separate word regex cannot supply its token positions.
        Preserve disjoint printed pieces when the join removes whitespace.
        Native tokenizers keep their source spellings, including refused
        punctuation-bearing tokens; locate that ordered population exactly.
        """
        if li in self._token_projection_cache:
            return self._token_projection_cache[li]
        raw, words = self.stream.text_lines[li], self.stream.lexical_tokens[li]
        positions = []
        if self.language == "eng":
            import lyric_harness as LH
            folded = LH.fold_apostrophes(raw)
            removed = {i for match in LH._SPACED_ENCLITIC.finditer(folded)
                       for i in range(match.end(1), match.start(2))}
            mapping = [i for i in range(len(folded)) if i not in removed]
            normalized = "".join(folded[i] for i in mapping)
            matches = [m for m in LH._TOKEN_RUN.finditer(normalized)
                       if LH.LATIN_SCRIPT.search(m.group())]
            if (len(folded) != len(raw) or normalized != LH.join_spaced_enclitics(raw)
                    or tuple(m.group() for m in matches) != words):
                positions = None
            else:
                for match in matches:
                    pieces = []
                    for index in mapping[match.start():match.end()]:
                        if pieces and pieces[-1][1] == index:
                            pieces[-1] = (pieces[-1][0], index + 1)
                        else:
                            pieces.append((index, index + 1))
                    positions.append(pieces)
        else:
            cursor = 0
            for word in words:
                at = raw.find(word, cursor)
                if at < 0:
                    positions = None
                    break
                positions.append([(at, at + len(word))])
                cursor = at + len(word)
        self._token_projection_cache[li] = positions
        return positions

    def _token_ranges(self, li, ti):
        row = self._row(li)
        raw = self.stream.text_lines[li]
        positions = self._token_pieces(li)
        if positions is None or ti >= len(positions) or not positions[ti]:
            return [{**r, "precision": "row"} for r in row.get("source_ranges", [])], None
        pieces = positions[ti]
        cp = row.get("normalized_cp_range")
        normalized = range_pair(self.text, cp[0] + pieces[0][0], cp[0] + pieces[-1][1]) if cp else None
        if normalized is not None and len(pieces) > 1:
            normalized.update(precision="span", parts=[range_pair(self.text, cp[0] + a, cp[0] + b)
                                                       for a, b in pieces])
        spans = row.get("transformation_spans", [])
        projected = []
        for a, b in pieces:
            for tr in spans:
                nr, sr = tr.get("normalized_cp_range"), tr.get("source_cp_range")
                if cp and nr and sr and tr.get("precision") == "exact" and nr[0] <= cp[0] + a and cp[0] + b <= nr[1]:
                    start, end = sr[0] + cp[0] + a - nr[0], sr[0] + cp[0] + b - nr[0]
                    # UTF-16 projections are exact only under unchanged source.
                    if tr.get("kind") == "unchanged":
                        ur = tr.get("source_utf16_range")
                        rel = self.text[nr[0]:cp[0] + a]
                        token = self.text[cp[0] + a:cp[0] + b]
                        ustart = ur[0] + len(rel.encode("utf-16-le")) // 2 if ur else None
                        projected.append({"codepoint_range": [start, end],
                            "utf16_range": [ustart, ustart + len(token.encode("utf-16-le")) // 2] if ur else None,
                            "physical_line": row.get("physical_line"), "precision": "exact"})
                        break
        if len(projected) == len(pieces):
            return projected, normalized
        ranges = list(row.get("source_ranges", []))
        # A standalone exact row has no transformation ledger. Do not claim
        # exact word ranges for lossy/substituted source text.
        if not spans and len(ranges) == 1 and ranges[0].get("precision") == "exact" and row.get("text") == raw:
            r = ranges[0]
            cr, ur = r.get("codepoint_range"), r.get("utf16_range")
            if cr and ur:
                return [{"codepoint_range": [cr[0] + a, cr[0] + b],
                         "utf16_range": [ur[0] + len(raw[:a].encode("utf-16-le")) // 2,
                                         ur[0] + len(raw[:b].encode("utf-16-le")) // 2],
                         "physical_line": row.get("physical_line"), "precision": "exact"}
                        for a, b in pieces], normalized
        return [{**r, "precision": "row"} for r in ranges], normalized

    def _span(self, span, st=None):
        st = st or self.stream
        tokens = []
        for i in span.idx:
            u = st.units[i]
            if (u.line, u.token) not in tokens:
                tokens.append((u.line, u.token))
        ranges, normalized = [], []
        for li, ti in tokens:
            rs, nr = self._token_ranges(li, ti)
            for r in rs:
                if r not in ranges:
                    ranges.append(r)
            if nr:
                normalized.append(nr)
        return {"unit_ids": [f"syllable:{i}" for i in span.idx],
                "token_ids": [f"{self._line_id(li)}:token:{ti}" for li, ti in tokens],
                "line_ids": list(dict.fromkeys(self._line_id(li) for li, _ in tokens)),
                "anchor_position": span.anchor_pos, "direction": span.direction,
                "origin": span.origin, "search_k": span.search_k,
                "source_ranges": ranges, "normalized_ranges": normalized,
                "precision": "token"}

    def _edge_record(self, inst, st):
        RL = self.RL
        mid = method_id("schema", inst.schema)
        return self._record("relation_instance", mid, [inst.a.origin, inst.a.idx, inst.b.origin, inst.b.idx],
            namespace="schema", schema_name=inst.schema, verdict=verdict(inst.verdict),
            a=self._span(inst.a, st), b=self._span(inst.b, st), alignment=json_safe(inst.alignment),
            channel_reads=json_safe(inst.reads), placement_reads=json_safe(inst.placement_reads),
            identity_reads=json_safe(inst.identity_reads), unknown_channels=json_safe(inst.unknown_channels),
            informative_channels=list(inst.informative), scope=RL.tradition_scope(RL.REGISTRY[inst.schema], self.language),
            engine_edge=json_safe(inst))

    def _refusal(self, name, refusal):
        mid = method_id("schema", name) if name in self.RL.REGISTRY else name
        return self._record("method_result", mid, "result", coverage="refused", verdict="undecided",
                            namespace="schema" if name in self.RL.REGISTRY else "native", schema_name=name,
                            refusal=json_safe(refusal), counts={"true": 0, "false": 0, "undecided": 0},
                            availability="needs_declaration" if getattr(refusal, "missing", ()) else "unsupported")

    def _candidates(self, name):
        RL, st = self.RL, self.stream
        schema = RL.REGISTRY[name]
        if "beat" in schema.capabilities() and self._beat_placed is not None and self._beat_placed != {u.i for u in st.units}:
            raise _Refused(RL.Refusal(name, "beat", "The sourced BeatGrid does not place every native unit. Unplaced units are not off beat.",
                                     missing=("beatgrid_complete",), kind="capability"))
        if "stub_resolution" in schema.capabilities() and st.supply("stub_resolution").state == "absent":
            derived = RL._stub_resolved_stream(st)
            if isinstance(derived, RL.Refusal):
                raise _Refused(derived)
            if isinstance(derived, list):
                return
            st = derived
        self._schema_stream = st
        supply = {c: st.supply(c) for c in schema.capabilities()}
        missing = tuple(c for c, v in supply.items() if v.state != "present")
        if missing:
            vacuous = tuple(c for c in missing if supply[c].state == "empty")
            raise _Refused(RL.Refusal(name, missing[0], "; ".join(REMEDIES.get(c, "Supply " + c) for c in missing),
                                     missing=missing, vacuous=vacuous,
                                     kind="vacuous_frame" if len(vacuous) == len(missing) else "capability"))
        if name in RL.FULL_SHAPES:
            if name in RL.TOKEN_MEMBER_SHAPES:
                by_line = {}
                for (li, ti), ids in st.tokens.items():
                    if ids:
                        by_line.setdefault(li, []).append(ti)
                for li in sorted(by_line):
                    for members in itertools.combinations(sorted(by_line[li]), schema.figure.nodes):
                        yield "token_shape", (li, members)
            elif name in RL.TEMPLATE_SHAPES:
                for li in sorted(st.frames.tonal_template):
                    yield "template_shape", li
            else:
                frames = {}
                for li, ids in enumerate(st.lines):
                    if ids or st.lexical_tokens and st.lexical_tokens[li]:
                        frame = (RL._frame_key(schema, RL.Span(ids, origin=f"L{li}"), st) if ids else
                                 st.line_stanzas[li] if schema.figure.frame == "stanza" and st.line_stanzas else
                                 li // 2 if schema.figure.frame == "line_pair" else None)
                        frames.setdefault(frame, []).append(li)
                n = 2 if name == "symploce" else schema.figure.nodes
                for _, lines in frames.items():
                    for members in itertools.combinations(lines, n):
                        yield "line_shape", members
            return
        try:
            def collected(rule):
                out = []
                for span in RL.enumerate_spans(rule, st):
                    out.append(span)
                    if len(out) % 256 == 0:
                        _resource_guard("relation span preparation")
                return out
            aa = collected(schema.spans[0])
            bb = aa if schema.spans[0] == schema.spans[1] else collected(schema.spans[1])
        except RL.NoReferent as exc:
            raise _Refused(RL.Refusal(name, "span", str(exc), kind="span")) from exc
        akeys, bkeys = {s.idx for s in aa}, {s.idx for s in bb}
        idx = {}
        for span in bb:
            idx.setdefault((RL._frame_key(schema, span, st), RL._bucket_key(schema, span, st,
                          RL.DEFAULT_CHANNELS, rule=schema.spans[1])), []).append(span)
        wild = {}
        for (f, k), spans in idx.items():
            if k is None:
                wild.setdefault(f, []).extend(spans)
        layout = [(a, tuple(RL._cand_buckets(schema, a, st, RL.DEFAULT_CHANNELS, idx, wild))) for a in aa]
        _resource_guard("relation bucket preparation")
        for a, b, reverse in RL._candidate_pairs(schema, layout, st, akeys, bkeys, None, prune=True):
            yield "edge", (a, b)

    def _shape(self, name, kind, binding):
        """Bind one candidate without changing original frames or indices.

        Existing full-shape judges enumerate combinations internally. A view
        restricting their *candidate members* to this combination calls that
        same judge on exactly one tuple; all units, alternative surfaces,
        phonology, original line numbers and frame coordinates remain intact.
        """
        RL, st = self.RL, self._schema_stream
        view = copy.copy(st)
        if kind == "line_shape":
            keep = set(binding)
            view.lines = [ids if i in keep else () for i, ids in enumerate(st.lines)]
            view.lexical_tokens = tuple(words if i in keep else () for i, words in enumerate(st.lexical_tokens))
        elif kind == "token_shape":
            li, toks = binding
            view.tokens = {k: v for k, v in st.tokens.items() if k[0] == li and k[1] in toks}
        else:
            view.frames = copy.copy(st.frames)
            view.frames.tonal_template = {binding: st.frames.tonal_template[binding]}
        return RL._full_shape(RL.REGISTRY[name], view)

    def _coordinate_candidates(self):
        for li, row in enumerate(self.stream_rows):
            yield "line", li
            for ti, word in enumerate(self.stream.lexical_tokens[li]):
                yield "token", (li, ti, word)
        for u in self.stream.units:
            yield "syllable", u

    def _coordinate(self, kind, value):
        if kind == "line":
            row = self._row(value)
            return self._record("line", "coordinates", value, line_id=self._line_id(value),
                                text=self.stream.text_lines[value], source_ranges=row.get("source_ranges", []),
                                status=self.stream.status_of(value), excluded=bool(self.stream.status_of(value)),
                                normalized_cp_range=row.get("normalized_cp_range"))
        if kind == "token":
            li, ti, word = value
            ranges, normalized = self._token_ranges(li, ti)
            ids = self.stream.tokens.get((li, ti), ())
            out = self._record("token", "coordinates", [li, ti], token_id=f"{self._line_id(li)}:token:{ti}",
                               line_id=self._line_id(li), token=ti, text=word,
                               source_ranges=ranges, normalized_range=normalized,
                               unit_ids=[f"syllable:{i}" for i in ids], readable=bool(ids))
            if hasattr(self.phon, "reading_status"):
                ph = self.phon.for_line(self.stream.text_lines[li]) if hasattr(self.phon, "for_line") else self.phon
                ph = ph.for_token(ti) if hasattr(ph, "for_token") else ph
                out["reading_status"], out["reading_note"] = ph.reading_status(word)
            if self.language == "eng":
                import lyric_harness as LH
                lex = self.phon._lexicon()
                options = sorted({tuple(p) for p in lex.entries.get(word.lower(), ())})
                out["reading_choices"] = {"line": raw_line if (raw_line := self.stream.text_lines[li]) else "",
                    "token": ti + 1, "word": word,
                    "dictionary_readings": [{"phones": list(p), "syllables": len(LH.syllabify(p)),
                                              "stress": [s["stress"] for s in LH.syllabify(p)]} for p in options],
                    "requires_source": True, "supplied_reading_requires_source": not bool(options),
                    "matching_line_ids": [self._line_id(i) for i, line in enumerate(self.stream.text_lines) if line == raw_line]}
            return out
        u = value
        ranges, normalized = self._token_ranges(u.line, u.token)
        return self._record("syllable", "coordinates", u.i, unit_id=f"syllable:{u.i}",
                            line_id=self._line_id(u.line), token_id=f"{self._line_id(u.line)}:token:{u.token}",
                            token_syllable=u.tok_syl, syllable=json_safe(u.syl),
                            source_ranges=ranges, normalized_range=normalized, precision="token",
                            grid_unit=self.phon.grid_unit, prominence_rule=self.phon.prominence_rule)

    def _native_candidates(self):
        # The lexical endpoint remains the endpoint even when unreadable.
        endings = [(li, words[-1]) for li, words in enumerate(self.stream.lexical_tokens) if words]
        yield from itertools.combinations(endings, 2)

    def _native_pair(self, binding):
        from quality import rhyme_types as RT
        (la, a), (lb, b) = binding
        mid = method_id("native", self.language + ".relations")
        pa = self.phon.for_line(self.stream.text_lines[la]) if hasattr(self.phon, "for_line") else self.phon
        pb = self.phon.for_line(self.stream.text_lines[lb]) if hasattr(self.phon, "for_line") else self.phon
        pa = pa.for_token(len(self.stream.lexical_tokens[la]) - 1) if hasattr(pa, "for_token") else pa
        pb = pb.for_token(len(self.stream.lexical_tokens[lb]) - 1) if hasattr(pb, "for_token") else pb
        # Occurrence choices are carried through the two scoped phonologies.
        # Native modules currently have no per-occurrence override adapter.
        result = self.phon.relations(a, b)
        coord = None
        reason = None
        try:
            coord = RT.classify_pair(a, b, self.phon, member_phons=(pa, pb))
        except (ValueError, RT.Indeterminate, self.RL.NoReferent) as exc:
            reason = str(exc)
        out = self._record("native_pair", mid, [la, lb], namespace="native",
                           language=self.language, line_ids=[self._line_id(la), self._line_id(lb)],
                           words=[a, b], predicates={k: verdict(v) for k, v in result.items()},
                           coverage="answered" if result and all(v is not None for v in result.values()) else "refused",
                           reason=reason if result else "No native rhyme predicate is supplied by this profile.")
        if coord is not None:
            out["type_coordinate"] = json_safe(coord)
            out["type_names"] = list(coord.names())
            out["unknown_channels"] = json_safe(coord.unknown_channels)
            out["route"] = json_safe(getattr(coord, "route", None))
        if self.language == "eng":
            import lyric_harness as LH
            lex = self.phon._lexicon()
            decl = LH.Declaration()
            out["class_verdicts"] = {n: verdict(RT.coarse_relation_consensus(
                lex, self.stream.text_lines[la], self.stream.text_lines[lb], decl, relation=n)) for n in RT.CLASS_RELATIONS}
            out["coverage"] = "answered" if all(v != "undecided" for v in out["class_verdicts"].values()) else "refused"
            schema = self.RL.REGISTRY["perfect rhyme"]
            def rebuild(phon):
                return self.RL.build_stream(self.stream.text_lines, phon,
                    sections=[next((u.section for u in self.stream.units if u.line == i), "") for i in range(len(self.stream.lines))],
                    stanzas=self.stream.line_stanzas, stanza_source=self.stream.frames.stanza_source,
                    line_status=self.stream.line_status, exclude_status=tuple(set(self.stream.line_status) - {""}))
            resolved, witness = self.RL.resolve_line_pair(schema, self.stream, (la + 1, lb + 1), rebuild,
                bound=(len(self.stream.lexical_tokens[la]) - 1, len(self.stream.lexical_tokens[lb]) - 1))
            out["whole_reading"] = {"verdict": verdict(resolved), "witness": json_safe(witness),
                                    "combination_limit": self.RL.READING_COMBO_CAP}
        return out

    def _native_work(self, selected_name):
        phon = self.phon
        lines = [l for i, l in enumerate(self.stream.text_lines) if not self.stream.status_of(i) and l.strip()]
        methods = (selected_name.split(".", 1)[1],)
        for name in methods:
            fn = getattr(phon, name, None)
            if not callable(fn):
                continue
            if name in ("line_alliteration", "cynghanedd_scan"):
                for li, raw in enumerate(self.stream.text_lines):
                    if not self.stream.status_of(li) and raw.strip():
                        yield name, [raw], [self._line_id(li)]
            elif name in ("abab", "prasa", "antya_prasa", "stanza"):
                groups = {}
                if self.stream.provides("stanza"):
                    for li, raw in enumerate(self.stream.text_lines):
                        if not self.stream.status_of(li) and raw.strip():
                            groups.setdefault(self.stream.line_stanzas[li], []).append((li, raw))
                elif name == "abab" and len(lines) == 4:
                    # The explicit four-line fixture can be asked as one
                    # pantun. A longer unframed work is not split in fours.
                    groups[0] = [(li, raw) for li, raw in enumerate(self.stream.text_lines)
                                 if not self.stream.status_of(li) and raw.strip()]
                for group in groups.values():
                    yield name, [raw for _, raw in group], [self._line_id(li) for li, _ in group]
                if not groups:
                    yield name, None, []
            else:
                selected = lines
                ids = [self._line_id(i) for i, raw in enumerate(self.stream.text_lines)
                       if not self.stream.status_of(i) and raw.strip()]
                if self.language == "fas" and name in ("radif", "qafiya") and all(
                        r.get("couplet") is not None for r in self.stream_rows if r.get("kind") == "lyric"):
                    from quality.phonology.fas import ghazal_rhyme_lines
                    selected, ids = ghazal_rhyme_lines(lines), ghazal_rhyme_lines(ids)
                yield name, selected, ids

    def _native_measure(self, name, lines, line_ids):
        fn = getattr(self.phon, name)
        if lines is None:
            return self._record("native_measure", method_id("native", self.language + "." + name), line_ids,
                                namespace="native", language=self.language, coverage="refused", result=None,
                                reason="Native stanza boundaries are undeclared.", line_ids=line_ids)
        detail = None
        if self.language == "fas" and name in ("radif", "qafiya"):
            from quality.phonology.fas import radif_detail, RADIF_MIN_LINES
            detail = radif_detail(lines)
            value = detail if name == "radif" else {"native": fn(lines), "radif_search": detail}
            refused = detail["lines"] < RADIF_MIN_LINES
            if name == "qafiya" and any(word is None for word in value["native"][1]):
                refused = True
        elif name in ("coverage", "notation_report"):
            value = fn("\n".join(lines))
        elif name == "line_alliteration":
            value = [fn(line) for line in lines]
        elif name == "cynghanedd_scan":
            value = [fn(line, caesura="marked") for line in lines]
        else:
            value = fn(lines)
        if detail is None:
            refused = value is None
        if name == "cynghanedd_scan":
            refused = any(v.get("type") is None and not v.get("positions_tried") for v in value)
        elif name == "abab" and value is not None:
            refused = value.get("confirmed") is None or any(p["rhymes"] is None for p in value["pairs"])
        elif name in ("prasa", "antya_prasa"):
            refused = any(v is None for v in value[2])
        elif name == "stanza":
            refused = any(v is None for _, v, _ in value)
        elif name in ("line_alliteration", "higaad"):
            scope = set(line_ids)
            refused = refused or any(self._line_id(li) in scope for li, _, _ in self.stream.unreadable)
        return self._record("native_measure", method_id("native", self.language + "." + name), [name, line_ids],
                            namespace="native", language=self.language,
                            coverage="refused" if refused else "answered", result=json_safe(value), line_ids=line_ids,
                            reason="The native method retains an unread member, unplaced required frame, or explicit refusal." if refused else None)

    def _task_generator(self, phase, name):
        if phase == "coordinates":
            return iter(self._coordinate_candidates())
        if phase == "native_pairs":
            return iter(self._native_candidates())
        if phase == "native_work":
            return iter(self._native_work(name))
        if phase == "schema":
            return iter(self._candidates(name))
        if phase == "assembly":
            return iter(self._assembly_records(name))
        from .form import analyze_form, analyze_language
        result = analyze_form(self.source, self.declarations) if phase == "form" else analyze_language(self.source, self.declarations)
        return iter(self._component_records(phase, result))

    def _task_mid(self, phase, name):
        if phase in ("schema", "assembly"):
            return method_id("schema", name)
        if phase in ("native_work", "native_pairs"):
            return method_id("native", name)
        return phase

    def _component_records(self, phase, result, path=()):
        """Addressable bounded component tree; no whole-work response blob."""
        # The form/language adapters already return JSON-safe data. Probe its
        # size incrementally rather than cloning and encoding the complete
        # whole-work result merely to discover that it needs child records.
        _resource_guard("component tree preparation")
        encoder = json.JSONEncoder(sort_keys=True, ensure_ascii=False,
                                   separators=(",", ":"), allow_nan=False)
        size = 0
        for piece in encoder.iterencode(result):
            size += len(piece.encode("utf-8"))
            if size > 16384:
                break
        if size <= 16384:
            def refused(v):
                if isinstance(v, dict):
                    return v.get("coverage") == "refused" or any(refused(c) for c in v.values())
                return isinstance(v, list) and any(refused(c) for c in v)
            yield self._record(phase + "_result", phase, list(path), path=list(path),
                               result=result, coverage="refused" if refused(result) else "answered")
        elif isinstance(result, dict):
            yield self._record(phase + "_result", phase, [*path, "container"], path=list(path),
                               container="object", keys=list(result), coverage="answered")
            for key, value in result.items():
                yield from self._component_records(phase, value, (*path, key))
        elif isinstance(result, list):
            yield self._record(phase + "_result", phase, [*path, "container"], path=list(path),
                               container="array", length=len(result), coverage="answered")
            for index, value in enumerate(result):
                yield from self._component_records(phase, value, (*path, index))
        else:
            yield self._record(phase + "_result", phase, list(path), path=list(path),
                               result=result, coverage="answered")

    def _assembly_records(self, name):
        RL, cp = self.RL, self.checkpoint
        mid = method_id("schema", name)
        counts = cp["methods"][mid]
        if counts.get("coverage") == "refused":
            return
        past = self.load_records(mid) if self.load_records else ()
        stored = itertools.chain(resolve_detail_records(past), self._local_records.get(mid, []))
        # Edges are already unique candidate bindings. Deduplicate the local
        # tail against durable pages, whose acknowledgement may precede this
        # lease's next call by only a few instructions.
        seen, edges = set(), []
        for record in stored:
            if record.get("engine_edge") and record.get("method_id") == mid and record["id"] not in seen:
                seen.add(record["id"])
                edges.append(_restore_edge(record["engine_edge"], RL))
                if len(edges) % 256 == 0:
                    _resource_guard("whole-figure edge restoration")
        if not edges and counts["true"] + counts["undecided"]:
            raise ValueError("RESULT_EXPIRED: committed whole-figure edges are required to resume")
        _resource_guard("whole-figure assembly", extra_bytes=len(edges) * 256)
        assembled = RL.assemble(RL.REGISTRY[name], edges, self.stream)
        _resource_guard("whole-figure assembly")
        if isinstance(assembled, RL.Refusal):
            raise _Refused(assembled)
        for frame, members, value in assembled:
            ids = ["relation_instance:" + digest([self.identity["hash"], mid,
                     [e.a.origin, e.a.idx, e.b.origin, e.b.idx]])[:32] for e in members]
            record = self._record("relation_figure", mid,
                [frame, [(e.a.idx, e.b.idx) for e in members], getattr(members, "members", ())],
                namespace="schema", schema_name=name, frame=json_safe(frame), verdict=verdict(value),
                member_lines=list(getattr(members, "members", ())))
            record["edge_count"] = len(ids)
            yield record
            for i in range(0, len(ids), 128):
                yield self._record("figure_edges", mid, [record["id"], i],
                                   figure_id=record["id"], offset=i, edge_ids=ids[i:i + 128])
        counts["figure_counts"] = {tag: sum(verdict(v) == tag for _, _, v in assembled)
                                   for tag in ("true", "false", "undecided")}

    def _finish(self, phase, name):
        RL, cp = self.RL, self.checkpoint
        mid = self._task_mid(phase, name)
        counts = cp["methods"].setdefault(mid, {"candidates": 0, "true": 0, "false": 0, "undecided": 0})
        counts["coverage"] = "refused" if counts.get("refused_questions") else counts.get("coverage", "answered")
        rows = []
        needs_assembly = phase == "schema" and not RL.pair_scope_representable(RL.REGISTRY[name]) and name not in RL.FULL_SHAPES
        if needs_assembly and counts["coverage"] == "answered":
            counts.pop("coverage", None)
        if phase in ("schema", "assembly") and not needs_assembly:
            if self.stream.unreadable:
                counts["coverage"] = "refused"
                counts["unreadable_tokens"] = len(self.stream.unreadable)
                counts["refusal"] = {"kind": "unknown_members", "capability": "native_reading", "missing": [], "vacuous": [],
                    "detail": "Unread lexical members remain in the source census. Findings over readable members do not answer those obligations."}
            rows.append(self._record("method_result", mid, "result", namespace="schema", schema_name=name,
                                    coverage=counts["coverage"], counts=counts,
                                    refusal=counts.get("refusal"), availability="available" if counts["coverage"] == "answered" else "unknown_members",
                                    supply={c: json_safe(self.stream.supply(c))
                                                                       for c in RL.REGISTRY[name].capabilities()}))
        if not needs_assembly:
            self._local_records.pop(mid, None)
        return rows

    def _figure_record(self, name, frame, edges, value):
        return self._record("relation_figure", method_id("schema", name),
                            [frame, [(e.a.idx, e.b.idx) for e in edges], getattr(edges, "members", ())],
                            namespace="schema", schema_name=name, frame=json_safe(frame),
                            verdict=verdict(value), member_lines=list(getattr(edges, "members", ())),
                            edges=[self._edge_record(e, self._schema_stream or self.stream) for e in edges])

    def _advance(self):
        self.checkpoint["method_index"] += 1
        self.checkpoint["candidate"] = 0
        self.checkpoint["emission"] = 0
        self._generator = None
        self._schema_stream = None
        i = self.checkpoint["method_index"]
        self.checkpoint["phase"] = self.tasks[i][0] if i < len(self.tasks) else "complete"
        self.checkpoint["done"] = i >= len(self.tasks)

    def summary(self):
        cp = self.checkpoint
        done = cp["method_index"] >= len(self.tasks)
        methods = [{"method_id": k, **v} for k, v in cp["methods"].items() if k != "coordinates"]
        requested = len({self._task_mid(p, n) for p, n in self.tasks if p != "coordinates"})
        answered = sum(m.get("coverage") == "answered" for m in methods)
        refused = [m["method_id"] for m in methods if m.get("coverage") == "refused"]
        return {"identity": self.identity, "language": self.language, "provider_calls": 0,
                "completion": "complete" if done else "partial", "methods": methods,
                "counters": copy.deepcopy(cp["counters"]),
                "coverage": {"certified": done and not refused, "partial": not done,
                             "requested_methods": requested, "answered_methods": answered,
                             "refused_methods": len(refused), "pending_methods": requested - answered - len(refused),
                             "not_requested_methods": len(self.RL.REGISTRY) - len(self.schema_names),
                             "refused_obligations": refused},
                "denominators": {"raw_tokens": sum(len(w) for w in self.stream.lexical_tokens),
                                 "readable_tokens": len(self.stream.tokens), "unread_tokens": len(self.stream.unreadable),
                                 "excluded_lines": len(self.stream.excluded_lines), "syllables": len(self.stream.units)},
                "capabilities": json_safe(self.RL.capability_report(self.stream))}

    def _prepare_event(self, phase, name, counts):
        """Rebuild the current binding; only its emission cursor is persisted."""
        cp, RL = self.checkpoint, self.RL
        _resource_guard("reader traversal")
        delta = {"candidates": 0, "true": 0, "false": 0, "undecided": 0, "refused_questions": 0}
        action = "candidate"
        try:
            if self._generator is None:
                self._generator = self._task_generator(phase, name)
                for _ in range(cp["candidate"]):
                    next(self._generator)
            binding = next(self._generator)
            new = []
            if phase == "coordinates":
                new = [self._coordinate(*binding)]
            elif phase == "native_pairs":
                new = [self._native_pair(binding)]
            elif phase == "native_work":
                new = [self._native_measure(*binding)]
            elif phase == "schema":
                kind, value = binding
                if kind == "edge":
                    inst = RL.evaluate(RL.REGISTRY[name], *value, self._schema_stream)
                    if inst is not None:
                        delta[verdict(inst.verdict)] += 1
                        if inst.verdict is not False:
                            record = self._edge_record(inst, self._schema_stream)
                            new.append(record)
                            if not RL.pair_scope_representable(RL.REGISTRY[name]):
                                self._local_records.setdefault(self._task_mid(phase, name), []).append(record)
                else:
                    shapes = self._shape(name, kind, value)
                    if isinstance(shapes, RL.Refusal):
                        raise _Refused(shapes)
                    for frame, edges, v in shapes:
                        delta[verdict(v)] += 1
                        new.append(self._figure_record(name, frame, edges, v))
            else:
                new = [binding]
            delta["candidates"] = 1
            delta["refused_questions"] = sum(row.get("coverage") == "refused" for row in new)
        except StopIteration:
            new, action = self._finish(phase, name), "advance"
        except _Refused as exc:
            counts["coverage"] = "refused"
            counts["refusal"] = json_safe(exc.refusal)
            new, action = [self._refusal(name, exc.refusal)], "advance"
        emitted = iter(self._bounded_records(new))
        for _ in range(cp["emission"]):
            try:
                next(emitted)
            except StopIteration as exc:
                raise ValueError("STALE_READING: emission cursor is outside its deterministic binding") from exc
        return {"records": emitted, "delta": delta, "action": action, "method_id": self._task_mid(phase, name)}

    def step(self, budget_candidates: int = 256, deadline: float | None = None,
             max_bytes: int = 1048576):
        if type(budget_candidates) is not int or budget_candidates < 1:
            raise ValueError("candidate lease batch must be positive")
        if max_bytes < 65536 or max_bytes > 1048576:
            raise ValueError("reader frames must have a 64 KiB–1 MiB byte budget")
        start = time.monotonic()
        deadline = min(deadline, start + 1) if deadline is not None else start + 1
        records, used, bytes_used = [], 0, 0
        cp, RL = self.checkpoint, self.RL
        if self.load_records:
            # Last step is durably acknowledged by the worker before the
            # next one starts; only this step's uncommitted tail is held.
            self._local_records.clear()
        while cp["method_index"] < len(self.tasks) and used < budget_candidates:
            if records and (time.monotonic() >= deadline or bytes_used >= max_bytes - 32768):
                break
            phase, name = self.tasks[cp["method_index"]]
            mid = self._task_mid(phase, name)
            counts = cp["methods"].setdefault(mid, {"candidates": 0, "true": 0, "false": 0, "undecided": 0})
            if self._pending_event is None:
                self._pending_event = self._prepare_event(phase, name, counts)
            event = self._pending_event
            try:
                record = next(event["records"])
            except StopIteration:
                for key, value in event["delta"].items():
                    if value:
                        counts[key] = counts.get(key, 0) + value
                        if key in cp["counters"]:
                            cp["counters"][key] += value
                if event["action"] == "advance":
                    self._advance()
                else:
                    cp["candidate"] += 1
                    cp["emission"] = 0
                    used += 1
                self._pending_event = None
                continue
            size = len(canonical_json(record).encode("utf-8"))
            if size > 32768:
                raise ValueError("INVARIANT_FAILURE: detail record exceeded its fixed wire budget")
            records.append(record)
            bytes_used += size
            cp["emission"] += 1
            cp["sequence"] += 1
            cp["counters"]["evidence_records"] += 1
        done = cp["method_index"] >= len(self.tasks)
        return {"identity": self.identity, "checkpoint": copy.deepcopy(cp),
                "records": records, "done": done, "summary": self.summary(), "provider_calls": 0}


class _Refused(Exception):
    def __init__(self, refusal):
        self.refusal = refusal
        super().__init__(refusal.detail)


def run_step(source, declarations=None, requested=None, checkpoint=None, *,
             budget_candidates=256, deadline=None, max_bytes=1048576,
             load_records=None, identity=None, requested_methods=None):
    session = AnalysisSession(source, declarations, requested, checkpoint,
                              load_records=load_records, identity=identity, requested_methods=requested_methods)
    return session.step(budget_candidates, deadline, max_bytes)
