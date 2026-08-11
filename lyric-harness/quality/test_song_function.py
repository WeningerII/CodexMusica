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
    bp = json.load(open(os.path.join(ROOT, "examples",
                                     "never_been_to_a_scene.blueprint.json")))
    secs = [G.Section(
        name=s["name"], bars=s["bars"], start_bar=s["start_bar"],
        meter=G.Meter(s["meter"]["beats"], s["meter"]["unit"],
                      tuple(s["meter"]["groups"])),
        function=DECLARED[s["name"]] if declare else G.UNDECLARED)
        for s in bp["sections"]]
    lines = [G.Line(text=l["text"], bar=l["bar"], beat=F(str(l["beat"])),
                    duration=F(str(l["duration"])), section=l["section"])
             for l in bp["lines"]]
    return G.Song(sections=secs, lines=lines, title="Never been to a scene")


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
    check("an unknown function RAISES rather than falling back to verse",
          _raises(lambda: G.Section("x", 4, function="middle8"),
                  G.UnknownFunction),
          "the move check_cynghanedd made for `language` (doctrine 45)")
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
    check("spelling variants normalise; synonyms do NOT",
          G.as_function("PRE-CHORUS") == "prechorus"
          and _raises(lambda: G.as_function("middle-8"), G.UnknownFunction),
          "`pre-chorus` is a spelling of `prechorus`; `middle8 -> bridge` "
          "would be a CLAIM, and claims live in the vocabulary with a gloss")


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
          prof["bars_until_first_chorus"] == 22
          and prof["bars_until_first_prechorus"] == 14,
          f"{prof['bars_until_first_chorus']} bars, after a 14-bar verse and "
          f"an 8-bar pre-chorus")
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


def test_the_hook():
    print("\n3. THE HOOK — a FRAGMENT, not a section (D-2)")
    song = scene_song()
    occ = G.hook_occurrences(song, "I don't get to go")
    check("a hook is found sub-line and located in BARS — TWO of them",
          len(occ) == 2
          and [o.bar for o in occ] == [30, 68]
          and [o.next_downbeat for o in occ] == [31, 69]
          and all(o.has_pickup for o in occ),
          f"{[(o.bar, o.next_downbeat, o.function) for o in occ]}. This "
          f"asserted `[31, 69]` while every line in the blueprint began on a "
          f"downbeat and the two coordinates could not disagree. The hook "
          f"takes a one-pulse pickup now, so its line STARTS at bar 30 beat "
          f"4 and its barline is 31 — and the old assertion would have been "
          f"repinned to 30 without anyone noticing the field had stopped "
          f"answering the question its name asks. WHICH of the two the "
          f"listener hears as the landing needs a setting, and there is none")
    check("and it knows which FUNCTION it landed in",
          {o.function for o in occ} == {"chorus"},
          "which is only sayable because the section declares one")
    f, r = G.hook_findings(song, hooks=["I don't get to go"])
    codes = {x.code for x in f}
    check("'is the title in the hook?' is ANSWERED",
          "TITLE_NOT_IN_HOOK" in codes,
          [x.evidence for x in f if x.code == "TITLE_NOT_IN_HOOK"][0])
    f2, _ = G.hook_findings(song, hooks=["nine miles of gravel"])
    check("a fragment that occurs once is named a line, not a hook",
          "HOOK_DOES_NOT_RECUR" in {x.code for x in f2})
    f3, _ = G.hook_findings(song, hooks=["there is no such phrase"])
    check("a hook that is not in the lyric is named",
          "HOOK_ABSENT" in {x.code for x in f3})
    _, r4 = G.hook_findings(song, hooks=())
    check("NO declared hook is a REFUSAL, never 'no hook problems'",
          {x.code for x in r4} == {"HOOK_UNDECLARED"},
          "doctrine 20 — a pass earned by asking nothing")
    check("the harness refuses to decide what your hook is",
          _raises(lambda: G.Hook("   ")))


def test_repetition_with_variation():
    print("\n4. REPETITION WITH VARIATION IS A MEASUREMENT (A-2)")
    song = scene_song()
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
    check("the session's own present->past shift is one word, and it says so",
          [v for v in r.varied_lines if v[0] == 2][0][4] == 1
          and [v for v in r.varied_lines if v[0] == 3][0][4] == 1,
          "'I will find you' -> 'I did find you' is 1 word edit; "
          "'and hold it there while you drive' -> 'and I held it there. You "
          "were alive' is 5")
    check("edit distance, at both scales",
          r.line_distance == 4 and r.token_distance == 9)
    check("preserved-rhyme-scheme flag, with the phonology NAMED",
          r.rhyme_scheme_preserved is True
          and "CMUdict" in r.declaration.rhyme_key,
          f"drive/alive and slow/go hold the partition; key = "
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
    }
    for path in sorted(glob.glob(os.path.join(CORPUS, "*.txt"))):
        out["files"] += 1
        lang = os.path.basename(path)[:3]
        for song in G.read_marked_songs(path, language=lang):
            out["songs"] += 1
            for b in song.blocks:
                out["blocks"] += 1
                out["blocks_by_language"][lang] += 1
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
    check("the repeat-block families are all expressible, none collapsed",
          rep_total >= 2739 and c["functions"]["chorus"] >= 247
          and c["functions"]["burden"] >= 1795
          and c["functions"]["refrain"] >= 716,
          f"{rep_total:,} repeat blocks held, and BURDEN is kept SEPARATE "
          f"from REFRAIN because the corpus marks them differently "
          f"(doctrine 24). Bounds, not equalities: corpus/song gained two "
          f"files while this cell was running.")
    check("the register's `2,454 marked repeat blocks` reproduces, and the "
          "unwritten coordinate was LANGUAGE SCOPE",
          eng_total >= 2454 and c["eng_repeat"]["chorus"] == 247,
          f"eng_* only gives {eng_total:,} "
          f"({dict(c['eng_repeat'])}); the recorded 1,603/604/247 is the "
          f"state at commit ef0baa4 restricted to `eng_*`, and the whole "
          f"corpus now stands at {rep_total:,} across "
          f"{len(c['blocks_by_language'])} language prefixes. Doctrine 58 "
          f"with SCOPE as the coordinate nobody wrote down.")

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
    rep = G.song_function_report(song, hooks=["I don't get to go"],
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
    rep2 = G.song_function_report(blind, hooks=["I don't get to go"])
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


if __name__ == "__main__":
    for fn in (test_function_is_declared_and_never_inferred,
               test_the_questions_that_needed_a_function,
               test_the_hook,
               test_repetition_with_variation,
               test_the_a1_notation,
               test_the_corpus_holds,
               test_the_two_songs_the_gap_register_named,
               test_the_report_prints_three_counts):
        fn()
    print("=" * 70)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all song-function regressions pass")
