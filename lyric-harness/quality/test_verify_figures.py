"""Regressions for quality/verify_figures.py (M-33, 2026-08-28).

The instrument relates `test_discriminate.PINNED` to the prose that quotes
it, with a DECLARED live/history form (struck or blockquote — exactly two
markers) and a declared repin lifecycle (current -> superseded/policed ->
retired/listed). Each section states the two directions it can fail in.

MUTATION, hand-proven before this suite shipped: stubbing `is_history` to
return True unconditionally makes the planted live leak in §2 read as
history and fails EXACTLY §2's violation check by name (measured: 1 check
red, every struck/blockquote control green — the controls must hold on
both trees, which is what makes the one red an attribution rather than a
crash); restoring it returns the suite to 13/13. That is the classifier
being load-bearing rather than decorative.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from quality import verify_figures as VF

PASS, FAIL = [], []


def check(name, ok, note=""):
    (PASS if ok else FAIL).append(name)
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    if note and not ok:
        print(f"          {note}")


FAKE_PIN = {
    "abs_exp1": {"joint_all": 0.7230769230769231},
    "abs_exp2": {"joint_all": 0.959703947368421},
}


def s1_the_shipped_document_is_clean_and_the_scan_is_not_vacuous():
    print("\n§1 the shipped document is clean, and the scan examined "
          "something")
    rows, deriv = VF.survey()
    bad = [r for r in rows if r[4] == "VIOLATION"]
    cur = [r for r in rows if r[4] == "current"]
    hist = [r for r in rows if r[4] == "history"]
    check("§1 zero violations on quality/RESULTS.md — M-33's seven stale "
          "sites were repinned in the entry's own commit and none has "
          "crept back", not bad,
          "; ".join(f"{d}:{l} {s}" for d, _n, s, l, _c in bad))
    check("§1 ...and the scan is NOT vacuous: current and history "
          "occurrences both counted above zero, so an empty document or a "
          "broken regex cannot read as clean (doctrine 20)",
          len(cur) > 0 and len(hist) > 0,
          f"current={len(cur)} history={len(hist)}")
    check("§1 the derivation matches the pin — the declared spellings ARE "
          "the pin's values at the quoted precision", not deriv,
          "; ".join(deriv))


def s2_the_declared_form_is_the_whole_rule(tmp):
    print("\n§2 the declared history form is the whole rule — struck or "
          "blockquote, nothing softer")
    doc = os.path.join(tmp, "planted.md")
    with open(doc, "w", encoding="utf-8") as f:
        f.write(
            # the leak: a superseded value in running prose, sitting BESIDE
            # the word SUPERSEDED — M-33's own site shape (line 456 of the
            # entry's table), which is the measured reason keyword marking
            # is refused: the word is about a DIFFERENT figure's
            # supersession and must not rescue this one.
            "SUPERSEDED 2026-08-13; cold it is 0.964 today.\n"
            # the two declared history forms
            "The cold reading was ~~0.717~~ before the sentinel fix.\n"
            "> cold 0.964 against 0.717, recorded as history.\n"
            # the current value, quotable anywhere
            "The standing pair is 0.723 / 0.960.\n"
            # a retired value in labelled narrative — listed, never policed
            "pre-fix it read 0.971 against 0.709.\n"
            # the standalone-decimal guard: a longer number must not match
            # (this section's own first draft wrote "the superseded
            # 0.964's business" here and went red on its own fixture —
            # an apostrophe is not a digit, so that mention MATCHES, and
            # correctly: the guard is against longer NUMBERS, not against
            # possessives)
            "an unrelated 0.9640 in a run id draws no row at all\n")
    rows, _d = VF.survey(root=tmp, pinned=FAKE_PIN, docs=("planted.md",))
    by = {}
    for _doc, _name, sp, ln, cls in rows:
        by.setdefault((ln, cls), []).append(sp)
    check("§2 the live leak is a VIOLATION — the word SUPERSEDED beside it "
          "rescues nothing", "0.964" in by.get((1, "VIOLATION"), []),
          str(sorted(by)))
    check("§2 a struck value is HISTORY",
          "0.717" in by.get((2, "history"), []))
    check("§2 a blockquote line is HISTORY for every value on it",
          "0.964" in by.get((3, "history"), [])
          and "0.717" in by.get((3, "history"), []))
    check("§2 the current pair is counted as current, never charged",
          "0.723" in by.get((4, "current"), [])
          and "0.960" in by.get((4, "current"), []))
    check("§2 a RETIRED value in labelled narrative is listed and not a "
          "violation — the lifecycle's unpoliced tier",
          "0.971" in by.get((5, "retired"), [])
          and "0.709" in by.get((5, "retired"), [])
          and not any(c == "VIOLATION" for (l, c) in by if l == 5))
    check("§2 a longer decimal does not match a tracked spelling — 0.9640 "
          "yields no row for line 6",
          not any(l == 6 for (l, _c) in by), str(sorted(by)))


def s3_the_relation_to_the_pin_is_load_bearing():
    print("\n§3 the derivation check IS the relation to the pin (the half "
          "M-33 found missing)")
    moved = {"abs_exp1": {"joint_all": 0.750},
             "abs_exp2": {"joint_all": 0.959703947368421}}
    _rows, deriv = VF.survey(pinned=moved)
    check("§3 a moved measurement reds the derivation for the moved "
          "quantity AND the gap it feeds — the prose cannot stay quiet "
          "under a repin",
          len(deriv) == 2 and any("0.750" in d for d in deriv)
          and any("gap" in d for d in deriv), "; ".join(deriv))
    _rows, deriv0 = VF.survey(pinned=FAKE_PIN)
    check("§3 ...and the real pin derives every declared spelling exactly "
          "(the control)", not deriv0, "; ".join(deriv0))


def s4_scope_is_declared_and_claude_md_is_out_named():
    print("\n§4 scope is declared per document, and CLAUDE.md is OUT of it "
          "on a stated argument")
    check("§4 the in-scope set is exactly the declared tuple",
          VF.DOCUMENTS == ("quality/RESULTS.md",), str(VF.DOCUMENTS))
    # The stated argument, held to: doctrine 7's ladder sentence quotes the
    # whole supersession chain in running prose. Under the two-marker rule
    # that would charge a legitimate doctrine-17 form, so the document is
    # out BY DECLARATION — and this check measures that the ladder is
    # still there, so the exclusion cannot outlive its reason in silence.
    root_claude = os.path.join(VF.ROOT, "CLAUDE.md")
    with open(root_claude, encoding="utf-8") as f:
        text = f.read()
    check("§4 the reason is still true: CLAUDE.md's doctrine-7 ladder "
          "quotes a superseded pair in unmarked narrative — the form the "
          "rule cannot admit",
          "0.717/0.964" in text, "the ladder sentence moved; if CLAUDE.md "
          "now uses only the two declared forms, bring it INTO scope and "
          "delete this exclusion")


def main():
    import tempfile
    print("=" * 70)
    print("VERIFY FIGURES — the prose answers to the pin (M-33)")
    print("=" * 70)
    s1_the_shipped_document_is_clean_and_the_scan_is_not_vacuous()
    with tempfile.TemporaryDirectory() as tmp:
        s2_the_declared_form_is_the_whole_rule(tmp)
    s3_the_relation_to_the_pin_is_load_bearing()
    s4_scope_is_declared_and_claude_md_is_out_named()
    print("\n" + "=" * 70)
    print(f"  {len(PASS)} passed, {len(FAIL)} failed")
    for f in FAIL:
        print(f"    FAILED: {f}")
    print("=" * 70)
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
