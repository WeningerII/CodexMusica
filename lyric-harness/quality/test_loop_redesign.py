"""test_loop_redesign.py — the revise-loop redesign for long songs
(`quality/LOOP_REDESIGN.md`, design v4, built 2026-10-02 on).

Every section names the design section it pins and the defect it closes,
and every section has a half that FAILS ON THE CODE BEFORE THE REDESIGN
(the design's own rule, §4.2, and doctrine 48 in CLAUDE.md "Test
discipline": a check that cannot fail reads exactly like one that passes).

Sections:
  1. `verify` builds no offer it does not read (§2.6, T8).
     (a) THE FAILING HALF: inside `verify`, `brief` is asked for the verify
         fields only, and no offer-building search runs (`_widen_pool`,
         `schema_widened_field`, a `declared_offer` with a `limit`). Before
         the redesign `verify` asked for the full brief, so this fails there.
     (b) THE EQUALITY HALF: on every fixture pair, and on every `verify` a
         stub-driven loop makes over the corpus below, the new `verify`
         returns the same dict, key for key and `reasons` byte for byte, as
         `verify` with the full brief (the old behaviour, run in-process).
     (c) THE MUTANTS: a verify mode that empties `forbidden_modal`
         ("drop rule 3") and one that skips `declared_offer`'s filter of the
         forbidden head ("skip the filter") each make (b) fail on the corpus,
         so (b) can see what it is there to see.
  2. Every batch answer has a standing (§2.2 option B, owner's ruling
     2026-10-02; §2.8 D; T3 and the coupling test).
     (a) AABB, Phase 1's defect-2 reproduction: the batch member the walk
         has not reached has no record yet (the connector renders it
         `pending`), and a later call judges it exactly once.
     (b) A member whose finding an earlier member's acceptance closed gets a
         `not_applied` disposition naming that line, in its own list. Before
         the redesign nothing was written, so this fails there.
     (c) THE COUPLING TEST (C2): the walk with the pass-by hook and without
         it asks the same questions and reaches the same result, so option B
         changes nothing about what is accepted.
  3. Group questions offer words (§2.4, §2.8 G; T6; defect 4).
     (a) The couplet escalation, Phase 1's reproduction: L1, a member with
         no per-line finding, is shown its one-move menu, and the printed
         words are exactly `member_place_field`'s. Before the redesign the
         prompt printed `(none offered)`, so this fails there.
     (b) `member_place_field` IS `brief()`'s per-place code: on a line that
         `brief()` does brief, its offer and forbidden head equal the brief's.
     (c) The group-first path adds no menu and says why; the pivot's own
         line-question lists are printed only on the escalation path.
  4. Resume from the saved position equals replay (§2.0; T1, T2), in-process.
     A scripted proposer suspends at every unanswered question; the same
     conversation is driven to the end twice, once replaying from round 1
     on every call (today) and once resuming from `revise_loop`'s saved
     position. Every question (its identity and its rendered bytes), the
     final draft, the stop and the round history must be identical, and in
     the resuming arm each answer is verified exactly once. Before the
     redesign `revise_loop` took no `resume`, so this fails there.
  5. The same through the real verb (§2.0, §2.0.1; T1, T2, T7), one process
     per call as the connector runs it.
     (a) A conversation is driven twice: resuming from the saved position,
         and with the position deleted before every call (full replay).
         Every question's bytes, every outcome and disposition, the stale
         count and the proposer disclosure match; the resuming arm reports
         `replayed_answers` 0 on every call and the replay arm does not.
     (b) T7 on the CLI: an edited earlier answer falls back to replay with
         `cursor_stripped: digest`; a changed run (another argv) falls back
         with `run_key`; neither reaches a different result than a replay.
  6. A call that nears its deadline stops at a safe point (§2.3b, §2.8 E;
     T4). A `Deadline` that stops before the k-th costly step — a POSITION,
     never a time — is placed before a call's first grade, between two
     members' menus of a batch or group question, between an answer and its
     verdict, and before a menu. Each stop leaves a saved position; the next
     call, with no answer, resumes and re-verifies nothing; and every
     question is byte-identical to the uninterrupted run's. Before the
     redesign `revise_loop` took no deadline, so this fails there.
  7. A killed call keeps the run (§2.3c-d; T5): the next call resumes from
     the last checkpoint and re-verifies nothing; a full replay killed
     partway never regresses the accepted lines; three kills at one step
     end at one position (what the connector counts as `no_progress_calls`)
     and a call with time still finishes the same run.
  8. A group question's menus are built across calls (§2.8 E, S11): a stop
     before the second member's one-move menu keeps the first, and the next
     call builds only the missing one, to the same fields.
  9. A line's menu is saved place by place (owner ruling 2026-10-03,
     option B): a stop between two places keeps the first, the next call
     builds only the second, and the menu and its rendered question are
     exactly the uninterrupted ones.
"""

import copy
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from quality import loop as LP  # noqa: E402
from quality import revise as RV  # noqa: E402
from quality import schemes as SC  # noqa: E402
from quality.revise import Reviser  # noqa: E402

FAILS = []


def check(name, cond, detail=""):
    tag = "PASS" if cond else "FAIL"
    print(f"  {tag}  {name}" + (f"  [{detail}]" if detail and not cond
                                else ""))
    if not cond:
        FAILS.append(name)


# ---------------------------------------------------------------------------
# Fixtures. Each is quoted from the suite that owns it, so a reader can see
# where its premise was first measured.
# ---------------------------------------------------------------------------

#: test_revise.py `CLICHE`, mandate "ABAB" on the undeclared default (§4 there:
#: taking a forbidden modal candidate is rejected).
CLICHE = ["The candle burned and set the room on fire",
          "He said the word and he turned to go",
          "And all night long she nursed a small desire",
          "She never asked the thing she had to know"]

#: test_revise.py §41's couplet, under a DECLARED relation. MEASURED
#: 2026-10-02: the raw modal head of 'four' has 15 words; under class:RHYME
#: `declared_offer` keeps 7 (among them 'door') and drops 8 (among them
#: 'tour', 'detour').
STAIR = ["the kitchen light is burning at half past four",
         "and my brother came back to climb the stair"]

#: Phase 1's defect-2 and defect-4 reproductions (LOOP_REDESIGN.md §1.1).
AABB = ["I left the kettle on the stove",
        "and walked out to the empty yard",
        "the wind came knocking at the door",
        "and left its footprints in the sand"]

#: test_loop.py `ANCHOR_HAS_A_LIVE_GROUP` / `LIVE_GROUPS`: a pivot with a
#: live group on each side, which reaches tier 2.
LIVE = ["the kitchen light is burning at half past four",
        "and nobody came back to climb the stairs",
        "she left the coffee cooling on the chairs",
        "i heard him turn the handle of the door"]
LIVE_GROUPS = [[1, 2], [2, 3], [3, 4]]

#: A couplet whose end words have no screened offer under a declared schema,
#: so a FULL brief of L2 runs the whole-lexicon widening. MEASURED 2026-10-02
#: under `schema:perfect rhyme`: `brief(target_lines={2})` offers 0 words and
#: calls `_widen_pool` once and a limited `declared_offer` once. It is what
#: makes 1(a)'s "no offer search inside verify" able to fail.
SILVER = ["the river ran beneath the silver",
          "we waited there for half a month"]


def _m(scheme_or_groups, n, relation=None):
    m = SC.mandate(scheme_or_groups, n_lines=n)
    return SC.mandate(m, default_relation=relation) if relation else m


def _verify_old(R, before, after, mandate, **kw):
    """`verify` exactly as it was before §2.6: its internal brief built the
    full offer. Run by dropping the new keyword on the way in."""
    real = RV.Reviser.brief

    def full(self, *a, **k):
        k.pop("_verify_fields_only", None)
        return real(self, *a, **k)
    RV.Reviser.brief = full
    try:
        return R.verify(before, after, mandate, **kw)
    finally:
        RV.Reviser.brief = real


def _strip(d):
    """A verify dict, comparable: every value as it is, nothing dropped."""
    return {k: d[k] for k in sorted(d)}


# ---------------------------------------------------------------------------
# 1. verify builds no offer it does not read
# ---------------------------------------------------------------------------

def _fixture_pairs():
    """(name, before, after, mandate, targeted) pairs that each reach a rule-3
    branch. Built from the fixtures above; the words are read off the briefs
    rather than typed, so a lexicon change moves the pair, not the premise."""
    R = Reviser()
    pairs = []
    m_cl = _m("ABAB", 4)
    b2 = [b for b in R.brief(CLICHE, m_cl) if b.line_no == 2][0]
    modal = [w for w in b2.forbidden_modal if w != b2.forbidden_incumbent]
    after = list(CLICHE)
    after[1] = f"He said the word and turned to face the {modal[0]}"
    pairs.append(("CLICHE takes a modal word (default branch)",
                  CLICHE, after, m_cl, {2}))
    after = list(CLICHE)
    after[1] = "He said the word and he turned to go again"
    pairs.append(("CLICHE moves off its incumbent (default branch)",
                  CLICHE, after, m_cl, {2}))

    m_st = _m("AA", 2, "class:RHYME")
    pairs.append(("STAIR takes 'door' (declared, in forbidden_modal)",
                  STAIR, [STAIR[0], "and my brother came back to open the door"],
                  m_st, {2}))
    pairs.append(("STAIR takes 'tour' (declared, raw head only)",
                  STAIR, [STAIR[0], "and my brother came back from the tour"],
                  m_st, {2}))
    pairs.append(("STAIR keeps its incumbent 'stair'",
                  STAIR, [STAIR[0], "and my brother climbed the stair"],
                  m_st, {2}))
    m_ab = _m("AABB", 4, "class:RHYME")
    pairs.append(("AABB answers L4 from its own offer",
                  AABB, AABB[:3] + ["and left its footprints near the drawer"],
                  m_ab, {4}))
    pairs.append(("AABB answers L2 with a miss",
                  AABB, [AABB[0], "and walked out to the empty field"] + AABB[2:],
                  m_ab, {2}))
    m_sv = _m("AA", 2, "schema:perfect rhyme")
    pairs.append(("SILVER rewrites L2 (declared schema, empty offer)",
                  SILVER, [SILVER[0], "we waited there for half a year"],
                  m_sv, {2}))
    pairs.append(("AABB rewrites two lines at once (no targets)",
                  AABB, [AABB[0], "and walked out to the empty cove",
                         AABB[2], "and left its footprints near the drawer"],
                  m_ab, None))
    return pairs


def _harvest_loop_verifies():
    """Every `verify` a stub-driven `revise_loop` makes on the fixtures, as
    (name, before, after, mandate, kwargs). The stub is the loop's own
    `default_propose`, so the pairs are the ones the loop really asks about."""
    out = []
    real = RV.Reviser.verify

    def record(self, before, after, mandate=None, **kw):
        out.append((f"loop verify #{len(out) + 1}", list(before), list(after),
                    mandate, dict(kw)))
        return real(self, before, after, mandate, **kw)
    RV.Reviser.verify = record
    try:
        for lines, mand in ((CLICHE, _m("ABAB", 4)),
                            (AABB, _m("AABB", 4, "class:RHYME")),
                            (LIVE, _m(LIVE_GROUPS, 4, "class:RHYME"))):
            rd = RV.ReviseDeclaration(max_rounds=2, attempts_per_line=2,
                                      backtrack_width=1)
            LP.revise_loop(Reviser(rdecl=rd), list(lines), mand,
                           propose_group=LP.default_propose_group)
    finally:
        RV.Reviser.verify = real
    return out


def test_verify_reads_no_offer():
    print("\n1. verify builds no offer it does not read (LOOP_REDESIGN.md §2.6, T8)")
    pairs = _fixture_pairs()

    # (a) THE FAILING HALF.
    seen = {"brief_kwargs": [], "widen": 0, "schema_widen": 0, "limited": 0}
    real_brief = RV.Reviser.brief
    real_widen = RV.Reviser._widen_pool
    real_sw = RV.Reviser.schema_widened_field
    real_do = RV.Reviser.declared_offer

    def brief(self, *a, **k):
        seen["brief_kwargs"].append(dict(k))
        return real_brief(self, *a, **k)

    def widen(self, *a, **k):
        seen["widen"] += 1
        return real_widen(self, *a, **k)

    def sw(self, *a, **k):
        seen["schema_widen"] += 1
        return real_sw(self, *a, **k)

    def do(self, *a, **k):
        if k.get("limit") is not None:
            seen["limited"] += 1
        return real_do(self, *a, **k)
    RV.Reviser.brief, RV.Reviser._widen_pool = brief, widen
    RV.Reviser.schema_widened_field, RV.Reviser.declared_offer = sw, do
    try:
        R = Reviser()
        for _name, before, after, mand, tg in pairs:
            R.verify(before, after, mand, targeted=tg)
    finally:
        RV.Reviser.brief, RV.Reviser._widen_pool = real_brief, real_widen
        RV.Reviser.schema_widened_field, RV.Reviser.declared_offer = real_sw, real_do
    targeted_briefs = [k for k in seen["brief_kwargs"] if "target_lines" in k]
    check("inside verify, every per-line brief asks for the verify fields only "
          "(`_verify_fields_only=True`) — before the redesign it asked for the "
          "full offer, so this fails there",
          targeted_briefs and all(k.get("_verify_fields_only") is True
                                  for k in targeted_briefs),
          f"{len(targeted_briefs)} briefs: "
          f"{[k.get('_verify_fields_only') for k in targeted_briefs]}")
    # PREMISE for the next check: the SAME pairs through the old full brief
    # do run the offer searches, so "zero" below is a measurement, not the
    # absence of an occasion (doctrine 20).
    seen_new = {k: seen[k] for k in ("widen", "schema_widen", "limited")}
    seen.update(widen=0, schema_widen=0, limited=0)
    RV.Reviser._widen_pool, RV.Reviser.declared_offer = widen, do
    RV.Reviser.schema_widened_field = sw
    try:
        R = Reviser()
        for _name, before, after, mand, tg in pairs:
            _verify_old(R, before, after, mand, targeted=tg)
    finally:
        RV.Reviser._widen_pool, RV.Reviser.declared_offer = real_widen, real_do
        RV.Reviser.schema_widened_field = real_sw
    seen_old = {k: seen[k] for k in ("widen", "schema_widen", "limited")}
    seen.update(seen_new)
    check("PREMISE: the old full brief, on the same pairs, DOES run the offer "
          "searches (whole-lexicon widening, a limited declared_offer)",
          seen_old["widen"] > 0 and seen_old["limited"] > 0, str(seen_old))
    check("...and no offer-building search runs inside verify: zero calls to "
          "`_widen_pool`, `schema_widened_field`, or `declared_offer` with a "
          "`limit`",
          seen["widen"] == 0 and seen["schema_widen"] == 0
          and seen["limited"] == 0, str({k: v for k, v in seen.items()
                                         if k != "brief_kwargs"}))

    # (b) THE EQUALITY HALF, on the fixture pairs and the loop's own pairs.
    corpus = [(n, b, a, m, {"targeted": tg}) for n, b, a, m, tg in pairs]
    corpus += _harvest_loop_verifies()
    R = Reviser()
    diffs = []
    rule3_fired = kept_disclosed = 0
    for name, before, after, mand, kw in corpus:
        new = R.verify(before, after, mand, **kw)
        old = _verify_old(R, before, after, mand, **kw)
        if _strip(new) != _strip(old):
            diffs.append(name)
        rule3_fired += bool(old.get("modal_violations"))
        kept_disclosed += bool(old.get("modal_endword_unchanged"))
    check(f"the new verify returns the old verify's dict on all {len(corpus)} "
          f"pairs, key for key and `reasons` byte for byte",
          not diffs, f"differ: {diffs[:5]}")
    check("PREMISE: the corpus reaches both rule-3 outcomes — a modal word "
          "TAKEN and an incumbent KEPT — so (b) examined rule 3 and not only "
          "its absence",
          rule3_fired >= 2 and kept_disclosed >= 1,
          f"taken={rule3_fired} kept={kept_disclosed}")

    # (c) THE MUTANTS.
    def mutant_drop_rule3(self, *a, **k):
        out = real_brief(self, *a, **k)
        if k.get("_verify_fields_only"):
            for b in out:
                b.forbidden_modal = []
        return out

    def mutant_skip_filter(self, *a, **k):
        if not k.get("_verify_fields_only"):
            return real_brief(self, *a, **k)

        def passthrough(_self, candidates, *a2, **k2):
            return list(dict.fromkeys(candidates)), []
        RV.Reviser.declared_offer = passthrough
        try:
            return real_brief(self, *a, **k)
        finally:
            RV.Reviser.declared_offer = real_do

    for label, mutant in (("drop rule 3", mutant_drop_rule3),
                          ("skip the filter", mutant_skip_filter)):
        caught = []
        for name, before, after, mand, kw in corpus[:len(pairs)]:
            old = _verify_old(R, before, after, mand, **kw)
            RV.Reviser.brief = mutant
            try:
                mut = Reviser().verify(before, after, mand, **kw)
            finally:
                RV.Reviser.brief = real_brief
            if _strip(mut) != _strip(old):
                caught.append(name)
        check(f"MUTANT '{label}' in the verify mode is caught by the equality "
              f"half (it changes at least one fixture's verdict)",
              bool(caught), "the mutant passed every fixture")


# ---------------------------------------------------------------------------
# 2. every batch answer has a standing
# ---------------------------------------------------------------------------

#: Four of eight lines open with "and": over the anaphora threshold at this
#: length (MEASURED 2026-10-02: 43.2% at 54 tokens). Rewriting one opener
#: leaves 3 of 8 and closes the finding on the other three, which are rhyme-
#: independent, so the four are asked as ONE batch [1, 3, 5, 7].
ANAPHORA = ["and the river wanders past the mill",
            "the heron stands there waiting until",
            "and the children whistle in the rain",
            "a farmer leans upon his cane",
            "and the lantern flickers by the wall",
            "my mother folds her winter shawl",
            "and the kettle rattles on the coal",
            "a sparrow settles on the pole"]


class _Deferred:
    """A deferred `revise` run through the real verb, one process per call."""

    def __init__(self, lines, scheme, *flags):
        self.dir = tempfile.mkdtemp(prefix="loop-redesign-")
        self.draft = os.path.join(self.dir, "draft.txt")
        self.state = os.path.join(self.dir, "state.json")
        with open(self.draft, "w") as fh:
            fh.write("\n".join(lines) + "\n")
        self.cmd = [sys.executable, "lyric_harness.py", "revise", self.draft,
                    scheme, *flags, f"--propose=defer:{self.state}"]

    def call(self, answer=None):
        if answer is not None:
            st = self.read()
            st["pending"]["answer"] = answer
            with open(self.state, "w") as fh:
                json.dump(st, fh)
        p = subprocess.run(self.cmd, cwd=ROOT, capture_output=True,
                           text=True, timeout=1800)
        return p.returncode

    def read(self):
        with open(self.state) as fh:
            return json.load(fh)

    def asked(self):
        p = self.read().get("pending") or {}
        rec = p.get("record") or {}
        if p.get("kind") == "propose_batch":
            return p["kind"], [r["line"] for r in rec["records"]]
        if p.get("kind") == "propose_group":
            return p["kind"], list(rec["members"])
        return p.get("kind"), [rec.get("line")]


def test_every_batch_answer_has_a_standing():
    print("\n2. every batch answer has a standing (§2.2 option B, T3, C2)")
    flags = ("--relation=class:RHYME", "--attempts=1")

    # (a) AABB: pending until reached, then judged exactly once.
    run = _Deferred(AABB, "AABB", *flags, "--backtrack=1")
    run.call()
    check("PREMISE: L2 and L4 are asked as one batch", run.asked() ==
          ("propose_batch", [2, 4]), str(run.asked()))
    run.call("L2: and walked out to the empty field\n"
             "L4: and left its footprints near the drawer")
    st = run.read()
    outs = {(o["line"], o["round"]): o["accepted"] for o in st["outcomes"]}
    check("after the batch answer L2 is judged (rejected) and L4 holds no "
          "record yet: the connector renders it `pending`, waiting on the "
          "question asked now",
          outs.get((2, 1)) is False and (4, 1) not in outs
          and not st.get("dispositions") and run.asked()[0] == "propose_group",
          f"{outs} {st.get('dispositions')} {run.asked()}")
    for _ in range(6):
        kind, asked = run.asked()
        if kind is None or any(o["line"] == 4 for o in run.read()["outcomes"]):
            break
        cur = run.read()["accepted_lines"]
        run.call("\n".join(f"L{n}: {cur[n - 1]}" for n in asked)
                 if kind != "propose" else cur[asked[0] - 1])
    l4 = [o for o in run.read()["outcomes"] if o["line"] == 4]
    check("a later call judges L4's batch answer exactly once, and accepts "
          "the offered rhyme it was given",
          len(l4) == 1 and l4[0]["accepted"] is True,
          str([(o["line"], o["accepted"], o["reasons"][:1]) for o in l4]))

    # (b) a member closed by an earlier member's acceptance: not_applied.
    run = _Deferred(ANAPHORA, "AABBCCDD", *flags, "--backtrack=0")
    run.call()
    check("PREMISE: the four 'and' lines are asked as one batch",
          run.asked() == ("propose_batch", [1, 3, 5, 7]), str(run.asked()))
    run.call("L1: the river wanders past the mill\n"
             "L3: and the children whistle in the falling rain\n"
             "L5: and the lantern flickers by the garden wall\n"
             "L7: and the kettle rattles on the glowing coal")
    kind, asked = run.asked()
    cur = run.read()["accepted_lines"]
    run.call("\n".join(f"L{n}: {cur[n - 1]} again" for n in asked))
    st = run.read()
    disp = {d["line"]: d for d in st.get("dispositions") or ()}
    check("L1's accepted rewrite closed the anaphora on L3, L5 and L7: each "
          "gets a `not_applied` disposition naming L1 — before the redesign "
          "nothing was written, so this fails there",
          sorted(disp) == [3, 5, 7]
          and all(d["disposition"] == "not_applied" and d["why"] == "closed"
                  and d["by"] == [1] for d in disp.values()),
          str(st.get("dispositions")))
    check("...and those answers are NOT in `outcomes`: the rejection history "
          "and the questions it feeds are exactly as before",
          not any(o["line"] in (3, 5, 7) for o in st["outcomes"])
          and any(o["line"] == 1 and o["accepted"] for o in st["outcomes"]),
          str([(o["line"], o["accepted"]) for o in st["outcomes"]]))

    # (c) THE COUPLING TEST: the hook changes nothing about the walk.
    def scripted(with_hook):
        asked = []

        def propose(brief, lines, attempt, reasons=None, whole=()):
            asked.append((brief.line_no, attempt, brief.round_no))
            words = lines[brief.line_no - 1].split()
            return " ".join(words[1:] if words[0] == "and" else words)
        if with_hook:
            propose.skipped = lambda *a, **k: None
        rd = RV.ReviseDeclaration(max_rounds=2, attempts_per_line=1,
                                  backtrack_width=0)
        res = LP.revise_loop(Reviser(rdecl=rd), list(ANAPHORA),
                             _m("AABBCCDD", 8, "class:RHYME"), propose=propose)
        return asked, list(res.lines), res.stop_reason, [
            (r.round_no, [(a.line_no, a.accepted) for a in r.attempts],
             r.fixed_lines, r.resolved_elsewhere) for r in res.rounds]
    with_, without = scripted(True), scripted(False)
    check("THE COUPLING TEST: with the pass-by hook and without it, the walk "
          "asks the same questions in the same order and reaches the same "
          "draft, stop and round history — option B changes nothing about "
          "acceptance",
          with_ == without, f"{with_[:2]} vs {without[:2]}")
    check("PREMISE: that walk really passed lines by (resolved_elsewhere is "
          "non-empty), so the hook was exercised",
          any(r[3] for r in with_[3]), str(with_[3]))


# ---------------------------------------------------------------------------
# 3. group questions offer words
# ---------------------------------------------------------------------------

COUPLET = ["I left the kettle on the stove",
           "and walked out to the empty yard"]


def test_group_questions_offer_words():
    print("\n3. group questions offer words (§2.4, §2.8 G, T6)")
    from quality.propose import render_group
    # (a) the couplet escalation, through the real verb.
    run = _Deferred(COUPLET, "AA", "--relation=class:RHYME", "--attempts=1",
                    "--backtrack=1")
    run.call()
    run.call("and walked out to the empty field")
    st = run.read()
    prompt = (st.get("pending") or {}).get("prompt", "")
    check("PREMISE: the rejected line answer escalated to a group question "
          "on L1+L2", run.asked() == ("propose_group", [1, 2]), str(run.asked()))
    m = _m("AA", 2, "class:RHYME")
    R = Reviser()
    pf = R.member_place_field(COUPLET, m, 1, 0)
    want = list(pf.offered) if pf is not None else None
    block = prompt.split("IF EVERY OTHER LINE KEEPS ITS WORDS, L1's end word could be:", 1)
    printed = (block[1].split("\n")[2].strip().split(", ")
               if len(block) == 2 else None)
    check("L1 (no per-line finding) is shown its one-move menu, and the "
          "printed words are exactly `member_place_field`'s — before the "
          "redesign the prompt said `(none offered)`, so this fails there",
          want and printed == want, f"printed={printed} want={want}")
    check("...and L2's own line-question lists are reprinted, citing the "
          "question that was really asked on this draft",
          "L2 ON ITS OWN — as offered in L2's line question (attempt 1, round 1)"
          in prompt and "  OFFERED: tov" in prompt, prompt[:0])

    # (b) the shared function is brief()'s own per-place code.
    m_ab = _m("AABB", 4, "class:RHYME")
    b2 = [b for b in R.brief(AABB, m_ab) if b.line_no == 2][0]
    sk = next(iter(b2.fields_by_slot))
    gi = next(k for k, _ in m_ab.partners(2))
    pf2 = R.member_place_field(AABB, m_ab, 2, gi)
    mine, theirs = pf2, b2.fields_by_slot[sk]
    check("on a line brief() does brief, `member_place_field` returns the "
          "brief's own offer, forbidden head, calls and incumbent",
          (list(mine.offered), list(mine.forbidden), mine.calls, mine.incumbent)
          == (list(theirs.offered), list(theirs.forbidden), theirs.calls,
              theirs.incumbent),
          f"{mine.offered[:5]} vs {theirs.offered[:5]}")

    # (c) the group-first path: no menu, and the prompt says why.
    seen = []
    rd = RV.ReviseDeclaration(max_rounds=1, attempts_per_line=1,
                              backtrack_width=1)
    LP.revise_loop(Reviser(rdecl=rd), list(SILVER),
                   _m("AA", 2, "schema:perfect rhyme"),
                   propose=lambda *a, **k: None,
                   propose_group=lambda gb: seen.append(gb))
    gf = [gb for gb in seen if getattr(gb, "path", "") == "group_first"]
    text = render_group(gf[0]) if gf else ""
    check("PREMISE: SILVER's empty field sends it to tier 2 group-first",
          bool(gf), str([getattr(gb, "path", "?") for gb in seen]))
    check("on the group-first path no one-move menu is computed and the "
          "member's empty menu says why; the pivot's line-question block is "
          "absent",
          bool(gf) and all(a.one_move is None for a in gf[0].anchors)
          and "asked before any line question" in text
          and "ON ITS OWN" not in text
          and "IF EVERY OTHER LINE KEEPS" not in text,
          text[text.find("OPTIONS"):text.find("OPTIONS") + 300])


# ---------------------------------------------------------------------------
# 4. resume from the saved position equals replay (in-process)
# ---------------------------------------------------------------------------

class _Suspend(Exception):
    def __init__(self, key, draft):
        super().__init__(str(key))
        self.key, self.draft = key, draft


def _drive(lines, mand, rd, use_cursor):
    """-> (questions asked, LoopResult, verify calls per call, answers)."""
    from quality.propose import render_line, render_group
    answers, asked, per_call = {}, [], []
    cursor = None
    real_verify = RV.Reviser.verify
    count = [0]

    def counting(self, *a, **k):
        count[0] += 1
        return real_verify(self, *a, **k)
    RV.Reviser.verify = counting
    try:
        for _call in range(400):
            live = {}
            count[0] = 0

            def propose(brief, cur, attempt, reasons=None, whole=()):
                k = ("L", brief.line_no, attempt, brief.round_no)
                if k in answers:
                    return answers[k]
                asked.append((k, render_line(brief, cur, whole=whole,
                                             attempt=attempt, reasons=reasons)))
                raise _Suspend(k, (brief, list(cur)))

            def propose_group(gb):
                text = render_group(gb)
                k = ("G", tuple(gb.members), gb.attempt,
                     getattr(gb.brief, "round_no", None), text)
                if k in answers:
                    return answers[k]
                asked.append((k[:4], text))
                raise _Suspend(k, (gb, list(gb.lines)))
            if use_cursor:
                propose.position = lambda d: live.update(ref=d)
            try:
                res = LP.revise_loop(Reviser(rdecl=rd), list(lines), mand,
                                     propose=propose,
                                     propose_group=propose_group,
                                     resume=cursor if use_cursor else None)
                per_call.append(count[0])
                return asked, res, per_call, answers
            except _Suspend as e:
                per_call.append(count[0])
                if use_cursor:
                    cursor = copy.deepcopy(live["ref"])
                obj, cur = e.draft
                if e.key[0] == "L":
                    words = cur[obj.line_no - 1].split()
                    cands = list(getattr(obj, "candidates", ()) or ())
                    if cands and e.key[2] == 0:
                        words[-1] = cands[0]
                    else:
                        words = (words[1:] if words[0] == "and" else
                                 ["and"] + words)
                    answers[e.key] = " ".join(words)
                else:
                    answers[e.key] = tuple(cur[n - 1] for n in obj.members)
        raise AssertionError("the conversation did not end in 400 calls")
    finally:
        RV.Reviser.verify = real_verify


def test_resume_equals_replay():
    print("\n4. resume from the saved position equals replay (§2.0, T1, T2)")
    cases = (("AABB", AABB, _m("AABB", 4, "class:RHYME"), 1, 1),
             ("COUPLET", COUPLET, _m("AA", 2, "class:RHYME"), 1, 1),
             ("ANAPHORA", ANAPHORA, _m("AABBCCDD", 8, "class:RHYME"), 2, 0),
             ("LIVE", LIVE, _m(LIVE_GROUPS, 4, "class:RHYME"), 1, 1))
    for name, lines, mand, att, back in cases:
        rd = RV.ReviseDeclaration(max_rounds=3, attempts_per_line=att,
                                  backtrack_width=back)
        try:
            a_rep, r_rep, v_rep, ans = _drive(lines, mand, rd, False)
            a_cur, r_cur, v_cur, _ = _drive(lines, mand, rd, True)
        except TypeError as e:          # the old revise_loop has no `resume`
            check(f"{name}: revise_loop resumes from a saved position", False,
                  str(e))
            continue

        def summary(r):
            return (list(r.lines), r.stop_reason,
                    [(x.round_no, [(a.line_no, a.tier, a.accepted, a.reason)
                                   for a in x.attempts],
                      x.fixed_lines, x.resolved_elsewhere) for x in r.rounds])
        check(f"{name}: resuming from the saved position asks exactly the "
              f"questions replay asks, byte for byte ({len(a_rep)} questions)",
              a_rep == a_cur and len(a_rep) >= 2,
              f"replay {len(a_rep)} vs cursor {len(a_cur)}")
        check(f"{name}: ...and reaches the same draft, stop and round history",
              summary(r_rep) == summary(r_cur),
              f"{summary(r_rep)[1]} vs {summary(r_cur)[1]}")
        check(f"{name}: T2 — resuming verifies each answer once ({sum(v_cur)} "
              f"verifies for {len(ans)} answers), where replay re-verified "
              f"({sum(v_rep)})",
              sum(v_cur) <= len(ans) and sum(v_rep) > sum(v_cur),
              f"cursor per call {v_cur}; replay per call {v_rep}")


# ---------------------------------------------------------------------------
# 5. resume equals replay through the real verb, and the cursor is bound
# ---------------------------------------------------------------------------

def _run_record(stdout):
    """-> the harness's own `lyric result` record (unpublished markers)."""
    for line in reversed(stdout.splitlines()):
        if "lyric result:" in line:
            return json.loads(line.split("lyric result:", 1)[1])
    return {}


def _converse(lines, scheme, flags, strip_cursor, calls=8):
    """Drive one deferred conversation with mechanical answers. ->
    (per-call [(prompt, outcomes, dispositions, stale, disclosure)],
    per-call run records)."""
    run = _Deferred(lines, scheme, *flags)
    seen, records = [], []
    answer = None
    for _ in range(calls):
        if strip_cursor and os.path.exists(run.state):
            st = run.read()
            st.pop("cursor", None)
            with open(run.state, "w") as fh:
                json.dump(st, fh)
        if answer is not None:
            st = run.read()
            st["pending"]["answer"] = answer
            with open(run.state, "w") as fh:
                json.dump(st, fh)
        p = subprocess.run(run.cmd, cwd=ROOT, capture_output=True, text=True,
                           timeout=1800)
        rec = _run_record(p.stdout)
        records.append(rec)
        st = run.read()
        disclosure = [ln for ln in p.stdout.splitlines()
                      if "PROPOSER: defer:" in ln]
        pend = st.get("pending") or {}
        seen.append((pend.get("prompt"),
                     [(o["line"], o["round"], o["accepted"], o["reasons"])
                      for o in st.get("outcomes", ())],
                     st.get("dispositions"), rec.get("stale_answers"),
                     [d.split(" — ", 1)[1] for d in disclosure]))
        if p.returncode != 4 or not pend:
            break
        kind, asked = run.asked()
        cur = st["accepted_lines"]
        if kind == "propose":
            answer = " ".join(cur[asked[0] - 1].split()[::-1])
        else:
            answer = "\n".join(f"L{n}: " + (" ".join(cur[n - 1].split()[1:])
                                             if cur[n - 1].startswith("and ")
                                             else cur[n - 1]) for n in asked)
    return seen, records, run


def test_resume_through_the_verb():
    print("\n5. resume equals replay through the real verb (§2.0, T1, T2, T7)")
    flags = ("--relation=class:RHYME", "--attempts=1", "--backtrack=1")
    for name, lines, scheme in (("AABB", AABB, "AABB"),
                                ("ANAPHORA", ANAPHORA, "AABBCCDD")):
        cur_seen, cur_rec, _ = _converse(lines, scheme, flags, False)
        rep_seen, rep_rec, _ = _converse(lines, scheme, flags, True)
        check(f"{name}: every question, outcome, disposition, stale count and "
              f"disclosure line is the same resuming and replaying "
              f"({len(cur_seen)} calls)",
              cur_seen == rep_seen and len(cur_seen) >= 3,
              next((f"call {i}" for i, (a, b) in enumerate(zip(cur_seen, rep_seen))
                    if a != b), f"{len(cur_seen)} vs {len(rep_seen)} calls"))
        check(f"{name}: the resuming arm re-verified nothing on any call "
              f"(`replayed_answers` 0, resumed from the cursor after the "
              f"first) — the run record has no such field before the "
              f"redesign, so this fails there",
              all(r.get("replayed_answers") == 0 for r in cur_rec)
              and all(r.get("cursor_resumed") is True for r in cur_rec[1:]),
              str([(r.get("replayed_answers"), r.get("cursor_resumed"))
                   for r in cur_rec]))
        check(f"{name}: POSITIVE CONTROL — the replay arm did replay "
              f"(`replayed_answers` > 0 on some call, `cursor_stripped` "
              f"'missing')",
              any((r.get("replayed_answers") or 0) > 0 for r in rep_rec)
              and all(r.get("cursor_stripped") == "missing" for r in rep_rec[1:]),
              str([(r.get("replayed_answers"), r.get("cursor_stripped"))
                   for r in rep_rec]))

    # (b) T7 on the CLI. Each case answers the pending question, because a
    # call that only re-reads an unanswered question never reaches the loop.
    def answer_pending(run):
        st = run.read()
        kind, asked = run.asked()
        cur = st["accepted_lines"]
        st["pending"]["answer"] = (
            " ".join(cur[asked[0] - 1].split()[::-1]) if kind == "propose"
            else "\n".join(f"L{n}: {cur[n - 1]}" for n in asked))
        return st
    _, _, run = _converse(AABB, "AABB", flags, False, calls=2)
    st = answer_pending(run)
    st["answered"]["propose"][0]["text"] = "an edited earlier answer"
    with open(run.state, "w") as fh:
        json.dump(st, fh)
    p = subprocess.run(run.cmd, cwd=ROOT, capture_output=True, text=True,
                       timeout=1800)
    rec = _run_record(p.stdout)
    check("T7: an edited earlier answer drops the cursor — the run replays "
          "and says `cursor_stripped: digest`",
          rec.get("cursor_stripped") == "digest"
          and rec.get("cursor_resumed") is False, str(rec)[:300])
    _, _, run = _converse(AABB, "AABB", flags, False, calls=2)
    st = answer_pending(run)          # read before the file is reopened for writing
    with open(run.state, "w") as fh:
        json.dump(st, fh)
    other = list(run.cmd)
    other[other.index("--attempts=1")] = "--attempts=2"
    p = subprocess.run(other, cwd=ROOT, capture_output=True, text=True,
                       timeout=1800)
    rec = _run_record(p.stdout)
    check("T7: the same state under another argv drops the cursor — "
          "`cursor_stripped: run_key`",
          rec.get("cursor_stripped") == "run_key"
          and rec.get("cursor_resumed") is False, str(rec)[:300])


# ---------------------------------------------------------------------------
# 6-7. Safe-point stops and kills, with the real deferred proposer in-process
# ---------------------------------------------------------------------------

class _Kill(Exception):
    """A simulated kill: the call dies before the step, and only what it has
    already printed survives (the connector keeps its last checkpoint)."""


class _StopAt(LP.Deadline):
    """Stops (or kills) before the k-th costly step of ONE call. A position,
    never a time: the tests assert where a run stopped, not how long it
    took (§2.3b, B11). With k None it never stops and only logs the steps."""

    def __init__(self, k=None, kill=False):
        super().__init__(None)
        self.k, self.kill, self.n, self.steps = k, kill, 0, []

    def should_stop(self):
        self.n += 1
        if self.k is not None and self.n == self.k:
            if self.kill:
                raise _Kill(self.n)
            return True
        return False

    def step(self, name, fn, *a, **kw):
        self.steps.append(name)
        return super().step(name, fn, *a, **kw)


def _position(st):
    """The connector's `positionOf`, read off a state (§2.8 E)."""
    loop = (st.get("cursor") or {}).get("loop") or {}
    pend = st.get("pending")
    return json.dumps([loop.get("phase"), loop.get("round"), loop.get("at"),
                       len(loop.get("menus") or ()),
                       len(st.get("outcomes") or ()),
                       len(st.get("group_outcomes") or ()),
                       len(st.get("dispositions") or ()),
                       None if not pend else {"kind": pend.get("kind"),
                                              "record": pend.get("record")}],
                      sort_keys=True)


def _inproc(lines, mand, rd, plan=None, strip=(), calls=200):
    """Drive a deferred conversation in-process with the real `defer:`
    proposer, the way the verb and the connector do: one proposer per call,
    bound to the run, the state file written on a question or a stop, and on
    a kill only the last printed checkpoint kept. `plan` maps a call index to
    (k, kill); `strip` names the calls whose saved position is deleted first.
    -> list of per-call dicts."""
    import contextlib
    import io
    import lyric_harness as LH
    plan = plan or {}
    d = tempfile.mkdtemp(prefix="loop-redesign-inproc-")
    path = os.path.join(d, "state.json")

    def read():
        with open(path) as fh:
            return json.load(fh)

    def write(st):
        with open(path, "w") as fh:
            json.dump(st, fh, indent=2)
    out = []
    for call in range(calls):
        if call in strip and os.path.exists(path):
            st = read()
            st.pop("cursor", None)
            write(st)
        before = read() if os.path.exists(path) else None
        k, kill = plan.get(call, (None, False))
        dl = _StopAt(k, kill)
        buf = io.StringIO()
        rec = {"call": call, "steps": dl.steps, "before": before}
        with contextlib.redirect_stdout(buf):
            propose, propose_group, disc = LH._defer_proposer(
                path, lines=list(lines))
            resume = disc.bind("t45-run", "t45-scorer")
            disc.set_deadline(dl)
            try:
                res = LP.revise_loop(Reviser(rdecl=rd), list(lines), mand,
                                     propose=propose,
                                     propose_group=propose_group,
                                     resume=resume, deadline=dl)
                rec.update(kind="done", result=res)
            except LH._NeedProposal as need:
                write(disc.state)
                rec.update(kind="asked", prompt=need.prompt)
            except LP.SafePointStop as stop:
                disc.stopped(stop.step)
                write(disc.state)
                rec.update(kind="stopped", step=stop.step)
            except _Kill:
                cps = [json.loads(ln.split("lyric checkpoint:", 1)[1])
                       for ln in buf.getvalue().splitlines()
                       if "lyric checkpoint:" in ln]
                if cps:
                    st = cps[-1]
                    st.pop("transport_token", None)
                    write(st)
                rec.update(kind="killed", checkpoints=len(cps))
        rec["record"] = disc.record()
        rec["after"] = read() if os.path.exists(path) else None
        out.append(rec)
        if rec["kind"] == "done":
            return out
        if rec["kind"] == "asked":
            st = read()
            pend = st["pending"]
            cur = st["accepted_lines"]
            r = pend["record"]
            if pend["kind"] == "propose":
                pend["answer"] = " ".join(cur[r["line"] - 1].split()[::-1])
            else:
                asked = ([x["line"] for x in r["records"]]
                         if pend["kind"] == "propose_batch" else r["members"])
                pend["answer"] = "\n".join(
                    f"L{n}: " + (" ".join(cur[n - 1].split()[1:])
                                 if cur[n - 1].startswith("and ")
                                 else "and " + cur[n - 1]) for n in asked)
            write(st)
    raise AssertionError(f"the conversation did not end in {calls} calls")


def _summary(r):
    return (list(r.lines), r.stop_reason,
            [(x.round_no, [(a.line_no, a.tier, a.accepted, a.reason)
                           for a in x.attempts],
              x.fixed_lines, x.resolved_elsewhere) for x in r.rounds])


def _prompts(run):
    return [c["prompt"] for c in run if c["kind"] == "asked"]


def _first_between(run, name):
    """-> (call, k) of the first step `name` whose previous step in the same
    call, leaving out a menu's own `place` steps, was also `name` — a stop
    between two members' menus — or None."""
    for c in run:
        prev = None
        for i, step in enumerate(c["steps"]):
            if step == "place":          # a menu's own places (option B)
                continue
            if step == name and prev == name:
                return c["call"], i + 1
            prev = step
    return None


def _first(run, name, skip_calls=0):
    for c in run[skip_calls:]:
        if name in c["steps"]:
            return c["call"], c["steps"].index(name) + 1
    return None


def test_safe_point_stops():
    print("\n6. a call that nears its deadline stops at a safe point and the "
          "next call finishes the same run (§2.3b, §2.8 E; T4)")
    cases = (("ANAPHORA batch", ANAPHORA, _m("AABBCCDD", 8, "class:RHYME"),
              RV.ReviseDeclaration(max_rounds=2, attempts_per_line=1,
                                   backtrack_width=0), "menu"),
             ("COUPLET group", COUPLET, _m("AA", 2, "class:RHYME"),
              RV.ReviseDeclaration(max_rounds=2, attempts_per_line=1,
                                   backtrack_width=1), "member menu"),
             ("LIVE group", LIVE, _m(LIVE_GROUPS, 4, "class:RHYME"),
              RV.ReviseDeclaration(max_rounds=2, attempts_per_line=1,
                                   backtrack_width=1), "member menu"))
    for name, lines, mand, rd, between in cases:
        try:
            base = _inproc(lines, mand, rd)
        except TypeError as e:          # no `deadline` before the redesign
            check(f"{name}: revise_loop takes a deadline", False, str(e))
            continue
        want = (_prompts(base), _summary(base[-1]["result"]))
        stops = [("before the call's first grade", (1, 1))]
        for label, where in (("between two members' menus",
                              _first_between(base, between)),
                             ("between an answer and its verdict",
                              _first(base, "verdict", skip_calls=1)),
                             ("before a menu", _first(base, "menu"))):
            if where is not None:
                stops.append((label, where))
        if between == "menu":
            check(f"{name}: the uninterrupted run builds a batch's menus "
                  f"member by member ('menu' twice in a row), so a stop "
                  f"between them can be placed",
                  _first_between(base, between) is not None,
                  str([c["steps"] for c in base])[:400])
        for label, (call, k) in stops:
            run = _inproc(lines, mand, rd, plan={call: (k, False)})
            got = (_prompts(run), _summary(run[-1]["result"]))
            st = next((c for c in run if c["kind"] == "stopped"), None)
            check(f"{name}: a stop {label} (call {call}, step {k}) exits "
                  f"stopped, and the stopped state holds a saved position",
                  st is not None and bool((st["after"] or {}).get("cursor")),
                  str([c["kind"] for c in run]))
            if st is None:
                continue
            nxt = run[run.index(st) + 1]
            check(f"{name}: ...the next call, with no answer, resumes from "
                  f"it and re-verifies nothing",
                  nxt["record"].get("cursor_resumed") is True
                  and nxt["record"].get("replayed_answers") == 0,
                  str(nxt["record"]))
            check(f"{name}: ...and every question is byte-identical to the "
                  f"uninterrupted run's, with the same draft, stop and "
                  f"rounds ({len(want[0])} questions)",
                  got == want,
                  f"{len(got[0])} vs {len(want[0])} questions; "
                  f"{got[1][1]} vs {want[1][1]}")
            if label == "between two members' menus":
                built = len(((st["after"].get("cursor") or {}).get("loop")
                             or {}).get("menus") or ())
                check(f"{name}: ...the stopped state keeps the menu already "
                      f"built for the first member ({built} saved)",
                      built >= 1)


def test_group_menus_resume_member_by_member():
    """§2.8 E (S11), at the mechanism: a group question's one-move menus are
    built through the loop's own reviser proxy, one costly step per member,
    and saved by draft. A stop before the second member's menu keeps the
    first; a fresh proxy that loads the saved menus builds only the second,
    and both equal the uninterrupted ones. None of this fixture's whole runs
    asks a group question whose members both need a menu, so it is driven
    here directly."""
    lines, mand = LIVE, _m(LIVE_GROUPS, 4, "class:RHYME")
    R = Reviser()
    want = [R.member_place_field(list(lines), mand, ln, gi)
            for ln, gi in ((1, 0), (3, 2))]
    live = {}
    first = LP._VerdictCache(R, {}, live, deadline=_StopAt(2))
    got1 = first.member_place_field(list(lines), mand, 1, 0)
    try:
        first.member_place_field(list(lines), mand, 3, 2)
        stopped = False
    except LP.SafePointStop as stop:
        stopped = stop.step == "member menu"
    saved = json.loads(json.dumps(first.menus_on(lines)))
    check("a stop falls before the second member's menu, and the first "
          "member's menu is saved", stopped and len(saved) == 1,
          f"stopped {stopped}, saved {len(saved)}")
    built = []
    second = LP._VerdictCache(R, {}, {}, deadline=_StopAt(None))
    second.load_menus(saved)
    got = [second.member_place_field(list(lines), mand, ln, gi)
           for ln, gi in ((1, 0), (3, 2))]
    built = second._deadline.steps
    check("...the next call builds only the missing menu (one costly step)",
          built == ["member menu"], str(built))
    check("...and both menus equal the uninterrupted ones, field for field",
          got1 == want[0] and got == want, "menus differ")


#: A line that binds at TWO places (its second word and its end), so its
#: menu is built place by place. MEASURED 2026-10-03: `brief(target_lines=
#: {1})` gives L1 the places `1.T2` (0 words offered) and its end (24).
TWO_PLACES = ["the silver river ran beneath the stove",
              "and every lantern burned the month",
              "the winter came and took the yard"]
TWO_PLACES_GROUPS = [["1.T2", 2], [1, 3]]


def test_menus_resume_place_by_place():
    """Option B (owner ruling 2026-10-03): a stop may fall between two places
    of ONE line's menu. The first place is saved; the next call builds only
    the second; the finished menu, and the question rendered from it, are
    exactly the uninterrupted ones. Before option B a menu was one step, so
    no stop could fall inside it and nothing of it was saved."""
    from quality.propose import render_line
    print("\n9. a menu is saved place by place, and a stop between two "
          "places loses nothing (§2.3b; owner ruling 2026-10-03, option B)")
    lines, mand = TWO_PLACES, _m(TWO_PLACES_GROUPS, 3, "class:RHYME")
    want = Reviser().brief(list(lines), mand, target_lines={1})
    first = LP._VerdictCache(Reviser(), {}, {}, deadline=_StopAt(3))
    try:
        first.brief(list(lines), mand, target_lines={1})
        stopped = None
    except LP.SafePointStop as stop:
        stopped = stop.step
    saved = json.loads(json.dumps(first.menus_on(lines)))
    check("the stop falls between the line's two places, and the first "
          "place is saved", stopped == "place" and len(saved) == 1
          and "'place'" in saved[0][0], f"stopped {stopped}, saved "
          f"{[k for k, _ in saved]}")
    second = LP._VerdictCache(Reviser(), {}, {}, deadline=_StopAt(None))
    second.load_menus(saved)
    got = second.brief(list(lines), mand, target_lines={1})
    check("...the next call builds only the missing place (steps: the menu, "
          "then one place)", second._deadline.steps == ["menu", "place"],
          str(second._deadline.steps))
    check("...and the finished menu equals the uninterrupted one, field for "
          "field", got == want)
    check("...and so does the question rendered from it, byte for byte",
          render_line(got[0], list(lines)) == render_line(want[0], list(lines)))
    rows = second.menus_on(lines)
    check("...and once the whole menu is saved, its places are not saved a "
          "second time", len(rows) == 1 and "'brief'" in rows[0][0],
          str([k for k, _ in rows]))
    # A KILL between the two places, through the real deferred proposer: the
    # first place was checkpointed when it was saved, so the next call builds
    # only the second. Before each save printed a checkpoint, the kill kept
    # the last unit-start checkpoint and the next call rebuilt both.
    rd = RV.ReviseDeclaration(max_rounds=1, attempts_per_line=1,
                              backtrack_width=1)
    base = _inproc(lines, mand, rd, calls=12)
    at = next(((c["call"], i + 1) for c in base
               for i in range(1, len(c["steps"]))
               if c["steps"][i] == "place" and c["steps"][i - 1] == "place"),
              None)
    check("PREMISE: the run builds this line's menu as two places in a row",
          at is not None, str([c["steps"] for c in base]))
    if at is not None:
        run = _inproc(lines, mand, rd, plan={at[0]: (at[1], True)}, calls=12)
        killed, nxt = run[at[0]], run[at[0] + 1]
        kept = [k for k, _ in ((killed["after"] or {}).get("cursor", {})
                               .get("loop", {}).get("menus") or ())]
        check("a call killed between the two places keeps the first place "
              "in its last checkpoint", killed["kind"] == "killed"
              and any("'place'" in k for k in kept), str(kept))
        check("...and the next call builds only the second place",
              nxt["steps"].count("place") == 1, str(nxt["steps"]))
        check("...and the run asks the same questions as without the kill",
              _prompts(run) == _prompts(base))


def test_kills_keep_the_run():
    print("\n7. a killed call keeps the run; repeated kills at one position "
          "are reported, never refused (§2.3c-d, §2.8 E; T5)")
    lines, mand = AABB, _m("AABB", 4, "class:RHYME")
    rd = RV.ReviseDeclaration(max_rounds=3, attempts_per_line=1,
                              backtrack_width=1)
    try:
        base = _inproc(lines, mand, rd)
    except TypeError as e:
        check("revise_loop takes a deadline", False, str(e))
        return
    want = (_prompts(base), _summary(base[-1]["result"]))
    # (a) a kill between an answer and its verdict, then a no-answer call
    where = _first(base, "verdict", skip_calls=1)
    call, k = where
    run = _inproc(lines, mand, rd, plan={call: (k, True)})
    killed = run[call]
    nxt = run[call + 1]
    check("a call killed before judging an answer leaves a checkpoint with a "
          "saved position", killed["kind"] == "killed"
          and bool((killed["after"] or {}).get("cursor")),
          str(killed["kind"]))
    check("...the next call resumes from it and re-verifies nothing (T2's "
          "count)", nxt["record"].get("cursor_resumed") is True
          and nxt["record"].get("replayed_answers") == 0, str(nxt["record"]))
    check("...and the run asks the same questions and ends the same way",
          (_prompts(run), _summary(run[-1]["result"])) == want)
    # (b) a full replay killed partway keeps the furthest draft (B5)
    call2 = max(c["call"] for c in base if c["kind"] == "asked")
    replay_steps = len(base[call2]["steps"])
    run = _inproc(lines, mand, rd, plan={call2: (max(2, replay_steps // 2), True)},
                  strip={call2})
    killed = run[call2]
    inc = (killed["before"] or {}).get("accepted_lines")
    check("a full replay killed partway keeps the incoming accepted lines "
          "(never a draft from behind the frontier) and a saved position",
          killed["kind"] == "killed"
          and (killed["after"] or {}).get("accepted_lines") == inc
          and bool((killed["after"] or {}).get("cursor")),
          f"{killed['kind']}; {(killed['after'] or {}).get('accepted_lines')} "
          f"vs {inc}")
    check("...and the next call resumes from the replay's position to the "
          "same end", run[call2 + 1]["record"].get("cursor_resumed") is True
          and (_prompts(run), _summary(run[-1]["result"])) == want)
    # (c) three kills at the same step leave the same position three times —
    # what the connector counts as `no_progress_calls` — and a fourth call
    # with time to spare still finishes the run: nothing is refused.
    call3 = 1
    run = _inproc(lines, mand, rd,
                  plan={call3: (1, True), call3 + 1: (1, True),
                        call3 + 2: (1, True)})
    pos = [_position(run[c]["after"]) for c in (call3, call3 + 1, call3 + 2)]
    check("three calls killed before their first grade end at one position "
          "(the connector reports `no_progress_calls`)",
          all(run[c]["kind"] == "killed" for c in (call3, call3 + 1, call3 + 2))
          and len(set(pos)) == 1, str(pos)[:300])
    check("...and the next call, with time, advances and finishes the same "
          "run", _position(run[call3 + 3]["after"]) != pos[0]
          and (_prompts(run), _summary(run[-1]["result"])) == want)


if __name__ == "__main__":
    # Dealt and timed through `quality/shard.py`, the one idiom (M-244):
    # TEST_LOOP_REDESIGN_SHARD=k/n runs the sections whose index is k-1 mod n.
    from quality.shard import run_sections
    _SECTIONS = (test_verify_reads_no_offer,
                 test_every_batch_answer_has_a_standing,
                 test_group_questions_offer_words,
                 test_resume_equals_replay,
                 test_resume_through_the_verb,
                 test_safe_point_stops,
                 test_kills_keep_the_run,
                 test_group_menus_resume_member_by_member,
                 test_menus_resume_place_by_place)
    sys.exit(run_sections(_SECTIONS, "TEST_LOOP_REDESIGN_SHARD", FAILS,
                          "ALL PASS"))
