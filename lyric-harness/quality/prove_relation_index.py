"""Does the widening index ever drop a word the grade would accept?

`quality/relation_index.py` lets `Reviser.brief` skip, in its whole-lexicon
widening, the words a declared relation's own definition says cannot stand in
it. That is only sound if every dropped word is one the full grade refuses.
This instrument checks exactly that, for every relation name a mandate can
declare — all `schema:`, `type:` and `class:` names — on the two routes a
place can take (the default end slot, declared single-token slots at the
line's end, start and middle, and a pair mixing the two):

  1. build the two-line draft and the mandate declaring the relation;
  2. build the index's `keep` for the place and run it over the lexicon;
  3. put the DROPPED words through `Reviser.declared_offer` — the exact
     judge the widening uses — the ones sounding most like the call first,
     then a seeded random sample of the rest.

A dropped word the judge keeps is a VIOLATION and the run exits 1. Every
relation is reported with what the index did for it: `filtered` (a
requirement was derived), `unfiltered` (none could be, so the search at that
place still grades every word), or `refused` (the mandate itself refuses the
declaration, so no brief is ever built for it).

    python3 quality/prove_relation_index.py                 # full run
    python3 quality/prove_relation_index.py --per=10 --calls=cat,door
    python3 quality/prove_relation_index.py --names=type:rime riche
"""

import argparse
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from quality import rhyme_types as RT  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality.revise import Reviser  # noqa: E402

CALLS = ("cat", "door", "night", "sea", "morning", "hollow")
LAYOUTS = {
    # (lines, groups, candidate line)
    "end": (["a line that ends on {call}", "and one that ends on {inc}"],
            [[1, 2]], 2),
    "token": (["the {call} was here", "the {inc} was there"],
              [["1.T2", "2.T2"]], 2),
    "head": (["{call} was the word", "{inc} was the other"],
             [["1.head", "2.head"]], 2),
    "endword": (["a line that ends on {call}", "and one that ends on {inc}"],
                [["1.endword", "2.endword"]], 2),
    "mixed": (["a line that ends on {call}", "the {inc} was there"],
              [["1.end", "2.T2"]], 2),
}
INCUMBENT = "stone"
_NEAR = {}


#: A bare group judged at a NARROWED admit door (its schema route closed),
#: spelled `door:REL,REL`: the case a declaration narrowing `admit` reaches.
DOORS = ("door:RHYME,RIME_RICHE", "door:RHYME", "door:RIME_RICHE",
         "door:ASSONANCE,RHYME", "door:CONSONANCE,RIME_RICHE",
         "door:ASSONANCE,CONSONANCE,RHYME",
         "door:PROMOTED_RHYME,RHYME,RIME_RICHE")


def every_name():
    v = RT.namespaced_vocabulary()
    return [f"{ns}:{n}" for ns in ("schema", "type", "class")
            for n in sorted(v[ns])] + list(DOORS)


_DOOR_REVISERS = {}


def reviser_for(R, name):
    """The reviser a name is judged by: a narrowed-admit twin for a door."""
    if not name.startswith("door:"):
        return R, name
    admit = tuple(sorted(name.split(":", 1)[1].split(",")))
    Rd = _DOOR_REVISERS.get(admit)
    if Rd is None:
        import dataclasses
        Rd = Reviser(lex=R.lex, decl=dataclasses.replace(R.decl, admit=admit),
                     floor=R.floor, rdecl=R.rdecl)
        Rd._engine = R.engine
        _DOOR_REVISERS[admit] = Rd
    return Rd, None


def prove(R, name, call, layout, per, rng, pool_size=None):
    tmpl, groups, ln = LAYOUTS[layout]
    lines = [t.format(call=call, inc=INCUMBENT) for t in tmpl]
    try:
        R, relation = reviser_for(R, name)
    except ValueError as e:
        return {"status": "refused", "why": str(e)[:160]}
    try:
        m = (SC.mandate(groups, n_lines=len(lines), default_relation=relation)
             if relation else SC.mandate(groups, n_lines=len(lines)))
    except Exception as e:
        return {"status": "refused", "why": str(e)[:160]}
    slot = m.slot_of(0, ln) if m.slots_declared() else None
    endwords = R._matrix(lines)[1]
    keep = R._widening_filter(lines, m, ln, slot, [0], endwords)
    if keep is None:
        return {"status": "unfiltered"}
    pool = [w for w, _a, _r in R.engine.index
            if w not in (call, INCUMBENT)]
    near = _NEAR.get(call)
    if near is None:
        near = _NEAR[call] = [row["word"] for row in R.engine.candidates(
            call, n=len(R.engine.index)).get("candidates", ())]
    if pool_size:
        # A SLICE of the lexicon for a quick run: the words sounding most
        # like the call (where a wrong drop is likeliest) and a seeded sample.
        head = [w for w in near if w not in (call, INCUMBENT)][:pool_size // 2]
        rest = sorted(set(pool) - set(head))
        random.Random(f"{call}:{pool_size}").shuffle(rest)
        pool = head + rest[:pool_size - len(head)]
    dropped = [w for w in pool if not keep(w)]
    dset = set(dropped)
    order = [w for w in near if w in dset]
    rest = sorted(dset - set(order))
    rng.shuffle(rest)
    sample = list(dict.fromkeys(order[:per] + rest[:per]))
    violations = []
    for w in sample:
        kept, _ = R.declared_offer([w], lines, m, ln, slot, [0])
        if kept:
            violations.append(w)
    return {"status": "filtered", "filtered": list(keep.filtered),
            "unfiltered": list(keep.unfiltered), "pool": len(pool),
            "dropped": len(dropped), "checked": len(sample),
            "violations": violations}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--per", type=int, default=40,
                    help="dropped words checked per (name, call, layout): "
                         "this many nearest to the call plus this many at random")
    ap.add_argument("--calls", default=",".join(CALLS))
    ap.add_argument("--layouts", default=",".join(LAYOUTS))
    ap.add_argument("--names", default="",
                    help="';'-separated relation names (default: every name)")
    ap.add_argument("--seed", type=int, default=20260928)
    ap.add_argument("--pool", type=int, default=0,
                    help="check a slice of this many words instead of the "
                         "whole lexicon (0 = the whole lexicon)")
    ap.add_argument("--json", default="")
    a = ap.parse_args(argv)
    names = [n for n in a.names.split(";") if n] or every_name()
    calls = [c for c in a.calls.split(",") if c]
    layouts = [x for x in a.layouts.split(",") if x]
    R = Reviser()
    rng = random.Random(a.seed)
    rows, bad, t0 = [], 0, time.time()
    for name in names:
        for layout in layouts:
            for call in calls:
                t = time.time()
                r = prove(R, name, call, layout, a.per, rng, a.pool or None)
                r.update(name=name, layout=layout, call=call,
                         seconds=round(time.time() - t, 2))
                rows.append(r)
                bad += len(r.get("violations", ()))
                if r.get("violations"):
                    print(f"VIOLATION {name} [{layout}] call={call}: "
                          f"{r['violations'][:8]}", flush=True)
    summary = {}
    for r in rows:
        key = (r["name"], r["layout"])
        s = summary.setdefault(key, {"filtered": 0, "unfiltered": 0,
                                     "refused": 0, "dropped": 0, "pool": 0,
                                     "checked": 0, "violations": 0})
        s[r["status"]] += 1
        s["dropped"] += r.get("dropped", 0)
        s["pool"] += r.get("pool", 0)
        s["checked"] += r.get("checked", 0)
        s["violations"] += len(r.get("violations", ()))
    for (name, layout), s in sorted(summary.items()):
        share = (f"{100 * s['dropped'] / s['pool']:.1f}% dropped"
                 if s["pool"] else "no requirement")
        print(f"{name:55} {layout:5}  filtered {s['filtered']}  "
              f"unfiltered {s['unfiltered']}  refused {s['refused']}  "
              f"{share}  checked {s['checked']}  violations {s['violations']}")
    n_f = sum(1 for s in summary.values() if s["filtered"])
    print(f"\n{len(summary)} (name, layout) cells: {n_f} with a requirement; "
          f"{sum(s['checked'] for s in summary.values())} dropped words "
          f"graded; {bad} violation(s); {time.time() - t0:.0f}s")
    if a.json:
        Path(a.json).write_text(json.dumps(rows, indent=1))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
