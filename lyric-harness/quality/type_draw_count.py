#!/usr/bin/env python3
"""THE D2 COUNT: how the per-group type draw behaves over many seeded plans.

Owner-approved plan, 2026-10-27, D2: across 1,000 seeded plans, report the
proposed, rejected and delivered assignments by eligible type and request
condition, and check the delivered counts against the selection rule rather
than taking a passing sample as proof of equal odds.

Each group draws one type with equal odds over the eligible set
(`plan.eligible_types`); a type that has no valid placement for its group is
rejected and the group redraws from the types it has not rejected. So
PROPOSED counts every type a group drew, REJECTED those that did not fit, and
DELIVERED the type the group kept. A rejected type is carried to the next
group that can take it (`plan._assign_types`), so a type still carried when
its song ends is UNPLACED. Under equal odds the expected first
proposal per type is groups / |eligible|; `spread` reports the delivered
max/min ratio and a chi-square statistic against equal delivery.

Run: python3 quality/type_draw_count.py [--plans=1000] [--lines=N] [--jobs=N]
"""

import json
import os
import sys
from collections import Counter
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quality import plan as PL  # noqa: E402


def _one(job):
    seed, lines = job
    try:
        p = PL.make_plan(seed, lines=lines)
    except PL.PlanRefused as exc:
        return {"seed": seed, "refused": str(exc)[:200]}
    recs = p["choices"]["relations"]["groups"]
    return {"seed": seed, "lines": p["total_lines"],
            "unplaced": p["choices"]["relations"]["unplaced"],
            "records": [{"type": r["type"], "proposed": r["proposed"],
                         "rejected": [x["type"] for x in r["rejected"]],
                         "first": r["proposed"][0] if r["proposed"] else None}
                        for r in recs]}


def count(plans=1000, lines=None, jobs=None, first_seed=1):
    eligible = PL.eligible_types()
    with Pool(jobs or os.cpu_count()) as pool:
        rows = pool.map(_one, [(s, lines) for s in
                               range(first_seed, first_seed + plans)],
                        chunksize=8)
    proposed, rejected, delivered, first = Counter(), Counter(), Counter(), Counter()
    unplaced = Counter()
    refused = [r for r in rows if "refused" in r]
    groups = 0
    for r in rows:
        unplaced.update(r.get("unplaced", ()))
        for g in r.get("records", ()):
            groups += 1
            proposed.update(g["proposed"])
            rejected.update(g["rejected"])
            delivered[g["type"]] += 1
            if g["first"]:
                first[g["first"]] += 1
    n = len(eligible)
    exp = groups / n if n else 0
    chi = sum((delivered[t] - exp) ** 2 / exp for t in eligible) if exp else 0
    lo = min(delivered[t] for t in eligible) if eligible else 0
    hi = max(delivered[t] for t in eligible) if eligible else 0
    return {"plans": plans, "lines": lines, "refused_plans": len(refused),
            "groups": groups, "eligible": n,
            "expected_per_type": round(exp, 2),
            "per_type": {t: {"proposed": proposed[t], "first_draw": first[t],
                             "rejected": rejected[t],
                             "unplaced": unplaced[t],
                             "delivered": delivered[t]} for t in eligible},
            "delivered_min": lo, "delivered_max": hi,
            "delivered_chi_square": round(chi, 1),
            "chi_square_df": n - 1}


def main(argv):
    kw = {}
    for a in argv:
        k, _, v = a.lstrip("-").partition("=")
        kw[{"plans": "plans", "lines": "lines", "jobs": "jobs"}[k]] = int(v)
    rep = count(**kw)
    print(json.dumps(rep, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
