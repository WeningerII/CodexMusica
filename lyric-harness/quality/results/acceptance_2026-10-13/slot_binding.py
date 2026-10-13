"""Slot binding: does the revision loop edit the word the grader binds?

    python3 quality/results/acceptance_2026-10-13/slot_binding.py quality/results/acceptance_2026-10-13/slot_binding_fce4bf0f.json [HARNESS_ROOT]

R2's 1b v2 blocker (PR #519, 6151243417), and the case 3PO asked to be
measured at the pinned head (PR #527, 6151284267). Under `--voices`, the loop's
`swap_at_slot` cut the line with parenthesised asides stripped, while the grader
resolves the same slot through `slots.resolve` -> `word_syllable_map(lex)`,
which follows the lexicon's aside rule. A head or `T<n>` slot after an aside
could then edit a different word from the one the grader binds.

For every line with a parenthesised aside, in both aside modes (asides stripped,
and asides sung as with `--voices`), and for the slots `end`, `head` and `T1`
through `T8`, this compares three original-source spans:
- **named**: the word the slot names in that mode's cut. `end` is the last
  token, `head` the first, and `T<n>` the n-th;
- **bound**: the word the grader binds, from `word_syllable_map`'s own `widx`
  (the index `slots.resolve` reads), or the anchored end word for `end`. None
  when the grader binds nothing there, for example an unreadable word;
- **edited**: the characters `swap_at_slot` actually replaces, the span where
  the returned line differs from the original.

Each case is one of:
- `agree`: the loop replaces the named word, and the grader binds that same
  word or nothing. Replacing an unreadable end word is how a revision fixes
  it, so `bound` None is not a disagreement;
- `refused`: the loop declines (`None`), which never edits a wrong word;
- `no_word_refused`: the mode has no sung word for the slot to name, for
  example a line that is all aside with asides stripped, and the loop declines.
  An edit there counts as `wrong_word`;
- `wrong_word`: the loop edits something other than the named word. Acceptance
  requires 0;
- `grader_elsewhere`: the loop edits the named word, but the grader binds a
  different one. For example, `head` binds the first READABLE word, so an
  unreadable first word moves it. Reported, not a loop defect;
- `unmapped`: the oracle can't place a token span without guessing, counted and
  never judged.

Spans are offsets in the ORIGINAL line. A line that `join_spaced_enclitics`
changes (a spaced enclitic or a folded apostrophe) is excluded and counted,
because its token offsets would be in transformed text (3PO, 6148925490).

The loop is called the way production calls it (`revise.py`, `loop.py`):
`swap_at_slot(text, slot, word)`. If a head's `swap_at_slot` takes an aside
argument (`lex`, `lexicon` or `strip_parens`), it is passed for the mode, and
the output records which argument was used.

The population is the reader's sung lines (`load_lyric_lines`) of
`corpus/song/eng_*` that contain `(` and that voices cuts differently, plus a
fixed list of synthetic lines.
"""
import glob, hashlib, inspect, json, os, re, sys

ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else
                       os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
sys.path.insert(0, ROOT)
import copy  # noqa: E402
import lyric_harness as LH  # noqa: E402
from quality.coverage_census import build_lexicon  # noqa: E402
from quality.loop import swap_at_slot  # noqa: E402
from quality.slots import parse_slot  # noqa: E402

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
]
SLOTS = ["end", "head"] + [f"T{n}" for n in range(1, 9)]
MARK = "zqzq"


def _spans(line, strip):
    """Original-source spans of the line's tokens in this mode, or None."""
    if LH.join_spaced_enclitics(line) != line:
        return None
    on = [(m.group(), m.span()) for m in LH._TOKEN_RUN.finditer(line) if LH.LATIN_SCRIPT.search(m.group())]
    if strip:
        parens = [m.span() for m in re.finditer(r"\([^)]*\)", line)]
        on = [(w, s) for w, s in on if not any(a <= s[0] and s[1] <= b for a, b in parens)]
    return on if [w for w, _ in on] == LH.line_tokens(line, strip_parens=strip) else False


def _named(slot, spans):
    """The span of the word the slot names in this mode's cut, or None."""
    if not spans:
        return None
    if slot == "end":
        return spans[-1][1]
    if slot == "head":
        return spans[0][1]
    i = int(slot[1:]) - 1
    return spans[i][1] if i < len(spans) else None


def _bound(lex, line, slot, spans):
    """The grader's bound token span for this slot, None if it binds nothing."""
    if slot == "end":
        final = LH.raw_final_token(line, strip_parens=lex.strip_parens)
        anchors, _label, _ = LH.line_anchors(lex, line)
        if not anchors or not final:
            return None
        return spans[-1][1] if spans and spans[-1][0] == final else "unmapped"
    smap = LH.word_syllable_map(lex, line)
    widx = sorted({s["widx"] for s in smap if s.get("widx") is not None})
    if not widx:
        return None
    if slot == "head":
        i = widx[0]
    else:
        i = int(slot[1:]) - 1
        if i not in widx:
            return None
    return spans[i][1] if i < len(spans) else "unmapped"


def _edited(old, new):
    """The original-source span the edit replaced."""
    p = 0
    while p < min(len(old), len(new)) and old[p] == new[p]:
        p += 1
    s = 0
    while s < min(len(old), len(new)) - p and old[-1 - s] == new[-1 - s]:
        s += 1
    return (p, len(old) - s)


_PARAMS = set(inspect.signature(swap_at_slot).parameters)
_MODE_ARG = next((a for a in ("lex", "lexicon", "strip_parens") if a in _PARAMS), None)


def _swap(line, slot, lex):
    kw = {}
    if _MODE_ARG == "strip_parens":
        kw["strip_parens"] = lex.strip_parens
    elif _MODE_ARG:
        kw[_MODE_ARG] = lex
    return swap_at_slot(line, parse_slot(f"1.{slot}"), MARK, **kw)


def main():
    out = sys.argv[1]
    base = build_lexicon("v2", "none")
    lexes = {"asides_stripped": base}
    sung = copy.copy(base)
    sung.strip_parens = False
    lexes["asides_sung"] = sung
    files = sorted(glob.glob(os.path.join(ROOT, "corpus", "song", "eng_*")))
    corpus = [t for f in files for t in LH.load_lyric_lines(f)
              if "(" in t and LH.line_tokens(t, strip_parens=False) != LH.line_tokens(t, strip_parens=True)]
    lines = [("synthetic", t) for t in SYNTHETIC] + [("corpus", t) for t in corpus]
    tally = {m: {} for m in lexes}
    excluded = {"spaced_enclitic_or_folded": 0, "spans_not_reproduced": 0}
    bad = []
    for source, line in lines:
        for mode, lex in lexes.items():
            spans = _spans(line, lex.strip_parens)
            if spans is None:
                excluded["spaced_enclitic_or_folded"] += 1
                continue
            if spans is False:
                excluded["spans_not_reproduced"] += 1
                continue
            for slot in SLOTS:
                if slot.startswith("T") and int(slot[1:]) > len(spans):
                    continue
                named = _named(slot, spans)
                bound = _bound(lex, line, slot, spans)
                new = _swap(line, slot, lex)
                edited = None if new is None else _edited(line, new)
                if named is None:
                    # no sung word in this mode, e.g. a line that is all aside
                    kind = "no_word_refused" if new is None else "wrong_word"
                elif bound == "unmapped":
                    kind = "unmapped"
                elif new is None:
                    kind = "refused"
                elif edited != tuple(named):
                    kind = "wrong_word"
                elif bound is not None and tuple(bound) != tuple(named):
                    kind = "grader_elsewhere"
                else:
                    kind = "agree"
                tally[mode][kind] = tally[mode].get(kind, 0) + 1
                if kind in ("wrong_word", "grader_elsewhere"):
                    bad.append({"kind": kind, "source": source, "line": line, "mode": mode, "slot": slot,
                                "named": list(named) if named else None,
                                "bound": list(bound) if bound and bound != "unmapped" else None,
                                "edited": list(edited), "result": new})
    rec = {"harness_root": ROOT, "swap_at_slot_mode_argument": _MODE_ARG,
           "loop_sha256": hashlib.sha256(open(os.path.join(ROOT, "quality", "loop.py"), "rb").read()).hexdigest(),
           "lines": {"synthetic": len(SYNTHETIC), "corpus": len(corpus)}, "slots": SLOTS,
           "excluded_line_modes": excluded, "outcomes": tally,
           "wrong_word": sum(c["kind"] == "wrong_word" for c in bad),
           "grader_elsewhere": sum(c["kind"] == "grader_elsewhere" for c in bad), "cases": bad[:200]}
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(rec, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(json.dumps({k: rec[k] for k in ("swap_at_slot_mode_argument", "lines", "excluded_line_modes",
                                          "outcomes", "wrong_word", "grader_elsewhere")}, indent=1))


if __name__ == "__main__":
    main()
