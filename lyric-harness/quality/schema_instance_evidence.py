"""Bounded report-only instance serialization; never checkpoint/replay state.

This is a census of pair-local registry instances on the grade's reading basis,
not a restatement of mandate satisfaction or an all-figures verdict. Report-time
recomputation deliberately does not consume reduced schema-name memo answers.
"""
import hashlib
import time
from pathlib import Path

from library.analysis import AnalysisSession
from library.contracts import canonical_json, digest, json_safe, range_pair
from quality import relations as RL

MAX_RECORDS = 256
MAX_BYTES = 262144
#: ~~4096~~ -> None, 2026-10-27 (end-of-day plan, #519 6448819660: lift the
#: rhyme-type counter caps so long songs get a full count). A song past
#: about 90 lines exceeded 4096 candidate pairs and 15 types reported no
#: count at all (`candidate_limit`). Every type is now counted uncapped.
#: RECORDS and BYTES stay bounded: they size the inline report, not the
#: count.
MAX_CANDIDATES_PER_SCHEMA = None
#: THE TIME GUARD THAT REPLACES THE CAP. Uncapped, a 104-line fixed-seed
#: draw took 189 s (4.8 s capped), inside a tool's 10-minute limit; the cost
#: grows with the song. Types are counted in turn, and this is checked
#: BEFORE each type: once the budget has passed, every type not yet started
#: is reported by name with reason `time_budget` and the coverage says the
#: count is incomplete. It is not a hard runtime limit: a type already
#: started is counted and serialized to the end, so a call can run past it
#: by that one type's time (#519 finding d). Nothing is capped silently.
COUNT_TIME_BUDGET_S = 300
#: How many admissible (not False) instances of one type the census holds
#: while it counts the rest, so it can admit them once that type's counts are
#: final. Past this, the type is enumerated a second time instead
#: (`from_stream`). 2,243 was the most any type had on the capacity matrix's
#: 31-line draft (2026-10-28, #519).
MAX_PENDING_INSTANCES = 4096


class _Serializer(AnalysisSession):
    """Reuse source projection/edge serialization without a reader job or cursor."""
    def __init__(self, stream, phon, identity):
        self.RL, self.stream, self.phon = RL, stream, phon
        self.language = stream.declaration.get("language", "und")
        self.identity = identity
        self.text = "\n".join(stream.text_lines)
        self._token_projection_cache = {}
        self.stream_rows = []
        start = 0
        for i, line in enumerate(stream.text_lines):
            rg = range_pair(self.text, start, start + len(line))
            self.stream_rows.append({"id": f"line:{i}", "text": line,
                "physical_line": i + 1, "normalized_cp_range": rg["codepoint_range"],
                "source_ranges": [{**rg, "precision": "exact", "physical_line": i + 1}]})
            start += len(line) + 1


def _report_bytes(result, record_bytes):
    """Exact canonical UTF-8 size with already measured, detached records.

    Coverage changes while enumerating candidates, so serialize its envelope
    afresh. _Serializer._record recursively detaches every admitted record;
    their bytes cannot change as later methods and omission counts advance.
    The empty array's brackets are in the envelope; only commas are additional.
    """
    envelope = {**result, "records": []}
    return (len(canonical_json(envelope).encode("utf-8")) + record_bytes
            + max(0, len(result["records"]) - 1))


def from_stream(stream, phon, *, declarations, provenance, schemas=None,
                max_records=MAX_RECORDS, max_bytes=MAX_BYTES,
                max_candidates=MAX_CANDIDATES_PER_SCHEMA,
                time_budget_s=None, clock=time.monotonic):
    """Serialize actual instances; all limits apply only to this report census.

    False instances are counted but not emitted. Whole figures and alternative
    reading witness searches are outside this bounded census, explicitly named.
    It must never be used as a new verdict on the grade's obligations.
    """
    if max_bytes < 1024 or max_records < 0 or (
            max_candidates is not None and max_candidates < 0):
        raise ValueError("invalid report evidence limits")
    text = "\n".join(stream.text_lines)
    names = sorted(RL.REGISTRY if schemas is None else set(schemas))
    if set(names) - set(RL.REGISTRY):
        raise ValueError("unknown report schema")
    identity = {"version": 1, "source_sha256": hashlib.sha256(text.encode()).hexdigest(),
        "declaration_hash": digest(declarations), "declarations": json_safe(declarations),
        "provenance": json_safe(provenance),
        # Stable semantic digest, not relations._stream_digest's process-local id.
        "stream_hash": digest({"units": stream.units, "tokens": stream.lexical_tokens,
            "unreadable": stream.unreadable, "frames": stream.frames,
            "declaration": stream.declaration})}
    identity["hash"] = digest(identity)
    requested = [n for n in names if RL.pair_scope_representable(RL.REGISTRY[n])]
    excluded = [n for n in names if n not in requested]
    result = {"version": 1, "identity": identity, "source_text": text,
        "population": {"scope": "pair_local_registry_instances", "requested_schemas": requested,
            "excluded_schemas": excluded, "excluded_reason": "whole_figure_requires_assembly",
            "not_requested_schemas": sorted(set(RL.REGISTRY) - set(names)),
            "emitted_verdicts": ["true", "undecided"],
            "reading_scope": "graded_stream_readings_without_alternative_witness_search",
            "mandate_satisfaction": False},
        "coverage": {"complete": False, "status": "partial", "methods": [],
            "omitted_records": 0, "remaining_records_unknown": False},
        "limits": {"records": max_records, "bytes": max_bytes,
                   "candidates_per_schema": max_candidates,
                   "count_time_budget_s": (COUNT_TIME_BUDGET_S if time_budget_s is None
                                           else time_budget_s)}, "records": []}
    serializer = _Serializer(stream, phon, identity)
    cov = result["coverage"]
    record_bytes = 0
    # Reserve room for the small per-method coverage records. Never detach data
    # into pages: this report has no evidence retrieval endpoint.
    budget = COUNT_TIME_BUDGET_S if time_budget_s is None else time_budget_s
    started = clock()
    for name in requested:
        method = {"schema_name": name, "status": "answered", "counts": {}, "emitted": 0}
        cov["methods"].append(method)
        if clock() - started > budget:
            method.update(status="partial", reason="time_budget")
            cov["remaining_records_unknown"] = True
            continue
        counts = {"true": 0, "false": 0, "undecided": 0}
        pending, overflow = [], [False]

        def take(inst, counts=counts, pending=pending, overflow=overflow):
            # COUNT EVERY INSTANCE, HOLD ONLY THE FEW THAT ARE ADMISSIBLE
            # (2026-10-28, #519). Collecting the whole population held
            # 297,102 instances of one type on a 31-line draft and took the
            # grade past its 2 GiB envelope; 2,243 of them were not False.
            counts["true" if inst.verdict is True else
                   "false" if inst.verdict is False else "undecided"] += 1
            if inst.verdict is not False and not overflow[0]:
                if len(pending) < MAX_PENDING_INSTANCES:
                    pending.append(inst)
                else:
                    overflow[0] = True
                    pending.clear()

        def admit(inst, method=method):
            # Admission exactly as before streaming: this type's FINAL counts
            # are already in the envelope that `_report_bytes` sizes, so the
            # byte limit admits the same records (#519 6459690813).
            nonlocal record_bytes
            if inst.verdict is False:
                return
            if len(result["records"]) >= max_records:
                cov["omitted_records"] += 1
                method.update(status="partial", reason="record_limit")
                return
            record = serializer._edge_record(inst, stream)
            # The fields above already serialize the instance. Avoid duplicating
            # that entire structure as engine_edge in this bounded inline report.
            record.pop("engine_edge", None)
            candidate_bytes = len(canonical_json(record).encode("utf-8"))
            result["records"].append(record)
            if _report_bytes(result, record_bytes + candidate_bytes) > max_bytes - 32768:
                result["records"].pop()
                cov["omitted_records"] += 1
                method.update(status="partial", reason="byte_limit")
                return
            record_bytes += candidate_bytes
            method["emitted"] += 1
        try:
            got = RL.realise(RL.REGISTRY[name], stream, keep="all",
                             max_pairs=max_candidates, sink=take)
        except RuntimeError as exc:
            if str(exc) != "candidate explosion; tighten the schema":
                raise
            method.update(status="partial", reason="candidate_limit")
            cov["remaining_records_unknown"] = True
            continue
        if isinstance(got, RL.Refusal):
            method.update(status="refused", refusal=json_safe(got))
            cov["remaining_records_unknown"] = True
            continue
        for inst in got:
            # `realise` with a sink returns []; a stand-in that returns its
            # instances is consumed the same way.
            take(inst)
        method["counts"] = counts
        if not overflow[0]:
            for inst in pending:
                admit(inst)
        else:
            # More admissible instances than are held: enumerate the type a
            # second time, now that its counts are known, admitting in the
            # same order. Exact, and still one instance at a time.
            RL.realise(RL.REGISTRY[name], stream, keep=("true", "none"),
                       max_pairs=max_candidates, sink=admit)
        pending.clear()
    cov["complete"] = bool(requested) and all(m["status"] == "answered" for m in cov["methods"])
    cov["status"] = ("not_requested" if not requested else
                     "complete" if cov["complete"] else "partial")
    cov["observed_records"] = len(result["records"]) + cov["omitted_records"]
    cov["loaded_records"] = len(result["records"])
    cov["total_records"] = (None if cov["remaining_records_unknown"] else
                            len(result["records"]) + cov["omitted_records"])
    # Large input/declaration envelopes can exceed the budget before any edge.
    # Return a small unavailable receipt instead of silently cutting its identity.
    if len(canonical_json(result).encode()) > max_bytes:
        return {"version": 1, "identity": {"hash": identity["hash"],
                "source_sha256": identity["source_sha256"]},
            "coverage": {"complete": False, "status": "unavailable", "reason": "envelope_byte_limit",
                         "loaded_records": 0, "total_records": None},
            "limits": result["limits"], "records": []}
    return result


def _for_grade(rv, lines, mandate, *, blueprint=None, provenance=None):
    """Recompute the whole-vocabulary grade stream at report time, not on trials.

    Same phonology (including voices, reader scheme and selected readings),
    sections/stanzas and declared rhyme-bearing subset as Reviser.inspect/grade.
    No cache key, cache value, checkpoint dataclass or journal is extended.
    """
    from quality import grid
    sections = None
    if blueprint is not None:
        try:
            song, _ = grid.song_from_blueprint(blueprint)
            sections = [row.section for row in song.lines][:len(lines)]
            if len(sections) < len(lines):
                sections = None
        except Exception:
            sections = None  # exactly inspect's absent-frame behavior
    phon = rv._relation_phonology()
    stream = RL.build_stream(lines, phon, sections=sections,
        stanzas=RL.stanzas_from_sections(sections),
        stanza_source="declared_sections" if sections else "",
        declaration={"language": "eng"})
    bearing = sorted({ln - 1 for group in mandate.groups for ln in group if 1 <= ln <= len(lines)})
    if bearing:
        RL.mark_refrain_tail(stream, lines=bearing)
    from quality.song_profile_calibration import comparator_fingerprint
    basis = dict(provenance or {})
    basis["comparator_fingerprint"] = comparator_fingerprint()
    basis["implementation"] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
        for p in (Path(__file__), Path(RL.__file__), Path(__file__).parents[1] / "library" / "analysis.py")}
    return from_stream(stream, phon,
        declarations={"mandate": mandate, "comparator": rv.decl, "sections": sections,
                      "bearing": bearing, "phonology": phon.declaration()},
        provenance=basis)


def for_grade(rv, lines, mandate, *, blueprint=None, provenance=None):
    """Reporting failure never changes a successful grade or its exit status."""
    try:
        return _for_grade(rv, lines, mandate, blueprint=blueprint, provenance=provenance)
    except Exception as exc:
        return {"version": 1, "identity": {
                    "source_sha256": hashlib.sha256("\n".join(lines).encode()).hexdigest()},
                "coverage": {"complete": False, "status": "unavailable",
                    "reason": "report_extraction_failed", "error_type": type(exc).__name__,
                    "loaded_records": 0, "total_records": None}, "records": []}
