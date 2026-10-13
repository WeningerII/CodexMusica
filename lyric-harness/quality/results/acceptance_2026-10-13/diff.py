"""Acceptance diff: two `record.py` runs joined by line id, every change
classified, and each class set against the PROJECTION in the scope receipt's
`shape_sweep.json` (item 6, M1 and M2b, at the end word and inside the line).

    python3 quality/results/acceptance_2026-10-13/diff.py BEFORE.jsonl.gz AFTER.jsonl.gz OUT.json

Classes (a line can be in several):
  end_newly_refused    readable before, refused after
  end_newly_read       refused before, readable after
  interior_gained      a word refused before the end word after that was not
                       before (`interior_unreadable`, or a `transcribe` OOV
                       that is not the end token or one of its pieces)
  interior_lost        the reverse
  reading_switched     readable before and after, same unreadable lists, and the
                       line's phones differ (a selected reading moved)
  tokens_changed       `line_tokens` differs
  error_after / error_before   the line raised
For the two refusal classes, each projected set gets three cells:
projected_and_observed, projected_not_observed and, over the union of the
projected sets, observed_not_projected -- the change nobody predicted. Every
cell carries its ids; the unpredicted cells also carry before/after detail.
"""
import gzip, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SWEEP = os.path.join(os.path.dirname(HERE), "scope_2026-10-12", "shape_sweep.json")
_DETAIL = 40


def _load(path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        rows = [json.loads(x) for x in fh]
    return rows[0], {r["id"]: r for r in rows[1:]}


def _detail(b, a):
    keys = ("tokens", "final", "readable", "cause", "unreadable", "interior_unreadable", "reason", "phones", "error")
    return {"id": b["id"], "before": {k: b.get(k) for k in keys if k in b}, "after": {k: a.get(k) for k in keys if k in a}}


def _inside(r):
    """Words refused before the end word: `interior_unreadable`, plus any
    `transcribe` OOV that is not the end token or one of its pieces (a batch
    may report an interior refusal through either)."""
    fin = (r.get("final") or "").lower()
    own = {fin} | {p for p in re.split(r"[-\u2011]+", fin) if p}
    return set(r["interior_unreadable"]) | {w for w in r["oov"] if w.lower() not in own}


def _cross(observed, projected, before, after):
    union = set().union(*projected.values())
    unpredicted = sorted(observed - union)
    return {
        "observed": len(observed),
        "by_projection": {k: {"projected": len(v), "projected_and_observed": len(v & observed),
                              "projected_not_observed": sorted(v - observed)} for k, v in projected.items()},
        "observed_not_projected": {"count": len(unpredicted), "ids": unpredicted,
                                   "detail": [_detail(before[i], after[i]) for i in unpredicted[:_DETAIL]]},
    }


def _main():
    hb, before = _load(sys.argv[1])
    ha, after = _load(sys.argv[2])
    out = sys.argv[3]
    with open(SWEEP, encoding="utf-8") as fh:
        proj = json.load(fh)["projected_refusals"]
    end_proj = {k: set(v) for k, v in proj["ids"].items()}
    int_proj = {k: set(v) for k, v in proj["interior_ids"].items()}
    ids = sorted(set(before) & set(after))
    cls = {k: set() for k in ("end_newly_refused", "end_newly_read", "interior_gained", "interior_lost",
                              "reading_switched", "tokens_changed", "error_before", "error_after")}
    for i in ids:
        b, a = before[i], after[i]
        if "error" in b:
            cls["error_before"].add(i)
        if "error" in a:
            cls["error_after"].add(i)
        if "error" in a or "error" in b:
            continue
        if b["readable"] and not a["readable"]:
            cls["end_newly_refused"].add(i)
        if a["readable"] and not b["readable"]:
            cls["end_newly_read"].add(i)
        bi, ai = _inside(b), _inside(a)
        if ai - bi:
            cls["interior_gained"].add(i)
        if bi - ai:
            cls["interior_lost"].add(i)
        if (b["readable"] and a["readable"] and b["unreadable"] == a["unreadable"]
                and b["phones"] != a["phones"]):
            cls["reading_switched"].add(i)
        if b["tokens"] != a["tokens"]:
            cls["tokens_changed"].add(i)
    rec = {
        "before": hb, "after": ha, "projection": os.path.relpath(SWEEP, os.path.dirname(os.path.dirname(HERE))),
        "lines": {"before": len(before), "after": len(after), "joined": len(ids),
                  "only_before": sorted(set(before) - set(after)), "only_after": sorted(set(after) - set(before))},
        "counts": {k: len(v) for k, v in cls.items()},
        "end_refusals": _cross(cls["end_newly_refused"], end_proj, before, after),
        "interior_refusals": _cross(cls["interior_gained"], int_proj, before, after),
        "end_newly_read": {"ids": sorted(cls["end_newly_read"]),
                           "detail": [_detail(before[i], after[i]) for i in sorted(cls["end_newly_read"])[:_DETAIL]]},
        "reading_switched": {"ids": sorted(cls["reading_switched"]),
                             "detail": [_detail(before[i], after[i]) for i in sorted(cls["reading_switched"])[:_DETAIL]]},
        "errors_after": {"ids": sorted(cls["error_after"]),
                         "detail": [_detail(before[i], after[i]) for i in sorted(cls["error_after"])[:_DETAIL]]},
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    summary = {"before": hb["commit"][:9], "after": ha["commit"][:9], **rec["counts"],
               "end_unpredicted": rec["end_refusals"]["observed_not_projected"]["count"],
               "interior_unpredicted": rec["interior_refusals"]["observed_not_projected"]["count"],
               "end_by_projection": {k: [v["projected"], v["projected_and_observed"]]
                                     for k, v in rec["end_refusals"]["by_projection"].items()},
               "interior_by_projection": {k: [v["projected"], v["projected_and_observed"]]
                                          for k, v in rec["interior_refusals"]["by_projection"].items()}}
    print(json.dumps(summary, indent=1))


if __name__ == "__main__":
    _main()
