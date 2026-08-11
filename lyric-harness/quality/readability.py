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

from lyric_harness import (Declaration, Lexicon, line_anchors,  # noqa: E402
                           line_readability, line_tokens,
                           raw_final_token, readability_records,
                           word_syllable_map)


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
    return out


def substitution_report(lex, lines):
    """Lines where the last READABLE word is not the last word.

    This is the `relations.py` `_loci('line_final_token')` defect, and the
    shipped file carried it in `_qafiya_parts`. It is a strict subset of the
    unreadable-final lines (the map has to keep at least one earlier word), and
    it is the more dangerous half, because the substituted word is a plausible
    English word and nothing about the output looks wrong.
    """
    out = []
    for i, text in enumerate(lines):
        final = raw_final_token(text)
        if final is None:
            continue
        smap = word_syllable_map(lex, text)
        if smap and smap[-1]["word"] != final:
            out.append({"line": i + 1, "true_final": final,
                        "would_have_used": smap[-1]["word"], "text": text})
    return out


def read_lines(path):
    """Corpus lines, as every measurement in this project reads them: stripped,
    non-empty, and carrying at least one Latin letter."""
    with open(path, encoding="utf-8", errors="replace") as f:
        return [ln.strip() for ln in f
                if ln.strip() and re.search(r"[A-Za-z]", ln)]


def corpus_rate(lex, paths):
    """-> dict. The pinned corpus measurement, aggregated over files.

    Kept separate from `report` so the regression test and the CLI compute the
    identical number from the identical definition. If this rate moves, either
    the corpus changed or the lexicon path did, and both are things a reader of
    any recorded number needs told.
    """
    tot = unread = subst = 0
    by_token = by_piece = 0
    words = {}
    per_file = []
    for p in sorted(paths):
        lines = read_lines(p)
        recs = readability_records(lex, lines)
        c = [r for r in recs if r["final_token"] is not None]
        u = [r for r in c if r["final_unreadable"]]
        t = [r for r in u if r["final_unreadable_cause"] == "token"]
        pc = [r for r in u if r["final_unreadable_cause"] == "piece"]
        s = substitution_report(lex, lines)
        tot += len(c)
        unread += len(u)
        by_token += len(t)
        by_piece += len(pc)
        subst += len(s)
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
            "rate": (unread / tot) if tot else 0.0,
            "rate_token": (by_token / tot) if tot else 0.0,
            "substituted_end_word": subst,
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
          f"an earlier word: {res['substituted_end_word']}")
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
