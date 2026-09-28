#!/usr/bin/env python3
"""Regressions for THE WIDENING INDEX — `quality/relation_index.py`.

When a place's menu comes back empty under a declared relation, `brief()`
searches the whole lexicon (owner ruling 2026-09-28: no limit on that
search). The index lets it skip the words a relation's own definition says
cannot stand in it. The one thing it may never do is drop a word the grade
would accept, so every section below is about that, or about proving the
check can see it.

Sections:
  1  every relation name, both routes: no dropped word is accepted by the
     exact judge `declared_offer` (a slice of the lexicon; the whole-lexicon
     run is `python3 quality/prove_relation_index.py`)
  2  the check is two-sided: an index that drops too much is CAUGHT
  3  the offer is the full scan's offer, word for word and in order
  4  the widening is indexed: the two-line rime riche brief that timed out
     CI grades a small fraction of the lexicon, not all of it
"""
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from quality import prove_relation_index as P                     # noqa: E402
from quality import relation_index as RI                          # noqa: E402
from quality import schemes as SC                                 # noqa: E402
from quality.revise import Reviser                                # noqa: E402

FAILURES = []
R = Reviser()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def test_no_dropped_word_is_accepted():
    print("\n1. every relation name, both routes: no dropped word is accepted")
    names = P.every_name()
    rows = []
    rng = random.Random(20260928)
    for name in names:
        for layout in P.LAYOUTS:
            for call in ("cat", "door"):
                r = P.prove(R, name, call, layout, 5, rng, pool_size=400)
                r.update(name=name, layout=layout, call=call)
                rows.append(r)
    bad = [(r["name"], r["layout"], r["call"], r["violations"])
           for r in rows if r.get("violations")]
    checked = sum(r.get("checked", 0) for r in rows)
    with_req = {(r["name"], r["layout"]) for r in rows
                if r["status"] == "filtered"}
    check("the population is every declarable name, all three namespaces "
          "and the narrowed admit doors",
          len(names) >= 78 + 76 + 5 + len(P.DOORS),
          f"{len(names)} names")
    check("the check examined words, not an empty set",
          checked > 1000 and len(with_req) > 150,
          f"{checked} dropped words graded; {len(with_req)} (name, route) "
          f"cells carry a requirement")
    check("no word the index dropped is one the grade accepts", not bad,
          f"{bad[:5]}" if bad else f"0 violations over {len(rows)} cells")


def test_the_check_is_two_sided():
    print("\n2. an index that drops too much is CAUGHT")
    real = (RI.meets, RI.coarse_meets)
    RI.meets = lambda *a, **k: False
    RI.coarse_meets = lambda *a, **k: False
    try:
        got = {}
        for name in ("schema:perfect rhyme", "type:masculine rhyme",
                     "class:RHYME", "door:RHYME,RIME_RICHE"):
            r = P.prove(R, name, "cat", "end", 10, random.Random(1),
                        pool_size=400)
            got[name] = r.get("violations", [])
    finally:
        RI.meets, RI.coarse_meets = real
    check("with every requirement forced to fail, each route's check finds "
          "the rhymes it wrongly dropped",
          all(got.values()),
          "; ".join(f"{n}: {v[:4]}" for n, v in got.items()))


def test_the_offer_is_the_full_scans_offer():
    print("\n3. the indexed offer is the full scan's offer, in order")
    cases = (("class:RHYME", "cat"), ("schema:perfect rhyme", "night"),
             ("type:masculine rhyme", "door"), ("schema:assonance", "sea"))
    diffs = []
    for name, call in cases:
        lines = [f"a line that ends on {call}", "and one that ends on stone"]
        m = SC.mandate([[1, 2]], n_lines=2, default_relation=name)
        keep = R._widening_filter(lines, m, 2, None, [0], R._matrix(lines)[1])
        near = [row["word"] for row in R.engine.candidates(
            call, n=600).get("candidates", ()) if row["word"] != call][:600]
        full, _ = R.declared_offer(near, lines, m, 2, None, [0], limit=24)
        idx, _ = R.declared_offer([w for w in near if keep(w)], lines, m, 2,
                                  None, [0], limit=24)
        if full != idx:
            diffs.append((name, call, full[:6], idx[:6]))
        print(f"          {name} / {call}: {len(full)} offered either way")
    check("the same words in the same order, on every case", not diffs,
          f"{diffs}" if diffs else "")


def test_the_widening_is_indexed():
    print("\n4. the widening that timed out CI now grades a fraction of it")
    lines = ["Copper cat", "Azure dog"]
    m = SC.mandate("AA", n_lines=2, default_relation="type:rime riche")
    orig, n = R.grade, [0]

    def counted(*a, **k):
        n[0] += 1
        return orig(*a, **k)
    R.grade = counted
    try:
        R.brief(lines, m)
    finally:
        R.grade = orig
    check("the brief grades a small fraction of the 39k-word lexicon",
          n[0] < 5000,
          f"{n[0]} grade calls (a full scan was 78,944)")


def main():
    for fn in (test_no_dropped_word_is_accepted,
               test_the_check_is_two_sided,
               test_the_offer_is_the_full_scans_offer,
               test_the_widening_is_indexed):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
