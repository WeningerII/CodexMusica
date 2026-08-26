#!/usr/bin/env python3
"""Regressions for quality/g2p.py — known gap 1's fallback, and its costs.

WHAT THIS FILE IS FOR

`quality/g2p.py` replaces refusals with answers, which is the most dangerous
kind of change this repo can make: a refusal is visible and a wrong answer is
not. So the tests here are not "does it read `viewest`". They are:

  1. the tripwire — the fallback OFF reproduces the battery exactly;
  2. the three counts, kept as three (doctrine 79);
  3. held-out CMUdict accuracy, on a split this file states (doctrine 13);
  4. accuracy on the REAL refusal population, measured against ground truth
     that no resource of ours supplied — Shakespeare's form (doctrine 37);
  5. the canary, which is still a REFUSAL, and the measurement showing that
     every route which answers it answers it WRONG;
  6. that no reading is ever produced without its provenance;
  7. that `lh.Lexicon`'s OWN opt-in wiring to the fallback (§14-20) matches
     everything §1-13 establishes about `Fallback` standing alone -- default
     off, known answers in, coinages still refused, no recursion;
  8. that the letter layer's rules still have a LIVE PRODUCER (§21) and that
     the three counts have a caller (§22-23). Both were built-and-never-run:
     `train_letter_rules` was reachable only from `g2p.py --train`, so the
     shipped `data/g2p_letter_rules.tsv` had nothing regenerating it, and
     `three_counts` was reachable from nothing that prints.

Run: python3 quality/test_g2p.py
     python3 quality/test_g2p.py --slow      # adds the corpus-scale counts
                                             # and the full 65s rule rebuild
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as lh                                       # noqa: E402
import quality.g2p as G                                          # noqa: E402
from quality.phonology import get                                # noqa: E402
from quality.phonology.eng import English, FALLBACK_MODES        # noqa: E402

FAILURES = []
LEX = lh.Lexicon()
SLOW = "--slow" in sys.argv


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


class Raw:
    """A lexicon view whose `transcribe_word` is the shipped one. Used wherever
    a test patches the real method, so the fallback's own dictionary layer can
    never recurse into the patch."""
    _orig = lh.Lexicon.transcribe_word

    def __init__(self, lex=LEX):
        self.entries = lex.entries
        self.freq_rank = getattr(lex, "freq_rank", {})
        self._lex = lex

    def transcribe_word(self, w):
        return Raw._orig(self._lex, w)


def fb(mode="high", **kw):
    return G.Fallback(Raw(), min_confidence=mode, **kw)


# ---------------------------------------------------------------------------
# 1. THE TRIPWIRE
# ---------------------------------------------------------------------------

def test_default_is_off():
    print("\n1. the fallback is OFF everywhere it was not asked for")
    e = get("eng")
    check("the REGISTERED eng has no fallback", e.fallback is None,
          "quality.phonology.get('eng') is what every existing caller holds; "
          "if this flips, every recorded number in the repo silently moves")
    check("and it still refuses `viewest`", e.syllabify("viewest") == [],
          "the same refusal test_relations.py pins as known gap 1's canary")
    check("`layer_of` says None rather than raising",
          e.layer_of("viewest") is None,
          "doctrine 28: 'cannot read' is a value in the same range as the "
          "layers, not an exception a caller can forget to catch")
    check("an undeclared mode is refused, not coerced",
          _raises(lambda: English(fallback="yes")),
          f"declared modes: {sorted(k for k in FALLBACK_MODES if k)} or None")


def _raises(fn):
    try:
        fn()
        return False
    except ValueError:
        return True


def test_battery_is_unmoved():
    import battery
    print(f"\n2. battery.py with the fallback off: 1064 / 1014 / 50 / "
          f"{battery.EXPECTED['violations']}")
    sonnets = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))
    total = viol = refused = 0
    for sn in sonnets:
        res = lh.check_scheme(LEX, sn, "ABABCDCDEFEFGG", lh.Declaration())
        viol += len(res["violations"])
        refused += len(res.get("refusals", []))
        total += 7
    check("mandated 1064", total == 1064, str(total))
    check("refused 50", refused == 50, str(refused))
    check("judged 1014", total - refused == 1014, str(total - refused))
    check(f"violations {battery.EXPECTED['violations']}",
          viol == battery.EXPECTED["violations"], str(viol))


# ---------------------------------------------------------------------------
# 3. PROVENANCE — the property that makes the whole thing admissible
# ---------------------------------------------------------------------------

def test_every_reading_carries_its_layer():
    print("\n3. no pronunciation exists here without its provenance")
    f = fb("low")
    words = ["love", "viewest", "o'er", "hypotenuse", "carcanet", "to-day"]
    got = [(w, f.read(w)) for w in words]
    check("every non-refusal has a declared layer",
          all(r is None or r.layer in G.LAYERS for _, r in got),
          ", ".join(f"{w}={'REFUSED' if r is None else r.layer}"
                    for w, r in got))
    check("every DICTIONARY-DERIVED reading names the headwords it rests on",
          all(r is None or not r.dictionary_derived or
              (r.basis and all(b in LEX.entries or "-" in b or "'" in b
                               for b in r.basis))
              for _, r in got),
          "morphology and elision must point at a CMUdict entry; a reading "
          "with an empty basis is a reading with no dictionary behind it")
    check("the LETTER layer names no basis, because it has none",
          all(r is None or r.layer != "letter" or r.basis == ()
              for _, r in got))
    check("`dictionary_derived` is not the same predicate as "
          "`layer == 'dictionary'`",
          (lambda r: r is not None and r.dictionary_derived
           and r.layer != "dictionary")(fb().read("viewest")),
          "viewest is derived from a dictionary entry without being one")
    check("a Reading cannot be built without a layer",
          _type_error(lambda: G.Reading(("AH0",))),
          "`layer` has no default, so there is no way to hold a reading and "
          "not know where it came from (doctrine 1)")


def _type_error(fn):
    try:
        fn()
        return False
    except TypeError:
        return True


def test_refusal_survives():
    print("\n4. a word no declared layer reads still REFUSES")
    f = fb()
    for w in ("zzzqx", "hypotenuse", "carcanet", "zide", "hwome", "awa"):
        check(f"{w} refuses", f.read(w) is None)
    check("and refusing is not an exception", fb().read("zzzqx") is None,
          "None is the answer; a caller records it as a refusal (doctrine 79)")


# ---------------------------------------------------------------------------
# 5. THE MORPHOLOGY LAYER'S KNOWN ANSWERS
#
# Every one of these was a MEASURED refusal in the sonnet battery before this
# module existed. The repo's rule is that a fixed case becomes a permanent
# regression, and the rule matters more than usual here: three of them
# (`deceivest`, `usest`, `dulness`) were produced WRONG by an earlier draft of
# the tie-break and nothing downstream would have said so.
# ---------------------------------------------------------------------------

KNOWN = {
    "viewest": "V Y UW1 IH0 S T",
    "renewest": "R IH0 N UW1 IH0 S T",
    "gazeth": "G EY1 Z IH0 TH",
    "amazeth": "AH0 M EY1 Z IH0 TH",
    "receivest": "R AH0 S IY1 V IH0 S T",
    "deceivest": "D IH0 S IY1 V IH0 S T",
    "usest": "Y UW1 S IH0 S T",
    "grow'st": "G R OW1 S T",
    "dulness": "D AH1 L N AH0 S",
    "fulness": "F UH1 L N AH0 S",
    "meetness": "M IY1 T N AH0 S",
    "savour": "S EY1 V ER0",
    "offence": "AH0 F EH1 N S",
    "outworn": "AW1 T W AO1 R N",
    "unbred": "AH0 N B R EH1 D",
    "o'er": "AO1 R",
    "'gainst": "G EH1 N S T",
    "heav'n": "HH EH1 V N",
    "pow'r": "P AW1 R",
    "groun'": "G R AW1 N",
    "thro'": "TH R UW1",
}


def test_known_answers():
    print("\n5. the morphology and elision layers, on words that were refused")
    f = fb()
    bad = []
    for w, want in KNOWN.items():
        r = f.read(w)
        if r is None or " ".join(r.phones) != want:
            bad.append(f"{w}: want {want}, got "
                       f"{'REFUSED' if r is None else ' '.join(r.phones)}")
    check(f"all {len(KNOWN)} known answers", not bad, "; ".join(bad) or "ok")
    check("the allomorph is conditioned, not constant",
          " ".join(f.read("usest").phones).endswith("IH0 S T")
          and " ".join(f.read("grow'st").phones).endswith("OW1 S T"),
          "`-st` after a sibilant takes the epenthetic vowel and after a vowel "
          "does not; a constant `S T` gave `Y UW1 S S T`, which is not a "
          "possible English word")
    check("the DICTIONARY wins over any rule",
          f.read("loves").layer == "dictionary"
          and f.read("writing").layer == "dictionary",
          "`writing` decomposes as `writ`+`-ing` and CMUdict lists `writ`; "
          "the morphology layer must never be reached for a word the "
          "dictionary already has")


def test_elision_rows_all_apply():
    print("\n6. every row of data/eng_elision.tsv still applies")
    rows = G.load_elisions()
    check("the table loaded", len(rows) >= 10, f"{len(rows)} rows")
    bad = []
    for form, (full, basis, ops, note) in sorted(rows.items()):
        if basis not in LEX.entries:
            bad.append(f"{form}: basis {basis!r} absent from cmudict.dict")
            continue
        try:
            out = G.apply_elision_ops(LEX.entries[basis][0], ops)
        except G.ElisionRowFailed as e:
            bad.append(f"{form}: {e}")
            continue
        if not out:
            bad.append(f"{form}: ops emptied the pronunciation")
    check("all rows resolve against the shipped dictionary", not bad,
          "; ".join(bad) or f"{len(rows)} rows, no hand-written phones in any "
          f"of them")
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".tsv", delete=False) as t:
        t.write("o'er\tover\tzzzqx-not-a-headword\t=\tbogus basis\n")
        p = t.name
    try:
        r = G.Fallback(Raw(), elision_path=p).read("o'er")
        check("a row whose BASIS is missing does not fabricate a reading",
              r is None or r.layer != "elision",
              "the table carries no phones, so a bad row can only refuse")
    finally:
        os.unlink(p)
    # The layer ORDER is load-bearing, and this is the case that proves it.
    without = G.Fallback(Raw(), elision_path=os.devnull).read("o'er")
    check("THE LAYER ORDER IS LOAD-BEARING: elision must precede morphology",
          (fb().read("o'er").phones == ("AO1", "R")
           and without is not None and without.phones == ("OW1", "ER0")),
          "CMUdict lists `o'` (OW1), so with the elision table removed the "
          "morphology layer parses `o'er` as `o'` + `-er` and returns a "
          "TWO-syllable OW1 ER0. Both readings are dictionary-derived and "
          "only one is right, which is why the tiers are ordered rather than "
          "scored against each other: the closed attested table outranks the "
          "productive rule")


def test_dialect_is_refused_on_purpose():
    print("\n7. dialect is REFUSED, and that is the declared answer")
    f = fb("low")
    dor = ["zide", "zight", "hwome", "vall", "vloor", "veet", "stwone",
           "mwore", "zun", "zong"]
    sco = ["awa", "weel", "hame", "gane", "thegither", "sair"]
    hi = fb()
    check("no HIGH-confidence layer reads Dorset",
          all(hi.read(w) is None for w in dor),
          "`zide` is initial fricative voicing, not a misspelling of `side`; "
          "reading it as `side` moves the declaration's dialect coordinate "
          "without saying so (doctrine 1)")
    check("nor Scots", all(hi.read(w) is None or hi.read(w).layer
                           == "dictionary" for w in sco),
          ", ".join(f"{w}={'-' if hi.read(w) is None else hi.read(w).layer}"
                    for w in sco))
    check("the LETTER layer, by contrast, happily answers all of them",
          sum(1 for w in dor if f.read(w) is not None) >= len(dor) - 2,
          "which is the whole objection to it: it has no way to say it does "
          "not know, so a dialect word gets a General American verdict")


# ---------------------------------------------------------------------------
# 8. HELD-OUT CMUdict — doctrine 13's split, stated
# ---------------------------------------------------------------------------

def test_heldout_split_is_declared_and_reproducible():
    print("\n8. held-out CMUdict, on a split this file states")
    tr1, ho1 = G._split_dict(LEX.entries)
    tr2, ho2 = G._split_dict(LEX.entries)
    check("the split reproduces", ho1 == ho2,
          f"seed {G.HOLDOUT_SEED}, fraction {G.HOLDOUT_FRACTION}; "
          f"{len(tr1)} train / {len(ho1)} held out (doctrine 66)")
    check("train and held-out are disjoint", not (set(tr1) & set(ho1)))
    n = 3000 if SLOW else 800
    r = G.evaluate_heldout(LEX, lambda s: G.Fallback(s, min_confidence="high"),
                           limit=n)
    check("the derived layers read a MINORITY of held-out CMUdict",
          0.15 < r["coverage"] < 0.45,
          f"read {r['read']}/{r['heldout']} = {r['coverage']:.1%}. Held-out "
          f"CMUdict is ordinary vocabulary, most of which is not "
          f"morphologically derivable from another entry; this is NOT the "
          f"coverage on the real refusal population and must not be quoted "
          f"as if it were")
    check("and it is RIGHT about most of what it reads",
          r["whole_word_accuracy_of_read"] > 0.60,
          f"whole word (stress included) {r['exact']}/{r['read']} = "
          f"{r['whole_word_accuracy_of_read']:.1%}; phoneme "
          f"{r['phoneme_accuracy_of_read']:.1%}")
    if SLOW:
        rl = G.evaluate_heldout(
            LEX, lambda s: G.Fallback(s, min_confidence="low"), limit=n)
        lr = rl["per_layer"].get("letter", 0)
        le = rl["per_layer_exact"].get("letter", 0)
        check("the LETTER layer reads nearly everything and is right about "
              "little of it", lr and le / lr < 0.25,
              f"letter-only whole word {le}/{lr} = {le/lr:.1%} against the "
              f"derived layers' {r['whole_word_accuracy_of_read']:.1%}. "
              f"Coverage is not the metric; a fallback that answers "
              f"everything and is wrong a lot is worse than a refusal")


# ---------------------------------------------------------------------------
# 9. THE REAL POPULATION — ground truth nobody here supplied
# ---------------------------------------------------------------------------

def _patched_battery(mode, extra=None, decl=None):
    """Run the sonnet scheme check with `Lexicon.transcribe_word` routed
    through the fallback. Returns (mandated, judged, refused, violations,
    newly-judged pairs, violations among them). `decl` declares the door
    the arms grade under; None is the shipped default."""
    import battery
    orig = lh.Lexicon.transcribe_word
    cache = {}
    if mode is not None:
        def patched(self, word):
            key = (id(self), word)
            if key not in cache:
                f = cache.setdefault(
                    id(self),
                    G.Fallback(Raw(self), min_confidence=mode,
                               extra_g2p=extra))
                r = f.read(word)
                cache[key] = ([], True) if r is None else (list(r.phones),
                                                           False)
            return cache[key]
        lh.Lexicon.transcribe_word = patched
    try:
        sonnets = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))
        total = 0
        viol, refused = set(), set()
        for idx, sn in enumerate(sonnets, 1):
            res = lh.check_scheme(LEX, sn, "ABABCDCDEFEFGG",
                                  decl or lh.Declaration())
            for v in res["violations"]:
                viol.add((idx, v[0], v[1]))
            for r in res.get("refusals", []):
                refused.add((idx, r["lines"][0], r["lines"][1]))
            total += 7
    finally:
        lh.Lexicon.transcribe_word = orig
    return total, total - len(refused), refused, viol


def test_real_population_against_shakespeares_own_form():
    print("\n9. the REAL refusal population, judged by the form itself")
    m0, j0, r0, v0 = _patched_battery(None)
    m1, j1, r1, v1 = _patched_battery("high")
    newly = r0 - r1
    new_viol = [p for p in newly if p in v1]
    # REPINNED 2026-08-23 from ~~82~~ violations to 35 (doctrine 17), and
    # `CLAUDE.md`'s own known-gap 1 predicted the number in as many words:
    # "ALL THREE VIOLATION COUNTS WERE MEASURED UNDER THE TWO-NAME DOOR ...
    # the door widened 2026-08-22 (M-59) and the `off` arm is 35 today."
    # The prose was repinned that day and this literal was not, so the file
    # and the test disagreed for a day about one number.
    #
    # THE OTHER THREE DO NOT MOVE, and that is the check that this is the
    # door and not the ingestion: mandated/judged/refused are 1064/1014/50
    # before and after, because a refusal is an INGESTION verdict reached
    # before any comparison and no admit set touches it (doctrine 79).
    # REPINNED AGAIN 2026-08-25 from ~~35~~ to 12: the whole-vocabulary
    # default (M-116) retired 23 more, the same ladder step M-59's 82->35
    # was. Same shape both times — a DOOR movement this literal was behind.
    check("off reproduces the battery — mandated/judged/refused unmoved, "
          "violations at the widened door",
          (m0, j0, len(r0), len(v0)) == (1064, 1014, 50, 12),
          f"{(m0, j0, len(r0), len(v0))}")
    check("the derived layers turn 39 of the 50 refusals into judgements",
          len(newly) == 39, f"{len(newly)}; refused 50 -> {len(r1)}")
    # REPINNED 2026-08-11: 38/39 -> 37/39, one PAIR added, after cell BA's
    # coda-identity fix. Sonnet 46 L9/L11, `impannelled`/`determined`, reads
    # ...N AH0 L D / ...M AH0 N D under the "high" fallback -- codas L-D and
    # N-D, an L-vs-N first consonant, cons_sim('L','N')=0.730. Under the old
    # scalar coda this blurred through; under the shipped identity predicate
    # it correctly does not agree, same class as the will/gun case cell BA
    # found (RESULTS_CODA_SHAPE.md). Both new failures are the SAME residue:
    # a real Elizabethan pairing that does not hold in the declared General
    # American dialect, not a bad guess by the fallback.
    # REPINNED 2026-08-23 from ~~2~~ to 1 (doctrine 17). The comment above
    # is the 2026-08-11 record and stays as written; what it describes has
    # since been overtaken at the DOOR rather than at the comparator.
    # `impannelled`/`determined` is an L-vs-N coda, which the identity
    # predicate correctly types CONSONANCE — and CONSONANCE entered the
    # default admit set on 2026-08-22, so the pair now SATISFIES and leaves
    # this count. `recur'd`/`assur'd` remains, and remains for the reason
    # given: it is the declared-dialect residue, not a bad guess.
    #
    # SO THE ACCURACY WENT UP AND THE FALLBACK DID NOT CHANGE. That is the
    # thing worth saying out loud: this number measures the fallback against
    # the form as ground truth, and it moved because the door moved, so it
    # is not a clean fallback-accuracy figure across the two dates. The
    # 38/39 is against the CURRENT door.
    # REPINNED 2026-08-25 from ~~1~~ to 0 (doctrine 17): the last
    # standing residue, `recur'd`/`assur'd`, stands in a schema under the
    # whole-vocabulary default (M-116) and leaves the count the same way
    # `impannelled`/`determined` left it at M-59. Both remain what they
    # always were — declared-dialect residue, not bad guesses — and both
    # come BACK, measured, under the declared two-name door §10 now runs
    # its cost comparison on: new_viol there is exactly [(45,9,11),
    # (46,9,11)].
    check("and all 39 SATISFY the current door, as the sonnet mandates",
          len(new_viol) == 0,
          f"{len(newly) - len(new_viol)}/{len(newly)} = "
          f"{1 - len(new_viol)/len(newly):.1%}. This is the only clean "
          f"accuracy number available on the real population: the form is "
          f"ground truth about the sound and no resource of ours supplied it "
          f"(doctrine 37)")
    check("no pair that was JUDGED before changed its verdict",
          v0 <= v1 and not (v0 - v1),
          "the fallback fires only on words the dictionary refused, so a "
          "previously judged pair must be untouched; if this fails the "
          "fallback is overriding CMUdict somewhere")
    check("11 pairs still refuse, and they are real lexical gaps",
          len(r1) == 11,
          "ruinate, vassalage/embassage, equipage, invocate, forbear, "
          "carcanet, nought, jollity, strumpeted, attainted, 'greeing — "
          "words no morphology reaches, because they are not derived")


def test_letter_layer_costs_more_than_it_buys():
    print("\n10. what the LETTER layer does to the same 50 pairs")
    # UNDER THE DECLARED TWO-NAME DOOR SINCE 2026-08-25 (M-116). This
    # comparison decides a shipped default by measuring how often each
    # fallback layer answers Shakespeare's real refusals WRONG — and under
    # the whole-vocabulary default both rates are 0/39 and 0/10, because
    # the door rescues the wrong answers along with the right ones, so the
    # ratio the check asserts is 0/0. A demonstration of a cost has to run
    # where the cost is visible (the same argument §18 of test_revise.py
    # makes): the two-name door is a DECLARED narrowing, the rescue defers
    # to it (`lyric_harness.admit_is_default`), and it is the door the
    # original 50.0%-vs-5.1% measurement was made under — re-measured
    # here, it reproduces to the decimal (5/10 against 2/39, 9.8x).
    _door = lh.Declaration(admit=("RHYME", "RIME_RICHE"))
    m0, j0, r0, v0 = _patched_battery(None, decl=_door)
    m1, j1, r1, v1 = _patched_battery("high", decl=_door)
    m2, j2, r2, v2 = _patched_battery("low", decl=_door)
    only_letter = r1 - r2                       # judged by the letter layer
    lv = [p for p in only_letter if p in v2]
    # BOTH RATES ARE COMPUTED, NEITHER IS QUOTED. This message used to carry
    # the derived layers' rate as the literal "1/39 = 3%", which went stale on
    # 2026-08-11 the moment §9's own repin moved 38/39 to 37/39 and did not
    # come here -- so the comparison that decides a shipped default was being
    # read off a number one section above had already corrected. Doctrine 48:
    # a figure that lives in a string gets updated exactly as often as someone
    # remembers it. It is derived from the same three battery runs now.
    derived_new = r0 - r1
    derived_wrong = [p for p in derived_new if p in v1]
    d_rate = len(derived_wrong) / len(derived_new) if derived_new else 0.0
    l_rate = len(lv) / len(only_letter) if only_letter else 0.0
    check("it makes almost every remaining pair judgeable",
          len(r2) <= 1, f"refused {len(r1)} -> {len(r2)}")
    check("and about half of what it alone judges does NOT rhyme",
          only_letter and l_rate >= 0.4,
          f"{len(lv)}/{len(only_letter)} = {l_rate:.0%} violations among the "
          f"pairs only the letter layer could judge, against "
          f"{len(derived_wrong)}/{len(derived_new)} = {d_rate:.1%} for the "
          f"derived layers. Violations {len(v0)} -> {len(v1)} (high) -> "
          f"{len(v2)} (low). A refusal replaced by a coin flip is doctrine "
          f"79's defect arriving through a new door: the harness reporting "
          f"Shakespeare as failing to rhyme, on a pronunciation nothing "
          f"attested")
    # THE COMPARISON, not either number alone. `>= 0.4` above pins the letter
    # layer's own rate and would still pass if the derived layers had rotted
    # to 39% beside it; what decides the default is that one is far worse than
    # the other, so that is asserted directly. 5x is a wide bound on purpose:
    # the measured gap is about 10x and the claim being defended is a KIND
    # difference, not a decimal.
    check("the letter layer is wrong at MANY TIMES the derived layers' rate — "
          "the comparison that decides the default, asserted rather than "
          "read off two independently-drifting literals",
          d_rate > 0 and l_rate >= 5 * d_rate,
          f"letter {l_rate:.1%} against derived {d_rate:.1%} = "
          f"{l_rate / d_rate:.1f}x. It buys {len(only_letter)} more judged "
          f"pairs and pays {len(v2) - len(v1)} more violations for them; the "
          f"derived layers bought {len(derived_new)} for "
          f"{len(v1) - len(v0)}")
    check("which is why `high` is the default and `low` is reachable",
          English().fallback is None
          and English(fallback="low").fallback == "low",
          "doctrine 48's shape: the cost is a number and the switch is a "
          "coordinate, not a paragraph")


# ---------------------------------------------------------------------------
# 11. THE CANARY — and it is still a refusal
# ---------------------------------------------------------------------------

def test_the_canary_is_still_refused_and_that_is_correct():
    print("\n11. known gap 1's canary: score \"lot o' news\" -- \"hypotenuse\"")
    f = fb()
    check("the HIGH layers refuse `hypotenuse`", f.read("hypotenuse") is None,
          "it is not derived from anything CMUdict has, so nothing here is "
          "entitled to a pronunciation for it. THE CANARY IS NOT FIXED BY "
          "THIS MODULE, and the gap entry has to say so")
    lo = fb("low").read("hypotenuse")
    check("the LETTER layer answers it", lo is not None,
          " ".join(lo.phones) if lo else "-")
    # Score the pair with the letter reading, and with the attested one.
    decl = lh.Declaration()

    def best(phones):
        entries = dict(LEX.entries)
        entries["hypotenuse"] = [phones]
        saved = LEX.entries
        LEX.entries = entries
        try:
            a, _, _ = lh.line_anchors(LEX, "lot o' news")
            b, _, _ = lh.line_anchors(LEX, "hypotenuse")
            out = {"total": 0.0, "relation": "NO_ANCHOR"}
            for x in (a or []):
                for y in (b or []):
                    s = lh.score(x, y, decl)
                    if s["total"] > out["total"]:
                        out = s
            return out
        finally:
            LEX.entries = saved

    guessed = best(list(lo.phones))
    gold = best("HH AY0 P AA1 T AH0 N UW2 S".split())
    check("the guessed reading yields a NON-relation — a verdict, on an "
          "invention", guessed["total"] < 0.75,
          f"guessed {' '.join(lo.phones)} -> {guessed['relation']} "
          f"{guessed['total']:.3f}")
    check("while the ATTESTED pronunciation yields a real relation",
          gold["total"] > 0.85,
          f"gold HH AY0 P AA1 T AH0 N UW2 S -> {gold['relation']} "
          f"{gold['total']:.3f}. So the canary's remedy is a DICTIONARY "
          f"ENTRY, not a G2P: letter-to-sound converts the refusal into a "
          f"false 'these do not rhyme', which is strictly worse than the "
          f"NO_ANCHOR the gap entry complains about")


# ---------------------------------------------------------------------------
# 12. THE THREE COUNTS
# ---------------------------------------------------------------------------

def test_three_counts_are_three():
    print("\n12. dictionary / fallback / refused, never two of them")
    e = English(fallback="high")
    c = e.three_counts(["love", "viewest", "o'er", "zzzqx", "hypotenuse"])
    check("three keys and they sum to the total",
          c["dictionary"] + c["fallback"] + c["refused"] == c["total"] == 5,
          str(c))
    check("the fallback column is itemised by layer",
          set(c["by_layer"]) == {"morphology", "elision"}, str(c["by_layer"]))
    off = English().three_counts(["love", "viewest", "o'er", "zzzqx"])
    check("with the fallback off the middle column is empty, not absent",
          off["fallback"] == 0 and "fallback" in off, str(off))
    check("`derived` lists what was answered on an assumption",
          [t for t, _ in English(fallback="high").derived(
              "Thou viewest o'er the zzzqx")] == ["viewest", "o'er"],
          "the companion to `unreadable`: one names what was refused, the "
          "other names what rests on a rule, and a verdict needs both")
    check("U+2019 is folded before the token split, not after",
          English(fallback="high").derived("Thou grow’st")
          == [("grow'st", "morphology")],
          "doctrine 26: the apostrophe is INSIDE the words this layer exists "
          "for, so a split that treats it as punctuation manufactures the "
          "refusals the fallback removes")


def test_corpus_scale_counts():
    if not SLOW:
        print("\n13. corpus-scale three counts — skipped, pass --slow")
        return
    print("\n13. the English song corpus, three counts at corpus scale")
    # NO ABSOLUTE COUNT IS PINNED HERE, deliberately. `corpus/song/eng_*.txt`
    # is owned by the corpus cells and moved twice while this file was being
    # written (a hymn file deleted, three edited), so `quality/test_readability
    # .py`'s 151894 / 9078 are the pins for the corpus and this file must not
    # carry a second, staler copy of them — doctrine 58 the other way round: a
    # count is a coordinate of a file set, so a test that does not own the file
    # set has no business asserting one. What IS this module's property, and is
    # asserted, is the SHAPE: three counts that sum, and a fallback that reads
    # a minority of the song refusals while reading most of the sonnet ones.
    import glob
    from quality.readability import read_lines
    f = fb()
    paths = sorted(glob.glob(os.path.join(HERE, "..", "corpus", "song",
                                          "eng_*.txt")))
    tot = un = resc = 0
    for p in paths:
        for r in lh.readability_records(LEX, read_lines(p)):
            if r["final_token"] is None:
                continue
            tot += 1
            if r["final_unreadable"]:
                un += 1
                if f.read(r["final_token"]) is not None:
                    resc += 1
    check("the three counts sum to the countable lines",
          (tot - un) + resc + (un - resc) == tot,
          f"{len(paths)} files; dictionary {tot - un} / fallback {resc} / "
          f"refused {un - resc} of {tot}")
    check("the refusal rate falls, and does not fall to zero",
          0 < (un - resc) / tot < un / tot,
          f"{un/tot:.2%} -> {(un - resc)/tot:.2%}; the residue is dialect and "
          f"no fallback that stays inside the declared General American "
          f"dialect can remove it")
    check("the fallback reads a MINORITY of the song refusals, against a "
          "majority of the sonnet ones", 0.15 < resc / un < 0.40,
          f"{resc}/{un} = {resc/un:.1%} here against 47/59 = 79.7% on the "
          f"sonnet end words. Same fallback, same dictionary, twice the "
          f"population — the song head is Dorset and Scots and the sonnet "
          f"head is archaic morphology. A fallback measured on one and quoted "
          f"about the other is the defect this cell was told to avoid")


# ---------------------------------------------------------------------------
# 14. THE LEXICON WIRING — `lh.Lexicon(fallback=...)` itself
#
# Everything above tests `Fallback` standing alone, wrapped in `Raw`. None of
# it touches whether `lyric_harness.Lexicon`'s OWN constructor and
# `transcribe_word` actually reach it. This section is that: the opt-in
# coordinate, the tripwire on its default, and the recursion hazard the
# `_DictionaryOnlyLexicon` shim exists to prevent (`Fallback._dictionary`
# calls `lex.transcribe_word`, and the real `Lexicon.transcribe_word` is what
# calls INTO the fallback -- wiring it to itself would recurse forever).
# ---------------------------------------------------------------------------

def test_lexicon_wiring_default_is_untouched():
    print("\n14. lh.Lexicon(): the default reproduces every prior refusal")
    lex = lh.Lexicon()
    check("no fallback object is built", lex.g2p_fallback is None)
    for w in ("viewest", "o'er", "savour", "groun'", "hypotenuse"):
        got = lex.transcribe_word(w)
        check(f"{w!r} still refuses", got == ([], True), str(got))


def test_lexicon_wiring_high_reads_the_known_layers():
    print("\n15. lh.Lexicon(fallback='high'): reads what Fallback reads")
    lex = lh.Lexicon(fallback="high")
    check("a Fallback instance is built and stored",
          isinstance(lex.g2p_fallback, G.Fallback))
    bad = []
    for w in ("viewest", "o'er", "savour", "groun'", "thro'"):
        phones, oov = lex.transcribe_word(w)
        want = KNOWN[w].split()
        if oov or phones != want:
            bad.append(f"{w}: want {want}, got "
                       f"{'OOV' if oov else phones}")
    check("known dictionary-derived OOV words are now readable", not bad,
          "; ".join(bad) or "ok")
    for w in ("hypotenuse", "shiesty"):
        got = lex.transcribe_word(w)
        check(f"a genuine coinage ({w!r}) still refuses at 'high'",
              got == ([], True), str(got))


def test_lexicon_wiring_leaves_existing_heuristics_alone():
    print("\n16. the fallback fires ONLY where the old heuristics already "
          "refused")
    off = lh.Lexicon()
    on = lh.Lexicon(fallback="high")
    # Dictionary hits, the plural-s/'d-elision/g-dropping heuristics, and a
    # plain refusal all have to come out identically with the fallback
    # sitting there unused -- these are not fallback-layer words.
    for w in ("love", "cats", "wights", "crown'd", "feelin'", "zzzqx"):
        a, b = off.transcribe_word(w), on.transcribe_word(w)
        check(f"{w!r} unchanged with fallback wired in", a == b,
              f"off={a} on={b}")


def test_lexicon_wiring_apostrophe_survives_to_the_fallback():
    print("\n17. `transcribe_word`'s own boundary-apostrophe strip does not "
          "reach the fallback call")
    lex = lh.Lexicon(fallback="high")
    # `groun'`/`thro'` are read via Fallback._final_apostrophe, which keys
    # off a TRAILING apostrophe `transcribe_word`'s local `w` has already
    # stripped by the time the fallback is consulted -- this is only
    # possible if the RAW word (not the locally-stripped one) is what gets
    # passed to `g2p_fallback.read`.
    for w in ("groun'", "thro'"):
        phones, oov = lex.transcribe_word(w)
        check(f"{w!r} is read via the elided-final-consonant layer",
              not oov and phones == KNOWN[w].split(), f"{phones}, oov={oov}")


def test_lexicon_wiring_counts_are_inspectable():
    print("\n18. lex.g2p_fallback.counts is the SAME tally Fallback keeps, "
          "not a shadow one")
    lex = lh.Lexicon(fallback="high")
    for w in ("viewest", "o'er", "hypotenuse", "love", "zzzqx"):
        lex.transcribe_word(w)
    c = lex.g2p_fallback.counts
    check("morphology and elision both fired",
          c["morphology"] >= 1 and c["elision"] >= 1, str(c))
    check("refused counted the coinage and the non-word",
          c["refused"] >= 2, str(c))
    check("the dictionary layer never fires through this path",
          c["dictionary"] == 0,
          "every word that reaches `g2p_fallback.read` got there BECAUSE "
          "`Lexicon.transcribe_word` already checked `self.entries` (the "
          "same dict `_DictionaryOnlyLexicon` shares) and failed; "
          "`love`, above, returns from that check before the fallback is "
          "ever called, so it cannot appear in this tally at all")


def test_lexicon_wiring_no_recursion():
    print("\n19. the shim breaks the recursion `Fallback._dictionary` would "
          "otherwise cause")
    lex = lh.Lexicon(fallback="low")   # "low" reaches every layer, incl.
                                        # the letter layer, on a real coinage
    old_limit = sys.getrecursionlimit()
    sys.setrecursionlimit(150)
    try:
        got = lex.transcribe_word("hypotenuse")
    finally:
        sys.setrecursionlimit(old_limit)
    check("a genuine coinage resolves without a RecursionError",
          got[1] is False, str(got))


def test_lexicon_wiring_rejects_undeclared_modes():
    print("\n20. an undeclared fallback value is not silently coerced")
    check("an unknown mode raises rather than defaulting to something",
          _raises_any(lambda: lh.Lexicon(fallback="maximum")),
          "doctrine 1: `fallback` is a declared coordinate with a closed "
          "vocabulary (None / 'high' / 'low'), not free text")


def _raises_any(fn):
    try:
        fn()
        return False
    except (KeyError, ValueError):
        return True


# ---------------------------------------------------------------------------
# 21. THE LETTER LAYER'S RULES HAVE A LIVE PRODUCER
#
# `data/g2p_letter_rules.tsv` is a derived artifact and `train_letter_rules`
# is its only producer. Nothing in this repo called that function outside
# `g2p.py`'s own `--train` branch, so the rules shipped with NOTHING that
# re-derives them on a run -- and an artifact whose producer is never executed
# is one dictionary revision away from being an artifact whose producer no
# longer works, with no signal in between. That is the same shape as a figure
# with no producer at all, arriving slowly.
#
# The decisive check is regenerate-and-diff and it costs 65s, so it is bounded:
# the DEFAULT run proves the producer still executes end to end (on a declared
# subset, ~2s) and that the split it would train on is still the split the
# shipped file's own header declares -- which is the "has the input moved
# under it" question. `--slow` does the full byte-for-byte reproduction.
# ---------------------------------------------------------------------------

_SPLIT_HEADER = re.compile(
    r"Training split = (\d+) CMUdict headwords; (\d+) held out "
    r"\(fraction ([\d.]+), seed (\d+)\)")


def test_letter_rules_have_a_live_producer():
    print("\n21. data/g2p_letter_rules.tsv can still be regenerated")
    import tempfile
    shipped = G.LETTER_RULES_PATH
    check("the shipped rules exist and load", os.path.exists(shipped)
          and G.LetterRules(shipped).loaded, shipped)
    # 1. HAS THE INPUT MOVED UNDER IT? The file states the split it was built
    #    on; `_split_dict` says what that split is today. If cmudict.dict is
    #    edited, these part company and every rule in the file is derived from
    #    a training set that no longer exists.
    head = ""
    with open(shipped, encoding="utf-8") as f:
        for line in f:
            if not line.startswith("#"):
                break
            head += line
    m = _SPLIT_HEADER.search(head)
    tr, ho = G._split_dict(LEX.entries)
    check("the shipped file declares the split it was built on", m is not None,
          head.strip().splitlines()[1] if m else "NO SPLIT DECLARED")
    check("and that split is still the one the current dictionary produces",
          m is not None and (int(m.group(1)), int(m.group(2)),
                             float(m.group(3)), int(m.group(4)))
          == (len(tr), len(ho), G.HOLDOUT_FRACTION, G.HOLDOUT_SEED),
          f"file says {m.groups() if m else '-'}; cmudict.dict + "
          f"_split_dict say ({len(tr)}, {len(ho)}, {G.HOLDOUT_FRACTION}, "
          f"{G.HOLDOUT_SEED}). Unequal means the rules were derived from a "
          f"training set this repo no longer has, and no test would have said "
          f"so")
    # 2. DOES THE PRODUCER STILL RUN? Bounded: every 50th headword, which is
    #    deterministic (sorted) and ~2.4% of the dictionary, so the EM and the
    #    context back-off both execute on real data in about two seconds.
    #    NEVER writes to data/ -- the shipped artifact is not this test's to
    #    move.
    sub = {w: LEX.entries[w] for w in sorted(LEX.entries)[::50]}
    tmp = os.path.join(tempfile.mkdtemp(), "letter_rules_subset.tsv")
    G.train_letter_rules(sub, out_path=tmp, verbose=False)
    rules = G.LetterRules(tmp)
    check(f"`train_letter_rules` still executes end to end ({len(sub)} "
          f"headwords)", rules.loaded and os.path.getsize(tmp) > 0,
          f"wrote {os.path.getsize(tmp)} bytes to a temp path; the producer "
          f"is reachable from nowhere but `--train`, so this is the only "
          f"thing in the repo that runs it")
    check("and what it writes is readable by the loader that consumes it",
          rules.read("hypotenuse") is not None,
          "a producer whose output its own loader refuses is a producer that "
          "does not work, and the file on disk would not say so")
    if not SLOW:
        print("      full regeneration + byte-diff — skipped, pass --slow "
              "(65s over the whole training split)")
        return
    full = os.path.join(tempfile.mkdtemp(), "letter_rules_full.tsv")
    G.train_letter_rules(LEX.entries, out_path=full, verbose=False)
    with open(shipped, "rb") as a, open(full, "rb") as b:
        same = a.read() == b.read()
    check("REGENERATED BYTE-IDENTICAL to the shipped file", same,
          "the decisive test: hard-EM alignment, context back-off and the "
          "stress model are all deterministic given the seed, so anything "
          "but equality means the shipped artifact and its producer have "
          "parted company")


# ---------------------------------------------------------------------------
# 22. THE THREE COUNTS HAVE A REPORTING PATH
#
# `Fallback.three_counts` and `English.three_counts` were both built and
# NEITHER WAS EVER CALLED BY ANYTHING THAT REPORTS. A run that opts in with
# `--fallback=high` has doctrine 79's three counts in memory and prints two of
# them at most. This section pins the reporting path that closes it on the
# library side, and -- the load-bearing half -- pins WHICH of the two counting
# instruments a report may use, because they disagree by construction.
# ---------------------------------------------------------------------------

#: Chosen to hit every column: two plain dictionary words, the three
#: reductions `Lexicon.transcribe_word` has always had, a compound, one word
#: per derived layer, and two genuine refusals.
MIXED = ["love", "cats", "wights", "crown'd", "feelin'", "to-day",
         "viewest", "o'er", "hypotenuse", "zzzqx"]


def test_three_counts_have_a_reporting_path():
    print("\n22. the three counts, counted correctly and rendered")
    # Built once each: a `Lexicon` is 3.6MB of cmudict.dict plus the frequency
    # list, and this section wants three of them, not six.
    lex = lh.Lexicon(fallback="high")
    lex_off = lh.Lexicon()
    lex_low = lh.Lexicon(fallback="low")
    c = G.lexicon_three_counts(lex, MIXED)
    check("the three counts sum to the total, and the total is not a "
          "denominator",
          c["dictionary"] + c["fallback"] + c["refused"] == c["total"],
          str({k: v for k, v in c.items() if k != "by_layer"}))
    check("`given` accounts for every token handed in",
          c["given"] == c["total"] + c["skipped"] == len(MIXED),
          f"given {c['given']} = total {c['total']} + skipped {c['skipped']}")
    off = G.lexicon_three_counts(lex_off, MIXED)
    low = G.lexicon_three_counts(lex_low, MIXED)
    check("with no fallback declared the middle column is 0 and PRESENT",
          off["fallback"] == 0 and "fallback" in off
          and off["fallback_mode"] is None,
          f"{off['dictionary']} / {off['fallback']} / {off['refused']}; a "
          f"layer that was not asked reports zero answers, which is not the "
          f"same fact as a layer that was asked and found none (doctrine 20)")
    check("the mode that produced the numbers travels with them",
          c["fallback_mode"] == "high" and low["fallback_mode"] == "low",
          "doctrine 1: a count derived under an assumption carries it")

    # THE TWO INSTRUMENTS DISAGREE, AND ONLY ONE MAY BE REPORTED.
    shim = lex.g2p_fallback.three_counts(MIXED)
    eng = English(fallback="high").three_counts(MIXED)
    check("`Fallback.three_counts` bound to the recursion-breaking shim "
          "OVERCOUNTS the fallback column",
          shim["dictionary"] < c["dictionary"]
          and shim["fallback"] > c["fallback"],
          f"shim-bound {shim['dictionary']}/{shim['fallback']}/"
          f"{shim['refused']} against {c['dictionary']}/{c['fallback']}/"
          f"{c['refused']}. `Lexicon(fallback=...)` hands `Fallback` a "
          f"`_DictionaryOnlyLexicon`, which cannot see "
          f"`Lexicon.transcribe_word`'s own reductions, so `wights`, "
          f"`crown'd` and `feelin'` get re-derived by the morphology layer "
          f"and reported as things the fallback ADDED. It added nothing: the "
          f"harness read all three before this module existed")
    check("`lexicon_three_counts` agrees with `English.three_counts` instead, "
          "which is the instrument bound to a real Lexicon",
          (c["dictionary"], c["fallback"], c["refused"], c["by_layer"])
          == (eng["dictionary"], eng["fallback"], eng["refused"],
              eng["by_layer"]),
          f"{c['dictionary']}/{c['fallback']}/{c['refused']} both ways, "
          f"by layer {c['by_layer']}. Two counting instruments that answer "
          f"the same question differently are one instrument and one bug; "
          f"this pins which is which")
    check("a hyphenated compound read whole from CMUdict is DICTIONARY, and "
          "the disclosure says so",
          c["compound_agreement"] >= 1
          and "dictionary" not in c["by_layer"],
          f"compound_agreement {c['compound_agreement']}; `to-day` splits on "
          f"the hyphen exactly as `Lexicon.transcribe` splits a LINE and both "
          f"pieces are in CMUdict, so nothing was derived. A `dictionary` key "
          f"inside `by_layer` is the bug this check exists for -- a layer "
          f"name that cannot occur in the column it was printed under")

    # THE RENDERING. The arithmetic doctrine 79 is about is a division, and
    # the defect it was written from was dividing by the wrong denominator.
    out = "\n".join(G.format_three_counts(c))
    read = c["dictionary"] + c["fallback"]
    check("the rendered line prints three numbers, named",
          all(k in out for k in ("dictionary", "fallback", "REFUSED")), out)
    # The fixture has refusals in it on purpose, so `read` and `total` are
    # DIFFERENT numbers and this check has teeth. With no refusals the two
    # denominators coincide and the assertion would pass without testing
    # anything, which is the shape of a check that quietly stops working.
    check("and the derived share divides by dictionary+fallback, never by "
          "total",
          read != c["total"]
          and f"WAS read is {c['fallback']}/{read}" in out
          and f"WAS read is {c['fallback']}/{c['total']}" not in out,
          f"derived share printed over {read} (dictionary+fallback), not "
          f"{c['total']} (total). The sonnet battery divided by the mandated "
          f"total and recorded Shakespeare as failing to rhyme `viewest`/"
          f"`renewest`; the division is done once, here, so a caller cannot "
          f"repeat it. The REFUSAL rate above it is over `total` and that is "
          f"correct -- it is the one rate whose denominator is everything")
    check("a reading from the LETTER layer is flagged in the rendering",
          low["by_layer"].get("letter", 0) >= 1
          and "WARNING" in "\n".join(G.format_three_counts(low)),
          f"by layer {low['by_layer']}; §10 measures that layer as net "
          f"harmful, so a count that includes it may not be printed as though "
          f"it were the same kind of number as a derived one")
    empty = G.format_three_counts(
        G.lexicon_three_counts(lex_off, ["zzzqx", "qqqzx"]))
    check("nothing read is a finding, not a division by zero",
          any("no rate" in l for l in empty), " / ".join(empty))


def test_the_counts_are_reachable_from_a_command_line():
    print("\n23. `python3 quality/g2p.py --counts=...` prints them")
    import io
    import contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = G.main(["g2p.py", "--counts=high", "love", "viewest", "o'er",
                     "hypotenuse"])
    got = buf.getvalue()
    check("the verb runs and exits 0", rc == 0, got.strip() or "(no output)")
    check("and prints all three counts", "dictionary 1" in got
          and "fallback 2" in got and "REFUSED 1" in got, got.strip())
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        rc2 = G.main(["g2p.py", "--counts=maximum", "love"])
    check("an undeclared mode REFUSES and exits 2 rather than counting under "
          "a mode nobody declared", rc2 == 2,
          err.getvalue().strip() or f"rc={rc2}")


if __name__ == "__main__":
    test_default_is_off()
    test_battery_is_unmoved()
    test_every_reading_carries_its_layer()
    test_refusal_survives()
    test_known_answers()
    test_elision_rows_all_apply()
    test_dialect_is_refused_on_purpose()
    test_heldout_split_is_declared_and_reproducible()
    test_real_population_against_shakespeares_own_form()
    test_letter_layer_costs_more_than_it_buys()
    test_the_canary_is_still_refused_and_that_is_correct()
    test_three_counts_are_three()
    test_corpus_scale_counts()
    test_lexicon_wiring_default_is_untouched()
    test_lexicon_wiring_high_reads_the_known_layers()
    test_lexicon_wiring_leaves_existing_heuristics_alone()
    test_lexicon_wiring_apostrophe_survives_to_the_fallback()
    test_lexicon_wiring_counts_are_inspectable()
    test_lexicon_wiring_no_recursion()
    test_lexicon_wiring_rejects_undeclared_modes()
    test_letter_rules_have_a_live_producer()
    test_three_counts_have_a_reporting_path()
    test_the_counts_are_reachable_from_a_command_line()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f_ in FAILURES:
            print(f"  - {f_}")
        sys.exit(1)
    print("all g2p / fallback regressions pass")
