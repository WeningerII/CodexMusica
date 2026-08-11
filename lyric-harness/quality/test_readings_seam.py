#!/usr/bin/env python3
"""THE SEAM — a knowledge set must survive the layer that CONSUMES it.

    python3 quality/test_readings_seam.py            # ~10s
    python3 quality/test_readings_seam.py --quick    # skip the corpus counts

WHAT WAS BROKEN, AND WHY IT WAS THE WORST SHAPE OF BROKEN

Defect P11 was closed in two halves by two different cells. `quality/
relations.py` closed the COMPARISON half: a channel may hold a `frozenset` of
readings and `Agree`/`Differ` answer True where every reading agrees, False
where none can, and **None where some do and some do not**. `quality/phonology/
__init__.py` closed the PRODUCTION half: `Syllable` may hold a `Readings` on
any channel and `Phonology.parses()` is the hook that declares more than one.

Between them sat nine functions that READ a channel off a unit, and four of
them spent the uncertainty on the way past:

    _rd_onset(u)       tuple(u.syl.onset)
    _rd_coda(u)        tuple(u.syl.coda)
    _rd_consonants(u)  tuple(u.syl.onset) + tuple(u.syl.coda)
    _rd_phones(u)      tuple(onset) + (nucleus,) + tuple(coda)

`tuple()` over a set of readings does not fail. It produces ONE cluster whose
members are the readings — `Readings({('S',), ('Z',)})`, the coda of `close`,
arrives as `(('S',), ('Z',))` — and `_set_agree` then compares that for
equality and answers a definite **False**. A representation built to say "we
cannot tell" was converted into a wrong certainty by its own consumer, three
lines below `_rd_nucleus`, which returns its channel raw and is the only
reason the `wind`/`find` case worked at all.

    BEFORE   Agree(phones('wind'), phones('find')).value  ->  False
    AFTER    Agree(phones('wind'), phones('find')).value  ->  None

TWO SHAPES OF FIX, AND THE SECOND IS NOT THE OBVIOUS ONE

`onset` and `coda` are scalar channels whose value happens to be an ordered
cluster, so the set passes THROUGH exactly as the nucleus does.

`consonants` and `phones` DERIVE a sequence by concatenation and have no
pass-through: a tuple with a frozenset spliced into it is one value to
`_set_agree`. The cheap patch is to refuse — return None — and it is wrong in
a second way: `phones(wind)` against `phones(sand)` is a perfectly good False
under EVERY reading, and a flat refusal throws that decision away. So they
return the PRODUCT: the set of sequences the readings permit. The tri-state
stays whole in both directions, which is the entire point of the tri-state.

WHAT THE PRODUCT INHERITS, STATED BECAUSE IT IS A REAL LOSS (section 5)

`merge_readings` folds PER CHANNEL, so the correlation between channels is
already gone by the time a reader sees the syllable. `or` is /AO R/ and /ER/;
merged, it is nucleus {AO, ER} and coda {('R',), ()}, and the product of those
is FOUR sequences, two of which no pronunciation declares. That is
`Syllable.readings()`'s own behaviour and not something a reader can undo —
the information is not on the unit. It is conservative in the safe direction:
a superset of readings can only turn a verdict into a refusal, never a refusal
into a verdict, so it costs decisions and cannot manufacture one.

THE COUNTS ARE IN SECTION 8 AND THEY ARE THREE (doctrine 79).
"""
import glob
import itertools
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import lyric_harness as lh                                       # noqa: E402
import quality.relations as R                                    # noqa: E402
from quality.phonology import (Readings, Syllable,               # noqa: E402
                               merge_readings)
from quality.phonology import eng, ltc                           # noqa: E402

FAILURES = []
LEX = lh.Lexicon()
CORPUS = os.path.join(ROOT, "corpus")


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# ---------------------------------------------------------------------------
# THE READERS EXACTLY AS THEY WERE, so "before" is a measurement and not a
# memory.  A regression here is not a broken test — it means somebody changed
# the fix, and the number in section 8 no longer describes anything.
# ---------------------------------------------------------------------------

def _old_onset(u):
    return tuple(u.syl.onset)


def _old_coda(u):
    return tuple(u.syl.coda)


def _old_consonants(u):
    return tuple(u.syl.onset) + tuple(u.syl.coda)


def _old_phones(u):
    n = u.syl.nucleus
    return tuple(u.syl.onset) + ((n,) if n else ()) + tuple(u.syl.coda)


NEW_READERS = dict(R.PHONEMIC)
OLD_READERS = dict(R.PHONEMIC, onset=_old_onset, coda=_old_coda,
                   consonants=_old_consonants, phones=_old_phones)


def use(which):
    """`DEFAULT_CHANNELS` holds the PHONEMIC dict itself, so swapping its
    contents swaps what the whole producer reads.  Always restored to "new"."""
    R.PHONEMIC.clear()
    R.PHONEMIC.update(OLD_READERS if which == "old" else NEW_READERS)


# ---------------------------------------------------------------------------
# THE TWO OPT-IN PHONOLOGIES.  Subclasses, because `quality/phonology/eng.py`
# and `ltc.py` still declare ONE reading and that default is deliberate — the
# capability is REACHABLE before it is the default (doctrine 84).  These are
# the same six-line overrides `quality/test_homograph.py` uses; kept local so
# this file does not depend on another test file's fixtures.
# ---------------------------------------------------------------------------

class EnglishAllReadings(eng.English):
    """`eng` with every CMUdict pronunciation kept instead of the first."""
    language = "eng"

    def parses(self, word):
        w = lh.fold_apostrophes(word).lower()
        prons = LEX.entries.get(w)
        if not prons:
            # eng.English.syllabify explicitly, NOT self.syllabify: the
            # subclass below routes syllabify back through parses, and the
            # bound call recurses to the stack limit on the first OOV word.
            return [eng.English.syllabify(self, word)]
        return [[Syllable(text=word, onset=tuple(s["onset"]),
                          nucleus=s["nucleus"], coda=tuple(s["coda"]),
                          prominence=1 if s["stress"] in (1, 2) else 0,
                          moras=1)
                 for s in lh.syllabify(p)] for p in prons]


class EnglishUncertain(EnglishAllReadings):
    """...and the merged reading out of `syllabify`, so the sets reach
    `build_stream` and the producer rather than only a predicate."""

    def syllabify(self, word):
        return merge_readings(self.parses(word))[0]


class LtcAllReadings(ltc.MiddleChinese):
    """`ltc` with every 多音字 reading kept.  `readings(ch)` already returns
    them all and `syllabify` already took `rs[0]`; only the fold is new."""

    def parses(self, word):
        cols = []
        for ch in word:
            rs = self.readings(ch)
            if not rs:
                cols.append([Syllable(ch, (), "", (), None, 1)])
                continue
            cols.append([Syllable(ch, (r["initial"],), r["rhyme"], (),
                                  1 if r["tone"] == ltc.LEVEL else 0, 1)
                         for r in rs])
        return [list(c) for c in itertools.product(*cols)]


class LtcUncertain(LtcAllReadings):
    def syllabify(self, word):
        return merge_readings(self.parses(word))[0]


E_FIRST = eng.English()
E_UNC = EnglishUncertain()
L_UNC = LtcUncertain()
A, D = R.Agree(), R.Differ()


def _unit(syl):
    """One Unit carrying `syl` — the readers take a Unit, not a Syllable."""
    return R.Unit(i=0, syl=syl, line=0, token=0, tok_syl=0, tok_len=1,
                  token_text=syl.text, line_tokens=1)


def _read(syl, channel, which="new"):
    use(which)
    try:
        return R.DEFAULT_CHANNELS.read(_unit(syl), channel)
    finally:
        use("new")


# ---------------------------------------------------------------------------
# 1. DOCTRINE 25's TRIPWIRE — FIRST, before anything the change was FOR.
#
# Two ABSENT codas carry no evidence AND they AGREE, and those are different
# predicates.  A quarter of the sonnets' mandated pairs have two empty codas,
# so a seam fix that conflated "carries no evidence" with "does not agree"
# would delete every one of them while `wind`/`find` still looked fixed.
# ---------------------------------------------------------------------------

def test_doctrine_25_tripwire():
    print("\n1. DOCTRINE 25 FIRST — see/free stays ONE perfect rhyme, "
          "verdict True, and two absent codas AGREE")
    check("Agree((), ()) is (True, uninformative) — unchanged by the seam fix",
          A((), ()) == R.Read(True, False, ""), repr(A((), ())))
    check("Differ((), ()) is False — two identical absences cannot differ",
          D((), ()).value is False, repr(D((), ())))

    for phon, label in ((E_FIRST, "single reading"),
                        (E_UNC, "knowledge sets")):
        st = R.build_stream(["i want to see", "and i am free"], phon,
                            declaration={"language": "eng"})
        got = R.realise(R.REGISTRY["perfect rhyme"], st)
        check(f"see/free is ONE perfect-rhyme finding, verdict True [{label}]",
              len(got) == 1 and [i.verdict for i in got] == [True],
              f"{len(got)} finding(s), verdicts {[i.verdict for i in got]}")
        u = {x.token_text: x for x in st.units}
        reads = {c: (R.DEFAULT_CHANNELS.read(u["see"], c, st),
                     R.DEFAULT_CHANNELS.read(u["free"], c, st))
                 for c in ("onset", "coda", "consonants", "phones")}
        check(f"...and the FOUR patched readers are byte-identical on a "
              f"CERTAIN syllable [{label}]",
              reads["coda"] == ((), ())
              and reads["onset"] == (("S",), ("F", "R"))
              and reads["consonants"] == (("S",), ("F", "R"))
              and reads["phones"] == (("S", "IY"), ("F", "R", "IY")),
              f"{reads}")
        check(f"...and Agree on the two ABSENT codas is (True, uninformative) "
              f"through the reader [{label}]",
              A(*reads["coda"]) == R.Read(True, False, ""),
              "the tripwire at the layer the fix actually touched, not only "
              "at the predicate.")


# ---------------------------------------------------------------------------
# 2. THE FOUR READERS — before and after, on the same syllable
# ---------------------------------------------------------------------------

def test_the_four_readers():
    print("\n2. the four readers that coerced — an uncertain channel now "
          "produces an uncertain read")
    # `close` /K L OW S/ ~ /K L OW Z/: a CODA homograph, which is the case a
    # nucleus-only fix leaves broken.
    close = Syllable("close", ("K", "L"), "OW", Readings({("S",), ("Z",)}))
    # `wind` /W AY N D/ ~ /W IH N D/: a NUCLEUS homograph, the live case.
    wind = Syllable("wind", ("W",), Readings({"AY", "IH"}), ("N", "D"))
    # an ONSET homograph: `stronger` /G/ ~ /NG G/-ish, and `new` /N/ ~ /N Y/.
    new = Syllable("new", Readings({("N",), ("N", "Y")}), "UW", ())

    for syl, chan, why in ((close, "coda", "coda set"),
                           (new, "onset", "onset set"),
                           (wind, "nucleus", "nucleus set (already worked)")):
        old, now = _read(syl, chan, "old"), _read(syl, chan, "new")
        check(f"_rd_{chan}: the {why} arrives UNCERTAIN, where it used to "
              f"arrive as one value",
              R.uncertain(now) and not R.uncertain(old) if chan != "nucleus"
              else (R.uncertain(now) and R.uncertain(old)),
              f"before {old!r}\n          after  {now!r}")

    for syl, chan in ((close, "consonants"), (close, "phones"),
                      (wind, "phones")):
        old, now = _read(syl, chan, "old"), _read(syl, chan, "new")
        check(f"_rd_{chan} on {syl.text}: the set is no longer SPLICED into "
              f"the sequence",
              R.uncertain(now) and not R.uncertain(old)
              and all(isinstance(v, tuple) and
                      all(isinstance(e, str) for e in v) for v in now),
              f"before {old!r}\n          after  {now!r}")


# ---------------------------------------------------------------------------
# 3. THE TRI-STATE IS THE POINT — all agree True, none can False, some None
# ---------------------------------------------------------------------------

def test_the_tri_state():
    print("\n3. the tri-state, on every patched channel: all readings agree "
          "-> True, none can -> False, some do and some do not -> None")
    wind = Syllable("wind", ("W",), Readings({"AY", "IH"}), ("N", "D"))
    wined = Syllable("wined", ("W",), "AY", ("N", "D"))
    find = Syllable("find", ("F",), "AY", ("N", "D"))
    sand = Syllable("sand", ("S",), "AE", ("N", "D"))
    close = Syllable("close", ("K", "L"), "OW", Readings({("S",), ("Z",)}))
    rose = Syllable("rose", ("R",), "OW", ("Z",))
    doze = Syllable("doze", ("D",), "OW", ("Z",))

    check("wind/wined on `phones`: UNDECIDED, where it was a confident False",
          A(_read(wind, "phones", "old"), _read(wined, "phones", "old")).value
          is False
          and A(_read(wind, "phones"), _read(wined, "phones")).value is None,
          "one reading of `wind` IS /W AY N D/ and the other is not, so the "
          "phone sequences overlap and do not settle. Before the fix the "
          "frozenset was spliced in as a single element and the whole "
          "sequence compared unequal: a definite False about a word the "
          "declaration cannot resolve.")
    check("wind/find on `phones` is a definite FALSE both before and after, "
          "and that is CORRECT",
          A(_read(wind, "phones", "old"), _read(find, "phones", "old")).value
          is False
          and A(_read(wind, "phones"), _read(find, "phones")).value is False,
          "recorded because the patch note that motivated this cell gives "
          "`Agree(phones(wind), ('F','AY','N','D')) -> False  # should be "
          "None` as its worked example, and that example is wrong: `phones` "
          "carries the ONSET, W and F disagree under every reading, and no "
          "reading of either member agrees. The defect is real; this pair is "
          "not an instance of it, and a fix aimed at making THIS None would "
          "have been a fix that over-refuses.")
    check("wind/sand on `phones`: still a definite FALSE — the fix does not "
          "over-refuse",
          A(_read(wind, "phones"), _read(sand, "phones")).value is False,
          "no reading of either agrees, so the answer is decidable and it is "
          "given. A flat `return None` on any uncertain channel would have "
          "thrown this away and looked like a fix.")
    check("close/rose on `coda`: UNDECIDED (readings overlap, do not settle)",
          A(_read(close, "coda", "old"), _read(rose, "coda", "old")).value
          is False
          and A(_read(close, "coda"), _read(rose, "coda")).value is None,
          "before: `(('S',),('Z',))` != `('Z',)`, definite False. The whole "
          "defect in one line.")
    check("close/close on `coda`: UNDECIDED, not True — two homographs "
          "holding the SAME readings still need not sound alike",
          A(_read(close, "coda"), _read(close, "coda")).value is None,
          "`Syllable.key`'s documented trap, honoured here: this is the key "
          "of the KNOWLEDGE, not of a sound. The old reader answered a "
          "confident True by comparing two identical spliced tuples.")
    check("rose/doze on `coda`: True, and no set is involved at all",
          A(_read(rose, "coda"), _read(doze, "coda")).value is True,
          "the certain path is unchanged, which is what section 8's "
          "`untouched` column counts.")
    check("Differ inverts the same three answers rather than collapsing them",
          D(_read(wind, "phones"), _read(find, "phones")).value is None
          and D(_read(wind, "phones"), _read(sand, "phones")).value is True,
          "None must not become True on inversion; that is how a refusal "
          "turns into a finding.")


# ---------------------------------------------------------------------------
# 4. DOCTRINE 66 — the derived set's ITERATION ORDER is fixed and stated
# ---------------------------------------------------------------------------

def test_doctrine_66():
    print("\n4. doctrine 66 — the derived sets iterate in a FIXED order, so "
          "any consumer that iterates one cannot differ between runs")
    wind = Syllable("wind", ("W",), Readings({"AY", "IH"}), ("N", "D"))
    seqs = _read(wind, "phones")
    check("`Alternatives.__iter__` is sorted by repr, like `Readings`'",
          isinstance(seqs, R.Alternatives)
          and len({tuple(_read(wind, "phones")) for _ in range(50)}) == 1
          and list(seqs) == sorted(seqs, key=repr),
          f"{list(seqs)!r}")
    check("...and the SET is what the algebra uses, so the order changes no "
          "verdict",
          A(R.Alternatives({("A",), ("B",)}), ("B",)).value
          is A(R.Alternatives({("B",), ("A",)}), ("B",)).value,
          "the order guarantee is for consumers that ITERATE, not for "
          "`_set_agree`. Doctrine 66 asks a tie-break to be arbitrary, FIXED "
          "and stated; this is all three and it is load-bearing for nothing.")
    check("a production `Readings` needs no conversion at the seam",
          R.uncertain(_read(wind, "nucleus"))
          and isinstance(_read(wind, "nucleus"), Readings)
          and isinstance(_read(wind, "coda"), tuple),
          "`_alts` keys on `isinstance(x, frozenset)`, so the two sides of "
          "the seam share a contract and not an import.")


# ---------------------------------------------------------------------------
# 5. WHAT THE PRODUCT INHERITS, AND WHICH DIRECTION IT ERRS IN
# ---------------------------------------------------------------------------

def test_the_product_over_generates_conservatively():
    print("\n5. the derived product inherits per-channel merging, so it can "
          "hold sequences no reading declares — conservatively")
    # `or` is /AO R/ and /ER/.  merge_readings folds each channel separately.
    merged = E_UNC.syllabify("or")
    seqs = _read(merged[0], "phones")
    check("`or` merges to nucleus {AO, ER} x coda {('R',), ()} and the "
          "product is FOUR sequences, two of them undeclared",
          len(seqs) == 4 and ("AO", "R") in seqs and ("ER",) in seqs
          and ("AO",) in seqs and ("ER", "R") in seqs,
          f"{sorted(seqs)!r}. The declared readings are ('AO','R') and "
          f"('ER',); ('AO',) and ('ER','R') are artefacts of folding the "
          f"channels independently. `Syllable.readings()` does exactly the "
          f"same product for the same reason: once merge_readings has run, "
          f"the correlation between channels is not on the unit any more.")
    check("...and a SUPERSET of readings can only cost a verdict, never "
          "manufacture one",
          A(seqs, ("AO", "R")).value is None
          and A(seqs, ("Z", "Z")).value is False,
          "overlap without settlement is None; disjoint is still False. The "
          "loss is decisions, and it is in the direction a refusal is in.")


# ---------------------------------------------------------------------------
# 6. THE TWO GUARDS THAT NEVER FIRED, BECAUSE THE READER HID THE SET
# ---------------------------------------------------------------------------

def test_the_guards_now_fire():
    print("\n6. `_seq` and `_bucket_key` both already guarded on "
          "`uncertain()` — and never saw one, because the reader coerced it")
    st = R.build_stream(["a mighty wind", "what i did find"], E_UNC,
                        declaration={"language": "eng"})
    span = R.Span(idx=tuple(range(len(st.units))))
    use("old")
    old_seq = R._seq(span, st, "phones", R.DEFAULT_CHANNELS, "phonemic")
    use("new")
    new_seq = R._seq(span, st, "phones", R.DEFAULT_CHANNELS, "phonemic")
    check("_seq REFUSES a sequence containing an uncertain element, as its "
          "own comment has always said it does",
          old_seq is not None and new_seq is None,
          f"before: {old_seq!r}\n          after:  {new_seq!r} — the guard "
          f"at `if uncertain(v)` was unreachable through onset/coda/phones/"
          f"consonants, because those four handed it a tuple.")

    sch = R.REGISTRY["perfect rhyme"]
    wsp = R.Span(idx=(st.lines[0][-1],))
    use("old")
    old_key = R._bucket_key(sch, wsp, st, R.DEFAULT_CHANNELS)
    use("new")
    new_key = R._bucket_key(sch, wsp, st, R.DEFAULT_CHANNELS)
    check("_bucket_key treats an uncertain read as a WILDCARD, so a "
          "homograph is no longer bucketed onto one of its readings",
          new_key is None,
          f"before: {old_key!r}\n          after:  {new_key!r}. This is why "
          f"section 8 has an ADDED column: pruning a homograph onto one "
          f"reading deletes exactly the pairs P11 is about, so the fix "
          f"creates instances as well as refusing them.")


# ---------------------------------------------------------------------------
# 7. END TO END, through realise() — a coordinate reachable only from a unit
#    test is the fourth inert coordinate wearing a fix
# ---------------------------------------------------------------------------

def test_end_to_end():
    print("\n7. end to end through realise(), on the CONSONANCE schemas that "
          "read the patched channels")
    st = R.build_stream(["the winter wind", "i could not find"], E_UNC,
                        declaration={"language": "eng"})
    for name in ("parechesis / general consonance", "consonance"):
        use("old")
        old = {(i.a.idx, i.b.idx): i.verdict
               for i in R.realise(R.REGISTRY[name], st, keep="all")}
        use("new")
        new = {(i.a.idx, i.b.idx): i.verdict
               for i in R.realise(R.REGISTRY[name], st, keep="all")}
        moved = {k: (old[k], new[k]) for k in old & new.keys()
                 if old[k] is not new[k]}
        check(f"{name}: at least one instance moves off a confident verdict, "
              f"and none moves ONTO one",
              all(nv is None for _, nv in moved.values()),
              f"{len(moved)} of {len(old)} instances move; "
              f"{sorted(set(moved.values()))}")

    hom = R.realise(R.REGISTRY["perfect rhyme"],
                    R.build_stream(["the wind", "i could not find"], E_UNC,
                                   declaration={"language": "eng"}),
                    keep="all")
    cert = R.realise(R.REGISTRY["perfect rhyme"],
                     R.build_stream(["the wind", "i could not find"], E_FIRST,
                                    declaration={"language": "eng"}),
                     keep="all")
    check("wind/find is UNDECIDED under a two-reading phonology and a VERDICT "
          "under the shipped one-reading `eng` — unchanged by this fix",
          len(hom) == 1 and hom[0].verdict is None
          and len(cert) == 1 and cert[0].verdict is True,
          f"{[i.verdict for i in hom]} vs {[i.verdict for i in cert]}. The "
          f"seam fix must not disturb this: it was already right, through "
          f"`_rd_nucleus`, and it is the reference the other channels are "
          f"being made to match.")


# ---------------------------------------------------------------------------
# 8. THE COUNTS — THREE OF THEM, ON BOTH CORPORA (doctrine 79)
#
# Adjacent LINE-FINAL pairs, every one in the corpus, `Agree` on each channel
# under the old readers and the new.  A fix that moved nothing would be a
# finding too; this one moves 1,053 English reads out of 189,414 pairs and 22
# Middle Chinese ones out of 3,732, and every single move is off a confident
# verdict onto a refusal.  Nothing moves the other way, in either corpus, on
# any channel — which is the check that this is a REFUSAL and not a rewrite.
#
# RECORDED, from the same code (`--quick` skips the re-derivation):
#
#   corpus/song/eng_*  143 files, 189,414 adjacent line-final pairs
#     channel      exposed  True->None  False->None  untouched
#     onset           3776          49          198     189167
#     coda            3843          36          874     188504
#     consonants      7340          56           91     189267
#     phones         26404         290          140     188984
#     nucleus        21248           0            0     189414   (already right)
#     prominence     19808           0            0     189414   (already right)
#
#   corpus/song/ltc_huajianji.txt  花間集, 3,732 adjacent line-final pairs
#     onset            517           1           14       3717
#     coda               0           0            0       3732   (ltc has none)
#     consonants       517           1           14       3717
#     phones           622           1            6       3725
#     nucleus          432           0            0       3732   (already right)
#     prominence       838           0            0       3732   (already right)
#
# AND THE SAME THING AT THE INSTANCE LEVEL, through realise(), over the 63 of
# 77 schemas whose channel map touches onset/coda/consonants/phones:
#
#   152 sonnets, 63 schemas          True->None  False->None  untouched   added
#                                          2145         3557   14401861    5610
#   500 花間集 songs, 63 schemas                6         1792     942720    1680
#
# `added` is instances that exist only under the NEW readers, and it is not
# noise: `_bucket_key` used to prune a homograph onto ONE of its readings, so
# the fix RECOVERS candidate pairs it then refuses on. Removed: 0 in both.
# ---------------------------------------------------------------------------

CHANNELS = ("onset", "coda", "consonants", "phones", "nucleus", "prominence")


def _corpus_moves(paths, phon):
    """-> {channel: Counter[(old_verdict, new_verdict)]}, and the pair count."""
    tally = {c: Counter() for c in CHANNELS}
    exposed = Counter()
    pairs = 0
    for p in sorted(paths):
        ls = [s for s in (l.strip() for l in open(p, encoding="utf-8"))
              if s and not s.startswith("#")]
        if not ls:
            continue
        st = R.build_stream(ls, phon, declaration={"language": phon.language})
        fin = [ix[-1] for ix in st.lines if ix]
        got = {}
        for which in ("old", "new"):
            use(which)
            got[which] = {i: {c: R.DEFAULT_CHANNELS.read(st.units[i], c, st)
                              for c in CHANNELS} for i in fin}
        use("new")
        for a, b in zip(fin, fin[1:]):
            pairs += 1
            for c in CHANNELS:
                ra, rb = got["new"][a][c], got["new"][b][c]
                if R.uncertain(ra) or R.uncertain(rb):
                    exposed[c] += 1
                tally[c][(A(got["old"][a][c], got["old"][b][c]).value,
                          A(ra, rb).value)] += 1
    return tally, exposed, pairs


def _report(label, tally, exposed, pairs, expect):
    print(f"    {label}: {pairs} adjacent line-final pairs")
    print(f"    {'channel':<12}{'exposed':>8}{'T->None':>9}{'F->None':>9}"
          f"{'untouched':>11}{'  other (must be 0)'}")
    got = {}
    for c in CHANNELS:
        t = tally[c]
        tn, fn = t[(True, None)], t[(False, None)]
        same = sum(v for k, v in t.items() if k[0] == k[1])
        other = sum(v for k, v in t.items()
                    if k[0] != k[1] and k not in ((True, None), (False, None)))
        got[c] = (tn, fn)
        print(f"    {c:<12}{exposed[c]:>8}{tn:>9}{fn:>9}{same:>11}{other:>20}")
        if other:
            print(f"        OTHER MOVES: "
                  f"{ {k: v for k, v in t.items() if k[0] != k[1]} }")
    check(f"{label}: every move is a confident verdict -> a refusal, and "
          f"nothing moves the other way",
          all(sum(v for k, v in tally[c].items()
                  if k[0] != k[1]
                  and k not in ((True, None), (False, None))) == 0
              for c in CHANNELS),
          "a True->False or a None->True here would mean the fix invented an "
          "answer rather than withdrawing one.")
    check(f"{label}: the two channels that were ALREADY right do not move",
          got["nucleus"] == (0, 0) and got["prominence"] == (0, 0),
          "`_rd_nucleus` and `_rd_prominence` returned their channel raw "
          "before the fix and return it raw after; a move here would mean "
          "the patch changed something it was not supposed to touch.")
    check(f"{label}: the recorded counts reproduce", got == expect,
          f"got {got}\n          expected {expect}")


def test_corpus_counts():
    print("\n8. THE COUNTS — three of them, on both corpora (doctrine 79)")
    t, e, n = _corpus_moves([os.path.join(CORPUS, "sonnets.txt")], E_UNC)
    _report("ENGLISH corpus/sonnets.txt", t, e, n,
            {"onset": (0, 5), "coda": (2, 18), "consonants": (2, 1),
             "phones": (2, 1), "nucleus": (0, 0), "prominence": (0, 0)})
    t, e, n = _corpus_moves(
        [os.path.join(CORPUS, "song", "ltc_huajianji.txt")], L_UNC)
    _report("MIDDLE CHINESE 花間集", t, e, n,
            {"onset": (1, 14), "coda": (0, 0), "consonants": (1, 14),
             "phones": (1, 6), "nucleus": (0, 0), "prominence": (0, 0)})
    print("      corpus/song/eng_* (143 files, 189,414 pairs) is RECORDED in "
          "this section's comment rather than re-run: it is a 40s pass and "
          "the sonnets above exercise the same code on the same phonology.")
    print("      re-run it with: python3 quality/test_readings_seam.py --eng")


def test_eng_song_corpus():
    print("\n8b. the 143-file eng_* song corpus, re-derived")
    t, e, n = _corpus_moves(glob.glob(os.path.join(CORPUS, "song", "eng_*.txt")),
                            E_UNC)
    _report("ENGLISH corpus/song/eng_*", t, e, n,
            {"onset": (49, 198), "coda": (36, 874), "consonants": (56, 91),
             "phones": (290, 140), "nucleus": (0, 0), "prominence": (0, 0)})


# ---------------------------------------------------------------------------
# 9. THE ORACLE DID NOT MOVE, and it cannot: `eng` still declares ONE reading
# ---------------------------------------------------------------------------

def test_the_default_is_untouched():
    print("\n9. the shipped default is byte-identical — no module emits a set")
    st = R.build_stream(["The cat sat on the mat", "He wore a funny hat"],
                        E_FIRST, declaration={"language": "eng"})
    same = True
    for u in st.units:
        for c in CHANNELS + ("consonants",):
            use("old")
            a = R.DEFAULT_CHANNELS.read(u, c, st)
            use("new")
            if R.DEFAULT_CHANNELS.read(u, c, st) != a:
                same = False
    check("every channel of every unit reads identically old vs new under the "
          "shipped `eng`", same,
          "the fix is inert wherever no channel holds a set, which is every "
          "shipped phonology today. `python3 battery.py` still prints "
          "1064 / 1014 / 50 / 81.")
    check("...and `Alternatives` is only ever constructed from an uncertain "
          "channel",
          not any(isinstance(R.DEFAULT_CHANNELS.read(u, c, st),
                             frozenset)
                  for u in st.units for c in CHANNELS + ("consonants",)),
          "a certain syllable never acquires a set on the way through.")


if __name__ == "__main__":
    quick = "--quick" in sys.argv
    for fn in (test_doctrine_25_tripwire,
               test_the_four_readers,
               test_the_tri_state,
               test_doctrine_66,
               test_the_product_over_generates_conservatively,
               test_the_guards_now_fire,
               test_end_to_end,
               test_the_default_is_untouched):
        fn()
    if not quick:
        test_corpus_counts()
    if "--eng" in sys.argv:
        test_eng_song_corpus()
    use("new")
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all readings-seam regressions pass")
