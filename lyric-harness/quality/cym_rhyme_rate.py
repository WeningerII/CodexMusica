#!/usr/bin/env python3
"""Welsh end-rhyme (*odl*) — every figure in `quality/RESULTS_CYM_RHYME.md`.

    python3 quality/cym_rhyme_rate.py            # the whole run
    python3 quality/cym_rhyme_rate.py --quick    # 20 replicates, for a smoke

WHY THIS FILE EXISTS RATHER THAN A PARAGRAPH IN THE MODULE. `fin.py` carried
its rates in its own docstring and, when they were finally executed, the two
most quotable tables in it turned out to be coordinates of a setting the module
does not ship. Every number below is printed with the rule that produced it and
re-derives from one command.

THE COUNTS ARE ALWAYS THREE (doctrine 79). `mandated` is what the form asks,
`judged` is what the phonology answered, `refused` is what it declined. Rates
are over JUDGED. A refusal in the numerator charges the comparator for the
notation's collapsed distinctions, which is exactly the error the sonnet
battery made for the whole life of the project.

EVERY RATE HAS ITS OWN NULL, AND EACH NULL STATES WHAT IT PRESERVES AND WHAT IT
DESTROYS (doctrine 63). Two are used:

  UNIT PERMUTATION   permute a printed unit's own end words among its own line
                     slots. PRESERVES that unit's exact end-word inventory --
                     its rime classes, its word lengths, its endings. DESTROYS
                     only WHICH slots the form pairs.
  POEM PERMUTATION   the cywydd is ONE 108-line block, so the unit permutation
                     above is a permutation of the whole poem, re-cut on the
                     original couplet boundaries.

Both are checked for the identity-map trap by measurement rather than by
reasoning. TWO diagnostics are printed on every arm and they answer different
questions (doctrines 63, 68): DIFFER is the share of replicates whose statistic
moves at all, and FROZEN is the share of individual pair-slots the permutation
cannot change. §4 is the row where they disagree, and it is the reason both are
here.
"""

import os
import random
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

from quality.phonology import cym, get  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SONG = os.path.join(ROOT, "corpus", "song")
CORPUS = os.path.join(ROOT, "corpus")
SEED = 20260811
N = 200

C = get("cym")

#: The staged Welsh files, split by what the form does at the line end.
CYWYDD = "cym_cynghanedd_llywelyn_goch_cywydd.txt"

#: Outside `corpus/song/`, and staged by an earlier round: the strict-metre
#: extractions of the same two GITenberg sources. Read here as ADDITIONAL
#: tradition tests, never pooled into a song rate -- one source, two
#: extractions, and pooling them would be doctrine 51's error.
STRICT = ("cym_alun_strict.txt", "cym_twm_or_nant_cywydd.txt")

#: THE READINGS. Four coordinates, and the sweep is over one at a time from the
#: shipped setting, never over the product -- an argmax over a wide sweep is
#: biased toward whichever end has more degrees of freedom (doctrine 19).
READINGS = (
    ("depth 1 (SHIPPED)", dict()),
    ("depth 2 (rich grade)", dict(depth=2)),
    ("prominent (ENGLISH PORT)", dict(rule="prominent")),
    ("diacritics=keep", dict(diacritics="keep")),
    ("glide=vocalic", dict(glide="vocalic")),
    ("glide=consonantal", dict(glide="consonantal")),
)


# ---------------------------------------------------------------- material

def units(path, marked=True):
    """-> [[end word per line]] over the file's printed units.

    THE UNIT RULE AND THE END-WORD RULE, both declared because every figure
    below is a function of them (doctrine 58). The unit is what the corpus
    prints as `[VERSE n]` / `[REFRAIN]` / `[CYWYDD]`; the end word is the last
    token `cym.WORD_RE` finds on the line, lowercased. `--- TITLE:` lines and
    `#` headers are the corpus's own notation and are separators, not lines.
    """
    out, cur = [], []
    for raw in open(path, encoding="utf-8"):
        t = raw.strip()
        if not t or (marked and (t.startswith("#") or t.startswith("--- "))):
            if cur:
                out.append(cur)
            cur = []
            continue
        if marked and t.startswith("[") and t.endswith("]"):
            if cur:
                out.append(cur)
            cur = []
            continue
        toks = [w for w in cym.WORD_RE.findall(cym.normalise(t))
                if w.strip("'-")]
        if toks:
            cur.append(toks[-1].lower())
    if cur:
        out.append(cur)
    return out


def song_files():
    return sorted(f for f in os.listdir(SONG)
                  if f.startswith("cym_") and f != CYWYDD)


# ---------------------------------------------------------------- the arms

class Cache:
    """`rhymes` memoised per reading. The nulls call it O(N x pairs) times."""

    def __init__(self, **kw):
        self.kw, self.d = kw, {}

    def __call__(self, a, b):
        k = (a, b)
        if k not in self.d:
            self.d[k] = C.rhymes(a, b, **self.kw)
        return self.d[k]


def counts(rh, pairs):
    """-> (true, false, refused). Three, never two."""
    t = f = n = 0
    for a, b in pairs:
        v = rh(a, b)
        if v is None:
            n += 1
        elif v:
            t += 1
        else:
            f += 1
    return t, f, n


def rate(t, f):
    return t / (t + f) if (t + f) else 0.0


def unit_null(rh, us, index, n=N, seed=SEED):
    """-> (sorted rates, FROZEN — the share of mandated pair-slots whose
    UNORDERED word pair the permutation cannot change).

    `index` maps a unit to the list of (i, j) slot pairs the form mandates in
    it. The permutation is WITHIN the unit, so the unit's own end-word
    inventory survives and only the pairing dies.

    FROZEN IS THE IDENTITY-MAP DIAGNOSTIC, and it is measured rather than
    reasoned about (doctrines 63, 68). `rhymes` is symmetric, so a pair-slot
    whose two words come back as the same UNORDERED pair returns the same
    verdict — it sits in both the observation and every replicate and can only
    dilute the excess. This repo has recorded the trap twice at the level of a
    whole statistic; the useful resolution is per pair-slot, because a null can
    be degenerate on PART of its material. Two live cases here: a two-line unit
    at offset 1 has exactly one pair and every permutation of two elements
    returns it, and the six-pair quatrain statistic of §4 is invariant outright.
    """
    rng = random.Random(seed)
    vals = []
    frozen = slots = 0
    for _r in range(n):
        t = f = 0
        for u in us:
            q = list(u)
            rng.shuffle(q)
            for i, j in index(u):
                slots += 1
                if {q[i], q[j]} == {u[i], u[j]}:
                    frozen += 1
                v = rh(q[i], q[j])
                if v is True:
                    t += 1
                elif v is False:
                    f += 1
        vals.append(rate(t, f))
    return (sorted(vals), (frozen / slots if slots else 1.0), vals)


def report(label, t, f, n_ref, vals, frozen, raw=(), note=""):
    """Prints the three counts, both tails of the empirical p, DIFFER and FROZEN.

    `p_hi` is the upward tail — the one a POSITIVE arm is read against.
    `p_lo` is the downward tail — the one a NEGATIVE arm is read against, and
    it is printed because a negative control at rate 0 has p_hi = 1.0000 by
    construction, which says nothing at all about whether it separates.

    `differ` is doctrine 68's prescription executed rather than quoted: the
    share of REPLICATES whose statistic differs from the observation at all.
    `frozen` is the finer, per-pair-slot version of the same question. They are
    not the same number and §4 is the row that shows why — a statistic can be
    fully invariant (differ 0.0%) while every individual slot still moves.
    """
    obs = rate(t, f)
    med = vals[len(vals) // 2]
    mx = vals[-1]
    p_hi = (sum(1 for v in vals if v >= obs) + 1) / (len(vals) + 1)
    p_lo = (sum(1 for v in vals if v <= obs) + 1) / (len(vals) + 1)
    differ = (sum(1 for v in (raw or vals) if abs(v - obs) > 1e-12)
              / max(len(raw or vals), 1))
    print("  %-30s mandated %5d judged %5d refused %4d | obs %6.2f%%  "
          "null med %5.2f%%  max %5.2f%%  excess %+6.2fpp  p_hi %.4f  "
          "p_lo %.4f  differ %5.1f%%  frozen %5.1f%%%s"
          % (label, t + f + n_ref, t + f, n_ref, 100 * obs, 100 * med,
             100 * mx, 100 * (obs - mx), p_hi, p_lo, 100 * differ,
             100 * frozen, ("  " + note) if note else ""))
    return dict(mandated=t + f + n_ref, judged=t + f, refused=n_ref, obs=obs,
                med=med, mx=mx, excess=obs - mx, p_hi=p_hi, p_lo=p_lo,
                differ=differ, frozen=frozen)


# ---------------------------------------------------------------- §1

def section1():
    print("\n" + "=" * 78)
    print("1 . THE CORPUS, COUNTED")
    print("=" * 78)
    tot = 0
    for f in [CYWYDD] + song_files():
        us = units(os.path.join(SONG, f))
        lines = sum(len(u) for u in us)
        tot += lines
        h = Counter(len(u) for u in us)
        print("  %-42s units %4d  lines %5d  len-hist %s"
              % (f, len(us), lines,
                 " ".join("%d:%d" % kv for kv in sorted(h.items())[:7])))
    print("  %-42s %16d lines over 5 files" % ("TOTAL", tot))
    for f in STRICT:
        ws = units(os.path.join(CORPUS, f), marked=False)
        print("  %-42s (outside corpus/song) lines %5d"
              % (f, sum(len(u) for u in ws)))


# ---------------------------------------------------------------- §2

def cywydd_arms(n=N):
    """-> (couplet pairs, straddling pairs) of the staged cywydd.

    THE NEGATIVE ARM IS THE STRADDLE. A cywydd is rhymed couplets, so the pair
    (2k, 2k+1) is MANDATED and (2k+1, 2k+2) is not. Same text, same words,
    same instrument, same line distance -- only the form's parity differs, and
    parity is typographic, so the control is not defined in terms of the
    quantity it controls (doctrine 14).
    """
    ws = [w for u in units(os.path.join(SONG, CYWYDD)) for w in u]
    coup = [(ws[i], ws[i + 1]) for i in range(0, len(ws) - 1, 2)]
    strad = [(ws[i], ws[i + 1]) for i in range(1, len(ws) - 1, 2)]
    return ws, coup, strad


def section2(n=N):
    print("\n" + "=" * 78)
    print("2 . THE CYWYDD — the positive arm and its own negative arm")
    print("=" * 78)
    ws, coup, strad = cywydd_arms()
    print("  %s: %d lines, %d mandated couplets, %d straddling pairs"
          % (CYWYDD, len(ws), len(coup), len(strad)))
    print("  the form: 7-syllable rhymed couplets. The corpus header's own "
          "word.\n")

    def index_couplet(u):
        return [(i, i + 1) for i in range(0, len(u) - 1, 2)]

    def index_straddle(u):
        return [(i, i + 1) for i in range(1, len(u) - 1, 2)]

    out = {}
    for label, kw in READINGS:
        rh = Cache(**kw)
        t, f, r = counts(rh, coup)
        vals, frozen, raw = unit_null(rh, [ws], index_couplet, n)
        out[label] = report(label, t, f, r, vals, frozen, raw)
    print()
    print("  NEGATIVE ARM — the straddling pairs, same text, same instrument:")
    for label, kw in READINGS[:1]:
        rh = Cache(**kw)
        t, f, r = counts(rh, strad)
        vals, frozen, raw = unit_null(rh, [ws], index_straddle, n)
        report(label, t, f, r, vals, frozen, raw)
    print()
    print("  THE FALSE AND REFUSED COUPLETS, named (doctrine 89: a rate that "
          "hides its\n  exceptions is not a finding):")
    rh = Cache()
    for k, (a, b) in enumerate(coup):
        v = rh(a, b)
        if v is not True:
            print("     couplet %2d  L%-3d %-14s L%-3d %-14s -> %-5s  %s | %s"
                  % (k + 1, 2 * k + 1, a, 2 * k + 2, b, v,
                     C.rimes(a), C.rimes(b)))
    return out


# ---------------------------------------------------------------- §3

def section3(n=N):
    print("\n" + "=" * 78)
    print("3 . THE SONGS — the offset profile, because no slot was declared")
    print("=" * 78)
    print("  The Welsh free-metre song is not one form. `offset k` asks "
          "whether line i\n  rhymes line i+k, pooled over every i with both "
          "inside one printed unit.\n  Imposing a 2&4 slot on all four books "
          "would be a selection rule nobody\n  declared as one -- which is "
          "the defect RESULTS_FIN_RHYME.md §1a found in\n  its own module.\n")
    print("  %-32s %6s | %-34s %-34s %-34s"
          % ("file", "units", "offset 1", "offset 2", "offset 3"))
    out = {}
    for f in song_files():
        us = units(os.path.join(SONG, f))
        cells = []
        for k in (1, 2, 3):
            rh = Cache()
            pairs = [(u[i], u[i + k]) for u in us for i in range(len(u) - k)]
            t, fa, r = counts(rh, pairs)

            def index(u, k=k):
                return [(i, i + k) for i in range(len(u) - k)]
            vals, frozen, _raw = unit_null(rh, us, index, n)
            obs, mx = rate(t, fa), vals[-1]
            p = (sum(1 for v in vals if v >= obs) + 1) / (n + 1)
            cells.append("%5.1f%%/%5.1f%% %+6.1f p%.3f fz%4.1f%%"
                         % (100 * obs, 100 * mx, 100 * (obs - mx), p,
                            100 * frozen))
            out[(f, k)] = dict(mandated=t + fa + r, judged=t + fa, refused=r,
                               obs=obs, mx=mx, p=p, frozen=frozen)
        print("  %-32s %6d | %s" % (f.replace("cym_song_", ""), len(us),
                                    " ".join(cells)))
    print("\n  obs/null-max, excess in points, empirical p. Every cell's "
          "mandated/judged/\n  refused triple is in §6.")
    return out


# ---------------------------------------------------------------- §4

def section4(n=N):
    print("\n" + "=" * 78)
    print("4 . THE ARM THAT RECORDED 108 of 108 REFUSED")
    print("=" * 78)
    print("  `quality/negative_control.py --langs` takes four-line blocks, "
          "cap 8 per file,\n  and asks all six pairs. It printed "
          "`cym 5 18 108 0 108 - | NO rhymes PREDICATE`.\n  Same material, "
          "same six pairs, now with a predicate:\n")
    quats = []
    for name in sorted(os.listdir(SONG)):
        if not name.startswith("cym_"):
            continue
        taken = 0
        for blk in units(os.path.join(SONG, name)):
            if taken >= 8:
                break
            if len(blk) == 4:
                quats.append(blk)
                taken += 1
    print("  four-line blocks: %d, so mandated = 6 x %d = %d\n"
          % (len(quats), len(quats), 6 * len(quats)))
    pairs = [(u[i], u[j]) for u in quats
             for i in range(4) for j in range(i + 1, 4)]

    def index(u):
        return [(i, j) for i in range(4) for j in range(i + 1, 4)]

    for label, kw in READINGS[:3]:
        rh = Cache(**kw)
        t, f, r = counts(rh, pairs)
        vals, frozen, raw = unit_null(rh, quats, index, n)
        report(label, t, f, r, vals, frozen, raw)
    print("\n  THE NULL ON THOSE ROWS IS THE IDENTITY MAP, AND `differ 0.0%` "
          "IS HOW IT SAYS SO.\n  ALL SIX unordered pairs of a four-line unit "
          "are the same six pairs after any\n  permutation of the four end "
          "words, and `rhymes` is symmetric — so the\n  statistic is a "
          "symmetric function of the unit's end-word multiset and the\n  "
          "randomisation returns the observation exactly, every replicate. "
          "obs == null\n  median == null max, excess +0.00pp, p_hi 1.0000. "
          "This is doctrine 63's Kalevala\n  case and doctrine 68's ghazal "
          "case in a THIRD mechanism: not a symmetric\n  predicate and not "
          "identical elements, but a statistic that pools every pair the\n  "
          "permutation could have moved between.\n"
          "  `frozen 16.3%` on the same rows is why DIFFER and FROZEN are "
          "BOTH printed: 4\n  of the 24 permutations of a quatrain fix any "
          "given slot's pair, so an\n  individual slot moves 83.7% of the "
          "time while the POOLED statistic never\n  moves at all. A per-slot "
          "check alone would have passed this null.\n"
          "  Three counts stand and the RATE does not. What the null can move "
          "is WHICH\n  DISTANCE each rhyming pair lands at, which is exactly "
          "the statistic\n  `negative_control.py --langs` already uses:\n")
    for label, kw in READINGS[:2]:
        rh = Cache(**kw)
        got = []
        for u in quats:
            s = set()
            for i in range(4):
                for j in range(i + 1, 4):
                    if rh(u[i], u[j]) is True:
                        s.add((i, j))
            got.append(s)
        n_rh = sum(len(g) for g in got)

        def prof(perms):
            c = Counter()
            for g, p in zip(got, perms):
                pos = {o: k for k, o in enumerate(p)}
                for (i, j) in g:
                    c[abs(pos[i] - pos[j])] += 1
            tot = sum(c.values()) or 1
            return {d: c.get(d, 0) / tot for d in (1, 2, 3)}

        obs_prof = prof([(0, 1, 2, 3)] * len(quats))
        rng = random.Random(SEED)
        nulls = []
        for _ in range(n):
            perms = []
            for _ in quats:
                p = [0, 1, 2, 3]
                rng.shuffle(p)
                perms.append(tuple(p))
            nulls.append(prof(perms))
        ref = {d: sum(x[d] for x in nulls) / n for d in (1, 2, 3)}

        def tv(a, b):
            return 0.5 * sum(abs(a[d] - b[d]) for d in (1, 2, 3))
        obs = tv(obs_prof, ref)
        vals = sorted(tv(x, ref) for x in nulls)
        p = (sum(1 for v in vals if v >= obs) + 1) / (n + 1)
        print("  %-26s rhyming pairs %4d | d1 %.4f d2 %.4f d3 %.4f | "
              "TV obs %.4f  null MAX %.4f  gap %+.4f  p %.4f"
              % (label, n_rh, obs_prof[1], obs_prof[2], obs_prof[3],
                 obs, vals[-1], obs - vals[-1], p))
    print("\n  BELOW THE n=30 PAIR FLOOR IS NOT THE PROBLEM HERE, THE "
          "MATERIAL IS: 18 blocks\n  from a corpus of 809 printed units. "
          "The four-line block is a TYPOGRAPHIC\n  selection rule and the "
          "Welsh song is not written in fours — 172 of the 305\n  hwiangerddi "
          "units are, 77 of 403 Mynyddog units are, and the cap of 8 per "
          "file\n  then throws away all but 18. §3 is the arm to read.")


# ---------------------------------------------------------------- §5

def section5(n=20000, seed=SEED):
    print("\n" + "=" * 78)
    print("5 . FALSE-POSITIVE RATE (doctrines 16, 22) — UNCALIBRATED")
    print("=" * 78)
    pool = []
    for f in [CYWYDD] + song_files():
        for u in units(os.path.join(SONG, f)):
            pool.extend(u)
    print("  %d line-final TOKENS from all 5 staged files; %d pairs drawn "
          "WITH\n  replacement, seed %d. The DRAW IS THE COORDINATE: "
          "RESULTS_FIN_RHYME.md §6\n  found the spread over sampling rules "
          "larger than the gap between two\n  grades, so it is stated here "
          "rather than left to be reconstructed.\n" % (len(pool), n, seed))
    rng = random.Random(seed)
    draw = [(rng.choice(pool), rng.choice(pool)) for _ in range(n)]
    for label, kw in READINGS:
        c = cym.pair_census(C, draw, **kw)
        print("  %-30s mandated %6d judged %6d refused %5d (%.2f%%) | "
              "admits %6.3f%%  %s"
              % (label, c["mandated"], c["judged"], c["refused"],
                 100 * c["refused"] / c["mandated"],
                 100 * c["true"] / max(c["judged"], 1),
                 dict(c["by_code"])))
    print("\n  UNCALIBRATED. These are the readings' chance rates on this "
          "corpus. Nothing\n  was swept, nothing targeted, no threshold set "
          "to hit one of them -- there is\n  no threshold in this relation at "
          "all; `rhymes` is exact tuple equality.")


# ---------------------------------------------------------------- §6

def section6():
    print("\n" + "=" * 78)
    print("6 . WHERE THE REFUSAL FALLS (doctrines 67, 79, 88)")
    print("=" * 78)
    toks, ends = [], []
    for f in [CYWYDD] + song_files():
        for raw in open(os.path.join(SONG, f), encoding="utf-8"):
            t = raw.strip()
            if not t or t.startswith("#") or t.startswith("--- ") or (
                    t.startswith("[") and t.endswith("]")):
                continue
            ws = [w for w in cym.WORD_RE.findall(cym.normalise(t))
                  if w.strip("'-")]
            toks.extend(x.lower() for x in ws)
            if ws:
                ends.append(ws[-1].lower())
    for name, pop in (("ALL tokens", toks), ("line-final tokens", ends)):
        c = cym.readability_census(C, pop)
        print("  %-20s total %6d  read %6d  refused %4d  defective %4d  %s"
              % (name, c["total"], c["read"], c["refused"], c["defective"],
                 dict(c["by_code"])))
    print()
    print("  THE PAIR-LEVEL REFUSAL, which the word-level census cannot see:")
    _, coup, strad = cywydd_arms()
    pool = ends
    rng = random.Random(SEED)
    rand = [(rng.choice(pool), rng.choice(pool)) for _ in range(20000)]
    for name, pairs in (("MANDATED (cywydd couplets)", coup),
                        ("the straddling pairs", strad),
                        ("RANDOM line-final tokens", rand)):
        c = cym.pair_census(C, pairs)
        print("  %-30s mandated %6d judged %6d refused %4d (%.2f%%)  %s"
              % (name, c["mandated"], c["judged"], c["refused"],
                 100 * c["refused"] / c["mandated"], dict(c["by_code"])))
    print("\n  `undecided_glide` is the AIMED refusal: it is a property of the "
          "PAIR, so it\n  fires only where the collapsed distinction actually "
          "decides the answer.\n  The other two are word properties and are "
          "blunt by construction.")
    print("  Word-level markers: %d of %d line-final tokens carry the "
          "ambiguous glide;\n  %d are PROCLITICS, which is what makes "
          "rule='prominent' refuse."
          % (sum(1 for w in ends if C.glide_ambiguous(w)), len(ends),
             sum(1 for w in ends if w in cym.PROCLITICS)))


# ---------------------------------------------------------------- §7

def section7(n=N):
    print("\n" + "=" * 78)
    print("7 . IS THE NULL THE IDENTITY MAP? (doctrines 63, 68) — MEASURED")
    print("=" * 78)
    rng = random.Random(SEED)
    for f in [CYWYDD] + song_files():
        us = units(os.path.join(SONG, f))
        live = [u for u in us if len(u) > 1]
        same = tot = 0
        degen = sum(1 for u in live if len(set(u)) == 1)
        for _ in range(n):
            for u in live:
                q = list(u)
                rng.shuffle(q)
                tot += 1
                same += 1 if tuple(q) == tuple(u) else 0
        print("  %-42s permutable units %4d  replicate-units identical to "
              "the printed one %6.2f%%  all-one-word units %d"
              % (f, len(live), 100 * same / max(tot, 1), degen))
    print("\n  Doctrine 68's own prescription, at the level of the material: "
          "the share of\n  permuted UNITS that come back byte-for-byte. It is "
          "not zero anywhere and it\n  is 9.3% in the hwiangerddi, because a "
          "nursery-rhyme book is full of two-line\n  units and half the "
          "permutations of two elements are the identity. That is\n  "
          "doctrine 68's mechanism -- permuting a set that is too small or "
          "too uniform to\n  move -- arriving from unit LENGTH rather than "
          "from a radif.\n"
          "  THREE SHAPES ARE NOW MEASURED IN THIS CELL AND NO ONE OF THEM "
          "IMPLIES THE OTHERS:\n    per-unit    the permutation returns the "
          "unit (this table)\n    per-slot    the permutation returns that "
          "slot's unordered pair (FROZEN)\n    per-statistic  the "
          "permutation returns the pooled rate (DIFFER, and §4)\n"
          "  §4 has differ 0.0% with frozen 16.3% and per-unit 0.0%: two of "
          "the three\n  diagnostics pass an entirely degenerate null.")


# ---------------------------------------------------------------- §8

def section8():
    print("\n" + "=" * 78)
    print("8 . THE TRADITION TEST (doctrine 37)")
    print("=" * 78)
    print("  Every pair is a real line-end from a staged file, named with its "
          "line.\n")
    cases = [
        ("cywydd L1/L2  hoew-fardd : fardd", ("hoewfardd", "fardd"),
         dict(), True),
        ("  ...under the ENGLISH PORT", ("hoewfardd", "fardd"),
         dict(rule="prominent"), False),
        ("cywydd L3/L4  heddiw : lliw", ("heddiw", "lliw"), dict(), True),
        ("cywydd L9/L10 Wynedd : bedd", ("wynedd", "bedd"), dict(), True),
        ("cywydd L31/L32 sidan : lan (circumflex)", ("sidan", "lân"),
         dict(), True),
        ("  ...with diacritics='keep'", ("sidan", "lân"),
         dict(diacritics="keep"), False),
        ("cywydd L55/L56 fynych : wych (glide)", ("fynych", "wych"),
         dict(), None),
        ("  ...decided vocalic", ("fynych", "wych"),
         dict(glide="vocalic"), False),
        ("  ...decided consonantal", ("fynych", "wych"),
         dict(glide="consonantal"), True),
        ("cywydd straddle L2/L3 fardd : heddiw", ("fardd", "heddiw"),
         dict(), False),
        ("treiglad tan : dan (both in the corpus)", ("tân", "dân"),
         dict(), True),
        ("treiglad bran : fran", ("brân", "frân"), dict(), True),
        ("treiglad mor : for", ("môr", "fôr"), dict(), True),
        ("a proclitic line-end, ENGLISH PORT", ("yn", "hyn"),
         dict(rule="prominent"), None),
    ]
    ok = 0
    for name, (a, b), kw, want in cases:
        got = C.rhymes(a, b, **kw)
        ok += got is want
        print("  %-44s expected %-5s got %-5s  %s"
              % (name, want, got, "ok" if got is want else "MISMATCH"))
    print("\n  %d of %d" % (ok, len(cases)))
    print("\n  THE SAME TEST ON THE TWO STRICT-METRE FILES OUTSIDE "
          "corpus/song/, staged by an\n  earlier round. `cym_twm_or_nant_"
          "cywydd.txt` is ONE cywydd and its couplets are\n  at even line "
          "indices, so the parity cut is the form. "
          "`cym_alun_strict.txt` is\n  1,558 lines of SEVERAL awdl and cywydd "
          "pieces with no unit markers, so a single\n  global parity cannot "
          "be its couplet boundary and neither column below is the\n  form's "
          "own arm — printed as an aggregate and labelled as one, not read "
          "as a\n  result. (An awdl is monorhymed across many lines, which is "
          "why both of its\n  columns are high.)")
    for f in STRICT:
        ws = [w for u in units(os.path.join(CORPUS, f), marked=False)
              for w in u]
        for label, kw in (("depth 1 (SHIPPED)", dict()),
                          ("diacritics=keep", dict(diacritics="keep")),
                          ("prominent (PORT)", dict(rule="prominent"))):
            rh = Cache(**kw)
            ev = counts(rh, [(ws[i], ws[i + 1])
                             for i in range(0, len(ws) - 1, 2)])
            od = counts(rh, [(ws[i], ws[i + 1])
                             for i in range(1, len(ws) - 1, 2)])
            print("    %-32s %-20s couplet-parity %4d/%4d = %5.1f%%   "
                  "straddle %4d/%4d = %5.1f%%"
                  % (f, label, ev[0], ev[0] + ev[1],
                     100 * rate(ev[0], ev[1]), od[0], od[0] + od[1],
                     100 * rate(od[0], od[1])))


# ---------------------------------------------------------------- §9

def section9():
    print("\n" + "=" * 78)
    print("9 . REPEAT — the trap that made whitman.txt ineligible")
    print("=" * 78)
    print("  Doctrine 3: identity is not rhyme. A Welsh song corpus is full of "
          "refrains,\n  so a `rhymes()` that never typed REPEAT would report "
          "a refrain as a rhyme.\n")
    for f in [CYWYDD] + song_files():
        us = units(os.path.join(SONG, f))
        c = Counter()
        for u in us:
            for i in range(len(u) - 1):
                for k in (1, 2):
                    if i + k >= len(u):
                        continue
                    t = C.relation_type(u[i], u[i + k])
                    if t is not None:
                        c[t] += 1
        tot = sum(c[k] for k in ("REPEAT", "RIME_RICHE", "RHYME"))
        print("  %-42s of %5d TRUE verdicts: REPEAT %4d (%5.1f%%)  "
              "RIME_RICHE %3d  RHYME %4d"
              % (f, tot, c["REPEAT"], 100 * c["REPEAT"] / max(tot, 1),
                 c["RIME_RICHE"], c["RHYME"]))
    print("\n  Tails of the TRUE non-REPEAT pairs of the cywydd (the "
          "shared-grammatical-\n  ending diagnostic; this module types no "
          "such relation and says why):")
    _, coup, _ = cywydd_arms()
    tails = Counter()
    for a, b in coup:
        if C.relation_type(a, b) == "RHYME":
            tails[C.shared_tail(a, b)] += 1
    print("   ", tails.most_common(14))


def main(argv):
    n = 20 if "--quick" in argv else N
    print("quality/cym_rhyme_rate.py — Welsh end-rhyme (odl)")
    print("seed %d, %d replicates" % (SEED, n))
    print("declaration:")
    for k, v in C.rhyme_declaration().items():
        print("  %-22s %s" % (k, " ".join(str(v).split())[:120]))
    section1()
    section2(n)
    section3(n)
    section4(n)
    section5()
    section6()
    section7(n)
    section8()
    section9()
    print("\n" + "=" * 78)
    print("battery.py is the English comparator and nothing here touches it. "
          "Run it.")


if __name__ == "__main__":
    main(sys.argv[1:])
