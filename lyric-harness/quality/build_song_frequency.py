#!/usr/bin/env python3
"""Build the RHYME-POSITION frequency tables over corpus/song/eng_*.

    python3 quality/build_song_frequency.py            # rebuild data/*.tsv
    python3 quality/build_song_frequency.py --census   # counts only, no write

WHY THIS EXISTS, AND WHAT IT IS NOT

`wordfreq20k.txt` is the list `lyric_harness.Lexicon.freq_rank` reads, and it
does two jobs that were never separated: it RANKS the band-passing candidates,
which is how `quality/revise.py` picks the FORBIDDEN set that makes doctrine 9
mechanical (doctrine 48) -- and, because `CandidateEngine.__init__` skips any
word with no rank, it is also the MEMBERSHIP of the entire candidate pool.
Measured: 18,010 of 124,926 a-z CMUdict words survive it, so 106,916 words
(85.6%) can never be offered to a writer or forbidden to one. `weep`, `wept`,
`mourn`, `doth`, `ere` and `wilt` are in that 85.6%.

The list is `first20hours/google-10000-english/20k.txt`, byte-identical
(md5 c0190594b2a3a30a89bd0367b0892e0e), derived from Peter Norvig's
`count_1w.txt` over the Google Web Trillion Word Corpus -- "one trillion words
from public Web pages". So the ranking that decides which rhyme is "the
predictable one" is a 2006 web crawl, in which `email` is 115, `click` 94 and
`yahoo` 499 against `moon` 2801 and `grief` 10700.

THIS FILE DOES NOT REPLACE IT WITH ANOTHER GLOBAL RANK. The measurement in
`quality/RESULTS_SONG_FREQUENCY.md` is that a global unigram rank is the wrong
INSTRUMENT and not merely the wrong population: the head of any unigram list
is function words, and inside a rhyme field the high-frequency end is
therefore spent on `that`, `not`, `at`, `but`, `for`, `or`, `are`, `your` --
words no writer takes as a rhyme -- while `light`, `bright`, `sight` and
`delight` stay OFFERED. What this file builds is the CONDITIONAL, P(partner |
call word), measured at the line-final position, which is the quantity
doctrine 9 is actually about.

INDEPENDENCE (doctrine 13, and it is the reason for the `author` column)

These counts come FROM `corpus/song/`, so they may not score anything drawn
from `corpus/song/` without leave-one-author-out. The per-author column is not
provenance decoration -- it is what makes the correction computable at read
time. `quality/frequency.py` refuses to serve these tables for a text whose
author is in them unless `leave_out=` is passed. See the rows in
`data/sources.tsv`, which state the derivation, the split, and what each file
may NOT be used to score.

THE POPULATION IS BUILT WITH THE HARNESS'S OWN END-WORD PREDICATE

`line_tokens`, `fold_apostrophes`, the same strip set, and the 2026-08-11
hyphen refusal, so the table's types are the types the grader reads (doctrine
91: build the population the same way before calling a number a disagreement).
The check that this worked is that `end_hyphen_refusal` comes out at 174,
which is the count CLAUDE.md records for this corpus.

Two further refusals are DECLARED here and are not in the harness:

  accent_refusal  `line_tokens` matches `[A-Za-z'\\-]+`, so a non-ASCII letter
                  BREAKS the token and the piece after it becomes the final
                  token: `ceäre` -> `re`, `numberèd` -> `d`, `outré` -> `outr`.
                  1,635 line ends, 19 of 143 files. The harness scores those
                  fragments and reports `1.0 RHYME` on `n ~ n`; this builder
                  refuses them so no fragment enters the distribution. The
                  defect is in `lyric_harness.py`, which is not this module's
                  file -- see scratchpad/cellBE/PATCHES-not-mine.md.

  burden_mark     `&c.` is the 18th-century printer's "repeat the burden"
                  mark. `line_tokens` drops the `&` and yields `c`, which
                  reached end-position rank 5 at 882 occurrences over 19
                  authors. The line's real rhyme word is the last word of the
                  burden and is not on the line, so this is a refusal and not
                  a substitution (doctrine 79).
"""

import collections
import os
import re
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
sys.path.insert(0, ROOT)

from lyric_harness import (Lexicon, line_tokens, fold_apostrophes,      # noqa
                           unread_final_piece, syllabify, anchor)

SONG = os.path.join(ROOT, "corpus", "song")
DATA = os.path.join(ROOT, "data")

END_TSV = os.path.join(DATA, "song_endword_en.tsv")
PAIR_TSV = os.path.join(DATA, "song_rhymepair_en.tsv")

#: `#`, `--- TITLE:`/`--- SOURCE:`, and `[VERSE n]`-style role markers. The
#: same predicate `quality/audit_corpus.py` uses, so the two agree on what a
#: sung line is.
_MARKER = re.compile(r"^(#|--- |\[)")

#: The line's TRUE final orthographic word, unicode-aware.
_TRUE_WORD = re.compile(r"[^\W\d_]+(?:['\-][^\W\d_]+)*", re.UNICODE)

_BURDEN_MARK = re.compile(r"&\s*c(?:e)?\s*\.?\s*$", re.IGNORECASE)


class SongFrequencyBuilder:
    def __init__(self, lex=None):
        self.lex = lex or Lexicon()
        self._rk = {}

    # -- the end word --------------------------------------------------------

    def endword(self, text):
        """-> (word, status). status is one of ok / oov / no_token /
        hyphen_refusal / accent_refusal / burden_mark. Only `ok` is counted;
        every other value is reported so the refusals are visible rather than
        silently absent (doctrine 79 -- a refusal is not a failure, and it is
        not a zero either)."""
        if _BURDEN_MARK.search(text):
            return None, "burden_mark"
        words = line_tokens(text)
        if not words:
            return None, "no_token"
        last = words[-1]
        if unread_final_piece(self.lex, last)[0] is not None:
            return None, "hyphen_refusal"
        norm = text.replace("’", "'").replace("‘", "'")
        norm = re.sub(r"\([^)]*\)", " ", norm)
        true = _TRUE_WORD.findall(norm)
        if true and any(ord(c) > 127 for c in true[-1]):
            folded = "".join(c for c in unicodedata.normalize("NFKD", true[-1])
                             if not unicodedata.combining(c))
            if last.lower() not in (folded.lower(), true[-1].lower()):
                return None, "accent_refusal"
        w = fold_apostrophes(last).lower().strip("'\".,;:!?()[]")
        if not w:
            return None, "no_token"
        if w not in self.lex.entries:
            return w, "oov"
        return w, "ok"

    # -- the perfect-rhyme class --------------------------------------------

    def rime_key(self, word):
        """Identical from the last stressed VOWEL onward.

        The anchor slice carries the onset of its first syllable and a rime
        does not, so that onset is dropped and everything after it kept.
        Doctrine 9 names the phonetic MAXIMUM and the maximum is a perfect
        rhyme, which is what makes the conditional an exact key rather than a
        sweep of the comparator over 134,172 end words.

        RIME_RICHE lands in the same class on purpose -- `bare`/`bear` is the
        same sound and a writer can reach for it. REPEAT does not, because the
        caller excludes `a == b`; doctrine 3, identity is not rhyme, and
        counting it would make every refrain word its own modal partner.
        """
        if word in self._rk:
            return self._rk[word]
        prons = self.lex.entries.get(word)
        key = None
        if prons:
            anc = anchor(syllabify(prons[0]))
            if anc:
                out = [anc[0]["nucleus"]] + list(anc[0]["coda"])
                for s in anc[1:]:
                    out += list(s["onset"]) + [s["nucleus"]] + list(s["coda"])
                key = tuple(out)
        self._rk[word] = key
        return key

    # -- the sweep -----------------------------------------------------------

    def build(self):
        """-> (end, pair, stats).

        `end[(word, author)] = n` line-final occurrences.
        `pair[(a, b, author)] = n` perfect-rhyme co-occurrence inside one item,
        `a < b`, counted once per ordered position pair.
        """
        end = collections.Counter()
        pair = collections.Counter()
        stats = collections.Counter()
        files = sorted(f for f in os.listdir(SONG)
                       if f.startswith("eng_") and f.endswith(".txt"))
        for base in files:
            author = base[:-4]
            item_ends = []
            with open(os.path.join(SONG, base), encoding="utf-8") as fh:
                for raw in fh:
                    s = raw.rstrip("\n").rstrip()
                    if s.startswith("--- TITLE:"):
                        stats["items"] += 1
                        self._pairs(item_ends, pair, author, stats)
                        item_ends = []
                        continue
                    if not s.strip() or _MARKER.match(s):
                        continue
                    stats["lines"] += 1
                    w, st = self.endword(s)
                    stats["end_" + st] += 1
                    if st == "ok":
                        end[(w, author)] += 1
                        item_ends.append(w)
            self._pairs(item_ends, pair, author, stats)
            stats["authors"] += 1
        return end, pair, stats

    def _pairs(self, ends, pair, author, stats):
        if len(ends) < 2:
            return
        keys = [(w, self.rime_key(w)) for w in ends]
        for i in range(len(keys)):
            wi, ki = keys[i]
            if ki is None:
                continue
            for j in range(i + 1, len(keys)):
                wj, kj = keys[j]
                if kj is None or ki != kj or wi == wj:
                    continue
                a, b = sorted((wi, wj))
                pair[(a, b, author)] += 1
                stats["pairs"] += 1


_END_HEAD = """\
# LINE-FINAL word counts over corpus/song/eng_*, PER AUTHOR.
#
# Generated by quality/build_song_frequency.py. Declared in data/sources.tsv,
# which states what this file may NOT be used to score.
#
# NOT INDEPENDENT OF corpus/song/. These counts ARE that corpus, so scoring
# any text drawn from it requires leave-one-author-out, which is what the
# `author` column is for -- doctrine 13, a resource used to score a cell may
# not be derived from that cell. `quality/frequency.py` refuses to serve this
# table for an author it contains unless `leave_out=` is passed.
#
# `author` is the corpus file's basename without `.txt`, which is the key
# `data/lyricists.tsv:corpus_path` uses.
#
# THE PERIOD IS A COORDINATE OF THIS FILE, NOT A FOOTNOTE. All 143 authors
# died in or before 1929 (median 1867), because the provenance gate admits
# nothing later. So this is a model of what was predictable in ENGLISH SUNG
# VERSE BEFORE 1930, and `thee` is its rank-2 line-final word. Doctrine 11
# has already caught two features reading period rather than quality; assume
# this one does too until a measurement says otherwise.
word\tauthor\tcount
"""

_PAIR_HEAD = """\
# PERFECT-RHYME co-occurrence at the line-final position inside one item,
# over corpus/song/eng_*, PER AUTHOR. `a` < `b` lexicographically.
#
# Generated by quality/build_song_frequency.py. Declared in data/sources.tsv.
#
# THIS IS THE CONDITIONAL, and it is the point of the file: doctrine 9 is not
# about how common a word is, it is about which word a writer reaches for
# GIVEN the call word. P(b | a) is estimated from this table; the global
# unigram rank that `quality/revise.py` currently uses is a different quantity
# and `quality/RESULTS_SONG_FREQUENCY.md` measures how differently it behaves.
#
# The class is "identical from the last stressed vowel onward", the phonetic
# MAXIMUM doctrine 9 names. RIME_RICHE is inside it; REPEAT (a == b) is not.
#
# NOT INDEPENDENT OF corpus/song/ -- see the header of song_endword_en.tsv.
a\tb\tauthor\tcount
"""


def write(end, pair):
    with open(END_TSV, "w", encoding="utf-8") as f:
        f.write(_END_HEAD)
        for (w, a), n in sorted(end.items(), key=lambda kv: (-kv[1], kv[0])):
            f.write("%s\t%s\t%d\n" % (w, a, n))
    with open(PAIR_TSV, "w", encoding="utf-8") as f:
        f.write(_PAIR_HEAD)
        for (a, b, au), n in sorted(pair.items(), key=lambda kv: (-kv[1], kv[0])):
            f.write("%s\t%s\t%s\t%d\n" % (a, b, au, n))


def main(argv):
    b = SongFrequencyBuilder()
    end, pair, stats = b.build()
    print("  corpus/song/eng_*  ->  the rhyme-position tables")
    for k in sorted(stats):
        print("    %-22s %9s" % (k, format(stats[k], ",")))
    print("    %-22s %9s" % ("end types", format(len(set(w for w, _ in end)), ",")))
    print("    %-22s %9s" % ("pair types",
                             format(len(set((a, b) for a, b, _ in pair)), ",")))
    refused = sum(v for k, v in stats.items()
                  if k.startswith("end_") and k != "end_ok")
    print("    %-22s %9s  (%.2f%% of sung lines)"
          % ("end slots REFUSED", format(refused, ","),
             100.0 * refused / max(stats["lines"], 1)))
    if "--census" in argv:
        print("\n  --census: nothing written")
        return 0
    write(end, pair)
    for p in (END_TSV, PAIR_TSV):
        print("    wrote %s  (%s bytes)"
              % (os.path.relpath(p, ROOT), format(os.path.getsize(p), ",")))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
