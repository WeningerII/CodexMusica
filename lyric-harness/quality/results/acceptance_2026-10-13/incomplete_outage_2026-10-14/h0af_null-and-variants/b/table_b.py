import json
c = json.load(open("probe_0af.json")); p = json.load(open("probe_695.json"))
def s(x):
    if x is None: return "-"
    if isinstance(x, list) and len(x) == 2 and isinstance(x[0], list) and not isinstance(x[1], list):
        return " ".join(x[0]) + " /" + str(x[1])
    if isinstance(x, list) and x and all(isinstance(y, list) and all(isinstance(z, str) for z in y) for y in x): return "|".join(" ".join(y) for y in x)
    return json.dumps(x, ensure_ascii=True)
TASK = ["'twenty\\u2010two'", "'twen\\xadty-two'", "'twenty-two\\xad'", "'street\\xadlight'", "'hel\\xadlo'", "'twenty\\u2011two'"]
fields = ["lex.pronunciation_variants", "lex.transcribe_word", "PRON.dictionary_readings(lex)", "line_tokens('I '+w)", "lex.pv(token)",
          "sup.pronunciation_variants", "sup.transcribe_word", "sup.whole_reading", "sup.dictionary_readings", "sup.reading_source(w, pv[0])", "sup.pv(token)", "English(lex).parses#"]
for w in TASK + ["'twenty-two'", "'streetlight'", "'hello'"]:
    for sch in ("v1", "v2"):
        k = f"{sch}|{w}"
        print(f"### {k}")
        for f in fields:
            a, b = p[k][f], c[k][f]
            print(f"   {f:32s} 695={s(a):48s} 0af={s(b)}" + ("" if a == b else "   <-- CHANGED"))
print()
print("== v2 agreement at 0af (cand)")
for k, r in c.items():
    if "|DECLARED|" in k or not k.startswith("v2|"): continue
    pv, tw, tk = r["lex.pronunciation_variants"], r["lex.transcribe_word"], r["lex.pv(token)"]
    spv, stw, stk, wr = r["sup.pronunciation_variants"], r["sup.transcribe_word"], r["sup.pv(token)"], r["sup.whole_reading"]
    dr, sdr = r["PRON.dictionary_readings(lex)"], r["sup.dictionary_readings"]
    a1 = (pv[0] == tw[0]) if pv else ("oov" if tw[1] else "g2p")
    a2 = (spv[0] == stw[0]) if spv else ("oov" if stw[1] else "g2p")
    print(f"{k:28s} lex: pv0==tw {a1!s:5} pv==pv(tok) {pv==tk!s:5} | sup: pv0==tw {a2!s:5} pv==pv(tok) {spv==stk!s:5} whole==pv0 {(wr is None and not spv) or bool(wr and wr[0]==spv[0])!s:5} | dict_readings==pv lex {dr==pv!s:5} sup {sdr==spv!s:5}")
print()
print("== DECLARED (production path Lexicon(pronunciations=rows) -> for_line -> for_token), 0af vs 695")
for k in c:
    if "|DECLARED|" not in k: continue
    for f in c[k]:
        print(f"{k:34s} {f:26s} 695={s(p[k][f]):44s} 0af={s(c[k][f])}" + ("" if p[k][f] == c[k][f] else "  <-- CHANGED"))
