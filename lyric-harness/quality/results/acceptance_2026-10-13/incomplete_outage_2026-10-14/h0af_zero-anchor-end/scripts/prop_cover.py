"""Which lines does test_every_v2_edit_lands_on_the_bound_token exercise for the unbound default end,
and are the 5 spaced-enclitic witnesses (or any spaced-enclitic end) among them?
usage: cd <tree>/lyric-harness; python -I prop_cover.py ROOT analysis.json"""
import json, os, sys, re
from pathlib import Path
ROOT = os.path.abspath(sys.argv[1]); sys.path.insert(0, ROOT); os.chdir(ROOT)
import lyric_harness as LH
from quality import slots as SL
lines = []
for p in sorted((Path(ROOT) / "corpus" / "song").glob("eng_*.txt"))[::7]:
    lines += [ln for ln in LH.load_lyric_lines(str(p))][:120]
lines = lines[:1200]
st = LH.Lexicon(reader_scheme="v2"); su = LH.Lexicon(reader_scheme="v2", strip_parens=False)
A = json.load(open(sys.argv[2], encoding="utf-8"))["a"]["v2plain:stripped"]["rows"]
wit = [r["line"] for r in A if r["spaced_enclitic_excluded_by_slot_tool"]]
unb = {m: [t for t in lines if not SL.resolve(lx, t, 1)[0]] for m, lx in (("stripped", st), ("sung", su))}
enc = re.compile(r"\s['’](s|m|ll|re|ve|d|t)\b", re.I)
print("property-test lines", len(lines), "unbound default end:", {m: len(v) for m, v in unb.items()})
print("witnesses in property lines:", [w for w in wit if w in lines])
print("unbound lines with a spaced enclitic:", {m: [t for t in v if enc.search(t)] for m, v in unb.items()})
print("unbound (stripped):", unb["stripped"])
