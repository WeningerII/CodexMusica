#!/usr/bin/env python3
"""Capture the frozen v1 reader oracle (`reader_v1_oracle.json`).

Run ONCE, against the pre-batch tree (commit fce4bf0f, before the reader
batch existed), from that tree's `lyric-harness/`:

    PYTHONPATH=<pre-batch lyric-harness> python3 quality/fixtures/capture_reader_v1_oracle.py OUT

It records what the shipped reader returned on the generated lines of
`quality/reader_cases.py` (copied beside the capture, since the pre-batch
tree does not have it) and on its regression reproductions: the tokenizer
(`line_tokens`, `raw_final_token`, the word list `Lexicon.transcribe`
cuts), and on a subset the consumers a legacy replay must reproduce byte for
byte (`line_anchors`, `line_readability`, `word_syllable_map`,
`fit.read_line`, the relations stream's English token source,
`rime_cmudict.end_occurrence`, `loop.swap_end_word`, and declaration
validation on the last sung token), and the stdout of a few CLI calls
(`CLI_CASES`). `quality/test_reader.py` compares the
post-batch scheme `v1` against it. Re-running this on a post-batch tree
measures nothing: the file is the pre-batch record, kept verbatim.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(os.path.dirname(HERE)))


def _syl(s):
    return [s["nucleus"], list(s["coda"]), list(s["onset"]), s["stress"],
            s.get("widx"), s.get("word")]


def consumers(lex, text, LH, FT, RL, G, loop, validate_choices, rck):
    anchors, last, oov = LH.line_anchors(lex, text)
    rec = LH.line_readability(lex, text)
    wsm = [[s["word"], s["widx"], s["nucleus"], s["stress"]]
           for s in LH.word_syllable_map(lex, text)]
    lu = FT.read_line(text)
    fit = {"tokens": list(lu.tokens),
           "units": [[u.text, u.word, u.widx, u.prominence] for u in lu.units],
           "refused": [[r.token, r.cause] for r in lu.refused]}
    from quality.phonology.eng import English
    stream_tokens = English().tokens_for_line(text)
    stream = (list(stream_tokens) if stream_tokens is not None
              else ["<tokenise>"] + list(RL.tokenise(text)))
    word, token, key = rck.end_occurrence(text)
    words = LH.line_tokens(text, strip_parens=lex.strip_parens)
    decl = None
    if words:
        try:
            validate_choices([{"line": text, "token": len(words), "word": words[-1],
                               "phones": ["AH1"], "basis": "declared",
                               "source": "oracle"}], lex)
            decl = "valid"
        except ValueError as e:
            decl = str(e)
    return {"anchors": [[_syl(s) for s in a] for a in anchors], "last": last,
            "oov": list(oov), "readability": rec, "wsm": wsm, "fit": fit,
            "stream": stream, "end_occurrence": [word, token, key],
            "swap": loop.swap_end_word(text, "zing"), "declaration": decl}


#: CLI calls whose pre-batch stdout is recorded (`--reader-scheme=v1` must
#: reproduce it; a `lyric result:` record may differ only by `reader_scheme`).
CLI_CASES = [
    ["score", "we sing 4ever -- we sing together"],
    ["score", "thee--Arise -- a rise"],
    ["score", "Read cafe\u0301s -- safes"],
    ["score", "I love the B-52s -- bees"],
    ["score", "co\u2010operate -- separate"],
    ["score", "U--h, Lawdy -- gaudy"],
    ["score", "There 's (oh) 'em ol' 4ever--no -- below"],
    ["scheme", "AABB", "we sing 4ever", "we sing together", "the year 1999", "I read Catch-22"],
    ["scheme", "ABAB", "thee--Arise", "soft\u00adware", "the wise", "aware"],
]


def cli_outputs():
    import subprocess
    root = os.path.dirname(os.path.dirname(HERE))
    env = {k: v for k, v in os.environ.items() if k != "LYRIC_CONTROL_TOKEN"}
    out = []
    for argv in CLI_CASES:
        r = subprocess.run([sys.executable, os.path.join(root, "lyric_harness.py")] + argv,
                           capture_output=True, text=True, env=env, cwd=root, timeout=600)
        out.append({"argv": argv, "exit": r.returncode, "stdout": r.stdout})
    return out


def main(out):
    import lyric_harness as LH
    import quality.fit as FT
    import quality.relations as RL
    import quality.grid as G
    import quality.loop as loop
    from quality.pronunciation import validate_choices
    import reader_cases as RC
    lines = RC.generated_lines() + RC.REGRESSIONS
    lexes = {True: LH.Lexicon(strip_parens=True), False: LH.Lexicon(strip_parens=False)}
    rows = []
    for text in lines:
        row = {"text": text}
        for sp in (True, False):
            row["sp" if sp else "keep"] = {
                "line_tokens": LH.line_tokens(text, strip_parens=sp),
                "raw_final_token": LH.raw_final_token(text, strip_parens=sp),
                "transcribe_words": lexes[sp].transcribe(text)[1],
            }
        rows.append(row)
    rck = G.rime_cmudict(lexes[True])
    subset = RC.generated_lines()[:400] + RC.REGRESSIONS
    legacy = [{"text": t, **consumers(lexes[True], t, LH, FT, RL, G, loop,
                                      validate_choices, rck)} for t in subset]
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"captured_at": "fce4bf0f (pre-batch origin/main)",
                   "generator": "quality/reader_cases.py generated_lines() + REGRESSIONS",
                   "tokenizer": rows, "legacy": legacy, "cli": cli_outputs()},
                  fh, ensure_ascii=False, indent=0, sort_keys=True)
        fh.write("\n")


if __name__ == "__main__":
    main(sys.argv[1])
