"""BB8 harness-misc task 1: reader-scheme cache leak probe.

usage: python3 cachetest.py TREE OUT.json REQ [REQ ...]
  REQ = <name>@<scheme>, run in THIS process in the given order, through the
  warm worker's own entrance (mcp/worker.py run_one) for CLI requests and
  through reader_scheme_scope for the in-process API request ("api").
"""
import json
import os
import sys

TREE, OUT = sys.argv[1], os.path.abspath(sys.argv[2])
REQS = sys.argv[3:]
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(TREE, "mcp"))
import worker  # noqa: E402  (chdirs to TREE/lyric-harness, imports lyric_harness)
import lyric_harness as LH  # noqa: E402

BP = os.path.join(HERE, "bp.json")
DRAFT = os.path.join(HERE, "draft.txt")
DRAFT2 = os.path.join(HERE, "draft2.txt")
LINES = ["Oh--oh, oh my love",
         "Thundered the battery’s double bass--",
         "I know it 's true",
         "The river owes us nothing, not since 1999",
         "Catch-22 and 4ever (oh--oh) we sang",
         "o’er the hill the café (my love) stands"]
SONG_TAIL = ["--input-format=literal", "--groups=2,3,4;5,6;7,8;10,11;15,16",
             "--returns=7,12;8,13;9,14", "--subdivision", "1"]
PRON = json.dumps([{"line": "The river owes us nothing, not since 1999",
                    "token": 8, "word": "1999",
                    "phones": "N AY1 N T IY1 N N AY1 N T IY0 N AY1 N".split(),
                    "basis": "declared", "source": "bb8 probe"}])


def argv_for(name, s):
    g = [f"--reader-scheme={s}"]
    if name == "meter":
        return g + ["meter", "./././././"] + LINES
    if name == "meterlow":
        return g + ["--fallback=low", "meter", "./././././"] + LINES
    if name == "gradesup":
        return g + ["--lexicon-supplement=v2", "song", BP, DRAFT] + SONG_TAIL
    if name == "gradeplain":
        return g + ["song", BP, DRAFT] + SONG_TAIL
    if name == "gradevoices":
        return g + ["--voices", "song", BP, DRAFT2] + SONG_TAIL
    if name == "gradepron":
        return g + ["--lexicon-supplement=v2", f"--pronunciations={PRON}",
                    "song", BP, DRAFT] + SONG_TAIL
    raise SystemExit(f"unknown request {name}")


def api(s):
    import quality.meter_bands as MB
    import quality.fit as FT
    from quality.phonology.eng import English
    out = {}
    with LH.reader_scheme_scope(s):
        ph = MB.reader("fallback-low")
        for t in LINES:
            r = {}
            r["measure_default"] = repr(MB.measure_line(t))
            r["measure_low"] = repr(MB.measure_line(t, phon=ph))
            lu = FT.read_line(t, phon=ph)
            r["read_low"] = repr((lu.units, lu.refused, lu.tokens, lu.segments,
                                  lu.prominence_runs))
            lu2 = FT.read_line(t)
            r["read_default"] = repr((lu2.units, lu2.refused, lu2.tokens,
                                      lu2.prominence_runs))
            lu3 = FT.read_line(t, phon=ph, strip_parens=False)
            r["read_low_voices"] = repr((lu3.units, lu3.refused, lu3.tokens))
            e = English()
            r["eng_tokens"] = repr(e.tokens_for_line(t))
            r["eng_low_tokens"] = repr(ph.tokens_for_line(t))
            r["eng_boundary"] = repr(e.printed_boundary(t))
            r["eng_low_derived"] = repr(ph.derived(t))
            r["eng_unreadable"] = repr(e.unreadable(t)) if hasattr(e, "unreadable") else None
            r["eng_low_unreadable"] = repr(ph.unreadable(t)) if hasattr(ph, "unreadable") else None
            r["eng_split_final"] = repr(e.split_final(t))
            r["lex_scheme_seen"] = (ph._lexicon().reader_scheme,
                                    ph._fallback().lex.reader_scheme
                                    if hasattr(ph._fallback().lex, "reader_scheme") else None)
            out[t] = r
    return out


results = []
for req in REQS:
    name, s = req.split("@")
    if name == "api":
        results.append({"req": req, "api": api(s)})
        continue
    code, so, se = worker.run_one(argv_for(name, s))
    results.append({"req": req, "argv": argv_for(name, s), "code": code,
                    "stdout": so, "stderr": se,
                    "scheme_after": LH._ACTIVE_READER_SCHEME})
json.dump(results, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote", OUT, [(r["req"], r.get("code")) for r in results])
