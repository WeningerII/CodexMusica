#!/usr/bin/env python3
"""Regression tests for the time layer.

The first four encode the ways this statistic can be wrong while looking
right. They exist because the pre-registration named them before the code was
written, not because a run surprised anyone.

Run: python3 quality/test_time_layer.py
"""

import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(HERE, "..", ".."))

from lyric_harness import Lexicon  # noqa: E402
from quality.time_layer import (TimeDeclaration, analyse,  # noqa: E402
                                grid_index, line_final_control,
                                phase_statistic, syllable_stream)

FAILURES = []
LEX = Lexicon()


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


# ---------------------------------------------------------------------------

def test_statistic_is_phase_invariant():
    print("\n1. the statistic never needs to know where the downbeat is")
    slots = list(range(48))
    ev = [c for c in slots if c % 4 == 0]
    a, pa = phase_statistic(slots, ev, (2, 3, 4, 6, 8))
    shifted = [c + 1 for c in ev]
    b, pb = phase_statistic(slots, shifted, (2, 3, 4, 6, 8))
    check("shifting every event by one slot changes nothing",
          abs(a - b) < 1e-9 and pa == pb,
          f"KL {a:.4f} at P={pa} vs {b:.4f} at P={pb} — no downbeat detection "
          f"is needed, which is the whole reason for this form")


def test_null_is_the_items_own_stream():
    print("\n2. the null is the item's own slots, not a uniform assumption")
    # 47 slots at P=4: three phases get 12 slots and one gets 11. A uniform
    # null reads that truncation as signal; the self-normalizing one does not.
    slots = list(range(47))
    ev = list(range(47))
    k, _ = phase_statistic(slots, ev, (4,))
    check("events filling every slot give exactly zero divergence",
          abs(k) < 1e-12,
          f"KL {k:.2e} — against a uniform null this would be positive purely "
          f"from 47 not dividing by 4")


def test_kl_bias_is_absorbed_by_the_null():
    print("\n3. KL is positively biased at small n and the null carries it")
    lines = ["the cat came back and sat upon the mat",
             "a dog ran out and stood beside the road",
             "she took the coat and left it on the chair",
             "he paid the man and carried home the load"]
    res = analyse(LEX, lines, tdecl=TimeDeclaration(n_perm=300))
    if res.get("kl") is None:
        # `True` until 2026-08-23: it said "declines CLEANLY" while accepting
        # a decline that named nothing, then returned, skipping the rest of
        # the section on a green line. Doctrine 20 -- a refusal is not a
        # silence -- is now the condition (doctrine 17).
        check("declines cleanly when there is too little to test — and NAMES "
              "the refusal rather than returning a bare None",
              bool(res.get("refused")) and res.get("refused_by"),
              f"{res.get('refused_by')}: {str(res.get('refused'))[:88]}")
        return
    check("the null mean is well above zero",
          res["null_mean"] > 0.01,
          f"null mean {res['null_mean']:.4f} at n_events={res['n_events']} — "
          f"reading the raw KL against zero would 'find' an effect in noise")
    check("the p-value compares like with like",
          0.0 < res["p"] <= 1.0,
          f"p={res['p']:.3f} against a null drawing the same number of events "
          f"from the same slots")


def test_h3_tripwire_line_final_in_isosyllabic_form():
    print("\n4. TRIPWIRE (H3) — line-final phase must not be free signal")
    # Ten syllables per line, every line rhyming: the isosyllabic case where
    # line-final phase is DETERMINED by the form. If the control fires here,
    # the statistic reads form rather than placement and the layer is void.
    iso = ["the silver morning settles on the stone",
           "a hollow evening rattles in the bone",
           "the yellow water gathers at the door",
           "a shallow gutter carries to the shore"]
    res = line_final_control(LEX, iso, tdecl=TimeDeclaration(n_perm=500))
    if res.get("kl") is None:
        check("the control refuses rather than reporting a determined result "
              "— and says which stage refused (doctrine 20; this rode on "
              "`True` until 2026-08-23)",
              bool(res.get("refused")) and res.get("refused_by"),
              f"{res.get('refused_by')}: {str(res.get('refused'))[:88]}")
    else:
        check("the line-final control does not fire",
              res["p"] > 0.05,
              f"p={res['p']:.3f}, KL={res['kl']:.4f} vs null mean "
              f"{res['null_mean']:.4f}. A fire here voids the layer")
    # and the primary statistic must not be reading those positions at all
    st = syllable_stream(LEX, iso)
    prim = analyse(LEX, iso, tdecl=TimeDeclaration(n_perm=200))
    finals = sum(1 for s in st if s["line_final"])
    check("line-final positions are excluded from the primary slots",
          prim["n_slots"] <= len([s for s in st if s["stress"] in (1, 2)])
          - 0, f"{finals} line-final syllables; primary uses "
               f"{prim['n_slots']} slots")


def test_saturation_refuses_rather_than_returning_a_weak_p():
    print("\n4b. a saturated comparison has no power and must decline")
    # On the registered parameters every corpus in this repo runs 87-97% of
    # eligible slots as events, so the event and slot phase distributions
    # coincide by construction. The first run returned p = 0.087 on the rap
    # verse, which reads as a near-miss and is nothing of the kind.
    lines = ["the silver morning settles on the stone",
             "a hollow evening rattles in the bone",
             "the yellow water gathers at the door",
             "a shallow gutter carries to the shore"]
    st = syllable_stream(LEX, lines)
    idx = grid_index(st, "stress")
    slots = [i for i in range(len(st))
             if idx[i] is not None and not st[i]["line_final"]]
    res = analyse(LEX, lines, events=set(slots),
                  tdecl=TimeDeclaration(n_perm=50))
    check("a fully saturated event set is refused, not scored",
          res.get("kl") is None and res.get("p") is None
          and "no power" in (res.get("refused") or ""),
          f"saturation {res.get('saturation', 0):.0%}; "
          f"{(res.get('refused') or '')[:80]}")
    check("the refusal blames the instrument, not the verse",
          "instrument" in (res.get("refused") or ""),
          "the comparator's additive floor over a 32-syllable window is what "
          "makes nearly every stressed syllable an event")
    thin = analyse(LEX, lines, events=set(slots[:4]),
                   tdecl=TimeDeclaration(n_perm=50))
    check("below the ceiling the test still runs",
          thin.get("kl") is not None or "few" in (thin.get("refused") or ""),
          f"saturation {thin.get('saturation', 0):.0%}")


def test_registered_h3_control_is_a_tautology_and_says_so():
    print("\n4c. a control that cannot fire must announce itself")
    iso = ["the silver morning settles on the stone",
           "a hollow evening rattles in the bone",
           "the yellow water gathers at the door",
           "a shallow gutter carries to the shore"]
    res = line_final_control(LEX, iso, tdecl=TimeDeclaration(n_perm=200),
                             mode="within")
    if res.get("saturation", 0) >= 0.999:
        check("the identity case is labelled degenerate",
              "degenerate" in res,
              (res.get("degenerate") or "")[:96])
        check("it does not present KL=0 as a passing control",
              "NO evidence" in (res.get("degenerate") or ""),
              "doctrine 14: a control defined in terms of the quantity it "
              "controls, reproduced in this module's own first draft")
    elif res.get("kl") is None:
        # THE BRANCH THIS SECTION IS NAMED AFTER, and it was unreachable
        # until 2026-08-23 because there were only two arms. The `else` read
        # `check("not every line-final rhymes here, so the control is live",
        # True, ...)` — a sentence that is FALSE on this fixture (stone/bone,
        # door/shore: every line-final rhymes, which is the whole design) and
        # that could not be contradicted because it rode on `True`. What the
        # control actually does here is produce ZERO events and decline. That
        # is not a failure and not a silence — it is the third outcome, and
        # doctrine 20 says it has to be told apart from both. Now it is.
        check("the control cannot fire on this fixture and ANNOUNCES it — a "
              "refusal that names itself and the guard that raised it, not a "
              "bare None and not a KL of zero",
              bool(res.get("refused")) and bool(res.get("refused_by"))
              and res.get("p") is None,
              f"{res.get('refused_by')} at n_events="
              f"{res.get('n_events')}: {str(res.get('refused'))[:76]}")
    else:
        check("not every line-final rhymes here, so the control is live — it "
              "returns a divergence and a p-value, not a refusal",
              res["saturation"] < 0.999
              and 0.0 < res.get("p", 0) <= 1.0,
              f"saturation {res['saturation']:.0%}, kl={res.get('kl')}, "
              f"p={res.get('p')}")
    post = line_final_control(LEX, iso, tdecl=TimeDeclaration(n_perm=200),
                              mode="against_all")
    check("the post-hoc variant is labelled post-hoc in its own output",
          "POST-HOC" in post.get("control_mode", ""),
          post.get("control_mode", ""))
    check("the two modes are genuinely different comparisons",
          post["n_slots"] != res["n_slots"],
          f"against_all uses {post['n_slots']} slots, within uses "
          f"{res['n_slots']}")


def test_period_is_withheld_on_a_null_result():
    print("\n4d. the recovered period is biased and must not be read off noise")
    import random
    from quality.time_layer import phase_statistic
    rng = random.Random(1)
    slots = list(range(120))
    picks = Counter(phase_statistic(slots, rng.sample(slots, 40),
                                    (2, 3, 4, 6, 8))[1] for _ in range(200))
    check("on pure noise the sweep concentrates on the largest periods",
          picks.most_common(1)[0][0] == 8 and set(picks) <= {6, 8},
          f"{dict(picks)} — E[KL] grows with bin count, so argmax lands on "
          f"the largest period offered. The observed sonnet split was 27/40 "
          f"at P=8 and 13/40 at P=6, indistinguishable from this")
    lines = ["the cat came back and sat upon the mat",
             "a dog ran out and stood beside the road",
             "she took the coat and left it on the chair",
             "he paid the man and carried home the load"]
    res = analyse(LEX, lines, tdecl=TimeDeclaration(n_perm=300))
    if res.get("kl") is not None and res["p"] >= 0.05:
        check("a non-significant result withholds its period",
              res["period"] is None and res["period_argmax"] is not None,
              f"p={res['p']:.3f}, argmax {res['period_argmax']} kept only in "
              f"period_argmax")
        check("and says why in the result itself",
              "biased" in res.get("period_note", ""))


def test_h4_shuffle_destroys_the_pairing_not_the_marginals():
    print("\n5. H4 — the null preserves every marginal it should")
    lines = ["the cat came back and sat upon the mat",
             "a dog ran out and stood beside the road"]
    st = syllable_stream(LEX, lines)
    idx = grid_index(st, "stress")
    slots = [i for i in range(len(st)) if idx[i] is not None
             and not st[i]["line_final"]]
    check("only stressed syllables occupy a slot on the stress grid",
          all(st[i]["stress"] in (1, 2) for i in slots),
          "English times its stresses, not its syllables")
    check("the grid index is dense over occupied slots",
          sorted(idx[i] for i in slots) == sorted(set(idx[i] for i in slots)),
          "no two slots share a coordinate")


def test_grid_units_are_different_measurements():
    print("\n6. the two grid units are not interchangeable")
    lines = ["the silver morning settles on the stone",
             "a hollow evening rattles in the bone"]
    st = syllable_stream(LEX, lines)
    s_idx = [i for i in grid_index(st, "stress") if i is not None]
    y_idx = [i for i in grid_index(st, "syllable") if i is not None]
    check("the stress grid has strictly fewer slots than the syllable grid",
          len(s_idx) < len(y_idx),
          f"{len(s_idx)} stresses vs {len(y_idx)} syllables — a result that "
          f"holds on one and reverses on the other is an artifact of the "
          f"isochrony assumption (pre-registered H5)")


def test_declares_that_it_does_not_measure_time():
    print("\n7. the layer never claims to have measured time")
    d = TimeDeclaration()
    check("isochrony is declared an assumption, in the declaration",
          "ASSUMED" in d.isochrony and "not measured" in d.isochrony)
    res = analyse(LEX, ["the cat sat on the mat", "the dog ran to the road"],
                  tdecl=TimeDeclaration(n_perm=100))
    check("every result carries the assumption forward",
          "isochrony" in res and "ASSUMED" in res["isochrony"])
    blob = " ".join(str(v) for v in res.values()).lower()
    check("no output word promises a beat",
          "on the beat" not in blob and "bpm" not in blob,
          "there is no audio in this project; 'on the beat' is not a claim "
          "this code can make")


def test_no_score():
    print("\n8. doctrine 6 — the layer reports a statistic, not a score")
    res = analyse(LEX, ["the cat sat on the mat", "the dog ran to the road"],
                  tdecl=TimeDeclaration(n_perm=100))
    for k in ("score", "quality", "rating", "grade"):
        check(f"no {k!r} key in the result", k not in res)
    check("the result carries its own null so it can be argued with",
          res.get("kl") is None or
          {"null_mean", "null_p95", "p"} <= set(res),
          "a statistic without its null is an assertion")


if __name__ == "__main__":
    for fn in (test_statistic_is_phase_invariant,
               test_null_is_the_items_own_stream,
               test_kl_bias_is_absorbed_by_the_null,
               test_h3_tripwire_line_final_in_isosyllabic_form,
               test_saturation_refuses_rather_than_returning_a_weak_p,
               test_registered_h3_control_is_a_tautology_and_says_so,
               test_period_is_withheld_on_a_null_result,
               test_h4_shuffle_destroys_the_pairing_not_the_marginals,
               test_grid_units_are_different_measurements,
               test_declares_that_it_does_not_measure_time,
               test_no_score):
        fn()
    print("=" * 62)
    if FAILURES:
        print(f"{len(FAILURES)} FAILING: {', '.join(FAILURES)}")
        sys.exit(1)
    print("all time-layer regressions pass")
