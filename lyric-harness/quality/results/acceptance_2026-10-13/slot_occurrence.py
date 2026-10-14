"""Slot binding by OCCURRENCE (tool v3): does the reviser's edit land on the
exact raw span the grader binds?

    cd <tree>/lyric-harness
    python3 <this dir>/slot_occurrence.py OUT_PREFIX POPULATION.txt [HARNESS_ROOT]

writes OUT_PREFIX.json (the gate, controls, counts, pins) and
OUT_PREFIX.jsonl.gz (one record per line x slot x mode, with raw spans).

WHY A THIRD VERSION, AND WHAT IT KEEPS. `slot_binding.py` (v2) is unchanged
and its receipts stand, the FAIL at 67889851 included. Its verdict compares
the edit with the LITERAL slot word (first, last or n-th token). From
reader-batch head 58de1816 on, the reviser's contract for non-default slots
under v2 is to replace the token the grader binds (the `widx`
`slots.resolve` puts on the bound syllables), which is not always the
literal word. So this tool reports two verdicts per case:
- `occurrence`, the gate: the edited span against the grader-bound span, both
  as raw half-open offsets in the line, so another occurrence of the same
  spelling can never pass;
- `literal`: v2's own kind for the same case (`slot_binding._classify`),
  for continuity with the earlier receipts.

WHAT IT REUSES. `slot_binding.py`'s `_spans`, `_named`, `_bound`, `_edited`,
`_mark`, `_production_uses`, CONTROLS and NEGATIVE_CONTROLS, unchanged. The
one difference is in replication: production now passes
`swap_at_slot(text, slot, word, scheme=..., strip_parens=..., lex=...)` at
every call site, so `lex` joins the replicated keywords, with the grading
lexicon itself as its value (as `revise.py`'s `_splice` passes `self.lex`).
A call site with any other shape stays `production_use_not_replicated`.

OCCURRENCE OUTCOMES:
- `occ_agree`: edited span == bound span;
- `occ_wrong`: both exist and differ, another word or another occurrence of
  the same spelling. FAIL;
- `unplaceable_edit`: the swap returned a line that no single-span
  replacement reproduces. FAIL;
- `no_op_edit`: the swap returned the line unchanged. FAIL;
- `edit_unbound`: an edit where the grader binds no word. This is counted
  and listed as the policy residual, not failed (for example the default end
  replacing an unreadable last word);
- `refused_bound`, `refused_unbound`: the swap declines where the grader
  binds a word, or binds none;
- `no_word_refused`: the slot names no token in the line, the grader binds
  none and the swap declines;
- `resolver_mismatch`: the oracle cannot place the binding. CANNOT TELL.

NEGATIVE CONTROLS:
- v2's two resolver rigs, which bind the first occurrence or mix in an
  untagged reading, must read `occ_wrong` and `resolver_mismatch`;
- NEW, the WRONG-OCCURRENCE SWAP rig. The real swap's edit is moved to
  another occurrence of the same spelling in the line, and the tool must read
  `occ_wrong`. A rig that cannot be built (the real swap refused, or there is
  no other occurrence) is CANNOT TELL, never a pass.

THE GATE (exit 0 PASS, 1 FAIL, 2 CANNOT TELL, 3 ERROR; FAIL dominates):
- PASS needs 0 `occ_wrong`, 0 `unplaceable_edit` and 0 `no_op_edit` in every
  mode, every control `occ_agree` in every mode, and every negative control
  caught;
- CANNOT TELL: a resolver mismatch, a negative control not caught or not
  runnable, an unexpected exclusion, or a production use not replicated.

Modes: asides stripped and sung under the process scheme, and, where the
lexicon has `with_reader_scheme`, the same two under v1.
"""
import copy, gzip, hashlib, importlib.util, json, os, subprocess, sys

OUT, POP = sys.argv[1], sys.argv[2]
ROOT = os.path.abspath(sys.argv[3] if len(sys.argv) > 3 else os.getcwd())
HERE = os.path.dirname(os.path.abspath(__file__))
TOOL_VERSION = 3
#: (line, slot): the real swap's edit is moved to another occurrence of the
#: same spelling; the oracle must call it occ_wrong.
WRONG_OCCURRENCE_CONTROLS = [
    ("love, love me do", "T2"), ("love, love me do", "T1"),
    ("hold me now and hold me tight", "T5"), ("hold me now and hold me tight", "T1"),
    ("the night and the day goes on", "T4"), ("do me a favour, do", "head"),
    ("do me a favour, do", "end"), ("Hold me now and hold me tight", "head"),
]


def _sha(p):
    with open(p, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def main():
    sys.path.insert(0, ROOT)
    os.chdir(ROOT)
    import lyric_harness as LH
    from quality import slots as SL
    from quality.coverage_census import build_lexicon
    from quality.loop import swap_at_slot
    try:
        from quality.loop import _WORD_RE as WR
    except ImportError:
        WR = None
    spec = importlib.util.spec_from_file_location("sb", os.path.join(HERE, "slot_binding.py"))
    sb = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sb)
    sb.LH, sb.SL, sb.swap_at_slot, sb.LOOP_WORD_RE, sb.ROOT = LH, SL, swap_at_slot, WR, ROOT
    sb.REPLICATED_KEYWORDS = {"scheme", "strip_parens", "lex"}
    calls, odd, other, kws = sb._production_uses()
    sb.SWAP_KEYWORDS = kws
    v2_kw = sb._swap_kw

    def swap_kw(lex):
        out = v2_kw(lex)
        if "lex" in kws:
            out["lex"] = lex
        return out
    sb._swap_kw = swap_kw

    base = build_lexicon("v2", "none")
    sung = copy.copy(base)
    sung.strip_parens = False
    lexes = {"cur:stripped": base, "cur:sung": sung}
    if hasattr(base, "with_reader_scheme"):
        v1 = base.with_reader_scheme("v1")
        v1s = copy.copy(v1)
        v1s.strip_parens = False
        lexes.update({"v1:stripped": v1, "v1:sung": v1s})

    def occurrence(line, slot, lex, spans, swap=None):
        mark = sb._mark(line)
        swap = swap or (lambda: swap_at_slot(line, SL.parse_slot(f"1.{slot}"), mark, **swap_kw(lex)))
        new = swap()
        named = sb._named(slot, spans)
        bound = sb._bound(lex, line, slot, spans)
        if new is not None and new == line:
            return "no_op_edit", named, bound, None, new
        if bound == "mismatch":
            return "resolver_mismatch", named, None, None, new
        if new is None:
            if bound is None and named is None:
                return "no_word_refused", named, bound, None, new
            return ("refused_unbound" if bound is None else "refused_bound"), named, bound, None, new
        edited = sb._edited(line, new, mark, spans)
        if edited is None:
            return "unplaceable_edit", named, bound, None, new
        if bound is None:
            return "edit_unbound", named, bound, edited, new
        return ("occ_agree" if tuple(edited) == tuple(bound) else "occ_wrong"), named, bound, edited, new

    lines = [l for l in open(POP, encoding="utf-8").read().split("\n") if l]
    tally = {m: {} for m in lexes}
    excluded = {"transformed": 0, "not_reproduced": 0}
    fails = []
    pick = lambda s, line: None if not s or s == "mismatch" else {"span": list(s), "text": line[s[0]:s[1]]}
    with gzip.open(OUT + ".jsonl.gz", "wt", encoding="utf-8") as gz:
        for line in lines:
            for m, lex in lexes.items():
                sp = sb._spans(line, lex.strip_parens, lex)
                if sp is None or sp is False:
                    excluded["transformed" if sp is None else "not_reproduced"] += 1
                    gz.write(json.dumps({"line": line, "mode": m, "slot": None,
                                         "occurrence": "excluded_" + ("transformed" if sp is None else "not_reproduced")},
                                        ensure_ascii=False) + "\n")
                    continue
                for slot in sb.SLOTS:
                    k, named, bound, edited, new = occurrence(line, slot, lex, sp)
                    lit = sb._classify(line, slot, lex, sp)[0]
                    tally[m][k] = tally[m].get(k, 0) + 1
                    rec = {"line": line, "mode": m, "slot": slot, "occurrence": k, "literal": lit,
                           "named": pick(named, line), "bound": pick(bound, line) if bound != "mismatch" else "mismatch",
                           "edited": pick(edited, line), "result": new}
                    gz.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    if k in ("occ_wrong", "unplaceable_edit", "no_op_edit", "resolver_mismatch") and len(fails) < 300:
                        fails.append(rec)

    controls = []
    for line, slot in sb.CONTROLS:
        for m, lex in lexes.items():
            sp = sb._spans(line, lex.strip_parens, lex)
            controls.append({"line": line, "slot": slot, "mode": m,
                             "occurrence": occurrence(line, slot, lex, sp)[0] if sp else "unmapped"})
    real = SL.resolve
    negatives = []
    try:
        for line, slot, rig, _want in sb.NEGATIVE_CONTROLS:
            def resolve(lex_, line_, member, promote=False, rig=rig):
                anchors, label, oov = real(lex_, line_, member, promote=promote)
                toks = LH.line_tokens(line_, strip_parens=lex_.strip_parens)
                first = {t: toks.index(t) for t in toks}
                wrong = [[dict(s, widx=first.get(toks[s["widx"]], s["widx"])) for s in a] for a in anchors]
                if rig == "mixed_tags":
                    wrong = wrong[:1] + [[{k: v for k, v in s.items() if k != "widx"} for s in anchors[0]]]
                return wrong, label, oov
            SL.resolve = resolve
            want = "occ_wrong" if rig == "first_occurrence" else "resolver_mismatch"
            k = occurrence(line, slot, base, sb._spans(line, True, base))[0]
            negatives.append({"line": line, "slot": slot, "rig": rig, "expected": want, "kind": k})
    finally:
        SL.resolve = real
    for line, slot in WRONG_OCCURRENCE_CONTROLS:
        sp = sb._spans(line, True, base)
        mark = sb._mark(line)
        new = swap_at_slot(line, SL.parse_slot(f"1.{slot}"), mark, **swap_kw(base))
        ed = sb._edited(line, new, mark, sp) if new else None
        others = [s for _, s in (sp or []) if ed and tuple(s) != tuple(ed)
                  and line[s[0]:s[1]].lower() == line[ed[0]:ed[1]].lower()]
        if not others:
            negatives.append({"line": line, "slot": slot, "rig": "wrong_occurrence_swap", "expected": "occ_wrong",
                              "kind": "not_runnable"})
            continue
        a, b = others[0]
        rigged = line[:a] + sb._cased(line[a:b], mark) + line[b:]
        k = occurrence(line, slot, base, sp, swap=lambda r=rigged: r)[0]
        negatives.append({"line": line, "slot": slot, "rig": "wrong_occurrence_swap", "expected": "occ_wrong",
                          "kind": k, "real_edit": list(ed), "rigged_edit": [a, b]})

    neg_failed = [n for n in negatives if n["kind"] != n["expected"]]
    ctrl_failed = [c for c in controls if c["occurrence"] not in ("occ_agree", "unmapped")]
    ctrl_unres = [c for c in controls if c["occurrence"] == "unmapped"]
    failures = {f"{m}:{k}": tally[m][k] for m in lexes for k in ("occ_wrong", "unplaceable_edit", "no_op_edit")
                if tally[m].get(k)}
    if ctrl_failed:
        failures["controls_failed"] = len(ctrl_failed)
    unresolved = {f"{m}:resolver_mismatch": tally[m]["resolver_mismatch"] for m in lexes if tally[m].get("resolver_mismatch")}
    if neg_failed:
        unresolved["negative_controls_failed"] = len(neg_failed)
    if excluded["not_reproduced"]:
        unresolved["coverage_lost"] = excluded["not_reproduced"]
    if ctrl_unres:
        unresolved["controls_unresolved"] = len(ctrl_unres)
    if odd or other:
        unresolved["production_use_not_replicated"] = len(odd) + len(other)
    gate = "FAIL" if failures else "CANNOT TELL" if unresolved else "PASS"
    commit = subprocess.run(["git", "-C", ROOT, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip() or None
    rec = {"gate": gate, "failures": failures, "unresolved": unresolved,
           "policy_residual_edit_unbound": {m: tally[m].get("edit_unbound", 0) for m in lexes},
           "outcomes": tally, "excluded_line_modes": excluded,
           "controls_failed": ctrl_failed, "controls_unresolved": ctrl_unres, "controls": controls,
           "negative_controls": negatives, "negative_controls_failed": neg_failed,
           "production_calls": calls, "production_uses_not_replicated": {"calls": odd, "other_references": other},
           "pins": {"commit": commit, "harness_root": ROOT, "tool_version": TOOL_VERSION,
                    "tool_sha256": _sha(os.path.abspath(__file__)),
                    "slot_binding_sha256": _sha(os.path.join(HERE, "slot_binding.py")),
                    "loop_sha256": _sha(os.path.join(ROOT, "quality", "loop.py")),
                    "swap_keywords_replicated": list(kws), "modes": list(lexes),
                    "population": {"path": os.path.basename(POP), "lines": len(lines),
                                   "sha256": hashlib.sha256("\n".join(lines).encode()).hexdigest()}},
           "failing_cases": fails}
    with open(OUT + ".json", "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
    print(json.dumps({k: rec[k] for k in ("gate", "failures", "unresolved", "policy_residual_edit_unbound", "excluded_line_modes")}
                     | {"negatives": [(n["rig"], n["slot"], n["kind"]) for n in negatives],
                        "controls_failed": len(ctrl_failed)}, indent=1))
    return {"PASS": 0, "FAIL": 1, "CANNOT TELL": 2}[gate]


if __name__ == "__main__":
    try:
        code = main()
    except Exception as exc:  # noqa: BLE001 -- no verdict is never a FAIL
        import traceback
        traceback.print_exc()
        print(f"ERROR (no verdict): {type(exc).__name__}: {exc}", file=sys.stderr)
        code = 3
    sys.exit(code)
