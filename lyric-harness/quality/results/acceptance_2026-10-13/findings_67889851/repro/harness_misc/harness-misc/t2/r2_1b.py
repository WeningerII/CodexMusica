"""BB8 harness-misc task 2: R2's earlier 1b findings (a)-(e), executed.

usage: python3 r2_1b.py TREE MODE OUT.json      MODE = v2 | v1 | base
  v2/v1 run in the candidate tree under that reader scheme (process scope AND
  explicit scheme arguments); `base` runs the pre-batch tree with no scheme.
"""
import contextlib
import json
import os
import sys
import traceback

TREE, MODE, OUT = sys.argv[1], sys.argv[2], os.path.abspath(sys.argv[3])
H = os.path.join(TREE, "lyric-harness")
os.chdir(H)
sys.path.insert(0, H)
import lyric_harness as LH  # noqa: E402
import quality.loop as LOOP  # noqa: E402
import quality.grid as GR  # noqa: E402
import quality.relations as R  # noqa: E402
import quality.revise as RV  # noqa: E402
from quality.phonology.eng import English  # noqa: E402
from quality import lexicon_supplement as LS  # noqa: E402

BASE = MODE == "base"
SK = {} if BASE else {"scheme": MODE}
scope = contextlib.nullcontext() if BASE else LH.reader_scheme_scope(MODE)


def lex(**kw):
    if not BASE:
        kw["reader_scheme"] = MODE
    return LH.Lexicon(**kw)


def safe(fn):
    try:
        return fn()
    except Exception as e:  # recorded, never hidden
        return f"EXC {type(e).__name__}: {e}"


out = {"mode": MODE, "tree": TREE}
with scope:
    L0 = lex()
    LV = lex(strip_parens=False)

    # (a) swap_end_word on a line whose printed end is not the last raw run
    a = {}
    for t in ["I said ×", "× marks the spot", "love ×night",
              "x ×2", "I said yes", "K1×δQ", "sing÷δnight",
              "I love you (love you)", "say it × 2"]:
        a[t] = {
            "swap_end_word": safe(lambda: LOOP.swap_end_word(t, "zebra", **SK)),
            "line_tokens": safe(lambda: LH.line_tokens(t, **SK)),
            "raw_final_token": safe(lambda: LH.raw_final_token(t, **SK)),
            "line_anchors_end": safe(lambda: list(LH.line_anchors(L0, t)[1:])),
            "n_anchors": safe(lambda: len(LH.line_anchors(L0, t)[0])),
        }
    out["a_swap_end_word"] = a

    # (b) build_stream's split (broken-rhyme) flag on non-ASCII line ends
    b = {}
    ph = English()
    for t in ["the crown of the king-", "the crown of the king‐",
              "the crown of the king‑", "the crown of the king­-",
              "the crown of the king-­", "the crown of the café-",
              "the crown of the café-", "the crown of the kings’-",
              "Thundered the battery’s double bass--",
              "the crown of the king -", "the crown of the king‐ "]:
        def one():
            st = R.build_stream([t, "dom is gone"], ph)
            last = [st.units[i] for i in st.lines[0]][-1] if st.lines[0] else None
            first = [st.units[i] for i in st.lines[1]][0] if st.lines[1] else None
            return {"tokens0": list(st.lexical_tokens[0]),
                    "last_unit_token": last.token_text if last else None,
                    "split_right": last.split_right if last else None,
                    "next_split_left": first.split_left if first else None,
                    "unreadable": [list(x) for x in st.unreadable]}
        b[t] = safe(one)
    out["b_split_right"] = b

    # (c) grid rime key: end_occurrence on a fragment end
    c = {}
    for lx_name, lx in (("plain", L0), ("voices", LV)):
        key = GR.rime_cmudict(lx)
        for t in ["I said ×", "× marks the spot", "love ×night",
                  "x ×2", "I said yes", "the night̳",
                  "the night (of ×)", "the end (of the night)"]:
            c[f"{lx_name} | {t}"] = {
                "end_occurrence": safe(lambda: list(key.end_occurrence(t))),
                "qafiya_endword": safe(lambda: LH._qafiya_parts(lx, t).get("endword")),
                "qafiya_unreadable": safe(lambda: LH._qafiya_parts(lx, t).get("unreadable")),
                "line_anchors_end": safe(lambda: list(LH.line_anchors(lx, t)[1:])),
            }
        fails = []
        c[f"{lx_name} | _rhyme_code(['I said ×','where they led'])"] = safe(
            lambda: [GR._rhyme_code(["I said ×", "where they led"], key,
                                    failures=fails), repr(fails)])
    out["c_grid_fragment_key"] = c

    # (d) any-reading pin through the relation stream, asides sung (--voices)
    d = {}
    sch = R.REGISTRY["perfect rhyme"]
    cases = [
        ("end word in aside (bed)", ["she wrote it all (and read)", "and went to bed"], (0, -1), (1, -1)),
        ("end word in aside (seed)", ["she wrote it all (and read)", "the sowing seed"], (0, -1), (1, -1)),
        ("control: no aside (bed)", ["she wrote it all and read", "and went to bed"], (0, -1), (1, -1)),
        ("control: no aside (seed)", ["she wrote it all and read", "the sowing seed"], (0, -1), (1, -1)),
        ("mid-line aside word T1 (bed)", ["the (read) letter burned", "and went to bed"], (0, 1), (1, -1)),
        ("two-reading word in aside, end outside (seed)", ["she (would read) and wept", "the sowing seed"], (0, 2), (1, -1)),
        ("negative: aside read vs hat", ["she wrote it all (and read)", "he lost his hat"], (0, -1), (1, -1)),
    ]
    for name, lines, at_a, at_b in cases:
        for lx_name, lx in (("plain", L0), ("voices", LV)):
            def one():
                phon = RV.relation_phonology_for(lx)
                st = R.build_stream(lines, phon)
                build = R.cached_builder(lambda p: R.build_stream(lines, p))
                ans, wit = R.pair_satisfies_any(sch, st, at_a, at_b, build)
                slx = R._stream_lexicon(st)
                return {"phon": type(phon).__name__ + (
                            f"(strip_parens={getattr(phon, '_strip_parens', 'n/a')})"),
                        "stream_tokens": [list(x) for x in st.lexical_tokens],
                        "stream_lexicon_strip_parens": getattr(slx, "strip_parens", None),
                        "plain_answer": repr(R.pair_satisfies(sch, st, at_a, at_b)),
                        "any_reading_answer": repr(ans), "witness": repr(wit)}
            d[f"{name} | {lx_name}"] = safe(one)
    out["d_any_reading_pin"] = d

    # (e) SupplementedLexicon.transcribe_word before/after normalisation
    e = {}
    kw = {} if BASE else {"reader_scheme": MODE}
    SL = LS.SupplementedLexicon(version=LS.canonical_version("v2"), **kw)
    for w in ["twenty-two", "twenty‐two", "twenty‑two", "twen­ty-two",
              "twenty-two­", "streetlight", "street­light",
              "o’er", "o'er", "café", "café", "cafe",
              "don’t", "don't", "naı̈ve", "Twenty‐Two"]:
        e[w.encode("unicode_escape").decode()] = {
            "supplemented": safe(lambda: SL.transcribe_word(w)),
            "supplemented_variants": safe(lambda: SL.pronunciation_variants(w)),
            "plain_lexicon": safe(lambda: L0.transcribe_word(w)),
            "supplemented_line_transcribe": safe(lambda: list(SL.transcribe("so " + w)))
            if hasattr(SL, "transcribe") else None,
        }
    out["e_supplement_transcribe_word"] = e

json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=repr)
print("wrote", OUT)
