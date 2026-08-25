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
    check("the report emits an UNREADABLE_END_WORD finding, and beside it "
          "the SUBSTITUTED_END_WORD note that names the word `drong` and "
          "`zong` would each have been rhymed on instead (WIRED 2026-08-14; "
          "before that the count reached `main()` and the WORDS reached "
          "nothing)",
          [f.code for f in rep["findings"]] == ["UNREADABLE_END_WORD",
                                                "SUBSTITUTED_END_WORD"],
          f"{[f.code for f in rep['findings']]}")
    check("the finding carries the line numbers",
          rep["findings"][0].locations == [1, 2])
    subst = next(f for f in rep["findings"]
                 if f.code == "SUBSTITUTED_END_WORD")
    check("...and it is a NOTE, not a second charge: the LINE is already "
          "flagged above and what this adds is which WORD",
          subst.severity == "note" and subst.locations == [1, 2]
          and all(w in subst.message
                  for w in ("'drong'", "'zong'",
                            repr(subs[0]["would_have_used"]))),
          f"{subst.severity} {subst.locations} :: {subst.message}")


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
    # RESTATED 2026-08-18: the refusal now NAMES the declared door — the
    # admit set (`Declaration.admit`) a near relation could have entered
    # through. Same verdict, same score, same relation; only the sentence
    # grew the coordinate that governs it.
    # SAME PAIR, SAME SCORE, SAME COUNT — A DIFFERENT REASON, and the new
    # one is the more fundamental (2026-08-23, doctrine 17). This pinned
    # ~~"CONSONANCE not rhyme (conjunctive band; not in the declared admit
    # set)"~~, which was the answer while the default door held only the two
    # rhyme relations: the pair cleared nothing and was refused on the
    # RELATION. The door widened to all four on 2026-08-22 (M-59), so
    # CONSONANCE is admitted now and the relation no longer refuses
    # anything here. The pair still violates, and it violates on the
    # SCALAR: 0.729 is under theta_rhyme 0.75.
    #
    # THAT IS THE DISTINCTION WORTH KEEPING, and it is finer than the first
    # draft of this comment claimed. That draft said the demo's verdict is
    # "door-invariant" and asserted the whole violation tuple was
    # byte-identical under a narrowed door. MEASURED, it is not: narrowing
    # to ("RHYME", "RIME_RICHE") puts the reason back to "CONSONANCE not
    # rhyme (... not in the declared admit set)". So `admits()`'s two
    # clauses BOTH refuse this pair and the RELATION clause is the one that
    # answers first when it applies.
    #
    # What IS door-invariant is the PAIR: (1, 2) violates at 0.729 under
    # every declared door, because 0.729 is under theta_rhyme and no admit
    # set widens past a scalar. What moves is WHICH clause says so, and
    # that is worth an assertion of its own rather than a claim of
    # sameness — the reason string is what a writer acts on.
    # REPINNED AGAIN 2026-08-25 (M-116): under the whole-vocabulary
    # DEFAULT the pair no longer violates at all — dawn/again stand in the
    # consonance schema, judged categorically, and the rescue moves the
    # pair to `pairs_schema_satisfied` with the schemas that answered. The
    # scalar-vs-relation distinction the ladder above records is still
    # real and is now measured where it still exists: under DECLARED
    # doors, which the rescue does not override
    # (`lyric_harness.admit_is_default`, doctrine 1). A 3-relation
    # narrowing that still admits CONSONANCE refuses on the SCALAR; the
    # 2-relation rhyme-only door refuses on the RELATION.
    check("under the whole-vocabulary DEFAULT the demo's old violation is "
          "SATISFIED by schema, and the rescue says which one answered",
          d["violations"] == []
          and any(s["lines"] == (1, 2) and "consonance" in s["satisfied_by"]
                  for s in d["pairs_schema_satisfied"]),
          str(d["violations"]) + " :: "
          + str(d.get("pairs_schema_satisfied")))
    from lyric_harness import Declaration as _Decl
    _scal = check_scheme(LEX, demo, "AABB",
                         _Decl(admit=("CONSONANCE", "RHYME", "RIME_RICHE")))
    _narrow = check_scheme(LEX, demo, "AABB",
                           _Decl(admit=("RHYME", "RIME_RICHE")))
    check("...and under a DECLARED door the SAME pair still violates at "
          "the SAME score, with WHICH clause refusing it set by the door — "
          "relation under a rhyme-only door, scalar under one that admits "
          "CONSONANCE; a writer acts on the reason, so the two are not one "
          "answer, and neither is silently overridden by the default's "
          "rescue (doctrine 1)",
          [v[:3] for v in _narrow["violations"]]
          == [v[:3] for v in _scal["violations"]]
          == [(1, 2, 0.729)]
          and "admit set" in _narrow["violations"][0][3]
          and "theta_rhyme" in _scal["violations"][0][3],
          f"narrowed: {_narrow['violations'][0][3]!r}; "
          f"scalar-door: {_scal['violations'][0][3]!r}")
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
    # REPINNED 2026-08-20: 143 -> 388 (the Modern Scottish Minstrel mass
    # load, rev-2 restage)
    # REPINNED 2026-08-20 (Tier-1 concurrent load): 388 -> 622 files.
    # REPINNED 2026-08-20 (Phase-1): 622 -> 616 -> 1049 files.
    # REPINNED 2026-08-20 (Montgomery twin): 1049 -> 1048. Every
    # readability RATE below is unmoved: the merge rehoused 6 items and
    # changed no verse byte, so only the file count moves. That the rates
    # hold across a merge is the check that it was a merge.
    check("1297 ENGLISH song files present", len(paths) == 1297, f"{len(paths)}")
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
    # REPINNED 2026-08-19 (batches 1-2): 151894 -> 152911 -> 153224 lines.
    # REPINNED 2026-08-20 (the Minstrel mass load, 245 files / 812 songs
    # after the same sitting's rev-2 restage): 153224 -> 179193 countable
    # lines. THE RATE MOVES AND THE MOVE IS THE
    # CORPUS, NOT A RULE: token-unreadable rises 5.94% -> 6.51% because the
    # new files are SCOTS -- kye/waes/gudeman are exactly what CMUdict
    # cannot read, the same reason Barnes and Burns were already this
    # corpus's refusal concentration (doctrine 67: measure WHERE it falls).
    # REPINNED 2026-08-20 (Phase-1): 194833 -> 249254 countable lines,
    # and the token rate falls again, 6.23% -> 5.88%: Oxford and Poems
    # of American History are standard literary English, so they
    # dilute the Scots concentration the Minstrel load created. The
    # direction is the corpus's composition, never a rule change.
    # REPINNED 2026-08-20 (Tier-1 concurrent load): 179193 -> 194935
    # countable lines, and the token rate FALLS 6.51% -> 6.23% — the same
    # doctrine-67 argument in the other direction: the five Tier-1
    # anthologies are mostly standard literary English (American, Victorian,
    # Elizabethan), so the Scots concentration the mass load created is
    # diluted, not repaired.
    # REPINNED 2026-08-21 — THE TOKENISER'S LETTER REPERTOIRE, and every
    # figure in this block moves for one reason. `lyric_harness.line_tokens`
    # and `Lexicon.transcribe` both matched `[A-Za-z...]` until this date, so
    # a printed English word carrying a diacritic was not one word to this
    # harness: Barnes's `A-baggèn` tokenised as `A-bagg` + `n`, `jaÿ` as `ja`,
    # and Welsh printed in an `eng_` file gave `tân` -> `t` + `n`, END WORD
    # `n`. `LATIN_SCRIPT` is the declared repertoire now (0 Latin-named
    # letters in `corpus/` fall outside it) and every count here is the
    # harness looking at the RIGHT WORD for the first time.
    #
    # THE DIRECTION IS UP AND THAT IS THE POINT (doctrine 79 — a refusal is
    # not a failure). The end-word refusal rate rises 5.74% -> 6.2611%
    # because a fragment that CMUdict happened to list (`n`, `ja`) used to
    # read, and the whole word honestly does not. Nothing was lost: the
    # sonnet battery is byte-identical either side (1064/1014/50/82) because
    # `corpus/sonnets.txt` is pure ASCII, which is the control that says this
    # moved only what was already wrong.
    #
    # AND THE TWO HALVES HAD TO MOVE TOGETHER. With `line_tokens` widened and
    # `Lexicon.transcribe` not, the two DISAGREED about what a word is, and
    # `line_anchors` glued transcribe's two letter-name syllables (T-IY,
    # EH-N) onto line_tokens' one word `tân` and reported the line READABLE —
    # anchored on a spelling-out of its own rhyme word. `substituted_silent`
    # went 2 -> 1,462 under the half-fix and is back at 2 with both sites on
    # the one definition, which is the number that proves they agree.
    #
    # -14 on `lines_countable` is NOT this change: it is the 14 pìobaireachd
    # movement headings that stopped being verse lines the same sitting
    # (`MISSING.md` M-25(a)).
    check("countable lines 282731 — VERSE ONLY, now that apparatus lines "
          "are excluded at the source instead of subtracted by hand, and "
          "under the CENTRE's `---` rather than a second `--- ` of our own",
          r["lines_countable"] == 282731,
          f"{r['lines_countable']}  (282745 before the LATIN_SCRIPT repin; 179193 before the Tier-1 load; 153224 "
          f"before the mass load; 151894 before Pass-1)")
    check("unreadable end word, cause TOKEN, 17274 — UP from 15958, because a "
          "fragment CMUdict happened to list is no longer the end word",
          r["unreadable_final_token"] == 17274,
          f"{r['unreadable_final_token']} ({r['rate_token']:.4%})  "
          f"(15958 before the LATIN_SCRIPT repin; 11658 before the Tier-1 load)")
    check("rate on that quantity is 6.11% — UP from 5.64%, and the rise is the "
          "harness reading the whole word instead of an ASCII fragment",
          abs(r["rate_token"] - 0.061097) < 1e-5,
          f"{r['rate_token']:.4%}  (5.6440% before the LATIN_SCRIPT repin; "
          f"6.5065% before the Tier-1 load)")
    check("unreadable end word, cause PIECE, 428 — the price of the hyphen "
          "refusal on VERSE lines alone",
          r["unreadable_final_piece"] == 428,
          f"{r['unreadable_final_piece']}  (260 before the LATIN_SCRIPT repin)")
    check("so the end-word refusal rate is 6.26% AFTER the rule and 6.11% "
          "before it, and both are printed",
          r["unreadable_final"] == 17702 and abs(r["rate"] - 0.062611) < 1e-5,
          f"{r['unreadable_final']} ({r['rate']:.4%})")
    check("16712 of those would have had the rhyme word SUBSTITUTED by an "
          "earlier word", r["substituted_end_word"] == 16712,
          f"{r['substituted_end_word']}  (15405 before the LATIN_SCRIPT repin)")
    # THE SUBSET CLAIM, PINNED 2026-08-14 — and it is pinned because it is
    # FALSE. `substitution_report`'s docstring called itself "a strict subset
    # of the unreadable-final lines" from the day it was written; nothing
    # checked it, and wiring the finding into `report` is what made it worth
    # checking. Two lines of 151,894 are substitutions on a final token that
    # READS: `mm` transcribes to ['M'] and a lone consonant syllabifies to
    # nothing, so `word_syllable_map` drops it exactly as it drops an OOV
    # word while `line_anchors` still returns an anchor built on the previous
    # word. TWO COUNTS, NEVER SUMMED (doctrine 79): the first is the
    # population whose LINE was already flagged and whose WORD was not, the
    # second is the population NOTHING in this module reached before the
    # wiring. If `substituted_silent` ever moves, either the corpus changed
    # or `line_anchors` did, and both are things a reader needs told.
    check("16710 + 2, not 16712 + 0 — the substitution is NOT a subset of "
          "the unreadable-final lines, and the 2 are the only lines in this "
          "module that no other finding reaches",
          r["substituted_flagged"] == 16710 and r["substituted_silent"] == 2,
          f"{r['substituted_flagged']} already flagged as a LINE by "
          f"UNREADABLE_END_WORD (the gap there was only the WORD) + "
          f"{r['substituted_silent']} reached by nothing "
          f"(Byron's `...on the turf,[mm]` and D'Urfey's `_Sh----_`)")
    check("and the complement is the larger half and is not a defect: 992 "
          "unreadable-final lines are NOT substitutions",
          r["unreadable_final"] - r["substituted_flagged"] == 992
          and r["unreadable_final_piece"] == 428,
          f"{r['unreadable_final'] - r['substituted_flagged']} = 233 cause "
          f"PIECE (`hill-zide` keeps its own token in the syllable map, so "
          f"nothing is substituted) + 482 where no earlier word read either")
    check("the rate is not uniform across files — a subset rate is a "
          "different number",
          max(d["rate"] for d in r["per_file"]) > 0.20
          and min(d["rate"] for d in r["per_file"]) == 0.0,
          "51.11% (George Macindoe, a mass-loaded file of dense Scots — "
          "`leeing`/`preeing`/`kebbocks` — displacing Edwin Waugh's "
          "23.62%) to 0.0% (68 files, all readable); quoting one "
          "corpus-wide figure without the file set is doctrine 58")

    # THE POSITION INVARIANT, CORPUS-WIDE. Test 9 pins it on four named lines;
    # this pins the population those lines were drawn from, and it costs
    # nothing because `corpus_rate` computes it in the pass it was already
    # making (a second sweep would derive the population from a second
    # definition, which is how a record and a behaviour drift apart).
    #
    # 323 = 174 + 149 was CLAUDE.md's own split, measured at the 143-file
    # corpus, and it reproduced exactly until the corpus grew. REPINNED
    # 2026-08-20 at the 388-file corpus: 367 = 192 + 175 (the mass-loaded
    # Scots files carry their own hyphenated end words — `heigh-ho` among
    # them). The number that matters is unchanged in kind:
    # `interior_misfiled` is the raw overlap count and 0 of them are
    # unexplained by an earlier token. 0 is what "derived by POSITION" means
    # measured rather than asserted, and it is the direct successor to the
    # 328 of 328.
    check("the hyphen population is 638 end tokens with a read piece and an "
          "unread piece (CLAUDE.md's 323 was this figure at the 143-file "
          "corpus)",
          r["final_piece_population"] == 638,
          f"{r['final_piece_population']}")
    check("split 428 ANCHOR-layer (refused) + 210 REPORT-layer (label "
          "overstates, never refused)",
          r["unreadable_final_piece"] == 428 and r["label_overstates"] == 210,
          f"{r['unreadable_final_piece']} + {r['label_overstates']}")
    check("0 of 323 have an end-word piece misfiled as interior — the "
          "328-of-328 defect, measured at zero",
          r["interior_misfiled_unexplained"] == 0,
          f"{r['interior_misfiled_unexplained']} unexplained of "
          f"{r['interior_misfiled']} raw overlaps")
    check("and the 10 raw overlaps are REAL double occurrences, not "
          "misfilings — reported separately rather than summed (doctrine 79)",
          r["interior_misfiled"] == 10,
          f"{r['interior_misfiled']}: all eight are the same refrain shape — "
          f"Kingsley's `Sing heigh-ho, and heigh-ho!` x4 and the mass-loaded "
          f"David Macbeth Moir's `Sing heigh-ho! sing heigh-ho!--` x4 — "
          f"where `heigh` is an interior token's unread piece AND the end "
          f"token's; suppressing them would delete a real interior gap "
          f"(doctrine 24)")

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
    ("SUBSTITUTED_END_WORD", "eng_british_lord_byron.txt",
     "And the foam of his gasping lay white on the turf,[mm]",
     "the RESIDUE, and the only case in this module where NO OTHER FINDING "
     "FIRES AT ALL. `mm` transcribes to ['M'] -- it READS -- and a lone "
     "consonant syllabifies to nothing, so `word_syllable_map` drops it "
     "exactly as it drops an OOV word while `line_anchors` still returns an "
     "anchor, built on `turf`. `final_unreadable` is therefore False and "
     "every other code in this file stays silent. 2 lines of 151,894 in the "
     "143 English song files; invented relation #4 of the module docstring "
     "at a site `unread_final_piece` does not reach"),
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
    check("report() emits exactly the five codes this file has cases for",
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
    # REPINNED 2026-08-21, 29 -> 118, AND THE FOURFOLD RISE IS THE FINDING.
    # Under `[A-Za-z]` an `a-` participle carrying Barnes's grave accent was
    # not ONE end token at all: `A-baggèn` tokenised as `A-bagg` + `n`, so the
    # END WORD was `n`, CMUdict listed it, and the line read clean. Only the
    # 29 participles that happen to be pure ASCII ever reached this class.
    # With `LATIN_SCRIPT` the whole word is the end token, its last piece is
    # unread, and the manufactured class this section measures is four times
    # the size the record claimed. The check below is UNMOVED and still
    # passes: all 118 still yield the IDENTICAL would-be anchor, because the
    # only piece that reads is still the participial prefix's schwa.
    check("118 distinct `a-` participles end a line in this one file with "
          "their last piece unread", len(klass) == 118,
          f"{len(klass)}: {sorted(klass)[:6]} ... (29 before the "
          f"LATIN_SCRIPT repin, and the other 89 were not even ONE token)")
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


def test_the_letter_repertoire_is_declared_and_the_two_sites_agree():
    """§10 — `LATIN_SCRIPT`, added 2026-08-21, and the invariant that makes it
    safe.

    `line_tokens` and `Lexicon.transcribe` each carried their OWN
    `[A-Za-z...]` class. Widening one and not the other is worse than leaving
    both wrong, because the two then DISAGREE ABOUT WHAT A WORD IS: measured
    while it was half-fixed, `line_tokens` said `tân` was one word,
    `transcribe` said `t` + `n`, and `line_anchors` glued transcribe's two
    LETTER-NAME syllables (T-IY, EH-N) onto the one word and reported the
    Welsh line READABLE — anchored on a spelling-out of its own rhyme word.
    `substituted_silent` went 2 -> 1,462 under that state, which is what
    caught it.

    So the binding check here is not that either site is Unicode. It is that
    they AGREE, on a line only a widened repertoire can read."""
    print("\n10. the letter repertoire is DECLARED, and both readers use it")
    import lyric_harness as LH
    from quality import readability as RD

    check("LATIN_SCRIPT is a compiled pattern on lyric_harness, not a local",
          hasattr(LH, "LATIN_SCRIPT") and hasattr(LH.LATIN_SCRIPT, "search"),
          getattr(LH, "LATIN_SCRIPT", None))

    # 1. THE REPERTOIRE IS MEASURED. Over every letter in `corpus/`, not one
    #    whose Unicode name begins LATIN falls outside the declared ranges.
    import unicodedata
    missed = sorted({c for c in
                     "ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÑÒÓÔÕÖØÙÚÛÜÝßàáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ"
                     "ĀāăĂĄąĆćČčĎďĐđĒēĔĕĖėĘęĚěŁłŃńŇňŌōŐőŒœŘřŚśŞşŠšŤťŪūŮůŰűŸŹźŻżŽž"
                     "ȳṁṅṛṣṭĀīūḥṃśḍṇḷ"
                     if not LH.LATIN_SCRIPT.match(c)})
    check("every Latin-script letter this corpus prints is inside the class",
          not missed, missed)
    for c in "歸ωاΖ":
        check("%r is NOT in the Latin class" % c,
              not LH.LATIN_SCRIPT.match(c), c)

    # 2. THE INVARIANT. One line, two readers, one answer.
    # THE FIRST DRAFT OF THIS CHECK COULD NOT FAIL, and it is recorded rather
    # than quietly replaced. It called `LEX.transcribe(line)`, DISCARDED the
    # result, and then compared `line_tokens` against a whitespace split — so
    # a check named "line_tokens and transcribe agree" was not asking
    # `transcribe` anything at all. That is the shape this file's own
    # discipline section exists to stop, and it survived mutation M2 (the
    # exact disagreement it is named for) for that reason.
    #
    # THE DISCRIMINATING SIGNAL is that a word `line_tokens` returns as ONE
    # token must reach `transcribe` as one token too. When it does and CMUdict
    # cannot read it, the WHOLE WORD appears in transcribe's OOV list. Under
    # an ASCII `transcribe`, `tân` is split into `t` and `n`, CMUdict lists
    # both as letter names, and the word is absent from OOV entirely — which
    # is how the harness came to report a Welsh line readable, anchored on a
    # spelling-out of its own rhyme word.
    LEX = Lexicon()
    for line, word in (("SION a Sian, oddeutu'r tân,", "tân"),
                       ("You gie'd me life, you gie'd me jaÿ,", "jaÿ")):
        toks = LH.line_tokens(line)
        _ph, _all, oov = LEX.transcribe(line)
        check("line_tokens returns %r as ONE token and transcribe reports "
              "that same whole word OOV — the two readers agree" % word,
              word in toks and word in oov, (toks, oov))

    check("the Welsh end word is `tân`, not `n`",
          LH.raw_final_token("SION a Sian, oddeutu’r tân,") == "tân",
          LH.raw_final_token("SION a Sian, oddeutu’r tân,"))
    check("Barnes's end word is `jaÿ`, not `ja`",
          LH.raw_final_token("You gie'd me life, you gie'd me jaÿ,") == "jaÿ",
          LH.raw_final_token("You gie'd me life, you gie'd me jaÿ,"))

    # 3. AND THE HONEST CONSEQUENCE, which is the point of the whole change:
    #    the whole word is now REFUSED rather than a fragment being scored.
    r = RD.readability_records(LEX, ["SION a Sian, oddeutu’r tân,"])[0]
    check("`tân` is refused as cause TOKEN — an honest refusal, not a "
          "fragment scored (doctrine 79)",
          r["final_unreadable"] and r["final_unreadable_cause"] == "token",
          (r["final_unreadable"], r["final_unreadable_cause"]))

    # 4. THE ASCII CONTROL. Nothing that was already right may move — this is
    #    why the sonnet battery is byte-identical (1064/1014/50/82).
    for line in ("Shall I compare thee to a summer's day?",
                 "Of hill-zide an' the wife-zide",
                 "word--word and --and"):
        old = [t for t in re.findall(r"[A-Za-z'\-]+", line)
               if re.search(r"[A-Za-z]", t)]
        check("pure-ASCII line unmoved: %r" % line[:34],
              LH.line_tokens(line) == old, (LH.line_tokens(line), old))

    # 5. THE SILENCE HAS A NAME NOW (doctrine 20).
    out = LH.letters_outside_repertoire("歸。 Ζωή است")
    check("letters_outside_repertoire names the scripts it cannot read",
          out == {"CJK": 1, "GREEK": 3, "ARABIC": 3}, out)
    check("and it is empty for a line the repertoire covers",
          LH.letters_outside_repertoire("jaÿ and tân") == {},
          LH.letters_outside_repertoire("jaÿ and tân"))


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


#: THE RUNNER IS AN EXPLICIT LIST, AND AN EXPLICIT LIST SILENTLY DROPS A NEW
#: SECTION. `test_the_letter_repertoire_is_declared_and_the_two_sites_agree`
#: was written, was correct, and did not run: the suite printed
#: `all regressions pass` over 111 checks with a whole section unexecuted, and
#: that is indistinguishable from a section that passed. Doctrine 48 inside
#: the file that pins doctrine-48 defects. The list stays (its ORDER is the
#: document's numbered sections, which a `sorted(globals())` sweep would
#: scramble), and the guard below makes the omission loud instead.
def _every_section_runs(listed):
    missing = sorted(k for k, v in globals().items()
                     if k.startswith("test_") and callable(v)
                     and v not in listed)
    check("every `test_*` in this file is in the runner's list — an "
          "explicit list that silently drops a section prints the same "
          "`all pass` as one that ran it", not missing, missing)


if __name__ == "__main__":
    for fn in (test_readable_pairs_are_untouched,
               test_constructed_oov_final,
               test_real_corpus_line,
               test_nothing_was_lost_on_the_sonnets,
               test_corpus_song_rate_is_pinned,
               test_zero_syllable_word_has_no_anchor,
               test_every_emitted_code_has_a_case,
               test_the_manufactured_rhyme_is_refused,
               test_the_letter_repertoire_is_declared_and_the_two_sites_agree,
               test_interior_is_derived_by_position):
        fn()
    _every_section_runs((
        test_readable_pairs_are_untouched, test_constructed_oov_final,
        test_real_corpus_line, test_nothing_was_lost_on_the_sonnets,
        test_corpus_song_rate_is_pinned, test_zero_syllable_word_has_no_anchor,
        test_every_emitted_code_has_a_case,
        test_the_manufactured_rhyme_is_refused,
        test_the_letter_repertoire_is_declared_and_the_two_sites_agree,
        test_interior_is_derived_by_position))
    print("=" * 68)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all readability / recorded-refusal regressions pass")
