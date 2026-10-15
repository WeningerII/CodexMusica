"""Reconstruct this receipt's claims from the FULL slot-tool dumps.

    python3 -I compare_runs.py BEFORE.jsonl.gz AFTER.jsonl.gz [BASE_678.jsonl.gz] > comparison.json

BEFORE and AFTER are BB8's `slot_occurrence.py` 3.3 per-case dumps (one JSON
object per line: line, mode, slot, occurrence, literal, named, bound, edited,
same_spelling, result), here `so_61b6618a.jsonl.gz` and the code head's. A
case is keyed by (mode, line, slot) and the ordinal of that key in the file
(a population line can repeat). Nothing is re-run and nothing is read from
the tool's summaries: every count below comes from the per-case records.

It reports:
- the cases present in one dump only (must be none);
- every case whose record differs in ANY byte, with both records' outcome
  fields, grouped by (mode, slot, before -> after);
- the readable v2 default-end cases (`cur:*`, slot `end`, `occ_agree` in
  BEFORE) and how many are byte-identical in AFTER;
- the v1 cases, and how many are byte-identical (whole record);
- with BASE_678 (`so_67889851.jsonl.gz`, BB8's dump at 67889851): the 989
  cohort -- v2 cases whose 67889851 `literal` was `grader_elsewhere` -- and
  their outcomes in BEFORE and AFTER, and whether each is byte-identical.
"""
import collections
import gzip
import json
import re
import sys


def _load(path):
    seen = collections.Counter()
    out = {}
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for raw in fh:
            raw = raw.rstrip("\n")
            if not raw:
                continue
            r = json.loads(raw)
            k = (r["mode"], r["line"], r["slot"])
            seen[k] += 1
            out[k + (seen[k],)] = (raw, r)
    return out


def _shape(r):
    """unread / numeral / hyphenated, for an unbound default-end case: the
    line's last named token as the record gives it."""
    word = (r.get("named") or {}).get("text") or ""
    if re.search(r"\d", word):
        return "numeral"
    if "-" in word or "‐" in word or "‑" in word:
        return "hyphenated"
    return "unread"



def _main():
    before, after = _load(sys.argv[1]), _load(sys.argv[2])
    rep = {"before": sys.argv[1], "after": sys.argv[2],
           "cases": {"before": len(before), "after": len(after)},
           "only_before": len(set(before) - set(after)),
           "only_after": len(set(after) - set(before))}
    changed = [k for k in before if k in after and before[k][0] != after[k][0]]
    groups = collections.Counter()
    shapes = collections.Counter()
    listed = []
    for k in changed:
        b, a = before[k][1], after[k][1]
        groups[f"{k[0]} | {k[2]} | {b['occurrence']} -> {a['occurrence']}"] += 1
        if b["occurrence"] == "edit_unbound" and a["occurrence"] == "refused_unbound":
            shapes[f"{k[0]} | {_shape(b)}"] += 1
        listed.append({"mode": k[0], "line": k[1], "slot": k[2], "ordinal": k[3],
                       "before": {f: b.get(f) for f in ("occurrence", "literal", "edited", "result")},
                       "after": {f: a.get(f) for f in ("occurrence", "literal", "edited", "result")}})
    rep["changed"] = {"count": len(changed), "by_transition": dict(sorted(groups.items())),
                      "unbound_end_by_shape": dict(sorted(shapes.items())),
                      "every_change_is_cur_end": all(k[0].startswith("cur:") and k[2] == "end"
                                                     for k in changed)}
    readable = [k for k in before if k[0].startswith("cur:") and k[2] == "end"
                and before[k][1]["occurrence"] == "occ_agree"]
    rep["readable_v2_default_end"] = {
        "cases": len(readable),
        "byte_identical": sum(1 for k in readable if k in after and before[k][0] == after[k][0])}
    v1 = [k for k in before if k[0].startswith("v1:")]
    rep["v1"] = {"cases": len(v1),
                 "byte_identical": sum(1 for k in v1 if k in after and before[k][0] == after[k][0])}
    non_end = [k for k in before if k[2] != "end"]
    rep["non_end"] = {"cases": len(non_end),
                      "byte_identical": sum(1 for k in non_end if k in after and before[k][0] == after[k][0])}
    if len(sys.argv) > 3:
        base = _load(sys.argv[3])
        cohort = [k for k, (_, r) in base.items()
                  if k[0].startswith("cur:") and r.get("literal") == "grader_elsewhere"]
        rep["cohort_989"] = {
            "definition": "v2 cases whose 67889851 literal is grader_elsewhere",
            "cases": len(cohort),
            "before": dict(collections.Counter(before[k][1]["occurrence"] for k in cohort if k in before)),
            "after": dict(collections.Counter(after[k][1]["occurrence"] for k in cohort if k in after)),
            "byte_identical_before_after": sum(1 for k in cohort if k in before and k in after
                                               and before[k][0] == after[k][0]),
            "missing": sum(1 for k in cohort if k not in before or k not in after)}
    rep["changed_cases"] = listed
    json.dump(rep, sys.stdout, ensure_ascii=False, indent=1)
    print()


if __name__ == "__main__":
    _main()
