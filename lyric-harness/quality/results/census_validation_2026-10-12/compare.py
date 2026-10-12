#!/usr/bin/env python3
"""Receipt for the 2026-10-12 validation-side census (PR #527, BB8 6133890644).

    python3 quality/coverage_census.py --population song --split validation \
        --lexicon-supplement=v2 --top 100000 --out /tmp/v2_top.json
    python3 quality/coverage_census.py --population song --split validation \
        --lexicon-supplement=v2 --fallback=high --top 100000 --out /tmp/v2high_top.json
    python3 quality/results/census_validation_2026-10-12/compare.py \
        --census-top /tmp/v2_top.json --census-top-high /tmp/v2high_top.json \
        --mpron PATH/TO/mpron.txt

The two `census_commit` fields record the checkout each census ran at; the
committed output's two differ (README, Provenance).

Read-only. Three things, all printed as JSON:
  0. The SET DIFFERENCE between the two census records: the spellings unread
     under v2 that `fallback: high` answers, and any it newly fails to read
     (a regression). A census count difference alone is only a net change.
  1. SPELLING GROUPS of the types unread under v2 (hyphen / apostrophe /
     other), by occurrence. A spelling group is not a linguistic class:
     `other` includes closed compounds, so it does not measure compound share.
  2. `fallback: high` readings of those types compared with Moby Pronunciator
     II (converted by quality/moby_convert.py). Moby is a REFERENCE that flags
     disagreements to adjudicate; it is not a judge, and agreement on the
     subset Moby carries is not a measured error rate for the rest.
"""
import argparse, collections, hashlib, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, ROOT)
from quality.coverage_census import build_lexicon  # noqa: E402
from quality import moby_convert as M  # noqa: E402


def strip(t):
    return tuple(re.sub(r"\d", "", x) for x in t)


def reduced(t):
    """Stress ignored; unstressed AH/IH/IY/EH/UW collapse; IY~IH before NG."""
    out = []
    for i, x in enumerate(t):
        b = re.sub(r"\d", "", x)
        if x[-1:] == "0" and b in ("AH", "IH", "IY", "EH", "UW"):
            b = "@"
        if b in ("IY", "IH") and i + 1 < len(t) and t[i + 1] == "NG":
            b = "I"
        out.append(b)
    return tuple(out)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--census-top", required=True)
    ap.add_argument("--census-top-high", required=True)
    ap.add_argument("--mpron", required=True)
    a = ap.parse_args(argv)
    rec = json.load(open(a.census_top))
    T = rec["top_unread_types"]
    high = json.load(open(a.census_top_high))
    unread_v2 = {t["type"] for t in T}
    unread_high = {t["type"] for t in high["top_unread_types"]}
    groups = collections.Counter(); occ = collections.Counter()
    for t in T:
        w = t["type"]
        k = "hyphen" if "-" in w else "apostrophe" if "'" in w else "other"
        groups[k] += 1; occ[k] += t["unread_words"]
    digest = hashlib.sha256(open(a.mpron, "rb").read()).hexdigest()
    if digest != M.MPRON_SHA256:
        print(f"REFUSED: {a.mpron} is not the pinned mpron.txt ({digest})")
        return 1
    E = M.load(a.mpron)
    hi = build_lexicon("v2", "high")
    newly, still = [], 0
    for t in T:
        w = t["type"]
        pieces = [p for p in hi.word_pieces(w) if p]
        ph, bad = [], False
        for p in pieces:
            r, oov = hi.transcribe_word(p)
            if oov:
                bad = True
                break
            ph += r
        if bad:
            still += 1
        else:
            newly.append((w, tuple(ph)))
    inm = [x for x in newly if x[0] in E]
    rows = {"exact": [], "stress_only": [], "reduced_vowel_only": [], "sounds_differ": []}
    for w, ph in inm:
        m = set(E[w])
        k = ("exact" if ph in m else
             "stress_only" if strip(ph) in {strip(x) for x in m} else
             "reduced_vowel_only" if reduced(ph) in {reduced(x) for x in m} else
             "sounds_differ")
        rows[k].append({"word": w, "fallback": " ".join(ph), "moby": [" ".join(x) for x in E[w]]})
    out = {
        "census_record": {k: rec[k] for k in ("census_commit", "inputs_sha256", "lexicon_supplement",
                                               "lexicon_supplement_sha256", "fallback", "split")},
        "mpron_sha256": digest,
        "unread_types_v2": len(T),
        "spelling_groups": {k: {"types": groups[k], "occurrences": occ[k]} for k in sorted(groups)},
        "census_record_high": {k: high[k] for k in ("census_commit", "lexicon_supplement_sha256",
                                                     "fallback")},
        "set_difference": {"answered_by_high_not_v2": len(unread_v2 - unread_high),
                           "unread_by_high_read_by_v2": len(unread_high - unread_v2)},
        "fallback_high_reads": len(newly),
        "fallback_high_still_unread": still,
        "moby_carries": len(inm),
        "moby_comparison_counts": {k: len(v) for k, v in rows.items()},
        "moby_comparison_rows": {k: v for k, v in rows.items() if k != "exact"},
    }
    json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
    print()


if __name__ == "__main__":
    sys.exit(main())
