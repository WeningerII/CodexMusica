#!/usr/bin/env python3
"""Regressions for SOURCE IDENTITY — what a comparator's fingerprint may narrow to.

`quality/source_identity.py` answers two questions the predictability memo's
guard rests on: what ONE definition's source text is (`definition_source`), and
what slice of a 13k-line module a caller can actually REACH
(`definition_closure` + `module_entry_names`). The second is a NARROWING of a
whole-file hash, and CLAUDE.md standing rule 4 forbids narrowing what the
fingerprint COVERS. So the only checks worth writing here are the ones that
would fail if coverage had in fact shrunk — every section below either MOVES
something and requires the closure to follow, or names a way the closure could
be blind and proves it is not.

THE ASSUMPTION THAT WOULD DEFEAT ALL OF IT IS DYNAMIC DISPATCH. A closure taken
by NAME is complete only if the reachable definitions look their collaborators
up by name; `getattr(module, s)`, `globals()[s]` and `eval(s)` each reach a
definition this scan cannot see, and a hit on one is a reason to widen the
input, not a reason to shrug. Section 4 is that check, and it is the load-
bearing one.

Sections:
  1  the entry set is READ off the importers, nested imports and all
  2  every entry point is in the closure, and the closure is deterministic
  3  the closure is TRANSITIVE — a helper five calls deep still moves the hash
  4  nothing reachable dispatches on a module-level name at runtime
  5  `definition_source` still resolves by NAME, not by a live line offset
"""

import ast
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import lyric_harness as LH                                       # noqa: E402
from quality import features as F                                # noqa: E402
from quality import source_identity as SI                        # noqa: E402
from quality import song_profile_calibration as C                # noqa: E402

FAILURES = []


def check(name, cond, detail=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {name}")
    if detail:
        print(f"          {detail}")
    if not cond:
        FAILURES.append(name)


def _entries():
    return sorted(set(SI.module_entry_names(F.__file__, "lyric_harness"))
                  | set(SI.module_entry_names(C.__file__, "lyric_harness")))


def test_the_entry_set_is_read_off_the_importers():
    print("\n1. the entry set is READ off the importers, nested imports and all")
    names = SI.module_entry_names(F.__file__, "lyric_harness")
    check("the module-level `from lyric_harness import (...)` list is read",
          {"Declaration", "Lexicon", "anchor", "line_anchors", "score",
           "syllabify", "vowel_sim", "VOWELS"} <= set(names), f"{names}")
    check("and so are the imports INSIDE function bodies — `_refuse` and "
          "`fold_apostrophes` are two names a hand-written list omitted, and "
          "the tokeniser's own apostrophe folding rides on the second",
          {"_refuse", "fold_apostrophes"} <= set(names))
    attrs = SI.module_entry_names(C.__file__, "lyric_harness")
    check("`module.attr` access is read too, so a module imported WHOLE is "
          "covered by the same call",
          {"CMUDICT_PATH", "FREQ_PATH", "Declaration"} <= set(attrs),
          f"{attrs}")
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as fh:
        fh.write("from lyric_harness import *\n")
        star = fh.name
    try:
        try:
            SI.module_entry_names(star, "lyric_harness")
            refused = False
        except ValueError:
            refused = True
        check("a STAR import REFUSES rather than returning a set that looks "
              "complete: the entry set is then the whole module and this "
              "function cannot say so in names (doctrine 20)", refused)
    finally:
        os.unlink(star)


def test_every_entry_point_is_in_the_closure():
    print("\n2. every entry point is in the closure, and the closure is deterministic")
    entries = _entries()
    reached, text = SI.definition_closure(LH.__file__, entries)
    # `__file__` is module machinery: `hasattr` finds it and no statement
    # DEFINES it, so it is correctly outside the closure rather than missing
    # from it. The two paths already hashed separately (`CMUDICT_PATH`,
    # `FREQ_PATH`) stay in, because they ARE module-level assignments.
    defined = {n for n in entries
               if hasattr(LH, n) and not n.startswith("__")}
    check("every entry point the importers name, and that the module actually "
          "defines, is in the closure — a closure missing its own entry is "
          "not a closure",
          defined - set(reached) == set(), f"missing={sorted(defined - set(reached))}")
    again, text2 = SI.definition_closure(LH.__file__, entries)
    check("the closure is DETERMINISTIC — a fingerprint that moved between two "
          "reads of one tree would discard the memo on every run (doctrine 66)",
          (again, text2) == (reached, text))
    check("and it is a real narrowing rather than the whole file, which is the "
          "only reason this indirection exists",
          len(text) < len(open(LH.__file__, encoding="utf-8").read()),
          f"closure {len(text)} chars, {len(reached)} names")
    check("the reached NAMES ride in the fingerprint beside the text, so a "
          "definition entering or leaving the comparator's reach moves it even "
          "when every definition's own bytes are unchanged",
          all(n in dict(C.comparator_fingerprint_parts())["lyric_harness.py closure"]
              for n in reached))
    # THE DELIBERATE OVER-INCLUSION, CHECKED. Every module-level statement that
    # is not a definition — imports, module-level validation, a top-level `if`
    # — is in whatever it mentions, because it RUNS at import and can change
    # what the reachable definitions do. Unchecked, the narrowing would rest on
    # a claim in a docstring, and the failure mode is silent: a closure that
    # dropped the imports would still parse and still look like a closure.
    body = ast.parse(open(LH.__file__, encoding="utf-8").read()).body
    statements = [n for n in body
                  if not isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef,
                                        ast.ClassDef, ast.Assign, ast.AnnAssign))]
    kinds = sorted({type(n).__name__ for n in statements})
    closure_kinds = sorted({type(n).__name__ for n in ast.parse(text).body
                            if not isinstance(n, (ast.FunctionDef,
                                                  ast.AsyncFunctionDef,
                                                  ast.ClassDef, ast.Assign,
                                                  ast.AnnAssign))})
    check("every module-level NON-definition statement kind is in the closure, "
          "whatever it mentions — an edit to an import or to module-level "
          "validation moves the hash",
          set(kinds) <= set(closure_kinds), f"module {kinds} / closure {closure_kinds}")
    check("and there are some, so this check examined something",
          len(statements) > 5, f"{len(statements)} non-definition statements")


def test_the_closure_is_transitive():
    print("\n3. the closure is TRANSITIVE — a helper five calls deep still moves the hash")
    entries = _entries()
    reached, _text = SI.definition_closure(LH.__file__, entries)
    # The claim is about definitions NOBODY NAMED as an entry point. If the
    # closure were one hop deep, `reached` would be the entry set and nothing
    # more, and a change to a helper would be invisible.
    indirect = sorted(set(reached) - set(entries))
    check("the closure reaches definitions no entry point names — one hop "
          "would leave `reached` equal to the entry set",
          len(indirect) > 0, f"{len(indirect)} indirect, e.g. {indirect[:6]}")
    # Prove the hash FOLLOWS one of them, on the real fingerprint rather than
    # on a re-implementation of it.
    victim = next(n for n in indirect
                  if isinstance(getattr(LH, n, None), type(SI.definition_source)))
    before = open(LH.__file__, encoding="utf-8").read()
    clean = C.comparator_fingerprint()
    lines = before.splitlines(keepends=True)
    node, = [n for n in ast.parse(before).body
             if getattr(n, "name", None) == victim]
    at = node.body[0].lineno - 1
    pad = lines[at][:len(lines[at]) - len(lines[at].lstrip())]
    lines.insert(at, pad + "# planted by test_source_identity.py section 3\n")
    try:
        open(LH.__file__, "w", encoding="utf-8").write("".join(lines))
        moved = C.comparator_fingerprint()
        check(f"editing `{victim}` — reached only through another definition — "
              "moves the comparator fingerprint, so the guard covers what it "
              "can reach and not merely what was declared",
              moved != clean, f"{clean[:12]} -> {moved[:12]}")
    finally:
        open(LH.__file__, "w", encoding="utf-8").write(before)
    check("no residue", C.comparator_fingerprint() == clean)


def test_nothing_reachable_dispatches_dynamically():
    print("\n4. nothing reachable dispatches on a module-level name at runtime")
    entries = _entries()
    reached, text = SI.definition_closure(LH.__file__, entries)
    # A module-level lookup through one of these reaches a definition a
    # by-name scan cannot see. Parsed rather than grepped, so a mention in a
    # comment or a docstring does not raise a false alarm.
    tree = ast.parse(text)
    hits = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        fn = node.func
        name = fn.id if isinstance(fn, ast.Name) else getattr(fn, "attr", "")
        if name not in ("getattr", "globals", "eval", "exec", "vars",
                        "__import__", "import_module"):
            continue
        if name == "getattr" and node.args:
            # `getattr(obj, ...)` on an INSTANCE is an attribute probe and
            # reaches no module-level definition. Only a lookup whose target
            # is a module — or the module's own globals — is a blind spot.
            first = node.args[0]
            if not (isinstance(first, ast.Name)
                    and first.id in ("lyric_harness", "sys", "__builtins__")):
                continue
        hits.append((name, node.lineno))
    check("no reachable definition looks a module-level name up through "
          "getattr/globals/eval — which is the assumption the whole narrowing "
          "rests on, checked rather than asserted",
          not hits, f"{hits}")
    check("and the population is non-empty, so this section examined "
          "something (doctrine 20: a check over nothing reads like a pass)",
          len(reached) > 20 and len(text) > 10000,
          f"{len(reached)} definitions, {len(text)} chars parsed")


def test_definition_source_resolves_by_name():
    print("\n5. `definition_source` still resolves by NAME, not by a live line offset")
    src = SI.definition_source(C.predictability_frac)
    check("the returned text IS that definition and starts at its own `def`",
          src.startswith("def predictability_frac("), src[:40])
    check("and it stops at the definition's end rather than running on into "
          "the next one",
          "def population(" not in src)
    try:
        SI.definition_source(LH.Lexicon.transcribe_word)
        refused = False
    except ValueError:
        refused = True
    check("a method REFUSES — this resolves a TOP-LEVEL declaration by name, "
          "and a qualified name has no unique top-level node to find", refused)


def main():
    for fn in (test_the_entry_set_is_read_off_the_importers,
               test_every_entry_point_is_in_the_closure,
               test_the_closure_is_transitive,
               test_nothing_reachable_dispatches_dynamically,
               test_definition_source_resolves_by_name):
        fn()
    print(f"\n{'ALL PASS' if not FAILURES else 'FAILURES: ' + str(FAILURES)}")
    return 1 if FAILURES else 0


if __name__ == "__main__":
    sys.exit(main())
