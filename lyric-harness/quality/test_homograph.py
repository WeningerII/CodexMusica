#!/usr/bin/env python3
"""DEFECT P11's PRODUCTION HALF — a Syllable may hold a set of readings.

    python3 quality/test_homograph.py

WHAT WAS OPEN AND WHY IT WAS OPEN IN TWO PLACES

`quality/relations.py` closed P11 on 2026-08-11 for the layer that COMPARES: a
channel may hold a `frozenset` of readings, and `Agree`/`Differ` return True
where every reading agrees, False where none can, and **None where some do and
some do not**. Its own comment names the half it could not reach:

    WHAT REMAINS OPEN IS NOT HERE.  `quality.phonology.Syllable.nucleus` is a
    `str`, so no shipped phonology can PRODUCE a two-reading syllable.

So the uncertainty had to be INJECTED by a caller, and the caller that mattered
never did. CMUdict lists `W AY1 N D` before `W IH1 N D`, `test_relations.py`'s
`EnglishFixture` takes `prons[0]`, and the shipped fixture therefore reported

    wind / find   ->   PERFECT RHYME, verdict True

which is right for the verb, wrong for the noun, and silent about which one it
read. `quality/phonology/__init__.py` now lets a `Syllable` carry either a
single reading or a `Readings` set, and this file is the pin.

THE THREE THINGS THIS FILE HAS TO SHOW, IN THIS ORDER

  1. DOCTRINE 25 FIRST, because it is the registered tripwire: two ABSENT codas
     AGREE and carry no evidence, `see`/`free` is a perfect rhyme, and a
     quarter of the sonnets' mandated pairs have two empty codas. A set-algebra
     rewrite that lost this would delete them all while the case that motivated
     the change still looked fixed.
  2. NINE MODULES, UNMOVED. `cym fin fas ltc msa non san som eng` all construct
     `Syllable`. Every one of them is byte-identical after the change, over
     2,489 real word-syllabifications from this repo's own corpora, and the
     sonnet battery still prints 1064 / 1014 / 50 / 81.
  3. THE TWO MODULES THAT GENUINELY HAVE HOMOGRAPHS, and what each now returns
     — with the honest answer about whether that is an IMPROVEMENT or merely a
     REFUSAL, which is a different verdict for the two of them.

DOCTRINE 79 IS THE REPORTING RULE AND IT IS OBEYED HERE
Read / refused / undecided are THREE counts, never two, and `refused` splits
further (doctrine 88) into "the phonology could not read the word" and "it read
several readings and could not align them".
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as lh                                       # noqa: E402
import quality.relations as R                                    # noqa: E402
from quality.phonology import (CERTAIN, MERGED, UNALIGNABLE,     # noqa: E402
                               UNREADABLE, Phonology, Readings,
                               Syllable, declared, get,
                               is_uncertain, merge_readings,
                               reading_census, readings_of, sole)
from quality.phonology import eng, ltc                            # noqa: E402

FAILURES = []
LEX = lh.Lexicon()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# ---------------------------------------------------------------------------
# The two opt-in readers. They are SUBCLASSES on purpose: `quality/phonology/
# eng.py` and `ltc.py` are not this cell's to edit, and a subclass proves the
# base-class hook is enough to wire a real module in six lines. The patches are
# in the cell's scratch directory and say the same thing as a `readings=`
# coordinate on the shipped class.
# ---------------------------------------------------------------------------

class EnglishAllReadings(eng.English):
    """`eng` with every CMUdict pronunciation kept instead of the first."""

    language = "eng"

    def parses(self, word):
        w = lh.fold_apostrophes(word).lower()
        prons = LEX.entries.get(w)
        if not prons:
            return [self.syllabify(word)]
        return [[Syllable(text=word, onset=tuple(s["onset"]),
                          nucleus=s["nucleus"], coda=tuple(s["coda"]),
                          prominence=1 if s["stress"] in (1, 2) else 0,
                          moras=1)
                 for s in lh.syllabify(p)] for p in prons]


class EnglishUncertain(EnglishAllReadings):
    """...and with `syllabify` returning the merged reading, so the knowledge
    sets reach `relations.build_stream` and the predicates, not only a unit
    test. Doctrine 84: a coordinate reachable only from a test is inert."""

    def syllabify(self, word):
        return merge_readings(self.parses(word))[0]


class LtcAllReadings(ltc.MiddleChinese):
    """`ltc` with every 多音字 reading kept. `readings(ch)` already returns
    them all and `syllabify` already took `rs[0]`; only the fold is new."""

    def parses(self, word):
        import itertools
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


E_FIRST = eng.English()
E_ALL = EnglishAllReadings()
E_UNC = EnglishUncertain()
L_FIRST = ltc.MiddleChinese()
L_ALL = LtcAllReadings()


# ---------------------------------------------------------------------------
# 1. THE TRIPWIRE — doctrine 25, checked first, exactly as doctrine 25 says
# ---------------------------------------------------------------------------

def test_doctrine_25_tripwire():
    print("\n1. DOCTRINE 25 FIRST — two ABSENT codas AGREE and carry NO "
          "evidence; see/free is a perfect rhyme")
    A, D = R.Agree(), R.Differ()
    check("Agree((), ()) is (True, uninformative) — unchanged",
          A((), ()) == R.Read(True, False, ""),
          "a quarter of the sonnets' mandated pairs have two empty codas. "
          "Conflating AGREEMENT with EVIDENCE deletes every one of them.")
    check("Differ((), ()) is False — two identical absences cannot differ",
          D((), ()).value is False,
          "doctrine 60 in general form, and the set rewrite must not lose it.")

    for phon, label in ((E_FIRST, "single reading"),
                        (E_UNC, "knowledge sets")):
        st = R.build_stream(["i want to see", "and i am free"], phon,
                            declaration={"language": "eng"})
        got = R.realise(R.REGISTRY["perfect rhyme"], st)
        verdicts = [i.verdict for i in got]
        check(f"see/free is a PERFECT RHYME under {label}",
              len(got) == 1 and verdicts == [True],
              f"{len(got)} finding(s), verdicts {verdicts}. The tripwire is "
              f"that this survives the change, and it is checked before "
              f"anything the change was FOR.")

    # ...and the same claim one layer down, at the representation.
    s = Syllable("see", ("S",), "IY", ())
    check("a plain str/tuple Syllable is CERTAIN and reports no uncertain "
          "channels", s.certain and s.uncertain_channels() == (),
          f"{s.uncertain_channels()!r}")


# ---------------------------------------------------------------------------
# 2. THE REPRESENTATION
# ---------------------------------------------------------------------------

def test_the_representation():
    print("\n2. a Syllable may hold ONE reading or a SET, and the TYPE is the "
          "marker")
    both = Readings({"IH", "AY"})
    check("a frozenset with >1 member is uncertain; a singleton is not",
          is_uncertain(both) and not is_uncertain(Readings({"IH"}))
          and not is_uncertain("IH"))
    check("a TUPLE is one value, not a set of readings",
          not is_uncertain(("N", "D")) and readings_of(("N", "D")) ==
          Readings({("N", "D")}),
          "a cluster is a single ordered value. This is `relations._alts`'s "
          "rule stated from the production side, and the two must not drift.")
    check("sole() returns the one reading and REFUSES to pick from two",
          sole("IH") == "IH" and sole(Readings({"IH"})) == "IH"
          and _raises(lambda: sole(both)),
          "picking is the defect; raising is the fix.")

    s = Syllable("wind", ("W",), both, ("N", "D"), 1, 1)
    check("a Syllable holding a set is not certain and NAMES the channel",
          not s.certain and s.uncertain_channels() == ("nucleus",),
          f"{s.uncertain_channels()!r}")
    check("readings() expands to every certain syllable it permits",
          [x.nucleus for x in s.readings()] == ["AY", "IH"]
          and all(x.certain for x in s.readings()),
          "the cartesian product over the uncertain channels.")
    check("certain_view() collapses to the FIRST reading and is a declared "
          "LOSS, not a fix",
          s.certain_view().nucleus == "AY" and s.certain_view().certain)

    # Doctrine 66: a tie broken by iterating a set is a result that does not
    # reproduce. `Readings.__iter__` is sorted by repr — arbitrary, FIXED and
    # stated, which is all doctrine 66 asks.
    orders = {tuple(Readings({("S",), ("Z",), ("T",)})) for _ in range(50)}
    check("Readings iterates in ONE order, always (doctrine 66)",
          len(orders) == 1, f"{len(orders)} distinct orders observed: {orders}")
    check("...and it is still a frozenset, so relations._alts sees no change",
          isinstance(both, frozenset)
          and R.uncertain(both) and not R.uncertain(Readings({"IH"})))


def _raises(fn):
    try:
        fn()
    except Exception:                                            # noqa: BLE001
        return True
    return False


# ---------------------------------------------------------------------------
# 3. NINE MODULES, UNMOVED
# ---------------------------------------------------------------------------

#: Real vocabulary, per language, from this repo's corpora where it has one.
#: `non` and `som` have no corpus file, so their words come from the module's
#: own regression suite — which is the point of doctrine 37 and not a shortcut.
PROBE = {
    "cym": ("Tydi a roddaist liw i'r wawr a hud i'r machlud mwyn", ),
    "eng": ("shall i compare thee to a summers day", ),
    "fas": ("الا یا ایها الساقی ادر کاسا و ناولها", ),
    "fin": ("Vaka vanha Väinämöinen tietäjä iän-ikuinen", ),
    "ltc": ("流樓行樂重長好過惡數中為華朝相", ),
    "msa": ("Pinang muda dibelah dua manik-manik didalam puan", ),
    "non": ("jǫrð hǫrð fyrðum konungr hildigelti sonr stafr sverð", ),
    "san": ("meghair meduram ambaram vanabhuvaḥ śyāmās tamāla drumaiḥ", ),
    "som": ("gabay higaad hees maanso dhagax shan khadar caano", ),
}


def _fingerprint(phon, words):
    out = []
    for w in words:
        try:
            sy = phon.syllabify(w)
        except Exception as e:                                   # noqa: BLE001
            out.append((w, "RAISED", type(e).__name__))
            continue
        out.append((w, tuple((s.text, tuple(s.onset), s.nucleus,
                              tuple(s.coda) if isinstance(s.coda, tuple)
                              else s.coda, s.prominence, s.moras)
                             for s in sy)))
    return tuple(out)


def test_nine_modules_are_unmoved():
    print("\n3. all NINE modules that construct a Syllable, unchanged — the "
          "default is a str and a str is CERTAIN")
    check("nine phonologies are declared", len(declared()) == 9,
          f"{declared()}")

    total_words = 0
    for lang in declared():
        phon = get(lang)
        words = [t for line in PROBE[lang]
                 for t in (list(line.replace(" ", "")) if lang == "ltc"
                           else line.split())]
        total_words += len(words)
        fp = _fingerprint(phon, words)
        certain = all(s.certain
                      for _, sy in ((w, phon.syllabify(w)) for w in words)
                      for s in sy)
        # `parses` is the hook and its DEFAULT must be the single reading, or
        # a module that overrides nothing would start behaving differently.
        same = all(phon.parses(w) == [phon.syllabify(w)] for w in words)
        cens = reading_census(phon, words)
        check(f"  {lang}: {len(words)} words, every syllable CERTAIN and "
              f"parses() defaults to the one reading",
              certain and same and fp and cens["undecided"] == 0,
              f"read {cens['read']} / refused {cens['refused']} / undecided "
              f"{cens['undecided']} — doctrine 79's three counts. A module "
              f"that declares no second reading cannot become undecided, "
              f"which is what BACKWARD-COMPATIBLE means here.")
    check(f"{total_words} real words across the nine, none of them uncertain",
          total_words >= 60, f"{total_words}")

    # The base class must not have grown a default that produces sets.
    class Bare(Phonology):
        language = "bare"

        def syllabify(self, word):
            return [Syllable(word, (), word[:1], ())]

    b = Bare()
    check("the base Phonology's parses() is [syllabify()], so an unaware "
          "module is untouched",
          b.parses("x") == [b.syllabify("x")]
          and b.reading_status("x")[0] == CERTAIN)


# ---------------------------------------------------------------------------
# 4. eng — THE LIVE FALSE POSITIVE, CLOSED
# ---------------------------------------------------------------------------

ENG_HOMOGRAPHS = ("wind", "live", "read", "bow", "tear")


def test_eng_homographs():
    print("\n4. eng — wind/live/read/bow/tear, and the shipped false positive")
    check("CMUdict holds two readings of each of the five",
          all(len(LEX.entries[w]) == 2 for w in ENG_HOMOGRAPHS),
          {w: LEX.entries[w] for w in ("wind", "read")})
    check("and it lists the VERB first, which is why `prons[0]` was wrong "
          "quietly rather than loudly",
          LEX.entries["wind"][0] == ["W", "AY1", "N", "D"],
          "W AY1 N D before W IH1 N D. A fixture taking the first reading "
          "gets the verb and says nothing about it.")

    for w in ENG_HOMOGRAPHS:
        sy, status, note = merge_readings(E_ALL.parses(w))
        check(f"  {w}: one syllable, nucleus UNDECIDED",
              status == MERGED and len(sy) == 1
              and is_uncertain(sy[0].nucleus),
              f"nucleus {sy[0].nucleus!r}; {note}")

    # THE case.
    for phon, label, want in ((E_FIRST, "single reading (as shipped)", True),
                              (E_UNC, "knowledge sets  (P11 closed)", None)):
        st = R.build_stream(["a mighty wind", "what i did find"], phon,
                            declaration={"language": "eng"})
        got = R.realise(R.REGISTRY["perfect rhyme"], st)
        verdicts = [i.verdict for i in got]
        check(f"wind/find under {label} -> {want!r}",
              verdicts == [want],
              f"got {verdicts}. " + (
                  "A verdict on a reading nobody declared."
                  if want is True else
                  "UNDECIDED, and the finding carries the reason: "
                  + next(r[2].note for r in got[0].reads
                         if r[0] == "nucleus")))

    check("the schema still FINDS the pair — the relation is undecided, not "
          "deleted (doctrine 24)",
          len(R.realise(R.REGISTRY["perfect rhyme"],
                        R.build_stream(["a mighty wind", "what i did find"],
                                       E_UNC,
                                       declaration={"language": "eng"}))) == 1,
          "a rule that answered None by dropping the instance would hide "
          "exactly the pairs P11 is about.")

    # And a homograph that is NOT ambiguous for rhyme still decides.
    st = R.build_stream(["a mighty wind", "it makes a sound"], E_UNC,
                        declaration={"language": "eng"})
    u = {x.token_text: x for x in st.units}
    A = R.Agree()
    v = A(R.DEFAULT_CHANNELS.read(u["wind"], "nucleus", st),
          R.DEFAULT_CHANNELS.read(u["sound"], "nucleus", st))
    check("...and set algebra still DECIDES where no reading can agree",
          v.value is False,
          f"{v.value!r}: AW is in neither reading of `wind`, so False is "
          f"certain. UNDECIDED is reserved for genuine ambiguity.")


# ---------------------------------------------------------------------------
# 5. ltc — A DIFFERENT CHANNEL, AND A REFUSAL THE MODULE ALREADY MADE
#    SOMEWHERE ELSE
# ---------------------------------------------------------------------------

def test_ltc_polyphones():
    print("\n5. ltc — 多音字. eng's ambiguity is a VOWEL; this one reaches "
          "the TONE CLASS, which is what regulated verse constrains")
    for ch in "行重長過中":
        sy, status, note = merge_readings(L_ALL.parses(ch))
        s = sy[0]
        check(f"  {ch}: {len(L_FIRST.readings(ch))} readings -> "
              f"prominence(平/仄) UNDECIDED",
              status == MERGED and is_uncertain(s.prominence),
              f"prominence {s.prominence!r}, nucleus {s.nucleus!r}")

    check("好 has two readings that AGREE on every channel, so it stays "
          "CERTAIN",
          merge_readings(L_ALL.parses("好"))[1] == CERTAIN,
          "doctrine 36: the granularity a reference work records is not the "
          "granularity a form works at. A 多音字 is not automatically "
          "ambiguous FOR THE PREDICATE.")

    # The finding this test exists for.
    amb = [c for c in set("行重長過中華相間經供臨王歐")
           if L_FIRST.tone_class(c) is None
           and L_FIRST.readings(c) is not None]
    old = {c: L_FIRST.syllabify(c)[0].prominence for c in amb}
    new = {c: merge_readings(L_ALL.parses(c))[0][0].prominence for c in amb}
    check("`tone_class()` ALREADY refused on these and `syllabify()` did not "
          "— the refusal existed and did not propagate",
          all(L_FIRST.tone_class(c) is None for c in amb)
          and all(not is_uncertain(v) for v in old.values())
          and all(is_uncertain(v) for v in new.values()),
          f"{len(amb)} characters. tone_class returns None for every one; "
          f"syllabify handed out readings[0]'s 平/仄 for every one "
          f"({sorted(old.items())[:4]}...). Doctrine 84's rule that a producer "
          f"must not silently swallow a refusal, inside a SINGLE module.")


# ---------------------------------------------------------------------------
# 6. DOCTRINE 79 — THE THREE COUNTS, ON REAL TEXT
# ---------------------------------------------------------------------------

def _sonnet_endwords():
    import re
    txt = open(os.path.join(HERE, "..", "corpus", "sonnets.txt"),
               encoding="utf-8").read()
    out = []
    for ln in txt.split("\n"):
        ws = re.findall(r"[A-Za-z'’\-]+", ln)
        if ws:
            out.append(ws[-1].lower())
    return sorted(set(out))


def _han(path, cap=1200):
    txt = open(path, encoding="utf-8", errors="replace").read()
    seen, out = set(), []
    for ch in txt:
        if "一" <= ch <= "鿿" and ch not in seen:
            seen.add(ch)
            out.append(ch)
            if len(out) >= cap:
                break
    return out


def test_three_counts():
    print("\n6. DOCTRINE 79 — read / refused / undecided are THREE counts, "
          "and `refused` splits again (doctrine 88)")
    ends = _sonnet_endwords()
    first = reading_census(E_FIRST, ends)
    allr = reading_census(E_ALL, ends)
    check(f"the sonnets' {len(ends)} unique end words: the FIRST-reading "
          f"census has an undecided count of ZERO by construction",
          first["undecided"] == 0 and first["read"] + first["refused"]
          == first["total"],
          f"read {first['read']} / refused {first['refused']} / undecided 0. "
          f"That zero is not a fact about English; it is the instrument "
          f"having no way to say the word.")
    check("...and keeping every reading moves words out of `read` and into "
          "`undecided`, with `refused` UNCHANGED",
          allr["refused"] == first["refused"]
          and allr["undecided"] > 0
          and allr["read"] + allr["undecided"] == first["read"],
          f"read {allr['read']} / refused {allr['refused']} / undecided "
          f"{allr['undecided']} ({allr['merged']} merged, "
          f"{allr['unalignable']} unalignable). "
          f"{100.0 * allr['undecided'] / first['read']:.1f}% of the end words "
          f"the harness thought it had READ were being resolved silently. "
          f"`refused` does not move, which is the check that this is a new "
          f"COUNT and not a new failure.")

    chars = _han(os.path.join(HERE, "..", "corpus", "song",
                              "ltc_huajianji.txt"))
    lf, la = reading_census(L_FIRST, chars), reading_census(L_ALL, chars)
    check(f"the same three counts on {len(chars)} 花間集 characters",
          lf["undecided"] == 0 and la["undecided"] > 0
          and la["read"] + la["undecided"] == lf["read"],
          f"first reading: read {lf['read']} / undecided 0. all readings: "
          f"read {la['read']} / undecided {la['undecided']} "
          f"({100.0 * la['undecided'] / max(1, lf['read']):.1f}%). NOTE the "
          f"refused count is 0 in both, and that is NOT a claim that every "
          f"character reads: `ltc.syllabify` emits a placeholder syllable for "
          f"an unreadable character rather than returning [], so this layer's "
          f"refusal count is the wrong instrument there and "
          f"`ltc.readability()` is the right one.")


# ---------------------------------------------------------------------------
# 7. THE REFUSALS — three outcomes, not two
# ---------------------------------------------------------------------------

def test_merge_refusals():
    print("\n7. merge_readings has FOUR outcomes and a caller can tell them "
          "apart")
    one = [Syllable("cat", ("K",), "AE", ("T",))]
    check("one reading -> CERTAIN", merge_readings([one])[1] == CERTAIN)
    check("identical readings -> CERTAIN, not MERGED",
          merge_readings([one, list(one)])[1] == CERTAIN,
          "two witnesses that agree carry no uncertainty. Doctrine 51's "
          "shape: agreement is not evidence, and it is not doubt either.")
    check("no readable reading -> UNREADABLE and an EMPTY list",
          merge_readings([[], []])[:2] == ([], UNREADABLE))

    short = [Syllable("x", (), "A", ())]
    longr = [Syllable("x", (), "A", ()), Syllable("y", (), "B", ())]
    syls, status, note = merge_readings([short, longr])
    check("readings with different SYLLABLE COUNTS -> UNALIGNABLE and an "
          "EMPTY list",
          (syls, status) == ([], UNALIGNABLE),
          f"{note}. Inventing an alignment is the kukka/kalevala error "
          f"(doctrine 83) with extra steps; `fas.syllabify` already returns "
          f"[] for exactly this and is the precedent.")
    check("...and UNALIGNABLE is not UNREADABLE, which is doctrine 88's whole "
          "complaint",
          UNALIGNABLE != UNREADABLE
          and reading_census(E_ALL, ["chocolate"])["unalignable"] +
          reading_census(E_ALL, ["chocolate"])["merged"] ==
          reading_census(E_ALL, ["chocolate"])["undecided"],
          "a refusal rate is uninterpretable until its causes are separated.")

    # `moras` is merged rather than refused, and the price is stated.
    a = [Syllable("x", (), "A", (), None, 1)]
    b = [Syllable("x", (), "A", (), None, 2)]
    m, st, _ = merge_readings([a, b])
    check("a WEIGHT disagreement becomes a knowledge set, and arithmetic on "
          "it fails LOUDLY",
          st == MERGED and is_uncertain(m[0].moras)
          and _raises(lambda: sum(s.moras for s in m)),
          f"moras {m[0].moras!r}. `san.moras()` is `sum(s.moras for s in "
          f"sylls)`; a TypeError there is the correct outcome and a silently "
          f"wrong sum is not. Refusing the whole word instead would be "
          f"doctrine 24's error — deleting a category to protect a sum().")


# ---------------------------------------------------------------------------
# 8. THE SEAM — which consumers survive an uncertain Syllable, MEASURED
# ---------------------------------------------------------------------------

def test_the_seam():
    print("\n8. the SEAM into relations.py — measured, not assumed. Two of "
          "its readers coerce with tuple() and cannot carry a set")
    st = R.build_stream(["a mighty wind", "what i did find"], E_UNC,
                        declaration={"language": "eng"})
    u = {x.token_text: x for x in st.units}
    read = {c: R.DEFAULT_CHANNELS.read(u["wind"], c, st)
            for c in ("onset", "nucleus", "coda", "prominence", "moras",
                      "phones", "consonants")}
    check("nucleus and prominence pass through UNCOERCED, so a nucleus "
          "homograph reaches the predicates",
          is_uncertain(read["nucleus"]),
          f"nucleus {read['nucleus']!r} — `_rd_nucleus` returns "
          f"`u.syl.nucleus` raw, which is why this half works today.")

    # The two that do not. Demonstrated on a CODA homograph (close /S/ ~ /Z/).
    s = Syllable("close", ("K", "L"), "OW", Readings({("S",), ("Z",)}))
    coerced = tuple(s.coda)
    check("`_rd_coda` calls tuple() on the channel, so a CODA knowledge set "
          "arrives as one cluster of two readings",
          coerced == (("S",), ("Z",)) and not is_uncertain(coerced),
          f"{coerced!r} instead of two readings of a coda. This is a defect "
          f"in `quality/relations.py`, which this cell does not own; the "
          f"patch is `return u.syl.coda if isinstance(u.syl.coda, frozenset) "
          f"else tuple(u.syl.coda)` in `_rd_coda` and `_rd_onset`. Until then "
          f"the PRODUCTION side must not emit a coda set into that stream.")
    check("...and the order it arrives in is at least FIXED (doctrine 66)",
          len({tuple(Readings({("S",), ("Z",)})) for _ in range(50)}) == 1,
          "a bare frozenset would scramble under PYTHONHASHSEED and the "
          "wrongness would be invisible half the time. `Readings.__iter__` "
          "exists for this one reason.")
    check("`_rd_phones` splices the set INTO the phone sequence, so a "
          "sequence predicate reads False where it should read None",
          read["phones"] == ("W", read["nucleus"], "N", "D")
          and R.Agree()(read["phones"],
                        ("F", "AY", "N", "D")).value is False,
          f"{read['phones']!r}. A tuple containing a frozenset is ONE value to "
          f"`_set_agree`, so it compares unequal and returns a definite "
          f"False. Reported, not patched here.")


# ---------------------------------------------------------------------------
# 9. THE SONNET ORACLE DID NOT MOVE
# ---------------------------------------------------------------------------

def test_the_oracle_did_not_move():
    print("\n9. the sonnet oracle is unmoved: 1064 / 1014 / 50 / 81")
    # `battery.py` has NO ASSERT and exits 0 whatever it prints, so its exit
    # status is worthless and its NUMBERS are the instrument. It prints them
    # and returns only the violation list, so the counts are read off stdout
    # here rather than recomputed — recomputing would be a second
    # implementation agreeing with itself.
    import io
    import re
    import contextlib
    import battery
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        viol = battery.sonnet_battery()
    m = re.search(r"mandated pairs (\d+), judged (\d+), refused (\d+)",
                  buf.getvalue())
    got = (int(m.group(1)), int(m.group(2)), int(m.group(3)), len(viol)) \
        if m else None
    check("mandated 1064, judged 1014, refused 50, violations 81",
          got == (1064, 1014, 50, 81),
          f"{got}. Doctrine 79: three counts, and the fourth is the one people "
          f"quote. Identical before and after the Syllable change, because "
          f"the shipped `eng` still declares one reading — this file's "
          f"section 4 is what shows the capability is nonetheless reachable.")


if __name__ == "__main__":
    for fn in (test_doctrine_25_tripwire,
               test_the_representation,
               test_nine_modules_are_unmoved,
               test_eng_homographs,
               test_ltc_polyphones,
               test_three_counts,
               test_merge_refusals,
               test_the_seam,
               test_the_oracle_did_not_move):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all homograph / knowledge-set regressions pass")
