"""JSON contracts for deterministic, read-only Library interpretation.

Coordinates are zero based and half open. Displayed lyric/token numbers remain
one based only at the adapters to the existing engines. A knowledge set is not
an ordered consonant cluster, and an unavailable number is never serialized as
NaN or as a made-up zero.
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import math
from fractions import Fraction
from typing import Any, Literal, TypedDict

CONTRACT_VERSION = 1
Verdict = Literal["true", "false", "undecided"]
Presence = Literal["absent", "empty", "present"]
Coverage = Literal["answered", "refused", "not_requested"]


class CoordinateRange(TypedDict, total=False):
    codepoint_range: list[int]
    utf16_range: list[int]
    byte_range: list[int]
    physical_line: int
    precision: Literal["exact", "span", "row", "token"]


class EvidenceRecord(TypedDict, total=False):
    id: str
    kind: str
    namespace: str
    method_id: str
    line_ids: list[str]
    verdict: Verdict
    coverage: Coverage
    basis: str
    source_ranges: list[CoordinateRange]
    detail: str


class ReaderCheckpoint(TypedDict):
    contract_version: int
    identity_hash: str
    phase: str
    method_index: int
    candidate: int
    sequence: int
    counters: dict[str, int]
    methods: dict[str, Any]
    emission: int
    done: bool


def verdict(value: bool | None) -> Verdict:
    return "true" if value is True else "false" if value is False else "undecided"


def json_safe(value: Any) -> Any:
    """Lossless ordered clusters; explicitly tagged alternative knowledge."""
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: json_safe(getattr(value, f.name))
                for f in dataclasses.fields(value)}
    if isinstance(value, Fraction):
        return {"numerator": value.numerator, "denominator": value.denominator}
    if isinstance(value, frozenset):
        return {"kind": "readings", "values": [json_safe(v) for v in
                                                sorted(value, key=repr)]}
    if isinstance(value, set):
        return [json_safe(v) for v in sorted(value, key=repr)]
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError(f"not a reader contract value: {type(value).__name__}")


def canonical_json(value: Any) -> str:
    return json.dumps(json_safe(value), sort_keys=True, ensure_ascii=False,
                      separators=(",", ":"), allow_nan=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def method_id(namespace: str, name: str) -> str:
    return namespace + ":" + hashlib.sha256(name.encode("utf-8")).hexdigest()[:24]


def utf16_offset(text: str, codepoint_offset: int) -> int:
    if not 0 <= codepoint_offset <= len(text):
        raise ValueError("codepoint offset is outside the text")
    return len(text[:codepoint_offset].encode("utf-16-le")) // 2


def range_pair(text: str, start: int, end: int) -> dict[str, list[int]]:
    if not 0 <= start <= end <= len(text):
        raise ValueError("invalid half-open text range")
    return {"codepoint_range": [start, end],
            "utf16_range": [utf16_offset(text, start), utf16_offset(text, end)]}


def semantic_declarations(value: Any) -> Any:
    """Remove private provenance prose from the shared semantic cache key.

    Keep the fact that a source was supplied: a declared-empty frame and an
    absent frame are different questions. Actual prose stays on the caller's
    private declaration sidecar, not in a shared source-default result.
    """
    if isinstance(value, dict):
        return {str(k): (bool(v) if k in ("source", "provenance", "citation")
                        else semantic_declarations(v))
                for k, v in value.items() if k not in ("viewer_id", "user_id")}
    if isinstance(value, (tuple, list)):
        return [semantic_declarations(v) for v in value]
    return json_safe(value)


def semantic_identity(source: dict, declarations: dict, requested: Any,
                      runtime: dict | None = None, supplied: dict | None = None) -> dict:
    text = source.get("normalized_text", source.get("text", ""))
    identity = {"contract_version": CONTRACT_VERSION,
                "reading_unit_id": source.get("reading_unit_id"),
                "reading_revision": source.get("reading_revision"),
                "source_sha256": source.get("source_sha256"),
                "normalized_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
                "source_map_hash": digest(source.get("source_map", source.get("lines", []))),
                "language": declarations.get("language", source.get("language")),
                "declaration_hash": digest(semantic_declarations(declarations)),
                "requested": json_safe(requested), "runtime": json_safe(runtime or {})}
    supplied = supplied or {}
    for key in ("reading_unit_id", "reading_revision", "source_sha256", "normalized_sha256"):
        if supplied.get(key) is not None and identity.get(key) != supplied[key]:
            raise ValueError(f"STALE_READING: supplied {key} does not match the registered reading")
    identity["catalog"] = {k: supplied[k] for k in
                           ("snapshot_id", "work_id", "edition_id", "engine_commit",
                            "parser_version", "normalizer_version") if k in supplied}
    identity["hash"] = digest(identity)
    return identity


RESULT_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://codexmusica.com/api/library/reader-result.schema.json",
    "title": "Codex Musica Library reader step",
    "type": "object", "required": ["identity", "checkpoint", "records", "done", "summary", "provider_calls"],
    "properties": {
        "identity": {"$ref": "#/$defs/identity"},
        "checkpoint": {"$ref": "#/$defs/checkpoint"},
        "records": {"type": "array", "items": {"$ref": "#/$defs/evidence"}},
        "done": {"type": "boolean"}, "provider_calls": {"const": 0},
        "summary": {"$ref": "#/$defs/summary"},
    },
    "$defs": {
        "verdict": {"enum": ["true", "false", "undecided"]},
        "presence": {"enum": ["absent", "empty", "present"]},
        "coverage": {"enum": ["answered", "refused", "not_requested"]},
        "precision": {"enum": ["exact", "span", "row", "token"]},
        "namespace": {"enum": ["class", "type", "schema", "native", "function"]},
        "range": {"type": "array", "items": {"type": "integer", "minimum": 0}, "minItems": 2, "maxItems": 2},
        "coordinate": {"type": "object", "properties": {
            "codepoint_range": {"$ref": "#/$defs/range"},
            "utf16_range": {"anyOf": [{"$ref": "#/$defs/range"}, {"type": "null"}]},
            "byte_range": {"$ref": "#/$defs/range"},
            "physical_line": {"type": ["integer", "null"]}, "precision": {"$ref": "#/$defs/precision"}}},
        "detail_ref": {"type": "object", "required": ["$detail_ref", "encoding", "sha256", "byte_length", "parts"],
            "properties": {"$detail_ref": {"type": "string"}, "encoding": {"const": "json"},
                "sha256": {"type": "string", "pattern": "^[0-9a-f]{64}$"},
                "byte_length": {"type": "integer", "minimum": 0}, "parts": {"type": "integer", "minimum": 1}}},
        "identity": {"type": "object", "required": ["contract_version", "hash", "language", "requested", "runtime"],
            "properties": {"contract_version": {"const": CONTRACT_VERSION},
                "hash": {"type": "string", "pattern": "^[0-9a-f]{64}$"}, "language": {"type": "string"},
                "declaration_hash": {"type": "string"}, "source_map_hash": {"type": "string"},
                "normalized_sha256": {"type": "string"}, "runtime": {"type": "object"},
                "catalog": {"type": "object"}, "requested": {"type": "object"}}},
        "checkpoint": {"type": "object", "required": ["contract_version", "identity_hash", "phase", "method_index",
            "candidate", "emission", "sequence", "counters", "methods", "done"],
            "properties": {"contract_version": {"const": CONTRACT_VERSION}, "identity_hash": {"type": "string"},
                "phase": {"type": "string"}, "done": {"type": "boolean"}, "methods": {"type": "object"},
                **{k: {"type": "integer", "minimum": 0} for k in ("method_index", "candidate", "emission", "sequence")},
                "counters": {"type": "object", "additionalProperties": {"type": "integer", "minimum": 0}}}},
        "summary": {"type": "object", "required": ["completion", "methods", "coverage", "counters", "denominators", "capabilities"],
            "properties": {"completion": {"enum": ["partial", "complete"]}, "provider_calls": {"const": 0},
                "methods": {"type": "array", "items": {"type": "object"}},
                "coverage": {"type": "object", "required": ["certified", "partial", "requested_methods", "answered_methods",
                    "refused_methods", "pending_methods", "not_requested_methods", "refused_obligations"],
                    "properties": {"certified": {"type": "boolean"}, "partial": {"type": "boolean"},
                        "refused_obligations": {"type": "array", "items": {"type": "string"}},
                        **{k: {"type": "integer", "minimum": 0} for k in ("requested_methods", "answered_methods",
                            "refused_methods", "pending_methods", "not_requested_methods")}}}}},
        "evidence": {"type": "object", "required": ["id", "kind", "method_id", "basis"],
            "properties": {"id": {"type": "string"}, "kind": {"enum": ["line", "token", "syllable", "native_pair",
                "native_measure", "relation_instance", "relation_figure", "figure_edges", "method_result",
                "form_result", "language_result", "detail_part"]}, "method_id": {"type": "string"},
                "basis": {"type": "string"}, "namespace": {"$ref": "#/$defs/namespace"},
                "verdict": {"$ref": "#/$defs/verdict"}, "coverage": {"$ref": "#/$defs/coverage"},
                "source_ranges": {"anyOf": [{"type": "array", "items": {"$ref": "#/$defs/coordinate"}}, {"$ref": "#/$defs/detail_ref"}]},
                "path": {"anyOf": [{"type": "array", "items": {"type": ["integer", "string"]}}, {"$ref": "#/$defs/detail_ref"}]},
                "container": {"enum": ["object", "array"]}, "detail_id": {"type": "string"},
                "parent_id": {"type": "string"}, "field": {"type": "string"}, "part": {"type": "integer", "minimum": 0},
                "total": {"type": "integer", "minimum": 1}, "json_fragment": {"type": "string"}},
            "allOf": [{"if": {"properties": {"kind": {"const": "detail_part"}}}, "then": {
                "required": ["detail_id", "parent_id", "field", "part", "total", "json_fragment"]}}]},
    },
}
