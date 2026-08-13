#!/usr/bin/env python3
"""Regressions for the recorded refusal on an unreadable word.

The defect these guard: `lyric_harness` refuses correctly at the comparator
(relation NO_ANCHOR) and every consumer then threw the refusal away. An
unreadable end word came out as a VIOLATION reading "below theta_rhyme" in
`check_scheme`, as NOTHING AT ALL in `rhyme_graph`, and as a SILENTLY
SUBSTITUTED rhyme word in `check_qafiya`. All three say something the harness
did not measure.

Test 3 is the one that has to be checked first on any change here: where every
word is readable, NOTHING may move. A fix that quiets the refusals by also
shifting a real score has traded one silent error for another.

Run: python3 quality/test_readability.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (Declaration, Lexicon, best_score,  # noqa: E402
                           check_qafiya, check_scheme, infer_chains,
                           line_anchors, line_readability, raw_final_token,
                           rhyme_graph, word_syllable_map)
from quality.readability import (corpus_rate, read_lines,  # noqa: E402
                                 report, substitution_report)

FAILURES = []
LEX = Lexicon()
DECL = Declaration()

CORPUS = os.path.join(HERE, "..", "corpus")
SONG = os.path.join(CORPUS, "song")

#: The constructed case. `zzzqx` is not in CMUdict and is not going to be. The
#: rhyme the harness can SEE is cat/hat, one token in from the end -- which is
#: exactly the trap: a path that takes the last word it could read reports
#: cat/hat and calls it the end rhyme.
OOV_A = "i saw the cat zzzqx"
OOV_B = "i wore the hat zzzqx"
OK_A = "i saw the cat"
OK_B = "i wore the hat"


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# ---------------------------------------------------------------------------
def test_constructed_oov_final():
    print("\n1. the constructed case: an unreadable end word is REFUSED, and "
          "the preceding word is not promoted in its place")

    ancs, last, oov = line_anchors(LEX, OOV_A)
    check("line_anchors yields no anchor", ancs == [],
          "an anchor here would have to be invented")
    check("the end word reported is the RAW final token, not the last "
          "readable one", last == "zzzqx", f"last={last!r}")
    check("raw_final_token agrees", raw_final_token(OOV_A) == "zzzqx")
    check("the OOV word is in the third return value", oov == ["zzzqx"])

    rec = line_readability(LEX, OOV_A)
    check("the record says the line is unreadable",
          rec["final_unreadable"] and not rec["readable"])
    check("the record names the instrument, not the poet",
          "CMUdict" in rec["reason"] and "UNKNOWN, not absent" in rec["reason"],
          rec["reason"])
    check("the record refuses a G2P fallback in so many words",
          "no G2P fallback" in rec["reason"])

    s = best_score(*[line_anchors(LEX, t)[0] for t in (OOV_A, OOV_B)],
                   DECL, "zzzqx", "zzzqx")
    check("the comparator refuses rather than scoring",
          s["relation"] == "NO_ANCHOR")
    check("even two IDENTICAL unreadable words are not called REPEAT",
          s["relation"] != "REPEAT",
          "REPEAT would assert the sounds are equal, which is unknown")

    res = check_scheme(LEX, [OOV_A, OOV_B], "AA", DECL)
    check("check_scheme does NOT call it a violation", res["violations"] == [],
          "it used to read 'below theta_rhyme=0.75', i.e. 'these do not rhyme'")
    check("check_scheme records a refusal instead", len(res["refusals"]) == 1)
    check("the refusal names the unreadable word",
          res["refusals"][0]["unreadable"] == ["zzzqx", "zzzqx"])
    check("the denominator for a rate is stated and is zero here",
          res["pairs_mandated"] == 1 and res["pairs_judged"] == 0
          and res["pairs_refused"] == 1)
    check("a per-line readability record is attached",
          len(res["readability"]) == 2
          and all(r["final_unreadable"] for r in res["readability"]))

    g = rhyme_graph(LEX, [OOV_A, OOV_B], DECL)
    check("rhyme_graph names the unreadable nodes rather than dropping them",
          [u["line"] for u in g["unreadable_nodes"]] == [1, 2],
          "the node used to go silent: no edge, no oov, no trace")
    check("rhyme_graph names the refused edge",
          len(g["refused_edges"]) == 1 and g["pairs_judged"] == 0)

    ch = infer_chains(LEX, [OK_A, OOV_A, OK_B], DECL)
    fillers = [f for c in ch for f in c["fillers"]]
    unread = [u for c in ch for u in c["unreadable"]]
    check("the unreadable line lands as a FILLER, as it always did",
          fillers == [(2, "zzzqx")])
    check("and its unreadability is now recorded there",
          len(unread) == 1 and unread[0]["role"] == "filler"
          and unread[0]["line"] == 2,
          "the per-chain oov field used to cover MEMBERS only, so it "
          "systematically missed the one role an unreadable line can take")
    check("the chain's oov field covers fillers too",
          any(c["oov"] == ["zzzqx"] for c in ch))

    q = check_qafiya(LEX, [OOV_A, OOV_B], DECL)
    endwords = [ew for _, ew, _ in q["audit"]]
    check("check_qafiya does NOT report 'cat' as the rhyme word",
          "cat" not in endwords and "hat" not in endwords,
          f"reported {endwords} -- this is relations.py's "
          f"_loci('line_final_token') bug, and the shipped file had it")
    check("check_qafiya refuses and says so", q["lines_refused"] == 2
          and all("REFUSED" in d[0] for _, _, d in q["audit"]))
    check("a refused line contributes nothing to the established profile",
          q["profile"]["rawi"] is None,
          "one substituted function word used to move the majority rawi for "
          "every other line in the poem")
    check("an unreadable line is NOT reported as a licensed refrain",
          not any("licensed" in d for _, _, ds in q["audit"] for d in ds),
          "None used to mean 'radif/refrain line: licensed'")

    check("no pronunciation was invented for zzzqx",
          LEX.transcribe_word("zzzqx") == ([], True))


# ---------------------------------------------------------------------------
def test_real_corpus_line():
    print("\n2. a REAL corpus line: William Barnes, Dorset dialect "
          "(corpus/song/eng_hall_william_barnes.txt)")
    path = os.path.join(SONG, "eng_hall_william_barnes.txt")
    if not os.path.exists(path):
        check("corpus file present", False, path)
        return
    lines = read_lines(path)
    idx = next((i for i, l in enumerate(lines)
                if "noo plea" in l.lower().replace("ä", "a")
                and l.rstrip(",").endswith("drong")), None)
    if idx is None or idx + 1 >= len(lines):
        check("the drong/zong couplet is still in the file", False)
        return
    a, b = lines[idx], lines[idx + 1]
    check("the couplet reads as expected",
          raw_final_token(a) == "drong" and raw_final_token(b) == "zong",
          f"{a!r} / {b!r}")

    # This is a real rhyme. The harness cannot read either word, and the ONLY
    # honest output is a refusal -- not "they rhyme" and not "they do not".
    res = check_scheme(LEX, [a, b], "AA", DECL)
    check("Barnes is NOT reported as failing to rhyme",
          res["violations"] == [],
          "drong/zong is a rhyme; the harness has no dictionary for either")
    check("the refusal is recorded", res["pairs_refused"] == 1
          and res["pairs_judged"] == 0)
    check("the harness does not claim they rhyme either",
          all(p["relation"] == "NO_ANCHOR" for p in res["pair_scores"]),
          "refusing is not the same as answering no, and not the same as yes")

    subs = substitution_report(LEX, [a, b])
    check("both lines would have had their rhyme word substituted",
          len(subs) == 2,
          f"{[(s['true_final'], s['would_have_used']) for s in subs]}")

    rep = report(LEX, [a, b])
    check("the report emits an UNREADABLE_END_WORD finding",
          [f.code for f in rep["findings"]] == ["UNREADABLE_END_WORD"])
    check("the finding carries the line numbers",
          rep["findings"][0].locations == [1, 2])


# ---------------------------------------------------------------------------
def test_readable_pairs_are_untouched():
    print("\n3. TRIPWIRE: where every word is readable, nothing moves")

    aa, _, _ = line_anchors(LEX, OK_A)
    bb, _, _ = line_anchors(LEX, OK_B)
    s = best_score(aa, bb, DECL, "cat", "hat")
    check("cat/hat still scores exactly 1.0 RHYME",
          s["total"] == 1.0 and s["relation"] == "RHYME" and s["flags"] == [],
          f"{s['total']} {s['relation']} {s['flags']}")

    res = check_scheme(LEX, [OK_A, OK_B], "AA", DECL)
    check("a readable mandated pair has no violation and no refusal",
          res["violations"] == [] and res["refusals"] == [])
    check("every mandated pair was judged",
          res["pairs_judged"] == res["pairs_mandated"] == 1)
    check("the readability records are clean and carry no reason",
          all(r["readable"] and r["reason"] is None
              for r in res["readability"]))

    # The demo's planted-failure block. These six numbers are the shipped
    # behaviour of the comparator and the band, and this change may not touch
    # any of them.
    demo = ["The river took the bridge at dawn",
            "and no one saw the water again",
            "the cattle waded through the silt",
            "past every fence the county rebuilt"]
    d = check_scheme(LEX, demo, "AABB", DECL)
    got = [(p["lines"], p["score"], p["relation"]) for p in d["pair_scores"]]
    want = [((1, 2), 0.729, "CONSONANCE"), ((1, 3), 0.62, "NO_RELATION"),
            ((1, 4), 0.477, "NO_RELATION"), ((2, 3), 0.748, "ASSONANCE"),
            ((2, 4), 0.748, "ASSONANCE"), ((3, 4), 1.0, "RHYME")]
    check("the demo's six pair scores are unchanged", got == want, f"{got}")
    check("the demo's single violation is unchanged",
          d["violations"] == [(1, 2, 0.729, "CONSONANCE not rhyme "
                                            "(conjunctive band)")])
    check("the demo refuses nothing", d["pairs_refused"] == 0)

    g = rhyme_graph(LEX, demo, DECL)
    check("the demo graph is unchanged",
          g["edges"] == [(2, 3, 1.0, "RHYME")] and g["cliques"] == [[2, 3]]
          and g["pairs_refused"] == 0)

    # word_syllable_map must not have moved for readable text: it feeds
    # internal_matches, rhyme_density, consonant_skeleton and cynghanedd.
    m = word_syllable_map(LEX, "the cattle waded through the silt")
    check("word_syllable_map is unchanged on readable text",
          [x["word"] for x in m][-1] == "silt" and len(m) == 8, f"{len(m)}")


# ---------------------------------------------------------------------------
def test_nothing_was_lost_on_the_sonnets():
    print("\n4. the sonnet battery: the refusals were SPLIT OUT, not deleted")
    import battery
    sonnets = battery.parse_sonnets(os.path.join(CORPUS, "sonnets.txt"))
    check("152 sonnets parse", len(sonnets) == 152, f"{len(sonnets)}")
    viol = ref = mandated = judged = 0
    for sn in sonnets:
        r = check_scheme(LEX, sn, "ABABCDCDEFEFGG", DECL)
        viol += len(r["violations"])
        ref += len(r["refusals"])
        mandated += r["pairs_mandated"]
        judged += r["pairs_judged"]
    check("mandated pairs still 1064", mandated == 1064, f"{mandated}")
    # 123 = 73 + 50 held while theta_coda was 0.60. Calibrating it to 0.80
    # (quality/redteam_band.py) moves the VIOLATION count to 81; the REFUSAL
    # count is a property of CMUdict, not of the band, so it does not move.
    # That invariance is the point of this check and is what it now pins.
    #
    # REPINNED 2026-08-11: 131 -> 132, 81 -> 82, when cell BA's coda-identity
    # fix moved the oracle's own violation pin (redteam_band.py, battery.py
    # EXPECTED). 50 refusals stay out of the numerator either way -- that
    # invariance is what this whole test exists to check, and it holds.
    check(f"violations + refusals == the recorded total",
          viol + ref == battery.EXPECTED["violations"] + 50,
          f"{viol} + {ref} -- nothing was invented and nothing vanished")
    check("50 of them are REFUSALS, not rhyme failures, and that count is "
          "independent of the band's thresholds", ref == 50,
          "40.7% of the sonnet battery's headline violation count was "
          "CMUdict failing to read Shakespeare, reported as Shakespeare "
          "failing to rhyme")
    # 73 -> 81 -> 82: 0.60 -> 0.80 calibrated theta_coda, then scalar ->
    # identity coda_agreement. The count that matters to THIS test is
    # unchanged: 50 refusals stay out of the numerator.
    # ALSO FIXED HERE: the previous `detail` argument referenced an undefined
    # `NOTE`, which crashed this test with a NameError on any run that reached
    # this line -- pre-existing at HEAD, not introduced by this repin. Found
    # only because this cleanup ran the file end to end rather than trusting
    # the last printed PASS.
    check(f"the violation count is {battery.EXPECTED['violations']} "
          f"(was 73 at theta_coda 0.60, 81 at scalar coda_agreement)",
          viol == battery.EXPECTED["violations"], str(viol))
    check("the judged denominator is 1014", judged == 1014,
          f"{judged}: a violation RATE is "
          f"{battery.EXPECTED['violations']}/1014 = "
          f"{battery.EXPECTED['violations']/1014:.1%}, not 132/1064 = 12.4%")


# ---------------------------------------------------------------------------
def test_corpus_song_rate_is_pinned():
    print("\n5. corpus/song/ unreadable-end-word rate — fails if it moves")
    import glob
    # SCOPED TO ENGLISH 2026-08-10, when corpus/song/ stopped being
    # monolingual. This rate is a fact about CMUdict reading English song
    # text. Running it over 花間集 or the Kanteletar would not raise the
    # number, it would make it a category error -- 100% of a Welsh file is
    # "unreadable" to an English dictionary, which says nothing about either.
    # A rate over a mixture reads the mixture (doctrine 8/32), and the file
    # set is part of the number (doctrine 58).
    paths = sorted(glob.glob(os.path.join(SONG, "eng_*.txt")))
    others = sorted(glob.glob(os.path.join(SONG, "*.txt")))
    check("143 ENGLISH song files present", len(paths) == 143, f"{len(paths)}")
    check("and the corpus is no longer monolingual, which is why the scope "
          "is now explicit", len(others) > len(paths),
          f"{len(others)} files total across "
          f"{len(set(os.path.basename(p).split('_')[0] for p in others))} "
          f"language prefixes; MISSING K-6")
    r = corpus_rate(LEX, paths)
    # Pinned 2026-08-10 against the shipped cmudict.dict and the line
    # definition in quality/readability.read_lines (stripped, non-empty, has a
    # Latin letter) counted over lines that yield at least one word token.
    # Doctrine 58: the setting is written next to the number.
    # REPINNED 2026-08-11 after the attribution cell removed 819 duplicated
    # lines from the two Lyrical Ballads files and one hymn from the Tate
    # file. The interesting part is the DIRECTION: the corpus lost lines and
    # the unreadable RATE went UP, 5.2677% -> 5.2873%, because only 6 of the
    # 819 lines that left had an unreadable end word. The duplicated material
    # was the readable kind, so every rate measured over this corpus before
    # 2026-08-11 was diluted by text that was in it twice.
    #
    # REPINNED AGAIN 2026-08-11, cell AC, after 63 further near-duplicate
    # items came out — the same poem in two printings, which no hash sees.
    # 189,985 -> 188,805 countable, 10,045 -> 10,044 unreadable, 5.2873% ->
    # 5.3198%. THE DIRECTION REPLICATES, and on a population three times the
    # size of the one that first showed it: 1,221 VERSE lines left and only 10
    # of them had an unreadable end word, 0.8% against the corpus's 6.0%.
    #
    # AND THE DENOMINATOR WAS NOT WHAT THE PIN'S NAME SAID IT WAS, which cell
    # AC measured while repinning: `read_lines` was "stripped, non-empty, has
    # a Latin letter" and NOTHING MORE, so the 188,805 "countable lines" were
    #
    #     VERSE                  151,898   9,078 unreadable    5.9764%
    #     [VERSE n] markers       29,990      27               0.09%
    #     --- TITLE: lines         4,930     612              12.41%
    #     other `--- ` lines         449     183              40.76%
    #     `#` header lines         1,538     144               9.36%
    #     ------------------------------------------------------------
    #     TOTAL                  188,805  10,044               5.3198%
    #
    # 19.5% of that denominator was not verse — the headline 5.32% was 5.98%
    # on verse alone, diluted by 29,990 `[VERSE n]` markers that are
    # countable, almost always readable, and are not lines of a poem.
    #
    # FIXED 2026-08-12: `read_lines` now excludes `#`/`--- `/`[`-prefixed
    # apparatus lines, matching every other reader in the project (including
    # `quality/grid.py`'s `read_marked_songs` over these SAME files, which
    # already drew this line). This REPIN is a RULE change, not a corpus
    # change, and it is the one cell AC's own comment predicted almost
    # exactly: 151,898 countable lines and 9,078 token-unreadable at
    # 5.9764% is EXACTLY cell AC's hand-computed "VERSE LINES ONLY" row
    # above, now the denominator `read_lines` itself produces rather than a
    # subset someone had to compute by hand to see the true rate.
    #
    # THE HYPHEN REFUSAL'S price is now 174, not 187 — the other 13 were on
    # `--- TITLE:`/`#` lines that no longer reach the denominator at all
    # (doctrine 91, the count is a coordinate of the rendering, and the
    # rendering just changed).
    check("countable lines 151898 — VERSE ONLY, now that apparatus lines "
          "are excluded at the source instead of subtracted by hand",
          r["lines_countable"] == 151898,
          f"{r['lines_countable']}  (was 188805 before the read_lines fix, "
          f"which counted 29,990 [VERSE n] markers and 6,917 other "
          f"apparatus lines as verse)")
    check("unreadable end word, cause TOKEN, 9078 — matches cell AC's own "
          "hand-computed VERSE-only row exactly",
          r["unreadable_final_token"] == 9078,
          f"{r['unreadable_final_token']} ({r['rate_token']:.4%})  "
          f"(was 10044 over the polluted denominator)")
    check("rate on that quantity is 5.98%, not 5.32% — the true verse rate "
          "cell AC could only get to by subtracting markers by hand",
          abs(r["rate_token"] - 0.059764) < 1e-5,
          f"{r['rate_token']:.4%}  (was 5.3198% diluted by 29,990 "
          f"[VERSE n] markers)")
    check("unreadable end word, cause PIECE, 174 — the price of the hyphen "
          "refusal on VERSE lines alone",
          r["unreadable_final_piece"] == 174,
          f"{r['unreadable_final_piece']}  (was 187; the other 13 were on "
          f"apparatus lines that no longer reach the denominator)")
    check("so the end-word refusal rate is 6.09% AFTER the rule and 5.98% "
          "before it, and both are printed",
          r["unreadable_final"] == 9252 and abs(r["rate"] - 0.060909) < 1e-5,
          f"{r['unreadable_final']} ({r['rate']:.4%})")
    check("8842 of those would have had the rhyme word SUBSTITUTED by an "
          "earlier word", r["substituted_end_word"] == 8842,
          f"{r['substituted_end_word']}  (was 9805 over the polluted "
          f"denominator)")
    check("the rate is not uniform across files — a subset rate is a "
          "different number",
          max(d["rate"] for d in r["per_file"]) > 0.20
          and min(d["rate"] for d in r["per_file"]) == 0.0,
          "23.62% (Edwin Waugh, up from 20.08% now the marker dilution "
          "that used to blur even the worst file is gone) to 0.0% (38 "
          "files, all readable); quoting one corpus-wide figure without "
          "the file set is doctrine 58")


def test_zero_syllable_word_has_no_anchor():
    print("\n6. a word with PHONES but no VOWEL is unreadable, not a crash "
          "— found by the full corpus/song/ calibration sweep hitting "
          "`_Sh----_`, an 18th-century censored name (Thomas D'Urfey) that "
          "tokenizes to `sh`. CMUdict lists `sh` as the interjection, one "
          "consonant phone (['SH']), no nucleus for `syllabify` to find. "
          "`line_anchors` used to fall through to `sylls[-1:]` on the "
          "empty syllable list and hand back a hollow, zero-syllable "
          "anchor instead of refusing — the first caller to index into "
          "it (`quality.features.RhymeField.field`) raised `IndexError`.")
    ALL_CONSONANT = ["sh", "shh", "hm", "hmm", "mm"]
    for w in ALL_CONSONANT:
        phones, oov = LEX.transcribe_word(w)
        check(f"{w!r} has phones (the dictionary CAN transcribe it)",
              bool(phones) and not oov, f"phones={phones!r}")
        ancs, last, oov2 = line_anchors(LEX, w)
        check(f"{w!r} still yields NO anchor — a phone list with no "
              "vowel is exactly the unreadable case, not an exception",
              ancs == [], f"ancs={ancs!r}")

    from quality.features import QualityFeatures, RhymeField  # noqa: E402
    field = RhymeField(LEX, DECL)
    check("RhymeField.field('sh') returns no candidates rather than "
          "raising IndexError", field.field("sh") == [])

    qf = QualityFeatures(lex=LEX, decl=DECL)
    real_line_a = "And some her Grace of _Sh----_"
    real_line_b = "Tho' she grows something fat:"
    vals = qf._predictability([real_line_a, real_line_b], [(0, 1)])
    check("the real corpus couplet that found this scores (or "
          "correctly skips) instead of crashing the whole calibration "
          "run", vals == [] or all(v == v for v in vals), f"vals={vals!r}")


def test_every_emitted_code_has_a_case():
    """The three refusal codes this module can emit that nothing exercised.

    An audit of all 58 finding codes in the repo found 12 with no test. Three
    are this module's. All three turned out to be REACHABLE -- the gap was
    coverage, not dead code -- but nothing distinguished that from the fourth
    case elsewhere in the repo, which was a guard no caller could reach. A code
    with no case cannot tell you which of the two it is.

    One fixture per code, each firing exactly one, so a future change that
    merges two of these guards fails here instead of quietly widening one.
    """
    print("\n7. every code report() can emit has a case")
    from quality import readability as RD

    def codes(lines):
        return {f.code for f in RD.report(LEX, lines)["findings"]}

    # The FINAL piece of a hyphenated compound is unreadable, so the anchor
    # would be built from an earlier piece -- the defect that was manufacturing
    # rhymes between any two of Barnes's participles.
    c = codes(["the wind came off the hill-zide",
               "and left us by the wife-zide"])
    check("UNREADABLE_END_WORD_PIECE fires on an unread final piece",
          c == {"UNREADABLE_END_WORD_PIECE"}, f"codes: {sorted(c)}")

    # Unreadable, but INTERIOR: the anchor is fine and only the record of what
    # was read is incomplete. Kept separate because the price is different.
    c = codes(["the zzzqx wind came off the hill",
               "and left us standing by the mill"])
    check("UNREADABLE_INTERIOR_WORD fires on an interior OOV alone",
          c == {"UNREADABLE_INTERIOR_WORD"}, f"codes: {sorted(c)}")

    # `threshing-floor` reads on `floor`: the anchor is RIGHT and the label
    # overstates what was read. A report-layer finding, not an anchor one.
    c = codes(["we crossed the threshing-floor", "and shut the heavy door"])
    check("END_WORD_LABEL_OVERSTATES fires when the label outruns the read",
          c == {"END_WORD_LABEL_OVERSTATES"}, f"codes: {sorted(c)}")

    # The position rule, pinned: an unread FINAL piece must never be filed as
    # interior. That misfiling was 328 of 328 cases before it was derived by
    # position, and only a corpus sweep found it.
    both = codes(["the wind came off the hill-zide",
                  "and left us by the wife-zide"])
    check("an unread final piece is never also reported as interior",
          "UNREADABLE_INTERIOR_WORD" not in both,
          "derived by POSITION, so no string coincidence can move it")


if __name__ == "__main__":
    for fn in (test_readable_pairs_are_untouched,
               test_constructed_oov_final,
               test_real_corpus_line,
               test_nothing_was_lost_on_the_sonnets,
               test_corpus_song_rate_is_pinned,
               test_zero_syllable_word_has_no_anchor,
               test_every_emitted_code_has_a_case):
        fn()
    print("=" * 68)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all readability / recorded-refusal regressions pass")
