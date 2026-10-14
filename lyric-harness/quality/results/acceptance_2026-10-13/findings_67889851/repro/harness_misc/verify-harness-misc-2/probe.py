"""verify-harness-misc-2: do pronunciation_variants (and siblings) agree with
transcribe_word for un-normalised bare spellings?  usage: probe.py TREE MODE OUT
MODE = v2 | v1 (candidate, explicit reader_scheme) | base (pre-batch tree)."""
import json, os, sys, unicodedata
TREE, MODE, OUT = sys.argv[1], sys.argv[2], os.path.abspath(sys.argv[3])
H = os.path.join(TREE, "lyric-harness"); os.chdir(H); sys.path.insert(0, H)
import lyric_harness as LH
from quality import lexicon_supplement as LS
from quality.phonology.eng import English
BASE = MODE == "base"
kw = {} if BASE else {"reader_scheme": MODE}
SL = LS.SupplementedLexicon(version=LS.canonical_version("v2"), **kw)
PL = LH.Lexicon(**kw)
ENG_S = English(lexicon=SL, **kw)
ENG_P = English(lexicon=PL, **kw)
def safe(f):
    try:
        r = f()
        return r if not hasattr(r, "phones") else ["Reading", list(r.phones), r.source if hasattr(r, "source") else None]
    except Exception as e:
        return f"EXC {type(e).__name__}: {e}"
WORDS = ["twenty-two", "twenty‐two", "twenty‑two", "twen­ty-two",
         "twenty-two­", "streetlight", "street­light", "streetli­ght",
         "café", "café", "hel­lo", "hello", "Twenty‐Two"]
out = {"tree": TREE, "mode": MODE, "has_normalise_word": hasattr(LH, "normalise_word")}
for w in WORDS:
    nw = LH.normalise_word(w) if hasattr(LH, "normalise_word") else None
    row = {
      "S.transcribe_word": safe(lambda: SL.transcribe_word(w)),
      "S.pronunciation_variants(raw)": safe(lambda: SL.pronunciation_variants(w)),
      "S.pronunciation_variants(normalised)": safe(lambda: SL.pronunciation_variants(nw)) if nw is not None else None,
      "S.whole_reading(raw)": safe(lambda: SL.whole_reading(w)),
      "S.dictionary_readings(raw)": safe(lambda: SL.dictionary_readings(w)),
      "P.transcribe_word": safe(lambda: PL.transcribe_word(w)),
      "P.pronunciation_variants(raw)": safe(lambda: PL.pronunciation_variants(w)),
      "P.pronunciation_variants(normalised)": safe(lambda: PL.pronunciation_variants(nw)) if nw is not None else None,
      "EngS.read(raw)": safe(lambda: ENG_S.read(w)),
      "EngP.read(raw)": safe(lambda: ENG_P.read(w)),
      "S.transcribe('so '+w)": safe(lambda: list(SL.transcribe("so " + w))),
    }
    if not BASE:
        row["line_tokens_v2('so '+w)"] = safe(lambda: LH.line_tokens("so " + w, scheme="v2"))
    out[w.encode("unicode_escape").decode()] = row
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=repr)
print("wrote", OUT)
