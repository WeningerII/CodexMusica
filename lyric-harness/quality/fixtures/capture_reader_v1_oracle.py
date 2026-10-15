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
(`CLI_CASES`); and, for bare words handed to the word-level readers
directly, `transcribe_word`, `word_pieces`, `token_pieces`,
`unread_final_piece`, `English.read`, `Fallback.read` and the grid's rhyme key
(`word_records`), with the refusal text of mismatched declarations
(`declaration_refusals`). `quality/test_reader.py` compares the
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


def oracle_words(RC):
    """-> the bare words the word-level section records: every whitespace
    chunk of the first 600 generated lines and of the regressions, as a
    direct caller (`capacity`, a word list) would pass them -- digits, soft
    hyphens, Unicode hyphens and dash runs included."""
    seen = {}
    for text in RC.generated_lines()[:600] + RC.REGRESSIONS:
        for w in text.split():
            seen.setdefault(w, None)
    return list(seen)


def word_records(words, lexes, LH, G):
    """-> one record per bare word: what the word-level readers answer when a
    caller hands them the word directly (no line cut involved). `lexes` is
    {"none": ..., "high": ..., "low": ...}, all with strip_parens=True."""
    from quality.phonology.eng import English

    def safe(f, *a):
        try:
            r = f(*a)
            if hasattr(r, "phones"):
                r = [list(r.phones), getattr(r, "layer", None), getattr(r, "source", None)]
            return json.loads(json.dumps(r, ensure_ascii=False))
        except Exception as e:  # recorded, so a moved exception is a moved answer
            return ["EXC", type(e).__name__]
    eng = {k: English(fallback=None if k == "none" else k, lexicon=lex)
           for k, lex in lexes.items()}
    rck = G.rime_cmudict(lexes["none"])
    fb = lexes["high"].g2p_fallback
    out = []
    for w in words:
        out.append({
            "word": w,
            "transcribe_word": {k: safe(lex.transcribe_word, w) for k, lex in lexes.items()},
            "word_pieces": safe(lexes["none"].word_pieces, w),
            "token_pieces": {k: safe(LH.token_pieces, lexes[k], w) for k in ("none", "high")},
            "unread_final_piece": safe(LH.unread_final_piece, lexes["none"], w),
            "english_read": {k: safe(e.read, w) for k, e in eng.items()},
            "fallback_read": safe(fb.read, w),
            "grid_key": safe(rck, w),
        })
    return out


def declaration_refusals(lines, lex):
    """-> the refusal text of a declaration naming the wrong word at a real
    position, and one naming a position past the line's end."""
    from quality.pronunciation import validate_choices
    out = []
    for text in lines:
        if not text.strip() or len(text) > 4000 or any(c in text for c in "\r\n"):
            continue
        for token in (1, 999):
            try:
                validate_choices([{"line": text, "token": token, "word": "\u00f8nope",
                                   "phones": ["AH1"], "basis": "declared",
                                   "source": "oracle"}], lex)
                got = "valid"
            except ValueError as e:
                got = str(e)
            out.append({"text": text, "token": token, "refusal": got})
    return out


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
    wlex = {"none": lexes[True], "high": LH.Lexicon(fallback="high"),
            "low": LH.Lexicon(fallback="low")}
    words = word_records(oracle_words(RC), wlex, LH, G)
    refusals = declaration_refusals(RC.generated_lines()[:200] + RC.REGRESSIONS, lexes[True])
    with open(out, "w", encoding="utf-8") as fh:
        json.dump({"captured_at": "fce4bf0f (pre-batch origin/main)",
                   "generator": "quality/reader_cases.py generated_lines() + REGRESSIONS",
                   "tokenizer": rows, "legacy": legacy, "cli": cli_outputs(),
                   "words": words, "declaration_refusals": refusals},
                  fh, ensure_ascii=False, indent=0, sort_keys=True)
        fh.write("\n")


if __name__ == "__main__":
    main(sys.argv[1])
