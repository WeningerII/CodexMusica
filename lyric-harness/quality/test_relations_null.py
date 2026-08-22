#!/usr/bin/env python3
"""Regressions for `quality/relations_null.py` SECTION 9 — the panel.

`quality/test_null_shapes.py` §5-8 already pins the census, the sweep runner
and `NEVER_PROVIDED`.  This file pins the layer added on top of them: the
PANEL, which extends the matched-control coverage from 34 live schemas on one
undeclared English slice to every schema in `relations.REGISTRY` over nine
declared slices, and reports the ones it still cannot reach BY NAME.

EVERY CHECK HERE FAILS IN BOTH DIRECTIONS, and that is the point of the file
rather than a nicety.  Doctrine 94: a positive-case suite cannot find a rule
that is too GENEROUS, and this suite exists to gate an ADMISSIBLE SET — a list
of relations allowed to become enforceable because they beat their own null.
A suite that only asserted "these schemas clear" would pass just as happily if
`cleared()` started returning True for a row whose null never moved, which is
exactly the failure `p=1.0000 with 0% differing` wears (doctrine 63/68).  So
each section states the two directions it can fail in.

  1. THE PANEL IS A PARTITION OF THE REGISTRY.  Every declared schema gets
     exactly one verdict, INCLUDING one no slice could ask.  Fails if a schema
     is dropped (doctrine 20: absent and found-nothing must not look the same)
     and fails if a verdict outside `PANEL_VERDICTS` appears.
  2. THE READER IS A COORDINATE AND ITS SIZE IS MEASURED.  `_read` keeps
     `--- TITLE:` marker rows and `_read_slice` drops them.  Fails if either
     one changes: `_read` moving would move every frozen verdict in
     `EXTENSION_LEDGER` underneath a ledger that was not re-recorded, and
     `_read_slice` moving would put editorial rows back into the panel's verse.
  3. A DECLARATION STEP SUPPLIES ITS CAPABILITY, AND ONLY WHEN CALLED.  Both
     directions are asserted on the same stream: refused before, reachable
     after.  A capability that became unconditional would pass a
     positive-only check and would mean the panel's caesura schemas were
     never gated at all.
  4. `prepare` REACHES EVERY REPLICATE.  A caesura declared on the
     observation and not on the replicates gives a schema an observation with
     no null behind it — and `sweep` would print it as a row like any other.
     Asserted by replicate COUNT, and in the other direction by the same
     sweep with `prepare=None` producing no live row at all.
  5. `cleared()` IS THE GATE AND IT IS ASSERTED TOO-PERMISSIVE-WARD.  Three
     synthetic rows: above the max with a dead null (must NOT clear), equal to
     the max with a live null (must NOT clear), above the max with a live null
     (must clear).
  6. THE FALSE-CLEAR ARITHMETIC IS THE DEFINITION.  rows/(n+1), because a row
     clears when the observation beats all n replicates and under H0 it is
     exchangeable with them.  Fails if the expression drifts from the sentence
     the results document quotes.
  7. AN UNKNOWN DECLARATION STEP REFUSES AT BUILD TIME.  A slice naming a step
     that does not exist must not quietly declare nothing.
  8. A MISSING PANEL CORPUS REFUSES RATHER THAN BEING SKIPPED, and the census
     is still complete afterwards.
  9. THE BLOCKER TABLE FAILS IN BOTH DIRECTIONS.  Every capability any schema
     requires is DECLARED by the panel, or carries a `BLOCKERS` line, or is in
     `NEVER_PROVIDED` — and no `BLOCKERS` line names a capability no schema
     asks for any more, and no capability is both declared and blocked.
 10. `Coverage.missing` CARRIES THE WHOLE SET.  `Refusal.capability` is
     alphabetically first, which names the cheap blocker and hides the
     structural one; the panel's verdicts turn on the difference.
 11. A REFUSED REPLICATE IS COUNTED.  A null that destroys the frame a schema
     REQUIRES makes that draw refuse, and a runner that drops it keeps only
     the replicates that survived the schema's own gate — doctrine 27's error
     one layer out.  `used + refused == n` is asserted on every row, and the
     other direction is asserted too: at least one null must actually destroy
     the frame, or the counter is decoration.

Run: python3 quality/test_relations_null.py
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

import quality.relations as R                                      # noqa: E402
import quality.relations_null as N                                 # noqa: E402
from quality.phonology import get as get_phonology                 # noqa: E402

PASS, FAIL = [], []


def check(name, ok, note=""):
    (PASS if ok else FAIL).append(name)
    print("  %s  %s" % ("PASS" if ok else "FAIL", name))
    if note:
        print("          %s" % note)


def stream_of(lines, lang="eng"):
    return R.build_stream(lines, get_phonology(lang),
                          declaration={"language": lang},
                          stanzas=R.stanzas_from_blank_lines(lines))


#: Four lines with a printable caesura structure and a repeated tail, so the
#: same fixture exercises both declaration steps.  CONSTRUCTED, and that is
#: admissible here because these are claims about the FUNCTIONS, not about
#: English verse.
FIXTURE = [
    "the harbor froze and the merchant sold his cargo away",
    "the engine made a rattle and the letter went away",
    "a hollow yellow meadow where the mellow fellow lay away",
    "the ferry crossed at midnight and the timber drifted away",
]


# ---------------------------------------------------------------------------
# §1  THE PANEL IS A PARTITION OF THE REGISTRY
# ---------------------------------------------------------------------------


def s1_partition():
    print("\n§1 the panel is a partition of the registry")
    # An EMPTY panel is the adversarial case: nothing was asked, so every
    # schema must still be reported, with a reason.
    cens = N.panel_census([], {})
    names = [c.schema for c in cens]
    check("§1 every declared schema gets exactly one row (empty panel)",
          sorted(names) == sorted(R.REGISTRY)
          and len(names) == len(set(names)),
          f"{len(names)} rows for {len(R.REGISTRY)} schemas")
    check("§1 every verdict is one of PANEL_VERDICTS",
          all(c.verdict in N.PANEL_VERDICTS for c in cens),
          str(sorted({c.verdict for c in cens})))
    check("§1 a schema no slice could ask still carries a REASON",
          all(c.detail or c.verdict for c in cens))
    # And the same over a real one-slice panel, which is the shape the run has.
    sl = [s for s in N.PANEL if s.name == "eng"]
    rows, per = N.panel_sweep(root=ROOT, n=1, budget=None, panel=sl)
    cens = N.panel_census(rows, per)
    check("§1 one real slice: still one row per schema",
          sorted(c.schema for c in cens) == sorted(R.REGISTRY))
    live = {c.schema for c in cens if c.rows}
    check("§1 one real slice: the eng cell produces live rows",
          len(live) > 30, f"{len(live)} schemas with at least one row")
    return cens


# ---------------------------------------------------------------------------
# §2  THE READER IS A COORDINATE AND ITS SIZE IS MEASURED
# ---------------------------------------------------------------------------


def s2_reader():
    print("\n§2 the reader is a coordinate (doctrine 58)")
    path, _lang, limit = N.LEDGER_SLICE
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        check("§2 ledger slice present", False, path)
        return
    a = N._read(full, limit)
    b = N._read_slice(full, limit)
    marked_a = [l for l in a if l.lstrip().startswith("---")]
    marked_b = [l for l in b if l.lstrip().startswith("---")]
    check("§2 `_read` KEEPS marker rows (the ledger's reader is unchanged)",
          len(marked_a) > 0,
          f"{len(marked_a)} of {len(a)}: {[m[:30] for m in marked_a]}")
    check("§2 `_read_slice` drops every marker row",
          len(marked_b) == 0 and len(b) == len(a),
          f"{len(marked_b)} marker rows in {len(b)} panel lines")
    d = N.panel_reader_delta(ROOT)
    check("§2 `panel_reader_delta` measures the difference rather than "
          "asserting it is small",
          d is not None and len(d["dropped"]) == len(marked_a),
          f"dropped {len(d['dropped']) if d else '?'}, verdicts moved "
          f"{len(d['verdicts_moved']) if d else '?'}")


# ---------------------------------------------------------------------------
# §3  A DECLARATION STEP SUPPLIES ITS CAPABILITY, AND ONLY WHEN CALLED
# ---------------------------------------------------------------------------


def s3_declarations():
    print("\n§3 a declaration step supplies its capability, and only when "
          "called")
    for step, cap, schema in (("caesura:searched", "caesura",
                               "leonine rhyme"),
                              ("refrain:all_lines", "refrain_tail",
                               "epistrophe / radif")):
        bare = stream_of(FIXTURE)
        check(f"§3 {cap!r} is NOT provided before {step!r} runs",
              not bare.provides(cap))
        out = R.realise(R.REGISTRY[schema], bare, keep=("true", "none"))
        check(f"§3 {schema!r} REFUSES on the undeclared stream, naming "
              f"{cap!r}",
              isinstance(out, R.Refusal) and cap in out.missing,
              getattr(out, "missing", "no refusal"))
        made = stream_of(FIXTURE)
        N.DECLARATIONS[step][0](made)
        check(f"§3 {cap!r} IS provided after {step!r} runs",
              made.provides(cap))
        out2 = R.realise(R.REGISTRY[schema], made, keep=("true", "none"))
        check(f"§3 {schema!r} no longer refuses for {cap!r}",
              not isinstance(out2, R.Refusal) or cap not in out2.missing,
              getattr(out2, "missing", "realised"))


# ---------------------------------------------------------------------------
# §4  `prepare` REACHES EVERY REPLICATE, NOT ONLY THE OBSERVATION
# ---------------------------------------------------------------------------


def s4_prepare_per_replicate():
    print("\n§4 `prepare` reaches every replicate (doctrine 56)")
    n = 4
    phon = get_phonology("eng")
    prep = N.declaration_step(("caesura:searched",))
    got, _cens = N.sweep(FIXTURE, phon, "eng",
                         schemas={"leonine rhyme":
                                  R.REGISTRY["leonine rhyme"]},
                         n=n, budget=None, prepare=prep)
    live = [r for r in got if not isinstance(r, R.Refusal)]
    check("§4 with `prepare`, the caesura schema produces rows",
          bool(live), f"{len(live)} rows")
    check("§4 every replicate reached the schema (no silent refusals)",
          all(len(r.values) == n for r in live),
          str(sorted({len(r.values) for r in live})))
    # THE OTHER DIRECTION.  Without the step the schema must not appear at
    # all: a row here would mean the capability gate had stopped gating.
    got2, _c2 = N.sweep(FIXTURE, phon, "eng",
                        schemas={"leonine rhyme":
                                 R.REGISTRY["leonine rhyme"]},
                        n=1, budget=None, prepare=None)
    check("§4 without `prepare`, the same schema yields NO live row",
          not [r for r in got2 if not isinstance(r, R.Refusal)])


# ---------------------------------------------------------------------------
# §5  `cleared()` IS THE GATE, ASSERTED TOO-PERMISSIVE-WARD
# ---------------------------------------------------------------------------


def _row(observed, values):
    return N.Result(schema="perfect rhyme", statistic="count",
                    null="global_redeal", language="eng", n_lines=4,
                    replicates=len(values), seed=N.SEED, observed=observed,
                    values=list(values))


def s5_cleared():
    print("\n§5 `cleared()` fails toward the permissive side (doctrine 94)")
    dead = _row(10.0, [10.0] * 8)
    check("§5 above nothing, null NEVER MOVED -> NOT cleared "
          "(doctrine 20/68)",
          not N.cleared(dead),
          f"differing {dead.differing}, gap {dead.gap_to_max}")
    tie = _row(10.0, [3.0, 5.0, 10.0, 2.0])
    check("§5 EQUAL to the null max with a live null -> NOT cleared "
          "(strictly above, doctrine 57)",
          not N.cleared(tie), f"gap {tie.gap_to_max}")
    real = _row(11.0, [3.0, 5.0, 10.0, 2.0])
    check("§5 above the null max with a live null -> cleared",
          N.cleared(real), f"gap {real.gap_to_max}")
    empty = _row(11.0, [])
    check("§5 a row with NO replicates -> NOT cleared", not N.cleared(empty))
    check("§5 a Refusal -> NOT cleared",
          not N.cleared(R.Refusal("x", "denominator", "no denominator")))


# ---------------------------------------------------------------------------
# §6  THE FALSE-CLEAR ARITHMETIC IS THE DEFINITION
# ---------------------------------------------------------------------------


def s6_false_clears():
    print("\n§6 the false-clear arithmetic is the definition (doctrine 19/22)")
    check("§6 expected clears = rows/(n+1)",
          abs(N.expected_false_clears(101, 100) - 1.0) < 1e-12
          and abs(N.expected_false_clears(52, 25) - 2.0) < 1e-12,
          f"{N.expected_false_clears(101, 100)} / "
          f"{N.expected_false_clears(52, 25)}")
    check("§6 it RISES as n falls — a smaller n buys a larger free set",
          N.expected_false_clears(100, 4) > N.expected_false_clears(100, 99))


# ---------------------------------------------------------------------------
# §7  AN UNKNOWN DECLARATION STEP REFUSES AT BUILD TIME
# ---------------------------------------------------------------------------


def s7_unknown_step():
    print("\n§7 an unknown declaration step refuses at build time")
    try:
        N.declaration_step(("caesura:invented",))
        ok = False
    except KeyError:
        ok = True
    check("§7 an unimplemented step raises rather than declaring nothing", ok)
    check("§7 no named step is a no-op", N.declaration_step(()) is None)
    for s in N.PANEL:
        check(f"§7 panel slice {s.name!r} names only implemented steps",
              all(d in N.DECLARATIONS for d in s.declare), str(s.declare))


# ---------------------------------------------------------------------------
# §8  A MISSING PANEL CORPUS REFUSES RATHER THAN BEING SKIPPED
# ---------------------------------------------------------------------------


def s8_missing_corpus():
    print("\n§8 a missing panel corpus REFUSES (doctrine 20/48)")
    ghost = N.Slice("ghost", "corpus/does_not_exist_XYZ.txt", "eng", 40)
    lines, refusal = ghost.read(ROOT)
    check("§8 a missing slice returns a Refusal, not an empty list",
          lines is None and isinstance(refusal, R.Refusal),
          getattr(refusal, "capability", "?"))
    rows, per = N.panel_sweep(root=ROOT, n=1, budget=None, panel=[ghost])
    check("§8 the panel records the refusal per slice",
          per["ghost"][2] is not None and not rows)
    cens = N.panel_census(rows, per)
    check("§8 the census is still complete after a refused slice",
          sorted(c.schema for c in cens) == sorted(R.REGISTRY))


# ---------------------------------------------------------------------------
# §9  THE BLOCKER TABLE FAILS IN BOTH DIRECTIONS
# ---------------------------------------------------------------------------


def s9_blockers():
    print("\n§9 the blocker table fails in both directions (doctrine 44/48)")
    needed = {c for s in R.REGISTRY.values() for c in s.capabilities()}
    declared = {N.DECLARATIONS[d][1] for s in N.PANEL for d in s.declare}
    # Capabilities a phonology or the bare stream already supplies are neither
    # declared by a step nor blocked; they are asked of the stream, so the set
    # under test is the one nothing in the panel can turn on.
    supplied_by_some_slice = set()
    for sl in N.PANEL:
        got, refusal = sl.read(ROOT)
        if refusal is not None:
            continue
        st = N._stream_of([R.tokenise(x) for x in got if x.strip()],
                          get_phonology(sl.language), sl.language,
                          sl.prepare())
        supplied_by_some_slice |= {c for c in needed if st.provides(c)}
    unreachable = needed - supplied_by_some_slice
    missing_entry = sorted(c for c in unreachable
                           if c not in N.BLOCKERS
                           and c not in N.NEVER_PROVIDED)
    check("§9 every capability NO panel slice supplies has a recorded "
          "blocker",
          not missing_entry, str(missing_entry))
    outlived = sorted(c for c in N.BLOCKERS if c not in needed)
    check("§9 no BLOCKERS line outlived the schema that asked for it",
          not outlived, str(outlived))
    both = sorted(set(N.BLOCKERS) & supplied_by_some_slice)
    check("§9 no capability is both SUPPLIED by a slice and recorded as "
          "blocked",
          not both, str(both))
    overlap = sorted(set(N.BLOCKERS) & set(N.NEVER_PROVIDED))
    check("§9 BLOCKERS and NEVER_PROVIDED are disjoint", not overlap,
          str(overlap))
    check("§9 the panel DOES supply caesura and refrain_tail somewhere",
          {"caesura", "refrain_tail"} <= supplied_by_some_slice,
          str(sorted(supplied_by_some_slice)))
    # And the one the panel must NOT be able to supply, or `relations.py`'s
    # own UNPROVIDABLE table has gone stale.
    check("§9 `frequency`/`stub_resolution` stay unreachable on every slice",
          not ({"frequency", "stub_resolution"} & supplied_by_some_slice))
    return supplied_by_some_slice


# ---------------------------------------------------------------------------
# §10  `Coverage.missing` CARRIES THE WHOLE SET
# ---------------------------------------------------------------------------


def s10_missing_complete():
    print("\n§10 `Coverage.missing` carries the whole set (doctrine 44)")
    # `msa` supplies no prominence, so `family rhyme` is missing BOTH
    # `prominence` (which eng supplies) and `quotient:manner` (which nothing
    # does). `capability` is the alphabetically first and names the cheap one.
    sl = [s for s in N.PANEL if s.name == "msa"]
    if not sl:
        check("§10 msa slice declared", False)
        return
    got, refusal = sl[0].read(ROOT)
    if refusal is not None:
        check("§10 msa slice readable", False, refusal.detail)
        return
    st = N._stream_of([R.tokenise(x) for x in got if x.strip()],
                      get_phonology("msa"), "msa", sl[0].prepare())
    cov = {c.schema: c for c in N.coverage(st, budget=None)}
    fam = cov["family rhyme"]
    check("§10 `family rhyme` refuses on msa", fam.verdict == "cannot_obtain")
    check("§10 `missing` holds BOTH capabilities",
          set(fam.missing) == {"prominence", "quotient:manner"},
          str(fam.missing))
    check("§10 `capability` is still the alphabetically first one, "
          "unchanged",
          fam.capability == "prominence" and fam.capability == fam.missing[0])
    check("§10 the two answer different questions — the cheap blocker is not "
          "the structural one",
          "prominence" not in N.BLOCKERS and "quotient:manner" in N.BLOCKERS)


# ---------------------------------------------------------------------------
# §11  A REFUSED REPLICATE IS COUNTED, NEVER SILENTLY DROPPED
# ---------------------------------------------------------------------------


def s11_refused_replicates():
    print("\n§11 a refused replicate is COUNTED (doctrine 27/79)")
    # `global_redeal` scatters the shared trailing run a refrain tail is
    # computed from, so on some replicates `mark_refrain_tail` finds none, the
    # frame is DECLARED-BUT-EMPTY, `Stream.supply` calls it vacuous and
    # `realise` refuses. Before the counter those draws vanished and the row
    # printed the run's nominal n over a distribution that never held it.
    sl = [x for x in N.PANEL if x.name == "fas"]
    if not sl:
        check("§11 fas slice declared", False)
        return
    lines, refusal = sl[0].read(ROOT)
    if refusal is not None:
        check("§11 fas slice readable", False, refusal.detail)
        return
    n = 12
    got, _c = N.sweep(lines, get_phonology("fas"), "fas",
                      schemas={"epistrophe / radif":
                               R.REGISTRY["epistrophe / radif"]},
                      n=n, budget=None, prepare=sl[0].prepare())
    live = [r for r in got if not isinstance(r, R.Refusal)]
    check("§11 the radif schema is reachable on the one-ghazal fas slice",
          bool(live), f"{len(live)} rows")
    if not live:
        return
    check("§11 used + refused == the n that was asked for, on EVERY row",
          all(len(r.values) + r.refused_replicates == n for r in live),
          str(sorted({(len(r.values), r.refused_replicates) for r in live})))
    check("§11 at least one null DOES destroy the frame, so the counter is "
          "exercised rather than decorative",
          any(r.refused_replicates > 0 for r in live),
          str(sorted({(r.null, r.refused_replicates) for r in live})))
    check("§11 `p` and `resolution` divide by the USED count, not by n",
          all(abs(r.resolution - 1.0 / (len(r.values) + 1)) < 1e-12
              for r in live))


def main():
    print("=" * 74)
    print("RELATIONS NULLS · SECTION 9 (THE PANEL) — regressions")
    print("=" * 74)
    s1_partition()
    s2_reader()
    s3_declarations()
    s4_prepare_per_replicate()
    s5_cleared()
    s6_false_clears()
    s7_unknown_step()
    s8_missing_corpus()
    s9_blockers()
    s10_missing_complete()
    s11_refused_replicates()
    print("\n" + "=" * 74)
    print(f"  {len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        for f in FAIL:
            print(f"    FAILED: {f}")
    print("=" * 74)
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
