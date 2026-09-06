#!/usr/bin/env python3
"""THE IN-LINE RHYME RATE.  quality/INTERNAL_RHYME_PREREGISTRATION.md is the
registration; this file is the instrument and nothing here re-decides what
that document declared.  Owner ruling 2026-08-23: measure-first then adopt.

WHAT IT MEASURES.  Over the declared positive population (the negative
control's own `load_quatrains(cap_per_file=8, min_chars=12)`), the rate at
which English song verse places rhyme INSIDE the line — spans picked by the
SHIPPED `internal_matches` (theta = declaration + 0.05, window 3, stressed
anchors, greedy non-overlap), minus the two exclusions that keep this from
restating axes already measured elsewhere:

  1. both spans line-final  -> that pair IS the end-rhyme scheme
  2. relation REPEAT        -> identity is not rhyme (doctrine 3)

Ten calls per quatrain: 4 within-line, 6 cross-line (every unordered line
pair).  Line distance 0/1/2/3 is a reported split, never summed (doctrine
79/89).

THE NULL.  Within-quatrain shuffle of the NON-final whitespace tokens,
each line keeping its own non-final token COUNT and its final token in
place — vocabulary held, end-rhyme scheme held, placement destroyed.
Replicate r, quatrain q is seeded `(20260823 << 8) + r * 1_000_003 + q`
(doctrine 66: order-independent, no wall clock).  20 replicates, sizes
derived from the measured 0.085 s/quatrain cost, not guessed.

FALSIFIERS RUN FIRST and a violated one refuses at exit 2 before any
corpus number is read:
  F1  Poe's Raven quatrain yields >= 2 kept pairs (the instrument can see
      the canonical case through the exclusions), and its lore/door pair
      is EXCLUDED (the exclusion excises the scheme on the same fixture).
  F2  (AS AMENDED in the registration, 2026-08-23, before any corpus
      number was read) exclusion-exactness: the both-final pair count is
      exactly 1 on the Poe fixture (lore~door) and exactly 2 on the AABB
      fixture (plain~rain, hills~rills), and with exclusion 1 disabled
      in-process the AABB kept total rises by exactly that count.  The
      original "S1 = 0" spelling fired on its own false premise — the
      fixture's inspection missed whistled~distant (IH-S, 1.000) — and
      the exclusion itself never leaked; the amendment records both.
  F3  (during the run) the null is not the identity map: beyond quatrains
      with <= 1 movable token, identity shuffles < 1%.

--check re-derives the OBSERVED arm exactly and replicates 1 and 20
exactly against `data/internal_rhyme_eng.tsv`, exit 3 on drift (the
bounded-cost spelling the preregistration's amendment names).

Verbs:
  python3 quality/internal_rhyme_rate.py            # falsifiers + full run
  python3 quality/internal_rhyme_rate.py --falsifiers-only
  python3 quality/internal_rhyme_rate.py --check
"""

import json
import multiprocessing as mp
import os
import random
import sys
import time
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.dirname(HERE) not in sys.path:
    sys.path.insert(0, os.path.dirname(HERE))

from lyric_harness import Declaration, Lexicon, internal_matches  # noqa: E402
from quality.negative_control import load_quatrains  # noqa: E402

SEED_BASE = 20260823
N_REPLICATES = 20
ARTIFACT = os.path.join(os.path.dirname(HERE), "data", "internal_rhyme_eng.tsv")

#: F1 — probed live before registration: dreary~weary RHYME on the first
#: line.  lore/door is the end-rhyme pair the exclusion must excise.
RAVEN = [
    "Once upon a midnight dreary, while I pondered, weak and weary",
    "Over many a quaint and curious volume of forgotten lore",
    "While I nodded, nearly napping, suddenly there came a tapping",
    "As of some one gently rapping, rapping at my chamber door",
]

#: F2 — the AABB fixture.  Its first construction claimed "the ONLY sound
#: repetition is the perfect AABB end rhyme", and that claim was FALSE on
#: first measurement (whistled~distant share IH-S at 1.000; No~frozen share
#: open OW) — kept per doctrine 17 because the false inspection is what the
#: amended F2 exists to remember.  The fixture's real job needs only its
#: end-rhyme scheme: plain~rain and hills~rills are the two admitted
#: both-final pairs the exclusion must excise, exactly.
AABB_ONLY = [
    "The falcon rode above the windy plain",
    "No shelter met his eye but bitter rain",
    "A shepherd whistled under distant hills",
    "His flock had wandered past the frozen rills",
]

_LEX = None
_DECL = None


def _init_worker():
    global _LEX, _DECL
    _LEX = Lexicon()
    _DECL = Declaration()


def measure_quatrain(lex, decl, lines, _keep_both_final=False):
    """The 10 calls, the two exclusions, the three statistics — one place.

    Returns a plain dict so it crosses a Pool boundary.  `totals` is kept
    per line so the null arm's syllable drift is computable at report time
    without re-reading the observed lines.

    `_keep_both_final` exists for the amended F2 falsifier ONLY — it is the
    in-process mutation that proves exclusion 1 is load-bearing and exact.
    No measurement path sets it.
    """
    covered = [set() for _ in lines]
    totals = [0] * len(lines)
    kept = Counter()          # line distance -> kept pair count
    excl = Counter()          # "both_final" / "repeat"
    rels = Counter()          # relation -> kept pair count
    for i, line in enumerate(lines):
        picked, nA, _ = internal_matches(lex, line, decl)
        totals[i] = nA
        for p in picked:
            if p["relation"] == "REPEAT":
                excl["repeat"] += 1
                continue
            kept[0] += 1
            rels[p["relation"]] += 1
            covered[i].update(range(*p["a_syll"]))
            covered[i].update(range(*p["b_syll"]))
    for i in range(len(lines)):
        for j in range(i + 1, len(lines)):
            picked, nA, nB = internal_matches(lex, lines[i], decl,
                                              text_b=lines[j])
            for p in picked:
                if p["relation"] == "REPEAT":
                    excl["repeat"] += 1
                    continue
                if p["a_syll"][1] == nA and p["b_syll"][1] == nB:
                    excl["both_final"] += 1
                    if not _keep_both_final:
                        continue
                kept[j - i] += 1
                rels[p["relation"]] += 1
                covered[i].update(range(*p["a_syll"]))
                covered[j].update(range(*p["b_syll"]))
    return {
        "num": sum(len(s) for s in covered),
        "den": sum(totals),
        "totals": totals,
        "kept": dict(kept),
        "excl": dict(excl),
        "rels": dict(rels),
    }


def shuffle_nonfinal(lines, rng):
    """The registered null: non-final whitespace tokens shuffled across the
    quatrain, each line keeping its non-final COUNT and its final token.

    Returns (new_lines, identity, movable) — identity is a claim about the
    token SEQUENCE (a shuffle that reprints the same words in the same
    slots is the identity map whatever the object permutation did)."""
    toks = [l.split() for l in lines]
    pool = [w for t in toks for w in t[:-1]]
    perm = pool[:]
    rng.shuffle(perm)
    identity = perm == pool
    out, k = [], 0
    for t in toks:
        n = len(t) - 1
        out.append(" ".join(perm[k:k + n] + t[-1:]))
        k += n
    return out, identity, len(pool)


def _work_observed(args):
    qidx, lines = args
    return qidx, measure_quatrain(_LEX, _DECL, lines)


def _work_null(args):
    qidx, lines, rep = args
    rng = random.Random((SEED_BASE << 8) + rep * 1_000_003 + qidx)
    shuffled, identity, movable = shuffle_nonfinal(lines, rng)
    m = measure_quatrain(_LEX, _DECL, shuffled)
    m["identity"] = identity
    m["movable"] = movable
    return qidx, m


def summarize(results):
    """Pool one arm's per-quatrain dicts into the artifact row's columns."""
    num = sum(r["num"] for r in results)
    den = sum(r["den"] for r in results)
    kept = Counter()
    excl = Counter()
    rels = Counter()
    per_q = []
    zero_den = 0
    for r in results:
        kept.update(r["kept"])
        excl.update(r["excl"])
        rels.update(r["rels"])
        if r["den"]:
            per_q.append(r["num"] / r["den"])
        else:
            zero_den += 1
    per_q.sort()
    n = len(per_q)

    def q(p):
        return round(per_q[min(n - 1, int(p * n))], 4) if n else 0.0

    return {
        "num": num, "den": den,
        "rate": round(num / den, 6) if den else 0.0,
        "q25": q(0.25), "q50": q(0.50), "q75": q(0.75),
        "kept_d0": kept.get(0, 0), "kept_d1": kept.get(1, 0),
        "kept_d2": kept.get(2, 0), "kept_d3": kept.get(3, 0),
        "excl_both_final": excl.get("both_final", 0),
        "excl_repeat": excl.get("repeat", 0),
        "rel_rhyme": rels.get("RHYME", 0),
        "rel_rime_riche": rels.get("RIME_RICHE", 0),
        "rel_assonance": rels.get("ASSONANCE", 0),
        "rel_consonance": rels.get("CONSONANCE", 0),
        "zero_den_quatrains": zero_den,
    }


COLUMNS = ("arm rep seed n_quatrains num den rate q25 q50 q75 "
           "kept_d0 kept_d1 kept_d2 kept_d3 excl_both_final excl_repeat "
           "rel_rhyme rel_rime_riche rel_assonance rel_consonance "
           "zero_den_quatrains identity_shuffles low_movable "
           "syll_drift").split()


def _row(arm, rep, seed, n, summ, identity=0, low_movable=0, drift=""):
    vals = {"arm": arm, "rep": rep, "seed": seed, "n_quatrains": n,
            "identity_shuffles": identity, "low_movable": low_movable,
            "syll_drift": drift}
    vals.update(summ)
    return "\t".join(str(vals[c]) for c in COLUMNS)


def falsifiers(lex, decl, verbose=True):
    """F1 and F2 (as amended).  Returns [] or a list of violation strings."""
    bad = []
    m = measure_quatrain(lex, decl, RAVEN)
    n_kept = sum(m["kept"].values())
    raven_bf = m["excl"].get("both_final", 0)
    if n_kept < 2:
        bad.append(f"F1 VIOLATED: Raven quatrain kept {n_kept} pairs (< 2)")
    if raven_bf != 1:
        bad.append(f"F2 VIOLATED: Raven both-final count {raven_bf} != 1 "
                   f"(lore~door is the one admitted scheme pair)")
    if verbose:
        print(f"F1  Raven: kept {n_kept} pairs "
              f"(d0={m['kept'].get(0, 0)}, d1={m['kept'].get(1, 0)}, "
              f"d2={m['kept'].get(2, 0)}, d3={m['kept'].get(3, 0)}), "
              f"excluded both_final={raven_bf} "
              f"repeat={m['excl'].get('repeat', 0)} -> "
              f"{'PASS' if n_kept >= 2 else 'FAIL'}")
    m2 = measure_quatrain(lex, decl, AABB_ONLY)
    aabb_bf = m2["excl"].get("both_final", 0)
    if aabb_bf != 2:
        bad.append(f"F2 VIOLATED: AABB both-final count {aabb_bf} != 2 "
                   f"(plain~rain and hills~rills are the scheme)")
    m2_mut = measure_quatrain(lex, decl, AABB_ONLY, _keep_both_final=True)
    kept_delta = sum(m2_mut["kept"].values()) - sum(m2["kept"].values())
    if kept_delta != aabb_bf:
        bad.append(f"F2 VIOLATED: disabling exclusion 1 moved the kept "
                   f"total by {kept_delta}, not by the both-final count "
                   f"{aabb_bf} — the exclusion is not exact")
    if verbose:
        ok = aabb_bf == 2 and kept_delta == aabb_bf and raven_bf == 1
        print(f"F2  exclusion-exactness: Raven both_final={raven_bf} "
              f"(expect 1), AABB both_final={aabb_bf} (expect 2), "
              f"mutation kept-delta={kept_delta} (expect {aabb_bf}) -> "
              f"{'PASS' if ok else 'FAIL'}")
    return bad


def run_arm(pool, work_fn, items, label):
    t0 = time.time()
    out = [None] * len(items)
    for qidx, m in pool.imap_unordered(work_fn, items, chunksize=32):
        out[qidx] = m
    print(f"  {label}: {time.time() - t0:.0f}s", flush=True)
    return out


def main(argv):
    check = "--check" in argv
    falsifiers_only = "--falsifiers-only" in argv
    lex, decl = Lexicon(), Declaration()
    print(f"instrument: internal_matches theta={decl.theta_rhyme + 0.05} "
          f"(declaration {decl.theta_rhyme} + 0.05), max_span=3 (syllables; E-3)")

    bad = falsifiers(lex, decl)
    if bad:
        for b in bad:
            print(b)
        print("REFUSED — a falsifier fired; no corpus number is read")
        return 2
    if falsifiers_only:
        return 0

    quats = load_quatrains(cap_per_file=8, min_chars=12)
    lines_only = [q[2] for q in quats]
    n = len(lines_only)
    print(f"population: {n} quatrains "
          f"({len({q[1] for q in quats})} files, "
          f"{len({q[0] for q in quats})} groups)")

    reps = [1, N_REPLICATES] if check else list(range(1, N_REPLICATES + 1))
    workers = min(os.cpu_count() or 4, 8)
    rows = []
    with mp.Pool(workers, initializer=_init_worker) as pool:
        obs = run_arm(pool, _work_observed,
                      list(enumerate(lines_only)), "observed")
        obs_summ = summarize(obs)
        rows.append(_row("observed", 0, "", n, obs_summ))
        obs_totals = [r["totals"] for r in obs]
        for rep in reps:
            res = run_arm(pool, _work_null,
                          [(i, ls, rep) for i, ls in enumerate(lines_only)],
                          f"null rep {rep}")
            identity = sum(1 for r in res
                           if r["identity"] and r["movable"] > 1)
            low_movable = sum(1 for r in res if r["movable"] <= 1)
            drift = (sum(abs(a - b)
                         for r, ot in zip(res, obs_totals)
                         for a, b in zip(r["totals"], ot))
                     / (4 * n))
            eligible = n - low_movable
            if eligible and identity / eligible >= 0.01:
                print(f"F3 VIOLATED at rep {rep}: {identity}/{eligible} "
                      f"identity shuffles (>= 1%) — the null cannot move")
                return 2
            summ = summarize(res)
            seed = (SEED_BASE << 8) + rep * 1_000_003
            rows.append(_row("null", rep, seed, n, summ,
                             identity=identity, low_movable=low_movable,
                             drift=round(drift, 4)))

    if check:
        if not os.path.exists(ARTIFACT):
            print(f"CHECK FAILED — {ARTIFACT} does not exist")
            return 3
        stored = {}
        with open(ARTIFACT, encoding="utf-8") as fh:
            for ln in fh:
                if ln.startswith("#") or not ln.strip():
                    continue
                parts = ln.rstrip("\n").split("\t")
                if parts[0] == "arm":
                    continue
                stored[(parts[0], parts[1])] = ln.rstrip("\n")
        drifted = []
        for row in rows:
            parts = row.split("\t")
            key = (parts[0], parts[1])
            if stored.get(key) != row:
                drifted.append(key)
        if drifted:
            print(f"CHECK FAILED — {len(drifted)} row(s) drifted: {drifted}")
            return 3
        print(f"CHECK PASSED — observed and replicates "
              f"{reps} re-derive exactly")
        return 0

    with open(ARTIFACT, "w", encoding="utf-8") as fh:
        fh.write("# data/internal_rhyme_eng.tsv — the in-line rhyme rate\n")
        fh.write("# registration: quality/INTERNAL_RHYME_PREREGISTRATION.md;"
                 " instrument: quality/internal_rhyme_rate.py\n")
        fh.write(f"# instrument coordinates: internal_matches theta="
                 f"{decl.theta_rhyme + 0.05} max_span=3 (syllables; E-3); population: "
                 f"negative_control.load_quatrains(cap_per_file=8, "
                 f"min_chars=12) = {n} quatrains\n")
        fh.write("# exclusions: both-spans-line-final (the end-rhyme "
                 "scheme), relation REPEAT (identity is not rhyme)\n")
        fh.write("\t".join(COLUMNS) + "\n")
        for row in rows:
            fh.write(row + "\n")
    print(f"wrote {ARTIFACT} ({len(rows)} rows)")

    null_rates = [float(r.split("\t")[COLUMNS.index("rate")])
                  for r in rows[1:]]
    obs_rate = obs_summ["rate"]
    above = sum(1 for x in null_rates if x >= obs_rate)
    print(f"\nE1: observed rate {obs_rate} vs null "
          f"[{min(null_rates)}, {max(null_rates)}] over "
          f"{len(null_rates)} replicates; "
          f"replicates >= observed: {above} "
          f"(empirical p = {(above + 1)}/{len(null_rates) + 1})")
    print("E1 " + ("SEPARATES — adoption may proceed per the registration"
                   if above == 0 else
                   "DOES NOT SEPARATE — the in-line axis is REFUSED at "
                   "this instrument; diagnose, do not tune (doctrine 19)"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
