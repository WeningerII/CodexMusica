#!/usr/bin/env python3
"""Span provenance — does the number, its label and its evidence agree?

BACKLOG adversary 7, item 1.2. `line_anchors` returns SEVERAL candidate anchor
spans per line; `best_score` takes the max over all pairs of them; every
consumer then printed that number beside `endwords[i]/endwords[j]`. When the
winning span is an interior mosaic reach the report names a pair that had
nothing to do with the number — `go/receipt 0.579` was `get to go` against the
last syllable of `receipt`. Doctrine 45: a checker that silently picks a
coordinate is making a claim it never states.

WHAT IS PINNED HERE

1. the original bad report line, as a REPRODUCTION rather than a description
2. every syllable `line_anchors` produces carries the word it came from
3. `best_score` names the winning span pair and the size of the search
4. `search_k` is recorded — doctrine 56's precondition, since a max over k
   hypotheses needs a null under the same search and you cannot build one
   without knowing k
5. a tie at the maximum is REPORTED, because then the named span is one of
   several and picking in silence is the same defect one level down
6. the provenance is ABSENT rather than invented when an anchor was built
   outside `line_anchors`
7. the consumers actually print it: check_scheme, the graph, the chains
8. THE SONNET ORACLE DOES NOT MOVE — this is a reporting change

and, added 2026-08-11 when the floor turned out not to be the ceiling:

10. THE SPANS CANNOT BE SEPARATED FROM THE NUMBER. Carrying them as a KEY met
   the acceptance and not the point: a key is a flag, and a flag gets dropped.
   `best_score` returns a `Scored` whose TYPE is the marker (the `Readings`
   precedent) and whose `spans` cannot be deleted, popped, or replaced by
   anything that is not an `Attribution` (the `FitRefusal.__bool__` precedent:
   the separation RAISES rather than quietly succeeding).
11. the report line CHECKS ITS OWN CLAIM. `report_pair` renders the number and
   the two words a caller wants beside it in one call, and says so when they
   are not the pair that was compared.
12. the five-way span partition, and the SUBSTITUTED member of it: a
   hyphenated token whose pieces did not all reach the lexicon is a label
   naming a string the harness never read — `hill-zide` anchored on `hill`.
   Found by the G2P cell over the song corpus, folded in here because it is
   `go/receipt` one level down, and pinned on the SONNETS, where it also
   occurs and where nothing was looking for it.
13. the sweep itself: `quality/audit_spans.py`, adversary 7's instrument, and
   the numbers it reports over the oracle.

and, separately (BACKLOG 2.4), that the refrain-pointer stub is not an English
printing convention and its language is a declared coordinate.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as lh  # noqa: E402

LEX = lh.Lexicon()
DECL = lh.Declaration()
FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def anchors(text, promote=False):
    return lh.line_anchors(LEX, text, promote=promote)[0]


# ---------------------------------------------------------------------------

def test_the_original_bad_report_line():
    print("\n1. the report line that started this: `go/receipt 0.579 RHYME`")
    aa = anchors("I don't get to go")
    bb = anchors("how they read the address like a receipt")
    s = lh.best_score(aa, bb, DECL, "go", "receipt")
    check("the number is still 0.579 — nothing about the verdict moves",
          s["total"] == 0.579, f"total {s['total']}  relation {s['relation']}")
    sp = s["spans"]
    check("the winning LEFT span is the mosaic reach, not the end word",
          sp["a"]["words"] == ["get", "to", "go"], sp["a"]["text"])
    check("the winning RIGHT span is part of a word, and says which part",
          sp["b"]["words"] == ["receipt"] and sp["b"]["partial_word"]
          and sp["b"]["runs"][0]["syllables"] == 1
          and sp["b"]["runs"][0]["word_syllables"] == 2,
          lh.span_label(sp["b"]))
    check("the pair is flagged MOSAIC on the left only",
          sp["mosaic"] and sp["mosaic_a"] and not sp["mosaic_b"])
    note = lh.spans_note(s)
    check("and the printable note names both spans and the search size",
          "get to go" in note and "receipt" in note and "k=6" in note,
          note)


def test_every_syllable_knows_its_word():
    print("\n2. anchors carry word provenance, and it is derived from the "
          "NUCLEUS")
    for ancs in (anchors("I don't get to go"),
                 anchors("how they read the address like a receipt"),
                 anchors("the cattle waded through the silt")):
        assert ancs
        for a in ancs:
            for syl in a:
                if "widx" not in syl:
                    check("every syllable is tagged", False, str(syl))
                    return
    check("every syllable of every candidate anchor is tagged", True,
          "word, widx, syl_in_word, word_syllables")
    # syllabify maximises the onset of the NEXT syllable, so consonants cross
    # word boundaries and the vowel is the only phone whose word is certain.
    a = anchors("a nation")[0]
    check("a word's own syllable count is recorded, not the span's",
          all(s["word_syllables"] == 2 for s in a if s["word"] == "nation"),
          f"{[(s['word'], s['syl_in_word'], s['word_syllables']) for s in a]}")
    # the promoted variant is a COPY of the last syllable and must keep its tag
    prom = anchors("I don't get to go", promote=True)
    check("the metrically-promoted variant keeps its word tag",
          all("widx" in s for a in prom for s in a),
          f"{len(prom)} candidates with promotion on")


def test_search_size_is_recorded():
    print("\n3. doctrine 56 — a max over k hypotheses records k")
    aa = anchors("I don't get to go")
    bb = anchors("how they read the address like a receipt")
    s = lh.best_score(aa, bb, DECL, "go", "receipt")
    sp = s["spans"]
    check("search_k is the product of the two candidate counts",
          sp["search_k"] == len(aa) * len(bb) == sp["candidates_a"]
          * sp["candidates_b"],
          f"k={sp['search_k']} = {len(aa)} x {len(bb)}")
    check("`beat` is how many candidates the winner beat",
          sp["beat"] == sp["search_k"] - 1)
    check("the winning anchors themselves are returned, not just their words",
          sp["anchor_a"] in aa and sp["anchor_b"] in bb)
    check("a max over k is not a max over 1 here — the search is real",
          sp["search_k"] > 1,
          "so a bare maximum quotes a search back at itself until k is known")


def test_a_tie_at_the_maximum_is_reported():
    print("\n4. a tie means the named span is ONE of several")
    # A REAL tie from the oracle, not a constructed one: sonnet 1 L1-L2, where
    # `increase` and `die` each carry two dictionary readings and two of the
    # eight pairings reach the same maximum. `best_score` keeps the FIRST, and
    # a report that named it without saying it had a twin would be doctrine
    # 45's defect one level down.
    aa = anchors("From fairest creatures we desire increase,")
    bb = anchors("That thereby beauty’s rose might never die,")
    s = lh.best_score(aa, bb, DECL, "increase", "die")
    sp = s["spans"]
    check("a real oracle pair with two spans at the maximum reports the tie",
          sp["search_k"] == 8 and sp["tied_at_max"] == 2,
          f"{sp['tied_at_max']} tied of k={sp['search_k']}")
    check("and the printed note says so",
          "tied at the max" in lh.spans_note(s), lh.spans_note(s))
    # a clean win must NOT claim a tie
    s2 = lh.best_score(anchors("the cat"), anchors("a hat"), DECL,
                       "cat", "hat")
    check("a single-winner pair does not claim one",
          s2["spans"]["tied_at_max"] == 1,
          f"{s2['spans']['tied_at_max']} of {s2['spans']['search_k']}")
    check("`tied_at_max` counts pairs at the max, so it is never 0",
          s["spans"]["tied_at_max"] >= 1 and s2["spans"]["tied_at_max"] >= 1)


def test_provenance_is_absent_rather_than_invented():
    print("\n5. an anchor built elsewhere gets NO provenance, not a guess")
    # quality/eval_matrix.py builds anchors with anchor(syllabify(...)) and
    # calls best_score on them. Those syllables have no word tags, and a
    # provenance record that is sometimes invented is worse than one that is
    # sometimes absent.
    raw = lh.anchor(lh.syllabify(LEX.transcribe("nation")[0]))
    s = lh.best_score([raw], [raw], DECL, "nation", "nation")
    check("span_provenance returns None on an untagged anchor",
          lh.span_provenance(raw) is None)
    check("best_score still returns a `spans` record with the search size",
          s["spans"]["search_k"] == 1 and s["spans"]["a"] is None)
    check("spans_note degrades to `?` rather than naming a word it cannot see",
          "?" in lh.spans_note(s), lh.spans_note(s))
    check("an empty anchor has no provenance", lh.span_provenance([]) is None)
    check("spans_note on a score with no spans key is empty",
          lh.spans_note({"total": 1.0}) == ""
          and lh.spans_note(None) == "")


def test_the_consumers_print_it():
    print("\n6. every consumer that pairs a number with a word carries it")
    # Shakespeare 9, L10 / L12: `enjoys it` ~ `destroys it`, reported for the
    # life of the project as `it/it REPEAT`. A real mosaic rhyme carrying a
    # verdict about a pronoun.
    lines = ["Look what an unthrift in the world doth spend",
             "The wretched enjoys it",
             "But beauty's waste hath in the world an end",
             "That which he destroys it"]
    res = lh.check_scheme(LEX, lines, "ABAB", DECL)
    check("check_scheme.pair_scores carries `spans` on every pair",
          all("spans" in p for p in res["pair_scores"]),
          f"{len(res['pair_scores'])} pairs")
    check("...and a rendered `spans_note` beside it",
          all("spans_note" in p for p in res["pair_scores"]))
    p24 = next(p for p in res["pair_scores"] if p["lines"] == (2, 4))
    check("the endwords and the scored spans are SEPARATE fields, and they "
          "DIFFER on the case that named this defect",
          p24["endwords"] == ("it", "it")
          and p24["spans"]["a"]["words"] == ["enjoys", "it"]
          and p24["spans"]["b"]["words"] == ["destroys", "it"],
          f"endwords {p24['endwords']} score {p24['score']} "
          f"{p24['relation']}  ::  {p24['spans_note']}")
    check("the printed note is non-empty exactly where there is provenance",
          bool(p24["spans_note"]))

    g = lh.rhyme_graph(LEX, lines, DECL, theta=0.5)
    check("rhyme_graph found edges to report on", len(g["edges"]) > 0,
          f"{len(g['edges'])} edges")
    check("rhyme_graph edge tuples keep their 4-field shape",
          all(len(e) == 4 for e in g["edges"]),
          "test_readability pins `g['edges'] == [(2, 3, 1.0, 'RHYME')]`, so "
          "a fifth field would break a reader that unpacks it")
    check("...and edge_spans is index-aligned with edges and carries a note",
          len(g["edge_spans"]) == len(g["edges"])
          and all(g["edge_spans"][k]["nodes"] == (e[0], e[1])
                  and g["edge_spans"][k]["note"]
                  for k, e in enumerate(g["edges"])),
          str(g["edge_spans"][0]["note"]) if g["edge_spans"] else "")

    chains = lh.infer_chains(LEX, lines, DECL, theta_chain=0.5)
    check("infer_chains reports which of a chain's pairs were mosaic",
          all("mosaic_pairs" in c for c in chains),
          "mean_coherence is a mean over pairs and the endwords beside it "
          "are only the pairs' labels")
    # Sonnet 17: the chain eyes/lies/age/rage has a mean_coherence printed
    # beside four end words, and one of its pairs was scored on `poet lies`
    # against `poet's rage` — a mosaic contribution to a number labelled with
    # bare monosyllables.
    import battery
    s17 = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))[16]
    got = [m for c in lh.infer_chains(LEX, s17, DECL)
           for m in c["mosaic_pairs"]]
    check("...and on a real chain it names the mosaic pairs behind the mean",
          any("poet lies" in m["note"] for m in got),
          str([m["note"] for m in got][:1]))


def test_the_oracle_does_not_move():
    print("\n7. this is a REPORTING change: no verdict may move")
    import battery
    sonnets = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))
    check("152 sonnets parse", len(sonnets) == 152, f"{len(sonnets)}")
    mandated = judged = refused = viol = 0
    mosaic_scored = 0
    for sn in sonnets:
        res = lh.check_scheme(LEX, sn, "ABABCDCDEFEFGG", DECL)
        mandated += res["pairs_mandated"]
        judged += res["pairs_judged"]
        refused += res["pairs_refused"]
        viol += len(res["violations"])
        by_pair = {p["lines"]: p for p in res["pair_scores"]}
        for v in res["violations"]:
            sp = by_pair[(v[0], v[1])]["spans"]
            if sp and sp["mosaic"]:
                mosaic_scored += 1
    check("mandated pairs 1064", mandated == 1064, str(mandated))
    check("judged 1014", judged == 1014, str(judged))
    check("refused 50", refused == 50, str(refused))
    check("violations 81 (8.0% of judged)", viol == 81,
          f"{viol} ({viol / judged:.1%})")
    # This is the measurement the change exists to make. It is asserted as a
    # RANGE rather than a point so it fails on a structural change and not on
    # a corpus edit -- but it must never be zero, because zero would mean the
    # instrument is not looking.
    check("9 of the 81 violations were scored on a span that is NOT the "
          "end word", mosaic_scored == 9, f"{mosaic_scored} / {viol} "
          f"= {mosaic_scored / viol:.1%} of the oracle's violations named a "
          f"pair of words that did not produce their number")


def test_the_spans_cannot_be_separated_from_the_number():
    print("\n10. the spans are not a KEY on the score, they are the OBJECT")
    aa = anchors("I don't get to go")
    bb = anchors("how they read the address like a receipt")
    s = lh.best_score(aa, bb, DECL, "go", "receipt")
    check("best_score returns a Scored — the TYPE is the marker, so there is "
          "no flag to forget", isinstance(s, lh.Scored),
          f"{type(s).__name__}; and a Scored is still a dict, so every "
          f"existing reader works: {isinstance(s, dict)}")
    check("a single-pair `score` is NOT a Scored — the two are "
          "distinguishable by isinstance, not by remembering a key",
          not isinstance(lh.score(aa[0], bb[0], DECL, "go", "receipt"),
                         lh.Scored))
    for op, fn in (("del s['spans']", lambda: s.__delitem__("spans")),
                   ("s.pop('spans')", lambda: s.pop("spans")),
                   ("s['spans'] = None",
                    lambda: s.__setitem__("spans", None))):
        try:
            fn()
            check(f"{op} RAISES", False, "it did not")
        except TypeError:
            check(f"{op} RAISES rather than quietly succeeding", True)
    check("...and the record survived all three attempts",
          s["spans"]["a"]["words"] == ["get", "to", "go"])
    check("an Attribution is FROZEN: a provenance record that can be edited "
          "after the fact is one that can be invented",
          _raises(lambda: s["spans"].__setitem__("mosaic", False), TypeError)
          and _raises(lambda: s["spans"].update({"kind_a": "exact"}),
                      TypeError))
    check("the derived questions are on the object, not recomputed by each "
          "consumer", s.spans.differs and not s.spans.exact
          and s.spans.kinds == ("reach", "part"))
    check("`claims` evaluates the assertion a report line makes",
          not s.claims("go", "receipt"),
          "two words and a number on one line IS an assertion")
    check("str(Scored) cannot print a bare number",
          "get to go" in str(s) and str(s).startswith("0.579"), str(s)[:70])


def test_the_report_line_checks_its_own_claim():
    print("\n11. `report_pair` — one call renders the label AND the evidence")
    aa = anchors("I don't get to go")
    bb = anchors("how they read the address like a receipt")
    s = lh.best_score(aa, bb, DECL, "go", "receipt")
    out = lh.report_pair(s, "go", "receipt")
    check("the head line is the number beside the words, as before",
          out[0] == "(go/receipt): 0.579  NO_RELATION", out[0])
    check("and the line BELOW it says the named pair is not the evidence",
          any("NAMED PAIR IS NOT THE EVIDENCE" in ln for ln in out),
          out[1] if len(out) > 1 else "")
    check("naming which side and how", "reaches past `go`" in out[1]
          and "is part of `receipt`" in out[1], out[1])
    ok = lh.best_score(anchors("the cat"), anchors("a hat"), DECL,
                       "cat", "hat")
    check("a pair whose words ARE the evidence gets no banner",
          not any("NOT THE EVIDENCE" in ln
                  for ln in lh.report_pair(ok, "cat", "hat")),
          str(lh.report_pair(ok, "cat", "hat")))
    # The banner is graded and the COUNT is not: `part` alone is 380 of the
    # sonnets' 1014 judged pairs, so a banner on every one would train a
    # reader to skip the line that matters (doctrine 91).
    q = lh.best_score(anchors("dawn"), anchors("again"), DECL, "dawn", "again")
    r = lh.report_pair(q, "dawn", "again")
    check("an anchor cut alone is printed in the label and does NOT raise "
          "the banner — the rendering says less than the count, on purpose",
          not any("NOT THE EVIDENCE" in ln for ln in r)
          and "last 1 of 2 syllables" in r[-1]
          and not q.spans.exact, r[-1])


def test_a_hyphen_can_substitute_the_rhyme_word():
    print("\n12. SUBSTITUTED — the label names a string that was never read")
    # `Lexicon.transcribe` splits a token on its hyphens and looks each piece
    # up separately, so a compound whose pieces do not all read still yields
    # phones from the ones that do. Found by the G2P cell over the song
    # corpus; this is the same defect as `go/receipt` one level down, and the
    # first instrument that can SEE it is the span record.
    read, unread = lh.token_pieces(LEX, "hill-zide")
    check("token_pieces splits the compound and says which half read",
          read == ["hill"] and unread == ["zide"], f"{read} / {unread}")
    #
    # THE ANCHOR HALF IS A REFUSAL AS OF 2026-08-11 (cell AG), and this test
    # used to end with `line_readability` still saying READABLE. It was
    # written that way on purpose — cell AB's brief forbade moving a verdict —
    # and the decision was left open with its price attached. It is taken
    # here: the honest output when the harness cannot read the rhyme word is a
    # refusal, not a score against a different word (doctrine 79). The price
    # is in `quality/RESULTS_HYPHEN_REFUSAL.md`, measured on both populations.
    check("`unread_final_piece` is TRUE on `hill-zide`: the last piece is "
          "unread and an earlier one read",
          lh.unread_final_piece(LEX, "hill-zide") == (["hill"], ["zide"]),
          str(lh.unread_final_piece(LEX, "hill-zide")))
    check("and FALSE on `threshing-floor`, where the last piece IS the rhyme "
          "word — the report half, which is not refused",
          lh.unread_final_piece(LEX, "threshing-floor") == (None, None),
          str(lh.token_pieces(LEX, "threshing-floor")))
    a = anchors("Upon the zunny hill-zide")
    check("`line_anchors` now returns NO anchor for the line — the refusal is "
          "on the SHIPPED path, not only in the record, so `score` returns "
          "NO_ANCHOR to every caller and the two cannot drift apart",
          a == [], f"{len(a)} anchors")
    rec = lh.line_readability(LEX, "Upon the zunny hill-zide")
    check("`line_readability` says NOT readable, and names the cause `piece`",
          not rec["readable"] and rec["final_unreadable"]
          and rec["final_unreadable_cause"] == "piece",
          f"{rec['readable']} / {rec['final_unreadable_cause']}")
    check("the reason names the pieces both ways round and charges the "
          "LEXICON rather than the poet (doctrine 79)",
          "zide" in rec["reason"] and "hill" in rec["reason"]
          and "not the poet" in rec["reason"], rec["reason"])
    check("`zide` is NOT filed as an INTERIOR unreadable — it is part of the "
          "END word, and the two mean opposite things downstream "
          "(doctrine 28; the misfiling was 328 of 328 cases)",
          rec["interior_unreadable"] == []
          and rec["final_unread_pieces"] == ["zide"],
          f"interior {rec['interior_unreadable']}, "
          f"final pieces {rec['final_unread_pieces']}")
    #
    # AND THE `substituted` SPAN KIND IS STILL REACHABLE, which is the point
    # of checking it here: a doctrine whose demonstration has been optimised
    # away is a sentence nobody can check (doctrine 84). The REPORT half is
    # untouched by the refusal — the last piece IS the rhyme word — so the
    # label that names what was read still fires, on Shakespeare.
    check("`wilful-slow` still reads on its LAST piece and is still typed "
          "SUBSTITUTED — the report defect survives the anchor fix",
          lh.token_pieces(LEX, "wilful-slow") == (["slow"], ["wilful"])
          and lh.unread_final_piece(LEX, "wilful-slow") == (None, None),
          str(lh.token_pieces(LEX, "wilful-slow")))
    t = lh.line_readability(LEX, "Shall neigh no dull flesh in his wilful-slow")
    check("and that line stays READABLE, with the overstating label recorded "
          "separately from any refusal",
          t["readable"] and t["final_unread_pieces"] == ["wilful"]
          and t["final_unreadable_cause"] is None,
          f"{t['readable']} / {t['final_unread_pieces']}")
    lab = lh.span_label(lh.span_provenance(anchors(
        "Shall neigh no dull flesh in his wilful-slow")[0]))
    check("the label names the piece that was read and the piece that was not",
          "read as slow" in lab and "wilful not in the lexicon" in lab, lab)
    # AND IT IS IN THE SONNETS. Sonnet 51 L13 and sonnet 81 L10 are mandated,
    # judged, and both pass CORRECTLY on the last piece -- so the oracle could
    # never have caught this, which is doctrine 95's shape exactly.
    import battery
    sonnets = battery.parse_sonnets(battery.corpus_path("sonnets.txt"))
    tokens, mand = set(), []
    scheme = "ABABCDCDEFEFGG"
    for si, sn in enumerate(sonnets, 1):
        res = lh.check_scheme(LEX, sn, scheme, DECL)
        refl = {r["lines"] for r in res["refusals"]}
        for p in res["pair_scores"]:
            if lh.SPAN_SUBSTITUTED not in p["spans_kinds"]:
                continue
            for sp in (p["spans"]["a"], p["spans"]["b"]):
                for r in (sp or {"runs": []})["runs"]:
                    if r["unread"]:
                        tokens.add((si, r["word"]))
            i, j = p["lines"]
            if lh.same_scheme_class(scheme[i - 1], scheme[j - 1]) \
               and (i, j) not in refl:
                mand.append((si, p["lines"], p["endwords"], p["score"]))
    check("three sonnet tokens carry an unread hyphen piece",
          sorted(tokens) == [(28, "swart-complexion'd"), (51, "wilful-slow"),
                             (81, "o'er-read")], str(sorted(tokens)))
    check("2 pairs are MANDATED and JUDGED on one, and both score 1.0 — "
          "correct answers on a label that overstates, which is exactly why "
          "152 sonnets could never have caught this (doctrine 95's shape)",
          len(mand) == 2 and all(h[3] == 1.0 for h in mand), str(mand))
    check("the third is NOT an end word: sonnet 28 L11 ends on `night` and "
          "`swart-complexion'd` is reached by a MOSAIC span, so the "
          "substitution rides inside a span label rather than an end-word "
          "label — two defects of this cell's compounding",
          not any("swart" in w for _, _, ew, _ in mand for w in ew),
          "and it is not mandated with anything, so it costs no verdict")


def test_the_sweep_runs_and_reports_three_counts():
    print("\n13. adversary 7's instrument: quality/audit_spans.py")
    import audit_spans
    r = audit_spans.sweep_battery(LEX, DECL, verbose=False)
    check("three counts, always (doctrine 79)",
          (r["mandated"], r["judged"], r["refused"]) == (1064, 1014, 50),
          f"mandated {r['mandated']} judged {r['judged']} "
          f"refused {r['refused']}")
    check("violations 81 — the sweep reads the same oracle the battery does",
          r["violations"] == 81, str(r["violations"]))
    check("632 of the 1014 JUDGED pairs name the two words that produced "
          "their number", r["claimed"] == 632,
          f"{r['claimed']} / {r['judged']}; the other "
          f"{r['judged'] - r['claimed']} name a pair that did not")
    check("35 of the 81 VIOLATIONS do — this is the number that decides "
          "whether a triage lands on the right layer",
          r["violations_claimed"] == 35,
          f"{r['violations_claimed']} / {r['violations']}")
    severe = sum(v for k, v in r["viol_kinds"].items()
                 if any(x in (lh.SPAN_REACH, lh.SPAN_SUBSTITUTED,
                              lh.SPAN_UNATTRIBUTED) for x in k))
    check("9 of them could not be reconstructed from the printed words even "
          "in principle (reach / substituted / unattributed)", severe == 9,
          f"{severe} / {r['violations']}; the remaining "
          f"{81 - 35 - severe} are the declared anchor cut, visible in the "
          f"label")
    check("the partition is exhaustive over the judged pairs",
          sum(r["pair_kinds"].values()) == r["judged"],
          f"{sum(r['pair_kinds'].values())} == {r['judged']}")
    check("121 judged pairs had a TIE at the maximum — a second, "
          "independent way the named span is one of several",
          r["ties"] == 121, str(r["ties"]))
    rec = audit_spans.sweep_record(LEX, DECL, verbose=False)
    check("the record sweep finds this project's own canonical bad report "
          "line and cannot reproduce it from the words it names",
          any(x["a"] == "go" and x["b"] == "receipt"
              and abs(x["total"] - 0.272) < 5e-4 for x in rec["disagrees"]),
          "recorded 0.579, measured 0.272 from `go` and `receipt`")
    # PINNED STRUCTURALLY, NOT BY COUNT. Sibling cells write markdown into
    # this repo while this file runs, so a pinned `refused == 5` fails on
    # somebody else's document rather than on a defect (doctrine 78: a
    # parallel round moves the corpus under every cell). What must hold is
    # the shape: refusals are named and never charged, and the three outcomes
    # partition the adjudicable rows with no remainder.
    check("and it REFUSES the rows whose number is a different quantity "
          "rather than calling them wrong (doctrine 79)",
          rec["refused"] and all("CHANNEL" in x["why"]
                                 for x in rec["refused"]),
          f"{len(rec['refused'])} refused, "
          f"{len(rec['reproduces'])} reproduce, "
          f"{len(rec['disagrees'])} disagree, of {rec['found']} adjudicable")
    check("the three outcomes partition the adjudicable rows",
          len(rec["refused"]) + len(rec["reproduces"])
          + len(rec["disagrees"]) == rec["found"])
    check("the sweep EXCLUDES its own report by name, and says so — an "
          "instrument that swept its own findings would report its output "
          "as fresh evidence and grow every time the prose was edited",
          all(r["file"] != audit_spans.SELF_REPORT
              for r in rec["reproduces"] + rec["refused"]
              + rec["disagrees"]),
          audit_spans.SELF_REPORT)


def _raises(fn, exc):
    try:
        fn()
    except exc:
        return True
    except Exception:
        return False
    return False


def test_the_refrain_stub_is_not_english():
    print("\n8. BACKLOG 2.4 — the refrain pointer's LANGUAGE is a coordinate")
    eng = ("Oh, my poor Nelly Gray, &c.",
           "Then come, weel speed my pleughman lad, &c",
           "Farewell to the shore, etc.")
    for line in eng:
        check(f"eng still recognised: {line[:32]!r}",
              lh.chorus_stub_match(line) == ("eng", "&c. / etc. (et cetera)"))
    # Every `j. n. e.` line in corpus/song/fin_*.txt, verbatim.
    fin = ("Aita mulle päälle kaatui j. n. e. [41]",
           "Pytikästä j. n. e. (vaikka loppumattomaan).",
           'Härkä ei juo vettä j. n. e."',
           'Nuora ei lyö härkää j. n. e."',
           'Hiiri ei pure nuoraa j. n. e."',
           'Kissa ei syö hiirtä j. n. e."',
           '"Kiesuksen jätän siaani, j. n. e."',
           "Va rahalla ra j. n. e.")
    for line in fin:
        got = lh.chorus_stub_match(line)
        check(f"fin: {line[:36]!r}",
              got is not None and got[0] == "fin", str(got))
    check("msa `d. s. b.` is recognised where it occurs",
          lh.chorus_stub_match("dan lain-lain d. s. b.") == (
              "msa", "d. s. b. (dan sebagainya)"),
          "MEASURED 2026-08-11: corpus/song/msa_skeat_pantun.txt contains "
          "ZERO instances, against the ~100 recorded in MISSING.md M-4")
    for line in ("Farewell to the old Kentucky shore.",
                 "And I'll never see my darling any more,",
                 "The spacious firmament on high,",
                 "she said j. n. e. and then walked out",
                 "a fine etcetera of small complaints"):
        check(f"a real line is NOT a stub: {line[:32]!r}",
              not lh.is_chorus_stub(line))
    check("the language is a COORDINATE, not a guess (doctrine 45)",
          lh.chorus_stub_match("Va rahalla ra j. n. e.", language="eng")
          is None
          and lh.chorus_stub_match("Va rahalla ra j. n. e.",
                                   language="fin") is not None,
          "asking for English does not silently answer with Finnish")
    check("is_chorus_stub keeps its one-argument boolean contract",
          lh.is_chorus_stub("Oh, my poor Nelly Gray, &c.") is True
          and lh.is_chorus_stub("The spacious firmament on high,") is False)
    check("CHORUS_STUB is still a compiled pattern matching any convention",
          bool(lh.CHORUS_STUB.search("Oh, my poor Nelly Gray, &c."))
          and bool(lh.CHORUS_STUB.search("Härkä ei juo vettä j. n. e.")))


def test_the_brief_does_not_print_one_finding_six_times():
    print("\n9. BACKLOG 1.5 — dedupe findings before printing")

    class F:
        def __init__(self, code, msg):
            self.code, self.msg = code, msg

        def __str__(self):
            return f"[NOTE] {self.code}: {self.msg}"

    # A slop-floor Finding carries one `locations` entry per PAIR it was found
    # on, and the brief fans it out once per entry -- so a line standing in six
    # shared-suffix pairs printed the identical paragraph six times. Measured
    # against HEAD's quality/revise.py on seven `-ing` rhymes: L1 6, L2 5,
    # L3 4, L4 3, L5 2, L6 1, all identical within a line.
    one = F("SHARED_SUFFIX", "21 pair(s) rhyme only on a shared ending")
    findings = [one] * 6 + [F("CLICHE_PAIR", "fire/desire")]
    out = lh.dedupe_findings(findings)
    check("six identical findings collapse to one", len(out) == 2,
          f"{len(findings)} in, {len(out)} out")
    check("the finding that was NOT repeated survives — it is the one a "
          "writer needs and it was being buried",
          [f.code for f in out] == ["SHARED_SUFFIX", "CLICHE_PAIR"],
          str([f.code for f in out]))
    # keyed on rendered text, not identity: two DIFFERENT findings of the same
    # code must both show, or the dedupe becomes its own information loss.
    two = [F("SHARED_SUFFIX", "-ing"), F("SHARED_SUFFIX", "-ly")]
    check("two different findings of the same code both survive",
          len(lh.dedupe_findings(two)) == 2)
    check("distinct objects with identical text still collapse",
          len(lh.dedupe_findings(
              [F("X", "same"), F("X", "same")])) == 1,
          "the fan-out reuses one object, but a rebuilt equal one is just as "
          "much a duplicate to a reader")
    check("order is preserved and an empty list is safe",
          lh.dedupe_findings([]) == []
          and [f.code for f in lh.dedupe_findings(
              [F("B", "1"), F("A", "2"), F("B", "1")])] == ["B", "A"])


if __name__ == "__main__":
    test_the_original_bad_report_line()
    test_every_syllable_knows_its_word()
    test_search_size_is_recorded()
    test_a_tie_at_the_maximum_is_reported()
    test_provenance_is_absent_rather_than_invented()
    test_the_consumers_print_it()
    test_the_oracle_does_not_move()
    test_the_spans_cannot_be_separated_from_the_number()
    test_the_report_line_checks_its_own_claim()
    test_a_hyphen_can_substitute_the_rhyme_word()
    test_the_sweep_runs_and_reports_three_counts()
    test_the_refrain_stub_is_not_english()
    test_the_brief_does_not_print_one_finding_six_times()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all span-provenance regressions pass")
