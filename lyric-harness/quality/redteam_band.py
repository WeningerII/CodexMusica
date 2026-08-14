#!/usr/bin/env python3
"""RED TEAM for the conjunctive band — generate counterexamples mechanically.

WHY THIS EXISTS

This repo has two kinds of adversary already and neither one attacks the CODE.
The nulls attack our RESULTS (line permutation, shuffled controls, matched
redeals). `quality/revise.py` attacks the WRITING (it rejected a revision that
fixed nine findings and introduced two). Nothing attacks the comparator, and
every comparator test in the repo is a POSITIVE case: someone wrote
`nation`/`station` and checked that it passes.

That is how the head-alignment defect survived from the first commit.
`channel_agreement` compared `anc_a[i]` with `anc_b[i]` — flush LEFT — while
rhyme aligns flush RIGHT. For two anchors of equal length the two computations
are identical, and a test author reaching for an example reaches for two words
of equal length. On the 152 sonnets, 67.8% of candidate anchor-span pairs are
UNEQUAL length and the two alignments disagree on 79.9% of those.

The lesson generalises past that one bug: a positive-case suite cannot find a
rule that is too GENEROUS, because a generous rule passes every positive case
by construction. You have to go looking for the false positives.

WHAT IS VERIFIABLE HERE, AND WHAT IS NOT

The band's question — "do the nucleus and the coda AGREE?" — has a reading that
needs no human judgement at all: STRICT IDENTITY of the tail-aligned nucleus
strings and coda tuples, straight out of CMUdict. That is computable, so the
harness's answer can be diffed against it for any pair, at any scale, forever.

**Strict identity is NOT the ground truth for RHYME, and this file does not
claim it is.** Near rhyme, slant rhyme and the whole graded band exist on
purpose (doctrine 3/24) and a harness that only admitted identity would be
useless. What identity gives is a REFERENCE LINE. Every disagreement is a place
where the graded band reaches further than identity does, and the useful output
is those cases RANKED by how far the reach was — because a pair admitted at a
nucleus similarity of 0.603 against a hand-set threshold of 0.600 is a coin
flip wearing a verdict, and a pair admitted at 0.95 is not.

So this file answers doctrine 22 for the band: state a threshold as a
FALSE-POSITIVE RATE, not as a point on a scale. `theta_nucleus = 0.6` is a
number nobody has ever seen the consequences of. The sweep prints them.

WHAT WAS ADDED 2026-08-11, AND WHY IT IS A DIFFERENT QUESTION

Sweeping a threshold assumes the SHAPE is right and only the cut is in doubt.
Sections 4-6 stop assuming that. The nucleus channel is a scalar cut on a
graded vowel-similarity matrix, and the whole space is enumerable — 15 vowels,
105 unordered non-identical pairs — so what `0.60` means is a LIST, not an
intuition. Section 5 asks whether the matrix's ordering carries any information
about which vowel pairs a form actually rhymes, by pricing each pair's LIFT
against a random background; section 6 prices three SHAPES (scalar, identity,
two-tier licensed) held out on both halves of both corpora.

Section 6's true-positive arm is the sonnets, and reading it requires the
warning printed beside it: on the NUCLEUS channel that corpus is 400 years away
from the declared dialect, so what a tightening "costs" there is mostly Early
Modern English. That is a finding about the metric, not about the threshold,
and it is why nothing in section 6 is proposed as a default.

ONE RECORDED NUMBER DOES NOT REPRODUCE, AND IT IS THIS FILE'S OWN

`quality/RESULTS_REDTEAM.md` ends section 3 with "Red-team FPR falls 10.67% ->
3.15%". The 10.67% reproduces to the pair: 320 of 3,000 at `theta_coda` 0.60,
broken down 13 / 26 / 60 / 234 across the four identity classes exactly as
recorded. The 3.15% reproduces at NO setting. At the document's own seed the
SHIPPED declaration gives **2.00% (60 of 3,000)** and **2.10% (84 of 4,000)**;
the `theta_coda` 0.80 scalar this paragraph used to quote here gives 3.57%
(107 of 3,000) and 3.60% (144 of 4,000) — that pair verified by running the
ORIGINAL script against the `lyric_harness.py` of its own commit, so neither
reading is drift. 3.15% is not this file at n = 3,000, 4,000 or 5,000, nor at
`theta_coda` 0.85, 0.90 or 1.00 (the nearest are 3.23% and 3.25%, at a
`theta_coda` that is not shipped). Doctrine 58: a bare rate is a coordinate of
a setting, and here no setting produces it. The DIRECTION and the SIZE of the
calibration's effect stand — false positives fall 3.0x — and the digit does
not.

**REPINNED 2026-08-14: ~~3.57% (107 of 3,000)~~ -> 2.00% (60 of 3,000) and
~~3.60% (144 of 4,000)~~ -> 2.10% (84 of 4,000).** The superseded pair is kept
struck rather than overwritten (doctrine 17), because it is still the correct
answer to a question this file asks — section 9 prices that exact shape as its
`scalar 0.80` row, on halves rather than on the whole sample. NOTHING DRIFTED:
every figure named above re-derives to the unit at this seed. What was wrong is
the SETTING the pair was attached to. `1c723cf` (2026-08-11 16:41) moved
`Declaration.coda_agreement` from a scalar `theta_coda` cut to `identity`,
which makes `theta_coda` INERT — `channel_agreement` answers this channel with
a PREDICATE under any non-scalar shape, and the band-passing count is identical
at `theta_coda` 0.60, 0.80, 0.90, 0.95 and 1.00, measured rather than argued.
So "the shipped `theta_coda` 0.80" named a cut that had stopped deciding
anything. Re-deriving the historical rates needs the old SHAPE declared
explicitly, and then they are exact:
`Declaration(coda_agreement="scalar", theta_coda=0.60)` -> 320 of 3,000;
`theta_coda=0.80` -> 107 of 3,000 and 144 of 4,000; the shipped
`Declaration()` -> 60 of 3,000 and 84 of 4,000.

AND THE SENTENCE THIS PARAGRAPH USED TO CLOSE WITH IS FALSIFIED BY ITS OWN
INSTANCE — READ IT BEFORE TYPING ANOTHER FIGURE INTO ANOTHER DOCSTRING. It
read: "This paragraph is in the instrument rather than only in the report
because the instrument is what someone re-runs." The figure went stale HERE,
in the instrument, for three days — and re-running is precisely what did NOT
save it: every one of those runs printed 2.10% in its own stdout, a few lines
below a docstring claiming 3.60%, and a run does not read its own prose.
Proximity to the code is not what protects a figure. BEING RE-DERIVED BY THE
RUN is, and that counter already exists: `quality/counters.py`'s `band_fpr()`
shells out to this file at BOTH n on `--write` and ASSERTS the committed cell
on `--check`, so `BACKLOG.md`'s band-FPR row is a machine transcript of this
file's stdout and cannot go stale without turning a check red. It carried
2.10%/2.00% for the whole three days this docstring said 3.60%/3.57%. A figure
hand-typed into prose is a figure nothing checks, wherever the prose lives —
so quote the derived row, or quote the command, and keep prose figures to the
ones a reader needs in order to READ the output rather than to trust it.

RUN
    python3 quality/redteam_band.py [n_pairs]
"""

import itertools
import os
import random
import sys
from collections import Counter

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                ".."))

import lyric_harness as L  # noqa: E402

SEED = 20260810           # fixed and stated: doctrine 66, a tie-break or a
                          # sample that varies between runs is not a result


def anchor_of(lex, word):
    """The rhyme anchor of a single word, or None if CMUdict refuses it."""
    phones, oov = lex.transcribe_word(word)
    if oov or not phones:
        return None
    return L.anchor(L.syllabify(phones))


def identity_label(a, b):
    """The band's verdict under STRICT IDENTITY, tail-aligned. No judgement.

    -> 'RHYME' / 'ASSONANCE' / 'CONSONANCE' / 'NO_RELATION'

    Two absent codas AGREE (doctrine 25): `see`/`free` is a perfect rhyme and
    reading empty-vs-empty as disagreement would delete every open-syllable
    rhyme in English, a quarter of the sonnets' mandated pairs.
    """
    n = min(len(a), len(b))
    if not n:
        return None
    ta, tb = a[-n:], b[-n:]
    nuc = all(ta[i]["nucleus"] == tb[i]["nucleus"] for i in range(n))
    cod = all(tuple(ta[i]["coda"]) == tuple(tb[i]["coda"]) for i in range(n))
    if nuc and cod:
        return "RHYME"
    if nuc:
        return "ASSONANCE"
    if cod:
        return "CONSONANCE"
    return "NO_RELATION"


def margin(a, b, decl):
    """How far past its threshold did each channel clear? Negative = failed.

    This is the SCALAR reading of both channels and it is the right thing to
    print for the shipped declaration. Under `nucleus_agreement != "scalar"`
    the nucleus number below is no longer the quantity the band consults — the
    shape is a predicate, not a magnitude — so callers must not read the
    nucleus margin as a verdict there.
    """
    n = min(len(a), len(b))
    ta, tb = a[-n:], b[-n:]
    nuc = min(L.vowel_sim(ta[i]["nucleus"], tb[i]["nucleus"])
              for i in range(n))
    cod = min(1.0 if (not ta[i]["coda"] and not tb[i]["coda"])
              else L.cluster_sim(ta[i]["coda"], tb[i]["coda"])
              for i in range(n))
    return nuc, cod


def sample_pairs(lex, n, rng):
    """Random word pairs from CMUdict itself, so the marginals are the
    dictionary's own (doctrine 13: a resource used to score a cell must be
    independent of that cell's label -- here there IS no label to leak)."""
    words = [w for w in lex.entries
             if w.isalpha() and 2 <= len(w) <= 12]
    out = []
    while len(out) < n:
        a, b = rng.choice(words), rng.choice(words)
        if a == b:
            continue
        out.append((a, b))
    return out


# ---------------------------------------------------------------------------
# 4-6. THE SHAPE, not the cut
# ---------------------------------------------------------------------------

def vowel_pair_space(decl):
    """Every unordered non-identical CMU vowel pair, ranked by `vowel_sim`.

    The space is 105 pairs, so `theta_nucleus = 0.60` has an exhaustive
    reading: it is a LIST of which pairs count as agreeing. Printing the list
    is the difference between a declared coordinate and a number nobody has
    seen the consequences of.
    """
    rows = sorted(((L.vowel_sim(a, b), a, b)
                   for a, b in itertools.combinations(sorted(L.VOWELS), 2)),
                  reverse=True)
    return rows, [r for r in rows if r[0] >= decl.theta_nucleus]


def tail_nuc_pairs(a, b):
    n = min(len(a), len(b))
    ta, tb = a[-n:], b[-n:]
    return [tuple(sorted((ta[i]["nucleus"], tb[i]["nucleus"])))
            for i in range(n)]


def tail_coda_pairs(a, b):
    """The coda channel's analogue. A coda is a TUPLE, so the space is not
    enumerable the way the 105 vowel pairs are -- it is enumerable in the
    single-phone case, which is what section 7 walks, and observed rather than
    enumerated in the cluster case, which is what section 8 counts."""
    n = min(len(a), len(b))
    ta, tb = a[-n:], b[-n:]
    return [tuple(sorted((tuple(ta[i]["coda"]), tuple(tb[i]["coda"]))))
            for i in range(n)]


def cons_pair_space(decl):
    """Every unordered non-identical CMU consonant pair, ranked by `cons_sim`.

    The coda channel's version of `vowel_pair_space`, and it is the section
    that was missing when `wall`/`floor` shipped: adversary 3 interrogated the
    nucleus SHAPE and took the coda's on trust.
    """
    rows = sorted(((L.cons_sim(a, b), a, b)
                   for a, b in itertools.combinations(sorted(L.CONSONANTS), 2)),
                  reverse=True)
    return rows, [r for r in rows if r[0] >= decl.theta_coda]


def _spearman(xs, ys):
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0] * len(v)
        i = 0
        while i < len(order):
            j = i
            while j + 1 < len(order) and v[order[j + 1]] == v[order[i]]:
                j += 1
            for k in range(i, j + 1):
                r[order[k]] = (i + j) / 2.0 + 1
            i = j + 1
        return r
    rx, ry = rank(xs), rank(ys)
    n = len(xs)
    if n < 3:
        return 0.0
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((rx[i] - mx) * (ry[i] - my) for i in range(n))
    dx = sum((rx[i] - mx) ** 2 for i in range(n)) ** 0.5
    dy = sum((ry[i] - my) ** 2 for i in range(n)) ** 0.5
    return num / (dx * dy) if dx and dy else 0.0


def mandated_pairs(lex, decl):
    """The sonnets' mandated rhyme pairs, as (half, word, word, anchor pair).

    The LABEL is the FORM's mandate (ABABCDCDEFEFGG), independent of every
    feature computed from it (doctrine 13). A pair whose end word CMUdict
    cannot read is a REFUSAL and never enters (doctrine 79). Returns [] if the
    corpus is not on disk, so this file still runs without it.
    """
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(
            os.path.abspath(__file__)), ".."))
        import battery
        sonnets = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))
    except Exception:
        return []
    out = []
    for idx, sn in enumerate(sonnets):
        ends = [L.line_anchors(lex, ln, promote=decl.final_promotion)[1]
                for ln in sn]
        for i, j in ((0, 2), (1, 3), (4, 6), (5, 7), (8, 10), (9, 11),
                     (12, 13)):
            aa = anchor_of(lex, ends[i]) if ends[i] else None
            bb = anchor_of(lex, ends[j]) if ends[j] else None
            if aa and bb:
                out.append((idx % 2, ends[i].lower(), ends[j].lower(), aa, bb))
    return out


def lift_table(pos, neg_anchors, fit_half=0, channel="nucleus"):
    """LIFT of each non-identical pair on `channel`: its rate in mandated rhyme
    positions over its rate in a random background. Laplace-smoothed, so an
    unobserved background cell is not an infinite lift."""
    extract = tail_nuc_pairs if channel == "nucleus" else tail_coda_pairs
    pc, nc = Counter(), Counter()
    for half, _, _, aa, bb in pos:
        if half == fit_half:
            pc.update(p for p in extract(aa, bb) if p[0] != p[1])
    for k, (aa, bb) in enumerate(neg_anchors):
        if k % 2 == fit_half:
            nc.update(p for p in extract(aa, bb) if p[0] != p[1])
    np_, nn = sum(pc.values()), sum(nc.values())
    # The smoothing denominator is the size of the space. For the nucleus that
    # is the enumerable 105; for the coda a cluster pair has no finite space,
    # so it is the number of distinct pairs OBSERVED, stated rather than
    # borrowed from the other channel.
    k_space = 105 if channel == "nucleus" else len(set(pc) | set(nc))
    rows = []
    for p in set(pc) | set(nc):
        pp = (pc[p] + 0.5) / (np_ + 0.5 * k_space)
        qq = (nc[p] + 0.5) / (nn + 0.5 * k_space)
        rows.append((pp / qq, pc[p], nc[p], p))
    rows.sort(reverse=True)
    return rows, np_, nn


def coda_sim(pair):
    """`channel_agreement`'s scalar reading of one coda pair (doctrine 25:
    two ABSENT codas agree)."""
    ca, cb = pair
    if not ca and not cb:
        return 1.0
    return L.cluster_sim(list(ca), list(cb))


def fmt_coda(c):
    return "".join(c) if c else "0"


def shape_price(decl, pos, neg_anchors, half):
    """(FPR on random pairs, refusal rate on mandated pairs) for one DECL."""
    fp = tot = 0
    for k, (aa, bb) in enumerate(neg_anchors):
        if k % 2 != half:
            continue
        tot += 1
        if identity_label(aa, bb) == "RHYME":
            continue
        if all(L.channel_agreement(aa, bb, decl)):
            fp += 1
    v = j = 0
    for h, _, _, aa, bb in pos:
        if h != half:
            continue
        j += 1
        if not all(L.channel_agreement(aa, bb, decl)):
            v += 1
    return (fp / tot if tot else 0.0), (v / j if j else 0.0)


def run(n_pairs=4000):
    lex = L.Lexicon()
    decl = L.Declaration()
    rng = random.Random(SEED)
    pairs = sample_pairs(lex, n_pairs, rng)

    conf = Counter()
    generous = []          # harness says RHYME, identity does not
    refused = 0
    anchors = []           # cached: the theta sweep below re-reads them 9x
    for a, b in pairs:
        aa, bb = anchor_of(lex, a), anchor_of(lex, b)
        if not aa or not bb:
            refused += 1
            continue
        anchors.append((aa, bb))
        truth = identity_label(aa, bb)
        got = L.score(aa, bb, decl, a, b)["relation"]
        conf[(truth, got)] += 1
        if got in ("RHYME", "RIME_RICHE") and truth != "RHYME":
            nuc, cod = margin(aa, bb, decl)
            generous.append((min(nuc - decl.theta_nucleus,
                                 cod - decl.theta_coda), nuc, cod,
                             a, b, truth))

    judged = sum(conf.values())
    print(f"RED TEAM · conjunctive band · seed {SEED}")
    print(f"  pairs drawn {len(pairs)}   judged {judged}   "
          f"refused by CMUdict {refused}")
    print(f"  reference line: STRICT IDENTITY of tail-aligned nucleus and "
          f"coda. Not ground truth for RHYME -- see this file's docstring.")
    print()
    labels = ["RHYME", "ASSONANCE", "CONSONANCE", "NO_RELATION"]
    hdr = "identity vs harness"
    print(f"  {hdr:<22}" + "".join(f"{g[:11]:>12}"
                                   for g in labels + ["other"]))
    for t in labels:
        row = [conf[(t, g)] for g in labels]
        other = sum(v for (tt, gg), v in conf.items()
                    if tt == t and gg not in labels)
        print(f"  {t:<22}" + "".join(f"{v:>12,}" for v in row + [other]))

    print()
    print(f"  ADMITTED AS RHYME WHERE IDENTITY SAYS OTHERWISE: "
          f"{len(generous):,} of {judged:,} ({len(generous)/judged:.2%})")
    generous.sort(key=lambda r: r[0])
    print("  the 15 THINNEST admissions -- margin is how far the weaker "
          "channel cleared its threshold:")
    for m, nuc, cod, a, b, truth in generous[:15]:
        print(f"    margin {m:+.3f}  nuc {nuc:.3f} coda {cod:.3f}  "
              f"{a}/{b}  (identity: {truth})")

    print()
    print("  THETA SWEEP -- doctrine 22: a threshold is a RATE, not a point.")
    print(f"  {'theta_nucleus':>14}{'admitted RHYME':>18}"
          f"{'vs identity RHYME':>20}{'excess':>10}")
    id_rhyme = sum(v for (t, _), v in conf.items() if t == "RHYME")
    for th in (0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.90, 1.00):
        d2 = L.Declaration(theta_nucleus=th)
        k = 0
        for aa, bb in anchors:
            if L.score(aa, bb, d2)["relation"] in ("RHYME", "RIME_RICHE"):
                k += 1
        mark = "  <- shipped" if abs(th - decl.theta_nucleus) < 1e-9 else ""
        print(f"  {th:>14.2f}{k:>18,}{id_rhyme:>20,}"
              f"{k - id_rhyme:>+10,}{mark}")

    shape = shape_report(lex, decl, anchors)
    return {"judged": judged, "generous": len(generous), "conf": conf,
            **shape}


def shape_report(lex, decl, anchors):
    """Sections 4-6: is a scalar cut the right SHAPE for the nucleus channel?"""
    rows, admitted = vowel_pair_space(decl)
    print()
    print(f"4. THE WHOLE SPACE · {len(L.VOWELS)} vowels, {len(rows)} unordered "
          f"non-identical pairs. `theta_nucleus={decl.theta_nucleus}` is a "
          f"LIST, not an intuition:")
    print(f"   it admits {len(admitted)} of {len(rows)} "
          f"({len(admitted)/len(rows):.0%}) as AGREEING.")
    near = sorted(rows, key=lambda r: abs(r[0] - decl.theta_nucleus))[:6]
    print("   the six pairs nearest the cut, from both sides -- this is what "
          "the number decides:")
    for s, a, b in sorted(near, reverse=True):
        print(f"     {a}~{b} {s:.3f}  "
              f"{'ADMITTED' if s >= decl.theta_nucleus else 'refused'}")
    print(f"     (`five`/`of` is AH~AY at 0.603 against 0.600; `bed`/`bead` "
          f"is EH~IY at {L.vowel_sim('EH', 'IY'):.3f}.)")

    pos = mandated_pairs(lex, decl)
    if not pos:
        print("\n5-6. SKIPPED: corpus/sonnets.txt not readable, so there is "
              "no true-positive arm and a false-positive rate alone decides "
              "nothing.")
        return {"space": rows, "admitted": admitted}

    lifts, np_, nn = lift_table(pos, anchors, fit_half=0)
    xs = [L.vowel_sim(*p) for _, _, _, p in lifts]
    ys = [l for l, _, _, _ in lifts]
    rho = _spearman(xs, ys)
    print()
    print("5. IS `vowel_sim` MONOTONE IN THE THING WE CARE ABOUT?")
    print(f"   LIFT of a vowel pair = its rate in the sonnets' mandated rhyme "
          f"positions over its rate in the random background above.")
    print(f"   fit half only: {np_} non-identical nucleus observations in "
          f"mandated positions, {nn} in the background, {len(lifts)} distinct "
          f"pairs observed.")
    print(f"   Spearman(vowel_sim, lift) = {rho:+.3f}")
    print("   the highest-lift pairs, with what the scalar does about them:")
    for l, a, b, p in [r for r in lifts if r[1] >= 2][:8]:
        mark = ("ADMITTED" if L.vowel_sim(*p) >= decl.theta_nucleus
                else "REFUSED ")
        print(f"     {p[0]}~{p[1]:<3} lift {l:6.2f}  mandated {a:<4} "
              f"background {b:<5} vowel_sim {L.vowel_sim(*p):.3f}  {mark}")
    bad = sorted((r for r in lifts
                  if L.vowel_sim(*r[3]) >= decl.theta_nucleus and r[0] < 1.0),
                 key=lambda r: -L.vowel_sim(*r[3]))
    print(f"   {len(bad)} pairs are ADMITTED by the scalar and appear LESS "
          f"often in mandated positions than at chance; the five highest-"
          f"scoring of them:")
    for l, a, b, p in bad[:5]:
        print(f"     {p[0]}~{p[1]:<3} vowel_sim {L.vowel_sim(*p):.3f}  "
              f"lift {l:5.2f}  mandated {a:<4} background {b}")

    print()
    print("6. THREE SHAPES, PRICED HELD-OUT (fit half 0, report both halves)")
    print("   *** READ THE WARNING UNDER THE TABLE BEFORE READING THE "
          "TABLE. ***")
    shapes = [
        ("scalar 0.60 (SHIPPED)", L.Declaration()),
        ("scalar 0.70", L.Declaration(theta_nucleus=0.70)),
        ("scalar 0.80", L.Declaration(theta_nucleus=0.80)),
        ("identity", L.Declaration(nucleus_agreement="identity")),
        ("licensed (identity+schwa)",
         L.Declaration(nucleus_agreement="licensed")),
        ("licensed, any stress",
         L.Declaration(nucleus_agreement="licensed",
                       nucleus_licence_unstressed_only=False)),
    ]
    print(f"   {'shape':<26}{'FIT FPR':>10}{'FIT refused':>13}"
          f"{'HELD FPR':>11}{'HELD refused':>14}")
    for name, d in shapes:
        f_fpr, f_v = shape_price(d, pos, anchors, 0)
        h_fpr, h_v = shape_price(d, pos, anchors, 1)
        print(f"   {name:<26}{f_fpr:>9.2%}{f_v:>13.2%}"
              f"{h_fpr:>11.2%}{h_v:>14.2%}")
    print()
    print("   WARNING, and it is the finding rather than a caveat: the "
          "right-hand columns are")
    print("   NOT a true-positive cost on this channel. `theta_coda` could be "
          "priced against")
    print("   the sonnets because what 0.60 -> 0.80 cost there is S~Z and "
          "D~RD -- the voicing")
    print("   of a final obstruent, which English did not change between 1609 "
          "and General")
    print("   American. The NUCLEUS is where four centuries of sound change "
          "live. Of the 31")
    print("   mandated pairs a 0.60 -> 0.70 tightening would newly refuse, 25 "
          "are Early Modern")
    print("   English (gone/alone, tongue/song, have/grave, blood/good) and 6 "
          "are CMUdict")
    print("   writing one reduced vowel two ways (graces/faces). Not one is a "
          "General")
    print("   American slant rhyme. A threshold cannot be calibrated on a "
          "corpus whose")
    print("   dialect differs from the declared one, ON THE CHANNEL THE "
          "DIALECT DIFFERENCE")
    print("   LIVES IN -- so no row here is proposed as a default, and the "
          "scalar ships as")
    print("   the incumbent rather than as the winner.")
    coda = coda_report(lex, decl, anchors, pos)
    return {"space": rows, "admitted": admitted, "lifts": lifts,
            "spearman": rho, "mandated": len(pos), **coda}


# ---------------------------------------------------------------------------
# 7-9. THE CODA CHANNEL. Added 2026-08-11 by cell BA.
#
# Sections 4-6 interrogate the NUCLEUS channel's shape and take the coda's on
# trust, and that asymmetry is how `wall`/`floor` shipped at 0.996 RHYME with
# coda 0.988 while this file was already running. Doctrine 94 says a
# positive-case suite cannot find a rule that is too generous; the same
# sentence applies to an adversary that only attacks one channel of two.
# ---------------------------------------------------------------------------

def coda_report(lex, decl, anchors, pos):
    rows, admitted = cons_pair_space(decl)
    print()
    print(f"7. THE CODA CHANNEL'S SPACE · {len(L.CONSONANTS)} consonants, "
          f"{len(rows)} unordered non-identical pairs.")
    print(f"   As a SINGLETON coda, `theta_coda={decl.theta_coda}` admits "
          f"{len(admitted)} of {len(rows)} ({len(admitted)/len(rows):.0%}) "
          f"as AGREEING.")
    print(f"   `cons_sim` = 1 - [0.30*(voicing differs) + 0.25*|place diff| "
          f"+ 0.45*MANNER_DIST], so manner")
    print(f"   IDENTITY is worth 0.45 of the budget and the whole place axis "
          f"can take away at most 0.25:")
    same = [r for r in rows
            if L.CONSONANTS[r[1]][2] == L.CONSONANTS[r[2]][2]
            and L.CONSONANTS[r[1]][0] == L.CONSONANTS[r[2]][0]]
    print(f"   EVERY same-manner same-voicing pair therefore scores >= 0.75. "
          f"Measured floor {min(r[0] for r in same):.4f} "
          f"({min(same)[1]}~{min(same)[2]}), over {len(same)} such pairs.")
    print("   the ten highest-scoring non-identical pairs -- this is what the "
          "number decides:")
    for s, a, b in rows[:10]:
        mx, my = L.CONSONANTS[a][2], L.CONSONANTS[b][2]
        tag = "same-manner" if mx == my else f"cross {mx}/{my}"
        print(f"     {a}~{b:<3} {s:.4f}  {tag:<22}"
              f"{'ADMITTED' if s >= decl.theta_coda else 'refused'}")
    print(f"   THE ARGMAX OF THE WHOLE MATRIX IS {rows[0][1]}~{rows[0][2]} AT "
          f"{rows[0][0]:.4f}, which is `wall`/`floor`, `call`/`more` and")
    print(f"   `ear`/`will`. No `theta_coda` separates it from identity: the "
          f"cuts that refuse a lateral")
    print(f"   against a rhotic are exactly the cuts that refuse every "
          f"non-identical pair in English.")

    if not pos:
        print("\n8-9. SKIPPED: no true-positive arm.")
        return {}

    lifts, np_, nn = lift_table(pos, anchors, fit_half=0, channel="coda")
    xs = [coda_sim(p) for _, _, _, p in lifts]
    ys = [l for l, _, _, _ in lifts]
    rho = _spearman(xs, ys)
    print()
    print("8. IS `cluster_sim` MONOTONE IN THE THING WE CARE ABOUT?")
    print(f"   fit half only: {np_} non-identical coda observations in "
          f"mandated positions, {nn} in the background,")
    print(f"   {len(lifts)} distinct pairs observed.  "
          f"Spearman(cluster_sim, lift) = {rho:+.3f}")
    print("   every coda pair seen more than once in mandated positions, with "
          "what the scalar does about it:")
    for l, a, b, p in [r for r in lifts if r[1] >= 2]:
        cs = coda_sim(p)
        mark = "ADMITTED" if cs >= decl.theta_coda else "REFUSED "
        print(f"     {fmt_coda(p[0]):>6} ~ {fmt_coda(p[1]):<6} lift {l:6.2f}  "
              f"mandated {a:<4} background {b:<5} cluster_sim {cs:.3f}  {mark}")
    n_adm = sum(1 for r in lifts if coda_sim(r[3]) >= decl.theta_coda)
    n_adm_pos = sum(1 for r in lifts
                    if r[1] > 0 and coda_sim(r[3]) >= decl.theta_coda)
    print(f"   THE ADMITTED SET AND THE ATTESTED SET ARE ALMOST DISJOINT: of "
          f"the {n_adm} distinct non-identical")
    print(f"   coda pairs the scalar admits anywhere in this sample, "
          f"{n_adm_pos} occur at all in mandated positions,")
    print(f"   while the ones the corpus does attest -- S~Z, D~RD, RT~T, "
          f"RTH~TH -- are all REFUSED by it.")
    print("   the coda pairs the scalar admits that appear ZERO times in "
          "mandated positions, commonest first:")
    bad = sorted((r for r in lifts
                  if r[1] == 0 and coda_sim(r[3]) >= decl.theta_coda),
                 key=lambda r: -r[2])
    for l, a, b, p in bad[:8]:
        print(f"     {fmt_coda(p[0]):>6} ~ {fmt_coda(p[1]):<6} background "
              f"{b:<5} cluster_sim {coda_sim(p):.3f}")

    print()
    print("9. CODA SHAPES, PRICED HELD-OUT (fit half 0, report both halves)")
    shapes = [
        ("scalar 0.80", L.Declaration(coda_agreement="scalar")),
        ("scalar 0.90", L.Declaration(coda_agreement="scalar",
                                      theta_coda=0.90)),
        ("scalar 0.95", L.Declaration(coda_agreement="scalar",
                                      theta_coda=0.95)),
        ("identity (SHIPPED)", L.Declaration(coda_agreement="identity")),
        ("licensed +S~Z final", L.Declaration(coda_agreement="licensed",
                                              coda_licence=(("S", "Z"),))),
        ("licensed +S~Z,T~D", L.Declaration(coda_agreement="licensed",
                                            coda_licence=(("S", "Z"),
                                                          ("T", "D")))),
    ]
    print(f"   {'shape':<26}{'FIT FPR':>10}{'FIT refused':>13}"
          f"{'HELD FPR':>11}{'HELD refused':>14}")
    for name, d in shapes:
        f_fpr, f_v = shape_price(d, pos, anchors, 0)
        h_fpr, h_v = shape_price(d, pos, anchors, 1)
        print(f"   {name:<26}{f_fpr:>9.2%}{f_v:>13.2%}"
              f"{h_fpr:>11.2%}{h_v:>14.2%}")
    print()
    print("   READ THIS TABLE THE WAY SECTION 6's WARNING SAYS TO, AND THEN "
          "NOTE THE DIFFERENCE.")
    print("   Section 6 cannot price the nucleus on this corpus because the "
          "nucleus is where four")
    print("   centuries of sound change live. HALF of the coda's mandated "
          "evidence has the same")
    print("   problem and the record did not say so: the Declaration used to "
          "call the 0.60 -> 0.80")
    print("   cost `S~Z x8 and D~RD x2 -- the VOICING OF A FINAL OBSTRUENT`, "
          "but D~RD is n=4, its")
    print("   nucleus differs in 4 of 4, and it is an R present on one side "
          "and absent on the other")
    print("   (herd/beard, tir'd/expired, word/afford, err'd/transferr'd). "
          "With RT~T, RTH~TH, 0~R,")
    print("   DZ~RDZ and RTS~TS that is 17 RHOTIC observations against 9 "
          "obstruent-voicing ones.")
    print("   What survives the objection is that identity beats the scalar "
          "on BOTH arms in BOTH")
    print("   halves -- FPR by a third, true positives by 0.20pp in the fit "
          "half and 0.00pp held")
    print("   out -- and that no `scalar` row buys the fix at any price: "
          "0.95 pays the full")
    print("   true-positive cost and still admits `wall`/`floor`, because "
          "R~L is the matrix argmax.")
    return {"cons_space": rows, "coda_admitted": admitted,
            "coda_lifts": lifts, "coda_spearman": rho}


if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else 4000)
