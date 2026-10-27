#!/usr/bin/env python3
"""The Lyrics page's type menu, derived from the relation registry.

The page (src/pages/lyrics.js) lists every registry type an English song can
use, with the type's REGISTRY INDEX (its position in `relations.REGISTRY`).
The index is what the page sends to the writer; the name is shown to the
person only. The list is not inlined into codex.html: this script writes it to
src/pages/lyric_types.json, scripts/build_static_api.js copies that file to
api/lyric_types.json, and the page fetches it the first time the Rhymes tool
draws.

A type is eligible for an English song when ALL of these hold (the rule the
planner is given too):
  (a) its `normative` is "attested". This leaves out the four non-attested
      types: homoioteleuton and fourth lift must not alliterate (forbidden),
      trite rhyme and cynghanedd sain drosgl (deprecated);
  (b) every input it requires (`capabilities()`: its `requires`, and what its
      spans, placements and identity rules need) is one the English pipeline
      provides: a plain English song stream, sections and stanzas declared;
  (c) every channel in its `channels` is computable for English: a phonemic
      channel always is, and a channel read on another surface is only when
      the English stream holds that surface;
  (d) its `placement` is one the planner can place: some pair of member
      positions (head, internal, end of a line) satisfies it, asked through
      `relations.placement_bindable`, the planner's own check;
  (e) it is not specifically for another language: it is left out only when
      its registry `traditions` name languages and none of them is English.
      Types whose traditions name no language (blues AAB stanza) are kept;
      that is R2's reading of John's ruling, not his explicit words.

Rule (e), and the exclusions in (a), follow John's ruling (about 17:35Z),
quoted verbatim: "if it's not specifically for English then it doesn't count
for English", "homoioteleuton stays forbidden", "a Germanic rule should not
apply to every language" and "keep Trite rhymes out as well".

A type the planner refuses is refused there by name, never substituted.

Usage (from the repository root):
  python3 scripts/lyric_type_menu.py           # write src/pages/lyric_types.json
  python3 scripts/lyric_type_menu.py --check   # exit 1 when that file differs
"""
import itertools
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HARNESS = os.path.join(ROOT, "lyric-harness")
OUT = os.path.join(ROOT, "src", "pages", "lyric_types.json")
REL = os.path.relpath(OUT, ROOT)
POSITIONS = ("head", "internal", "end")


def eligible():
    sys.path.insert(0, HARNESS)
    from quality import relations as R
    from quality.phonology import get as get_phonology
    lines = ["one", "two", "three", "four"]
    st = R.build_stream(lines, get_phonology("eng"), sections=["S"] * 4,
                        stanzas=[0] * 4, stanza_source="declared_sections",
                        declaration={"language": "eng"})
    out = []
    for index, (name, schema) in enumerate(R.REGISTRY.items()):
        if schema.normative != "attested":                          # (a)
            continue
        if any(st.supply(c).state != "present"                      # (b)
               for c in schema.capabilities()):
            continue
        if any(c.surface != "phonemic" and not st.provides(c.surface)
               for c in schema.channels):                           # (c)
            continue
        if not any(R.placement_bindable(schema, pair)               # (d)
                   for pair in itertools.product(POSITIONS, repeat=2)):
            continue
        langs = {getattr(t, "lang", "") for t in schema.traditions} - {""}
        if langs and "eng" not in langs:                            # (e)
            continue
        out.append((index, name))
    return out


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
