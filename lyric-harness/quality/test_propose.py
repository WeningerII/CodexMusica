#!/usr/bin/env python3
"""Regressions for the brief-to-prompt renderer (quality/propose.py).

WHAT IS UNDER TEST IS A CONTRACT, NOT A STYLE. `render_line`/`render_pair`
produce prose, and prose cannot be asserted word for word without pinning
every future edit. What IS asserted here is the part a proposer would be
crippled without: that the prompt is REPRODUCIBLE, that every forbidden word
reaches it and reaches it LABELLED forbidden, that the previous attempt's
rejection reaches it, and that whole-draft findings reach it marked as not
this line's to fix. Everything else about the wording is free to change.

Sections:
  1  DETERMINISM, twice over — byte-identical across repeated calls in one
     process, and byte-identical across processes started with DIFFERENT
     `PYTHONHASHSEED`s on a brief whose fields are SETS. That second half is
     doctrine 66 as a test: iterating a set to render is a tie broken by the
     hash seed, and it does not reproduce.
  2  the FORBIDDEN modal set — every word present, every word under the
     heading that says taking it is rejected, and the offered field's own
     cap disclosed rather than silently truncating
  3  `reasons` — the previous attempt's rejection, verbatim, plus which
     attempt this is
  4  whole-draft findings, present AND labelled "NOT THIS LINE'S TO FIX",
     with their evidence
  5  parsing: every supported shape accepted, every ambiguous one REFUSED
     with `None`
  6  `ModelProposer` driving a REAL `revise_loop` end to end, twice: a stub
     that answers off the prompt's own offered field reaches SUCCESS, and a
     stub that takes a FORBIDDEN word is REJECTED by `verify()` — which is
     what makes the prompt's constraint text load-bearing rather than
     decorative. The second run also proves the rejection travels back INTO
     the next prompt.
  7  tier 2: the pair prompt states the situation `Brief.joint_conflict`
     actually describes (the MANDATE is what needs revising), carries both
     lines and both option lists, and round-trips through
     `ModelProposer.propose_pair`.

THE FORBIDDEN BLOCK IS LOAD-BEARING, AND THAT WAS MEASURED, NOT ASSERTED.
Replacing `render_line`'s `FORBIDDEN — do not end L{n} on any of these`
heading with a bare `AVOID` and re-running kills FOUR checks: two in section
2 (the words are no longer inside a block that says taking one is rejected)
and two in section 6b (the stub can no longer find a forbidden word to take,
so `verify()` never fires the modal rule and the rejection never reaches the
retry prompt). A prompt section nothing would notice the loss of is
decoration, and this one is not.

COST, MEASURED rather than estimated. Section 6 is the only slow part: two
real `revise_loop` runs over the same 4-line fixture `quality/test_loop.py`
uses. Timed per section on this machine — 29.7s for the SUCCESS run (which
pays for building the `Reviser` and its lexicon, then re-briefs the result
with a second fresh one) and 17.2s for the rejection run, against 0.1s for
sections 1-5, 7 and 7b PUT TOGETHER: everything outside section 6 builds no
`Reviser`, touches no lexicon and reads no data file, because
`quality/propose.py` imports nothing but `re`. Whole file: 40-44s with the
machine to itself, 48s measured while `quality/test_loop.py` ran beside it.

Run: python3 quality/test_propose.py
"""

import hashlib
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from quality.propose import (ModelProposer, OFFERED_SHOWN,  # noqa: E402
                             parse_line, parse_pair, render_line, render_pair)

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# -- stand-ins ----------------------------------------------------------
# `quality/propose.py` imports neither `revise` nor `loop` and reads every
# field with a `getattr` default, so these three classes are enough to
# render. Sections 6-7 use the REAL `Brief` a real `Reviser` mints, which is
# what keeps these from drifting into a shape nothing produces.

class F:
    """A `quality.floor.Finding` stand-in: the five fields render reads."""
    def __init__(self, code, severity, message, evidence, locations=()):
        self.code, self.severity = code, severity
        self.message, self.evidence = message, evidence
        self.locations = list(locations)


class B:
    """A `quality.revise.Brief` stand-in."""
    def __init__(self, **kw):
        self.line_no = kw.get("line_no", 1)
        self.text = kw.get("text", "")
        self.findings = kw.get("findings", [])
        self.must_rhyme_with = kw.get("must_rhyme_with")
        self.candidates = kw.get("candidates", [])
        self.forbidden_modal = kw.get("forbidden_modal", [])
        self.keep = kw.get("keep", [])
        self.must_answer = kw.get("must_answer", [])
        self.joint_conflict = kw.get("joint_conflict", False)
        self.field_declaration = kw.get(
            "field_declaration", "field_depth=complete pool, "
                                 "field_band='grader'")


class PB:
    """A `quality.loop.PairBrief` stand-in — the field list agreed with the
    sibling that owns `loop.py`. Built here rather than imported so this
    suite does not depend on that module's dataclass having landed."""
    def __init__(self, **kw):
        for k, v in kw.items():
            setattr(self, k, v)


DRAFT = ["It gleamed like polished silver",
         "We wandered deep into the mind",
         "The whole thing felt like a dream"]

PIVOT_BRIEF = B(
    line_no=3, text=DRAFT[2],
    findings=[F("SCHEME_VIOLATION", "flag",
                "L1 and L3 are both in group A [1, 3] but do not rhyme",
                "NO_RELATION (score 0.118; 'silver' ~ 'dream')", [1, 3])],
    candidates=[], forbidden_modal=["dream"], keep=[],
    must_answer=[("A", [1, 3], [(1, "silver")]),
                 ("B", [2, 3], [(2, "mind")])],
    joint_conflict=True)

PLAIN_BRIEF = B(
    line_no=1, text="The candle burned and set the room on fire",
    findings=[F("CLICHE_PAIR", "flag", "2 rhyme pair(s) on the stock list",
                "fire/desire; go/know", [1, 2])],
    candidates=["attire", "sire", "choir", "our"],
    forbidden_modal=["fire", "higher", "conspire", "entire"],
    keep=[3, 4],
    must_answer=[("A", [1, 3], [(3, "desire")])])

WHOLE = [F("LEXICAL_MONOTONY", "flag",
           "vocabulary repeats more than human verse did in calibration",
           "MATTR 0.757 < 0.7568 (human 5th percentile, section profile)"),
         F("UNIFORM_LINE_LENGTH", "note",
           "every line is close to the same length",
           "line-length CV 0.047 < 0.0525")]


# -- 1. determinism -----------------------------------------------------

#: Rendered in a SUBPROCESS, twice, under different `PYTHONHASHSEED`s. Every
#: collection here is a `set` on purpose: a renderer that iterates one is
#: emitting an order the hash seed picked, which is doctrine 66's "tie broken
#: by iterating a set" and does not reproduce. The stand-ins are redefined
#: inline because the child process gets no state from this one.
_SEEDED = r'''
import hashlib, sys
sys.path.insert(0, %r)
from quality.propose import render_line

class F:
    def __init__(self, code, severity, message, evidence, locations=()):
        self.code, self.severity = code, severity
        self.message, self.evidence = message, evidence
        self.locations = list(locations)

class B:
    line_no = 2
    text = "He said the word and then he turned to go"
    findings = {F("CLICHE_PAIR", "flag", "on the stock list", "go/know"),
                F("ANAPHORA_OVERLOAD", "flag", "3 of 4 lines open the same",
                  "opening 'the' at 75%%")}
    candidates = {"show", "grow", "flow", "ago", "blow", "snow"}
    forbidden_modal = {"go", "so", "below", "low"}
    keep = {4, 3, 1}
    must_answer = []
    must_rhyme_with = (4, "know")
    joint_conflict = False
    field_declaration = "field_depth=complete pool, field_band='grader'"

whole = {F("LEXICAL_MONOTONY", "flag", "repeats", "MATTR 0.757"),
         F("FUNCTION_WORD_HEAVY", "flag", "filler", "ratio 0.62")}
p = render_line(B(), ["a", "b", "c", "d"], whole=whole, attempt=2,
                reasons=["nothing was fixed", "L2 took the modal 'so'"])
sys.stdout.write(hashlib.sha256(p.encode()).hexdigest())
'''


def _render_under_seed(seed):
    env = dict(os.environ, PYTHONHASHSEED=str(seed))
    root = os.path.join(HERE, "..")
    out = subprocess.run([sys.executable, "-c", _SEEDED % root],
                         capture_output=True, text=True, env=env, timeout=120)
    if out.returncode != 0:
        return f"CRASH: {out.stderr[-400:]}"
    return out.stdout.strip()


def test_render_is_deterministic():
    print("\n1. DETERMINISM — the same brief renders byte-identically, and "
          "goes on doing so under a different hash seed")
    a = render_line(PLAIN_BRIEF, DRAFT, whole=WHOLE, attempt=1,
                    reasons=["nothing was fixed"])
    b = render_line(PLAIN_BRIEF, DRAFT, whole=WHOLE, attempt=1,
                    reasons=["nothing was fixed"])
    check("two calls in one process are byte-identical", a == b,
          f"{len(a)} chars")

    digests = [_render_under_seed(s) for s in (0, 1, 4242)]
    check("three processes with PYTHONHASHSEED 0/1/4242 agree, on a brief "
          "whose findings, candidates, forbidden set and keep list are all "
          "SETS -- a renderer that iterated one would differ here",
          len(set(digests)) == 1 and not digests[0].startswith("CRASH"),
          digests)

    # ...and the same rendering is INSENSITIVE to the order a set was built
    # in, which is the other half of the same guarantee: sorting is what
    # makes it reproducible, not luck about insertion order.
    s1 = B(line_no=1, text="x", candidates={"b", "a"}, keep={2, 1},
           forbidden_modal=["z"], findings=[])
    s2 = B(line_no=1, text="x", candidates={"a", "b"}, keep={1, 2},
           forbidden_modal=["z"], findings=[])
    check("two sets built in opposite orders render the same text",
          render_line(s1, ["x", "y"]) == render_line(s2, ["x", "y"]))

    # A RANKED list is NOT sorted, and that is the deliberate other side of
    # doctrine 66: `candidates`/`forbidden_modal` arrive ranked by the field,
    # and alphabetising them would destroy information rather than stabilise
    # an order that was already chosen.
    ranked = render_line(
        B(line_no=1, text="x", candidates=["zebra", "apple"],
          forbidden_modal=["yak", "ant"]), ["x"])
    check("a ranked LIST keeps its own order (only sets are sorted)",
          ranked.index("zebra") < ranked.index("apple")
          and ranked.index("yak") < ranked.index("ant"))


# -- 2. the forbidden modal set -----------------------------------------

def _section(prompt, head):
    """-> the text of the prompt block starting at `head`, up to the next
    blank line followed by a non-indented heading."""
    lines = prompt.split("\n")
    for i, row in enumerate(lines):
        if row.startswith(head):
            out = [row]
            for row2 in lines[i + 1:]:
                if row2 and not row2.startswith(" "):
                    break
                out.append(row2)
            return "\n".join(out)
    return ""


def test_forbidden_words_are_present_and_labelled():
    print("\n2. FORBIDDEN — every modal word reaches the prompt, inside the "
          "block that says taking one is rejected")
    p = render_line(PLAIN_BRIEF, DRAFT, whole=WHOLE)
    block = _section(p, "FORBIDDEN")
    missing = [w for w in PLAIN_BRIEF.forbidden_modal if w not in p]
    check("every forbidden word appears in the prompt at all",
          not missing, f"missing {missing}")
    outside = [w for w in PLAIN_BRIEF.forbidden_modal if w not in block]
    check("...and every one of them is inside the FORBIDDEN block, not "
          "merely somewhere in the text",
          not outside, f"outside the block: {outside}")
    check("the block says taking one is REJECTED, not merely discouraged -- "
          "listing them without that is a list of good rhymes",
          "REJECTED OUTRIGHT" in block, block.split("\n")[2:4])
    check("the OFFERED block says the field is offered, NOT required -- "
          "`verify()` never checks where the end word came from, and a "
          "prompt that demanded it would be enforcing a rule nobody grades",
          "Offered, NOT required" in _section(p, "OFFERED"))

    # THE CAP IS DISCLOSED WHEN IT BITES. A truncated field with no count
    # beside it is a threshold nobody wrote down (doctrine 58).
    big = B(line_no=1, text="x",
            candidates=[f"w{i:03d}" for i in range(OFFERED_SHOWN + 17)],
            forbidden_modal=["q"])
    pb = render_line(big, ["x"])
    check("an over-long candidate field is capped AND says so, with both "
          "counts",
          f"{OFFERED_SHOWN} of {OFFERED_SHOWN + 17} shown" in pb,
          _section(pb, "OFFERED").split("\n")[1])
    check("a field inside the cap is printed whole with no truncation note",
          "shown" not in _section(render_line(PLAIN_BRIEF, DRAFT), "OFFERED"))


# -- 3. the previous rejection ------------------------------------------

def test_reasons_reach_the_prompt():
    print("\n3. REASONS — why the last attempt was rejected reaches the "
          "next prompt, verbatim")
    reasons = ["L1 took the modal candidate 'higher' — it passes the band "
               "and it is the most predictable word in the field",
               "nothing was fixed"]
    p = render_line(PLAIN_BRIEF, DRAFT, whole=WHOLE, attempt=1,
                    reasons=reasons)
    check("every reason string is present VERBATIM, not summarised -- a "
          "paraphrase of \"took the modal candidate 'higher'\" loses the "
          "word",
          all(r in p for r in reasons))
    check("and it is labelled as the PREVIOUS attempt's rejection",
          "REJECTED" in _section(p, "ATTEMPT"))
    check("the attempt number is stated (attempt=1 is the second try)",
          "ATTEMPT 2" in p, _section(p, "ATTEMPT").split("\n")[1])
    first = render_line(PLAIN_BRIEF, DRAFT, whole=WHOLE, attempt=0)
    check("a first attempt says there was no rejection rather than leaving "
          "the block out",
          "ATTEMPT 1" in first and "No previous attempt" in first)
    check("a bare string reason is not rendered one character per bullet",
          "- nothing was fixed" in render_line(PLAIN_BRIEF, DRAFT,
                                               reasons="nothing was fixed"))


# -- 4. whole-draft findings --------------------------------------------

def test_whole_draft_findings_are_context_not_a_task():
    print("\n4. WHOLE — whole-draft findings reach the prompt, labelled as "
          "NOT this line's to fix")
    p = render_line(PLAIN_BRIEF, DRAFT, whole=WHOLE)
    block = _section(p, "WHOLE-DRAFT FINDINGS")
    check("the heading itself says they are not this line's to fix",
          "NOT THIS LINE'S TO FIX" in block, block.split("\n")[0])
    check("both codes are present with their EVIDENCE -- the evidence is "
          "the only place the measurement lives",
          all(f.code in block and f.evidence in block for f in WHOLE))
    check("the block says why they are here anyway: `verify()` reads them, "
          "so one can REJECT a revision it can never ask for",
          "is rejected" in block and "none of them can be fixed" in block)
    check("with no whole findings the section is absent, not an empty "
          "heading",
          "WHOLE-DRAFT FINDINGS" not in render_line(PLAIN_BRIEF, DRAFT))
    check("the per-line findings' evidence is carried too",
          "fire/desire; go/know" in _section(p, "WHAT THE GRADER FOUND"))
    check("the WHOLE DRAFT is in the prompt with line numbers, and the "
          "target line is marked",
          all(t in p for t in DRAFT) and f">> L{PLAIN_BRIEF.line_no}" in p)


def test_a_pivot_and_a_joint_conflict_are_stated():
    print("\n4b. the mandate half: every group, the words to answer, and "
          "what a joint conflict means")
    p = render_line(PIVOT_BRIEF, DRAFT, attempt=0)
    block = _section(p, "THE RHYME MANDATE")
    check("BOTH groups are named, with the word each one must answer",
          "group A [1, 3]" in block and "group B [2, 3]" in block
          and "'silver'" in block and "'mind'" in block, block)
    check("the line is called a PIVOT and the conjunction is stated",
          "PIVOT" in block and "EVERY one of them at once" in block)
    check("the joint conflict says the MANDATE is what needs revising -- "
          "the same sentence `Brief.joint_conflict` carries, so a proposer "
          "is not told to search harder in a pool already proven empty",
          "MANDATE, not the line" in block)
    check("an empty candidate field says WHY rather than printing nothing",
          "no candidate field was offered" in _section(p, "OFFERED"))
    check("the constraints are stated even with no candidates: one line, no "
          "other line, no forbidden word",
          all(s in p for s in ("ONE line back", "ONLY L3 changes",
                               "NOT one of the FORBIDDEN")))


# -- 5. parsing ---------------------------------------------------------

def test_parse_accepts_the_supported_shapes():
    print("\n5. PARSE — every supported shape, and every ambiguous one "
          "refused")
    good = "And all night long she nursed a small attire"
    cases = [
        ("bare line", good, good),
        ("bare line with whitespace", f"\n  {good}  \n", good),
        ("fenced block", f"```\n{good}\n```", good),
        ("fenced block with a language tag", f"```text\n{good}\n```", good),
        ("fence after prose", f"Here you go:\n\n```\n{good}\n```\n", good),
        ("LINE: marker", f"LINE: {good}", good),
        ("LINE: marker after prose", f"I chose 'attire'.\nLINE: {good}",
         good),
        ("lowercase line: marker", f"line: {good}", good),
        ("echoed L3: label", f"L3: {good}", good),
        ("echoed label inside a marker", f"LINE: L3: {good}", good),
        ("fence and marker that AGREE", f"```\n{good}\n```\nLINE: {good}",
         good),
        # DOCTRINE 26 IN THE PARSER. U+2019 is an apostrophe in this
        # codebase, and a line that opens and closes on one is a real lyric
        # shape, so an apostrophe is never read as a wrapper the way a
        # quotation mark is.
        ("a line that opens AND closes on an apostrophe",
         "'Cause I was never goin'", "'Cause I was never goin'"),
        ("the same with U+2019", "’Cause I was never goin’",
         "’Cause I was never goin’"),
    ]
    for name, raw, want in cases:
        got = parse_line(raw)
        check(f"accepts {name}", got == want, repr(got))

    refusals = [
        ("empty", ""),
        ("whitespace only", "   \n\n  "),
        ("no letters at all", "-- 42 --"),
        ("two bare lines", f"{good}\nOr maybe this one instead"),
        ("prose around a bare line, no marker",
         f"Here is my line:\n{good}\nHope that helps."),
        ("two LINE: markers", f"LINE: {good}\nLINE: something else"),
        ("two fenced blocks", f"```\n{good}\n```\n```\nother\n```"),
        ("a fence holding two lines", f"```\n{good}\nand another\n```"),
        ("an empty fence", "```\n\n```"),
        ("fence and marker that DISAGREE",
         f"```\n{good}\n```\nLINE: a different line entirely"),
        ("a quote-wrapped line", f'"{good}"'),
        ("a curly-quote-wrapped line", f"“{good}”"),
        ("a backtick-wrapped line", f"`{good}`"),
        ("a marker with nothing after it", "LINE:"),
        ("not a string at all", None),
    ]
    for name, raw in refusals:
        got = parse_line(raw)
        check(f"REFUSES {name} (returns None)", got is None, repr(got))


def test_parse_pair_needs_both_markers():
    print("\n5b. PARSE PAIR — two lines are only two lines when it is said "
          "which is which")
    p, a = "The pivot line now ends here", "The anchor line ends there"
    ok = parse_pair(f"PIVOT: {p}\nANCHOR: {a}")
    check("accepts the two-marker shape, pivot first", ok == (p, a), ok)
    check("accepts it inside a fence",
          parse_pair(f"```\nPIVOT: {p}\nANCHOR: {a}\n```") == (p, a))
    check("accepts the markers in the OTHER order -- the marker decides, "
          "not the position",
          parse_pair(f"ANCHOR: {a}\nPIVOT: {p}") == (p, a))
    for name, raw in [
            ("two bare lines", f"{p}\n{a}"),
            ("only a pivot", f"PIVOT: {p}"),
            ("only an anchor", f"ANCHOR: {a}"),
            ("a repeated marker", f"PIVOT: {p}\nPIVOT: {p}\nANCHOR: {a}"),
            ("two fences", f"```\nPIVOT: {p}\n```\n```\nANCHOR: {a}\n```"),
            ("a quoted half", f'PIVOT: "{p}"\nANCHOR: {a}'),
            ("nothing", "")]:
        check(f"REFUSES {name}", parse_pair(raw) is None, repr(raw[:40]))


# -- 6. end to end, through a real loop ---------------------------------

CLICHE = ["The candle burned and set the room on fire",
          "He said the word and then he turned to go",
          "And all night long she nursed a small desire",
          "She never asked the thing she had to know"]

_LINE_RE = re.compile(r"^THE LINE TO REVISE\n  L\d+: (.*)$", re.MULTILINE)
_OFFERED_RE = re.compile(r"^  \d+ word\(s\); field read at [^\n]*\n    (.*)$",
                         re.MULTILINE)
_FORBIDDEN_RE = re.compile(r"^FORBIDDEN[^\n]*\n  ([^\n]*)$", re.MULTILINE)


def _reads_the_prompt(prompt):
    """-> (line_text, [offered], [forbidden]) pulled back OUT of the prompt.

    The stubs below get nothing but the prompt string — that is the whole
    `callable(prompt) -> str` contract — so everything they answer with has
    to be recoverable from it. That is the point of driving the loop this
    way rather than closing over the `Brief`: if the offered field or the
    forbidden set failed to reach the prompt, these stubs could not answer
    at all and section 6 would fail rather than quietly testing nothing.
    """
    line = _LINE_RE.search(prompt)
    offered = _OFFERED_RE.search(prompt)
    forbidden = _FORBIDDEN_RE.search(prompt)
    return (line.group(1) if line else None,
            offered.group(1).split(", ") if offered else [],
            forbidden.group(1).split(", ") if forbidden else [])


def test_model_proposer_drives_a_real_loop_to_success():
    print("\n6. END TO END — a stub `call` answering off the prompt alone "
          "drives a REAL revise_loop to SUCCESS")
    from quality.loop import revise_loop, swap_end_word
    from quality.revise import Reviser

    seen = []

    def call(prompt):
        seen.append(prompt)
        text, offered, _forbidden = _reads_the_prompt(prompt)
        if text is None or not offered:
            return "I cannot answer that."
        return f"LINE: {swap_end_word(text, offered[0])}"

    R = Reviser()
    res = revise_loop(R, CLICHE, "ABAB", propose=ModelProposer(call).propose)
    check("the loop reaches SUCCESS through the proposer",
          res.stop_reason == "success", res.stop_reason)
    check("both flagged lines were fixed", set(res.rounds[0].fixed_lines)
          == {1, 2}, res.rounds[0].fixed_lines)
    check("the stub was driven by the PROMPT and nothing else -- it never "
          "saw a Brief, so a prompt missing the line or the offered field "
          "could not have produced these",
          len(seen) == 2 and all(_reads_the_prompt(p)[0] for p in seen),
          f"{len(seen)} prompt(s)")
    check("the loop's output is a real draft, changed only on the two "
          "flagged lines",
          res.lines[2:] == CLICHE[2:] and res.lines[:2] != CLICHE[:2],
          res.lines)

    R2 = Reviser()
    final = R2.brief(res.lines, "ABAB")
    check("re-briefed with a FRESH Reviser the result carries no flag -- the "
          "SUCCESS is not taken on the loop's word",
          not any(f.severity == "flag" for b in final for f in b.findings))


def test_a_forbidden_word_is_rejected_by_the_grader():
    print("\n6b. END TO END — a stub that takes a FORBIDDEN word is "
          "REJECTED, which is what makes the prompt's constraint real")
    from quality.loop import revise_loop, swap_end_word
    from quality.revise import ReviseDeclaration, Reviser
    from lyric_harness import raw_final_token

    seen = []

    def call(prompt):
        seen.append(prompt)
        text, _offered, forbidden = _reads_the_prompt(prompt)
        here = (raw_final_token(text) or "").lower()
        for w in forbidden:
            if w != here:
                return swap_end_word(text, w)
        return "no forbidden word to take"

    R = Reviser(rdecl=ReviseDeclaration(max_rounds=1, attempts_per_line=2))
    res = revise_loop(R, CLICHE, "ABAB", propose=ModelProposer(call).propose)
    check("the loop cannot make progress: every proposal is turned down",
          res.stop_reason == "no_progress", res.stop_reason)
    check("the draft is byte-identical -- a rejected proposal changes "
          "nothing", res.lines == CLICHE)
    reasons = " | ".join(a.reason for r in res.rounds for a in r.attempts)
    check("and the rejection is the MODAL rule specifically, not some "
          "incidental failure: doctrine 9 enforced, exactly as the prompt "
          "said it would be",
          "took the modal candidate" in reasons, reasons[:200])
    check("every attempt was really tried (the proposer answered; it did "
          "not decline)",
          all(a.tried == 2 for r in res.rounds for a in r.attempts),
          [a.tried for r in res.rounds for a in r.attempts])

    # THE LOOP AROUND THE LOOP. The second prompt for a line is the first
    # place `reasons` can be OBSERVED doing its job on real grader output
    # rather than a hand-written string (section 3).
    retries = [p for p in seen if "ATTEMPT 2" in p]
    check("the grader's own rejection reaches the NEXT prompt for that line",
          retries and all("took the modal candidate" in p for p in retries),
          f"{len(retries)} retry prompt(s)")


# -- 7. tier 2 ----------------------------------------------------------

def test_pair_prompt_states_the_tier2_situation():
    print("\n7. TIER 2 — the pair prompt says the MANDATE is what needs "
          "revising, and round-trips through ModelProposer")
    pb = PB(pivot_line_no=3, pivot_text=DRAFT[2], pivot_word="dream",
            pivot_offered=["mankind", "signed", "kind"],
            anchor_line_no=1, anchor_text=DRAFT[0], anchor_word="silver",
            anchor_offered=["deliver", "river", "quiver"],
            label="A", members=[1, 3], brief=PIVOT_BRIEF, lines=DRAFT,
            attempt=0, reasons=None, whole=WHOLE)
    p = render_pair(pb)
    check("it says the search has ALREADY come back empty, so this is not "
          "'try harder' on the same line",
          "came back empty" in p and "no better word" in p)
    check("...and names what actually needs revising",
          "MANDATE is" in p, [r for r in p.split("\n") if "MANDATE" in r])
    check("both lines are present, both numbered, both end words named",
          all(s in p for s in ("PIVOT   L3:", "ANCHOR  L1:", "'dream'",
                               "'silver'")))
    check("both option lists are present and attributed to the right line",
          "mankind" in p and "deliver" in p
          and "PIVOT OPTIONS" in p and "ANCHOR OPTIONS" in p)
    check("the coupling is stated: the two picks must rhyme with each other",
          "must rhyme" in p and "COUPLED" in p)
    check("the whole draft and the whole-draft findings ride along, still "
          "labelled not-these-lines'",
          all(t in p for t in DRAFT) and "NOT THESE LINES' TO FIX" in p)
    check("the response format demands both markers and says why bare lines "
          "are discarded",
          "PIVOT: <the new L3>" in p and "discarded unread" in p)
    check("the pivot's own findings and evidence are carried",
          "SCHEME_VIOLATION" in p and "score 0.118" in p)

    got = {}

    def call(prompt):
        got["prompt"] = prompt
        return ("PIVOT: The whole thing felt like mankind\n"
                "ANCHOR: It gleamed like polished deliver")
    out = ModelProposer(call).propose_pair(pb)
    check("ModelProposer.propose_pair returns the two lines in (pivot, "
          "anchor) order",
          out == ("The whole thing felt like mankind",
                  "It gleamed like polished deliver"), out)
    check("...off the prompt render_pair produced", got["prompt"] == p)

    def declines(prompt):
        return "I would rather rewrite the whole verse, honestly."
    check("an unparseable pair response is None, not a guess",
          ModelProposer(declines).propose_pair(pb) is None)

    def one_line(prompt):
        return "LINE: The whole thing felt like mankind"
    check("a single-line response to a PAIR request is refused rather than "
          "written into one of the two slots",
          ModelProposer(one_line).propose_pair(pb) is None)


def test_model_proposer_surface():
    print("\n7b. ModelProposer's own contract")
    calls = []

    def call(prompt):
        calls.append(prompt)
        return "LINE: The candle burned and set the room alight"
    mp = ModelProposer(call)
    got = mp.propose(PLAIN_BRIEF, DRAFT, 0)
    check("propose(brief, lines, attempt) -> str",
          got == "The candle burned and set the room alight", got)
    check("...and it renders exactly render_line's prompt",
          calls[0] == render_line(PLAIN_BRIEF, DRAFT, whole=(), attempt=0,
                                  reasons=None))
    mp.propose(PLAIN_BRIEF, DRAFT, 2, ["nothing was fixed"], WHOLE)
    check("the full 5-argument form is accepted positionally, and both "
          "extras reach the prompt",
          "nothing was fixed" in calls[1] and "LEXICAL_MONOTONY" in calls[1])
    check("a response nothing can be parsed out of is None, so the loop "
          "reads it as 'no further proposal' and moves on",
          ModelProposer(lambda p: "Sorry, two options:\nA line\nB line"
                        ).propose(PLAIN_BRIEF, DRAFT, 0) is None)
    check("a non-string response is None rather than a crash",
          ModelProposer(lambda p: None).propose(PLAIN_BRIEF, DRAFT, 0) is None)

    def custom(text):
        return text.upper()
    check("`parse=` overrides the tier-1 parser only",
          ModelProposer(call, parse=custom).propose(PLAIN_BRIEF, DRAFT, 0)
          == "LINE: THE CANDLE BURNED AND SET THE ROOM ALIGHT")

    def boom(prompt):
        raise RuntimeError("transport is down")
    try:
        ModelProposer(boom).propose(PLAIN_BRIEF, DRAFT, 0)
        raised = False
    except RuntimeError:
        raised = True
    check("an exception from `call` PROPAGATES -- an outage is not a model "
          "declining, and a loop that cannot tell them apart reports a dead "
          "end for a network failure", raised)

    check("no network, no client, no key: the module imports `re` and "
          "nothing else",
          _imports_of_propose() == {"re"}, _imports_of_propose())


def _imports_of_propose():
    """-> the set of top-level modules `quality/propose.py` imports.

    Read off the SOURCE rather than off `sys.modules`, so this cannot be
    satisfied by an import that happened to run already.
    """
    src = open(os.path.join(HERE, "propose.py"), encoding="utf-8").read()
    mods = set()
    for row in src.split("\n"):
        m = re.match(r"^(?:import|from)\s+([A-Za-z_][\w.]*)", row)
        if m:
            mods.add(m.group(1).split(".")[0])
    return mods


if __name__ == "__main__":
    for fn in (test_render_is_deterministic,
               test_forbidden_words_are_present_and_labelled,
               test_reasons_reach_the_prompt,
               test_whole_draft_findings_are_context_not_a_task,
               test_a_pivot_and_a_joint_conflict_are_stated,
               test_parse_accepts_the_supported_shapes,
               test_parse_pair_needs_both_markers,
               test_pair_prompt_states_the_tier2_situation,
               test_model_proposer_surface,
               test_model_proposer_drives_a_real_loop_to_success,
               test_a_forbidden_word_is_rejected_by_the_grader):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all propose regressions pass")
