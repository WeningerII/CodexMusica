import json, sys, glob, os, re
d = sys.argv[1]
rows = []
for f in sorted(glob.glob(os.path.join(d, "*.out"))):
    name = os.path.basename(f)[:-4]
    txt = open(f, encoding="utf-8").read()
    lr = [l for l in txt.splitlines() if l.startswith("  lyric result: ")]
    ex = open(f[:-4] + ".exit").read().strip() if os.path.exists(f[:-4] + ".exit") else "?"
    if not lr:
        rows.append((name, ex, "NO RESULT", "")); continue
    r = json.loads(lr[-1][len("  lyric result: "):])
    cov = r.get("coverage", {})
    rh = {o["id"]: o["status"] for o in cov.get("obligations", []) if o["layer"] == "rhyme"}
    su = [f["code"] for f in r.get("findings", []) if f["code"].startswith("SCHEME_UNREADABLE")]
    must = re.findall(r"must answer group [^\n]*", txt)
    rows.append((name, ex, f"scheme={r.get('reader_scheme')} status={r.get('status')} certified={cov.get('certified')} "
                 f"judged={cov.get('pairs_judged')} refused={cov.get('pairs_refused')} rhyme={rh} "
                 f"SCHEME_UNREADABLE={len(su)} sup={r.get('lexicon',{}).get('supplement_id')}",
                 " || ".join(sorted(set(must)))))
for n, ex, s, m in rows:
    print(f"{n:24s} {ex:7s} {s}\n{'':32s}{m}")
