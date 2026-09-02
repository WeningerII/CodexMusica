#!/usr/bin/env python3
"""Render a `Brief` into something a model can answer, and read the answer
back. The missing half of the write-check-fix loop.

WHAT THIS IS AND WHERE IT SITS. `quality/revise.py` grades a draft and hands
back a `Brief`; `quality/loop.py` drives brief -> propose -> verify to
convergence. The `propose` callable in the middle has always been the
caller's to supply, and the only one shipped (`loop.default_propose`) is a
MECHANICAL stub that substitutes one word off the offered field. Nothing has
ever turned a `Brief` into prose a writer — human or model — could act on.
That renderer is this file.

THE PROPOSER STAYS OUTSIDE THE HARNESS. "The model proposes, this grades"
(CLAUDE.md, first page) is not relaxed here: this module contains NO network
code, NO API client, NO key handling and no default `call`. It renders a
prompt, it parses a response, and `ModelProposer` glues the two to a
caller-supplied `callable(prompt: str) -> str`. That is what makes the whole
path testable with a stub and no API key, which is the point — the network
adapter is a separate file and is not imported from here.

PURE, STDLIB-ONLY, DETERMINISTIC. `render_line`/`render_group` read their
arguments and nothing else: no clock, no environment, no filesystem, no
randomness. The same inputs render byte-identically, across processes and
across `PYTHONHASHSEED` — anything that arrives as a `set` is sorted before
it is printed (doctrine 66: a tie broken by iterating a set does not
reproduce). Ranked lists (`candidates`, `forbidden_modal`) are printed in
the order they arrive, because that order is the field's own ranking and
sorting it would destroy information rather than stabilise it.

DUCK-TYPED ON PURPOSE, IN BOTH DIRECTIONS. This module imports neither
`quality.revise` nor `quality.loop`. `loop.py` imports a proposer, so
importing it back would be a cycle; `revise.py` is a 121 KB grader that
loads a lexicon this file has no use for. A `Brief`, a `Finding` and a
`PairBrief` are read by attribute name with `getattr` defaults, so a
three-field stand-in renders and a real one renders the same way.

WHAT THE PROMPT PROMISES IS ONLY WHAT `verify()` ENFORCES. Everything under
"WHAT THE GRADER ENFORCES" below is a rejection rule read off
`Reviser.verify` (quality/revise.py) and stated in the same order it fires:
line count, untargeted lines, the modal exclusion, "nothing was fixed", net
new FLAGS. A prompt that promised more than that would be teaching a model
to satisfy a rubric nobody grades. Two things the prompt therefore says out
loud rather than implying:

  - the OFFERED field is offered, NOT required. `verify()` never checks
    where the end word came from; it re-grades the rhyme. Saying "pick from
    this list" would be a constraint this project does not enforce, and
    doctrine 7 (rejection, not selection) is exactly the reason it does not.
  - a new NOTE does not reject. `verify()` counts `new_flags` only, and
    MODAL_RHYME — the note a correct tier-2 fix routinely earns — is the
    case that proved a note may not block a fix.

WHAT IS NOT IN THE PROMPT BECAUSE THE BRIEF DOES NOT CARRY IT. A `Brief` is
per-LINE and knows nothing about whether meter or song-function were asked
(`blueprint=` lives on the loop call, and `Reviser.brief`'s own docstring
says it does not surface `blueprint_declared`). So this prompt never claims
meter was or was not graded. What it does carry, when the caller passes it,
is `whole` — the whole-draft findings — under a heading that says they are
not this line's to fix, because `verify()` reads them and a proposer that
cannot see them is being graded on a rubric it cannot read.

PARSING REFUSES RATHER THAN GUESSES. A wrong parse writes a line the writer
never wrote into a draft nobody re-reads, so `parse_line`/`parse_group`
return `None` on anything ambiguous — two bare lines with no marker, two
`LINE:` markers, two fenced blocks, a fence and a marker that disagree, a
quote-wrapped line. Every one of those refusals is enumerated in
`quality/test_propose.py` section 5. The cost of that strictness is real and
it is paid in retries — but a retry is visible in the `LineAttempt` the loop
reports, and a corrupted line is not.
"""

import re

__all__ = ["render_line", "parse_line", "render_group", "parse_group",
           "ModelProposer", "OFFERED_SHOWN"]

#: How many words of the offered candidate field are printed. A cap on what
#: a prompt shows is a threshold (doctrine 58), so it is declared here and
#: DISCLOSED in the prompt whenever it bites ("24 of 61 shown"), rather than
#: silently truncating a field a writer would have read to the end.
#: `ReviseDeclaration.offered` is 24 by default, so on a default `Reviser`
#: this cap never fires; it exists for a caller who raised that one.
OFFERED_SHOWN = 40

_FENCE_RE = re.compile(r"```[^\n]*\n(.*?)```", re.DOTALL)
_LINE_MARK_RE = re.compile(r"^[ \t]*LINE[ \t]*:[ \t]*(.*)$",
                           re.IGNORECASE | re.MULTILINE)
#: THE TIER-2 MARKER SINCE 2026-08-24 — one per member, keyed on the LINE
#: NUMBER rather than on a role name. `PIVOT:`/`ANCHOR:` could address two
#: lines and a group can have nineteen; numbering the roles would put the
#: role-to-line mapping back in the reader's head, which is the guess
#: `parse_group` exists to refuse.
_MEMBER_MARK_RE = re.compile(r"^[ \t]*L[ \t]*(\d+)[ \t]*:[ \t]*(.*)$",
                             re.IGNORECASE | re.MULTILINE)
#: A model that was shown `L3: text` answers `L3: text` often enough that
#: leaving the label in would write "L3:" into the draft — a corruption
#: `verify()` cannot see, because a relabelled line is just a changed line.
#: Stripped rather than refused: a sung line that opens "L3:" does not exist,
#: so this is not a guess between two readings.
_ECHOED_LABEL_RE = re.compile(r"^[ \t]*L[ \t]*\d+[ \t]*[:.][ \t]*")
_HAS_LETTER_RE = re.compile(r"[^\W\d_]", re.UNICODE)
#: A line that both OPENS and CLOSES with one of these is refused: it is a
#: wrapper the model added or it is punctuation the writer meant, and there
#: is no reading that is right both times.
#:
#: THE SINGLE QUOTE IS DELIBERATELY NOT IN HERE, and neither is U+2019. In
#: this codebase U+2019 is an APOSTROPHE (doctrine 26 — it is normalised to
#: one anywhere a word is extracted), and a lyric line that opens and closes
#: on an apostrophe is not a hypothetical: "'Cause I'm goin'" is the shape,
#: and refusing it would throw away a legal line to catch a wrapper nobody
#: writes. The backtick IS in here — no sung line ends on one, and a model
#: that wrapped its answer in `...` would otherwise have the backticks
#: written into the draft.
_QUOTE_CHARS = "\"“”«»`"

#: WHAT THIS MODULE SAYS WHEN A BRIEF DOES NOT CARRY THE DOOR COORDINATE.
#: NOT a second copy of the disclosure -- that is
#: `relations.SCHEMA_ROUTE_NOTE`, in the module that owns the judge, and
#: nothing here restates it. This says the DIFFERENT thing that "I was handed
#: no coordinate" means, which doctrine 20/28 requires be tellable from both
#: "the route is shut" and "the route is open" (`MISSING.md` M-139).
#:
#: PINNED EQUAL to `relations.SCHEMA_ROUTE_UNKNOWN` by
#: `quality/test_propose.py` §7e, which also pins that this module contains
#: no substring of the disclosure itself. A duplicated string with a test
#: holding the two together is the price of this module's declared purity,
#: and it is paid in the open.
_SCHEMA_ROUTE_UNKNOWN = (
    "WHETHER THE 77-SCHEMA HALF OF THE DEFAULT WAS CONSULTED FOR THIS FIELD "
    "IS NOT RECORDED HERE -- this brief does not carry the coordinate, which "
    "is inconclusive by construction and is not a statement that it was "
    "consulted (doctrine 20).")


#: The coordinates `_finding_lines` PRINTS, in the order it prints them.
#: Ordering on these makes the printed order a function of the printed
#: content and of nothing else — which is the property doctrine 66 asks for
#: and the property `key=str` only ever had by accident.
_ORDER_KEYS = ("code", "severity", "message", "evidence")


class UnorderableMember(TypeError):
    """A set member that can be put in no reproducible order."""


def _order_key(x):
    """-> a VALUE key for one un-orderable set member, or a REFUSAL.

    ~~`sorted(seq, key=str)`, which is still reproducible.~~ STRUCK
    2026-08-26: it is not, and the claim was false for exactly the objects
    the fallback exists to handle. `str(x)` on a class that inherits
    `object.__repr__` is `<quality.revise.Finding object at 0x7f3c...>` —
    THE MEMORY ADDRESS — so the fallback sorted a set of findings by where
    the allocator happened to put them. That order varies run to run and has
    nothing to do with `PYTHONHASHSEED`, so the check written to catch a
    hash-seed tie could not catch it and went red intermittently instead:
    `quality/test_propose.py` §1 disagreed on CI run #966 and passes four
    times running locally.

    IT SURVIVED IN PRODUCTION BY ACCIDENT. Every finding type this repo
    ships is a `@dataclass`, so each has a field-based `__repr__` and
    `key=str` happened to be a value key. Nothing anywhere asserted that,
    and a plain finding-shaped class — which is what the suite's own
    stand-in is — reintroduced the defect the moment it was written.

    So the key is read from the coordinates the prompt PRINTS, and a member
    exposing none of them and carrying no value `__repr__` is REFUSED rather
    than ordered by address: silence and a reproducible order must not look
    alike (doctrine 20).
    """
    printed = tuple(str(getattr(x, k, "")) for k in _ORDER_KEYS)
    if any(printed):
        locs = getattr(x, "locations", ()) or ()
        return printed + (",".join(str(v) for v in _ordered(locs)),)
    if type(x).__repr__ is object.__repr__:
        raise UnorderableMember(
            f"{type(x).__name__} carries none of {_ORDER_KEYS} and inherits "
            f"object.__repr__, so `str(x)` is its MEMORY ADDRESS and sorting "
            f"a set of these orders them by where the allocator put them — an "
            f"order that changes run to run. Give the type the coordinates "
            f"the prompt prints, or a value `__repr__`.")
    return ("",) * len(_ORDER_KEYS) + (repr(x),)


def _ordered(seq):
    """-> `list(seq)`, except that a `set` is SORTED first.

    Doctrine 66 in one function. A list arrives in an order somebody chose —
    `candidates` and `forbidden_modal` are RANKED, and sorting them
    alphabetically would throw the ranking away — so a list is printed as
    given. A set has no order at all, and iterating one is exactly the tie
    that does not reproduce across `PYTHONHASHSEED`, so it is sorted. A set
    of un-orderable objects (a set of `Finding`s) falls back to
    `_order_key`, which orders on printed VALUES and refuses what it cannot
    order — see that function for why `key=str` was not reproducible.
    """
    if isinstance(seq, (set, frozenset)):
        try:
            return sorted(seq)
        except TypeError:
            return sorted(seq, key=_order_key)
    return list(seq)


def _finding_lines(findings, indent="  "):
    """-> [str], one finding as two rows: the code and its EVIDENCE.

    The evidence is the half a writer can act on — a `SCHEME_VIOLATION` whose
    message is "L1 and L3 do not rhyme" carries the two words, the score and
    the reason in `evidence` and nowhere else — which is the same argument
    `Brief.__str__` makes for printing it (quality/revise.py). A finding with
    no evidence prints one row rather than an empty second one.
    """
    out = []
    for f in _ordered(findings):
        code = getattr(f, "code", "?")
        sev = getattr(f, "severity", "?")
        msg = getattr(f, "message", "")
        ev = getattr(f, "evidence", "")
        locs = _ordered(getattr(f, "locations", ()) or ())
        where = f" (lines {', '.join(str(x) for x in locs)})" if locs else ""
        out.append(f"{indent}[{sev}] {code}: {msg}{where}")
        if ev:
            out.append(f"{indent}    evidence: {ev}")
    return out


def _draft_block(lines, focus=(), indent="  "):
    """-> [str], the whole draft with line numbers, the focus line(s) marked.

    THE WHOLE DRAFT, NOT THE FLAGGED LINE ALONE. A replacement end word has
    to rhyme with a line the writer cannot see otherwise, and the rest of the
    draft is the only place the register, tense and person of the new line
    can come from. The loop is already holding it, so withholding it is a
    choice, and it is the wrong one.
    """
    lines = _ordered(lines)
    focus = set(_ordered(focus))
    width = len(str(len(lines))) if lines else 1
    out = []
    for i, text in enumerate(lines, start=1):
        mark = ">>" if i in focus else "  "
        out.append(f"{indent}{mark} L{str(i).rjust(width)}  {text}")
    return out


def _offered_block(candidates, declaration, schema_note, indent="  "):
    """-> [str]. The candidate field, capped at `OFFERED_SHOWN` and SAYING SO
    when the cap bites, plus the coordinate AND the DOOR it was read at.

    `schema_note` IS POSITIONAL AND REQUIRED, and that is its whole design
    (`MISSING.md` M-139). This is the ONE renderer of a candidate field in
    this module and it is called three times -- the tier-1 offer, the tier-2
    pivot options, and each tier-2 member's options -- so a disclosure
    written at the call sites would be three copies of one sentence
    (doctrine 1). A DEFAULTED keyword would let a fourth call site drop the
    sentence in silence, which is the failure `quality/test_propose.py` §7c
    exists to catch one layer up; a required positional makes that call site
    a `TypeError` instead. An undeclared value must be loud, not silently
    one of the two.

    IT ARRIVES AS A STRING because this module imports `re` and nothing else
    on purpose (see the module docstring): `quality.relations` owns the judge
    the sentence is about and therefore owns the sentence, and it reads
    `canon_index.tsv` at import -- a renderer that declares "no filesystem"
    may not acquire one. The sentence travels on the `Brief`, exactly as
    `field_declaration` does.
    """
    cands = _ordered(candidates)
    shown = cands[:OFFERED_SHOWN]
    head = f"{len(shown)} word(s)"
    if len(shown) < len(cands):
        head = (f"{len(shown)} of {len(cands)} shown, highest-ranked first "
                f"(the field is larger than this prompt prints)")
    out = [f"{indent}{head}; field read at {declaration}",
           f"{indent}  " + ", ".join(str(c) for c in shown)]
    if schema_note:
        # UNWRAPPED, AND THAT IS THE DECISION RATHER THAN AN OVERSIGHT.
        # `quality/test_propose.py`'s module-surface section asserts on the
        # SOURCE that this file's import set is exactly `{"re"}` -- a hard
        # guard, and the reason the sketch that put this sentence behind
        # `from quality.relations import ...` cannot ship: that import goes
        # RED there, mechanically, before anyone argues about it. Wrapping
        # would need `textwrap` and would move that declared coordinate for
        # a cosmetic gain, which is the trade this repo refuses. The line
        # directly above already prints up to `OFFERED_SHOWN` words
        # unwrapped, so nothing here is newly long; the HUMAN-facing
        # renderers wrap, through `revise.schema_route_lines`.
        out.append(f"{indent}{schema_note}")
    return out


def _whole_block(whole, indent="  "):
    """-> [str]. Whole-draft findings, under a heading that says they are not
    this line's to fix.

    THE ONE THING THAT MUST NOT BE DROPPED AND MUST NOT BE MISLABELLED. A
    whole-draft finding names no line, so no single-line rewrite clears one
    — `LoopResult.disclosure` says exactly that, and it is why `revise_loop`
    can return SUCCESS with one still standing. But `verify()`'s diff covers
    `whole` as well as `per_line`, so one of these CAN reject a revision that
    makes it worse. Both halves of that go in the prompt: it is context, and
    it is context the grader reads.
    """
    out = [
        f"{indent}These name NO line and are NOT this line's to fix — no "
        f"one-line rewrite clears one.",
        f"{indent}They are here because the grader that judges your line "
        f"reads them too: a revision that",
        f"{indent}makes one of them WORSE is rejected, and none of them can "
        f"be fixed by the line you write.",
    ]
    out.extend(_finding_lines(whole, indent=indent))
    return out


def _mandate_block(brief, indent="  "):
    """-> [str]. Every group the line must answer and the words it must
    answer them with — plus the pivot and joint-conflict statements, which
    are `Brief`'s own (`must_answer`, `joint_conflict`, `field_declaration`)
    and are restated here in the same terms it uses."""
    out = []
    must_answer = _ordered(getattr(brief, "must_answer", ()) or ())
    rets = set(getattr(brief, "return_groups", ()) or ())
    # WHERE EACH GROUP BINDS THIS LINE, AND WHETHER IT HOLDS (M-184). A
    # line in two groups at two places is asked for two words; a group
    # that already holds needs nothing and the writer is told to leave it.
    # Both are read through `getattr` so a stand-in without them renders
    # the sentence it always rendered.
    gslots = dict(getattr(brief, "group_slots", {}) or {})
    violated = set(getattr(brief, "violated_groups", ()) or ())
    for lab, mem, calls in must_answer:
        shown = ", ".join(f"L{n} ({w!r})" for n, w in _ordered(calls))
        place = ""
        if lab in gslots:
            place = (f" at its {_place_phrase(gslots[lab])}"
                     if gslots[lab] is not None else " at its end word")
        standing = ""
        if violated:
            standing = (" — VIOLATED, this is the word to change"
                        if lab in violated else
                        " — HOLDS as written; leave that word alone")
        if lab in rets:
            # A DECLARED RETURN IS NOT A RHYME GROUP, and this said it was —
            # defect E, 2026-08-16. `Mandate.requirement` answers
            # REQUIRE_RETURN here: the two lines must be THE SAME LINE.
            # Printing "must rhyme with" hands the writer a strictly WEAKER
            # requirement, so a different line that rhymes reads as
            # compliance and silently breaks the return.
            out.append(f"{indent}group {lab} {list(_ordered(mem))} is a "
                       f"RETURN — this line must BE {shown}, the same line "
                       f"word for word.")
            out.append(f"{indent}  A rhyme is NOT enough here, and note that "
                       f"rule 2 below forbids you changing the other line: "
                       f"if this")
            out.append(f"{indent}  line has to move to satisfy something "
                       f"else, the RETURN is what breaks, and that is a "
                       f"fact about the")
            out.append(f"{indent}  mandate rather than about anything you "
                       f"can write.")
        else:
            out.append(f"{indent}group {lab} {list(_ordered(mem))}{place} — "
                       f"this line must rhyme with: {shown}{standing}")
    if len(must_answer) > 1:
        places = {gslots.get(lab) for lab, _m, _c in must_answer
                  if lab in gslots}
        if len(places) > 1:
            # TWO PLACES ARE TWO WORDS, NOT ONE CONJUNCTION (M-184): the
            # groups at different places are answered independently, each
            # by its own word, and only the groups at ONE place conjoin.
            out.append(f"{indent}This line binds at {len(places)} "
                       f"PLACES, listed above: each place is its own word "
                       f"answering its own group(s), so fix the violated "
                       f"place and keep the word at any place that holds.")
        else:
            out.append(f"{indent}This line is a PIVOT: it is in "
                       f"{len(must_answer)} groups and must answer EVERY "
                       f"one of them at once (conjunctive; doctrine 2). "
                       f"Answering one and breaking another is not a fix.")
    if getattr(brief, "joint_conflict", False):
        out.append(
            f"{indent}NO JOINT CANDIDATE at "
            f"{getattr(brief, 'field_declaration', '?')}: nothing in the "
            f"lexicon answers all of those groups at once. The MANDATE, not "
            f"the line, is what needs revising — a one-line rewrite here is "
            f"re-running a search that has already come back empty.")
    mrw = getattr(brief, "must_rhyme_with", None)
    if mrw and not must_answer:
        out.append(f"{indent}must rhyme with L{mrw[0]} ({mrw[1]!r})")
    if not out:
        out.append(f"{indent}(no rhyme group declared for this line)")
    return out


def _enforced_block(line_no, n_lines, indent="  ", word_name="end word"):
    """-> [str]. The rejection rules of `Reviser.verify`, in the order that
    method applies them, and NOTHING ELSE.

    Each numbered item below is one early return in `verify()`: line count,
    untargeted lines, RULE 3 (the modal exclusion), "nothing was fixed",
    net-new flags. `allow_net_new` is named rather than quoted as a number —
    it is a `ReviseDeclaration` coordinate and a `Brief` does not carry it,
    so this file cannot see the value the caller actually set.

    `word_name` is `slot_phrase`'s answer, passed rather than re-derived
    because this block has no `Brief` and a second reading of the placement
    is a second definition of it (doctrine 1). Its default is the spelling
    every pre-placement mandate produces, so an omitted argument renders the
    sentence this block has always rendered.
    """
    return [
        f"{indent}1. ONE line back, and it replaces L{line_no}. The draft "
        f"stays {n_lines} lines — a different",
        f"{indent}   line count is rejected outright: this loop revises "
        f"lines, it does not restructure",
        f"{indent}   the draft.",
        f"{indent}2. ONLY L{line_no} changes. Any other line that comes back "
        f"different is rejected",
        f"{indent}   outright, whatever else the revision achieved.",
        # ITEM 3 WAS FALSE TWICE OVER — corrected 2026-08-16. It said "the
        # end word is NOT one of the FORBIDDEN words above … rejects on its
        # own", and `verify()` RULE 3 rejects only for MOVING TO a modal
        # word. A line that KEEPS its end word takes nothing and is not
        # rejected here at all, whether or not that word is on the list —
        # so the sentence was false for the incumbent, and false for a head
        # word that is also the incumbent. Two items now, because RULE 3 has
        # two behaviours and this block's own docstring promises one item
        # per early return.
        f"{indent}3. The {word_name} L{line_no} MOVES TO is not one of the "
        f"FORBIDDEN words above. That is",
        f"{indent}   checked before anything else about the line and rejects "
        f"on its own. KEEPING the",
        f"{indent}   word already there is not a move and is not rejected "
        f"here — see item 4.",
        f"{indent}4. The line must FIX at least one finding. A rewrite that "
        f"is differently defective",
        f"{indent}   is rejected as 'nothing was fixed'.",
        f"{indent}5. It may not trade one defect for another: new FLAG "
        f"findings anywhere in the draft",
        f"{indent}   — including on lines you did not touch — reject it once "
        f"they exceed the declared",
        f"{indent}   `allow_net_new` (0 by default). New NOTES do not "
        f"reject.",
    ]


def _attempt_block(attempt, reasons, indent="  "):
    """-> [str]. Which try this is, and why the last one was thrown out."""
    try:
        n = int(attempt)
    except (TypeError, ValueError):
        n = 0
    out = [f"{indent}This is ATTEMPT {n + 1} of this line's retry budget."]
    # `verify()` hands back a LIST of reason strings; a caller holding one
    # reason often passes the bare string, and `list("...")` would render it
    # one character per bullet.
    if isinstance(reasons, str):
        reasons = [reasons]
    reasons = [str(r) for r in _ordered(reasons or ())]
    if reasons:
        out.append(f"{indent}The PREVIOUS attempt was REJECTED. The grader's "
                   f"reasons, verbatim:")
        for r in reasons:
            out.append(f"{indent}  - {r}")
        out.append(f"{indent}Do not send back something the same reason "
                   f"would reject again.")
    else:
        out.append(f"{indent}No previous attempt was rejected on this line "
                   f"in this round.")
    return out


def _place_phrase(slot_key):
    """-> the phrase for a `Brief.group_slots` value: `None` is the end word,
    a spelling is rendered by the one definition `slot_phrase` delegates to
    (M-184)."""
    if slot_key is None:
        return "end word"
    from quality import slots as _SL                   # noqa: PLC0415
    try:
        return _SL.word_phrase(_SL.as_slot(slot_key))
    except Exception:                                  # noqa: BLE001
        return f"word at {slot_key}"


def slot_phrase(brief):
    """-> the WORD this brief asks the writer to change, in words.

    THE PROMPT SAID "END WORD" WHATEVER THE MANDATE BOUND — fixed 2026-08-24,
    and it had been false since `9ad2dad` put placement in the architecture.
    `Brief.slot` has carried the bound span since that commit (`MISSING.md`
    M-67: *"there's just no way that we can only be contemplating the last
    word of every line"*) and NOTHING in this module read it, so a mandate
    binding `1.T4` or `1.head` produced a prompt telling the writer to change
    the END word — the one word that mandate does not constrain. The grader
    then judged the word the writer was never asked about.

    IT WAS THE GUARD IN `test_propose.py` §7c THAT NAMED IT, exactly as that
    guard's own comment predicted: a stand-in that has not grown a field
    "renders the new rule as an EMPTY BLOCK, no error and no red". Here it was
    not even a block — `render_line` reads every field through `getattr`, so
    the two new fields were simply never asked for, and the prompt kept its
    old sentence with nothing to contradict it.

    THE DEFAULT SPELLING IS BYTE-IDENTICAL, which is why this is a repair and
    not a rewrite: `slots.is_default` is true of every bare-int member, i.e.
    of every mandate written before placement existed, and of every fixture in
    this repository. Those render "end word" as they always did.

    A LOCUS THAT RESOLVES TO NO SINGLE WORD IS NAMED, NOT DEFAULTED. Silently
    falling back to "end word" is the defect this function exists to end, so
    an unresolvable placement is spelled out in the mandate's own notation and
    the writer is told which span it is (doctrine 20).
    """
    slot = getattr(brief, "slot", None)
    if slot is None:
        return "end word"
    # DELEGATED, NOT RE-DERIVED. `slots.word_phrase` is the one definition —
    # see its docstring for why a renderer may not carry a second one. The
    # import is LAZY so this module's module-level import list stays `re` and
    # nothing else, which `test_propose.py` §7b pins for a different reason
    # (no network, no client, no key) and which this must not disturb.
    from quality import slots as _SL                   # noqa: PLC0415
    try:
        return _SL.word_phrase(slot)
    except Exception:                                  # noqa: BLE001
        return "end word"


def render_line(brief, lines, whole=(), attempt=0, reasons=None):
    """-> str, the tier-1 prompt: rewrite ONE flagged line.

    PURE and DETERMINISTIC — same inputs, byte-identical output, in any
    process (see `_ordered` for the set-iteration case doctrine 66 names).

    `brief` is duck-typed on `quality.revise.Brief`: `line_no`, `text`,
    `findings`, `candidates`, `forbidden_modal`, `keep`, `must_answer`,
    `must_rhyme_with`, `joint_conflict`, `field_declaration`. Every one is
    read with a `getattr` default, so a partial stand-in renders.

    `lines` is the WHOLE draft. `whole` is `inspect()`'s whole-draft finding
    list — rendered as context under a heading that says it is not this
    line's to fix. `attempt`/`reasons` are the loop's retry state: `reasons`
    is `verify()`'s own rejection list for the previous attempt, quoted
    verbatim rather than summarised, because a paraphrase of "L1 took the
    modal candidate 'higher'" loses the word.
    """
    line_no = getattr(brief, "line_no", 0)
    text = getattr(brief, "text", "")
    lines = _ordered(lines)
    candidates = _ordered(getattr(brief, "candidates", ()) or ())
    forbidden = _ordered(getattr(brief, "forbidden_modal", ()) or ())
    incumbent = getattr(brief, "forbidden_incumbent", "") or ""
    keep = _ordered(getattr(brief, "keep", ()) or ())
    findings = _ordered(getattr(brief, "findings", ()) or ())
    whole = _ordered(whole or ())
    decl = getattr(brief, "field_declaration", "field_depth=?, field_band=?")
    #: THE DOOR the field was read at, read ONCE and threaded exactly as
    #: `decl` is. THE `getattr` DEFAULT IS THE UNKNOWN SENTENCE AND NOT `""`:
    #: an object that has not grown the coordinate must not render as "the
    #: route is shut", which is the doctrine-20 collapse the disclosure
    #: exists to end (`MISSING.md` M-139).
    note = getattr(brief, "schema_route_note", _SCHEMA_ROUTE_UNKNOWN)
    #: WHICH WORD this brief is about. Read ONCE and threaded, never
    #: re-derived per block — see `slot_phrase`.
    word_name = slot_phrase(brief)

    out = []
    out.append(f"REVISE ONE LINE — L{line_no} of a {len(lines)}-line draft.")
    out.append("")
    out.append("You are given a draft, one line of it a grader has flagged, "
               "everything that grader")
    out.append("measured, and the rules it will apply to what you send back. "
               "Rewrite that ONE line.")
    out.append("")

    out.append("ATTEMPT")
    out.extend(_attempt_block(attempt, reasons))
    out.append("")

    out.append("THE LINE TO REVISE")
    out.append(f"  L{line_no}: {text}")
    # A NON-DEFAULT PLACEMENT IS STATED, NOT IMPLIED. Every sentence below
    # names the word through `word_name`, and a writer who has only ever seen
    # end-rhyme prompts would read "word 4" as a typo rather than as the
    # mandate. Silent on the default, so no existing prompt gains a line.
    if word_name != "end word":
        out.append(f"  THE BOUND WORD IS THE {word_name.upper()}, NOT THE "
                   f"END WORD — this mandate binds a placement")
        out.append(f"  other than the line end, and every rule below is "
                   f"about the {word_name}.")
    if getattr(brief, "slot_conflict", False):
        # ~~"AND TWO DECLARED GROUPS LAND ON THAT ONE WORD, so no single word
        # answers both: the mandate, not the line, is what needs revising."~~
        # STRUCK 2026-09-01 (`MISSING.md` M-184): that sentence fired
        # whenever the line bound at two DIFFERENT places, which is the case
        # where two words answer two groups and nothing about the mandate is
        # at fault. `slot_conflict` now means more than one of this line's
        # places is VIOLATED, which is what the sentence below says.
        out.append(f"  AND MORE THAN ONE PLACE ON THIS LINE IS VIOLATED — "
                   f"the {word_name} is the first; the mandate block below "
                   f"names the rest, and a rewrite must answer each at its "
                   f"own word.")
    out.append("")

    out.append(f"THE WHOLE DRAFT (context — only L{line_no} may change)")
    out.extend(_draft_block(lines, focus=(line_no,)))
    out.append("")

    out.append(f"WHAT THE GRADER FOUND ON L{line_no} ({len(findings)})")
    if findings:
        out.extend(_finding_lines(findings))
    else:
        out.append("  (none recorded on this line)")
    out.append("")

    if whole:
        out.append(f"WHOLE-DRAFT FINDINGS — CONTEXT ONLY, NOT THIS LINE'S TO "
                   f"FIX ({len(whole)})")
        out.extend(_whole_block(whole))
        out.append("")

    out.append(f"THE RHYME MANDATE ON L{line_no}")
    out.extend(_mandate_block(brief))
    out.append("")

    out.append(f"OFFERED — words for the {word_name} that answer every "
               f"group bound there")
    screened = _ordered(getattr(brief, "screened_out", ()) or ())
    if screened:
        # THE MENU IS SHORT BECAUSE THE BAN IS (`MISSING.md` M-185). Said
        # before the list, because a writer reading a list of near rhymes
        # under a call like `desire` needs to know that every true rhyme
        # was refused from the rhyme's own side, not that none exists.
        out.append(f"  {len(screened)} rhyming word(s) are NOT offered: the "
                   f"call word sits in their own modal head, so taking one")
        out.append(f"  files MODAL_RHYME from that side and re-opens this "
                   f"line ({', '.join(str(w) for w in screened[:6])}"
                   + (", …" if len(screened) > 6 else "") + ").")
        if not candidates:
            out.append("  A call word in the top ranks of its own family "
                       "cannot be rhymed cleanly at all: the PARTNER line")
            out.append("  has to move to a rarer word, or this line takes "
                       "a near relation the mandate admits.")
    if candidates:
        out.extend(_offered_block(candidates, decl, note))
        out.append("  Offered, NOT required. The grader re-grades the rhyme "
                   "itself; it never checks whether")
        out.append(f"  your {word_name} came off this list. A word that is "
                   f"not here and rhymes is accepted, and")
        out.append("  a word that is here is not accepted for being here.")
    else:
        # THREE CAUSES, AND THIS ENUMERATED TWO — fixed 2026-08-16, and the
        # split above is what made the third one SAYABLE. `candidates == []`
        # can mean (a) no rhyme finding earned a field, (b) nothing in the
        # lexicon answers the groups, or (c) everything that answers is
        # inside the modal head and was excluded. In case (c) both of the
        # stated causes were false in the same breath. It could not be named
        # before, because `forbidden_modal` also held the incumbent, so a
        # renderer could not say "every answering word is modal" without
        # implicating a word that is on the list for another reason.
        if forbidden:
            out.append("  (no candidate field was offered — and it is NOT "
                       "that nothing answers this line:")
            out.append("  every word that answers its groups is in the "
                       "FORBIDDEN list below, so the field is")
            out.append("  empty because doctrine 9 emptied it. The mandate, "
                       "not the lexicon, is the binding")
            out.append("  constraint here.)")
        else:
            out.append("  (no candidate field was offered for this line — "
                       "either no rhyme finding is what")
            out.append("  flagged it, or nothing in the lexicon answers its "
                       "groups. Read the findings above:")
            out.append("  a meter, return or anaphora finding is not "
                       "repaired by swapping an end word.)")
    out.append("")

    # TWO BLOCKS, TWO RULES, TWO COUNTS — split 2026-08-16. This was ONE
    # block over `forbidden_modal`, which carried the modal head AND the
    # incumbent, and it attached ONE consequence sentence to both. Three
    # things were wrong at once and each is repaired below:
    #   - the heading said "do not END on any of these", which is false of a
    #     word the line KEEPS: `verify()` RULE 3 asks whether a word was
    #     TAKEN, so it is now "do not MOVE TO";
    #   - "REJECTED OUTRIGHT" is true of the modal head and false of the
    #     incumbent, which RULE 3 does not reject for at all;
    #   - the count `({len(forbidden)})` summed two rules into one integer
    #     the writer reads (doctrine 79).
    # The clause "plus the word that is there now" was the ONLY thing in the
    # whole prompt that hinted at rule 2, so it is moved into rule 2's own
    # block rather than deleted.
    out.append(f"FORBIDDEN — do not MOVE L{line_no} TO any of these "
               f"({len(forbidden)})")
    if forbidden:
        out.append("  " + ", ".join(str(w) for w in forbidden))
        out.append("  These are the most predictable answers in this field. "
                   "MOVING to one of them is")
        out.append("  REJECTED OUTRIGHT — before the grader looks at whether "
                   "the line fixed anything at")
        out.append("  all. Passing the rhyme band by reaching for the most "
                   "predictable word in it is the")
        out.append("  slop direction, and it is the one move this loop "
                   "refuses mechanically rather than")
        out.append("  merely discouraging (doctrine 9).")
    else:
        # THREE STATES, NOT TWO — fixed 2026-08-16, and the two-field split
        # is what made the third one reachable rather than what caused it.
        # "no modal head was computed" is FALSE wherever `joint_field` RAN
        # and returned nothing, and there are two such populations: a
        # joint-conflict pivot (where this same prompt already says "nothing
        # in the lexicon answers all of those groups at once" eleven lines
        # up, so it contradicted itself) and `modal_exclusion=0`, where
        # `ranked[:0]` is empty on every line while the field is fully
        # computed. Before the split BOTH printed the incumbent under "the
        # most predictable answers in this field" instead, so one false
        # sentence was simply traded for another until `field_computed`
        # existed to tell them apart.
        if getattr(brief, "field_computed", False):
            out.append("  (none — the modal head was COMPUTED for this line "
                       "and came back EMPTY, which is not")
            out.append("  the same as it not having been asked. Either "
                       "nothing in the lexicon answers this")
            out.append("  line's groups at all — see the mandate block "
                       "above — or the modal exclusion is")
            out.append("  declared at 0, which forbids nothing by design. "
                       "Doctrine 9 is not being applied")
            out.append("  to you here; it found nothing to apply.)")
        else:
            out.append("  (none — no modal head was computed for this line)")
    out.append("")

    out.append(f"THE WORD ALREADY THERE — a DIFFERENT rule from the one "
               f"above ({1 if incumbent else 0})")
    if incumbent:
        out.append(f"  {incumbent}")
        out.append(f"  This is the {word_name} L{line_no} already has. "
                   f"Re-proposing it is not a revision — but it")
        out.append("  is NOT rejected outright the way the list above is: "
                   "the grader asks whether a modal")
        out.append("  candidate was TAKEN, and keeping the word you were "
                   "given takes nothing. A line that")
        out.append("  keeps it is refused by rule 4 below ('nothing was "
                   "fixed') UNLESS the rewrite repaired")
        out.append("  something else — a meter finding, say — in which case "
                   "keeping it is accepted.")
    else:
        # THE SAME FALSE-CAUSE BUG AS THE HEAD'S BRANCH, one block down —
        # found 2026-08-16 by the rung-1 blind run, in the prompt handed to
        # the writer before they had answered anything. L1 of that draft ends
        # on 'four', which is perfectly readable; this block said "no readable
        # end word to keep" because the INCUMBENT IS ONLY RECORDED WHERE THE
        # FIELD IS COMPUTED, and L1 carried a meter flag and no rhyme finding.
        # An empty value stated the wrong reason for being empty, which is the
        # whole of defect D one rule over.
        if getattr(brief, "field_computed", False):
            out.append(f"  (none — this line's {word_name} could not be "
                       f"read, so there is no incumbent to keep)")
        else:
            out.append("  (none recorded — no candidate field was computed "
                       "for this line, and the incumbent is only recorded")
            out.append("  where one is. This says nothing about whether the "
                       "end word is readable: it very likely is, and it is")
            out.append("  still the word you would be replacing.)")
    out.append("")

    out.append("LINES THAT MUST NOT CHANGE")
    if keep:
        out.append("  " + ", ".join(f"L{n}" for n in keep)
                   + " — the grader found nothing on them.")
    else:
        out.append("  (the grader found something on every line; you are "
                   "still only asked for this one)")
    out.append(f"  Every line except L{line_no} must come back byte-"
               f"identical. Changing one is rejected")
    out.append("  outright even if the change is an improvement.")
    out.append("")

    out.append("WHAT THE GRADER ENFORCES ON YOUR ANSWER")
    out.extend(_enforced_block(line_no, len(lines),
                               word_name=word_name))
    out.append("")

    out.append("HOW TO ANSWER")
    out.append("  Send the line and nothing else: one line, no quotation "
               "marks around it, no line")
    out.append("  number, no commentary, no code fence. If you must explain "
               "yourself first, put the")
    out.append("  line LAST, alone on its own line, beginning with `LINE: `. "
               "Anything ambiguous —")
    out.append("  two candidate lines, a quoted line, an explanation with no "
               "marker — is discarded")
    out.append("  unread and costs you this attempt.")
    return "\n".join(out)


def parse_line(text):
    """-> the proposed line as a `str`, or `None` when the response is not
    unambiguously one line.

    STRICT BY CONSTRUCTION. A wrong parse writes a line the model did not
    propose into a draft, and `verify()` cannot catch it: a mis-parsed line
    is just a changed line, which is exactly what was asked for. So every
    reading that has two answers returns `None` and costs a retry instead.

    ACCEPTED (each verified in `quality/test_propose.py` section 5):
      - a bare single line, alone in the response
      - one fenced block holding exactly one non-empty line
      - one `LINE: ...` marker, anywhere, with prose around it
      - an echoed `L3: ` label on the front of any of the above — stripped,
        because no sung line begins with a line label and leaving it in
        writes the label into the draft

    REFUSED, returning `None`:
      - nothing, or nothing with a letter in it
      - two or more non-empty lines with no marker and no fence — which of
        them is the answer is a guess
      - two or more `LINE:` markers, or two or more fenced blocks
      - a fenced block holding zero or several non-empty lines
      - a fence and a `LINE:` marker outside it that DISAGREE
      - a line wrapped in quotation marks or backticks. Stripping them
        corrupts a line of quoted speech and keeping them corrupts a line
        that was merely quoted for display; both are wrong on some real
        line, so neither is guessed at. The prompt asks for no quotation
        marks for this reason. An APOSTROPHE at both ends is not a wrapper
        and is accepted — see `_QUOTE_CHARS`.
    """
    if not isinstance(text, str):
        return None
    fences = _FENCE_RE.findall(text)
    if len(fences) > 1:
        return None
    marks = _LINE_MARK_RE.findall(text)
    if fences:
        body = _clean_single(fences[0])
        outside = _LINE_MARK_RE.findall(_FENCE_RE.sub("\n", text, count=1))
        if outside:
            if len(outside) > 1:
                return None
            other = _clean_single(outside[0])
            if other is None or body is None or other != body:
                return None
        return body
    if marks:
        if len(marks) > 1:
            return None
        return _clean_single(marks[0])
    return _clean_single(text)


def _clean_single(blob):
    """-> the ONE non-empty line in `blob`, cleaned, or `None`.

    Cleaning is exactly two moves, both of which have a single reading: strip
    surrounding whitespace, and strip an echoed `L7: ` line label. Everything
    else the model might have wrapped the line in is a refusal, not a fixup.
    """
    if blob is None:
        return None
    rows = [r.strip() for r in blob.splitlines()]
    rows = [r for r in rows if r]
    if len(rows) != 1:
        return None
    row = _ECHOED_LABEL_RE.sub("", rows[0]).strip()
    if not row:
        return None
    if row[0] in _QUOTE_CHARS or row[-1] in _QUOTE_CHARS:
        return None
    if not _HAS_LETTER_RE.search(row):
        return None
    return row


def render_group(group_brief):
    """-> str, the tier-2 prompt: rewrite a PIVOT and its whole GROUP.

    TIER 2 IS A DIFFERENT REQUEST AND THE PROMPT SAYS SO. Tier 2 fires only
    where `joint_field` has ALREADY proved that no single word answers every
    group the pivot is in at once (`Brief.joint_conflict`) — so asking for a
    better word for the pivot is asking for a search that has come back
    empty to come back full. What is wrong is the MANDATE: the pivot is
    required to rhyme with lines that do not rhyme with each other. The move
    is to change the words of the lines the pivot has to match, which changes
    what the pivot must satisfy, and it needs EVERY member of that group back.

    ~~`render_pair`, and TWO lines.~~ **`render_group` SINCE 2026-08-24
    (`MISSING.md` M-105).** The two-line shape was the tier's bound, not the
    request's: 41.6% of the groups this planner draws have three or more
    members and none of them could be asked for. What is unchanged is every
    argument the pair prompt made — the situation block, the offered/required
    split, the four enforced rules — because a pair is a group of two and the
    request never differed (doctrine 1).

    `group_brief` is duck-typed on `quality.loop.GroupBrief`: `pivot_line_no`,
    `pivot_text`, `pivot_word`, `pivot_offered`, `anchors` (each with
    `line_no`, `text`, `word`, `offered`, `calls`), `label`, `members`,
    `brief`, `lines`, `attempt`, `reasons`, `whole`. Read by `getattr` with
    defaults, and `quality.loop` is NOT imported (it imports proposers; the
    dependency runs one way).

    `pivot_word` AND EACH ANCHOR'S `word` ARE THE PROPOSAL — the words the
    loop's own search is asking for on THIS attempt — and NOT what the lines
    currently end on. That is `GroupBrief`'s own declared reading and this
    function had the opposite one until 2026-08-14, which put a false
    statement about the draft into every tier-2 prompt a real run produced.
    Nothing here derives the CURRENT end word: it is `lyric_harness.`
    `raw_final_token`'s job, this module imports `re` and nothing else, and
    a second spelling of "the end word" would be the same defect one layer
    down. The line text is printed in full instead.
    """
    g = group_brief
    p_no = getattr(g, "pivot_line_no", 0)
    p_text = getattr(g, "pivot_text", "")
    p_word = getattr(g, "pivot_word", "")
    p_off = _ordered(getattr(g, "pivot_offered", ()) or ())
    anchors = _ordered(getattr(g, "anchors", ()) or ())
    label = getattr(g, "label", "?")
    members = _ordered(getattr(g, "members", ()) or ())
    lines = _ordered(getattr(g, "lines", ()) or ())
    whole = _ordered(getattr(g, "whole", ()) or ())
    inner = getattr(g, "brief", None)
    decl = getattr(inner, "field_declaration", "field_depth=?, field_band=?")
    #: The pivot brief's door, threaded to EVERY options list below -- the
    #: pivot's and each member's -- for the same reason `decl` is: one
    #: statement of one coordinate (doctrine 1). Same `getattr` default and
    #: the same argument for it; `inner` is `None` on a `GroupBrief` that
    #: carries no brief, and `getattr(None, ...)` takes it.
    note = getattr(inner, "schema_route_note", _SCHEMA_ROUTE_UNKNOWN)
    findings = _ordered(getattr(inner, "findings", ()) or ())
    a_nos = [getattr(a, "line_no", 0) for a in anchors]
    a_list = ", ".join(f"L{n}" for n in a_nos) or "(none)"
    k = len(members)

    out = []
    out.append(f"REWRITE A WHOLE RHYME GROUP — {k} coupled line(s): pivot "
               f"L{p_no}, with {a_list}.")
    out.append("")
    out.append("THE SITUATION, AND IT IS NOT THE ORDINARY ONE")
    out.append(f"  L{p_no} is a PIVOT: it sits in more than one rhyme group "
               f"and has to answer every one")
    out.append("  of them at once. The grader has ALREADY searched the "
               "complete candidate pool and found")
    out.append(f"  that NO single word does — that search came back empty at "
               f"{decl}.")
    out.append(f"  So there is no better word for L{p_no} to be found by "
               f"looking harder. The MANDATE is")
    out.append("  what needs revising: this line is required to rhyme with "
               "lines that do not rhyme")
    out.append("  with each other.")
    out.append("")
    out.append(f"  The move is to BACKTRACK. Change the bound word of every "
               f"OTHER member of group")
    out.append(f"  {label} {list(members)} — the lines L{p_no} has to match "
               f"— so that what L{p_no} must satisfy")
    out.append(f"  becomes satisfiable, and give L{p_no} a word that answers "
               f"its OTHER group(s). All {k}")
    out.append("  lines come back, and they must all rhyme with EACH OTHER, "
               "or the group you just")
    out.append("  rewrote is broken instead.")
    out.append("")

    out.append("ATTEMPT")
    out.extend(_attempt_block(getattr(g, "attempt", 0),
                              getattr(g, "reasons", None)))
    out.append("")

    out.append(f"THE {k} LINES")
    out.append(f"  PIVOT   L{p_no}: {p_text}")
    for a in anchors:
        out.append(f"  MEMBER  L{getattr(a, 'line_no', 0)}: "
                   f"{getattr(a, 'text', '')}")
    out.append("")

    # THE `word` FIELDS ARE THE PROPOSAL, NOT THE STATUS QUO, and this block
    # used to say the opposite. It rendered them as `(ends on 'mankind')`
    # beside a line ending on "dream" — so on a real `revise_loop` run the
    # prompt told the writer what each line currently ended on and was WRONG
    # ON BOTH. One field, two readings, in two modules (doctrine 1);
    # `quality/loop.py`'s `GroupBrief` states the intended one in its own
    # docstring under a heading, and this is the side that had misread it.
    # NOT repaired by deriving the current end word here: that is
    # `lyric_harness.raw_final_token`'s one job, this module imports `re` and
    # nothing else on purpose, and a second spelling of "the end word" is the
    # defect one layer down. The line text is already printed directly above
    # — a writer can see where it ends — so the fix is to label the words for
    # what they are and claim nothing about what is being replaced.
    proposed = [(p_no, p_word)] + [(getattr(a, "line_no", 0),
                                    getattr(a, "word", "")) for a in anchors]
    if any(w for _n, w in proposed):
        out.append("THE SET THE GRADER'S OWN SEARCH IS PROPOSING")
        for n, w in proposed:
            if w:
                out.append(f"  L{n} to bind on {w!r}")
        out.append("  Offered, not required — they are the set the "
                   "mechanical search believes makes")
        out.append("  the mandate hold, and they are MUTUALLY rhyming by "
                   "construction: each was")
        out.append("  searched against the pivot's word AND every member "
                   "listed above it. Binding")
        out.append("  elsewhere is allowed; the grader re-derives the "
                   "findings either way and rejects")
        out.append("  a set that does not actually hold.")
        out.append("")

    out.append(f"THE WHOLE DRAFT (context — only {', '.join(f'L{n}' for n in members)} may change)")
    out.extend(_draft_block(lines, focus=tuple(members)))
    out.append("")

    out.append(f"WHAT THE GRADER FOUND ON L{p_no} ({len(findings)})")
    if findings:
        out.extend(_finding_lines(findings))
    else:
        out.append("  (none recorded on the pivot)")
    out.append("")

    if whole:
        out.append(f"WHOLE-DRAFT FINDINGS — CONTEXT ONLY, NOT THESE LINES' "
                   f"TO FIX ({len(whole)})")
        out.extend(_whole_block(whole))
        out.append("")

    out.append("THE RHYME MANDATE ON THE PIVOT")
    out.extend(_mandate_block(inner) if inner is not None
               else ["  (not supplied)"])
    out.append("")

    out.append(f"PIVOT OPTIONS — words L{p_no} could bind on once the rest "
               f"of the group moves")
    if p_off:
        out.extend(_offered_block(p_off, decl, note))
    else:
        out.append("  (none offered)")
    out.append("")

    # EACH MEMBER'S OWN MANDATE. This block did not exist until 2026-08-17
    # and its absence was defect F: the prompt printed THE RHYME MANDATE ON
    # THE PIVOT, told the writer to move the other line's bound word, and
    # never said what else that word had to answer. MEASURED — a writer that
    # took the only correct move available to it was rejected for a flag on a
    # line the prompt had not mentioned. It is per MEMBER now, because one
    # anchor was the tier's bound and not the shape of the question.
    for a in anchors:
        a_no = getattr(a, "line_no", 0)
        a_off = _ordered(getattr(a, "offered", ()) or ())
        a_calls = list(getattr(a, "calls", ()) or ())
        if a_calls:
            shown = ", ".join(repr(w) for w in a_calls)
            out.append(f"AND L{a_no} HAS GROUPS OF ITS OWN — it is a pivot "
                       f"too")
            out.append(f"  Besides group {label} {list(members)}, L{a_no} "
                       f"must also answer: {shown}.")
            out.append(f"  Those groups are NOT being rewritten, so they "
                       f"still hold: whatever L{a_no} moves")
            out.append(f"  to has to answer them as well, and a new bound "
                       f"word that breaks one of them is")
            out.append(f"  a new FLAG under item 4 below. The options list "
                       f"below already has them folded in.")
            out.append("")
        out.append(f"L{a_no} OPTIONS — words L{a_no} could bind on instead "
                   f"of what it binds on now")
        if a_off:
            out.extend(_offered_block(a_off, decl, note))
        elif a_calls:
            out.append(f"  (none offered — NOTHING answers group {label} "
                       f"{list(members)} AND L{a_no}'s own group(s) at once, "
                       f"so the conjunction")
            out.append("   is unsatisfiable at this line and the MANDATE is "
                       "what needs revising, not the words)")
        else:
            out.append("  (none offered)")
        out.append("")

    out.append(f"  Every list is OFFERED, not required, and the {k} picks "
               f"are COUPLED: whatever each")
    out.append(f"  line binds on must rhyme with what every OTHER member "
               f"binds on, because group")
    out.append(f"  {label} {list(members)} still holds after the rewrite. "
               f"The offered lists are ORDERED —")
    out.append(f"  each was searched against the pivot's word and every "
               f"member listed BEFORE it, and")
    out.append(f"  against none listed after — so the loop's own picks above "
               f"are mutually rhyming,")
    out.append(f"  and reaching past them into two late lists at once is the "
               f"one way to pick a set")
    out.append(f"  that answers the pivot and not itself.")
    out.append("")

    out.append("WHAT THE GRADER ENFORCES ON YOUR ANSWER")
    out.append(f"  1. {k} line(s) back — one for each of "
               f"{', '.join(f'L{n}' for n in members)}. The draft stays "
               f"{len(lines)} lines.")
    out.append(f"  2. ONLY {', '.join(f'L{n}' for n in members)} change. "
               f"Every other line must come back")
    out.append("     byte-identical, or the revision is rejected outright.")
    # ITEM 3, MADE HONEST ABOUT ITS OWN SCOPE — 2026-08-16. It said "neither
    # end word may be a forbidden modal one for its own line", which reads as
    # a live constraint on all of them. It is not, for the PIVOT: tier 2
    # fires only on `Brief.joint_conflict`, and that flag is `len(calls) > 1
    # and not candidates and not forbidden_modal` — so the pivot's modal head
    # is EMPTY BY CONSTRUCTION every time this prompt is rendered, and item 3
    # could only ever bind the other members. No list is printed here at all.
    # Stated rather than quietly left, because a rule a writer cannot see and
    # that cannot fire is decoration (doctrine 48).
    out.append("  3. No bound word may be the most predictable answer in its "
               "own field (doctrine 9),")
    out.append(f"     and this is checked only for a word a line MOVES TO. "
               f"For L{p_no} the modal head is")
    out.append("     empty by construction — this tier runs precisely "
               "because nothing answered all of")
    out.append(f"     its groups — so in practice item 3 binds {a_list}.")
    out.append("  4. The rewrite must FIX something. It may not trade one "
               "defect for another: new FLAG")
    out.append("     findings anywhere in the draft reject it (new NOTES do "
               "not).")
    out.append("")

    out.append("HOW TO ANSWER")
    out.append(f"  Exactly {k} line(s), each with its own line-number "
               f"marker, and nothing else:")
    out.append("")
    for n in members:
        out.append(f"    L{n}: <the new L{n}>")
    out.append("")
    out.append("  Every marker is required and each may appear once. A "
               "response missing one, or")
    out.append("  repeating one, or carrying a marker for a line outside "
               "the group, is discarded")
    out.append("  unread — which line is which would be a guess, and "
               "guessing wrong writes each")
    out.append("  line into another's place. No quotation marks, no "
               "commentary.")
    return "\n".join(out)


def parse_group(text, members):
    """-> one line per member, in `members` order, or `None`.

    EVERY MARKER IS REQUIRED AND IT IS KEYED ON THE LINE NUMBER.
    `parse_line` will read a bare line because there is only one slot to put
    it in; here there are k, and their order is not something a response
    format can be trusted to have got right. Writing one member into
    another's slot produces a draft that is plausible, wrong, and completely
    invisible to `verify()` — every targeted line changed, which is exactly
    what was asked for.

    ~~`PIVOT:`/`ANCHOR:`.~~ **`L<n>:` SINCE 2026-08-24 (`MISSING.md`
    M-105).** Two role names cannot address a group of nine, and numbering
    the roles (`ANCHOR1`, `ANCHOR2`) would put the mapping from role to line
    back in the reader's head — which is the guess this parser exists to
    refuse. The line number is the one label that is already unambiguous, and
    `members` is passed in so the parser knows what it is owed rather than
    accepting whatever arrived.

    Accepts the markers inside a single fenced block. Refuses: a missing
    marker, a repeated marker, a marker for a line outside the group, more
    than one fence, and — through `_clean_single` — a quote-wrapped or empty
    line anywhere in the set.
    """
    if not isinstance(text, str):
        return None
    members = tuple(members or ())
    if not members:
        return None
    fences = _FENCE_RE.findall(text)
    if len(fences) > 1:
        return None
    body = fences[0] if fences else text
    got = {}
    for raw_no, payload in _MEMBER_MARK_RE.findall(body):
        n = int(raw_no)
        if n in got:
            # A REPEATED MARKER IS NOT A CORRECTION. Taking the last one
            # would be this parser deciding which of two answers the writer
            # meant, on a response format that already failed to follow the
            # one rule it was given.
            return None
        got[n] = payload
    if set(got) != set(members):
        return None
    out = []
    for n in members:
        cleaned = _clean_single(got[n])
        if cleaned is None:
            return None
        out.append(cleaned)
    return tuple(out)


class ModelProposer:
    """A `propose`/`propose_group` pair backed by one
    `callable(prompt) -> str`.

    NO NETWORK LIVES HERE. `call` is supplied by the caller and is the only
    thing in this path that can touch one — a stub that returns a canned
    string drives `revise_loop` end to end with no API key, which is how
    `quality/test_propose.py` tests the loop's whole write-check-fix cycle
    (section 6, including the case where the grader REJECTS what the stub
    sends back).

    `parse` overrides `parse_line` for tier 1 only. `propose_group` always
    uses `parse_group`: the two responses have different shapes — one bare
    line versus k line-number-labelled ones — and a single-line parser handed
    a group response would return the first of them as if it were the whole
    answer.

    A `call` that returns anything other than a `str`, or a response nothing
    can be parsed out of, yields `None`, which the loop reads as "this
    proposer has nothing further to offer for this line" and moves on.
    Exceptions from `call` are NOT swallowed: a transport failure is not the
    same as a model declining, and a loop that cannot tell them apart
    reports a dead end for an outage.
    """

    def __init__(self, call, *, parse=None):
        self.call = call
        self.parse = parse or parse_line

    def propose(self, brief, lines, attempt, reasons=None, whole=()):
        """-> a replacement line for `brief.line_no`, or `None`."""
        prompt = render_line(brief, lines, whole=whole, attempt=attempt,
                             reasons=reasons)
        return self.parse(self.call(prompt))

    def propose_group(self, group_brief):
        """-> one new line per member in `members` order, or `None`.

        `members` is handed to the parser rather than re-derived from the
        response, so a reply that answers a DIFFERENT set of lines is refused
        instead of accepted as a group nobody declared (doctrine 20).
        """
        return parse_group(self.call(render_group(group_brief)),
                           getattr(group_brief, "members", ()))
