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
- `edit_unbound`: an edit where the grader binds NO syllable (for example
  the default end replacing an unreadable last word). FAIL, since revision
  3.1 (3PO, #527 6162609268): a named literal endpoint is weaker than a
  grader-bound occurrence, and a relaxed policy needs an explicit decision.
  Revision 3.0 counted it apart as a policy residual;
- `refused_bound`, `refused_unbound`: the swap declines where the grader
  binds a word, or binds none;
- `no_word_refused`: the slot names no token in the line, the grader binds
  none and the swap declines;
- `resolver_mismatch`: the oracle cannot place the binding. CANNOT TELL.

Every case record carries the raw half-open spans and text of the named,
bound and edited token, and `same_spelling`: the raw spans of every OTHER
token in the line with the bound (or, if none, the edited) token's folded
spelling, so a repeated word's occurrence is identified by its raw piece,
never by its spelling.

CONTROLS, all required to read `occ_agree`:
- v2's 12 no-aside controls, in every mode;
- READABLE CONTROLS (3.1): lines where the literal slot word is unreadable,
  a numeral, a dash fragment or an aside, or repeated, and the grader binds a
  readable word (R2's SlotBinding lines among them). Required in the process
  scheme's modes; their v1 outcomes are reported apart as legacy behaviour.

DECLARED OCCURRENCE READINGS (3.1). Each case declares readings
(`quality.pronunciation.validate_choices`, as `pin_readings` attaches them)
on chosen raw spans, in each mode's own token numbering, and runs the
production splice paths with that lexicon: `Reviser._splice` (the line
path's splice), `default_propose` (line) and `default_propose_group`
(group), each called with exactly the keywords production passes. The
edit must land on the occurrence `slots.resolve` binds under the declaring
lexicon; the outcomes are the ones above. A declaration a mode's cut cannot
hold (the target is a stripped aside) is reported, not run.

NEGATIVE CONTROLS:
- v2's two resolver rigs, which bind the first occurrence or mix in an
  untagged reading, must read `occ_wrong` and `resolver_mismatch`;
- the WRONG-OCCURRENCE SWAP rig. The real swap's edit is moved to another
  occurrence of the same spelling in the line, and the tool must read
  `occ_wrong`. A rig that cannot be built (the real swap refused, or there is
  no other occurrence) is CANNOT TELL, never a pass.

REVISION 3.3 pins each mode's MEASURED lexicon (`lexicons_measured`, with
the resolved `g2p_fallback`) and the default lexicon the negative controls
run on (`negative_control_lexicon`), and requires the three declared splice
paths: a missing one is unresolved (`declared_paths_missing`).

THE GATE (exit 0 PASS, 1 FAIL, 2 CANNOT TELL, 3 ERROR; FAIL dominates):
- PASS needs 0 `occ_wrong`, `unplaceable_edit`, `no_op_edit` and
  `edit_unbound` in every mode and every declared path, every control
  `occ_agree`, and every negative control caught;
- CANNOT TELL: a resolver mismatch, a negative control not caught or not
  runnable, an unexpected exclusion, or a production use not replicated.
- The receipt also gives a verdict per reader scheme (`gate_by_scheme`), so
  the process scheme's result is never read off a FAIL that only v1 holds,
  or the reverse.

Modes: asides stripped and sung under the process scheme, and, where the
lexicon has `with_reader_scheme`, the same two under v1.
"""
import copy, gzip, hashlib, importlib.util, inspect, json, os, subprocess, sys
from types import SimpleNamespace

_ARGS = [a for a in sys.argv[1:] if not a.startswith("--lexicons=")]
OUT, POP = _ARGS[0], _ARGS[1]
ROOT = os.path.abspath(_ARGS[2] if len(_ARGS) > 2 else os.getcwd())
#: 3.2: `--lexicons=VARIANT` runs the process scheme's modes under another
#: lexicon production can pass (see `_variant_lexes`); absent, the run is 3.1's.
VARIANT = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--lexicons=")), None)
VARIANTS = ("fb_high", "fb_low", "supp_none", "voices_fresh", "decl")
HERE = os.path.dirname(os.path.abspath(__file__))
TOOL_VERSION = "3.3"  # 3.2 + measured per-mode lexicon pins and asserted declared paths (3PO 6163840480)
#: 3.3: the three production splice paths the declared-reading cases must run
#: through; a missing one is unresolved, never skipped.
REQUIRED_PATHS = ("Reviser._splice", "default_propose", "default_propose_group")
FAILING = ("occ_wrong", "unplaceable_edit", "no_op_edit", "edit_unbound")
#: (line, slot): the real swap's edit is moved to another occurrence of the
#: same spelling; the oracle must call it occ_wrong.
WRONG_OCCURRENCE_CONTROLS = [
    ("love, love me do", "T2"), ("love, love me do", "T1"),
    ("hold me now and hold me tight", "T5"), ("hold me now and hold me tight", "T1"),
    ("the night and the day goes on", "T4"), ("do me a favour, do", "head"),
    ("do me a favour, do", "end"), ("Hold me now and hold me tight", "head"),
    ("I wind the wind", "end"), ("I wind the wind", "T2"),
]
#: (line, slot): the grader binds a READABLE word that is not always the
#: literal slot word; the edit must land on it.
READABLE_CONTROLS = [
    ("(1) An' teäke an' cut a lock o' frith, an' drow", "head"),
    ("(1) An' teäke an' cut a lock o' frith, an' drow", "headrime"),
    ("'Till the Canon atoned the deed,              _110", "endword"),
    ("Meinself--und Gott.", "head"),
    ("1 love you so", "T2"), ("1 love you so", "head"),
    ("do me a favour, do", "end"), ("do me a favour, do", "endword"),
    ("do me a favour, do", "T5"), ("do me a favour, do", "head"), ("do me a favour, do", "T1"),
    ("love, love me do", "T2"),
    ('"Abraham, forbear, (the angel cry\'d)', "endword"),
    ("O'er the parchment (not a rhyme),", "head"),
    ("You hold my heart.    10", "endword"),
    ("I wind the wind", "end"), ("I wind the wind", "T2"), ("I wind the wind", "T4"),
]
#: (line, [(raw start, raw end, phones)], slots): readings declared on raw
#: spans; each mode numbers the token itself.
DECLARED_CASES = [
    ("You hold my heart.    10", [(22, 24, ["T", "EH1", "N"])], ["end", "endword", "T5", "T4"]),
    ("zorp the zorp", [(9, 13, ["Z", "AO1", "R", "P"])], ["end", "endword", "head", "T1", "T3"]),
    ("(1) An' teäke an' cut a lock o' frith, an' drow", [(1, 2, ["W", "AH1", "N"])], ["head", "headrime", "T1", "T2"]),
    ("O'er the parchment (not a rhyme),", [(0, 4, ["AO1", "R"])], ["head", "T1", "endword"]),
    ("I wind the wind", [(2, 6, ["W", "AY1", "N", "D"]), (11, 15, ["W", "IH1", "N", "D"])], ["end", "endword", "T2", "T4", "head"]),
    ("Wind--wind, wind my vrexl", [(6, 10, ["W", "IH1", "N", "D"]), (20, 25, ["V", "R", "EH1", "K", "S", "AH0", "L"])],
     ["end", "endword", "head", "T2", "T3"]),
    ("Meinself--und Gott.", [(0, 8, ["M", "AY1", "N", "S", "EH0", "L", "F"])], ["head", "T1", "end"]),
]
#: the second member of every declared group proposal: readable, no aside
GROUP_PARTNER = ("love, love me do", "T2")


def _sha(p):
    with open(p, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def _lex_pin(l, LH):
    """-> the MEASURED lexicon's identity (3.3): class, the resolved G2P
    fallback (`g2p_fallback`, with its `min_confidence`), the supplement
    (id, path, sha256, rows), the aside rule, the reader scheme and the
    number of declared readings it holds."""
    fb = getattr(l, "g2p_fallback", None)
    sp = getattr(l, "supplement_path", None)
    return {"class": type(l).__name__,
            "g2p_fallback": None if fb is None else {"class": type(fb).__name__,
                                                     "min_confidence": getattr(fb, "min_confidence", None),
                                                     "min_rank": getattr(fb, "min_rank", None)},
            "supplement": None if sp is None else {"id": getattr(l, "supplement_id", None),
                                                    "path": os.path.relpath(sp, ROOT),
                                                    "sha256": getattr(l, "supplement_sha256", None) or _sha(sp),
                                                    "rows": getattr(l, "supplement_rows", None)},
            "strip_parens": l.strip_parens,
            "reader_scheme": LH._scheme_of(l) if hasattr(LH, "_scheme_of") else None,
            "declared_readings": len(getattr(l, "pronunciations", ()) or ())}


def _variant_lexes(variant, lines, sb, LH, build_lexicon):
    """-> {mode: lexicon} for the process scheme only, under a lexicon
    production can pass but the default run never builds. Ported from the
    tool-review skeptic's `probe_lexicons.py` (slot_occurrence_61b6618a/
    skeptics.json):
    - fb_high / fb_low: `build_lexicon("v2", "high"|"low")`;
    - supp_none: `build_lexicon("none", "none")`;
    - voices_fresh: a freshly built `SupplementedLexicon(version="v2",
      strip_parens=False)` for the sung mode, not a copy;
    - decl: in each mode, a declared reading on the first and last unreadable
      token of every population line, and a distinct reading on the last
      occurrence of each repeated readable word, validated with
      `validate_choices` 128 rows at a time; rows it refuses are counted and
      left out. One lexicon then holds every line's declarations, which
      `for_line` scopes to its line, as a song's own declarations are.
    """
    from quality import lexicon_supplement as LS
    from quality.pronunciation import validate_choices
    import collections

    def sung_copy(lex):
        out = copy.copy(lex)
        out.strip_parens = False
        return out
    if variant in ("fb_high", "fb_low"):
        b = build_lexicon("v2", variant[3:])
        return {"cur:stripped": b, "cur:sung": sung_copy(b)}, {}
    if variant == "supp_none":
        b = build_lexicon("none", "none")
        return {"cur:stripped": b, "cur:sung": sung_copy(b)}, {}
    if variant == "voices_fresh":
        return {"cur:sung": LS.SupplementedLexicon(version="v2", strip_parens=False)}, {}
    if variant != "decl":
        raise SystemExit(f"--lexicons= takes one of {VARIANTS}")
    out, info = {}, {}
    for m, strip in (("cur:stripped", True), ("cur:sung", False)):
        lex = LS.SupplementedLexicon(version="v2", strip_parens=strip)
        rows = []
        for line in lines:
            if not sb._spans(line, strip, lex):
                continue
            toks = LH.line_tokens(line, strip_parens=strip, scheme=LH._scheme_of(lex))
            readable = {x["widx"] for x in LH.word_syllable_map(lex, line) if x.get("widx") is not None}
            un = [i for i in range(len(toks)) if i not in readable]
            pick = sorted(set(un[:1] + un[-1:]))
            for i in pick:
                rows.append({"line": line, "token": i + 1, "word": toks[i], "phones": ["Z", "IY1", "K", "S"],
                             "basis": "declared", "source": "BB8 probe: make an unreadable token readable"})
            seen = collections.Counter(t.lower() for t in toks)
            rep = [i for i, t in enumerate(toks) if seen[t.lower()] > 1 and i in readable]
            if rep and rep[-1] not in pick:
                rows.append({"line": line, "token": rep[-1] + 1, "word": toks[rep[-1]],
                             "phones": ["M", "AA1", "R", "K"], "basis": "declared",
                             "source": "BB8 probe: an occurrence-scoped reading"})
        good, bad = [], 0
        for k in range(0, len(rows), 128):
            try:
                good += validate_choices(rows[k:k + 128], lex)
            except ValueError:
                for r in rows[k:k + 128]:
                    try:
                        good += validate_choices([r], lex)
                    except ValueError:
                        bad += 1
        lex.pronunciations = good
        out[m] = lex
        info[m] = {"declarations": len(good), "refused": bad}
    return out, info


def main():
    sys.path.insert(0, ROOT)
    os.chdir(ROOT)
    import lyric_harness as LH
    from quality import slots as SL
    from quality import loop as LOOP
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
    scheme_of = lambda m: m.split(":")[0]

    def classify(line, slot, lex, spans, new, mark):
        named = sb._named(slot, spans)
        bound = sb._bound(lex, line, slot, spans)
        if new is not None and new == line:
            return "no_op_edit", named, bound if bound != "mismatch" else None, None
        if bound == "mismatch":
            return "resolver_mismatch", named, None, None
        if new is None:
            if bound is None and named is None:
                return "no_word_refused", named, bound, None
            return ("refused_unbound" if bound is None else "refused_bound"), named, bound, None
        edited = sb._edited(line, new, mark, spans)
        if edited is None:
            return "unplaceable_edit", named, bound, None
        if bound is None:
            return "edit_unbound", named, bound, edited
        return ("occ_agree" if tuple(edited) == tuple(bound) else "occ_wrong"), named, bound, edited

    def occurrence(line, slot, lex, spans, swap=None):
        mark = sb._mark(line)
        swap = swap or (lambda: swap_at_slot(line, SL.parse_slot(f"1.{slot}"), mark, **swap_kw(lex)))
        new = swap()
        k, named, bound, edited = classify(line, slot, lex, spans, new, mark)
        return k, named, bound, edited, new

    def pick(s, line):
        return None if not s or s == "mismatch" else {"span": list(s), "text": line[s[0]:s[1]]}

    def same_spelling(line, spans, s):
        if not s or s == "mismatch":
            return []
        w = sb._fold(line[s[0]:s[1]])
        return [list(x) for _, x in spans if tuple(x) != tuple(s) and sb._fold(line[x[0]:x[1]]) == w]

    def record(line, mode, slot, k, named, bound, edited, new, **extra):
        ref = bound if bound and bound != "mismatch" else edited
        return {"line": line, "mode": mode, "slot": slot, "occurrence": k, **extra,
                "named": pick(named, line), "bound": pick(bound, line), "edited": pick(edited, line),
                "same_spelling": same_spelling(line, sb._spans(line, lexes[mode].strip_parens, lexes[mode]) or [], ref)
                if mode in lexes else [], "result": new}

    lines = [l for l in open(POP, encoding="utf-8").read().split("\n") if l]
    variant_info = {}
    if VARIANT:
        lexes, variant_info = _variant_lexes(VARIANT, lines, sb, LH, build_lexicon)
    tally = {m: {} for m in lexes}
    admitted = 0
    admitted_by = {m: 0 for m in lexes}
    excluded = {"transformed": 0, "not_reproduced": 0}
    fails = []
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
                admitted += 1
                admitted_by[m] += 1
                for slot in sb.SLOTS:
                    k, named, bound, edited, new = occurrence(line, slot, lex, sp)
                    lit = sb._classify(line, slot, lex, sp)[0]
                    tally[m][k] = tally[m].get(k, 0) + 1
                    rec = record(line, m, slot, k, named, bound, edited, new, literal=lit)
                    gz.write(json.dumps(rec, ensure_ascii=False) + "\n")
                    if (k in FAILING or k == "resolver_mismatch") and len(fails) < 400:
                        fails.append(rec)

    def control_rows(pairs):
        out = []
        for line, slot in pairs:
            for m, lex in lexes.items():
                sp = sb._spans(line, lex.strip_parens, lex)
                if not sp:
                    out.append({"line": line, "slot": slot, "mode": m, "occurrence": "unmapped"})
                    continue
                k, named, bound, edited, new = occurrence(line, slot, lex, sp)
                out.append(record(line, m, slot, k, named, bound, edited, new))
        return out
    controls = control_rows(sb.CONTROLS)
    readable = control_rows(READABLE_CONTROLS)

    # DECLARED OCCURRENCE READINGS through the production splice paths.
    from quality.pronunciation import validate_choices
    try:
        from quality.revise import Reviser
        splice = getattr(Reviser, "_splice", None)
    except ImportError:
        splice = None
    paths = {}
    if splice is not None:
        paths["Reviser._splice"] = lambda lex, text, slot, word: splice(SimpleNamespace(lex=lex), text, slot, word)

    def _kw_for(fn, lex):
        names = inspect.signature(fn).parameters
        return {k: v for k, v in swap_kw(lex).items() if k in names}

    def via_line(lex, text, slot, word):
        brief = SimpleNamespace(text=text, slot=slot, line_no=1, candidates=[word])
        return LOOP.default_propose(brief, [text], 0, **_kw_for(LOOP.default_propose, lex))

    def via_group(lex, text, slot, word):
        p_line, p_slot = GROUP_PARTNER
        props = {1: (text, word, slot), 2: (p_line, sb._mark(p_line), SL.parse_slot(f"1.{p_slot}"))}
        gb = SimpleNamespace(members=(1, 2), proposal_for=lambda m: props[m])
        out = LOOP.default_propose_group(gb, **_kw_for(LOOP.default_propose_group, lex))
        return None if out is None else out[0]
    if hasattr(LOOP, "default_propose"):
        paths["default_propose"] = via_line
    if hasattr(LOOP, "default_propose_group"):
        paths["default_propose_group"] = via_group
    paths_missing = [p for p in REQUIRED_PATHS if p not in paths]
    declared = []
    for line, targets, slots in DECLARED_CASES:
        for m, lex in lexes.items():
            sp = sb._spans(line, lex.strip_parens, lex)
            if not sp:
                declared.append({"line": line, "mode": m, "occurrence": "unmapped"})
                continue
            rows, missing = [], []
            for a, b, phones in targets:
                idx = [i for i, (_, s) in enumerate(sp) if tuple(s) == (a, b)]
                if not idx:
                    missing.append([a, b])
                    continue
                rows.append({"line": line, "token": idx[0] + 1, "word": sp[idx[0]][0], "phones": phones,
                             "basis": "declared", "source": "BB8 acceptance probe: declared occurrence reading"})
            dlex = copy.copy(lex)
            try:
                dlex.pronunciations = validate_choices(rows, dlex)
            except ValueError as exc:
                declared.append({"line": line, "mode": m, "occurrence": "declaration_refused", "error": str(exc),
                                 "rows": rows})
                continue
            for slot in slots:
                for pname, fn in paths.items():
                    mark = sb._mark(line)
                    try:
                        new = fn(dlex, line, SL.parse_slot(f"1.{slot}"), mark)
                    except Exception as exc:  # noqa: BLE001 -- reported, never a pass
                        declared.append({"line": line, "mode": m, "slot": slot, "path": pname,
                                         "occurrence": "path_error", "error": f"{type(exc).__name__}: {exc}"})
                        continue
                    k, named, bound, edited = classify(line, slot, dlex, sp, new, mark)
                    rec = record(line, m, slot, k, named, bound, edited, new, path=pname,
                                 declared=[[r["token"], r["word"]] for r in rows], declared_not_in_cut=missing)
                    declared.append(rec)

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
    ctrl_failed = [c for c in controls if c["occurrence"] not in ("occ_agree", "unmapped", "resolver_mismatch")]
    ctrl_unres = [c for c in controls if c["occurrence"] in ("unmapped", "resolver_mismatch")]
    read_cur = [c for c in readable if scheme_of(c["mode"]) == "cur"]
    read_failed = [c for c in read_cur if c["occurrence"] not in ("occ_agree", "unmapped", "resolver_mismatch")]
    read_unres = [c for c in read_cur if c["occurrence"] in ("unmapped", "resolver_mismatch")]
    decl_failed = [d for d in declared if d["occurrence"] in FAILING + ("path_error", "declaration_refused")]
    decl_unres = [d for d in declared if d["occurrence"] in ("resolver_mismatch", "unmapped")]

    intended = len(lines) * len(lexes)
    accounted = (admitted + excluded["transformed"] + excluded["not_reproduced"] == intended
                 and all(sum(tally[m].values()) == sum(1 for _ in sb.SLOTS) * (admitted_by[m]) for m in lexes))

    def verdict(schemes):
        f, u = {}, {}
        for m in lexes:
            if scheme_of(m) not in schemes:
                continue
            for k in FAILING:
                if tally[m].get(k):
                    f[f"{m}:{k}"] = tally[m][k]
            if tally[m].get("resolver_mismatch"):
                u[f"{m}:resolver_mismatch"] = tally[m]["resolver_mismatch"]
        sel = lambda rows: [r for r in rows if scheme_of(r["mode"]) in schemes]
        if sel(ctrl_failed):
            f["controls_failed"] = len(sel(ctrl_failed))
        if sel(read_failed):
            f["readable_controls_failed"] = len(sel(read_failed))
        if sel(decl_failed):
            f["declared_paths_failed"] = len(sel(decl_failed))
        if sel(ctrl_unres):
            u["controls_unresolved"] = len(sel(ctrl_unres))
        if sel(read_unres):
            u["readable_controls_unresolved"] = len(sel(read_unres))
        if sel(decl_unres):
            u["declared_paths_unresolved"] = len(sel(decl_unres))
        if paths_missing:
            u["declared_paths_missing"] = len(paths_missing)
        if neg_failed:
            u["negative_controls_failed"] = len(neg_failed)
        if excluded["not_reproduced"] or not accounted:
            u["coverage_lost"] = excluded["not_reproduced"]
        if odd or other:
            u["production_use_not_replicated"] = len(odd) + len(other)
        return ("FAIL" if f else "CANNOT TELL" if u else "PASS"), f, u
    gate, failures, unresolved = verdict({"cur", "v1"})
    by_scheme = {s: dict(zip(("gate", "failures", "unresolved"), verdict({s})))
                 for s in sorted({scheme_of(m) for m in lexes})}
    git = lambda d, *a: subprocess.run(["git", "-C", d, *a], capture_output=True, text=True)
    commit = git(ROOT, "rev-parse", "HEAD").stdout.strip() or None
    # Dirty state of the MEASURED tree (tracked files only), and of this
    # tool's own files in the repository that holds them.
    st = git(ROOT, "status", "--porcelain", "--untracked-files=no")
    tracked_changes = None if commit is None or st.returncode else bool(st.stdout.strip())
    own = git(HERE, "status", "--porcelain", "--", os.path.basename(__file__), "slot_binding.py")
    tool_state = None if own.returncode else (own.stdout.strip() or "committed, unchanged")
    rec = {"gate": gate, "failures": failures, "unresolved": unresolved, "gate_by_scheme": by_scheme,
           "outcomes": tally, "excluded_line_modes": excluded,
           "controls_failed": ctrl_failed, "controls_unresolved": ctrl_unres, "controls": controls,
           "readable_controls": readable, "readable_controls_failed": read_failed,
           "readable_controls_v1_legacy": [c for c in readable if scheme_of(c["mode"]) == "v1"],
           "declared": declared, "declared_failed": decl_failed, "declared_unresolved": decl_unres,
           "declared_paths": list(paths), "declared_paths_missing": paths_missing,
           "negative_controls": negatives, "negative_controls_failed": neg_failed,
           "production_calls": calls, "production_uses_not_replicated": {"calls": odd, "other_references": other},
           "pins": {"commit": commit, "tracked_changes": tracked_changes, "harness_root": ROOT,
                    "tool_version": TOOL_VERSION, "tool_git_state": tool_state,
                    "tool_sha256": _sha(os.path.abspath(__file__)),
                    "slot_binding_sha256": _sha(os.path.join(HERE, "slot_binding.py")),
                    "loop_sha256": _sha(os.path.join(ROOT, "quality", "loop.py")),
                    "revise_sha256": _sha(os.path.join(ROOT, "quality", "revise.py")),
                    "swap_keywords_replicated": list(kws), "modes": list(lexes),
                    "loop_word_re": WR is not None,
                    "lexicons_measured": {m: _lex_pin(l, LH) for m, l in lexes.items()},
                    "negative_control_lexicon": dict(_lex_pin(base, LH), note=(
                        "the default lexicon, build_lexicon('v2', 'none'), asides stripped: the negative controls "
                        "run on it in every run, a --lexicons= run included")),
                    "cmudict_sha256": _sha(LH.CMUDICT_PATH)
                    if os.path.exists(getattr(LH, "CMUDICT_PATH", "")) else None,
                    "lexicon_variant": None if not VARIANT else {"variant": VARIANT, "declarations": variant_info},
                    "population_accounted": {"intended_line_modes": intended, "admitted": admitted,
                                             "excluded": dict(excluded), "accounted": accounted},
                    "population": {"path": os.path.basename(POP), "lines": len(lines),
                                   "sha256": hashlib.sha256("\n".join(lines).encode()).hexdigest(),
                                   "sha256_note": "of the non-empty lines joined by newlines",
                                   "file_sha256": _sha(POP)}},
           "failing_cases": fails}
    with open(OUT + ".json", "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
    print(json.dumps({k: rec[k] for k in ("gate", "failures", "unresolved", "excluded_line_modes")}
                     | {"gate_by_scheme": {s: v["gate"] for s, v in by_scheme.items()},
                        "negatives": [(n["rig"], n["slot"], n["kind"]) for n in negatives],
                        "controls_failed": len(ctrl_failed), "readable_failed": len(read_failed),
                        "declared": {k: sum(1 for d in declared if d["occurrence"] == k)
                                     for k in sorted({d["occurrence"] for d in declared})}}, indent=1))
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
