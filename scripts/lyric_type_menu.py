#!/usr/bin/env python3
"""The Lyrics page's type menu, derived from the relation registry.

The page (src/pages/lyrics.js) lists every registry type an English song can
use, with the type's REGISTRY INDEX (its position in `relations.REGISTRY`).
The index is what the page sends to the writer; the name is shown to the
person only. The list is not inlined into codex.html: this script writes it to
src/pages/lyric_types.json, scripts/build_static_api.js copies that file to
api/lyric_types.json, and the page fetches it the first time the Rhymes tool
draws.

A type is listed exactly when the planner may draw it for an English song:
the menu imports `type_eligibility` from lyric-harness/quality/plan.py, the
one eligibility rule, and keeps no rule of its own. Its docstring states the
rule and the owner's ruling it follows; a type it leaves out is refused by the
planner with the reason that function gives.

A type the planner refuses is refused there by name, never substituted.

Usage (from the repository root):
  python3 scripts/lyric_type_menu.py           # write src/pages/lyric_types.json
  python3 scripts/lyric_type_menu.py --check   # exit 1 when that file differs
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARNESS = os.path.join(ROOT, "lyric-harness")
OUT = os.path.join(ROOT, "src", "pages", "lyric_types.json")
REL = os.path.relpath(OUT, ROOT)


def eligible():
    sys.path.insert(0, HARNESS)
    from quality import relations as R
    from quality.plan import type_eligibility
    names = set(type_eligibility("eng")[0])
    return [(index, name) for index, name in enumerate(R.REGISTRY)
            if name in names]


def render():
    rows = ",\n".join("    " + json.dumps([i, n], ensure_ascii=False)
                      for i, n in eligible())
    return ('{\n  "generated_by": "scripts/lyric_type_menu.py",\n'
            f'  "types": [\n{rows}\n  ]\n}}\n')


def main():
    want = render()
    count = want.count("\n    [")
    if "--check" not in sys.argv:
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(want)
        print(f"lyric type menu: wrote {count} eligible types to {REL}")
        return 0
    try:
        with open(OUT, encoding="utf-8") as f:
            have = f.read()
    except FileNotFoundError:
        have = None
    if have != want:
        print(f"lyric type menu: FAIL — {REL} differs from the registry; run "
              "python3 scripts/lyric_type_menu.py, then npm run build:api.")
        return 1
    print(f"lyric type menu: PASS — {count} eligible types match the registry")
    return 0


if __name__ == "__main__":
    sys.exit(main())
