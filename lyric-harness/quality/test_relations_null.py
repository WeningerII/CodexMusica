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

 15. BLOCKER KINDS match existing declaration mechanisms; invalid records
     refuse and declared capabilities are tested absent-before/present-after.

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
    # M-39: NO pre-computed derivation.  A fixture that prints no blank line
    # supplies no stanza ground, and the stanza-framed schemas refuse on it —
    # which is what this file exists to keep honest one layer up.
    return R.build_stream(lines, get_phonology(lang),
                          declaration={"language": lang})


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


def _schema_groups(names, workers):
    """Disjoint registry slices; no schema disappears when the width changes."""
    if workers < 1:
        raise ValueError("TEST_RELATIONS_NULL_WORKERS must be positive")
    return [tuple(names[k::workers]) for k in range(min(workers, len(names)))]


def _panel_ground(sl, names):
    """Exact, task-local inputs; no observation survives an input change."""
    lines, stanzas, source, refused_marks, refusal = sl.read_grounded(ROOT)
    if refusal is not None:
        raise RuntimeError(str(refusal))
    signature = {
        "slice": (sl.name, sl.path, sl.language, sl.limit, sl.reader,
                  tuple(sl.declare), sl.note),
        "lines": tuple(lines), "stanzas": None if stanzas is None else tuple(stanzas),
        "source": source, "refused_marks": refused_marks,
        "schemas": tuple(names), "seed": N.SEED, "replicates": 1,
        "statistics": tuple(N.SWEEP_STATISTICS), "keep": ("true", "none"),
        "chans": None, "budget": None, "derived_only": False,
    }
    return lines, stanzas, source, signature


def _panel_payload_bytes(payload):
    """Only small records/scalars cross spawn; reject retained realisations."""
    from dataclasses import asdict
    import pickle
    def _plain(value):
        if value is None or type(value) in (str, int, float, bool):
            return True
        if isinstance(value, (N.Coverage, R.Refusal)):
            return _plain(asdict(value))
        if type(value) in (tuple, list):
            return all(_plain(item) for item in value)
        if type(value) is dict:
            return all(_plain(key) and _plain(item) for key, item in value.items())
        return False
    if not _plain(payload):
        raise ValueError("parallel panel payload retained a non-scalar instrument object")
    return len(pickle.dumps(payload, protocol=pickle.HIGHEST_PROTOCOL))


def _prepare_panel_schema_worker(task):
    """Measure the original once, then send only its census and statistics.

    Coverage and observation ask exactly the same realisation of the prepared
    identity stream. Reuse that result only within this schema, then release
    it. Every null replicate remains a separate production realisation.
    """
    import random
    import time
    sl, names = task
    t0 = time.monotonic()
    lines, stanzas, source, signature = _panel_ground(sl, names)
    toks = [R.tokenise(line) for line in lines if line.strip()]
    st0 = N._stream_of(N.NULLS["identity"].fn(toks, random.Random(N.SEED)),
                      get_phonology(sl.language), sl.language, sl.prepare(), stanzas, source)
    census, observations, realised = [], {}, {}
    costs = {"coverage": 0.0, "observation": 0.0}
    original_realise = R.realise
    cache, active = {}, None
    peak_retained = 0
    def _original_once(schema, stream, *args, **kwargs):
        nonlocal peak_retained
        if (stream is not st0 or schema is not R.REGISTRY[active]
                or args or kwargs != {"keep": signature["keep"]}):
            raise ValueError("parallel panel original realisation coordinates changed")
        if active not in cache:
            cache[active] = original_realise(schema, stream, *args, **kwargs)
            realised[active] = realised.get(active, 0) + 1
            peak_retained = max(peak_retained, len(cache))
        return cache[active]
    R.realise = _original_once
    try:
        for active in names:
            schema = R.REGISTRY[active]
            start = time.monotonic()
            cs = N.coverage(st0, schemas={active: schema}, budget=None,
                            keep=signature["keep"])
            costs["coverage"] += time.monotonic() - start
            census.extend(cs)
            if cs[0].verdict in ("controlled", "extendable", "cannot_fail"):
                snames = tuple(sn for sn in N.SWEEP_STATISTICS
                               if not N.statistic_degeneracy(schema, sn))
                if snames:
                    start = time.monotonic()
                    observations[(active, snames)] = N._measure(
                        st0, schema, [N.STATISTICS[sn] for sn in snames],
                        keep=signature["keep"])
                    costs["observation"] += time.monotonic() - start
            # No raw Instance list remains when the next schema starts, and
            # no stream, phonology, schema or declaration closure is sent.
            cache.clear()
    finally:
        cache.clear()
        R.realise = original_realise
    if realised != {name: 1 for name in names}:
        raise ValueError("parallel panel did not measure each original schema exactly once")
    payload = {"signature": signature, "census": tuple(census),
               "observations": observations, "realised": realised,
               "peak_retained_schemas": peak_retained,
               "retained_realisations": len(cache), "costs": costs,
               "seconds": time.monotonic() - t0}
    payload["bytes"] = 0
    while True:
        measured = _panel_payload_bytes(payload)
        if measured == payload["bytes"]:
            break
        payload["bytes"] = measured
    return payload


def _panel_schema_worker(task):
    """Run the real sweep, with every null and replicate, for this schema set."""
    import time
    import copy
    import json
    sl, names = task[:2]
    nulls = task[2] if len(task) > 2 else tuple(name for name in N.NULLS if name != "identity")
    prepared = task[3] if len(task) > 3 else None
    t0 = time.monotonic()
    lines, stanzas, source, signature = _panel_ground(sl, names)
    if prepared is not None:
        _panel_payload_bytes(prepared)
        if prepared["signature"] != signature:
            raise ValueError("parallel panel original input signature changed")
        if tuple(c.schema for c in prepared["census"]) != tuple(names):
            raise ValueError("parallel panel prepared census inventory changed")
    # Measure the repeated work explicitly: a null split can save wall time
    # while redoing observation setup, so its actual cost must be visible.
    costs = {"coverage": 0.0, "observation": 0.0, "replicates": 0.0}
    observation = []
    coverage, measure, realise = N.coverage, N._measure, R.realise
    realised = {"original": {}, "replicates": {}}
    def timed_coverage(stream, *args, **kwargs):
        if prepared is not None and observation:
            raise ValueError("parallel panel established more than one original stream")
        observation.append(stream)
        start = time.monotonic()
        try:
            if prepared is not None:
                if (args or tuple(kwargs.get("schemas", ())) != tuple(names)
                        or kwargs.get("budget") is not None
                        or kwargs.get("keep") != signature["keep"]
                        or kwargs.get("chans") is not None
                        or tuple(kwargs.get("statistics", ())) != signature["statistics"]):
                    raise ValueError("parallel panel prepared coverage coordinates changed")
                return list(prepared["census"])
            return coverage(stream, *args, **kwargs)
        finally:
            costs["coverage"] += time.monotonic() - start
    def timed_measure(stream, *args, **kwargs):
        key = "observation" if any(stream is item for item in observation) else "replicates"
        start = time.monotonic()
        try:
            if prepared is not None and key == "observation":
                schema, statistics = args[:2]
                if args[2:] != (None, signature["keep"]) or kwargs:
                    raise ValueError("parallel panel prepared observation coordinates changed")
                coordinate = (schema.name, tuple(s.name for s in statistics))
                if coordinate not in prepared["observations"]:
                    raise ValueError("parallel panel prepared observation is missing: " + schema.name)
                return copy.deepcopy(prepared["observations"][coordinate])
            return measure(stream, *args, **kwargs)
        finally:
            costs[key] += time.monotonic() - start
    def _counted_realise(schema, stream, *args, **kwargs):
        key = "original" if any(stream is item for item in observation) else "replicates"
        realised[key][schema.name] = realised[key].get(schema.name, 0) + 1
        return realise(schema, stream, *args, **kwargs)
    N.coverage, N._measure, R.realise = timed_coverage, timed_measure, _counted_realise
    try:
        results, census = N.sweep(
            lines, get_phonology(sl.language), sl.language,
            schemas={name: R.REGISTRY[name] for name in names},
            n=1, budget=None, prepare=sl.prepare(), nulls=nulls,
            stanzas=stanzas, stanza_source=source)
    finally:
        N.coverage, N._measure, R.realise = coverage, measure, realise
    if prepared is not None and realised["original"]:
        raise ValueError("parallel panel repeated an original realisation")
    print(f"PANEL PHASE {','.join(nulls)}: "
          + " ".join(f"{name}={seconds:.1f}s" for name, seconds in costs.items()), flush=True)
    print("PANEL REALISATIONS " + json.dumps({"nulls": nulls, **realised}, sort_keys=True), flush=True)
    return results, census, time.monotonic() - t0, nulls


def _merge_panel_parts(parts, names):
    """Require every schema/null coordinate once and identical census semantics."""
    from collections import Counter
    from dataclasses import asdict
    nulls = tuple(name for name in N.NULLS if name != "identity")
    expected = Counter((name, null) for name in names for null in nulls)
    owned = Counter((c.schema, null) for _, cs, _, ns in parts
                    for c in cs for null in ns)
    if owned != expected:
        raise ValueError("parallel panel did not return every schema/null exactly once")
    census, semantic = {}, {}
    rows, coordinates = [], []
    for results, cs, _, ns in parts:
        for c in cs:
            fields = {k: v for k, v in asdict(c).items() if k != "seconds"}
            if c.schema in semantic and semantic[c.schema] != fields:
                raise ValueError("parallel panel census differs between null arms: " + c.schema)
            semantic[c.schema] = fields
            census.setdefault(c.schema, c)
        for row in results:
            if isinstance(row, N.Result):
                if row.null not in ns or row.schema not in {c.schema for c in cs}:
                    raise ValueError("parallel panel returned an unassigned result")
                coordinates.append((row.schema, row.statistic, row.null))
            if len(ns) != 1:
                raise ValueError("parallel panel task must own exactly one null algorithm")
            rows.append((ns[0], row.schema, row))
    if any(count != 1 for count in Counter(coordinates).values()):
        raise ValueError("parallel panel duplicated a schema/statistic/null result")
    # Production sweep orders nulls and schemas lexically and preserves the
    # statistic order within each schema. Stable sort preserves that order,
    # including denominator Refusals that do not carry their own null field.
    rows.sort(key=lambda item: item[:2])
    return [row for _, _, row in rows], [census[name] for name in names]


def _partition_panel_sweep(panel):
    """Test-only parallel execution; the full production panel is still checked.

    Tasks partition both schemas and null algorithms. An original's census
    and observed statistics are measured once before its independent nulls.
    Every schema/null pair uses the original seed and replicate count in the
    real production sweep; only the unchanged original measurement is reused.
    The parent verifies all coordinates and identical census semantics across
    null arms before combining the full panel and applying the original checks.
    Serial remains the default for local callers and unsupported platforms.
    """
    workers = int(os.environ.get("TEST_RELATIONS_NULL_WORKERS", "1"))
    if workers < 1:
        raise ValueError("TEST_RELATIONS_NULL_WORKERS must be positive")
    if workers == 1:
        return N.panel_sweep(root=ROOT, n=1, budget=None, panel=panel)
    from concurrent.futures import ProcessPoolExecutor, wait, FIRST_COMPLETED
    import multiprocessing
    import json
    from collections import Counter
    groups = _schema_groups(tuple(R.REGISTRY), workers)
    check("parallel panel schema groups cover the registry exactly once",
          Counter(name for group in groups for name in group) == Counter(tuple(R.REGISTRY)))
    out, per_slice = [], {}
    with ProcessPoolExecutor(max_workers=workers,
                             mp_context=multiprocessing.get_context("spawn")) as pool:
        for sl in panel:
            nulls = tuple(name for name in N.NULLS if name != "identity")
            tasks = [(sl, group, (null,)) for group in groups for null in nulls]
            pending = {pool.submit(_prepare_panel_schema_worker, (sl, group)):
                       ("original", group, None) for group in groups}
            completed = {}
            while pending:
                done, _ = wait(pending, return_when=FIRST_COMPLETED)
                for future in done:
                    kind, group, null = pending.pop(future)
                    result = future.result()
                    if kind == "original":
                        print("PANEL ORIGINAL " + json.dumps({
                            "slice": sl.name, "schemas": group,
                            "seconds": result["seconds"], "costs": result["costs"],
                            "realised": result["realised"], "bytes": result["bytes"],
                            "peak_retained_schemas": result["peak_retained_schemas"],
                            "retained_realisations": result["retained_realisations"],
                        }, sort_keys=True), flush=True)
                        for null in nulls:
                            child = pool.submit(_panel_schema_worker, (sl, group, (null,), result))
                            pending[child] = ("null", group, null)
                    else:
                        completed[(group, null)] = result
            parts = [completed[(group, ns[0])] for _, group, ns in tasks]
            rows, census = _merge_panel_parts(parts, tuple(R.REGISTRY))
            check(f"parallel panel {sl.name}: returned every schema exactly once",
                  len(census) == len(R.REGISTRY))
            out.extend((sl.name, r) for r in rows)
            per_slice[sl.name] = (sl, census, None)
            for (_, group, null), (_, cs, elapsed, _) in zip(tasks, parts):
                print(f"PANEL WORK: {sl.name} {null[0]} {len(cs)} schemas in {elapsed:.1f}s "
                      + ",".join(group))
    return out, per_slice


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
    rows, per = _partition_panel_sweep(sl)
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
    from unittest.mock import patch
    n = 4
    phon = get_phonology("eng")
    prep = N.declaration_step(("caesura:searched",))
    prepared, refusals = [], []

    def prepare(st):
        prep(st)
        prepared.append(st.supply("caesura"))

    measure = N._measure

    def measured(*args, **kwargs):
        values, refusal = measure(*args, **kwargs)
        if refusal is not None:
            refusals.append(refusal)
        return values, refusal

    # Observe the actual declaration and judge. A successfully declared
    # caesura does not make uncertain pronunciation readings determinate.
    with patch.object(N, "_measure", side_effect=measured):
        got, _cens = N.sweep(FIXTURE, phon, "eng",
                             schemas={"leonine rhyme":
                                      R.REGISTRY["leonine rhyme"]},
                             n=n, budget=None, prepare=prepare)
    live = [r for r in got if not isinstance(r, R.Refusal)]
    check("§4 with `prepare`, the caesura schema produces rows",
          bool(live), f"{len(live)} rows")
    check("§4 the observation and every null replicate run the declaration",
          len(prepared) == 1 + n * (len(N.NULLS) - 1)
          and all(s.state in ("present", "empty") and s.source != "none"
                  for s in prepared),
          f"{len(prepared)} prepared streams; states "
          f"{sorted({s.state for s in prepared})}")
    # 2026-09-08: the old len(values)==n assertion confused reaching the
    # schema with being judgeable. One real redeal has only unresolved
    # witnesses and must remain refused rather than become a numeric zero.
    check("§4 every replicate is accounted for as used, refused, or void",
          bool(live) and all(len(r.values) + r.refused_replicates
                             + r.void_replicates == n for r in live),
          str(sorted({(len(r.values), r.refused_replicates, r.void_replicates)
                      for r in live})))
    check("§4 actual unknown readings remain explicit refusals, not missing declarations",
          bool(refusals) and all(r.capability == "reading" and r.kind == "span"
                                for r in refusals)
          and any(r.refused_replicates > 0 for r in live),
          str([(r.capability, r.kind) for r in refusals]))
    check("§4 the null resolution and p-value use only measured replicates",
          bool(live) and all(
              abs(r.resolution - 1 / (len(r.values) + 1)) < 1e-12
              and abs(r.p - (1 + sum(v >= r.observed for v in r.values))
                      / (len(r.values) + 1)) < 1e-12 for r in live))
    # THE OTHER DIRECTION.  Without the step the schema must not appear at
    # all: a row here would mean the capability gate had stopped gating.
    got2, _c2 = N.sweep(FIXTURE, phon, "eng",
                        schemas={"leonine rhyme":
                                 R.REGISTRY["leonine rhyme"]},
                        n=1, budget=None, prepare=None)
    check("§4 without `prepare`, the same schema yields NO live row",
          not [r for r in got2 if not isinstance(r, R.Refusal)]
          and len(_c2) == 1 and _c2[0].verdict == "cannot_obtain"
          and _c2[0].refusal_kind == "capability"
          and "caesura" in _c2[0].missing)


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
    # `read_grounded` AND NOT `read` (M-39).  The panel runs the grounded
    # reader, so a test that built its streams from the bare one would ask
    # this question of a pipeline production does not use — and would have
    # answered that `stanza` is unreachable on a panel where seven of nine
    # slices carry a printed ground.
    supplied_by_some_slice = set()
    per_slice_ground = {}
    for sl in N.PANEL:
        got, stanzas, src, refused_marks, refusal = sl.read_grounded(ROOT)
        if refusal is not None:
            continue
        per_slice_ground[sl.name] = (src, None if stanzas is None
                                     else len(set(stanzas)), refused_marks)
        st = N._stream_of([R.tokenise(x) for x in got if x.strip()],
                          get_phonology(sl.language), sl.language,
                          sl.prepare(), stanzas)
        supplied_by_some_slice |= {c for c in needed if st.provides(c)}
    unreachable = needed - supplied_by_some_slice
    missing_entry = sorted(c for c in unreachable
                           if c not in N.BLOCKERS
                           and c not in N.NEVER_PROVIDED)
    # M-39: the ground is a COORDINATE OF EVERY STANZA-FRAMED ROW, so it is
    # pinned here rather than left to be re-derived by whoever reads a number.
    check("§9 the panel's stanza grounds are what the corpus prints",
          per_slice_ground == {
              "eng": ("printed_breaks", 7, ()),
              "fin": ("none", None, ()),
              "cym": ("none", None, ()),
              "cym_cynghanedd": ("printed_breaks", 1, ()),
              "non": ("printed_breaks", 5, ()),
              "san": ("printed_verse_number", 14, ()),
              "msa": ("printed_breaks", 10, ()),
              "ltc": ("printed_breaks", 10, ()),
              "fas": ("printed_breaks", 7, ())},
          f"{per_slice_ground}")
    check("§9 TWO slices supply NO stanza ground, and that is a refusal "
          "rather than one stanza",
          [k for k, v in per_slice_ground.items() if v[0] == "none"]
          == ["fin", "cym"],
          "Kalevala and Alun print no blank line, no `---` row and no "
          "[MARK] inside the 40 lines read; the five `frame=\"stanza\"` "
          "schemas refuse there and are quantified everywhere else")
    check("§9 every capability NO panel slice supplies has a recorded "
          "blocker",
          not missing_entry, str(missing_entry))
    outlived = sorted(c for c in N.BLOCKERS if c not in needed)
    check("§9 no BLOCKERS line outlived the schema that asked for it",
          not outlived, str(outlived))
    # A CAPABILITY THE PANEL SUPPLIES IS NOT BLOCKED, and the three that
    # became supplied on 2026-08-22/23 -- `quotient:manner`, `morphology`,
    # `lexicon` -- sat in BLOCKERS saying otherwise until 2026-08-23. This
    # check was RED that whole time and read as furniture, which is the only
    # reason it took an audit to notice. They are in `N.LIFTED` now, whole,
    # with the route that lifted each one.
    check("§9 every LIFTED capability really IS supplied by some slice — a "
          "row moves out of BLOCKERS when the repo gets the input, and this "
          "is the assertion that the move was earned",
          set(N.LIFTED) <= supplied_by_some_slice and bool(N.LIFTED),
          f"lifted {sorted(N.LIFTED)}; of those, not supplied by any slice: "
          f"{sorted(set(N.LIFTED) - supplied_by_some_slice)}")
    check("§9 LIFTED and BLOCKERS are disjoint — one capability, one verdict "
          "(doctrine 1)",
          not (set(N.LIFTED) & set(N.BLOCKERS)),
          str(sorted(set(N.LIFTED) & set(N.BLOCKERS))))
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
    # READS `structural()` SINCE 2026-08-23, not `BLOCKERS` directly. The
    # capability moved to `N.LIFTED` when `eng.English` began declaring a
    # manner partition, and this check went red while its sentence stayed
    # true: on the MALAY slice `family rhyme` refuses for both, and the two
    # are still different kinds. English having the partition does not make
    # the Malay absence a cheap one, and asking the union by name is what
    # keeps that distinction in one place.
    check("§10 the two answer different questions — the cheap blocker is not "
          "the structural one",
          not N.structural("prominence") and N.structural("quotient:manner"),
          f"prominence structural={N.structural('prominence')}, "
          f"quotient:manner structural={N.structural('quotient:manner')} "
          f"(in BLOCKERS={'quotient:manner' in N.BLOCKERS}, "
          f"in LIFTED={'quotient:manner' in N.LIFTED})")


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
    # THREE terms since M-45: a draw is used, or the whole realise() refused,
    # or THIS statistic had no denominator on it (void).  The two-term
    # identity this check held before M-45 was already false whenever a
    # local_fraction voided — the shortfall existed and was attributed to
    # nothing.
    check("§11 used + refused + void == the n that was asked for, on EVERY "
          "row",
          all(len(r.values) + r.refused_replicates + r.void_replicates == n
              for r in live),
          str(sorted({(len(r.values), r.refused_replicates,
                       r.void_replicates) for r in live})))
    check("§11 at least one null DOES destroy the frame, so the counter is "
          "exercised rather than decorative",
          any(r.refused_replicates > 0 for r in live),
          str(sorted({(r.null, r.refused_replicates) for r in live})))
    check("§11 `p` and `resolution` divide by the USED count, not by n",
          all(abs(r.resolution - 1.0 / (len(r.values) + 1)) < 1e-12
              for r in live))


def s12_the_page_derivation_never_runs_on_a_token_join():
    """M-39, REOPENED AND CLOSED AGAIN 2026-08-22.  `_stream_of` hands
    `build_stream` a JOIN OF TOKENS and calls it `text_lines`, so the
    blank-line derivation -- which reads a blank line as the PRINTER's mark --
    was being asked a question about a page it was never shown."""
    print("\n§12 a token join is not a page (M-39, second closure)")
    from quality.phonology import get as _gp
    # `1818.]` is real: it is a Gutenberg publication note wrapped inside a
    # [VERSE] block in `corpus/song/eng_british_percy_bysshe_shelley.txt`.
    # Every character is a digit or punctuation, none in `_WORD`'s repertoire.
    page = ["1818.]", "I found a cat", "she wore a hat"]
    toks = [R.tokenise(l) for l in page if l.strip()]
    check("§12 the apparatus line is NON-BLANK on the page and tokenises to "
          "nothing, so the join manufactures a blank line",
          toks[0] == [] and " ".join(toks[0]) == "" and page[0].strip(),
          f"{toks}")
    st = N._stream_of(toks, _gp("eng"), "eng", None, None, "")
    check("§12 no ground handed in -> the derivation does NOT run, and the "
          "source is `none`",
          st.frames.stanza_source == "none"
          and st.supply("stanza").state == "absent",
          f"was `blank_lines` / present n=1 — the collapsed frame M-39 closed, "
          f"re-entering through the reader; now {st.supply('stanza')}")
    out = R.realise(R.REGISTRY["monorhyme / leash"], st)
    check("§12 ...so a stanza-framed schema REFUSES on it, naming the frame",
          isinstance(out, R.Refusal) and out.capability == "stanza",
          "it returned a NUMBER over one frame before this fix")
    st2 = N._stream_of(toks, _gp("eng"), "eng", None, [0, 0, 1],
                       "printed_breaks")
    check("§12 ...and a DECLARED ground still lands, with its own provenance "
          "— the control that proves the fix is not just a blanket refusal",
          st2.frames.stanza_source == "printed_breaks"
          and st2.supply("stanza").n == 2,
          f"{st2.supply('stanza')}")


def s13_the_census_keeps_the_refusal_kind():
    """M-43.  `Stream.supply` is three-valued and `Refusal.kind` carries the
    distinction out; `Coverage` used to throw it away at the layer that
    produces every panel and ledger number."""
    print("\n§13 the census keeps WHY it refused (M-43)")
    from quality.phonology import get as _gp
    sl = {x.name: x for x in N.PANEL}["eng"]
    lines, stanzas, src, _ref, refusal = sl.read_grounded(ROOT)
    if refusal is not None:
        return check("§13 the eng slice is readable", False, str(refusal))
    st = N._stream_of([R.tokenise(l) for l in lines], _gp("eng"), "eng",
                      sl.prepare(), stanzas, src)
    check("§13 the DECLARATION STEP RAN and the refrain frame is EMPTY, not "
          "absent — the state this section exists for",
          st.supply("refrain_tail").state == "empty"
          and st.supply("refrain_tail").source == "computed",
          f"{st.supply('refrain_tail')}")
    sub = {k: v for k, v in R.REGISTRY.items()
           if k in ("epistrophe / radif", "antanaclasis")}
    rows = {c.schema: c for c in N.coverage(st, schemas=sub)}
    vac, cap = rows["epistrophe / radif"], rows["antanaclasis"]
    check("§13 both still refuse with the SAME verdict, so no frozen ledger "
          "column moves",
          vac.verdict == cap.verdict == "cannot_obtain")
    check("§13 ...and the census now says WHY they differ",
          vac.refusal_kind == "vacuous_frame"
          and vac.vacuous == ("refrain_tail",)
          and cap.refusal_kind == "capability" and cap.vacuous == (),
          f"vacuous={vac.refusal_kind!r} capability={cap.refusal_kind!r} — "
          f"both read '' before M-43, so a declared-and-empty frame and a "
          f"resource nobody has produced a byte-identical row")
    check("§13 ...and the REMEDIES differ, which is the point (doctrine 44)",
          vac.remedy != cap.remedy
          and not vac.remedy.startswith("declare the capability")
          and "refrain_tail" in vac.remedy and "EMPTY" in vac.remedy,
          f"vacuous remedy is {vac.remedy!r}; before M-43 it was the same "
          f"string as the capability case, {cap.remedy!r} — telling a reader "
          f"to declare a capability the slice header already prints as "
          f"DECLARED. (The test asserts the remedy does not OPEN with the "
          f"instruction, not that the word is absent: the correct text says "
          f"`declaring it again changes nothing`.)")


def s14_the_void_replicate_is_its_own_count():
    """M-45, 2026-08-28.  A replicate whose whole realise() refuses has been
    counted since the `refused_replicates` field was written; a replicate the
    schema ANSWERS on which a statistic finds no denominator was dropped with
    no counter touched, so a row could print `n=200 used=50 refused=0` and
    the missing 150 draws were invisible as a KIND.  The worst recorded row —
    `monai · local_fraction@2 · global_redeal · fas` — reproduces exactly:
    used 50, refused 0, and the counter now attributes the other 150 as void.

    Two halves.  The first drives `run_many` with a statistic whose None
    returns are DETERMINISTIC, so the attribution is checked to the draw:
    void counts exactly the None returns, refused stays 0, and `p`/
    `resolution` divide by the used count.  The second drives `sweep` — the
    other copy of the loop — on the real fas row at small n, where
    `local_fraction@2` genuinely voids (a redeal that scatters the pair off
    the line-final slots leaves no instance to take a fraction of).

    TWO MUTATIONS, hand-proven before this section shipped, each killed by
    its OWN half: reverting `run_many`'s `v is None` branch to the pre-M-45
    bare append fails exactly the two run_many attribution checks (void==5
    and the three-term identity) while the sweep half stays green; reverting
    `sweep`'s copy fails exactly the sweep-half check (the fas row reads
    `used=6 refused=0 void=0` — the pre-M-45 rendering, refused by name).
    §11 stays green under BOTH mutants, which is itself a measurement: its
    radif rows carry zero void draws, so the identity there never had a
    shortfall to hide and this section's fixtures are the ones doing the
    work."""
    print("\n§14 a void replicate is COUNTED, apart from a refused one "
          "(M-45)")
    from quality.phonology import get as _gp
    lines = ["the day was cold and grey",
             "she walked the long dark way",
             "no bird would sing or stay"]
    # Half 1: run_many with a deterministic None schedule.  run_many computes
    # the observation FIRST, then replicates k=0..n-1 in order (doctrine 66:
    # the loop is sequential and seeded), so a call counter attributes each
    # None to a known draw.
    calls = {"k": -1}

    def fn(inst, findings, stream):
        calls["k"] += 1
        if calls["k"] == 0:
            return 1.0            # the observation must yield a VALUE
        return None if calls["k"] % 2 else 0.5   # odd draws void
    stat = N.Statistic("void_probe", fn, reads=("line_membership",))
    n = 10
    r = N.run_many(lines, _gp("eng"), "perfect rhyme", [stat],
                   null="line_permutation", n=n, language="eng")[0]
    ok = not isinstance(r, R.Refusal)
    check("§14 the probe row is live (the observation yielded a value)", ok)
    if not ok:
        return
    check("§14 void counts EXACTLY the draws the statistic answered None on",
          r.void_replicates == 5 and len(r.values) == 5,
          f"used={len(r.values)} void={r.void_replicates}")
    check("§14 ...and refused is UNTOUCHED by them — two kinds, two counts, "
          "never summed (doctrine 79)",
          r.refused_replicates == 0)
    check("§14 used + refused + void == n",
          len(r.values) + r.refused_replicates + r.void_replicates == n)
    check("§14 `p` and `resolution` divide by the USED count — they were "
          "always honest; the counter makes the shortfall attributable",
          abs(r.resolution - 1.0 / (len(r.values) + 1)) < 1e-12)
    check("§14 the row's own rendering carries the count",
          f"void={r.void_replicates}" in r.line(), r.line().split("\n")[-1])
    # Half 2: the sweep runner's copy, on the REAL row the register names.
    sl = {x.name: x for x in N.PANEL}.get("fas")
    if sl is None:
        return check("§14 fas slice declared", False)
    glines, stanzas, src, _ref, refusal = sl.read_grounded(ROOT)
    if refusal is not None:
        return check("§14 fas slice readable", False, refusal.detail)
    got, _c = N.sweep(glines, _gp("fas"), "fas",
                      schemas={"monai": R.REGISTRY["monai"]},
                      statistics=["local_fraction@2"],
                      nulls=["global_redeal"],
                      n=12, budget=None, prepare=sl.prepare(),
                      stanzas=stanzas, stanza_source=src)
    live = [x for x in got if not isinstance(x, R.Refusal)]
    check("§14 the register's own row is reachable at small n", bool(live),
          f"{len(live)} rows")
    if not live:
        return
    m = live[0]
    check("§14 sweep's copy of the loop counts the void kind too — the row "
          "that printed refused=0 over a shortfall now attributes it",
          m.void_replicates > 0 and m.refused_replicates == 0
          and len(m.values) + m.void_replicates == 12,
          f"used={len(m.values)} refused={m.refused_replicates} "
          f"void={m.void_replicates}")


def s15_blocker_kinds():
    print("\n§15 blocker classifications follow existing mechanisms (M-36)")
    check("§15 report strings derive from the typed records",
          N.BLOCKERS == {c: b.describe() for c, b in N.BLOCKER_RECORDS.items()})
    for args in [("unknown", "reason"), ("obtain", ""),
                 ("declare", "reason"),
                 ("declare", "reason", "missing_constructor"),
                 ("build", "reason", "declare_lifts"),
                 ("disjoint", "reason", "declare_beat")]:
        try:
            N.Blocker(*args)
        except ValueError:
            refused = True
        else:
            refused = False
        check(f"§15 malformed or contradictory blocker refuses: {args}", refused)
    # Behavior, not just hasattr: these constructors actually change supply.
    fixtures = {
        "orthography": (lambda word: word[-2:],),
        "lifts": ({0: (0, 2), 1: (0, 2)},),
        "beat": ({0: (0, 2), 1: (0, 2)},),
        # ADDED 2026-09-24: #375 (the N-relation model, b42287af) declared a
        # fourth `declare` blocker, `tonal_template` -> `relations.
        # declare_tonal_template`, for the 平仄 template figure it made
        # executable. The equality check above is what caught that it had no
        # witness; this row is its behavioural one — a {0-based line: pattern}
        # of `TONE_MARKS`, which must take `supply('tonal_template')` from
        # absent to present on the same fixture as the other three.
        "tonal_template": ({0: "平仄平仄"},),
    }
    declared = {c for c, b in N.BLOCKER_RECORDS.items() if b.kind == "declare"}
    check("§15 every declare blocker has a behavioral witness", declared == set(fixtures))
    for cap, args in fixtures.items():
        st = stream_of(FIXTURE)
        check(f"§15 {cap} absent without caller coordinates", not st.provides(cap))
        record = N.BLOCKER_RECORDS[cap]
        getattr(R, record.declaration)(st, *args)
        check(f"§15 {cap} supplied by its recorded constructor", st.provides(cap))
        check(f"§15 {cap} requires declaration, not construction or disjointness",
              record.kind == "declare")
    check("§15 sense derivation awaits validation, not a missing inventory",
          N.BLOCKER_RECORDS["sense"].kind == "validate")


def s15_named_nulls_are_not_independent_evidence():
    import contextlib
    import io
    import random

    print("\n§15 M-42 named algorithms are not independent controls")
    # 2026-10-30: was the door/floor/adore/more set. Since M-322 those words
    # carry accent alternates and both nulls refuse on `reading`; the claim
    # is about the null algorithms, so words with fewer readings carry it.
    # 2026-10-30 (G1, M-322 item 4): ~~"a play", "we stay", "a light"~~. With
    # `_bucket_key` keying mosaic rhyme's run at its last syllable, every run
    # in that set rhymes under both nulls (20 every draw), so it no longer
    # separates them. This set does, before G1 and after (3 vs 3/6; 12 vs 9/12).
    # 2026-10-31 (M-311 F1, R2's mosaic ruling): ~~"the day", "we may",
    # "I see grey", "the night", "my light", "it's right"~~. A one-syllable
    # end rhyme with a word before it is no longer a mosaic, so that set reads
    # 0 under both nulls; and a mosaic through a function word (`know it`)
    # refuses here, its stress being a reading this null does not search. A
    # mosaic of content words with one reading each carries the claim:
    # `window ~ thin dough` (IH1 N D OW0 against IH1 N | D OW1), 1.0 every
    # draw under line_permutation against 1 of 12 under line_final_permutation.
    lines = ["my window", "fresh thin dough", "we stay", "I see grey", "she may", "my fun day"]
    toks = [R.tokenise(line) for line in lines]
    pairs = [(N.NULLS["line_permutation"].fn(toks, random.Random(N.SEED + 1 + k)),
              N.NULLS["line_final_permutation"].fn(toks, random.Random(N.SEED + 1 + k)))
             for k in range(200)]
    check("§15 200 paired draws have identical final-token projections",
          all([line[-1] for line in a] == [line[-1] for line in b]
              for a, b in pairs))
    check("§15 equal final tokens do not imply equal token grids",
          any(a != b for a, b in pairs))
    runs = [N.run(lines, get_phonology("eng"), "mosaic rhyme", n=12,
                  language="eng", null=name)
            for name in ("line_permutation", "line_final_permutation")]
    check("§15 actual mosaic judge disproves blanket both_line_final collapse",
          all(isinstance(r, N.Result) for r in runs)
          and runs[0].values != runs[1].values)

    def row(null, statistic="count", observed=3, schema="perfect rhyme"):
        return N.Result(schema, statistic, null, "eng", 6, 2, N.SEED,
                        observed, values=[0, 1])

    rows = [("eng", row("line_permutation")),
            ("eng", row("line_permutation", "local_fraction@2")),
            ("eng", row("line_final_permutation")),
            ("eng", row("global_redeal", observed=1)),
            ("eng", row("within_line_shuffle", schema="mosaic rhyme")),
            ("non", row("global_redeal")),
            ("eng", R.Refusal("perfect rhyme", "test", "unavailable"))]
    check("§15 names deduplicate statistics, separate slices, exclude non-clears/refusals",
          N.named_null_clears(rows, "perfect rhyme") == {
              "eng": ("line_final_permutation", "line_permutation"),
              "non": ("global_redeal",)})
    check("§15 no clear is an empty mapping", N.named_null_clears([], "perfect rhyme") == {})
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        N.report_panel(rows, {}, N.panel_census(rows, {}), 2)
    check("§15 public report discloses dependence and names the cleared algorithms",
          "NOT independent controls" in out.getvalue()
          and "named nulls cleared on eng: line_final_permutation, line_permutation"
          in out.getvalue())


def s16_observation_is_shared_but_every_null_is_measured():
    """M-244: the unchanged observation is work, not another null draw."""
    from collections import Counter
    from dataclasses import asdict
    from unittest.mock import patch
    print("\n§16 one observation per schema/statistic set, every replicate retained")
    schemas = {name: R.REGISTRY[name] for name in ("perfect rhyme", "assonance")}
    phon = get_phonology("eng")
    lines = ["we saw the cat", "he wore a hat", "she held a bat", "we found a mat"]
    calls = []
    original = N._measure

    def measured(stream, schema, statistics, *args):
        calls.append((stream, schema.name, tuple(s.name for s in statistics)))
        return original(stream, schema, statistics, *args)

    for derived in (False, True):
        calls.clear()
        with patch.object(N, "_measure", measured):
            together, census = N.sweep(lines, phon, "eng", schemas=schemas,
                                      n=2, budget=None, derived_only=derived)
        check(f"§16 derived_only={derived}: the positive fixture reaches observation and null judges",
              bool(calls) and bool(together))
        if not calls:
            continue
        observation = calls[0][0]
        observed_calls = Counter((name, stats) for stream, name, stats in calls
                                 if stream is observation)
        check(f"§16 derived_only={derived}: each observation coordinate measured once",
              bool(observed_calls) and all(v == 1 for v in observed_calls.values()),
              str(observed_calls))
        separate = []
        null_names = sorted({row.null for row in together if not isinstance(row, R.Refusal)})
        coordinates = {(r.null, r.schema, r.statistic) for r in together
                       if not isinstance(r, R.Refusal)}
        for null in null_names:
            rows, _ = N.sweep(lines, phon, "eng", schemas=schemas, n=2,
                              budget=None, nulls=[null])
            separate.extend(r for r in rows if not isinstance(r, R.Refusal)
                            and (r.null, r.schema, r.statistic) in coordinates)
        check(f"§16 derived_only={derived}: complete rows equal independently recomputed null arms",
              len(null_names) > 1 and [asdict(r) for r in together]
              == [asdict(r) for r in separate])
        expected = {(row.null, row.schema) for row in together
                    if not isinstance(row, R.Refusal)}
        check(f"§16 derived_only={derived}: every requested replicate still reaches the judge",
              sum(stream is not observation for stream, _, _ in calls) == 2 * len(expected))
        check(f"§16 derived_only={derived}: every schema remains in the census",
              {row.schema for row in census} == set(schemas))


def s17_parallel_panel_preserves_the_full_experiment():
    """A real sweep stays identical across schema groups; losses fail loudly."""
    from dataclasses import asdict, replace
    import tempfile
    print("\n§17 parallel panel changes execution width, never its experiment")
    names = ("perfect rhyme", "rime riche", "assonance", "consonance")
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8") as f:
        f.write("the cat sat by the sea\nthe hat lay by the tree\n")
        f.flush()
        sl = N.Slice("parallel-control", f.name, "eng", 2)
        whole = _panel_schema_worker((sl, names))
        nulls = tuple(name for name in N.NULLS if name != "identity")
        chunks = [_panel_schema_worker((sl, group, (null,)))
                  for group in _schema_groups(names, 2) for null in nulls]
        serial_panel = N.panel_sweep(root=ROOT, n=1, budget=None, panel=[sl])
        previous = os.environ.get("TEST_RELATIONS_NULL_WORKERS")
        os.environ["TEST_RELATIONS_NULL_WORKERS"] = "2"
        try:
            parallel_panel = _partition_panel_sweep([sl])
        finally:
            if previous is None:
                os.environ.pop("TEST_RELATIONS_NULL_WORKERS", None)
            else:
                os.environ["TEST_RELATIONS_NULL_WORKERS"] = previous
    rows, census = _merge_panel_parts(chunks, names)
    def canonical(rs):
        return [repr(asdict(row)) for row in rs]
    def census_values(cs):
        return [{k: v for k, v in asdict(c).items() if k != "seconds"} for c in cs]
    check("parallel partition retains every full-sweep result, including replicate values",
          canonical(rows) == canonical(whole[0]))
    check("parallel partition retains the full census (only measured seconds differ)",
          census_values(census) == census_values(whole[1]))
    check("real spawn workers retain the complete registry's sweep results",
          canonical([row for _, row in parallel_panel[0]])
          == canonical([row for _, row in serial_panel[0]]))
    check("real spawn workers retain the complete registry's panel census",
          census_values(parallel_panel[1][sl.name][1])
          == census_values(serial_panel[1][sl.name][1]))
    for label, bad in (("missing", chunks[:-1]), ("duplicate", chunks + chunks[:1])):
        try:
            _merge_panel_parts(bad, names)
        except ValueError:
            refused = True
        else:
            refused = False
        check(f"a {label} worker census refuses before panel assertions", refused)
    import copy
    drift = copy.deepcopy(chunks)
    drift[0][1][0] = replace(drift[0][1][0], instances=drift[0][1][0].instances + 1)
    unassigned = copy.deepcopy(chunks)
    changed = next(row for part in unassigned for row in part[0] if isinstance(row, N.Result))
    changed.null = "identity"
    duplicate_row = copy.deepcopy(chunks)
    source = next(part for part in duplicate_row if any(isinstance(row, N.Result) for row in part[0]))
    source[0].append(copy.deepcopy(next(row for row in source[0] if isinstance(row, N.Result))))
    for label, bad in (("census drift", drift), ("unassigned result", unassigned),
                       ("duplicate result", duplicate_row)):
        try:
            _merge_panel_parts(bad, names)
        except ValueError:
            refused = True
        else:
            refused = False
        check(f"{label} refuses instead of changing the experiment", refused)

    # The same real experiment with printed stanza ground and both declaration
    # steps: the original may be shared, every null must derive its own frame.
    from collections import Counter
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8") as f:
        f.write("\n".join(FIXTURE[:2]) + "\n\n" + "\n".join(FIXTURE[2:]) + "\n")
        f.flush()
        declared = N.Slice("parallel-declared-control", f.name, "eng", 4,
                           declare=("caesura:searched", "refrain:all_lines"))
        declared_names = names + ("leonine rhyme", "epistrophe / radif", "monorhyme / leash")
        reference = _panel_schema_worker((declared, declared_names))
        calls, phase = [], "original"
        original_realise = R.realise
        def _traced_realise(schema, stream, *args, **kwargs):
            calls.append((phase, schema.name))
            return original_realise(schema, stream, *args, **kwargs)
        R.realise = _traced_realise
        try:
            prepared = _prepare_panel_schema_worker((declared, declared_names))
            cached = []
            for phase in nulls:
                cached.append(_panel_schema_worker((declared, declared_names, (phase,), prepared)))
        finally:
            R.realise = original_realise
        merged, merged_census = _merge_panel_parts(cached, declared_names)
        check("prepared declaration/stanza results equal the unchanged production sweep exactly",
              canonical(merged) == canonical(reference[0]))
        check("prepared declaration/stanza census keeps every semantic field",
              census_values(merged_census) == census_values(reference[1]))
        check("every null carries the first real coverage measurement, never cache replay timing",
              all([c.seconds for c in part[1]] == [c.seconds for c in prepared["census"]]
                  for part in cached))
        live = {name for (name, _), (values, refusal) in prepared["observations"].items()
                if values is not None and refusal is None}
        expected_calls = Counter(("original", name) for name in declared_names)
        expected_calls.update((null, name) for null in nulls for name in live)
        check("realisation census measures each original once and every independent null separately",
              Counter(calls) == expected_calls)
        check("original preparation retains at most one schema and transports no raw realisations",
              prepared["peak_retained_schemas"] <= 1 and prepared["retained_realisations"] == 0
              and prepared["realised"] == {name: 1 for name in declared_names}
              and _panel_payload_bytes(prepared) > 0)
        wrong_signature = copy.deepcopy(prepared)
        wrong_signature["signature"]["seed"] += 1
        missing_observation = copy.deepcopy(prepared)
        missing_observation["observations"].pop(next(iter(missing_observation["observations"])))
        wrong_census = copy.deepcopy(prepared)
        wrong_census["census"] = wrong_census["census"][:-1]
        retained_object = copy.deepcopy(prepared)
        retained_object["raw"] = R.REGISTRY[declared_names[0]]
        for label, bad in (("changed original signature", wrong_signature),
                           ("missing observed statistics", missing_observation),
                           ("incomplete prepared census", wrong_census),
                           ("retained instrument object", retained_object)):
            try:
                _panel_schema_worker((declared, declared_names, (nulls[0],), bad))
            except ValueError:
                refused = True
            else:
                refused = False
            check(f"{label} refuses rather than silently recalculating or dropping work", refused)
        original_sweep = N.sweep
        def _duplicate_coverage(*args, **kwargs):
            result = original_sweep(*args, **kwargs)
            N.coverage(object(), schemas=kwargs["schemas"])
            return result
        N.sweep = _duplicate_coverage
        try:
            try:
                _panel_schema_worker((declared, declared_names, (nulls[0],), prepared))
            except ValueError:
                refused = True
            else:
                refused = False
        finally:
            N.sweep = original_sweep
        check("a second coverage stream cannot reclassify a replicate as the original", refused)


_SECTIONS = (
    s1_partition,
    s2_reader,
    s3_declarations,
    s4_prepare_per_replicate,
    s5_cleared,
    s6_false_clears,
    s7_unknown_step,
    s8_missing_corpus,
    s9_blockers,
    s10_missing_complete,
    s11_refused_replicates,
    s12_the_page_derivation_never_runs_on_a_token_join,
    s13_the_census_keeps_the_refusal_kind,
    s14_the_void_replicate_is_its_own_count,
    s15_blocker_kinds,
    s15_named_nulls_are_not_independent_evidence,
    s16_observation_is_shared_but_every_null_is_measured,
    s17_parallel_panel_preserves_the_full_experiment,
)


def main():
    print("=" * 74)
    print("RELATIONS NULLS · SECTION 9 (THE PANEL) — regressions")
    print("=" * 74)
    from quality.shard import run_sections
    result = run_sections(_SECTIONS, "TEST_RELATIONS_NULL_SHARD", FAIL,
                          footer="all relations-null regressions pass")
    print("\n" + "=" * 74)
    print(f"  {len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        for f in FAIL:
            print(f"    FAILED: {f}")
    print("=" * 74)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
