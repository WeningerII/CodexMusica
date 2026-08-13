#!/usr/bin/env python3
"""Regressions for the null constructors in `quality/controls.py` (§1-4) and
for the coverage machinery in `quality/relations_null.py` (§5-8).

Every check here is a defect that was FOUND in this code, not a property
somebody thought would be nice to have.

  1. DOCTRINE 66. `rime_pool_redeal` built its candidate lists by iterating
     `set(words)`. Python randomises str hashing per interpreter, so the same
     seed printed `band_pass` 0.4187 on one run and 0.4099 on the next. The
     guard runs the constructor in two SUBPROCESSES with different
     PYTHONHASHSEED, because that is the only place the defect is visible --
     it cannot reproduce inside one interpreter.
  2. THE PRESERVATION CLAIM. `cross_item_redeal` says it preserves the line
     count, the words per line and each word's stress shape. That claim is
     what makes the geometry comparison legitimate, so it is asserted rather
     than documented.
  3. THE IDENTITY-MAP CHECKER. `differs` has to return 0 on a randomisation
     that cannot move, which is the whole point of it existing.
  4. THE DETECTION FLOOR HAS TO MOVE. If `rime_pool_redeal` stops separating
     mono from dispersed, `RESULTS_NULL_SHAPES.md` §3.3 has lost the arms that
     make its null readable, and doctrine 76 says a null without a detection
     floor is an unfalsifiable claim wearing a number.

§5-8 are the relations layer, added when `relations_null.py` grew a census
and a whole-registry sweep. THREE of the 77 schemas in `relations.REGISTRY`
had a hand-written arm; 74 shipped a printed instance count with no matched
control, and the census exists to say WHICH OF FIVE REASONS applies to each,
because they have five different remedies (doctrine 44).

  5. THE GUARDS MUST NOT DISQUALIFY THE ARMS THE FILE ALREADY REPORTS.
     `statistic_degeneracy` drops a statistic that is constant by
     construction (doctrine 20). If it dropped `internal rhyme ·
     local_fraction@0`, `perfect rhyme · local_fraction@2` or `Kalevala ·
     line_fraction`, it would have deleted this file's own recorded table
     while looking like a tightening.
  6. THE DERIVATION IS NOT THE AUTHORITY (doctrine 68). `null_menu` derives
     `perfect rhyme · count · line_final_permutation` to be an identity map;
     the recorded table measured 89.5% of replicates differing on exactly
     that pair. So the SWEEP must run it anyway, and this asserts the plan
     does.
  7. THE SECOND RUNNER MUST AGREE WITH THE FIRST. `sweep` shares replicates
     across schemas where `run_many` does not; on the same schema, statistic,
     null, seed and slice the two must return the identical observation and
     the identical replicate values, or one of them is wrong and nothing says
     which. `keep` is asserted not to be a coordinate of any number here for
     the same reason.
  8. `NEVER_PROVIDED` HAS TO STAY FALSE. Three capabilities have no branch in
     `Stream.provides` at all, so three schemas can never produce an
     observation on any text. The day one is implemented that is a
     capability, not a comment, and this fails until the table is updated
     (doctrine 48).

None of these touches the time layer, so the file runs in seconds.

Run: python3 quality/test_null_shapes.py
"""

import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

from lyric_harness import Lexicon, line_tokens, word_syllable_map  # noqa: E402
from quality.controls import (cross_item_redeal, differs,          # noqa: E402
                              rime_pool_redeal)
import quality.relations as R                                      # noqa: E402
import quality.relations_null as N                                 # noqa: E402

LEX = Lexicon()
PASS, FAIL = [], []


def check(name, ok, note=""):
    (PASS if ok else FAIL).append(name)
    print("  %s  %s" % ("PASS" if ok else "FAIL", name))
    if note:
        print("          %s" % note)


def shape(w):
    return tuple(s["stress"] for s in word_syllable_map(LEX, w))


def rime(w):
    sy = word_syllable_map(LEX, w)
    return None if not sy else (sy[-1]["nucleus"], tuple(sy[-1]["coda"]))


#: Four tiny items with different vocabularies, so a leave-one-out pool is
#: genuinely a different pool for each. Constructed, and that is admissible
#: here because these are claims about the FUNCTION, not about English verse.
ITEMS = [
    ["the winter froze the harbor", "a merchant sold his cargo"],
    ["she wrote a letter slowly", "the engine made a rattle"],
    ["a hollow yellow meadow", "the mellow fellow waited"],
    ["they carried heavy timber", "the ferry crossed at midnight"],
]

_SUBPROC = r"""
import sys
sys.path.insert(0, %r)
from lyric_harness import Lexicon, line_tokens, word_syllable_map
from quality.controls import rime_pool_redeal, cross_item_redeal
LEX = Lexicon()
shape = lambda w: tuple(s["stress"] for s in word_syllable_map(LEX, w))
def rime(w):
    sy = word_syllable_map(LEX, w)
    return None if not sy else (sy[-1]["nucleus"], tuple(sy[-1]["coda"]))
ITEMS = %r
a = rime_pool_redeal(ITEMS, line_tokens, shape, rime, "mono", 7)
b = rime_pool_redeal(ITEMS, line_tokens, shape, rime, "dispersed", 7)
c, _ = cross_item_redeal(ITEMS, line_tokens, shape, seed=7)
print(repr((a, b, c)))
"""


def run_under(hashseed):
    env = dict(os.environ, PYTHONHASHSEED=str(hashseed))
    out = subprocess.run([sys.executable, "-c", _SUBPROC % (ROOT, ITEMS)],
                         capture_output=True, text=True, env=env, cwd=ROOT)
    if out.returncode:
        raise RuntimeError(out.stderr[-2000:])
    return out.stdout.strip()


def main():
    print("=" * 62)
    print("NULL-SHAPE REGRESSIONS — quality/controls.py")
    print("=" * 62)

    print("\n1. DOCTRINE 66 — the same seed under two PYTHONHASHSEEDs")
    a, b = run_under(0), run_under(12345)
    check("both redeals reproduce across interpreter runs", a == b,
          "a set-iteration tie here printed two different band_pass values "
          "for one seed")

    print("\n2. THE PRESERVATION CLAIM — cross_item_redeal")
    red, stats = cross_item_redeal(ITEMS, line_tokens, shape, seed=7)
    check("line count preserved per item",
          [len(x) for x in red] == [len(x) for x in ITEMS])
    check("words per line preserved",
          all(len(line_tokens(p)) == len(line_tokens(q))
              for it, jt in zip(red, ITEMS) for p, q in zip(it, jt)))
    same_shape = all(shape(p) == shape(q)
                     for it, jt in zip(red, ITEMS)
                     for lp, lq in zip(it, jt)
                     for p, q in zip(line_tokens(lp), line_tokens(lq)))
    check("every word keeps its stress shape (so the grid is identical)",
          same_shape,
          "exact %d, count-only %d, kept %d"
          % (stats["exact"], stats["count_only"], stats["kept"]))
    # LEAVE-ONE-OUT, ASSERTED RATHER THAN ASSUMED. Disjointness is the wrong
    # test -- `the` is in every item and may legitimately come back. The real
    # invariant is that a word occurring ONLY in item i can never appear in
    # item i's redeal, because item i's own counts are subtracted from the
    # pool. That is doctrine 13 in one assertion.
    def words_of(it):
        return [w for l in it for w in line_tokens(l)]

    leaks = []
    for i, it in enumerate(ITEMS):
        elsewhere = {w for j, o in enumerate(ITEMS) if j != i
                     for w in words_of(o)}
        private = set(words_of(it)) - elsewhere
        leaks += [w for w in words_of(red[i]) if w in private]
    check("a word unique to an item never returns to it (doctrine 13)",
          not leaks,
          "%d private word types across the four items; leaks %d"
          % (sum(len(set(words_of(it)) -
                     {w for j, o in enumerate(ITEMS) if j != i
                      for w in words_of(o)})
                 for i, it in enumerate(ITEMS)), len(leaks)))

    print("\n3. THE IDENTITY-MAP CHECKER — differs")
    n, m = differs([3, 1, 2], [[1, 2, 3], [2, 3, 1], [3, 2, 1]], key=sum)
    check("a symmetric statistic reports 0 differing replicates",
          n == 0 and m == 3, "sum() is invariant under permutation")
    n2, _ = differs([3, 1, 2], [[9, 1, 2], [3, 1, 2]], key=sum)
    check("a statistic that moves is counted", n2 == 1)

    print("\n4. THE DETECTION FLOOR HAS TO MOVE (doctrine 76)")
    mono = rime_pool_redeal(ITEMS, line_tokens, shape, rime, "mono", 7)
    disp = rime_pool_redeal(ITEMS, line_tokens, shape, rime, "dispersed", 7)

    def classes(arm):
        return sum(len({rime(w) for l in it for w in line_tokens(l)})
                   for it in arm)

    cm, cd = classes(mono), classes(disp)
    check("mono collapses rime classes below dispersed", cm < cd,
          "distinct rime classes summed over items: mono %d, dispersed %d"
          % (cm, cd))
    check("the floor arms are not each other", mono != disp)

    relations_sections()

    print("\n" + "=" * 62)
    if FAIL:
        print("FAILED: %s" % ", ".join(FAIL))
        return 1
    print("%d checks pass — the constructors reproduce and the floor moves"
          % len(PASS))
    return 0


# ---------------------------------------------------------------------------
# §5-8  quality/relations_null.py — the census, the sweep, the planted floor
# ---------------------------------------------------------------------------

#: An ABCD ABCD text: every rhyme partner is FOUR lines away. Constructed, and
#: admissible for the same reason ITEMS above is -- these are claims about the
#: FUNCTIONS, not about English verse. The wide gap is the point: it puts the
#: observed `local_fraction@2` on the floor so the planted arm has somewhere to
#: go, which a quatrain would not.
FAR = [
    "the winter froze the shallow lake",
    "a lantern burned across the night",
    "the miller hummed a quiet song",
    "the gutters filled with autumn rain",
    "the carpenter had bread to make",
    "the harbour tower showed a light",
    "the road to market ran too long",
    "the horses waited on the plain",
]

#: The (schema, statistic) pairs `relations_null.ARMS` actually reports. The
#: guard in §5 must pass every one of them: a tightening that disqualifies the
#: results the file already carries is not a tightening.
RECORDED_PAIRS = (
    ("internal rhyme", "count"),
    ("internal rhyme", "local_fraction@0"),
    ("perfect rhyme", "count"),
    ("perfect rhyme", "local_fraction@2"),
    ("Kalevala alliteration (weak)", "line_fraction"),
)


def relations_sections():
    from quality.phonology import get as get_phonology
    phon = get_phonology("eng")
    toks = [R.tokenise(l) for l in FAR]
    stream = N._stream_of(toks, phon, "eng")

    print("\n5. THE CENSUS — a partition, and it must not disqualify the arms")
    cov = N.coverage()
    names = [c.schema for c in cov]
    check("every declared schema is classified exactly once",
          len(names) == len(set(names)) == len(R.REGISTRY),
          "%d schemas declared, %d classified, %d verdicts"
          % (len(R.REGISTRY), len(names), len(set(c.verdict for c in cov))))
    check("the six verdicts partition the registry",
          sum(sum(1 for c in cov if c.verdict == v) for v in N.VERDICTS)
          == len(cov))
    bad = [(s, st) for s, st in RECORDED_PAIRS
           if N.statistic_degeneracy(R.REGISTRY[s], st)]
    check("no recorded ARM pair is dropped as constant-by-construction",
          not bad, "would have deleted: %s" % (bad,))
    # THE CONSTANT CASES ARE MEASURED, NOT ARGUED. `_GAP_FORCED` is a claim
    # about `Placement._raw`, so the claim is checked against `_raw` running on
    # a real stream rather than against a reading of it.
    kal = R.REGISTRY["Kalevala alliteration (weak)"]
    v, _ref = N._measure(stream, kal, [N.STATISTICS["local_fraction@0"]],
                         keep=("true", "none"))
    check("a `same_line` schema really does sit at local_fraction@0 == 1.0",
          v is not None and v[0] == 1.0, "measured %s" % (v,))
    per = R.REGISTRY["perfect rhyme"]
    v2, _r2 = N._measure(stream, per, [N.STATISTICS["local_fraction@0"]],
                         keep=("true", "none"))
    check("a `different_lines` schema really does sit at "
          "local_fraction@0 == 0.0",
          v2 is not None and v2[0] == 0.0, "measured %s" % (v2,))
    check("`line_fraction` is refused on a plain pair figure "
          "(it is `count` rescaled, not a second statistic)",
          bool(N.statistic_degeneracy(per, "line_fraction")))

    print("\n6. THE DERIVATION IS NOT THE AUTHORITY (doctrine 68)")
    menu = N.null_menu(per, "count")
    check("null_menu DERIVES line_final_permutation to be an identity map "
          "for `perfect rhyme · count`",
          "line_final_permutation" not in menu, "derived menu %s" % (menu,))
    # ...and the recorded table measured 89.5% of replicates differing on it,
    # so a sweep that trusted the derivation would drop a real arm.
    _res, _cen = N.sweep(FAR, phon, "eng", n=1, budget=None,
                         schemas={"perfect rhyme": per})
    ran = {(r.statistic, r.null) for r in _res if not isinstance(r, R.Refusal)}
    check("the SWEEP runs it anyway", ("count", "line_final_permutation")
          in ran, "sweep ran %s" % (sorted(ran),))
    check("null_menu reproduces the recorded identity-map row: "
          "line_permutation does not move `internal rhyme · count`",
          "line_permutation" not in
          N.null_menu(R.REGISTRY["internal rhyme"], "count"))
    check("null_menu reproduces the recorded identity-map rows: only "
          "global_redeal moves Kalevala `line_fraction`",
          N.null_menu(kal, "line_fraction") == ("global_redeal",),
          "derived %s; the table records 0%% differing under "
          "within_line_shuffle AND line_permutation"
          % (N.null_menu(kal, "line_fraction"),))

    print("\n7. THE SECOND RUNNER AGREES WITH THE FIRST")
    one = N.run_many(FAR, phon, "perfect rhyme", ["count"],
                     null="global_redeal", n=6, language="eng")[0]
    swept, _c = N.sweep(FAR, phon, "eng", n=6, budget=None,
                        schemas={"perfect rhyme": per})
    mine = [r for r in swept if not isinstance(r, R.Refusal)
            and r.statistic == "count" and r.null == "global_redeal"]
    check("sweep and run_many return the same observation",
          len(mine) == 1 and mine[0].observed == one.observed,
          "run_many %s  sweep %s"
          % (one.observed, mine[0].observed if mine else None))
    check("sweep and run_many draw the SAME replicates (doctrine 66)",
          bool(mine) and mine[0].values == one.values,
          "run_many %s\n          sweep    %s"
          % (one.values, mine[0].values if mine else None))
    a_all, _ = N._measure(stream, per, [N.STATISTICS["count"],
                                        N.STATISTICS["local_fraction@2"]],
                          keep="all")
    a_cheap, _ = N._measure(stream, per, [N.STATISTICS["count"],
                                          N.STATISTICS["local_fraction@2"]],
                            keep=("true", "none"))
    check("`keep` is not a coordinate of any statistic here",
          a_all == a_cheap, "keep='all' %s  keep=('true','none') %s"
          % (a_all, a_cheap))

    print("\n8. NEVER_PROVIDED, and the planted floor (doctrines 44, 31/76)")
    # A stream declaring everything a caller CAN declare. If one of these
    # capabilities ever becomes reachable, this fails and the table in
    # relations_null.py has to be corrected rather than quietly outlived.
    rich = R.build_stream(FAR, phon, declaration={
        "language": "eng",
        "resources": ("lexicon", "sense", "morphology", "token", "lexeme")})
    R.search_caesura(rich)
    R.mark_refrain_tail(rich)
    still = [c for c in N.NEVER_PROVIDED if rich.provides(c)]
    check("no capability in NEVER_PROVIDED is reachable from a maximally "
          "declared stream", not still, "now provided: %s" % (still,))
    check("every NEVER_PROVIDED capability is actually asked for by a schema",
          all(any(c in s.capabilities() for s in R.REGISTRY.values())
              for c in N.NEVER_PROVIDED))

    planted, refusal = N.plant_locality(FAR, phon, per, "eng")
    check("the planted text is a PERMUTATION of the same lines, so it is "
          "inside the line_permutation null's own support",
          refusal is None and planted is not None
          and sorted(map(tuple, planted)) == sorted(map(tuple, toks)))
    obs, _ = N._measure(stream, per, [N.STATISTICS["local_fraction@2"]],
                        keep=("true", "none"))
    floor = N.sensitivity(FAR, phon, per, "local_fraction@2", "eng")
    check("the planted floor MOVES the locality statistic (doctrine 76)",
          not isinstance(floor, R.Refusal) and floor is not None
          and obs is not None and floor > obs[0],
          "observed %s  planted %s — a null on a statistic that cannot move "
          "is not a negative result" % (obs[0] if obs else None, floor))


if __name__ == "__main__":
    sys.exit(main())
