"""Resumable deterministic Library interpretation over a complete reading.

This adapter calls the installed judges. It does not call the writer/reviser,
infer missing music, guess a language, or impose a comparison cutoff. A cursor
counts candidate bindings, not just matches, so an interrupted search resumes
without either losing its negative population or duplicating evidence.
"""
from __future__ import annotations

import collections
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
from .registry import (LANGUAGES, REMEDIES, NATIVE_WORK_METHODS, SHARED_SOUND_LAYER,
                       SHARED_SOUND_METHODS, shared_sound_name)

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


#: What `build_stream` asks of a line's phonology about the line's text
#: alone: one answer per text, whichever line prints it.
_LINE_QUERIES = ("for_line", "tokens_for_line", "printed_boundary", "split_final")


class _GuardedPhonology:
    """Call the identical native reader while guarding stream preparation.

    One stream is read through one adapter, and a line's phonology and its
    token cut are functions of the line's TEXT (a pinned reading binds to
    the text it was declared on), so each is asked once per text, not once
    per line. A rebuilt line stream is the work's length with every other
    line blank: without this, every rebuild read every blank line again."""
    def __init__(self, phon, counter=None):
        self._inner = phon
        self._counter = counter if counter is not None else [0]
        self._asked = {}

    def __getattr__(self, name):
        value = getattr(self._inner, name)
        if name == "for_token":
            return lambda *args, **kwargs: _GuardedPhonology(value(*args, **kwargs), self._counter)
        if name in _LINE_QUERIES:
            return lambda text: self._ask(name, text, value)
        return value

    def _ask(self, name, text, query):
        key = (name, text)
        if key not in self._asked:
            got = query(text)
            self._asked[key] = _GuardedPhonology(got, self._counter) if name == "for_line" else got
        got = self._asked[key]
        # A token cut is a list its caller owns.
        return list(got) if isinstance(got, list) else got

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


def reader_scheme() -> str:
    """-> the reader scheme an analysis session in this process cuts English
    lines under: the one its Lexicon resolves (`reader_scheme=None`), and the
    one the pinned Gutenberg sets are rebound to. The connector asks for it
    at startup (`mcp/reader_scheduler.js` probeReaderScheme) and records it in
    every new job's identity, so a job queued under another scheme is refused
    `STALE_READING` at its lease rather than read under a cut it was not
    counted under."""
    import lyric_harness as LH
    return LH.resolve_reader_scheme(None)


def _reader_scheme_of(phon):
    """-> the reader scheme an English phonology cuts lines under."""
    import lyric_harness as LH
    return LH.resolve_reader_scheme(getattr(phon, "reader_scheme", None))


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
        pinned_set = False
        if self.language == "eng" and private_declarations.get("pronunciations"):
            # A declaration set from the v1-bound Gutenberg asset, read by a
            # v2 reader, moves to the same physical tokens (raw-span identity;
            # a row with no identical span refuses rather than re-attaching).
            # The asset's approved bytes stay as they are.
            import lyric_harness as LH
            from quality.pronunciation import rebind_occurrences, v1_bound_declarations
            rows = private_declarations["pronunciations"]
            if LH.resolve_reader_scheme(None) == "v2" and v1_bound_declarations(rows):
                try:
                    private_declarations["pronunciations"] = rebind_occurrences(
                        rows, "v1", "v2", strip_parens=False)
                except ValueError as exc:
                    raise ValueError(f"STALE_READING: {exc}") from None
                pinned_set = True
        settings = self.declarations.get("phonology", {})
        if not isinstance(settings, dict):
            raise ValueError("INVALID_DECLARATION: phonology settings must be an object")
        if phon is not None:
            self.phon = phon
        elif self.language == "eng":
            from quality.phonology.eng import English
            from quality.pronunciation import numbering_of, validate_choices
            import lyric_harness as LH
            lex = LH.Lexicon(strip_parens=False, fallback=settings.get("fallback"),
                             pronunciations=None)
            # The session's lexicon is guarded as the CLI guards its own: a
            # row may carry `numbering` (v1, v1+voices, v2 or v2+voices) and
            # binds the identical raw occurrence it names; an unmarked row is
            # read under both cuts (`quality.pronunciation.numbered_token`) and
            # refused, naming both, where they bind different characters. A
            # pinned Gutenberg set was rebound by raw span just above, so its
            # rows are validated as marked with the current numbering: they
            # bind where that rebinding put them and are not migrated twice.
            lex._numbering_guard = True
            lex._numbering_notices = []
            rows = private_declarations.get("pronunciations")
            if rows is not None:
                if pinned_set:
                    rows = [dict(row, numbering=numbering_of(lex)) for row in rows]
                try:
                    lex.pronunciations = validate_choices(rows, lex)
                except (ValueError, TypeError) as exc:
                    raise ValueError(f"INVALID_DECLARATION: {exc}") from None
                # Every bound row keeps its caller's order; its public copy
                # is the one the reader reads, with provenance redacted.
                bound = _public_declarations(lex.pronunciations)
                # The public rows keep the historical six fields: their tokens
                # are already in this process's numbering, the one the form
                # and language layers' own unguarded lexicons read them under,
                # and those lexicons refuse a seventh key.
                self.declarations["pronunciations"] = [
                    {k: v for k, v in row.items() if k != "numbering"} for row in bound]
            else:
                bound = copy.deepcopy(self.declarations.get("pronunciations") or [])
            lines = {r.get("analysis_text", r.get("text", "")) for r in self.rows if r.get("kind", "lyric") == "lyric"}
            if any(choice["line"] not in lines for choice in lex.pronunciations):
                raise ValueError("STALE_READING: an exact pronunciation line is absent from this registered reading")
            # Validation reads the original provenance before it is redacted.
            # It cannot convert a blank/oversized source into a valid one.
            lex.pronunciations = bound
            self.phon = English(fallback=settings.get("fallback"), readings=settings.get("readings", "all"), lexicon=lex,
                                 syllable_disputes="first")
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
        # THE ANY-READING RULE, IN THE LIBRARY (owner ruling 2026-10-23). A
        # word whose readings differ in syllable count (`fire`, `every`, `us`)
        # is read under its first-listed reading, which carries the
        # coordinates; a relation over it holds when ANY of its readings holds
        # it. `_disputed` is those tokens; `_mini` the one or two lines a pair
        # covers, rebuilt under one combination of their readings.
        self._disputed = self._disputed_tokens()
        # A MERGED word's readings share a syllable count and are read as
        # knowledge sets, so its syllables stay the work's own; a check those
        # sets leave undecided is judged again under each whole reading
        # (standing rule 5), never left open for want of trying them.
        from quality.phonology import MERGED
        self._merged = self._disputed_tokens(MERGED)
        # A merged word of more than one syllable whose readings disagree on
        # stress has no single last-stressed syllable on its knowledge set,
        # so the engine enumerates no anchored span over it and no pair ever
        # reaches the search (3PO, #641). Its spans vary with its reading as
        # a disputed word's do, so it is discovered the same way: each of its
        # readings rebuilds its line (`_alternate_edges`).
        self._restressed = frozenset(
            tok for tok in self._merged
            if len(self.stream.tokens.get(tok, ())) > 1
            and any(RL.uncertain(self.stream.units[i].syl.prominence) for i in self.stream.tokens[tok]))
        self._varying = self._disputed | self._restressed
        self._work_unit = {(u.line, u.token, u.tok_syl): u.i for u in self.stream.units}
        self._mini, self._span_index, self._incomplete = collections.OrderedDict(), {}, {}
        # Line readings the rebuilt streams share (`RL._line_read_scope`'s
        # table, held for the session as `_mini` is): a rebuild re-reads
        # only a line whose own pinned readings it has not read before.
        # Bounded by LINE_READS_CACHE.
        self._line_reads = {}
        # A rebuilt line carries no unit-indexed declaration (a declared
        # caesura, lift or beat names the work's own units), so a work with
        # sound declarations keeps first-listed readings, counted.
        self._any_reading_off = bool(self.declarations.get("sound"))
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
            # Shared sound is all pairs of a work's words: never a default,
            # only what a caller names by id (#637).
            for key in SHARED_SOUND_METHODS:
                if allowed is not None and method_id("shared_sound", shared_sound_name(key)) in allowed:
                    self.tasks.append(("shared_sound", key))
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
        # Searches `_any_reading` left incomplete before this checkpoint (the
        # candidate generator's own writers replay themselves on resume).
        self._incomplete.update(self.checkpoint.get("incomplete", {}))

    def _build_stream(self, phon=None):
        from quality import grid as GR
        phon = phon or self.phon
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
        if phon is self.phon:
            self._raw_lines, self._stream_args = list(raw), (sections, ground, source, status)
        st = self.RL.build_stream(raw, _GuardedPhonology(phon), sections=sections, stanzas=ground,
                                 stanza_source=source or "", line_status=status,
                                 exclude_status=(GR.SECTION_MARKER_STATUS, "song_break"))
        st.phon = phon
        _resource_guard("native stream preparation")
        self._apply_declarations(st, rows)
        return st, rows

    def _disputed_tokens(self, status=None):
        """-> {(line, token)} read under a first-listed reading their other
        readings, of another syllable count, may overturn. With `status`,
        the tokens of that reading status instead (MERGED: readings of one
        syllable count, folded into knowledge sets)."""
        from quality.phonology import DISPUTED
        status = status or DISPUTED
        if not hasattr(self.phon, "reading_status"):
            return frozenset()
        out = set()
        for li, words in enumerate(self.stream.lexical_tokens):
            ph = self.phon.for_line(self.stream.text_lines[li]) if hasattr(self.phon, "for_line") else self.phon
            for ti, word in enumerate(words):
                if (li, ti) not in self.stream.tokens:
                    continue
                tph = ph.for_token(ti) if hasattr(ph, "for_token") else ph
                if tph.reading_status(word)[0] == status:
                    out.add((li, ti))
        return frozenset(out)

    #: Rebuilt line streams kept at once: each is one or two lines, and a
    #: pure function of the work, its lines and their readings.
    MINI_CACHE = 1024
    #: Reading combinations one pair's words may take, and one line's words.
    #: Past it the method is refused as incomplete, never answered over the
    #: combinations it did not try.
    EDGE_COMBOS = 64
    #: Line-pair rebuilds one schema's discovery may make, likewise. Sized
    #: to the longest single English work in the Library, Whitman's "Song of
    #: Myself" (1,658 lines): every line and every pair of lines, L(L+1)/2,
    #: so no work in the corpus is refused for length (John, 2026-10-31).
    MINI_CAP = 1375311
    #: Line readings kept for the rebuilds at once, one per line text, its
    #: words and the readings pinned on it. Past it the table starts again:
    #: a cache, so what a rebuild reads never depends on it. One rebuild adds
    #: at most one entry per line text it holds -- its one or two lines and
    #: the blank -- so the table never exceeds LINE_READS_CACHE + 3.
    LINE_READS_CACHE = 1024

    def _line_stream(self, lines, combo):
        """The work read with only `lines` present -- every other line blank,
        so line, token, section and stanza coordinates stay the work's own --
        and `combo`'s readings declared. One reading of one word changes only
        its own line, so a pair is judged under another reading by rebuilding
        its one or two lines, never the work. None when no phonology pins it."""
        key = (tuple(sorted(lines)), self._combo_key(combo))
        if key in self._mini:
            self._mini.move_to_end(key)
            return self._mini[key]
        # A rebuild is an allocation whatever it reads: guarded here, not
        # only through syllabification, which a warm line-read table skips.
        _resource_guard("any-reading rebuild")
        phon = self.RL.pinned_phonology(self.stream, combo) if combo else self.phon
        st = None
        if phon is not None:
            from quality import grid as GR
            keep = set(lines)
            raw = [text if i in keep else "" for i, text in enumerate(self._raw_lines)]
            sections, ground, source, status = self._stream_args
            # Every rebuild reads its lines through one shared table, as the
            # engine's own any-reading search does (`_line_read_scope`,
            # M-317): a line's reading is keyed by its text, its words and
            # the readings pinned on it, so the blank lines and the line a
            # combination does not touch are read once, not once per rebuild.
            if len(self._line_reads) >= self.LINE_READS_CACHE:
                self._line_reads.clear()
            outer, self.RL._ACTIVE_LINE_READS = self.RL._ACTIVE_LINE_READS, self._line_reads
            try:
                st = self.RL.build_stream(raw, _GuardedPhonology(phon), sections=sections, stanzas=ground,
                                         stanza_source=source or "", line_status=status,
                                         exclude_status=(GR.SECTION_MARKER_STATUS, "song_break"))
            finally:
                self.RL._ACTIVE_LINE_READS = outer
            st.phon = phon
            if any("/" in raw[i] or "|" in raw[i] for i in keep):
                self.RL.mark_printed_caesura(st)
            st.any_reading_combo = dict(combo)
        self._mini[key] = st
        while len(self._mini) > self.MINI_CACHE:
            _, old = self._mini.popitem(last=False)
            if old is not None:
                self._span_index.pop(id(old), None)
        return st

    def _touched(self, st, *spans):
        """-> {(line, token)} words the spans cover whose spans vary with
        their reading: disputed, or merged and restressed."""
        return {(st.units[i].line, st.units[i].token) for span in spans for i in span.idx
                if (st.units[i].line, st.units[i].token) in self._varying}

    def _origin(self, span, st):
        """The span's provenance with any unit number (`@c`, a caesura's
        unit) replaced by that unit's word and syllable: the same locus in
        every reading and every rebuilt line."""
        head, at, unit = span.origin.rpartition("@")
        if at and unit.isdigit() and int(unit) < len(st.units):
            return f"{head}@{self._cell(st.units[int(unit)])}"
        return span.origin

    def _cell(self, u):
        tok = (u.line, u.token)
        return tok if tok in self._disputed else (u.line, u.token, u.tok_syl)

    def _span_key(self, span, st):
        """What a span IS across readings and rebuilt lines: its locus and,
        unit by unit, the word each syllable belongs to and -- outside a
        disputed word, whose syllables are what the readings change -- which
        syllable of that word it is. Not `search_k`, which counts a searched
        line's hypotheses and is no part of the member."""
        cells = []
        for i in span.idx:
            cell = self._cell(st.units[i])
            if not cells or cells[-1] != cell:
                cells.append(cell)
        return (self._origin(span, st), span.direction, tuple(cells))

    def _spans_by_key(self, st, rule):
        # Per stream, so an evicted stream's spans leave with it in one step.
        by_rule = self._span_index.setdefault(id(st), {})
        memo = by_rule.get(id(rule))
        if memo is None:
            memo = by_rule[id(rule)] = {}
            for span in self.RL.enumerate_spans(rule, st):
                memo.setdefault(self._span_key(span, st), []).append(span)
                memo.setdefault(("locus", self._origin(span, st), span.direction), []).append(span)
        return memo

    def _searchable(self, schema, st):
        return (not self._any_reading_off and self._varies(schema)
                and (st is self.stream or getattr(st, "any_reading_combo", None) is not None))

    def _merged_touched(self, st, *spans):
        """-> {(line, token)} merged words the spans cover."""
        return {(st.units[i].line, st.units[i].token) for span in spans for i in span.idx
                if (st.units[i].line, st.units[i].token) in self._merged}

    def _search(self, state, examined=0, reason=None, termination=None):
        """The per-edge record of the any-reading search (`reading_search`):
        `state` is what was JUDGED (exhaustive only when every combination
        was), `termination_reason` why the search stopped (a witness found,
        every combination exhausted, or the cap)."""
        out = {"state": state, "combinations_examined": examined,
               "combination_limit": self.EDGE_COMBOS}
        if termination:
            out["termination_reason"] = termination
        if reason:
            out["reason"] = reason
        return out

    def _any_reading(self, name, a, b, st):
        """-> (inst, stream, witness, first_only, search).

        THE RULE (owner ruling 2026-10-23): a check holds when ANY reading of
        its disputed words holds it -- every combination of the readings of
        the words the pair covers, each judged on the pair's own one or two
        lines rebuilt under it. True with the first combination that holds
        (its readings are the witness); False only when every combination is
        judged False; otherwise the first-listed verdict, or None where a
        combination stayed open. `first_only` marks a pair over a disputed
        word in a scope this search does not reach (`_varies`).

        A merged word is read as a knowledge set, which settles a check every
        reading agrees on and leaves the rest undecided. Only that undecided
        verdict is searched over the merged word's readings, together with
        any disputed word's: a set that answers True or False has answered
        for every reading already. `search` says what the search did
        (`reading_search` on the record): not needed, exhaustive, partial
        (past EDGE_COMBOS), or unavailable (no combination could be built,
        or the scope keeps first-listed readings), with the reason."""
        RL = self.RL
        schema = RL.REGISTRY[name]
        inst = RL.evaluate(schema, a, b, st)
        touched = self._touched(st, a, b)
        searchable = bool(touched) and self._searchable(schema, st)
        first_only = bool(touched) and not searchable
        merged = (self._merged_touched(st, a, b)
                  if inst is not None and inst.verdict is None else set())
        if inst is not None and inst.verdict is True:
            return inst, st, self._witness(st, touched), first_only, self._search("not_needed")
        if merged and not self._searchable(schema, st):
            return inst, st, None, first_only, self._search(
                "unavailable", reason="readings_not_searched_in_scope")
        if not searchable and not merged:
            return inst, st, None, first_only, self._search(
                "unavailable" if first_only else "not_needed",
                reason="readings_not_searched_in_scope" if first_only else None)
        cause = touched | merged
        combos, complete = RL.reading_combos(self.stream, cause, self.EDGE_COMBOS)
        if not combos:
            return inst, st, None, first_only, self._search(
                "unavailable" if merged else "not_needed",
                reason="no_reading_combination" if merged else None)
        # A capped search over MERGED words alone leaves its edge undecided
        # and nothing else: a merged word forms no bucket key, so every pair
        # over it is a candidate and none goes missing. Only a disputed word's
        # cap can hide a pair, and only that refuses the method.
        disputed_complete = complete if not merged else (
            not touched or RL.reading_combos(self.stream, touched, self.EDGE_COMBOS)[1])
        if not disputed_complete and name not in self._incomplete:
            # Judged here, per candidate, outside the candidate generator, so
            # a resumed traversal that fast-forwards past this candidate never
            # meets it again: the reason rides in the checkpoint, or the
            # method resumes as answered (`_finish`).
            reason = f"a pair's words take more than {self.EDGE_COMBOS} combinations of readings"
            self._incomplete[name] = self.checkpoint.setdefault("incomplete", {})[name] = reason
        lines = sorted({st.units[i].line for span in (a, b) for i in span.idx})
        own = self._combo_key({t: c for t, c in (getattr(st, "any_reading_combo", None) or {}).items()
                               if t in touched})
        # Over a merged word `inst` was judged on its knowledge set, never on
        # one reading, so every combination is judged and an undecided set
        # whose every reading is judged False is False. Without one, an
        # undecided first-listed verdict stays undecided, as before.
        open_ = not complete or (not merged and inst is not None and inst.verdict is None)
        reasons = [] if complete else ["combination_cap"]
        examined = 0
        # WHAT WAS JUDGED UNDER EACH COMBINATION (item 5; 3PO 6547475463,
        # 6547785583): every combination this loop judges is kept as its
        # complete role-bound assignment with its outcome. Only these are
        # known; every other assignment stays uncomputed. Nothing is searched
        # for it, and the first witness still ends the search.
        roles = self._span_roles(st, a, b)
        outcomes = []
        under = self._judged_under(st, roles, inst.verdict if inst is not None else None,
                                   "merged_set" if self._merged_touched(st, a, b) else None)
        # The reading `inst` was judged under is not judged again.
        to_judge = [c for c in combos if merged or not (
            st is self.stream and c is combos[0] or self._combo_key(c) == own)]
        for combo in to_judge:
            alt = self._line_stream(lines, combo)
            if alt is None:
                # Not judged: a combination whose lines could not be rebuilt
                # is neither counted nor allows `exhaustive` (3PO, #641).
                open_ = True
                reasons.append("rebuild_unavailable")
                continue
            examined += 1
            combo_open = False
            sides = []
            for rule, span in ((schema.spans[0], a), (schema.spans[1], b)):
                try:
                    index = self._spans_by_key(alt, rule)
                except RL.NoReferent:
                    # No referent at all under this reading (a line-final
                    # penult once `fire` is one syllable): the member does
                    # not exist there, a judged absence.
                    index = {}
                found = index.get(self._span_key(span, st), ())
                # Spans at this locus that match none is a key the reader
                # cannot pair: open, never a confident False.
                if not found and index.get(("locus", self._origin(span, st), span.direction)):
                    open_ = combo_open = True
                    reasons.append("locus_unmatched")
                sides.append(found)
            for x in sides[0]:
                for y in sides[1]:
                    got = RL.evaluate(schema, x, y, alt)
                    if got is not None and got.verdict is True:
                        # A witness ends the search: what was JUDGED is
                        # exhaustive only if nothing was left unjudged (3PO,
                        # #641), whatever the cap allowed.
                        whole = complete and examined == len(to_judge)  # no rebuild failed
                        return got, alt, self._witness(alt, cause), first_only, self._outcome_search(
                            self._search("exhaustive" if whole else "partial", examined,
                                         termination="witness_found"), outcomes, under)
                    if got is not None and got.verdict is None:
                        open_ = combo_open = True
            # A member with no span under this reading was not a candidate
            # there: outside the locus, never a predicate False.
            outcomes.append(self._outcome(roles, combo, None if combo_open else
                                          "outside_locus" if not (sides[0] and sides[1]) else False))
        whole = complete and examined == len(to_judge)
        state = "exhaustive" if whole else "partial"
        termination = ("combination_cap" if not complete else
                       "exhausted" if whole else "rebuild_unavailable")
        if inst is not None and open_ and inst.verdict is False:
            inst = replace(inst, verdict=None)
        elif inst is not None and merged and not open_ and inst.verdict is None:
            # Every whole reading of the merged (and disputed) words judged,
            # and every one False: the set's open verdict was only the set.
            inst = replace(inst, verdict=False)
        # The search's own reason an edge stayed open; one the judge gave
        # (an unknown channel, placement or identity) is read off the
        # instance by `_undecided_reason`.
        reason = next((r for r in ("combination_cap", "rebuild_unavailable", "locus_unmatched")
                       if r in reasons), None) if inst is not None and inst.verdict is None else None
        return inst, st, None, first_only, self._outcome_search(
            self._search(state, examined, reason, termination), outcomes, under)

    def _applicable_readings(self, li, ti):
        """The readings the any-reading search varies for this occurrence
        (item 5; BB8's shape, #637 6547502531): the declared row when the
        writer pinned one, else the lexicon's whole-reading variants -- the
        same `occurrence_readings` the search pins from, which can differ
        from `dictionary_readings`. Unlocatable: a null list, never a
        fallback to the dictionary."""
        memo = self.__dict__.setdefault("_applicable_memo", {})
        if (li, ti) not in memo:
            memo[(li, ti)] = self._find_applicable(li, ti)
        return dict(memo[(li, ti)])

    def _find_applicable(self, li, ti):
        from quality.pronunciation import occurrence_readings
        lex = self.RL._stream_lexicon(self.stream)
        words = self.stream.lexical_tokens[li] if self.stream.lexical_tokens else ()
        got = (occurrence_readings(lex, self.stream.text_lines[li], words, ti)
               if lex is not None else None)
        if got is None:
            return {"applicable_readings": None, "applicable_source": "unlocatable"}
        tok, _word, readings = got
        declared = any(row["line"] == self.stream.text_lines[li] and row["token"] == tok
                       for row in (getattr(lex, "pronunciations", ()) or ()))
        return {"applicable_readings": [" ".join(p) for p in readings],
                "applicable_source": "declared" if declared else "variants"}

    def _span_roles(self, st, a, b):
        """-> {(line, token): ["a"] | ["b"] | ["a", "b"]}: every occurrence
        the pair's two members cover on `st`, with its role."""
        roles = {}
        for role, span in (("a", a), ("b", b)):
            for i in span.idx:
                u = st.units[i]
                got = roles.setdefault((u.line, u.token), [])
                if role not in got:
                    got.append(role)
        return roles

    def _held_reading(self, tok):
        """-> (phones or None, how) for an occurrence no combination varied:
        its only reading, the merged set it is read as, its first-listed
        reading, or unread."""
        if tok in self._merged:
            return None, "merged_set"
        readings = self._applicable_readings(*tok)["applicable_readings"]
        if readings is None:
            return None, "unread"
        return readings[0], "only_reading" if len(readings) == 1 else "first_listed"

    def _assignment(self, roles, combo):
        """The complete role-bound assignment of one judged combination: each
        occurrence of both members, by its token id and role, with the
        reading it was judged under. `display` is presentation only; the
        occurrence and role are the identity (3PO 6547751176), so a word
        repeated in the pair is never confused."""
        out = []
        for (li, ti), role in sorted(roles.items()):
            word = str(self.stream.lexical_tokens[li][ti])
            if (li, ti) in combo:
                phones, held = " ".join(combo[(li, ti)][2]), "varied"
            else:
                phones, held = self._held_reading((li, ti))
            out.append({"occurrence": f"{self._line_id(li)}:token:{ti}", "role": role,
                        "phones": phones, "held": held,
                        "display": f"{word} = {phones}" if phones else f"{word} ({held.replace('_', ' ')})"})
        return out

    def _outcome(self, roles, combo, value):
        """One judged combination and what it was judged: "false",
        "undecided", or "outside_locus" when a member had no span under it.
        Never True: a True is the witness, on `reading`."""
        return {"assignment": self._assignment(roles, combo),
                "verdict": value if value == "outside_locus" else
                "false" if value is False else "undecided"}

    def _judged_under(self, st, roles, value, basis=None):
        """What the pair's own verdict, before any search, was judged on: a
        rebuilt stream's own assignment, the merged sets, or the first-listed
        readings; with that verdict and its complete assignment."""
        combo = {t: c for t, c in (getattr(st, "any_reading_combo", None) or {}).items() if t in roles}
        return {"basis": "rebuilt_assignment" if combo else basis or "first_listed",
                "verdict": verdict(value), "assignment": self._assignment(roles, combo)}

    @staticmethod
    def _outcome_search(search, outcomes, under):
        """`search` carrying the loop's judged outcomes and the pair's own
        verdict's basis, for the record to lift off: the `reading_search`
        summary itself keeps its agreed shape."""
        search["_outcomes"] = outcomes
        search["_judged_under"] = under
        return search

    @staticmethod
    def _lift_outcomes(search, extra):
        """Move a search's judged outcomes onto the record (`extra`), as
        `reading_outcomes` and `judged_under`; -> the bare summary."""
        search = dict(search)
        outcomes = search.pop("_outcomes", None)
        under = search.pop("_judged_under", None)
        if outcomes is not None:
            extra["reading_outcomes"] = outcomes
            extra["judged_under"] = under
        return search

    def _witness(self, st, touched):
        """-> the readings a verdict rests on: those of `touched` words a
        rebuilt stream declared, or None on the work's own first readings."""
        combo = getattr(st, "any_reading_combo", None)
        if combo is None:
            return None
        return self.RL.reading_witness({t: c for t, c in combo.items() if t in touched})

    def _varies(self, schema):
        """-> bool: whether this schema's pairs are judged under every
        reading. Not a whole figure, a beat schema, or a SEARCHED rule
        (`free_run`): a searched rule enumerates sub-spans inside a word, and
        a word whose syllable count changes has no sub-span-for-sub-span
        counterpart. Those keep the first-listed reading, counted."""
        return (self.RL.pair_scope_representable(schema) and "beat" not in schema.capabilities()
                and not any(rule.anchor == "searched" or rule.locus == "free_run" for rule in schema.spans))

    def _shape_first_only(self, kind, value):
        """-> bool: a full-shape candidate over a disputed word, which only
        its first-listed reading judges."""
        if kind == "token_shape":
            li, members = value
            return any((li, ti) in self._disputed for ti in members)
        lines = value if kind == "line_shape" else (value,)
        return any(li in lines for li, _ in self._disputed)

    def _combo_key(self, combo):
        return tuple(sorted((tok, tuple(choice[2])) for tok, choice in combo.items()))

    def _alternate_edges(self, name, schema, seen):
        """Candidates no first-listed reading offers: a pair over disputed
        words that only other readings bring into one bucket.

        Each line with disputed words is rebuilt alone under every other
        combination of their readings, and every span there over a changed
        word is a VARIANT, bucketed by its own key. A variant colliding with
        a span of another line -- first-listed, or a variant of that line --
        names the one or two lines and the joint readings to rebuild; the
        engine's own `_candidate_pairs` then runs there over pairs touching
        the changed words. Deterministic: lines, combinations and targets
        are sorted. Over the caps the method is marked incomplete."""
        RL = self.RL
        if not self._varying or self._schema_stream is not self.stream or not self._searchable(schema, self.stream):
            return
        rules = schema.spans
        variants = [[], []]
        same_rule = rules[1] is rules[0]
        for li in sorted({li for li, _ in self._varying}):
            toks = {t for t in self._varying if t[0] == li}
            combos, complete = RL.reading_combos(self.stream, toks, self.EDGE_COMBOS)
            if not combos:
                continue
            if not complete:
                self._incomplete.setdefault(name, f"a line's words take more than {self.EDGE_COMBOS} "
                                                  f"combinations of readings")
            first = combos[0]
            # The work reads a disputed word under its first reading, so that
            # combination is the work's own; a restressed word is read as a
            # knowledge set, so even its first reading is a variant.
            restressed = toks & self._restressed
            for combo in (combos if restressed else combos[1:]):
                mini = self._line_stream([li], combo)
                if mini is None:
                    continue
                changed = {t for t, c in combo.items() if tuple(c[2]) != tuple(first[t][2])} | restressed
                for side in ((0,) if same_rule else (0, 1)):
                    try:
                        index = self._spans_by_key(mini, rules[side])
                    except RL.NoReferent:
                        continue
                    for key, spans in index.items():
                        if key[0] == "locus":
                            continue
                        variants[side].extend((span, mini, li, combo) for span in spans
                                              if changed & self._touched(mini, span))
        if same_rule:
            variants[1] = variants[0]
        if not variants[0] and not variants[1]:
            return
        try:
            primary = [[(span, self.stream, self.stream.units[span.idx[0]].line, None)
                        for k, spans in self._spans_by_key(self.stream, rule).items() if k[0] != "locus"
                        for span in spans if span.idx] for rule in rules]
        except RL.NoReferent:
            primary = [[], []]

        def table(entries):
            idx = {}
            for span, st, line, combo in entries:
                idx.setdefault((RL._frame_key(schema, span, st), RL._bucket_key(schema, span, st,
                              RL.DEFAULT_CHANNELS, rule=rules[1])), []).append(
                    (line, combo, self._span_key(span, st)))
            return idx

        def partners(idx, span, st):
            fk = RL._frame_key(schema, span, st)
            ka = RL._bucket_key(schema, span, st, RL.DEFAULT_CHANNELS, rule=rules[0])
            for (f, k), entries in idx.items():
                if (ka is None or k is None or k == ka) and (fk is None or f is None or f == fk):
                    yield from entries

        targets = {}

        def target(lx, cx, kx, ly, cy, ky):
            # Only a pair no reading has offered yet is worth a rebuild: its
            # members' keys are reading-invariant, so a pair already met is
            # the same pair, whichever readings bucketed it.
            if kx == ky or (kx, ky) in seen or same_rule and (ky, kx) in seen:
                return
            if lx == ly:
                if cx is not None and cy is not None and self._combo_key(cx) != self._combo_key(cy):
                    return
                union, lines = cx or cy, (lx,)
            else:
                union, lines = {**(cx or {}), **(cy or {})}, tuple(sorted((lx, ly)))
            targets.setdefault((lines, self._combo_key(union)), (lines, union))

        every_b = table(primary[1] + variants[1])
        for span, mini, li, combo in variants[0]:
            kx = self._span_key(span, mini)
            for ly, cy, ky in partners(every_b, span, mini):
                target(li, combo, kx, ly, cy, ky)
                if len(targets) > self.MINI_CAP:
                    break
        if variants[1] and len(targets) <= self.MINI_CAP:
            only_b = table(variants[1])
            for span, st, line, _ in primary[0]:
                kx = self._span_key(span, st)
                for ly, cy, ky in partners(only_b, span, st):
                    target(line, None, kx, ly, cy, ky)
        if len(targets) > self.MINI_CAP:
            self._incomplete[name] = (f"its disputed words' readings collide on more than "
                                      f"{self.MINI_CAP} line pairs")
            return
        for key in sorted(targets):
            lines, union = targets[key]
            mini = self._line_stream(lines, union)
            if mini is not None:
                yield from self._discover(schema, mini, union, seen)

    def _discover(self, schema, alt, combo, seen):
        """The engine's own candidate pairs in `alt` with a member over one
        of `combo`'s pinned words: those words' A-side spans against every
        B, then every other A against their B-side spans."""
        RL = self.RL
        ids = {i for tok in combo for i in alt.tokens.get(tok, ())}
        try:
            aa = [x for k, spans in self._spans_by_key(alt, schema.spans[0]).items() if k[0] != "locus" for x in spans]
            bb = (aa if schema.spans[0] == schema.spans[1] else
                  [y for k, spans in self._spans_by_key(alt, schema.spans[1]).items() if k[0] != "locus" for y in spans])
        except RL.NoReferent:
            return
        hits = lambda span: bool(ids & set(span.idx))
        for left, right in (([x for x in aa if hits(x)], bb),
                            ([x for x in aa if not hits(x)], [y for y in bb if hits(y)])):
            if left and right:
                yield from self._new_pairs(schema, alt, left, right, seen)

    def _new_pairs(self, schema, alt, aa, bb, seen):
        RL = self.RL
        akeys, bkeys = {x.idx for x in aa}, {y.idx for y in bb}
        idx, wild = {}, {}
        for span in bb:
            idx.setdefault((RL._frame_key(schema, span, alt), RL._bucket_key(schema, span, alt,
                          RL.DEFAULT_CHANNELS, rule=schema.spans[1])), []).append(span)
        for (f, k), spans in idx.items():
            if k is None:
                wild.setdefault(f, []).extend(spans)
        layout = [(x, tuple(RL._cand_buckets(schema, x, alt, RL.DEFAULT_CHANNELS, idx, wild))) for x in aa]
        mirror = schema.spans[0] == schema.spans[1]
        for x, y, _reverse in RL._candidate_pairs(schema, layout, alt, akeys, bkeys, None, prune=True):
            key = (self._span_key(x, alt), self._span_key(y, alt))
            # The narrowed passes cannot mirror-deduplicate as one full pass
            # does, so a same-rule pair already met reversed is the same pair.
            if key in seen or mirror and key[::-1] in seen:
                continue
            seen.add(key)
            yield "alt_edge", (x, y, alt)

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
            # The record's size changes only when a field is detached, so it
            # is measured once and again after each detachment -- not once
            # per field.
            size = None
            for field in candidates:
                encoded = encoded_fields[field]
                raw = encoded.encode("utf-8")
                if len(raw) <= 8192:
                    if size is None:
                        size = len(canonical_json(record).encode("utf-8"))
                    if size <= 24576:
                        continue
                sha = hashlib.sha256(raw).hexdigest()
                detail_id = "detail:" + digest([original["id"], field, sha])[:32]
                parts = max(1, (len(encoded) + 4095) // 4096)
                record[field] = {"$detail_ref": detail_id, "encoding": "json",
                                 "sha256": sha, "byte_length": len(raw), "parts": parts}
                size = None
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
        if self.language == "eng" and _reader_scheme_of(self.phon) == "v2":
            import lyric_harness as LH
            rl = LH.reader_line(raw, strip_parens=False, scheme="v2")
            # The reader's own raw pieces (codepoint offsets into the analysis
            # text), guarded so they are the tokens the stream read -- with
            # the printed endpoint the stream appends when it is not an
            # English token (`English.tokens_for_line`).
            located = list(rl.tokens)
            endpoint = LH.printed_endpoint(rl)
            if endpoint is not None:
                located.append(endpoint)
            # A token whose pieces do not rebuild its text (a line the reader
            # had to map in whitespace chunks) has no exact span: it falls
            # back to the row's range rather than claim a chunk as `exact`.
            # Neither does an endpoint sharing characters with a token before
            # it (`go кот5`), so no two exact ranges overlap.
            claimed = {i for t in rl.tokens for a, b in t.pieces for i in range(a, b)}
            positions = ([list(t.pieces) if LH.normalise_word(
                              "".join(raw[a:b] for a, b in t.pieces)) == t.text
                          and not (t is endpoint and any(
                              i in claimed for a, b in t.pieces for i in range(a, b)))
                          else []
                          for t in located]
                         if tuple(t.text for t in located) == tuple(words) else None)
        elif self.language == "eng":
            # Reader scheme v1: the pre-batch projection, verbatim.
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

    def _is_printed_boundary(self, li, ti):
        """True when token `ti` of line `li` is the printed endpoint the
        phonology appended as an unread boundary (`English.printed_boundary`)."""
        raw = self.stream.text_lines[li]
        ph = self.phon.for_line(raw) if hasattr(self.phon, "for_line") else self.phon
        find = getattr(ph, "printed_boundary", None)
        return find is not None and find(raw) == ti

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

    #: Candidate pairs one schema's domain may enumerate. Past it the domain
    #: is refused (`projection: none`), never sampled. Sized to the longest
    #: single English work in the Library, Whitman's "Song of Myself" (15,769
    #: words by `relations.tokenise`): n*n, the largest member product
    #: (`len(aa) * len(bb)`) a word-level domain over it can make, so no work
    #: in the corpus is refused for length (John, 2026-10-31).
    DOMAIN_CAP = 248661361

    def _domain(self, name, alt_cells=()):
        """-> WHICH OCCURRENCE PAIRS THIS SCHEMA'S LOCI CAN BIND, so a view can
        tell "does not hold" from "not examined" (design contract, BB8 O2).

        Only true and undecided edges are recorded: a False is counted, and a
        candidate the engine's bucket pruning drops is neither. The domain is
        the engine's own candidate set (`_candidate_pairs`, unpruned, in the
        order it evaluates) less every pair a placement rule refuses -- the
        one thing `evaluate` answers None for. Inside it, a pair with no
        record on an answered method is a judged False; outside it the method
        does not apply. Projected to token pairs only where every member span
        is one token; a whole figure, a multi-token span or a span with no
        referent is `projection: none` with its reason, so no cell is claimed.
        Built on the work's first-listed spans: an edge another reading
        discovers may fall outside it, and is shown by its own record."""
        RL, st = self.RL, self.stream
        schema = RL.REGISTRY[name]
        if name in RL.FULL_SHAPES or not RL.pair_scope_representable(schema):
            return {"projection": "none", "reason": "whole_figure"}
        if "stub_resolution" in schema.capabilities():
            return {"projection": "none", "reason": "derived_stream"}
        try:
            aa = list(RL.enumerate_spans(schema.spans[0], st))
            bb = aa if schema.spans[0] == schema.spans[1] else list(RL.enumerate_spans(schema.spans[1], st))
        except RL.NoReferent:
            return {"projection": "none", "reason": "no_referent"}

        def token(span):
            cells = {(st.units[i].line, st.units[i].token) for i in span.idx}
            return next(iter(cells)) if len(cells) == 1 else None
        if any(token(s) is None for s in aa) or any(token(s) is None for s in bb):
            return {"projection": "none", "reason": "multi_token_spans"}
        if len(aa) * len(bb) > self.DOMAIN_CAP:
            return {"projection": "none", "reason": "domain_cap", "cap": self.DOMAIN_CAP}
        layout = [(a, (bb,)) for a in aa]
        cells = set()
        for n, (a, b, _) in enumerate(RL._candidate_pairs(schema, layout, st, {s.idx for s in aa},
                                                           {s.idx for s in bb}, None)):
            if n % 4096 == 4095:
                _resource_guard("relation domain")
            if any(p.holds(a, b, st) is False for p in schema.placement):
                continue
            ta, tb = token(a), token(b)
            if ta != tb:
                # In the order the engine asks it (role a, role b). Equal
                # span rules do not make a predicate symmetric (a required
                # overhang, PresentVsAbsent), and the engine asks each pair
                # of a mirrored rule once, in this order: the reverse
                # question is never asked, so it is never claimed (3PO, #641).
                cells.add((ta, tb))
        # Pairs only another reading binds (`_alternate_edges`), as judged.
        cells.update((tuple(a), tuple(b)) for a, b in alt_cells)
        dependent = set(self._reading_dependent(schema, aa, bb))
        searched = not self._any_reading_off and self._varies(schema)
        if not searched:
            # Readings not searched (a scope `_varies` keeps first-listed, or
            # a work with sound declarations): a disputed word's missing
            # record is only its first reading's False (3PO, #646).
            dependent |= {t for pair in cells for t in pair if t in self._disputed}
        return {**self._project(cells, "role_ordered"), "reading_policy": self._reading_policy(searched),
                "reading_dependent_tokens": [self._token_id(t) for t in sorted(dependent)]}

    def _reading_policy(self, searched):
        """What a cell's absence quantifies over: every compatible whole
        reading, or the first-listed reading of a disputed word only."""
        return "exists_compatible_reading" if searched else "first_listed_reading"

    def _token_id(self, tok):
        return f"{self._line_id(tok[0])}:token:{tok[1]}"

    def _project(self, cells, ordering):
        """{(line, token) pairs} -> the exact token-pair projection: tokens,
        and each token's partners as [first, last] index runs."""
        ids = sorted({t for pair in cells for t in pair})
        index = {t: i for i, t in enumerate(ids)}
        rows = {}
        for ta, tb in sorted(cells):
            rows.setdefault(index[ta], []).append(index[tb])
        # Partners as [first, last] runs: a same-line or whole-song locus is
        # a few runs per row, not one entry per pair.
        runs = {}
        for i, partners in rows.items():
            out = []
            for j in sorted(partners):
                if out and out[-1][1] == j - 1:
                    out[-1][1] = j
                else:
                    out.append([j, j])
            runs[str(i)] = out
        return {"projection": "exact_token_pair", "ordering": ordering,
                "tokens": [self._token_id(t) for t in ids], "pairs": runs, "pair_count": len(cells)}

    def _reading_dependent(self, schema, aa, bb):
        """-> {(line, token)} whose membership in this schema's loci changes
        with its reading: a disputed word whose other syllable count brings a
        locus in or out, or a merged word whose readings disagree on stress,
        so its anchor -- and with it the span -- exists under some readings
        only (3PO, #641). Each such word's line is rebuilt under every reading
        of it alone; a word is reading-dependent when any reading's spans
        cover it under a role the work's spans do not, or the reverse, or
        when its line cannot be rebuilt. A cell touching one is neither a
        judged False nor outside the method: its own record, if any, is all
        that answers for it."""
        RL = self.RL
        rules = (schema.spans[0], schema.spans[1])

        def covered(st, rule, base):
            try:
                spans = base if base is not None else list(RL.enumerate_spans(rule, st))
            except RL.NoReferent:
                return set()
            return {(st.units[i].line, st.units[i].token) for span in spans for i in span.idx}
        work = [covered(self.stream, rule, base) for rule, base in zip(rules, (aa, bb))]
        out = set()
        for tok in sorted(self._disputed | self._merged):
            combos, _ = RL.reading_combos(self.stream, {tok}, self.EDGE_COMBOS)
            for combo in combos or ():
                alt = self._line_stream([tok[0]], combo)
                if alt is None or any((tok in covered(alt, rule, None)) != (tok in base)
                                      for rule, base in zip(rules, work)):
                    out.add(tok)
                    break
        return out

    # -- Shared sound (`namespace: "shared_sound"`; #637) -------------------
    #: Occurrence pairs one shared-sound method judges at most. Past it the
    #: method is refused, never answered over the pairs it reached. Sized to
    #: the longest single English work in the Library, Whitman's "Song of
    #: Myself" (15,769 words by `relations.tokenise`): every pair of its
    #: words, n(n-1)/2, so no work in the corpus is refused for length
    #: (John, 2026-10-31).
    SOUND_PAIR_CAP = 124322796

    def _sound_spans(self, family, st):
        """-> {(line, token): [span]}: the family's own canonical spans on
        `st` (`relations.CHANNEL_READ_FAMILIES`), each within one token."""
        RL = self.RL
        try:
            spans = list(RL.enumerate_spans(RL.CHANNEL_READ_FAMILIES[family][0], st))
        except RL.NoReferent:
            return {}
        out = {}
        for span in spans:
            cells = {(st.units[i].line, st.units[i].token) for i in span.idx}
            if len(cells) == 1:
                out.setdefault(next(iter(cells)), []).append(span)
        return out

    def _sound_candidates(self, key):
        """Every unordered pair of distinct words with a span in the
        method's family, in line and token order: no locus, placement or
        identity rule narrows it, which is what keeps it from being a
        figure."""
        spans = self._sound_spans(SHARED_SOUND_METHODS[key][0], self.stream)
        toks = sorted(spans)
        missing = [] if self._any_reading_off else self._sound_unspanned(spans)
        # The cap is over every pair the method would ask, the pairs over
        # words with no span included (3PO, #646): counted before any is
        # asked, so a method past it never answers over the ones it reached.
        total = (len(toks) * (len(toks) - 1) // 2 + len(missing) * len(toks)
                 + len(missing) * (len(missing) - 1) // 2)
        if total > self.SOUND_PAIR_CAP:
            raise _Refused(self.RL.Refusal(
                shared_sound_name(key), "pair_cap",
                f"{len(toks) + len(missing)} words make {total} pairs, more than {self.SOUND_PAIR_CAP}; "
                "shared sound is not answered over the pairs it would reach before the cap", kind="capability"))
        for i, ta in enumerate(toks):
            for tb in toks[i + 1:]:
                for a in spans[ta]:
                    for b in spans[tb]:
                        yield a, b
        # A varying word with no span on the work's own reading (a merged
        # word whose readings disagree on stress) is asked about under each
        # of its whole readings, against every other word (3PO, #646).
        if missing:
            for ta in missing:
                for tb in sorted(set(toks) | set(missing)):
                    if tb != ta and (tb not in missing or ta < tb):
                        yield ("alt",) + tuple(sorted((ta, tb)))

    def _sound_unspanned(self, spans):
        """-> varying words with no span in the family on the work stream."""
        return sorted(t for t in self.stream.tokens if t in self._varying and t not in spans)

    def _sound_member(self, tok):
        """A word as a member, by the work's own syllables: what a record
        names when the span it was judged on belongs to another reading."""
        from types import SimpleNamespace
        # Its anchor is the reading's, so the member has none of its own;
        # `compared` holds the syllables and anchors as judged.
        return SimpleNamespace(idx=tuple(self.stream.tokens[tok]), anchor_pos=None, direction=None,
                               origin="word_under_reading", search_k=None)

    def _sound_alt_pair(self, key, ta, tb):
        """-> (value, record, cell): a pair over a word that has no span on
        the work's reading, judged under each whole reading of the pair's
        varying words. `value` "outside" when no reading gives both words a
        span -- the method does not apply to the pair; `cell` says whether
        the pair is inside the method's domain."""
        RL, st = self.RL, self.stream
        family = SHARED_SOUND_METHODS[key][0]
        varying = {t for t in (ta, tb) if t in self._disputed or t in self._merged}
        combos, complete = RL.reading_combos(st, varying, self.EDGE_COMBOS)
        examined, open_, located, reasons, outcomes = 0, False, False, [], []
        a, b = self._sound_member(ta), self._sound_member(tb)
        roles = {ta: ["a"], tb: ["b"]}
        # The work's own reading gives no span here: nothing was judged on it.
        under = {"basis": "no_span_on_work", "verdict": None, "assignment": self._assignment(roles, {})}
        for combo in combos or ():
            alt = self._line_stream(sorted({ta[0], tb[0]}), combo)
            if alt is None:
                open_ = True
                reasons.append("rebuild_unavailable")
                continue
            examined += 1
            found = self._sound_spans(family, alt)
            if ta not in found or tb not in found:
                outcomes.append(self._outcome(roles, combo, "outside_locus"))
                continue
            located = True
            v, r, x = self._sound_judge(key, found[ta][0], found[tb][0], alt)
            if v is True:
                whole = complete and examined == len(combos)
                search = self._outcome_search(
                    self._search("exhaustive" if whole else "partial", examined, termination="witness_found"),
                    outcomes, under)
                return True, self._sound_record(key, a, b, True, r, x, alt, self._witness(alt, varying),
                                                search, False), True
            if v is None:
                open_ = True
            outcomes.append(self._outcome(roles, combo, v))
        whole = bool(combos) and complete and examined == len(combos)
        if not combos:
            reasons.append("no_reading_combination")
        elif not complete:
            reasons.append("combination_cap")
        if not located and whole:
            return "outside", None, False
        value = None if open_ or not whole else False
        reason = next((r for r in ("combination_cap", "rebuild_unavailable", "no_reading_combination")
                       if r in reasons), None) if value is None else None
        search = self._search("unavailable" if not combos else "exhaustive" if whole else "partial",
                              examined, reason,
                              None if not combos else "combination_cap" if not complete else
                              "exhausted" if whole else "rebuild_unavailable")
        if combos:
            search = self._outcome_search(search, outcomes, under)
        if value is False:
            return False, None, True
        return None, self._sound_record(key, a, b, None, None, None, st, None, search, False), True

    def _sound_judge(self, key, a, b, st):
        """-> (value, channel record or None, (position, predicate reads) or
        None): the method's predicates on the primitive's values at its
        aligned position, on one stream -- one whole reading, or the work's
        knowledge sets."""
        RL = self.RL
        family, channel, position, present = SHARED_SOUND_METHODS[key]
        rec = RL.pair_channel_reads(st, a, b, family)
        if isinstance(rec, RL.Refusal):
            return None, None, None
        align = tuple(rec["align"])
        if position == "anchor":
            k = align.index(tuple(rec["anchors"])) if tuple(rec["anchors"]) in align else None
        else:
            k = 0 if align else None
        if k is None:
            return None, rec, None
        sa, sb = rec["syllables"][k]
        reads = {"agree": RL.AGREE(sa[channel], sb[channel])}
        if present:
            reads["both_present"] = RL.BOTH_PRESENT(sa[channel], sb[channel])
        values = [r.value for r in reads.values()]
        value = False if False in values else True if all(v is True for v in values) else None
        return value, rec, (k, reads)

    def _sound_pair(self, key, a, b):
        """-> (value, record, first_only) for one pair under rule 5: a
        confident verdict on the work stands, except that a disputed word's
        first reading cannot answer False for its others; an open one is
        judged under each whole reading of the pair's varying words, True
        with the first that holds, False once every one is judged False.
        Predicates are never combined across readings."""
        RL, st = self.RL, self.stream
        family = SHARED_SOUND_METHODS[key][0]
        tok = lambda span: (st.units[span.idx[0]].line, st.units[span.idx[0]].token)
        ta, tb = tok(a), tok(b)
        value, rec, at = self._sound_judge(key, a, b, st)
        varying = {t for t in (ta, tb) if t in self._disputed or t in self._merged}
        disputed = bool(varying & self._disputed)
        judged, witness, search, first_only = st, None, self._search("not_needed"), False
        if varying and (value is None or (value is False and disputed)):
            if self._any_reading_off:
                first_only = disputed
            else:
                combos, complete = RL.reading_combos(st, varying, self.EDGE_COMBOS)
                examined, open_, reasons, outcomes = 0, False, [], []
                roles = self._span_roles(st, a, b)
                under = self._judged_under(st, roles, value, "merged_set" if varying & self._merged else None)
                for combo in combos or ():
                    alt = self._line_stream(sorted({ta[0], tb[0]}), combo)
                    if alt is None:
                        open_ = True
                        reasons.append("rebuild_unavailable")
                        continue
                    examined += 1
                    found = self._sound_spans(family, alt)
                    if ta not in found or tb not in found:
                        # No span at the word under this reading (no stressed
                        # syllable to anchor): nothing there to share.
                        outcomes.append(self._outcome(roles, combo, "outside_locus"))
                        continue
                    v, r, x = self._sound_judge(key, found[ta][0], found[tb][0], alt)
                    if v is True:
                        whole = complete and examined == len(combos)
                        value, rec, at, judged = True, r, x, alt
                        witness = self._witness(alt, varying)
                        search = self._outcome_search(
                            self._search("exhaustive" if whole else "partial", examined,
                                         termination="witness_found"), outcomes, under)
                        break
                    if v is None:
                        open_ = True
                    outcomes.append(self._outcome(roles, combo, v))
                else:
                    # Nothing to search is not a search: no combination
                    # judged never certifies a False.
                    whole = bool(combos) and complete and examined == len(combos)
                    if not combos:
                        reasons.append("no_reading_combination")
                    elif not complete:
                        reasons.append("combination_cap")
                    if value is False and (open_ or not whole):
                        value = None
                    elif value is None and combos and whole and not open_:
                        value = False
                    reason = next((r for r in ("combination_cap", "rebuild_unavailable", "no_reading_combination")
                                   if r in reasons), None) if value is None else None
                    search = self._search("unavailable" if not combos else "exhaustive" if whole else "partial",
                                          examined, reason,
                                          None if not combos else "combination_cap" if not complete else
                                          "exhausted" if whole else "rebuild_unavailable")
                    if combos:
                        search = self._outcome_search(search, outcomes, under)
        if value is False:
            return False, None, first_only
        return value, self._sound_record(key, a, b, value, rec, at, judged, witness, search, first_only), first_only

    def _sound_record(self, key, a, b, value, rec, at, st, witness, search, first_only):
        name = shared_sound_name(key)
        family, channel, position, present = SHARED_SOUND_METHODS[key]
        work = self.stream
        text = lambda span: str(work.lexical_tokens[work.units[span.idx[0]].line][work.units[span.idx[0]].token]).lower()
        extra = {}
        if witness:
            extra["reading"] = {"rule": "any_reading", "witness": witness}
            extra["witness_assignment"] = self._assignment(
                self._span_roles(self.stream, a, b), getattr(st, "any_reading_combo", None) or {})
        if at is not None:
            k, reads = at
            sa, sb = rec["syllables"][k]
            # WHAT WAS COMPARED, AS JUDGED: the primitive's aligned syllables
            # from the stream the verdict was reached on, at the method's
            # position; never re-syllabified here.
            extra["compared"] = {"a": [json_safe(sa)], "b": [json_safe(sb)], "position": k,
                                 "aligned": json_safe(rec["align"]), "anchors": json_safe(rec["anchors"])}
            extra["predicate_reads"] = {n: json_safe(r) for n, r in reads.items()}
        if value is None:
            unknown = at is not None and any(r.value is None for r in at[1].values())
            extra["undecided_reason"] = (search.get("reason") or
                                         ("channel_unknown" if unknown else "locus_unmatched"))
        if rec is not None:
            extra["reading_context"] = json_safe(rec["reading_context"])
            extra["channel_versions"] = json_safe(rec["versions"])
        search = self._lift_outcomes(search, extra)
        return self._record("relation_instance", method_id("shared_sound", name), [a.idx, b.idx],
            namespace="shared_sound", method_name=name, layer=SHARED_SOUND_LAYER, verdict=verdict(value),
            a=self._span(a), b=self._span(b), family=family, channel=channel, position=position, **extra,
            quantifier="first_listed_reading" if first_only else "exists_compatible_reading",
            reading_search=search, same_spelling=text(a) == text(b))

    def _sound_domain(self, key, alt_cells=()):
        """Every unordered pair of distinct words with a span in the family,
        exactly the pairs the method asks, and every pair over a word with
        no span on the work's reading that some whole reading gives one
        (`alt_cells`, as judged). Every pair is judged under each reading of
        its varying words, so a missing record is a judged False. Only when
        readings are not searched (a work with sound declarations) is a
        word with no span reading-dependent: a cell touching one is
        answered only by its own record."""
        family = SHARED_SOUND_METHODS[key][0]
        toks = sorted(self._sound_spans(family, self.stream))
        if len(toks) * (len(toks) - 1) // 2 > self.DOMAIN_CAP:
            return {"projection": "none", "reason": "domain_cap", "cap": self.DOMAIN_CAP}
        cells = {(x, y) for i, x in enumerate(toks) for y in toks[i + 1:]}
        cells.update((tuple(x), tuple(y)) for x, y in alt_cells)
        dependent = []
        if self._any_reading_off:
            # First-listed readings only: a word with no span was never
            # asked, and a disputed word's missing record is its first
            # reading's False alone (3PO, #646).
            dependent = sorted(set(self._sound_unspanned(set(toks))) | {t for t in toks if t in self._disputed})
        return {**self._project(cells, "unordered"),
                "reading_policy": self._reading_policy(not self._any_reading_off),
                "reading_dependent_tokens": [self._token_id(t) for t in dependent]}

    def _sound_result(self, key, mid, counts):
        if self.stream.unreadable and counts["coverage"] == "answered":
            counts["coverage"] = "refused"
            counts["unreadable_tokens"] = len(self.stream.unreadable)
            counts["refusal"] = {"kind": "unknown_members", "capability": "native_reading", "missing": [], "vacuous": [],
                "detail": "Unread lexical members remain in the source census. Findings over readable members do not answer those obligations."}
        return self._record("method_result", mid, "result", namespace="shared_sound",
                            method_name=shared_sound_name(key), layer=SHARED_SOUND_LAYER,
                            coverage=counts["coverage"], counts=counts,
                            domain=self._sound_domain(key, counts.pop("alt_cells", []))
                            if counts["coverage"] == "answered"
                            else {"projection": "none", "reason": "refused"},
                            refusal=counts.get("refusal"),
                            availability="available" if counts["coverage"] == "answered" else "unknown_members")

    def _sound_refusal(self, key, refusal):
        return self._record("method_result", method_id("shared_sound", shared_sound_name(key)), "result",
                            coverage="refused", verdict="undecided", namespace="shared_sound",
                            method_name=shared_sound_name(key), layer=SHARED_SOUND_LAYER,
                            domain={"projection": "none", "reason": "refused"}, refusal=json_safe(refusal),
                            counts={"true": 0, "false": 0, "undecided": 0}, availability="unsupported")

    def _undecided_reason(self, inst, search):
        """-> why an edge stayed undecided, most specific first: the search's
        own reason (the cap, a rebuild or locus it could not make, readings
        its scope keeps first-listed), else what the judge could not read --
        a placement, an identity resource, or a channel (`unknown_channels`
        names which)."""
        if search.get("reason"):
            return search["reason"]
        if any(v is None for _, v in inst.placement_reads):
            return "placement_unknown"
        if any(r.value is None for _, r in inst.identity_reads):
            return "identity_unknown"
        if inst.unknown_channels:
            return "channel_unknown"
        return "judge_unknown"

    def _edge_record(self, inst, st, witness=None, search=None, first_only=False):
        RL = self.RL
        mid = method_id("schema", inst.schema)
        a, b = self._span(inst.a, st), self._span(inst.b, st)
        key = [inst.a.origin, inst.a.idx, inst.b.origin, inst.b.idx]
        extra = {}
        if st is not self.stream and st is not self._schema_stream:
            # Judged under another reading: its syllables are that stream's.
            # The record names the work's own syllables -- one for one where
            # the word's reading did not change, the whole word where it did
            # -- and its id is built from those, so it does not depend on
            # which reading held.
            ids = []
            for side, span in ((a, inst.a), (b, inst.b)):
                work = []
                for i in span.idx:
                    u = st.units[i]
                    tok = (u.line, u.token)
                    got = (self.stream.tokens.get(tok, ()) if tok in self._disputed
                           else (self._work_unit.get((u.line, u.token, u.tok_syl)),))
                    work.extend(j for j in got if j is not None and j not in work)
                side["unit_ids"] = [f"syllable:{j}" for j in work]
                ids.append(tuple(work))
            key = [self._origin(inst.a, st), ids[0], self._origin(inst.b, st), ids[1]]
            extra["reading"] = {"rule": "any_reading", "witness": witness or []}
        elif witness:
            extra["reading"] = {"rule": "any_reading", "witness": witness}
        if witness:
            # Beside `reading`, which keeps its agreed shape.
            extra["witness_assignment"] = self._assignment(
                self._span_roles(st, inst.a, inst.b), getattr(st, "any_reading_combo", None) or {})
        search = self._lift_outcomes(search or self._search("not_needed"), extra)
        if inst.verdict is None:
            extra["undecided_reason"] = self._undecided_reason(inst, search)
        return self._record("relation_instance", mid, key,
            namespace="schema", schema_name=inst.schema, verdict=verdict(inst.verdict),
            a=a, b=b, **extra, alignment=json_safe(inst.alignment),
            # WHAT WAS COMPARED, AS JUDGED: each member's syllables in the
            # stream the verdict was reached on -- the witness reading's
            # syllables when another reading held, the work's knowledge sets
            # otherwise (a merged word shows every reading it may take).
            compared={"a": [json_safe(st.units[i].syl) for i in inst.a.idx],
                      "b": [json_safe(st.units[i].syl) for i in inst.b.idx]},
            # Rule 5 quantifies over whole readings; a scope `_varies` keeps
            # on first-listed readings says so on the edge, not only in a
            # method count.
            quantifier="first_listed_reading" if first_only else "exists_compatible_reading",
            reading_search=search,
            channel_reads=json_safe(inst.reads), placement_reads=json_safe(inst.placement_reads),
            identity_reads=json_safe(inst.identity_reads), unknown_channels=json_safe(inst.unknown_channels),
            informative_channels=list(inst.informative), scope=RL.tradition_scope(RL.schema_named(inst.schema), self.language),
            engine_edge=json_safe(inst))

    def _refusal(self, name, refusal):
        mid = method_id("schema", name) if name in self.RL.REGISTRY else name
        return self._record("method_result", mid, "result", coverage="refused", verdict="undecided",
                            namespace="schema" if name in self.RL.REGISTRY else "native", schema_name=name,
                            domain={"projection": "none", "reason": "refused"},
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
        seen = set()
        for a, b, reverse in RL._candidate_pairs(schema, layout, st, akeys, bkeys, None, prune=True):
            # Only a pair over a disputed word is ever looked up again (every
            # alternate pair has a member over one); the rest stay unkept, or
            # the set holds every candidate pair of the work.
            if self._disputed and self._touched(st, a, b):
                seen.add((self._span_key(a, st), self._span_key(b, st)))
            yield "edge", (a, b)
        yield from self._alternate_edges(name, schema, seen)

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
            if self._is_printed_boundary(li, ti):
                # The printed endpoint the stream appended as a boundary is no
                # token of the line's cut (D14): never read, and no reading can
                # be declared for it.
                from quality.phonology import UNREADABLE
                out["reading_status"] = UNREADABLE
                out["reading_note"] = ("the line's printed end is not one of its English "
                                       "tokens; it stays an unread boundary")
                return out
            if hasattr(self.phon, "reading_status"):
                ph = self.phon.for_line(self.stream.text_lines[li]) if hasattr(self.phon, "for_line") else self.phon
                ph = ph.for_token(ti) if hasattr(ph, "for_token") else ph
                out["reading_status"], out["reading_note"] = ph.reading_status(word)
            if self.language == "eng":
                import lyric_harness as LH
                lex = self.phon._lexicon()
                options = sorted({tuple(p) for p in lex.entries.get(word.lower(), ())})
                from quality.pronunciation import numbering_of
                # `numbering` names the cut and voices setting `token` was
                # counted under, as a pronunciation row's own marker does.
                out["reading_choices"] = {"line": raw_line if (raw_line := self.stream.text_lines[li]) else "",
                    "token": ti + 1, "word": word, "numbering": numbering_of(lex),
                    "dictionary_readings": [{"phones": list(p), "syllables": len(LH.syllabify(p)),
                                              "stress": [s["stress"] for s in LH.syllabify(p)]} for p in options],
                    "requires_source": True, "supplied_reading_requires_source": not bool(options),
                    "matching_line_ids": [self._line_id(i) for i, line in enumerate(self.stream.text_lines) if line == raw_line]}
                out.update(self._applicable_readings(li, ti))
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
        boundary = [li for li in (la, lb)
                    if self._is_printed_boundary(li, len(self.stream.lexical_tokens[li]) - 1)]
        result = self.phon.relations(a, b)
        coord = None
        reason = None
        if boundary:
            # A printed boundary is never read (D14): no predicate, no type.
            result = {k: None for k in result}
            reason = ("the printed end of line(s) " + ", ".join(str(li + 1) for li in boundary)
                      + " is not one of its English tokens; it stays an unread boundary")
        else:
            try:
                coord = RT.classify_pair(a, b, self.phon, member_phons=(pa, pb))
            except (ValueError, RT.Indeterminate, self.RL.NoReferent) as exc:
                reason = str(exc)
        out = self._record("native_pair", mid, [la, lb], namespace="native",
                           language=self.language, line_ids=[self._line_id(la), self._line_id(lb)],
                           words=[a, b], predicates={k: verdict(v) for k, v in result.items()},
                           coverage="answered" if result and all(v is not None for v in result.values()) else "refused",
                           reason=reason if result or boundary else "No native rhyme predicate is supplied by this profile.")
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
        if phase == "shared_sound":
            return iter(self._sound_candidates(name))
        from .form import analyze_form, analyze_language
        result = analyze_form(self.source, self.declarations) if phase == "form" else analyze_language(self.source, self.declarations)
        return iter(self._component_records(phase, result))

    def _task_mid(self, phase, name):
        if phase in ("schema", "assembly"):
            return method_id("schema", name)
        if phase in ("native_work", "native_pairs"):
            return method_id("native", name)
        if phase == "shared_sound":
            return method_id("shared_sound", shared_sound_name(name))
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
            if value is None:
                # Assembled from committed edges, which carry their own
                # reasons; the figure says only that some member is open.
                record["undecided_reason"] = "member_edges_undecided"
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
        # A schema refusal already emitted this method's terminal result.
        # Assembly skips refused schemas; its empty iterator must not finish
        # them a second time, including after a checkpoint restart.
        if phase == "assembly" and name in cp.get("refused_schemas", []):
            self._local_records.pop(mid, None)
            return []
        counts["coverage"] = "refused" if counts.get("refused_questions") else counts.get("coverage", "answered")
        if phase == "shared_sound":
            return [self._sound_result(name, mid, counts)]
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
            elif name in self._incomplete:
                counts["coverage"] = "refused"
                counts["refusal"] = {"kind": "reading_combinations", "capability": "any_reading", "missing": [], "vacuous": [],
                    "detail": "Not every combination of the disputed words' readings was searched: " + self._incomplete[name]
                              + ". Findings over the combinations searched do not answer the rest."}
            rows.append(self._record("method_result", mid, "result", namespace="schema", schema_name=name,
                                    coverage=counts["coverage"], counts=counts,
                                    domain=self._domain(name, counts.pop("alt_cells", [])) if phase == "schema"
                                    else {"projection": "none", "reason": "whole_figure"},
                                    refusal=counts.get("refusal"), availability="available" if counts["coverage"] == "answered" else "unknown_members",
                                    supply={c: json_safe(self.stream.supply(c))
                                                                       for c in RL.REGISTRY[name].capabilities()}))
        if not needs_assembly:
            self._local_records.pop(mid, None)
        return rows

    def _figure_record(self, name, frame, edges, value):
        rows = [self._figure_edge(e, self._schema_stream or self.stream) for e in edges]
        extra = {}
        if value is None:
            # An open figure names why, as an open edge does: the first
            # reason its own open members give, else the judge's.
            extra["undecided_reason"] = next((r["undecided_reason"] for r in rows if "undecided_reason" in r),
                                             "judge_unknown")
        return self._record("relation_figure", method_id("schema", name),
                            [frame, [(e.a.idx, e.b.idx) for e in edges], getattr(edges, "members", ())],
                            namespace="schema", schema_name=name, frame=json_safe(frame),
                            verdict=verdict(value), member_lines=list(getattr(edges, "members", ())),
                            edges=rows, **extra)

    def _figure_edge(self, e, st):
        """A whole figure's member edge. Whole figures keep first-listed
        readings (`_varies`), so an edge over a disputed word says so, and an
        open edge over a merged word names the readings left unsearched."""
        first_only = bool(self._touched(st, e.a, e.b))
        unsearched = e.verdict is None and (first_only or self._merged_touched(st, e.a, e.b))
        search = (self._search("unavailable", reason="readings_not_searched_in_scope")
                  if first_only or unsearched else self._search("not_needed"))
        return self._edge_record(e, st, search=search, first_only=first_only)

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
        delta = {"candidates": 0, "true": 0, "false": 0, "undecided": 0, "refused_questions": 0,
                 # Verdicts over a disputed word that only its first-listed
                 # reading judged (owner ruling 2026-10-23): kept answered,
                 # and counted so the limit is visible.
                 "first_reading_only": 0}
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
                (la, _), (lb, _) = binding
                delta["first_reading_only"] += any(
                    (li, len(self.stream.lexical_tokens[li]) - 1) in self._disputed for li in (la, lb))
            elif phase == "native_work":
                new = [self._native_measure(*binding)]
            elif phase == "schema":
                kind, value = binding
                if kind in ("edge", "alt_edge"):
                    a, b, found = value if kind == "alt_edge" else (*value, self._schema_stream)
                    inst, judged, witness, first_only, search = self._any_reading(name, a, b, found)
                    if inst is not None and kind == "alt_edge":
                        # A pair only another reading binds is inside the
                        # method's loci too: the domain must not call it
                        # outside (3PO, #641). Kept with the method's counts
                        # so a resumed traversal keeps it.
                        cells = [sorted({(found.units[i].line, found.units[i].token) for i in m.idx})
                                 for m in (a, b)]
                        if all(len(c) == 1 for c in cells) and cells[0] != cells[1]:
                            delta["alt_cells"] = delta.get("alt_cells", []) + [[list(cells[0][0]), list(cells[1][0])]]
                    if inst is not None:
                        delta[verdict(inst.verdict)] += 1
                        delta["first_reading_only"] += first_only
                        if inst.verdict is not False:
                            record = self._edge_record(inst, judged, witness, search, first_only)
                            new.append(record)
                            if not RL.pair_scope_representable(RL.REGISTRY[name]):
                                self._local_records.setdefault(self._task_mid(phase, name), []).append(record)
                else:
                    shapes = self._shape(name, kind, value)
                    if isinstance(shapes, RL.Refusal):
                        raise _Refused(shapes)
                    first_only = self._shape_first_only(kind, value)
                    for frame, edges, v in shapes:
                        delta[verdict(v)] += 1
                        delta["first_reading_only"] += first_only
                        new.append(self._figure_record(name, frame, edges, v))
            elif phase == "shared_sound":
                if binding[0] == "alt":
                    value, record, cell = self._sound_alt_pair(name, *binding[1:])
                    first_only = 0
                    if cell:
                        # Kept with the method's counts, so a resumed
                        # traversal keeps it.
                        delta["alt_cells"] = delta.get("alt_cells", []) + [[list(binding[1]), list(binding[2])]]
                else:
                    value, record, first_only = self._sound_pair(name, *binding)
                if value != "outside":
                    delta[verdict(value)] += 1
                    delta["first_reading_only"] += first_only
                    if value is not False:
                        new.append(record)
            else:
                new = [binding]
            delta["candidates"] = 1
            delta["refused_questions"] = sum(row.get("coverage") == "refused" for row in new)
        except StopIteration:
            new, action = self._finish(phase, name), "advance"
        except _Refused as exc:
            counts["coverage"] = "refused"
            counts["refusal"] = json_safe(exc.refusal)
            if phase == "schema" and name not in cp.setdefault("refused_schemas", []):
                cp["refused_schemas"].append(name)
            new, action = [self._sound_refusal(name, exc.refusal) if phase == "shared_sound"
                           else self._refusal(name, exc.refusal)], "advance"
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
                        counts[key] = counts.get(key, [] if isinstance(value, list) else 0) + value
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
