import json, sys, re
for p in sys.argv[1:]:
    txt = open(p).read()
    m = re.search(r'lyric result: (\{.*\})\n', txt)
    if not m:
        print(p, "NO RESULT"); continue
    r = json.loads(m.group(1))
    cov = r.get("coverage", {})
    rh = [o for o in cov.get("obligations", []) if o["layer"] == "rhyme"]
    codes = [f["code"] for f in r.get("findings", [])]
    must = [l.strip() for l in txt.splitlines() if "must answer" in l]
    print(f"{p.split('/')[-1]:28s} scheme={r.get('reader_scheme')} certified={cov.get('certified')} judged={cov.get('pairs_judged')} refused={cov.get('pairs_refused')} rhyme={[o['status'] for o in rh]} codes={codes}")
    for l in must: print("      ", l)
