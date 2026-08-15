#!/usr/bin/env python3
"""Readability of a text to the shipped lexicon — the recorded refusal.

WHAT THIS IS FOR

`lyric_harness` refuses on a word CMUdict cannot read: `line_anchors` returns
no anchor and `score` returns relation NO_ANCHOR. That refusal is correct. What
was wrong, until the fix this module accompanies, is that every consumer threw
it away, so an unreadable end word came out of the harness as one of three
things, none of them a refusal:

  1. `check_scheme`  — a VIOLATION reading `below theta_rhyme=0.75`. That
     sentence says "these lines do not rhyme". Measured on the sonnet battery:
     50 of 123 violations (40.7%) were this, including `viewest`/`renewest`,
     `gazeth`/`amazeth`, `receivest`/`deceivest` and `sweetness`/`meetness`.
     The harness was naming Shakespeare as the thing at fault.
  2. `rhyme_graph`   — nothing at all. The node lost every edge and the `oov`
     the function had already computed was dropped from the return value, so an
     isolated node and an unread node looked identical.
  3. `check_qafiya`  — the rhyme word SILENTLY REPLACED by an earlier word,
     because `word_syllable_map` emits no syllable for an unreadable word and
     `_qafiya_parts` took the last surviving one. `zun` reported as `the`,
     `grow'st` reported as `thou`. 5.14% of corpus/song/ lines, 2.87% of sonnet
     lines. An entirely unreadable line was reported as
     "radif/refrain line: licensed" — an unreadable line passing as a refrain.

  4. `line_readability` ITSELF, until 2026-08-11, and this was the worst of
     the four because it was not a missing relation but an INVENTED one.
     `Lexicon.transcribe` splits a token on its hyphens and looks each piece
     up alone, so a compound whose LAST piece is missing still yields phones
     from the earlier ones: `hill-zide` was anchored on `hill`, scored against
     `wife-zide` anchored on `wife`, banded, and the line reported READABLE.
     Measured over the 143 English song files at commit `2f2d26c`: 174 line
     ends of 151,894. The refusal is now in `line_anchors`
     (`lyric_harness.unread_final_piece`) and the cause is recorded here as
     `final_unreadable_cause = "piece"`. Its price on both populations is in
     `quality/RESULTS_HYPHEN_REFUSAL.md` — zero on the sonnet oracle, +0.099pp
     on the song corpus, 63.8% of it in two dialect files whose end words
     CMUdict was already failing to read at 4.0x the rate of the files this
     rule does not touch (doctrine 67).

The rule this enforces: AN UNREADABLE WORD PRODUCES A RECORDED REFUSAL, NEVER A
MISSING RELATION. A caller must always be able to tell "these lines do not
rhyme" from "I could not read one of them".

WHAT THIS DELIBERATELY DOES NOT DO

It does not guess a pronunciation. CLAUDE.md known gap 1 proposes g2p-en as a
transcribe fallback; that is a separate decision, it is not taken here, and
taking it in this module would be the worse error — a silent deletion replaced
by a silent invention. `zzzqx` has no pronunciation the harness is entitled to,
and neither does `hwome`. The measured rates below are the SIZE OF THE GAP, and
they are the argument for or against g2p; they are not something to make go
away by filling the gap with guesses.

Run:  python3 quality/readability.py corpus/song/*.txt
"""

import os
import re
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import (Declaration, Lexicon,  # noqa: E402
                           is_apparatus_line, line_anchors,
                           line_readability, line_tokens,
                           raw_final_token, read_lyric_text,
                           readability_records,
                           token_pieces, word_syllable_map)


@dataclass
class Finding:
    """Same shape as `quality.floor.Finding`, deliberately: a caller that
    already renders floor findings renders these with no new code. Declared
    here rather than imported so this module stands alone — reading a text is
    upstream of grading it."""
    code: str
    severity: str            # "flag" | "note"
    message: str
    evidence: str
    locations: list = field(default_factory=list)

    def __str__(self):
        loc = f" (lines {', '.join(map(str, self.locations))})" if \
            self.locations else ""
        return f"[{self.severity.upper():4}] {self.code}: {self.message}{loc}\n" \
               f"         {self.evidence}"


#: A line counts for the rate iff it yields at least one word token. A blank
#: line, a bracketed section header and a line that is nothing but a stripped
#: parenthetical all have no end word, so there is nothing to refuse about
#: them. Stated here rather than left to each caller, because doctrine 58 says
#: a bare n-of-N is a coordinate of some setting nobody wrote down.
def countable(text):
    return bool(line_tokens(text))


def report(lex, lines):
    """-> dict. The per-line records, the counts, and the findings.

    `lines_countable` is the denominator for every rate here. Divide by it and
    not by `len(lines)`.
    """
    records = readability_records(lex, lines)
    countables = [r for r in records if r["final_token"] is not None]
    unread_final = [r for r in countables if r["final_unreadable"]]
    by_token = [r for r in unread_final
                if r["final_unreadable_cause"] == "token"]
    by_piece = [r for r in unread_final
                if r["final_unreadable_cause"] == "piece"]
    interior_only = [r for r in countables
                     if not r["final_unreadable"] and r["interior_unreadable"]]
    # The REPORT-layer half of the hyphen defect: the end word reads on its
    # LAST piece, so the anchor is right and the label overstates. Not a
    # refusal and it must never be counted as one -- `threshing-floor` is
    # anchored on `floor`, which is the rhyme word.
    label_overstates = [r for r in countables
                        if not r["final_unreadable"]
                        and r["final_unread_pieces"]]
    # WIRED 2026-08-14. `substitution_report` sat 100 lines below this
    # function with two callers -- this module's own `main()`, which prints a
    # COUNT and never a word, and one test. Every surface that GRADES a draft
    # (`report` here, and through it `revise.Reviser.inspect` -> `brief` ->
    # `verify` -> the `brief`/`verify`/`revise`/`song` verbs) could say the
    # LINE was unreadable and none of them could say WHICH WORD the harness
    # would have rhymed on instead, which is the actionable half.
    substituted = substitution_report(lex, lines)
    n = len(countables)
    out = {
        "lines_total": len(lines),
        "lines_countable": n,
        "lines_unreadable_final": len(unread_final),
        # THE TWO CAUSES, SEPARATELY (doctrine 44's separation applied to a
        # defect; doctrine 58 -- the rule is a coordinate of the count). The
        # `token` count is the number every rate recorded before 2026-08-11
        # was measuring, and it is unmoved by the hyphen refusal, so a reader
        # can still check the old figure against the new tree.
        "lines_unreadable_final_token": len(by_token),
        "lines_unreadable_final_piece": len(by_piece),
        "lines_label_overstates": len(label_overstates),
        "lines_interior_unreadable_only": len(interior_only),
        # A COUNT OF ITS OWN, NEVER ADDED TO ANY RATE ABOVE (doctrine 79/91,
        # and the same treatment `label_overstates` already gets). It is
        # ~99.98% a re-cut of the `token` population, so summing it into
        # `lines_unreadable_final` would double-charge 8,840 English corpus
        # lines; and it is not a pure subset either, so subtracting it from
        # anything would be wrong in the other direction. Two counts, never
        # summed -- `substitution_report`'s docstring holds the measurement.
        "lines_substituted_end_word": len(substituted),
        "substituted_end_words": substituted,
        "rate_unreadable_final": (len(unread_final) / n) if n else 0.0,
        "unreadable_final_words": sorted(
            {r["final_token"].lower() for r in unread_final}),
        "records": records,
        "findings": [],
    }
    # THE TWO FLAGS PARTITION, they do not overlap: `UNREADABLE_END_WORD` is
    # cause `token` and `UNREADABLE_END_WORD_PIECE` is cause `piece`. Emitting
    # the first over BOTH would print the compound cases twice under two
    # sentences that say different things about them, which is the misfiling
    # this module just finished fixing, re-committed in the rendering.
    if by_token:
        out["findings"].append(Finding(
            code="UNREADABLE_END_WORD",
            severity="flag",
            message=(f"{len(by_token)} of {n} lines end in a word CMUdict "
                     f"cannot read; their end-rhyme is UNKNOWN, not absent"),
            evidence=("No pronunciation is guessed (no G2P fallback). Every "
                      "relation these lines would have entered is REFUSED and "
                      "recorded, not silently dropped. Words: "
                      + ", ".join(sorted({r["final_token"]
                                          for r in by_token})[:20])),
            locations=[r["line"] for r in by_token],
        ))
    if by_piece:
        out["findings"].append(Finding(
            code="UNREADABLE_END_WORD_PIECE",
            severity="flag",
            message=(f"{len(by_piece)} of {n} lines end in a COMPOUND whose "
                     f"last piece CMUdict cannot read; the pieces that do "
                     f"read are not the rhyme word"),
            evidence=("`Lexicon.transcribe` splits a token on its hyphens, so "
                      "`hill-zide` yielded phones from `hill` and the harness "
                      "scored the rhyme against it and called the line "
                      "READABLE. It now refuses. No pronunciation is guessed "
                      "for the missing piece, and it is NOT assumed to be a "
                      "misspelling of a word that is present: `zide` is "
                      "Dorset initial fricative voicing, and reading it as "
                      "`side` would move the declaration's DIALECT coordinate "
                      "inside a hyphen rule (doctrine 1). Words: "
                      + ", ".join(sorted({r["final_token"]
                                          for r in by_piece})[:20])),
            locations=[r["line"] for r in by_piece],
        ))
    if label_overstates:
        out["findings"].append(Finding(
            code="END_WORD_LABEL_OVERSTATES",
            severity="note",
            message=(f"{len(label_overstates)} line(s) end in a compound "
                     f"whose LAST piece reads and an earlier piece does not; "
                     f"the anchor is right and the printed word is not what "
                     f"was transcribed"),
            evidence=("`threshing-floor` is anchored on `floor`, which IS the "
                      "rhyme word, so this is a REPORT defect and never a "
                      "refusal. `span_label` prints the read and unread "
                      "pieces; `span_kind` returns `substituted`."),
            locations=[r["line"] for r in label_overstates],
        ))
    if interior_only:
        out["findings"].append(Finding(
            code="UNREADABLE_INTERIOR_WORD",
            severity="note",
            message=(f"{len(interior_only)} line(s) are readable at the end "
                     f"but have an unreadable word before it"),
            evidence=("The end-rhyme is sound. A multi-syllable anchor that "
                      "reaches back past the gap (mosaic rhyme: 'spit in it') "
                      "is joining phones across a hole, and the internal-rhyme "
                      "and consonant-skeleton paths skip the word entirely."),
            locations=[r["line"] for r in interior_only],
        ))
    if substituted:
        flagged = {r["line"] for r in unread_final}
        silent = [s for s in substituted if s["line"] not in flagged]
        pairs = ", ".join(f"L{s['line']} {s['true_final']!r}->"
                          f"{s['would_have_used']!r}"
                          for s in substituted[:20])
        out["findings"].append(Finding(
            code="SUBSTITUTED_END_WORD",
            severity="note",
            message=(f"{len(substituted)} line(s) would have had the RHYME "
                     f"WORD SILENTLY REPLACED by an earlier word: "
                     f"{pairs}"),
            evidence=(
                "`word_syllable_map` emits no syllable for a word CMUdict "
                "cannot read, so anything taking its last entry as the rhyme "
                "word takes an EARLIER word instead -- the defect the shipped "
                "file carried in `_qafiya_parts`, where `zun` reported as "
                "`the` and `grow'st` as `thou`. THIS IS NOT A SECOND CHARGE. "
                f"{len(substituted) - len(silent)} of these {len(substituted)} "
                f"line(s) are ALREADY flagged above by UNREADABLE_END_WORD, "
                "which says the LINE cannot be read; what no other finding in "
                "this module says is WHICH WORD would have been used, and "
                "that is the only part a writer or a caller can act on -- the "
                "substitute is a plausible English word, so nothing about the "
                "output looks wrong. "
                + (f"{len(silent)} of them carry NO other finding at all: "
                   "the end token READS and yields no syllable (a lone "
                   "consonant such as `mm`), so `line_anchors` returns an "
                   "anchor built on the previous word and `final_unreadable` "
                   "is False. That is an INVENTED relation, not a missing "
                   "one, at a site `unread_final_piece` does not cover."
                   if silent else
                   "Every one of them is also flagged above, so this finding "
                   "adds the word and no new line.")),
            locations=[s["line"] for s in substituted],
        ))
    return out


def substitution_report(lex, lines):
    """Lines where the last READABLE word is not the last word.

    This is the `relations.py` `_loci('line_final_token')` defect, and the
    shipped file carried it in `_qafiya_parts`. It is ~~a strict subset of the
    unreadable-final lines (the map has to keep at least one earlier word),
    and~~ it is the more dangerous half, because the substituted word is a
    plausible English word and nothing about the output looks wrong.

    THE SUBSET CLAIM IS NOT TRUE, AND IT WAS MEASURED RATHER THAN REASONED
    (2026-08-14, wiring this into `report`). Over the 143 English song files:
    8,842 substitution lines, of which **8,840** are `final_unreadable` and
    cause `token` — and **2 ARE NOT UNREADABLE AT ALL**. Over all 260
    `corpus/song/` files it is 6 of 31,355. The mechanism is a third one, next
    to the two the module docstring lists: a final token that DOES read and
    yields NO SYLLABLE. `mm` transcribes to `['M']` and `syllabify` returns
    nothing for a lone consonant, so `word_syllable_map` drops it exactly as
    it drops an OOV word — while `line_anchors` still finds an anchor (built
    on the previous word), so `final_unreadable` is `not anchors` = False and
    `report` says nothing whatsoever. Byron's `...lay white on the turf,[mm]`
    is anchored on `turf`, reported READABLE, and is invented-relation #4 of
    the module docstring at a site `unread_final_piece` does not cover.
    Those 2 lines are the ONLY population in this module that no other
    finding reaches; the other 8,840 already have their LINE flagged by
    `UNREADABLE_END_WORD` and are missing only the substituted WORD.

    THIS IS NOT A NEW CLAIM ABOUT `mm`, AND THAT IS WHY IT IS SAFE.
    `quality/test_readability.py` test 6 has pinned since 2026-08-13 that
    `sh`/`shh`/`hm`/`hmm`/`mm` each yield NO ANCHOR ON THEIR OWN, and it was
    written off the OTHER of these two lines -- D'Urfey's `_Sh----_`, which
    tokenizes to `sh`. What that test does not ask, because nothing did, is
    what happens when such a token ends a line whose EARLIER words read: the
    line-level `line_anchors` then returns the anchor those earlier words
    built, so the token-level refusal is real and the LINE-level one never
    fires. Both halves of the same 2-line population, found from opposite
    ends a day apart.

    The complement is the larger number and is not a defect here: 412 English
    unreadable-final lines are NOT substitutions — 174 are cause `piece`
    (`hill-zide` keeps its own token in the map, so nothing is substituted)
    and 238 are lines where no earlier word read either.
    """
    out = []
    for i, text in enumerate(lines):
        final = raw_final_token(text, strip_parens=lex.strip_parens)
        if final is None:
            continue
        smap = word_syllable_map(lex, text)
        if smap and smap[-1]["word"] != final:
            out.append({"line": i + 1, "true_final": final,
                        "would_have_used": smap[-1]["word"], "text": text})
    return out


def read_lines(path):
    """Corpus lines, as every measurement in this project reads them: stripped,
    non-empty, carrying at least one Latin letter, and not one of the
    corpus's own apparatus lines.

    FIXED 2026-08-12 (BACKLOG.md 5.x). This was the one line-reader in the
    project that did not exclude `#` header comments, `--- ` source notes
    (including `--- TITLE:`), and `[MARK]` section markers -- every other
    reader does, including `quality/grid.py`'s `read_marked_songs` over
    these SAME files. So every "unreadable end word" rate ever computed
    over `corpus/song/` through this function counted apparatus as verse:
    cell AC measured 19.5% of the old "countable lines" denominator as
    `[VERSE n]` markers, `--- TITLE:` lines, other `--- ` lines and `#`
    headers -- 29,990 of those from `[VERSE n]` alone -- not one syllable
    of it sung. `quality/test_readability.py` test 5 carries the corrected
    pin and the arithmetic that got it there.

    CENTRALIZED 2026-08-13, and the fix above is the reason: this function
    spelled the rule a SECOND time, and it spelled it differently. It tested
    `--- ` WITH A TRAILING SPACE where `lyric_harness.is_apparatus_line` --
    the one definition CLAUDE.md names, and the one every other reader in the
    repo uses -- tests `---`. The two agree on `--- TITLE:` and on every
    ordinary source note, and disagree on a RULE, which is why nobody noticed:
    a run of four or more hyphens is not `--- `. MEASURED over the 143 English
    song files: FOUR lines, all four Wordsworth epigraphs in
    `corpus/song/eng_british_felicia_hemans.txt` (`----"'Tis not merely`,
    `----"Sing aloud`, `----"His early days`, `----"How divine`), read as
    verse here and as apparatus everywhere else. `lines_countable` 151,898 ->
    151,894, and 151,894 is the figure `RESULTS_HYPHEN_REFUSAL.md` and
    `lyric_harness.token_pieces` ALREADY carried -- so this closes a record
    that disagreed with itself rather than moving one that agreed. No
    unreadable-end-word count moves: all four end words (`merely`, `aloud`,
    `days`, `divine`) are in CMUdict, so 9,078/174/149/8,842 are untouched and
    only the denominator falls, 5.97638% -> 5.97654% and 6.09093% ->
    6.09109%.

    CONVERGED AGAIN 2026-08-15, AND THE SECOND SPELLING WAS THE DECODE.
    The 2026-08-13 fix took this function's APPARATUS rule onto
    `is_apparatus_line` and left `errors="replace"` sitting on the `open` --
    a coordinate `lyric_harness.load_lyric_lines` has never had. So the two
    readers still disagreed about the same file, one layer earlier: an
    undecodable byte was a REFUSAL to every other reader in this repo and a
    U+FFFD here.

    THE COST LANDS ON THIS MODULE'S OWN HEADLINE, which is what makes it
    worth the churn rather than a tidy-up. `readability` is the
    INGESTION-REFUSAL verb -- its entire output is "how much of this text
    could not be read". MEASURED at `6d204a7` on an eight-byte binary file:

        $ python3 lyric_harness.py readability bad.bin
          countable line ends 1   read 1   REFUSED 0   (0.00%)

    Seven sibling verbs exit 1 on that file and four refuse at 2; this one
    reports, at exit 0, that it read the whole thing and refused nothing.
    `errors="replace"` had turned the bytes into a replacement character,
    `re.search(r"[A-Za-z]")` kept the ASCII in the middle, and CMUdict was
    asked about the result. A refusal counter that answers 0.00% on a file it
    could not decode is doctrine 48's shape at the top of its own report.

    AND IT WAS BUYING NOTHING ON THE POPULATION IT EXISTS FOR. MEASURED
    before the swap: **0 of 269 files under `corpus/` fail a strict UTF-8
    decode**, and the only undecodable file anywhere under `data/` is a
    SQLite database no line reader opens. So `errors="replace"` never fired
    on a single recorded measurement -- it was reachable only by a caller's
    mistake, which is the one case where it does harm.
    """
    out = []
    for raw in read_lyric_text(path).splitlines():
        s = raw.strip()
        if not s or not re.search(r"[A-Za-z]", s):
            continue
        if is_apparatus_line(s):
            continue
        out.append(s)
    return out


def corpus_rate(lex, paths):
    """-> dict. The pinned corpus measurement, aggregated over files.

    Kept separate from `report` so the regression test and the CLI compute the
    identical number from the identical definition. If this rate moves, either
    the corpus changed or the lexicon path did, and both are things a reader of
    any recorded number needs told.
    """
    tot = unread = subst = 0
    subst_flagged = subst_silent = 0
    by_token = by_piece = 0
    overstates = 0
    misfiled = misfiled_unexplained = 0
    words = {}
    per_file = []
    for p in sorted(paths):
        lines = read_lines(p)
        recs = readability_records(lex, lines)
        c = [r for r in recs if r["final_token"] is not None]
        u = [r for r in c if r["final_unreadable"]]
        t = [r for r in u if r["final_unreadable_cause"] == "token"]
        pc = [r for r in u if r["final_unreadable_cause"] == "piece"]
        lo = [r for r in c
              if not r["final_unreadable"] and r["final_unread_pieces"]]
        s = substitution_report(lex, lines)
        tot += len(c)
        unread += len(u)
        by_token += len(t)
        by_piece += len(pc)
        overstates += len(lo)
        subst += len(s)
        # THE SUBSET CLAIM, MEASURED IN THE PASS THAT WAS ALREADY BEING MADE.
        # `substitution_report`'s docstring called itself "a strict subset of
        # the unreadable-final lines" from the day it was written and nothing
        # ever checked it. It is not one: a final token that READS and
        # syllabifies to NOTHING (`mm` -> ['M']) is dropped by
        # `word_syllable_map` and kept by `line_anchors`, so the substitution
        # happens and `final_unreadable` is False. TWO COUNTS, NEVER SUMMED
        # (doctrine 79) -- `substituted_flagged` is the population
        # UNREADABLE_END_WORD already names as a LINE, where the gap was only
        # the WORD; `substituted_silent` is the population NO finding in this
        # module reaches at all, and it is the one that must be watched.
        # It rides this loop for the same reason the position invariant below
        # does: a second sweep would derive the population from a second
        # definition, and the two would drift.
        unread_lines = {r["line"] for r in u}
        flagged = sum(1 for x in s if x["line"] in unread_lines)
        subst_flagged += flagged
        subst_silent += len(s) - flagged
        # THE POSITION INVARIANT, MEASURED RATHER THAN ASSERTED. `pc + lo` is
        # the whole population the hyphen defect lives in: an end token with at
        # least one piece that reads and at least one that does not. Before
        # `interior_unreadable` was derived by POSITION, every one of these had
        # its unread END-WORD piece filed as an INTERIOR unreadable -- 328 of
        # 328 -- because the old rule was "an unreadable string spelled
        # differently from the whole final token", and `zide` is spelled
        # differently from `hill-zide`.
        #
        # It rides THIS loop rather than a sweep of its own because a second
        # pass over the same 143 files would compute the population from a
        # second definition, and the two would drift the way the record and the
        # behaviour drifted before `unread_final_piece` became one predicate.
        # The cost is nothing: the expensive part (`readability_records`) is
        # already done, and the per-line token walk below runs only on the
        # handful of lines that actually overlap.
        #
        # TWO COUNTS, NEVER SUMMED (doctrine 79). An overlap is not by itself a
        # misfiling: Kingsley's `Sing heigh-ho, and heigh-ho!` really does carry
        # `heigh` in BOTH places, once as an interior token's unread piece and
        # once as the end token's, and the position rule is correct to report
        # both. `interior_misfiled_unexplained` subtracts exactly those -- an
        # overlap no EARLIER token accounts for is the defect, and it is the
        # number that must stay 0. Collapsing the two would make the naive
        # over-correction (subtract final pieces from interior, deleting a real
        # interior gap) look like a fix instead of doctrine 24 broken.
        for r in pc + lo:
            over = [pi for pi in r["final_unread_pieces"]
                    if pi in r["interior_unreadable"]]
            if not over:
                continue
            misfiled += 1
            earlier = set()
            for tk in line_tokens(r["text"],
                                  strip_parens=lex.strip_parens)[:-1]:
                earlier.update(token_pieces(lex, tk)[1])
            if any(pi not in earlier for pi in over):
                misfiled_unexplained += 1
        for r in u:
            w = r["final_token"].lower()
            words[w] = words.get(w, 0) + 1
        per_file.append({"file": os.path.basename(p), "lines": len(c),
                         "unreadable_final": len(u),
                         "unreadable_final_token": len(t),
                         "unreadable_final_piece": len(pc),
                         "rate": (len(u) / len(c)) if c else 0.0,
                         "rate_token": (len(t) / len(c)) if c else 0.0})
    return {"files": len(per_file), "lines_countable": tot,
            "unreadable_final": unread,
            # SPLIT BY CAUSE 2026-08-11. `unreadable_final_token` is the
            # quantity every pin recorded before the hyphen refusal shipped,
            # and it is unmoved by it, so a repin can separate "the corpus
            # changed" from "the rule changed". Two cells were editing this
            # corpus and this module in the same round; a single number would
            # have made their two effects inseparable (doctrine 58).
            "unreadable_final_token": by_token,
            "unreadable_final_piece": by_piece,
            # The REPORT-layer half of the same defect: the last piece reads,
            # so the anchor is right and only the printed word overstates.
            # Never a refusal, and it is deliberately NOT added to `rate`.
            "label_overstates": overstates,
            # `unreadable_final_piece + label_overstates` -- every end token
            # with a read piece and an unread piece, which is the population
            # the position rule is about. Named so a reader can check the
            # 174/149 split without recomputing it from two other keys.
            "final_piece_population": by_piece + overstates,
            "interior_misfiled": misfiled,
            "interior_misfiled_unexplained": misfiled_unexplained,
            "rate": (unread / tot) if tot else 0.0,
            "rate_token": (by_token / tot) if tot else 0.0,
            "substituted_end_word": subst,
            "substituted_flagged": subst_flagged,
            "substituted_silent": subst_silent,
            "distinct_unreadable_finals": len(words),
            "top_unreadable_finals": sorted(words.items(),
                                            key=lambda kv: (-kv[1], kv[0]))[:20],
            "per_file": per_file}


def main(argv):
    paths = argv[1:]
    lex = Lexicon()
    if not paths:
        print(__doc__)
        return 0
    res = corpus_rate(lex, paths)
    print(f"files {res['files']}   countable lines {res['lines_countable']}")
    print(f"unreadable end word : {res['unreadable_final']} "
          f"({res['rate']:.2%})")
    print(f"  by cause: {res['unreadable_final_token']} the whole token "
          f"({res['rate_token']:.2%}, the figure every pin before "
          f"2026-08-11 recorded)")
    print(f"            {res['unreadable_final_piece']} a COMPOUND whose "
          f"LAST piece is unread — `hill-zide`, refused rather than "
          f"anchored on `hill`")
    print(f"  of which the rhyme word would have been SILENTLY SUBSTITUTED by "
          f"an earlier word: {res['substituted_end_word']} "
          f"= {res['substituted_flagged']} whose LINE is flagged above "
          f"(only the WORD was missing) "
          f"+ {res['substituted_silent']} that NO finding reaches — a final "
          f"token that READS and syllabifies to nothing, anchored on the "
          f"previous word. The substitution is NOT a subset of the "
          f"unreadable-final lines and the second number is why")
    print(f"end token with a read piece AND an unread piece: "
          f"{res['final_piece_population']} "
          f"= {res['unreadable_final_piece']} refused (last piece unread) "
          f"+ {res['label_overstates']} label-overstates (last piece reads, "
          f"`threshing-floor` on `floor`)")
    print(f"  of those, an end-word piece ALSO listed as interior: "
          f"{res['interior_misfiled']}, of which "
          f"{res['interior_misfiled_unexplained']} unexplained by an earlier "
          f"token — the second number is the misfiling `interior_unreadable` "
          f"was derived by POSITION to make impossible, and it must be 0")
    print(f"distinct unreadable finals: {res['distinct_unreadable_finals']}")
    print("most frequent:")
    for w, n in res["top_unreadable_finals"]:
        print(f"  {n:>5}x  {w}")
    worst = sorted(res["per_file"], key=lambda d: -d["rate"])[:8]
    print("worst files:")
    for d in worst:
        print(f"  {d['rate']:6.2%}  {d['unreadable_final']:>5}/"
              f"{d['lines']:<6} {d['file']}")
    print("\nNo pronunciation was guessed. These are refusals, and the rate is "
          "the size of the gap.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
