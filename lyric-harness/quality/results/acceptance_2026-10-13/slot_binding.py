"""Slot binding: does the revision loop edit the word the grader binds?

    python3 quality/results/acceptance_2026-10-13/slot_binding.py quality/results/acceptance_2026-10-13/slot_binding_fce4bf0f.json [HARNESS_ROOT]

R2's 1b v2 blocker (PR #519, 6151243417), and the case 3PO asked to be
measured at the pinned head (PR #527, 6151284267). Under `--voices`, the loop's
`swap_at_slot` cut the line with parenthesised asides stripped, while the grader
resolves the same slot through `slots.resolve`, which follows the lexicon's
aside rule. A head or `T<n>` slot after an aside could then edit a different
word from the one the grader binds.

For every line with a parenthesised aside, in both aside modes (asides stripped,
and asides sung as with `--voices`), and for the slots `end`, `head` and `T1`
through `T8`, this compares three spans in the line as the reader returns it.
That is reader-returned text (stripped, bracket-edited), NOT necessarily the
untouched corpus file:
- **named**: the word the slot names in that mode's cut. `end` is the last
  token, `head` the first, and `T<n>` the n-th;
- **bound**: the word the grader binds. `slots.resolve(lex, line, slot)` is
  called, and its label is checked against the token found through
  `word_syllable_map`'s own `widx` (the index `resolve` reads). If they
  disagree, the case is `resolver_mismatch`: the oracle cannot place it, and
  the gate is CANNOT TELL;
- **edited**: the span `swap_at_slot` actually replaced. It is found by EXACT
  RECONSTRUCTION, never by diffing: the line with one candidate span replaced
  by the marker, cased as the loop cases it, must equal the returned line.
  Candidates are every span of the harness tokenizer and of the loop's own
  `_WORD_RE`. A returned line that no single-span replacement reproduces is
  `wrong_word`.

Outcomes:
- `agree`: edited = named = bound;
- `agree_unbound`: edited = named, and the grader binds nothing there, for
  example an unreadable word (replacing it is how a revision fixes it);
- `grader_elsewhere`: edited = named, but the grader binds a different word.
  FAILS the gate, because the revision target and the graded word differ;
- `wrong_word`: the loop edits anything other than the named word, including
  an edit on a line where the mode has no sung word. FAILS the gate;
- `refused`, `refused_unbound`, `refused_grader_elsewhere`, `no_word_refused`:
  the loop declines. That never edits a wrong word, so it doesn't fail the
  gate, but each is counted;
- `resolver_mismatch`: see above.

THE GATE (exit status 0 PASS, 1 FAIL, 2 CANNOT TELL):
- PASS needs 0 `wrong_word`, 0 `grader_elsewhere` and 0 `resolver_mismatch`
  in both modes, and every REQUIRED CONTROL edit agreeing. The controls are
  lines with no aside, where the loop must edit the bound word in both modes,
  so a loop that refuses everything cannot pass;
- CANNOT TELL is returned when a production call of `swap_at_slot` passes
  arguments this tool does not replicate. The tool calls it the way production
  does, `swap_at_slot(text, slot, word)`, and it checks that by reading the
  production call sites, never by injecting an argument production might not
  pass.

Lines that `join_spaced_enclitics` changes are excluded and counted, because
their token offsets would be in transformed text. Those inputs stay untested
here.

The header pins the tested commit and its tracked changes, the tool's own
sha256, the lexicon (class, supplement version and files, CMUdict, fallback),
the population digest and the evaluated slot counts.
"""
import ast, copy, glob, hashlib, json, os, re, subprocess, sys

ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else
                       os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
sys.path.insert(0, ROOT)
import lyric_harness as LH  # noqa: E402
from quality import slots as SL  # noqa: E402
from quality.coverage_census import build_lexicon  # noqa: E402
from quality.loop import swap_at_slot  # noqa: E402
from quality.loop import _WORD_RE as LOOP_WORD_RE  # noqa: E402

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
]
SLOTS = ["end", "head"] + [f"T{n}" for n in range(1, 9)]
MARK = "zqzq"
PRODUCTION_FILES = ("quality/revise.py", "quality/loop.py", "lyric_harness.py")


def _sha(path):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def _cased(old):
    if old.isupper():
        return MARK.upper()
    if old[:1].isupper():
        return MARK.capitalize()
    return MARK.lower()


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
    if slot == "end":
        return spans[-1][1]
    if slot == "head":
        return spans[0][1]
    i = int(slot[1:]) - 1
    return spans[i][1] if i < len(spans) else None


def _fold(w):
    return LH.normalise_word(w) if hasattr(LH, "normalise_word") else w.lower()


def _bound(lex, line, slot, spans):
    """-> span the grader binds, None if it binds nothing, or 'mismatch' when
    `slots.resolve` and the `widx` reading disagree."""
    anchors, label, _ = SL.resolve(lex, line, SL.parse_slot(f"1.{slot}"))
    if not anchors:
        return None
    if slot == "end":
        final = LH.raw_final_token(line, strip_parens=lex.strip_parens)
        span = spans[-1] if spans and spans[-1][0] == final else None
    else:
        widx = sorted({s["widx"] for s in LH.word_syllable_map(lex, line) if s.get("widx") is not None})
        i = widx[0] if slot == "head" else int(slot[1:]) - 1
        span = spans[i] if widx and i in widx and i < len(spans) else None
    if span is None or _fold(span[0]) != _fold(label):
        return "mismatch"
    return span[1]


def _edited(line, new):
    """-> the single span whose replacement reproduces `new` exactly, or None."""
    cands = {m.span() for m in LH._TOKEN_RUN.finditer(line)} | {m.span() for m in LOOP_WORD_RE.finditer(line)}
    hits = [(a, b) for a, b in sorted(cands) if line[:a] + _cased(line[a:b]) + line[b:] == new]
    return hits[0] if len(hits) == 1 else None


def _production_calls():
    """Every production call of swap_at_slot, with its argument shape."""
    sites = []
    for rel in PRODUCTION_FILES:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            tree = ast.parse(fh.read())
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                f = node.func
                name = f.id if isinstance(f, ast.Name) else f.attr if isinstance(f, ast.Attribute) else None
                if name == "swap_at_slot":
                    sites.append({"file": rel, "line": node.lineno, "positional": len(node.args),
                                  "keywords": sorted(k.arg or "**" for k in node.keywords)})
    return sites


def _classify(line, slot, lex, spans):
    named = _named(slot, spans)
    new = swap_at_slot(line, SL.parse_slot(f"1.{slot}"), MARK)
    if named is None:
        return ("no_word_refused" if new is None else "wrong_word"), None, None, None, new
    bound = _bound(lex, line, slot, spans)
    if bound == "mismatch":
        return "resolver_mismatch", named, None, None, new
    if new is None:
        kind = "refused" if bound == named else "refused_unbound" if bound is None else "refused_grader_elsewhere"
        return kind, named, bound, None, new
    edited = _edited(line, new)
    if edited != tuple(named):
        return "wrong_word", named, bound, edited, new
    if bound is None:
        return "agree_unbound", named, bound, edited, new
    return ("agree" if tuple(bound) == tuple(named) else "grader_elsewhere"), named, bound, edited, new


def main():
    out = sys.argv[1]
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
    cases = []
    for source, line in lines:
        for mode, lex in lexes.items():
            spans = _spans(line, lex.strip_parens)
            if spans is None or spans is False:
                excluded["spaced_enclitic_or_folded" if spans is None else "spans_not_reproduced"] += 1
                continue
            for slot in SLOTS:
                if slot.startswith("T") and int(slot[1:]) > len(spans):
                    continue
                kind, named, bound, edited, new = _classify(line, slot, lex, spans)
                evaluated[mode] += 1
                tally[mode][kind] = tally[mode].get(kind, 0) + 1
                if kind in ("wrong_word", "grader_elsewhere", "resolver_mismatch"):
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
    calls = _production_calls()
    odd = [c for c in calls if c["positional"] != 3 or c["keywords"]]
    failing = {m: {k: tally[m].get(k, 0) for k in ("wrong_word", "grader_elsewhere", "resolver_mismatch")}
               for m in lexes}
    controls_failed = [c for c in controls if c["kind"] != "agree"]
    if odd or any(failing[m]["resolver_mismatch"] for m in lexes):
        gate = "CANNOT TELL"
    elif any(failing[m]["wrong_word"] or failing[m]["grader_elsewhere"] for m in lexes) or controls_failed:
        gate = "FAIL"
    else:
        gate = "PASS"
    try:
        commit = subprocess.run(["git", "-C", ROOT, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        dirty = bool(subprocess.run(["git", "-C", ROOT, "status", "--porcelain", "--untracked-files=no"],
                                    capture_output=True, text=True).stdout.strip())
    except OSError:
        commit, dirty = None, None
    supp = getattr(base, "supplement_path", None)
    rec = {
        "gate": gate,
        "pins": {
            "commit": commit, "tracked_changes": dirty, "harness_root": ROOT,
            "tool_sha256": _sha(os.path.abspath(__file__)),
            "loop_sha256": _sha(os.path.join(ROOT, "quality", "loop.py")),
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
            "slots": SLOTS,
        },
        "production_calls": calls, "production_calls_not_replicated": odd,
        "excluded_line_modes": excluded, "evaluated_slots": evaluated,
        "outcomes": tally, "failing": failing,
        "controls": controls, "controls_failed": controls_failed,
        "cases": cases[:200],
    }
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(json.dumps({k: rec[k] for k in ("gate", "excluded_line_modes", "evaluated_slots", "outcomes",
                                          "production_calls_not_replicated")}
                     | {"controls_failed": len(controls_failed),
                        "selected_lines": rec["pins"]["population"]["selected_lines"]}, indent=1))
    sys.exit({"PASS": 0, "FAIL": 1, "CANNOT TELL": 2}[gate])


if __name__ == "__main__":
    main()
