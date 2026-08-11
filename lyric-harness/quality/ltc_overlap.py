#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""What the OR over readings bought, priced against three controls.

WHY THIS FILE EXISTS.  `ltc.MiddleChinese.rhymes` ended `return bool(ka & kb)`
and `ka` is the key set over ALL readings of a 多音字, so the predicate was an
**OR over readings**: a character with two rime-group readings rhymed with
anything either reading rhymed with, and the answer never said which reading
had carried it.  4,716 of the 19,499 characters in `data/qieyun_mc.tsv` hold
more than one reading and 825 of the 3,481 line-end characters of the 四庫 ci
corpus do.

`data/sources.tsv` row `kanripo/KR4j` commits four numbers measured through
that function on 5,573 poems at `standard='cilin'` -- 韻 90.9%, 句 7.4%,
adjacent-no-common-group 2.9%, cross-poem null 6.1%.  Every one of them went
through the OR.  The point estimate was uncertain and the separation was
"probably" safe because the control shares the defect; this file replaces the
"probably" with a measurement.

WHAT IT MEASURES.  The four arms of `quality/build_ci_corpus.py:measure()`
under each of the three declared folds -- `any`, `all`, `settled` -- reporting
mandated / judged / refused as three counts (doctrine 79).  Under `settled` the
refused count carries TWO causes and they are printed apart: the character does
not read at all, and the readings do not agree with each other.

WHY IT READS THE CORPUS FILES AND NOT THE CLONES.  `build_ci_corpus.py
--measure` needs 66 `git clone`s of kanripo/KR4j* on disk.  The 66 committed
files carry everything the measurement needs -- the `--- RHYME` and `--- JU`
headers ARE the 1715 spec's partition in 1-based line numbers, and the `--- GE`
header marks the poems whose 韻/句 partition is not unique, which is the same
`unique` flag `measure()` filters on.  The reconstruction is not trusted: it is
checked against the committed numbers by `COMMITTED` below, and a mismatch is
an exit-1, so this is a re-run of the published measurement rather than a
second one that happens to agree (doctrine 58 -- a recorded count is a
threshold nobody wrote down, and here it is written down).

THE CONTROLS ARE THE POINT (doctrine 41).  A positive control can pass for the
wrong reason.  Three are available and all three are reported under every
setting, because they do NOT have to move together: 句 and adjacent are the
same poems and the same kind of position, so a fold that only removes
polyphone-driven Trues should shrink them alongside 韻; the cross-poem null is
a different pairing entirely and is the one that would expose a fold that
merely made the comparator stricter everywhere.

Run: python3 quality/ltc_overlap.py
"""

import argparse
import glob
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from quality.phonology.ltc import MiddleChinese, OVERLAPS   # noqa: E402

SONG = os.path.join(ROOT, "corpus", "song")

#: the 別集, from `build_ci_corpus.BIEJI`. `kept` is sorted (別集 first, then
#: by repo id) and the null arm draws from the line-end list in THAT order, so
#: reproducing the committed 6.1% requires reproducing the order as well as the
#: seed. Doctrine 66: a result that depends on an iteration order must state it.
BIEJI = {"KR4j%04d" % i for i in list(range(1, 62)) + [63, 64, 72]}

NULL_SEED = 20260811
NULL_N = 20000

#: `data/sources.tsv` row `kanripo/KR4j`, verbatim. The reconstruction below is
#: CHECKED against these, not assumed to agree with them.
#: arm -> (mandated, judged, refused, true) under overlap='any'.
COMMITTED = {
    "cilin": {"yun": (33321, 31162, 2159, 28330),
              "ju": (15061, 14062, 999, 1047),
              "adj": (36179, 33841, 2338, 997),
              "null": (20000, 18745, 1255, 1150)},
    "pingshui": {"yun": (33321, 31162, 2159, 18139)},
    "poems": 5573,
}


# --------------------------------------------------------------------------
# the corpus, from the committed files
# --------------------------------------------------------------------------

def read_poems(path):
    """-> [{lines, rhyme, ju, unique}] for one `corpus/song/ltc_siku_*.txt`."""
    out, cur = [], None
    for raw in open(path, encoding="utf-8"):
        line = raw.rstrip("\n")
        if line.startswith("#"):
            continue
        if line.startswith("--- TITLE:"):
            cur = {"lines": [], "rhyme": "-", "ju": "-", "unique": True}
            out.append(cur)
            continue
        if cur is None:
            continue
        if line.startswith("--- GE:"):
            # write_files marks the non-unique partition in this header and
            # nowhere else; measure() drops exactly those poems.
            cur["unique"] = "NOT unique" not in line
        elif line.startswith("--- RHYME:"):
            cur["rhyme"] = line.split(":", 1)[1].strip()
        elif line.startswith("--- JU:"):
            cur["ju"] = line.split(":", 1)[1].strip()
        elif line.startswith("---") or line.startswith("[VERSE") or not line:
            continue
        else:
            cur["lines"].append(line)
    return out


def _nums(field):
    return [int(x) for x in field.split(".") if x] if field and field != "-" else []


def poem_arms(p):
    """-> (韻 pairs, 句 pairs, adjacent-no-common-group pairs, line ends).

    The same three constructions as `build_ci_corpus.measure()`, on line
    numbers instead of character offsets:
      韻   adjacent members of each rhyme group the 詞譜 declares
      句   adjacent members of the 句 list -- line ends the spec marks as
           mandating NO rhyme
      adj  consecutive LINE ENDS the spec puts in no common rhyme group. Same
           adjacency as most 韻 pairs and the tightest control available.
    """
    end = {}
    for i, ln in enumerate(p["lines"], 1):
        t = ln.rstrip("。，")
        end[i] = t[-1] if t else ""
    groups = [g for g in ([int(x) for x in grp.split(".") if x]
                          for grp in p["rhyme"].split("/")) if g] \
        if p["rhyme"] != "-" else []
    of_group = {q: i for i, g in enumerate(groups) for q in g}
    yun = []
    for g in groups:
        ps = sorted(g)
        yun += [(end[x], end[y]) for x, y in zip(ps, ps[1:])]
    js = sorted(_nums(p["ju"]))
    ju = [(end[x], end[y]) for x, y in zip(js, js[1:])]
    ends = sorted(end)
    adj = [(end[x], end[y]) for x, y in zip(ends, ends[1:])
           if of_group.get(x, -1) != of_group.get(y, -2)]
    return yun, ju, adj, [end[i] for i in ends]


def _rid(path):
    return "KR4j" + re.search(r"kr4j(\d+)", os.path.basename(path)).group(1)


def collect(song_dir=SONG):
    """-> dict of the four arms plus the two poem counts."""
    files = sorted(glob.glob(os.path.join(song_dir, "ltc_siku_*.txt")))
    if not files:
        raise SystemExit(f"no ltc_siku_*.txt under {song_dir}")
    files.sort(key=lambda f: (0 if _rid(f) in BIEJI else 1, _rid(f)))
    yun, ju, adj, ends = [], [], [], []
    npoems = nunique = 0
    for f in files:
        for p in read_poems(f):
            npoems += 1
            if not p["unique"]:
                continue
            nunique += 1
            a, b, c, e = poem_arms(p)
            yun += a
            ju += b
            adj += c
            ends += e
    random.seed(NULL_SEED)
    null = [(random.choice(ends), random.choice(ends)) for _ in range(NULL_N)]
    return {"yun": yun, "ju": ju, "adj": adj, "null": null,
            "poems": npoems, "unique": nunique, "ends": ends}


# --------------------------------------------------------------------------
# the arms
# --------------------------------------------------------------------------

ARMS = (("yun", "韻/叶  the 1715 詞譜 MANDATES rhyme"),
        ("ju", "句     the same spec mandates NONE  [control 1]"),
        ("adj", "adj    adjacent ends, no common group [control 2]"),
        ("null", "null   cross-poem pairing            [control 3]"))


def arm(phon, pairs, std, ov):
    """-> the three counts of doctrine 79, with `refused` split by cause.

    `unread` is the character not being in the rime book; `unsettled` is the
    readings not agreeing with each other. Folding them would be doctrine 88's
    error -- a refusal rate is uninterpretable until its causes are separated.
    """
    T = F = unread = unsettled = 0
    for a, b in pairs:
        v = phon.rhymes(a, b, standard=std, overlap=ov)
        if v is True:
            T += 1
        elif v is False:
            F += 1
        elif phon.rhyme_keys(a, standard=std) is None \
                or phon.rhyme_keys(b, standard=std) is None:
            unread += 1
        else:
            unsettled += 1
    j = T + F
    return {"mandated": len(pairs), "judged": j, "refused": unread + unsettled,
            "unread": unread, "unsettled": unsettled, "true": T, "false": F,
            "rate": (100.0 * T / j) if j else None}


def check_committed(data):
    """The reconstruction's own positive control: it must reproduce every
    committed number exactly, or the file exits 1 and reports nothing."""
    bad = []
    if data["unique"] != COMMITTED["poems"]:
        bad.append(f"poems {data['unique']} != {COMMITTED['poems']}")
    for std, arms in COMMITTED.items():
        if std == "poems":
            continue
        p = MiddleChinese(standard=std)
        for name, want in arms.items():
            r = arm(p, data[name], std, "any")
            got = (r["mandated"], r["judged"], r["refused"], r["true"])
            if got != want:
                bad.append(f"{std}/{name} {got} != {want}")
    return bad


def unsettled_trues(phon, pairs, std):
    """-> (n_true_under_any, n_of_them_the_readings_do_not_settle).

    The headline: how much of the OR's True rests on an overlap that the
    readings themselves do not decide.
    """
    t = u = 0
    for a, b in pairs:
        if phon.rhymes(a, b, standard=std, overlap="any") is True:
            t += 1
            if phon.rhymes(a, b, standard=std, overlap="settled") is None:
                u += 1
    return t, u


# --------------------------------------------------------------------------
# the tone_class propagation
# --------------------------------------------------------------------------

def tone_propagation(data, std="cilin"):
    """-> what refusing 平/仄 on a disagreeing 多音字 costs.

    `syllabify()` used to hand out `readings[0]`'s 平/仄 for every character
    `tone_class()` refused. It now hands out the refusal. This counts the
    positions that changes, which is the honest form of "what did it cost":
    a count of confident answers withdrawn, not a rate.
    """
    p = MiddleChinese(standard=std)
    chars = sorted(set(data["ends"]))
    refused = [c for c in chars
               if p.readings(c) is not None and p.tone_class(c) is None]
    now_none = sum(1 for c in chars if p.syllabify(c)[0].prominence is None)
    unread = sum(1 for c in chars if p.readings(c) is None)
    tok_total = len(data["ends"])
    tok_refused = sum(1 for c in data["ends"]
                      if p.readings(c) is not None and p.tone_class(c) is None)
    return {"distinct": len(chars), "distinct_unread": unread,
            "distinct_tone_refused": len(refused),
            "distinct_prominence_none": now_none,
            "tokens": tok_total, "tokens_tone_refused": tok_refused,
            "examples": refused[:12]}


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--songs", default=SONG)
    ap.add_argument("--standard", default="cilin",
                    help="cilin (詞林正韻, the 詞 standard) or pingshui")
    args = ap.parse_args()

    data = collect(args.songs)
    print(f"corpus: {data['poems']} ci in "
          f"{len(glob.glob(os.path.join(args.songs, 'ltc_siku_*.txt')))} files; "
          f"{data['unique']} have a unique 韻/句 partition and are measured")
    bad = check_committed(data)
    if bad:
        print("RECONSTRUCTION DOES NOT REPRODUCE data/sources.tsv:")
        for b in bad:
            print("   " + b)
        return 1
    print("reconstruction reproduces every committed number in "
          "data/sources.tsv row kanripo/KR4j exactly (overlap='any')")

    std = args.standard
    phon = MiddleChinese(standard=std)
    print(f"\nstandard={std!r}   n={NULL_N} null pairs at seed {NULL_SEED}")
    print("=" * 78)
    hdr = f"{'arm':<38}{'mandated':>9}{'judged':>8}{'refused':>8}" \
          f"{'(unread/unsettled)':>20}{'True':>8}{'rate':>8}"
    rows = {}
    for ov in OVERLAPS:
        print(f"\noverlap={ov!r}" + ("   <- the shipped default and the fold "
                                     "every committed number rests on"
                                     if ov == "any" else ""))
        print(hdr)
        rows[ov] = {}
        for name, label in ARMS:
            r = arm(phon, data[name], std, ov)
            rows[ov][name] = r
            split = "%d/%d" % (r["unread"], r["unsettled"])
            pct = "n/a" if r["rate"] is None else "%.1f%%" % r["rate"]
            print("%-38s%9d%8d%8d%20s%8d%8s"
                  % (label, r["mandated"], r["judged"], r["refused"],
                     split, r["true"], pct))

    print("\nSEPARATION, in percentage points of True rate")
    print("=" * 78)
    print(f"{'overlap':<10}{'韻':>8}{'句':>8}{'adj':>8}{'null':>8}"
          f"{'韻-句':>10}{'韻-adj':>10}{'韻-null':>10}")
    for ov in OVERLAPS:
        r = rows[ov]
        y, j, a, n = (r[k]["rate"] for k in ("yun", "ju", "adj", "null"))
        print(f"{ov:<10}{y:>7.1f}%{j:>7.1f}%{a:>7.1f}%{n:>7.1f}%"
              f"{y - j:>9.1f}{y - a:>9.1f}{y - n:>9.1f}")

    t, u = unsettled_trues(phon, data["yun"], std)
    print(f"\nOF THE OR'S TRUEs AT MANDATED POSITIONS: {t} True under 'any', "
          f"{u} ({100.0 * u / t:.1f}%) rest on an overlap the readings do not "
          f"settle.")
    for name, label in ARMS[1:]:
        t2, u2 = unsettled_trues(phon, data[name], std)
        print(f"  {label.split()[0]:<6} {t2} True under 'any', {u2} "
              f"({100.0 * u2 / t2 if t2 else 0:.1f}%) unsettled")
    print("  Doctrine 41: the controls carry the same defect, so the question "
          "is never the rate but whether the SEPARATION survives.")

    tp = tone_propagation(data, std)
    print("\nPROPAGATING tone_class()'s REFUSAL INTO syllabify()")
    print("=" * 78)
    print(f"  {tp['distinct']} distinct line-end characters; "
          f"{tp['distinct_unread']} do not read at all.")
    print(f"  {tp['distinct_tone_refused']} read but their readings DISAGREE "
          f"on 平 vs 仄, so tone_class() returns None: "
          f"{''.join(tp['examples'])} ...")
    print(f"  syllabify().prominence is now None for "
          f"{tp['distinct_prominence_none']} of them "
          f"(= {tp['distinct_unread']} unread + "
          f"{tp['distinct_tone_refused']} undecided); it used to be "
          f"readings[0]'s 平/仄 for every one of the undecided.")
    print(f"  At token level that is {tp['tokens_tone_refused']} of "
          f"{tp['tokens']} line ends "
          f"({100.0 * tp['tokens_tone_refused'] / tp['tokens']:.1f}%) whose "
          f"平/仄 was a pick and is now a refusal.")
    print("  It moves NO rhyme number: the four arms above go through "
          "rhyme_keys(), which never read `prominence`.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
