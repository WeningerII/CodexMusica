"""Shared span vocabulary without the relation registry (M-74).

Both slots and relations import these same objects. Declaring a placement
must not build the schema registry or load its phonology dependencies.
The relations module re-exports the vocabulary for existing callers.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class SpanRule:
    """How to FIND a member.  Per member, which is the whole point: cynghanedd
    draws is A head-anchored and total against B tail-anchored and searched,
    and no global alignment value can express that.
    """
    locus: str          # where to look for candidates
    anchor: str = "word_start"
    direction: int = 1
    magnitude: object = "to_word_end"
    cross_word: bool = False
    requires: tuple = ()
    # `terminator` was HERE and was DELETED on 2026-08-11 (defect P2).  It was
    # declared on all 154 member rules and read by none, and the deletion is
    # the honest close rather than a wiring, because the field could not be
    # given a semantics without inventing one: `_spans_at` receives `ids` --
    # the unit list OF THE LOCUS -- so there is no frame-versus-locus edge left
    # to choose between.  Whatever clipping a terminator would express has
    # already happened by the time the rule runs.  MEASURED before removal
    # (relations.INERT[0] records the command): 153 of 154 rules carried the
    # default `word_edge` and one carried `frame_edge`; no magnitude in the
    # registry mapped to two different terminators, so the field was a strict
    # function of `magnitude` and carried exactly zero information.  The single
    # non-default was `broken rhyme`, whose magnitude `to_frame_edge` already
    # says it and whose branch reads `split_right` off the unit.
    # NOT a precedent for rhyme_constraints.Span.terminator, which is a
    # different class in a different module and IS read there (see relations.INERT[1]).

    def caps(self):
        need = set(self.requires)
        if self.anchor in ("last_stressed", "final_stressed_scope", "penult_stressed"):
            need.add("prominence")
        if self.locus in ("half_line_a", "half_line_b"):
            need.add("caesura")
        if self.locus == "lift":
            need.add("lifts")
        if self.locus == "line_final_before_refrain":
            need.add("refrain_tail")
        return tuple(sorted(need))


# -- span rules used repeatedly
END_ANCHOR = SpanRule("line_final_token", "last_stressed", 1, "to_word_end")
END_WORD = SpanRule("line_final_token", "word_start", 1, "to_word_end")
END_LAST = SpanRule("line_final_token", "word_end", 1, 1)
END_PENULT = SpanRule("line_final_token", "penult", 1, 1)
END_UNSTRESSED = SpanRule("line_final_token", "final_unstressed", 1, 1)
HEAD_ANY = SpanRule("any_token", "word_start", 1, 1)
HEAD_LINE = SpanRule("line_initial_token", "word_start", 1, 1)
WHOLE_LINE = SpanRule("line", "word_start", 1, "whole")
HALF_A = SpanRule("half_line_a", "word_start", 1, "whole")
HALF_B = SpanRule("half_line_b", "word_start", 1, "whole")
FREE_MULTI = SpanRule("free_run", "searched", 1, (2, 6), cross_word=True)
