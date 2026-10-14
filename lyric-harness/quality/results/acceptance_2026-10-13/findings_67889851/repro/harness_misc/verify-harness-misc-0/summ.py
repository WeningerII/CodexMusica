import json,re,glob,sys
for f in sorted(glob.glob(sys.argv[1] + "/brief_*.out")):
    t=open(f).read()
    m=re.search(r"lyric result: (\{.*\})\s*$", t, re.M)
    ma=[l.strip() for l in t.splitlines() if "must answer group A" in l]
    tm=[l for l in t.splitlines() if l.startswith("real")]
    if not m: print(f.split("/")[-1], "NO RESULT", t[:300].replace("\n"," | ")); continue
    d=json.loads(m.group(1)); c=d["coverage"]
    print(f.split("/")[-1], "| judged",c["pairs_judged"],"refused",c["pairs_refused"],"certified",c["certified"],"scheme",d.get("reader_scheme"),"lexicon",d.get("lexicon"),"| SCHEME_UNREADABLE" if any(x["code"]=="SCHEME_UNREADABLE" for x in d["findings"]) else "", "|", ma[-1][:90] if ma else "", "|", tm)
