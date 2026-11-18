"""Describe lyric variations in declared rondo parts; they do not identify tunes."""
import re

from quality.grid import compare_returns


def printed_spans(sections):
    """Map source headers to the same contiguous sung lines as recover's reader."""
    result = []
    offset = 0
    for sec in sections:
        if sec.get("classified") is not True:
            return []
        raw, width = sec["name"], sec["lines"]
        end = offset + width
        if re.match(r"^(?:FINISHED|GRADED)\b|^SETUP\s+—\s+", raw, re.I):
            if not result and width:
                return []
            if result:
                result[-1]["lineSpan"][1] = end
        else:
            name = re.split(r"\s+—\s+", raw.strip(), maxsplit=1)[0]
            role = re.sub(r"-?\d+$", "", re.sub(r"[\s_]+", "-", name.lower()))
            result.append({"role": role, "lineSpan": [offset, end]})
        offset = end
    return result


def lyrical_returns(lines, sections):
    """Classify each later printed part against its first appearance in this score."""
    if not sections or len(sections) not in (5, 7):
        return []
    offset = 0
    for row in sections:
        span = row.get("lineSpan")
        if (not isinstance(span, (list, tuple)) or len(span) != 2
                or any(type(n) is not int for n in span)
                or span[0] != offset or not offset <= span[1] <= len(lines)):
            return []
        offset = span[1]
    if offset != len(lines):
        return []
    first = {}
    observations = []
    for i, section in enumerate(sections, 1):
        label = section.get("sourceRole", section.get("role"))
        part = re.fullmatch(r"(?:part[\s_-]+)?([abc])", label, re.I) if isinstance(label, str) else None
        if part is None:
            continue
        role = "part-" + part[1].lower()
        a, b = section["lineSpan"]
        original, x, y = first.setdefault(role, (i, a, b))
        if original == i:
            continue
        row = {"part": role, "sections": [original, i],
               "lineSpans": [[x, y], [a, b]], "basis": "printed lyrics only"}
        if x < y and a < b:
            variation = compare_returns(lines[x:y], lines[a:b], language="eng")
            row.update(classification=variation.kind, normalization=variation.declaration.normalisation,
                       lineDistance=variation.line_distance, tokenDistance=variation.token_distance)
            if variation.token_distance is None:
                row["refusals"] = [ref.code for ref in variation.refusals]
        else:
            row["classification"] = "unobserved"
        observations.append(row)
    return observations
