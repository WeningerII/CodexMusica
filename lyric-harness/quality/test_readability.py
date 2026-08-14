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

Tests 7-9 are the hyphen defect's own, and they are REAL corpus lines because
that defect is the reason this repo's test discipline says so. It survived
three rounds; the third produced a wrong answer rather than a refusal
(`hill-zide` scored on `hill`); and no constructed fixture found any of it,
because a constructed fixture encodes what its author already believed about
hyphens. `SONG_EXEMPLARS`/`SONNET_EXEMPLARS` carry the eight words CLAUDE.md
names, each in the line its poet wrote, each checked present in the corpus
before it is used.

Run: python3 quality/test_readability.py
"""

import os
import re
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
    #
    # REPINNED 2026-08-13, 151,898 -> 151,894, AND THE REPIN CLOSES A RECORD
    # THAT DISAGREED WITH ITSELF RATHER THAN OPENING ONE. The 2026-08-12 fix
    # above wrote the apparatus rule into `read_lines` a SECOND time instead
    # of calling `lyric_harness.is_apparatus_line`, and it wrote it
    # differently: `--- ` with a trailing space against the centre's `---`.
    # The two agree on `--- TITLE:` and on every ordinary source note and
    # disagree on a RULE, so the divergence sat in the one place a reader
    # would never look — a run of four or more hyphens is not `--- `.
    #
    # THE WHOLE COST, MEASURED BEFORE IT WAS APPLIED: FOUR lines, and all four
    # are Wordsworth epigraphs in `corpus/song/eng_british_felicia_hemans.txt`
    # — `----“’Tis not merely` (line 3957), `----“Sing aloud` (4255),
    # `----“His early days` (6567), `----“How divine` (11043). An epigraph is
    # apparatus to every other reader in this repo and was verse to this one
    # alone. Nothing else in 143 files changes, and `corpus/sonnets.txt`
    # carries no apparatus line under EITHER spelling (0 of 3,005 lines), so
    # the sonnet battery is untouched BY CONSTRUCTION and not merely observed
    # to be.
    #
    # AND 151,894 IS NOT A NEW NUMBER — it is the one already recorded in
    # `quality/RESULTS_HYPHEN_REFUSAL.md` (twice), in `quality/readability.py`
    # module docstring, and in `lyric_harness.token_pieces`, whose own
    # docstring said in as many words that `read_lines` "returns 151,898 on
    # the current corpus, matching this figure rather than ...". The record
    # held BOTH figures for a day and this test pinned the minority one; there
    # is one figure now, and it is the one the other four sites already had.
    #
    # NO RATE MOVES MATERIALLY, which is the check that this was a DENOMINATOR
    # correction and not an ingestion change: all four end words (`merely`,
    # `aloud`, `days`, `divine`) are in CMUdict, so 9,078 / 174 / 149 / 8,842
    # are byte-identical and only the divisor falls — 5.97638% -> 5.97654%
    # and 6.09093% -> 6.09109%, both inside the 1e-5 tolerances the two
    # checks below carry. Doctrine 58: the tolerance is part of the pin, so
    # the movement it absorbs is written down instead of being invisible.
    check("countable lines 151894 — VERSE ONLY, now that apparatus lines "
          "are excluded at the source instead of subtracted by hand, and "
          "under the CENTRE's `---` rather than a second `--- ` of our own",
          r["lines_countable"] == 151894,
          f"{r['lines_countable']}  (was 188805 before the read_lines fix, "
          f"which counted 29,990 [VERSE n] markers and 6,917 other "
          f"apparatus lines as verse; and 151898 for one day between that "
          f"fix and `is_apparatus_line` becoming this reader's only rule)")
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

    # THE POSITION INVARIANT, CORPUS-WIDE. Test 9 pins it on four named lines;
    # this pins the population those lines were drawn from, and it costs
    # nothing because `corpus_rate` computes it in the pass it was already
    # making (a second sweep would derive the population from a second
    # definition, which is how a record and a behaviour drift apart).
    #
    # 323 = 174 + 149 is CLAUDE.md's own split and it reproduces exactly at
    # HEAD. The number that matters is the last one: `interior_misfiled` is 4
    # raw overlaps, ALL FOUR of them Kingsley's `Sing heigh-ho, and heigh-ho!`
    # where `heigh` really is in both places, and 0 of them unexplained by an
    # earlier token. 0 is what "derived by POSITION" means measured rather
    # than asserted, and it is the direct successor to the 328 of 328.
    check("the hyphen population is 323 end tokens with a read piece and an "
          "unread piece — CLAUDE.md's own figure, reproduced",
          r["final_piece_population"] == 323,
          f"{r['final_piece_population']}")
    check("split 174 ANCHOR-layer (refused) + 149 REPORT-layer (label "
          "overstates, never refused)",
          r["unreadable_final_piece"] == 174 and r["label_overstates"] == 149,
          f"{r['unreadable_final_piece']} + {r['label_overstates']}")
    check("0 of 323 have an end-word piece misfiled as interior — the "
          "328-of-328 defect, measured at zero",
          r["interior_misfiled_unexplained"] == 0,
          f"{r['interior_misfiled_unexplained']} unexplained of "
          f"{r['interior_misfiled']} raw overlaps")
    check("and the 4 raw overlaps are REAL double occurrences, not "
          "misfilings — reported separately rather than summed (doctrine 79)",
          r["interior_misfiled"] == 4,
          f"{r['interior_misfiled']}: all four are Kingsley's `Sing heigh-ho, "
          f"and heigh-ho!`, where `heigh` is an interior token's unread piece "
          f"AND the end token's; suppressing them would delete a real "
          f"interior gap (doctrine 24)")

    # ONE RULE, AND THE TEST IS THAT IT IS ONE. The pin above is an
    # ARITHMETIC consequence of the rule; this is the rule itself, and it is
    # the check that stops a third copy of it appearing here the way the
    # second one did. `read_lines` may not have an apparatus opinion — its
    # only opinion is blank/no-Latin-letter — so on every raw line of all 143
    # files, "excluded by `read_lines`" and `is_apparatus_line` must be the
    # SAME predicate. Written as a sweep over the corpus rather than over a
    # fixture because the divergence this closes (`--- ` against `---`) is
    # invisible to any fixture whose author had not already thought of a
    # four-hyphen epigraph, which is CLAUDE.md's "real exemplars" clause
    # applied to a rule instead of to a word.
    from lyric_harness import is_apparatus_line
    disagree, letters = [], 0
    for p in paths:
        kept = set()
        for s in read_lines(p):
            kept.add(s)
        with open(p, encoding="utf-8", errors="replace") as fh:
            for ln, raw in enumerate(fh, 1):
                s = raw.strip()
                if not s or not re.search(r"[A-Za-z]", s):
                    continue
                letters += 1
                if (s not in kept) != is_apparatus_line(s):
                    disagree.append((os.path.basename(p), ln, s))
    check("`read_lines` and `is_apparatus_line` are the SAME rule on every "
          "one of the corpus's letter-bearing lines — not two rules that "
          "happen to agree",
          not disagree,
          f"{letters:,} letter-bearing lines swept, {len(disagree)} "
          f"disagreements"
          + ("" if not disagree else
             "; first: " + repr(disagree[:3])))

    # THE FOUR LINES THAT MOVED, NAMED AND RE-LOCATED. `present()` is the
    # provenance half: a corpus edit that removes one of these fails HERE
    # rather than leaving the repin above standing on text nobody can find.
    hemans = os.path.join(SONG, "eng_british_felicia_hemans.txt")
    moved = ["----“’Tis not merely", "----“Sing aloud",
             "----“His early days", "----“How divine"]
    check("all four Wordsworth epigraphs are still in Hemans, verbatim",
          all(present(hemans, t) for t in moved),
          f"{[t for t in moved if not present(hemans, t)]} missing")
    kept = set(read_lines(hemans))
    check("and `read_lines` now excludes all four — 151,898 - 4 = 151,894, "
          "which is the whole of the repin",
          not [t for t in moved if t in kept],
          f"{[t for t in moved if t in kept]} still counted as verse; each "
          f"opens with four hyphens, so `--- ` did not match it and `---` "
          f"does")
    check("they are apparatus by the CENTRE's rule, which is the reason they "
          "are excluded — not by a rule this file owns",
          all(is_apparatus_line(t) for t in moved),
          "is_apparatus_line: " + str([is_apparatus_line(t) for t in moved]))


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
    vals = [v for _i, _j, v
            in qf._predictability([real_line_a, real_line_b], [(0, 1)])]
    check("the real corpus couplet that found this scores (or "
          "correctly skips) instead of crashing the whole calibration "
          "run", vals == [] or all(v == v for v in vals), f"vals={vals!r}")


#: THE REAL EXEMPLARS. Every string below is a verbatim line of this repo's
#: own corpus, cited by file, and `present()` re-locates it before the test
#: uses it -- so a corpus edit that removes one FAILS HERE rather than leaving
#: a green test standing on a line the corpus no longer contains.
#:
#: They replaced constructed fixtures on 2026-08-13, and the reason is this
#: module's own history. CLAUDE.md, "Real exemplars over constructed tests":
#: the hyphen bug survived THREE rounds and the third produced a WRONG ANSWER
#: rather than a refusal -- `hill-zide` scored on `hill`, `hill-zide`/
#: `wife-zide` reported as `hill` against `wife`, and the line called READABLE.
#: No invented fixture found it, because an invented fixture encodes what its
#: author already believed about hyphens. `("the wind came off the hill-zide",
#: "and left us by the wife-zide")` -- the constructed pair that stood here
#: before -- is a rhyming couplet nobody wrote, built around one real word;
#: `wife-zide` is not in the corpus at all. These are the eight words the
#: record names, in the lines their poets actually wrote.
#:
#: (code, file under corpus/song/, verbatim line, what it demonstrates)
SONG_EXEMPLARS = [
    ("UNREADABLE_END_WORD_PIECE", "eng_hall_william_barnes.txt",
     "There down below the steep hill-zide,",
     "the canonical case. `zide` is Dorset initial fricative voicing and "
     "CMUdict has no entry, so the anchor would have been `hill`"),
    ("UNREADABLE_END_WORD_PIECE", "eng_hall_william_barnes.txt",
     "The happiest days that we've a-vound,",
     "the SHARPEST case: the only piece that reads is the participial "
     "prefix, whose one phone is a schwa -- see test 8"),
    ("UNREADABLE_END_WORD_PIECE", "eng_british_matthew_arnold.txt",
     "In heart, high-souled;",
     "not dialect at all: an ordinary literary compound CMUdict does not "
     "list. 88 of the 174 are this kind"),
    ("UNREADABLE_END_WORD_PIECE", "eng_british_percy_bysshe_shelley.txt",
     "Star-inwrought!",
     "a whole line that is one compound; the read piece `Star` is not the "
     "rhyme word either"),
    ("UNREADABLE_END_WORD_PIECE", "eng_british_robert_browning.txt",
     "The hillside's dew-pearled;",
     "Pippa's song, where the unread piece carries the rhyme with `world`"),
    ("END_WORD_LABEL_OVERSTATES", "eng_hall_john_clare.txt",
     "Shut out the sun--or to some threshing-floor.",
     "the REPORT-layer half: `floor` reads and IS the rhyme word, so the "
     "anchor is right and only the printed label overstates. Never a "
     "refusal -- 149 of the 323, and none of them are in `rate`"),
    ("UNREADABLE_INTERIOR_WORD", "eng_american_abram_joseph_ryan.txt",
     "Furl that Banner, for 'tis weary;",
     "the end rhyme `weary` is sound; CMUdict has no `furl`, so a mosaic "
     "anchor reaching back past it would join phones across a hole"),
]

#: The same defect on the OTHER population, and the reason its price there is
#: ZERO: both sonnet compounds read on their LAST piece, so both are
#: label-overstates and NEITHER is refused. `quality/RESULTS_HYPHEN_REFUSAL.md`
#: measures the price as zero on the sonnet oracle and +0.099pp on the song
#: corpus; this is the half of that claim nothing was checking.
#:
#: THE TWO APOSTROPHES ARE NOT A TYPO AND THE TEST WOULD HAVE PASSED WITHOUT
#: NOTICING. `sonnets.txt` sets the line with U+2019 (`o’er-read`) and the
#: record reports the piece as ASCII `o'er`, because `line_tokens` folds
#: apostrophes before the token is ever split on its hyphens. So the third
#: column below is the corpus's spelling and the fifth is the LEXICON's, and
#: they differ by one codepoint. Writing both out is the point of a code whose
#: whole subject is a label that does not match what was read: an exemplar
#: table that quietly used one spelling for both would be committing, in the
#: fixture, the defect the fixture exists to demonstrate.
SONNET_EXEMPLARS = [
    ("END_WORD_LABEL_OVERSTATES", 51, 13,
     "‘Since from thee going, he went wilful-slow,", "wilful", "slow"),
    ("END_WORD_LABEL_OVERSTATES", 81, 10,
     "Which eyes not yet created shall o’er-read;", "o'er", "read"),
]


def present(path, text):
    """Is `text` a line of `path`, exactly? The provenance half of an exemplar
    (doctrine 34's shape one level down: a fixture with no row in the corpus is
    the defect). Compares stripped, which is how every reader here reads."""
    if not os.path.exists(path):
        return False
    with open(path, encoding="utf-8", errors="replace") as f:
        return any(line.strip() == text for line in f)


def test_every_emitted_code_has_a_case():
    """The three refusal codes this module can emit that nothing exercised.

    An audit of all 58 finding codes in the repo found 12 with no test. Three
    are this module's. All three turned out to be REACHABLE -- the gap was
    coverage, not dead code -- but nothing distinguished that from the fourth
    case elsewhere in the repo, which was a guard no caller could reach. A code
    with no case cannot tell you which of the two it is.

    One fixture per code, each firing exactly one, so a future change that
    merges two of these guards fails here instead of quietly widening one. And
    the roster is READ OUT OF THE SOURCE rather than listed by hand: a fifth
    code added to `report()` without a case fails this test, which is the only
    thing that stops the gap this test closes from reopening (doctrine 48 -- a
    principle that lives only in prose gets followed exactly as often as
    someone remembers it).
    """
    print("\n7. every code report() can emit has a case, and every case is a "
          "REAL corpus line")
    import re as _re
    from quality import readability as RD

    def codes(lines):
        return {f.code for f in RD.report(LEX, lines)["findings"]}

    with open(RD.__file__, encoding="utf-8") as f:
        emitted = set(_re.findall(r'code="([A-Z_]+)"', f.read()))
    covered = {"UNREADABLE_END_WORD"} | {c for c, *_ in SONG_EXEMPLARS}
    check("report() emits exactly the four codes this file has cases for",
          emitted == covered,
          f"in source but uncovered: {sorted(emitted - covered)}; "
          f"covered but no longer emitted: {sorted(covered - emitted)}")
    # UNREADABLE_END_WORD is the fourth, and test 2 already carries its real
    # case (Barnes's `drong`/`zong`, where NOTHING in the end word reads).

    for code, fname, text, why in SONG_EXEMPLARS:
        path = os.path.join(SONG, fname)
        if not present(path, text):
            check(f"{code}: exemplar still in {fname}", False, repr(text))
            continue
        got = codes([text])
        check(f"{code} fires, and ONLY it, on a real line of {fname}",
              got == {code}, f"{text!r}\n          {why}\n          "
                             f"codes: {sorted(got)}")

    sonnets_path = os.path.join(CORPUS, "sonnets.txt")
    for code, sn, ln, text, unread_piece, read_piece in SONNET_EXEMPLARS:
        if not present(sonnets_path, text):
            check(f"{code}: sonnet {sn} L{ln} still in sonnets.txt", False,
                  repr(text))
            continue
        got = codes([text])
        rec = line_readability(LEX, text)
        check(f"{code} fires on sonnet {sn} L{ln}, and the line is NOT "
              f"refused — the price of the hyphen rule on this population "
              f"is zero", got == {code} and not rec["final_unreadable"]
              and rec["readable"],
              f"{text!r} codes: {sorted(got)}")
        check(f"sonnet {sn} L{ln} reads on its LAST piece "
              f"({read_piece!r}), which is the rhyme word, and the "
              f"overstatement is {unread_piece!r} — folded, which is the "
              f"lexicon's spelling and not always the corpus's",
              rec["final_unread_pieces"] == [unread_piece]
              and read_piece in (rec["final_token"] or ""),
              f"pieces={rec['final_unread_pieces']} "
              f"final_token={rec['final_token']!r} "
              f"(corpus line spells it {text.split()[-1]!r})")


def test_the_manufactured_rhyme_is_refused():
    """`a-vound`: the case where the harness INVENTED a relation.

    CLAUDE.md's record calls this the expensive one and says why it is a
    different KIND from the other two hyphen errors -- they produced a refusal,
    this produced a WRONG ANSWER. The mechanism is stated there in one
    sentence: "the only piece that reads is the participial prefix whose only
    phone is a schwa, so ANY TWO of Barnes's participles scored as a rhyme with
    each other on it: the harness was MANUFACTURING rhymes, not mislabelling
    them."

    That sentence is a measurement and it had never been made. It is made here,
    over the file it was found in: every distinct `a-`-prefixed participle at a
    line end whose last piece is unread yields the IDENTICAL would-be anchor
    phones, so the count of them is the size of the equivalence class the old
    path would have rhymed together.
    """
    print("\n8. `a-vound`: the harness was MANUFACTURING rhymes, and the "
          "size of the manufactured class is measured, not asserted")
    from lyric_harness import unread_final_piece
    path = os.path.join(SONG, "eng_hall_william_barnes.txt")
    if not os.path.exists(path):
        check("Barnes corpus file present", False, path)
        return
    lines = read_lines(path)
    klass = {}
    for text in lines:
        fin = raw_final_token(text)
        if not fin or not fin.lower().startswith("a-"):
            continue
        if unread_final_piece(LEX, fin)[0] is None:
            continue
        klass.setdefault(fin.lower(), []).append(text)
    # Pinned 2026-08-13 against the shipped cmudict.dict and this file at
    # HEAD. Doctrine 58: the file set and the lexicon are part of the number,
    # so both are named. If Barnes is re-ingested this moves, and it should.
    check("29 distinct `a-` participles end a line in this one file with "
          "their last piece unread", len(klass) == 29,
          f"{len(klass)}: {sorted(klass)[:6]} ...")
    phones = {w: tuple(LEX.transcribe(w)[0]) for w in klass}
    distinct = set(phones.values())
    check("and ALL of them would have anchored on the IDENTICAL phone list — "
          "one schwa — so the class was mutually 'rhyming' by construction",
          distinct == {("AH0",)},
          f"{len(distinct)} distinct would-be anchors: {sorted(distinct)[:4]}")
    check("the manufactured class is the SIZE of that phone class, not a "
          "handful of pairs", sum(len(v) for v in klass.values()) >= 60,
          f"{sum(len(v) for v in klass.values())} line ends across "
          f"{len(klass)} distinct participles")

    # Two REAL lines, two DIFFERENT participles. Before the refusal these
    # scored against each other on `a-`; the only honest answer is NO_ANCHOR.
    a = "The happiest days that we've a-vound,"
    b = "Vor his soul, we do know, is to heaven a-vled,"
    check("both real Barnes lines are still in the file",
          present(path, a) and present(path, b))
    check("the two end words are DIFFERENT words with the SAME would-be "
          "phones — this is the manufacturing, stated as a fact about the "
          "lexicon path", raw_final_token(a) != raw_final_token(b)
          and LEX.transcribe(raw_final_token(a))[0]
          == LEX.transcribe(raw_final_token(b))[0] == ["AH0"],
          f"{raw_final_token(a)!r} vs {raw_final_token(b)!r}")
    aa, la, _ = line_anchors(LEX, a)
    bb, lb, _ = line_anchors(LEX, b)
    check("`line_anchors` now REFUSES both rather than anchoring on `a-`",
          aa == [] and bb == [], f"{len(aa)} / {len(bb)} anchors")
    s = best_score(aa, bb, DECL, la, lb)
    check("so the comparator returns NO_ANCHOR, not a rhyme it invented",
          s["relation"] == "NO_ANCHOR" and s["total"] == 0.0,
          f"{s['relation']} {s['total']} — it used to pass the band on a "
          f"schwa shared by every participle in the file")
    res = check_scheme(LEX, [a, b], "AA", DECL)
    check("and the pair is REFUSED, not counted as a violation",
          res["violations"] == [] and res["pairs_refused"] == 1
          and res["pairs_judged"] == 0,
          "a manufactured rhyme deleted is not a rhyme failure created")


def test_interior_is_derived_by_position():
    """The regression test for the 328-of-328 misfiling.

    `interior_unreadable` USED to be "every unreadable string whose folded form
    differs from the WHOLE final token". `transcribe` emits hyphen PIECES, so
    `zide` -- part of the END word -- differs from `hill-zide` and was filed as
    an INTERIOR unreadable. It is derived BY POSITION now (tokens strictly
    before the last), so no string coincidence can move a final piece into it.

    THIS TEST ASSERTS AT THE RECORD LAYER, ON PURPOSE, AND THAT IS THE POINT.
    `report()` builds its interior finding from records with
    `not final_unreadable`, so for the 174 lines where the FINAL piece is the
    unread one the interior finding is filtered out before it is ever reached
    -- a position-blind regression would put `zide` back in
    `interior_unreadable` and `report()` would emit exactly the same codes it
    does now. An assertion phrased over `report()`'s codes therefore cannot
    fail on that half of the population, which is doctrine 48's own case (a
    check that cannot fail is decoration). Check 2 below proves the filtering
    on a real line rather than arguing it.
    """
    print("\n9. `interior_unreadable` is derived by POSITION — pinned at the "
          "RECORD layer, because the report layer cannot see half of it")
    from quality import readability as RD
    barnes = os.path.join(SONG, "eng_hall_william_barnes.txt")

    # 1. THE CATCHER. Real line, one unread piece, and it is the FINAL piece.
    # Position-blind logic ("spelled differently from the whole final token")
    # puts `zide` in `interior_unreadable`; the position rule cannot.
    hill = "There down below the steep hill-zide,"
    check("the hill-zide line is still in Barnes", present(barnes, hill))
    rec = line_readability(LEX, hill)
    check("the unread piece is filed as an END-WORD piece",
          rec["final_unread_pieces"] == ["zide"]
          and rec["final_unreadable_cause"] == "piece",
          f"{rec['final_unread_pieces']} / {rec['final_unreadable_cause']}")
    check("and `interior_unreadable` is EMPTY — the whole regression, and it "
          "is only visible here",
          rec["interior_unreadable"] == [],
          f"{rec['interior_unreadable']}: position-blind logic files `zide` "
          f"here, which is what 328 of 328 cases did")

    # 2. WHY IT IS NOT ASSERTED THROUGH `report()`. A real Barnes line with a
    # refused end word AND genuine interior unreadables: the interior finding
    # is filtered out by `not final_unreadable`, so this code is structurally
    # unreachable for every one of the 174. The old assertion in test 7 was
    # phrased over these codes and could not have failed.
    vust = "Since vu'st I trod thik steep hill-zide"
    check("the vu'st line is still in Barnes", present(barnes, vust))
    rec2 = line_readability(LEX, vust)
    got = {f.code for f in RD.report(LEX, [vust])["findings"]}
    check("this line HAS interior unreadables and a refused end word",
          rec2["interior_unreadable"] == ["vu'st", "thik"]
          and rec2["final_unreadable"], f"{rec2['interior_unreadable']}")
    check("yet report() emits only the end-word code — so an interior "
          "assertion made through report() is decoration on this population "
          "(doctrine 48)", got == {"UNREADABLE_END_WORD_PIECE"},
          f"codes: {sorted(got)}")

    # 3. THE HALF THE REPORT LAYER *CAN* SEE. `threshing-floor` reads on its
    # last piece, so `final_unreadable` is False and the interior filter does
    # let a finding through -- position-blind logic files `threshing` as
    # interior and this exact-set assertion catches it.
    clare = os.path.join(SONG, "eng_hall_john_clare.txt")
    thresh = "Shut out the sun--or to some threshing-floor."
    check("the threshing-floor line is still in Clare", present(clare, thresh))
    rec3 = line_readability(LEX, thresh)
    got3 = {f.code for f in RD.report(LEX, [thresh])["findings"]}
    check("an EARLIER unread piece is a final piece too, never interior",
          rec3["final_unread_pieces"] == ["threshing"]
          and rec3["interior_unreadable"] == [],
          f"pieces={rec3['final_unread_pieces']} "
          f"interior={rec3['interior_unreadable']}")
    check("and here the exact code set does catch it",
          got3 == {"END_WORD_LABEL_OVERSTATES"}, f"codes: {sorted(got3)}")

    # 4. THE STRING COINCIDENCE, FROM THE CORPUS RATHER THAN INVENTED. In
    # Kingsley's line `heigh` occurs TWICE -- once as an interior token's
    # unread piece and once as the end token's -- so the correct answer is
    # BOTH, and it is the only such line in the 143 files. This catches the
    # naive over-correction (subtract final pieces from interior), which would
    # delete a real interior gap: doctrine 24, a rule that would delete a
    # category must RELABEL instead.
    kings = os.path.join(SONG, "eng_british_charles_kingsley.txt")
    heigh = "Sing heigh-ho, and heigh-ho!"
    check("the heigh-ho line is still in Kingsley", present(kings, heigh))
    rec4 = line_readability(LEX, heigh)
    got4 = {f.code for f in RD.report(LEX, [heigh])["findings"]}
    check("the SAME unread string is reported in BOTH places, because it "
          "genuinely is in both", rec4["final_unread_pieces"] == ["heigh"]
          and rec4["interior_unreadable"] == ["heigh"],
          f"pieces={rec4['final_unread_pieces']} "
          f"interior={rec4['interior_unreadable']}")
    check("so both findings fire on one line, and neither is suppressed by "
          "the other", got4 == {"END_WORD_LABEL_OVERSTATES",
                                "UNREADABLE_INTERIOR_WORD"},
          f"codes: {sorted(got4)}")


if __name__ == "__main__":
    for fn in (test_readable_pairs_are_untouched,
               test_constructed_oov_final,
               test_real_corpus_line,
               test_nothing_was_lost_on_the_sonnets,
               test_corpus_song_rate_is_pinned,
               test_zero_syllable_word_has_no_anchor,
               test_every_emitted_code_has_a_case,
               test_the_manufactured_rhyme_is_refused,
               test_interior_is_derived_by_position):
        fn()
    print("=" * 68)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all readability / recorded-refusal regressions pass")
