#!/usr/bin/env python3
"""Regressions for SECTION FUNCTION, the hook, repetition-with-variation, and
the A-1 refrain notation. `MISSING.md` A-1, A-2, D-1, D-2, D-3.

WHAT THIS FILE IS FOR

Three gaps, and they were one gap. `Section` had `name, bars, meter,
start_bar` and `name` was a free string, so nothing could ask whether a chorus
returns, whether a bridge contrasts, or where a hook lands. `compare_returns`
had no ancestor at all: a chorus that came back with one word changed was
neither the same line nor a different one, and there was no third answer.

THE STANDARD (doctrine 37). The load-bearing tests here are not fixtures. They
are `corpus/song/`: 259 files, 181,870 marked blocks, and the two parlour songs
the gap register named as evidence -- Hanby's 'Darling Nelly Gray' and
Russell's 'Cheer, Boys, Cheer'. A representation that cannot hold what is
already staged is not finished, so section 6 runs the whole corpus and section
7 checks the two named songs land on the kinds the register predicted.

Run: python3 quality/test_song_function.py
"""

import glob
import json
import os
import sys
import collections
from fractions import Fraction as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

from lyric_harness import is_apparatus_line as G_APPARATUS         # noqa: E402
from quality import grid as G                                      # noqa: E402
from quality import schemes as S                                   # noqa: E402

FAILURES = []
CORPUS = os.path.join(ROOT, "corpus", "song")


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _raises(fn, exc=Exception):
    try:
        fn()
    except exc:
        return True
    except Exception:
        return False
    return False


# ---------------------------------------------------------------------------
# the session's own song, with functions DECLARED (never parsed from names)
# ---------------------------------------------------------------------------

#: The blueprint's section NAMES, and the functions a human declares for them.
#: This mapping lives in the TEST, not in the library, and that is the point:
#: `grid.py` contains no table from name strings to functions, because such a
#: table is the error this cell exists to avoid.
DECLARED = {"verse1": "verse", "pre": "prechorus", "chorus": "chorus",
            "verse2": "verse", "bridge": "bridge", "chorus2": "chorus",
            "outro": "outro"}


def scene_song(declare=True):
    bp = json.load(open(os.path.join(ROOT, "quality", "fixtures",
                                     "song.blueprint.json")))
    secs = [G.Section(
        name=s["name"], bars=s["bars"], start_bar=s["start_bar"],
        meter=G.Meter(s["meter"]["beats"], s["meter"]["unit"],
                      tuple(s["meter"]["groups"])),
        function=DECLARED[s["name"]] if declare else G.UNDECLARED)
        for s in bp["sections"]]
    lines = [G.Line(text=l["text"], bar=l["bar"], beat=F(str(l["beat"])),
                    duration=F(str(l["duration"])), section=l["section"])
             for l in bp["lines"]]
    return G.Song(sections=secs, lines=lines, title="Fixture Song")


_KEY = [None]


def key():
    if _KEY[0] is None:
        _KEY[0] = G.rime_cmudict()
    return _KEY[0]


# ---------------------------------------------------------------------------


def test_function_is_declared_and_never_inferred():
    print("\n1. FUNCTION IS A DECLARED COORDINATE (D-1)")
    check("the vocabulary is declared in one place and is enumerable",
          len(G.SECTION_FUNCTIONS) >= 15
          and {"verse", "chorus", "prechorus", "bridge", "intro", "outro",
               "refrain", "hook", "tag"} <= set(G.SECTION_FUNCTIONS),
          f"{len(G.SECTION_FUNCTIONS)} functions: "
          f"{', '.join(sorted(G.SECTION_FUNCTIONS))}")
    # RESTATED 2026-08-18: the fixture was `middle8`, and the vocabulary
    # moved under it ON PURPOSE — `FunctionSpec.aliases` made the bridge
    # gloss's own middle-8 claim resolvable. The CLAIM this check makes
    # (unknown raises, no fallback to verse) is unchanged; the fixture is
    # now a name no tradition claims, and the old fixture is the positive
    # control pinning the alias.
    check("an unknown function RAISES rather than falling back to verse",
          _raises(lambda: G.Section("x", 4, function="vibes"),
                  G.UnknownFunction),
          "the move check_cynghanedd made for `language` (doctrine 45)")
    # RESTATED AGAIN 2026-08-28 (M-57): this check's fixture was
    # `Section("x", 4, function="middle8")` and its pass was the MEASURED
    # DEFECT — the door accepting a specialisation at bars=4 and storing
    # the genus, the differentia (bars == 8, the bridge gloss's own claim)
    # discarded. `middle8` is a Specialisation now, not an alias: at
    # bars=8 it resolves to the bridge spec AND keeps the declared name;
    # at bars=4 it REFUSES rather than silently widening. Both halves
    # pinned here so the door cannot drift back either way.
    s8 = G.Section("x", 8, function="middle8")
    check("...and `middle8` RESOLVES through the constructor to the bridge "
          "spec — a SPECIALISATION now, kept and checked (M-57)",
          s8.function == "bridge" and s8.specialised_as == "middle-eight")
    check("...and `middle8` at bars=4 REFUSES — the differentia is the "
          "claim, and this check's own pre-M-57 fixture was the defect",
          _raises(lambda: G.Section("x", 4, function="middle8"),
                  G.SpecialisationMismatch))
    check("THE ONE THAT MATTERS — a section NAMED 'chorus' is UNDECLARED",
          G.Section("chorus", 16).function == G.UNDECLARED
          and G.Section("chorus2", 16).function == G.UNDECLARED,
          "a name is not evidence. Inferring the function from the name is "
          "the same error as inferring a tradition from a schema's name, "
          "which this repo made and caught this week.")
    check("and UNDECLARED is not verse, and is distinguishable from it",
          G.UNDECLARED != "verse" and not G.Section("chorus", 16).declared)
    check("every function carries a declared recurrence and return kind",
          all(s.recurrence in ("once", "returns", "open")
              and s.returns_as in ("verbatim", "new words", "varied", "n/a")
              for s in G.SECTION_FUNCTIONS.values()))
    # RESTATED 2026-08-18, and the RULE this check states is UNCHANGED —
    # "claims live in the vocabulary with a gloss" — while its example
    # inverted: `middle-8 -> bridge` IS now such a claim, living on the
    # bridge row as `FunctionSpec.aliases` beside the gloss that had
    # argued it in prose since the row was written. What still refuses is
    # a synonym with NO row behind it.
    check("spelling variants normalise; row-declared aliases resolve; a "
          "claim with no row still refuses",
          G.as_function("PRE-CHORUS") == "prechorus"
          and G.as_function("middle-8") == "bridge"
          and _raises(lambda: G.as_function("the-good-bit"),
                      G.UnknownFunction),
          "`pre-chorus` is a spelling of `prechorus`; `middle-8 -> bridge` "
          "is a CLAIM and it lives in the vocabulary WITH a gloss, which "
          "is exactly where this check always said claims belong")


def test_the_questions_that_needed_a_function():
    print("\n2. THE QUESTIONS A WRITER ASKS, now askable")
    song = scene_song()
    prof = G.function_profile(song)
    check("the FORM is a run of functions, not of names",
          prof["form"] == ("verse", "prechorus", "chorus", "verse", "bridge",
                           "chorus", "outro"),
          str(prof["form"]) + "  — 'chorus' and 'chorus2' are ONE function "
          "with two instances, which no name string could say")
    check("'how many bars until the first chorus' (D-1's own example)",
          prof["bars_until_first_chorus"] == 5
          and prof["bars_until_first_prechorus"] == 4,
          f"{prof['bars_until_first_chorus']} bars, after a 4-bar verse and "
          f"a 1-bar pre-chorus")
    check("'does this song have a pre-chorus' (D-1's other example)",
          prof["has_prechorus"] is True and prof["has_hook"] is False)

    f, r, rets = G.return_findings(song, "chorus", rhyme_key=key())
    codes = {x.code for x in f}
    check("does the chorus hold ONE length and ONE meter across returns?",
          not (codes & {"RETURN_LENGTH_DRIFT", "RETURN_METER_DRIFT"}),
          "both instances are 16 bars of 4/4")
    check("does it land in the SAME METRIC POSITION each time?",
          "RETURN_SLOT_DRIFT" not in codes
          and rets[0][2].tune_slot_preserved is True,
          "identical (bar-offset, beat, duration) profile across both "
          "returns — the tune slot is preserved")
    check("and the drift checks are not vacuous — a moved return is caught",
          _slot_drift_fires(),
          "shifting one chorus line by half a beat fires RETURN_SLOT_DRIFT")

    f, r, ch = G.bridge_contrast(song, rhyme_key=key())
    check("does the bridge CONTRAST, or is it a verse wearing a label?",
          not [x for x in f if x.code == "BRIDGE_IS_A_VERSE"]
          and len(ch["_separating"]) >= 4,
          f"separates on {ch['_separating']} — 6/8 against 7/8, 8 bars "
          f"against 14, 4 lines against 8, 5.0 words a line against 7.4")
    check("and THAT check is not vacuous either",
          _bridge_is_a_verse_fires(),
          "a bridge built to the verse's own measurements fires "
          "BRIDGE_IS_A_VERSE")


def _slot_drift_fires():
    song = scene_song()
    ch2 = song.instances_of("chorus")[1]
    for l in song.lines_in(ch2)[:1]:
        l.beat = l.beat + F(1, 2)
    f, _, _ = G.return_findings(song, "chorus")
    return "RETURN_SLOT_DRIFT" in {x.code for x in f}


def _bridge_is_a_verse_fires():
    s = G.Song(sections=[
        G.Section("v1", 8, G.Meter(4, 4), function="verse"),
        G.Section("br", 8, G.Meter(4, 4), function="bridge"),
        G.Section("v2", 8, G.Meter(4, 4), function="verse")]).layout()
    s.lines = [G.Line(f"a line of six words here {i}", bar=b + 2 * k,
                      duration=F(4))
               for b in (1, 9, 17) for k, i in enumerate(range(4))]
    f, _, _ = G.bridge_contrast(s)
    return "BRIDGE_IS_A_VERSE" in {x.code for x in f}


HOOK = "we counted every reason we were given to keep counting"


def test_the_hook():
    print("\n3. THE HOOK — a FRAGMENT, not a section (D-2)")
    song = scene_song()
    occ = G.hook_occurrences(song, HOOK)
    check("a hook is found sub-line and located in BARS — TWO of them",
          len(occ) == 2
          and [o.bar for o in occ] == [6, 14]
          and [o.next_downbeat for o in occ] == [6, 14]
          and not any(o.has_pickup for o in occ),
          f"{[(o.bar, o.next_downbeat, o.function) for o in occ]}. Every "
          f"line in this fixture begins on the downbeat, so `bar` and "
          f"`next_downbeat` agree and neither line takes a pickup — the "
          f"pickup case (where the two coordinates disagree) is a real "
          f"possibility this field exists to name, just not one this "
          f"fixture happens to exercise")
    check("and it knows which FUNCTION it landed in",
          {o.function for o in occ} == {"chorus"},
          "which is only sayable because the section declares one")
    f, r = G.hook_findings(song, hooks=[HOOK])
    codes = {x.code for x in f}
    check("'is the title in the hook?' is ANSWERED",
          "TITLE_NOT_IN_HOOK" in codes,
          [x.evidence for x in f if x.code == "TITLE_NOT_IN_HOOK"][0])
    f2, _ = G.hook_findings(song, hooks=["a counted step a counted breath"])
    check("a fragment that occurs once is named a line, not a hook",
          "HOOK_DOES_NOT_RECUR" in {x.code for x in f2})
    # PROMOTED TO A FLAG 2026-08-23 (`MISSING.md` M-84, owner's ruling). The
    # code has fired since it was written; what it could not do was STOP
    # anything. Asserting the severity here — at the emission site, from the
    # finding the layer actually builds — is what makes the promotion a GATE
    # rather than a table entry: `verify()` rejects on `new_flags` and
    # `song`/`revise` exit 3 while one stands.
    #
    # IT IS NOT DOCTRINE 6's CASE, which is why this one and not its
    # neighbours. Every other shape code measures a draft against
    # `POPULAR_SONG`, a convention a writer may depart from. This asks whether
    # a hook the WRITER DECLARED occurs more than once, and the answer is a
    # fact with no convention in it — the same footing `HOOK_ABSENT` stands on.
    hdnr = [x for x in f2 if x.code == "HOOK_DOES_NOT_RECUR"]
    check("...and it is a FLAG, so it can refuse rather than only report — "
          "the severity read off the FINDING the layer built, not off the "
          "table it was read from (doctrine 1: one definition, checked where "
          "it is used)",
          hdnr and hdnr[0].severity == "flag" and G.SEVERITY[
              "HOOK_DOES_NOT_RECUR"] == "flag",
          f"{hdnr[0].severity if hdnr else 'NOT EMITTED'}")
    check("...while the CONVENTION codes beside it stay notes, so the "
          "promotion moved one code and did not open the family (doctrine 6)",
          all(G.SEVERITY[c] == "note" for c in
              ("DOWNBEAT_LOCKED", "QUATRAIN_LOCK", "METER_LOCKED",
               "SECTION_LENGTH_LOCKED", "RETURN_LOCKED")),
          "the locks are measurements against POPULAR_SONG at an "
          "uncalibrated threshold and a writer may depart from them")
    f3, _ = G.hook_findings(song, hooks=["there is no such phrase"])
    check("a hook that is not in the lyric is named",
          "HOOK_ABSENT" in {x.code for x in f3})
    _, r4 = G.hook_findings(song, hooks=())
    check("NO declared hook is a REFUSAL, never 'no hook problems'",
          {x.code for x in r4} == {"HOOK_UNDECLARED"},
          "doctrine 20 — a pass earned by asking nothing")
    check("the harness refuses to decide what your hook is",
          _raises(lambda: G.Hook("   ")))


#: A constructed (doctrine 94) chorus return, built to hold a specific
#: shape: lines 1, 5, 6, 7 invariant; 2, 3, 4, 8 rewritten with the rhyme
#: partition preserved (drive/alive, goes/froze, knows/shows, place/place).
CHORUS_A = [
    "we are the wire that answers to the drive",
    "we count the miles until we come alive",
    "we hold the number steady till it goes",
    "we let it climb as high as anyone knows",
    "we are the static waiting for the sign",
    "we are the current running down the line",
    "we are the promise nothing can erase",
    "we are the ledger, counted, in its place",
]
CHORUS_B = [
    "we are the wire that answers to the drive",
    "we counted every mile before we came alive",
    "we watched the number settle as it froze",
    "we let it fall as low as anyone shows",
    "we are the static waiting for the sign",
    "we are the current running down the line",
    "we are the promise nothing can erase",
    "a second ledger, counted, finds its place",
]


def chorus_return_song():
    return G.Song(sections=[
        G.Section("c1", 8, G.Meter(4, 4), function="chorus"),
        G.Section("c2", 8, G.Meter(4, 4), start_bar=9, function="chorus")],
        lines=[*[G.Line(t, bar=1 + i, duration=F(4), section="c1")
                for i, t in enumerate(CHORUS_A)],
               *[G.Line(t, bar=9 + i, duration=F(4), section="c2")
                for i, t in enumerate(CHORUS_B)]])


def test_repetition_with_variation():
    print("\n4. REPETITION WITH VARIATION IS A MEASUREMENT (A-2)")
    song = chorus_return_song()
    _, _, rets = G.return_findings(song, "chorus", rhyme_key=key())
    r = rets[0][2]
    check("there is no boolean: the return resolves to a NAMED kind",
          r.kind == "RHYME_PRESERVING_REWRITE"
          and "same" not in r.kind.lower(),
          f"{r.kind} — {r.gloss}")
    check("it reports WHICH lines are invariant and which move",
          r.invariant_lines == (1, 5, 6, 7)
          and [v[0] for v in r.varied_lines] == [2, 3, 4, 8],
          f"invariant {list(r.invariant_lines)}, moved "
          f"{[v[0] for v in r.varied_lines]}")
    check("each varied line's own edit distance is reported, not just a set",
          [v for v in r.varied_lines if v[0] == 2][0][4] == 5
          and [v for v in r.varied_lines if v[0] == 3][0][4] == 4,
          "'we count the miles until we come alive' -> 'we counted every "
          "mile before we came alive' is 5 token edits; 'we hold the "
          "number steady till it goes' -> 'we watched the number settle "
          "as it froze' is 4")
    check("edit distance, at both scales",
          r.line_distance == 4 and r.token_distance == 16)
    check("preserved-rhyme-scheme flag, with the phonology NAMED",
          r.rhyme_scheme_preserved is True
          and "CMUdict" in r.declaration.rhyme_key,
          f"drive/alive and goes/froze hold the partition; key = "
          f"{r.declaration.rhyme_key[:60]}...")
    check("preserved-tune-slot flag", r.tune_slot_preserved is True)
    check("with NO key declared the rhyme flag is CANNOT TELL, not False",
          G.compare_returns(["a cat", "a dog"], ["a cat", "a log"]
                            ).rhyme_scheme_preserved is None,
          "doctrine 28 and doctrine 45: a silent default here would be a "
          "claim about a phonology nobody named")
    check("every declared kind has a gloss, and the residual is NAMED",
          all(k in dict(G.VARIATION_KINDS) for k, _ in G.VARIATION_KINDS)
          and "REWRITTEN_RETURN" in dict(G.VARIATION_KINDS)
          and "DIFFERENT" not in dict(G.VARIATION_KINDS),
          f"{len(G.VARIATION_KINDS)} kinds; doctrine 24 — a rule that would "
          f"delete a category must RELABEL")
    check("a stub return REFUSES a distance rather than reporting a big one",
          _stub_refuses(),
          "'Oh, my poor Nelly Gray, &c.' points at a block it does not "
          "print; an edit distance there measures the printer")


def _stub_refuses():
    r = G.compare_returns(
        ["Oh, my poor Nelly Gray, they have taken you away,",
         "And I'll never see my darling any more,"],
        ["Oh, my poor Nelly Gray, &c."])
    return (r.kind == "STUB" and r.line_distance is None
            and r.refusals and r.refusals[0].code == "STUB_RETURN")


def test_the_a1_notation():
    print("\n5. THE A-1 NOTATION — and the villanelle is now writable")
    v = S.refrain_form("villanelle")
    check("THE VILLANELLE CAN BE WRITTEN DOWN IN THIS REPO",
          v.render().replace(" ", "") == "A1bA2abA1abA2abA1abA2abA1A2",
          v.render())
    check("and it is 19 lines with the refrains in the right places",
          v.n_lines == 19 and v.refrains["A1"] == (1, 6, 12, 18)
          and v.refrains["A2"] == (3, 9, 15, 19))
    check("it round-trips",
          S.parse_refrain(v.render()) == v)
    check("capital means VERBATIM and lowercase means rhyme only",
          len(v.repeat_pairs()) == 12
          and all(lab in ("A1", "A2") for _, _, lab in v.repeat_pairs()),
          "12 REPEAT pairs the partition cannot carry: 6 from each refrain")
    check("the rhyme partition still comes out of parse(), unchanged",
          S.parse(S.REFRAIN_FORMS["villanelle"]) == v.code
          and S.label(v.code) == "ABAABAABAABAABAABAA")
    check("EVERY refrain form in the registry round-trips",
          all(S.parse_refrain(S.refrain_form(k).render())
              == S.refrain_form(k) for k in S.REFRAIN_FORMS),
          f"{len(S.REFRAIN_FORMS)} forms: {', '.join(S.REFRAIN_FORMS)}")
    check("superscripts and the ASCII/caret spellings are one notation",
          S.parse_refrain("A¹bA²").marks == S.parse_refrain("A1bA2").marks
          == S.parse_refrain("A^1bA^2").marks)

    print("\n   5b. THE DEFECT THE NOTATION FOUND ON ITS FIRST DAY")
    check("the registry's villanelle was 22 lines and a villanelle is 19",
          len(S.NAMED[S.parse(S.REFRAIN_FORMS["villanelle"])]
              ["pattern"]) == 19
          and S.identify(S.parse("ABAABAABAABAABAABAABAA")) is None,
          "the old entry 'ABAABAABAABAABAABAABAA' had one tercet too many. "
          "Nothing could catch it: a rhyme-only string has no structure that "
          "pins its length, and `A1bA2 abA1 ...` is over-determined by its "
          "refrain positions")
    check("the triolet was 10 lines and a triolet is 8",
          len(S.NAMED[S.parse(S.REFRAIN_FORMS["triolet"])]["pattern"]) == 8
          and S.identify(S.parse("ABAAABABAB")) is None)

    print("\n   5c. AND IT IS ENFORCEABLE, not merely readable")
    good = ["Do not go gentle into that good night", "b", "Rage, rage",
            "d", "e", "Do not go gentle into that good night",
            "g", "h", "Rage, rage", "j", "k",
            "Do not go gentle into that good night", "m", "n", "Rage, rage",
            "p", "q", "Do not go gentle into that good night", "Rage, rage"]
    check("a villanelle whose refrains hold reports nothing",
          v.check_identity(good) == [])
    drift = list(good)
    drift[11] = "Do not go gently into that good night"
    bad = v.check_identity(drift)
    check("a refrain that drifted by ONE WORD is caught, and the drift is "
          "given a named KIND",
          len(bad) == 3 and {b[3] for b in bad} == {"LEXICAL_VARIATION"},
          f"{bad[0][0]} L{bad[0][1]}/L{bad[0][2]}: {bad[0][3]} — 'gentle' -> "
          f"'gently'. The rhyme partition passes, the band passes, and the "
          f"line that had to come back did not.")


# ---------------------------------------------------------------------------
# THE CORPUS. Doctrine 37: validate against the tradition, not against your
# own fixtures. Three counts wherever a refusal is possible (doctrine 79).
# ---------------------------------------------------------------------------

_SCAN = [None]


def corpus_scan():
    if _SCAN[0] is not None:
        return _SCAN[0]
    out = {
        "files": 0, "songs": 0, "blocks": 0, "mapped": 0, "refused": 0,
        "refusal_codes": collections.Counter(),
        "refused_marks": collections.Counter(),
        "functions": collections.Counter(),
        "songs_with_returns": 0,
        "pairs": 0, "measured": 0, "pair_refused": 0,
        "kinds": collections.Counter(),
        "kind_by_language": collections.Counter(),
        "variant_pairs": 0,
        "languages": collections.Counter(),
        "eng_repeat": collections.Counter(),
        "blocks_by_language": collections.Counter(),
        # THE APPARATUS RULE'S OWN QUANTITIES (section 9). Carried on the pass
        # section 6 was already making, for the reason the readability sweep
        # gives: a second sweep derives the population from a second
        # definition, and that is how a record and a behaviour drift apart.
        "block_lines": 0,
        "apparatus_survivors": [],
        "empty_blocks": 0,
        "empty_by_language": collections.Counter(),
        "empty_repeat_blocks": 0,
        "empty_marks": collections.Counter(),
        # THE CROSS-FUNCTION QUANTITIES (section 10). Same pass again, same
        # reason: a second sweep would derive the population from a second
        # definition of "the first block of a function", and that is how a
        # record and a behaviour drift apart.
        "cross_pairs": 0,
        "cross_shared": 0,
        "cross_by_pair": collections.Counter(),
        "cross_shared_by_pair": collections.Counter(),
        "cross_kinds": collections.Counter(),
        "cross_examples": [],
    }
    for path in sorted(glob.glob(os.path.join(CORPUS, "*.txt"))):
        out["files"] += 1
        lang = os.path.basename(path)[:3]
        for song in G.read_marked_songs(path, language=lang):
            out["songs"] += 1
            for b in song.blocks:
                out["blocks"] += 1
                out["blocks_by_language"][lang] += 1
                out["block_lines"] += len(b.lines)
                out["apparatus_survivors"].extend(
                    (os.path.basename(path), b.source_line, l)
                    for l in b.lines if G_APPARATUS(l))
                if not b.lines:
                    out["empty_blocks"] += 1
                    out["empty_by_language"][lang] += 1
                    out["empty_marks"][(os.path.basename(path),
                                        b.source_line, b.mark)] += 1
                    if b.function in ("chorus", "burden", "refrain"):
                        out["empty_repeat_blocks"] += 1
                if b.function:
                    out["mapped"] += 1
                    out["functions"][b.function] += 1
                    if lang == "eng" and b.function != "verse":
                        out["eng_repeat"][b.function] += 1
                else:
                    out["refused"] += 1
                    out["refusal_codes"][b.refusal.code] += 1
                    out["refused_marks"][b.base] += 1
            has = False
            for fn in ("chorus", "burden", "refrain"):
                inst = song.instances(fn)
                for idx, bl in sorted(inst.items()):
                    if len(bl) < 2:
                        continue
                    has = True
                    for k in range(1, len(bl)):
                        r = G.compare_returns(bl[0].lines, bl[k].lines)
                        out["pairs"] += 1
                        out["kinds"][r.kind] += 1
                        out["kind_by_language"][(lang, r.kind)] += 1
                        out["languages"][lang] += 1
                        if r.kind == "STUB":
                            out["pair_refused"] += 1
                        else:
                            out["measured"] += 1
                idxs = sorted(inst)
                for x, y in zip(idxs, idxs[1:]):
                    out["variant_pairs"] += 1
            if has:
                out["songs_with_returns"] += 1
            # THE OTHER PAIRING, AND THE ONE NOTHING ASKED (section 10). The
            # loop above compares a function with ITSELF; this compares two
            # DIFFERENT functions in one song, which is what a reprise is.
            # The four functions here are `MARK_FUNCTION`'s whole range —
            # the corpus's printed marks carry no INTRO, OUTRO or REPRISE, so
            # what this measures is the FALSE-POSITIVE side of the rule and
            # not its positive side. That limit is the finding's coordinate,
            # not a caveat on it.
            firsts = {}
            for fn in ("verse", "chorus", "burden", "refrain"):
                inst = song.instances(fn)
                if not inst:
                    continue
                bl = [b for b in inst[sorted(inst)[0]] if b.lines]
                if bl:
                    firsts[fn] = bl[0]
            keys = sorted(firsts)
            for x in range(len(keys)):
                for y in range(x + 1, len(keys)):
                    a, b = keys[x], keys[y]
                    r = G.compare_returns(firsts[a].lines, firsts[b].lines)
                    out["cross_pairs"] += 1
                    out["cross_by_pair"][(a, b)] += 1
                    out["cross_kinds"][r.kind] += 1
                    if r.invariant_lines:
                        out["cross_shared"] += 1
                        out["cross_shared_by_pair"][(a, b)] += 1
                        out["cross_examples"].append(
                            (os.path.basename(path), song.title, a, b, r.kind,
                             firsts[a].lines[r.invariant_lines[0] - 1]))
    _SCAN[0] = out
    return out


def test_the_corpus_holds():
    c = corpus_scan()
    print(f"\n6. THE CORPUS (doctrine 37) — {c['files']} files, and what the "
          f"representation can and cannot express")
    print(f"\n   BLOCKS: {c['blocks']:,} marked blocks in {c['files']} files, "
          f"{c['songs']:,} songs")
    print(f"     mapped to a declared function : {c['mapped']:,}")
    print(f"     REFUSED                       : {c['refused']:,}")
    for code, n in c["refusal_codes"].most_common():
        print(f"       {code:24} {n:>7,}")
    print(f"     top refused marks: "
          f"{dict(c['refused_marks'].most_common(6))}")
    print(f"     functions: {dict(c['functions'])}")
    check("the three counts are separate and they add up (doctrine 79)",
          c["mapped"] + c["refused"] == c["blocks"] and c["refused"] > 0,
          f"{c['mapped']:,} + {c['refused']:,} = {c['blocks']:,}. A refusal "
          f"is not a failure; "
          f"{c['refused_marks']['BAYT'] + c['refused_marks']['RADIF']:,} of "
          f"these blocks are BAYT and RADIF, and mapping a ghazal's couplet "
          f"to `verse` would be this vocabulary claiming a form it does not "
          f"describe")
    check("every refusal carries a REASON, not just a code",
          all(G.ingest_mark(m)[3].evidence
              for m in list(c["refused_marks"])[:40] if m))
    rep_total = sum(c["functions"][k] for k in ("chorus", "burden", "refrain"))
    eng_total = sum(c["eng_repeat"].values())
    print(f"\n   REPEAT BLOCKS, with the counting rule NAMED (doctrine 58): a "
          f"block is one\n   `[MARK]` line and everything under it up to the "
          f"next mark; the mark's own\n   tail is apparatus, not a line; "
          f"marks are read from `corpus/song/*.txt`.")
    print(f"     whole corpus : {rep_total:,}  "
          f"{ {k: c['functions'][k] for k in ('burden', 'refrain', 'chorus')} }")
    print(f"     eng_* only   : {eng_total:,}  {dict(c['eng_repeat'])}")
    print(f"     blocks by language: {dict(c['blocks_by_language'])}")
    # A LOWER bound was the wrong shape and 2026-08-11 proved it. These were
    # written as `>=` so a growing corpus would not break them -- and then the
    # corpus SHRANK, because the attribution cell found nine poems staged
    # under two authors at once and eleven `[BURDEN]` marks left with them.
    # `>=` cannot tell "the corpus grew" from "the corpus was deduplicated",
    # and those want opposite responses: the first is fine, the second is a
    # number that has been wrong in every rate quoted over this corpus. So
    # these are equalities now, and moving one is meant to cost a reading.
    # REPINNED 2026-08-20 (Tier-1 sitting), TWO movements in one repin and
    # they are different kinds. (1) INHERITED: the 2026-08-20 mass-load
    # sitting pinned 2,732/247/713 from its gate run, then RESTAGED the
    # whole load with the rev-2 parser and did not re-run this suite — at
    # the restaged HEAD the corpus measured 2,723/242/709, so these pins
    # were red on arrival (verified per-file: the Tier-1 diff moves NO
    # existing file's mark counts). (2) REAL GROWTH: the Tier-1 war-song
    # books state choruses as 'CHORUS--text' stanza heads; 48 became real
    # [CHORUS] blocks (and their trailing bare 'CHORUS.' repeat POINTERS
    # were stripped as apparatus — an instruction, not a block, the same
    # reading the return machinery gives '&c.'). 2,723 -> 2,771, chorus
    # 242 -> 290; burden and refrain untouched by Tier-1.
    # REPINNED AGAIN 2026-08-11, cell AC. 2,747 -> 2,732 whole corpus,
    # 2,443 -> 2,428 eng_*; BURDEN 1,784 -> 1,772, REFRAIN 716 -> 713.
    # The 15 that went are marks inside 63 near-duplicate items -- the same
    # poem in two printings, which the item-body hash could not see because an
    # editor's comma moved. THE COUNT WAS THEREFORE WRONG IN THE SAME
    # DIRECTION TWICE, from two different duplication mechanisms, and an
    # equality is what makes the second one cost a reading. It is also why
    # this is not a `>=`: a lower bound would have absorbed both silently.
    check("the repeat-block families are all expressible, none collapsed",
          rep_total == 2771 and c["functions"]["chorus"] == 290
          and c["functions"]["burden"] == 1772
          and c["functions"]["refrain"] == 709,
          f"{rep_total:,} repeat blocks held, and BURDEN is kept SEPARATE "
          f"from REFRAIN because the corpus marks them differently "
          f"(doctrine 24). BURDEN was 1,795 until 2026-08-11, then 1,784: the "
          f"first 11 that went were marks inside the duplicated Lyrical "
          f"Ballads poems and the next 12 inside near-duplicate items, so "
          f"they were being counted twice and no rate over them was right.")
    check("the register's `2,454 marked repeat blocks` reproduces, and the "
          "unwritten coordinate was LANGUAGE SCOPE",
          eng_total == 2467 and c["eng_repeat"]["chorus"] == 290,
          f"eng_* only gives {eng_total:,} "
          f"({dict(c['eng_repeat'])}); the recorded 1,603/604/247 is the "
          f"state at commit ef0baa4 restricted to `eng_*`, and the whole "
          f"corpus now stands at {rep_total:,} across "
          f"{len(c['blocks_by_language'])} language prefixes. Doctrine 58 "
          f"with SCOPE as the coordinate nobody wrote down -- and now with a "
          f"SECOND one: the same scope over a deduplicated corpus gives "
          f"1,580/601/247, so the register's figure needs both a scope and a "
          f"corpus state to be re-derivable.")

    print(f"\n   RETURNS: {c['pairs']:,} return pairs over "
          f"{c['songs_with_returns']:,} songs")
    print(f"     measured : {c['measured']:,}")
    print(f"     REFUSED  : {c['pair_refused']:,} (abbreviated '&c.' returns "
          f"— a pointer, not a text)")
    for k, n in c["kinds"].most_common():
        print(f"       {k:26} {n:>6,}")
    print("\n   by language:")
    for (lang, k), n in sorted(c["kind_by_language"].items()):
        print(f"       {lang}  {k:26} {n:>6,}")
    check("every return pair resolved to a named kind — none fell through",
          sum(c["kinds"].values()) == c["pairs"]
          and set(c["kinds"]) <= set(dict(G.VARIATION_KINDS)),
          f"{len(c['kinds'])} distinct kinds used of "
          f"{len(G.VARIATION_KINDS)} declared")
    check("and the answer is NOT 'they are all verbatim'",
          c["kinds"]["VERBATIM"] < c["pairs"] * 0.75
          and sum(n for k, n in c["kinds"].items()
                  if k not in ("VERBATIM", "STUB")) >= 150,
          f"{c['kinds']['VERBATIM']:,} verbatim, {c['pair_refused']:,} "
          f"refused as stubs, and "
          f"{sum(n for k, n in c['kinds'].items() if k not in ('VERBATIM', 'STUB')):,} "
          f"returns that VARY — every one of which was unrepresentable")
    check("the corpus forced three kinds that no fixture would have",
          all(c["kinds"].get(k, 0) > 0 for k in
              ("ANAPHORIC_RETURN", "HEAD_PRESERVED", "TAIL_PRESERVED")),
          "ANAPHORIC_RETURN (Bilhana's 46 `adyapi` refrains, a one-token "
          "line-initial anaphora the English threshold of 2 deleted), "
          "HEAD_PRESERVED and TAIL_PRESERVED (the Gitagovinda dhruva-tail "
          "and the radif shape INSIDE a line)")
    check("the scheme reaches four languages, and says which",
          len({l for l, _ in c["kind_by_language"]}) == 4,
          f"{sorted({l for l, _ in c['kind_by_language']})} — and the rhyme "
          f"flag is refused on all but English, because the only phonology "
          f"wired here is CMUdict (doctrine 45)")


def test_the_two_songs_the_gap_register_named():
    print("\n7. THE EVIDENCE A-2 CITED, measured")
    hanby = _find("eng_parlour_benjamin_hanby.txt", "chorus")
    russell = _find("eng_parlour_henry_russell.txt", "chorus")
    check("Hanby's 'Darling Nelly Gray' — the rhyme scheme and the tune slot "
          "hold and the words are rewritten",
          hanby.kind == "RHYME_PRESERVING_REWRITE"
          and hanby.rhyme_scheme_preserved is True
          and hanby.invariant_lines == (),
          f"{hanby.kind}: all 4 lines move (26 word edits) and the partition "
          f"survives — 'they have taken you away / I'll never see my darling "
          f"any more' returns as 'up in heaven there they say / they'll never "
          f"take you from me any more'")
    check("Russell's 'Cheer, Boys, Cheer' — first and last held, interior "
          "rewritten",
          russell.kind == "FRAME_PRESERVED"
          and russell.invariant_lines == (1, 3, 4)
          and [v[0] for v in russell.varied_lines] == [2],
          f"{russell.kind}: lines 1, 3, 4 invariant, line 2 moves by 5 words")
    check("and the two are DIFFERENT kinds — which is the whole point",
          hanby.kind != russell.kind,
          "'not identical' resolved to two named kinds rather than to "
          "'different' (doctrine 24)")

    print("\n   7b. the corpus states a rule; the instrument is tested "
          "against it (doctrine 37, doctrine 62)")
    git = _find("san_jayadeva_gitagovinda.txt", "burden", base="BURDEN-TAIL")
    check("the Gitagovinda header declares a dhruva 'whose final run is "
          "invariant and whose head varies' — and the measurement agrees",
          git.invariant_runs[1] >= 3 and git.invariant_runs[0] == 1,
          f"tail run {git.invariant_runs[1]} tokens ('jaya jagadisa hare'), "
          f"head run {git.invariant_runs[0]} ('kesava'), middle varies. The "
          f"source called the shape a radif and the measurement finds one.")


def _find(fname, function, base=None):
    """First measurable return pair of `function` in a corpus file."""
    for song in G.read_marked_songs(os.path.join(CORPUS, fname)):
        inst = song.instances(function)
        idxs = sorted(inst)
        if base:
            bl = [b for i in idxs for b in inst[i] if b.base == base]
            if len(bl) >= 2:
                return G.compare_returns(bl[0].lines, bl[1].lines,
                                         rhyme_key=key())
            continue
        if len(idxs) >= 2:
            return G.compare_returns(inst[idxs[0]][0].lines,
                                     inst[idxs[1]][0].lines, rhyme_key=key())
    raise AssertionError(f"no return pair for {function} in {fname}")


def test_the_report_prints_three_counts():
    print("\n8. THE REPORT — asked, answered, refused, always")
    song = scene_song()
    rep = G.song_function_report(song, hooks=[HOOK],
                                 rhyme_key=key())
    check("three counts, and they are not interchangeable",
          rep["asked"] == rep["answered"] + rep["refused"]
          and rep["refused"] >= 1,
          f"asked {rep['asked']}, answered {rep['answered']}, refused "
          f"{rep['refused']} — the pre-chorus occurs once, so 'does it land "
          f"in the same place each time' is CANNOT TELL, not clean")
    check("the convention in force is named in the result",
          "popular song" in rep["convention"],
          rep["convention"])

    print("\n   8b. WITHOUT declarations, the checks REFUSE — they do not "
          "read the names")
    blind = scene_song(declare=False)
    rep2 = G.song_function_report(blind, hooks=[HOOK])
    check("an undeclared song answers nothing and refuses everything",
          rep2["answered"] == 0 and rep2["refused"] == rep2["asked"] == 3
          and {x.code for x in rep2["findings"]} <= {"TITLE_NOT_IN_HOOK"},
          f"asked {rep2['asked']}, answered {rep2['answered']}, refused "
          f"{rep2['refused']}. The sections are still NAMED 'chorus', "
          f"'chorus2', 'bridge' and the harness says nothing about them — "
          f"which is the difference between this and a name parser. The one "
          f"finding that survives is TITLE_NOT_IN_HOOK, which needs a title "
          f"and a hook and no function at all.")
    check("and the refusal says what is missing",
          any("UNDECLARED" in x.code for x in rep2["refusals"]),
          [x.message for x in rep2["refusals"]][0])


# ---------------------------------------------------------------------------
# THE APPARATUS RULE, PRICED ON THE WHOLE CORPUS
# ---------------------------------------------------------------------------

#: The 14 blocks the centralized apparatus rule EMPTIES, named with the one
#: line that used to be their entire "lyric". This is the whole price of the
#: change, enumerated rather than summarized, and every one of them is the
#: same shape: a `[` with NO CLOSING `]` on the same line, which `_MARK_RE`
#: cannot match and which therefore opened no block and fell through to be
#: scored as sung text. `[Exeunt.`, `[Drinks.`, `[Music:` -- a printer's stage
#: direction read as a verse of a song.
#:
#: WHY THE LIST AND NOT JUST THE COUNT (doctrine 91, and CLAUDE.md's real-
#: exemplars clause): 14 is a number a future edit can make true again by
#: accident. These fourteen (file, source line, mark, the dropped line) are
#: re-located in the corpus before they are used, so a corpus edit that moves
#: one fails HERE rather than leaving the count standing on text nobody can
#: find.
#:
#: LINE NUMBERS REPINNED 2026-08-19: the taxonomy backfill inserted
#: `# region:` (all eng files, +1) and `# function:` (gay, +1 more) header
#: lines at the top of each file, so every source line below shifted by
#: exactly that insertion — hemans/ingelow/herrick/durfey +1, gay +2. The
#: text, the marks and the drops are unchanged; this pin firing on a
#: header edit is the list doing its provenance job (and doctrine 91's
#: warning about line numbers as addresses collecting its toll).
#:
#: LINE NUMBERS REPINNED AGAIN 2026-08-20 (Phase-1 load), and the SECOND
#: occurrence is why the failure message below was split. The Phase-1
#: concurrent load wrote a multi-source `# source:`/`# licence:` header
#: pair at the top of both `eng_hall_*` files (gay topped up from Oxford,
#: durfey additionally absorbing a spelling-variant twin), so every
#: address below them shifted: **gay +2, durfey +3**. Hemans, Ingelow
#: and Herrick were untouched by that load and did not move.
#:
#: NOTHING ABOUT THE CORPUS TEXT CHANGED — all nine blocks are still
#: empty, still under the same mark, still holding the same dropped
#: stage direction. This is the address moving, not the witness, and it
#: is the corpus-file instance of the defect `CLAUDE.md` records for
#: `data/sources.tsv:NNN` citations: **a line number into a file that
#: grows is not an address, it is an offset from a moving origin.** The
#: list stays keyed on the line number ON PURPOSE — that is what makes
#: it a provenance record rather than a text search — but the check now
#: says WHICH of the two things went wrong, because "the block is no
#: longer empty" and "the block moved" are different findings and the
#: first message stated only the first (doctrine 20/79).
def _window(fname, n, span=4):
    """The `span` lines under a mark at source line `n`, stripped.

    ONE DEFINITION, read by both halves of section 9 (doctrine 1): the
    provenance check asks whether the dropped line is still under its
    mark, and the moved/missing split asks the same question of a
    candidate address. Written twice these two could disagree about how
    far "immediately under" reaches, and the answer to "did this witness
    move or die" would depend on which half was asking.
    """
    with open(os.path.join(CORPUS, fname), encoding="utf-8",
              errors="replace") as fh:
        lines = fh.read().splitlines()
    return [l.strip() for l in lines[n:n + span]]


EMPTIED_BY_APPARATUS = [
    # THE ADDRESS IS A LINE NUMBER AND A LINE NUMBER IS AN OFFSET FROM A
    # MOVING ORIGIN — repinned 2026-08-20 when the HBV safe-subset load
    # appended items ABOVE ten of these fourteen witnesses. The witnesses
    # themselves are byte-identical and every one re-located under its own
    # mark; only the offsets moved. Same defect CLAUDE.md already records
    # for `data/sources.tsv:NNN` citations, one file over.
    ("eng_british_felicia_hemans.txt", 1793, "VERSE 12", "[_Exeunt omnes._"),
    ("eng_british_jean_ingelow.txt", 1846, "VERSE 6", "[_Much applause_."),
    ("eng_british_jean_ingelow.txt", 1892, "VERSE 6",
     "[_The fiddler and his daughter go away._"),
    ("eng_british_jean_ingelow.txt", 1946, "VERSE 14",
     "[_More tuning heard outside_."),
    ("eng_british_robert_herrick.txt", 5947, "VERSE 10",
     "[_1 Neatherd plays_"),
    ("eng_hall_john_gay.txt", 454, "VERSE 2",
     "[Holding _Macheath_, _Peachum_ pulling her."),
    ("eng_hall_john_gay.txt", 467, "VERSE 2", "[Exeunt."),
    ("eng_hall_john_gay.txt", 692, "VERSE 2", "[Rises."),
    ("eng_hall_john_gay.txt", 716, "VERSE 2", "[Drinks."),
    ("eng_hall_john_gay.txt", 752, "VERSE 6", "[Turns up the empty Bottle."),
    ("eng_hall_john_gay.txt", 758, "VERSE 9", "[Turns up the empty Pot."),
    ("eng_hall_thomas_durfey.txt", 597, "VERSE 12", "[Music:"),
    ("eng_hall_thomas_durfey.txt", 7212, "VERSE 4", "[Music:"),
    ("eng_hall_thomas_durfey.txt", 7255, "VERSE 10", "[Music:"),
]


def test_the_apparatus_rule_is_the_centres_and_its_price_is_named():
    """`read_marked_songs` half-spelled the apparatus rule, and the half it
    left out scored 133 stage directions as lyrics.

    WHAT WAS WRONG. Three tests decided everything: `--- TITLE:` opens a song,
    a RAW-line `#`/`--- ` skips a header, `_MARK_RE` opens a block. The append
    branch had no test at all, so a line reaching it was a line of the song
    whatever it was. Two consequences, and the second is the expensive one:
    the `#`/`--- ` tests never stripped, so an indented one got through; and a
    `[` WITH NO CLOSING `]` does not match `_MARK_RE`, opens no block, and
    lands in the previous block's lyric.

    MEASURED BEFORE IT WAS APPLIED, over all 260 files: 133 lines in 19 files
    across 130 blocks, of which 14 blocks are emptied outright because a
    one-line stage direction was their whole content. `quality/grid.py`'s
    `read_marked_songs` now calls `lyric_harness.is_apparatus_line` on the
    append branch and nowhere else -- AFTER `_MARK_RE`, because `[VERSE 1]` is
    itself apparatus by that rule and is the thing that opens a block.

    WHAT EMPTYING A BLOCK COSTS, ASKED RATHER THAN ASSUMED. Nothing, and the
    corpus says so twice over. An empty block was ALREADY this corpus's
    ordinary state -- 6,187 of 182,147 blocks before this rule, 5,884 of them
    Persian, where a `[BAYT n]` mark routinely stands alone -- so no consumer
    can ever have been entitled to index one. And none of the 14 is a
    chorus/burden/refrain: `empty_repeat_blocks` is 0 both before and after,
    so the ONE consumer of `Block.lines` in this repo (`compare_returns`, at
    two sites in this file; grep found no third) is never handed one from the
    corpus at all. `quality/test_grid.py` §23 hands it one anyway, from both
    sides and with and without a phonology, and it answers rather than
    raising.
    """
    c = corpus_scan()
    print("\n9. THE APPARATUS RULE — `read_marked_songs` calls the one "
          "definition, and what that cost")
    print(f"     block lines held      : {c['block_lines']:,}   "
          f"(450,396 before the rule; 133 apparatus lines left)")
    print(f"     empty blocks          : {c['empty_blocks']:,} of "
          f"{c['blocks']:,}   {dict(c['empty_by_language'])}")
    print(f"     empty repeat blocks   : {c['empty_repeat_blocks']}")

    check("NO line of any block, in any of the 260 files, is apparatus by "
          "`lyric_harness.is_apparatus_line` — the invariant, not the four "
          "shapes that happen to appear",
          not c["apparatus_survivors"],
          f"{len(c['apparatus_survivors'])} survivors of "
          f"{c['block_lines']:,} block lines"
          + ("" if not c["apparatus_survivors"] else
             f"; first three: {c['apparatus_survivors'][:3]}"))

    empty = {(f, n, m) for (f, n, m) in c["empty_marks"]}
    # TWO FAILURES, NOT ONE (doctrine 20/79). A pinned address that no
    # longer names an empty block can mean the block STOPPED BEING EMPTY
    # -- a real regression in the apparatus rule -- or it can mean the
    # file grew a header above it and the SAME empty block is three lines
    # further down, which is bookkeeping. The first message said only the
    # first, so the 2026-08-19 and 2026-08-20 header shifts both reported
    # as "not empty" about blocks that were empty the whole time. `moved`
    # is resolved by the witness's own stable coordinates -- same file,
    # same mark, same dropped line in the window -- and is reported with
    # its delta so the repin is mechanical rather than a re-derivation.
    missing, moved = [], []
    for f, n, m, dropped in EMPTIED_BY_APPARATUS:
        if (f, n, m) in empty:
            continue
        here = [en for (ef, en, em) in empty if ef == f and em == m
                and dropped in _window(f, en)]
        (moved if here else missing).append((f, n, m, here))
    check("all 14 named blocks are EMPTY — a mark whose only content was a "
          "stage direction is a block with no words, and the reader now says "
          "so instead of printing the direction as a verse",
          not missing and not moved,
          f"{14 - len(missing) - len(moved)} of 14 empty at their pinned "
          f"address"
          + (f"; NO LONGER EMPTY (a real regression): {missing}"
             if missing else "")
          + (f"; MOVED (the file grew above them; repin the address, the "
             f"witness is intact): "
             f"{[(f, n, m, h, [x - n for x in h]) for f, n, m, h in moved]}"
             if moved else ""))

    # THE PROVENANCE HALF. The dropped line has to still BE in the corpus at
    # the line the mark's own `source_line` implies, and it has to be
    # apparatus by the centre's rule -- otherwise this list is fourteen
    # assertions about text that has moved, which is the failure mode a bare
    # count of 14 could never show.
    relocated, wrong_rule = [], []
    for fname, n, mark, dropped in EMPTIED_BY_APPARATUS:
        if dropped not in _window(fname, n):
            relocated.append((fname, n, dropped))
        if not G_APPARATUS(dropped):
            wrong_rule.append(dropped)
    check("and each one's dropped line is still in the corpus, immediately "
          "under its mark",
          not relocated, f"{14 - len(relocated)} of 14 re-located"
          + ("" if not relocated else f"; moved: {relocated}"))
    check("every one of them is apparatus by the CENTRE's rule — none is "
          "dropped by anything `grid.py` decided for itself",
          not wrong_rule, "all 14 satisfy is_apparatus_line"
          if not wrong_rule else str(wrong_rule))
    check("and all 14 are the SAME defect: a `[` with no closing `]` on the "
          "line, which `_MARK_RE` cannot match",
          all(d.startswith("[") and "]" not in d
              for _, _, _, d in EMPTIED_BY_APPARATUS),
          f"{sorted({d.split()[0] for _, _, _, d in EMPTIED_BY_APPARATUS})}")

    # THE CONSUMER QUESTION, ANSWERED ON THE CORPUS. `compare_returns` is the
    # only reader of `Block.lines` anywhere in this repo, and it is reached
    # only through `MarkedSong.instances('chorus'|'burden'|'refrain')`.
    check("0 chorus/burden/refrain blocks are empty, so no return pair is "
          "ever built from an emptied block — unchanged by this rule, which "
          "empties only VERSE marks",
          c["empty_repeat_blocks"] == 0,
          f"{c['empty_repeat_blocks']} empty repeat blocks; the 14 are "
          f"{sorted({m for _, _, m, _ in EMPTIED_BY_APPARATUS})}")
    check("an empty block was ALREADY the corpus's ordinary state, which is "
          "why nothing downstream could have been assuming otherwise",
          c["empty_blocks"] > 6000 and c["empty_by_language"]["fas"] > 5000,
          f"{c['empty_blocks']:,} empty of {c['blocks']:,} blocks "
          f"({dict(c['empty_by_language'])}) — 6,187 before this rule and "
          f"{c['empty_blocks']:,} after, so the rule added 14 to a population "
          f"of thousands rather than creating the case")
    # REPINNED 2026-08-28 (M-47/M-27): fin ~~88~~ -> 92. The wrapped-note
    # follow rule declares three fin files (`fin_eino_leino`,
    # `fin_paavo_cajander`, `fin_wahanen_laulukirja`), and four of their
    # blocks held NOTHING but a wrapped editorial note's tail — the block
    # empties when the note leaves, which is the rule working. fas and san
    # are still byte-identical, so the original claim survives one language
    # wider: no arm moved that the follow set does not declare.
    check("the 14 additions were English and the 4 from the follow rule are "
          "Finnish — no UNDECLARED arm moved at all",
          c["empty_by_language"]["fas"] == 5884
          and c["empty_by_language"]["fin"] == 92
          and c["empty_by_language"]["san"] == 47,
          f"{dict(c['empty_by_language'])} — eng 168 -> 182 (apparatus "
          f"rule), fin 88 -> 92 (M-47 follow rule), everything else "
          f"byte-identical")


# ---------------------------------------------------------------------------
# THE CROSS-FUNCTION REPRISE, PRICED ON THE CORPUS
#
# `compare_returns` never cared where its two line lists came from. Every
# caller in `grid.py` handed it `song.instances_of(fn)` -- ONE function
# against ITSELF -- so "does the outro reprise the intro" was unaskable with
# the machinery to answer it sitting in the same file (CLAUDE.md known gap 7).
#
# The design question is not the comparison, it is WHICH PAIRS. This section
# is the evidence the answer rests on, and it is the negative half: run the
# rule over every cross-function pair the corpus can supply and count how
# often it would say "reprise" about two sections that are not one.
# ---------------------------------------------------------------------------

#: One corpus hit, named rather than counted (doctrine 91). Tennyson's
#: `[BURDEN]` is the line `Rode the six hundred.` and the first verse ENDS on
#: it -- printed inside the verse, which is what a burden IS. A pairwise
#: reprise check would report "the burden reprises the verse" about it, and
#: the sentence is meaningless: they are the same repetend, marked twice.
NAMED_CROSS_HIT = ("eng_british_alfred_tennyson.txt", "burden", "verse",
                   "Rode the six hundred.")


def test_which_pairs_may_be_asked_is_the_whole_design():
    c = corpus_scan()
    rate = c["cross_shared"] / c["cross_pairs"]
    print("\n10. THE CROSS-FUNCTION REPRISE — the asked set, priced")
    print(f"\n   Every UNORDERED pair of two DIFFERENT declared functions "
          f"inside one song,\n   first block against first block, over the "
          f"same {c['files']} files:")
    print(f"     pairs compared           : {c['cross_pairs']:,}")
    print(f"     >= 1 whole line in common: {c['cross_shared']:,}  "
          f"({rate:.1%})")
    for p, n in c["cross_by_pair"].most_common():
        h = c["cross_shared_by_pair"][p]
        print(f"       {p[0]+'/'+p[1]:20} {n:>5} asked  {h:>4} shared  "
              f"{h/n:>6.1%}")
    print(f"     kinds: {dict(c['cross_kinds'].most_common(6))}")

    # REPINNED 2026-08-28 (M-47/M-27): ~~922~~ -> 896. The 26 pairs that
    # left were built on blocks whose lines were a wrapped note's leaking
    # tail — editorial prose compared as though it were a section. NOT ONE
    # of the 61 shared-line pairs left, so the false-positive story below
    # sharpens: the rate RISES to 6.8% because the population shrank by
    # exactly the pairs that were never songs.
    check("the corpus can supply cross-function pairs at all — four "
          "functions, so six possible pairings",
          c["cross_pairs"] == 896 and len(c["cross_by_pair"]) == 5,
          f"{c['cross_pairs']:,} pairs over {len(c['cross_by_pair'])} of the "
          f"6 possible pairings ({sorted(c['cross_by_pair'])}); "
          f"burden/refrain never co-occur in one song, which is itself the "
          f"corpus saying the two marks are one printer's choice")
    # REPINNED 2026-08-20 (Tier-1): 51 of 889 (5.7%) -> 61 of 922 (6.6%).
    # The 10 new shared lines are the war-song shape — a chorus that sings
    # a line the verse also sings (Goober Peas's own refrain line) — and
    # the check below this one still holds: none lands in the asked set.
    # REPINNED 2026-08-28: 61 of ~~922 (6.6%)~~ 896 (6.8%) — the shared
    # count is UNMOVED and only the denominator fell (M-47's follow rule).
    check("ASKING EVERY PAIR WOULD BE WRONG 6.8% OF THE TIME — this is the "
          "number the declared asked set exists for",
          c["cross_shared"] == 61 and abs(rate - 0.0681) < 0.001,
          f"{c['cross_shared']} of {c['cross_pairs']:,} pairs share a whole "
          f"line under the declared normalisation, and NOT ONE is a reprise: "
          f"they are refrain lines a printer set inside the verse, or a "
          f"war-song chorus line the verse itself sings. On a "
          f"21-function vocabulary that is 420 ordered questions per song at "
          f"this error rate — doctrine 61, a rule that fires more often is "
          f"not a better rule")
    check("and the pairs that carry it are exactly the ones the default "
          "convention does NOT ask",
          not (set(c["cross_shared_by_pair"])
               & {tuple(sorted(p)) for p in G.POPULAR_SONG.reprises}),
          f"measured: {sorted(c['cross_shared_by_pair'])}; asked by "
          f"POPULAR_SONG: {[tuple(p) for p in G.POPULAR_SONG.reprises]} — "
          f"disjoint, so every one of the {c['cross_shared']} is silent under "
          f"the shipped default")

    # THE LIMIT OF THIS EVIDENCE, STATED. `MARK_FUNCTION` reads five marks
    # onto four functions and none of them is an intro, an outro or a
    # reprise, so no printed block in this corpus can WITNESS one of the
    # three pairs the convention does ask. This measurement bounds the false
    # positives and says nothing about the true positives, and pretending
    # otherwise would be doctrine 20 pointed at a corpus.
    check("the corpus cannot witness the asked pairs, and the reason is in "
          "`MARK_FUNCTION` rather than in an argument",
          not ({fn for p in G.POPULAR_SONG.reprises for fn in p}
               & set(G.MARK_FUNCTION.values())
               & {"intro", "outro", "reprise"}),
          f"marks read: {sorted(set(G.MARK_FUNCTION.values()))}; functions "
          f"the asked pairs name: "
          f"{sorted({fn for p in G.POPULAR_SONG.reprises for fn in p})}. The "
          f"printed record marks verses and repetends and does not mark a "
          f"song's opening or its close, so the positive side of this check "
          f"rests on the vocabulary's own glosses and is labelled as doing so")

    # AND ONE HIT, LOCATED. A rate with no instance under it is doctrine 58's
    # bare count: 51 is a number a later edit can make true again by accident.
    fname, a, b, line = NAMED_CROSS_HIT
    hits = [e for e in c["cross_examples"]
            if e[0] == fname and (e[2], e[3]) == (a, b)]
    check("the rate has an instance under it, re-located in the corpus",
          any(e[5].strip() == line for e in hits),
          f"{fname}: {[(e[1][:34], e[4], e[5][:28]) for e in hits[:3]]} — "
          f"Tennyson's burden IS the verse's last line, so 'the burden "
          f"reprises the verse' is a sentence about a mark, not about a song")

    # THE PRIMITIVE ITSELF, ON THE CORPUS'S OWN BLOCKS. The claim gap 7 makes
    # is that `compare_returns` was always able to do this and was never
    # asked; the cheapest proof is that the corpus sweep above called it
    # 889 times across two different functions and it answered every one.
    check("`compare_returns` resolved every cross-function pair to a named "
          "kind — the primitive needed nothing added to be asked this",
          sum(c["cross_kinds"].values()) == c["cross_pairs"]
          and set(c["cross_kinds"]) <= set(dict(G.VARIATION_KINDS)),
          f"{len(c['cross_kinds'])} kinds used; the same ladder section 6 "
          f"runs on same-function returns, on pairs it was never handed")


if __name__ == "__main__":
    for fn in (test_function_is_declared_and_never_inferred,
               test_the_questions_that_needed_a_function,
               test_the_hook,
               test_repetition_with_variation,
               test_the_a1_notation,
               test_the_corpus_holds,
               test_the_two_songs_the_gap_register_named,
               test_the_report_prints_three_counts,
               test_the_apparatus_rule_is_the_centres_and_its_price_is_named,
               test_which_pairs_may_be_asked_is_the_whole_design):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all song-function regressions pass")
