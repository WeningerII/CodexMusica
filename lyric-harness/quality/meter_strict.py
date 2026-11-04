"""Strict all-position meter check against a declared template (#677 b2).

The b1 meter check compares a template's STRONG positions only and says so.
This module is the other half of a declared check: it compares EVERY
position, weak ones included, and answers in the A2 vocabulary (#676
6586644079):

  holds          every compared position agrees and nothing is left over
  does_not_hold  at least one position disagrees; each one is named
  not_computed   the comparison cannot be made, with the reason

WHAT IS COMPARED. A per-syllable stress digit (`0`, `1`, `2`) against a
template of `.` (weak) and `/` (strong). The binary map is `0 -> W` and
`1`/`2 -> S`; the source digit is kept in every reported position, so a
secondary stress landing on a weak slot is shown as a `2`, not hidden in a
projection. No promotion, demotion, resolution, elision or substitution is
applied by this module, except the one variation policy a caller declares.

THE ONE DECLARED VARIATION. `policy="initial_inversion"` swaps template
positions 1 and 2, and only when the template begins `./` (W S). The result
says whether the inversion was used. No medial inversion, and no other
substitution, follows from it. This is a declared check, not recognition:
`holds` never means the line IS in that meter, only that this reading fits
this template under this policy, and uniqueness is never established.

ALIGNMENT. A word with no reading contributes no syllables, so every later
position shifts (b1's `alignment`). Positions inside the reliably aligned
prefix are still compared: a disagreement there is a real `does_not_hold`.
Positions after it are never compared, and a line with no disagreement in
its prefix is `not_computed`, never `holds`.

TEMPLATE SYMBOLS. Only `.` and `/`. The legacy path reads any other
character as weak; strict mode refuses it instead (`not_computed`), because
a symbol it does not understand is not evidence of a weak position.

This module edits nothing and imports nothing from the harness: it reads
the entries the b1 meter check in `lyric_harness` already returns
(`from_entry`) or a supplied stress stream (`compare`).
"""

STATUS = ("holds", "does_not_hold", "not_computed")
POLICIES = (None, "initial_inversion")

BASIS = ("every template position compared, weak and strong; stress 0 is W, "
         "1 and 2 are S; source digits kept; no promotion, demotion or "
         "substitution except a declared policy; a declared check, not "
         "recognition, and uniqueness is not established")


def _not_computed(reason, **extra):
    return {"status": "not_computed", "reason": reason,
            "differences": [], "basis": BASIS, **extra}


def _effective_template(template, policy):
    if policy is None:
        return template, False
    if policy == "initial_inversion":
        if template[:2] != "./":
            return None, False
        return "/." + template[2:], True
    return None, False


def compare(digits, template, *, policy=None, valid=None, tokens=None):
    """-> the strict result for one line.

    `digits` is the per-syllable stress string (`"0110"`), `template` a
    string of `.` and `/`. `valid` is how many leading syllables are
    reliably aligned (default: all). `tokens`, when given, is one
    `(token, word)` pair per syllable, used only to name each difference.
    """
    if policy not in POLICIES:
        return _not_computed(f"unsupported policy {policy!r}",
                             policy=policy)
    odd = sorted(set(template) - {".", "/"})
    if not template or odd:
        return _not_computed(
            "template symbols other than '.' and '/' are not supported "
            "by the strict check" if odd else "empty template",
            template_symbols=odd, policy=policy)
    if any(d not in "012" for d in digits):
        return _not_computed("stress digits must be 0, 1 or 2",
                             policy=policy)
    target, inverted = _effective_template(template, policy)
    if target is None:
        return _not_computed(
            "initial inversion needs a template that begins './' (W S)",
            policy=policy)
    # `valid` given means an unread word sits after syllable `valid`, even
    # when it is the LAST word and so adds no digits after the prefix: the
    # line's true length is unknown, so it is never treated as aligned.
    aligned = valid is None
    n = len(digits) if aligned else max(0, min(valid, len(digits)))
    differences = []
    for i in range(min(n, len(target))):
        got = "S" if digits[i] in "12" else "W"
        want = "S" if target[i] == "/" else "W"
        if got != want:
            d = {"position": i + 1, "expected": want, "stress": digits[i]}
            if tokens and i < len(tokens) and tokens[i] is not None:
                d["token"], d["word"] = tokens[i]
            differences.append(d)
    out = {"basis": BASIS, "policy": policy,
           "inversion_used": bool(inverted),
           "positions_compared": min(n, len(target)),
           "template_positions": len(template),
           "differences": differences}
    if aligned:
        out["overhang"] = max(0, len(digits) - len(target))
        out["missing_positions"] = max(0, len(target) - len(digits))
    if differences or (aligned and (out["overhang"]
                                    or out["missing_positions"])):
        out["status"] = "does_not_hold"
    elif not aligned:
        out["status"] = "not_computed"
        out["reason"] = (f"positions after syllable {n} follow an unread "
                         f"word and are not compared")
    else:
        out["status"] = "holds"
    if not aligned:
        out["compared_through_syllable"] = n
        out["not_compared_after_syllable"] = n
    return out


def from_entry(entry, template, *, policy=None):
    """-> the strict result for one b1 meter-check entry (b1 fields).

    Reads the per-word `stream` digits and `alignment` that b1 reports; an
    entry whose word detail is unavailable is `not_computed`, never guessed.
    """
    words = entry.get("words")
    if not words:
        return _not_computed("per-word readings are not available on this "
                             "reader, so positions cannot be attributed",
                             policy=policy)
    digits, tokens = "", []
    for w in words:
        s = w.get("stream") or ""
        digits += s
        tokens.extend([(w.get("token"), w.get("word"))] * len(s))
    align = entry.get("alignment")
    if align == "exact":
        valid = None
    elif isinstance(align, dict):
        valid = align.get("valid_syllables", 0)
    else:
        return _not_computed("alignment unavailable", policy=policy)
    out = compare(digits, template, policy=policy, valid=valid,
                  tokens=tokens)
    if isinstance(align, dict):
        out["unread_from_token"] = align.get("valid_through_token", 0) + 1
    return out


def report_lines(result):
    """-> the human lines for one strict result. The limit travels with the
    verdict: every line names the basis, and `holds` never claims more."""
    st = result["status"]
    pol = result.get("policy")
    under = " under initial inversion" if result.get("inversion_used") else ""
    if st == "holds":
        head = (f"strict: holds{under} -- all {result['positions_compared']} "
                f"positions agree with the declared template")
    elif st == "does_not_hold":
        diffs = result["differences"]
        where = ", ".join(
            f"{d['position']}"
            + (f" ({d['word']!r}, token {d['token']})" if "word" in d else "")
            for d in diffs)
        head = f"strict: does not hold{under}"
        head += f" at position(s) {where}" if diffs else ""
        if result.get("overhang"):
            head += f"; {result['overhang']} syllable(s) past the template"
        if result.get("missing_positions"):
            head += (f"; {result['missing_positions']} template "
                     f"position(s) unfilled")
    else:
        head = f"strict: not computed -- {result.get('reason', '')}"
    out = ["  " + head]
    if result.get("not_compared_after_syllable") is not None and st != "not_computed":
        out.append(f"    positions after syllable "
                   f"{result['not_compared_after_syllable']} not compared "
                   f"(unread word)")
    if pol is None and st != "not_computed":
        out.append("    no variation policy declared")
    out.append("    a declared check, not meter recognition; uniqueness "
               "not established")
    return out
