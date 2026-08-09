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

import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))


class LabelDependencyError(RuntimeError):
    """Raised when a frequency source derived from the labelled pool is used
    to score that pool."""


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


class FrequencyLayer:
    """Registry. Serving a source runs its independence check first."""

    def __init__(self):
        self._sources = {}
        self._lists = {}

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

    def ranks(self, cell, limit=200000):
        """-> {token: rank}, rank 0 = most frequent. Loaded lazily."""
        s = self.source_for(cell)
        if cell in self._lists:
            return self._lists[cell]
        if s.name.startswith("wordfreq:"):
            from wordfreq import top_n_list
            lang = s.name.split(":", 1)[1]
            toks = top_n_list(lang, limit)
            self._lists[cell] = {t: i for i, t in enumerate(toks)}
        else:
            raise NotImplementedError(
                f"loader for {s.name!r} not implemented; declare a wordfreq "
                f"source or add a loader")
        return self._lists[cell]

    def declared(self):
        return sorted(self._sources)

    def report(self, stream=sys.stdout):
        print(f"\n  {'cell':<6} {'source':<18} {'types':>9}  {'indep':>6}  "
              f"licence", file=stream)
        print(f"  {'-' * 66}", file=stream)
        for c in self.declared():
            s = self._sources[c]
            print(f"  {c:<6} {s.name:<18} {s.n_types:>9,}  "
                  f"{'YES' if not s.derived_from_pool else 'NO':>6}  "
                  f"{s.licence}", file=stream)


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

#: Cells with NO independent frequency source. Declared here explicitly so the
#: gap is visible; requesting one raises rather than silently falling back.
NO_INDEPENDENT_SOURCE = {
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
