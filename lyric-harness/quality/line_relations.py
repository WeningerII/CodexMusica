"""Declared, directed within-block line functions (MISSING.md A-2).

These are discourse roles, not phonological predicates. No wording, rhyme,
repetition, punctuation or voice label establishes that B replies to A.
The source declares that relationship; validation checks its coordinates.
Keep this registry separate from relations.REGISTRY's sound schemas so a
declared answer never becomes a rhyme candidate or a certified semantic claim.
"""

from dataclasses import asdict, dataclass


LINE_RELATIONS = {
    "answer": ("call", "answer"),
    "call_and_response": ("call", "response"),
}


@dataclass(frozen=True)
class LineRelation:
    kind: str
    call: int
    response: int
    source: str
    call_voice: str = ""
    response_voice: str = ""


def read_line_relations(rows, blocks):
    """Read JSON links using 1-based lyric-line indices and block identities.

    None means not declared; [] means explicitly no links. Members must be
    distinct, ordered, in range and in the same concrete block instance.
    Nonadjacent links, shared calls, and shared responses are supported.
    The caller supplies block identities, never section names (which repeat).
    """
    if rows is None:
        return None
    if not isinstance(rows, (list, tuple)):
        raise ValueError("line_relations must be an array")
    result, seen = [], set()
    fields = set(LineRelation.__dataclass_fields__)
    for row in rows:
        if isinstance(row, LineRelation):
            row = asdict(row)
        if not isinstance(row, dict) or set(row) - fields:
            raise ValueError("line_relations contains an invalid object or unknown field")
        kind = row.get("kind")
        if not isinstance(kind, str) or kind not in LINE_RELATIONS:
            raise ValueError(f"line_relations kind must be one of {tuple(LINE_RELATIONS)}")
        call, response = row.get("call"), row.get("response")
        if any(type(n) is not int or not 1 <= n <= len(blocks)
               for n in (call, response)):
            raise ValueError("line_relations members must be 1-based integer lyric-line indices")
        if call >= response:
            raise ValueError("line_relations response must follow its call")
        if blocks[call - 1] is None or blocks[call - 1] != blocks[response - 1]:
            raise ValueError("line_relations members must belong to the same block instance")
        source = row.get("source")
        if not isinstance(source, str) or not source.strip():
            raise ValueError("line_relations requires a nonempty declaration source")
        for field in ("call_voice", "response_voice"):
            value = row.get(field, "")
            if not isinstance(value, str) or (value and not value.strip()):
                raise ValueError(f"line_relations {field} must be a voice label")
        key = (kind, call, response)
        if key in seen:
            raise ValueError("line_relations contains a duplicate directed link")
        seen.add(key)
        result.append(LineRelation(**row))
    return tuple(result)


def line_relation_report(relations, texts, blocks):
    """Report declarations with current text, without inferring semantic truth."""
    if len(texts) != len(blocks):
        raise ValueError("line relation text and block coordinates must have equal lengths")
    links = read_line_relations(relations, blocks)
    rows = []
    for link in links or ():
        row = asdict(link)
        row.update(call_role=LINE_RELATIONS[link.kind][0],
                   response_role=LINE_RELATIONS[link.kind][1],
                   call_text=texts[link.call - 1],
                   response_text=texts[link.response - 1])
        rows.append(row)
    return {"state": "undeclared" if links is None else "present" if links else "empty",
            "basis": "declared; coordinates validated, semantic reply not inferred",
            "count": len(rows), "rows": rows}
