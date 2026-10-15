"""null-and-variants (b): bare-word lookups on one tree, under v1 and v2.
Run with cwd = <tree>/lyric-harness.  argv: OUT.json"""
import copy, json, sys, os
sys.path.insert(0, os.getcwd())
import lyric_harness as LH
import quality.lexicon_supplement as LS
import quality.pronunciation as PRON
from quality.phonology.eng import English
SH, H10, H11 = "­", "‐", "‑"
TASK = ["twenty" + H10 + "two", "twen" + SH + "ty-two", "twenty-two" + SH,
        "street" + SH + "light", "hel" + SH + "lo", "twenty" + H11 + "two"]
EXTRA = ["eighty" + H10 + "two", "eighty" + H11 + "two", "eigh" + SH + "ty-two", "eighty-two" + SH,
         "re" + SH + "ad", "li" + SH + "ve", "street" + SH + "li" + SH + "ght", "Hel" + SH + "lo",
         "twenty" + SH + "-two", "twenty-" + SH + "two"]
PLAIN = ["twenty-two", "streetlight", "hello", "read", "live", "eighty-two"]
WORDS = TASK + EXTRA + PLAIN

def safe(f, *a):
    try:
        r = f(*a)
        return [list(x) for x in r] if isinstance(r, list) and r and isinstance(r[0], (list, tuple)) else (
            list(r) if isinstance(r, tuple) else r)
    except Exception as e:
        return f"EXC {type(e).__name__}: {e}"

out = {}
for scheme in ("v1", "v2"):
    with LH.reader_scheme_scope(scheme):
        L = LH.Lexicon(reader_scheme=scheme)
        SL = LS.SupplementedLexicon(version=LS.canonical_version("v2"), reader_scheme=scheme)
        E = English(lexicon=L)
        ES = English(lexicon=SL)
        for w in WORDS:
            toks = safe(LH.line_tokens, "I " + w, True, scheme)
            tok = toks[-1] if isinstance(toks, list) and len(toks) > 1 else None
            pv = safe(L.pronunciation_variants, w)
            spv = safe(SL.pronunciation_variants, w)
            rec = {
                "lex.pronunciation_variants": pv,
                "lex.transcribe_word": safe(L.transcribe_word, w),
                "PRON.dictionary_readings(lex)": safe(PRON.dictionary_readings, L, w),
                "English(lex).parses#": safe(lambda x: len(E.parses(x)), w),
                "line_tokens('I '+w)": toks,
                "lex.pv(token)": safe(L.pronunciation_variants, tok) if tok is not None else None,
                "lex.transcribe_word(token)": safe(L.transcribe_word, tok) if tok is not None else None,
                "sup.pronunciation_variants": spv,
                "sup.transcribe_word": safe(SL.transcribe_word, w),
                "sup.whole_reading": safe(SL.whole_reading, w),
                "sup.dictionary_readings": safe(SL.dictionary_readings, w),
                "PRON.dictionary_readings(sup)": safe(PRON.dictionary_readings, SL, w),
                "sup.reading_source(w, pv[0])": safe(SL.reading_source, w, spv[0]) if isinstance(spv, list) and spv else None,
                "sup.pv(token)": safe(SL.pronunciation_variants, tok) if tok is not None else None,
                "sup.whole_reading(token)": safe(SL.whole_reading, tok) if tok is not None else None,
                "English(sup).parses#": safe(lambda x: len(ES.parses(x)), w),
            }
            out[f"{scheme}|{w!a}"] = rec
        # DECLARED readings, production path: Lexicon(pronunciations=rows) -> for_line -> for_token
        for plain, phones in (("read", ["R", "EH1", "D"]), ("live", ["L", "IH1", "V"]),
                              ("hello", ["HH", "EH0", "L", "OW1"]), ("twenty-two", ["T", "W", "EH1", "N", "IY0", "T", "UW1"]),
                              ("streetlight", ["S", "T", "R", "IY1", "T", "L", "AY0", "T"])):
            line = "I " + plain
            rows = [{"line": line, "token": 2, "word": plain, "phones": phones, "basis": "declared", "source": "probe"}]
            for kind, mk in (("lex", lambda: LH.Lexicon(reader_scheme=scheme, pronunciations=rows)),
                             ("sup", lambda: LS.SupplementedLexicon(version=LS.canonical_version("v2"), reader_scheme=scheme, pronunciations=rows))):
                try:
                    D = mk()
                    T = PRON.for_token(PRON.for_line(D, line), 1)
                    rec = {"choice_set": bool(getattr(T, "_pronunciation_choice", None))}
                    for w in [plain] + [x for x in WORDS if LH.normalise_word(x).lower() == plain]:
                        rec[f"pv {w!a}"] = safe(T.pronunciation_variants, w)
                        rec[f"tw {w!a}"] = safe(T.transcribe_word, w)
                        if kind == "sup":
                            rec[f"whole {w!a}"] = safe(T.whole_reading, w)
                    rec["line_anchors"] = safe(lambda: [list(a) if isinstance(a, (list, tuple)) else repr(a) for a in (LH.line_anchors(D, line) or [])])
                except Exception as e:
                    rec = f"EXC {type(e).__name__}: {e}"
                out[f"{scheme}|DECLARED|{kind}|{plain}"] = rec
json.dump(out, open(sys.argv[1], "w"), indent=1, ensure_ascii=True, default=repr)
print(len(out), "records")
