"""Slot binding: does the revision loop edit the word the grader binds?

    python3 quality/results/acceptance_2026-10-13/slot_binding.py quality/results/acceptance_2026-10-13/slot_binding_fce4bf0f.json [HARNESS_ROOT]

R2's 1b v2 blocker (PR #519, 6151243417), and the case 3PO asked to be
measured at the pinned head (PR #527, 6151284267). Under `--voices`, the loop's
`swap_at_slot` cut the line with parenthesised asides stripped, while the grader
resolves the same slot through `slots.resolve`, which follows the lexicon's
aside rule. A head or `T<n>` slot after an aside could then edit a different
word from the one the grader binds.

For every line with a parenthesised aside, in both aside modes (asides stripped,
and asides sung as with `--voices`), and for EVERY slot in `SLOTS` (`end`,
`endword`, `head`, `headrime`, `T1` to `T8`), this compares three spans in the
line as the reader returns it. That is reader-returned text (stripped,
bracket-edited), NOT necessarily the untouched corpus file:
- **named**: the word the slot names in that mode's cut. `end` and `endword`
  are the last token, `head` and `headrime` the first, and `T<n>` the n-th. It
  is None when the mode has no such word;
- **bound**: the word the grader binds, read PHYSICALLY from the `widx` that
  `slots.resolve(lex, line, slot)` itself puts on the syllables it returns.
  Matching by spelling is not enough, because another occurrence of the same
  word would agree by text. The endpoint rule: an `end` or `endword` answer
  can span words, and its bound word holds the LAST syllable. A `head` or
  `headrime` answer's bound word holds the FIRST syllable. A `T<n>` answer
  must lie inside one word. Every reading must name the same word, and its
  syllables must spell that token. Otherwise the case is `resolver_mismatch`:
  the oracle cannot place it. A syllable with no `widx`, in any reading, is
  `resolver_mismatch` too. Nothing is ever placed by spelling or by contract
  (3PO, 6152225454);
- **edited**: the span `swap_at_slot` actually replaced. It is found by EXACT
  RECONSTRUCTION, never by diffing: the line with one candidate span replaced
  by the marker, cased as the loop cases it, must equal the returned line. The
  marker is chosen per line from `MARKS` so that it occurs nowhere in that line,
  which keeps a correct edit and an edit that did nothing distinguishable.
  Candidates are every span of the harness tokenizer and of the loop's own
  `_WORD_RE`, when the measured head still has it. A returned line that no
  single-span replacement reproduces is `wrong_word`. A returned line
  identical to the input is `no_op_edit`.

Outcomes:
- `agree`: edited = named = bound;
- `agree_unbound`: edited = named, and the grader binds nothing there, for
  example an unreadable word (replacing it is how a revision fixes it);
- `grader_elsewhere`: edited = named, but the grader binds a different word.
  FAILS the gate;
- `wrong_word`: the loop edits anything other than the named word, including an
  edit where the slot names no word in that mode. FAILS the gate;
- `no_op_edit`: the loop returned the line unchanged as if it had edited it.
  FAILS the gate;
- `refused`, `refused_unbound`, `refused_grader_elsewhere`, `no_word_refused`:
  the loop declines. That never edits a wrong word, so it doesn't fail the
  gate, but each is counted. A loop that refuses on every aside line passes
  this gate: the gate tests that edits land on the right word, not that the
  loop can edit aside lines. `agree` counts are reported so that's visible;
- `resolver_mismatch`: see above.

THE GATE (exit status 0 PASS, 1 FAIL, 2 CANNOT TELL, 3 ERROR). FAIL
DOMINATES: an established wrong edit is never hidden behind an unresolved
case, and the output always lists both `failures` and `unresolved`. CANNOT
TELL is the verdict only when nothing has failed.
- PASS needs 0 `wrong_word`, 0 `grader_elsewhere`, 0 `no_op_edit` and 0
  `resolver_mismatch` in both modes, and every REQUIRED CONTROL edit agreeing.
  The controls are no-aside lines, including a capitalised head, an all-caps
  line, `T5`, `endword` and `headrime`, where the loop must edit the bound word
  in both modes. A loop that refuses everything fails them;
- CANNOT TELL is returned when the oracle cannot vouch for itself:
  - a resolver mismatch;
  - a NEGATIVE CONTROL not caught. A resolver rigged to bind the first
    occurrence of a repeated word must come out `grader_elsewhere`. The same
    rig with a second, untagged reading must come out `resolver_mismatch`.
    Together they show the binding is checked by position, not spelling, and
    that a missing tag cannot hide a wrong one;
  - an unexpected exclusion: a line whose token spans could not be rebuilt
    exactly (`spans_not_reproduced`), or admitted line-modes not adding up to
    the intended population;
  - a required control that cannot be evaluated;
  - production using `swap_at_slot` in a way this tool does not replicate.
  The transformed-text exclusions are separate. They are disclosed, counted
  and not a CANNOT TELL;
- the production check: CANNOT TELL is also returned when production uses
  `swap_at_slot` in a way this tool does not replicate. That covers a call with
  arguments other than `(text, slot, word)`, a call under an alias, and any
  other reference such as passing it on. The tool calls it the way production
  does. Production call sites are read with `ast`, and no argument production
  might not pass is ever injected;
- ERROR (3) means no verdict: an import or run failure. It never reads as FAIL.

Lines that `join_spaced_enclitics` changes are excluded and counted, because
their token offsets would be in transformed text. Those inputs stay untested
here.

The output pins the tested commit and its tracked changes, the tool's own
sha256, `loop.py`'s sha256, the lexicon (class, supplement version and files,
CMUdict, fallback, reader scheme), the population digests and the evaluated
slot counts. `tracked_changes` is read before the output is written, and it
leaves out this tool's own folder, so re-running the documented command on a
clean checkout stays clean. Both `commit` and `tracked_changes` are None when
`HARNESS_ROOT` is not a git checkout.
"""
import ast, copy, glob, hashlib, json, os, re, subprocess, sys

ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else
                       os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
HERE_REL = "quality/results/acceptance_2026-10-13"

SYNTHETIC = [
    "(oh) love, love me do",
    "love, (oh) love me do",
    "I (said) love you so",
    "(and the) night and the day",
    "For (I said) I will bear me by thee",
    "the night (the night) and the day goes",
    "(ooh) baby, baby (ooh) baby",
    "hold me (hold me) closer now",
    "I love you (love you)",
    "hold on (hold on)",
    "(oh) zoom, zoom away",
]
#: REQUIRED CONTROL EDITS: no aside, so both modes cut the same; the loop must
#: replace exactly the bound word. A refuse-everything loop fails these.
CONTROLS = [
    ("love, love me do", "end"), ("love, love me do", "head"), ("love, love me do", "T2"),
    ("hold me closer now", "T3"), ("the night and the day goes", "T4"),
    ("zoom, zoom away", "T2"), ("I love you", "end"),
    ("the night and the day goes on", "T5"), ("Hold me now and hold me tight", "head"),
    ("HOLD ME NOW", "T2"), ("love, love me do", "endword"), ("love, love me do", "headrime"),
]
#: NEGATIVE CONTROLS: lines with a repeated word, read with a resolver
#: rigged to bind the word's FIRST occurrence. The oracle must call each one
#: `grader_elsewhere`.
NEGATIVE_CONTROLS = [
    # (line, slot, rig, the kind the oracle must report)
    ("love, love me do", "T2", "first_occurrence", "grader_elsewhere"),
    ("do me a favour, do", "end", "first_occurrence", "grader_elsewhere"),
    # one reading tagged with the WRONG occurrence, one with its tags removed:
    # the untagged reading must not let the wrong one through
    ("do me a favour, do", "end", "mixed_tags", "resolver_mismatch"),
    ("love, love me do", "T2", "mixed_tags", "resolver_mismatch"),
]
SLOTS = ["end", "endword", "head", "headrime"] + [f"T{n}" for n in range(1, 9)]
MARKS = ("zqzq", "qxqx", "vzvz", "xjxj")
PRODUCTION_FILES = ("quality/revise.py", "quality/loop.py", "lyric_harness.py")
FAILING = ("wrong_word", "grader_elsewhere", "no_op_edit", "resolver_mismatch")


def _sha(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def _git(*args):
    r = subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def _mark(line):
    low = line.lower()
    return next(m for m in MARKS if m not in low)


def _cased(old, mark):
    if old.isupper():
        return mark.upper()
    if old[:1].isupper():
        return mark.capitalize()
    return mark.lower()


def _spans(line, strip):
    """Reader-text spans of the line's tokens in this mode; None if the line
    is transformed by the enclitic join; False if not reproduced exactly."""
    if LH.join_spaced_enclitics(line) != line:
        return None
    on = [(m.group(), m.span()) for m in LH._TOKEN_RUN.finditer(line) if LH.LATIN_SCRIPT.search(m.group())]
    if strip:
        parens = [m.span() for m in re.finditer(r"\([^)]*\)", line)]
        on = [(w, s) for w, s in on if not any(a <= s[0] and s[1] <= b for a, b in parens)]
    return on if [w for w, _ in on] == LH.line_tokens(line, strip_parens=strip) else False


def _named(slot, spans):
    if not spans:
        return None
    if slot in ("end", "endword"):
        return spans[-1][1]
    if slot in ("head", "headrime"):
        return spans[0][1]
    i = int(slot[1:]) - 1
    return spans[i][1] if i < len(spans) else None


def _fold(w):
    return LH.normalise_word(w) if hasattr(LH, "normalise_word") else w.lower()


def _bound(lex, line, slot, spans):
    """-> the span the grader binds, read from the `widx` of the syllables
    `slots.resolve` itself returns; None if it binds nothing; 'mismatch' when
    the answer cannot be placed on exactly one word.

    ENDPOINT RULE. An `end` or `endword` answer can span words, since a rhyme
    runs from the last stress to the line's end. Its bound word is the one
    holding the answer's LAST syllable. A `head` or `headrime` answer's bound
    word holds its FIRST syllable. A `T<n>` answer must lie inside one word.
    Every reading must name the same word, and every syllable of that word in
    the answer must spell the token the span holds."""
    anchors, label, _ = SL.resolve(lex, line, SL.parse_slot(f"1.{slot}"))
    if not anchors:
        return None
    picks = set()
    for reading in anchors:
        w = [syl.get("widx") for syl in reading]
        if not reading or any(x is None for x in w):
            return "mismatch"
        if slot in ("end", "endword"):
            picks.add(w[-1])
        elif slot in ("head", "headrime"):
            picks.add(w[0])
        elif len(set(w)) != 1:
            return "mismatch"
        else:
            picks.add(w[0])
    if len(picks) != 1:
        return "mismatch"
    i = picks.pop()
    if not 0 <= i < len(spans):
        return "mismatch"
    word = spans[i][0]
    for reading in anchors:
        for syl in reading:
            if syl.get("widx") == i and syl.get("word") is not None and _fold(syl["word"]) != _fold(word):
                return "mismatch"
    return spans[i][1]


def _edited(line, new, mark):
    """-> the single span whose replacement reproduces `new` exactly, or None."""
    cands = {m.span() for m in LH._TOKEN_RUN.finditer(line)}
    if LOOP_WORD_RE is not None:
        cands |= {m.span() for m in LOOP_WORD_RE.finditer(line)}
    hits = [(a, b) for a, b in sorted(cands) if line[:a] + _cased(line[a:b], mark) + line[b:] == new]
    return hits[0] if len(hits) == 1 else None


def _production_uses():
    """Every production use of swap_at_slot: direct calls with their argument
    shape, calls under an alias, and any other reference."""
    calls, other = [], []
    for rel in PRODUCTION_FILES:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            tree = ast.parse(fh.read())
        aliases = {a.asname for n in ast.walk(tree) if isinstance(n, ast.ImportFrom)
                   for a in n.names if a.name == "swap_at_slot" and a.asname}
        call_funcs = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                f = node.func
                name = f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else None
                if name == "swap_at_slot" or name in aliases:
                    call_funcs.add(id(f))
                    calls.append({"file": rel, "line": node.lineno, "name": name, "positional": len(node.args),
                                  "keywords": sorted(k.arg or "**" for k in node.keywords),
                                  "starred": any(isinstance(a, ast.Starred) for a in node.args)})
        for node in ast.walk(tree):
            if isinstance(node, (ast.Name, ast.Attribute)) and id(node) not in call_funcs:
                name = node.id if isinstance(node, ast.Name) else node.attr
                if name == "swap_at_slot" or name in aliases:
                    other.append({"file": rel, "line": node.lineno, "name": name})
    odd = [c for c in calls if c["positional"] != 3 or c["keywords"] or c["starred"] or c["name"] != "swap_at_slot"]
    return calls, odd, other


def _classify(line, slot, lex, spans):
    mark = _mark(line)
    named = _named(slot, spans)
    new = swap_at_slot(line, SL.parse_slot(f"1.{slot}"), mark)
    if new is not None and new == line:
        return "no_op_edit", named, None, None, new
    if named is None:
        return ("no_word_refused" if new is None else "wrong_word"), None, None, None, new
    bound = _bound(lex, line, slot, spans)
    if bound == "mismatch":
        return "resolver_mismatch", named, None, None, new
    if new is None:
        kind = "refused" if bound == named else "refused_unbound" if bound is None else "refused_grader_elsewhere"
        return kind, named, bound, None, new
    edited = _edited(line, new, mark)
    if edited != tuple(named):
        return "wrong_word", named, bound, edited, new
    if bound is None:
        return "agree_unbound", named, bound, edited, new
    return ("agree" if tuple(bound) == tuple(named) else "grader_elsewhere"), named, bound, edited, new


def main():
    out = sys.argv[1]
    commit = _git("rev-parse", "HEAD")
    status = _git("status", "--porcelain", "--untracked-files=no", "--", ".", f":(exclude){HERE_REL}")
    dirty = None if status is None or commit is None else bool(status)
    base = build_lexicon("v2", "none")
    sung = copy.copy(base)
    sung.strip_parens = False
    lexes = {"asides_stripped": base, "asides_sung": sung}
    files = sorted(glob.glob(os.path.join(ROOT, "corpus", "song", "eng_*")))
    corpus = [t for f in files for t in LH.load_lyric_lines(f)
              if "(" in t and LH.line_tokens(t, strip_parens=False) != LH.line_tokens(t, strip_parens=True)]
    lines = [("synthetic", t) for t in SYNTHETIC] + [("corpus", t) for t in corpus]
    tally = {m: {} for m in lexes}
    evaluated = {m: 0 for m in lexes}
    excluded = {"spaced_enclitic_or_folded": 0, "spans_not_reproduced": 0}
    evaluated_line_modes = 0
    cases = []
    for source, line in lines:
        for mode, lex in lexes.items():
            spans = _spans(line, lex.strip_parens)
            if spans is None or spans is False:
                excluded["spaced_enclitic_or_folded" if spans is None else "spans_not_reproduced"] += 1
                continue
            evaluated_line_modes += 1
            for slot in SLOTS:
                kind, named, bound, edited, new = _classify(line, slot, lex, spans)
                evaluated[mode] += 1
                tally[mode][kind] = tally[mode].get(kind, 0) + 1
                if kind in FAILING:
                    cases.append({"kind": kind, "source": source, "line": line, "mode": mode, "slot": slot,
                                  "named": list(named) if named else None,
                                  "bound": list(bound) if bound else None,
                                  "edited": list(edited) if edited else None, "result": new})
    controls = []
    for line, slot in CONTROLS:
        for mode, lex in lexes.items():
            spans = _spans(line, lex.strip_parens)
            kind = _classify(line, slot, lex, spans)[0] if spans else "unmapped"
            controls.append({"line": line, "slot": slot, "mode": mode, "kind": kind})
    # NEGATIVE CONTROLS: rigged resolvers that bind ANOTHER OCCURRENCE OF THE
    # SAME WORD, fully tagged or mixed with an untagged reading, must never
    # read as agreement. If the oracle reports anything other than the
    # expected kind, it cannot vouch for itself, and the gate is CANNOT TELL.
    real = SL.resolve

    def rigged(rig):
        def resolve(lex_, line_, member, promote=False):
            anchors, label, oov = real(lex_, line_, member, promote=promote)
            toks = LH.line_tokens(line_, strip_parens=lex_.strip_parens)
            first = {t: toks.index(t) for t in toks}
            wrong = [[dict(syl, widx=first.get(toks[syl["widx"]], syl["widx"])) for syl in a] for a in anchors]
            if rig == "mixed_tags":
                untagged = [{k: v for k, v in syl.items() if k != "widx"} for syl in anchors[0]]
                wrong = wrong[:1] + [untagged]
            return wrong, label, oov
        return resolve
    negatives = []
    try:
        for line, slot, rig, want in NEGATIVE_CONTROLS:
            SL.resolve = rigged(rig)
            kind = _classify(line, slot, base, _spans(line, True))[0]
            negatives.append({"line": line, "slot": slot, "rig": rig, "expected": want, "kind": kind})
    finally:
        SL.resolve = real
    negatives_failed = [n for n in negatives if n["kind"] != n["expected"]]
    intended = len(lines) * len(lexes)
    admitted = intended - excluded["spaced_enclitic_or_folded"] - excluded["spans_not_reproduced"]
    population = {"intended_line_modes": intended, "admitted_line_modes": admitted,
                  "transformed_excluded": excluded["spaced_enclitic_or_folded"],
                  "unexpected_excluded": excluded["spans_not_reproduced"],
                  "accounted": admitted == evaluated_line_modes}
    calls, odd, other = _production_uses()
    failing = {m: {k: tally[m].get(k, 0) for k in FAILING} for m in lexes}
    controls_failed = [c for c in controls if c["kind"] != "agree"]
    unmapped_controls = [c for c in controls if c["kind"] == "unmapped"]
    # ESTABLISHED FAILURES are never hidden by an unresolved case: any wrong
    # edit makes the gate FAIL, and the unresolved reasons are listed beside
    # it. CANNOT TELL is the verdict only when nothing has failed.
    failures = {f"{m}:{k}": failing[m][k] for m in lexes for k in ("wrong_word", "grader_elsewhere", "no_op_edit")
                if failing[m][k]}
    if controls_failed and not unmapped_controls:
        failures["controls_failed"] = len(controls_failed)
    unresolved = {f"{m}:resolver_mismatch": failing[m]["resolver_mismatch"] for m in lexes
                  if failing[m]["resolver_mismatch"]}
    if negatives_failed:
        unresolved["negative_controls_failed"] = len(negatives_failed)
    if population["unexpected_excluded"] or not population["accounted"]:
        unresolved["coverage_lost"] = population["unexpected_excluded"]
    if unmapped_controls:
        unresolved["controls_unmapped"] = len(unmapped_controls)
    if odd or other:
        unresolved["production_use_not_replicated"] = len(odd) + len(other)
    gate = "FAIL" if failures else "CANNOT TELL" if unresolved else "PASS"
    supp = getattr(base, "supplement_path", None)
    rec = {
        "gate": gate, "failures": failures, "unresolved": unresolved,
        "pins": {
            "commit": commit, "tracked_changes": dirty, "harness_root": ROOT,
            "tool_sha256": _sha(os.path.abspath(__file__)),
            "loop_sha256": _sha(os.path.join(ROOT, "quality", "loop.py")),
            "loop_word_re": LOOP_WORD_RE is not None,
            "lexicon": {"class": type(base).__name__,
                        "supplement": {"version": "v2", "path": supp and os.path.relpath(supp, ROOT),
                                       "sha256": supp and _sha(supp)},
                        "reader_scheme": ({k: repr(v) for k, v in vars(base).items() if "scheme" in k.lower()}
                                          | {k: repr(getattr(LH, k)) for k in dir(LH)
                                             if "READER" in k and "SCHEME" in k}) or None,
                        "cmudict_sha256": _sha(LH.CMUDICT_PATH) if os.path.exists(getattr(LH, "CMUDICT_PATH", "")) else None,
                        "fallback": "none"},
            "population": {"corpus_lines": len(corpus), "synthetic_lines": len(SYNTHETIC),
                           "selected_lines": len(lines),
                           "corpus_sha256": hashlib.sha256("\n".join(corpus).encode()).hexdigest(),
                           "synthetic_sha256": hashlib.sha256("\n".join(SYNTHETIC).encode()).hexdigest(),
                           "controls": len(CONTROLS)},
            "slots": SLOTS, "marks": MARKS,
        },
        "production_calls": calls, "production_uses_not_replicated": {"calls": odd, "other_references": other},
        "excluded_line_modes": excluded, "evaluated_slots": evaluated,
        "outcomes": tally, "failing": failing,
        "population": population,
        "controls": controls, "controls_failed": controls_failed,
        "negative_controls": negatives, "negative_controls_failed": negatives_failed,
        "cases": cases[:200],
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(json.dumps({k: rec[k] for k in ("gate", "failures", "unresolved", "excluded_line_modes", "evaluated_slots", "outcomes",
                                          "production_uses_not_replicated")}
                     | {"population": population, "negative_controls_failed": len(negatives_failed),
                        "controls_failed": len(controls_failed),
                        "selected_lines": rec["pins"]["population"]["selected_lines"]}, indent=1))
    return {"PASS": 0, "FAIL": 1, "CANNOT TELL": 2}[gate]


if __name__ == "__main__":
    try:
        sys.path.insert(0, ROOT)
        import lyric_harness as LH  # noqa: E402
        from quality import slots as SL  # noqa: E402
        from quality.coverage_census import build_lexicon  # noqa: E402
        from quality.loop import swap_at_slot  # noqa: E402
        try:
            from quality.loop import _WORD_RE as LOOP_WORD_RE  # noqa: E402
        except ImportError:
            LOOP_WORD_RE = None
        code = main()
    except Exception as exc:  # noqa: BLE001 -- no verdict is never a FAIL
        print(f"ERROR (no verdict): {type(exc).__name__}: {exc}", file=sys.stderr)
        code = 3
    sys.exit(code)
