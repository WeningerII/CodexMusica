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
"""

import os
import sys

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


if __name__ == "__main__":
    # Dealt and timed through `quality/shard.py`, the one idiom (M-244):
    # TEST_LOOP_REDESIGN_SHARD=k/n runs the sections whose index is k-1 mod n.
    from quality.shard import run_sections
    _SECTIONS = (test_verify_reads_no_offer,)
    sys.exit(run_sections(_SECTIONS, "TEST_LOOP_REDESIGN_SHARD", FAILS,
                          "ALL PASS"))
