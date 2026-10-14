import json, sys
recs = json.load(open(sys.argv[1]))
kinds = {}
for r in recs: kinds[r.get("kind")] = kinds.get(r.get("kind"), 0) + 1
print("kinds", kinds)
line = "Oh--oh, oh my love"
toks = [r for r in recs if r.get("kind") == "token" and r.get("line_id", "").endswith(":0") or (r.get("kind")=="token" and r.get("coordinate", [None])[0] == 0)]
toks = [r for r in recs if r.get("kind") == "token"]
syl = [r for r in recs if r.get("kind") == "syllable"]
for t in toks:
    if t.get("line_id") not in ("line:0",) and not str(t.get("token_id","")).startswith("line:0:"): continue
    sr = t.get("source_ranges")
    chars = [(x.get("start"), x.get("end")) if isinstance(x, dict) else x for x in (sr or [])]
    mine = [s for s in syl if s.get("token_id") == t.get("token_id")]
    phones = [s.get("syllable") for s in mine]
    print(f"token {t.get('token')} (1-based {t.get('token')+1}) text={t.get('text')!r} ranges={chars} "
          f"reading_choices.token={t.get('reading_choices',{}).get('token')} syllables={json.dumps(phones)}")
