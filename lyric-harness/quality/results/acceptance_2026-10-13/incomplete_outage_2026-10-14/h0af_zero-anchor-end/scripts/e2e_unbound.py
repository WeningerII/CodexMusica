"""End-to-end: the REAL revise_loop with its stock stubs on drafts whose end-rhyme group
holds a line whose default end the grader binds ZERO syllables on. Records every
swap_at_slot call the loop and the reviser make (caller, slot, line, result) and
whether the line's default end is bound.

    cd <tree>/lyric-harness
    python -I e2e_unbound.py ROOT OUT.json
"""
import json
import os
import sys
import time
from collections import Counter

ROOT = os.path.abspath(sys.argv[1])
OUT = sys.argv[2]
sys.path.insert(0, ROOT)
os.chdir(ROOT)
import lyric_harness as LH  # noqa: E402,F401
from quality import slots as SL  # noqa: E402
import quality.loop as LP  # noqa: E402
from quality.revise import Reviser, ReviseDeclaration  # noqa: E402
from quality.schemes import mandate  # noqa: E402
from quality.coverage_census import build_lexicon  # noqa: E402
from quality import lexicon_supplement as LS  # noqa: E402

CALLS = []
REAL = LP.swap_at_slot


def recorder(text, slot, new_word, scheme=None, strip_parens=None, lex=None):
    out = REAL(text, slot, new_word, scheme=scheme, strip_parens=strip_parens, lex=lex)
    CALLS.append({"text": text, "slot": slot, "word": new_word, "lex": lex, "out": out,
                  "caller": sys._getframe(1).f_code.co_name})
    return out


LP.swap_at_slot = recorder

DRAFTS = [
    ("unread_end", ["the night was zzqx", "I hold you tight", "we sail by light"]),
    ("enclitic_witness_ain", ["An' Charlie he 's our ain.", "the night is long and plain", "we walk again"]),
    ("enclitic_witness_auch", ["My wrath I 'll vent forth upon old Auchtertool.", "the bells ring out at school", "he was a fool"]),
    ("margin_numeral", ["'Till the Canon atoned the deed,              _110", "the night is dark", "we walk the park"]),
    ("numeral_end", ["and so we sang it 45", "the night is alive", "we strive"]),
    ("readable_control", ["the night was cold", "I hold you tight", "we sail by light"]),
]


def main():
    t0 = time.time()
    LX = {"sup:stripped": build_lexicon("v2", "none"),
          "sup:voices": LS.SupplementedLexicon(fallback=None, strip_parens=False,
                                               version=LS.canonical_version("v2"))}
    runs = []
    tally = Counter()
    for mode, lex in LX.items():
        for name, lines in DRAFTS:
            rv = Reviser(lex, rdecl=ReviseDeclaration(max_rounds=2, attempts_per_line=3))
            m = mandate([[1, 2, 3]], n_lines=3, default_relation="class:RHYME")
            start = len(CALLS)
            err = None
            try:
                res = LP.revise_loop(rv, list(lines), m)
                stop, final = res.stop_reason, res.lines
            except Exception as e:  # noqa: BLE001
                err, stop, final = f"{type(e).__name__}: {e}", None, None
            calls = []
            for c in CALLS[start:]:
                default = SL.is_default(c["slot"])
                bound = None
                if default and c["lex"] is not None:
                    bound = bool(SL.resolve(c["lex"], c["text"], 1)[0])
                k = (mode, name, c["caller"], "end" if default else "slot",
                     "bound" if bound else ("unbound" if bound is False else "n/a"),
                     "edit" if c["out"] is not None else "refuse")
                tally[k] += 1
                calls.append({"caller": c["caller"], "text": c["text"], "default": default,
                              "bound": bound, "word": c["word"], "out": c["out"]})
            runs.append({"mode": mode, "draft": name, "stop": stop, "error": err, "final": final,
                         "n_calls": len(calls),
                         "unbound_end_edits": [c for c in calls if c["default"] and c["bound"] is False and c["out"] is not None],
                         "unbound_end_calls": sum(1 for c in calls if c["default"] and c["bound"] is False)})
            print(mode, name, stop, err, len(calls), "unbound-end calls", runs[-1]["unbound_end_calls"],
                  "edits", len(runs[-1]["unbound_end_edits"]), "final", final, f"{time.time()-t0:.0f}s", flush=True)
    json.dump({"seconds": round(time.time() - t0), "tally": {"|".join(k): v for k, v in sorted(tally.items())},
               "runs": runs}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)


if __name__ == "__main__":
    main()
