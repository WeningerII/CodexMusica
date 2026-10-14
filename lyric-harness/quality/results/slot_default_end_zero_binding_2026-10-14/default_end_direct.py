"""Default end, by direct call: every line where the reviser's default-end
splice edits while the grader binds ZERO syllables on that end.

    python3 -I default_end_direct.py HARNESS_ROOT POPULATION OUT.json

HARNESS_ROOT is a tree's `lyric-harness/` (an archive with the staged data
copied in); POPULATION is BB8's `slot_match_67889851/population.txt` (one
line per row). The lexicon is the slot tool's own (`coverage_census.
build_lexicon("v2", "none")`: the v2 supplemented lexicon, no fallback),
asides stripped and sung. For each line and mode it asks
`slots.resolve(lex, line, 1)` (the grader's default-end binding) and
`loop.swap_at_slot(line, 1, MARK, scheme=..., strip_parens=..., lex=lex)`
(the reviser's splice, with the keywords production passes), and records
every line where the splice edits and the binding is empty.

Unlike BB8's `slot_occurrence.py`, this keeps the lines that tool excludes
as `excluded_transformed` (its oracle cannot place a token joined across a
spaced enclitic), so it counts them too; each recorded line says whether its
last token, or any token, is such a multi-piece token. It measures only this
one question.
"""
import copy
import json
import os
import sys


def _main():
    root, population, out = sys.argv[1:4]
    sys.path.insert(0, root)
    os.chdir(root)
    import lyric_harness as LH  # noqa: E402
    from quality import slots as SL  # noqa: E402
    from quality.coverage_census import build_lexicon  # noqa: E402
    from quality.loop import swap_at_slot  # noqa: E402

    MARK = "zqzq"
    lines = [l.rstrip("\n") for l in open(population, encoding="utf-8") if l.strip()]
    base = build_lexicon("v2", "none")
    sung = copy.copy(base)
    sung.strip_parens = False
    result = {"tree": root, "population_lines": len(lines), "lexicon": "build_lexicon('v2', 'none')",
              "modes": {}}
    for mode, lex in (("stripped", base), ("sung", sung)):
        hits = []
        for line in lines:
            anchors, label, _ = SL.resolve(lex, line, 1)
            if anchors:
                continue
            new = swap_at_slot(line, 1, MARK, scheme="v2", strip_parens=lex.strip_parens, lex=lex)
            if new is None or new == line:
                continue
            toks = LH.reader_line(line, lex.strip_parens, "v2").tokens
            hits.append({"line": line, "label": label, "edited": new,
                         "last_token": toks[-1].text if toks else None,
                         "multi_piece": bool(toks) and len(toks[-1].pieces) > 1,
                         # a token joined across a spaced enclitic anywhere in
                         # the line: what the slot tool excludes as transformed
                         "any_multi_piece": any(len(t.pieces) > 1 for t in toks)})
        result["modes"][mode] = {"unbound_edits": len(hits),
                                 "multi_piece": sum(h["multi_piece"] for h in hits),
                                 "any_multi_piece": sum(h["any_multi_piece"] for h in hits),
                                 "lines": hits}
    json.dump(result, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps({m: {k: v for k, v in r.items() if k != "lines"}
                      for m, r in result["modes"].items()}))


if __name__ == "__main__":
    _main()
