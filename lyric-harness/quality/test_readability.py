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
    check("violations + refusals == the recorded pre-fix 123",
          viol + ref == 123,
          f"{viol} + {ref} -- nothing was invented and nothing vanished")
    check("50 of the recorded 123 were REFUSALS, not rhyme failures",
          ref == 50,
          "40.7% of the sonnet battery's headline violation count was "
          "CMUdict failing to read Shakespeare, reported as Shakespeare "
          "failing to rhyme")
    check("the violation count is 73", viol == 73)
    check("the judged denominator is 1014", judged == 1014,
          f"{judged}: a violation RATE is 73/1014 = "
          f"{73/1014:.1%}, not 123/1064 = 11.6%")


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
    check("countable lines 190804", r["lines_countable"] == 190804,
          f"{r['lines_countable']}")
    check("unreadable end word 10051", r["unreadable_final"] == 10051,
          f"{r['unreadable_final']} ({r['rate']:.4%})")
    check("rate is 5.27%", abs(r["rate"] - 0.052677) < 1e-5,
          f"{r['rate']:.4%}")
    check("9812 of those would have had the rhyme word SUBSTITUTED by an "
          "earlier word", r["substituted_end_word"] == 9812,
          f"{r['substituted_end_word']}")
    check("the rate is not uniform across files — a subset rate is a "
          "different number",
          max(d["rate"] for d in r["per_file"]) > 0.20
          and min(d["rate"] for d in r["per_file"]) < 0.005,
          "20.08% (Edwin Waugh) to under 0.5%; quoting one corpus-wide "
          "figure without the file set is doctrine 58")


if __name__ == "__main__":
    for fn in (test_readable_pairs_are_untouched,
               test_constructed_oov_final,
               test_real_corpus_line,
               test_nothing_was_lost_on_the_sonnets,
               test_corpus_song_rate_is_pinned):
        fn()
    print("=" * 68)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING:")
        for f in FAILURES:
            print(f"  - {f}")
        sys.exit(1)
    print("all readability / recorded-refusal regressions pass")
