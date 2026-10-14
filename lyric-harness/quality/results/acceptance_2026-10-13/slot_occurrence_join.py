"""Join the occurrence checker (`slot_occurrence.py`, tool v3) with the v2
slot-match dumps, case by case.

    python3 slot_occurrence_join.py V2_BASE.jsonl.gz V2_CAND.jsonl.gz \
        V3_BASE.jsonl.gz V3_CAND.jsonl.gz V3_HEAD.jsonl.gz OUT.json

V2_* are `slot_match_67889851/`'s dumps (fce4bf0f and 67889851, tool v2).
V3_* are this tool's dumps on the same 3,990-line population at fce4bf0f,
67889851 and the head under test. A case is (mode, line, slot); the base
tree's only mode is matched to the candidate's `cur` (as `join.py` does).

It reports:
1. tool equality: v3's `literal` verdict against v2's `kind` at fce4bf0f and
   67889851, every case;
2. literal vs occurrence at fce4bf0f and 67889851: what each v2 kind reads as
   by occurrence;
3. the 67889851 `cur` failure cohorts (named as in `slot_match_67889851/`)
   and each case's occurrence and literal verdict at the head;
4. v1 preservation, two ways: LITERAL-LABEL equality (the head's v3
   `literal` against 67889851's v2 `kind`) and WHOLE-RECORD equality (the
   head's v3 record against 67889851's v3 record, every field), each with
   the excluded-line placeholders counted apart from evaluated records;
5. every occurrence failure at the head, as revision 3.1's gate counts them
   (`occ_wrong`, `unplaceable_edit`, `no_op_edit`, `edit_unbound`), with
   `resolver_mismatch` reported apart as unresolved (3PO, #527 6163258626:
   the first version of this join counted the other way round);
6. the `edit_unbound` residual at the head, by mode, slot and the edited
   token's shape (numeral, hyphen, other).
"""
import collections, gzip, json, re, sys

SLOTS = ["end", "endword", "head", "headrime"] + [f"T{n}" for n in range(1, 9)]
FAIL_V2 = {"wrong_word", "grader_elsewhere", "no_op_edit", "resolver_mismatch"}
#: revision 3.1's failing outcomes; `resolver_mismatch` is unresolved, apart
FAIL_V3 = {"occ_wrong", "unplaceable_edit", "no_op_edit", "edit_unbound"}
UNRESOLVED_V3 = {"resolver_mismatch"}
REFUSED = ("refused", "refused_unbound", "refused_grader_elsewhere", "no_word_refused")


def load(path, base=False):
    d = {}
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for l in fh:
            r = json.loads(l)
            mode = r["mode"].replace("base:", "cur:") if base else r["mode"]
            kind = r.get("kind") or r.get("occurrence")
            if r["slot"] is None:
                for s in SLOTS:
                    d[(mode, r["line"], s)] = dict(r, kind=kind, literal=kind, occurrence=kind, slot=s)
            else:
                d[(mode, r["line"], r["slot"])] = dict(r, kind=kind)
    return d


def cohort(b, c):
    """`join.py`'s classes for a 67889851 failure, from its base case."""
    sig = lambda r: (r["kind"], r.get("named"), r.get("bound"), r.get("edited"))
    if sig(b) == sig(c):
        return "unchanged_same_failure"
    if b["kind"] == c["kind"]:
        return "same_kind_other_words"
    if b["kind"] in REFUSED:
        return "base_refused_now_fails"
    if b["kind"] in ("agree", "agree_unbound"):
        return "base_agreed_now_fails"
    if b["kind"].startswith("excluded") or b["kind"] == "absent":
        return "base_excluded_now_measured"
    return "base_other_failure"


def shape(text):
    if text is None:
        return "none"
    if re.search(r"\d", text):
        return "numeral"
    if "-" in text or "‐" in text or "‑" in text:
        return "hyphen"
    return "other"


def main(v2b, v2c, v3b, v3c, v3h, out):
    V2B, V2C = load(v2b, base=True), load(v2c)
    V3B, V3C, V3H = load(v3b, base=True), load(v3c), load(v3h)
    absent = {"kind": "absent", "literal": "absent", "occurrence": "absent"}
    rep = {}
    # 1. tool equality
    eq = {}
    for tag, V2, V3 in (("fce4bf0f", V2B, V3B), ("67889851", V2C, V3C)):
        keys = set(V2) | set(V3)
        diff = [(k, V2.get(k, absent)["kind"], V3.get(k, absent).get("literal"))
                for k in sorted(keys) if V2.get(k, absent)["kind"] != V3.get(k, absent).get("literal")]
        eq[tag] = {"cases": len(keys), "different": len(diff),
                   "examples": [{"mode": k[0], "line": k[1], "slot": k[2], "v2": a, "v3_literal": b}
                                for k, a, b in diff[:10]]}
    rep["tool_equality_v2_kind_vs_v3_literal"] = eq
    # 2. literal vs occurrence on the measured trees
    lo = {}
    for tag, V3 in (("fce4bf0f", V3B), ("67889851", V3C), ("head", V3H)):
        t = collections.Counter((k[0].split(":")[0], r["literal"], r["occurrence"]) for k, r in V3.items())
        lo[tag] = {f"{m} | {a} -> {b}": n for (m, a, b), n in sorted(t.items())}
    rep["literal_to_occurrence"] = lo
    # 3. the 67889851 failure cohorts at the head
    fate = collections.defaultdict(collections.Counter)
    examples = collections.defaultdict(list)
    for k, c in V2C.items():
        if not k[0].startswith("cur:") or c["kind"] not in FAIL_V2:
            continue
        b = V2B.get(k, absent)
        cls = cohort(b, c) + " | " + c["kind"]
        h = V3H.get(k, absent)
        fate[cls][(h["occurrence"], h["literal"])] += 1
        if len(examples[(cls, h["occurrence"])]) < 3:
            examples[(cls, h["occurrence"])].append(
                {"mode": k[0], "line": k[1], "slot": k[2], "v2_678": [c.get("named"), c.get("bound"), c.get("edited")],
                 "head": {x: h.get(x) for x in ("named", "bound", "edited", "result")}})
    rep["cohorts_678_to_head"] = {cls: {"total": sum(t.values()),
                                        "fate": {f"occ {a} / literal {b}": n for (a, b), n in t.most_common()}}
                                  for cls, t in sorted(fate.items())}
    rep["cohort_examples"] = {f"{a} -> {b}": v for (a, b), v in sorted(examples.items())}
    # 4. v1 preservation
    keys = {k for k in set(V2C) | set(V3H) if k[0].startswith("v1:")}
    placeholder = lambda r: str(r.get("occurrence") or r.get("kind")).startswith("excluded")
    n_place = sum(1 for k in keys if placeholder(V3H.get(k, absent)))
    d = collections.Counter((V2C.get(k, absent)["kind"], V3H.get(k, absent).get("literal"))
                            for k in keys if V2C.get(k, absent)["kind"] != V3H.get(k, absent).get("literal"))
    rep["v1_678_vs_head_literal_label"] = {
        "what": "the head's v3 `literal` against 67889851's v2 `kind`: label equality only",
        "cases": len(keys), "excluded_placeholders": n_place, "evaluated": len(keys) - n_place,
        "different": sum(d.values()), "transitions": {f"{a} -> {b}": n for (a, b), n in d.most_common()}}
    strip = lambda r: {x: v for x, v in r.items()}
    wk = {k for k in set(V3C) | set(V3H) if k[0].startswith("v1:")}
    wd = [k for k in sorted(wk) if strip(V3C.get(k, absent)) != strip(V3H.get(k, absent))]
    rep["v1_678_vs_head_whole_record"] = {
        "what": "the head's v3 record against 67889851's v3 record, every field "
                "(occurrence, literal, named, bound, edited, same_spelling, result)",
        "cases": len(wk), "excluded_placeholders": sum(1 for k in wk if placeholder(V3H.get(k, absent))),
        "evaluated": len(wk) - sum(1 for k in wk if placeholder(V3H.get(k, absent))),
        "different": len(wd), "examples": [{"mode": k[0], "line": k[1], "slot": k[2]} for k in wd[:10]]}
    # 5. occurrence failures at the head
    fails = [dict(mode=k[0], line=k[1], slot=k[2], **{x: r.get(x) for x in ("occurrence", "literal", "named", "bound", "edited", "result")})
             for k, r in sorted(V3H.items()) if r["occurrence"] in FAIL_V3]
    unres = [dict(mode=k[0], line=k[1], slot=k[2]) for k, r in sorted(V3H.items())
             if r["occurrence"] in UNRESOLVED_V3]
    by_scheme = collections.Counter((f["mode"].split(":")[0], f["occurrence"]) for f in fails)
    rep["head_occurrence_failures"] = {"what": "population cases failing revision 3.1's gate at the head",
                                       "count": len(fails),
                                       "by_scheme_kind": {f"{a} | {b}": n for (a, b), n in sorted(by_scheme.items())},
                                       "by": dict(collections.Counter(f"{f['mode']} | {f['slot']} | {f['occurrence']}" for f in fails)),
                                       "cases_listed": min(len(fails), 200), "cases": fails[:200]}
    rep["head_unresolved"] = {"count": len(unres), "cases": unres}
    # 6. the edit_unbound residual
    res = collections.Counter()
    words = collections.defaultdict(collections.Counter)
    for k, r in V3H.items():
        if r["occurrence"] != "edit_unbound":
            continue
        e = (r.get("edited") or {}).get("text")
        res[(k[0], k[2], shape(e))] += 1
        words[k[0]][e] += 1
    by_mode = collections.Counter()
    for (m, s, sh), n in res.items():
        by_mode[(m, sh)] += n
    rep["head_edit_unbound"] = {
        "by_mode": {m: {"total": sum(n for (mm, _), n in by_mode.items() if mm == m),
                        **{sh: n for (mm, sh), n in sorted(by_mode.items()) if mm == m}}
                    for m in sorted({m for m, _ in by_mode})},
        "by_mode_slot_shape": {f"{m} | {s} | {sh}": n for (m, s, sh), n in sorted(res.items())},
        "top_words": {m: c.most_common(25) for m, c in words.items()}}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rep, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    brief = {k: v for k, v in rep.items() if k not in ("cohort_examples", "head_occurrence_failures", "head_edit_unbound")}
    brief["head_occurrence_failures"] = {"count": rep["head_occurrence_failures"]["count"],
                                         "by": rep["head_occurrence_failures"]["by"]}
    brief["head_edit_unbound"] = rep["head_edit_unbound"]["by_mode"]
    print(json.dumps(brief, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(*sys.argv[1:7])
