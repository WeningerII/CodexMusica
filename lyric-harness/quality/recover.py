#!/usr/bin/env python3
"""STRUCTURE RECOVERY: the second door into the one pipeline.

THE OWNER'S RULING, 2026-08-23, verbatim: *"If an LLM writes something we go
through all of the steps, if a human does it then we need the same steps. If a
person puts unstructured song in for example, then the beginning must be to
structure it. I'd need what we have built to necessarily count the lines, read
what is written and assign sections and all the other stuff an LLM writer needs
to have done."*

WHAT WAS WRONG. This harness had two entrances and only one of them had a
front half. `quality/plan.py` produces a blueprint and a mandate, so an
LLM-written song reaches the graders with its structure DECLARED. A pasted
song reached them with nothing: the operator hand-wrote a `--groups=` string,
or used `--cliques`, or the run was rhyme-only by omission. So "we go through
all of the steps" was true of one door and false of the other, and every gate
downstream is only as good as what was declared to it.

WHAT THIS IS. The same coordinates a drawn plan carries, RECOVERED from text
instead of sampled — line count, sections, per-line syllable counts, and the
rhyme structure as a cover over PLACEMENTS rather than over line ends. The
output is the plan's own shape, so the same grading command runs on it and the
same gates apply.

EVERY COORDINATE CARRIES HOW IT WAS OBTAINED, and that is the whole discipline
of this module (doctrine 14/20/45). Four provenances, and they are not
interchangeable:

  counted    read off the text by arithmetic nobody can disagree with — the
             line count, the syllables per line. The strongest.
  declared   the text SAID so: a `[SECTION]` mark the writer wrote.
  derived    the harness inferred it from its own measurements — the rhyme
             cover, and the sectioning when only blank lines are available.
             NOT INDEPENDENT OF THE GRADER (doctrine 14), and stamped so,
             exactly as `mandate_from_graph` already stamps its own.
  REFUSED    the coordinate cannot be obtained from this text and is NOT
             guessed. A recovered plan with a refusal in it is a work order,
             not a failure (doctrine 20).

METER IS REFUSED, AND THAT IS THE AMENDED DOCTRINE 4, NOT A GAP. Counting is
this project's instrument — `word_syllable_map` counts syllables, `fit.py`
answers satisfiability against a DECLARED meter — and counting gives
SYLLABLES PER LINE, which this module reports. It does not give a bar grid: a
grid needs a declared tempo/meter, and inferring one from syllable counts
would be the harness declaring a coordinate on the writer's behalf and then
grading them against it. So the syllable counts are counted and reported, and
the meter is refused with the remedy named. (Audio is not the missing
instrument and is not mentioned as one: the owner's standing ban, 2026-08-23.)

Test: python3 quality/test_recover.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if os.path.dirname(HERE) not in sys.path:
    sys.path.insert(0, os.path.dirname(HERE))

from lyric_harness import (Declaration, Lexicon, is_apparatus_line,  # noqa: E402
                           read_lyric_text, word_syllable_map)
from quality import slots as SL                                     # noqa: E402

__all__ = ["Recovered", "recover", "recover_file", "PROVENANCE",
           "RECOVERABLE_PLACEMENTS", "parse_placements", "render"]

#: The four answers a recovered coordinate may carry. Declared as a closed set
#: so a fifth cannot appear by someone writing a new string (the shape
#: `SUPPLY_STATES` and `REQUIREMENTS` already use).
PROVENANCE = ("counted", "declared", "derived", "REFUSED")

#: WHAT A RECOVERED COVER SEARCHES BY DEFAULT — this module's own
#: coordinate since 2026-08-27, and IMPORTED from `slots` rather than
#: respelled, so the two cannot drift (doctrine 1). The value is
#: byte-identical to what this function already used, so no recovered
#: cover moves; what changes is whose question it answers.
#:
#: IT WAS `slots.PLANNABLE_PLACEMENTS` READ AS A BOUND ON OBSERVATION, and
#: that tuple's own docstring scopes it to *"WHAT A PLANNER MAY
#: VOLUNTEER"*. Its exclusion of `T<n>` is argued there as *"a planner
#: draws it with the index bounded by what a line reliably HAS, which is a
#: coordinate of the plan and not of this table"* — an argument about
#: VOLUNTEERING an index. **RECOVERY DOES NOT VOLUNTEER: it OBSERVES a
#: text that already exists, so the index is READ and not drawn, and the
#: exclusion's own argument does not transfer** (`MISSING.md` M-145, the
#: ruling; `quality/door_census.py`'s `recover` row carries it in full).
#: So a RECOVERED `T4` binding is ADMISSIBLE where a PLANNED one is not.
#:
#: THE DEFAULT STAYS AT THE FOUR ANYWAY, and that is not a contradiction:
#: admissible is not the same as searched-unasked. A default sweeping
#: every `T<n>` would be recovery volunteering a maximal web, which is the
#: same move one layer over. MEASURED over 12 lines of
#: `songs/crooked_waltz.txt`: the default gives 41 binding sites and 113
#: edges, 0 naming a `T<n>`; `--placements=end,endword,head,headrime,T2,
#: T3,T4` gives 60 sites and 256 edges of which 143 name one. So the
#: coordinate is real, it is DECLARED, and it is the caller's.
RECOVERABLE_PLACEMENTS = SL.PLANNABLE_PLACEMENTS


def parse_placements(spec):
    """`"end,head,T4"` -> a tuple, REFUSING an unresolvable name by name.

    The refusal is here and not in `_slot_words`, which SKIPS a placement
    naming nothing IN A GIVEN LINE — a different question, and a correct
    skip. Leaning on it would make a mistyped `--placements=T4x` silently
    NARROW the search and report the smaller web as the text's (doctrine
    20: a refusal is not an absence). Validated ONCE, at declaration.
    """
    out = []
    for raw in spec.split(","):
        name = raw.strip()
        if not name:
            continue
        try:
            SL.parse_slot(f"1.{name}")
        except SL.SlotUnsupported as exc:
            raise SL.SlotUnsupported(
                f"--placements names {name!r}, which this module cannot "
                f"resolve to a span of a line: {exc}") from None
        out.append(name)
    if not out:
        raise SL.SlotUnsupported(
            "--placements was declared and names no placement. An empty "
            "declaration is not the default; say nothing to get "
            f"{list(RECOVERABLE_PLACEMENTS)}.")
    return tuple(out)


class Recovered(dict):
    """A recovered plan. A dict so it serialises like `make_plan`'s output,
    with `.how` naming each coordinate's provenance beside it."""

    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self.how = {}

    def put(self, key, value, how, why=""):
        if how not in PROVENANCE:
            raise ValueError(f"provenance {how!r} is not one of "
                             f"{PROVENANCE}")
        self[key] = value
        self.how[key] = (how, why)
        return value

    def refusals(self):
        return {k: why for k, (how, why) in self.how.items()
                if how == "REFUSED"}


def _sections_from_marks(raw_lines):
    """-> [(name, [0-based line indices])] from `[SECTION]` marks, or None.

    Reads the marks with `is_apparatus_line`'s own predicate — the ONE
    definition of what an apparatus line is (2026-08-12/13, and the four
    holdouts that centralisation took to find). A mark is apparatus AND a
    boundary, which is why this cannot be a filter at the top: the line has
    to be seen before it is dropped.
    """
    out, cur, name = [], [], None
    for i, raw in enumerate(raw_lines):
        s = raw.strip()
        if s.startswith("[") and s.endswith("]") and len(s) > 2:
            if name is not None:
                out.append((name, cur))
            name, cur = s[1:-1].strip(), []
            continue
        if is_apparatus_line(raw) or not s:
            continue
        cur.append(i)
    if name is not None:
        out.append((name, cur))
    return out or None


def _sections_from_blanks(raw_lines):
    """-> [(name, [0-based indices])] from blank-line blocks.

    DERIVED, not declared: a blank line is a printer's convention and this
    module says so in the provenance rather than in a comment nobody reads.
    The same frame `relations.build_stream` derives its stanzas from, so the
    two layers agree about what a stanza break is (doctrine 1).
    """
    out, cur = [], []
    for i, raw in enumerate(raw_lines):
        if is_apparatus_line(raw):
            continue
        if not raw.strip():
            if cur:
                out.append((f"BLOCK{len(out) + 1}", cur))
                cur = []
            continue
        cur.append(i)
    if cur:
        out.append((f"BLOCK{len(out) + 1}", cur))
    return out or None


def _slot_words(lex, line, placements):
    """-> {placement: (anchors, label)} for one line, skipping the placements
    that name nothing in it.

    A placement with no referent is SKIPPED and not recorded as empty: `head`
    read as a rhyme span names nothing in a line opening on a function word,
    and reporting that as a binding site with no word would be a claim about
    a position this line does not have (`slots.resolve`'s own rule).
    """
    out = {}
    for place in placements:
        try:
            slot = SL.parse_slot(f"1.{place}")
        except SL.SlotUnsupported:
            continue
        anc, label, _ = SL.resolve(lex, line, slot)
        if anc and label:
            out[place] = (anc, label)
    return out


def recover(lines, raw_lines=None, lex=None, decl=None, placements=None,
            theta=None, max_pairs=200_000):
    """Text in, a recovered plan out. -> `Recovered`.

    `lines` is the sung text (apparatus already dropped); `raw_lines` is the
    file as printed, needed because SECTION MARKS and BLANK LINES are
    apparatus to the graders and structure to this module — the one place in
    the repository where a dropped line is the coordinate being recovered.
    """
    lex = lex or Lexicon()
    decl = decl or Declaration()
    # WHOSE CUT THIS COVER IS BUILT AT, AND WHY IT IS NOT A FLAT ONE
    # (2026-09-02, `MISSING.md` M-138). Every edge below is a band-passing
    # pair BY CONSTRUCTION and the whole doctrine-14 sentence this module
    # ships on — that handing `--groups=` back to the grader "cannot produce
    # a rhyme violation" — is TRUE only while this admit asks the SAME
    # question the grader asks. The near-relation pricing gave the grader a
    # PER-RELATION cut (`Declaration.theta_by_relation`, ASSONANCE 0.82), so
    # a flat `theta_rhyme` here builds covers the grader then charges: M-139's
    # exact shape, in the module whose own claim depends on not having it.
    # `theta_for` is read per pair below when the caller declared no theta;
    # a DECLARED theta still wins outright, because that is a caller stating
    # the coordinate and this module does not overrule it (doctrine 1).
    theta_declared = theta is not None
    theta = decl.theta_rhyme if theta is None else theta
    places = tuple(placements or RECOVERABLE_PLACEMENTS)
    r = Recovered()
    r.put("placements_searched", list(places),
          "declared" if placements else "derived",
          "the caller named this set"
          if placements else
          "the caller declared no placement set, so this is "
          "`RECOVERABLE_PLACEMENTS` — a default of this module's, not a fact "
          "about the text (`MISSING.md` M-145)")

    # 1. THE LINE COUNT. Counted, and the least disputable thing here.
    r.put("total_lines", len(lines), "counted",
          "len() of the sung lines after the one apparatus predicate")
    if not lines:
        r.put("sections", [], "REFUSED", "the text carries no sung line")
        return r

    # 2. SECTIONS. Declared beats derived beats refused, in that order, and
    #    the order is the point: a writer's own mark outranks a printer's
    #    blank line, and a text with neither is REFUSED rather than sectioned
    #    by a rule this module invented (doctrine 20).
    raw = raw_lines if raw_lines is not None else list(lines)
    marked = _sections_from_marks(raw) if raw_lines is not None else None
    if marked:
        r.put("sections", [{"name": n, "lines": len(ix)} for n, ix in marked],
              "declared", "[SECTION] marks the writer wrote")
    else:
        blocks = _sections_from_blanks(raw) if raw_lines is not None else None
        if blocks and len(blocks) > 1:
            r.put("sections",
                  [{"name": n, "lines": len(ix)} for n, ix in blocks],
                  "derived", "blank-line blocks — a printer's convention, "
                             "not the writer's declaration")
        else:
            r.put("sections", [], "REFUSED",
                  "the text carries no [SECTION] mark and no blank-line "
                  "block, so its sectioning cannot be read off it. Mark the "
                  "sections, or declare a blueprint: a sectioning invented "
                  "here would be graded as though the writer had asked for "
                  "it")

    # 3. SYLLABLES PER LINE. Counted — this project's own instrument.
    syl = [len(word_syllable_map(lex, l)) for l in lines]
    r.put("syllables_per_line", syl, "counted",
          "word_syllable_map, the same reader the in-line span layer uses")

    # 4. METER. Refused, with the remedy named. See the module docstring:
    #    counting gives syllables, and a BAR GRID needs a declared meter.
    r.put("meter", None, "REFUSED",
          "a bar grid is a DECLARED coordinate (doctrine 4, as amended "
          "2026-08-23). Counting gives the syllables per line reported "
          "above, and a grid inferred from them would be this harness "
          "declaring a meter on the writer's behalf and then grading them "
          "against it. Declare one with --blueprint= and every meter check "
          "runs")

    # 5. THE WEB. The cover over PLACEMENTS, not over line ends — which is
    #    the whole reason this module is written now rather than in terms of
    #    `mandate_from_graph`, whose cliques are cliques of `words[-1]`.
    from lyric_harness import admits, best_score, theta_for
    sites = []
    for i, line in enumerate(lines):
        for place, (anc, label) in _slot_words(lex, line, places).items():
            sites.append((i + 1, place, anc, label))
    n = len(sites)
    if n * (n - 1) // 2 > max_pairs:
        r.put("web", [], "REFUSED",
              f"{n} binding sites over {len(lines)} lines is "
              f"{n * (n - 1) // 2} pairs, past the declared bound "
              f"{max_pairs}. Recover a section at a time, or raise the "
              f"bound deliberately — a silently truncated web reads as a "
              f"song with fewer relations in it")
        return r
    edges = []
    for a in range(n):
        la, pa, anca, wa = sites[a]
        for b in range(a + 1, n):
            lb, pb, ancb, wb = sites[b]
            if la == lb:
                # SAME-LINE pairs are real figures and are NOT a mandate's
                # business: a group is a set of lines and a relation whose
                # members share a line has one member (`slots`' own refusal).
                # `quality/figures.py` is the reader for them.
                continue
            s = best_score(anca, ancb, decl, wa, wb)
            # `theta_for` unless the caller declared a flat cut — see the
            # note beside `theta_declared` above.
            cut = theta if theta_declared else theta_for(s, decl)
            if s["relation"] == "REPEAT" or admits(
                    s, cut, relations=frozenset(decl.admit)):
                edges.append({"a": f"{la}.{pa}" if pa != "end" else str(la),
                              "b": f"{lb}.{pb}" if pb != "end" else str(lb),
                              "words": (wa, wb),
                              "score": round(s["total"], 3),
                              "relation": s["relation"]})
    # THE COVER AS THE CLI'S OWN MANDATE FLAGS, split on each edge's OWN
    # `relation` and never re-derived. THIS IS NOT A CONVENIENCE — it is the
    # coordinate that makes the doctrine-14 sentence below TRUE, and without
    # it that sentence was FALSE through this module's only documented
    # handoff. A `--groups=` group is REQUIRE_RHYME: identity FORBIDDEN,
    # REPEAT a VIOLATION. This function admits REPEAT edges eleven lines
    # above, so the cover holds TWO demands and they are not the same demand
    # (doctrine 3's second half). MEASURED on `quality/fixtures/song.txt`:
    # the whole web handed to `--groups=` charges **34 SCHEME_VIOLATION**,
    # exactly its 34 REPEAT edges, about pairs this module admitted FOR BEING
    # IDENTICAL — and the same web with the REPEAT edges split off charges
    # **0**. Over 18 pasted-song drafts a lane measured 984 REPEAT edges of
    # 8,673 on 17 of 18 drafts and 972 violations charged.
    repeats = [e for e in edges if e["relation"] == "REPEAT"]
    rhymes = [e for e in edges if e["relation"] != "REPEAT"]
    placed_repeats = [e for e in repeats
                      if "." in str(e["a"]) or "." in str(e["b"])]
    bare_repeats = [e for e in repeats
                    if "." not in str(e["a"]) and "." not in str(e["b"])]
    r.put("mandate_spelling",
          {"--groups=": ";".join(f"{e['a']},{e['b']}" for e in rhymes),
           "--returns=": ";".join(f"{e['a']},{e['b']}"
                                  for e in bare_repeats)},
          "derived",
          f"the cover as the two CLI mandate flags, split on each edge's own "
          f"`relation`: {len(rhymes)} band edge(s) to `--groups=` and "
          f"{len(bare_repeats)} line-level REPEAT class(es) to `--returns=`, "
          f"which is the ONLY spelling under which identity is the "
          f"REQUIREMENT rather than the violation. Handing the WHOLE web to "
          f"`--groups=` charges one SCHEME_VIOLATION per REPEAT edge; this "
          f"split is what makes the doctrine-14 claim below true")
    if placed_repeats:
        r.put("repeats_at_a_placement", len(placed_repeats), "REFUSED",
              f"{len(placed_repeats)} recovered REPEAT edge(s) bind at a "
              f"PLACEMENT, and NO mandate spelling in this harness can hold "
              f"them: `--groups=` charges a REPEAT as a violation, and "
              f"`--returns=` REFUSES any member carrying a locus — "
              f"`quality/schemes.py`'s `_normalise_returns` coerces every "
              f"member with `int(x)`, the SAME `int()` M-72 removed from "
              f"`_normalise_groups` when placement became spellable, one "
              f"function over and unmigrated (measured: "
              f"`--returns=1.head,3` refuses with `invalid literal for "
              f"int() with base 10: '1.head'`). They are NOT flattened to "
              f"their line numbers: `4.head ~ 8.head` spelled `4 ~ 8` "
              f"declares an identity between two line ENDS this module never "
              f"measured. The remedy is `_normalise_returns` taking the slot "
              f"spelling `_normalise_groups` already takes. REFUSED rather "
              f"than dropped, because a silently unspellable binding reads "
              f"as a song with fewer relations in it (doctrine 20)")
    r.put("web", edges, "derived",
          f"every admitted pair over {n} binding sites at {len(places)} "
          f"placements per line, at theta {theta}, at the ADMIT door "
          f"(`decl.admit`) PLUS REPEAT — and neither set contains the other, "
          f"so this is not a NARROWING of the default but a DIFFERENT door. "
          f"NOT INDEPENDENT OF THE "
          f"GRADER (doctrine 14): every edge is a band-passing pair BY "
          f"CONSTRUCTION, so grading this cover against the same band at the "
          f"same theta cannot produce a rhyme violation — THROUGH "
          f"`mandate_spelling` ABOVE, and NOT through `--groups=` alone, "
          f"which charges every REPEAT edge. What it CAN say "
          f"non-trivially is everything the band did not decide. AND THIS IS "
          f"THE ADMIT DOOR ONLY: the grader that will judge this cover also "
          f"accepts a pair whose two lines stand in ANY of the 77 registered "
          f"schemas (`relations.whole_vocabulary_pairs`, `MISSING.md` M-116) "
          f"whenever `admit_is_default` holds, and that route is NOT "
          f"consulted here — so this cover UNDER-recovers against its own "
          f"consumer, measured at +32.0% of line pairs on 18 of 18 drafts. "
          f"Disclosed rather than silent (doctrine 20). RULED "
          f"2026-08-27 (`MISSING.md` M-145): THE NARROW DOOR IS KEPT "
          f"ON PURPOSE and `quality/door_census.py` rules this site "
          f"ARGUED. This function is a GENERATOR — it puts the door "
          f"to EVERY pair — and on that population "
          f"`quality/chance_rate.py --null` measures the 77-schema "
          f"door AT CHANCE (69.05% against a null median 71.02%, "
          f"p 0.9048) while the same door separates by +12.50 pp "
          f"over the null MAX on the DECLARED pairs a writer wrote. "
          f"The grader's 77-consult is a RESCUE on a declared pair; "
          f"running it as a GENERATOR here would manufacture "
          f"structure rather than find it (doctrine 71). The +32.0% "
          f"above is what that ruling COSTS, and it is stated rather "
          f"than netted away")
    r.put("binding_sites", n, "counted",
          "line x placement, skipping placements that name nothing in "
          "their line")
    return r


def recover_file(path, **kw):
    """A file in, a recovered plan out. Reads it ONCE, through the one
    decoder (`read_lyric_text`), and hands both views to `recover`."""
    raw = read_lyric_text(path).splitlines()
    sung = [l for l in raw if l.strip() and not is_apparatus_line(l)]
    return recover(sung, raw_lines=raw, **kw)


def render(r):
    """The recovered plan as a report, every coordinate beside its
    provenance. The refusals are printed LAST and loudest: they are the work
    order this module exists to produce."""
    out = ["RECOVERED STRUCTURE — every coordinate with how it was obtained",
           "  counted = arithmetic on the text | declared = the text said so",
           "  derived = the harness inferred it (NOT independent of the "
           "grader, doctrine 14) | REFUSED = not obtainable, not guessed",
           ""]
    places = r.get("placements_searched")
    if places:
        out.append(f"  PLACEMENTS SEARCHED: {', '.join(places)}")
        out.append("      the web is over these and no others — a placement "
                   "not searched is not a placement the text lacks "
                   "(doctrine 20). `--placements=` declares otherwise; "
                   "`quality/recover.py`'s `RECOVERABLE_PLACEMENTS` is the "
                   "default and the argument for it.")
        out.append("")
    for key in ("total_lines", "sections", "syllables_per_line",
                "binding_sites", "web", "meter"):
        if key not in r:
            continue
        how, why = r.how[key]
        val = r[key]
        if key == "web":
            shown = f"{len(val)} admitted pair(s)"
        elif key == "sections":
            shown = (", ".join(f"{s['name']}({s['lines']})" for s in val)
                     or "none")
        elif key == "syllables_per_line":
            shown = (f"{min(val)}-{max(val)} syllables, "
                     f"{sum(val)} total" if val else "none")
        else:
            shown = str(val)
        out.append(f"  {key:20s} [{how}] {shown}")
        if why and how in ("derived", "REFUSED"):
            out.append(f"      {why}")
    bad = r.refusals()
    out.append("")
    out.append(f"  {len(bad)} REFUSED coordinate(s) — each is a work order, "
               f"not a failure (doctrine 20)")
    for k in bad:
        out.append(f"      {k}")
    return "\n".join(out)


if __name__ == "__main__":
    args = sys.argv[1:]
    spec = None
    rest = []
    for a in args:
        if a.startswith("--placements="):
            spec = a.split("=", 1)[1]
        elif a.startswith("-"):
            print(f"REFUSED — this runner has no flag {a!r}. It takes one "
                  f"LYRIC.txt and, optionally, --placements=a,b,c.")
            raise SystemExit(2)
        else:
            rest.append(a)
    if len(rest) != 1:
        print("usage: python3 quality/recover.py LYRIC.txt "
              "[--placements=end,head,T4]")
        print(f"       default placements: "
              f"{','.join(RECOVERABLE_PLACEMENTS)}")
        raise SystemExit(2)
    try:
        declared = parse_placements(spec) if spec is not None else None
    except SL.SlotUnsupported as exc:
        print(f"REFUSED — {exc}")
        raise SystemExit(2)
    rec = recover_file(rest[0], placements=declared)
    print(render(rec))
    raise SystemExit(3 if rec.refusals() else 0)
