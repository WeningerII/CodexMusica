#!/usr/bin/env python3
"""Independent frequency layer — blocker 1.

WHY THIS EXISTS

A drafted matrix design built per-cell frequency lists by leave-one-out over
the *labelled pool*. In Finnish the pool is 89,247 poems, not 7,555 types, so a
type collected in 362 variants contributes 362 near-identical texts and LOO
removes one of them. After LOO:

    a word unique to a singleton type      -> corpus count 0
    the same word in a 362-variant type    -> corpus count 361

Any frequency-ranked feature at the marked position is therefore a monotone
function of variant count, and variant count IS the label. The design's
headline prediction had a purely mechanical route to confirmation.

Czech fails the same way and worse, because there it is label-CONDITIONAL: the
positives are the poems that appear in two books, so after item-level LOO a
positive's vocabulary survives once and a negative's zero times.

THE FIX IS STRUCTURAL, NOT ADVISORY

A frequency source must declare whether it is derived from the pool it will be
used to score. A source with `derived_from_pool=True` is REFUSED. Passing an
override requires a written justification that is stored and echoed, so the
dependence appears in the run log rather than in nobody's memory.

This is doctrine 13 made mechanical: any resource used to score a cell must be
independent of that cell's label.
"""

import collections
import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
DATA = os.path.join(HERE, "..", "data")


class LabelDependencyError(RuntimeError):
    """Raised when a frequency source derived from the labelled pool is used
    to score that pool."""


class UndeclaredScoringError(RuntimeError):
    """Raised when a pool-derived source is SERVED without the caller saying
    what it is about to score.

    Declaring the dependence once, at import, is not the same as honouring it
    at every call site. This is the second half of doctrine 13 and it is the
    half a written justification cannot deliver: `justification` records that
    somebody thought about it in 2026, and this records that THIS call is not
    the circle. Same move doctrine 48 made for doctrine 9 -- a principle that
    lives only in prose gets followed exactly as often as someone remembers it.
    """


#: Value of `scoring=` meaning "the text being scored is not in any corpus" --
#: the revision loop's case, where the lines are ones the model has just
#: written and no table can contain them. Spelled out rather than defaulted,
#: because a default is what an argument silently becomes.
UNSEEN = "unseen"


@dataclass
class FrequencySource:
    """A declared frequency resource for ONE cell."""

    cell: str
    name: str
    #: THE load-bearing field. True means the counts were computed from the
    #: same corpus the labels describe.
    derived_from_pool: bool
    licence: str = ""
    n_types: int = 0
    register_note: str = ""
    justification: str = ""      # required if derived_from_pool is True

    #: WHICH pool, as a path glob. Empty when `derived_from_pool` is False.
    #: `justification` says why the dependence is tolerable; this says what it
    #: is a dependence ON, which is what makes it checkable rather than
    #: readable.
    pool: str = ""
    #: The unit leave-one-out removes -- "author", "item", "" for none. A
    #: pool-derived source with no `loo_unit` can only ever be served for
    #: `UNSEEN` text, because there is no correction to apply.
    loo_unit: str = ""
    #: What this source may NOT be used to score, in one sentence, echoed on
    #: every refusal so the reason travels with the error.
    may_not_score: str = ""
    #: `data/` files this source loads from, for the provenance echo.
    files: tuple = ()

    def check(self):
        if not self.derived_from_pool:
            return
        if not self.justification.strip():
            raise LabelDependencyError(
                f"cell {self.cell!r}: frequency source {self.name!r} is derived "
                f"from the labelled pool and carries no justification. This is "
                f"the defect that made a predicted inversion mechanically "
                f"guaranteed. Supply an independent source, or state the "
                f"dependence and argue its direction in `justification`.")

    def check_scoring(self, scoring, known_units):
        """Refuse to be SERVED unless the caller has said what it is scoring.

        `scoring` is either `UNSEEN` or a unit key present in the table, in
        which case that unit's counts are left out. There is no third value
        and no default: a pool-derived source served against unnamed text is
        the circle doctrine 13 is about, and the whole point of this module is
        that the circle is unreachable rather than discouraged.
        """
        if not self.derived_from_pool:
            return None
        if scoring is None:
            raise UndeclaredScoringError(
                f"cell {self.cell!r}: {self.name!r} is derived from "
                f"{self.pool!r}, so serving it requires `scoring=`. Pass "
                f"`scoring=frequency.UNSEEN` for text that is in no corpus "
                f"(the revision loop's case), or `scoring=<{self.loo_unit}>` "
                f"to have that {self.loo_unit}'s counts left out. "
                f"MAY NOT SCORE: {self.may_not_score}")
        if scoring == UNSEEN:
            return None
        if not self.loo_unit:
            raise LabelDependencyError(
                f"cell {self.cell!r}: {self.name!r} declares no `loo_unit`, so "
                f"there is no leave-one-out to apply and it can only be served "
                f"for {UNSEEN!r} text. MAY NOT SCORE: {self.may_not_score}")
        if scoring not in known_units:
            raise LabelDependencyError(
                f"cell {self.cell!r}: {scoring!r} is not a {self.loo_unit} in "
                f"{self.name!r}, so leaving it out would be a no-op that LOOKS "
                f"like a correction. If the text really is outside the pool, "
                f"say so with `scoring=frequency.UNSEEN`. Known "
                f"{self.loo_unit}s: {len(known_units)}.")
        return scoring


class FrequencyLayer:
    """Registry. Serving a source runs its independence check first."""

    def __init__(self):
        self._sources = {}
        self._lists = {}
        self._song = {}

    def declare(self, source):
        source.check()
        self._sources[source.cell] = source
        return source

    def source_for(self, cell):
        if cell not in self._sources:
            raise KeyError(
                f"no frequency source declared for cell {cell!r}. Scoring a "
                f"cell without a declared source is refused rather than "
                f"defaulted. Declared: {sorted(self._sources)}")
        s = self._sources[cell]
        s.check()
        return s

    def ranks(self, cell, limit=200000, scoring=None):
        """-> {token: rank}, rank 0 = most frequent. Loaded lazily.

        `scoring` is required for a pool-derived source and names what is
        about to be scored -- `UNSEEN`, or a unit whose counts are dropped.
        An independent source ignores it, so the argument costs nothing where
        it is not needed and cannot be forgotten where it is.
        """
        s = self.source_for(cell)
        if s.name.startswith("song:"):
            return self._song_ranks(s, scoring)
        s.check_scoring(scoring, ())
        if cell in self._lists:
            return self._lists[cell]
        if s.name.startswith("wordfreq:"):
            from wordfreq import top_n_list
            lang = s.name.split(":", 1)[1]
            toks = top_n_list(lang, limit)
            self._lists[cell] = {t: i for i, t in enumerate(toks)}
        elif s.name.startswith("file:"):
            path = os.path.join(DATA, s.name.split(":", 1)[1])
            r = {}
            with open(path, encoding="utf-8") as f:
                for line in f:
                    w = line.split("\t")[0].strip().lower()
                    if w and not w.startswith("#"):
                        r.setdefault(w, len(r))
            self._lists[cell] = r
        else:
            raise NotImplementedError(
                f"loader for {s.name!r} not implemented; declare a wordfreq "
                f"source or add a loader")
        return self._lists[cell]

    # -- the song tables --------------------------------------------------
    #
    # Two accessors rather than one, because they are two different
    # instruments and the whole finding in RESULTS_SONG_FREQUENCY.md is that
    # they do not behave alike. `ranks` is a global order; `conditional` is
    # P(partner | call). Merging them behind one name would hide the choice
    # that matters.

    def _song_tables(self, s):
        key = s.name
        if key in self._song:
            return self._song[key]
        end = collections.defaultdict(collections.Counter)
        pair = collections.defaultdict(lambda: collections.defaultdict(
            collections.Counter))
        units = set()
        with open(os.path.join(DATA, "song_endword_en.tsv"), encoding="utf-8") as f:
            for line in f:
                if line.startswith("#") or line.startswith("word\t"):
                    continue
                w, a, n = line.rstrip("\n").split("\t")
                end[w][a] += int(n)
                units.add(a)
        with open(os.path.join(DATA, "song_rhymepair_en.tsv"), encoding="utf-8") as f:
            for line in f:
                if line.startswith("#") or line.startswith("a\t"):
                    continue
                a, b, au, n = line.rstrip("\n").split("\t")
                n = int(n)
                pair[a][b][au] += n
                pair[b][a][au] += n
        self._song[key] = (end, pair, units)
        return self._song[key]

    def _song_ranks(self, s, scoring):
        end, _, units = self._song_tables(s)
        drop = s.check_scoring(scoring, units)
        c = collections.Counter()
        for w, per in end.items():
            n = sum(v for a, v in per.items() if a != drop)
            if n:
                c[w] = n
        return {w: i for i, (w, _) in enumerate(c.most_common())}

    def conditional(self, cell, call, scoring=None):
        """-> Counter {partner: n}, the words realised as `call`'s line-final
        perfect-rhyme partner, leave-one-unit-out per `scoring`.

        THIS IS THE INSTRUMENT DOCTRINE 9 NAMES. The doctrine is not about how
        common a word is; it is about which word a writer reaches for GIVEN
        the call word. Measured leave-one-author-out over 1,760 (author, call
        word) cells, the six words this ranks highest cover 63.2% of what the
        held-out author actually reached for, against 16.9% for the shipped
        web list and 3.6% for six words drawn at random from the same field --
        and every source forbids exactly six, so the comparison is by LIFT and
        not by yield (doctrine 61). See quality/RESULTS_SONG_FREQUENCY.md.
        """
        s = self.source_for(cell)
        if not s.name.startswith("song:"):
            raise NotImplementedError(
                f"cell {cell!r} source {s.name!r} is a global rank and has no "
                f"conditional. Only the song tables carry P(partner | call).")
        _, pair, units = self._song_tables(s)
        drop = s.check_scoring(scoring, units)
        out = collections.Counter()
        for b, byau in pair.get(call, {}).items():
            n = sum(v for a, v in byau.items() if a != drop)
            if n:
                out[b] = n
        return out

    def declared(self):
        return sorted(self._sources)

    def report(self, stream=sys.stdout):
        print(f"\n  {'cell':<11} {'source':<28} {'types':>9}  {'indep':>6}  "
              f"loo", file=stream)
        print(f"  {'-' * 72}", file=stream)
        for c in self.declared():
            s = self._sources[c]
            print(f"  {c:<11} {s.name:<28} {s.n_types:>9,}  "
                  f"{'YES' if not s.derived_from_pool else 'NO':>6}  "
                  f"{s.loo_unit or '—'}", file=stream)
            if s.licence:
                print(f"  {'':<11} licence: {s.licence[:96]}", file=stream)
            if s.may_not_score:
                print(f"  {'':<11} MAY NOT SCORE: {s.may_not_score[:92]}",
                      file=stream)


# ---------------------------------------------------------------------------
# Declared sources. wordfreq is independent of every corpus in this project:
# its counts come from Wikipedia, subtitles, news, books and web text, none of
# which is the labelled verse pool of any cell.
# ---------------------------------------------------------------------------

WORDFREQ_LICENCE = "Apache-2.0 (code) / CC BY-SA 4.0 (data)"

LAYER = FrequencyLayer()

for _cell, _lang, _n, _note in [
    ("fi",  "fi", 733683, "Finnish. Independent of SKVR."),
    ("ces", "cs", 605550, "Czech. Independent of corpusCzechVerse."),
    ("nl",  "nl", 310781, "Dutch."),
    ("spa", "es", 341461, "Spanish. Independent of DISCO."),
    ("he",  "he", 591598, "Modern Hebrew; REGISTER MISMATCH against medieval "
                          "and biblical verse, but independent of the label."),
    ("ar",  "ar", 619906, "Modern Arabic; register mismatch against premodern "
                          "verse. Independent of OpenITI."),
    ("ja",  "ja", 214936, "Modern Japanese; REGISTER MISMATCH against "
                          "classical waka. Independent of the Hachidaishu."),
    ("ta",  "ta",  68414, "Tamil, small list only."),
]:
    LAYER.declare(FrequencySource(
        cell=_cell, name=f"wordfreq:{_lang}", derived_from_pool=False,
        licence=WORDFREQ_LICENCE, n_types=_n, register_note=_note))

# ---------------------------------------------------------------------------
# ENGLISH. Three sources, because they are three different instruments and the
# measurement is that they do not behave alike.
#
# THE CELL THAT HAD NO ROW. `eng` was absent from this registry AND from
# NO_INDEPENDENT_SOURCE, while being the only cell whose frequency source is
# actually WIRED INTO A SHIPPED DECISION: `lyric_harness.Lexicon.freq_rank`
# reads `wordfreq20k.txt`, and `quality/revise.py` ranks the band-passing
# candidates by it to mark the most frequent as FORBIDDEN. That is doctrine 48
# -- doctrine 9 made mechanical -- resting on a list this module had never
# seen. The seven declared cells here are all ones nothing scores.
# ---------------------------------------------------------------------------

#: What `lyric_harness.py` actually reads today, declared so it is visible
#: rather than implicit. Provenance RESOLVED 2026-08-11: the file is
#: byte-identical to `first20hours/google-10000-english/20k.txt`
#: (md5 c0190594b2a3a30a89bd0367b0892e0e), which derives from Peter Norvig's
#: `count_1w.txt` over the Google Web Trillion Word Corpus -- "one trillion
#: words from public Web pages". `data/sources.tsv` had it as UNDETERMINED.
LAYER.declare(FrequencySource(
    cell="eng-web", name="file:../wordfreq20k.txt", derived_from_pool=False,
    licence="CONTESTED — upstream LICENSE.md: 'Educational and personal/"
            "research use ... permitted under the LDC license, Norvig's MIT "
            "license ... and US fair use doctrine. I do not recommend using "
            "this data for commercial purposes without licensing it from the "
            "Linguistic Data Consortium.' See data/sources.tsv; doctrine 85.",
    n_types=20000,
    register_note=(
        "WEB ENGLISH, 2006. Independent of every verse corpus here, and "
        "independent in the WRONG WAY: it is not verse, not sung, and not "
        "line-final. `email` 115, `click` 94, `software` 152, `yahoo` 499 "
        "against `moon` 2801, `rain` 2947, `grief` 10700; `weep`, `wept`, "
        "`mourn`, `doth`, `ere`, `wilt` are ABSENT. Because "
        "`CandidateEngine` skips any word with no rank, absence is not a "
        "ranking penalty -- it removes the word from the candidate universe, "
        "and 106,916 of 124,926 a-z CMUdict words (85.6%) are removed. "
        "Measured against held-out authors it blocks 16.9% of the partners "
        "writers actually reach for."),
))

#: The REGISTER fix, and only that. Independent of every corpus in this repo.
LAYER.declare(FrequencySource(
    cell="eng-spoken", name="file:opensubtitles_en_50k.tsv",
    derived_from_pool=False,
    licence="MIT (hermitdave/FrequencyWords) over OpenSubtitles 2018 (OPUS)",
    n_types=50000,
    register_note=(
        "SPOKEN English, contemporary. Inverts the web list's pathology "
        "exactly: `moon` outranks `yahoo` 13.7x where the web list had "
        "`yahoo` outranking `moon` 5.6x, and `weep`/`wept`/`mourn` exist. "
        "Still a GLOBAL UNIGRAM RANK, so it does not fix the instrument -- "
        "21.4% coverage against the web list's 16.9%. The register step is "
        "real and small; see RESULTS_SONG_FREQUENCY.md §3."),
))

#: The instrument doctrine 9 actually names. NOT independent of corpus/song/.
LAYER.declare(FrequencySource(
    cell="eng-song", name="song:corpus/song/eng_*", derived_from_pool=True,
    licence="derived here from corpus/song/eng_*, whose 143 files carry their "
            "own public-domain rows in data/sources.tsv",
    n_types=10401,
    pool="corpus/song/eng_*",
    loo_unit="author",
    files=("data/song_endword_en.tsv", "data/song_rhymepair_en.tsv"),
    may_not_score=(
        "any text drawn from corpus/song/ without `scoring=<that author>`; "
        "and no threshold calibrated with it may then be MEASURED on "
        "corpus/song/ (doctrine 14 — a control may not be defined in terms of "
        "the quantity it controls)"),
    justification=(
        "The dependence is REAL and the correction is EXACT rather than "
        "argued. Doctrine 13's last sentence asks for the dependence to be "
        "stated and its direction argued before the run; this goes one step "
        "further and removes it, because the tables are keyed per author and "
        "`check_scoring` refuses to serve them for an author they contain "
        "unless that author is dropped. Every number in "
        "RESULTS_SONG_FREQUENCY.md is leave-one-author-out. For the revision "
        "loop the dependence does not arise at all: the lines being graded "
        "are ones the model has just written and are in no corpus, which is "
        "`scoring=UNSEEN`. WHAT REMAINS UNCORRECTED, and it is not small: "
        "all 143 authors died in or before 1929 (median 1867), so this is a "
        "model of pre-1930 sung English and `thee` is its rank-2 line-final "
        "word. Doctrine 11 has caught two features reading period rather "
        "than quality; the period exposure is MEASURED in "
        "RESULTS_SONG_FREQUENCY.md §5 rather than waved at, and it is the "
        "reason this source is offered beside `eng-spoken` and not instead "
        "of it."),
    register_note=(
        "PRE-1930 SUNG ENGLISH, at the line-final position. The conditional "
        "P(partner | call) blocks 63.2% of what held-out authors actually "
        "reached for, against 16.9% for the shipped web list, at the same "
        "k=6 out of the same candidate field -- so the comparison is lift, "
        "not yield (doctrine 61)."),
))


#: Cells with NO independent frequency source. Declared here explicitly so the
#: gap is visible; requesting one raises rather than silently falling back.
NO_INDEPENDENT_SOURCE = {
    "eng-verse": "CONTEMPORARY English sung verse. This is the source the "
           "modal exclusion actually wants and it does not exist here. "
           "`eng-song` has the right POSITION and the right MEDIUM and the "
           "wrong PERIOD (all 143 authors dead by 1929); `eng-spoken` has "
           "the right period and no line-final position at all. Nothing in "
           "this repo has all three, and nothing can: the provenance gate "
           "admits nothing after 1931 and post-1931 song lyrics are in "
           "copyright. Doctrine 92 -- the admissible source and the complete "
           "source are DISJOINT sets, and this is a third instance. What "
           "would close it: a line-structured, rhyme-bearing, post-1960 "
           "English corpus under a licence this repo accepts. No Tin Pan "
           "Alley, at all.",
    "lzh": "Classical Chinese. wordfreq ships MODERN Chinese (zh) only. Modern "
           "frequencies over Tang/Song verse are a severe register mismatch, "
           "and a classical list built from the pool itself is exactly the "
           "banned construction. Frequency-ranked features are UNAVAILABLE "
           "for this cell until an independent classical list is found.",
    "la": "Latin. Absent from wordfreq.",
    "grc": "Ancient Greek. Absent from wordfreq.",
    "pa": "Punjabi. Absent from wordfreq.",
    "hbo": "Biblical Hebrew. Modern Hebrew (he) is a different language for "
           "frequency purposes, not merely a different register.",
    "syc": "Classical Syriac. No frequency resource found at any scale.",
}


def unavailable(cell):
    return NO_INDEPENDENT_SOURCE.get(cell)


if __name__ == "__main__":
    LAYER.report()
    print(f"\n  cells with NO independent source ({len(NO_INDEPENDENT_SOURCE)}):")
    for c, why in sorted(NO_INDEPENDENT_SOURCE.items()):
        print(f"    {c:<5} {why[:96]}")
